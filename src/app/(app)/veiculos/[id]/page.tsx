import { notFound } from "next/navigation";
import { contextoDe, exigirUsuario } from "@/lib/sessao";
import { alertasDoVeiculo, indexacoesDoVeiculo, metricasDoVeiculo, veiculoDoDono } from "@/lib/veiculos";
import { listarPublicacoes } from "@/lib/filtros";
import { INDICADORES, SELOS } from "@/lib/constantes";
import { dataBr } from "@/lib/texto";
import { BotaoAcao } from "@/componentes/Acoes";
import { Abrir } from "@/componentes/Painelzinho";
import { FormVeiculo } from "../FormVeiculo";
import { BuscarMetricas } from "../BuscarMetricas";
import { FormIndexacao, FormMetrica } from "./FormMetrica";

const PRINCIPAIS = ["QUALIS", "JIF", "JIF5", "JCI", "QUARTIL_JCR", "COLECAO_WOS", "SJR", "QUARTIL_SCOPUS", "CITESCORE", "IMPACTO_2A_OPENALEX", "H_OPENALEX", "H5", "APC_USD"];
const BASES_PRINCIPAIS = ["Scopus", "WoS SCIE", "WoS SSCI", "WoS ESCI", "SciELO", "PubMed/MEDLINE", "LILACS", "BDENF", "DOAJ", "Latindex"];
const nomeIndicador = (c: string) => INDICADORES.find((i) => i.chave === c)?.nome ?? c;
const classeSelo = (s: string) => (s === "confirmado_oficial" ? "verde" : s === "nao_localizado" ? "vermelho" : "amarelo");

export default async function Veiculo({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirUsuario("autor");
  const { donoId } = contextoDe(u);
  const id = Number((await params).id);
  const v = veiculoDoDono(donoId, id);
  if (!v) notFound();
  const metricas = metricasDoVeiculo(id);
  const indexacoes = indexacoesDoVeiculo(id);
  const alertas = alertasDoVeiculo(v, metricas, indexacoes);
  const pubs = listarPublicacoes(donoId, { veiculo_id: String(id) }, u.area_qualis_ref);
  return (
    <>
      <p><a href="/veiculos">← Revistas e veículos</a></p>
      <div className="topo">
        <div>
          <h1 style={{ marginBottom: 4 }}>{v.nome}</h1>
          <div className="meta">
            <span>{v.tipo}</span>
            {v.issn && <span>ISSN {v.issn}</span>}
            {v.eissn && <span>e-ISSN {v.eissn}</span>}
            {v.editora && <span>{v.editora}</span>}
            {v.pais && <span>{v.pais}</span>}
            {v.site && <a href={v.site} target="_blank" rel="noreferrer">site</a>}
          </div>
        </div>
        <div className="acoes">
          <Abrir rotulo="Editar dados" titulo="Editar veículo">
            <FormVeiculo inicial={{ id: v.id, nome: v.nome, tipo: v.tipo, issn: v.issn ?? "", eissn: v.eissn ?? "", editora: v.editora ?? "", pais: v.pais ?? "", site: v.site ?? "" }} />
          </Abrir>
          <BuscarMetricas url={`/api/veiculos/${id}/buscar-metricas`} rotulo="Buscar Qualis, JCR, Scopus e indexações" />
          <BotaoAcao url={`/api/veiculos/${id}/conferir`} rotulo="Marquei tudo como conferido hoje" classe="secundario" />
        </div>
      </div>
      {alertas.map((a, i) => <div key={i} className="aviso atencao">{a}</div>)}
      <section className="cartao">
        <div className="topo">
          <h2 style={{ margin: 0 }}>Métricas</h2>
          <Abrir rotulo="+ Outra métrica" titulo="Nova métrica" classe="secundario pequeno"><FormMetrica veiculoId={id} areaPadrao={u.area_qualis_ref} /></Abrir>
        </div>
        <div className="tabela-rolagem">
          <table>
            <thead><tr><th>Métrica</th><th>Valor</th><th>Área / categoria</th><th>Período</th><th>Selo e fonte</th><th>Conferido</th><th></th></tr></thead>
            <tbody>
              {PRINCIPAIS.map((ind) => {
                const lista = metricas.filter((m) => m.indicador === ind);
                if (!lista.length)
                  return (
                    <tr key={ind}>
                      <td>{nomeIndicador(ind)}</td>
                      <td className="suave">não informado</td>
                      <td></td><td></td><td></td><td></td>
                      <td><Abrir rotulo="Inserir" titulo={`Inserir ${nomeIndicador(ind)}`} classe="pequeno"><FormMetrica veiculoId={id} areaPadrao={u.area_qualis_ref} indicadorInicial={ind} /></Abrir></td>
                    </tr>
                  );
                return lista.map((m, k) => (
                  <tr key={m.id}>
                    <td>{k === 0 ? nomeIndicador(ind) : ""}</td>
                    <td><strong>{m.valor.replace(".", ",")}</strong></td>
                    <td>{m.area}</td>
                    <td>{m.periodo}</td>
                    <td><span className={`selo ${classeSelo(m.selo)}`}>{SELOS[m.selo]}</span>{m.fonte ? <small> · {m.fonte}</small> : null}</td>
                    <td>{dataBr(m.conferido_em)}</td>
                    <td className="acoes">
                      {k === 0 && <Abrir rotulo="+" titulo={`Inserir ${nomeIndicador(ind)}`} classe="secundario pequeno"><FormMetrica veiculoId={id} areaPadrao={u.area_qualis_ref} indicadorInicial={ind} /></Abrir>}
                      <BotaoAcao url={`/api/metricas/${m.id}`} metodo="DELETE" rotulo="✕" confirmar="Excluir esta métrica?" />
                    </td>
                  </tr>
                ));
              })}
              {metricas.filter((m) => !PRINCIPAIS.includes(m.indicador)).map((m) => (
                <tr key={m.id}>
                  <td>{nomeIndicador(m.indicador)}</td>
                  <td><strong>{m.valor.replace(".", ",")}</strong></td>
                  <td>{m.area}</td>
                  <td>{m.periodo}</td>
                  <td><span className={`selo ${classeSelo(m.selo)}`}>{SELOS[m.selo]}</span>{m.fonte ? <small> · {m.fonte}</small> : null}</td>
                  <td>{dataBr(m.conferido_em)}</td>
                  <td><BotaoAcao url={`/api/metricas/${m.id}`} metodo="DELETE" rotulo="✕" confirmar="Excluir esta métrica?" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="ajuda suave" style={{ marginTop: "0.5rem" }}>
          Nunca marque como &quot;Confirmado na fonte oficial&quot; um dado que só a revista informou. Para importar listas inteiras, use{" "}
          <a href="/veiculos/importar">Importar Qualis e JCR</a>.
        </p>
      </section>

      <section className="cartao">
        <div className="topo">
          <h2 style={{ margin: 0 }}>Indexações</h2>
          <Abrir rotulo="+ Outra base" titulo="Nova indexação" classe="secundario pequeno"><FormIndexacao veiculoId={id} /></Abrir>
        </div>
        <div className="tabela-rolagem">
          <table>
            <thead><tr><th>Base</th><th>Situação</th><th>Selo e fonte</th><th>Conferido</th><th></th></tr></thead>
            <tbody>
              {[...BASES_PRINCIPAIS, ...indexacoes.map((i) => i.base).filter((b) => !BASES_PRINCIPAIS.includes(b))].map((base) => {
                const i = indexacoes.find((x) => x.base === base);
                return (
                  <tr key={base}>
                    <td>{base}</td>
                    <td>{!i ? <span className="suave">não informado</span> : i.situacao === "interrompida" ? <span className="selo vermelho">interrompida</span> : <span className="selo verde">indexada</span>}</td>
                    <td>{i && <><span className={`selo ${classeSelo(i.selo)}`}>{SELOS[i.selo]}</span>{i.fonte ? <small> · {i.fonte}</small> : null}</>}</td>
                    <td>{i ? dataBr(i.conferido_em) : ""}</td>
                    <td>
                      {i ? (
                        <BotaoAcao url={`/api/indexacoes/${i.id}`} metodo="DELETE" rotulo="✕" confirmar="Excluir esta indexação?" />
                      ) : (
                        <Abrir rotulo="Inserir" titulo={`Indexação em ${base}`} classe="pequeno"><FormIndexacao veiculoId={id} baseInicial={base} /></Abrir>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="cartao">
        <h2 style={{ marginTop: 0 }}>Publicações neste veículo ({pubs.length})</h2>
        <ul className="lista-itens">
          {pubs.map((p) => <li key={p.id}><a href={`/publicacoes/${p.id}`}>{p.titulo}</a> <small>({p.status}{p.ano ? `, ${p.ano}` : ""})</small></li>)}
        </ul>
        {pubs.length === 0 && (
          <BotaoAcao url={`/api/veiculos/${id}`} metodo="DELETE" rotulo="Excluir veículo" classe="perigo pequeno" confirmar="Excluir este veículo e suas métricas?" depois="/veiculos" />
        )}
      </section>
    </>
  );
}
