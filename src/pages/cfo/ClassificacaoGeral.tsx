import { useState, useMemo, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/KPICard";
import { HighlightCard } from "@/components/dashboard/HighlightCard";
import { RankingTable } from "@/components/dashboard/RankingTable";
import { StudentDetailsModal } from "@/components/dashboard/StudentDetailsModal";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { calculateKPIs } from "@/data/mockData";
import { DetailedStudent } from "@/hooks/useGoogleSheets";
import { useAlunosModulo } from "@/hooks/useAlunosModulo";
import { MATERIAS_CFO1 } from "@/config/materiasCfo1";
import { MATERIAS_CFO2 } from "@/config/materiasCfo2";
import { MATERIAS_CFO3 } from "@/config/materiasCfo3";
import { useAuth } from "@/contexts/AuthContext";
import { useConfiguracaoTurma, useTurma, rotuloUltimosColocados } from "@/contexts/TurmaContext";
import { supabase } from "@/lib/supabaseClient";
import { useTemaModulo } from "@/hooks/useTemaModulo";
import { ResumoIndividualModulo } from "@/components/dashboard/ResumoIndividualModulo";

import { Users, Target, TrendingUp, TrendingDown, Award, AlertTriangle, BookOpen, Loader2 } from "lucide-react";

function mediaSimples(valores: number[]): number {
  return valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;
}

const ClassificacaoGeral = () => {
  const { isAdmin, viewingAsAlunoId } = useAuth();
  const { config } = useConfiguracaoTurma();
  useTemaModulo("tema-geral");
  // Visão completa (ranking, Top 3) só para o admin em "Visão Geral". Aluno
  // comum, ou admin simulando um aluno específico ("Visualizar como"), vê o
  // ranking completo só se "Ranking p/ alunos" estiver liberado pelo admin —
  // isso vale tanto para o aluno real quanto para o admin simulando, para que
  // o toggle reflita corretamente na pré-visualização.
  const emVisaoDeAluno = !isAdmin || Boolean(viewingAsAlunoId);
  const mostrarVisaoCompleta = !emVisaoDeAluno || config.ranking_publico;
  const [selectedStudent, setSelectedStudent] = useState<DetailedStudent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { turmas } = useTurma();
  const [turmaResumoId, setTurmaResumoId] = useState<string | null>(null);
  const [resumoOutraTurma, setResumoOutraTurma] = useState<{
    nomeTurma: string;
    indicadores: { totalAlunos: number; mediaTurma: number; desvioPadrao: number; maiorMedia: number; menorMedia: number };
    mediaCfo1: number | null;
    mediaCfo2: number | null;
    mediaCfo3: number | null;
    ranking: { nome: string; media_final: number }[];
  } | null>(null);
  const [carregandoResumo, setCarregandoResumo] = useState(false);

  useEffect(() => {
    if (!turmaResumoId) {
      setResumoOutraTurma(null);
      return;
    }
    let cancelado = false;
    setCarregandoResumo(true);
    Promise.all([
      supabase.rpc("estatisticas_classificacao_geral", { p_turma_id: turmaResumoId }),
      supabase.rpc("estatisticas_modulo", { p_tabela: "notas_cfo1", p_turma_id: turmaResumoId }),
      supabase.rpc("estatisticas_modulo", { p_tabela: "notas_cfo2", p_turma_id: turmaResumoId }),
      supabase.rpc("estatisticas_modulo", { p_tabela: "notas_cfo3", p_turma_id: turmaResumoId }),
      supabase.rpc("ranking_turma", { p_turma_id: turmaResumoId }),
    ]).then(([geral, m1, m2, m3, ranking]) => {
      if (cancelado) return;
      const g = geral.data?.[0];
      const nomeTurma = turmas.find((t) => t.id === turmaResumoId)?.nome_turma ?? "";
      setResumoOutraTurma({
        nomeTurma,
        indicadores: {
          totalAlunos: g?.total_alunos ?? 0,
          mediaTurma: g?.media_turma ?? 0,
          desvioPadrao: g?.desvio_padrao ?? 0,
          maiorMedia: g?.maior_media ?? 0,
          menorMedia: g?.menor_media ?? 0,
        },
        mediaCfo1: m1.data?.[0]?.media_turma ?? null,
        mediaCfo2: m2.data?.[0]?.media_turma ?? null,
        mediaCfo3: m3.data?.[0]?.media_turma ?? null,
        ranking: (ranking.data ?? []).sort((a: any, b: any) => b.media_final - a.media_final),
      });
      setCarregandoResumo(false);
    });
    return () => {
      cancelado = true;
    };
  }, [turmaResumoId, turmas]);

  const cfo1 = useAlunosModulo("notas_cfo1", MATERIAS_CFO1);
  const cfo2 = useAlunosModulo("notas_cfo2", MATERIAS_CFO2);
  const cfo3 = useAlunosModulo("notas_cfo3", MATERIAS_CFO3);

  const loading = cfo1.loading || cfo2.loading || cfo3.loading;

  // Combina os 3 módulos por aluno_id (chave estável — não depende de grafia do nome).
  const students = useMemo<DetailedStudent[]>(() => {
    const porAlunoId = new Map<
      string,
      {
        nome: string;
        matricula: string | null;
        cfoI?: number;
        cfoII?: number;
        cfoIII?: number;
        gradesDetalhado: Record<string, { nota_final: number | null; vc_lista: number[]; vf: number | null }>;
      }
    >();

    function acumular(lista: typeof cfo1.students, campo: "cfoI" | "cfoII" | "cfoIII", prefixo: string) {
      for (const s of lista) {
        const atual = porAlunoId.get(s.aluno_id) ?? { nome: s.nome, matricula: s.matricula, gradesDetalhado: {} };
        atual[campo] = s.mediaFinal;
        for (const [materia, d] of Object.entries(s.gradesDetalhado)) {
          atual.gradesDetalhado[`${materia} (${prefixo})`] = d;
        }
        porAlunoId.set(s.aluno_id, atual);
      }
    }
    acumular(cfo1.students, "cfoI", "CFO I");
    acumular(cfo2.students, "cfoII", "CFO II");
    acumular(cfo3.students, "cfoIII", "CFO III");

    const lista = Array.from(porAlunoId.entries())
      // Só entra na Classificação Geral quem tem nota nos 3 módulos — um
      // aluno que saiu do curso no meio (ex: só fez CFO I) continua aparecendo
      // normalmente no ranking daquele módulo, mas não na classificação final.
      .filter(([, s]) => typeof s.cfoI === "number" && typeof s.cfoII === "number" && typeof s.cfoIII === "number")
      .map(([alunoId, s]) => {
        const medias = [s.cfoI, s.cfoII, s.cfoIII].filter((v): v is number => typeof v === "number");
        const mediaFinal = mediaSimples(medias);
        return {
          aluno_id: alunoId,
          matricula: s.matricula,
          nome: s.nome,
          mediaFinal,
          rank: 0,
          cfoAverages: { cfoI: s.cfoI, cfoII: s.cfoII, cfoIII: s.cfoIII },
          gradesDetalhado: s.gradesDetalhado,
        } as unknown as DetailedStudent;
      });

    lista.sort((a, b) => b.mediaFinal - a.mediaFinal);
    lista.forEach((s, i) => (s.rank = i + 1));
    return lista;
  }, [cfo1.students, cfo2.students, cfo3.students]);

  const kpis = useMemo(() => calculateKPIs(students), [students]);
  const totalMateriasLancadas = cfo1.subjectsLaunched + cfo2.subjectsLaunched + cfo3.subjectsLaunched;
  const totalMaterias = cfo1.allSubjects.length + cfo2.allSubjects.length + cfo3.allSubjects.length;

  // Médias da turma por módulo (usadas nos 3 painéis extras)
  const mediaTurmaCfo1 = useMemo(() => mediaSimples(cfo1.students.map((s) => s.mediaFinal).filter((m) => m > 0)), [cfo1.students]);
  const mediaTurmaCfo2 = useMemo(() => mediaSimples(cfo2.students.map((s) => s.mediaFinal).filter((m) => m > 0)), [cfo2.students]);
  const mediaTurmaCfo3 = useMemo(() => mediaSimples(cfo3.students.map((s) => s.mediaFinal).filter((m) => m > 0)), [cfo3.students]);

  const topThree = students.slice(0, 3);
  const bottomThree = students.slice(-3).sort((a, b) => b.mediaFinal - a.mediaFinal);

  const handleStudentClick = (student: DetailedStudent) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  const rankingRef = useRef<HTMLDivElement>(null);
  const mediaModuloRef = useRef<HTMLDivElement>(null);

  function handleClickAluno(nome: string) {
    const aluno = students.find((s) => s.nome === nome);
    if (aluno) handleStudentClick(aluno);
  }

  function scrollPara(ref: React.RefObject<HTMLDivElement>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const header = (
    <header className="relative bg-gradient-to-r from-[hsl(220,50%,10%)] via-[hsl(220,45%,14%)] to-[hsl(220,50%,10%)] border-b-2 border-primary/50 shadow-[0_4px_40px_rgba(240,180,50,0.15)] overflow-hidden">
      {/* brilho ambiente sutil no fundo, reforçando o clima de conquista */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(240,180,50,0.10),_transparent_60%)] pointer-events-none" />

      <div className="relative container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <img
                src={config.brasao_url ?? "/lovable-uploads/brasao-novo.png"}
                alt={config.nome_turma}
                className="w-48 h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 object-contain drop-shadow-[0_0_35px_rgba(255,200,60,0.45)]"
              />
              <div className="absolute inset-0 bg-[radial-gradient(circle,_rgba(255,210,80,0.35),_transparent_70%)] blur-2xl -z-10 scale-150" />
            </div>
          </div>

          <div className="relative inline-block mb-4">
            {/* Estrela dourada customizada substituindo o ícone padrão. A imagem tem
                fundo preto (não é PNG transparente) — mix-blend-screen faz o preto
                "sumir" visualmente sobre o fundo escuro do cabeçalho, sem precisar
                editar a imagem. */}
            <img
              src="/estrela-dourada.png"
              alt=""
              aria-hidden="true"
              className="absolute -left-12 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 mix-blend-screen pointer-events-none select-none"
            />
            <img
              src="/estrela-dourada.png"
              alt=""
              aria-hidden="true"
              className="absolute -right-12 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 mix-blend-screen pointer-events-none select-none"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-primary/30 to-primary/10 blur-xl -z-10" />
            <p className="texto-trofeu-dourado text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-wider px-8 py-3 uppercase">
              {config.titulo_pagina_geral}
            </p>
          </div>

          <p className="text-lg md:text-xl font-semibold text-primary/90 tracking-wide">
            {config.subtitulo_pagina}
          </p>
          <p className="text-xs md:text-sm text-muted-foreground mt-2 italic">
            "O fim de uma grande jornada — a estrela dourada do aspirantado."
          </p>
          <div className="w-full text-right mt-3">
            <span className="text-xs text-muted-foreground">Criado por CAD PM ALENCAR - 2025</span>
          </div>
        </div>
      </div>
    </header>
  );

  const seletorTurma = (
    <div className="container mx-auto px-4 pt-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Label className="text-sm text-muted-foreground">Ver resumo de outra turma:</Label>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={turmaResumoId ?? ""}
          onChange={(e) => setTurmaResumoId(e.target.value || null)}
        >
          <option value="">Minha turma (visão completa)</option>
          {turmas
            .filter((t) => t.id !== config.id)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome_turma}
              </option>
            ))}
        </select>
      </div>
    </div>
  );

  if (turmaResumoId) {
    return (
      <div className="min-h-screen bg-background tema-geral">
        {header}
        {seletorTurma}
        <div className="container mx-auto px-4 py-8 space-y-8">
          {carregandoResumo || !resumoOutraTurma ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <section>
                <h2 className="text-xl font-semibold mb-4 text-foreground">
                  Indicadores Gerais — {resumoOutraTurma.nomeTurma}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard title="Total de Alunos" value={resumoOutraTurma.indicadores.totalAlunos} variant="default" icon={<Users className="w-4 h-4" />} />
                  <KPICard title="Média da Turma" value={resumoOutraTurma.indicadores.mediaTurma.toFixed(4)} subtitle={`Desvio-padrão: ${resumoOutraTurma.indicadores.desvioPadrao.toFixed(4)}`} variant="default" icon={<Target className="w-4 h-4" />} />
                  <KPICard title="Maior Média" value={resumoOutraTurma.indicadores.maiorMedia.toFixed(4)} variant="success" icon={<TrendingUp className="w-4 h-4" />} />
                  <KPICard title="Menor Média" value={resumoOutraTurma.indicadores.menorMedia.toFixed(4)} variant="warning" icon={<TrendingDown className="w-4 h-4" />} />
                </div>
              </section>
              <section>
                <h2 className="text-xl font-semibold mb-4 text-foreground">Média da Turma por Módulo</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <KPICard title="Média CFO I" value={resumoOutraTurma.mediaCfo1?.toFixed(4) ?? "—"} variant="default" icon={<Target className="w-4 h-4" />} />
                  <KPICard title="Média CFO II" value={resumoOutraTurma.mediaCfo2?.toFixed(4) ?? "—"} variant="default" icon={<Target className="w-4 h-4" />} />
                  <KPICard title="Média CFO III" value={resumoOutraTurma.mediaCfo3?.toFixed(4) ?? "—"} variant="default" icon={<Target className="w-4 h-4" />} />
                </div>
              </section>
              <section>
                <h2 className="text-xl font-semibold mb-4 text-foreground">Ranking Completo</h2>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">#</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead className="text-right">Média Final</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resumoOutraTurma.ranking.map((r, i) => (
                          <TableRow key={r.nome}>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell>{r.nome}</TableCell>
                            <TableCell className="text-right">{r.media_final.toFixed(4)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </section>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!mostrarVisaoCompleta) {
    return (
      <div className="min-h-screen bg-background tema-geral">
        {header}
        {seletorTurma}
        <ResumoIndividualModulo tabela="geral" tituloModulo="Classificação Geral" totalMaterias={totalMaterias} />
      </div>
    );
  }

  if (loading && students.length === 0) {
    return (
      <div className="min-h-screen bg-background tema-geral">
        {header}
        {seletorTurma}
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background tema-geral">
      {header}
      {seletorTurma}

      <main className="container mx-auto px-4 py-8 space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4 text-foreground">Indicadores Gerais</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard
              title="Matérias Avaliadas"
              value={`${totalMateriasLancadas}/${totalMaterias}`}
              subtitle="Progresso do curso (3 módulos)"
              variant="success"
              icon={<BookOpen className="w-4 h-4" />}
              onClick={() => scrollPara(mediaModuloRef)}
            />
            <KPICard
              title="Média da Turma"
              value={kpis.mediaTurma.toFixed(4)}
              subtitle={`Desvio-padrão: ${kpis.desvioPadrao.toFixed(4)}`}
              variant="default"
              icon={<Target className="w-4 h-4" />}
              onClick={() => scrollPara(rankingRef)}
            />
            <KPICard
              title="Total de Alunos"
              value={kpis.totalAlunos}
              subtitle="Registros válidos"
              variant="default"
              icon={<Users className="w-4 h-4" />}
              onClick={() => scrollPara(rankingRef)}
            />
            <KPICard
              title="🏆 Maior Média"
              value={kpis.maiorMedia.nota.toFixed(4)}
              subtitle={kpis.maiorMedia.aluno}
              variant="success"
              icon={<TrendingUp className="w-4 h-4" />}
              onClick={() => handleClickAluno(kpis.maiorMedia.aluno)}
            />
            <KPICard
              title="Menor Média"
              value={kpis.menorMedia.nota.toFixed(4)}
              subtitle={kpis.menorMedia.aluno}
              variant="warning"
              icon={<TrendingDown className="w-4 h-4" />}
              onClick={() => handleClickAluno(kpis.menorMedia.aluno)}
            />
          </div>
        </section>

        {/* 3 painéis extras: média da turma em cada módulo isoladamente */}
        <section ref={mediaModuloRef}>
          <h2 className="text-xl font-semibold mb-4 text-foreground">Média da Turma por Módulo</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard
              title="Média CFO I"
              value={mediaTurmaCfo1.toFixed(4)}
              subtitle={`${cfo1.students.length} alunos com nota lançada`}
              variant="default"
              icon={<Target className="w-4 h-4 text-[hsl(210,90%,65%)]" />}
            />
            <KPICard
              title="Média CFO II"
              value={mediaTurmaCfo2.toFixed(4)}
              subtitle={`${cfo2.students.length} alunos com nota lançada`}
              variant="default"
              icon={<Target className="w-4 h-4 text-[hsl(140,70%,50%)]" />}
            />
            <KPICard
              title="Média CFO III"
              value={mediaTurmaCfo3.toFixed(4)}
              subtitle={`${cfo3.students.length} alunos com nota lançada`}
              variant="default"
              icon={<Target className="w-4 h-4 text-[hsl(43,96%,56%)]" />}
            />
          </div>
        </section>

        <section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
                <Award className="w-5 h-5 text-primary animate-bounce" />
                Top 3 - Melhores Desempenhos
              </h2>
              <div className="space-y-3">
                {topThree.map((student) => (
                  <HighlightCard
                    key={student.rank}
                    rank={student.rank}
                    nome={student.nome}
                    mediaFinal={student.mediaFinal}
                    variant="top"
                    cfoAverages={(student as any).cfoAverages}
                    onClick={() => handleStudentClick(student)}
                  />
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-danger animate-pulse" />
                {rotuloUltimosColocados(config.nome_turma)}
              </h2>
              <div className="space-y-3">
                {bottomThree.map((student) => (
                  <HighlightCard
                    key={student.rank}
                    rank={student.rank}
                    nome={student.nome}
                    mediaFinal={student.mediaFinal}
                    variant="bottom"
                    cfoAverages={(student as any).cfoAverages}
                    onClick={() => handleStudentClick(student)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section ref={rankingRef}>
          <RankingTable students={students} onStudentClick={handleStudentClick as any} kpis={kpis as any} podeExportar={isAdmin} />
        </section>

        <section>
          <Card className="border-success/20 bg-success-light/20">
            <CardHeader>
              <CardTitle className="text-lg text-success flex items-center gap-2">
                <Award className="w-5 h-5" />
                Validação dos Dados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-foreground">Total de Alunos</p>
                  <p className="text-muted-foreground">✓ Confirmado: {kpis.totalAlunos} alunos</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Média da Turma</p>
                  <p className="text-muted-foreground">✓ Calculada: {kpis.mediaTurma.toFixed(4)}</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Rankings</p>
                  <p className="text-muted-foreground">✓ Ordenação validada</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <StudentDetailsModal
        student={selectedStudent}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStudent(null);
        }}
        totalStudents={students.length}
        tituloModulo="Classificação Geral"
        isAdmin={isAdmin}
      />

      <div className="bg-[hsl(220,50%,10%)] border-t border-primary/20 text-center py-2">
        <p className="text-xs text-muted-foreground">Criado por CAD PM ALENCAR - 2025</p>
      </div>
    </div>
  );
};

export default ClassificacaoGeral;
