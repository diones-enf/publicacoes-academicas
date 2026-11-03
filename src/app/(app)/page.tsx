import { redirect } from "next/navigation";
import { exigirUsuario, contextoDe } from "@/lib/sessao";
import { dadosPainel } from "@/lib/painel";
import { competenciaBr, dataBr, reais } from "@/lib/texto";
import { BotaoAcao } from "@/componentes/Acoes";
import { AtualizarSistema } from "@/componentes/AtualizarSistema";
import { possiveisDuplicatas } from "@/lib/filtros";
import { temDadosExemplo } from "@/lib/exemplo";
import { um } from "@/lib/db";

export default async function Painel() {
  const u = await exigirUsuario();
  if (u.perfil !== "autor") redirect("/relatorios");
  const { donoId } = contextoDe(u);
  const d = dadosPainel(donoId);
  const vazio = !um("SELECT 1 FROM publicacao WHERE dono_id = ? LIMIT 1", donoId);
  const exemplo = temDadosExemplo(donoId);
  const duplicatas = possiveisDuplicatas(donoId).length;
  const semRevista =
    um<{ n: number }>(
      "SELECT COUNT(*) n FROM publicacao p JOIN tipo_publicacao t ON t.id = p.tipo_id WHERE p.dono_id = ? AND p.veiculo_id IS NULL AND t.chave IN ('artigo','jornal')",
      donoId,
    )?.n ?? 0;
  const cartoes = [
    { rotulo: "Total publicado", valor: String(d.publicados), ajuda: `${d.publicados_ano} neste ano`, link: "/publicacoes?secao=publicados" },
    { rotulo: "Aceitos (aguardando publicação)", valor: String(d.aceitos), link: "/submissoes" },
    { rotulo: "Em avaliação", valor: String(d.em_avaliacao), ajuda: `${d.em_elaboracao} em elaboração`, link: "/submissoes" },
    { rotulo: "Gasto no ano", valor: reais(d.gasto_ano), ajuda: `${reais(d.gasto_mes)} neste mês`, link: "/custos" },
  ];
  return (
    <>
      <div className="topo">
        <h1>Olá, {u.nome.split(" ")[0]}</h1>
        <a className="botao" href="/publicacoes/nova">+ Nova publicação</a>
      </div>
      <AtualizarSistema compacto />
      {vazio && (
        <div className="aviso info">
          Ainda não há publicações. Comece por <a href="/publicacoes/nova">+ Nova publicação</a> (cole um DOI e o sistema preenche o resto) ou{" "}
          <BotaoAcao url="/api/exemplo" rotulo="carregue dados de exemplo" classe="link" /> para conhecer o sistema.
        </div>
      )}
      {exemplo && (
        <div className="aviso atencao">
          Há dados de exemplo no sistema (marcados com [EXEMPLO]).{" "}
          <BotaoAcao url="/api/exemplo" metodo="DELETE" rotulo="Apagar dados de exemplo" confirmar="Apagar todas as publicações de exemplo?" />
        </div>
      )}
      {semRevista > 0 && (
        <div className="aviso atencao">
          {semRevista} artigo(s) estão sem revista ligada e por isso não recebem Qualis, JCR nem Scopus.{" "}
          <a href="/publicacoes?secao=&qualidade=sem_revista">Ver e corrigir</a>
        </div>
      )}
      {duplicatas > 0 && (
        <div className="aviso atencao">
          {duplicatas} possível(is) duplicata(s) para conferir. <a href="/duplicatas">Resolver</a>
        </div>
      )}
      <div className="grade grade-4">
        {cartoes.map((c) => (
          <a key={c.rotulo} href={c.link} className="cartao indicador" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="rotulo">{c.rotulo}</div>
            <div className="numero">{c.valor}</div>
            {c.ajuda && <small>{c.ajuda}</small>}
          </a>
        ))}
      </div>

      {d.lembretes.length > 0 && (
        <section className="cartao">
          <h2 style={{ marginTop: 0 }}>Lembretes</h2>
          <ul className="lista-itens">
            {d.lembretes.map((l) => (
              <li key={l.id} className="acoes" style={{ justifyContent: "space-between" }}>
                <span>
                  <span className={`selo ${l.tipo === "sem_movimentacao" ? "amarelo" : "vermelho"}`}>
                    {l.tipo === "prazo_resposta" ? "Prazo" : l.tipo === "pagamento" ? "Pagamento" : "Parado"}
                  </span>{" "}
                  {l.publicacao_id ? <a href={`/publicacoes/${l.publicacao_id}`}>{l.mensagem}</a> : l.mensagem}
                </span>
                <BotaoAcao url={`/api/lembretes/${l.id}`} rotulo="Marcar como visto" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grade grade-2">
        <section className="cartao">
          <h2 style={{ marginTop: 0 }}>Próximos pagamentos</h2>
          {d.proximos_pagamentos.length === 0 ? (
            <p className="suave">Nenhuma taxa pendente. Pendente total: {reais(d.pendente)}</p>
          ) : (
            <ul className="lista-itens">
              {d.proximos_pagamentos.map((l) => (
                <li key={l.id}>
                  <div className="item-titulo">{reais(l.parte_autor_brl)} — {l.tipo}</div>
                  <div className="meta">
                    <span>{l.data_vencimento ? `Vence em ${dataBr(l.data_vencimento)}` : `Competência ${competenciaBr(l.competencia)}`}</span>
                    {l.publicacao_id && <a href={`/publicacoes/${l.publicacao_id}`}>{l.titulo}</a>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="cartao">
          <h2 style={{ marginTop: 0 }}>Próximos prazos de resposta</h2>
          {d.proximos_prazos.length === 0 ? (
            <p className="suave">Nenhum prazo cadastrado.</p>
          ) : (
            <ul className="lista-itens">
              {d.proximos_prazos.map((p) => (
                <li key={p.id}>
                  <a href={`/publicacoes/${p.id}`} className="item-titulo">{p.titulo}</a>
                  <div className="meta"><span>{p.status}</span><span>Prazo: {dataBr(p.prazo_resposta)}</span></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {d.novos.length > 0 && (
        <section className="cartao">
          <h2 style={{ marginTop: 0 }}>Recém-publicados <span className="selo verde">novo</span></h2>
          <ul className="lista-itens">
            {d.novos.map((p) => <li key={p.id}><a href={`/publicacoes/${p.id}`}>{p.titulo}</a></li>)}
          </ul>
        </section>
      )}
    </>
  );
}
