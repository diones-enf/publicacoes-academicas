// OpenAlex — metadados, citações e vínculo com fontes. API gratuita: https://api.openalex.org
import { normalizarDoi, normalizarIssn, normalizarOrcid } from "../texto";
import { buscarJson, idiomaDeCodigo, tipoDeCrossref } from "./http";
import type { Metadados, ResultadoBusca } from "./tipos";

const BASE = "https://api.openalex.org";

export interface OaWork {
  id: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  publication_date?: string | null;
  language?: string | null;
  type?: string | null;
  type_crossref?: string | null;
  cited_by_count?: number;
  authorships?: {
    author: { display_name: string; orcid?: string | null };
    institutions?: { display_name: string }[];
    raw_author_name?: string;
  }[];
  primary_location?: {
    landing_page_url?: string | null;
    source?: {
      display_name?: string;
      issn_l?: string | null;
      issn?: string[] | null;
      host_organization_name?: string | null;
      type?: string | null;
    } | null;
  } | null;
  biblio?: { volume?: string | null; issue?: string | null; first_page?: string | null; last_page?: string | null };
  abstract_inverted_index?: Record<string, number[]> | null;
  keywords?: { display_name: string }[];
}

/** O OpenAlex guarda o resumo como índice invertido; aqui ele volta a ser texto. */
export function resumoDeIndice(ind: Record<string, number[]> | null | undefined): string | null {
  if (!ind) return null;
  const palavras: string[] = [];
  for (const [p, posicoes] of Object.entries(ind)) for (const i of posicoes) palavras[i] = p;
  const t = palavras.filter((p) => p !== undefined).join(" ").trim();
  return t || null;
}

function paginas(b: OaWork["biblio"]): string | null {
  if (!b?.first_page) return null;
  return b.last_page && b.last_page !== b.first_page ? `${b.first_page}-${b.last_page}` : b.first_page;
}

export function converterOpenAlex(w: OaWork): Metadados {
  const src = w.primary_location?.source ?? null;
  const issns = src?.issn ?? [];
  const tipo = tipoDeCrossref(w.type_crossref ?? w.type);
  return {
    fonte: "OpenAlex",
    doi: normalizarDoi(w.doi ?? null),
    titulo: w.title ?? w.display_name ?? null,
    autores: (w.authorships ?? []).map((a) => ({
      nome: a.author.display_name || a.raw_author_name || "",
      orcid: normalizarOrcid(a.author.orcid ?? null),
      afiliacao: a.institutions?.[0]?.display_name ?? null,
    })),
    revista: tipo === "capitulo" ? null : (src?.display_name ?? null),
    livro_titulo: tipo === "capitulo" ? (src?.display_name ?? null) : null,
    issn: normalizarIssn(issns[0] ?? src?.issn_l ?? null),
    eissn: normalizarIssn(issns[1] ?? null),
    editora: src?.host_organization_name ?? null,
    ano: w.publication_year ?? null,
    data_publicacao: w.publication_date ?? null,
    volume: w.biblio?.volume ?? null,
    numero: w.biblio?.issue ?? null,
    paginas: paginas(w.biblio),
    idioma: idiomaDeCodigo(w.language),
    resumo: resumoDeIndice(w.abstract_inverted_index),
    palavras_chave: (w.keywords ?? []).map((k) => k.display_name),
    link: w.primary_location?.landing_page_url ?? null,
    tipo_chave: tipo,
    citacoes: w.cited_by_count ?? null,
  };
}

export async function openAlexPorDoi(doi: string): Promise<Metadados | null> {
  const r = await buscarJson<OaWork>("OpenAlex", `${BASE}/works/https://doi.org/${encodeURIComponent(doi)}`);
  return r ? converterOpenAlex(r) : null;
}

function resumir(w: OaWork): ResultadoBusca {
  const m = converterOpenAlex(w);
  return {
    fonte: "OpenAlex",
    doi: m.doi ?? null,
    titulo: m.titulo ?? "(sem título)",
    revista: m.revista ?? m.livro_titulo ?? null,
    ano: m.ano ?? null,
    autores: (m.autores ?? []).map((a) => a.nome),
  };
}

const SELECAO = "id,doi,title,display_name,publication_year,type,type_crossref,authorships,primary_location";

export async function openAlexPorTitulo(titulo: string): Promise<ResultadoBusca[]> {
  const r = await buscarJson<{ results: OaWork[] }>(
    "OpenAlex",
    `${BASE}/works?search=${encodeURIComponent(titulo)}&per-page=10&select=${SELECAO}`,
  );
  return (r?.results ?? []).map(resumir);
}

/** Por ORCID, quando houver; senão pelo nome (procura o autor e depois as obras dele). */
export async function openAlexPorAutor(nomeOuOrcid: string): Promise<ResultadoBusca[]> {
  const orcid = normalizarOrcid(nomeOuOrcid);
  let filtro: string;
  if (orcid) {
    filtro = `author.orcid:${orcid}`;
  } else {
    const a = await buscarJson<{ results: { id: string }[] }>(
      "OpenAlex",
      `${BASE}/authors?search=${encodeURIComponent(nomeOuOrcid)}&per-page=5&select=id`,
    );
    const ids = (a?.results ?? []).map((x) => x.id.split("/").pop()).filter(Boolean);
    if (!ids.length) return [];
    filtro = `author.id:${ids.join("|")}`;
  }
  const r = await buscarJson<{ results: OaWork[] }>(
    "OpenAlex",
    `${BASE}/works?filter=${filtro}&per-page=100&sort=publication_year:desc&select=${SELECAO}`,
    { tempoMs: 8000 },
  );
  return (r?.results ?? []).map(resumir);
}
