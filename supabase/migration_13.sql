-- ============================================================
-- MIGRAÇÃO 13 — Campos novos para o Boletim Escolar (Fase 1 da
-- emissão de relatórios): matrícula do aluno, ano letivo e
-- responsável pela assinatura por turma, e verificação de 2ª
-- época por matéria. Nenhum desses campos entra em nenhum
-- cálculo de nota_final/ranking/média — são só de exibição no
-- documento exportado.
-- ============================================================

alter table public.profiles
  add column if not exists matricula text;

alter table public.turmas
  add column if not exists ano_letivo_cfo1 text,
  add column if not exists ano_letivo_cfo2 text,
  add column if not exists ano_letivo_cfo3 text,
  add column if not exists responsavel_assinatura_nome text
    not null default 'Matheus Vitor Xavier Moraes Pereira',
  add column if not exists responsavel_assinatura_posto text
    not null default '2º Ten PM',
  add column if not exists responsavel_assinatura_funcao text
    not null default 'Gerente Subalterno da Secretaria de Registros Acadêmicos';

alter table public.notas_cfo1
  add column if not exists verif_2a_epoca numeric,
  add column if not exists media_2a_epoca numeric;
alter table public.notas_cfo2
  add column if not exists verif_2a_epoca numeric,
  add column if not exists media_2a_epoca numeric;
alter table public.notas_cfo3
  add column if not exists verif_2a_epoca numeric,
  add column if not exists media_2a_epoca numeric;
