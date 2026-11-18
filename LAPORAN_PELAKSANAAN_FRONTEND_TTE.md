# Laporan Pelaksanaan — Integrasi Frontend TTE/PSP Gateway

Tanggal: 19 Nov 2026 · Scope: **FRONTEND ONLY**
Baseline: `b4b70754c5859c2e45bd0e074b8ac54ce5cacdfe`
Branch kerja: `feat/tte-psp-gateway`
Commit hasil: `cc2d5303282f1b10e0df5174d4cf5cd7e7ac4017`

---

## 1. Ringkasan singkat

Saya menyelesaikan audit kontrak TTE/PSP gateway dan memperkuat seluruh alur tanda tangan elektronik di sisi frontend. Hasil audit menunjukkan **laporan naratif backend tidak mengubah kontrak browser**: field PSP (request ID, account ID, file PDF, email/nama penanda tangan, callback URL) adalah komunikasi **backend → provider**, bukan request browser → backend. Karena itu path `POST /signatures/request` dan body `{documentId, signatureType, providerCode?}` dipertahankan sesuai OpenAPI yang terbukti.

Dokumen detail ada di:
- `LAPORAN_FRONTEND_TTE_PSP_GATEWAY.md` — contract matrix, pemetaan status/error, blocker, DoD.
- `HANDOFF_FRONTEND_TTE_STAGING.md` — langkah verifikasi staging & daftar konfirmasi backend.

Laporan ini merangkum **apa yang dikerjakan** dan **bukti yang dihasilkan**.

---

## 2. Kronologi pekerjaan

### Tahap 0 — Penyelarasan workspace
- Checkout awal berada di branch `feat/a1-sisa` (`228cd79`) dengan perubahan belum ter-commit, bukan di baseline yang diminta prompt.
- Perubahan WIP tersebut **diamankan** dengan `git stash -u` pesan `WIP before TTE-PSP work (Fase 9/prod readiness)` — tidak dihapus atau ditimpa.
- Branch baru `feat/tte-psp-gateway` dibuat tepat dari `b4b7075` agar diff bersih dan sesuai baseline.

### Tahap 1 — Contract audit (P0)
- Membaca `tmp2/openapi.json` (snapshot Fase 6), `FASE-6-WIRING-BACKEND-REPORT.md`, `document.service.ts`, dan `module-endpoints.test.ts`.
- Menyusun contract matrix untuk 7 operasi: render PDF, request signature, list documents, list status, download, QR verify, retry.
- Memutuskan berdasarkan bukti:
  - Backend hanya punya `POST /signatures/request` & `POST /signatures/callback`; **tidak ada** `GET /signatures`, `GET /signatures/:id`, `POST /signatures/:id/retry`.
  - Status signature dibaca dari `signature_reqs` pada `GET /documents` (adapter yang sudah ada di baseline).
  - Tidak ada endpoint/field/status yang dikarang dari laporan naratif.

### Tahap 2 — Modul logika TTE murni
Dibuat di `src/features/tte/`:
| File | Isi |
| --- | --- |
| `signature-status.ts` | Pemetaan status ketat; `CANCELLED` defensif; status tak dikenal → "Status tidak dikenali — hubungi administrator"; download **hanya** untuk `SIGNED`. |
| `error-mapping.ts` | 400/401/403/404/409/413/415/422/429/502/504/5xx/network → pesan aman; pesan backend **sengaja tidak diteruskan**; kind khusus `unsafe-link`. |
| `polling.ts` | Keputusan poll + backoff 5s→30s; hanya PENDING/PROCESSING. |
| `validation.ts` | Enum `INTERNAL_PIN`/`CERTIFIED_PSRE`, batas 15 MB, tipe PDF (UX only). |
| `download.ts` | Validasi URL unduhan (skema, credential, http hanya localhost), validasi payload PDF (`%PDF-`, content type, 15 MB), nama berkas aman. |
| `verify-state.ts` | Klasifikasi 8 state verifikasi publik + decode token aman terhadap URI malformed. |
| `messages.ts` | Pesan aman bersama. |

### Tahap 3 — Hook & komponen
- `hooks/use-signature-polling.ts`: single-flight (anti request ganda), backoff, berhenti saat tab hidden/offline/status terminal, cleanup saat unmount/route change, "terakhir diperbarui", refresh manual.
- `components/signature-status-badge.tsx`: badge status aman dengan `role=status`.
- `components/request-signature-dialog.tsx`: konfirmasi eksplisit + metadata dokumen + peringatan provider + batas 15 MB + pilihan enum.
- `components/retry-signature-dialog.tsx`: konfirmasi retry + penjelasan request lama → request baru.
- `components/signed-pdf-button.tsx`: satu jalur download, loading/error/retry, `aria-label`.

### Tahap 4 — Wiring halaman
- **`/documents`**: request butuh konfirmasi, satu klik = satu POST, status dari backend, retry baru dengan ID lama/baru, download hanya `SIGNED`, offline banner, fokus ke region status.
- **`/signatures`**: polling aman, badge aman, retry konfirmasi, **menghapus** `window.open('/api/v1/documents/.../download')` hardcoded → memakai service adapter; tombol ikon dapat nama aksesibel.
- **`/verify/[token]`**: membedakan valid / belum signed / invalid / expired / revoked / expired-or-invalid / backend error / empty; token tidak tampil di UI, judul, console, atau localStorage.
- **`/certificates`**: token QR backend tidak lagi disimpan di store yang ter-persist ke localStorage (hanya state komponen), tampil ter-mask, hasil verifikasi pakai klasifikasi aman.

### Tahap 5 — Service & RBAC
- `document.service.ts`:
  - Request body dibatasi 3 field kontrak + validasi enum/dokumen.
  - **Perbaikan bug**: `getDocuments` dari `apiClient.get` → `apiClient.getPaged` (sebelumnya tipe `{data,meta}` tapi runtime menerima array).
  - Download satu jalur + validasi URL; `retrySignature` tetap membuat request baru.
- `lib/actions.ts`: guard terpisah `documents.render`, `documents.request-signature`, `documents.retry-signature`, `documents.download-signed` (semuanya → `issue-certificate` sesuai kontrak aktual).
- `components/verify-view.tsx`: rewrite state publik yang jujur.
- `src/shared/components/virtual-list.tsx`: `tabIndex=0` agar region scroll bisa diakses keyboard (violation axe ditemukan saat audit).

### Tahap 6 — Testing
- Unit/logika: `src/features/tte/__tests__/tte-logic.test.ts` (37 test).
- Service contract: `src/lib/services/__tests__/document-tte-contract.test.ts` (8 test).
- Secret safety: ditambahkan ke `src/lib/__tests__/frontend-config-audit.test.ts` (audit `PSP_*`, `NEXT_PUBLIC_PSP_*`, HMAC, fetch langsung ke provider).
- Browser contract E2E baru: `e2e/lib/tte-contract-suite.mjs`, di-wire ke `e2e/run-frontend-e2e.mjs` mode `contract`, berlabel `frontend-contract-test`.

### Tahap 7 — Dokumentasi
- `LAPORAN_FRONTEND_TTE_PSP_GATEWAY.md`
- `HANDOFF_FRONTEND_TTE_STAGING.md`
- `LAPORAN_PELAKSANAAN_FRONTEND_TTE.md` (file ini)

---

## 3. Hasil verifikasi

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (0 error, 0 warning) |
| `npm test` | PASS — **713 passed**, 21 skipped, 54 file |
| `npm run build` | PASS (setelah retry notifikasi advisory Next.js 16.4.4) |
| `npm run test:contrast` | PASS — 136/136 pasangan wajib WCAG AA |
| `npm run test:a11y` | PASS — 33 halaman, **0 violation** critical/serious |
| `npm run test:e2e:frontend:contract` (`E2E_BASE_URL=http://localhost:3311`) | PASS — **85/85 skenario**, 0 page error, 0 console error |
| `npm run test:a11y:keyboard` | BLOCKED (butuh backend nyata + `NEXT_PUBLIC_API_URL`) |
| E2E staging nyata / provider live | BLOCKED (tidak ada staging/PSP credential) |

Artefak E2E: `test-artifacts/frontend-e2e/browser-e2e-contract-report.json`.

Skenario TTE yang diuji mock browser: konfirmasi tanpa request, double-click → 1 POST, body tanpa secret, PENDING→PROCESSING→SIGNED→FAILED→EXPIRED→CANCELLED→unknown, download hanya saat SIGNED, polling cleanup saat route change, retry old→new, HTTP 400/401/403/404/409/413/415/422/429/502/504/503/network, URL download tidak aman, 7 state verify publik, role unauthorized, offline/reconnect.

---

## 4. Keputusan penting & blocker

- **Tidak ada endpoint yang diganti** hanya dari laporan naratif backend.
- **Tidak ada secret/field PSP** di browser; **tidak ada HMAC callback** di frontend; **provider tidak dipanggil langsung**.
- **`BACKEND CONTRACT BLOCKER`**: OpenAPI pasca-commit backend `a3e134c` belum tersedia; `GET /documents/:id/download` belum ada di snapshot OpenAPI Fase 6; status `EXPIRED` vs `REVOKED` belum dipisah backend.
- **`STAGING/PROVIDER BLOCKER`**: tidak ada backend staging/PSP sandbox. Mock **tidak** dipakai sebagai bukti integrasi provider nyata.
- Status akhir frontend: **COMPLETE**; status keseluruhan: **PARTIAL** karena staging/provider masih BLOCKED.

---

## 5. Catatan repo

- WIP lama di branch `feat/a1-sisa` tersimpan aman di `stash@{0}` (`WIP before TTE-PSP work (Fase 9/prod readiness)`).
- Pekerjaan ini ada di branch `feat/tte-psp-gateway`, **belum** di-merge ke `main` (keputusan merge diserahkan ke reviewer).
- Next.js 16.4.4 menyarankan upgrade security (peringatan muncul saat build).
