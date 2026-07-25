# 23º CFO — Painel Unificado (projeto completo)

Este é o projeto **inteiro e pronto** — não é mais um "pacote de arquivos para
colar por cima". Ele já contém os 4 dashboards (CFO I, II, III e Classificação
Geral) unificados, autenticação, controle de acesso por aluno e painel de
administrador. **Já testei aqui: `npm install` + `npm run build` rodam sem
nenhum erro.**

## O que você precisa fazer de qualquer forma (não tem como pular)
Antes de rodar em qualquer lugar, você precisa criar o banco de dados:
1. Crie um projeto em https://supabase.com (grátis).
2. No **SQL Editor** do projeto, cole e rode o conteúdo de `supabase/schema.sql`.
3. Copie a **Project URL** e a **anon public key** (Project Settings → API).
4. Faça deploy da Edge Function `supabase/functions/admin-create-user`
   (usada para o admin cadastrar novos alunos com segurança). Com a
   [Supabase CLI](https://supabase.com/docs/guides/cli) instalada:
   ```bash
   supabase login
   supabase link --project-ref SEU_PROJECT_REF
   supabase functions deploy admin-create-user
   ```
5. Crie seu usuário admin: Authentication → Users → Add user (com seu e-mail
   e senha), depois no SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'seu-email@exemplo.com';
   ```

---

## Situação 1 — Colar no Lovable
1. No editor do seu projeto Lovable, use a opção de importar/sincronizar
   arquivos (ou apague o conteúdo de `src/` do projeto atual e cole o `src/`
   deste pacote por cima — os componentes visuais são os mesmos, só está
   sendo adicionada a camada de autenticação).
2. Clique no botão verde **Supabase** no Lovable e conecte ao MESMO projeto
   Supabase onde você rodou o `schema.sql` (ele preenche as variáveis de
   ambiente sozinho).
3. Pronto — o link do Lovable (`seu-projeto.lovable.app`) já fica no ar
   automaticamente a cada alteração.

## Situação 2 — GitHub (para você conectar numa Vercel/Netlify depois)
Para eu enviar este projeto para um repositório seu sem você precisar copiar
nada manualmente, preciso que você:
1. Crie um repositório **vazio** no GitHub (sem README, sem .gitignore).
2. Gere um **token de acesso pessoal** (Settings → Developer settings →
   Personal access tokens → Fine-grained tokens), com permissão de escrita
   **só nesse repositório**.
3. Me envie o link do repositório e o token aqui no chat.

Assim que eu tiver isso, eu mesmo faço o `git push` de tudo. Depois, é só
você ir em vercel.com (ou netlify.com) → "Importar projeto do GitHub" →
selecionar o repositório → adicionar as variáveis de ambiente
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (veja `.env.example`) → Deploy.
Isso gera o link público (`seu-projeto.vercel.app`) automaticamente.

> ⚠️ Sobre o token: recomendo revogá-lo assim que eu confirmar que o push
> deu certo — ele não precisa continuar ativo depois disso.

## Situação 3 — Tentar no Gemini (Google AI Studio / outra ferramenta)
Este projeto é um **React + Vite + TypeScript + Tailwind padrão** — não usa
nada exclusivo do Lovable, então deve funcionar em qualquer ambiente que
rode projetos Node/Vite (incluindo o que o Gemini gerar/importar). Únicas
diferenças a saber:
- O Lovable injeta `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
  automaticamente ao conectar o Supabase; em qualquer outro ambiente, você
  mesmo cria um arquivo `.env` (copie de `.env.example`) com esses valores.
- O caminho `/lovable-uploads/...` (usado pelas imagens do brasão) é só uma
  pasta dentro de `public/` — funciona em qualquer hospedagem, não é uma
  URL especial do Lovable.

---

## Estrutura do projeto
```
src/
  pages/auth/       -> Login, esqueci senha, redefinir senha
  pages/admin/       -> Painel do admin (usuários + lançar/alterar notas)
  pages/cfo/          -> Cfo1.tsx, Cfo2.tsx, Cfo3.tsx, ClassificacaoGeral.tsx
  pages/Perfil.tsx    -> Trocar senha (usuário logado)
  components/dashboard/ResumoIndividualModulo.tsx -> visão do aluno comum
  components/layout/AppSidebar.tsx -> menu lateral unificado
  contexts/AuthContext.tsx
  hooks/useNotasModulo.ts, useAlunosModulo.ts, useEstatisticasModulo.ts
  config/materiasCfo1/2/3.ts -> nomes das matérias de cada módulo
supabase/
  schema.sql                  -> rode isso no SQL Editor
  functions/admin-create-user -> deploy via Supabase CLI
scripts/importar-planilha.mjs -> migra os dados da planilha antiga (opcional)
```

## Migrar os dados da planilha antiga (opcional, mas recomendado)
Veja `scripts/importar-planilha.mjs` — ele lê a planilha Google Sheets
original (CFO I, II e III) e importa tudo para o Supabase de uma vez,
criando as contas dos alunos automaticamente. Requer que você preencha
`alunos-emails.csv` primeiro (modelo em `alunos-emails.csv.exemplo`).

## Pontos que dependem de decisão sua
- **Fórmula da média final:** hoje calculada como média simples das matérias
  lançadas (`src/hooks/useAlunosModulo.ts`), ajuste se a fórmula oficial
  usa pesos diferentes.
- **Matérias de CFO II/III:** os arquivos `materiasCfo2.ts`/`materiasCfo3.ts`
  hoje reaproveitam a mesma lista do CFO I (era o que estava nos projetos
  originais). Ajuste se as grades forem diferentes na prática.
