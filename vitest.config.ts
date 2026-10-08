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

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/__tests__/**/*.test.ts"],
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
