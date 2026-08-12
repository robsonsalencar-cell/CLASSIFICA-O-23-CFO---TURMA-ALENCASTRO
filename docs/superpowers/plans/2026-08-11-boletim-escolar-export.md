# Emissão de Boletim Escolar (Fase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que admin/desenvolvedor exportem o Boletim Escolar de um aluno (por módulo CFO I/II/III) em Word, PDF e Excel, fiel ao modelo oficial da APMCV, sem alterar nenhuma fórmula/ranking existente.

**Architecture:** Tudo client-side, seguindo o padrão já usado em `src/utils/exportAluno.ts` (jsPDF+autoTable pro PDF, `xlsx` pro Excel) mais o pacote novo `docx` pro Word. Três novos campos de banco (matrícula, ano letivo/assinatura por turma, 2ª época por matéria) alimentam o documento; nenhum deles entra em `estatisticas_modulo`, `estatisticas_classificacao_geral` ou `useAlunosModulo.ts` (cálculo de `nota_final`/ranking/média).

**Tech Stack:** React + TypeScript + Vite, Supabase (Postgres + Edge Functions), `jspdf`/`jspdf-autotable`/`xlsx` (já instalados) + `docx` (novo).

## Global Constraints

- `verif_2a_epoca`/`media_2a_epoca` são **só impressão** — nunca usados em `estatisticas_modulo`, `estatisticas_classificacao_geral`, `useAlunosModulo.ts` ou em qualquer ranking/média.
- Botão/menu de exportação do Boletim só aparece para `isAdmin` (admin ou desenvolvedor) — mesmo padrão já usado em `RankingTable.tsx` (`podeExportar={isAdmin}`).
- Responsável pela assinatura vem do banco (`turmas.responsavel_assinatura_*`), nunca hardcoded no componente/gerador.
- Nenhuma mudança em RLS, em `estatisticas_modulo`/`estatisticas_classificacao_geral`, ou em qualquer fórmula de nota já auditada.
- Campo sem dado (matrícula vazia, etc.) aparece como `"—"` no documento gerado — nunca lança exceção.
- Validação: `npx tsc --noEmit -p tsconfig.app.json` + `npx vite build` depois de cada task com mudança de código.
- Mudança de Edge Function exige redeploy manual no Supabase (Edge Functions → colar código → Deploy) — não é automático via push no GitHub.
- Migração SQL é entregue pronta para o usuário rodar no SQL Editor do Supabase (sem acesso direto ao banco neste ambiente).

---

### Task 1: Migração SQL — novos campos

**Files:**
- Create: `supabase/migration_13.sql`

**Interfaces:**
- Produces: colunas `profiles.matricula`, `turmas.ano_letivo_cfo1/2/3`,
  `turmas.responsavel_assinatura_nome/posto/funcao`,
  `notas_cfo1/2/3.verif_2a_epoca`/`media_2a_epoca` — todas usadas pelas
  Tasks 2-8.

- [ ] **Step 1: Escrever a migração**

Criar `supabase/migration_13.sql`:

```sql
-- ============================================================
-- MIGRAÇÃO 13 — Campos novos para o Boletim Escolar (Fase 1 da
-- emissão de relatórios): matrícula do aluno, ano letivo e
-- responsável pela assinatura por turma, e verificação de 2ª
-- época por matéria. Nenhum desses campos entra em nenhum
-- cálculo de nota_final/ranking/média — são só de exibição no
-- documento exportado.
-- ============================================================

alter table public.profiles
  add column if not exists matricula text;

alter table public.turmas
  add column if not exists ano_letivo_cfo1 text,
  add column if not exists ano_letivo_cfo2 text,
  add column if not exists ano_letivo_cfo3 text,
  add column if not exists responsavel_assinatura_nome text
    not null default 'Matheus Vitor Xavier Moraes Pereira',
  add column if not exists responsavel_assinatura_posto text
    not null default '2º Ten PM',
  add column if not exists responsavel_assinatura_funcao text
    not null default 'Gerente Subalterno da Secretaria de Registros Acadêmicos';

alter table public.notas_cfo1
  add column if not exists verif_2a_epoca numeric,
  add column if not exists media_2a_epoca numeric;
alter table public.notas_cfo2
  add column if not exists verif_2a_epoca numeric,
  add column if not exists media_2a_epoca numeric;
alter table public.notas_cfo3
  add column if not exists verif_2a_epoca numeric,
  add column if not exists media_2a_epoca numeric;
```

- [ ] **Step 2: Entregar para o usuário rodar**

Parar aqui e pedir para o usuário colar o conteúdo de
`supabase/migration_13.sql` no SQL Editor do Supabase e rodar. Pedir para
confirmar rodando:

```sql
select matricula from public.profiles limit 1;
select ano_letivo_cfo1, responsavel_assinatura_nome, responsavel_assinatura_posto, responsavel_assinatura_funcao from public.turmas limit 1;
select verif_2a_epoca, media_2a_epoca from public.notas_cfo1 limit 1;
```

Esperado: as 3 queries rodam sem erro (linhas podem vir com valor `null`,
exceto os 3 campos de assinatura que já vêm preenchidos com o padrão).

- [ ] **Step 3: Commit**

```bash
git add supabase/migration_13.sql
git commit -m "feat(db): adiciona matricula, ano letivo, assinatura e 2a epoca"
```

---

### Task 2: Tipos e hooks — propagar os novos campos

**Files:**
- Modify: `src/lib/supabaseClient.ts`
- Modify: `src/hooks/useNotasModulo.ts`
- Modify: `src/hooks/useAlunosModulo.ts`
- Modify: `src/contexts/TurmaContext.tsx`

**Interfaces:**
- Consumes: colunas da Task 1.
- Produces: `Profile.matricula: string | null`; `NotaRow.verif_2a_epoca`/
  `media_2a_epoca: number | null` e `NotaRow.aluno_matricula?: string`;
  `salvarNota(params)` aceita `verif_2a_epoca`/`media_2a_epoca`;
  `DetalheMateria.verif_2a_epoca`/`media_2a_epoca: number | null`;
  `AlunoModulo.matricula: string | null`; `Turma.ano_letivo_cfo1/2/3:
  string | null` e `Turma.responsavel_assinatura_nome/posto/funcao:
  string`; `useTurma().atualizarDadosBoletim(id, dados)`. Usados pelas
  Tasks 3, 4, 5, 7, 8.

- [ ] **Step 1: `src/lib/supabaseClient.ts`**

A interface `Profile` hoje é:

```ts
export interface Profile {
  id: string;
  nome_completo: string;
  email: string;
  cpf: string | null;
  role: AppRole;
  turma_id: string | null;
  senha_trocada: boolean;
  created_at: string;
}
```

Adicionar `matricula`:

```ts
export interface Profile {
  id: string;
  nome_completo: string;
  email: string;
  cpf: string | null;
  matricula: string | null;
  role: AppRole;
  turma_id: string | null;
  senha_trocada: boolean;
  created_at: string;
}
```

- [ ] **Step 2: `src/hooks/useNotasModulo.ts`**

A interface `NotaRow` hoje é:

```ts
export interface NotaRow {
  id: string;
  aluno_id: string;
  materia: string;
  vc: number | null;
  vc_lista: number[] | null;
  vf: number | null;
  nota_final: number | null;
  updated_at: string;
  // preenchido via join manual com profiles, para exibição no admin
  aluno_nome?: string;
}
```

Trocar para:

```ts
export interface NotaRow {
  id: string;
  aluno_id: string;
  materia: string;
  vc: number | null;
  vc_lista: number[] | null;
  vf: number | null;
  nota_final: number | null;
  verif_2a_epoca: number | null;
  media_2a_epoca: number | null;
  updated_at: string;
  // preenchido via join manual com profiles, para exibição no admin
  aluno_nome?: string;
  aluno_matricula?: string | null;
}
```

O `select` dentro de `fetchData` hoje é:

```ts
    let query = supabase
      .from(tabela)
      .select(
        verTurmaInteira
          ? "id, aluno_id, materia, vc, vc_lista, vf, nota_final, updated_at, profiles(nome_completo)"
          : "id, aluno_id, materia, vc, vc_lista, vf, nota_final, updated_at"
      );
```

Trocar para (acrescenta `verif_2a_epoca, media_2a_epoca` nas duas
variantes, e `matricula` no join que só roda quando `verTurmaInteira`):

```ts
    let query = supabase
      .from(tabela)
      .select(
        verTurmaInteira
          ? "id, aluno_id, materia, vc, vc_lista, vf, nota_final, verif_2a_epoca, media_2a_epoca, updated_at, profiles(nome_completo, matricula)"
          : "id, aluno_id, materia, vc, vc_lista, vf, nota_final, verif_2a_epoca, media_2a_epoca, updated_at"
      );
```

O mapeamento do resultado hoje é:

```ts
      const mapped = (data ?? []).map((r: any) => ({
        ...r,
        aluno_nome: r.profiles?.nome_completo,
      }));
```

Trocar para:

```ts
      const mapped = (data ?? []).map((r: any) => ({
        ...r,
        aluno_nome: r.profiles?.nome_completo,
        aluno_matricula: r.profiles?.matricula ?? null,
      }));
```

A assinatura de `salvarNota` hoje é:

```ts
  async function salvarNota(params: {
    aluno_id: string;
    materia: string;
    vc_lista?: number[] | null;
    vf?: number | null;
    nota_final?: number | null;
  }) {
```

Trocar para:

```ts
  async function salvarNota(params: {
    aluno_id: string;
    materia: string;
    vc_lista?: number[] | null;
    vf?: number | null;
    nota_final?: number | null;
    verif_2a_epoca?: number | null;
    media_2a_epoca?: number | null;
  }) {
```

(O corpo da função não muda — ela já faz `upsert({ ...params, ... })`,
então os campos novos passam a ser gravados automaticamente quando
presentes no `params`.)

- [ ] **Step 3: `src/hooks/useAlunosModulo.ts`**

A interface `DetalheMateria` hoje é:

```ts
export interface DetalheMateria {
  nota_final: number | null;
  vc_lista: number[];
  vf: number | null;
}
```

Trocar para:

```ts
export interface DetalheMateria {
  nota_final: number | null;
  vc_lista: number[];
  vf: number | null;
  verif_2a_epoca: number | null;
  media_2a_epoca: number | null;
}
```

Dentro de `useAlunosModulo`, o tipo do Map interno hoje é:

```ts
  const porAluno = new Map<
    string,
    { nome: string; grades: Record<string, number>; detalhado: Record<string, DetalheMateria> }
  >();
```

Trocar para (acrescenta `matricula`):

```ts
  const porAluno = new Map<
    string,
    {
      nome: string;
      matricula: string | null;
      grades: Record<string, number>;
      detalhado: Record<string, DetalheMateria>;
    }
  >();
```

O trecho que inicializa uma entrada nova hoje é:

```ts
    for (const row of rows) {
      if (!porAluno.has(row.aluno_id)) {
        porAluno.set(row.aluno_id, { nome: row.aluno_nome ?? "—", grades: {}, detalhado: {} });
      }
      const entrada = porAluno.get(row.aluno_id)!;
      if (row.nota_final !== null) {
        entrada.grades[row.materia] = row.nota_final;
      }
      entrada.detalhado[row.materia] = {
        nota_final: row.nota_final,
        vc_lista: row.vc_lista ?? [],
        vf: row.vf,
      };
    }
```

Trocar para:

```ts
    for (const row of rows) {
      if (!porAluno.has(row.aluno_id)) {
        porAluno.set(row.aluno_id, {
          nome: row.aluno_nome ?? "—",
          matricula: row.aluno_matricula ?? null,
          grades: {},
          detalhado: {},
        });
      }
      const entrada = porAluno.get(row.aluno_id)!;
      if (row.nota_final !== null) {
        entrada.grades[row.materia] = row.nota_final;
      }
      entrada.detalhado[row.materia] = {
        nota_final: row.nota_final,
        vc_lista: row.vc_lista ?? [],
        vf: row.vf,
        verif_2a_epoca: row.verif_2a_epoca,
        media_2a_epoca: row.media_2a_epoca,
      };
    }
```

A interface `AlunoModulo` hoje é:

```ts
export interface AlunoModulo extends DetailedStudent {
  aluno_id: string;
  gradesDetalhado: Record<string, DetalheMateria>;
}
```

Trocar para:

```ts
export interface AlunoModulo extends DetailedStudent {
  aluno_id: string;
  matricula: string | null;
  gradesDetalhado: Record<string, DetalheMateria>;
}
```

E no `provisorio.map(...)` dentro do `useMemo`, hoje:

```ts
    const provisorio = Array.from(porAluno.entries()).map(([alunoId, { nome, grades, detalhado }]) => {
      const valores = Object.values(grades);
      const mediaFinal = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;

      return {
        ...CAMPOS_LEGADOS_ZERADOS,
        aluno_id: alunoId,
        nome,
        mediaFinal,
        rank: 0,
        grades,
        gradesDetalhado: detalhado,
      } as AlunoModulo;
    });
```

Trocar para:

```ts
    const provisorio = Array.from(porAluno.entries()).map(([alunoId, { nome, matricula, grades, detalhado }]) => {
      const valores = Object.values(grades);
      const mediaFinal = valores.length > 0 ? valores.reduce((a, b) => a + b, 0) / valores.length : 0;

      return {
        ...CAMPOS_LEGADOS_ZERADOS,
        aluno_id: alunoId,
        matricula,
        nome,
        mediaFinal,
        rank: 0,
        grades,
        gradesDetalhado: detalhado,
      } as AlunoModulo;
    });
```

- [ ] **Step 4: `src/contexts/TurmaContext.tsx`**

A interface `Turma` hoje é:

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
  created_at: string;
}
```

`TURMA_PADRAO` hoje é:

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
  created_at: new Date().toISOString(),
};
```

Adicionar ao `interface TurmaContextValue` (logo abaixo de
`alternarRankingPublico`):

```ts
  atualizarDadosBoletim: (
    id: string,
    dados: {
      ano_letivo_cfo1: string;
      ano_letivo_cfo2: string;
      ano_letivo_cfo3: string;
      responsavel_assinatura_nome: string;
      responsavel_assinatura_posto: string;
      responsavel_assinatura_funcao: string;
    }
  ) => Promise<{ error: string | null }>;
```

Adicionar a implementação da função (logo depois de `alternarRankingPublico`,
antes do `return (`):

```ts
  async function atualizarDadosBoletim(
    id: string,
    dados: {
      ano_letivo_cfo1: string;
      ano_letivo_cfo2: string;
      ano_letivo_cfo3: string;
      responsavel_assinatura_nome: string;
      responsavel_assinatura_posto: string;
      responsavel_assinatura_funcao: string;
    }
  ) {
    const { error } = await supabase.from("turmas").update(dados).eq("id", id);
    if (!error) await carregar();
    return { error: error?.message ?? null };
  }
```

E adicionar `atualizarDadosBoletim` ao objeto passado em
`<TurmaContext.Provider value={{ ... }}>` (junto dos outros, depois de
`alternarRankingPublico,`).

- [ ] **Step 5: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros (todos os campos novos são opcionais/têm default, e
nenhum consumidor existente quebra por ganhar campos a mais).

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabaseClient.ts src/hooks/useNotasModulo.ts src/hooks/useAlunosModulo.ts src/contexts/TurmaContext.tsx
git commit -m "feat: propaga matricula, ano letivo, assinatura e 2a epoca nos tipos/hooks"
```

---

### Task 3: Painel Personalização — ano letivo e assinatura

**Files:**
- Modify: `src/pages/admin/AdminPersonalizacao.tsx`

**Interfaces:**
- Consumes: `useTurma().atualizarDadosBoletim` (Task 2), `config.ano_letivo_cfo1/2/3`,
  `config.responsavel_assinatura_nome/posto/funcao`.

- [ ] **Step 1: Importar o novo hook e adicionar estado**

No topo do componente, a linha:

```ts
  const { turmas, turmaAtualId, setTurmaAtualId, criarTurma, atualizarTextoCabecalho } = useTurma();
```

Trocar para:

```ts
  const { turmas, turmaAtualId, setTurmaAtualId, criarTurma, atualizarTextoCabecalho, atualizarDadosBoletim } = useTurma();
```

Logo abaixo dos estados de `tituloPaginaModulo`/`tituloPaginaGeral`/
`subtituloPagina`/`salvandoCabecalho`, adicionar:

```ts
  const [anoLetivoCfo1, setAnoLetivoCfo1] = useState(config.ano_letivo_cfo1 ?? "");
  const [anoLetivoCfo2, setAnoLetivoCfo2] = useState(config.ano_letivo_cfo2 ?? "");
  const [anoLetivoCfo3, setAnoLetivoCfo3] = useState(config.ano_letivo_cfo3 ?? "");
  const [respNome, setRespNome] = useState(config.responsavel_assinatura_nome);
  const [respPosto, setRespPosto] = useState(config.responsavel_assinatura_posto);
  const [respFuncao, setRespFuncao] = useState(config.responsavel_assinatura_funcao);
  const [salvandoBoletim, setSalvandoBoletim] = useState(false);
```

No `useEffect` que re-sincroniza os campos ao trocar de turma, hoje:

```ts
  useEffect(() => {
    setNomeTurma(config.nome_turma);
    setSubtitulo(config.subtitulo_turma);
    setTituloPaginaModulo(config.titulo_pagina_modulo);
    setTituloPaginaGeral(config.titulo_pagina_geral);
    setSubtituloPagina(config.subtitulo_pagina);
  }, [config.id]);
```

Trocar para:

```ts
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
  }, [config.id]);
```

- [ ] **Step 2: Handler de salvar**

Logo depois de `handleSalvarCabecalho`, adicionar:

```ts
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
```

- [ ] **Step 3: Novo card na UI**

Logo depois do `</Card>` que fecha o card "Texto do cabeçalho das páginas"
(antes do card "Cadastrar nova turma"), adicionar:

```tsx
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
```

- [ ] **Step 4: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/AdminPersonalizacao.tsx
git commit -m "feat: campos de ano letivo e assinatura no painel Personalizacao"
```

---

### Task 4: Matrícula no cadastro/edição de aluno

**Files:**
- Modify: `supabase/functions/admin-update-user/index.ts`
- Modify: `supabase/functions/admin-create-user/index.ts`
- Modify: `src/pages/admin/AdminUsersPanel.tsx`

**Interfaces:**
- Consumes: `Profile.matricula` (Task 2).
- Produces: campo `matricula` gravável via `admin-create-user`/
  `admin-update-user`, editável no painel.

- [ ] **Step 1: `admin-update-user/index.ts`**

A linha que desestrutura o body hoje:

```ts
    const { user_id, nome_completo, email, cpf, role, nova_senha, turma_id } = await req.json();
```

Trocar para:

```ts
    const { user_id, nome_completo, email, cpf, matricula, role, nova_senha, turma_id } = await req.json();
```

O bloco que monta o `patch` hoje:

```ts
    const patch: Record<string, unknown> = {};
    if (nome_completo) patch.nome_completo = nome_completo;
    if (email) patch.email = email;
    if (cpf !== undefined) patch.cpf = cpf || null;
    if (role) patch.role = role;
    if (turma_id) patch.turma_id = turma_id;
```

Trocar para:

```ts
    const patch: Record<string, unknown> = {};
    if (nome_completo) patch.nome_completo = nome_completo;
    if (email) patch.email = email;
    if (cpf !== undefined) patch.cpf = cpf || null;
    if (matricula !== undefined) patch.matricula = matricula || null;
    if (role) patch.role = role;
    if (turma_id) patch.turma_id = turma_id;
```

- [ ] **Step 2: `admin-create-user/index.ts`**

A linha que desestrutura o body hoje:

```ts
    const { email, nome_completo, cpf, senha_provisoria, role, turma_id } = await req.json();
```

Trocar para:

```ts
    const { email, nome_completo, cpf, matricula, senha_provisoria, role, turma_id } = await req.json();
```

O trigger `on_auth_user_created` (que cria a linha em `profiles`
automaticamente a partir de `user_metadata`) não conhece `turma_id` nem
vai conhecer `matricula` — por isso o código já faz um `update` de
`turma_id` logo depois de criar o usuário. Esse trecho hoje é:

```ts
    // O profile é criado automaticamente pelo trigger on_auth_user_created (ver schema.sql);
    // aqui só precisamos gravar o turma_id, que o trigger não conhece.
    const { error: turmaError } = await adminClient
      .from("profiles")
      .update({ turma_id })
      .eq("id", created.user.id);
```

Trocar para (acrescenta `matricula` no mesmo update):

```ts
    // O profile é criado automaticamente pelo trigger on_auth_user_created (ver schema.sql);
    // aqui só precisamos gravar o turma_id e a matrícula, que o trigger não conhece.
    const { error: turmaError } = await adminClient
      .from("profiles")
      .update({ turma_id, matricula: matricula || null })
      .eq("id", created.user.id);
```

- [ ] **Step 3: `AdminUsersPanel.tsx` — formulário de cadastro**

A interface `EdicaoState` hoje é:

```ts
interface EdicaoState {
  nome_completo: string;
  email: string;
  cpf: string;
  role: "aluno" | "admin" | "desenvolvedor";
  nova_senha: string;
}
```

Trocar para:

```ts
interface EdicaoState {
  nome_completo: string;
  email: string;
  cpf: string;
  matricula: string;
  role: "aluno" | "admin" | "desenvolvedor";
  nova_senha: string;
}
```

No formulário de cadastro (novo usuário), adicionar estado junto de `cpf`:

```ts
  const [matriculaNovo, setMatriculaNovo] = useState("");
```

No `handleCriarUsuario`, a chamada da Edge Function hoje é:

```ts
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { nome_completo: nome, email, cpf: cpf || null, senha_provisoria: senha, role, turma_id: turmaAtualId },
    });
```

Trocar para:

```ts
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: {
        nome_completo: nome,
        email,
        cpf: cpf || null,
        matricula: matriculaNovo || null,
        senha_provisoria: senha,
        role,
        turma_id: turmaAtualId,
      },
    });
```

Depois do `toast({ title: "Aluno cadastrado com sucesso", ... })`, junto dos
outros `set...("")`, adicionar `setMatriculaNovo("");`.

No JSX do formulário de cadastro, o grid hoje é `md:grid-cols-5` (5
campos: Nome, E-mail, CPF, Senha, Perfil) mais um `div` de botão com
`md:col-span-5`. Como vamos acrescentar um 6º campo, a linha:

```tsx
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
```

vira:

```tsx
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
```

E o `div` do botão, hoje:

```tsx
            <div className="md:col-span-5 flex justify-end">
```

vira:

```tsx
            <div className="md:col-span-6 flex justify-end">
```

O campo CPF hoje é:

```tsx
            <div className="space-y-1">
              <Label>CPF (opcional)</Label>
              <Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" />
            </div>
```

Adicionar um campo irmão logo depois dele:

```tsx
            <div className="space-y-1">
              <Label>Matrícula (opcional)</Label>
              <Input value={matriculaNovo} onChange={(e) => setMatriculaNovo(e.target.value)} placeholder="ex: 23.0001.1" />
            </div>
```

- [ ] **Step 4: `AdminUsersPanel.tsx` — edição inline**

`iniciarEdicao` hoje é:

```ts
  function iniciarEdicao(p: Profile) {
    setEditandoId(p.id);
    setEdicao({
      nome_completo: p.nome_completo,
      email: p.email,
      cpf: p.cpf ?? "",
      role: p.role,
      nova_senha: "",
    });
  }
```

Trocar para:

```ts
  function iniciarEdicao(p: Profile) {
    setEditandoId(p.id);
    setEdicao({
      nome_completo: p.nome_completo,
      email: p.email,
      cpf: p.cpf ?? "",
      matricula: p.matricula ?? "",
      role: p.role,
      nova_senha: "",
    });
  }
```

`salvarEdicao` hoje envia (dentro de `body: {...}`):

```ts
      body: {
        user_id: userId,
        nome_completo: edicao.nome_completo,
        email: edicao.email,
        cpf: edicao.cpf || null,
        role: edicao.role,
        nova_senha: edicao.nova_senha || undefined,
      },
```

Trocar para:

```ts
      body: {
        user_id: userId,
        nome_completo: edicao.nome_completo,
        email: edicao.email,
        cpf: edicao.cpf || null,
        matricula: edicao.matricula || null,
        role: edicao.role,
        nova_senha: edicao.nova_senha || undefined,
      },
```

O cabeçalho da tabela hoje é:

```tsx
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead className="w-32 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
```

Trocar para (acrescenta "Matrícula" logo depois de "CPF"):

```tsx
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead className="w-32 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
```

Na linha em modo de edição, o bloco do `Input` de CPF hoje é:

```tsx
                            <TableCell>
                              <Input
                                className="h-8"
                                value={edicao.cpf}
                                onChange={(e) => setEdicao({ ...edicao, cpf: e.target.value })}
                                placeholder="—"
                              />
                            </TableCell>
                            <TableCell>
                              <select
                                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                                value={edicao.role}
                                onChange={(e) => setEdicao({ ...edicao, role: e.target.value as "aluno" | "admin" })}
                              >
```

Trocar para (insere uma `TableCell` de Matrícula entre a de CPF e a de
Perfil):

```tsx
                            <TableCell>
                              <Input
                                className="h-8"
                                value={edicao.cpf}
                                onChange={(e) => setEdicao({ ...edicao, cpf: e.target.value })}
                                placeholder="—"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8"
                                value={edicao.matricula}
                                onChange={(e) => setEdicao({ ...edicao, matricula: e.target.value })}
                                placeholder="—"
                              />
                            </TableCell>
                            <TableCell>
                              <select
                                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                                value={edicao.role}
                                onChange={(e) => setEdicao({ ...edicao, role: e.target.value as "aluno" | "admin" })}
                              >
```

Na linha em modo normal (não-editando), o trecho hoje é:

```tsx
                            <TableCell className="font-medium">{p.nome_completo}</TableCell>
                            <TableCell>{p.email}</TableCell>
                            <TableCell>{p.cpf ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant={p.role === "aluno" ? "secondary" : "default"}>
```

Trocar para (insere a célula de Matrícula entre CPF e o Badge de Perfil):

```tsx
                            <TableCell className="font-medium">{p.nome_completo}</TableCell>
                            <TableCell>{p.email}</TableCell>
                            <TableCell>{p.cpf ?? "—"}</TableCell>
                            <TableCell>{p.matricula ?? "—"}</TableCell>
                            <TableCell>
                              <Badge variant={p.role === "aluno" ? "secondary" : "default"}>
```

- [ ] **Step 5: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 6: Commit e aviso de redeploy**

```bash
git add supabase/functions/admin-update-user/index.ts supabase/functions/admin-create-user/index.ts src/pages/admin/AdminUsersPanel.tsx
git commit -m "feat: campo matricula no cadastro/edicao de aluno"
```

Ao chegar nesta task durante a execução, avisar o usuário: **as duas Edge
Functions (`admin-create-user`, `admin-update-user`) precisam de redeploy
manual no Supabase** (Edge Functions → colar código atualizado → Deploy) —
push no GitHub sozinho não atualiza a função.

---

### Task 5: Verif. 2ª Época no lançamento de nota

**Files:**
- Modify: `src/pages/admin/AdminGradesEditor.tsx`

**Interfaces:**
- Consumes: `salvarNota` aceitando `verif_2a_epoca`/`media_2a_epoca` (Task 2).

- [ ] **Step 1: Estado do formulário de novo lançamento**

Junto dos outros estados do formulário de novo lançamento (`novoVc`,
`novoVf`, etc.), adicionar:

```ts
  const [novoVerif2aEpoca, setNovoVerif2aEpoca] = useState("");
  const [novoMedia2aEpoca, setNovoMedia2aEpoca] = useState("");
```

`handleNovoLancamento` hoje chama:

```ts
    const { error } = await salvarNota({
      aluno_id: novoAlunoId,
      materia: novaMateria,
      vc_lista: parseListaVc(novoVc),
      vf: paraNumeroSeguro(novoVf),
      nota_final: paraNumeroSeguro(novaFinalExibida),
    });
```

Trocar para:

```ts
    const { error } = await salvarNota({
      aluno_id: novoAlunoId,
      materia: novaMateria,
      vc_lista: parseListaVc(novoVc),
      vf: paraNumeroSeguro(novoVf),
      nota_final: paraNumeroSeguro(novaFinalExibida),
      verif_2a_epoca: paraNumeroSeguro(novoVerif2aEpoca),
      media_2a_epoca: paraNumeroSeguro(novoMedia2aEpoca),
    });
```

Logo depois de `setNovaFinalManual(null);` dentro do bloco de sucesso,
adicionar `setNovoVerif2aEpoca(""); setNovoMedia2aEpoca("");`.

No JSX, logo depois do `<div>` do campo "Nota final (automática)" (antes
do `<div className="md:col-span-6 flex justify-end">`), adicionar:

```tsx
            <div className="space-y-1">
              <Label>Verif. 2ª Época (opcional)</Label>
              <Input
                type="number"
                step="0.0001"
                value={novoVerif2aEpoca}
                onChange={(e) => setNovoVerif2aEpoca(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Média 2ª Época (opcional)</Label>
              <Input
                type="number"
                step="0.0001"
                value={novoMedia2aEpoca}
                onChange={(e) => setNovoMedia2aEpoca(e.target.value)}
              />
            </div>
```

E mudar o grid do formulário de `md:grid-cols-6` para `md:grid-cols-8`
(já que agora tem 8 campos na linha, não 6) — a linha:

```tsx
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
```

vira:

```tsx
          <div className="grid grid-cols-1 md:grid-cols-8 gap-3 items-end">
```

(e o botão final, que hoje é `<div className="md:col-span-6 flex justify-end">`,
vira `<div className="md:col-span-8 flex justify-end">`).

- [ ] **Step 2: Estado e edição inline na tabela "Notas lançadas"**

`getEdicao` hoje é:

```ts
  function getEdicao(row: NotaRow) {
    return (
      edits[row.id] ?? {
        vc: (row.vc_lista ?? []).join(", "),
        vf: row.vf !== null ? String(row.vf) : "",
        nota_final: row.nota_final !== null ? String(row.nota_final) : "",
      }
    );
  }
```

E o estado `edits` hoje é:

```ts
  const [edits, setEdits] = useState<Record<string, { vc: string; vf: string; nota_final: string }>>({});
```

Trocar `edits` para:

```ts
  const [edits, setEdits] = useState<
    Record<string, { vc: string; vf: string; nota_final: string; verif2aEpoca: string; media2aEpoca: string }>
  >({});
```

E `getEdicao` para:

```ts
  function getEdicao(row: NotaRow) {
    return (
      edits[row.id] ?? {
        vc: (row.vc_lista ?? []).join(", "),
        vf: row.vf !== null ? String(row.vf) : "",
        nota_final: row.nota_final !== null ? String(row.nota_final) : "",
        verif2aEpoca: row.verif_2a_epoca !== null ? String(row.verif_2a_epoca) : "",
        media2aEpoca: row.media_2a_epoca !== null ? String(row.media_2a_epoca) : "",
      }
    );
  }
```

Adicionar uma função irmã de `handleNotaFinalManual` (logo depois dela):

```ts
  function handle2aEpocaChange(row: NotaRow, field: "verif2aEpoca" | "media2aEpoca", value: string) {
    const atual = getEdicao(row);
    setEdits((prev) => ({ ...prev, [row.id]: { ...atual, [field]: value } }));
  }
```

`handleSalvarLinha` hoje chama:

```ts
    const { error } = await salvarNota({
      aluno_id: row.aluno_id,
      materia: row.materia,
      vc_lista: parseListaVc(e.vc),
      vf: paraNumeroSeguro(e.vf),
      nota_final: paraNumeroSeguro(e.nota_final),
    });
```

Trocar para:

```ts
    const { error } = await salvarNota({
      aluno_id: row.aluno_id,
      materia: row.materia,
      vc_lista: parseListaVc(e.vc),
      vf: paraNumeroSeguro(e.vf),
      nota_final: paraNumeroSeguro(e.nota_final),
      verif_2a_epoca: paraNumeroSeguro(e.verif2aEpoca),
      media_2a_epoca: paraNumeroSeguro(e.media2aEpoca),
    });
```

No `<TableHeader>` da tabela "Notas lançadas", depois de
`<TableHead className="w-28">Nota final</TableHead>`, adicionar:

```tsx
                    <TableHead className="w-28">Verif. 2ª Época</TableHead>
                    <TableHead className="w-28">Média 2ª Época</TableHead>
```

No `<TableBody>`, depois da `<TableCell>` da "Nota final" (o bloco com
`value={e.nota_final}`), adicionar duas células irmãs:

```tsx
                        <TableCell>
                          <Input
                            type="number"
                            step="0.0001"
                            value={e.verif2aEpoca}
                            onChange={(ev) => handle2aEpocaChange(row, "verif2aEpoca", ev.target.value)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            step="0.0001"
                            value={e.media2aEpoca}
                            onChange={(ev) => handle2aEpocaChange(row, "media2aEpoca", ev.target.value)}
                            className="h-8"
                          />
                        </TableCell>
```

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/AdminGradesEditor.tsx
git commit -m "feat: campos de verificacao 2a epoca no lancamento de nota"
```

---

### Task 6: Dependência `docx` + texto institucional compartilhado

**Files:**
- Modify: `package.json` (via `npm install docx`)
- Create: `src/config/documentosOficiais.ts`

**Interfaces:**
- Produces: `TEXTO_INSTITUCIONAL` (objeto com as linhas do cabeçalho),
  usado pela Task 7 (e futuramente pelo Histórico Escolar).

- [ ] **Step 1: Instalar a dependência**

Run: `npm install docx`
Expected: `package.json` e `package-lock.json` (ou `node_modules`) atualizados
com `docx` na versão mais recente estável (`^9.x` no momento deste plano).

- [ ] **Step 2: Criar `src/config/documentosOficiais.ts`**

```ts
/**
 * Texto institucional fixo usado no cabeçalho dos documentos oficiais
 * exportados (Boletim Escolar agora; Histórico Escolar na Fase 2).
 * Centralizado aqui para não duplicar entre os dois geradores.
 */
export const TEXTO_INSTITUCIONAL = {
  linha1: "ESTADO DE MATO GROSSO",
  linha2: "SECRETARIA DE ESTADO DE JUSTIÇA E SEGURANÇA PÚBLICA",
  linha3: "POLÍCIA MILITAR",
  linha4: "ACADEMIA DE POLÍCIA MILITAR COSTA VERDE",
  linha5: "(CIM – 1951)",
} as const;
```

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/config/documentosOficiais.ts
git commit -m "feat: adiciona dependencia docx e texto institucional compartilhado"
```

---

### Task 7: Geradores do Boletim (PDF, Word, Excel)

**Files:**
- Create: `src/utils/exportBoletim.ts`

**Interfaces:**
- Consumes: `TEXTO_INSTITUCIONAL` (Task 6), `DetalheMateria` com
  `verif_2a_epoca`/`media_2a_epoca` (Task 2).
- Produces: `DadosExportacaoBoletim` (interface), `exportarBoletimPDF(dados)`,
  `exportarBoletimWord(dados)`, `exportarBoletimExcel(dados)` — usadas pela
  Task 8.

- [ ] **Step 1: Escrever `src/utils/exportBoletim.ts`**

```ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
import { DetalheMateria } from "@/hooks/useAlunosModulo";
import { TEXTO_INSTITUCIONAL } from "@/config/documentosOficiais";
import { MATERIAS_SOMA_VC } from "@/config/formulaNotas";

export interface DadosExportacaoBoletim {
  nomeAluno: string;
  matricula: string | null;
  nomeTurma: string;
  tituloModulo: string; // ex: "CFO I", "CFO II", "CFO III"
  anoLetivo: string | null;
  inicio: string; // digitado na hora da exportação, pode vir vazio
  termino: string; // digitado na hora da exportação, pode vir vazio
  mediaFinalModulo: number;
  gradesDetalhado: Record<string, DetalheMateria>;
  responsavelNome: string;
  responsavelPosto: string;
  responsavelFuncao: string;
}

function nf(v: number | null | undefined): string {
  return v != null ? v.toFixed(3) : "";
}

function linhasBoletim(dados: DadosExportacaoBoletim) {
  return Object.entries(dados.gradesDetalhado)
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    .map(([materia, d]) => {
      const vcs = d.vc_lista ?? [];
      return {
        materia,
        vc1: vcs[0] != null ? nf(vcs[0]) : "",
        vc2: vcs[1] != null ? nf(vcs[1]) : "",
        vc3: vcs[2] != null ? nf(vcs[2]) : "",
        mediaVcs: vcs.length > 0 ? nf(vcs.reduce((a, b) => a + b, 0) / vcs.length) : "",
        vf: nf(d.vf),
        mediaFinal: nf(d.nota_final),
        verif2aEpoca: nf(d.verif_2a_epoca),
        media2aEpoca: nf(d.media_2a_epoca),
      };
    });
}

function nomeArquivo(dados: DadosExportacaoBoletim, extensao: string) {
  const base = `boletim_${dados.tituloModulo}_${dados.nomeAluno}`.replace(/\s+/g, "_");
  return `${base}.${extensao}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportarBoletimExcel(dados: DadosExportacaoBoletim) {
  const wb = XLSX.utils.book_new();
  const linhas = linhasBoletim(dados);

  const cabecalho = [
    [TEXTO_INSTITUCIONAL.linha1],
    [TEXTO_INSTITUCIONAL.linha2],
    [TEXTO_INSTITUCIONAL.linha3],
    [TEXTO_INSTITUCIONAL.linha4],
    [TEXTO_INSTITUCIONAL.linha5],
    [],
    [`BOLETIM ESCOLAR ${dados.tituloModulo}`],
    [],
    [`Nome do aluno: ${dados.nomeAluno}`],
    [`Matrícula: ${dados.matricula ?? "—"}`, `Turma: ${dados.nomeTurma}`],
    [`Ano letivo: ${dados.anoLetivo ?? "—"}`, `Início: ${dados.inicio || "—"}`, `Término: ${dados.termino || "—"}`],
    [],
  ];
  const wsCabecalho = XLSX.utils.aoa_to_sheet(cabecalho);
  XLSX.utils.book_append_sheet(wb, wsCabecalho, "Boletim");

  // Tabela de notas — a partir da linha 13 (índice 0-based 12), com fórmulas
  // reais de planilha nas colunas de média (não valores fixos).
  const linhaInicioTabela = cabecalho.length + 1; // 1-based
  const header = ["Disciplina", "1ª VC", "2ª VC", "3ª VC", "Média VCs", "VF", "Média Final", "Verif. 2ª Época", "Média 2ª Época"];
  XLSX.utils.sheet_add_aoa(wsCabecalho, [header], { origin: `A${linhaInicioTabela}` });

  linhas.forEach((l, i) => {
    const linhaAtual = linhaInicioTabela + 1 + i; // 1-based
    const vc1 = `B${linhaAtual}`;
    const vc3 = `D${linhaAtual}`;
    const mediaVcs = `E${linhaAtual}`;
    const vf = `F${linhaAtual}`;
    // Exceção já auditada do sistema (src/config/formulaNotas.ts,
    // MATERIAS_SOMA_VC): "Direito Administrativo Disciplinar Militar I" usa
    // SOMA das VCs em vez de MÉDIA — preservada aqui também, pra a fórmula
    // da planilha bater exatamente com o que o app já calcula.
    const funcaoVc = MATERIAS_SOMA_VC.has(l.materia) ? "SUM" : "AVERAGE";
    XLSX.utils.sheet_add_aoa(
      wsCabecalho,
      [
        [
          l.materia,
          l.vc1 ? Number(l.vc1) : "",
          l.vc2 ? Number(l.vc2) : "",
          l.vc3 ? Number(l.vc3) : "",
          { f: `IFERROR(${funcaoVc}(${vc1}:${vc3}),"")` },
          l.vf ? Number(l.vf) : "",
          { f: `IFERROR((${mediaVcs}*2+${vf}*3)/5,"")` },
          l.verif2aEpoca ? Number(l.verif2aEpoca) : "",
          l.media2aEpoca ? Number(l.media2aEpoca) : "",
        ],
      ],
      { origin: `A${linhaAtual}` }
    );
  });

  const linhaMediaFinal = linhaInicioTabela + 1 + linhas.length + 1;
  XLSX.utils.sheet_add_aoa(
    wsCabecalho,
    [[`Média Final do Módulo`, dados.mediaFinalModulo.toFixed(3)]],
    { origin: `A${linhaMediaFinal}` }
  );
  XLSX.utils.sheet_add_aoa(
    wsCabecalho,
    [[dados.responsavelNome], [`${dados.responsavelPosto} — ${dados.responsavelFuncao}`]],
    { origin: `A${linhaMediaFinal + 2}` }
  );

  XLSX.writeFile(wb, nomeArquivo(dados, "xlsx"));
}

export function exportarBoletimPDF(dados: DadosExportacaoBoletim) {
  const doc = new jsPDF();
  let y = 14;

  doc.setFontSize(11);
  doc.setTextColor(0);
  [TEXTO_INSTITUCIONAL.linha1, TEXTO_INSTITUCIONAL.linha2, TEXTO_INSTITUCIONAL.linha3, TEXTO_INSTITUCIONAL.linha4, TEXTO_INSTITUCIONAL.linha5].forEach(
    (linha) => {
      doc.text(linha, 105, y, { align: "center" });
      y += 5;
    }
  );

  y += 4;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`BOLETIM ESCOLAR ${dados.tituloModulo}`, 105, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  y += 10;

  doc.setFontSize(10);
  doc.text(`NOME DO ALUNO: ${dados.nomeAluno}`, 14, y);
  y += 6;
  doc.text(`MATRÍCULA: ${dados.matricula ?? "—"}`, 14, y);
  doc.text(`TURMA: ${dados.nomeTurma}`, 110, y);
  y += 6;
  doc.text(`ANO LETIVO: ${dados.anoLetivo ?? "—"}`, 14, y);
  doc.text(`INÍCIO: ${dados.inicio || "—"}`, 90, y);
  doc.text(`TÉRMINO: ${dados.termino || "—"}`, 150, y);
  y += 8;

  const linhas = linhasBoletim(dados);
  autoTable(doc, {
    startY: y,
    head: [["Disciplina", "1ª VC", "2ª VC", "3ª VC", "Média VCs", "VF", "Média Final", "2ª Época", "Média 2ª Ép."]],
    body: linhas.map((l) => [l.materia, l.vc1, l.vc2, l.vc3, l.mediaVcs, l.vf, l.mediaFinal, l.verif2aEpoca, l.media2aEpoca]),
    theme: "grid",
    headStyles: { fillColor: [30, 58, 138], fontSize: 7 },
    styles: { fontSize: 7 },
    margin: { left: 10, right: 10 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Média Final do Módulo: ${dados.mediaFinalModulo.toFixed(3)}`, 105, finalY, { align: "center" });
  doc.setFont("helvetica", "normal");

  const assinaturaY = finalY + 25;
  doc.setFontSize(10);
  doc.text(dados.responsavelNome.toUpperCase(), 105, assinaturaY, { align: "center" });
  doc.setFontSize(8);
  doc.text(`${dados.responsavelPosto} — ${dados.responsavelFuncao}`, 105, assinaturaY + 5, { align: "center" });

  doc.save(nomeArquivo(dados, "pdf"));
}

export async function exportarBoletimWord(dados: DadosExportacaoBoletim) {
  const linhas = linhasBoletim(dados);

  const headerCell = (texto: string) =>
    new DocxTableCell({
      children: [new Paragraph({ text: texto, alignment: AlignmentType.CENTER })],
      width: { size: 11, type: WidthType.PERCENTAGE },
    });
  const bodyCell = (texto: string) =>
    new DocxTableCell({
      children: [new Paragraph({ text: texto, alignment: AlignmentType.CENTER })],
    });

  const tabela = new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new DocxTableRow({
        children: [
          "Disciplina",
          "1ª VC",
          "2ª VC",
          "3ª VC",
          "Média VCs",
          "VF",
          "Média Final",
          "2ª Época",
          "Média 2ª Ép.",
        ].map(headerCell),
      }),
      ...linhas.map(
        (l) =>
          new DocxTableRow({
            children: [
              l.materia,
              l.vc1,
              l.vc2,
              l.vc3,
              l.mediaVcs,
              l.vf,
              l.mediaFinal,
              l.verif2aEpoca,
              l.media2aEpoca,
            ].map(bodyCell),
          })
      ),
    ],
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: TEXTO_INSTITUCIONAL.linha1, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL.linha2, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL.linha3, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL.linha4, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL.linha5, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `BOLETIM ESCOLAR ${dados.tituloModulo}`, bold: true, size: 28 })],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: `NOME DO ALUNO: ${dados.nomeAluno}` }),
          new Paragraph({ text: `MATRÍCULA: ${dados.matricula ?? "—"}    TURMA: ${dados.nomeTurma}` }),
          new Paragraph({
            text: `ANO LETIVO: ${dados.anoLetivo ?? "—"}    INÍCIO: ${dados.inicio || "—"}    TÉRMINO: ${dados.termino || "—"}`,
          }),
          new Paragraph({ text: "" }),
          tabela,
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Média Final do Módulo: ${dados.mediaFinalModulo.toFixed(3)}`, bold: true }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: dados.responsavelNome.toUpperCase(), alignment: AlignmentType.CENTER }),
          new Paragraph({
            text: `${dados.responsavelPosto} — ${dados.responsavelFuncao}`,
            alignment: AlignmentType.CENTER,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, nomeArquivo(dados, "docx"));
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros. Se o pacote `docx` não expuser algum dos nomes
importados (nome exato pode variar por versão), ajustar os imports
conforme o erro do TypeScript apontar (a API pública de `Document`,
`Paragraph`, `Table`, `TableRow`, `TableCell`, `TextRun`, `Packer`,
`AlignmentType`, `WidthType` é estável desde a v7).

- [ ] **Step 3: Commit**

```bash
git add src/utils/exportBoletim.ts
git commit -m "feat: geradores de Boletim Escolar em PDF, Word e Excel"
```

---

### Task 8: Interface — menu "Exportar Boletim" no modal do aluno

**Files:**
- Modify: `src/components/dashboard/StudentDetailsModal.tsx`
- Modify: `src/pages/cfo/Cfo1.tsx`
- Modify: `src/pages/cfo/Cfo2.tsx`
- Modify: `src/pages/cfo/Cfo3.tsx`

**Interfaces:**
- Consumes: `exportarBoletimPDF/Word/Excel` (Task 7), `AlunoModulo.matricula`
  (Task 2), `config.ano_letivo_cfo1/2/3` e
  `config.responsavel_assinatura_nome/posto/funcao` (Task 2).
- Produces: `StudentDetailsModalProps.isAdmin?: boolean`.

- [ ] **Step 1: Nova prop `isAdmin` e imports**

A interface `StudentDetailsModalProps` hoje é:

```ts
interface StudentDetailsModalProps {
  student: DetailedStudent | null;
  isOpen: boolean;
  onClose: () => void;
  totalStudents?: number;
  tituloModulo?: string;
}
```

Trocar para:

```ts
interface StudentDetailsModalProps {
  student: DetailedStudent | null;
  isOpen: boolean;
  onClose: () => void;
  totalStudents?: number;
  tituloModulo?: string;
  isAdmin?: boolean;
}
```

A assinatura da função hoje é:

```ts
export function StudentDetailsModal({
  student,
  isOpen,
  onClose,
  totalStudents = 0,
  tituloModulo = "",
}: StudentDetailsModalProps) {
```

Trocar para:

```ts
export function StudentDetailsModal({
  student,
  isOpen,
  onClose,
  totalStudents = 0,
  tituloModulo = "",
  isAdmin = false,
}: StudentDetailsModalProps) {
```

Os imports do topo do arquivo hoje incluem:

```ts
import { exportarAlunoCSV, exportarAlunoPDF, exportarAlunoXLSX } from "@/utils/exportAluno";
```

Adicionar logo abaixo:

```ts
import { exportarBoletimPDF, exportarBoletimWord, exportarBoletimExcel } from "@/utils/exportBoletim";
```

E adicionar aos imports de `@/components/ui/dialog` (já importado
`Dialog, DialogContent, DialogHeader, DialogTitle`) — não precisa mudar
essa linha, esses 4 já bastam para o novo diálogo também.

- [ ] **Step 2: Estado do fluxo Início/Término e geração**

O arquivo hoje **não** importa `useState` (o componente não tem estado
local nenhum ainda). Adicionar como a primeira linha do arquivo, antes do
`import { Dialog, ... } from "@/components/ui/dialog";` que já é a linha 1:

```ts
import { useState } from "react";
```

Logo abaixo de `const { config } = useConfiguracaoTurma();`, adicionar:

```ts
  const [boletimDialogAberto, setBoletimDialogAberto] = useState(false);
  const [boletimFormato, setBoletimFormato] = useState<"pdf" | "word" | "xlsx" | null>(null);
  const [boletimInicio, setBoletimInicio] = useState("");
  const [boletimTermino, setBoletimTermino] = useState("");
  const [gerandoBoletim, setGerandoBoletim] = useState(false);
```

Mapa de "ano letivo por módulo" — o `tituloModulo` chega como string
("CFO I"/"CFO II"/"CFO III"/"Classificação Geral"); adicionar uma função
auxiliar dentro do componente, antes do `return`:

```ts
  function anoLetivoDoModulo(): string | null {
    if (tituloModulo === "CFO I") return config.ano_letivo_cfo1;
    if (tituloModulo === "CFO II") return config.ano_letivo_cfo2;
    if (tituloModulo === "CFO III") return config.ano_letivo_cfo3;
    return null;
  }

  function abrirDialogoBoletim(formato: "pdf" | "word" | "xlsx") {
    setBoletimFormato(formato);
    setBoletimDialogAberto(true);
  }

  async function gerarBoletim() {
    if (!student || !boletimFormato) return;
    setGerandoBoletim(true);
    const dados = {
      nomeAluno: student.nome,
      matricula: (student as AlunoModulo).matricula ?? null,
      nomeTurma: config.nome_turma,
      tituloModulo,
      anoLetivo: anoLetivoDoModulo(),
      inicio: boletimInicio,
      termino: boletimTermino,
      mediaFinalModulo: student.mediaFinal,
      gradesDetalhado: detalhado,
      responsavelNome: config.responsavel_assinatura_nome,
      responsavelPosto: config.responsavel_assinatura_posto,
      responsavelFuncao: config.responsavel_assinatura_funcao,
    };
    if (boletimFormato === "pdf") exportarBoletimPDF(dados);
    else if (boletimFormato === "word") await exportarBoletimWord(dados);
    else exportarBoletimExcel(dados);
    setGerandoBoletim(false);
    setBoletimDialogAberto(false);
    setBoletimFormato(null);
  }
```

- [ ] **Step 3: Menu "Exportar Boletim" no cabeçalho do modal**

No JSX, dentro do `<div className="flex items-center gap-2">` que já
contém o `<DropdownMenu>` de "Exportar" (PDF/Excel/CSV), adicionar — só
quando `isAdmin` for `true` e não for a Classificação Geral (`!daGeral`) —
um segundo `DropdownMenu` logo antes do já existente:

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

- [ ] **Step 4: Diálogo de Início/Término**

Logo antes do `</Dialog>` final (depois do `</DialogContent>` principal,
como um segundo `<Dialog>` irmão, no mesmo `return (...)`), adicionar:

```tsx
      <Dialog open={boletimDialogAberto} onOpenChange={(open) => !open && setBoletimDialogAberto(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Exportar Boletim — {tituloModulo}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Início (opcional)</label>
              <input
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                value={boletimInicio}
                onChange={(e) => setBoletimInicio(e.target.value)}
                placeholder="ex: 03/2023"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted-foreground">Término (opcional)</label>
              <input
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                value={boletimTermino}
                onChange={(e) => setBoletimTermino(e.target.value)}
                placeholder="ex: 09/2023"
              />
            </div>
            <Button onClick={gerarBoletim} disabled={gerandoBoletim} className="w-full">
              {gerandoBoletim && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Gerar {boletimFormato === "pdf" ? "PDF" : boletimFormato === "word" ? "Word" : "Excel"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
```

Isso exige importar `Loader2` de `lucide-react` — conferir a linha de
import de ícones do topo do arquivo (hoje:
`import { TrendingUp, TrendingDown, Award, AlertCircle, Download, FileText, FileSpreadsheet, FileDown } from "lucide-react";`)
e acrescentar `Loader2` à lista.

- [ ] **Step 5: Passar `isAdmin` nas 4 páginas**

Em `Cfo1.tsx`, `Cfo2.tsx`, `Cfo3.tsx` (a chamada de `<StudentDetailsModal
.../>` já existe, por volta da linha 290-299 de cada arquivo, dentro do
retorno principal — NÃO a chamada dentro do bloco `if (!mostrarVisaoCompleta)`,
essa é outra tela). Ela hoje é (exemplo do Cfo1.tsx):

```tsx
      <StudentDetailsModal
        student={selectedStudent}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStudent(null);
        }}
        totalStudents={students.length}
        tituloModulo="CFO I"
      />
```

Trocar para (adicionando `isAdmin={isAdmin}`; `isAdmin` já está disponível
no escopo do componente via `const { isAdmin, viewingAsAlunoId } =
useAuth();`, linha já existente):

```tsx
      <StudentDetailsModal
        student={selectedStudent}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedStudent(null);
        }}
        totalStudents={students.length}
        tituloModulo="CFO I"
        isAdmin={isAdmin}
      />
```

Repetir a mesma troca em `Cfo2.tsx` (`tituloModulo="CFO II"`) e `Cfo3.tsx`
(`tituloModulo="CFO III"`). **Não** mexer em `ClassificacaoGeral.tsx` — lá
o botão fica escondido de qualquer forma pela checagem `!daGeral` feita
dentro do próprio modal.

- [ ] **Step 6: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/StudentDetailsModal.tsx src/pages/cfo/Cfo1.tsx src/pages/cfo/Cfo2.tsx src/pages/cfo/Cfo3.tsx
git commit -m "feat: menu Exportar Boletim no modal de detalhes do aluno"
```

---

### Task 9: Build final e checklist de conferência manual

**Files:**
- Nenhum arquivo novo — só validação.

- [ ] **Step 1: Build completo**

Run: `npm install && npx tsc --noEmit -p tsconfig.app.json && npx vite build`
Expected: build termina sem erros.

- [ ] **Step 2: Checklist de conferência manual (pedir ao usuário)**

Depois da migração rodada, das Edge Functions redeployadas e do código em
produção, pedir para o usuário, logado como admin:

1. Preencher a matrícula de um aluno em "Gerenciar Usuários" e confirmar
   que salva e reaparece depois de recarregar a página.
2. Preencher "Ano letivo CFO I" e os campos de assinatura em
   "Personalização" e confirmar que salvam.
3. Lançar uma "Verif. 2ª Época" numa matéria e confirmar que **não muda**
   a nota final nem a posição no ranking daquele aluno.
4. Abrir o modal de um aluno em CFO I/II/III, clicar "Exportar Boletim" →
   Word, preencher Início/Término, gerar, e comparar visualmente o
   resultado com `MODELO BOLETIM ESCOLAR.pdf`.
5. Repetir para PDF e Excel — no Excel, conferir que as células de "Média
   VCs" e "Média Final" são fórmulas (clicar na célula e ver `=AVERAGE(...)`/
   `=(...)`  na barra de fórmulas do Excel, não um número fixo). Se o aluno
   escolhido tiver nota em "Direito Administrativo Disciplinar Militar I"
   (só existe no CFO I), conferir que a célula de "Média VCs" dessa linha
   específica usa `=SUM(...)`, não `=AVERAGE(...)` — é a única exceção do
   sistema (`MATERIAS_SOMA_VC`).
6. Logar como aluno comum (role `aluno`) e confirmar que o botão "Exportar
   Boletim" **não aparece** em lugar nenhum.

- [ ] **Step 3: Commit final (se a conferência pedir ajuste) ou encerrar**

Se nada precisar de ajuste, a Task 8 já é o estado final. Se pedir ajuste,
aplicar e commitar normalmente.
