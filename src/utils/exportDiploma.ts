import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  PageBorderDisplay,
  PageBorderOffsetFrom,
  TableBorders,
  PageBreak,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  PageOrientation,
} from "docx";
import { carregarImagemBrasao } from "@/utils/brasaoImagem";

// ============================================================
// Gerador de Diploma — reproduz fielmente o modelo real fornecido em
// 05/09/2026 ("modelo diploma cfo.doc"), conferido campo a campo via
// conversão para .docx (fontes/tamanhos/cores exatos extraídos do XML,
// não estimados visualmente):
//   - Frente: borda de página fina preta, brasão da PMMT à esquerda e da
//     APMCV à direita do cabeçalho, fonte "Algerian" 17pt no cabeçalho e
//     no nome do formando (25pt), fonte "Old English Text MT" no resto
//     (corpo 18pt, título "DIPLOMA" 30pt), dados variáveis em vermelho,
//     assinatura em 2 colunas (Bacharel | Comandante).
//   - Verso: grade 2x2 com borda fina, fonte comum (Times New Roman),
//     números de registro/apostilamento e nota do TCC como placeholder
//     vermelho — decisão do usuário em 05/09/2026 (não existe hoje uma
//     numeração sequencial pra automatizar; ficam pra preencher à mão).
// ============================================================

const BRASAO_PMMT_URL = "/brasao-pmmt-oficial.jpg";
const BRASAO_MT_URL = "/brasao-mt-oficial.png";
// Versão clara (misturada com branco) do brasão da APMCV, só pra usar como
// marca d'água atrás do texto — a biblioteca de geração de Word não tem
// controle de opacidade/transparência de imagem, então a única forma de
// deixar mais claro (como no modelo original) é pré-processar o arquivo.
const BRASAO_APMCV_MARCA_DAGUA_URL = "/brasao-apmcv-marca-dagua.png";
const SELO_REPUBLICA_URL = "/selo-republica-federativa.jpg";
const COR_VERMELHA = "FF0000";
const PLACEHOLDER = "______";

const FONTE_TITULO = "Algerian";
const FONTE_CORPO = "Old English Text MT";
const FONTE_VERSO = "Times New Roman";

const UF_NOMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia",
  CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás",
  MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí",
  RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo",
  SE: "Sergipe", TO: "Tocantins",
};

/** "Cuiabá-MT" -> { cidade: "Cuiabá", estado: "Mato Grosso" }; null se não bater o padrão. */
function separarNaturalidade(naturalidade: string | null): { cidade: string; estado: string } | null {
  if (!naturalidade) return null;
  const m = naturalidade.trim().match(/^(.+?)\s*-\s*([A-Za-z]{2})$/);
  if (!m) return null;
  const estado = UF_NOMES[m[2].toUpperCase()];
  return estado ? { cidade: m[1].trim(), estado } : null;
}

export interface DadosExportacaoDiploma {
  nomeAluno: string;
  filiacaoPai: string | null;
  filiacaoMae: string | null;
  rgPm: string | null;
  dataNascimento: string | null; // já formatada dd/mm/aaaa
  naturalidade: string | null; // ex: "Cuiabá-MT"
  temaTcc: string | null;
  dataApresentacaoTcc: string | null; // já formatada por extenso, ex: "25 de agosto de 2026"
  dataConclusaoCurso: string | null; // já formatada — data de colação de grau
  comandanteNome: string | null;
  comandantePosto: string | null;
  responsavelNome: string;
  responsavelPosto: string;
  dataEmissao: string; // já formatada por extenso
}

function nomeArquivo(dados: DadosExportacaoDiploma) {
  return `diploma_${dados.nomeAluno}`.replace(/\s+/g, "_") + ".docx";
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function txt(texto: string, opts: { size: number; font?: string; bold?: boolean; color?: string } = { size: 36 }): TextRun {
  return new TextRun({ text: texto, font: opts.font ?? FONTE_CORPO, size: opts.size, bold: opts.bold, color: opts.color });
}

function vermelho(valor: string | null, opts: { size: number; font?: string }): TextRun {
  return txt(valor && valor.trim() ? valor : PLACEHOLDER, { ...opts, color: COR_VERMELHA });
}

const SEM_BORDA = TableBorders.NONE;

export async function exportarDiplomaWord(dados: DadosExportacaoDiploma) {
  const [brasaoMt, brasaoPmmt, brasaoApmcv, seloRepublica] = await Promise.all([
    carregarImagemBrasao(BRASAO_MT_URL),
    carregarImagemBrasao(BRASAO_PMMT_URL),
    carregarImagemBrasao(BRASAO_APMCV_MARCA_DAGUA_URL),
    carregarImagemBrasao(SELO_REPUBLICA_URL),
  ]);
  const natural = separarNaturalidade(dados.naturalidade);

  // As 3 imagens da frente (brasão de MT à esquerda, brasão da PMMT à
  // direita, e o brasão grande da APMCV como marca d'água atrás do corpo do
  // texto) ficam ANCORADAS — behindDoc, sem quebra de texto — com os MESMOS
  // deslocamentos (em EMU, relativos à "coluna") conferidos no XML do
  // modelo original. Como nossa página usa a mesma largura e as mesmas
  // margens do modelo (conferidas antes), a largura da "coluna" bate exata,
  // então os números do original podem ser reaproveitados direto, sem
  // conversão. Descoberta em 05/09/2026: o brasão da esquerda é o do
  // ESTADO DE MATO GROSSO (não da PMMT como eu tinha colocado antes), e o
  // brasão da APMCV nunca era um logo pequeno de canto — é a marca d'água
  // grande atrás do título/corpo, que também tinha ficado de fora.
  const imagemFundo = (
    img: typeof brasaoMt,
    opts: { offsetH: number; offsetV: number; width: number; height: number }
  ) =>
    img
      ? new ImageRun({
          data: img.bytes,
          type: img.formato,
          transformation: { width: opts.width, height: opts.height },
          floating: {
            horizontalPosition: { relative: HorizontalPositionRelativeFrom.COLUMN, offset: opts.offsetH },
            verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: opts.offsetV },
            wrap: { type: TextWrappingType.NONE },
            allowOverlap: true,
            behindDocument: true,
          },
        })
      : null;

  const cabecalhoLinhas = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        ...(brasaoMt ? [imagemFundo(brasaoMt, { offsetH: 40640, offsetV: 59055, width: 116, height: 113 })!] : []),
        ...(brasaoPmmt ? [imagemFundo(brasaoPmmt, { offsetH: 8491220, offsetV: 106680, width: 102, height: 113 })!] : []),
        ...(brasaoApmcv ? [imagemFundo(brasaoApmcv, { offsetH: 2583815, offsetV: 153035, width: 435, height: 419 })!] : []),
        txt("ESTADO DE MATO GROSSO", { size: 34, font: FONTE_TITULO }),
      ],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [txt("SECRETARIA DE ESTADO DE SEGURANÇA PÚBLICA", { size: 34, font: FONTE_TITULO })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [txt("POLÍCIA MILITAR", { size: 34, font: FONTE_TITULO })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [txt("DIRETORIA DE ENSINO, INSTRUÇÃO E PESQUISA", { size: 34, font: FONTE_TITULO })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [txt("ACADEMIA DE POLÍCIA MILITAR COSTA VERDE", { size: 34, font: FONTE_TITULO })] }),
  ];

  // Assinaturas da frente: réplica exata do modelo original — descobri
  // inspecionando o XML do .doc real que essa linha NÃO é uma tabela com
  // alinhamento nenhum: são 3 parágrafos soltos, cada um com espaços
  // literais digitados na MESMA fonte/tamanho do corpo (Old English Text
  // MT), sem "w:jc" de centralizar/direita — a posição de cada trecho vem
  // só da largura acumulada dos espaços/caracteres anteriores nessa fonte.
  // Reproduzindo os mesmos espaços na mesma fonte, a posição fica idêntica
  // à do original (contei os espaços exatos por script no XML):
  //   linha 1: 9 espaços(10pt) + 16 "_"(18pt) + 58 espaços + 35 "_" + 6 espaços
  //   linha 2: 14 espaços + "Bacharel" + 68 espaços + nome(vermelho,17,5pt) + "-" + posto(vermelho,17,5pt)
  //   linha 3: 123 espaços(16pt) + "Comandante da APMCV"(16pt)
  const esp = (n: number, tamanho: number) => txt(" ".repeat(n), { size: tamanho });
  const linhaAssinaturasFrente = [
    new Paragraph({
      children: [esp(9, 20), txt("_".repeat(16), { size: 36 }), esp(58, 36), txt("_".repeat(35), { size: 36 }), esp(6, 36)],
    }),
    new Paragraph({
      children: [
        esp(14, 36),
        txt(`Bacharel${" ".repeat(68)}`, { size: 36 }),
        vermelho(dados.comandanteNome, { size: 35 }),
        txt("-", { size: 35 }),
        vermelho(dados.comandantePosto, { size: 35 }),
      ],
    }),
    new Paragraph({ children: [esp(123, 32), txt("Comandante da APMCV", { size: 32 })] }),
  ];

  // --- Verso (página 2) — 5 CAIXAS INDEPENDENTES, não uma tabela 2x2.
  // Conferido no modelo original: cada bloco é uma caixa com borda própria
  // e um espaço visível entre elas (não bordas compartilhadas de uma
  // grade) — 3 caixas empilhadas na coluna esquerda, 2 na direita.
  const bordaFina = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const bordaTransparente = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const bordasInvisiveis = { top: bordaTransparente, bottom: bordaTransparente, left: bordaTransparente, right: bordaTransparente };
  const p2 = (texto: string, opts: { bold?: boolean } = {}) =>
    new Paragraph({ children: [new TextRun({ text: texto, font: FONTE_VERSO, size: 22, bold: opts.bold })] });
  const p2Vermelho = (texto: string | null) =>
    new Paragraph({ children: [new TextRun({ text: texto && texto.trim() ? texto : PLACEHOLDER, font: FONTE_VERSO, size: 22, color: COR_VERMELHA })] });

  // Uma "caixa" = uma tabela de 1 célula só, com borda própria nos 4 lados —
  // por isso fica visualmente independente das outras, com espaço em volta.
  const caixaIndependente = (children: Paragraph[]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: bordaFina, bottom: bordaFina, left: bordaFina, right: bordaFina },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              margins: { top: 150, bottom: 150, left: 150, right: 150 },
              // IMPORTANTE: não sobrescrever a borda da célula aqui. Cada
              // caixa agora é uma tabela de 1 célula só (não mais uma
              // grade 2x2 com bordas compartilhadas) — se a célula
              // definir sua própria borda como "invisível", isso ANULA a
              // borda da tabela (borda de célula tem prioridade sobre a
              // borda da tabela na especificação OOXML). O Word aplica
              // essa prioridade à risca e a borda simplesmente some; o
              // LibreOffice é mais tolerante e mostrava a borda mesmo
              // assim, por isso o bug só aparecia no Word real.
              children,
            }),
          ],
        }),
      ],
    });
  const espaco = () => new Paragraph({ spacing: { before: 160, after: 160 }, children: [] });

  const caixaEnsinoMilitar = caixaIndependente([
    p2("Ensino Militar – Autonomia", { bold: true }),
    p2("Art. 83 da Lei nº 9394, de 20 Dez 96 (LDB) (DOU nº 248, de 23 Dez 96). LC nº 408, de 01 Jul 10 (Lei de Ensino da PMMT) (DOE nº 25348, 01 Jul 10)."),
  ]);
  const caixaAcademiaCriacao = caixaIndependente([
    p2("Academia de Polícia Militar Costa Verde", { bold: true }),
    p2("Criação: Lei nº 5177 de 27 Nov 87 (DOE nº 19.831, de 27 Nov 87)."),
    p2("Ativação: Decreto nº 3145 de 06 Jul 93 (DOE nº 21.202, de 06 Jul 93)."),
    p2("Credenciamento IES: Art. 3º do Decreto nº 3144, de 06 Jul 93 (DOE nº 21.202, de 06 Jul 93); Art. 1º da Port. Conj. nº. 07/SECITEC/SESP de 06 Mar 12 (DOE nº 25764, de 15 Mar 12)."),
  ]);
  const caixaCursoFormacao = caixaIndependente([
    p2("Curso de Formação de Oficiais", { bold: true }),
    p2("Inciso III, Art. 10 da Lei Complementar nº 408, de 01 Jul 10 (LEPM) (DOE nº 25348 de 01 Jul 10)."),
    p2("Reconhecimento/Equivalência", { bold: true }),
    p2("Parecer nº 049 de 22 Dez 00 - C.E.E/MT."),
    p2("Modalidade Bacharel em Segurança Pública", { bold: true }),
    p2("Parecer nº 428 de 09 Dez 03 - C.E.E/MT."),
    p2("Trabalho de Conclusão de Curso", { bold: true }),
    p2Vermelho(dados.temaTcc),
    new Paragraph({
      children: [
        new TextRun({ text: "Monografia apresentada ", font: FONTE_VERSO, size: 22, bold: true }),
        new TextRun({ text: dados.dataApresentacaoTcc ?? PLACEHOLDER, font: FONTE_VERSO, size: 22, bold: true, color: dados.dataApresentacaoTcc ? undefined : COR_VERMELHA }),
        new TextRun({ text: ", Nota ", font: FONTE_VERSO, size: 22, bold: true }),
        new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 22, bold: true, color: COR_VERMELHA }),
        new TextRun({ text: ".", font: FONTE_VERSO, size: 22, bold: true }),
      ],
    }),
  ]);
  const caixaDiplomaRegistrado = caixaIndependente([
    p2("Academia de Polícia Militar Costa Verde", { bold: true }),
    new Paragraph({
      children: [
        new TextRun({ text: "Diploma registrado sob o nº ", font: FONTE_VERSO, size: 22 }),
        new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 22, color: COR_VERMELHA }),
        new TextRun({ text: ", do Livro nº ", font: FONTE_VERSO, size: 22 }),
        new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 22, color: COR_VERMELHA }),
        new TextRun({ text: ", folha nº ", font: FONTE_VERSO, size: 22 }),
        new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 22, color: COR_VERMELHA }),
        new TextRun({ text: ". Processo nº ", font: FONTE_VERSO, size: 22 }),
        new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 22, color: COR_VERMELHA }),
        new TextRun({ text: ".", font: FONTE_VERSO, size: 22 }),
      ],
    }),
    p2(""),
    p2(`Quartel da APMCV, em Várzea Grande-MT, ${dados.dataEmissao}.`),
    p2(""),
    p2("_________________________________"),
    new Paragraph({
      children: [
        vermelho(dados.responsavelNome, { size: 22, font: FONTE_VERSO }),
        new TextRun({ text: " – ", font: FONTE_VERSO, size: 22 }),
        vermelho(dados.responsavelPosto, { size: 22, font: FONTE_VERSO }),
      ],
    }),
    p2("Gerente Subalterno da Secretaria de Registros/APM"),
  ]);
  const caixaApostilamento = caixaIndependente([
    p2("Diretoria de Ensino, Instrução e Pesquisa/PMMT", { bold: true }),
    new Paragraph({
      children: [
        new TextRun({ text: "Registro de Apostilamento sob nº ", font: FONTE_VERSO, size: 22 }),
        new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 22, color: COR_VERMELHA }),
        new TextRun({ text: ", do Livro nº ", font: FONTE_VERSO, size: 22 }),
        new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 22, color: COR_VERMELHA }),
        new TextRun({ text: ", folha nº ", font: FONTE_VERSO, size: 22 }),
        new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 22, color: COR_VERMELHA }),
        new TextRun({ text: ". Processo nº ", font: FONTE_VERSO, size: 22 }),
        new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 22, color: COR_VERMELHA }),
        new TextRun({ text: ".", font: FONTE_VERSO, size: 22 }),
      ],
    }),
    p2(""),
    p2(`DEIP/PMMT, em Cuiabá-MT, ${dados.dataEmissao}.`),
    p2(""),
    p2("_________________________________"),
    p2Vermelho(null),
    p2("Diretor da DEIP"),
  ]);

  // Container externo sem borda, só pra criar as 2 colunas — cada coluna
  // tem sua pilha própria de caixas independentes (3 à esquerda, 2 à
  // direita), com espaço entre elas.
  const grade = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: SEM_BORDA,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: { top: 0, bottom: 0, left: 0, right: 100 },
            borders: bordasInvisiveis,
            children: [caixaEnsinoMilitar, espaco(), caixaAcademiaCriacao, espaco(), caixaCursoFormacao],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: { top: 0, bottom: 0, left: 100, right: 0 },
            borders: bordasInvisiveis,
            children: [caixaDiplomaRegistrado, espaco(), caixaApostilamento],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            // A4 paisagem — igual ao modelo original (dimensões reais do
            // .doc: 16838x11906 twips = A4 landscape). A biblioteca "docx"
            // já inverte width/height sozinha quando orientation=LANDSCAPE,
            // então aqui passamos os valores "de retrato" (11906x16838) —
            // passar já invertido cancela a inversão e volta pra retrato.
            size: { orientation: PageOrientation.LANDSCAPE, width: 11906, height: 16838 },
            // Margens do modelo original (conferidas no XML: 360045x540385
            // EMU = 567x851 twips) — bem mais justas que o padrão do Word
            // (1 polegada). Sem isso, o conteúdo real (com nomes/temas de
            // TCC mais longos que o exemplo do modelo) estourava pra 3
            // páginas em vez de 2.
            margin: { top: 567, bottom: 567, left: 851, right: 851 },
            borders: {
              pageBorders: { display: PageBorderDisplay.ALL_PAGES, offsetFrom: PageBorderOffsetFrom.TEXT },
              // "space" = distância entre a borda e o texto, em pontos —
              // conferido no XML do modelo: 4pt em cima/embaixo, mas 18pt
              // nas laterais (bem mais afastado do texto do que eu tinha
              // colocado antes, que não tinha "space" nenhum).
              pageBorderTop: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 4 },
              pageBorderBottom: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 4 },
              pageBorderLeft: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 18 },
              pageBorderRight: { style: BorderStyle.SINGLE, size: 4, color: "000000", space: 18 },
            },
          },
        },
        children: [
          ...cabecalhoLinhas,
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [txt("DIPLOMA", { size: 60, font: FONTE_CORPO })],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              txt("O Comandante da Academia de Policia Militar Costa Verde, no uso de suas atribuições e tendo em vista a conclusão do Curso de Formação de Oficiais da PMMT, Bacharelado em Segurança Pública em ", { size: 36 }),
              vermelho(dados.dataConclusaoCurso, { size: 36 }),
              txt(", confere o Título de Bacharel em Segurança Pública a", { size: 36 }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [vermelho(dados.nomeAluno, { size: 50, font: FONTE_TITULO }), txt(",", { size: 50, font: FONTE_TITULO })],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              txt("Filho(a) de ", { size: 36 }),
              vermelho(dados.filiacaoPai, { size: 36 }),
              txt(" e ", { size: 36 }),
              vermelho(dados.filiacaoMae, { size: 36 }),
              txt(", identidade ", { size: 36 }),
              vermelho(dados.rgPm, { size: 36 }),
              txt(" PMMT, nascido(a) em ", { size: 36 }),
              vermelho(dados.dataNascimento, { size: 36 }),
              txt(", em ", { size: 36 }),
              vermelho(natural?.cidade ?? dados.naturalidade, { size: 36 }),
              txt(", Estado de ", { size: 36 }),
              vermelho(natural?.estado ?? null, { size: 36 }),
              txt(", e outorga-lhe o Presente Diploma, a fim de que possa gozar de todos os direitos e prerrogativas legais.", { size: 36 }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              // Selo da República — no modelo original fica ATRÁS do texto
              // (behindDocument), como marca d'água, ancorado nesta mesma
              // linha ("Várzea Grande - MT, ...").
              ...(seloRepublica
                ? [
                    new ImageRun({
                      data: seloRepublica.bytes,
                      type: seloRepublica.formato,
                      transformation: { width: 126, height: 126 },
                      floating: {
                        horizontalPosition: { relative: HorizontalPositionRelativeFrom.COLUMN, offset: 4260215 },
                        verticalPosition: { relative: VerticalPositionRelativeFrom.PARAGRAPH, offset: 331470 },
                        wrap: { type: TextWrappingType.NONE },
                        allowOverlap: true,
                        behindDocument: true,
                      },
                    }),
                  ]
                : []),
              txt("Várzea Grande - MT, ", { size: 36 }),
              vermelho(dados.dataEmissao, { size: 36 }),
              txt(".", { size: 36 }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          ...linhaAssinaturasFrente,
          new Paragraph({ children: [new PageBreak()] }),
          grade,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, nomeArquivo(dados));
}
