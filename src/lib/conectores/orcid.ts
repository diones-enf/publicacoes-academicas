// ORCID — API pública: lista de obras de um ORCID iD e busca de pessoas por nome.
import { normalizarDoi, normalizarOrcid } from "../texto";
import { buscarJson } from "./http";
import type { ResultadoBusca } from "./tipos";

const BASE = "https://pub.orcid.org/v3.0";

interface OrcidResumo {
  title?: { title?: { value?: string } };
  "external-ids"?: { "external-id"?: { "external-id-type": string; "external-id-value": string }[] };
  "journal-title"?: { value?: string } | null;
  "publication-date"?: { year?: { value?: string } | null } | null;
  type?: string;
}

export async function orcidObras(orcidIn: string): Promise<ResultadoBusca[]> {
  const orcid = normalizarOrcid(orcidIn);
  if (!orcid) return [];
  const r = await buscarJson<{ group?: { "work-summary": OrcidResumo[] }[] }>("ORCID", `${BASE}/${orcid}/works`, {
    tempoMs: 8000,
  });
  return (r?.group ?? []).map((g) => {
    const w = g["work-summary"][0];
    const doi = w["external-ids"]?.["external-id"]?.find((e) => e["external-id-type"] === "doi")?.["external-id-value"];
    const ano = w["publication-date"]?.year?.value;
    return {
      fonte: "ORCID" as const,
      doi: normalizarDoi(doi),
      titulo: w.title?.title?.value ?? "(sem título)",
      revista: w["journal-title"]?.value ?? null,
      ano: ano ? Number(ano) : null,
      autores: [],
    };
  });
}

export interface PessoaOrcid {
  orcid: string;
  nome: string;
  instituicoes: string[];
}

export async function orcidPessoas(nome: string): Promise<PessoaOrcid[]> {
  const partes = nome.trim().split(/\s+/);
  const sobrenome = partes.pop() ?? "";
  const q = partes.length
    ? `given-names:${partes.join(" ")} AND family-name:${sobrenome}`
    : `family-name:${sobrenome}`;
  const r = await buscarJson<{
    "expanded-result"?: { "orcid-id": string; "given-names"?: string; "family-names"?: string; "institution-name"?: string[] }[];
  }>("ORCID", `${BASE}/expanded-search/?q=${encodeURIComponent(q)}&rows=5`);
  return (r?.["expanded-result"] ?? []).map((p) => ({
    orcid: p["orcid-id"],
    nome: [p["given-names"], p["family-names"]].filter(Boolean).join(" "),
    instituicoes: p["institution-name"] ?? [],
  }));
}
