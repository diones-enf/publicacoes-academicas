"use client";
import { useState } from "react";

export function FormLista({ tipo }: { tipo: "qualis" | "jcr" }) {
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setEnviando(true);
    const dados = new FormData(e.currentTarget);
    dados.set("tipo", tipo);
    try {
      const r = await fetch("/api/listas", { method: "POST", body: dados });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro ?? "Erro ao importar.");
      setMsg({ t: "ok", m: j.mensagem });
    } catch (er) {
      setMsg({ t: "erro", m: (er as Error).message });
    } finally {
      setEnviando(false);
    }
  }
  return (
    <form onSubmit={enviar}>
      <div className="grade grade-2">
        <div className="campo">
          <label htmlFor={`arq-${tipo}`}>Arquivo (.xlsx ou .csv)</label>
          <input id={`arq-${tipo}`} name="arquivo" type="file" accept=".xlsx,.csv,.xls" required />
        </div>
        {tipo === "qualis" && (
          <div className="campo">
            <label htmlFor="periodo">Quadriênio da lista</label>
            <select id="periodo" name="periodo" defaultValue="2021-2024">
              <option>2021-2024</option>
              <option>2017-2020</option>
              <option>2013-2016</option>
            </select>
          </div>
        )}
      </div>
      {msg && <div className={`aviso ${msg.t}`} role="status">{msg.m}</div>}
      <button type="submit" disabled={enviando}>{enviando ? "Importando..." : `Importar ${tipo === "qualis" ? "Qualis" : "JCR"}`}</button>
    </form>
  );
}
