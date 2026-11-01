// Carrega do banco o que o formulário precisa (tipos, veículos, autor principal).
import { listarTipos } from "@/lib/tipos";
import { listarVeiculos } from "@/lib/veiculos";
import type { Contexto } from "@/lib/publicacoes";
import type { TipoOpcao, VeiculoOpcao } from "./modelo";

export function dadosDoFormulario(ctx: Contexto) {
  const tipos: TipoOpcao[] = listarTipos(ctx.donoId).map((t) => ({
    id: t.id,
    chave: t.chave,
    nome: t.nome,
    subtipos: t.subtipos.map((s) => ({ id: s.id, nome: s.nome })),
  }));
  const veiculos: VeiculoOpcao[] = listarVeiculos(ctx.donoId).map((v) => ({
    id: v.id,
    nome: v.nome,
    tipo: v.tipo,
    issn: v.issn,
    eissn: v.eissn,
    editora: v.editora,
  }));
  return { tipos, veiculos, principal: ctx.principal };
}
