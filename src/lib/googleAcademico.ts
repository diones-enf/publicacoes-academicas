// Citações do Google Acadêmico, lidas do perfil público do pesquisador.
import { executar, todos, transacao, um } from "./db";
import { buscarPerfilGoogle, idDoPerfil, lerPerfilGoogle, paginaBloqueada, type PerfilGoogle } from "./conectores/googleAcademico";
import { mesAtual, recalcularIndicadores, registrarCitacoes } from "./citacoes";
import { normalizar, similaridade } from "./texto";

export const FONTE_GOOGLE = "Google Acadêmico";

export function perfilGoogleDe(donoId: number): string | null {
  return um<{ g: string | null }>("SELECT google_academico AS g FROM usuario WHERE id = ?", donoId)?.g ?? null;
}

export function salvarPerfilGoogle(donoId: number, entrada: string) {
  const id = idDoPerfil(entrada);
  if (entrada.trim() && !id) throw new Error("Link não reconhecido. Copie o endereço da página do seu perfil (tem \"user=\" no meio).");
  executar("UPDATE usuario SET google_academico = ? WHERE id = ?", id, donoId);
  return id;
}

/** O Google às vezes acrescenta texto ao título (": Not applicable."); por isso aceita início igual. */
export function mesmoTitulo(a: string, b: string): boolean {
  const x = normalizar(a);
  const y = normalizar(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [curto, longo] = x.length <= y.length ? [x, y] : [y, x];
  if (curto.length >= 30 && longo.startsWith(curto)) return true;
  return similaridade(x, y) >= 0.9;
}

export interface ResultadoGoogle {
  nome: string | null;
  artigos: number;
  vinculados: number;
  citacoes: number;
  h: number | null;
  foraDoSistema: { titulo: string; ano: number | null; citacoes: number }[];
}

/** Grava os números do perfil e as citações de cada publicação encontrada no sistema. */
export function gravarPerfilGoogle(donoId: number, p: PerfilGoogle): ResultadoGoogle {
  const mes = mesAtual();
  const pubs = todos<{ id: number; titulo: string; ano: number | null }>("SELECT id, titulo, ano FROM publicacao WHERE dono_id = ?", donoId);
  // o mesmo trabalho pode aparecer mais de uma vez no Google: fica o maior número
  const porPub = new Map<number, number>();
  const artigos = p.artigos.map((a) => {
    const pub =
      pubs.find((x) => mesmoTitulo(x.titulo, a.titulo) && (!x.ano || !a.ano || Math.abs(x.ano - a.ano) <= 1)) ??
      pubs.find((x) => mesmoTitulo(x.titulo, a.titulo));
    if (pub) porPub.set(pub.id, Math.max(porPub.get(pub.id) ?? 0, a.citacoes));
    return { ...a, publicacao_id: pub?.id ?? null };
  });
  const totalCitacoes = p.citacoes ?? p.artigos.reduce((s, a) => s + a.citacoes, 0);
  transacao(() => {
    for (const [pubId, total] of porPub) registrarCitacoes(donoId, pubId, FONTE_GOOGLE, total, mes);
    executar(
      `INSERT INTO perfil_google_mensal (dono_id, mes, citacoes, citacoes_desde, h, h_desde, i10, i10_desde, ano_desde, por_ano, artigos)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(dono_id, mes) DO UPDATE SET citacoes = excluded.citacoes, citacoes_desde = excluded.citacoes_desde, h = excluded.h,
         h_desde = excluded.h_desde, i10 = excluded.i10, i10_desde = excluded.i10_desde, ano_desde = excluded.ano_desde,
         por_ano = excluded.por_ano, artigos = excluded.artigos, registrado_em = datetime('now')`,
      donoId,
      mes,
      totalCitacoes,
      p.citacoesDesde ?? (p.citacoes === null ? totalCitacoes : null),
      p.h ?? (p.citacoes === null ? 0 : null),
      p.hDesde,
      p.i10 ?? (p.citacoes === null ? 0 : null),
      p.i10Desde,
      p.anoDesde,
      JSON.stringify(p.porAno),
      JSON.stringify(artigos),
    );
  });
  recalcularIndicadores(donoId, mes);
  return {
    nome: p.nome,
    artigos: p.artigos.length,
    vinculados: porPub.size,
    citacoes: totalCitacoes,
    h: p.h ?? (p.citacoes === null ? 0 : null),
    foraDoSistema: artigos.filter((a) => !a.publicacao_id).map((a) => ({ titulo: a.titulo, ano: a.ano, citacoes: a.citacoes })),
  };
}

/** Busca o perfil na internet (rotina mensal e botão). */
export async function atualizarGoogle(donoId: number): Promise<ResultadoGoogle | null> {
  const id = perfilGoogleDe(donoId);
  if (!id) return null;
  return gravarPerfilGoogle(donoId, await buscarPerfilGoogle(id));
}

/** Página do perfil salva no computador (Ctrl+S), para quando o Google pede "não sou um robô". */
export function importarPaginaGoogle(donoId: number, html: string): ResultadoGoogle {
  if (paginaBloqueada(html)) throw new Error("Essa página é a verificação de robô do Google. Resolva a verificação no navegador, abra o seu perfil e salve de novo.");
  const p = lerPerfilGoogle(html);
  if (!p.artigos.length && !p.nome) throw new Error("O arquivo não parece a página de um perfil do Google Acadêmico.");
  return gravarPerfilGoogle(donoId, p);
}

export interface FotoGoogle {
  mes: string;
  citacoes: number | null;
  citacoes_desde: number | null;
  h: number | null;
  h_desde: number | null;
  i10: number | null;
  i10_desde: number | null;
  ano_desde: number | null;
  porAno: { ano: number; total: number }[];
  artigos: { titulo: string; ano: number | null; citacoes: number; publicacao_id: number | null }[];
  registrado_em: string;
}

export function resumoGoogle(donoId: number): { perfil: string | null; atual: FotoGoogle | null; serie: { mes: string; citacoes: number | null; h: number | null }[] } {
  const linhas = todos<Record<string, unknown>>("SELECT * FROM perfil_google_mensal WHERE dono_id = ? ORDER BY mes", donoId);
  const ult = linhas.at(-1);
  return {
    perfil: perfilGoogleDe(donoId),
    atual: ult
      ? ({
          ...(ult as unknown as FotoGoogle),
          porAno: JSON.parse(String(ult.por_ano)),
          artigos: JSON.parse(String(ult.artigos)),
        } as FotoGoogle)
      : null,
    serie: linhas.map((l) => ({ mes: String(l.mes), citacoes: l.citacoes as number | null, h: l.h as number | null })),
  };
}
