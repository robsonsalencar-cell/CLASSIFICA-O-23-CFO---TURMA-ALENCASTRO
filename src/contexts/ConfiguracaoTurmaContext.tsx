import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface ConfiguracaoTurma {
  id: number;
  nome_turma: string;
  subtitulo_turma: string;
  brasao_url: string | null;
  updated_at: string;
}

const CONFIG_PADRAO: ConfiguracaoTurma = {
  id: 1,
  nome_turma: "23º CFO",
  subtitulo_turma: "Turma Alencastro",
  brasao_url: "/lovable-uploads/brasao-novo.png",
  updated_at: new Date().toISOString(),
};

interface ConfiguracaoTurmaContextValue {
  config: ConfiguracaoTurma;
  loading: boolean;
  refetch: () => Promise<void>;
  salvarTexto: (nome_turma: string, subtitulo_turma: string) => Promise<{ error: string | null }>;
  enviarBrasao: (arquivo: File) => Promise<{ error: string | null }>;
}

const ConfiguracaoTurmaContext = createContext<ConfiguracaoTurmaContextValue | undefined>(undefined);

export function ConfiguracaoTurmaProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ConfiguracaoTurma>(CONFIG_PADRAO);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("configuracoes_turma").select("*").eq("id", 1).maybeSingle();
    if (data) setConfig(data as ConfiguracaoTurma);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarTexto(nome_turma: string, subtitulo_turma: string) {
    const { error } = await supabase
      .from("configuracoes_turma")
      .update({ nome_turma, subtitulo_turma, updated_at: new Date().toISOString() })
      .eq("id", 1);
    if (!error) await carregar(); // atualiza o Context inteiro -> todo mundo que usa o hook re-renderiza
    return { error: error?.message ?? null };
  }

  async function enviarBrasao(arquivo: File) {
    const extensao = arquivo.name.split(".").pop();
    const caminho = `brasao-${Date.now()}.${extensao}`;

    const { error: uploadError } = await supabase.storage.from("brasoes").upload(caminho, arquivo, {
      upsert: true,
    });
    if (uploadError) return { error: uploadError.message };

    const { data: publicUrlData } = supabase.storage.from("brasoes").getPublicUrl(caminho);

    const { error: updateError } = await supabase
      .from("configuracoes_turma")
      .update({ brasao_url: publicUrlData.publicUrl, updated_at: new Date().toISOString() })
      .eq("id", 1);

    if (!updateError) await carregar();
    return { error: updateError?.message ?? null };
  }

  return (
    <ConfiguracaoTurmaContext.Provider value={{ config, loading, refetch: carregar, salvarTexto, enviarBrasao }}>
      {children}
    </ConfiguracaoTurmaContext.Provider>
  );
}

export function useConfiguracaoTurma() {
  const ctx = useContext(ConfiguracaoTurmaContext);
  if (!ctx) throw new Error("useConfiguracaoTurma precisa estar dentro de <ConfiguracaoTurmaProvider>");
  return ctx;
}
