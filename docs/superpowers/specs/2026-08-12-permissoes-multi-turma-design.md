# Modelo de Permissões Multi-Turma Institucional

Data: 2026-08-12

## Contexto

O painel foi construído em torno de uma única turma (23º CFO) e ganhou suporte a múltiplas
turmas na Fase 1/2 (Boletim e Histórico Escolar) — mas o modelo de permissões **ainda não
acompanhou isso**: hoje `role = 'admin'` dá poder total sobre **todas** as turmas (`is_admin()`
não olha `turma_id`), e só existem 2 contas não-aluno no sistema: **Roni** (`role = 'admin'`,
funcionário fixo da APMCV) e **Robson** (`role = 'desenvolvedor'`, dono/desenvolvedor do app).

O objetivo declarado é o app virar ferramenta permanente da Academia: a cada nova turma
(24º, 25º, 26º...), pessoas da própria turma assumem a administração dos dados dela — e
quando essa turma se forma, seus dados precisam ficar **protegidos/imutáveis** (só o
desenvolvedor mexe, com uma exceção pontual autorizável), garantindo que uma auditoria futura
encontre os dados intactos.

## Descobertas importantes durante a análise

- **`profiles_select_own_or_admin` hoje vaza dados entre turmas**: como `is_admin()` é global,
  qualquer admin de qualquer turma pode ler o perfil completo (CPF, RG, filiação, endereço...)
  de alunos de **qualquer outra turma**. Isso precisa ser corrigido como parte desta mudança —
  não é só sobre notas.
- **`estatisticas_modulo`/`estatisticas_classificacao_geral` já são `SECURITY DEFINER` e já
  aceitam `p_turma_id`** — ou seja, já dá pra pedir os agregados (média da turma, desvio
  padrão, maior/menor média) de **qualquer** turma, sem vazar linha por aluno. O resumo
  cross-turma pedido no item 1 aproveita isso quase pronto — só falta uma função nova para a
  lista "nome + média final" do Ranking Completo (que hoje só existe via `notas_cfoN`,
  protegida por RLS linha-a-linha).
- **`classificacao_final` continua sem uso** (achado já registrado na spec do Histórico
  Escolar) — as policies dela serão atualizadas só por consistência, não porque algo dependa
  disso.
- A tabela `auditoria` já tem trigger em `notas_cfo1/2/3` e `turmas`, mas **não em `profiles`**
  — dado que RG, filiação, matrícula-academia etc. agora moram lá e importam para o Histórico
  Escolar (documento oficial), faz sentido estender o trigger para `profiles` como parte desta
  mudança.

## Decisões confirmadas com o usuário

- Resumo da Classificação Geral entre turmas (Indicadores Gerais, Média da Turma por Módulo,
  Ranking Completo com nome + Média Final) é **sempre visível entre turmas diferentes**,
  independente do toggle `ranking_publico` (que continua controlando só a visão dos alunos da
  própria turma sobre os detalhes completos dela). **Sem clique no aluno pra abrir detalhe e
  sem nenhum botão de exportação** nessa visão cross-turma.
- Uma vez que uma turma é marcada **finalizada**, ninguém mexe mais nela (nem o admin oficial
  dela, nem o admin institucional) — só o desenvolvedor, ou quem o desenvolvedor autorizar
  pontualmente. Regra **geral**, vale para qualquer turma finalizada (23º CFO é só a primeira,
  não um caso único).
- Quem pode marcar uma turma como finalizada: **desenvolvedor ou o admin institucional**.
- Quem pode autorizar o admin institucional a mexer numa turma já finalizada: **só o
  desenvolvedor**.
- O admin que cria/configura uma turma nova (ex: admin da 24º criando a 25º) só tem esse poder
  **enquanto a turma não tem admin oficial nomeado** — assim que o admin oficial da nova turma
  assume, o criador perde acesso de edição às notas dela (vira só leitura do resumo público,
  igual qualquer outra turma). Essa dinâmica se repete em cada nova turma (24→25→26→...), sem
  precisar de nada especial a cada vez.
- O admin institucional (Roni) precisa de um jeito de **transferir sua função** para outro
  administrador da unidade, prevendo que ele saia da Academia um dia.

## Fora de escopo

- Trocar a estrutura de `profiles.turma_id` (continua 1 turma por pessoa — sem multi-turma por
  usuário).
- Qualquer mudança em fórmula de nota, ranking ou nos geradores de Boletim/Histórico.
- Interface de "solicitar auditoria" ou exportação do log de `auditoria` — só garantir que os
  dados fiquem íntegros e que o log continue sendo gravado; consultar a auditoria continua
  sendo via SQL direto pelo desenvolvedor, como já é hoje.
- Finalização automática (por enquanto é sempre uma decisão manual de alguém com o papel certo).
- `profiles_update_own` (usuário editando o próprio nome, trocando a própria senha) continua
  sem restrição por `finalizada` — é autoatendimento básico, não risco de auditoria.

## Design

### 1. Novo papel: `admin_institucional`

```sql
alter type public.app_role add value 'admin_institucional';
```

Passa a existir: `aluno`, `admin` (escopado à própria turma), `admin_institucional` (Roni —
cross-turma, mas travado por turma finalizada), `desenvolvedor` (sem limite nenhum).

Migração de dado: a conta do Roni (`oliveira.natrilha@gmail.com`, hoje `role = 'admin'`) vira
`role = 'admin_institucional'` como parte da migração.

### 2. Campos novos em `turmas`

```sql
alter table public.turmas
  add column if not exists finalizada boolean not null default false,
  add column if not exists autorizacao_institucional boolean not null default false;
```

`autorizacao_institucional` só tem efeito quando `finalizada = true` — é a permissão pontual
que o desenvolvedor liga pro admin institucional poder mexer numa turma já encerrada.

### 3. Três funções centrais (substituem `is_admin()` nos lugares certos)

```sql
-- Só pra criar uma turma nova (não editar uma existente) — qualquer papel de gestão serve.
create or replace function public.is_algum_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'admin_institucional', 'desenvolvedor')
  );
$$;

-- Edição de NOTAS/classificação — nunca tem janela de bootstrap. Só o dono oficial da turma
-- (ou institucional/dev, respeitando finalização).
create or replace function public.pode_editar_turma(p_turma_id uuid)
returns boolean language plpgsql security definer set search_path = public stable as $$
declare
  v_role public.app_role;
  v_minha_turma uuid;
  v_finalizada boolean;
  v_autorizada boolean;
begin
  select role, turma_id into v_role, v_minha_turma from public.profiles where id = auth.uid();
  if v_role = 'desenvolvedor' then return true; end if;

  select finalizada, autorizacao_institucional into v_finalizada, v_autorizada
  from public.turmas where id = p_turma_id;

  if v_role = 'admin_institucional' then
    return (not v_finalizada) or v_autorizada;
  end if;

  if v_role = 'admin' then
    return v_minha_turma = p_turma_id and not v_finalizada;
  end if;

  return false;
end;
$$;

-- Configuração (perfis, matrícula, papel, dados da turma) — tem janela de bootstrap: qualquer
-- admin pode configurar uma turma que AINDA não tem admin oficial nomeado.
create or replace function public.pode_configurar_turma(p_turma_id uuid)
returns boolean language plpgsql security definer set search_path = public stable as $$
declare
  v_tem_admin_oficial boolean;
begin
  if public.pode_editar_turma(p_turma_id) then return true; end if;

  select exists (
    select 1 from public.profiles where turma_id = p_turma_id and role = 'admin'
  ) into v_tem_admin_oficial;

  return (
    not v_tem_admin_oficial
    and exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'admin_institucional', 'desenvolvedor'))
  );
end;
$$;
```

`pode_configurar_turma` é estritamente mais permissiva que `pode_editar_turma` (tudo que passa
na segunda passa na primeira) — a diferença é só a janela de bootstrap.

### 4. Onde cada função entra

| Tabela / policy | Função antiga | Função nova |
|---|---|---|
| `profiles_select_own_or_admin` | `is_admin()` | `id = auth.uid() or pode_configurar_turma(turma_id)` — resolve o vazamento entre turmas |
| `profiles_admin_write` | `is_admin()` | `pode_configurar_turma(turma_id)` (cadastro/edição de aluno, nomear admin) |
| `notas_cfo1/2/3_admin_write` (×3) | `is_admin()` | `pode_editar_turma((select turma_id from profiles where id = aluno_id))` |
| `notas_cfo1/2/3_select` (×3) | `... or is_admin()` | `... or pode_configurar_turma((select turma_id from profiles where id = aluno_id))` (leitura segue a mesma regra frouxa de configuração — só a escrita de nota é estrita) |
| `classificacao_admin_write`/`_select` | `is_admin()` | mesmo padrão de `notas_cfoN` (tabela sem uso hoje — ajustada só por consistência) |
| `turmas_admin_write` (UPDATE) | `is_admin()` | `pode_configurar_turma(id)` |
| Criação de turma nova (INSERT) | `is_admin()` | `is_algum_admin()` |
| `brasoes_admin_*` (storage) | `is_admin()` | `is_algum_admin()` — imagem de brasão não é dado sensível nem afeta auditoria; manter simples é deliberado (não vale a complexidade de extrair o `turma_id` do nome do arquivo) |
| `auditoria_select_dev` | (já é só `desenvolvedor`) | sem mudança |

`is_admin()` deixa de ser usado — mantida no schema só se algo mais depender dela (checar antes
de remover).

**Correção importante**: `turmas_admin_write` usando `pode_configurar_turma(id)` deixaria
qualquer admin em janela de bootstrap (ou o admin oficial da própria turma) mudar
`finalizada`/`autorizacao_institucional` direto via `update` na tabela — furando as regras da
seção 5, que dizem quem pode mudar cada uma. Essas duas colunas precisam ficar protegidas por
um gatilho `BEFORE UPDATE` que rejeita qualquer mudança nelas fora das duas funções da seção 5
(que sinalizam a exceção via `set_config` antes do `update` interno). Toda mudança de
`finalizada`/`autorizacao_institucional` passa a acontecer **só** por `finalizar_turma()`/
`autorizar_admin_institucional()` — nunca por `update` direto na tabela, mesmo que a RLS deixe
passar.

### 5. RPCs de ação (SECURITY DEFINER, cada uma checando o papel de quem chama)

```sql
create or replace function public.finalizar_turma(p_turma_id uuid, p_finalizada boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin_institucional', 'desenvolvedor')
  ) then
    raise exception 'Só o admin institucional ou o desenvolvedor podem finalizar uma turma.';
  end if;
  update public.turmas set finalizada = p_finalizada where id = p_turma_id;
end;
$$;

create or replace function public.autorizar_admin_institucional(p_turma_id uuid, p_valor boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'desenvolvedor') then
    raise exception 'Só o desenvolvedor pode autorizar edição numa turma finalizada.';
  end if;
  update public.turmas set autorizacao_institucional = p_valor where id = p_turma_id;
end;
$$;

-- Roni chama isso passando o id de quem vai assumir. Ele mesmo volta a ser 'admin' depois
-- (deixa de acumular o papel institucional). Se quem chama já é desenvolvedor, não se
-- rebaixa — só promove o novo institucional.
create or replace function public.transferir_admin_institucional(p_novo_admin_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role not in ('admin_institucional', 'desenvolvedor') then
    raise exception 'Só o admin institucional atual ou o desenvolvedor podem transferir essa função.';
  end if;

  update public.profiles set role = 'admin_institucional' where id = p_novo_admin_id;

  if v_role = 'admin_institucional' then
    update public.profiles set role = 'admin' where id = auth.uid();
  end if;
end;
$$;

grant execute on function public.finalizar_turma(uuid, boolean) to authenticated;
grant execute on function public.autorizar_admin_institucional(uuid, boolean) to authenticated;
grant execute on function public.transferir_admin_institucional(uuid) to authenticated;
```

### 6. Resumo cross-turma (só leitura, sem exportar)

Nova função, no mesmo padrão de `estatisticas_classificacao_geral`:

```sql
create or replace function public.ranking_turma(p_turma_id uuid)
returns table (nome text, media_final numeric)
language sql security definer set search_path = public stable as $$
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
  group by p.nome_completo
  having count(*) = 3; -- só entra quem tem os 3 módulos, igual à Classificação Geral normal
$$;

grant execute on function public.ranking_turma(uuid) to authenticated;
```

Combinado com `estatisticas_classificacao_geral(p_turma_id => X)` e as 3 chamadas de
`estatisticas_modulo(p_tabela => ..., p_turma_id => X)` (já existentes, já com `grant execute
to authenticated`), dá pra montar as 3 seções pedidas (Indicadores Gerais, Média por Módulo,
Ranking com nome + Média Final) de qualquer turma, sem tocar em nenhuma policy de leitura linha
a linha.

**UI**: na tela Classificação Geral, um seletor "Ver resumo de: [minha turma ▾]" lista as
outras turmas (via `turmas_select_todos`, que já é público). Ao trocar, a tela troca pro modo
resumo: sem clique no aluno (não abre `StudentDetailsModal`), sem nenhum botão de exportação —
só os 3 blocos com os números agregados.

### 7. UI de administração

- **Personalização**: novo card "Ciclo de vida da turma" — visível pra `admin_institucional`/
  `desenvolvedor`. Toggle "Turma finalizada" (chama `finalizar_turma`). Campo extra
  "Autorizar admin institucional a editar mesmo finalizada" **só aparece pro
  desenvolvedor** (chama `autorizar_admin_institucional`).
- **Botão "Transferir função institucional"**: visível só pra quem é `admin_institucional` (ou
  `desenvolvedor`, pra poder nomear o primeiro/substituto em qualquer situação) — abre um
  seletor de aluno/admin existente e chama `transferir_admin_institucional`.
- Nomear o admin oficial de uma turma nova continua sendo o fluxo que já existe (trocar o
  `role` de um usuário pra `admin` em "Gerenciar Usuários") — sem UI nova, só passa a ser
  controlado por `pode_configurar_turma` (janela de bootstrap) em vez de `is_admin()` global.

### 8. Auditoria estendida a `profiles`

```sql
create trigger trg_auditoria_profiles after insert or update or delete on public.profiles
  for each row execute function public.fn_registrar_auditoria();
```

Mesma função que já audita `notas_cfoN`/`turmas` — sem mudança nela, só mais uma tabela coberta.

## Testes

Sem suíte automatizada no projeto — verificação manual:

1. Logado como admin da 24º CFO (turma-scoped), confirmar que **não** consegue mais ver/editar
   perfis ou notas de alunos do 23º CFO.
2. Criar a turma "25º CFO" logado como admin da 24º, cadastrar 1 aluno nela, promovê-lo a
   `admin` — confirmar que o admin da 24º **perde** a capacidade de editar notas da 25º assim
   que esse novo admin existe, mas continua vendo o resumo público dela.
3. Logado como o novo admin oficial da 25º, confirmar que ele **consegue** editar notas da
   própria turma.
4. Como desenvolvedor, marcar 23º CFO como `finalizada`. Confirmar que nem o Roni
   (`admin_institucional`) nem nenhum admin conseguem mais editar nada nela.
5. Como desenvolvedor, ligar `autorizacao_institucional` pra 23º CFO — confirmar que o Roni
   volta a conseguir editar. Desligar de novo e confirmar que perde o acesso.
6. Chamar `transferir_admin_institucional` como Roni pra outra conta — confirmar que a conta
   nova vira `admin_institucional` e o Roni vira `admin` comum.
7. Como aluno de qualquer turma, abrir Classificação Geral, trocar o seletor pra outra turma —
   confirmar que aparecem só os 3 blocos agregados, sem clique no aluno e sem botão de exportar.
8. Confirmar que editar um perfil (ex: corrigir CPF) gera linha nova em `auditoria`.
