import { emailConfigurado } from "@/lib/email";
import { FormRecuperar } from "./FormRecuperar";

export const dynamic = "force-dynamic";

export default function Recuperar() {
  return (
    <main className="centro-tela">
      <div className="cartao caixa-acesso">
        <h1>Recuperar a senha</h1>
        <FormRecuperar comEmail={emailConfigurado()} />
        <p style={{ marginTop: "1rem" }}><a href="/entrar">Voltar para o login</a></p>
      </div>
    </main>
  );
}
