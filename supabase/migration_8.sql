-- ============================================================
-- MIGRAÇÃO 8 — Permite ao admin/desenvolvedor liberar (ou bloquear) o
-- ranking completo para os alunos verem, com um botão rápido no app
-- (por padrão continua BLOQUEADO — cada aluno só vê o próprio resumo).
-- ============================================================
alter table public.turmas add column if not exists ranking_publico boolean not null default false;
