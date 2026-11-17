# Laporan Frontend — 18 November 2026

**Lingkup:** penyelarasan frontend dengan backend yang baru diaktifkan
(`master-data`, `waivers`) + penutupan mismatch RBAC yang ditemukan saat
verifikasi browser nyata.

## 1. Backend yang dipush lebih dulu

Repo `KODEINxLNG-Backend`, `main` (`a43b96d`):

- Modul **Master Data** (Domain 12): organization/department/site + status
  aktif/nonaktif, dependency guard, audit log. Endpoint `/api/v1/master-data/*`
  yang selama ini dicatat frontend sebagai 404 kini aktif.
- **Waiver lifecycle** (Domain 4): `/api/v1/waivers*` (list/detail/create/
  update/decision/send/revoke + token publik) sesuai kontrak
  `src/lib/services/waiver.service.ts` (halaman `/waiver`).
- `ScopeService` (GLOBAL > ORG > SITE > OWN) diekspor dari `IamModule`.
- 4 migration Prisma + sinkronisasi `schema.prisma` (`prisma:verify`
  0 mismatch) dan `UpdateDepartmentDto.parentId`.

## 2. Perubahan frontend

| Area | Perubahan |
|---|---|
| `lib/rbac.ts` | `view-visits` dicabut dari `hse`, `manajemen`, `pekerja` |
| `src/features/dashboard/role-tasks.ts` | tile `visitsToday` dihapus untuk HSE & Management; Management mendapat aksi "MCU & FTW" |
| `ROLE_MAPPING.md` | diregenerasi (`npm run docs:role-matrix`) |
| `app/(app)/master-data/page.tsx` | komentar pemuatan per-sumber diperbarui (modul sudah aktif) |
| `src/lib/__tests__/rbac.test.ts` | test baru: role non-medis tidak memegang `view-visits` |

### Alasan pencabutan `view-visits`

Backend menjaga seluruh endpoint klinik (`/clinic/queues`, `/clinic/encounters`,
…) dengan `MedicalFirewallGuard` (Permenkes 24/2022 & UU PDP). Daftar
`MEDICAL_ROLES` di backend hanya `DOCTOR_OH`, `DOCTOR_CLINIC`, `NURSE`,
`PHARMACIST`, `LAB_ANALYST`, `RADIOLOGIST`, `SYSTEM_ADMIN`. Sebelumnya
HSE/Management/Pekerja tetap melihat menu **Kunjungan** dan **Antrean**,
padahal halamannya selalu berakhir `403 Forbidden` — terbukti lewat browser
nyata (`/visits` sebagai `hse.manager`: 2× `403 /clinic/queues`).

## 3. Verifikasi (backend lokal `:3002`, dev server `:3001`)

| Pemeriksaan | Hasil |
|---|---|
| Browser probe `/master-data` sebagai `hr.pic` | PASS — 6 request API 2xx, data organisasi/departemen/site tampil, 0 error konsol |
| Browser probe `/waiver` sebagai `hse.manager` | PASS — 11 request API 2xx, 0 error konsol (sebelum perbaikan: 403 `/clinic/queues`) |
| Probe dashboard 8 akun (`hr.pic`, `hse.manager`, `manajemen`, `dr.klinik`, `perawat`, `apoteker`, `lab.analis`, `dr.hendra`) | 7 PASS; `dr.hendra` BLOCKED (MFA wajib, kebijakan backend) |
| `npm run typecheck` | PASS (0 error) |
| `npx eslint .` | PASS (0 masalah) |
| `npx vitest run` | PASS — 665 lulus / 21 skip (52 file) |
| `node scripts/check-raw-colors.mjs` | PASS — 0 pelanggaran (323 file) |
| `npm run build` | PASS — seluruh route + Proxy |

## 4. Tindak lanjut

1. **E2E Playwright baseline** masih gagal pada skenario "permission ditolak"
   (fixture backend belum dipasang) — belum jadi gerbang rilis.
2. **Performance budget** (LCP/CLS/INP, Lighthouse) belum diukur/di-enforce.
3. **Focus management antar-route** dan uji responsive alur terautentikasi
   mobile belum ada.
4. **Cek manual** cetak hitam-putih (sertifikat/laporan/SOAP) di printer fisik;
   aset logo final masih PNG.
5. Akun `DOCTOR_OH` memerlukan setup MFA sehingga tidak bisa dipakai probe
   otomatis tanpa langkah tambahan.
