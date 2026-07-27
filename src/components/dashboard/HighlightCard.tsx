import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Trophy, Award, Medal, TrendingDown } from "lucide-react";

interface HighlightCardProps {
  rank: number;
  nome: string;
  mediaFinal: number;
  variant: "top" | "bottom";
  cfoAverages?: {
    cfoI?: number;
    cfoII?: number;
    cfoIII?: number;
  };
  onClick?: () => void;
}

export const HighlightCard = ({ 
  rank, 
  nome, 
  mediaFinal, 
  variant,
  cfoAverages,
  onClick 
}: HighlightCardProps) => {
  const getIcon = () => {
    if (variant === "top") {
      switch (rank) {
        case 1:
          return <Trophy className="w-5 h-5 text-primary animate-pulse" />;
        case 2:
          return <Award className="w-5 h-5 text-success" />;
        case 3:
          return <Medal className="w-5 h-5 text-warning" />;
        default:
          return null;
      }
    } else {
      return <TrendingDown className="w-5 h-5 text-danger animate-bounce" />;
    }
  };

  const getBadgeVariant = () => {
    if (variant === "top") {
      switch (rank) {
        case 1: return "default";
        case 2: return "secondary";
        case 3: return "outline";
        default: return "outline";
      }
    }
    return "destructive";
  };

  const getTextColor = () => {
    if (variant === "top") {
      switch (rank) {
        case 1: return "text-primary";
        case 2: return "text-success";
        case 3: return "text-warning";
        default: return "text-foreground";
      }
    }
    return "text-danger";
  };

  const getCardStyle = () => {
    if (variant === "top") {
      switch (rank) {
        case 1:
          return "border-primary/30 bg-gradient-to-br from-primary/20 to-primary/10 hover:shadow-lg hover:border-primary/40 transition-all duration-300";
        case 2:
          return "border-success/30 bg-gradient-to-br from-success/20 to-success/10 hover:shadow-lg hover:border-success/40 transition-all duration-300";
        case 3:
          return "border-warning/30 bg-gradient-to-br from-warning/20 to-warning/10 hover:shadow-lg hover:border-warning/40 transition-all duration-300";
        default:
          return "border-card-border bg-gradient-card hover:shadow-md transition-all duration-300";
      }
    }
    return "border-danger/30 bg-gradient-to-br from-danger/20 to-danger/10 hover:shadow-lg hover:border-danger/40 transition-all duration-300";
  };

  return (
    <Card 
      className={cn(
        "transition-all duration-200 cursor-pointer border",
        getCardStyle()
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Badge variant={getBadgeVariant()}>
            {rank}º lugar
          </Badge>
          {getIcon()}
        </div>
        
        <h3 className={cn("font-semibold text-sm mb-2", getTextColor())}>
          {nome}
        </h3>
        
        {/* CFO Averages — só na Classificação Geral (quando cfoAverages é passado) */}
        {cfoAverages && (
          <div className="grid grid-cols-4 gap-2 mb-2">
            <div className="text-center">
              <span className="text-xs font-bold text-muted-foreground block">CFO I</span>
              <span className={cn("font-extrabold text-sm", getTextColor())}>
                {cfoAverages?.cfoI?.toFixed(4) ?? "—"}
              </span>
            </div>
            <div className="text-center">
              <span className="text-xs font-bold text-muted-foreground block">CFO II</span>
              <span className={cn("font-extrabold text-sm", getTextColor())}>
                {cfoAverages?.cfoII?.toFixed(4) ?? "—"}
              </span>
            </div>
            <div className="text-center">
              <span className="text-xs font-bold text-muted-foreground block">CFO III</span>
              <span className={cn("font-extrabold text-sm", getTextColor())}>
                {cfoAverages?.cfoIII?.toFixed(4) ?? "—"}
              </span>
            </div>
            <div className="text-center">
              <span className="text-xs font-bold text-muted-foreground block">MÉDIA</span>
              <span className={cn("font-extrabold text-sm", getTextColor())}>
                {mediaFinal.toFixed(4)}
              </span>
            </div>
          </div>
        )}

        <div className={cn("flex items-center justify-between", cfoAverages && "border-t border-border/30 pt-2")}>
          <span className="text-xs text-muted-foreground font-medium">
            Média Final
          </span>
          <span className={cn(
            "font-bold text-xl tracking-wide",
            getTextColor()
          )}>
            {mediaFinal.toFixed(4)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
