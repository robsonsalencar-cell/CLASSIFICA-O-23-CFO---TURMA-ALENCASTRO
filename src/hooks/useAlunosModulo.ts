import { useEffect, useMemo, useState } from "react";
import { useNotasModulo, TabelaModulo } from "@/hooks/useNotasModulo";
import { Student } from "@/data/mockData";
import { DetailedStudent } from "@/hooks/useGoogleSheets";
import { supabase } from "@/lib/supabaseClient";
import { useTurma } from "@/contexts/TurmaContext";

/**
 * Matérias "fechadas" numa turma/módulo: só entram aqui as que já têm
 * nota lançada para TODOS os matriculados daquele módulo na turma — ver
 * migration_42. Importante pra turma dividida em pelotões (ex: 24º CFO):
 * uma matéria só deve contar na média/ranking depois que o diário dos
 * dois pelotões já foi importado, senão quem está no pelotão cujo diário
 * chegou primeiro sai com vantagem/desvantagem artificial na média.
 */
function useMateriasCompletas(tabela: TabelaModulo) {
  const { turmaAtualId } = useTurma();
  const [materias, setMaterias] = useState<string[] | null>(null);

  useEffect(() => {
    if (!turmaAtualId) {
      setMaterias([]);
      return;
    }
    let cancelado = false;
    supabase
      .rpc("materias_completas_turma", { p_turma_id: turmaAtualId, p_tabela: tabela })
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          // Se a função ainda não existir no banco (migration_42 não aplicada),
          // não trava a tela — volta ao comportamento antigo (conta qualquer
          // matéria lançada) até a migração ser rodada.
          setMaterias(null);
          return;
        }
        setMaterias((data ?? []).map((r: { materia: string }) => r.materia));
      });
    return () => {
      cancelado = true;
    };
  }, [tabela, turmaAtualId]);

  return materias;
}

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
  verif_2a_epoca: number | null;
  media_2a_epoca: number | null;
}

export interface AlunoModulo extends DetailedStudent {
  aluno_id: string;
  matricula: string | null;
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
  // null = ainda não carregou/função não existe no banco ainda (migration_42
  // não aplicada) → não restringe nada, mantém o comportamento antigo.
  const materiasCompletas = useMateriasCompletas(tabela);

  const students = useMemo<AlunoModulo[]>(() => {
    const porAluno = new Map<
      string,
      {
        nome: string;
        matricula: string | null;
        grades: Record<string, number>;
        detalhado: Record<string, DetalheMateria>;
      }
    >();

    for (const row of rows) {
      // Só entra na média do módulo quem está na lista oficial de matérias
      // (listaMaterias) — protege contra qualquer nome de matéria fora do
      // currículo vigente (ex: uma matéria retirada temporariamente da
      // contabilidade, ou um erro de digitação) inflar ou distorcer a média
      // do aluno. A nota continua salva no banco, só não entra no cálculo.
      if (!listaMaterias.includes(row.materia)) continue;

      if (!porAluno.has(row.aluno_id)) {
        porAluno.set(row.aluno_id, {
          nome: row.aluno_nome ?? "—",
          matricula: row.aluno_matricula ?? null,
          grades: {},
          detalhado: {},
        });
      }
      const entrada = porAluno.get(row.aluno_id)!;
      // A matéria só entra na MÉDIA quando já está "fechada" (nota lançada
      // pros dois pelotões — ver migration_42); antes disso a nota continua
      // aparecendo normalmente em `detalhado` (ex: "Minhas notas por
      // matéria"), só não conta no cálculo pra não distorcer quem está no
      // pelotão cujo diário chegou primeiro.
      const materiaFechada = materiasCompletas === null || materiasCompletas.includes(row.materia);
      if (row.nota_final !== null && materiaFechada) {
        entrada.grades[row.materia] = row.nota_final;
      }
      entrada.detalhado[row.materia] = {
        nota_final: row.nota_final,
        vc_lista: row.vc_lista ?? [],
        vf: row.vf,
        verif_2a_epoca: row.verif_2a_epoca,
        media_2a_epoca: row.media_2a_epoca,
      };
    }

    const provisorio = Array.from(porAluno.entries())
      // Só entra no ranking quem já tem pelo menos 1 matéria fechada
      // contando na média — mesmo critério da função SQL correspondente
      // (um aluno sem nenhuma matéria fechada ainda não compõe o ranking,
      // mas continua aparecendo normalmente em telas de edição/consulta
      // direta das notas, que não usam este hook).
      .filter(([, { grades }]) => Object.keys(grades).length > 0)
      .map(([alunoId, { nome, matricula, grades, detalhado }]) => {
        const valores = Object.values(grades);
        const mediaFinal = valores.reduce((a, b) => a + b, 0) / valores.length;

        return {
          ...CAMPOS_LEGADOS_ZERADOS,
          aluno_id: alunoId,
          matricula,
          nome,
          mediaFinal,
          rank: 0,
          grades,
          gradesDetalhado: detalhado,
        } as AlunoModulo;
      });

    provisorio.sort((a, b) => b.mediaFinal - a.mediaFinal);
    // Mesma regra de empate do RANK() do banco: quem empata na média fica
    // na mesma posição, e a próxima posição pula o(s) número(s) "gasto(s)"
    // pelo empate (ex: dois em 1º → o de baixo vai pro 3º, não pro 2º).
    provisorio.forEach((s, i) => {
      s.rank = i > 0 && provisorio[i - 1].mediaFinal === s.mediaFinal ? provisorio[i - 1].rank : i + 1;
    });

    return provisorio;
  }, [rows, materiasCompletas]);

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
