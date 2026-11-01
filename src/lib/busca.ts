// Cadastro manual com preenchimento automático: busca por DOI, por autor
// (nome ou ORCID), por título e por ISBN, juntando as fontes públicas.
import { crossrefPorAutor, crossrefPorDoi, crossrefPorIsbn, crossrefPorTitulo } from "./conectores/crossref";
import { dataCitePorDoi } from "./conectores/datacite";
import { openAlexPorAutor, openAlexPorDoi, openAlexPorTitulo } from "./conectores/openalex";
import { openLibraryPorIsbn } from "./conectores/openlibrary";
import { orcidObras } from "./conectores/orcid";
import type { Metadados, ResultadoBusca } from "./conectores/tipos";
import { indiceCadastrados, verificarDuplicidade, type Duplicata } from "./publicacoes";
import { normalizar, normalizarDoi, normalizarIsbn, normalizarOrcid, similaridade } from "./texto";
import { sugerirSubtipo } from "./tipos";

export interface Preenchimento {
  dados: Metadados;
  origem: Record<string, string>; // campo -> fonte de onde veio
  fontes: string[];
  avisos: string[];
  subtipo_sugerido: string | null;
  duplicatas: Duplicata[];
}

async function tentar<T>(p: Promise<T>, avisos: string[]): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    avisos.push((e as Error).message);
    return null;
  }
}

/** Junta metadados de várias fontes: a primeira com valor em cada campo vence. */
export function juntarMetadados(lista: (Metadados | null)[]): { dados: Metadados; origem: Record<string, string> } {
  const validos = lista.filter(Boolean) as Metadados[];
  const dados: Metadados = { fonte: validos[0]?.fonte ?? "Manual" };
  const origem: Record<string, string> = {};
  for (const m of validos) {
    for (const [k, v] of Object.entries(m)) {
      if (k === "fonte") continue;
      const vazio = v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
      const atual = (dados as unknown as Record<string, unknown>)[k];
      const atualVazio = atual === null || atual === undefined || atual === "" || (Array.isArray(atual) && atual.length === 0);
      if (!vazio && atualVazio) {
        (dados as unknown as Record<string, unknown>)[k] = v;
        origem[k === "revista" ? "revista" : k] = m.fonte;
      }
    }
  }
  // Completa ORCIDs dos autores com outras fontes (mesma posição e nome parecido).
  if (dados.autores?.length) {
    for (const m of validos) {
      if (!m.autores?.length) continue;
      dados.autores = dados.autores.map((a, i) => {
        if (a.orcid) return a;
        const outro = m.autores![i];
        if (outro?.orcid && similaridade(outro.nome, a.nome) > 0.6) return { ...a, orcid: outro.orcid };
        return a;
      });
    }
  }
  return { dados, origem };
}

/** Busca por DOI: Crossref primeiro, OpenAlex em paralelo para completar e DataCite se o Crossref não tiver. */
export async function buscarPorDoi(donoId: number, entrada: string): Promise<Preenchimento | { erro: string }> {
  const doi = normalizarDoi(entrada);
  if (!doi) return { erro: "DOI em formato inválido. Exemplos aceitos: 10.1590/xxxx, doi.org/10.1590/xxxx ou o link completo." };
  const duplicatas = verificarDuplicidade(donoId, { doi });
  const avisos: string[] = [];
  const [cr, oa] = await Promise.all([tentar(crossrefPorDoi(doi), avisos), tentar(openAlexPorDoi(doi), avisos)]);
  const dc = cr ? null : await tentar(dataCitePorDoi(doi), avisos);
  const { dados, origem } = juntarMetadados([cr, dc, oa]);
  if (!cr && !dc && !oa) {
    return { erro: avisos.length ? `Não foi possível consultar as fontes (${avisos.join("; ")}).` : "DOI não encontrado no Crossref, DataCite nem OpenAlex." };
  }
  dados.doi = doi;
  return {
    dados,
    origem,
    fontes: [cr && "Crossref", dc && "DataCite", oa && "OpenAlex"].filter(Boolean) as string[],
    avisos,
    subtipo_sugerido: sugerirSubtipo(dados.titulo ?? "", dados.resumo),
    duplicatas,
  };
}

export async function buscarPorIsbn(donoId: number, entrada: string): Promise<Preenchimento | { erro: string }> {
  const isbn = normalizarIsbn(entrada);
  if (!isbn) return { erro: "ISBN inválido (deve ter 10 ou 13 dígitos)." };
  const avisos: string[] = [];
  const [cr, ol] = await Promise.all([tentar(crossrefPorIsbn(isbn), avisos), tentar(openLibraryPorIsbn(isbn), avisos)]);
  if (!cr && !ol) return { erro: "ISBN não encontrado no Crossref nem na Open Library." };
  const { dados, origem } = juntarMetadados([cr, ol]);
  dados.isbn = isbn;
  return {
    dados,
    origem,
    fontes: [cr && "Crossref", ol && "Open Library"].filter(Boolean) as string[],
    avisos,
    subtipo_sugerido: null,
    duplicatas: verificarDuplicidade(donoId, { isbn, titulo: dados.titulo }),
  };
}

export interface ResultadoMarcado extends ResultadoBusca {
  fontes: string[];
  cadastrado_id: number | null;
}

/** Junta resultados repetidos das várias fontes (mesmo DOI ou mesmo título) e marca os já cadastrados. */
export function marcarResultados(donoId: number, listas: ResultadoBusca[][]): ResultadoMarcado[] {
  const unidos: ResultadoMarcado[] = [];
  for (const r of listas.flat()) {
    const doi = normalizarDoi(r.doi);
    const igual = unidos.find(
      (u) => (doi && u.doi === doi) || (normalizar(u.titulo) === normalizar(r.titulo) && (!u.ano || !r.ano || u.ano === r.ano)),
    );
    if (igual) {
      if (!igual.fontes.includes(r.fonte)) igual.fontes.push(r.fonte);
      igual.doi ??= doi;
      igual.revista ??= r.revista;
      igual.ano ??= r.ano;
      if (!igual.autores.length) igual.autores = r.autores;
      continue;
    }
    unidos.push({ ...r, doi, fontes: [r.fonte], cadastrado_id: null });
  }
  const cadastrados = indiceCadastrados(donoId);
  for (const u of unidos) {
    const achado =
      (u.doi && cadastrados.find((c) => c.doi === u.doi)) ||
      cadastrados.find((c) => similaridade(c.titulo, u.titulo) >= 0.9 && (!c.ano || !u.ano || c.ano === u.ano));
    u.cadastrado_id = achado ? achado.id : null;
  }
  return unidos.sort((a, b) => (b.ano ?? 0) - (a.ano ?? 0));
}

export async function buscarPorAutor(donoId: number, nomeOuOrcid: string) {
  const avisos: string[] = [];
  const orcid = normalizarOrcid(nomeOuOrcid);
  const [o, oa, cr] = await Promise.all([
    orcid ? tentar(orcidObras(orcid), avisos) : Promise.resolve([] as ResultadoBusca[]),
    tentar(openAlexPorAutor(nomeOuOrcid), avisos),
    orcid ? Promise.resolve([] as ResultadoBusca[]) : tentar(crossrefPorAutor(nomeOuOrcid), avisos),
  ]);
  return { resultados: marcarResultados(donoId, [o ?? [], oa ?? [], cr ?? []]), avisos };
}

export async function buscarPorTitulo(donoId: number, titulo: string) {
  const avisos: string[] = [];
  const [cr, oa] = await Promise.all([tentar(crossrefPorTitulo(titulo), avisos), tentar(openAlexPorTitulo(titulo), avisos)]);
  return { resultados: marcarResultados(donoId, [cr ?? [], oa ?? []]), avisos };
}
