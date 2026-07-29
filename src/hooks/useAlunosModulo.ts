import { useMemo } from "react";
import { useNotasModulo, TabelaModulo } from "@/hooks/useNotasModulo";
import { Student } from "@/data/mockData";
import { DetailedStudent } from "@/hooks/useGoogleSheets";

// Todos os campos "fixos" do tipo Student legado não são mais usados para exibir
// dados (o StudentDetailsModal já lê de `grades`, um dicionário dinâmico), mas
// preenchemos com 0 para satisfazer o tipo TypeScript sem reescrever o tipo inteiro.
const CAMPOS_LEGADOS_ZERADOS: Omit<Student, "rank" | "nome" | "mediaFinal"> = {
  ordenUnidaVC: 0, ordenUnidaVF: 0, armamentoVC: 0, armamentoVF: 0,
  comunicacaoVC: 0, comunicacaoVF: 0, sistemaSeguranca: 0, historiaPM: 0,
  legislacaoPenal: 0, educacaoFisica: 0, educacaoFinanceira: 0, didatica: 0,
  administracaoPublica: 0, bombeiroMilitar: 0, direitoAmbiental: 0, defesaPessoal: 0,
  redacaoOficial: 0, libras: 0, metodologiaCientifica: 0, cerimonialProtocolo: 0,
  teoriaPolicia: 0, tecnicasPoliciamento: 0, popI: 0, defesaTerritorial: 0,
  hipologia: 0, geopolitica: 0, policiaComunitaria: 0, legislacaoPolicial: 0,
  direitosHumanos: 0, medicinaLegal: 0, direitoProcessual: 0, direitoPenalMilitar: 0,
  direitoAdministrativo: 0, aph: 0, tiroPolicial: 0,
};

export interface DetalheMateria {
  nota_final: number | null;
  vc_lista: number[];
  vf: number | null;
}

export interface AlunoModulo extends DetailedStudent {
  aluno_id: string;
  gradesDetalhado: Record<string, DetalheMateria>;
}

/**
 * Constrói a lista de alunos (formato DetailedStudent, compatível com os
 * componentes de dashboard existentes) a partir das notas normalizadas do
 * Supabase. `listaMaterias` é a lista oficial de disciplinas do módulo
 * (ver src/config/materiasCfoX.ts) — usada só para saber o total de matérias
 * do curso, não para restringir os nomes aceitos.
 */
export function useAlunosModulo(tabela: TabelaModulo, listaMaterias: string[]) {
  const { rows, loading, error, refetch, salvarNota, excluirNota } = useNotasModulo(tabela);

  const students = useMemo<AlunoModulo[]>(() => {
    const porAluno = new Map<
      string,
      { nome: string; grades: Record<string, number>; detalhado: Record<string, DetalheMateria> }
    >();

    for (const row of rows) {
      if (!porAluno.has(row.aluno_id)) {
        porAluno.set(row.aluno_id, { nome: row.aluno_nome ?? "—", grades: {}, detalhado: {} });
      }
      const entrada = porAluno.get(row.aluno_id)!;
      if (row.nota_final !== null) {
        entrada.grades[row.materia] = row.nota_final;
      }
      entrada.detalhado[row.materia] = {
        nota_final: row.nota_final,
        vc_lista: row.vc_lista ?? [],
        vf: row.vf,
      };
    }

    const provisorio = Array.from(porAluno.entries()).map(([alunoId, { nome, grades, detalhado }]) => {
      const valores = Object.values(grades);
      const mediaFinal = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;

      return {
        ...CAMPOS_LEGADOS_ZERADOS,
        aluno_id: alunoId,
        nome,
        mediaFinal,
        rank: 0,
        grades,
        gradesDetalhado: detalhado,
      } as AlunoModulo;
    });

    provisorio.sort((a, b) => b.mediaFinal - a.mediaFinal);
    provisorio.forEach((s, i) => (s.rank = i + 1));

    return provisorio;
  }, [rows]);

  const launchedSubjects = useMemo(() => {
    const set = new Set(rows.filter((r) => r.nota_final !== null).map((r) => r.materia));
    // só conta como "lançada" se a matéria for uma das oficiais do módulo
    return listaMaterias.filter((m) => set.has(m));
  }, [rows, listaMaterias]);

  return {
    students,
    loading,
    error,
    refetch,
    salvarNota,
    excluirNota,
    subjectsLaunched: launchedSubjects.length,
    launchedSubjects,
    allSubjects: listaMaterias,
  };
}
