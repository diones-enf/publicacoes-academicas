// Lançamentos de custo: valor, moeda (com PTAX), competência x caixa,
// pagador, rateio e compromissos futuros (taxas ainda não pagas).
import { executar, inserir, todos, um } from "./db";
import { cotacaoPtax } from "./conectores/ptax";
import { hojeIso } from "./texto";

export interface DadosLancamento {
  publicacao_id?: number | null;
  tipo: string;
  descricao?: string | null;
  valor: number;
  moeda?: string;
  competencia?: string | null; // AAAA-MM
  data_pagamento?: string | null; // vazio = pendente
  data_vencimento?: string | null;
  pagador?: string | null;
  parte_autor?: number | null; // na moeda original; vazio = valor inteiro
}

export interface Lancamento {
  id: number;
  publicacao_id: number | null;
  tipo: string;
  descricao: string | null;
  valor: number;
  moeda: string;
  cotacao: number;
  cotacao_data: string | null;
  cotacao_estimada: number;
  valor_brl: number;
  parte_autor_brl: number;
  competencia: string;
  data_pagamento: string | null;
  data_vencimento: string | null;
  pagador: string;
}

function arred(v: number): number {
  return Math.round(v * 100) / 100;
}

export async function prepararLancamento(d: DadosLancamento) {
  if (d.valor === null || d.valor === undefined || Number.isNaN(Number(d.valor)))
    throw new Error("Informe o valor (use 0 para gratuito).");
  const valor = Number(d.valor);
  if (valor < 0) throw new Error("O valor não pode ser negativo.");
  const moeda = (d.moeda || "BRL").toUpperCase();
  const parte = d.parte_autor === null || d.parte_autor === undefined || (d.parte_autor as unknown) === "" ? valor : Number(d.parte_autor);
  if (parte > valor) throw new Error("A parte paga pelo autor não pode ser maior que o valor total.");
  const pagamento = d.data_pagamento || null;
  const competencia = d.competencia || (pagamento ?? d.data_vencimento ?? hojeIso()).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(competencia)) throw new Error("Competência inválida (use mês/ano).");

  let cotacao = 1;
  let cotacaoData: string | null = null;
  let estimada = false;
  if (moeda !== "BRL" && valor > 0) {
    // Pago: PTAX do dia do pagamento. Pendente: última PTAX disponível (estimativa).
    const ref = pagamento ?? hojeIso();
    const c = await cotacaoPtax(moeda, ref);
    cotacao = c.valor;
    cotacaoData = c.data;
    estimada = !pagamento;
  }
  return {
    publicacao_id: d.publicacao_id ?? null,
    tipo: d.tipo,
    descricao: d.descricao?.trim() || null,
    valor,
    moeda,
    cotacao,
    cotacao_data: cotacaoData,
    cotacao_estimada: estimada,
    valor_brl: arred(valor * cotacao),
    parte_autor_brl: arred(parte * cotacao),
    competencia,
    data_pagamento: pagamento,
    data_vencimento: d.data_vencimento || null,
    pagador: d.pagador || "Próprio",
  };
}

export async function criarLancamento(donoId: number, d: DadosLancamento): Promise<number> {
  if (d.publicacao_id && !um("SELECT 1 FROM publicacao WHERE id = ? AND dono_id = ?", d.publicacao_id, donoId))
    throw new Error("Publicação não encontrada.");
  return inserir("lancamento_custo", { dono_id: donoId, ...(await prepararLancamento(d)) });
}

export async function atualizarLancamento(donoId: number, id: number, d: DadosLancamento) {
  const atual = um<Lancamento>("SELECT * FROM lancamento_custo WHERE id = ? AND dono_id = ?", id, donoId);
  if (!atual) throw new Error("Lançamento não encontrado.");
  const novo = await prepararLancamento({ ...d, publicacao_id: d.publicacao_id ?? atual.publicacao_id });
  const campos = Object.keys(novo) as (keyof typeof novo)[];
  executar(
    `UPDATE lancamento_custo SET ${campos.map((c) => `${c} = ?`).join(", ")} WHERE id = ? AND dono_id = ?`,
    ...campos.map((c) => novo[c]),
    id,
    donoId,
  );
}

export function excluirLancamento(donoId: number, id: number) {
  executar("DELETE FROM lancamento_custo WHERE id = ? AND dono_id = ?", id, donoId);
}

export function lancamentosDaPublicacao(donoId: number, publicacaoId: number): Lancamento[] {
  return todos<Lancamento>(
    "SELECT * FROM lancamento_custo WHERE dono_id = ? AND publicacao_id = ? ORDER BY competencia, id",
    donoId,
    publicacaoId,
  );
}

export interface FiltroCustos {
  de?: string | null; // AAAA-MM
  ate?: string | null;
  criterio?: "competencia" | "caixa";
  situacao?: "pago" | "pendente" | "";
  pagador?: string | null;
  publicacaoIds?: number[] | null;
}

export function listarLancamentos(donoId: number, f: FiltroCustos = {}) {
  const onde: string[] = ["l.dono_id = ?"];
  const p: unknown[] = [donoId];
  const coluna = f.criterio === "caixa" ? "substr(l.data_pagamento,1,7)" : "l.competencia";
  if (f.criterio === "caixa") onde.push("l.data_pagamento IS NOT NULL");
  if (f.de) {
    onde.push(`${coluna} >= ?`);
    p.push(f.de);
  }
  if (f.ate) {
    onde.push(`${coluna} <= ?`);
    p.push(f.ate);
  }
  if (f.situacao === "pago") onde.push("l.data_pagamento IS NOT NULL");
  if (f.situacao === "pendente") onde.push("l.data_pagamento IS NULL");
  if (f.pagador) {
    onde.push("l.pagador = ?");
    p.push(f.pagador);
  }
  if (f.publicacaoIds) {
    if (!f.publicacaoIds.length) return [];
    onde.push(`l.publicacao_id IN (${f.publicacaoIds.map(() => "?").join(",")})`);
    p.push(...f.publicacaoIds);
  }
  return todos<
    Lancamento & { mes_ref: string; titulo: string | null; tipo_publicacao: string | null; veiculo: string | null }
  >(
    `SELECT l.*, ${coluna} AS mes_ref, pb.titulo, t.nome AS tipo_publicacao, v.nome AS veiculo
       FROM lancamento_custo l
       LEFT JOIN publicacao pb ON pb.id = l.publicacao_id
       LEFT JOIN tipo_publicacao t ON t.id = pb.tipo_id
       LEFT JOIN veiculo v ON v.id = pb.veiculo_id
      WHERE ${onde.join(" AND ")}
      ORDER BY mes_ref, l.id`,
    ...p,
  );
}

/** Próximos compromissos de pagamento (taxas previstas e ainda não pagas). */
export function proximosPagamentos(donoId: number, limite = 3) {
  return todos<Lancamento & { titulo: string | null }>(
    `SELECT l.*, pb.titulo FROM lancamento_custo l LEFT JOIN publicacao pb ON pb.id = l.publicacao_id
      WHERE l.dono_id = ? AND l.data_pagamento IS NULL AND l.valor > 0
      ORDER BY COALESCE(l.data_vencimento, l.competencia || '-28'), l.id LIMIT ?`,
    donoId,
    limite,
  );
}
