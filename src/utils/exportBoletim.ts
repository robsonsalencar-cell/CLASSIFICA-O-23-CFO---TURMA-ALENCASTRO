import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  Document,
  Packer,
  Paragraph,
  Table as DocxTable,
  TableRow as DocxTableRow,
  TableCell as DocxTableCell,
  TextRun,
  AlignmentType,
  WidthType,
} from "docx";
import { DetalheMateria } from "@/hooks/useAlunosModulo";
import { TEXTO_INSTITUCIONAL } from "@/config/documentosOficiais";
import { MATERIAS_SOMA_VC } from "@/config/formulaNotas";

export interface DadosExportacaoBoletim {
  nomeAluno: string;
  matricula: string | null;
  nomeTurma: string;
  tituloModulo: string; // ex: "CFO I", "CFO II", "CFO III"
  anoLetivo: string | null;
  inicio: string; // digitado na hora da exportação, pode vir vazio
  termino: string; // digitado na hora da exportação, pode vir vazio
  mediaFinalModulo: number;
  gradesDetalhado: Record<string, DetalheMateria>;
  responsavelNome: string;
  responsavelPosto: string;
  responsavelFuncao: string;
}

function nf(v: number | null | undefined): string {
  return v != null ? v.toFixed(3) : "";
}

function linhasBoletim(dados: DadosExportacaoBoletim) {
  return Object.entries(dados.gradesDetalhado)
    .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    .map(([materia, d]) => {
      const vcs = d.vc_lista ?? [];
      return {
        materia,
        vc1: vcs[0] != null ? nf(vcs[0]) : "",
        vc2: vcs[1] != null ? nf(vcs[1]) : "",
        vc3: vcs[2] != null ? nf(vcs[2]) : "",
        mediaVcs: vcs.length > 0 ? nf(vcs.reduce((a, b) => a + b, 0) / vcs.length) : "",
        vf: nf(d.vf),
        mediaFinal: nf(d.nota_final),
        verif2aEpoca: nf(d.verif_2a_epoca),
        media2aEpoca: nf(d.media_2a_epoca),
      };
    });
}

function nomeArquivo(dados: DadosExportacaoBoletim, extensao: string) {
  const base = `boletim_${dados.tituloModulo}_${dados.nomeAluno}`.replace(/\s+/g, "_");
  return `${base}.${extensao}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportarBoletimExcel(dados: DadosExportacaoBoletim) {
  const wb = XLSX.utils.book_new();
  const linhas = linhasBoletim(dados);

  const cabecalho = [
    [TEXTO_INSTITUCIONAL.linha1],
    [TEXTO_INSTITUCIONAL.linha2],
    [TEXTO_INSTITUCIONAL.linha3],
    [TEXTO_INSTITUCIONAL.linha4],
    [TEXTO_INSTITUCIONAL.linha5],
    [],
    [`BOLETIM ESCOLAR ${dados.tituloModulo}`],
    [],
    [`Nome do aluno: ${dados.nomeAluno}`],
    [`Matrícula: ${dados.matricula ?? "—"}`, `Turma: ${dados.nomeTurma}`],
    [`Ano letivo: ${dados.anoLetivo ?? "—"}`, `Início: ${dados.inicio || "—"}`, `Término: ${dados.termino || "—"}`],
    [],
  ];
  const wsCabecalho = XLSX.utils.aoa_to_sheet(cabecalho);
  XLSX.utils.book_append_sheet(wb, wsCabecalho, "Boletim");

  // Tabela de notas — a partir da linha logo após o cabeçalho, com fórmulas
  // reais de planilha nas colunas de média (não valores fixos).
  const linhaInicioTabela = cabecalho.length + 1; // 1-based
  const header = ["Disciplina", "1ª VC", "2ª VC", "3ª VC", "Média VCs", "VF", "Média Final", "Verif. 2ª Época", "Média 2ª Época"];
  XLSX.utils.sheet_add_aoa(wsCabecalho, [header], { origin: `A${linhaInicioTabela}` });

  linhas.forEach((l, i) => {
    const linhaAtual = linhaInicioTabela + 1 + i; // 1-based
    const vc1 = `B${linhaAtual}`;
    const vc3 = `D${linhaAtual}`;
    const mediaVcs = `E${linhaAtual}`;
    const vf = `F${linhaAtual}`;
    // Exceção já auditada do sistema (src/config/formulaNotas.ts,
    // MATERIAS_SOMA_VC): "Direito Administrativo Disciplinar Militar I" usa
    // SOMA das VCs em vez de MÉDIA — preservada aqui também, pra a fórmula
    // da planilha bater exatamente com o que o app já calcula.
    const funcaoVc = MATERIAS_SOMA_VC.has(l.materia) ? "SUM" : "AVERAGE";
    XLSX.utils.sheet_add_aoa(
      wsCabecalho,
      [
        [
          l.materia,
          l.vc1 ? Number(l.vc1) : "",
          l.vc2 ? Number(l.vc2) : "",
          l.vc3 ? Number(l.vc3) : "",
          { f: `IFERROR(${funcaoVc}(${vc1}:${vc3}),"")` },
          l.vf ? Number(l.vf) : "",
          { f: `IFERROR((${mediaVcs}*2+${vf}*3)/5,"")` },
          l.verif2aEpoca ? Number(l.verif2aEpoca) : "",
          l.media2aEpoca ? Number(l.media2aEpoca) : "",
        ],
      ],
      { origin: `A${linhaAtual}` }
    );
  });

  const linhaMediaFinal = linhaInicioTabela + 1 + linhas.length + 1;
  XLSX.utils.sheet_add_aoa(
    wsCabecalho,
    [[`Média Final do Módulo`, dados.mediaFinalModulo.toFixed(3)]],
    { origin: `A${linhaMediaFinal}` }
  );
  XLSX.utils.sheet_add_aoa(
    wsCabecalho,
    [[dados.responsavelNome], [`${dados.responsavelPosto} — ${dados.responsavelFuncao}`]],
    { origin: `A${linhaMediaFinal + 2}` }
  );

  XLSX.writeFile(wb, nomeArquivo(dados, "xlsx"));
}

export function exportarBoletimPDF(dados: DadosExportacaoBoletim) {
  const doc = new jsPDF();
  let y = 14;

  doc.setFontSize(11);
  doc.setTextColor(0);
  [TEXTO_INSTITUCIONAL.linha1, TEXTO_INSTITUCIONAL.linha2, TEXTO_INSTITUCIONAL.linha3, TEXTO_INSTITUCIONAL.linha4, TEXTO_INSTITUCIONAL.linha5].forEach(
    (linha) => {
      doc.text(linha, 105, y, { align: "center" });
      y += 5;
    }
  );

  y += 4;
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`BOLETIM ESCOLAR ${dados.tituloModulo}`, 105, y, { align: "center" });
  doc.setFont("helvetica", "normal");
  y += 10;

  doc.setFontSize(10);
  doc.text(`NOME DO ALUNO: ${dados.nomeAluno}`, 14, y);
  y += 6;
  doc.text(`MATRÍCULA: ${dados.matricula ?? "—"}`, 14, y);
  doc.text(`TURMA: ${dados.nomeTurma}`, 110, y);
  y += 6;
  doc.text(`ANO LETIVO: ${dados.anoLetivo ?? "—"}`, 14, y);
  doc.text(`INÍCIO: ${dados.inicio || "—"}`, 90, y);
  doc.text(`TÉRMINO: ${dados.termino || "—"}`, 150, y);
  y += 8;

  const linhas = linhasBoletim(dados);
  autoTable(doc, {
    startY: y,
    head: [["Disciplina", "1ª VC", "2ª VC", "3ª VC", "Média VCs", "VF", "Média Final", "2ª Época", "Média 2ª Ép."]],
    body: linhas.map((l) => [l.materia, l.vc1, l.vc2, l.vc3, l.mediaVcs, l.vf, l.mediaFinal, l.verif2aEpoca, l.media2aEpoca]),
    theme: "grid",
    headStyles: { fillColor: [30, 58, 138], fontSize: 7 },
    styles: { fontSize: 7 },
    margin: { left: 10, right: 10 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`Média Final do Módulo: ${dados.mediaFinalModulo.toFixed(3)}`, 105, finalY, { align: "center" });
  doc.setFont("helvetica", "normal");

  const assinaturaY = finalY + 25;
  doc.setFontSize(10);
  doc.text(dados.responsavelNome.toUpperCase(), 105, assinaturaY, { align: "center" });
  doc.setFontSize(8);
  doc.text(`${dados.responsavelPosto} — ${dados.responsavelFuncao}`, 105, assinaturaY + 5, { align: "center" });

  doc.save(nomeArquivo(dados, "pdf"));
}

export async function exportarBoletimWord(dados: DadosExportacaoBoletim) {
  const linhas = linhasBoletim(dados);

  const headerCell = (texto: string) =>
    new DocxTableCell({
      children: [new Paragraph({ text: texto, alignment: AlignmentType.CENTER })],
      width: { size: 11, type: WidthType.PERCENTAGE },
    });
  const bodyCell = (texto: string) =>
    new DocxTableCell({
      children: [new Paragraph({ text: texto, alignment: AlignmentType.CENTER })],
    });

  const tabela = new DocxTable({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new DocxTableRow({
        children: [
          "Disciplina",
          "1ª VC",
          "2ª VC",
          "3ª VC",
          "Média VCs",
          "VF",
          "Média Final",
          "2ª Época",
          "Média 2ª Ép.",
        ].map(headerCell),
      }),
      ...linhas.map(
        (l) =>
          new DocxTableRow({
            children: [
              l.materia,
              l.vc1,
              l.vc2,
              l.vc3,
              l.mediaVcs,
              l.vf,
              l.mediaFinal,
              l.verif2aEpoca,
              l.media2aEpoca,
            ].map(bodyCell),
          })
      ),
    ],
  });

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: TEXTO_INSTITUCIONAL.linha1, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL.linha2, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL.linha3, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL.linha4, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: TEXTO_INSTITUCIONAL.linha5, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: `BOLETIM ESCOLAR ${dados.tituloModulo}`, bold: true, size: 28 })],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: `NOME DO ALUNO: ${dados.nomeAluno}` }),
          new Paragraph({ text: `MATRÍCULA: ${dados.matricula ?? "—"}    TURMA: ${dados.nomeTurma}` }),
          new Paragraph({
            text: `ANO LETIVO: ${dados.anoLetivo ?? "—"}    INÍCIO: ${dados.inicio || "—"}    TÉRMINO: ${dados.termino || "—"}`,
          }),
          new Paragraph({ text: "" }),
          tabela,
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: `Média Final do Módulo: ${dados.mediaFinalModulo.toFixed(3)}`, bold: true }),
            ],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: dados.responsavelNome.toUpperCase(), alignment: AlignmentType.CENTER }),
          new Paragraph({
            text: `${dados.responsavelPosto} — ${dados.responsavelFuncao}`,
            alignment: AlignmentType.CENTER,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, nomeArquivo(dados, "docx"));
}
