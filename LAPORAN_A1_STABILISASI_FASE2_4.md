# LAPORAN A1 — Stabilisasi Fase 2–4 (EMR PT Layar Nusantara Gas)

**Fase:** A1 — Peran: engineer frontend
**Cakupan:** hanya repo frontend (`frontend-LNGxKodeintekno`). Tidak ada perubahan pada
backend, skema database, atau kontrak API.
**Baseline:** commit `8c619b5` ("frontend: optimasi performa HP & jaringan lemah")
**Commit A1:** `3fa7ec4` → `5ff171b` → `9d12b6d` → `d5f9732` → `57709f2`

---

## 1. Ringkasan

### Yang selesai

| # | Deliverable | Status |
|---|---|---|
| 1 | Matriks "permission saat ini" dibaca langsung dari kode (`lib/rbac.ts`), lalu dibandingkan dengan proposal | ✅ selesai |
| 2 | Permission admin/HR/lab/admin-klinik diperketat sesuai proposal | ✅ selesai |
| 3 | Pembatasan berlaku di 3 lapis (navigasi, route, aksi) | ✅ selesai |
| 4 | Unit test positif & negatif untuk setiap perubahan permission | ✅ 46 test baru |
| 5 | Waiver: konfirmasi Setuju/Tolak, state proses/sukses/gagal, pesan error jelas | ✅ selesai |
| 6 | Reminder MCU H-30/H-14/H-7/Hari-H/Overdue sebagai timeline + badge (teks & ikon) | ✅ selesai |
| 7 | Panel eskalasi memakai `POST /admin/escalation/run-check` | ✅ selesai |
| 8 | Empty state & error state untuk halaman terkait | ✅ selesai |
| 9 | Data demo/hardcoded yang bocor ke produksi dihentikan | ✅ 2 tempat |
| 10 | E2E Playwright untuk 6 alur mutasi (happy path, error, permission ditolak) | ✅ 21 skenario lulus |
| 11 | README ditulis ulang (narasi "frontend-only demo" dihapus) | ✅ selesai |
| 12 | ROLE_MAPPING.md dibuat dari kode + test penjaga (drift guard) | ✅ selesai |
| 13 | ACCESS_ARCHITECTURE.md disinkronkan | ✅ selesai |

### Yang **tidak** selesai / tidak dikerjakan

| # | Item | Alasan |
|---|---|---|
| 1 | Penegakan permission di sisi server | Di luar repo frontend → dicatat sebagai BLOCKER BACKEND (§5). |
| 2 | Halaman "Kelola API Key" & "Monitoring Sertifikat TTE" untuk System Administrator | **Belum ada endpoint backend** untuk kedua fitur tersebut; tidak ada mock yang dipura-pura bekerja → BLOCKER BACKEND §5.9–5.10. |
| 3 | E2E terhadap backend nyata | Backend tidak tersedia di lingkungan ini. E2E memakai mock API di dalam browser dan diberi label jelas (`frontend-contract-test` di runner lama). |
| 4 | Perbaikan hydration mismatch (React #418) pada route terproteksi | **Sudah ada sebelum A1** (dibuktikan di §2). Perbaikannya menyentuh SSR shell di luar lingkup permission/waiver/reminder → dicatat di §6.1 untuk dikerjakan terpisah. |
| 5 | Halaman audit log read-only untuk admin sudah ada (`/audit-logs`), tetapi aksi ubah/hapus memang tidak ada sama sekali (sesuai proposal "tidak bisa mengubah atau menghapus audit log") | Tidak ada perubahan yang diperlukan. |

---

## 2. Baseline vs hasil akhir

### 2.1 Typecheck & lint

| Pemeriksaan | Baseline | Sesudah A1 |
|---|---|---|
| `npm run typecheck` | bersih | bersih |
| `npm run lint` | 0 error, 9 warning | 0 error, 9 warning (warning yang sama, tidak ada tambahan) |

### 2.2 Unit / integration test (Vitest)

| Metrik | Baseline (`8c619b5`) | A1 di atas baseline | A1 di atas `origin/main` (hasil akhir) |
|---|---|---|---|
| Test file lulus | 28 | 31 | 39 (+1 di-skip) |
| Test file di-skip | 1 | 1 | 1 |
| **Test lulus** | **357** | **407** | **507** |
| Test di-skip | 19 | 19 | 21 |
| **Total test** | **376** | **426** | **528** |

Delta **A1** sendiri adalah **+50 test** (357 → 407). Angka 507/528 pada kolom terakhir
mencerminkan hasil akhir setelah A1 di-rebase **di atas** `origin/main`:additional ±100 test
milik tim remote ikut terbawa, bukan tambahan dari A1.

Test baru: `permission-proposal.test.ts` (23), `mcu-reminder.test.ts` (18), `role-mapping-doc.test.ts` (4),
plus penambahan pada `rbac.test.ts`, `actions.test.ts`, `navigation.test.ts`,
`rbac-consistency.test.ts`, `demo-role.test.ts`.

> Test lama yang gagal **karena permission diperketat** (bukan bug) telah diperbarui agar
> mencerminkan aturan proposal — tidak ada assertion yang dilonggarkan untuk membuat test hijau.
> Contoh: `actions.test.ts` "admin" sebelumnya menyatakan `canPerform("admin","mcu.approve") === true`;
> sekarang `false`.

### 2.3 E2E browser

| Suite | Baseline | Sesudah A1 | Catatan |
|---|---|---|---|
| **Playwright — alur mutasi (baru)** | — (tidak ada) | **21 PASS / 0 FAIL** | `npm run test:e2e:playwright`; setelah rebase, spec disesuaikan dengan UI `origin/main` (klik & isi form tetap sama) |
| Runner lama — mode `ui-only` | 37 PASS / 0 FAIL | 37 PASS / 0 FAIL | tidak ada regresi |
| Runner lama — mode `contract` | 45 PASS / **1 FAIL** | 45 PASS / **1 FAIL** | **gagal yang sama persis sebelum & sesudah A1** (hydratation, lihat §6.1) |

Bukti bahwa kegagalan `contract` bukan regresi: dengan kode **baseline** (`git checkout 8c619b5 -- .`)
lalu build ulang, hasil `contract` tetap `45 PASS / 1 FAIL` dengan error yang identik
(`React error #418` pada `contract-hse`, `contract-dr.hendra`, `contract-hr.pic`).

### 2.4 Rebase di atas `origin/main`

Saat push, `origin/main` ternyata **30 commit lebih baru** dari basis kerja A1 (termasuk
`41e706c fix: restore admin permissions` yang berlawanan dengan proposal, serta permission
sistem baru `manage-system-config` / `manage-api-keys` / `view-tte` / `monitor-emergency`).
Tidak ada force-push (history tim tidak dihapus). A1 di-rebase **di atas** `origin/main` dengan
resolusi konflik yang menggabungkan keduanya:

| Area | Keputusan resolusi |
|---|---|
| `lib/rbac.ts` | Permission sistem baru dari remote (`manage-system-config`, `manage-api-keys`, `view-tte`, `monitor-emergency`, `manage-da`) **dipertahankan**; policy A1 (admin tanpa klinis, HR tanpa user/master-data & view-mcu, lab tanpa view-mcu, admin-klinik tanpa klinis) **diterapkan**. |
| `lib/actions.ts` | Aksi `visits.call-ticket` (remote) dipertahankan; `visits.edit-soap` tetap multi-requirement. |
| `lib/remote-sync.ts` | Duplikat `mapWorkHealthStatus`/`syncWorkHealthStatus` milik A1 **dihapus** (remote sudah punya versi site-scoped); `syncDispensings` (A1) dipertahankan. |
| `app/(app)/medical-records/page.tsx` | Versi remote dipakai (sudah memanggil `saveSoap`, memuat encounter id, mode LOCKED + addendum) — superset perbaikan A1. |
| `app/(app)/visits/queue/page.tsx` | Versi remote dipakai — sudah tidak menampilkan kolom klinis sama sekali, sehingga perubahan A1 jadi tidak berlaku. |
| `app/(app)/health-status/page.tsx` | Versi remote (FTW dari API) + tambahan A1: badge tahapan reminder, garis waktu reminder, panel eskalasi. |
| `app/(app)/waiver/page.tsx` | Versi remote + tambahan A1: dialog konfirmasi Setuju/Tolak, hasil per baris, token dev hanya pada mode demo. |
| `components/route-guard.tsx` | Rule guard untuk `/system-config`, `/api-keys`, `/tte`, `/emergency-detail` (remote menambah menu tanpa guard → celah 3 lapis). |
| `README.md` | Versi A1 (rewrite) + section baru milik remote ("Skenario per peran", "Alur per peran (frontend)"). |

---

## 3. Tabel perubahan permission

Sumber: `lib/rbac.ts` (`ROLE_PERMISSIONS`). Semua role lain **tidak berubah**.

### 3.1 `admin` — System Administrator

Proposal: "konfigurasi sistem, kelola user dan role, buat/cabut API key, monitor sertifikat TTE
dan Emergency Mode. **Tidak punya akses data klinis**. Tidak bisa mengubah atau menghapus audit log."

| Permission | Sebelum | Sesudah | Alasan |
|---|---|---|---|
| `view-mcu` | ✓ | — | daftar MCU = data klinis |
| `view-visits` | ✓ | — | daftar kunjungan memuat keluhan utama (data klinis) |
| `view-clinical-notes` | ✓ | — | catatan klinis |
| `view-diagnosis` | ✓ | — | diagnosis |
| `approve-mcu` | ✓ | — | persetujuan MCU = tindakan klinis |
| `issue-certificate` | — | — | sudah tidak ada |
| `manage-stock` | ✓ | — | farmasi |
| `dispense-medicine` | ✓ | — | farmasi/dispense |
| `input-lab-result` | ✓ | — | data penunjang |
| `input-mcu-result` | ✓ | — | data klinis |
| `create-mcu` | ✓ | — | siklus MCU |
| `register-patient` | ✓ | — | registrasi klinis |
| `edit-visit` | ✓ | — | edit data kunjungan |
| `manage-employees` | ✓ | — | data pekerja bukan domain System Administrator |
| `upload-document` | ✓ | — | dokumen pekerja |
| `export-reports` | ✓ | — | ekspor = jalur keluarnya data laporan (tidak ada dalam daftar "Pertahankan") — **perlu konfirmasi manusia, lihat §6.3** |
| `manage-users` | ✓ | ✓ | dipertahankan |
| `manage-master-data` | ✓ | ✓ | dipertahankan |
| `view-audit-logs` | ✓ | ✓ | dipertahankan (read-only; tidak ada aksi ubah/hapus di UI) |
| `manage-hse` | ✓ | ✓ | dipertahankan |
| `view-reports` | ✓ | ✓ | dipertahankan |
| `view-health-status` | ✓ | ✓ | dipertahankan |
| `view-emergency` | ✓ | ✓ | dipertahankan |
| `view-dashboard`, `view-profile` | ✓ | ✓ | dipertahankan |

### 3.2 `hr` — HR/PIC

Proposal: "hanya status kepatuhan (MCU/FTW/restriction). Tidak boleh mengelola user dan master data.
Tidak melihat detail medis."

| Permission | Sebelum | Sesudah | Alasan |
|---|---|---|---|
| `manage-users` | — | — | sudah tidak ada di kode, tetap tidak ada |
| `manage-master-data` | — | — | sudah tidak ada di kode, tetap tidak ada |
| `view-mcu` | ✓ | — | HR hanya melihat **status kepatuhan**; daftar MCU penuh bukan halamannya |
| `view-visits` | ✓ | — | daftar kunjungan memuat keluhan utama = detail medis |
| `create-mcu` | ✓ | — | memulai pemeriksaan medis, bukan status kepatuhan |
| `manage-employees` | ✓ | ✓ | dipertahankan (data pekerja = domain HR) |
| `upload-document` | ✓ | ✓ | dipertahankan |
| `view-health-status` | ✓ | ✓ | dipertahankan (status kepatuhan) |
| `view-reports`, `export-reports` | ✓ | ✓ | dipertahankan; kartu klinis disembunyikan di `/reports` |
| `view-dashboard`, `view-emergency`, `view-profile` | ✓ | ✓ | dipertahankan |

### 3.3 `lab` — Analis Lab/Radiolog

Proposal: "hanya data penunjang (input/impor dan verifikasi hasil lab). Tidak punya akses data MCU penuh."

| Permission | Sebelum | Sesudah | Alasan |
|---|---|---|---|
| `view-mcu` | ✓ | — | tidak punya akses data MCU penuh |
| `input-lab-result` | ✓ | ✓ | dipertahankan (data penunjang) |
| `input-mcu-result` | ✓ | ✓ | dipertahankan (data penunjang) |
| `view-reports`, `view-health-status`, `view-dashboard`, `view-emergency`, `view-profile` | ✓ | ✓ | dipertahankan |

### 3.4 `admin-klinik` — Admin Klinik

Proposal (dari keputusan pemilik produk): registrasi, antrean, entri berobat luar klinik, tanpa data klinis.

| Permission | Sebelum | Sesudah | Alasan |
|---|---|---|---|
| `view-mcu` | ✓ | — | data klinis |
| `create-mcu` | ✓ | — | data klinis |
| `dispense-medicine` | ✓ | — | farmasi; role ini dipetakan ke backend `SYSTEM_ADMIN` |
| `manage-employees` | — | ✓ | registrasi pekerja |
| `upload-document` | — | ✓ | dokumen pekerja |
| `edit-visit` | — | ✓ | edit administratif/antrean |
| `view-visits`, `register-patient` | ✓ | ✓ | dipertahankan (antrean & registrasi) |
| `view-reports`, `view-health-status`, `view-emergency`, `view-profile`, `view-dashboard` | ✓ | ✓ | dipertahankan |

Catatan: `admin-klinik` **tidak** memakai aksi `visits.edit-soap`, karena aksi tersebut kini
memerlukan `edit-visit` **dan** `view-clinical-notes`.

### 3.5 Perubahan lain di lapisan akses

| Area | Sebelum | Sesudah |
|---|---|---|
| Aksi `visits.edit-soap` | 1 permission (`edit-visit`) | 2 permission (`edit-visit` + `view-clinical-notes`) — `canPerform` memakai `canAll` |
| Aksi baru | — | `visits.view-clinical`, `reports.view-mcu`, `reports.view-visits`, `reports.view-diagnosis`, `reports.view-pharmacy`, `escalation.run` |
| `/visits`, `/visits/queue` | kolom "Keluhan" selalu tampil | disembunyikan + pencarian tidak memakai keluhan utama bila role tidak punya `view-clinical-notes` |
| `/reports` | semua kartu klinis tampil untuk semua role | tiap kartu mengikuti izin sumber datanya |
| `/health-status` | data dari `lib/seed.ts` | data dari assessment FTW backend (`syncWorkHealthStatus`) |
| `/demo` | 4 token consent contoh selalu tampil | disembunyikan bila mode demo nonaktif (tidak ada data demo di produksi) |
| `/waiver` | panel uji alur publik + token dev selalu tampil | disembunyikan bila mode demo nonaktif |

---

## 4. Daftar alur E2E & statusnya

Command: `npm run test:e2e:playwright` (build produksi lokal + mock API di dalam browser).
Hasil akhir: **21 PASS / 0 FAIL**.

| # | Alur | Berkas | Skenario | Status |
|---|---|---|---|---|
| 1 | **Registrasi pekerja** | `e2e/playwright/registration.spec.ts` | wizard 5 langkah → MRN + consent terkirim | ✅ PASS |
| | | | identifier duplikat diblokir sebelum submit | ✅ PASS |
| | | | backend 500 saat create → pesan error, halaman sukses tidak tampil | ✅ PASS |
| | | | permission ditolak (Analis Lab → AccessDenied) | ✅ PASS |
| 2 | **SOAP** | `e2e/playwright/soap.spec.ts` | simpan draft → finalize → dokumen LOCKED (hanya addendum) | ✅ PASS |
| | | | backend 500 saat simpan SOAP → error, tidak ada finalisasi | ✅ PASS |
| | | | permission ditolak (HR/PIC → AccessDenied) | ✅ PASS |
| 3 | **Dispense obat** | `e2e/playwright/dispense.spec.ts` | FEFO (batch terdekat) + dispense sukses + stok 100 → 90 di UI | ✅ PASS |
| | | | alokasi memakai batch ber kedaluwarsa terdekat | ✅ PASS |
| | | | backend 500 → error, stok tidak terpakai | ✅ PASS |
| | | | permission ditolak (Analis Lab → AccessDenied) | ✅ PASS |
| 4 | **Retur obat** | `e2e/playwright/return.spec.ts` | pilih batch → konfirmasi → status "Sudah ada retur" | ✅ PASS |
| | | | backend 500 → error, status tidak berubah | ✅ PASS |
| | | | permission ditolak (Analis Lab → AccessDenied) | ✅ PASS |
| 5 | **Waiver visitor** | `e2e/playwright/waiver.spec.ts` | keputusan **Setuju** (dengan konfirmasi) | ✅ PASS |
| | | | keputusan **Tolak** (dengan konfirmasi) | ✅ PASS |
| | | | backend 500 → error, status tetap PENDING | ✅ PASS |
| | | | permission ditolak (HR/PIC → AccessDenied) | ✅ PASS |
| 6 | **Master data** | `e2e/playwright/master-data.spec.ts` | tambah → ubah → nonaktifkan (dengan konfirmasi) | ✅ PASS |
| | | | kode ganda → 409 dengan pesan jelas | ✅ PASS |
| | | | permission ditolak (HR/PIC → AccessDenied) | ✅ PASS |

Aturan yang dipatuhi:

- **Isolasi data** — tiap test memakai `createMockBackend()` sendiri; tidak ada state bersama.
  Playwright membuat context browser baru per test (localStorage bersih), sehingga urutan test
  tidak berpengaruh.
- **Tidak menyentuh produksi** — server yang dijalankan Playwright adalah build lokal
  (`next build && next start` pada port 3111) dengan `NEXT_PUBLIC_API_URL` menunjuk origin yang
  sama; seluruh request `/api/v1/**` dilayani mock di dalam browser.
- **Selector stabil** — `getByRole`/`getByLabel` + `data-testid` yang sengaja ditambahkan
  (`master-data-row`, `medicine-stock`, `soap-save`, `soap-finalize-confirm`,
  `waiver-decision-confirm`, `escalation-run`, `mcu-reminder-badge`, …). Tidak ada selector CSS
  rapuh; tidak ada `waitForTimeout`.
- **Tidak ada test yang di-skip** — keenam alur dapat diuji penuh karena endpoint yang dipakai
  sudah ada. Alur yang bergantung pada endpoint yang belum ada (§5) **tidak** dibuat sebagai test
  yang mengada-ada; Instead semuanya masuk daftar BLOCKER.

---

## 5. Daftar BLOCKER BACKEND

Semua butir berikut **tidak** dapat diselesaikan di frontend tanpa perubahan backend, dan tidak
ada mock yang dipura-pura berhasil. Penegakan server atas permission **tetap tanggung jawab
backend** — frontend hanya menyembunyikan tampilan, menolak route, dan menyembunyikan aksi.

### 5.1 Role `admin-klinik` dipetakan ke backend `SYSTEM_ADMIN`

- **Diminta:** role backend khusus untuk Admin Klinik (mis. `CLINIC_ADMIN`) dengan scope
  klinik, **atau** penyesuaian policy server agar `SYSTEM_ADMIN` tidak lagi menerima
  `dispense-medicine`, `view-clinical-notes`, `view-diagnosis`, `approve-mcu`, `issue-certificate`.
- **Tempat:** service IAM backend (role/menu/policy), `ROLE_MAPPING.md` backend, dan
  `FRONTEND_ROLE_TO_BACKEND` frontend (role `admin-klinik` belum punya kode role backend).
- **Kenapa:** dokumen memetakan `admin-klinik` → `SYSTEM_ADMIN`; kalau server tetap memakai
  `SYSTEM_ADMIN`, user ini tetap bisa memanggil endpoint klinis/farmasi walaupun UI menyembunyikannya.
- **Dampak:** kebocoran data klinis lewat API tetap mungkin; frontend tidak bisa menutupnya.

### 5.2 `SYSTEM_ADMIN` masih boleh klinis/farmasi di server

- **Diminta:** audit & pencabutan hak `approve-mcu`, `issue-certificate`, `pharmacy/dispensing`,
  `pharmacy/inventory`, `clinic/*` untuk role `SYSTEM_ADMIN`.
- **Tempat:** policy/guard backend (middleware RBAC) + seed role.
- **Kenapa:** frontend sudah mencabut semua permission klinis untuk `admin`, tetapi server
  menentukan mana yang benar-benar dikunci.
- **Dampak:** admin masih bisa mengakes data klinis lewat API langsung.

### 5.3 `HR_ADMIN` masih boleh kelola user/master data di server

- **Diminta:** cabut `manage-users`, `manage-master-data` (POST/PATCH `/iam/users`,
  `/master-data/*`) untuk `HR_ADMIN`.
- **Tempat:** guard backend modul IAM & master data.
- **Kenapa:** proposal: HR "tidak boleh mengelola user dan master data".
- **Dampak:** HR masih bisa mengubah user/master data lewat API.

### 5.4 `LAB_ANALYST` masih boleh membaca data MCU penuh

- **Diminta:** `LAB_ANALYST`/`RADIOLOGIST` tidak boleh memanggil `GET /mcu/cycles` (daftar siklus
  MCU lengkap) — cukup endpoint hasil lab & impor.
- **Tempat:** guard backend modul MCU.
- **Kenapa:** proposal: "tidak punya akses data MCU penuh".
- **Dampak:** data MCU tetap bisa dibaca lewat API oleh Analis Lab.

### 5.5 `HR_ADMIN` dan akses `GET /mcu/cycles` untuk halaman kepatuhan

- **Diminta:** konfirmasi/penyesuaian: apakah `HR_ADMIN` boleh memanggil `GET /mcu/cycles`?
  Halaman `/health-status` (status kepatuhan untuk HR) mengambil `ftw_assessment` dari sana.
- **Tempat:** guard backend modul MCU.
- **Kenapa:** frontend mencabut `view-mcu` untuk HR tetapi tetap membutuhkan sumber data FTW.
- **Dampak:** jika server menolak, halaman status kepatuhan HR menjadi kosong tanpa penjelasan
  yang jujur (hanya "belum ada data").

### 5.6 Field tahapan reminder & level eskalasi tidak tersedia

- **Diminta:** field `reminder_stage` (H-30/H-14/H-7/HARI-H/OVERDUE) dan `escalation_level`
  per record, **atau** endpoint untuk membaca konfigurasi eskalasi (jadwal, target, urutan
  eskalasi).
- **Tempat:** domain MCU/Notification backend; endpoint terkait saat ini:
  `GET /mcu/cycles` (hanya punya `valid_until`), `POST /admin/escalation/run-check` (hanya
  mengembalikan agregat `evaluatedCount`/`escalatedCount`), `GET /notifications`.
- **Kenapa:** proposal menyebut tahap reminder & eskalasi berjenjang "sesuai konfigurasi"; saat ini
  tahap dihitung di frontend dari `valid_until`, dan level eskalasi tidak terlihat sama sekali.
- **Dampak:** UI menampilkan tahap yang benar (berdasarkan `valid_until`) tetapi tidak dapat
  menampilkan/menelusuri konfigurasi eskalasi; notifikasi per tahap belum dapat dikaitkan.

### 5.7 `encounter_id` untuk rekam medis

- **Diminta:** endpoint daftar encounter (mis. `GET /clinic/encounters`) atau field `encounter_id`
  pada `GET /clinic/queues`.
- **Tempat:** modul Klinik backend; `src/lib/remote-sync.ts#mapQueueTicket` (saat ini memakai
  `ticket.id` sebagai id kunjungan).
- **Kenapa:** SOAP/finalize/addendum memakai `PUT/POST /clinic/encounters/:id/...` yang
  memerlukan **encounter id**, sedangkan halaman `/medical-records` hanya punya id ticket antrean.
- **Dampak:** pada backend nyata, SOAP/finalize berpotensi 404/409 karena id tidak sama.
  E2E Playwright memakai mock sehingga hal ini belum terbukti.

### 5.8 Pencocokan duplikat identitas

- **Diminta:** endpoint khusus, mis. `POST /patients/duplicate-check` yang mengembalikan
  verdict (`NONE`/`WARNING`/`BLOCK`) + existing person.
- **Tempat:** modul MPI backend; saat ini frontend memakai `GET /patients?search=<identifier>`.
- **Kenapa:** endpoint list hanya mengembalikan identifier yang **sudah dimasking**, sehingga
  pencocokan NIK bergantung pada perilaku pencarian server dan tidak dapat diverifikasi dari frontend.
- **Dampak:** deteksi duplikat berisiko false negative.

### 5.9 Manajemen API key (System Administrator)

- **Diminta:** endpoint buat/cabut API key (mis. `POST/DELETE /iam/api-keys`).
- **Tempat:** modul IAM backend.
- **Kenapa:** proposal menyebut "buat/cabut API key" sebagai bagian duties System Administrator;
  tidak ada endpoint yang dipakai frontend.
- **Dampak:** fitur belum ada di frontend; tidak dibuat mock.

### 5.10 Monitoring sertifikat TTE

- **Diminta:** endpoint monitoring sertifikat TTE (status tanda tangan elektronik) untuk
  System Administrator.
- **Tempat:** modul Certificate/Document backend (`/signatures/request`, `/documents/render-pdf`
  sudah dipakai, tetapi tidak ada endpoint read/monitor TTE).
- **Kenapa:** proposal menyebut "monitor sertifikat TTE"; tidak ada sumber data untuk UI.
- **Dampak:** fitur belum ada di frontend; tidak dibuat mock.

### 5.11 Jejak audit untuk keputusan waiver

- **Diminta:** konfirmasi bahwa `POST /waivers/:id/decision` menulis audit log immutable.
- **Tempat:** modul Waiver backend.
- **Kenapa:** proposal: alur keputusan waiver "dengan jejak audit".
- **Dampak:** UI sudah meminta keputusan lewat endpoint yang ada dan menampilkan hasilnya apa
  adanya; jaminan audit tetap perlu konfirmasi backend.

---

## 6. Risiko & hal yang perlu dicek manual

### 6.1 Hydration mismatch (React #418) pada route terproteksi — **sudah ada sebelum A1**

- **Gejala:** `npm run test:e2e:frontend:contract` gagal pada `F1B-16` ("unexpected page error = 0")
  untuk `contract-hse`, `contract-dr.hendra`, `contract-hr.pic`.
- **Bukti pre-existing:** hasil identik saat kode dikembalikan ke baseline `8c619b5` (§2.3).
- **Penyebab yang paling mungkin:** store Zustand (`lib/store.ts`) memakai `persist` dengan
  `localStorage`; rehidrasi berlangsung **sinkron** di browser, sehingga render pertama di klien
  sudah punya sesi/role, sedangkan render server (server tidak punya `localStorage`) merender
  skeleton `RouteGuard` tanpa konten. Akibatnya React membuang HTML server dan merender ulang
  seluruh pohon.
- **Dampak:** performance & UX (flash), dan HTML server untuk route terproteksi tidak berguna.
- **Rekomendasi (di luar lingkup A1):** jangan render konten yang bergantung role sebelum `mount`
  (misalnya `useEffect` + flag `mounted`), atau gate shell dengan SSR yang deterministik.
  Setelah diperbaiki, `F1B-16` harus kembali hijau.

### 6.2 Permission frontend ≠ otorisasi

Semua pembatasan di A1 bersifat UI/UX. Sistem yang benar-benar aman tetap memerlukan
penegakan di backend (§5.1–5.4). **Audit backend wajib dilakukan sebelum produksi.**

### 6.3 Keputusan permission yang perlu dikonfirmasi manusia

| Keputusan | Yang saya kerjakan | Alasan | Perlu konfirmasi? |
|---|---|---|---|
| `admin` kehilangan `export-reports` | dicabut | `export-reports` tidak ada dalam daftar "Pertahankan" dan ekspor laporan adalah jalur keluarnya data | **Ya** — jika admin tetap perlu ekspor, cukup 1 baris di `lib/rbac.ts` |
| `hr` kehilangan `view-mcu` | dicabut | ada dalam daftar "Cabut" eksplisit; HR tetap melihat kepatuhan lewat `/health-status` | **Ya** — pastikan sumber data kepatuhan (`GET /mcu/cycles`) boleh diakses `HR_ADMIN` (§5.5) |
| `hr` **tetap** punya `view-reports` + `export-reports` | dipertahankan | tidak ada dalam daftar "Cabut" HR; konten klinis `/reports` disembunyikan per kartu | **Ya** — jika laporan hanya boleh untuk sistem, hapus keduanya |
| `admin-klinik` **mendapat** `manage-employees`, `upload-document`, `edit-visit` | ditambahkan | proposal: registrasi + antrean + entri berobat luar klinik | **Ya** |

### 6.4 `admin-klinik` belum punya kode role backend

`FRONTEND_ROLE_TO_BACKEND` (`src/lib/services/auth.service.ts`) tidak memuat `admin-klinik`, jadi
user dengan role ini **tidak bisa login dari backend** —role tersebut hanya bisa dipakai lewat
mode demo. Perlu pemetaan role backend (lihat §5.1).

### 6.5 Data seed lokal masih menjadi state awal store

`lib/seed.ts` masih dipakai sebagai nilai awal store yang dipersist. Halaman yang **sudah**
diperbaiki: `/health-status`, `/reports` (kartu kepatuhan & dispensing). Halaman yang **belum
diaudit** dan masih berpotensi membaca nilai seed: `/employees`, `/my/*`, `/my/mcu`,
`/my/certificates`, `/people` (sebelum sync selesai). Perlu audit manual sebelum produksi.

### 6.6 E2E Playwright belum memverifikasi backend nyata

Mock API di dalam browser membuktikan perilaku frontend (form, konfirmasi, state, permission),
**bukan** kesesuaian kontrak dengan backend. Integrasi nyata tetap perlu dijalankan dengan
`npm run test:e2e:frontend -- --mode=business` + `E2E_API_URL` menuju backend sungguhan.
Butuh item §5.1–5.11 diperbaiki lebih dulu agar tidak gagal karena hal yang sebenarnya.

### 6.7 Konfigurasi build produksi

`NEXT_PUBLIC_API_URL` wajib diisi dan **absolut**; build tanpa nilai itu menampilkan pesan
konfigurasi dan menolak request. Pastikan variabel ini terisi pada pipeline build.

### 6.8 Runner E2E lama memakai port 3001

`npm run test:e2e:frontend*`zlien membutuhkan server yang sudah berjalan di port 3001
(`npx next build && npx next start -p 3001`). Pastikan port bebas sebelum menjalankan.

---

## 7. Daftar commit

| Commit | Isi |
|---|---|
| `3fa7ec4` | `feat(rbac)`: perketat permission admin/hr/lab/admin-klinik + registry aksi multi-requirement + test |
| `5ff171b` | `feat(access)`: pembatasan 3 lapis di UI (`/visits`, `/visits/queue`, `/reports`) + ganti data seed dengan data API |
| `9d12b6d` | `feat(waiver/reminder)`: konfirmasi keputusan waiver, reminder H-30…Overdue, panel eskalasi, perbaikan alur "Simpan SOAP", sembunyikan data demo |
| `d5f9732` | `test(e2e)`: Playwright untuk 6 alur mutasi + perbaikan bug tombol "Proses Retur" + label aksesibel |
| `57709f2` | `docs`: README ditulis ulang, `ROLE_MAPPING.md` dihasilkan dari kode, ACCESS_ARCHITECTURE disinkronkan |
