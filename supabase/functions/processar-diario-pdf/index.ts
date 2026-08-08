// Supabase Edge Function: processar-diario-pdf
// Recebe um PDF de Diário de Classe (escaneado) + o nome da matéria, usa a
// API da Mistral AI (Document Understanding, com OCR + LLM embutidos) para
// EXTRAIR os dados da tabela (nome do aluno + notas de VC/VF), e devolve
// isso pro admin CONFERIR antes de gravar qualquer coisa no banco — esta
// função NUNCA grava notas sozinha.
//
// Requer um segredo configurado no projeto Supabase:
//   MISTRAL_API_KEY  (crie gratuitamente em https://console.mistral.ai/api-keys —
//   tier gratuito não pede cartão de crédito)
//
// Deploy:
//   supabase functions deploy processar-diario-pdf
//   supabase secrets set MISTRAL_API_KEY=xxxxx

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
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
    const mistralKey = Deno.env.get("MISTRAL_API_KEY");

    if (!mistralKey) {
      return new Response(
        JSON.stringify({
          error:
            "MISTRAL_API_KEY não configurada nos segredos do Supabase. Veja o comentário no topo deste arquivo.",
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

    if (!callerProfile || (callerProfile.role !== "admin" && callerProfile.role !== "desenvolvedor")) {
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

    // Busca os alunos da TURMA EM FOCO que estão matriculados neste módulo
    // específico (um aluno que saiu do curso no meio não deve nem aparecer
    // como opção de casamento de nome).
    let queryAlunos = adminClient
      .from("profiles")
      .select("id, nome_completo")
      .eq("role", "aluno")
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

    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${mistralKey}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        temperature: 0,
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "document_url",
                document_url: `data:application/pdf;base64,${pdf_base64}`,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const erroTexto = await response.text();
      return new Response(JSON.stringify({ error: `Erro na API da Mistral: ${erroTexto}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resultado = await response.json();

    const escolha = resultado.choices?.[0];

    // Detecta se a resposta foi cortada por atingir o limite de tokens —
    // nesse caso o JSON fica incompleto e não dá pra recuperar.
    if (escolha?.finish_reason === "length") {
      return new Response(
        JSON.stringify({
          error:
            "A resposta da IA foi cortada por ser muito longa (diário com muitos alunos/colunas). Tente novamente ou avise o suporte.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!escolha) {
      return new Response(
        JSON.stringify({
          error: `A IA não retornou nenhum resultado. Resposta bruta: ${JSON.stringify(resultado)}`,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const textoResposta = escolha.message?.content ?? "";

    let extraido;
    try {
      // Remove blocos de código markdown, se houver
      let jsonLimpo = textoResposta.replace(/```json|```/g, "").trim();
      // Caso a IA tenha adicionado algum texto antes/depois do JSON (mesmo
      // com instrução contrária), extrai só o trecho entre a primeira "{" e
      // a última "}" — muito mais tolerante a pequenas variações.
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
