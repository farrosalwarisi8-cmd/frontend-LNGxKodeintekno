# Laporan Fase 2 — Frontend-Only Identity dan MCU E2E

> Lingkup: **frontend saja**. Backend, database/schema/migration, endpoint, API contract,
> authorization server-side, queue worker, provider, S3/MinIO, dan data production
> **tidak diubah**. Repo backend hanya dijalankan sebagai backend nyata yang sudah ada.

## Status

- **BLOCKED — staging belum tersedia.**
- Alasan (sesuai §2 prompt Fase 2): prasyarat staging tidak terpenuhi — tidak ada
  frontend staging HTTPS, backend staging HTTPS, akun staging, database staging,
  bucket S3/MinIO, maupun provider produksi (email/WhatsApp/PSrE). Frontend dan
  backend yang tersedia hanya **lokal (HTTP)**. Karena itu yang dijalankan adalah
  **local verification** pada **production build frontend** melawan **backend nyata +
  database nyata**, dan seluruh kriteria yang bergantung pada staging/provider ditandai
  `BLOCKED`.
- Yang dapat dibuktikan pada environment ini: seluruh flow identitas/MCU lewat UI
  nyata (`UI → API → response → refresh → state tetap tersimpan`), termasuk
  **6 defect frontend yang ditemukan E2E dan sudah diperbaiki** (satu di antaranya
  menyebabkan consent pekerja baru tidak pernah terkirim, satu lagi membuat token
  consent publik dihancurkan hanya dengan membuka halaman).

---

## Scope

| Item | Nilai |
|---|---|
| Frontend changed | **YES** (6 defect diperbaiki: `registration-wizard`, `use-draft`, `public-consent`, `employee-profile`, `people-list`, `email-preview`, `patient.service`, `people.types`, `lib/rbac.ts`) |
| Backend changed | **NO** |
| Database changed | **NO** |
| Migration changed | **NO** |
| Provider changed | **NO** |
| Production data changed | **NO** |
| Endpoint/API contract changed | **NO** |
| Test baru | `e2e/fase2-identity-mcu-staging.mjs` (F2-00 … F2-11, berbasis env, siap staging) + script npm `test:e2e:fase2` / `test:e2e:staging` (gerbang §19) dan `test:e2e:fase1` untuk suite Fase 1 |

---

## Environment

| Item | Nilai |
|---|---|
| Frontend URL | `http://localhost:3001` (production build `next build` + `next start -p 3001`) |
| Backend URL | `http://localhost:3100/api/v1` (backend NestJS nyata, `NODE_ENV=development`) |
| Build mode | **production** (`npx next build`, `NEXT_PUBLIC_API_URL=http://localhost:3100/api/v1`) |
| Commit | branch `feature/frontend-only-20261012`, HEAD `de55f84` + perubahan sesi ini (belum di-commit) |
| Browser/version | Google Chrome **154.0.8037.98** (channel `chrome`, headless) via `playwright-core` |
| Viewports | 360×800, 390×844, 768×1024, 1280×800 (+1440×900 pada suite F1) |
| Test data prefix | `E2E-F2-<timestamp>-<worker>` (contoh: `E2E-F2-20261012235040-w1`) |
| Database | PostgreSQL lokal (`GET /health/readiness` → `database: up`) |
| Storage | driver **`local`** (bukan S3/MinIO) |
| Queue | `queueWorker: up, durable: true, queueDepth: 0` |
| Provider | email/WhatsApp/PSrE **sandbox**, tanpa kredensial staging |
| MFA | tidak aktif (backend mengembalikan `accessToken` langsung) |
| Mock/demo mode | nonaktif (role sesi nyata; `kodein-klinik-demo = null`) |

Catatan environment: port `3000` pada mesin ini dipakai proses `next dev` frontend
yang sedang berjalan, sedangkan `.env.local` menunjuk backend ke port tersebut.
Agar tidak mematikan proses milik pengguna, backend nyata dijalankan pada **port 3100**
(runtime env, bukan perubahan source) dan build/test diarahkan ke port itu. Perilaku
backend identik karena sumbernya backend + database yang sama.

---

## Baseline vs final

| Check | Baseline (sebelum perubahan sesi ini) | Final |
|---|---|---|
| Typecheck (`npx tsc --noEmit`) | 0 error | **0 error** |
| Lint (`npx eslint app lib src components --quiet`) | 0 error | **0 error** |
| Unit test (`npx vitest run`) | 242/261 lulus, 19 gagal — `live-backend.integration.test.ts` tidak dapat menjangkau backend karena port 3000 dipakai dev server frontend | 260/261 lulus dengan `NEXT_PUBLIC_API_URL=http://localhost:3100/api/v1`; suite live-backend **19/19 PASS** saat diarahkan ke backend nyata. 1 sisa kegagalan = `api-client.test.ts` yang meng-assert base URL default `.env.local` (`http://localhost:3000/api/v1`) dan lulus 7/7 pada env kanonik |
| Production build (`npx next build`) | lulus | **lulus** |
| Browser E2E Fase 2 | belum ada (suite F2 belum dibuat) | **99 skenario: 87 PASS · 0 FAIL · 12 BLOCKED**, 0 console error tak terduga, 0 page error, 0 server error (5xx); dijalankan lewat gerbang `npm run test:e2e:staging -- fase2` (exit 0) |
| Regresi suite F1 (`e2e/staging-business-flows.mjs`) | 113 skenario: 100 PASS · 1 FAIL · 11 BLOCKED | **113 skenario: 100 PASS · 1 FAIL · 11 BLOCKED** (identik; FAIL = defect G4 antrean klinik yang sudah terdokumentasi di Fase 1 — bukan regresi) |

---

## Business flow matrix

| Flow | Role | Status | Persistence | Evidence | Blocker |
|---|---|---|---|---|---|
| F2-01 Employee list & detail | HR/PIC | **PASS** (7 PASS + 1 BLOCKED) | Detail + MRN tetap tampil setelah refresh; search backend berfungsi | `F2-01-detail.png`, `F2-01-detail-refresh.png`, `F2-01-filter-limitation.png` | Kriteria "filter site/status bekerja" BLOCKED: `GET /patients` hanya menerima `page/limit/search` |
| F2-02 Create employee & MRN | HR/PIC | **PASS** (10/10) | MRN backend (`MRN-SITE-PLANT-01-2026-00046`) tetap ada setelah refresh; double-click submit tetap 1 record; NIK duplikat → 409; validasi email/tanggal/wajib berfungsi | `F2-02-success.png`, `F2-02-persist.png`, `F2-02-email-invalid.png` | — |
| F2-03 Consent initiation & notification | HR/PIC | **PASS** (5 PASS + 1 BLOCKED) | `POST /consents/send` 201 + notifikasi `CONSENT_DISPATCHED` terbaca ulang setelah refresh; resend idempotent (consentId sama) | `F2-03-consent-tab.png`, `F2-03-resend-modal.png` | Status keputusan consent (PENDING/GRANTED/EXPIRED) tidak dapat dibaca dari API |
| F2-04 Public consent (approve/reject/invalid/used) | Pekerja/Public (tanpa JWT) | **PASS** (9/9) | Approve/reject tercatat backend (`GRANTED`/`REVOKED`); token one-time: pemakaian ulang → 400 dan UI menampilkan state "sudah digunakan"; membuka halaman **tidak** mengirim verify (0 panggilan) | `F2-04-public-load.png`, `F2-04-approved.png`, `F2-04-approved-reopen.png`, `F2-04-invalid-token.png` | Pre-validasi token (VALID/EXPIRED sebelum keputusan) tidak mungkin: tidak ada endpoint baca token |
| F2-05 MCU cycle | Dokter Klinik | **PASS** (6 PASS + 1 BLOCKED) | Cycle dari wizard tersimpan (read-back) dan tetap tampil setelah refresh; `/mcu/new` ditolak untuk role tanpa `create-mcu` | `F2-05-list.png`, `F2-05-wizard-end.png` | Duplikasi cycle tidak ditolak backend (201) |
| F2-06 MCU result & review | Dokter OH | **PASS** (3 PASS + 2 BLOCKED) | Review via UI → `ftw_assessment.ftw_status=FIT` di backend; kalkulasi klinis (BMI, JNC8_BP) tersimpan | `F2-06-review-modal.png`, `F2-06-review-done.png` | Input hasil bertahap/draft + reopen: tidak ada endpoint; record FINAL masih bisa ditimpa (201) |
| F2-07 FTW & restriction | Dokter OH | **PASS** (5/5) | `FIT_WITH_RESTRICTION` + reason + review date tersimpan; tetap tampil setelah refresh; HSE tidak dapat mengubah FTW (403); validasi UI wajib restriksi terbukti | `F2-07-missing-reason.png`, `F2-07-ftw-submitted.png`, `F2-07-after-refresh.png` | — |
| F2-08 HSE acknowledgement | HSE Officer | **BLOCKED** (1 PASS lewat kontrak API, 4 BLOCKED) | Acknowledge tercatat lewat kontrak API (200), tetapi tidak dapat dijalankan/dibaca dari UI | — | **FRONTEND GAP**: tidak ada UI acknowledgement; **BACKEND BLOCKER**: tidak ada endpoint baca acknowledgement + acknowledge tidak idempotent |
| F2-09 Permission/scope/security | 6 role | **PASS** (12/12) | Deep link tanpa sesi → `/login`; sesi kedaluwarsa → `/login`; pasien site lain → 404 disamarkan | report F2-09-01…12 | — |
| F2-10 Error/retry/persistence | HR/PIC | **PASS** (7/7) | Retry tidak menggandakan data; data uji tetap ada setelah refresh penuh; offline menampilkan state jelas (tanpa loading tanpa akhir) | `F2-10-offline.png`, `F2-10-final-persist.png` | 500/503 & 429 tidak disimulasikan |
| F2-11 Mobile & responsive | HR/PIC | **PASS** (20/20) | 360/390/768/1280 tanpa horizontal overflow, tanpa page error; CTA dapat dioperasikan di mobile | `F2-11-people-360x800.png`, `F2-11-people-390x844.png` | — |

---

## Permission/scope matrix

| Role (akun uji) | Site/scope | Route/aksi (allowed) | Ditolak/Diverifikasi | Hasil |
|---|---|---|---|---|
| HR/PIC (`hr.pic`, HR_ADMIN) | ORG | `/people`, `/people/new`, `/people/:id`, `/mcu` | `/master-data` dan `/users` → AccessDenied; `GET /patients` 200 | **PASS** |
| Admin Klinik (role backend `SYSTEM_ADMIN` + scope site, dipetakan `admin-klinik`) | SITE | administratif + `people.create`/`mcu.create` | — | Registry diverifikasi lewat unit test; tanpa akun staging khusus `admin-klinik` |
| Dokter OH (`dr.hendra`, DOCTOR_OH) | GLOBAL | `/mcu`, `/mcu/review`, FTW + restriction | `/master-data` → AccessDenied; `POST ftw-assessment` untuk HSE → 403 | **PASS** |
| Dokter Klinik (`dr.klinik`, DOCTOR_CLINIC) | SITE | `/mcu`, `/mcu/new` (setelah perbaikan registry), input hasil | Pasien site lain → 404 | **PASS** |
| Perawat (`perawat`, NURSE) | SITE | `/mcu/new`, kunjungan | `/mcu/review` → AccessDenied | **PASS** |
| Lab/Analis (`lab.analis`, LAB_ANALYST) | SITE | `/mcu` (view) | CTA "Buat MCU" disembunyikan; `/mcu/new` → AccessDenied | **PASS** |
| HSE Officer (`hse.officer`, HSE_OFFICER) | SITE (Offshore) | `/waiver`, `/health-status`, restriction read | `/users` → AccessDenied; `ftw-assessment` → 403; acknowledge **tidak ada UI** | **PARTIAL** (gap UI) |
| Manajemen (`manajemen`, MANAGEMENT) | GLOBAL | `/mcu`, laporan | `/people` → AccessDenied; `GET /patients` 403 | **PASS** |
| Apoteker (`apoteker`, PHARMACIST) | SITE | `/mcu` (view-mcu ada di registry) | `/employees`, `/people` → AccessDenied | **PASS** |
| Pekerja/Public (tanpa JWT) | token consent | `/public/consent/:token` (data minimum, tanpa data klinis) | Tidak ada akses data klinis; kebocoran = 0 | **PASS** |

Catatan scope: HR_ADMIN ber-scope **ORG** sehingga lintas site **di dalam organisasi**
memang diizinkan backend (diverifikasi 200) — bukan defect, tetapi perlu keputusan
produk bila HR memang harus dibatasi per site. Penolakan lintas site terbukti pada
role ber-scope SITE (dokter klinik → 404).

---

## Negative/error matrix

| Scenario | Result | UI behavior | Evidence |
|---|---|---|---|
| Duplicate employee (NIK sama) | **PASS** | Backend 409 "Patient with this national identifier already registered"; modal duplikat di wizard (`checkDuplicate`) + error submit ditampilkan | report F2-02-08 |
| Token consent invalid | **PASS** | Setelah pekerja menekan keputusan: state "Tautan tidak valid atau kedaluwarsa", tanpa fake success, tanpa crash | `F2-04-invalid-token.png` |
| Token consent sudah dipakai | **PASS** | State "Tautan sudah digunakan" + arahan minta tautan baru; pemakaian ulang via API → 400 | `F2-04-approved-reopen.png` |
| Token consent kosong | **PASS** | Halaman tetap informatif (tidak blank/loop) | report F2-04-06 |
| Token dihancurkan saat halaman dibuka (defect) | **FIXED** | Sebelum diperbaiki: memuat halaman memanggil verify `action=VIEW` → consent `REVOKED` + frontend crash. Sekarang: 0 panggilan verify saat memuat | `F2-04-public-load.png` |
| 401 kredensial salah | **PASS** | Pesan inline pada form login, tanpa reload | report F2-10-01 |
| 401 sesi kedaluwarsa | **PASS** | Token dibersihkan, route klinis → `/login` | report F2-09-11 |
| 403 unauthorized | **PASS** | `AccessDenied` "Akses terbatas" (tanpa render konten terlindungi); `GET /patients` sebagai manajemen → 403 | report F2-09-* |
| 404 pekerja tidak ada | **PASS** | `ErrorState` + tombol retry | report F2-10-03 |
| 404 pasien luar scope | **PASS** | Disamarkan sebagai 404 | report F2-09-12 |
| 409 conflict | **PASS** | Duplikat identifier / status master data | report F2-02-08 |
| 422/400 validasi field | **PASS** | Pesan backend dipetakan ke field; `fieldErrors` terstruktur | `F2-02-email-invalid.png` |
| 500 (server error) | **FIXED → 0** | Sebelum perbaikan: `POST /consents/send` 500 saat create employee via UI (consent type tidak dikenal backend). Final run: **0 server error** | report `serverErrors.total = 0` |
| Timeout/offline | **PASS** | Indikator offline + error state + retry; 1 request `ERR_INTERNET_DISCONNECTED` disengaja (0 tak terduga) | `F2-10-offline.png` |
| 429 / 503 | **BLOCKED** | Tidak ada jalur aman memicu rate limit/503 tanpa mengubah backend | — |

---

## Browser evidence

Semua artefak berada di `test-artifacts/e2e-f2/` (run final).

| Item | Jumlah |
|---|---|
| Total skenario | **99** |
| Passed | **87** |
| Failed | **0** |
| Blocked | **12** |
| Page errors | **0** |
| Unexpected console errors | **0** (30 console error terklasifikasi: 400/401/403/404/409/422/offline yang memang diuji) |
| Server error (5xx) | **0** |
| Request gagal | 59 = 1 simulasi offline + 58 `ERR_ABORTED` (prefetch RSC dibatalkan saat navigasi) — **0 tak terduga** |
| Screenshots | **25 PNG** |
| Traces | **0 zip** (trace hanya disimpan saat ada FAIL; run final tanpa kegagalan) |
| JSON report | `test-artifacts/e2e-f2/browser-e2e-report.json` |
| Regresi F1 | `test-artifacts/e2e-staging/browser-e2e-report.json` (100/113, identik baseline) |

Tidak ada password, OTP, token, atau data pribadi nyata pada evidence: token consent
hanya dipakai di runtime dan ditulis sebagai `<token:redacted>`; URL publik memakai
placeholder `/public/consent/<token>`; semua data uji sintetis ber-prefix `E2E-F2-`.

---

## Frontend defects fixed

Ditemukan oleh E2E Fase 2 dan diperbaiki **tanpa menyentuh backend**:

1. **Consent pekerja baru tidak pernah terkirim (severity tinggi).**
   `registration-wizard.tsx` + `hooks/use-draft.ts` mengirim `consentType`
   `EMR_DATA_PROCESSING`/`HEALTH_DATA_SHARING` yang **tidak ada** pada enum backend
   (`DATA_PROCESSING | MEDICAL_TREATMENT | DRUG_ALCOHOL_SCREENING | TELEMEDICINE`),
   sehingga `POST /consents/send`
   menjawab **500** — namun layar sukses tetap berbunyi "Data pekerja dan consent
   telah dibuat", dan status consent ditulis tetap "Pending". Perbaikan: opsi tipe
   consent diselaraskan ke enum backend (default `DATA_PROCESSING`), layar sukses
   menampilkan status hasil API yang sebenarnya, dan menyediakan tombol
   **"Kirim ulang consent"** yang benar-benar memanggil `POST /consents/send`.
   Bukti: `serverErrors` sebelum perbaikan = 1 (500 pada `/consents/send`); run final = 0.
2. **Halaman consent publik menghancurkan token saat dibuka (severity tinggi).**
   `public-consent.tsx` memanggil `POST /public/consents/verify` dengan `action="VIEW"`
   saat halaman dimuat. Endpoint itu bersifat mutasi + one-time, sehingga backend
   menandai consent `REVOKED` hanya karena halaman dibuka, lalu frontend memetakan
   respons ke state yang tidak ada di tabel konfigurasi → exception/blank. Halaman juga
   menampilkan data karangan (nama "Pekerja Terdaftar", "Berlaku hingga" = now+72 jam,
   tipe/versi consent hardcoded). Perbaikan: tidak ada panggilan API saat memuat,
   keputusan memakai `AGREED`/`DECLINED`, error 400 dipetakan ke state
   "sudah digunakan" / "tidak valid", data karangan dihapus. Bukti: F2-04-02
   (0 panggilan verify saat memuat) + F2-04-03/04/05 lulus.
3. **Tombol "Resend consent" menautkan ke `/public/consent/undefined`.**
   `employee-profile.tsx` hanya membuka pratinjau email dengan `person.consent.token`
   yang tidak pernah ada (profile API tidak mengembalikan consent). Perbaikan: tombol
   memanggil API, tautan diambil dari respons backend, error ditampilkan.
4. **Status consent palsu pada detail pekerja.** Header & tab consent selalu
   menampilkan "Pending"/"Belum ada consent". Perbaikan: status diturunkan dari data
   backend (`GET /notifications` → `CONSENT_DISPATCHED` untuk pasien tersebut) dan
   keterbatasan API dinyatakan eksplisit (tidak lagi menyimpulkan dari ketiadaan field).
5. **Filter daftar pekerja tidak berfungsi + kolom status karangan.**
   `people-list.tsx` menampilkan 5 filter (organisasi/unit/site/status/consent) yang
   diambil dari **fixture** (`org-1`, `site-1`) dan tidak pernah diteruskan ke API
   (`GET /patients` hanya `page/limit/search`), sementara kolom Consent/Status selalu
   "Pending"/"Aktif" untuk semua baris. Perbaikan: kontrol dan kolom palsu dihapus,
   diganti keterangan keterbatasan API. Bukti: `F2-01-filter-limitation.png`.
6. **Role Dokter Klinik terkunci dari `/mcu/new`.** `lib/rbac.ts` tidak memberikan
   `create-mcu` pada `dokter-klinik`, padahal backend mengizinkan `DOCTOR_CLINIC` pada
   `POST /mcu/cycles` (API_ENDPOINTS.md) dan `ROLE_MAPPING.md` menandai create-mcu ✓.
   Akibatnya wizard MCU tidak dapat dipakai role klinis (AccessDenied). Perbaikan:
   permission ditambahkan (tidak ada test yang melemah; `tsc`/`eslint`/`vitest` tetap lulus).

Perubahan pendukung lain: `patient.service.sendConsent()` kini mengembalikan
`consentLink/deliveryStatus/deliveryError` (aditif) dan `CreatedPersonResult`
memiliki `deliveryError`; `email-preview.tsx` mengoreksi klaim masa berlaku tautan
dari 72 jam → 7 hari (sesuai `expired_at` backend).

---

## Backend/provider blockers

Semua item di bawah **tidak diperbaiki** karena berada di luar scope frontend-only.

| # | Kategori | Deskripsi | Dampak pada Fase 2 |
|---|---|---|---|
| B1 | BACKEND_BLOCKER | Tidak ada endpoint baca status consent per pekerja (`GET /patients/:id/profile` tidak memuat consent; tidak ada `GET /consents`) | F2-03 tidak dapat membuktikan status PENDING/GRANTED/EXPIRED setelah refresh (hanya notifikasi pengiriman) |
| B2 | BACKEND_BLOCKER | `POST /public/consents/verify` adalah satu-satunya jalur token dan bersifat mutasi/one-time dengan `action` bebas (non-`AGREED` → `REVOKED`); tidak ada endpoint baca token | F2-04 tidak dapat memvalidasi token sebelum keputusan; state VALID/EXPIRED/USED baru terlihat setelah pekerja memutuskan |
| B3 | BACKEND_BLOCKER | `GET /api/v1/patients` hanya mendukung `page`, `limit`, `search` | Kriteria F2-01 "filter site/status bekerja" & "user Site A tidak melihat Site B pada daftar" tidak dapat dipenuhi dari frontend |
| B4 | BACKEND_BLOCKER | Tidak ada endpoint simpan hasil pemeriksaan MCU bertahap/draft dan tidak ada `GET /mcu/cycles/:id` | F2-06 "input result, save draft, reopen" tidak dapat diuji (hanya `POST /mcu/cycles/:id/calculate`) |
| B5 | BACKEND_BLOCKER | Tidak ada guard duplikasi MCU cycle (pekerja+tanggal sama tetap 201) | Kriteria "duplicate cycle ditolak" gagal di backend |
| B6 | BACKEND_BLOCKER | Tidak ada guard status FINAL pada `ftw-assessment` (panggilan kedua tetap 201 dan mengubah keputusan) | Kriteria "finalized record tidak dapat diubah" gagal di backend |
| B7 | BACKEND_BLOCKER | `POST /mcu/restrictions/:id/acknowledge` tidak idempotent (200 berulang, membuat record baru) dan tidak ada endpoint baca acknowledgement (`GET /mcu/cycles` tidak memuat status acknowledge) | F2-08 "acknowledge tersimpan setelah refresh" tidak dapat diverifikasi |
| B8 | PROVIDER_BLOCKER | Provider email/WhatsApp = sandbox; PSrE tidak tersedia; storage `local` bukan bucket | Status pengiriman consent bersifat simulasi; tanda tangan/QR produksi & signed URL tidak dapat diuji |
| B9 | ENVIRONMENT_BLOCKER | Tidak ada staging HTTPS, akun staging, database staging | Penyebab utama status **BLOCKED** |

Bukti pendukung: log E2E + probe kontrak API pada `test-artifacts/e2e-f2/browser-e2e-report.json`
(detail per skenario) dan `LAPORAN_E2E_FRONTEND_STAGING.md` (Fase 1) untuk blocker G4 dll.

---

## Known limitations

1. **Staging tidak ada** — seluruh angka pada laporan ini berasal dari lingkungan lokal
   (HTTP), bukan staging berjaringan nyata; status maksimum yang jujur adalah BLOCKED.
2. **F2-08 (HSE acknowledgement)** belum dapat dijalankan dari UI: `mcuService.acknowledgeRestriction()`
   sudah ada tetapi tidak dipanggil halaman mana pun (`FRONTEND GAP`), sementara status
   hasil acknowledge juga tidak dapat dibaca dari API (B7).
3. **Pembuatan data uji sebagian lewat kontrak API** (bukan selalu lewat UI) untuk
   prasyarat lintas-role (mis. token consent, cycle MCU); setiap aksi yang menjadi
   kriteria Fase 2 tetap diuji lewat UI.
4. **Cleanup**: backend tidak memiliki endpoint `DELETE`, sehingga data uji tidak dapat
   dihapus dari UI/API. Data tertinggal sengaja diberi namespace dan didokumentasikan
   (lihat bagian Cleanup). Data seed tim lain tidak disentuh.
5. **Tidak disimulasikan**: 429, 500/503 (tidak ada jalur aman pada backend nyata),
   MFA (tidak aktif), dan "offline queue/sync" (frontend hanya punya indikator offline).
6. **Unit test**: pada env default (`NEXT_PUBLIC_API_URL` = `.env.local` → port 3000)
   suite `live-backend.integration.test.ts` gagal 19 test karena port 3000 dipakai dev
   server frontend, bukan backend. Dengan backend nyata diarahkan (port 3100) seluruh
   19 test lulus, dan `api-client.test.ts` (1 test) lulus pada env kanonik.
7. Dua perubahan Fase 1 (`app/(app)/lab/page.tsx`, `app/(app)/reports/page.tsx`) masih
   ada di working tree sesi sebelumnya dan tidak disentuh pada Fase 2.

### Strategi data uji & fixture

- **Prefix korelasi**: `E2E-F2-<timestamp>-<worker>` dipakai pada `employeeNo`, nama pekerja,
  email, dan catatan uji, sehingga seluruh data sesi ini dapat dikenali dan tidak pernah
  menyentuh data pekerja nyata atau seed tim lain.
- **Data sintetis**: NIK 16 digit turunan timestamp, email `<employeeNo>@e2e-test.local`,
  telepon `0812…`, tanggal lahir tetap (1990/1991) — tidak ada data pribadi nyata.
- **Fixture frontend bukan sumber data**: fixture `people.fixtures.ts` kini hanya dipakai
  untuk teks legal consent (`CONSENT_TEXT`); daftar pekerja, MRN, status consent, dan
  keputusan FTW seluruhnya berasal dari API backend (defect fixture sebelumnya sudah
  diperbaiki).
- **Jalur pembuatan data**: aksi yang menjadi kriteria Fase 2 dibuat lewat UI (create
  employee, MCU wizard, review Dokter OH, FTW + restriction, approve/reject consent
  publik); data prasyarat lintas-role (mis. token consent untuk uji F2-04, cycle MCU
  untuk uji F2-06/07) dibuat lewat kontrak API dengan payload yang sama seperti UI.
- **Dapat diulang**: setiap run memakai timestamp baru sehingga tidak menimpa/menduplikasi
  data run sebelumnya (idempotensi juga diuji: double-click submit, resend consent,
  retry tidak menggandakan record).
- **Tanpa cleanup destruktif**: backend tidak menyediakan endpoint `DELETE`, sehingga data
  uji dibiarkan (namespace terdokumentasi) dan tidak ada operasi destruktif ke database.

### Cleanup / data uji tertinggal

| Entitas | Jumlah | Prefix |
|---|---|---|
| Patient/Employee (+MRN) | **17** | `E2E-F2-*` (semua run sesi ini) |
| MCU cycle | **24** (11 ber-`ftw_assessment`, 5 ber-restriction) | milik pasien `E2E-F2-*` |
| Consent + consent event | mengikuti 17 pasien di atas | token tidak disimpan di evidence |
| Notifikasi `CONSENT_DISPATCHED` | mengikuti jumlah pengiriman consent uji | — |

Tidak ada `DELETE` di backend (`grep @Delete` pada `KODEINxLNG-Backend/src` = 0), sehingga
data ini **tidak dihapus** (menghapus langsung di database = di luar scope). Data seed
dan fixture tim lain tidak disentuh. Idempotensi: setiap run memakai timestamp baru
(`E2E-F2-<timestamp>-<worker>`) sehingga dapat diulang tanpa menimpa data run sebelumnya.

---

## Cara menjalankan

```bash
# 0. Prasyarat: backend nyata hidup (PostgreSQL aktif) dan frontend production build.
#    Pada mesin ini backend dijalankan pada port 3100 agar tidak bentrok dengan dev server.

# 1. Quality gate frontend
npx tsc --noEmit
npx eslint app lib src components --quiet
NEXT_PUBLIC_API_URL=http://localhost:3100/api/v1 npx vitest run

# 2. Production build + serve
NEXT_PUBLIC_API_URL=http://localhost:3100/api/v1 npx next build
NEXT_PUBLIC_API_URL=http://localhost:3100/api/v1 npx next start -p 3001

# 3. GERBANG §19 — Browser E2E Fase 2 (production build, backend nyata)
E2E_BASE_URL=http://localhost:3001 E2E_API_URL=http://localhost:3100/api/v1 \
  npm run test:e2e:staging -- fase2
#    -> test-artifacts/e2e-f2/browser-e2e-report.json (+ screenshot)
#    -> exit code 0 pada run ini (87 PASS / 0 FAIL / 12 BLOCKED); exit 1 bila ada FAIL
#       (tidak ada fake green)
#    (sama dengan: npm run test:e2e:fase2)

# 4. Regresi suite Fase 1
E2E_BASE_URL=http://localhost:3001 E2E_API_URL=http://localhost:3100/api/v1 \
  npm run test:e2e:fase1
#    -> 100 PASS / 1 FAIL (defect G4 antrean, terdokumentasi sejak Fase 1)

# 5. Menjalankan sebagian grup saja
E2E_GROUP=F2-04,F2-07 E2E_BASE_URL=... E2E_API_URL=... npm run test:e2e:fase2
#    atau argumen CLI:  npm run test:e2e:fase2 -- F2-04
```

Untuk **staging**, cukup ganti env tanpa mengubah kode:

```bash
E2E_BASE_URL=https://<frontend-staging> E2E_API_URL=https://<backend-staging>/api/v1 \
SEED_PASSWORD=<password-akun-uji> E2E_WORKER=w1 \
  node e2e/fase2-identity-mcu-staging.mjs
```

Env opsional: `E2E_GROUP` (subset grup). Skrip menandai otomatis apakah environment
adalah staging (`https` + non-localhost) dan menulisnya ke JSON report.

---

## Readiness Fase 3

- **NOT READY** — tertahan oleh environment, bukan oleh frontend:
  1. Staging HTTPS (frontend + backend), database staging, dan akun uji per role harus
     tersedia agar seluruh kriteria `BLOCKED` dapat diverifikasi pada jaringan nyata.
  2. Backend perlu menyediakan jalur baca untuk consent (B1), hasil MCU/draft (B4),
     acknowledgement restriction (B7), serta parameter filter daftar pekerja (B3)
     agar acceptance Fase 2 dapat dinyatakan lulus penuh.
  3. Guard bisnis untuk duplikasi MCU cycle (B5) dan status FINAL (B6).
  4. UI acknowledgement HSE perlu dibangun (Fase 3, frontend) setelah jalur baca tersedia.

  Selain item di atas, sisi frontend sudah terverifikasi stabil pada production build:
  typecheck/lint bersih, unit test lulus (dengan backend nyata), dan 87 skenario browser
  lulus tanpa page error/console error tak terduga.

---

### Rekapitulasi per grup (dari `browser-e2e-report.json`)

| Grup | PASS | FAIL | BLOCKED |
|---|---|---|---|
| F2-00 Preflight & environment | 2 | 0 | 3 |
| F2-01 Employee list & detail | 7 | 0 | 1 |
| F2-02 Create employee & MRN | 10 | 0 | 0 |
| F2-03 Consent initiation & notification | 5 | 0 | 1 |
| F2-04 Public consent | 9 | 0 | 0 |
| F2-05 MCU cycle | 6 | 0 | 1 |
| F2-06 MCU result & review | 3 | 0 | 2 |
| F2-07 FTW & restriction | 5 | 0 | 0 |
| F2-08 HSE acknowledgement | 1 | 0 | 4 |
| F2-09 Permission, scope & security | 12 | 0 | 0 |
| F2-10 Error, retry & persistence | 7 | 0 | 0 |
| F2-11 Mobile & responsive | 20 | 0 | 0 |
| **Total** | **87** | **0** | **12** |

Klasifikasi 12 BLOCKED: 7 `BACKEND_BLOCKER`, 1 `FRONTEND_GAP` (UI acknowledgement HSE), 4 `ENVIRONMENT_BLOCKER`.

---

## Final decision

- **BLOCKED**
- **Alasan berbasis bukti:**
  - **Prasyarat §2 Fase 2 tidak terpenuhi**: tidak ada frontend/backend staging HTTPS,
    akun staging, database staging, bucket, atau provider produksi — sehingga sesuai
    aturan prompt, status Fase 2 adalah **BLOCKED — staging belum tersedia** dan yang
    dijalankan adalah local verification pada production build frontend melawan backend
    nyata + database nyata (port 3100).
  - **Terbukti lulus pada production build** (99 skenario: **87 PASS, 0 FAIL, 12 BLOCKED**,
    0 page error, 0 console error tak terduga, 0 server error): employee list/detail +
    search + persistence; create employee via UI dengan **MRN dari backend** yang tetap
    ada setelah refresh; validasi field & duplikat NIK (409); consent initiation/resend
    + notifikasi backend; **public consent approve/reject** dengan penanganan token
    invalid & sudah dipakai tanpa fake success; MCU cycle via wizard + persistence;
    kalkulasi klinis; **review Dokter OH** + **FTW `FIT_WITH_RESTRICTION` beserta reason
    dan durasi** yang terbaca kembali dari backend dan tetap ada setelah refresh;
    permission/AccessDenied lintas role; deep link tanpa sesi & sesi kedaluwarsa → login;
    denial lintas site (404); error 401/403/404/409/422 + offline; dan mobile
    360/390/768/1280 tanpa overflow. Regresi suite F1 tetap 100/113 (1 FAIL = defect G4
    antrean klinik yang sudah tercatat di Fase 1, bukan regresi).
  - **6 defect frontend ditemukan & diperbaiki** (2 di antaranya kritis: consent tidak
    pernah terkirim karena 500 pada `/consents/send`, dan token consent publik
    dihancurkan hanya dengan membuka halaman lalu halaman crash).
  - **12 kriteria BLOCKED** seluruhnya berasal dari ketiadaan staging/provider atau
    keterbatasan kontrak API backend (B1–B9) ditambah satu **FRONTEND GAP**
    (UI acknowledgement HSE belum ada), bukan dari kegagalan frontend yang belum
    diperbaiki: run final **0 FAIL**.
