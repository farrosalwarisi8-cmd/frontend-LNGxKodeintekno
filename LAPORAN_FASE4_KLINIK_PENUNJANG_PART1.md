# Laporan Fase 4 — Klinik dan Penunjang Part 1 (Frontend)

## Status
- **FRONTEND: SIAP (implementasi UI aksi bisnis ditambahkan)**.
- **Backend unchanged** (sesuai batasan tugas).
- Verifikasi E2E browser penuh: **tidak dijalankan** (backend nyata tidak tersedia di environment ini). Bukti yang tersedia: quality gate frontend lulus.

## Scope perubahan frontend
- `lib/types.ts`: tambah status kunjungan `Locked` pada `VisitStatus`.
- `lib/constants.ts`: tambah meta `Locked` pada `VISIT_STATUS`.
- `app/(app)/medical-records/page.tsx`:
  - Aksi **Simpan SOAP** hanya memperbarui state lokal setelah request backend berhasil (tidak ada lagi fake success).
  - Aksi **Finalize & Lock** memanggil `POST /clinic/encounters/:id/finalize`.
  - Rekam medis **Locked** tidak dapat diedit langsung; perubahan dilakukan melalui **addendum** (`POST /clinic/encounters/:id/addendum`).
  - Penanganan konflik **409** pada SOAP, finalize, dan addendum dengan pesan jelas + tombol muat ulang.
  - Pencarian ICD-10 dari backend (input minimal 2 huruf) melalui `GET /clinic/icd10/search`.
- `src/lib/services/encounter.service.ts` (tidak diubah pada sesi ini; service `finalize` dan `addendum` sudah tersedia dan kini dipakai UI).

## Quality Gate
| Check | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | PASS (0 errors) |
| Lint | `npx eslint app lib src components --quiet` | PASS (0 problems) |
| Unit + integration | `npx vitest run` | PASS (344 passed, 19 skipped, 25 test files) |
| Production build | `npm run build` | PASS |

## Catatan Kejujuran / Limitasi
- Backend nyata tidak tersedia (`http://localhost:3000` tidak reachable), sehingga pengujian E2E business flow browser tidak dapat dijalankan.
- Antrean (`/visits/queue`) tetap menggunakan endpoint baca nyata; mutasi status bergantung kontrak backend counter yang belum tersedia — tidak diklaim persist.
- Cross-site enforcement tetap di-handle backend (row-level scope); frontend tidak mengarang data scope.

## Ringkasan implementasi aksi bisnis yang sebelumnya belum teruji
- Register visit dari UI: `/visits/new` (wizard pasien→lokasi→keluhan→TTV→review) → `openEncounter` + `recordVitals` + `saveSoap`.
- Input vital sign: wizard kunjungan baru + endpoint `PUT /clinic/encounters/:id/vitals`.
- Input ICD-10: modal Rekam Medis (pilih diagnosis + pencarian backend).
- Input SOAP: modal Rekam Medis → `PUT /clinic/encounters/:id/soap`.
- Finalize medical record & lock: tombol "Finalize & Lock" → `POST /clinic/encounters/:id/finalize`.
- Edit setelah lock: form addendum pada rekam medis terkunci.
- Conflict: penanganan 409 + refetch.