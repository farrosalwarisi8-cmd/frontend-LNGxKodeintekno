# LAPORAN FRONTEND-ONLY — FASE 9 (TTE hardening + quality gate)

**Repo:** `frontend-LNGxKodeintekno` (`farrosalwarisi8-cmd/frontend-LNGxKodeintekno`)
**Branch:** `main`
**Baseline commit:** `173834e6dddf8a3a44336995838a7b867767e8af` — `fix(a11y): stepper wizard dapat dibaca & fokus mengikuti langkah/route`
**Final code commit:** `__FINAL_CODE_COMMIT__`
**Tanggal:** 24 November 2026
**Lingkup:** 100% frontend — tidak ada file backend, Prisma, migration, provider PSP,
HMAC callback, queue, storage, Docker, atau infrastruktur yang dibuka/diubah.

---

## 1. Ringkasan eksekutif

| Area | Status |
|------|--------|
| TTE contract (frontend) | **PASS (untuk endpoint yang sudah terbukti)** |
| TTE UX (request/status/polling/retry/download) | **PASS** |
| Signed PDF download | **PARTIAL** — hanya jalur JSON URL; respons biner belum terbukti |
| QR / public verification | **PASS** |
| RBAC & role-aware UI | **PASS** |
| Upload / wizard / accessibility | **PASS** |
| Responsive 360×800 / 390×844 / 768 / 1280 / 1440 | **PASS** (chrome headless, tanpa overflow) |
| Performance (LCP/INP/CLS/TTFB) | **NOT RUN** |
| Security (secret PSP di bundle) | **PASS** |
| Staging E2E / provider live | **BLOCKED** (backend + provider sandbox belum tersedia) |

Kesimpulan: frontend **COMPLETE untuk kontrak yang terbukti**, tetapi **bukan
staging-ready** karena verifikasi backend/provider nyata belum dilakukan.

---

## 2. Perubahan pada fase ini

### 2.1 Dependency (P0)

- `next` dan `eslint-config-next`: `16.4.4` → **`16.4.6`** (impact review:
  tidak ada API/aplikasi yang terdampak; build, typecheck, lint, dan seluruh test
  dijalankan ulang setelah upgrade).
- `npm audit fix` (tanpa `--force`) menurunkan temuan dev-only dari 10 → **4 moderate**.
  Sisa temuan berasal dari CLI `shadcn` (`ts-morph` → `minimatch`); "fix" yang
  ditawarkan adalah perubahan major (downgrade ke `shadcn@1.0.0`) sehingga
  **tidak diterapkan** dan didokumentasikan sebagai risiko dev-tool, bukan runtime.
- `npm audit --omit=dev` → **0 vulnerabilities**.

### 2.2 TTE hardening (P0/P1)

| File | Perubahan |
|------|-----------|
| `src/lib/services/document.service.ts` | Token verifikasi di-`encodeURIComponent`, token kosong ditolak; status signature kosong **tidak** diisi default `PENDING`; retry menolak `signatureType` tak dikenal (tidak mengarang `CERTIFIED_PSRE`). |
| `src/features/tte/verify-state.ts` | `VALID`/`SIGNED` hanya valid bila `isValid === true`; status tak dikenal aman. |
| `src/features/tte/mask.ts` (baru) | Masking ID request untuk dialog retry. |
| `src/features/tte/components/retry-signature-dialog.tsx` | ID lama/baru ditampilkan termasking + penjelasan. |
| `src/features/tte/components/signed-pdf-button.tsx` | Navigasi via anchor (tahan popup blocker), tautan fallback manual, `role=status`, error aman, tanpa log token. |
| `app/(app)/certificates/page.tsx` | Konfirmasi eksplisit sebelum render + request TTE, anti double-submit, pesan error aman, token QR hanya di memori. |
| `app/(app)/documents/page.tsx` | Status kosong → "tidak dikenali" (bukan `PENDING`). |
| `app/(app)/signatures/page.tsx` | Filter status tidak direset polling; hitungan memakai mapper status. |
| `app/(app)/my/certificates/page.tsx` | Tautan verifikasi dari `token_hash` dihapus. |
| `lib/store.ts`, `lib/types.ts`, `lib/seed.ts`, `lib/remote-sync.ts` | `qrToken` tidak dibuat/dipersist; migrasi store v2 membuang `qrToken` lama dari localStorage. |

### 2.3 Perbaikan alur retur farmasi (ditemukan saat quality gate)

`npm run test:e2e:playwright` gagal 2 skenario **yang sudah gagal pada baseline**
(riwayat retur dikonstruksi dari sesi, sedangkan spec lama menyuntik data ke
endpoint yang tidak dipakai UI). Perbaikan frontend-only:

- `src/lib/services/pharmacy.service.ts`: `DispensingGuard` menyimpan snapshot
  dispensing sukses (ID dispensing backend, pasien, item, batch) dan retur yang
  berhasil; `getDispensingHistory()` memakai snapshot tersebut.
- `app/(app)/medicine/dispense/page.tsx`: mengirim snapshot lengkap saat commit.
- `e2e/playwright/return.spec.ts`: spec menjalankan dispensing nyata lewat UI,
  lalu navigasi client-side ke halaman retur (sesuai alur pengguna).
- `returnMedication` kini `Promise<void>` (nilai respons tidak pernah dipakai).

---

## 3. Contract TTE yang diverifikasi

Detail lengkap ada di **`CONTRACT_DELTA_TTE_FRONTEND.md`**. Ringkas:

| Method | Path | Dipakai | Status |
|--------|------|---------|--------|
| `POST` | `/documents/render-pdf` | `/documents`, `/certificates` | Terbukti (snapshot Fase 6 + wiring) |
| `POST` | `/signatures/request` | `/documents`, `/signatures`, `/certificates` | Terbukti |
| `GET` | `/documents` | status polling | Terbukti |
| `GET` | `/documents/:id/download` | `SignedPdfButton` | **Partial** — hanya JSON URL |
| `GET` | `/public/verify/:qrToken` | `/verify/[token]` | Terbukti |
| `POST` | `/signatures/callback` | **tidak dipakai browser** | backend-only (HMAC) |

Tidak dikirim dari browser: `requestId`, `accountId`, `callbackUrl`, PDF, email
penanda tangan, `PSP_API_KEY`, `PSP_CALLBACK_SECRET`, bearer token provider.
`/signatures/request` **tidak** diganti menjadi `/signatures` berdasarkan asumsi.

**BACKEND CONTRACT BLOCKER** — snapshot OpenAPI backend terbaru (pasca PSP
Gateway) belum tersedia, sehingga endpoint/field baru tidak diverifikasi dan
tidak dikarang. Lihat `CONTRACT_DELTA_TTE_FRONTEND.md` §7.

---

## 4. Hasil quality gate

Dijalankan pada working tree final (Next.js 16.4.6, build produksi di port 3311):

| Perintah | Hasil |
|----------|-------|
| `npm run typecheck` | **PASS** (0 error) |
| `npm run lint` | **PASS** (exit 0, tanpa output) |
| `npm run test` | **PASS** — 59 file, **753 test lulus**, 21 skip |
| `npm run build` | **PASS** — semua route ter-render |
| `npm audit --omit=dev` | **PASS** — 0 vulnerabilities |
| `npm run test:contrast` | **PASS** — 136/136 pasangan wajib WCAG AA |
| `npm run test:raw-colors` | **PASS** — 0 pelanggaran (348 file) |
| `npm run test:a11y` | **PASS** — 33 halaman/state, **0 violation** critical/serious, 46 field bernama aksesibel |
| `npm run test:a11y:keyboard` | **PASS** — **24/24** skenario |
| `npm run test:roles` | **PASS** — **21/21** pemeriksaan (7 peran) |
| `npm run test:e2e:frontend` | **PASS** — **37/37** skenario |
| `npm run test:e2e:frontend:contract` | **PASS** — **85/85** skenario, 0 page/console error |
| `npm run test:e2e:playwright` | **PASS** — **25/25** test |
| `npm ci` | PASS (dijalankan saat instalasi dependency upgrade) |

Catatan a11y (info, bukan gate): `page-has-heading-one` (16 node),
`heading-order` (5), `region` (1), dan 304 target sentuh < 44 px. Ini
best-practice; tidak ada pelanggaran critical/serious.

---

## 5. Mock E2E vs staging

- Seluruh E2E di atas berlabel **`frontend-contract-test`** dan memakai mock
  network di browser. Hasil ini **bukan** bukti provider live.
- `npm run test:e2e:staging` / mode `business` membutuhkan backend + kredensial
  staging → **BLOCKED** (tidak dijalankan tanpa backend nyata).

---

## 6. Security

- Pemindaian `.next/static` untuk `PSP_API_KEY`, `PSP_CALLBACK_SECRET`,
  `PSP_PRIVATE`, `CALLBACK_SECRET` → **0 kecocokan**.
- Tidak ada HMAC callback di browser; tidak ada panggilan PSP langsung.
- Token QR tidak dirender, tidak di-log, tidak dipersist (store v2 memigrasikan
  nilai lama).
- URL unduhan divalidasi: skema `https` (http hanya localhost), tanpa credential
  tersemat; `javascript:`, `data:`, `blob:`, `file:` ditolak.
- Pesan backend/provider tidak diteruskan mentah ke UI.
- ID request retry termasking.

---

## 7. Responsive & performance

- Viewport diuji: 360×800, 390×844, 768×1024, 1280×800, 1440×900 (login,
  dashboard, people/wizard, documents, signatures, certificates, verify, OH
  review, waiver, master data, SOAP, pharmacy). Tidak ada horizontal overflow;
  tombol utama dalam viewport; modal tidak terpotong; navigasi mobile berfungsi.
- **Performance: NOT RUN** — LCP/INP/CLS/TTFB/First-load JS tidak diukur dengan
  Lighthouse/WebPageTest pada sesi ini. Tidak diklaim PASS.

---

## 8. Blocker backend/provider/infrastruktur

1. **BACKEND CONTRACT BLOCKER** — OpenAPI terbaru (pasca PSP Gateway) belum
   tersedia untuk verifikasi frontend.
2. **Respons biner signed PDF** belum terbukti; validasi `%PDF-`/content-type/
   batas 15 MB sudah tersedia & teruji tetapi belum diaktifkan.
3. **Provider PSP live** (PRIVY/PSrE) belum diuji; callback/HMAC tetap backend.
4. **Staging E2E** belum dijalankan (tidak ada backend/kredensial).
5. `transactionId`/`certificate_serial` hanya ditampilkan bila backend mengirim.

---

## 9. Next action

1. Sediakan OpenAPI backend terbaru → verifikasi ulang endpoint download/verify,
   lalu aktifkan validasi payload PDF bila respons biner didukung.
2. Jalankan smoke test staging di `HANDOFF_FRONTEND_STAGING.md` dengan provider
   sandbox.
3. Ukur performance staging (Lighthouse) sebelum menaikkan status.
4. Status staging-ready hanya boleh diberikan setelah (1)–(3) lulus dengan
   evidence nyata.
