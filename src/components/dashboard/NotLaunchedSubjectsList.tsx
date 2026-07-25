import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, XCircle } from "lucide-react";

interface NotLaunchedSubjectsListProps {
  launchedSubjects: string[];
  allSubjects: string[];
  totalSubjects: number;
}

// Normalização frouxa: remove acentos, pontuação, VC/VF e numerais romanos,
// para casar "Sistema de Segurança Pública no Brasil" com "SISTEMA DE SEGURANÇA PÚBLICA".
const normalizeSubjectName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\b(VC|VF)\s*\d*\b/g, '')
    .replace(/\b(I{1,3})\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const isLaunched = (matrixSubject: string, launchedNormalized: string[]): boolean => {
  const normMatrix = normalizeSubjectName(matrixSubject);
  if (!normMatrix) return false;
  return launchedNormalized.some(l => {
    if (!l) return false;
    return l === normMatrix || l.includes(normMatrix) || normMatrix.includes(l);
  });
};

export const NotLaunchedSubjectsList = ({ launchedSubjects, allSubjects, totalSubjects }: NotLaunchedSubjectsListProps) => {
  // Normalizar matérias lançadas
  const normalizedLaunched = launchedSubjects.map(normalizeSubjectName);

  // Matérias da matriz que ainda não têm nenhuma nota lançada
  const notLaunchedSubjects = allSubjects.filter(subject => !isLaunched(subject, normalizedLaunched));

  const notLaunchedCount = totalSubjects - launchedSubjects.length;
  const percentage = Math.round((notLaunchedCount / totalSubjects) * 100);
  
  return (
    <Card className="h-full border-warning/30">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <BookOpen className="w-5 h-5 text-warning" />
          Lista de Matérias NÃO Lançadas
          <Badge variant="outline" className="ml-auto border-warning text-warning">
            {notLaunchedCount}/{totalSubjects}
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <XCircle className="w-4 h-4 text-warning" />
          {percentage}% do curso ainda não avaliado
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {notLaunchedSubjects.length > 0 ? (
              notLaunchedSubjects.map((subject, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg border border-warning/20 bg-warning-light/10 hover:bg-warning-light/20 transition-colors"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
                    <span className="text-sm font-medium text-warning">
                      {index + 1}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-foreground flex-1">
                    {subject}
                  </span>
                  <XCircle className="w-4 h-4 text-warning flex-shrink-0" />
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Todas as matérias já foram lançadas! 🎉</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
