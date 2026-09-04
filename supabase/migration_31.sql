-- ============================================================
-- MIGRAÇÃO 31 — Corrige o valor padrão de matriculado_cfoX.
--
-- CONTEXTO: essas colunas nasceram (migration_7.sql) com "default
-- true" — pensado pro caso comum (aluno), mas errado pra qualquer
-- outro papel. Isso já causou duas contas institucionais aparecerem
-- incorretamente na lista de Alunos (Roni e "APM Costa Verde"),
-- precisando de correção manual cada vez.
--
-- A Edge Function admin-create-user já foi corrigida pra sempre
-- definir esses campos explicitamente na criação (true só quando o
-- papel é 'aluno'). Esta migração é uma segunda camada de proteção:
-- muda o padrão da COLUNA em si pra false, cobrindo qualquer outro
-- caminho de criação de perfil que não passe por aquela function
-- (ex: o trigger que cria o profile automaticamente no cadastro).
--
-- Não afeta nenhuma linha já existente — só o valor usado quando um
-- INSERT novo não especifica esses campos.
-- ============================================================

alter table public.profiles alter column matriculado_cfo1 set default false;
alter table public.profiles alter column matriculado_cfo2 set default false;
alter table public.profiles alter column matriculado_cfo3 set default false;
