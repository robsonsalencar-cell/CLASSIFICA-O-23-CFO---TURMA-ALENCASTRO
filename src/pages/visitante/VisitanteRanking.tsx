import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, LogOut, Trophy } from "lucide-react";

interface TurmaOpcao {
  id: string;
  nome_turma: string;
}

interface LinhaRanking {
  nome_completo: string;
  media_cfo1: number | null;
  media_cfo2: number | null;
  media_cfo3: number | null;
  media_geral: number | null;
  modulos_com_nota: number;
}

/**
 * Tela exclusiva do papel "Visitante" — pessoas lotadas na APMCV (ex:
 * comandantes de pelotão, comandante da academia) que só querem
 * acompanhar a classificação das turmas, sem ser aluno nem administrador.
 * Só visualização: sem acesso a planilhas, históricos, boletins ou
 * qualquer exportação — layout propositalmente simples, sem o menu
 * lateral de aluno/admin, pra deixar claro o papel de "espectador".
 */
export default function VisitanteRanking() {
  const { profile, signOut } = useAuth();
  const [turmas, setTurmas] = useState<TurmaOpcao[]>([]);
  const [turmaSelecionadaId, setTurmaSelecionadaId] = useState<string>("");
  const [linhas, setLinhas] = useState<LinhaRanking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("turmas")
      .select("id, nome_turma")
      .order("nome_turma")
      .then(({ data }) => {
        setTurmas(data ?? []);
        // Turma do próprio cadastro (se houver) como ponto de partida
        const propria = (data ?? []).find((t) => t.id === profile?.turma_id);
        setTurmaSelecionadaId(propria?.id ?? data?.[0]?.id ?? "");
      });
  }, [profile?.turma_id]);

  useEffect(() => {
    if (!turmaSelecionadaId) return;
    setLoading(true);
    supabase
      .rpc("ranking_completo_turma", { p_turma_id: turmaSelecionadaId })
      .then(({ data }) => {
        setLinhas((data as LinhaRanking[]) ?? []);
        setLoading(false);
      });
  }, [turmaSelecionadaId]);

  const fmt = (n: number | null) => (n === null || n === undefined ? "—" : n.toFixed(4).replace(".", ","));

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border/50 p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-foreground">Painel CFO — Visitante</p>
          <p className="text-xs text-muted-foreground">{profile?.nome_completo}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Sair
        </Button>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Classificação da Turma
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Acesso somente para visualização — sem exportação de documentos.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={turmaSelecionadaId} onValueChange={setTurmaSelecionadaId}>
              <SelectTrigger className="max-w-xs">
                <SelectValue placeholder="Selecione a turma" />
              </SelectTrigger>
              <SelectContent>
                {turmas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.nome_turma}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : linhas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Ainda não há notas lançadas para esta turma.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">CFO I</TableHead>
                      <TableHead className="text-right">CFO II</TableHead>
                      <TableHead className="text-right">CFO III</TableHead>
                      <TableHead className="text-right">Média Geral</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l, i) => (
                      <TableRow key={l.nome_completo}>
                        <TableCell className="text-muted-foreground">{i + 1}º</TableCell>
                        <TableCell className="font-medium">{l.nome_completo}</TableCell>
                        <TableCell className="text-right">{fmt(l.media_cfo1)}</TableCell>
                        <TableCell className="text-right">{fmt(l.media_cfo2)}</TableCell>
                        <TableCell className="text-right">{fmt(l.media_cfo3)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmt(l.media_geral)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
