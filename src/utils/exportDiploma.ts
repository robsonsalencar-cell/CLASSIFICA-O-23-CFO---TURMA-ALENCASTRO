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
  HorizontalPositionAlign,
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
const BRASAO_APMCV_URL = "/brasao-apmcv-oficial.png";
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
  const [brasaoPmmt, brasaoApmcv] = await Promise.all([
    carregarImagemBrasao(BRASAO_PMMT_URL),
    carregarImagemBrasao(BRASAO_APMCV_URL),
  ]);
  const natural = separarNaturalidade(dados.naturalidade);

  // Os 2 brasões ficam ANCORADOS nos cantos superiores (flutuantes, fora do
  // fluxo do texto) — não numa tabela — porque o cabeçalho ocupa a largura
  // toda da página no modelo original; colocá-los numa tabela de 3 colunas
  // espremia o texto e fazia tudo quebrar em várias linhas (estourando de 2
  // pra 4 páginas na primeira tentativa).
  const imagemAncorada = (img: typeof brasaoPmmt, lado: (typeof HorizontalPositionAlign)[keyof typeof HorizontalPositionAlign]) =>
    img
      ? new ImageRun({
          data: img.bytes,
          type: img.formato,
          transformation: { width: 75, height: 75 },
          floating: {
            horizontalPosition: { relative: HorizontalPositionRelativeFrom.MARGIN, align: lado },
            verticalPosition: { relative: VerticalPositionRelativeFrom.MARGIN, offset: 150000 },
            wrap: { type: TextWrappingType.SQUARE },
            allowOverlap: false,
            margins: { left: 100000, right: 100000 },
          },
        })
      : null;

  const cabecalhoLinhas = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        ...(brasaoPmmt ? [imagemAncorada(brasaoPmmt, HorizontalPositionAlign.LEFT)!] : []),
        ...(brasaoApmcv ? [imagemAncorada(brasaoApmcv, HorizontalPositionAlign.RIGHT)!] : []),
        txt("ESTADO DE MATO GROSSO", { size: 34, font: FONTE_TITULO }),
      ],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [txt("SECRETARIA DE ESTADO DE SEGURANÇA PÚBLICA", { size: 34, font: FONTE_TITULO })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [txt("POLÍCIA MILITAR", { size: 34, font: FONTE_TITULO })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [txt("DIRETORIA DE ENSINO, INSTRUÇÃO E PESQUISA", { size: 34, font: FONTE_TITULO })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [txt("ACADEMIA DE POLÍCIA MILITAR COSTA VERDE", { size: 34, font: FONTE_TITULO })] }),
  ];

  // Assinaturas da frente: Bacharel (o próprio formando) | Comandante da APMCV
  const linhaAssinaturasFrente = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: SEM_BORDA,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [txt("________________", { size: 36 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [txt("Bacharel", { size: 36 })] }),
            ],
          }),
          new TableCell({
            width: { size: 65, type: WidthType.PERCENTAGE },
            borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [txt("_______________________________", { size: 36 })] }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [vermelho(dados.comandanteNome, { size: 35 }), txt(" - ", { size: 35 }), vermelho(dados.comandantePosto, { size: 35 })],
              }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [txt("Comandante da APMCV", { size: 32 })] }),
            ],
          }),
        ],
      }),
    ],
  });

  // --- Verso (página 2) — grade 2x2 com borda ---
  const bordaFina = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const bordasCaixa = { top: bordaFina, bottom: bordaFina, left: bordaFina, right: bordaFina };
  const p2 = (texto: string, opts: { bold?: boolean } = {}) =>
    new Paragraph({ children: [new TextRun({ text: texto, font: FONTE_VERSO, size: 18, bold: opts.bold })] });
  const p2Vermelho = (texto: string | null) =>
    new Paragraph({ children: [new TextRun({ text: texto && texto.trim() ? texto : PLACEHOLDER, font: FONTE_VERSO, size: 18, color: COR_VERMELHA })] });
  const caixa = (children: Paragraph[]) =>
    new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, margins: { top: 150, bottom: 150, left: 150, right: 150 }, borders: bordasCaixa, children });

  const grade = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: bordaFina, bottom: bordaFina, left: bordaFina, right: bordaFina, insideHorizontal: bordaFina, insideVertical: bordaFina },
    rows: [
      new TableRow({
        children: [
          caixa([
            p2("Ensino Militar – Autonomia", { bold: true }),
            p2("Art. 83 da Lei nº 9394, de 20 Dez 96 (LDB) (DOU nº 248, de 23 Dez 96). LC nº 408, de 01 Jul 10 (Lei de Ensino da PMMT) (DOE nº 25348, 01 Jul 10)."),
            p2(""),
            p2("Academia de Polícia Militar Costa Verde", { bold: true }),
            p2("Criação: Lei nº 5177 de 27 Nov 87 (DOE nº 19.831, de 27 Nov 87)."),
            p2("Ativação: Decreto nº 3145 de 06 Jul 93 (DOE nº 21.202, de 06 Jul 93)."),
            p2("Credenciamento IES: Art. 3º do Decreto nº 3144, de 06 Jul 93 (DOE nº 21.202, de 06 Jul 93); Art. 1º da Port. Conj. nº. 07/SECITEC/SESP de 06 Mar 12 (DOE nº 25764, de 15 Mar 12)."),
          ]),
          caixa([
            p2("Academia de Polícia Militar Costa Verde", { bold: true }),
            new Paragraph({
              children: [
                new TextRun({ text: "Diploma registrado sob o nº ", font: FONTE_VERSO, size: 18 }),
                new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 18, color: COR_VERMELHA }),
                new TextRun({ text: ", do Livro nº ", font: FONTE_VERSO, size: 18 }),
                new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 18, color: COR_VERMELHA }),
                new TextRun({ text: ", folha nº ", font: FONTE_VERSO, size: 18 }),
                new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 18, color: COR_VERMELHA }),
                new TextRun({ text: ". Processo nº ", font: FONTE_VERSO, size: 18 }),
                new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 18, color: COR_VERMELHA }),
                new TextRun({ text: ".", font: FONTE_VERSO, size: 18 }),
              ],
            }),
            p2(""),
            p2(`Quartel da APMCV, em Várzea Grande-MT, ${dados.dataEmissao}.`),
            p2(""),
            p2("_________________________________"),
            new Paragraph({
              children: [
                vermelho(dados.responsavelNome, { size: 18, font: FONTE_VERSO }),
                new TextRun({ text: " – ", font: FONTE_VERSO, size: 18 }),
                vermelho(dados.responsavelPosto, { size: 18, font: FONTE_VERSO }),
              ],
            }),
            p2("Gerente Subalterno da Secretaria de Registros/APM"),
          ]),
        ],
      }),
      new TableRow({
        children: [
          caixa([
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
                new TextRun({ text: "Monografia apresentada ", font: FONTE_VERSO, size: 18, bold: true }),
                new TextRun({ text: dados.dataApresentacaoTcc ?? PLACEHOLDER, font: FONTE_VERSO, size: 18, bold: true, color: dados.dataApresentacaoTcc ? undefined : COR_VERMELHA }),
                new TextRun({ text: ", Nota ", font: FONTE_VERSO, size: 18, bold: true }),
                new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 18, bold: true, color: COR_VERMELHA }),
                new TextRun({ text: ".", font: FONTE_VERSO, size: 18, bold: true }),
              ],
            }),
          ]),
          caixa([
            p2("Diretoria de Ensino, Instrução e Pesquisa/PMMT", { bold: true }),
            new Paragraph({
              children: [
                new TextRun({ text: "Registro de Apostilamento sob nº ", font: FONTE_VERSO, size: 18 }),
                new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 18, color: COR_VERMELHA }),
                new TextRun({ text: ", do Livro nº ", font: FONTE_VERSO, size: 18 }),
                new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 18, color: COR_VERMELHA }),
                new TextRun({ text: ", folha nº ", font: FONTE_VERSO, size: 18 }),
                new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 18, color: COR_VERMELHA }),
                new TextRun({ text: ". Processo nº ", font: FONTE_VERSO, size: 18 }),
                new TextRun({ text: PLACEHOLDER, font: FONTE_VERSO, size: 18, color: COR_VERMELHA }),
                new TextRun({ text: ".", font: FONTE_VERSO, size: 18 }),
              ],
            }),
            p2(""),
            p2(`DEIP/PMMT, em Cuiabá-MT, ${dados.dataEmissao}.`),
            p2(""),
            p2("_________________________________"),
            p2Vermelho(null),
            p2("Diretor da DEIP"),
          ]),
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
            borders: {
              pageBorders: { display: PageBorderDisplay.ALL_PAGES, offsetFrom: PageBorderOffsetFrom.TEXT },
              pageBorderTop: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
              pageBorderBottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
              pageBorderLeft: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
              pageBorderRight: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
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
            children: [txt("Várzea Grande - MT, ", { size: 36 }), vermelho(dados.dataEmissao, { size: 36 }), txt(".", { size: 36 })],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          linhaAssinaturasFrente,
          new Paragraph({ children: [new PageBreak()] }),
          grade,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, nomeArquivo(dados));
}
