-- ============================================================
-- MIGRAÇÃO 17 — Aplica o filtro de matérias oficiais também no
-- CÁLCULO DA MÉDIA (não só na contagem de "matérias lançadas").
--
-- BUG: desde a migration_12, estatisticas_modulo() e
-- estatisticas_classificacao_geral() recebem a lista oficial de
-- matérias do módulo (p_materias_oficiais / p_materias_cfoN) e já a
-- usavam para filtrar a CTE `progresso` (contagem de "matérias
-- lançadas"). Mas a CTE `medias`/`media_cfoN` — que calcula
-- minha_media, media_turma, minha_posicao, maior_media, menor_media —
-- continuava fazendo avg(nota_final) sobre TODAS as linhas de
-- notas_cfoN do aluno, sem aplicar esse mesmo filtro.
--
-- Efeito prático: uma matéria retirada da lista oficial (ex:
-- "Seminário de Trabalho Científico-Workshop de Banca de Defesa do
-- TCC", retirada por instrução explícita em 17/08/2026 — ver
-- src/config/materiasCfo3.ts) continuava entrando na média de módulo
-- calculada por esta função (usada no card "Minha média/posição"),
-- mesmo já tendo sido excluída do cálculo equivalente no front-end
-- (src/hooks/useAlunosModulo.ts) — divergência do mesmo tipo já
-- corrigida antes entre RPC e front-end (ver migration_10/16).
--
-- CORREÇÃO: a CTE de médias agora também filtra por
-- p_materias_oficiais / p_materias_cfoN, igual à CTE de progresso.
-- ============================================================

drop function if exists public.estatisticas_modulo(text, uuid, uuid, text[]);

create or replace function public.estatisticas_modulo(
  p_tabela text,
  p_aluno_id uuid default null,
  p_turma_id uuid default null,
  p_materias_oficiais text[] default null
)
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
        and ($3 is null or n.materia = any($3))
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
        and ($3 is null or n.materia = any($3))
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
  $f$, p_tabela, v_coluna_matricula, p_tabela) using v_alvo, p_turma_id, p_materias_oficiais;
end;
$$;

drop function if exists public.estatisticas_classificacao_geral(uuid, uuid, text[], text[], text[]);

create or replace function public.estatisticas_classificacao_geral(
  p_aluno_id uuid default null,
  p_turma_id uuid default null,
  p_materias_cfo1 text[] default null,
  p_materias_cfo2 text[] default null,
  p_materias_cfo3 text[] default null
)
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
      and (p_materias_cfo1 is null or n.materia = any(p_materias_cfo1))
    group by n.aluno_id
  ),
  media_cfo2 as (
    select n.aluno_id, avg(n.nota_final) as media
    from public.notas_cfo2 n
    join public.profiles p on p.id = n.aluno_id
    where (p_turma_id is null or p.turma_id = p_turma_id)
      and p.matriculado_cfo2 = true
      and (p_materias_cfo2 is null or n.materia = any(p_materias_cfo2))
    group by n.aluno_id
  ),
  media_cfo3 as (
    select n.aluno_id, avg(n.nota_final) as media
    from public.notas_cfo3 n
    join public.profiles p on p.id = n.aluno_id
    where (p_turma_id is null or p.turma_id = p_turma_id)
      and p.matriculado_cfo3 = true
      and (p_materias_cfo3 is null or n.materia = any(p_materias_cfo3))
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
      (select count(distinct n.materia) from public.notas_cfo1 n join public.profiles p on p.id = n.aluno_id where (p_turma_id is null or p.turma_id = p_turma_id) and n.nota_final is not null and (p_materias_cfo1 is null or n.materia = any(p_materias_cfo1)))
      + (select count(distinct n.materia) from public.notas_cfo2 n join public.profiles p on p.id = n.aluno_id where (p_turma_id is null or p.turma_id = p_turma_id) and n.nota_final is not null and (p_materias_cfo2 is null or n.materia = any(p_materias_cfo2)))
      + (select count(distinct n.materia) from public.notas_cfo3 n join public.profiles p on p.id = n.aluno_id where (p_turma_id is null or p.turma_id = p_turma_id) and n.nota_final is not null and (p_materias_cfo3 is null or n.materia = any(p_materias_cfo3)))
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
    (select progresso.materias_lancadas::int from progresso);
end;
$$;

grant execute on function public.estatisticas_modulo(text, uuid, uuid, text[]) to authenticated;
grant execute on function public.estatisticas_classificacao_geral(uuid, uuid, text[], text[], text[]) to authenticated;
