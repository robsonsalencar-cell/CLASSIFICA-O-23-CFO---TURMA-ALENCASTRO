-- Todos os alunos da turma atual: nota 10 em "Gestão Pública por Resultados"
-- (exceto o Wender, que ficou com 9,5)
insert into public.notas_cfo3 (aluno_id, materia, vc_lista, vf, nota_final, updated_at)
select p.id, 'Gestão Pública por Resultados', '{}', null,
  case when p.nome_completo ilike '%wender%' then 9.5 else 10 end,
  now()
from public.profiles p
where p.role = 'aluno'
  and p.turma_id = (select id from public.turmas order by created_at asc limit 1)
  and p.matriculado_cfo3 = true
on conflict (aluno_id, materia) do update
  set nota_final = excluded.nota_final, updated_at = now();

-- Confere
select p.nome_completo, n.nota_final
from public.notas_cfo3 n
join public.profiles p on p.id = n.aluno_id
where n.materia = 'Gestão Pública por Resultados'
order by p.nome_completo;
