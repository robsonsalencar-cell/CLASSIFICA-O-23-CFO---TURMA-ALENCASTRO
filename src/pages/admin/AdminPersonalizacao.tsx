import { useRef, useState } from "react";
import { useConfiguracaoTurma } from "@/hooks/useConfiguracaoTurma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Upload, Palette } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function AdminPersonalizacao() {
  const { config, loading, salvarTexto, enviarBrasao } = useConfiguracaoTurma();
  const [nomeTurma, setNomeTurma] = useState("");
  const [subtitulo, setSubtitulo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  // sincroniza os campos com a config carregada (só na primeira vez que chega)
  const [inicializado, setInicializado] = useState(false);
  if (!inicializado && !loading) {
    setNomeTurma(config.nome_turma);
    setSubtitulo(config.subtitulo_turma);
    setInicializado(true);
  }

  async function handleSalvarTexto() {
    setSalvando(true);
    const { error } = await salvarTexto(nomeTurma, subtitulo);
    setSalvando(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error, variant: "destructive" });
    } else {
      toast({ title: "Nome da turma atualizado" });
    }
  }

  async function handleArquivoSelecionado(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setEnviando(true);
    const { error } = await enviarBrasao(arquivo);
    setEnviando(false);
    if (error) {
      toast({ title: "Erro ao enviar brasão", description: error, variant: "destructive" });
    } else {
      toast({ title: "Brasão atualizado com sucesso" });
    }
    if (inputArquivoRef.current) inputArquivoRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Personalização da turma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            O nome, subtítulo e brasão abaixo aparecem no menu lateral e no cabeçalho de todos os
            módulos (CFO I, II, III e Classificação Geral) — para todos os perfis, aluno e admin.
            Use isto quando precisar reaproveitar o sistema para outra turma no futuro.
          </p>

          <div className="flex items-center gap-4">
            <img
              src={config.brasao_url ?? "/lovable-uploads/brasao-novo.png"}
              alt="Brasão atual"
              className="w-20 h-20 object-contain border border-border rounded-md bg-card"
            />
            <div className="space-y-1">
              <Label>Brasão / logo da turma</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={inputArquivoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleArquivoSelecionado}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => inputArquivoRef.current?.click()}
                  disabled={enviando}
                >
                  {enviando ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Enviar nova imagem
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Nome da turma</Label>
              <Input
                value={nomeTurma}
                onChange={(e) => setNomeTurma(e.target.value)}
                placeholder="ex: 23º CFO"
              />
            </div>
            <div className="space-y-1">
              <Label>Subtítulo</Label>
              <Input
                value={subtitulo}
                onChange={(e) => setSubtitulo(e.target.value)}
                placeholder="ex: Turma Alencastro"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSalvarTexto} disabled={salvando}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Salvar nome e subtítulo
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
