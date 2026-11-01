// Respostas reais (resumidas) das APIs, no formato documentado.
export const crossrefWork = {
  status: "ok",
  message: {
    DOI: "10.1590/1983-1447.2023.20220123",
    title: ["Cuidados de enfermagem na sepse: revisão integrativa"],
    author: [
      { given: "Daniela R.", family: "Rosa", ORCID: "http://orcid.org/0000-0002-1825-0097", sequence: "first", affiliation: [{ name: "UFRGS" }] },
      { given: "Luana", family: "Schiavão", sequence: "additional", affiliation: [] },
      { given: "Paulo", family: "Souza", sequence: "additional", affiliation: [] },
    ],
    "container-title": ["Revista Gaúcha de Enfermagem"],
    ISSN: ["0102-6933", "1983-1447"],
    "issn-type": [
      { value: "0102-6933", type: "print" },
      { value: "1983-1447", type: "electronic" },
    ],
    publisher: "FapUNIFESP (SciELO)",
    issued: { "date-parts": [[2023, 5, 15]] },
    "published-online": { "date-parts": [[2023, 5, 15]] },
    volume: "44",
    issue: "2",
    "article-number": "e20220123",
    language: "pt",
    abstract: "<jats:p>Objetivo: analisar ... Método: revisão integrativa da literatura ...</jats:p>",
    URL: "https://doi.org/10.1590/1983-1447.2023.20220123",
    type: "journal-article",
    "is-referenced-by-count": 3,
  },
};

export const openAlexWork = {
  id: "https://openalex.org/W1",
  doi: "https://doi.org/10.1590/1983-1447.2023.20220123",
  title: "Cuidados de enfermagem na sepse: revisão integrativa",
  publication_year: 2023,
  publication_date: "2023-05-15",
  language: "pt",
  type: "article",
  type_crossref: "journal-article",
  cited_by_count: 4,
  authorships: [
    { author: { display_name: "Daniela R. Rosa", orcid: "https://orcid.org/0000-0002-1825-0097" }, institutions: [] },
    { author: { display_name: "Luana Schiavão", orcid: null }, institutions: [] },
  ],
  primary_location: { landing_page_url: "https://www.scielo.br/x", source: { display_name: "Revista Gaúcha de Enfermagem", issn: ["0102-6933", "1983-1447"], host_organization_name: "UFRGS" } },
  biblio: { volume: "44", issue: "2", first_page: "e20220123", last_page: "e20220123" },
  abstract_inverted_index: { Objetivo: [0], "analisar": [1] },
  keywords: [{ display_name: "Sepse" }, { display_name: "Enfermagem" }],
};
