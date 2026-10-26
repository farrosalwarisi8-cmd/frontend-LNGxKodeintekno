/**
 * Aturan ESLint: melarang warna tertulis langsung di luar berkas token.
 *
 * Dilarang:
 *   1. Kelas utilitas Tailwind yang memakai palet warna mentah
 *      (bg-blue-600, text-slate-500, border-amber-200, divide-zinc-100, dst.)
 *   2. Kelas utilitas bg-white / text-white / dst.
 *   3. Nilai hex (#0B63C8) dan fungsi rgb()/hsl()/rgba()/hsla().
 *
 * Semua warna harus datang dari token semantik di `app/globals.css`
 * (bg-primary, text-muted-foreground, border-input, bg-success-soft, ...).
 *
 * Pengecualian yang sah (sengaja tidak ditangani aturan ini):
 *   - `app/globals.css` — berkas token itu sendiri (bukan file JS, tidak dilint)
 *   - aset logo di `public/brand/` — berkas biner, bukan kode
 *   - konfigurasi chart — bila suatu saat diperlukan, gunakan token chart
 *     (`--color-chart-1..5`) atau eslint-disable-next-line dengan alasan.
 *
 * Lingkup: berkas UI (app, components, lib, src, e2e, scripts, middleware,
 * konfigurasi root). Berkas di luar UI (mis. KODEINxLNG-Backend) dikecualikan.
 */

const PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const UTILS =
  "bg|text|border|ring|fill|stroke|outline|shadow|divide|decoration|placeholder|caret|from|via|to";

/** Kandidat: prefix varian (hover:, focus:, dark:, ...) lalu utilitas + palet. */
const prefix = `(?:[a-z][\\w-]*:)*(?:${UTILS})-`;

const PATTERNS = [
  { label: "kelas palet Tailwind", re: new RegExp(`(?<![\\w-])(${prefix}(?:${PALETTE})-\\d{1,3})(?![\\w-])`, "g") },
  { label: "kelas putih/hitam", re: new RegExp(`(?<![\\w-])(${prefix}(?:white|black))(?![\\w-])`, "g") },
  { label: "nilai hex", re: /(?<![\w-])(#[0-9a-fA-F]{3,8})(?![\w-])/g },
  { label: "fungsi rgb/hsl", re: /\b((?:rgba?|hsla?)\()/g },
];

const MESSAGE =
  "Warna tertulis langsung ({{value}}, {{kind}}). Pakai token semantik dari " +
  "app/globals.css — mis. bg-primary, text-muted-foreground, border-input, " +
  "bg-success-soft. Lihat DESIGN_SYSTEM.md untuk daftar token.";

/** @type {import("eslint").Rule.RuleModule} */
const noRawColors = {
  meta: {
    type: "problem",
    docs: {
      description: "larang warna mentah (hex, rgb, kelas palet) di luar berkas token",
    },
    schema: [],
    messages: { rawColor: MESSAGE },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    return {
      Program() {
        const text = sourceCode.getText();
        for (const { label, re } of PATTERNS) {
          re.lastIndex = 0;
          let m;
          while ((m = re.exec(text)) !== null) {
            const loc = sourceCode.getLocFromIndex(m.index);
            context.report({
              loc,
              messageId: "rawColor",
              data: { value: m[1], kind: label },
            });
          }
        }
      },
    };
  },
};

export default noRawColors;