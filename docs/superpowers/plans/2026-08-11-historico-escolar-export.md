# Histórico Escolar (Fase 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que admin/desenvolvedor exportem o Histórico Escolar completo de um aluno (Word e Excel, sem PDF) a partir da tela Classificação Geral, com texto legal institucional, disciplinas × carga horária × nota nos 3 anos, nota por extenso, classificação, e campos sujeitos a revisão manual (Comandante da APMCV, matrícula-registro na Academia, dados biográficos ainda não cadastrados) destacados em vermelho.

**Architecture:** Segue exatamente o padrão já estabelecido em `src/utils/exportBoletim.ts` (Fase 1) — `docx` para Word, `xlsx` para Excel, tudo client-side. Novo hook (`useDadosBiograficosAluno`) busca os campos biográficos do aluno sob demanda; a base de rank/média/carga horária vem de dados que **já existem e já são exibidos** em `ClassificacaoGeral.tsx` (não de uma tabela nova), evitando qualquer fonte de dado divergente da tela.

**Tech Stack:** React + TypeScript + Vite, Supabase (Postgres), `docx` + `xlsx` (já instalados desde a Fase 1).

## Global Constraints

- Nenhum campo novo entra em `nota_final`, médias de módulo, ranking ou Classificação Geral — só exibição no documento.
- Saída só em Word (.docx) e Excel (.xlsx) — **sem PDF** nesta fase.
- Regra do vermelho: nome/posto do Comandante da APMCV, número de matrícula-registro na Academia (`matricula_academia`), e **qualquer** campo biográfico ainda não preenchido aparecem em vermelho no Word, com `______` no lugar quando vazios.
- Texto de admissão ("admitido por Concurso Público...") é fixo, igual para todos os alunos.
- "Registro nº" é gerado sequencialmente pelo sistema, atribuído uma vez por aluno e reaproveitado depois.
- Botão de exportação restrito a `isAdmin`, mesmo padrão da Fase 1.
- Fica na tela Classificação Geral (não nos módulos CFO I/II/III individuais) — só aparece para aluno que tem nota lançada nos 3 módulos.
- **Não** usar a tabela `classificacao_final` (existe no schema mas está morta — não é lida nem escrita em nenhum lugar do app). Rank/média/médias por módulo vêm da mesma computação client-side que já roda em `ClassificacaoGeral.tsx`.
- Validação: `npx tsc --noEmit -p tsconfig.app.json` + `npx vite build` depois de cada task com mudança de código.
- Migração SQL é entregue pronta; roda-se direto via Supabase CLI (acesso já autorizado nesta sessão) — não depende do usuário colar no SQL Editor.

---

### Task 1: Migração SQL — novos campos

**Files:**
- Create: `supabase/migration_14.sql`

**Interfaces:**
- Produces: colunas `profiles.rg_pm/filiacao_pai/filiacao_mae/naturalidade/data_nascimento/matricula_academia/escola_anterior/ano_conclusao_ensino_medio/numero_registro_historico`, `turmas.comandante_apmcv_nome/comandante_apmcv_posto/proximo_numero_registro_historico` — usadas pelas Tasks 2-9.

- [ ] **Step 1: Escrever a migração**

Criar `supabase/migration_14.sql`:

```sql
-- ============================================================
-- MIGRAÇÃO 14 — Campos novos para o Histórico Escolar (Fase 2):
-- dados biográficos do aluno, número de matrícula-registro na
-- Academia, número de registro do próprio documento, e
-- nome/posto do Comandante da APMCV por turma. Nenhum desses
-- campos entra em cálculo de nota_final/ranking/média — são só
-- de exibição no documento exportado.
-- ============================================================

alter table public.profiles
  add column if not exists rg_pm text,
  add column if not exists filiacao_pai text,
  add column if not exists filiacao_mae text,
  add column if not exists naturalidade text,
  add column if not exists data_nascimento date,
  add column if not exists matricula_academia text,
  add column if not exists escola_anterior text,
  add column if not exists ano_conclusao_ensino_medio text,
  add column if not exists numero_registro_historico integer;

alter table public.turmas
  add column if not exists comandante_apmcv_nome text,
  add column if not exists comandante_apmcv_posto text,
  add column if not exists proximo_numero_registro_historico integer not null default 1;
```

- [ ] **Step 2: Rodar direto no Supabase**

```bash
npx supabase db query --linked --file supabase/migration_14.sql
```

Se o comando pedir login/link novamente (token de sessão expirado), rodar
antes `npx supabase login --token <token>` e `npx supabase link --project-ref ytqycsvdcmgoptarksdt`
com o token que o usuário fornecer nesta sessão.

- [ ] **Step 3: Confirmar**

```bash
npx supabase db query --linked --query "select rg_pm, matricula_academia, numero_registro_historico from public.profiles limit 1;"
npx supabase db query --linked --query "select comandante_apmcv_nome, proximo_numero_registro_historico from public.turmas limit 1;"
```

Esperado: as duas queries rodam sem erro (`comandante_apmcv_nome` vem
`null`, `proximo_numero_registro_historico` vem `1`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migration_14.sql
git commit -m "feat(db): campos biograficos, matricula-registro e comandante APMCV"
```

---

### Task 2: Tipos e `TurmaContext` — novos campos e funções

**Files:**
- Modify: `src/contexts/TurmaContext.tsx`

**Interfaces:**
- Consumes: colunas da Task 1.
- Produces: `Turma.comandante_apmcv_nome/comandante_apmcv_posto/proximo_numero_registro_historico`;
  `useTurma().atualizarComandanteApmcv(id, dados)`;
  `useTurma().atribuirNumeroRegistroHistorico(alunoId, turmaId): Promise<{ numero: number | null; error: string | null }>`.
  Usados pelas Tasks 3 e 8.

- [ ] **Step 1: Interface `Turma`**

Hoje:

```ts
export interface Turma {
  id: string;
  nome_turma: string;
  subtitulo_turma: string;
  brasao_url: string | null;
  titulo_pagina_modulo: string;
  titulo_pagina_geral: string;
  subtitulo_pagina: string;
  ranking_publico: boolean;
  ano_letivo_cfo1: string | null;
  ano_letivo_cfo2: string | null;
  ano_letivo_cfo3: string | null;
  responsavel_assinatura_nome: string;
  responsavel_assinatura_posto: string;
  responsavel_assinatura_funcao: string;
  created_at: string;
}
```

Trocar para:

```ts
export interface Turma {
  id: string;
  nome_turma: string;
  subtitulo_turma: string;
  brasao_url: string | null;
  titulo_pagina_modulo: string;
  titulo_pagina_geral: string;
  subtitulo_pagina: string;
  ranking_publico: boolean;
  ano_letivo_cfo1: string | null;
  ano_letivo_cfo2: string | null;
  ano_letivo_cfo3: string | null;
  responsavel_assinatura_nome: string;
  responsavel_assinatura_posto: string;
  responsavel_assinatura_funcao: string;
  comandante_apmcv_nome: string | null;
  comandante_apmcv_posto: string | null;
  proximo_numero_registro_historico: number;
  created_at: string;
}
```

- [ ] **Step 2: `TURMA_PADRAO`**

Hoje:

```ts
const TURMA_PADRAO: Turma = {
  id: "",
  nome_turma: "23º CFO",
  subtitulo_turma: "Turma Alencastro",
  brasao_url: "/lovable-uploads/brasao-novo.png",
  titulo_pagina_modulo: "Classificação – 23º CFO",
  titulo_pagina_geral: "CLASSIFICAÇÃO FINAL – 23º CFO",
  subtitulo_pagina: "Painel de desempenho dos alunos oficiais - Turma Alencastro",
  ranking_publico: false,
  ano_letivo_cfo1: null,
  ano_letivo_cfo2: null,
  ano_letivo_cfo3: null,
  responsavel_assinatura_nome: "Matheus Vitor Xavier Moraes Pereira",
  responsavel_assinatura_posto: "2º Ten PM",
  responsavel_assinatura_funcao: "Gerente Subalterno da Secretaria de Registros Acadêmicos",
  created_at: new Date().toISOString(),
};
```

Trocar para:

```ts
const TURMA_PADRAO: Turma = {
  id: "",
  nome_turma: "23º CFO",
  subtitulo_turma: "Turma Alencastro",
  brasao_url: "/lovable-uploads/brasao-novo.png",
  titulo_pagina_modulo: "Classificação – 23º CFO",
  titulo_pagina_geral: "CLASSIFICAÇÃO FINAL – 23º CFO",
  subtitulo_pagina: "Painel de desempenho dos alunos oficiais - Turma Alencastro",
  ranking_publico: false,
  ano_letivo_cfo1: null,
  ano_letivo_cfo2: null,
  ano_letivo_cfo3: null,
  responsavel_assinatura_nome: "Matheus Vitor Xavier Moraes Pereira",
  responsavel_assinatura_posto: "2º Ten PM",
  responsavel_assinatura_funcao: "Gerente Subalterno da Secretaria de Registros Acadêmicos",
  comandante_apmcv_nome: null,
  comandante_apmcv_posto: null,
  proximo_numero_registro_historico: 1,
  created_at: new Date().toISOString(),
};
```

- [ ] **Step 3: `TurmaContextValue`**

Logo abaixo de `atualizarDadosBoletim: (...) => Promise<{ error: string | null }>;`,
adicionar:

```ts
  atualizarComandanteApmcv: (
    id: string,
    dados: { comandante_apmcv_nome: string; comandante_apmcv_posto: string }
  ) => Promise<{ error: string | null }>;
  atribuirNumeroRegistroHistorico: (
    alunoId: string,
    turmaId: string
  ) => Promise<{ numero: number | null; error: string | null }>;
```

- [ ] **Step 4: Implementação das funções**

Logo depois da função `atualizarDadosBoletim` (antes do `return (`), adicionar:

```ts
  async function atualizarComandanteApmcv(
    id: string,
    dados: { comandante_apmcv_nome: string; comandante_apmcv_posto: string }
  ) {
    const { error } = await supabase.from("turmas").update(dados).eq("id", id);
    if (!error) await carregar();
    return { error: error?.message ?? null };
  }

  async function atribuirNumeroRegistroHistorico(alunoId: string, turmaId: string) {
    const { data: alunoAtual, error: alunoError } = await supabase
      .from("profiles")
      .select("numero_registro_historico")
      .eq("id", alunoId)
      .single();
    if (alunoError) return { numero: null, error: alunoError.message };
    if (alunoAtual.numero_registro_historico != null) {
      return { numero: alunoAtual.numero_registro_historico as number, error: null };
    }

    const turma = turmas.find((t) => t.id === turmaId);
    const proximo = turma?.proximo_numero_registro_historico ?? 1;

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ numero_registro_historico: proximo })
      .eq("id", alunoId);
    if (profileError) return { numero: null, error: profileError.message };

    const { error: turmaError } = await supabase
      .from("turmas")
      .update({ proximo_numero_registro_historico: proximo + 1 })
      .eq("id", turmaId);
    // O número já foi gravado no aluno mesmo se este update falhar — só o
    // contador da turma ficaria parado; próxima exportação reusaria o mesmo
    // número. Risco aceito (painel de uso único, só admin exporta).
    await carregar();
    return { numero: proximo, error: turmaError?.message ?? null };
  }
```

- [ ] **Step 5: Registrar no Provider**

No objeto passado em `<TurmaContext.Provider value={{ ... }}>`, logo depois de
`atualizarDadosBoletim,`, adicionar:

```ts
        atualizarComandanteApmcv,
        atribuirNumeroRegistroHistorico,
```

- [ ] **Step 6: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/contexts/TurmaContext.tsx
git commit -m "feat: comandante APMCV e atribuicao de numero de registro no TurmaContext"
```

---

### Task 3: Painel Personalização — Comandante da APMCV

**Files:**
- Modify: `src/pages/admin/AdminPersonalizacao.tsx`

**Interfaces:**
- Consumes: `useTurma().atualizarComandanteApmcv` (Task 2), `config.comandante_apmcv_nome/posto` (Task 2).

- [ ] **Step 1: Hook e estado**

A linha do topo hoje:

```ts
  const { turmas, turmaAtualId, setTurmaAtualId, criarTurma, atualizarTextoCabecalho, atualizarDadosBoletim } = useTurma();
```

Trocar para:

```ts
  const {
    turmas,
    turmaAtualId,
    setTurmaAtualId,
    criarTurma,
    atualizarTextoCabecalho,
    atualizarDadosBoletim,
    atualizarComandanteApmcv,
  } = useTurma();
```

Logo abaixo de `const [salvandoBoletim, setSalvandoBoletim] = useState(false);`,
adicionar:

```ts
  const [comandanteNome, setComandanteNome] = useState(config.comandante_apmcv_nome ?? "");
  const [comandantePosto, setComandantePosto] = useState(config.comandante_apmcv_posto ?? "");
  const [salvandoComandante, setSalvandoComandante] = useState(false);
```

No `useEffect` de re-sincronização, hoje termina em:

```ts
    setRespNome(config.responsavel_assinatura_nome);
    setRespPosto(config.responsavel_assinatura_posto);
    setRespFuncao(config.responsavel_assinatura_funcao);
  }, [config.id]);
```

Trocar para:

```ts
    setRespNome(config.responsavel_assinatura_nome);
    setRespPosto(config.responsavel_assinatura_posto);
    setRespFuncao(config.responsavel_assinatura_funcao);
    setComandanteNome(config.comandante_apmcv_nome ?? "");
    setComandantePosto(config.comandante_apmcv_posto ?? "");
  }, [config.id]);
```

- [ ] **Step 2: Handler de salvar**

Logo depois de `handleSalvarBoletim`, adicionar:

```ts
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
```

- [ ] **Step 3: Card na UI**

Logo depois do `</Card>` que fecha "Dados do Boletim/Histórico Escolar" (antes
do card "Cadastrar nova turma"), adicionar:

```tsx
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
```

- [ ] **Step 4: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/AdminPersonalizacao.tsx
git commit -m "feat: campo Comandante da APMCV no painel Personalizacao"
```

---

### Task 4: Configs novos — carga horária, texto legal, número por extenso

**Files:**
- Create: `src/config/cargaHorariaCfo.ts`
- Modify: `src/config/documentosOficiais.ts`
- Create: `src/utils/numeroExtenso.ts`

**Interfaces:**
- Produces: `CARGA_HORARIA_CFO1/2/3: Record<string, number>`;
  `TEXTO_INSTITUCIONAL_HISTORICO`, `TEXTO_LEGAL_ABERTURA`, `TEXTO_LEGAL_ADMISSAO`,
  `TEXTO_LEGAL_FECHAMENTO`; `notaPorExtenso(valor: number): string`,
  `dataPorExtenso(data: Date): string`. Usados pela Task 7.

- [ ] **Step 1: `src/config/cargaHorariaCfo.ts`**

Mapeamento conferido linha a linha contra `7-MATRIZ CURRICULAR DO CFO 20
MESES.xlsx` — toda chave bate exatamente com uma entrada de
`MATERIAS_CFO1/2/3` (`src/config/materiasCfo1/2/3.ts`).

```ts
// Carga horária por disciplina, conforme "7-MATRIZ CURRICULAR DO CFO 20
// MESES.xlsx" (confirmada pelo usuário como válida para o 23º e 24º CFO).
// Toda chave aqui bate 1:1 com uma entrada de MATERIAS_CFO1/2/3
// (src/config/materiasCfo1.ts, materiasCfo2.ts, materiasCfo3.ts) — inclui a
// migração já documentada de "Natação" do CFO II pro CFO III.
export const CARGA_HORARIA_CFO1: Record<string, number> = {
  "Sistema de Segurança Pública no Brasil": 30,
  "História da Policia Militar": 30,
  "Geopolítica de Mato Grosso": 30,
  "Policia Comunitária": 30,
  "Legislação Policial Militar I": 40,
  "Direitos humanos": 30,
  "Medicina Legal": 30,
  "Direito Processual Penal Militar I": 40,
  "Direito Penal Militar I": 40,
  "Direito Administrativo Disciplinar Militar I": 40,
  "Legislação Penal Extravagante I": 30,
  "Direito Ambiental": 30,
  "Redação Oficial Aplicada": 30,
  "Educação Física Policial Militar I": 30,
  "Defesa Pessoal I": 30,
  "Educação Financeira": 30,
  "Libras": 30,
  "Metodologia Científica / Pesquisa": 30,
  "Cerimonial e Protocolo": 30,
  "Comunicação Operacional/Telecomunicações": 30,
  "Armamento de Fogo, Munição e Explosivos": 45,
  "Bombeiro Militar e Defesa Civil": 30,
  "Cultura e Cotidiano Policial Militar": 60,
  "Teoria de Policia": 30,
  "Didática: Sistema de Ensino": 40,
  "Técnicas Gerais de Policiamento I": 45,
  "POP I": 60,
  "Defesa Territorial I": 30,
  "Hipologia e Equitação": 30,
  "Administração Pública Gerencial": 30,
  "APH": 30,
  "Tiro Policial": 90,
};

export const CARGA_HORARIA_CFO2: Record<string, number> = {
  "Criminologia Aplicada a Segurança Pública": 30,
  "Sociologia do Crime e da Violência": 30,
  "Direito Penal Militar II": 30,
  "Direito Administrativo Aplicado a Seg. Publica.": 30,
  "Direito Processual Penal Militar II": 30,
  "Legislação Policial Militar II": 30,
  "Direito Administrativo Disciplinar Militar II": 30,
  "Legislação Penal Extravagante II": 30,
  "Educação Física Policial Militar II": 30,
  "Defesa Pessoal II": 30,
  "Gestão de Informação – Inteligência": 30,
  "Saúde Segurança aplicada ao Trabalho": 30,
  "Marketing Institucional": 30,
  "Metodologia Científica/Projeto de Pesquisa": 30,
  "Geoprocessamento e Análise Criminal": 30,
  "Emergência e Traumas": 30,
  "Cultura e Cotidiano Policial Militar II": 45,
  "Técnicas Gerais de Policiamento II": 45,
  "POP II": 60,
  "Criminalística": 30,
  "Defesa Territorial II": 30,
  "Policiamento Montado": 30,
  "Uso diferenciado da Força": 30,
  "Gestão de Pessoas": 30,
  "Termo Circunstanciado de Ocorrência": 30,
  "Sistemas Informatizados": 30,
  "Tiro Policial": 90,
};

export const CARGA_HORARIA_CFO3: Record<string, number> = {
  "Licitação de Contrato e Aquisição": 45,
  "Direito Penal Militar III": 30,
  "Direito Processual Penal Militar III": 30,
  "Legislação Policial Militar III": 30,
  "Direito Administrativo Disciplinar Militar III": 30,
  "Gerenciamento de Crises e Eventos Críticos": 45,
  "Educação Física Policial Militar III": 30,
  "Controle e submissão": 30,
  "Artigo Científico": 30,
  "Seminário de Trabalho Científico-Workshop de Banca de Defesa do TCC": 45,
  "Cultura e Cotidiano Policial Militar III": 30,
  "EPP – Estagio de Patrulhamento Tático": 30,
  "Técnicas Gerais de Policiamento III": 30,
  "POP III": 60,
  "Segurança Física de Instalações e Dignatários": 45,
  "Defesa Territorial III": 30,
  "Policiamento Ambiental": 45,
  "Policiamento de Trânsito": 45,
  "Policiamento de Grandes eventos": 30,
  "Técnicas não letais": 30,
  "Gestão de Recursos Públicos": 30,
  "Gestão Pública por Resultados": 30,
  "Gestão de Logística e Patrimônio": 30,
  "Tiro Policial": 90,
  "Termo Circunstanciado de Ocorrência": 30,
  "Natação": 30,
};
```

- [ ] **Step 2: Extensão de `src/config/documentosOficiais.ts`**

Arquivo hoje (`TEXTO_INSTITUCIONAL` sozinho) permanece **sem alteração** —
adicionar os blocos novos logo abaixo, no mesmo arquivo:

```ts
// Textos institucionais fixos usados só no Histórico Escolar (Fase 2).
// TEXTO_INSTITUCIONAL acima continua exclusivo do Boletim, sem mudanças.
export const TEXTO_INSTITUCIONAL_HISTORICO = {
  ...TEXTO_INSTITUCIONAL,
  linhaDiretoria: "DIRETORIA DE ENSINO, INSTRUÇÃO E PESQUISA",
} as const;

export const TEXTO_LEGAL_ABERTURA =
  "criada em 27 de novembro de 1987, pela Lei nº 5.177, e efetivada em 06 de julho de 1993, " +
  "pelo Decreto nº 3.145, credenciada como Instituição de Ensino Superior através da Portaria " +
  "Conjunta nº 07/SESP/SECITEC/2012, bem como reconhecido o Curso de Formação de Oficiais na " +
  "Modalidade de Bacharelado em Segurança Pública, sendo que o referido CFO foi reconhecido " +
  "inicialmente em 1996, como Curso de Nível Superior pela Resolução nº 253/96, do CEE/MT, " +
  "conforme Parecer nº 092/96, de 27 de agosto de 1996, ratificado pelo Parecer nº 049/00-CEE " +
  "de 22 de fevereiro de 2000, localizada à Rua Maysa Matarazzo s/nº, Bairro Jardim Costa Verde " +
  "em Várzea Grande-MT, CERTIFICA que consta nos arquivos desta Unidade Escolar que,";

export const TEXTO_LEGAL_ADMISSAO =
  "admitido(a) por Concurso Público realizado pela Polícia Militar do Estado de Mato Grosso " +
  "em convênio com a Universidade Federal de Mato Grosso, tendo concluído o 2º Grau";

export const TEXTO_LEGAL_FECHAMENTO =
  "Por ser verdade eu mandei passar o presente, assinado depois de datado pelo chefe da " +
  "Secretaria de Registros Acadêmico da APMCV, que conferiu a elaboração do presente, o qual " +
  "assina juntamente com o sr. Comandante da APMCV.";
```

- [ ] **Step 3: `src/utils/numeroExtenso.ts`**

```ts
const UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = [
  "dez", "onze", "doze", "treze", "quatorze", "quinze",
  "dezesseis", "dezessete", "dezoito", "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos",
  "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos",
];
const INTEIRO_0_A_10 = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];

function extensoTresDigitos(n: number): string {
  if (n === 0) return "zero";
  if (n === 100) return "cem";
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const dezena = Math.floor(resto / 10);
  const unidade = resto % 10;
  const partes: string[] = [];
  if (centena > 0) partes.push(CENTENAS[centena]);
  if (resto > 0) {
    if (partes.length > 0) partes.push("e");
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      partes.push(DEZENAS[dezena]);
      if (unidade > 0) {
        partes.push("e");
        partes.push(UNIDADES[unidade]);
      }
    }
  }
  return partes.join(" ");
}

/**
 * Converte uma nota (0 a 10, até 3 casas decimais) para o formato usado no
 * Histórico Escolar: notaPorExtenso(8.576) === "oito vírgula quinhentos e
 * setenta e seis" (as 3 casas decimais são lidas como um número inteiro de
 * 0 a 999, não dígito a dígito — mesma convenção do modelo original). Nota
 * exata (ex: 10.000) devolve só a parte inteira, sem "vírgula".
 */
export function notaPorExtenso(valor: number): string {
  const arredondado = Math.round(valor * 1000) / 1000;
  const parteInteira = Math.min(10, Math.max(0, Math.floor(arredondado)));
  const parteDecimal = Math.round((arredondado - parteInteira) * 1000);
  const extensoInteiro = INTEIRO_0_A_10[parteInteira];
  if (parteDecimal === 0) return extensoInteiro;
  return `${extensoInteiro} vírgula ${extensoTresDigitos(parteDecimal)}`;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Formata uma data como "11 de agosto de 2026", usada na linha de emissão do Histórico. */
export function dataPorExtenso(data: Date): string {
  return `${data.getDate()} de ${MESES[data.getMonth()]} de ${data.getFullYear()}`;
}
```

- [ ] **Step 4: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/config/cargaHorariaCfo.ts src/config/documentosOficiais.ts src/utils/numeroExtenso.ts
git commit -m "feat: carga horaria por disciplina, texto legal do historico e conversor nota->extenso"
```

---

### Task 5: `ClassificacaoGeral.tsx` — propagar `aluno_id` e `matricula`

**Files:**
- Modify: `src/pages/cfo/ClassificacaoGeral.tsx`

**Interfaces:**
- Consumes: `cfo1/cfo2/cfo3.students` (`AlunoModulo[]`, já tem `aluno_id`/`matricula` — `src/hooks/useAlunosModulo.ts`).
- Produces: cada item de `students` (o `DetailedStudent[]` desta tela) passa a
  ter também `aluno_id: string` e `matricula: string | null` no objeto
  runtime (mesmo padrão não-tipado que o Boletim já usa, ver
  `StudentDetailsModal.tsx` fazendo `(student as AlunoModulo).matricula`).
  Usado pela Task 8.

- [ ] **Step 1: `Map` interno com `matricula`**

Hoje:

```ts
    const porAlunoId = new Map<
      string,
      {
        nome: string;
        cfoI?: number;
        cfoII?: number;
        cfoIII?: number;
        gradesDetalhado: Record<string, { nota_final: number | null; vc_lista: number[]; vf: number | null }>;
      }
    >();

    function acumular(lista: typeof cfo1.students, campo: "cfoI" | "cfoII" | "cfoIII", prefixo: string) {
      for (const s of lista) {
        const atual = porAlunoId.get(s.aluno_id) ?? { nome: s.nome, gradesDetalhado: {} };
        atual[campo] = s.mediaFinal;
        for (const [materia, d] of Object.entries(s.gradesDetalhado)) {
          atual.gradesDetalhado[`${materia} (${prefixo})`] = d;
        }
        porAlunoId.set(s.aluno_id, atual);
      }
    }
```

Trocar para:

```ts
    const porAlunoId = new Map<
      string,
      {
        nome: string;
        matricula: string | null;
        cfoI?: number;
        cfoII?: number;
        cfoIII?: number;
        gradesDetalhado: Record<string, { nota_final: number | null; vc_lista: number[]; vf: number | null }>;
      }
    >();

    function acumular(lista: typeof cfo1.students, campo: "cfoI" | "cfoII" | "cfoIII", prefixo: string) {
      for (const s of lista) {
        const atual = porAlunoId.get(s.aluno_id) ?? { nome: s.nome, matricula: s.matricula, gradesDetalhado: {} };
        atual[campo] = s.mediaFinal;
        for (const [materia, d] of Object.entries(s.gradesDetalhado)) {
          atual.gradesDetalhado[`${materia} (${prefixo})`] = d;
        }
        porAlunoId.set(s.aluno_id, atual);
      }
    }
```

- [ ] **Step 2: Lista final com `aluno_id`**

Hoje:

```ts
    const lista = Array.from(porAlunoId.values())
      // Só entra na Classificação Geral quem tem nota nos 3 módulos — um
      // aluno que saiu do curso no meio (ex: só fez CFO I) continua aparecendo
      // normalmente no ranking daquele módulo, mas não na classificação final.
      .filter((s) => typeof s.cfoI === "number" && typeof s.cfoII === "number" && typeof s.cfoIII === "number")
      .map((s) => {
        const medias = [s.cfoI, s.cfoII, s.cfoIII].filter((v): v is number => typeof v === "number");
        const mediaFinal = mediaSimples(medias);
        return {
          nome: s.nome,
          mediaFinal,
          rank: 0,
          cfoAverages: { cfoI: s.cfoI, cfoII: s.cfoII, cfoIII: s.cfoIII },
          gradesDetalhado: s.gradesDetalhado,
        } as unknown as DetailedStudent;
      });
```

Trocar para (troca `.values()` por `.entries()` pra recuperar a chave
`alunoId`, e acrescenta `aluno_id`/`matricula` no objeto retornado):

```ts
    const lista = Array.from(porAlunoId.entries())
      // Só entra na Classificação Geral quem tem nota nos 3 módulos — um
      // aluno que saiu do curso no meio (ex: só fez CFO I) continua aparecendo
      // normalmente no ranking daquele módulo, mas não na classificação final.
      .filter(([, s]) => typeof s.cfoI === "number" && typeof s.cfoII === "number" && typeof s.cfoIII === "number")
      .map(([alunoId, s]) => {
        const medias = [s.cfoI, s.cfoII, s.cfoIII].filter((v): v is number => typeof v === "number");
        const mediaFinal = mediaSimples(medias);
        return {
          aluno_id: alunoId,
          matricula: s.matricula,
          nome: s.nome,
          mediaFinal,
          rank: 0,
          cfoAverages: { cfoI: s.cfoI, cfoII: s.cfoII, cfoIII: s.cfoIII },
          gradesDetalhado: s.gradesDetalhado,
        } as unknown as DetailedStudent;
      });
```

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros (o cast `as unknown as DetailedStudent` já existia e
continua cobrindo os 2 campos novos).

- [ ] **Step 4: Commit**

```bash
git add src/pages/cfo/ClassificacaoGeral.tsx
git commit -m "feat: propaga aluno_id e matricula na Classificacao Geral"
```

---

### Task 6: Hook `useDadosBiograficosAluno`

**Files:**
- Create: `src/hooks/useDadosBiograficosAluno.ts`

**Interfaces:**
- Consumes: colunas da Task 1.
- Produces: `DadosBiograficosAluno` (interface), `useDadosBiograficosAluno(alunoId: string | null): { dados: DadosBiograficosAluno | null; loading: boolean; erro: string | null }`. Usado pela Task 8.

- [ ] **Step 1: Escrever o hook**

```ts
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface DadosBiograficosAluno {
  nome_completo: string;
  matricula: string | null;
  rg_pm: string | null;
  filiacao_pai: string | null;
  filiacao_mae: string | null;
  naturalidade: string | null;
  data_nascimento: string | null;
  matricula_academia: string | null;
  escola_anterior: string | null;
  ano_conclusao_ensino_medio: string | null;
  numero_registro_historico: number | null;
}

const CAMPOS =
  "nome_completo, matricula, rg_pm, filiacao_pai, filiacao_mae, naturalidade, " +
  "data_nascimento, matricula_academia, escola_anterior, ano_conclusao_ensino_medio, " +
  "numero_registro_historico";

/**
 * Busca os dados biográficos de um aluno (Fase 2 — Histórico Escolar), sob
 * demanda. Passar `null` não dispara busca nenhuma (usado quando o modal de
 * exportação ainda não foi aberto).
 */
export function useDadosBiograficosAluno(alunoId: string | null) {
  const [dados, setDados] = useState<DadosBiograficosAluno | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!alunoId) {
      setDados(null);
      setErro(null);
      return;
    }
    let cancelado = false;
    setLoading(true);
    setErro(null);
    supabase
      .from("profiles")
      .select(CAMPOS)
      .eq("id", alunoId)
      .single()
      .then(({ data, error }) => {
        if (cancelado) return;
        if (error) {
          setErro(error.message);
          setDados(null);
        } else {
          setDados(data as unknown as DadosBiograficosAluno);
        }
        setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [alunoId]);

  return { dados, loading, erro };
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useDadosBiograficosAluno.ts
git commit -m "feat: hook useDadosBiograficosAluno"
```

---

### Task 7: Gerador do Histórico (Word + Excel)

**Files:**
- Create: `src/utils/exportHistorico.ts`

**Interfaces:**
- Consumes: `TEXTO_INSTITUCIONAL_HISTORICO`, `TEXTO_LEGAL_ABERTURA/ADMISSAO/FECHAMENTO`
  (Task 4), `notaPorExtenso` (Task 4).
- Produces: `DisciplinaHistorico`, `DadosExportacaoHistorico` (interfaces),
  `montarDisciplinasHistorico(materias, cargaHoraria, detalhado, prefixo)`,
  `exportarHistoricoWord(dados)`, `exportarHistoricoExcel(dados)`. Usados pela
  Task 8.

- [ ] **Step 1: Escrever `src/utils/exportHistorico.ts`**

```ts
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  TextRun,
  AlignmentType,
  WidthType,
} from "docx";
import {
  TEXTO_INSTITUCIONAL_HISTORICO,
  TEXTO_LEGAL_ABERTURA,
  TEXTO_LEGAL_ADMISSAO,
  TEXTO_LEGAL_FECHAMENTO,
} from "@/config/documentosOficiais";
import { notaPorExtenso } from "@/utils/numeroExtenso";

const COR_VERMELHA = "FF0000";
const PLACEHOLDER = "______";

export interface DisciplinaHistorico {
  nome: string;
  cargaHoraria: number;
  mediaFinal: number | null;
}

export interface DadosExportacaoHistorico {
  nomeAluno: string;
  filiacaoPai: string | null;
  filiacaoMae: string | null;
  dataNascimento: string | null; // já formatada dd/mm/aaaa
  naturalidade: string | null;
  matricula: string | null;
  matriculaAcademia: string | null; // campo vermelho
  rgPm: string | null;
  escolaAnterior: string | null;
  anoConclusaoEnsinoMedio: string | null;
  disciplinasCfo1: DisciplinaHistorico[];
  disciplinasCfo2: DisciplinaHistorico[];
  disciplinasCfo3: DisciplinaHistorico[];
  anoLetivoCfo1: string | null;
  anoLetivoCfo2: string | null;
  anoLetivoCfo3: string | null;
  mediaCfo1: number | null;
  mediaCfo2: number | null;
  mediaCfo3: number | null;
  mediaFinal: number;
  rank: number | null;
  numeroRegistro: number;
  comandanteNome: string | null; // campo vermelho
  comandantePosto: string | null; // campo vermelho
  responsavelNome: string;
  responsavelPosto: string;
  responsavelFuncao: string;
  dataEmissao: string; // já formatada por extenso, ex: "11 de agosto de 2026"
}

/**
 * Cruza a lista oficial de disciplinas de um ano (MATERIAS_CFO1/2/3) com a
 * carga horária (CARGA_HORARIA_CFO1/2/3) e as notas já lançadas
 * (gradesDetalhado de ClassificacaoGeral.tsx, cujas chaves têm o sufixo
 * " (CFO I)"/" (CFO II)"/" (CFO III)").
 */
export function montarDisciplinasHistorico(
  materias: string[],
  cargaHoraria: Record<string, number>,
  detalhado: Record<string, { nota_final: number | null }>,
  prefixo: string
): DisciplinaHistorico[] {
  return materias.map((nome) => ({
    nome,
    cargaHoraria: cargaHoraria[nome] ?? 0,
    mediaFinal: detalhado[`${nome} (${prefixo})`]?.nota_final ?? null,
  }));
}

function nf(v: number | null): string {
  return v != null ? v.toFixed(3) : "";
}

function nomeArquivo(dados: DadosExportacaoHistorico, extensao: string) {
  const base = `historico_${dados.nomeAluno}`.replace(/\s+/g, "_");
  return `${base}.${extensao}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// --- Word ---

function runTexto(texto: string): TextRun {
  return new TextRun({ text: texto });
}

function runVermelho(valor: string | null): TextRun {
  return new TextRun({ text: valor && valor.trim() ? valor : PLACEHOLDER, color: COR_VERMELHA });
}

function paragrafoAbertura(dados: DadosExportacaoHistorico): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    children: [
      runTexto(TEXTO_LEGAL_ABERTURA + " "),
      runTexto(`${dados.nomeAluno}, brasileiro(a), filho(a) de `),
      runVermelho(dados.filiacaoPai),
      runTexto(" e "),
      runVermelho(dados.filiacaoMae),
      runTexto(", nascido(a) em "),
      runVermelho(dados.dataNascimento),
      runTexto(", natural de "),
      runVermelho(dados.naturalidade),
      runTexto(", matriculado(a) nesta Academia de Polícia Militar Costa Verde sob o número "),
      runVermelho(dados.matriculaAcademia),
      runTexto(" RG PMMT "),
      runVermelho(dados.rgPm),
      runTexto(`, ${TEXTO_LEGAL_ADMISSAO} no(a) `),
      runVermelho(dados.escolaAnterior),
      runTexto(", no ano de "),
      runVermelho(dados.anoConclusaoEnsinoMedio),
      runTexto(
        ", concluiu com aproveitamento o CURSO DE FORMAÇÃO DE OFICIAIS POLICIAIS MILITARES – CFO."
      ),
    ],
  });
}

function tabelaAno(
  titulo: string,
  anoLetivo: string | null,
  disciplinas: DisciplinaHistorico[],
  media: number | null
): (Paragraph | DocxTable)[] {
  const headerCell = (texto: string) =>
    new DocxTableCell({ children: [new Paragraph({ text: texto, alignment: AlignmentType.CENTER })] });
  const bodyCell = (texto: string) => new DocxTableCell({ children: [new Paragraph({ text: texto })] });
  const bodyCellBold = (texto: string) =>
    new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: texto, bold: true })] })] });

  const somaCargaHoraria = disciplinas.reduce((total, d) => total + d.cargaHoraria, 0);

  const tabela = new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new DocxTableRow({ children: ["Disciplina", "Carga Horária", "Média Final"].map(headerCell) }),
      ...disciplinas.map(
        (d) =>
          new DocxTableRow({
            children: [d.nome, String(d.cargaHoraria), nf(d.mediaFinal) || PLACEHOLDER].map(bodyCell),
          })
      ),
      new DocxTableRow({
        children: [
          bodyCellBold("Total da Carga Curricular e Média"),
          bodyCellBold(String(somaCargaHoraria)),
          bodyCellBold(nf(media) || PLACEHOLDER),
        ],
      }),
    ],
  });

  return [
    new Paragraph({
      children: [new TextRun({ text: `${titulo}${anoLetivo ? ` — ${anoLetivo}` : ""}`, bold: true })],
    }),
    tabela,
    new Paragraph({ text: "" }),
  ];
}

export async function exportarHistoricoWord(dados: DadosExportacaoHistorico) {
  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: TEXTO_INSTITUCIONAL_HISTORICO.linha1, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL_HISTORICO.linha2, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL_HISTORICO.linha3, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL_HISTORICO.linhaDiretoria, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL_HISTORICO.linha4, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL_HISTORICO.linha5, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "HISTÓRICO ESCOLAR", bold: true, size: 28 })],
          }),
          new Paragraph({ text: "" }),
          paragrafoAbertura(dados),
          new Paragraph({ text: "" }),
          ...tabelaAno("1º Ano CFO", dados.anoLetivoCfo1, dados.disciplinasCfo1, dados.mediaCfo1),
          ...tabelaAno("2º Ano CFO", dados.anoLetivoCfo2, dados.disciplinasCfo2, dados.mediaCfo2),
          ...tabelaAno("3º Ano CFO", dados.anoLetivoCfo3, dados.disciplinasCfo3, dados.mediaCfo3),
          new Paragraph({ text: `Registro nº: ${dados.numeroRegistro}` }),
          new Paragraph({
            text: `Nota de Aprovação: ${dados.mediaFinal.toFixed(3)} (${notaPorExtenso(dados.mediaFinal)})`,
          }),
          new Paragraph({ text: `Classificação: ${dados.rank ?? "—"}º Lugar` }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: TEXTO_LEGAL_FECHAMENTO, alignment: AlignmentType.JUSTIFIED }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: `APMCV em Várzea Grande-MT, ${dados.dataEmissao}.` }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: dados.responsavelNome.toUpperCase(), alignment: AlignmentType.CENTER }),
          new Paragraph({
            text: `${dados.responsavelPosto} — ${dados.responsavelFuncao}`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [runVermelho(dados.comandanteNome?.toUpperCase() ?? null)],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [runVermelho(dados.comandantePosto), runTexto(" — Comandante da APMCV")],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, nomeArquivo(dados, "docx"));
}

// --- Excel ---

export function exportarHistoricoExcel(dados: DadosExportacaoHistorico) {
  const wb = XLSX.utils.book_new();

  const abaDados = [
    [TEXTO_INSTITUCIONAL_HISTORICO.linha1],
    [TEXTO_INSTITUCIONAL_HISTORICO.linha2],
    [TEXTO_INSTITUCIONAL_HISTORICO.linha3],
    [TEXTO_INSTITUCIONAL_HISTORICO.linhaDiretoria],
    [TEXTO_INSTITUCIONAL_HISTORICO.linha4],
    [TEXTO_INSTITUCIONAL_HISTORICO.linha5],
    [],
    ["HISTÓRICO ESCOLAR"],
    [],
    ["Nome do aluno", dados.nomeAluno],
    ["Matrícula", dados.matricula ?? "—"],
    ["Matrícula na Academia", dados.matriculaAcademia ?? "—"],
    ["RG PMMT", dados.rgPm ?? "—"],
    ["Filiação (pai)", dados.filiacaoPai ?? "—"],
    ["Filiação (mãe)", dados.filiacaoMae ?? "—"],
    ["Data de nascimento", dados.dataNascimento ?? "—"],
    ["Naturalidade", dados.naturalidade ?? "—"],
    ["Escola anterior", dados.escolaAnterior ?? "—"],
    ["Ano de conclusão do 2º grau", dados.anoConclusaoEnsinoMedio ?? "—"],
    [],
    ["Registro nº", dados.numeroRegistro],
    ["Nota de Aprovação", `${dados.mediaFinal.toFixed(3)} (${notaPorExtenso(dados.mediaFinal)})`],
    ["Classificação", `${dados.rank ?? "—"}º Lugar`],
    [],
    ["Emitido em", dados.dataEmissao],
    [dados.responsavelNome, `${dados.responsavelPosto} — ${dados.responsavelFuncao}`],
    [dados.comandanteNome ?? "—", dados.comandantePosto ?? "—"],
  ];
  const wsDados = XLSX.utils.aoa_to_sheet(abaDados);
  XLSX.utils.book_append_sheet(wb, wsDados, "Dados");

  function abaAno(nomeAba: string, disciplinas: DisciplinaHistorico[], media: number | null) {
    const linhas = [
      ["Disciplina", "Carga Horária", "Média Final"],
      ...disciplinas.map((d) => [d.nome, d.cargaHoraria, d.mediaFinal ?? ""]),
      [],
      [
        "Total da Carga Curricular e Média",
        disciplinas.reduce((total, d) => total + d.cargaHoraria, 0),
        media ?? "",
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    XLSX.utils.book_append_sheet(wb, ws, nomeAba);
  }
  abaAno("1º Ano", dados.disciplinasCfo1, dados.mediaCfo1);
  abaAno("2º Ano", dados.disciplinasCfo2, dados.mediaCfo2);
  abaAno("3º Ano", dados.disciplinasCfo3, dados.mediaCfo3);

  XLSX.writeFile(wb, nomeArquivo(dados, "xlsx"));
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/utils/exportHistorico.ts
git commit -m "feat: gerador do Historico Escolar em Word e Excel"
```

---

### Task 8: Interface — botão "Exportar Histórico" na Classificação Geral

**Files:**
- Modify: `src/components/dashboard/StudentDetailsModal.tsx`

**Interfaces:**
- Consumes: `exportarHistoricoWord/Excel`, `montarDisciplinasHistorico` (Task 7),
  `useDadosBiograficosAluno` (Task 6), `CARGA_HORARIA_CFO1/2/3` (Task 4),
  `MATERIAS_CFO1/2/3` (já existem em `src/config/materiasCfo1/2/3.ts`),
  `dataPorExtenso` (Task 4), `useTurma().atribuirNumeroRegistroHistorico`
  (Task 2), `student.aluno_id`/`matricula` vindos de `AlunoModulo` (Task 5
  garante que o objeto de `ClassificacaoGeral.tsx` também os tem).

- [ ] **Step 1: Imports novos**

Os imports do topo hoje incluem:

```ts
import { useConfiguracaoTurma } from "@/contexts/TurmaContext";
import { exportarAlunoCSV, exportarAlunoPDF, exportarAlunoXLSX } from "@/utils/exportAluno";
import { exportarBoletimPDF, exportarBoletimWord, exportarBoletimExcel } from "@/utils/exportBoletim";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Award, AlertCircle, Download, FileText, FileSpreadsheet, FileDown, Loader2 } from "lucide-react";
```

Trocar para:

```ts
import { useConfiguracaoTurma, useTurma } from "@/contexts/TurmaContext";
import { exportarAlunoCSV, exportarAlunoPDF, exportarAlunoXLSX } from "@/utils/exportAluno";
import { exportarBoletimPDF, exportarBoletimWord, exportarBoletimExcel } from "@/utils/exportBoletim";
import {
  exportarHistoricoWord,
  exportarHistoricoExcel,
  montarDisciplinasHistorico,
  DadosExportacaoHistorico,
} from "@/utils/exportHistorico";
import { useDadosBiograficosAluno } from "@/hooks/useDadosBiograficosAluno";
import { MATERIAS_CFO1 } from "@/config/materiasCfo1";
import { MATERIAS_CFO2 } from "@/config/materiasCfo2";
import { MATERIAS_CFO3 } from "@/config/materiasCfo3";
import { CARGA_HORARIA_CFO1, CARGA_HORARIA_CFO2, CARGA_HORARIA_CFO3 } from "@/config/cargaHorariaCfo";
import { dataPorExtenso } from "@/utils/numeroExtenso";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { TrendingUp, TrendingDown, Award, AlertCircle, Download, FileText, FileSpreadsheet, FileDown, Loader2 } from "lucide-react";
```

- [ ] **Step 2: Hooks e estado**

A linha hoje:

```ts
  const { config } = useConfiguracaoTurma();
  const [boletimDialogAberto, setBoletimDialogAberto] = useState(false);
```

Trocar para:

```ts
  const { config } = useConfiguracaoTurma();
  const { atribuirNumeroRegistroHistorico } = useTurma();
  const [boletimDialogAberto, setBoletimDialogAberto] = useState(false);
```

Logo depois de `const [gerandoBoletim, setGerandoBoletim] = useState(false);`,
adicionar:

```ts
  const [historicoDialogAberto, setHistoricoDialogAberto] = useState(false);
  const [historicoFormato, setHistoricoFormato] = useState<"word" | "xlsx" | null>(null);
  const [historicoAlunoId, setHistoricoAlunoId] = useState<string | null>(null);
  const [gerandoHistorico, setGerandoHistorico] = useState(false);
  const { dados: bioAluno, loading: carregandoBio } = useDadosBiograficosAluno(historicoAlunoId);
```

- [ ] **Step 3: Funções de abrir diálogo e gerar**

Logo depois da função `gerarBoletim` (antes do `return (`), adicionar:

```ts
  function abrirDialogoHistorico(formato: "word" | "xlsx") {
    if (!student) return;
    setHistoricoFormato(formato);
    setHistoricoAlunoId((student as AlunoModulo).aluno_id);
    setHistoricoDialogAberto(true);
  }

  async function gerarHistorico() {
    if (!student || !historicoFormato || !bioAluno || !config.id) return;
    setGerandoHistorico(true);
    const alunoId = (student as AlunoModulo).aluno_id;
    const { numero, error } = await atribuirNumeroRegistroHistorico(alunoId, config.id);
    if (error || numero == null) {
      toast({ title: "Erro ao gerar número de registro", description: error ?? "", variant: "destructive" });
      setGerandoHistorico(false);
      return;
    }

    const cfoAverages = (student as any).cfoAverages ?? {};
    const dados: DadosExportacaoHistorico = {
      nomeAluno: student.nome,
      filiacaoPai: bioAluno.filiacao_pai,
      filiacaoMae: bioAluno.filiacao_mae,
      dataNascimento: bioAluno.data_nascimento
        ? new Date(bioAluno.data_nascimento).toLocaleDateString("pt-BR", { timeZone: "UTC" })
        : null,
      naturalidade: bioAluno.naturalidade,
      matricula: bioAluno.matricula,
      matriculaAcademia: bioAluno.matricula_academia,
      rgPm: bioAluno.rg_pm,
      escolaAnterior: bioAluno.escola_anterior,
      anoConclusaoEnsinoMedio: bioAluno.ano_conclusao_ensino_medio,
      disciplinasCfo1: montarDisciplinasHistorico(MATERIAS_CFO1, CARGA_HORARIA_CFO1, detalhado, "CFO I"),
      disciplinasCfo2: montarDisciplinasHistorico(MATERIAS_CFO2, CARGA_HORARIA_CFO2, detalhado, "CFO II"),
      disciplinasCfo3: montarDisciplinasHistorico(MATERIAS_CFO3, CARGA_HORARIA_CFO3, detalhado, "CFO III"),
      anoLetivoCfo1: config.ano_letivo_cfo1,
      anoLetivoCfo2: config.ano_letivo_cfo2,
      anoLetivoCfo3: config.ano_letivo_cfo3,
      mediaCfo1: cfoAverages.cfoI ?? null,
      mediaCfo2: cfoAverages.cfoII ?? null,
      mediaCfo3: cfoAverages.cfoIII ?? null,
      mediaFinal: student.mediaFinal,
      rank: student.rank,
      numeroRegistro: numero,
      comandanteNome: config.comandante_apmcv_nome,
      comandantePosto: config.comandante_apmcv_posto,
      responsavelNome: config.responsavel_assinatura_nome,
      responsavelPosto: config.responsavel_assinatura_posto,
      responsavelFuncao: config.responsavel_assinatura_funcao,
      dataEmissao: dataPorExtenso(new Date()),
    };

    if (historicoFormato === "word") await exportarHistoricoWord(dados);
    else exportarHistoricoExcel(dados);
    setGerandoHistorico(false);
    setHistoricoDialogAberto(false);
    setHistoricoFormato(null);
  }
```

- [ ] **Step 4: Botão no cabeçalho do modal**

No JSX, o bloco do menu "Exportar Boletim" hoje é:

```tsx
              {isAdmin && !daGeral && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <FileText className="w-4 h-4 mr-1" /> Exportar Boletim
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => abrirDialogoBoletim("word")}>
                      <FileText className="w-4 h-4 mr-2 text-blue-500" /> Word (.docx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => abrirDialogoBoletim("pdf")}>
                      <FileText className="w-4 h-4 mr-2 text-red-500" /> PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => abrirDialogoBoletim("xlsx")}>
                      <FileSpreadsheet className="w-4 h-4 mr-2 text-green-500" /> Excel (.xlsx)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
```

Adicionar logo depois (condição oposta — `daGeral`, não `!daGeral` — já que o
Histórico só faz sentido combinando os 3 módulos):

```tsx
              {isAdmin && daGeral && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <FileText className="w-4 h-4 mr-1" /> Exportar Histórico
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => abrirDialogoHistorico("word")}>
                      <FileText className="w-4 h-4 mr-2 text-blue-500" /> Word (.docx)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => abrirDialogoHistorico("xlsx")}>
                      <FileSpreadsheet className="w-4 h-4 mr-2 text-green-500" /> Excel (.xlsx)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
```

- [ ] **Step 5: Diálogo de exportação**

Logo depois do `</Dialog>` que fecha o diálogo do Boletim (o segundo
`<Dialog>` do arquivo, antes do `</Dialog>` final que fecha o componente
inteiro), adicionar um terceiro `<Dialog>` irmão:

```tsx
      <Dialog open={historicoDialogAberto} onOpenChange={(open) => !open && setHistoricoDialogAberto(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Exportar Histórico Escolar</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {carregandoBio ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Campos biográficos ainda não cadastrados aparecem em vermelho no documento
                  gerado, prontos para revisão antes da assinatura.
                </p>
                <Button onClick={gerarHistorico} disabled={gerandoHistorico} className="w-full">
                  {gerandoHistorico && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Gerar {historicoFormato === "word" ? "Word" : "Excel"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
```

- [ ] **Step 6: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/StudentDetailsModal.tsx
git commit -m "feat: botao Exportar Historico na Classificacao Geral"
```

---

### Task 9: Importação dos dados biográficos do 24º CFO

**Files:**
- Create: `scripts/importar-biograficos-cfo24.ts`

**Interfaces:**
- Consumes: colunas da Task 1 (`profiles.filiacao_pai/filiacao_mae/naturalidade/data_nascimento`).

- [ ] **Step 1: Escrever o script**

Roda uma vez, fora do build da aplicação — lê `Planilha dados cfo 24
.xlsx` (cabeçalho na linha 2: `NOME GUERRA, NOME, MATRICULA, RG, CPF, TEL,
EMAIL, NATURALIDADE, DATA NASC, IDADE, PAI, MAE, ENDEREÇO, ESTADO CIVIL,
TELEFONE DE EMERGENCIA, EXPERIENCIA ANTERIOR`, dados a partir da linha 3,
67 cadetes na aba principal).

```ts
// Script avulso — roda 1x via `npx tsx scripts/importar-biograficos-cfo24.ts`.
// Não faz parte do build da aplicação. Preenche filiacao_pai, filiacao_mae,
// naturalidade e data_nascimento dos alunos do 24º CFO a partir da planilha
// que o usuário enviou. Casa por matrícula (coluna D da planilha == coluna
// profiles.matricula); se não achar, tenta por CPF; se não achar de
// nenhum jeito, reporta e pula. rg_pm, escola_anterior e
// ano_conclusao_ensino_medio NÃO estão nesta planilha — continuam null.
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const CAMINHO_PLANILHA = process.env.CAMINHO_PLANILHA ?? "DASHBORD/Planilha dados cfo 24 .xlsx";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente antes de rodar.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface LinhaPlanilha {
  matricula: string | null;
  cpf: string | null;
  naturalidade: string | null;
  dataNascimento: string | null; // ISO yyyy-mm-dd
  pai: string | null;
  mae: string | null;
}

function lerPlanilha(): LinhaPlanilha[] {
  const wb = XLSX.readFile(CAMINHO_PLANILHA);
  const ws = wb.Sheets[wb.SheetNames[0]];
  // header: 1 => cada linha vira um array posicional (mesma ordem das
  // colunas da planilha), começando do topo real do arquivo (linha 1 = A).
  const linhas: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
  const resultado: LinhaPlanilha[] = [];
  // Linha 0 = título mesclado, linha 1 = cabeçalho, dados a partir da linha 2 (índice 2).
  for (let i = 2; i < linhas.length; i++) {
    const linha = linhas[i];
    const matricula = linha[3] != null ? String(linha[3]).trim() : null;
    if (!matricula && !linha[2]) continue; // linha vazia (fim da planilha)
    resultado.push({
      matricula: matricula || null,
      cpf: linha[5] != null ? String(linha[5]).trim() : null,
      naturalidade: linha[8] != null ? String(linha[8]).trim() : null,
      dataNascimento: linha[9] ? new Date(linha[9] as string).toISOString().slice(0, 10) : null,
      pai: linha[11] != null ? String(linha[11]).trim() : null,
      mae: linha[12] != null ? String(linha[12]).trim() : null,
    });
  }
  return resultado;
}

async function main() {
  const linhas = lerPlanilha();
  console.log(`Lidas ${linhas.length} linhas da planilha.`);

  let atualizados = 0;
  let naoEncontrados = 0;

  for (const linha of linhas) {
    let alunoId: string | null = null;

    if (linha.matricula) {
      const { data } = await supabase.from("profiles").select("id").eq("matricula", linha.matricula).maybeSingle();
      alunoId = data?.id ?? null;
    }
    if (!alunoId && linha.cpf) {
      const { data } = await supabase.from("profiles").select("id").eq("cpf", linha.cpf).maybeSingle();
      alunoId = data?.id ?? null;
    }
    if (!alunoId) {
      console.warn(`Não encontrado: matrícula=${linha.matricula} cpf=${linha.cpf}`);
      naoEncontrados++;
      continue;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        naturalidade: linha.naturalidade,
        data_nascimento: linha.dataNascimento,
        filiacao_pai: linha.pai,
        filiacao_mae: linha.mae,
      })
      .eq("id", alunoId);

    if (error) {
      console.error(`Erro ao atualizar ${alunoId}:`, error.message);
    } else {
      atualizados++;
    }
  }

  console.log(`Concluído: ${atualizados} atualizados, ${naoEncontrados} não encontrados.`);
}

main();
```

- [ ] **Step 2: Rodar**

```bash
npx tsx scripts/importar-biograficos-cfo24.ts
```

(Precisa de `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente — pegar
no painel do Supabase, Settings → API. Se `tsx` não estiver disponível:
`npm install -D tsx` primeiro.)

Esperado: log final tipo `Concluído: 67 atualizados, 0 não encontrados.` Se
`naoEncontrados > 0`, conferir manualmente esses casos (nome de guerra pode
ajudar a achar o aluno certo pra corrigir a matrícula/CPF no cadastro antes
de rodar de novo).

- [ ] **Step 3: Commit**

```bash
git add scripts/importar-biograficos-cfo24.ts
git commit -m "feat: script de importacao dos dados biograficos do 24o CFO"
```

---

### Task 10: Build final e checklist de conferência manual

**Files:**
- Nenhum arquivo novo — só validação.

- [ ] **Step 1: Build completo**

Run: `npm install && npx tsc --noEmit -p tsconfig.app.json && npx vite build`
Expected: build termina sem erros.

- [ ] **Step 2: Checklist de conferência manual (pedir ao usuário)**

Depois da migração rodada e do código em produção, pedir para o usuário,
logado como admin:

1. Em "Personalização", preencher nome/posto do Comandante da APMCV e
   confirmar que salva.
2. Abrir "Classificação Geral", clicar num aluno que tenha nota nos 3
   módulos → "Exportar Histórico" → Word. Conferir:
   - Cabeçalho com a linha "DIRETORIA DE ENSINO, INSTRUÇÃO E PESQUISA".
   - Parágrafo de abertura com os dados do aluno; campos ainda não
     cadastrados (RG PM, escola anterior, matrícula-academia) aparecem em
     vermelho com `______`.
   - Nome/posto do Comandante da APMCV aparece em vermelho (mesmo já
     preenchido — é sempre vermelho, por ser sujeito a revisão).
   - 3 tabelas de disciplinas com carga horária e nota, totais no fim de
     cada uma.
   - "Nota de Aprovação" com o número por extenso correto (comparar
     manualmente pelo menos um caso, ex: 8.576 deve virar "oito vírgula
     quinhentos e setenta e seis").
   - "Registro nº" preenchido.
3. Exportar o Histórico do **mesmo aluno** de novo — conferir que o
   "Registro nº" **não mudou**.
4. Repetir a exportação em Excel — conferir as 4 abas (Dados, 1º/2º/3º Ano).
5. Abrir um aluno que **não** tem nota nos 3 módulos (só apareceria em
   CFO I/II/III, não na Classificação Geral) — confirmar que ele nem entra
   na lista da Classificação Geral, então o botão nunca é uma opção pra ele.
6. Logar como aluno comum e confirmar que "Exportar Histórico" **não
   aparece** em lugar nenhum.
7. Rodar o script de importação do 24º CFO (Task 9) contra produção e
   conferir no banco que pelo menos 1 aluno da planilha teve
   `naturalidade`/`data_nascimento`/`filiacao_pai`/`filiacao_mae`
   preenchidos.

- [ ] **Step 3: Commit final (se a conferência pedir ajuste) ou encerrar**

Se nada precisar de ajuste, a Task 9 já é o estado final. Se pedir ajuste,
aplicar e commitar normalmente.
