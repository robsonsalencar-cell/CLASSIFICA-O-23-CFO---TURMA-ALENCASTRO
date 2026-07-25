import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { TabelaModulo } from "@/hooks/useNotasModulo";
import { useAuth } from "@/contexts/AuthContext";

export interface EstatisticasModulo {
  minha_media: number | null;
  minha_posicao: number | null;
  total_alunos: number;
  media_turma: number;
  desvio_padrao: number;
  maior_media: number;
  menor_media: number;
}

/**
 * Estatísticas agregadas de um módulo (ou "geral") calculadas no servidor via RPC
 * (security definer). Nunca traz nome/nota de outros alunos — só números agregados
 * e a posição/média do próprio usuário (ou do aluno que o admin estiver simulando,
 * já que as funções usam auth.uid() internamente do lado do Postgres).
 */
export function useEstatisticasModulo(tabela: TabelaModulo | "geral") {
  const { viewingAsAlunoId } = useAuth();
  const [dados, setDados] = useState<EstatisticasModulo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDados = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data, error } =
      tabela === "geral"
        ? await supabase.rpc("estatisticas_classificacao_geral", { p_aluno_id: viewingAsAlunoId })
        : await supabase.rpc("estatisticas_modulo", { p_tabela: tabela, p_aluno_id: viewingAsAlunoId });

    if (error) {
      setError(error.message);
      setDados(null);
    } else {
      setDados((Array.isArray(data) ? data[0] : data) ?? null);
    }
    setLoading(false);
  }, [tabela, viewingAsAlunoId]);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  return { dados, loading, error, refetch: fetchDados };
}
