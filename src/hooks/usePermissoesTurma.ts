import { useAuth } from "@/contexts/AuthContext";
import { useTurma } from "@/contexts/TurmaContext";

/**
 * Espelha, só pra UX (esconder/desabilitar botão), as regras de
 * pode_editar_turma()/pode_configurar_turma() do banco — a autoridade real
 * sempre é a RLS/RPC do Postgres, isso aqui nunca é a única trava.
 */
export function usePermissoesTurma(turmaId: string | null) {
  const { profile } = useAuth();
  const { turmas } = useTurma();

  if (!profile || !turmaId) {
    return { podeEditarNotas: false, podeConfigurar: false };
  }

  if (profile.role === "desenvolvedor") {
    return { podeEditarNotas: true, podeConfigurar: true };
  }

  const turma = turmas.find((t) => t.id === turmaId);
  if (!turma) {
    return { podeEditarNotas: false, podeConfigurar: false };
  }

  if (profile.role === "admin_institucional") {
    const podeEditarNotas = !turma.finalizada || turma.autorizacao_institucional;
    return { podeEditarNotas, podeConfigurar: podeEditarNotas };
  }

  if (profile.role === "admin") {
    const eDonoDaTurma = profile.turma_id === turmaId;
    const podeEditarNotas = eDonoDaTurma && !turma.finalizada;
    // Janela de bootstrap: turma sem admin oficial ainda — não dá pra saber
    // isso só com o que já está carregado no cliente (precisaria de uma
    // query de "existe admin pra essa turma"), então aqui só reflete a
    // regra "dono e não finalizada". Turma em bootstrap ainda mostra os
    // botões de configuração desabilitados pro criador — ele só descobre
    // que pode ao tentar (a RLS libera); é uma pequena divergência de UX
    // aceita, não de segurança.
    return { podeEditarNotas, podeConfigurar: podeEditarNotas };
  }

  return { podeEditarNotas: false, podeConfigurar: false };
}
