// OpenAlex: citações de cada obra (total e por ano) e lista de quem citou. Gratuito.
import { normalizarDoi } from "../texto";
import { buscarJson } from "./http";

const BASE = process.env.OPENALEX_URL ?? "https://api.openalex.org";

function extras(): string {
  const p: string[] = [];
  if (process.env.EMAIL_CONTATO_APIS) p.push(`mailto=${encodeURIComponent(process.env.EMAIL_CONTATO_APIS)}`);
  if (process.env.OPENALEX_API_KEY) p.push(`api_key=${encodeURIComponent(process.env.OPENALEX_API_KEY)}`);
  return p.length ? `&${p.join("&")}` : "";
}

export interface AutorOA {
  id: string | null; // A123... (identificador do autor no OpenAlex)
  nome: string;
  orcid: string | null;
}

export interface ObraCitada {
  id: string; // W123...
  doi: string | null;
  titulo: string;
  ano: number | null;
  citacoes: number;
  porAno: { ano: number; total: number }[];
  autores: AutorOA[];
  fwci: number | null; // impacto normalizado pela área e ano (1 = média)
  percentil: number | null; // 0 a 100
  top10: boolean;
  top1: boolean;
}

interface OaObra {
  id: string;
  doi?: string | null;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  publication_date?: string | null;
  cited_by_count?: number;
  counts_by_year?: { year: number; cited_by_count: number }[];
  primary_location?: { source?: { display_name?: string } | null } | null;
  authorships?: { author?: { id?: string | null; display_name?: string; orcid?: string | null }; countries?: string[] }[];
  fwci?: number | null;
  citation_normalized_percentile?: { value?: number; is_in_top_1_percent?: boolean; is_in_top_10_percent?: boolean } | null;
}

function autoresDe(o: OaObra): AutorOA[] {
  return (o.authorships ?? []).map((a) => ({
    id: a.author?.id ? idCurto(a.author.id) : null,
    nome: a.author?.display_name ?? "",
    orcid: a.author?.orcid ? a.author.orcid.replace(/^https?:\/\/orcid\.org\//, "") : null,
  }));
}

const SELECAO = "id,doi,title,display_name,publication_year,cited_by_count,counts_by_year,authorships,fwci,citation_normalized_percentile";

export function idCurto(id: string): string {
  return id.split("/").pop() ?? id;
}

export function converterObra(o: OaObra): ObraCitada {
  return {
    id: idCurto(o.id),
    doi: normalizarDoi(o.doi ?? null),
    titulo: o.title ?? o.display_name ?? "",
    ano: o.publication_year ?? null,
    citacoes: o.cited_by_count ?? 0,
    porAno: (o.counts_by_year ?? []).map((c) => ({ ano: c.year, total: c.cited_by_count })),
    autores: autoresDe(o),
    fwci: typeof o.fwci === "number" ? Math.round(o.fwci * 100) / 100 : null,
    percentil:
      typeof o.citation_normalized_percentile?.value === "number" ? Math.round(o.citation_normalized_percentile.value * 1000) / 10 : null,
    top10: !!o.citation_normalized_percentile?.is_in_top_10_percent,
    top1: !!o.citation_normalized_percentile?.is_in_top_1_percent,
  };
}

/** Várias obras de uma vez pelo DOI (até 50 por consulta). */
export async function obrasPorDoi(dois: string[]): Promise<ObraCitada[]> {
  const out: ObraCitada[] = [];
  for (let i = 0; i < dois.length; i += 50) {
    const lote = dois.slice(i, i + 50).map((d) => encodeURIComponent(d)).join("|");
    const r = await buscarJson<{ results: OaObra[] }>(
      "OpenAlex",
      `${BASE}/works?filter=doi:${lote}&per-page=50&select=${SELECAO}${extras()}`,
      { tempoMs: 20000 },
    );
    out.push(...(r?.results ?? []).map(converterObra));
  }
  return out;
}

/** Obra sem DOI: procura pelo título (e ano, se houver). */
export async function obrasPorTitulo(titulo: string, ano: number | null): Promise<ObraCitada[]> {
  const filtro = ano ? `&filter=publication_year:${ano}` : "";
  const r = await buscarJson<{ results: OaObra[] }>(
    "OpenAlex",
    `${BASE}/works?search=${encodeURIComponent(titulo)}${filtro}&per-page=5&select=${SELECAO}${extras()}`,
    { tempoMs: 15000 },
  );
  return (r?.results ?? []).map(converterObra);
}

export interface TrabalhoCitante {
  id: string;
  titulo: string;
  ano: number | null;
  data: string | null;
  doi: string | null;
  revista: string | null;
  autores: AutorOA[];
  paises: string[];
}

/** Trabalhos que citaram a obra (até 200, do mais antigo para o mais novo). */
export async function quemCitou(idObra: string): Promise<TrabalhoCitante[]> {
  const out: TrabalhoCitante[] = [];
  for (let pagina = 1; pagina <= 2; pagina++) {
    const r = await buscarJson<{ results: OaObra[]; meta?: { count?: number } }>(
      "OpenAlex",
      `${BASE}/works?filter=cites:${idCurto(idObra)}&per-page=100&page=${pagina}&sort=publication_date:asc&select=id,doi,title,display_name,publication_year,publication_date,primary_location,authorships${extras()}`,
      { tempoMs: 20000 },
    );
    const lista = r?.results ?? [];
    out.push(
      ...lista.map((o) => ({
        id: idCurto(o.id),
        titulo: o.title ?? o.display_name ?? "",
        ano: o.publication_year ?? null,
        data: o.publication_date ?? null,
        doi: normalizarDoi(o.doi ?? null),
        revista: o.primary_location?.source?.display_name ?? null,
        autores: autoresDe(o),
        paises: [...new Set((o.authorships ?? []).flatMap((a) => a.countries ?? []))],
      })),
    );
    if (lista.length < 100) break;
  }
  return out;
}
