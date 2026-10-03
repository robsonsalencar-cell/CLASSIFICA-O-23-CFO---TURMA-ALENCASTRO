-- ============================================================
-- MIGRAÇÃO 41 — Classificação Geral passa a contar progressivamente
-- (03/10/2026)
--
-- CONTEXTO: no 24º CFO, só "Direito Ambiental" (CFO I) foi lançado até
-- agora. A aluna Roberta Nascimento Oliveira abriu a tela "Classificação
-- Final" e viu "MINHA POSIÇÃO: —  de 0 alunos", mesmo já tendo nota
-- lançada. Causa: estatisticas_classificacao_geral() (migration_32) usa
-- JOIN (inner) entre media_cfo1, media_cfo2 e media_cfo3 — só considera
-- um aluno pra posição/média geral quando ele já tem nota nos TRÊS
-- módulos. No início do curso (só o CFO I rodando), ninguém tem CFO II
-- nem CFO III ainda, então a CTE media_geral fica vazia pra turma
-- inteira — daí "0 alunos" e posição em branco pra todo mundo.
--
-- DECISÃO DO USUÁRIO (confirmada 03/10/2026): a Classificação Final
-- precisa ir contabilizando colocação desde a primeira matéria lançada,
-- não só quando o curso estiver com os 3 módulos completos — justamente
-- pra já saber "quem está em qual colocação" caso o curso termine antes
-- do previsto. Isso NÃO muda a fórmula oficial (Método A: média geral =
-- média das 3 médias de módulo, cada módulo valendo 1/3) — só passa a
-- calcular essa média geral com os módulos que JÁ têm nota lançada,
-- tratando o(s) módulo(s) ainda não iniciado(s) como ausente(s) em vez
-- de zerar a média do aluno. Mesmo princípio que ranking_completo_turma()
-- (migration_30/32, usada na tela do visitante) já usa — esta migração
-- só alinha estatisticas_classificacao_geral() (usada na tela do PRÓPRIO
-- aluno/admin, com p_materias_cfoX e permissão por auth.uid()) à mesma
-- lógica, já que são dois cálculos de "geral" que hoje divergem.
--
-- Nada na permissão/escopo muda: continua SECURITY DEFINER, continua
-- só o admin da turma podendo consultar p_aluno_id de outro aluno, e o
-- toggle "Ranking p/ alunos" (ranking_publico) continua controlando se o
-- aluno comum vê só a própria posição ou a tabela inteira — isso é
-- decidido no front-end (ClassificacaoGeral.tsx), não nesta função.
-- ============================================================

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
  -- Antes: join (inner) entre c1/c2/c3 — exigia os 3 módulos completos.
  -- Agora: parte de TODOS os matriculados em QUALQUER módulo da turma e
  -- faz left join com cada CTE de média — um aluno entra na classificação
  -- assim que tiver nota em PELO MENOS UM módulo, e a média geral usa só
  -- os módulos que ele já tem (mesma lógica de ranking_completo_turma).
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
