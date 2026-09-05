-- ============================================================
-- MIGRAÇÃO 32 — Correções de segurança encontradas em varredura de
-- auditoria (05/09/2026), pedida pelo usuário sobre o estado atual
-- do projeto. Nenhum dos 4 problemas abaixo está documentado em
-- HISTORICO_PROJETO.md — são vulnerabilidades novas, não reincidência
-- das já corrigidas.
--
-- Resumo (ver relato completo entregue ao usuário fora deste arquivo):
--
-- A) ranking_turma() e ranking_completo_turma() eram GRANT EXECUTE TO
--    authenticated sem NENHUMA checagem interna de autorização — todo
--    usuário logado (inclusive um "aluno" comum) conseguia chamar a
--    RPC diretamente (sem passar pela tela) pedindo o ranking de
--    QUALQUER turma, inclusive turmas com "Ranking público" desligado
--    e turmas às quais nem pertence. Vazava nome completo + médias de
--    toda a turma. Corrigido adicionando checagem de autoridade
--    (admin/admin_institucional/desenvolvedor sempre podem; visitante
--    pode em qualquer turma, por design; aluno só na PRÓPRIA turma e
--    só se ranking_publico = true).
--
-- B) A função proteger_campos_sensiveis_profile() (migration_28) foi
--    criada pra impedir que um usuário comum edite os PRÓPRIOS campos
--    sensíveis (role, cpf, matricula, turma_id...) via chamada direta
--    à API. Mas a condição de isenção — "pode_configurar_turma(minha
--    própria turma)" — é verdadeira pra qualquer 'admin'/
--    'admin_institucional' editando A SI MESMO, já que ele
--    naturalmente tem autoridade sobre a própria turma. Ou seja: um
--    'admin' (Aluno-Auxiliar) podia chamar a API diretamente e setar
--    o PRÓPRIO role para 'desenvolvedor' ou 'admin_institucional',
--    sem passar pelos fluxos oficiais. Conferido que nenhuma tela do
--    app depende dessa isenção pra edição do PRÓPRIO perfil (o único
--    update direto de profiles feito pelo front-end é
--    senha_trocada, em AuthContext.tsx) — a isenção só é necessária
--    pra alguém editando O PERFIL DE OUTRA PESSOA. Corrigido
--    excluindo explicitamente o caso "editando a própria linha".
--
-- C) estatisticas_modulo() e estatisticas_classificacao_geral()
--    (migration_17) ainda usavam is_admin() — a função GLOBAL antiga,
--    sem escopo de turma, que a migration_15 disse ter substituído em
--    todo o app por pode_editar_turma()/pode_configurar_turma(). Como
--    sobrou aqui, um 'admin' de uma turma conseguia passar o
--    p_aluno_id de um aluno de OUTRA turma e ler a média/posição
--    individual dele. Corrigido trocando por pode_editar_turma(p_turma_id).
--
-- D) autocorrigir_rls() (migration_27, vigia automático a cada 5min)
--    tinha uma lista fixa de tabelas protegidas que não incluía
--    'auditoria' — justamente a tabela que guarda o histórico
--    completo de todo dado sensível já alterado no sistema (só o
--    desenvolvedor pode ler). Se o RLS dela for desligado (mesmo
--    incidente que já aconteceu 2x com 'profiles'), o vigia
--    automático não conserta sozinho. Adicionada à lista.
-- ============================================================

-- ------------------------------------------------------------
-- A) ranking_turma() e ranking_completo_turma()
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
    select aluno_id, avg(nota_final) as media from public.notas_cfo1 group by aluno_id
    union all
    select aluno_id, avg(nota_final) as media from public.notas_cfo2 group by aluno_id
    union all
    select aluno_id, avg(nota_final) as media from public.notas_cfo3 group by aluno_id
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
end;
$$;

grant execute on function public.ranking_completo_turma(uuid) to authenticated;

-- ------------------------------------------------------------
-- B) proteger_campos_sensiveis_profile() — fecha a auto-escalação
-- ------------------------------------------------------------

create or replace function public.proteger_campos_sensiveis_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Chamadas via service_role (Edge Functions administrativas,
  -- ex: admin-update-user) ou direto no SQL Editor não passam por
  -- essa restrição.
  if auth.role() is distinct from 'authenticated' then
    return new;
  end if;

  -- Quem tem autoridade de admin sobre a turma do registro E está
  -- editando O PERFIL DE OUTRA PESSOA também não é restringido (ex:
  -- um admin editando o perfil de um aluno pela tela do app). A
  -- condição "new.id is distinct from auth.uid()" é o que faltava:
  -- sem ela, um 'admin'/'admin_institucional' editando A SI MESMO
  -- também caía nesta isenção (ele sempre tem autoridade sobre a
  -- própria turma), permitindo se auto-promover a
  -- 'desenvolvedor'/'admin_institucional' via chamada direta à API.
  if new.id is distinct from auth.uid()
     and public.pode_configurar_turma(coalesce(new.turma_id, old.turma_id)) then
    return new;
  end if;

  -- Sobrou: o próprio dono da linha editando o próprio perfil
  -- (com ou sem autoridade de admin) — protege os campos sensíveis.
  new.role := old.role;
  new.cpf := old.cpf;
  new.matricula := old.matricula;
  new.matricula_academia := old.matricula_academia;
  new.turma_id := old.turma_id;
  new.matriculado_cfo1 := old.matriculado_cfo1;
  new.matriculado_cfo2 := old.matriculado_cfo2;
  new.matriculado_cfo3 := old.matriculado_cfo3;
  new.rg_pm := old.rg_pm;
  new.rg := old.rg;
  new.nome_completo := old.nome_completo;
  new.email := old.email;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- C) estatisticas_modulo() e estatisticas_classificacao_geral()
--    — trocam is_admin() (global) por pode_editar_turma(p_turma_id)
--    (escopado), igual ao resto do sistema desde a migration_15.
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

grant execute on function public.estatisticas_modulo(text, uuid, uuid, text[]) to authenticated;

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

grant execute on function public.estatisticas_classificacao_geral(uuid, uuid, text[], text[], text[]) to authenticated;

-- ------------------------------------------------------------
-- D) autocorrigir_rls() — inclui 'auditoria' na lista protegida
-- ------------------------------------------------------------

create or replace function public.autocorrigir_rls()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  tabelas_protegidas text[] := array[
    'profiles', 'notas_cfo1', 'notas_cfo2', 'notas_cfo3',
    'turmas', 'configuracoes_turma', 'desligamentos',
    'comissoes_encerramento', 'membros_comissao', 'classificacao_final',
    'auditoria'
  ];
  t text;
  estava_desligado boolean;
begin
  foreach t in array tabelas_protegidas loop
    select not rowsecurity into estava_desligado
    from pg_tables
    where schemaname = 'public' and tablename = t;

    if estava_desligado then
      execute format('alter table public.%I enable row level security', t);

      insert into public.auditoria (tabela, operacao, ator_nome, dados_novos)
      values (
        t,
        'RLS_AUTO_CORRIGIDO',
        'vigia automático (autocorrigir_rls)',
        jsonb_build_object(
          'mensagem', 'RLS foi encontrado desativado e foi reativado automaticamente',
          'quando', now()
        )
      );
    end if;
  end loop;
end;
$$;
