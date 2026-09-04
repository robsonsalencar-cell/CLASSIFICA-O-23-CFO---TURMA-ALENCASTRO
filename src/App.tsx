import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

import { AuthProvider } from "@/contexts/AuthContext";
import { TurmaProvider } from "@/contexts/TurmaContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppSidebar } from "@/components/layout/AppSidebar";

import Login from "@/pages/auth/Login";
import ForgotPassword from "@/pages/auth/ForgotPassword";
import ResetPassword from "@/pages/auth/ResetPassword";
import TrocaSenhaObrigatoria from "@/pages/auth/TrocaSenhaObrigatoria";
import Perfil from "@/pages/Perfil";
import Admin from "@/pages/admin/Admin";
import { AdminAuditoria } from "@/pages/admin/AdminAuditoria";
import NotFound from "@/pages/NotFound";

// Substitua pelos Index.tsx de cada módulo já adaptados para usar
// o hook useNotasModulo (ver README-INTEGRACAO.md, seção "Adaptando cada dashboard")
import ClassificacaoGeral from "@/pages/cfo/ClassificacaoGeral";
import Cfo1 from "@/pages/cfo/Cfo1";
import Cfo2 from "@/pages/cfo/Cfo2";
import Cfo3 from "@/pages/cfo/Cfo3";
import VisitanteRanking from "@/pages/visitante/VisitanteRanking";

const queryClient = new QueryClient();

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="p-2 border-b border-border/50">
          <SidebarTrigger />
        </div>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TurmaProvider>
        <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Rotas públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/esqueci-senha" element={<ForgotPassword />} />
            <Route path="/redefinir-senha" element={<ResetPassword />} />
            <Route
              path="/trocar-senha-obrigatoria"
              element={
                <ProtectedRoute>
                  <TrocaSenhaObrigatoria />
                </ProtectedRoute>
              }
            />

            {/* Rotas protegidas (exigem login) */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <ClassificacaoGeral />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cfo1"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Cfo1 />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cfo2"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Cfo2 />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/cfo3"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Cfo3 />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Perfil />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            {/* Rota exclusiva do Visitante — sem AppShell (sem menu de aluno/admin) */}
            <Route
              path="/visitante"
              element={
                <ProtectedRoute>
                  <VisitanteRanking />
                </ProtectedRoute>
              }
            />

            {/* Rota exclusiva do admin */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly>
                  <AppShell>
                    <Admin />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/auditoria"
              element={
                <ProtectedRoute developerOnly>
                  <AppShell>
                    <AdminAuditoria />
                  </AppShell>
                </ProtectedRoute>
              }
            />

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </TurmaProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
