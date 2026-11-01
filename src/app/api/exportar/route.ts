import { rota } from "@/lib/api";
import { exportarDados, exportarXlsxCompleto } from "@/lib/backup";
import { registrarAcesso } from "@/lib/auth";
import { hojeIso } from "@/lib/texto";

/** Exportação completa dos dados (LGPD e backup pelo próprio usuário). */
export const GET = rota(async (req, { usuario, ctx }) => {
  const formato = new URL(req.url).searchParams.get("formato");
  registrarAcesso(usuario.id, usuario.cpf_mascara, "exportacao", formato ?? "json");
  const nome = `publicacoes-dados-${hojeIso()}`;
  if (formato === "xlsx") {
    const buf = await exportarXlsxCompleto(ctx.donoId);
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nome}.xlsx"`,
      },
    });
  }
  return new Response(JSON.stringify(exportarDados(ctx.donoId), null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}.json"` },
  });
});
