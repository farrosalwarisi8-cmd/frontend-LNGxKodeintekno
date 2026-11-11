# LAPORAN FASE A3 — Review MCU, Resume MCU, dan Sertifikat (D&A)

Repo: `kodein-klinik` (Next.js 16 App Router, React 19, TypeScript strict, Tailwind 4, Vitest 5, Playwright)
Cabang: `feat/a3-oh-review-dna` (dari `origin/main` @ `d4ab4da`)
Tanggal: 2026-10-21
Status: **frontend selesai di dalam batas kontrak; 15 hal diblokir backend (lihat §6)**

---

## 1. Ringkasan selesai dan belum

### Deviasi prasyarat (dinyatakan di depan)

Prasyarat A3 berbunyi "A1 dan A2 sudah ter-merge ke main". **A1 sudah merged; A2 belum** —
commit A2 masih ada di `origin/feat/a2-lab-radiologi` (terakhir `dd04d4e`), belum ada di
`main`. Sesuai keputusan pemilik repo, A3 **dilanjutkan dari `origin/main` terbaru** dengan
A3 berada sepenuhnya di area miliknya sendiri, dan A2 **tidak** ikut masuk ke branch ini.
Konsekuensinya tercatat di §8 (Regresi & Interaksi Antar Fase).

| Area A3 (bebas diubah) | Isi |
|---|---|
| `src/features/oh-review/**` | model + klien API + komponen layar review MCU, penetapan FTW, management restriksi |
| `src/features/certificates/**` | resume MCU, pratinjau sertifikat FTW & D&A, aturan cetak (`@media print`) |
| `src/features/dna/**` | modul D&A: akses, state sensitif, chain of custody, aturan hasil, pratinjau sertifikat |
| `app/(app)/oh-review/**`, `app/(app)/dna/**` | route baru (3 route) |
| `e2e/oh-review/**`, `e2e/dna/**` | suite E2E Playwright + cek flag mati + cek axe |

### Selesai

| Tugas | Status | Catatan |
|---|---|---|
| 1. Layar review MCU (Dokter OH) | ✅ | Antrean + filter (status, site, tanggal, prioritas perburukan) + pencarian; detail siklus: identitas minimum, nilai terhitung dari API, penanda perburukan, hasil penunjang terverifikasi (A2, read-only), catatan dokter + draf + indikator belum tersimpan; state skeleton/kosong/error+retry/offline; konfirmasi `beforeunload` bila draf belum disimpan. Filter **perusahaan** tidak ditampilkan (kontrak tidak punya field perusahaan → B-06). |
| 2. Penetapan FTW | ✅ (dengan batas jujur) | 4 kategori, saran sistem ditampilkan **bila API mengirimkannya** (belum ada → B-01), alasan deviasi **wajib** bila berbeda dari saran, ringkasan → dialog konfirmasi → final → keputusan terkunci di UI dengan catatan "koreksi lewat addendum (A4)". Hanya `set-ftw` (Dokter OH). |
| 3. Restriction | ⚠️ jujur | Daftar aktif + riwayat per pekerja; **akhiri** restriksi (POST `/mcu/restrictions/:id/close`) dengan alasan wajib + konfirmasi; **tambah** hanya melalui penetapan FTW "Fit with Restriction" (satu-satunya endpoint yang ada); **ubah** & **hapus** nonaktif dengan alasan B-07; role lain ditolak di route (AccessDenied) dan tidak punya tombol aksi. Notifikasi HSE dicatat "otomatis di server" + B-04 untuk status notifikasi. |
| 4. Resume MCU & pratinjau sertifikat | ✅ | Resume terstruktur dari data API (identitas minimum, ringkasan hasil, keputusan FTW, restriksi) + versi/status dokumen dari `GET /documents`; pratinjau FTW & D&A memakai layout cetak browser (`@media print`, CSS module area A3) dengan penanda **"PRATINJAU, belum sah"** dan area tanda tangan/QR **kosong** berlabel "diisi pada tahap TTE"; tidak ada tombol unduh dokumen final; akses `view-resume` / `view-certificate-preview`. |
| 5. Modul D&A | ✅ (dengan batas jujur) | Akses **hanya Dokter OH** (HSE ditolak karena data penunjukan tidak ada → B-02); hasil **tersembunyi default** & hanya tampil setelah tindakan sadar + keterangan audit server (B-03); chain of custody **append-only** (lini waktu + tambah kejadian, tanpa edit/hapus) memakai `record-dna-custody`; confirmation test tampil **hanya bila flag/status API** menandainya perlu, memakai `record-dna-confirmation`; pratinjau sertifikat D&A; state sensitif hanya di memori & dibersihkan saat keluar halaman / sesi berakhir / tab ditutup. |
| 6. Permission & navigasi | ✅ | 7 permission baru dipetakan **hanya** ke `dokter-oh`; `review-mcu` (A1) dipakai ulang; registry aksi baru; 3 menu baru di balik flag; 3 lapis proteksi (menu → route AccessDenied → aksi `<Can>`); uji positif & negatif untuk 10 role. |
| 7. Test | ✅ | +70 unit test (5 file); +25 E2E Playwright (3 spec + mock sendiri); cek flag mati 7/7; axe 3 route baru 0 critical/serious; regresi fase lama tetap hijau. |

### Belum / di luar lingkup A3

- Penandatanganan TTE, QR, hash, portal verifikasi, addendum → **A4** (§7).
- Ambang & rumus klinis, klasifikasi TD, skor CV, perbandingan tahun lalu → **server**;
  frontend hanya menampilkan hasil hitungan API.
- Bukan backend, skema DB, kontrak API, repo backend, konfigurasi build/CI, atau
  logika/test fase lain **tidak disentuh** (kecuali penambahan additive pada file bersama
  yang diizinkan: registry permission/aksi, env flag, navigasi, guard route, satu service).
- Alur **kirim ulang / bulk** pada modul yang tidak ada endpoint-nya → tidak dibuat.

---

## 2. Inventaris kontrak API

Sumber: `src/lib/services/{mcu,da,document,diagnostic}.service.ts` (klien API repo ini),
`tmp2/openapi.json` (kontrak backend), dan `src/lib/services/auth.service.ts`.

### 2.1 Yang ADA (dipakai A3 — tidak ada endpoint/field baru yang dipalsukan)

| Endpoint | Dipakai A3 untuk | Bentuk data yang dipakai |
|---|---|---|
| `GET /mcu/cycles?page&limit&search` (+ `ftwStatus` via klien repo) | Antrean review + detail siklus | `id`, `mcu_type`, `examination_date`, `valid_from/until`, `status`, `reviewer_user_id`, `patient{medical_record_no, full_name, employee{employee_no, full_name, site{name}}}`, `calculations[]` (bentuk persis `Record<string, unknown>`), `ftw_assessment{ftw_status, summary, assessed_by, assessed_at, valid_until, restrictions[{id, description, effective_date, review_date, supervisor, controls, status}]}` |
| `POST /mcu/cycles/:id/ftw-assessment` | Penetapan FTW | Body kontrak: `{ftwStatus, summary, restriction{description, reviewDate, supervisor, controls}}` → respons `{assessment, restriction}` |
| `POST /mcu/restrictions/:id/close` | Akhiri restriksi | Tanpa requestBody (lihat B-08) |
| `GET /documents?page&limit&documentType&status&search` | Status/versi dokumen resume & sertifikat | `id`, `document_type`, `title`, `status` (DRAFT/FINAL/LOCKED/AMENDED/VOID), `created_at`, `updated_at`, `sha256_hash`, `qr_token`, `signature_reqs[]{id, status, signature_type, completed_at}` |
| `GET /diagnostic/lab-orders` + `GET /diagnostic/lab-results` | Hasil penunjang terverifikasi (A2, **read-only**) | `order{ id, mcu_cycle_id, order_items[]{id} }` + `result{ id, lab_order_item_id, verified_by, verified_at, values[]{parameter_name, numeric_value, text_value, unit, abnormal_flag} }` |
| `GET /da/tests?page&limit&search&patientId&status` | Daftar tes D&A + sampel + custody + hasil | `id`, `patient_id`, `test_type`, `status`, `created_at`, `collected_at`, `patient{...}`, `samples[]{id, sample_no, specimen_type, sealed_at, custody_chain[]{id, from_party, to_party, action, signature_hash, event_at}}`, `results[]{id, screening_result, confirmation_result, confirmed, verified_by/at}`, `certificate` |
| `POST /da/samples/:id/chain-of-custody` | Tambah kejadian custody (append-only) | Body kontrak: `{fromParty, toParty, action}` |
| `POST /da/tests/:id/results` | Screening + confirmation test | Body kontrak: `{screeningResult, confirmationResult, confirmed}` |
| `GET /mcu/cycles` (filter `ftwStatus`) | Filter status antrean |memakai klien repo (`mcuService.list`) |

> **Catatan bentuk respons `/da/tests`**: `daService.getTests()` membaca `res.data`,
> jadi backend membungkus objek paginasi **di dalam** envelope `data`
> (`{ success, data: { data: [...], meta: {...} } }`). Mock E2E A3 meniru bentuk ini.

### 2.2 Yang TIDAK ADA (BLOCKER — tidak dikarang, ditampilkan jujur)

| # | Yang tidak ada | Konsekuensi di UI |
|---|---|---|
| 01 | **Saran FTW dari sistem** (mis. `suggested_ftw_status`) | Panel "Saran sistem" menampilkan "Saran sistem belum tersedia dari API"; aturan "alasan deviasi wajib" tidak aktif (tetap ditulis & diuji unit) |
| 02 | **Penanda perburukan dibanding tahun lalu** | Ditampilkan **hanya** bila API mengirim flag boolean eksplisit; kalau tidak, muncul catatan "Penanda perburukan … belum tersedia dari API" |
| 03 | **Skema `calculations[]`** (`Record<string, unknown>`) | Nilai ditampilkan apa adanya + label pemetaan field API yang dikenal; field tak dikenal ditampilkan apa adanya (humanize), **tidak** ditafsirkan |
| 04 | **Field perusahaan/organisasi** pada siklus MCU | Filter perusahaan tidak ditampilkan (ditulis eksplisit di UI) |
| 05 | **Endpoint tambah/ubah/hapus restriksi mandiri** | Tambah hanya lewat penetapan FTW; Ubah & Hapus nonaktif + alasan |
| 06 | **Parameter catatan** pada `POST /mcu/restrictions/:id/close` | Alasan pengakhiran **wajib diisi** di UI, tetapi jujur dinyatakan belum tersimpan server |
| 07 | **Status notifikasi restriction ke HSE** | UI menyatakan notifikasi dibuat di server; statusnya tidak dapat ditampilkan |
| 08 | **Endpoint draf review MCU / catatan dokter** | Draf hanya di memori halaman + konfirmasi `beforeunload`; catatan dikirim sebagai `summary` saat penetapan FTW |
| 09 | **`GET /mcu/cycles/:id`** | Detail siklus dibaca dari payload list (tidak ada request tambahan) |
| 10 | **Endpoint/field penunjukan HSE untuk D&A** | HSE **ditolak** di `/dna` (AccessDenied) + `view-dna` hanya untuk Dokter OH |
| 11 | **Audit log akses D&A yang dapat diverifikasi klien** | UI menyatakan akses dicatat audit log server; verifikasi dari klien tidak tersedia |
| 12 | **Daftar restriksi terpisah** | Restriksi dibaca dari `ftw_assessment.restrictions` pada siklus MCU |
| 13 | **`referenceId` pada dokumen** | Pencocokan dokumen ↔ siklus MCU memakai judul (konvensi yang sama dipakai `syncCertificates` di repo ini) |
| 14 | **Dokumen sertifikat D&A** (jenis & referensi ke tes) | Status dokumen pada pratinjau D&A dinyatakan "belum tersedia dari API" |
| 15 | **`GET /diagnostic/lab-*` aktif di backend yang berjalan** (B-13) | Panel "Hasil penunjang terverifikasi" menampilkan error jujur + "Coba lagi"; tidak ada baris karangan |

---

## 3. Baseline vs hasil akhir

| Ukuran | Baseline (`origin/main` @ `d4ab4da`) | Hasil akhir A3 | Delta |
|---|---|---|---|
| `npm run typecheck` | exit 0 (bersih) | exit 0 (bersih) | — |
| `npm run lint` | 0 error / 58 warning | **0 error / 58 warning** | 0 |
| Unit test (Vitest) | 39 file passed + 1 skipped (**40**) → **507 passed + 21 skipped (528)** | 44 file passed + 1 skipped (**45**) → **577 passed + 21 skipped (598)** | **+5 file, +70 test, 0 gagal** |
| E2E Playwright A3 (baru) | — | **25 / 25 PASS** | +25 |
| Cek flag mati A3 (baru) | — | **7 / 7 PASS** | +7 |
| Axe route baru (baru) | — | **3 route, 0 critical/serious, 0 kontrol tanpa label** | +3 |
| Regresi E2E Playwright A1 | 21 / 21 PASS | **21 / 21 PASS** | 0 |
| Regresi E2E ui-only (`test:e2e:frontend`) | 37 / 37 PASS | **37 / 37 PASS** | 0 |
| Regresi role-scenarios (`test:roles`) | 21 / 21 PASS | **21 / 21 PASS** | 0 |
| Regresi axe bersama (`test:a11y`, 33 halaman) | 0 critical/serious | **0 critical/serious** | 0 |

Rincian 70 unit test A3 (5 file, semua di area A3):

| File | Test | Cakupan |
|---|---|---|
| `src/features/oh-review/__tests__/rbac-a3.test.ts` | 14 | 8 permission A3 hanya untuk `dokter-oh` (positif + negatif 10 role), HSE tanpa akses D&A, registry aksi, guard route, menu di balik flag (mati = hilang) |
| `src/features/oh-review/__tests__/ftw-deviation.test.ts` | 17 | 4 kategori, saran hanya dari API, alasan deviasi wajib bila berbeda, validasi form |
| `src/features/oh-review/__tests__/document-status.test.ts` | 11 | Draft / Siap menunggu tanda tangan / Bertanda tangan / addendum / Dicabut, metadata dokumen, penyusunan resume |
| `src/features/oh-review/__tests__/calculation-display.test.ts` | 12 | nilai apa adanya (tanpa pembulatan), satuan, penanda perburukan hanya dari flag boolean |
| `src/features/dna/__tests__/dna-access-and-state.test.ts` | 16 | akses D&A terbatas, HSE ditolak, pembersihan state sensitif, aturan confirmation test, custody append-only |

---

## 4. Permission baru per role

Ditambahkan **murni** di `lib/rbac.ts` (commit berlabel `shared:`), `ROLE_MAPPING.md`
**digenerate ulang** dari kode (`node scripts/generate-role-matrix.mjs`, dijaga test
`role-mapping-doc.test.ts`) — tidak diedit manual. Tidak ada permission/aksi lama yang
diubah atau dihapus.

| Permission | admin | **dokter-oh** | dokter-klinik | perawat | apoteker | lab | admin-klinik | hr | hse | manajemen | pekerja |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `review-mcu` (eksis A1, dipakai ulang) | — | ✓ | — | — | — | — | — | — | — | — | — |
| `set-ftw` | — | **✓** | — | — | — | — | — | — | — | — | — |
| `manage-restriction` | — | **✓** | — | — | — | — | — | — | — | — | — |
| `view-resume` | — | **✓** | — | — | — | — | — | — | — | — | — |
| `view-certificate-preview` | — | **✓** | — | — | — | — | — | — | — | — | — |
| `view-dna` | — | **✓** | — | — | — | — | — | — | — | — | — |
| `record-dna-custody` | — | **✓** | — | — | — | — | — | — | — | — | — |
| `record-dna-confirmation` | — | **✓** | — | — | — | — | — | — | — | — | — |

Aksi baru di `lib/actions.ts`:
`mcu.set-ftw`→`set-ftw`, `mcu.manage-restriction`→`manage-restriction`,
`mcu.view-resume`→`view-resume`, `mcu.view-certificate-preview`→`view-certificate-preview`,
`dna.view`→`view-dna`, `dna.record-custody`→`record-dna-custody`,
`dna.record-confirmation`→`record-dna-confirmation`.

Route baru (guard di `components/route-guard.tsx`):

| Route | Permission | Role yang boleh |
|---|---|---|
| `/oh-review` | `review-mcu` | dokter-oh |
| `/oh-review/restrictions` | `manage-restriction` | dokter-oh |
| `/dna` | `view-dna` | dokter-oh |

Menu baru (`src/lib/navigation.ts`, **di balik flag**): "Review MCU Dokter OH",
"Restriksi Kerja (OH)", "D&A Forensik (OH)". Ketiganya hilang saat flag mati
(diverifikasi `e2e/oh-review/flag-off-check.mjs`).

Feature flag (default **mati**): `NEXT_PUBLIC_FEATURE_OH_REVIEW`, `NEXT_PUBLIC_FEATURE_DNA`
(dibaca di `src/lib/env.ts` — satu-satunya pembaca `NEXT_PUBLIC_*` sesuai test audit konfigurasi).

---

## 5. Alur E2E dan statusnya

Suite A3: `npm run test:e2e:a3` (config mandiri `e2e/oh-review/playwright.config.ts`;
mock API di dalam browser; data sintetis; selector role/label; tanpa sleep tetap;
tidak pernah menyentuh backend/produksi).

| ID | Alur | Status |
|---|---|---|
| REVIEW-01 | Antrean: siklus tampil, nilai terhitung apa adanya, penanda perburukan, hasil penunjang terverifikasi (A2) | ✅ LULUS |
| REVIEW-02 | Saran sistem tidak tersedia → ditampilkan jujur | ✅ LULUS |
| REVIEW-03 | Penetapan FTW: belum ada request sebelum konfirmasi → ringkasan → final → **terkunci** (1 request `POST /mcu/cycles/:id/ftw-assessment`) | ✅ LULUS |
| REVIEW-04 | Catatan dokter: penanda "belum tersimpan" → "Simpan draf" | ✅ LULUS |
| REVIEW-05 | State error antrean + tombol "Coba lagi" | ✅ LULUS |
| REVIEW-06 | HR ditolak di `/oh-review` (AccessDenied) | ✅ LULUS |
| REVIEW-07 | HSE ditolak di `/oh-review` | ✅ LULUS |
| REVIEW-08 | admin, lab, apoteker ditolak di `/oh-review` | ✅ LULUS |
| RESTRICT-01 | Daftar restriksi aktif: jenis, tanggal, penetap, status (apa adanya dari API) | ✅ LULUS |
| RESTRICT-02 | Akhiri restriksi: alasan **wajib** (tanpa alasan → 0 request) → konfirmasi → 1 request `POST /mcu/restrictions/:id/close` | ✅ LULUS |
| RESTRICT-03 | Aksi "Ubah"/"Hapus" nonaktif (endpoint belum ada) | ✅ LULUS |
| RESTRICT-04..06 | HR, HSE, manajemen & admin ditolak di `/oh-review/restrictions` | ✅ LULUS |
| PREVIEW-01 | Pratinjau resume: "PRATINJAU, belum sah" + area TTE/QR kosong + **tanpa** tombol unduh | ✅ LULUS |
| PREVIEW-02 | Pratinjau sertifikat FTW: penanda belum sah + isi dari API | ✅ LULUS |
| PREVIEW-03 | Resume memuat identitas minimum, hasil, keputusan | ✅ LULUS |
| PREVIEW-04 | Role tanpa izin tidak melihat pratinjau | ✅ LULUS |
| DNA-01 | Hasil screening **tersembunyi default** | ✅ LULUS |
| DNA-02 | Hasil tampil hanya setelah "Tampilkan hasil" | ✅ LULUS |
| DNA-03 | Chain of custody: lini waktu + tambah kejadian (1 request append) | ✅ LULUS |
| DNA-04 | Confirmation test (muncul karena flag API) + simpan hasil | ✅ LULUS |
| DNA-05 | Pratinjau sertifikat D&A: belum sah + area TTE kosong | ✅ LULUS |
| DNA-06 | Data D&A tidak masuk URL | ✅ LULUS |
| DNA-07 | HR, lab, admin, HSE ditolak di `/dna` | ✅ LULUS |
| FLAG-OFF (7 cek) | Flag mati: route "fitur belum aktif", 3 menu hilang, `/mcu/review` lama tetap tampil, HR tetap AccessDenied | ✅ 7/7 LULUS |
| A11Y (3 route) | axe `/oh-review`, `/oh-review/restrictions`, `/dna` | ✅ 0 critical/serious, 0 kontrol tanpa label |

**Tidak ada `test.skip`.** Alur yang tidak bisa diuji dengan backend nyata diuji dengan mock
browser (label `frontend-contract-test`) — identik dengan konvensi A1/A2.

---

## 6. Daftar BLOCKER BACKEND

| # | Kebutuhan | Endpoint/field yang dibutuhkan | Dampak di UI | Prioritas |
|---|---|---|---|---|
| **B-01** | **Saran FTW dari sistem** | field `suggested_ftw_status` (atau sejenis) pada `GET /mcu/cycles` | Panel "Saran sistem" kosong; aturan "alasan deviasi wajib bila berbeda dari saran" tidak dapat diaktifkan (logika sudah ada & teruji unit) | Tinggi |
| **B-02** | **Penunjukan HSE untuk D&A** | endpoint/field penunjukan (mis. `GET /da/designations` atau `hse_designated_user_ids` pada tes D&A) | HSE **ditolak** di `/dna` (AccessDenied) sampai data penunjukan tersedia; `view-dna` tidak diberikan ke HSE | Tinggi |
| **B-03** | **Audit akses D&A yang dapat diverifikasi** | audit log bertipe `DA_RESULT_VIEW` (dapat dibaca klien/auditor) | UI menyatakan akses dicatat audit log server, tetapi tidak dapat diverifikasi dari klien | Sedang |
| **B-04** | **Status notifikasi restriction ke HSE** | field `notified_at` / `notification_status` pada restriksi atau `GET /mcu/restrictions` | UI hanya menyatakan "notifikasi dibuat otomatis di server"; status tidak ditampilkan | Sedang |
| **B-05** | **Penanda perburukan dibanding tahun lalu** | flag per nilai perhitungan (mis. `worsening: boolean`) pada `calculations[]`, plus skema `calculations[]` yang typed | Penanda perburukan hanya tampil bila flag ada; selain itu ditampilkan catatan "belum tersedia dari API" | Sedang |
| **B-06** | **Field perusahaan** pada siklus MCU | `patient.organization.name` (atau `company`) | Filter perusahaan tidak bisa ditampilkan (filter yang diminta proposal) | Sedang |
| **B-07** | **Endpoint tambah/ubah/hapus restriksi** | `POST /mcu/restrictions`, `PATCH /mcu/restrictions/:id` | Tombol Ubah & Hapus nonaktif; Tambah hanya lewat penetapan FTW | Sedang |
| **B-08** | **Catatan pada penutupan restriksi** | requestBody `POST /mcu/restrictions/:id/close` | Alasan wajib diisi di UI tetapi belum tersimpan di server (dinyatakan jujur) | Sedang |
| **B-09** | **Endpoint draf review MCU** | `PUT /mcu/cycles/:id/review-draft` | Draf hanya bertahan selama halaman terbuka (dengan konfirmasi sebelum keluar) | Rendah |
| **B-10** | **Dokumen ↔ siklus MCU** | field `reference_id`/`reference_type` pada `Document` | Pencocokan dokumen memakai judul (konvensi repo) | Rendah |
| **B-11** | **Dokumen sertifikat D&A** | jenis dokumen + referensi ke tes D&A pada `GET /documents` | Status dokumen pada pratinjau D&A "belum tersedia dari API" | Rendah |
| **B-12** | **Daftar restriksi terpisah** | `GET /mcu/restrictions?patientId=` | Restriksi hanya bisa dibaca lewat `ftw_assessment.restrictions` pada siklus MCU | Rendah |
| **B-13** | **Endpoint baca `GET /diagnostic/lab-*`** (warisan A2) | `GET /diagnostic/lab-orders`, `GET /diagnostic/lab-results` | Panel hasil penunjang menampilkan error jujur + "Coba lagi" terhadap backend yang sekarang | Tinggi (warisan A2) |
| **B-14** | **Skema typed `calculations[]`** | response schema `McuCalculation` | Label nilai memakai kamus field yang dikenal; field tak dikenal ditampilkan apa adanya | Sedang |
| **B-15** | **Endpoint `GET /mcu/cycles/:id`** | detail siklus tunggal | Detail dibaca dari payload list (tanpa request tambahan) | Rendah |

> Tidak ada satu pun hal di atas yang diselesaikan dengan mock yang tampak nyata: setiap
> deficiency tampil sebagai state nonaktif/empty dengan alasan, atau BLOCKER di dokumen ini.

---

## 7. Poin yang diserahkan ke A4 (TTE)

| Poin | Status di A3 | Diserahkan ke A4 |
|---|---|---|
| Area tanda tangan & QR pada resume/sertifikat FTW/D&A | **Kosong** + label "Area tanda tangan dan QR (diisi pada tahap TTE)" | Pengisian tanda tangan (PSrE / PIN), QR token, hash dokumen |
| Penandatanganan | Tidak ada (a3 tidak memanggil `POST /signatures/request` maupun `POST /da/tests/:id/certificate`) | Alur TTE, provider, PIN, callback, verifikasi |
| Hash dokumen | `sha256_hash` dari API ditampilkan apa adanya (potongan 12 karakter) | Penandatanganan hash & ikatan ke dokumen |
| Status dokumen | "Draft" / "Siap, menunggu tanda tangan" / "Bertanda tangan" / "Telah direvisi (addendum)" / "Dicabut" dipetakan dari API | Transisi DRAFT → FINAL/LOCKED, revisi addendum, pencabutan |
| Addendum | UI hanya menyebut "koreksi dilakukan lewat addendum (A4)" | Endpoint addendum untuk keputusan FTW & dokumen terkunci |
| Verifikasi publik | Tidak ada (tidak ada QR yang dibuat) | `/verify/:token` + dokumen yang sah |
| `POST /da/tests/:id/certificate` (sertifikat D&A) | **Tidak dipakai** A3 | Penerbitan sertifikat D&A bertanda tangan Dokter OH |

---

## 8. Regresi & interaksi antar fase

### Regresi (semua hijau, §3)

- E2E Playwright A1: 21/21 · E2E ui-only: 37/37 · role-scenarios: 21/21 · axe bersama: 0 critical/serious.
- Unit test fase sebelumnya: 507 → 577 (tidak ada test lama yang diubah/dihapus).
- `ROLE_MAPPING.md` sinkron dengan kode (test `role-mapping-doc.test.ts` hijau).

### Perilaku saat flag mati (terverifikasi otomatis)

`e2e/oh-review/flag-off-check.mjs` → 7/7 PASS: route `/oh-review` & `/dna` menampilkan
"Fitur … belum aktif", 3 menu A3 hilang, `/mcu/review` (halaman lama) tetap tampil,
HR tetap AccessDenied. Tidak ada perubahan pada halaman MCU/HR/HSE yang sudah ada.

### Interaksi dengan A2 (belum ter-merge)

- A3 **tidak** mengimpor apa pun dari `feat/a2-lab-radiologi`; folder A2 (`src/features/lab/**`)
  tidak disentuh.
- Panel "Hasil penunjang terverifikasi" membaca kontrak `src/lib/services/diagnostic.service.ts`
  yang **sudah ada di `main`** dan **tidak diubah oleh A2** (dari `git diff main..A2`),
  sehingga tidak akan bentrok saat A2 merge.
- Setelah A2 merge, ruang lingkup A3 tetap sama; yang perlu ditinjau owner A2 hanya
  bila A2 mengubah bentuk respons `diagnostic/*`.
- Catatan: **halaman legacy `/da`** (dari fase sebelumnya) masih memakai permission
  `manage-da` yang diberikan ke `admin` & `lab`. A3 **tidak mengubah** halaman/permission
  tersebut (di luar lingkup & tidak boleh melemahkan/memperlebar RBAC fase lain), tetapi
  modul D&A baru di `/dna` memakai permission terpisah (`view-dna`) yang ketat.
  **Rekomendasi:** halaman `/da` legacy sebaiknya dipensiunkan/di balik flag oleh pemiliknya
  agar tidak ada dua antarmuka D&A dengan aturan akses berbeda.

### Catatan desain yang perlu disetujui

1. **Tidak ada identifier klinis di URL.** Semua layar memakai pola master–detail dalam satu
   route (`/oh-review`, `/dna`): detail dipilih di memori halaman, bukan lewat URL. Ini
   dipilih agar data MCU/D&A tidak bocor ke riwayat browser/tab. Konsekuensi: tidak ada
   deep-link ke satu siklus MCU.
2. **Dokumen sah tidak pernah dibuat di A3.** Satu-satunya aksi unduh-adjacent adalah
   "Cetak pratinjau" (dialog cetak browser) pada dokumen yang ditandai "PRATINJAU, belum sah".
3. **Draf review MCU hanya di memori** (tanpa localStorage) karena data MCU bersifat sensitif;
   backend belum menyediakan endpoint draf (B-09).

---

## 9. Hal yang harus dicek manual

1. **Alur Dokter OH di staging** (butuh backend dengan GET diagnostic & draf-review aktif):
   login → `/oh-review` → pilih siklus → nilai terhitung & penanda perburukan → tetapkan FTW
   (termasuk deviasi dari saran bila saran sudah ada) → pastikan keputusan terkunci & alasan
   terkirim pada `summary` → buka pratinjau resume & sertifikat → akhiri restriksi.
2. **Penolakan role lain**: buka `/oh-review`, `/oh-review/restrictions`, `/dna` langsung
   (URL diketik) sebagai admin, admin-klinik, HR, lab, apoteker, manajemen, HSE, dokter klinik,
   perawat → semuanya harus **AccessDenied**, dan menu A3 tidak boleh terlihat.
3. **Tampilan cetak pratinjau**: `Ctrl+P` pada pratinjau resume/sertifikat FTW/D&A → yang
   tercetak **hanya** dokumen pratinjau (sidebar/header tidak ikut), penanda "PRATINJAU, belum
   sah" tetap terlihat, area tanda tangan/QR kosong. Periksa juga ukuran A4 & margin.
4. **Format dokumen** resume & sertifikat (identitas minimum, urutan bagian, nomor MCU
   `MCU-<8 id>`, format tanggal) — perlu disahkan oleh Dokter OH & tim legal.
5. **Notifikasi HSE otomatis** saat restriksi ditetapkan/berakhir (dicek di backend/HSE,
   bukan dari UI) — sampai B-04 tersedia, status notifikasi tidak tampil di UI.
6. **Alur D&A di lapangan** (lab): registrasi tes → sampling & segel → chain of custody
   (tambah kejadian, pastikan urutan & jam) → screening → confirmation test → sertifikat;
   pastikan audit akses D&A tercatat di audit log server (B-03).
7. **Perilaku flag di tiap environment**: build tanpa `NEXT_PUBLIC_FEATURE_OH_REVIEW` dan
   tanpa `NEXT_PUBLIC_FEATURE_DNA` → 3 menu hilang, 2 route "fitur belum aktif", seluruh
   halaman lama identik dengan `main`.
8. **Halaman legacy `/da`** masih hidup berdampingan dengan `/dna` — tentukan mana yang
   dipakai (lihat §8).

---

## Lampiran A — Commit pada cabang `feat/a3-oh-review-dna`

```
6f31bf3 feat(dna): pratinjau sertifikat D&A (ditandai belum sah) + tes E2E
23a3629 shared: override eslint fixture Playwright A3 + script npm test:e2e:a3
8221ea8 fix(e2e): laporan JSON E2E A3 ditulis ke folder test-artifacts repo (diabaikan git)
a37b8a6 test(e2e): suite E2E A3 (review MCU, FTW, restriksi, pratinjau sertifikat, D&A)
a79c5bd fix(a3): pratinjau cetak & aturan akses D&A
d9509f5 test(a3): unit test permission A3, status dokumen, deviasi FTW, state sensitif & aturan hasil D&A
febbdb7 fix(oh-review): satuan API tidak lagi tampil sebagai baris nilai tersendiri
57504a8 feat(dna): modul D&A terbatas (Dokter OH) di balik flag NEXT_PUBLIC_FEATURE_DNA
820b154 feat(oh-review): antrean, detail review MCU, penetapan FTW & management restriksi
31a78d7 feat(certificates): pratinjau resume MCU & sertifikat FTW (belum sah)
bd819f7 feat(oh-review): model review MCU & klien API (tanpa perhitungan klinis di klien)
31dd294 shared: ROLE_MAPPING.md diregenerasi dari kode (node scripts/generate-role-matrix.mjs)
4ba580e shared: feature flag A3, menu & guard route /oh-review + /dna
65eb2aa shared: registry permission & aksi A3 (set-ftw, manage-restriction, view-resume, view-certificate-preview, view-dna, record-dna-custody, record-dna-confirmation)
```

File bersama yang disentuh (hanya tambahan additive, commit berlabel `shared:` terpisah):
`lib/rbac.ts`, `lib/actions.ts`, `src/lib/env.ts`, `src/lib/navigation.ts`,
`components/route-guard.tsx`, `src/lib/services/mcu.service.ts` (parameter `search`),
`eslint.config.mjs` (override folder E2E A3), `package.json` (script E2E A3),
`ROLE_MAPPING.md` (hasil generator), `.env.example` (dokumentasi flag).

## Lampiran B — Cara menjalankan ulang

```bash
# Typecheck, lint, unit test
npx tsc --noEmit && npx eslint . && npx vitest run

# E2E A3 (flag aktif, mock API di browser)
npm run test:e2e:a3            # 25 skenario

# Cek flag mati (butuh build dengan flag mati)
npx next build && npx next start -p 3122
E2E_BASE_URL=http://localhost:3122 node e2e/oh-review/flag-off-check.mjs   # 7 cek

# Axe route baru (butuh build dengan flag aktif)
NEXT_PUBLIC_FEATURE_OH_REVIEW=1 NEXT_PUBLIC_FEATURE_DNA=1 npx next build && npx next start -p 3123
A11Y_BASE_URL=http://localhost:3123 node e2e/oh-review/a11y-check.mjs

# Regresi fase lama
npm run test:e2e:playwright    # 21 (A1)
E2E_BASE_URL=http://localhost:3311 npm run test:e2e:frontend   # 37
ROLE_BASE_URL=http://localhost:3311 npm run test:roles          # 21
A11Y_BASE_URL=http://localhost:3311 npm run test:a11y           # 0 critical/serious

# Regenerasi matriks role (wajib bila permission berubah lagi)
node scripts/generate-role-matrix.mjs
```

Hasil E2E A3: `test-artifacts/a3-playwright-report.json`; hasil axe: `test-artifacts/a3-a11y/`.
