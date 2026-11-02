// OpenAlex (revistas): impacto médio de 2 anos, índice h e APC, pelo ISSN. Gratuito.
import { buscarJson } from "./http";

export interface FonteOpenAlex {
  nome: string;
  impacto2a: number | null; // citações médias em 2 anos (cálculo parecido com o JIF, base diferente)
  h: number | null;
  apcUsd: number | null;
  noDoaj: boolean;
}

export async function revistaOpenAlex(issn: string): Promise<FonteOpenAlex | null> {
  const r = await buscarJson<{
    display_name?: string;
    summary_stats?: { "2yr_mean_citedness"?: number; h_index?: number };
    apc_usd?: number | null;
    is_in_doaj?: boolean;
  }>("OpenAlex (revistas)", `https://api.openalex.org/sources/issn:${encodeURIComponent(issn)}`);
  if (!r?.display_name) return null;
  const imp = r.summary_stats?.["2yr_mean_citedness"];
  return {
    nome: r.display_name,
    impacto2a: typeof imp === "number" ? Math.round(imp * 1000) / 1000 : null,
    h: r.summary_stats?.h_index ?? null,
    apcUsd: r.apc_usd ?? null,
    noDoaj: !!r.is_in_doaj,
  };
}
