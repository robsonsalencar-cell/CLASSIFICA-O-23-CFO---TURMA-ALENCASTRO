import { useEffect, useState } from "react";
import { supabase, Profile, AppRole, extrairMensagemErroEdgeFunction } from "@/lib/supabaseClient";
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
import { Loader2, UserPlus, Users, Pencil, Save, X, KeyRound, Trash2, Hash } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useTurma } from "@/contexts/TurmaContext";

/**
 * Gera a matrícula didática no formato {ano}.{turma}{sequencial}.{curso},
 * ex: 2025.2311.1 — 2025 = ano de inclusão na APM, 23 = número da turma,
 * 11 = 11º aluno em ordem alfabética dentro da turma, 1 = código do curso
 * (CFO). Regra definida pelo usuário em 17/08/2026, baseada no padrão
 * histórico da APMCV (ex: 94.201.1 = turma pioneira de 1994).
 *
 * IMPORTANTE: essa matrícula didática (interna desta plataforma) é
 * diferente da matrícula/registro oficial do Estado — não confundir com
 * números repassados por outras turmas para fins de registro estadual.
 */
function gerarMatriculaDidatica(ano: string, numeroTurma: string, sequencial: number): string {
  const anoStr = ano.trim();
  const turmaStr = numeroTurma.trim().padStart(2, "0");
  const seqStr = String(sequencial).padStart(2, "0");
  const CODIGO_CURSO = "1"; // 1 = CFO (único curso desta plataforma até o momento)
  return `${anoStr}.${turmaStr}${seqStr}.${CODIGO_CURSO}`;
}

interface EdicaoState {
  nome_completo: string;
  email: string;
  cpf: string;
  matriculaAcademia: string;
  // Aceita qualquer papel (pra exibir/preservar o valor atual mesmo quando é
  // 'admin_institucional' ou 'desenvolvedor'), mas o <select> de edição só
  // oferece "aluno"/"admin" como opção — os outros dois só mudam pelos
  // fluxos próprios (transferir_admin_institucional, cadastro manual).
  role: AppRole;
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

  // geração automática de matrícula didática
  const [gerandoMatriculas, setGerandoMatriculas] = useState(false);
  const [numeroTurma, setNumeroTurma] = useState(() => {
    const m = turmaAtual?.nome_turma.match(/\d+/);
    return m ? m[0] : "";
  });
  useEffect(() => {
    const m = turmaAtual?.nome_turma.match(/\d+/);
    setNumeroTurma(m ? m[0] : "");
  }, [turmaAtual?.id]);

  // Alunos SEM conta no sistema (registrados em Desligamentos com
  // aluno_nome_manual, ex: a Lavínia) também entram na ordem alfabética da
  // matrícula didática — eles contam pro total de matriculados mesmo sem
  // nunca terem tido acesso ao app.
  const [desligamentosManuais, setDesligamentosManuais] = useState<
    { id: string; nome: string; matricula: string | null }[]
  >([]);
  async function carregarDesligamentosManuais() {
    if (!turmaAtualId) return;
    const { data } = await supabase
      .from("desligamentos")
      .select("id, aluno_nome_manual, matricula_academia_manual")
      .eq("turma_id", turmaAtualId)
      .is("aluno_id", null);
    setDesligamentosManuais(
      (data ?? []).map((d: any) => ({
        id: d.id,
        nome: d.aluno_nome_manual ?? "(sem nome)",
        matricula: d.matricula_academia_manual,
      }))
    );
  }
  useEffect(() => {
    carregarDesligamentosManuais();
  }, [turmaAtualId]);

  // Fim da janela de ingresso = data da reunião da Ata de Encerramento do 1º
  // Ano, cadastrada em Encerramento → Comissões. Escolhido em vez de um campo
  // manual porque é difícil de prever/preencher com antecedência — é mais
  // natural derivar dessa ata, que já vai ser registrada de qualquer forma
  // quando o 1º Ano acabar. Enquanto essa ata não existir, a janela continua
  // aberta (sem prazo).
  const [dataFimCfo1, setDataFimCfo1] = useState<string | null>(null);
  useEffect(() => {
    if (!turmaAtualId) return;
    supabase
      .from("comissoes_encerramento")
      .select("data_reuniao")
      .eq("turma_id", turmaAtualId)
      .or("referente_a.ilike.%1º ano%,referente_a.ilike.%1o ano%,referente_a.ilike.%primeiro ano%")
      .not("data_reuniao", "is", null)
      .order("data_reuniao", { ascending: true })
      .limit(1)
      .then(({ data }) => setDataFimCfo1(data?.[0]?.data_reuniao ?? null));
  }, [turmaAtualId]);

  const alunosOrdenados = profiles
    .filter((p) => p.role === "aluno")
    .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, "pt-BR"));

  const anoInclusao = turmaAtual?.ano_letivo_cfo1 || String(new Date().getFullYear());

  // Orientação da administração da APMCV (29/08/2026): só gerar matrícula
  // didática depois que as aulas realmente começam — evita ter que
  // renumerar todo mundo se a lista de matriculados ainda mudar antes do
  // primeiro dia de aula (foi exatamente o que aconteceu com a Lavínia).
  const aulasJaComecaram = Boolean(
    turmaAtual?.data_inicio_aulas && turmaAtual.data_inicio_aulas <= new Date().toISOString().slice(0, 10)
  );

  // Janela legal de ingresso (até 25% de uma matéria, por lei — ex: caso do
  // Juliano Jacinto Caminha, incluído por decisão judicial já com as aulas
  // em andamento). Enquanto aberta, um novo candidato pode entrar no MEIO
  // da ordem alfabética, então o botão recalcula a sequência inteira — é
  // seguro fazer isso ainda nessa fase porque nenhum documento oficial
  // referenciando essas matrículas foi emitido ainda. Assim que a janela
  // fecha (Ata de Encerramento do 1º Ano registrada e a data já passou),
  // volta ao modo de só preencher lacunas, sem nunca mais renumerar quem já
  // tem matrícula.
  const janelaIngressoAberta = Boolean(!dataFimCfo1 || new Date().toISOString().slice(0, 10) <= dataFimCfo1);

  const itensCombinados = [
    ...alunosOrdenados.map((p) => ({
      tipo: "perfil" as const,
      id: p.id,
      nome: p.nome_completo,
      matriculaAtual: p.matricula_academia,
    })),
    ...desligamentosManuais.map((d) => ({
      tipo: "manual" as const,
      id: d.id,
      nome: d.nome,
      matriculaAtual: d.matricula,
    })),
  ].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const previaMatriculas = janelaIngressoAberta
    ? // Fase 1 — janela de ingresso aberta: recalcula a sequência INTEIRA em
      // ordem alfabética, permitindo um candidato novo entrar no meio e
      // empurrar quem vem depois — mesmo quem já tinha número.
      itensCombinados.map((item, i) => ({
        ...item,
        matriculaNova: gerarMatriculaDidatica(anoInclusao, numeroTurma, i + 1),
      }))
    : // Fase 2 — janela fechada (ou nunca configurada): só preenche lacunas,
      // nunca renumera quem já tem matrícula (pode estar em documento
      // oficial, ex: "Registro nº" no Histórico Escolar).
      (() => {
        let proximoSequencial = itensCombinados.filter((i) => i.matriculaAtual).length;
        return itensCombinados.map((item) => {
          if (item.matriculaAtual) return { ...item, matriculaNova: item.matriculaAtual };
          proximoSequencial++;
          return { ...item, matriculaNova: gerarMatriculaDidatica(anoInclusao, numeroTurma, proximoSequencial) };
        });
      })();

  async function handleGerarMatriculas() {
    setGerandoMatriculas(true);
    let sucesso = 0;
    const falhas: { nome: string; erro: string }[] = [];

    for (const item of previaMatriculas) {
      if (item.matriculaAtual === item.matriculaNova) {
        sucesso++;
        continue;
      }
      if (item.tipo === "perfil") {
        const { data, error } = await supabase.functions.invoke("admin-update-user", {
          body: { user_id: item.id, matricula_academia: item.matriculaNova },
        });
        if (error || (data as any)?.error) {
          falhas.push({ nome: item.nome, erro: await extrairMensagemErroEdgeFunction(error, data) });
        } else {
          sucesso++;
        }
      } else {
        const { error } = await supabase
          .from("desligamentos")
          .update({ matricula_academia_manual: item.matriculaNova })
          .eq("id", item.id);
        if (error) {
          falhas.push({ nome: item.nome, erro: error.message });
        } else {
          sucesso++;
        }
      }
    }

    setGerandoMatriculas(false);
    toast({
      title: `Matrículas geradas: ${sucesso} de ${previaMatriculas.length}`,
      description:
        falhas.length > 0
          ? `Falhas: ${falhas.map((f) => `${f.nome} (${f.erro})`).join("; ")}`
          : undefined,
      variant: falhas.length > 0 ? "destructive" : undefined,
    });
    carregarPerfis();
    carregarDesligamentosManuais();
  }

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
        matricula_academia: matriculaNovo || null,
        senha_provisoria: senha,
        role,
        turma_id: turmaAtualId,
      },
    });
    setCriando(false);

    if (error || (data as any)?.error) {
      toast({
        title: "Erro ao criar usuário",
        description: await extrairMensagemErroEdgeFunction(error, data),
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
      matriculaAcademia: p.matricula_academia ?? "",
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
        matricula_academia: edicao.matriculaAcademia || null,
        role: edicao.role,
        nova_senha: edicao.nova_senha || undefined,
      },
    });

    setSalvando(false);

    if (error || (data as any)?.error) {
      toast({
        title: "Erro ao salvar alterações",
        description: await extrairMensagemErroEdgeFunction(error, data),
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
        description: await extrairMensagemErroEdgeFunction(error, data),
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
              <Label>Matrícula Acadêmica (opcional)</Label>
              <Input value={matriculaNovo} onChange={(e) => setMatriculaNovo(e.target.value)} placeholder="ex: 2025.2301.1" />
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
          {turmaAtual?.finalizada && (
            <p className="text-xs text-muted-foreground mb-2">
              🔒 Turma marcada como encerrada — geração automática de matrículas desativada pra
              preservar os números já registrados em documentos oficiais.
            </p>
          )}
          {!turmaAtual?.finalizada && !aulasJaComecaram && (
            <p className="text-xs text-muted-foreground mb-2">
              🔒 Geração automática de matrícula travada até o início das aulas
              {turmaAtual?.data_inicio_aulas
                ? ` (${new Date(turmaAtual.data_inicio_aulas + "T00:00:00").toLocaleDateString("pt-BR")})`
                : " — configure a data em Personalização"}
              . Orientação da administração da APMCV: evita renumerar todo mundo se a lista de
              matriculados ainda mudar antes do primeiro dia de aula.
            </p>
          )}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Usuários cadastrados ({profiles.length}) {turmaAtual && <span className="text-muted-foreground font-normal text-sm">— {turmaAtual.nome_turma}</span>}
            </CardTitle>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={itensCombinados.length === 0 || turmaAtual?.finalizada || !aulasJaComecaram}
                  title={
                    turmaAtual?.finalizada
                      ? "Turma marcada como encerrada — matrículas já atribuídas não são mais alteradas."
                      : !aulasJaComecaram
                      ? "Travado até o início das aulas (configurável em Personalização)."
                      : undefined
                  }
                >
                  <Hash className="w-4 h-4 mr-2" />
                  Gerar matrículas automaticamente
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Gerar matrículas didáticas para {itensCombinados.length} aluno(s)?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3 text-sm">
                      <p>
                        Formato: <strong>ano.turma+sequencial.curso</strong> (ex: 2025.2311.1 = ano 2025, turma
                        23, 11º aluno em ordem alfabética, curso CFO).{" "}
                        {janelaIngressoAberta ? (
                          <>
                            <strong>Janela de ingresso aberta</strong>
                            {dataFimCfo1
                              ? ` (até ${new Date(dataFimCfo1 + "T00:00:00").toLocaleDateString("pt-BR")}, data da Ata de Encerramento do 1º Ano)`
                              : " (sem prazo definido ainda — registre a Ata de Encerramento do 1º Ano em Encerramento → Comissões quando o 1º Ano acabar)"}
                            : recalcula a sequência inteira em ordem alfabética — quem já tinha número pode
                            mudar, se alguém novo entrar no meio (ex: por decisão judicial).
                          </>
                        ) : (
                          <>
                            Janela de ingresso fechada: só gera matrícula para quem ainda não tem — quem já
                            tem número atribuído nunca é sobrescrito.
                          </>
                        )}
                      </p>
                      <div className="grid grid-cols-2 gap-x-3 items-center">
                        <Label className="text-xs">Ano de inclusão (APM)</Label>
                        <Input className="h-8" value={anoInclusao} disabled />
                        <Label className="text-xs">Número da turma</Label>
                        <Input
                          className="h-8"
                          value={numeroTurma}
                          onChange={(e) => setNumeroTurma(e.target.value)}
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Aluno</TableHead>
                              <TableHead>Matrícula atual</TableHead>
                              <TableHead>Nova matrícula</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previaMatriculas.map((item) => (
                              <TableRow key={`${item.tipo}-${item.id}`}>
                                <TableCell className="text-xs">
                                  {item.nome}
                                  {item.tipo === "manual" && (
                                    <span className="text-muted-foreground"> (sem conta no sistema)</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {item.matriculaAtual ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs font-medium">{item.matriculaNova}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleGerarMatriculas} disabled={gerandoMatriculas}>
                    {gerandoMatriculas && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Confirmar e gerar {previaMatriculas.length} matrículas
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
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
                    <TableHead>Matrícula Acadêmica</TableHead>
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
                                value={edicao.matriculaAcademia}
                                onChange={(e) => setEdicao({ ...edicao, matriculaAcademia: e.target.value })}
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
                            <TableCell>{p.matricula_academia ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant={p.role === "aluno" ? "secondary" : "default"}>
                                {p.role === "desenvolvedor"
                                  ? "Desenvolvedor"
                                  : p.role === "admin_institucional"
                                  ? "Admin institucional"
                                  : p.role === "admin"
                                  ? "Administrador"
                                  : "Aluno"}
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
