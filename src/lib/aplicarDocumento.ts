// Grava o que foi lido num e-mail/declaração: atualiza a publicação (ou cria uma nova),
// muda o status com a data certa e guarda o arquivo como anexo.
import { executar, inserir, transacao, um } from "./db";
import { criarPublicacao, mudarStatus, atualizarBusca, type Contexto } from "./publicacoes";
import { encontrarOuCriarVeiculo } from "./veiculos";
import { tipoPorChave } from "./tipos";
import { STATUS, CATEGORIAS_ANEXO } from "./constantes";
import { normalizarDoi } from "./texto";
import { salvarAnexo, alterarAnexo } from "./anexos";

export interface DadosDocumento {
  publicacao_id?: number | null;
  titulo?: string | null;
  revista?: string | null;
  issn?: string | null;
  status?: string | null; // vazio = não mudar
  data?: string | null;
  prazo_resposta?: string | null;
  rodada?: number | null;
  id_submissao?: string | null;
  link_sistema?: string | null;
  editor_responsavel?: string | null;
  doi?: string | null;
  categoria?: string | null;
}

const v = (x: unknown) => (typeof x === "string" ? x.trim() || null : x ?? null);

export async function aplicarDocumento(
  ctx: Contexto,
  d: DadosDocumento,
  arquivo?: { nome: string; conteudo: Buffer; tipo?: string | null } | null,
  anexoId?: number | null,
): Promise<{ id: number; criada: boolean; alterados: string[] }> {
  const status = v(d.status) as string | null;
  if (status && !(STATUS as readonly string[]).includes(status)) throw new Error("Status inválido.");
  const data = v(d.data) as string | null;
  const doi = d.doi ? normalizarDoi(d.doi) : null;
  if (d.doi && !doi) throw new Error("DOI em formato inválido.");
  const alterados: string[] = [];
  let id = d.publicacao_id ? Number(d.publicacao_id) : 0;
  let criada = false;

  if (!id) {
    const titulo = v(d.titulo) as string | null;
    if (!titulo) throw new Error("Informe o título do trabalho para cadastrar.");
    const st = status ?? "Submetido";
    const tipo = tipoPorChave(ctx.donoId, "artigo");
    if (!tipo) throw new Error("Tipo \"Artigo em periódico\" não encontrado.");
    id = await criarPublicacao(ctx, {
      titulo,
      tipo_id: tipo.id,
      status: st,
      data_submissao: ["Submetido", "Em avaliação"].includes(st) ? data : null,
      data_aceite: st === "Aceito" ? data : null,
      data_publicacao: ["Publicado", "Apresentado"].includes(st) ? data : null,
      ano: ["Publicado", "Apresentado"].includes(st) && data ? Number(data.slice(0, 4)) : null,
      veiculo: d.revista ? { nome: String(d.revista).trim(), issn: v(d.issn) as string | null } : null,
      id_submissao: v(d.id_submissao) as string | null,
      link_sistema: v(d.link_sistema) as string | null,
      editor_responsavel: v(d.editor_responsavel) as string | null,
      prazo_resposta: st === "Em revisão" ? (v(d.prazo_resposta) as string | null) : null,
      rodada_revisao: st === "Em revisão" ? d.rodada ?? 1 : null,
      doi,
      autores: [{ nome: ctx.principal.nome, orcid: ctx.principal.orcid, eh_principal: true }],
      taxa_submissao: { valor: null, nao_sei: true },
      taxa_publicacao: { valor: null, nao_sei: true },
      origem: { titulo: "documento" },
    });
    criada = true;
    alterados.push("cadastro novo");
  } else {
    const p = um<Record<string, unknown>>("SELECT * FROM publicacao WHERE id = ? AND dono_id = ?", id, ctx.donoId);
    if (!p) throw new Error("Publicação não encontrada.");
    const campos: Record<string, unknown> = {};
    for (const c of ["id_submissao", "link_sistema", "editor_responsavel"] as const) {
      const novo = v(d[c]);
      if (novo && novo !== p[c]) campos[c] = novo;
    }
    if (doi && doi !== p.doi) campos.doi = doi;
    if (d.revista && String(d.revista).trim()) {
      const vid = encontrarOuCriarVeiculo(ctx.donoId, { nome: String(d.revista).trim(), issn: v(d.issn) as string | null });
      if (vid !== p.veiculo_id) campos.veiculo_id = vid;
    }
    if (data && !status && !p.data_submissao && ["Submetido", "Em avaliação"].includes(String(p.status))) campos.data_submissao = data;
    if ((!status || status === p.status) && v(d.prazo_resposta) && d.prazo_resposta !== p.prazo_resposta) campos.prazo_resposta = v(d.prazo_resposta);
    const nomes = Object.keys(campos);
    if (nomes.length)
      transacao(() => {
        executar(`UPDATE publicacao SET ${nomes.map((c) => `${c} = ?`).join(", ")}, atualizado_em = datetime('now') WHERE id = ?`, ...nomes.map((c) => campos[c]), id);
        for (const c of nomes)
          inserir("historico_alteracao", {
            dono_id: ctx.donoId,
            tabela: "publicacao",
            registro_id: id,
            campo: c,
            valor_antigo: p[c] === null || p[c] === undefined ? null : String(p[c]),
            valor_novo: String(campos[c]),
            origem: "documento",
            usuario_id: ctx.usuarioId,
          });
        atualizarBusca(id);
      });
    alterados.push(...nomes);
    if (status && status !== p.status) {
      const publicado = status === "Publicado" || status === "Apresentado";
      mudarStatus(ctx, id, status, {
        data: publicado ? null : data,
        data_publicacao: publicado ? data : null,
        prazo_resposta: status === "Em revisão" ? (v(d.prazo_resposta) as string | null) : undefined,
        rodada: status === "Em revisão" ? d.rodada ?? null : null,
        doi: publicado ? doi : null,
        observacao: "Lido de documento",
      });
      alterados.push("status");
    }
  }

  const categoria = d.categoria && CATEGORIAS_ANEXO.includes(d.categoria) ? d.categoria : "Outro";
  if (arquivo) {
    salvarAnexo(ctx.donoId, id, arquivo, categoria);
    alterados.push("anexo");
  } else if (anexoId) {
    const a = um<{ publicacao_id: number }>("SELECT publicacao_id FROM anexo WHERE id = ?", anexoId);
    if (a && a.publicacao_id === id) alterarAnexo(ctx.donoId, anexoId, { categoria });
  }
  return { id, criada, alterados };
}
