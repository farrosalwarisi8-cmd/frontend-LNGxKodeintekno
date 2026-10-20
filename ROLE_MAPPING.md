# Role Mapping & Permission Matrix

> **Dihasilkan otomatis** oleh `node scripts/generate-role-matrix.mjs` dari kode
> (`lib/rbac.ts`, `lib/actions.ts`, `src/lib/navigation.ts`, `components/route-guard.tsx`).
> Jangan diedit manual — ubah kode lalu jalankan ulang skrip. Test
> `src/lib/__tests__/role-mapping-doc.test.ts` gagal bila file ini tidak sinkron dengan kode.

Permission frontend adalah **proteksi UI/UX**. Otorisasi sebenarnya tetap milik backend.

## 1. Frontend Role → Backend Role Code

| Frontend Role | Backend Role Code | Sumber |
|---|---|---|
| `admin` | `SYSTEM_ADMIN` | `lib/rbac.ts` (`ROLE_PERMISSIONS`) |
| `dokter-oh` | `DOCTOR_OH` | `lib/rbac.ts` (`ROLE_PERMISSIONS`) |
| `dokter-klinik` | `DOCTOR_CLINIC` | `lib/rbac.ts` (`ROLE_PERMISSIONS`) |
| `perawat` | `NURSE` | `lib/rbac.ts` (`ROLE_PERMISSIONS`) |
| `apoteker` | `PHARMACIST` | `lib/rbac.ts` (`ROLE_PERMISSIONS`) |
| `lab` | `LAB_ANALYST` | `lib/rbac.ts` (`ROLE_PERMISSIONS`) |
| `admin-klinik` | — (tanpa padanan backend) | `lib/rbac.ts` (`ROLE_PERMISSIONS`) |
| `hr` | `HR_ADMIN` | `lib/rbac.ts` (`ROLE_PERMISSIONS`) |
| `hse` | `HSE_OFFICER` | `lib/rbac.ts` (`ROLE_PERMISSIONS`) |
| `manajemen` | `MANAGEMENT` | `lib/rbac.ts` (`ROLE_PERMISSIONS`) |
| `pekerja` | — (tanpa padanan backend) | `lib/rbac.ts` (`ROLE_PERMISSIONS`) |

## 2. Backend Role Code → Frontend Role

| Backend Role Code | Frontend Role |
|---|---|
| `SYSTEM_ADMIN` | `admin` |
| `DOCTOR_OH` | `dokter-oh` |
| `DOCTOR_CLINIC` | `dokter-klinik` |
| `NURSE` | `perawat` |
| `PHARMACIST` | `apoteker` |
| `LAB_ANALYST` | `lab` |
| `RADIOLOGIST` | `lab` |
| `HR_ADMIN` | `hr` |
| `HSE_OFFICER` | `hse` |
| `HSE_MANAGER` | `hse` |
| `MANAGEMENT` | `manajemen` |

## 3. Matriks Permission (role × permission)

| Permission | admin | dokter-oh | dokter-klinik | perawat | apoteker | lab | admin-klinik | hr | hse | manajemen | pekerja |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `view-dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `manage-employees` | — | — | — | — | — | — | ✓ | ✓ | — | — | — |
| `upload-document` | — | — | — | — | — | — | ✓ | ✓ | — | — | — |
| `view-mcu` | — | ✓ | ✓ | ✓ | ✓ | — | — | — | ✓ | ✓ | ✓ |
| `review-mcu` | — | ✓ | — | — | — | — | — | — | — | — | — |
| `approve-mcu` | — | ✓ | — | — | — | — | — | — | — | — | — |
| `create-mcu` | — | — | ✓ | ✓ | — | — | — | — | — | — | — |
| `input-mcu-result` | — | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — | — |
| `view-visits` | — | ✓ | ✓ | ✓ | — | — | ✓ | — | ✓ | ✓ | ✓ |
| `register-patient` | — | — | — | ✓ | — | — | ✓ | — | — | — | — |
| `edit-visit` | — | ✓ | ✓ | ✓ | — | — | ✓ | — | — | — | — |
| `view-clinical-notes` | — | ✓ | ✓ | ✓ | — | — | — | — | — | — | — |
| `view-diagnosis` | — | ✓ | ✓ | ✓ | — | — | — | — | — | — | — |
| `manage-stock` | — | — | — | — | ✓ | — | — | — | — | — | — |
| `dispense-medicine` | — | — | — | — | ✓ | — | — | — | — | — | — |
| `issue-certificate` | — | ✓ | — | — | — | — | — | — | — | — | — |
| `view-reports` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `export-reports` | — | ✓ | — | — | — | — | ✓ | ✓ | ✓ | ✓ | — |
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
| `input-lab-result` | — | ✓ | — | — | — | ✓ | — | — | — | — | — |
| `view-lab-orders` | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — | — |
| `receive-sample` | — | — | — | — | — | ✓ | — | — | — | — | — |
| `import-lab-result` | ✓ | — | — | — | — | ✓ | — | — | — | — | — |
| `verify-lab-result` | — | — | — | — | — | ✓ | — | — | — | — | — |
| `write-radiology-report` | — | — | — | — | — | ✓ | — | — | — | — | — |
| `manage-system-config` | ✓ | — | — | — | — | — | ✓ | — | — | — | — |
| `manage-api-keys` | ✓ | — | — | — | — | — | ✓ | — | — | — | — |
| `view-tte` | ✓ | — | — | — | — | ✓ | ✓ | — | — | — | — |
| `monitor-emergency` | ✓ | — | — | — | — | ✓ | ✓ | — | — | — | — |

## 4. Akses Route per Role

Permission route diambil dari `components/route-guard.tsx` (`ROUTE_PERMISSIONS`).

| Route | Permission | admin | dokter-oh | dokter-klinik | perawat | apoteker | lab | admin-klinik | hr | hse | manajemen | pekerja |
|---|------|---|---|---|---|---|---|---|---|---|---|
| `/dashboard` | `view-dashboard` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/demo` | — (route publik) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/people` | `manage-employees` | — | — | — | — | — | — | ✓ | ✓ | — | — | — |
| `/employees` | `manage-employees` | — | — | — | — | — | — | ✓ | ✓ | — | — | — |
| `/mcu` | `view-mcu` | — | ✓ | ✓ | ✓ | ✓ | — | — | — | ✓ | ✓ | ✓ |
| `/mcu/review` | `review-mcu` | — | ✓ | — | — | — | — | — | — | — | — | — |
| `/visits` | `view-visits` | — | ✓ | ✓ | ✓ | — | — | ✓ | — | ✓ | ✓ | ✓ |
| `/visits/new` | `register-patient` | — | — | — | ✓ | — | — | ✓ | — | — | — | — |
| `/visits/queue` | `view-visits` | — | ✓ | ✓ | ✓ | — | — | ✓ | — | ✓ | ✓ | ✓ |
| `/medical-records` | `view-clinical-notes` | — | ✓ | ✓ | ✓ | — | — | — | — | — | — | — |
| `/medicine` | `manage-stock` | — | — | — | — | ✓ | — | — | — | — | — | — |
| `/medicine/dispense` | `dispense-medicine` | — | — | — | — | ✓ | — | — | — | — | — | — |
| `/medicine/return` | `dispense-medicine` | — | — | — | — | ✓ | — | — | — | — | — | — |
| `/certificates` | `issue-certificate` | — | ✓ | — | — | — | — | — | — | — | — | — |
| `/reports` | `view-reports` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/health-status` | `view-health-status` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/waiver` | `manage-hse` | ✓ | — | — | — | — | — | — | — | ✓ | — | — |
| `/da` | `manage-da` | ✓ | ✓ | — | — | — | ✓ | — | — | — | — | — |
| `/emergency` | `view-emergency` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `/system-config` | `manage-system-config` | ✓ | — | — | — | — | — | ✓ | — | — | — | — |
| `/api-keys` | `manage-api-keys` | ✓ | — | — | — | — | — | ✓ | — | — | — | — |
| `/tte` | `view-tte` | ✓ | — | — | — | — | ✓ | ✓ | — | — | — | — |
| `/emergency-detail` | `monitor-emergency` | ✓ | — | — | — | — | ✓ | ✓ | — | — | — | — |
| `/users` | `manage-users` | ✓ | — | — | — | — | — | — | — | — | — | — |
| `/master-data` | `manage-master-data` | ✓ | — | — | — | — | — | — | — | — | — | — |
| `/audit-logs` | `view-audit-logs` | ✓ | — | — | — | — | — | — | — | — | — | — |
| `/lab` | `input-lab-result` | — | ✓ | — | — | — | ✓ | — | — | — | — | — |
| `/radiology` | `write-radiology-report` | — | — | — | — | — | ✓ | — | — | — | — | — |
| `/signatures` | `issue-certificate` | — | ✓ | — | — | — | — | — | — | — | — | — |
| `/documents` | `issue-certificate` | — | ✓ | — | — | — | — | — | — | — | — | — |

## 5. Demo Role Mapping

Demo role hanyalah simulasi UI. **Bukan** authorization produksi — backend tetap
memverifikasi setiap request.

| Demo Role | Role Frontend | Label |
|---|---|---|
| `ADMIN_CLINIC` | `admin-klinik` | Admin Klinik |
| `HR_PIC` | `hr` | HR/PIC |
| `SYSTEM_ADMIN` | `admin` | System Administrator |
| `PUBLIC_WORKER` | `pekerja` | Worker/Public |

## 6. Catatan aturan proposal

- **System Administrator (`admin`)** — konfigurasi sistem, kelola user & role, audit log
  (read-only), monitoring. **Tidak punya akses data klinis** (MCU, catatan klinis,
  diagnosis, farmasi/dispense) maupun data pekerja.
- **HR/PIC (`hr`)** — data pekerja dan status kepatuhan (MCU/FTW/restriction). Tidak
  mengelola user & master data, tidak melihat detail medis.
- **Analis Lab/Radiolog (`lab`)** — hanya data penunjang (input/impor dan verifikasi
  hasil lab). Tidak punya akses data MCU penuh.
- **Admin Klinik (`admin-klinik`)** — registrasi, antrean, dan entri berobat luar klinik.
  Kolom klinis (keluhan utama, diagnosis) pada daftar kunjungan disembunyikan di UI.
- **Penguatan sisi server tetap tanggung jawab backend.** Frontend hanya menyembunyikan
  menu, menampilkan AccessDenied, dan menyembunyikan aksi.

