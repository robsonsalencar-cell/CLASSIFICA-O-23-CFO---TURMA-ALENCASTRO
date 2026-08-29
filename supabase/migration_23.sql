-- ============================================================
-- MIGRAÇÃO 23 — Data de início das aulas, trava a geração de
-- matrícula didática antes desse dia.
--
-- CONTEXTO: por orientação da administração da APMCV (repassada pelo
-- usuário em 29/08/2026): o número de matrícula só deve ser gerado
-- DEPOIS que as aulas realmente começam — não assim que cada aluno é
-- cadastrado no sistema. Faz sentido: entre o cadastro e o início
-- das aulas, a lista de matriculados ainda pode mudar (inclusão por
-- decisão judicial, desligamento antes mesmo de começar, como
-- aconteceu com a Al Of PM Lavínia Diniz Siqueira na 23ª turma —
-- ver migration_22.sql) — gerar matrícula cedo demais corre o risco
-- de precisar renumerar todo mundo depois, exatamente o problema que
-- acabamos de corrigir manualmente.
-- ============================================================

alter table public.turmas
  add column if not exists data_inicio_aulas date;
