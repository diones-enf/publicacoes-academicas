// Formato comum que todo conector devolve. Para incluir uma nova fonte,
// basta criar um arquivo que devolva Metadados — o resto do sistema não muda.

export type Fonte = "Crossref" | "OpenAlex" | "DataCite" | "ORCID" | "Open Library" | "Manual" | "PDF";

export interface AutorEncontrado {
  nome: string; // como aparece na fonte: "Daniela R. Rosa" ou "Rosa, D. R."
  orcid?: string | null;
  afiliacao?: string | null;
}

export interface Metadados {
  fonte: Fonte;
  doi?: string | null;
  titulo?: string | null;
  autores?: AutorEncontrado[];
  revista?: string | null;
  issn?: string | null;
  eissn?: string | null;
  editora?: string | null;
  ano?: number | null;
  data_publicacao?: string | null; // AAAA-MM-DD (ou AAAA-MM-01 / AAAA-01-01 quando incompleta)
  data_aceite?: string | null;
  data_submissao?: string | null;
  volume?: string | null;
  numero?: string | null;
  paginas?: string | null;
  idioma?: string | null;
  resumo?: string | null;
  palavras_chave?: string[];
  link?: string | null;
  tipo_chave?: string | null; // artigo, capitulo, livro, anais...
  isbn?: string | null;
  livro_titulo?: string | null;
  citacoes?: number | null;
}

/** Item de uma lista de resultados de busca (por autor ou título). */
export interface ResultadoBusca {
  fonte: Fonte;
  doi: string | null;
  titulo: string;
  revista: string | null;
  ano: number | null;
  autores: string[];
}
