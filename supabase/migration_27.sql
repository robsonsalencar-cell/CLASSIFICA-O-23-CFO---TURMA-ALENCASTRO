-- ============================================================
-- MIGRAÇÃO 27 — Vigia automático de RLS (auto-correção).
--
-- CONTEXTO: em 29/08/2026 e de novo em 01/09/2026, a tabela profiles
-- (dados pessoais sensíveis: CPF, RG, telefone, endereço, notas)
-- apareceu com RLS desativado, sem ninguém do time humano ter feito
-- isso conscientemente (confirmado: só 1 membro no projeto Supabase).
-- Suspeita mais provável: outra sessão de IA (Claude Code) que
-- trabalha nesse mesmo projeto, usando as credenciais do próprio
-- usuário, desligando RLS pra algum teste/depuração e esquecendo de
-- religar.
--
-- Como não é possível bloquear esse comando de forma dura no plano
-- atual do Supabase (criar EVENT TRIGGER exige superusuário, que nem
-- o dono do projeto tem num banco gerenciado), a defesa aqui é
-- "self-healing": uma checagem automática, a cada 5 minutos, que
-- RELIGA sozinha o RLS de qualquer tabela sensível que for encontrada
-- desligada, e registra isso na tabela de auditoria (visível na tela
-- Auditoria) — assim o problema dura no máximo alguns minutos, em vez
-- de ficar exposto até alguém notar manualmente.
-- ============================================================

create extension if not exists pg_cron with schema extensions;

-- Tabelas com dados sensíveis que NUNCA devem ficar sem RLS.
create or replace function public.autocorrigir_rls()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  tabelas_protegidas text[] := array[
    'profiles', 'notas_cfo1', 'notas_cfo2', 'notas_cfo3',
    'turmas', 'configuracoes_turma', 'desligamentos',
    'comissoes_encerramento', 'membros_comissao', 'classificacao_final'
  ];
  t text;
  estava_desligado boolean;
begin
  foreach t in array tabelas_protegidas loop
    select not rowsecurity into estava_desligado
    from pg_tables
    where schemaname = 'public' and tablename = t;

    if estava_desligado then
      execute format('alter table public.%I enable row level security', t);

      insert into public.auditoria (tabela, operacao, ator_nome, dados_novos)
      values (
        t,
        'RLS_AUTO_CORRIGIDO',
        'vigia automático (autocorrigir_rls)',
        jsonb_build_object(
          'mensagem', 'RLS foi encontrado desativado e foi reativado automaticamente',
          'quando', now()
        )
      );
    end if;
  end loop;
end;
$$;

-- Roda a cada 5 minutos. Se já existir um agendamento com esse nome
-- (reexecução desta migração), remove antes de recriar.
select cron.unschedule(jobid) from cron.job where jobname = 'vigia-rls' ;
select cron.schedule('vigia-rls', '*/5 * * * *', 'select public.autocorrigir_rls();');
