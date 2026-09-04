-- ============================================================
-- MIGRAÇÃO 30 — Ranking seguro para o papel "visitante".
--
-- Diferente de ranking_turma() (migration_15, exige os 3 módulos
-- completos pra aparecer), esta função funciona em qualquer estágio
-- do curso — mostra a média de cada módulo já lançado e a média
-- geral parcial (só entre os módulos com nota). Não expõe nenhum
-- dado pessoal (CPF, RG, telefone, e-mail) — só nome e médias,
-- SECURITY DEFINER, liberada pra qualquer usuário autenticado
-- (inclusive Visitante) em qualquer turma.
-- ============================================================

create or replace function public.ranking_completo_turma(p_turma_id uuid)
returns table (
  nome_completo text,
  media_cfo1 numeric,
  media_cfo2 numeric,
  media_cfo3 numeric,
  media_geral numeric,
  modulos_com_nota integer
)
language sql
security definer set search_path = public
stable
as $$
  with c1 as (
    select aluno_id, avg(nota_final) as media
    from public.notas_cfo1
    group by aluno_id
  ),
  c2 as (
    select aluno_id, avg(nota_final) as media
    from public.notas_cfo2
    group by aluno_id
  ),
  c3 as (
    select aluno_id, avg(nota_final) as media
    from public.notas_cfo3
    where materia <> 'Seminário de Trabalho Científico-Workshop de Banca de Defesa do TCC'
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
$$;

grant execute on function public.ranking_completo_turma(uuid) to authenticated;
