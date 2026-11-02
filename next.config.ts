import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@node-rs/argon2", "exceljs"],
  poweredByHeader: false,
  env: { NEXT_PUBLIC_VERSAO: "5" },
};

export default config;
