import type { NextConfig } from "next";
import pacote from "./package.json";

const config: NextConfig = {
  serverExternalPackages: ["@node-rs/argon2", "exceljs", "pdfkit"],
  poweredByHeader: false,
  env: { NEXT_PUBLIC_VERSAO: pacote.version },
};

export default config;
