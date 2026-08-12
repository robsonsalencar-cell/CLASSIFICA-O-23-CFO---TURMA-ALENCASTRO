# Emissão de Boletim Escolar (Fase 1 de 2) — Word / PDF / Excel

Data: 2026-08-11

## Contexto

O usuário pediu uma funcionalidade completa de emissão de relatórios acadêmicos
oficiais (Boletim Escolar e Histórico Escolar), em 3 formatos (Word, PDF,
Excel), com base em dois modelos reais fornecidos:

- `MODELO BOLETIM ESCOLAR.pdf` — boletim de notas por módulo (CFO I/II/III).
- `z. Modelo Histórico.xls` — histórico escolar completo (documento legal com
  dados biográficos, carga horária por disciplina, texto institucional).

Análise dos dois modelos mostrou que são de complexidade muito diferente: o
Boletim reaproveita quase inteiramente dados que já existem no sistema; o
Histórico exige uma quantidade grande de dados novos (filiação, RG PM,
naturalidade, escola anterior, carga horária por disciplina, texto legal,
numeração de registro, conversão de nota para texto por extenso). Foi
acordado com o usuário dividir em duas fases — **este documento cobre só a
Fase 1 (Boletim Escolar)**. A Fase 2 (Histórico Escolar) será especificada
depois, quando o usuário tiver pronta a planilha de dados biográficos dos
alunos (ele vai importar em lote). A matriz curricular oficial com carga
horária por disciplina (`7-MATRIZ CURRICULAR DO CFO 20 MESES.xlsx`,
confirmada pelo usuário como válida para o 23º e 24º CFO) já foi recebida e
fica guardada para uso na Fase 2.

## Decisões já confirmadas com o usuário

- Ordem: Boletim primeiro, Histórico depois.
- Dados biográficos novos (filiação, RG PM, naturalidade, escola anterior,
  data de nascimento) — **fora do escopo desta fase**; o usuário vai montar
  uma planilha para importação em lote quando entrarmos na Fase 2.
- Carga horária por disciplina — **fora do escopo desta fase** (o Boletim não
  tem essa coluna; só o Histórico tem).
- "Verificação de 2ª Época": os valores só aparecem **impressos no Boletim**,
  sem afetar `nota_final`, médias de módulo, ranking ou Classificação Geral
  em nenhum lugar do sistema.
- Responsável pela assinatura em todos os documentos passa a ser **Matheus
  Vitor Xavier Moraes Pereira — 2º Ten PM — Gerente Subalterno da Secretaria
  de Registros Acadêmicos** (substituindo Allison Rocha Brizola - Cap PM),
  mas como campo configurável no banco, não texto fixo no código.
- Botões de exportação restritos a admin/desenvolvedor — reaproveita o
  `isAdmin` que já existe (mesmo padrão do botão de exportação atual em
  `RankingTable.tsx`/`StudentDetailsModal.tsx`), sem lógica de permissão nova.

## Fora de escopo desta fase

- Histórico Escolar completo (Fase 2 — spec separada).
- Dados biográficos dos alunos (filiação, RG PM, naturalidade, escola
  anterior, data de nascimento) e a importação em lote da planilha.
- Carga horária por disciplina.
- Qualquer mudança na fórmula de nota, ranking ou Classificação Geral.

## Design

### 1. Banco de dados (nova migração `supabase/migration_13.sql`)

```sql
alter table public.profiles
  add column if not exists matricula text;

alter table public.turmas
  add column if not exists ano_letivo_cfo1 text,
  add column if not exists ano_letivo_cfo2 text,
  add column if not exists ano_letivo_cfo3 text,
  add column if not exists responsavel_assinatura_nome text
    not null default 'Matheus Vitor Xavier Moraes Pereira',
  add column if not exists responsavel_assinatura_posto text
    not null default '2º Ten PM',
  add column if not exists responsavel_assinatura_funcao text
    not null default 'Gerente Subalterno da Secretaria de Registros Acadêmicos';

alter table public.notas_cfo1
  add column if not exists verif_2a_epoca numeric,
  add column if not exists media_2a_epoca numeric;
alter table public.notas_cfo2
  add column if not exists verif_2a_epoca numeric,
  add column if not exists media_2a_epoca numeric;
alter table public.notas_cfo3
  add column if not exists verif_2a_epoca numeric,
  add column if not exists media_2a_epoca numeric;
```

Nenhuma política de RLS muda — essas colunas ficam visíveis pelas mesmas
policies que já existem para `profiles`, `turmas` e `notas_cfoN`. Os campos
`verif_2a_epoca`/`media_2a_epoca` são só mais duas colunas nas tabelas de
notas; nenhuma função de cálculo (`estatisticas_modulo`,
`estatisticas_classificacao_geral`, `useAlunosModulo.ts`) é alterada — elas
continuam ignorando essas colunas completamente.

Os campos "Início"/"Término" do modelo de Boletim **não são persistidos**:
viram campos de texto livre preenchidos no momento da exportação (o próprio
modelo de referência trouxe esses campos em branco, então não há necessidade
de guardá-los agora).

### 2. Interface

- **Painel do Administrador → Gerenciar Usuários**: novo campo "Matrícula" no
  formulário de edição de aluno.
- **Painel do Administrador → Personalização**: novos campos "Ano letivo CFO
  I/II/III" e os 3 campos de assinatura (nome, posto, função) — pré-populados
  com os valores padrão da migração, editáveis a qualquer momento.
- **Formulário de lançamento de nota** (manual, por matéria): dois novos
  campos opcionais "Verif. 2ª Época" e "Média 2ª Época", em branco por
  padrão, sem nenhum efeito em outro cálculo da tela.
- **`StudentDetailsModal.tsx`** (onde já existe o menu de exportação
  individual PDF/Excel/CSV): novo menu **"Exportar Boletim"** com 3 opções
  (Word, PDF, Excel), visível só quando a modal está aberta para um módulo
  específico (CFO I/II/III — não faz sentido para a aba "Classificação
  Geral"). Ao clicar em qualquer opção, abre um diálogo pedindo "Início" e
  "Término" (texto livre, opcional, pode deixar em branco), e então gera o
  arquivo com spinner de carregamento. Botão só visível para `isAdmin`.

### 3. Geração dos documentos

Novo arquivo `src/config/documentosOficiais.ts` — texto institucional fixo
compartilhado (Estado de Mato Grosso / SESP / Polícia Militar / Academia de
Polícia Militar Costa Verde "(CIM – 1951)"), usado pelo Boletim agora e pelo
Histórico na Fase 2, pra não duplicar esse texto em dois arquivos diferentes.

Novo arquivo `src/utils/exportBoletim.ts`, seguindo a mesma convenção de
`src/utils/exportAluno.ts` (funções puras que recebem um objeto de dados já
montado e devolvem/baixam o arquivo, sem acesso direto ao Supabase):

- `exportarBoletimPDF(dados)` — usa `jspdf` + `jspdf-autotable` (já
  instalados), reproduzindo o layout do modelo: cabeçalho institucional
  (Estado de MT / SESP / PM / APMCV, com o brasão da turma), título "BOLETIM
  ESCOLAR CFO {I|II|III}", dados do aluno (nome, matrícula, turma, ano
  letivo, início, término), tabela de disciplinas (VC1-3, Média VCs, VF,
  Média Final, Verif. 2ª Época, Média 2ª Época, Média Final), linha de "Média
  Final do Ano/Módulo", e a assinatura (nome/posto/função vindos da
  configuração da turma).
- `exportarBoletimWord(dados)` — usa o pacote **`docx`** (nova dependência,
  não existe nada de geração de Word no projeto hoje), mesmo conteúdo/layout
  do PDF, como tabela nativa do Word (editável).
- `exportarBoletimExcel(dados)` — usa `xlsx` (já instalado). As colunas de
  média saem como **fórmulas de planilha de verdade** (`=AVERAGE(...)` para
  Média VCs, e a fórmula oficial `=(D2*2+E2*3)/5` para a nota final da
  disciplina), não como valores fixos — atende ao pedido de "planilha
  estruturada com fórmulas".

Nos três formatos, qualquer campo sem dado (ex: matrícula não preenchida)
aparece como texto vazio ou `"—"` — nunca quebra a geração do documento
nem lança exceção.

### 4. Validação

- `npx tsc --noEmit -p tsconfig.app.json` + `npx vite build` (fluxo já
  estabelecido no projeto).
- Conferência manual: gerar o Boletim de um aluno real nos 3 formatos e
  comparar visualmente com `MODELO BOLETIM ESCOLAR.pdf`.
- Conferir que um usuário com role `aluno` não vê o botão "Exportar
  Boletim" em nenhuma tela.
- SQL da migração entregue pronto para o usuário rodar no SQL Editor do
  Supabase (mesmo fluxo já usado no projeto inteiro).
