// Tira o texto de um arquivo: PDF, e-mail salvo (.eml), Word (.docx), HTML ou texto.
import JSZip from "jszip";

export class ErroLeitura extends Error {}

function semHtml(h: string): string {
  return h
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n");
}

function decodificarCharset(buf: Buffer, charset: string | undefined): string {
  const c = (charset ?? "utf-8").toLowerCase().replace(/["']/g, "");
  try {
    return new TextDecoder(c === "iso-8859-1" || c === "latin1" ? "latin1" : c).decode(buf);
  } catch {
    return buf.toString("utf8");
  }
}

/** Palavras codificadas no cabeçalho (=?UTF-8?Q?...?= / =?UTF-8?B?...?=). */
function cabecalhoMime(bruto: string): string {
  const v = decodificarCharset(Buffer.from(bruto, "latin1"), "utf-8");
  return v.replace(/=\?([^?]+)\?([QB])\?([^?]*)\?=/gi, (_, cs, mod, txt) => {
    const buf =
      mod.toUpperCase() === "B"
        ? Buffer.from(txt, "base64")
        : Buffer.from(txt.replace(/_/g, " ").replace(/=([0-9A-F]{2})/gi, (_m: string, h: string) => String.fromCharCode(parseInt(h, 16))), "latin1");
    return decodificarCharset(buf, cs);
  });
}

function decodificarCorpo(corpo: string, cte: string | undefined, charset: string | undefined): string {
  const t = (cte ?? "").toLowerCase();
  if (t.includes("base64")) return decodificarCharset(Buffer.from(corpo.replace(/\s+/g, ""), "base64"), charset);
  if (t.includes("quoted-printable")) {
    const bin = corpo.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    return decodificarCharset(Buffer.from(bin, "latin1"), charset);
  }
  // 7bit/8bit: o arquivo foi lido byte a byte (latin1); converte pelo charset da parte
  return decodificarCharset(Buffer.from(corpo, "latin1"), charset ?? "utf-8");
}

function separarCabecalhos(bloco: string): { cab: Record<string, string>; corpo: string } {
  const i = bloco.search(/\r?\n\r?\n/);
  const topo = i < 0 ? bloco : bloco.slice(0, i);
  const corpo = i < 0 ? "" : bloco.slice(i).replace(/^\r?\n\r?\n/, "");
  const cab: Record<string, string> = {};
  for (const linha of topo.replace(/\r?\n[ \t]+/g, " ").split(/\r?\n/)) {
    const m = linha.match(/^([\w-]+):\s*(.*)$/);
    if (m) cab[m[1].toLowerCase()] = m[2];
  }
  return { cab, corpo };
}

/** Texto de uma parte MIME (recursivo); prefere text/plain e usa HTML se não houver. */
function textoMime(bloco: string): { plano: string; html: string } {
  const { cab, corpo } = separarCabecalhos(bloco);
  const tipo = cab["content-type"] ?? "text/plain";
  const limite = tipo.match(/boundary="?([^";]+)"?/i)?.[1];
  if (/multipart\//i.test(tipo) && limite) {
    const partes = corpo.split(new RegExp(`--${limite.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:--)?`)).slice(1);
    const r = { plano: "", html: "" };
    for (const p of partes) {
      if (!p.trim()) continue;
      const t = textoMime(p.replace(/^\r?\n/, ""));
      r.plano += t.plano;
      r.html += t.html;
    }
    return r;
  }
  if (/attachment/i.test(cab["content-disposition"] ?? "")) return { plano: "", html: "" };
  const charset = tipo.match(/charset="?([^";]+)"?/i)?.[1];
  const txt = decodificarCorpo(corpo, cab["content-transfer-encoding"], charset);
  if (/text\/html/i.test(tipo)) return { plano: "", html: txt };
  if (/text\//i.test(tipo)) return { plano: txt, html: "" };
  return { plano: "", html: "" };
}

export function textoDeEml(bruto: string): string {
  const { cab } = separarCabecalhos(bruto);
  const { plano, html } = textoMime(bruto);
  const corpo = plano.trim() ? plano : semHtml(html);
  const topo = ["from", "to", "date", "subject"]
    .filter((k) => cab[k])
    .map((k) => `${{ from: "De", to: "Para", date: "Data", subject: "Assunto" }[k]}: ${cabecalhoMime(cab[k])}`)
    .join("\n");
  return `${topo}\n\n${corpo}`.trim();
}

async function textoDePdf(buf: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

async function textoDeDocx(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const doc = await zip.file("word/document.xml")?.async("string");
  if (!doc) throw new ErroLeitura("Arquivo Word sem texto.");
  return semHtml(doc.replace(/<w:tab\/>/g, " ").replace(/<\/w:p>/g, "\n"));
}

/** Extensões que o sistema sabe ler. */
export const LEGIVEIS = ["pdf", "eml", "docx", "txt", "html", "htm", "mht", "mhtml"];

export async function textoDeArquivo(nome: string, buf: Buffer): Promise<string> {
  const ext = nome.split(".").pop()?.toLowerCase() ?? "";
  let t = "";
  if (ext === "pdf" || buf.subarray(0, 5).toString() === "%PDF-") t = await textoDePdf(buf);
  else if (ext === "eml" || ext === "mht" || ext === "mhtml") t = textoDeEml(buf.toString("latin1"));
  else if (ext === "docx") t = await textoDeDocx(buf);
  else if (ext === "html" || ext === "htm") t = semHtml(buf.toString("utf8"));
  else if (ext === "txt") t = buf.toString("utf8");
  else if (ext === "msg") throw new ErroLeitura("Arquivo .msg do Outlook não dá para ler. No Outlook, use Arquivo → Salvar como → .eml, ou Imprimir → Microsoft Print to PDF.");
  else if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext))
    throw new ErroLeitura("Foto ou imagem não tem texto para ler. Envie o PDF ou copie e cole o texto do e-mail.");
  else throw new ErroLeitura(`Não sei ler arquivos .${ext}. Use PDF, e-mail (.eml), Word (.docx) ou cole o texto.`);
  t = t.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").trim();
  if (t.length < 20) throw new ErroLeitura("Não encontrei texto no arquivo (pode ser um PDF escaneado, como foto). Copie e cole o texto, ou digite os dados.");
  return t;
}
