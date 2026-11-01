// Coautores: cadastro, reconhecimento do autor principal, sugestões de
// fusão de grafias ("SCHIAVÃO, L." x "SCHIAVAO, L.") e ranking.
import { executar, inserir, todos, transacao, um } from "./db";
import { chaveNome, chaveNomeCurta, nomeEmCitacao, normalizarOrcid, similaridade } from "./texto";

export interface Coautor {
  id: number;
  nome: string;
  nome_citacao: string | null;
  chave_nome: string;
  orcid: string | null;
  lattes_id: string | null;
  instituicao: string | null;
  email: string | null;
}

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

/**
 * Coautor existente com o mesmo ORCID, a mesma grafia exata ou uma grafia já
 * juntada antes. Grafias diferentes NÃO são juntadas sozinhas: viram
 * sugestão de fusão, que o usuário confirma.
 */
export function encontrarOuCriarCoautor(
  donoId: number,
  a: { nome: string; orcid?: string | null; afiliacao?: string | null },
): number {
  const orcid = normalizarOrcid(a.orcid);
  if (orcid) {
    const c = um<{ id: number }>("SELECT id FROM coautor WHERE dono_id = ? AND orcid = ?", donoId, orcid);
    if (c) return c.id;
  }
  const exato = a.nome.trim().toLowerCase();
  const porNome = um<{ id: number; orcid: string | null }>(
    `SELECT c.id, c.orcid FROM coautor c WHERE c.dono_id = ? AND (lower(c.nome) = ? OR lower(COALESCE(c.nome_citacao,'')) = ?
       OR EXISTS (SELECT 1 FROM coautor_variacao v WHERE v.coautor_id = c.id AND lower(v.grafia) = ?))
     ORDER BY c.id LIMIT 1`,
    donoId,
    exato,
    exato,
    exato,
  );
  if (porNome && (!orcid || !porNome.orcid)) {
    if (orcid) executar("UPDATE coautor SET orcid = ? WHERE id = ?", orcid, porNome.id);
    return porNome.id;
  }
  return inserir("coautor", {
    dono_id: donoId,
    nome: a.nome.trim(),
    nome_citacao: a.nome.includes(",") ? a.nome.trim() : nomeEmCitacao(a.nome),
    chave_nome: chaveNome(a.nome),
    orcid,
    instituicao: a.afiliacao ?? null,
  });
}

export function salvarCoautor(donoId: number, id: number, d: Partial<Coautor>) {
  const c = um<Coautor>("SELECT * FROM coautor WHERE id = ? AND dono_id = ?", id, donoId);
  if (!c) throw new Error("Coautor não encontrado.");
  const nome = d.nome?.trim() || c.nome;
  executar(
    "UPDATE coautor SET nome = ?, nome_citacao = ?, chave_nome = ?, orcid = ?, lattes_id = ?, instituicao = ?, email = ? WHERE id = ?",
    nome,
    d.nome_citacao ?? c.nome_citacao,
    chaveNome(nome),
    normalizarOrcid(d.orcid ?? c.orcid),
    d.lattes_id ?? c.lattes_id,
    d.instituicao ?? c.instituicao,
    d.email ?? c.email,
    id,
  );
}

export interface SugestaoFusao {
  a: Coautor;
  b: Coautor;
  motivo: string;
}

/** Pares de coautores que parecem ser a mesma pessoa. */
export function sugestoesDeFusao(donoId: number): SugestaoFusao[] {
  const lista = todos<Coautor>("SELECT * FROM coautor WHERE dono_id = ? ORDER BY id", donoId);
  const recusados = new Set(
    todos<{ a_id: number; b_id: number }>(
      "SELECT a_id, b_id FROM coautor_nao_fundir WHERE a_id IN (SELECT id FROM coautor WHERE dono_id = ?)",
      donoId,
    ).map((r) => `${r.a_id}-${r.b_id}`),
  );
  const out: SugestaoFusao[] = [];
  for (let i = 0; i < lista.length; i++) {
    for (let j = i + 1; j < lista.length; j++) {
      const a = lista[i];
      const b = lista[j];
      if (recusados.has(`${a.id}-${b.id}`)) continue;
      let motivo: string | null = null;
      if (a.orcid && b.orcid) {
        if (a.orcid === b.orcid) motivo = "Mesmo ORCID";
        else continue; // ORCIDs diferentes: pessoas diferentes
      } else if (a.chave_nome === b.chave_nome) {
        motivo = "Mesmo nome com grafia diferente (acentos, caixa ou formato)";
      } else if (chaveNomeCurta(a.nome) === chaveNomeCurta(b.nome)) {
        const [, ia = ""] = a.chave_nome.split(" ");
        const [, ib = ""] = b.chave_nome.split(" ");
        if (ia.startsWith(ib) || ib.startsWith(ia)) motivo = "Mesmo sobrenome e iniciais compatíveis";
      } else if (similaridade(a.nome, b.nome) >= 0.9) {
        motivo = "Nomes muito parecidos";
      }
      if (motivo) out.push({ a, b, motivo });
    }
  }
  return out;
}

/** Junta o coautor "remover" no "manter" (após confirmação do usuário). */
export function fundirCoautores(donoId: number, manterId: number, removerId: number) {
  if (manterId === removerId) return;
  const manter = um<Coautor>("SELECT * FROM coautor WHERE id = ? AND dono_id = ?", manterId, donoId);
  const remover = um<Coautor>("SELECT * FROM coautor WHERE id = ? AND dono_id = ?", removerId, donoId);
  if (!manter || !remover) throw new Error("Coautor não encontrado.");
  transacao(() => {
    executar("UPDATE autoria SET coautor_id = ? WHERE coautor_id = ?", manterId, removerId);
    executar("UPDATE coautor_variacao SET coautor_id = ? WHERE coautor_id = ?", manterId, removerId);
    const jaTem = new Set([manter.nome, manter.nome_citacao, ...variacoesDe(manterId)].filter(Boolean).map((g) => g!.toLowerCase()));
    for (const g of [remover.nome, remover.nome_citacao].filter(Boolean) as string[]) {
      if (jaTem.has(g.toLowerCase())) continue;
      jaTem.add(g.toLowerCase());
      inserir("coautor_variacao", { coautor_id: manterId, grafia: g });
    }
    executar(
      "UPDATE coautor SET orcid = COALESCE(orcid, ?), lattes_id = COALESCE(lattes_id, ?), instituicao = COALESCE(instituicao, ?), email = COALESCE(email, ?) WHERE id = ?",
      remover.orcid,
      remover.lattes_id,
      remover.instituicao,
      remover.email,
      manterId,
    );
    executar("DELETE FROM coautor WHERE id = ?", removerId);
  });
}

export function marcarNaoFundir(donoId: number, aId: number, bId: number) {
  const [x, y] = aId < bId ? [aId, bId] : [bId, aId];
  if (!um("SELECT 1 FROM coautor WHERE id = ? AND dono_id = ?", x, donoId)) throw new Error("Coautor não encontrado.");
  executar("INSERT OR IGNORE INTO coautor_nao_fundir (a_id, b_id) VALUES (?, ?)", x, y);
}

export function variacoesDe(coautorId: number): string[] {
  return todos<{ grafia: string }>("SELECT grafia FROM coautor_variacao WHERE coautor_id = ?", coautorId).map(
    (r) => r.grafia,
  );
}

export interface LinhaRanking {
  id: number;
  nome: string;
  orcid: string | null;
  instituicao: string | null;
  trabalhos: number;
  primeiro_ano: number | null;
  ultimo_ano: number | null;
  tipos: string;
  variacoes: string;
}

/** Ranking dos coautores com quem o autor principal mais publicou. */
export function rankingCoautores(donoId: number, publicacaoIds?: number[] | null): LinhaRanking[] {
  const filtro = publicacaoIds ? `AND p.id IN (${publicacaoIds.map(() => "?").join(",") || "NULL"})` : "";
  return todos<LinhaRanking>(
    `SELECT c.id, c.nome, c.orcid, c.instituicao,
            COUNT(DISTINCT p.id) AS trabalhos,
            MIN(p.ano) AS primeiro_ano, MAX(p.ano) AS ultimo_ano,
            GROUP_CONCAT(DISTINCT t.nome) AS tipos,
            (SELECT GROUP_CONCAT(grafia, '; ') FROM coautor_variacao v WHERE v.coautor_id = c.id) AS variacoes
       FROM coautor c
       JOIN autoria a ON a.coautor_id = c.id
       JOIN publicacao p ON p.id = a.publicacao_id
       JOIN tipo_publicacao t ON t.id = p.tipo_id
      WHERE c.dono_id = ? ${filtro}
      GROUP BY c.id
      ORDER BY trabalhos DESC, c.nome`,
    donoId,
    ...(publicacaoIds ?? []),
  );
}

/** Arestas da rede de colaboração: pares de coautores que publicaram juntos. */
export function redeColaboracao(donoId: number, publicacaoIds?: number[] | null, limite = 25) {
  const top = rankingCoautores(donoId, publicacaoIds).slice(0, limite);
  const ids = top.map((t) => t.id);
  if (!ids.length) return { nos: [], arestas: [] as { a: number; b: number; peso: number }[] };
  const marc = ids.map(() => "?").join(",");
  const arestas = todos<{ a: number; b: number; peso: number }>(
    `SELECT x.coautor_id AS a, y.coautor_id AS b, COUNT(*) AS peso
       FROM autoria x JOIN autoria y ON x.publicacao_id = y.publicacao_id AND x.coautor_id < y.coautor_id
      WHERE x.coautor_id IN (${marc}) AND y.coautor_id IN (${marc})
      GROUP BY x.coautor_id, y.coautor_id`,
    ...ids,
    ...ids,
  );
  return { nos: top, arestas };
}
