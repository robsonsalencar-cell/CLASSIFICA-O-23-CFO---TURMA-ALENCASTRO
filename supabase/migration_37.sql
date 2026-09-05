-- ============================================================
-- Corrige ranking_turma(): agrupava por p.nome_completo em vez de
-- p.id (a chave real do aluno). Dois alunos com o MESMO nome completo
-- na mesma turma teriam suas médias por módulo somadas/misturadas numa
-- única linha do ranking (bug de dado incorreto, não só cosmético).
--
-- Essa função alimenta a tela "Ver resumo de outra turma" (Classificação
-- Geral) e não é usada nos documentos oficiais (Ata/Diploma usam
-- src/utils/rankingParaAta.ts, que já agrupa por aluno_id corretamente)
-- — mas ainda assim é um dado errado exibido em tela sempre que houver
-- nomes duplicados na turma.
-- ============================================================
create or replace function public.ranking_turma(p_turma_id uuid)
returns table (nome text, media_final numeric)
language plpgsql security definer set search_path = public stable
as $$
begin
  if p_turma_id is null then
    raise exception 'p_turma_id é obrigatório.';
  end if;

  if not (
    public.pode_editar_turma(p_turma_id)
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'visitante')
    or exists (
      select 1 from public.profiles pr
      join public.turmas t on t.id = pr.turma_id
      where pr.id = auth.uid() and pr.turma_id = p_turma_id
        and pr.role = 'aluno' and t.ranking_publico = true
    )
  ) then
    raise exception 'Sem permissão para ver o ranking desta turma.';
  end if;

  return query
  select p.nome_completo, avg(m.media) as media_final
  from (
    select aluno_id, avg(nota_final) as media from public.notas_cfo1 group by aluno_id
    union all
    select aluno_id, avg(nota_final) as media from public.notas_cfo2 group by aluno_id
    union all
    select aluno_id, avg(nota_final) as media from public.notas_cfo3 group by aluno_id
  ) m
  join public.profiles p on p.id = m.aluno_id
  where p.turma_id = p_turma_id
  -- CORRIGIDO: agrupar por p.id (chave real do aluno) em vez de só
  -- p.nome_completo — p.nome_completo continua na lista só porque o
  -- Postgres exige que toda coluna não-agregada do SELECT apareça no
  -- GROUP BY.
  group by p.id, p.nome_completo
  having count(*) = 3;
end;
$$;

grant execute on function public.ranking_turma(uuid) to authenticated;

-- confere: a função foi recriada agora
select proname, prosrc ilike '%group by p.id, p.nome_completo%' as corrigida
from pg_proc
where proname = 'ranking_turma';
