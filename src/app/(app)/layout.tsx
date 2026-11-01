import { exigirUsuario } from "@/lib/sessao";
import { executarRotinasDoDia } from "@/lib/rotinas";
import { donoDe } from "@/lib/auth";
import { listarLembretes } from "@/lib/lembretes";
import { Menu } from "@/componentes/Menu";

export const dynamic = "force-dynamic";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const u = await exigirUsuario();
  executarRotinasDoDia();
  const lembretes = u.perfil === "autor" ? listarLembretes(donoDe(u)).length : 0;
  return (
    <div className="app">
      <a href="#conteudo" className="pular-para-conteudo">Pular para o conteúdo</a>
      <Menu nome={u.nome} perfil={u.perfil} lembretes={lembretes} />
      <main id="conteudo" className="conteudo">{children}</main>
    </div>
  );
}
