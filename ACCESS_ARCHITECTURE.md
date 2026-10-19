# Arsitektur Akses Frontend — Tahap 2

> Dokumen ini menjelaskan kondisi **aktual** di kode. Frontend hanya mengatur
> tampilan/UX; **otorisasi sebenarnya tetap milik backend**.

## 1. Store Resmi

**File**: `lib/store.ts` (satu-satunya store aplikasi)

- `src/lib/store.ts` (duplikat 744 baris) sudah **dihapus** dan tidak boleh dibuat kembali.
- Semua consumer memakai `useStore`, `useCurrentUser`, `useCurrentRole` dari `@/lib/store`.
- Login/logout/MFA/session restore terhubung ke backend lewat `authService`
  (`POST /api/v1/auth/login`, `/auth/mfa/verify`, `/auth/refresh`).
- Cookie `kodein-klinik-store` (`{ state: { currentUserId } }`) ditulis saat login dan
  dihapus saat logout — dibaca middleware untuk proteksi edge-level.

Dijaga oleh test `src/lib/__tests__/store-import-consistency.test.ts`.

## 2. Permission Registry (satu sumber)

**File**: `lib/rbac.ts`

```ts
export type Permission =
  | "view-dashboard" | "manage-employees" | "upload-document" | "view-mcu"
  | "review-mcu" | "approve-mcu" | "create-mcu" | "input-mcu-result"
  | "view-visits" | "register-patient" | "edit-visit" | "view-clinical-notes"
  | "view-diagnosis" | "manage-stock" | "dispense-medicine" | "issue-certificate"
  | "view-reports" | "export-reports" | "view-health-status" | "set-health-status"
  | "acknowledge-restriction"
  | "manage-users" | "manage-master-data" | "view-audit-logs" | "manage-hse"
  | "view-emergency" | "view-profile" | "input-lab-result";
```

- `ROLE_PERMISSIONS` adalah **satu-satunya** tabel permission per role.
- `ALL_PERMISSIONS` (diekspor) adalah daftar semua permission yang dikenal —
  dipakai untuk validasi, test, dan generator `ROLE_MAPPING.md`.
- Helper: `can()`, `canAny()`, `canAll()`, `getPermissionsForRole()`, `allPermissions()`.
- **Tidak ada lagi** `NAV` (market navigasi lama) maupun `canLegacy()`.
- **Tidak ada lagi** `src/shared/permissions/permissions.ts` (model permission kedua
  berbasis `DemoRole`) — dulu hanya dipakai `employee-profile.tsx`.

### Role ringkas (setelah A1 — diselaraskan dengan proposal)

| Role | Ciri permission |
|---|---|
| `admin` | **System Administrator**: `manage-users`, `manage-master-data`, `view-audit-logs`, `manage-hse`, `view-reports`, `view-health-status`, `view-emergency`, `view-profile`. **Tanpa** permission klinis apa pun (termasuk read-only) dan tanpa data pekerja. |
| `dokter-oh` | Klinis: `review-mcu`, `approve-mcu`, `issue-certificate`, `set-health-status`, `export-reports` |
| `dokter-klinik` | Klinis tanpa review/approve/sertifikat |
| `perawat` | `create-mcu`, `register-patient`, `edit-visit`, catatan klinis |
| `apoteker` | `manage-stock`, `dispense-medicine` |
| `lab` | `input-mcu-result`, `input-lab-result` (tanpa `view-mcu`) |
| `admin-klinik` | Registrasi/antrean: `register-patient`, `manage-employees`, `upload-document`, `view-visits`, `edit-visit`. Tanpa data klinis. |
| `hr` | **HR/PIC**: `manage-employees`, `upload-document`, `view-health-status` (+ laporan). Tanpa `manage-users`/`manage-master-data`, tanpa `view-mcu`/`view-visits`/`create-mcu`. |
| `hse` | `manage-hse`, `export-reports`, `acknowledge-restriction` |
| `manajemen` | Read-only + `export-reports` |
| `pekerja` | Minimal (dashboard, MCU/visits read, laporan, profil) |

## 3. Action Guard (tombol & CTA)

**File**: `lib/actions.ts` + `components/can.tsx`

```ts
// registry aksi → permission (tanpa pengecekan role manual di halaman)
const can = useCan();
if (can("people.create")) { /* tampilkan CTA */ }

<Can action="mcu.approve"><Button>Approve</Button></Can>
```

Aksi terpetakan: `people.create/edit/upload-document/send-consent`, `mcu.create/review/approve`,
`mcu.acknowledge-restriction`, `visits.create/edit-soap`, `visits.view-clinical`,
`pharmacy.receive-stock/dispense`, `certificates.issue/revoke`,
`reports.view/export/view-mcu/view-visits/view-diagnosis/view-pharmacy`,
`users.manage`, `master-data.edit`, `audit.view`, `waiver.decide`,
`da.manage`, `emergency.create`, `input-lab-result`, `escalation.run`.

### Aksi dengan beberapa requirement

Sebuah aksi boleh membutuhkan **lebih dari satu** permission:

```ts
// SOAP adalah catatan klinis: butuh izin edit kunjungan DAN izin klinis.
"visits.edit-soap": ["edit-visit", "view-clinical-notes"],
```

`canPerform()` memakai `canAll()` untuk daftar requirement. Contoh: `admin-klinik` boleh
mengubah data kunjungan (`edit-visit`) tetapi **tidak** boleh membuka/mengubah SOAP karena
tidak punya `view-clinical-notes`.

Behavior saat tidak punya permission:
- CTA berisiko **disembunyikan** (konsisten di seluruh halaman).
- Aksi yang *hanya* relevan bagi sebagian role ditampilkan **nonaktif + alasan** (contoh:
  tombol eskalasi pada `/health-status`).
- Route yang tidak berizin menampilkan `AccessDenied` (tanpa konten terlindungi).

`useCan()`/`<Can>` membaca **role efektif** (lihat §6), sehingga demo mode dan
role session tidak pernah menyimpang dari menu.

### Kolom klinis pada daftar non-klinis

Untuk role yang boleh menangani data administratif/antrean tetapi **tidak** boleh melihat data
klinis (`admin-klinik`), kolom klinis disembunyikan langsung di UI:

- `/visits` & `/visits/queue`: kolom "Keluhan" (chief complaint) hanya dirender bila aksi
  `visits.view-clinical` (**izin** `view-clinical-notes`) terpenuhi; pencarian juga tidak
  memakai keluhan utama untuk role tersebut.
- `/reports`: setiap kartu memakai izin sesuai sumber datanya (`reports.view-mcu`,
  `reports.view-visits`, `reports.view-diagnosis`, `reports.view-pharmacy`) sehingga
  HR/PIC dan System Administrator hanya melihat angka kepatuhan.

## 4. Route Guard

**File**: `components/route-guard.tsx`

- Rule regex → permission (`ROUTE_PERMISSIONS`), pattern paling spesifik lebih dulu.
- Keputusan murni `resolveRouteAccess({ hydrated, authenticated, role, pathname })`
  mengembalikan: `loading` | `login` | `denied` | `allow` (dapat diuji tanpa DOM).
- `matchRoutePermission()` menormalisasi trailing slash dan membuang query string.
- Dipasang di `app/(app)/layout.tsx`:

```tsx
<EmrShell>
  <RouteGuard>{children}</RouteGuard>
</EmrShell>
```

### Behavior

| Kondisi | Hasil |
|---|---|
| Sesi belum direhidrasi | `PageLoading` (tidak ada keputusan dini) |
| Belum login pada route terproteksi | `redirect` ke `/login?from=<path internal>` |
| Login tetapi tanpa permission | **tetap** di `AccessDenied` — **tidak ada redirect otomatis** |
| Berizin | halaman dirender |
| Route tanpa rule (mis. `/demo`) | boleh untuk pengguna login |

Anti open-redirect: `loginRedirectUrl()` menolak `//evil.com`, `https://…`, `/\evil`.

## 5. AccessDenied

**File**: `components/access-denied.tsx`

- Judul "Akses terbatas" + penjelasan + link **Kembali ke dashboard**.
- Ditampilkan **selama-lamanya** (bukan kedip 200–300 ms) dan tanpa auto-redirect.
- `role="status"` + `aria-live="polite"`, responsif di mobile.
- Konten protected tidak pernah dirender sebelum guard lolos.

## 6. Navigasi: Sidebar, Bottom Navigation, Demo Role

**File**: `src/lib/navigation.ts`

- `getNavigation(role)` — satu sumber item menu (title/icon/permission/disabled).
  `role` kosong → **tidak ada item** (bukan "semua item").
- `getBottomNavigation(role)` — mobile bottom navigation **difilter registry yang sama**
  (bukan mapping permission kedua). Href-nya subset dari `NAVIGATION_ITEMS`; hanya
  labelnya dipendekkan untuk bottom bar ("MCU & FTW" → "MCU").
- `getOverflowNavigation(role)` — menentukan tombol **Lainnya** hanya muncul bila ada
  item tambahan yang boleh diakses.
- Item `disabled` (mis. Lab & Radiologi) selalu tampil sebagai menu nonaktif.

### Demo Role

**File**: `src/lib/demo-role-map.ts` (mapping murni) + `src/lib/demo-role.ts` (hook)

```ts
const DEMO_ROLE_TO_ROLE = {
  ADMIN_CLINIC: "admin-klinik",
  HR_PIC: "hr",
  SYSTEM_ADMIN: "admin",
  PUBLIC_WORKER: "pekerja",
} as const;
```

- `useDemoMode()` mengembalikan **role efektif**: `enabled ? DEMO_ROLE_TO_ROLE[demoRole] : user.role`.
- Demo mode **default `enabled: false`** → role session yang berlaku (perilaku produksi).
  Memilih role di `/demo` otomatis mengaktifkan demo mode; ada tombol "Nonaktifkan demo mode".
- Saat demo mode aktif, banner *Demo mode* tampil dan badge sidebar berbunyi "Demo role aktif".
- Karena role efektif dipakai oleh **menu, bottom navigation, route guard, action button,
  dan badge profil**, mengubah demo role mengubah semuanya secara konsisten.
- **Demo role bukan authorization produksi.** Ia hanya simulasi UI; backend tetap
  memverifikasi setiap request.
- Hanya ada 4 kosakata demo (`ADMIN_CLINIC`, `HR_PIC`, `SYSTEM_ADMIN`, `PUBLIC_WORKER`);
  tidak ada kosakata role kedua yang disimpan di banyak tempat.

## 7. Reminder MCU & Eskalasi

**File**: `src/lib/mcu-reminder.ts` (fungsi murni) + `src/features/mcu/components/`

- Tahapan reminder: **H-30 → H-14 → H-7 → Hari-H → Overdue**, plus `Aktif` (di luar jadwal)
  dan `Tanpa Tanggal` (tanggal berakhir tidak tersedia).
- Tahap dihitung dari `valid_until` yang dikirim backend pada siklus MCU
  (`GET /mcu/cycles`) — backend **belum** menyediakan field "tahap reminder" maupun
  "level eskalasi" per record (lihat BLOCKER BACKEND di laporan A1).
- Setiap tahap selalu ditampilkan sebagai **teks + ikon** (bukan hanya warna), dan
  `reminderTimeline()` menghasilkan garis waktu dengan penanda `reached` / `current`.
- Panel eskalasi memakai endpoint yang sudah ada: `POST /admin/escalation/run-check`
  (aksi `escalation.run` → permission `manage-hse`). Tidak ada request otomatis saat
  halaman dibuka.

## 8. Middleware

**File**: `middleware.ts` (+ `lib/public-paths.ts` sebagai satu sumber)

- Tanpa cookie sesi yang valid → redirect ke `/login?from=<path>`.
- Public paths: `/login`, `/public`, `/verify`.
- **`/demo` adalah route INTERNAL** — butuh login (keputusan resmi Tahap 2).
  Dokumentasi sebelumnya yang menyebut `/demo` publik sudah diperbaiki.
- `PUBLIC_PATHS` + `isPublicPath()` tinggal di `lib/public-paths.ts` agar middleware dan
  unit test memakai definisi yang sama.

## 9. Batasan & keamanan

1. Permission frontend adalah **proteksi UI/UX**, bukan authorization.
2. Backend **wajib** tetap memvalidasi setiap API call (role & scope).
3. Token akses di localStorage (`kodein_token`), refresh di `kodein_refresh_token`;
   `api-client` melakukan refresh sekali lalu redirect ke `/login` bila 401.
4. Tidak ada data sensitif yang dirender sebelum guard melewati `loading`.
5. External redirect diblokir di semua entry point (`resolveLoginRedirect`,
   `loginRedirectUrl`, `isInternalPath`).
6. Session cookie dihapus saat logout.
7. Role `admin` (System Administrator) **tidak** memiliki akses data klinis maupun data
   pekerja di UI. Penegakan yang sama di sisi server tetap **tanggung jawab backend**.
8. Role `admin-klinik` (dipetakan ke `SYSTEM_ADMIN` di backend) tidak memiliki izin klinis
   di UI; kolom klinis pada daftar kunjungan/antrean disembunyikan. Bila backend ternyata
   masih mengirim data klinis kepada role ini, itu adalah **blocker backend**.

## 10. Test yang menjaga arsitektur ini

| Berkas | Cakupan |
|---|---|
| `src/lib/__tests__/rbac.test.ts` | registry permission per role |
| `src/lib/__tests__/permission-proposal.test.ts` | matriks permission proposal (admin/HR/lab/admin-klinik) positif & negatif + 3 lapis pembatasan |
| `src/lib/__tests__/actions.test.ts` | mapping action → permission (termasuk multi-requirement) + `canPerform` |
| `src/lib/__tests__/navigation.test.ts` | filtering sidebar, bottom nav, overflow, redirect, breadcrumb |
| `src/lib/__tests__/demo-role.test.ts` | konsistensi demo role ↔ menu/bottom nav/action |
| `src/lib/__tests__/route-guard.test.ts` | `matchRoutePermission`, `resolveRouteAccess`, anti open-redirect |
| `src/lib/__tests__/public-paths.test.ts` | route publik & `/demo` bukan publik |
| `src/lib/__tests__/store-import-consistency.test.ts` | store tunggal, tanpa `NAV`/`canLegacy`/model permission kedua |
| `src/lib/__tests__/auth-store.test.ts` | login, MFA, session restore, logout |
| `src/lib/__tests__/mcu-reminder.test.ts` | tahapan reminder H-30/H-14/H-7/Hari-H/Overdue + garis waktu |
| `src/lib/__tests__/role-mapping-doc.test.ts` | ROLE_MAPPING.md sinkron dengan kode (drift guard) |
| `e2e/playwright/*.spec.ts` | E2E browser 6 alur mutasi (happy path, error, permission ditolak) |
