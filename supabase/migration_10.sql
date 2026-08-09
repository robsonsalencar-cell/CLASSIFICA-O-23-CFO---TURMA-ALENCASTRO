-- ============================================================
-- MIGRAÇÃO 10 — Corrige a função estatisticas_classificacao_geral,
-- usada pelo card "Minha posição" na Classificação Geral.
--
-- BUG: a versão anterior (migration_3.sql) incluía no ranking geral
-- qualquer aluno com nota em PELO MENOS 1 módulo, tirando a média só
-- dos módulos que ele tinha (via UNION ALL + AVG). Isso divergia da
-- tabela completa em ClassificacaoGeral.tsx, que exige nota nos 3
-- módulos para entrar na Classificação Geral — e também nunca
-- respeitava matriculado_cfo1/2/3 (diferente de estatisticas_modulo,
-- corrigida na migration_7.sql).
--
-- Efeito prático do bug: um aluno que saiu do curso após o CFO I
-- (ex: Angelo, matriculado só em CFO I) entrava no ranking geral com
-- a média dele só do CFO I, empurrando a posição de todo mundo abaixo
-- dele. Por isso o card individual "Minha posição" mostrava uma
-- posição diferente (pior) do que a tabela completa da Classificação
-- Geral, que já filtrava isso corretamente no front-end.
--
-- CORREÇÃO: agora só entra no ranking geral quem tem média válida
-- (e matrícula ativa) nos 3 módulos — mesmo critério do front-end —
-- e a média final é a média simples das 3 médias de módulo, igual à
-- função mediaSimples() usada em ClassificacaoGeral.tsx.
-- ============================================================

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
  -- só entra na classificação geral quem tem média nos 3 módulos —
  -- mesmo critério usado em ClassificacaoGeral.tsx (front-end)
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

grant execute on function public.estatisticas_classificacao_geral(uuid, uuid) to authenticated;
