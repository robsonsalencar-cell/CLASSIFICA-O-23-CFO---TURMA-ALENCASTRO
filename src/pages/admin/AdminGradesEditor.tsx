import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useNotasModulo, TabelaModulo, NotaRow } from "@/hooks/useNotasModulo";
import { calcularNotaFinalMulti, parseListaVc } from "@/config/formulaNotas";
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
import { useTurma } from "@/contexts/TurmaContext";
import { ImportarDiarioPdf } from "@/pages/admin/ImportarDiarioPdf";

interface AlunoOption {
  id: string;
  nome_completo: string;
}

interface Props {
  tabela: TabelaModulo;
  tituloModulo: string; // ex: "CFO I"
  listaMaterias: string[]; // lista oficial de disciplinas do módulo
}

export function AdminGradesEditor({ tabela, tituloModulo, listaMaterias }: Props) {
  const { rows, loading, error, refetch, salvarNota, excluirNota } = useNotasModulo(tabela);
  const { turmaAtualId } = useTurma();
  const [alunos, setAlunos] = useState<AlunoOption[]>([]);
  const [edits, setEdits] = useState<Record<string, { vc: string; vf: string; nota_final: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // formulário de novo lançamento
  const [novoAlunoId, setNovoAlunoId] = useState("");
  const [novaMateria, setNovaMateria] = useState("");
  const [novoVc, setNovoVc] = useState(""); // aceita "8, 9, 7.5"
  const [novoVf, setNovoVf] = useState("");
  const [novaFinalManual, setNovaFinalManual] = useState<string | null>(null);
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  useEffect(() => {
    if (!turmaAtualId) return;
    supabase
      .from("profiles")
      .select("id, nome_completo")
      .eq("role", "aluno")
      .eq("turma_id", turmaAtualId)
      .order("nome_completo")
      .then(({ data }) => setAlunos(data ?? []));
  }, [turmaAtualId]);

  const novaFinalCalculada = calcularNotaFinalMulti(
    parseListaVc(novoVc),
    novoVf ? Number(novoVf) : null,
    novaMateria
  );
  const novaFinalExibida = novaFinalManual ?? (novaFinalCalculada !== null ? String(novaFinalCalculada) : "");

  function getEdicao(row: NotaRow) {
    return (
      edits[row.id] ?? {
        vc: (row.vc_lista ?? []).join(", "),
        vf: row.vf !== null ? String(row.vf) : "",
        nota_final: row.nota_final !== null ? String(row.nota_final) : "",
      }
    );
  }

  function handleVcVfChange(row: NotaRow, field: "vc" | "vf", value: string) {
    const atual = getEdicao(row);
    const atualizado = { ...atual, [field]: value };
    const calculada = calcularNotaFinalMulti(
      parseListaVc(atualizado.vc),
      atualizado.vf ? Number(atualizado.vf) : null,
      row.materia
    );
    atualizado.nota_final = calculada !== null ? String(calculada) : atualizado.nota_final;
    setEdits((prev) => ({ ...prev, [row.id]: atualizado }));
  }

  function handleNotaFinalManual(row: NotaRow, value: string) {
    const atual = getEdicao(row);
    setEdits((prev) => ({ ...prev, [row.id]: { ...atual, nota_final: value } }));
  }

  async function handleSalvarLinha(row: NotaRow) {
    setSavingId(row.id);
    const e = getEdicao(row);
    const { error } = await salvarNota({
      aluno_id: row.aluno_id,
      materia: row.materia,
      vc_lista: parseListaVc(e.vc),
      vf: e.vf ? Number(e.vf) : null,
      nota_final: e.nota_final ? Number(e.nota_final) : null,
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
      toast({ title: "Selecione o aluno e a matéria", variant: "destructive" });
      return;
    }
    setSalvandoNovo(true);
    const { error } = await salvarNota({
      aluno_id: novoAlunoId,
      materia: novaMateria,
      vc_lista: parseListaVc(novoVc),
      vf: novoVf ? Number(novoVf) : null,
      nota_final: novaFinalExibida ? Number(novaFinalExibida) : null,
    });
    setSalvandoNovo(false);
    if (error) {
      toast({ title: "Erro ao lançar nota", description: error, variant: "destructive" });
    } else {
      toast({ title: "Nota lançada com sucesso" });
      setNovaMateria("");
      setNovoVc("");
      setNovoVf("");
      setNovaFinalManual(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-primary" />
            Lançar nova nota — {tituloModulo}
          </CardTitle>
          <ImportarDiarioPdf
            tabela={tabela}
            listaMaterias={listaMaterias}
            salvarNota={salvarNota}
            onImportado={refetch}
          />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
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
            <div className="md:col-span-2 space-y-1">
              <Label>Matéria</Label>
              <Select value={novaMateria} onValueChange={setNovaMateria}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a disciplina" />
                </SelectTrigger>
                <SelectContent>
                  {listaMaterias.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>VC (1 ou mais, separe por vírgula)</Label>
              <Input placeholder="ex: 8, 9, 7.5" value={novoVc} onChange={(e) => setNovoVc(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>VF</Label>
              <Input type="number" step="0.0001" value={novoVf} onChange={(e) => setNovoVf(e.target.value)} />
            </div>
            <div className="md:col-span-2 space-y-1">
              <Label>Nota final (automática)</Label>
              <Input
                type="number"
                step="0.0001"
                value={novaFinalExibida}
                onChange={(e) => setNovaFinalManual(e.target.value)}
                className="font-semibold"
              />
            </div>
            <div className="md:col-span-6 flex justify-end">
              <Button onClick={handleNovoLancamento} disabled={salvandoNovo}>
                {salvandoNovo ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Lançar nota
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            A nota final é calculada automaticamente: média das VCs lançadas, combinada com a VF.
            Se houver mais de uma verificação contínua, digite todas separadas por vírgula (ex: "8, 9, 7.5").
            Você pode digitar manualmente por cima do valor calculado, se precisar de uma exceção.
          </p>
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
                    <TableHead className="w-40">VC (separe por vírgula)</TableHead>
                    <TableHead className="w-28">VF</TableHead>
                    <TableHead className="w-28">Nota final</TableHead>
                    <TableHead className="w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const e = getEdicao(row);
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">{row.aluno_nome ?? row.aluno_id}</TableCell>
                        <TableCell>{row.materia}</TableCell>
                        <TableCell>
                          <Input
                            placeholder="ex: 8, 9"
                            value={e.vc}
                            onChange={(ev) => handleVcVfChange(row, "vc", ev.target.value)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.0001"
                            value={e.vf}
                            onChange={(ev) => handleVcVfChange(row, "vf", ev.target.value)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.0001"
                            value={e.nota_final}
                            onChange={(ev) => handleNotaFinalManual(row, ev.target.value)}
                            className="h-8 font-semibold"
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
                          <Button size="icon" variant="ghost" onClick={() => handleExcluir(row.id)} title="Excluir">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </TableCell>
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
