// Carrega do banco o que o formulário precisa (tipos, veículos, autor principal).
import { listarTipos } from "@/lib/tipos";
import { listarVeiculos } from "@/lib/veiculos";
import { todos } from "@/lib/db";
import type { Contexto } from "@/lib/publicacoes";
import type { TipoOpcao, VeiculoOpcao } from "./modelo";

export function dadosDoFormulario(ctx: Contexto) {
  const tipos: TipoOpcao[] = listarTipos(ctx.donoId).map((t) => ({
    id: t.id,
    chave: t.chave,
    nome: t.nome,
    subtipos: t.subtipos.map((s) => ({ id: s.id, nome: s.nome })),
  }));
  const lista = listarVeiculos(ctx.donoId);
  const qualis = todos<{ veiculo_id: number; texto: string }>(
    `SELECT m.veiculo_id, GROUP_CONCAT(m.valor || ' — ' || COALESCE(m.area, '?') || ' (' || COALESCE(m.periodo, '') || ')', '; ') AS texto
       FROM metrica_veiculo m JOIN veiculo v ON v.id = m.veiculo_id
      WHERE v.dono_id = ? AND m.indicador = 'QUALIS' GROUP BY m.veiculo_id`,
    ctx.donoId,
  );
  const veiculos: VeiculoOpcao[] = lista.map((v) => ({
    id: v.id,
    nome: v.nome,
    tipo: v.tipo,
    issn: v.issn,
    eissn: v.eissn,
    editora: v.editora,
    qualis: qualis.find((q) => q.veiculo_id === v.id)?.texto ?? null,
  }));
  return { tipos, veiculos, principal: ctx.principal };
}
