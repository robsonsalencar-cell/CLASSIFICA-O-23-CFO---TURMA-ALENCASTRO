-- 1) Quantas turmas existem?
select id, nome_turma, created_at from public.turmas order by created_at;

-- 2) Quantos perfis existem por turma_id (inclui NULL se algum não foi migrado)
select turma_id, count(*) as total, role
from public.profiles
group by turma_id, role
order by turma_id;

-- 3) O perfil do Robson especificamente
select id, nome_completo, email, role, turma_id
from public.profiles
where email = 'robsonsalencar@gmail.com';
