import { KPICard } from "@/components/dashboard/KPICard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEstatisticasModulo } from "@/hooks/useEstatisticasModulo";
import { useNotasModulo, TabelaModulo } from "@/hooks/useNotasModulo";
import { Loader2, Medal, Target, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  tabela: TabelaModulo | "geral";
  // Para a Classificação Geral (que não tem uma tabela de notas por matéria própria),
  // passe undefined em tabelaNotas — a lista de matérias não será exibida.
  tabelaNotas?: TabelaModulo;
  tituloModulo: string;
}

export function ResumoIndividualModulo({ tabela, tabelaNotas, tituloModulo }: Props) {
  const { dados, loading: loadingStats } = useEstatisticasModulo(tabela);
  const { rows, loading: loadingNotas } = useNotasModulo(tabelaNotas ?? ("notas_cfo1" as TabelaModulo));

  // Só usados quando tabela === "geral": média do próprio aluno em cada módulo
  const cfo1Stats = useEstatisticasModulo("notas_cfo1");
  const cfo2Stats = useEstatisticasModulo("notas_cfo2");
  const cfo3Stats = useEstatisticasModulo("notas_cfo3");

  const mostrarNotas = Boolean(tabelaNotas);
  const mostrarQuebraPorModulo = tabela === "geral";
  const loading = loadingStats || (mostrarNotas && loadingNotas);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* "Minha posição" em destaque — é a informação que mais importa pro aluno */}
      <div
        className={cn(
          "relative rounded-2xl border-2 p-6 md:p-8 text-center overflow-hidden animate-pulse-glow",
          tabela === "geral" ? "border-primary/50" : "border-primary/50"
        )}
        style={{
          background: "radial-gradient(ellipse at center, hsl(var(--primary) / 0.14), transparent 70%)",
        }}
      >
        <div className="flex items-center justify-center gap-2 mb-2 text-muted-foreground">
          <Medal className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-widest">Minha posição</span>
        </div>
        <p
          className={cn(
            "text-6xl md:text-8xl font-extrabold leading-none",
            tabela === "geral" ? "texto-trofeu-dourado" : "text-primary drop-shadow-[0_0_25px_hsl(var(--primary)/0.6)]"
          )}
        >
          {dados?.minha_posicao != null ? `${dados.minha_posicao}º` : "—"}
        </p>
        <p className="text-sm text-muted-foreground mt-2">de {dados?.total_alunos ?? 0} alunos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard
          title="Minha média"
          value={dados?.minha_media != null ? dados.minha_media.toFixed(4) : "—"}
          subtitle="Sua média final"
          variant="success"
          icon={<Target className="w-4 h-4" />}
        />
        <KPICard
          title="Média da turma"
          value={dados?.media_turma != null ? dados.media_turma.toFixed(4) : "—"}
          subtitle={`Desvio-padrão: ${dados?.desvio_padrao?.toFixed(4) ?? "—"}`}
          variant="default"
          icon={<Users className="w-4 h-4" />}
        />
      </div>

      {mostrarQuebraPorModulo && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-foreground">Minha média por módulo</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-lg border p-4" style={{ borderColor: "hsl(210,90%,65%)", background: "hsl(210 90% 65% / 0.08)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold" style={{ color: "hsl(210,90%,65%)" }}>CFO I</span>
                {cfo1Stats.dados?.minha_posicao != null && (
                  <span
                    className="text-xs font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{ color: "hsl(210,90%,65%)", border: "1px solid hsl(210,90%,65%)" }}
                  >
                    {cfo1Stats.dados.minha_posicao}º lugar
                  </span>
                )}
              </div>
              <span className="text-2xl font-extrabold" style={{ color: "hsl(210,90%,65%)" }}>
                {cfo1Stats.dados?.minha_media != null ? cfo1Stats.dados.minha_media.toFixed(4) : "—"}
              </span>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: "hsl(140,70%,50%)", background: "hsl(140 70% 50% / 0.08)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold" style={{ color: "hsl(140,70%,50%)" }}>CFO II</span>
                {cfo2Stats.dados?.minha_posicao != null && (
                  <span
                    className="text-xs font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{ color: "hsl(140,70%,50%)", border: "1px solid hsl(140,70%,50%)" }}
                  >
                    {cfo2Stats.dados.minha_posicao}º lugar
                  </span>
                )}
              </div>
              <span className="text-2xl font-extrabold" style={{ color: "hsl(140,70%,50%)" }}>
                {cfo2Stats.dados?.minha_media != null ? cfo2Stats.dados.minha_media.toFixed(4) : "—"}
              </span>
            </div>
            <div className="rounded-lg border p-4" style={{ borderColor: "hsl(43,96%,56%)", background: "hsl(43 96% 56% / 0.08)" }}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold" style={{ color: "hsl(43,96%,56%)" }}>CFO III</span>
                {cfo3Stats.dados?.minha_posicao != null && (
                  <span
                    className="text-xs font-extrabold px-2 py-0.5 rounded-full whitespace-nowrap"
                    style={{ color: "hsl(43,96%,56%)", border: "1px solid hsl(43,96%,56%)" }}
                  >
                    {cfo3Stats.dados.minha_posicao}º lugar
                  </span>
                )}
              </div>
              <span className="text-2xl font-extrabold" style={{ color: "hsl(43,96%,56%)" }}>
                {cfo3Stats.dados?.minha_media != null ? cfo3Stats.dados.minha_media.toFixed(4) : "—"}
              </span>
            </div>
          </div>
        </div>
      )}

      {mostrarNotas && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg">Minhas notas por matéria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Matéria</TableHead>
                    <TableHead>VC (todas as verificações)</TableHead>
                    <TableHead>VF</TableHead>
                    <TableHead>Nota final</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.materia}</TableCell>
                      <TableCell>
                        {r.vc_lista && r.vc_lista.length > 0 ? r.vc_lista.join(" , ") : "—"}
                      </TableCell>
                      <TableCell>{r.vf ?? "—"}</TableCell>
                      <TableCell className="font-semibold">{r.nota_final ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                        Nenhuma nota lançada ainda neste módulo.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
