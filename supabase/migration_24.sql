-- ============================================================
-- MIGRAÇÃO 24 — Prazo legal de ingresso (fim da janela em que a
-- matrícula didática pode ser reordenada).
--
-- CONTEXTO: por lei, um candidato só pode ingressar no curso até ter
-- passado 25% da carga horária de uma matéria (é assim que o Al Of
-- PM Juliano Jacinto Caminha entrou na 23ª turma, por decisão
-- judicial, já com as aulas em andamento). Enquanto essa janela
-- estiver aberta, a lista de matriculados ainda pode mudar e a
-- matrícula didática precisa refletir a posição alfabética CORRETA
-- de cada um — não só "próximo número livre" no fim da fila.
--
-- Depois que essa janela se fecha (não é mais legalmente possível
-- ingressar), a matrícula de todo mundo passa a ser definitiva —
-- volta a valer a trava de "nunca renumerar" já implementada.
-- ============================================================

alter table public.turmas
  add column if not exists data_limite_ingresso date;
