#!/usr/bin/env node
/**
 * Kalkulator kontras WCAG untuk token desain (Tugas 9 — rebrand LNG).
 *
 * Membaca `app/globals.css`, menyelesaikan tiap token ke hex untuk mode
 * TERANG (`:root`) dan GELAP (`.dark`), lalu menghitung rasio WCAG 2.1:
 *   - teks normal     minimal 4.5:1  (WCAG AA 1.4.3)
 *   - teks besar/UI   minimal 3:1     (WCAG AA 1.4.11, non-teks)
 *
 * Keluar dengan exit code 1 bila ada pasangan di bawah ambang.
 * Dipakai di CI lewat `npm run test:contrast`.
 *
 * Env: CONTRAST_FILE (default app/globals.css), CONTRAST_JSON (path laporan JSON opsional)
 */
import fs from "node:fs";
import path from "node:path";

const FILE = process.env.CONTRAST_FILE ?? path.join("app", "globals.css");

/* ---------------------------------------------------------------- utilitas */

/** #rgb / #rrggbb -> [r,g,b] (0-255) */
function hexToRgb(hex) {
  const h = hex.trim().replace("#", "");
  if (h.length === 3) {
    return [
      parseInt(h[0] + h[0], 16),
      parseInt(h[1] + h[1], 16),
      parseInt(h[2] + h[2], 16),
    ];
  }
  if (h.length !== 6) throw new Error(`Hex tidak dikenal: ${hex}`);
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** WCAG relative luminance */
function luminance([r, g, b]) {
  const f = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(hexA, hexB) {
  const la = luminance(hexToRgb(hexA));
  const lb = luminance(hexToRgb(hexB));
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/* ------------------------------------------------------- parser globals.css */

const css = fs.readFileSync(FILE, "utf8");

/** Ambil isi blok selector pertama yang cocok. */
function blockOf(selector) {
  const idx = css.indexOf(selector);
  if (idx < 0) throw new Error(`Selector tidak ditemukan: ${selector}`);
  const open = css.indexOf("{", idx);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`Blok tidak tertutup: ${selector}`);
}

/** Parse `--name: value;` dari sebuah blok. */
function parseVars(block) {
  const out = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block))) out[m[1]] = m[2].trim();
  return out;
}

const lightVars = parseVars(blockOf(":root {"));
const darkVars = parseVars(blockOf(".dark {"));
const themeMap = parseVars(blockOf("@theme inline {")); // --color-x: var(--c-y)

/** Selesaikan `var(--c-x)` sampai dapat hex, pada mode tertentu. */
function resolve(themeName, mode) {
  const themeKey = `--color-${themeName}`;
  const start = themeMap[themeKey];
  if (!start) throw new Error(`Token tidak ada di @theme inline: ${themeName}`);
  let value = start;
  const seen = new Set();
  while (value.startsWith("var(")) {
    const name = value.slice(4, value.lastIndexOf(")")).trim();
    if (seen.has(name)) throw new Error(`Siklus referensi pada ${themeName}`);
    seen.add(name);
    const next = mode === "dark" && name in darkVars ? darkVars[name] : lightVars[name];
    if (next === undefined) throw new Error(`Variabel tidak didefinisikan: ${name}`);
    value = next;
  }
  if (!value.startsWith("#")) throw new Error(`Token ${themeName} bukan hex: ${value}`);
  return value;
}

/* -------------------------------------------------------------- daftar pasangan */

const TEXT = 4.5; // teks normal
const UI = 3.0; // komponen UI / grafis / batas

/**
 * [fg, bg, ambang, keterangan, dekoratif?]
 *
 * Pasangan bertanda `dekoratif: true` TIDAK dijadikan syarat gagal:
 *   - `border` adalah pemisah kartu/baris, bukan batas komponen interaktif
 *     (WCAG 1.4.11 hanya berlaku pada batas kompon UI yang perlu dikenali).
 *   - `sidebar-border` pemisah di dalam sidebar.
 *   - `sidebar-active` latar lembut; status item aktif ditandai `sidebar-marker`
 *     yang diuji 3:1 secara terpisah.
 * Keempatnya tetap dicetak sebagai informasi agar terdokumentasi.
 */
const PAIRS = [
  // --- teks pada permukaan netral ---
  ["foreground", "background", TEXT, "teks utama di latar halaman"],
  ["foreground", "surface-card", TEXT, "teks utama di kartu"],
  ["foreground", "muted", TEXT, "teks utama di area lembut"],
  ["text-secondary", "background", TEXT, "teks sekunder di latar"],
  ["text-secondary", "surface-card", TEXT, "teks sekunder di kartu"],
  ["muted-foreground", "background", TEXT, "keterangan di latar"],
  ["muted-foreground", "surface-card", TEXT, "keterangan di kartu"],
  ["muted-foreground", "muted", TEXT, "keterangan di baris tabel hover"],
  ["secondary-foreground", "secondary", TEXT, "teks tombol sekunder"],
  ["card-foreground", "card", TEXT, "teks kartu"],
  ["popover-foreground", "popover", TEXT, "teks popover"],
  ["destructive-foreground", "destructive", TEXT, "teks tombol destruktif"],
  ["accent-foreground", "accent", TEXT, "teks item aktif/accent"],

  // --- teks bermerek pada latar lembut & kartu ---
  ["primary", "background", TEXT, "link/aksi di latar"],
  ["primary", "surface-card", TEXT, "link/aksi di kartu"],
  ["primary", "primary-soft", TEXT, "teks item terpilih"],
  ["primary-foreground", "primary-600", TEXT, "label tombol utama"],
  ["primary-foreground", "primary-hover", TEXT, "label tombol utama saat hover"],
  ["primary-foreground", "primary", TEXT, "label pada bg-primary"],

  ["success", "surface-card", TEXT, "status Fit di kartu"],
  ["success", "success-soft", TEXT, "badge sukses"],
  ["success-foreground", "success-600", TEXT, "label pada bg-success"],

  ["danger", "surface-card", TEXT, "status Unfit di kartu"],
  ["danger", "danger-soft", TEXT, "badge bahaya"],
  ["danger-foreground", "danger-600", TEXT, "label tombol bahaya"],
  ["destructive", "surface-card", TEXT, "teks destruktif di kartu"],

  ["warning-text", "surface-card", TEXT, "teks peringatan di kartu"],
  ["warning-text", "warning-soft", TEXT, "badge peringatan"],

  ["info", "surface-card", TEXT, "teks info di kartu"],
  ["info", "info-soft", TEXT, "badge info"],
  ["info-foreground", "info-600", TEXT, "label pada bg-info"],

  // --- teks bermerek pada skala numerik (dipakai komponen yang sudah ada) ---
  ["primary-600", "surface-card", TEXT, "link primer di kartu"],
  ["primary-600", "background", TEXT, "link primer di latar"],
  ["success-600", "surface-card", TEXT, "teks sukses di kartu"],
  ["danger-600", "surface-card", TEXT, "teks bahaya di kartu"],
  ["warning-600", "surface-card", TEXT, "teks peringatan di kartu (skala)"],
  ["info-600", "surface-card", TEXT, "teks info di kartu (skala)"],
  ["primary-700", "primary-100", TEXT, "label ikon pada latar primer"],
  ["primary-600", "primary-100", TEXT, "langkah aktif pada latar primer"],
  ["success-600", "success-100", TEXT, "badge sukses (skala numerik)"],
  ["danger-600", "danger-100", TEXT, "badge bahaya (skala numerik)"],
  ["warning-600", "warning-100", TEXT, "badge peringatan (skala numerik)"],
  ["info-600", "info-100", TEXT, "badge info (skala numerik)"],
  ["muted-foreground", "popover", TEXT, "keterangan di popover"],
  ["foreground", "surface-elevated", TEXT, "teks di popover"],

  // --- sidebar ---
  ["sidebar-foreground", "sidebar", TEXT, "menu sidebar"],
  ["sidebar-muted", "sidebar", TEXT, "keterangan sidebar"],
  ["sidebar-foreground", "sidebar-active", TEXT, "menu sidebar aktif"],
  ["sidebar-muted", "sidebar-active", TEXT, "keterangan menu aktif"],
  ["sidebar-foreground", "sidebar-border", TEXT, "nada sidebar (aman)"],

  // --- non-teks: batas, cincin fokus, ikon ---
  ["border", "background", UI, "garis pemisah di latar", true],
  ["border", "surface-card", UI, "garis pemisah di kartu", true],
  ["input", "surface-card", UI, "batas input"],
  ["input", "background", UI, "batas input di latar"],
  ["input", "muted", UI, "batas input di area lembut"],
  ["ring", "surface-card", UI, "cincin fokus di kartu"],
  ["ring", "background", UI, "cincin fokus di latar"],
  ["ring", "muted", UI, "cincin fokus di area lembut"],
  ["warning", "surface-card", UI, "ikon/garis peringatan"],
  ["warning", "warning-soft", UI, "ikon peringatan pada latar peringatan"],
  ["primary-600", "background", UI, "batas tombol primer"],
  ["danger-600", "background", UI, "batas tombol bahaya"],
  ["success", "background", UI, "indikator sukses"],
  ["sidebar-border", "sidebar", UI, "pemisah sidebar", true],
  ["sidebar-active", "sidebar", UI, "latar menu sidebar aktif", true],
  ["sidebar-marker", "sidebar", UI, "penanda menu aktif"],
  ["sidebar-marker", "sidebar-active", UI, "penanda pada latar aktif"],
  ["chart-1", "surface-card", UI, "grafik 1"],
  ["chart-2", "surface-card", UI, "grafik 2"],
  ["chart-3", "surface-card", UI, "grafik 3"],
  ["chart-4", "surface-card", UI, "grafik 4"],
  ["chart-5", "surface-card", UI, "grafik 5"],
];

/* --------------------------------------------------------------- eksekusi */

const results = [];
let failed = 0;

for (const mode of ["light", "dark"]) {
  for (const [fg, bg, min, note, decorative] of PAIRS) {
    const optional = decorative === true;
    let ratio;
    try {
      ratio = contrast(resolve(fg, mode), resolve(bg, mode));
    } catch (err) {
      if (!optional) failed++;
      results.push({
        mode,
        fg,
        bg,
        note,
        ratio: null,
        min,
        ok: false,
        decorative: optional,
        error: err.message,
      });
      continue;
    }
    const ok = ratio + 1e-9 >= min;
    if (!ok && !optional) failed++;
    results.push({
      mode,
      fg,
      bg,
      note,
      ratio: Math.round(ratio * 100) / 100,
      min,
      ok,
      decorative: optional,
    });
  }
}

for (const mode of ["light", "dark"]) {
  console.log(`\n=== ${mode.toUpperCase()} ===`);
  for (const r of results.filter((x) => x.mode === mode)) {
    if (r.ratio === null) {
      console.log(`  ✗ ${r.fg} / ${r.bg} — ${r.error}`);
      continue;
    }
    const flag = r.ok ? "✓" : r.decorative ? "·" : "✗";
    const suffix = r.decorative && !r.ok ? " (dekoratif, di luar syarat 3:1)" : "";
    console.log(
      `  ${flag} ${String(r.ratio).padStart(6)} (min ${r.min})  ${r.fg} on ${r.bg}  — ${r.note}${suffix}`
    );
  }
}

if (process.env.CONTRAST_JSON) {
  fs.writeFileSync(process.env.CONTRAST_JSON, JSON.stringify(results, null, 2));
  console.log(`\nLaporan JSON: ${process.env.CONTRAST_JSON}`);
}

const required = results.filter((r) => !r.decorative);
const optional = results.filter((r) => r.decorative);
const optionalBelow = optional.filter((r) => !r.ok).length;
console.log(
  `\n${required.filter((r) => r.ok).length}/${required.length} pasangan WAJIB lolos kontras WCAG AA (${FILE})`
);
if (optional.length) {
  console.log(
    `${optionalBelow}/${optional.length} pasangan dekoratif di bawah 3:1 (dicatat, bukan kegagalan)`
  );
}
if (failed > 0) {
  console.error(`GAGAL: ${failed} pasangan wajib di bawah ambang.`);
  process.exit(1);
}