const UNIDADES = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const DEZ_A_DEZENOVE = [
  "dez", "onze", "doze", "treze", "quatorze", "quinze",
  "dezesseis", "dezessete", "dezoito", "dezenove",
];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos",
  "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos",
];
const INTEIRO_0_A_10 = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez"];

function extensoTresDigitos(n: number): string {
  if (n === 0) return "zero";
  if (n === 100) return "cem";
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const dezena = Math.floor(resto / 10);
  const unidade = resto % 10;
  const partes: string[] = [];
  if (centena > 0) partes.push(CENTENAS[centena]);
  if (resto > 0) {
    if (partes.length > 0) partes.push("e");
    if (resto < 10) partes.push(UNIDADES[resto]);
    else if (resto < 20) partes.push(DEZ_A_DEZENOVE[resto - 10]);
    else {
      partes.push(DEZENAS[dezena]);
      if (unidade > 0) {
        partes.push("e");
        partes.push(UNIDADES[unidade]);
      }
    }
  }
  return partes.join(" ");
}

/**
 * Converte uma nota (0 a 10, até 3 casas decimais) para o formato usado no
 * Histórico Escolar: notaPorExtenso(8.576) === "oito vírgula quinhentos e
 * setenta e seis" (as 3 casas decimais são lidas como um número inteiro de
 * 0 a 999, não dígito a dígito — mesma convenção do modelo original). Nota
 * exata (ex: 10.000) devolve só a parte inteira, sem "vírgula".
 */
export function notaPorExtenso(valor: number): string {
  const arredondado = Math.round(valor * 1000) / 1000;
  const parteInteira = Math.min(10, Math.max(0, Math.floor(arredondado)));
  const parteDecimal = Math.round((arredondado - parteInteira) * 1000);
  const extensoInteiro = INTEIRO_0_A_10[parteInteira];
  if (parteDecimal === 0) return extensoInteiro;
  return `${extensoInteiro} vírgula ${extensoTresDigitos(parteDecimal)}`;
}

/**
 * Converte uma nota (0 a 10, até 4 casas decimais) para o formato usado nas
 * Atas de Encerramento/Classificação Geral: notaPorExtenso4(9.7894) ===
 * "nove vírgula sete mil oitocentos e noventa e quatro". Diferente de
 * notaPorExtenso() (3 casas, usado só no Histórico Escolar) — as 4 casas
 * decimais são lidas como um número de 0 a 9999, com "X mil" na frente
 * quando >= 1000 (sem "e" entre o "mil" e o resto, ex: "seis mil setenta e
 * cinco", não "seis mil e setenta e cinco") — convenção conferida contra as
 * 4 Atas reais da 23ª turma (1º/2º/3º Ano e Classificação Geral).
 */
export function notaPorExtenso4(valor: number): string {
  const arredondado = Math.round(valor * 10000) / 10000;
  const parteInteira = Math.min(10, Math.max(0, Math.floor(arredondado)));
  const parteDecimal = Math.round((arredondado - parteInteira) * 10000);
  const extensoInteiro = INTEIRO_0_A_10[parteInteira];
  if (parteDecimal === 0) return extensoInteiro;
  const milhares = Math.floor(parteDecimal / 1000);
  const resto = parteDecimal % 1000;
  let extensoDecimal: string;
  if (milhares === 0) {
    extensoDecimal = extensoTresDigitos(resto);
  } else {
    const prefixo = `${UNIDADES[milhares]} mil`;
    extensoDecimal = resto === 0 ? prefixo : `${prefixo} ${extensoTresDigitos(resto)}`;
  }
  return `${extensoInteiro} vírgula ${extensoDecimal}`;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Formata uma data como "11 de agosto de 2026", usada na linha de emissão do Histórico. */
export function dataPorExtenso(data: Date): string {
  return `${data.getDate()} de ${MESES[data.getMonth()]} de ${data.getFullYear()}`;
}

/**
 * Número cardinal por extenso com a gramática PADRÃO do português (com "e"
 * entre "mil" e o restante quando o restante é < 100 ou múltiplo de 100) —
 * diferente de notaPorExtenso4, que usa a convenção específica das Atas
 * (sem esse "e"). Usado só para dia/ano na abertura da Ata de Encerramento
 * ("Aos dois dias do mês de setembro do ano de dois mil e vinte e seis").
 * Cobre 0–9999, suficiente para dia do mês (1–31) e ano.
 */
export function numeroCardinalPorExtenso(n: number): string {
  if (n === 0) return "zero";
  const milhares = Math.floor(n / 1000);
  const resto = n % 1000;
  if (milhares === 0) return extensoTresDigitos(resto);
  const prefixo = milhares === 1 ? "mil" : `${UNIDADES[milhares]} mil`;
  if (resto === 0) return prefixo;
  const juntar = resto < 100 || resto % 100 === 0 ? " e " : " ";
  return `${prefixo}${juntar}${extensoTresDigitos(resto)}`;
}

/**
 * Formata a abertura padrão de uma Ata: "Aos dois dias do mês de setembro
 * do ano de dois mil e vinte e seis". Recebe uma data no formato "YYYY-MM-DD"
 * (como vem de um <input type="date"> ou de comissoes_encerramento.data_reuniao).
 */
export function aberturaAtaPorExtenso(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split("-").map(Number);
  const diaTexto = dia === 1 ? "um" : numeroCardinalPorExtenso(dia);
  return `Aos ${diaTexto} dias do mês de ${MESES[mes - 1]} do ano de ${numeroCardinalPorExtenso(ano)}`;
}
