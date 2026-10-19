# EMR PT Layar Nusantara Gas — Kodein Klinik (Frontend)

Frontend **Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind 4** untuk
Electronic Medical Record (EMR) PT Layar Nusantara Gas.

Aplikasi ini adalah **klien API**: seluruh data klinis, master data, dan audit log berasal
dari backend (`NEXT_PUBLIC_API_URL`). Tidak ada basis data, tidak ada mock server, dan tidak
ada data pasien yang disimpan di repo ini.

> **Status repo:** frontend sudah terhubung ke backend REST yang ada. Otorisasi sesungguhnya
> tetap ditegakkan di server; permission frontend hanya mengatur tampilan/UX (lihat
> [ACCESS_ARCHITECTURE.md](./ACCESS_ARCHITECTURE.md)).

---

## 1. Fitur yang tersedia

| Modul | Halaman | Ringkas |
|---|---|---|
| Autentikasi | `/login` | Login + MFA (TOTP/OTP) ke `POST /api/v1/auth/*`, sesi dipulihkan dari cookie `kodein-klinik-store` |
| Dashboard | `/dashboard` | Ringkasan sesuai role efektif |
| MPI / Registrasi | `/people`, `/people/new`, `/people/:id` | Daftar pekerja, wizard registrasi 5 langkah (identitas → penempatan → kontak → dokumen → consent), MRN otomatis dari backend, cek duplikat, consent digital |
| MCU & FTW | `/mcu`, `/mcu/new`, `/mcu/review` | Siklus MCU, assessment FTW, reminder bertahap (H-30/H-14/H-7/Hari-H/Overdue) |
| Klinik | `/visits`, `/visits/new`, `/visits/queue` | Antrean, registrasi kunjungan, status kunjungan |
| Rekam medis | `/medical-records` | SOAP (draft → finalize → **dokumen terkunci**), addendum untuk koreksi setelah lock |
| Farmasi | `/medicine`, `/medicine/dispense`, `/medicine/return` | Inventaris, dispensing FEFO, retur obat |
| Sertifikat | `/certificates` | Penerbitan/pencabutan sertifikat + permintaan tanda tangan PSrE |
| Status kepatuhan | `/health-status` | FTW/restriction, tahapan reminder, panel eskalasi (`POST /admin/escalation/run-check`) |
| Laporan | `/reports` | Agregat kepatuhan (MCU/kunjungan/dispensing/diagnosis), ekspor PDF |
| Waiver visitor | `/waiver` | Pembuatan waiver, kirim consent, keputusan Setuju/Tolak dengan konfirmasi & jejak audit |
| HSE / D&A | `/da` | Drug & Alcohol test |
| Emergency | `/emergency` | Mode darurat |
| IAM | `/users`, `/audit-logs` | Kelola pengguna & role, audit log (read-only) |
| Master data | `/master-data` | Perusahaan, departemen, lokasi (tambah/ubah/nonaktifkan) |
| Lab & Radiologi | `/lab` | Input/verifikasi hasil lab & radiologi |
| Notifikasi | (bell di shell) | Daftar notifikasi + tandai terbaca |
| Publik | `/public/consent/:token`, `/verify/:token` | Halaman consent publik (tanpa login) |
| Demo | `/demo` | Simulasi role UI (bukan otorisasi) |

---

## 2. Menjalankan

### Prasyarat

- Node.js ≥ 20 (dibangun & diuji pada Node 24)
- Backend EMR berjalan dan dapat diakses (prefix `/api/v1`)

### Konfigurasi

```bash
cp .env.example .env.local
# wajib: URL absolut API backend (tanpa trailing slash)
NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
```

`NEXT_PUBLIC_API_URL` **wajib diisi**. Bila kosong/tidak valid, build production menampilkan
pesan konfigurasi yang jelas di UI dan **menolak mengirim request** — tidak ada fallback
`localhost` yang diam-diam. Tidak ada secret di variabel `NEXT_PUBLIC_*` (nilainya ter-inline
ke bundle browser).

### Development

```bash
npm install
npm run dev          # http://localhost:3000
```

### Production build

```bash
npm run build
npm start
```

### Typecheck & lint

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

---

## 3. Menjalankan test

### Unit & integration (Vitest)

```bash
npm run test         # sekali jalan
npm run test:watch   # mode watch
```

Cakupan: registry RBAC, konsistensi tiga lapis (navigasi/route/aksi), route guard, action
registry, matriks permission proposal, tahapan reminder MCU, konsistensi store, error
mapping, environment, dan layanan API.

### E2E browser — alur mutasi (Playwright)

```bash
npm run test:e2e:playwright
```

Perintah ini menjalankan build produksi lokal (`next build && next start` pada port 3111),
lalu menjalankan 6 alur mutasi (21 skenario) memakai mock API **di dalam browser**. Tidak
perlu backend, tidak pernah menyentuh produksi.

| Alur | Berkas |
|---|---|
| Registrasi pekerja | `e2e/playwright/registration.spec.ts` |
| SOAP (draft → finalize → lock) | `e2e/playwright/soap.spec.ts` |
| Dispense obat (FEFO + stok) | `e2e/playwright/dispense.spec.ts` |
| Retur obat | `e2e/playwright/return.spec.ts` |
| Waiver visitor (Setuju/Tolak) | `e2e/playwright/waiver.spec.ts` |
| Master data (tambah/ubah/nonaktifkan) | `e2e/playwright/master-data.spec.ts` |

Variabel lingkungan:

| Variabel | Default | Keterangan |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:3111` | Base URL aplikasi yang diuji |
| `E2E_PORT` | `3111` | Port server yang dijalankan Playwright |
| `E2E_CHROME_PATH` | — | Path executable Chrome/Chromium bila `channel: chrome` tidak tersedia |

### E2E browser — smoke & kontrak (runner lama)

```bash
npm run test:e2e:frontend             # mode ui-only (tanpa backend)
npm run test:e2e:frontend:contract    # mode contract (mock network)
```

Runner lama (`e2e/*.mjs`) memakai `playwright-core` langsung dan menghasilkan laporan JSON
di `test-artifacts/`.

---

## 4. Route per role

Permission per role adalah sumber kebenaran tunggal di [`lib/rbac.ts`](./lib/rbac.ts).
Matriks lengkap (dihasilkan otomatis) ada di [ROLE_MAPPING.md](./ROLE_MAPPING.md).

| Route | Permission | admin | hr | lab | admin-klinik | dokter-oh | apoteker | hse | manajemen | perawat | pekerja |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `/dashboard` | `view-dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/people`, `/employees` | `manage-employees` | — | ✓ | — | ✓ | — | — | — | — | — | — |
| `/mcu` | `view-mcu` | — | — | — | — | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `/mcu/review` | `review-mcu` | — | — | — | — | ✓ | — | — | — | — | — |
| `/mcu/new` | `create-mcu` | — | — | — | — | — | — | — | — | ✓ | — |
| `/visits`, `/visits/queue` | `view-visits` | — | — | — | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ |
| `/visits/new` | `register-patient` | — | — | — | ✓ | — | — | — | — | ✓ | — |
| `/medical-records` | `view-clinical-notes` | — | — | — | — | ✓ | — | — | — | ✓ | — |
| `/medicine` | `manage-stock` | — | — | — | — | — | ✓ | — | — | — | — |
| `/medicine/dispense`, `/medicine/return` | `dispense-medicine` | — | — | — | — | — | ✓ | — | — | — | — |
| `/certificates` | `issue-certificate` | — | — | — | — | ✓ | — | — | — | — | — |
| `/reports` | `view-reports` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/health-status` | `view-health-status` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/waiver`, `/da` | `manage-hse` | ✓ | — | — | — | — | — | ✓ | — | — | — |
| `/emergency` | `view-emergency` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/users` | `manage-users` | ✓ | — | — | — | — | — | — | — | — | — |
| `/master-data` | `manage-master-data` | ✓ | — | — | — | — | — | — | — | — | — |
| `/audit-logs` | `view-audit-logs` | ✓ | — | — | — | — | — | — | — | — | — |
| `/lab` | `input-lab-result` | — | — | ✓ | — | ✓ | — | — | — | — | — |
| `/my/*` | `view-profile` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Aturan penting:

- **System Administrator (`admin`)** — konfigurasi sistem, kelola user & role, audit log
  (read-only), monitoring. **Tidak ada akses data klinis** (MCU, catatan klinis, diagnosis,
  farmasi/dispense) maupun data pekerja.
- **HR/PIC (`hr`)** — data pekerja + status kepatuhan. Tidak mengelola user/master data,
  tidak melihat detail medis.
- **Analis Lab/Radiolog (`lab`)** — hanya data penunjang. Tidak punya akses MCU penuh.
- **Admin Klinik (`admin-klinik`)** — registrasi, antrean, entri berobat luar klinik. Kolom
  klinis (keluhan utama, diagnosis) pada daftar kunjungan disembunyikan di UI.

Pembatasan berlaku di **tiga lapis**: menu navigasi (route yang tidak berizin tidak muncul),
route guard (halaman menampilkan **Akses Ditolak**, tanpa redirect otomatis), dan aksi
(tombol/aksi disembunyikan atau dinonaktifkan beserta alasannya).

---

## 5. Struktur proyek

```
app/                      # App Router (route + halaman)
  (app)/                  # shell internal: login wajib + route guard
  login/ public/ verify/  # route publik (tanpa sesi)
components/               # shell, route guard, access denied, komponen UI
lib/                      # rbac (permission), actions, store, types, service wrapper
src/lib/                  # env, api-client, navigation, service per domain, util
src/features/             # fitur domain (people, mcu)
src/shared/               # util & komponen lintas fitur
e2e/                      # runner E2E lama (.mjs)
e2e/playwright/           # E2E alur mutasi (Playwright test)
scripts/                  # generator dokumentasi & skrip E2E lama
```

---

## 6. Dokumentasi lain

| Berkas | Isi |
|---|---|
| [ROLE_MAPPING.md](./ROLE_MAPPING.md) | Matriks permission per role — **dihasilkan otomatis** dari kode |
| [ACCESS_ARCHITECTURE.md](./ACCESS_ARCHITECTURE.md) | Arsitektur akses: registry permission, guard, navigasi, middleware |
| [LAPORAN_A1_STABILISASI_FASE2_4.md](./LAPORAN_A1_STABILISASI_FASE2_4.md) | Laporan Fase A1 (perubahan permission, alur, E2E, blocker) |

Regenerasi matriks role:

```bash
node scripts/generate-role-matrix.mjs
```

---

## 7. Batasan yang diketahui

1. **Otorisasi tetap di backend.** Permission frontend hanya menyembunyikan menu, menolak
   route, dan menyembunyikan aksi. Bila backend ternyata mengizinkan akses yang lebih luas
   dari tabel di atas, itu adalah **blocker backend** (lihat laporan A1).
2. **Reminder MCU dihitung di frontend** dari `valid_until` yang dikirim backend. Backend
   belum menyediakan field "tahap reminder" maupun "level eskalasi" per record, dan belum
   ada endpoint untuk membaca konfigurasi eskalasi → **blocker backend**.
3. **Pemeriksaan duplikat** memakai `GET /patients?search=`. Endpoint list hanya
   mengembalikan identifier yang sudah dimasking, sehingga pencocokan NIK bergantung pada
   perilaku pencarian server → **blocker backend**.
4. **`/medical-records` memakai id antrean sebagai id encounter.** Endpoint `GET /clinic/queues`
   mengembalikan id ticket antrean, sedangkan SOAP/finalize/addendum memerlukan `encounter_id`
   → **blocker backend** (butuh endpoint daftar encounter atau field `encounter_id`).
5. **Data seed lokal (`lib/seed.ts`) masih dipakai sebagai state awal store**, tetapi
   halaman-halaman yang menampilkan data klinis/kepatuhan sudah mengambilnya dari API.
   Halaman yang masih menampilkan nilai seed harus diaudit sebelum produksi.
6. **Tidak ada sinkronisasi offline penuh.** Antrean aksi lokal (`lib/offline-queue.ts`)
   masih berupa antrean di memori/localStorage, belum memakai IndexedDB.
7. **Audit log bersifat read-only di UI** — frontend tidak menyediakan aksi ubah/hapus
   (sesuai proposal), dan backend juga melarangnya.
8. **E2E Playwright memakai mock API di dalam browser.** E2E ini membuktikan perilaku
   frontend, bukan integrasi dengan backend nyata. Rantai integrasi nyata diuji oleh
   runner `e2e/*.mjs` (mode `business`) yang memerlukan `E2E_API_URL` backend sungguhan.
