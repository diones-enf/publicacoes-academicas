// Preenche sozinho as métricas e indexações de uma revista pelo ISSN:
// - Qualis e JCR: pelas planilhas oficiais já importadas (sem internet);
// - Scopus (SJR e quartil): pela lista pública do SCImago;
// - DOAJ, PubMed/MEDLINE e SciELO: pelas consultas públicas de cada base.
import { todos, um } from "./db";
import { salvarIndexacao, salvarMetrica, veiculoDoDono } from "./veiculos";
import { normalizarIssn } from "./texto";
import { carregarScimago } from "./conectores/scimago";
import { estaNoDoaj, estaNoMedline, estaNoScielo } from "./conectores/indexadores";
import { revistaOpenAlex } from "./conectores/openalexFonte";
import { executar, transacao } from "./db";
import { chaveRevista } from "./texto";

export interface ResultadoMetricas {
  encontrados: string[];
  avisos: string[];
}

function issnsDe(v: { issn: string | null; eissn: string | null }): string[] {
  return [...new Set([normalizarIssn(v.issn), normalizarIssn(v.eissn)].filter(Boolean) as string[])];
}

/** Só as listas importadas (Qualis e JCR). Não usa internet. */
export function aplicarListasOficiais(donoId: number, veiculoId: number): string[] {
  const v = veiculoDoDono(donoId, veiculoId);
  if (!v) return [];
  const issns = issnsDe(v);
  if (!issns.length) return [];
  const marc = issns.map(() => "?").join(",");
  const achados: string[] = [];

  const qualis = todos<{ area: string; estrato: string; periodo: string }>(
    `SELECT DISTINCT area, estrato, periodo FROM ref_qualis WHERE issn IN (${marc})`,
    ...issns,
  );
  for (const q of qualis) {
    salvarMetrica(donoId, veiculoId, { indicador: "QUALIS", valor: q.estrato, area: q.area, periodo: q.periodo, selo: "confirmado_oficial", fonte: "Qualis CAPES (planilha oficial)" });
  }
  if (qualis.length) achados.push(`Qualis (${qualis.length} área(s))`);
  else {
    // ISSN não bateu: procura pelo nome da revista (fica marcado para conferir o ISSN)
    prepararTitulosQualis();
    const porNome = todos<{ area: string; estrato: string; periodo: string }>(
      "SELECT DISTINCT area, estrato, periodo FROM ref_qualis WHERE titulo_normalizado = ?",
      chaveRevista(v.nome),
    );
    for (const q of porNome)
      salvarMetrica(donoId, veiculoId, {
        indicador: "QUALIS",
        valor: q.estrato,
        area: q.area,
        periodo: q.periodo,
        selo: "informado_usuario",
        fonte: "Qualis CAPES — encontrado pelo nome da revista (confira o ISSN)",
      });
    if (porNome.length) achados.push(`Qualis pelo nome (${porNome.length} área(s), confira o ISSN)`);
  }

  const jcr = um<{ ano: string; jif: string | null; jif5: string | null; jci: string | null; quartil: string | null; categoria: string | null; edicao: string | null }>(
    `SELECT * FROM ref_jcr WHERE issn IN (${marc}) ORDER BY ano DESC LIMIT 1`,
    ...issns,
  );
  if (jcr) {
    const base = { periodo: jcr.ano, selo: "confirmado_oficial", fonte: "JCR Clarivate (planilha oficial)", area: jcr.categoria };
    if (jcr.jif) salvarMetrica(donoId, veiculoId, { ...base, indicador: "JIF", valor: jcr.jif });
    if (jcr.jif5) salvarMetrica(donoId, veiculoId, { ...base, indicador: "JIF5", valor: jcr.jif5 });
    if (jcr.jci) salvarMetrica(donoId, veiculoId, { ...base, indicador: "JCI", valor: jcr.jci });
    if (jcr.quartil) salvarMetrica(donoId, veiculoId, { ...base, indicador: "QUARTIL_JCR", valor: jcr.quartil });
    if (jcr.edicao) {
      salvarMetrica(donoId, veiculoId, { ...base, area: null, indicador: "COLECAO_WOS", valor: jcr.edicao });
      const ed = jcr.edicao.toUpperCase();
      for (const col of ["SCIE", "SSCI", "AHCI", "ESCI"])
        if (ed.includes(col)) salvarIndexacao(donoId, veiculoId, { base: `WoS ${col}`, selo: "confirmado_oficial", fonte: "JCR Clarivate" });
    }
    achados.push(`JCR ${jcr.ano}`);
  }
  return achados;
}

/** Tudo: listas oficiais + consultas pela internet. */
export async function buscarMetricasAutomaticas(donoId: number, veiculoId: number): Promise<ResultadoMetricas> {
  const v = veiculoDoDono(donoId, veiculoId);
  if (!v) return { encontrados: [], avisos: ["Revista não encontrada."] };
  const issns = issnsDe(v);
  if (!issns.length) return { encontrados: [], avisos: ["A revista não tem ISSN cadastrado: informe o ISSN para buscar as métricas."] };
  const encontrados = aplicarListasOficiais(donoId, veiculoId);
  const avisos: string[] = [];

  // Scopus via SCImago
  try {
    const mapa = await carregarScimago();
    if (!mapa) avisos.push("Não foi possível baixar a lista do SCImago (Scopus).");
    else {
      const s = issns.map((i) => mapa.get(i)).find(Boolean);
      if (s) {
        const base = { periodo: s.ano, selo: "confirmado_oficial", fonte: "SCImago (base Scopus)" };
        if (s.sjr) salvarMetrica(donoId, veiculoId, { ...base, indicador: "SJR", valor: s.sjr });
        if (s.quartil) salvarMetrica(donoId, veiculoId, { ...base, indicador: "QUARTIL_SCOPUS", valor: s.quartil });
        salvarIndexacao(donoId, veiculoId, { base: "Scopus", selo: "confirmado_oficial", fonte: "SCImago" });
        encontrados.push(`Scopus (SJR ${s.ano})`);
      }
    }
  } catch (e) {
    avisos.push(`SCImago: ${(e as Error).message}`);
  }

  // OpenAlex: impacto médio de 2 anos, índice h e APC
  try {
    let oa = null;
    for (const i of issns) if (!oa) oa = await revistaOpenAlex(i);
    if (oa) {
      const base = { periodo: String(new Date().getFullYear()), selo: "confirmado_oficial", fonte: "OpenAlex" };
      if (oa.impacto2a !== null) salvarMetrica(donoId, veiculoId, { ...base, indicador: "IMPACTO_2A_OPENALEX", valor: String(oa.impacto2a) });
      if (oa.h !== null) salvarMetrica(donoId, veiculoId, { ...base, indicador: "H_OPENALEX", valor: String(oa.h) });
      if (oa.apcUsd !== null) salvarMetrica(donoId, veiculoId, { ...base, indicador: "APC_USD", valor: String(oa.apcUsd) });
      encontrados.push("OpenAlex (impacto 2 anos, índice h)");
    }
  } catch (e) {
    avisos.push((e as Error).message);
  }

  // Bases com consulta pública
  const consultas: [string, (i: string) => Promise<boolean>][] = [
    ["DOAJ", estaNoDoaj],
    ["PubMed/MEDLINE", estaNoMedline],
    ["SciELO", estaNoScielo],
  ];
  await Promise.all(
    consultas.map(async ([base, f]) => {
      try {
        for (const i of issns) {
          if (await f(i)) {
            salvarIndexacao(donoId, veiculoId, { base, selo: "confirmado_oficial", fonte: base });
            encontrados.push(base);
            return;
          }
        }
      } catch (e) {
        avisos.push((e as Error).message);
      }
    }),
  );
  return { encontrados, avisos };
}

/** Busca as métricas de todas as revistas do autor (uma de cada vez). */
export async function buscarMetricasDeTodas(donoId: number): Promise<{ revistas: number; comResultado: number; avisos: string[] }> {
  const lista = todos<{ id: number; nome: string }>(
    "SELECT id, nome FROM veiculo WHERE dono_id = ? AND (issn IS NOT NULL OR eissn IS NOT NULL)",
    donoId,
  );
  let comResultado = 0;
  const avisos = new Set<string>();
  for (const v of lista) {
    const r = await buscarMetricasAutomaticas(donoId, v.id);
    if (r.encontrados.length) comResultado++;
    r.avisos.forEach((a) => avisos.add(a));
  }
  return { revistas: lista.length, comResultado, avisos: [...avisos].slice(0, 5) };
}

/** Depois de importar uma lista, aplica a todas as revistas (rápido, sem internet). */
export function aplicarListasEmTodas(donoId: number): number {
  let n = 0;
  for (const v of todos<{ id: number }>("SELECT id FROM veiculo WHERE dono_id = ?", donoId))
    if (aplicarListasOficiais(donoId, v.id).length) n++;
  return n;
}

/** Preenche uma vez o título normalizado das listas importadas (para a busca pelo nome). */
function prepararTitulosQualis() {
  const faltando = todos<{ rowid: number; titulo: string | null }>(
    "SELECT rowid, titulo FROM ref_qualis WHERE titulo_normalizado IS NULL LIMIT 200000",
  );
  if (!faltando.length) return;
  transacao(() => {
    for (const r of faltando) executar("UPDATE ref_qualis SET titulo_normalizado = ? WHERE rowid = ?", chaveRevista(r.titulo), r.rowid);
  });
}
