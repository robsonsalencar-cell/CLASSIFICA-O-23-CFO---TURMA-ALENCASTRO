import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { userId, nome_completo, email, cpf, role, newPassword } = await req.json()

    if (!userId) {
      throw new Error('User ID é obrigatório.')
    }

    // 1. Atualizar dados no Auth (E-mail e/ou Senha se fornecidos)
    const updateAuthPayload: any = {}
    if (email) updateAuthPayload.email = email
    if (newPassword) updateAuthPayload.password = newPassword

    if (Object.keys(updateAuthPayload).length > 0) {
      const { error: authError } = await supabaseClient.auth.admin.updateUserById(
        userId,
        updateAuthPayload
      )
      if (authError) throw authError
    }

    // 2. Atualizar tabela profiles
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .update({
        nome_completo,
        email,
        cpf: cpf || null,
        role,
      })
      .eq('id', userId)

    if (profileError) throw profileError

    return new Response(
      JSON.stringify({ message: 'Usuário atualizado com sucesso!' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
