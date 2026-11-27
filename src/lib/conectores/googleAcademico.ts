// Google Acadêmico: não tem API. O sistema lê a página pública do perfil
// (a mesma que você vê no navegador). Se o Google pedir "não sou um robô",
// dá para salvar a página (Ctrl+S) e enviar o arquivo.
import { ErroFonte } from "./http";

const BASE = process.env.GOOGLE_ACADEMICO_URL ?? "https://scholar.google.com.br";

export interface ArtigoGoogle {
  titulo: string;
  autores: string;
  veiculo: string;
  ano: number | null;
  citacoes: number;
}

export interface PerfilGoogle {
  nome: string | null;
  citacoes: number | null;
  citacoesDesde: number | null;
  h: number | null;
  hDesde: number | null;
  i10: number | null;
  i10Desde: number | null;
  anoDesde: number | null;
  porAno: { ano: number; total: number }[];
  artigos: ArtigoGoogle[];
  temMais: boolean;
}

/** Aceita o link do perfil, "user=XXXX" ou só o código. */
export function idDoPerfil(entrada: string | null | undefined): string | null {
  const t = (entrada ?? "").trim();
  if (!t) return null;
  const m = t.match(/[?&]user=([\w-]{12})/);
  if (m) return m[1];
  return /^[\w-]{12}$/.test(t) ? t : null;
}

export function linkDoPerfil(id: string): string {
  return `https://scholar.google.com.br/citations?user=${id}&hl=pt-BR`;
}

function desfazer(t: string): string {
  return t
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function inteiro(t: string | undefined): number | null {
  const d = (t ?? "").replace(/\D/g, "");
  return d ? Number(d) : null;
}

export function paginaBloqueada(html: string): boolean {
  return /gs_captcha|recaptcha|unusual traffic|tráfego incomum|sorry\/index/i.test(html) && !/gsc_a_tr/.test(html);
}

/** Lê o HTML da página do perfil. */
export function lerPerfilGoogle(html: string): PerfilGoogle {
  const nome = html.match(/id="gsc_prf_in"[^>]*>([^<]*)</)?.[1];
  const std = [...html.matchAll(/class="gsc_rsb_std"[^>]*>([^<]*)</g)].map((m) => inteiro(m[1]));
  const desde = html.match(/class="gsc_rsb_sth"[^>]*>[^<]*?(\d{4})\s*</);

  // Gráfico por ano: rótulos (anos) e barras, ligados pela posição "right:Npx".
  const anos = [...html.matchAll(/class="gsc_g_t"[^>]*style="[^"]*right:\s*(\d+)px[^"]*"[^>]*>\s*(\d{4})\s*</g)].map((m) => ({ pos: Number(m[1]), ano: Number(m[2]) }));
  const barras = [...html.matchAll(/class="gsc_g_a"[^>]*style="[^"]*right:\s*(\d+)px[^"]*"[^>]*>\s*<span class="gsc_g_al">([^<]*)</g)].map((m) => ({
    pos: Number(m[1]),
    total: inteiro(m[2]) ?? 0,
  }));
  const porAno = anos.map(({ pos, ano }) => {
    const b = barras.find((x) => Math.abs(x.pos - pos) <= 6);
    return { ano, total: b?.total ?? 0 };
  });

  const artigos: ArtigoGoogle[] = [];
  for (const m of html.matchAll(/<tr class="gsc_a_tr"[^>]*>([\s\S]*?)<\/tr>/g)) {
    const tr = m[1];
    const titulo = tr.match(/class="gsc_a_at"[^>]*>([\s\S]*?)<\/a>/)?.[1];
    if (!titulo) continue;
    const cinzas = [...tr.matchAll(/<div class="gs_gray">([\s\S]*?)<\/div>/g)].map((g) => desfazer(g[1].replace(/<span class="gs_oph">[\s\S]*?<\/span>/, "")));
    artigos.push({
      titulo: desfazer(titulo),
      autores: cinzas[0] ?? "",
      veiculo: cinzas[1] ?? "",
      ano: inteiro(tr.match(/class="gsc_a_h gsc_a_hc[^"]*"[^>]*>([^<]*)</)?.[1]),
      citacoes: inteiro(tr.match(/class="gsc_a_ac[^"]*"[^>]*>([^<]*)</)?.[1]) ?? 0,
    });
  }
  const botaoMais = html.match(/<button[^>]*id="gsc_bpf_more"[^>]*>/)?.[0] ?? "";
  return {
    nome: nome ? desfazer(nome) : null,
    citacoes: std[0] ?? null,
    citacoesDesde: std[1] ?? null,
    h: std[2] ?? null,
    hDesde: std[3] ?? null,
    i10: std[4] ?? null,
    i10Desde: std[5] ?? null,
    anoDesde: desde ? Number(desde[1]) : null,
    porAno,
    artigos,
    temMais: !!botaoMais && !/disabled/.test(botaoMais),
  };
}

async function baixar(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { headers: { "Accept-Language": "pt-BR,pt;q=0.9" }, signal: ctrl.signal, cache: "no-store" });
    if (r.status === 429 || r.status === 403) throw new ErroFonte("Google Acadêmico", "pediu verificação de robô; salve a página do perfil (Ctrl+S) e envie o arquivo");
    if (r.status === 404) throw new ErroFonte("Google Acadêmico", "perfil não encontrado; confira o link");
    if (!r.ok) throw new ErroFonte("Google Acadêmico", `respondeu ${r.status}`, r.status);
    const charset = r.headers.get("content-type")?.match(/charset=([\w-]+)/i)?.[1] ?? "utf-8";
    const buf = await r.arrayBuffer();
    return new TextDecoder(charset.toLowerCase() === "iso-8859-1" ? "latin1" : charset).decode(buf);
  } catch (e) {
    if (e instanceof ErroFonte) throw e;
    if ((e as Error).name === "AbortError") throw new ErroFonte("Google Acadêmico", "não respondeu a tempo");
    throw new ErroFonte("Google Acadêmico", "sem conexão");
  } finally {
    clearTimeout(timer);
  }
}

/** Baixa o perfil inteiro (100 artigos por página, até 1.000). */
export async function buscarPerfilGoogle(id: string): Promise<PerfilGoogle> {
  let perfil: PerfilGoogle | null = null;
  for (let inicio = 0; inicio < 1000; inicio += 100) {
    const html = await baixar(`${BASE}/citations?user=${encodeURIComponent(id)}&hl=pt-BR&cstart=${inicio}&pagesize=100`);
    if (paginaBloqueada(html)) throw new ErroFonte("Google Acadêmico", "pediu verificação de robô; salve a página do perfil (Ctrl+S) e envie o arquivo");
    const p = lerPerfilGoogle(html);
    if (!perfil) perfil = p;
    else perfil.artigos.push(...p.artigos);
    if (!p.temMais || p.artigos.length < 100) break;
  }
  if (!perfil || (!perfil.nome && !perfil.artigos.length)) throw new ErroFonte("Google Acadêmico", "a página não parece um perfil do Google Acadêmico");
  return perfil;
}
