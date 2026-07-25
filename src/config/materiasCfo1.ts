import { Student } from "@/data/mockData";

// Mesmo mapeamento que já existia em useGoogleSheets.ts do CFO I — reaproveitado
// para que o admin lance as notas usando os MESMOS nomes de matéria da planilha antiga.
// Chave = nome da matéria (como deve ser digitado no campo "Matéria" do painel admin)
// Valor = campo correspondente no tipo Student
export const MATERIAS_CFO1: Record<string, keyof Student> = {
  "ORDEM UNIDA VC": "ordenUnidaVC",
  "ORDEM UNIDA VF": "ordenUnidaVF",
  "ARMAMENTO MUNIÇÃO E EXPLOSIVO VC": "armamentoVC",
  "ARMAMENTO MUNIÇÃO E EXPLOSIVO VF": "armamentoVF",
  "Comunicação Operacional VC": "comunicacaoVC",
  "Comunicação Operacional VF": "comunicacaoVF",
  "Sistema de Segurança Pública no Brasil": "sistemaSeguranca",
  "História da Policia Militar": "historiaPM",
  "Legislação Penal Extravagante I": "legislacaoPenal",
  "Educação Física Policial Militar I": "educacaoFisica",
  "Educação Financeira": "educacaoFinanceira",
  "Didática: Sistema de Ensino": "didatica",
  "Administração Pública Gerencial": "administracaoPublica",
  "Bombeiro Militar e Defesa Civil": "bombeiroMilitar",
  "Direito Ambiental": "direitoAmbiental",
  "Defesa Pessoal I": "defesaPessoal",
  "Redação Oficial Aplicada": "redacaoOficial",
  Libras: "libras",
  "Metodologia Científica / Pesquisa": "metodologiaCientifica",
  "CERIMONIAL E PROTOCOLO": "cerimonialProtocolo",
  "Teoria de Policia": "teoriaPolicia",
  "Técnicas Gerais de Policiamento I": "tecnicasPoliciamento",
  "POP I": "popI",
  "Defesa Territorial I": "defesaTerritorial",
  "Hipologia e Equitação": "hipologia",
  "Geopolítica de Mato Grosso": "geopolitica",
  "Policia Comunitária": "policiaComunitaria",
  "Legislação Policial Militar I": "legislacaoPolicial",
  "Direitos humanos": "direitosHumanos",
  "Medicina Legal": "medicinaLegal",
  "Direito Processual Penal Militar I": "direitoProcessual",
  "Direito Penal Militar I": "direitoPenalMilitar",
  "Direito Administrativo Disciplinar Militar I": "direitoAdministrativo",
  APH: "aph",
  "TIRO POLICIAL": "tiroPolicial",
};
