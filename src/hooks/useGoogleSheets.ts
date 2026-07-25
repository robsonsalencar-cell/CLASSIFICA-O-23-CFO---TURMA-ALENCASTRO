import { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { Student } from '@/data/mockData';
import { CURRICULAR_MATRIX_SUBJECTS } from '@/data/curricularMatrix';

export interface StudentGrades {
  [subject: string]: number;
}

export interface DetailedStudent extends Student {
  grades: StudentGrades;
  gradesPerCfo?: {
    cfoI?: StudentGrades;
    cfoII?: StudentGrades;
    cfoIII?: StudentGrades;
  };
  cfoAverages?: {
    cfoI?: number;
    cfoII?: number;
    cfoIII?: number;
  };
}

export interface GoogleSheetsHook {
  students: DetailedStudent[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  subjectsLaunched: number;
  launchedSubjects: string[];
  allSubjects: string[];
}

// Planilha CLASSIFICAÇÃO_23_CFO_NOVA_FORMULA
const SPREADSHEET_ID = '1tJnMN1BY5oYmNt4Z3Jysfv8E4TSuFtSj';

// Aba "CLASSIFICAÇÃO FINAL DO CFO" – ranking e médias finais
const MAIN_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=1220061579`;

// Abas CFO 1, CFO 2, CFO 3 – notas detalhadas por matéria
const SUBJECTS_SHEETS_URLS = [
  `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=1004161421`,
  `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=453878135`,
  `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=187280075`
];

// Mapeamento das colunas da planilha para os campos do Student
const COLUMN_MAPPING: Record<string, keyof Student> = {
  'RANK': 'rank',
  'NOME': 'nome',
  'ORDEM UNIDA VC': 'ordenUnidaVC',
  'ORDEM UNIDA VF': 'ordenUnidaVF',
  'ARMAMENTO MUNIÇÃO E EXPLOSIVO VC': 'armamentoVC',
  'ARMAMENTO MUNIÇÃO E EXPLOSIVO VF': 'armamentoVF',
  'Comunicação Operacional VC': 'comunicacaoVC',
  'Comunicação Operacional VF': 'comunicacaoVF',
  'Sistema de Segurança Pública no Brasil': 'sistemaSeguranca',
  'História da Policia Militar': 'historiaPM',
  'Legislação Penal Extravagante I': 'legislacaoPenal',
  'Educação Física Policial Militar I': 'educacaoFisica',
  'Educação Financeira': 'educacaoFinanceira',
  'Didática: Sistema de Ensino': 'didatica',
  'Administração Pública Gerencial ': 'administracaoPublica',
  'Bombeiro Militar e Defesa Civil ': 'bombeiroMilitar',
  'Direito Ambiental ': 'direitoAmbiental',
  'Defesa Pessoal I': 'defesaPessoal',
  'Redação Oficial Aplicada ': 'redacaoOficial',
  'Libras ': 'libras',
  'Metodologia Científica / Pesquisa ': 'metodologiaCientifica',
  'CERIMONIAL E PROTOCOLO': 'cerimonialProtocolo',
  'Teoria de Policia ': 'teoriaPolicia',
  'Técnicas Gerais de Policiamento I': 'tecnicasPoliciamento',
  'POP I ': 'popI',
  'Defesa Territorial I ': 'defesaTerritorial',
  'Hipologia e Equitação ': 'hipologia',
  'Geopolítica de Mato Grosso ': 'geopolitica',
  'Policia Comunitária ': 'policiaComunitaria',
  'Legislação Policial Militar I': 'legislacaoPolicial',
  'Direitos humanos': 'direitosHumanos',
  'Medicina Legal': 'medicinaLegal',
  'Direito Processual Penal Militar I': 'direitoProcessual',
  'Direito Penal Militar I': 'direitoPenalMilitar',
  'Direito Administrativo Disciplinar Militar I': 'direitoAdministrativo',
  'APH': 'aph',
  'TIRO POLICIAL ': 'tiroPolicial',
  'MÉDIA FINAL': 'mediaFinal'
};

const parseNumericValue = (value: string): number => {
  if (!value || value.trim() === '') return 0;
  // Replace comma with dot for decimal separation
  const normalized = value.toString().replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
};

const cleanName = (name: string): string => {
  return name?.trim().toUpperCase() || '';
};

export const useGoogleSheets = (): GoogleSheetsHook => {
  const [students, setStudents] = useState<DetailedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjectsLaunched, setSubjectsLaunched] = useState(13);
  const [launchedSubjects, setLaunchedSubjects] = useState<string[]>([]);
  const [allSubjects, setAllSubjects] = useState<string[]>([]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Buscar planilha principal para ranking e médias
      const mainResponse = await fetch(MAIN_SHEET_URL);
      if (!mainResponse.ok) {
        throw new Error(`HTTP error na planilha principal! status: ${mainResponse.status}`);
      }
      const mainCsvText = await mainResponse.text();
      
      // 2. Buscar planilhas de matérias para contagem
      const subjectResponses = await Promise.all(
        SUBJECTS_SHEETS_URLS.map(url => fetch(url))
      );
      
      subjectResponses.forEach((response, index) => {
        if (!response.ok) {
          throw new Error(`HTTP error na planilha de matérias ${index + 1}! status: ${response.status}`);
        }
      });

      const subjectCsvTexts = await Promise.all(
        subjectResponses.map(response => response.text())
      );
      
      // Processar planilha principal para os alunos e rankings
      const mainStudents = await new Promise<DetailedStudent[]>((resolve, reject) => {
        Papa.parse(mainCsvText, {
          header: false,
          skipEmptyLines: true,
          complete: (results) => {
            try {
              console.log('Planilha Principal - Raw CSV data (first 5 rows):', results.data.slice(0, 5));
              
              const parsedStudents: DetailedStudent[] = [];
              const headerRowIndex = 2;
              const subjectColumnMap = new Map<number, string>();
              
              if (results.data.length > headerRowIndex) {
                const headers = results.data[headerRowIndex] as string[];
                console.log('Planilha Principal - Headers da linha 3:', headers);
                
                let mediaFinalIndex = headers.length;
                for (let i = headers.length - 1; i >= 0; i--) {
                  if (headers[i] && headers[i].toString().toUpperCase().includes('MÉDIA FINAL')) {
                    mediaFinalIndex = i;
                    break;
                  }
                }
                
                for (let colIndex = 2; colIndex < mediaFinalIndex; colIndex++) {
                  const header = headers[colIndex];
                  if (header && header.toString().trim() !== '') {
                    const fullSubjectName = header.toString().trim();
                    subjectColumnMap.set(colIndex, fullSubjectName);
                  }
                }
              }
              
              // Processar dados dos alunos
              results.data.forEach((row: any, index: number) => {
                if (index <= headerRowIndex) return;
                
                const rankValue = row[0];
                const nomeValue = row[1];
                const mediaValue = row[2];

                if (!rankValue || !nomeValue || !mediaValue) return;
                if (cleanName(nomeValue) === 'ANGELO MARCIO FERREIRA MENEZES') return;

                const rankNum = parseInt(rankValue);
                if (isNaN(rankNum)) return;
                
                const grades: StudentGrades = {};
                subjectColumnMap.forEach((subjectName, colIndex) => {
                  if (row[colIndex] && row[colIndex].toString().trim() !== '') {
                    const grade = parseNumericValue(row[colIndex]);
                    if (grade >= 0 && grade <= 10) {
                      grades[subjectName] = grade;
                    }
                  }
                });
                
                const student: DetailedStudent = {
                  rank: rankNum,
                  nome: cleanName(nomeValue),
                  mediaFinal: parseNumericValue(mediaValue),
                  grades: grades,
                  ordenUnidaVC: 0,
                  ordenUnidaVF: 0,
                  armamentoVC: 0,
                  armamentoVF: 0,
                  comunicacaoVC: 0,
                  comunicacaoVF: 0,
                  sistemaSeguranca: 0,
                  historiaPM: 0,
                  legislacaoPenal: 0,
                  educacaoFisica: 0,
                  educacaoFinanceira: 0,
                  didatica: 0,
                  administracaoPublica: 0,
                  bombeiroMilitar: 0,
                  direitoAmbiental: 0,
                  defesaPessoal: 0,
                  redacaoOficial: 0,
                  libras: 0,
                  metodologiaCientifica: 0,
                  cerimonialProtocolo: 0,
                  teoriaPolicia: 0,
                  tecnicasPoliciamento: 0,
                  popI: 0,
                  defesaTerritorial: 0,
                  hipologia: 0,
                  geopolitica: 0,
                  policiaComunitaria: 0,
                  legislacaoPolicial: 0,
                  direitosHumanos: 0,
                  medicinaLegal: 0,
                  direitoProcessual: 0,
                  direitoPenalMilitar: 0,
                  direitoAdministrativo: 0,
                  aph: 0,
                  tiroPolicial: 0
                };

                if (student.nome && student.nome.trim() !== '' && 
                    student.nome !== 'NOME' &&
                    student.mediaFinal && student.mediaFinal > 0) {
                  parsedStudents.push(student);
                }
              });
              
              parsedStudents.sort((a, b) => {
                const gradeDiff = b.mediaFinal - a.mediaFinal;
                if (gradeDiff !== 0) return gradeDiff;
                return a.nome.localeCompare(b.nome);
              });

              parsedStudents.forEach((student, index) => {
                student.rank = index + 1;
              });
              
              console.log(`✓ Planilha Principal: ${parsedStudents.length} students`);
              resolve(parsedStudents);
            } catch (parseError) {
              console.error('Error parsing main CSV:', parseError);
              reject(parseError);
            }
          },
          error: (error) => {
            console.error('Papa Parse error on main sheet:', error);
            reject(error);
          }
        });
      });
      
      // Processar planilhas de matérias para contagem e notas detalhadas
      const allSubjectsSet = new Set<string>();
      const allHeadersSet = new Set<string>();
      const cfoAveragesMap = new Map<string, { cfoI?: number; cfoII?: number; cfoIII?: number }>();
      
      // Map para armazenar notas detalhadas por aluno (mescladas, último CFO ganha)
      const studentGradesMap = new Map<string, StudentGrades>();
      // Map para armazenar notas detalhadas por aluno separadas por CFO
      const studentGradesPerCfoMap = new Map<string, { cfoI?: StudentGrades; cfoII?: StudentGrades; cfoIII?: StudentGrades }>();
      
      for (let sheetIndex = 0; sheetIndex < subjectCsvTexts.length; sheetIndex++) {
        const csvText = subjectCsvTexts[sheetIndex];
        
        await new Promise<void>((resolve, reject) => {
          Papa.parse(csvText, {
            header: false,
            skipEmptyLines: true,
            complete: (results) => {
              try {
                console.log(`Planilha de Matérias ${sheetIndex + 1} - Raw CSV data (first 5 rows):`, results.data.slice(0, 5));
                
                const sheetSubjectsSet = new Set<string>();
                
                // Usar especificamente a linha 3 (índice 2) para os cabeçalhos
                const headerRowIndex = 2;
                const subjectColumnMap = new Map<number, string>();
                
                if (results.data.length > headerRowIndex) {
                  const headers = results.data[headerRowIndex] as string[];
                  console.log(`Planilha ${sheetIndex + 1} - Headers da linha 3:`, headers);
                  
                  // Encontrar o índice da coluna "MÉDIA FINAL"
                  let mediaFinalIndex = headers.length;
                  for (let i = headers.length - 1; i >= 0; i--) {
                    if (headers[i] && headers[i].toString().toUpperCase().includes('MÉDIA FINAL')) {
                      mediaFinalIndex = i;
                      break;
                    }
                  }
                  
                  // Processar matérias da coluna C (índice 2) até antes da "MÉDIA FINAL"
                  for (let colIndex = 2; colIndex < mediaFinalIndex; colIndex++) {
                    const header = headers[colIndex];
                    
                    if (header && header.toString().trim() !== '') {
                      const fullSubjectName = header.toString().trim();
                      subjectColumnMap.set(colIndex, fullSubjectName);
                      
                      // Add to all headers (normalized) regardless of grades
                      let normalizedHeader = fullSubjectName.replace(/\s+(VC|VF)\s*\d*\s*$/i, '').replace(/\s+/g, ' ').trim();
                      if (normalizedHeader.length > 2) {
                        allHeadersSet.add(normalizedHeader);
                      }
                      
                      // Verificar se há pelo menos uma nota válida nesta coluna
                      let hasValidGrade = false;
                      
                      for (let rowIndex = headerRowIndex + 1; rowIndex < results.data.length; rowIndex++) {
                        const dataRow = results.data[rowIndex] as any[];
                        if (!dataRow || dataRow.length <= colIndex) continue;
                        
                        const cellValue = dataRow[colIndex];
                        if (cellValue && cellValue.toString().trim() !== '') {
                          const numericValue = cellValue.toString().replace(',', '.');
                          const grade = parseFloat(numericValue);
                          
                          if (!isNaN(grade) && grade >= 0 && grade <= 10) {
                            hasValidGrade = true;
                            break;
                          }
                        }
                      }
                      
                      if (hasValidGrade) {
                        // Normalizar o nome da matéria removendo VC1, VC2, VF, etc.
                        let subjectName = header.toString().trim();
                        subjectName = subjectName.replace(/\s+(VC|VF)\s*\d*\s*$/i, '');
                        subjectName = subjectName.replace(/\s+/g, ' ').trim();
                        
                        if (subjectName.length > 2) {
                          sheetSubjectsSet.add(subjectName);
                          allSubjectsSet.add(subjectName);
                        }
                      }
                    }
                  }
                  
                  // Processar notas detalhadas dos alunos
                  for (let rowIndex = headerRowIndex + 1; rowIndex < results.data.length; rowIndex++) {
                    const dataRow = results.data[rowIndex] as any[];
                    if (!dataRow || dataRow.length < 2) continue;
                    
                    const studentName = cleanName(dataRow[1]);
                    if (!studentName || studentName === 'NOME') continue;
                    
                    // Inicializar grades do aluno se não existir
                    if (!studentGradesMap.has(studentName)) {
                      studentGradesMap.set(studentName, {});
                    }
                    if (!studentGradesPerCfoMap.has(studentName)) {
                      studentGradesPerCfoMap.set(studentName, {});
                    }
                    
                    const studentGrades = studentGradesMap.get(studentName)!;
                    const perCfo = studentGradesPerCfoMap.get(studentName)!;
                    const cfoKey = sheetIndex === 0 ? 'cfoI' : sheetIndex === 1 ? 'cfoII' : 'cfoIII';
                    if (!perCfo[cfoKey]) perCfo[cfoKey] = {};
                    const cfoGrades = perCfo[cfoKey]!;
                    
                    // Processar notas de cada matéria
                    subjectColumnMap.forEach((subjectName, colIndex) => {
                      if (dataRow[colIndex] && dataRow[colIndex].toString().trim() !== '') {
                        const grade = parseNumericValue(dataRow[colIndex]);
                        if (grade >= 0 && grade <= 10) {
                          studentGrades[subjectName] = grade;
                          cfoGrades[subjectName] = grade;
                        }
                      }
                    });
                  }
                  
                  // Extract MÉDIA FINAL per student for CFO averages
                  for (let rowIndex = headerRowIndex + 1; rowIndex < results.data.length; rowIndex++) {
                    const dataRow = results.data[rowIndex] as any[];
                    if (!dataRow || dataRow.length < 2) continue;
                    const studentName = cleanName(dataRow[1]);
                    if (!studentName || studentName === 'NOME') continue;
                    
                    if (mediaFinalIndex < dataRow.length && dataRow[mediaFinalIndex]) {
                      const mediaValue = parseNumericValue(dataRow[mediaFinalIndex]);
                      if (mediaValue > 0 && mediaValue <= 10) {
                        if (!cfoAveragesMap.has(studentName)) {
                          cfoAveragesMap.set(studentName, {});
                        }
                        const avg = cfoAveragesMap.get(studentName)!;
                        if (sheetIndex === 0) avg.cfoI = mediaValue;
                        else if (sheetIndex === 1) avg.cfoII = mediaValue;
                        else if (sheetIndex === 2) avg.cfoIII = mediaValue;
                      }
                    }
                  }
                  
                  console.log(`✓ Planilha de Matérias ${sheetIndex + 1} - Detected ${sheetSubjectsSet.size} unique subjects`);
                }
                
                resolve();
              } catch (parseError) {
                console.error(`Error parsing CSV data from sheet ${sheetIndex + 1}:`, parseError);
                reject(parseError);
              }
            },
            error: (error) => {
              console.error(`Papa Parse error on sheet ${sheetIndex + 1}:`, error);
              reject(error);
            }
          });
        });
      }
      
      // Mesclar notas detalhadas e CFO averages nos alunos
      mainStudents.forEach(student => {
        const detailedGrades = studentGradesMap.get(student.nome);
        if (detailedGrades) {
          student.grades = { ...student.grades, ...detailedGrades };
        }
        const perCfo = studentGradesPerCfoMap.get(student.nome);
        if (perCfo) {
          student.gradesPerCfo = perCfo;
        }
        const cfoAvg = cfoAveragesMap.get(student.nome);
        if (cfoAvg) {
          student.cfoAverages = cfoAvg;
        }
        // NOTE: mediaFinal preserved from main sheet (column C) — authoritative value
      });

      // Incluir alunos que estão nas planilhas de matérias mas ausentes na
      // planilha principal (ex.: WENDER). A média final é calculada como a
      // média das médias finais de cada CFO disponível.
      const mainNames = new Set(mainStudents.map(s => s.nome));
      cfoAveragesMap.forEach((cfoAvg, name) => {
        if (mainNames.has(name)) return;
        if (name === 'ANGELO MARCIO FERREIRA MENEZES') return;
        const values = [cfoAvg.cfoI, cfoAvg.cfoII, cfoAvg.cfoIII].filter(
          (v): v is number => typeof v === 'number' && v > 0
        );
        if (values.length === 0) return;
        const media = values.reduce((s, v) => s + v, 0) / values.length;
        const extraStudent: DetailedStudent = {
          rank: 0,
          nome: name,
          mediaFinal: media,
          grades: studentGradesMap.get(name) ?? {},
          gradesPerCfo: studentGradesPerCfoMap.get(name),
          cfoAverages: cfoAvg,
          ordenUnidaVC: 0, ordenUnidaVF: 0, armamentoVC: 0, armamentoVF: 0,
          comunicacaoVC: 0, comunicacaoVF: 0, sistemaSeguranca: 0, historiaPM: 0,
          legislacaoPenal: 0, educacaoFisica: 0, educacaoFinanceira: 0, didatica: 0,
          administracaoPublica: 0, bombeiroMilitar: 0, direitoAmbiental: 0,
          defesaPessoal: 0, redacaoOficial: 0, libras: 0, metodologiaCientifica: 0,
          cerimonialProtocolo: 0, teoriaPolicia: 0, tecnicasPoliciamento: 0, popI: 0,
          defesaTerritorial: 0, hipologia: 0, geopolitica: 0, policiaComunitaria: 0,
          legislacaoPolicial: 0, direitosHumanos: 0, medicinaLegal: 0,
          direitoProcessual: 0, direitoPenalMilitar: 0, direitoAdministrativo: 0,
          aph: 0, tiroPolicial: 0,
        };
        mainStudents.push(extraStudent);
      });

      // Reordenar após recalcular médias finais e atualizar ranks
      mainStudents.sort((a, b) => {
        const gradeDiff = b.mediaFinal - a.mediaFinal;
        if (gradeDiff !== 0) return gradeDiff;
        return a.nome.localeCompare(b.nome);
      });

      mainStudents.forEach((student, index) => {
        student.rank = index + 1;
      });
      
      // Converter sets para arrays ordenados
      const allSubjectsArray = Array.from(allSubjectsSet).sort();

      // Universo total de matérias vem da Matriz Curricular oficial (85 disciplinas).
      // A quantidade "lançadas" continua sendo detectada dinamicamente nas planilhas.
      setSubjectsLaunched(allSubjectsArray.length);
      setLaunchedSubjects(allSubjectsArray);
      setAllSubjects(CURRICULAR_MATRIX_SUBJECTS);
      setStudents(mainStudents);

      console.log(`✓ Total: ${mainStudents.length} students from main sheet`);
      console.log(`✓ ${allSubjectsArray.length} matérias lançadas de ${CURRICULAR_MATRIX_SUBJECTS.length} previstas na matriz`);
      console.log(`✓ Matérias lançadas:`, allSubjectsArray);
      
    } catch (fetchError) {
      console.error('Error fetching data:', fetchError);
      setError('Erro ao conectar com as planilhas do Google Sheets. Verifique a URL e as permissões.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const refetch = () => {
    fetchData();
  };

  return {
    students,
    loading,
    error,
    refetch,
    subjectsLaunched,
    launchedSubjects,
    allSubjects
  };
};