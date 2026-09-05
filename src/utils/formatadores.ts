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
  // Só formata dígitos puros (sem pontuação, hífen ou letra — ex: RG com
  // dígito verificador tipo "2161631-0" já vem assim e deve ser devolvido
  // como veio, mais seguro que tentar adivinhar onde pontuar).
  if (!/^\d+$/.test(limpo) || limpo.length <= 3) return limpo;
  // Agrupa em blocos de 3 a partir da direita, separados por ponto — mesma
  // convenção usada em RG/CPF nos documentos oficiais (confirmado com dado
  // real de 6 dígitos: "888457" -> "888.457"; generaliza pra outros
  // tamanhos de RG, já que nem todo RG PM tem exatamente 6 dígitos).
  return limpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
