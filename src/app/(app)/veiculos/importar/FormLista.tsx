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
            <label htmlFor="area-qualis">Área de avaliação</label>
            <input id="area-qualis" name="area" defaultValue="Enfermagem" />
            <div className="ajuda">Usada quando a planilha não tem a coluna de área (exportação do Sucupira).</div>
          </div>
        )}
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

export function FormColar() {
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setEnviando(true);
    const dados = new FormData(e.currentTarget);
    dados.set("tipo", "qualis_colado");
    try {
      const r = await fetch("/api/listas", { method: "POST", body: dados });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro ?? "Erro ao importar.");
      setMsg({ t: "ok", m: j.mensagem });
      (e.target as HTMLFormElement).reset();
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
          <label htmlFor="col-area">Área de avaliação</label>
          <input id="col-area" name="area" defaultValue="Enfermagem" />
        </div>
        <div className="campo">
          <label htmlFor="col-periodo">Quadriênio</label>
          <select id="col-periodo" name="periodo" defaultValue="2021-2024">
            <option>2021-2024</option>
            <option>2017-2020</option>
            <option>2013-2016</option>
          </select>
        </div>
      </div>
      <div className="campo">
        <label htmlFor="col-texto">Cole aqui a página de resultados do Sucupira</label>
        <textarea id="col-texto" name="texto" required style={{ minHeight: 160 }} placeholder="Na página de resultados do Sucupira: Ctrl+A, Ctrl+C. Aqui: Ctrl+V." />
      </div>
      {msg && <div className={`aviso ${msg.t}`} role="status">{msg.m}</div>}
      <button type="submit" disabled={enviando}>{enviando ? "Importando..." : "Importar o que colei"}</button>
    </form>
  );
}
