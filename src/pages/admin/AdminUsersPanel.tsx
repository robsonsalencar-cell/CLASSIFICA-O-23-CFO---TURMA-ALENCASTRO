import { useEffect, useState } from "react";
import { supabase, Profile } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, Users, Pencil, Save, X, KeyRound, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTurma } from "@/contexts/TurmaContext";

interface EdicaoState {
  nome_completo: string;
  email: string;
  cpf: string;
  matricula: string;
  role: "aluno" | "admin" | "desenvolvedor";
  nova_senha: string;
}

export function AdminUsersPanel() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const { turmaAtualId, turmaAtual } = useTurma();

  // formulário de cadastro
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [matriculaNovo, setMatriculaNovo] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<"aluno" | "admin">("aluno");
  const [criando, setCriando] = useState(false);

  // edição inline
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<EdicaoState | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  async function carregarPerfis() {
    if (!turmaAtualId) return;
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("turma_id", turmaAtualId)
      .order("nome_completo");
    setProfiles(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    carregarPerfis();
  }, [turmaAtualId]);

  function gerarSenhaProvisoria() {
    const s = Math.random().toString(36).slice(-8) + "A1!";
    setSenha(s);
  }

  async function handleCriarUsuario() {
    if (!nome || !email || !senha) {
      toast({ title: "Preencha nome, e-mail e senha provisória", variant: "destructive" });
      return;
    }
    if (!turmaAtualId) {
      toast({ title: "Nenhuma turma selecionada", variant: "destructive" });
      return;
    }
    setCriando(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: {
        nome_completo: nome,
        email,
        cpf: cpf || null,
        matricula: matriculaNovo || null,
        senha_provisoria: senha,
        role,
        turma_id: turmaAtualId,
      },
    });
    setCriando(false);

    if (error || (data as any)?.error) {
      toast({
        title: "Erro ao criar usuário",
        description: (data as any)?.error ?? error?.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Aluno cadastrado com sucesso", description: `Senha provisória: ${senha}` });
    setNome("");
    setEmail("");
    setCpf("");
    setMatriculaNovo("");
    setSenha("");
    setRole("aluno");
    carregarPerfis();
  }

  function iniciarEdicao(p: Profile) {
    setEditandoId(p.id);
    setEdicao({
      nome_completo: p.nome_completo,
      email: p.email,
      cpf: p.cpf ?? "",
      matricula: p.matricula ?? "",
      role: p.role,
      nova_senha: "",
    });
  }

  function cancelarEdicao() {
    setEditandoId(null);
    setEdicao(null);
  }

  async function salvarEdicao(userId: string) {
    if (!edicao) return;
    setSalvando(true);

    const { data, error } = await supabase.functions.invoke("admin-update-user", {
      body: {
        user_id: userId,
        nome_completo: edicao.nome_completo,
        email: edicao.email,
        cpf: edicao.cpf || null,
        matricula: edicao.matricula || null,
        role: edicao.role,
        nova_senha: edicao.nova_senha || undefined,
      },
    });

    setSalvando(false);

    if (error || (data as any)?.error) {
      toast({
        title: "Erro ao salvar alterações",
        description: (data as any)?.error ?? error?.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Dados atualizados com sucesso" });
    cancelarEdicao();
    carregarPerfis();
  }

  async function handleExcluirUsuario(userId: string) {
    setExcluindoId(userId);
    const { data, error } = await supabase.functions.invoke("admin-delete-user", {
      body: { user_id: userId },
    });
    setExcluindoId(null);

    if (error || (data as any)?.error) {
      toast({
        title: "Erro ao excluir usuário",
        description: (data as any)?.error ?? error?.message,
        variant: "destructive",
      });
      return;
    }

    toast({ title: "Usuário excluído com sucesso" });
    carregarPerfis();
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Cadastrar novo aluno {turmaAtual && <span className="text-muted-foreground font-normal text-sm">— {turmaAtual.nome_turma}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div className="space-y-1">
              <Label>Nome completo</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Cad PM Fulano" />
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="fulano@exemplo.com" />
            </div>
            <div className="space-y-1">
              <Label>CPF (opcional)</Label>
              <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1">
              <Label>Matrícula (opcional)</Label>
              <Input value={matriculaNovo} onChange={(e) => setMatriculaNovo(e.target.value)} placeholder="ex: 23.0001.1" />
            </div>
            <div className="space-y-1">
              <Label>Senha provisória</Label>
              <div className="flex gap-1">
                <Input value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="mínimo 8 caracteres" />
                <Button type="button" variant="outline" size="sm" onClick={gerarSenhaProvisoria}>
                  Gerar
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Perfil</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value as "aluno" | "admin")}
              >
                <option value="aluno">Aluno</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div className="md:col-span-6 flex justify-end">
              <Button onClick={handleCriarUsuario} disabled={criando}>
                {criando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Cadastrar aluno
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            O aluno poderá trocar essa senha a qualquer momento pelo próprio perfil, ou usando
            "Esqueci minha senha" na tela de login.
          </p>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Usuários cadastrados ({profiles.length}) {turmaAtual && <span className="text-muted-foreground font-normal text-sm">— {turmaAtual.nome_turma}</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead className="w-32 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => {
                    const emEdicao = editandoId === p.id;
                    return (
                      <TableRow key={p.id}>
                        {emEdicao && edicao ? (
                          <>
                            <TableCell>
                              <Input
                                className="h-8"
                                value={edicao.nome_completo}
                                onChange={(e) => setEdicao({ ...edicao, nome_completo: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8"
                                type="email"
                                value={edicao.email}
                                onChange={(e) => setEdicao({ ...edicao, email: e.target.value })}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8"
                                value={edicao.cpf}
                                onChange={(e) => setEdicao({ ...edicao, cpf: e.target.value })}
                                placeholder="—"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8"
                                value={edicao.matricula}
                                onChange={(e) => setEdicao({ ...edicao, matricula: e.target.value })}
                                placeholder="—"
                              />
                            </TableCell>
                            <TableCell>
                              <select
                                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                                value={edicao.role}
                                onChange={(e) => setEdicao({ ...edicao, role: e.target.value as "aluno" | "admin" })}
                              >
                                <option value="aluno">Aluno</option>
                                <option value="admin">Administrador</option>
                              </select>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-col gap-1 items-end">
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" onClick={() => salvarEdicao(p.id)} disabled={salvando} title="Salvar">
                                    {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-success" />}
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={cancelarEdicao} title="Cancelar">
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                                <div className="flex items-center gap-1">
                                  <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                                  <Input
                                    className="h-7 w-32 text-xs"
                                    placeholder="Nova senha"
                                    value={edicao.nova_senha}
                                    onChange={(e) => setEdicao({ ...edicao, nova_senha: e.target.value })}
                                  />
                                </div>
                              </div>
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell className="font-medium">{p.nome_completo}</TableCell>
                            <TableCell>{p.email}</TableCell>
                            <TableCell>{p.cpf ?? "—"}</TableCell>
                            <TableCell>{p.matricula ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant={p.role === "aluno" ? "secondary" : "default"}>
                                {p.role === "desenvolvedor" ? "Desenvolvedor" : p.role === "admin" ? "Administrador" : "Aluno"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button size="icon" variant="ghost" onClick={() => iniciarEdicao(p)} title="Editar">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    title="Excluir"
                                    disabled={excluindoId === p.id}
                                  >
                                    {excluindoId === p.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Excluir {p.nome_completo}?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Essa ação é permanente: a conta de login e todas as notas
                                      lançadas para este aluno em todos os módulos (CFO I, II, III e
                                      Classificação Geral) serão apagadas. Não é possível desfazer.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleExcluirUsuario(p.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Sim, excluir
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
