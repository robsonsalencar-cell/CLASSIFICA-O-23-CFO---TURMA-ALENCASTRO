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

    const { email, nome_completo, cpf, matricula_academia, senha_provisoria, role, turma_id } = await req.json();

    if (!email || !nome_completo || !senha_provisoria || !turma_id) {
      return new Response(JSON.stringify({ error: "email, nome_completo, senha_provisoria e turma_id são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // admin_institucional e desenvolvedor só são atribuídos pelos fluxos
    // próprios (transferir_admin_institucional, cadastro manual) — nunca
    // aqui na criação genérica. Qualquer valor fora da lista permitida cai
    // em "aluno" por segurança.
    const rolesPermitidosNaCriacao = ["aluno", "admin", "visitante"];
    const roleFinal = rolesPermitidosNaCriacao.includes(role) ? role : "aluno";

    // pode_configurar_turma cobre: dono oficial da turma, admin institucional
    // (se não finalizada ou autorizado), desenvolvedor, ou qualquer admin
    // numa turma nova que ainda não tem admin oficial (janela de bootstrap).
    const { data: podeConfigurar } = await adminClient.rpc("pode_configurar_turma", {
      p_turma_id: turma_id,
      p_usuario_id: caller.id,
    });

    if (!podeConfigurar) {
      return new Response(JSON.stringify({ error: "Você não tem permissão para cadastrar alunos nesta turma." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: senha_provisoria,
      email_confirm: true,
      // nome_completo/cpf ficam em user_metadata (não são sensíveis pra fins
      // de autorização). role/turma_id vão em app_metadata — ver migration_33:
      // esse campo só pode ser escrito por uma chamada com service_role (como
      // esta), nunca por um supabase.auth.signUp() público. handle_new_user()
      // agora lê ambos de raw_app_meta_data, então mesmo que o cadastro
      // público do Supabase esteja habilitado, ninguém consegue se auto-
      // atribuir um role/turma_id na hora do cadastro.
      user_metadata: {
        nome_completo,
        cpf: cpf ?? null,
      },
      app_metadata: {
        role: roleFinal,
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
    // aqui só precisamos gravar o turma_id e a matrícula, que o trigger não conhece. Também
    // corrigimos matriculado_cfoX aqui: a coluna nasce com true por padrão no banco
    // (pensada pro caso comum de aluno), mas isso está errado pra admin/visitante — só quem
    // é realmente aluno deve nascer matriculado.
    const { error: turmaError } = await adminClient
      .from("profiles")
      .update({
        turma_id,
        matricula_academia: matricula_academia || null,
        matriculado_cfo1: roleFinal === "aluno",
        matriculado_cfo2: roleFinal === "aluno",
        matriculado_cfo3: roleFinal === "aluno",
      })
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
      p_dados_novos: { nome_completo, email, role: roleFinal, turma_id },
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
