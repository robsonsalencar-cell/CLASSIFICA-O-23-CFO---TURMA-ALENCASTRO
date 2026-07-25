import { useState, FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Loader2, User } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function Perfil() {
  const { profile, isAdmin, updatePassword } = useAuth();
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (novaSenha.length < 8) {
      toast({ title: "A senha precisa ter no mínimo 8 caracteres.", variant: "destructive" });
      return;
    }
    if (novaSenha !== confirmar) {
      toast({ title: "As senhas não coincidem.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await updatePassword(novaSenha);
    setSubmitting(false);
    if (error) {
      toast({ title: "Erro ao atualizar senha", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Senha atualizada com sucesso" });
    setNovaSenha("");
    setConfirmar("");
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg space-y-6">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> Meu perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-foreground font-medium">{profile?.nome_completo}</p>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
          <Badge variant={isAdmin ? "default" : "secondary"}>
            {isAdmin ? "Administrador" : "Aluno"}
          </Badge>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <KeyRound className="w-5 h-5 text-primary" /> Trocar senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="nova">Nova senha</Label>
              <Input
                id="nova"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirmar">Confirmar nova senha</Label>
              <Input
                id="confirmar"
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Repita a senha"
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar nova senha
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
