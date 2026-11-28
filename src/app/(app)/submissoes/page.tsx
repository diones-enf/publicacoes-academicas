import { areaReferencia, contextoDe, exigirUsuario } from "@/lib/sessao";
import { listarPublicacoes } from "@/lib/filtros";
import { dataBr } from "@/lib/texto";
import { Quadro } from "./Quadro";
import { contarAnexos } from "@/lib/anexos";
import { todos } from "@/lib/db";
import { Abrir } from "@/componentes/Painelzinho";
import { LerDocumento } from "@/componentes/LerDocumento";

export default async function Submissoes({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await exigirUsuario("autor");
  const ctx = contextoDe(u);
  const sp = await searchParams;
  const area = areaReferencia(u);
  const andamento = listarPublicacoes(ctx.donoId, { secao: "submissoes", q: sp.q }, area);
  const encerrados = listarPublicacoes(ctx.donoId, { secao: "encerrados" }, area);
  const anexos = contarAnexos(ctx.donoId);
  const todas = todos<{ id: number; titulo: string; status: string }>(
    "SELECT id, titulo, status FROM publicacao WHERE dono_id = ? ORDER BY ultima_movimentacao DESC, id DESC",
    ctx.donoId,
  );
  return (
    <>
      <div className="topo">
        <h1>Submissões em andamento</h1>
        <div className="acoes">
          <Abrir rotulo="📄 Ler e-mail ou declaração" titulo="Ler e-mail, declaração ou carta da revista" classe="">
            <LerDocumento publicacoes={todas} />
          </Abrir>
          <a className="botao secundario" href="/relatorios/submissoes">Relatório de submissões</a>
          <a className="botao" href="/publicacoes/nova">+ Nova</a>
        </div>
      </div>
      <p className="suave">Arraste os cartões entre as colunas ou use &quot;Mover para&quot;. Cada mudança fica registrada com a data. Use <strong>📎 Anexos</strong> para guardar manuscrito, pareceres, carta de aceite e comprovantes.</p>
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
          anexos: anexos.get(p.id) ?? 0,
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
