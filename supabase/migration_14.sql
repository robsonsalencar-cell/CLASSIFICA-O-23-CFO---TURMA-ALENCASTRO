-- ============================================================
-- MIGRAÇÃO 14 — Campos novos para o Histórico Escolar (Fase 2):
-- dados biográficos do aluno, número de matrícula-registro na
-- Academia, número de registro do próprio documento, e
-- nome/posto do Comandante da APMCV por turma. Nenhum desses
-- campos entra em cálculo de nota_final/ranking/média — são só
-- de exibição no documento exportado.
-- ============================================================

alter table public.profiles
  add column if not exists rg_pm text,
  add column if not exists filiacao_pai text,
  add column if not exists filiacao_mae text,
  add column if not exists naturalidade text,
  add column if not exists data_nascimento date,
  add column if not exists matricula_academia text,
  add column if not exists escola_anterior text,
  add column if not exists ano_conclusao_ensino_medio text,
  add column if not exists numero_registro_historico integer;

alter table public.turmas
  add column if not exists comandante_apmcv_nome text,
  add column if not exists comandante_apmcv_posto text,
  add column if not exists proximo_numero_registro_historico integer not null default 1;
