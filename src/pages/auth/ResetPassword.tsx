import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { KeyRound, Loader2 } from "lucide-react";

export default function ResetPassword() {
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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
      setError("Não foi possível atualizar a senha. Tente solicitar um novo link.");
      return;
    }
    setSuccess(true);
    setTimeout(() => navigate("/", { replace: true }), 2000);
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(220,30%,7%)] via-[hsl(220,25%,10%)] to-[hsl(220,30%,7%)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full" />

      <div className="relative w-full max-w-md">
        <Card className="border-primary/30 bg-card/90 backdrop-blur shadow-2xl">
          <CardContent className="pt-6">
            {!success ? (
              <>
                <h1 className="text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-primary" /> Definir nova senha
                </h1>
                <p className="text-sm text-muted-foreground mb-5">
                  Escolha uma nova senha de acesso ao painel.
                </p>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="password">Nova senha</Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm">Confirmar nova senha</Label>
                    <Input
                      id="confirm"
                      type="password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repita a senha"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-destructive text-center" role="alert">
                      {error}
                    </p>
                  )}

                  <Button type="submit" className="w-full font-semibold" disabled={submitting}>
                    {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Salvar nova senha
                  </Button>
                </form>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-success font-semibold mb-1">Senha atualizada com sucesso!</p>
                <p className="text-sm text-muted-foreground">Redirecionando para o painel...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
