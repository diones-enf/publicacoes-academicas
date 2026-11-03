import { numero, rota } from "@/lib/api";
import { desfazerImportacao } from "@/lib/importacaoLattes";

export const POST = rota((_req, { ctx, params }) => {
  desfazerImportacao(ctx, numero(params.id));
});
