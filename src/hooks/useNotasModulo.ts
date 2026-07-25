import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth, useEffectiveAlunoId } from "@/contexts/AuthContext";

export type TabelaModulo = "notas_cfo1" | "notas_cfo2" | "notas_cfo3";

export interface NotaRow {
  id: string;
  aluno_id: string;
  materia: string;
  vc: number | null;
  vf: number | null;
  nota_final: number | null;
  updated_at: string;
  // preenchido via join manual com profiles, para exibição no admin
  aluno_nome?: string;
}

/**
 * Lê as notas de um módulo.
 * - Aluno comum: RLS já garante que só vê as próprias linhas.
 * - Admin em "Visão Geral": vê todos os alunos.
 * - Admin "simulando" um aluno: vê só as linhas daquele aluno.
 */
export function useNotasModulo(tabela: TabelaModulo) {
  const { isAdmin } = useAuth();
  const effectiveAlunoId = useEffectiveAlunoId();
  const [rows, setRows] = useState<NotaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    let query = supabase
      .from(tabela)
      .select(
        isAdmin
          ? "id, aluno_id, materia, vc, vf, nota_final, updated_at, profiles!inner(nome_completo)"
          : "id, aluno_id, materia, vc, vf, nota_final, updated_at"
      );

    if (effectiveAlunoId) {
      query = query.eq("aluno_id", effectiveAlunoId);
    }

    const { data, error } = await query.order("materia", { ascending: true });

    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      const mapped = (data ?? []).map((r: any) => ({
        ...r,
        aluno_nome: r.profiles?.nome_completo,
      }));
      setRows(mapped);
    }
    setLoading(false);
  }, [tabela, isAdmin, effectiveAlunoId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Admin: cria ou atualiza a nota de um aluno em uma matéria (upsert) */
  async function salvarNota(params: {
    aluno_id: string;
    materia: string;
    vc?: number | null;
    vf?: number | null;
    nota_final?: number | null;
  }) {
    const { error } = await supabase
      .from(tabela)
      .upsert(
        { ...params, updated_at: new Date().toISOString() },
        { onConflict: "aluno_id,materia" }
      );
    if (!error) await fetchData();
    return { error: error?.message ?? null };
  }

  async function excluirNota(id: string) {
    const { error } = await supabase.from(tabela).delete().eq("id", id);
    if (!error) await fetchData();
    return { error: error?.message ?? null };
  }

  return { rows, loading, error, refetch: fetchData, salvarNota, excluirNota };
}
