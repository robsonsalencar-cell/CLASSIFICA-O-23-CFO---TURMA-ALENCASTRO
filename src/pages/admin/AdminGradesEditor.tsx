import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useNotasModulo, TabelaModulo, NotaRow } from "@/hooks/useNotasModulo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Save, Trash2, PlusCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface AlunoOption {
  id: string;
  nome_completo: string;
}

interface Props {
  tabela: TabelaModulo;
  tituloModulo: string; // ex: "CFO I"
}

export function AdminGradesEditor({ tabela, tituloModulo }: Props) {
  const { rows, loading, error, salvarNota, excluirNota } = useNotasModulo(tabela);
  const [alunos, setAlunos] = useState<AlunoOption[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<NotaRow>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // formulário de novo lançamento
  const [novoAlunoId, setNovoAlunoId] = useState("");
  const [novaMateria, setNovaMateria] = useState("");
  const [novoVc, setNovoVc] = useState("");
  const [novoVf, setNovoVf] = useState("");
  const [novaFinal, setNovaFinal] = useState("");
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  useEffect(() => {
    supabase
      .from("profiles")
      .select("id, nome_completo")
      .eq("role", "aluno")
      .order("nome_completo")
      .then(({ data }) => setAlunos(data ?? []));
  }, []);

  function handleFieldChange(rowId: string, field: keyof NotaRow, value: string) {
    setEdits((prev) => ({
      ...prev,
      [rowId]: { ...prev[rowId], [field]: value === "" ? null : Number(value) },
    }));
  }

  async function handleSalvarLinha(row: NotaRow) {
    setSavingId(row.id);
    const patch = edits[row.id] ?? {};
    const { error } = await salvarNota({
      aluno_id: row.aluno_id,
      materia: row.materia,
      vc: (patch.vc ?? row.vc) as number | null,
      vf: (patch.vf ?? row.vf) as number | null,
      nota_final: (patch.nota_final ?? row.nota_final) as number | null,
    });
    setSavingId(null);
    if (error) {
      toast({ title: "Erro ao salvar", description: error, variant: "destructive" });
    } else {
      toast({ title: "Nota atualizada com sucesso" });
      setEdits((prev) => {
        const { [row.id]: _removed, ...rest } = prev;
        return rest;
      });
    }
  }

  async function handleExcluir(id: string) {
    const { error } = await excluirNota(id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error, variant: "destructive" });
    } else {
      toast({ title: "Registro excluído" });
    }
  }

  async function handleNovoLancamento() {
    if (!novoAlunoId || !novaMateria) {
      toast({ title: "Selecione o aluno e informe a matéria", variant: "destructive" });
      return;
    }
    setSalvandoNovo(true);
    const { error } = await salvarNota({
      aluno_id: novoAlunoId,
      materia: novaMateria,
      vc: novoVc ? Number(novoVc) : null,
      vf: novoVf ? Number(novoVf) : null,
      nota_final: novaFinal ? Number(novaFinal) : null,
    });
    setSalvandoNovo(false);
    if (error) {
      toast({ title: "Erro ao lançar nota", description: error, variant: "destructive" });
    } else {
      toast({ title: "Nota lançada com sucesso" });
      setNovaMateria("");
      setNovoVc("");
      setNovoVf("");
      setNovaFinal("");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-primary" />
            Lançar nova nota — {tituloModulo}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div className="md:col-span-2 space-y-1">
              <Label>Aluno</Label>
              <Select value={novoAlunoId} onValueChange={setNovoAlunoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cadete" />
                </SelectTrigger>
                <SelectContent>
                  {alunos.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome_completo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Matéria</Label>
              <Input value={novaMateria} onChange={(e) => setNovaMateria(e.target.value)} placeholder="Ex: Direito Penal" />
            </div>
            <div className="space-y-1">
              <Label>VC</Label>
              <Input type="number" step="0.0001" value={novoVc} onChange={(e) => setNovoVc(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>VF</Label>
              <Input type="number" step="0.0001" value={novoVf} onChange={(e) => setNovoVf(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Nota final</Label>
              <Input type="number" step="0.0001" value={novaFinal} onChange={(e) => setNovaFinal(e.target.value)} />
            </div>
            <div className="md:col-span-5 flex justify-end">
              <Button onClick={handleNovoLancamento} disabled={salvandoNovo}>
                {salvandoNovo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Lançar nota
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg">Notas lançadas — {tituloModulo}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Matéria</TableHead>
                    <TableHead className="w-28">VC</TableHead>
                    <TableHead className="w-28">VF</TableHead>
                    <TableHead className="w-28">Nota final</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.aluno_nome ?? row.aluno_id}</TableCell>
                      <TableCell>{row.materia}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.0001"
                          defaultValue={row.vc ?? ""}
                          onChange={(e) => handleFieldChange(row.id, "vc", e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.0001"
                          defaultValue={row.vf ?? ""}
                          onChange={(e) => handleFieldChange(row.id, "vf", e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.0001"
                          defaultValue={row.nota_final ?? ""}
                          onChange={(e) => handleFieldChange(row.id, "nota_final", e.target.value)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleSalvarLinha(row)}
                          disabled={savingId === row.id}
                          title="Salvar"
                        >
                          {savingId === row.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 text-success" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleExcluir(row.id)}
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
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
