# Target Performa Frontend (EMR Modul 01)

## Tujuan
Terasa cepat di HP dan jaringan lemah; semua halaman utama nyaman ditampilkan pada lebar layar 360 px.

## Target Core Web Vitals (draft — akan disetujui bersama stakeholder)

| Metrik | Target "Baik" | Ambang diperbaiki | Alat ukur |
|--------|---------------|-------------------|-----------|
| LCP | ≤ 2500 ms | ≤ 4000 ms | PerformanceObserver (`largest-contentful-paint`) |
| INP | ≤ 200 ms | ≤ 500 ms | Event Timing (`event`, `processingTime`) |
| CLS | ≤ 0.10 | ≤ 0.25 | Layout Shift |

Pengukuran dilakukan pada perangkat menengah (mid-range Android, ~4 GB RAM),
jaringan 3G lambat, dan cache dingin (LCP). Hasil ukuran per sesi disimpan di
`sessionStorage` kunci `kodein-klinik-vitals-last` dan bisa dibaca lewat
DevTools console:

```js
window.__klinkVitals.getLast()
// { lcp, inp, cls, at, url, targets: { LCP: 2500, INP: 200, CLS: 0.1 } }
```

## 360 px (mobile)
Semua halaman utama harus usable di lebar 360 px: tidak ada horizontal scroll,
target sentuh ≥ 44 px, teks tetap dapat dibaca, dan navigasi bottom tab
berfungsi.

## Tindakan yang telah dilakukan (frontend only, backend tidak diubah)

1. **Pengukuran performa** — `src/lib/web-vitals.ts` +
   `components/vitals-reporter.tsx`: pemasangan pengamat LCP/INP/CLS,
   penyimpanan hasil, dan exposur ke `window.__klinkVitals`.
2. **Optimasi font** — Inter melalui `next/font/google` di `src/lib/fonts.ts`
   (`display: "swap"`, self-hosted saat build, subset latin, bobot 400/500/600);
   cadangan font mono beralih ke stack sistem (`app/globals.css`).
3. **Pemecahan bundle / lazy-load komponen berat** — `RegistrationWizard`
   di halaman `/people/new` dimuat lewat `next/dynamic` dengan Suspense, sehingga
   tidak ada dalam bundle halaman awal.
4. **Virtualisasi daftar panjang** — `src/shared/components/virtual-list.tsx`
   diterapkan pada daftar pekerja (`/employees`) dan log audit (`/audit-logs`);
   hanya item yang terlihat yang dirender.
5. **Debounce pencarian** — `src/shared/utils/use-debounce.ts` (300 ms)
   diterapkan pada pencarian pekerja, log audit, dan kunjungan.
6. **Perilaku offline** — indikator offline persisten, antrean aksi lokal
   (`src/lib/offline-queue.ts` + Zustand store, disimpan ke localStorage),
   dan pesan saat tersambung kembali (toast sinkronisasi).

Catatan: backend tidak diubah — semua optimasi berada di sisi frontend.
