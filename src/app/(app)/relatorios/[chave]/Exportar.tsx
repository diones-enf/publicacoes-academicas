"use client";

export function Exportar({ chave, qs }: { chave: string; qs: string }) {
  const url = (formato: string) => `/api/relatorios/${chave}?${qs}${qs ? "&" : ""}formato=${formato}`;
  return (
    <div className="acoes nao-imprimir">
      <button type="button" onClick={() => window.print()}>PDF / Imprimir</button>
      <a className="botao secundario" href={url("xlsx")}>XLSX</a>
      <a className="botao secundario" href={url("csv")}>CSV</a>
    </div>
  );
}
