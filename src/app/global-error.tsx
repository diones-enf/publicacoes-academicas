"use client";

export default function ErroGeral({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <h1>Algo deu errado</h1>
        <p>O sistema encontrou um erro inesperado. Tente de novo ou feche e abra o sistema outra vez.</p>
        <button onClick={() => reset()}>Tentar de novo</button>
      </body>
    </html>
  );
}
