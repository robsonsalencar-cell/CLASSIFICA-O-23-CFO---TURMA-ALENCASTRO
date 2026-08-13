export interface ImagemBrasao {
  bytes: Uint8Array;
  dataUrl: string;
  formato: "png" | "jpg";
}

/**
 * Baixa o brasão da turma (ou o brasão padrão do sistema, se a turma não
 * tiver um próprio) pra embutir centralizado no cabeçalho dos documentos
 * exportados (Boletim e Histórico). Retorna null se o download falhar — o
 * documento é gerado mesmo assim, só sem a imagem.
 */
export async function carregarImagemBrasao(url: string | null): Promise<ImagemBrasao | null> {
  const urlFinal = url ?? "/lovable-uploads/brasao-novo.png";
  try {
    const resp = await fetch(urlFinal);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const formato: "png" | "jpg" = blob.type.includes("png") ? "png" : "jpg";
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { bytes, dataUrl, formato };
  } catch {
    return null;
  }
}
