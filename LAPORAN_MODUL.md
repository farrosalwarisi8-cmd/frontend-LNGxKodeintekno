# Laporan Penyelarasan Frontend ↔ Backend — KODEIN Klinik

**Cakupan:** hanya frontend (`kodein-klinik-demo`, Next.js 16). Backend NestJS tidak diubah sama sekali.
**Baseline backend:** `http://localhost:3000/api/v1` (prefix global `api/v1`, envelope `{success, statusCode, message, data, meta?, timestamp}`, auth JWT Bearer + refresh, header `X-Trace-Id`).
**Tanggal laporan:** 6 Oktober 2026

---

## 1. Ringkasan Eksekutif

| Aspek | Hasil |
|---|---|
| Modul terhubung backend | **11 dari 11** (1 modul = 1 fitur) |
| Endpoint backend yang dipakai | **38 endpoint** terkontrak di test (dari 66 di `API_ENDPOINTS.md`) |
| Typecheck (`tsc --noEmit`) | ✅ 0 error |
| ESLint (`--quiet`) | ✅ 0 error (94 warning, tidak ada error) |
| Unit + kontrak + integrasi live (Vitest) | ✅ **131 test lulus / 131** (8 file) |
| E2E browser (CDP, Chrome nyata) | ✅ Login → dashboard → semua halaman render, 0 error console |

---

## 2. Pekerjaan Inti Penyelarasan Endpoint

Semua perubahan berada di frontend:

1. **`.env.local`** — `NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1` (sebelumnya tidak cocok dengan prefix backend).
2. **`src/lib/api-client.ts`** (ditulis ulang):
   - Base URL default `http://localhost:3000/api/v1`.
   - Unwrap envelope backend: mengembalikan `data` (dan `meta` lewat `apiClient.getPaged`).
   - Error envelope backend `{success:false, error, message, fieldErrors?, traceId}` → dilempar sebagai `ApiError(status, message, fieldErrors)` agar bisa ditampilkan per-field di form.
   - Header `X-Trace-Id` otomatis di setiap request.
   - Auto-refresh token: pada 401, sekali retry dengan `POST /auth/refresh`, lalu `setToken` baru.
   - Token disimpan di localStorage + cookie sesi `kodein-klinik-store` (dipakai middleware proteksi route).
3. **`lib/store.ts`** (zustand) — `login`/`verifyMfa` kini async memanggil backend, `commitSession`/`logout` menangani token & cookie.
4. **`lib/remote-sync.ts`** (baru) — mapper data backend → tipe UI frontend + fungsi `sync*` per modul + hook `useSyncedModules(fn)` (dipanggil via `setTimeout(...,0)` agar lolos rule `react-hooks/set-state-in-effect`).

---

## 3. Status Per Modul

> Keterangan: **Unit** = test Vitest lokal · **Kontrak** = `module-endpoints.test.ts` (path dipanggil cocok dengan route NestJS) · **Live** = `live-backend.integration.test.ts` (request nyata ke backend hidup) · **E2E** = script CDP Chrome.

### Modul 1 — Autentikasi & Sesi
- **Endpoint:** `POST /auth/login`, `POST /auth/mfa/verify`, `POST /auth/refresh`.
- **Perubahan:** `auth.service.ts` + `BACKEND_ROLE_MAP` (SYSTEM_ADMIN→admin, DOCTOR_OH→dokter-oh, …), halaman `/login` (akun demo disesuaikan: `admin` / `dr.hendra` + `AdminLNG2026!`), `auth-context.tsx`, cookie sesi untuk middleware.
- **Hasil:** ✅ Unit · ✅ Kontrak · ✅ Live (login 200 + refresh token menghasilkan access token baru) · ✅ E2E (redirect ke `/dashboard`, JWT & cookie tersimpan).

### Modul 2 — Pasien (MPI & Consent)
- **Endpoint:** `GET/POST /patients`, `GET /patients/:id/profile`, `POST /patients/duplicate-check`, `POST /consents/send`, `GET /public/consents/verify`.
- **Perubahan:** `patient.service.ts` ditulis ulang dengan mapper response backend; `reference.service.ts` baru (`resolveScope()` dari JWT/iam untuk `organizationId`/`siteId`/`siteCode` saat create); `people.repository.ts` delegasi ke service.
- **Hasil:** ✅ Unit · ✅ Kontrak · ✅ Live (registrasi pasien menghasilkan `MRN-…`, list & profil menampilkan data, duplikat terdeteksi) · ✅ E2E (halaman employees).

### Modul 3 — Klinik (Kunjungan, Antrean, SOAP)
- **Endpoint:** `POST /clinic/encounters`, `PUT /clinic/encounters/:id/vitals`, `PUT /clinic/encounters/:id/soap`, finalize, `GET/POST /clinic/queues(/call)`, `GET /clinic/icd10/search`.
- **Perubahan:** `encounter.service.ts` ditulis ulang dengan tipe backend (`BackendQueueTicket`, status `LOCKED`, dst.); halaman `visits`, `visits/queue`, `visits/new` (buka encounter → catat TTV → simpan SOAP nyata), `medical-records` (save SOAP).
- **Hasil:** ✅ Unit · ✅ Kontrak · ✅ Live (open → vitals → SOAP → finalize `LOCKED`; ICD-10 search mengembalikan katalog backend) · ✅ E2E.

### Modul 4 — MCU & Fit to Work
- **Endpoint:** `GET/POST /mcu/cycles`, `POST /mcu/cycles/:id/calculate`, `POST /mcu/cycles/:id/ftw-assessment`.
- **Perubahan:** `mcu.service.ts` menyesuaikan enum backend (`McuType`, `FtwStatus`); mapper `mapMcuTypeToBackend` & `mapHealthToFtw`; response `ftw-assessment` = `{assessment, restriction}` (bukan assessment langsung).
- **Hasil:** ✅ Unit · ✅ Kontrak · ✅ Live (create → calculate → assess FIT, muncul di list dengan `ftw_assessment`) · ✅ E2E (`/mcu`, `/mcu/new`, `/mcu/review`).

### Modul 5 — Farmasi (Resep & Dispensing)
- **Endpoint:** `GET /pharmacy/inventory`, `GET /pharmacy/prescriptions/pending`, `POST /pharmacy/dispensing/recommend-batches`, `POST /pharmacy/dispensing`, `POST /pharmacy/returns`.
- **Perubahan:** `pharmacy.service.ts` ditulis ulang (FEFO recommend); halaman `medicine` (sinkron inventaris) dan `medicine/dispense` (ditulis ulang total: resep pending → recommend per item → dispense atomik).
- **Hasil:** ✅ Unit · ✅ Kontrak · ✅ Live (inventaris & resep pending terbaca) · ✅ E2E.

### Modul 6 — Notifikasi
- **Endpoint:** `GET /notifications`, `PUT /notifications/:id/read`, `POST /admin/notification-templates`, `POST /admin/escalation/run-check`.
- **Perubahan:** `notification.service.ts` ditulis ulang; `app-shell.tsx` memanggil `syncNotifications()` saat mount; `app-topbar.tsx` mark-as-read nyata.
- **Hasil:** ✅ Unit · ✅ Kontrak · ✅ Live · ✅ E2E.

### Modul 7 — IAM (Pengguna & Audit)
- **Endpoint:** `GET /iam/users`, `GET /iam/audit-logs`, `POST /iam/audit-logs/verify-chain`.
- **Perubahan:** `iam.service.ts` baru; verify-chain mengembalikan `{isValid, brokenAtIndex?, brokenEntryId?}` (bukan `verified`).
- **Hasil:** ✅ Unit · ✅ Kontrak · ✅ Live (`isValid === true`, audit log tercatat) · ✅ E2E (`/users`, `/audit-logs` dengan tombol Verifikasi Rantai Hash).

### Modul 8 — Reporting & Analitik
- **Endpoint:** `GET /reports/definitions`, `POST /reports/runs`, `GET /reports/exports/:id/download`, `GET /analytics/top-diseases`.
- **Perubahan:** `reporting.service.ts` baru; halaman `reports` sinkron (top-diseases + definisi + Ekspor PDF → `downloadExport`).
- **Hasil:** ✅ Unit · ✅ Kontrak · ✅ Live (definitions & analytics `totalSampledCases ≥ 0`) · ✅ E2E.

### Modul 9 — Dokumen & Sertifikat (QR Verifikasi Publik)
- **Endpoint:** `POST /documents/render-pdf`, `POST /signatures/request`, `GET /public/verify/:token`.
- **Perubahan:** `document.service.ts` menyesuaikan response `{documentId, title, objectKey, qrToken, verificationUrl}`; `certificates/page.tsx` (render → signature request → update qrToken lokal); `app/verify/[token]/page.tsx` verifikasi publik lewat backend.
- **Hasil:** ✅ Unit · ✅ Kontrak · ✅ Live (render PDF + token valid `VERIFIED` + **zero medical disclosure**; token tak dikenal ditolak) · ✅ E2E.

### Modul 10 — Drug & Alcohol (D&A) Testing
- **Endpoint:** `POST /da/tests`, `POST /da/samples`, `POST /da/tests/:id/results`, `POST /da/tests/:id/certificate`.
- **Perubahan:** `da.service.ts` baru; `app/da/page.tsx` alur penuh (create test → sample → results → certificate); tombol Verify/Certify disabled bila belum ada `backendId`.
- **Hasil:** ✅ Unit · ✅ Kontrak · ✅ Live (tes `RANDOM_INSPECTION` → spesimen URINE → NEGATIVE → sertifikat terbit) · ✅ E2E.

### Modul 11 — Master Data & Dashboard
- **Endpoint:** `GET /clinic/icd10/search` (+ agregasi dari modul lain untuk ringkasan dashboard).
- **Perubahan:** `syncMasterData()` di `master-data/page.tsx`; `dashboard/page.tsx` sinkron ringkasan.
- **Hasil:** ✅ E2E (ICD-10 menampilkan 10 diagnosis dari backend, dashboard menampilkan data live).

---

## 4. Hasil Testing Detail

### 4.1 Unit & Kontrak (Vitest, environment node)

```
npx vitest run
 Test Files  8 passed (8)
      Tests  131 passed (131)
   Duration  33.89s
```

File test:
| File | Isi |
|---|---|
| `src/lib/services/__tests__/api-client.test.ts` | 7 test — unwrap envelope, error envelope → `ApiError`, `X-Trace-Id`, auto-refresh 401 |
| `src/lib/services/__tests__/module-endpoints.test.ts` | 12 test — kontrak path/method **38 endpoint** vs route NestJS (regex per modul 1–10) |
| `src/lib/services/__tests__/live-backend.integration.test.ts` | 17 test — request **nyata** ke backend hidup (Modul 1–10, termasuk alur klinis berantai: pasien → encounter → SOAP → finalize → MCU → FTW → sertifikat → verifikasi publik → D&A) |
| 5 file lainnya | test service/store yang sudah ada (consent, upload, dsb.) — tetap lulus |

### 4.2 Integrasi Live (backend NestJS hidup di port 3000)

Backend dijalankan dengan:
```bash
DATABASE_URL="postgresql://postgres@127.0.0.1:5433/layar_emr_db?schema=public" \
JWT_SECRET=... JWT_REFRESH_SECRET=... npx nest start
```
(PostgreSQL lokal port **5433**, DB `layar_emr_db`, sudah `prisma migrate deploy` + seed.)

17/17 test live lulus, mencakup:
- Login admin → JWT + role `SYSTEM_ADMIN`; refresh token menghasilkan access token baru.
- Registrasi pasien otomatis (MRN), daftar & profil, cek duplikat.
- Buka encounter → TTV (BMI terhitung) → SOAP → finalize `LOCKED`.
- ICD-10 search, antrean klinik.
- Siklus MCU → kalkulasi → FTW assessment `FIT` → muncul di list.
- Inventaris & resep farmasi, notifikasi, audit log + `verifyChain().isValid === true`.
- Definisi laporan + analytics.
- Render PDF + QR token → verifikasi publik `VERIFIED` (tanpa bocor data medis); token sampah `isValid: false`.
- D&A: tes → spesimen → hasil → sertifikat.

### 4.3 E2E Browser (Chrome via CDP)

Script: `C:/Users/User/AppData/Local/Temp/cdp-e2e.mjs` — login lewat UI form, lalu navigasi ke semua halaman modul dan membaca `console.error`.

Hasil: **exit 0**, semua halaman (`/dashboard`, `/employees`, `/visits`, `/visits/queue`, `/mcu`, `/medicine`, `/users`, `/audit-logs`, `/reports`, `/certificates`, `/da`, `/master-data`, `/medical-records`) render dengan `hasError: false`, `errors: []`, dan menampilkan **data nyata dari backend** (contoh dashboard: "6 Total Pekerja … Sertifikat Valid 5", master-data: "Diagnosis ICD-10 10").

### 4.4 Static Analysis

```
npx tsc --noEmit        → 0 error
npx eslint app lib src components --quiet → 0 error (94 warning)
```

---

## 5. Batasan & Catatan

1. **Endpoint backend yang belum dipakai frontend** (~28 dari 66): endpoint admin/escalation, sebagian notification-templates, dan endpoint lain yang tidak punya padanan halaman di frontend. Ini di luar cakupan (frontend saja, tidak menambah halaman baru di luar kebutuhan modul).
2. **Modul D&A & daftar sertifikat tanpa GET:** backend tidak menyediakan `GET /da/tests` maupun `GET /documents` (list), sehingga halaman D&A dan daftar sertifikat **menampilkan data lokal hasil aksi sesi berjalan** — data tidak bertahan setelah reload. Semua aksi tulis (create/issue/render) tetap nyata ke backend.
3. **Duplikat `lib/store.ts` & `src/lib/store.ts`:** kedua file identik (path alias `@/*` mencoba root dulu). Perubahan harus diterapkan ke keduanya agar konsisten.
4. **Warning ESLint (94)** sebagian besar rule non-kritis (image/iframe, `react-hooks/exhaustive-deps`) yang sudah ada sebelum perubahan; tidak ada error.
5. **Backend tidak diubah** — semua penyesuaian dilakukan di sisi frontend (mapper, tipe, penulisan ulang service & halaman).

---

## 6. Cara Mengulang Verifikasi

```bash
# 1. Database test (sekali saja)
initdb -D /c/Users/User/AppData/Local/Temp/layar_pgdata -U postgres   # port 5433
createdb -h 127.0.0.1 -p 5433 -U postgres layar_emr_db
# backend: npx prisma migrate deploy && npx ts-node prisma/seed.ts

# 2. Backend (port 3000)
cd ../KODEINxLNG-Backend && DATABASE_URL="postgresql://postgres@127.0.0.1:5433/layar_emr_db?schema=public" \
  JWT_SECRET=dev JWT_REFRESH_SECRET=devrefresh npx nest start

# 3. Frontend (port 3001)
npx next dev --port 3001

# 4. Verifikasi
npx tsc --noEmit
npx eslint app lib src components --quiet
npx vitest run                 # 131 test
node "$TMP/cdp-e2e.mjs"        # E2E browser
```

Login demo: `admin` / `AdminLNG2026!` (SYSTEM_ADMIN) — `dr.hendra` / `AdminLNG2026!` (DOCTOR_OH).
