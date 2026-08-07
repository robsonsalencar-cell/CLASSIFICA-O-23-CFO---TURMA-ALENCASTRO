-- Lança nota final 10 para TODOS os alunos DA TURMA ATUAL em:
-- "EPP – Estagio de Patrulhamento Tático" e "Controle e submissão" (CFO III)
insert into public.notas_cfo3 (aluno_id, materia, vc_lista, vf, nota_final, updated_at)
select p.id, 'EPP – Estagio de Patrulhamento Tático', '{}', null, 10, now()
from public.profiles p
where p.role = 'aluno'
  and p.turma_id = (select id from public.turmas order by created_at asc limit 1)
on conflict (aluno_id, materia) do update
  set nota_final = 10, updated_at = now();

insert into public.notas_cfo3 (aluno_id, materia, vc_lista, vf, nota_final, updated_at)
select p.id, 'Controle e submissão', '{}', null, 10, now()
from public.profiles p
where p.role = 'aluno'
  and p.turma_id = (select id from public.turmas order by created_at asc limit 1)
on conflict (aluno_id, materia) do update
  set nota_final = 10, updated_at = now();

-- Confere quantos alunos ficaram com nota 10 em cada uma
select materia, count(*) as qtd_alunos
from public.notas_cfo3
where materia in ('EPP – Estagio de Patrulhamento Tático', 'Controle e submissão')
group by materia;
