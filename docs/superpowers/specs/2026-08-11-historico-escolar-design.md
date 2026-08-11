# Histórico Escolar (Fase 2 de 2) — Word / Excel

Data: 2026-08-11

## Contexto

Continuação da Fase 1 (Boletim Escolar, spec `2026-08-11-boletim-escolar-export-design.md`,
branch `feature/boletim-escolar-export`, PR #2 ainda não mergeada). Esta fase implementa o
segundo documento oficial: o **Histórico Escolar** completo, baseado no modelo real
`z. Modelo Histórico.xls` fornecido pelo usuário.

Diferente do Boletim (que reaproveita quase só dados que já existem no sistema), o Histórico
precisa de:
- Dados biográficos novos do aluno (filiação, RG PM, naturalidade, data de nascimento, escola
  anterior, matrícula/registro na Academia — formato `10.1712.1` no modelo).
- Carga horária por disciplina nos 3 anos (extraída da matriz curricular oficial,
  `7-MATRIZ CURRICULAR DO CFO 20 MESES.xlsx`, já confirmada pelo usuário como válida para o
  23º e 24º CFO).
- Texto legal institucional fixo (criação/credenciamento da APMCV, reconhecimento do CFO).
- Conversão de nota final para texto por extenso, em português.
- Classificação final do aluno (já existe em `classificacao_final`).

O usuário forneceu, para viabilizar esta fase:
- `Planilha dados cfo 24 .xlsx` — dados biográficos de 67 cadetes do 24º CFO (nome, nome de
  guerra, matrícula, RG civil, CPF, telefone, email, naturalidade, data de nascimento,
  filiação, endereço, estado civil, telefone de emergência, experiência anterior).
- `7-MATRIZ CURRICULAR DO CFO 20 MESES.xlsx` — já recebida na Fase 1.
- `z. Modelo Histórico.xls` — modelo real e completo do documento.

## Decisões confirmadas com o usuário

- **Formato de saída: só Word (.docx) e Excel (.xlsx) — sem PDF.** Motivo: partes do
  documento mudam de "dono" com frequência (ex: troca de Comandante da APMCV) e precisam de
  revisão manual por quem for assinar antes de virar documento final; PDF não seria editável
  para essa revisão.
- **Regra unificadora dos campos em vermelho:** qualquer campo classificado como "sujeito a
  revisão de quem está na função" (nome/posto do Comandante da APMCV, número de
  matrícula-registro na Academia) **ou** qualquer dado biográfico ainda não preenchido no
  banco aparece em **vermelho** no Word gerado, com `______` no lugar quando estiver vazio —
  mesmo sinal visual ("revise isso antes de assinar") para os dois casos.
- Texto legal de admissão ("admitido por Concurso Público realizado pela PM em convênio com a
  UFMT") é **fixo, igual para todos os alunos**, independente da experiência profissional
  anterior.
- "Registro nº" do documento é **gerado sequencialmente pelo sistema**, atribuído na primeira
  exportação do Histórico daquele aluno e reaproveitado nas exportações seguintes (não muda a
  cada re-exportação).
- Nenhum dos campos novos entra em cálculo de `nota_final`, médias de módulo, ranking ou
  Classificação Geral — são só de exibição no documento.
- Botão de exportação restrito a admin/desenvolvedor, mesmo padrão do Boletim.
- Sem tela de upload/importação em lote nesta fase (YAGNI). A planilha do 24º CFO já enviada
  é importada por um script único, rodado diretamente pelo Supabase CLI (acesso já autorizado
  em sessões anteriores). Dados ainda faltando (RG PM, escola anterior) ficam em branco/vermelho
  até o usuário enviar; quando enviar, roda-se um novo script pontual.

## Fora de escopo desta fase

- Tela de upload/importação em lote de planilhas biográficas (self-service).
- Qualquer mudança na fórmula de nota, ranking ou Classificação Geral.
- PDF do Histórico.
- Emissão de Histórico para módulo em andamento sem `classificacao_final` calculada (o aluno
  precisa ter os 3 módulos com nota lançada — ver seção de pré-condição abaixo).

## Design

### 1. Banco de dados (nova migração `supabase/migration_14.sql`)

```sql
alter table public.profiles
  add column if not exists rg_pm text,
  add column if not exists filiacao_pai text,
  add column if not exists filiacao_mae text,
  add column if not exists naturalidade text,
  add column if not exists data_nascimento date,
  add column if not exists matricula_academia text, -- formato "10.1712.1" no modelo
  add column if not exists escola_anterior text,
  add column if not exists ano_conclusao_ensino_medio text,
  add column if not exists numero_registro_historico integer; -- atribuído 1x, na 1ª exportação

alter table public.turmas
  add column if not exists comandante_apmcv_nome text,
  add column if not exists comandante_apmcv_posto text,
  add column if not exists proximo_numero_registro_historico integer not null default 1;
```

Todos os campos novos de `profiles` são nullable — o sistema deve funcionar (com placeholders
em vermelho) mesmo sem eles preenchidos. `comandante_apmcv_nome`/`posto` também nullable
(mesmo tratamento: aparecem em vermelho com `______` se vazios).

### 2. Atribuição do número de registro

Ao exportar o Histórico de um aluno pela primeira vez (campo `numero_registro_historico` do
aluno ainda `null`):
1. Ler `proximo_numero_registro_historico` da turma do aluno.
2. Gravar esse valor em `profiles.numero_registro_historico` do aluno.
3. Incrementar `turmas.proximo_numero_registro_historico` em 1.

Essa operação roda antes de gerar o arquivo, via uma função no `TurmaContext` (ou hook
dedicado) que faz as duas escritas numa transação lógica (update do aluno + update da turma).
Em exportações seguintes do mesmo aluno, o número já gravado é reaproveitado — nenhuma escrita
nova acontece.

### 3. Pré-condição para exportar

O botão "Exportar Histórico" só aparece quando o aluno tem `classificacao_final` calculada
(mesma lógica que já alimenta a Classificação Geral) — ou seja, quando os 3 módulos (CFO I, II,
III) têm nota lançada. Sem isso, não há `rank`, `media_final` nem `media_cfo1/2/3` para
preencher o documento. Fica no bloco "Classificação Geral" do `StudentDetailsModal`, ao lado de
onde hoje fica o botão de exportar ranking — visível só para `isAdmin`.

### 4. Carga horária por disciplina (novo `src/config/cargaHorariaCfo.ts`)

Mapeamento estático disciplina → carga horária, extraído e conferido linha a linha contra
`7-MATRIZ CURRICULAR DO CFO 20 MESES.xlsx`, casando exatamente com os nomes já usados em
`MATERIAS_CFO1/2/3` (incluindo a migração já documentada de "Natação" do CFO II pro CFO III):

```ts
export const CARGA_HORARIA_CFO1: Record<string, number> = {
  "Sistema de Segurança Pública no Brasil": 30,
  "História da Policia Militar": 30,
  "Geopolítica de Mato Grosso": 30,
  "Policia Comunitária": 30,
  "Legislação Policial Militar I": 40,
  "Direitos humanos": 30,
  "Medicina Legal": 30,
  "Direito Processual Penal Militar I": 40,
  "Direito Penal Militar I": 40,
  "Direito Administrativo Disciplinar Militar I": 40,
  "Legislação Penal Extravagante I": 30,
  "Direito Ambiental": 30,
  "Redação Oficial Aplicada": 30,
  "Educação Física Policial Militar I": 30,
  "Defesa Pessoal I": 30,
  "Educação Financeira": 30,
  "Libras": 30,
  "Metodologia Científica / Pesquisa": 30,
  "Cerimonial e Protocolo": 30,
  "Comunicação Operacional/Telecomunicações": 30,
  "Armamento de Fogo, Munição e Explosivos": 45,
  "Bombeiro Militar e Defesa Civil": 30,
  "Cultura e Cotidiano Policial Militar": 60,
  "Teoria de Policia": 30,
  "Didática: Sistema de Ensino": 40,
  "Técnicas Gerais de Policiamento I": 45,
  "POP I": 60,
  "Defesa Territorial I": 30,
  "Hipologia e Equitação": 30,
  "Administração Pública Gerencial": 30,
  "APH": 30,
  "Tiro Policial": 90,
};

export const CARGA_HORARIA_CFO2: Record<string, number> = {
  "Criminologia Aplicada a Segurança Pública": 30,
  "Sociologia do Crime e da Violência": 30,
  "Direito Penal Militar II": 30,
  "Direito Administrativo Aplicado a Seg. Publica.": 30,
  "Direito Processual Penal Militar II": 30,
  "Legislação Policial Militar II": 30,
  "Direito Administrativo Disciplinar Militar II": 30,
  "Legislação Penal Extravagante II": 30,
  "Educação Física Policial Militar II": 30,
  "Defesa Pessoal II": 30,
  "Gestão de Informação – Inteligência": 30,
  "Saúde Segurança aplicada ao Trabalho": 30,
  "Marketing Institucional": 30,
  "Metodologia Científica/Projeto de Pesquisa": 30,
  "Geoprocessamento e Análise Criminal": 30,
  "Emergência e Traumas": 30,
  "Cultura e Cotidiano Policial Militar II": 45,
  "Técnicas Gerais de Policiamento II": 45,
  "POP II": 60,
  "Criminalística": 30,
  "Defesa Territorial II": 30,
  "Policiamento Montado": 30,
  "Uso diferenciado da Força": 30,
  "Gestão de Pessoas": 30,
  "Termo Circunstanciado de Ocorrência": 30,
  "Sistemas Informatizados": 30,
  "Tiro Policial": 90,
};

export const CARGA_HORARIA_CFO3: Record<string, number> = {
  "Licitação de Contrato e Aquisição": 45,
  "Direito Penal Militar III": 30,
  "Direito Processual Penal Militar III": 30,
  "Legislação Policial Militar III": 30,
  "Direito Administrativo Disciplinar Militar III": 30,
  "Gerenciamento de Crises e Eventos Críticos": 45,
  "Educação Física Policial Militar III": 30,
  "Controle e submissão": 30,
  "Artigo Científico": 30,
  "Seminário de Trabalho Científico-Workshop de Banca de Defesa do TCC": 45,
  "Cultura e Cotidiano Policial Militar III": 30,
  "EPP – Estagio de Patrulhamento Tático": 30,
  "Técnicas Gerais de Policiamento III": 30,
  "POP III": 60,
  "Segurança Física de Instalações e Dignatários": 45,
  "Defesa Territorial III": 30,
  "Policiamento Ambiental": 45,
  "Policiamento de Trânsito": 45,
  "Policiamento de Grandes eventos": 30,
  "Técnicas não letais": 30,
  "Gestão de Recursos Públicos": 30,
  "Gestão Pública por Resultados": 30,
  "Gestão de Logística e Patrimônio": 30,
  "Tiro Policial": 90,
  "Termo Circunstanciado de Ocorrência": 30,
  "Natação": 30,
};
```

Toda chave desses 3 mapas bate exatamente com uma entrada de `MATERIAS_CFO1/2/3` (conferido
1:1 — nenhuma disciplina sem carga horária, nenhum nome divergente).

### 5. Conversor número → extenso (novo `src/utils/numeroExtenso.ts`)

Função `notaPorExtenso(valor: number): string` que recebe a média final (ex: `8.576`) e
devolve o texto no formato usado no modelo: `"oito vírgula quinhentos e setenta e seis"`
(parte inteira por extenso, "vírgula", parte decimal — os 3 dígitos após a vírgula, já que
`nota_final` é `numeric(6,4)` mas o modelo mostra 3 casas — por extenso como número corrido,
não dígito a dígito). Cobre 0–10 na parte inteira (nunca passa de 10) e 000–999 na parte
decimal, reaproveitando uma tabela padrão de unidades/dezenas/centenas em português.

### 6. Texto institucional do Histórico (extensão de `src/config/documentosOficiais.ts`)

Novo bloco no mesmo arquivo, sem alterar o que já existe (`TEXTO_INSTITUCIONAL` continua do
jeito que está, usado só pelo Boletim):

```ts
export const TEXTO_INSTITUCIONAL_HISTORICO = {
  ...TEXTO_INSTITUCIONAL,
  linhaDiretoria: "DIRETORIA DE ENSINO, INSTRUÇÃO E PESQUISA",
} as const;

export const TEXTO_LEGAL_ABERTURA =
  "criada em 27 de novembro de 1987, pela Lei nº 5.177, e efetivada em 06 de julho de 1993, " +
  "pelo Decreto nº 3.145, credenciada como Instituição de Ensino Superior através da Portaria " +
  "Conjunta nº 07/SESP/SECITEC/2012, bem como reconhecido o Curso de Formação de Oficiais na " +
  "Modalidade de Bacharelado em Segurança Pública, sendo que o referido CFO foi reconhecido " +
  "inicialmente em 1996, como Curso de Nível Superior pela Resolução nº 253/96, do CEE/MT, " +
  "conforme Parecer nº 092/96, de 27 de agosto de 1996, ratificado pelo Parecer nº 049/00-CEE " +
  "de 22 de fevereiro de 2000, localizada à Rua Maysa Matarazzo s/nº, Bairro Jardim Costa Verde " +
  "em Várzea Grande-MT, CERTIFICA que consta nos arquivos desta Unidade Escolar que,";

export const TEXTO_LEGAL_ADMISSAO =
  "admitido(a) por Concurso Público realizado pela Polícia Militar do Estado de Mato Grosso " +
  "em convênio com a Universidade Federal de Mato Grosso, tendo concluído o 2º Grau";

export const TEXTO_LEGAL_FECHAMENTO =
  "Por ser verdade eu mandei passar o presente, assinado depois de datado pelo chefe da " +
  "Secretaria de Registros Acadêmico da APMCV, que conferiu a elaboração do presente, o qual " +
  "assina juntamente com o sr. Comandante da APMCV.";
```

Esses textos são fixos e não entram na regra de "campo em vermelho" — só os dados que
variam por pessoa/aluno entram.

### 7. Novo gerador: `src/utils/exportHistorico.ts`

Segue o mesmo padrão de `exportBoletim.ts` (interface `DadosExportacaoHistorico`, função
`linhasHistorico` por ano, `downloadBlob` reaproveitado). Duas funções exportadas:
`exportarHistoricoWord` e `exportarHistoricoExcel` (sem PDF).

```ts
export interface DisciplinaHistorico {
  nome: string;
  cargaHoraria: number;
  mediaFinal: number | null;
}

export interface DadosExportacaoHistorico {
  nomeAluno: string;
  filiacaoPai: string | null;
  filiacaoMae: string | null;
  dataNascimento: string | null; // já formatada dd/mm/aaaa
  naturalidade: string | null;
  matricula: string | null; // matrícula policial, já existe
  matriculaAcademia: string | null; // "10.1712.1" — campo vermelho
  rgPm: string | null;
  escolaAnterior: string | null;
  anoConclusaoEnsinoMedio: string | null;
  disciplinasCfo1: DisciplinaHistorico[];
  disciplinasCfo2: DisciplinaHistorico[];
  disciplinasCfo3: DisciplinaHistorico[];
  anoLetivoCfo1: string | null;
  anoLetivoCfo2: string | null;
  anoLetivoCfo3: string | null;
  mediaCfo1: number | null;
  mediaCfo2: number | null;
  mediaCfo3: number | null;
  mediaFinal: number;
  rank: number | null;
  numeroRegistro: number;
  comandanteNome: string | null; // campo vermelho
  comandantePosto: string | null; // campo vermelho
  responsavelNome: string;
  responsavelPosto: string;
  responsavelFuncao: string;
  dataEmissao: string; // hoje, já formatada por extenso: "11 de agosto de 2026"
}
```

**Word (`exportarHistoricoWord`):** usa `docx` (já é dependência do projeto). Cada campo
sujeito à regra do vermelho vira um `TextRun` com `color: "FF0000"`; texto `______` quando o
valor for `null`/vazio. Estrutura do documento (uma seção só):
1. Cabeçalho institucional centralizado (`TEXTO_INSTITUCIONAL_HISTORICO`, incluindo a linha da
   Diretoria) + título "HISTÓRICO ESCOLAR".
2. Parágrafo único, justificado, concatenando `TEXTO_LEGAL_ABERTURA` + dados do aluno
   (nome, "brasileiro(a), filho(a) de [pai] e [mãe], nascido(a) em [data], natural de
   [naturalidade], matriculado(a) nesta Academia de Polícia Militar Costa Verde sob o número
   [matriculaAcademia — vermelho] RG PMMT [rgPm — vermelho],") + `TEXTO_LEGAL_ADMISSAO` +
   "no(a) [escolaAnterior], no ano de [anoConclusaoEnsinoMedio], concluiu com aproveitamento o
   CURSO DE FORMAÇÃO DE OFICIAIS POLICIAIS MILITARES – CFO."
3. Três tabelas (uma por ano — cabeçalho "1º Ano CFO" / "2º Ano CFO" / "3º Ano CFO", com o ano
   letivo da turma ao lado), colunas Disciplina | Carga Horária | Média Final, uma linha de
   "Total da Carga Curricular e Média" ao final de cada tabela (soma de carga horária da lista +
   média do ano vinda de `classificacao_final`).
4. "Registro nº: [numeroRegistro]".
5. "Nota de Aprovação: [mediaFinal.toFixed(3)] ([notaPorExtenso(mediaFinal)])".
6. "Classificação: [rank]º Lugar".
7. `TEXTO_LEGAL_FECHAMENTO`.
8. "APMCV em Várzea Grande-MT, [dataEmissao]."
9. Duas assinaturas centralizadas: `responsavelNome`/`responsavelPosto`/`responsavelFuncao`
   (preto, já existe) e `comandanteNome`/`comandantePosto` (vermelho).

**Excel (`exportarHistoricoExcel`):** mesma informação em abas — uma aba "Dados" com os campos
biográficos e de emissão em pares rótulo/valor, e 3 abas "1º Ano"/"2º Ano"/"3º Ano" com a
tabela de disciplinas (sem fórmulas dinâmicas — diferente do Boletim, aqui a nota já é
`nota_final` fechada, não há VC/VF pra recalcular). Sem formatação de cor no Excel (a regra do
vermelho vale só para o Word, que é o documento pensado pra edição manual).

Nome de arquivo: `historico_${nomeAluno}.docx` / `.xlsx` (mesmo padrão `nomeArquivo` do
Boletim, espaços viram `_`).

### 8. Hook/lógica de carregamento dos dados

Novo hook `useDadosHistorico(alunoId: string)` (em `src/hooks/`), que:
1. Busca o profile do aluno (todos os campos novos + `matricula`, `nome_completo`).
2. Busca `classificacao_final` do aluno (`rank`, `media_final`, `media_cfo1/2/3`).
3. Busca as notas de `notas_cfo1/2/3` do aluno (`materia`, `nota_final`).
4. Monta `disciplinasCfo1/2/3` cruzando `MATERIAS_CFO1/2/3` (ordem oficial de exibição) com
   `CARGA_HORARIA_CFO1/2/3` (carga horária) e as notas buscadas (média final; `null` se a
   matéria ainda não tem nota lançada — mesmo tratamento visual "vermelho + `______`" que os
   outros campos ausentes, para consistência).
5. Retorna `{ dados: DadosExportacaoHistorico | null, loading, erro }`.

O botão "Exportar Histórico" no `StudentDetailsModal` chama esse hook (sob demanda, ao abrir o
modal de exportação, igual ao padrão já usado pro Boletim) e, antes de gerar o arquivo, dispara
a atribuição de `numero_registro_historico` (seção 2) via uma função nova em `TurmaContext`
(`atribuirNumeroRegistroHistorico(alunoId, turmaId)`), só se o campo ainda estiver `null`.

### 9. Import dos dados do 24º CFO

Script Node avulso (`scripts/importar-biograficos-cfo24.ts`, não faz parte do build, roda uma
vez via `tsx` ou similar), que:
1. Lê `Planilha dados cfo 24 .xlsx` com a biblioteca `xlsx` (já é dependência do projeto).
2. Para cada linha, casa o aluno por `matricula` (comparando com `profiles.matricula`) — se não
   achar, tenta por `cpf`; se não achar de nenhum jeito, reporta no console e pula.
3. Faz `UPDATE` em `profiles` preenchendo `filiacao_pai`, `filiacao_mae`, `naturalidade`,
   `data_nascimento` — só os campos que a planilha realmente tem. `rg_pm`, `escola_anterior`,
   `ano_conclusao_ensino_medio`, `matricula_academia` continuam `null` até o usuário mandar
   essa parte.
4. Roda uma vez, direto contra o banco de produção via Supabase CLI (`npx supabase db query`,
   acesso já autorizado). Não vira funcionalidade permanente do app nesta fase.

## Testes

Sem suíte de testes automatizados no projeto (mesmo padrão da Fase 1) — verificação manual:
1. Exportar Word e Excel de um aluno com todos os campos preenchidos — conferir texto,
   3 tabelas, totais, nota por extenso, classificação, número de registro.
2. Exportar de um aluno com campos biográficos faltando (ex: RG PM, escola anterior) —
   conferir que aparecem em vermelho com `______`, sem quebrar a geração do documento.
3. Exportar duas vezes o mesmo aluno — conferir que o número de registro não muda na segunda
   vez.
4. Exportar de um aluno sem `classificacao_final` (módulo em aberto) — conferir que o botão
   não aparece ou mostra aviso, sem gerar documento incompleto.
5. Conferir que os totais de carga horária por ano batem com `CARGA HORÁRIA TOTAL DO CFO
   I/II/III` da matriz curricular (1430 / 1230 / 1300... nota: a matriz inclui "Atividades
   Educacionais Interdisciplinares", que **não** faz parte de `MATERIAS_CFO1/2/3` nem tem nota
   lançada no sistema — o total exibido no Histórico é só a soma das disciplinas com nota,
   portanto será menor que o total da matriz. Isso é esperado e não é bug.)
