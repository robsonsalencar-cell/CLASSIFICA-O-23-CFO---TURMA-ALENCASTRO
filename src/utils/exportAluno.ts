import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { DetalheMateria } from "@/hooks/useAlunosModulo";

export interface DadosExportacaoAluno {
  nome: string;
  rank: number;
  totalAlunos: number;
  mediaFinal: number;
  tituloModulo: string; // ex: "CFO I", "Classificação Geral"
  nomeTurma: string;
  subtituloTurma: string;
  gradesDetalhado: Record<string, DetalheMateria>;
}

function classificacao(media: number): string {
  if (media >= 9.5) return "Excelente";
  if (media >= 9.0) return "Bom";
  return "Regular";
}

function linhasDetalhe(dados: DadosExportacaoAluno) {
  return Object.entries(dados.gradesDetalhado)
    .sort((a, b) => (b[1].nota_final ?? 0) - (a[1].nota_final ?? 0))
    .map(([materia, d]) => ({
      materia,
      vc: d.vc_lista.length > 0 ? d.vc_lista.join(" / ") : "—",
      vf: d.vf != null ? d.vf.toFixed(4) : "—",
      nota_final: d.nota_final != null ? d.nota_final.toFixed(4) : "—",
      classificacao: d.nota_final != null ? classificacao(d.nota_final) : "—",
    }));
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportarAlunoCSV(dados: DadosExportacaoAluno) {
  const linhas: string[] = [];
  linhas.push(`RELATÓRIO INDIVIDUAL — ${dados.nomeTurma}`);
  linhas.push(dados.subtituloTurma);
  linhas.push(`Módulo: ${dados.tituloModulo}`);
  linhas.push(`Candidato: ${dados.nome}`);
  linhas.push(`Data: ${new Date().toLocaleDateString("pt-BR")}`);
  linhas.push("");
  linhas.push("=== RESUMO ===");
  linhas.push(`Colocação,${dados.rank}º de ${dados.totalAlunos}`);
  linhas.push(`Média Final,${dados.mediaFinal.toFixed(4)}`);
  linhas.push("");
  linhas.push("=== DETALHAMENTO POR MATÉRIA ===");
  linhas.push("Matéria,VC,VF,Nota Final,Classificação");
  linhasDetalhe(dados).forEach((l) => {
    linhas.push(`"${l.materia}",${l.vc},${l.vf},${l.nota_final},${l.classificacao}`);
  });

  const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `relatorio_${dados.nome.replace(/\s+/g, "_")}.csv`);
}

export function exportarAlunoXLSX(dados: DadosExportacaoAluno) {
  const wb = XLSX.utils.book_new();

  const resumo = [
    [`RELATÓRIO INDIVIDUAL — ${dados.nomeTurma}`],
    [dados.subtituloTurma],
    [`Módulo: ${dados.tituloModulo}`],
    [`Candidato: ${dados.nome}`],
    [],
    ["Colocação", `${dados.rank}º de ${dados.totalAlunos}`],
    ["Média Final", dados.mediaFinal.toFixed(4)],
  ];
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  const detalhe = linhasDetalhe(dados);
  const wsDetalhe = XLSX.utils.json_to_sheet(
    detalhe.map((l) => ({
      Matéria: l.materia,
      VC: l.vc,
      VF: l.vf,
      "Nota Final": l.nota_final,
      Classificação: l.classificacao,
    }))
  );
  XLSX.utils.book_append_sheet(wb, wsDetalhe, "Notas");

  XLSX.writeFile(wb, `relatorio_${dados.nome.replace(/\s+/g, "_")}.xlsx`);
}

export async function exportarAlunoPDF(dados: DadosExportacaoAluno) {
  const doc = new jsPDF();
  let y = 16;

  doc.setFontSize(16);
  doc.setTextColor(30, 58, 138);
  doc.text(`RELATÓRIO INDIVIDUAL — ${dados.nomeTurma}`, 105, y, { align: "center" });
  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(dados.subtituloTurma, 105, y, { align: "center" });
  y += 6;
  doc.text(`Módulo: ${dados.tituloModulo}`, 105, y, { align: "center" });
  y += 10;

  doc.setFontSize(14);
  doc.setTextColor(30, 58, 138);
  doc.text(dados.nome, 105, y, { align: "center" });
  y += 7;
  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(
    `Colocação: ${dados.rank}º de ${dados.totalAlunos} | Média Final: ${dados.mediaFinal.toFixed(4)}`,
    105,
    y,
    { align: "center" }
  );
  y += 10;

  autoTable(doc, {
    startY: y,
    head: [["Matéria", "VC", "VF", "Nota Final", "Classificação"]],
    body: linhasDetalhe(dados).map((l) => [l.materia, l.vc, l.vf, l.nota_final, l.classificacao]),
    theme: "striped",
    headStyles: { fillColor: [30, 58, 138] },
    margin: { left: 14 },
    styles: { fontSize: 8 },
  });

  doc.save(`relatorio_${dados.nome.replace(/\s+/g, "_")}.pdf`);
}
