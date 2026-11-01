import { contextoDe, exigirUsuario } from "@/lib/sessao";
import { RELATORIOS } from "@/lib/relatorios";
import { contarFiltros, filtrosDaUrl } from "@/lib/filtros";
import { opcoesDeFiltro } from "@/lib/opcoesFiltro";
import { PainelFiltros } from "@/componentes/PainelFiltros";

export default async function Relatorios({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const u = await exigirUsuario();
  const { donoId } = contextoDe(u);
  const sp = await searchParams;
  const qs = new URLSearchParams(sp).toString();
  const n = contarFiltros(filtrosDaUrl(sp));
  return (
    <>
      <h1>Relatórios</h1>
      <p className="suave">Todos os relatórios respeitam os filtros abaixo e podem ser exportados em PDF, XLSX e CSV.</p>
      <PainelFiltros opcoes={opcoesDeFiltro(donoId)} base="/relatorios" valores={sp} />
      {n > 0 && <div className="aviso info">{n} filtro(s) ativo(s): valem para o relatório que você abrir.</div>}
      <div className="grade grade-3">
        {RELATORIOS.map((r) => (
          <a key={r.chave} href={`/relatorios/${r.chave}${qs ? `?${qs}` : ""}`} className="cartao" style={{ textDecoration: "none", color: "inherit" }}>
            <h2 style={{ marginTop: 0, color: "var(--primaria)" }}>{r.titulo}</h2>
            <p className="suave">{r.descricao}</p>
          </a>
        ))}
      </div>
    </>
  );
}
