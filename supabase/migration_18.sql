-- ============================================================
-- MIGRAÇÃO 18 — Nova coluna grau_concluido em profiles, usada no
-- parágrafo de abertura do Histórico Escolar (exportHistorico.ts).
--
-- CONTEXTO: o texto fixo do histórico dizia sempre "tendo concluído o
-- 2º Grau no(a) [escola]". Mas alguns alunos concluíram um curso
-- superior antes do CFO, não o ensino médio (ex: "tendo concluído o
-- Curso de Bacharel em Direito pela UNIVAG"). grau_concluido permite
-- personalizar esse trecho por aluno — inclusive a preposição
-- ("no(a)"/"pela"). Deixe em branco para manter o padrão "o 2º Grau
-- no(a)" (comportamento idêntico ao anterior a esta migração).
-- ============================================================

alter table public.profiles add column if not exists grau_concluido text;
