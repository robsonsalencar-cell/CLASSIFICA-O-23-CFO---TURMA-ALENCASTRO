/**
 * Fórmula oficial de cálculo da Nota Final a partir de VC (Verificação Contínua)
 * e VF (Verificação Final).
 *
 * PADRÃO ASSUMIDO: média simples — (VC + VF) / 2.
 * Se a fórmula oficial usar pesos diferentes (ex: VC 40% / VF 60%), troque o
 * cálculo abaixo — é o ÚNICO lugar que precisa mudar, tanto o formulário do
 * admin quanto a importação em massa usam esta função.
 */
export function calcularNotaFinal(vc: number | null, vf: number | null): number | null {
  if (vc === null && vf === null) return null;
  if (vc === null) return vf;
  if (vf === null) return vc;
  return Number(((vc + vf) / 2).toFixed(4));
}

/**
 * Mesma fórmula, mas aceitando MÚLTIPLAS notas de VC (ex: VC1, VC2, VC3...).
 * A "nota VC" usada na fórmula é a média simples de todas as VCs lançadas.
 */
export function calcularNotaFinalMulti(
  vcLista: number[] | null | undefined,
  vf: number | null
): number | null {
  const vcValidos = (vcLista ?? []).filter((v) => typeof v === "number" && !isNaN(v));
  const vcMedia = vcValidos.length > 0 ? vcValidos.reduce((a, b) => a + b, 0) / vcValidos.length : null;
  return calcularNotaFinal(vcMedia, vf);
}

/** Converte o texto digitado (ex: "8, 9.5, 7") em uma lista de números válidos. */
export function parseListaVc(texto: string): number[] {
  return texto
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "")
    .map((t) => Number(t.replace(",", ".")))
    .filter((n) => !isNaN(n));
}
