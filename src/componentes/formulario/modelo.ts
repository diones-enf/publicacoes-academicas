// Modelo do formulário de publicação e conversões (dados da busca -> formulário -> API).
import type { Metadados } from "@/lib/conectores/tipos";
import { numeroBr } from "@/lib/texto";

export interface TipoOpcao {
  id: number;
  chave: string;
  nome: string;
  subtipos: { id: number; nome: string }[];
}

export interface VeiculoOpcao {
  id: number;
  nome: string;
  tipo: string;
  issn: string | null;
  eissn: string | null;
  editora: string | null;
  qualis: string | null; // ex.: "A2 — Enfermagem (2021-2024)"
}

export interface AutorForm {
  nome: string;
  orcid: string;
  correspondente: boolean;
}

export interface TaxaForm {
  valor: string;
  nao_sei: boolean;
  moeda: string;
  data_pagamento: string;
  data_vencimento: string;
  pagador: string;
  parte_autor: string;
}

export interface FormPub {
  titulo: string;
  tipo_id: string;
  subtipo_id: string;
  status: string;
  data_submissao: string;
  data_aceite: string;
  data_publicacao: string;
  ano: string;
  volume: string;
  numero: string;
  paginas: string;
  idioma: string;
  doi: string;
  isbn: string;
  link: string;
  area_tematica: string;
  palavras_chave: string;
  resumo: string;
  observacoes: string;
  veiculo_nome: string;
  veiculo_issn: string;
  veiculo_eissn: string;
  veiculo_editora: string;
  evento_nome: string;
  evento_edicao: string;
  evento_cidade: string;
  evento_data: string;
  evento_instituicao: string;
  editora: string;
  edicao: string;
  cidade: string;
  livro_titulo: string;
  organizadores: string;
  modalidade: string;
  premiacao: string;
  instituicao: string;
  registro: string;
  papel_autor: string;
  id_submissao: string;
  link_sistema: string;
  rodada_revisao: string;
  prazo_resposta: string;
  editor_responsavel: string;
  autores: AutorForm[];
  principal_idx: number; // -1 = reconhecer automaticamente
  taxa_submissao: TaxaForm;
  taxa_publicacao: TaxaForm;
  origem: Record<string, string>;
}

export const taxaVazia = (): TaxaForm => ({
  valor: "",
  nao_sei: false,
  moeda: "BRL",
  data_pagamento: "",
  data_vencimento: "",
  pagador: "Próprio",
  parte_autor: "",
});

export function formVazio(tipoId = ""): FormPub {
  return {
    titulo: "", tipo_id: tipoId, subtipo_id: "", status: "Em elaboração", data_submissao: "", data_aceite: "",
    data_publicacao: "", ano: "", volume: "", numero: "", paginas: "", idioma: "Português", doi: "", isbn: "", link: "",
    area_tematica: "", palavras_chave: "", resumo: "", observacoes: "", veiculo_nome: "", veiculo_issn: "", veiculo_eissn: "",
    veiculo_editora: "", evento_nome: "", evento_edicao: "", evento_cidade: "", evento_data: "", evento_instituicao: "",
    editora: "", edicao: "", cidade: "", livro_titulo: "", organizadores: "", modalidade: "", premiacao: "", instituicao: "",
    registro: "", papel_autor: "", id_submissao: "", link_sistema: "", rodada_revisao: "", prazo_resposta: "",
    editor_responsavel: "", autores: [], principal_idx: -1, taxa_submissao: taxaVazia(), taxa_publicacao: taxaVazia(), origem: {},
  };
}

/** Preenche o formulário com o resultado da busca (DOI/ISBN). */
export function formDeMetadados(
  m: Metadados,
  origem: Record<string, string>,
  tipos: TipoOpcao[],
  subtipoSugerido: string | null,
): FormPub {
  const tipo = tipos.find((t) => t.chave === (m.tipo_chave ?? "artigo")) ?? tipos[0];
  const sub = subtipoSugerido ? tipo?.subtipos.find((s) => s.nome === subtipoSugerido) : undefined;
  const f = formVazio(String(tipo?.id ?? ""));
  const o: Record<string, string> = {};
  const set = <K extends keyof FormPub>(k: K, v: FormPub[K] | null | undefined, campoOrigem?: string) => {
    if (v === null || v === undefined || v === "") return;
    f[k] = v;
    const fonte = origem[campoOrigem ?? (k as string)];
    if (fonte) o[k as string] = fonte;
  };
  set("titulo", m.titulo);
  set("doi", m.doi);
  set("data_publicacao", m.data_publicacao);
  set("data_aceite", m.data_aceite);
  set("ano", m.ano ? String(m.ano) : null);
  set("volume", m.volume);
  set("numero", m.numero);
  set("paginas", m.paginas);
  set("idioma", m.idioma);
  set("resumo", m.resumo);
  set("link", m.link);
  set("isbn", m.isbn);
  set("palavras_chave", m.palavras_chave?.join("; "));
  set("veiculo_nome", m.revista, "revista");
  set("veiculo_issn", m.issn, "issn");
  set("veiculo_eissn", m.eissn, "eissn");
  set("veiculo_editora", m.editora, "editora");
  set("editora", m.editora);
  set("livro_titulo", m.livro_titulo);
  if (m.autores?.length) {
    f.autores = m.autores.map((a) => ({ nome: a.nome, orcid: a.orcid ?? "", correspondente: false }));
    if (origem.autores) o.autores = origem.autores;
  }
  if (sub) f.subtipo_id = String(sub.id);
  f.status = m.data_publicacao || m.ano ? "Publicado" : "Em elaboração";
  f.origem = o;
  return f;
}

function n(v: string): number | null {
  return numeroBr(v);
}

function taxaParaApi(t: TaxaForm) {
  return {
    valor: t.nao_sei ? null : n(t.valor),
    nao_sei: t.nao_sei,
    moeda: t.moeda,
    data_pagamento: t.data_pagamento || null,
    data_vencimento: t.data_vencimento || null,
    pagador: t.pagador,
    parte_autor: n(t.parte_autor),
  };
}

/** Converte o formulário no corpo que a API espera. */
export function formParaApi(f: FormPub, chaveTipo: string, campos: string[]) {
  const usaVeiculo = campos.includes("veiculo") || ["artigo", "jornal"].includes(chaveTipo) || (chaveTipo === "livro" && !!f.veiculo_nome);
  const usaEvento = campos.includes("evento");
  return {
    titulo: f.titulo,
    tipo_id: Number(f.tipo_id),
    subtipo_id: f.subtipo_id ? Number(f.subtipo_id) : null,
    status: f.status,
    data_submissao: f.data_submissao || null,
    data_aceite: f.data_aceite || null,
    data_publicacao: f.data_publicacao || null,
    ano: f.ano ? Number(f.ano) : null,
    volume: f.volume,
    numero: f.numero,
    paginas: f.paginas,
    idioma: f.idioma,
    doi: f.doi,
    isbn: f.isbn,
    issn: f.veiculo_issn || null,
    link: f.link,
    area_tematica: f.area_tematica,
    palavras_chave: f.palavras_chave,
    resumo: f.resumo,
    observacoes: f.observacoes,
    veiculo: usaVeiculo && f.veiculo_nome
      ? { nome: f.veiculo_nome, issn: f.veiculo_issn, eissn: f.veiculo_eissn, editora: f.veiculo_editora, tipo: chaveTipo === "jornal" ? "jornal" : "revista" }
      : null,
    evento: usaEvento && f.evento_nome
      ? { nome: f.evento_nome, edicao: f.evento_edicao, cidade: f.evento_cidade, data: f.evento_data || null, instituicao_promotora: f.evento_instituicao }
      : null,
    editora: f.editora,
    edicao: f.edicao,
    cidade: f.cidade,
    livro_titulo: f.livro_titulo,
    organizadores: f.organizadores,
    modalidade: f.modalidade,
    premiacao: f.premiacao,
    instituicao: f.instituicao,
    registro: f.registro,
    papel_autor: f.papel_autor || null,
    id_submissao: f.id_submissao,
    link_sistema: f.link_sistema,
    rodada_revisao: f.rodada_revisao ? Number(f.rodada_revisao) : null,
    prazo_resposta: f.prazo_resposta || null,
    editor_responsavel: f.editor_responsavel,
    autores: f.autores
      .filter((a) => a.nome.trim())
      .map((a, i) => ({ nome: a.nome, orcid: a.orcid || null, correspondente: a.correspondente, eh_principal: i === f.principal_idx })),
    taxa_submissao: taxaParaApi(f.taxa_submissao),
    taxa_publicacao: taxaParaApi(f.taxa_publicacao),
    origem: f.origem,
  };
}
