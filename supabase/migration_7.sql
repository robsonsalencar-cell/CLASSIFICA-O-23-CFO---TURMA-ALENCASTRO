-- ============================================================
-- MIGRAÇÃO 7 — Controle de matrícula por módulo. Um aluno que saiu do
-- curso (ex: só fez CFO I) para de ser considerado em CFO II/III daqui
-- pra frente — mesmo em lançamentos em lote, mesmo em rankings/estatísticas.
-- ============================================================

alter table public.profiles add column if not exists matriculado_cfo1 boolean not null default true;
alter table public.profiles add column if not exists matriculado_cfo2 boolean not null default true;
alter table public.profiles add column if not exists matriculado_cfo3 boolean not null default true;

-- Marca o Angelo Marcio como só matriculado no CFO I (saiu do curso depois)
update public.profiles
set matriculado_cfo2 = false, matriculado_cfo3 = false
where nome_completo = 'Angelo Marcio Ferreira Menezes';

-- Remove as notas dele que foram lançadas por engano em CFO II/III
-- (inclusive as de nota 10 em lote de agora há pouco)
delete from public.notas_cfo2
where aluno_id = (select id from public.profiles where nome_completo = 'Angelo Marcio Ferreira Menezes');

delete from public.notas_cfo3
where aluno_id = (select id from public.profiles where nome_completo = 'Angelo Marcio Ferreira Menezes');

-- ============================================================
-- Atualiza as funções de estatística para respeitar a matrícula por módulo
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
    )
    select
      (select media from ranked where aluno_id = $1),
      (select posicao::int from ranked where aluno_id = $1),
      (select count(*)::int from ranked),
      (select round(avg(media), 4) from ranked),
      (select round(stddev_pop(media), 4) from ranked),
      (select max(media) from ranked),
      (select min(media) from ranked)
  $f$, p_tabela, v_coluna_matricula) using v_alvo, p_turma_id;
end;
$$;
