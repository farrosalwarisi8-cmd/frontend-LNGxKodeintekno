# Fase 6 — Verifikasi Wiring Frontend → Backend (laporan)

Tanggal: 15 Okt 2026 · Lingkup: **frontend saja** (backend hanya dibaca/diperiksa, tidak diubah).

## 1. Cara pemeriksaan

| Lapis | Alat | Hasil |
| --- | --- | --- |
| Kontrak service → backend | `npx vitest run src/lib/services/__tests__/live-backend.integration.test.ts` (backend hidup di `localhost:3000`) | **21/21 PASS** |
| UI nyata → backend | `node scripts/probe-frontend-backend-wiring.mjs` (Chrome, dev server `localhost:3001`) | **56 PASS / 0 FAIL / 2 BLOCKED / 8 GAP backend** |
| Inventaris route backend | `GET http://localhost:3000/docs-json` (OpenAPI) — 86 route terdaftar | dipakai untuk membandingkan path service |
| Regression frontend | `npx tsc --noEmit`, `npx eslint … --quiet`, `npx vitest run` | typecheck 0 error · lint 0 error · **398/398 unit test PASS** |

Artefak bukti: `test-artifacts/frontend-backend-wiring/report.json` + 21 screenshot per halaman.

Setiap halaman diuji sebagai **sesi backend nyata** (login UI → bearer token `kodein_token`)
dan isinya di-cross-check ke API yang sama, bukan sekadar "tidak error".

## 2. Halaman yang terbukti membaca backend

| Halaman | Role uji | Bukti |
| --- | --- | --- |
| `/health-status` | hr, hse | `GET /mcu/cycles` 200; jumlah di DOM **70 = 70** FTW backend |
| `/dashboard` | hse, perawat | `GET /mcu/cycles` (+ patients/queues/inventory) 200 |
| `/reports` | hr, hse | `GET /mcu/cycles` 200, 0 ErrorState |
| `/employees` | hr | `GET /patients` 200 |
| `/visits/queue` | hse, perawat | `GET /clinic/queues` 200 |
| `/medicine` | apoteker | `GET /pharmacy/inventory` 200 |
| `/medicine/dispense` | apoteker | `GET /pharmacy/prescriptions/pending` 200 |
| `/my/profile` | hr | `GET /patients` 200 |
| `/my/mcu` | hr | `GET /mcu/cycles` 200 |
| `/my/certificates` | hr | `GET /documents` 200 (+ `GET /mcu/cycles`) |
| `/my/notifications` | hr | `GET /notifications` 200 |
| `/da` | lab.analis | `GET /da/tests` 200 (lihat §3) |
| `/verify/[token]` | publik | token tak dikenal → empty state, tidak crash |
| `/documents`, `/signatures`, `/certificates` | — | kontrak data `GET /documents` 200 (100 dok) & `GET /documents?documentType=FTW_CERTIFICATE` 200 (69 sertifikat); UI-nya khusus Dokter OH (§4) |

Guard antar-role juga diverifikasi: hr ditolak di `/documents`, `/signatures`,
`/certificates`, `/users` (AccessDenied **tanpa** request data terlindungi).

## 3. Perbaikan yang dikerjakan (frontend)

**D&A (`/da`) tidak selaras dengan backend.** Backend membatasi modul `da-test` ke
`@Roles("DOCTOR_OH", "LAB_ANALYST", "SYSTEM_ADMIN")`, sedangkan frontend memakai
permission `manage-hse` (hanya role `hse` + `admin`) → HSE bisa membuka halaman
yang **selalu 403** (`GET /da/tests` → "Access denied: required one of roles
[DOCTOR_OH, LAB_ANALYST, SYSTEM_ADMIN]"), sementara Dokter OH & Analis Lab —
role yang memang berwenang — tidak pernah melihat menunya.

Perubahan (satu sumber permission, guard = navigasi = action):

- `lib/rbac.ts` — permission baru `manage-da` (privileged) untuk role
  `admin` (SYSTEM_ADMIN), `dokter-oh` (DOCTOR_OH), `lab` (LAB_ANALYST) —
  tepat sama dengan daftar role backend.
- `lib/actions.ts` — `da.manage` → `manage-da`.
- `components/route-guard.tsx` — `/da` → `manage-da`.
- `src/lib/navigation.ts` — item menu "D&A" → `manage-da`.

Bukti sesudah perbaikan: Analis Lab membuka `/da` dan `GET /da/tests` **200**
(50 tes tampil); HSE kini ditolak (AccessDenied) dan menu D&A tidak lagi muncul.

## 4. Blocker yang dilaporkan (bukan dikerjakan — area backend)

Route yang **dipakai service frontend tetapi belum terdaftar di backend** (404);
halaman terkait sudah menampilkan `ErrorState` terkendali, bukan crash:

| Endpoint | Dampak UI | Catatan dari sisi backend |
| --- | --- | --- |
| `GET /waivers` (+ `:id`, decision, send, revoke, public) | `/waiver` = error state | `waiver.controller.ts` ada, tetapi **`WaiverController`/`WaiverService` tidak didaftarkan** di modul mana pun (`mcu.module.ts` hanya `[McuController]`) → seluruh alur waiver 404 |
| `GET /signatures`, `GET /signatures/:id`, `POST /signatures/:id/retry` | `/signatures` & tab tracking di `/documents` tidak bisa memuat | backend hanya punya `POST /signatures/request` & `POST /signatures/callback` |
| `GET /pharmacy/dispensing/history` | `/medicine/return` tidak bisa memuat riwayat (alur retur mulai dari baris riwayat) | pharmacy hanya punya inventory, pending prescriptions, dispensing, returns |
| `GET /diagnostic/lab-orders`, `/diagnostic/lab-results`, `/diagnostic/radiology-orders` | `/lab` tidak bisa memuat daftar order | backend hanya punya endpoint **POST** diagnostic |

**UI yang belum bisa diuji di environment ini:** `/documents`, `/signatures`,
`/certificates` hanya dimiliki role Dokter OH (`issue-certificate`; sesuai
`ACCESS_ARCHITECTURE.md`), dan akun `dr.hendra` — seperti `admin` — mengembalikan
`mfaSetupRequired: true` (TOTP) sehingga login UI ditolak. Kontrak datanya tetap
diverifikasi (§2), termasuk lewat `live-backend.integration.test.ts`.

Catatan operasional: dev server pernah menyajikan **404 untuk semua route
bersarang** (`/my/*`, `/visits/queue`, `/medicine/dispense`, `/mcu/new`, …) karena
state `next dev` basi. Restart dev server (proses lama dimatikan, bukan hanya
parent shell) menyelesaikannya — bukan masalah kode; 30/30 route kini 200.

## 5. Kesimpulan

- Wiring data yang diminta (status kesehatan/FTW, sertifikat, dokumen,
  halaman "Saya", dashboard, laporan, antrean, farmasi) **terbukti lewat browser
  nyata + API live**, 0 FAIL, 0 pageerror.
- 1 ketidakselarasan permission frontend↔backend ditemukan dan diperbaiki (D&A).
- 4 kelompok endpoint backend masih 404/ belum ada, plus 2 akun terkunci MFA —
  semuanya dilaporkan sebagai blocker, **tidak** dikerjakan di sisi backend.

### Reproduksi

```bash
# backend (jalankan sesuai prosedur backend, tidak diubah)
cd KODEINxLNG-Backend && node dist/src/main.js

# frontend
npm run dev -- --port 3001
node scripts/probe-frontend-backend-wiring.mjs      # 56 PASS / 0 FAIL
npx vitest run src/lib/services/__tests__/live-backend.integration.test.ts
```
