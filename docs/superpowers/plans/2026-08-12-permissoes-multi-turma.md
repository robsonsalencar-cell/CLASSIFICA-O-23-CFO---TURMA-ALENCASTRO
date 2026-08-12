# Permissões Multi-Turma Institucional — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Escopar todo poder de admin por turma (com uma janela de bootstrap pra criar/configurar
a turma seguinte), introduzir o papel `admin_institucional` (cross-turma, travado por turma
finalizada), travar turmas finalizadas contra qualquer edição exceto pelo desenvolvedor, e abrir
um resumo somente-leitura da Classificação Geral entre turmas diferentes.

**Architecture:** Toda a regra de permissão vive no Postgres (2 funções centrais +
`SECURITY DEFINER` RPCs de ação), reaproveitadas tanto pelas RLS policies quanto pelas duas Edge
Functions que hoje bypassam RLS (`admin-create-user`/`admin-update-user`, que usam o cliente
service_role). O front-end ganha um hook fino (`usePermissoesTurma`) que espelha a mesma lógica
só pra UX (esconder/desabilitar botão) — a autoridade real é sempre o banco.

**Tech Stack:** Postgres/Supabase (RLS, `SECURITY DEFINER` functions, trigger), Deno Edge
Functions, React + TypeScript.

## Global Constraints

- Nenhuma mudança em fórmula de nota, ranking ou nos geradores de Boletim/Histórico.
- `profiles_update_own` (usuário editando o próprio nome/senha) continua sem restrição por
  `finalizada`.
- Brasão (storage) continua gated só por "é algum tipo de admin" — não por turma específica
  (decisão deliberada da spec, imagem não é dado sensível).
- Toda função `SECURITY DEFINER` nova aceita um `p_usuario_id uuid default auth.uid()` — as RLS
  policies chamam sem esse argumento (usa `auth.uid()` do contexto); as Edge Functions (que
  usam o cliente `service_role`, sem sessão, então `auth.uid()` seria `null`) chamam passando o
  `caller.id` explicitamente.
- `finalizada`/`autorizacao_institucional` em `turmas` só mudam pelas funções
  `finalizar_turma()`/`autorizar_admin_institucional()` — nunca por `update` direto na tabela,
  mesmo que a RLS geral deixasse passar (gatilho dedicado, ver Task 1).
- Validação: `npx tsc --noEmit -p tsconfig.app.json` + `npx vite build` depois de cada task com
  mudança de código React.
- Migração SQL roda direto via Supabase CLI (acesso já autorizado nesta sessão).
- Mudança nas Edge Functions exige redeploy (`npx supabase functions deploy <nome>`).

---

### Task 1: Migração SQL — papel, colunas, funções centrais, RPCs e RLS

**Files:**
- Create: `supabase/migration_15.sql`

**Interfaces:**
- Produces: enum `admin_institucional`; `turmas.finalizada`, `turmas.autorizacao_institucional`;
  `public.is_algum_admin()`, `public.pode_editar_turma(p_turma_id uuid, p_usuario_id uuid default auth.uid())`,
  `public.pode_configurar_turma(p_turma_id uuid, p_usuario_id uuid default auth.uid())`;
  RPCs `finalizar_turma(p_turma_id, p_finalizada)`, `autorizar_admin_institucional(p_turma_id, p_valor)`,
  `transferir_admin_institucional(p_novo_admin_id)`, `ranking_turma(p_turma_id)`. Usadas por
  todas as tasks seguintes.

- [ ] **Step 1: Escrever a migração**

Criar `supabase/migration_15.sql`:

```sql
-- ============================================================
-- MIGRAÇÃO 15 — Permissões multi-turma institucional.
--
-- Antes: is_admin() dava poder GLOBAL (qualquer turma) pra quem tivesse
-- role 'admin'/'desenvolvedor'. Isso incluía um vazamento real: um admin
-- de qualquer turma conseguia ler o perfil completo (CPF, RG, filiação...)
-- de alunos de QUALQUER outra turma, via profiles_select_own_or_admin.
--
-- Depois desta migração:
--   - 'admin' fica escopado à própria turma (profiles.turma_id), exceto
--     numa janela de "bootstrap": qualquer admin pode configurar (cadastrar
--     aluno, nomear admin) uma turma nova que AINDA não tem admin oficial.
--     Editar NOTA nunca tem essa janela — só o admin oficial da turma.
--   - novo papel 'admin_institucional' (cross-turma), mas travado quando a
--     turma está finalizada, a não ser que o desenvolvedor autorize.
--   - 'desenvolvedor' continua sem limite nenhum.
-- ============================================================

alter type public.app_role add value if not exists 'admin_institucional';

alter table public.turmas
  add column if not exists finalizada boolean not null default false,
  add column if not exists autorizacao_institucional boolean not null default false;

-- ------------------------------------------------------------
-- Funções centrais
-- ------------------------------------------------------------

create or replace function public.is_algum_admin(p_usuario_id uuid default auth.uid())
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.profiles
    where id = p_usuario_id and role in ('admin', 'admin_institucional', 'desenvolvedor')
  );
$$;

-- Edição de NOTA/classificação — nunca tem janela de bootstrap.
create or replace function public.pode_editar_turma(p_turma_id uuid, p_usuario_id uuid default auth.uid())
returns boolean
language plpgsql security definer set search_path = public stable
as $$
declare
  v_role public.app_role;
  v_minha_turma uuid;
  v_finalizada boolean;
  v_autorizada boolean;
begin
  if p_turma_id is null then return false; end if;

  select role, turma_id into v_role, v_minha_turma from public.profiles where id = p_usuario_id;
  if v_role is null then return false; end if;
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

-- Configuração (perfis, matrícula, papel, dados da turma) — mesma regra de
-- pode_editar_turma, mais a janela de bootstrap pra turma sem admin oficial.
create or replace function public.pode_configurar_turma(p_turma_id uuid, p_usuario_id uuid default auth.uid())
returns boolean
language plpgsql security definer set search_path = public stable
as $$
declare
  v_tem_admin_oficial boolean;
begin
  if p_turma_id is null then return false; end if;
  if public.pode_editar_turma(p_turma_id, p_usuario_id) then return true; end if;

  select exists (
    select 1 from public.profiles where turma_id = p_turma_id and role = 'admin'
  ) into v_tem_admin_oficial;

  return (
    not v_tem_admin_oficial
    and exists (
      select 1 from public.profiles
      where id = p_usuario_id and role in ('admin', 'admin_institucional', 'desenvolvedor')
    )
  );
end;
$$;

grant execute on function public.is_algum_admin(uuid) to authenticated;
grant execute on function public.pode_editar_turma(uuid, uuid) to authenticated;
grant execute on function public.pode_configurar_turma(uuid, uuid) to authenticated;

-- ------------------------------------------------------------
-- Trava as colunas de ciclo de vida contra update direto — só passam pelas
-- 2 funções abaixo, que sinalizam a exceção via set_config antes do update
-- interno.
-- ------------------------------------------------------------

create or replace function public.bloquear_edicao_direta_ciclo_vida()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.permitir_ciclo_vida', true), '') = 'true' then
    return new;
  end if;
  if new.finalizada is distinct from old.finalizada
     or new.autorizacao_institucional is distinct from old.autorizacao_institucional then
    raise exception 'Use finalizar_turma()/autorizar_admin_institucional() para mudar isso.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bloquear_ciclo_vida on public.turmas;
create trigger trg_bloquear_ciclo_vida before update on public.turmas
  for each row execute function public.bloquear_edicao_direta_ciclo_vida();

-- ------------------------------------------------------------
-- RPCs de ação
-- ------------------------------------------------------------

create or replace function public.finalizar_turma(p_turma_id uuid, p_finalizada boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin_institucional', 'desenvolvedor')
  ) then
    raise exception 'Só o admin institucional ou o desenvolvedor podem finalizar uma turma.';
  end if;
  perform set_config('app.permitir_ciclo_vida', 'true', true);
  update public.turmas set finalizada = p_finalizada where id = p_turma_id;
end;
$$;

create or replace function public.autorizar_admin_institucional(p_turma_id uuid, p_valor boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'desenvolvedor') then
    raise exception 'Só o desenvolvedor pode autorizar edição numa turma finalizada.';
  end if;
  perform set_config('app.permitir_ciclo_vida', 'true', true);
  update public.turmas set autorizacao_institucional = p_valor where id = p_turma_id;
end;
$$;

create or replace function public.transferir_admin_institucional(p_novo_admin_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
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

-- ------------------------------------------------------------
-- Resumo cross-turma (só leitura) — nome + média final, sem detalhe por
-- matéria, sem dado biográfico. Combinado com estatisticas_modulo/
-- estatisticas_classificacao_geral (já existem, já SECURITY DEFINER, já
-- aceitam p_turma_id) dá pra montar o resumo de qualquer turma.
-- ------------------------------------------------------------

create or replace function public.ranking_turma(p_turma_id uuid)
returns table (nome text, media_final numeric)
language sql security definer set search_path = public stable
as $$
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
  having count(*) = 3;
$$;

grant execute on function public.ranking_turma(uuid) to authenticated;

-- ------------------------------------------------------------
-- RLS: troca is_admin() (global) pelas funções escopadas
-- ------------------------------------------------------------

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles for select
  using (id = auth.uid() or public.pode_configurar_turma(turma_id));

drop policy if exists "profiles_admin_write" on public.profiles;
create policy "profiles_admin_write" on public.profiles for all
  using (public.pode_configurar_turma(turma_id))
  with check (public.pode_configurar_turma(turma_id));

drop policy if exists "notas_cfo1_select" on public.notas_cfo1;
create policy "notas_cfo1_select" on public.notas_cfo1 for select
  using (aluno_id = auth.uid() or public.pode_configurar_turma((select turma_id from public.profiles where id = aluno_id)));
drop policy if exists "notas_cfo1_admin_write" on public.notas_cfo1;
create policy "notas_cfo1_admin_write" on public.notas_cfo1 for all
  using (public.pode_editar_turma((select turma_id from public.profiles where id = aluno_id)))
  with check (public.pode_editar_turma((select turma_id from public.profiles where id = aluno_id)));

drop policy if exists "notas_cfo2_select" on public.notas_cfo2;
create policy "notas_cfo2_select" on public.notas_cfo2 for select
  using (aluno_id = auth.uid() or public.pode_configurar_turma((select turma_id from public.profiles where id = aluno_id)));
drop policy if exists "notas_cfo2_admin_write" on public.notas_cfo2;
create policy "notas_cfo2_admin_write" on public.notas_cfo2 for all
  using (public.pode_editar_turma((select turma_id from public.profiles where id = aluno_id)))
  with check (public.pode_editar_turma((select turma_id from public.profiles where id = aluno_id)));

drop policy if exists "notas_cfo3_select" on public.notas_cfo3;
create policy "notas_cfo3_select" on public.notas_cfo3 for select
  using (aluno_id = auth.uid() or public.pode_configurar_turma((select turma_id from public.profiles where id = aluno_id)));
drop policy if exists "notas_cfo3_admin_write" on public.notas_cfo3;
create policy "notas_cfo3_admin_write" on public.notas_cfo3 for all
  using (public.pode_editar_turma((select turma_id from public.profiles where id = aluno_id)))
  with check (public.pode_editar_turma((select turma_id from public.profiles where id = aluno_id)));

drop policy if exists "classificacao_select" on public.classificacao_final;
create policy "classificacao_select" on public.classificacao_final for select
  using (aluno_id = auth.uid() or public.pode_configurar_turma((select turma_id from public.profiles where id = aluno_id)));
drop policy if exists "classificacao_admin_write" on public.classificacao_final;
create policy "classificacao_admin_write" on public.classificacao_final for all
  using (public.pode_editar_turma((select turma_id from public.profiles where id = aluno_id)))
  with check (public.pode_editar_turma((select turma_id from public.profiles where id = aluno_id)));

drop policy if exists "turmas_admin_write" on public.turmas;
create policy "turmas_admin_write_insert" on public.turmas for insert
  with check (public.is_algum_admin());
create policy "turmas_admin_write_update" on public.turmas for update
  using (public.pode_configurar_turma(id)) with check (public.pode_configurar_turma(id));
create policy "turmas_admin_write_delete" on public.turmas for delete
  using (public.pode_configurar_turma(id));
-- turmas_select_todos (using true) continua igual — resumo cross-turma
-- depende de toda turma ser listável.

drop policy if exists "brasoes_admin_insere" on storage.objects;
create policy "brasoes_admin_insere" on storage.objects
  for insert with check (bucket_id = 'brasoes' and public.is_algum_admin());
drop policy if exists "brasoes_admin_atualiza" on storage.objects;
create policy "brasoes_admin_atualiza" on storage.objects
  for update using (bucket_id = 'brasoes' and public.is_algum_admin());
drop policy if exists "brasoes_admin_apaga" on storage.objects;
create policy "brasoes_admin_apaga" on storage.objects
  for delete using (bucket_id = 'brasoes' and public.is_algum_admin());

-- ------------------------------------------------------------
-- Auditoria estendida a profiles (já existe em notas_cfoN e turmas)
-- ------------------------------------------------------------

drop trigger if exists trg_auditoria_profiles on public.profiles;
create trigger trg_auditoria_profiles after insert or update or delete on public.profiles
  for each row execute function public.fn_registrar_auditoria();
```

- [ ] **Step 2: Rodar direto no Supabase**

```bash
npx supabase db query --linked --file supabase/migration_15.sql
```

- [ ] **Step 3: Migrar o Roni pra `admin_institucional`**

```bash
npx supabase db query --linked "update public.profiles set role = 'admin_institucional' where email = 'oliveira.natrilha@gmail.com' returning nome_completo, role;"
```

Esperado: 1 linha, `role = admin_institucional`.

- [ ] **Step 4: Conferir**

```bash
npx supabase db query --linked "select pode_editar_turma(t.id) from public.turmas t limit 1;"
```

Esperado: roda sem erro de sintaxe/permissão (retorna `false` quando rodado
fora de uma sessão autenticada via CLI, o que é esperado — o `auth.uid()`
do contexto do CLI é nulo; o teste real acontece via app, na Task 9).

- [ ] **Step 5: Commit**

```bash
git add supabase/migration_15.sql
git commit -m "feat(db): permissoes multi-turma - admin_institucional, ciclo de vida, resumo cross-turma"
```

---

### Task 2: Edge Functions — `admin-create-user` e `admin-update-user`

**Files:**
- Modify: `supabase/functions/admin-create-user/index.ts`
- Modify: `supabase/functions/admin-update-user/index.ts`

**Interfaces:**
- Consumes: `pode_configurar_turma(p_turma_id, p_usuario_id)` (Task 1) — chamada via
  `adminClient.rpc(...)`, passando `caller.id` explicitamente (o cliente `service_role` não tem
  `auth.uid()`).

Essas duas funções usam o cliente `service_role`, que **bypassa RLS inteiramente** — por isso a
checagem de permissão tem que estar no código da function, não só no banco.

- [ ] **Step 1: `admin-create-user/index.ts`**

O trecho que checa permissão hoje é:

```ts
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (callerProfile?.role !== "admin" && callerProfile?.role !== "desenvolvedor") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem criar usuários." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, nome_completo, cpf, matricula, senha_provisoria, role, turma_id } = await req.json();

    if (!email || !nome_completo || !senha_provisoria || !turma_id) {
      return new Response(JSON.stringify({ error: "email, nome_completo, senha_provisoria e turma_id são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
```

Trocar para (lê o body primeiro, porque a checagem agora depende do
`turma_id` informado):

```ts
    const { email, nome_completo, cpf, matricula, senha_provisoria, role, turma_id } = await req.json();

    if (!email || !nome_completo || !senha_provisoria || !turma_id) {
      return new Response(JSON.stringify({ error: "email, nome_completo, senha_provisoria e turma_id são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: podeConfigurar } = await adminClient.rpc("pode_configurar_turma", {
      p_turma_id: turma_id,
      p_usuario_id: caller.id,
    });

    if (!podeConfigurar) {
      return new Response(JSON.stringify({ error: "Você não tem permissão para cadastrar alunos nesta turma." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
```

- [ ] **Step 2: `admin-update-user/index.ts`**

O trecho de checagem hoje é:

```ts
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", caller.id)
      .single();

    if (callerProfile?.role !== "admin" && callerProfile?.role !== "desenvolvedor") {
      return new Response(JSON.stringify({ error: "Apenas administradores podem editar usuários." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, nome_completo, email, cpf, matricula, role, nova_senha, turma_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
```

Trocar para (busca o perfil ALVO pra saber a turma atual dele, bloqueia
`role` pra `desenvolvedor`/`admin_institucional` — esses só mudam pelas
funções dedicadas —, e checa `pode_configurar_turma` tanto na turma atual
quanto, se estiver trocando de turma, na turma nova):

```ts
    const { user_id, nome_completo, email, cpf, matricula, role, nova_senha, turma_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id é obrigatório." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (role === "desenvolvedor" || role === "admin_institucional") {
      return new Response(
        JSON.stringify({ error: "Esses papéis só podem ser atribuídos pelos fluxos próprios, não por aqui." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: alvo } = await adminClient.from("profiles").select("turma_id").eq("id", user_id).single();
    if (!alvo) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: podeNaAtual } = await adminClient.rpc("pode_configurar_turma", {
      p_turma_id: alvo.turma_id,
      p_usuario_id: caller.id,
    });
    if (!podeNaAtual) {
      return new Response(JSON.stringify({ error: "Você não tem permissão para editar este usuário." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (turma_id && turma_id !== alvo.turma_id) {
      const { data: podeNaNova } = await adminClient.rpc("pode_configurar_turma", {
        p_turma_id: turma_id,
        p_usuario_id: caller.id,
      });
      if (!podeNaNova) {
        return new Response(JSON.stringify({ error: "Você não tem permissão para mover este usuário para essa turma." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
```

- [ ] **Step 3: Redeploy das duas functions**

```bash
npx supabase functions deploy admin-create-user
npx supabase functions deploy admin-update-user
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/admin-create-user/index.ts supabase/functions/admin-update-user/index.ts
git commit -m "feat: admin-create-user/admin-update-user passam a respeitar pode_configurar_turma"
```

---

### Task 3: Tipos e `AuthContext` — novo papel

**Files:**
- Modify: `src/lib/supabaseClient.ts`
- Modify: `src/contexts/AuthContext.tsx`

**Interfaces:**
- Produces: `AppRole` inclui `"admin_institucional"`; `AuthContextValue.isAdminInstitucional: boolean`.
  Usado pelas Tasks 5-8.

- [ ] **Step 1: `src/lib/supabaseClient.ts`**

A definição de `AppRole` hoje é:

```ts
export type AppRole = "admin" | "aluno" | "desenvolvedor";
```

Trocar para:

```ts
export type AppRole = "admin" | "admin_institucional" | "aluno" | "desenvolvedor";
```

- [ ] **Step 2: `src/contexts/AuthContext.tsx`**

A interface `AuthContextValue` hoje tem:

```ts
  isAdmin: boolean;
  isDeveloper: boolean;
```

Trocar para:

```ts
  isAdmin: boolean;
  isAdminInstitucional: boolean;
  isDeveloper: boolean;
```

O objeto `value` hoje tem:

```ts
    isAdmin: profile?.role === "admin" || profile?.role === "desenvolvedor",
    isDeveloper: profile?.role === "desenvolvedor",
```

Trocar para (qualquer papel de gestão conta como `isAdmin`, pra continuar
enxergando os painéis administrativos — o escopo real de cada ação é
decidido pelo banco, não por esse flag):

```ts
    isAdmin: profile?.role === "admin" || profile?.role === "admin_institucional" || profile?.role === "desenvolvedor",
    isAdminInstitucional: profile?.role === "admin_institucional",
    isDeveloper: profile?.role === "desenvolvedor",
```

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabaseClient.ts src/contexts/AuthContext.tsx
git commit -m "feat: novo papel admin_institucional nos tipos e AuthContext"
```

---

### Task 4: `TurmaContext` — ciclo de vida da turma

**Files:**
- Modify: `src/contexts/TurmaContext.tsx`

**Interfaces:**
- Consumes: RPCs `finalizar_turma`, `autorizar_admin_institucional`, `transferir_admin_institucional` (Task 1).
- Produces: `Turma.finalizada: boolean`, `Turma.autorizacao_institucional: boolean`;
  `useTurma().finalizarTurma(turmaId, valor)`, `useTurma().autorizarAdminInstitucional(turmaId, valor)`,
  `useTurma().transferirAdminInstitucional(novoAdminId)`. Usadas pelas Tasks 6-8.

- [ ] **Step 1: Interface `Turma`**

A interface hoje termina em:

```ts
  responsavel_assinatura_funcao: string;
  created_at: string;
}
```

Trocar para:

```ts
  responsavel_assinatura_funcao: string;
  finalizada: boolean;
  autorizacao_institucional: boolean;
  created_at: string;
}
```

`TURMA_PADRAO` hoje termina em:

```ts
  responsavel_assinatura_funcao: "Gerente Subalterno da Secretaria de Registros Acadêmicos",
  created_at: new Date().toISOString(),
};
```

Trocar para:

```ts
  responsavel_assinatura_funcao: "Gerente Subalterno da Secretaria de Registros Acadêmicos",
  finalizada: false,
  autorizacao_institucional: false,
  created_at: new Date().toISOString(),
};
```

- [ ] **Step 2: `TurmaContextValue`**

Logo abaixo de `atribuirNumeroRegistroHistorico: (...) => Promise<{ numero: number | null; error: string | null }>;`,
adicionar:

```ts
  finalizarTurma: (id: string, valor: boolean) => Promise<{ error: string | null }>;
  autorizarAdminInstitucional: (id: string, valor: boolean) => Promise<{ error: string | null }>;
  transferirAdminInstitucional: (novoAdminId: string) => Promise<{ error: string | null }>;
```

- [ ] **Step 3: Implementação**

Logo depois da função `atribuirNumeroRegistroHistorico` (antes do `return (`), adicionar:

```ts
  async function finalizarTurma(id: string, valor: boolean) {
    const { error } = await supabase.rpc("finalizar_turma", { p_turma_id: id, p_finalizada: valor });
    if (!error) await carregar();
    return { error: error?.message ?? null };
  }

  async function autorizarAdminInstitucional(id: string, valor: boolean) {
    const { error } = await supabase.rpc("autorizar_admin_institucional", { p_turma_id: id, p_valor: valor });
    if (!error) await carregar();
    return { error: error?.message ?? null };
  }

  async function transferirAdminInstitucional(novoAdminId: string) {
    const { error } = await supabase.rpc("transferir_admin_institucional", { p_novo_admin_id: novoAdminId });
    return { error: error?.message ?? null };
  }
```

- [ ] **Step 4: Registrar no Provider**

No objeto de `<TurmaContext.Provider value={{ ... }}>`, logo depois de
`atribuirNumeroRegistroHistorico,`, adicionar:

```ts
        finalizarTurma,
        autorizarAdminInstitucional,
        transferirAdminInstitucional,
```

- [ ] **Step 5: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/contexts/TurmaContext.tsx
git commit -m "feat: TurmaContext ganha finalizar/autorizar/transferir admin institucional"
```

---

### Task 5: Hook `usePermissoesTurma`

**Files:**
- Create: `src/hooks/usePermissoesTurma.ts`

**Interfaces:**
- Consumes: `AuthContext.profile` (Task 3), `TurmaContext.turmas` (Task 4).
- Produces: `usePermissoesTurma(turmaId: string | null): { podeEditarNotas: boolean; podeConfigurar: boolean }`.
  Usado pelas Tasks 6-8. Espelha `pode_editar_turma`/`pode_configurar_turma` só pra UX — a
  autoridade real continua sendo a RLS/RPC no banco.

- [ ] **Step 1: Escrever o hook**

```ts
import { useAuth } from "@/contexts/AuthContext";
import { useTurma } from "@/contexts/TurmaContext";

export function usePermissoesTurma(turmaId: string | null) {
  const { profile } = useAuth();
  const { turmas } = useTurma();

  if (!profile || !turmaId) {
    return { podeEditarNotas: false, podeConfigurar: false };
  }

  if (profile.role === "desenvolvedor") {
    return { podeEditarNotas: true, podeConfigurar: true };
  }

  const turma = turmas.find((t) => t.id === turmaId);
  if (!turma) {
    return { podeEditarNotas: false, podeConfigurar: false };
  }

  if (profile.role === "admin_institucional") {
    const podeEditarNotas = !turma.finalizada || turma.autorizacao_institucional;
    return { podeEditarNotas, podeConfigurar: podeEditarNotas };
  }

  if (profile.role === "admin") {
    const eDonoDaTurma = profile.turma_id === turmaId;
    const podeEditarNotas = eDonoDaTurma && !turma.finalizada;
    // Janela de bootstrap: turma sem admin oficial ainda — não dá pra saber
    // isso só com o que já está carregado no cliente (precisaria de uma
    // query de "existe admin pra essa turma"), então aqui só reflete a
    // regra "dono e não finalizada". Turma em bootstrap ainda mostra os
    // botões de configuração desabilitados pro criador — ele só descobre
    // que pode ao tentar (a RLS libera); é uma pequena divergência de UX
    // aceita, não de segurança.
    return { podeEditarNotas, podeConfigurar: podeEditarNotas };
  }

  return { podeEditarNotas: false, podeConfigurar: false };
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePermissoesTurma.ts
git commit -m "feat: hook usePermissoesTurma (espelho de UX das regras do banco)"
```

---

### Task 6: `AdminGradesEditor` — travar quando não pode editar

**Files:**
- Modify: `src/pages/admin/AdminGradesEditor.tsx`

**Interfaces:**
- Consumes: `usePermissoesTurma` (Task 5).

- [ ] **Step 1: Usar o hook**

A linha do topo do componente hoje é:

```ts
  const { rows, loading, error, refetch, salvarNota, excluirNota } = useNotasModulo(tabela);
  const { turmaAtualId } = useTurma();
```

Trocar para:

```ts
  const { rows, loading, error, refetch, salvarNota, excluirNota } = useNotasModulo(tabela);
  const { turmaAtualId } = useTurma();
  const { podeEditarNotas } = usePermissoesTurma(turmaAtualId);
```

Adicionar o import no topo:

```ts
import { usePermissoesTurma } from "@/hooks/usePermissoesTurma";
```

- [ ] **Step 2: Aviso e travamento**

Logo depois da abertura do componente (primeiro elemento do JSX retornado —
localizar o `return (` e o primeiro `<div` ou `<Card` do arquivo), adicionar
um aviso quando `!podeEditarNotas`:

```tsx
      {!podeEditarNotas && (
        <div className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning-foreground">
          Você não tem permissão para editar notas desta turma agora (turma finalizada, ou você
          não é o administrador oficial dela).
        </div>
      )}
```

Nos 3 botões que disparam escrita — o botão de "Salvar" do formulário de
novo lançamento, o botão de salvar de cada linha editável, e o botão de
excluir —, adicionar `disabled={!podeEditarNotas || <condição já existente>}`
combinando com qualquer `disabled` que já exista hoje nesses botões (ex:
`disabled={salvandoNovo}` vira `disabled={!podeEditarNotas || salvandoNovo}`).

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/AdminGradesEditor.tsx
git commit -m "feat: AdminGradesEditor respeita permissao de turma (usePermissoesTurma)"
```

---

### Task 7: `AdminPersonalizacao` — ciclo de vida da turma + transferência institucional

**Files:**
- Modify: `src/pages/admin/AdminPersonalizacao.tsx`

**Interfaces:**
- Consumes: `useAuth().isAdminInstitucional/isDeveloper` (Task 3),
  `useTurma().finalizarTurma/autorizarAdminInstitucional/transferirAdminInstitucional` (Task 4).

- [ ] **Step 1: Imports e hooks**

A linha do topo hoje é:

```ts
  const { config, salvarTexto, enviarBrasao } = useConfiguracaoTurma();
  const { turmas, turmaAtualId, setTurmaAtualId, criarTurma, atualizarTextoCabecalho, atualizarDadosBoletim, atualizarComandanteApmcv } = useTurma();
```

Trocar para:

```ts
  const { config, salvarTexto, enviarBrasao } = useConfiguracaoTurma();
  const {
    turmas,
    turmaAtualId,
    setTurmaAtualId,
    criarTurma,
    atualizarTextoCabecalho,
    atualizarDadosBoletim,
    atualizarComandanteApmcv,
    finalizarTurma,
    autorizarAdminInstitucional,
    transferirAdminInstitucional,
  } = useTurma();
  const { isAdminInstitucional, isDeveloper } = useAuth();
```

Adicionar os imports:

```ts
import { useAuth } from "@/contexts/AuthContext";
```

E, pro seletor de "quem assume", buscar a lista de admins/alunos pra
escolher no `<select>` — adicionar estado:

```ts
  const [candidatosInstitucional, setCandidatosInstitucional] = useState<{ id: string; nome_completo: string }[]>([]);
  const [novoInstitucionalId, setNovoInstitucionalId] = useState("");
  const [transferindo, setTransferindo] = useState(false);
  const [finalizando, setFinalizando] = useState(false);
  const [autorizando, setAutorizando] = useState(false);

  useEffect(() => {
    if (!isAdminInstitucional && !isDeveloper) return;
    supabase
      .from("profiles")
      .select("id, nome_completo")
      .in("role", ["admin", "aluno"])
      .order("nome_completo")
      .then(({ data }) => setCandidatosInstitucional(data ?? []));
  }, [isAdminInstitucional, isDeveloper]);
```

(`supabase` já precisa estar importado — conferir se `import { supabase } from "@/lib/supabaseClient";`
já existe no topo do arquivo; se não existir, adicionar.)

- [ ] **Step 2: Handlers**

Logo depois de `handleSalvarComandante`, adicionar:

```ts
  async function handleFinalizarTurma(valor: boolean) {
    if (!turmaAtualId) return;
    setFinalizando(true);
    const { error } = await finalizarTurma(turmaAtualId, valor);
    setFinalizando(false);
    if (error) {
      toast({ title: "Erro ao mudar status da turma", description: error, variant: "destructive" });
    } else {
      toast({ title: valor ? "Turma marcada como finalizada" : "Turma reaberta" });
    }
  }

  async function handleAutorizarInstitucional(valor: boolean) {
    if (!turmaAtualId) return;
    setAutorizando(true);
    const { error } = await autorizarAdminInstitucional(turmaAtualId, valor);
    setAutorizando(false);
    if (error) {
      toast({ title: "Erro ao autorizar", description: error, variant: "destructive" });
    } else {
      toast({ title: valor ? "Admin institucional autorizado nesta turma" : "Autorização revogada" });
    }
  }

  async function handleTransferirInstitucional() {
    if (!novoInstitucionalId) {
      toast({ title: "Escolha quem vai assumir", variant: "destructive" });
      return;
    }
    setTransferindo(true);
    const { error } = await transferirAdminInstitucional(novoInstitucionalId);
    setTransferindo(false);
    if (error) {
      toast({ title: "Erro ao transferir", description: error, variant: "destructive" });
    } else {
      toast({ title: "Função institucional transferida" });
      setNovoInstitucionalId("");
    }
  }
```

- [ ] **Step 3: Card na UI**

Logo depois do `</Card>` que fecha "Comandante da APMCV" (antes do card
"Cadastrar nova turma"), adicionar:

```tsx
      {(isAdminInstitucional || isDeveloper) && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Ciclo de vida da turma — {config.nome_turma}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Turma finalizada fica travada — ninguém edita notas, perfis ou dados dela, exceto
              o desenvolvedor (ou quem ele autorizar pontualmente aqui embaixo).
            </p>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <span className="text-sm font-medium">
                Status: {config.finalizada ? "Finalizada (travada)" : "Em andamento"}
              </span>
              <Button
                variant={config.finalizada ? "outline" : "destructive"}
                size="sm"
                onClick={() => handleFinalizarTurma(!config.finalizada)}
                disabled={finalizando}
              >
                {finalizando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {config.finalizada ? "Reabrir turma" : "Finalizar turma"}
              </Button>
            </div>
            {isDeveloper && config.finalizada && (
              <div className="flex items-center justify-between rounded-md border border-border p-3">
                <span className="text-sm font-medium">
                  Admin institucional pode editar mesmo finalizada:{" "}
                  {config.autorizacao_institucional ? "Sim" : "Não"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAutorizarInstitucional(!config.autorizacao_institucional)}
                  disabled={autorizando}
                >
                  {autorizando && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {config.autorizacao_institucional ? "Revogar autorização" : "Autorizar"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isAdminInstitucional && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Transferir função institucional
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Passa seu papel de admin institucional (acesso a todas as turmas em andamento) pra
              outra pessoa — você volta a ser administrador comum depois.
            </p>
            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-1">
                <Label>Quem vai assumir</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={novoInstitucionalId}
                  onChange={(e) => setNovoInstitucionalId(e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {candidatosInstitucional.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome_completo}
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={handleTransferirInstitucional} disabled={transferindo}>
                {transferindo && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Transferir
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
```

- [ ] **Step 4: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/AdminPersonalizacao.tsx
git commit -m "feat: card de ciclo de vida da turma e transferencia de admin institucional"
```

---

### Task 8: `ClassificacaoGeral` — resumo somente-leitura de outra turma

**Files:**
- Modify: `src/pages/cfo/ClassificacaoGeral.tsx`

**Interfaces:**
- Consumes: RPCs `ranking_turma`, `estatisticas_classificacao_geral`, `estatisticas_modulo`
  (Task 1, os 2 últimos já existiam).

- [ ] **Step 1: Estado do seletor**

Logo abaixo de `const [selectedStudent, setSelectedStudent] = useState<DetailedStudent | null>(null);`,
adicionar:

```ts
  const { turmas } = useTurma();
  const [turmaResumoId, setTurmaResumoId] = useState<string | null>(null);
  const [resumoOutraTurma, setResumoOutraTurma] = useState<{
    nomeTurma: string;
    indicadores: { totalAlunos: number; mediaTurma: number; desvioPadrao: number; maiorMedia: number; menorMedia: number };
    mediaCfo1: number | null;
    mediaCfo2: number | null;
    mediaCfo3: number | null;
    ranking: { nome: string; media_final: number }[];
  } | null>(null);
  const [carregandoResumo, setCarregandoResumo] = useState(false);
```

Adicionar o import:

```ts
import { useTurma } from "@/contexts/TurmaContext";
```

(Conferir se `useState`/`useEffect` já estão importados de `"react"` no
topo — já estão, o componente já usa `useState`.)

- [ ] **Step 2: Carregar o resumo ao trocar de turma**

Logo depois do bloco de estado (antes de `const cfo1 = useAlunosModulo(...)`),
adicionar:

```ts
  useEffect(() => {
    if (!turmaResumoId) {
      setResumoOutraTurma(null);
      return;
    }
    let cancelado = false;
    setCarregandoResumo(true);
    Promise.all([
      supabase.rpc("estatisticas_classificacao_geral", { p_turma_id: turmaResumoId }),
      supabase.rpc("estatisticas_modulo", { p_tabela: "notas_cfo1", p_turma_id: turmaResumoId }),
      supabase.rpc("estatisticas_modulo", { p_tabela: "notas_cfo2", p_turma_id: turmaResumoId }),
      supabase.rpc("estatisticas_modulo", { p_tabela: "notas_cfo3", p_turma_id: turmaResumoId }),
      supabase.rpc("ranking_turma", { p_turma_id: turmaResumoId }),
    ]).then(([geral, m1, m2, m3, ranking]) => {
      if (cancelado) return;
      const g = geral.data?.[0];
      const nomeTurma = turmas.find((t) => t.id === turmaResumoId)?.nome_turma ?? "";
      setResumoOutraTurma({
        nomeTurma,
        indicadores: {
          totalAlunos: g?.total_alunos ?? 0,
          mediaTurma: g?.media_turma ?? 0,
          desvioPadrao: g?.desvio_padrao ?? 0,
          maiorMedia: g?.maior_media ?? 0,
          menorMedia: g?.menor_media ?? 0,
        },
        mediaCfo1: m1.data?.[0]?.media_turma ?? null,
        mediaCfo2: m2.data?.[0]?.media_turma ?? null,
        mediaCfo3: m3.data?.[0]?.media_turma ?? null,
        ranking: (ranking.data ?? []).sort((a: any, b: any) => b.media_final - a.media_final),
      });
      setCarregandoResumo(false);
    });
    return () => {
      cancelado = true;
    };
  }, [turmaResumoId, turmas]);
```

Adicionar o import de `supabase`:

```ts
import { supabase } from "@/lib/supabaseClient";
```

- [ ] **Step 3: Seletor na UI + bloco de resumo**

Logo depois do fechamento da tag `{header}` (antes do `if (!mostrarVisaoCompleta) {`),
adicionar o seletor (sempre visível, para qualquer papel — é leitura pública
entre turmas):

```tsx
      <div className="container mx-auto px-4 pt-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Label className="text-sm text-muted-foreground">Ver resumo de outra turma:</Label>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={turmaResumoId ?? ""}
            onChange={(e) => setTurmaResumoId(e.target.value || null)}
          >
            <option value="">Minha turma (visão completa)</option>
            {turmas
              .filter((t) => t.id !== config.id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome_turma}
                </option>
              ))}
          </select>
        </div>
      </div>
```

Adicionar o import de `Label`:

```ts
import { Label } from "@/components/ui/label";
```

Logo depois desse bloco, **antes** do `if (!mostrarVisaoCompleta) {`,
adicionar o retorno antecipado do modo resumo (sem clique em aluno, sem
exportar):

```tsx
      {turmaResumoId && (
        <div className="container mx-auto px-4 py-8 space-y-8">
          {carregandoResumo || !resumoOutraTurma ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <section>
                <h2 className="text-xl font-semibold mb-4 text-foreground">
                  Indicadores Gerais — {resumoOutraTurma.nomeTurma}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <KPICard title="Total de Alunos" value={resumoOutraTurma.indicadores.totalAlunos} variant="default" icon={<Users className="w-4 h-4" />} />
                  <KPICard title="Média da Turma" value={resumoOutraTurma.indicadores.mediaTurma.toFixed(4)} subtitle={`Desvio-padrão: ${resumoOutraTurma.indicadores.desvioPadrao.toFixed(4)}`} variant="default" icon={<Target className="w-4 h-4" />} />
                  <KPICard title="Maior Média" value={resumoOutraTurma.indicadores.maiorMedia.toFixed(4)} variant="success" icon={<TrendingUp className="w-4 h-4" />} />
                  <KPICard title="Menor Média" value={resumoOutraTurma.indicadores.menorMedia.toFixed(4)} variant="warning" icon={<TrendingDown className="w-4 h-4" />} />
                </div>
              </section>
              <section>
                <h2 className="text-xl font-semibold mb-4 text-foreground">Média da Turma por Módulo</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <KPICard title="Média CFO I" value={resumoOutraTurma.mediaCfo1?.toFixed(4) ?? "—"} variant="default" icon={<Target className="w-4 h-4" />} />
                  <KPICard title="Média CFO II" value={resumoOutraTurma.mediaCfo2?.toFixed(4) ?? "—"} variant="default" icon={<Target className="w-4 h-4" />} />
                  <KPICard title="Média CFO III" value={resumoOutraTurma.mediaCfo3?.toFixed(4) ?? "—"} variant="default" icon={<Target className="w-4 h-4" />} />
                </div>
              </section>
              <section>
                <h2 className="text-xl font-semibold mb-4 text-foreground">Ranking Completo</h2>
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">#</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead className="text-right">Média Final</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {resumoOutraTurma.ranking.map((r, i) => (
                          <TableRow key={r.nome}>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell>{r.nome}</TableCell>
                            <TableCell className="text-right">{r.media_final.toFixed(4)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </section>
            </>
          )}
        </div>
      )}

      {!turmaResumoId && (
```

E fechar esse novo bloco condicional envolvendo todo o restante do corpo já
existente do componente (do `if (!mostrarVisaoCompleta) { ... }` até o fim
do `return (...)` principal) com `)}` correspondente, logo antes do
`</div>` final que fecha `<div className="min-h-screen ...">`. Ou seja: a
estrutura passa a ser — cabeçalho e seletor sempre aparecem; **ou** mostra o
bloco de resumo da turma escolhida, **ou** (quando nenhuma está escolhida)
mostra tudo que já existia antes (KPIs completos, Top 3/Carroceiros,
Ranking clicável, Validação dos Dados).

Import de `Table`/`TableBody`/`TableHead`/`TableHeader`/`TableRow`/`TableCell`
do `@/components/ui/table` (mesmo padrão já usado em outros lugares do
projeto — conferir se já não está importado; se não, adicionar).

- [ ] **Step 4: Checar tipos**

Run: `npx tsc --noEmit -p tsconfig.app.json`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/pages/cfo/ClassificacaoGeral.tsx
git commit -m "feat: resumo somente-leitura de outra turma na Classificacao Geral"
```

---

### Task 9: Build final e checklist de conferência manual

**Files:**
- Nenhum arquivo novo — só validação.

- [ ] **Step 1: Build completo**

Run: `npm install && npx tsc --noEmit -p tsconfig.app.json && npx vite build`
Expected: build termina sem erros.

- [ ] **Step 2: Checklist de conferência manual (pedir ao usuário)**

1. Logado como Roni (`admin_institucional`), confirmar que ele vê o card
   "Ciclo de vida da turma" e "Transferir função institucional" em
   Personalização, em qualquer turma.
2. Logado como admin comum de uma turma X, confirmar que **não** vê esses
   dois cards.
3. Como admin de X, tentar (via URL/direto) ver perfil de aluno de outra
   turma Y — confirmar que não retorna nada (RLS bloqueando).
4. Criar turma "Teste" logado como admin de X, cadastrar 1 aluno nela,
   promovê-lo a admin — confirmar que o admin de X perde acesso de edição
   de nota na turma "Teste" depois disso.
5. Como desenvolvedor, finalizar a turma 23º CFO. Confirmar que nem o Roni
   nem o admin dela conseguem mais editar nada.
6. Autorizar o Roni pontualmente na 23º CFO finalizada — confirmar que ele
   volta a editar; revogar e confirmar que perde de novo.
7. Roni transferir a função institucional pra outra conta — confirmar que a
   conta nova vira `admin_institucional` e o Roni vira `admin`.
8. Em Classificação Geral, qualquer usuário troca o seletor "Ver resumo de
   outra turma" — confirmar que aparece só o resumo agregado, sem clique em
   aluno, sem exportar, e que "Minha turma" volta a mostrar a visão completa
   de sempre.
9. Confirmar no banco (`select * from auditoria where tabela = 'profiles'
   order by criado_em desc limit 5;`) que uma edição de perfil gerou linha
   nova.

- [ ] **Step 3: Commit final (se a conferência pedir ajuste) ou encerrar**

Se nada precisar de ajuste, a Task 8 já é o estado final. Se pedir ajuste,
aplicar e commitar normalmente.
