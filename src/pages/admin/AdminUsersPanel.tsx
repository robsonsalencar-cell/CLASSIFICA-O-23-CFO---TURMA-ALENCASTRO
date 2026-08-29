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

/**
 * E-mails pessoais dos cadetes da 23ª turma, extraídos da planilha de
 * coleta enviada pelo usuário em 19/08/2026. Os e-mails institucionais
 * cadastrados anteriormente eram fictícios/gerados automaticamente — o
 * usuário confirmou explicitamente a troca pra estes, que passam a ser o
 * e-mail de LOGIN de cada aluno (não é só um dado de contato).
 *
 * Isso é um dado de importação pontual (não deve ser reaproveitado em
 * turmas futuras) — cada nova turma precisará de sua própria lista.
 */
const EMAILS_PLANILHA_23CFO: { nome: string; email: string }[] = [
  { nome: "ALINE APARECIDA ROSA", email: "alinerosa.adv@gmail.com" },
  { nome: "ANDRE BARONI OLIVEIRA", email: "andreb_ci@hotmail.com" },
  { nome: "BRUNA LAÍS EVANGELISTA DA SILVA RIBEIRO", email: "brunaribeiro67@gmail.com" },
  { nome: "CAISSON GRAZIANNI ALBUQUERQUE GUIMARÃES", email: "caisson.guimaraescfo@gmail.com" },
  { nome: "DELVI PÉRICLES SOUZA GOMES JÚNIOR", email: "djunior.no.vin158@gmail.com" },
  { nome: "DIEGO CESAR BARBOSA ARAUJO", email: "01cbcesar@gmail.com" },
  { nome: "EDSON GARCIA MOREIRA DA SILVA", email: "garciasikii@gmail.com" },
  { nome: "EDUARDO ROBERTO LOPES FILHO", email: "edu_rlopes@hotmail.com" },
  { nome: "FELLIPE RAFAEL SANTOS DE SOUZA", email: "rafaelfellipe261@gmail.com" },
  { nome: "GERNAIAN RODRIGUES DA SILVA", email: "gernaiansilva@pm.mt.gov.br" },
  { nome: "GIDEONI PEREIRA DA SILVA", email: "contatogideoni@gmail.com" },
  { nome: "GRACIELLE DE SIQUEIRA CARVALHO", email: "graciellesiqueira@hotmail.com" },
  { nome: "JAMILE ROBER DOS SANTOS FLEURY FERREIRA", email: "jamilefleury32@gmail.com" },
  { nome: "JHONATHAN ANTUNES PAULUK", email: "jhonathansnp@hotmail.com" },
  { nome: "JOILSON SANTOS DE MORAES", email: "joilsoncamos@gmail.com" },
  { nome: "JULIANO DO VAL PETRY FREITAS", email: "julianofreitas@pm.mt.gov.br" },
  { nome: "JULIANO JACINTO CAMINHA", email: "juliano_jcamin@outlook.com" },
  { nome: "LAURIANE SIMONINI", email: "lauri_simonini@hotmail.com" },
  { nome: "LUCAS CARVALHO SILVA", email: "lucascs96.lc@gmail.com" },
  { nome: "LUIZ HENRIQUE ACKERMANN", email: "ackermannluizhenrique@gmail.com" },
  { nome: "MOYSES FERREIRA DE CARVALHO", email: "moysesdecarvalho@hotmail.com" },
  { nome: "ODEZIO BORGE DE CARVALHO", email: "odezioborges1128@hotmail.com" },
  { nome: "PETRUS ANDREY GUIMARAES GARCIA", email: "petrusggarcia@gmail.com" },
  { nome: "PUBLIO FERREIRA MORENO", email: "publio.moreno@hotmail.com" },
  { nome: "RAPHAEL ROCHA XAVIER", email: "raphaelxavierrocha@gmail.com" },
  { nome: "ROBSON DOS SANTOS ALENCAR", email: "ROBSONSALENCAR@GMAIL.COM" },
  { nome: "VINICIUS ANTÔNIO OLIVEIRA DA SILVA", email: "vinicius.antonio95@hotmail.com" },
  { nome: "WENDER DA SILVA FIGUEIREDO", email: "wenderfigueiredo.pmmt@gmail.com" },
];

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

  // Quantidade de alunos SEM conta no sistema (cadastrados em Desligamentos
  // com aluno_nome_manual) que já têm matrícula didática atribuída — conta
  // pra reservar o lugar deles na sequência, senão o gerador poderia
  // reutilizar por engano um número já dado a alguém como a Lavínia
  // (registrada em Desligamentos, não em profiles).
  const [qtdMatriculasManuais, setQtdMatriculasManuais] = useState(0);
  useEffect(() => {
    if (!turmaAtualId) return;
    supabase
      .from("desligamentos")
      .select("id", { count: "exact", head: true })
      .eq("turma_id", turmaAtualId)
      .not("matricula_academia_manual", "is", null)
      .then(({ count }) => setQtdMatriculasManuais(count ?? 0));
  }, [turmaAtualId]);

  const alunosOrdenados = profiles
    .filter((p) => p.role === "aluno")
    .sort((a, b) => a.nome_completo.localeCompare(b.nome_completo, "pt-BR"));

  const anoInclusao = turmaAtual?.ano_letivo_cfo1 || String(new Date().getFullYear());

  // Matrícula já atribuída NUNCA é recalculada/sobrescrita — mesmo que a
  // turma perca gente por desligamento, ou a ordem alfabética mude por
  // qualquer outro motivo, o número de quem já tem continua valendo pra
  // sempre (já pode estar registrado em documento oficial, ex: "Registro
  // nº" no Histórico Escolar). Só quem ainda não tem matrícula recebe um
  // número novo, continuando a sequência depois do maior número já usado —
  // ninguém que já tem número é renumerado. A contagem inicial também
  // reserva o(s) número(s) já usados por gente sem conta no sistema (ver
  // qtdMatriculasManuais acima).
  // Além disso, com a turma marcada como encerrada (turmas.finalizada), o
  // botão fica bloqueado por completo — ver disabled no AlertDialogTrigger.
  const qtdJaNumerados = alunosOrdenados.filter((p) => p.matricula_academia).length + qtdMatriculasManuais;
  let proximoSequencial = qtdJaNumerados;
  const previaMatriculas = alunosOrdenados.map((p) => {
    if (p.matricula_academia) {
      return {
        id: p.id,
        nome: p.nome_completo,
        matriculaAtual: p.matricula_academia,
        matriculaNova: p.matricula_academia,
      };
    }
    proximoSequencial++;
    return {
      id: p.id,
      nome: p.nome_completo,
      matriculaAtual: p.matricula_academia,
      matriculaNova: gerarMatriculaDidatica(anoInclusao, numeroTurma, proximoSequencial),
    };
  });

  async function handleGerarMatriculas() {
    setGerandoMatriculas(true);
    let sucesso = 0;
    const falhas: { nome: string; erro: string }[] = [];

    for (const item of previaMatriculas) {
      if (item.matriculaAtual === item.matriculaNova) {
        sucesso++;
        continue;
      }
      const { data, error } = await supabase.functions.invoke("admin-update-user", {
        body: { user_id: item.id, matricula_academia: item.matriculaNova },
      });
      if (error || (data as any)?.error) {
        falhas.push({ nome: item.nome, erro: await extrairMensagemErroEdgeFunction(error, data) });
      } else {
        sucesso++;
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
  }

  // atualização em lote de e-mails de login (planilha da 23ª turma)
  const [atualizandoEmails, setAtualizandoEmails] = useState(false);
  const previaEmails = EMAILS_PLANILHA_23CFO.map((item) => {
    const perfil = profiles.find((p) => p.nome_completo.toUpperCase() === item.nome.toUpperCase());
    return {
      id: perfil?.id ?? null,
      nome: item.nome,
      emailAtual: perfil?.email ?? null,
      emailNovo: item.email,
      encontrado: Boolean(perfil),
      jaEsta: perfil?.email?.toLowerCase() === item.email.toLowerCase(),
    };
  });
  const previaEmailsPendentes = previaEmails.filter((i) => i.encontrado && !i.jaEsta);
  const previaEmailsNaoEncontrados = previaEmails.filter((i) => !i.encontrado);

  async function handleAtualizarEmails() {
    setAtualizandoEmails(true);
    let sucesso = 0;
    const falhas: { nome: string; erro: string }[] = [];

    for (const item of previaEmailsPendentes) {
      const { data, error } = await supabase.functions.invoke("admin-update-user", {
        body: { user_id: item.id, email: item.emailNovo, nova_senha: "12345678" },
      });
      if (error || (data as any)?.error) {
        falhas.push({ nome: item.nome, erro: await extrairMensagemErroEdgeFunction(error, data) });
      } else {
        sucesso++;
      }
    }

    setAtualizandoEmails(false);
    toast({
      title: `E-mails atualizados: ${sucesso} de ${previaEmailsPendentes.length}`,
      description:
        falhas.length > 0
          ? `Falhas: ${falhas.map((f) => `${f.nome} (${f.erro})`).join("; ")}`
          : undefined,
      variant: falhas.length > 0 ? "destructive" : undefined,
    });
    carregarPerfis();
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
                  disabled={alunosOrdenados.length === 0 || turmaAtual?.finalizada}
                  title={
                    turmaAtual?.finalizada
                      ? "Turma marcada como encerrada — matrículas já atribuídas não são mais alteradas."
                      : undefined
                  }
                >
                  <Hash className="w-4 h-4 mr-2" />
                  Gerar matrículas automaticamente
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Gerar matrículas didáticas para {alunosOrdenados.length} aluno(s)?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3 text-sm">
                      <p>
                        Formato: <strong>ano.turma+sequencial.curso</strong> (ex: 2025.2311.1 = ano 2025, turma
                        23, 11º aluno em ordem alfabética, curso CFO). Só gera matrícula para quem ainda
                        não tem — quem já tem número atribuído nunca é sobrescrito, mesmo que a ordem
                        alfabética mude ou alguém se desligue.
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
                              <TableRow key={item.id}>
                                <TableCell className="text-xs">{item.nome}</TableCell>
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
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={previaEmailsPendentes.length === 0}>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Atualizar e-mails (planilha 23º CFO)
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="max-w-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Trocar o e-mail de LOGIN de {previaEmailsPendentes.length} aluno(s)?
                  </AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3 text-sm">
                      <p>
                        Isso troca o e-mail de acesso (login) de cada aluno pro e-mail pessoal
                        informado na planilha da 23ª turma — não é só um dado de contato. Também
                        redefine a senha de todos pra <strong>12345678</strong> (senha inicial
                        padrão, pra primeiro login). Depois dessa mudança, o aluno precisa usar o
                        e-mail novo e essa senha pra entrar.
                      </p>
                      <p className="text-destructive font-medium">
                        Esta é a última vez que este botão deve ser usado — depois de confirmar,
                        ele será removido do painel.
                      </p>
                      <div className="max-h-64 overflow-y-auto border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Aluno</TableHead>
                              <TableHead>E-mail atual (login)</TableHead>
                              <TableHead>Novo e-mail</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previaEmailsPendentes.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="text-xs">{item.nome}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {item.emailAtual ?? "—"}
                                </TableCell>
                                <TableCell className="text-xs font-medium">{item.emailNovo}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      {previaEmailsNaoEncontrados.length > 0 && (
                        <p className="text-xs text-destructive">
                          Não encontrados no cadastro (nome não bateu exatamente):{" "}
                          {previaEmailsNaoEncontrados.map((i) => i.nome).join(", ")}
                        </p>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleAtualizarEmails} disabled={atualizandoEmails}>
                    {atualizandoEmails && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Confirmar e trocar {previaEmailsPendentes.length} e-mails
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
