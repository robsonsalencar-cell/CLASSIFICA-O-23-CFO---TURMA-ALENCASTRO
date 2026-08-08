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
import { useConfiguracaoTurma } from "@/contexts/TurmaContext";
import { exportarAlunoCSV, exportarAlunoPDF, exportarAlunoXLSX } from "@/utils/exportAluno";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Award, AlertCircle, Download, FileText, FileSpreadsheet, FileDown } from "lucide-react";

interface StudentDetailsModalProps {
  student: DetailedStudent | null;
  isOpen: boolean;
  onClose: () => void;
  totalStudents?: number;
  tituloModulo?: string;
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
}: StudentDetailsModalProps) {
  const { config } = useConfiguracaoTurma();
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
            <p className={cn("text-lg font-bold", excelentes > 0 ? "texto-trofeu-dourado" : "text-purple-400")}>
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
                      className={cn(c.label === "Excelente" && "texto-trofeu-dourado bg-transparent border border-primary/40 font-bold")}
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
                          indicatorClassName="barra-trofeu-dourado"
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
                          indicatorClassName="barra-trofeu-dourado"
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
                      indicatorClassName="barra-trofeu-dourado"
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
    </Dialog>
  );
}
