# Laporan Frontend Harian — 27 Oktober 2026

**Tanggal:** 27 Oktober 2026
**Repo:** `kodein-klinik-demo` — branch `main` bersih
**Ruang lingkup:** semua yang masuk `main` hari ini (2 merge + 5 komit langsung)

## 1. Ringkasan eksekutif

Hari ini frontend mencapai **baseline hijau penuh**: `eslint` exit 0 tanpa output,
`tsc --noEmit` bersih, guard warna mentah 0 pelanggaran, dan kontras WCAG 136/136 lolos.
Pekerjaan hari ini terdiri dari tiga gelombang:

1. **Mendaratkan dua branch ke `main`** — prasyarat RBAC (A1) dan rebrand UI LNG.
2. **Memperbaiki CI + lint** — guard warna mentah yang crash di bash dipindah ke skrip,
   cakupan lint dibatasi ke repo frontend, lalu 55 warning dibersihkan sampai nol.
3. **Komponen Logo LNG** — lambang merek yang selama ini hanya ada di worktree kini
   masuk `main` sebagai `components/logo.tsx`.

| Pemeriksaan akhir (dijalankan saat menyusun laporan) | Hasil |
|---|---|
| `npx eslint .` / `npm run lint` | ✅ exit 0, log kosong (0 error, 0 warning) |
| `npm run typecheck` (`tsc --noEmit`) | ✅ 0 error |
| `node scripts/check-raw-colors.mjs` | ✅ 0 pelanggaran dari 256 file |
| `node scripts/check-contrast.mjs` | ✅ 136/136 pasangan wajib lolos (light + dark) |
| `vitest` (dari pesan komit `0462ed1`, tidak dijalankan ulang) | 592 pass / 21 skip |

## 2. Komit hari ini

| Jam (WIB) | Hash | Judul |
|---|---|---|
| 05:46 | `ecf2fbd` | Merge branch `feat/a1-prasyarat` ke main |
| 06:39 | `8a94947` | Merge branch `feat/ui-lng-rebrand` ke main |
| 06:56 | `12c6bcb` | fix(ci): guard warna mentah dipindah ke skrip |
| 06:57 | `f9891a9` | chore(scripts): tambah npm script `test:raw-colors` |
| 07:04 | `5763001` | chore(lint): batasi lint ke repo ini, `eslint .` kembali exit 0 |
| 07:36 | `0462ed1` | chore(lint): bersihkan 55 warning sampai nol masalah |
| 07:38 | `e2367ec` | feat(ui): komponen Logo LNG (`components/logo.tsx`) |

## 3. Yang dikerjakan

### 3.1 Merge A1 prasyarat (`ecf2fbd`)

Mendaratkan 3 komit RBAC (ditulis 20 Okt, baru masuk `main` hari ini):

- `8df3535` — memulihkan permission HR & Admin Klinik yang terhapus di luar niat
  (`manage-employees`, `upload-document`, `create-mcu`), plus guard route kontrol
  sistem (`/system-config`, `/api-keys`, `/tte`, `/emergency-detail`) agar
  guard = navigasi. Memperbaiki 7 unit test permission yang gagal.
- `235f206` — mencabut `view-mcu` dari role lab sesuai matriks Fase A1
  (analis lab/radiolog hanya mengelola data penunjang). Pintasan MCU di dashboard
  lab diganti laporan; bottom nav & test diperbarui; ada guard test agar
  `view-mcu` tidak kembali ke lab.
- `a30375d` — `ROLE_MAPPING.md` kini digenerate dari kode via
  `scripts/generate-role-mapping.mjs` (sumber: `lib/rbac.ts`,
  `auth.service.ts`, `demo-role-map.ts`). Mode `--check` mendeteksi file usang,
  sehingga matriks permission tidak bisa menyimpang dari kode.

### 3.2 Merge rebrand UI LNG (`8a94947`)

Mendaratkan fondasi rebrand (6 komit inti 26 Okt, + riwayat E2E/RBAC pendukung).
Diff merge: **149 file, +2.514 / −1.323**. Isi utama:

- **Token desain LNG** (`app/globals.css` ditulis ulang) — 89 nilai token × 2 mode
  (light + dark): skala primer/success/danger/warning/info, token semantik,
  token sidebar, token chart. Aksen teal `#14b8a6` → biru LNG `#0B63C8`.
- **Peta status klinis terpusat** (`lib/status-map.ts` + `components/status-badge.tsx`)
  — satu berkas ikon + label untuk 12 situs render; `lib/constants.ts` tetap
  re-export agar 24+ konsumen tidak berubah.
- **Restyle design system & shell** — `components/ui/*`, `emr-shell`,
  `src/shared/components/design-system/*` memakai token; font serif rusak
  (`var(--font-inter)` tak terdefinisi) diperbaiki ke system sans-serif;
  chip peran dinetralkan (warna lama bentrok dengan arti hijau/merah).
- **Konversi 1.170 kelas warna mentah → token semantik → 0.** Teratas:
  `lib/constants.ts` (76), `employee-profile.tsx` (66),
  `registration-wizard.tsx` (58), `people/new` (58), `mcu/new` (51).
- **Guard + kontras + CI** — ESLint `rebrand/no-raw-colors`
  (`eslint-rules/no-raw-colors.mjs`), skrip kontras WCAG
  (`scripts/check-contrast.mjs`, 136/136), workflow
  `.github/workflows/design-tokens.yml`.
- **Aset + bukti visual** — `public/brand/lng-flame.png` (PNG transparan 383×383),
  60 screenshot sebelum/sesudah (10 halaman × 3 lebar × 2 waktu) di
  `docs/ui-rebrand/`, dan `LAPORAN_UI_REBRAND_LNG.md`.
  Detail tabel token, peta penggantian, dan keputusan desain ada di laporan itu.

### 3.3 Perbaikan CI guard warna mentah (`12c6bcb`)

Blok `node -e "..."` di job `raw-colors` memakai template literal berbacktick di
dalam double quotes — bash mengeksekusinya sebagai command substitution, job crash
(`bad substitution` + SyntaxError) sebelum sempat menilai pelanggaran apa pun.
Guard dipindah ke `scripts/check-raw-colors.mjs`
yang memakai ESLint Node API (tanpa shell) dan hanya menyaring aturan
`rebrand/no-raw-colors`. Kontrak sama: baseline lint lain tidak dinilai.
Diverifikasi lokal: 0 pelanggaran dari 256 file; probe berisi
`text-blue-600`/`bg-blue-50` membuat skrip exit 1 dengan kedua pelanggaran
tercetak, lalu lolos lagi setelah probe dihapus.

### 3.4 Script `test:raw-colors` (`f9891a9`)

Satu baris di `package.json`: `"test:raw-colors": "node scripts/check-raw-colors.mjs"`,
sejajar dengan `test:contrast` — guard bisa dijalankan lokal dengan perintah yang
sama persis seperti CI.

### 3.5 Scope lint dikembalikan hijau (`5763001`)

Seluruh error baseline (483 `no-require-imports`, 193 `no-explicit-any`,
8 `no-assign-module-variable`) berasal dari `KODEINxLNG-Backend/` — proyek NestJS
sibling yang tidak ter-track git, masuk `.gitignore`, dan punya `eslint.config`
sendiri. Folder itu dikeluarkan via `globalIgnores` di
`eslint.config.mjs` sehingga lint frontend
hanya menilai repo ini. Hasil: `npx eslint .` dan `npm run lint` exit 0.
Sisa saat itu: 55 warning di kode ter-track.

### 3.6 55 warning → 0 (`0462ed1`)

Pembersihan nyata di 25 file (42 tambah / 58 hapus), tanpa pengecualian aturan:

- 35 import tak terpakai dihapus dari halaman `app/` (varian `Card*`, ikon lucide,
  `Link`, `formatDate`, `Modal`, `useStore`, tipe `SignatureStatus`).
- Destructure tak terpakai dirapikan tanpa membuang efek: pemanggilan
  `createSample`/`login`/`getToken`/`visit` dibiarkan sebagai statement, baris
  murni (`invRow`, `pcmRow`, `medPcm`, `DENIED`, `nextHeader`) dibuang,
  `const [qrToken, setQrToken]` menjadi `const [, setQrToken]`.
- `afterAll` noop + impor `afterAll` yang menganggur dihapus dari live-backend test.
- Dua stub `iam.service` yang selalu throw kini membaca paramnya via `void input;`.
- Redirect 401 di `api-client` memakai URL absolut
  `new URL("/login", window.location.origin).href`; stub location di test diberi
  `origin` dan asersi menjadi `http://localhost/login`.
- `vitest.config`: param `resolveAlias(source, importer)` → `resolveAlias(source)`.

Verifikasi komit: `eslint` log kosong, `tsc` bersih, vitest 592 pass / 21 skip,
guard warna 0 pelanggaran.

### 3.7 Komponen Logo LNG (`e2367ec`)

Baru: `components/logo.tsx` (71 baris) —
satu-satunya lambang merek yang boleh dipakai di UI, membungkus
`public/brand/lng-flame.png` (yang sudah masuk `main` lewat merge rebrand).
API: `size` (`sm` 24 / `md` 32 / `lg` 40 / `xl` 56 / `2xl` 72), `alt` (default `""`
dekoratif), `onDark` (chip terang untuk latar gelap), `priority`, `className`.
Aturan merek didokumentasikan di komentar: jangan recolor/miringkan/regangkan,
jangan tampil tanpa nama sistem di dekatnya. ESLint file ini bersih termasuk
guard warna; `tsc` tanpa error. **Belum ada yang meng-import `@/components/logo`.**

## 4. Tindak lanjut

1. **`bg-surface` belum punya token.** Prop `onDark` memakai `bg-surface`, tetapi
   `--color-surface` tidak ada di `app/globals.css` (yang ada: `surface-page`,
   `surface-card`, `surface-elevated`). Saat komponen dipakai, pilih token
   pengganti — chip terang di atas latar gelap kemungkinan maksudnya `bg-card`
   atau `bg-surface-elevated`.
2. **Pasang Logo di shell/login** — komponen sudah ada tapi belum dipakai di mana pun.
3. **Pengalih tema (dark mode)** — token dark terverifikasi bekerja, tapi pengguna
   belum bisa mengaktifkannya (Tugas 7 rebrand, `next-themes` sudah terpasang).
4. **Cek manual manusia** (dari laporan rebrand): render 360/768/1280 px di perangkat
   nyata, cetak hitam-putih halaman sertifikat/laporan/SOAP, dan keputusan aset
   logo final (SVG bila tersedia; `public/BAJU.png` masih jadi sumber salinan).

## Lampiran: perintah verifikasi

```bash
npx eslint .                        # exit 0, log kosong
npm run typecheck                   # tsc --noEmit, 0 error
node scripts/check-raw-colors.mjs   # 0 pelanggaran (256 file dinilai)
node scripts/check-contrast.mjs     # 136/136 wajib lolos
npm test                            # 592 pass / 21 skip (angka dari komit 0462ed1)
```
