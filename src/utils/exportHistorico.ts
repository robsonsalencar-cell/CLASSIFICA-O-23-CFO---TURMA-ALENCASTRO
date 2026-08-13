import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  TextRun,
  ImageRun,
  AlignmentType,
  WidthType,
} from "docx";
import {
  TEXTO_INSTITUCIONAL_HISTORICO,
  TEXTO_LEGAL_ABERTURA,
  TEXTO_LEGAL_ADMISSAO,
  TEXTO_LEGAL_FECHAMENTO,
  BRASAO_OFICIAL_APMCV_URL,
} from "@/config/documentosOficiais";
import { notaPorExtenso } from "@/utils/numeroExtenso";
import { carregarImagemBrasao } from "@/utils/brasaoImagem";

const COR_VERMELHA = "FF0000";
const PLACEHOLDER = "______";

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
  matricula: string | null;
  matriculaAcademia: string | null; // campo vermelho
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
  dataEmissao: string; // já formatada por extenso, ex: "11 de agosto de 2026"
}

/**
 * Cruza a lista oficial de disciplinas de um ano (MATERIAS_CFO1/2/3) com a
 * carga horária (CARGA_HORARIA_CFO1/2/3) e as notas já lançadas
 * (gradesDetalhado de ClassificacaoGeral.tsx, cujas chaves têm o sufixo
 * " (CFO I)"/" (CFO II)"/" (CFO III)").
 */
export function montarDisciplinasHistorico(
  materias: string[],
  cargaHoraria: Record<string, number>,
  detalhado: Record<string, { nota_final: number | null }>,
  prefixo: string
): DisciplinaHistorico[] {
  return materias.map((nome) => ({
    nome,
    cargaHoraria: cargaHoraria[nome] ?? 0,
    mediaFinal: detalhado[`${nome} (${prefixo})`]?.nota_final ?? null,
  }));
}

function nf(v: number | null): string {
  return v != null ? v.toFixed(3) : "";
}

function nomeArquivo(dados: DadosExportacaoHistorico, extensao: string) {
  const base = `historico_${dados.nomeAluno}`.replace(/\s+/g, "_");
  return `${base}.${extensao}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// --- Word ---

function runTexto(texto: string): TextRun {
  return new TextRun({ text: texto });
}

function runVermelho(valor: string | null): TextRun {
  return new TextRun({ text: valor && valor.trim() ? valor : PLACEHOLDER, color: COR_VERMELHA });
}

function paragrafoAbertura(dados: DadosExportacaoHistorico): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    children: [
      runTexto(TEXTO_LEGAL_ABERTURA + " "),
      runTexto(`${dados.nomeAluno}, brasileiro(a), filho(a) de `),
      runVermelho(dados.filiacaoPai),
      runTexto(" e "),
      runVermelho(dados.filiacaoMae),
      runTexto(", nascido(a) em "),
      runVermelho(dados.dataNascimento),
      runTexto(", natural de "),
      runVermelho(dados.naturalidade),
      runTexto(", matriculado(a) nesta Academia de Polícia Militar Costa Verde sob o número "),
      runVermelho(dados.matriculaAcademia),
      runTexto(" RG PMMT "),
      runVermelho(dados.rgPm),
      runTexto(`, ${TEXTO_LEGAL_ADMISSAO} no(a) `),
      runVermelho(dados.escolaAnterior),
      runTexto(", no ano de "),
      runVermelho(dados.anoConclusaoEnsinoMedio),
      runTexto(
        ", concluiu com aproveitamento o CURSO DE FORMAÇÃO DE OFICIAIS POLICIAIS MILITARES – CFO."
      ),
    ],
  });
}

function tabelaAno(
  titulo: string,
  anoLetivo: string | null,
  disciplinas: DisciplinaHistorico[],
  media: number | null
): (Paragraph | DocxTable)[] {
  const headerCell = (texto: string) =>
    new DocxTableCell({ children: [new Paragraph({ text: texto, alignment: AlignmentType.CENTER })] });
  const bodyCell = (texto: string) => new DocxTableCell({ children: [new Paragraph({ text: texto })] });
  const bodyCellBold = (texto: string) =>
    new DocxTableCell({ children: [new Paragraph({ children: [new TextRun({ text: texto, bold: true })] })] });

  const somaCargaHoraria = disciplinas.reduce((total, d) => total + d.cargaHoraria, 0);

  const tabela = new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new DocxTableRow({ children: ["Disciplina", "Carga Horária", "Média Final"].map(headerCell) }),
      ...disciplinas.map(
        (d) =>
          new DocxTableRow({
            children: [d.nome, String(d.cargaHoraria), nf(d.mediaFinal) || PLACEHOLDER].map(bodyCell),
          })
      ),
      new DocxTableRow({
        children: [
          bodyCellBold("Total da Carga Curricular e Média"),
          bodyCellBold(String(somaCargaHoraria)),
          bodyCellBold(nf(media) || PLACEHOLDER),
        ],
      }),
    ],
  });

  return [
    new Paragraph({
      children: [new TextRun({ text: `${titulo}${anoLetivo ? ` — ${anoLetivo}` : ""}`, bold: true })],
    }),
    tabela,
    new Paragraph({ text: "" }),
  ];
}

export async function exportarHistoricoWord(dados: DadosExportacaoHistorico) {
  const brasao = await carregarImagemBrasao(BRASAO_OFICIAL_APMCV_URL);
  const doc = new Document({
    sections: [
      {
        children: [
          ...(brasao
            ? [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new ImageRun({
                      data: brasao.bytes,
                      type: brasao.formato,
                      transformation: { width: 90, height: 90 },
                    }),
                  ],
                }),
              ]
            : []),
          new Paragraph({ text: TEXTO_INSTITUCIONAL_HISTORICO.linha1, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL_HISTORICO.linha2, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL_HISTORICO.linha3, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL_HISTORICO.linhaDiretoria, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL_HISTORICO.linha4, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL_HISTORICO.linha5, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "HISTÓRICO ESCOLAR", bold: true, size: 28 })],
          }),
          new Paragraph({ text: "" }),
          paragrafoAbertura(dados),
          new Paragraph({ text: "" }),
          ...tabelaAno("1º Ano CFO", dados.anoLetivoCfo1, dados.disciplinasCfo1, dados.mediaCfo1),
          ...tabelaAno("2º Ano CFO", dados.anoLetivoCfo2, dados.disciplinasCfo2, dados.mediaCfo2),
          ...tabelaAno("3º Ano CFO", dados.anoLetivoCfo3, dados.disciplinasCfo3, dados.mediaCfo3),
          new Paragraph({ text: `Registro nº: ${dados.numeroRegistro}` }),
          new Paragraph({
            text: `Nota de Aprovação: ${dados.mediaFinal.toFixed(3)} (${notaPorExtenso(dados.mediaFinal)})`,
          }),
          new Paragraph({ text: `Classificação: ${dados.rank ?? "—"}º Lugar` }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: TEXTO_LEGAL_FECHAMENTO, alignment: AlignmentType.JUSTIFIED }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: `APMCV em Várzea Grande-MT, ${dados.dataEmissao}.` }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: dados.responsavelNome.toUpperCase(), alignment: AlignmentType.CENTER }),
          new Paragraph({
            text: `${dados.responsavelPosto} — ${dados.responsavelFuncao}`,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [runVermelho(dados.comandanteNome?.toUpperCase() ?? null)],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [runVermelho(dados.comandantePosto), runTexto(" — Comandante da APMCV")],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, nomeArquivo(dados, "docx"));
}

// --- Excel ---

export function exportarHistoricoExcel(dados: DadosExportacaoHistorico) {
  const wb = XLSX.utils.book_new();

  const abaDados = [
    [TEXTO_INSTITUCIONAL_HISTORICO.linha1],
    [TEXTO_INSTITUCIONAL_HISTORICO.linha2],
    [TEXTO_INSTITUCIONAL_HISTORICO.linha3],
    [TEXTO_INSTITUCIONAL_HISTORICO.linhaDiretoria],
    [TEXTO_INSTITUCIONAL_HISTORICO.linha4],
    [TEXTO_INSTITUCIONAL_HISTORICO.linha5],
    [],
    ["HISTÓRICO ESCOLAR"],
    [],
    ["Nome do aluno", dados.nomeAluno],
    ["Matrícula", dados.matricula ?? "—"],
    ["Matrícula na Academia", dados.matriculaAcademia ?? "—"],
    ["RG PMMT", dados.rgPm ?? "—"],
    ["Filiação (pai)", dados.filiacaoPai ?? "—"],
    ["Filiação (mãe)", dados.filiacaoMae ?? "—"],
    ["Data de nascimento", dados.dataNascimento ?? "—"],
    ["Naturalidade", dados.naturalidade ?? "—"],
    ["Escola anterior", dados.escolaAnterior ?? "—"],
    ["Ano de conclusão do 2º grau", dados.anoConclusaoEnsinoMedio ?? "—"],
    [],
    ["Registro nº", dados.numeroRegistro],
    ["Nota de Aprovação", `${dados.mediaFinal.toFixed(3)} (${notaPorExtenso(dados.mediaFinal)})`],
    ["Classificação", `${dados.rank ?? "—"}º Lugar`],
    [],
    ["Emitido em", dados.dataEmissao],
    [dados.responsavelNome, `${dados.responsavelPosto} — ${dados.responsavelFuncao}`],
    [dados.comandanteNome ?? "—", dados.comandantePosto ?? "—"],
  ];
  const wsDados = XLSX.utils.aoa_to_sheet(abaDados);
  XLSX.utils.book_append_sheet(wb, wsDados, "Dados");

  function abaAno(nomeAba: string, disciplinas: DisciplinaHistorico[], media: number | null) {
    const linhas = [
      ["Disciplina", "Carga Horária", "Média Final"],
      ...disciplinas.map((d) => [d.nome, d.cargaHoraria, d.mediaFinal ?? ""]),
      [],
      [
        "Total da Carga Curricular e Média",
        disciplinas.reduce((total, d) => total + d.cargaHoraria, 0),
        media ?? "",
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    XLSX.utils.book_append_sheet(wb, ws, nomeAba);
  }
  abaAno("1º Ano", dados.disciplinasCfo1, dados.mediaCfo1);
  abaAno("2º Ano", dados.disciplinasCfo2, dados.mediaCfo2);
  abaAno("3º Ano", dados.disciplinasCfo3, dados.mediaCfo3);

  XLSX.writeFile(wb, nomeArquivo(dados, "xlsx"));
}
