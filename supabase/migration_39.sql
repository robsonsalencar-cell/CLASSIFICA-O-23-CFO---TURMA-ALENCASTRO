-- ============================================================
-- Corrige corrida em "atribuir número de registro do Histórico":
-- a versão anterior lia o "próximo número" do estado React em memória
-- (turmas.proximo_numero_registro_historico), que só era atualizado
-- DEPOIS de terminar a chamada anterior (round-trip de rede). Gerar o
-- Histórico de dois alunos em sequência rápida (antes desse refresh
-- terminar) podia gravar o MESMO número nos dois.
--
-- Esta função faz tudo isso numa única transação no banco, com
-- "select ... for update" travando a linha da turma: uma segunda
-- chamada concorrente espera a primeira terminar antes de ler o
-- "próximo número", então nunca mais lê o mesmo valor duas vezes.
--
-- Hoje esse número não aparece em nenhum documento gerado (foi
-- substituído pela matrícula na exibição — ver exportHistorico.ts), só
-- fica gravado em profiles.numero_registro_historico; a correção é
-- por precaução, caso o campo volte a ser usado no futuro.
-- ============================================================
create or replace function public.atribuir_numero_registro_historico(p_aluno_id uuid, p_turma_id uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_numero_existente integer;
  v_proximo integer;
begin
  if p_aluno_id is null or p_turma_id is null then
    raise exception 'aluno e turma são obrigatórios.';
  end if;

  if not public.pode_configurar_turma(p_turma_id) then
    raise exception 'Sem permissão para atribuir número de registro nesta turma.';
  end if;

  select numero_registro_historico into v_numero_existente
  from public.profiles where id = p_aluno_id;

  -- Já tinha número atribuído antes — devolve o mesmo, não gera outro.
  if v_numero_existente is not null then
    return v_numero_existente;
  end if;

  -- Trava a linha da turma até o fim desta transação: uma segunda
  -- chamada concorrente (outro aluno, gerado quase ao mesmo tempo) fica
  -- esperando aqui até esta terminar, em vez de ler o mesmo "próximo
  -- número" em paralelo.
  select proximo_numero_registro_historico into v_proximo
  from public.turmas where id = p_turma_id
  for update;

  update public.profiles set numero_registro_historico = v_proximo where id = p_aluno_id;
  update public.turmas set proximo_numero_registro_historico = v_proximo + 1 where id = p_turma_id;

  return v_proximo;
end;
$$;

grant execute on function public.atribuir_numero_registro_historico(uuid, uuid) to authenticated;

-- confere: a função foi criada
select exists (
  select 1 from pg_proc where proname = 'atribuir_numero_registro_historico'
) as funcao_criada;
