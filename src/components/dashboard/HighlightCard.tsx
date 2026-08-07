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
    // Os 3 primeiros lugares usam a MESMA cor (a do tema do módulo), não uma
    // cor diferente por posição — assim acompanha CFO I azul / CFO II verde /
    // CFO III dourado corretamente.
    if (variant === "top") return "text-primary";
    // Carroceiros: nome e média em branco/neutro (só o ícone e o selo
    // continuam vermelhos, para não perder o alerta visual)
    return "text-foreground";
  };

  const getCardStyle = () => {
    if (variant === "top") {
      return "border-primary/30 bg-gradient-to-br from-primary/20 to-primary/10 hover:shadow-lg hover:border-primary/40 transition-all duration-300";
    }
    return "border-danger/50 bg-gradient-to-br from-danger/30 to-danger/15 hover:shadow-lg hover:border-danger/60 transition-all duration-300";
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
              <span className="text-xs font-bold block" style={{ color: "hsl(210,90%,65%)" }}>CFO I</span>
              <span className="font-extrabold text-sm" style={{ color: "hsl(210,90%,65%)" }}>
                {cfoAverages?.cfoI?.toFixed(4) ?? "—"}
              </span>
            </div>
            <div className="text-center">
              <span className="text-xs font-bold block" style={{ color: "hsl(140,70%,50%)" }}>CFO II</span>
              <span className="font-extrabold text-sm" style={{ color: "hsl(140,70%,50%)" }}>
                {cfoAverages?.cfoII?.toFixed(4) ?? "—"}
              </span>
            </div>
            <div className="text-center">
              <span className="text-xs font-bold block" style={{ color: "hsl(43,96%,56%)" }}>CFO III</span>
              <span className="font-extrabold text-sm" style={{ color: "hsl(43,96%,56%)" }}>
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
