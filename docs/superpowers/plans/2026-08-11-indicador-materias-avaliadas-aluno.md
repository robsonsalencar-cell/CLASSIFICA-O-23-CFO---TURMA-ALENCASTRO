# Indicador "Matérias Avaliadas" no painel do aluno — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar o card "Matérias Avaliadas" (progresso do curso) também no painel do aluno, nos 4 lugares onde o admin já vê: CFO I, CFO II, CFO III e Classificação Geral.

**Architecture:** Duas funções RPC do Supabase (`estatisticas_modulo`, `estatisticas_classificacao_geral`) ganham um novo campo agregado `materias_lancadas`, calculado com `security definer` para não expor nota de nenhum aluno específico. O componente compartilhado `ResumoIndividualModulo.tsx` (usado pelas 4 páginas na visão do aluno) passa a receber uma prop `totalMaterias` e renderiza um terceiro `KPICard` usando esse novo campo.

**Tech Stack:** React + TypeScript + Vite, Supabase (Postgres/RPC), Tailwind + shadcn/ui.

## Global Constraints

- Sem framework de testes automatizados neste projeto (confirmado: `package.json` só tem `dev`/`build`/`lint`/`preview`, nenhum arquivo `*.test.*`). Validação = `npx tsc --noEmit -p tsconfig.app.json` + `npx vite build`, igual ao fluxo já documentado no projeto.
- Mudança de SQL: Claude não tem acesso direto ao Supabase neste ambiente — o SQL é entregue pronto no arquivo de migração, e quem roda no SQL Editor é o usuário.
- O indicador deve ficar **sempre visível** para o aluno (não atrás do toggle "Ranking p/ alunos").
- Não alterar nenhuma política de RLS nem os outros indicadores existentes.
- Seguir o padrão de código já usado no arquivo (nomes em português para dados de domínio, inglês para nomes técnicos — como já está no restante do projeto).

---

### Task 1: Migração SQL — adicionar `materias_lancadas` às funções de estatística

**Files:**
- Create: `supabase/migration_11.sql`

**Interfaces:**
- Produces: as funções `public.estatisticas_modulo(p_tabela text, p_aluno_id uuid, p_turma_id uuid)` e `public.estatisticas_classificacao_geral(p_aluno_id uuid, p_turma_id uuid)` passam a retornar mais uma coluna `materias_lancadas integer`, além das colunas que já retornavam (`minha_media`, `minha_posicao`, `total_alunos`, `media_turma`, `desvio_padrao`, `maior_media`, `menor_media`). Assinatura de chamada (nomes/ordem dos parâmetros) não muda.

- [ ] **Step 1: Escrever o arquivo de migração**

Criar `supabase/migration_11.sql` com o conteúdo abaixo. É um `create or replace function`, então é seguro rodar mesmo com a função já existindo — não apaga dados, só muda o que a função retorna.

```sql
-- ============================================================
-- MIGRAÇÃO 11 — Adiciona `materias_lancadas` às funções de
-- estatística usadas pelo painel do aluno, para expor no card
-- "Matérias Avaliadas" (hoje só visível pro admin) sem revelar
-- nota de nenhum aluno específico — é uma contagem agregada de
-- quantas matérias da turma já têm pelo menos uma nota lançada.
-- ============================================================

create or replace function public.estatisticas_modulo(p_tabela text, p_aluno_id uuid default null, p_turma_id uuid default null)
returns table (
  minha_media numeric,
  minha_posicao integer,
  total_alunos integer,
  media_turma numeric,
  desvio_padrao numeric,
  maior_media numeric,
  menor_media numeric,
  materias_lancadas integer
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_alvo uuid;
  v_coluna_matricula text;
begin
  if p_tabela not in ('notas_cfo1', 'notas_cfo2', 'notas_cfo3') then
    raise exception 'tabela inválida';
  end if;

  v_coluna_matricula := 'matriculado_' || replace(p_tabela, 'notas_', '');

  if p_aluno_id is not null and public.is_admin() then
    v_alvo := p_aluno_id;
  else
    v_alvo := auth.uid();
  end if;

  return query execute format($f$
    with medias as (
      select n.aluno_id, avg(n.nota_final) as media
      from public.%I n
      join public.profiles p on p.id = n.aluno_id
      where ($2 is null or p.turma_id = $2)
        and p.%I = true
      group by n.aluno_id
    ),
    ranked as (
      select aluno_id, media, rank() over (order by media desc) as posicao
      from medias
    ),
    progresso as (
      select count(distinct n.materia)::int as materias_lancadas
      from public.%I n
      join public.profiles p on p.id = n.aluno_id
      where ($2 is null or p.turma_id = $2)
        and n.nota_final is not null
    )
    select
      (select media from ranked where aluno_id = $1),
      (select posicao::int from ranked where aluno_id = $1),
      (select count(*)::int from ranked),
      (select round(avg(media), 4) from ranked),
      (select round(stddev_pop(media), 4) from ranked),
      (select max(media) from ranked),
      (select min(media) from ranked),
      (select materias_lancadas from progresso)
  $f$, p_tabela, v_coluna_matricula, p_tabela) using v_alvo, p_turma_id;
end;
$$;

create or replace function public.estatisticas_classificacao_geral(p_aluno_id uuid default null, p_turma_id uuid default null)
returns table (
  minha_media numeric,
  minha_posicao integer,
  total_alunos integer,
  media_turma numeric,
  desvio_padrao numeric,
  maior_media numeric,
  menor_media numeric,
  materias_lancadas integer
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_alvo uuid;
begin
  if p_aluno_id is not null and public.is_admin() then
    v_alvo := p_aluno_id;
  else
    v_alvo := auth.uid();
  end if;

  return query
  with media_cfo1 as (
    select n.aluno_id, avg(n.nota_final) as media
    from public.notas_cfo1 n
    join public.profiles p on p.id = n.aluno_id
    where (p_turma_id is null or p.turma_id = p_turma_id)
      and p.matriculado_cfo1 = true
    group by n.aluno_id
  ),
  media_cfo2 as (
    select n.aluno_id, avg(n.nota_final) as media
    from public.notas_cfo2 n
    join public.profiles p on p.id = n.aluno_id
    where (p_turma_id is null or p.turma_id = p_turma_id)
      and p.matriculado_cfo2 = true
    group by n.aluno_id
  ),
  media_cfo3 as (
    select n.aluno_id, avg(n.nota_final) as media
    from public.notas_cfo3 n
    join public.profiles p on p.id = n.aluno_id
    where (p_turma_id is null or p.turma_id = p_turma_id)
      and p.matriculado_cfo3 = true
    group by n.aluno_id
  ),
  media_geral as (
    select
      c1.aluno_id,
      (c1.media + c2.media + c3.media) / 3.0 as media
    from media_cfo1 c1
    join media_cfo2 c2 on c2.aluno_id = c1.aluno_id
    join media_cfo3 c3 on c3.aluno_id = c1.aluno_id
  ),
  ranked as (
    select aluno_id, media, rank() over (order by media desc) as posicao
    from media_geral
  ),
  progresso as (
    select
      (select count(distinct n.materia) from public.notas_cfo1 n join public.profiles p on p.id = n.aluno_id where (p_turma_id is null or p.turma_id = p_turma_id) and n.nota_final is not null)
      + (select count(distinct n.materia) from public.notas_cfo2 n join public.profiles p on p.id = n.aluno_id where (p_turma_id is null or p.turma_id = p_turma_id) and n.nota_final is not null)
      + (select count(distinct n.materia) from public.notas_cfo3 n join public.profiles p on p.id = n.aluno_id where (p_turma_id is null or p.turma_id = p_turma_id) and n.nota_final is not null)
      as materias_lancadas
  )
  select
    (select media from ranked where aluno_id = v_alvo),
    (select posicao::int from ranked where aluno_id = v_alvo),
    (select count(*)::int from ranked),
    (select round(avg(media), 4) from ranked),
    (select round(stddev_pop(media), 4) from ranked),
    (select max(media) from ranked),
    (select min(media) from ranked),
    (select materias_lancadas::int from progresso);
end;
$$;

grant execute on function public.estatisticas_modulo(text, uuid, uuid) to authenticated;
grant execute on function public.estatisticas_classificacao_geral(uuid, uuid) to authenticated;
```

- [ ] **Step 2: Entregar o SQL para o usuário rodar e conferir**

Este passo não é automatizável neste ambiente (sem acesso direto ao Supabase).
Ao chegar nesta task durante a execução, pare e peça ao usuário para colar o
conteúdo de `supabase/migration_11.sql` no SQL Editor do projeto Supabase
(`ytqycsvdcmgoptarksdt`) e rodar. Depois, peça para ele rodar esta query de
conferência e colar o resultado:

```sql
select * from public.estatisticas_modulo('notas_cfo1', null, null);
select * from public.estatisticas_classificacao_geral(null, null);
```

Esperado: a nova coluna `materias_lancadas` aparece no resultado com um número
inteiro (não erro, não null salvo se realmente não houver nenhuma nota
lançada ainda).

- [ ] **Step 3: Commit**

```bash
git add supabase/migration_11.sql
git commit -m "feat(db): expõe materias_lancadas nas funções de estatística do módulo"
```

---

### Task 2: Hook `useEstatisticasModulo` — adicionar o campo novo à interface

**Files:**
- Modify: `src/hooks/useEstatisticasModulo.ts`

**Interfaces:**
- Consumes: nenhuma mudança de código-fonte além da própria interface (a chamada RPC já existente em `fetchDados` não muda — o Postgres já devolve a coluna extra automaticamente após a Task 1).
- Produces: `EstatisticasModulo.materias_lancadas: number`, consumido pela Task 3.

- [ ] **Step 1: Adicionar o campo à interface**

Em `src/hooks/useEstatisticasModulo.ts`, a interface hoje é:

```ts
export interface EstatisticasModulo {
  minha_media: number | null;
  minha_posicao: number | null;
  total_alunos: number;
  media_turma: number;
  desvio_padrao: number;
  maior_media: number;
  menor_media: number;
}
```

Alterar para:

```ts
export interface EstatisticasModulo {
  minha_media: number | null;
  minha_posicao: number | null;
  total_alunos: number;
  media_turma: number;
  desvio_padrao: number;
  maior_media: number;
  menor_media: number;
  materias_lancadas: number;
}
```

Nenhuma outra linha do arquivo muda — o `supabase.rpc(...)` já existente
continua igual, o TypeScript só passa a saber que o campo existe.

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: nenhum novo erro relacionado a `useEstatisticasModulo.ts` (o campo
é opcionalmente lido — ninguém quebra por ele existir a mais).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useEstatisticasModulo.ts
git commit -m "feat: adiciona materias_lancadas à interface EstatisticasModulo"
```

---

### Task 3: `ResumoIndividualModulo` — nova prop e novo card

**Files:**
- Modify: `src/components/dashboard/ResumoIndividualModulo.tsx`

**Interfaces:**
- Consumes: `EstatisticasModulo.materias_lancadas` (Task 2), `KPICard` de `@/components/dashboard/KPICard` (props existentes: `title`, `value`, `subtitle`, `variant`, `icon`).
- Produces: `ResumoIndividualModulo` passa a exigir uma prop nova `totalMaterias: number`, consumida pela Task 4.

- [ ] **Step 1: Adicionar a prop `totalMaterias` e importar o ícone**

No topo do arquivo, o import de ícones hoje é:

```ts
import { Loader2, Medal, Target, TrendingUp, Users } from "lucide-react";
```

Trocar para incluir `BookOpen` (mesmo ícone usado no card do admin):

```ts
import { BookOpen, Loader2, Medal, Target, TrendingUp, Users } from "lucide-react";
```

A interface `Props` hoje é:

```ts
interface Props {
  tabela: TabelaModulo | "geral";
  // Para a Classificação Geral (que não tem uma tabela de notas por matéria própria),
  // passe undefined em tabelaNotas — a lista de matérias não será exibida.
  tabelaNotas?: TabelaModulo;
  tituloModulo: string;
}
```

Adicionar `totalMaterias`:

```ts
interface Props {
  tabela: TabelaModulo | "geral";
  // Para a Classificação Geral (que não tem uma tabela de notas por matéria própria),
  // passe undefined em tabelaNotas — a lista de matérias não será exibida.
  tabelaNotas?: TabelaModulo;
  tituloModulo: string;
  // Total de matérias do módulo (ou soma dos 3 módulos, na Classificação
  // Geral) — denominador do card "Matérias Avaliadas". É um número estático
  // (tamanho da lista oficial de matérias), não vem do banco.
  totalMaterias: number;
}
```

E a assinatura da função:

```ts
export function ResumoIndividualModulo({ tabela, tabelaNotas, tituloModulo, totalMaterias }: Props) {
```

- [ ] **Step 2: Adicionar o `KPICard` "Matérias Avaliadas" ao grid**

O grid de KPIs hoje é (2 colunas):

```tsx
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <KPICard
          title="Minha média"
          value={dados?.minha_media != null ? dados.minha_media.toFixed(4) : "—"}
          subtitle="Sua média final"
          variant="success"
          icon={<Target className="w-4 h-4" />}
        />
        <KPICard
          title="Média da turma"
          value={dados?.media_turma != null ? dados.media_turma.toFixed(4) : "—"}
          subtitle={`Desvio-padrão: ${dados?.desvio_padrao?.toFixed(4) ?? "—"}`}
          variant="default"
          icon={<Users className="w-4 h-4" />}
        />
      </div>
```

Trocar para 3 colunas em telas médias/grandes, com o novo card primeiro
(mesma ordem/estilo do card do admin em "Indicadores Gerais"):

```tsx
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Matérias Avaliadas"
          value={`${dados?.materias_lancadas ?? 0}/${totalMaterias}`}
          subtitle="Progresso do curso"
          variant="success"
          icon={<BookOpen className="w-4 h-4" />}
          tooltip={`${dados?.materias_lancadas ?? 0} matérias já tiveram notas lançadas de um total de ${totalMaterias}`}
        />
        <KPICard
          title="Minha média"
          value={dados?.minha_media != null ? dados.minha_media.toFixed(4) : "—"}
          subtitle="Sua média final"
          variant="success"
          icon={<Target className="w-4 h-4" />}
        />
        <KPICard
          title="Média da turma"
          value={dados?.media_turma != null ? dados.media_turma.toFixed(4) : "—"}
          subtitle={`Desvio-padrão: ${dados?.desvio_padrao?.toFixed(4) ?? "—"}`}
          variant="default"
          icon={<Users className="w-4 h-4" />}
        />
      </div>
```

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: aparecem erros nos 4 arquivos que chamam `<ResumoIndividualModulo
.../>` sem a prop `totalMaterias` (esperado agora — serão corrigidos na
Task 4). Nenhum erro deve apontar para dentro do próprio
`ResumoIndividualModulo.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/components/dashboard/ResumoIndividualModulo.tsx
git commit -m "feat: adiciona card Materias Avaliadas ao resumo individual do aluno"
```

---

### Task 4: Passar `totalMaterias` nas 4 páginas

**Files:**
- Modify: `src/pages/cfo/Cfo1.tsx:122`
- Modify: `src/pages/cfo/Cfo2.tsx:122`
- Modify: `src/pages/cfo/Cfo3.tsx:122`
- Modify: `src/pages/cfo/ClassificacaoGeral.tsx:168`

**Interfaces:**
- Consumes: `ResumoIndividualModulo` com a prop `totalMaterias` (Task 3). Em `Cfo1.tsx`/`Cfo2.tsx`/`Cfo3.tsx`, a variável `allSubjects` já existe (vem de `useAlunosModulo(...)`, chamada antes do retorno condicional da visão do aluno). Em `ClassificacaoGeral.tsx`, a variável `totalMaterias` já existe no escopo da função (linha 96: `const totalMaterias = cfo1.allSubjects.length + cfo2.allSubjects.length + cfo3.allSubjects.length;`), calculada antes do retorno condicional.

- [ ] **Step 1: `Cfo1.tsx`**

Linha 122 hoje:

```tsx
        <ResumoIndividualModulo tabela="notas_cfo1" tabelaNotas="notas_cfo1" tituloModulo="CFO I" />
```

Trocar para:

```tsx
        <ResumoIndividualModulo tabela="notas_cfo1" tabelaNotas="notas_cfo1" tituloModulo="CFO I" totalMaterias={allSubjects.length} />
```

- [ ] **Step 2: `Cfo2.tsx`**

Linha 122 hoje:

```tsx
        <ResumoIndividualModulo tabela="notas_cfo2" tabelaNotas="notas_cfo2" tituloModulo="CFO II" />
```

Trocar para:

```tsx
        <ResumoIndividualModulo tabela="notas_cfo2" tabelaNotas="notas_cfo2" tituloModulo="CFO II" totalMaterias={allSubjects.length} />
```

- [ ] **Step 3: `Cfo3.tsx`**

Linha 122 hoje:

```tsx
        <ResumoIndividualModulo tabela="notas_cfo3" tabelaNotas="notas_cfo3" tituloModulo="CFO III" />
```

Trocar para:

```tsx
        <ResumoIndividualModulo tabela="notas_cfo3" tabelaNotas="notas_cfo3" tituloModulo="CFO III" totalMaterias={allSubjects.length} />
```

- [ ] **Step 4: `ClassificacaoGeral.tsx`**

Linha 168 hoje:

```tsx
        <ResumoIndividualModulo tabela="geral" tituloModulo="Classificação Geral" />
```

Trocar para (reaproveitando a variável `totalMaterias` que já existe na
linha 96 do mesmo arquivo, calculada antes do `if (!mostrarVisaoCompleta)`):

```tsx
        <ResumoIndividualModulo tabela="geral" tituloModulo="Classificação Geral" totalMaterias={totalMaterias} />
```

- [ ] **Step 5: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: nenhum erro (os 4 erros da Task 3 sobre prop faltando devem ter
sumido).

- [ ] **Step 6: Commit**

```bash
git add src/pages/cfo/Cfo1.tsx src/pages/cfo/Cfo2.tsx src/pages/cfo/Cfo3.tsx src/pages/cfo/ClassificacaoGeral.tsx
git commit -m "feat: exibe progresso de materias avaliadas no painel do aluno"
```

---

### Task 5: Build final e validação manual

**Files:**
- Nenhum arquivo novo — só validação.

**Interfaces:**
- Consumes: todo o código das Tasks 1-4.

- [ ] **Step 1: Instalar dependências (se necessário) e buildar**

Run: `npm install && npx tsc --noEmit -p tsconfig.app.json && npx vite build`
Expected: build termina sem erros (mesmo comando usado em todo o histórico
do projeto antes de qualquer push).

- [ ] **Step 2: Checklist de conferência manual (pedir ao usuário depois do deploy)**

Depois que a migração SQL (Task 1) estiver rodada no Supabase e o código
estiver em produção (push + deploy automático do Vercel), pedir ao usuário
para conferir, logado como aluno (ou usando "Visualizar como" no admin):

1. Em CFO I/II/III: o número que aparece no card "Matérias Avaliadas" do
   aluno bate exatamente com o que aparece pro admin na mesma tela/turma.
2. Na Classificação Geral: o número bate com "73/85" (ou o valor atual) que
   o admin vê.
3. O card aparece mesmo com o toggle "Ranking p/ alunos" desligado.

- [ ] **Step 3: Commit final (se houver ajustes da conferência) ou encerrar**

Se a conferência manual não pedir ajuste nenhum, nenhum commit adicional é
necessário — a Task 4 já é o estado final. Se pedir ajuste, aplicar e
commitar normalmente.
