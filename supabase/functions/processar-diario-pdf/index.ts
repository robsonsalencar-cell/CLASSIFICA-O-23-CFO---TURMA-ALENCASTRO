// Supabase Edge Function: processar-diario-pdf
// Recebe um PDF de Diário de Classe (escaneado) + o nome da matéria, usa a
// API da Anthropic (Claude, com visão) para EXTRAIR os dados da tabela
// (nome do aluno + notas de VC/VF), e devolve isso pro admin CONFERIR antes
// de gravar qualquer coisa no banco — esta função NUNCA grava notas sozinha.
//
// Requer um segredo configurado no projeto Supabase:
//   ANTHROPIC_API_KEY  (crie em https://console.anthropic.com/settings/keys —
//   é uma conta separada da Claude.ai, com faturamento próprio por uso de API)
//
// Deploy:
//   supabase functions deploy processar-diario-pdf
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-xxxxx

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
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!anthropicKey) {
      return new Response(
        JSON.stringify({
          error:
            "ANTHROPIC_API_KEY não configurada nos segredos do Supabase. Veja o comentário no topo deste arquivo.",
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

    const { pdf_base64, materia } = await req.json();

    if (!pdf_base64 || !materia) {
      return new Response(JSON.stringify({ error: "pdf_base64 e materia são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca os alunos da turma do admin, para ajudar a IA a casar os nomes
    // exatamente como estão cadastrados (evita "quase igual" ficar sem casar).
    const { data: alunosDaTurma } = await adminClient
      .from("profiles")
      .select("id, nome_completo")
      .eq("role", "aluno")
      .eq("turma_id", callerProfile.turma_id);

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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: pdf_base64 },
              },
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const erroTexto = await response.text();
      return new Response(JSON.stringify({ error: `Erro na API da Anthropic: ${erroTexto}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resultado = await response.json();
    const textoResposta = resultado.content?.map((b: any) => b.text ?? "").join("") ?? "";

    let extraido;
    try {
      const jsonLimpo = textoResposta.replace(/```json|```/g, "").trim();
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
