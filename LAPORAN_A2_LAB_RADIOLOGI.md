# LAPORAN FASE A2 — Laboratorium dan Radiologi

Repo: `kodein-klinik` (Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, Vitest, Playwright-core)
Cabang: `feat/a2-lab-radiologi` (dari `main` + prasyarat A1)
Tanggal: 2026-10-20 · **Pembaruan: 2026-10-23 (penyelarasan kontrak backend)**
Status: **frontend selesai di dalam batas kontrak; alur baca tetap diblokir backend, kini dilaporkan sebagai status kapabilitas yang eksplisit (lihat §1.1 dan §6)**

> **Ringkasan pembaruan 2026-10-23.** Backend yang diperiksa ulang (HEAD `3587014`) masih hanya mendaftarkan lima endpoint **tulis** diagnostic dan **tidak** mendaftarkan `GET /diagnostic/*`. Frontend tidak lagi menampilkan pesan mentah `Cannot GET /api/v1/...`: seluruh route-404 Nest diterjemahkan menjadi status kapabilitas bertipe lewat `src/lib/services/backend-availability.ts`. Audit yang sama menemukan empat kelompok route non-A2 yang juga belum ada (`GET /signatures*`, `GET /documents/:id/download`, `POST /documents/upload`, `GET /pharmacy/dispensing/history`); halaman terkait kini menampilkannya sebagai status kapabilitas, dan unggah dokumen ditolak sebelum request dikirim. Backend tidak diubah.

---

## 1. Ringkasan selesai dan belum

### Selesai

| Tugas | Status | Catatan |
|---|---|---|
| 1. Daftar order lab & radiologi | ✅ | Pencarian, filter status/jenis/tanggal, urutan, pagination; badge status **ikon + teks** (bukan warna saja); state loading/kosong/error+retry/offline. Filter **site** tidak ditampilkan: kontrak GET tak punya field site (BLOCKER-04). Sejak 2026-10-23 pesan error menyebut kapabilitas backend yang belum tersedia, bukan `Cannot GET`. |
| 2. Terima sampel | ⚠️ jujur | Tombol tampil untuk role berizin (`receive-sample`) tetapi **nonaktif dengan alasan BLOCKER BACKEND** — klien API tidak punya endpoint mutasi status order. Tidak ada chain of custody (A3). |
| 3. Input hasil manual | ✅ | Form dibangun dinamis dari `test_type` API; validasi teknis (wajib, angka); draf localStorage; langkah ringkasan sebelum kirim; nilai referensi & penandaan abnormal **hanya dari data API**; `abnormalFlag` tidak dikirim klien. |
| 4. Impor CSV | ✅ (parsial jujur) | Parse di browser (papaparse lazy), batas 512 KB/500 baris, pratinjau valid+error, laporan kesalahan per baris bisa diunduh, kirim per baris (konkurensi 3) + ulang hanya baris gagal, sel formula dinetralkan, tanpa `dangerouslySetInnerHTML`. Template dibangkitkan dari **order termuat** (katalog tes global tak tersedia — BLOCKER-03). `.xlsx` ditolak eksplisit. |
| 5. Penandaan abnormal & verifikasi | ✅ | Flag dari `abnormal_flag` API dengan ikon + teks "Di luar rentang" (arah Tinggi/Rendah tidak ada di kontrak — BLOCKER-05); layar verifikasi dengan konfirmasi; setelah `verified_at` → terkunci read-only, status "Terverifikasi, menunggu tanda tangan", koreksi lewat addendum (A4). Permission `verify-lab-result` hanya role `lab`. |
| 6. Tautan kunjungan/MCU | ✅ | Dari field API `encounter_id`/`mcu_cycle_id` (penautan server-side); tautan hanya dirender bila role punya permission tujuannya; role lab (tanpa `view-mcu`) melihat identitas minimum tanpa tautan. |
| 7. Halaman radiolog terpisah | ⚠️ parsial | Route `/radiology`, form temuan/kesimpulan, draf, kirim, status read-only + addendum, lampiran nonaktif (BLOCKER-06). **Pemisahan analis vs radiolog di klien tidak mungkin** — backend memetakan `LAB_ANALYST` dan `RADIOLOGIST` ke satu role frontend `lab` (BLOCKER-07), tidak dipalsukan di sisi klien. |
| 8. Aktifkan menu | ✅ | Item "Lab & Radiologi" → `/lab` (bukan `/mcu`), "Radiologi" → `/radiology`, di balik flag `NEXT_PUBLIC_FEATURE_LAB` (default mati). Tiga lapis: menu (permission nav), route (RouteGuard → AccessDenied), aksi (`<Can>`). |
| 9. Test | ✅ | 84 unit test A2 + 5 test kontrak ketersediaan (2026-10-23); 50 cek E2E frontend-contract (34 lab + 12 radiologi + 4 flag-mati) + 6 cek real-API; Playwright 21/21; axe pada semua halaman baru; regresi fase lama lulus (§3, §5). |
| 10. Penyelarasan kontrak backend | ✅ | Audit ulang seluruh pemanggilan frontend terhadap route NestJS yang benar-benar terdaftar; route yang belum ada dipetakan menjadi status kapabilitas bertipe. Detail di §1.1 dan §2. |
| Feature flag | ✅ | Default mati → `/lab` memakai halaman legacy persis seperti `main`, `/radiology` menampilkan status nonaktif, menu Radiologi tidak tampil. Terverifikasi otomatis (`e2e/lab/flag-off-check.mjs`, 4/4). |

### Belum / di luar lingkup A2

- Penandatanganan TTE hasil (A4), alur addendum (A4) — di sini hanya status "menunggu tanda tangan" + penjelasan read-only.
- Chain of custody & sampel D&A (A3).
- Menerima sampel sungguhan, impor massal ke endpoint bulk, lampiran radiologi, filter site — menunggu backend (§6).
- E2E **bisnis** terhadap data staging nyata: lingkungan ini tidak punya staging HTTPS (temuan lama A3) dan backend lokal tidak mendaftarkan route GET diagnostic (§6) — alur UI terhadap API nyata diverifikasi sampai batas jujurnya lewat `e2e/lab/real-api-check.mjs`.

### 1.1 Penyelarasan kontrak backend (2026-10-23)

Lingkup: **frontend saja** — tidak ada file, skema, dependensi, atau konfigurasi backend yang diubah.

| Perubahan | File | Perilaku |
|---|---|---|
| Registry ketersediaan endpoint + error bertipe | `src/lib/services/backend-availability.ts` (baru) | Daftar operasi yang route-nya belum terdaftar; hanya route-404 Nest (`"Cannot GET/POST …"`) yang diterjemahkan menjadi `BackendFeatureUnavailableError` — 404 entity (mis. `"Lab order not found"`) tetap `ApiError`. |
| Lima endpoint baca diagnostic | `src/lib/services/diagnostic.service.ts` | Route-404 → pesan kapabilitas. Request tetap dikirim agar fitur otomatis hidup bila backend menambah route (tidak ada cache "mati" di klien). |
| Tracking/retry tanda tangan, download & upload dokumen | `src/lib/services/document.service.ts` | `GET /signatures*`/`POST …/retry`/`GET …/download` → error kapabilitas; `uploadDocument()` menolak **tanpa** mengirim request. |
| Riwayat dispensing | `src/lib/services/pharmacy.service.ts` | `GET /pharmacy/dispensing/history` → error kapabilitas; inventory tetap dimuat. |
| Deduplikasi identitas | `src/lib/services/patient.service.ts` | Memakai endpoint nyata `POST /patients/check-duplicate` (bukan menebak dari pencarian daftar pasien). |
| Halaman `/signatures` | `app/(app)/signatures/page.tsx` | Menampilkan notice kapabilitas tanpa tombol retry/polling; tidak ada status tanda tangan karangan. |
| Halaman `/documents` | `app/(app)/documents/page.tsx` | Polling status tanda tangan berhenti dan tombol retry disembunyikan saat route detail belum ada. |
| Halaman `/reports` | `app/(app)/reports/page.tsx` | Angka dispensing tampil `—` (bukan `0`) ketika riwayat belum tersedia. |
| Registrasi pekerja | `app/(app)/people/new/page.tsx`, `src/features/people/components/registration-wizard.tsx` | Catatan “unggah belum tersedia” + tidak mengirim ke `POST /documents/upload`; pendaftaran tetap bisa tanpa lampiran. |
| Kontrak test | `src/lib/services/__tests__/backend-availability.test.ts` (baru), `module-endpoints.test.ts`, `e2e/playwright/support/mock-backend.ts` | Test pemetaan route-404, deduplikasi endpoint nyata, dan mock `check-duplicate` agar selaras dengan backend. |

**Batas yang tetap jujur.** Alur baca A2 (daftar/detail/verifikasi) **belum bisa berfungsi** karena backend belum menyediakan route GET (BLOCKER-01). UI menampilkan penjelasan kapabilitas + tombol coba lagi; tidak ada data pengganti yang dikarang.

---

## 2. Inventaris kontrak API

Sumber: `src/lib/services/diagnostic.service.ts` (klien API repo ini), `KODEINxLNG-Backend/API_ENDPOINTS.md`, `tmp2/openapi.json`, dan **probe langsung** terhadap backend yang berjalan (Nest route log + HTTP). Sejak 2026-10-23 dipakai juga `src/lib/services/backend-availability.ts` sebagai satu-satunya daftar operasi yang belum tersedia.

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

> Catatan penting: `LAPORAN_IMPLEMENTASI_TAHAP4.md` menyatakan "Endpoint GET ditambahkan ke backend", dan suite bisnis 13 Okt mencatat `GET /diagnostic/lab-orders → api=200`. Pada build backend yang **benar-benar berjalan di lingkungan ini** (commit backend `595d3a0`, origin/main `3587014`), `git grep '@Get'` pada controller diagnostic = **0** dan probe HTTP mengembalikan route-404. Bisa jadi penambahan GET itu hanya hidup di instance/backend lain yang tidak ter-commit. Inilah dasar BLOCKER-01. Pemeriksaan ulang 2026-10-23 pada HEAD `3587014` memberi hasil yang sama (lihat §6).

### Kontrak ketersediaan di frontend (pembaruan 2026-10-23)

`src/lib/services/backend-availability.ts` mendaftarkan operasi yang route-nya **belum terdaftar** dan menerjemahkan route-404 Nest menjadi error bertipe. Pemetaan ini tidak menutupi 403/409/500/offline dan tidak menyamarkan 404 entity.

| Operasi | Endpoint yang dibutuhkan | Perilaku frontend sekarang |
|---|---|---|
| Daftar order lab | `GET /diagnostic/lab-orders` | ErrorState berisi penjelasan kapabilitas + tombol coba lagi; tanpa baris karangan |
| Detail order lab | `GET /diagnostic/lab-orders/:id` | ErrorState kapabilitas pada `/lab/[orderId]` |
| Daftar hasil lab | `GET /diagnostic/lab-results` | Gagal senyap bila order berhasil dimuat (hasil dianggap belum tersedia), error utama tetap dari daftar order |
| Daftar/detail order radiologi | `GET /diagnostic/radiology-orders[/:id]` | Peringatan per-sumber / ErrorState kapabilitas pada `/radiology` |
| Tracking & retry tanda tangan | `GET /signatures`, `GET /signatures/:id`, `POST /signatures/:id/retry` | Notice kapabilitas; polling/retry dimatikan (tidak menembak route yang tidak ada) |
| Unduh dokumen | `GET /documents/:id/download` | Error kapabilitas (method belum dipakai halaman mana pun) |
| Unggah dokumen pendukung | `POST /documents/upload` | Ditolak di klien tanpa request + catatan pada wizard registrasi |
| Riwayat dispensing | `GET /pharmacy/dispensing/history` | Halaman retur: inventory tetap tampil + status “riwayat belum tersedia”; laporan menampilkan `—` |

Pemanggilan baca diagnostic **tetap dikirim** (bukan dihapus) supaya: (a) kontrak E2E dengan mock 200 tidak berubah, dan (b) fitur otomatis aktif begitu backend menambahkan route-nya — tanpa perubahan kode frontend.

---

## 3. Baseline vs hasil akhir

### Unit test (Vitest)

> Angka diukur ulang pada 2026-10-20 **setelah cabang direbase ke `origin/main`** (baseline mengikuti main terbaru, termasuk test A1 upstream seperti `permission-proposal` dan `role-mapping-doc`).

| | File | Tests |
|---|---|---|
| Baseline (tanpa 6 file test A2) | 39 passed + 1 skipped (40) | 508 passed + 21 skipped (529) |
| Hasil akhir A2 (2026-10-20) | 45 passed + 1 skipped (46) | 592 passed + 21 skipped (613) |
| **Setelah penyelarasan kontrak (2026-10-23)** | **46 passed + 1 skipped (47)** | **597 passed + 21 skipped (618)** |
| Delta A2 | +6 file | +84 tests, **semua lulus, 0 gagal** |
| Delta penyelarasan | +1 file | +5 tests (4 `backend-availability` + 1 kontrak deduplikasi) |

Rincian 84 test A2: `order-utils` 19, `status-map` 11, `import/parsing` 15, `import/validation` 15, `import/runner` 6, `rbac-a2-lab` 18 (positif & negatif per role; `lab` tetap tanpa `view-mcu`).

Test penyelarasan 2026-10-23 memverifikasi: route-404 diagnostic/signatures/riwayat-dispensing → `BackendFeatureUnavailableError`; 404 entity **tidak** disamarkan; `uploadDocument()` tidak mengirim request; dan `POST /patients/check-duplicate` dipanggil dengan body kontrak backend.

### Typecheck & lint

- `npx tsc --noEmit` → **bersih** (exit 0).
- `npx eslint` pada seluruh area A2 (`src/features/lab`, `src/features/radiology`, `app/(app)/lab`, `app/(app)/radiology`, `e2e/lab`, `e2e/radiology`, test A2) → **0 error, 0 warning**.
- `npx eslint` pada file yang diubah pada penyelarasan 2026-10-23 → **0 error**; 6 warning `no-unused-vars` sudah ada sebelum perubahan ini (bukan regresi).
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
| Playwright alur mutasi (`npm run test:e2e:playwright`) | — | **21/21 PASS** (2026-10-23, termasuk registrasi 4/4) |

> Cek tambahan 2026-10-23 (intercept route-404 di browser, build flag aktif): `/lab` menampilkan “Daftar order laboratorium belum tersedia di backend” + tombol coba lagi **tanpa** teks mentah `Cannot GET`; `/signatures` menampilkan notice kapabilitas **tanpa** tombol retry/polling dan 0 page error. Test REAL tidak berubah karena tetap menerima state error + tombol coba lagi.

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
| REAL (6) | **Tanpa mock**, terhadap backend nyata: GET diagnostic = route-404 (bukti blocker), UI menampilkan error-jujur + coba lagi, **tanpa baris karangan**, tanpa page error. Sejak 2026-10-23 pesannya menyebut kapabilitas backend, bukan `Cannot GET` | ✅ LULUS |

**Tidak ada `test.skip`.** Alur yang tak bisa diuji dengan data nyata dicatat sebagai BLOCKER (§6) dan diverifikasi sampai batas jujurnya lewat REAL-01..06, bukan di-skip atau dipalsukan.

E2E bisnis (`e2e/staging-business-flows.mjs`, butuh backend + seed) **tidak dijalankan dalam sesi ini** karena GET diagnostic route-404 di lingkungan ini — akan langsung `BLOCKED` pada bagian Lab (kondisi yang sama sudah tercatat pada laporan staging sebelumnya: L3/L4 BLOCKED "tidak ada lab order pada data seed"). Suite itu juga memanggil `GET /pharmacy/dispensing/history` (BLOCKER-11) sehingga bagian farmasi akan gagal selama route tersebut belum ada.

Catatan 2026-10-23: suite REAL belum dijalankan ulang karena backend tidak dapat di-boot di environment ini (lihat §8); perubahan pemetaan error diverifikasi lewat unit test + intercept 404 di browser.

---

## 6. Daftar BLOCKER BACKEND

| # | Kebutuhan | Endpoint/field | Dampak | Bukti |
|---|---|---|---|---|
| **01** | **Endpoint baca diagnostic** | `GET /diagnostic/lab-orders`, `GET /diagnostic/lab-orders/:id`, `GET /diagnostic/lab-results`, `GET /diagnostic/radiology-orders`, `GET /diagnostic/radiology-orders/:id` | **Seluruh alur baca A2** (daftar, detail, verifikasi, impor-butuh-daftar-order, radiologi) belum berfungsi terhadap API nyata. Sejak 2026-10-23 UI menampilkan **status kapabilitas** yang menyebut route yang belum terdaftar (bukan `Cannot GET`) tanpa data karangan; request tetap dikirim agar otomatis pulih. Semua tulis (POST) route aktif. | Nest route log (0 `@Get` di controller, dicek ulang 2026-10-23), probe HTTP `404 Cannot GET`, `test-artifacts/frontend-backend-alignment/report.json` (GAP), `REAL-01`, unit test `backend-availability` |
| 02 | Mutasi status order / penerimaan sampel | `PATCH/PUT /diagnostic/lab-orders/:id/status` (atau setara) | Tombol "Terima sampel" nonaktif + alasan; Tugas 2 berhenti di batas jujur | Kontrak klien tanpa method ini; `LAB-04-01` |
| 03 | Katalog jenis tes global (admin-konfigurasi) | `GET /diagnostic/lab-test-types` (atau master data tes) | Template impor hanya dari order termuat; kalau tidak ada order termuat, template hanya header + pesan jujur | `parsing.ts#buildTemplateCsv` |
| 04 | Field `site` pada order | `site`/`site_id` di respons GET lab-orders | Filter site tidak ditampilkan (spec meminta filter site) | `lab-orders-panel.tsx` komentar BLOCKER |
| 05 | Arah abnormal | mis. `abnormal_direction: HIGH\|LOW` pada values | Label hanya "Di luar rentang"; "Tinggi"/"Rendah" tidak bisa ditebak dari boolean | `order-utils.ts#abnormalInfo` |
| 06 | Upload lampiran radiologi | endpoint yang menghasilkan `objectKey` (+`sha256Hash`) | Field `files` ada di DTO tapi UI lampiran nonaktif dengan alasan | `report-form.tsx` |
| 07 | Pemisahan role analis lab vs radiolog di sesi | Role/kontrak login yang membedakan `LAB_ANALYST` vs `RADIOLOGIST` di frontend (kini keduanya → `lab`) | Menu/route halaman radiolog tidak bisa dikecualikan untuk analis murni di sisi klien — **tidak dipalsukan**; permission `write-radiology-report` dipakai sejauh data mengizinkan | `auth.service.ts BACKEND_ROLE_MAP`, `radiology/page.tsx` komentar |
| 08 | Endpoint bulk hasil lab (opsional) | `POST /diagnostic/lab-results/bulk` | Tanpa ini impor tetap jalan per baris (sudah dikerjakan dengan konkurensi 3) — peningkatan, bukan penghalang | `runner.ts` |
| 09 | Tracking tanda tangan elektronik (non-A2) | `GET /signatures`, `GET /signatures/:id`, `POST /signatures/:id/retry` | Halaman `/signatures` menampilkan notice kapabilitas; `/documents` berhenti polling & menyembunyikan retry. `POST /signatures/request` tetap berfungsi. | route controller document (tidak ada handler), unit test `backend-availability` |
| 10 | Unggah/unduh dokumen (non-A2) | `POST /documents/upload`, `GET /documents/:id/download` | Wizard registrasi menolak unggah di klien dengan penjelasan; pendaftaran tetap bisa tanpa lampiran. Download belum dipakai halaman. | route controller document (tidak ada handler), `document.service.ts` |
| 11 | Riwayat dispensing (non-A2) | `GET /pharmacy/dispensing/history` | Halaman retur tetap menampilkan inventory + status riwayat belum tersedia; laporan menampilkan `—`. | route controller pharmacy (tidak ada handler), unit test `backend-availability` |

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

### Catatan penyelarasan kontrak backend (2026-10-23)

- Audit dilakukan terhadap **source backend** (`src/modules/**`, `prisma/schema.prisma`) dan DTO-nya; tidak ada file backend yang diubah.
- Backend **tidak dapat di-boot** di environment ini: file backend yang belum ter-commit (`src/common/storage/s3-storage.service.ts`, `scripts/migrate-storage-to-s3.ts`) mengimpor `@aws-sdk/client-s3`/`@aws-sdk/s3-request-presigner` yang belum terpasang, sehingga `npm run start` gagal kompilasi. Karena itu `e2e/lab/real-api-check.mjs` dan suite bisnis tidak dijalankan ulang; verifikasi UI dilakukan dengan meng-intercept seluruh `/api/v1/**` sebagai route-404 Nest di browser.
- Verifikasi yang sudah dijalankan: `npx tsc --noEmit` bersih · `npx vitest run` 597 passed/21 skipped · Playwright 21/21 · A2 lab 34/34 · radiologi 12/12 (flag aktif) · ESLint file yang diubah 0 error.
- Saat backend menambahkan route GET diagnostic/signatures, **tidak perlu perubahan frontend**: pemetaan hanya aktif pada route-404 dan state kapabilitas kembali normal setelah halaman dimuat ulang. Jalankan ulang `node e2e/lab/real-api-check.mjs` dan sesuaikan ekspektasi REAL-01..05 (route kini ada).

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
8. **Halaman `/signatures` & `/documents`** — dengan backend yang belum punya `GET /signatures*`, pastikan notice kapabilitas tampil (tanpa tombol retry/polling) dan `POST /signatures/request` tetap bisa dipakai dari `/documents`. Saat route ditambahkan backend, polling/retry aktif kembali setelah halaman dimuat ulang (pemetaan hanya untuk route-404).
9. **Unggah dokumen pendukung** — wizard registrasi harus tetap menyelesaikan pendaftaran tanpa lampiran dan tidak mengirim `POST /documents/upload`; cek kembali di staging setelah endpoint unggah tersedia.
10. **Riwayat dispensing** — halaman retur harus tetap menampilkan inventory dan laporan menampilkan `—` (bukan `0`) selama `GET /pharmacy/dispensing/history` belum ada.

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

### Perubahan penyelarasan 2026-10-23 (belum di-commit saat laporan ini diperbarui)

```
src/lib/services/backend-availability.ts                  (baru)
src/lib/services/__tests__/backend-availability.test.ts   (baru)
src/lib/services/diagnostic.service.ts
src/lib/services/document.service.ts
src/lib/services/pharmacy.service.ts
src/lib/services/patient.service.ts
src/lib/services/__tests__/module-endpoints.test.ts
app/(app)/signatures/page.tsx
app/(app)/documents/page.tsx
app/(app)/medicine/return/page.tsx
app/(app)/reports/page.tsx
app/(app)/people/new/page.tsx
src/features/people/components/registration-wizard.tsx
e2e/playwright/support/mock-backend.ts
```

Tidak ada perubahan pada `KODEINxLNG-Backend/`, `package.json`, skema DB, maupun workflow CI.

## Lampiran B — Cara menjalankan ulang

```bash
# Unit + typecheck
npx tsc --noEmit && npx vitest run

# E2E A2 (flag aktif)
NEXT_PUBLIC_FEATURE_LAB=1 npx next build && npx next start -p 3312
node e2e/lab/lab-workflows.mjs              # 34 asersi
node e2e/radiology/radiology-workflows.mjs   # 12 asersi

# Cek real API (backend hidup di NEXT_PUBLIC_API_URL)
# Prasyarat: backend harus bisa boot. Di environment ini `npm run start` gagal
# karena file backend belum ter-commit mengimpor @aws-sdk (lihat §8).
node e2e/lab/real-api-check.mjs              # 6 asersi

# Playwright alur mutasi (mock di browser, build sendiri di port 3111)
npm run test:e2e:playwright                  # 21 asersi (termasuk 4 registrasi)

# Cek status kapabilitas tanpa backend (intercept route-404):
# - /lab  → "Daftar order laboratorium belum tersedia di backend" + Coba lagi
# - /signatures → notice kapabilitas, tanpa Retry/polling
# Lihat §5 (cek tambahan 2026-10-23).

# Flag mati
npx next build && npx next start -p 3313
E2E_BASE_URL=http://localhost:3313 node e2e/lab/flag-off-check.mjs   # 4 cek

# Regresi fase lama (flag mati)
E2E_BASE_URL=http://localhost:3313 npm run test:e2e:frontend
ROLE_BASE_URL=http://localhost:3313 node scripts/role-scenarios.mjs
A11Y_BASE_URL=http://localhost:3313 node scripts/a11y-audit.mjs
```

Laporan hasil: `test-artifacts/a2-e2e/a2-lab-report.json`, `a2-radiology-report.json`, `a2-real-api-report.json`; screenshot di folder yang sama.
