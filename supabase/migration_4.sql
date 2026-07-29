-- ============================================================
-- MIGRAÇÃO 4 — papel "desenvolvedor", troca de senha obrigatória no
-- primeiro acesso, e auditoria de mudanças.
-- Rode no SQL Editor do Supabase, depois de migration_3.sql.
-- ============================================================

-- 1) NOVO PAPEL: desenvolvedor (acesso total + auditoria)
alter type public.app_role add value if not exists 'desenvolvedor';

-- 2) TROCA DE SENHA OBRIGATÓRIA NO PRIMEIRO ACESSO
alter table public.profiles add column if not exists senha_trocada boolean not null default false;

-- Usuários que JÁ EXISTEM (já vêm usando o sistema) não devem ser
-- surpreendidos com a tela obrigatória — só quem for criado a partir de agora.
update public.profiles set senha_trocada = true where senha_trocada = false;

-- Atualiza o trigger de criação de perfil para já vir com senha_trocada = false
-- (obrigando a troca) em todo usuário criado a partir de agora.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nome_completo, email, cpf, role, turma_id, senha_trocada)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome_completo', new.email),
    new.email,
    new.raw_user_meta_data->>'cpf',
    coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'aluno'),
    (new.raw_user_meta_data->>'turma_id')::uuid,
    false
  );
  return new;
end;
$$;

-- 3) SEU USUÁRIO VIRA DESENVOLVEDOR (acesso irrestrito + auditoria)
update public.profiles set role = 'desenvolvedor' where email = 'robsonsalencar@gmail.com';

-- 4) AUDITORIA
create table if not exists public.auditoria (
  id uuid primary key default gen_random_uuid(),
  tabela text not null,
  operacao text not null,
  registro_id text,
  ator_id uuid,
  ator_nome text,
  dados_antigos jsonb,
  dados_novos jsonb,
  criado_em timestamptz not null default now()
);

alter table public.auditoria enable row level security;

-- Só "desenvolvedor" pode LER a auditoria (nem admin comum vê)
create policy "auditoria_select_dev" on public.auditoria
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'desenvolvedor')
  );

-- Ninguém insere/edita/apaga manualmente — só a função abaixo (security definer)
-- e as chamadas explícitas nas Edge Functions.

create or replace function public.fn_registrar_auditoria()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_ator_nome text;
begin
  select nome_completo into v_ator_nome from public.profiles where id = auth.uid();

  insert into public.auditoria (tabela, operacao, registro_id, ator_id, ator_nome, dados_antigos, dados_novos)
  values (
    TG_TABLE_NAME,
    TG_OP,
    coalesce((case when TG_OP = 'DELETE' then OLD.id else NEW.id end)::text, ''),
    auth.uid(),
    v_ator_nome,
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) else null end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) else null end
  );

  return coalesce(NEW, OLD);
end;
$$;

-- Aplicado em notas (todo lançamento/edição/exclusão) e turmas.
-- (perfis são auditados via chamada explícita nas Edge Functions, para ter o
-- nome de quem executou a ação corretamente, já que criação de usuário roda
-- num contexto interno do Supabase Auth sem uma sessão autenticada "normal")
drop trigger if exists trg_auditoria_notas_cfo1 on public.notas_cfo1;
create trigger trg_auditoria_notas_cfo1 after insert or update or delete on public.notas_cfo1
  for each row execute function public.fn_registrar_auditoria();

drop trigger if exists trg_auditoria_notas_cfo2 on public.notas_cfo2;
create trigger trg_auditoria_notas_cfo2 after insert or update or delete on public.notas_cfo2
  for each row execute function public.fn_registrar_auditoria();

drop trigger if exists trg_auditoria_notas_cfo3 on public.notas_cfo3;
create trigger trg_auditoria_notas_cfo3 after insert or update or delete on public.notas_cfo3
  for each row execute function public.fn_registrar_auditoria();

drop trigger if exists trg_auditoria_turmas on public.turmas;
create trigger trg_auditoria_turmas after insert or update or delete on public.turmas
  for each row execute function public.fn_registrar_auditoria();

-- Função usada pelas Edge Functions para registrar ações sobre PERFIS
-- (criar/editar/excluir usuário), já que ali sabemos com certeza quem é o ator.
create or replace function public.registrar_auditoria_manual(
  p_tabela text, p_operacao text, p_registro_id text, p_ator_id uuid,
  p_dados_antigos jsonb, p_dados_novos jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_ator_nome text;
begin
  select nome_completo into v_ator_nome from public.profiles where id = p_ator_id;
  insert into public.auditoria (tabela, operacao, registro_id, ator_id, ator_nome, dados_antigos, dados_novos)
  values (p_tabela, p_operacao, p_registro_id, p_ator_id, v_ator_nome, p_dados_antigos, p_dados_novos);
end;
$$;

grant execute on function public.registrar_auditoria_manual(text, text, text, uuid, jsonb, jsonb) to service_role;
