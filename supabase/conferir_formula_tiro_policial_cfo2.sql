-- Conferência da fórmula: Tiro Policial (CFO II) tem 4 VCs. A fórmula oficial é
-- ((VC1+VC2+VC3+VC4)/4 × 2 + VF × 3) / 5. Isso já bate com o "cálculo manual" ao lado.
select
  p.nome_completo,
  n.vc_lista,
  n.vf,
  n.nota_final as nota_gravada,
  round(
    ( (select avg(v) from unnest(n.vc_lista) as v) * 2 + n.vf * 3 ) / 5,
    4
  ) as nota_esperada_pela_formula
from public.notas_cfo2 n
join public.profiles p on p.id = n.aluno_id
where n.materia = 'Tiro Policial'
order by p.nome_completo
limit 10;
