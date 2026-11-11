#!/usr/bin/env node
/**
 * Tugas 2 — hasilkan ikon aplikasi dari `public/brand/lng-flame.png` APA ADANYA.
 *
 * Tidak menggambar ulang / mewarnai ulang / meregangkan lambang: hanya resize
 * (lanczos bawaan sharp) + komposit di atas latar bila format menuntutnya
 * (maskable & apple-touch butuh latar penuh; dipakai biru sidebar `--c-sidebar`
 * agar ikon selaras merek — lambang sendiri tidak disentuh).
 *
 * Keluaran:
 *   public/icons/icon-16.png, icon-32.png        (favicon PNG)
 *   public/icons/apple-touch-icon.png (180)
 *   public/icons/icon-192.png, icon-512.png     (manifest, purpose any)
 *   public/icons/icon-maskable-192.png, icon-maskable-512.png (purpose maskable,
 *     lambang 80% di tengah latar sidebar agar aman zona maskable)
 *
 * Dijalankan: node scripts/generate-brand-icons.mjs
 */
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "public", "brand", "lng-flame.png");
const OUT = path.join(ROOT, "public", "icons");

// Biru sidebar merek (disalin dari --c-sidebar di app/globals.css). Skrip ini
// menggambar piksel ikon (bukan kelas Tailwind), jadi hex literal adalah
// pengecualian sah dari guard no-raw-colors — sama seperti aset logo biner.
/* eslint-disable rebrand/no-raw-colors -- generator piksel ikon, bukan kelas CSS */
const SIDEBAR = "#0b2a4a";
/* eslint-enable rebrand/no-raw-colors */

fs.mkdirSync(OUT, { recursive: true });

async function resize(name, size, opts = {}) {
  const { background = null, paddingScale = 0 } = opts;
  let img = sharp(SRC);
  if (paddingScale > 0) {
    // Kecilkan lambang lalu komposit di tengah kanvas penuh.
    const inner = Math.round(size * (1 - paddingScale));
    const logo = await sharp(SRC).resize(inner, inner, { fit: "contain" }).toBuffer();
    img = sharp({ create: { width: size, height: size, channels: 4, background } }).composite([
      { input: logo, gravity: "center" },
    ]);
  } else {
    img = img.resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });
  }
  await img.png().toFile(path.join(OUT, name));
  console.log(`ok ${name} (${size}x${size})`);
}

await resize("icon-16.png", 16);
await resize("icon-32.png", 32);
await resize("apple-touch-icon.png", 180, { background: SIDEBAR, paddingScale: 0.12 });
await resize("icon-192.png", 192);
await resize("icon-512.png", 512);
await resize("icon-maskable-192.png", 192, { background: SIDEBAR, paddingScale: 0.2 });
await resize("icon-maskable-512.png", 512, { background: SIDEBAR, paddingScale: 0.2 });
console.log("selesai -> public/icons/");
