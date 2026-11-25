# Laporan Kesiapan Integrasi Final — Frontend Kodein Klinik

Tanggal: 25 November 2026
Repo: `frontend-LNGxKodeintekno`
Stack: Next.js 16.4.6 (App Router, Turbopack) · React 19 · TypeScript strict · Zustand · `idb` · Service Worker native

Dokumen ini menggantikan asumsi "100% selesai" dengan **status yang dapat diaudit**.
Setiap klaim di bawah disertai perintah pembuktian atau ditandai sebagai pekerjaan
yang masih tertahan.

---

## 1. Ringkasan status

| Area | Status | Keterangan singkat |
|---|---|---|
| Emergency Mode / antrean offline | ✅ Selesai | IndexedDB (`idb`), migrasi data lama, sinkronisasi otomatis, incident report |
| PWA (service worker + manifest + fallback offline) | ✅ Selesai & teruji browser | `public/sw.js`, `/offline`, header no-cache, verifikasi Playwright |
| Integrasi API nyata | ✅ Sudah ada (bukan mock) | `src/lib/api-client.ts` memakai `NEXT_PUBLIC_API_URL`, tanpa fallback localhost |
| Penanganan blocker backend | ⚠️ Sebagian | UI menampilkan alasan/disabled, bukan data dummy; beberapa endpoint belum ada |
| Upload dokumen via presigned URL | ❌ Belum | Backend belum menyediakan endpoint presign; UI menolak memalsukan upload |
| Kredensial demo di source | ✅ Bersih | Quick-login hanya aktif bila `NEXT_PUBLIC_ENABLE_DEMO=true` + `NEXT_PUBLIC_DEMO_PASSWORD` |
| Data seed klinis di store | ✅ Bersih | State awal kosong bila `NEXT_PUBLIC_ENABLE_DEMO` bukan `true`; seed hanya dimuat pada mode demo eksplisit (R-1 selesai) |
| TTE | ⚠️ Alur siap, provider sandbox | Request → polling → update dokumen sudah utuh di `src/features/tte` |
| Unit/integration test | ✅ 0 gagal | `npm run test` |
| Playwright E2E terhadap backend staging | ❌ Belum | Spec lama sengaja mock; spec offline baru tidak butuh backend |
| UAT offline 48 jam | ❌ Belum dijalankan | Tidak dapat diklaim tanpa eksekusi nyata; prosedur tersedia di §7 |

---

## 2. Perubahan yang dibuat

### 2.1 Lapisan offline baru

| File | Isi |
|---|---|
| `src/lib/offline/offline-db.ts` | Skema IndexedDB `kodein-emr-offline`: object store `outbox` (record klinis) + `meta` (device terdaftar, penanda migrasi). Termasuk migrasi sekali dari antrean `localStorage` lama dan pemulihan record `syncing` yang tertinggal. |
| `src/lib/offline/sync-engine.ts` | `flushOfflineQueue()`: registrasi perangkat → `POST /sync/push` → status **per item**. `startOfflineAutoSync()`: sinkron saat `online`, saat tab terlihat, dan tiap 60 detik. Panggilan paralel berbagi satu promise (mencegah double-push/double-dispensing). Konflik & kegagalan permanen ditulis sebagai Incident Report di audit log. |
| `src/lib/offline/__tests__/offline-sync.test.ts` | 9 test: penyimpanan, status, pemulihan `syncing`, pembersihan, migrasi legacy, klasifikasi status push. |

Prinsip yang dijaga:
- **Tidak ada status sukses palsu.** Record hanya `synced` jika backend
  mengembalikan status sukses untuk `localRecordId` tersebut.
- **Tidak ada kehilangan data.** Item yang ditolak tetap di antrean
  (`pending`/`failed`) dan dapat dicoba ulang; tidak ada pengosongan massal.
- **Tidak ada PHI di log/cache HTTP.** Payload tidak pernah di-`console.log`;
  service worker tidak meng-cache `/api/*`, non-GET, atau URL ber-query.

### 2.2 PWA

| File | Isi |
|---|---|
| `public/sw.js` | Precache `/offline` + manifest + ikon; navigasi network-first dengan fallback cache; aset `/_next/static` cache-first; API tidak di-cache. |
| `app/offline/page.tsx` | Halaman fallback mandiri (tanpa store/backend). |
| `src/components/pwa-provider.tsx` | Registrasi SW + start auto-sync + toast hasil sinkronisasi. |
| `app/layout.tsx` | Mount `PwaProvider`. |
| `next.config.ts` | Header `/sw.js`: `no-store` + `Service-Worker-Allowed: /`. |
| `lib/public-paths.ts`, `proxy.ts` | `/offline` publik; `/sw.js` dilewatkan proxy (sebelumnya request SW akan di-redirect ke `/login`). |
| `src/lib/env.ts` | `getDefaultSiteCode()`, `isServiceWorkerEnabled()` (satu-satunya pembaca env publik, sesuai audit). |

### 2.3 Perbaikan bug data loss

`app/(app)/offline-sync/page.tsx` sebelumnya mengosongkan **seluruh** antrean
localStorage setelah push, termasuk item yang ditolak backend. Sekarang
memakai `flushOfflineQueue()` dan menampilkan hitungan per status.

`app/(app)/emergency/page.tsx` sebelumnya memakai `INITIAL_QUEUE` berisi data
pasien fiktif dan menyimpan antrean hanya di state React (hilang saat tab
ditutup). Sekarang seluruh antrean berasal dari IndexedDB; tidak ada data contoh.

### 2.4 Final cleanup data demo & persistensi

| File | Isi |
|---|---|
| `lib/store.ts` | `createInitialClinicalData()`: state klinis awal `[]` kecuali `NEXT_PUBLIC_ENABLE_DEMO=true`. Persist v3 hanya menyimpan sesi/scope/`users`/`offlineQueue`; migrasi v3 menghapus entri klinis lama dari localStorage. |
| `app/login/login-page-content.tsx` | Hint OTP demo `123456` dan catatan data fiktif hanya dirender saat demo mode aktif. Quick-login tetap digating `NEXT_PUBLIC_ENABLE_DEMO` + `NEXT_PUBLIC_DEMO_PASSWORD`. |
| `src/lib/__tests__/store.test.ts`, `auth-store.test.ts`, `referral.service.test.ts` | Fixture lokal per file; tidak lagi bergantung pada injeksi seed global. |

---

## 3. Definition of Done (status jujur)

- [x] Antrean offline tidak lagi memakai localStorage sebagai penyimpanan utama.
- [x] Data formulir (vital sign, SOAP draft, dispensing, catatan darurat) tersimpan di IndexedDB.
- [x] Migrasi otomatis antrean localStorage lama (sekali, tanpa menghapus sumber).
- [x] Sinkronisasi otomatis saat `navigator.onLine` kembali `true`.
- [x] Status per item dari backend menentukan `synced`/`conflict`/`failed`.
- [x] Incident Report konflik/kegagalan tercatat di audit log.
- [x] Service worker mem-precache halaman fallback; aplikasi dapat dibuka offline.
- [x] Request API tidak pernah masuk cache service worker.
- [x] Anggota tim tidak perlu lagi "menunggu data" untuk field yang tidak dikirim backend — UI menampilkan alasan eksplisit (sudah ada sebelumnya, diverifikasi ulang).
- [x] Tidak ada kredensial demo hardcoded di `app/login/login-page-content.tsx`.
- [x] `npm run typecheck` = 0 error.
- [x] `npm run lint` pada file yang diubah = 0 error.
- [x] `npm run test` = seluruh test lulus.
- [x] `next build` berhasil.
- [x] Playwright membuktikan `/offline` berfungsi saat jaringan dimatikan.
- [ ] **Upload dokumen via presigned URL** — tertahan backend (R-2).
- [ ] **Playwright happy-path terhadap backend staging nyata** — tertahan (R-3).
- [ ] **UAT simulasi offline 48 jam** — belum dijalankan (R-4).
- [x] **Penghapusan total data seed klinis dari store** — state awal `[]` bila demo nonaktif; seed hanya dimuat lewat `NEXT_PUBLIC_ENABLE_DEMO=true` (R-1 selesai).

---

## 4. Deployment frontend ke staging

```bash
# 1. Instalasi bersih
npm ci

# 2. Environment (jangan commit)
cat > .env.production.local <<'EOF'
NEXT_PUBLIC_API_URL=https://api-staging.example.com/api/v1
NEXT_PUBLIC_SITE_CODE=SITE-PLANT-01
NEXT_PUBLIC_ENABLE_DEMO=false
NEXT_PUBLIC_APP_VERSION=$(git rev-parse --short HEAD)
# NEXT_PUBLIC_ENABLE_SW=true   # hanya jika ingin menguji SW di `next dev`
EOF

# 3. Build + jalankan
npm run build
npm run start   # default :3000

# 4. Syarat PWA
#    - HTTPS wajib (kecuali localhost) agar service worker terdaftar.
#    - Pastikan CDN/reverse proxy TIDAK meng-cache /sw.js
#      (header no-store sudah dikirim aplikasi).
```

Checklist setelah deploy:
1. Buka DevTools → Application → Service Workers: status **activated and is running**.
2. Application → Manifest: nama, ikon 192/512, `start_url` terbaca.
3. Network → Offline, lalu reload: halaman `/offline` tampil (bukan layar error browser).
4. Buka `/emergency`, simpan catatan, tutup tab, buka lagi saat offline: catatan masih ada.
5. Online-kan jaringan: catatan berpindah ke `Tersinkron` dan muncul di audit log.

---

## 5. Instruksi verifikasi (lokal, dapat dijalankan reviewer)

```bash
# Type & lint
npm run typecheck
npm run lint

# Unit + integration (termasuk offline DB, PWA asset consistency)
npm run test

# Bukti browser: SW aktif + /offline saat jaringan mati
E2E_CHROME_PATH="/c/Program Files/Google/Chrome/Application/chrome.exe" \
  npx playwright test --config=playwright.config.ts e2e/playwright/offline-mode.spec.ts

# Uji manual antrean IndexedDB (DevTools Console di halaman /emergency)
#   indexedDB.open("kodein-emr-offline")  → store "outbox" berisi record pending
```

Hasil eksekusi pada sesi ini:

| Perintah | Hasil |
|---|---|
| `npx tsc --noEmit` | 0 error |
| `npx eslint` | 0 error |
| `npx vitest run` | 64 file lulus, 1 skip; 834 test lulus, 21 skip, 0 gagal |
| `npx next build` | sukses; `/offline` & `/offline-sync` ter-render statis |
| Playwright `offline-mode.spec.ts` | 2/2 lulus (SW mengontrol halaman; reload saat offline menampilkan `/offline`; `/sw.js` `no-store`) |

---

## 6. Endpoint backend yang masih wajib disediakan sebelum Go-Live

| # | Kebutuhan | Endpoint yang diharapkan | Dampak bila tidak ada |
|---|---|---|---|
| 1 | Upload berkas (presigned URL) | `POST /documents/presign` → `{ uploadUrl, objectKey, headers }` lalu konfirmasi metadata | Lampiran MCU/D&A/radiologi tidak dapat disimpan; UI saat ini menonaktifkan lampiran radiologi dan menandai dokumen registrasi sebagai "Lokal (demo)" — tidak ada base64 yang dikirim |
| 2 | Saran FTW | `suggested_ftw_status` pada assessment | Dokter memilih FTW manual; UI tidak menampilkan saran |
| 3 | Penanda perburukan | field deviasi pada assessment MCU | Tidak ada badge perburukan; tidak crash |
| 4 | Hasil lab terstruktur | `GET /diagnostic/lab-results` | Hasil lab diinput manual per order |
| 5 | Restriksi: ubah/hapus/akhiri | `PATCH/DELETE /mcu/restrictions/:id`, `POST .../close` dengan catatan | Aksi dinonaktifkan dengan tooltip alasan |
| 6 | Receive sample lab | endpoint status sampel | Tombol dinonaktifkan |
| 7 | Registrasi kunjungan tanpa SOAP | operasi antrean tanpa keluhan/vital sign | Halaman menampilkan BLOCKER BACKEND |
| 8 | Sinkronisasi offline | `POST /sync/register-device`, `POST /sync/push`, `GET /sync/conflicts`, `POST /sync/conflicts/:id/resolve` | **Wajib**: tanpa ini antrean offline tidak dapat dikirim |
| 9 | TTE provider | endpoint request/status signature (sudah dipetakan di `document.service.ts`) | Alur polling berhenti dengan status jelas |
| 10 | Waiver/MCU & vendor PSrE sandbox | kontrak sesuai `CONTRACT_DELTA_TTE_FRONTEND.md` | Fitur tertahan |

---

## 7. Prosedur UAT offline 48 jam (belum dijalankan)

Tidak ada screenshot 48 jam di dokumen ini karena simulasi tersebut belum
diekesekusi. Langkah yang harus dilakukan tim QA:

1. Build staging, pasang PWA ke perangkat (Chrome/Edge desktop atau Android).
2. Matikan jaringan perangkat selama 48 jam; lakukan minimal:
   - 20 catatan darurat, 10 vital sign, 5 draft SOAP, 5 dispensing.
3. Setiap 6 jam: tutup dan buka ulang aplikasi; pastikan jumlah antrean tetap.
4. Setelah 48 jam, nyalakan jaringan; catat waktu hingga antrean `pending = 0`.
5. Ambil tangkapan layar: DevTools → Application → IndexedDB (`outbox`),
   halaman `/emergency` sebelum & sesudah sinkron, serta audit log incident.
6. Simpan hasil sebagai lampiran; perbarui checklist §3.

Kriteria lulus: tidak ada record hilang, tidak ada duplikasi (idempotensi
`localRecordId`), konflik tercatat, dan aplikasi tetap dapat dibuka saat offline.

---

## 8. Risiko & pekerjaan lanjutan

~~**R-1 — Data seed klinis masih menjadi state awal store.**~~ **SELESAI (25 Nov 2026).**
`lib/store.ts` kini memakai `createInitialClinicalData()`: seluruh koleksi klinis
(`users`, `employees`, `visits`, `mcus`, `certificates`, `auditLogs`, dll.)
berisi `[]` kecuali `NEXT_PUBLIC_ENABLE_DEMO=true`. `lib/seed.ts` tetap ada
untuk demo lokal tetapi terisolasi dari build production. Test yang sebelumnya
bergantung pada seed global kini memakai fixture lokal di dalam file test-nya.
Kredensial demo tidak lagi dirender di UI production (hint OTP demo ikut
digating `NEXT_PUBLIC_ENABLE_DEMO`).

**R-2 — Presigned upload.** Tidak diimplementasikan karena kontrak presign
belum ada; menebak endpoint akan menghasilkan kegagalan produksi. Saat backend
menyediakan kontrak, implementasi terpusat di
`src/features/people/api/document-upload.ts`.

**R-3 — E2E staging.** `playwright.config.ts` saat ini sengaja mem-mock API di
browser. Untuk happy-path nyata, tambahkan project terpisah dengan
`E2E_BASE_URL` staging + kredensial uji; jangan mengubah spec mock yang ada
karena dipakai untuk regresi UI tanpa backend.

**R-4 — UAT 48 jam** harus dijalankan pada perangkat nyata (lihat §7).

**R-5 — Sisa data non-klinis di localStorage.** Store persist (v3) kini hanya
menyimpan `currentUserId`, `session`, `orgScope`, `activeSiteId/Name`, `users`,
dan `offlineQueue`; seluruh data klinis/master dibuang dari persist dan entri
lama dihapus lewat migrasi v3. Antrean offline sementara tetap ditangani
IndexedDB (`src/lib/offline/offline-db.ts`). Pekerjaan lanjutan yang masih
terbuka: enkripsi at-rest untuk `offlineQueue` dan IndexedDB pada tahap
berikutnya (belum diimplementasikan).
