# CONTRACT DELTA — TTE FRONTEND (Fase 9)

Dokumen ini mencatat **kontrak frontend → backend** yang dipakai modul Dokumen &
Tanda Tangan Elektronik (TTE) setelah hardening Fase 9. Lingkup 100% frontend:
tidak ada perubahan backend, Prisma, migration, provider, queue, storage, atau
infrastruktur.

- **Baseline**: `173834e6dddf8a3a44336995838a7b867767e8af` (`main`)
- **Tanggal audit**: 2026-11-24
- **Repo**: `frontend-LNGxKodeintekno` (frontend only)
- **Sumber kontrak**: adapter frontend yang sudah terbukti (`src/lib/services/document.service.ts`),
  snapshot OpenAPI Fase 6 yang tersimpan di repo frontend, dan laporan wiring
  TTE sebelumnya. **Backend tidak dibuka/diubah pada fase ini.**

> **BACKEND CONTRACT BLOCKER — kontrak terbaru belum tersedia untuk verifikasi frontend**
>
> Snapshot OpenAPI backend terbaru (setelah PSP Gateway) tidak disediakan untuk
> diverifikasi pada fase ini. Karena itu frontend **mempertahankan endpoint dan
> field yang sudah terbukti** dan tidak mengarang endpoint/field baru. Semua
> ketidakpastian dicatat di bagian “Belum dapat diverifikasi”.

---

## 1. Endpoint yang dipakai frontend

| # | Method | Path | Pemakaian UI | Bukti kontrak |
|---|--------|------|--------------|---------------|
| 1 | `POST` | `/api/v1/documents/render-pdf` | `/documents`, `/certificates` | OpenAPI Fase 6 + live wiring |
| 2 | `POST` | `/api/v1/signatures/request` | `/documents`, `/signatures`, `/certificates` | OpenAPI Fase 6 (`RequestSignatureDto`) |
| 3 | `GET` | `/api/v1/documents` | `/documents`, `/signatures` (status `signature_reqs`) | OpenAPI Fase 6 (`QueryDocumentsDto`) |
| 4 | `GET` | `/api/v1/documents/:id/download` | `SignedPdfButton` | Service + live wiring; **tidak ada di snapshot OpenAPI Fase 6** (lihat §7) |
| 5 | `GET` | `/api/v1/public/verify/:qrToken` | `/verify/[token]`, preview `/certificates` | OpenAPI Fase 6 (publik) |
| — | `POST` | `/api/v1/signatures/callback` | **TIDAK dipakai browser** | Webhook provider, backend-only |
| — | `GET` | `/api/v1/signatures` | **TIDAK ada/dipakai** | Backend tidak mengekspos daftar signature |
| — | `GET` | `/api/v1/signatures/:id` | **TIDAK ada/dipakai** | Detail diturunkan dari `signature_reqs` |
| — | `POST` | `/api/v1/signatures/:id/retry` | **TIDAK ada/dipakai** | Retry = request baru ke `/signatures/request` |

### 1.1 `POST /documents/render-pdf`

Request body (hanya tiga field):

```json
{
  "documentType": "FTW_CERTIFICATE | MCU_RESUME | MEDICAL_RESUME | SICK_LEAVE",
  "referenceId": "<id siklus MCU atau encounter final>",
  "title": "<judul dokumen>"
}
```

Response yang dipakai (`RenderPdfResult`):

```json
{
  "documentId": "string",
  "title": "string",
  "status": "string?",
  "objectKey": "string?",
  "sha256Hash": "string?",
  "verificationUrl": "string?  // satu-satunya sumber token QR mentah"
}
```

Catatan:
- `verificationUrl` hanya dikembalikan pada respons render. `GET /documents`
  hanya memuat `qr_token.token_hash`, **bukan** token verifikasi; karena itu
  tombol “Verifikasi QR” di `/certificates` hanya muncul pada sesi yang baru
  merender dokumen.
- Frontend tidak menebak token dari `token_hash`.

### 1.2 `POST /signatures/request`

Request body (kontrak `RequestSignatureDto`):

```json
{
  "documentId": "string",
  "signatureType": "INTERNAL_PIN | CERTIFIED_PSRE",
  "providerCode": "string?  // opsional, hanya bila UI sudah memilikinya"
}
```

**Tidak pernah dikirim dari browser**: `requestId`, `accountId`, `callbackUrl`,
file PDF, email/nama penanda tangan, `PSP_API_KEY`, `PSP_CALLBACK_SECRET`, bearer
token provider, atau field provider internal lainnya.

Response yang dipakai (`SignatureRequest`): `id`, `document_id?`,
`signature_type?`, `status`, `provider_code?`, `provider_transaction_id?`,
`certificate_serial?`, `signed_at?`, `completed_at?`.

`provider_transaction_id` hanya dideklarasikan sebagai field respons opsional.
Frontend **tidak menampilkannya** dan **tidak pernah mengarangnya** bila backend
tidak mengirim.

### 1.3 `GET /documents`

Query yang dipakai: `page`, `limit`, `patientId?`, `documentType?`, `status?`,
`search?`.

Status TTE dibaca dari `signature_reqs[]` pada setiap dokumen:

```json
{
  "id": "doc-1",
  "document_type": "FTW_CERTIFICATE",
  "title": "...",
  "object_key": "...",
  "sha256_hash": "...",
  "status": "READY",
  "qr_token": { "token_hash": "...", "revoked": false, "expires_at": "..." },
  "signature_reqs": [
    { "id": "sig-1", "status": "SIGNED", "signature_type": "CERTIFIED_PSRE",
      "provider_code": "PRIVY", "certificate_serial": "...", "completed_at": "..." }
  ]
}
```

Frontend memilih `signature_reqs` terakhir sebagai status dokumen. Field status
yang tidak dikirim backend **tidak diisi default palsu**; UI menampilkan
“Status tidak dikenali — hubungi administrator”.

### 1.4 `GET /documents/:id/download`

Response JSON yang didukung: `{ "url": "...", "expiresIn": 3600 }` atau
`{ "downloadUrl": "...", "expiresIn": 3600 }`.

Aturan frontend:
- Hanya dipanggil bila status `SIGNED`.
- URL divalidasi: skema `https` (atau `http` hanya untuk localhost), tanpa
  username/password tersemat; `javascript:`, `data:`, `blob:`, `file:` ditolak.
- Frontend tidak memanggil provider PSP dan tidak menyimpan token provider.
- Respons biner PDF (bukan JSON) **belum terbukti** pada kontrak; helper
  `validatePdfPayload` (content-type, header `%PDF-`, batas 15 MB) sudah tersedia
  dan teruji, tetapi belum diaktifkan karena bentuk respons backend belum dapat
  diverifikasi. Lihat §7.

### 1.5 `GET /public/verify/:qrToken`

Response yang dipakai:

```json
{
  "isValid": true,
  "status": "VERIFIED | NOT_SIGNED | INVALID | INVALID_OR_EXPIRED",
  "documentType": "string?",
  "documentNumber": "string?",
  "issuedAt": "string?",
  "signedAt": "string?",
  "certificateSerial": "string?"
}
```

Frontend meng-`encodeURIComponent` token sebelum membentuk path API agar token
tidak dapat mengubah path/query. Token tidak dirender, tidak di-log, dan tidak
disimpan ke localStorage.

Status `EXPIRED`, `REVOKED`/`VOID`/`CANCELLED`, serta `VALID`/`SIGNED` dipetakan
secara defensif **hanya jika** backend mengirimnya. Dokumen tidak pernah
dinyatakan valid hanya karena flag `isValid`; status sukses eksplisit juga wajib.

---

## 2. Status signature (frontend)

| Status backend | Label UI | Aktif (poll) | Terminal | Retry | Download |
|----------------|----------|--------------|----------|-------|----------|
| `PENDING` | Menunggu provider | ya | tidak | tidak | tidak |
| `PROCESSING` | Diproses provider | ya | tidak | tidak | tidak |
| `SIGNED` | Tertandatangani | tidak | ya | tidak | **ya** |
| `FAILED` | Gagal | tidak | ya | **ya** | tidak |
| `EXPIRED` | Kedaluwarsa | tidak | ya | **ya** | tidak |
| `CANCELLED` | Dibatalkan | tidak | ya | tidak | tidak |
| lainnya / kosong | Status tidak dikenali — hubungi administrator | tidak | ya | tidak | tidak |

Tidak ada status yang diterjemahkan menjadi `SIGNED`.

## 3. Polling

- Hanya ketika ada `PENDING`/`PROCESSING`.
- Satu request aktif (single-flight); backoff 5s → 10s → 20s → 30s (maks).
- Berhenti pada status terminal, tab hidden, offline, auto-refresh OFF, unmount,
  atau route change. Refresh manual selalu tersedia dan menampilkan waktu
  pembaruan terakhir.
- Sumber polling = `GET /documents` (satu round-trip), bukan `GET /signatures`.

## 4. Error mapping (HTTP → UX)

| HTTP | Kind | Pesan UX | Retry |
|------|------|----------|-------|
| 400 | payload | Permintaan tidak valid | tidak |
| 401 | session | Sesi berakhir → login | tidak |
| 403 | permission | Akses terbatas (AccessDenied) | tidak |
| 404 | not-found | Data tidak ditemukan | tidak |
| 409 | conflict | Permintaan bertentangan | tidak |
| 413 | pdf-too-large | PDF melebihi 15 MB | tidak |
| 415 | not-pdf | Berkas harus PDF | tidak |
| 422 | invalid-document | Dokumen belum memenuhi syarat | tidak |
| 429 | rate-limit | Terlalu banyak permintaan | ya |
| 502 | provider-unavailable | Provider belum dapat diakses | ya |
| 503/5xx | backend | Gangguan layanan | ya |
| 504 | provider-timeout | Provider timeout | ya |
| 0 | offline/config | Pesan koneksi/konfigurasi | ya / tidak |
| — | unsafe-link | Tautan berkas tidak aman | tidak |

Pesan backend/provider mentah **tidak diteruskan** ke UI (dapat memuat host
internal, callback URL, atau credential). Hanya pesan konfigurasi yang ditulis
frontend (`NEXT_PUBLIC_API_URL`) yang boleh diteruskan.

## 5. Permission & RBAC

- Route guard: `/documents`, `/signatures`, `/certificates` → `issue-certificate`.
- Action guard: `documents.render`, `documents.request-signature`,
  `documents.retry-signature`, `documents.download-signed` → `issue-certificate`.
- Satu-satunya role frontend dengan `issue-certificate` saat ini: `dokter-oh`
  (Dokter OH). Backend tetap otoritas akhir.
- Role tanpa izin: direct URL → **AccessDenied** tanpa memuat data; HTTP 403
  ditampilkan sebagai akses terbatas, bukan error generik.
- Permission frontend **tidak diperluas** pada fase ini.

## 6. Perubahan Fase 9 (frontend)

| Area | Perubahan |
|------|-----------|
| `document.service.ts` | Token verify di-encode (`encodeURIComponent`), tolak token kosong; status kosong tidak diisi `PENDING`; retry menolak `signatureType` tak dikenal (tidak mengarang `CERTIFIED_PSRE`). |
| `verify-state.ts` | `VALID`/`SIGNED` diterima defensif hanya bila `isValid === true`. |
| `retry-signature-dialog.tsx` | ID request lama/new ditampilkan **termasking**. |
| `signed-pdf-button.tsx` | Navigasi via anchor (tahan popup blocker), tautan fallback manual, status hasil, error aman, tanpa console token. |
| `/certificates` | Konfirmasi eksplisit sebelum render + request TTE, anti double-submit, pesan error aman, token QR hanya di memori, hapus token mentah dari pesan & dari fallback `cert.qrToken`. |
| `/signatures` | Filter status tidak lagi direset oleh polling; hitungan memakai mapper status (case-insensitive/unknown aman). |
| `/documents` | Status kosong → “tidak dikenali” (bukan `PENDING`); relasi retry termasking. |
| Store/seed/remote-sync | Token QR tidak lagi dibuat/dipersist; migrasi store v2 membuang `qrToken` lama dari localStorage. |
| `/my/certificates` | Link verifikasi dari `token_hash` (bukan token valid) dihapus. |

## 7. Belum dapat diverifikasi (frontend blocker)

1. **Kontrak backend terbaru** (setelah PSP Gateway) tidak tersedia. Endpoint
   yang dipakai adalah yang sudah terbukti pada snapshot sebelumnya.
2. **Bentuk respons `GET /documents/:id/download`**: JSON URL terverifikasi;
   respons biner PDF belum terbukti. Validasi payload PDF belum diaktifkan.
3. **`transactionId` provider**: backend tidak dikonfirmasi mengirimkannya.
   Frontend tidak menampilkan/mengarang nilai tersebut.
4. **Status `CANCELLED`, `EXPIRED`, `REVOKED` terpisah**: mapping disiapkan,
   tetapi backend saat ini dilaporkan mengirim `INVALID_OR_EXPIRED` gabungan.
5. **Kontrak `signature_reqs`**: diasumsikan memuat status terbaru; tidak ada
   endpoint detail signature. Bila backend mengubah bentuk ini, adapter perlu
   disesuaikan.
6. **Provider live/staging**: seluruh E2E TTE adalah `frontend-contract-test`
   (mock di browser), **bukan** bukti integrasi provider nyata.

## 8. Kesimpulan

- Kontrak frontend: **PARTIAL** — endpoint/field yang dipakai konsisten dan tidak
  ada secret di browser, tetapi kontrak backend terbaru belum dapat diverifikasi.
- Tidak ada klaim staging-ready/provider-live.
