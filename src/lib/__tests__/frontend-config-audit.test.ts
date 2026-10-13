import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Level 1 — static/configuration test (tanpa backend).
 *
 * Menguji gap F1-C:
 *  - API base URL terpusat (env hanya dibaca di `src/lib/env.ts`).
 *  - Tidak ada fallback localhost pada source runtime.
 *  - Tidak ada kredensial demo pada source runtime.
 *  - Feature flag demo eksplisit dan default mati.
 *  - `.env.example` lengkap dan bebas secret.
 */

const root = process.cwd();
const RUNTIME_DIRS = ["app", "components", "lib", "src"];

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const runtimeFiles = RUNTIME_DIRS.flatMap((d) => walk(path.join(root, d))).filter(
  (f) => !f.includes("__tests__")
);

const rel = (f: string) => path.relative(root, f).replace(/\\/g, "/");
const read = (f: string) => fs.readFileSync(f, "utf8");

describe("audit konfigurasi frontend (static)", () => {
  it("mengumpulkan berkas runtime untuk diaudit", () => {
    expect(runtimeFiles.length).toBeGreaterThan(50);
  });

  it("proses.env.NEXT_PUBLIC_* hanya dibaca di src/lib/env.ts (API URL terpusat)", () => {
    const offenders = runtimeFiles.filter(
      (f) => /process\.env\.NEXT_PUBLIC_/.test(read(f)) && rel(f) !== "src/lib/env.ts"
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it("tidak ada literal URL localhost pada source runtime (tidak ada fallback localhost)", () => {
    const offenders = runtimeFiles.filter((f) =>
      /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/.test(read(f))
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it("tidak ada kredensial demo pada source runtime", () => {
    const patterns = [/KlinikLNG2026/i, /SEED_PASSWORD\s*=\s*["']/, /password\s*:\s*["'][^"']{6,}["']/];
    const offenders: string[] = [];
    for (const file of runtimeFiles) {
      const src = read(file);
      for (const p of patterns) {
        if (p.test(src)) offenders.push(`${rel(file)} (${p})`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("halaman login memakai feature flag demo (bukan kredensial hardcoded)", () => {
    const login = read(path.join(root, "app/login/login-page-content.tsx"));
    expect(login).toContain("isDemoModeEnabled");
    expect(login).toContain("getDemoPassword");
    expect(login).not.toMatch(/password:\s*["']/);
  });

  it("api-client tidak menyisipkan fallback localhost dan menolak konfigurasi invalid", () => {
    const client = read(path.join(root, "src/lib/api-client.ts"));
    expect(client).not.toMatch(/\?\?\s*["']http/);
    expect(client).toContain("requireBaseUrl");
    expect(client).toContain("API_CONFIG_ERROR");
  });

  it(".env.example ada, tanpa secret, dan mendokumentasikan variabel wajib + flag demo", () => {
    const file = path.join(root, ".env.example");
    expect(fs.existsSync(file)).toBe(true);
    const src = read(file);
    expect(src).toContain("NEXT_PUBLIC_API_URL");
    expect(src).toContain("NEXT_PUBLIC_ENABLE_DEMO");
    expect(src).toMatch(/JANGAN menaruh secret/i);
    expect(src).not.toMatch(/KlinikLNG2026/i);
    // Tidak ada nilai password yang benar-benar diisi (hanya placeholder komentar).
    expect(src).not.toMatch(/^\s*NEXT_PUBLIC_DEMO_PASSWORD=\S+/im);
  });

  it("package.json tidak memuat kredensial atau URL lokal", () => {
    const pkg = read(path.join(root, "package.json"));
    expect(pkg).not.toMatch(/KlinikLNG2026|localhost|http:\/\//);
  });

  it("tidak ada file .env yang ter-commit selain .env.example (gitignore)", () => {
    const gitignore = read(path.join(root, ".gitignore"));
    expect(gitignore).toMatch(/^\.env\*$/m);
    expect(gitignore).toMatch(/^!\.env\.example$/m);
  });
});
