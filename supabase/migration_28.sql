-- ============================================================
-- MIGRAÇÃO 28 — Protege campos sensíveis de profiles contra
-- auto-edição indevida.
--
-- CONTEXTO (descoberto em 01/09/2026, investigando um registro de
-- auditoria de auto-edição): a política "profiles_update_own" libera
-- update na própria linha (id = auth.uid()), mas não restringe QUAIS
-- colunas podem ser alteradas — RLS funciona por linha, não por
-- coluna. Como não existe nenhum GRANT limitando colunas, e o
-- Supabase concede UPDATE amplo por padrão pro role authenticated,
-- isso significa que qualquer aluno logado poderia, em teoria,
-- chamar a API diretamente (sem precisar de nenhuma tela no app) e
-- alterar o PRÓPRIO role para "admin", ou mexer em cpf, matrícula,
-- turma_id, matriculado_cfoX, rg — mesmo sem nenhuma tela do app
-- expor isso.
--
-- CORREÇÃO: gatilho (trigger) que roda em qualquer UPDATE de
-- profiles. Quando quem está editando é o próprio usuário autenticado
-- comum (não uma chamada administrativa via service_role/SQL direto,
-- nem alguém com autoridade de admin sobre a turma), os campos
-- sensíveis são silenciosamente mantidos com o valor anterior,
-- não importa o que o cliente tenha enviado.
-- ============================================================

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

  -- Quem tem autoridade de admin sobre a turma do registro também não é
  -- restringido (ex: um admin editando outro perfil pela tela do app).
  if public.pode_configurar_turma(coalesce(new.turma_id, old.turma_id)) then
    return new;
  end if;

  -- Sobrou: o próprio dono da linha editando o próprio perfil, sem
  -- autoridade de admin — protege os campos sensíveis.
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

drop trigger if exists trg_proteger_campos_sensiveis_profile on public.profiles;
create trigger trg_proteger_campos_sensiveis_profile
before update on public.profiles
for each row execute function public.proteger_campos_sensiveis_profile();
