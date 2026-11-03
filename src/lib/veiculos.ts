// Veículos (revistas, editoras, eventos, jornais), suas métricas e indexações.
// As métricas pertencem ao veículo: atualizar o JIF de uma revista atualiza
// automaticamente todos os artigos publicados nela.
import { executar, inserir, todos, um } from "./db";
import { hojeIso, issnValido, normalizar, normalizarIssn } from "./texto";

export interface Veiculo {
  id: number;
  nome: string;
  tipo: string;
  issn: string | null;
  eissn: string | null;
  editora: string | null;
  pais: string | null;
  site: string | null;
}

export interface Metrica {
  id: number;
  veiculo_id: number;
  indicador: string;
  valor: string;
  area: string | null;
  periodo: string | null;
  selo: string;
  fonte: string | null;
  conferido_em: string | null;
}

export interface Indexacao {
  id: number;
  veiculo_id: number;
  base: string;
  situacao: string;
  selo: string;
  fonte: string | null;
  conferido_em: string | null;
}

export interface DadosVeiculo {
  nome: string;
  tipo?: string;
  issn?: string | null;
  eissn?: string | null;
  editora?: string | null;
  pais?: string | null;
  site?: string | null;
}

export function veiculoDoDono(donoId: number, id: number): Veiculo | undefined {
  return um<Veiculo>("SELECT * FROM veiculo WHERE id = ? AND dono_id = ?", id, donoId);
}

/** Procura pelo ISSN/e-ISSN (em qualquer das duas colunas) e, sem ISSN, pelo nome. */
export function encontrarVeiculo(donoId: number, d: DadosVeiculo): Veiculo | undefined {
  const issns = [normalizarIssn(d.issn), normalizarIssn(d.eissn)].filter(Boolean) as string[];
  for (const i of issns) {
    const v = um<Veiculo>(
      "SELECT * FROM veiculo WHERE dono_id = ? AND (issn = ? OR eissn = ?) ORDER BY id LIMIT 1",
      donoId,
      i,
      i,
    );
    if (v) return v;
  }
  const nome = normalizar(d.nome);
  if (!nome) return undefined;
  const porNome = todos<Veiculo>(
    "SELECT * FROM veiculo WHERE dono_id = ? AND nome_normalizado = ? AND tipo = ?",
    donoId,
    nome,
    d.tipo ?? "revista",
  );
  // Nome igual mas ISSN diferente: não junta (é caso de revisão manual).
  return porNome.find((v) => !issns.length || (!v.issn && !v.eissn));
}

export function salvarVeiculo(donoId: number, d: DadosVeiculo, id?: number): number {
  if (!d.nome?.trim()) throw new Error("Informe o nome do veículo.");
  const dados = {
    nome: d.nome.trim(),
    nome_normalizado: normalizar(d.nome),
    tipo: d.tipo || "revista",
    issn: normalizarIssn(d.issn),
    eissn: normalizarIssn(d.eissn),
    editora: d.editora?.trim() || null,
    pais: d.pais?.trim() || null,
    site: d.site?.trim() || null,
  };
  if (id) {
    if (!veiculoDoDono(donoId, id)) throw new Error("Veículo não encontrado.");
    const campos = Object.keys(dados) as (keyof typeof dados)[];
    executar(
      `UPDATE veiculo SET ${campos.map((c) => `${c} = ?`).join(", ")} WHERE id = ? AND dono_id = ?`,
      ...campos.map((c) => dados[c]),
      id,
      donoId,
    );
    return id;
  }
  return inserir("veiculo", { dono_id: donoId, ...dados });
}

/** Usa o veículo existente (completando ISSN/editora vazios) ou cria um novo. */
export function encontrarOuCriarVeiculo(donoId: number, d: DadosVeiculo): number {
  const v = encontrarVeiculo(donoId, d);
  if (!v) return salvarVeiculo(donoId, d);
  const completar: Record<string, unknown> = {};
  if (!v.issn && normalizarIssn(d.issn) && normalizarIssn(d.issn) !== v.eissn) completar.issn = normalizarIssn(d.issn);
  if (!v.eissn && normalizarIssn(d.eissn) && normalizarIssn(d.eissn) !== v.issn) completar.eissn = normalizarIssn(d.eissn);
  if (!v.editora && d.editora) completar.editora = d.editora;
  const campos = Object.keys(completar);
  if (campos.length)
    executar(
      `UPDATE veiculo SET ${campos.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
      ...campos.map((c) => completar[c]),
      v.id,
    );
  return v.id;
}

export function listarVeiculos(donoId: number) {
  return todos<Veiculo & { publicacoes: number }>(
    `SELECT v.*, (SELECT COUNT(*) FROM publicacao p WHERE p.veiculo_id = v.id) AS publicacoes
       FROM veiculo v WHERE v.dono_id = ? ORDER BY v.nome`,
    donoId,
  );
}

export function excluirVeiculo(donoId: number, id: number) {
  executar("DELETE FROM veiculo WHERE id = ? AND dono_id = ?", id, donoId);
}

// ---------- Métricas ----------

export interface DadosMetrica {
  indicador: string;
  valor: string;
  area?: string | null;
  periodo?: string | null;
  selo?: string;
  fonte?: string | null;
  conferido_em?: string | null;
}

export function salvarMetrica(donoId: number, veiculoId: number, d: DadosMetrica, id?: number): number {
  if (!veiculoDoDono(donoId, veiculoId)) throw new Error("Veículo não encontrado.");
  if (!d.indicador || !String(d.valor ?? "").trim()) throw new Error("Informe o indicador e o valor.");
  const dados = {
    indicador: d.indicador,
    valor: String(d.valor).trim().replace(",", "."),
    area: d.area?.trim() || null,
    periodo: d.periodo?.trim() || null,
    selo: d.selo || "informado_usuario",
    fonte: d.fonte?.trim() || null,
    conferido_em: d.conferido_em || hojeIso(),
  };
  if (d.indicador === "QUALIS") dados.valor = dados.valor.toUpperCase();
  if (id) {
    const campos = Object.keys(dados) as (keyof typeof dados)[];
    executar(
      `UPDATE metrica_veiculo SET ${campos.map((c) => `${c} = ?`).join(", ")} WHERE id = ? AND veiculo_id = ?`,
      ...campos.map((c) => dados[c]),
      id,
      veiculoId,
    );
    return id;
  }
  // Mesmo indicador + área + período: atualiza em vez de duplicar.
  const existente = um<{ id: number }>(
    "SELECT id FROM metrica_veiculo WHERE veiculo_id = ? AND indicador = ? AND COALESCE(area,'') = ? AND COALESCE(periodo,'') = ?",
    veiculoId,
    dados.indicador,
    dados.area ?? "",
    dados.periodo ?? "",
  );
  if (existente) return salvarMetrica(donoId, veiculoId, d, existente.id);
  return inserir("metrica_veiculo", { veiculo_id: veiculoId, ...dados });
}

export function excluirMetrica(donoId: number, id: number) {
  executar(
    "DELETE FROM metrica_veiculo WHERE id = ? AND veiculo_id IN (SELECT id FROM veiculo WHERE dono_id = ?)",
    id,
    donoId,
  );
}

export function metricasDoVeiculo(veiculoId: number): Metrica[] {
  return todos<Metrica>(
    "SELECT * FROM metrica_veiculo WHERE veiculo_id = ? ORDER BY indicador, periodo DESC, area",
    veiculoId,
  );
}

export function salvarIndexacao(
  donoId: number,
  veiculoId: number,
  d: { base: string; situacao?: string; selo?: string; fonte?: string | null; conferido_em?: string | null },
  id?: number,
): number {
  if (!veiculoDoDono(donoId, veiculoId)) throw new Error("Veículo não encontrado.");
  if (!d.base?.trim()) throw new Error("Informe a base.");
  const dados = {
    base: d.base.trim(),
    situacao: d.situacao || "ativa",
    selo: d.selo || "informado_usuario",
    fonte: d.fonte?.trim() || null,
    conferido_em: d.conferido_em || hojeIso(),
  };
  if (id) {
    const campos = Object.keys(dados) as (keyof typeof dados)[];
    executar(
      `UPDATE indexacao_veiculo SET ${campos.map((c) => `${c} = ?`).join(", ")} WHERE id = ? AND veiculo_id = ?`,
      ...campos.map((c) => dados[c]),
      id,
      veiculoId,
    );
    return id;
  }
  const existente = um<{ id: number }>(
    "SELECT id FROM indexacao_veiculo WHERE veiculo_id = ? AND base = ?",
    veiculoId,
    dados.base,
  );
  if (existente) return salvarIndexacao(donoId, veiculoId, d, existente.id);
  return inserir("indexacao_veiculo", { veiculo_id: veiculoId, ...dados });
}

export function excluirIndexacao(donoId: number, id: number) {
  executar(
    "DELETE FROM indexacao_veiculo WHERE id = ? AND veiculo_id IN (SELECT id FROM veiculo WHERE dono_id = ?)",
    id,
    donoId,
  );
}

export function indexacoesDoVeiculo(veiculoId: number): Indexacao[] {
  return todos<Indexacao>("SELECT * FROM indexacao_veiculo WHERE veiculo_id = ? ORDER BY base", veiculoId);
}

// ---------- Resumo usado em listas, filtros e relatórios ----------

export interface ResumoMetricas {
  qualis: string | null;
  qualis_area: string | null;
  qualis_periodo: string | null;
  qualis_selo: string | null;
  jif: number | null;
  jif_periodo: string | null;
  quartil_jcr: string | null;
  sjr: number | null;
  citescore: number | null;
  quartil_scopus: string | null;
  impacto2a: number | null;
  apc_usd: number | null;
  colecao_wos: string | null;
  indexacoes: string[];
  tem_jcr: boolean;
  metrica_nao_confirmada: boolean;
  conferido_em: string | null; // conferência mais antiga
}

function maisRecente(lista: Metrica[], indicador: string, area?: string | null): Metrica | undefined {
  const l = lista.filter((m) => m.indicador === indicador);
  const daArea = area ? l.filter((m) => m.area === area) : [];
  const base = daArea.length ? daArea : l;
  return [...base].sort((a, b) => (b.periodo ?? "").localeCompare(a.periodo ?? ""))[0];
}

export function resumoMetricas(veiculoIds: number[], areaQualisRef: string | null): Map<number, ResumoMetricas> {
  const mapa = new Map<number, ResumoMetricas>();
  const ids = [...new Set(veiculoIds.filter(Boolean))];
  if (!ids.length) return mapa;
  const marcadores = ids.map(() => "?").join(",");
  const metricas = todos<Metrica>(`SELECT * FROM metrica_veiculo WHERE veiculo_id IN (${marcadores})`, ...ids);
  const indexacoes = todos<Indexacao>(`SELECT * FROM indexacao_veiculo WHERE veiculo_id IN (${marcadores})`, ...ids);
  for (const id of ids) {
    const ms = metricas.filter((m) => m.veiculo_id === id);
    const ix = indexacoes.filter((i) => i.veiculo_id === id);
    const q = maisRecente(ms, "QUALIS", areaQualisRef);
    const jif = maisRecente(ms, "JIF");
    const num = (m?: Metrica) => (m && !Number.isNaN(Number(m.valor)) ? Number(m.valor) : null);
    const datas = [...ms.map((m) => m.conferido_em), ...ix.map((i) => i.conferido_em)].filter(Boolean) as string[];
    mapa.set(id, {
      qualis: q?.valor ?? null,
      qualis_area: q?.area ?? null,
      qualis_periodo: q?.periodo ?? null,
      qualis_selo: q?.selo ?? null,
      jif: num(jif),
      jif_periodo: jif?.periodo ?? null,
      quartil_jcr: maisRecente(ms, "QUARTIL_JCR")?.valor ?? null,
      sjr: num(maisRecente(ms, "SJR")),
      citescore: num(maisRecente(ms, "CITESCORE")),
      quartil_scopus: maisRecente(ms, "QUARTIL_SCOPUS")?.valor ?? null,
      impacto2a: num(maisRecente(ms, "IMPACTO_2A_OPENALEX")),
      apc_usd: num(maisRecente(ms, "APC_USD")),
      colecao_wos: maisRecente(ms, "COLECAO_WOS")?.valor ?? null,
      indexacoes: ix.filter((i) => i.situacao === "ativa").map((i) => i.base),
      tem_jcr: !!jif,
      metrica_nao_confirmada: ms.some((m) => m.selo !== "confirmado_oficial") || ix.some((i) => i.selo !== "confirmado_oficial"),
      conferido_em: datas.sort()[0] ?? null,
    });
  }
  return mapa;
}

// ---------- Alertas ----------

export function alertasDoVeiculo(v: Veiculo, ms: Metrica[], ix: Indexacao[]): string[] {
  const a: string[] = [];
  if (v.issn && !issnValido(v.issn)) a.push(`ISSN impresso ${v.issn} inválido (dígito verificador não confere).`);
  if (v.eissn && !issnValido(v.eissn)) a.push(`e-ISSN ${v.eissn} inválido (dígito verificador não confere).`);
  for (const i of ix) if (i.situacao === "interrompida") a.push(`Indexação interrompida em ${i.base}.`);
  const umAnoAtras = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const velhas = [...ms, ...ix].filter((m) => !m.conferido_em || m.conferido_em < umAnoAtras);
  if (velhas.length) a.push(`${velhas.length} métrica(s)/indexação(ões) sem conferência há mais de 12 meses.`);
  const wos = ix.some((i) => i.base.startsWith("WoS"));
  if (wos && !ms.some((m) => m.indicador === "JIF"))
    a.push('Está na Web of Science, mas sem JIF cadastrado. "Estar no WoS" não significa "ter JCR".');
  if (ix.some((i) => i.base === "WoS ESCI"))
    a.push("Revista da coleção ESCI: só tem JIF a partir do JCR 2023 (dados de 2022).");
  return a;
}

// ---------- Resumo: revistas e publicações por área e estrato Qualis ----------

export interface LinhaQualisResumo {
  area: string;
  estrato: string;
  periodo: string | null;
  revistas: number;
  publicacoes: number;
  nomes: string;
}

export function resumoRevistasPorQualis(donoId: number, areaRef: string | null = null) {
  // Qualis mais recente de cada revista em cada área
  const linhas = todos<{ veiculo_id: number; nome: string; area: string; estrato: string; periodo: string | null; pubs: number }>(
    `SELECT v.id AS veiculo_id, v.nome, COALESCE(m.area, 'Área não informada') AS area, m.valor AS estrato, m.periodo,
            (SELECT COUNT(*) FROM publicacao p WHERE p.veiculo_id = v.id) AS pubs
       FROM veiculo v JOIN metrica_veiculo m ON m.veiculo_id = v.id AND m.indicador = 'QUALIS'
      WHERE v.dono_id = ? AND COALESCE(m.periodo, '') = (
        SELECT COALESCE(MAX(m2.periodo), '') FROM metrica_veiculo m2
         WHERE m2.veiculo_id = v.id AND m2.indicador = 'QUALIS' AND COALESCE(m2.area, '') = COALESCE(m.area, ''))`,
    donoId,
  );
  const ordem = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C"];
  const grupos = new Map<string, LinhaQualisResumo>();
  for (const l of linhas) {
    const k = `${l.area}|${l.estrato}`;
    const g = grupos.get(k) ?? { area: l.area, estrato: l.estrato, periodo: l.periodo, revistas: 0, publicacoes: 0, nomes: "" };
    g.revistas++;
    g.publicacoes += l.pubs;
    g.nomes = g.nomes ? `${g.nomes}; ${l.nome}` : l.nome;
    grupos.set(k, g);
  }
  const porArea = [...grupos.values()].sort(
    (a, b) => a.area.localeCompare(b.area, "pt-BR") || ordem.indexOf(a.estrato) - ordem.indexOf(b.estrato),
  );
  const totais = um<{ revistas: number; publicacoes: number; sem_qualis: number; pubs_sem_qualis: number }>(
    `SELECT COUNT(*) AS revistas,
            (SELECT COUNT(*) FROM publicacao p WHERE p.dono_id = ?1 AND p.veiculo_id IS NOT NULL) AS publicacoes,
            SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM metrica_veiculo m WHERE m.veiculo_id = v.id AND m.indicador = 'QUALIS') THEN 1 ELSE 0 END) AS sem_qualis,
            (SELECT COUNT(*) FROM publicacao p WHERE p.dono_id = ?1 AND p.veiculo_id IN (
               SELECT v2.id FROM veiculo v2 WHERE v2.dono_id = ?1 AND NOT EXISTS (SELECT 1 FROM metrica_veiculo m WHERE m.veiculo_id = v2.id AND m.indicador = 'QUALIS'))) AS pubs_sem_qualis
       FROM veiculo v WHERE v.dono_id = ?1`,
    donoId,
  ) ?? { revistas: 0, publicacoes: 0, sem_qualis: 0, pubs_sem_qualis: 0 };
  // Resumo por estrato: cada revista conta UMA vez, pelo Qualis da área de referência
  // (ou, se não tiver Qualis nessa área, pelo melhor estrato dela).
  const escolhido = new Map<number, { estrato: string; pubs: number }>();
  for (const l of linhas) {
    const atual = escolhido.get(l.veiculo_id);
    const daRef = !!areaRef && l.area === areaRef;
    const atualDaRef = !!areaRef && !!atual && linhas.some((x) => x.veiculo_id === l.veiculo_id && x.area === areaRef && x.estrato === atual.estrato);
    if (!atual || (daRef && !atualDaRef) || (!atualDaRef && !daRef && ordem.indexOf(l.estrato) < ordem.indexOf(atual.estrato)))
      escolhido.set(l.veiculo_id, { estrato: l.estrato, pubs: l.pubs });
  }
  const porEstrato = ordem
    .map((e) => {
      const da = [...escolhido.values()].filter((x) => x.estrato === e);
      return { estrato: e, revistas: da.length, publicacoes: da.reduce((s, x) => s + x.pubs, 0) };
    })
    .filter((x) => x.revistas > 0);
  return { porArea, porEstrato, totais };
}
