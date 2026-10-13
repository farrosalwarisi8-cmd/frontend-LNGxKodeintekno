# Laporan Perbaikan Gap Frontend Fase 1 dan Fase 2

> Lingkup: **frontend saja**. Backend, database/schema/migration, endpoint/API contract,
> authorization server-side, queue worker, provider (email/WhatsApp/PSrE), S3/MinIO,
> deployment, dan data production **tidak diubah**. Repo backend hanya dijalankan sebagai
> backend nyata yang **sudah ada**.

## Status

- **COMPLETE (frontend scope)** — seluruh gap yang **dapat diperbaiki tanpa backend** sudah
  diperbaiki atau dinyatakan tidak ditemukan, dengan test + bukti.
- Sisa temuan yang **tidak dapat** diselesaikan tanpa backend/infrastruktur diklasifikasikan
  sebagai `BACKEND_DEPENDENT` / `ENVIRONMENT_DEPENDENT` dan **tidak** diklaim PASS.

## Scope

- Frontend changed: **YES**
- Backend changed: **NO**
- Database changed: **NO**
- API contract changed: **NO**
- Provider changed: **NO**
- Production data changed: **NO**

Verifikasi tidak menyentuh backend: hanya repo frontend yang berubah (`git status` frontend);
backend hanya dijalankan pada port `:3100` sebagai dependensi test (bukan sumber perubahan).

## Summary

Satu temuan = satu kategori (tidak dihitung ganda).

| Kategori | Jumlah | ID |
|---|---|---|
| Total temuan diperiksa | **11** | F1-A … F2-F |
| `FRONTEND_FIXABLE` | **6** | F1-A, F1-C, F1-D, F1-E, F2-A, F2-B |
| `FRONTEND_TEST_GAP` | **3** | F1-B, F2-E, F2-F |
| `NOT_REPRODUCED` | **2** | F2-C, F2-D (sudah diperbaiki pada sesi Fase 1/2 sebelumnya; diverifikasi ulang on source saat ini + diperkuat test) |
| **Diperbaiki/ditutup sesi ini** | **9** | 6 `FRONTEND_FIXABLE` + 3 `FRONTEND_TEST_GAP` |
| `BACKEND_DEPENDENT` (di luar scope, tidak diubah) | **7** | B1–B7 (baca consent, filter daftar pekerja, draft/reopen MCU, guard duplikasi cycle, status FINAL, acknowledge idempotent & endpoint baca) |
| `ENVIRONMENT_DEPENDENT` (di luar scope, tidak diubah) | **4** | staging HTTPS, bucket S3/MinIO, provider PSrE/email/WhatsApp, MFA + 429/500-503 |

## Gap matrix

| ID | Fase | Temuan | Kategori | Perbaikan | Status | Evidence |
|---|---|---|---|---|---|---|
| F1-A | 1 | `playwright-core` belum tersedia di repo frontend; browser E2E bergantung `node_modules` repo backend | `FRONTEND_FIXABLE` | Tambah devDependency `playwright-core@^1.64.0` + `e2e/lib/browser.mjs` (resolusi deterministik + `E2E_CHROME_PATH`) + runner `e2e/run-frontend-e2e.mjs` + script `test:e2e:frontend` / `:contract`. Mode `ui-only` & `business-with-existing-backend` dipisah; exit code ≠ 0 bila ada FAIL | **FIXED** | `e2e/lib/browser.mjs`, `e2e/run-frontend-e2e.mjs`, `package.json`; report `test-artifacts/frontend-e2e/browser-e2e-ui-only-contract-report.json` |
| F1-B | 1 | Mobile/tablet smoke belum ada (driver tidak tersedia saat Fase 1) | `FRONTEND_TEST_GAP` | Smoke test 360×800, 390×844, 768×1024, 1280×800, 1440×900 untuk `/login`, `/public/consent/<token>`, `/verify/<token>`, route terproteksi tanpa sesi, 404, error shell | **FIXED** | `test-artifacts/frontend-e2e/login-*.png`, `public-consent-*.png`, F1B-01…F1B-18 (37 PASS) |
| F1-C | 1 | API base URL tidak terpusat; ada fallback `localhost` di client bundle (`api-client`, lab, wizard upload); kredensial demo seed **ter-hardcode** di `app/login` (`KlinikLNG2026!`) dan `lib/seed.ts`; tidak ada `.env.example`; flag demo/mock tidak eksplisit | `FRONTEND_FIXABLE` | `src/lib/env.ts` = satu-satunya pembaca `NEXT_PUBLIC_*`; **tidak ada fallback localhost** (konfigurasi invalid → error jelas sebelum `fetch`); flag `NEXT_PUBLIC_ENABLE_DEMO` (default mati di staging/production) + `NEXT_PUBLIC_DEMO_PASSWORD` (tanpa nilai di source); password seed di `lib/seed.ts` dikosongkan; `.env.example` dibuat | **FIXED** | `src/lib/env.ts`, `src/lib/api-client.ts`, `app/login/login-page-content.tsx`, `lib/seed.ts`, `.env.example`, `.gitignore`; test `src/lib/__tests__/env.test.ts`, `frontend-config-audit.test.ts`; scan bundle (di bawah) |
| F1-D | 1 | Port frontend/backend lokal bertabrakan → unit test membaca base URL `.env.local` developer dan suite live-backend gagal palsu | `FRONTEND_FIXABLE` | Env test ditentukan di `vitest.config.ts` (`test.env` dari `TEST_API_URL`/`E2E_API_URL`); `env.ts` memprioritaskan `TEST_API_URL` di test runner; probe kesiapan backend diperketat (HTTP 200 **dan** envelope `data.status`) sehingga dev server frontend di `:3000` tidak lagi disangka backend | **FIXED** | `vitest.config.ts`, `src/lib/env.ts`, `src/lib/services/__tests__/helpers.ts` (tak diubah), `live-backend.integration.test.ts`; `npx vitest run` → 344 pass/19 skip; `TEST_API_URL=…:3100` → 19/19 live PASS |
| F1-E | 1 | Pemetaan error belum konsisten/terdokumentasi (500/503 menampilkan "Request failed with status N"; pesan koneksi menyebut port lokal) | `FRONTEND_FIXABLE` | Modul `src/lib/error-mapping.ts` (0/400/401/403/404/409/422/429/500/503 + `retryable`/`clearSession`) dipakai `api-client` untuk pesan default; 401 tetap membersihkan sesi → `/login`; pesan tidak membocorkan stack trace/port internal | **FIXED** | `src/lib/error-mapping.ts`, `src/lib/api-client.ts`; test `src/lib/__tests__/error-mapping.test.ts` (27 test) |
| F2-A | 2 | `mcuService.acknowledgeRestriction()` ada tetapi **tidak dipanggil UI mana pun** (`FRONTEND GAP`) | `FRONTEND_FIXABLE` | Komponen `RestrictionAcknowledgementSection` + logika murni `src/lib/hse-acknowledgement.ts`; permission `acknowledge-restriction` (HSE), confirmation dialog, status `not-acknowledged/submitting/acknowledged/failed/not-available`, error + retry, anti double-submit, timestamp dari response, keterbatasan persistence ditampilkan jujur | **FIXED (persistence status: BACKEND_DEPENDENT)** | `src/features/mcu/components/restriction-acknowledgement.tsx`, `src/lib/hse-acknowledgement.ts`, `app/(app)/health-status/page.tsx`, `lib/rbac.ts`, `lib/actions.ts`, `src/lib/services/mcu.service.ts`; unit `hse-acknowledgement.test.ts`; browser contract F2A-00…F2A-17 (24 PASS); suite Fase 2 `F2-08-01` kini **PASS** |
| F2-B | 2 | Konsistensi tiga lapisan (navigasi + route guard + aksi) belum diuji; `/lab` & `/medicine/return` tidak punya guard padahal menu mensyaratkan permission | `FRONTEND_FIXABLE` | Route guard diselaraskan (`/lab` → `input-lab-result`, `/medicine/return` → `dispense-medicine`); `PRIVILEGED_PERMISSIONS`; test konsistensi nav↔guard↔aksi, termasuk HSE ack hanya untuk `hse` | **FIXED** | `components/route-guard.tsx`, `lib/rbac.ts`; test `src/lib/__tests__/rbac-consistency.test.ts` |
| F2-C | 2 | Consent UI tidak boleh mengarang status / memutasi token saat load | `NOT_REPRODUCED` (sudah diperbaiki sesi sebelumnya) + diperkuat test | State/keputusan diekstrak ke `src/lib/consent-state.ts` (enum `AGREED`/`DECLINED`, pemetaan 400 → used/invalid, selain itu error); halaman tetap **tidak** memanggil API saat dimuat | **FIXED (sudah, lalu diperkuat test)** | `src/lib/consent-state.ts`, `src/features/people/components/public-consent.tsx`; `consent-state.test.ts`; `people-contract.test.ts`; browser contract F2C-01…F2C-06 (F2C-01: 0 request saat load) |
| F2-D | 2 | Daftar pekerja menampilkan filter/status palsu | `NOT_REPRODUCED` (sudah diperbaiki sesi sebelumnya) + diperkuat test | Sudah diperbaiki (filter fixture & kolom status karangan dihapus, keterbatasan API dinyatakan); sesi ini ditambah **bukti kontrak**: hanya `page/limit/search` yang dikirim, tidak ada `select` filter, empty state, keterbatasan dijelaskan | **FIXED (verified + tested)** | `src/features/people/components/people-list.tsx`; `people-contract.test.ts`; browser contract F2D-01…F2D-07 |
| F2-E | 2 | Persistensi UI (MRN/ID dari response, invalidation, double submit) | `FRONTEND_TEST_GAP` | Audit + test kontrak service: MRN dari response backend, kegagalan consent tidak jadi success, refetch setelah mutasi (bisnis suite F2-02/F2-10 tetap PASS) | **FIXED (test gap)** | `src/lib/services/__tests__/people-contract.test.ts`; `test-artifacts/e2e-f2/browser-e2e-report.json` (F2-02, F2-10) |
| F2-F | 2 | Coverage loading/empty/success/error/retry/offline/invalid token/permission | `FRONTEND_TEST_GAP` | Unit test error mapping (0/400…503), env config, consent state, RBAC, HSE ack; **browser contract test dengan mock network** khusus UI mapping (label `frontend-contract-test`), bukan klaim business sukses | **FIXED (test gap)** | `error-mapping.test.ts`, `env.test.ts`, `consent-state.test.ts`, `rbac-consistency.test.ts`, `hse-acknowledgement.test.ts`, `frontend-config-audit.test.ts`, contract suite |

## Test result

| Check | Result |
|---|---|
| Typecheck (`npx tsc --noEmit`) | **0 error** (exit 0) |
| Lint (`npx eslint app lib src components --quiet`) | **0 error** (exit 0) |
| Lint file E2E baru (`npx eslint e2e --quiet`) | **0 error** (exit 0) |
| Unit/component (`npx vitest run`) | **344 pass · 19 skip · 0 fail** (exit 0) |
| Unit + integrasi backend nyata (`TEST_API_URL=http://localhost:3100/api/v1`) | **19/19 live-backend PASS** (total 363 pass) |
| Production build (`npx next build`) | **Lulus** (dijalankan 2×: env `https://api.kodein.example.com/api/v1` untuk scan bundle, dan `http://localhost:3100/api/v1` untuk E2E) |
| Frontend-only E2E (`npm run test:e2e:frontend -- --mode=all`) | **81 skenario: 81 PASS · 0 FAIL · 0 BLOCKED** (exit 0) |
| ↳ ui-only (tanpa backend/kredensial) | 37 PASS |
| ↳ contract (mock network, label `frontend-contract-test`) | 44 PASS |
| Business E2E regresi Fase 2 (backend nyata) | **99 skenario: 88 PASS · 0 FAIL · 11 BLOCKED** (sebelumnya 87 PASS/12 BLOCKED → `F2-08-01` UI HSE kini PASS) |
| Business E2E regresi Fase 1 (backend nyata) | **113 skenario: 100 PASS · 1 FAIL · 11 BLOCKED** (identik baseline; 1 FAIL = defect G4 antrean klinik yang sudah terdokumentasi) |
| Mobile UI (360/390/768/1280/1440) | **PASS** (0 overflow, CTA dapat dioperasikan, modal di dalam viewport) |
| Page errors | **0** (ui-only, contract, dan suite bisnis) |
| Console errors tak terduga | **0** |
| Production localhost scan (`.next/static`) | **0 match** untuk `http://localhost` / URL API lokal. Literal `localhost`/`127.0.0.1` yang tersisa **hanya** pada logika deteksi localhost (`isLocalhostUrl`) dan runtime internal Next.js — bukan endpoint/fallback |
| Demo credential scan | **0 match**: `KlinikLNG2026` = 0 pada source runtime **dan** `.next/static`; `NEXT_PUBLIC_DEMO_PASSWORD` muncul hanya sebagai **nama variabel** (tanpa nilai) |
| Static config audit (`frontend-config-audit.test.ts`) | **PASS** (9/9) |
| RBAC consistency | **PASS** (nav = guard = aksi; HSE ack hanya `hse`; `/lab` & `/medicine/return` kini berguard) |
| Consent UI state | **PASS** (0 request saat load; `AGREED`/`DECLINED`; used/invalid/server-error tidak pernah jadi success) |
| HSE UI state | **PASS** pada browser contract; **persistence setelah refresh = BACKEND_DEPENDENT** (lihat di bawah) |
| Fake success | **0** ditemukan pada flow yang diperbaiki |

## HSE acknowledgement

- **UI tersedia**: `RestrictionAcknowledgementSection` di `/health-status` (`data-testid="hse-restriction-acknowledgement"`), terdeteksi otomatis oleh suite Fase 2 (`F2-08-01` **PASS**).
- **Service existing digunakan**: `mcuService.acknowledgeRestriction()` → `POST /api/v1/mcu/restrictions/:id/acknowledge`. **Tidak ada endpoint baru**; payload tetap `{ acknowledgementType, note? }`.
- **Permission**: `acknowledge-restriction` hanya untuk role `hse` (tombol/section tidak dirender untuk role lain — diverifikasi browser untuk `DOCTOR_OH`, `HR_ADMIN`, `NURSE`, dan unit test untuk seluruh 11 role). Backend juga mengizinkan `HR_ADMIN`/`SYSTEM_ADMIN`; UI sengaja **lebih sempit** (lebih sempit = aman, bukan lebih luas).
- **Success state**: hanya setelah response API sukses; timestamp diambil dari `acknowledged_at` **response server** (bukan waktu lokal). Diverifikasi: status `submitting` muncul selama request; `acknowledged` tidak pernah muncul pada kegagalan 500.
- **Error state**: error 500 tampil pada baris restriksi + tombol berubah menjadi "Coba kirim ulang"; retry berhasil (2 request untuk 1 restriksi: 1 gagal + 1 berhasil).
- **Anti double-submit**: guard state (`submitting` menonaktifkan tombol) + guard in-flight (`ref`); diuji double-click pada dialog konfirmasi → tetap **1** request.
- **Tidak ada mutasi saat load**: membuka `/health-status` mengirim **0** request `acknowledge` (hanya `GET /mcu/cycles` untuk membaca daftar restriksi).
- **Persistence limitation**: ditampilkan eksplisit di UI — *"Acknowledgement berhasil dikirim ke server. Backend belum menyediakan endpoint baca status acknowledgement, sehingga status setelah refresh belum dapat diverifikasi oleh API — status ini hanya berlaku untuk sesi ini."*
- **Backend dependency**: `POST /mcu/restrictions/:id/acknowledge` **tidak idempotent** (record baru tiap panggilan) dan **tidak ada endpoint baca** acknowledgement (`GET /mcu/cycles` tidak memuat status acknowledge) → status setelah refresh **tidak dapat** diverifikasi. Ini tetap `BLOCKED` dan **tidak** diklaim PASS.

## Backend-dependent items not changed

| # | Item | Dampak pada frontend |
|---|---|---|
| B1 | Tidak ada endpoint baca status consent per pekerja | Status consent hanya dari notifikasi; UI menyatakan keterbatasan |
| B2 | `POST /public/consents/verify` satu-satunya jalur token, bersifat mutasi one-time; tidak ada baca token | Pre-validasi token sebelum keputusan tidak mungkin |
| B3 | `GET /patients` hanya `page`/`limit`/`search` | Filter site/unit/status/consent tidak tersedia (UI menyatakannya) |
| B4 | Tidak ada draft/reopen hasil MCU dan `GET /mcu/cycles/:id` | Input hasil bertahap/draft tidak dapat diimplementasikan |
| B5 | Tidak ada guard duplikasi MCU cycle | Duplikasi cycle tidak ditolak backend |
| B6 | Tidak ada guard status FINAL pada FTW assessment | Record FINAL masih bisa ditimpa |
| B7 | Acknowledge tidak idempotent + tidak ada endpoint baca acknowledgement | Setelah sukses, status tidak dapat diverifikasi ulang (UI menampilkan keterbatasan) |

Semua di atas **tidak diubah** (di luar scope frontend) dan **tidak** diklaim PASS.

## Environment-dependent items not changed

- Staging HTTPS (frontend/backend), database staging, akun staging → tidak tersedia.
- Storage driver `local` (bukan bucket S3/MinIO) → upload/signed URL tidak dapat diverifikasi.
- Provider email/WhatsApp/PSrE sandbox → pengiriman & TTE tidak dapat diverifikasi.
- MFA tidak aktif; 429 dan 500/503 tidak dipicu pada backend nyata (hanya diuji lewat **mock network** untuk pemetaan UI, diberi label `frontend-contract-test`).

## Files changed

**Sumber frontend (baru)**
- `src/lib/env.ts` *(baru)* — konfigurasi env terpusat, tanpa fallback localhost
- `src/lib/error-mapping.ts` *(baru)* — pemetaan error → UI
- `src/lib/consent-state.ts` *(baru)* — state consent publik (murni)
- `src/lib/hse-acknowledgement.ts` *(baru)* — logika acknowledgement HSE (murni)
- `src/features/mcu/components/restriction-acknowledgement.tsx` *(baru)* — UI acknowledgement HSE
- `.env.example` *(baru)* — dokumentasi env + flag demo

**Sumber frontend (diubah)**
- `src/lib/api-client.ts` — pakai `env.ts`, tolak konfigurasi invalid, pesan error netral
- `app/login/login-page-content.tsx` — hapus kredensial hardcoded; quick-login hanya via flag demo; label environment
- `lib/seed.ts` — password seed dikosongkan (tidak ada kredensial di bundle)
- `lib/rbac.ts`, `lib/actions.ts` — permission `acknowledge-restriction` + action `mcu.acknowledge-restriction`
- `components/route-guard.tsx` — guard `/lab` & `/medicine/return` diselaraskan dengan navigasi
- `app/(app)/health-status/page.tsx` — memasang section acknowledgement HSE
- `app/(app)/lab/page.tsx`, `src/features/people/components/registration-wizard.tsx` — pakai `apiUrl()` (tanpa fallback localhost)
- `src/features/people/components/public-consent.tsx` — pakai `consent-state.ts`
- `src/lib/services/mcu.service.ts` — tipe balikan acknowledge (aditif)
- `.gitignore` — pengecualian `!.env.example`

**Test (baru)**
- `src/lib/__tests__/env.test.ts`, `error-mapping.test.ts`, `consent-state.test.ts`, `hse-acknowledgement.test.ts`, `rbac-consistency.test.ts`, `frontend-config-audit.test.ts`
- `src/lib/services/__tests__/people-contract.test.ts`
- `e2e/run-frontend-e2e.mjs`, `e2e/lib/browser.mjs`, `e2e/lib/contract-suites.mjs`
- `package.json` (`playwright-core` + script `test:e2e:frontend`, `test:e2e:frontend:contract`), `package-lock.json`
- `vitest.config.ts` (env test deterministik)
- `src/lib/services/__tests__/api-client.test.ts`, `live-backend.integration.test.ts` (deterministik + probe backend)

> Catatan: perubahan `app/(app)/lab/page.tsx`, `app/(app)/reports/page.tsx`, `people.types.ts`, `email-preview.tsx`, `employee-profile.tsx`, `people-list.tsx`, `use-draft.ts`, `patient.service.ts` berasal dari sesi Fase 1/2 sebelumnya dan **tidak diubah** lagi pada sesi ini (kecuali yang disebut di atas).

## Evidence

- **Frontend E2E (ui-only + contract)**: `test-artifacts/frontend-e2e/browser-e2e-ui-only-contract-report.json`
  (+ `browser-e2e-ui-only-report.json` / `browser-e2e-contract-report.json` bila dijalankan per mode)
- **Screenshot (19 PNG)**: `login-{360x800,390x844,768x1024,1280x800,1440x900}.png`, `login-error-390x844.png`,
  `public-consent-{390x844,1280x800}.png`, `verify-invalid-390x844.png`, `not-found-768x1024.png`,
  `hse-ack-{list,confirm,success,error,390x844}.png`, `consent-{approved,used,invalid}-390x844.png`,
  `people-filter-honesty.png`
- **Business E2E (regresi)**: `test-artifacts/e2e-f2/browser-e2e-report.json` (88/0/11),
  `test-artifacts/e2e-staging/browser-e2e-report.json` (100/1/11)
- **Build**: build produksi 2 konfigurasi (lihat Test result)
- **Scan output**:
  - `grep -rl "http://localhost" .next/static` → **0**
  - `grep -rl "KlinikLNG2026" .next/static` → **0**
  - `grep -rEn "https?://(localhost|127\.0\.0\.1)" app components lib src` (tanpa `__tests__`) → **0**
- Tidak ada password, OTP, token, atau data pribadi nyata pada evidence (token consent ditulis
  `<token:redacted>` oleh suite Fase 2; suite contract memakai token mock & password mock).

## Cara menjalankan

```bash
# 0. Prasyarat mode ui-only/contract: production build frontend sudah tersedia.
npx next build                       # gunakan NEXT_PUBLIC_API_URL sesuai environment
npx next start -p 3001

# 1. Quality gate
npx tsc --noEmit
npx eslint app lib src components --quiet
npx vitest run                       # deterministik (TEST_API_URL/E2E_API_URL opsional)

# 2. Frontend-only E2E (TANPA backend, TANPA kredensial)
E2E_BASE_URL=http://localhost:3001 npm run test:e2e:frontend                  # ui-only
E2E_BASE_URL=http://localhost:3001 npm run test:e2e:frontend:contract         # HSE/consent/people (mock network)
E2E_BASE_URL=http://localhost:3001 npm run test:e2e:frontend -- --mode=all    # keduanya

# 3. Mode business-with-existing-backend (TIDAK membuat backend baru)
#    Default kedua suite sudah :3001 (frontend) + :3000 (backend), jadi bisa tanpa env:
npm run test:e2e:frontend -- --mode=business     # delegasi ke e2e/fase2-identity-mcu-staging.mjs
#    bila backend tidak tersedia → status BLOCKED + exit 1 (bukan fake green)

# 4. Regresi suite bisnis yang sudah ada (butuh backend hidup di :3000)
npm run test:e2e:fase2
npm run test:e2e:fase1
```

Untuk **staging**, cukup ganti env (kode tidak berubah):
`E2E_BASE_URL=https://<frontend-staging> E2E_API_URL=https://<backend-staging>/api/v1 SEED_PASSWORD=… npm run test:e2e:fase2`

### Menjalankan lokal (dev) — port yang dipakai konvensi repo

Konvensi yang sudah tertanam di repo: **backend `:3000`**, **frontend `:3001`**
(`.env.local` → `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1`, backend `.env` →
`FRONTEND_URL=http://localhost:3001`, default `E2E_BASE_URL=:3001` + `E2E_API_URL=:3000`).

```bash
# Terminal 1 — backend (NestJS, watch mode)
cd KODEINxLNG-Backend && npm run start:dev          # readiness: http://localhost:3000/health/readiness

# Terminal 2 — frontend dev (WAJIB -p 3001; `next dev` polos akan bentrok dengan backend di :3000)
npx next dev -p 3001
```

Kredensial demo quick-login di `/login` (akun seed backend: `admin`, `dr.hendra`, `perawat`, …)
diaktifkan lewat `.env.development.local` (dev-only, ter-gitignore, **tidak** dibaca `next build`).
Diverifikasi dengan loader env milik Next: mode production hanya memuat `.env.local`
(`NEXT_PUBLIC_DEMO_PASSWORD=undefined`), mode development memuat `.env.development.local`.

## Limitations (jujur)

1. **Staging tidak tersedia** → seluruh angka berasal dari localhost (production build maupun dev server
   + backend nyata di `:3000`). Tidak ada klaim staging/provider/bucket.
2. **Instalasi dependency baru**: `npm install playwright-core` memerlukan `--legacy-peer-deps` karena
   konflik peer **pra-existing** `@types/node@^20` vs `vitest@5` (bukan disebabkan perubahan ini).
3. **Suite live-backend** berjalan penuh bila backend ada di `:3000` (konvensi repo): dengan
   backend + frontend dev seperti di bagian "Menjalankan lokal", `npx vitest run` = **26 file,
   363 test, 0 fail, tanpa skip** (19 test live-backend ikut jalan). Bila port `:3000` dipakai
   proses lain, test live tersebut di-skip dan `TEST_API_URL` harus diisi eksplisit.
4. **1 FAIL** pada regresi Fase 1 = defect produk G4 (status antrean tidak ter-persist) yang sudah
   terdokumentasi sejak Fase 1 dan butuh keputusan produk/backend (`counterId`); bukan regresi.
5. **HSE acknowledgement setelah refresh** tidak dapat diverifikasi (B7) — ditampilkan sebagai keterbatasan
   di UI dan tetap `BLOCKED`, bukan PASS.
6. 429 / 500 / 503 diuji **hanya** melalui mock network untuk pemetaan UI (`frontend-contract-test`),
   tidak diklaim sebagai business flow sukses.
7. Test browser memakai **Chrome channel** (`channel: chrome`) atau `E2E_CHROME_PATH`; bila Chrome tidak
   tersedia, runner berhenti dengan pesan yang menjelaskan cara menyediakannya (tidak fake green).

## Catatan perbaikan harness E2E (flake dev-mode)

Saat suite dijalankan terhadap **dev server** (`next dev`), helper login lama
(`goto domcontentloaded` → `fill` → `click` → `waitForURL`) sesekali gagal: stage
`*-EXC` dengan `page.waitForURL: Timeout 25000ms exceeded`. Analisis bukti trace:
klik terkirim tetapi **tidak ada request `POST /auth/login`** dan snapshot DOM
memperlihatkan `value=""` pada kedua input — artinya input terkontrol diisi
**sebelum hidrasi React**, lalu nilai terhapus saat React mengambil alih DOM.
Probe 8x login: helper lama **1/8 gagal**, dengan `waitIdle` sebelum `fill`
**0/8 gagal**. Ini artefak harness/dev-mode, **bukan** bug aplikasi.

Perbaikan (hanya di harness, tidak menyentuh kode aplikasi): `waitIdle()` +
`fillStable()` (isi ulang sampai nilai benar-benar menempel) pada
`e2e/staging-business-flows.mjs` dan `e2e/fase2-identity-mcu-staging.mjs`.

Verifikasi ulang terhadap **dev server** `:3001` + backend `:3000`:

| Suite | Sebelum perbaikan (dev) | Sesudah perbaikan (dev) | Baseline (production build) |
|---|---|---|---|
| Fase 1 `test:e2e:fase1` | 6 stage `EXC` FAIL (flake) | **100 PASS / 1 FAIL / 11 BLOCKED** (exit 1) | 100 / 1 / 11 |
| Fase 2 `test:e2e:fase2` | 0 FAIL | **88 PASS / 0 FAIL / 11 BLOCKED** (exit 0) | 88 / 0 / 11 |

1 FAIL Fase 1 tetap defect produk **G4** (status antrean tidak ter-persist), bukan regresi.

## Final decision

- **COMPLETE (frontend scope)** — dengan sisa item `BACKEND_DEPENDENT` (B1–B7) dan
  `ENVIRONMENT_DEPENDENT` (staging/provider/bucket/MFA/429/500-503) yang **tidak** diklaim PASS.
- **Alasan berbasis bukti:**
  - Seluruh gap frontend yang dapat diperbaiki mandiri sudah **diperbaiki dengan test dan bukti**:
    driver/runner E2E frontend (F1-A), mobile/tablet smoke (F1-B), konfigurasi env + penghapusan
    fallback localhost & kredensial demo (F1-C), env test deterministik (F1-D), pemetaan error (F1-E),
    **UI HSE acknowledgement** (F2-A), konsistensi RBAC nav/guard/aksi (F2-B), consent honesty (F2-C),
    daftar pekerja tanpa filter/status palsu (F2-D), persistensi UI (F2-E), coverage error/state (F2-F).
  - **Gate hijau**: `tsc` 0 error, `eslint` 0 error, `vitest` 344 pass/19 skip, `next build` lulus,
    frontend E2E **81/81 PASS dengan 0 FAIL / 0 BLOCKED**, 0 page error, 0 console error tak terduga.
  - **Tidak ada fake success**: kegagalan API tidak pernah menjadi success (consent & acknowledgement),
    acknowledged hanya setelah response, keterbatasan persistence ditampilkan.
  - **Bundle production bersih**: 0 URL localhost, 0 kredensial demo.
  - **Regresi aman**: Fase 2 88/0/11 (naik 1 PASS — gap UI HSE tertutup), Fase 1 100/1/11 (identik).
  - **Backend/database/API contract tidak disentuh**; item backend-dependent & environment-dependent
    didokumentasikan dan tetap `BLOCKED`.
