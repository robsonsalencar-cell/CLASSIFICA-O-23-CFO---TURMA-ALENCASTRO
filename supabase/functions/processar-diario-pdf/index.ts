// Supabase Edge Function: processar-diario-pdf
// Recebe um PDF de Diário de Classe (escaneado) + o nome da matéria, usa a
// API do Google Gemini (Document Understanding, com OCR + LLM embutidos)
// para EXTRAIR os dados da tabela (nome do aluno + notas de VC/VF), e
// devolve isso pro admin CONFERIR antes de gravar qualquer coisa no banco —
// esta função NUNCA grava notas sozinha.
//
// Antes esta função usava a Mistral AI; trocamos para a Gemini porque a
// cota gratuita da Mistral esgotava com facilidade (2 diários seguidos já
// era suficiente). Para a Gemini NÃO esgotar da mesma forma, ative o
// faturamento pré-pago (billing) na conta Google usada para gerar a chave —
// a assinatura "Google AI Pro/Ultra" NÃO aumenta o limite da API usada
// aqui, ela só aumenta o limite de uso manual dentro do site do AI Studio.
//
// ALTERAÇÃO (07/10/2026): a versão anterior fazia até 5 tentativas com
// esperas de 10/20/30/40s (100s só de espera) + o tempo de cada resposta da
// Gemini. Com a Gemini sobrecarregada (HTTP 503), isso passava dos ~150s
// que o Supabase permite no plano Free e a função era MORTA pelo gateway
// (HTTP 546 WORKER_RESOURCE_LIMIT) — o admin via só "non-2xx status code".
// Agora:
//   - existe um ORÇAMENTO DE TEMPO TOTAL (125s) e a função nunca começa uma
//     tentativa nova se não houver folga — sempre responde com mensagem
//     amigável ANTES de ser cortada;
//   - cada tentativa tem timeout próprio (AbortController);
//   - se um modelo está sobrecarregado (503) ou sem cota (429), tenta
//     IMEDIATAMENTE o próximo modelo da lista MODELOS (inclui a Mistral como reserva) antes de
//     esperar;
//   - cada tentativa é registrada com console.log (aparece em Edge
//     Functions → processar-diario-pdf → Logs).
//
// Requer um segredo configurado no projeto Supabase:
//   GEMINI_API_KEY  (gere em https://aistudio.google.com/apikey)
//
// Deploy: colar o arquivo inteiro na tela do Supabase (Edge Functions →
// processar-diario-pdf → colar → Deploy). Função autocontida, sem imports
// de arquivos compartilhados.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// CORS: só libera o domínio de produção + localhost (porta do Vite) em vez
// de "*" (qualquer site). Ecoa a origem de quem chamou só se ela estiver
// na lista permitida.
const ALLOWED_ORIGINS = new Set(["https://painel-cfo-apmcv.vercel.app", "http://localhost:8080"]);
const ORIGEM_PADRAO = "https://painel-cfo-apmcv.vercel.app";
function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = ALLOWED_ORIGINS.has(origin) ? origin : ORIGEM_PADRAO;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Vary": "Origin",
  };
}

// Modelos tentados, em ordem. O primeiro é o preferido (mais estável). Se
// ele estiver sobrecarregado/sem cota, o próximo é tentado na hora. Para
// adicionar outro modelo, basta incluir o nome aqui. Um modelo que não
// existir (HTTP 404) é simplesmente pulado.
// A Mistral entra como RESERVA (só é usada se o segredo MISTRAL_API_KEY
// existir no Supabase) — se a Gemini estiver sobrecarregada, tenta ela.
const MODELOS: { prov: "gemini" | "mistral"; nome: string }[] = [
  { prov: "gemini", nome: "gemini-3.5-flash" },
  { prov: "gemini", nome: "gemini-3.8-flash" },
  { prov: "mistral", nome: "mistral-small-latest" },
];

// Orçamento de tempo. O limite do Supabase (plano Free) é ~150s por
// execução; deixamos folga para a autenticação/consultas iniciais e para
// montar a resposta final.
const ORCAMENTO_MS = 125_000; // tempo total máximo gasto falando com a Gemini
const MARGEM_MIN_MS = 15_000; // não começa tentativa nova com menos que isso
const TIMEOUT_TENTATIVA_MS = 80_000; // teto de uma única chamada à Gemini

const STATUS_RETENTAVEIS = new Set([429, 500, 503, 504]);

async function dormir(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

type RespostaGemini = {
  ok: boolean;
  status: number;
  json: any;
  abortado: boolean;
};

async function chamarGemini(
  modelo: string,
  geminiKey: string,
  prompt: string,
  pdfBase64: string,
  timeoutMs: number
): Promise<RespostaGemini> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: prompt },
                { inline_data: { mime_type: "application/pdf", data: pdfBase64 } },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
          },
        }),
      }
    );
    // O corpo é lido ainda dentro do timeout (o abort também cobre a leitura).
    const json = await resp.json().catch(() => null);
    return { ok: resp.ok, status: resp.status, json, abortado: false };
  } catch (e) {
    const abortado = (e as Error)?.name === "AbortError";
    return {
      ok: false,
      status: abortado ? 0 : -1,
      json: { error: { message: String(e) } },
      abortado,
    };
  } finally {
    clearTimeout(timer);
  }
}

// Mistral (reserva). Devolve a resposta já NORMALIZADA no formato da Gemini
// ({candidates:[{content:{parts:[{text}]}, finishReason}]}) para o resto da
// função não precisar saber qual provedor respondeu.
async function chamarMistral(
  modelo: string,
  mistralKey: string,
  prompt: string,
  pdfBase64: string,
  timeoutMs: number
): Promise<RespostaGemini> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mistralKey}`,
      },
      body: JSON.stringify({
        model: modelo,
        temperature: 0,
        max_tokens: 8192,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "document_url", document_url: `data:application/pdf;base64,${pdfBase64}` },
            ],
          },
        ],
      }),
    });
    const json = await resp.json().catch(() => null);
    if (!resp.ok) return { ok: false, status: resp.status, json, abortado: false };

    const choice = json?.choices?.[0];
    const conteudo = choice?.message?.content;
    const texto =
      typeof conteudo === "string"
        ? conteudo
        : (conteudo ?? []).map((c: any) => c?.text ?? "").join("");
    return {
      ok: true,
      status: resp.status,
      json: {
        candidates: [
          {
            content: { parts: [{ text: texto }] },
            finishReason: choice?.finish_reason === "length" ? "MAX_TOKENS" : "STOP",
          },
        ],
      },
      abortado: false,
    };
  } catch (e) {
    const abortado = (e as Error)?.name === "AbortError";
    return {
      ok: false,
      status: abortado ? 0 : -1,
      json: { error: { message: String(e) } },
      abortado,
    };
  } finally {
    clearTimeout(timer);
  }
}

function extrairRetryDelayMs(corpo: any): number {
  const retryInfo = (corpo?.error?.details ?? []).find((d: any) =>
    String(d["@type"] ?? "").includes("RetryInfo")
  );
  const segundos = retryInfo?.retryDelay ? parseFloat(String(retryInfo.retryDelay).replace("s", "")) : NaN;
  return isNaN(segundos) ? 0 : segundos * 1000;
}

Deno.serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const mistralKey = Deno.env.get("MISTRAL_API_KEY");

    if (!geminiKey) {
      return new Response(
        JSON.stringify({
          error:
            "GEMINI_API_KEY não configurada nos segredos do Supabase. Veja o comentário no topo deste arquivo.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: caller },
    } = await callerClient.auth.getUser();

    if (!caller) {
      return new Response(JSON.stringify({ error: "Sessão inválida." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role, turma_id")
      .eq("id", caller.id)
      .single();

    if (
      !callerProfile ||
      !["admin", "admin_institucional", "desenvolvedor"].includes(callerProfile.role)
    ) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem importar diários." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { pdf_base64, materia, turma_id, tabela } = await req.json();

    if (!pdf_base64 || !materia || !turma_id) {
      return new Response(JSON.stringify({ error: "pdf_base64, materia e turma_id são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Autoridade real de "pode editar notas desta turma" — mesma função SQL
    // usada pela RLS em todo o resto do sistema (pode_editar_turma), que já
    // trata corretamente admin_institucional (inclusive a regra de turma
    // finalizada/autorização institucional). Substituiu uma checagem manual
    // de role que não reconhecia admin_institucional e bloqueava a
    // importação de diário pra esse papel.
    const { data: podeEditar, error: erroPermissao } = await adminClient.rpc("pode_editar_turma", {
      p_turma_id: turma_id,
      p_usuario_id: caller.id,
    });

    if (erroPermissao || !podeEditar) {
      return new Response(
        JSON.stringify({ error: "Você não tem permissão para importar diários nesta turma." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Busca os alunos da TURMA EM FOCO que estão matriculados neste módulo
    // específico (um aluno que saiu do curso no meio não deve nem aparecer
    // como opção de casamento de nome). Não filtramos por role="aluno" —
    // um admin/desenvolvedor que também é cadete matriculado (ex: o próprio
    // criador do sistema) deve ser considerado igualmente.
    let queryAlunos = adminClient
      .from("profiles")
      .select("id, nome_completo")
      .eq("turma_id", turma_id);

    if (tabela && ["notas_cfo1", "notas_cfo2", "notas_cfo3"].includes(tabela)) {
      const colunaMatricula = `matriculado_${tabela.replace("notas_", "")}`;
      queryAlunos = queryAlunos.eq(colunaMatricula, true);
    }

    const { data: alunosDaTurma, error: erroAlunos } = await queryAlunos;

    if (erroAlunos) {
      return new Response(
        JSON.stringify({ error: `Erro ao buscar alunos da turma: ${erroAlunos.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!alunosDaTurma || alunosDaTurma.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "Nenhum aluno matriculado encontrado para esta turma/módulo. Verifique se a migração do banco foi aplicada corretamente (colunas matriculado_cfo1/2/3).",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const listaNomes = (alunosDaTurma ?? []).map((a) => a.nome_completo).join("\n");

    const prompt = `Este é um "Diário de Classe" escaneado da disciplina "${materia}".
Extraia uma tabela com os alunos e as notas lançadas (colunas como VC1, VC2, VC3, VC4, VF, VSE
— nem toda disciplina tem todas essas colunas, use só as que existirem no documento).

Aqui está a lista OFICIAL de nomes de alunos desta turma — use-a para corrigir pequenas
diferenças de OCR e casar cada linha da tabela com o nome EXATO desta lista:
${listaNomes}

Responda SOMENTE em JSON, sem nenhum texto antes ou depois, neste formato exato:
{
  "alunos": [
    { "nome": "NOME EXATO DA LISTA OFICIAL", "vc_lista": [7.5, 2.0], "vf": 10.0 }
  ]
}

Regras importantes:
- "vc_lista" é um array com TODOS os valores de VC/VC1/VC2/VC3/VC4 que existirem para aquele
  aluno naquela matéria (na ordem em que aparecem). Se não houver nenhuma coluna de VC, use [].
- "vf" é o valor da coluna VF/Avaliação Final. Se não existir, use null.
- Se as notas estiverem na escala de 0 a 100 (ex: 100, 90, 80), CONVERTA para a escala de 0 a 10
  dividindo por 10 (ex: 100 vira 10.0, 90 vira 9.0).
- Se um aluno não tiver nenhuma nota lançada nessa matéria, não inclua ele na lista.
- Não invente valores — se não conseguir ler algum número com certeza, use null nesse campo.`;

    // ------------------------------------------------------------------
    // Chamada à Gemini com ORÇAMENTO DE TEMPO + fallback de modelo.
    //
    // Cenários tratados:
    // - 503: MODELO sobrecarregado no lado do Google (fila temporária).
    // - 429: cota da chave esgotada (a Gemini pode sugerir "retryDelay").
    // - timeout da tentativa (AbortController) e 500/504 transitórios.
    // Em todos eles: tenta o próximo modelo da lista na hora; se a rodada
    // inteira falhar, espera um pouco (8s, 16s, 24s... ou o retryDelay da
    // API, se couber) e repete — mas NUNCA ultrapassa o ORCAMENTO_MS.
    // Erros não retentáveis (400, 401, 403...) param na hora.
    // ------------------------------------------------------------------
    const modelosAtivos = MODELOS.filter((m) => m.prov !== "mistral" || !!mistralKey);
    const inicioMs = Date.now();
    const restanteMs = () => ORCAMENTO_MS - (Date.now() - inicioMs);

    let resultado: any = null;
    let modeloUsado = "";
    let ultimoStatus = 0;
    let ultimoCorpoErro: any = null;
    let ultimaFoiTimeout = false;
    let erroFatal = false;
    let tentativasTotal = 0;

    rodadas: for (let rodada = 1; ; rodada++) {
      let houveFalhaRetentavel = false;
      let maiorRetryDelayMs = 0;

      for (const m of modelosAtivos) {
        const modelo = m.nome;
        if (restanteMs() < MARGEM_MIN_MS) break rodadas;

        const timeoutMs = Math.min(TIMEOUT_TENTATIVA_MS, restanteMs() - 2000);
        tentativasTotal++;
        const t0 = Date.now();
        const r =
          m.prov === "mistral"
            ? await chamarMistral(modelo, mistralKey!, prompt, pdf_base64, timeoutMs)
            : await chamarGemini(modelo, geminiKey, prompt, pdf_base64, timeoutMs);
        console.log(
          `[processar-diario-pdf] rodada=${rodada} modelo=${modelo} status=${r.status} ` +
            `abortado=${r.abortado} duracao=${Math.round((Date.now() - t0) / 1000)}s ` +
            `restante=${Math.round(restanteMs() / 1000)}s`
        );

        if (r.ok) {
          resultado = r.json;
          modeloUsado = modelo;
          break rodadas;
        }

        ultimoStatus = r.status;
        ultimoCorpoErro = r.json;
        ultimaFoiTimeout = r.abortado;
        console.error(
          `[processar-diario-pdf] erro API (${modelo}): ${JSON.stringify(r.json)?.slice(0, 500)}`
        );

        if (r.status === 404) {
          // Modelo inexistente/indisponível: pula para o próximo da lista.
          continue;
        }

        if (r.abortado || STATUS_RETENTAVEIS.has(r.status)) {
          houveFalhaRetentavel = true;
          if (r.status === 429) {
            maiorRetryDelayMs = Math.max(maiorRetryDelayMs, extrairRetryDelayMs(r.json));
          }
          continue; // tenta o próximo modelo imediatamente
        }

        // Erro que não adianta repetir (ex: chave inválida, requisição inválida).
        erroFatal = true;
        break rodadas;
      }

      if (!houveFalhaRetentavel) break; // nada mais a tentar

      const espera = Math.max(rodada * 8000, maiorRetryDelayMs);
      if (espera > restanteMs() - MARGEM_MIN_MS) break; // não cabe esperar + tentar de novo
      console.log(`[processar-diario-pdf] todos os modelos falharam; aguardando ${Math.round(espera / 1000)}s`);
      await dormir(espera);
    }

    if (!resultado) {
      const segundosGastos = Math.round((Date.now() - inicioMs) / 1000);
      console.error(
        `[processar-diario-pdf] desistindo após ${tentativasTotal} tentativa(s) em ${segundosGastos}s. ` +
          `Último status=${ultimoStatus}`
      );

      const mensagemAmigavel = erroFatal
        ? `Erro na API da Gemini (HTTP ${ultimoStatus}): ${ultimoCorpoErro?.error?.message ?? JSON.stringify(ultimoCorpoErro)}`
        : ultimoStatus === 429
        ? "A API da Gemini está recusando novas requisições por excesso de uso (cota da chave gratuita). " +
          `Tentei ${tentativasTotal} vez(es) com ${modelosAtivos.length} modelo(s) em ${segundosGastos}s, ` +
          "mas o limite continua ativo — aguarde alguns minutos ou ative o faturamento pré-pago (com teto de " +
          "gasto) na conta Google usada para gerar a chave, em aistudio.google.com."
        : ultimaFoiTimeout
        ? "A Gemini demorou demais para responder (instabilidade do lado do Google, não da sua conta). " +
          `Tentei ${tentativasTotal} vez(es) em ${segundosGastos}s — aguarde alguns minutos e tente importar ` +
          "este diário de novo."
        : "Os modelos da Gemini estão com alta demanda no momento (instabilidade do lado do Google, não da sua " +
          `conta). Tentei ${tentativasTotal} vez(es) com ${modelosAtivos.length} modelo(s) em ${segundosGastos}s, ` +
          "mas todos continuaram sobrecarregados — aguarde alguns minutos e tente importar este diário de novo.";

      return new Response(JSON.stringify({ error: mensagemAmigavel }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[processar-diario-pdf] sucesso com ${modeloUsado} após ${tentativasTotal} tentativa(s)`);

    // Prompt bloqueado por filtro de segurança (sem nenhum candidato) —
    // raro para um diário de classe, mas possível.
    if (!resultado.candidates || resultado.candidates.length === 0) {
      return new Response(
        JSON.stringify({
          error: `A IA não retornou nenhum resultado (motivo: ${
            resultado.promptFeedback?.blockReason ?? "desconhecido"
          }). Resposta bruta: ${JSON.stringify(resultado)}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const candidato = resultado.candidates[0];

    // Detecta se a resposta foi cortada por atingir o limite de tokens —
    // nesse caso o JSON fica incompleto e não dá pra recuperar.
    if (candidato.finishReason === "MAX_TOKENS") {
      return new Response(
        JSON.stringify({
          error:
            "A resposta da IA foi cortada por ser muito longa (diário com muitos alunos/colunas). Tente novamente ou avise o suporte.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const textoResposta = (candidato.content?.parts ?? [])
      .map((p: any) => p.text ?? "")
      .join("");

    let extraido;
    try {
      // Como pedimos responseMimeType "application/json", a resposta já
      // deve vir como JSON puro — mas mantemos a limpeza como segurança
      // extra, caso a IA ainda adicione blocos de código markdown.
      let jsonLimpo = textoResposta.replace(/```json|```/g, "").trim();
      const inicio = jsonLimpo.indexOf("{");
      const fim = jsonLimpo.lastIndexOf("}");
      if (inicio !== -1 && fim !== -1 && fim > inicio) {
        jsonLimpo = jsonLimpo.slice(inicio, fim + 1);
      }
      extraido = JSON.parse(jsonLimpo);
    } catch {
      return new Response(
        JSON.stringify({ error: "A IA não devolveu um JSON válido.", resposta_bruta: textoResposta }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Casa cada nome extraído com o cadastro real (para já devolver o aluno_id)
    // Casamento tolerante: primeiro tenta o nome EXATO; se não achar, tenta
    // ignorando acentos, maiúsculas e espaços extras (ex: "RAI KEVIN MACEDO"
    // casa com "RAÍ KEVIN MACEDO"). Se dois alunos tiverem nomes iguais sem
    // acento (ambíguo), não casa sozinho — o admin escolhe na prévia.
    const normalizar = (s: string) =>
      String(s ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
    const mapaNomeParaId = new Map((alunosDaTurma ?? []).map((a) => [a.nome_completo, a.id]));
    const mapaNormalizado = new Map<string, string | null>(); // null = ambíguo
    for (const a of alunosDaTurma ?? []) {
      const k = normalizar(a.nome_completo);
      mapaNormalizado.set(k, mapaNormalizado.has(k) ? null : a.id);
    }
    const alunosComStatus = (extraido.alunos ?? []).map((a: any) => {
      const id = mapaNomeParaId.get(a.nome) ?? mapaNormalizado.get(normalizar(a.nome)) ?? null;
      return { ...a, aluno_id: id, encontrado: id !== null };
    });

    return new Response(
      JSON.stringify({
        alunos: alunosComStatus,
        materia,
        // devolvido também para o admin poder escolher manualmente quando
        // "encontrado" vier false (nome não bateu perfeitamente)
        alunos_da_turma: alunosDaTurma ?? [],
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error(`[processar-diario-pdf] exceção: ${String(err)}`);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
