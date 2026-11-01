// Chamada às rotas da API a partir das telas.
export class ErroApi extends Error {
  constructor(
    mensagem: string,
    public status: number,
    public dados: Record<string, unknown>,
  ) {
    super(mensagem);
  }
}

export async function api<T = Record<string, unknown>>(url: string, metodo = "GET", corpo?: unknown): Promise<T> {
  const r = await fetch(url, {
    method: metodo,
    headers: corpo !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (r.status === 401) {
    window.location.href = "/entrar?expirou=1";
  }
  if (!r.ok) throw new ErroApi((dados as { erro?: string }).erro ?? `Erro ${r.status}`, r.status, dados);
  return dados as T;
}
