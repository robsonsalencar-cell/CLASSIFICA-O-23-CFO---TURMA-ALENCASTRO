import { useEffect, useRef, useState } from "react";
import { useConfiguracaoTurma, useTurma } from "@/contexts/TurmaContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Upload, Palette, PlusCircle, GraduationCap } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export function AdminPersonalizacao() {
  const { config, salvarTexto, enviarBrasao } = useConfiguracaoTurma();
  const {
    turmas,
    turmaAtualId,
    setTurmaAtualId,
    criarTurma,
    atualizarTextoCabecalho,
    atualizarDadosBoletim,
    atualizarComandanteApmcv,
  } = useTurma();

  const [nomeTurma, setNomeTurma] = useState(config.nome_turma);
  const [subtitulo, setSubtitulo] = useState(config.subtitulo_turma);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const [tituloPaginaModulo, setTituloPaginaModulo] = useState(config.titulo_pagina_modulo);
  const [tituloPaginaGeral, setTituloPaginaGeral] = useState(config.titulo_pagina_geral);
  const [subtituloPagina, setSubtituloPagina] = useState(config.subtitulo_pagina);
  const [salvandoCabecalho, setSalvandoCabecalho] = useState(false);

  const [anoLetivoCfo1, setAnoLetivoCfo1] = useState(config.ano_letivo_cfo1 ?? "");
  const [anoLetivoCfo2, setAnoLetivoCfo2] = useState(config.ano_letivo_cfo2 ?? "");
  const [anoLetivoCfo3, setAnoLetivoCfo3] = useState(config.ano_letivo_cfo3 ?? "");
  const [respNome, setRespNome] = useState(config.responsavel_assinatura_nome);
  const [respPosto, setRespPosto] = useState(config.responsavel_assinatura_posto);
  const [respFuncao, setRespFuncao] = useState(config.responsavel_assinatura_funcao);
  const [salvandoBoletim, setSalvandoBoletim] = useState(false);

  const [comandanteNome, setComandanteNome] = useState(config.comandante_apmcv_nome ?? "");
  const [comandantePosto, setComandantePosto] = useState(config.comandante_apmcv_posto ?? "");
  const [salvandoComandante, setSalvandoComandante] = useState(false);

  // Re-sincroniza os campos sempre que a turma EM FOCO mudar (ex: admin trocou
  // no seletor do menu lateral) — não só na primeira carga.
  useEffect(() => {
    setNomeTurma(config.nome_turma);
    setSubtitulo(config.subtitulo_turma);
    setTituloPaginaModulo(config.titulo_pagina_modulo);
    setTituloPaginaGeral(config.titulo_pagina_geral);
    setSubtituloPagina(config.subtitulo_pagina);
    setAnoLetivoCfo1(config.ano_letivo_cfo1 ?? "");
    setAnoLetivoCfo2(config.ano_letivo_cfo2 ?? "");
    setAnoLetivoCfo3(config.ano_letivo_cfo3 ?? "");
    setRespNome(config.responsavel_assinatura_nome);
    setRespPosto(config.responsavel_assinatura_posto);
    setRespFuncao(config.responsavel_assinatura_funcao);
    setComandanteNome(config.comandante_apmcv_nome ?? "");
    setComandantePosto(config.comandante_apmcv_posto ?? "");
  }, [config.id]);

  const [novaTurmaNome, setNovaTurmaNome] = useState("");
  const [novaTurmaSubtitulo, setNovaTurmaSubtitulo] = useState("");
  const [criando, setCriando] = useState(false);

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

  async function handleSalvarCabecalho() {
    if (!turmaAtualId) return;
    setSalvandoCabecalho(true);
    const { error } = await atualizarTextoCabecalho(
      turmaAtualId,
      tituloPaginaModulo,
      tituloPaginaGeral,
      subtituloPagina
    );
    setSalvandoCabecalho(false);
    if (error) {
      toast({ title: "Erro ao salvar cabeçalho", description: error, variant: "destructive" });
    } else {
      toast({ title: "Cabeçalho das páginas atualizado" });
    }
  }

  async function handleSalvarBoletim() {
    if (!turmaAtualId) return;
    setSalvandoBoletim(true);
    const { error } = await atualizarDadosBoletim(turmaAtualId, {
      ano_letivo_cfo1: anoLetivoCfo1,
      ano_letivo_cfo2: anoLetivoCfo2,
      ano_letivo_cfo3: anoLetivoCfo3,
      responsavel_assinatura_nome: respNome,
      responsavel_assinatura_posto: respPosto,
      responsavel_assinatura_funcao: respFuncao,
    });
    setSalvandoBoletim(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error, variant: "destructive" });
    } else {
      toast({ title: "Dados do Boletim/Histórico atualizados" });
    }
  }

  async function handleSalvarComandante() {
    if (!turmaAtualId) return;
    setSalvandoComandante(true);
    const { error } = await atualizarComandanteApmcv(turmaAtualId, {
      comandante_apmcv_nome: comandanteNome,
      comandante_apmcv_posto: comandantePosto,
    });
    setSalvandoComandante(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error, variant: "destructive" });
    } else {
      toast({ title: "Comandante da APMCV atualizado" });
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

  async function handleCriarTurma() {
    if (!novaTurmaNome || !novaTurmaSubtitulo) {
      toast({ title: "Preencha o nome e o subtítulo da nova turma", variant: "destructive" });
      return;
    }
    setCriando(true);
    const { error, id } = await criarTurma(novaTurmaNome, novaTurmaSubtitulo);
    setCriando(false);
    if (error) {
      toast({ title: "Erro ao criar turma", description: error, variant: "destructive" });
      return;
    }
    toast({ title: "Turma criada com sucesso" });
    setNovaTurmaNome("");
    setNovaTurmaSubtitulo("");
    if (id) setTurmaAtualId(id); // já troca o foco para a turma recém-criada
  }

  return (
    <div className="space-y-6">
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            Turmas cadastradas ({turmas.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cada turma tem seus próprios alunos, notas e histórico — nada se mistura entre elas.
            Use o seletor no menu lateral para trocar qual turma você está gerenciando; os cards
            abaixo sempre editam a turma { <strong>{config.nome_turma}</strong> }, que é a que está
            em foco agora.
          </p>
          <div className="flex flex-wrap gap-2">
            {turmas.map((t) => (
              <Button
                key={t.id}
                type="button"
                variant={t.id === turmaAtualId ? "default" : "outline"}
                size="sm"
                onClick={() => setTurmaAtualId(t.id)}
              >
                {t.nome_turma}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Editar turma em foco — {config.nome_turma}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
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
              <Input value={nomeTurma} onChange={(e) => setNomeTurma(e.target.value)} placeholder="ex: 23º CFO" />
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
          <p className="text-xs text-muted-foreground">
            Esses dois campos são o rótulo curto usado no menu lateral e na tela de login.
            Para o texto grande que aparece no topo de cada página, use o card abaixo.
          </p>

          <div className="flex justify-end">
            <Button onClick={handleSalvarTexto} disabled={salvando}>
              {salvando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Salvar nome e subtítulo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Texto do cabeçalho das páginas — {config.nome_turma}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Controle 100% do texto que aparece no topo de cada página (nada fica fixo/travado).
            Em CFO I, II e III, o número do módulo (" I", " II", " III") é adicionado
            automaticamente no final do título — não precisa digitar.
          </p>
          <div className="space-y-1">
            <Label>Título — páginas CFO I / II / III (sem o número do módulo)</Label>
            <Input
              value={tituloPaginaModulo}
              onChange={(e) => setTituloPaginaModulo(e.target.value)}
              placeholder="ex: Classificação – 23º CFO"
            />
          </div>
          <div className="space-y-1">
            <Label>Título — página Classificação Geral (texto completo)</Label>
            <Input
              value={tituloPaginaGeral}
              onChange={(e) => setTituloPaginaGeral(e.target.value)}
              placeholder="ex: CLASSIFICAÇÃO FINAL – 23º CFO"
            />
          </div>
          <div className="space-y-1">
            <Label>Subtítulo (usado em todas as páginas, texto completo)</Label>
            <Input
              value={subtituloPagina}
              onChange={(e) => setSubtituloPagina(e.target.value)}
              placeholder="ex: Painel de desempenho dos alunos oficiais - Turma Alencastro"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSalvarCabecalho} disabled={salvandoCabecalho}>
              {salvandoCabecalho && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Salvar cabeçalho
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            Dados do Boletim/Histórico Escolar — {config.nome_turma}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Usado nos documentos oficiais exportados (Boletim Escolar e, futuramente, Histórico Escolar).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Ano letivo — CFO I</Label>
              <Input value={anoLetivoCfo1} onChange={(e) => setAnoLetivoCfo1(e.target.value)} placeholder="ex: 2023" />
            </div>
            <div className="space-y-1">
              <Label>Ano letivo — CFO II</Label>
              <Input value={anoLetivoCfo2} onChange={(e) => setAnoLetivoCfo2(e.target.value)} placeholder="ex: 2024" />
            </div>
            <div className="space-y-1">
              <Label>Ano letivo — CFO III</Label>
              <Input value={anoLetivoCfo3} onChange={(e) => setAnoLetivoCfo3(e.target.value)} placeholder="ex: 2025" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Responsável pela assinatura — Nome</Label>
              <Input value={respNome} onChange={(e) => setRespNome(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Posto</Label>
              <Input value={respPosto} onChange={(e) => setRespPosto(e.target.value)} placeholder="ex: 2º Ten PM" />
            </div>
            <div className="space-y-1">
              <Label>Função</Label>
              <Input value={respFuncao} onChange={(e) => setRespFuncao(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSalvarBoletim} disabled={salvandoBoletim}>
              {salvandoBoletim && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Salvar dados do Boletim
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            Comandante da APMCV (Histórico Escolar) — {config.nome_turma}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Assina o Histórico Escolar junto com o responsável acima. Como esse cargo troca de
            titular com frequência, o nome/posto aparece em vermelho no Word gerado, pronto
            para revisão de quem for assinar.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={comandanteNome} onChange={(e) => setComandanteNome(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Posto</Label>
              <Input
                value={comandantePosto}
                onChange={(e) => setComandantePosto(e.target.value)}
                placeholder="ex: Ten Cel PM"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSalvarComandante} disabled={salvandoComandante}>
              {salvandoComandante && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Salvar Comandante
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-primary" />
            Cadastrar nova turma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Quando uma turma se forma e uma nova começa, cadastre aqui — o histórico da turma
            anterior continua salvo e acessível, sem se misturar com a nova.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Nome da nova turma</Label>
              <Input
                value={novaTurmaNome}
                onChange={(e) => setNovaTurmaNome(e.target.value)}
                placeholder="ex: 24º CFO"
              />
            </div>
            <div className="space-y-1">
              <Label>Subtítulo</Label>
              <Input
                value={novaTurmaSubtitulo}
                onChange={(e) => setNovaTurmaSubtitulo(e.target.value)}
                placeholder="ex: Turma Peixinho Dourado"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleCriarTurma} disabled={criando}>
              {criando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <PlusCircle className="w-4 h-4 mr-2" />
              Criar turma
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Depois de criar, use o seletor no menu lateral (ou os botões acima) para trocar o foco
            para a nova turma e cadastrar os alunos dela em "Usuários".
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
