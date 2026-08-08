import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { calcularNotaFinalMulti, parseListaVc, paraNumeroSeguro } from "@/config/formulaNotas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileUp, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { TabelaModulo } from "@/hooks/useNotasModulo";
import { useTurma } from "@/contexts/TurmaContext";

interface AlunoExtraido {
  nome: string;
  vc_lista: number[];
  vf: number | null;
  aluno_id: string | null;
  encontrado: boolean;
}

interface AlunoOpcao {
  id: string;
  nome_completo: string;
}

interface Props {
  tabela: TabelaModulo;
  listaMaterias: string[];
  salvarNota: (params: {
    aluno_id: string;
    materia: string;
    vc_lista?: number[] | null;
    vf?: number | null;
    nota_final?: number | null;
  }) => Promise<{ error: string | null }>;
  onImportado?: (materiaImportada: string) => void;
}

function paraTexto(vc: number[]) {
  return vc.join(", ");
}

export function ImportarDiarioPdf({ tabela, listaMaterias, salvarNota, onImportado }: Props) {
  const { turmaAtualId } = useTurma();
  const [aberto, setAberto] = useState(false);
  const [materia, setMateria] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [alunosExtraidos, setAlunosExtraidos] = useState<AlunoExtraido[]>([]);
  const [alunosDaTurma, setAlunosDaTurma] = useState<AlunoOpcao[]>([]);

  function resetar() {
    setMateria("");
    setArquivo(null);
    setErro(null);
    setAlunosExtraidos([]);
  }

  async function handleProcessar() {
    if (!materia || !arquivo) {
      toast({ title: "Selecione a matéria e o arquivo PDF", variant: "destructive" });
      return;
    }
    setProcessando(true);
    setErro(null);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(arquivo);
      });

      if (!turmaAtualId) {
        setErro("Nenhuma turma selecionada.");
        setProcessando(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("processar-diario-pdf", {
        body: { pdf_base64: base64, materia, turma_id: turmaAtualId, tabela },
      });

      if (error || (data as any)?.error) {
        let mensagemErro = (data as any)?.error ?? error?.message ?? "Erro desconhecido";
        // O supabase-js não lê automaticamente o corpo JSON quando a Edge
        // Function retorna um status não-2xx — ele só expõe uma mensagem
        // genérica em error.message. O corpo real (com a causa específica,
        // ex: "ANTHROPIC_API_KEY não configurada") fica em error.context,
        // que é o objeto Response bruto. Tentamos lê-lo aqui para mostrar
        // a causa verdadeira ao admin em vez do erro genérico.
        const contexto = (error as any)?.context;
        if (contexto && typeof contexto.json === "function") {
          try {
            const corpo = await contexto.json();
            if (corpo?.error) mensagemErro = corpo.error;
          } catch {
            // corpo não era JSON válido (ex: erro de rede/proxy) — mantém a mensagem genérica
          }
        }
        setErro(mensagemErro);
        setProcessando(false);
        return;
      }

      setAlunosExtraidos((data as any).alunos ?? []);
      setAlunosDaTurma((data as any).alunos_da_turma ?? []);
    } catch (e: any) {
      setErro(String(e));
    }
    setProcessando(false);
  }

  function atualizarLinha(idx: number, patch: Partial<AlunoExtraido>) {
    setAlunosExtraidos((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  }

  async function handleConfirmar() {
    const semAlunoId = alunosExtraidos.filter((a) => !a.aluno_id);
    if (semAlunoId.length > 0) {
      toast({
        title: "Ainda há alunos sem casamento",
        description: "Selecione manualmente o aluno correto para cada linha em amarelo antes de confirmar.",
        variant: "destructive",
      });
      return;
    }

    setSalvando(true);
    let sucesso = 0;
    let falhas = 0;

    for (const a of alunosExtraidos) {
      const nota_final = calcularNotaFinalMulti(a.vc_lista, a.vf, materia);
      const { error } = await salvarNota({
        aluno_id: a.aluno_id!,
        materia,
        vc_lista: a.vc_lista,
        vf: a.vf,
        nota_final,
      });
      if (error) falhas++;
      else sucesso++;
    }

    setSalvando(false);
    toast({
      title: `Importação concluída: ${sucesso} salvos${falhas > 0 ? `, ${falhas} com erro` : ""}`,
    });
    setAberto(false);
    resetar();
    onImportado?.(materia);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)}>
        <FileUp className="w-4 h-4 mr-2" />
        Importar Diário (PDF)
      </Button>

      <Dialog
        open={aberto}
        onOpenChange={(v) => {
          setAberto(v);
          if (!v) resetar();
        }}
      >
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Diário de Classe (PDF)</DialogTitle>
          </DialogHeader>

          {alunosExtraidos.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Envie o PDF do diário de classe de UMA matéria. A IA lê a tabela de notas e te
                mostra uma prévia editável — nada é gravado até você clicar em "Confirmar".
              </p>
              <div className="space-y-1">
                <Label>Matéria deste diário</Label>
                <Select value={materia} onValueChange={setMateria}>
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
                <Label>Arquivo PDF</Label>
                <Input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                />
              </div>
              {erro && <p className="text-sm text-destructive">{erro}</p>}
              <div className="flex justify-end">
                <Button onClick={handleProcessar} disabled={processando}>
                  {processando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Processar PDF
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confira os valores extraídos de <strong>{materia}</strong> — corrija o que precisar
                antes de confirmar. Linhas em amarelo não casaram automaticamente com nenhum aluno
                cadastrado; escolha manualmente.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno (extraído do PDF)</TableHead>
                      <TableHead className="w-48">Casamento</TableHead>
                      <TableHead className="w-40">VC (vírgula)</TableHead>
                      <TableHead className="w-24">VF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alunosExtraidos.map((a, idx) => (
                      <TableRow key={idx} className={!a.aluno_id ? "bg-warning/10" : undefined}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            {a.encontrado ? (
                              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                            )}
                            {a.nome}
                          </div>
                        </TableCell>
                        <TableCell>
                          {a.encontrado ? (
                            <Badge variant="secondary">OK</Badge>
                          ) : (
                            <Select
                              value={a.aluno_id ?? ""}
                              onValueChange={(v) => atualizarLinha(idx, { aluno_id: v, encontrado: true })}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Escolher aluno" />
                              </SelectTrigger>
                              <SelectContent>
                                {alunosDaTurma.map((al) => (
                                  <SelectItem key={al.id} value={al.id}>
                                    {al.nome_completo}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8"
                            value={paraTexto(a.vc_lista)}
                            onChange={(e) => atualizarLinha(idx, { vc_lista: parseListaVc(e.target.value) })}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            className="h-8"
                            type="number"
                            step="0.0001"
                            value={a.vf ?? ""}
                            onChange={(e) =>
                              atualizarLinha(idx, { vf: paraNumeroSeguro(e.target.value) })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetar}>
                  Cancelar / Recomeçar
                </Button>
                <Button onClick={handleConfirmar} disabled={salvando}>
                  {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Confirmar e salvar {alunosExtraidos.length} alunos
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
