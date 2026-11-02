// Atualização pelo próprio sistema: baixa a versão nova do GitHub, grava
// por cima dos arquivos do programa (nunca mexe nos seus dados, que ficam em
// Documentos) e pede ao iniciador para preparar e religar o sistema.
import fs from "node:fs";
import path from "node:path";

export const REPOSITORIO = "diones-enf/publicacoes-academicas";
export const CODIGO_REINICIAR = 42;

export function versaoInstalada(): string {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8")).version;
}

export async function versaoDisponivel(): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(process.env.ATUALIZACAO_VERSAO_URL ?? `https://raw.githubusercontent.com/${REPOSITORIO}/main/package.json?t=${Date.now()}`, {
      signal: ctrl.signal,
      cache: "no-store",
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return (await r.json()).version ?? null;
  } catch {
    return null;
  }
}

export function eMaisNova(disponivel: string | null, instalada: string): boolean {
  if (!disponivel) return false;
  const a = disponivel.split(".").map(Number);
  const b = instalada.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) > (b[i] ?? 0)) return true;
    if ((a[i] ?? 0) < (b[i] ?? 0)) return false;
  }
  return false;
}

/** Pastas e arquivos que nunca são substituídos. */
const PROTEGIDOS = [/^dados\//, /^node_modules\//, /^\.next\//, /^\.env/];

/** Grava o conteúdo do ZIP do GitHub por cima da pasta do programa. Devolve quantos arquivos foram gravados. */
export async function aplicarZip(conteudo: ArrayBuffer | Buffer, destino = process.cwd()): Promise<number> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(conteudo);
  const nomes = Object.keys(zip.files);
  if (!nomes.some((n) => n.endsWith("package.json"))) throw new Error("O arquivo baixado não é o sistema.");
  // O ZIP do GitHub vem com uma pasta raiz ("publicacoes-academicas-main/")
  const prefixo = nomes.every((n) => n.startsWith(nomes[0].split("/")[0] + "/")) ? nomes[0].split("/")[0] + "/" : "";
  let n = 0;
  for (const nome of nomes) {
    const item = zip.files[nome];
    const rel = nome.slice(prefixo.length);
    if (!rel || item.dir || PROTEGIDOS.some((r) => r.test(rel)) || rel.includes("..")) continue;
    const alvo = path.join(destino, rel);
    fs.mkdirSync(path.dirname(alvo), { recursive: true });
    fs.writeFileSync(alvo, await item.async("nodebuffer"));
    n++;
  }
  return n;
}

export async function baixarEAplicar(): Promise<number> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 120000);
  const r = await fetch(process.env.ATUALIZACAO_ZIP_URL ?? `https://codeload.github.com/${REPOSITORIO}/zip/refs/heads/main`, { signal: ctrl.signal, cache: "no-store" });
  clearTimeout(t);
  if (!r.ok) throw new Error(`Não foi possível baixar a atualização (GitHub respondeu ${r.status}).`);
  return aplicarZip(await r.arrayBuffer());
}
