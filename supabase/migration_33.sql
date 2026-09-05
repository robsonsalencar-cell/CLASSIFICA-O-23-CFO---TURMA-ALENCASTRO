-- ============================================================
-- MIGRAÇÃO 33 — Fecha a auto-atribuição de role/turma no cadastro.
--
-- CONTEXTO: handle_new_user() (schema.sql, nunca alterado desde a
-- migration_4) cria o profile automático lendo role e turma_id de
-- new.raw_user_meta_data — o campo "user_metadata", que é o mesmo
-- campo que QUALQUER cadastro público (supabase.auth.signUp(), só
-- com a anon key, sem login nenhum) pode preencher livremente.
--
-- O app não tem tela de auto-cadastro (todo usuário é criado pela
-- Edge Function admin-create-user), mas isso só protegia enquanto o
-- toggle "Allow new users to sign up" (Authentication > Providers no
-- Supabase) estivesse desligado — e esse toggle nunca foi
-- documentado como verificado/desligado conscientemente. Se estiver
-- ligado (é o padrão em projeto novo do Supabase), qualquer pessoa
-- consegue chamar o signUp() direto e nascer com
-- role: "desenvolvedor" — acesso total, sem precisar de conta
-- prévia nem de nenhum outro bug.
--
-- CORREÇÃO: handle_new_user() passa a ler role/turma_id de
-- raw_app_meta_data ("app_metadata") em vez de raw_user_meta_data.
-- app_metadata só pode ser escrito por uma chamada com
-- service_role (a Edge Function admin-create-user, atualizada
-- junto com esta migração, agora manda role/turma_id ali) — um
-- supabase.auth.signUp() público nunca consegue tocar nesse campo,
-- não importa o que mande no body da requisição. Mesma filosofia
-- do vigia de RLS (migration_27): não depender de uma única
-- configuração externa continuar certa pra sempre.
--
-- IMPORTANTE: também é recomendável conferir/desligar "Allow new
-- users to sign up" em Authentication > Providers no painel do
-- Supabase — essa migração é defesa em profundidade, não substitui
-- essa checagem (recomendação registrada, não é algo que dê pra
-- fechar via SQL).
-- ============================================================

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
    coalesce((new.raw_app_meta_data->>'role')::public.app_role, 'aluno'),
    (new.raw_app_meta_data->>'turma_id')::uuid,
    false
  );
  return new;
end;
$$;
