import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  AlignmentType,
} from "docx";
import {
  TEXTO_INSTITUCIONAL_HISTORICO,
  TEXTO_LEGAL_ATA_BASE,
  TEXTO_LEGAL_ATA_FECHAMENTO,
  ENDERECO_APMCV,
  BRASAO_OFICIAL_APMCV_URL,
} from "@/config/documentosOficiais";
import { notaPorExtenso4, aberturaAtaPorExtenso } from "@/utils/numeroExtenso";
import { carregarImagemBrasao } from "@/utils/brasaoImagem";

export type TipoAta = "ata_1_ano" | "ata_2_ano" | "ata_3_ano" | "ata_classificacao_geral";

export interface MembroComissaoAta {
  nome: string;
  posto_graduacao: string;
  papel: "Presidente" | "Secretário" | "Membro";
  ordem: number;
}

export interface AlunoRankingAta {
  nome: string;
  media: number;
}

export interface DadosExportacaoAta {
  titulo: string; // referente_a da comissão, ex: "Ata de Encerramento do 3º Ano"
  turmaTitulo: string; // ex: "TURMA ALENCASTRO – 25.2300.1"
  portariaNumero: string;
  portariaData: string; // ISO yyyy-mm-dd
  bcgNumero: string | null;
  bcgData: string | null; // ISO
  dataReuniao: string; // ISO — usado tanto pra "Aos X dias..." quanto pra formatar portaria/bcg
  membros: MembroComissaoAta[];
  corpoNarrativo: string; // admin-authored — os fatos daquele período
  ranking: AlunoRankingAta[]; // já ordenado desc, já excluindo desligados-antes-do-encerramento
}

function formatarDataSimples(iso: string): string {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const MESES = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
  ];
  return `${dia} de ${MESES[mes - 1]} de ${ano}`;
}

function montarAbertura(dados: DadosExportacaoAta): string {
  const membrosOrdenados = [...dados.membros].sort((a, b) => a.ordem - b.ordem);
  const membrosTexto = membrosOrdenados
    .map((m) => `${m.papel}, ${m.posto_graduacao} ${m.nome}`)
    .join("; ");

  let portariaTexto = `Portaria nº ${dados.portariaNumero}, de ${formatarDataSimples(dados.portariaData)}`;
  if (dados.bcgNumero) {
    portariaTexto += `, pública no BCG nº ${dados.bcgNumero}`;
    if (dados.bcgData) portariaTexto += ` de ${formatarDataSimples(dados.bcgData)}`;
  }

  return (
    `${aberturaAtaPorExtenso(dados.dataReuniao)}, na cidade de Várzea Grande, Estado de Mato Grosso, ` +
    `no Quartel da Academia de Polícia Militar Costa Verde, reuniu-se a Comissão designada pela ` +
    `${portariaTexto}, composta pelo ${membrosTexto}, para sob a presidência do primeiro, proceder ` +
    `a avaliação do desempenho intelectual, a classificação dos discentes e o encerramento das ` +
    `atividades acadêmicas correspondentes, ${TEXTO_LEGAL_ATA_BASE}.`
  );
}

/**
 * Monta o bloco de classificação no formato usado nas Atas reais: um aluno
 * por linha, em texto corrido, com a nota por extenso individual —
 * "1° Lugar Al Of PM Fulano 9,7894 (nove vírgula sete mil oitocentos e
 * noventa e quatro);" — e ponto final na última linha.
 */
export function montarBlocoClassificacao(ranking: AlunoRankingAta[]): string {
  return ranking
    .map((aluno, i) => {
      const posicao = i + 1;
      const mediaTexto = aluno.media.toFixed(4).replace(".", ",");
      const pontuacao = i === ranking.length - 1 ? "." : ";";
      return `${posicao}° Lugar Al Of PM ${aluno.nome} ${mediaTexto} (${notaPorExtenso4(aluno.media)})${pontuacao}`;
    })
    .join(" ");
}

function nomeSecretario(membros: MembroComissaoAta[]): MembroComissaoAta {
  return (
    membros.find((m) => m.papel === "Secretário") ??
    membros.find((m) => m.papel === "Membro") ??
    membros[0]
  );
}

function nomeArquivo(dados: DadosExportacaoAta) {
  return `${dados.titulo}`.replace(/\s+/g, "_").replace(/[^\w-]/g, "") + ".docx";
}

function downloadBlob(blob: Blob, filename: string) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function exportarAtaWord(dados: DadosExportacaoAta) {
  const brasao = await carregarImagemBrasao(BRASAO_OFICIAL_APMCV_URL);
  const secretario = nomeSecretario(dados.membros);
  const membrosOrdenados = [...dados.membros].sort((a, b) => a.ordem - b.ordem);

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
            children: [new TextRun({ text: dados.titulo, bold: true })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: dados.turmaTitulo, bold: true })],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: montarAbertura(dados), alignment: AlignmentType.JUSTIFIED }),
          new Paragraph({ text: dados.corpoNarrativo, alignment: AlignmentType.JUSTIFIED }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: montarBlocoClassificacao(dados.ranking), alignment: AlignmentType.JUSTIFIED }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              new TextRun({ text: TEXTO_LEGAL_ATA_FECHAMENTO }),
              new TextRun({ text: secretario.nome.toUpperCase(), bold: true }),
              new TextRun({ text: ` - ${secretario.posto_graduacao}, que secretariei a presente reunião.` }),
            ],
          }),
          new Paragraph({ text: "" }),
          ...membrosOrdenados.flatMap((m) => [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: `${m.nome.toUpperCase()} - ${m.posto_graduacao}` })],
            }),
            new Paragraph({ text: m.papel, alignment: AlignmentType.CENTER }),
            new Paragraph({ text: "" }),
          ]),
          new Paragraph({ text: ENDERECO_APMCV.linha1, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: ENDERECO_APMCV.linha2, alignment: AlignmentType.CENTER }),
          new Paragraph({ text: ENDERECO_APMCV.linha3, alignment: AlignmentType.CENTER }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, nomeArquivo(dados));
}
