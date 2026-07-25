import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, CheckCircle } from "lucide-react";

interface LaunchedSubjectsListProps {
  subjects: string[];
  totalSubjects: number;
}

export const LaunchedSubjectsList = ({ subjects, totalSubjects }: LaunchedSubjectsListProps) => {
  const percentage = Math.round((subjects.length / totalSubjects) * 100);
  
  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
          <BookOpen className="w-5 h-5 text-primary" />
          Lista de Matérias Lançadas
          <Badge variant="secondary" className="ml-auto">
            {subjects.length}/{totalSubjects}
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CheckCircle className="w-4 h-4 text-success" />
          {percentage}% do curso avaliado
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-2">
            {subjects.length > 0 ? (
              subjects.map((subject, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card-header/20 hover:bg-card-header/40 transition-colors"
                >
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                    <span className="text-sm font-medium text-success">
                      {index + 1}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-foreground flex-1">
                    {subject}
                  </span>
                  <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma matéria lançada ainda</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};