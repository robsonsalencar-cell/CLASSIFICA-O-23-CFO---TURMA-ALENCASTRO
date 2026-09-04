-- ============================================================
-- MIGRAÇÃO 29 — Novo papel "visitante".
--
-- CONTEXTO: pedido do usuário (01/09/2026) — um perfil pra pessoas
-- lotadas na Academia de Polícia Militar Costa Verde (comandantes de
-- pelotão, comandante da academia, etc.) que só querem acompanhar a
-- classificação das turmas, sem ser aluno nem administrador. Só
-- visualiza ranking — sem acesso a planilhas, históricos, boletins ou
-- qualquer exportação de documento.
--
-- IMPORTANTE: ALTER TYPE ... ADD VALUE precisa rodar sozinho, fora de
-- qualquer transação que já tente usar esse valor novo (senão o
-- Postgres recusa) — por isso esta migração só faz essa única coisa.
-- Rode ela primeiro, sozinha, antes da migration_30.sql.
-- ============================================================

alter type public.app_role add value if not exists 'visitante';
