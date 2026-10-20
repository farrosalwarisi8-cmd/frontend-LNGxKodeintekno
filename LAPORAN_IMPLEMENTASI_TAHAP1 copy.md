# Laporan Implementasi Tahap 1 Frontend

## Status
- COMPLETE

## Scope
- Frontend only: YES
- Backend changed: NO
- Database changed: NO

## Perubahan P0-1 — Build Login
- File yang diubah:
  - `app/login/page.tsx` (diubah) — menjadi wrapper `<Suspense fallback={<LoginLoadingState />}>`.
  - `app/login/login-page-content.tsx` (baru) — seluruh isi halaman login (`'use client'`, memakai `useSearchParams`).
  - `app/login/login-page-content.tsx` juga kini memakai `resolveLoginRedirect(from)` dari `src/lib/navigation.ts` pada 2 lokasi redirect (login & verifikasi MFA) — `?from=` internal tetap dipertahankan, `?from=` eksternal/open-redirect diblokir ke `/dashboard`.
- Solusi Suspense: pemisahan page wrapper + client content sesuai pola yang disarankan; semua behavior login existing (query param `from`, MFA, lockout, akun demo) dipertahankan; fallback `LoginLoadingState` memiliki layout login yang mirip sehingga tidak ada layout shift ekstrem.
- Hasil npm run build: **PASS (exit 0)** — baseline sebelum tahap ini: exit 1 (`useSearchParams() should be wrapped in a suspense boundary at page "/login"`).

## Perubahan P0-2 — Global Shell
- Shell yang digunakan: **EmrShell** (Opsi A — route group; `AppShell`/`AppSidebar`/`AppTopbar` lama TIDAK dirender sehingga tidak ada nested shell).
- Route internal yang sudah dibungkus: 18 folder route dipindah ke `app/(app)/` lewat route group (URL tidak berubah): audit-logs, certificates, da, dashboard, demo, emergency, employees, health-status, master-data, mcu, medical-records, medicine, my, people, reports, users, visits, waiver. Layout baru `app/(app)/layout.tsx` = `<EmrShell>{children}</EmrShell>`; layout lama `people/layout.tsx` & `demo/layout.tsx` dihapus. `/login`, `/public/*`, `/verify/*` di luar group (tanpa shell internal).
- Sidebar: desktop `aside[aria-label="Navigasi utama"]` dari navigasi sentral `src/lib/navigation.ts#getNavigation(role)` (permission difilter via `can()` dari `lib/rbac`); drawer mobile `aria-label="Navigasi mobile"`; item `Lab & Radiologi` (`/lab`) tampil **disabled "Segera hadir"** (tidak diarahkan ke `/mcu`); `lib/rbac.ts#NAV.lab` diperbaiki (href `/lab`, `NavItem.disabled?` ditambahkan).
- Topbar: desktop sticky (`hidden lg:flex`, min-width lg) berisi `Breadcrumb` + indikator offline `role="status"` + `NotificationBell` + user menu (`aria-haspopup`/`aria-expanded`, link `/my/profile`, tombol Keluar); header mobile compact (`lg:hidden`) berisi brand + bell + tombol menu `aria-expanded`.
- Breadcrumb: `components/breadcrumb.tsx` baru — `aria-label="Breadcrumb"`, desktop penuh, mobile 2 item terakhir, halaman aktif bukan link, label bahasa Indonesia dari `ROUTE_LABELS` + fallback humanize.
- Mobile bottom navigation: `nav[aria-label="Navigasi bawah"]` dengan deteksi aktif `isNavActive` (parent aktif jika child aktif; `/dashboard` hanya aktif persis).
- Offline indicator: nilai awal `INITIAL_ONLINE = true` (identik server/client), disinkronkan setelah mount via event `online`/`offline`, ditampilkan dengan teks + ikon (`role="status"`) di topbar desktop dan banner mobile — bukan warna saja.

## Perubahan P0-3 — Notifikasi
- API/service yang digunakan: **existing, tanpa endpoint baru** — `GET /api/v1/notifications` via `syncNotifications()` (`lib/remote-sync.ts`) + `PUT /api/v1/notifications/:id/read` via `notificationService.markAsRead` (`src/lib/services/notification.service.ts`), dipanggil lewat hook repository `useSyncedModules` (fetch sekali saat shell mount, tidak berulang saat ganti route; retry via `refetch`).
- Bell: `components/notification-bell.tsx` baru — ikon Bell di topbar desktop & header mobile; `aria-label` dinamis (`"Notifikasi, N belum dibaca"` / `"Notifikasi"`), `aria-expanded` + `aria-controls="notification-panel"`; trigger `size-11` mobile (44 px) / `size-9` desktop.
- Unread badge: `formatBadgeCount` — 0 → tidak tampil (tanpa badge `0`), >99 → `99+`; angka dari `unreadCount` (hanya notifikasi milik user aktif, dari respons API).
- Mark as read: optimis ke store lalu `PUT /notifications/:id/read`; **rollback penuh** `useStore.setState({notifications: before})` + pesan `role="alert"` bila API gagal; "Tandai semua" dengan rollback penuh; panel `role="dialog"` + `aria-label="Daftar notifikasi"`; Escape menutup + fokus kembali ke trigger; klik luar menutup; item unread punya highlight + titik `aria-label="Belum dibaca"`; klik item → mark read + `router.push(n.link)` bila ada.
- Loading/error/empty state: skeleton ×3 (`aria-busy`), error + tombol "Coba lagi", empty state "Tidak ada notifikasi.", daftar sukses — keempat state terverifikasi di browser. Mobile: bottom sheet (`fixed inset-x-0 bottom-0 rounded-t-2xl`); desktop: dropdown (`lg:absolute right-0 top-full w-96`).

## Perubahan P0-4 — Hydration
- Root cause `/people`: komponen shell `components/emr-shell.tsx` (hanya dipakai `/people` & `/demo` saat itu) memakai `useOnline()` yang membaca `navigator.onLine` saat inisialisasi state → state server (`true`) ≠ state client (bisa `false`) → node footer berbeda kelas (`px-4 py-3` saat online vs `p-4` saat offline) → hydration mismatch.
- Root cause `/demo`: **sama persis** — kedua route adalah satu-satunya yang membungkus konten dengan `EmrShell` sehingga satu-satunya route yang terdampak oleh `useOnline()`; kini semua route internal memakai shell yang sama, jadi wajib diperbaiki sekali di shell.
- Perbaikan: `src/lib/online.ts` (baru) mengekspor `INITIAL_ONLINE = true` konstan + `onlineStateFromEvent()`; `useOnline` di `emr-shell.tsx` diinisialisasi dengan `INITIAL_ONLINE` lalu disinkronkan setelah mount melalui effect + event listener `online`/`offline` (pola aman §11). **Tanpa `suppressHydrationWarning`, tanpa mematikan SSR.** Sumber mismatch lain (localStorage/demo role/Date/random) juga diinspeksi — tidak ada yang membaca browser API saat server render.
- Hasil browser console: hard refresh (`Page.reload` + `ignoreCache: true`) pada `/people` dan `/demo` → **0 console error, 0 hydration warning/error**; seluruh skenario E2E lain juga 0 console error.

## Files changed
- `app/login/page.tsx` (diubah — Suspense wrapper)
- `app/login/login-page-content.tsx` (baru — isi login + `resolveLoginRedirect`)
- `app/(app)/layout.tsx` (baru — wrapper shell global)
- `app/(app)/<18 route folders>/` (dipindah dari `app/` — route group, URL tidak berubah)
- `app/people/layout.tsx`, `app/demo/layout.tsx` (dihapus — diganti layout group)
- `components/emr-shell.tsx` (diubah — nav sentral, topbar desktop, breadcrumb mobile, offline fix, bottom-nav, footer)
- `components/notification-bell.tsx` (baru — bell + panel + mark-as-read)
- `components/breadcrumb.tsx` (baru)
- `src/lib/navigation.ts` (baru — NAVIGATION_ITEMS, ROUTE_LABELS, getNavigation, isNavActive, buildBreadcrumbs, resolveLoginRedirect)
- `src/lib/notification-utils.ts` (baru — unreadCount, notificationsForUser, applyMarkRead, applyMarkUnread, formatBadgeCount)
- `src/lib/online.ts` (baru — INITIAL_ONLINE, onlineStateFromEvent)
- `lib/rbac.ts` (diubah — `NavItem.disabled?`, NAV `lab` → `/lab` disabled)
- `components/app-sidebar.tsx`, `components/app-topbar.tsx` (diubah — render item disabled; shell lama, tidak dirender)
- `src/lib/__tests__/navigation.test.ts` (baru — 21 test)
- `src/lib/__tests__/notification-utils.test.ts` (baru — 12 test)
- `src/lib/__tests__/online.test.ts` (baru — 2 test)
- `LAPORAN_IMPLEMENTASI_TAHAP1.md` (baru — laporan ini)

## Commands executed
| Command | Result |
|---|---|
| `npx tsc --noEmit` | PASS (exit 0) |
| `npx eslint app lib src components --quiet` | PASS (exit 0) |
| `npx vitest run` | PASS (exit 0 — 166/166: 11 file, baseline 131 + 35 baru) |
| `npm run build` | PASS (exit 0 — baseline: exit 1) |

## Browser verification
- `/login`: PASS (render; `?from=/people` → redirect `/people`; `?from=https://evil.example` → diblokir ke `/dashboard`; 4/4 assertion; tanpa bell/sidebar/bottom-nav internal — 3 assertion; 0 console error)
- `/dashboard`: PASS (shell lengkap: 24 nav links, breadcrumb, topbar user area "B Bagus Pratama · System Administrator", bottom-nav)
- `/people`: PASS (hard refresh `ignoreCache` → 0 hydration/console error)
- `/demo`: PASS (hard refresh `ignoreCache` → 0 hydration/console error)
- `/mcu`: PASS (render tanpa error)
- `/visits`: PASS (render tanpa error)
- `/medicine`: PASS (render tanpa error)
- Mobile: PASS (360px: sidebar hidden, bottom-nav 4 link setinggi 60px, bell 44×44, semua 8 tombol/link terlihat ≥44 px — 2 tombol (`Menu` 36px, `Tutup banner demo` 18px) diperbaiki ke `size-11` di `emr-shell.tsx`, tanpa horizontal overflow, sidebar tidak ganda; re-check hydration `/people` & `/demo` setelah edit → 0 console log)
- Notification panel: PASS (15/15 assertion via CDP Fetch intercept: empty state real API, badge "1 belum dibaca", 2 item, "Tandai semua" → `PUT /notifications/e2e-n1/read`, PUT 500 → rollback + `role="alert"`, kembali empty; 0 console error)
- Offline toggle: PASS (9/9 assertion via CDP `Network.emulateNetworkConditions`: online → badge offline tidak tampil (desain subtle); offline → `role="status"` + teks "Offline" (ikon + teks, bukan warna saja); layout tidak berkedip (tinggi badan 1928→1928 px); online kembali → badge hilang; 0 console error saat toggle; hard reload setelah toggle → console bersih)

Total browser assertions: **47/47 PASS** (19 alur utama + 15 notifikasi + 4 login redirect + 9 offline/shell).

## Backend follow-up
- Tabel `notifications` backend kosong — `GET /api/v1/notifications` selalu `[]` untuk semua user, jadi panel menampilkan empty state yang benar tetapi demo notifikasi tidak terlihat. Backend perlu me-seed/menulis row `Notification` (mis. saat MCU disubmit, stok di bawah minimum, expiry MCU) — **tanpa endpoint baru**, hanya data. UI frontend sudah siap menerima data tersebut.
- Tidak ada perubahan backend yang dilakukan dalam task ini.

## Known limitations
- Component test React (AppShell/Sidebar/Topbar/NotificationPanel/Breadcrumb/dst.) tidak dapat ditulis: `vitest.config.ts` memakai `environment: node` dan task ini tidak menambah dependency testing baru (jsdom/testing-library). Unit test 35 test mencakup seluruh logika murni yang diminta §16 (navigation filtering, active route, breadcrumb generation, unread count, mark-as-read transition, offline/hydration-safe initial state, login query parameter handling); komponen UI diverifikasi lewat 47 assertion browser E2E sebagai gantinya.
- `AppShell`/`AppSidebar`/`AppTopbar`/`RouteGuard`/`ErrorBoundary` tetap ada sebagai dead code (tidak dirender) — penghapusan di luar scope agar diff minimal dan tidak menghapus fitur existing.
- Dua `store.ts` (`lib/store.ts` aktif vs `src/lib/store.ts` basi) tetap seperti baseline — di luar scope tahap ini.
- Verifikasi browser dilakukan pada dev server (port 3001) dengan backend demo hidup; production build diverifikasi terpisah dengan exit 0.
- Item "Lab & Radiologi" sengaja disabled "Segera hadir" (halaman Lab belum ada — membuat halaman Lab baru di luar scope).
