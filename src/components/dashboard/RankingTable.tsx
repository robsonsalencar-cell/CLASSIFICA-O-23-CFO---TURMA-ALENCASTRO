import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Search, Download, RotateCcw, FileText, FileSpreadsheet, FileType } from "lucide-react";
import { DetailedStudent } from "@/hooks/useGoogleSheets";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  exportToPDF,
  exportToXLSX,
  exportToCSV,
  ReportKPIs,
  ReportSubjectProgress,
} from "@/lib/exportReport";

interface RankingTableProps {
  students: DetailedStudent[];
  onStudentClick?: (student: DetailedStudent) => void;
  kpis?: ReportKPIs;
  subjectProgress?: ReportSubjectProgress;
  // "modulo": página de um módulo só (CFO I/II/III) — mostra Rank/Nome/Média/Classificação.
  // "geral" (padrão): Classificação Geral — mostra o detalhamento CFO I/II/III + Média Final.
  modo?: "modulo" | "geral";
  // Controla se o botão "Exportar Relatório" (completo, de todos os alunos)
  // aparece. Só admin/desenvolvedor deve poder exportar o relatório da turma
  // inteira — um aluno vendo o ranking (se liberado) não deve ter essa opção.
  podeExportar?: boolean;
}

function badgeClassificacao(media: number) {
  if (media >= 9.5) return <Badge className="bg-success text-success-foreground">Excelente</Badge>;
  if (media >= 9.0) return <Badge variant="secondary">Bom</Badge>;
  return <Badge variant="destructive">Regular</Badge>;
}

export const RankingTable = ({
  students,
  onStudentClick,
  kpis,
  subjectProgress,
  modo = "geral",
  podeExportar = true,
}: RankingTableProps) => {
  const [search, setSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const filteredStudents = useMemo(() => {
    let filtered = students.filter(student =>
      student.nome.toLowerCase().includes(search.toLowerCase())
    );

    if (gradeFilter !== "all") {
      switch (gradeFilter) {
        case "high":
          filtered = filtered.filter(s => s.mediaFinal >= 9.5);
          break;
        case "medium":
          filtered = filtered.filter(s => s.mediaFinal >= 9.0 && s.mediaFinal < 9.5);
          break;
        case "low":
          filtered = filtered.filter(s => s.mediaFinal < 9.0);
          break;
      }
    }

    return filtered;
  }, [students, search, gradeFilter]);

  const paginatedStudents = useMemo(() => {
    if (itemsPerPage === -1) return filteredStudents;
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredStudents.slice(start, end);
  }, [filteredStudents, currentPage, itemsPerPage]);

  const totalPages = itemsPerPage === -1 ? 1 : Math.ceil(filteredStudents.length / itemsPerPage);

  const handleReset = () => {
    setSearch("");
    setGradeFilter("all");
    setCurrentPage(1);
  };

  const buildReportData = () => ({
    students: filteredStudents,
    kpis: kpis ?? {
      mediaTurma: 0,
      desvioPadrao: 0,
      totalAlunos: filteredStudents.length,
      maiorMedia: { aluno: filteredStudents[0]?.nome ?? "", nota: filteredStudents[0]?.mediaFinal ?? 0 },
      menorMedia: {
        aluno: filteredStudents[filteredStudents.length - 1]?.nome ?? "",
        nota: filteredStudents[filteredStudents.length - 1]?.mediaFinal ?? 0,
      },
    },
    subjectProgress: subjectProgress ?? { gradedSubjects: 0, totalSubjects: 96 },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <CardTitle className="text-xl font-bold">Ranking Completo</CardTitle>
          
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-full sm:w-64"
              />
            </div>
            
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por nota" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as notas</SelectItem>
                <SelectItem value="high">≥ 9,5 (Excelente)</SelectItem>
                <SelectItem value="medium">9,0 - 9,49 (Bom)</SelectItem>
                <SelectItem value="low">&lt; 9,0 (Regular)</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Limpar
            </Button>
            
            {podeExportar && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Exportar Relatório
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => exportToPDF(buildReportData())}>
                    <FileType className="w-4 h-4 mr-2 text-red-500" />
                    Exportar PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToXLSX(buildReportData())}>
                    <FileSpreadsheet className="w-4 h-4 mr-2 text-green-500" />
                    Exportar Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportToCSV(buildReportData())}>
                    <FileText className="w-4 h-4 mr-2 text-blue-500" />
                    Exportar CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-white font-extrabold text-base">Rank</TableHead>
                <TableHead className="text-white font-extrabold text-base">Nome</TableHead>
                {modo === "geral" && (
                  <>
                    <TableHead className="text-center font-extrabold text-base text-[hsl(220,80%,60%)]">CFO I</TableHead>
                    <TableHead className="text-center font-extrabold text-base text-[hsl(140,60%,45%)]">CFO II</TableHead>
                    <TableHead className="text-center font-extrabold text-base text-primary">CFO III</TableHead>
                  </>
                )}
                <TableHead className="text-center font-extrabold text-base text-foreground">Média Final</TableHead>
                {modo === "modulo" && (
                  <TableHead className="text-center font-extrabold text-base text-primary">Classificação</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedStudents.map((student) => (
                <TooltipProvider key={student.rank}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                <TableRow
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => onStudentClick && onStudentClick(student)}
                      >
                        <TableCell className="font-medium">
                          <Badge variant="outline">{student.rank}º</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {student.nome}
                        </TableCell>
                        {modo === "geral" && (
                          <>
                            <TableCell className="text-center font-bold text-base text-[hsl(220,80%,60%)]">
                              {student.cfoAverages?.cfoI?.toFixed(4) ?? "—"}
                            </TableCell>
                            <TableCell className="text-center font-bold text-base text-[hsl(140,60%,45%)]">
                              {student.cfoAverages?.cfoII?.toFixed(4) ?? "—"}
                            </TableCell>
                            <TableCell className="text-center font-bold text-base text-primary">
                              {student.cfoAverages?.cfoIII?.toFixed(4) ?? "—"}
                            </TableCell>
                          </>
                        )}
                        <TableCell className="text-center font-extrabold text-base text-foreground">
                          {student.mediaFinal.toFixed(4)}
                        </TableCell>
                        {modo === "modulo" && (
                          <TableCell className="text-center">{badgeClassificacao(student.mediaFinal)}</TableCell>
                        )}
                      </TableRow>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-md">
                      <p className="font-semibold mb-2">{student.nome}</p>
                      <p className="text-sm">Clique para ver detalhes das disciplinas</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Mostrando {paginatedStudents.length} de {filteredStudents.length} resultados
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => {
                setItemsPerPage(parseInt(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10 por página</SelectItem>
                <SelectItem value="25">25 por página</SelectItem>
                <SelectItem value="50">50 por página</SelectItem>
                <SelectItem value="-1">Mostrar tudo</SelectItem>
              </SelectContent>
            </Select>
            
            {itemsPerPage !== -1 && (
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <span className="px-3 py-1 text-sm">
                  {currentPage} de {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Próximo
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
