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
  alunoId: string;
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

// Tamanhos conferidos direto no XML das 2 Atas reais mais recentes da 23ª
// turma (3º Ano e Classificação Geral, ambas de 02/09/2026) — tamanho em
// "half-points" (unidade que o TextRun.size espera; 22 = 11pt).
const TAM_CORPO = 22; // 11pt — cabeçalho, narrativa, classificação, fechamento, assinaturas
const TAM_TITULO = 24; // 12pt — título da Ata ("Ata de Encerramento do...")
const TAM_RODAPE_NOME = 18; // 9pt — "ACADEMIA DE POLÍCIA MILITAR COSTA VERDE" no rodapé
const TAM_RODAPE_ENDERECO = 16; // 8pt — endereço/telefone no rodapé

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
 * Monta o bloco de classificação no formato usado nas Atas reais: UM
 * PARÁGRAFO POR ALUNO (não um bloco de texto corrido único — conferido no
 * XML das Atas reais, cada colocação é seu próprio parágrafo), com o
 * prefixo "N° Lugar Al Of PM " em NEGRITO e o resto (nome, nota, extenso)
 * em peso normal — "1° Lugar Al Of PM " (negrito) + "Fulano - média 9,7894
 * (nove vírgula sete mil oitocentos e noventa e quatro);" (normal). Ponto
 * final em vez de ";" na última linha.
 */
export function montarParagrafosClassificacao(ranking: AlunoRankingAta[]): Paragraph[] {
  return ranking.map((aluno, i) => {
    const posicao = i + 1;
    const mediaTexto = aluno.media.toFixed(4).replace(".", ",");
    const pontuacao = i === ranking.length - 1 ? "." : ";";
    return new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      children: [
        new TextRun({ text: `${posicao}° Lugar Al Of PM `, bold: true, size: TAM_CORPO }),
        new TextRun({
          text: `${aluno.nome} - média ${mediaTexto} (${notaPorExtenso4(aluno.media)})${pontuacao}`,
          size: TAM_CORPO,
        }),
      ],
    });
  });
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
  // Adia a revogação — evita cortar o download em navegadores que ainda
  // estão lendo o blob de forma assíncrona quando o clique retorna.
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function txt(texto: string, opts: { bold?: boolean; size?: number } = {}): TextRun {
  return new TextRun({ text: texto, bold: opts.bold, size: opts.size ?? TAM_CORPO });
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
          new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(TEXTO_INSTITUCIONAL_HISTORICO.linha1, { bold: true })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(TEXTO_INSTITUCIONAL_HISTORICO.linha2, { bold: true })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(TEXTO_INSTITUCIONAL_HISTORICO.linha3, { bold: true })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(TEXTO_INSTITUCIONAL_HISTORICO.linhaDiretoria, { bold: true })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(TEXTO_INSTITUCIONAL_HISTORICO.linha4, { bold: true })] }),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [txt(dados.titulo, { bold: true, size: TAM_TITULO })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [txt(dados.turmaTitulo, { bold: true })],
          }),
          new Paragraph({ text: "" }),
          new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [txt(montarAbertura(dados))] }),
          // corpoNarrativo pode vir com várias quebras de linha (um parágrafo
          // por evento, igual ao modelo original) — cada uma vira seu próprio
          // parágrafo no Word, em vez de tudo virar um bloco único.
          ...dados.corpoNarrativo
            .split(/\n+/)
            .map((s) => s.trim())
            .filter(Boolean)
            .map((paragrafo) => new Paragraph({ alignment: AlignmentType.JUSTIFIED, children: [txt(paragrafo)] })),
          new Paragraph({ text: "" }),
          ...montarParagrafosClassificacao(dados.ranking),
          new Paragraph({ text: "" }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            children: [
              txt(TEXTO_LEGAL_ATA_FECHAMENTO),
              txt(`${secretario.nome.toUpperCase()} - ${secretario.posto_graduacao}, que secretariei a presente reunião.`),
            ],
          }),
          new Paragraph({ text: "" }),
          ...membrosOrdenados.flatMap((m) => [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [txt(`${m.nome.toUpperCase()} - ${m.posto_graduacao}`, { bold: true })],
            }),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(m.papel)] }),
            new Paragraph({ text: "" }),
          ]),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(ENDERECO_APMCV.linha1, { bold: true, size: TAM_RODAPE_NOME })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(ENDERECO_APMCV.linha2, { size: TAM_RODAPE_ENDERECO })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, children: [txt(ENDERECO_APMCV.linha3, { size: TAM_RODAPE_ENDERECO })] }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, nomeArquivo(dados));
}
