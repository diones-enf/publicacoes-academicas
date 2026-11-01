import { areaReferencia, contextoDe, exigirUsuario } from "@/lib/sessao";
import { listarPublicacoes } from "@/lib/filtros";
import { dataBr } from "@/lib/texto";
import { Quadro } from "./Quadro";

export default async function Submissoes({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await exigirUsuario("autor");
  const ctx = contextoDe(u);
  const sp = await searchParams;
  const area = areaReferencia(u);
  const andamento = listarPublicacoes(ctx.donoId, { secao: "submissoes", q: sp.q }, area);
  const encerrados = listarPublicacoes(ctx.donoId, { secao: "encerrados" }, area);
  return (
    <>
      <div className="topo">
        <h1>Submissões em andamento</h1>
        <div className="acoes">
          <a className="botao secundario" href="/relatorios/submissoes">Relatório de submissões</a>
          <a className="botao" href="/publicacoes/nova">+ Nova</a>
        </div>
      </div>
      <p className="suave">Arraste os cartões entre as colunas ou use &quot;Mover para&quot;. Cada mudança fica registrada com a data.</p>
      <Quadro
        limiteDias={u.dias_sem_movimentacao}
        cartoes={andamento.map((p) => ({
          id: p.id,
          titulo: p.titulo,
          veiculo: p.veiculo ?? p.evento,
          status: p.status,
          data_submissao: p.data_submissao,
          dias_parado: p.dias_parado,
          prazo_resposta: p.prazo_resposta,
          rodada_revisao: p.rodada_revisao,
          doi: p.doi,
        }))}
      />
      <h2 id="encerrados">Encerrados ({encerrados.length})</h2>
      <div className="cartao">
        {encerrados.length === 0 ? (
          <p className="suave">Nenhum item recusado ou retirado.</p>
        ) : (
          <ul className="lista-itens">
            {encerrados.map((p) => (
              <li key={p.id}>
                <a href={`/publicacoes/${p.id}`} className="item-titulo">{p.titulo}</a>
                <div className="meta">
                  <span className="selo vermelho">{p.status}</span>
                  {p.veiculo && <span>{p.veiculo}</span>}
                  {p.ultima_movimentacao && <span>em {dataBr(p.ultima_movimentacao)}</span>}
                  <a href={`/publicacoes/${p.id}`}>Reaproveitar para nova submissão</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
