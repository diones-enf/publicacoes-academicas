"use client";

export default function Erro({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="centro-tela">
      <div className="cartao caixa-acesso">
        <h1>Algo deu errado</h1>
        <p>Não foi possível carregar esta página. Tente de novo; se o problema continuar, feche e abra o sistema outra vez.</p>
        {error.digest && <p className="suave">Código do erro: {error.digest}</p>}
        <div className="acoes">
          <button onClick={() => reset()}>Tentar de novo</button>
          <a className="botao secundario" href="/">Voltar ao painel</a>
        </div>
      </div>
    </main>
  );
}
