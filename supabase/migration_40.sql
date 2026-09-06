-- ============================================================
-- Remove a tabela legada `configuracoes_turma` (singleton, id=1),
-- substituída pela tabela `turmas` desde a migration_3 (suporte a
-- múltiplas turmas). Confirmado que nenhum código do app (`src/` nem
-- `supabase/functions/`) referencia essa tabela hoje — o único uso
-- histórico dela foi na própria migration_3, um script de migração de
-- dados que já rodou uma vez e nunca mais toca nela de novo (a guarda
-- "if not exists (select 1 from public.turmas limit 1)" garante isso
-- mesmo que o arquivo antigo seja executado de novo por engano).
--
-- Ponto de atenção de segurança que motivou essa limpeza: a policy de
-- escrita dessa tabela usava is_admin() global (não pode_configurar_turma
-- por turma), então qualquer 'admin' de qualquer turma ainda conseguia
-- escrever nela via API direta — órfã, mas destoando do resto do
-- modelo de permissão por turma. Mais simples remover do que corrigir
-- uma tabela sem uso.
-- ============================================================
drop table if exists public.configuracoes_turma;

-- Tira a tabela da lista do vigia automático (autocorrigir_rls) — sem
-- isso ele continuaria tentando checar uma tabela que não existe mais
-- (inofensivo — ele só pula em silêncio — mas fica mais limpo).
create or replace function public.autocorrigir_rls()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  tabelas_protegidas text[] := array[
    'profiles', 'notas_cfo1', 'notas_cfo2', 'notas_cfo3',
    'turmas', 'desligamentos',
    'comissoes_encerramento', 'membros_comissao', 'classificacao_final',
    'auditoria'
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

-- confere: a tabela sumiu e a função foi recriada sem ela na lista
select
  not exists (select 1 from pg_tables where schemaname = 'public' and tablename = 'configuracoes_turma') as tabela_removida,
  (select prosrc from pg_proc where proname = 'autocorrigir_rls') not ilike '%configuracoes_turma%' as lista_atualizada;
