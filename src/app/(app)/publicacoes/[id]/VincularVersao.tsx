"use client";
import { useState } from "react";
import { api } from "@/componentes/cliente";

export function VincularVersao({ id, opcoes }: { id: number; opcoes: { id: number; titulo: string; ano: number | null }[] }) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const rotulo = (o: { id: number; titulo: string; ano: number | null }) => `${o.titulo}${o.ano ? ` (${o.ano})` : ""} #${o.id}`;
  async function ligar(e: React.FormEvent) {
    e.preventDefault();
    const m = texto.match(/#(\d+)$/);
    if (!m) return setErro("Escolha uma publicação da lista.");
    try {
      await api(`/api/publicacoes/${id}/versoes`, "POST", { outro_id: Number(m[1]) });
      window.location.reload();
    } catch (e) {
      setErro((e as Error).message);
    }
  }
  return (
    <form onSubmit={ligar} className="nao-imprimir" style={{ marginTop: "0.5rem" }}>
      <label htmlFor="versao">Ligar a outra publicação</label>
      <div className="acoes" style={{ flexWrap: "nowrap" }}>
        <input id="versao" list="lista-versoes" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Comece a digitar o título" />
        <button type="submit" className="secundario">Ligar</button>
      </div>
      <datalist id="lista-versoes">{opcoes.map((o) => <option key={o.id} value={rotulo(o)} />)}</datalist>
      {erro && <div className="aviso erro">{erro}</div>}
    </form>
  );
}
