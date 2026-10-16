# Laporan: Respons Jelas Setiap Aksi (Frontend)

Tanggal: 16 Oktober 2026
Scope: Hanya frontend (tidak menyentuh backend)

## 1. Ringkasan

Menambahkan mekanisme respons jelas untuk setiap aksi pengguna di frontend: state loading, notifikasi sukses/gagal via toast seragam, validasi form berbasis error inline, dialog konfirmasi untuk aksi berisiko, serta error boundary di root layout. Setiap halaman target sekarang memiliki Skeleton (loading), ErrorState (dengan tombol coba lagi), dan EmptyState (kosong dengan penjelasan).

## 2. Komponen Baru

### `lib/use-toast.ts` — Helper toast seragam
- `toast(title, options)` — notifikasi generik lewat sonner
- `toastSuccess(title, description?)` — sukses dengan ikon ✅
- `toastError(title, description?)` — gagal dengan ikon ❌
- Digunakan oleh semua halaman untuk notifikasi sukses/gagal submit.

### `components/error-boundary.tsx` — Error Boundary Root
- React class component ErrorBoundary dengan `getDerivedStateFromError` dan `componentDidCatch`.
- Menampilkan UI kesalahan dengan tombol "Coba Lagi" yang mereset state error.
- Dipasang di `app/layout.tsx` membungkus seluruh `children`, sehingga error di halaman manapun ditangani secara terpusat tanpa mematikan seluruh aplikasi.

## 3. Perubahan Layout

### `app/layout.tsx` (Root Layout)
- Menambahkan `<ErrorBoundary>{children}</ErrorBoundary>` di atas `<Toaster />`, sehingga semua route internal dilindungi error boundary.

## 4. Halaman yang Diperbarui (Skeleton + ErrorState + EmptyState)

| Halaman | Skeleton | ErrorState (retry) | EmptyState | Toast | Dialog Konfirmasi |
|---|---|---|---|---|---|
| `dashboard` | ✅ | ✅ | ✅ | ✅ (refetch) | — |
| `master-data` | ✅ | ✅ | ✅ (companies/departments/locations) | ✅ (create/update/toggle) | ✅ (nonaktifkan/aktifkan data) |
| `da` | ✅ | ✅ | ✅ | ✅ (submit/verify/certify) | — |
| `health-status` | ✅ | ✅ | ✅ | — | — |
| `waiver` | ✅ | ✅ | ✅ | ✅ (create/decide/send/revoke/public) | — |
| `emergency` | ✅ | — | ✅ (tabel antrean) | ✅ (submit/sync) | — |
| `my/profile` | ✅ | ✅ | ✅ | — | — |
| `my/mcu` | ✅ | ✅ | ✅ | — | — |
| `my/certificates` | ✅ | ✅ | ✅ | — | — |

## 5. Dialog Konfirmasi Aksi Berisiko

| Aksi | Halaman | Dialog |
|---|---|---|
| Nonaktifkan / Aktifkan master data (perusahaan, departemen, lokasi) | `master-data` | ✅ Konfirmasi sebelum PATCH status |
| Proses retur obat | `medicine/return` | ✅ Konfirmasi sebelum POST /pharmacy/returns |
| Finalisasi & Kunci rekam medis (SOAP) | `medical-records` | ✅ Konfirmasi sebelum POST /encounter/finalize |
| Approve / Tolak / Minta Revisi MCU | `mcu/review` | ✅ Konfirmasi sebelum POST /mcu/cycles/:id/ftw-assessment |

## 6. Validasi Form Seragam

Semua form submit sekarang menggunakan:
- **Error inline** — pesan error ditampilkan di atas form / di bidang terkait (contoh: `actionError` di waiver, master-data, da, medicine/return).
- **Pesan bahasa Indonesia yang jelas** — contoh: "Nama visitor, tujuan, dan tanggal berlaku wajib diisi.", "Batch, jumlah, dan alasan wajib diisi.", "Jumlah harus lebih dari 0."
- **State loading** — setiap tombol submit memiliki `disabled={saving}` dan label berubah (contoh: "Menyimpan...", "Memproses...").

## 7. State Setiap Submit

Setiap aksi mutasi sekarang memiliki tiga state terdefinisi:
1. **Loading** — tombol disabled + label "Menyimpan..." / "Memproses..." / Skeleton.
2. **Sukses** — toastSuccess + data di-refresh (refetch/load) + form direset.
3. **Gagal** — toastError + error inline ditampilkan + form tetap terbuka agar pengguna dapat memperbaiki.

## 8. Verifikasi

| Perintah | Hasil |
|---|---|
| `npx tsc --noEmit` | 0 error |
| `npx eslint .` | 0 error (9 warning pre-existing di file luar scope tugas ini) |
| `npx vitest run` | 344 lolos, 0 gagal |
| `npx next build` | Berhasil, semua 33 route ter-build |

## 9. Catatan

- Tidak ada perubahan pada backend. Semua panggil ke service API tetap sama (`waiverService`, `daService`, `pharmacyService`, `encounterService`, `masterDataService`, `mcuService`).
- Toast menggunakan `sonner` yang sudah terpasang sebagai dependency; `Toaster` sudah terpasang di root layout.
- `useSyncedModules` sudah menyediakan `loading`/`error`/`refetch` yang dimanfaatkan dashboard dan da untuk menampilkan Skeleton/ErrorState.
