import { supabase } from "@/lib/supabaseClient";
import { MATERIAS_CFO1 } from "@/config/materiasCfo1";
import { MATERIAS_CFO2 } from "@/config/materiasCfo2";
import { MATERIAS_CFO3 } from "@/config/materiasCfo3";
import { TipoAta, AlunoRankingAta } from "@/utils/exportAta";

const MATERIA_TCC_EXCLUIDA_CFO3 = "Seminário de Trabalho Científico-Workshop de Banca de Defesa do TCC";

interface NotaRow {
  aluno_id: string;
  materia: string;
  nota_final: number | null;
}

interface PerfilRow {
  id: string;
  nome_completo: string;
  matriculado_cfo1: boolean;
  matriculado_cfo2: boolean;
  matriculado_cfo3: boolean;
}

async function mediaPorAluno(
  tabela: "notas_cfo1" | "notas_cfo2" | "notas_cfo3",
  turmaId: string,
  materiasOficiais: string[],
  colunaMatriculado: "matriculado_cfo1" | "matriculado_cfo2" | "matriculado_cfo3"
): Promise<Map<string, { nome: string; media: number }>> {
  // Busca os perfis da turma primeiro (não em paralelo com as notas) pra
  // poder filtrar a query de notas por esses aluno_id — sem isso, a query
  // de notas trazia TODAS as linhas de TODAS as turmas do sistema (a RLS já
  // barrava um 'admin' comum de ver nota de outra turma, mas um
  // 'admin_institucional'/'desenvolvedor', que legitimamente tem acesso a
  // várias turmas, recebia notas de turmas que não interessam nesta Ata —
  // dado a mais trafegando sem necessidade).
  const { data: perfis } = await supabase
    .from("profiles")
    .select("id, nome_completo, matriculado_cfo1, matriculado_cfo2, matriculado_cfo3")
    .eq("turma_id", turmaId);

  const idsDaTurma = (perfis ?? []).map((p: any) => p.id);
  const { data: notas } = idsDaTurma.length > 0
    ? await supabase.from(tabela).select("aluno_id, materia, nota_final").in("aluno_id", idsDaTurma)
    : { data: [] as NotaRow[] };

  const perfisPorId = new Map<string, PerfilRow>((perfis ?? []).map((p: any) => [p.id, p]));
  // Map por matéria (não array) — protege contra dobrar a nota na média se
  // por acaso existir mais de um lançamento pra mesma matéria/aluno (ex:
  // correção de nota que gerou linha duplicada em vez de atualizar).
  const porAluno = new Map<string, Map<string, number>>();

  for (const n of (notas ?? []) as NotaRow[]) {
    if (n.nota_final == null) continue;
    if (!materiasOficiais.includes(n.materia)) continue;
    const perfil = perfisPorId.get(n.aluno_id);
    if (!perfil || !perfil[colunaMatriculado]) continue; // só da turma em foco e matriculado no módulo
    if (!porAluno.has(n.aluno_id)) porAluno.set(n.aluno_id, new Map());
    porAluno.get(n.aluno_id)!.set(n.materia, n.nota_final);
  }

  const resultado = new Map<string, { nome: string; media: number }>();
  for (const [alunoId, notasPorMateria] of porAluno) {
    // Só entra na classificação oficial quem tem nota lançada em TODAS as
    // disciplinas oficiais do módulo — um aluno com notas parciais (ex:
    // professor ainda não lançou todas as matérias) não deve aparecer com
    // uma média inflada/distorcida num documento com peso legal.
    if (notasPorMateria.size !== materiasOficiais.length) continue;
    const perfil = perfisPorId.get(alunoId)!;
    const valores = Array.from(notasPorMateria.values());
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    resultado.set(alunoId, { nome: perfil.nome_completo, media });
  }
  return resultado;
}

/**
 * Busca a lista de alunos aprovados + média, no formato pronto pro bloco de
 * classificação da Ata (já ordenado por média decrescente), aplicando a
 * regra de negócio confirmada com o usuário: quem se desligou ANTES da data
 * de encerramento (data_reuniao da comissão) fica de fora da classificação,
 * mesmo que tenha nota lançada em todas as matérias (ex: caso do Fellipe,
 * ver seção 4 do histórico do projeto).
 */
export async function buscarRankingParaAta(
  tipo: TipoAta,
  turmaId: string,
  dataEncerramento: string
): Promise<AlunoRankingAta[]> {
  const { data: desligamentos } = await supabase
    .from("desligamentos")
    .select("aluno_id, data_desligamento")
    .eq("turma_id", turmaId);

  const idsExcluidos = new Set(
    (desligamentos ?? [])
      .filter((d) => d.aluno_id && d.data_desligamento <= dataEncerramento)
      .map((d) => d.aluno_id as string)
  );

  let mapa: Map<string, { nome: string; media: number }>;

  if (tipo === "ata_1_ano") {
    mapa = await mediaPorAluno("notas_cfo1", turmaId, MATERIAS_CFO1, "matriculado_cfo1");
  } else if (tipo === "ata_2_ano") {
    mapa = await mediaPorAluno("notas_cfo2", turmaId, MATERIAS_CFO2, "matriculado_cfo2");
  } else if (tipo === "ata_3_ano") {
    const materiasCfo3 = MATERIAS_CFO3.filter((m) => m !== MATERIA_TCC_EXCLUIDA_CFO3);
    mapa = await mediaPorAluno("notas_cfo3", turmaId, materiasCfo3, "matriculado_cfo3");
  } else {
    // ata_classificacao_geral — Método A: média das 3 médias de módulo,
    // só entra quem tem os 3 módulos completos (mesma regra de ranking_turma()).
    const materiasCfo3 = MATERIAS_CFO3.filter((m) => m !== MATERIA_TCC_EXCLUIDA_CFO3);
    const [m1, m2, m3] = await Promise.all([
      mediaPorAluno("notas_cfo1", turmaId, MATERIAS_CFO1, "matriculado_cfo1"),
      mediaPorAluno("notas_cfo2", turmaId, MATERIAS_CFO2, "matriculado_cfo2"),
      mediaPorAluno("notas_cfo3", turmaId, materiasCfo3, "matriculado_cfo3"),
    ]);
    mapa = new Map();
    for (const [alunoId, dados1] of m1) {
      const dados2 = m2.get(alunoId);
      const dados3 = m3.get(alunoId);
      if (!dados2 || !dados3) continue;
      mapa.set(alunoId, {
        nome: dados1.nome,
        media: (dados1.media + dados2.media + dados3.media) / 3,
      });
    }
  }

  return Array.from(mapa.entries())
    .filter(([alunoId]) => !idsExcluidos.has(alunoId))
    .map(([alunoId, v]) => ({ alunoId, ...v }))
    .sort((a, b) => b.media - a.media);
}
