# Laporan Integrasi Frontend TTE — PSP Gateway (FRONTEND ONLY)

Tanggal: 19 Nov 2026 · Repository: `frontend-LNGxKodeintekno` · Branch kerja: `feat/tte-psp-gateway`
Baseline: `b4b70754c5859c2e45bd0e074b8ac54ce5cacdfe` (`fix(rbac): selarankan akses kunjungan dengan medical firewall backend`)

## 0. Ringkasan eksekutif

Pekerjaan ini **hanya frontend**. Tidak ada perubahan backend, Prisma schema, migration, provider, callback handler, queue, storage, maupun secret.

Temuan paling penting dari audit kontrak: **laporan naratif backend tidak mengubah path endpoint yang dipakai browser.** Backend commit `a3e134c` menambahkan `PspGatewayService`, yaitu komunikasi **backend → provider PSP** (request ID, account ID, file PDF, judul, email/nama penanda tangan, callback URL, transaction ID, pengambilan PDF, HMAC callback). Field-field itu **bukan** field request browser → backend. Browser tetap memanggil `POST /api/v1/signatures/request` dengan tiga field sesuai `RequestSignatureDto` yang terbukti di OpenAPI.

Karena itu:
- Tidak ada endpoint yang diganti hanya karena laporan naratif.
- Tidak ada field PSP/secret yang ditambahkan ke payload browser.
- Tidak ada HMAC callback yang diimplementasikan di browser.
- Tidak ada provider PSP yang dipanggil langsung dari browser.

Status akhir: **COMPLETE untuk sisi frontend contract/UX; staging & provider live = BLOCKED** (tidak ada backend staging/PSP yang tersedia di environment ini). Mock browser diberi label `frontend-contract-test` dan **tidak** dipakai sebagai bukti integrasi provider nyata.

---

## 1. Sumber bukti kontrak

| Sumber | Lokasi | Keterangan |
| --- | --- | --- |
| OpenAPI backend (snapshot Fase 6) | `tmp2/openapi.json` (commit `4739cda`) | Machine-readable; berisi `paths` + `RequestSignatureDto`, `RenderPdfDto`, `PsreCallbackDto`. |
| Live wiring report | `FASE-6-WIRING-BACKEND-REPORT.md` | `GET /docs-json` 86 route; menyatakan backend hanya punya `POST /signatures/request` & `POST /signatures/callback`, **tanpa** `GET /signatures`, `GET /signatures/:id`, `POST /signatures/:id/retry`. |
| Service frontend baseline | `src/lib/services/document.service.ts` @ `b4b7075` | Sudah memakai adapter `signature_reqs` dari `GET /documents` (bukan `GET /signatures`). |
| Test kontrak lama | `src/lib/services/__tests__/module-endpoints.test.ts` | Daftar endpoint yang diharapkan + snapshot route backend. |
| E2E staging lama | `e2e/staging-business-flows.mjs`, `LAPORAN_E2E_FRONTEND_STAGING.md` | Menyatakan storage `local`, bukan S3/MinIO → signed URL/PSrE tidak dapat diverifikasi. |

> **CATATAN BLOCKER KONTRAK:** snapshot OpenAPI di atas berasal dari Fase 6 (sebelum commit backend `a3e134c`). Kontrak PSP terbaru belum tersedia sebagai OpenAPI/staging yang bisa dibaca frontend. Di mana kontrak baru belum terbukti, laporan ini menandai `BACKEND CONTRACT BLOCKER` dan frontend **tidak menebak**.

---

## 2. Contract matrix (P0)

| Operasi | Method/path aktual | Request body | Response | Permission (frontend UX) | Status |
| --- | --- | --- | --- | --- | --- |
| Render PDF | `POST /api/v1/documents/render-pdf` | `{ documentType, referenceId, title }` (`RenderPdfDto`) | 201 `{ documentId, title, objectKey?, verificationUrl?, status?, sha256Hash? }` | `documents.render` → `issue-certificate` | **PASS** — OpenAPI + wiring |
| Request signature | `POST /api/v1/signatures/request` | `{ documentId, signatureType, providerCode? }`; `signatureType` enum `INTERNAL_PIN \| CERTIFIED_PSRE` | 201 `SignatureRequest` (status `PENDING`) | `documents.request-signature` → `issue-certificate` | **PASS** — path dipertahankan, bukan `/signatures` |
| List documents | `GET /api/v1/documents` | query `page, limit, search, documentType, status` (+ `patientId` dari adapter) | 200 `{data:[BackendDocument], meta}`; `signature_reqs` di-include | route `issue-certificate` | **PASS** (perbaikan: `getPaged`) |
| List signature status | diturunkan dari `GET /documents` → `signature_reqs` | tidak ada request khusus | array `SignatureRequest` hasil adapter klien | route `issue-certificate` | **PASS (adapter)** — `GET /signatures` **tidak ada** di backend |
| Download signed PDF | `GET /api/v1/documents/:id/download` | — | `{ url, expiresIn }` → divalidasi adapter | `documents.download-signed` → `issue-certificate` | **PARTIAL — BACKEND CONTRACT BLOCKER** (path dipakai service/live wiring, tetapi tidak tercantum di snapshot OpenAPI Fase 6) |
| Public QR verify | `GET /api/v1/public/verify/:qrToken` | — | `{ isValid, status, documentNumber?, documentType?, issuedAt?, signedAt?, certificateSerial? }`; status teramati `VERIFIED`, `NOT_SIGNED`, `INVALID`, `INVALID_OR_EXPIRED` | publik | **PASS** (zero medical disclosure) |
| Retry signature | `POST /signatures/request` (request **baru**, dokumen sama) | `{ documentId, signatureType, providerCode? }` | 201 `SignatureRequest` dengan **ID baru** | `documents.retry-signature` → `issue-certificate` | **PASS (adapter)** — backend tidak punya `/signatures/:id/retry` |

### 2.1 Verifikasi field

| Field | Keputusan frontend | Bukti |
| --- | --- | --- |
| `documentId` vs `document_id` | Request: `documentId` (camelCase). Response/adapter: `document_id`. | `RequestSignatureDto`, `SignatureRequest` |
| `signatureType` vs `signature_type` | Request: `signatureType`; response: `signature_type`. Enum request diverifikasi client. | `RequestSignatureDto.enum` |
| `providerCode` vs `provider_code` | Request: `providerCode`; response: `provider_code`. | `RequestSignatureDto` |
| `requestId`, `accountId` | **TIDAK dikirim browser** — milik komunikasi backend→PSP. | laporan backend a3e134c |
| `transactionId` / `providerTransactionId` | Hanya dibaca bila backend mengirim (`provider_transaction_id`); tidak direkayasa. | `PsreCallbackDto` (backend→provider) |
| `certificateSerial`, `signedHash`, `signedAt` | Dibaca dari field backend bila ada; tidak diubah jadi klaim sukses. | `PublicVerifyResult`, `SignatureRequest` |
| `status` | Dipetakan ketat (lihat §3); tidak dikenal → fallback aman. | kontrak + requirement prompt |
| `expiresAt`, `downloadUrl` | `expires_at` dibaca bila ada; unduhan memakai `{url}` adapter (bukan field `downloadUrl` yang dikarang). | service adapter |
| `qrToken` | Hanya berasal dari `verificationUrl` response render; tidak disimpan localStorage; ditampilkan ter-mask. | `verifyTokenFromUrl`, `maskVerifyToken` |

### 2.2 Backend contract blocker yang tercatat

1. **Download endpoint belum ada di OpenAPI snapshot** — path `GET /documents/:id/download` dipertahankan karena dipakai service & wiring lama, tetapi diberi label PARTIAL sampai tersedia OpenAPI/staging aktif. Frontend tidak mengganti dengan URL provider.
2. **Kontrak PSP terbaru (a3e134c) belum terekspos ke frontend** — tidak ada OpenAPI baru yang menjelaskan apakah `POST /signatures/request` berubah. Frontend **tidak** menambahkan field request ID/account ID/PDF/email/callback URL ke browser. Jika backend mengubah kontrak ini, itu perubahan breaking yang harus diverifikasi dulu.
3. **Pemisahan status `EXPIRED` vs `REVOKED` pada verifikasi publik belum tersedia** — backend mengirim `INVALID_OR_EXPIRED` gabungan. UI menampilkan state gabungan yang jujur, bukan mengarang status.

---

## 3. Status mapping eksplisit

| Status backend | Label UI | Poll | Download | Retry | Catatan |
| --- | --- | --- | --- | --- | --- |
| `PENDING` | Menunggu provider | ya | tidak | tidak | |
| `PROCESSING` | Diproses provider | ya | tidak | tidak | |
| `SIGNED` | Tertandatangani | tidak | **ya** | tidak | Hanya status ini yang membuka download |
| `FAILED` | Gagal | tidak | tidak | ya | |
| `EXPIRED` | Kedaluwarsa | tidak | tidak | ya | |
| `CANCELLED` | Dibatalkan | tidak | tidak | tidak | Defensif; backend belum mengirimkannya |
| status lain / kosong | **Status tidak dikenali — hubungi administrator** | tidak | tidak | tidak | Tidak pernah diubah menjadi `SIGNED` |

Implementasi: `src/features/tte/signature-status.ts` (pure function, diuji).

---

## 4. Error mapping (P1)

| HTTP | Kind | Pesan UX (netral) |
| --- | --- | --- |
| 400 | payload | Permintaan tidak valid |
| 401 | session | Sesi telah berakhir, login kembali |
| 403 | permission | Akses terbatas → AccessDenied |
| 404 | not-found | Dokumen/permintaan tidak ditemukan |
| 409 | conflict | Permintaan bertentangan / status konflik |
| 413 | pdf-too-large | PDF melebihi 15 MB |
| 415 | not-pdf | Format berkas harus PDF |
| 422 | invalid-document | Dokumen belum memenuhi syarat |
| 429 | rate-limit | Terlalu banyak permintaan |
| 502 | provider-unavailable | Layanan penandatanganan tidak tersedia |
| 504 | provider-timeout | Penandatanganan timeout |
| 5xx lain | backend | Gangguan layanan |
| 0 / network | offline | Tidak ada koneksi |

**Pesan backend sengaja tidak diteruskan** di modul TTE (`mapTteError`) agar detail internal/secret tidak bocor ke UI. Satu-satunya pesan eksternal yang diteruskan adalah pesan konfigurasi frontend yang memang ditulis oleh `src/lib/env.ts`.

---

## 5. Perubahan frontend yang dikerjakan

### Modul logika murni (`src/features/tte/`)
- `signature-status.ts` — pemetaan status + fallback aman.
- `error-mapping.ts` — pemetaan error TTE yang aman.
- `polling.ts` — keputusan poll + backoff eksponensial (5s → 30s).
- `validation.ts` — enum backend, batas 15 MB, tipe PDF (UX only).
- `download.ts` — validasi URL unduhan, payload PDF (`%PDF-`, content type, 15 MB), nama berkas aman.
- `verify-state.ts` — klasifikasi state verifikasi publik + decode token aman.
- `messages.ts` — pesan aman bersama.

### Hook & komponen
- `hooks/use-signature-polling.ts` — poll hanya aktif, stop pada terminal/hidden/offline, single-flight, cleanup unmount/route change, backoff, "terakhir diperbarui", refresh manual.
- `components/signature-status-badge.tsx`, `request-signature-dialog.tsx`, `retry-signature-dialog.tsx`, `signed-pdf-button.tsx`.

### Halaman
- `/documents` — konfirmasi request (metadata, enum, peringatan provider, 15 MB), double-submit protection, status dari backend, retry dengan request ID baru, download hanya saat `SIGNED`, offline state, status region fokus, manual refresh.
- `/signatures` — polling aman, badge aman, retry konfirmasi, download lewat satu jalur service (menghapus `window.open` path hardcoded `/api/v1/...`), accessible name pada tombol ikon.
- `/verify/[token]` — tujuh state berbeda, decode token aman (URI malformed), tanpa token di UI/console/localStorage, tanpa open redirect.
- `/certificates` — token QR backend **tidak** disimpan ke store yang ter-persist; hanya di state komponen; tampil ter-mask; hasil verifikasi memakai klasifikasi aman.

### Service
- `document.service.ts` — body request dibatasi pada field kontrak; validasi enum & dokumen; **`getDocuments` diperbaiki dari `apiClient.get` ke `apiClient.getPaged`** (bug latent: tipe `{data,meta}` tetapi runtime menerima array); download satu jalur + validasi URL.
- `lib/actions.ts` — aksi guard terpisah: `documents.render`, `documents.request-signature`, `documents.retry-signature`, `documents.download-signed` (semuanya → `issue-certificate` menurut kontrak aktual; backend tetap otoritas).
- `components/verify-view.tsx` — state publik yang jujur.
- `src/shared/components/virtual-list.tsx` — `tabIndex=0` agar region scroll dapat diakses keyboard (perbaikan a11y yang ditemukan saat audit).

---

## 6. Security & secret safety

- Tidak ada `PSP_API_KEY`, `PSP_CALLBACK_SECRET`, `PSP_PROVIDER_CODE`, atau `NEXT_PUBLIC_PSP_*` di source/runtime.
- Tidak ada `createHmac`, `timingSafeEqual`, atau `crypto.subtle` HMAC di browser (diuji statis).
- Tidak ada `fetch("https://...")` langsung ke provider di source runtime (diuji statis).
- Callback provider tidak pernah dikirim/diterima frontend.
- URL unduhan divalidasi: http(s), tanpa credential, http hanya untuk localhost; token tidak dicatat/ditampilkan.
- `role=status` / `role=alert` dipakai untuk perubahan status dan error.

---

## 7. Bukti pengujian

| Pemeriksaan | Hasil |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | PASS — 713 passed, 21 skipped (54 file) |
| `npm run build` | PASS setelah retry notifikasi advisory Next.js 16.4.4 |
| `npm run test:contrast` | PASS — 136/136 pasangan wajib WCAG AA |
| `npm run test:a11y` | PASS — 33 halaman/state, 0 violation critical/serious, 46 field tanpa nama aksesibel = 0 |
| `npm run test:a11y:keyboard` | **BLOCKED** — butuh backend + `NEXT_PUBLIC_API_URL` nyata; environment ini tidak menyediakannya |
| E2E contract browser (`frontend-contract-test`) | PASS — 85/85 skenario, 0 page error, 0 console error tak terduga (`test-artifacts/frontend-e2e/browser-e2e-contract-report.json`) |
| E2E staging nyata | **BLOCKED — STAGING/PROVIDER BLOCKER** |

> Build Next.js 16.4.4 memunculkan peringatan kerentanan keamanan yang diketahui. upgrade disarankan; lihat rekomendasi di akhir sesi.

---

## 8. Blocker eksplisit

- `BACKEND CONTRACT BLOCKER` — OpenAPI aktif pasca-`a3e134c` belum tersedia. Tidak ada perubahan path/method yang boleh dilakukan tanpa itu.
- `BACKEND CONTRACT BLOCKER` — `GET /documents/:id/download` tidak ada di snapshot OpenAPI Fase 6; perlu konfirmasi path, method, envelope, dan content type pada staging.
- `BACKEND CONTRACT BLOCKER` — backend belum memisahkan status `EXPIRED` dan `REVOKED` pada verifikasi publik (`INVALID_OR_EXPIRED`).
- `STAGING/PROVIDER BLOCKER` — tidak ada backend staging/PSP credential di environment ini. Tidak ada klaim provider live.
- `ENVIRONMENT BLOCKER` — `NEXT_PUBLIC_API_URL` tidak dikonfigurasi di environment audit; keyboard flow yang memakai login backend nyata tidak dapat dijalankan.

---

## 9. Definition of Done — status

| Item | Status |
| --- | --- |
| Contract matrix TTE | PASS (dengan blocker tercatat) |
| Endpoint sesuai backend aktual | PASS |
| Request/response/status/error mapping terdokumentasi | PASS |
| Render PDF loading/error/success | PASS |
| Request signature konfirmasi + anti double-submit | PASS |
| Status PENDING/PROCESSING/SIGNED/FAILED/EXPIRED jelas | PASS |
| Polling aman | PASS |
| Retry aman & request ID baru | PASS |
| Signed PDF download aman + error state | PASS |
| Verifikasi publik membedakan state | PASS (state gabungan expired/invalid sesuai kontrak) |
| Tidak ada PSP secret di browser | PASS |
| Callback HMAC tidak di frontend | PASS |
| Provider tidak dipanggil langsung | PASS |
| Typecheck / Lint / Unit / Build | PASS |
| A11y / Keyboard / Responsive | A11y PASS · Keyboard BLOCKED (butuh backend nyata) · Responsive PASS (390×844 & 1280×800 pada contract E2E) |
| Staging E2E / provider live | BLOCKED |
| Dokumentasi + handoff | PASS |
