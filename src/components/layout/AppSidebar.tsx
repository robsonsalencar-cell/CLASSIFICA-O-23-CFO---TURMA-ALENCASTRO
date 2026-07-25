import { NavLink } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
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
import { LayoutDashboard, ShieldCheck, Trophy, KeyRound, LogOut, Eye } from "lucide-react";

const modulos = [
  { to: "/cfo1", label: "CFO I", cor: "hsl(210,90%,65%)" },
  { to: "/cfo2", label: "CFO II", cor: "hsl(140,70%,50%)" },
  { to: "/cfo3", label: "CFO III", cor: "hsl(43,96%,56%)" },
  { to: "/", label: "Classificação Geral", cor: "hsl(43,96%,56%)" },
];

export function AppSidebar() {
  const { profile, isAdmin, viewingAsAlunoId, setViewingAsAlunoId, signOut } = useAuth();
  const [alunos, setAlunos] = useState<{ id: string; nome_completo: string }[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("profiles")
      .select("id, nome_completo")
      .eq("role", "aluno")
      .order("nome_completo")
      .then(({ data }) => setAlunos(data ?? []));
  }, [isAdmin]);

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <img src="/lovable-uploads/brasao-novo.png" alt="Brasão 23º CFO" className="w-9 h-9 object-contain" />
          <div>
            <p className="text-sm font-bold uppercase tracking-wide text-foreground">23º CFO</p>
            <p className="text-xs text-muted-foreground">Turma Alencastro</p>
          </div>
        </div>
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
                        isActive ? "font-semibold text-primary" : "text-foreground/80"
                      }
                    >
                      <LayoutDashboard className="w-4 h-4" style={{ color: m.cor }} />
                      <span>{m.label}</span>
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
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{profile?.nome_completo}</p>
            <Badge variant={isAdmin ? "default" : "secondary"} className="text-[10px]">
              {isAdmin ? "Administrador" : "Aluno"}
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
