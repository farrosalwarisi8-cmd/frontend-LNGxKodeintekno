# Role Mapping & Permission Matrix — Tahap 4

## Frontend Role → Backend Role Code

| Frontend Role | Backend Role Code | Data Scope | Status | Notes |
|---|---|---|---|---|
| `admin` | `SYSTEM_ADMIN` | GLOBAL | Active | Full system access |
| `dokter-oh` | `DOCTOR_OH` | GLOBAL | Active | Occupational health specialist |
| `dokter-klinik` | `DOCTOR_CLINIC` | SITE | Active | Clinic doctor, site-scoped |
| `perawat` | `NURSE` | SITE | Active | Nurse, site-scoped |
| `apoteker` | `PHARMACIST` | SITE | Active | Pharmacist, site-scoped |
| `lab` | `LAB_ANALYST` | SITE | Active | Lab analyst, site-scoped |
| `hr` | `HR_ADMIN` | ORG | Active | HR admin, org-scoped |
| `hse` | `HSE_OFFICER` | SITE | Active | HSE officer, site-scoped |
| `manajemen` | `MANAGEMENT` | GLOBAL | Active | Management, read-only + export |
| `admin-klinik` | `SYSTEM_ADMIN` | SITE | **Mapped** | Uses SYSTEM_ADMIN backend role with site scope restriction |
| `pekerja` | — | — | **Public Token** | No backend JWT; uses consent token for public flows |

## Backend Role → Frontend Role

| Backend Role Code | Frontend Role | Data Scope | Medical | Notes |
|---|---|---|---|---|
| `SYSTEM_ADMIN` | `admin` | GLOBAL | Yes | Superuser |
| `DOCTOR_OH` | `dokter-oh` | GLOBAL | Yes | OH specialist |
| `DOCTOR_CLINIC` | `dokter-klinik` | SITE | Yes | Clinic doctor |
| `NURSE` | `perawat` | SITE | Yes | Nurse |
| `PHARMACIST` | `apoteker` | SITE | Yes | Pharmacist |
| `LAB_ANALYST` | `lab` | SITE | Yes | Lab analyst |
| `RADIOLOGIST` | `lab` | SITE | Yes | Radiologist (shares frontend role with lab) |
| `HR_ADMIN` | `hr` | ORG | No | HR admin |
| `HSE_OFFICER` | `hse` | SITE | No | HSE officer |
| `HSE_MANAGER` | `hse` | GLOBAL | No | HSE manager (shares frontend role with hse) |
| `MANAGEMENT` | `manajemen` | GLOBAL | No | Management |

## Permission Matrix

| Permission | admin | dokter-oh | dokter-klinik | perawat | apoteker | lab | hr | hse | manajemen | pekerja |
|---|---|---|---|---|---|---|---|---|---|---|
| view-dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| manage-employees | ✓ | — | — | — | — | — | ✓ | — | — | — |
| upload-document | ✓ | — | — | — | — | — | ✓ | — | — | — |
| view-mcu | ✓ | ✓ | ✓ | ✓ | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| review-mcu | ✓ | ✓ | — | — | — | — | — | — | — | — |
| approve-mcu | ✓ | ✓ | — | — | — | — | — | — | — | — |
| create-mcu | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | — | — | — |
| input-mcu-result | ✓ | ✓ | ✓ | ✓ | — | ✓ | — | — | — | — |
| view-visits | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | ✓ |
| register-patient | ✓ | — | ✓ | ✓ | — | — | ✓ | — | — | — |
| edit-visit | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| view-clinical-notes | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| view-diagnosis | ✓ | ✓ | ✓ | ✓ | — | — | — | — | — | — |
| manage-stock | ✓ | — | — | — | ✓ | — | — | — | — | — |
| dispense-medicine | ✓ | — | — | — | ✓ | — | — | — | — | — |
| issue-certificate | ✓ | ✓ | — | — | — | — | — | — | — | — |
| view-reports | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | ✓ |
| export-reports | ✓ | ✓ | — | — | — | — | ✓ | ✓ | ✓ | — |
| view-health-status | ✓ | ✓ | ✓ | ✓ | — | — | ✓ | ✓ | ✓ | ✓ |
| set-health-status | ✓ | ✓ | — | — | — | — | — | — | — | — |
| manage-users | ✓ | — | — | — | — | — | ✓ | — | — | — |
| manage-master-data | ✓ | — | — | — | — | — | ✓ | — | — | — |
| view-audit-logs | ✓ | — | — | — | — | — | — | — | — | — |
| manage-hse | ✓ | — | — | — | — | — | — | ✓ | — | — |
| view-emergency | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| view-profile | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| input-lab-result | ✓ | — | — | — | — | ✓ | — | — | — | — |

## Site Scope Matrix

| Role | Site A | Site B | Multi-site | Result |
|---|---|---|---|---|
| HR Site A | ✓ | ✗ | — | Can only view Site A workers |
| Dokter Klinik A | ✓ | ✗ | — | Can only view Site A patients/visits |
| HSE multi-site | ✓ | ✓ | ✓ | Can view assigned sites |
| Apoteker Site A | ✓ | ✗ | — | Can only view Site A stock/prescriptions |
| Management | Summary | Summary | ✓ | Can view org-level summaries |
| Public token | Single waiver | — | — | Can only view token-specific data |

## Worker Portal Policy

- **No backend JWT**: Workers (pekerja) do not have backend user accounts
- **Public token access**: Workers use consent tokens for public flows (consent approval, waiver verification)
- **Self-service**: Workers can view their own MCU history, certificates, and health status via public token
- **No clinical access**: Workers cannot view other workers' data or clinical notes

## Demo Role Mapping

| Demo Role | Maps To | Notes |
|---|---|---|
| `ADMIN_CLINIC` | `admin-klinik` | Simulates clinic admin UI |
| `HR_PIC` | `hr` | Simulates HR PIC UI |
| `SYSTEM_ADMIN` | `admin` | Simulates system admin UI |
| `PUBLIC_WORKER` | `pekerja` | Simulates worker portal UI |

Demo roles are UI-only simulations. Backend authorization is always enforced.
