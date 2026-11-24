# HANDOFF FRONTEND → STAGING (Fase 9)

Dokumen serah-terima untuk tim staging/QA. Lingkup: **frontend only**.
Tidak ada perubahan backend, Prisma, migration, provider PSP, queue, storage,
Docker, deployment, atau secret.

- **Baseline**: `173834e6dddf8a3a44336995838a7b867767e8af`
- **Repo**: `frontend-LNGxKodeintekno` (`main`)
- **Build tool**: Next.js `16.4.6`, React `19.2.8`, Node `24.x`

---

## 1. Yang sudah diverifikasi (mock/browser, bukan provider live)

| Area | Status | Bukti |
|------|--------|-------|
| TTE request/status/retry/download | PASS (contract) | `test:e2e:frontend:contract` — 85/85 |
| QR public verification (7 state) | PASS (contract) | TTE-14 VERIFIED/NOT_SIGNED/INVALID/EXPIRED/REVOKED/INVALID_OR_EXPIRED/unknown |
| RBAC route & action | PASS | TTE-15 + `test:roles` |
| Responsive login/verify/consent | PASS | `test:e2e:frontend` 37/37 (360×800…1440×900) |
| Responsive TTE 390×844 | PASS (contract) | status terminal & retry diuji pada viewport mobile |
| Accessibility (axe critical/serious) | PASS | 33 route/state, 0 violation gate |
| Keyboard flow (login → SOAP → wizard) | PASS | 24/24 |
| Kontras & raw colors | PASS | 136/136 token kontras; 0 raw color |
| Typecheck / lint / unit / build | PASS | lihat laporan Fase 9 |
| Security bundle scan | PASS | tidak ada `PSP_*`, callback secret, API key di `.next/static` |
| Production dependency audit | PASS | `npm audit --omit=dev` → 0 |

**Semua bukti di atas memakai mock `frontend-contract-test`.** Tidak ada
provider PSP nyata yang dipanggil.

## 2. Yang BELUM diverifikasi (blocker)

```
BLOCKED — BACKEND/PROVIDER/INFRASTRUCTURE DEPENDENCY
```

1. **Staging E2E dengan backend nyata** — belum dijalankan karena backend staging
   tidak disediakan pada sesi ini. Jalankan dengan:
   ```bash
   E2E_BASE_URL=https://<frontend-staging> \
   E2E_API_URL=https://<backend-staging>/api/v1 \
   npm run test:e2e:frontend -- --mode=business
   ```
   Mode `business` akan **gagal/`BLOCKED`** bila backend tidak tersedia — tidak
   ada fake green.
2. **Kontrak OpenAPI backend terbaru** (pasca PSP Gateway) belum tersedia untuk
   verifikasi frontend. Lihat `CONTRACT_DELTA_TTE_FRONTEND.md` §7.
3. **Provider PSP live** (PRIVY/PSrE) — belum diuji. Callback/HMAC tetap
   backend-only; frontend tidak memiliki/mengirim secret.
4. **Respons biner signed PDF** — backend saat ini diasumsikan mengembalikan URL;
   jalur biner belum terbukti sehingga validasi `%PDF-` belum diaktifkan.
5. **Performance lapangan (LCP/INP/CLS/TTFB)** — tidak diukur dengan tool
   performance pada sesi ini (`NOT RUN`). First-load JS dapat dibaca dari output
   `next build`.
6. **Status CANCELLED / EXPIRED / REVOKED terpisah** — mapping UI siap, tetapi
   backend dilaporkan masih memakai `INVALID_OR_EXPIRED` gabungan.

## 3. Konfigurasi yang dibutuhkan staging

Frontend hanya membutuhkan URL API publik:

```bash
NEXT_PUBLIC_API_URL=https://<backend-staging>/api/v1
```

**Jangan** menaruh `PSP_API_KEY`, `PSP_CALLBACK_SECRET`, atau bearer token
provider di environment frontend. Frontend tidak memanggil provider secara
langsung.

## 4. Smoke test manual yang disarankan di staging

Gunakan akun Dokter OH (satu-satunya role dengan `issue-certificate`):

1. `/documents` → pilih dokumen → **Request TTE** → periksa metadata dan
   peringatan provider → konfirmasi.
2. Amati badge `PENDING`/`PROCESSING`; biarkan polling berjalan; pindah tab →
   polling berhenti; kembali → refresh manual.
3. Setelah `SIGNED`, klik **Unduh Signed PDF**; pastikan berkas berasal dari
   backend dan bukan URL provider langsung.
4. Status `FAILED`/`EXPIRED` → **Retry** → pastikan dialog menyebut request baru
   dan ID ditampilkan termasking.
5. `/certificates` → **Terbitkan** → konfirmasi → verifikasi QR pada sesi yang
   sama; refresh halaman → tombol verifikasi QR tidak lagi tersedia (token mentah
   memang tidak dipersist).
6. `/verify/<token>` di jendela privat: uji valid, tidak valid, kedaluwarsa;
   pastikan token tidak tampil di UI/judul/console.
7. Login role tanpa izin (HR/HSE/manajemen) → buka `/documents` langsung →
   harus **AccessDenied** tanpa request data.
8. **Farmasi (di luar TTE):** Apoteker → `/medicine/dispense` → dispense satu
   resep → buka `/medicine/return` lewat sidebar (navigasi client-side) →
   pilih batch, isi jumlah & alasan → retur tercatat. Riwayat retur berasal dari
   snapshot sesi (`DispensingGuard`); hard refresh memang mengosongkannya karena
   backend belum menyediakan `GET /pharmacy/dispensing/history`.

## 5. Catatan keamanan

- Tidak ada secret PSP di bundle (dipindai).
- Tidak ada HMAC callback di browser.
- Token QR hanya di memori; store v2 membuang `qrToken` lama dari localStorage.
- URL unduhan divalidasi (skema, credential, http non-local ditolak).
- Pesan backend/provider tidak diteruskan mentah ke UI.
- ID request pada retry ditampilkan termasking.
- `/my/certificates` tidak lagi menautkan `token_hash` sebagai token verifikasi.

## 6. Perintah quality gate

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:contrast
npm run test:raw-colors
A11Y_BASE_URL=http://localhost:3311 npm run test:a11y
A11Y_BASE_URL=http://localhost:3311 npm run test:a11y:keyboard
E2E_BASE_URL=http://localhost:3311 npm run test:e2e:frontend
E2E_BASE_URL=http://localhost:3311 npm run test:e2e:frontend:contract
npm run test:e2e:playwright
ROLE_BASE_URL=http://localhost:3311 npm run test:roles
```

## 7. Next action

1. Sediakan OpenAPI backend terbaru → verifikasi ulang §1.4/§1.5 dan aktifkan
   validasi payload bila respons biner didukung.
2. Jalankan smoke test staging di atas dengan backend + provider sandbox.
3. Ukur performa dengan Lighthouse/WebPageTest di staging.
4. Baru setelah itu status dapat dinaikkan dari **PARTIAL** menjadi **staging
   ready**.
