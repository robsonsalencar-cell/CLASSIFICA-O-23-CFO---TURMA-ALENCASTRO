// Supabase Edge Function: admin-delete-user
// Permite excluir permanentemente um usuário (conta de login + perfil).
// Só pode ser chamada por quem tem autoridade de admin sobre a TURMA do
// usuário-alvo (pode_configurar_turma) — corrigido em 05/09/2026: a versão
// anterior só checava profiles.role global ('admin'/'desenvolvedor'), sem
// nenhum filtro de turma_id, então um 'admin' (Aluno-Auxiliar) de QUALQUER
// turma conseguia excluir usuário de QUALQUER OUTRA turma (mesmo bug de
// "query em lote sem WHERE turma_id" descrito na seção 5 do histórico do
// projeto, aqui na forma de uma Edge Function). admin-create-user e
// admin-update-user já usavam pode_configurar_turma corretamente — esta
// function ficou pra trás.
//
// Deploy:
//   supabase functions deploy admin-delete-user

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

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Você não pode excluir sua própria conta por aqui." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Exclui a conta de autenticação — o perfil e todas as notas são removidos
    // automaticamente por CASCADE (ver schema.sql).
    const { data: antes } = await adminClient.from("profiles").select("*").eq("id", user_id).single();

    if (!antes) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // pode_configurar_turma cobre: dono oficial da turma, admin institucional
    // (se não finalizada ou autorizado), desenvolvedor, ou qualquer admin
    // numa turma nova que ainda não tem admin oficial (janela de bootstrap).
    // Escopado pela turma do ALVO, não pela do chamador — é o que impede o
    // cross-turma descrito no comentário do topo deste arquivo.
    const { data: podeConfigurar } = await adminClient.rpc("pode_configurar_turma", {
      p_turma_id: antes.turma_id,
      p_usuario_id: caller.id,
    });

    if (!podeConfigurar) {
      return new Response(JSON.stringify({ error: "Você não tem permissão para excluir este usuário." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.rpc("registrar_auditoria_manual", {
      p_tabela: "profiles",
      p_operacao: "DELETE",
      p_registro_id: user_id,
      p_ator_id: caller.id,
      p_dados_antigos: antes ?? null,
      p_dados_novos: null,
    });

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
