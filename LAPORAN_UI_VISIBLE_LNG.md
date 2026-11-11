# Laporan Rebrand Visible UI — Logo, Login, Tema, Halaman Publik, 403/404/Error

**Branch:** `feat/ui-lng-visible` (dari `main` @ `e2367ec`)
**Tanggal:** 28 Oktober 2026
**Lingkup:** bagian rebrand LNG yang terlihat pengguna — Tugas 1 (token `bg-surface`),
Tugas 2 (logo & aset), Tugas 3 (login), Tugas 4 (pengalih tema), Tugas 5 (halaman publik),
Tugas 6 (403/404/error). Tanpa perubahan logika auth, permission, rute, guard, perilaku fitur.

## 1. Ringkasan: selesai dan belum

### Selesai

| Tugas | Hasil |
|---|---|
| 1. Perbaikan `bg-surface` | `bg-surface-elevated` + guard vitest `design-tokens.test.ts` (fail-closed, uji negatif lolos) |
| 2. Logo & aset | Logo di sidebar + header mobile; favicon/manifest/metadata merek; 7 ikon dari PNG apa adanya |
| 3. Login | Desain ulang satu kolom + Logo + toggle tema; perilaku & nama aksesibel identik; keyboard 21/21 |
| 4. Pengalih tema | Terang/Gelap/Sistem, tanpa kilatan, tanpa hydration mismatch; QA 9/9; di topbar + drawer + login + publik |
| 5. Halaman publik | `PublicShell` + verify/consent bermerek, noindex/nofollow, judul tanpa token, aman cetak |
| 6. 403/404/error | 404 global + error route bermerek; 403 selaras merek; ErrorBoundary tanpa detail teknis |
| QA | typecheck, eslint, vitest 594, raw-colors, kontras 136/136, axe 0 critical/serious, screenshot 30+30 |

### Belum / tindak lanjut

- **SVG logo final belum tersedia** — ikon memakai PNG 383 px (tampil ≤ 72 px, aman 2x/3x). Bila SVG resmi ada, ganti sumber di `components/logo.tsx` + regenerate ikon.
- **Tidak ada `app/favicon.ico` (.ico literal)** — ikon tab via `<link rel="icon">` ke `/icons/*`; browser tetap me-request `/favicon.ico` (404 console yang diabaikan di QA). Bila ingin bungkam total, sediakan file `.ico` (butuh tool ICO writer, tidak ada di repo).
- **Dark mode menyeluruh per halaman** — token diverifikasi bekerja (spot-check dashboard/login/verify/consent/not-found dark), audit visual tiap dari 30+ halaman bukan bagian sesi ini.
- **Cetak hitam-putih halaman verifikasi** — kelas `print:` dipasang + tombol Cetak, tetapi belum diuji di printer fisik.
- **Pengalih tema di header mobile** — hanya drawer mobile (topbar mobile sempit); login & publik & drawer tercakup.

## 2. Perbaikan bg-surface (Tugas 1)

**Insiden:** `components/logo.tsx` memakai `bg-surface`, tetapi `--color-surface` TIDAK ada di
`app/globals.css` (hanya `surface-page`, `surface-card`, `surface-elevated`). Tailwind 4 diam-diam
tidak menghasilkan utilitas tak dikenal — tanpa error build/lint/typecheck.

**Pengganti: `bg-surface-elevated`.** Fungsi chip `onDark`: memisahkan lambang dari latar gelap
(sidebar `--c-sidebar` `#0b2a4a`/dark `#08203a`, header gelap). Di light, elevated = putih
(perilaku identik dengan maksud semula); di dark, permukaan terangkat `#17283a` konsisten dengan
bahasa permukaan dark UI. Tanpa token baru, tanpa pasangan kontras baru (pembungkus logo bukan teks).

**Berkas terdampak:** `components/logo.tsx` (2 baris + komentar alasan).

**Pencegah:** `src/lib/__tests__/design-tokens.test.ts` — memindai seluruh kelas warna Tailwind di
`app/components/lib/src` dan memastikan tokennya terdaftar di `@theme inline`. Fail-closed: pola
non-warna tercatat eksplisit di `NON_COLOR`; menghormati `eslint-disable(-next)-line
rebrand/no-raw-colors` (selaras semantik ESLint). Uji negatif: probe `bg-fiktif-tidak-ada` di file
runtime membuat test gagal dengan lokasi tepat, lalu probe dihapus.

## 3. Logo & aset (Tugas 2)

**Tempat Logo dipasang** (ukuran ≤ 72 px, PNG 383 px aman hingga 3x):

| Tempat | Ukuran | Keterangan |
|---|---|---|
| Sidebar shell | `md` 32 px | + nama sistem (selalu lebar, tidak diciutkan) |
| Header mobile | `sm` 24 px | + nama sistem, latar kartu terang (tanpa `onDark`) |
| Login | `lg` 40 px | BrandHeader + nama + perusahaan, alt dekoratif |
| Halaman publik (kop) | `md` 32 px | + nama + perusahaan |
| 404 / error route | `lg` 40 px | + nama sistem di bawahnya |
| MFA view | `lg` via BrandHeader | sama dengan form login |

**Aset dari `public/brand/lng-flame.png` APA ADANYA** (hanya resize; lambang tidak diubah):
`public/icons/icon-16/32`, `apple-touch-icon` 180 (latar sidebar + padding 12%),
`icon-192/512` (any), `icon-maskable-192/512` (latar sidebar, lambang 80%).
Generator: `scripts/generate-brand-icons.mjs` (sharp).

**Metadata root:** title `Kodein Klinik — EMR PT Layar Nusantara Gas`, deskripsi konsisten merek,
`themeColor` biru sidebar light/dark (pindah `metadata` → `viewport` export sesuai Next 16),
`manifest.webmanifest` (PWA standalone, warna `#0b2a4a`), ikon PNG + apple-touch.
`app/favicon.ico` bawaan Next dihapus.

**Keputusan subjudul shell:** subjudul sidebar & footer DIKEMBALIKAN ke teks netral
(`EMR Okupasi`) setelah terbukti memecah E2E alur mutasi (strict-mode `getByText("PT Layar
Nusantara Gas")` menjadi 3 elemen). Nama perusahaan tetap penuh di login, publik, 404/error,
metadata. E2E milik pekerjaan lain TIDAK disentuh (anti-tabrakan).

## 4. Tema (Tugas 4)

**Konfigurasi:** `ThemeProvider` (`attribute="class"` — cocok `.dark` di `globals.css`),
`defaultTheme="system"` + `enableSystem`, `disableTransitionOnChange`;
`suppressHydrationWarning` di `<html>`. Preferensi oleh next-themes (localStorage key `theme`,
data non-sensitif).

**ThemeToggle:** radiogroup 3 pilihan (Terang/Gelap/Sistem) + ikon Lucide + label, `aria-checked`,
target 44 px, keyboard penuh, render aman hidrasi (`useSyncExternalStore` — bukan setState di
effect, lolos `react-hooks/set-state-in-effect`). Posisi: topbar desktop, drawer mobile, pojok
login, kop halaman publik (DOM setelah konten agar Tab konten tetap lebih dulu).

**Hasil QA (`scripts/qa-theme.mjs`, 9/9):** 3 radio + 1 checked; tanpa hydration error; klik
Gelap memasang `.dark` (body `rgb(11,22,34)`); Terang melepas; tersimpan; keyboard Space;
bertahan setelah reload; tanpa pageerror/console-error.

**Dark mode per halaman (spot-check screenshot):** dashboard, login, verify, consent, not-found —
konsisten, badge status terbaca. Tidak ada pasangan kontras baru (tidak ada token baru).

## 5. Halaman publik (Tugas 5)

**Rute terkonfirmasi:** `/public/consent/[token]`, `/verify/[token]` (lihat `lib/public-paths.ts`;
`/login` tercakup Tugas 3).

**Kerangka `components/public-shell.tsx`:** kop (Logo + nama + perusahaan + toggle),
konten max-w 720 px, footer, tanpa shell aplikasi. Toggle di kop (visual kanan, DOM setelah judul).

**Verify** (`app/verify/[token]/page.tsx` server + `components/verify-view.tsx` client):
hanya field kontrak `PublicVerifyResult` (judul, jenis, penerbit, tanggal, signature serial —
TIDAK ada data baru/sensitif); tiap status berikon + judul + penjelasan (valid/tidak-valid/
gagal/loading); tombol Cetak (`print:hidden`); cetak putih di kedua mode (`PRINT_PAPER`,
pengecualian guard yang sah); masking yang ada dipertahankan (`—` untuk kosong).

**Consent** (`app/public/consent/[token]/page.tsx` server + `public-consent.tsx`):
tiap phase dibungkus PublicShell; logika `decide`/kontrak one-time TIDAK berubah; tombol
Setuju/Tolak + konfirmasi sama; header kartu disederhanakan (kop sudah di shell).

**Keamanan:** `robots: noindex, nofollow` di kedua route; judul tab statis (token tidak di judul,
UI, log, pesan error); token hanya dipakai sebagai argumen API.

## 6. Kontras, axe, keyboard, visual regression

| Pemeriksaan | Hasil |
|---|---|
| `check-contrast.mjs` | 136/136 wajib lolos light+dark (tidak ada token baru) |
| `check-raw-colors.mjs` | 0 pelanggaran (267 file; pengecualian sah: hex themeColor viewport, `PRINT_PAPER`, hex generator ikon) |
| axe (`a11y-audit.mjs`, 33 halaman/state) | 0 violation, 0 critical/serious; 44 field bernama semua |
| keyboard (`a11y-keyboard-flow.mjs`) | 21/21 PASS di login baru (nama Username/Password/Masuk, Tab order, Enter, skip link, Rekam Medis) |
| visual regression | skrip `shot-before-visible.mjs` (+`SHOT_OUT_DIR`): 30 baseline (`before-visible`) + 32 sesudah (`after-visible`: 5 halaman ×3 lebar ×2 mode + not-found ×2 lebar ×2 mode) |
| `qa-theme.mjs` | 9/9 (baru) |
| `design-tokens.test.ts` | 2/2 (baru; total vitest 594 pass / 21 skip) |
| role-mapping-doc | 4/4 dalam vitest penuh |
| E2E Playwright | 14–15 pass; 6–7 fail (lihat §7 — baseline, bukan regresi) |
| role-scenarios | 0/8 — merah juga di build `main` (baseline, §7) |

## 7. Temuan di luar lingkup (dicatat, TIDAK diubah)

1. **6 skenario E2E `permission ditolak` gagal di langkah login** (pra-kerjaan; terbukti di build
   `main` Langkah 0: 15 pass/6 fail, pola identik — form stuck `Memeriksa…`). Penyebab: test tidak
   menyertakan fixture `backend` sehingga `installMockBackend` tidak berjalan dan tidak ada mock
   API. Rekomendasi pemilik E2E: tambahkan fixture `backend` pada 6 test itu.
2. **`scripts/role-scenarios.mjs` 0/8** — gagal juga di server build `main` (mis. `getByLabel('Pasien')`
   timeout). Drift stub-vs-UI pra-kerjaan; milik pekerjaan lain.
3. **Route kontrol sistem tanpa halaman** — guard A1 (`/system-config`, `/api-keys`, `/tte`,
   `/emergency-detail`) tidak punya halaman; prefetch RSC me-return 404 (diabaikan di `qa-theme`
   dengan catatan). Milik pekerjaan A1/RBAC.
4. **Kredensial demo di halaman login** — tetap digated (`NEXT_PUBLIC_ENABLE_DEMO` +
   `NEXT_PUBLIC_DEMO_PASSWORD`; produksi mati). Pesan OTP demo `123456` di view MFA setup-required
   tampil bila backend memintanya — mekanisme demo sah, tidak diubah.
5. **Request `/_next/image` untuk logo me-return 400 sebelum perbaikan** — middleware mengalihkan
   aset `/brand/*` ke login (tanpa cookie server-ke-server) lalu optimizer menerima HTML.
   Diperbaiki dengan mengecualikan `brand|icons|manifest.webmanifest` di matcher middleware
   (**logika auth tidak berubah** — hanya aset statis publik). Tanpa ini Logo rusak total.
6. **Perubahan perilaku yang disengaja (dicatat):** error inline login kini `role="alert"`;
   tombol Masuk menampilkan spinner + `Memeriksa…` saat submitting (nama aksesibel kembali
   `Masuk` setelah selesai — E2E/keyboard tidak query tombol saat submitting, terbukti 21/21);
   `ErrorBoundary` tidak lagi menampilkan `error.message` (detail teknis disembunyikan, log ke
   console); error 403 menambah tombol `Kembali` (heading + pesan PERSIS untuk E2E).
7. **Stash `rebrand-wip3`** di repo bukan milik sesi ini — tidak disentuh.
8. **Best-practice axe (info):** 16 halaman tanpa `h1`, 5 heading-order, 719 target < 44px —
   pra-kerjaan, bukan gate.

## 8. Yang perlu dicek manual oleh manusia

1. Perangkat nyata 360/768/1280 px: keseimbangan biru `#0B63C8` vs logo; drawer + toggle mobile.
2. Layar 2x/3x: ketajaman PNG logo (32–40 px tampil) dan ikon apple-touch.
3. Cetak halaman verifikasi di printer fisik (hitam-putih, tanpa latar berat).
4. Dark mode end-to-end tiap halaman (token lolos, spot-check sudah, bukan audit penuh).
5. Splash PWA + theme-color di browser mobile (light & dark).
6. Alur consent asli dengan token backend nyata (tidak diuji — hanya stub).
7. Keputusan nama perusahaan di shell (netral demi E2E) vs keinginan merek — bila merek
   mewajibkan, perbaiki E2E `getByText` menjadi exact/scoped lebih dulu.

## Lampiran: perintah verifikasi

```bash
npm run typecheck            # 0 error
npm run lint                 # exit 0 (artefak test-artifacts dihapus dulu)
npm test                     # 594 pass / 21 skip
node scripts/check-raw-colors.mjs   # 0 pelanggaran
node scripts/check-contrast.mjs     # 136/136
A11Y_BASE_URL=http://localhost:3318 node scripts/a11y-audit.mjs
A11Y_BASE_URL=http://localhost:3318 node scripts/a11y-keyboard-flow.mjs  # 21/21
THEME_BASE_URL=http://localhost:3318 node scripts/qa-theme.mjs           # 9/9
```
