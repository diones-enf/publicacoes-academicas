// Listas fixas do sistema (as de tipos/subtipos são só o ponto de partida:
// o usuário pode editá-las em Configurações).

export const STATUS = [
  "Em elaboração",
  "Submetido",
  "Em avaliação",
  "Em revisão",
  "Aceito",
  "Publicado",
  "Apresentado",
  "Recusado",
  "Retirado",
] as const;
export type Status = (typeof STATUS)[number];

export const STATUS_SUBMISSOES: Status[] = ["Em elaboração", "Submetido", "Em avaliação", "Em revisão", "Aceito"];
export const STATUS_PUBLICADOS: Status[] = ["Publicado", "Apresentado"];
export const STATUS_ENCERRADOS: Status[] = ["Recusado", "Retirado"];

export type Secao = "submissoes" | "publicados" | "encerrados";

export function secaoDoStatus(s: string): Secao {
  if ((STATUS_PUBLICADOS as string[]).includes(s)) return "publicados";
  if ((STATUS_ENCERRADOS as string[]).includes(s)) return "encerrados";
  return "submissoes";
}

export const ROTULO_SECAO: Record<Secao, string> = {
  submissoes: "Submissões",
  publicados: "Publicados",
  encerrados: "Encerrados",
};

export const PAPEIS_AUTOR = ["Autor principal", "Coautor", "Correspondente", "Orientador"] as const;

export interface TipoPadrao {
  chave: string;
  nome: string;
  subtipos: string[];
}

const SUBTIPOS_ARTIGO = [
  "Original/pesquisa",
  "Revisão integrativa",
  "Revisão sistemática",
  "Revisão de escopo",
  "Revisão narrativa/bibliográfica",
  "Metanálise",
  "Opinião/ensaio/reflexão",
  "Relato de experiência",
  "Relato de caso",
  "Editorial",
  "Carta ao editor",
];

export const TIPOS_PADRAO: TipoPadrao[] = [
  { chave: "artigo", nome: "Artigo em periódico", subtipos: SUBTIPOS_ARTIGO },
  { chave: "relato", nome: "Relato de experiência (fora de periódico)", subtipos: ["Mostra", "Seminário", "Institucional"] },
  { chave: "livro", nome: "Livro", subtipos: ["Autoral", "Organizado/coletânea", "Didático", "E-book"] },
  { chave: "capitulo", nome: "Capítulo de livro", subtipos: SUBTIPOS_ARTIGO },
  { chave: "anais", nome: "Anais de evento", subtipos: ["Trabalho completo", "Resumo expandido", "Resumo simples"] },
  { chave: "apresentacao", nome: "Apresentação de trabalho", subtipos: ["Oral", "Pôster/banner", "Mesa-redonda", "Palestra"] },
  { chave: "jornal", nome: "Jornal ou revista de divulgação", subtipos: ["Artigo de opinião", "Entrevista", "Coluna"] },
  { chave: "tecnica", nome: "Produção técnica", subtipos: ["Protocolo", "Manual", "Relatório técnico", "Software", "Curso"] },
];

/** Campos específicos que aparecem no formulário de cada tipo. */
export const CAMPOS_POR_TIPO: Record<string, string[]> = {
  artigo: ["veiculo", "issn", "doi", "volume", "numero", "paginas"],
  relato: ["veiculo", "evento", "instituicao"],
  livro: ["editora", "isbn", "doi", "edicao", "paginas", "cidade"],
  capitulo: ["livro_titulo", "organizadores", "editora", "isbn", "doi", "paginas", "cidade"],
  anais: ["evento", "issn", "isbn", "modalidade", "premiacao", "doi", "paginas"],
  apresentacao: ["evento", "modalidade", "premiacao"],
  jornal: ["veiculo", "link"],
  tecnica: ["instituicao", "registro"],
};

export const TIPOS_VEICULO = ["revista", "editora", "evento", "jornal"] as const;

export const INDICADORES: { chave: string; nome: string }[] = [
  { chave: "QUALIS", nome: "Qualis" },
  { chave: "JIF", nome: "JIF" },
  { chave: "JIF5", nome: "JIF 5 anos" },
  { chave: "JCI", nome: "JCI" },
  { chave: "QUARTIL_JCR", nome: "Quartil JCR" },
  { chave: "POSICAO_JCR", nome: "Posição na categoria JCR" },
  { chave: "CATEGORIA_JCR", nome: "Categoria JCR" },
  { chave: "COLECAO_WOS", nome: "Coleção WoS" },
  { chave: "SJR", nome: "SJR" },
  { chave: "CITESCORE", nome: "CiteScore" },
  { chave: "QUARTIL_SCOPUS", nome: "Quartil Scopus" },
  { chave: "H5", nome: "h5 (Google Acadêmico)" },
];

export const ESTRATOS_QUALIS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C"];

export const AREAS_QUALIS_COMUNS = [
  "Enfermagem",
  "Saúde Coletiva",
  "Interdisciplinar",
  "Medicina I",
  "Medicina II",
  "Medicina III",
  "Educação",
  "Ensino",
  "Nutrição",
  "Educação Física",
];

export const BASES_INDEXACAO = [
  "WoS SCIE",
  "WoS SSCI",
  "WoS AHCI",
  "WoS ESCI",
  "Scopus",
  "SciELO",
  "PubMed/MEDLINE",
  "LILACS",
  "BDENF",
  "DOAJ",
  "Latindex",
  "REDIB",
  "Dialnet",
  "CINAHL",
];

export const SELOS: Record<string, string> = {
  confirmado_oficial: "Confirmado na fonte oficial",
  informado_revista: "Informado pela revista",
  informado_usuario: "Informado pelo usuário",
  nao_localizado: "Não localizado",
};

export const TIPO_TAXA_SUBMISSAO = "Taxa de submissão";
export const TIPO_TAXA_PUBLICACAO = "Taxa de publicação (APC)";

export const TIPOS_CUSTO = [
  TIPO_TAXA_SUBMISSAO,
  TIPO_TAXA_PUBLICACAO,
  "Inscrição em evento",
  "Tradução",
  "Revisão de língua",
  "Formatação",
  "DOI avulso",
  "ISBN",
  "Impressão",
  "Viagem e hospedagem",
  "Outros",
];

export const MOEDAS = ["BRL", "USD", "EUR"] as const;

export const PAGADORES = ["Próprio", "Instituição", "Bolsa", "Coautores"];

export const IDIOMAS = ["Português", "Inglês", "Espanhol", "Francês", "Outro"];
