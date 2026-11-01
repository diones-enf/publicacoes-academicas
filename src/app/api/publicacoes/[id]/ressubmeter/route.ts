import { corpo, numero, rota } from "@/lib/api";
import { ressubmeter } from "@/lib/publicacoes";
import type { DadosVeiculo } from "@/lib/veiculos";

export const POST = rota(async (req, { ctx, params }) => {
  const d = await corpo<{ veiculo_id?: number; veiculo?: DadosVeiculo; data?: string }>(req);
  ressubmeter(ctx, numero(params.id), d);
});
