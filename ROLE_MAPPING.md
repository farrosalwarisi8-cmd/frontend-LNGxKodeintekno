# Role Mapping & Permission Matrix

> **Dokumen ini dihasilkan otomatis dari kode.** Jangan edit manual. Jalankan:
> `node scripts/generate-role-mapping.mjs` lalu commit hasilnya.
> (mode verifikasi CI-lokal: tambah `--check` — exit 1 bila file usang)

Sumber: `lib/rbac.ts` (registry permission), `src/lib/services/auth.service.ts`
(peta role backend), `src/lib/demo-role-map.ts` (mode demo).

## Frontend Role → Backend Role Code

| Frontend Role | Backend Role Code | Data Scope (server-side) | Notes |
|---|---|---|---|
| `admin` | `SYSTEM_ADMIN` | GLOBAL | Role backend penuh |
| `dokter-oh` | `DOCTOR_OH` | GLOBAL | Role backend penuh |
| `dokter-klinik` | `DOCTOR_CLINIC` | SITE | Role backend penuh |
| `perawat` | `NURSE` | SITE | Role backend penuh |
| `apoteker` | `PHARMACIST` | SITE | Role backend penuh |
| `lab` | `LAB_ANALYST` | SITE | Role backend penuh |
| `admin-klinik` | — | — | Role UI saja; saat login dipetakan ke kode backend oleh backend |
| `hr` | `HR_ADMIN` | ORG | Role backend penuh |
| `hse` | `HSE_OFFICER` | SITE | Role backend penuh |
| `manajemen` | `MANAGEMENT` | GLOBAL | Role backend penuh |
| `pekerja` | — | — | Tanpa backend JWT; akses via token publik (consent/waiver) |

## Backend Role → Frontend Role

| Backend Role Code | Frontend Role | Data Scope (server-side) |
|---|---|---|
| `SYSTEM_ADMIN` | `admin` | GLOBAL |
| `DOCTOR_OH` | `dokter-oh` | GLOBAL |
| `DOCTOR_CLINIC` | `dokter-klinik` | SITE |
| `NURSE` | `perawat` | SITE |
| `PHARMACIST` | `apoteker` | SITE |
| `LAB_ANALYST` | `lab` | SITE |
| `RADIOLOGIST` | `lab` | SITE |
| `HR_ADMIN` | `hr` | ORG |
| `HSE_OFFICER` | `hse` | SITE |
| `HSE_MANAGER` | `hse` | GLOBAL |
| `MANAGEMENT` | `manajemen` | GLOBAL |

## Permission Matrix

`✓` = role memiliki permission (registry `ROLE_PERMISSIONS` di `lib/rbac.ts`).

| Permission | admin | dokter-oh | dokter-klinik | perawat | apoteker | lab | admin-klinik | hr | hse | manajemen | pekerja |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `view-dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `manage-employees` | ✓ | — | — | — | — | — | — | ✓ | — | — | — |
| `upload-document` | ✓ | — | — | — | — | — | — | ✓ | — | — | — |
| `view-mcu` | ✓ | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `review-mcu` | — | ✓ | — | — | — | — | — | — | — | — | — |
| `approve-mcu` | ✓ | ✓ | — | — | — | — | — | — | — | — | — |
| `create-mcu` | ✓ | — | ✓ | ✓ | — | — | ✓ | ✓ | — | — | — |
| `input-mcu-result` | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — | — |
| `view-visits` | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| `register-patient` | ✓ | — | — | ✓ | — | — | ✓ | — | — | — | — |
| `edit-visit` | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — | — |
| `view-clinical-notes` | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — | — |
| `view-diagnosis` | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — | — |
| `manage-stock` | ✓ | — | — | — | ✓ | — | — | — | — | — | — |
| `dispense-medicine` | ✓ | — | — | — | ✓ | — | — | — | — | — | — |
| `issue-certificate` | — | ✓ | — | — | — | — | — | — | — | — | — |
| `view-reports` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `export-reports` | ✓ | ✓ | — | — | — | — | — | ✓ | ✓ | ✓ | — |
| `view-health-status` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `set-health-status` | — | ✓ | — | — | — | — | — | — | — | — | — |
| `acknowledge-restriction` | — | — | — | — | — | — | — | — | ✓ | — | — |
| `manage-users` | ✓ | — | — | — | — | — | — | — | — | — | — |
| `manage-master-data` | ✓ | — | — | — | — | — | — | — | — | — | — |
| `view-audit-logs` | ✓ | — | — | — | — | — | — | — | — | — | — |
| `manage-hse` | ✓ | — | — | — | — | — | — | — | ✓ | — | — |
| `manage-da` | ✓ | ✓ | — | — | — | ✓ | — | — | — | — | — |
| `view-emergency` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `view-profile` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `input-lab-result` | ✓ | ✓ | — | — | — | ✓ | — | — | — | — | — |
| `manage-system-config` | ✓ | — | — | — | — | — | ✓ | — | — | — | — |
| `manage-api-keys` | ✓ | — | — | — | — | — | ✓ | — | — | — | — |
| `view-tte` | ✓ | — | — | — | — | ✓ | ✓ | — | — | — | — |
| `monitor-emergency` | ✓ | — | — | — | — | ✓ | ✓ | — | — | — | — |

## Demo Role Mapping

| Demo Role | Label | Maps To (role session) |
|---|---|---|
| `ADMIN_CLINIC` | Admin Klinik | `admin-klinik` |
| `HR_PIC` | HR/PIC | `hr` |
| `SYSTEM_ADMIN` | System Administrator | `admin` |
| `PUBLIC_WORKER` | Worker/Public | `pekerja` |

Demo role adalah simulasi UI. Backend selalu melakukan otorisasi final.

## Worker Portal Policy

- **No backend JWT**: pekerja tidak punya akun backend.
- **Public token access**: pekerja memakai token consent/waiver untuk alur publik.
- **No clinical access**: pekerja tidak melihat data pekerja lain atau catatan klinis.

## Catatan keamanan

1. Permission frontend hanya mengatur tampilan/UX; **otorisasi sebenarnya di backend**.
2. Role `lab` (analis lab & radiolog) sengaja **tanpa** `view-mcu` — mengelola data
   penunjang (order/hasil lab & radiologi) saja, sesuai proposal Fase A1.
3. Role tanpa padanan kode backend (`admin-klinik`, `pekerja`) dikembalikan `null`
   oleh `backendRoleCode()` sehingga UI menolak, bukan mengirim kode palsu.
