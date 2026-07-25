import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  variant?: "default" | "success" | "warning" | "danger";
  tooltip?: string;
  icon?: React.ReactNode;
}

export const KPICard = ({ 
  title, 
  value, 
  subtitle, 
  variant = "default", 
  tooltip,
  icon 
}: KPICardProps) => {
  const cardVariants = {
    default: "border-card-border",
    success: "border-success/30 bg-gradient-to-br from-success/20 to-success-light/40 shadow-lg ring-2 ring-success/20 animate-pulse",
    warning: "border-warning/20 bg-warning-light/30", 
    danger: "border-danger/20 bg-danger-light/30"
  };

  const titleVariants = {
    default: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger"
  };

  const valueVariants = {
    default: "text-foreground",
    success: "text-success font-bold text-3xl",
    warning: "text-warning", 
    danger: "text-danger"
  };

  const content = (
    <Card className={cn(
      "transition-all duration-200 hover:shadow-md bg-gradient-card",
      cardVariants[variant]
    )}>
      <CardHeader className="pb-2">
        <CardTitle className={cn(
          "text-sm font-medium flex items-center gap-2",
          titleVariants[variant]
        )}>
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "text-2xl font-bold mb-1",
          valueVariants[variant]
        )}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground">
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
};