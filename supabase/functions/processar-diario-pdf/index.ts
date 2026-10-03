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
// Requer um segredo configurado no projeto Supabase:
//   GEMINI_API_KEY  (gere em https://aistudio.google.com/apikey)
//
// Deploy:
//   supabase functions deploy processar-diario-pdf
//   supabase secrets set GEMINI_API_KEY=xxxxx

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

    // Tentamos de novo automaticamente em dois cenários diferentes:
    // - HTTP 429: cota da chave esgotada (esperamos o "retryDelay" que a
    //   própria Gemini sugere, quando vem no corpo do erro).
    // - HTTP 503: o MODELO está sobrecarregado no lado do Google ("This
    //   model is currently experiencing high demand") — não tem relação
    //   com a nossa cota, é só fila temporária do modelo.
    // Em ambos os casos, até 5 tentativas com espera crescente (backoff de
    // 10/20/30/40s) quando a API não informa quanto esperar. Mantém folga
    // para não estourar o tempo máximo de execução da Edge Function.
    // Usamos o "3.5" (legado) em vez do "3.8" (mais novo) porque modelos
    // recém-lançados tendem a ficar sobrecarregados com mais frequência —
    // o 3.5 já é mais do que suficiente para ler uma tabela de notas.
    const MODELO_GEMINI = "gemini-3.5-flash";
    const MAX_TENTATIVAS = 5;
    let response: Response | null = null;
    let corpoErro: any = null;

    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_GEMINI}:generateContent`,
        {
          method: "POST",
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
                  { inline_data: { mime_type: "application/pdf", data: pdf_base64 } },
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

      if (response.ok) break;

      const tentarDeNovo = response.status === 429 || response.status === 503;

      if (tentarDeNovo && tentativa < MAX_TENTATIVAS) {
        corpoErro = await response.json().catch(() => null);
        const retryInfo = (corpoErro?.error?.details ?? []).find((d: any) =>
          String(d["@type"] ?? "").includes("RetryInfo")
        );
        const retryDelaySegundos = retryInfo?.retryDelay
          ? parseFloat(String(retryInfo.retryDelay).replace("s", ""))
          : NaN;
        const esperaMs = !isNaN(retryDelaySegundos)
          ? retryDelaySegundos * 1000
          : tentativa * 10000; // 10s, 20s, 30s, 40s... se a API não disser quanto esperar
        await new Promise((r) => setTimeout(r, esperaMs));
        continue;
      }

      // Erro que não tentamos de novo, ou esgotou as tentativas: guarda o
      // corpo e sai do loop para responder abaixo.
      corpoErro = await response.json().catch(() => null);
      break;
    }

    if (!response || !response.ok) {
      const mensagemAmigavel =
        response?.status === 429
          ? "A API da Gemini está recusando novas requisições por excesso de uso (cota da chave gratuita). " +
            "Tentei novamente algumas vezes automaticamente, mas o limite continua ativo — ative o faturamento " +
            "pré-pago (com teto de gasto) na conta Google usada para gerar a chave, em aistudio.google.com, " +
            "para que isso pare de acontecer."
          : response?.status === 503
          ? "O modelo da Gemini está com alta demanda no momento (instabilidade do lado do Google, não da sua " +
            "conta). Tentei novamente algumas vezes automaticamente, mas continuou sobrecarregado — aguarde " +
            "alguns minutos e tente importar este diário de novo."
          : `Erro na API da Gemini: ${corpoErro?.error?.message ?? JSON.stringify(corpoErro)}`;
      return new Response(JSON.stringify({ error: mensagemAmigavel }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resultado = await response.json();

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
    const mapaNomeParaId = new Map((alunosDaTurma ?? []).map((a) => [a.nome_completo, a.id]));
    const alunosComStatus = (extraido.alunos ?? []).map((a: any) => ({
      ...a,
      aluno_id: mapaNomeParaId.get(a.nome) ?? null,
      encontrado: mapaNomeParaId.has(a.nome),
    }));

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
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
