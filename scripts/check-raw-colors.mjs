#!/usr/bin/env node
/**
 * Gerbang warna mentah (rebrand LNG) — dipakai CI job `raw-colors`.
 *
 * Menjalankan ESLint pada lingkup UI lalu menyaring HANYA aturan
 * `rebrand/no-raw-colors`. Exit 1 bila ada pelanggaran (daftar file:baris).
 * Baseline lint lain TIDAK ikut dinilai — sudah merah sejak sebelum rebrand
 * (lihat LAPORAN_UI_REBRAND_LNG.md), sama seperti komentar di workflow.
 *
 * Kenapa skrip terpisah, bukan `node -e "..."` dalam blok `run:` YAML:
 * blok itu dieksekusi bash, dan backtick template literal di dalam double
 * quotes menjadi command substitution. Kegagalannya `bad substitution` lalu
 * SyntaxError — crash sebelum sempat menilai pelanggaran warna sama sekali.
 *
 * Pemakaian: node scripts/check-raw-colors.mjs
 */
import { ESLint } from "eslint";

const RULE = "rebrand/no-raw-colors";
const TARGETS = ["app", "components", "lib", "src", "e2e", "scripts", "middleware.ts"];

const eslint = new ESLint({ errorOnUnmatchedPattern: false });
const results = await eslint.lintFiles(TARGETS);

const bad = results.flatMap((file) =>
  file.messages
    .filter((m) => m.ruleId === RULE)
    .map((m) => `${file.filePath}:${m.line}:${m.column} ${m.message}`)
);

if (bad.length) {
  console.error(`Warna tertulis langsung ditemukan (${bad.length}):`);
  console.error(bad.join("\n"));
  console.error(
    "\nPakai token semantik dari app/globals.css — mis. bg-primary, " +
      "text-muted-foreground, border-input, bg-success-soft."
  );
  process.exit(1);
}

console.log(`0 pelanggaran warna mentah di luar app/globals.css (${results.length} file dinilai)`);
