import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Tugas 1 (rebrand visible) — pencegah token yang tidak terdefinisi.
 *
 * Insiden: `bg-surface` dipakai di `components/logo.tsx`, tetapi
 * `--color-surface` TIDAK ada di `app/globals.css` (yang ada hanya
 * `surface-page`, `surface-card`, `surface-elevated`). Tailwind 4 diam-diam
 * tidak menghasilkan utilitas untuk token yang tidak dikenal, sehingga chip
 * `onDark` tampil tanpa latar — tanpa error build, lint, maupun typecheck.
 *
 * Test ini memindai seluruh kelas warna Tailwind pada source runtime dan
 * memastikan tiap token yang dirujuk terdaftar di blok `@theme inline`
 * `app/globals.css`. Gagal (fail-closed) bila ada yang tidak dikenal — entah
 * itu token yang hilang (bug, harus diperbaiki) atau pola non-warna baru
 * (tambah ke NON_COLOR bila memang bukan warna).
 */

const root = process.cwd();
const RUNTIME_DIRS = ["app", "components", "lib", "src"];

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

const runtimeFiles = RUNTIME_DIRS.flatMap((d) => walk(path.join(root, d))).filter(
  (f) => !f.includes("__tests__")
);
const rel = (f: string) => path.relative(root, f).replace(/\\/g, "/");

/** Token yang didefinisikan di `@theme inline` (nama tanpa prefix `--color-`). */
function definedTokens(): Set<string> {
  const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");
  // Cari `@theme inline {` sebagai blok — bukan sekadar "@theme inline" yang
  // juga muncul di komentar dokumentasi di atas berkas.
  const start = css.indexOf("@theme inline {");
  if (start < 0) throw new Error("@theme inline tidak ditemukan di app/globals.css");
  const open = css.indexOf("{", start);
  let depth = 0;
  let end = -1;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const block = css.slice(open + 1, end);
  const out = new Set<string>();
  for (const m of block.matchAll(/--color-([\w-]+)\s*:/g)) out.add(m[1]);
  return out;
}

/**
 * Kelas utilitas yang diawali prefix warna tetapi BUKAN warna — ukuran font,
 * perataan teks, border-width/sisi, posisi background, dsb. Diekstrak dengan
 * pola yang sama dengan pemindai, jadi pola baru yang bukan warna akan
 * menggagalkan test sampai ditambahkan di sini (fail-closed, disengaja).
 */
const NON_COLOR = new Set([
  // ukuran & gaya teks
  "text-xs",
  "text-sm",
  "text-base",
  "text-lg",
  "text-xl",
  "text-2xl",
  "text-3xl",
  "text-4xl",
  "text-center",
  "text-left",
  "text-right",
  // sisi, lebar & gaya border
  "border-t",
  "border-b",
  "border-l",
  "border-r",
  "border-x",
  "border-y",
  "border-b-0",
  "border-b-2",
  "border-dashed",
  "border-transparent",
  "border-t-transparent",
  // `box-sizing` pada style inline (`boxSizing: "border-box"`) —
  // bukan utilitas warna, ikut tertangkap pola `border-*`.
  "border-box",
  // bentuk & perilaku
  "bg-clip-padding",
  "divide-y",
  "outline-none",
  "outline-hidden",
  "ring-inset",
  "ring-offset-2",
]);

/**
 * Nilai non-token yang sah untuk utilitas warna (`border-transparent`
 * sudah di atas; ini sisanya).
 */
const COLOR_KEYWORDS = new Set(["transparent", "current", "inherit"]);

const COLOR_UTILS = [
  "bg",
  "text",
  "border",
  "ring",
  "divide",
  "decoration",
  "placeholder",
  "caret",
  "fill",
  "stroke",
  "outline",
] as const;

/** Ekstrak kandidat `util-token` dari teks (tanpa varian prefix & opacity). */
function extractCandidates(src: string): string[] {
  const found: string[] = [];
  const re = new RegExp(
    `(?<![\\w-])(?:[a-z][\\w-]*:)*(${COLOR_UTILS.join("|")})-([a-z][\\w-]*?)(?=\\/[0-9]|(?![\\w/-]))`,
    "g"
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const util = m[1];
    let token = m[2];
    // Kupas modifier opacity Tailwind (`bg-muted/50` -> `muted`).
    const slash = token.indexOf("/");
    if (slash >= 0) token = token.slice(0, slash);
    found.push(`${util}-${token}`);
  }
  return found;
}

describe("token warna terdefinisi (pencegah bg-surface)", () => {
  it("globals.css mendefinisikan token permukaan yang dipakai kode", () => {
    const tokens = definedTokens();
    for (const t of ["surface-page", "surface-card", "surface-elevated"]) {
      expect(tokens.has(t), `token ${t} harus ada di @theme inline`).toBe(true);
    }
    // Penanda insiden: token telanjang `surface` memang TIDAK ada —
    // kode dilarang merujuknya (lihat test di bawah).
    expect(tokens.has("surface")).toBe(false);
  });

  it("tidak ada kelas warna yang merujuk token tak terdefinisi", () => {
    const tokens = definedTokens();
    const offenders: string[] = [];
    for (const file of runtimeFiles) {
      const src = fs.readFileSync(file, "utf8");
      for (const cls of extractCandidates(src)) {
        if (NON_COLOR.has(cls)) continue;
        const token = cls.slice(cls.indexOf("-") + 1);
        if (COLOR_KEYWORDS.has(token)) continue;
        if (!tokens.has(token)) offenders.push(`${rel(file)}: ${cls}`);
      }
    }
    expect(offenders, "kelas merujuk token yang tidak ada di app/globals.css").toEqual([]);
  });
});
