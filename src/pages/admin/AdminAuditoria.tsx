import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ScrollText, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LinhaAuditoria {
  id: string;
  tabela: string;
  operacao: string;
  registro_id: string | null;
  ator_id: string | null;
  ator_nome: string | null;
  dados_antigos: any;
  dados_novos: any;
  criado_em: string;
}

interface LinhaSeguranca {
  tabela: string;
  rls_ativado: boolean;
  qtd_policies: number;
}

const NOMES_TABELA: Record<string, string> = {
  profiles: "Usuário",
  notas_cfo1: "Nota — CFO I",
  notas_cfo2: "Nota — CFO II",
  notas_cfo3: "Nota — CFO III",
  turmas: "Turma",
};

function resumoMudanca(linha: LinhaAuditoria): string {
  if (linha.operacao === "RLS_AUTO_CORRIGIDO") {
    return `⚠️ RLS estava DESATIVADO em "${linha.tabela}" — religado automaticamente pelo vigia`;
  }
  if (linha.tabela.startsWith("notas_")) {
    const materia = linha.dados_novos?.materia ?? linha.dados_antigos?.materia ?? "—";
    const notaAntes = linha.dados_antigos?.nota_final;
    const notaDepois = linha.dados_novos?.nota_final;
    if (linha.operacao === "DELETE") return `Excluiu nota de "${materia}"`;
    if (linha.operacao === "INSERT") return `Lançou nota em "${materia}": ${notaDepois ?? "—"}`;
    return `Alterou "${materia}": ${notaAntes ?? "—"} → ${notaDepois ?? "—"}`;
  }
  if (linha.tabela === "profiles") {
    const nome = linha.dados_novos?.nome_completo ?? linha.dados_antigos?.nome_completo ?? "—";
    if (linha.operacao === "INSERT") return `Cadastrou o usuário ${nome}`;
    if (linha.operacao === "DELETE") return `Excluiu o usuário ${nome}`;
    return `Editou o usuário ${nome}`;
  }
  if (linha.tabela === "turmas") {
    const nome = linha.dados_novos?.nome_turma ?? linha.dados_antigos?.nome_turma ?? "—";
    if (linha.operacao === "INSERT") return `Criou a turma ${nome}`;
    return `Editou a turma ${nome}`;
  }
  return `${linha.operacao} em ${linha.tabela}`;
}

export function AdminAuditoria() {
  const [linhas, setLinhas] = useState<LinhaAuditoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroTabela, setFiltroTabela] = useState<string>("__todas__");

  const [seguranca, setSeguranca] = useState<LinhaSeguranca[]>([]);
  const [carregandoSeguranca, setCarregandoSeguranca] = useState(true);
  useEffect(() => {
    supabase
      .rpc("checar_seguranca_rls")
      .then(({ data }) => {
        setSeguranca((data as LinhaSeguranca[]) ?? []);
        setCarregandoSeguranca(false);
      });
  }, []);
  const problemas = seguranca.filter((s) => !s.rls_ativado || s.qtd_policies === 0);

  useEffect(() => {
    async function carregar() {
      setLoading(true);
      let query = supabase
        .from("auditoria")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(300);
      if (filtroTabela !== "__todas__") query = query.eq("tabela", filtroTabela);
      const { data } = await query;
      setLinhas((data as LinhaAuditoria[]) ?? []);
      setLoading(false);
    }
    carregar();
  }, [filtroTabela]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ScrollText className="w-6 h-6 text-primary" /> Auditoria
        </h1>
        <p className="text-sm text-muted-foreground">
          Histórico de todas as mudanças feitas no sistema (notas, usuários, turmas) — visível só
          para o desenvolvedor.
        </p>
      </div>

      <Card className={problemas.length > 0 ? "border-destructive" : "border-green-600/40"}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            {problemas.length > 0 ? (
              <ShieldAlert className="w-5 h-5 text-destructive" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-green-600" />
            )}
            Segurança do banco (RLS)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {carregandoSeguranca ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Checando...
            </p>
          ) : problemas.length === 0 ? (
            <p className="text-sm text-green-600">
              Todas as {seguranca.length} tabelas têm RLS ativado com pelo menos 1 política de
              acesso. Nada exposto sem controle no momento.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-destructive font-medium">
                ⚠️ {problemas.length} tabela(s) com problema — dados podem estar acessíveis sem
                controle de permissão:
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tabela</TableHead>
                    <TableHead>RLS ativado</TableHead>
                    <TableHead>Políticas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {problemas.map((p) => (
                    <TableRow key={p.tabela}>
                      <TableCell className="font-medium">{p.tabela}</TableCell>
                      <TableCell>
                        <Badge variant={p.rls_ativado ? "secondary" : "destructive"}>
                          {p.rls_ativado ? "Sim" : "NÃO — desativado"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {p.qtd_policies === 0 ? (
                          <Badge variant="destructive">0 (bloqueia tudo)</Badge>
                        ) : (
                          p.qtd_policies
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Últimas 300 ações</CardTitle>
          <Select value={filtroTabela} onValueChange={setFiltroTabela}>
            <SelectTrigger className="w-56 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todas__">Todas as tabelas</SelectItem>
              <SelectItem value="profiles">Usuários</SelectItem>
              <SelectItem value="notas_cfo1">Notas — CFO I</SelectItem>
              <SelectItem value="notas_cfo2">Notas — CFO II</SelectItem>
              <SelectItem value="notas_cfo3">Notas — CFO III</SelectItem>
              <SelectItem value="turmas">Turmas</SelectItem>
            </SelectContent>
          </Select>
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
                    <TableHead>Quando</TableHead>
                    <TableHead>Quem</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead>O que mudou</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l) => (
                    <TableRow
                      key={l.id}
                      className={l.operacao === "RLS_AUTO_CORRIGIDO" ? "bg-destructive/10" : undefined}
                    >
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(l.criado_em).toLocaleString("pt-BR")}
                      </TableCell>
                      <TableCell className="font-medium">{l.ator_nome ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {NOMES_TABELA[l.tabela] ?? l.tabela}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={
                          l.operacao === "RLS_AUTO_CORRIGIDO" ? "text-sm text-destructive font-medium" : "text-sm"
                        }
                      >
                        {resumoMudanca(l)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {linhas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum registro de auditoria ainda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
