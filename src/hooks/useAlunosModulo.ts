import { useMemo } from "react";
import { useNotasModulo, TabelaModulo } from "@/hooks/useNotasModulo";
import { Student } from "@/data/mockData";
import { DetailedStudent } from "@/hooks/useGoogleSheets"; // tipo já existente no projeto original

/**
 * Constrói a lista de alunos no MESMO formato (DetailedStudent) que os componentes
 * de dashboard já esperam, a partir das linhas normalizadas (aluno_id, materia, nota_final)
 * lidas do Supabase. Assim, KPICard, RankingTable, HighlightCard, etc. não precisam mudar.
 *
 * @param tabela nome da tabela do módulo (notas_cfo1, notas_cfo2 ou notas_cfo3)
 * @param materiaParaCampo mapa "nome da matéria" -> campo do tipo Student (ver src/config/materiasCfoX.ts)
 */
export function useAlunosModulo(
  tabela: TabelaModulo,
  materiaParaCampo: Record<string, keyof Student>
) {
  const { rows, loading, error, refetch, salvarNota, excluirNota } = useNotasModulo(tabela);

  const students = useMemo<DetailedStudent[]>(() => {
    // agrupa as linhas por aluno
    const porAluno = new Map<string, { nome: string; grades: Record<string, number> }>();

    for (const row of rows) {
      if (!porAluno.has(row.aluno_id)) {
        porAluno.set(row.aluno_id, { nome: row.aluno_nome ?? "—", grades: {} });
      }
      porAluno.get(row.aluno_id)!.grades[row.materia] = row.nota_final ?? 0;
    }

    const provisorio = Array.from(porAluno.entries()).map(([alunoId, { nome, grades }]) => {
      const student: Partial<Student> = { nome };

      for (const [materia, campo] of Object.entries(materiaParaCampo)) {
        (student as any)[campo] = grades[materia] ?? 0;
      }

      // Se a "MÉDIA FINAL" não foi lançada manualmente, calcula a média simples
      // das matérias já lançadas (ajuste aqui se a fórmula oficial for diferente,
      // ex: pesos diferentes por matéria).
      const valores = Object.values(grades);
      const mediaCalculada =
        valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;

      student.mediaFinal = (student as any).mediaFinal || mediaCalculada;

      return { ...student, rank: 0, grades } as DetailedStudent;
    });

    // ordena por média e atribui o rank
    provisorio.sort((a, b) => b.mediaFinal - a.mediaFinal);
    provisorio.forEach((s, i) => (s.rank = i + 1));

    return provisorio;
  }, [rows, materiaParaCampo]);

  const launchedSubjects = useMemo(() => {
    const set = new Set(rows.map((r) => r.materia));
    return Array.from(set);
  }, [rows]);

  return {
    students,
    loading,
    error,
    refetch,
    salvarNota,
    excluirNota,
    subjectsLaunched: launchedSubjects.length,
    launchedSubjects,
    allSubjects: Object.keys(materiaParaCampo),
  };
}
