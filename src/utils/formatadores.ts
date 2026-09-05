/**
 * Formata o RG PMMT com ponto após os 3 primeiros dígitos, exigido nos
 * documentos oficiais (Diploma, Histórico Escolar) — ex: "888457" vira
 * "888.457". Só formata quando o valor já vem limpo (só dígitos); se já
 * tiver pontuação, hífen ou letras (alguns RGs vêm com dígito verificador,
 * ex: "2161631-0"), devolve como veio — mais seguro que tentar adivinhar
 * onde pontuar um formato que já não é "6 dígitos corridos".
 */
export function formatarRgPm(valor: string | null): string | null {
  if (!valor) return valor;
  const limpo = valor.trim();
  if (!/^\d{6}$/.test(limpo)) return limpo;
  return `${limpo.slice(0, 3)}.${limpo.slice(3)}`;
}
