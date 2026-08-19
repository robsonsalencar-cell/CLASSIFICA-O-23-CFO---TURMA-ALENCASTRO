import { useState, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/dashboard/KPICard";
import { HighlightCard } from "@/components/dashboard/HighlightCard";
import { RankingTable } from "@/components/dashboard/RankingTable";
import { GradeDistributionChart } from "@/components/dashboard/GradeDistributionChart";
import { LaunchedSubjectsList } from "@/components/dashboard/LaunchedSubjectsList";
import { NotLaunchedSubjectsList } from "@/components/dashboard/NotLaunchedSubjectsList";
import { StudentDetailsModal } from "@/components/dashboard/StudentDetailsModal";

import { calculateKPIs, calculateSubjectProgress } from "@/data/mockData";
import { DetailedStudent } from "@/hooks/useGoogleSheets";
import { useAlunosModulo } from "@/hooks/useAlunosModulo";
import { MATERIAS_CFO1 } from "@/config/materiasCfo1";
import { useAuth } from "@/contexts/AuthContext";
import { useConfiguracaoTurma, rotuloUltimosColocados } from "@/contexts/TurmaContext";
import { useTemaModulo } from "@/hooks/useTemaModulo";
import { ResumoIndividualModulo } from "@/components/dashboard/ResumoIndividualModulo";

import { Users, Target, TrendingUp, TrendingDown, Award, AlertTriangle, RefreshCw, BookOpen, Loader2 } from "lucide-react";

const Cfo1 = () => {
  const { isAdmin, viewingAsAlunoId } = useAuth();
  const { config } = useConfiguracaoTurma();
  useTemaModulo("tema-cfo1");
  const [selectedStudent, setSelectedStudent] = useState<DetailedStudent | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Visão completa (ranking, Top 3, Carroceiros) só para o admin em "Visão Geral".
  // Aluno comum, ou admin simulando um aluno específico ("Visualizar como"), vê
  // o ranking completo só se "Ranking p/ alunos" estiver liberado pelo admin —
  // caso contrário, vê só o próprio resumo. Isso vale tanto para o aluno real
  // quanto para o admin simulando, para que o toggle reflita corretamente na
  // pré-visualização.
  const emVisaoDeAluno = !isAdmin || Boolean(viewingAsAlunoId);
  const mostrarVisaoCompleta = !emVisaoDeAluno || config.ranking_publico;

  const { students, loading, error, refetch, subjectsLaunched, launchedSubjects, allSubjects } =
    useAlunosModulo("notas_cfo1", MATERIAS_CFO1);

  // IMPORTANTE: todos os Hooks (useMemo incluído) ficam ANTES de qualquer retorno
  // condicional, mesmo os que só serão usados na visão completa do admin — trocar
  // a ordem dos Hooks entre renders (ex: ao ligar/desligar "visualizar como") quebra
  // as Regras dos Hooks do React.
  const kpis = useMemo(() => calculateKPIs(students), [students]);
  const subjectProgress = useMemo(
    () => ({ gradedSubjects: subjectsLaunched, totalSubjects: allSubjects.length }),
    [subjectsLaunched, allSubjects.length]
  );

  const topThree = students.slice(0, 3);
  const bottomThree = students.slice(-3).sort((a, b) => b.mediaFinal - a.mediaFinal);

  const handleStudentClick = (student: DetailedStudent) => {
    setSelectedStudent(student);
    setIsModalOpen(true);
  };

  // Indicadores clicáveis: maior/menor média abrem o modal do aluno;
  // matérias/turma rolam até a seção correspondente.
  const progressoRef = useRef<HTMLDivElement>(null);
  const rankingRef = useRef<HTMLDivElement>(null);

  function handleClickAluno(nome: string) {
    const aluno = students.find((s) => s.nome === nome);
    if (aluno) handleStudentClick(aluno);
  }

  function scrollPara(ref: React.RefObject<HTMLDivElement>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const header = (
    <header className="bg-gradient-to-r from-card/95 via-card-header/95 to-card/95 border-b border-primary/20 shadow-lg">
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <img
                src={config.brasao_url ?? "/lovable-uploads/brasao-novo.png"}
                alt={config.nome_turma}
                className="w-48 h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 object-contain drop-shadow-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-success/10 blur-xl opacity-30 -z-10"></div>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-[hsl(210,90%,70%)] via-[hsl(200,85%,65%)] to-[hsl(195,80%,60%)] bg-clip-text text-transparent mb-3 drop-shadow-[0_0_15px_rgba(100,181,246,0.5)]">
            {config.titulo_pagina_modulo} I
          </h1>
          <p className="text-lg md:text-xl font-bold bg-gradient-to-r from-[hsl(210,80%,65%)] via-[hsl(200,75%,60%)] to-[hsl(195,70%,55%)] bg-clip-text text-transparent">
            {config.subtitulo_pagina}
          </p>

          <div className="mt-4 flex justify-center items-center gap-4 flex-wrap">
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            )}
            <button
              onClick={refetch}
              disabled={loading}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
          <div className="mt-3 text-right">
            <span className="text-xs text-muted-foreground">Criado por CAD PM ALENCAR - 2025</span>
          </div>
        </div>
      </div>
    </header>
  );

  if (!mostrarVisaoCompleta) {
    return (
      <div className="min-h-screen bg-background tema-cfo1">
        {header}
        <ResumoIndividualModulo tabela="notas_cfo1" tabelaNotas="notas_cfo1" tituloModulo="CFO I" totalMaterias={allSubjects.length} />
      </div>
    );
  }

  if (loading && students.length === 0) {
    return (
      <div className="min-h-screen bg-background tema-cfo1">
        {header}
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background tema-cfo1">
      {header}

      <main className="container mx-auto px-4 py-8 space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4 text-foreground">Indicadores Gerais</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPICard
              title="Matérias Avaliadas"
              value={`${subjectProgress.gradedSubjects}/${subjectProgress.totalSubjects}`}
              subtitle="Progresso do curso"
              variant="success"
              icon={<BookOpen className="w-4 h-4" />}
              tooltip={`${subjectProgress.gradedSubjects} matérias já tiveram notas lançadas de um total de ${subjectProgress.totalSubjects} matérias`}
              onClick={() => scrollPara(progressoRef)}
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
              tooltip={`${kpis.maiorMedia.aluno} obteve a maior média: ${kpis.maiorMedia.nota.toFixed(4)}. Clique para ver os detalhes.`}
              onClick={() => handleClickAluno(kpis.maiorMedia.aluno)}
            />
            <KPICard
              title="Menor Média"
              value={kpis.menorMedia.nota.toFixed(4)}
              subtitle={kpis.menorMedia.aluno}
              variant="warning"
              icon={<TrendingDown className="w-4 h-4" />}
              tooltip={`${kpis.menorMedia.aluno} obteve a menor média: ${kpis.menorMedia.nota.toFixed(4)}. Clique para ver os detalhes.`}
              onClick={() => handleClickAluno(kpis.menorMedia.aluno)}
            />
          </div>
        </section>

        <section>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h2 className="text-xl font-semibold mb-4 text-foreground flex items-center gap-2">
                <Award className="w-5 h-5 text-[hsl(210,90%,65%)] animate-bounce" />
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
                    onClick={() => handleStudentClick(student)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section ref={rankingRef}>
          <RankingTable
            students={students}
            onStudentClick={handleStudentClick as any}
            kpis={kpis as any}
            subjectProgress={subjectProgress as any}
            modo="modulo"
            podeExportar={isAdmin}
          />
        </section>

        <section ref={progressoRef}>
          <h2 className="text-xl font-semibold mb-6 text-foreground">Progresso das Matérias</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LaunchedSubjectsList subjects={launchedSubjects} totalSubjects={allSubjects.length} />
            <NotLaunchedSubjectsList launchedSubjects={launchedSubjects} allSubjects={allSubjects} totalSubjects={allSubjects.length} />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-6 text-foreground">Análises Visuais</h2>
          <GradeDistributionChart students={students} average={kpis.mediaTurma} />
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

        <div className="text-center py-6">
          <span className="text-sm text-muted-foreground">Criado por CAD PM ALENCAR - 2025</span>
        </div>
      </main>

      <StudentDetailsModal
        student={selectedStudent}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStudent(null);
        }}
        totalStudents={students.length}
        tituloModulo="CFO I"
        isAdmin={isAdmin}
      />
    </div>
  );
};

export default Cfo1;
