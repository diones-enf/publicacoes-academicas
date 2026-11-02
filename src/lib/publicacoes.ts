// Publicações: cadastro, edição, deduplicação, mudança de status (com
// desfazer), ressubmissão, versões relacionadas e mescla de dados externos.
import { executar, inserir, todos, transacao, um } from "./db";
import { TIPO_TAXA_PUBLICACAO, TIPO_TAXA_SUBMISSAO, STATUS, secaoDoStatus } from "./constantes";
import { encontrarOuCriarCoautor, localizarAutorPrincipal, papelPadrao } from "./coautores";
import { prepararLancamento, type Lancamento } from "./custos";
import { encontrarOuCriarVeiculo, resumoMetricas, type DadosVeiculo } from "./veiculos";
import { hojeIso, normalizar, normalizarDoi, normalizarIsbn, normalizarIssn, numeroBr, similaridade } from "./texto";
import type { Metadados } from "./conectores/tipos";
import { tipoDoDono } from "./tipos";

export interface Contexto {
  donoId: number;
  usuarioId: number;
  principal: { nome: string; orcid: string | null; nomesCitacao: string[] };
}

export interface AutorEntrada {
  nome: string;
  orcid?: string | null;
  afiliacao?: string | null;
  eh_principal?: boolean;
  correspondente?: boolean;
}

export interface TaxaEntrada {
  valor: number | null;
  nao_sei: boolean;
  moeda?: string;
  data_pagamento?: string | null;
  data_vencimento?: string | null;
  competencia?: string | null;
  pagador?: string | null;
  parte_autor?: number | null;
}

/** Campos gravados diretamente na tabela publicacao. */
export const CAMPOS_TEXTO = [
  "titulo",
  "data_submissao",
  "data_aceite",
  "data_publicacao",
  "volume",
  "numero",
  "paginas",
  "idioma",
  "doi",
  "isbn",
  "issn",
  "link",
  "area_tematica",
  "palavras_chave",
  "resumo",
  "observacoes",
  "editora",
  "edicao",
  "cidade",
  "livro_titulo",
  "organizadores",
  "modalidade",
  "premiacao",
  "instituicao",
  "registro",
  "papel_autor",
  "id_submissao",
  "link_sistema",
  "prazo_resposta",
  "editor_responsavel",
] as const;
type CampoTexto = (typeof CAMPOS_TEXTO)[number];

export type DadosPublicacao = Partial<Record<CampoTexto, string | null>> & {
  titulo: string;
  tipo_id: number;
  subtipo_id?: number | null;
  status: string;
  ano?: number | null;
  rodada_revisao?: number | null;
  veiculo_id?: number | null;
  veiculo?: DadosVeiculo | null;
  evento?: { nome: string; edicao?: string | null; cidade?: string | null; data?: string | null; instituicao_promotora?: string | null } | null;
  autores?: AutorEntrada[];
  taxa_submissao?: TaxaEntrada;
  taxa_publicacao?: TaxaEntrada;
  origem?: Record<string, string>; // campo -> fonte (Crossref, OpenAlex...)
};

export class ErroValidacao extends Error {}

export interface Duplicata {
  publicacao_id: number;
  titulo: string;
  ano: number | null;
  motivo: "doi" | "isbn" | "titulo";
  similaridade: number;
}

export class ErroDuplicidade extends Error {
  constructor(public duplicatas: Duplicata[]) {
    super(
      duplicatas[0].motivo === "doi"
        ? "Já existe uma publicação com este DOI."
        : duplicatas[0].motivo === "isbn"
          ? "Já existe uma publicação com este ISBN e o mesmo título."
          : "Já existe uma publicação com título muito parecido (possível duplicata).",
    );
  }
}

function agora(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function vazio(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

// ---------- Deduplicação ----------

export function verificarDuplicidade(
  donoId: number,
  d: { doi?: string | null; isbn?: string | null; titulo?: string | null; ano?: number | null },
  ignorarId?: number,
): Duplicata[] {
  const out: Duplicata[] = [];
  const doi = normalizarDoi(d.doi);
  if (doi) {
    for (const p of todos<{ id: number; titulo: string; ano: number | null }>(
      "SELECT id, titulo, ano FROM publicacao WHERE dono_id = ? AND doi = ? AND id != ?",
      donoId,
      doi,
      ignorarId ?? 0,
    ))
      out.push({ publicacao_id: p.id, titulo: p.titulo, ano: p.ano, motivo: "doi", similaridade: 1 });
    if (out.length) return out;
  }
  const isbn = normalizarIsbn(d.isbn);
  const tituloN = normalizar(d.titulo);
  if (isbn && tituloN) {
    for (const p of todos<{ id: number; titulo: string; ano: number | null; titulo_normalizado: string }>(
      "SELECT id, titulo, ano, titulo_normalizado FROM publicacao WHERE dono_id = ? AND isbn = ? AND id != ?",
      donoId,
      isbn,
      ignorarId ?? 0,
    ))
      if (p.titulo_normalizado === tituloN)
        out.push({ publicacao_id: p.id, titulo: p.titulo, ano: p.ano, motivo: "isbn", similaridade: 1 });
    if (out.length) return out;
  }
  if (!tituloN) return out;
  // Título parecido (>= 90%) e mesmo ano. Itens com DOIs diferentes não são duplicatas.
  const candidatos = todos<{ id: number; titulo: string; ano: number | null; doi: string | null }>(
    "SELECT id, titulo, ano, doi FROM publicacao WHERE dono_id = ? AND id != ?",
    donoId,
    ignorarId ?? 0,
  );
  for (const p of candidatos) {
    if (doi && p.doi && p.doi !== doi) continue;
    if (d.ano && p.ano && d.ano !== p.ano) continue;
    const s = similaridade(p.titulo, d.titulo ?? "");
    if (s >= 0.9) out.push({ publicacao_id: p.id, titulo: p.titulo, ano: p.ano, motivo: "titulo", similaridade: s });
  }
  return out.sort((a, b) => b.similaridade - a.similaridade);
}

// ---------- Validação ----------

function validar(donoId: number, d: DadosPublicacao) {
  if (vazio(d.titulo)) throw new ErroValidacao("Informe o título.");
  if (!tipoDoDono(donoId, Number(d.tipo_id))) throw new ErroValidacao("Escolha o tipo de publicação.");
  if (!(STATUS as readonly string[]).includes(d.status)) throw new ErroValidacao("Status inválido.");
  if (d.doi && !normalizarDoi(d.doi)) throw new ErroValidacao("DOI em formato inválido (esperado 10.xxxx/...).");
  for (const [rotulo, t] of [
    ["taxa de submissão", d.taxa_submissao],
    ["taxa de publicação (APC)", d.taxa_publicacao],
  ] as const) {
    if (!t || (!t.nao_sei && numeroBr(t.valor) === null))
      throw new ErroValidacao(`Informe a ${rotulo} (use 0 se for gratuita) ou marque "Ainda não sei".`);
    if (!t.nao_sei && (numeroBr(t.valor) ?? 0) < 0) throw new ErroValidacao(`A ${rotulo} não pode ser negativa.`);
  }
}

// ---------- Gravação ----------

function textoBusca(id: number): string {
  const p = um<Record<string, string | null>>(
    `SELECT p.titulo, p.doi, p.isbn, p.observacoes, p.palavras_chave, p.livro_titulo, v.nome AS veiculo, e.nome AS evento
       FROM publicacao p LEFT JOIN veiculo v ON v.id = p.veiculo_id LEFT JOIN evento e ON e.id = p.evento_id WHERE p.id = ?`,
    id,
  );
  const autores = todos<{ nome_exibido: string }>("SELECT nome_exibido FROM autoria WHERE publicacao_id = ?", id)
    .map((a) => a.nome_exibido)
    .join(" ");
  if (!p) return "";
  return normalizar(
    [p.titulo, autores, p.veiculo, p.evento, p.doi, p.isbn, p.observacoes, p.palavras_chave, p.livro_titulo].join(" "),
  );
}

export function atualizarBusca(id: number) {
  executar("UPDATE publicacao SET busca = ? WHERE id = ?", textoBusca(id), id);
}

function valoresSimples(d: DadosPublicacao): Record<string, unknown> {
  const v: Record<string, unknown> = {};
  for (const c of CAMPOS_TEXTO) {
    if (c in d) v[c] = vazio(d[c]) ? null : String(d[c]).trim();
  }
  if ("doi" in d) v.doi = normalizarDoi(d.doi);
  if ("isbn" in d) v.isbn = normalizarIsbn(d.isbn);
  if ("issn" in d) v.issn = normalizarIssn(d.issn);
  v.titulo = d.titulo.trim();
  v.titulo_normalizado = normalizar(d.titulo);
  v.tipo_id = Number(d.tipo_id);
  v.subtipo_id = d.subtipo_id ? Number(d.subtipo_id) : null;
  if ("rodada_revisao" in d) v.rodada_revisao = d.rodada_revisao ? Number(d.rodada_revisao) : null;
  const ano = d.ano ? Number(d.ano) : d.data_publicacao ? Number(String(d.data_publicacao).slice(0, 4)) : null;
  v.ano = ano || null;
  return v;
}

function gravarAutores(ctx: Contexto, pubId: number, autores: AutorEntrada[], papelInformado: string | null | undefined) {
  executar("DELETE FROM autoria WHERE publicacao_id = ?", pubId);
  const lista = autores.filter((a) => !vazio(a.nome));
  let idxPrincipal = lista.findIndex((a) => a.eh_principal);
  if (idxPrincipal < 0) idxPrincipal = localizarAutorPrincipal(lista, ctx.principal);
  lista.forEach((a, i) => {
    const principal = i === idxPrincipal;
    inserir("autoria", {
      publicacao_id: pubId,
      ordem: i + 1,
      eh_principal: principal,
      coautor_id: principal ? null : encontrarOuCriarCoautor(ctx.donoId, a),
      nome_exibido: a.nome.trim(),
      correspondente: !!a.correspondente,
    });
  });
  const papel = papelInformado || (idxPrincipal >= 0 ? papelPadrao(idxPrincipal, lista.length) : null);
  executar("UPDATE publicacao SET papel_autor = ? WHERE id = ?", papel, pubId);
}

function gravarEvento(donoId: number, e: DadosPublicacao["evento"]): number | null {
  if (!e || vazio(e.nome)) return null;
  const existente = um<{ id: number }>(
    "SELECT id FROM evento WHERE dono_id = ? AND lower(nome) = lower(?) AND COALESCE(edicao,'') = COALESCE(?, '')",
    donoId,
    e.nome.trim(),
    e.edicao ?? null,
  );
  if (existente) {
    executar(
      "UPDATE evento SET cidade = COALESCE(?, cidade), data = COALESCE(?, data), instituicao_promotora = COALESCE(?, instituicao_promotora) WHERE id = ?",
      e.cidade || null,
      e.data || null,
      e.instituicao_promotora || null,
      existente.id,
    );
    return existente.id;
  }
  return inserir("evento", {
    dono_id: donoId,
    nome: e.nome.trim(),
    edicao: e.edicao || null,
    cidade: e.cidade || null,
    data: e.data || null,
    instituicao_promotora: e.instituicao_promotora || null,
  });
}

function gravarOrigem(pubId: number, origem: Record<string, string> | undefined, valores: Record<string, unknown>) {
  if (!origem) return;
  for (const [campo, fonte] of Object.entries(origem)) {
    if (!fonte || fonte === "Manual") continue;
    const valor = valores[campo];
    inserir("origem_campo", {
      publicacao_id: pubId,
      campo,
      valor: valor === undefined || valor === null ? null : String(valor),
      fonte,
    });
  }
}

type LinhaTaxa = Awaited<ReturnType<typeof prepararLancamento>>;

async function prepararTaxas(d: DadosPublicacao) {
  const out: { tipo: string; nao_sei: boolean; linha: LinhaTaxa | null }[] = [];
  for (const [tipo, t] of [
    [TIPO_TAXA_SUBMISSAO, d.taxa_submissao],
    [TIPO_TAXA_PUBLICACAO, d.taxa_publicacao],
  ] as const) {
    if (!t || t.nao_sei) {
      out.push({ tipo, nao_sei: true, linha: null });
      continue;
    }
    out.push({
      tipo,
      nao_sei: false,
      linha: await prepararLancamento({
        tipo,
        valor: numeroBr(t.valor) as number,
        moeda: t.moeda,
        data_pagamento: t.data_pagamento,
        data_vencimento: t.data_vencimento,
        // Sem competência informada: mês do pagamento; senão, o mês da submissão
        // (taxa de submissão) ou do aceite/publicação (APC).
        competencia:
          t.competencia ||
          (t.data_pagamento
            ? null
            : ((tipo === TIPO_TAXA_SUBMISSAO ? d.data_submissao : (d.data_aceite ?? d.data_publicacao)) ?? d.data_publicacao ?? d.data_submissao ?? null)?.slice(0, 7) ?? null),
        pagador: t.pagador,
        parte_autor: t.parte_autor,
      }),
    });
  }
  return out;
}

function gravarTaxas(donoId: number, pubId: number, taxas: Awaited<ReturnType<typeof prepararTaxas>>) {
  for (const t of taxas) {
    const existente = um<{ id: number }>(
      "SELECT id FROM lancamento_custo WHERE publicacao_id = ? AND tipo = ? ORDER BY id LIMIT 1",
      pubId,
      t.tipo,
    );
    const coluna = t.tipo === TIPO_TAXA_SUBMISSAO ? "taxa_submissao_nao_sei" : "taxa_publicacao_nao_sei";
    executar(`UPDATE publicacao SET ${coluna} = ? WHERE id = ?`, t.nao_sei, pubId);
    if (t.nao_sei || !t.linha) {
      if (existente) executar("DELETE FROM lancamento_custo WHERE id = ?", existente.id);
      continue;
    }
    const linha = { ...t.linha, publicacao_id: pubId };
    if (existente) {
      const campos = Object.keys(linha) as (keyof typeof linha)[];
      executar(
        `UPDATE lancamento_custo SET ${campos.map((c) => `${c} = ?`).join(", ")} WHERE id = ?`,
        ...campos.map((c) => linha[c]),
        existente.id,
      );
    } else {
      inserir("lancamento_custo", { dono_id: donoId, ...linha });
    }
  }
}

function dataDoStatus(status: string, d: Partial<DadosPublicacao>): string {
  if (status === "Submetido" || status === "Em avaliação") return d.data_submissao || hojeIso();
  if (status === "Aceito") return d.data_aceite || hojeIso();
  if (status === "Publicado" || status === "Apresentado") return d.data_publicacao || hojeIso();
  return hojeIso();
}

function garantirTentativa(pubId: number) {
  const p = um<{ veiculo_id: number | null; data_submissao: string | null; nome: string | null }>(
    "SELECT p.veiculo_id, p.data_submissao, v.nome FROM publicacao p LEFT JOIN veiculo v ON v.id = p.veiculo_id WHERE p.id = ?",
    pubId,
  );
  if (!p?.veiculo_id) return;
  const aberta = um<{ id: number; veiculo_id: number | null }>(
    "SELECT id, veiculo_id FROM tentativa_submissao WHERE publicacao_id = ? AND data_desfecho IS NULL ORDER BY id DESC LIMIT 1",
    pubId,
  );
  if (aberta?.veiculo_id === p.veiculo_id) return;
  if (!aberta)
    inserir("tentativa_submissao", {
      publicacao_id: pubId,
      veiculo_id: p.veiculo_id,
      nome_veiculo: p.nome,
      data_submissao: p.data_submissao,
    });
}

export async function criarPublicacao(
  ctx: Contexto,
  d: DadosPublicacao,
  opcoes: { ignorarDuplicidade?: boolean } = {},
): Promise<number> {
  validar(ctx.donoId, d);
  if (!opcoes.ignorarDuplicidade) {
    const dups = verificarDuplicidade(ctx.donoId, { doi: d.doi, isbn: d.isbn, titulo: d.titulo, ano: d.ano });
    if (dups.length) throw new ErroDuplicidade(dups);
  } else {
    // Mesmo DOI nunca é aceito duas vezes.
    const porDoi = verificarDuplicidade(ctx.donoId, { doi: d.doi }).filter((x) => x.motivo === "doi");
    if (porDoi.length) throw new ErroDuplicidade(porDoi);
  }
  const taxas = await prepararTaxas(d);
  return transacao(() => {
    const v = valoresSimples(d);
    const veiculoId = d.veiculo_id ? Number(d.veiculo_id) : d.veiculo?.nome ? encontrarOuCriarVeiculo(ctx.donoId, d.veiculo) : null;
    const eventoId = gravarEvento(ctx.donoId, d.evento);
    const dataStatus = dataDoStatus(d.status, d);
    const id = inserir("publicacao", {
      ...v,
      dono_id: ctx.donoId,
      status: d.status,
      veiculo_id: veiculoId,
      evento_id: eventoId,
      ultima_movimentacao: dataStatus,
    });
    if (d.autores?.length) gravarAutores(ctx, id, d.autores, d.papel_autor);
    gravarTaxas(ctx.donoId, id, taxas);
    inserir("historico_status", { publicacao_id: id, status: d.status, data: dataStatus, prazo_resposta: v.prazo_resposta ?? null });
    if (d.status !== "Em elaboração" && secaoDoStatus(d.status) === "submissoes") garantirTentativa(id);
    gravarOrigem(id, d.origem, { ...v, revista: d.veiculo?.nome, autores: d.autores?.map((a) => a.nome).join("; ") });
    inserir("historico_alteracao", {
      dono_id: ctx.donoId,
      tabela: "publicacao",
      registro_id: id,
      campo: "(criação)",
      valor_novo: v.titulo as string,
      origem: Object.values(d.origem ?? {})[0] ?? "manual",
      usuario_id: ctx.usuarioId,
    });
    atualizarBusca(id);
    return id;
  });
}

export async function atualizarPublicacao(ctx: Contexto, id: number, d: DadosPublicacao, opcoes: { ignorarDuplicidade?: boolean } = {}) {
  const atual = um<Record<string, unknown>>("SELECT * FROM publicacao WHERE id = ? AND dono_id = ?", id, ctx.donoId);
  if (!atual) throw new ErroValidacao("Publicação não encontrada.");
  validar(ctx.donoId, d);
  const dups = verificarDuplicidade(ctx.donoId, { doi: d.doi, isbn: d.isbn, titulo: d.titulo, ano: d.ano }, id);
  const bloqueantes = opcoes.ignorarDuplicidade ? dups.filter((x) => x.motivo === "doi") : dups;
  if (bloqueantes.length) throw new ErroDuplicidade(bloqueantes);
  const taxas = await prepararTaxas(d);
  transacao(() => {
    const v = valoresSimples(d);
    v.veiculo_id = d.veiculo_id ? Number(d.veiculo_id) : d.veiculo?.nome ? encontrarOuCriarVeiculo(ctx.donoId, d.veiculo) : null;
    if ("evento" in d) v.evento_id = gravarEvento(ctx.donoId, d.evento);
    for (const [campo, novo] of Object.entries(v)) {
      const antigo = atual[campo];
      if (String(antigo ?? "") !== String(novo ?? "") && campo !== "titulo_normalizado") {
        inserir("historico_alteracao", {
          dono_id: ctx.donoId,
          tabela: "publicacao",
          registro_id: id,
          campo,
          valor_antigo: antigo === null || antigo === undefined ? null : String(antigo),
          valor_novo: novo === null || novo === undefined ? null : String(novo),
          origem: d.origem?.[campo] ?? "manual",
          usuario_id: ctx.usuarioId,
        });
      }
    }
    const campos = Object.keys(v);
    executar(
      `UPDATE publicacao SET ${campos.map((c) => `${c} = ?`).join(", ")}, atualizado_em = ? WHERE id = ?`,
      ...campos.map((c) => v[c]),
      agora(),
      id,
    );
    if (d.autores) gravarAutores(ctx, id, d.autores, d.papel_autor);
    gravarTaxas(ctx.donoId, id, taxas);
    gravarOrigem(id, d.origem, v);
    atualizarBusca(id);
  });
  if (d.status !== atual.status) mudarStatus(ctx, id, d.status, {});
}

export function excluirPublicacao(ctx: Contexto, id: number) {
  const r = executar("DELETE FROM publicacao WHERE id = ? AND dono_id = ?", id, ctx.donoId);
  if (!r.alteradas) throw new ErroValidacao("Publicação não encontrada.");
  inserir("historico_alteracao", {
    dono_id: ctx.donoId,
    tabela: "publicacao",
    registro_id: id,
    campo: "(exclusão)",
    usuario_id: ctx.usuarioId,
  });
}

// ---------- Status ----------

const CAMPOS_FOTO = [
  "status",
  "data_submissao",
  "data_aceite",
  "data_publicacao",
  "ano",
  "doi",
  "rodada_revisao",
  "prazo_resposta",
  "selo_novo",
  "ultima_movimentacao",
  "veiculo_id",
] as const;

export interface OpcoesStatus {
  data?: string | null;
  rodada?: number | null;
  prazo_resposta?: string | null;
  observacao?: string | null;
  doi?: string | null;
  data_publicacao?: string | null;
}

/**
 * Muda o status, registra a data no histórico e guarda uma foto dos campos
 * alterados para poder desfazer. Ao virar Publicado/Apresentado o item sai
 * de Submissões e aparece em Publicados com o selo "novo".
 */
export function mudarStatus(ctx: Contexto, id: number, novo: string, o: OpcoesStatus) {
  if (!(STATUS as readonly string[]).includes(novo)) throw new ErroValidacao("Status inválido.");
  const p = um<Record<string, unknown>>(
    `SELECT ${CAMPOS_FOTO.join(", ")} FROM publicacao WHERE id = ? AND dono_id = ?`,
    id,
    ctx.donoId,
  );
  if (!p) throw new ErroValidacao("Publicação não encontrada.");
  const data = o.data || (novo === "Publicado" || novo === "Apresentado" ? o.data_publicacao : null) || hojeIso();
  const mud: Record<string, unknown> = { status: novo, ultima_movimentacao: data };
  if (novo === "Submetido" && !p.data_submissao) mud.data_submissao = data;
  if (novo === "Aceito" && !p.data_aceite) mud.data_aceite = data;
  if (novo === "Em revisão") {
    mud.rodada_revisao = o.rodada ?? (Number(p.rodada_revisao) || 0) + 1;
    if (o.prazo_resposta) mud.prazo_resposta = o.prazo_resposta;
  } else if (o.prazo_resposta !== undefined) {
    mud.prazo_resposta = o.prazo_resposta;
  }
  if (novo === "Publicado" || novo === "Apresentado") {
    const dp = o.data_publicacao || (p.data_publicacao as string | null) || data;
    mud.data_publicacao = dp;
    mud.ano = Number(dp.slice(0, 4));
    if (o.doi) {
      const doi = normalizarDoi(o.doi);
      if (!doi) throw new ErroValidacao("DOI em formato inválido.");
      const dup = verificarDuplicidade(ctx.donoId, { doi }, id);
      if (dup.length) throw new ErroDuplicidade(dup);
      mud.doi = doi;
    }
    mud.selo_novo = 1;
    mud.prazo_resposta = null;
  }
  const foto: Record<string, unknown> = {};
  for (const c of Object.keys(mud)) foto[c] = p[c];
  transacao(() => {
    const campos = Object.keys(mud);
    executar(
      `UPDATE publicacao SET ${campos.map((c) => `${c} = ?`).join(", ")}, atualizado_em = ? WHERE id = ?`,
      ...campos.map((c) => mud[c]),
      agora(),
      id,
    );
    inserir("historico_status", {
      publicacao_id: id,
      status: novo,
      status_anterior: p.status,
      data,
      rodada: (mud.rodada_revisao as number) ?? null,
      prazo_resposta: (mud.prazo_resposta as string) ?? null,
      veiculo_id: p.veiculo_id,
      observacao: o.observacao || null,
      desfazer_json: JSON.stringify(foto),
    });
    inserir("historico_alteracao", {
      dono_id: ctx.donoId,
      tabela: "publicacao",
      registro_id: id,
      campo: "status",
      valor_antigo: String(p.status),
      valor_novo: novo,
      usuario_id: ctx.usuarioId,
    });
    if (novo === "Submetido") garantirTentativa(id);
    if (novo === "Recusado" || novo === "Retirado" || novo === "Aceito") {
      executar(
        "UPDATE tentativa_submissao SET data_desfecho = ?, desfecho = ? WHERE publicacao_id = ? AND data_desfecho IS NULL",
        data,
        novo,
        id,
      );
    }
    if (o.doi) atualizarBusca(id);
  });
}

/** Desfaz a última mudança de status (ex.: tirar de Publicados e devolver a Submissões). */
export function desfazerUltimoStatus(ctx: Contexto, id: number): string {
  const ultima = um<{ id: number; status_anterior: string | null; desfazer_json: string | null; status: string }>(
    `SELECT h.id, h.status_anterior, h.desfazer_json, h.status FROM historico_status h
       JOIN publicacao p ON p.id = h.publicacao_id
      WHERE h.publicacao_id = ? AND p.dono_id = ? AND h.desfazer_json IS NOT NULL
      ORDER BY h.id DESC LIMIT 1`,
    id,
    ctx.donoId,
  );
  if (!ultima?.desfazer_json) throw new ErroValidacao("Não há mudança de status para desfazer.");
  const foto = JSON.parse(ultima.desfazer_json) as Record<string, unknown>;
  transacao(() => {
    const campos = Object.keys(foto);
    executar(
      `UPDATE publicacao SET ${campos.map((c) => `${c} = ?`).join(", ")}, atualizado_em = ? WHERE id = ?`,
      ...campos.map((c) => foto[c]),
      agora(),
      id,
    );
    executar("DELETE FROM historico_status WHERE id = ?", ultima.id);
    if (ultima.status === "Recusado" || ultima.status === "Retirado" || ultima.status === "Aceito")
      executar(
        "UPDATE tentativa_submissao SET data_desfecho = NULL, desfecho = NULL WHERE id = (SELECT MAX(id) FROM tentativa_submissao WHERE publicacao_id = ?)",
        id,
      );
    inserir("historico_alteracao", {
      dono_id: ctx.donoId,
      tabela: "publicacao",
      registro_id: id,
      campo: "status",
      valor_antigo: ultima.status,
      valor_novo: String(foto.status),
      origem: "desfazer",
      usuario_id: ctx.usuarioId,
    });
    atualizarBusca(id);
  });
  return String(foto.status);
}

/** Reenvia um item recusado (ou retirado) a outra revista, guardando a sequência de tentativas. */
export function ressubmeter(ctx: Contexto, id: number, d: { veiculo_id?: number | null; veiculo?: DadosVeiculo | null; data?: string | null }) {
  const p = um<{ status: string }>("SELECT status FROM publicacao WHERE id = ? AND dono_id = ?", id, ctx.donoId);
  if (!p) throw new ErroValidacao("Publicação não encontrada.");
  if (p.status !== "Recusado" && p.status !== "Retirado")
    throw new ErroValidacao("Só itens recusados ou retirados podem ser ressubmetidos.");
  const veiculoId = d.veiculo_id ?? (d.veiculo?.nome ? encontrarOuCriarVeiculo(ctx.donoId, d.veiculo) : null);
  if (!veiculoId) throw new ErroValidacao("Informe a nova revista.");
  const data = d.data || hojeIso();
  transacao(() => {
    executar(
      "UPDATE publicacao SET veiculo_id = ?, data_submissao = ?, data_aceite = NULL, rodada_revisao = NULL, prazo_resposta = NULL, id_submissao = NULL, link_sistema = NULL WHERE id = ?",
      veiculoId,
      data,
      id,
    );
    const nome = um<{ nome: string }>("SELECT nome FROM veiculo WHERE id = ?", veiculoId)?.nome ?? null;
    inserir("tentativa_submissao", { publicacao_id: id, veiculo_id: veiculoId, nome_veiculo: nome, data_submissao: data });
    mudarStatus(ctx, id, "Submetido", { data, observacao: `Ressubmetido para ${nome ?? "outra revista"}` });
  });
}

export function marcarComoVisto(ctx: Contexto, id: number) {
  executar("UPDATE publicacao SET selo_novo = 0 WHERE id = ? AND dono_id = ?", id, ctx.donoId);
}

// ---------- Versões relacionadas ----------

export function vincularVersoes(ctx: Contexto, a: number, b: number) {
  if (a === b) throw new ErroValidacao("Escolha duas publicações diferentes.");
  const n = um<{ n: number }>("SELECT COUNT(*) n FROM publicacao WHERE id IN (?, ?) AND dono_id = ?", a, b, ctx.donoId);
  if (n?.n !== 2) throw new ErroValidacao("Publicação não encontrada.");
  const [x, y] = a < b ? [a, b] : [b, a];
  executar("INSERT OR IGNORE INTO versao_relacionada (a_id, b_id) VALUES (?, ?)", x, y);
}

export function desvincularVersoes(ctx: Contexto, a: number, b: number) {
  const [x, y] = a < b ? [a, b] : [b, a];
  executar(
    "DELETE FROM versao_relacionada WHERE a_id = ? AND b_id = ? AND a_id IN (SELECT id FROM publicacao WHERE dono_id = ?)",
    x,
    y,
    ctx.donoId,
  );
}

// ---------- Mescla com dados externos (DOI, ORCID, OpenAlex...) ----------

const MAPA_EXTERNO: [keyof Metadados, CampoTexto | "ano"][] = [
  ["titulo", "titulo"],
  ["doi", "doi"],
  ["data_publicacao", "data_publicacao"],
  ["data_aceite", "data_aceite"],
  ["volume", "volume"],
  ["numero", "numero"],
  ["paginas", "paginas"],
  ["idioma", "idioma"],
  ["resumo", "resumo"],
  ["link", "link"],
  ["isbn", "isbn"],
  ["issn", "issn"],
  ["editora", "editora"],
  ["livro_titulo", "livro_titulo"],
  ["ano", "ano"],
];

/**
 * Completa uma publicação existente com dados de uma fonte externa. Só
 * preenche campos vazios: nunca sobrescreve o que foi digitado à mão.
 * Quando a fonte discorda de um valor já gravado, a versão dela fica
 * guardada em origem_campo para aparecer lado a lado na tela.
 */
export function mesclarDadosExternos(ctx: Contexto, id: number, m: Metadados): { preenchidos: string[]; divergentes: string[] } {
  const p = um<Record<string, unknown>>("SELECT * FROM publicacao WHERE id = ? AND dono_id = ?", id, ctx.donoId);
  if (!p) throw new ErroValidacao("Publicação não encontrada.");
  const preenchidos: string[] = [];
  const divergentes: string[] = [];
  const mud: Record<string, unknown> = {};
  for (const [origem, campo] of MAPA_EXTERNO) {
    let valor = m[origem] as unknown;
    if (vazio(valor)) continue;
    if (campo === "doi") valor = normalizarDoi(String(valor));
    if (campo === "issn") valor = normalizarIssn(String(valor));
    if (campo === "isbn") valor = normalizarIsbn(String(valor));
    if (vazio(valor)) continue;
    const atual = p[campo];
    if (vazio(atual)) {
      mud[campo] = valor;
      preenchidos.push(campo);
    } else if (campo !== "titulo" ? String(atual) !== String(valor) : normalizar(String(atual)) !== normalizar(String(valor))) {
      divergentes.push(campo);
    }
    inserir("origem_campo", { publicacao_id: id, campo, valor: String(valor), fonte: m.fonte });
  }
  transacao(() => {
    if (!p.veiculo_id && (m.revista || m.issn)) {
      mud.veiculo_id = encontrarOuCriarVeiculo(ctx.donoId, {
        nome: m.revista ?? m.issn ?? "",
        issn: m.issn,
        eissn: m.eissn,
        editora: m.editora,
      });
      preenchidos.push("revista");
    }
    const campos = Object.keys(mud);
    if (campos.length) {
      executar(
        `UPDATE publicacao SET ${campos.map((c) => `${c} = ?`).join(", ")}, atualizado_em = ? WHERE id = ?`,
        ...campos.map((c) => mud[c]),
        agora(),
        id,
      );
      for (const c of campos)
        inserir("historico_alteracao", {
          dono_id: ctx.donoId,
          tabela: "publicacao",
          registro_id: id,
          campo: c,
          valor_novo: String(mud[c]),
          origem: m.fonte,
          usuario_id: ctx.usuarioId,
        });
    }
    const temAutores = um<{ n: number }>("SELECT COUNT(*) n FROM autoria WHERE publicacao_id = ?", id)?.n ?? 0;
    if (!temAutores && m.autores?.length) {
      gravarAutores(ctx, id, m.autores, (p.papel_autor as string | null) ?? null);
      preenchidos.push("autores");
    }
    atualizarBusca(id);
  });
  return { preenchidos, divergentes };
}

// ---------- Leitura ----------

export interface LinhaPublicacao {
  id: number;
  titulo: string;
  tipo_id: number;
  subtipo_id: number | null;
  status: string;
  data_submissao: string | null;
  data_aceite: string | null;
  data_publicacao: string | null;
  ano: number | null;
  volume: string | null;
  numero: string | null;
  paginas: string | null;
  idioma: string | null;
  doi: string | null;
  isbn: string | null;
  issn: string | null;
  link: string | null;
  area_tematica: string | null;
  palavras_chave: string | null;
  resumo: string | null;
  observacoes: string | null;
  veiculo_id: number | null;
  evento_id: number | null;
  editora: string | null;
  edicao: string | null;
  cidade: string | null;
  livro_titulo: string | null;
  organizadores: string | null;
  modalidade: string | null;
  premiacao: string | null;
  instituicao: string | null;
  registro: string | null;
  papel_autor: string | null;
  id_submissao: string | null;
  link_sistema: string | null;
  rodada_revisao: number | null;
  prazo_resposta: string | null;
  editor_responsavel: string | null;
  taxa_submissao_nao_sei: number;
  taxa_publicacao_nao_sei: number;
  selo_novo: number;
  ultima_movimentacao: string | null;
  criado_em: string;
  atualizado_em: string;
  tipo_nome: string;
  tipo_chave: string;
  subtipo_nome: string | null;
  veiculo_nome: string | null;
  veiculo_issn: string | null;
  veiculo_eissn: string | null;
  veiculo_editora: string | null;
  veiculo_tipo: string | null;
  evento_nome: string | null;
  evento_edicao: string | null;
  evento_cidade: string | null;
  evento_data: string | null;
  evento_instituicao: string | null;
}

export function obterPublicacao(donoId: number, id: number, areaQualisRef: string | null = null) {
  const p = um<LinhaPublicacao>(
    `SELECT p.*, t.nome AS tipo_nome, t.chave AS tipo_chave, s.nome AS subtipo_nome,
            v.nome AS veiculo_nome, v.issn AS veiculo_issn, v.eissn AS veiculo_eissn, v.editora AS veiculo_editora, v.tipo AS veiculo_tipo,
            e.nome AS evento_nome, e.edicao AS evento_edicao, e.cidade AS evento_cidade, e.data AS evento_data,
            e.instituicao_promotora AS evento_instituicao
       FROM publicacao p
       JOIN tipo_publicacao t ON t.id = p.tipo_id
       LEFT JOIN subtipo_publicacao s ON s.id = p.subtipo_id
       LEFT JOIN veiculo v ON v.id = p.veiculo_id
       LEFT JOIN evento e ON e.id = p.evento_id
      WHERE p.id = ? AND p.dono_id = ?`,
    id,
    donoId,
  );
  if (!p) return null;
  const autores = todos<{ ordem: number; nome_exibido: string; eh_principal: number; coautor_id: number | null; correspondente: number; orcid: string | null; instituicao: string | null }>(
    `SELECT a.ordem, a.nome_exibido, a.eh_principal, a.coautor_id, a.correspondente, c.orcid, c.instituicao
       FROM autoria a LEFT JOIN coautor c ON c.id = a.coautor_id WHERE a.publicacao_id = ? ORDER BY a.ordem`,
    id,
  );
  const lancamentos = todos<Lancamento>("SELECT * FROM lancamento_custo WHERE publicacao_id = ? ORDER BY competencia, id", id);
  const historico = todos<{ id: number; status: string; status_anterior: string | null; data: string; rodada: number | null; prazo_resposta: string | null; observacao: string | null }>(
    "SELECT id, status, status_anterior, data, rodada, prazo_resposta, observacao FROM historico_status WHERE publicacao_id = ? ORDER BY data, id",
    id,
  );
  const tentativas = todos<{ id: number; nome_veiculo: string | null; data_submissao: string | null; data_desfecho: string | null; desfecho: string | null }>(
    "SELECT id, nome_veiculo, data_submissao, data_desfecho, desfecho FROM tentativa_submissao WHERE publicacao_id = ? ORDER BY id",
    id,
  );
  const versoes = todos<{ id: number; titulo: string; tipo: string; ano: number | null }>(
    `SELECT p.id, p.titulo, t.nome AS tipo, p.ano FROM versao_relacionada r
       JOIN publicacao p ON p.id = CASE WHEN r.a_id = ? THEN r.b_id ELSE r.a_id END
       JOIN tipo_publicacao t ON t.id = p.tipo_id
      WHERE r.a_id = ? OR r.b_id = ?`,
    id,
    id,
    id,
  );
  const origens = todos<{ campo: string; valor: string | null; fonte: string; em: string }>(
    "SELECT campo, valor, fonte, em FROM origem_campo WHERE publicacao_id = ? ORDER BY id",
    id,
  );
  const alteracoes = todos<{ campo: string; valor_antigo: string | null; valor_novo: string | null; origem: string; em: string }>(
    "SELECT campo, valor_antigo, valor_novo, origem, em FROM historico_alteracao WHERE tabela = 'publicacao' AND registro_id = ? ORDER BY id DESC LIMIT 100",
    id,
  );
  const metricas = p.veiculo_id ? (resumoMetricas([p.veiculo_id], areaQualisRef).get(p.veiculo_id) ?? null) : null;
  return { ...p, autores, lancamentos, historico, tentativas, versoes, origens, alteracoes, metricas, secao: secaoDoStatus(p.status) };
}

/** Lista resumida usada para marcar resultados de busca já cadastrados. */
export function indiceCadastrados(donoId: number) {
  return todos<{ id: number; doi: string | null; titulo: string; ano: number | null }>(
    "SELECT id, doi, titulo, ano FROM publicacao WHERE dono_id = ?",
    donoId,
  );
}

// ---------- Possíveis duplicatas ----------

export function descartarDuplicata(ctx: Contexto, a: number, b: number) {
  const n = um<{ n: number }>("SELECT COUNT(*) n FROM publicacao WHERE id IN (?, ?) AND dono_id = ?", a, b, ctx.donoId);
  if (n?.n !== 2) throw new ErroValidacao("Publicação não encontrada.");
  const [x, y] = a < b ? [a, b] : [b, a];
  executar("INSERT OR IGNORE INTO duplicata_descartada (a_id, b_id) VALUES (?, ?)", x, y);
}

/**
 * Mescla duas publicações: a primeira fica, recebe os campos que estavam
 * vazios nela, os custos, o histórico e os vínculos da segunda, que é apagada.
 */
export function mesclarPublicacoes(ctx: Contexto, manterId: number, removerId: number): number {
  if (manterId === removerId) throw new ErroValidacao("Escolha duas publicações diferentes.");
  const a = um<Record<string, unknown>>("SELECT * FROM publicacao WHERE id = ? AND dono_id = ?", manterId, ctx.donoId);
  const b = um<Record<string, unknown>>("SELECT * FROM publicacao WHERE id = ? AND dono_id = ?", removerId, ctx.donoId);
  if (!a || !b) throw new ErroValidacao("Publicação não encontrada.");
  transacao(() => {
    const mud: Record<string, unknown> = {};
    for (const c of [...CAMPOS_TEXTO, "ano", "subtipo_id", "veiculo_id", "evento_id", "rodada_revisao"] as string[]) {
      if (vazio(a[c]) && !vazio(b[c])) mud[c] = b[c];
    }
    // o DOI da que sai é liberado antes de ser copiado
    executar("UPDATE publicacao SET doi = NULL WHERE id = ?", removerId);
    const campos = Object.keys(mud);
    if (campos.length)
      executar(
        `UPDATE publicacao SET ${campos.map((c) => `${c} = ?`).join(", ")}, atualizado_em = ? WHERE id = ?`,
        ...campos.map((c) => mud[c]),
        agora(),
        manterId,
      );
    const autoresA = um<{ n: number }>("SELECT COUNT(*) n FROM autoria WHERE publicacao_id = ?", manterId)?.n ?? 0;
    if (!autoresA) executar("UPDATE autoria SET publicacao_id = ? WHERE publicacao_id = ?", manterId, removerId);
    for (const t of ["lancamento_custo", "origem_campo", "tentativa_submissao", "lembrete"])
      executar(`UPDATE ${t} SET publicacao_id = ? WHERE publicacao_id = ?`, manterId, removerId);
    executar(
      "UPDATE historico_status SET publicacao_id = ?, desfazer_json = NULL WHERE publicacao_id = ?",
      manterId,
      removerId,
    );
    for (const r of todos<{ a_id: number; b_id: number }>(
      "SELECT a_id, b_id FROM versao_relacionada WHERE a_id = ? OR b_id = ?",
      removerId,
      removerId,
    )) {
      const outro = r.a_id === removerId ? r.b_id : r.a_id;
      if (outro !== manterId) {
        const [x, y] = outro < manterId ? [outro, manterId] : [manterId, outro];
        executar("INSERT OR IGNORE INTO versao_relacionada (a_id, b_id) VALUES (?, ?)", x, y);
      }
    }
    executar("DELETE FROM publicacao WHERE id = ?", removerId);
    inserir("historico_alteracao", {
      dono_id: ctx.donoId,
      tabela: "publicacao",
      registro_id: manterId,
      campo: "(mesclagem)",
      valor_antigo: String(b.titulo),
      valor_novo: `mesclada com a publicação ${removerId}`,
      usuario_id: ctx.usuarioId,
    });
    atualizarBusca(manterId);
  });
  return manterId;
}
