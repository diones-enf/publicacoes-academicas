import { rota } from "@/lib/api";
import { filtrosDaUrl } from "@/lib/filtros";
import { gerarRelatorio, type OpcoesRelatorio } from "@/lib/relatorios";
import { relatorioCsv, relatorioXlsx } from "@/lib/exportar";
import { relatorioPdf } from "@/lib/pdf";
import { cabecalhoRelatorio } from "@/lib/cabecalho";
import { areaReferencia } from "@/lib/sessao";
import { hojeIso } from "@/lib/texto";

/** GET /api/relatorios/custos?formato=csv|xlsx&...filtros */
export const GET = rota(
  async (req, { usuario, ctx, params }) => {
    const u = new URL(req.url);
    const f = filtrosDaUrl(u.searchParams);
    const o: OpcoesRelatorio = {
      criterio: u.searchParams.get("criterio") === "caixa" ? "caixa" : "competencia",
      mes_de: u.searchParams.get("mes_de") ?? undefined,
      mes_ate: u.searchParams.get("mes_ate") ?? undefined,
      estilo: u.searchParams.get("estilo") === "vancouver" ? "vancouver" : "abnt",
    };
    const r = gerarRelatorio(params.chave, ctx.donoId, f, o, areaReferencia(usuario));
    if (!r) return Response.json({ erro: "Relatório não encontrado." }, { status: 404 });
    const cab = cabecalhoRelatorio(usuario, f, o, params.chave);
    const nome = `relatorio-${params.chave}-${hojeIso()}`;
    if (u.searchParams.get("formato") === "pdf") {
      const buf = await relatorioPdf(r, cab);
      return new Response(new Uint8Array(buf), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${nome}.pdf"` },
      });
    }
    if (u.searchParams.get("formato") === "xlsx") {
      const buf = await relatorioXlsx(r, cab);
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${nome}.xlsx"`,
        },
      });
    }
    return new Response(relatorioCsv(r, cab), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nome}.csv"` },
    });
  },
  { perfil: "qualquer" },
);
