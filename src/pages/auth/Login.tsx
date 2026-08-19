import { useState, FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Lock, Mail, ShieldCheck } from "lucide-react";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      setError("E-mail ou senha inválidos. Verifique e tente novamente.");
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center px-4">
      {/* Fundo decorativo */}
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(220,30%,7%)] via-[hsl(220,25%,10%)] to-[hsl(220,30%,7%)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full" />

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img
            src="/brasao-apmcv-oficial.png"
            alt="Academia de Polícia Militar Costa Verde"
            className="w-44 h-44 md:w-52 md:h-52 object-contain drop-shadow-2xl mb-4"
          />
          <p className="text-2xl font-bold tracking-wide bg-gradient-to-r from-primary/90 via-[hsl(45,100%,70%)] to-primary/90 bg-clip-text text-transparent uppercase text-center">
            Painel CFO
          </p>
          <p className="text-sm text-muted-foreground mt-1 text-center">
            Academia de Polícia Militar Costa Verde — PMMT — acesso restrito
          </p>
        </div>

        <Card className="border-primary/30 bg-card/90 backdrop-blur shadow-2xl">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Link
                    to="/esqueci-senha"
                    className="text-xs text-primary hover:text-primary-hover underline underline-offset-2"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive text-center" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full font-semibold" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4 mr-2" />
                )}
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Acesso individual por aluno. Em caso de dúvidas, procure a administração do curso.
        </p>
      </div>
    </div>
  );
}
