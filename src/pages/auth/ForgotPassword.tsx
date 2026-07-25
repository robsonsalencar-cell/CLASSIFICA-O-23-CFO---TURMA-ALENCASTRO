import { useState, FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await sendPasswordReset(email);
    setSubmitting(false);
    if (error) {
      setError("Não foi possível enviar o link. Verifique o e-mail informado.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-to-b from-[hsl(220,30%,7%)] via-[hsl(220,25%,10%)] to-[hsl(220,30%,7%)]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/10 blur-[120px] rounded-full" />

      <div className="relative w-full max-w-md">
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao login
        </Link>

        <Card className="border-primary/30 bg-card/90 backdrop-blur shadow-2xl">
          <CardContent className="pt-6">
            {!sent ? (
              <>
                <h1 className="text-lg font-semibold text-foreground mb-1">
                  Recuperar senha
                </h1>
                <p className="text-sm text-muted-foreground mb-5">
                  Informe o e-mail cadastrado. Enviaremos um link para você criar uma nova senha.
                </p>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu.email@exemplo.com"
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
                    Enviar link de redefinição
                  </Button>
                </form>
              </>
            ) : (
              <div className="text-center py-4">
                <MailCheck className="w-10 h-10 text-success mx-auto mb-3" />
                <h1 className="text-lg font-semibold text-foreground mb-1">
                  Link enviado
                </h1>
                <p className="text-sm text-muted-foreground">
                  Verifique sua caixa de entrada (e o spam) em <strong>{email}</strong> e siga
                  as instruções para criar uma nova senha.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
