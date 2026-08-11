// Supabase Edge Function: admin-update-user
// Permite ao admin editar nome, e-mail, CPF, perfil (role) e opcionalmente
// redefinir a senha de um usuário já existente.
// Só pode ser chamada por um usuário autenticado com role = 'admin'.
//
// Deploy:
//   supabase functions deploy admin-update-user

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
      .select("role")
      .eq("id", caller.id)
      .single();

    if (callerProfile?.role !== "admin" && callerProfile?.role !== "desenvolvedor") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem editar usuários." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, nome_completo, email, cpf, matricula, role, nova_senha, turma_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (email || nova_senha) {
      const payload: Record<string, unknown> = {};
      if (email) payload.email = email;
      if (nova_senha) payload.password = nova_senha;

      const { error: authError } = await adminClient.auth.admin.updateUserById(user_id, payload);
      if (authError) {
        return new Response(JSON.stringify({ error: authError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const patch: Record<string, unknown> = {};
    if (nome_completo) patch.nome_completo = nome_completo;
    if (email) patch.email = email;
    if (cpf !== undefined) patch.cpf = cpf || null;
    if (matricula !== undefined) patch.matricula = matricula || null;
    if (role) patch.role = role;
    if (turma_id) patch.turma_id = turma_id;

    if (Object.keys(patch).length > 0) {
      const { data: antes } = await adminClient.from("profiles").select("*").eq("id", user_id).single();

      const { error: profileError } = await adminClient.from("profiles").update(patch).eq("id", user_id);
      if (profileError) {
        return new Response(JSON.stringify({ error: profileError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await adminClient.rpc("registrar_auditoria_manual", {
        p_tabela: "profiles",
        p_operacao: "UPDATE",
        p_registro_id: user_id,
        p_ator_id: caller.id,
        p_dados_antigos: antes ?? null,
        p_dados_novos: patch,
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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
