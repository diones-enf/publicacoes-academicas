import fs from "node:fs";
import { corpo, numero, rota } from "@/lib/api";
import { alterarAnexo, excluirAnexo, obterAnexo } from "@/lib/anexos";

const MIME: Record<string, string> = {
  pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
  txt: "text/plain; charset=utf-8", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};
/** Tipos que o navegador abre com segurança numa aba; o resto é baixado. */
const ABRE_NA_ABA = /^(application\/pdf|image\/(png|jpeg|gif|webp)|text\/plain)/;

/** Abre (PDF e imagens) ou baixa o arquivo. ?baixar=1 força o download. */
export const GET = rota(
  async (req, { ctx, params }) => {
    const a = obterAnexo(ctx.donoId, numero(params.id));
    if (!a || !fs.existsSync(a.caminho)) return Response.json({ erro: "Arquivo não encontrado." }, { status: 404 });
    const ext = a.nome_original.split(".").pop()?.toLowerCase() ?? "";
    const tipo = MIME[ext] ?? "application/octet-stream";
    const baixar = new URL(req.url).searchParams.has("baixar") || !ABRE_NA_ABA.test(tipo);
    return new Response(new Uint8Array(fs.readFileSync(a.caminho)), {
      headers: {
        "Content-Type": tipo,
        "Content-Disposition": `${baixar ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(a.nome_original)}`,
        "X-Content-Type-Options": "nosniff",
        // o leitor de PDF do navegador não abre com "sandbox"
        ...(tipo === "application/pdf" ? {} : { "Content-Security-Policy": "sandbox" }),
      },
    });
  },
  { perfil: "qualquer" },
);

export const PATCH = rota(async (req, { ctx, params }) => {
  const d = await corpo<{ categoria?: string; observacao?: string | null }>(req);
  alterarAnexo(ctx.donoId, numero(params.id), d);
});

export const DELETE = rota(async (_req, { ctx, params }) => excluirAnexo(ctx.donoId, numero(params.id)));
