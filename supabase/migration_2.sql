-- ============================================================
-- MIGRAÇÃO 2 — rode isso no SQL Editor do Supabase (além do schema.sql
-- que você já rodou antes). Este arquivo só ADICIONA coisas novas —
-- não apaga nada do que já existe.
-- ============================================================

-- 1) MÚLTIPLAS NOTAS DE VC POR MATÉRIA
-- Até agora, cada matéria só aceitava 1 valor de VC. Na prática, algumas
-- matérias têm várias verificações contínuas (VC1, VC2, VC3...). Agora
-- guardamos uma LISTA de valores, e a nota final usa a média deles.
alter table public.notas_cfo1 add column if not exists vc_lista numeric[] default '{}';
alter table public.notas_cfo2 add column if not exists vc_lista numeric[] default '{}';
alter table public.notas_cfo3 add column if not exists vc_lista numeric[] default '{}';

-- migra o valor antigo de "vc" (singular) para dentro da lista, se existir
update public.notas_cfo1 set vc_lista = array[vc] where vc is not null and coalesce(array_length(vc_lista,1),0) = 0;
update public.notas_cfo2 set vc_lista = array[vc] where vc is not null and coalesce(array_length(vc_lista,1),0) = 0;
update public.notas_cfo3 set vc_lista = array[vc] where vc is not null and coalesce(array_length(vc_lista,1),0) = 0;

-- ============================================================
-- 2) PERSONALIZAÇÃO DA TURMA (nome + brasão exibidos no menu e nos cabeçalhos)
-- Uma linha só (id fixo = 1). O admin edita pelo painel; todo usuário
-- autenticado pode LER (para o cabeçalho aparecer para todo mundo).
-- ============================================================
create table if not exists public.configuracoes_turma (
  id int primary key default 1,
  nome_turma text not null default '23º CFO',
  subtitulo_turma text not null default 'Turma Alencastro',
  brasao_url text,
  updated_at timestamptz not null default now(),
  constraint configuracoes_turma_singleton check (id = 1)
);

insert into public.configuracoes_turma (id, nome_turma, subtitulo_turma, brasao_url)
values (1, '23º CFO', 'Turma Alencastro', '/lovable-uploads/brasao-novo.png')
on conflict (id) do nothing;

alter table public.configuracoes_turma enable row level security;

-- Leitura liberada até para visitantes não logados (a tela de login também
-- usa essa configuração para mostrar o brasão/nome personalizados)
create policy "configuracoes_select_todos" on public.configuracoes_turma
  for select using (true);

create policy "configuracoes_admin_write" on public.configuracoes_turma
  for all using (public.is_admin()) with check (public.is_admin());

-- Bucket de armazenamento para os brasões enviados pelo admin
insert into storage.buckets (id, name, public)
values ('brasoes', 'brasoes', true)
on conflict (id) do nothing;

create policy "brasoes_leitura_publica" on storage.objects
  for select using (bucket_id = 'brasoes');

create policy "brasoes_admin_insere" on storage.objects
  for insert with check (bucket_id = 'brasoes' and public.is_admin());

create policy "brasoes_admin_atualiza" on storage.objects
  for update using (bucket_id = 'brasoes' and public.is_admin());

create policy "brasoes_admin_apaga" on storage.objects
  for delete using (bucket_id = 'brasoes' and public.is_admin());
