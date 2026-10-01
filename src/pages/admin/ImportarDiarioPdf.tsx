import { useState } from "react";
import { supabase, extrairMensagemErroEdgeFunction } from "@/lib/supabaseClient";
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

// Pausa entre o processamento de arquivos consecutivos (ex: diário do 1º e
// do 2º pelotão da mesma matéria) para não disparar de novo o limite de
// requisições por minuto da Mistral logo em seguida da primeira chamada.
// 20s porque a conta gratuita vem esgotando a cota rápido com 2 chamadas
// pesadas (OCR de PDF) seguidas, mesmo com a Edge Function já tentando de
// novo sozinha em caso de 429.
const PAUSA_ENTRE_ARQUIVOS_MS = 20000;

function lerArquivoComoBase64(arquivo: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(arquivo);
  });
}

export function ImportarDiarioPdf({ tabela, listaMaterias, salvarNota, onImportado }: Props) {
  const { turmaAtualId } = useTurma();
  const [aberto, setAberto] = useState(false);
  const [materia, setMateria] = useState("");
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState<{ atual: number; total: number } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [alunosExtraidos, setAlunosExtraidos] = useState<AlunoExtraido[]>([]);
  const [alunosDaTurma, setAlunosDaTurma] = useState<AlunoOpcao[]>([]);
  const [errosSalvamento, setErrosSalvamento] = useState<{ nome: string; erro: string }[]>([]);

  function resetar() {
    setMateria("");
    setArquivos([]);
    setErro(null);
    setAlunosExtraidos([]);
    setErrosSalvamento([]);
    setProgresso(null);
  }

  async function handleProcessar() {
    if (!materia || arquivos.length === 0) {
      toast({ title: "Selecione a matéria e ao menos um arquivo PDF", variant: "destructive" });
      return;
    }
    if (!turmaAtualId) {
      setErro("Nenhuma turma selecionada.");
      return;
    }
    setProcessando(true);
    setErro(null);

    // Processa os arquivos em SEQUÊNCIA (nunca em paralelo) — cada um é uma
    // turma/pelotão diferente da MESMA matéria (ex: diário do 1º e do 2º
    // pelotão), e chamar a API da Mistral em paralelo só aumenta a chance de
    // bater no limite de requisições por minuto do plano gratuito.
    const todosAlunosExtraidos: AlunoExtraido[] = [];
    let alunosDaTurmaRecebidos: AlunoOpcao[] = [];

    for (let i = 0; i < arquivos.length; i++) {
      setProgresso({ atual: i + 1, total: arquivos.length });
      try {
        const base64 = await lerArquivoComoBase64(arquivos[i]);

        const { data, error } = await supabase.functions.invoke("processar-diario-pdf", {
          body: { pdf_base64: base64, materia, turma_id: turmaAtualId, tabela },
        });

        if (error || (data as any)?.error) {
          setErro(
            `Arquivo "${arquivos[i].name}" (${i + 1} de ${arquivos.length}): ` +
              (await extrairMensagemErroEdgeFunction(error, data))
          );
          setProcessando(false);
          setProgresso(null);
          // Mantém o que já foi extraído dos arquivos anteriores (se houver)
          // em vez de descartar tudo por causa de uma falha no último arquivo.
          if (todosAlunosExtraidos.length > 0) {
            setAlunosExtraidos(todosAlunosExtraidos);
            setAlunosDaTurma(alunosDaTurmaRecebidos);
          }
          return;
        }

        todosAlunosExtraidos.push(...((data as any).alunos ?? []));
        alunosDaTurmaRecebidos = (data as any).alunos_da_turma ?? alunosDaTurmaRecebidos;
      } catch (e: any) {
        setErro(`Arquivo "${arquivos[i].name}" (${i + 1} de ${arquivos.length}): ${String(e)}`);
        setProcessando(false);
        setProgresso(null);
        if (todosAlunosExtraidos.length > 0) {
          setAlunosExtraidos(todosAlunosExtraidos);
          setAlunosDaTurma(alunosDaTurmaRecebidos);
        }
        return;
      }

      // Pausa antes do próximo arquivo (não espera após o último).
      if (i < arquivos.length - 1) {
        await new Promise((r) => setTimeout(r, PAUSA_ENTRE_ARQUIVOS_MS));
      }
    }

    setAlunosExtraidos(todosAlunosExtraidos);
    setAlunosDaTurma(alunosDaTurmaRecebidos);
    setProcessando(false);
    setProgresso(null);
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
    const falhasDetalhadas: { nome: string; erro: string }[] = [];

    for (const a of alunosExtraidos) {
      const nota_final = calcularNotaFinalMulti(a.vc_lista, a.vf, materia);
      const { error } = await salvarNota({
        aluno_id: a.aluno_id!,
        materia,
        vc_lista: a.vc_lista,
        vf: a.vf,
        nota_final,
      });
      if (error) falhasDetalhadas.push({ nome: a.nome, erro: error });
      else sucesso++;
    }

    setSalvando(false);
    setErrosSalvamento(falhasDetalhadas);
    toast({
      title: `Importação concluída: ${sucesso} salvos${
        falhasDetalhadas.length > 0 ? `, ${falhasDetalhadas.length} com erro` : ""
      }`,
      variant: falhasDetalhadas.length > 0 ? "destructive" : undefined,
    });

    // Se houve QUALQUER falha, mantemos o diálogo aberto (mostrando o motivo
    // de cada erro abaixo da tabela) em vez de fechar como se tudo tivesse
    // dado certo — assim dá pra corrigir e tentar salvar de novo sem
    // precisar reprocessar o PDF do zero.
    if (falhasDetalhadas.length === 0) {
      setAberto(false);
      resetar();
    }
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
                Envie o(s) PDF(s) do diário de classe de UMA matéria. Se a turma estiver dividida
                em mais de um pelotão/sala, selecione os diários de todos eles de uma vez — eles
                serão processados um por um e reunidos na mesma prévia. A IA lê a tabela de notas e
                te mostra uma prévia editável — nada é gravado até você clicar em "Confirmar".
              </p>
              <div className="space-y-1">
                <Label>Matéria deste diário</Label>
                <Select value={materia} onValueChange={setMateria}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a disciplina" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...listaMaterias]
                      .sort((a, b) => a.localeCompare(b, "pt-BR"))
                      .map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Arquivo(s) PDF {arquivos.length > 1 && `(${arquivos.length} selecionados)`}</Label>
                <Input
                  type="file"
                  accept="application/pdf"
                  multiple
                  onChange={(e) => setArquivos(Array.from(e.target.files ?? []))}
                />
                {arquivos.length > 1 && (
                  <ul className="text-xs text-muted-foreground list-disc list-inside pt-1">
                    {arquivos.map((f, i) => (
                      <li key={i}>{f.name}</li>
                    ))}
                  </ul>
                )}
              </div>
              {processando && progresso && (
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando arquivo {progresso.atual} de {progresso.total}
                  {progresso.total > 1 ? " — aguardando entre arquivos para não exceder o limite da IA..." : "..."}
                </p>
              )}
              {erro && <p className="text-sm text-destructive">{erro}</p>}
              <div className="flex justify-end">
                <Button onClick={handleProcessar} disabled={processando}>
                  {processando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Processar {arquivos.length > 1 ? `${arquivos.length} PDFs` : "PDF"}
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
              {errosSalvamento.length > 0 && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-1">
                  <p className="text-sm font-semibold text-destructive">
                    {errosSalvamento.length} aluno(s) não foram salvos:
                  </p>
                  <ul className="text-xs text-destructive space-y-0.5 max-h-32 overflow-y-auto">
                    {errosSalvamento.map((f, i) => (
                      <li key={i}>
                        <strong>{f.nome}</strong>: {f.erro}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
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
