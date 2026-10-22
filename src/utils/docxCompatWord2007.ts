import JSZip from "jszip";
import { Packer, type Document } from "docx";

/**
 * Pós-processa o .docx gerado pela biblioteca `docx` para o Word 2007 (e
 * versões mais antigas do Office) conseguir abrir. A biblioteca grava
 * recursos de Word 2010+ que o Word 2007 não conhece e trata como arquivo
 * corrompido ("O arquivo XML aberto do Office ... não pode ser aberto porque
 * há problemas com o conteúdo"):
 *  - <w:compat><w:compatSetting .../> em settings.xml (Word 2010+);
 *  - atributo title="" em wp:docPr (Word 2010+);
 *  - atributos w14:/w15: (ex: w15:tentative em numbering.xml);
 *  - wp:docPr com id repetido (todas as imagens saíam com id="1") e name vazio.
 * Tudo isso é cosmético/ignorável — o documento abre igual nas versões novas
 * (Word atual e LibreOffice) e passa a abrir também no Word 2007.
 */
async function sanear(blob: Blob): Promise<Blob> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());

  const settings = zip.file("word/settings.xml");
  if (settings) {
    const xml = (await settings.async("string")).replace(/<w:compat>[\s\S]*?<\/w:compat>/g, "").replace(/<w:compat\/>/g, "");
    zip.file("word/settings.xml", xml);
  }

  for (const nome of Object.keys(zip.files)) {
    if (!/^word\/[^/]+\.xml$/.test(nome)) continue;
    const arquivo = zip.file(nome);
    if (!arquivo) continue;
    let xml = await arquivo.async("string");
    const original = xml;

    // Atributos de namespaces novos (w14/w15/wp14), que o Word 2007 não conhece.
    xml = xml.replace(/\s(?:w14|w15|wp14):[A-Za-z]+="[^"]*"/g, "");

    if (nome === "word/document.xml") {
      let proximoId = 1;
      xml = xml.replace(/<wp:docPr\b[^>]*?\/>/g, () => {
        const id = proximoId++;
        return `<wp:docPr id="${id}" name="Imagem ${id}"/>`;
      });
    }

    if (xml !== original) zip.file(nome, xml);
  }

  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

/** Substitui Packer.toBlob(doc): gera o .docx já compatível com Word 2007. */
export async function docxParaBlob(doc: Document): Promise<Blob> {
  return sanear(await Packer.toBlob(doc));
}
