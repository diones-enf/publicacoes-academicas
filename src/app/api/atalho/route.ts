import { rota } from "@/lib/api";
import { criarAtalho } from "@/lib/atalho";

/** Cria (ou atualiza) o atalho da área de trabalho com o ícone do sistema. */
export const POST = rota(async () => criarAtalho());
