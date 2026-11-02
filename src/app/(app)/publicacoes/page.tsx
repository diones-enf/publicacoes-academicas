import { areaReferencia, contextoDe, exigirUsuario } from "@/lib/sessao";
import { contarFiltros, filtrosDaUrl, filtrosParaUrl, listarPublicacoes } from "@/lib/filtros";
import { opcoesDeFiltro } from "@/lib/opcoesFiltro";
import { dataBr, reais } from "@/lib/texto";
import { PainelFiltros } from "@/componentes/PainelFiltros";

export default async function Lista({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await exigirUsuario("autor");
  const ctx = contextoDe(u);
  const sp = await searchParams;
  const f = filtrosDaUrl(sp);
  const lista = listarPublicacoes(ctx.donoId, f, areaReferencia(u));
  const secao = f.secao ?? "";
  const semSecao = { ...f, secao: undefined };
  const abas = [
    { v: "publicados", r: "Publicados" },
    { v: "submissoes", r: "Submissões" },
    { v: "encerrados", r: "Encerrados" },
    { v: "", r: "Todas" },
  ];
  return (
    <>
      <div className="topo">
        <h1>Publicações</h1>
        <div className="acoes">
          <a className="botao secundario" href={`/relatorios?${filtrosParaUrl(f)}`}>Relatórios com estes filtros</a>
          <a className="botao" href="/publicacoes/nova">+ Nova</a>
        </div>
      </div>
      <nav className="abas" aria-label="Seções">
        {abas.map((a) => (
          <a key={a.v} href={`/publicacoes?${filtrosParaUrl({ ...semSecao, secao: a.v as never })}`} aria-current={secao === a.v ? "page" : undefined}>
            {a.r}
          </a>
        ))}
        <a href="/submissoes">Quadro de submissões</a>
      </nav>
      <PainelFiltros opcoes={opcoesDeFiltro(ctx.donoId)} base="/publicacoes" valores={sp} />
      <p className="suave">
        {lista.length} item(ns){contarFiltros(f) > 0 ? ` com ${contarFiltros(f)} filtro(s)` : ""}.
      </p>
      <div className="cartao">
        {lista.length === 0 ? (
          <p>Nenhuma publicação encontrada. <a href="/publicacoes/nova">Cadastrar a primeira</a>.</p>
        ) : (
          <ul className="lista-itens">
            {lista.map((p) => (
              <li key={p.id}>
                <a href={`/publicacoes/${p.id}`} className="item-titulo">{p.titulo}</a>
                {p.selo_novo ? <span className="selo verde" style={{ marginLeft: 6 }}>novo</span> : null}
                <div className="meta">
                  <span className="selo azul">{p.status}</span>
                  <span>{p.subtipo ?? p.tipo}</span>
                  {(p.veiculo || p.evento) && <span>{p.veiculo ?? p.evento}</span>}
                  {p.ano && <span>{p.ano}</span>}
                  {p.metricas?.qualis ? <span className="selo verde">Qualis {p.metricas.qualis}{p.metricas.qualis_area ? ` · ${p.metricas.qualis_area}` : ""}</span> : p.tipo_chave === "artigo" ? <span className="selo amarelo">sem Qualis</span> : null}
                  {p.metricas?.jif !== null && p.metricas?.jif !== undefined && <span className="selo">JIF {p.metricas.jif.toString().replace(".", ",")}</span>}
                  {p.metricas?.quartil_jcr && <span className="selo">JCR {p.metricas.quartil_jcr}</span>}
                  {p.papel_autor && <span>{p.papel_autor}{p.posicao ? ` (${p.posicao}º de ${p.total_autores})` : ""}</span>}
                  {p.n_lancamentos > 0 && <span>{p.custo_total === 0 ? "Gratuito" : reais(p.custo_total)}{p.custo_pendente > 0 ? " (pendente)" : ""}</span>}
                  {p.doi ? <span>DOI {p.doi}</span> : <span className="selo amarelo">sem DOI</span>}
                  {p.secao === "submissoes" && p.data_submissao && <span>Submetido em {dataBr(p.data_submissao)}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
