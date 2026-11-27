import { rota } from "@/lib/api";
import { atualizarGoogle, importarPaginaGoogle, salvarPerfilGoogle } from "@/lib/googleAcademico";

/**
 * Google Acadêmico:
 *  - JSON { perfil } → guarda o link (se vier) e lê o perfil na internet;
 *  - formulário com "arquivo" → lê a página do perfil salva no computador.
 */
export const POST = rota(async (req, { ctx }) => {
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const arquivo = (await req.formData()).get("arquivo");
    if (!(arquivo instanceof File) || !arquivo.size) throw new Error("Escolha o arquivo da página salva.");
    const buf = Buffer.from(await arquivo.arrayBuffer());
    const bruto = buf.toString("latin1");
    const charset = bruto.match(/charset=["']?([\w-]+)/i)?.[1]?.toLowerCase() ?? "utf-8";
    const html = charset.includes("8859") || charset === "windows-1252" ? bruto : buf.toString("utf8");
    return importarPaginaGoogle(ctx.donoId, html);
  }
  const d = (await req.json().catch(() => ({}))) as { perfil?: string };
  if (d.perfil !== undefined) salvarPerfilGoogle(ctx.donoId, d.perfil);
  const r = await atualizarGoogle(ctx.donoId);
  if (!r) throw new Error("Cole o link do seu perfil do Google Acadêmico.");
  return r;
});
