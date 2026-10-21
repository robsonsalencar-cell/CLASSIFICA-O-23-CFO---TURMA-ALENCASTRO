import jsPDF from "jspdf";

/**
 * Converte um .docx (já gerado em memória) em PDF, inteiramente no navegador —
 * pra quem está num computador sem pacote Office e não consegue abrir Word.
 * Renderiza o próprio .docx com docx-preview (mantém o layout/brasões do
 * documento original, sem precisar reescrever o documento em outro formato) e
 * tira uma "foto" de cada página pro PDF. O PDF sai como imagem (texto não
 * selecionável), mas imprime/visualiza normalmente em qualquer leitor.
 */
export async function docxBlobParaPdfBlob(docxBlob: Blob): Promise<Blob> {
  // Importados sob demanda: bibliotecas pesadas, só carregam quando alguém
  // realmente pede um PDF (não pesam no carregamento normal do app).
  const [{ renderAsync }, { default: html2canvas }] = await Promise.all([
    import("docx-preview"),
    import("html2canvas"),
  ]);

  const palco = document.createElement("div");
  // Fora da tela (e não display:none, que impede a medição do layout).
  palco.style.cssText = "position:fixed;left:-100000px;top:0;background:#fff;";
  document.body.appendChild(palco);

  try {
    await renderAsync(docxBlob, palco, undefined, {
      inWrapper: false,
      breakPages: true,
      ignoreLastRenderedPageBreak: true,
      renderHeaders: true,
      renderFooters: true,
    });

    if ((document as any).fonts?.ready) await (document as any).fonts.ready;
    // Aguarda as imagens (brasões, selo) terminarem de carregar.
    await Promise.all(
      Array.from(palco.querySelectorAll("img")).map((img) =>
        img.complete ? Promise.resolve() : new Promise<void>((ok) => { img.onload = img.onerror = () => ok(); })
      )
    );

    const paginas = Array.from(palco.querySelectorAll<HTMLElement>("section.docx"));
    if (paginas.length === 0) throw new Error("Não foi possível renderizar o documento para PDF.");

    let pdf: jsPDF | null = null;
    for (const pagina of paginas) {
      const canvas = await html2canvas(pagina, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const larguraPt = (pagina.offsetWidth * 72) / 96;
      const alturaPt = (pagina.offsetHeight * 72) / 96;
      const orientacao = larguraPt > alturaPt ? "landscape" : "portrait";
      if (!pdf) {
        pdf = new jsPDF({ orientation: orientacao, unit: "pt", format: [larguraPt, alturaPt] });
      } else {
        pdf.addPage([larguraPt, alturaPt], orientacao);
      }
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, larguraPt, alturaPt);
    }
    return pdf!.output("blob");
  } finally {
    palco.remove();
  }
}
