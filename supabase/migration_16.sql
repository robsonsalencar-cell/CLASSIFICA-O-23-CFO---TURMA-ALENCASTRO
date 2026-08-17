-- ============================================================
-- MIGRAÇÃO 16 — Restaura o "Ranking p/ alunos" (ranking_publico),
-- que foi derrubado sem querer pela migration_15.
--
-- CONTEXTO: a migration_9 tinha adicionado, às políticas de SELECT de
-- profiles/notas_cfo1/2/3, uma condição extra —
-- public.mesma_turma_ranking_publico(id) — que libera um aluno comum
-- ver nome/nota de colegas da MESMA turma quando o admin ativa o
-- toggle "Ranking p/ alunos". Sem isso, o RLS bloqueia a leitura e o
-- aluno só enxerga a própria linha, mesmo com o toggle ligado no app.
--
-- A migration_15 (permissões multi-turma institucional) recriou essas
-- mesmas políticas do zero para corrigir um vazamento real entre
-- turmas diferentes, trocando is_admin() (global) por
-- pode_configurar_turma()/pode_editar_turma() (escopado por turma) —
-- mas, ao reescrever, não incluiu de volta a condição
-- mesma_turma_ranking_publico(id). Resultado: alunos comuns passaram
-- a ver só a própria linha na Classificação Geral, mesmo com o
-- ranking liberado pelo admin (Top 3, CARROCEIROS e Ranking Completo
-- mostravam só o próprio usuário).
--
-- Esta migração recria as políticas combinando as duas regras: escopo
-- por turma para quem administra (migration_15) + exceção de ranking
-- público para colegas de turma (migration_9). A função
-- mesma_turma_ranking_publico() já existe (criada na migration_9) e
-- não precisa ser recriada.
-- ============================================================

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles for select
  using (
    id = auth.uid()
    or public.pode_configurar_turma(turma_id)
    or public.mesma_turma_ranking_publico(id)
  );

drop policy if exists "notas_cfo1_select" on public.notas_cfo1;
create policy "notas_cfo1_select" on public.notas_cfo1 for select
  using (
    aluno_id = auth.uid()
    or public.pode_configurar_turma((select turma_id from public.profiles where id = aluno_id))
    or public.mesma_turma_ranking_publico(aluno_id)
  );

drop policy if exists "notas_cfo2_select" on public.notas_cfo2;
create policy "notas_cfo2_select" on public.notas_cfo2 for select
  using (
    aluno_id = auth.uid()
    or public.pode_configurar_turma((select turma_id from public.profiles where id = aluno_id))
    or public.mesma_turma_ranking_publico(aluno_id)
  );

drop policy if exists "notas_cfo3_select" on public.notas_cfo3;
create policy "notas_cfo3_select" on public.notas_cfo3 for select
  using (
    aluno_id = auth.uid()
    or public.pode_configurar_turma((select turma_id from public.profiles where id = aluno_id))
    or public.mesma_turma_ranking_publico(aluno_id)
  );

drop policy if exists "classificacao_select" on public.classificacao_final;
create policy "classificacao_select" on public.classificacao_final for select
  using (
    aluno_id = auth.uid()
    or public.pode_configurar_turma((select turma_id from public.profiles where id = aluno_id))
    or public.mesma_turma_ranking_publico(aluno_id)
  );
