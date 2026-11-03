import { contextoDe, exigirUsuario } from "@/lib/sessao";
import { resumoCitacoes } from "@/lib/citacoes";
import { competenciaBr, dataBr } from "@/lib/texto";
import { GraficoBarras } from "@/componentes/Graficos";
import { BotaoAtualizarCitacoes } from "@/componentes/Citacoes";

export default async function Citacoes() {
  const u = await exigirUsuario("autor");
  const { donoId } = contextoDe(u);
  const r = resumoCitacoes(donoId);
  const oa = r.atuais.find((a) => a.fonte === "OpenAlex");
  const serieOA = r.serie.filter((s) => s.fonte === "OpenAlex");
  const vazio = !r.atuais.some((a) => a.total !== undefined);
  return (
    <>
      <div className="topo">
        <h1>Evolução das citações</h1>
        <BotaoAtualizarCitacoes />
      </div>
      <p className="suave">
        As citações são buscadas sozinhas uma vez por mês (OpenAlex e Crossref, gratuitos) e cada mês fica guardado, para mostrar a evolução.
        Google Acadêmico, Web of Science e Scopus não têm consulta gratuita: lance o número à mão na página de cada publicação (seção Citações).
        {r.ultimaAtualizacao ? ` Última busca: ${dataBr(r.ultimaAtualizacao.slice(0, 10))}.` : ""}
      </p>
      {vazio ? (
        <div className="aviso info">Ainda não há citações registradas. Clique em <strong>Atualizar citações agora</strong>.</div>
      ) : (
        <>
          <div className="grade grade-3">
            {r.atuais.map((a) => (
              <div key={a.fonte} className="cartao indicador">
                <div className="rotulo">{a.fonte}</div>
                {a.total === undefined ? (
                  <div className="suave">sem dados</div>
                ) : (
                  <>
                    <div className="numero">{a.total} <small style={{ fontSize: "0.9rem" }}>citações</small></div>
                    <small>índice h {a.h} · i10 {a.i10} · {a.publicacoes} publicação(ões) · {competenciaBr(a.mes)}</small>
                  </>
                )}
              </div>
            ))}
          </div>
          {r.porAno.length > 0 && (
            <div className="cartao">
              <GraficoBarras g={{ titulo: "Citações recebidas por ano (OpenAlex)", rotulos: r.porAno.map((p) => String(p.ano)), series: [{ nome: "Citações", valores: r.porAno.map((p) => p.total) }] }} />
            </div>
          )}
          {serieOA.length > 0 && (
            <div className="grade grade-2">
              <div className="cartao">
                <GraficoBarras g={{ titulo: "Citações acumuladas, mês a mês (OpenAlex)", rotulos: serieOA.map((s) => competenciaBr(s.mes)), series: [{ nome: "Total", valores: serieOA.map((s) => s.total) }] }} />
              </div>
              <div className="cartao">
                <GraficoBarras g={{ titulo: "Índice h, mês a mês (OpenAlex)", rotulos: serieOA.map((s) => competenciaBr(s.mes)), series: [{ nome: "Índice h", valores: serieOA.map((s) => s.h) }] }} />
              </div>
            </div>
          )}
          {oa?.total !== undefined && serieOA.length < 2 && (
            <p className="ajuda suave">Os gráficos mês a mês ganham forma a partir do segundo mês de uso.</p>
          )}
        </>
      )}
      <section className="cartao tabela-rolagem">
        <h2 style={{ marginTop: 0 }}>Publicações mais citadas</h2>
        <table>
          <thead><tr><th>Publicação</th><th>Ano</th><th className="num">OpenAlex</th><th className="num">Crossref</th><th className="num">Google Acadêmico</th><th className="num">Web of Science</th><th className="num">Scopus</th></tr></thead>
          <tbody>
            {r.maisCitadas.map((p) => (
              <tr key={p.id}>
                <td><a href={`/publicacoes/${p.id}#citacoes`}>{p.titulo}</a></td>
                <td>{p.ano}</td>
                <td className="num">{p.oa ?? "—"}</td>
                <td className="num">{p.cr ?? "—"}</td>
                <td className="num">{p.gs ?? "—"}</td>
                <td className="num">{p.wos ?? "—"}</td>
                <td className="num">{p.sc ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
