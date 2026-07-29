-- ============================================================
-- MIGRAÇÃO 3 — Suporte a múltiplas turmas (histórico preservado)
-- Rode no SQL Editor do Supabase, depois de migration_2.sql.
-- ============================================================

-- 1) TABELA DE TURMAS
create table if not exists public.turmas (
  id uuid primary key default gen_random_uuid(),
  nome_turma text not null,
  subtitulo_turma text not null,
  brasao_url text,
  created_at timestamptz not null default now()
);

alter table public.turmas enable row level security;

create policy "turmas_select_todos" on public.turmas
  for select using (auth.role() = 'authenticated' or true);

create policy "turmas_admin_write" on public.turmas
  for all using (public.is_admin()) with check (public.is_admin());

-- 2) MIGRA A CONFIGURAÇÃO ATUAL (única) PARA VIRAR A PRIMEIRA TURMA,
--    e vincula todos os alunos já existentes a ela — nada se perde.
do $$
declare
  v_turma_id uuid;
begin
  -- só roda se ainda não existir nenhuma turma (evita duplicar se rodar 2x)
  if not exists (select 1 from public.turmas limit 1) then
    insert into public.turmas (nome_turma, subtitulo_turma, brasao_url)
    select nome_turma, subtitulo_turma, brasao_url
    from public.configuracoes_turma where id = 1
    returning id into v_turma_id;

    if v_turma_id is null then
      insert into public.turmas (nome_turma, subtitulo_turma, brasao_url)
      values ('23º CFO', 'Turma Alencastro', '/lovable-uploads/brasao-novo.png')
      returning id into v_turma_id;
    end if;
  else
    select id into v_turma_id from public.turmas order by created_at asc limit 1;
  end if;

  alter table public.profiles add column if not exists turma_id uuid references public.turmas(id);
  update public.profiles set turma_id = v_turma_id where turma_id is null;
end $$;

-- 3) ESCOPO DE TURMA NAS FUNÇÕES DE ESTATÍSTICA
-- (recriadas com o parâmetro p_turma_id — obrigatório passar a partir de agora)
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

grant execute on function public.estatisticas_modulo(text, uuid, uuid) to authenticated;
grant execute on function public.estatisticas_classificacao_geral(uuid, uuid) to authenticated;

-- Remove as versões antigas das funções (sem p_turma_id) para não ficar duplicado
drop function if exists public.estatisticas_modulo(text, uuid);
drop function if exists public.estatisticas_classificacao_geral(uuid);
