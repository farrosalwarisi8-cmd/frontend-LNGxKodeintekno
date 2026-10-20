# Laporan Fase 1 — Frontend-Only Staging Setup

## Status
- **BLOCKED** — backend staging, frontend staging URL, dan akun/credential test staging tidak tersedia di environment kerja ini. Yang terverifikasi adalah audit statis + quality gate frontend lokal + production build dengan URL staging placeholder. Tidak ada bukti koneksi nyata ke backend staging HTTPS.

## Scope
- Frontend changed: **YES** (perbaikan dependency npm; lihat "Frontend defects fixed")
- Backend changed: **NO**
- Database changed: **NO**
- Migration changed: **NO**
- Provider changed: **NO**
- Production data changed: **NO**

## Environment
- Frontend URL: **BLOCKED** — tidak tersedia / tidak diberikan
- Backend URL: **BLOCKED** — tidak tersedia / tidak diberikan
- Build mode: production (`npm run build`) dengan `NEXT_PUBLIC_API_URL=https://api-staging.example.invalid/api/v1`, `NEXT_PUBLIC_ENABLE_DEMO=false`, dan `NEXT_PUBLIC_DEMO_PASSWORD` kosong untuk verifikasi bundle. `.env.local` nyata tidak dibuat dan tidak di-commit.
- Frontend commit: `b9dfc0c` (working tree berubah pada `package.json` dan `package-lock.json`; perubahan sebelumnya dari Tahap 1–4 juga ada di working tree seperti yang tercatat pada laporan readiness).
- Browser/version: **Tidak dijalankan** pada staging (Playwright + Google Chrome tersedia di repo sebelumnya, tetapi skenario staging tidak dijalankan karena URL/credential tidak ada).
- Viewports: pending verifikasi staging (`360×800`, `390×844`, `768×1024`, `1280×800`).
- Mock/demo mode: `NEXT_PUBLIC_ENABLE_DEMO` default nonaktif pada production; `isDemoModeEnabled(..., "production")` mengembalikan `false`. Tidak ada password demo di source (`frontend-config-audit` lulus).

## Baseline vs final
| Check | Baseline | Final |
|---|---|---|
| Typecheck (`npx tsc --noEmit`) | PASS (0 error) — laporan readiness sebelumnya | **PASS** (0 error), Node v24.14.0 / npm 11.9.0 |
| Lint (`npx eslint app lib src components --quiet`) | PASS (0 error) pada repo sebelumnya | **PASS** (0 error) |
| Unit test (`npx vitest run`) | 261 passed / 19 skipped | **PASS 344 passed / 19 skipped** (25 file lulus, 1 skipped) |
| Production build (`npm run build`) | PASS (33 route) | **PASS** (build sukses; route utama ter-build; tidak ada request ke localhost dari konfigurasi invalid, dan bundle menanamkan URL yang dikonfigurasi) |
| Browser smoke (staging) | 69/69 lulus, tetapi hanya terhadap backend lokal (`http://localhost:3000`) | **BLOCKED** — tidak dijalankan ke backend staging karena URL/credential tidak tersedia |
| Secret scan source/bundle | PASS (tanpa rahasia nyata) | **PASS** (tidak ada `KlinikLNG2026`/demo password nyata di source; scan runtime chunk tidak menunjukkan URL localhost/credential demo; hit yang muncul berasal dari chunk framework Turbopack/Next.js, bukan endpoint API) |

Catatan: jumlah unit test bertambah dari 261 menjadi 344 pada repo saat ini. Semua test yang sebelumnya ada tetap lulus.

## Connectivity matrix
| Check | Result | Evidence |
|---|---|---|
| Frontend URL | BLOCKED | Tidak ada staging frontend URL yang disediakan |
| Backend staging URL | BLOCKED | Tidak ada HTTPS staging URL yang disediakan |
| HTTPS | BLOCKED | Belum dapat diverifikasi tanpa endpoint staging |
| API base URL | PASS (konfigurasi) | `src/lib/env.ts` membaca `NEXT_PUBLIC_API_URL` dan menolak request jika kosong/invalid; `npm run build` dengan URL placeholder berhasil; bundle menyertakan `https://api-staging.example.invalid/api/v1` alih-alih fallback localhost |
| No localhost request | PASS (static audit) | `frontend-config-audit` dan build terverifikasi tidak memanggil `localhost` pada alur runtime; `npm i`/build/typecheck lulus. Tidak ada pengukuran browser network live karena staging diblokir |
| CORS/credentials | BLOCKED | Tidak dapat diverifikasi tanpa browser + domain staging; frontend menggunakan token Bearer di `localStorage` (`TOKEN_KEY`/`REFRESH_TOKEN_KEY`) dan tidak mengirim `credentials: include` |
| Login | BLOCKED | Tidak ada URL staging / akun test yang disediakan |
| Session restore | BLOCKED | Tidak diverifikasi terhadap staging |
| Logout | PARTIAL (implementasi siap) | Implementasi `clearToken()` + redirect `/login` ada dan diuji pada backend lokal sebelumnya; cleanup state saat logout juga teruji unit/browser lokal. Belum dibuktikan end-to-end pada staging |
| Deep link | PARTIAL (implementasi siap) | `RouteGuard` tidak redirect sebelum `_hasHydrated`, sehingga refresh/direct URL tetap landasannya menunggu hidrasi; lulus unit/browser lokal. Belum dibuktikan end-to-end pada staging |

## Role smoke matrix
| Role | Login | Allowed route | Denied route | Mobile | Result |
|---|---|---|---|---|---|
| Semua 10 role seed dari laporan readiness | BLOCKED | BLOCKED | BLOCKED | BLOCKED | Tidak ada URL/credential staging, sehingga Phase 1 staging role smoke tidak dikerjakan |
| Admin/System Administrator | — | — | — | — | Evidence lokal sebelumnya (PASS, 10 role) tidak digunakan sebagai PASS staging |
| Admin Klinik | — | — | — | — | Belum diverifikasi di staging |
| HR/PIC | — | — | — | — | Belum diverifikasi di staging |
| Dokter OH | — | — | — | — | Belum diverifikasi di staging |
| Dokter Klinik | — | — | — | — | Belum diverifikasi di staging |
| Perawat | — | — | — | — | Belum diverifikasi di staging |
| Apoteker | — | — | — | — | Belum diverifikasi di staging |
| Lab/Radiologi | — | — | — | — | Belum diverifikasi di staging |
| HSE | — | — | — | — | Belum diverifikasi di staging |
| Manajemen | — | — | — | — | Belum diverifikasi di staging |

## Browser evidence
- Total skenario Phase 1 staging: 0.
- Passed: 0.
- Failed: 0.
- Blocked: seluruh skenario open URL, login valid/invalid, dashboard, authenticated API request, refresh/session restore, deep link, logout, back button, allowed/denied route per role, mobile, offline/backend error state.
- Page errors: tidak diukur pada staging (tidak ada run).
- Unexpected console errors: tidak diukur pada staging (tidak ada run).
- Screenshots/traces/JSON report: tidak ada artifak Phase 1 staging. Evidence browser terakhir yang ada adalah TA-1 readiness lokal (`test-artifacts/frontend-readiness/` dari laporan sebelumnya), tetapi itu bukan environment staging.
- Evidence build available di `C:\Users\ASUS ROG STRIX\AppData\Local\Temp\opencode\build-staging.log` (lokal, tidak commit).

## Mock/demo audit
- `process.env.NEXT_PUBLIC_*` hanya dibaca di `src/lib/env.ts` (`frontend-config-audit` lulus).
- Tidak ada literal URL `https?://(localhost|127.0.0.1|0.0.0.0)` pada source runtime (`frontend-config-audit` lulus).
- Tidak ada kredensial demo di source (`frontend-config-audit` lulus; pengecualian `SEED_PASSWORD` hanya default pada script E2E lokal lama, bukan source aplikasi production di `app/components/lib/src`).
- `isDemoModeEnabled` default `true` hanya saat `NODE_ENV=development`, dan `false` pada staging/production/test (`env.test.ts` lulus).
- `.env.example` mendokumentasikan `NEXT_PUBLIC_ENABLE_DEMO` dan memakai `JANGAN menaruh secret` serta tidak berisi `NEXT_PUBLIC_DEMO_PASSWORD=` terisi.
- `package.json` tidak berisi URL lokal, password, atau credential.
- Runtime chunk production dengan URL staging placeholder tidak memuat `localhost` endpoint; scanning `.next` (non-cache) puncak `localhost`/`KlinikLNG2026` hanya ditemukan pada utilitas framework Next.js/Turbopack, bukan pada konfigurasi frontend.

## Frontend defects fixed
1. **npm install** sebelumnya gagal (`ERESOLVE`) karena konflik peer dependency `vitest@5.0.3` vs `@types/node@^20` pada Node v24.
   - Perubahan: `package.json`: `@types/node` `^20` → `^24`.
   - Perubahan: `package-lock.json` diperbarui dari hasil install nyata.
   - Validasi: `npm i` lulus, `npm run typecheck` lulus, `npm run build` lulus, `npm test` lulus.
2. **Dependensi/quality gate tetap hijau setelah install** (344 unit test lulus).
3. **(Sudah ada pada repo sebelum Phase 1)** Router guard (`app/(app)/...`), `api-client` 401 handling untuk `/auth/*`, dan static config audit tetap disediakan untuk staging via environment variable.

## Backend/infrastructure blockers
- `BACKEND/INFRASTRUCTURE BLOCKER — di luar scope frontend-only`: URL frontend staging tidak tersedia, sehingga tidak dapat memverifikasi build yang berjalan pada hosting URL aktual.
- `BACKEND/INFRASTRUCTURE BLOCKER — di luar scope frontend-only`: URL backend staging HTTPS, API base path staging, dan CORS/cookie policy backend tidak disediakan; tidak boleh mengubah backend/CORS/cookie untuk menyiasatinya.
- `BACKEND/INFRASTRUCTURE BLOCKER — di luar scope frontend-only`: Akun test staging, metode login/MFA, OTP, dan credential tidak disediakan; tidak boleh menebak atau menyimpan credential.
- `BACKEND/INFRASTRUCTURE BLOCKER — di luar scope frontend-only`: Provider email/WhatsApp/PSrE, S3/MinIO/bucket, dan queue status produksi tidak tersedia (lihat laporan readiness sebelumnya).
- `BACKEND/INFRASTRUCTURE BLOCKER — di luar scope frontend-only`: Tanpa staging, tidak dapat membuktikan mixed content, cookie, CORS, credentials, domain, refresh/session restore, deep link, route smoke, mobile, dan backend error state pada domain staging.

## Known limitations
- Tidak ada `NODE_ENV=production` staging URL aktual yang dibuktikan pada domain staging.
- `resolveEnvironment()` saat ini mengklasifikasikan `https:` non-lokal sebagai `production`, sedangkan `http:` non-lokal sebagai `staging`. Untuk backend staging yang memang HTTPS (seperti ketentuan Phase 1), label environment akan menjadi “Production” sampai penambahan konfigurasi eksplisit (misalnya `NEXT_PUBLIC_APP_ENV`) diimplementasikan; ini belum ditambahkan agar tidak memutus contract unit test yang ada.
- E2E staging (`npm run test:e2e:staging`) belum dijalankan karena backend staging tidak tersedia. Script tersebut menurut status package adalah `node e2e/fase2-identity-mcu-staging.mjs`, bukan runner Fase 1 khusus.
- Verifikasi error state (401 sesi berakhir, 429/500/503, timeout/offline) dari Phase 1 staging tidak dapat dibuktikan; item tidak lulus otomatis dan ditandai `NOT VERIFIED`/`BLOCKED`, bukan `PASS`. Baseline lokal sebelumnya hanya menunjukkan pemetaan error secara unit/UI lokal.
- Tidak ada artifak browser Phase 1 staging (screenshot/trace/JSON), jadi tidak ada bukti visual.

## Next phase readiness
- **NOT READY** — Fase 2 bisnis membutuhkan staging frontend/backend yang dapat dijangkau, akun/credential test, dan CORS/cookie/HTTPS sesuai ketentuan. Saat ini hanya fondasi konfigurasi frontend dan quality gate lokal yang lulus.

## Final decision
- **BLOCKED**
- Alasan berbasis bukti: quality gate frontend internal lulus (TypeScript 0 error, ESLint 0 error, 344/344 unit test, production build lulus) dan tidak ada secret/mock aktif pada audit statis, tetapi fase ini tidak dapat membuktikan satu pun alur wajib staging (`Frontend staging URL → Backend staging HTTPS → login/session/cookie/API request/response/refresh`) karena URL frontend/backend staging, akun test, dan jalur HTTPS staging tidak tersedia. Karena itu, menurut definition of done Phase 1, status tidak boleh `PASS` dan bukan pula `PARTIAL` (koneksi utama tidak dibuktikan), tetapi `BLOCKED` dengan daftar dependency eksternal yang dicatat di atas.
