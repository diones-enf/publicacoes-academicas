// Consultas públicas de indexação pelo ISSN: DOAJ, PubMed/MEDLINE (NLM) e SciELO.
import { buscarJson } from "./http";

/** DOAJ: a revista está no Directory of Open Access Journals? */
export async function estaNoDoaj(issn: string): Promise<boolean> {
  const r = await buscarJson<{ total?: number; results?: unknown[] }>(
    "DOAJ",
    `https://doaj.org/api/search/journals/issn%3A${encodeURIComponent(issn)}`,
  );
  return !!r && ((r.total ?? 0) > 0 || (r.results?.length ?? 0) > 0);
}

/** NLM Catalog: revista indexada atualmente no MEDLINE/PubMed? */
export async function estaNoMedline(issn: string): Promise<boolean> {
  const r = await buscarJson<{ esearchresult?: { count?: string } }>(
    "PubMed/MEDLINE",
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=nlmcatalog&retmode=json&term=${encodeURIComponent(`${issn}[ISSN] AND currentlyindexed[All]`)}`,
  );
  return Number(r?.esearchresult?.count ?? 0) > 0;
}

/** SciELO (ArticleMeta): a revista faz parte de alguma coleção SciELO? */
export async function estaNoScielo(issn: string): Promise<boolean> {
  const r = await buscarJson<unknown>("SciELO", `https://articlemeta.scielo.org/api/v1/journal/?issn=${encodeURIComponent(issn)}`);
  if (!r) return false;
  if (Array.isArray(r)) return r.length > 0;
  return typeof r === "object" && Object.keys(r as object).length > 0;
}
