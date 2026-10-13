import { defineConfig } from "vitest/config";
import path from "path";
import fs from "fs";

function resolveAlias(source: string, importer: string | undefined): string | null {
  if (!source.startsWith("@/")) return null;
  const p = source.slice(2);
  const candidates = [
    path.resolve(__dirname, p),
    path.resolve(__dirname, "src", p),
  ];
  for (const c of candidates) {
    const extensions = [".ts", ".tsx", "/index.ts", "/index.tsx"];
    for (const ext of extensions) {
      const full = c + ext;
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
}

/**
 * Gap F1-D: environment unit test ditentukan DI SINI secara deterministik,
 * bukan diambil diam-diam dari `.env.local` developer.
 * Isi `TEST_API_URL` (atau `E2E_API_URL`) untuk mengarahkan test ke backend lain.
 */
const TEST_API_URL =
  process.env.TEST_API_URL ?? process.env.E2E_API_URL ?? "http://localhost:3000/api/v1";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/__tests__/**/*.test.ts"],
    env: {
      NEXT_PUBLIC_API_URL: TEST_API_URL,
      NODE_ENV: "test",
      NEXT_PUBLIC_ENABLE_DEMO: "false",
    },
  },
  plugins: [
    {
      name: "resolve-at-alias",
      enforce: "pre",
      resolveId(source, importer) {
        return resolveAlias(source, importer);
      },
    },
  ],
});
