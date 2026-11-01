"use client";
import { useState } from "react";
import { api } from "./cliente";
import { BASES_INDEXACAO, ESTRATOS_QUALIS, IDIOMAS, PAGADORES, PAPEIS_AUTOR, STATUS } from "@/lib/constantes";

interface Opcoes {
  tipos: { id: number; nome: string; subtipos: { id: number; nome: string }[] }[];
  veiculos: { id: number; nome: string }[];
  coautores: { id: number; nome: string }[];
  areas: string[];
  visoes: { id: number; nome: string; filtros: string }[];
}

/** Filtros combináveis. Ficam na URL, então valem para a lista e para os relatórios, e podem ser salvos como visões. */
export function PainelFiltros({
  opcoes,
  base,
  valores,
  ocultar = [],
}: {
  opcoes: Opcoes;
  base: string;
  valores: Record<string, string>;
  ocultar?: string[];
}) {
  const [f, setF] = useState<Record<string, string>>(valores);
  const [aberto, setAberto] = useState(() => Object.keys(valores).some((k) => !["secao", "q", "estilo", "criterio", "mes_de", "mes_ate"].includes(k)));
  const v = (k: string) => f[k] ?? "";
  const m = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const qualis = (f.qualis ?? "").split(",").filter(Boolean);
  const tipo = opcoes.tipos.find((t) => String(t.id) === f.tipo_id);

  function aplicar(e?: React.FormEvent) {
    e?.preventDefault();
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries(f)) if (val) p.set(k, val);
    window.location.href = `${base}?${p.toString()}`;
  }
  function limpar() {
    const manter = ["secao", "estilo", "criterio"];
    const p = new URLSearchParams();
    for (const k of manter) if (f[k]) p.set(k, f[k]);
    window.location.href = `${base}?${p.toString()}`;
  }
  async function salvarVisao() {
    const nome = window.prompt("Nome da visão (ex.: Artigos A1-A2 de 2025):");
    if (!nome) return;
    const p = new URLSearchParams();
    for (const [k, val] of Object.entries(f)) if (val) p.set(k, val);
    await api("/api/visoes", "POST", { nome, filtros: p.toString() });
    window.location.reload();
  }
  const sel = (k: string, rotulo: string, itens: (string | { v: string; r: string })[]) =>
    ocultar.includes(k) ? null : (
      <div className="campo">
        <label htmlFor={`f-${k}`}>{rotulo}</label>
        <select id={`f-${k}`} value={v(k)} onChange={m(k)}>
          <option value="">Todos</option>
          {itens.map((i) => (typeof i === "string" ? <option key={i}>{i}</option> : <option key={i.v} value={i.v}>{i.r}</option>))}
        </select>
      </div>
    );
  const txt = (k: string, rotulo: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) =>
    ocultar.includes(k) ? null : (
      <div className="campo">
        <label htmlFor={`f-${k}`}>{rotulo}</label>
        <input id={`f-${k}`} value={v(k)} onChange={m(k)} {...extra} />
      </div>
    );
  const anoAtual = new Date().getFullYear();
  const anos = Array.from({ length: 15 }, (_, i) => String(anoAtual + 1 - i));

  return (
    <form className="cartao filtros nao-imprimir" onSubmit={aplicar}>
      <div className="acoes" style={{ flexWrap: "nowrap" }}>
        <label htmlFor="f-q" className="pular-para-conteudo">Busca livre</label>
        <input id="f-q" placeholder="Buscar em título, autores, revista, DOI, ISBN e observações" value={v("q")} onChange={m("q")} />
        <button type="submit">Buscar</button>
      </div>
      <div className="acoes" style={{ marginTop: "0.5rem" }}>
        <button type="button" className="link" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
          {aberto ? "Esconder filtros" : "Mais filtros"}
        </button>
        {opcoes.visoes.length > 0 && (
          <span className="acoes">
            <span className="suave">Visões salvas:</span>
            {opcoes.visoes.map((vs) => (
              <span key={vs.id} className="selo azul">
                <a href={`${base}?${vs.filtros}`}>{vs.nome}</a>{" "}
                <button
                  type="button"
                  className="link"
                  aria-label={`Apagar visão ${vs.nome}`}
                  onClick={async () => {
                    if (!window.confirm(`Apagar a visão "${vs.nome}"?`)) return;
                    await api(`/api/visoes/${vs.id}`, "DELETE");
                    window.location.reload();
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
          </span>
        )}
      </div>
      {aberto && (
        <>
          <h3>Datas</h3>
          <div className="grade grade-4">
            {sel("data_campo", "Qual data usar", [{ v: "publicacao", r: "Publicação" }, { v: "submissao", r: "Submissão" }, { v: "aceite", r: "Aceite" }])}
            {txt("de", "De", { type: "date" })}
            {txt("ate", "Até", { type: "date" })}
            {sel("ano", "Ano", anos)}
            {sel("quadrienio", "Quadriênio CAPES", ["2025-2028", "2021-2024", "2017-2020", "2013-2016"])}
            {sel("semestre", "Semestre", anos.flatMap((a) => [`${a}-2`, `${a}-1`]).map((s) => ({ v: s, r: `${s.slice(5)}º/${s.slice(0, 4)}` })))}
            {txt("competencia", "Competência de custo", { type: "month" })}
          </div>
          <h3>Publicação</h3>
          <div className="grade grade-4">
            {sel("tipo_id", "Tipo", opcoes.tipos.map((t) => ({ v: String(t.id), r: t.nome })))}
            {tipo && sel("subtipo_id", "Subtipo", tipo.subtipos.map((s) => ({ v: String(s.id), r: s.nome })))}
            {sel("status", "Status", [...STATUS])}
            {sel("idioma", "Idioma", IDIOMAS)}
            {txt("area_tematica", "Área temática")}
            {txt("palavra_chave", "Palavra-chave")}
          </div>
          <h3>Veículo</h3>
          <div className="grade grade-4">
            {sel("veiculo_id", "Revista / veículo", opcoes.veiculos.map((x) => ({ v: String(x.id), r: x.nome })))}
            {txt("editora", "Editora")}
            {txt("evento", "Evento")}
            {txt("pais", "País")}
          </div>
          <h3>Qualis, JCR e indexação</h3>
          <div className="campo">
            <span className="suave" style={{ fontSize: "0.9rem", fontWeight: 600 }}>Estrato Qualis</span>
            <div className="acoes">
              {ESTRATOS_QUALIS.map((e) => (
                <label key={e} className="inline">
                  <input
                    type="checkbox"
                    checked={qualis.includes(e)}
                    onChange={(ev) => setF({ ...f, qualis: (ev.target.checked ? [...qualis, e] : qualis.filter((x) => x !== e)).join(",") })}
                  />
                  {e}
                </label>
              ))}
            </div>
          </div>
          <div className="grade grade-4">
            {sel("qualis_area", "Área de avaliação", opcoes.areas)}
            {sel("qualis_quadrienio", "Quadriênio do Qualis", ["2021-2024", "2017-2020", "2013-2016"])}
            {sel("indexacao", "Indexação", BASES_INDEXACAO)}
            {sel("com_jcr", "JCR", [{ v: "sim", r: "Com JCR" }, { v: "nao", r: "Sem JCR" }])}
            {sel("quartil_jcr", "Quartil JCR", ["Q1", "Q2", "Q3", "Q4"])}
            {sel("quartil_scopus", "Quartil Scopus", ["Q1", "Q2", "Q3", "Q4"])}
            {txt("jif_min", "JIF mínimo", { inputMode: "decimal" })}
            {txt("jif_max", "JIF máximo", { inputMode: "decimal" })}
          </div>
          <h3>Autoria</h3>
          <div className="grade grade-4">
            {sel("papel", "Seu papel", [...PAPEIS_AUTOR])}
            {txt("posicao", "Sua posição na lista", { inputMode: "numeric" })}
            {sel("coautor_id", "Coautor", opcoes.coautores.map((c) => ({ v: String(c.id), r: c.nome })))}
            {txt("instituicao", "Instituição do coautor")}
          </div>
          <h3>Custos e qualidade dos dados</h3>
          <div className="grade grade-4">
            {sel("custo", "Custo", [{ v: "gratuito", r: "Gratuito (R$ 0)" }, { v: "com_custo", r: "Com custo" }])}
            {txt("valor_min", "Valor mínimo (R$)", { inputMode: "decimal" })}
            {txt("valor_max", "Valor máximo (R$)", { inputMode: "decimal" })}
            {sel("pagador", "Pagador", PAGADORES)}
            {sel("situacao_custo", "Pagamento", [{ v: "pago", r: "Pago" }, { v: "pendente", r: "Pendente" }])}
            {sel("qualidade", "Qualidade dos dados", [
              { v: "sem_doi", r: "Sem DOI" },
              { v: "sem_qualis", r: "Artigo sem Qualis" },
              { v: "nao_confirmada", r: "Métrica não confirmada" },
              { v: "possivel_duplicata", r: "Possível duplicata" },
              { v: "conferido_12m", r: "Conferido há mais de 12 meses" },
              { v: "sem_autor_principal", r: "Autor principal não identificado" },
            ])}
          </div>
          <div className="acoes">
            <button type="submit">Aplicar filtros</button>
            <button type="button" className="secundario" onClick={limpar}>Limpar</button>
            <button type="button" className="secundario" onClick={salvarVisao}>Salvar como visão</button>
          </div>
        </>
      )}
    </form>
  );
}
