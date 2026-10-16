# EMR PT Layar Nusantara Gas — Modul 01

**Frontend-only** Electronic Medical Record untuk Registrasi Pekerja, MRN, dan Consent.

> **Demo mode** — seluruh data dan permission disimulasikan di frontend. Tidak ada backend, database, atau email nyata.

## Modul 01 — Registrasi Pekerja, MRN, dan Consent

### Fitur

- People list dengan search, filter, dan pagination
- Registration wizard mobile-first (5 langkah)
- Duplicate check menggunakan mock service
- Simulasi pembuatan MRN dari response mock service
- Upload dokumen pendukung secara lokal/mock
- Consent selection dan review
- Simulated email preview
- Public consent page tanpa login
- Consent approval/rejection simulation
- Consent event timeline
- Employee profile dengan tabs
- Permission-based UI visibility (4 demo roles)
- Masking identifier sensitif
- Activity/audit presentation dari mock data
- Offline-safe local draft (LocalStorage)
- Loading, error, empty, success, disabled, offline, dan permission-denied states
- Responsive layout mobile, tablet, dan desktop

### Routes

| Route | Deskripsi |
|---|---|
| `/demo` | Demo role switcher, mock config, public consent links |
| `/people` | People list dengan search dan filter |
| `/people/new` | Registration wizard (5 langkah) |
| `/people/:patientId` | Employee profile dengan tabs |
| `/public/consent/:token` | Public consent page (approve/reject) |

### Demo Roles

| Role | Permissions |
|---|---|
| Admin Klinik | Full access — create, edit, upload, resend consent |
| HR/PIC | Create, upload, resend consent — no edit administrative data |
| System Administrator | Read-only — view activity only |
| Worker/Public | Public consent page only |

## Menjalankan Aplikasi

### Development

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) — akan redirect ke `/demo`.

### Production Build

```bash
npm run build
npm start
```

### Test

```bash
npm run test          # unit + integration tests (Vitest)
npm run test:watch    # watch mode
```

### Lint & Typecheck

```bash
npm run lint
npm run typecheck
```

### Skenario per peran (jumlah langkah)

```bash
npm run build && npm start -- --port 3001
ROLE_BASE_URL=http://localhost:3001 npm run test:roles
```

Menjalankan satu skenario utama untuk tiap peran dengan backend distub, lalu
mengukur **jumlah langkah** (klik/pilihan/ketikan) dan membandingkannya dengan
anggaran di `scripts/role-scenarios.mjs#ROLE_BUDGET`. Gagal bila melebihi
anggaran atau hasil akhir tidak tercapai — jadi “klik paling sedikit” diuji,
bukan diklaim.

Panduan uji dengan **pengguna nyata** (termasuk lembar hasil untuk diisi) ada di
[`docs/uji-peran-pengguna-nyata.md`](docs/uji-peran-pengguna-nyata.md).

## Struktur Proyek

```
src/
  features/people/
    api/              # TypeScript types, mock service, repository
    components/       # People list, registration wizard, profile, public consent
    fixtures/         # Seed data (organizations, sites, people)
    hooks/            # usePeople, usePerson, useConsent, useDraft, useDemoRole
  shared/
    components/design-system/  # Reusable UI (Button, Card, Input, Modal, Badge, dll)
    permissions/      # Permission map terpusat
    storage/          # LocalStorage draft persistence
    utils/            # Validation, masking, date formatting
```

## Alur per peran (frontend)

Setiap peran punya satu jalur utama yang pendek, dimulai dari **tindakan cepat**
di dashboard. Susunannya satu sumber di `src/features/dashboard/role-tasks.ts`
(difilter memakai registry permission `lib/rbac.ts`, jadi tidak pernah menyimpang
dari menu/route guard).

| Peran | Tindakan utama | Bantuan yang ditambahkan |
|---|---|---|
| Admin Klinik & Perawat | Kunjungan baru, Antrean | Pencarian cepat antrean + tombol “Panggil berikutnya”; TTV dengan validasi rentang (`src/shared/validation/vital-signs.ts`) |
| Dokter | Tulis SOAP / Review MCU | Pencarian ICD-10 cepat (combobox keyboard), autosave draft SOAP (`soap-draft.ts`), riwayat pasien ringkas, indikator terkunci |
| Apoteker | Dispensing, Retur | Peringatan stok/FEFO sebelum memproses + tombol proses terkunci saat stok kurang (`features/pharmacy/stock-hints.ts`); retur dengan isi-otomatis & alasan sekali klik |
| HR/PIC & HSE | Status kesehatan, MCU jatuh tempo | Kartu dashboard MCU jatuh tempo/FTW/restriction + **filter tersimpan** (`use-saved-filters.ts`), termasuk pintasan `?filter=due-soon` |
| Pekerja | `/my/*` | Dashboard ringkas mobile-first + status FTW langsung di hub `/my` |

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS 4 + semantic color tokens
- **State**: Zustand (demo role) + React hooks (async state)
- **Icons**: Lucide React
- **Testing**: Vitest

## Accessibility

- WCAG AA target
- Semua input/select memiliki nama aksesibel (label terlihat, atau `aria-label`/placeholder)
- Error terhubung ke input via `aria-describedby`
- Focus ring terlihat
- Semua modal: `role="dialog"` + `aria-modal`, focus trap, tutup dengan `Escape`, fokus kembali ke pemicu
- Skip link ("Lewati ke konten utama") sebagai elemen fokusable pertama
- Baris tabel yang bisa diklik juga dapat dioperasikan keyboard (Enter/Space)
- Ukuran target sentuh diperiksa otomatis: audit mencatat setiap elemen interaktif < 44px (tombol aksi utama `md`/`lg` sudah ≥ 40–48px; tombol `size="sm"` 36px dan tautan teks di dalam kalimat dikecualikan sesuai SC 2.5.5/2.5.8)
- Status tidak bergantung pada warna saja (label + icon + warna)

### Audit otomatis (axe-core)

```bash
npm run build && npm start -- --port 3001   # atau `npm run dev`
A11Y_BASE_URL=http://localhost:3001 npm run test:a11y            # gagal bila ada critical/serious
A11Y_BASE_URL=http://localhost:3001 npm run test:a11y:keyboard   # alur login→SOAP hanya keyboard (21 pemeriksaan)
```

Gerbang keyboard menjalankan alur berikut hanya dengan Tab/Shift+Tab/Enter/Space/Escape: login → skip link → navigasi menu → buka/simpan modal SOAP → filter pencarian tabel → buka baris tabel → isi & majukan langkah wizard registrasi. Ia juga memastikan fokus awal masuk ke dalam dialog, `Escape` menutup modal, dan fokus kembali ke pemicu.

`npm run test:a11y` menjalankan axe pada seluruh route (termasuk modal yang dapat dibuka tanpa data) dengan sesi internal + API distub, lalu menulis laporan ke `test-artifacts/a11y/report.json`. Keduanya dijalankan di CI oleh `.github/workflows/a11y.yml`.

## Backend Follow-up (Sengaja Tidak Dikerjakan)

- Database schema/migration
- Real authorization (server-side)
- Secure token hashing
- Real email provider
- Real object storage
- Immutable audit log
- Server-side MRN uniqueness constraint

## Known Limitations

- Mock service menggunakan delay random 300–800ms (simulasi network)
- Draft disimpan di LocalStorage (bukan IndexedDB)
- Tidak ada E2E test (Playwright/Cypress) — hanya unit + integration tests
- Font menggunakan system font stack (bukan Google Fonts untuk offline safety)
