-- ============================================================
-- RECALCULA todas as notas finais que têm VC + VF (nos 3 módulos), usando a
-- fórmula oficial: (médiaVC × 2 + VF × 3) / 5.
--
-- Não mexe em:
-- - Linhas só com VF (sem VC) ou só com VC (sem VF) — já estão certas.
-- - "Direito Administrativo Disciplinar Militar I" no CFO I — essa usa a
--   regra especial de SOMA (não média), já corrigida antes; recalculada
--   separadamente aqui com a fórmula certa dela.
-- ============================================================

-- CFO I (exceto Direito Administrativo Disciplinar Militar I, que usa soma)
update public.notas_cfo1
set nota_final = round(
  ( (select avg(v) from unnest(vc_lista) as v) * 2 + vf * 3 ) / 5, 4
)
where array_length(vc_lista, 1) > 0
  and vf is not null
  and materia <> 'Direito Administrativo Disciplinar Militar I';

-- Direito Administrativo Disciplinar Militar I (regra especial: soma, não média)
update public.notas_cfo1
set nota_final = round(
  ( (select sum(v) from unnest(vc_lista) as v) * 2 + vf * 3 ) / 5, 4
)
where materia = 'Direito Administrativo Disciplinar Militar I'
  and array_length(vc_lista, 1) > 0
  and vf is not null;

-- CFO II (todas as matérias — regra padrão de média)
update public.notas_cfo2
set nota_final = round(
  ( (select avg(v) from unnest(vc_lista) as v) * 2 + vf * 3 ) / 5, 4
)
where array_length(vc_lista, 1) > 0
  and vf is not null;

-- CFO III (todas as matérias — regra padrão de média)
update public.notas_cfo3
set nota_final = round(
  ( (select avg(v) from unnest(vc_lista) as v) * 2 + vf * 3 ) / 5, 4
)
where array_length(vc_lista, 1) > 0
  and vf is not null;

-- Confere o Tiro Policial do CFO II de novo (deve bater 100% agora)
select p.nome_completo, n.vc_lista, n.vf, n.nota_final
from public.notas_cfo2 n
join public.profiles p on p.id = n.aluno_id
where n.materia = 'Tiro Policial'
order by p.nome_completo limit 10;
