import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@node-rs/argon2", "exceljs"],
  poweredByHeader: false,
};

export default config;
