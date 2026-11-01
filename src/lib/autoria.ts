// Regras de autoria sem acesso ao banco (usadas também no navegador).
import { chaveNome, chaveNomeCurta, normalizarOrcid } from "./texto";

/** O autor da lista é o autor principal? Confere ORCID e os nomes em citação. */
export function ehAutorPrincipal(
  autor: { nome: string; orcid?: string | null },
  principal: { orcid: string | null; nomesCitacao: string[]; nome: string },
): boolean {
  const o1 = normalizarOrcid(autor.orcid);
  const o2 = normalizarOrcid(principal.orcid);
  if (o1 && o2) return o1 === o2;
  const chave = chaveNome(autor.nome);
  const curta = chaveNomeCurta(autor.nome);
  const nomes = [...principal.nomesCitacao, principal.nome];
  return nomes.some((n) => {
    const c = chaveNome(n);
    if (c === chave) return true;
    // "ROSA, D." x "ROSA, D. R.": mesmo sobrenome e a primeira inicial bate, e
    // um conjunto de iniciais é prefixo do outro.
    const [s1, i1 = ""] = c.split(" ");
    const [s2, i2 = ""] = chave.split(" ");
    return chaveNomeCurta(n) === curta && s1 === s2 && (i1.startsWith(i2) || i2.startsWith(i1));
  });
}

/** Localiza o autor principal numa lista de autores (prefere casamento por ORCID). */
export function localizarAutorPrincipal(
  autores: { nome: string; orcid?: string | null }[],
  principal: { orcid: string | null; nomesCitacao: string[]; nome: string },
): number {
  const o = normalizarOrcid(principal.orcid);
  if (o) {
    const i = autores.findIndex((a) => normalizarOrcid(a.orcid) === o);
    if (i >= 0) return i;
  }
  return autores.findIndex((a) => ehAutorPrincipal({ nome: a.nome }, { ...principal, orcid: null }));
}

export function papelPadrao(posicao: number, total: number): string {
  if (total <= 1) return "Autor único";
  if (posicao === 0) return "Autor principal";
  return "Coautor";
}

