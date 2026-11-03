// Leitura do currículo Lattes (XML exportado pela Plataforma Lattes, solto ou
// dentro do .zip que o Lattes baixa) e conversão em publicações do sistema.
import { normalizar, normalizarDoi, normalizarIsbn, normalizarIssn } from "./texto";

// ---------- XML mínimo (o Lattes usa quase só atributos) ----------

export interface No {
  nome: string;
  attr: Record<string, string>;
  filhos: No[];
}

function decodificar(s: string): string {
  // O Lattes às vezes codifica duas ou três vezes ("&amp;amp;#45;"): repete até estabilizar.
  let atual = s;
  for (let i = 0; i < 4; i++) {
    const prox = decodificarUmaVez(atual);
    if (prox === atual) break;
    atual = prox;
  }
  return atual;
}

function decodificarUmaVez(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function lerXml(texto: string): No {
  const raiz: No = { nome: "#raiz", attr: {}, filhos: [] };
  const pilha: No[] = [raiz];
  const re = /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  const reAttr = /([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  const semComentarios = texto.replace(/<!--[\s\S]*?-->/g, "").replace(/<\?[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[^>]*>/gi, "");
  while ((m = re.exec(semComentarios))) {
    const [, fecha, nome, attrs, autoFecha] = m;
    if (fecha) {
      while (pilha.length > 1 && pilha.pop()!.nome !== nome) {
        /* fecha até o nó correspondente */
      }
      continue;
    }
    const attr: Record<string, string> = {};
    let a: RegExpExecArray | null;
    reAttr.lastIndex = 0;
    while ((a = reAttr.exec(attrs))) attr[a[1]] = decodificar(a[2] ?? a[3] ?? "");
    const no: No = { nome, attr, filhos: [] };
    pilha[pilha.length - 1].filhos.push(no);
    if (!autoFecha) pilha.push(no);
  }
  return raiz;
}

export function todosOs(no: No, nome: string): No[] {
  const out: No[] = [];
  const visitar = (n: No) => {
    for (const f of n.filhos) {
      if (f.nome === nome) out.push(f);
      visitar(f);
    }
  };
  visitar(no);
  return out;
}

function filho(no: No, nome: string): No | undefined {
  return no.filhos.find((f) => f.nome === nome);
}

/** Lê o arquivo enviado: XML (em ISO-8859-1 ou UTF-8) ou o .zip do Lattes. */
export async function textoDoArquivoLattes(conteudo: Buffer, nome: string): Promise<string> {
  let bruto = conteudo;
  if (nome.toLowerCase().endsWith(".zip") || (conteudo[0] === 0x50 && conteudo[1] === 0x4b)) {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(conteudo);
    const xml = Object.values(zip.files).find((f) => !f.dir && f.name.toLowerCase().endsWith(".xml"));
    if (!xml) throw new Error("O .zip não tem o arquivo XML do Lattes.");
    bruto = await xml.async("nodebuffer");
  }
  const cabeca = bruto.subarray(0, 200).toString("latin1");
  const latin = /encoding\s*=\s*["']?(iso-8859-1|latin-?1|windows-1252)/i.test(cabeca);
  return bruto.toString(latin ? "latin1" : "utf8");
}

// ---------- Conversão para publicações ----------

export interface AutorLattes {
  nome: string;
  citacao: string;
  ordem: number;
  idCnpq: string;
  ehDono: boolean; // é a pessoa dona do currículo
}

export interface ItemLattes {
  origem: string; // ex.: "Artigo publicado"
  chaveTipo: string; // artigo, anais, livro, capitulo, jornal, apresentacao
  subtipo: string | null;
  status: string;
  titulo: string;
  ano: number | null;
  doi: string | null;
  isbn: string | null;
  issn: string | null;
  idioma: string | null;
  link: string | null;
  volume: string | null;
  numero: string | null;
  paginas: string | null;
  veiculo: string | null; // revista, jornal
  evento: { nome: string; cidade: string | null; ano: number | null } | null;
  livro_titulo: string | null;
  organizadores: string | null;
  editora: string | null;
  cidade: string | null;
  edicao: string | null;
  modalidade: string | null;
  data_publicacao: string | null;
  palavras_chave: string | null;
  autores: AutorLattes[];
}

export interface CurriculoLattes {
  idLattes: string;
  nome: string;
  nomesCitacao: string[];
  atualizadoEm: string | null;
  itens: ItemLattes[];
}

const v = (x: string | undefined | null) => (x && x.trim() ? x.trim() : null);

function paginas(d: Record<string, string>): string | null {
  const ini = v(d["PAGINA-INICIAL"]);
  const fim = v(d["PAGINA-FINAL"]);
  if (!ini) return null;
  return fim && fim !== ini ? `${ini}-${fim}` : ini;
}

const IDIOMAS: Record<string, string> = { Português: "Português", Inglês: "Inglês", Espanhol: "Espanhol", Francês: "Francês" };

function autores(no: No): AutorLattes[] {
  return no.filhos
    .filter((f) => f.nome === "AUTORES")
    .map((a) => ({
      nome: v(a.attr["NOME-COMPLETO-DO-AUTOR"]) ?? "",
      citacao: v(a.attr["NOME-PARA-CITACAO"])?.split(";")[0].trim() ?? "",
      ordem: Number(a.attr["ORDEM-DE-AUTORIA"]) || 0,
      idCnpq: v(a.attr["NRO-ID-CNPQ"]) ?? "",
      ehDono: false,
    }))
    .filter((a) => a.nome || a.citacao)
    .sort((x, y) => x.ordem - y.ordem);
}

function palavras(no: No): string | null {
  const p = filho(no, "PALAVRAS-CHAVE");
  if (!p) return null;
  const l = Object.keys(p.attr)
    .filter((k) => k.startsWith("PALAVRA-CHAVE-"))
    .sort()
    .map((k) => p.attr[k])
    .filter((x) => x && x.trim());
  return l.length ? l.join("; ") : null;
}

function base(no: No, b: Record<string, string>): Pick<ItemLattes, "doi" | "idioma" | "link" | "palavras_chave" | "autores"> {
  return {
    doi: normalizarDoi(b["DOI"]),
    idioma: IDIOMAS[b["IDIOMA"]] ?? v(b["IDIOMA"]),
    link: v(b["HOME-PAGE-DO-TRABALHO"])?.replace(/^\[|\]$/g, "") ?? null,
    palavras_chave: palavras(no),
    autores: autores(no),
  };
}

function vazio(): Omit<ItemLattes, "origem" | "chaveTipo" | "titulo" | "status"> {
  return {
    subtipo: null, ano: null, doi: null, isbn: null, issn: null, idioma: null, link: null, volume: null, numero: null,
    paginas: null, veiculo: null, evento: null, livro_titulo: null, organizadores: null, editora: null, cidade: null,
    edicao: null, modalidade: null, data_publicacao: null, palavras_chave: null, autores: [],
  };
}

function artigo(no: No, aceito: boolean): ItemLattes | null {
  const b = filho(no, "DADOS-BASICOS-DO-ARTIGO")?.attr ?? {};
  const d = filho(no, "DETALHAMENTO-DO-ARTIGO")?.attr ?? {};
  const titulo = v(b["TITULO-DO-ARTIGO"]);
  if (!titulo) return null;
  const ano = Number(b["ANO-DO-ARTIGO"]) || null;
  return {
    ...vazio(),
    ...base(no, b),
    origem: aceito ? "Artigo aceito para publicação" : "Artigo publicado",
    chaveTipo: "artigo",
    status: aceito ? "Aceito" : "Publicado",
    titulo,
    ano,
    issn: normalizarIssn(d["ISSN"]),
    veiculo: v(d["TITULO-DO-PERIODICO-OU-REVISTA"]),
    volume: v(d["VOLUME"]),
    numero: v(d["FASCICULO"]),
    paginas: paginas(d),
    cidade: v(d["LOCAL-DE-PUBLICACAO"]),
    data_publicacao: ano && !aceito ? `${ano}-01-01` : null,
  };
}

const NATUREZA_EVENTO: Record<string, string> = {
  COMPLETO: "Trabalho completo",
  RESUMO: "Resumo simples",
  RESUMO_EXPANDIDO: "Resumo expandido",
};

function trabalhoEvento(no: No): ItemLattes | null {
  const b = filho(no, "DADOS-BASICOS-DO-TRABALHO")?.attr ?? {};
  const d = filho(no, "DETALHAMENTO-DO-TRABALHO")?.attr ?? {};
  const titulo = v(b["TITULO-DO-TRABALHO"]);
  if (!titulo) return null;
  const ano = Number(b["ANO-DO-TRABALHO"]) || Number(d["ANO-DE-REALIZACAO"]) || null;
  return {
    ...vazio(),
    ...base(no, b),
    origem: "Trabalho em evento",
    chaveTipo: "anais",
    subtipo: NATUREZA_EVENTO[b["NATUREZA"]] ?? null,
    status: "Publicado",
    titulo,
    ano,
    isbn: normalizarIsbn(d["ISBN"]),
    volume: v(d["VOLUME"]),
    numero: v(d["FASCICULO"]),
    paginas: paginas(d),
    evento: v(d["NOME-DO-EVENTO"])
      ? { nome: d["NOME-DO-EVENTO"].trim(), cidade: v(d["CIDADE-DO-EVENTO"]), ano: Number(d["ANO-DE-REALIZACAO"]) || ano }
      : null,
    livro_titulo: v(d["TITULO-DOS-ANAIS-OU-PROCEEDINGS"]),
    editora: v(d["NOME-DA-EDITORA"]),
    cidade: v(d["CIDADE-DA-EDITORA"]) ?? v(d["CIDADE-DO-EVENTO"]),
    data_publicacao: ano ? `${ano}-01-01` : null,
  };
}

function livro(no: No): ItemLattes | null {
  const b = filho(no, "DADOS-BASICOS-DO-LIVRO")?.attr ?? {};
  const d = filho(no, "DETALHAMENTO-DO-LIVRO")?.attr ?? {};
  const titulo = v(b["TITULO-DO-LIVRO"]);
  if (!titulo) return null;
  const ano = Number(b["ANO"]) || null;
  const organizado = (b["TIPO"] ?? "").includes("ORGANIZADO");
  return {
    ...vazio(),
    ...base(no, b),
    origem: organizado ? "Livro organizado" : "Livro publicado",
    chaveTipo: "livro",
    subtipo: organizado ? "Organizado/coletânea" : "Autoral",
    status: "Publicado",
    titulo,
    ano,
    isbn: normalizarIsbn(d["ISBN"]),
    paginas: v(d["NUMERO-DE-PAGINAS"]),
    editora: v(d["NOME-DA-EDITORA"]),
    cidade: v(d["CIDADE-DA-EDITORA"]),
    edicao: v(d["NUMERO-DA-EDICAO-REVISAO"]),
    data_publicacao: ano ? `${ano}-01-01` : null,
  };
}

function capitulo(no: No): ItemLattes | null {
  const b = filho(no, "DADOS-BASICOS-DO-CAPITULO")?.attr ?? {};
  const d = filho(no, "DETALHAMENTO-DO-CAPITULO")?.attr ?? {};
  const titulo = v(b["TITULO-DO-CAPITULO-DO-LIVRO"]);
  if (!titulo) return null;
  const ano = Number(b["ANO"]) || null;
  return {
    ...vazio(),
    ...base(no, b),
    origem: "Capítulo de livro",
    chaveTipo: "capitulo",
    status: "Publicado",
    titulo,
    ano,
    isbn: normalizarIsbn(d["ISBN"]),
    paginas: paginas(d),
    livro_titulo: v(d["TITULO-DO-LIVRO"]),
    organizadores: v(d["ORGANIZADORES"]),
    editora: v(d["NOME-DA-EDITORA"]),
    cidade: v(d["CIDADE-DA-EDITORA"]),
    edicao: v(d["NUMERO-DA-EDICAO-REVISAO"]),
    data_publicacao: ano ? `${ano}-01-01` : null,
  };
}

function dataLattes(ddmmaaaa: string | undefined): string | null {
  const m = (ddmmaaaa ?? "").match(/^(\d{2})(\d{2})(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function textoJornal(no: No): ItemLattes | null {
  const b = filho(no, "DADOS-BASICOS-DO-TEXTO")?.attr ?? {};
  const d = filho(no, "DETALHAMENTO-DO-TEXTO")?.attr ?? {};
  const titulo = v(b["TITULO-DO-TEXTO"]);
  if (!titulo) return null;
  const ano = Number(b["ANO-DO-TEXTO"]) || null;
  return {
    ...vazio(),
    ...base(no, b),
    origem: "Texto em jornal ou revista",
    chaveTipo: "jornal",
    status: "Publicado",
    titulo,
    ano,
    issn: normalizarIssn(d["ISSN"]),
    veiculo: v(d["TITULO-DO-JORNAL-OU-REVISTA"]),
    volume: v(d["VOLUME"]),
    paginas: paginas(d),
    cidade: v(d["LOCAL-DE-PUBLICACAO"]),
    data_publicacao: dataLattes(d["DATA-DE-PUBLICACAO"]) ?? (ano ? `${ano}-01-01` : null),
  };
}

const NATUREZA_APRESENTACAO: Record<string, string> = {
  COMUNICACAO: "Oral",
  CONFERENCIA: "Palestra",
  CONGRESSO: "Oral",
  SEMINARIO: "Oral",
  SIMPOSIO: "Mesa-redonda",
  PALESTRA: "Palestra",
};

function apresentacao(no: No): ItemLattes | null {
  const b = filho(no, "DADOS-BASICOS-DA-APRESENTACAO-DE-TRABALHO")?.attr ?? {};
  const d = filho(no, "DETALHAMENTO-DA-APRESENTACAO-DE-TRABALHO")?.attr ?? {};
  const titulo = v(b["TITULO"]);
  if (!titulo) return null;
  const ano = Number(b["ANO"]) || null;
  const sub = NATUREZA_APRESENTACAO[b["NATUREZA"]] ?? null;
  return {
    ...vazio(),
    ...base(no, b),
    origem: "Apresentação de trabalho",
    chaveTipo: "apresentacao",
    subtipo: sub,
    status: "Apresentado",
    titulo,
    ano,
    modalidade: sub,
    evento: v(d["NOME-DO-EVENTO"])
      ? { nome: d["NOME-DO-EVENTO"].trim(), cidade: v(d["CIDADE-DA-APRESENTACAO"]), ano }
      : null,
    cidade: v(d["CIDADE-DA-APRESENTACAO"]),
    data_publicacao: ano ? `${ano}-01-01` : null,
  };
}

export function lerCurriculo(texto: string): CurriculoLattes {
  const raiz = lerXml(texto);
  const cv = todosOs(raiz, "CURRICULO-VITAE")[0];
  if (!cv) throw new Error("Este arquivo não é um currículo Lattes (falta CURRICULO-VITAE).");
  const dg = filho(cv, "DADOS-GERAIS")?.attr ?? {};
  const itens: ItemLattes[] = [];
  const add = (lista: No[], f: (n: No) => ItemLattes | null) => {
    for (const n of lista) {
      const i = f(n);
      if (i) itens.push(i);
    }
  };
  add(todosOs(cv, "ARTIGO-PUBLICADO"), (n) => artigo(n, false));
  add(todosOs(cv, "ARTIGO-ACEITO-PARA-PUBLICACAO"), (n) => artigo(n, true));
  add(todosOs(cv, "TRABALHO-EM-EVENTOS"), trabalhoEvento);
  add(todosOs(cv, "LIVRO-PUBLICADO-OU-ORGANIZADO"), livro);
  add(todosOs(cv, "CAPITULO-DE-LIVRO-PUBLICADO"), capitulo);
  add(todosOs(cv, "TEXTO-EM-JORNAL-OU-REVISTA"), textoJornal);
  add(todosOs(cv, "APRESENTACAO-DE-TRABALHO"), apresentacao);
  const idLattes = v(cv.attr["NUMERO-IDENTIFICADOR"]) ?? "";
  const nome = v(dg["NOME-COMPLETO"]) ?? "";
  const nomesCitacao = (dg["NOME-EM-CITACOES-BIBLIOGRAFICAS"] ?? "").split(";").map((s) => s.trim()).filter(Boolean);
  // O Lattes costuma deixar o ID do autor vazio; o nome completo e os nomes em citação identificam a dona do currículo.
  const meus = new Set([nome, ...nomesCitacao].map((n) => normalizar(n)).filter(Boolean));
  for (const it of itens)
    for (const a of it.autores) a.ehDono = (!!idLattes && a.idCnpq === idLattes) || meus.has(normalizar(a.nome)) || meus.has(normalizar(a.citacao));
  return { idLattes, nome, nomesCitacao, atualizadoEm: dataLattes(cv.attr["DATA-ATUALIZACAO"]), itens };
}
