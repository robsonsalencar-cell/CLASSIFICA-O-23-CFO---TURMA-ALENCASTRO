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

-- DROP necessário: a versão ao vivo desta função no banco divergiu para as
-- colunas `sua_media`/`sua_posicao` (renomeadas durante uma correção manual
-- anterior do erro de coluna ambígua). O Postgres não deixa `CREATE OR
-- REPLACE FUNCTION` renomear colunas de retorno existentes — só adicionar
-- novas no final — por isso o DROP force a recriação com os nomes corretos
-- (`minha_media`/`minha_posicao`, o padrão usado em todo o resto do projeto,
-- inclusive em estatisticas_modulo).
drop function if exists public.estatisticas_classificacao_geral(uuid, uuid);

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
    -- Qualificado como progresso.materias_lancadas: sem o prefixo, o Postgres
    -- reclama de "column reference is ambiguous" porque o nome da coluna do
    -- CTE colide com o parâmetro OUT de mesmo nome do RETURNS TABLE desta
    -- função (só acontece aqui porque esta função roda a query direto, sem
    -- EXECUTE — em estatisticas_modulo, que monta a query como texto e roda
    -- via EXECUTE format(...), a mesma colisão não ocorre).
    (select progresso.materias_lancadas::int from progresso);
end;
$$;

grant execute on function public.estatisticas_modulo(text, uuid, uuid) to authenticated;
grant execute on function public.estatisticas_classificacao_geral(uuid, uuid) to authenticated;
