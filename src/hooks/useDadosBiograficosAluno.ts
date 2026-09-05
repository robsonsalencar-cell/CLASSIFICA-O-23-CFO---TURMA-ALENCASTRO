import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface DadosBiograficosAluno {
  nome_completo: string;
  matricula: string | null;
  rg_pm: string | null;
  filiacao_pai: string | null;
  filiacao_mae: string | null;
  naturalidade: string | null;
  data_nascimento: string | null;
  matricula_academia: string | null;
  escola_anterior: string | null;
  ano_conclusao_ensino_medio: string | null;
  grau_concluido: string | null;
  numero_registro_historico: number | null;
  tema_tcc: string | null;
  orientador_tcc: string | null;
  data_apresentacao_tcc: string | null;
}

const CAMPOS =
  "nome_completo, matricula, rg_pm, filiacao_pai, filiacao_mae, naturalidade, " +
  "data_nascimento, matricula_academia, escola_anterior, ano_conclusao_ensino_medio, " +
  "grau_concluido, numero_registro_historico, tema_tcc, orientador_tcc, data_apresentacao_tcc";

/**
 * Busca os dados biográficos de um aluno (Fase 2 — Histórico Escolar), sob
 * demanda. Passar `null` não dispara busca nenhuma (usado quando o modal de
 * exportação ainda não foi aberto).
 *
 * `refetchToken` (opcional): incremente esse número toda vez que quiser
 * forçar uma busca nova, mesmo pro MESMO alunoId — sem isso, reabrir o
 * diálogo pro mesmo aluno (sem navegar pra outro no meio) não reexecuta a
 * busca (o efeito só reage a MUDANÇA de alunoId), então dados editados no
 * banco entre uma abertura e outra não apareciam sem recarregar a página
 * inteira. Bug real encontrado em 05/09/2026 gerando o Histórico da
 * Lauriane Simonini logo depois de atualizar os dados dela no banco.
 */
export function useDadosBiograficosAluno(alunoId: string | null, refetchToken = 0) {
  const [dados, setDados] = useState<DadosBiograficosAluno | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!alunoId) {
      setDados(null);
      setErro(null);
      return;
    }
    let cancelado = false;
    setLoading(true);
    setErro(null);
    supabase
      .from("profiles")
      .select(CAMPOS)
      .eq("id", alunoId)
      .single()
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          setErro(error.message);
          setDados(null);
        } else {
          setDados(data as unknown as DadosBiograficosAluno);
        }
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [alunoId, refetchToken]);

  return { dados, loading, erro };
}
