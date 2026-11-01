"use client";
// Botão que abre um conteúdo (formulário) num quadro sobreposto.
import { useState } from "react";

export function Abrir({ rotulo, titulo, children, classe = "secundario" }: { rotulo: string; titulo: string; children: React.ReactNode; classe?: string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className={classe} onClick={() => setAberto(true)}>{rotulo}</button>
      {aberto && (
        <div className="fundo-modal" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.target === e.currentTarget && setAberto(false)}>
          <div className="modal">
            <div className="topo" style={{ marginBottom: "0.5rem" }}>
              <h2 style={{ margin: 0 }}>{titulo}</h2>
              <button type="button" className="secundario pequeno" onClick={() => setAberto(false)} aria-label="Fechar">✕</button>
            </div>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
