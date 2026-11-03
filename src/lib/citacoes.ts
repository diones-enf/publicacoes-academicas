// Evolução das citações: foto mensal por publicação e por pesquisador
// (total, índice h e i10), por fonte, sem nunca apagar os meses anteriores.
import { executar, inserir, todos, transacao, um } from "./db";
import { obrasPorDoi, obrasPorTitulo, quemCitou, type ObraCitada } from "./conectores/openalexCitacoes";
import { crossrefPorDoi } from "./conectores/crossref";
import { hojeIso, similaridade } from "./texto";

export const FONTES_CITACAO = ["OpenAlex", "Crossref", "Google Acadêmico", "Web of Science", "Scopus"] as const;
/** Fontes sem consulta pública gratuita: o número é digitado. */
export const FONTES_MANUAIS = ["Google Acadêmico", "Web of Science", "Scopus"];

export function mesAtual(): string {
  return hojeIso().slice(0, 7);
}

/** Índice h: maior h tal que h publicações têm pelo menos h citações. */
export function indiceH(totais: number[]): number {
  const ord = [...totais].sort((a, b) => b - a);
  let h = 0;
  while (h < ord.length && ord[h] >= h + 1) h++;
  return h;
}

export function indiceI10(totais: number[]): number {
  return totais.filter((t) => t >= 10).length;
}

/** Último total conhecido de uma publicação numa fonte (antes do mês informado, se pedido). */
function ultimoTotal(publicacaoId: number, fonte: string, antesDe?: string): number | null {
  const r = um<{ total: number }>(
    `SELECT total FROM citacao_mensal WHERE publicacao_id = ? AND fonte = ? ${antesDe ? "AND mes < ?" : ""} ORDER BY mes DESC LIMIT 1`,
    publicacaoId,
    fonte,
    ...(antesDe ? [antesDe] : []),
  );
  return r ? r.total : null;
}

/** Grava a foto do mês. Se a publicação ganhou citações desde a última foto, cria um aviso. */
export function registrarCitacoes(donoId: number, publicacaoId: number, fonte: string, total: number, mes = mesAtual()): boolean {
  const anterior = ultimoTotal(publicacaoId, fonte);
  executar(
    `INSERT INTO citacao_mensal (publicacao_id, fonte, mes, total) VALUES (?, ?, ?, ?)
     ON CONFLICT(publicacao_id, fonte, mes) DO UPDATE SET total = excluded.total, registrado_em = datetime('now')`,
    publicacaoId,
    fonte,
    mes,
    total,
  );
  if (anterior !== null && total > anterior) {
    const titulo = um<{ titulo: string }>("SELECT titulo FROM publicacao WHERE id = ?", publicacaoId)?.titulo ?? "";
    const ja = um(
      "SELECT 1 FROM lembrete WHERE dono_id = ? AND tipo = 'nova_citacao' AND publicacao_id = ? AND data_alvo = ? AND mensagem LIKE ?",
      donoId,
      publicacaoId,
      hojeIso(),
      `%${fonte}%`,
    );
    if (!ja)
      inserir("lembrete", {
        dono_id: donoId,
        publicacao_id: publicacaoId,
        tipo: "nova_citacao",
        data_alvo: hojeIso(),
        mensagem: `"${titulo}" recebeu ${total - anterior} citação(ões) nova(s) (${fonte}: agora ${total}).`,
      });
    return true;
  }
  return false;
}

/** Recalcula e grava a foto mensal dos indicadores do pesquisador para cada fonte. */
export function recalcularIndicadores(donoId: number, mes = mesAtual()) {
  for (const fonte of FONTES_CITACAO) {
    // último total de cada publicação nessa fonte, até o mês informado
    const totais = todos<{ total: number }>(
      `SELECT c.total FROM citacao_mensal c
         JOIN publicacao p ON p.id = c.publicacao_id
        WHERE p.dono_id = ? AND c.fonte = ? AND c.mes = (
          SELECT MAX(c2.mes) FROM citacao_mensal c2 WHERE c2.publicacao_id = c.publicacao_id AND c2.fonte = c.fonte AND c2.mes <= ?)`,
      donoId,
      fonte,
      mes,
    ).map((r) => r.total);
    if (!totais.length) continue;
    executar(
      `INSERT INTO indicador_mensal (dono_id, fonte, mes, total, h, i10, publicacoes) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(dono_id, fonte, mes) DO UPDATE SET total = excluded.total, h = excluded.h, i10 = excluded.i10,
         publicacoes = excluded.publicacoes, registrado_em = datetime('now')`,
      donoId,
      fonte,
      mes,
      totais.reduce((s, t) => s + t, 0),
      indiceH(totais),
      indiceI10(totais),
      totais.length,
    );
  }
}

export interface ResultadoCitacoes {
  publicacoes: number;
  encontradas: number;
  totalOpenAlex: number;
  totalCrossref: number;
  h: number;
  novas: number;
  avisos: string[];
}

/** Rotina mensal (ou botão "Atualizar citações agora"). */
export async function atualizarCitacoes(donoId: number, opcoes: { comCitantes?: boolean } = {}): Promise<ResultadoCitacoes> {
  const mes = mesAtual();
  const avisos = new Set<string>();
  const pubs = todos<{ id: number; titulo: string; doi: string | null; ano: number | null; openalex_id: string | null; chave: string }>(
    `SELECT p.id, p.titulo, p.doi, p.ano, p.openalex_id, t.chave FROM publicacao p JOIN tipo_publicacao t ON t.id = p.tipo_id
      WHERE p.dono_id = ? AND p.status IN ('Publicado', 'Apresentado')`,
    donoId,
  );
  let encontradas = 0;
  let novas = 0;
  let totalOA = 0;
  let totalCR = 0;

  // 1. OpenAlex: pelo DOI (em lote) e, sem DOI, pelo título
  const porDoi = new Map<string, ObraCitada>();
  const comDoi = pubs.filter((p) => p.doi).map((p) => p.doi!) as string[];
  try {
    for (const o of await obrasPorDoi(comDoi)) if (o.doi) porDoi.set(o.doi, o);
  } catch (e) {
    avisos.add((e as Error).message);
  }
  const achadas: { pub: (typeof pubs)[number]; obra: ObraCitada }[] = [];
  for (const p of pubs) {
    let obra = p.doi ? porDoi.get(p.doi) : undefined;
    if (!obra && !p.doi && ["artigo", "capitulo", "livro", "anais"].includes(p.chave)) {
      try {
        obra = (await obrasPorTitulo(p.titulo, p.ano)).find((o) => similaridade(o.titulo, p.titulo) >= 0.9 && (!p.ano || !o.ano || o.ano === p.ano));
      } catch (e) {
        avisos.add((e as Error).message);
      }
    }
    if (obra) achadas.push({ pub: p, obra });
  }
  transacao(() => {
    for (const { pub, obra } of achadas) {
      encontradas++;
      totalOA += obra.citacoes;
      executar("UPDATE publicacao SET openalex_id = ? WHERE id = ?", obra.id, pub.id);
      if (registrarCitacoes(donoId, pub.id, "OpenAlex", obra.citacoes, mes)) novas++;
      executar("DELETE FROM citacao_ano WHERE publicacao_id = ? AND fonte = 'OpenAlex'", pub.id);
      for (const a of obra.porAno)
        executar("INSERT INTO citacao_ano (publicacao_id, fonte, ano, total) VALUES (?, 'OpenAlex', ?, ?)", pub.id, a.ano, a.total);
    }
  });

  // 2. Crossref (só para quem tem DOI)
  for (const p of pubs.filter((x) => x.doi)) {
    try {
      const m = await crossrefPorDoi(p.doi!);
      if (m && typeof m.citacoes === "number") {
        totalCR += m.citacoes;
        if (registrarCitacoes(donoId, p.id, "Crossref", m.citacoes, mes)) novas++;
      }
    } catch (e) {
      avisos.add((e as Error).message);
    }
  }

  // 3. Quem citou (OpenAlex)
  if (opcoes.comCitantes !== false) {
    for (const { pub, obra } of achadas.filter((a) => a.obra.citacoes > 0)) {
      try {
        const lista = await quemCitou(obra.id);
        transacao(() => {
          for (const c of lista)
            executar(
              `INSERT INTO trabalho_citante (publicacao_id, fonte, id_externo, titulo, ano, data, doi, revista) VALUES (?, 'OpenAlex', ?, ?, ?, ?, ?, ?)
               ON CONFLICT(publicacao_id, fonte, id_externo) DO UPDATE SET titulo = excluded.titulo, ano = excluded.ano, data = excluded.data, doi = excluded.doi, revista = excluded.revista`,
              pub.id,
              c.id,
              c.titulo,
              c.ano,
              c.data,
              c.doi,
              c.revista,
            );
        });
      } catch (e) {
        avisos.add((e as Error).message);
      }
    }
  }

  recalcularIndicadores(donoId, mes);
  const h = um<{ h: number }>("SELECT h FROM indicador_mensal WHERE dono_id = ? AND fonte = 'OpenAlex' AND mes = ?", donoId, mes)?.h ?? 0;
  return { publicacoes: pubs.length, encontradas, totalOpenAlex: totalOA, totalCrossref: totalCR, h, novas, avisos: [...avisos].slice(0, 5) };
}

/** Lançamento manual (Google Acadêmico não tem consulta pública). */
export function lancarCitacoesManual(donoId: number, publicacaoId: number, total: number, fonte = "Google Acadêmico") {
  if (!FONTES_MANUAIS.includes(fonte)) throw new Error("Fonte inválida.");
  if (!um("SELECT 1 FROM publicacao WHERE id = ? AND dono_id = ?", publicacaoId, donoId)) throw new Error("Publicação não encontrada.");
  if (!Number.isInteger(total) || total < 0) throw new Error("Informe um número inteiro de citações (0 ou mais).");
  registrarCitacoes(donoId, publicacaoId, fonte, total);
  recalcularIndicadores(donoId);
}

// ---------- Leitura para as telas ----------

export function citacoesDaPublicacao(publicacaoId: number) {
  const atuais = FONTES_CITACAO.map((fonte) => {
    const r = um<{ total: number; mes: string }>(
      "SELECT total, mes FROM citacao_mensal WHERE publicacao_id = ? AND fonte = ? ORDER BY mes DESC LIMIT 1",
      publicacaoId,
      fonte,
    );
    return { fonte, total: r?.total ?? null, mes: r?.mes ?? null };
  });
  const historico = todos<{ fonte: string; mes: string; total: number }>(
    "SELECT fonte, mes, total FROM citacao_mensal WHERE publicacao_id = ? ORDER BY mes, fonte",
    publicacaoId,
  );
  const porAno = todos<{ ano: number; total: number }>(
    "SELECT ano, total FROM citacao_ano WHERE publicacao_id = ? AND fonte = 'OpenAlex' ORDER BY ano",
    publicacaoId,
  );
  const citantes = todos<{ titulo: string | null; ano: number | null; data: string | null; doi: string | null; revista: string | null; id_externo: string }>(
    "SELECT titulo, ano, data, doi, revista, id_externo FROM trabalho_citante WHERE publicacao_id = ? ORDER BY COALESCE(data, ano || '-12-31'), id",
    publicacaoId,
  );
  const primeira =
    citantes.find((c) => c.data || c.ano)?.data ??
    (citantes[0]?.ano ? String(citantes[0].ano) : null) ??
    (porAno.find((a) => a.total > 0)?.ano ? String(porAno.find((a) => a.total > 0)!.ano) : null);
  return { atuais, historico, porAno, citantes, primeira };
}

export function resumoCitacoes(donoId: number) {
  const atuais = FONTES_CITACAO.map((fonte) => ({
    fonte,
    ...(um<{ total: number; h: number; i10: number; publicacoes: number; mes: string }>(
      "SELECT total, h, i10, publicacoes, mes FROM indicador_mensal WHERE dono_id = ? AND fonte = ? ORDER BY mes DESC LIMIT 1",
      donoId,
      fonte,
    ) ?? null),
  }));
  const serie = todos<{ fonte: string; mes: string; total: number; h: number; i10: number }>(
    "SELECT fonte, mes, total, h, i10 FROM indicador_mensal WHERE dono_id = ? ORDER BY mes",
    donoId,
  );
  const porAno = todos<{ ano: number; total: number }>(
    `SELECT c.ano, SUM(c.total) AS total FROM citacao_ano c JOIN publicacao p ON p.id = c.publicacao_id
      WHERE p.dono_id = ? AND c.fonte = 'OpenAlex' GROUP BY c.ano ORDER BY c.ano`,
    donoId,
  );
  const ultimo = (fonte: string) =>
    `(SELECT total FROM citacao_mensal c WHERE c.publicacao_id = p.id AND c.fonte = '${fonte}' ORDER BY mes DESC LIMIT 1)`;
  const maisCitadas = todos<{ id: number; titulo: string; ano: number | null; doi: string | null; oa: number | null; cr: number | null; gs: number | null; wos: number | null; sc: number | null }>(
    `SELECT p.id, p.titulo, p.ano, p.doi, ${ultimo("OpenAlex")} AS oa, ${ultimo("Crossref")} AS cr, ${ultimo("Google Acadêmico")} AS gs,
            ${ultimo("Web of Science")} AS wos, ${ultimo("Scopus")} AS sc
       FROM publicacao p WHERE p.dono_id = ? AND p.status IN ('Publicado', 'Apresentado')
      ORDER BY COALESCE(oa, 0) DESC, COALESCE(cr, 0) DESC, COALESCE(gs, 0) DESC, p.ano DESC`,
    donoId,
  );
  const ultimaAtualizacao = um<{ em: string }>(
    "SELECT MAX(registrado_em) AS em FROM citacao_mensal c JOIN publicacao p ON p.id = c.publicacao_id WHERE p.dono_id = ? AND c.fonte IN ('OpenAlex', 'Crossref')",
    donoId,
  )?.em;
  return { atuais, serie, porAno, maisCitadas, ultimaAtualizacao: ultimaAtualizacao ?? null };
}

/** Totais atuais por publicação (para listas e relatórios). */
export function citacoesAtuais(donoId: number): Map<number, number> {
  const m = new Map<number, number>();
  for (const r of todos<{ publicacao_id: number; total: number }>(
    `SELECT c.publicacao_id, c.total FROM citacao_mensal c JOIN publicacao p ON p.id = c.publicacao_id
      WHERE p.dono_id = ? AND c.fonte = 'OpenAlex'
        AND c.mes = (SELECT MAX(mes) FROM citacao_mensal c2 WHERE c2.publicacao_id = c.publicacao_id AND c2.fonte = 'OpenAlex')`,
    donoId,
  ))
    m.set(r.publicacao_id, r.total);
  return m;
}
