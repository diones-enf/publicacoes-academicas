import { rota } from "@/lib/api";
import { fazerBackup } from "@/lib/backup";
import { baixarEAplicar, CODIGO_REINICIAR, eMaisNova, versaoDisponivel, versaoInstalada } from "@/lib/atualizacao";

/** GET: há versão nova? */
export const GET = rota(
  async () => {
    const instalada = versaoInstalada();
    const disponivel = await versaoDisponivel();
    return { instalada, disponivel, temNova: eMaisNova(disponivel, instalada) };
  },
  { perfil: "qualquer" },
);

/** POST: baixa, aplica e religa o sistema. */
export const POST = rota(async () => {
  const instalada = versaoInstalada();
  const disponivel = await versaoDisponivel();
  if (!eMaisNova(disponivel, instalada)) return { ok: false, mensagem: "Você já está na versão mais recente." };
  fazerBackup();
  const arquivos = await baixarEAplicar();
  // Dá tempo da resposta chegar ao navegador; depois o iniciador prepara e religa.
  setTimeout(() => process.exit(CODIGO_REINICIAR), 800);
  return { ok: true, arquivos, versao: disponivel };
});
