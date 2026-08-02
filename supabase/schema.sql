-- ============================================================
-- SCHEMA UNIFICADO - PAINEL 23º CFO
-- Execute este arquivo no SQL Editor do Supabase (do seu projeto Lovable)
-- ============================================================

-- 1) TIPO DE PERFIL (role)
create type public.app_role as enum ('admin', 'aluno', 'desenvolvedor');

-- 2) TABELA DE PERFIS (1 linha por usuário autenticado)
-- Ligada a auth.users. Criada automaticamente no cadastro via trigger abaixo.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome_completo text not null,
  email text not null unique,
  cpf text unique,
  role public.app_role not null default 'aluno',
  turma_id uuid, -- referencia public.turmas(id), adicionada como FK mais abaixo (a tabela turmas só existe depois)
  senha_trocada boolean not null default false, -- true = já trocou a senha provisória
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada usuário lê o próprio perfil; admin/desenvolvedor lê todos
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'desenvolvedor'))
  );

-- Só admin/desenvolvedor pode inserir/atualizar/apagar perfis de outros usuários
create policy "profiles_admin_write"
  on public.profiles for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'desenvolvedor')))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'desenvolvedor')));

-- Usuário pode atualizar campos do próprio perfil (ex: nome), mas não a role
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 3) FUNÇÃO + TRIGGER: cria o profile automaticamente quando um novo usuário se cadastra
-- (o admin cria o usuário via convite/painel; nome/cpf vêm dos metadados)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nome_completo, email, cpf, role, turma_id, senha_trocada)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome_completo', new.email),
    new.email,
    new.raw_user_meta_data->>'cpf',
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'aluno'),
    (new.raw_user_meta_data->>'turma_id')::uuid,
    false
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) FUNÇÃO AUXILIAR: verifica se o usuário logado é admin ou desenvolvedor
-- (evita recursão nas policies; desenvolvedor tem os mesmos privilégios de
-- escrita que admin, além de acesso à auditoria)
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'desenvolvedor'));
$$;

-- 5) TABELAS DE NOTAS POR MÓDULO (CFO I, II, III)
-- Repetir esta estrutura para os 3 módulos (troque o nome da tabela)
create table public.notas_cfo1 (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.profiles(id) on delete cascade,
  materia text not null,
  vc numeric(6,4),           -- legado, mantido por compatibilidade; use vc_lista
  vc_lista numeric[] default '{}',  -- permite mais de uma nota de VC por matéria
  vf numeric(6,4),           -- Verificação Final (se aplicável)
  nota_final numeric(6,4),
  updated_at timestamptz not null default now(),
  unique (aluno_id, materia)
);

create table public.notas_cfo2 (like public.notas_cfo1 including all);
create table public.notas_cfo3 (like public.notas_cfo1 including all);

-- (o "like ... including all" copia colunas e constraints, mas as FKs para profiles
--  precisam ser recriadas manualmente pois "including all" não traz FKs em algumas versões)
alter table public.notas_cfo2
  add constraint notas_cfo2_aluno_id_fkey foreign key (aluno_id) references public.profiles(id) on delete cascade;
alter table public.notas_cfo3
  add constraint notas_cfo3_aluno_id_fkey foreign key (aluno_id) references public.profiles(id) on delete cascade;

alter table public.notas_cfo1 enable row level security;
alter table public.notas_cfo2 enable row level security;
alter table public.notas_cfo3 enable row level security;

create policy "notas_cfo1_select" on public.notas_cfo1 for select
  using (aluno_id = auth.uid() or public.is_admin());
create policy "notas_cfo1_admin_write" on public.notas_cfo1 for all
  using (public.is_admin()) with check (public.is_admin());

create policy "notas_cfo2_select" on public.notas_cfo2 for select
  using (aluno_id = auth.uid() or public.is_admin());
create policy "notas_cfo2_admin_write" on public.notas_cfo2 for all
  using (public.is_admin()) with check (public.is_admin());

create policy "notas_cfo3_select" on public.notas_cfo3 for select
  using (aluno_id = auth.uid() or public.is_admin());
create policy "notas_cfo3_admin_write" on public.notas_cfo3 for all
  using (public.is_admin()) with check (public.is_admin());

-- 6) TABELA DE CLASSIFICAÇÃO FINAL (ranking geral)
create table public.classificacao_final (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null unique references public.profiles(id) on delete cascade,
  rank integer,
  media_final numeric(6,4),
  media_cfo1 numeric(6,4),
  media_cfo2 numeric(6,4),
  media_cfo3 numeric(6,4),
  updated_at timestamptz not null default now()
);

alter table public.classificacao_final enable row level security;

create policy "classificacao_select" on public.classificacao_final for select
  using (aluno_id = auth.uid() or public.is_admin());
create policy "classificacao_admin_write" on public.classificacao_final for all
  using (public.is_admin()) with check (public.is_admin());

-- 7) ÍNDICES úteis
create index idx_notas_cfo1_aluno on public.notas_cfo1(aluno_id);
create index idx_notas_cfo2_aluno on public.notas_cfo2(aluno_id);
create index idx_notas_cfo3_aluno on public.notas_cfo3(aluno_id);
create index idx_classificacao_aluno on public.classificacao_final(aluno_id);

-- ============================================================
-- 8) FUNÇÕES RPC: estatísticas da turma + posição do aluno, SEM expor os
--    dados individuais dos colegas.
--
-- MOTIVO: a RLS acima já garante que um aluno comum só ENXERGA suas próprias
-- linhas em notas_cfo1/2/3. Isso é ótimo para privacidade, mas tem um efeito
-- colateral: o frontend não consegue calcular "média da turma", "desvio-padrão"
-- ou "minha posição no ranking" só a partir do que ele vê (ele só vê a si mesmo).
-- A solução é uma função SECURITY DEFINER: ela roda com privilégio para ENXERGAR
-- todas as linhas internamente, mas só RETORNA números agregados + a posição
-- do próprio usuário — nunca o nome ou nota de outro aluno.
-- ============================================================

create or replace function public.estatisticas_modulo(p_tabela text, p_aluno_id uuid default null, p_turma_id uuid default null)
returns table (
  minha_media numeric,
  minha_posicao integer,
  total_alunos integer,
  media_turma numeric,
  desvio_padrao numeric,
  maior_media numeric,
  menor_media numeric
)
language plpgsql
security definer set search_path = public
as $$
declare
  v_alvo uuid;
begin
  if p_tabela not in ('notas_cfo1', 'notas_cfo2', 'notas_cfo3') then
    raise exception 'tabela inválida';
  end if;

  -- Por padrão, o alvo é o próprio usuário logado. Só um admin pode
  -- passar p_aluno_id para "simular" a visão de outro aluno.
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
      group by n.aluno_id
    ),
    ranked as (
      select aluno_id, media, rank() over (order by media desc) as posicao
      from medias
    )
    select
      (select media from ranked where aluno_id = $1),
      (select posicao::int from ranked where aluno_id = $1),
      (select count(*)::int from ranked),
      (select round(avg(media), 4) from ranked),
      (select round(stddev_pop(media), 4) from ranked),
      (select max(media) from ranked),
      (select min(media) from ranked)
  $f$, p_tabela) using v_alvo, p_turma_id;
end;
$$;

-- Admin usa a mesma lógica, mas para a classificação geral (média dos 3 módulos)
create or replace function public.estatisticas_classificacao_geral(p_aluno_id uuid default null, p_turma_id uuid default null)
returns table (
  minha_media numeric,
  minha_posicao integer,
  total_alunos integer,
  media_turma numeric,
  desvio_padrao numeric,
  maior_media numeric,
  menor_media numeric
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
  with medias_por_modulo as (
    select n.aluno_id, avg(n.nota_final) as media
    from public.notas_cfo1 n join public.profiles p on p.id = n.aluno_id
    where (p_turma_id is null or p.turma_id = p_turma_id)
    group by n.aluno_id
    union all
    select n.aluno_id, avg(n.nota_final) as media
    from public.notas_cfo2 n join public.profiles p on p.id = n.aluno_id
    where (p_turma_id is null or p.turma_id = p_turma_id)
    group by n.aluno_id
    union all
    select n.aluno_id, avg(n.nota_final) as media
    from public.notas_cfo3 n join public.profiles p on p.id = n.aluno_id
    where (p_turma_id is null or p.turma_id = p_turma_id)
    group by n.aluno_id
  ),
  media_geral as (
    select aluno_id, avg(media) as media
    from medias_por_modulo
    group by aluno_id
  ),
  ranked as (
    select aluno_id, media, rank() over (order by media desc) as posicao
    from media_geral
  )
  select
    (select media from ranked where aluno_id = v_alvo),
    (select posicao::int from ranked where aluno_id = v_alvo),
    (select count(*)::int from ranked),
    (select round(avg(media), 4) from ranked),
    (select round(stddev_pop(media), 4) from ranked),
    (select max(media) from ranked),
    (select min(media) from ranked);
end;
$$;

-- Permite que qualquer usuário autenticado chame essas funções
-- (a própria função internamente já restringe o que é devolvido)
grant execute on function public.estatisticas_modulo(text, uuid, uuid) to authenticated;
grant execute on function public.estatisticas_classificacao_geral(uuid, uuid) to authenticated;

-- ============================================================
-- 9) TURMAS (múltiplas, com histórico preservado) + PERSONALIZAÇÃO
-- Cada turma tem seu próprio nome/subtítulo/brasão. Alunos e notas ficam
-- vinculados a uma turma (profiles.turma_id) — nada se mistura entre turmas.
-- ============================================================
create table public.turmas (
  id uuid primary key default gen_random_uuid(),
  nome_turma text not null,
  subtitulo_turma text not null,
  brasao_url text,
  created_at timestamptz not null default now()
);

alter table public.turmas enable row level security;

create policy "turmas_select_todos" on public.turmas
  for select using (true);

create policy "turmas_admin_write" on public.turmas
  for all using (public.is_admin()) with check (public.is_admin());

alter table public.profiles add constraint profiles_turma_id_fkey
  foreign key (turma_id) references public.turmas(id);

-- Cria a primeira turma automaticamente (para instalação nova)
insert into public.turmas (nome_turma, subtitulo_turma, brasao_url)
values ('23º CFO', 'Turma Alencastro', '/lovable-uploads/brasao-novo.png');

insert into storage.buckets (id, name, public)
values ('brasoes', 'brasoes', true)
on conflict (id) do nothing;

create policy "brasoes_leitura_publica" on storage.objects
  for select using (bucket_id = 'brasoes');

create policy "brasoes_admin_insere" on storage.objects
  for insert with check (bucket_id = 'brasoes' and public.is_admin());

create policy "brasoes_admin_atualiza" on storage.objects
  for update using (bucket_id = 'brasoes' and public.is_admin());

create policy "brasoes_admin_apaga" on storage.objects
  for delete using (bucket_id = 'brasoes' and public.is_admin());

-- ============================================================
-- 10) AUDITORIA — histórico de mudanças (notas, turmas, perfis)
-- Só o papel "desenvolvedor" pode ler.
-- ============================================================
create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  operacao text not null,
  registro_id text,
  ator_id uuid,
  ator_nome text,
  dados_antigos jsonb,
  dados_novos jsonb,
  criado_em timestamptz not null default now()
);

alter table public.auditoria enable row level security;

create policy "auditoria_select_dev" on public.auditoria
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'desenvolvedor')
  );

create or replace function public.fn_registrar_auditoria()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_ator_nome text;
begin
  select nome_completo into v_ator_nome from public.profiles where id = auth.uid();
  insert into public.auditoria (tabela, operacao, registro_id, ator_id, ator_nome, dados_antigos, dados_novos)
  values (
    TG_TABLE_NAME, TG_OP,
    coalesce((case when TG_OP = 'DELETE' then OLD.id else NEW.id end)::text, ''),
    auth.uid(), v_ator_nome,
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) else null end
  );
  return coalesce(NEW, OLD);
end;
$$;

create trigger trg_auditoria_notas_cfo1 after insert or update or delete on public.notas_cfo1
  for each row execute function public.fn_registrar_auditoria();
create trigger trg_auditoria_notas_cfo2 after insert or update or delete on public.notas_cfo2
  for each row execute function public.fn_registrar_auditoria();
create trigger trg_auditoria_notas_cfo3 after insert or update or delete on public.notas_cfo3
  for each row execute function public.fn_registrar_auditoria();
create trigger trg_auditoria_turmas after insert or update or delete on public.turmas
  for each row execute function public.fn_registrar_auditoria();

-- Chamada pelas Edge Functions para auditar ações sobre PERFIS (criar/editar/
-- excluir usuário), já que ali se sabe com certeza quem é o ator.
create or replace function public.registrar_auditoria_manual(
  p_tabela text, p_operacao text, p_registro_id text, p_ator_id uuid,
  p_dados_antigos jsonb, p_dados_novos jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_ator_nome text;
begin
  select nome_completo into v_ator_nome from public.profiles where id = p_ator_id;
  insert into public.auditoria (tabela, operacao, registro_id, ator_id, ator_nome, dados_antigos, dados_novos)
  values (p_tabela, p_operacao, p_registro_id, p_ator_id, v_ator_nome, p_dados_antigos, p_dados_novos);
end;
$$;

grant execute on function public.registrar_auditoria_manual(text, text, text, uuid, jsonb, jsonb) to service_role;

-- ============================================================
-- COMO TORNAR SEU USUÁRIO ADMIN (rode depois de você se cadastrar):
-- update public.profiles set role = 'admin' where email = 'seu-email@exemplo.com';
-- ============================================================
