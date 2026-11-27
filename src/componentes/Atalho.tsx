"use client";
import { useState } from "react";
import { api } from "./cliente";

export function CriarAtalho() {
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ t: string; m: string } | null>(null);
  async function criar() {
    setOcupado(true);
    setMsg(null);
    try {
      const r = await api<{ criado: boolean; atualizados: number }>("/api/atalho", "POST");
      setMsg({
        t: "ok",
        m:
          (r.criado ? "Pronto: atalho \"Publicações Acadêmicas\" criado na área de trabalho." : `Pronto: ${r.atualizados} atalho(s) da área de trabalho com o ícone novo.`) +
          " Se o ícone antigo continuar aparecendo, clique na área de trabalho e aperte F5.",
      });
    } catch (e) {
      setMsg({ t: "erro", m: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div>
      <div className="acoes" style={{ alignItems: "center" }}>
        <img src="/icon.png" alt="" width={48} height={48} />
        <button onClick={criar} disabled={ocupado}>{ocupado ? "Criando..." : "Criar atalho na área de trabalho"}</button>
      </div>
      <p className="ajuda suave">Se você já tem um atalho, ele só troca o ícone. A janela preta passa a abrir minimizada.</p>
      {msg && <div className={`aviso ${msg.t}`} role="status">{msg.m}</div>}
    </div>
  );
}
