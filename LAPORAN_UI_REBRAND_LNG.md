# LAPORAN REBRAND UI — EMR PT Layar Nusantara Gas

**Branch:** `feat/ui-lng-rebrand` (dari `main` @ `d4ab4da`)
**Cakupan dikerjakan:** Tugas 1 (fondasi token), Tugas 2 (hapus warna mentah + guard), sebagian Tugas 9 (skrip kontras WCAG), penempatan berkas logo.
**Tanggal:** 26 Oktober 2026

---

## 1. Ringkasan

### Selesai

| Item | Status | Bukti |
|---|---|---|
| Token desain LNG di satu berkas (`app/globals.css`), light + dark | ✅ | 89 nilai token × 2 mode |
| Skala warna primer/success/danger/warning/info + token semantik + token sidebar + token chart | ✅ | bagian 3 |
| Token status klinis terpusat **satu berkas** dengan ikon + label (`lib/status-map.ts` + `StatusBadge`) | ✅ | 12 situs render dimigrasi |
| 1.170 kelas warna mentah → token semantik | ✅ | 1.170 → **0** (bagian 4) |
| Guard ESLint `rebrand/no-raw-colors` (gagal pada hex/rgb/kelas palet) | ✅ | 0 pelanggaran, `eslint-rules/no-raw-colors.mjs` |
| Skrip kontras WCAG light + dark, exit 1 bila gagal | ✅ | `scripts/check-contrast.mjs`, **136/136 wajib lolos** |
| Kontras dijalankan di CI | ✅ | `.github/workflows/design-tokens.yml` |
| Perbaikan tipografi (font-family rusak → system stack) | ✅ | screenshot login sebelum/sesudah |
| Berkas logo diletakkan di `public/brand/lng-flame.png` | ✅ | PNG RGBA latar **transparan** (bukan putih solid) |
| Screenshot sebelum/sesudah (10 halaman × 3 lebar) | ✅ | `docs/ui-rebrand/{before,after}/` |

### Belum (di luar keputusan cakupan sesi ini)

Tugas 3 (komponen Logo, favicon/PWA manifest, halaman login 403/404 baru), Tugas 4 (sidebar navy, topbar, bottom-nav, banner lingkungan), Tugas 5 (restyle design system + konsolidasi duplikat), Tugas 6 (poles halaman prioritas), Tugas 7 (pengalih tema + persistensi dark mode), Tugas 8 (gerak/hover), Tugas 9 penuh (axe mode dark, visual regression Playwright, cek cetak), Tugas 10 (`DESIGN_SYSTEM.md`, katalog `/dev/design-system`).

Nilai **dark mode sudah tersedia di token** dan terverifikasi bekerja (lihat bagian 6), tetapi **belum ada pengalih tema** sehingga pengguna belum bisa mengaktifkannya.

---

## 2. Peta struktur repo

### Pohon yang benar-benar dipakai

```
app/                     ← App Router (halaman, layout, globals.css = SATU-SATUNYA berkas token)
├── (app)/, login/, public/, verify/
components/
├── ui/                  ← lapisan dasar (Base UI + CVA + cva variants) — 108 import
├── emr-shell.tsx        ← shell aplikasi (sidebar/topbar/skip-link)
└── status-badge.tsx     ← BARU: badge status ikon+label
lib/                     ← logika aplikasi: store, rbac, constants, types, seed, format
src/
├── shared/components/design-system/  ← lapisan halaman — 167 import dari 24 halaman
├── features/            ← fitur (people, lab, mcu, pharmacy, dashboard, radiology, dll.)
├── lib/                 ← KLIEN API: api-client, env, fonts, navigation, services/*
```

**Kesimpulan:** keduanya hidup. `components/ui` = dasar (dipakai shell & features), `src/shared/components/design-system` = lapisan yang dipakai halaman. `src/lib` = klien API/layer backend, terpisah dari `lib` (logika app). Alias `@/*` menunjuk ke `./*` **dan** `./src/*` sehingga kedua pohon terlihat dari satu jalur.

### Duplikat / mati (dipetakan, TIDAK dihapus)

| Temuan | Detail | Rekomendasi |
|---|---|---|
| 11 dari 12 komponen `design-system` duplikat dengan `components/ui` | `card`, `input`, `select`, `modal` adalah **implementasi independen** (markup sendiri); sisanya (button/badge/skeleton/empty-state/error-state/avatar/tabs) hanya wrapper | Tugas 5: jadikan `design-system/*` re-export murni dari `components/ui/*` — jangan dikerjakan sebelum dipetakan ulang |
| Dua root `lib/` | `lib/` (app) vs `src/lib/` (API) | pertahankan, dokumentasikan |
| `LAPORAN_* copy.md` × 15 | duplikat identik | bersihkan di repo terpisah |
| `kodein-klinik-demo.rar` 555 MB, `NUL`, `tmp2.mjs`, `tmp3/`, `*-log`, `test-results*.json` | sampah artefak | masuk `.gitignore`, jangan di-commit |
| `app/favicon.ico` saja | tidak ada `public/manifest.*`, tidak ada ikon PWA | Tugas 3 |
| `src/lib/store.ts` | sudah dihapus sesuai `ACCESS_ARCHITECTURE.md` | ✅ sesuai aturan |

### Sumber gaya sebenarnya

**`app/globals.css`** (`@theme inline` + blok `:root`/`.dark`). Struktur baru: nilai disimpan di variabel `--c-*` pada `:root`/`.dark`, lalu dipetakan ke nama token Tailwind lewat `@theme inline`. Dua lapis ini **wajib** agar utilitas merujuk `var(--c-...)` — tanpa itu perubahan `.dark` tidak pernah sampai ke utilitas (terverifikasi, bagian 6).

---

## 3. Tabel token final + hasil kontras

Identitas diambil dari logo api PT LNG (merah `#F50405`, biru `#0A7DF2`, hijau `#087C24`).
Nilai mentah logo **tidak dipakai untuk teks** (tidak lolos kontras); dipakai varian hasil penyesuaian.

| Token | Light | Dark |
|---|---|---|
| `background` | #f5f8fc | #0b1622 |
| `surface` | #ffffff | #12202f |
| `surface-raised` | #ffffff | #17283a |
| `muted` | #eff3f8 | #1b2c40 |
| `border` | #d6dee6 | #25384c |
| `input` (batas kontrol) | #7f8d9d | #6b819b |
| `foreground` | #0f1e2b | #e6eef6 |
| `text-secondary` | #35485c | #c7d5e4 |
| `muted-foreground` | #55677a | #9fb3c8 |
| `ring` | #0b63c8 | #4da3ff |
| `primary` | #0b63c8 | #4da3ff |
| `primary-hover` | #0a52a5 | #2e86f0 |
| `primary-soft` | #eaf3fd | #14324f |
| `primary-foreground` | #ffffff | #06121f |
| `primary-50/100` | #eaf3fd / #dcebfd | #0f2740 / #14324f |
| `primary-200..500` | #b9d5fa · #8db9f5 · #4f91ea · #1a72d6 | (sama) |
| `primary-600/700` | #0b63c8 / #0a52a5 | #4da3ff / #7cbfff |
| `primary-800/900` | #08427f / #062f5a | (sama) |
| `success` | #087c24 | #3fbf6a |
| `success-soft` | #e7f4ea | #0f2a18 |
| `success-foreground` | #ffffff | #04210d |
| `success-50/100` | #edf8f1 / #e2f4e7 | #07210f / #0f2a18 |
| `success-200..500` | #c3e9cd · #74bc8b · #3aa466 · #0a8e2b | (sama) |
| `success-600/700` | #087c24 / #06631c | #3fbf6a / #2fa85a |
| `success-800/900` | #054a16 / #04310f | (sama) |
| `danger` | #d1060a | #ff6b6b |
| `danger-soft` | #fdecec | #331618 |
| `danger-foreground` | #ffffff | #2a0000 |
| `danger-50/100` | #fdf6f6 / #fdecec | #3a1414 / #331618 |
| `danger-200..500` | #f8d5d5 · #ed8284 · #e4494d · #d9161b | (sama) |
| `danger-600/700` | #d1060a / #ad0508 | #ff6b6b / #ff8f8f |
| `danger-800/900` | #8a0406 / #670305 | (sama) |
| `warning` (garis/ikon) | #b07a1e | #e7b25a |
| `warning-text` | #8a5a0b | #e7b25a |
| `warning-soft` | #fdf3dc | #33260e |
| `warning-foreground` | #2b1a02 | #2a1c02 |
| `warning-50/100` | #fdf3dc / #fbe9c8 | #33260e / #2c210c |
| `warning-200..500` | #f6d89f · #efc274 · #e3b04b · #c79230 | (sama) |
| `warning-600/700` | #8a5a0b / #6e4708 | #e7b25a / #d09a3f |
| `warning-800/900` | #573806 / #402904 | (sama) |
| `info` | #0a52a5 | #63acf7 |
| `info-soft` | #e3f0fe | #14324f |
| `info-foreground` | #ffffff | #06121f |
| `info-50/100` | #f4f9ff / #e3f0fe | #0f2740 / #14324f |
| `info-200..500` | #c4dffc · #95c7f9 · #4fa6f6 · #0a7df2 | (sama) |
| `info-600/700` | #0a52a5 / #08407f | #63acf7 / #4f9bea |
| `info-800/900` | #06305f / #052242 | (sama) |
| `sidebar` | #0b2a4a | #08203a |
| `sidebar-foreground` | #e6eef6 | #e6eef6 |
| `sidebar-muted` | #9fb3c8 | #9fb3c8 |
| `sidebar-border` | #1c4066 | #173455 |
| `sidebar-active` | #123f6e | #123f6e |
| `sidebar-marker` | #4f91ea | #63acf7 |
| `chart-1..5` | #0b63c8 · #087c24 · #0a7df2 · #d1060a · #55677a | #4da3ff · #3fbf6a · #63acf7 · #ff6b6b · #9fb3c8 |

Token lama yang **nama-nya dipertahankan** agar kode yang sudah ada ikut berubah otomatis: `surface-page`, `surface-card`, `surface-elevated`, `border-default`, `text-primary`, `text-secondary`, `text-muted`, `secondary`, `secondary-foreground`, `accent`, `destructive`, `destructive-foreground`, `card`, `popover`, `background`, `foreground`, `muted`, `muted-foreground`, `border`, `input`, `ring`, `primary*`, `success-*`, `warning-*`, `danger-*`, `info-*`, `--space-*`, `--text-*`, `--leading-*`, `--radius-*`.

### Hasil kontras (WCAG 2.1 AA)

`node scripts/check-contrast.mjs` → **136/136 pasangan wajib lolos**, light **dan** dark.
Ambang: teks 4,5:1; komponen UI/grafis 3:1.

Contoh hasil:

| Pasangan | Light | Dark | Ambang |
|---|---|---|---|
| `foreground` / `background` | 15.4 | 15.6 | 4.5 |
| `muted-foreground` / `surface-card` | 5.6 | 7.7 | 4.5 |
| `text-secondary` / `surface-card` | 9.4 | 11.1 | 4.5 |
| `primary` / `surface-card` | 5.6 | 6.3 | 4.5 |
| `primary-foreground` / `primary-600` | 5.6 | 7.2 | 4.5 |
| `success-600` / `success-100` | 4.6 | 6.8 | 4.5 |
| `danger-600` / `danger-100` | 4.9 | 6.8 | 4.5 |
| `warning-600` / `warning-100` | 4.9 | 8.0 | 4.5 |
| `info-600` / `info-100` | 6.5 | 5.5 | 4.5 |
| `sidebar-foreground` / `sidebar-active` | 9.1 | 9.1 | 4.5 |
| `ring` / `surface-card` | 5.6 | 6.3 | 3.0 |
| `input` / `surface-card` | 3.4 | 4.1 | 3.0 |
| `warning` / `surface-card` (ikon) | 3.7 | 8.6 | 3.0 |

**8 pasangan dekoratif** dicetak terpisah, sengaja di luar syarat 3:1 (dokumentasi di skrip): `border` vs latar/kartu, `sidebar-border` vs `sidebar`, `sidebar-active` vs `sidebar`. Alasan: pemisah kartu/baris bukan batas komponen interaktif (WCAG 1.4.11 hanya berlaku pada batas yang perlu dikenali); status menu aktif ditandai `sidebar-marker` yang **diuji 3:1**.

### Nilai yang disesuaikan dari tabel prompt (kontras memaksa)

| Token | Prompt | Menjadi | Alasan |
|---|---|---|---|
| `warning` | #E3B04B | **#b07a1E** | #E3B04B hanya 1,8:1 di atas `warning-soft` dan 1,9:1 di atas putih → gagal 3:1 untuk ikon/garis. Nilai asli tetap ada sebagai `warning-400` untuk isian dekoratif. |
| `success-100` | — | **#e2f4e7** (di-terangkan) | `bg-success-100` + `text-success-600` semula 4,26:1 → lolos 4,6:1 |
| `danger-100` | — | **#fdecec** | `bg-danger-100` + `text-danger-600` semula 4,30:1 → lolos 4,9:1 |
| `input` | tidak ada di tabel | **#7f8d9d / #6b819b** | batas kontrol wajib 3:1; `border` tetap tipis #d6dee6 (dekoratif) |
| `text-secondary` | tidak ada di tabel | **#35485c / #c7d5e4** | tingkat teks kedua dipakai 169 tempat (slate-600/700) |
| `primary-hover` dark | #0A52A5 | **#2e86f0** | hover gelap + teks `primary-foreground` gelap butuh isian terang agar teks lolos 4,5:1 |
| `*-foreground` dark | (putih) | **#06121f / #04210d / #2a0000** | di dark, isian primer/success/danger jadi terang → teks putih pasti gagal; teks dibalik jadi gelap |

Catatan ramp: langkah `200–500` dan `800–900` **tidak** dioverride di dark (tidak dipakai teks di dark); komponen memakai token semantik (`X`, `X-soft`, `X-foreground`) sehingga selalu aman.

---

## 4. Berkas yang warnanya diganti

**Sebelum (`main`):** 1.099 kelas palet Tailwind mentah di **68 berkas** + 71 kelas `bg-white`/`text-white`/`bg-black` = **1.170**.
**Sesudah:** **0** di 0 berkas (hex/rgb: 0 sebelum, 0 sesudah).

Pembagian:

| Jenis | Sebelum | Sesudah |
|---|---|---|
| Kelas palet Tailwind (`text-slate-500`, `bg-emerald-100`, …) | 1.099 | 0 |
| `bg-white` / `text-white` / `bg-black` | 71 | 0 |
| Hex / rgb / hsl di `.ts`/`.tsx` | 0 | 0 |
| Jumlah total | **1.170** | **0** |

14 berkas teratas (sebelum → sesudah, semua 0):

| Berkas | Sebelum |
|---|---|
| `lib/constants.ts` | 76 |
| `src/features/people/components/employee-profile.tsx` | 66 |
| `src/features/people/components/registration-wizard.tsx` | 58 |
| `app/(app)/people/new/page.tsx` | 58 |
| `app/(app)/mcu/new/page.tsx` | 51 |
| `components/emr-shell.tsx` | 48 |
| `app/(app)/visits/new/page.tsx` | 31 |
| `app/(app)/my/profile/page.tsx` | 30 |
| `app/(app)/reports/page.tsx` | 29 |
| `app/(app)/medicine/return/page.tsx` | 28 |
| `app/(app)/medicine/page.tsx` | 26 |
| `app/(app)/mcu/page.tsx` | 26 |
| `src/features/people/components/people-list.tsx` | 25 |
| `app/(app)/da/page.tsx` | 25 |

**Total: 71 berkas dimodifikasi** + 4 berkas baru (`app/globals.css` ditulis ulang, `lib/status-map.ts`, `components/status-badge.tsx`, `eslint-rules/no-raw-colors.mjs`, `scripts/check-contrast.mjs`, `.github/workflows/design-tokens.yml`).

### Peta penggantian utama

| Dari | Ke |
|---|---|
| `text-slate-900/800` | `text-foreground` |
| `text-slate-700/600` | `text-text-secondary` |
| `text-slate-500/400/300` | `text-muted-foreground` |
| `bg-slate-50/100`, `bg-zinc-50` | `bg-muted` |
| `bg-slate-200/300` | `bg-border` (garis/track) |
| `border-slate-100/200/300` | `border-border` (→ `border-input` pada kontrol) |
| `ring-slate-*` | `ring-ring` |
| `bg-white` | `bg-card` |
| `bg-black/40`, `/5` | `bg-foreground/40`, `/5` |
| `text-white` (16) | `text-primary-foreground` / `text-danger-foreground` sesuai latar |
| `emerald-*` | `success-100`, `text-success-600` |
| `amber-*`, `orange-*` | `warning-100/50`, `text-warning-600` |
| `red-*`, `rose-*` | `danger-100/50`, `text-danger-600` |
| `blue/sky/indigo/cyan/teal-*` | `info-100`, `text-info-600` |
| `purple/violet-*` | `primary-*` (badge) atau netral (peran) |
| `hover:bg-primary-700` | `hover:bg-primary-hover` |

### Guard

`eslint-rules/no-raw-colors.mjs` dipasang di `eslint.config.mjs` untuk `app/`, `components/`, `lib/`, `src/`, `e2e/`, `scripts/`, `middleware.ts`, dan konfigurasi root — **0 pelanggaran** setelah konversi. Pengecualian sah: `app/globals.css` (bukan file JS), aset logo `public/brand/` (biner), token `--color-chart-*` untuk grafik.

---

## 5. Screenshot sebelum vs sesudah

`docs/ui-rebrand/{before,after}/{360,768,1280}/` — 10 halaman × 3 lebar × 2 waktu = **60 PNG** (2,6 MB).

Halaman: `login`, `dashboard`, `people`, `people-new`, `visits`, `visits-queue`, `medical-records`, `medicine`, `mcu`, `not-found`.

Metode (sama untuk sebelum & sesudah): Playwright headless, viewport 360×800 / 768×1024 / 1280×900, sesi disuntikkan ke `localStorage` + cookie, **seluruh `/api/v1/**` di-stub** dengan amplop kosong (data sintetis deterministik, tidak ada tanggal/ID acak yang berubah), `fullPage: true`.

Perbedaan yang terlihat:

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Warna aksen | teal `#14b8a6` | biru LNG `#0B63C8` |
| Font | **serif (Times)** — bug `var(--font-inter)` yang tak pernah didefinisikan membuat deklarasi `font-family` invalid | system sans-serif |
| Chip peran | 11 warna berbeda (violet, rose, cyan, …) | satu chip netral |
| Latar halaman | `#f8fafc` | `#f5f8fc` (biru redup) |
| Tombol | teal | biru, radius 12px |

---

## 6. Hasil test: baseline vs akhir

| Check | Baseline (`main`) | Akhir (`feat/ui-lng-rebrand`) |
|---|---|---|
| `npm run typecheck` | ✅ 0 error | ✅ **0 error** |
| `npm run lint` | ❌ 755 problems (684 error, 71 warning) | ❌ **755 problems (684 error, 71 warning) — identik, tidak naik** + guard aktif, 0 pelanggaran |
| `npm run test` (vitest) | ✅ hijau | ✅ **507 pass / 21 skip / 40 file**, exit 0 |
| `npm run test:e2e:playwright` (21 spec, build produksi) | belum dijalankan | ✅ **21/21 passed** (2,4 mnt), exit 0 |
| `node scripts/a11y-audit.mjs` (axe, 33 halaman/state) | — | ✅ **0 violation, 0 critical/serious**; 45 field semua punya nama aksesibel |
| `node scripts/check-contrast.mjs` (baru) | — | ✅ **136/136 wajib lolos** (light + dark) |
| `node scripts/a11y-keyboard-flow.mjs` | ❌ **gagal di `main` bersih** (KB-06 timeout: `link "Rekam Medis"` tidak ada) | ❌ **gagal identik — tidak berubah** |

**Bukti skrip keyboard bukan regresi:** cabang di-stash ke `main` murni, skrip dijalankan → gagal persis di baris yang sama (timeout 15 s menunggu `getByRole('link', { name: 'Rekam Medis' })`), lalu perubahan dikembalikan. Penyebabnya fungsional, bukan visual: stub skrip memberi `roles: ["SYSTEM_ADMIN"]`, sedangkan menu "Rekam Medis" mensyaratkan `view-clinical-notes` yang tidak dimiliki role itu di `main`. Cabang `feat/a2-lab-radiologi` sudah menulis ulang skrip ini (603 baris berubah) menjadi dua sesi (`dr.klinik` / `hr.pic`) sesuai peta permission — **perbaikannya milik fase A2, sengaja tidak saya sentuh** agar tidak menabrak rebase (aturan anti-tabrakan: jangan mengubah berkas test fungsional fase lain).

Verifikasi token dark (Playwright, kelas `.dark` dipasang di `<html>`):

```
LIGHT: body rgb(245,248,252) / rgb(15,30,43) · tombol rgb(11,99,200) + rgb(255,255,255)
DARK : body rgb(11,22,34)   / rgb(230,238,246) · tombol rgb(77,163,255) + rgb(6,18,31)
```

---

## 7. Penyimpangan dari prompt & alasannya

1. **Cakupan hanya Tugas 1–2** (keputusan eksplisit lewat pertanyaan): PR kecil sesuai aturan anti-tabrakan. Konsekuensinya: shell masih putih (bukan navy), login belum direstorasi, dark mode belum bisa diaktifkan pengguna.
2. **Chip peran dibuat netral** untuk semua peran (`bg-muted text-text-secondary`) — prompt tidak mengatur warna peran, tetapi warna lama (hijau=dokter, merah=manajemen) **bentrok** dengan arti tetap hijau/merah. Peran tetap dibedakan oleh label teks.
3. **`warning` digelapkan** #E3B04B → #B07A1E (tabel prompt mengizinkan penyesuaian bila gagal). #E3B04B tetap tersedia sebagai `warning-400`.
4. **Pasangan dekoratif dikeluarkan dari syarat 3:1** (`border`, `sidebar-border`, `sidebar-active`) — tetap dicetak sebagai informasi, dengan alasan teknis WCAG 1.4.11 di skrip.
5. **Guard hanya mencakup berkas UI** (app/components/lib/src/e2e/scripts/middleware/konfigurasi), bukan seluruh repo: `KODEINxLNG-Backend/` di luar lingkup frontend, dan `tmp3/dbg.mjs` (sampah pre-existing) agar tidak menaikkan baseline.
6. **Kedua gaya token dipakai bersama**: skala numerik (`bg-success-100`, `text-success-600`) yang sudah ada dipertahankan, alias semantik (`success-soft`, `warning-text`, `primary-hover`, `danger-foreground`) ditambahkan untuk kode baru/status. Keduanya didefinisikan dari variabel `--c-*` yang sama sehingga nilainya tidak pernah berbeda.
7. **`lib/constants.ts` tetap mengekspor** `MCU_STATUS` dll. (re-export dari `lib/status-map.ts`) agar 24+ impor konsumen tidak berubah — mengurangi diff sekaligus risiko.
8. **`scripts/a11y-keyboard-flow.mjs` tidak diubah** (lihat bagian 6).
9. **Tidak ada font khusus di-repo** → system font stack dipertahankan (prompt mengizinkan), tetapi hierarki diperbaiki dan bug `font-family` diperbaiki.
10. **Baseline lint dibiarkan merah** (684 error pre-existing, mayoritas `no-require-imports` di `scripts/`, `e2e/`, `tmp3/`) — keputusan eksplisit "jangan naikkan baseline". Error itu di luar lingkup visual.

---

## 8. Temuan di luar lingkup (dicatat, TIDAK diubah)

1. **Kredensial demo di halaman login** — `app/login/login-page-content.tsx` menampilkan daftar akun demo + pesan OTP demo `123456`, semuanya digated `NEXT_PUBLIC_ENABLE_DEMO` dan password tidak ada di source (sesuai aturan F1-C). Tetap terlihat pada screenshot karena mode demo aktif di `next dev`.
2. **`scripts/a11y-keyboard-flow.mjs` gagal di `main`** (bukan karena rebrand) — role stub tidak punya `view-clinical-notes`. Perbaikannya sudah ada di cabang A2.
3. **`middleware` sudah deprecated di Next.js 16** — log: *"The 'middleware' file convention is deprecated. Please use 'proxy' instead."* Butuh codemod `@next/codemod@canary middleware-to-proxy`.
4. **Menu admin di `main` tidak memuat "Rekam Medis"** meski `lib/rbac.ts` memberi `admin` `view-clinical-notes` — ada pemetaan role/permission yang tidak konsisten; tidak saya sentuh.
5. **Duplikat repo**: 15 file `LAPORAN_* copy.md` identik, `kodein-klinik-demo.rar` 555 MB, file `NUL`, `tmp2.mjs`, `tmp3/dbg.mjs`, berbagai `*.log`/`test-results*.json`.
6. **Tidak ada manifest PWA / ikon aplikasi** — hanya `app/favicon.ico` bawaan Next.
7. **`components/ui` vs `design-system`** masih dua implementasi paralel (bagian 2).
8. **Touch target < 44px: 718 elemen** (info, bukan gate) dan **best-practice axe: 21** (16 halaman tanpa `h1`, 5 pelanggaran urutan heading) — sudah ada sebelum rebrand, di luar cakupan Tugas 1–2.

---

## 9. Perlu dicek manual oleh manusia

1. **Perangkat nyata**: render 360 px (bottom-nav/drawer), tablet 768 px, desktop 1280 px pada monitor kalibrasi — terutama keseimbangan biru `#0B63C8` terhadap logo.
2. **Dark mode end-to-end**: token sudah terverifikasi bekerja, tetapi **belum ada pengalih tema** (Tugas 7) — perlu keputusan: `next-themes` (sudah terpasang di `package.json`) + persistensi anti-flash.
3. **Cetak hitam-putih** halaman yang memang dicetak (sertifikat, laporan, SOAP) — belum diuji.
4. **Aset logo final**: `public/brand/lng-flame.png` (salinan dari `public/BAJU.png`, PNG 383×383 dengan latar transparan). Versi SVG akan lebih tajam bila tersedia; `public/BAJU.png` masih ada sebagai berkas asli dan belum di-commit.
5. **Warna `text-text-secondary`** (nama token yang dipertahankan) terasa janggal — bila tim desain ingin nama lain (`text-body`/`text-secondary`), itu perubahan satu baris di `@theme inline`.
6. **Kontras pasangan dekoratif** (8 pasangan) — konfirmasi bahwa keputusan mengecualikan pemisah kartu/baris dari syarat 3:1 sesuai interpretasi WCAG tim aksesibilitas.
7. **Merge/rebase**: jalankan ulang `npm run typecheck && npm run lint && npm run test && npm run test:e2e:playwright` setelah merge dengan `feat/a2-lab-radiologi` (perbedaan besar di `rbac.ts`, `navigation.ts`, `scripts/a11y-*`).

---

## Lampiran: perintah verifikasi

```bash
node scripts/check-contrast.mjs     # kontras WCAG light+dark (136/136)
npm run typecheck                   # 0 error
npm run lint                        # 755 problems = baseline main (guard 0 pelanggaran)
npm run test                        # 507 pass / 21 skip
npm run test:e2e:playwright         # 21/21
node scripts/a11y-audit.mjs         # axe: 0 violation (A11Y_BASE_URL=http://localhost:PORT)
node scripts/a11y-keyboard-flow.mjs # gagal di main sekaligus (lihat bagian 6)
```