"use client";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { api } from "./cliente";

const ITENS_AUTOR = [
  { href: "/", rotulo: "Painel" },
  { href: "/publicacoes/nova", rotulo: "+ Nova publicação" },
  { href: "/publicacoes?secao=publicados", rotulo: "Publicados", base: "/publicacoes" },
  { href: "/submissoes", rotulo: "Submissões" },
  { href: "/veiculos", rotulo: "Revistas e veículos" },
  { href: "/coautores", rotulo: "Coautores" },
  { href: "/custos", rotulo: "Custos" },
  { href: "/relatorios", rotulo: "Relatórios" },
  { href: "/configuracoes", rotulo: "Configurações" },
];

export function Menu({ nome, perfil, lembretes }: { nome: string; perfil: string; lembretes: number }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const itens = perfil === "autor" ? ITENS_AUTOR : [{ href: "/relatorios", rotulo: "Relatórios" }];
  const ativo = (i: { href: string; base?: string }) => {
    const alvo = i.base ?? i.href.split("?")[0];
    if (alvo === "/") return caminho === "/";
    if (alvo === "/publicacoes") return caminho === "/publicacoes" || (/^\/publicacoes\/\d/.test(caminho));
    return caminho.startsWith(alvo);
  };
  async function sair() {
    await api("/api/sessao", "DELETE");
    window.location.href = "/entrar?saiu=1";
  }
  return (
    <aside className={`menu nao-imprimir ${aberto ? "aberto" : ""}`}>
      <div className="cabecalho-menu">
        <div className="marca">
          Publicações
          <small>{perfil === "autor" ? "Autor principal" : "Leitor convidado"}</small>
        </div>
        <button className="botao-menu secundario pequeno" onClick={() => setAberto(!aberto)} aria-expanded={aberto}>
          Menu
        </button>
      </div>
      <nav aria-label="Menu principal">
        {itens.map((i) => (
          <a key={i.href} href={i.href} aria-current={ativo(i) ? "page" : undefined}>
            {i.rotulo}
            {i.href === "/" && lembretes > 0 && <span className="selo amarelo" style={{ marginLeft: 6 }}>{lembretes}</span>}
          </a>
        ))}
      </nav>
      <div className="rodape-menu">
        <div>{nome}</div>
        <button className="secundario pequeno" onClick={sair}>Sair</button>
      </div>
    </aside>
  );
}
