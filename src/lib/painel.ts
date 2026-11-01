// Números do painel inicial.
import { todos, um } from "./db";
import { proximosPagamentos } from "./custos";
import { listarLembretes } from "./lembretes";
import { hojeIso } from "./texto";

export function dadosPainel(donoId: number) {
  const hoje = hojeIso();
  const ano = hoje.slice(0, 4);
  const mes = hoje.slice(0, 7);
  const conta = (sql: string, ...p: unknown[]) => um<{ n: number }>(sql, donoId, ...p)?.n ?? 0;
  const gasto = (sql: string, ...p: unknown[]) => um<{ v: number }>(sql, donoId, ...p)?.v ?? 0;
  return {
    publicados: conta("SELECT COUNT(*) n FROM publicacao WHERE dono_id = ? AND status IN ('Publicado','Apresentado')"),
    publicados_ano: conta("SELECT COUNT(*) n FROM publicacao WHERE dono_id = ? AND status IN ('Publicado','Apresentado') AND substr(data_publicacao,1,4) = ?", ano),
    aceitos: conta("SELECT COUNT(*) n FROM publicacao WHERE dono_id = ? AND status = 'Aceito'"),
    em_avaliacao: conta("SELECT COUNT(*) n FROM publicacao WHERE dono_id = ? AND status IN ('Submetido','Em avaliação','Em revisão')"),
    em_elaboracao: conta("SELECT COUNT(*) n FROM publicacao WHERE dono_id = ? AND status = 'Em elaboração'"),
    gasto_ano: gasto("SELECT COALESCE(SUM(parte_autor_brl),0) v FROM lancamento_custo WHERE dono_id = ? AND data_pagamento IS NOT NULL AND substr(data_pagamento,1,4) = ?", ano),
    gasto_mes: gasto("SELECT COALESCE(SUM(parte_autor_brl),0) v FROM lancamento_custo WHERE dono_id = ? AND data_pagamento IS NOT NULL AND substr(data_pagamento,1,7) = ?", mes),
    pendente: gasto("SELECT COALESCE(SUM(parte_autor_brl),0) v FROM lancamento_custo WHERE dono_id = ? AND data_pagamento IS NULL"),
    proximos_pagamentos: proximosPagamentos(donoId, 3),
    proximos_prazos: todos<{ id: number; titulo: string; prazo_resposta: string; status: string }>(
      "SELECT id, titulo, prazo_resposta, status FROM publicacao WHERE dono_id = ? AND prazo_resposta >= ? AND status NOT IN ('Publicado','Apresentado','Recusado','Retirado') ORDER BY prazo_resposta LIMIT 5",
      donoId,
      hoje,
    ),
    novos: todos<{ id: number; titulo: string }>("SELECT id, titulo FROM publicacao WHERE dono_id = ? AND selo_novo = 1 ORDER BY data_publicacao DESC LIMIT 5", donoId),
    lembretes: listarLembretes(donoId, true),
  };
}
