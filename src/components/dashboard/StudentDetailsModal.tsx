import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DetailedStudent } from "@/hooks/useGoogleSheets";
import { TrendingUp, TrendingDown, Award, AlertCircle } from "lucide-react";

interface StudentDetailsModalProps {
  student: DetailedStudent | null;
  isOpen: boolean;
  onClose: () => void;
}

export function StudentDetailsModal({ student, isOpen, onClose }: StudentDetailsModalProps) {
  if (!student) return null;

  // Função para formatar notas com 4 casas decimais
  const formatGrade = (grade: number): string => {
    return grade.toFixed(4);
  };

  // Mapeamento das notas máximas para avaliações específicas
  const getMaxGradeForSubject = (subjectName: string): number => {
    // Casos especiais onde a nota máxima não é 10
    if (subjectName.includes("Direito Administrativo Disciplinar Militar I VC2")) {
      return 2;
    }
    if (subjectName.includes("Direito Administrativo Disciplinar Militar I VC1")) {
      return 8;
    }
    // Por padrão, nota máxima é 10
    return 10;
  };

  // Função para calcular a performance relativa (nota/nota_máxima)
  const getRelativePerformance = (grade: number, subjectName: string): number => {
    const maxGrade = getMaxGradeForSubject(subjectName);
    return grade / maxGrade;
  };

  const getGradeBadgeVariant = (grade: number): "default" | "secondary" | "destructive" | "outline" => {
    if (grade >= 8) return "default";
    if (grade >= 6) return "secondary";
    if (grade >= 5) return "outline";
    return "destructive";
  };

  const getGradeColor = (grade: number): string => {
    if (grade >= 8) return "text-green-600 dark:text-green-400";
    if (grade >= 6) return "text-blue-600 dark:text-blue-400";
    if (grade >= 5) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getPerformanceIcon = (grade: number) => {
    if (grade >= 8) return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />;
    if (grade >= 6) return <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
    if (grade >= 5) return <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
    return <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />;
  };

  // Calcular média final de uma matéria a partir de um conjunto de notas (VC*, VF*, ÚNICA)
  const computeSubjectFinal = (
    subjectBase: string,
    gradesByType: { [k: string]: number }
  ): number | null => {
    const types = Object.keys(gradesByType);
    if (types.length === 0) return null;
    if (gradesByType["ÚNICA"] !== undefined) return gradesByType["ÚNICA"];
    let vcSum = 0, vcCount = 0, vfGrade = 0, hasVf = false;
    types.forEach((t) => {
      if (t.startsWith("VC")) { vcSum += gradesByType[t]; vcCount++; }
      else if (t.startsWith("VF")) { vfGrade = gradesByType[t]; hasVf = true; }
    });
    const isSpecial = subjectBase.includes("Direito Administrativo Disciplinar Militar I");
    const vcValue = vcCount > 0 ? (isSpecial ? vcSum : vcSum / vcCount) : 0;
    if (vcCount > 0 && hasVf) return (vcValue * 2 + vfGrade * 3) / 5;
    if (vcCount > 0) return vcValue;
    if (hasVf) return vfGrade;
    return null;
  };

  // Organizar notas por matéria base, separadas por CFO
  type SubjectGrouped = {
    cfoI: { [k: string]: number };
    cfoII: { [k: string]: number };
    cfoIII: { [k: string]: number };
    merged: { [k: string]: number };
  };
  const organizedGrades: { [subject: string]: SubjectGrouped } = {};

  const addEntry = (cfoKey: "cfoI" | "cfoII" | "cfoIII" | null, subjectName: string, grade: number) => {
    const match = subjectName.match(/^(.*?)\s+(VC\d*|VF\d*)$/i);
    let baseSubject: string;
    let testType: string;
    if (match) {
      baseSubject = match[1].trim();
      testType = match[2].toUpperCase();
    } else {
      baseSubject = subjectName;
      testType = "ÚNICA";
    }
    if (!organizedGrades[baseSubject]) {
      organizedGrades[baseSubject] = { cfoI: {}, cfoII: {}, cfoIII: {}, merged: {} };
    }
    if (cfoKey) organizedGrades[baseSubject][cfoKey][testType] = grade;
    organizedGrades[baseSubject].merged[testType] = grade;
  };

  const perCfo = student.gradesPerCfo;
  if (perCfo) {
    (["cfoI", "cfoII", "cfoIII"] as const).forEach((key) => {
      const g = perCfo[key];
      if (!g) return;
      Object.entries(g).forEach(([s, v]) => addEntry(key, s, v));
    });
  } else {
    Object.entries(student.grades).forEach(([s, v]) => addEntry(null, s, v));
  }

  // Calcular média de cada matéria: média dos CFOs disponíveis (final por CFO)
  const subjectAverages = Object.entries(organizedGrades).map(([subject, groups]) => {
    const perCfoFinals: { cfo: string; value: number }[] = [];
    (["cfoI", "cfoII", "cfoIII"] as const).forEach((k) => {
      const v = computeSubjectFinal(subject, groups[k]);
      if (v !== null) perCfoFinals.push({ cfo: k === "cfoI" ? "CFO I" : k === "cfoII" ? "CFO II" : "CFO III", value: v });
    });
    let average = 0;
    if (perCfoFinals.length > 0) {
      average = perCfoFinals.reduce((s, x) => s + x.value, 0) / perCfoFinals.length;
    } else {
      average = computeSubjectFinal(subject, groups.merged) ?? 0;
    }
    return { subject, average, grades: groups.merged, perCfoFinals, groups };
  }).sort((a, b) => b.average - a.average);

  // Verificar se há notas disponíveis
  const hasGrades = Object.keys(student.grades).length > 0;
  
  const highestGrade = hasGrades ? Math.max(...Object.values(student.grades)) : 0;
  
  // Calcular a menor performance relativa ao invés da menor nota absoluta
  const gradePerformances = Object.entries(student.grades).map(([subjectName, grade]) => ({
    subjectName,
    grade,
    relativePerformance: getRelativePerformance(grade, subjectName)
  }));
  
  // Encontrar a nota com menor performance relativa (com valor inicial seguro)
  const worstPerformance = gradePerformances.length > 0 
    ? gradePerformances.reduce((worst, current) => 
        current.relativePerformance < worst.relativePerformance ? current : worst
      )
    : { subjectName: 'N/A', grade: 0, relativePerformance: 0 };
  
  const lowestGrade = worstPerformance.grade;
  const lowestGradeSubject = worstPerformance.subjectName;
  
  // Função para extrair apenas a parte VC/VF do nome da matéria
  const getTestType = (subjectName: string): string => {
    const match = subjectName.match(/\s+(VC\d*|VF\d*)$/i);
    return match ? match[1] : "";
  };
  
  // Função para extrair o nome base da matéria
  const getSubjectBaseName = (subjectName: string): string => {
    return subjectName.replace(/\s+(VC\d*|VF\d*)$/i, "").trim();
  };
  
  const totalSubjects = Object.keys(organizedGrades).length;
  const excellentSubjects = subjectAverages.filter(s => s.average >= 8).length;

  return (
    <Dialog open={isOpen} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold">{student.nome}</span>
              <Badge className="text-lg px-3 py-1" variant="default">
                #{student.rank}
              </Badge>
            </div>
            <Badge className="text-lg px-4 py-2" variant={getGradeBadgeVariant(student.mediaFinal)}>
              Média Final: {formatGrade(student.mediaFinal)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Estatísticas Resumidas */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-5 w-5 text-green-600 dark:text-green-400" />
                <span className="text-sm font-medium text-muted-foreground">Maior Nota</span>
              </div>
              <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatGrade(highestGrade)}
              </p>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <span className="text-sm font-medium text-muted-foreground">Menor Nota</span>
              </div>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatGrade(lowestGrade)}
              </p>
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-red-700 dark:text-red-300">
                  {getSubjectBaseName(lowestGradeSubject)}
                </p>
                {getTestType(lowestGradeSubject) && (
                  <Badge variant="outline" className="text-xs px-2 py-0 border-red-300 text-red-700 dark:border-red-600 dark:text-red-300">
                    {getTestType(lowestGradeSubject)}
                  </Badge>
                )}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-muted-foreground">Matérias</span>
              </div>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {totalSubjects}
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-2">
                <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                <span className="text-sm font-medium text-muted-foreground">Excelência</span>
              </div>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {excellentSubjects}/{totalSubjects}
              </p>
            </div>
          </div>

          {/* Detalhamento das Notas por Matéria */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold mb-4">Detalhamento por Matéria</h3>
            
            {subjectAverages.map(({ subject, average, perCfoFinals }) => (
              <div 
                key={subject} 
                className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-gradient-to-r from-background to-muted/20"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {getPerformanceIcon(average)}
                    <h4 className="font-semibold text-base">{subject}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-lg ${getGradeColor(average)}`}>
                      {formatGrade(average)}
                    </span>
                    <Badge variant={getGradeBadgeVariant(average)}>
                      {average >= 8 ? "Excelente" : average >= 6 ? "Bom" : average >= 5 ? "Regular" : "Atenção"}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  {perCfoFinals.length > 0 ? (
                    perCfoFinals.map((row) => (
                      <div key={row.cfo} className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground min-w-[60px]">
                          {row.cfo}:
                        </span>
                        <Progress value={row.value * 10} className="flex-1 h-2" />
                        <span className={`font-medium text-sm min-w-[60px] text-right ${getGradeColor(row.value)}`}>
                          {formatGrade(row.value)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-muted-foreground">Sem notas lançadas.</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}