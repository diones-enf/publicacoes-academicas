import { contextoDe, exigirUsuario } from "@/lib/sessao";
import { listarLancamentos } from "@/lib/custos";
import { competenciaBr, dataBr, reais } from "@/lib/texto";
import { PAGADORES } from "@/lib/constantes";
import { BotaoAcao } from "@/componentes/Acoes";

export default async function Custos({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await exigirUsuario("autor");
  const { donoId } = contextoDe(u);
  const sp = await searchParams;
  const criterio = sp.criterio === "caixa" ? "caixa" : "competencia";
  const lanc = listarLancamentos(donoId, {
    de: sp.mes_de || null,
    ate: sp.mes_ate || null,
    criterio,
    situacao: (sp.situacao as "pago" | "pendente") || "",
    pagador: sp.pagador || null,
  });
  const pago = lanc.filter((l) => l.data_pagamento).reduce((s, l) => s + l.parte_autor_brl, 0);
  const pend = lanc.filter((l) => !l.data_pagamento).reduce((s, l) => s + l.parte_autor_brl, 0);
  return (
    <>
      <div className="topo">
        <h1>Custos</h1>
        <a className="botao secundario" href={`/relatorios/custos?criterio=${criterio}${sp.mes_de ? `&mes_de=${sp.mes_de}` : ""}${sp.mes_ate ? `&mes_ate=${sp.mes_ate}` : ""}`}>Relatório de despesas</a>
      </div>
      <form className="cartao" method="get">
        <div className="grade grade-4">
          <div className="campo">
            <label htmlFor="criterio">Critério</label>
            <select id="criterio" name="criterio" defaultValue={criterio}>
              <option value="competencia">Por competência (mês da despesa)</option>
              <option value="caixa">Por data de pagamento (caixa)</option>
            </select>
          </div>
          <div className="campo"><label htmlFor="mes_de">De (mês)</label><input id="mes_de" name="mes_de" type="month" defaultValue={sp.mes_de} /></div>
          <div className="campo"><label htmlFor="mes_ate">Até (mês)</label><input id="mes_ate" name="mes_ate" type="month" defaultValue={sp.mes_ate} /></div>
          <div className="campo">
            <label htmlFor="situacao">Situação</label>
            <select id="situacao" name="situacao" defaultValue={sp.situacao ?? ""}><option value="">Todas</option><option value="pago">Pago</option><option value="pendente">Pendente</option></select>
          </div>
          <div className="campo">
            <label htmlFor="pagador">Pagador</label>
            <select id="pagador" name="pagador" defaultValue={sp.pagador ?? ""}><option value="">Todos</option>{PAGADORES.map((p) => <option key={p}>{p}</option>)}</select>
          </div>
        </div>
        <button type="submit">Filtrar</button>
      </form>
      <div className="grade grade-3">
        <div className="cartao indicador"><div className="rotulo">Pago (sua parte)</div><div className="numero">{reais(pago)}</div></div>
        <div className="cartao indicador"><div className="rotulo">Pendente / compromissos futuros</div><div className="numero">{reais(pend)}</div></div>
        <div className="cartao indicador"><div className="rotulo">Lançamentos</div><div className="numero">{lanc.length}</div></div>
      </div>
      <p className="suave">Para lançar um custo, abra a publicação e use &quot;+ Lançamento&quot;. Recibos e notas não são anexados: basta digitar o valor.</p>
      <div className="cartao tabela-rolagem">
        <table>
          <thead><tr><th>{criterio === "caixa" ? "Mês do pagamento" : "Competência"}</th><th>Publicação</th><th>Tipo</th><th className="num">Original</th><th className="num">R$</th><th className="num">Sua parte</th><th>Pagamento</th><th>Pagador</th><th></th></tr></thead>
          <tbody>
            {lanc.map((l) => (
              <tr key={l.id}>
                <td>{competenciaBr(l.mes_ref)}</td>
                <td>{l.publicacao_id ? <a href={`/publicacoes/${l.publicacao_id}`}>{l.titulo}</a> : l.descricao}</td>
                <td>{l.tipo}{l.descricao && l.publicacao_id ? ` — ${l.descricao}` : ""}</td>
                <td className="num">{l.valor === 0 ? "Gratuito" : `${l.moeda} ${l.valor.toFixed(2).replace(".", ",")}`}</td>
                <td className="num">{reais(l.valor_brl)}</td>
                <td className="num">{reais(l.parte_autor_brl)}</td>
                <td>{l.data_pagamento ? dataBr(l.data_pagamento) : l.valor === 0 ? "—" : <span className="selo amarelo">Pendente{l.data_vencimento ? ` até ${dataBr(l.data_vencimento)}` : ""}</span>}</td>
                <td>{l.pagador}</td>
                <td><BotaoAcao url={`/api/custos/${l.id}`} metodo="DELETE" rotulo="✕" confirmar="Excluir este lançamento?" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {lanc.length === 0 && <p className="suave">Nenhum lançamento no período.</p>}
      </div>
    </>
  );
}
