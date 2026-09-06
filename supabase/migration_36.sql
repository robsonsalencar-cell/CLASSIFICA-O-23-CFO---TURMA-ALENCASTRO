-- ============================================================
-- Fecha brecha: campos de TCC (tema/orientador/data de apresentação),
-- adicionados na migration_34, não estavam protegidos pelo trigger
-- proteger_campos_sensiveis_profile() (última versão: migration_32).
--
-- Como a policy "profiles_update_own" permite update irrestrito na
-- própria linha, e o trigger não incluía essas 3 colunas na lista de
-- campos revertidos quando o próprio dono edita o perfil, um aluno
-- autenticado podia gravar tema_tcc/orientador_tcc/data_apresentacao_tcc
-- falsos direto via API (PATCH /rest/v1/profiles?id=eq.<próprio-id>),
-- sem passar por nenhuma tela — e esses 3 campos vão direto pro Diploma
-- oficial (ver src/utils/exportDiploma.ts).
--
-- Esta migration só ACRESCENTA essas 3 colunas à lista já existente de
-- campos protegidos — mesma lógica, sem mudar nenhum outro comportamento.
-- ============================================================
create or replace function public.proteger_campos_sensiveis_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Chamadas via service_role (Edge Functions administrativas,
  -- ex: admin-update-user) ou direto no SQL Editor não passam por
  -- essa restrição.
  if auth.role() is distinct from 'authenticated' then
    return new;
  end if;

  -- Quem tem autoridade de admin sobre a turma do registro E está
  -- editando O PERFIL DE OUTRA PESSOA também não é restringido (ex:
  -- um admin editando o perfil de um aluno pela tela do app). A
  -- condição "new.id is distinct from auth.uid()" é o que faltava:
  -- sem ela, um 'admin'/'admin_institucional' editando A SI MESMO
  -- também caía nesta isenção (ele sempre tem autoridade sobre a
  -- própria turma), permitindo se auto-promover a
  -- 'desenvolvedor'/'admin_institucional' via chamada direta à API.
  if new.id is distinct from auth.uid()
     and public.pode_configurar_turma(coalesce(new.turma_id, old.turma_id)) then
    return new;
  end if;

  -- Sobrou: o próprio dono da linha editando o próprio perfil
  -- (com ou sem autoridade de admin) — protege os campos sensíveis.
  new.role := old.role;
  new.cpf := old.cpf;
  new.matricula := old.matricula;
  new.matricula_academia := old.matricula_academia;
  new.turma_id := old.turma_id;
  new.matriculado_cfo1 := old.matriculado_cfo1;
  new.matriculado_cfo2 := old.matriculado_cfo2;
  new.matriculado_cfo3 := old.matriculado_cfo3;
  new.rg_pm := old.rg_pm;
  new.rg := old.rg;
  new.nome_completo := old.nome_completo;
  new.email := old.email;
  -- NOVO (esta migration): campos de TCC usados no Diploma — mesma lógica
  -- de proteção dos demais campos administrativos/documentais.
  new.tema_tcc := old.tema_tcc;
  new.orientador_tcc := old.orientador_tcc;
  new.data_apresentacao_tcc := old.data_apresentacao_tcc;

  return new;
end;
$$;

-- confere: a função foi recriada agora (created/last_altered recente)
select proname, prosrc ilike '%tema_tcc%' as protege_tcc
from pg_proc
where proname = 'proteger_campos_sensiveis_profile';
