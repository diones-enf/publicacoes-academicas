// Acesso às APIs públicas com tempo-limite curto (o cadastro por DOI precisa
// responder em até 5 segundos).

export class ErroFonte extends Error {
  constructor(
    public fonte: string,
    mensagem: string,
    public status?: number,
  ) {
    super(`${fonte}: ${mensagem}`);
  }
}

export function cabecalhos(): Record<string, string> {
  const email = process.env.EMAIL_CONTATO_APIS;
  return {
    Accept: "application/json",
    "User-Agent": `PublicacoesAcademicas/0.1 (uso pessoal${email ? `; mailto:${email}` : ""})`,
  };
}

export async function buscarJson<T = unknown>(
  fonte: string,
  url: string,
  opcoes: { tempoMs?: number; cabecalhos?: Record<string, string> } = {},
): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opcoes.tempoMs ?? 4500);
  try {
    const r = await fetch(url, { headers: { ...cabecalhos(), ...opcoes.cabecalhos }, signal: ctrl.signal, cache: "no-store" });
    if (r.status === 404) return null;
    if (!r.ok) throw new ErroFonte(fonte, `respondeu ${r.status}`, r.status);
    return (await r.json()) as T;
  } catch (e) {
    if (e instanceof ErroFonte) throw e;
    if ((e as Error).name === "AbortError") throw new ErroFonte(fonte, "não respondeu a tempo");
    throw new ErroFonte(fonte, "sem conexão");
  } finally {
    clearTimeout(timer);
  }
}

/** Tira as tags JATS/HTML de resumos ("<jats:p>...</jats:p>"). */
export function semTags(t: string | null | undefined): string | null {
  if (!t) return null;
  const s = t
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return s || null;
}

export function dataDePartes(p: number[] | undefined | null): string | null {
  if (!p || !p[0]) return null;
  const [a, m = 1, d = 1] = p;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const IDIOMAS: Record<string, string> = { pt: "Português", en: "Inglês", es: "Espanhol", fr: "Francês" };
export function idiomaDeCodigo(c: string | null | undefined): string | null {
  if (!c) return null;
  return IDIOMAS[c.slice(0, 2).toLowerCase()] ?? c;
}

export function tipoDeCrossref(t: string | null | undefined): string | null {
  switch (t) {
    case "journal-article":
    case "article":
      return "artigo";
    case "book-chapter":
    case "book-section":
    case "book-part":
      return "capitulo";
    case "book":
    case "monograph":
    case "edited-book":
    case "reference-book":
      return "livro";
    case "proceedings-article":
    case "proceedings":
      return "anais";
    case "report":
      return "tecnica";
    default:
      return null;
  }
}
