# Laporan E2E Frontend Staging — Seluruh Aksi Bisnis

> Scope: **frontend + E2E test saja**. Backend, database/schema, migration,
> endpoint, queue worker, provider, bucket, dan data production **tidak diubah**.
> Repo backend hanya dijalankan sebagai backend nyata yang sudah ada.

## Status

- **PARTIAL** — *bukan* `E2E READY`, *bukan* `PASS`.
- Alasan utama: **environment staging tidak tersedia** (prasyarat §3 prompt tidak
  terpenuhi), sehingga seluruh flow yang bergantung pada staging/provider/bucket
  berstatus `BLOCKED`. Yang dapat dibuktikan adalah E2E nyata pada **production
  build frontend** melawan **backend nyata + database nyata** (lokal).
- Selain itu terdapat **1 defect produk** pada flow antrean klinik (lihat §Failures).

---

## Environment

| Item | Nilai |
|---|---|
| Frontend URL | `http://localhost:3001` (**bukan HTTPS, bukan staging**) |
| Backend URL | `http://localhost:3000/api/v1` (`NODE_ENV=development`) |
| Frontend version/commit | branch `feature/frontend-only-20261012`, HEAD `de55f84` (+ perubahan belum di-commit dari sesi ini) |
| Build mode | **production** — `npx next build` lalu `npx next start -p 3001` |
| Browser/version | Google Chrome (channel `chrome`, headless) via `playwright-core` dari `node_modules` repo backend |
| Viewports | 360×800, 390×844, 768×1024, 1280×800, 1440×900 |
| Database | PostgreSQL lokal (produksi **tidak** disentuh). `GET /health/readiness` → `database: up` |
| Storage | driver **`local`** (bukan S3/MinIO bucket) — `storage: up, driver: "local"` |
| Queue | `queueWorker: up, durable: true, queueDepth: 0` |
| Providers | email/WhatsApp/PSrE = **sandbox**; tidak ada kredensial provider staging |
| MFA | **tidak aktif** — login backend mengembalikan `accessToken` langsung tanpa `mfaRequired` |
| CORS/credential | `FRONTEND_URL=http://localhost:3001`, preflight 204 + `Access-Control-Allow-Credentials: true` |

**Validasi prasyarat §3** — hasil:

| Prasyarat | Status |
|---|---|
| Frontend production build | ✅ ada & diuji |
| Frontend staging URL + HTTPS | ❌ tidak ada (hanya `http://localhost:3001`) |
| Backend staging URL | ❌ tidak ada (hanya `http://localhost:3000`) |
| Database staging | ❌ tidak ada (PostgreSQL lokal/dev) |
| Akun test semua role | ✅ 10 akun seed backend nyata berfungsi |
| Data test sintetis | ⚠️ sebagian (tanpa resep pending, tanpa lab order, tanpa report definition) |
| Storage staging (bucket) | ❌ tidak ada (driver lokal) |
| Provider/queue staging | ❌ sandbox; PSrE/email produksi tidak tersedia |
| Browser runner | ✅ Playwright (Chrome) |
| Permission membuat data test | ✅ |
| Mock/demo mode nonaktif | ✅ (`kodein-klinik-demo` = null; role sesi yang berlaku) |

> Karena **staging, provider, dan bucket tidak tersedia**, status maksimum yang
> jujur adalah **PARTIAL**, sesuai §25 prompt.

---

## Scope

- Frontend changed: **YES** (2 perbaikan bug ditemukan E2E — lihat §Perbaikan frontend)
- Backend changed: **NO**
- Database/schema/migration changed: **NO**
- Production data changed: **NO**
- Endpoint/API contract changed: **NO**
- Queue worker/provider/bucket changed: **NO**

---

## Test summary

Sumber: `test-artifacts/e2e-staging/browser-e2e-report.json` (run final).

| Metric | Result |
|---|---|
| Total scenarios | **113** |
| Passed | **100** |
| Failed | **1** |
| Blocked | **11** |
| Skipped | **1** (audit axe dilewati — lihat §Responsive/accessibility) |
| Flaky | **0** (hasil reprodusibel pada 4 kali run) |
| Console unexpected errors | **0** |
| Unhandled page errors | **0** |
| Unhandled network errors | **0** |

Distribusi per area: Preflight 4P/1B · Auth 8P/1B · Error-state 6P/1B · Role matrix
19P · Employee/MRN/Consent 9P · MCU/FTW 4P · Clinic 3P/1F · Pharmacy 3P/2B ·
Waiver 8P · Master Data 5P · Site scoping 5P · Lab 1P/2B · Radiologi 1P ·
D&A 1P · Notification 3P · Reports 1P/2B · TTE/QR 1P/2B · Responsive 8P ·
Accessibility 7P/1S · Performance 3P.

Regresi suite lama (`e2e/frontend-production-readiness.mjs`): **69/69 PASS**, 0 page error —
tidak ada regresi akibat perubahan frontend.

---

## Business flow matrix

| Flow | Role | Browser/viewport | Status | Evidence | Root cause/blocker |
|---|---|---|---|---|---|
| Auth/session (login valid, login salah, restore refresh, deep link, logout, back, expired) | admin + 9 role | Chrome 1280×800 | **PASS** (B1–B7, B9) | `browser-e2e-report.json` B1–B9 | — |
| MFA valid/salah/expired/resend | admin | 1280×800 | **BLOCKED** | B8 | Backend tidak mengaktifkan MFA (`mfaRequired` absen) |
| Employee + MRN + Consent (create via UI, MRN backend, refresh, duplicate submit, duplikat NIK, public consent) | admin | 1280×800 + 390×844 (public) | **PASS** (E1–E9) | `E4-employee-persist.png`, `E8-public-consent.png` | — |
| MCU + FTW + restriction (wizard UI, persistence, FTW Dokter OH, admin ditolak review) | admin, dr.hendra | 1280×800 | **PASS** (F1–F4) | `F2-mcu-list.png` | — |
| Clinic queue + visit + vital + SOAP + lock | perawat, admin | 1280×800 | **FAIL** (G4) / PASS (G1–G3) | `G1-visits.png`, trace `G4-*.zip` | **Antrean**: perubahan status dari UI tidak ter-persist ke backend (G4) |
| Pharmacy prescription + FEFO + dispensing + return | apoteker, perawat | 1280×800 | **PARTIAL** — H1/H4/H5 PASS, H2/H3 BLOCKED | `H1-dispense.png` | Tidak ada resep pending pada data seed (DATA_PROBLEM) |
| Waiver create/send/approve/reject/revoke/public verify | admin | 1280×800 | **PASS** (I1–I8) | `I2-waiver-persist.png` | — |
| Master Data organization CRUD/duplicate/deactivate/guard | admin, dr.klinik | 1280×800 | **PASS** (J1–J5) | `J2-master-data-persist.png` | — |
| Site scoping (HR/PIC vs HSE Officer, cross-site, scope selector) | hr.pic, hse.officer, admin | 1280×800 | **PASS** (K1–K5) | report K1–K5 | — |
| Lab/Radiology/D&A | lab.analis, admin | 1280×800 | **PARTIAL** — L1/L2/L5 PASS, L3/L4 BLOCKED | `L1-lab.png` | Tidak ada lab order pada data seed (DATA_PROBLEM) |
| Notifications (feed, panel, mark-read persisten) | admin | 1280×800 | **PASS** (M1–M3) | `M2-notif-panel.png` | — |
| Offline/reconnect | admin | 1280×800 | **PARTIAL** (indikator offline PASS; sync/reconnect penuh belum ada fitur) | C-offline | Frontend hanya punya indikator offline + draft lokal; tidak ada antrean sync |
| Reports/export + download | manajemen | 1280×800 | **PARTIAL/BLOCKED** — N1 PASS, N2/N3 BLOCKED | `N1-reports.png` | Tidak ada report definition di backend; storage bukan S3 |
| TTE/PSrE/QR | admin | 1280×800 | **BLOCKED** (O1 QR invalid PASS) | report O1–O3 | Provider PSrE staging tidak tersedia |

---

## Role matrix

Semua login memakai akun seed backend **nyata** (`SEED_PASSWORD`, bukan tebakan).

| Role (akun) | Login | Allowed routes | Denied routes | Business action | Result |
|---|---|---|---|---|---|
| System Administrator (`admin`) | ✓ | seluruh modul | `/mcu/review`, `/certificates` (klinis) | create employee/MCU/waiver/master data, D&A | **PASS** |
| Dokter OH (`dr.hendra`) | ✓ | dashboard, MCU | `/master-data` | tetapkan FTW + restriction | **PASS** |
| Dokter Klinik (`dr.klinik`) | ✓ | dashboard, klinik | `/master-data` | encounter + vitals + SOAP | **PASS** |
| Perawat (`perawat`) | ✓ | dashboard, queue, visit | `/users` | registrasi kunjungan | **PASS** |
| Apoteker (`apoteker`) | ✓ | dashboard, farmasi | `/employees` | resep/retur (data kosong) | **PARTIAL** |
| Lab/Radiologi (`lab.analis`) | ✓ | dashboard, lab | `/medicine/dispense` | tab lab (radiologi 403 → degradasi aman) | **PARTIAL** |
| HR/PIC (`hr.pic`) | ✓ | dashboard, people | `/audit-logs` | scope ORG (33 pekerja) | **PASS** |
| HSE Officer (`hse.officer`) | ✓ | dashboard, HSE | `/users` | waiver/restriction, scope site Offshore | **PASS** |
| HSE Manager (`hse.manager`) | ✓ | dashboard, HSE | `/users` | scope GLOBAL | **PASS** |
| Manajemen (`manajemen`) | ✓ | dashboard, laporan | `/employees` | reports (parsial) | **PARTIAL** |
| Pekerja/Public token | n/a (tanpa JWT) | `/verify/[token]`, `/public/consent/[token]` | — | approve consent publik nyata | **PASS** |

---

## Error matrix

| Scenario | Status | UI behavior | Evidence |
|---|---|---|---|
| 401 login salah | **PASS** | error inline "Invalid username or password Sisa percobaan: 4", tanpa reload | B2 |
| 401 sesi berakhir | **PASS** | token dibersihkan → redirect `/login` | B9 (`tokenTersisa=null`) |
| 403 unauthorized | **PASS** | `AccessDenied` "Akses terbatas" + API 403 | C-403 |
| 404 record/token | **PASS** | API 404; halaman publik menampilkan pesan jelas | C-404, E9, O1 |
| 409 duplicate/conflict | **PASS** | "Kode sudah dipakai (409 Conflict)"; decision ganda → 409 | C-409, J3, I6 |
| 422 field validation | **PASS** | backend 400/422; pesan dipetakan ke form | C-422, E1 |
| 429 rate limit | **BLOCKED** | tidak terdeteksi setelah 25 request beruntun | C-429 |
| 500/503 | **BLOCKED** | tidak ada jalur aman untuk memicu 500/503 pada backend nyata tanpa mengubah/merusak data | — |
| Timeout/offline | **PASS** | indikator "Offline" tampil; submit form dinonaktifkan saat offline | C-offline |

---

## Responsive/accessibility

- Viewports diuji: **360×800, 390×844, 768×1024, 1280×800, 1440×900**.
- Horizontal overflow: **0 px di semua viewport** (8/8 PASS).
- Bottom navigation: tampil di 360/390/768; konten **tidak** tertutup bottom nav (padding `main` ≥ tinggi nav).
- Keyboard navigation: form registrasi dapat dioperasikan dengan keyboard (`getByLabel` + `fill` per field), tombol `Enter` pada login ditangani.
- Focus: kelas `focus:ring`/`focus-visible:ring` terpasang pada input/select/tombol (P-form-focus PASS).
- Labels: **semua input pada form registrasi punya `<label for>`** (`input=6, tanpaLabel=0`); error `aria-describedby` + `aria-invalid` tersedia.
- Modal/drawer: `role="dialog"`, `aria-modal`, tombol `aria-label="Tutup"`, Escape menutup.
- Status tidak hanya warna: badge disertai teks (PENDING/APPROVED/…).
- **axe/Lighthouse: SKIP** — `axe-core`/Lighthouse tidak terpasang di repo frontend; audit otomatis belum dijalankan (bukan PASS).

---

## Performance observation

Diukur pada **production build** (bukan target angka yang disepakati — tidak ada
target dari stakeholder, jadi ini murni observasi).

| Metric | Nilai |
|---|---|
| Initial load (`/login`, DOMContentLoaded) | ~103–161 ms |
| Load event | ~170–243 ms |
| TTFB | ~8–16 ms (localhost) |
| Route transition (`/visitors`→`/employees`, networkidle) | ~0.99–1.29 s |
| Route transition (`/visits/queue`) | ~1.18–1.32 s |
| LCP (production build) | **~284–344 ms** |
| CLS | **0.0239** |
| Bundle JS `.next/static` | **≈ 1 299 KB** (total, belum dipisah per-route) |
| API latency | tidak diukur sistematis (localhost); tidak ada target angka |

Catatan: angka di atas dari `localhost` dan **tidak** mewakili staging berjaringan nyata.

---

## Evidence

- JSON report: `test-artifacts/e2e-staging/browser-e2e-report.json` (**1 file**, 113 hasil)
- Screenshots (**15 file PNG**): `dashboard-{360x800,390x844,768x1024,1280x800,1440x900}.png`,
  `E4-employee-persist.png`, `E8-public-consent.png`, `F2-mcu-list.png`,
  `G1-visits.png`, `H1-dispense.png`, `I2-waiver-persist.png`,
  `J2-master-data-persist.png`, `L1-lab.png`, `M2-notif-panel.png`, `N1-reports.png`
- Traces (**1 file**, hanya untuk skenario yang gagal): `test-artifacts/e2e-staging/traces/G4-*.zip`,
  berisi snapshot DOM + aktivitas jaringan saat kegagalan.
- Video: tidak direkam (tidak diaktifkan; snapshot + trace + screenshot dinilai cukup).
- Regresi: `test-artifacts/frontend-readiness/browser-e2e-report.json` (69/69).
- Tidak ada password, token, OTP, atau secret yang disimpan dalam evidence
  (token dipotong; hanya id/nama sintetis `E2E-STG-…` yang dicatat).

---

## Cleanup

Prefix korelasi: **`E2E-STG-<timestamp>-<worker>`**.

### Data test yang dibuat
| Entitas | Jumlah tertinggal | Prefix |
|---|---|---|
| Patient/Employee (+MRN) | 4 | `E2E-STG-*-EMP` |
| Organization (master data) | 10 | `E2E-STG-*-ORG` / `*-DUP` |
| Waiver | 5 | `E2E-STG-* Visitor` |
| MCU cycle | 4 | pasien `E2E-STG-*` |
| Encounter + vitals + SOAP | 4 (dari UI) + beberapa probe | — |
| D&A test + sample | 4 | sample `SMP-2026-LNG-*` |
| Notification | 0 (hanya menandai read milik akun uji) | — |

### Hasil cleanup
- **Organization: 10/10 dinonaktifkan** (`status → INACTIVE`) memakai endpoint resmi
  `PATCH /master-data/organizations/:id/status`. Tidak ada yang dihapus.
- **Patient, Waiver, MCU, Encounter, D&A: TIDAK dapat dibersihkan** —
  backend **tidak memiliki satu pun endpoint `DELETE`** (`grep @Delete` pada
  `KODEINxLNG-Backend/src` = 0 hasil). Menghapus langsung dari database **di luar
  scope** (dilarang mengubah schema/data) sehingga ditinggalkan & didokumentasikan.
- Data seed/shared milik tim lain **tidak disentuh**.
- Idempotensi: setiap run memakai timestamp baru sehingga dapat diulang tanpa
  menimpa/menduplikasi data run sebelumnya; verifikasi "duplicate submit tidak
  menggandakan record" (E5) lulus (1 record per `employeeNo`).

---

## Failures and blockers

| ID | Category | Severity | Description | Owner/follow-up |
|---|---|---|---|---|
| G4 | **PRODUCT_BUG** | **Tinggi** | Halaman `/visits/queue`: tombol "Mulai Konsultasi"/"Selesai Konsultasi"/"Selesai" hanya memanggil `updateVisit` (state Zustand lokal) dan **tidak pernah memanggil backend**. UI menampilkan status berubah, tetapi `GET /clinic/queues` tetap sama → **fake success / perubahan hilang setelah refresh**. Perbaikan butuh `POST /clinic/queues/call` yang mewajibkan `counterId`, sedangkan **tidak ada endpoint counter maupun pemilih counter di UI** → tidak dapat diperbaiki tanpa mengarang kontrak API + keputusan produk. | **Backend/Produk**: sediakan endpoint daftar counter + putuskan pemetaan status UI→backend, lalu perbaiki `app/(app)/visits/queue/page.tsx`. |
| A3 | ENVIRONMENT_BLOCKER | Kritis | Tidak ada staging HTTPS. | Infra |
| H2, H3 | DATA_PROBLEM | Sedang | Tidak ada resep pending pada data seed → FEFO/dispensing/retur tidak dapat diuji end-to-end. | Data seed staging |
| L3, L4 | DATA_PROBLEM | Sedang | Tidak ada lab order pada data seed → input/verify hasil lab tidak dapat diuji. | Data seed staging |
| N2 | DATA_PROBLEM | Sedang | `/reports/definitions` mengembalikan 0 baris → alur export tidak dapat dimulai (UI menampilkan "Tidak ada definisi laporan di backend"). Dan **tidak ada endpoint** untuk membuat report definition. | Data seed staging |
| N3 | ENVIRONMENT_BLOCKER | Tinggi | Storage driver `local`, bukan bucket S3/MinIO → signed URL/upload/download tidak dapat diverifikasi. | Infra |
| O2, O3 | PROVIDER_BLOCKER | Tinggi | Provider PSrE sandbox; tidak ada kredensial staging → status signature & callback tidak dapat diverifikasi. | Provider/Infra |
| B8 | ENVIRONMENT_BLOCKER | Sedang | MFA tidak aktif di backend → flow MFA tidak dapat diuji. | Konfigurasi backend staging |
| C-429 | ENVIRONMENT_BLOCKER | Rendah | Rate limit tidak terpicu oleh 25 request (limit/TTL backend lebih longgar). | Catatan |
| — | DATA_PROBLEM | Rendah | Halaman Lab: `LAB_ANALYST` ditolak (403) pada endpoint radiologi sementara menu Lab & Radiologi digabung di UI. Sudah **diperbaiki** agar tab lab tetap berfungsi dan radiologi menampilkan pesan terpisah. | Selesai (frontend) |
| — | DATA_PROBLEM | Rendah | Halaman Reports: satu sumber 403 (`/patients` untuk `MANAGEMENT`) sebelumnya mengosongkan seluruh halaman. Sudah **diperbaiki** (partial-failure isolation + peringatan parsial). | Selesai (frontend) |
| — | UX (minor) | Rendah | Tombol "Kirim consent" pada waiver mengirim tanpa email; backend menolak 400 "Email penerima consent wajib diisi (hostEmail atau body.email)" bila `hostEmail` kosong saat create. Pesan error tampil jelas, tetapi UI tidak mewajibkan/mengumpulkan email sebelum kirim. | Frontend (backlog) |

---

## Perbaikan frontend yang dilakukan

Hanya **bug frontend** yang diperbaiki; backend/schema/endpoint tidak disentuh.

1. **`app/(app)/lab/page.tsx`** — `Promise.all` → `Promise.allSettled` dengan isolasi
   per-sumber. Sebelumnya, 403 pada `/diagnostic/radiology-orders` (yang memang
   ditolak backend untuk role `LAB_ANALYST`) membuat **seluruh halaman** hanya
   menampilkan "Gagal memuat data", sehingga data laboratorium yang sebenarnya
   boleh diakses ikut hilang. Kini tab Laboratorium tetap berfungsi dan kegagalan
   radiologi ditampilkan terpisah (`ErrorState` khusus di tab Radiologi).
2. **`app/(app)/reports/page.tsx`** — `Promise.all` → `Promise.allSettled` +
   peringatan parsial (`role="status"`). Sebelumnya 403 pada `/patients` (role
   `MANAGEMENT`) mengosongkan seluruh halaman laporan; kini halaman tetap tampil
   dan pengguna diberi tahu bahwa angka hanya mencakup sumber yang berhasil dibaca
   (mencegah angka 0 disalahartikan sebagai data nyata).

Verifikasi ulang setelah perbaikan: `tsc --noEmit` 0 error, `eslint` 0 error,
`vitest run` **261/261 lulus**, `next build` lulus, suite E2E bisnis **100/113 PASS**
(naik dari 91) dan suite lama tetap **69/69**.

---

## Cara menjalankan

```bash
# 0. Prasyarat: backend nyata hidup di :3000 (PostgreSQL aktif).
cd kodein-klinik-demo

# 1. Quality gate frontend
npx tsc --noEmit
npx eslint app lib src components --quiet
npx vitest run

# 2. Production build + serve (WAJIB production build)
npx next build
npx next start -p 3001

# 3. Browser E2E — seluruh aksi bisnis (suite baru)
E2E_BASE_URL=http://localhost:3001 node e2e/staging-business-flows.mjs
#    → test-artifacts/e2e-staging/browser-e2e-report.json
#    → exit code 1 bila ada FAIL (tidak ada fake green)

# 4. Regresi suite kesiapan produksi yang sudah ada
E2E_BASE_URL=http://localhost:3001 node e2e/frontend-production-readiness.mjs
```

Env opsional: `E2E_API_URL`, `SEED_PASSWORD`, `E2E_WORKER` (label korelasi).

---

## Definition of Done — pemenuhan

| Kriteria §25 | Status |
|---|---|
| Production build digunakan | ✅ |
| Frontend terhubung ke backend (lokal) | ✅ |
| Frontend terhubung ke **staging** | ❌ BLOCKED |
| HTTPS/cookie/CORS/credentials | ⚠️ CORS+credentials PASS pada HTTP lokal; HTTPS tidak ada |
| Auth/session | ✅ (MFA ❌ BLOCKED) |
| Semua role utama diuji | ✅ 10 role + public token |
| Employee/consent | ✅ |
| MCU/FTW/restriction | ✅ |
| Clinic/queue/vital/SOAP/lock | ⚠️ vital+SOAP ✅ (read-back FHIR), **antrean ❌ FAIL**, finalize/lock tidak ada UI |
| Pharmacy/dispensing/return | ❌ BLOCKED (data seed) |
| Waiver | ✅ |
| Master Data | ✅ |
| Site scoping | ✅ |
| Lab/Radiology/D&A | ⚠️ Radiologi+D&A ✅; hasil lab ❌ BLOCKED (data seed) |
| Notification mark-read | ✅ |
| Queue/delivery status | ❌ BLOCKED (provider) |
| Storage/upload/download | ❌ BLOCKED |
| Report export/download | ❌ BLOCKED |
| TTE/PSrE/QR | ❌ BLOCKED (QR invalid ✅) |
| Offline/reconnect/sync | ⚠️ indikator offline ✅; sync penuh tidak tersedia |
| Error 401–503 | ⚠️ 401/403/404/409/422 ✅; 429 & 500/503 ❌ BLOCKED |
| Mobile/responsive | ✅ |
| Accessibility dasar | ✅ struktural; audit otomatis ❌ tidak tersedia |
| Tidak ada fake success | ⚠️ **ditemukan 1 di flow antrean (G4)** |
| Tidak ada console error tak terduga | ✅ 0 |
| Tidak ada unhandled network error | ✅ 0 |
| Evidence tersedia | ✅ |
| Test cleanup aman | ⚠️ sebagian (tidak ada endpoint DELETE) |

Syarat "critical business flow lulus **dan** staging/provider/storage tersedia"
**tidak terpenuhi** → status maksimal: **PARTIAL**.

---

## Final decision

- **PARTIAL**
- **Alasan berbasis bukti:**
  - **Terbukti lulus** pada production build frontend melawan backend + database
    nyata: auth/session (tanpa MFA), 10 role + public token, permission/AccessDenied,
    Employee+MRN (MRN dibuat backend)+Consent publik, MCU+FTW+restriction,
    visit+vital+SOAP dengan **read-back FHIR SATUSEHAT** (sistolik LOINC 8480-6 = 130
    mmHg terbaca kembali), Waiver create/send/public verify/approve/reject/revoke
    (token uji nyata, decision ganda → 409), Master Data CRUD/409/dependency guard,
    site scoping lintas site, D&A, notifikasi mark-read persisten, error 401/403/404/409/422,
    responsive 5 viewport tanpa overflow, dan a11y dasar — **100/113 skenario PASS,
    0 console/page error tak terduga, 0 flaky**.
  - **Belum dapat dibuktikan**: koneksi ke staging HTTPS nyata, provider TTE/PSrE,
    email/WhatsApp, storage S3/signed URL, report export, FEFO/dispensing/retur,
    input+verify hasil lab, MFA, serta 429 dan 500/503. Semua tertahan pada
    **ketiadaan staging/provider/bucket/data seed** (11 BLOCKED).
  - **1 defect produk** ditemukan dan direproduksi: perubahan status antrean klinik
    di UI **tidak** tersimpan ke backend (fake success pada level UI) — flow antrean
    tidak dapat dinyatakan lulus.
