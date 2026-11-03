"use client";

export function Exportar({ chave, qs }: { chave: string; qs: string }) {
  const url = (formato: string) => `/api/relatorios/${chave}?${qs}${qs ? "&" : ""}formato=${formato}`;
  return (
    <div className="acoes nao-imprimir">
      <a className="botao" href={url("pdf")}>Baixar PDF</a>
      <button type="button" className="secundario" onClick={() => window.print()}>Imprimir</button>
      <a className="botao secundario" href={url("xlsx")}>XLSX</a>
      <a className="botao secundario" href={url("csv")}>CSV</a>
    </div>
  );
}
