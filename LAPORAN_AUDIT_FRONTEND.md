# Laporan Audit Frontend — KODEIN Klinik (kodein-klinik-demo)

**Cakupan:** hanya frontend Next.js 16 di folder ini. **Backend (KODEINxLNG-Backend) tidak diubah sama sekali** — dibaca hanya untuk pembandingan kontrak (`API_ENDPOINTS.md`).
**Metode:** pembacaan kode + typecheck + ESLint + Vitest + `next build` + render nyata di Chrome headless (CDP) terhadap dev server `localhost:3311`.
**Tanggal:** 7 Oktober 2026

---

## 0. Hasil Verifikasi (dijalankan, bukan klaim)

| Pemeriksaan | Hasil |
|---|---|
| `npx tsc --noEmit` | ✅ 0 error |
| `npx eslint app lib src components --quiet` | ✅ 0 error |
| `npx vitest run` | ⚠️ **114 lulus / 131**, 17 test **skipped** (file live-backend `describe.runIf(LIVE)` — backend tidak hidup saat audit) |
| `npm run build` | ❌ **GAGAL** — lihat temuan P0-1 |
| Render browser (Chrome CDP, semua route utama) | ⚠️ Halaman render, tetapi **tanpa sidebar/topbar/navigasi** — lihat temuan P0-2 |

---

## 1. Temuan Prioritas 0 (Bloking)

### P0-1 — `npm run build` (produksi) gagal total
```
⨯ useSearchParams() should be wrapped in a suspense boundary at page "/login".
Error occurred prerendering page "/login"
Export encountered an error on /login/page, exiting the build.  (exit 1)
```
`app/login/page.tsx` memakai `useSearchParams()` langsung di page component tanpa `<Suspense>`. Artinya **aplikasi tidak bisa di-deploy ke produksi**. Perbaikan frontend: bungkus isi login dengan `<Suspense fallback={...}>` (di page itu sendiri atau di `app/login/layout.tsx`).

### P0-2 — Shell navigasi utama tidak terpasang di route mana pun
Terverifikasi lewat CDP (DOM setelah hydration):

| Route | `nav/aside` | `a[href]` |
|---|---|---|
| `/dashboard` | 0 | **0** |
| `/mcu`, `/visits`, `/medicine`, `/users`, `/audit-logs`, `/da`, `/waiver`, `/emergency`, `/health-status`, `/master-data`, `/medical-records`, `/my/profile`, `/visits/queue`, `/mcu/review` | **0** | 0–5 (hanya tombol aksi) |
| `/people`, `/demo` | 3 | 26–30 (pakai `EmrShell`) |

Penyebab:
- `components/app-shell.tsx` (**AppShell** + AppSidebar + AppTopbar + ScopeSelector + OfflineIndicator + sync notifikasi) **tidak di-import oleh layout/halaman mana pun** → 0 pemakaian.
- `EmrShell` hanya dipasang di `app/people/layout.tsx` dan `app/demo/layout.tsx`.
- `app/layout.tsx` (root) hanya merender `{children}` + `<Toaster/>`.

Dampak: user di halaman utama **tidak punya menu navigasi sama sekali** — harus mengetik URL manual. Ini bug UX paling besar saat ini.

### P0-3 — Modul Notifikasi praktis mati di UI
- Pengambilan data backend `syncNotifications()` hanya dipanggil dari `components/app-shell.tsx` → karena AppShell tak terpakai, **`GET /notifications` tidak pernah dipanggil dari UI**.
- Dropdown notifikasi + mark-as-read (`PUT /notifications/:id/read`) hanya ada di `components/app-topbar.tsx` → juga tak terpakai.
- `EmrShell` menghitung `unreadCount` (baris 139) tetapi **tidak pernah me-render ikon Bell/daftar notifikasi** (variabel mati).

### P0-4 — Hydration error di `/people` dan `/demo`
CDP menangkap: `Error: Hydration failed because the server rendered HTML didn't match the client — a server/client branch 'if (typeof window !== "undefined")...'`. Perlu diperbaiki (kemungkinan `navigator.onLine`/random/time di render awal) agar tidak memicu regenerasi tree & flicker.

---

## 2. Temuan Prioritas 1 — Frontend yang masih kurang

### P1-1 — Komponen & kode mati (dead code)
| Kode | Pemakaian |
|---|---|
| `components/app-shell.tsx`, `app-sidebar.tsx`, `app-topbar.tsx` | 0 (padahal berisi fitur notifikasi, scope selector, offline indicator) |
| `components/route-guard.tsx` | 0 → matriks `ROUTE_PERMISSIONS` (22 route) **tidak aktif**; proteksi hanya `middleware.ts` (cek cookie, bukan permission) |
| `components/error-boundary.tsx` | 0 → tidak ada error boundary di root layout |
| `components/page-header.tsx`, `pagination.tsx`, `stat-card.tsx`, `status-badge.tsx`, `employee-picker.tsx` | 0 |
| `components/ui/*` (shadcn) | 16 dari 26 komponen tidak dipakai (alert, dialog, table, tabs, select, skeleton, textarea, tooltip, dll.) |

### P1-2 — Duplikasi store yang sudah tidak sinkron
- `lib/store.ts` = **818 baris**, versi terhubung backend (`login` async, `commitSession`, cookie middleware).
- `src/lib/store.ts` = **744 baris**, versi lama (`login` synchronous, tanpa cookie).
- Alias `@/*` → `[./*, ./src/*]` sehingga versi root yang dipakai, tetapi laporan sebelumnya menyebut "kedua file identik" — **itu sudah tidak berlaku**. `src/lib/store.ts` adalah versi basi yang menyesatkan dan wajib disingkirkan/diselaraskan.

### P1-3 — Halaman yang belum tersambung ke backend
| Halaman | Status data |
|---|---|
| `/health-status` | murni store lokal (`workHealthStatus`), tidak ada sync |
| `/waiver` | data hardcoded `WAIVERS`, tidak ada endpoint padanan dipakai |
| `/emergency` | queue lokal `INITIAL_QUEUE`; tombol "Sinkronkan" hanya menandai flag lokal — **Domain 11 backend (`POST /sync/push`, `/sync/pull`, `/sync/conflicts`, `/sync/register-device`) tidak dipakai sama sekali** |
| `/my/profile`, `/my/mcu`, `/my/certificates` | store lokal. Terverifikasi di browser: `/my/profile` menampilkan **"Data pekerja tidak ditemukan."** (employeeId user tidak cocok dengan data pekerja) |
| `/people`, `/public/consent`, `/demo` | mock service Modul 01 (by design, tetapi membingungkan b berdampingan dengan `/employees`) |

### P1-4 — Endpoint backend yang belum dipanggil frontend (±14 fungsional dari 64)
Berdasarkan diff `API_ENDPOINTS.md` vs pemanggilan `apiClient.*`:

- **Domain 5 Diagnostic (0 UI):** `POST /diagnostic/lab-orders`, `/lab-results`, `/lab-results/:id/verify`, `/radiology-orders`, `/radiology-results` — tidak ada halaman Lab/Radiologi, padahal NAV `lab` mengarahkan "Lab Orders/Lab Results/Radiology" ke `/mcu` (salah tujuan).
- **Domain 11 Offline/Edge (0 UI):** `POST /sync/register-device`, `/sync/push`, `/sync/conflicts/:id/resolve`, `GET /sync/pull`, `/sync/conflicts`.
- **Lainnya:** `GET /mcu-status/:identifier`, `GET /satusehat/fhir/encounter/:id`, `POST /admin/api-clients`, `POST /mcu/cycles/bulk-import` + `GET .../status` (hanya disebut di komentar `mcu.service.ts`, tak ada pemanggilan), `GET /iam/users/:id` (tak dipakai).
- `POST /signatures/callback` = webhook provider (wajar tidak ada di UI).
- Endpoint yang sudah terpakai: ±48 (auth, patients, consents, clinic, mcu, pharmacy, notifications-read, iam, reports, documents, da, analytics, icd10).

### P1-5 — Login sepenuhnya bergantung backend hidup
Tanpa backend di port 3000, login gagal: *"Tidak dapat terhubung ke server backend. Pastikan backend berjalan di port 3000."* — tidak ada fallback demo/offline, padahal aplikasi masih memuat seed lokal 30 pekerja. Untuk demo luring perlu diputuskan: apakah login seed lokal masih diaktifkan.

### P1-6 — Test live tidak berjalan
17 dari 131 test **skipped** (`describe.runIf(LIVE)`) karena backend tidak hidup saat audit. Angka "131 lulus" di laporan sebelumnya tidak tercapai dalam kondisi ini.

---

## 3. Temuan UI/UX

### P1-7 — Navigasi & konsistensi
- **Tidak ada navigasi global** (P0-2) — dampak terbesar.
- **Dua "daftar pekerja" berbeda**: `/people` (Modul 01, shell `EmrShell`, banner demo, mock) vs `/employees` (data backend, tanpa shell). Perlu digabung atau dipisah tegas.
- **Banner & footer menyesatkan**: `EmrShell` masih menampilkan *"Demo mode — data dan permission disimulasikan di frontend"* dan *"Frontend-only demo · No backend"*, padahal aplikasi kini terhubung backend nyata.
- **Metadata basi**: `app/layout.tsx` title masih *"Modul 01"* dan deskripsi *"Registrasi Pekerja, MRN, dan Consent"* — tidak mencakup modul klinik/MCU/farmasi yang sudah ada.

### P1-8 — Loading / error / empty state belum konsisten
- Halaman dengan Skeleton+ErrorState+refetch (sudah baik): `employees`, `mcu`, `mcu/new`, `mcu/review`, `medicine`, `medicine/dispense`, `medical-records`, `visits`, `visits/new`, `visits/queue`, `users`, `audit-logs`, `reports`, `certificates`.
- **Memanggil `useSyncedModules` tetapi mengabaikan `loading`/`error`** (tanpa Skeleton/ErrorState/retry): `dashboard`, `master-data`, `da`.
- **Tanpa EmptyState**: `health-status` (hanya teks "0 status kesehatan"), `da`, `waiver`, `emergency`, `my/*` — list kosong tampil sebagai layar hampa.
- `/certificates` saat backend mati menampilkan error inline "Gagal memuat data dari backend" tanpa tombol coba-ulang yang menonjol.

### P2-9 — Aksesibilitas
- **35 dari 67** elemen `<Input>` di halaman tanpa `label` (hanya placeholder).
- Total `aria-label` di seluruh `app/` + `components/` hanya **6**.
- Modal `emergency` dan `waiver` dibuat manual (`div fixed`) — tanpa `role="dialog"`, `aria-modal`, focus trap, dan handler Escape (padahal design-system `Modal` sudah tersedia).
- `Toaster` (sonner) terpasang di root layout tetapi **tidak ada satu pun `toast()` dipanggil** di aplikasi → umpan balik sukses memakai teks lokal (`msg`) yang mudah hilang dan tidak konsisten antarhalaman.
- Sisi positif: halaman utama sudah responsif (grid `sm:`/`lg:`), status tidak hanya berbasis warna (ada label), tombol demo login berlabel jelas.

### P2-10 — Dua design system paralel
- 24 file memakai `@/shared/components/design-system/*`, hanya 2 memakai `components/ui/*` (shadcn), sedangkan `components/ui/*` berisi 26 komponen (mayoritas tak terpakai). Perlu satu sumber komponen agar styling & aksesibilitas konsisten.

---

## 4. Rekomendasi (urutan pengerjaan, tetap frontend-only)

**P0**
1. Perbaiki build: bungkus `useSearchParams()` di `/login` dengan `<Suspense>` → `npm run build` harus exit 0.
2. Pasang shell navigasi: buat route group (mis. `app/(app)/layout.tsx`) yang merender `EmrShell` **atau** aktifkan kembali `AppShell` untuk semua halaman setelah login; pastikan sidebar/topbar/bottom-nav muncul di seluruh route.
3. Pindahkan fitur notifikasi (fetch `GET /notifications`, dropdown, mark-as-read) ke shell yang aktif; render ikon Bell + badge `unreadCount` di `EmrShell`.
4. Perbaiki hydration error `/people` & `/demo`.

**P1**
5. Aktifkan `RouteGuard` (atau pindahkan matriks permission ke shell aktif) agar RBAC client-side berfungsi; perbaiki NAV `lab` yang mengarah ke `/mcu`.
6. Selaraskan/hapus duplikat `src/lib/store.ts`.
7. Sinkronkan `/health-status` (data FTW backend), pertimbangkan endpoint untuk waiver, dan hubungkan `/emergency` ke Domain 11 `sync/*` — atau tandai jelas sebagai data lokal.
8. Tambahkan Skeleton/ErrorState/EmptyState di `dashboard`, `master-data`, `da`, `health-status`, `waiver`, `emergency`, `my/*`; perbaiki `/my/profile` yang selalu "Data pekerja tidak ditemukan".
9. Hapus/ubah banner *"Frontend-only · No backend"* dan perbarui metadata title/deskripsi.
10. Jalankan ulang 17 test live dengan backend hidup.

**P2**
11. Aksesibilitas: label semua input, `role="dialog"` + focus trap untuk modal manual, manfaatkan `toast()` yang sudah terpasang.
12. Konsolidasi design system (pilih design-system internal atau shadcn, hapus sisanya) dan bersihkan dead code (10+ komponen tak terpakai).
13. Bila produk butuh: halaman Lab/Radiologi (Domain 5) dan UI import MCU bulk — saat ini backend-nya ada, frontend-nya belum.

---

## 5. Catatan

- **Backend tidak diubah** — tidak ada satu pun file di `KODEINxLNG-Backend` yang disentuh dalam audit ini.
- Angka "38 endpoint terkontrak / 131 test lulus / build OK" di `LAPORAN_MODUL.md` tidak sepenuhnya terulang dalam kondisi audit ini: build **gagal**, test live **17 skipped**.
