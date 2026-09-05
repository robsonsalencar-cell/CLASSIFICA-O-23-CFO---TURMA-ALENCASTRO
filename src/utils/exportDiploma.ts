import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
} from "docx";
import { TEXTO_INSTITUCIONAL_HISTORICO, BRASAO_OFICIAL_APMCV_URL } from "@/config/documentosOficiais";
import { carregarImagemBrasao } from "@/utils/brasaoImagem";

const COR_VERMELHA = "FF0000";
const PLACEHOLDER = "______";

export interface DadosExportacaoDiploma {
  nomeAluno: string;
  filiacaoPai: string | null;
  filiacaoMae: string | null;
  rgPm: string | null;
  dataNascimento: string | null; // já formatada dd/mm/aaaa
  naturalidade: string | null; // ex: "Cuiabá-MT" — texto livre, não separamos cidade/estado
  temaTcc: string | null;
  dataApresentacaoTcc: string | null; // já formatada por extenso, ex: "25 de agosto de 2026"
  dataConclusaoCurso: string | null; // já formatada — data de colação de grau (Ata de Classificação Geral)
  comandanteNome: string | null; // campo vermelho se vazio
  comandantePosto: string | null; // campo vermelho se vazio
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

function runTexto(texto: string): TextRun {
  return new TextRun({ text: texto });
}

function runVermelho(valor: string | null): TextRun {
  return new TextRun({ text: valor && valor.trim() ? valor : PLACEHOLDER, color: COR_VERMELHA });
}

export async function exportarDiplomaWord(dados: DadosExportacaoDiploma) {
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
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "DIPLOMA", bold: true, size: 32 })],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              runTexto(
                "O Comandante da Academia de Policia Militar Costa Verde, no uso de suas atribuições e " +
                  "tendo em vista a conclusão do Curso de Formação de Oficiais da PMMT, Bacharelado em " +
                  "Segurança Pública em "
              ),
              runVermelho(dados.dataConclusaoCurso),
              runTexto(", confere o Título de Bacharel em Segurança Pública a"),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `${dados.nomeAluno},`, bold: true })],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              runTexto("Filho(a) de "),
              runVermelho(dados.filiacaoPai),
              runTexto(" e "),
              runVermelho(dados.filiacaoMae),
              runTexto(", identidade "),
              runVermelho(dados.rgPm),
              runTexto(" PMMT, nascido(a) em "),
              runVermelho(dados.dataNascimento),
              runTexto(", em "),
              runVermelho(dados.naturalidade),
              runTexto(
                ", e outorga-lhe o Presente Diploma, a fim de que possa gozar de todos os direitos e prerrogativas legais."
              ),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: `Várzea Grande - MT, ${dados.dataEmissao}.` }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              runVermelho(dados.comandanteNome),
              runTexto(" - "),
              runVermelho(dados.comandantePosto),
            ],
          }),
          new Paragraph({ text: "Comandante da APMCV", alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({
            text: "-----------------------",
          }),
          new Paragraph({
            text: "Ensino Militar - Autonomia",
          }),
          new Paragraph({
            text:
              "Art. 83 da Lei nº 9394, de 20 Dez 96 (LDB) (DOU nº 248, de 23 Dez 96). LC nº 408, de 01 Jul 10 " +
              "(Lei de Ensino da PMMT) (DOE nº 25348, 01 Jul 10).",
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "Academia de Polícia Militar Costa Verde" }),
          new Paragraph({
            children: [
              runTexto("Diploma registrado sob o nº "),
              runVermelho(null),
              runTexto(", do Livro nº "),
              runVermelho(null),
              runTexto(", folha nº "),
              runVermelho(null),
              runTexto(". Processo nº "),
              runVermelho(null),
              runTexto("."),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: `Quartel da APMCV, em Várzea Grande-MT, ${dados.dataEmissao}.` }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [runVermelho(dados.responsavelNome), runTexto(" - "), runVermelho(dados.responsavelPosto)],
          }),
          new Paragraph({
            text: "Gerente Subalterno da Secretaria de Registros/APM",
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "Academia de Polícia Militar Costa Verde" }),
          new Paragraph({
            text: "Criação: Lei nº 5177 de 27 Nov 87 (DOE nº 19.831, de 27 Nov 87).",
          }),
          new Paragraph({
            text: "Ativação: Decreto nº 3145 de 06 Jul 93 (DOE nº 21.202, de 06 Jul 93).",
          }),
          new Paragraph({
            text:
              "Credenciamento IES: Art. 3º do Decreto nº 3144, de 06 Jul 93 (DOE nº 21.202, de 06 Jul 93); " +
              "Art. 1º da Port. Conj. nº. 07/SECITEC/SESP de 06 Mar 12 (DOE nº 25764, de 15 Mar 12).",
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "Curso de Formação de Oficiais" }),
          new Paragraph({
            text:
              "Inciso III, Art. 10 da Lei Complementar nº 408, de 01 Jul 10 (LEPM) (DOE nº 25348 de 01 Jul 10).",
          }),
          new Paragraph({ text: "Reconhecimento/Equivalência" }),
          new Paragraph({ text: "Parecer nº 049 de 22 Dez 00 - C.E.E/MT." }),
          new Paragraph({ text: "Modalidade Bacharel em Segurança Pública" }),
          new Paragraph({ text: "Parecer nº 428 de 09 Dez 03 - C.E.E/MT." }),
          new Paragraph({ text: "Trabalho de Conclusão de Curso" }),
          new Paragraph({
            children: [runVermelho(dados.temaTcc)],
          }),
          new Paragraph({
            children: [
              runTexto("Monografia apresentada "),
              runVermelho(dados.dataApresentacaoTcc),
              runTexto(", Nota "),
              runVermelho(null),
              runTexto("."),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "Diretoria de Ensino, Instrução e Pesquisa/PMMT" }),
          new Paragraph({
            children: [
              runTexto("Registro de Apostilamento sob nº "),
              runVermelho(null),
              runTexto(", do Livro nº "),
              runVermelho(null),
              runTexto(", folha nº "),
              runVermelho(null),
              runTexto(". Processo nº "),
              runVermelho(null),
              runTexto("."),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: `DEIP/PMMT, em Cuiabá-MT, ${dados.dataEmissao}.` }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [runVermelho(null), runTexto(" - "), runVermelho(null)],
          }),
          new Paragraph({ text: "Diretor da DEIP", alignment: AlignmentType.CENTER }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, nomeArquivo(dados));
}
