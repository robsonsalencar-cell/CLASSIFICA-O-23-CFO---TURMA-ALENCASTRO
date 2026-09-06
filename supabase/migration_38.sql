-- ============================================================
-- Decisão do usuário (2026-09-05): dados de aluno NÃO podem aparecer
-- pra outros alunos, só pra admin. Hoje, quando o admin liga "Ranking
-- p/ alunos" (turmas.ranking_publico), a policy de SELECT de `profiles`
-- libera a LINHA INTEIRA de cada colega pra qualquer aluno da mesma
-- turma — não só nome/matrícula (que é tudo que a tela realmente
-- mostra), mas também CPF, RG, endereço, telefone, filiação, tema de
-- TCC etc, acessível direto via API (GET /rest/v1/profiles?id=eq.<colega>).
--
-- Esta migration fecha essa brecha SEM remover a funcionalidade do
-- ranking público em si:
--   1) Tira a exceção de ranking público da policy de SELECT de
--      `profiles` — a partir de agora só o próprio dono da linha ou um
--      admin com autoridade sobre a turma conseguem ler a linha
--      completa de um perfil.
--   2) Cria uma função nova, SECURITY DEFINER, que devolve SÓ
--      id + nome_completo + matrícula (nada sensível) de uma turma,
--      liberada exatamente nas mesmas condições que antes liberavam a
--      linha inteira (admin, visitante, ou aluno da própria turma com
--      ranking_publico=true). O código do app (useNotasModulo.ts) passa
--      a chamar essa função pra montar nome/matrícula de cada colega no
--      ranking, em vez de depender do embed profiles(...) do PostgREST
--      (que dependia da policy ampla que estamos fechando agora).
--
-- Não mexe nas policies de notas_cfo1/2/3 (mesma_turma_ranking_publico
-- continua valendo lá) — ver essas linhas é o próprio propósito do
-- ranking público (mostrar a nota de cada um), só a ficha pessoal
-- completa em `profiles` que não deve mais vazar.
-- ============================================================

-- 1) Fecha a brecha em profiles
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles for select
  using (
    id = auth.uid()
    or public.pode_configurar_turma(turma_id)
  );

-- 2) Função segura: só nome + matrícula, nunca a linha inteira
create or replace function public.nomes_turma_ranking_publico(p_turma_id uuid)
returns table (id uuid, nome_completo text, matricula text)
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
    raise exception 'Sem permissão para ver os nomes desta turma.';
  end if;

  return query
  select p.id, p.nome_completo, p.matricula
  from public.profiles p
  where p.turma_id = p_turma_id;
end;
$$;

grant execute on function public.nomes_turma_ranking_publico(uuid) to authenticated;

-- confere: a policy não tem mais a exceção de ranking público, e a
-- função nova existe
select
  (select count(*) from pg_policies where tablename = 'profiles' and policyname = 'profiles_select_own_or_admin' and qual ilike '%mesma_turma_ranking_publico%') = 0 as policy_fechada,
  exists (select 1 from pg_proc where proname = 'nomes_turma_ranking_publico') as funcao_criada;
