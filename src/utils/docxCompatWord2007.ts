import JSZip from "jszip";
import { Packer, type Document } from "docx";

/**
 * Pós-processa o .docx gerado pela biblioteca `docx` para o Word 2007 (e
 * versões mais antigas do Office) conseguir abrir. O Word 2007 valida o XML de
 * forma bem mais rígida que as versões novas e recusa o arquivo ("O arquivo
 * XML aberto do Office ... não pode ser aberto porque há problemas com o
 * conteúdo") quando encontra recursos de Word 2010+ ou referências soltas.
 * Referência de comparação: o MESMO diploma regravado pelo LibreOffice abriu
 * no Word 2007 da APMCV; esta função deixa o arquivo com a mesma "cara" simples
 * (sem declarações de namespaces novos, sem partes não usadas, com os estilos
 * padrão presentes). Em versões novas do Word e no LibreOffice o documento
 * continua idêntico — só some o que não era usado.
 *
 *  - remove mc:Ignorable e os xmlns de namespaces novos (w14, w15, w16*, wp14,
 *    cx*, wpc, wpg, wpi, wps, wne) e atributos desses namespaces;
 *  - remove w:compat de settings.xml, title= em wp:docPr, e renumera os
 *    wp:docPr (todos saíam com id="1" e name vazio);
 *  - remove as partes vazias não usadas (comentários, notas de rodapé/fim,
 *    propriedades personalizadas) quando o documento não as referencia;
 *  - acrescenta os estilos padrão que o resto do arquivo referencia mas não
 *    define (Normal, DefaultParagraphFont, TableNormal, NoList).
 */
const PREFIXOS_NOVOS = /^(?:w14|w15|w16[a-z]*|wp14|wpc|wpg|wpi|wps|wne|cx\d?|aink|am3d|w10)$/;

function limparNamespaces(xml: string): string {
  const abertura = xml.match(/<(?!\?)[A-Za-z][^>]*>/);
  if (!abertura) return xml;
  let tag = abertura[0];
  tag = tag.replace(/\smc:Ignorable="[^"]*"/, "");
  tag = tag.replace(/\sxmlns:([A-Za-z0-9]+)="[^"]*"/g, (decl, prefixo: string) => (PREFIXOS_NOVOS.test(prefixo) ? "" : decl));
  return xml.replace(abertura[0], tag);
}

async function sanear(blob: Blob): Promise<Blob> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());

  const docXml = await zip.file("word/document.xml")!.async("string");
  const referencia = (re: RegExp) => re.test(docXml);

  // Partes não usadas que podem ser removidas com segurança.
  const candidatas: { caminho: string; usada: boolean }[] = [
    { caminho: "word/comments.xml", usada: referencia(/w:commentReference|w:commentRangeStart/) },
    { caminho: "word/footnotes.xml", usada: referencia(/w:footnoteReference/) },
    { caminho: "word/endnotes.xml", usada: referencia(/w:endnoteReference/) },
  ];
  const removidas: string[] = [];
  for (const c of candidatas) {
    if (!c.usada && zip.file(c.caminho)) {
      zip.remove(c.caminho);
      removidas.push(c.caminho.split("/").pop()!);
      zip.remove(`word/_rels/${c.caminho.split("/").pop()}.rels`);
    }
  }
  // Propriedades personalizadas vazias.
  const custom = zip.file("docProps/custom.xml");
  if (custom && !/<property\b/.test(await custom.async("string"))) {
    zip.remove("docProps/custom.xml");
    removidas.push("custom.xml");
  }

  // Limpa as referências às partes removidas (relações e tipos de conteúdo).
  if (removidas.length) {
    for (const relPath of ["word/_rels/document.xml.rels", "_rels/.rels"]) {
      const f = zip.file(relPath);
      if (!f) continue;
      let xml = await f.async("string");
      for (const nome of removidas) {
        xml = xml.replace(new RegExp(`<Relationship\\b[^>]*Target="(?:[^"]*/)?${nome.replace(".", "\\.")}"[^>]*/>`, "g"), "");
      }
      zip.file(relPath, xml);
    }
    const ct = zip.file("[Content_Types].xml");
    if (ct) {
      let xml = await ct.async("string");
      for (const nome of removidas) {
        xml = xml.replace(new RegExp(`<Override\\b[^>]*PartName="[^"]*/${nome.replace(".", "\\.")}"[^>]*/>`, "g"), "");
      }
      zip.file("[Content_Types].xml", xml);
    }
  }

  const settings = zip.file("word/settings.xml");
  if (settings) {
    // Mantém o modo de compatibilidade 15 (Word 2013+). Sem ele o Word novo abre
    // o arquivo em "Modo de Compatibilidade" (layout do Word 2007), que ocupa
    // mais espaço e jogava o diploma para uma 3ª página. O LibreOffice também
    // grava este mesmo <w:compatSetting> e o arquivo dele abre no Word 2007
    // (que simplesmente ignora o valor), então é seguro.
    const COMPAT =
      '<w:compat><w:compatSetting w:name="compatibilityMode" w:uri="http://schemas.microsoft.com/office/word" w:val="15"/></w:compat>';
    let xml = (await settings.async("string")).replace(/<w:compat>[\s\S]*?<\/w:compat>/g, "").replace(/<w:compat\/>/g, "");
    xml = xml.replace(/<\/w:settings>\s*$/, COMPAT + "</w:settings>");
    zip.file("word/settings.xml", xml);
  }

  for (const nome of Object.keys(zip.files)) {
    if (!/^word\/[^/]+\.xml$/.test(nome)) continue;
    const arquivo = zip.file(nome);
    if (!arquivo) continue;
    let xml = await arquivo.async("string");
    const original = xml;

    xml = xml.replace(/\s(?:w14|w15|w16[a-z]*|wp14):[A-Za-z]+="[^"]*"/g, "");

    if (nome === "word/document.xml") {
      // Largura em porcentagem: o Word 2007 só aceita número inteiro em
      // w:w (cinquenta-avos de porcento: 100% = 5000); "100%" é do Word
      // 2010+. Era exatamente isso que o Word 2007 da APMCV apontava
      // ("Parte: /word/document.xml, Linha: 1, Coluna: ...") nas larguras
      // de tabela/célula.
      xml = xml.replace(/(<w:(?:tblW|tcW)\b[^>]*\sw:w=")(\d+(?:\.\d+)?)%"/g, (_m, pre: string, n: string) => `${pre}${Math.round(parseFloat(n) * 50)}"`);
      let proximoId = 1;
      xml = xml.replace(/<wp:docPr\b[^>]*?\/>/g, () => {
        const id = proximoId++;
        return `<wp:docPr id="${id}" name="Imagem ${id}"/>`;
      });
    }

    if (nome === "word/styles.xml") {
      const faltando: string[] = [];
      if (!/w:styleId="Normal"/.test(xml))
        faltando.push('<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>');
      if (!/w:styleId="DefaultParagraphFont"/.test(xml))
        faltando.push(
          '<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont"><w:name w:val="Default Paragraph Font"/><w:uiPriority w:val="1"/><w:semiHidden/><w:unhideWhenUsed/></w:style>'
        );
      if (!/w:styleId="TableNormal"/.test(xml))
        faltando.push(
          '<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
        );
      if (!/w:styleId="NoList"/.test(xml))
        faltando.push(
          '<w:style w:type="numbering" w:default="1" w:styleId="NoList"><w:name w:val="No List"/><w:uiPriority w:val="99"/><w:semiHidden/><w:unhideWhenUsed/></w:style>'
        );
      if (faltando.length) {
        // Os estilos padrão vão logo depois de <w:docDefaults>, como o Word grava.
        xml = /<\/w:docDefaults>/.test(xml)
          ? xml.replace("</w:docDefaults>", "</w:docDefaults>" + faltando.join(""))
          : xml.replace(/(<w:styles\b[^>]*>)/, "$1" + faltando.join(""));
      }
      // <w:rPrDefault/> / <w:pPrDefault/> vazios (a biblioteca grava assim).
      xml = xml.replace(/<w:rPrDefault\/>/g, "").replace(/<w:pPrDefault\/>/g, "");
    }

    xml = limparNamespaces(xml);
    if (xml !== original) zip.file(nome, xml);
  }

  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

/** Substitui Packer.toBlob(doc): gera o .docx já compatível com Word 2007. */
export async function docxParaBlob(doc: Document): Promise<Blob> {
  return sanear(await Packer.toBlob(doc));
}
