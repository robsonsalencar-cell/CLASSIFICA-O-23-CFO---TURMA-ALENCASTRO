import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DetailedStudent } from "@/hooks/useGoogleSheets";
import { AlunoModulo } from "@/hooks/useAlunosModulo";
import { supabase } from "@/lib/supabaseClient";
import { useConfiguracaoTurma, useTurma } from "@/contexts/TurmaContext";
import { exportarAlunoCSV, exportarAlunoPDF, exportarAlunoXLSX } from "@/utils/exportAluno";
import { exportarBoletimPDF, exportarBoletimWord, exportarBoletimExcel } from "@/utils/exportBoletim";
import {
  exportarHistoricoWord,
  exportarHistoricoExcel,
  montarDisciplinasHistorico,
  DadosExportacaoHistorico,
} from "@/utils/exportHistorico";
import { useDadosBiograficosAluno } from "@/hooks/useDadosBiograficosAluno";
import { MATERIAS_CFO1 } from "@/config/materiasCfo1";
import { MATERIAS_CFO2 } from "@/config/materiasCfo2";
import { MATERIAS_CFO3 } from "@/config/materiasCfo3";
import { CARGA_HORARIA_CFO1, CARGA_HORARIA_CFO2, CARGA_HORARIA_CFO3 } from "@/config/cargaHorariaCfo";
import { dataPorExtenso } from "@/utils/numeroExtenso";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, Award, AlertCircle, Download, FileText, FileSpreadsheet, FileDown, Loader2 } from "lucide-react";

interface StudentDetailsModalProps {
  student: DetailedStudent | null;
  isOpen: boolean;
  onClose: () => void;
  totalStudents?: number;
  tituloModulo?: string;
  isAdmin?: boolean;
}

function classificacao(media: number): { label: string; variant: "default" | "secondary" | "destructive" } {
  if (media >= 9.5) return { label: "Excelente", variant: "default" };
  if (media >= 9.0) return { label: "Bom", variant: "secondary" };
  return { label: "Regular", variant: "destructive" };
}

export function StudentDetailsModal({
  student,
  isOpen,
  onClose,
  totalStudents = 0,
  tituloModulo = "",
  isAdmin = false,
}: StudentDetailsModalProps) {
  const { config } = useConfiguracaoTurma();
  const { atribuirNumeroRegistroHistorico } = useTurma();
  const [boletimDialogAberto, setBoletimDialogAberto] = useState(false);
  const [boletimFormato, setBoletimFormato] = useState<"pdf" | "word" | "xlsx" | null>(null);
  const [boletimInicio, setBoletimInicio] = useState("");
  const [boletimTermino, setBoletimTermino] = useState("");
  const [gerandoBoletim, setGerandoBoletim] = useState(false);
  const [historicoDialogAberto, setHistoricoDialogAberto] = useState(false);
  const [historicoFormato, setHistoricoFormato] = useState<"word" | "xlsx" | null>(null);
  const [historicoAlunoId, setHistoricoAlunoId] = useState<string | null>(null);
  const [gerandoHistorico, setGerandoHistorico] = useState(false);
  const { dados: bioAluno, loading: carregandoBio } = useDadosBiograficosAluno(historicoAlunoId);
  if (!student) return null;

  const daGeral = Boolean((student as any).cfoAverages);
  const detalhado = (student as AlunoModulo).gradesDetalhado ?? {};
  const materias = Object.entries(detalhado).sort(
    (a, b) => (b[1].nota_final ?? 0) - (a[1].nota_final ?? 0)
  );

  const maiorNota = materias.length > 0 ? Math.max(...materias.map(([, d]) => d.nota_final ?? 0)) : 0;
  const menorEntry = materias.length > 0
    ? materias.reduce((pior, atual) => ((atual[1].nota_final ?? 10) < (pior[1].nota_final ?? 10) ? atual : pior))
    : null;
  const excelentes = materias.filter(([, d]) => (d.nota_final ?? 0) >= 9.5).length;

  function handleExport(formato: "pdf" | "xlsx" | "csv") {
    const dados = {
      nome: student!.nome,
      rank: student!.rank,
      totalAlunos: totalStudents,
      mediaFinal: student!.mediaFinal,
      tituloModulo,
      nomeTurma: config.nome_turma,
      subtituloTurma: config.subtitulo_turma,
      gradesDetalhado: detalhado,
    };
    if (formato === "pdf") exportarAlunoPDF(dados);
    else if (formato === "xlsx") exportarAlunoXLSX(dados);
    else exportarAlunoCSV(dados);
  }

  function anoLetivoDoModulo(): string | null {
    if (tituloModulo === "CFO I") return config.ano_letivo_cfo1;
    if (tituloModulo === "CFO II") return config.ano_letivo_cfo2;
    if (tituloModulo === "CFO III") return config.ano_letivo_cfo3;
    return null;
  }

  function abrirDialogoBoletim(formato: "pdf" | "word" | "xlsx") {
    setBoletimFormato(formato);
    setBoletimDialogAberto(true);
  }

  async function gerarBoletim() {
    if (!student || !boletimFormato) return;
    setGerandoBoletim(true);
    const alunoId = (student as AlunoModulo).aluno_id;
    const { data: bio } = alunoId
      ? await supabase.from("profiles").select("matricula_academia").eq("id", alunoId).single()
      : { data: null };
    const dados = {
      nomeAluno: student.nome,
      matricula: (student as AlunoModulo).matricula ?? null,
      matriculaAcademia: bio?.matricula_academia ?? null,
      nomeTurma: config.nome_turma,
      tituloModulo,
      anoLetivo: anoLetivoDoModulo(),
      inicio: boletimInicio,
      termino: boletimTermino,
      mediaFinalModulo: student.mediaFinal,
      gradesDetalhado: detalhado,
      responsavelNome: config.responsavel_assinatura_nome,
      responsavelPosto: config.responsavel_assinatura_posto,
      responsavelFuncao: config.responsavel_assinatura_funcao,
    };
    if (boletimFormato === "pdf") await exportarBoletimPDF(dados);
    else if (boletimFormato === "word") await exportarBoletimWord(dados);
    else exportarBoletimExcel(dados);
    setGerandoBoletim(false);
    setBoletimDialogAberto(false);
    setBoletimFormato(null);
  }

  function abrirDialogoHistorico(formato: "word" | "xlsx") {
    if (!student) return;
    setHistoricoFormato(formato);
    setHistoricoAlunoId((student as AlunoModulo).aluno_id);
    setHistoricoDialogAberto(true);
  }

  async function gerarHistorico() {
    if (!student || !historicoFormato || !bioAluno || !config.id) return;
    setGerandoHistorico(true);
    const alunoId = (student as AlunoModulo).aluno_id;
    const { numero, error } = await atribuirNumeroRegistroHistorico(alunoId, config.id);
    if (error || numero == null) {
      toast({ title: "Erro ao gerar número de registro", description: error ?? "", variant: "destructive" });
      setGerandoHistorico(false);
      return;
    }

    const cfoAverages = (student as any).cfoAverages ?? {};
    const dados: DadosExportacaoHistorico = {
      nomeAluno: student.nome,
      filiacaoPai: bioAluno.filiacao_pai,
      filiacaoMae: bioAluno.filiacao_mae,
      dataNascimento: bioAluno.data_nascimento
        ? new Date(bioAluno.data_nascimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })
        : null,
      naturalidade: bioAluno.naturalidade,
      matricula: bioAluno.matricula,
      matriculaAcademia: bioAluno.matricula_academia,
      rgPm: bioAluno.rg_pm,
      escolaAnterior: bioAluno.escola_anterior,
      anoConclusaoEnsinoMedio: bioAluno.ano_conclusao_ensino_medio,
      disciplinasCfo1: montarDisciplinasHistorico(MATERIAS_CFO1, CARGA_HORARIA_CFO1, detalhado, "CFO I"),
      disciplinasCfo2: montarDisciplinasHistorico(MATERIAS_CFO2, CARGA_HORARIA_CFO2, detalhado, "CFO II"),
      disciplinasCfo3: montarDisciplinasHistorico(MATERIAS_CFO3, CARGA_HORARIA_CFO3, detalhado, "CFO III"),
      anoLetivoCfo1: config.ano_letivo_cfo1,
      anoLetivoCfo2: config.ano_letivo_cfo2,
      anoLetivoCfo3: config.ano_letivo_cfo3,
      mediaCfo1: cfoAverages.cfoI ?? null,
      mediaCfo2: cfoAverages.cfoII ?? null,
      mediaCfo3: cfoAverages.cfoIII ?? null,
      mediaFinal: student.mediaFinal,
      rank: student.rank,
      numeroRegistro: numero,
      comandanteNome: config.comandante_apmcv_nome,
      comandantePosto: config.comandante_apmcv_posto,
      responsavelNome: config.responsavel_assinatura_nome,
      responsavelPosto: config.responsavel_assinatura_posto,
      responsavelFuncao: config.responsavel_assinatura_funcao,
      dataEmissao: dataPorExtenso(new Date()),
    };

    if (historicoFormato === "word") await exportarHistoricoWord(dados);
    else exportarHistoricoExcel(dados);
    setGerandoHistorico(false);
    setHistoricoDialogAberto(false);
    setHistoricoFormato(null);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <DialogTitle className="flex items-center gap-2 text-lg">
              {student.nome}
              <Badge>#{student.rank}</Badge>
            </DialogTitle>
            <div className="flex items-center gap-2">
              {isAdmin && !daGeral && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <FileText className="w-4 h-4 mr-1" /> Exportar Boletim
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => abrirDialogoBoletim("word")}>
                      <FileText className="w-4 h-4 mr-2 text-blue-500" /> Word (.docx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => abrirDialogoBoletim("pdf")}>
                      <FileText className="w-4 h-4 mr-2 text-red-500" /> PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => abrirDialogoBoletim("xlsx")}>
                      <FileSpreadsheet className="w-4 h-4 mr-2 text-green-500" /> Excel (.xlsx)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              {isAdmin && daGeral && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <FileText className="w-4 h-4 mr-1" /> Exportar Histórico
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => abrirDialogoHistorico("word")}>
                      <FileText className="w-4 h-4 mr-2 text-blue-500" /> Word (.docx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => abrirDialogoHistorico("xlsx")}>
                      <FileSpreadsheet className="w-4 h-4 mr-2 text-green-500" /> Excel (.xlsx)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-1" /> Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("pdf")} className="text-red-500 focus:text-red-500 font-medium">
                    <FileText className="w-4 h-4 mr-2 text-red-500" /> PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("xlsx")} className="text-green-500 focus:text-green-500 font-medium">
                    <FileSpreadsheet className="w-4 h-4 mr-2 text-green-500" /> Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("csv")} className="text-blue-500 focus:text-blue-500 font-medium">
                    <FileDown className="w-4 h-4 mr-2 text-blue-500" /> CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Badge
                variant="secondary"
                className={cn("text-sm", daGeral && "texto-trofeu-dourado bg-transparent border border-primary/40 font-bold text-base")}
              >
                Média Final: {student.mediaFinal.toFixed(4)}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-4">
          <div className="rounded-lg bg-success-light/20 border border-success/20 p-3 text-center">
            <Award className="w-4 h-4 text-success mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Maior Nota</p>
            <p className="text-lg font-bold text-success">{maiorNota.toFixed(4)}</p>
          </div>
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-center">
            <AlertCircle className="w-4 h-4 text-destructive mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Menor Nota</p>
            <p className="text-lg font-bold text-destructive">
              {menorEntry ? (menorEntry[1].nota_final ?? 0).toFixed(4) : "—"}
            </p>
            {menorEntry && <p className="text-[10px] text-muted-foreground truncate">{menorEntry[0]}</p>}
          </div>
          <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-center">
            <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Matérias</p>
            <p className="text-lg font-bold text-primary">{materias.length}</p>
          </div>
          <div className="rounded-lg bg-purple-500/10 border border-purple-500/20 p-3 text-center">
            <Award className="w-4 h-4 text-purple-400 mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">Excelência</p>
            <p className={cn("text-lg font-bold", daGeral && excelentes > 0 ? "texto-trofeu-dourado" : "text-purple-400")}>
              {excelentes}/{materias.length}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {materias.map(([materia, d]) => {
            const nota = d.nota_final ?? 0;
            const c = classificacao(nota);
            const temSplit = d.vc_lista.length > 0 || d.vf != null;
            return (
              <div key={materia} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {nota >= 9 ? (
                      <TrendingUp className="w-4 h-4 text-success shrink-0" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-warning shrink-0" />
                    )}
                    <span className="font-medium text-sm truncate">{materia}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold">{nota.toFixed(4)}</span>
                    <Badge
                      variant={c.variant}
                      className={cn(daGeral && c.label === "Excelente" && "texto-trofeu-dourado bg-transparent border border-primary/40 font-bold")}
                    >
                      {c.label}
                    </Badge>
                  </div>
                </div>

                {temSplit ? (
                  <div className="space-y-1.5">
                    {d.vc_lista.length > 0 && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-8 text-muted-foreground">VC:</span>
                        <Progress
                          value={(d.vc_lista.reduce((a, b) => a + b, 0) / d.vc_lista.length) * 10}
                          className="flex-1 h-2"
                          indicatorClassName={daGeral ? "barra-trofeu-dourado" : undefined}
                        />
                        <span className="w-16 text-right">{d.vc_lista.join(" / ")}</span>
                      </div>
                    )}
                    {d.vf != null && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-8 text-muted-foreground">VF:</span>
                        <Progress
                          value={d.vf * 10}
                          className="flex-1 h-2"
                          indicatorClassName={daGeral ? "barra-trofeu-dourado" : undefined}
                        />
                        <span className="w-16 text-right">{d.vf.toFixed(4)}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-8 text-muted-foreground">Nota:</span>
                    <Progress
                      value={nota * 10}
                      className="flex-1 h-2"
                      indicatorClassName={daGeral ? "barra-trofeu-dourado" : undefined}
                    />
                    <span className="w-16 text-right">{nota.toFixed(4)}</span>
                  </div>
                )}
              </div>
            );
          })}
          {materias.length === 0 && (
            <p className="text-center text-muted-foreground py-8">Nenhuma nota lançada ainda.</p>
          )}
        </div>
      </DialogContent>

      <Dialog open={boletimDialogAberto} onOpenChange={(open) => !open && setBoletimDialogAberto(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Exportar Boletim — {tituloModulo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Início (opcional)</label>
              <input
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                value={boletimInicio}
                onChange={(e) => setBoletimInicio(e.target.value)}
                placeholder="ex: 03/2023"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Término (opcional)</label>
              <input
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                value={boletimTermino}
                onChange={(e) => setBoletimTermino(e.target.value)}
                placeholder="ex: 09/2023"
              />
            </div>
            <Button onClick={gerarBoletim} disabled={gerandoBoletim} className="w-full">
              {gerandoBoletim && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Gerar {boletimFormato === "pdf" ? "PDF" : boletimFormato === "word" ? "Word" : "Excel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={historicoDialogAberto} onOpenChange={(open) => !open && setHistoricoDialogAberto(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Exportar Histórico Escolar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {carregandoBio ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Campos biográficos ainda não cadastrados aparecem em vermelho no documento
                  gerado, prontos para revisão antes da assinatura.
                </p>
                <Button onClick={gerarHistorico} disabled={gerandoHistorico} className="w-full">
                  {gerandoHistorico && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Gerar {historicoFormato === "word" ? "Word" : "Excel"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
