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
  const [{ data: perfis }, { data: notas }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nome_completo, matriculado_cfo1, matriculado_cfo2, matriculado_cfo3")
      .eq("turma_id", turmaId),
    supabase.from(tabela).select("aluno_id, materia, nota_final"),
  ]);

  const perfisPorId = new Map<string, PerfilRow>((perfis ?? []).map((p: any) => [p.id, p]));
  const porAluno = new Map<string, number[]>();

  for (const n of (notas ?? []) as NotaRow[]) {
    if (n.nota_final == null) continue;
    if (!materiasOficiais.includes(n.materia)) continue;
    const perfil = perfisPorId.get(n.aluno_id);
    if (!perfil || !perfil[colunaMatriculado]) continue; // só da turma em foco e matriculado no módulo
    if (!porAluno.has(n.aluno_id)) porAluno.set(n.aluno_id, []);
    porAluno.get(n.aluno_id)!.push(n.nota_final);
  }

  const resultado = new Map<string, { nome: string; media: number }>();
  for (const [alunoId, notasArr] of porAluno) {
    const perfil = perfisPorId.get(alunoId)!;
    const media = notasArr.reduce((a, b) => a + b, 0) / notasArr.length;
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
    .map(([, v]) => v)
    .sort((a, b) => b.media - a.media);
}
