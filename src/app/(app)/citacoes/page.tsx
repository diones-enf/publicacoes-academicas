import { contextoDe, exigirUsuario } from "@/lib/sessao";
import { resumoCitacoes } from "@/lib/citacoes";
import { competenciaBr, dataBr } from "@/lib/texto";
import { GraficoBarras } from "@/componentes/Graficos";
import { BotaoAtualizarCitacoes, GoogleAcademico } from "@/componentes/Citacoes";
import { resumoGoogle } from "@/lib/googleAcademico";
import { linkDoPerfil } from "@/lib/conectores/googleAcademico";
import { nomePais } from "@/lib/paises";

export default async function Citacoes() {
  const u = await exigirUsuario("autor");
  const { donoId } = contextoDe(u);
  const r = resumoCitacoes(donoId);
  const g = resumoGoogle(donoId);
  const ga = g.atual;
  const foraGoogle = ga?.artigos.filter((a) => !a.publicacao_id) ?? [];
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
        As citações são buscadas sozinhas uma vez por mês (OpenAlex, Crossref e, se o perfil estiver ligado, Google Acadêmico) e cada mês fica guardado,
        para mostrar a evolução. Web of Science e Scopus não têm consulta gratuita: lance o número à mão na página de cada publicação (seção Citações).
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
      {r.impacto.comFwci > 0 && (
        <section className="cartao">
          <h2 style={{ marginTop: 0 }}>Impacto comparado com a área (OpenAlex)</h2>
          <div className="grade grade-3">
            <div className="indicador">
              <div className="rotulo">FWCI médio</div>
              <div className="numero">{r.impacto.fwciMedio !== null ? String(r.impacto.fwciMedio).replace(".", ",") : "—"}</div>
              <small>1,0 = média mundial de artigos da mesma área e ano</small>
            </div>
            <div className="indicador">
              <div className="rotulo">Entre os 10% mais citados da área</div>
              <div className="numero">{r.impacto.top10}</div>
              <small>de {r.impacto.comFwci} publicação(ões) com dados</small>
            </div>
            <div className="indicador">
              <div className="rotulo">Autocitações</div>
              <div className="numero">{r.quemCita.propria + r.quemCita.coautor}</div>
              <small>{r.quemCita.propria} suas · {r.quemCita.coautor} de coautores · {r.quemCita.total - r.quemCita.propria - r.quemCita.coautor} de terceiros</small>
            </div>
          </div>
          <p className="ajuda suave">
            FWCI: quanto o artigo é citado em relação à média de artigos da mesma área e ano (2,0 = o dobro da média). Percentil: posição entre
            artigos parecidos (90 = mais citado que 90% deles). &quot;Sem autocitações&quot; desconta as citações feitas por você ou pelos coautores
            do próprio artigo.
          </p>
        </section>
      )}
      <section className="cartao tabela-rolagem">
        <h2 style={{ marginTop: 0 }}>Publicações mais citadas</h2>
        <table>
          <thead>
            <tr>
              <th>Publicação</th><th>Ano</th><th className="num">OpenAlex</th><th className="num">Sem autocitações</th><th className="num">FWCI</th>
              <th className="num">Percentil</th><th className="num">Crossref</th><th className="num">Google Acadêmico</th><th className="num">Web of Science</th><th className="num">Scopus</th>
            </tr>
          </thead>
          <tbody>
            {r.maisCitadas.map((p) => (
              <tr key={p.id}>
                <td><a href={`/publicacoes/${p.id}#citacoes`}>{p.titulo}</a>{p.top10 ? <span className="selo verde" style={{ marginLeft: 6 }}>top 10%</span> : null}</td>
                <td>{p.ano}</td>
                <td className="num">{p.oa ?? "—"}</td>
                <td className="num">{p.semAuto ?? "—"}</td>
                <td className="num">{p.fwci !== null ? String(p.fwci).replace(".", ",") : "—"}</td>
                <td className="num">{p.percentil !== null ? String(p.percentil).replace(".", ",") : "—"}</td>
                <td className="num">{p.cr ?? "—"}</td>
                <td className="num">{p.gs ?? "—"}</td>
                <td className="num">{p.wos ?? "—"}</td>
                <td className="num">{p.sc ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {r.quemCita.total > 0 && (
        <section className="cartao">
          <h2 style={{ marginTop: 0 }}>Quem cita você</h2>
          <div className="grade grade-2">
            <div className="tabela-rolagem">
              <h3>Revistas que citaram</h3>
              <table>
                <thead><tr><th>Revista</th><th className="num">Citações</th></tr></thead>
                <tbody>{r.quemCita.revistas.map(([nome, n]) => <tr key={nome}><td>{nome}</td><td className="num">{n}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="tabela-rolagem">
              <h3>Países dos autores que citaram</h3>
              <table>
                <thead><tr><th>País</th><th className="num">Citações</th></tr></thead>
                <tbody>{r.quemCita.paises.map(([nome, n]) => <tr key={nome}><td>{nomePais(nome)}</td><td className="num">{n}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </section>
      )}
      <section className="cartao">
        <h2 style={{ marginTop: 0 }}>Google Acadêmico</h2>
        <GoogleAcademico link={g.perfil ? linkDoPerfil(g.perfil) : null} />
        {ga && (
          <>
            <div className="grade grade-3" style={{ marginTop: "0.8rem" }}>
              <div className="indicador">
                <div className="rotulo">Citações no perfil</div>
                <div className="numero">{ga.citacoes ?? 0}</div>
                {ga.ano_desde ? <small>desde {ga.ano_desde}: {ga.citacoes_desde ?? 0}</small> : null}
              </div>
              <div className="indicador">
                <div className="rotulo">Índice h</div>
                <div className="numero">{ga.h ?? 0}</div>
                {ga.ano_desde ? <small>desde {ga.ano_desde}: {ga.h_desde ?? 0}</small> : null}
              </div>
              <div className="indicador">
                <div className="rotulo">Índice i10</div>
                <div className="numero">{ga.i10 ?? 0}</div>
                {ga.ano_desde ? <small>desde {ga.ano_desde}: {ga.i10_desde ?? 0}</small> : null}
              </div>
            </div>
            <p className="ajuda suave">
              Números do próprio perfil do Google ({ga.artigos.length} trabalho(s)), lidos em {dataBr(ga.registrado_em.slice(0, 10))}.
              {g.serie.length > 1 ? ` Histórico: ${g.serie.map((s) => `${competenciaBr(s.mes)}: ${s.citacoes ?? 0}`).join(" · ")}.` : ""}
            </p>
            {ga.porAno.length > 0 && (
              <GraficoBarras g={{ titulo: "Citações por ano (Google Acadêmico)", rotulos: ga.porAno.map((p) => String(p.ano)), series: [{ nome: "Citações", valores: ga.porAno.map((p) => p.total) }] }} />
            )}
            {foraGoogle.length > 0 && (
              <details>
                <summary>{foraGoogle.length} trabalho(s) do Google que não estão no sistema</summary>
                <ul>
                  {foraGoogle.map((a) => (
                    <li key={a.titulo}>
                      {a.titulo} {a.ano ? `(${a.ano})` : ""} — {a.citacoes} citação(ões){" "}
                      <a href="/publicacoes/nova">cadastrar</a>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </section>
      <p className="nao-imprimir"><a className="botao secundario" href="/relatorios/citacoes">Relatório de citações (PDF, Excel)</a></p>
    </>
  );
}
