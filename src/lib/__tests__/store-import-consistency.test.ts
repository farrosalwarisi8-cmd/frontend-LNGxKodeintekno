import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const root = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const SELF = "src/lib/__tests__/store-import-consistency.test.ts";

function rel(file: string) {
  return path.relative(root, file).replace(/\\/g, "/");
}

const files = ["app", "components", "lib", "src"]
  .flatMap((d) => walk(path.join(root, d)))
  // file ini sendiri memuat pola yang dicari, jadi tidak ikut dipindai
  .filter((f) => rel(f) !== SELF);

describe("store import consistency", () => {
  it("src/lib/store.ts tidak boleh ada kembali (store tunggal di lib/store.ts)", () => {
    expect(fs.existsSync(path.join(root, "src/lib/store.ts"))).toBe(false);
  });

  it("tidak ada file yang mengimpor store dari path lama", () => {
    const offenders = files.filter((f) => /["'][^"']*src\/lib\/store["']/.test(fs.readFileSync(f, "utf8")));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("import store memakai alias resmi @/lib/store", () => {
    const importers = files.filter((f) => /from\s+["']@\/lib\/store["']/.test(fs.readFileSync(f, "utf8")));
    expect(importers.length).toBeGreaterThan(5);
  });
});

describe("legacy permission & navigation model", () => {
  it("canLegacy() sudah dihapus dan tidak dipakai", () => {
    const offenders = files.filter((f) => /\bcanLegacy\b/.test(fs.readFileSync(f, "utf8")));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("konstanta NAV lama sudah dihapus dari registry", () => {
    const rbac = fs.readFileSync(path.join(root, "lib/rbac.ts"), "utf8");
    expect(/export\s+const\s+NAV\b/.test(rbac)).toBe(false);
    const offenders = files.filter((f) =>
      /import\s*\{[^}]*\bNAV\b[^}]*\}\s*from\s*["'][^"']*rbac["']/.test(fs.readFileSync(f, "utf8"))
    );
    expect(offenders.map(rel)).toEqual([]);
  });

  it("model permission kedua (src/shared/permissions) sudah dihapus", () => {
    expect(fs.existsSync(path.join(root, "src/shared/permissions"))).toBe(false);
    const offenders = files.filter((f) => /shared\/permissions/.test(fs.readFileSync(f, "utf8")));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("komponen shell lama yang memakai NAV sudah dihapus", () => {
    for (const legacy of ["components/app-shell.tsx", "components/app-sidebar.tsx", "components/app-topbar.tsx"]) {
      expect(fs.existsSync(path.join(root, legacy)), legacy).toBe(false);
    }
  });

  it("registry resmi tetap satu: ROLE_PERMISSIONS + can() + getNavigation()", () => {
    const rbac = fs.readFileSync(path.join(root, "lib/rbac.ts"), "utf8");
    expect(/export\s+const\s+ROLE_PERMISSIONS\b/.test(rbac)).toBe(true);
    expect(/export\s+function\s+can\(/.test(rbac)).toBe(true);
    const navigation = fs.readFileSync(path.join(root, "src/lib/navigation.ts"), "utf8");
    expect(/export\s+function\s+getNavigation\(/.test(navigation)).toBe(true);
  });
});
