import { notFound } from "next/navigation";
import { contextoDe, exigirUsuario } from "@/lib/sessao";
import { alertasDoVeiculo, indexacoesDoVeiculo, metricasDoVeiculo, veiculoDoDono } from "@/lib/veiculos";
import { listarPublicacoes } from "@/lib/filtros";
import { INDICADORES, SELOS } from "@/lib/constantes";
import { dataBr } from "@/lib/texto";
import { BotaoAcao } from "@/componentes/Acoes";
import { Abrir } from "@/componentes/Painelzinho";
import { FormVeiculo } from "../FormVeiculo";
import { FormIndexacao, FormMetrica } from "./FormMetrica";

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
          <BotaoAcao url={`/api/veiculos/${id}/conferir`} rotulo="Marquei tudo como conferido hoje" classe="secundario" />
        </div>
      </div>
      {alertas.map((a, i) => <div key={i} className="aviso atencao">{a}</div>)}
      <div className="grade grade-2">
        <section className="cartao">
          <div className="topo"><h2 style={{ margin: 0 }}>Métricas</h2><Abrir rotulo="+ Métrica" titulo="Nova métrica" classe="pequeno"><FormMetrica veiculoId={id} areaPadrao={u.area_qualis_ref} /></Abrir></div>
          {metricas.length === 0 ? <p className="suave">Nenhuma métrica.</p> : (
            <div className="tabela-rolagem">
              <table>
                <thead><tr><th>Indicador</th><th>Valor</th><th>Área / categoria</th><th>Período</th><th>Selo</th><th>Conferido</th><th></th></tr></thead>
                <tbody>
                  {metricas.map((m) => (
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
          )}
          <p className="ajuda suave" style={{ marginTop: "0.5rem" }}>
            Nunca marque como &quot;Confirmado na fonte oficial&quot; um dado que só a revista informou. A importação das planilhas Qualis/JCR/Scopus
            entra na fase 2.
          </p>
        </section>
        <section className="cartao">
          <div className="topo"><h2 style={{ margin: 0 }}>Indexações</h2><Abrir rotulo="+ Indexação" titulo="Nova indexação" classe="pequeno"><FormIndexacao veiculoId={id} /></Abrir></div>
          {indexacoes.length === 0 ? <p className="suave">Nenhuma indexação.</p> : (
            <ul className="lista-itens">
              {indexacoes.map((i) => (
                <li key={i.id} className="acoes" style={{ justifyContent: "space-between" }}>
                  <span>
                    <strong>{i.base}</strong> {i.situacao === "interrompida" && <span className="selo vermelho">interrompida</span>}{" "}
                    <span className={`selo ${classeSelo(i.selo)}`}>{SELOS[i.selo]}</span> <small>{dataBr(i.conferido_em)}</small>
                  </span>
                  <BotaoAcao url={`/api/indexacoes/${i.id}`} metodo="DELETE" rotulo="✕" confirmar="Excluir esta indexação?" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
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
