// Importação do Lattes com prévia, deduplicação, registro e desfazer.
import { executar, inserir, todos, transacao, um } from "./db";
import { criarPublicacao, mesclarDadosExternos, verificarDuplicidade, vincularVersoes, type Contexto, type DadosPublicacao } from "./publicacoes";
import { subtipoPorNome, tipoPorChave } from "./tipos";
import { normalizar, similaridade } from "./texto";
import type { Metadados } from "./conectores/tipos";
import type { CurriculoLattes, ItemLattes } from "./lattes";

export type Situacao = "novo" | "existente" | "possivel_duplicata" | "repetido_no_arquivo";

export interface ItemPrevia {
  indice: number;
  item: ItemLattes;
  situacao: Situacao;
  existente: { id: number; titulo: string } | null;
  acaoPadrao: "importar" | "completar" | "pular";
}

export function previaLattes(donoId: number, cv: CurriculoLattes): ItemPrevia[] {
  const vistos: ItemLattes[] = [];
  return cv.itens.map((item, indice) => {
    // o mesmo trabalho listado duas vezes no próprio Lattes
    const repetido = vistos.find(
      (o) => (item.doi && o.doi === item.doi) || (o.chaveTipo === item.chaveTipo && o.ano === item.ano && similaridade(o.titulo, item.titulo) >= 0.97),
    );
    vistos.push(item);
    if (repetido) return { indice, item, situacao: "repetido_no_arquivo", existente: null, acaoPadrao: "pular" };
    const dups = mesmoTipo(donoId, item.chaveTipo, verificarDuplicidade(donoId, { doi: item.doi, isbn: item.chaveTipo === "capitulo" ? item.isbn : null, titulo: item.titulo, ano: item.ano }));
    const d = dups[0];
    if (!d) return { indice, item, situacao: "novo", existente: null, acaoPadrao: "importar" };
    const certo = d.motivo !== "titulo" || d.similaridade >= 0.999;
    return {
      indice,
      item,
      situacao: certo ? "existente" : "possivel_duplicata",
      existente: { id: d.publicacao_id, titulo: d.titulo },
      acaoPadrao: certo ? "completar" : "pular",
    };
  });
}

function dadosDoItem(ctx: Contexto, cv: CurriculoLattes, it: ItemLattes): DadosPublicacao {
  const tipo = tipoPorChave(ctx.donoId, it.chaveTipo) ?? tipoPorChave(ctx.donoId, "artigo")!;
  const origem: Record<string, string> = {};
  for (const c of ["titulo", "doi", "volume", "numero", "paginas", "idioma", "link", "isbn", "editora", "livro_titulo", "data_publicacao", "autores"])
    origem[c] = "Lattes";
  const principal = it.autores.findIndex((a) => a.ehDono);
  return {
    titulo: it.titulo,
    tipo_id: tipo.id,
    subtipo_id: it.subtipo ? (subtipoPorNome(tipo.id, it.subtipo)?.id ?? null) : null,
    status: it.status,
    ano: it.ano,
    data_publicacao: it.data_publicacao,
    volume: it.volume,
    numero: it.numero,
    paginas: it.paginas,
    idioma: it.idioma,
    doi: it.doi,
    isbn: it.isbn,
    issn: it.issn,
    link: it.link,
    palavras_chave: it.palavras_chave,
    editora: it.editora,
    edicao: it.edicao,
    cidade: it.cidade,
    livro_titulo: it.livro_titulo,
    organizadores: it.organizadores,
    modalidade: it.modalidade,
    veiculo: it.veiculo ? { nome: it.veiculo, issn: it.issn, tipo: it.chaveTipo === "jornal" ? "jornal" : "revista" } : null,
    evento: it.evento ? { nome: it.evento.nome, cidade: it.evento.cidade, data: it.evento.ano ? `${it.evento.ano}-01-01` : null } : null,
    autores: it.autores.map((a, i) => ({ nome: a.citacao || a.nome, eh_principal: i === principal })),
    // O Lattes não informa custos: as taxas ficam como "Ainda não sei" para você completar.
    taxa_submissao: { valor: null, nao_sei: true },
    taxa_publicacao: { valor: null, nao_sei: true },
    origem,
  };
}

function metadadosDoItem(it: ItemLattes): Metadados {
  return {
    fonte: "Lattes",
    titulo: it.titulo,
    doi: it.doi,
    ano: it.ano,
    data_publicacao: it.data_publicacao,
    volume: it.volume,
    numero: it.numero,
    paginas: it.paginas,
    idioma: it.idioma,
    link: it.link,
    isbn: it.isbn,
    issn: it.issn,
    editora: it.editora,
    livro_titulo: it.livro_titulo,
    revista: it.veiculo,
    autores: it.autores.map((a) => ({ nome: a.citacao || a.nome })),
  };
}

export interface ResultadoImportacao {
  importacaoId: number;
  criados: number;
  completados: number;
  pulados: number;
  erros: string[];
}

export async function importarLattes(
  ctx: Contexto,
  cv: CurriculoLattes,
  decisoes: Record<number, "importar" | "completar" | "pular">,
  arquivo: string,
): Promise<ResultadoImportacao> {
  const previa = previaLattes(ctx.donoId, cv);
  const importacaoId = inserir("importacao", { dono_id: ctx.donoId, fonte: "Lattes", arquivo });
  let criados = 0;
  let completados = 0;
  let pulados = 0;
  const erros: string[] = [];
  for (const p of previa) {
    const acao = decisoes[p.indice] ?? p.acaoPadrao;
    try {
      if (acao === "importar") {
        // confere de novo na hora (o mesmo arquivo pode ter itens iguais entre si)
        const jaTem = mesmoTipo(ctx.donoId, p.item.chaveTipo, verificarDuplicidade(ctx.donoId, { doi: p.item.doi, titulo: p.item.titulo, ano: p.item.ano })).find(
          (d) => d.motivo !== "titulo" || d.similaridade >= 0.999,
        );
        if (jaTem && p.situacao !== "possivel_duplicata") {
          pulados++;
          continue;
        }
        const id = await criarPublicacao(ctx, dadosDoItem(ctx, cv, p.item), { ignorarDuplicidade: true });
        inserir("importacao_item", { importacao_id: importacaoId, publicacao_id: id, acao: "criado", titulo: p.item.titulo });
        ligarVersoes(ctx, id, p.item.titulo);
        criados++;
      } else if (acao === "completar" && p.existente) {
        const r = mesclarDadosExternos(ctx, p.existente.id, metadadosDoItem(p.item));
        if (r.preenchidos.length) {
          inserir("importacao_item", {
            importacao_id: importacaoId,
            publicacao_id: p.existente.id,
            acao: "completado",
            campos: JSON.stringify(r.preenchidos),
            titulo: p.item.titulo,
          });
          completados++;
        } else pulados++;
      } else pulados++;
    } catch (e) {
      erros.push(`"${p.item.titulo.slice(0, 60)}": ${(e as Error).message}`);
    }
  }
  executar("UPDATE importacao SET criados = ?, atualizados = ? WHERE id = ?", criados, completados, importacaoId);
  atualizarNomesDoAutor(ctx.donoId, cv);
  return { importacaoId, criados, completados, pulados, erros: erros.slice(0, 10) };
}

/** Acrescenta ao cadastro os nomes em citação e o ID Lattes que vieram do currículo. */
function atualizarNomesDoAutor(donoId: number, cv: CurriculoLattes) {
  const u = um<{ nomes_citacao: string; lattes_id: string | null }>("SELECT nomes_citacao, lattes_id FROM usuario WHERE id = ?", donoId);
  if (!u) return;
  let nomes: string[] = [];
  try {
    nomes = JSON.parse(u.nomes_citacao);
  } catch {
    /* lista vazia */
  }
  const chaves = new Set(nomes.map((n) => normalizar(n)));
  for (const n of cv.nomesCitacao) if (!chaves.has(normalizar(n))) nomes.push(n);
  executar(
    "UPDATE usuario SET nomes_citacao = ?, lattes_id = COALESCE(NULLIF(lattes_id, ''), ?) WHERE id = ?",
    JSON.stringify(nomes),
    cv.idLattes || null,
    donoId,
  );
}

const COLUNA_DE: Record<string, string> = { revista: "veiculo_id" };

/** Desfaz uma importação inteira: apaga o que ela criou e esvazia o que ela completou. */
export function desfazerImportacao(ctx: Contexto, importacaoId: number) {
  const imp = um<{ id: number; desfeita_em: string | null }>(
    "SELECT id, desfeita_em FROM importacao WHERE id = ? AND dono_id = ?",
    importacaoId,
    ctx.donoId,
  );
  if (!imp) throw new Error("Importação não encontrada.");
  if (imp.desfeita_em) throw new Error("Esta importação já foi desfeita.");
  transacao(() => {
    for (const it of todos<{ publicacao_id: number; acao: string; campos: string | null }>(
      "SELECT publicacao_id, acao, campos FROM importacao_item WHERE importacao_id = ?",
      importacaoId,
    )) {
      if (it.acao === "criado") {
        executar("DELETE FROM publicacao WHERE id = ? AND dono_id = ?", it.publicacao_id, ctx.donoId);
      } else if (it.acao === "completado" && it.campos) {
        for (const c of JSON.parse(it.campos) as string[]) {
          if (c === "autores") executar("DELETE FROM autoria WHERE publicacao_id = ?", it.publicacao_id);
          else executar(`UPDATE publicacao SET ${COLUNA_DE[c] ?? c} = NULL WHERE id = ? AND dono_id = ?`, it.publicacao_id, ctx.donoId);
        }
      }
    }
    executar("UPDATE importacao SET desfeita_em = datetime('now') WHERE id = ?", importacaoId);
  });
}

export function listarImportacoes(donoId: number) {
  return todos<{ id: number; fonte: string; arquivo: string | null; criados: number; atualizados: number; desfeita_em: string | null; em: string }>(
    "SELECT id, fonte, arquivo, criados, atualizados, desfeita_em, em FROM importacao WHERE dono_id = ? ORDER BY id DESC",
    donoId,
  );
}

/** Duplicata só entre itens do mesmo tipo (DOI igual é sempre o mesmo item). */
function mesmoTipo<T extends { publicacao_id: number; motivo: string }>(donoId: number, chaveTipo: string, dups: T[]): T[] {
  return dups.filter((d) => {
    if (d.motivo === "doi") return true;
    const t = um<{ chave: string }>(
      "SELECT t.chave FROM publicacao p JOIN tipo_publicacao t ON t.id = p.tipo_id WHERE p.id = ? AND p.dono_id = ?",
      d.publicacao_id,
      donoId,
    );
    return t?.chave === chaveTipo;
  });
}

/** O mesmo trabalho em outro formato (ex.: artigo e apresentação com o mesmo título) fica ligado como versão relacionada. */
function ligarVersoes(ctx: Contexto, id: number, titulo: string) {
  const chave = normalizar(titulo);
  for (const o of todos<{ id: number; titulo_normalizado: string }>(
    "SELECT id, titulo_normalizado FROM publicacao WHERE dono_id = ? AND id != ? AND tipo_id != (SELECT tipo_id FROM publicacao WHERE id = ?)",
    ctx.donoId,
    id,
    id,
  ))
    if (o.titulo_normalizado === chave || similaridade(o.titulo_normalizado, chave) >= 0.95) vincularVersoes(ctx, id, o.id);
}
