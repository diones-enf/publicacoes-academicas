import { redirect } from "next/navigation";
import { existeAlgumAutor } from "@/lib/auth";
import { FormCadastro } from "./FormCadastro";

export const dynamic = "force-dynamic";

export default function Cadastro() {
  if (existeAlgumAutor()) redirect("/entrar");
  return (
    <main className="centro-tela">
      <div className="cartao caixa-acesso larga">
        <h1>Primeiro acesso</h1>
        <p className="suave">Crie a conta do autor principal. Os dados ficam só neste computador.</p>
        <FormCadastro />
      </div>
    </main>
  );
}
