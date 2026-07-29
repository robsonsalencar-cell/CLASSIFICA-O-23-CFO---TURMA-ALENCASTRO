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

// Tipos de apoio (ajuste conforme o schema.sql)
export type AppRole = "admin" | "aluno" | "desenvolvedor";

export interface Profile {
  id: string;
  nome_completo: string;
  email: string;
  cpf: string | null;
  role: AppRole;
  turma_id: string | null;
  senha_trocada: boolean;
  created_at: string;
}
