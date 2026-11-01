"use client";
import { useState } from "react";
import { api } from "@/componentes/cliente";
import { TIPOS_VEICULO } from "@/lib/constantes";

interface V { id?: number; nome: string; tipo: string; issn: string; eissn: string; editora: string; pais: string; site: string }

export function FormVeiculo({ inicial }: { inicial?: V }) {
  const [v, setV] = useState<V>(inicial ?? { nome: "", tipo: "revista", issn: "", eissn: "", editora: "", pais: "", site: "" });
  const [erro, setErro] = useState("");
  const m = (k: keyof V) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = v.id ? await api<{ id: number }>(`/api/veiculos/${v.id}`, "PUT", v) : await api<{ id: number }>("/api/veiculos", "POST", v);
      window.location.href = `/veiculos/${r.id}`;
    } catch (e) {
      setErro((e as Error).message);
    }
  }
  return (
    <form onSubmit={salvar}>
      <div className="campo"><label htmlFor="v-nome">Nome</label><input id="v-nome" value={v.nome} onChange={m("nome")} required /></div>
      <div className="grade grade-2">
        <div className="campo">
          <label htmlFor="v-tipo">Tipo</label>
          <select id="v-tipo" value={v.tipo} onChange={m("tipo")}>{TIPOS_VEICULO.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
        <div className="campo"><label htmlFor="v-editora">Editora</label><input id="v-editora" value={v.editora} onChange={m("editora")} /></div>
        <div className="campo"><label htmlFor="v-issn">ISSN impresso</label><input id="v-issn" value={v.issn} onChange={m("issn")} placeholder="0000-0000" /></div>
        <div className="campo"><label htmlFor="v-eissn">e-ISSN</label><input id="v-eissn" value={v.eissn} onChange={m("eissn")} placeholder="0000-0000" /></div>
        <div className="campo"><label htmlFor="v-pais">País</label><input id="v-pais" value={v.pais} onChange={m("pais")} /></div>
        <div className="campo"><label htmlFor="v-site">Site</label><input id="v-site" value={v.site} onChange={m("site")} /></div>
      </div>
      {erro && <div className="aviso erro">{erro}</div>}
      <button type="submit">Salvar</button>
    </form>
  );
}
