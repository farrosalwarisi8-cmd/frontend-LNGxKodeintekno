# Handoff Frontend TTE — Verifikasi Staging (FRONTEND ONLY)

Baseline frontend: `b4b70754c5859c2e45bd0e074b8ac54ce5cacdfe`
Branch kerja: `feat/tte-psp-gateway`
Dokumen terkait: `LAPORAN_FRONTEND_TTE_PSP_GATEWAY.md`

## 1. Status handoff

| Area | Status | Keterangan |
| --- | --- | --- |
| Kontrak & implementasi frontend | SIAP DIVERIFIKASI | Lihat contract matrix di laporan utama |
| Unit / contract test | PASS | 712 passed |
| Build produksi | PASS | Setelah retry notifikasi advisory Next.js 16.4.4 |
| Staging nyata | **BLOCKED** | `STAGING/PROVIDER BLOCKER` — tidak ada URL/credential staging di environment ini |
| Provider PSP live | **BLOCKED** | Callback diuji backend/test harness; frontend tidak mengirim callback |

**Jangan** mengubah status BLOCKED di atas menjadi PASS hanya karena mock browser `frontend-contract-test` berhasil.

---

## 2. Yang harus dikonfirmasi backend sebelum E2E staging

1. **OpenAPI aktif pasca commit `a3e134c`** — kirim `GET /docs-json` dari staging. Frontend perlu memastikan:
   - `POST /api/v1/signatures/request` masih menjadi path request TTE dan body masih `{ documentId, signatureType, providerCode? }`.
   - Apakah field PSP baru (request ID, account ID, PDF, email/nama, callback URL) **benar-benar** dikirim browser ke backend, atau hanya backend → provider. Frontend saat ini mengasumsikan yang terakhir sesuai arsitektur gateway.
   - Status yang benar-benar dikirim backend (`PENDING`, `PROCESSING`, `SIGNED`, `FAILED`, `EXPIRED`, `CANCELLED?`).
2. **`GET /api/v1/documents/:id/download`** — belum ada di snapshot OpenAPI Fase 6. Konfirmasi method, envelope (`{url, expiresIn}` vs `{downloadUrl}`), content type, dan masa berlaku URL.
3. **Verifikasi publik** — apakah status `EXPIRED`/`REVOKED` sudah dipisah, atau masih `INVALID_OR_EXPIRED`. Jika masih gabungan, UI sudah menampilkan state gabungan yang jujur.
4. **Permission** — frontend memetakan render/request/retry/download ke `issue-certificate` (satu-satunya izin yang terbukti). Jika backend membedakan permission, berikan daftar permission per operasi supaya guard UI bisa disesuaikan (jangan memperluas permission untuk menghilangkan 403).
5. **Provider callback** — diuji dari backend/staging test harness. Frontend tidak mengirim callback dan tidak memiliki secret.

---

## 3. Environment frontend yang dibutuhkan

Hanya variabel publik yang boleh dipakai:

```
NEXT_PUBLIC_API_URL=https://<backend-staging>/api/v1
```

Dilarang keras: `NEXT_PUBLIC_PSP_API_KEY`, `NEXT_PUBLIC_PSP_CALLBACK_SECRET`, `NEXT_PUBLIC_PROVIDER_PRIVATE_KEY`, atau secret provider lain. `PSP_BASE_URL`, `PSP_API_KEY`, `PSP_CALLBACK_SECRET`, `PSP_PROVIDER_CODE` tinggal di server backend.

---

## 4. Langkah verifikasi staging (setelah blocker selesai)

```bash
# 1. build & start frontend dengan API staging
NEXT_PUBLIC_API_URL=https://<backend-staging>/api/v1 npm run build
NEXT_PUBLIC_API_URL=https://<backend-staging>/api/v1 npx next start -p 3001

# 2. E2E contract browser (mock, label frontend-contract-test)
E2E_BASE_URL=http://localhost:3001 npm run test:e2e:frontend:contract

# 3. E2E staging nyata — BUTUH backend & provider
E2E_API_URL=https://<backend-staging>/api/v1 \
E2E_BASE_URL=https://<frontend-staging> \
npm run test:e2e:staging
```

Alur minimum yang harus dibuktikan di staging (bukan mock):

```
login role berizin (DOCTOR_OH)
→ render PDF
→ Request TTE (konfirmasi, satu POST)
→ PENDING → PROCESSING
→ callback diproses BACKEND (bukan browser)
→ SIGNED
→ download signed PDF (content type PDF, ≤ 15 MB, header %PDF-)
→ buka /verify/<qrToken> → VERIFIED, tanpa data klinis
```

---

## 5. Checklist verifikasi manual di staging

- [ ] Tombol Request TTE tidak mengirim request sebelum konfirmasi.
- [ ] Double-click hanya menghasilkan satu `POST /signatures/request`.
- [ ] Body request hanya `documentId`, `signatureType`, `providerCode?` — tidak ada secret/field PSP.
- [ ] Status PENDING/PROCESSING tampil, tombol download **tidak** muncul.
- [ ] Polling berhenti saat status terminal, tab hidden, atau route berubah.
- [ ] Retry meminta konfirmasi dan menampilkan request ID lama → baru.
- [ ] Download hanya saat `SIGNED`; URL berasal dari backend; respons bukan PDF ditolak.
- [ ] HTTP 401/403/404/409/413/415/422/429/502/504 menampilkan pesan aman, tanpa detail internal.
- [ ] `/verify/[token]`: valid, belum signed, invalid, expired/gabungan, revoked (bila tersedia), backend error, token kosong — semuanya berbeda dan tidak menampilkan token mentah atau data klinis.
- [ ] Role tanpa `issue-certificate` mendapat AccessDenied di `/documents`, `/signatures`, `/certificates`.
- [ ] Tidak ada secret provider di DevTools → Sources/Network/Console.

---

## 6. Bukti yang belum bisa dibuat di environment ini

- Tidak ada koneksi ke backend staging → `E2E staging = BLOCKED`.
- Tidak ada provider PSP/callback harness → `PROVIDER LIVE = BLOCKED`.
- `npm run test:a11y:keyboard` memakai login backend nyata → `BLOCKED (ENVIRONMENT BLOCKER)`.
- Signed URL/S3 production tidak tersedia (storage `local` menurut laporan staging lama) → validasi content type PDF setelah download belum bisa dibuktikan dengan file nyata; sudah diuji dengan mock payload di unit test.

---

## 7. Kontak / keputusan yang dibutuhkan

Tim backend: kirim OpenAPI staging terbaru + konfirmasi 5 poin di §2.
Tim infra/staging: sediakan `E2E_API_URL`, `E2E_BASE_URL`, akun `DOCTOR_OH` non-MFA, dan provider/PSP sandbox.
Tim frontend: setelah keduanya tersedia, jalankan §4 dan ubah status laporan akhir berdasarkan **bukti nyata**, bukan mock.
