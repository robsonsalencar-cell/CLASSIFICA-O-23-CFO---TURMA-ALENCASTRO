-- ============================================================
-- MIGRAÇÃO 35 — Suporte a geração de Ata de Encerramento (Word)
-- direto do app, a partir dos dados já cadastrados em
-- comissoes_encerramento (migration_20).
--
-- CONTEXTO: comparando os modelos oficiais reais (Ata do 1º/2º/3º
-- Ano e Ata de Classificação Geral, fornecidos em 05/09/2026) com o
-- código do app, constatamos que esse gerador nunca foi construído —
-- os documentos existentes foram feitos manualmente em sessões de
-- chat anteriores. As tabelas já existiam pensando nisso
-- ("o futuro gerador automático de atas usa esses dados
-- diretamente" — comentário original da migration_20).
--
-- Duas colunas novas:
--   tipo_ata          identifica QUAL modelo usar na geração
--                      ('ata_1_ano' | 'ata_2_ano' | 'ata_3_ano' |
--                      'ata_classificacao_geral' | null para
--                      comissões que não geram Ata via este
--                      gerador, ex: só uma comissão administrativa
--                      qualquer). Null não quebra nada — o campo é
--                      opcional.
--   corpo_narrativo    o parágrafo (ou parágrafos) que narra os
--                      fatos daquele período (início do curso,
--                      matrícula, desligamentos ocorridos NAQUELE
--                      período, encerramento) — texto jurídico
--                      específico de cada turma/período que precisa
--                      ser redigido por quem conhece os fatos
--                      (comandante/secretaria), não adivinhado pelo
--                      sistema. O gerador entra com o cabeçalho
--                      institucional, a lista de classificação (essa
--                      sim 100% automática, cruzando notas +
--                      desligamentos) e o bloco de assinaturas —
--                      só o meio (a narrativa) é digitado uma vez
--                      aqui e reaproveitado sempre que o Word for
--                      gerado/regenerado.
-- ============================================================

-- turma_titulo_ata: linha que aparece logo abaixo do título da Ata no
-- documento gerado (ex: "TURMA ALENCASTRO – 25.2300.1") — esse "código da
-- turma" não existe em nenhuma outra tabela hoje, então fica aqui, digitado
-- uma vez por comissão (mesmo padrão já usado em "referente_a").
alter table public.comissoes_encerramento
  add column if not exists tipo_ata text
    check (tipo_ata is null or tipo_ata in ('ata_1_ano', 'ata_2_ano', 'ata_3_ano', 'ata_classificacao_geral')),
  add column if not exists corpo_narrativo text,
  add column if not exists turma_titulo_ata text;
