-- ============================================================
-- MIGRAÇÃO 5 — CORREÇÃO CRÍTICA: a função is_admin() e as políticas de
-- "profiles" checavam literalmente role = 'admin', mas não sabiam que
-- 'desenvolvedor' também deveria ter esse acesso. Isso fazia o usuário
-- desenvolvedor perder acesso de leitura aos outros perfis (e, em cascata,
-- a tudo que depende de is_admin(): notas, turmas, classificação, etc).
-- Rode no SQL Editor do Supabase, depois de migration_4.sql.
-- ============================================================

-- Corrige a função central usada por quase todas as políticas do sistema
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'desenvolvedor')
  );
$$;

-- Corrige as 2 políticas de "profiles" que tinham a checagem embutida
-- (não usavam a função is_admin(), por isso a correção acima não bastava)
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('admin', 'desenvolvedor')
    )
  );

drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_admin_write"
  on public.profiles for all
  using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'desenvolvedor'))
  )
  with check (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('admin', 'desenvolvedor'))
  );
