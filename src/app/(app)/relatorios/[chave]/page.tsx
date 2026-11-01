import { notFound } from "next/navigation";
import { areaReferencia, contextoDe, exigirUsuario } from "@/lib/sessao";
import { filtrosDaUrl } from "@/lib/filtros";
import { gerarRelatorio, RELATORIOS, type OpcoesRelatorio } from "@/lib/relatorios";
import { cabecalhoRelatorio } from "@/lib/cabecalho";
import { opcoesDeFiltro } from "@/lib/opcoesFiltro";
import { reais } from "@/lib/texto";
import { PainelFiltros } from "@/componentes/PainelFiltros";
import { GraficoBarras, RedeColaboracao } from "@/componentes/Graficos";
import { Exportar } from "./Exportar";

function negrito(ref: string) {
  return ref.split(/\*\*(.+?)\*\*/g).map((parte, i) => (i % 2 ? <strong key={i}>{parte}</strong> : parte));
}

export default async function Relatorio({ params, searchParams }: { params: Promise<{ chave: string }>; searchParams: Promise<Record<string, string>> }) {
  const u = await exigirUsuario();
  const { donoId } = contextoDe(u);
  const { chave } = await params;
  if (!RELATORIOS.some((r) => r.chave === chave)) notFound();
  const sp = await searchParams;
  const f = filtrosDaUrl(sp);
  const o: OpcoesRelatorio = {
    criterio: sp.criterio === "caixa" ? "caixa" : "competencia",
    mes_de: sp.mes_de,
    mes_ate: sp.mes_ate,
    estilo: sp.estilo === "vancouver" ? "vancouver" : "abnt",
  };
  const r = gerarRelatorio(chave, donoId, f, o, areaReferencia(u))!;
  const cab = cabecalhoRelatorio(u, f, o, chave);
  const qs = new URLSearchParams(sp).toString();

  return (
    <>
      <p className="nao-imprimir"><a href={`/relatorios${qs ? `?${qs}` : ""}`}>← Relatórios</a></p>
      <div className="topo">
        <h1>{r.titulo}</h1>
        <Exportar chave={chave} qs={qs} />
      </div>
      <div className="cartao">
        <div className="grade grade-2" style={{ fontSize: "0.92rem" }}>
          <div><strong>{cab.nome}</strong><br />ORCID: {cab.orcid ?? "—"}<br />Lattes: {cab.lattes ?? "—"}</div>
          <div>Período: {cab.periodo}<br />Emitido em: {cab.emissao}</div>
        </div>
        <p className="suave" style={{ marginTop: "0.5rem" }}>{r.descricao}</p>
      </div>

      {(chave === "custos" || chave === "referencias") && (
        <form method="get" className="cartao nao-imprimir">
          {Object.entries(sp).filter(([k]) => !["criterio", "mes_de", "mes_ate", "estilo"].includes(k)).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <div className="grade grade-4">
            {chave === "custos" ? (
              <>
                <div className="campo">
                  <label htmlFor="criterio">Critério</label>
                  <select id="criterio" name="criterio" defaultValue={o.criterio}>
                    <option value="competencia">Competência (mês da despesa)</option>
                    <option value="caixa">Data de pagamento (caixa)</option>
                  </select>
                </div>
                <div className="campo"><label htmlFor="mes_de">De (mês)</label><input id="mes_de" type="month" name="mes_de" defaultValue={o.mes_de} /></div>
                <div className="campo"><label htmlFor="mes_ate">Até (mês)</label><input id="mes_ate" type="month" name="mes_ate" defaultValue={o.mes_ate} /></div>
              </>
            ) : (
              <div className="campo">
                <label htmlFor="estilo">Estilo</label>
                <select id="estilo" name="estilo" defaultValue={o.estilo}><option value="abnt">ABNT NBR 6023</option><option value="vancouver">Vancouver</option></select>
              </div>
            )}
          </div>
          <button type="submit">Atualizar</button>
        </form>
      )}

      <PainelFiltros opcoes={opcoesDeFiltro(donoId)} base={`/relatorios/${chave}`} valores={sp} />

      {r.cartoes.length > 0 && (
        <div className="grade grade-4">
          {r.cartoes.map((c) => (
            <div key={c.rotulo} className="cartao indicador"><div className="rotulo">{c.rotulo}</div><div className="numero" style={{ fontSize: "1.35rem" }}>{c.valor}</div></div>
          ))}
        </div>
      )}
      {r.graficos.map((g) => <div key={g.titulo} className="cartao"><GraficoBarras g={g} /></div>)}
      {r.rede && <div className="cartao"><RedeColaboracao nos={r.rede.nos} arestas={r.rede.arestas} /></div>}

      {r.referencias ? (
        <section className="cartao">
          {r.referencias.length === 0 && <p className="suave">Nenhuma publicação com estes filtros.</p>}
          {r.referencias.map((ref, i) => <p key={i} className="referencia">{negrito(ref)}</p>)}
        </section>
      ) : (
        r.tabelas.map((t) => (
          <section key={t.titulo} className="cartao">
            <h2 style={{ marginTop: 0 }}>{t.titulo}</h2>
            {t.linhas.length === 0 ? (
              <p className="suave">Nada a mostrar.</p>
            ) : (
              <div className="tabela-rolagem">
                <table>
                  <thead><tr>{t.colunas.map((c, i) => <th key={i} className={t.moeda?.includes(i) ? "num" : undefined}>{c}</th>)}</tr></thead>
                  <tbody>
                    {t.linhas.map((l, i) => (
                      <tr key={i}>{l.map((c, j) => <td key={j} className={t.moeda?.includes(j) || typeof c === "number" ? "num" : undefined}>{t.moeda?.includes(j) && typeof c === "number" ? reais(c) : c}</td>)}</tr>
                    ))}
                    {t.totais && (
                      <tr className="total">{t.totais.map((c, j) => <td key={j} className={t.moeda?.includes(j) ? "num" : undefined}>{t.moeda?.includes(j) && typeof c === "number" ? reais(c) : c}</td>)}</tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))
      )}
    </>
  );
}
