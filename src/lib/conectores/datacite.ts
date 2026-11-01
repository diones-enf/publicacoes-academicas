// DataCite — DOIs que não estão no Crossref (repositórios, dados, alguns livros).
import { normalizarDoi, normalizarOrcid } from "../texto";
import { buscarJson, idiomaDeCodigo } from "./http";
import type { Metadados } from "./tipos";

interface DcAttr {
  doi: string;
  titles?: { title: string }[];
  creators?: {
    name: string;
    givenName?: string;
    familyName?: string;
    nameIdentifiers?: { nameIdentifier: string; nameIdentifierScheme: string }[];
    affiliation?: (string | { name: string })[];
  }[];
  publisher?: string | { name: string };
  publicationYear?: number | string;
  container?: { title?: string; identifier?: string; identifierType?: string; volume?: string; issue?: string; firstPage?: string };
  descriptions?: { description: string; descriptionType: string }[];
  subjects?: { subject: string }[];
  language?: string;
  url?: string;
  types?: { resourceTypeGeneral?: string };
}

export function converterDataCite(a: DcAttr): Metadados {
  const tipoGeral = a.types?.resourceTypeGeneral;
  const tipo =
    tipoGeral === "JournalArticle"
      ? "artigo"
      : tipoGeral === "BookChapter"
        ? "capitulo"
        : tipoGeral === "Book"
          ? "livro"
          : tipoGeral === "ConferencePaper"
            ? "anais"
            : tipoGeral === "Report"
              ? "tecnica"
              : null;
  const ano = a.publicationYear ? Number(a.publicationYear) : null;
  return {
    fonte: "DataCite",
    doi: normalizarDoi(a.doi),
    titulo: a.titles?.[0]?.title ?? null,
    autores: (a.creators ?? []).map((c) => {
      const orcid = c.nameIdentifiers?.find((n) => n.nameIdentifierScheme === "ORCID")?.nameIdentifier;
      const af = c.affiliation?.[0];
      return {
        nome: c.givenName && c.familyName ? `${c.givenName} ${c.familyName}` : c.name,
        orcid: normalizarOrcid(orcid),
        afiliacao: typeof af === "string" ? af : (af?.name ?? null),
      };
    }),
    revista: a.container?.title ?? null,
    issn: a.container?.identifierType === "ISSN" ? (a.container.identifier ?? null) : null,
    editora: typeof a.publisher === "string" ? a.publisher : (a.publisher?.name ?? null),
    ano,
    data_publicacao: ano ? `${ano}-01-01` : null,
    volume: a.container?.volume ?? null,
    numero: a.container?.issue ?? null,
    paginas: a.container?.firstPage ?? null,
    idioma: idiomaDeCodigo(a.language),
    resumo: a.descriptions?.find((d) => d.descriptionType === "Abstract")?.description ?? null,
    palavras_chave: (a.subjects ?? []).map((s) => s.subject),
    link: a.url ?? null,
    tipo_chave: tipo,
  };
}

export async function dataCitePorDoi(doi: string): Promise<Metadados | null> {
  const r = await buscarJson<{ data: { attributes: DcAttr } }>(
    "DataCite",
    `https://api.datacite.org/dois/${encodeURIComponent(doi)}`,
  );
  return r?.data?.attributes ? converterDataCite(r.data.attributes) : null;
}
