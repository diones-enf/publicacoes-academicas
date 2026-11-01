import { redirect } from "next/navigation";
import { existeAlgumAutor } from "@/lib/auth";
import { usuarioAtual } from "@/lib/sessao";
import { FormEntrar } from "./FormEntrar";

export const dynamic = "force-dynamic";

export default async function Entrar({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  if (!existeAlgumAutor()) redirect("/cadastro");
  if (await usuarioAtual()) redirect("/");
  const sp = await searchParams;
  return (
    <main className="centro-tela">
      <div className="cartao caixa-acesso">
        <h1>Publicações Acadêmicas</h1>
        {sp.expirou && <div className="aviso info">Sua sessão expirou depois de 30 minutos sem uso. Entre de novo.</div>}
        {sp.saiu && <div className="aviso ok">Você saiu do sistema.</div>}
        <FormEntrar />
      </div>
    </main>
  );
}
