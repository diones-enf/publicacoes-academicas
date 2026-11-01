import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Publicações Acadêmicas",
  description: "Controle pessoal da produção acadêmica",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
