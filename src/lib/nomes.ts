// Utilidades para comparar/ordenar nomes de alunos ignorando acentos,
// maiúsculas/minúsculas e espaços extras (ex: "RAÍ KEVIN" == "Rai  Kevin").

export function normalizarNome(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Ordem alfabética em português (acentos não atrapalham a ordem).
export function compararNomes(a: string | null | undefined, b: string | null | undefined): number {
  return (a ?? "").localeCompare(b ?? "", "pt-BR", { sensitivity: "base" });
}
