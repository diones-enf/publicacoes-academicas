import { numero, rota } from "@/lib/api";
import { desfazerUltimoStatus } from "@/lib/publicacoes";

export const POST = rota((_req, { ctx, params }) => ({ status: desfazerUltimoStatus(ctx, numero(params.id)) }));
