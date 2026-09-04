import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, Profile } from "@/lib/supabaseClient";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isAdminInstitucional: boolean;
  isDeveloper: boolean;
  isVisitante: boolean;
  precisaTrocarSenha: boolean;
  loading: boolean;
  // Visão simulada pelo admin (modo "espelhar aluno"). null = vendo tudo/próprio perfil.
  viewingAsAlunoId: string | null;
  setViewingAsAlunoId: (id: string | null) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewingAsAlunoId, setViewingAsAlunoId] = useState<string | null>(null);

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    if (!error) setProfile(data as Profile);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setViewingAsAlunoId(null);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function sendPasswordReset(email: string) {
    // Domínio fixo, não window.location.origin — evita mandar o link de
    // redefinição pro domínio antigo caso a pessoa esteja numa aba/favorito
    // desatualizado (classifica-o-23-cfo-turma-alencastr.vercel.app), que
    // pode não redirecionar corretamente pro domínio atual em todos os casos
    // (URLs com #fragmento, como o link de redefinição, são especialmente
    // sensíveis a isso).
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://painel-cfo-apmcv.vercel.app/redefinir-senha",
    });
    return { error: error?.message ?? null };
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error && session?.user) {
      await supabase.from("profiles").update({ senha_trocada: true }).eq("id", session.user.id);
      await loadProfile(session.user.id);
    }
    return { error: error?.message ?? null };
  }

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    isAdmin: profile?.role === "admin" || profile?.role === "admin_institucional" || profile?.role === "desenvolvedor",
    isAdminInstitucional: profile?.role === "admin_institucional",
    isDeveloper: profile?.role === "desenvolvedor",
    isVisitante: profile?.role === "visitante",
    precisaTrocarSenha: profile ? profile.senha_trocada === false : false,
    loading,
    viewingAsAlunoId,
    setViewingAsAlunoId,
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>");
  return ctx;
}

// Helper para uso nas queries dos módulos: retorna o aluno_id "efetivo" a filtrar.
// - Aluno comum: sempre o próprio id.
// - Admin em "visão geral": retorna null (sem filtro = vê todos).
// - Admin "simulando" um aluno específico: retorna o id simulado.
export function useEffectiveAlunoId(): string | null {
  const { user, isAdmin, viewingAsAlunoId } = useAuth();
  if (!isAdmin) return user?.id ?? null;
  return viewingAsAlunoId; // null = visão geral (admin vê tudo)
}
