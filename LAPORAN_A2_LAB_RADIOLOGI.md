# LAPORAN FASE A2 — Laboratorium dan Radiologi

Repo: `kodein-klinik` (Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, Vitest, Playwright-core)
Cabang: `feat/a2-lab-radiologi` (dari `main` + prasyarat A1)
Tanggal: 2026-10-20
Status: **frontend selesai di dalam batas kontrak; sebagian alur diblokir backend (lihat §6)**

---

## 1. Ringkasan selesai dan belum

### Selesai

| Tugas | Status | Catatan |
|---|---|---|
| 1. Daftar order lab & radiologi | ✅ | Pencarian, filter status/jenis/tanggal, urutan, pagination; badge status **ikon + teks** (bukan warna saja); state loading/kosong/error+retry/offline. Filter **site** tidak ditampilkan: kontrak GET tak punya field site (BLOCKER-04). |
| 2. Terima sampel | ⚠️ jujur | Tombol tampil untuk role berizin (`receive-sample`) tetapi **nonaktif dengan alasan BLOCKER BACKEND** — klien API tidak punya endpoint mutasi status order. Tidak ada chain of custody (A3). |
| 3. Input hasil manual | ✅ | Form dibangun dinamis dari `test_type` API; validasi teknis (wajib, angka); draf localStorage; langkah ringkasan sebelum kirim; nilai referensi & penandaan abnormal **hanya dari data API**; `abnormalFlag` tidak dikirim klien. |
| 4. Impor CSV | ✅ (parsial jujur) | Parse di browser (papaparse lazy), batas 512 KB/500 baris, pratinjau valid+error, laporan kesalahan per baris bisa diunduh, kirim per baris (konkurensi 3) + ulang hanya baris gagal, sel formula dinetralkan, tanpa `dangerouslySetInnerHTML`. Template dibangkitkan dari **order termuat** (katalog tes global tak tersedia — BLOCKER-03). `.xlsx` ditolak eksplisit. |
| 5. Penandaan abnormal & verifikasi | ✅ | Flag dari `abnormal_flag` API dengan ikon + teks "Di luar rentang" (arah Tinggi/Rendah tidak ada di kontrak — BLOCKER-05); layar verifikasi dengan konfirmasi; setelah `verified_at` → terkunci read-only, status "Terverifikasi, menunggu tanda tangan", koreksi lewat addendum (A4). Permission `verify-lab-result` hanya role `lab`. |
| 6. Tautan kunjungan/MCU | ✅ | Dari field API `encounter_id`/`mcu_cycle_id` (penautan server-side); tautan hanya dirender bila role punya permission tujuannya; role lab (tanpa `view-mcu`) melihat identitas minimum tanpa tautan. |
| 7. Halaman radiolog terpisah | ⚠️ parsial | Route `/radiology`, form temuan/kesimpulan, draf, kirim, status read-only + addendum, lampiran nonaktif (BLOCKER-06). **Pemisahan analis vs radiolog di klien tidak mungkin** — backend memetakan `LAB_ANALYST` dan `RADIOLOGIST` ke satu role frontend `lab` (BLOCKER-07), tidak dipalsukan di sisi klien. |
| 8. Aktifkan menu | ✅ | Item "Lab & Radiologi" → `/lab` (bukan `/mcu`), "Radiologi" → `/radiology`, di balik flag `NEXT_PUBLIC_FEATURE_LAB` (default mati). Tiga lapis: menu (permission nav), route (RouteGuard → AccessDenied), aksi (`<Can>`). |
| 9. Test | ✅ | 84 unit test baru; 50 cek E2E frontend-contract (34 lab + 12 radiologi + 4 flag-mati) + 6 cek real-API; axe pada semua halaman baru; regresi fase lama lulus (§3, §5). |
| Feature flag | ✅ | Default mati → `/lab` memakai halaman legacy persis seperti `main`, `/radiology` menampilkan status nonaktif, menu Radiologi tidak tampil. Terverifikasi otomatis (`e2e/lab/flag-off-check.mjs`, 4/4). |

### Belum / di luar lingkup A2

- Penandatanganan TTE hasil (A4), alur addendum (A4) — di sini hanya status "menunggu tanda tangan" + penjelasan read-only.
- Chain of custody & sampel D&A (A3).
- Menerima sampel sungguhan, impor massal ke endpoint bulk, lampiran radiologi, filter site — menunggu backend (§6).
- E2E **bisnis** terhadap data staging nyata: lingkungan ini tidak punya staging HTTPS (temuan lama A3) dan backend lokal tidak mendaftarkan route GET diagnostic (§6) — alur UI terhadap API nyata diverifikasi sampai batas jujurnya lewat `e2e/lab/real-api-check.mjs`.

---

## 2. Inventaris kontrak API

Sumber: `src/lib/services/diagnostic.service.ts` (klien API repo ini), `KODEINxLNG-Backend/API_ENDPOINTS.md`, `tmp2/openapi.json`, dan **probe langsung** terhadap backend yang berjalan (Nest route log + HTTP).

### Ada (dipakai A2, tanpa endpoint baru)

| Endpoint | Dipakai untuk | Status di backend yang berjalan |
|---|---|---|
| `POST /diagnostic/lab-orders` | kontrak klien (tak dipakai A2 — order dibuat klinik/MCU) | ✅ route aktif (400 validation ≠ route-404) |
| `POST /diagnostic/lab-results` | input manual + kirim per baris impor | ✅ route aktif |
| `POST /diagnostic/lab-results/:id/verify` | verifikasi analis | ✅ route aktif (404 "Lab result not found" = sampai service) |
| `POST /diagnostic/radiology-orders` | kontrak klien (tak dipakai A2) | ✅ route aktif |
| `POST /diagnostic/radiology-results` | kirim laporan radiologi | ✅ route aktif |
| `GET /diagnostic/lab-orders` | daftar order lab | ❌ **route-404 "Cannot GET"** (lihat BLOCKER-01) |
| `GET /diagnostic/lab-orders/:id` | detail order lab | ❌ **route-404** |
| `GET /diagnostic/lab-results` | daftar hasil (verifikasi, kunci) | ❌ **route-404** |
| `GET /diagnostic/radiology-orders` | daftar order radiologi | ❌ **route-404** |
| `GET /diagnostic/radiology-orders/:id` | detail radiologi (hasil tersimpan) | ❌ **route-404** |

Field yang tersedia pada tipe kontrak klien: `status`, `ordered_at`, `ordered_by`, `encounter_id`, `mcu_cycle_id`, `order_items[]` → `test_type {id, code, name, specimen_type, unit, reference_range}`, hasil → `values[] {parameter_name, numeric_value, text_value, unit, abnormal_flag}`, `verified_by`, `verified_at`, radiologi → `modality`, `body_part`, `findings`, `impression`, `files[]`.

### TIDAK ada (mengikuti keputusan desain)

| Yang tidak ada | Konsekuensi di UI |
|---|---|
| Endpoint mutasi status order/sampel (terima sampel) | Tombol "Terima sampel" nonaktif + alasan jujur (Tugas 2) |
| Endpoint import massal hasil lab | Kirim per baris, konkurensi 3, progres, ulang baris gagal (Tugas 4) |
| Katalog jenis tes global (`GET` test types) | Template & form dari **order termuat**; daftar tes tidak pernah hardcode |
| Field `site` pada respons order | Filter site tidak ditampilkan (scoping = server) |
| Query filter/pagination di GET list | Pencarian/filter/pagination di klien (kontrak tanpa query) |
| Endpoint upload lampiran radiologi (`objectKey`) | Lampiran dinonaktif dengan alasan (Tugas 7) |
| Arah abnormal (Tinggi/Rendah) — hanya `abnormal_flag: boolean` | Teks jujur "Di luar rentang" (bukan tebak arah) |
| Role backend terpisah untuk analis vs radiolog di sesi frontend | Pemisahan halaman tidak dipalsukan (BLOCKER-07) |
| Endpoint TTE hasil & addendum | Batas alur = "Terverifikasi, menunggu tanda tangan" (A4) |

> Catatan penting: `LAPORAN_IMPLEMENTASI_TAHAP4.md` menyatakan "Endpoint GET ditambahkan ke backend", dan suite bisnis 13 Okt mencatat `GET /diagnostic/lab-orders → api=200`. Pada build backend yang **benar-benar berjalan di lingkungan ini** (commit backend `595d3a0`, origin/main `3587014`), `git grep '@Get'` pada controller diagnostic = **0** dan probe HTTP mengembalikan route-404. Bisa jadi penambahan GET itu hanya hidup di instance/backend lain yang tidak ter-commit. Inilah dasar BLOCKER-01.

---

## 3. Baseline vs hasil akhir

### Unit test (Vitest)

> Angka diukur ulang pada 2026-10-20 **setelah cabang direbase ke `origin/main`** (baseline mengikuti main terbaru, termasuk test A1 upstream seperti `permission-proposal` dan `role-mapping-doc`).

| | File | Tests |
|---|---|---|
| Baseline (tanpa 6 file test A2) | 39 passed + 1 skipped (40) | 508 passed + 21 skipped (529) |
| **Hasil akhir A2** | **45 passed + 1 skipped (46)** | **592 passed + 21 skipped (613)** |
| Delta A2 | +6 file | +84 tests, **semua lulus, 0 gagal** |

Rincian 84 test A2: `order-utils` 19, `status-map` 11, `import/parsing` 15, `import/validation` 15, `import/runner` 6, `rbac-a2-lab` 18 (positif & negatif per role; `lab` tetap tanpa `view-mcu`).

### Typecheck & lint

- `npx tsc --noEmit` → **bersih** (exit 0).
- `npx eslint` pada seluruh area A2 (`src/features/lab`, `src/features/radiology`, `app/(app)/lab`, `app/(app)/radiology`, `e2e/lab`, `e2e/radiology`, test A2) → **0 error, 0 warning**.
- `npm run lint` (repo penuh): exit 1 dengan **587 error — semuanya berada di `KODEINxLNG-Backend/`** (workspace backend yang di-vendor/dist di-ignore oleh config frontend; bukan file frontend). File frontend non-backend: 0 error, 63 warning (baseline identik sebelum perubahan A2; warning yang berkurang 1 berasal dari perbaikan file A2).

### E2E & regresi

| Suite | Sebelum | Sesudah |
|---|---|---|
| `test:e2e:frontend` (ui-only) | 37 PASS | **37 PASS** (flag mati) |
| `scripts/role-scenarios.mjs` | 21 PASS | **21 PASS** |
| `scripts/a11y-audit.mjs` (34 halaman) | 0 critical/serious | **0 critical/serious** |
| A2 lab (`e2e/lab/lab-workflows.mjs`) | — | **34/34 PASS** (flag aktif) |
| A2 radiologi (`e2e/radiology/radiology-workflows.mjs`) | — | **12/12 PASS** (flag aktif) |
| A2 flag mati (`e2e/lab/flag-off-check.mjs`) | — | **4/4 PASS** |
| A2 real-API (`e2e/lab/real-api-check.mjs`) | — | **6/6 PASS** (jujur: 1 PASS = bukti blocker) |

---

## 4. Permission baru per role

Ditambahkan murni di `lib/rbac.ts` (commit berlabel `shared:`), `ROLE_MAPPING.md` **digenerate ulang dari kode** lewat `npm run docs:role-matrix` (`scripts/generate-role-matrix.mjs`, generator resmi `main`; dijaga test `role-mapping-doc.test.ts`) — tidak diedit manual; `git diff` = bersih setelah regenerasi.

| Permission | admin | dokter-oh | dokter-klinik | perawat | apoteker | **lab** | lainnya |
|---|---|---|---|---|---|---|---|
| `view-lab-orders` | ✓ | ✓ | ✓ | ✓ | — | ✓ | — |
| `receive-sample` | — | — | — | — | — | **✓** | — |
| `import-lab-result` | ✓ | — | — | — | — | **✓** | — |
| `verify-lab-result` | — | — | — | — | — | **✓** | — |
| `write-radiology-report` | — | — | — | — | — | **✓** | — |

- **Role `lab` TIDAK punya `view-mcu`** (prasyarat A1, dipertahankan — diverifikasi unit test `rbac-a2-lab` + E2E LAB-03-02/LAB-08-04).
- `verify-lab-result` **hanya** role `lab` (analis) — admin punya `import` tapi tidak `verify`, sesuai pembagian kewenangan proposal.
- Aksi UI memakai registry `lib/actions.ts` (`lab.receive-sample`, `lab.import`, `lab.verify`, `radiology.write-report`).

---

## 5. Alur E2E dan statusnya

Semua suite A2 berlabel `frontend-contract-test` / `real-backend-check` — **mock jaringan di browser, tanpa backend baru, tanpa data pasien nyata** (id & nilai sepenuhnya fiktif). Selector berbasis role/label, tanpa sleep tetap (semua tunggu elemen/response eksplisit), isolasi sesi per skenario.

| ID | Alur | Status |
|---|---|---|
| LAB-01 (5) | Daftar order: tampil, label teks status, filter, pencarian, empty state | ✅ LULUS |
| LAB-02 (2) | State error + tombol "Coba lagi" → reload | ✅ LULUS |
| LAB-03 (2) | Konteks tertaut; role lab lihat identitas minimum **tanpa** tautan MCU/kunjungan | ✅ LULUS |
| LAB-04 (1) | "Terima sampel" nonaktif dengan alasan BLOCKER (jujur, bukan dimainkan) | ✅ LULUS |
| LAB-05 (4) | Input manual: form dari tes API, tolak nilai non-angka, ringkasan, payload kontrak tanpa `abnormalFlag` klien | ✅ LULUS |
| LAB-06 (8) | Impor CSV: template unduh, pratinjau valid/error, order_id tak cocok **ditandai**, laporan per baris, kirim per baris, gagal → ulang **hanya** baris gagal (delta=1 request) | ✅ LULUS |
| LAB-07 (5) | Verifikasi: abnormal dari API, konfirmasi, kunci + "menunggu tanda tangan" + addendum, tombol hilang, endpoint verify benar | ✅ LULUS |
| LAB-08 (4) | RBAC: apoteker & perawat ditolak route `/lab`; menu → `/lab` (bukan `/mcu`); role `view-mcu` melihat tautan MCU | ✅ LULUS |
| LAB-09 (3) | axe `/lab`, `/lab/:id`, `/lab/import` — 0 critical/serious | ✅ LULUS |
| RAD (12) | Daftar radiologi, validasi kirim kosong, draf pulih, payload kontrak, read-only + addendum, lampiran blocker, RBAC route+menu, axe | ✅ LULUS |
| FLAG-OFF (4) | Flag mati: `/radiology` nonaktif, menu Radiologi hilang, menu Lab tetap, `/lab` legacy | ✅ LULUS |
| REAL (6) | **Tanpa mock**, terhadap backend nyata: GET diagnostic = route-404 (bukti blocker), UI menampilkan error-jujur + coba lagi, **tanpa baris karangan**, tanpa page error | ✅ LULUS |

**Tidak ada `test.skip`.** Alur yang tak bisa diuji dengan data nyata dicatat sebagai BLOCKER (§6) dan diverifikasi sampai batas jujurnya lewat REAL-01..06, bukan di-skip atau dipalsukan.

E2E bisnis (`e2e/staging-business-flows.mjs`, butuh backend + seed) **tidak dijalankan dalam sesi ini** karena GET diagnostic route-404 di lingkungan ini — akan langsung `BLOCKED` pada bagian Lab (kondisi yang sama sudah tercatat pada laporan staging sebelumnya: L3/L4 BLOCKED "tidak ada lab order pada data seed").

---

## 6. Daftar BLOCKER BACKEND

| # | Kebutuhan | Endpoint/field | Dampak | Bukti |
|---|---|---|---|---|
| **01** | **Endpoint baca diagnostic** | `GET /diagnostic/lab-orders`, `GET /diagnostic/lab-orders/:id`, `GET /diagnostic/lab-results`, `GET /diagnostic/radiology-orders`, `GET /diagnostic/radiology-orders/:id` | **Seluruh alur baca A2** (daftar, detail, verifikasi, impor-butuh-daftar-order, radiologi) menampilkan state error di UI terhadap API nyata. Semua tulis (POST) route aktif. | Nest route log (0 `@Get` di controller), probe HTTP `404 Cannot GET`, `test-artifacts/frontend-backend-alignment/report.json` (GAP), `REAL-01` |
| 02 | Mutasi status order / penerimaan sampel | `PATCH/PUT /diagnostic/lab-orders/:id/status` (atau setara) | Tombol "Terima sampel" nonaktif + alasan; Tugas 2 berhenti di batas jujur | Kontrak klien tanpa method ini; `LAB-04-01` |
| 03 | Katalog jenis tes global (admin-konfigurasi) | `GET /diagnostic/lab-test-types` (atau master data tes) | Template impor hanya dari order termuat; kalau tidak ada order termuat, template hanya header + pesan jujur | `parsing.ts#buildTemplateCsv` |
| 04 | Field `site` pada order | `site`/`site_id` di respons GET lab-orders | Filter site tidak ditampilkan (spec meminta filter site) | `lab-orders-panel.tsx` komentar BLOCKER |
| 05 | Arah abnormal | mis. `abnormal_direction: HIGH\|LOW` pada values | Label hanya "Di luar rentang"; "Tinggi"/"Rendah" tidak bisa ditebak dari boolean | `order-utils.ts#abnormalInfo` |
| 06 | Upload lampiran radiologi | endpoint yang menghasilkan `objectKey` (+`sha256Hash`) | Field `files` ada di DTO tapi UI lampiran nonaktif dengan alasan | `report-form.tsx` |
| 07 | Pemisahan role analis lab vs radiolog di sesi | Role/kontrak login yang membedakan `LAB_ANALYST` vs `RADIOLOGIST` di frontend (kini keduanya → `lab`) | Menu/route halaman radiolog tidak bisa dikecualikan untuk analis murni di sisi klien — **tidak dipalsukan**; permission `write-radiology-report` dipakai sejauh data mengizinkan | `auth.service.ts BACKEND_ROLE_MAP`, `radiology/page.tsx` komentar |
| 08 | Endpoint bulk hasil lab (opsional) | `POST /diagnostic/lab-results/bulk` | Tanpa ini impor tetap jalan per baris (sudah dikerjakan dengan konkurensi 3) — peningkatan, bukan penghalang | `runner.ts` |

---

## 7. Pilihan pustaka impor & audit keamanan

- **`papaparse@5.7.0` (MIT)** — satu-satunya dependensi baru A2 (`package.json` +`papaparse`, +`@types/papaparse` di devDependencies).
  - Alasan: parser CSV/TSV ringan & terawat (≥8 thn rilis stabil, ~190 rb pustaka dependen), murni client-side, lisensi MIT, tanpa eksekusi kode dari berkas.
  - **Lazy**: hanya dimuat `await import("papaparse")` di dalam `parseImportFile` → hanya halaman `/lab/import` yang memuatnya (code-split otomatis).
  - **`.xlsx`/`.xls`/`.ods` ditolak eksplisit** dengan pesan meminta konversi ke CSV — sengaja TIDAK memakai pustaka xlsx (rawan advis keamanan & isu lisensi; makro/formula tak perlu dieksekusi karena memang tidak dibaca).
  - Batas berkas 512 KB & 500 baris ditegakkan sebelum parse penuh; isi berkas = data tak tepercaya (tanpa `dangerouslySetInnerHTML`; sel berpotensi formula `= + - @` dinetralkan jadi `'` saat ekspor laporan error — anti CSV-injection).
- **`npm audit`** (2026-10-20): **12 vulnerability (11 high, 1 critical)** — semuanya pada dependensi yang sudah ada sebelum A2: `next` (16.0.0–16.3.7, RCE di `next/og`), `sharp`, `braces`/`micromatch`/`fast-glob` (rantai `eslint-config-next`/`shadcn`), `source-map-js`, `ts-morph`, `@modelcontextprotocol/sdk`. **`papaparse` TIDAK punya advisori apa pun** (tidak muncul di daftar audit).
  - ⚠️ Catatan: `next critical` (upgrade ke ≥16.3.8) & temuan lain **di luar lingkup A2** (kecuali penambahan dependensi, file build/CI tak disentuh) — laporkan ke pemilik repo, jangan diperbaiki diam-diam di faset ini.

---

## 8. Hal yang harus dicek manual

### Catatan rebase ke `origin/main` (2026-10-20)

- Cabang direbase ke `origin/main` (`d4ab4da`); keputusan RBAC mengikuti **main**: `hr` tetap tanpa `view-mcu`/`create-mcu`/`view-visits` (proposal 3-lapis diuji `permission-proposal.test.ts`), `admin-klinik` tetap memiliki `export-reports`, dan `lab` tetap tanpa `view-mcu` (prasyarat A2 tidak berubah).
- `ROLE_MAPPING.md` kini memakai generator resmi main (`npm run docs:role-matrix`); generator kedua dari A1 (`generate-role-mapping.mjs`) dibuang agar tidak duplikat dan dijaga test `role-mapping-doc.test.ts`.
- Verifikasi ulang pasca-rebase: tsc 0 error · vitest 592/592 · E2E A2 34/34 + 12/12 · flag mati 4/4 · ui-only 37/37 · role-scenarios 21/21 · axe 0 critical/serious.

1. **Staging dengan backend yang punya GET diagnostic** — jalankan alur penuh: daftar order → buka detail → input hasil → verifikasi → terkunci; daftar radiologi → susun laporan → kirim. Saat ini semua GET route-404 (BLOCKER-01); setelah backend memperbaiki, cukup `node e2e/lab/real-api-check.mjs` (harus berubah: REAL-01 jadi bukti "GET ada", REAL-02..05 menyesuaikan) lalu jalankan `e2e/staging-business-flows.mjs` mode business.
2. **Tampilan role lab vs radiolog** — akun `LAB_ANALYST` vs `RADIOLOGIST`: sampai BLOCKER-07 beres, keduanya memakai role frontend `lab` dan melihat menu yang sama; konfirmasikan dengan tim backend/perilaku login nyata apakah pemisahan peran dibutuhkan untuk rilis.
3. **Perilaku flag mati di environment masing-masing** — build tanpa `NEXT_PUBLIC_FEATURE_LAB`: menu Radiologi hilang, `/lab` memakai halaman legacy, `/radiology` status nonaktif (sudah otomatis diverifikasi lokal: `e2e/lab/flag-off-check.mjs`; cek ulang di CI/staging build).
4. **Ambang klinis** — `reference_range` & `abnormal_flag` berasal dari API/konfigurasi; setelah Dokter OH mengatur ambang di backend, pastikan nilai abnormal muncul di UI **tanpa perubahan kode frontend** (memang tidak ada ambang di kode frontend).
5. **Data nyata pada impor** — unggah CSV template asli (dari order staging), baris valid & baris error, unduh laporan kesalahan, ulang hanya baris gagal — dipastikan tidak ada data pasien nyata yang bocor ke laporan/log.
6. **Aksesibilitas lanjutan** — axe sudah 0 critical/serious pada halaman baru; audit keyboard penuh (tab/enter pada form hasil & pratinjau impor) pada pass a11y berikutnya.
7. **Kebersihan lingkungan** — `npm audit` untuk dependensi lama (`next` critical) direncanakan terpisah; `ROLE_MAPPING.md` wajib digenerate ulang (`npm run docs:role-matrix`) bila ada permission berubah lagi.

---

## Lampiran A — Commit pada cabang `feat/a2-lab-radiologi`

Hash di bawah adalah keadaan **setelah rebase ke `origin/main`** (urut dari yang tertua); dua commit pertama adalah sisa jalur A1 yang ikut terbawa:

```
2fb5106 fix(rbac): pulihkan permission HR & Admin Klinik yang terhapus di luar niat, tambah guard route kontrol sistem
6f2359c feat(rbac): A1 — cabut view-mcu dari role lab, sesuaikan dashboard & test
04d4426 shared: tambah permission A2 (view-lab-orders, receive-sample, import-lab-result, verify-lab-result, write-radiology-report)
a6053b7 shared: feature flag NEXT_PUBLIC_FEATURE_LAB, menu Radiologi, guard /radiology & /lab/import
484824d shared: registry aksi A2 (lab.receive-sample, lab.import, lab.verify, radiology.write-report)
c41dd30 feat(lab): workspace A2 — daftar order, detail, input manual, verifikasi, impor CSV
1ef033a feat(radiologi): halaman radiolog terpisah — daftar order & laporan temuan/kesimpulan
77e5816 test(lab): unit test A2 — permission, parser/validator impor, runner, pemetaan status
0311df1 fix(a11y): kontras teks identitas MCU di panel lab + bersihkan eslint-disable usang
ac8aaa8 test(e2e): suite A2 lab & radiologi (frontend-contract-test) + cek flag mati
9134a1d test(e2e): pindahkan fixtures A2 ke e2e/lab (area milik A2)
85bdccb test(e2e): ganti semua sleep tetap dengan tunggu elemen/response eksplisit
7382ad8 docs(a2): LAPORAN_A2_LAB_RADIOLOGI.md + cek real-API (bukti blocker GET diagnostic)
8ca92c5 fix(shared): rekonsiliasi rebase ke origin/main — pulihkan export-reports admin-klinik & buang guard duplikat
```

Commit A1 yang menambahkan generator `scripts/generate-role-mapping.mjs` sengaja **dibuang saat rebase** karena `origin/main` sudah memiliki generator setara (`generate-role-matrix.mjs`) beserta test sinkronisasi dokumennya.

Perubahan file bersama hanya **tambahan murni** (permission baru, flag, menu, guard, registry aksi); `ROLE_MAPPING.md` digenerate dari kode; tidak ada file build/CI, backend, skema DB, atau logika fase lain yang diubah. `papaparse` = penambahan dependensi sesuai kebijakan A2 (dicatat di §7).

## Lampiran B — Cara menjalankan ulang

```bash
# Unit + typecheck
npx tsc --noEmit && npx vitest run

# E2E A2 (flag aktif)
NEXT_PUBLIC_FEATURE_LAB=1 npx next build && npx next start -p 3312
node e2e/lab/lab-workflows.mjs              # 34 asersi
node e2e/radiology/radiology-workflows.mjs   # 12 asersi

# Cek real API (backend hidup di NEXT_PUBLIC_API_URL)
node e2e/lab/real-api-check.mjs              # 6 asersi

# Flag mati
npx next build && npx next start -p 3313
E2E_BASE_URL=http://localhost:3313 node e2e/lab/flag-off-check.mjs   # 4 cek

# Regresi fase lama (flag mati)
E2E_BASE_URL=http://localhost:3313 npm run test:e2e:frontend
ROLE_BASE_URL=http://localhost:3313 node scripts/role-scenarios.mjs
A11Y_BASE_URL=http://localhost:3313 node scripts/a11y-audit.mjs
```

Laporan hasil: `test-artifacts/a2-e2e/a2-lab-report.json`, `a2-radiology-report.json`, `a2-real-api-report.json`; screenshot di folder yang sama.
