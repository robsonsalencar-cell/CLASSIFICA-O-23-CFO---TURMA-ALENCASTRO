-- ============================================================
-- MIGRAÇÃO 15 — Permissões multi-turma institucional.
--
-- Antes: is_admin() dava poder GLOBAL (qualquer turma) pra quem tivesse
-- role 'admin'/'desenvolvedor'. Isso incluía um vazamento real: um admin
-- de qualquer turma conseguia ler o perfil completo (CPF, RG, filiação...)
-- de alunos de QUALQUER outra turma, via profiles_select_own_or_admin.
--
-- Depois desta migração:
--   - 'admin' fica escopado à própria turma (profiles.turma_id), exceto
--     numa janela de "bootstrap": qualquer admin pode configurar (cadastrar
--     aluno, nomear admin) uma turma nova que AINDA não tem admin oficial.
--     Editar NOTA nunca tem essa janela — só o admin oficial da turma.
--   - novo papel 'admin_institucional' (cross-turma), mas travado quando a
--     turma está finalizada, a não ser que o desenvolvedor autorize.
--   - 'desenvolvedor' continua sem limite nenhum.
-- ============================================================

-- 'admin_institucional' já foi adicionado ao enum antes desta migração
-- rodar (ALTER TYPE ... ADD VALUE não pode estar na mesma transação de
-- código que já usa o valor novo — precisa commitar sozinho primeiro):
-- alter type public.app_role add value if not exists 'admin_institucional';

alter table public.turmas
  add column if not exists finalizada boolean not null default false,
  add column if not exists autorizacao_institucional boolean not null default false;

-- ------------------------------------------------------------
-- Funções centrais
-- ------------------------------------------------------------

create or replace function public.is_algum_admin(p_usuario_id uuid default auth.uid())
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.profiles
    where id = p_usuario_id and role in ('admin', 'admin_institucional', 'desenvolvedor')
  );
$$;

-- Edição de NOTA/classificação — nunca tem janela de bootstrap.
create or replace function public.pode_editar_turma(p_turma_id uuid, p_usuario_id uuid default auth.uid())
returns boolean
language plpgsql security definer set search_path = public stable
as $$
declare
  v_role public.app_role;
  v_minha_turma uuid;
  v_finalizada boolean;
  v_autorizada boolean;
begin
  if p_turma_id is null then return false; end if;

  select role, turma_id into v_role, v_minha_turma from public.profiles where id = p_usuario_id;
  if v_role is null then return false; end if;
  if v_role = 'desenvolvedor' then return true; end if;

  select finalizada, autorizacao_institucional into v_finalizada, v_autorizada
  from public.turmas where id = p_turma_id;

  if v_role = 'admin_institucional' then
    return (not v_finalizada) or v_autorizada;
  end if;

  if v_role = 'admin' then
    return v_minha_turma = p_turma_id and not v_finalizada;
  end if;

  return false;
end;
$$;

-- Configuração (perfis, matrícula, papel, dados da turma) — mesma regra de
-- pode_editar_turma, mais a janela de bootstrap pra turma sem admin oficial.
create or replace function public.pode_configurar_turma(p_turma_id uuid, p_usuario_id uuid default auth.uid())
returns boolean
language plpgsql security definer set search_path = public stable
as $$
declare
  v_tem_admin_oficial boolean;
begin
  if p_turma_id is null then return false; end if;
  if public.pode_editar_turma(p_turma_id, p_usuario_id) then return true; end if;

  select exists (
    select 1 from public.profiles where turma_id = p_turma_id and role = 'admin'
  ) into v_tem_admin_oficial;

  return (
    not v_tem_admin_oficial
    and exists (
      select 1 from public.profiles
      where id = p_usuario_id and role in ('admin', 'admin_institucional', 'desenvolvedor')
    )
  );
end;
$$;

grant execute on function public.is_algum_admin(uuid) to authenticated;
grant execute on function public.pode_editar_turma(uuid, uuid) to authenticated;
grant execute on function public.pode_configurar_turma(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- Trava as colunas de ciclo de vida contra update direto — só passam pelas
-- 2 funções abaixo, que sinalizam a exceção via set_config antes do update
-- interno.
-- ------------------------------------------------------------

create or replace function public.bloquear_edicao_direta_ciclo_vida()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.permitir_ciclo_vida', true), '') = 'true' then
    return new;
  end if;
  if new.finalizada is distinct from old.finalizada
     or new.autorizacao_institucional is distinct from old.autorizacao_institucional then
    raise exception 'Use finalizar_turma()/autorizar_admin_institucional() para mudar isso.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_ciclo_vida on public.turmas;
create trigger trg_bloquear_ciclo_vida before update on public.turmas
  for each row execute function public.bloquear_edicao_direta_ciclo_vida();

-- ------------------------------------------------------------
-- RPCs de ação
-- ------------------------------------------------------------

create or replace function public.finalizar_turma(p_turma_id uuid, p_finalizada boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin_institucional', 'desenvolvedor')
  ) then
    raise exception 'Só o admin institucional ou o desenvolvedor podem finalizar uma turma.';
  end if;
  perform set_config('app.permitir_ciclo_vida', 'true', true);
  update public.turmas set finalizada = p_finalizada where id = p_turma_id;
end;
$$;

create or replace function public.autorizar_admin_institucional(p_turma_id uuid, p_valor boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'desenvolvedor') then
    raise exception 'Só o desenvolvedor pode autorizar edição numa turma finalizada.';
  end if;
  perform set_config('app.permitir_ciclo_vida', 'true', true);
  update public.turmas set autorizacao_institucional = p_valor where id = p_turma_id;
end;
$$;

create or replace function public.transferir_admin_institucional(p_novo_admin_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_role public.app_role;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('admin_institucional', 'desenvolvedor') then
    raise exception 'Só o admin institucional atual ou o desenvolvedor podem transferir essa função.';
  end if;

  update public.profiles set role = 'admin_institucional' where id = p_novo_admin_id;

  if v_role = 'admin_institucional' then
    update public.profiles set role = 'admin' where id = auth.uid();
  end if;
end;
$$;

grant execute on function public.finalizar_turma(uuid, boolean) to authenticated;
grant execute on function public.autorizar_admin_institucional(uuid, boolean) to authenticated;
grant execute on function public.transferir_admin_institucional(uuid) to authenticated;

-- ------------------------------------------------------------
-- Resumo cross-turma (só leitura) — nome + média final, sem detalhe por
-- matéria, sem dado biográfico. Combinado com estatisticas_modulo/
-- estatisticas_classificacao_geral (já existem, já SECURITY DEFINER, já
-- aceitam p_turma_id) dá pra montar o resumo de qualquer turma.
-- ------------------------------------------------------------

create or replace function public.ranking_turma(p_turma_id uuid)
returns table (nome text, media_final numeric)
language sql security definer set search_path = public stable
as $$
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
$$;

grant execute on function public.ranking_turma(uuid) to authenticated;

-- ------------------------------------------------------------
-- RLS: troca is_admin() (global) pelas funções escopadas
-- ------------------------------------------------------------

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles for select
  using (id = auth.uid() or public.pode_configurar_turma(turma_id));

drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_admin_write" on public.profiles for all
  using (public.pode_configurar_turma(turma_id))
  with check (public.pode_configurar_turma(turma_id));

drop policy if exists "notas_cfo1_select" on public.notas_cfo1;
create policy "notas_cfo1_select" on public.notas_cfo1 for select
  using (aluno_id = auth.uid() or public.pode_configurar_turma((select turma_id from public.profiles where id = aluno_id)));
drop policy if exists "notas_cfo1_admin_write" on public.notas_cfo1;
create policy "notas_cfo1_admin_write" on public.notas_cfo1 for all
  using (public.pode_editar_turma((select turma_id from public.profiles where id = aluno_id)))
  with check (public.pode_editar_turma((select turma_id from public.profiles where id = aluno_id)));

drop policy if exists "notas_cfo2_select" on public.notas_cfo2;
create policy "notas_cfo2_select" on public.notas_cfo2 for select
  using (aluno_id = auth.uid() or public.pode_configurar_turma((select turma_id from public.profiles where id = aluno_id)));
drop policy if exists "notas_cfo2_admin_write" on public.notas_cfo2;
create policy "notas_cfo2_admin_write" on public.notas_cfo2 for all
  using (public.pode_editar_turma((select turma_id from public.profiles where id = aluno_id)))
  with check (public.pode_editar_turma((select turma_id from public.profiles where id = aluno_id)));

drop policy if exists "notas_cfo3_select" on public.notas_cfo3;
create policy "notas_cfo3_select" on public.notas_cfo3 for select
  using (aluno_id = auth.uid() or public.pode_configurar_turma((select turma_id from public.profiles where id = aluno_id)));
drop policy if exists "notas_cfo3_admin_write" on public.notas_cfo3;
create policy "notas_cfo3_admin_write" on public.notas_cfo3 for all
  using (public.pode_editar_turma((select turma_id from public.profiles where id = aluno_id)))
  with check (public.pode_editar_turma((select turma_id from public.profiles where id = aluno_id)));

drop policy if exists "classificacao_select" on public.classificacao_final;
create policy "classificacao_select" on public.classificacao_final for select
  using (aluno_id = auth.uid() or public.pode_configurar_turma((select turma_id from public.profiles where id = aluno_id)));
drop policy if exists "classificacao_admin_write" on public.classificacao_final;
create policy "classificacao_admin_write" on public.classificacao_final for all
  using (public.pode_editar_turma((select turma_id from public.profiles where id = aluno_id)))
  with check (public.pode_editar_turma((select turma_id from public.profiles where id = aluno_id)));

drop policy if exists "turmas_admin_write" on public.turmas;
create policy "turmas_admin_write_insert" on public.turmas for insert
  with check (public.is_algum_admin());
create policy "turmas_admin_write_update" on public.turmas for update
  using (public.pode_configurar_turma(id)) with check (public.pode_configurar_turma(id));
create policy "turmas_admin_write_delete" on public.turmas for delete
  using (public.pode_configurar_turma(id));
-- turmas_select_todos (using true) continua igual — resumo cross-turma
-- depende de toda turma ser listável.

drop policy if exists "brasoes_admin_insere" on storage.objects;
create policy "brasoes_admin_insere" on storage.objects
  for insert with check (bucket_id = 'brasoes' and public.is_algum_admin());
drop policy if exists "brasoes_admin_atualiza" on storage.objects;
create policy "brasoes_admin_atualiza" on storage.objects
  for update using (bucket_id = 'brasoes' and public.is_algum_admin());
drop policy if exists "brasoes_admin_apaga" on storage.objects;
create policy "brasoes_admin_apaga" on storage.objects
  for delete using (bucket_id = 'brasoes' and public.is_algum_admin());

-- ------------------------------------------------------------
-- Auditoria estendida a profiles (já existe em notas_cfoN e turmas)
-- ------------------------------------------------------------

drop trigger if exists trg_auditoria_profiles on public.profiles;
create trigger trg_auditoria_profiles after insert or update or delete on public.profiles
  for each row execute function public.fn_registrar_auditoria();
