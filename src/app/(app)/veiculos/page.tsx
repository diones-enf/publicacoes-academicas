import { contextoDe, exigirUsuario } from "@/lib/sessao";
import { listarVeiculos, resumoMetricas } from "@/lib/veiculos";
import { dataBr } from "@/lib/texto";
import { Abrir } from "@/componentes/Painelzinho";
import { FormVeiculo } from "./FormVeiculo";
import { BuscarMetricas } from "./BuscarMetricas";

/** Valor da métrica, ou "—" que leva à página da revista para inserir. */
function celula(id: number, valor: number | string | null | undefined) {
  if (valor === null || valor === undefined || valor === "")
    return <a href={`/veiculos/${id}`} title="Não informado: clique para inserir" style={{ textDecoration: "none" }}>—</a>;
  return String(valor).replace(".", ",");
}

export default async function Veiculos() {
  const u = await exigirUsuario("autor");
  const { donoId } = contextoDe(u);
  const lista = listarVeiculos(donoId);
  const resumo = resumoMetricas(lista.map((v) => v.id), u.area_qualis_ref);
  const limite = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  return (
    <>
      <div className="topo">
        <h1>Revistas e veículos</h1>
        <div className="acoes">
          <BuscarMetricas url="/api/veiculos/metricas-auto" rotulo="Buscar métricas de todas as revistas" classe="secundario" />
          <a className="botao secundario" href="/veiculos/importar">Importar Qualis e JCR</a>
          <Abrir rotulo="+ Novo veículo" titulo="Novo veículo" classe=""><FormVeiculo /></Abrir>
        </div>
      </div>
      <p className="suave">
        As métricas pertencem à revista: ao atualizar o JIF ou o Qualis aqui, todos os artigos publicados nela são atualizados juntos.
        {u.area_qualis_ref ? ` Área Qualis de referência: ${u.area_qualis_ref}.` : " Defina sua área Qualis de referência em Configurações."}
      </p>
      <div className="cartao tabela-rolagem">
        <table>
          <thead>
            <tr><th>Nome</th><th>Tipo</th><th>ISSN / e-ISSN</th><th>Qualis</th><th>JIF</th><th>Quartil JCR</th><th>SJR</th><th>Quartil Scopus</th><th title="Impacto médio de 2 anos (OpenAlex), parecido com o JIF">Impacto OA</th><th>Indexações</th><th>Conferido</th><th className="num">Publicações</th></tr>
          </thead>
          <tbody>
            {lista.map((v) => {
              const r = resumo.get(v.id);
              const velho = !r?.conferido_em || r.conferido_em < limite;
              return (
                <tr key={v.id}>
                  <td><a href={`/veiculos/${v.id}`}>{v.nome}</a></td>
                  <td>{v.tipo}</td>
                  <td>{[v.issn, v.eissn].filter(Boolean).join(" / ")}</td>
                  <td>{celula(v.id, r?.qualis ? `${r.qualis}${r.qualis_area ? ` (${r.qualis_area})` : ""}` : null)}</td>
                  <td>{celula(v.id, r?.jif)}</td>
                  <td>{celula(v.id, r?.quartil_jcr)}</td>
                  <td>{celula(v.id, r?.sjr)}</td>
                  <td>{celula(v.id, r?.quartil_scopus)}</td>
                  <td>{celula(v.id, r?.impacto2a)}</td>
                  <td>{r?.indexacoes.join(", ") || "—"}</td>
                  <td>{r?.conferido_em ? <span className={velho ? "selo amarelo" : ""}>{dataBr(r.conferido_em)}</span> : "—"}</td>
                  <td className="num">{v.publicacoes}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lista.length === 0 && <p>Nenhum veículo ainda. Eles são criados sozinhos ao cadastrar publicações.</p>}
      </div>
    </>
  );
}
