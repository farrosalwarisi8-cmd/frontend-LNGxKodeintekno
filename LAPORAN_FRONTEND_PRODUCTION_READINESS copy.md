# Laporan Frontend Production Readiness Verification

> Scope: **frontend saja**. Backend, database, migration, endpoint, provider,
> queue worker, bucket, dan deployment backend tidak diubah. Repo backend hanya
> dipakai sebagai backend lokal yang sudah ada.

## Status
- **PARTIAL** — *bukan* `PRODUCTION READY`.
- Alasan singkat: seluruh quality gate frontend (typecheck, lint, unit,
  production build) dan **browser E2E 69/69** lulus pada **production build
  frontend** melawan **backend lokal nyata**, tetapi **staging nyata, provider
  produksi (email/WhatsApp/PSrE), storage S3/MinIO, dan data/credential staging
  tidak tersedia**, sehingga tidak ada bukti untuk menyatakan production-ready
  (lihat §5 prompt: hanya ada backend lokal → development verification).

## Environment
- Frontend version/commit: repo `kodein-klinik-demo`, commit `8254284` (working tree, ada perubahan belum di-commit dari Tahap 1–4).
- Build mode: **production** (`npm run build` → `next build`, lalu `npx next start -p 3001`).
- Backend base URL: `http://localhost:3000/api/v1` (`NEXT_PUBLIC_API_URL`, `.env.local`).
- Environment: **local/development** (bukan staging). `NODE_ENV=development` backend.
- Browser: **Google Chrome** via **Playwright** (`channel: "chrome"`, headless). Playwright diambil dari `node_modules` repo backend (sibling) karena tidak terpasang di repo frontend.
- Database/provider note: PostgreSQL lokal; storage driver lokal (bukan S3); provider notifikasi/PSrE = **sandbox**. Tidak ada credential/data produksi.

## Scope
- Frontend changed: **YES**
- Backend changed: **NO** (hanya dijalankan, tidak diubah)
- Database changed: **NO**
- Provider changed: **NO**

## Baseline vs final
| Check | Baseline | Final |
|---|---|---|
| Typecheck (`npx tsc --noEmit`) | PASS (0 error, ~25s) | **PASS** (0 error) |
| Lint (`npx eslint app lib src components --quiet`) | **FAIL** — 5 error `react-hooks/set-state-in-effect` | **PASS** (0 error) |
| Unit test (`npx vitest run`) | 242 passed / 19 skipped (18 file; live integrasi di-skip karena backend tak terdeteksi) | **PASS 261/261** (19 file) |
| Production build (`npm run build`) | PASS (~39s, 33 route) | **PASS** (33 route) |
| Browser E2E (`node e2e/frontend-production-readiness.mjs`) | Tidak ada penggerak browser (Tahap 4: "tidak ada driver browser") | **PASS 69/69** |
| Secret scan source/bundle | — | PASS (0 secret nyata; lihat Known limitations) |

Perubahan kode frontend yang dilakukan (perbaikan, bukan suppression):
1. **Lint (5 error) diperbaiki** — `app/(app)/lab/page.tsx`,
   `app/(app)/master-data/page.tsx`, `app/(app)/medicine/return/page.tsx`,
   `app/(app)/waiver/page.tsx`, `components/scope-selector.tsx`: setState awal
   di dalam `useEffect` didefer (`setTimeout(…, 0)`) mengikuti konvensi yang
   sudah dipakai repo di `lib/remote-sync.ts` (`useSyncedModules`). Tidak ada
   `eslint-disable`/suppression baru.
2. **`src/lib/api-client.ts` diperbaiki** — 401 dari endpoint `/auth/*`
   (login/MFA) tidak lagi memicu `window.location.href = "/login"`. Sebelumnya
   login gagal men-reload halaman dan **menghapus pesan error inline** + mereset
   penghitung percobaan. Kini error backend mengalir normal ke form. Terverifikasi
   di browser (lihat G1).

## Production readiness matrix
| Area | Status | Evidence | Blocker |
|---|---|---|---|
| Staging connection | **FAIL** | Hanya backend lokal `http://localhost:3000`; tidak ada staging/HTTPS. Production build frontend diuji. | Tidak ada environment staging |
| Auth/session | PASS | B1–B10 (10 role login), D1 restore setelah refresh, D2 token di localStorage, D3–D5 logout membersihkan state + back button | — |
| Role/permission | PASS | C1–C7 (AccessDenied per role), H (smoke 25 route), B-guard | — |
| Employee/consent | PASS (API/unit) | `module-endpoints`, `live-backend.integration.test` (261 unit); UI `/employees`, `/people`, `/people/new` render | Browser E2E belum men-submit form create |
| MCU/FTW | PARTIAL | UI `/mcu`, `/mcu/new` dirender; `/mcu/review` sengaja ditolak untuk admin (permission klinis dokter-oh) | Balapan form/approve via browser belum |
| Clinic/SOAP | PARTIAL | UI `/visits`, `/visits/queue`, `/visits/new`, `/medical-records` dirender | Submit SOAP/lock via browser belum |
| Pharmacy/return | PARTIAL | UI `/medicine`, `/medicine/dispense`, `/medicine/return` dirender | Dispense/return via browser belum |
| Waiver | PARTIAL | UI `/waiver` dirender; API+token lifecycle 115 e2e backend (Tahap 5) | Aksi UI waiver via browser belum |
| Master Data | PARTIAL | UI `/master-data` dirender; API CRUD/409 diuji backend | Create/deactivate via browser belum |
| Site scoping | PASS (API) | Backend e2e 115 (Tahap 5) + unit | Scope selector UI belum diuji lintas site |
| Notifications | PARTIAL | Header bell render; service+unit ada | Panel mark-read via browser belum |
| Offline/sync | PASS (dasar) | G2 indikator "Offline" tampil saat browser offline; `lib/online.ts` unit test | Sync/reconnect end-to-end belum |
| Storage/upload/download | **BLOCKED** | Storage driver lokal, tanpa bucket | Tidak ada bucket/S3 staging |
| Queue status | **BLOCKED** | UI tidak menampilkan status job; adapter sandbox | Provider/queue produksi tidak ada |
| Email/WhatsApp status | **BLOCKED** | — | Provider sandbox, tanpa credential staging |
| TTE/PSrE/QR | **BLOCKED** | `/verify/[token]` publik render (200); PSrE provider sandbox | Provider PSrE staging tidak ada |
| Report export | PARTIAL | UI `/reports` render; backend file generation (Tahap 5) | Download via browser belum diuji |
| Mobile/responsive | PASS | E-390/360/768: 0px horizontal overflow; bottom navigation tampil; screenshot | — |
| Accessibility | PARTIAL | Struktur: `aria-label`, `role="status"`, label input, focus ring ada di kode | Belum ada audit otomatis (axe) |
| Security/privacy | PASS (dasar) | 0 source map di `.next/static`; 0 secret nyata di bundle; guard sebelum render; AccessDenied permanen | Lihat Known limitations |
| Performance | PARTIAL | Production build 33 route; `.next/static` ≈ 1.5 MB; route static pit ahead-of-time | LCP/INP/CLS/TTFB tidak diukur (butuh keputusan stakeholder) |

## Role verification
Diuji via browser (login + dashboard + route yang ditolak), viewport desktop 1280×800.

| Role (akun seed) | Login | Allowed | Denied | Mobile | Result |
|---|---|---|---|---|---|
| System Administrator (`admin`) | ✓ | /dashboard, /users, /master-data, /audit-logs, /waiver, … | /mcu/review, /certificates (klinis) | ✓ | PASS |
| Dokter OH (`dr.hendra`) | ✓ | /dashboard | — | — | PASS |
| Dokter Klinik (`dr.klinik`) | ✓ | /dashboard | /master-data | — | PASS |
| Perawat (`perawat`) | ✓ | /dashboard | /users | — | PASS |
| Apoteker (`apoteker`) | ✓ | /dashboard | /employees | — | PASS |
| Lab (`lab.analis`) | ✓ | /dashboard | /medicine/dispense | — | PASS |
| HR/PIC (`hr.pic`) | ✓ | /dashboard | /audit-logs | — | PASS |
| HSE Officer (`hse.officer`) | ✓ | /dashboard | /users | — | PASS |
| HSE Manager (`hse.manager`) | ✓ | /dashboard | — | — | PASS |
| Manajemen (`manajemen`) | ✓ | /dashboard | /employees | — | PASS |
| Pekerja/public (token) | n/a (tanpa JWT) | `/verify/[token]` publik 200 tanpa sesi | — | — | PASS (akses publik) |

## Browser evidence
- Browser/version: Google Chrome (channel `chrome`) via Playwright Core (dari backend `^1.64`), headless.
- Viewports: **1280×800, 1440×900, 390×844, 360×800, 768×1024**.
- Total scenarios: **69**. Passed: **69**. Failed: **0**.
- Unexpected console errors: **0 page errors (`pageerror`)**, 0 unhandled promise. 25 console "Failed to load resource" — semuanya dari skenario negatif yang disengaja: 403 (route ditolak), 401 (login salah), 404 (`/verify/sample-token` token dummy), dan `net::ERR_INTERNET_DISCONNECTED` saat skenario offline.
- Network errors: 16 `requestfailed`, semuanya dari skenario offline/aborted yang disengaja.
- Screenshots/traces: `test-artifacts/frontend-readiness/` → `dashboard-1440x900.png`, `dashboard-390x844.png`, `dashboard-360x800.png`, `dashboard-768x1024.png`, `login.png`, `access-denied.png`, dan `browser-e2e-report.json`.
- Cakupan: A (guard tanpa sesi + route publik), B (login 10 role + sidebar + tidak ada AccessDenied), C (AccessDenied per role), D (session restore, logout, back button), E (mobile/tablet), F (screenshot), G (login gagal inline, indikator offline), H (smoke 25 route sebagai admin).

## Error-state verification
| Status/scenario | Result | Evidence |
|---|---|---|
| 401 (login salah) | PASS | G1 — pesan inline "Invalid username or password Sisa percobaan: 4", **tanpa reload** (setelah perbaikan api-client) |
| 401 (sesi berakhir) | PASS (kode+unit) | `api-client` clear token + redirect `/login` untuk request terautentikasi; unit `api-client.test.ts` |
| 403 | PASS | C1–C7 → AccessDenied ("Akses terbatas"); 3× console 403 (backend menolak) |
| 404 | PASS | A3 `/verify/sample-token` (token dummy) 200 render; API 404 → pesan error service |
| 409 | PASS (unit/live) | `live-backend.integration.test` (duplicate 409) + `module-endpoints` |
| 422 | PASS (unit) | `api-client` memetakan `fieldErrors` → `ApiError.fieldErrors` |
| 429 | PARTIAL | Dikonfigurasi di backend (throttle); belum diuji khusus dari browser |
| 500/503 | PARTIAL | Backend e2e Tahap 3 mencatat 500 pada kasus tertentu; mapping error UI via `error-state`/`ErrorState` |
| Timeout/offline | PASS | G2 indikator "Offline" tampil; `api-client` melempar pesan "Tidak dapat terhubung ke server backend…" saat fetch gagal |

## Regression Tahap 1–4
- Login/MFA/logout/session restore/route guard: **lulus** (unit `auth-store`, `route-guard`, `store`; browser A/B/D).
- Permission registry/sidebar/mobile navigation: **lulus** (unit `rbac`, `actions`, `navigation`, `demo-role`; browser B/C/H).
- Notifications/offline indicator: **lulus** (unit `notification-utils`, `online`; browser G2).
- Employee/Consent/MCU/Clinic/Pharmacy/Waiver/Master Data/Documents/Reports: **lulus pada level unit + live integrasi backend** (261 unit termasuk `live-backend.integration.test`, `module-endpoints`) dan render route di browser; aksi form lengkap belum diuji via browser.

## Backend/infrastructure blockers
1. **Tidak ada environment staging nyata** (URL/HTTPS/domain). CORS backend hanya mengizinkan `FRONTEND_URL=http://localhost:3001`; verifikasi cookie/credentials pada domain staging belum bisa dilakukan.
2. **Provider produksi (email/WhatsApp/PSrE) masih sandbox** → status queue/provider/TTE tidak dapat diverifikasi end-to-end dari UI.
3. **Storage S3/MinIO tidak dikonfigurasi** → upload/download/signed URL/report file tidak dapat diverifikasi.
4. **Tidak ada credential/data produksi** → alur dengan data nyata tidak diuji (sesuai batasan).

## Known limitations
1. **Cakupan browser E2E**: fokus pada auth/guard/permission/session/mobile/error-state + smoke route. Aksi mutasi domain (create employee, FTW, SOAP/finalize, dispense/return, waiver decision, master-data CRUD, report download) belum dijalankan penuh melalui browser; bukti yang ada untuk alur itu berasal dari unit + live integrasi API + backend e2e.
2. **Inkonsistensi dokumentasi**: `ROLE_MAPPING.md` menandai `admin` memiliki `review-mcu` ✓ dan `issue-certificate` ✓, tetapi kode (`lib/rbac.ts`) dan test (`src/lib/__tests__/rbac.test.ts`) **sengaja** menolak keduanya untuk admin ("clinical-only"). Perilaku kode adalah fail-safe dan dijaga test; **yang salah adalah matriks di ROLE_MAPPING.md** dan sebaiknya diperbarui. Tidak diubah dari scope ini.
3. **Password akun demo tertanam di bundle** (`lib/seed.ts`, `app/login/login-page-content.tsx` menampilkan `KlinikLNG2026!`). Ini kredensial demo/staging yang memang bersifat fiktif, namun **harus dihapus/dikunci sebelum produksi**. 0 secret sensitif nyata (API key/token/kunci privat) ditemukan di source maupun bundle.
4. **Konvensi `middleware.ts` deprecated di Next 16** (disarankan `proxy`); hanya peringatan build, bukan kegagalan.
5. **Performance belum diukur** (LCP/INP/CLS/TTFB); target angka butuh keputusan stakeholder.
6. **Accessibility** baru diperiksa secara struktural; belum ada audit otomatis (axe/Lighthouse).

## Files changed
- **Diubah (perbaikan):**
  - `app/(app)/lab/page.tsx`, `app/(app)/master-data/page.tsx`,
    `app/(app)/medicine/return/page.tsx`, `app/(app)/waiver/page.tsx`
    (defer setState dalam effect → lint hijau),
  - `components/scope-selector.tsx` (idem),
  - `src/lib/api-client.ts` (401 `/auth/*` tidak redirect; error login tampil inline).
- **Baru:**
  - `e2e/frontend-production-readiness.mjs` (browser E2E Playwright),
  - `test-artifacts/frontend-readiness/` (`browser-e2e-report.json` + 6 screenshot),
  - `LAPORAN_FRONTEND_PRODUCTION_READINESS.md` (laporan ini).

## Dokumentasi menjalankan verifikasi
```bash
# 0. Prasyarat: backend lokal hidup di :3000 (sudah ada), Postgres aktif.
cd kodein-klinik-demo

# 1. Quality gate frontend
npx tsc --noEmit
npx eslint app lib src components --quiet
npx vitest run            # 261 lulus bila backend :3000 hidup (integrasi live)

# 2. Production build + serve
npm run build
npx next start -p 3001

# 3. Browser E2E (Playwright diambil dari node_modules repo backend)
E2E_BASE_URL=http://localhost:3001 node e2e/frontend-production-readiness.mjs
# → report: test-artifacts/frontend-readiness/browser-e2e-report.json
```

## Final decision
- **PARTIAL** (belum `PRODUCTION READY`, belum juga `STAGING READY`).
- **Alasan berbasis bukti:**
  - Yang **terbukti lulus pada production build frontend melawan backend lokal nyata**: typecheck, lint (0 error setelah perbaikan), unit **261/261**, production build, dan **browser E2E 69/69** (auth/session, 10 role, permission/AccessDenied, mobile 360/390/768, error-state, smoke 25 route), tanpa `pageerror` dan tanpa console error tak terduga.
  - Yang **belum dapat dibuktikan**: koneksi ke **staging nyata** (HTTPS/cookie/CORS/credentials), **provider produksi** (email/WhatsApp/PSrE), **storage S3/signed URL/upload/download**, status **queue/provider/TTE**, serta aksi mutasi domain penuh melalui browser. Semua ini tertahan pada ketiadaan staging/provider/bucket/credential.
  - Karena syarat §23 (staging nyata + provider + storage + workflow kritis penuh) tidak terpenuhi, status maksimal yang jujur adalah **PARTIAL**.
