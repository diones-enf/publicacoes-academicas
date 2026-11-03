"use client";
import { useState } from "react";
import { api } from "./cliente";

interface Resultado {
  publicacoes: number;
  encontradas: number;
  totalOpenAlex: number;
  totalCrossref: number;
  h: number;
  novas: number;
  avisos: string[];
}

export function BotaoAtualizarCitacoes() {
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  async function atualizar() {
    setOcupado(true);
    setMsg(null);
    try {
      const r = await api<Resultado>("/api/citacoes", "POST");
      setMsg({
        t: r.avisos.length && !r.encontradas ? "erro" : r.avisos.length ? "atencao" : "ok",
        m:
          `${r.encontradas} de ${r.publicacoes} publicação(ões) encontradas no OpenAlex. Citações: ${r.totalOpenAlex} (OpenAlex), ${r.totalCrossref} (Crossref). Índice h: ${r.h}.` +
          (r.novas ? ` ${r.novas} com citação nova.` : "") +
          (r.avisos.length ? ` Avisos: ${r.avisos.join("; ")}` : ""),
      });
      setTimeout(() => window.location.reload(), 3500);
    } catch (e) {
      setMsg({ t: "erro", m: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }
  return (
    <span>
      <button onClick={atualizar} disabled={ocupado}>{ocupado ? "Buscando citações (pode levar 1 a 2 minutos)..." : "Atualizar citações agora"}</button>
      {msg && <div className={`aviso ${msg.t}`} role="status">{msg.m}</div>}
    </span>
  );
}

export function FormCitacaoManual({ publicacaoId, atual, fonte = "Google Acadêmico" }: { publicacaoId: number; atual: number | null; fonte?: string }) {
  const [total, setTotal] = useState(atual === null ? "" : String(atual));
  const [erro, setErro] = useState("");
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/citacoes/manual", "POST", { publicacao_id: publicacaoId, total, fonte });
      window.location.reload();
    } catch (er) {
      setErro((er as Error).message);
    }
  }
  return (
    <form onSubmit={salvar} className="acoes" style={{ flexWrap: "nowrap", maxWidth: 440 }}>
      <label htmlFor={`cit-${fonte}-${publicacaoId}`} style={{ whiteSpace: "nowrap", margin: 0, minWidth: 130 }}>{fonte}:</label>
      <input id={`cit-${fonte}-${publicacaoId}`} inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value.replace(/\D/g, ""))} placeholder="nº de citações" style={{ width: 130 }} />
      <button type="submit" className="secundario pequeno">Salvar</button>
      {erro && <span className="aviso erro">{erro}</span>}
    </form>
  );
}
