import { contextoDe, exigirUsuario } from "@/lib/sessao";
import { rankingCoautores, redeColaboracao, sugestoesDeFusao } from "@/lib/coautores";
import { BotaoAcao } from "@/componentes/Acoes";
import { RedeColaboracao } from "@/componentes/Graficos";

export default async function Coautores() {
  const u = await exigirUsuario("autor");
  const { donoId } = contextoDe(u);
  const ranking = rankingCoautores(donoId);
  const sugestoes = sugestoesDeFusao(donoId);
  const rede = redeColaboracao(donoId);
  return (
    <>
      <div className="topo">
        <h1>Coautores</h1>
        <a className="botao secundario" href="/relatorios/coautores">Relatório de coautores</a>
      </div>
      {sugestoes.length > 0 && (
        <section className="cartao">
          <h2 style={{ marginTop: 0 }}>Parecem ser a mesma pessoa ({sugestoes.length})</h2>
          <p className="suave">Confirme para somar os trabalhos no ranking. A grafia que sai fica guardada como variação.</p>
          <ul className="lista-itens">
            {sugestoes.map((s) => (
              <li key={`${s.a.id}-${s.b.id}`}>
                <div><strong>{s.a.nome}</strong>{s.a.orcid ? ` (${s.a.orcid})` : ""} × <strong>{s.b.nome}</strong>{s.b.orcid ? ` (${s.b.orcid})` : ""}</div>
                <div className="meta"><span>{s.motivo}</span></div>
                <div className="acoes" style={{ marginTop: 4 }}>
                  <BotaoAcao url="/api/coautores" corpo={{ acao: "fundir", manter: s.a.id, remover: s.b.id }} rotulo={`Juntar, manter "${s.a.nome}"`} classe="pequeno" />
                  <BotaoAcao url="/api/coautores" corpo={{ acao: "fundir", manter: s.b.id, remover: s.a.id }} rotulo={`Juntar, manter "${s.b.nome}"`} />
                  <BotaoAcao url="/api/coautores" corpo={{ acao: "nao_fundir", manter: s.a.id, remover: s.b.id }} rotulo="São pessoas diferentes" />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="cartao tabela-rolagem">
        <h2 style={{ marginTop: 0 }}>Ranking</h2>
        <table>
          <thead><tr><th>#</th><th>Coautor</th><th className="num">Trabalhos</th><th>Tipos</th><th>Período</th><th>Instituição</th><th>ORCID</th><th>Outras grafias</th></tr></thead>
          <tbody>
            {ranking.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td><a href={`/publicacoes?secao=&coautor_id=${r.id}`}>{r.nome}</a></td>
                <td className="num">{r.trabalhos}</td>
                <td>{r.tipos}</td>
                <td>{r.primeiro_ano}{r.ultimo_ano && r.ultimo_ano !== r.primeiro_ano ? `–${r.ultimo_ano}` : ""}</td>
                <td>{r.instituicao}</td>
                <td>{r.orcid}</td>
                <td>{r.variacoes}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ranking.length === 0 && <p className="suave">Nenhum coautor ainda.</p>}
      </section>
      <section className="cartao"><RedeColaboracao nos={rede.nos} arestas={rede.arestas} /></section>
    </>
  );
}
