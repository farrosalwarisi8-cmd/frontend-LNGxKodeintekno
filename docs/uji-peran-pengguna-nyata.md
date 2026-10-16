# Uji skenario utama per peran — dengan pengguna nyata

Dokumen ini adalah **kit uji manual**. Tujuannya memenuhi kriteria: *“tiap peran
punya satu skenario utama yang selesai dalam beberapa langkah dan sudah dicoba
pengguna nyata.”*

Angka langkah di bawah sudah dibuktikan otomatis (`npm run test:roles`). Yang
**belum dan tidak bisa** dibuktikan otomatis adalah bagian “pengguna nyata” —
itu harus dijalankan oleh orang dengan peran tersebut, dan hasilnya dicatat di
lembar bawah.

## Cara menjalankan

```bash
npm run build && npm start -- --port 3001   # atau `npm run dev` untuk demo lokal
```

Login memakai akun demo (tombol di halaman `/login`) atau akun nyata di
lingkungan staging. Akun demo per peran:

| Peran | Akun demo | Catatan |
|---|---|---|
| Admin Klinik | mode demo → “Admin Klinik” | gunakan pemilih peran demo |
| Perawat | `perawat` | |
| Dokter (OH/Klinik) | `dr.hendra` / `dr.klinik` | |
| Apoteker | `apoteker` | butuh site/scope aktif untuk dispensing |
| HR/PIC | `hr.pic` | |
| HSE | `hse.officer` / `hse.manager` | |
| Pekerja | mode demo → “Worker/Public” | halaman `/my/*` |

## Skenario + anggaran langkah

Hitung setiap **klik, pilihan, dan pengetikan** sebagai satu langkah. Berhenti
menghitung saat hasil akhir terlihat.

| # | Peran | Skenario utama | Anggaran langkah | Hasil otomatis saat ini |
|---|---|---|---|---|
| 1 | Admin Klinik | Daftarkan kunjungan baru + catat TTV sampai tersimpan | ≤ 16 | 14 |
| 2 | Perawat | Panggil pasien berikutnya dari antrean | ≤ 3 | 1 |
| 3 | Dokter | Tulis SOAP (+ICD-10) lalu simpan ke backend | ≤ 10 | 5 |
| 4 | Apoteker | Proses dispensing resep (dengan peringatan stok/FEFO terlihat) | ≤ 6 | 4 |
| 5 | HR/PIC | Buka daftar MCU jatuh tempo dari dashboard | ≤ 3 | 1 |
| 6 | HSE | Saring pekerja dengan restriction | ≤ 3 | 2 |
| 7 | Pekerja | Lihat status kesehatan sendiri + riwayat MCU | ≤ 3 | 1 |

Apa yang harus diamati tiap skenario:

1. **Admin Klinik** — apakah nilai TTV di luar rentang wajar ditandai sebelum
   disimpan? Apakah tombol “Lanjut” menjelaskan kenapa tidak bisa ditekan?
2. **Perawat** — apakah tombol “Panggil berikutnya” langsung memanggil nomor
   antrean terlama? Apakah pencarian antrean terasa cukup cepat?
3. **Dokter** — apakah pencarian ICD-10 menemukan diagnosis dengan mengetik kode
   **atau** nama? Apakah status “Draft tersimpan otomatis” muncul dan draft
   kembali saat form dibuka lagi? Apakah riwayat pasien cukup ringkas?
4. **Apoteker** — apakah peringatan stok/FEFO terlihat **sebelum** menekan
   proses? Apakah tombol proses terkunci saat stok kurang?
5. **HR/PIC** — apakah satu klik dari dashboard langsung membuka daftar yang
   benar? Apakah filter yang sama masih terpasang saat halaman dibuka ulang?
6. **HSE** — apakah filter “Ada restriction” sesuai harapan (hanya pekerja
   dengan restriksi)?
7. **Pekerja** — apakah status Fitness to Work langsung terlihat tanpa mencari
   menu? Apakah nyaman dipakai di ponsel (satu kolom, tombol besar)?

## Lembar hasil (isi setelah uji)

Isi satu baris per peran. “Selesai tanpa bantuan” = peserta tidak perlu
dibantu/diarahkan peneliti.

| Peran | Nama pengguna | Tanggal | Langkah nyata | Waktu | Selesai tanpa bantuan | Hambatan yang ditemui |
|---|---|---|---|---|---|---|
| Admin Klinik | | | | | | |
| Perawat | | | | | | |
| Dokter | | | | | | |
| Apoteker | | | | | | |
| HR/PIC | | | | | | |
| HSE | | | | | | |
| Pekerja | | | | | | |

Tanda tangan penanggung jawab uji: ____________________  Tanggal: __________

## Tindak lanjut

- Hambatan yang muncul dicatat sebagai isu, lalu diperbaiki; setelah perbaikan,
  jalankan ulang `npm run test:roles` supaya anggaran langkah tetap terjaga.
- Perubahan anggaran langkah harus disengaja (satu baris di
  `scripts/role-scenarios.mjs#ROLE_BUDGET`) dan dijelaskan alasannya, bukan
  dilonggarkan agar uji lolos.
