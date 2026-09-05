-- ============================================================
-- MIGRAÇÃO 34 — Colunas de TCC em profiles (tema, orientador, data
-- de apresentação).
--
-- CONTEXTO: com o encerramento do 23º CFO, é preciso registrar o
-- tema do Trabalho de Conclusão de Curso e o orientador de cada
-- aluno — dado exigido no Diploma. A data de apresentação das
-- bancas é um evento único por turma (25/08/2026 pra 23ª turma),
-- mas fica gravada por aluno (não na tabela turmas) pra já vir
-- pronta pra próximas turmas que podem ter datas de apresentação
-- diferentes por aluno (ex: reapresentação de banca).
--
-- Generic, não específico da 23ª turma — qualquer turma futura usa
-- as mesmas colunas.
-- ============================================================

alter table public.profiles add column if not exists tema_tcc text;
alter table public.profiles add column if not exists orientador_tcc text;
alter table public.profiles add column if not exists data_apresentacao_tcc date;
