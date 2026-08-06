import { useEffect } from "react";

const TODAS_AS_CLASSES_DE_TEMA = ["tema-cfo1", "tema-cfo2", "tema-cfo3", "tema-geral"];

/**
 * Aplica a classe de tema do módulo no <html>, não só num <div> da página.
 * Isso é necessário porque modais, dropdowns e outros componentes do Radix UI
 * renderizam via "portal" — vão direto para o final do <body>, FORA da árvore
 * do <div> da página. Se a cor do tema só estivesse no <div>, esses elementos
 * portados ficariam sempre com a cor padrão (dourado), ignorando o módulo.
 * Aplicando no <html>, tudo (portado ou não) herda a cor certa.
 */
export function useTemaModulo(tema: "tema-cfo1" | "tema-cfo2" | "tema-cfo3" | "tema-geral") {
  useEffect(() => {
    const root = document.documentElement;
    TODAS_AS_CLASSES_DE_TEMA.forEach((c) => root.classList.remove(c));
    root.classList.add(tema);
    return () => {
      root.classList.remove(tema);
    };
  }, [tema]);
}
