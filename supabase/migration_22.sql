-- ============================================================
-- MIGRAÇÃO 22 — Matrícula didática de aluno sem conta + correção dos
-- 10 números deslocados pela inclusão da Lavínia.
--
-- CONTEXTO: o total real de matriculados no início do curso foi 30
-- (confirmado pelo usuário em 29/08/2026), não 28. Como a Al Of PM
-- Lavínia Diniz Siqueira nunca teve conta no app, o gerador de
-- matrícula didática nunca reservou o lugar dela na ordem alfabética
-- — os 28 alunos com conta receberam números 1-28 "compactados", sem
-- espaço pra ela. Ordem alfabética correta dos 30 nomes coloca a
-- Lavínia na posição 20 (entre "Lauriane Simonini" e "Lucas Carvalho
-- Silva"), empurrando os 10 alunos de Lucas a Wender uma posição pra
-- frente.
-- ============================================================

-- Coluna pra guardar a matrícula didática de quem não tem conta no
-- sistema (ex: Lavínia) — mesmo padrão de aluno_nome_manual.
alter table public.desligamentos
  add column matricula_academia_manual text;

-- Matrícula da Lavínia (posição 20 de 30)
update public.desligamentos
set matricula_academia_manual = '2025.2320.1'
where aluno_nome_manual ilike '%Lavínia Diniz Siqueira%';

-- Corrige os 10 alunos deslocados (todos +1 posição a partir de "Lucas")
update public.profiles set matricula_academia = '2025.2321.1' where nome_completo ilike '%Lucas Carvalho Silva%';
update public.profiles set matricula_academia = '2025.2322.1' where nome_completo ilike '%Luiz Henrique Ackermann%';
update public.profiles set matricula_academia = '2025.2323.1' where nome_completo ilike '%Moyses Ferreira de Carvalho%';
update public.profiles set matricula_academia = '2025.2324.1' where nome_completo ilike '%Odezio Borge de Carvalho%';
update public.profiles set matricula_academia = '2025.2325.1' where nome_completo ilike '%Petrus Andrey Guimarães Garcia%' or nome_completo ilike '%Petrus Andrey Guimaraes Garcia%';
update public.profiles set matricula_academia = '2025.2326.1' where nome_completo ilike '%Publio Ferreira Moreno%';
update public.profiles set matricula_academia = '2025.2327.1' where nome_completo ilike '%Raphael Rocha Xavier%';
update public.profiles set matricula_academia = '2025.2328.1' where nome_completo ilike '%Robson dos Santos Alencar%';
update public.profiles set matricula_academia = '2025.2329.1' where nome_completo ilike '%Vinicius Antônio Oliveira da Silva%' or nome_completo ilike '%Vinicius Antonio Oliveira da Silva%';
update public.profiles set matricula_academia = '2025.2330.1' where nome_completo ilike '%Wender da Silva Figueiredo%';
