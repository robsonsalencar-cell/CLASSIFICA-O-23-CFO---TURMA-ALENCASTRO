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
