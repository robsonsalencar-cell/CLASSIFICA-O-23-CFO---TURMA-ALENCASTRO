// Matriz Curricular oficial do 23º CFO (85 disciplinas).
// Fonte: Matriz Curricular do CFO 20 meses – atualizada em 07/AGO/2025.
// Natação foi transferida do CFO II para o CFO III.

export const CFO_I_SUBJECTS: string[] = [
  "Sistema de Segurança Pública no Brasil",
  "História da Polícia Militar",
  "Geopolítica de Mato Grosso",
  "Polícia Comunitária",
  "Legislação Policial Militar I",
  "Direitos Humanos",
  "Medicina Legal",
  "Direito Processual Penal Militar I",
  "Direito Penal Militar I",
  "Direito Administrativo Disciplinar Militar I",
  "Legislação Penal Extravagante I",
  "Direito Ambiental",
  "Redação Oficial Aplicada",
  "Educação Física Policial Militar I",
  "Defesa Pessoal I",
  "Educação Financeira",
  "Libras",
  "Metodologia Científica / Pesquisa",
  "Cerimonial e Protocolo",
  "Comunicação Operacional / Telecomunicações",
  "Armamento de Fogo, Munição e Explosivos",
  "Bombeiro Militar e Defesa Civil",
  "Cultura e Cotidiano Policial Militar",
  "Teoria de Polícia",
  "Didática: Sistema de Ensino",
  "Técnicas Gerais de Policiamento I",
  "POP I",
  "Defesa Territorial I",
  "Hipologia e Equitação",
  "Administração Pública Gerencial",
  "APH",
  "Tiro Policial",
];

export const CFO_II_SUBJECTS: string[] = [
  "Criminologia Aplicada a Segurança Pública",
  "Sociologia do Crime e da Violência",
  "Direito Penal Militar II",
  "Direito Administrativo Aplicado a Seg. Pública",
  "Direito Processual Penal Militar II",
  "Legislação Policial Militar II",
  "Direito Administrativo Disciplinar Militar II",
  "Legislação Penal Extravagante II",
  "Educação Física Policial Militar II",
  "Defesa Pessoal II",
  "Gestão de Informação – Inteligência",
  "Saúde Segurança aplicada ao Trabalho",
  "Marketing Institucional",
  "Metodologia Científica / Projeto de Pesquisa",
  "Geoprocessamento e Análise Criminal",
  "Emergência e Traumas",
  "Cultura e Cotidiano Policial Militar II",
  "Técnicas Gerais de Policiamento II",
  "POP II",
  "Criminalística",
  "Defesa Territorial II",
  "Policiamento Montado",
  "Uso diferenciado da Força",
  "Gestão de Pessoas",
  "Termo Circunstanciado de Ocorrência",
  "Sistemas Informatizados",
  "Tiro Policial II",
];

export const CFO_III_SUBJECTS: string[] = [
  "Licitação de Contrato e Aquisição",
  "Direito Penal Militar III",
  "Direito Processual Penal Militar III",
  "Legislação Policial Militar III",
  "Direito Administrativo Disciplinar Militar III",
  "Gerenciamento de Crises e Eventos Críticos",
  "Educação Física Policial Militar III",
  "Controle e Submissão",
  "Artigo Científico",
  "Seminário de Trabalho Científico - Workshop de Banca de Defesa do TCC",
  "Cultura e Cotidiano Policial Militar III",
  "EPP – Estágio de Patrulhamento Tático",
  "Técnicas Gerais de Policiamento III",
  "POP III",
  "Segurança Física de Instalações e Dignatários",
  "Defesa Territorial III",
  "Policiamento Ambiental",
  "Policiamento de Trânsito",
  "Policiamento de Grandes Eventos",
  "Técnicas não Letais",
  "Gestão de Recursos Públicos",
  "Gestão Pública por Resultados",
  "Gestão de Logística e Patrimônio",
  "Tiro Policial III",
  "Termo Circunstanciado de Ocorrência III",
  "Natação",
];

export const CURRICULAR_MATRIX_SUBJECTS: string[] = [
  ...CFO_I_SUBJECTS,
  ...CFO_II_SUBJECTS,
  ...CFO_III_SUBJECTS,
];

export const CURRICULAR_MATRIX_TOTAL = CURRICULAR_MATRIX_SUBJECTS.length; // 85

// Normaliza para comparação frouxa (remove acentos, pontuação, uppercase, colapsa espaços)
export const normalizeForMatch = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\b(VC|VF)\s*\d*\b/g, "")
    .replace(/\b(I{1,3})\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
