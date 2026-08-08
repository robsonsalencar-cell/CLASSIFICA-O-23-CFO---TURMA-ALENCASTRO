-- ============================================================
-- MIGRAÇÃO 9 — Faz o toggle "Ranking p/ alunos" funcionar de verdade.
--
-- Até aqui, mesmo com "ranking_publico = true", o RLS (segurança em nível
-- de linha) do banco continuava bloqueando qualquer aluno de enxergar
-- nome/nota de outro aluno — só o admin conseguia ver todo mundo. O toggle
-- só mudava o comportamento pretendido do app, mas o banco barrava os dados.
--
-- Esta migração libera, especificamente, ver colegas da MESMA turma quando
-- a turma estiver com ranking_publico = true. Fora isso, nada muda: cada
-- aluno continua só enxergando a própria turma, e só quando o admin
-- liberar o botão.
-- ============================================================

-- Função auxiliar (security definer, como is_admin()): evita recursão de RLS
-- e verifica, do lado do Postgres, se o usuário logado pode ver o perfil/nota
-- de p_aluno_id por ele ser colega de turma com ranking público liberado.
create or replace function public.mesma_turma_ranking_publico(p_aluno_id uuid)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles eu
    join public.profiles alvo on alvo.turma_id = eu.turma_id
    join public.turmas t on t.id = eu.turma_id
    where eu.id = auth.uid()
      and alvo.id = p_aluno_id
      and t.ranking_publico = true
  );
$$;

-- profiles: além do próprio perfil e do admin, libera ver colegas da mesma
-- turma quando o ranking estiver público (necessário pra exibir os nomes
-- no ranking completo).
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin_or_ranking"
  on public.profiles for select
  using (
    id = auth.uid()
    or public.is_admin()
    or public.mesma_turma_ranking_publico(id)
  );

-- notas_cfo1 / notas_cfo2 / notas_cfo3: mesma liberação, pra ranking e
-- classificação geral mostrarem as notas de todos quando público.
drop policy if exists "notas_cfo1_select" on public.notas_cfo1;
create policy "notas_cfo1_select" on public.notas_cfo1 for select
  using (aluno_id = auth.uid() or public.is_admin() or public.mesma_turma_ranking_publico(aluno_id));

drop policy if exists "notas_cfo2_select" on public.notas_cfo2;
create policy "notas_cfo2_select" on public.notas_cfo2 for select
  using (aluno_id = auth.uid() or public.is_admin() or public.mesma_turma_ranking_publico(aluno_id));

drop policy if exists "notas_cfo3_select" on public.notas_cfo3;
create policy "notas_cfo3_select" on public.notas_cfo3 for select
  using (aluno_id = auth.uid() or public.is_admin() or public.mesma_turma_ranking_publico(aluno_id));
