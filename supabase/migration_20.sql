-- ============================================================
-- MIGRAÇÃO 20 — Desligamentos e Comissões de Encerramento
--
-- CONTEXTO: ao gerar as Atas de Encerramento do 23º CFO (17-20/08/2026),
-- precisamos reconstruir manualmente, a cada conversa, informações que
-- deveriam estar cadastradas no sistema desde que aconteceram: quem se
-- desligou do curso e quando, o número do processo/SIGADOC, e a
-- composição da comissão (portaria/BCG) responsável por cada ata. Essas
-- informações mudam a cada turma e a cada ano — sem um cadastro
-- estruturado, ficam perdidas até alguém lembrar de procurar o
-- documento original.
--
-- Estas duas tabelas resolvem isso: o admin cadastra o evento assim que
-- ele acontece (ex: assim que um aluno pede desligamento, ou assim que
-- uma portaria de comissão é publicada), e o futuro gerador automático
-- de atas (próxima etapa) usa esses dados diretamente, sem reconstrução
-- manual.
-- ============================================================

-- Desligamentos de alunos ao longo do curso — um aluno pode ter, no
-- máximo, um desligamento (não faz sentido desligar-se duas vezes).
create table public.desligamentos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.profiles(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  modulo text not null check (modulo in ('cfo1', 'cfo2', 'cfo3')), -- módulo em curso no momento do desligamento
  data_desligamento date not null,
  numero_processo text, -- ex: PM-PRO-2026/05150 (pode ficar em branco até ser informado)
  motivo text,
  observacoes text,
  criado_por uuid references public.profiles(id),
  criado_em timestamptz not null default now(),
  unique (aluno_id)
);

alter table public.desligamentos enable row level security;

create policy "desligamentos_select" on public.desligamentos for select
  using (public.pode_configurar_turma(turma_id));

create policy "desligamentos_insert" on public.desligamentos for insert
  with check (public.pode_configurar_turma(turma_id));

create policy "desligamentos_update" on public.desligamentos for update
  using (public.pode_configurar_turma(turma_id))
  with check (public.pode_configurar_turma(turma_id));

create policy "desligamentos_delete" on public.desligamentos for delete
  using (public.pode_configurar_turma(turma_id));

-- Comissões nomeadas por portaria para cada evento de encerramento
-- (Ata do 1º/2º/3º Ano, Ata de Classificação Geral final, etc.)
create table public.comissoes_encerramento (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas(id) on delete cascade,
  referente_a text not null, -- ex: "Ata de Encerramento do 3º Ano", "Ata de Classificação Geral"
  portaria_numero text not null, -- ex: 010/APM/2026
  portaria_data date not null,
  bcg_numero text, -- ex: 3906
  bcg_data date,
  data_reuniao date, -- data da reunião de encerramento (pode ser preenchida depois)
  criado_por uuid references public.profiles(id),
  criado_em timestamptz not null default now()
);

alter table public.comissoes_encerramento enable row level security;

create policy "comissoes_encerramento_select" on public.comissoes_encerramento for select
  using (public.pode_configurar_turma(turma_id));

create policy "comissoes_encerramento_insert" on public.comissoes_encerramento for insert
  with check (public.pode_configurar_turma(turma_id));

create policy "comissoes_encerramento_update" on public.comissoes_encerramento for update
  using (public.pode_configurar_turma(turma_id))
  with check (public.pode_configurar_turma(turma_id));

create policy "comissoes_encerramento_delete" on public.comissoes_encerramento for delete
  using (public.pode_configurar_turma(turma_id));

-- Membros de cada comissão (Presidente, Secretário, Membro, ...), em
-- ordem de assinatura
create table public.membros_comissao (
  id uuid primary key default gen_random_uuid(),
  comissao_id uuid not null references public.comissoes_encerramento(id) on delete cascade,
  nome text not null,
  posto_graduacao text not null, -- ex: "Maj PM", "Cap PM", "Cb PM"
  papel text not null check (papel in ('Presidente', 'Secretário', 'Membro')),
  ordem int not null default 0
);

alter table public.membros_comissao enable row level security;

create policy "membros_comissao_select" on public.membros_comissao for select
  using (
    exists (
      select 1 from public.comissoes_encerramento c
      where c.id = comissao_id and public.pode_configurar_turma(c.turma_id)
    )
  );

create policy "membros_comissao_all" on public.membros_comissao for all
  using (
    exists (
      select 1 from public.comissoes_encerramento c
      where c.id = comissao_id and public.pode_configurar_turma(c.turma_id)
    )
  )
  with check (
    exists (
      select 1 from public.comissoes_encerramento c
      where c.id = comissao_id and public.pode_configurar_turma(c.turma_id)
    )
  );
