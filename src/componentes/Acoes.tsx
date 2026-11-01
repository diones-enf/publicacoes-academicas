"use client";
// Botões pequenos que chamam a API e recarregam a página.
import { useState } from "react";
import { api } from "./cliente";

export function BotaoAcao({
  url,
  metodo = "POST",
  corpo,
  rotulo,
  confirmar,
  classe = "secundario pequeno",
  depois,
}: {
  url: string;
  metodo?: string;
  corpo?: unknown;
  rotulo: string;
  confirmar?: string;
  classe?: string;
  depois?: string;
}) {
  const [ocupado, setOcupado] = useState(false);
  async function clicar() {
    if (confirmar && !window.confirm(confirmar)) return;
    setOcupado(true);
    try {
      await api(url, metodo, corpo);
      if (depois) window.location.href = depois;
      else window.location.reload();
    } catch (e) {
      alert((e as Error).message);
      setOcupado(false);
    }
  }
  return (
    <button type="button" className={classe} onClick={clicar} disabled={ocupado}>
      {ocupado ? "..." : rotulo}
    </button>
  );
}
