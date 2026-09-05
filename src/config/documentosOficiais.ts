/**
 * Texto institucional fixo usado no cabeçalho dos documentos oficiais
 * exportados (Boletim Escolar agora; Histórico Escolar na Fase 2).
 * Centralizado aqui para não duplicar entre os dois geradores.
 */
export const TEXTO_INSTITUCIONAL = {
  linha1: "ESTADO DE MATO GROSSO",
  linha2: "SECRETARIA DE ESTADO DE JUSTIÇA E SEGURANÇA PÚBLICA",
  linha3: "POLÍCIA MILITAR",
  linha4: "ACADEMIA DE POLÍCIA MILITAR COSTA VERDE",
  linha5: "(CIM – 1951)",
} as const;

/**
 * Brasão OFICIAL da Academia — fixo, não é o brasão configurável por turma
 * (esse é só cosmético, usado no topo do dashboard e no relatório que cada
 * aluno pode exportar). Documentos oficiais (Boletim e Histórico Escolar)
 * sempre usam este, independente de qual turma o aluno é. Salvo como asset
 * do próprio repo (não referencia o storage do Supabase) pra não depender
 * de nenhuma turma manter o upload configurado.
 */
export const BRASAO_OFICIAL_APMCV_URL = "/brasao-apmcv-oficial.png";

// Textos institucionais fixos usados só no Histórico Escolar (Fase 2).
// TEXTO_INSTITUCIONAL acima continua exclusivo do Boletim, sem mudanças.
export const TEXTO_INSTITUCIONAL_HISTORICO = {
  ...TEXTO_INSTITUCIONAL,
  linhaDiretoria: "DIRETORIA DE ENSINO, INSTRUÇÃO E PESQUISA",
} as const;

export const TEXTO_LEGAL_ABERTURA =
  "criada em 27 de novembro de 1987, pela Lei nº 5.177, e efetivada em 06 de julho de 1993, " +
  "pelo Decreto nº 3.145, credenciada como Instituição de Ensino Superior através da Portaria " +
  "Conjunta nº 07/SESP/SECITEC/2012, bem como reconhecido o Curso de Formação de Oficiais na " +
  "Modalidade de Bacharelado em Segurança Pública, sendo que o referido CFO foi reconhecido " +
  "inicialmente em 1996, como Curso de Nível Superior pela Resolução nº 253/96, do CEE/MT, " +
  "conforme Parecer nº 092/96, de 27 de agosto de 1996, ratificado pelo Parecer nº 049/00-CEE " +
  "de 22 de fevereiro de 2000, localizada à Rua Maysa Matarazzo s/nº, Bairro Jardim Costa Verde " +
  "em Várzea Grande-MT, CERTIFICA que consta nos arquivos desta Unidade Escolar que,";

export const TEXTO_LEGAL_ADMISSAO =
  "admitido(a) por Concurso Público realizado pela Polícia Militar do Estado de Mato Grosso " +
  "em convênio com a Universidade Federal de Mato Grosso, tendo concluído";

export const TEXTO_LEGAL_FECHAMENTO =
  "Por ser verdade eu mandei passar o presente, assinado depois de datado pelo chefe da " +
  "Secretaria de Registros Acadêmico da APMCV, que conferiu a elaboração do presente, o qual " +
  "assina juntamente com o sr. Comandante da APMCV.";

// ------------------------------------------------------------
// Ata de Encerramento / Classificação Geral (Fase 3).
//
// As 4 Atas reais da 23ª turma usadas como modelo (05/09/2026) têm 3
// variações diferentes de cabeçalho institucional entre si (ex: "SECRETARIA
// DE ESTADO DE SEGURANÇA PÚBLICA" vs "POLÍCIA MILITAR DO ESTADO DE MATO
// GROSSO" vs sem a palavra "JUSTIÇA"), aparentemente por terem sido digitadas
// à mão em ocasiões diferentes. Escolhemos usar aqui o MESMO cabeçalho já
// validado e em uso no Histórico Escolar (TEXTO_INSTITUCIONAL_HISTORICO),
// por consistência entre os documentos gerados pelo próprio app — reavaliar
// com o usuário se algum órgão exigir a variação exata de um modelo
// específico.
export const TEXTO_LEGAL_ATA_BASE =
  "de acordo com o Projeto Político Pedagógico, Decreto 3.144, de 06 de julho de 1993 " +
  "(Decreto CFO) e a Lei Complementar nº 408, de 01 de julho de 2010 (Lei de Ensino da " +
  "Policia Militar do Estado de Mato Grosso)";

export const TEXTO_LEGAL_ATA_FECHAMENTO =
  "E como nada mais houve a tratar, deu-se por encerrada a reunião, lavrando a presente ata, " +
  "que depois de lida e achada conforme, vai devidamente assinada por todos e por mim, ";

export const ENDERECO_APMCV = {
  linha1: "ACADEMIA DE POLÍCIA MILITAR COSTA VERDE",
  linha2: "Rua Maysa Matarazzo, s/n.º, Costa Verde, Várzea Grande – MT   CEP 78.128-900",
  linha3: "Tel.: 65 3686-2293     fone/fax: 65 3686-3566   e-mail: apm@pm.mt.gov.br",
} as const;
