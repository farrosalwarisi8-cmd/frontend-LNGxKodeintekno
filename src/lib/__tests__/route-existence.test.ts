import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Menjaga acceptance criteria "tidak ada dead-end": setiap link/router.push ke
 * path internal harus punya halaman di `app/`.
 */

const root = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const appPages = walk(path.join(root, "app"));

/** Route yang benar-benar ada (segment bergrup `(app)` diabaikan). */
const routes = new Set<string>(["/"]);
for (const file of appPages) {
  const normalized = path.relative(path.join(root, "app"), file).replace(/\\/g, "/");
  if (!normalized.endsWith("page.tsx")) continue;
  const segments = normalized
    .replace(/\/page\.tsx$/, "")
    .split("/")
    .filter((s) => s.length > 0 && !s.startsWith("("));
  routes.add("/" + segments.join("/"));
}

/** Route dinamis (`[id]`) dianggap cocok untuk segmen apa pun. */
function routeExists(href: string): boolean {
  const clean = href.split("?")[0].replace(/\/+$/, "") || "/";
  if (routes.has(clean)) return true;
  const target = clean.split("/").filter(Boolean);
  for (const route of routes) {
    const parts = route.split("/").filter(Boolean);
    if (parts.length !== target.length) continue;
    const matches = parts.every((p, i) => p.startsWith("[") || p === target[i]);
    if (matches) return true;
  }
  return false;
}

const runtimeFiles = ["app", "components", "lib", "src"].flatMap((d) =>
  walk(path.join(root, d)).filter((f) => !f.includes("__tests__"))
);

function collectLinks(): { href: string; file: string }[] {
  const found: { href: string; file: string }[] = [];
  for (const file of runtimeFiles) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/href=["'`](\/[^"'`\s{}]*)/g)) {
      found.push({ href: m[1], file: path.relative(root, file).replace(/\\/g, "/") });
    }
    for (const m of src.matchAll(/router\.(?:push|replace)\(["'`](\/[^"'`\s{}]*)/g)) {
      found.push({ href: m[1], file: path.relative(root, file).replace(/\\/g, "/") });
    }
  }
  return found;
}

describe("integritas link internal", () => {
  const links = collectLinks();

  it("mengumpulkan link internal dari kode runtime", () => {
    expect(links.length).toBeGreaterThan(10);
  });

  it("setiap link internal menunjuk route yang ada (tidak ada dead-end 404)", () => {
    const broken = links.filter(({ href }) => {
      // link publik/redirect non-halaman tetap dianggap valid
      if (href.startsWith("/login") || href.startsWith("/public") || href.startsWith("/verify")) return false;
      return !routeExists(href);
    });
    expect(broken.map((b) => `${b.href} (${b.file})`)).toEqual([]);
  });
});
