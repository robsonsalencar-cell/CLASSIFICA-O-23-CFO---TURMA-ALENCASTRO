-- ============================================================
-- Corrige "Direito Administrativo Disciplinar Militar I" (CFO I): a VC
-- deve ser SOMADA (não a média) antes de aplicar a fórmula (VC×2+VF×3)/5.
-- Só recalcula quem tem VC e VF preenchidos (senão o valor já está certo
-- como "só VF" ou "só VC").
-- ============================================================
update public.notas_cfo1
set nota_final = round(
  (
    (select sum(v) from unnest(vc_lista) as v) * 2 + vf * 3
  ) / 5,
  4
)
where materia = 'Direito Administrativo Disciplinar Militar I'
  and array_length(vc_lista, 1) > 0
  and vf is not null;

-- Confira o resultado (deve bater com 9.8000 para o Gernaian, por exemplo)
select p.nome_completo, n.vc_lista, n.vf, n.nota_final
from public.notas_cfo1 n
join public.profiles p on p.id = n.aluno_id
where n.materia = 'Direito Administrativo Disciplinar Militar I'
order by n.nota_final desc nulls last;
