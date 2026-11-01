// Cabeçalho comum dos relatórios: nome, ORCID, Lattes, período e data de emissão.
import { buscarUsuario, donoDe, type Usuario } from "./auth";
import type { Filtros } from "./filtros";
import type { OpcoesRelatorio } from "./relatorios";
import { competenciaBr, dataBr } from "./texto";
import type { Cabecalho } from "./exportar";

export function descreverPeriodo(f: Filtros, o: OpcoesRelatorio = {}, chave = ""): string {
  if (chave === "custos" && (o.mes_de || o.mes_ate))
    return `${o.mes_de ? competenciaBr(o.mes_de) : "início"} a ${o.mes_ate ? competenciaBr(o.mes_ate) : "hoje"} (${o.criterio === "caixa" ? "data de pagamento" : "competência"})`;
  if (f.de || f.ate) return `${f.de ? dataBr(f.de) : "início"} a ${f.ate ? dataBr(f.ate) : "hoje"}`;
  if (f.ano) return `Ano ${f.ano}`;
  if (f.quadrienio) return `Quadriênio ${f.quadrienio}`;
  if (f.semestre) return `${f.semestre.slice(5)}º semestre de ${f.semestre.slice(0, 4)}`;
  return "Todo o período";
}

export function cabecalhoRelatorio(u: Usuario, f: Filtros, o: OpcoesRelatorio, chave: string): Cabecalho {
  const dono = buscarUsuario(donoDe(u))!;
  const agora = new Date();
  return {
    nome: dono.nome,
    orcid: dono.orcid,
    lattes: dono.lattes_id ? `http://lattes.cnpq.br/${dono.lattes_id}` : null,
    periodo: descreverPeriodo(f, o, chave),
    emissao: `${agora.toLocaleDateString("pt-BR")} ${agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
  };
}
