// Listas usadas no painel de filtros.
import { todos } from "./db";
import { listarTipos } from "./tipos";
import { AREAS_QUALIS_COMUNS } from "./constantes";

export function opcoesDeFiltro(donoId: number) {
  const areas = todos<{ area: string }>(
    "SELECT DISTINCT m.area FROM metrica_veiculo m JOIN veiculo v ON v.id = m.veiculo_id WHERE v.dono_id = ? AND m.indicador = 'QUALIS' AND m.area IS NOT NULL",
    donoId,
  ).map((a) => a.area);
  return {
    tipos: listarTipos(donoId).map((t) => ({ id: t.id, nome: t.nome, subtipos: t.subtipos.map((s) => ({ id: s.id, nome: s.nome })) })),
    veiculos: todos<{ id: number; nome: string }>("SELECT id, nome FROM veiculo WHERE dono_id = ? ORDER BY nome", donoId),
    coautores: todos<{ id: number; nome: string }>("SELECT id, nome FROM coautor WHERE dono_id = ? ORDER BY nome", donoId),
    areas: [...new Set([...areas, ...AREAS_QUALIS_COMUNS])],
    visoes: todos<{ id: number; nome: string; filtros: string }>("SELECT id, nome, filtros FROM visao_salva WHERE dono_id = ? ORDER BY nome", donoId),
  };
}
