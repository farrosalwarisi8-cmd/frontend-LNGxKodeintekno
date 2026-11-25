/**
 * Stub production untuk `@/lib/demo-seed`.
 *
 * Di-alias oleh `next.config.ts` pada build production/staging agar modul
 * `lib/seed.ts` (data klinis fiktif) tidak pernah ikut ter-bundle. Semua
 * koleksi kosong; data asli hanya datang dari backend.
 */
import type {
  AppNotification,
  AuditLog,
  ClinicVisit,
  Company,
  Department,
  Diagnosis,
  Dispensing,
  Employee,
  ExternalReferral,
  HealthCertificate,
  MCU,
  Medicine,
  StockBatch,
  StockTransaction,
  User,
  WorkHealthStatus,
  WorkLocation,
} from "@/lib/types"

export const COMPANIES: Company[] = []
export const DEPARTMENTS: Department[] = []
export const LOCATIONS: WorkLocation[] = []
export const USERS: User[] = []
export const EMPLOYEES: Employee[] = []
export const DIAGNOSES: Diagnosis[] = []
export const MEDICINES: Medicine[] = []
export const STOCK_BATCHES: StockBatch[] = []
export const MCUS: MCU[] = []
export const WORK_HEALTH_STATUS: WorkHealthStatus[] = []
export const VISITS: ClinicVisit[] = []
export const REFERRALS: ExternalReferral[] = []
export const DISPENSINGS: Dispensing[] = []
export const STOCK_TRANSACTIONS: StockTransaction[] = []
export const CERTIFICATES: HealthCertificate[] = []
export const NOTIFICATIONS: AppNotification[] = []
export const AUDIT_LOGS: AuditLog[] = []
