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

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Language**: TypeScript (strict)
- **Styling**: Tailwind CSS 4 + semantic color tokens
- **State**: Zustand (demo role) + React hooks (async state)
- **Icons**: Lucide React
- **Testing**: Vitest

## Accessibility

- WCAG AA target
- Semua input memiliki label
- Error terhubung ke input via `aria-describedby`
- Focus ring terlihat
- Keyboard navigation (Escape menutup modal)
- Touch target minimal 44px
- Status tidak bergantung pada warna saja (label + icon + warna)

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
