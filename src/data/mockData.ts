// Mock data for 23° CFO Classification Dashboard
export interface Student {
  rank: number;
  nome: string;
  ordenUnidaVC: number;
  ordenUnidaVF: number;
  armamentoVC: number;
  armamentoVF: number;
  comunicacaoVC: number;
  comunicacaoVF: number;
  sistemaSeguranca: number;
  historiaPM: number;
  legislacaoPenal: number;
  educacaoFisica: number;
  educacaoFinanceira: number;
  didatica: number;
  administracaoPublica: number;
  bombeiroMilitar: number;
  direitoAmbiental: number;
  defesaPessoal: number;
  redacaoOficial: number;
  libras: number;
  metodologiaCientifica: number;
  cerimonialProtocolo: number;
  teoriaPolicia: number;
  tecnicasPoliciamento: number;
  popI: number;
  defesaTerritorial: number;
  hipologia: number;
  geopolitica: number;
  policiaComunitaria: number;
  legislacaoPolicial: number;
  direitosHumanos: number;
  medicinaLegal: number;
  direitoProcessual: number;
  direitoPenalMilitar: number;
  direitoAdministrativo: number;
  aph: number;
  tiroPolicial: number;
  mediaFinal: number;
}

export const studentsData: Student[] = [
  {
    rank: 1,
    nome: "LAVÍNIA DINIZ SIQUEIRA",
    ordenUnidaVC: 10.0,
    ordenUnidaVF: 10.0,
    armamentoVC: 9.8,
    armamentoVF: 9.9,
    comunicacaoVC: 10.0,
    comunicacaoVF: 10.0,
    sistemaSeguranca: 9.9,
    historiaPM: 10.0,
    legislacaoPenal: 9.8,
    educacaoFisica: 9.9,
    educacaoFinanceira: 10.0,
    didatica: 9.9,
    administracaoPublica: 9.8,
    bombeiroMilitar: 10.0,
    direitoAmbiental: 9.9,
    defesaPessoal: 9.8,
    redacaoOficial: 10.0,
    libras: 9.9,
    metodologiaCientifica: 9.8,
    cerimonialProtocolo: 10.0,
    teoriaPolicia: 9.9,
    tecnicasPoliciamento: 9.8,
    popI: 10.0,
    defesaTerritorial: 9.9,
    hipologia: 9.8,
    geopolitica: 10.0,
    policiaComunitaria: 9.9,
    legislacaoPolicial: 9.8,
    direitosHumanos: 10.0,
    medicinaLegal: 9.9,
    direitoProcessual: 9.8,
    direitoPenalMilitar: 10.0,
    direitoAdministrativo: 9.9,
    aph: 9.8,
    tiroPolicial: 10.0,
    mediaFinal: 9.92
  },
  {
    rank: 2,
    nome: "LAURIANE SIMONINI DE AVILA",
    ordenUnidaVC: 9.9,
    ordenUnidaVF: 9.8,
    armamentoVC: 9.9,
    armamentoVF: 9.8,
    comunicacaoVC: 9.9,
    comunicacaoVF: 9.8,
    sistemaSeguranca: 9.9,
    historiaPM: 9.8,
    legislacaoPenal: 9.9,
    educacaoFisica: 9.8,
    educacaoFinanceira: 9.9,
    didatica: 9.8,
    administracaoPublica: 9.9,
    bombeiroMilitar: 9.8,
    direitoAmbiental: 9.9,
    defesaPessoal: 9.8,
    redacaoOficial: 9.9,
    libras: 9.8,
    metodologiaCientifica: 9.9,
    cerimonialProtocolo: 9.8,
    teoriaPolicia: 9.9,
    tecnicasPoliciamento: 9.8,
    popI: 9.9,
    defesaTerritorial: 9.8,
    hipologia: 9.9,
    geopolitica: 9.8,
    policiaComunitaria: 9.9,
    legislacaoPolicial: 9.8,
    direitosHumanos: 9.9,
    medicinaLegal: 9.8,
    direitoProcessual: 9.9,
    direitoPenalMilitar: 9.8,
    direitoAdministrativo: 9.9,
    aph: 9.8,
    tiroPolicial: 9.9,
    mediaFinal: 9.89
  },
  {
    rank: 3,
    nome: "EDSON GARCIA MOREIRA DA SILVA",
    ordenUnidaVC: 9.8,
    ordenUnidaVF: 9.9,
    armamentoVC: 9.7,
    armamentoVF: 9.8,
    comunicacaoVC: 9.8,
    comunicacaoVF: 9.9,
    sistemaSeguranca: 9.7,
    historiaPM: 9.8,
    legislacaoPenal: 9.9,
    educacaoFisica: 9.7,
    educacaoFinanceira: 9.8,
    didatica: 9.9,
    administracaoPublica: 9.7,
    bombeiroMilitar: 9.8,
    direitoAmbiental: 9.9,
    defesaPessoal: 9.7,
    redacaoOficial: 9.8,
    libras: 9.9,
    metodologiaCientifica: 9.7,
    cerimonialProtocolo: 9.8,
    teoriaPolicia: 9.9,
    tecnicasPoliciamento: 9.7,
    popI: 9.8,
    defesaTerritorial: 9.9,
    hipologia: 9.7,
    geopolitica: 9.8,
    policiaComunitaria: 9.9,
    legislacaoPolicial: 9.7,
    direitosHumanos: 9.8,
    medicinaLegal: 9.9,
    direitoProcessual: 9.7,
    direitoPenalMilitar: 9.8,
    direitoAdministrativo: 9.9,
    aph: 9.7,
    tiroPolicial: 9.8,
    mediaFinal: 9.82
  }
  // Add more mock students up to 30 total...
];

// Generate additional mock data to reach 30 students
export const generateMockStudents = (): Student[] => {
  const baseStudents = [...studentsData];
  const additionalNames = [
    "MARIA FERNANDA COSTA", "JOÃO PEDRO SANTOS",
    "ANA CAROLINA LIMA", "RAFAEL HENRIQUE SOUZA", "JESSICA ALMEIDA ROCHA",
    "LUCAS GABRIEL FERREIRA", "CAMILA RODRIGUES NUNES", "DANIEL AUGUSTO OLIVEIRA",
    "BEATRIZ CRISTINA BARBOSA", "FERNANDO JOSÉ MARTINS", "PATRICIA HELENA CRUZ",
    "RODRIGO CESAR PEREIRA", "LETICIA MARQUES DIAS", "GUILHERME ANTONIO REIS",
    "VANESSA CAROLINE MOURA", "BRUNO EDUARDO GOMES", "STEPHANIE VITORIA ARAÚJO",
    "ALESSANDRO RICARDO CORREIA", "PRISCILA ROBERTA NASCIMENTO", "FABIO LUIZ CARDOSO",
    "RENATA APARECIDA MIRANDA", "THIAGO MATEUS RAMOS", "CAROLINE BEATRIZ MONTEIRO",
    "MAURICIO CESAR LOPES", "GRACIELLE DE SIQUEIRA CARVALHO", "PUBLIO FERREIRA MORENO",
    "FELLIPE RAFAEL SANTOS DE SOUZA"
  ];

  let rank = 4;
  for (const name of additionalNames) {
    const mediaFinal = rank === 28 ? 9.31 : rank === 29 ? 9.08 : rank === 30 ? 8.90 : 
                     Math.max(8.90, 10.0 - (rank * 0.04) + (Math.random() * 0.2 - 0.1));
    
    baseStudents.push({
      rank,
      nome: name,
      ordenUnidaVC: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      ordenUnidaVF: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      armamentoVC: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      armamentoVF: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      comunicacaoVC: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      comunicacaoVF: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      sistemaSeguranca: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      historiaPM: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      legislacaoPenal: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      educacaoFisica: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      educacaoFinanceira: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      didatica: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      administracaoPublica: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      bombeiroMilitar: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      direitoAmbiental: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      defesaPessoal: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      redacaoOficial: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      libras: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      metodologiaCientifica: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      cerimonialProtocolo: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      teoriaPolicia: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      tecnicasPoliciamento: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      popI: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      defesaTerritorial: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      hipologia: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      geopolitica: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      policiaComunitaria: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      legislacaoPolicial: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      direitosHumanos: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      medicinaLegal: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      direitoProcessual: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      direitoPenalMilitar: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      direitoAdministrativo: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      aph: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      tiroPolicial: Math.max(8.0, Math.min(10.0, mediaFinal + (Math.random() * 0.4 - 0.2))),
      mediaFinal: Number(mediaFinal.toFixed(2))
    });
    rank++;
  }

  return baseStudents.sort((a, b) => b.mediaFinal - a.mediaFinal || a.nome.localeCompare(b.nome));
};

// Calculate subject progress (graded subjects vs total subjects)
export const calculateSubjectProgress = (students: Student[]) => {
  if (students.length === 0) return { gradedSubjects: 0, totalSubjects: 32 };

  // Define unique subjects (VC and VF count as one subject)
  const subjectGroups = [
    { base: 'ordenUnida', fields: ['ordenUnidaVC', 'ordenUnidaVF'] },
    { base: 'armamento', fields: ['armamentoVC', 'armamentoVF'] },
    { base: 'comunicacao', fields: ['comunicacaoVC', 'comunicacaoVF'] },
    { base: 'sistemaSeguranca', fields: ['sistemaSeguranca'] },
    { base: 'historiaPM', fields: ['historiaPM'] },
    { base: 'legislacaoPenal', fields: ['legislacaoPenal'] },
    { base: 'educacaoFisica', fields: ['educacaoFisica'] },
    { base: 'educacaoFinanceira', fields: ['educacaoFinanceira'] },
    { base: 'didatica', fields: ['didatica'] },
    { base: 'administracaoPublica', fields: ['administracaoPublica'] },
    { base: 'bombeiroMilitar', fields: ['bombeiroMilitar'] },
    { base: 'direitoAmbiental', fields: ['direitoAmbiental'] },
    { base: 'defesaPessoal', fields: ['defesaPessoal'] },
    { base: 'redacaoOficial', fields: ['redacaoOficial'] },
    { base: 'libras', fields: ['libras'] },
    { base: 'metodologiaCientifica', fields: ['metodologiaCientifica'] },
    { base: 'cerimonialProtocolo', fields: ['cerimonialProtocolo'] },
    { base: 'teoriaPolicia', fields: ['teoriaPolicia'] },
    { base: 'tecnicasPoliciamento', fields: ['tecnicasPoliciamento'] },
    { base: 'popI', fields: ['popI'] },
    { base: 'defesaTerritorial', fields: ['defesaTerritorial'] },
    { base: 'hipologia', fields: ['hipologia'] },
    { base: 'geopolitica', fields: ['geopolitica'] },
    { base: 'policiaComunitaria', fields: ['policiaComunitaria'] },
    { base: 'legislacaoPolicial', fields: ['legislacaoPolicial'] },
    { base: 'direitosHumanos', fields: ['direitosHumanos'] },
    { base: 'medicinaLegal', fields: ['medicinaLegal'] },
    { base: 'direitoProcessual', fields: ['direitoProcessual'] },
    { base: 'direitoPenalMilitar', fields: ['direitoPenalMilitar'] },
    { base: 'direitoAdministrativo', fields: ['direitoAdministrativo'] },
    { base: 'aph', fields: ['aph'] },
    { base: 'tiroPolicial', fields: ['tiroPolicial'] }
  ];

  const firstStudent = students[0];
  let gradedSubjects = 0;

  // Check each subject group to see if it has grades
  subjectGroups.forEach(group => {
    const hasGrades = group.fields.some(field => {
      const value = firstStudent[field as keyof Student] as number;
      return value > 0;
    });
    if (hasGrades) gradedSubjects++;
  });

  return {
    gradedSubjects,
    totalSubjects: 32
  };
};

// Calculate KPIs
export const calculateKPIs = (students: Student[]) => {
  const validStudents = students.filter(s => s.mediaFinal > 0);
  const medias = validStudents.map(s => s.mediaFinal);
  
  const mediaTurma = medias.reduce((acc, curr) => acc + curr, 0) / medias.length;
  const variance = medias.reduce((acc, curr) => acc + Math.pow(curr - mediaTurma, 2), 0) / medias.length;
  const desvioPadrao = Math.sqrt(variance);
  
  const maiorMedia = Math.max(...medias);
  const menorMedia = Math.min(...medias);
  
  const alunoMaiorMedia = validStudents.find(s => s.mediaFinal === maiorMedia);
  const alunoMenorMedia = validStudents.find(s => s.mediaFinal === menorMedia);
  
  return {
    mediaTurma: Number(mediaTurma.toFixed(2)),
    desvioPadrao: Number(desvioPadrao.toFixed(2)),
    totalAlunos: validStudents.length,
    maiorMedia: {
      nota: maiorMedia,
      aluno: alunoMaiorMedia?.nome || ''
    },
    menorMedia: {
      nota: menorMedia,
      aluno: alunoMenorMedia?.nome || ''
    }
  };
};

// Get subject averages
export const getSubjectAverages = (students: Student[]) => {
  const subjects = [
    { key: 'ordenUnidaVC', name: 'Ordem Unida VC' },
    { key: 'ordenUnidaVF', name: 'Ordem Unida VF' },
    { key: 'armamentoVC', name: 'Armamento VC' },
    { key: 'armamentoVF', name: 'Armamento VF' },
    { key: 'comunicacaoVC', name: 'Comunicação VC' },
    { key: 'comunicacaoVF', name: 'Comunicação VF' },
    { key: 'sistemaSeguranca', name: 'Sistema de Segurança Pública' },
    { key: 'historiaPM', name: 'História da PM' },
    { key: 'legislacaoPenal', name: 'Legislação Penal' },
    { key: 'educacaoFisica', name: 'Educação Física' },
    { key: 'educacaoFinanceira', name: 'Educação Financeira' },
    { key: 'didatica', name: 'Didática' },
    { key: 'administracaoPublica', name: 'Administração Pública' },
    { key: 'bombeiroMilitar', name: 'Bombeiro Militar' },
    { key: 'direitoAmbiental', name: 'Direito Ambiental' },
    { key: 'defesaPessoal', name: 'Defesa Pessoal' },
    { key: 'redacaoOficial', name: 'Redação Oficial' },
    { key: 'libras', name: 'Libras' },
    { key: 'metodologiaCientifica', name: 'Metodologia Científica' },
    { key: 'cerimonialProtocolo', name: 'Cerimonial e Protocolo' },
    { key: 'teoriaPolicia', name: 'Teoria de Polícia' },
    { key: 'tecnicasPoliciamento', name: 'Técnicas de Policiamento' },
    { key: 'popI', name: 'POP I' },
    { key: 'defesaTerritorial', name: 'Defesa Territorial' },
    { key: 'hipologia', name: 'Hipologia' },
    { key: 'geopolitica', name: 'Geopolítica' },
    { key: 'policiaComunitaria', name: 'Polícia Comunitária' },
    { key: 'legislacaoPolicial', name: 'Legislação Policial' },
    { key: 'direitosHumanos', name: 'Direitos Humanos' },
    { key: 'medicinaLegal', name: 'Medicina Legal' },
    { key: 'direitoProcessual', name: 'Direito Processual' },
    { key: 'direitoPenalMilitar', name: 'Direito Penal Militar' },
    { key: 'direitoAdministrativo', name: 'Direito Administrativo' },
    { key: 'aph', name: 'APH' },
    { key: 'tiroPolicial', name: 'Tiro Policial' }
  ];

  return subjects.map(subject => {
    const values = students.map(s => s[subject.key as keyof Student] as number).filter(v => v > 0);
    const average = values.reduce((acc, curr) => acc + curr, 0) / values.length;
    const variance = values.reduce((acc, curr) => acc + Math.pow(curr - average, 2), 0) / values.length;
    const standardDeviation = Math.sqrt(variance);
    
    return {
      name: subject.name,
      average: Number(average.toFixed(2)),
      standardDeviation: Number(standardDeviation.toFixed(2)),
      count: values.length
    };
  }).sort((a, b) => b.average - a.average);
};