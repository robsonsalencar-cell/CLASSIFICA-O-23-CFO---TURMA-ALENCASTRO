import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/contexts/AuthContext";

export interface Turma {
  id: string;
  nome_turma: string;
  subtitulo_turma: string;
  brasao_url: string | null;
  titulo_pagina_modulo: string;
  titulo_pagina_geral: string;
  subtitulo_pagina: string;
  ranking_publico: boolean;
  ano_letivo_cfo1: string | null;
  ano_letivo_cfo2: string | null;
  ano_letivo_cfo3: string | null;
  responsavel_assinatura_nome: string;
  responsavel_assinatura_posto: string;
  responsavel_assinatura_funcao: string;
  comandante_apmcv_nome: string | null;
  comandante_apmcv_posto: string | null;
  proximo_numero_registro_historico: number;
  finalizada: boolean;
  autorizacao_institucional: boolean;
  created_at: string;
}

interface TurmaContextValue {
  turmas: Turma[];
  turmaAtualId: string | null;
  turmaAtual: Turma | null;
  setTurmaAtualId: (id: string) => void;
  loading: boolean;
  refetch: () => Promise<void>;
  criarTurma: (nome_turma: string, subtitulo_turma: string) => Promise<{ error: string | null; id: string | null }>;
  atualizarTurma: (id: string, nome_turma: string, subtitulo_turma: string) => Promise<{ error: string | null }>;
  atualizarTextoCabecalho: (
    id: string,
    titulo_pagina_modulo: string,
    titulo_pagina_geral: string,
    subtitulo_pagina: string
  ) => Promise<{ error: string | null }>;
  enviarBrasaoTurma: (id: string, arquivo: File) => Promise<{ error: string | null }>;
  alternarRankingPublico: (id: string, valor: boolean) => Promise<{ error: string | null }>;
  atualizarDadosBoletim: (
    id: string,
    dados: {
      ano_letivo_cfo1: string;
      ano_letivo_cfo2: string;
      ano_letivo_cfo3: string;
      responsavel_assinatura_nome: string;
      responsavel_assinatura_posto: string;
      responsavel_assinatura_funcao: string;
    }
  ) => Promise<{ error: string | null }>;
  atualizarComandanteApmcv: (
    id: string,
    dados: { comandante_apmcv_nome: string; comandante_apmcv_posto: string }
  ) => Promise<{ error: string | null }>;
  atribuirNumeroRegistroHistorico: (
    alunoId: string,
    turmaId: string
  ) => Promise<{ numero: number | null; error: string | null }>;
  finalizarTurma: (id: string, valor: boolean) => Promise<{ error: string | null }>;
  autorizarAdminInstitucional: (id: string, valor: boolean) => Promise<{ error: string | null }>;
  transferirAdminInstitucional: (novoAdminId: string) => Promise<{ error: string | null }>;
}

const TURMA_PADRAO: Turma = {
  id: "",
  nome_turma: "23º CFO",
  subtitulo_turma: "Turma Alencastro",
  brasao_url: "/lovable-uploads/brasao-novo.png",
  titulo_pagina_modulo: "Classificação – 23º CFO",
  titulo_pagina_geral: "CLASSIFICAÇÃO FINAL – 23º CFO",
  subtitulo_pagina: "Painel de desempenho dos alunos oficiais - Turma Alencastro",
  ranking_publico: false,
  ano_letivo_cfo1: null,
  ano_letivo_cfo2: null,
  ano_letivo_cfo3: null,
  responsavel_assinatura_nome: "Matheus Vitor Xavier Moraes Pereira",
  responsavel_assinatura_posto: "2º Ten PM",
  responsavel_assinatura_funcao: "Gerente Subalterno da Secretaria de Registros Acadêmicos",
  comandante_apmcv_nome: null,
  comandante_apmcv_posto: null,
  proximo_numero_registro_historico: 1,
  finalizada: false,
  autorizacao_institucional: false,
  created_at: new Date().toISOString(),
};

const TurmaContext = createContext<TurmaContextValue | undefined>(undefined);

export function TurmaProvider({ children }: { children: ReactNode }) {
  const { profile, isAdmin } = useAuth();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [turmaAtualId, setTurmaAtualIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [escolhaManualAdmin, setEscolhaManualAdmin] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("turmas").select("*").order("created_at", { ascending: true });
    setTurmas((data as Turma[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Aluno comum: sempre a própria turma. Admin: a que ele escolheu no seletor
  // (por padrão, a primeira/mais antiga cadastrada).
  useEffect(() => {
    if (!isAdmin && profile?.turma_id) {
      setTurmaAtualIdState(profile.turma_id);
    } else if (isAdmin) {
      setTurmaAtualIdState(escolhaManualAdmin ?? turmas[0]?.id ?? null);
    }
  }, [isAdmin, profile, turmas, escolhaManualAdmin]);

  function setTurmaAtualId(id: string) {
    setEscolhaManualAdmin(id);
    setTurmaAtualIdState(id);
  }

  const turmaAtual = useMemo(
    () => turmas.find((t) => t.id === turmaAtualId) ?? null,
    [turmas, turmaAtualId]
  );

  async function criarTurma(nome_turma: string, subtitulo_turma: string) {
    const { data, error } = await supabase
      .from("turmas")
      .insert({ nome_turma, subtitulo_turma })
      .select()
      .single();
    if (!error) await carregar();
    return { error: error?.message ?? null, id: data?.id ?? null };
  }

  async function atualizarTurma(id: string, nome_turma: string, subtitulo_turma: string) {
    const { error } = await supabase.from("turmas").update({ nome_turma, subtitulo_turma }).eq("id", id);
    if (!error) await carregar();
    return { error: error?.message ?? null };
  }

  async function atualizarTextoCabecalho(
    id: string,
    titulo_pagina_modulo: string,
    titulo_pagina_geral: string,
    subtitulo_pagina: string
  ) {
    const { error } = await supabase
      .from("turmas")
      .update({ titulo_pagina_modulo, titulo_pagina_geral, subtitulo_pagina })
      .eq("id", id);
    if (!error) await carregar();
    return { error: error?.message ?? null };
  }

  async function enviarBrasaoTurma(id: string, arquivo: File) {
    const extensao = arquivo.name.split(".").pop();
    const caminho = `brasao-${id}-${Date.now()}.${extensao}`;

    const { error: uploadError } = await supabase.storage.from("brasoes").upload(caminho, arquivo, { upsert: true });
    if (uploadError) return { error: uploadError.message };

    const { data: publicUrlData } = supabase.storage.from("brasoes").getPublicUrl(caminho);

    const { error: updateError } = await supabase.from("turmas").update({ brasao_url: publicUrlData.publicUrl }).eq("id", id);
    if (!updateError) await carregar();
    return { error: updateError?.message ?? null };
  }

  async function alternarRankingPublico(id: string, valor: boolean) {
    const { error } = await supabase.from("turmas").update({ ranking_publico: valor }).eq("id", id);
    if (!error) await carregar();
    return { error: error?.message ?? null };
  }

  async function atualizarDadosBoletim(
    id: string,
    dados: {
      ano_letivo_cfo1: string;
      ano_letivo_cfo2: string;
      ano_letivo_cfo3: string;
      responsavel_assinatura_nome: string;
      responsavel_assinatura_posto: string;
      responsavel_assinatura_funcao: string;
    }
  ) {
    const { error } = await supabase.from("turmas").update(dados).eq("id", id);
    if (!error) await carregar();
    return { error: error?.message ?? null };
  }

  async function atualizarComandanteApmcv(
    id: string,
    dados: { comandante_apmcv_nome: string; comandante_apmcv_posto: string }
  ) {
    const { error } = await supabase.from("turmas").update(dados).eq("id", id);
    if (!error) await carregar();
    return { error: error?.message ?? null };
  }

  async function atribuirNumeroRegistroHistorico(alunoId: string, turmaId: string) {
    const { data: alunoAtual, error: alunoError } = await supabase
      .from("profiles")
      .select("numero_registro_historico")
      .eq("id", alunoId)
      .single();
    if (alunoError) return { numero: null, error: alunoError.message };
    if (alunoAtual.numero_registro_historico != null) {
      return { numero: alunoAtual.numero_registro_historico as number, error: null };
    }

    const turma = turmas.find((t) => t.id === turmaId);
    const proximo = turma?.proximo_numero_registro_historico ?? 1;

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ numero_registro_historico: proximo })
      .eq("id", alunoId);
    if (profileError) return { numero: null, error: profileError.message };

    const { error: turmaError } = await supabase
      .from("turmas")
      .update({ proximo_numero_registro_historico: proximo + 1 })
      .eq("id", turmaId);
    // O número já foi gravado no aluno mesmo se este update falhar — só o
    // contador da turma ficaria parado; próxima exportação reusaria o mesmo
    // número. Risco aceito (painel de uso único, só admin exporta).
    await carregar();
    return { numero: proximo, error: turmaError?.message ?? null };
  }

  async function finalizarTurma(id: string, valor: boolean) {
    const { error } = await supabase.rpc("finalizar_turma", { p_turma_id: id, p_finalizada: valor });
    if (!error) await carregar();
    return { error: error?.message ?? null };
  }

  async function autorizarAdminInstitucional(id: string, valor: boolean) {
    const { error } = await supabase.rpc("autorizar_admin_institucional", { p_turma_id: id, p_valor: valor });
    if (!error) await carregar();
    return { error: error?.message ?? null };
  }

  async function transferirAdminInstitucional(novoAdminId: string) {
    const { error } = await supabase.rpc("transferir_admin_institucional", { p_novo_admin_id: novoAdminId });
    return { error: error?.message ?? null };
  }

  return (
    <TurmaContext.Provider
      value={{
        turmas,
        turmaAtualId,
        turmaAtual,
        setTurmaAtualId,
        loading,
        refetch: carregar,
        criarTurma,
        atualizarTurma,
        atualizarTextoCabecalho,
        enviarBrasaoTurma,
        alternarRankingPublico,
        atualizarDadosBoletim,
        atualizarComandanteApmcv,
        atribuirNumeroRegistroHistorico,
        finalizarTurma,
        autorizarAdminInstitucional,
        transferirAdminInstitucional,
      }}
    >
      {children}
    </TurmaContext.Provider>
  );
}

export function useTurma() {
  const ctx = useContext(TurmaContext);
  if (!ctx) throw new Error("useTurma precisa estar dentro de <TurmaProvider>");
  return ctx;
}

/**
 * Rótulo dos 3 últimos colocados no ranking. Por instrução explícita do
 * usuário (19/08/2026): a 23ª turma mantém o apelido tradicional
 * "CARROCEIROS"; qualquer outra turma usa o rótulo neutro "3 Últimos
 * Colocados", já que esse apelido é uma tradição específica da 23ª, não
 * institucional. Identifica a turma pelo número extraído de nome_turma
 * (ex: "23º CFO" → 23) — mesmo critério já usado na geração de matrícula
 * didática (AdminUsersPanel.tsx).
 */
export function rotuloUltimosColocados(nomeTurma: string | null | undefined): string {
  const numero = nomeTurma?.match(/\d+/)?.[0];
  return numero === "23" ? "CARROCEIROS" : "3 Últimos Colocados";
}

/**
 * Compatibilidade com o código já existente que chama useConfiguracaoTurma()
 * esperando {config, loading, refetch, salvarTexto, enviarBrasao}. Por baixo,
 * agora opera sobre a TURMA EM FOCO (turmaAtual), não mais uma config única.
 */
export function useConfiguracaoTurma() {
  const { turmaAtual, turmaAtualId, loading, refetch, atualizarTurma, enviarBrasaoTurma } = useTurma();

  const config = turmaAtual ?? TURMA_PADRAO;

  async function salvarTexto(nome_turma: string, subtitulo_turma: string) {
    if (!turmaAtualId) return { error: "Nenhuma turma selecionada." };
    return atualizarTurma(turmaAtualId, nome_turma, subtitulo_turma);
  }

  async function enviarBrasao(arquivo: File) {
    if (!turmaAtualId) return { error: "Nenhuma turma selecionada." };
    return enviarBrasaoTurma(turmaAtualId, arquivo);
  }

  return { config, loading, refetch, salvarTexto, enviarBrasao };
}
