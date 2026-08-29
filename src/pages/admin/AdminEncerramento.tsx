import { useEffect, useState } from "react";
import { supabase, Profile } from "@/lib/supabaseClient";
import { useTurma } from "@/contexts/TurmaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, UserMinus, FileSignature, Plus, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Desligamento {
  id: string;
  aluno_id: string;
  modulo: string;
  data_desligamento: string;
  numero_processo: string | null;
  motivo: string | null;
  aluno_nome?: string;
}

interface MembroForm {
  nome: string;
  posto_graduacao: string;
  papel: "Presidente" | "Secretário" | "Membro";
}

interface Comissao {
  id: string;
  referente_a: string;
  portaria_numero: string;
  portaria_data: string;
  bcg_numero: string | null;
  bcg_data: string | null;
  data_reuniao: string | null;
  membros: { nome: string; posto_graduacao: string; papel: string; ordem: number }[];
}

const MODULOS = [
  { value: "cfo1", label: "CFO I" },
  { value: "cfo2", label: "CFO II" },
  { value: "cfo3", label: "CFO III" },
];

export function AdminEncerramento() {
  const { turmaAtualId } = useTurma();
  const [alunos, setAlunos] = useState<Pick<Profile, "id" | "nome_completo">[]>([]);
  const [desligamentos, setDesligamentos] = useState<Desligamento[]>([]);
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [loading, setLoading] = useState(true);

  async function carregarTudo() {
    if (!turmaAtualId) return;
    setLoading(true);

    const [{ data: perfis }, { data: desl }, { data: coms }] = await Promise.all([
      supabase.from("profiles").select("id, nome_completo").eq("turma_id", turmaAtualId).order("nome_completo"),
      supabase
        .from("desligamentos")
        .select("id, aluno_id, modulo, data_desligamento, numero_processo, motivo, profiles(nome_completo)")
        .eq("turma_id", turmaAtualId)
        .order("data_desligamento"),
      supabase
        .from("comissoes_encerramento")
        .select("id, referente_a, portaria_numero, portaria_data, bcg_numero, bcg_data, data_reuniao, membros_comissao(nome, posto_graduacao, papel, ordem)")
        .eq("turma_id", turmaAtualId)
        .order("criado_em", { ascending: false }),
    ]);

    setAlunos(perfis ?? []);
    setDesligamentos(
      (desl ?? []).map((d: any) => ({ ...d, aluno_nome: d.profiles?.nome_completo }))
    );
    setComissoes(
      (coms ?? []).map((c: any) => ({
        ...c,
        membros: (c.membros_comissao ?? []).sort((a: any, b: any) => a.ordem - b.ordem),
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    carregarTudo();
  }, [turmaAtualId]);

  return (
    <div className="space-y-6">
      <DesligamentosCard
        alunos={alunos}
        desligamentos={desligamentos}
        loading={loading}
        turmaAtualId={turmaAtualId}
        onChange={carregarTudo}
      />
      <ComissoesCard comissoes={comissoes} loading={loading} turmaAtualId={turmaAtualId} onChange={carregarTudo} />
    </div>
  );
}

function DesligamentosCard({
  alunos,
  desligamentos,
  loading,
  turmaAtualId,
  onChange,
}: {
  alunos: Pick<Profile, "id" | "nome_completo">[];
  desligamentos: Desligamento[];
  loading: boolean;
  turmaAtualId: string | null;
  onChange: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [alunoId, setAlunoId] = useState("");
  const [modulo, setModulo] = useState("");
  const [data, setData] = useState("");
  const [processo, setProcesso] = useState("");
  const [motivo, setMotivo] = useState("");

  function resetar() {
    setAlunoId("");
    setModulo("");
    setData("");
    setProcesso("");
    setMotivo("");
  }

  async function handleSalvar() {
    if (!turmaAtualId || !alunoId || !modulo || !data) {
      toast({ title: "Preencha aluno, módulo e data", variant: "destructive" });
      return;
    }
    setSalvando(true);
    const { error } = await supabase.from("desligamentos").insert({
      aluno_id: alunoId,
      turma_id: turmaAtualId,
      modulo,
      data_desligamento: data,
      numero_processo: processo || null,
      motivo: motivo || null,
    });
    setSalvando(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Desligamento registrado" });
    resetar();
    setAberto(false);
    onChange();
  }

  async function handleExcluir(id: string) {
    const { error } = await supabase.from("desligamentos").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    onChange();
  }

  const alunosDisponiveis = alunos.filter((a) => !desligamentos.some((d) => d.aluno_id === a.id));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <UserMinus className="w-5 h-5 text-destructive" />
            Desligamentos ({desligamentos.length})
          </CardTitle>
          <Dialog open={aberto} onOpenChange={setAberto}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Registrar desligamento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar desligamento de aluno</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Aluno</Label>
                  <Select value={alunoId} onValueChange={setAlunoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o aluno" />
                    </SelectTrigger>
                    <SelectContent>
                      {alunosDisponiveis.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.nome_completo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Módulo em curso no momento do desligamento</Label>
                  <Select value={modulo} onValueChange={setModulo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o módulo" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODULOS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Data do desligamento</Label>
                  <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Número do processo (SIGADOC/PM-PRO — opcional, pode completar depois)</Label>
                  <Input
                    value={processo}
                    onChange={(e) => setProcesso(e.target.value)}
                    placeholder="ex: PM-PRO-2026/05150"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Motivo (opcional)</Label>
                  <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSalvar} disabled={salvando}>
                  {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : desligamentos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum desligamento registrado nesta turma.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead className="w-16 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {desligamentos.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.aluno_nome}</TableCell>
                  <TableCell>{MODULOS.find((m) => m.value === d.modulo)?.label ?? d.modulo}</TableCell>
                  <TableCell>{new Date(d.data_desligamento + "T00:00:00").toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>{d.numero_processo ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleExcluir(d.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ComissoesCard({
  comissoes,
  loading,
  turmaAtualId,
  onChange,
}: {
  comissoes: Comissao[];
  loading: boolean;
  turmaAtualId: string | null;
  onChange: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [referenteA, setReferenteA] = useState("");
  const [portariaNumero, setPortariaNumero] = useState("");
  const [portariaData, setPortariaData] = useState("");
  const [bcgNumero, setBcgNumero] = useState("");
  const [bcgData, setBcgData] = useState("");
  const [dataReuniao, setDataReuniao] = useState("");
  const [membros, setMembros] = useState<MembroForm[]>([
    { nome: "", posto_graduacao: "", papel: "Presidente" },
  ]);

  function resetar() {
    setReferenteA("");
    setPortariaNumero("");
    setPortariaData("");
    setBcgNumero("");
    setBcgData("");
    setDataReuniao("");
    setMembros([{ nome: "", posto_graduacao: "", papel: "Presidente" }]);
  }

  function atualizarMembro(i: number, campo: keyof MembroForm, valor: string) {
    setMembros((prev) => prev.map((m, idx) => (idx === i ? { ...m, [campo]: valor } : m)));
  }

  async function handleSalvar() {
    if (!turmaAtualId || !referenteA || !portariaNumero || !portariaData) {
      toast({ title: "Preencha referente a, número e data da portaria", variant: "destructive" });
      return;
    }
    setSalvando(true);
    const { data: comissao, error } = await supabase
      .from("comissoes_encerramento")
      .insert({
        turma_id: turmaAtualId,
        referente_a: referenteA,
        portaria_numero: portariaNumero,
        portaria_data: portariaData,
        bcg_numero: bcgNumero || null,
        bcg_data: bcgData || null,
        data_reuniao: dataReuniao || null,
      })
      .select("id")
      .single();

    if (error || !comissao) {
      setSalvando(false);
      toast({ title: "Erro ao salvar comissão", description: error?.message, variant: "destructive" });
      return;
    }

    const membrosValidos = membros.filter((m) => m.nome && m.posto_graduacao);
    if (membrosValidos.length > 0) {
      const { error: erroMembros } = await supabase.from("membros_comissao").insert(
        membrosValidos.map((m, i) => ({
          comissao_id: comissao.id,
          nome: m.nome,
          posto_graduacao: m.posto_graduacao,
          papel: m.papel,
          ordem: i,
        }))
      );
      if (erroMembros) {
        toast({ title: "Comissão salva, mas houve erro nos membros", description: erroMembros.message, variant: "destructive" });
      }
    }

    setSalvando(false);
    toast({ title: "Comissão registrada" });
    resetar();
    setAberto(false);
    onChange();
  }

  async function handleExcluir(id: string) {
    const { error } = await supabase.from("comissoes_encerramento").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    onChange();
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-primary" />
            Comissões de Encerramento ({comissoes.length})
          </CardTitle>
          <Dialog open={aberto} onOpenChange={setAberto}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Registrar comissão
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Registrar comissão de encerramento</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                <div className="space-y-1">
                  <Label>Referente a</Label>
                  <Input
                    value={referenteA}
                    onChange={(e) => setReferenteA(e.target.value)}
                    placeholder="ex: Ata de Encerramento do 3º Ano"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Nº da Portaria</Label>
                    <Input
                      value={portariaNumero}
                      onChange={(e) => setPortariaNumero(e.target.value)}
                      placeholder="ex: 010/APM/2026"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Data da Portaria</Label>
                    <Input type="date" value={portariaData} onChange={(e) => setPortariaData(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Nº do BCG (opcional)</Label>
                    <Input value={bcgNumero} onChange={(e) => setBcgNumero(e.target.value)} placeholder="ex: 3906" />
                  </div>
                  <div className="space-y-1">
                    <Label>Data do BCG</Label>
                    <Input type="date" value={bcgData} onChange={(e) => setBcgData(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Data da reunião de encerramento (opcional, pode completar depois)</Label>
                  <Input type="date" value={dataReuniao} onChange={(e) => setDataReuniao(e.target.value)} />
                </div>

                <div className="space-y-2">
                  <Label>Membros da comissão</Label>
                  {membros.map((m, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                      <Input
                        placeholder="Nome"
                        value={m.nome}
                        onChange={(e) => atualizarMembro(i, "nome", e.target.value)}
                      />
                      <Input
                        placeholder="Posto (ex: Maj PM)"
                        value={m.posto_graduacao}
                        onChange={(e) => atualizarMembro(i, "posto_graduacao", e.target.value)}
                      />
                      <Select value={m.papel} onValueChange={(v) => atualizarMembro(i, "papel", v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Presidente">Presidente</SelectItem>
                          <SelectItem value="Secretário">Secretário</SelectItem>
                          <SelectItem value="Membro">Membro</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setMembros((prev) => prev.filter((_, idx) => idx !== i))}
                        disabled={membros.length === 1}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMembros((prev) => [...prev, { nome: "", posto_graduacao: "", papel: "Membro" }])}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar membro
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleSalvar} disabled={salvando}>
                  {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : comissoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma comissão registrada nesta turma.</p>
        ) : (
          <div className="space-y-4">
            {comissoes.map((c) => (
              <div key={c.id} className="border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{c.referente_a}</p>
                    <p className="text-xs text-muted-foreground">
                      Portaria nº {c.portaria_numero}, de {new Date(c.portaria_data + "T00:00:00").toLocaleDateString("pt-BR")}
                      {c.bcg_numero && ` — BCG nº ${c.bcg_numero}`}
                      {c.data_reuniao && ` — Reunião em ${new Date(c.data_reuniao + "T00:00:00").toLocaleDateString("pt-BR")}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleExcluir(c.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                {c.membros.length > 0 && (
                  <ul className="text-sm space-y-0.5">
                    {c.membros.map((m, i) => (
                      <li key={i}>
                        {m.nome} — {m.posto_graduacao} ({m.papel})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
