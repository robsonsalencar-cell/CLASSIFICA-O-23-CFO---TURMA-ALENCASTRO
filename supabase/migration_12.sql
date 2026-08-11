-- ============================================================
-- MIGRAÇÃO 12 — materias_lancadas agora só conta matérias que
-- batem com a lista curricular oficial do módulo, em vez de
-- contar qualquer string distinta gravada em `materia`.
--
-- MOTIVO: o card "Matérias Avaliadas" do admin (calculado no
-- front-end em useAlunosModulo.ts) já filtra pela lista oficial
-- (`listaMaterias.filter(m => set.has(m))`) exatamente para se
-- proteger de grafia divergente no banco — problema que já
-- aconteceu de verdade neste projeto (ver
-- supabase/diagnostico_materias_cfo1.sql e o normalizador de
-- nomes em src/hooks/useGoogleSheets.ts). A versão SQL de
-- materias_lancadas criada na migration_11 não tinha essa
-- proteção: se existisse uma matéria com nota lançada sob uma
-- grafia diferente da oficial, o numerador do card do ALUNO
-- ficaria maior que o do admin — podendo até superar o
-- denominador (ex: "86/85").
--
-- CORREÇÃO: as duas funções passam a receber a lista oficial de
-- matérias como parâmetro (o front-end já tem essa lista em
-- src/config/materiasCfoN.ts) e o COUNT(DISTINCT ...) só
-- considera matérias presentes nessa lista.
-- ============================================================

drop function if exists public.estatisticas_modulo(text, uuid, uuid);

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

drop function if exists public.estatisticas_classificacao_geral(uuid, uuid);

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
