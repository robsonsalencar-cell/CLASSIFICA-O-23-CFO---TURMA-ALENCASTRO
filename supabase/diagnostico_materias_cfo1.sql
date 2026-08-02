-- Lista os nomes de matéria REALMENTE gravados no banco para o CFO I,
-- para comparar com a lista oficial e achar divergências de grafia.
select distinct materia, count(*) as qtd_alunos
from public.notas_cfo1
group by materia
order by materia;
