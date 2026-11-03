// Crossref — metadados oficiais de DOI. API pública: https://api.crossref.org
import { normalizarDoi, normalizarIssn, normalizarOrcid } from "../texto";
import { buscarJson, dataDePartes, idiomaDeCodigo, semTags, tipoDeCrossref } from "./http";
import type { Metadados, ResultadoBusca } from "./tipos";

const BASE = process.env.CROSSREF_URL ?? "https://api.crossref.org";

interface CrAutor {
  given?: string;
  family?: string;
  name?: string;
  ORCID?: string;
  sequence?: string;
  affiliation?: { name: string }[];
}
interface CrData {
  "date-parts"?: number[][];
}
export interface CrWork {
  DOI: string;
  title?: string[];
  author?: CrAutor[];
  "container-title"?: string[];
  ISSN?: string[];
  "issn-type"?: { value: string; type: "print" | "electronic" }[];
  ISBN?: string[];
  "isbn-type"?: { value: string; type: string }[];
  publisher?: string;
  issued?: CrData;
  "published-print"?: CrData;
  "published-online"?: CrData;
  published?: CrData;
  accepted?: CrData;
  volume?: string;
  issue?: string;
  page?: string;
  "article-number"?: string;
  language?: string;
  abstract?: string;
  subject?: string[];
  URL?: string;
  type?: string;
  "is-referenced-by-count"?: number;
}

function nomeAutor(a: CrAutor): string {
  if (a.name) return a.name;
  return [a.given, a.family].filter(Boolean).join(" ");
}

export function converterCrossref(w: CrWork): Metadados {
  const issnTipo = w["issn-type"] ?? [];
  const impresso = issnTipo.find((i) => i.type === "print")?.value ?? null;
  const eletronico = issnTipo.find((i) => i.type === "electronic")?.value ?? null;
  const issns = w.ISSN ?? [];
  const data =
    dataDePartes(w["published-print"]?.["date-parts"]?.[0]) ??
    dataDePartes(w["published-online"]?.["date-parts"]?.[0]) ??
    dataDePartes(w.published?.["date-parts"]?.[0]) ??
    dataDePartes(w.issued?.["date-parts"]?.[0]);
  const tipo = tipoDeCrossref(w.type);
  const container = w["container-title"]?.[0] ?? null;
  return {
    fonte: "Crossref",
    doi: normalizarDoi(w.DOI),
    titulo: semTags(w.title?.[0]),
    autores: (w.author ?? []).map((a) => ({
      nome: nomeAutor(a),
      orcid: normalizarOrcid(a.ORCID),
      afiliacao: a.affiliation?.[0]?.name ?? null,
    })),
    revista: tipo === "capitulo" ? null : container,
    livro_titulo: tipo === "capitulo" ? container : null,
    issn: normalizarIssn(impresso ?? (eletronico ? null : issns[0])),
    eissn: normalizarIssn(eletronico ?? (issns.length > 1 ? issns[1] : null)),
    isbn: w.ISBN?.[0] ?? w["isbn-type"]?.[0]?.value ?? null,
    editora: w.publisher ?? null,
    ano: data ? Number(data.slice(0, 4)) : null,
    data_publicacao: data,
    data_aceite: dataDePartes(w.accepted?.["date-parts"]?.[0]),
    volume: w.volume ?? null,
    numero: w.issue ?? null,
    paginas: w.page ?? w["article-number"] ?? null,
    idioma: idiomaDeCodigo(w.language),
    resumo: semTags(w.abstract),
    palavras_chave: w.subject ?? [],
    link: w.URL ?? (w.DOI ? `https://doi.org/${w.DOI}` : null),
    tipo_chave: tipo,
    citacoes: w["is-referenced-by-count"] ?? null,
  };
}

export async function crossrefPorDoi(doi: string): Promise<Metadados | null> {
  const r = await buscarJson<{ message: CrWork }>("Crossref", `${BASE}/works/${encodeURIComponent(doi)}`);
  return r?.message ? converterCrossref(r.message) : null;
}

function resumir(w: CrWork): ResultadoBusca {
  const m = converterCrossref(w);
  return {
    fonte: "Crossref",
    doi: m.doi ?? null,
    titulo: m.titulo ?? "(sem título)",
    revista: m.revista ?? m.livro_titulo ?? null,
    ano: m.ano ?? null,
    autores: (m.autores ?? []).map((a) => a.nome),
  };
}

const SELECAO = "DOI,title,author,container-title,issued,published-print,published-online,type,ISSN,issn-type";

export async function crossrefPorTitulo(titulo: string, linhas = 10): Promise<ResultadoBusca[]> {
  const r = await buscarJson<{ message: { items: CrWork[] } }>(
    "Crossref",
    `${BASE}/works?query.bibliographic=${encodeURIComponent(titulo)}&rows=${linhas}&select=${SELECAO}`,
  );
  return (r?.message?.items ?? []).map(resumir);
}

export async function crossrefPorAutor(nome: string, linhas = 40): Promise<ResultadoBusca[]> {
  const r = await buscarJson<{ message: { items: CrWork[] } }>(
    "Crossref",
    `${BASE}/works?query.author=${encodeURIComponent(nome)}&rows=${linhas}&select=${SELECAO}&sort=published&order=desc`,
    { tempoMs: 8000 },
  );
  return (r?.message?.items ?? []).map(resumir);
}

export async function crossrefPorIsbn(isbn: string): Promise<Metadados | null> {
  const r = await buscarJson<{ message: { items: CrWork[] } }>(
    "Crossref",
    `${BASE}/works?filter=isbn:${encodeURIComponent(isbn)}&rows=5`,
  );
  const itens = r?.message?.items ?? [];
  const livro = itens.find((w) => tipoDeCrossref(w.type) === "livro") ?? itens[0];
  return livro ? converterCrossref(livro) : null;
}
