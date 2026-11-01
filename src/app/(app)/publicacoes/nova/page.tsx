import { contextoDe, exigirUsuario } from "@/lib/sessao";
import { dadosDoFormulario } from "@/componentes/formulario/dadosForm";
import { NovaPublicacao } from "./NovaPublicacao";

export default async function Nova() {
  const u = await exigirUsuario("autor");
  const ctx = contextoDe(u);
  const d = dadosDoFormulario(ctx);
  return (
    <>
      <h1>Nova publicação</h1>
      <NovaPublicacao {...d} nomeSugerido={u.orcid ?? u.nome} />
    </>
  );
}
