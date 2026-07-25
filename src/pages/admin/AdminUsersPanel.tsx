import { useEffect, useState } from "react";
import { supabase, Profile } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserPlus, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function AdminUsersPanel() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<"aluno" | "admin">("aluno");
  const [criando, setCriando] = useState(false);

  async function carregarPerfis() {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("nome_completo");
    setProfiles(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    carregarPerfis();
  }, []);

  function gerarSenhaProvisoria() {
    const s = Math.random().toString(36).slice(-8) + "A1!";
    setSenha(s);
  }

  async function handleCriarUsuario() {
    if (!nome || !email || !senha) {
      toast({ title: "Preencha nome, e-mail e senha provisória", variant: "destructive" });
      return;
    }
    setCriando(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: {
        nome_completo: nome,
        email,
        cpf: cpf || null,
        senha_provisoria: senha,
        role,
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
    setSenha("");
    setRole("aluno");
    carregarPerfis();
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Cadastrar novo aluno
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
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
            <div className="md:col-span-5 flex justify-end">
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
            Usuários cadastrados ({profiles.length})
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
                    <TableHead>Perfil</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.nome_completo}</TableCell>
                      <TableCell>{p.email}</TableCell>
                      <TableCell>{p.cpf ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={p.role === "admin" ? "default" : "secondary"}>
                          {p.role === "admin" ? "Administrador" : "Aluno"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
