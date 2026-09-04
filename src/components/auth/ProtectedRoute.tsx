import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  adminOnly?: boolean;
  developerOnly?: boolean;
}

export function ProtectedRoute({ children, adminOnly = false, developerOnly = false }: ProtectedRouteProps) {
  const { session, isAdmin, isDeveloper, isVisitante, precisaTrocarSenha, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (precisaTrocarSenha && location.pathname !== "/trocar-senha-obrigatoria") {
    return <Navigate to="/trocar-senha-obrigatoria" replace />;
  }

  // Visitante só acessa a própria tela de ranking — nenhuma outra rota
  // protegida (aluno, admin, perfil, etc.) fica disponível pra esse papel.
  if (isVisitante && location.pathname !== "/visitante") {
    return <Navigate to="/visitante" replace />;
  }

  if (developerOnly && !isDeveloper) {
    return <Navigate to="/" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
