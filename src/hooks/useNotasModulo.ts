import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth, useEffectiveAlunoId } from "@/contexts/AuthContext";
import { useTurma } from "@/contexts/TurmaContext";

export type TabelaModulo = "notas_cfo1" | "notas_cfo2" | "notas_cfo3";

export interface NotaRow {
  id: string;
  aluno_id: string;
  materia: string;
  vc: number | null;
  vc_lista: number[] | null;
  vf: number | null;
  nota_final: number | null;
  verif_2a_epoca: number | null;
  media_2a_epoca: number | null;
  updated_at: string;
  // preenchido via join manual com profiles, para exibição no admin
  aluno_nome?: string;
  aluno_matricula?: string | null;
}

/**
 * Lê as notas de um módulo.
 * - Aluno comum: RLS já garante que só vê as próprias linhas — a menos que
 *   a turma esteja com "ranking_publico" ligado, aí vê a turma inteira.
 * - Admin em "Visão Geral": vê todos os alunos DA TURMA EM FOCO.
 * - Admin "simulando" um aluno: vê só as linhas daquele aluno — a menos que
 *   a turma esteja com "ranking_publico" ligado, aí vê a turma inteira (pra
 *   a pré-visualização bater com o que o aluno realmente veria).
 */
export function useNotasModulo(tabela: TabelaModulo) {
  const { isAdmin } = useAuth();
  const effectiveAlunoId = useEffectiveAlunoId();
  const { turmaAtualId, turmaAtual } = useTurma();
  const [rows, setRows] = useState<NotaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rankingPublicoLiberado = Boolean(turmaAtual?.ranking_publico);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Vê a turma inteira (nomes + notas de todos) quando: é admin em visão
    // geral (sem simular ninguém), OU a turma está com ranking público
    // liberado — nesse segundo caso vale tanto pro aluno real quanto pro
    // admin simulando, pra pré-visualização bater com o que o aluno vê.
    const verTurmaInteira = (isAdmin && !effectiveAlunoId) || rankingPublicoLiberado;

    let query = supabase
      .from(tabela)
      .select(
        verTurmaInteira
          ? "id, aluno_id, materia, vc, vc_lista, vf, nota_final, verif_2a_epoca, media_2a_epoca, updated_at, profiles(nome_completo, matricula)"
          : "id, aluno_id, materia, vc, vc_lista, vf, nota_final, verif_2a_epoca, media_2a_epoca, updated_at"
      );

    if (!verTurmaInteira && effectiveAlunoId) {
      query = query.eq("aluno_id", effectiveAlunoId);
    } else if (verTurmaInteira && turmaAtualId) {
      // Busca primeiro os IDs dos alunos da turma (query simples e confiável),
      // depois filtra as notas por esses IDs — evita depender de filtro por
      // coluna de tabela relacionada, que tem comportamento inconsistente
      // dependendo da versão/configuração do PostgREST.
      const colunaMatricula = `matriculado_${tabela.replace("notas_", "")}`;
      const { data: alunosDaTurma, error: erroAlunos } = await supabase
        .from("profiles")
        .select("id")
        .eq("turma_id", turmaAtualId)
        .eq(colunaMatricula, true);

      if (erroAlunos) {
        setError(erroAlunos.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const ids = (alunosDaTurma ?? []).map((a) => a.id);
      if (ids.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }
      query = query.in("aluno_id", ids);
    }

    const { data, error } = await query.order("materia", { ascending: true });

    if (error) {
      setError(error.message);
      setRows([]);
    } else {
      const mapped = (data ?? []).map((r: any) => ({
        ...r,
        aluno_nome: r.profiles?.nome_completo,
        aluno_matricula: r.profiles?.matricula ?? null,
      }));
      setRows(mapped);
    }
    setLoading(false);
  }, [tabela, isAdmin, effectiveAlunoId, turmaAtualId, rankingPublicoLiberado]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /** Admin: cria ou atualiza a nota de um aluno em uma matéria (upsert) */
  async function salvarNota(params: {
    aluno_id: string;
    materia: string;
    vc_lista?: number[] | null;
    vf?: number | null;
    nota_final?: number | null;
    verif_2a_epoca?: number | null;
    media_2a_epoca?: number | null;
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
