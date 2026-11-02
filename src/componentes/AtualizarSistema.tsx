"use client";
import { useEffect, useState } from "react";

interface Estado {
  instalada: string;
  disponivel: string | null;
  temNova: boolean;
}

/** Mostra se há versão nova e atualiza com um clique. `compacto` = só aparece quando há novidade. */
export function AtualizarSistema({ compacto = false }: { compacto?: boolean }) {
  const [e, setE] = useState<Estado | null>(null);
  const [fase, setFase] = useState<"" | "baixando" | "religando" | "erro">("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/atualizar")
      .then((r) => r.json())
      .then(setE)
      .catch(() => undefined);
  }, []);

  async function atualizar() {
    setFase("baixando");
    setMsg("");
    try {
      const r = await fetch("/api/atualizar", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.erro ?? "Falha ao atualizar.");
      if (!j.ok) {
        setFase("");
        setMsg(j.mensagem);
        return;
      }
      setFase("religando");
      const alvo = j.versao as string;
      const inicio = Date.now();
      const esperar = async () => {
        try {
          const v = await (await fetch("/api/atualizar", { cache: "no-store" })).json();
          if (v.instalada === alvo) return window.location.reload();
        } catch {
          /* ainda religando */
        }
        if (Date.now() - inicio > 8 * 60000) {
          setFase("erro");
          setMsg("Está demorando mais que o normal. Feche e abra o sistema pelo atalho.");
          return;
        }
        setTimeout(esperar, 3000);
      };
      setTimeout(esperar, 5000);
    } catch (er) {
      setFase("erro");
      setMsg((er as Error).message);
    }
  }

  if (!e) return compacto ? null : <p className="suave">Verificando atualizações...</p>;
  if (compacto && !e.temNova) return null;
  return (
    <div className={`aviso ${e.temNova ? "info" : "ok"}`}>
      {fase === "religando" ? (
        <strong>Atualizando para a versão {e.disponivel}... Aguarde de 2 a 3 minutos: a página recarrega sozinha.</strong>
      ) : e.temNova ? (
        <>
          <strong>Há uma versão nova do sistema ({e.disponivel}).</strong> Você está na versão {e.instalada}. Seus dados não são alterados.{" "}
          <button onClick={atualizar} disabled={fase === "baixando"}>{fase === "baixando" ? "Baixando..." : "Atualizar agora"}</button>
        </>
      ) : (
        <>
          Você está na versão mais recente ({e.instalada}).
          {e.disponivel === null && " (Não foi possível consultar o GitHub agora: confira a internet.)"}
        </>
      )}
      {msg && <div style={{ marginTop: 6 }}>{msg}</div>}
    </div>
  );
}
