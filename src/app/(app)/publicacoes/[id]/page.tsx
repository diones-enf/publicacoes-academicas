import { notFound } from "next/navigation";
import { areaReferencia, contextoDe, exigirUsuario } from "@/lib/sessao";
import { obterPublicacao } from "@/lib/publicacoes";
import { competenciaBr, dataBr, normalizar, reais } from "@/lib/texto";
import { SELOS } from "@/lib/constantes";
import { metricasDoVeiculo, indexacoesDoVeiculo } from "@/lib/veiculos";
import { todos } from "@/lib/db";
import { BotaoAcao } from "@/componentes/Acoes";
import { Abrir } from "@/componentes/Painelzinho";
import { MudarStatus, Ressubmeter } from "@/componentes/MudarStatus";
import { FormLancamento } from "@/componentes/FormLancamento";
import { VincularVersao } from "./VincularVersao";

const ROTULOS: Record<string, string> = {
  titulo: "Título", doi: "DOI", data_publicacao: "Data de publicação", data_aceite: "Data de aceite", volume: "Volume",
  numero: "Número", paginas: "Páginas", idioma: "Idioma", resumo: "Resumo", link: "Link", isbn: "ISBN", issn: "ISSN",
  editora: "Editora", livro_titulo: "Livro", ano: "Ano",
};

function seloClasse(selo: string) {
  return selo === "confirmado_oficial" ? "verde" : selo === "nao_localizado" ? "vermelho" : "amarelo";
}

export default async function Detalhe({ params }: { params: Promise<{ id: string }> }) {
  const u = await exigirUsuario("autor");
  const ctx = contextoDe(u);
  const id = Number((await params).id);
  const p = obterPublicacao(ctx.donoId, id, areaReferencia(u));
  if (!p) notFound();

  const metricas = p.veiculo_id ? metricasDoVeiculo(p.veiculo_id) : [];
  const indexacoes = p.veiculo_id ? indexacoesDoVeiculo(p.veiculo_id) : [];
  const outras = todos<{ id: number; titulo: string; ano: number | null }>(
    "SELECT id, titulo, ano FROM publicacao WHERE dono_id = ? AND id != ? ORDER BY titulo",
    ctx.donoId,
    id,
  );

  // Fonte mais recente de cada campo, e divergências entre fontes e o valor gravado
  const fonteDe: Record<string, string> = {};
  const divergencias: { campo: string; fonte: string; valor: string }[] = [];
  const atual = p as unknown as Record<string, unknown>;
  for (const o of p.origens) {
    const gravado = String(atual[o.campo] ?? "");
    if (o.valor !== null && normalizar(gravado) === normalizar(o.valor)) fonteDe[o.campo] = o.fonte;
    else if (o.valor && gravado && ROTULOS[o.campo] && !divergencias.some((d) => d.campo === o.campo && d.fonte === o.fonte))
      divergencias.push({ campo: o.campo, fonte: o.fonte, valor: o.valor });
  }
  const F = ({ c }: { c: string }) => (fonteDe[c] ? <span className="fonte">{fonteDe[c]}</span> : null);

  const linha = (rotulo: string, valor: React.ReactNode, c?: string) =>
    valor ? (
      <tr>
        <th scope="row" style={{ width: "28%" }}>{rotulo}</th>
        <td>{valor}{c && <F c={c} />}</td>
      </tr>
    ) : null;

  const taxaInfo = (tipo: string, naoSei: number) => {
    if (naoSei) return <span className="selo amarelo">Ainda não sei</span>;
    const l = p.lancamentos.find((x) => x.tipo === tipo);
    if (!l) return <span className="selo vermelho">Não informada</span>;
    if (l.valor === 0) return <span className="selo verde">Gratuito</span>;
    return `${reais(l.parte_autor_brl)}${l.data_pagamento ? ` pago em ${dataBr(l.data_pagamento)}` : " (pendente)"}`;
  };

  return (
    <>
      <div className="acoes" style={{ marginBottom: "0.5rem" }}>
        <a href={p.secao === "submissoes" ? "/submissoes" : `/publicacoes?secao=${p.secao}`}>← {p.secao === "submissoes" ? "Submissões" : p.secao === "encerrados" ? "Encerrados" : "Publicados"}</a>
      </div>
      <div className="topo">
        <div>
          <h1 style={{ marginBottom: "0.3rem" }}>{p.titulo}<F c="titulo" /></h1>
          <div className="meta">
            <span className="selo azul">{p.status}</span>
            {p.selo_novo ? <span className="selo verde">novo</span> : null}
            <span>{p.tipo_nome}{p.subtipo_nome ? ` — ${p.subtipo_nome}` : ""}</span>
            {p.papel_autor && <span>Você: {p.papel_autor}</span>}
          </div>
        </div>
        <div className="acoes nao-imprimir">
          <a className="botao" href={`/publicacoes/${id}/editar`}>Editar</a>
          <Abrir rotulo="Mudar status" titulo="Mudar status">
            <MudarStatus id={id} atual={p.status} doiAtual={p.doi} />
          </Abrir>
          {p.historico.length > 1 && (
            <BotaoAcao url={`/api/publicacoes/${id}/desfazer-status`} rotulo="Desfazer última mudança de status" confirmar="Voltar ao status anterior?" />
          )}
          {p.selo_novo ? <BotaoAcao url={`/api/publicacoes/${id}`} metodo="PATCH" rotulo="Tirar selo novo" /> : null}
        </div>
      </div>

      {(p.status === "Recusado" || p.status === "Retirado") && (
        <div className="cartao">
          <h2 style={{ marginTop: 0 }}>Reaproveitar: enviar a outra revista</h2>
          <Ressubmeter id={id} />
        </div>
      )}

      {divergencias.length > 0 && (
        <div className="aviso atencao">
          <strong>Fontes discordam do que está gravado:</strong>
          <ul style={{ margin: "0.3rem 0 0" }}>
            {divergencias.map((d, i) => (
              <li key={i}>{ROTULOS[d.campo] ?? d.campo}: gravado “{String(atual[d.campo])}”, {d.fonte} informa “{d.valor}”</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grade grade-2">
        <section className="cartao">
          <h2 style={{ marginTop: 0 }}>Dados</h2>
          <table>
            <tbody>
              {linha("Revista / veículo", p.veiculo_id ? <a href={`/veiculos/${p.veiculo_id}`}>{p.veiculo_nome}</a> : null)}
              {p.veiculo_id &&
                linha(
                  "Classificação Qualis",
                  metricas.filter((m) => m.indicador === "QUALIS").length ? (
                    metricas
                      .filter((m) => m.indicador === "QUALIS")
                      .map((m) => `${m.valor} — ${m.area ?? "área não informada"}${m.periodo ? ` (${m.periodo})` : ""}`)
                      .join("; ")
                  ) : (
                    <span className="selo amarelo">Sem Qualis cadastrado</span>
                  ),
                )}
              {linha("Evento", p.evento_nome ? `${p.evento_nome}${p.evento_edicao ? ` (${p.evento_edicao})` : ""}${p.evento_cidade ? `, ${p.evento_cidade}` : ""}${p.evento_data ? `, ${dataBr(p.evento_data)}` : ""}` : null)}
              {linha("Livro", p.livro_titulo, "livro_titulo")}
              {linha("Organizadores", p.organizadores)}
              {linha("DOI", p.doi ? <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">{p.doi}</a> : null, "doi")}
              {linha("ISSN", [p.veiculo_issn, p.veiculo_eissn].filter(Boolean).join(" / "))}
              {linha("ISBN", p.isbn, "isbn")}
              {linha("Editora", p.editora ?? p.veiculo_editora, "editora")}
              {linha("Volume / número", [p.volume && `v. ${p.volume}`, p.numero && `n. ${p.numero}`].filter(Boolean).join(", "))}
              {linha("Páginas / e-locator", p.paginas, "paginas")}
              {linha("Edição / cidade", [p.edicao, p.cidade].filter(Boolean).join(" — "))}
              {linha("Modalidade", p.modalidade)}
              {linha("Premiação", p.premiacao)}
              {linha("Instituição", p.instituicao)}
              {linha("Registro", p.registro)}
              {linha("Submissão", dataBr(p.data_submissao))}
              {linha("Aceite", dataBr(p.data_aceite), "data_aceite")}
              {linha("Publicação", dataBr(p.data_publicacao), "data_publicacao")}
              {linha("Ano", p.ano ? String(p.ano) : null)}
              {linha("Idioma", p.idioma, "idioma")}
              {linha("Área temática", p.area_tematica)}
              {linha("Palavras-chave", p.palavras_chave)}
              {linha("Link", p.link ? <a href={p.link} target="_blank" rel="noreferrer">{p.link}</a> : null, "link")}
              {linha("Observações", p.observacoes)}
            </tbody>
          </table>
          {p.doi && (
            <div className="acoes nao-imprimir" style={{ marginTop: "0.75rem" }}>
              <BotaoAcao url={`/api/publicacoes/${id}/completar`} rotulo="Completar campos vazios pelo DOI" />
            </div>
          )}
          {p.resumo && (
            <details style={{ marginTop: "0.75rem" }}>
              <summary>Resumo<F c="resumo" /></summary>
              <p>{p.resumo}</p>
            </details>
          )}
        </section>

        <div>
          <section className="cartao">
            <h2 style={{ marginTop: 0 }}>Autoria</h2>
            {p.autores.length === 0 ? (
              <p className="suave">Sem autores cadastrados.</p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: "1.3rem" }}>
                {p.autores.map((a) => (
                  <li key={a.ordem} style={a.eh_principal ? { fontWeight: 700 } : undefined}>
                    {a.nome_exibido}
                    {a.eh_principal ? " (você)" : ""}
                    {a.correspondente ? <span className="selo" style={{ marginLeft: 6 }}>correspondente</span> : null}
                    {a.orcid && <small> · ORCID {a.orcid}</small>}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {p.veiculo_id && (
            <section className="cartao">
              <h2 style={{ marginTop: 0 }}>Métricas da revista</h2>
              {metricas.length === 0 && indexacoes.length === 0 ? (
                <p className="suave">Nenhuma métrica cadastrada. <a href={`/veiculos/${p.veiculo_id}`}>Cadastrar Qualis, JCR, Scopus e indexações</a>.</p>
              ) : (
                <>
                  <ul className="lista-itens">
                    {metricas.map((m) => (
                      <li key={m.id}>
                        <strong>{m.indicador.replace("_", " ")}</strong>: {m.valor}
                        {m.area ? ` · ${m.area}` : ""}
                        {m.periodo ? ` · ${m.periodo}` : ""}{" "}
                        <span className={`selo ${seloClasse(m.selo)}`}>{SELOS[m.selo]}</span>{" "}
                        <small>{m.conferido_em ? `conferido em ${dataBr(m.conferido_em)}` : ""}</small>
                      </li>
                    ))}
                  </ul>
                  {indexacoes.length > 0 && (
                    <p style={{ marginTop: "0.5rem" }}>
                      Indexações:{" "}
                      {indexacoes.map((i) => (
                        <span key={i.id} className={`selo ${i.situacao === "interrompida" ? "vermelho" : seloClasse(i.selo)}`} style={{ marginRight: 4 }}>
                          {i.base}{i.situacao === "interrompida" ? " (interrompida)" : ""}
                        </span>
                      ))}
                    </p>
                  )}
                  <p><a href={`/veiculos/${p.veiculo_id}`}>Ver e atualizar métricas da revista</a></p>
                </>
              )}
            </section>
          )}
        </div>
      </div>

      <section className="cartao">
        <div className="topo" style={{ marginBottom: "0.5rem" }}>
          <h2 style={{ margin: 0 }}>Custos</h2>
          <div className="nao-imprimir">
            <Abrir rotulo="+ Lançamento" titulo="Novo lançamento de custo"><FormLancamento publicacaoId={id} /></Abrir>
          </div>
        </div>
        <p>
          Taxa de submissão: {taxaInfo("Taxa de submissão", p.taxa_submissao_nao_sei)} · Taxa de publicação (APC):{" "}
          {taxaInfo("Taxa de publicação (APC)", p.taxa_publicacao_nao_sei)}
        </p>
        {p.lancamentos.length > 0 && (
          <div className="tabela-rolagem">
            <table>
              <thead>
                <tr><th>Tipo</th><th>Competência</th><th className="num">Valor</th><th className="num">Em R$</th><th className="num">Sua parte</th><th>Pagamento</th><th>Pagador</th><th className="nao-imprimir"></th></tr>
              </thead>
              <tbody>
                {p.lancamentos.map((l) => (
                  <tr key={l.id}>
                    <td>{l.tipo}{l.descricao ? ` — ${l.descricao}` : ""}</td>
                    <td>{competenciaBr(l.competencia)}</td>
                    <td className="num">{l.valor === 0 ? "Gratuito" : `${l.moeda} ${l.valor.toFixed(2).replace(".", ",")}`}</td>
                    <td className="num">{reais(l.valor_brl)}{l.moeda !== "BRL" && l.valor > 0 ? <small title={`PTAX ${l.cotacao} de ${dataBr(l.cotacao_data)}`}> ({l.cotacao_estimada ? "estimada" : "PTAX"})</small> : null}</td>
                    <td className="num">{reais(l.parte_autor_brl)}</td>
                    <td>{l.data_pagamento ? dataBr(l.data_pagamento) : l.valor === 0 ? "—" : <span className="selo amarelo">Pendente{l.data_vencimento ? ` até ${dataBr(l.data_vencimento)}` : ""}</span>}</td>
                    <td>{l.pagador}</td>
                    <td className="nao-imprimir">
                      <span className="acoes">
                        <Abrir rotulo="Editar" titulo="Editar lançamento" classe="secundario pequeno">
                          <FormLancamento
                            publicacaoId={id}
                            inicial={{
                              id: l.id, tipo: l.tipo, descricao: l.descricao ?? "", valor: String(l.valor).replace(".", ","), moeda: l.moeda,
                              competencia: l.competencia, data_pagamento: l.data_pagamento ?? "", data_vencimento: l.data_vencimento ?? "",
                              pagador: l.pagador, parte_autor: l.parte_autor_brl !== l.valor_brl ? String(Math.round((l.parte_autor_brl / (l.cotacao || 1)) * 100) / 100).replace(".", ",") : "",
                            }}
                          />
                        </Abrir>
                        <BotaoAcao url={`/api/custos/${l.id}`} metodo="DELETE" rotulo="Excluir" confirmar="Excluir este lançamento?" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grade grade-2">
        <section className="cartao">
          <h2 style={{ marginTop: 0 }}>Histórico de status</h2>
          <ol style={{ margin: 0, paddingLeft: "1.3rem" }}>
            {p.historico.map((h) => (
              <li key={h.id}>
                <strong>{h.status}</strong> em {dataBr(h.data)}
                {h.rodada ? ` · ${h.rodada}ª rodada` : ""}
                {h.prazo_resposta ? ` · prazo ${dataBr(h.prazo_resposta)}` : ""}
                {h.observacao ? ` · ${h.observacao}` : ""}
              </li>
            ))}
          </ol>
          {p.tentativas.length > 1 && (
            <>
              <h3>Revistas tentadas</h3>
              <ol style={{ margin: 0, paddingLeft: "1.3rem" }}>
                {p.tentativas.map((t) => (
                  <li key={t.id}>{t.nome_veiculo} — {dataBr(t.data_submissao)}{t.desfecho ? ` → ${t.desfecho} em ${dataBr(t.data_desfecho)}` : " (atual)"}</li>
                ))}
              </ol>
            </>
          )}
          {(p.id_submissao || p.link_sistema || p.editor_responsavel || p.prazo_resposta) && (
            <p style={{ marginTop: "0.6rem" }}>
              {p.id_submissao && <>ID na revista: {p.id_submissao}. </>}
              {p.link_sistema && <><a href={p.link_sistema} target="_blank" rel="noreferrer">Sistema da revista</a>. </>}
              {p.editor_responsavel && <>Editor: {p.editor_responsavel}. </>}
              {p.prazo_resposta && <>Prazo de resposta: <strong>{dataBr(p.prazo_resposta)}</strong>.</>}
            </p>
          )}
        </section>
        <section className="cartao">
          <h2 style={{ marginTop: 0 }}>Versões relacionadas</h2>
          <p className="ajuda suave">O mesmo trabalho publicado em outro formato (ex.: resumo em anais e depois artigo). Ficam ligados, não duplicados.</p>
          {p.versoes.length > 0 && (
            <ul className="lista-itens">
              {p.versoes.map((v) => (
                <li key={v.id} className="acoes" style={{ justifyContent: "space-between" }}>
                  <span><a href={`/publicacoes/${v.id}`}>{v.titulo}</a> <small>({v.tipo}{v.ano ? `, ${v.ano}` : ""})</small></span>
                  <BotaoAcao url={`/api/publicacoes/${id}/versoes`} metodo="DELETE" corpo={{ outro_id: v.id }} rotulo="Desligar" />
                </li>
              ))}
            </ul>
          )}
          <VincularVersao id={id} opcoes={outras} />
        </section>
      </div>

      <details className="cartao">
        <summary>Histórico de alterações e origem dos dados</summary>
        <div className="tabela-rolagem" style={{ marginTop: "0.5rem" }}>
          <table>
            <thead><tr><th>Quando</th><th>Campo</th><th>Antes</th><th>Depois</th><th>Origem</th></tr></thead>
            <tbody>
              {p.alteracoes.map((a, i) => (
                <tr key={i}>
                  <td>{dataBr(a.em.slice(0, 10))} {a.em.slice(11, 16)}</td>
                  <td>{a.campo}</td>
                  <td>{a.valor_antigo?.slice(0, 80)}</td>
                  <td>{a.valor_novo?.slice(0, 80)}</td>
                  <td>{a.origem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {p.origens.length > 0 && (
          <>
            <h3>Dados recebidos das fontes</h3>
            <ul>
              {p.origens.map((o, i) => (
                <li key={i}><strong>{o.fonte}</strong> ({dataBr(o.em.slice(0, 10))}) — {ROTULOS[o.campo] ?? o.campo}: {o.valor?.slice(0, 120)}</li>
              ))}
            </ul>
          </>
        )}
        <div className="acoes nao-imprimir" style={{ marginTop: "1rem" }}>
          <BotaoAcao url={`/api/publicacoes/${id}`} metodo="DELETE" rotulo="Excluir esta publicação" classe="perigo pequeno" confirmar="Excluir esta publicação e todos os seus custos e histórico? Não dá para desfazer." depois="/publicacoes" />
        </div>
      </details>
    </>
  );
}
