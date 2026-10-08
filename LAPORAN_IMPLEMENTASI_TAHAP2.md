# Laporan Penyempurnaan Tahap 2 Frontend

## Status
- **COMPLETE**

Semua acceptance criteria Tahap 2 lulus: permission pada route, sidebar, mobile bottom
navigation, dan tombol/action; demo role konsisten; AccessDenied jelas; model permission
duplikat dibersihkan; unit test + browser verification lulus; build lulus.
(Temuan yang tetap bukan bagian dari task dicatat pada **Known limitations**.)

## Scope
- Frontend only: **YES**
- Backend changed: **NO** (folder `KODEINxLNG-Backend/` tidak disentuh)
- Database changed: **NO**
- Endpoint changed: **NO**
- Migration/deployment/infra: **NO**

## Ringkasan perubahan
- **Permission action**: registry baru `lib/actions.ts` (`ACTION_PERMISSIONS`, `canPerform`) +
  hook/komponen `components/can.tsx` (`useCan()`, `<Can action>`). **19 aksi** dipetakan ke
  permission resmi dan dipakai pada **34 pemakaian `<Can>` di 17 berkas** + `useCan()` di 2
  berkas (tab Activity profil pekerja & penjaga alur permintaan tanda tangan): tambah pekerja,
  buat MCU, approve/revisi MCU, kunjungan baru, simpan SOAP, terima stok, dispensing,
  terbitkan/cabut sertifikat + **request signature PSrE** (`documents.request-signature`),
  ekspor laporan, kelola user, tambah master data, waiver, D&A, emergency.
  Permission baru ditambahkan secara backward-compatible: `approve-mcu`, `edit-visit`,
  `upload-document`, `export-reports`.
- **Mobile bottom navigation**: `getBottomNavigation(role)` + `getOverflowNavigation(role)` di
  `src/lib/navigation.ts`. Bottom bar difilter dari **registry permission yang sama** dengan
  sidebar (`NAVIGATION_ITEMS` → `getNavigation`); hanya labelnya dipendekkan untuk bar sempit.
  Tombol "Lainnya" hanya muncul bila ada item tambahan yang boleh diakses.
- **Demo role**: mapping tunggal `DEMO_ROLE_TO_ROLE` (`src/lib/demo-role-map.ts`) +
  `useDemoMode()` (`src/lib/demo-role.ts`) yang menghasilkan **role efektif**. Demo mode kini
  punya flag `enabled` (default `false` = perilaku produksi/session role). Memilih role di
  `/demo` mengaktifkan demo mode; ada tombol nonaktifkan. Role efektif dipakai oleh sidebar,
  bottom nav, route guard, tombol action, dan badge profil → konsisten.
- **`/demo` behavior**: diputuskan sebagai **route INTERNAL** (butuh login). `/demo` dihapus
  dari `PUBLIC_PATHS` (`lib/public-paths.ts` + `middleware.ts`) dan dokumen diperbarui.
- **AccessDenied**: auto-redirect dihapus. Pengguna yang sudah login tetapi tidak berizin
  **tetap** di halaman AccessDenied (terverifikasi >3,5 detik) dan konten terlindungi tidak
  pernah dirender. Keputusan guard diekstrak ke fungsi murni `resolveRouteAccess()`.
- **Legacy permission cleanup**: `NAV` + `canLegacy()` dihapus dari `lib/rbac.ts`; model
  permission kedua `src/shared/permissions/permissions.ts` (+ test-nya) dihapus dan
  `employee-profile.tsx` dipindah ke registry resmi; 5 komponen mati yang memakai `NAV`
  dihapus (`app-shell`, `app-sidebar`, `app-topbar`, `page-header`, `stat-card`).
- **Store**: tetap satu store `lib/store.ts`; `src/lib/store.ts` tidak dibuat kembali
  (dijaga test konsistensi).

## Acceptance matrix
| Item | Status | Bukti |
|---|---|---|
| Route guard | PASS | `resolveRouteAccess()` untuk loading/login/denied/allow; `src/lib/__tests__/route-guard.test.ts` (21 test); browser: `/users` & `/medicine` → denied tanpa bocor konten |
| Sidebar permission | PASS | `getNavigation(role)` + test per role; browser: admin 19 item, dokter-oh 11 item (tanpa User/Master Data/Audit Log/Farmasi), HR 10 item |
| Mobile nav permission | PASS | `getBottomNavigation` + test; browser: HR/dokter/perawat/pekerja **tanpa** Farmasi, apoteker & admin **dengan** Farmasi, label `Dashboard, MCU, Kunjungan` |
| Action permission | PASS | `ACTION_PERMISSIONS` + `canPerform` (10 test); 34 pemakaian `<Can>` di 17 berkas; alur permintaan tanda tangan dijaga ganda (`<Can>` + guard `useCan()` di handler); browser: HR tanpa aksi admin/farmasi, admin melihat "Tambah pekerja", dokter-oh melihat "Terbitkan"; CTA "Tambah Pekerja" di `/employees` diperbaiki dari `/employees/new` (route tidak ada) → `/people/new`, diverifikasi di browser tanpa 404 |
| Demo role consistency | PASS | `demo-role.test.ts` (menu, bottom nav, action, non-superuser); browser: pilih HR/PIC → sidebar & bottom nav berubah, role efektif `hr` |
| AccessDenied | PASS | Tidak pernah render konten protected; tetap tampil >3,5 dtk; link "Kembali ke dashboard" bekerja; mobile rapi |
| Store consolidation | PASS | `src/lib/store.ts` tidak ada; test `store-import-consistency.test.ts`; `auth-store.test.ts` (login/MFA/restore/logout) |
| Legacy cleanup | PASS | `NAV`/`canLegacy`/`src/shared/permissions` nol referensi (dijaga test); 5 komponen mati dihapus |
| Unit tests | PASS | `npx vitest run` → **259/259, 19 file** (baseline 196/196, 14 file) |
| Browser tests | PASS | 21/21 (script utama) + 18/18 (role tambahan) + 5/5 (anon `/demo`, AccessDenied 360px, offline, CTA sertifikat) = **44/44**, 0 console error |

## Baseline vs final
| Command | Baseline | Final |
|---|---|---|
| `npx tsc --noEmit` | PASS | PASS |
| `npx eslint app lib src components --quiet` | PASS | PASS |
| `npx vitest run` | PASS (196/196, 14 file) | PASS (**259/259, 19 file**) |
| `npm run build` | PASS | PASS |

Baseline diukur pada working tree sebelum perubahan task ini (HEAD `f5a5150` + pekerjaan
Tahap 2 sebelumnya). Tidak ada test yang di-skip.

## Browser verification
| Scenario | Result | Notes |
|---|---|---|
| Admin | PASS | Login **nyata** (`admin`) ke backend; 19 item sidebar; bottom nav Dashboard/MCU/Kunjungan/Farmasi + Lainnya |
| HR/PIC | PASS | Demo mode HR/PIC; sidebar tanpa Farmasi/User/Audit Log; bottom nav 3 item tanpa Farmasi; tanpa aksi administratif |
| Dokter OH | PASS | Login **nyata** (`dr.hendra`); Review MCU & Sertifikat tampil, User/Master Data/Audit Log/Farmasi tidak; `/mcu/review` boleh, `/users` & `/medicine` ditolak |
| Apoteker | PASS | **Sesi simulasi** (backend tidak punya akun — lihat Backend follow-up); sidebar & bottom nav memuat Farmasi, `/medicine` boleh, `/users` ditolak |
| Pekerja | PASS | Demo mode Worker/Public; menu tanpa People/User/Farmasi/Rekam Medis; `/people` ditolak tanpa bocor konten |
| Perawat | PASS | **Sesi simulasi**; bottom nav tanpa Farmasi, "Registrasi Kunjungan" ada, `/visits/new` boleh, `/medicine/dispense` ditolak |
| Unauthorized route | PASS | `/users`: AccessDenied tampil, tidak redirect otomatis setelah 3,5 dtk, konten terlindungi tidak dirender, link dashboard berfungsi |
| Mobile 360px | PASS | 27 kombinasi halaman/lebar bersih (admin 24 + apoteker 3), tanpa horizontal overflow; bottom bar tetap rapi; **AccessDenied 360px**: tanpa overflow, link "Kembali ke dashboard" terlihat & benar |
| Mobile 390px | PASS | 4 halaman admin bersih; bottom nav 4 item + Lainnya |
| Notification regression | PASS | Bell membuka panel (`#notification-panel`, heading "Notifikasi"), bisa ditutup kembali, 0 console error |
| Login/logout/session | PASS | Login nyata 2 akun; refresh `/reports` tetap di halaman (session restore); logout → `/login` + token dibersihkan |
| `/demo` anonim | PASS | Redirect bersih ke `/login?from=%2Fdemo`, form login tampil, tetap sama setelah 3,5 dtk (bukan loop/redirect tak terduga) |
| Offline indicator | PASS | Event `offline` → indikator "Offline" muncul; event `online` → hilang (regresi Tahap 1 aman) |
| Console error | PASS | 0 error di seluruh sesi verifikasi (21+18+5 skenario) |

Panggilan backend nyata terverifikasi (contoh session 1): `POST /auth/login`,
`GET /notifications` (38x), `GET /patients`, `GET /mcu/cycles`, `GET /clinic/queues`,
`GET /pharmacy/inventory`, `GET /analytics/top-diseases`, `GET /reports/definitions`.

## Files changed
**Baru**
- `lib/actions.ts`, `lib/public-paths.ts`, `components/can.tsx`
- `src/lib/demo-role.ts`, `src/lib/demo-role-map.ts`
- Test: `src/lib/__tests__/actions.test.ts`, `auth-store.test.ts`, `demo-role.test.ts`,
  `public-paths.test.ts`, `store-import-consistency.test.ts`, `route-existence.test.ts`
  (menjaga "tidak ada link internal ke route yang tidak ada")
- Dokumen: `ACCESS_ARCHITECTURE.md` (ditulis ulang), laporan ini

**Diubah**
- Guard/shell/nav: `components/route-guard.tsx`, `components/emr-shell.tsx`,
  `src/lib/navigation.ts`, `middleware.ts`, `lib/rbac.ts`
  (`components/access-denied.tsx` dibuat pada sesi Tahap 2 sebelumnya dan **tidak diubah** —
  tampilan/link-nya sudah sesuai behavior baru)
- Demo: `src/features/people/hooks/use-demo-role.ts`,
  `src/features/people/components/demo-page.tsx`, `employee-profile.tsx`, `people-list.tsx`
- Halaman action: `certificates`, `da`, `emergency`, `employees`, `master-data`, `mcu`,
  `mcu/review`, `medical-records`, `medicine`, `medicine/dispense`, `reports`, `users`,
  `visits`, `visits/new`, `waiver`
- Test: `src/lib/__tests__/navigation.test.ts` (termasuk mempertahankan seluruh test lama),
  `rbac.test.ts`, `route-guard.test.ts`, `store.test.ts`

**Dihapus**
- `components/app-shell.tsx`, `app-sidebar.tsx`, `app-topbar.tsx`, `page-header.tsx`,
  `stat-card.tsx`
- `src/shared/permissions/permissions.ts` + `src/shared/permissions/__tests__/permissions.test.ts`
- `src/lib/store.ts` (duplikat store, sudah dihapus pada Tahap 2 sebelumnya)

Dari pekerjaan Tahap 1 sebelumnya (masih dalam working tree): `app/(app)/layout.tsx`,
`app/layout.tsx`, `app/globals.css`, `components/breadcrumb.tsx`, `lib/utils.ts`,
`lib/store.ts`, `src/shared/components/design-system/button.tsx`,
`src/features/people/components/registration-wizard.tsx`, `vitest.config.ts`,
`app/(app)/my/*`.

## Backend follow-up
1. **Akun uji per role**: backend hanya punya 2 akun seed (`admin`, `dr.hendra`). Role
   Apoteker & Perawat diverifikasi dengan **sesi injeksi + API distub** (client-side decision
   valid; isi data tidak dinilai). Tambahkan akun uji (atau endpoint seeding) agar verifikasi
   role lain memakai login nyata.
2. **Notifikasi kosong**: `GET /api/v1/notifications` mengembalikan `[]` untuk akun uji,
   sehingga alur "mark as read" tidak bisa diuji dengan data nyata (yang terverifikasi:
   panel buka/tutup & tidak ada error). Perlu data notifikasi uji.
3. **Otorisasi backend**: permission frontend hanya UI/UX. Pastikan setiap endpoint
   memvalidasi role/scope (permission frontend tidak boleh dianggap kontrol keamanan).
4. `PATCH`/`DELETE` pada `/master-data`, `/users`, `/waiver`, `/da` masih berupa UI
   tersimulasi (tombol sudah benar permission-nya, handler backend belum dihubungkan).

## Known limitations
1. **`/audit-logs` belum punya CTA ekspor** — diverifikasi dengan `grep -i "export|ekspor|unduh|csv"` pada
   halaman tersebut: hanya deklarasi `export default`, tidak ada tombol ekspor. Satu-satunya
   aksi di halaman ini adalah "Verifikasi Rantai Hash" (read-only, dilindungi
   `view-audit-logs`).
2. **Tidak ada UI retur stok** — `grep -i "retur"` pada `app/` & `src/features/` tidak menemukan
   tombol/aksi retur (hanya statement `return`), sehingga tidak ada yang perlu dipetakan.
3. **`people.upload-document`** sudah dipetakan (`upload-document` untuk admin & HR), tetapi
   halaman profil pekerja saat ini hanya menampilkan daftar dokumen tanpa tombol unggah —
   mapping siap dipakai saat UI unggah ditambahkan.
4. **`admin` tidak punya `issue-certificate`** (perilaku lama yang dipertahankan; ada test
   yang mengunci ini). Artinya admin tidak melihat menu Sertifikat. Bila diinginkan berbeda,
   ini keputusan produk, bukan bug permission.
5. Aksi pada halaman yang dibuka lewat route yang sudah dilindungi (waiver, D&A, emergency,
   medicine, users, master data) tetap dibungkus `<Can>` untuk konsistensi, tetapi lapisan
   pertama proteksinya adalah route guard.
6. Link teks breadcrumb masih ~28px (di bawah panduan tap target 44px) — bukan tombol.
7. Halaman `/employees` dan `/people` sama-sama berisi master pekerja dengan judul berbeda;
   CTA "Tambah Pekerja" di `/employees` menunjuk wizard `/people/new` (route `employees/new`
   tidak pernah ada). Penggabungan kedua halaman adalah pekerjaan lanjutan, bukan permission.
8. `components/ui/*` (kit shadcn) tidak dibersihkan karena di luar cakupan task; tidak
   ditemukan komponen runtime yang mengimpor model permission lama.
9. Alur **"mark as read" notifikasi** dengan data nyata belum bisa diuji karena
   `GET /api/v1/notifications` mengembalikan `[]` untuk akun uji (Backend follow-up).

## Final decision
- Tahap 2 **COMPLETE**
- Alasan: seluruh acceptance criteria pada §3–§14 terpenuhi dan dibuktikan; kualitas gate
  (`tsc` 0, ESLint 0, Vitest **259/259** (19 berkas), `npm run build` 0) dan browser
  verification (**44/44 skenario**, 0 console error) lulus; tidak ada model permission aktif
  yang duplikat; temuan sisa hanya berupa follow-up backend dan keputusan produk yang
  didokumentasikan di atas.
