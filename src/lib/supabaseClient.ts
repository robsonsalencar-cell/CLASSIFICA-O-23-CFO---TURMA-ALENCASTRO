import { createClient } from "@supabase/supabase-js";

// No Lovable, ao conectar o Supabase (botão verde no editor), essas variáveis
// são preenchidas automaticamente. Se preferir configurar manualmente, crie um
// arquivo .env na raiz do projeto com:
// VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
// VITE_SUPABASE_ANON_KEY=sua-anon-key-publica
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Extrai a mensagem de erro REAL de uma chamada supabase.functions.invoke().
 *
 * Quando uma Edge Function retorna um status HTTP não-2xx, o supabase-js NÃO
 * lê automaticamente o corpo JSON da resposta — ele só expõe uma mensagem
 * genérica em error.message ("Edge Function returned a non-2xx status
 * code"), escondendo a causa real (que a função já devolve certinho no
 * corpo, ex: {"error": "e-mail já cadastrado"}). O corpo de verdade fica em
 * error.context, o objeto Response bruto, que essa função lê.
 *
 * Ver histórico: mesmo bug identificado e corrigido primeiro em
 * ImportarDiarioPdf.tsx (17/08/2026) — esta versão é a genérica/reutilizável
 * pra qualquer tela que chame Edge Functions.
 */
export async function extrairMensagemErroEdgeFunction(
  error: { message?: string; context?: unknown } | null,
  data: unknown
): Promise<string> {
  const doCorpoJaParsado = (data as any)?.error;
  if (doCorpoJaParsado) return doCorpoJaParsado;

  const contexto = (error as any)?.context;
  if (contexto && typeof contexto.json === "function") {
    try {
      const corpo = await contexto.json();
      if (corpo?.error) return corpo.error;
    } catch {
      // corpo não era JSON válido (ex: erro de rede/proxy) — cai no fallback abaixo
    }
  }

  return error?.message ?? "Erro desconhecido";
}

// Tipos de apoio (ajuste conforme o schema.sql)
export type AppRole = "admin" | "admin_institucional" | "aluno" | "desenvolvedor" | "visitante";

export interface Profile {
  id: string;
  nome_completo: string;
  email: string;
  cpf: string | null;
  matricula: string | null;
  matricula_academia: string | null;
  role: AppRole;
  turma_id: string | null;
  senha_trocada: boolean;
  created_at: string;
}
