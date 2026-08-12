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

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** Formata uma data como "11 de agosto de 2026", usada na linha de emissão do Histórico. */
export function dataPorExtenso(data: Date): string {
  return `${data.getDate()} de ${MESES[data.getMonth()]} de ${data.getFullYear()}`;
}
