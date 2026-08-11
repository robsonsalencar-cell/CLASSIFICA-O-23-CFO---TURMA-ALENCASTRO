# Indicador "Matérias Avaliadas" no painel do aluno

Data: 2026-08-11

## Contexto

Hoje o card "Matérias Avaliadas" (ex: "73/85 — Progresso do curso") só aparece na
seção "Indicadores Gerais" que o admin/desenvolvedor vê em CFO I, CFO II, CFO III
e Classificação Geral. O aluno comum não vê essa informação — o painel dele
(`ResumoIndividualModulo.tsx`) só mostra "Minha média" e "Média da turma".

O usuário quer que o aluno também veja o progresso de matérias avaliadas da
turma, por considerar essa informação importante.

## Restrição de privacidade

O número "matérias avaliadas" é uma contagem agregada da turma inteira (quantas
matérias distintas já têm pelo menos uma nota lançada), não um dado do aluno
individual. Hoje esse número é calculado no front-end (`useAlunosModulo` /
`useNotasModulo`) a partir de uma consulta que traz as notas de todos os alunos —
isso só funciona pro admin porque as políticas de RLS do Supabase bloqueiam um
aluno comum de ler notas de outros alunos (a menos que o toggle "Ranking p/
alunos" esteja ligado, e mesmo assim é outro mecanismo).

Reaproveitar esse cálculo do jeito que está para o aluno resultaria em um número
errado (baseado só nas notas que aquele aluno específico pode enxergar) ou em erro
de permissão. A solução é expor esse agregado através de uma função de banco
`security definer` — o mesmo padrão já usado por `estatisticas_modulo` e
`estatisticas_classificacao_geral`, que hoje calculam "minha posição"/"média da
turma" sem revelar notas de outros alunos.

Decisão confirmada com o usuário: o indicador fica **sempre visível** para o
aluno (não depende do toggle "Ranking p/ alunos"), porque não expõe nota de
ninguém — só quantas matérias da turma já foram avaliadas.

## Escopo

Aparece nos 4 painéis do aluno que usam `ResumoIndividualModulo`:
- CFO I → matérias avaliadas daquele módulo (de 32)
- CFO II → matérias avaliadas daquele módulo (de 27)
- CFO III → matérias avaliadas daquele módulo (de 26)
- Classificação Geral → soma dos 3 módulos (de 85)

## Design

### 1. Banco de dados — `supabase/migration_11.sql`

Estende as duas funções RPC existentes (`create or replace function`, mesma
assinatura, sem quebrar chamadas atuais) adicionando um novo campo de retorno
`materias_lancadas integer`:

- **`estatisticas_modulo(p_tabela, p_aluno_id, p_turma_id)`**: adiciona a
  contagem de `distinct materia` com `nota_final is not null` na tabela do
  módulo (`notas_cfo1`/`2`/`3`), escopada por `turma_id` via join com
  `profiles` — mesmo filtro de turma já usado no resto da função. Não filtra
  por `matriculado_cfoN`, porque a pergunta é "essa matéria já foi avaliada na
  turma?", não "quantos alunos matriculados a têm?".
- **`estatisticas_classificacao_geral(p_aluno_id, p_turma_id)`**: soma as 3
  contagens (CFO I + CFO II + CFO III) escopadas pela mesma turma.

Nenhuma política de RLS é alterada — a única superfície nova é o campo
adicional retornado por essas duas funções já existentes, que continuam
`security definer` e `grant execute to authenticated`.

### 2. Front-end

- **`src/hooks/useEstatisticasModulo.ts`**: adiciona `materias_lancadas:
  number` à interface `EstatisticasModulo`.
- **`src/components/dashboard/ResumoIndividualModulo.tsx`**:
  - Nova prop obrigatória `totalMaterias: number` (denominador — número
    estático, não depende do banco).
  - Novo `KPICard` "Matérias Avaliadas" (ícone `BookOpen`, variante
    `success`, igual ao card do admin), mostrando
    `${dados?.materias_lancadas ?? 0}/${totalMaterias}`, adicionado ao grid
    junto com "Minha média" e "Média da turma" (grid passa a 3 colunas em
    telas médias/grandes).
- **`src/pages/cfo/Cfo1.tsx`, `Cfo2.tsx`, `Cfo3.tsx`**: passam
  `totalMaterias={allSubjects.length}` (já disponível via `useAlunosModulo`,
  chamado antes do retorno condicional da visão do aluno).
- **`src/pages/cfo/ClassificacaoGeral.tsx`**: passa
  `totalMaterias={MATERIAS_CFO1.length + MATERIAS_CFO2.length +
  MATERIAS_CFO3.length}` (85).

### 3. Validação

- `npm install && npx tsc --noEmit -p tsconfig.app.json && npx vite build`
  antes de qualquer commit/push (fluxo já estabelecido no projeto).
- Conferência manual: o número mostrado no painel do aluno deve bater
  exatamente com o que o admin já vê hoje no mesmo módulo/turma.
- SQL da migração é entregue pronto para o usuário rodar no SQL Editor do
  Supabase (Claude não tem acesso direto ao banco neste ambiente).

## Fora de escopo

- Nenhuma mudança em RLS ou nos outros indicadores (Média da Turma, Total de
  Alunos, Maior/Menor Média) permanece exclusiva do admin.
- Nenhuma mudança visual além da adição do novo card (não redesenha o layout
  existente).
