# Laporan Implementasi Tahap 3 — Integrasi End-to-End

## Status
- **PARTIAL** (maju jauh dari baseline; sisa pekerjaan terdaftar di *Backend follow-up* & *Known limitations*)

## Scope
- Frontend changed: **YES** (7 berkas diubah, 2 penambahan servis + 1 skrip E2E)
- Backend changed: **YES** (22 berkas diubah, 3 berkas baru di `KODEINxLNG-Backend/`)
- Database/migration changed: **NO** (skema Prisma tidak berubah; **seed diperluas**)
- Environment: **development** (PostgreSQL lokal `layar_emr_db`, backend NestJS `localhost:3000`)

## Ringkasan
Tahap 3 menutup celah integrasi terbesar antara frontend dan backend:

1. **Seed akun uji per role (11 akun)** + data operasional nyata (pekerja, pasien, consent,
   antrean, encounter + resep, inventaris + batch FEFO, siklus MCU + FTW + restriksi,
   template & baris notifikasi, baseline audit) — `KODEINxLNG-Backend/prisma/seed.ts`.
2. **Otorisasi server-side diperkuat** pada endpoint prioritas: `/patients`, `/consents/send`,
   `/clinic/queues/call`, `/clinic/icd10/search`, `/mcu` (bulk-import status), `/diagnostic/*`
   (order/result/verify per-role), `/documents/render-pdf`, `/signatures/request`,
   `/reports/runs`, `/reports/exports/:id/download`, `/sync/conflicts`.
3. **Endpoint baru** `POST /iam/users` + `PATCH /iam/users/:id` (create akun + toggle aktif
   dengan audit `USER_CREATE`/`USER_UPDATE`) sehingga halaman Manajemen User tidak lagi
   menyimpan palsu.
4. **Audit event nyata** pada aksi penting: `LOGIN_SUCCESS`, `EMPLOYEE_CREATE`,
   `CONSENT_DISPATCH/APPROVED/REJECTED`, `FTW_ASSESS`, `RESTRICTION_ACK/CLOSE`,
   `ENCOUNTER_FINALIZE`, `PRESCRIPTION_DISPENSE`, `SIGNATURE_REQUEST`, `USER_CREATE/UPDATE` —
   semuanya dalam rantai hash SHA-256 append-only (`verify-chain` valid).
5. **Idempotency**: resend consent tidak lagi membuat baris duplikat (reuse consent PENDING);
   token consent bersifat **one-time** (verify ulang → 400); sync push idempotent
   (device + localRecord → `IDEMPOTENT_SKIPPED`).
6. **Notifikasi dari event bisnis**: dispatch consent membuat baris notifikasi + delivery log;
   FTW dengan restriksi membuat notifikasi untuk HSE/HR; mark-as-read menerapkan ownership
   (notifikasi user lain → 404).
7. **Tiga bug integrasi nyata ditemukan & diperbaiki** (lihat bagian *Bug yang ditemukan*).
8. **Fake success dihapus**: modal "Tambah User" kini memanggil backend (error backend
   ditampilkan apa adanya); tombol "Sinkronkan" pada Emergency Mode kini mendorong antrian
   ke `POST /sync/register-device` + `POST /sync/push` (status SYNCED/IDEMPOTENT_SKIPPED/CONFLICT
   dari backend); halaman Waiver diberi banner **Mode Demo/BLOCKED** karena backend belum
   memiliki endpoint waiver.

## Endpoint terintegrasi
| Domain | Endpoint | Frontend | Backend | E2E |
|---|---|---|---|---|
| Identity | `POST /auth/login` (11 akun role) | PASS | PASS | PASS |
| Identity | `POST /auth/refresh` | PASS | PASS | PASS |
| Identity | `GET /iam/users`, `GET /iam/users/:id` | PASS | PASS | PASS |
| Identity | `POST /iam/users`, `PATCH /iam/users/:id` (BARU) | PASS | PASS | PASS |
| Audit | `GET /iam/audit-logs`, `POST .../verify-chain` | PASS | PASS | PASS |
| MPI | `POST /patients` (MRN server-side, duplikat 409) | PASS | PASS | PASS |
| MPI | `GET /patients`, `GET /patients/:id/profile` | PASS | PASS | PASS |
| Consent | `POST /consents/send` (idempotent resend) | PASS | PASS | PASS |
| Consent | `POST /public/consents/verify` (one-time token) | PASS | PASS | PASS |
| MCU | `POST/GET /mcu/cycles`, `calculate`, `ftw-assessment` | PASS | PASS | PASS |
| MCU | `POST /mcu/restrictions/:id/acknowledge` & `/close` | PASS | PASS | PASS |
| Clinic | `GET /clinic/queues`, `POST /clinic/encounters` | PASS | PASS | PASS |
| Clinic | `PUT .../vitals` (BMI number), `PUT .../soap`, `finalize` (lock 403) | PASS | PASS | PASS |
| Clinic | `GET /clinic/icd10/search` | PASS | PASS | PASS |
| Pharmacy | `GET /pharmacy/inventory`, `prescriptions/pending` | PASS | PASS | PASS |
| Pharmacy | `POST /dispensing/recommend-batches` (FEFO), `dispensing` | PASS | PASS | PASS |
| Lab/Rad | `POST /diagnostic/lab-orders|lab-results|.../verify|radiology-*` | n/a (API) | PASS | PASS (auth) |
| Documents | `POST /documents/render-pdf`, `signatures/request`, `signatures/callback` | PASS | PASS | PASS |
| Documents | `GET /public/verify/:qrToken` (tanpa bocoran klinis) | PASS | PASS | PASS |
| Notification | `GET /notifications`, `PUT /notifications/:id/read` | PASS | PASS | PASS |
| Offline sync | `POST /sync/register-device`, `push` (idempotent), `GET conflicts` | PASS | PASS | PASS |
| Reporting | `GET /reports/definitions`, `POST reports/runs`, `analytics/top-diseases` | PASS | PASS | PASS |

## Workflow end-to-end
| Workflow | Result | Evidence |
|---|---|---|
| Employee + consent + notifikasi | PASS | `scripts/e2e-tahap3.mjs` §3 (10 cek): create→MRN server→409 duplikat→resend idempotent (consentId sama)→public verify GRANTED→token one-time 400; audit `EMPLOYEE_CREATE`+`CONSENT_*`; baris notifikasi+delivery tercatat |
| MCU + FTW + restriksi | PASS | §4 (9 cek): create→calculate→FTW+restriksi→HSE acknowledge→close hanya DOCTOR_OH (HSE 403)→FTW tersimpan setelah refetch; audit `FTW_ASSESS` |
| Clinic visit + SOAP + lock | PASS | §5 (7 cek): antrean seed→encounter→vitals BMI 23.44→ICD-10→SOAP `I10`→finalize `LOCKED`→edit pasca-lock 403; audit `ENCOUNTER_FINALIZE` |
| Pharmacy dispensing FEFO | PASS | §6 (9 cek): pending resep→recommend-batch (PCM-2026-C expiry terdekat)→dispensing 201→stok total 1891→1882→resep hilang dari pending; audit `PRESCRIPTION_DISPENSE` |
| Documents + TTE + QR | PASS | §7 (7 cek): render-pdf→signature PENDING→callback mock SIGNED→public verify `VERIFIED` tanpa data klinis→token invalid `isValid=false`; audit `SIGNATURE_REQUEST` |
| Notification | PASS | §8 (4 cek): list data nyata→mark-as-read READ persist→ownership user lain 404 |
| Offline sync | PASS | §10 (5 cek): register device→push SYNCED→push ulang IDEMPOTENT_SKIPPED→conflicts admin-only |

## Role authorization
| Role (akun) | Login | Allowed endpoint (contoh) | Denied endpoint (contoh) | Result |
|---|---|---|---|---|
| SYSTEM_ADMIN (`admin`) | PASS | `/iam/users`, `/iam/audit-logs`, dispensing, render-pdf | — (superuser) | PASS |
| DOCTOR_OH (`dr.hendra`) | PASS | FTW assessment, render-pdf, inventory | `/iam/users` (403), dispensing (403) | PASS |
| DOCTOR_CLINIC (`dr.klinik`) | PASS | `/patients`, encounters | FTW assessment (403) | PASS |
| NURSE (`perawat`) | PASS | `/patients`, vitals, encounters | `/iam/audit-logs` (403), render-pdf (403) | PASS |
| PHARMACIST (`apoteker`) | PASS | inventory, dispensing, FEFO | FTW assessment (403), `/analytics/top-diseases` (403) | PASS |
| LAB_ANALYST (`lab.analis`) | PASS | login + role backend | audit-logs (403) | PASS |
| RADIOLOGIST (`radiolog`) | PASS | login + role backend | audit-logs (403) | PASS |
| HR_ADMIN (`hr.pic`) | PASS | `/iam/users`, `/patients`, consents | `/iam/audit-logs` (403), render-pdf (403) | PASS |
| HSE_OFFICER (`hse.officer`) | PASS | acknowledge restriksi, top-diseases | `/patients` (403), consents/send (403) | PASS |
| HSE_MANAGER (`hse.manager`) | PASS | top-diseases | `/patients` (403) | PASS |
| MANAGEMENT (`manajemen`) | PASS | login, dashboard | `/patients` (403), inventory (403), conflicts (403) | PASS |
| (tanpa token) | — | — | seluruh endpoint prioritas → **401** | PASS |

Matrix lengkap dibuktikan oleh `KODEINxLNG-Backend/test/authorization.e2e-spec.ts`:
**71/71 lulus** (10 endpoint × matriks 401/403/2xx + 404 generik + envelope error + idempotency + audit chain).

## Tests
| Layer | Command | Result |
|---|---|---|
| Frontend typecheck | `npx tsc --noEmit` | **PASS** (0 error) |
| Frontend lint | `npx eslint app lib src components --quiet` | **PASS** (0 masalah) |
| Frontend unit + live integration | `npx vitest run` | **PASS — 261/261 (19 berkas)** (baseline 259; +2 test baru Modul 7 & 11; 19 test integrasi live berjalan terhadap backend nyata) |
| Backend unit | `npm test` (dalam `KODEINxLNG-Backend`) | **PASS — 22/22 (3 berkas)** |
| Backend integration (authorization e2e) | `npm run test:e2e` | **PASS — 71/71** |
| Backend build | `npm run build` (nest build) | **PASS** |
| Backend lint | `npm run lint` | 26 error — **semua pre-existing** (baseline sebelum perubahan: 28 error; perubahan Tahap 3 membersihkan 2 dan tidak menambah baru) |
| Frontend build | `npm run build` | **PASS** |
| Live API E2E | `node scripts/e2e-tahap3.mjs` | **PASS — 90/90** (bukti: `e2e-tahap3-report.txt`) |
| Backend health | `GET /health/liveness` & `/health/readiness` | **PASS — 200** |

## Database/migration
- Tidak ada perubahan skema/migrasi baru (migration `20261004010508_init_emr_baseline` tetap).
- **Seed diperluas** (`prisma/seed.ts`, idempotent — aman dijalankan berulang):
  - 11 akun uji per role, **satu password dev** `KlinikLNG2026!` (hanya development/staging;
    akun `admin`/`dr.hendra` lama disamakan password-nya — lihat *Known limitations* #10).
  - 3 pekerja+pasien+identifier (hash NIK SHA-256), consent PENDING (Andi) & GRANTED (Siti).
  - 2 unit kerja tambahan (HR-CORP), 3 site, 11 role.
  - 7 baris inventaris + 8 batch FEFO di 2 site; appointment + antrean `A-001`; encounter DRAFT
    + TTV + SOAP + diagnosis `J06.9` + resep FINAL 9 tablet Paracetamol.
  - Siklus MCU Siti FINAL + FTW `FIT_WITH_RESTRICTION` + restriksi ACTIVE + notifikasi HSE.
  - 3 template notifikasi + 2 baris notifikasi; 1 baseline audit event (genesis hash).
- Rollback: seed hanya operasi upsert; `prisma migrate reset` mengembalikan database kosong.

## Bug yang ditemukan & diperbaiki (integrasi nyata)
1. **JWT tidak memiliki klaim `id`** — `@CurrentUser()` membaca `user.id` tetapi payload hanya
   berisi `sub`, sehingga `signer_user_id`, `user_id` acknowledge, dan ownership check
   **undefined** (request 500 & mark-as-read user lain lolos). Diperbaiki: `id` ditambahkan ke
   payload (`auth.service.ts`) + normalisasi `id ?? sub` pada `jwt-auth.guard.ts` (token lama tetap terbaca).
2. **BMI direspons sebagai string** (Prisma Decimal) padahal kontrak frontend `number` —
   `recordVitals` kini mengonversi field Decimal ke number.
3. **Resend consent menghasilkan duplikat** — kini reuse consent `PENDING` + expiry 7 hari;
   token one-time (verify ulang → 400).

## Audit/idempotency/error handling
- Rantai audit SHA-256 append-only; `POST /iam/audit-logs/verify-chain` → `isValid: true`
  setelah **seluruh** operasi E2E (90 skenario) dan e2e otorisasi (71 test).
- Idempotency: consent resend (consentId identik), sync push (`IDEMPOTENT_SKIPPED`),
  duplicate employee/identifier → **409** dengan pesan generik.
- Error contract: 400 (+`fieldErrors`), 401, 403 (`Access denied: required one of roles [...]`),
  404 generik (tanpa detail sensitif), 409, 500 — semuanya ber-envelope
  `{ success, statusCode, error, message, fieldErrors?, traceId, timestamp }` dan trace ID
  dikembalikan (frontend mengirim `X-Trace-Id` per request).

## Mock/simulation yang dihapus (atau dilabeli)
| Sebelum | Sesudah |
|---|---|
| Halaman Users: modal "Tambah User" menutup diri tanpa request (fake success) | Terhubung `POST /iam/users`; menampilkan error backend; "Nonaktifkan" terhubung `PATCH /iam/users/:id`; tombol "Reset Password" (tanpa endpoint) dihapus |
| Halaman Users: tombol "Edit" mati | Diganti aksi nonaktifkan yang nyata |
| Emergency Mode: "Sinkronkan" hanya membalik state lokal | Mendorong antrian ke `POST /sync/register-device` + `POST /sync/push`; status per-record dari backend; gagal → pesan error, antrian tetap pending |
| Emergency Mode: catatan baru langsung `synced` | Catatan baru selalu `pending` sampai sinkronisasi backend berhasil |
| Halaman Waiver: data hardcoded + approve/reject lokal tanpa label | Banner **Mode Demo: endpoint backend belum tersedia (BLOCKED)**; data eksplisit dinyatakan lokal |
| Login page: hanya 2 akun demo, password lama | 10 chip akun role + password seed terbaru |

## Backend follow-up
1. **Endpoint waiver** (`GET/POST/PATCH /waivers`) — model `VisitorWaiver`/`WaiverConsent` sudah
   ada di skema; setelah dibuat, hapus banner demo halaman Waiver.
2. **Master data create** — halaman Master Data masih punya tombol "Tambah" tanpa endpoint
   backend (`/clinic/icd10` read-only); buat endpoint admin-only atau hapus tombol.
3. **Scoping baris per site** — otorisasi Tahap 3 bersifat role-based; filter site/unit per baris
   (mis. `DOCTOR_CLINIC` site A tidak melihat pasien site B) belum diterapkan pada `/patients`,
   `/mcu/cycles`, `/pharmacy/prescriptions/pending`.
4. **Reset password akun** — endpoint `POST /iam/users/:id/reset-password` belum ada (tombol frontend dihapus).
5. **Job queue & delivery log nyata** — email consent masih adapter simulasi (baris notifikasi +
   delivery tercatat, SMTP/WhatsApp belum terpasang); `POST /admin/escalation/run-check` sudah ada.
6. **Webhook signature PSrE** — `POST /signatures/callback` masih publik tanpa verifikasi
   signature payload provider (mock provider `PRIVY_MOCK` dilabeli).
7. **Backend lint** — 26 error pre-existing (`no-explicit-any`, unused imports) perlu dibersihkan terpisah.
8. **Seed password** — akun dev `admin`/`dr.hendra` lama (`AdminLNG2026!`) disamakan menjadi
   `KlinikLNG2026!` agar konsisten; bila ada dokumentasi lama, perbarui.

## Known limitations
1. **Halaman Waiver** = demo lokal berlabel (endpoint backend belum ada — BLOCKED).
2. **Master Data** tab Perusahaan/Departemen/Lokasi tetap dari seed frontend lokal
   (tidak ada endpoint backend); ICD-10 & Obat sudah dari backend.
3. **Pekerja (worker portal)** belum memiliki role backend sendiri; role `MANAGEMENT` dipakai
   untuk manajemen, sedangkan akun pekerja publik memakai consent token (bukan JWT).
4. **`admin-klinik`** (frontend) tidak memiliki padanan kode role backend — disembunyikan dari
   select pembuatan user (`backendRoleCode` mengembalikan `null`).
5. **Verifikasi browser penuh** (otomasi klik-UI seperti Tahap 2) tidak diulang karena tidak ada
   driver browser (Playwright/Puppeteer) di environment; penggantinya: 19 test integrasi live
   frontend→backend (memanggil service layer yang dipakai halaman) + 90 cek API E2E.
6. **Dispensing parsial & return obat** tersedia di backend (`POST /pharmacy/returns`) tetapi
   belum ada UI frontend (frontend hanya memanggil recommend+dispense).
7. **D&A & Lab UI frontend** belum memiliki halaman operasional penuh; endpoint backend sudah
   berotorisasi dan diuji lewat contract.
8. **Offline sync frontend** hanya mendorong catatan darurat (`EMERGENCY_NOTE`) ke antrean
   backend; penerapan payload ke entitas domain (vital sign, dsb.) belum diimplementasikan
   backend (policy append-only per PRD Bab 13).
9. Laporan reports run & download terotorisasi tetapi eksekusi generate file ekspor masih
   stub backend (`getExportDownload`).
10. **Password akun dev disamakan** — lihat Backend follow-up #8.

## Final decision
- Tahap 3: **PARTIAL**

**Alasan berbasis bukti:** Seluruh workflow prioritas yang dikerjakan Tahap 3 telah terbukti
berjalan dari frontend → backend → database → response: **90/90 cek E2E live** (`e2e-tahap3-report.txt`),
**71/71 test otorisasi server-side** (matriks 401/403/2xx lintas 11 role + idempotency + rantai audit),
**261/261 test frontend** (termasuk 19 integrasi live), build frontend & backend lulus, dan
rantai audit SHA-256 `isValid: true` setelah seluruh operasi. Status bukan **COMPLETE** karena:
(a) modul Waiver dan pembuatan Master Data masih tanpa endpoint backend (kini dilabeli jelas
sebagai demo/BLOCKED, bukan fake success), (b) scoping baris per-site belum diterapkan, dan
(c) adapter email/PSrE eksternal masih mock berlabel. Ketiganya tercatat sebagai backend
follow-up dengan kontrak yang sudah terdokumentasi.
