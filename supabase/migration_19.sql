-- ============================================================
-- MIGRAÇÃO 19 — Novas colunas biográficas em profiles, para os dados
-- que estão sendo coletados via planilha (Google Sheets) da 23ª
-- turma, com vista ao Boletim Escolar, Diploma e Histórico Escolar.
--
-- Campos já existentes em profiles que JÁ cobrem colunas da planilha
-- (não recriados aqui): nome_completo, email, cpf, matricula
-- (matrícula funcional do policial no Estado — confirmado com o
-- usuário em 17/08/2026, diferente de matricula_academia, a
-- matrícula didática 2025.23xx.1), rg_pm, naturalidade,
-- data_nascimento, filiacao_pai, filiacao_mae, escola_anterior,
-- ano_conclusao_ensino_medio, grau_concluido (migration_18).
--
-- Colunas novas nesta migração — sem correspondente ainda:
--   rg                    RG civil (diferente de rg_pm, que é o RG
--                         funcional da PM)
--   telefone              telefone de contato do aluno
--   endereco              endereço completo
--   estado_civil          estado civil
--   telefone_emergencia   telefone de contato de emergência
--   experiencia_anterior  experiência profissional anterior ao CFO
--                         (ex: "Praça PMMT", "Advocacia privada")
-- ============================================================

alter table public.profiles add column if not exists rg text;
alter table public.profiles add column if not exists telefone text;
alter table public.profiles add column if not exists endereco text;
alter table public.profiles add column if not exists estado_civil text;
alter table public.profiles add column if not exists telefone_emergencia text;
alter table public.profiles add column if not exists experiencia_anterior text;
