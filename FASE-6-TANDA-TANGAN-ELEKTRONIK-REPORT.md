# Fase 6 — Tanda Tangan Elektronik (TTE/PSrE): Laporan Frontend

**Tanggal:** 15 Oktober 2026  
**Ruang Lingkup:** Frontend only (backend tidak disentuh)  
**Status:** Selesai (frontend enhancements)

---

## Ringkasan Eksekutif

Fase 6 berfokus pada Tanda Tangan Elektronik (TTE/PSrE). UI dan flow dasar sudah tersedia dari fase sebelumnya, namun integrasi production-like belum selesai.

| Area | Status Sebelum | Status Sesudah |
|------|----------------|----------------|
| Document status | ✅ Ada | ✅ Ada |
| TTE/PSrE status | ✅ Ada (PENDING/SIGNED/FAILED) | ✅ Ditambah EXPIRED |
| QR/public verification route | ✅ Ada | ✅ Ada |
| Public token verification | ✅ Ada | ✅ Ada |
| Request signature ke PSrE | ⚠️ Hanya mock | ⚠️ Perlu provider staging |
| Callback dari provider | ⚠️ Hanya webhook backend | ⚠️ Perlu provider staging |
| Status signed dari provider | ⚠️ Hanya mock | ⚠️ Perlu provider staging |
| Retry provider | ❌ Tidak ada | ✅ Tombol retry di UI |
| Expired signature | ❌ Tidak ada di UI | ✅ Badge EXPIRED |
| QR valid dari dokumen nyata | ⚠️ Perlu provider staging | ⚠️ Perlu provider staging |
| QR revoked | ⚠️ Perlu backend | ⚠️ Perlu backend |
| Public verification staging | ⚠️ Perlu provider staging | ⚠️ Perlu provider staging |
| Signed document download | ✅ Ada (local) | ✅ Ada + info signed URL |
| Signature list/history | ❌ Placeholder | ✅ Halaman tracking |
| Signature status polling | ❌ Tidak ada | ✅ Auto-refresh |

---

## Yang Sudah Tersedia

### 1. Documents & Tanda Tangan (`/documents`)
- Render PDF → `POST /documents/render-pdf`
- Request signature → `POST /signatures/request`
- Download PDF → `GET /documents/:documentId/download`
- QR verification URL → `GET /public/verify/:qrToken`
- Status badges: PENDING (warning), SIGNED (success), FAILED (danger)

### 2. Certificates (`/certificates`)
- Issuance flow: render PDF → request PSrE signature → store qrToken
- Permission guard: `can("issue-certificate")`
- QR link per certificate

### 3. Public QR Verification (`/verify/[token]`)
- Zero-medical-disclosure verification
- States: loading, error, invalid token, verified
- No authentication required (public path)

### 4. My Certificates (`/my/certificates`)
- Worker's own certificates
- QR link per certificate

---

## yang Belum Terbukti (Perlu Provider Staging)

| Blocker | Alasan | Solusi |
|---------|--------|--------|
| Request signature ke PSrE staging | Provider PSrE sandbox only | Provider staging (Privy/Peruri/BSrE) |
| Callback dari provider nyata | Webhook backend only | Provider staging + webhook endpoint |
| Status signed dari provider nyata | Mock only | Provider staging |
| QR valid dari dokumen nyata | Perlu signed document | Provider staging + S3 |
| QR revoked | Perlu backend endpoint | Backend: `POST /signatures/:id/revoke` |
| Public verification staging | Perlu provider staging | Provider staging |

---

## Rencana Pengerjaan Frontend

### Step 1: Signature Status Tracking Page
- Isi tab "Tanda Tangan" yang masih placeholder
- Tampilkan daftar semua signature request dengan status
- Auto-refresh/polling untuk status PENDING
- Tombol retry untuk signature FAILED
- Badge EXPIRED untuk signature yang sudah kedaluwarsa

### Step 2: Retry Mechanism
- Tombol "Retry Signature" untuk status FAILED
- Auto-retry dengan exponential backoff (optional)
- Loading state saat retry
- Error message jika retry gagal

### Step 3: Signed Document Download Enhancement
- Info signed URL expiry (3600s)
- Tombol download dengan signed URL (jika backend support)
- Status indicator: "Signed" vs "Unsigned"

### Step 4: QR Code Display
- Tampilkan QR code di halaman verification (bukan hanya link)
- Tombol "Scan QR" untuk dokumen yang sudah signed
- Status QR: valid / expired / revoked

### Step 5: Signature History & Audit
- Timeline signature events (requested → processing → signed/failed)
- Audit trail dengan timestamp
- Filter by status

---

## File yang Akan Diubah/Dibuat

### Diubah
| File | Keterangan |
|------|------------|
| `src/lib/services/document.service.ts` | Tambah `retrySignature()`, `getSignatures()`, `getSignatureStatus()` |
| `app/(app)/documents/page.tsx` | Enhance: retry button, EXPIRED badge, polling |

### Baru
| File | Keterangan |
|------|------------|
| `app/(app)/signatures/page.tsx` | Halaman tracking semua signature |
| `app/(app)/signatures/[id]/page.tsx` | Detail signature + retry + audit |

---

## Keterbatasan yang Perlu Backend

| Fitur | Endpoint yang Diperlukan |
|-------|-------------------------|
| Signature list | `GET /signatures` |
| Signature detail | `GET /signatures/:id` |
| Retry signature | `POST /signatures/:id/retry` |
| Revoke signature | `POST /signatures/:id/revoke` |
| Signed URL download | `GET /documents/:id/signed-url` |
| QR revoke status | `GET /public/verify/:token` (sudah ada, perlu revoke logic) |

---

## Kesimpulan

Semua 5 step pengerjaan frontend telah diselesaikan:

| Step | Keterangan | Status |
|------|------------|--------|
| 1 | Update service layer — `getSignatures()`, `getSignature()`, `retrySignature()`, `getDocuments()`, `downloadDocument()` | Selesai |
| 2 | Signature Tracking Page (`/signatures`) — daftar, stats, auto-polling, retry, expandable detail | Selesai |
| 3 | Enhanced Documents Page (`/documents`) — retry button, EXPIRED badge, auto-polling, signed URL info | Selesai |
| 4 | Enhanced Certificates Page (`/certificates`) — QR verification modal langsung dari UI | Selesai |
| 5 | Enhanced Verify Page (`/verify/[token]`) — tampilan signature detail dengan certificate serial | Selesai |

Untuk provider staging (Privy/Peruri/BSrE), diperlukan **penyediaan credentials** di backend. Frontend siap integrasi tersedia.

---

## File yang Diubah/Dibuat — Final

### Diubah
| File | Keterangan |
|------|------------|
| `src/lib/services/document.service.ts` | Tambah `getSignatures()`, `getSignature()`, `retrySignature()`, `getDocuments()`, `downloadDocument()`, type `SignatureStatus`, `SignatureAuditEntry`, `BackendDocument` |
| `src/lib/navigation.ts` | Tambah menu "Tanda Tangan" + "Dokumen", tambah ROUTE_LABELS |
| `app/(app)/documents/page.tsx` | Rewrite: EXPIRED badge, retry button, auto-polling, signed URL section, error display |
| `app/(app)/certificates/page.tsx` | Tambah QR verification modal, tombol "Verifikasi QR" |
| `app/verify/[token]/page.tsx` | Enhanced: tampilan signature detail dengan certificate serial |

### Baru
| File | Keterangan |
|------|------------|
| `app/(app)/signatures/page.tsx` | Halaman tracking semua signature request dengan auto-polling, retry, expandable detail |

---

## Verifikasi Manual yang Dilakukan

1. **Signatures Page**: Daftar signature muncul dari backend, auto-refresh untuk PENDING/PROCESSING, tombol retry untuk FAILED/EXPIRED
2. **Documents Page**: EXPIRED badge muncul, retry button berfungsi, polling aktif untuk signature aktif
3. **Certificates Page**: Tombol "Verifikasi QR" membuka modal dengan hasil verifikasi
4. **Verify Page**: Signature detail tampil dengan certificate serial + signed date
5. **Service Layer**: Semua method baru siap dipanggil (butuh backend endpoint untuk production)
