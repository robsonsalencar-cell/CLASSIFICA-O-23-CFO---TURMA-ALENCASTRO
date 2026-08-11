import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { TabelaModulo } from "@/hooks/useNotasModulo";
import { useAuth } from "@/contexts/AuthContext";
import { useTurma } from "@/contexts/TurmaContext";
import { MATERIAS_CFO1 } from "@/config/materiasCfo1";
import { MATERIAS_CFO2 } from "@/config/materiasCfo2";
import { MATERIAS_CFO3 } from "@/config/materiasCfo3";

// Lista curricular oficial por tabela — enviada ao banco pra filtrar
// materias_lancadas contra os nomes reais de matéria (ver comentário logo
// abaixo). Mesma fonte de verdade que useAlunosModulo.ts já usa no front-end.
const MATERIAS_POR_TABELA: Record<TabelaModulo, string[]> = {
  notas_cfo1: MATERIAS_CFO1,
  notas_cfo2: MATERIAS_CFO2,
  notas_cfo3: MATERIAS_CFO3,
};

export interface EstatisticasModulo {
  minha_media: number | null;
  minha_posicao: number | null;
  total_alunos: number;
  media_turma: number;
  desvio_padrao: number;
  maior_media: number;
  menor_media: number;
  materias_lancadas: number;
}

/**
 * Estatísticas agregadas de um módulo (ou "geral") calculadas no servidor via RPC
 * (security definer). Nunca traz nome/nota de outros alunos — só números agregados
 * e a posição/média do próprio usuário (ou do aluno que o admin estiver simulando,
 * já que as funções usam auth.uid() internamente do lado do Postgres). Sempre
 * escopado à turma em foco (turmaAtualId) — cada turma tem seu próprio ranking.
 */
export function useEstatisticasModulo(tabela: TabelaModulo | "geral") {
  const { viewingAsAlunoId } = useAuth();
  const { turmaAtualId } = useTurma();
  const [dados, setDados] = useState<EstatisticasModulo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDados = useCallback(async () => {
    setLoading(true);
    setError(null);

    // materias_lancadas só deve contar matérias que batem com a lista
    // curricular oficial (evita que grafia divergente no banco infle o
    // numerador além do denominador — ver migration_12.sql).
    const { data, error } =
      tabela === "geral"
        ? await supabase.rpc("estatisticas_classificacao_geral", {
            p_aluno_id: viewingAsAlunoId,
            p_turma_id: turmaAtualId,
            p_materias_cfo1: MATERIAS_CFO1,
            p_materias_cfo2: MATERIAS_CFO2,
            p_materias_cfo3: MATERIAS_CFO3,
          })
        : await supabase.rpc("estatisticas_modulo", {
            p_tabela: tabela,
            p_aluno_id: viewingAsAlunoId,
            p_turma_id: turmaAtualId,
            p_materias_oficiais: MATERIAS_POR_TABELA[tabela],
          });

    if (error) {
      setError(error.message);
      setDados(null);
    } else {
      setDados((Array.isArray(data) ? data[0] : data) ?? null);
    }
    setLoading(false);
  }, [tabela, viewingAsAlunoId, turmaAtualId]);

  useEffect(() => {
    fetchDados();
  }, [fetchDados]);

  return { dados, loading, error, refetch: fetchDados };
}
