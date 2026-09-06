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

type ModuloCfo = "CFO I" | "CFO II" | "CFO III";

// Mesma identidade visual já usada nos temas de tela de cada módulo (ver
// html.tema-cfo1/2/3 em src/index.css: CFO I azul, CFO II verde, CFO III/
// Geral dourado) — tons escurecidos aqui pra ficarem legíveis como texto
// em fundo branco de PDF (as cores originais são claras demais pra texto).
const COR_CFO: Record<ModuloCfo, [number, number, number]> = {
  "CFO I": [19, 97, 174],
  "CFO II": [29, 135, 64],
  "CFO III": [194, 142, 10],
};
const COR_OUTRAS: [number, number, number] = [80, 80, 80];

interface LinhaMateria {
  materia: string;
  vc: string;
  vf: string;
  nota_final: string;
  classificacao: string;
}

interface GrupoCfo {
  titulo: ModuloCfo | "Outras";
  cor: [number, number, number];
  linhas: LinhaMateria[];
}

/**
 * O `gradesDetalhado` de um aluno chega de duas formas, dependendo de onde
 * o relatório foi pedido:
 * - Tela de um módulo só (CFO I, por exemplo): chaves são o nome puro da
 *   matéria, e `tituloModulo` já diz de qual CFO se trata.
 * - Tela de Classificação Geral (todos os módulos juntos): chaves vêm
 *   sufixadas, ex: "Direito Penal Militar I (CFO I)" — é assim que
 *   ClassificacaoGeral.tsx funde os 3 módulos num só objeto.
 * Esta função identifica o módulo de cada matéria nos dois casos.
 */
function separarMateriaEModulo(
  chave: string,
  tituloModulo: string
): { materia: string; modulo: ModuloCfo | null } {
  const m = chave.match(/^(.*)\s\((CFO I|CFO II|CFO III)\)$/);
  if (m) return { materia: m[1], modulo: m[2] as ModuloCfo };
  if (tituloModulo === "CFO I" || tituloModulo === "CFO II" || tituloModulo === "CFO III") {
    return { materia: chave, modulo: tituloModulo };
  }
  return { materia: chave, modulo: null };
}

/**
 * Agrupa as matérias por módulo (CFO I, depois CFO II, depois CFO III —
 * sempre nessa ordem, não importa a ordem em que vieram) e ordena as
 * matérias de cada grupo em ordem alfabética — antes vinha tudo misturado
 * numa lista só, ordenada por nota (do maior pro menor), difícil de ler.
 */
function agruparPorCfo(dados: DadosExportacaoAluno): GrupoCfo[] {
  const porModulo = new Map<ModuloCfo | "Outras", LinhaMateria[]>();

  for (const [chave, d] of Object.entries(dados.gradesDetalhado)) {
    const { materia, modulo } = separarMateriaEModulo(chave, dados.tituloModulo);
    const grupo = modulo ?? "Outras";
    if (!porModulo.has(grupo)) porModulo.set(grupo, []);
    porModulo.get(grupo)!.push({
      materia,
      vc: d.vc_lista.length > 0 ? d.vc_lista.join(" / ") : "—",
      vf: d.vf != null ? d.vf.toFixed(4) : "—",
      nota_final: d.nota_final != null ? d.nota_final.toFixed(4) : "—",
      classificacao: d.nota_final != null ? classificacao(d.nota_final) : "—",
    });
  }

  const ORDEM: (ModuloCfo | "Outras")[] = ["CFO I", "CFO II", "CFO III", "Outras"];
  return ORDEM.filter((k) => porModulo.has(k)).map((k) => ({
    titulo: k,
    cor: k === "Outras" ? COR_OUTRAS : COR_CFO[k],
    linhas: porModulo.get(k)!.sort((a, b) => a.materia.localeCompare(b.materia, "pt-BR")),
  }));
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  // Adia a revogação — evita cortar o download em navegadores que ainda
  // estão lendo o blob de forma assíncrona quando o clique retorna.
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function exportarAlunoCSV(dados: DadosExportacaoAluno) {
  const grupos = agruparPorCfo(dados);
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

  grupos.forEach((g) => {
    linhas.push("");
    linhas.push(`=== ${g.titulo.toUpperCase()} ===`);
    linhas.push("Matéria,VC,VF,Nota Final,Classificação");
    g.linhas.forEach((l) => {
      linhas.push(`"${l.materia}",${l.vc},${l.vf},${l.nota_final},${l.classificacao}`);
    });
  });

  const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `relatorio_${dados.nome.replace(/\s+/g, "_")}.csv`);
}

export function exportarAlunoXLSX(dados: DadosExportacaoAluno) {
  const grupos = agruparPorCfo(dados);
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

  // Monta como matriz (não json_to_sheet) pra poder intercalar um título de
  // seção por módulo — a versão gratuita da lib "xlsx" usada aqui não tem
  // suporte a cor de célula (isso exigiria a versão paga/Pro do SheetJS),
  // então o destaque por CFO aqui é feito com o título em MAIÚSCULO
  // separando cada bloco, em vez de cor — o PDF é quem tem as cores.
  const aoa: (string | number)[][] = [];
  grupos.forEach((g, i) => {
    if (i > 0) aoa.push([]);
    aoa.push([g.titulo.toUpperCase()]);
    aoa.push(["Matéria", "VC", "VF", "Nota Final", "Classificação"]);
    g.linhas.forEach((l) => aoa.push([l.materia, l.vc, l.vf, l.nota_final, l.classificacao]));
  });
  const wsDetalhe = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, wsDetalhe, "Notas");

  XLSX.writeFile(wb, `relatorio_${dados.nome.replace(/\s+/g, "_")}.xlsx`);
}

export async function exportarAlunoPDF(dados: DadosExportacaoAluno) {
  const grupos = agruparPorCfo(dados);
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

  // Uma tabela por módulo (CFO I, CFO II, CFO III, nessa ordem), cada uma
  // com o título e o cabeçalho da tabela na cor daquele CFO — mesma
  // identidade visual usada nas telas do sistema (azul/verde/dourado).
  const alturaPagina = doc.internal.pageSize.getHeight();
  grupos.forEach((g) => {
    // Evita o título do próximo módulo ficar sozinho, cortado no rodapé,
    // quando o relatório tem muitas matérias e passa de uma página.
    if (y > alturaPagina - 30) {
      doc.addPage();
      y = 16;
    }
    doc.setFontSize(12);
    doc.setTextColor(...g.cor);
    doc.text(g.titulo, 14, y);
    y += 6;

    autoTable(doc, {
      startY: y,
      head: [["Matéria", "VC", "VF", "Nota Final", "Classificação"]],
      body: g.linhas.map((l) => [l.materia, l.vc, l.vf, l.nota_final, l.classificacao]),
      theme: "striped",
      headStyles: { fillColor: g.cor },
      margin: { left: 14 },
      styles: { fontSize: 8 },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  });

  doc.save(`relatorio_${dados.nome.replace(/\s+/g, "_")}.pdf`);
}
