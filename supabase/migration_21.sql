-- ============================================================
-- MIGRAÇÃO 21 — Desligamento de aluno sem conta no sistema
--
-- CONTEXTO: ao preencher os desligamentos reais da 23ª turma, a
-- Al Of PM Lavínia Diniz Siqueira (desligada em 15/09/2025, ainda no
-- 1º Ano) não tem nenhum registro em profiles — ela nunca chegou a
-- ter conta no app, provavelmente por ter saído antes dos alunos
-- serem cadastrados na plataforma. A tabela desligamentos exigia
-- aluno_id obrigatório (referenciando profiles), o que tornava
-- impossível registrar esse caso — um cenário que certamente vai se
-- repetir em turmas futuras.
--
-- CORREÇÃO: aluno_id passa a ser opcional. Quando não há conta no
-- sistema, usa-se aluno_nome_manual (texto livre) no lugar. Pelo
-- menos um dos dois é sempre obrigatório (check constraint).
-- ============================================================

alter table public.desligamentos
  alter column aluno_id drop not null;

alter table public.desligamentos
  add column aluno_nome_manual text;

alter table public.desligamentos
  add constraint desligamentos_aluno_identificado
  check (aluno_id is not null or aluno_nome_manual is not null);

-- a constraint "unique (aluno_id)" já existente permanece válida com
-- aluno_id nulo (múltiplos NULLs não conflitam entre si no Postgres)
