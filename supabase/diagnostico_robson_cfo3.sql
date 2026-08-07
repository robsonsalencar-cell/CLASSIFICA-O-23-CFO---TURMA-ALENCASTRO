-- Matérias que o Robson JÁ TEM lançadas no CFO III
select n.materia, n.nota_final
from public.notas_cfo3 n
join public.profiles p on p.id = n.aluno_id
where p.nome_completo ilike '%robson%alencar%'
order by n.materia;
