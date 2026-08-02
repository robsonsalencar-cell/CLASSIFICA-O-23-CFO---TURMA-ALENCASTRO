/**
 * Fórmula oficial de cálculo da Nota Final a partir de VC (Verificação Contínua)
 * e VF (Verificação Final).
 *
 * CONFIRMADO PELO USUÁRIO (exemplo real: Gracielle, Tiro Policial II):
 *   VCs: 2.9, 6.0, 8.0, 1.9 → média = 4.7 (peso 2)
 *   VF: 10 (peso 3)
 *   Nota final = (4.7×2 + 10×3) / 5 = 39.4/5 = 7.88
 *
 * Ou seja: (médiaVC × 2 + VF × 3) / 5  — equivalente a médiaVC×40% + VF×60%.
 */
export function calcularNotaFinal(vc: number | null, vf: number | null): number | null {
  if (vc === null && vf === null) return null;
  if (vc === null) return vf;
  if (vf === null) return vc;
  return Number(((vc * 2 + vf * 3) / 5).toFixed(4));
}

/**
 * Matérias que fogem à regra normal: em vez de fazer a MÉDIA das VCs, o
 * instrutor somou os pontos direto (ex: VC1 = nota da prova, VC2 = pontos
 * extras de um trabalho, somados sem dividir por 2). Confirmado pelo usuário
 * com o caso do Gernaian em "Direito Administrativo Disciplinar Militar I":
 * VC1=7.5 + VC2=2.0(bônus) = 9.5 (soma, não média de 4.75).
 * Válido só para esta turma (23º CFO) — se outra turma tiver a mesma
 * matéria com um instrutor diferente que siga a regra normal, ajuste aqui
 * (pode exigir tornar isso específico por turma, não só por nome de matéria).
 */
export const MATERIAS_SOMA_VC = new Set<string>(["Direito Administrativo Disciplinar Militar I"]);

/**
 * Mesma fórmula, mas aceitando MÚLTIPLAS notas de VC (ex: VC1, VC2, VC3...).
 * Normalmente a "nota VC" usada na fórmula é a média simples de todas as VCs
 * lançadas — EXCETO para as matérias em MATERIAS_SOMA_VC, onde são somadas
 * diretamente. Depois combinada com a VF usando o peso oficial (VC peso 2,
 * VF peso 3).
 */
export function calcularNotaFinalMulti(
  vcLista: number[] | null | undefined,
  vf: number | null,
  materia?: string
): number | null {
  const vcValidos = (vcLista ?? []).filter((v) => typeof v === "number" && !isNaN(v));
  if (vcValidos.length === 0) return calcularNotaFinal(null, vf);

  const somaDireta = materia ? MATERIAS_SOMA_VC.has(materia) : false;
  const vcMedia = somaDireta
    ? vcValidos.reduce((a, b) => a + b, 0)
    : vcValidos.reduce((a, b) => a + b, 0) / vcValidos.length;

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
