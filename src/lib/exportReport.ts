import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { DetailedStudent } from "@/hooks/useGoogleSheets";
import { rotuloUltimosColocados } from "@/contexts/TurmaContext";

export interface ReportKPIs {
  mediaTurma: number;
  desvioPadrao: number;
  totalAlunos: number;
  maiorMedia: { aluno: string; nota: number };
  menorMedia: { aluno: string; nota: number };
}

export interface ReportSubjectProgress {
  gradedSubjects: number;
  totalSubjects: number;
}

export interface ReportData {
  students: DetailedStudent[];
  kpis: ReportKPIs;
  subjectProgress: ReportSubjectProgress;
  title?: string;
  subtitle?: string;
  nomeTurma?: string; // usado só para decidir o rótulo dos 3 últimos (rotuloUltimosColocados)
}

const classify = (nota: number) =>
  nota >= 9.5 ? "Excelente" : nota >= 9.0 ? "Bom" : "Regular";

const fmt = (n?: number | null) =>
  n === undefined || n === null || Number.isNaN(n) ? "" : n.toFixed(4);

const today = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(
    d.getMonth() + 1
  ).padStart(2, "0")}/${d.getFullYear()}`;
};

const DEFAULT_TITLE = "RELATÓRIO COMPLETO - 23° CFO";
const DEFAULT_SUBTITLE = "Turma Alencastro";

/* ---------------- PDF ---------------- */
export const exportToPDF = (data: ReportData) => {
  const { students, kpis, subjectProgress } = data;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(data.title || DEFAULT_TITLE, pageWidth / 2, 50, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(data.subtitle || DEFAULT_SUBTITLE, pageWidth / 2, 68, {
    align: "center",
  });
  doc.text(`Gerado em: ${today()}`, pageWidth / 2, 82, { align: "center" });

  // KPIs
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Indicadores Gerais", 40, 115);

  autoTable(doc, {
    startY: 125,
    head: [["Indicador", "Valor"]],
    body: [
      ["Média da Turma", fmt(kpis.mediaTurma)],
      ["Desvio-Padrão", fmt(kpis.desvioPadrao)],
      ["Total de Alunos", String(kpis.totalAlunos)],
      ["Maior Média", `${fmt(kpis.maiorMedia.nota)} - ${kpis.maiorMedia.aluno}`],
      ["Menor Média", `${fmt(kpis.menorMedia.nota)} - ${kpis.menorMedia.aluno}`],
      [
        "Matérias Avaliadas",
        `${subjectProgress.gradedSubjects}/${subjectProgress.totalSubjects}`,
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 58, 95], textColor: 255 },
    styles: { fontSize: 10 },
  });

  const sorted = [...students].sort((a, b) => a.rank - b.rank);
  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.slice(-3);

  // Top 3
  let y = (doc as any).lastAutoTable.finalY + 25;
  doc.setFontSize(13);
  doc.text("Top 3 - Melhores Desempenhos", 40, y);
  autoTable(doc, {
    startY: y + 8,
    head: [["Rank", "Nome", "Média Final"]],
    body: top3.map((s) => [String(s.rank), s.nome, fmt(s.mediaFinal)]),
    theme: "grid",
    headStyles: { fillColor: [34, 134, 58], textColor: 255 },
    styles: { fontSize: 10 },
  });

  // Bottom 3
  y = (doc as any).lastAutoTable.finalY + 25;
  doc.setFontSize(13);
  doc.text(rotuloUltimosColocados(data.nomeTurma), 40, y);
  autoTable(doc, {
    startY: y + 8,
    head: [["Rank", "Nome", "Média Final"]],
    body: bottom3.map((s) => [String(s.rank), s.nome, fmt(s.mediaFinal)]),
    theme: "grid",
    headStyles: { fillColor: [170, 60, 60], textColor: 255 },
    styles: { fontSize: 10 },
  });

  // Ranking
  doc.addPage();
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("Ranking Completo", 40, 50);
  autoTable(doc, {
    startY: 60,
    head: [["Rank", "Nome", "CFO I", "CFO II", "CFO III", "Média Final", "Classificação"]],
    body: sorted.map((s) => [
      String(s.rank),
      s.nome,
      fmt(s.cfoAverages?.cfoI),
      fmt(s.cfoAverages?.cfoII),
      fmt(s.cfoAverages?.cfoIII),
      fmt(s.mediaFinal),
      classify(s.mediaFinal),
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 58, 95], textColor: 255 },
    styles: { fontSize: 9 },
  });

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(
      "Criado por CAD PM ALENCAR - 2025",
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 20,
      { align: "center" }
    );
    doc.text(
      `Página ${i} de ${pageCount}`,
      pageWidth - 40,
      doc.internal.pageSize.getHeight() - 20,
      { align: "right" }
    );
  }

  doc.save("relatorio_23_cfo.pdf");
};

/* ---------------- XLSX ---------------- */
export const exportToXLSX = (data: ReportData) => {
  const { students, kpis, subjectProgress } = data;
  const wb = XLSX.utils.book_new();

  const indicadores = [
    ["Indicador", "Valor"],
    ["Média da Turma", fmt(kpis.mediaTurma)],
    ["Desvio-Padrão", fmt(kpis.desvioPadrao)],
    ["Total de Alunos", kpis.totalAlunos],
    ["Maior Média", `${fmt(kpis.maiorMedia.nota)} - ${kpis.maiorMedia.aluno}`],
    ["Menor Média", `${fmt(kpis.menorMedia.nota)} - ${kpis.menorMedia.aluno}`],
    ["Matérias Avaliadas", `${subjectProgress.gradedSubjects}/${subjectProgress.totalSubjects}`],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(indicadores),
    "Indicadores"
  );

  const sorted = [...students].sort((a, b) => a.rank - b.rank);
  const ranking = [
    ["Rank", "Nome", "CFO I", "CFO II", "CFO III", "Média Final", "Classificação"],
    ...sorted.map((s) => [
      s.rank,
      s.nome,
      s.cfoAverages?.cfoI ?? "",
      s.cfoAverages?.cfoII ?? "",
      s.cfoAverages?.cfoIII ?? "",
      Number(s.mediaFinal.toFixed(4)),
      classify(s.mediaFinal),
    ]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(ranking),
    "Ranking Completo"
  );

  const top3 = sorted.slice(0, 3);
  const bottom3 = sorted.slice(-3);
  const destaques = [
    ["Top 3 - Melhores Desempenhos"],
    ["Rank", "Nome", "Média Final"],
    ...top3.map((s) => [s.rank, s.nome, Number(s.mediaFinal.toFixed(4))]),
    [],
    [rotuloUltimosColocados(data.nomeTurma)],
    ["Rank", "Nome", "Média Final"],
    ...bottom3.map((s) => [s.rank, s.nome, Number(s.mediaFinal.toFixed(4))]),
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(destaques),
    "Destaques"
  );

  XLSX.writeFile(wb, "relatorio_23_cfo.xlsx");
};

/* ---------------- CSV ---------------- */
export const exportToCSV = (data: ReportData) => {
  const { students, kpis, subjectProgress } = data;
  const sorted = [...students].sort((a, b) => a.rank - b.rank);

  const lines: string[] = [];
  lines.push(`RELATÓRIO COMPLETO - 23° CFO`);
  lines.push(`Turma Alencastro`);
  lines.push(`Gerado em: ${today()}`);
  lines.push("");
  lines.push("Indicadores Gerais");
  lines.push("Indicador,Valor");
  lines.push(`Média da Turma,${fmt(kpis.mediaTurma)}`);
  lines.push(`Desvio-Padrão,${fmt(kpis.desvioPadrao)}`);
  lines.push(`Total de Alunos,${kpis.totalAlunos}`);
  lines.push(`Maior Média,"${fmt(kpis.maiorMedia.nota)} - ${kpis.maiorMedia.aluno}"`);
  lines.push(`Menor Média,"${fmt(kpis.menorMedia.nota)} - ${kpis.menorMedia.aluno}"`);
  lines.push(`Matérias Avaliadas,${subjectProgress.gradedSubjects}/${subjectProgress.totalSubjects}`);
  lines.push("");
  lines.push("Ranking Completo");
  lines.push("Rank,Nome,CFO I,CFO II,CFO III,Média Final,Classificação");
  sorted.forEach((s) => {
    lines.push(
      [
        s.rank,
        `"${s.nome}"`,
        fmt(s.cfoAverages?.cfoI),
        fmt(s.cfoAverages?.cfoII),
        fmt(s.cfoAverages?.cfoIII),
        fmt(s.mediaFinal),
        classify(s.mediaFinal),
      ].join(",")
    );
  });

  const blob = new Blob(["\ufeff" + lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "relatorio_23_cfo.csv";
  link.click();
};
