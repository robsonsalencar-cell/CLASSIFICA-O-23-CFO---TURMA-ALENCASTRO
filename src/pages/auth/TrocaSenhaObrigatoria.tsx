import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { KeyRound, Loader2, ShieldAlert } from "lucide-react";

export default function TrocaSenhaObrigatoria() {
  const { updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha precisa ter no mínimo 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);

    if (error) {
      setError("Não foi possível atualizar a senha. Tente novamente.");
      return;
    }
    navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(220,30%,7%)] via-[hsl(220,25%,10%)] to-[hsl(220,30%,7%)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full" />

      <div className="relative w-full max-w-md">
        <Card className="border-primary/30 bg-card/90 backdrop-blur shadow-2xl">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-5 h-5 text-warning" />
              <h1 className="text-lg font-semibold text-foreground">Troca de senha obrigatória</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              Por segurança, você precisa definir uma nova senha antes de continuar. Essa senha
              provisória não pode mais ser usada depois deste passo.
            </p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirmar nova senha</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repita a senha"
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
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Definir nova senha e continuar
              </Button>

              <button
                type="button"
                onClick={signOut}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              >
                Sair sem trocar (você precisará trocar no próximo login)
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
