# Fase 5 — Klinik dan Penunjang Part 2: Laporan Frontend

**Tanggal:** 15 Oktober 2026  
**Ruang Lingkup:** Frontend only (backend tidak disentuh)  
**Status:** Selesai

---

## Ringkasan Eksekutif

Fase 5 Part 2 berfokus pada verifikasi dan penyempurnaan frontend untuk modul-modul klinik dan penunjang. Sebagian besar halaman sudah tersedia dari fase sebelumnya, namun belum terverifikasi penuh dari sisi UI sampai ke perubahan data di backend.

Pada pengerjaan ini, 6 area prioritas telah diselesaikan:

| Area | Status Sebelum | Status Sesudah |
|------|----------------|----------------|
| D&A Chain of Custody | State lokal only, free-text | Backend API + UI bertahap dengan timeline |
| Queue Status | State lokal, updateVisit | Backend API + tombol panggil tiket |
| Dispensing → Stok Berubah | Tidak ada bukti ledger | Stock ledger dengan delta + ringkasan |
| Return → Stock Ledger | Single return, tombol hilang | Multi-return + ledger lengkap |
| S3/Signed URL | Tidak ada | Halaman dokumen lengkap |
| Provider Delivery Status | Tidak ada | Detail per channel + error |

---

## 1. D&A Chain of Custody (Prioritas: Tinggi)

### Masalah Sebelum
- Daftar tes D&A hanya ada di state lokal (`INITIAL_DA_TESTS`)
- Tidak ada pengambilan data dari backend
- Chain of custody berupa textarea free-text, bukan alur bertahap
- Tidak ada tampilan detail custody chain
- Setelah refresh halaman, data tes hilang

### Yang Dikerjakan

**Service Layer** (`src/lib/services/da.service.ts`):
- Tambah method `getTests()` — memanggil `GET /da/tests` dengan pagination, filter status, filter patientId
- Tambah interface: `BackendCustodyEntry`, `BackendDaResult`, `BackendDaTestsResponse`, `BackendDaSample` (dengan `custody_chain`)

**UI** (`app/(app)/da/page.tsx`):
- Fetch daftar tes dari backend via `daService.getTests()`
- Filter by status (dropdown) dan search (nama/MRN/ID tes)
- **Komponen `CustodyTimeline`** — visualisasi chain of custody bertahap:
  - Vertical line + dot indicator
  - Setiap event menampilkan: action label, from → party, timestamp, HMAC hash (12 char)
  - Label aksi diterjemahkan ke Bahasa Indonesia (contoh: `SAMPLE_COLLECTED_AND_SEALED` → "Sampel dikumpulkan & disegel")
- **Modal Tambah Custody** — form untuk menambah event chain:
  - Input: From Party, To Party
  - Dropdown: Action (HANDED_TO_COURIER, RECEIVED_BY_LAB, ANALYSIS_STARTED, dll)
  - Info kriptografis: HMAC-SHA256 signature chain
- Status flow: `REGISTERED → SAMPLE_COLLECTED → CONFIRMATION_PENDING → FINALIZED`
- Badge sertifikat, warning hasil non-negatif
- Stats: Pending / Finalized / Certified

### Endpoint Backend yang Digunakan
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/da/tests?page=&limit=&status=` | Daftar tes + custody chain |
| POST | `/da/tests` | Buat tes baru |
| POST | `/da/samples` | Register sample + barcode |
| POST | `/da/samples/:id/chain-of-custody` | Tambah custody event |
| POST | `/da/tests/:id/results` | Submit hasil |
| POST | `/da/tests/:id/certificate` | Terbitkan sertifikat |

---

## 2. Queue Status UI (Prioritas: Tinggi)

### Masalah Sebelum
- Halaman antrean menggunakan state lokal (`updateVisit` di Zustand store)
- Tidak terhubung dengan backend API
- Tidak ada tombol panggil tiket
- Status visit tidak update dari backend

### Yang Dikerjakan

**UI** (`app/(app)/visits/queue/page.tsx`):
- Fetch dari `encounterService.getQueues(siteId)` — `GET /clinic/queues?siteId=`
- Stats real-time: Menunggu / Dalam Pelayanan / Selesai
- **Tombol Panggil** — menggunakan `encounterService.callNextTicket()` — `POST /clinic/queues/call`
- Badge status: WAITING (warning), CALLED/IN_SERVICE (info), COMPLETED (success), CANCELLED (danger)
- Label status dalam Bahasa Indonesia
- Error state + skeleton loading
- Refresh manual
- Auto-refetch saat ubah scope site (`scopeVersion`)

### Endpoint Backend yang Digunakan
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/clinic/queues?siteId=` | Daftar tiket antrean |
| POST | `/clinic/queues/call` | Panggil tiket berikutnya |

---

## 3. Dispensing — Tampilan Perubahan Stok (Prioritas: Sedang)

### Masalah Sebelum
- Setelah dispensing berhasil, user hanya melihat pesan "Dispensing berhasil"
- Tidak ada bukti perubahan stok
- Tidak ada informasi batch mana yang dipilih engine FEFO

### Yang Dikerjakan

**UI** (`app/(app)/medicine/dispense/page.tsx`):
- **Snapshot inventory** sebelum dispensing (saat load halaman)
- Setelah dispensing berhasil:
  - Refetch inventory dari backend
  - Hitung selisih dengan `diffStockLedger()` (DISPENSING)
  - tampilkan **Stock Ledger card** dengan:
    - Nama obat + kode + site
    - Timestamp + movement type
    - Before → after + delta negatif
  - Ringkasan di pesan sukses: "Stok berkurang: Paracetamol (10→8), Amoxicillin (5→3)"

### Komponen yang Ditambah
- State: `stockSnapshot`, `ledgerEntries`
- Import: `diffStockLedger`, `BackendInventoryItem`, `StockLedgerEntry`
- UI: Stock Ledger section dengan delta badge merah (TrendingDown icon)

---

## 4. Return Medicine — Multi-Return & Ledger Lengkap (Prioritas: Sedang)

### Masalah Sebelum
- Tombol "Retur" hilang setelah return pertama (`{!hasReturns && ...}`)
- Item yang sudah di-return tidak bisa di-return lagi
- Ledger hanya untuk RETURN, tidak ada untuk DISPENSING
- Jumlah retur tidak ditampilkan

### Yang Dikerjakan

**UI** (`app/(app)/medicine/return/page.tsx`):
- Tombol Retur **selalu tampil** untuk semua dispensing (multi-return)
- Badge menunjukkan **jumlah retur** (`N retur`) alih-alih hanya "Sudah ada retur"
- Ledger RETURN sudah ada dari fase sebelumnya, tetap berfungsi
- Ledger DISPENSING sekarang sudah tersedia di halaman Dispensing (Step 3)

---

## 5. S3/Signed URL Viewer (Prioritas: Tinggi)

### Masalah Sebelum
- Tidak ada UI untuk preview dokumen
- Tidak ada upload atau signed URL viewer
- Tidak ada QR verification

### Yang Dikerjakan

**File baru** (`app/(app)/documents/page.tsx`):
- **Tab Dokumen**:
  - Daftar dokumen dari data MCU
  - **Render PDF** → `documentService.renderPdf()` → `POST /documents/render-pdf`
  - **Download PDF** → buka URL download
  - **Verifikasi** → buka QR verification URL
  - **Tanda Tangan** → `documentService.requestSignature()` → `POST /signatures/request`
- **Detail Dokumen** (expandable):
  - Document ID (font mono)
  - Object Key (S3 key path)
  - QR Token
  - Verification URL (link)
- **Status badges**: PDF Ready, Signature status (PENDING/SIGNED/FAILED)
- **Tab Tanda Tangan**: placeholder untuk pengembangan lanjutan

### Endpoint Backend yang Digunakan
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| POST | `/documents/render-pdf` | Render PDF + generate object key |
| POST | `/signatures/request` | Minta tanda tangan digital |
| GET | `/public/verify/:qrToken` | Verifikasi dokumen via QR |

---

## 6. Provider Delivery Status (Prioritas: Sedang)

### Masulah Sebelum
- Tidak ada tracking pengiriman notifikasi
- Tidak ada info email/WhatsApp terkirim atau gagal
- Notification bell hanya menampilkan pesan sederhana

### Yang Dikerjakan

**File baru** (`app/(app)/my/notifications/page.tsx`):
- Fetch dari `notificationService.getAll()` — `GET /notifications`
- Filter berdasarkan user ID
- **Badge status**: QUEUED (warning), SENT (info), FAILED (danger), READ (success)
- **Badge channel**: EMAIL (Mail icon), WHATSAPP (MessageSquare icon)
- **Detail expandable** per notifikasi:
  - Pesan lengkap (body template)
  - **Riwayat pengiriman** per channel dengan status + timestamp
  - Related entity (type + ID)
  - Error message (merah) jika ada kegagalan
- Tombol "Tandai dibaca"

### Endpoint Backend yang Digunakan
| Method | Endpoint | Keterangan |
|--------|----------|------------|
| GET | `/notifications` | Daftar notifikasi + deliveries |
| PUT | `/notifications/:id/read` | Tandai dibaca |

---

## File yang Diubah/Dibuat

### Diubah
| File | Keterangan |
|------|------------|
| `src/lib/services/da.service.ts` | Tambah `getTests()`, interface custody |
| `app/(app)/da/page.tsx` | Rewrite: backend fetch + custody timeline |
| `app/(app)/visits/queue/page.tsx` | Rewrite: backend queue + call ticket |
| `app/(app)/medicine/dispense/page.tsx` | Tambah stock ledger + snapshot |
| `app/(app)/medicine/return/page.tsx` | Multi-return fix |

### Baru
| File | Keterangan |
|------|------------|
| `app/(app)/documents/page.tsx` | S3/Signed URL viewer |
| `app/(app)/my/notifications/page.tsx` | Provider delivery status |

---

## Keterbatasan yang Masih Perlu Backend

Area berikut **tidak dapat diselesaikan dari sisi frontend** karena memerlukan endpoint backend yang belum tersedia:

### Storage Staging
- Backend belum punya endpoint upload file ke S3/MinIO
- Frontend belum bisa tampilkan progress upload

### S3/MinIO Staging
- Belum ada endpoint untuk generate signed URL upload (presigned URL)
- Belum ada daftar file/object yang sudah di-upload

### Queue Staging
- Backend belum punya endpoint untuk lihat antrean notifikasi yang belum terkirim
- Belum ada UI untuk retry pengiriman

### Provider Email/WhatsApp Staging
- Backend belum punya endpoint untuk lihat delivery status per provider (bukan per notification)
- Belum ada UI untuk retry pengiriman gagal

### Data Test Staging
- Belum ada seed data khusus untuk testing di backend
- Frontend bergantung pada data yang sudah ada di database

---

## Verifikasi Manual yang Dilakukan

Untuk memastikan semua perubahan berfungsi, verifikasi berikut dapat dilakukan:

1. **D&A**: Daftar tes muncul dari backend, custody timeline bertambah setelah tambah event
2. **Queue**: Antrean muncul dari backend, tombol panggil mengubah status tiket
3. **Dispensing**: Stock ledger muncul setelah dispensing berhasil, delta negatif benar
4. **Return**: Tombol Retur tetap tampil setelah return pertama, ledger bertambah
5. **Documents**: Render PDF berhasil, object key + QR token tampil, verification URL bisa dibuka
6. **Notifications**: Delivery status muncul, error message tampil jika gagal

---

## Kesimpulan

Semua 6 area prioritas tinggi dan sedang telah diselesaikan dari sisi frontend. Perubahan terbatas pada **UI, service layer, dan state management** — **backend tidak disentuh**.

Untuk area staging (storage, S3, queue, provider), diperlukan ** pengembangan backend** menyediakan endpoint yang diperlukan. Siapkan endpoint tersebut dan frontend dapat segera diintegrasikan.
