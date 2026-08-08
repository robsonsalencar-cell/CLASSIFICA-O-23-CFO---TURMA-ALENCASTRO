import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useConfiguracaoTurma, useTurma } from "@/contexts/TurmaContext";
import { supabase } from "@/lib/supabaseClient";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { LayoutDashboard, ShieldCheck, Trophy, KeyRound, LogOut, Eye, GraduationCap, ScrollText, Lock, Unlock } from "lucide-react";

const modulos = [
  { to: "/cfo1", label: "CFO I", cor: "hsl(210,90%,65%)", dourado: false },
  { to: "/cfo2", label: "CFO II", cor: "hsl(140,70%,50%)", dourado: false },
  { to: "/cfo3", label: "CFO III", cor: "hsl(43,96%,56%)", dourado: false },
  { to: "/", label: "Classificação Geral", cor: "hsl(43,96%,56%)", dourado: true },
];

export function AppSidebar() {
  const { profile, isAdmin, isDeveloper, viewingAsAlunoId, setViewingAsAlunoId, signOut } = useAuth();
  const { config } = useConfiguracaoTurma();
  const { turmas, turmaAtualId, setTurmaAtualId, turmaAtual, alternarRankingPublico } = useTurma();
  const [alunos, setAlunos] = useState<{ id: string; nome_completo: string }[]>([]);

  useEffect(() => {
    if (!isAdmin || !turmaAtualId) return;
    supabase
      .from("profiles")
      .select("id, nome_completo")
      .eq("role", "aluno")
      .eq("turma_id", turmaAtualId)
      .order("nome_completo")
      .then(({ data }) => setAlunos(data ?? []));
  }, [isAdmin, turmaAtualId]);

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <img src={config.brasao_url ?? "/lovable-uploads/brasao-novo.png"} alt={config.nome_turma} className="w-9 h-9 object-contain" />
          <div>
            <p className="text-sm font-extrabold uppercase tracking-wide texto-trofeu-dourado">{config.nome_turma}</p>
            <p className="text-xs text-muted-foreground">{config.subtitulo_turma}</p>
          </div>
        </div>
        {isAdmin && turmas.length > 1 && (
          <div className="mt-3 space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <GraduationCap className="w-3 h-3" /> Turma em foco
            </p>
            <Select value={turmaAtualId ?? undefined} onValueChange={setTurmaAtualId}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione a turma" />
              </SelectTrigger>
              <SelectContent>
                {turmas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome_turma}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Módulos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {modulos.map((m) => (
                <SidebarMenuItem key={m.to}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={m.to}
                      className={({ isActive }) =>
                        cn(
                          isActive ? "font-semibold text-primary" : "text-foreground/80",
                          m.dourado && "gap-1"
                        )
                      }
                    >
                      {m.dourado ? (
                        <Trophy className="w-4 h-4" style={{ color: m.cor }} />
                      ) : (
                        <LayoutDashboard className="w-4 h-4" style={{ color: m.cor }} />
                      )}
                      <span className={cn(m.dourado && "texto-trofeu-dourado font-bold")}>{m.label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/admin" className={({ isActive }) => (isActive ? "font-semibold text-primary" : "")}>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Painel do Administrador</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                {isDeveloper && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to="/admin/auditoria" className={({ isActive }) => (isActive ? "font-semibold text-primary" : "")}>
                        <ScrollText className="w-4 h-4" />
                        <span>Auditoria</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>

              <div className="px-2 pt-3 space-y-1">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Eye className="w-3 h-3" /> Visualizar como
                </p>
                <Select
                  value={viewingAsAlunoId ?? "__geral__"}
                  onValueChange={(v) => setViewingAsAlunoId(v === "__geral__" ? null : v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Visão Geral" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__geral__">Visão Geral (todos os alunos)</SelectItem>
                    {alunos.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="px-2 pt-4 space-y-1.5 border-t border-border/50 mt-3">
                <div className="flex items-center justify-between gap-2 pt-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {turmaAtual?.ranking_publico ? (
                      <Unlock className="w-3.5 h-3.5 text-success" />
                    ) : (
                      <Lock className="w-3.5 h-3.5" />
                    )}
                    Ranking p/ alunos
                  </p>
                  <Switch
                    checked={turmaAtual?.ranking_publico ?? false}
                    onCheckedChange={(v) => turmaAtualId && alternarRankingPublico(turmaAtualId, v)}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {turmaAtual?.ranking_publico
                    ? "Alunos veem o ranking completo da turma."
                    : "Alunos veem só o próprio resumo (padrão)."}
                </p>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{profile?.nome_completo}</p>
            <Badge variant={isDeveloper ? "default" : isAdmin ? "secondary" : "secondary"} className="text-[10px]">
              {isDeveloper ? "Desenvolvedor" : isAdmin ? "Administrador" : "Aluno"}
            </Badge>
          </div>
          <Trophy className="w-4 h-4 text-primary shrink-0" />
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <NavLink to="/perfil">
              <KeyRound className="w-3.5 h-3.5 mr-1" /> Senha
            </NavLink>
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={signOut}>
            <LogOut className="w-3.5 h-3.5 mr-1" /> Sair
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
