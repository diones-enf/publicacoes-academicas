"use client";
import { useState } from "react";
import { api } from "@/componentes/cliente";

/** Botão que busca métricas pela internet e mostra o que encontrou. */
export function BuscarMetricas({ url, rotulo, classe = "" }: { url: string; rotulo: string; classe?: string }) {
  const [estado, setEstado] = useState<"" | "buscando">("");
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  async function buscar() {
    setEstado("buscando");
    setMsg(null);
    try {
      const r = await api<{ encontrados?: string[]; avisos: string[]; revistas?: number; comResultado?: number }>(url, "POST");
      const achou = r.revistas !== undefined
        ? `${r.comResultado} de ${r.revistas} revista(s) com métricas encontradas.`
        : r.encontrados?.length ? `Encontrado: ${r.encontrados.join(", ")}.` : "Nada encontrado nas bases públicas para este ISSN.";
      setMsg({ t: r.avisos.length ? "atencao" : "ok", m: `${achou}${r.avisos.length ? ` Avisos: ${r.avisos.join("; ")}` : ""}` });
      setTimeout(() => window.location.reload(), 2500);
    } catch (e) {
      setMsg({ t: "erro", m: (e as Error).message });
    } finally {
      setEstado("");
    }
  }
  return (
    <span>
      <button type="button" className={classe} onClick={buscar} disabled={estado === "buscando"}>
        {estado === "buscando" ? "Buscando (pode levar 1 a 2 minutos na primeira vez)..." : rotulo}
      </button>
      {msg && <div className={`aviso ${msg.t}`} role="status">{msg.m}</div>}
    </span>
  );
}
