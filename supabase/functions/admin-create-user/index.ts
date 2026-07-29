// Supabase Edge Function: admin-create-user
// Cria um novo usuário (aluno ou admin) com e-mail + senha provisória.
// Só pode ser chamada por um usuário já autenticado com role = 'admin'.
//
// Deploy (via CLI, dentro do projeto Lovable/Supabase):
//   supabase functions deploy admin-create-user
//
// Variáveis de ambiente necessárias (configure em Supabase > Edge Functions > Secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (já disponíveis por padrão no ambiente da function)

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

    // Cliente "do chamador", só para validar quem está fazendo a requisição
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

    // Cliente admin (service_role) para checar permissão e criar o novo usuário
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (callerProfile?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem criar usuários." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, nome_completo, cpf, senha_provisoria, role, turma_id } = await req.json();

    if (!email || !nome_completo || !senha_provisoria || !turma_id) {
      return new Response(JSON.stringify({ error: "email, nome_completo, senha_provisoria e turma_id são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: senha_provisoria,
      email_confirm: true,
      user_metadata: {
        nome_completo,
        cpf: cpf ?? null,
        role: role === "admin" ? "admin" : "aluno",
        turma_id,
      },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // O profile é criado automaticamente pelo trigger on_auth_user_created (ver schema.sql);
    // aqui só precisamos gravar o turma_id, que o trigger não conhece.
    const { error: turmaError } = await adminClient
      .from("profiles")
      .update({ turma_id })
      .eq("id", created.user.id);

    if (turmaError) {
      return new Response(JSON.stringify({ error: turmaError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.rpc("registrar_auditoria_manual", {
      p_tabela: "profiles",
      p_operacao: "INSERT",
      p_registro_id: created.user.id,
      p_ator_id: caller.id,
      p_dados_antigos: null,
      p_dados_novos: { nome_completo, email, role: role ?? "aluno", turma_id },
    });

    // O profile é criado automaticamente pelo trigger on_auth_user_created (ver schema.sql)
    return new Response(JSON.stringify({ user: created.user }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
