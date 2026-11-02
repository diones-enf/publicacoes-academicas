// Filtros combináveis. Os mesmos filtros valem para a lista e para os relatórios.
import { todos } from "./db";
import { secaoDoStatus, STATUS_ENCERRADOS, STATUS_PUBLICADOS, STATUS_SUBMISSOES, type Secao } from "./constantes";
import { resumoMetricas, type ResumoMetricas } from "./veiculos";
import { diasEntre, hojeIso, normalizar, similaridade } from "./texto";

export interface Filtros {
  secao?: Secao | "";
  q?: string;
  data_campo?: "submissao" | "aceite" | "publicacao";
  de?: string;
  ate?: string;
  ano?: string;
  quadrienio?: string; // "2021-2024"
  semestre?: string; // "2026-1"
  competencia?: string; // AAAA-MM
  veiculo_id?: string;
  editora?: string;
  evento?: string;
  pais?: string;
  qualis?: string[];
  qualis_area?: string;
  qualis_quadrienio?: string;
  indexacao?: string;
  com_jcr?: "sim" | "nao" | "";
  quartil_jcr?: string;
  quartil_scopus?: string;
  jif_min?: string;
  jif_max?: string;
  tipo_id?: string;
  subtipo_id?: string;
  status?: string;
  idioma?: string;
  area_tematica?: string;
  palavra_chave?: string;
  papel?: string;
  posicao?: string;
  coautor_id?: string;
  instituicao?: string;
  custo?: "gratuito" | "com_custo" | "";
  valor_min?: string;
  valor_max?: string;
  pagador?: string;
  situacao_custo?: "pago" | "pendente" | "";
  qualidade?: string;
}

export interface LinhaLista {
  id: number;
  titulo: string;
  tipo_id: number;
  tipo: string;
  tipo_chave: string;
  subtipo: string | null;
  status: string;
  secao: Secao;
  ano: number | null;
  data_submissao: string | null;
  data_aceite: string | null;
  data_publicacao: string | null;
  doi: string | null;
  isbn: string | null;
  issn: string | null;
  volume: string | null;
  numero: string | null;
  paginas: string | null;
  idioma: string | null;
  link: string | null;
  editora: string | null;
  cidade: string | null;
  livro_titulo: string | null;
  organizadores: string | null;
  modalidade: string | null;
  premiacao: string | null;
  edicao: string | null;
  veiculo_id: number | null;
  veiculo: string | null;
  veiculo_editora: string | null;
  veiculo_pais: string | null;
  evento: string | null;
  evento_cidade: string | null;
  evento_data: string | null;
  papel_autor: string | null;
  posicao: number | null;
  total_autores: number;
  autores: string;
  selo_novo: number;
  busca: string;
  ultima_movimentacao: string | null;
  prazo_resposta: string | null;
  rodada_revisao: number | null;
  taxa_submissao_nao_sei: number;
  taxa_publicacao_nao_sei: number;
  custo_total: number; // parte paga/prevista pelo autor (R$)
  custo_pago: number;
  custo_pendente: number;
  n_lancamentos: number;
  pagadores: string | null;
  metricas: ResumoMetricas | null;
  dias_parado: number | null;
}

function lista(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter(Boolean).map(String);
  if (typeof v === "string" && v) return v.split(",");
  return [];
}

/** Converte os parâmetros da URL (?status=...&qualis=A1,A2) em Filtros. */
export function filtrosDaUrl(sp: Record<string, string | string[] | undefined> | URLSearchParams): Filtros {
  const get = (k: string): string | undefined => {
    if (sp instanceof URLSearchParams) return sp.get(k) ?? undefined;
    const v = sp[k];
    return Array.isArray(v) ? v.join(",") : v;
  };
  const f: Record<string, unknown> = {};
  const chaves: (keyof Filtros)[] = [
    "secao", "q", "data_campo", "de", "ate", "ano", "quadrienio", "semestre", "competencia", "veiculo_id", "editora",
    "evento", "pais", "qualis_area", "qualis_quadrienio", "indexacao", "com_jcr", "quartil_jcr", "quartil_scopus",
    "jif_min", "jif_max", "tipo_id", "subtipo_id", "status", "idioma", "area_tematica", "palavra_chave", "papel",
    "posicao", "coautor_id", "instituicao", "custo", "valor_min", "valor_max", "pagador", "situacao_custo", "qualidade",
  ];
  for (const k of chaves) {
    const v = get(k);
    if (v) f[k] = v;
  }
  const q = get("qualis");
  if (q) f.qualis = lista(q);
  return f as Filtros;
}

export function filtrosParaUrl(f: Filtros): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (Array.isArray(v)) {
      if (v.length) p.set(k, v.join(","));
    } else if (v) p.set(k, String(v));
  }
  return p.toString();
}

export function contarFiltros(f: Filtros): number {
  return Object.entries(f).filter(([k, v]) => k !== "secao" && (Array.isArray(v) ? v.length : !!v)).length;
}

export function listarPublicacoes(donoId: number, f: Filtros, areaQualisRef: string | null): LinhaLista[] {
  const onde: string[] = ["p.dono_id = ?"];
  const ps: unknown[] = [donoId];
  const add = (sql: string, ...v: unknown[]) => {
    onde.push(sql);
    ps.push(...v);
  };
  if (f.secao) {
    const st = f.secao === "publicados" ? STATUS_PUBLICADOS : f.secao === "encerrados" ? STATUS_ENCERRADOS : STATUS_SUBMISSOES;
    add(`p.status IN (${st.map(() => "?").join(",")})`, ...st);
  }
  // A busca livre é aplicada depois, porque também procura no Qualis, área e indexações da revista.
  const col = f.data_campo === "submissao" ? "p.data_submissao" : f.data_campo === "aceite" ? "p.data_aceite" : "p.data_publicacao";
  if (f.de) add(`${col} >= ?`, f.de);
  if (f.ate) add(`${col} <= ?`, f.ate);
  if (f.ano) add(`substr(${col},1,4) = ?`, f.ano);
  if (f.quadrienio) {
    const [a, b] = f.quadrienio.split("-");
    add(`substr(${col},1,4) BETWEEN ? AND ?`, a, b);
  }
  if (f.semestre) {
    const [a, s] = f.semestre.split("-");
    add(`substr(${col},1,4) = ? AND CAST(substr(${col},6,2) AS INTEGER) ${s === "1" ? "<= 6" : "> 6"}`, a);
  }
  if (f.competencia) add("EXISTS (SELECT 1 FROM lancamento_custo l WHERE l.publicacao_id = p.id AND l.competencia = ?)", f.competencia);
  if (f.veiculo_id) add("p.veiculo_id = ?", Number(f.veiculo_id));
  if (f.editora) add("(lower(COALESCE(v.editora,'')) LIKE ? OR lower(COALESCE(p.editora,'')) LIKE ?)", `%${f.editora.toLowerCase()}%`, `%${f.editora.toLowerCase()}%`);
  if (f.evento) add("lower(COALESCE(e.nome,'')) LIKE ?", `%${f.evento.toLowerCase()}%`);
  if (f.pais) add("lower(COALESCE(v.pais,'')) LIKE ?", `%${f.pais.toLowerCase()}%`);
  if (f.tipo_id) add("p.tipo_id = ?", Number(f.tipo_id));
  if (f.subtipo_id) add("p.subtipo_id = ?", Number(f.subtipo_id));
  if (f.status) add("p.status = ?", f.status);
  if (f.idioma) add("p.idioma = ?", f.idioma);
  if (f.area_tematica) add("lower(COALESCE(p.area_tematica,'')) LIKE ?", `%${f.area_tematica.toLowerCase()}%`);
  if (f.palavra_chave) add("lower(COALESCE(p.palavras_chave,'')) LIKE ?", `%${f.palavra_chave.toLowerCase()}%`);
  if (f.papel) add("p.papel_autor = ?", f.papel);
  if (f.coautor_id) add("EXISTS (SELECT 1 FROM autoria a WHERE a.publicacao_id = p.id AND a.coautor_id = ?)", Number(f.coautor_id));
  if (f.instituicao)
    add(
      "EXISTS (SELECT 1 FROM autoria a JOIN coautor c ON c.id = a.coautor_id WHERE a.publicacao_id = p.id AND lower(COALESCE(c.instituicao,'')) LIKE ?)",
      `%${f.instituicao.toLowerCase()}%`,
    );
  if (f.pagador) add("EXISTS (SELECT 1 FROM lancamento_custo l WHERE l.publicacao_id = p.id AND l.pagador = ?)", f.pagador);
  if (f.situacao_custo === "pendente") add("EXISTS (SELECT 1 FROM lancamento_custo l WHERE l.publicacao_id = p.id AND l.data_pagamento IS NULL AND l.valor > 0)");
  if (f.situacao_custo === "pago") add("EXISTS (SELECT 1 FROM lancamento_custo l WHERE l.publicacao_id = p.id AND l.data_pagamento IS NOT NULL)");
  if (f.qualidade === "sem_doi") add("p.doi IS NULL");

  const linhas = todos<Omit<LinhaLista, "secao" | "metricas" | "dias_parado">>(
    `SELECT p.id, p.titulo, p.tipo_id, t.nome AS tipo, t.chave AS tipo_chave, s.nome AS subtipo, p.status, p.ano,
            p.data_submissao, p.data_aceite, p.data_publicacao, p.doi, p.isbn, p.issn, p.volume, p.numero, p.paginas,
            p.idioma, p.link, p.editora, p.cidade, p.livro_titulo, p.organizadores, p.modalidade, p.premiacao, p.edicao,
            p.veiculo_id, v.nome AS veiculo, v.editora AS veiculo_editora, v.pais AS veiculo_pais,
            e.nome AS evento, e.cidade AS evento_cidade, e.data AS evento_data,
            p.papel_autor, p.selo_novo, p.busca, p.ultima_movimentacao, p.prazo_resposta, p.rodada_revisao,
            p.taxa_submissao_nao_sei, p.taxa_publicacao_nao_sei,
            (SELECT ordem FROM autoria a WHERE a.publicacao_id = p.id AND a.eh_principal = 1) AS posicao,
            (SELECT COUNT(*) FROM autoria a WHERE a.publicacao_id = p.id) AS total_autores,
            COALESCE((SELECT GROUP_CONCAT(nome_exibido, '; ') FROM (SELECT nome_exibido FROM autoria a WHERE a.publicacao_id = p.id ORDER BY ordem)), '') AS autores,
            COALESCE((SELECT SUM(parte_autor_brl) FROM lancamento_custo l WHERE l.publicacao_id = p.id), 0) AS custo_total,
            COALESCE((SELECT SUM(parte_autor_brl) FROM lancamento_custo l WHERE l.publicacao_id = p.id AND l.data_pagamento IS NOT NULL), 0) AS custo_pago,
            COALESCE((SELECT SUM(parte_autor_brl) FROM lancamento_custo l WHERE l.publicacao_id = p.id AND l.data_pagamento IS NULL), 0) AS custo_pendente,
            (SELECT COUNT(*) FROM lancamento_custo l WHERE l.publicacao_id = p.id) AS n_lancamentos,
            (SELECT GROUP_CONCAT(DISTINCT pagador) FROM lancamento_custo l WHERE l.publicacao_id = p.id) AS pagadores
       FROM publicacao p
       JOIN tipo_publicacao t ON t.id = p.tipo_id
       LEFT JOIN subtipo_publicacao s ON s.id = p.subtipo_id
       LEFT JOIN veiculo v ON v.id = p.veiculo_id
       LEFT JOIN evento e ON e.id = p.evento_id
      WHERE ${onde.join(" AND ")}
      ORDER BY COALESCE(p.data_publicacao, p.data_aceite, p.data_submissao, p.criado_em) DESC, p.id DESC`,
    ...ps,
  );

  const area = f.qualis_area || areaQualisRef;
  const metricas = resumoMetricas(
    linhas.map((l) => l.veiculo_id).filter(Boolean) as number[],
    area || null,
  );
  const hoje = hojeIso();
  let out: LinhaLista[] = linhas.map((l) => ({
    ...l,
    secao: secaoDoStatus(l.status),
    metricas: l.veiculo_id ? (metricas.get(l.veiculo_id) ?? null) : null,
    dias_parado: l.ultima_movimentacao ? diasEntre(l.ultima_movimentacao, hoje) : null,
  }));

  if (f.q) {
    const termos = normalizar(f.q).split(" ").filter(Boolean);
    out = out.filter((l) => {
      const m = l.metricas;
      const extra = m ? normalizar(`${m.qualis ?? ""} qualis ${m.qualis_area ?? ""} ${m.quartil_jcr ?? ""} ${m.quartil_scopus ?? ""} ${m.indexacoes.join(" ")}`) : "";
      const alvo = ` ${l.busca} ${extra} `;
      return termos.every((t) => alvo.includes(t));
    });
  }

  // Filtros que dependem das métricas do veículo
  const q = f.qualis ?? [];
  if (q.length) out = out.filter((l) => l.metricas?.qualis && q.includes(l.metricas.qualis));
  if (f.qualis_area) out = out.filter((l) => l.metricas?.qualis_area === f.qualis_area);
  if (f.qualis_quadrienio) out = out.filter((l) => l.metricas?.qualis_periodo === f.qualis_quadrienio);
  if (f.indexacao) out = out.filter((l) => l.metricas?.indexacoes.includes(f.indexacao!));
  if (f.com_jcr === "sim") out = out.filter((l) => l.metricas?.tem_jcr);
  if (f.com_jcr === "nao") out = out.filter((l) => !l.metricas?.tem_jcr);
  if (f.quartil_jcr) out = out.filter((l) => l.metricas?.quartil_jcr === f.quartil_jcr);
  if (f.quartil_scopus) out = out.filter((l) => l.metricas?.quartil_scopus === f.quartil_scopus);
  if (f.jif_min) out = out.filter((l) => (l.metricas?.jif ?? -1) >= Number(f.jif_min));
  if (f.jif_max) out = out.filter((l) => l.metricas?.jif !== null && l.metricas?.jif !== undefined && l.metricas.jif <= Number(f.jif_max));
  if (f.posicao) out = out.filter((l) => l.posicao === Number(f.posicao));
  // Custos
  if (f.custo === "gratuito") out = out.filter((l) => l.n_lancamentos > 0 && l.custo_total === 0);
  if (f.custo === "com_custo") out = out.filter((l) => l.custo_total > 0);
  if (f.valor_min) out = out.filter((l) => l.custo_total >= Number(f.valor_min));
  if (f.valor_max) out = out.filter((l) => l.custo_total <= Number(f.valor_max));
  // Qualidade dos dados
  if (f.qualidade === "sem_qualis") out = out.filter((l) => l.tipo_chave === "artigo" && !l.metricas?.qualis);
  if (f.qualidade === "nao_confirmada") out = out.filter((l) => l.metricas?.metrica_nao_confirmada);
  if (f.qualidade === "conferido_12m") {
    const limite = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
    out = out.filter((l) => l.veiculo_id && (!l.metricas?.conferido_em || l.metricas.conferido_em < limite));
  }
  if (f.qualidade === "sem_autor_principal") out = out.filter((l) => !l.posicao);
  if (f.qualidade === "possivel_duplicata") {
    const ids = new Set(possiveisDuplicatas(donoId).flatMap((d) => [d.a.id, d.b.id]));
    out = out.filter((l) => ids.has(l.id));
  }
  return out;
}

/** Pares de publicações com título >= 90% parecido e mesmo ano (sem DOIs diferentes). */
export function possiveisDuplicatas(donoId: number) {
  const ps = todos<{ id: number; titulo: string; ano: number | null; doi: string | null }>(
    "SELECT id, titulo, ano, doi FROM publicacao WHERE dono_id = ?",
    donoId,
  );
  const ligados = new Set(
    todos<{ a_id: number; b_id: number }>(
      `SELECT a_id, b_id FROM versao_relacionada WHERE a_id IN (SELECT id FROM publicacao WHERE dono_id = ?1)
       UNION SELECT a_id, b_id FROM duplicata_descartada WHERE a_id IN (SELECT id FROM publicacao WHERE dono_id = ?1)`,
      donoId,
    ).map((r) => `${r.a_id}-${r.b_id}`),
  );
  const out: { a: (typeof ps)[number]; b: (typeof ps)[number]; similaridade: number }[] = [];
  for (let i = 0; i < ps.length; i++)
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i];
      const b = ps[j];
      if (ligados.has(`${Math.min(a.id, b.id)}-${Math.max(a.id, b.id)}`)) continue;
      if (a.doi && b.doi && a.doi !== b.doi) continue;
      if (a.ano && b.ano && a.ano !== b.ano) continue;
      const s = similaridade(a.titulo, b.titulo);
      if (s >= 0.9) out.push({ a, b, similaridade: s });
    }
  return out;
}

export function nomeSecao(s: Secao | "" | undefined): string {
  return s === "publicados" ? "Publicados" : s === "encerrados" ? "Encerrados" : s === "submissoes" ? "Submissões" : "Todas";
}
