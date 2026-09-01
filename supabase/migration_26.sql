-- ============================================================
-- MIGRAÇÃO 26 — Checagem de segurança do banco (RLS), visível no app.
--
-- CONTEXTO: descobrimos em 29/08/2026 que a tabela profiles ficou
-- com RLS desativado (e uma política antiga vazando dados entre
-- turmas) por um bom tempo sem ninguém perceber, porque essas
-- mudanças foram feitas direto no banco, fora do controle de versão
-- do projeto. O usuário pediu uma forma de detectar isso cedo, sem
-- depender de lembrar de rodar SQL manualmente — como os dados
-- envolvidos (CPF, RG, notas de cada aluno) são extremamente
-- sigilosos, essa checagem passa a ficar visível toda vez que a
-- página de Auditoria (já restrita ao desenvolvedor) for aberta.
--
-- Retorna, para cada tabela do schema public: se o RLS está
-- ativado, e quantas políticas ela tem. Uma tabela com RLS desligado,
-- ou com RLS ligado mas zero políticas (o que travaria totalmente o
-- acesso, um problema diferente mas também preocupante), aparece
-- destacada na tela.
-- ============================================================

create or replace function public.checar_seguranca_rls()
returns table (
  tabela text,
  rls_ativado boolean,
  qtd_policies integer
)
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'desenvolvedor') then
    raise exception 'Acesso restrito ao desenvolvedor.';
  end if;

  return query
  select
    t.tablename::text,
    t.rowsecurity,
    (select count(*)::int from pg_policies p where p.schemaname = 'public' and p.tablename = t.tablename)
  from pg_tables t
  where t.schemaname = 'public'
  order by t.rowsecurity asc, t.tablename;
end;
$$;

grant execute on function public.checar_seguranca_rls() to authenticated;
