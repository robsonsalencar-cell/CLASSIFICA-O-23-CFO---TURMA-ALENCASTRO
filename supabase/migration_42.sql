-- ============================================================
-- MIGRAÇÃO 42 — Ranking/Classificação só conta matéria "fechada" nos
-- dois pelotões (03/10/2026)
--
-- CONTEXTO: o 24º CFO foi dividido em 2 pelotões só por falta de espaço
-- físico — continua sendo UMA turma só, mas cada matéria chega em 2
-- diários de classe separados (1 por pelotão), importados em momentos
-- diferentes. Até agora, a média/posição de um aluno contava QUALQUER
-- matéria em que ele já tinha nota, mesmo que o diário do OUTRO pelotão
-- daquela mesma matéria ainda nem tivesse sido importado. Isso distorce
-- o ranking: quem está no pelotão cujo diário chegou primeiro passa a
-- ter mais matérias contando na média do que quem está no outro
-- pelotão, mesmo sendo a mesma turma e devendo as mesmas matérias.
--
-- DECISÃO DO USUÁRIO (03/10/2026): uma matéria só deve contar na
-- média/posição (individual ou na tabela completa do admin) quando
-- ela estiver "fechada" — ou seja, TODOS os matriculados da turma
-- naquele módulo já têm nota lançada nela (os dois pelotões). Antes
-- disso, o aluno continua vendo a própria nota normalmente em "Minhas
-- notas por matéria" — só a média/posição aguarda a matéria fechar.
-- Essa regra vale pra qualquer turma (não só a que tem 2 pelotões): se
-- um dia outra turma também for dividida, já funciona do mesmo jeito.
--
-- Nova função utilitária: materias_completas_turma(p_turma_id, p_tabela)
-- devolve as matérias de uma tabela de notas que já têm nota lançada
-- para 100% dos matriculados daquele módulo na turma. As 4 funções de
-- ranking/estatística passam a só considerar matérias que aparecem
-- nessa lista (além de baterem com a lista curricular oficial, onde já
-- havia esse filtro).
-- ============================================================

create or replace function public.materias_completas_turma(p_turma_id uuid, p_tabela text)
returns table (materia text)
language plpgsql
security definer set search_path = public
stable
as $$
declare
  v_coluna_matricula text;
  v_total_matriculados int;
begin
  if p_tabela not in ('notas_cfo1', 'notas_cfo2', 'notas_cfo3') then
    raise exception 'tabela inválida';
  end if;

  if p_turma_id is null then
    return;
  end if;

  v_coluna_matricula := 'matriculado_' || replace(p_tabela, 'notas_', '');

  execute format(
    'select count(*) from public.profiles where turma_id = $1 and %I = true',
    v_coluna_matricula
  ) into v_total_matriculados using p_turma_id;

  if v_total_matriculados is null or v_total_matriculados = 0 then
    return;
  end if;

  return query execute format($f$
    select n.materia
    from public.%I n
    join public.profiles p on p.id = n.aluno_id
    where p.turma_id = $1 and p.%I = true
    group by n.materia
    having count(*) filter (where n.nota_final is not null) = $2
  $f$, p_tabela, v_coluna_matricula)
  using p_turma_id, v_total_matriculados;
end;
$$;

grant execute on function public.materias_completas_turma(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- estatisticas_modulo() — só conta, na média/posição, matéria que seja
-- ao mesmo tempo oficial (p_materias_oficiais) E completa (os dois
-- pelotões já lançados). "materias_lancadas" (indicador de progresso,
-- "X de 84 matérias") continua contando qualquer matéria já iniciada,
-- sem essa exigência — isso é progresso operacional, não ranking.
-- ------------------------------------------------------------

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
  v_materias_completas text[];
  v_materias_contaveis text[];
begin
  if p_tabela not in ('notas_cfo1', 'notas_cfo2', 'notas_cfo3') then
    raise exception 'tabela inválida';
  end if;

  v_coluna_matricula := 'matriculado_' || replace(p_tabela, 'notas_', '');

  if p_aluno_id is not null and public.pode_editar_turma(p_turma_id) then
    v_alvo := p_aluno_id;
  else
    v_alvo := auth.uid();
  end if;

  select array(select materia from public.materias_completas_turma(p_turma_id, p_tabela))
    into v_materias_completas;

  if p_materias_oficiais is null then
    v_materias_contaveis := v_materias_completas;
  else
    v_materias_contaveis := array(
      select unnest(p_materias_oficiais)
      intersect
      select unnest(v_materias_completas)
    );
  end if;

  return query execute format($f$
    with medias as (
      select n.aluno_id, avg(n.nota_final) as media
      from public.%I n
      join public.profiles p on p.id = n.aluno_id
      where ($2 is null or p.turma_id = $2)
        and p.%I = true
        and n.materia = any($4)
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
  $f$, p_tabela, v_coluna_matricula, p_tabela)
  using v_alvo, p_turma_id, p_materias_oficiais, v_materias_contaveis;
end;
$$;

grant execute on function public.estatisticas_modulo(text, uuid, uuid, text[]) to authenticated;

-- ------------------------------------------------------------
-- estatisticas_classificacao_geral() — mesma regra, aplicada a cada um
-- dos 3 módulos (continua progressiva, da migration_41: entra na geral
-- quem já tem pelo menos 1 módulo com matéria completa).
-- ------------------------------------------------------------

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
  if p_aluno_id is not null and public.pode_editar_turma(p_turma_id) then
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
      and n.materia in (select materia from public.materias_completas_turma(p_turma_id, 'notas_cfo1'))
    group by n.aluno_id
  ),
  media_cfo2 as (
    select n.aluno_id, avg(n.nota_final) as media
    from public.notas_cfo2 n
    join public.profiles p on p.id = n.aluno_id
    where (p_turma_id is null or p.turma_id = p_turma_id)
      and p.matriculado_cfo2 = true
      and (p_materias_cfo2 is null or n.materia = any(p_materias_cfo2))
      and n.materia in (select materia from public.materias_completas_turma(p_turma_id, 'notas_cfo2'))
    group by n.aluno_id
  ),
  media_cfo3 as (
    select n.aluno_id, avg(n.nota_final) as media
    from public.notas_cfo3 n
    join public.profiles p on p.id = n.aluno_id
    where (p_turma_id is null or p.turma_id = p_turma_id)
      and p.matriculado_cfo3 = true
      and (p_materias_cfo3 is null or n.materia = any(p_materias_cfo3))
      and n.materia in (select materia from public.materias_completas_turma(p_turma_id, 'notas_cfo3'))
    group by n.aluno_id
  ),
  media_geral as (
    select
      p.id as aluno_id,
      (coalesce(c1.media, 0) + coalesce(c2.media, 0) + coalesce(c3.media, 0))
      / nullif(
          (case when c1.media is not null then 1 else 0 end
           + case when c2.media is not null then 1 else 0 end
           + case when c3.media is not null then 1 else 0 end), 0
        ) as media
    from public.profiles p
    left join media_cfo1 c1 on c1.aluno_id = p.id
    left join media_cfo2 c2 on c2.aluno_id = p.id
    left join media_cfo3 c3 on c3.aluno_id = p.id
    where (p_turma_id is null or p.turma_id = p_turma_id)
      and (p.matriculado_cfo1 = true or p.matriculado_cfo2 = true or p.matriculado_cfo3 = true)
      and (c1.media is not null or c2.media is not null or c3.media is not null)
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

grant execute on function public.estatisticas_classificacao_geral(uuid, uuid, text[], text[], text[]) to authenticated;

-- ------------------------------------------------------------
-- ranking_turma() e ranking_completo_turma() (telas de Visitante e
-- export de Ata) — mesma regra de matéria completa.
-- ------------------------------------------------------------

create or replace function public.ranking_turma(p_turma_id uuid)
returns table (nome text, media_final numeric)
language plpgsql security definer set search_path = public stable
as $$
begin
  if p_turma_id is null then
    raise exception 'p_turma_id é obrigatório.';
  end if;

  if not (
    public.pode_editar_turma(p_turma_id)
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'visitante')
    or exists (
      select 1 from public.profiles pr
      join public.turmas t on t.id = pr.turma_id
      where pr.id = auth.uid() and pr.turma_id = p_turma_id
        and pr.role = 'aluno' and t.ranking_publico = true
    )
  ) then
    raise exception 'Sem permissão para ver o ranking desta turma.';
  end if;

  return query
  select p.nome_completo, avg(m.media) as media_final
  from (
    select n.aluno_id, avg(n.nota_final) as media
    from public.notas_cfo1 n
    where n.materia in (select materia from public.materias_completas_turma(p_turma_id, 'notas_cfo1'))
    group by n.aluno_id
    union all
    select n.aluno_id, avg(n.nota_final) as media
    from public.notas_cfo2 n
    where n.materia in (select materia from public.materias_completas_turma(p_turma_id, 'notas_cfo2'))
    group by n.aluno_id
    union all
    select n.aluno_id, avg(n.nota_final) as media
    from public.notas_cfo3 n
    where n.materia in (select materia from public.materias_completas_turma(p_turma_id, 'notas_cfo3'))
    group by n.aluno_id
  ) m
  join public.profiles p on p.id = m.aluno_id
  where p.turma_id = p_turma_id
  group by p.nome_completo
  having count(*) = 3;
end;
$$;

grant execute on function public.ranking_turma(uuid) to authenticated;

create or replace function public.ranking_completo_turma(p_turma_id uuid)
returns table (
  nome_completo text,
  media_cfo1 numeric,
  media_cfo2 numeric,
  media_cfo3 numeric,
  media_geral numeric,
  modulos_com_nota integer
)
language plpgsql
security definer set search_path = public
stable
as $$
begin
  if p_turma_id is null then
    raise exception 'p_turma_id é obrigatório.';
  end if;

  if not (
    public.pode_editar_turma(p_turma_id)
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'visitante')
    or exists (
      select 1 from public.profiles pr
      join public.turmas t on t.id = pr.turma_id
      where pr.id = auth.uid() and pr.turma_id = p_turma_id
        and pr.role = 'aluno' and t.ranking_publico = true
    )
  ) then
    raise exception 'Sem permissão para ver o ranking desta turma.';
  end if;

  return query
  with c1 as (
    select aluno_id, avg(nota_final) as media
    from public.notas_cfo1
    where materia in (select materia from public.materias_completas_turma(p_turma_id, 'notas_cfo1'))
    group by aluno_id
  ),
  c2 as (
    select aluno_id, avg(nota_final) as media
    from public.notas_cfo2
    where materia in (select materia from public.materias_completas_turma(p_turma_id, 'notas_cfo2'))
    group by aluno_id
  ),
  c3 as (
    select aluno_id, avg(nota_final) as media
    from public.notas_cfo3
    where materia <> 'Seminário de Trabalho Científico-Workshop de Banca de Defesa do TCC'
      and materia in (select materia from public.materias_completas_turma(p_turma_id, 'notas_cfo3'))
    group by aluno_id
  )
  select
    p.nome_completo,
    round(c1.media, 4) as media_cfo1,
    round(c2.media, 4) as media_cfo2,
    round(c3.media, 4) as media_cfo3,
    round(
      (coalesce(c1.media, 0) + coalesce(c2.media, 0) + coalesce(c3.media, 0))
      / nullif(
          (case when c1.media is not null then 1 else 0 end
           + case when c2.media is not null then 1 else 0 end
           + case when c3.media is not null then 1 else 0 end), 0
        ), 4
    ) as media_geral,
    (case when c1.media is not null then 1 else 0 end
     + case when c2.media is not null then 1 else 0 end
     + case when c3.media is not null then 1 else 0 end) as modulos_com_nota
  from public.profiles p
  left join c1 on c1.aluno_id = p.id
  left join c2 on c2.aluno_id = p.id
  left join c3 on c3.aluno_id = p.id
  where p.turma_id = p_turma_id
    and (c1.media is not null or c2.media is not null or c3.media is not null)
  order by media_geral desc nulls last, p.nome_completo;
end;
$$;

grant execute on function public.ranking_completo_turma(uuid) to authenticated;
