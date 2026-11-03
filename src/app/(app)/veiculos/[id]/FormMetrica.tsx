"use client";
import { useState } from "react";
import { api } from "@/componentes/cliente";
import { AREAS_QUALIS_COMUNS, BASES_INDEXACAO, ESTRATOS_QUALIS, INDICADORES, SELOS } from "@/lib/constantes";

export function FormMetrica({ veiculoId, areaPadrao, indicadorInicial = "QUALIS" }: { veiculoId: number; areaPadrao: string | null; indicadorInicial?: string }) {
  const [d, setD] = useState({
    indicador: indicadorInicial,
    valor: "",
    area: indicadorInicial === "QUALIS" ? (areaPadrao ?? "") : "",
    periodo: indicadorInicial === "QUALIS" ? "2021-2024" : String(new Date().getFullYear() - 1),
    selo: "confirmado_oficial",
    fonte: "",
    conferido_em: "",
  });
  const [erro, setErro] = useState("");
  const m = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value });
  const qualis = d.indicador === "QUALIS";
  const quartil = d.indicador.startsWith("QUARTIL");
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/veiculos/${veiculoId}/metricas`, "POST", d);
      window.location.reload();
    } catch (e) {
      setErro((e as Error).message);
    }
  }
  return (
    <form onSubmit={salvar}>
      <div className="grade grade-2">
        <div className="campo">
          <label htmlFor="m-ind">Indicador</label>
          <select id="m-ind" value={d.indicador} onChange={(e) => setD({ ...d, indicador: e.target.value, periodo: e.target.value === "QUALIS" ? "2021-2024" : String(new Date().getFullYear() - 1), valor: "" })}>
            {INDICADORES.map((i) => <option key={i.chave} value={i.chave}>{i.nome}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="m-valor">Valor</label>
          {qualis || quartil ? (
            <select id="m-valor" value={d.valor} onChange={m("valor")} required>
              <option value="">—</option>
              {(qualis ? ESTRATOS_QUALIS : ["Q1", "Q2", "Q3", "Q4"]).map((x) => <option key={x}>{x}</option>)}
            </select>
          ) : (
            <input id="m-valor" value={d.valor} onChange={m("valor")} required placeholder={d.indicador === "POSICAO_JCR" ? "255/300" : d.indicador === "COLECAO_WOS" ? "SCIE" : "1,234"} />
          )}
        </div>
        <div className="campo">
          <label htmlFor="m-area">{qualis ? "Área de avaliação" : "Categoria / área (opcional)"}</label>
          <input id="m-area" list="areas-qualis" value={d.area} onChange={m("area")} required={qualis} />
          <datalist id="areas-qualis">{AREAS_QUALIS_COMUNS.map((a) => <option key={a} value={a} />)}</datalist>
        </div>
        <div className="campo">
          <label htmlFor="m-periodo">{qualis ? "Quadriênio" : "Ano do relatório"}</label>
          <input id="m-periodo" value={d.periodo} onChange={m("periodo")} />
        </div>
        <div className="campo">
          <label htmlFor="m-selo">Selo de confiança</label>
          <select id="m-selo" value={d.selo} onChange={m("selo")}>{Object.entries(SELOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div className="campo">
          <label htmlFor="m-fonte">Fonte</label>
          <input id="m-fonte" value={d.fonte} onChange={m("fonte")} placeholder={qualis ? "Sucupira" : "JCR/Clarivate, Scopus..."} />
        </div>
      </div>
      {d.indicador === "JIF" && <p className="ajuda suave">Lembrete: revistas só da ESCI têm JIF a partir do JCR 2023. Estar no WoS não é o mesmo que ter JCR.</p>}
      {erro && <div className="aviso erro">{erro}</div>}
      <button type="submit">Salvar métrica</button>
    </form>
  );
}

export function FormIndexacao({ veiculoId, baseInicial = "SciELO" }: { veiculoId: number; baseInicial?: string }) {
  const [d, setD] = useState({ base: baseInicial, situacao: "ativa", selo: "confirmado_oficial", fonte: "" });
  const [erro, setErro] = useState("");
  const m = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value });
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/veiculos/${veiculoId}/indexacoes`, "POST", d);
      window.location.reload();
    } catch (e) {
      setErro((e as Error).message);
    }
  }
  return (
    <form onSubmit={salvar}>
      <div className="grade grade-2">
        <div className="campo">
          <label htmlFor="i-base">Base</label>
          <input id="i-base" list="bases" value={d.base} onChange={m("base")} required />
          <datalist id="bases">{BASES_INDEXACAO.map((b) => <option key={b} value={b} />)}</datalist>
        </div>
        <div className="campo">
          <label htmlFor="i-sit">Situação</label>
          <select id="i-sit" value={d.situacao} onChange={m("situacao")}><option value="ativa">Ativa</option><option value="interrompida">Interrompida</option></select>
        </div>
        <div className="campo">
          <label htmlFor="i-selo">Selo de confiança</label>
          <select id="i-selo" value={d.selo} onChange={m("selo")}>{Object.entries(SELOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div className="campo"><label htmlFor="i-fonte">Fonte</label><input id="i-fonte" value={d.fonte} onChange={m("fonte")} /></div>
      </div>
      {erro && <div className="aviso erro">{erro}</div>}
      <button type="submit">Salvar indexação</button>
    </form>
  );
}
