"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type {
  AppNotification,
  AuditLog,
  ClinicVisit,
  Company,
  Department,
  Dispensing,
  Employee,
  HealthCertificate,
  HealthStatus,
  MCU,
  MCUResult,
  Medicine,
  Role,
  StockBatch,
  StockTransaction,
  User,
  WorkHealthStatus,
  WorkLocation,
} from "@/lib/types"
import {
  AUDIT_LOGS,
  CERTIFICATES,
  COMPANIES,
  DEPARTMENTS,
  DIAGNOSES,
  DISPENSINGS,
  EMPLOYEES,
  LOCATIONS,
  MCUS,
  MEDICINES,
  NOTIFICATIONS,
  STOCK_BATCHES,
  STOCK_TRANSACTIONS,
  USERS,
  VISITS,
  WORK_HEALTH_STATUS,
} from "@/lib/seed"
import { uid, today } from "@/lib/format"

type Diagnosis = (typeof DIAGNOSES)[number]

export interface DispenseItem {
  medicineId: string
  batchId: string
  quantity: number
}

interface AppState {
  _hasHydrated: boolean
  setHasHydrated: (v: boolean) => void
  currentUserId: string | null

  users: User[]
  companies: Company[]
  departments: Department[]
  locations: WorkLocation[]
  employees: Employee[]
  diagnoses: Diagnosis[]
  medicines: Medicine[]
  stockBatches: StockBatch[]
  stockTransactions: StockTransaction[]
  mcus: MCU[]
  workHealthStatus: WorkHealthStatus[]
  visits: ClinicVisit[]
  dispensings: Dispensing[]
  certificates: HealthCertificate[]
  notifications: AppNotification[]
  auditLogs: AuditLog[]

  login: (username: string, password: string) => boolean
  logout: () => void

  findDuplicates: (nationalId: string, fullName: string) => Employee[]
  addEmployee: (input: Omit<Employee, "id" | "employeeId" | "employmentHistory">) => string
  updateEmployee: (id: string, patch: Partial<Employee>) => void

  createMCU: (input: { employeeId: string; type: MCU["type"]; examDate: string; facility: string }) => string
  updateMCUResult: (id: string, result: MCUResult) => void
  addMCUDocument: (mcuId: string, name: string, type: string) => void
  submitMCU: (id: string) => boolean
  requestRevision: (id: string, note: string) => void
  resubmitMCU: (id: string) => void
  approveMCU: (id: string, decision: HealthStatus, note: string, extra: { validFrom: string; validUntil: string; restriction?: string; recommendation?: string; reviewDate?: string }) => void
  rejectMCU: (id: string, note: string) => void

  registerVisit: (input: { employeeId: string; locationId: string; chiefComplaint: string }) => string
  updateVisit: (id: string, patch: Partial<ClinicVisit>) => void
  referVisit: (id: string, facility: string, reason: string) => void

  receiveStock: (input: { medicineId: string; locationId: string; batchNumber: string; quantity: number; expiresAt: string }) => void
  dispense: (visitId: string, items: DispenseItem[]) => { ok: boolean; error?: string }

  issueCertificate: (mcuId: string) => string | null
  revokeCertificate: (id: string) => void

  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
}

function resolveUser(state: { users: User[]; currentUserId: string | null }): User | null {
  return state.users.find((u) => u.id === state.currentUserId) ?? null
}

function pushAudit(
  list: AuditLog[],
  userId: string,
  userName: string,
  action: string,
  objectType: string,
  objectId: string,
  opts: { before?: string; after?: string; reason?: string } = {}
): AuditLog[] {
  return [
    {
      id: uid("a"),
      userId,
      userName,
      action,
      objectType,
      objectId,
      before: opts.before,
      after: opts.after,
      reason: opts.reason,
      at: new Date().toISOString(),
    },
    ...list,
  ]
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      currentUserId: null,

      users: USERS,
      companies: COMPANIES,
      departments: DEPARTMENTS,
      locations: LOCATIONS,
      employees: EMPLOYEES,
      diagnoses: DIAGNOSES,
      medicines: MEDICINES,
      stockBatches: STOCK_BATCHES,
      stockTransactions: STOCK_TRANSACTIONS,
      mcus: MCUS,
      workHealthStatus: WORK_HEALTH_STATUS,
      visits: VISITS,
      dispensings: DISPENSINGS,
      certificates: CERTIFICATES,
      notifications: NOTIFICATIONS,
      auditLogs: AUDIT_LOGS,

      login: (username, password) => {
        const user = get().users.find(
          (u) => u.username === username && u.password === password
        )
        if (user) {
          set({ currentUserId: user.id })
          return true
        }
        return false
      },

      logout: () => set({ currentUserId: null }),

      findDuplicates: (nationalId, fullName) => {
        const nid = nationalId.trim().toLowerCase()
        const nm = fullName.trim().toLowerCase()
        return get().employees.filter(
          (e) =>
            (nid && e.nationalId === nationalId) ||
            (nm && e.fullName.toLowerCase() === nm)
        )
      },

      addEmployee: (input) => {
        const max = get().employees.reduce((acc, e) => {
          const n = parseInt(e.employeeId.replace(/\D/g, ""), 10)
          return Number.isNaN(n) ? acc : Math.max(acc, n)
        }, 0)
        const id = uid("e")
        const employeeId = `EMP-${String(max + 1).padStart(4, "0")}`
        const employee: Employee = {
          ...input,
          id,
          employeeId,
          employmentHistory: [
            {
              id: uid("eh"),
              departmentId: input.departmentId,
              locationId: input.locationId,
              jobTitle: input.jobTitle,
              from: today(),
              note: "Penempatan awal",
            },
          ],
        }
        const user = resolveUser(get())
        set((s) => ({
          employees: [employee, ...s.employees],
          auditLogs: pushAudit(s.auditLogs, user?.id ?? "", user?.name ?? "", "CREATE_EMPLOYEE", "Employee", id, { after: employeeId }),
        }))
        return id
      },

      updateEmployee: (id, patch) => {
        const user = resolveUser(get())
        set((s) => {
          const employees = s.employees.map((e) => {
            if (e.id !== id) return e
            const changed =
              (patch.departmentId && patch.departmentId !== e.departmentId) ||
              (patch.locationId && patch.locationId !== e.locationId) ||
              (patch.jobTitle && patch.jobTitle !== e.jobTitle)
            const history = changed
              ? [
                  {
                    id: uid("eh"),
                    departmentId: patch.departmentId ?? e.departmentId,
                    locationId: patch.locationId ?? e.locationId,
                    jobTitle: patch.jobTitle ?? e.jobTitle,
                    from: today(),
                    note: "Perubahan penempatan",
                  },
                  ...e.employmentHistory,
                ]
              : e.employmentHistory
            return { ...e, ...patch, employmentHistory: history }
          })
          return {
            employees,
            auditLogs: pushAudit(s.auditLogs, user?.id ?? "", user?.name ?? "", "UPDATE_EMPLOYEE", "Employee", id),
          }
        })
      },

      createMCU: (input) => {
        const max = get().mcus.reduce((acc, m) => {
          const n = parseInt(m.mcuNumber.replace(/\D/g, ""), 10)
          return Number.isNaN(n) ? acc : Math.max(acc, n)
        }, 0)
        const id = uid("mcu")
        const mcu: MCU = {
          id,
          mcuNumber: `MCU-${String(max + 1).padStart(4, "0")}`,
          employeeId: input.employeeId,
          type: input.type,
          examDate: input.examDate,
          facility: input.facility,
          result: { bloodPressure: "", heartRate: "", heightCm: "", weightKg: "", vision: "", hearing: "", notes: "" },
          documents: [],
          status: "Draft",
          history: [
            { id: uid("h"), status: "Draft", by: get().currentUserId ?? "", byName: resolveUser(get())?.name ?? "", at: new Date().toISOString() },
          ],
          createdAt: today(),
          createdBy: get().currentUserId ?? "",
        }
        set((s) => ({
          mcus: [mcu, ...s.mcus],
          auditLogs: pushAudit(s.auditLogs, get().currentUserId ?? "", resolveUser(get())?.name ?? "", "CREATE_MCU", "MCU", id, { after: mcu.mcuNumber }),
        }))
        return id
      },

      updateMCUResult: (id, result) => {
        set((s) => ({
          mcus: s.mcus.map((m) => (m.id === id ? { ...m, result } : m)),
        }))
      },

      addMCUDocument: (mcuId, name, type) => {
        set((s) => ({
          mcus: s.mcus.map((m) =>
            m.id === mcuId
              ? {
                  ...m,
                  documents: [...m.documents, { id: uid("doc"), mcuId, name, type, uploadedAt: today() }],
                }
              : m
          ),
        }))
      },

      submitMCU: (id) => {
        const mcu = get().mcus.find((m) => m.id === id)
        if (!mcu) return false
        const valid =
          mcu.result.bloodPressure !== "" &&
          mcu.result.heartRate !== "" &&
          mcu.result.heightCm !== "" &&
          mcu.result.weightKg !== ""
        if (!valid) return false
        const doctor = get().users.find((u) => u.role === "doctor")
        set((s) => ({
          mcus: s.mcus.map((m) =>
            m.id === id
              ? {
                  ...m,
                  status: "Submitted",
                  history: [
                    { id: uid("h"), status: "Submitted", by: get().currentUserId ?? "", byName: resolveUser(get())?.name ?? "", at: new Date().toISOString() },
                    ...m.history,
                  ],
                }
              : m
          ),
          notifications: doctor
            ? [
                { id: uid("n"), userId: doctor.id, title: "MCU baru menunggu review", message: `${mcu.mcuNumber} telah disubmit.`, read: false, createdAt: new Date().toISOString() },
                ...s.notifications,
              ]
            : s.notifications,
          auditLogs: pushAudit(s.auditLogs, get().currentUserId ?? "", resolveUser(get())?.name ?? "", "SUBMIT_MCU", "MCU", id, { before: "Draft", after: "Submitted" }),
        }))
        return true
      },

      requestRevision: (id, note) => {
        set((s) => ({
          mcus: s.mcus.map((m) =>
            m.id === id
              ? {
                  ...m,
                  status: "Revision Required",
                  history: [
                    { id: uid("h"), status: "Revision Required", note, by: get().currentUserId ?? "", byName: resolveUser(get())?.name ?? "", at: new Date().toISOString() },
                    ...m.history,
                  ],
                }
              : m
          ),
          auditLogs: pushAudit(s.auditLogs, get().currentUserId ?? "", resolveUser(get())?.name ?? "", "REQUEST_REVISION", "MCU", id, { before: "Submitted", after: "Revision Required", reason: note }),
        }))
      },

      resubmitMCU: (id) => {
        const mcu = get().mcus.find((m) => m.id === id)
        const doctor = get().users.find((u) => u.role === "doctor")
        set((s) => ({
          mcus: s.mcus.map((m) =>
            m.id === id
              ? {
                  ...m,
                  status: "Resubmitted",
                  history: [
                    { id: uid("h"), status: "Resubmitted", by: get().currentUserId ?? "", byName: resolveUser(get())?.name ?? "", at: new Date().toISOString() },
                    ...m.history,
                  ],
                }
              : m
          ),
          notifications: doctor
            ? [
                { id: uid("n"), userId: doctor.id, title: "MCU diresubmit", message: `${mcu?.mcuNumber ?? id} telah diresubmit.`, read: false, createdAt: new Date().toISOString() },
                ...s.notifications,
              ]
            : s.notifications,
          auditLogs: pushAudit(s.auditLogs, get().currentUserId ?? "", resolveUser(get())?.name ?? "", "RESUBMIT_MCU", "MCU", id, { before: "Revision Required", after: "Resubmitted" }),
        }))
      },

      approveMCU: (id, decision, note, extra) => {
        const mcu = get().mcus.find((m) => m.id === id)
        if (!mcu) return
        const doctor = resolveUser(get())
        const whs: WorkHealthStatus = {
          id: uid("whs"),
          employeeId: mcu.employeeId,
          mcuId: id,
          status: decision,
          decisionDate: today(),
          validFrom: extra.validFrom,
          validUntil: extra.validUntil,
          restriction: extra.restriction,
          recommendation: extra.recommendation,
          reviewDate: extra.reviewDate,
          doctorId: doctor?.id ?? "u2",
          doctorName: doctor?.name ?? "dr. Siti Rahayu",
          createdAt: new Date().toISOString(),
        }
        const hrUsers = get().users.filter((u) => u.role === "hr")
        const workerUser = get().users.find((u) => u.employeeId === get().employees.find((e) => e.id === mcu.employeeId)?.employeeId)
        const notifs: AppNotification[] = [
          ...hrUsers.map((u) => ({
            id: uid("n"),
            userId: u.id,
            title: "Status kesehatan kerja ditetapkan",
            message: `${mcu.mcuNumber}: ${decision}.`,
            read: false,
            createdAt: new Date().toISOString(),
          })),
          ...(workerUser
            ? [{ id: uid("n"), userId: workerUser.id, title: "Hasil MCU ditetapkan", message: `${mcu.mcuNumber}: ${decision}.`, read: false, createdAt: new Date().toISOString() }]
            : []),
        ]
        set((s) => ({
          mcus: s.mcus.map((m) =>
            m.id === id
              ? {
                  ...m,
                  status: "Approved",
                  reviewerId: doctor?.id,
                  decision,
                  decisionNote: note,
                  validFrom: extra.validFrom,
                  validUntil: extra.validUntil,
                  history: [
                    { id: uid("h"), status: "Approved", note, by: doctor?.id ?? "", byName: doctor?.name ?? "", at: new Date().toISOString() },
                    ...m.history,
                  ],
                }
              : m
          ),
          workHealthStatus: [whs, ...s.workHealthStatus],
          notifications: [...notifs, ...s.notifications],
          auditLogs: pushAudit(s.auditLogs, doctor?.id ?? "", doctor?.name ?? "", "APPROVE_MCU", "MCU", id, { before: "Submitted", after: "Approved", reason: note }),
        }))
      },

      rejectMCU: (id, note) => {
        const doctor = resolveUser(get())
        set((s) => ({
          mcus: s.mcus.map((m) =>
            m.id === id
              ? {
                  ...m,
                  status: "Rejected",
                  decisionNote: note,
                  history: [
                    { id: uid("h"), status: "Rejected", note, by: doctor?.id ?? "", byName: doctor?.name ?? "", at: new Date().toISOString() },
                    ...m.history,
                  ],
                }
              : m
          ),
          auditLogs: pushAudit(s.auditLogs, doctor?.id ?? "", doctor?.name ?? "", "REJECT_MCU", "MCU", id, { before: "Submitted", after: "Rejected", reason: note }),
        }))
      },

      registerVisit: (input) => {
        const maxVisit = get().visits.reduce((acc, v) => {
          const n = parseInt(v.visitNumber.replace(/\D/g, ""), 10)
          return Number.isNaN(n) ? acc : Math.max(acc, n)
        }, 0)
        const todaysQueue = get().visits.filter((v) => v.date === today()).length
        const id = uid("v")
        const visit: ClinicVisit = {
          id,
          visitNumber: `VIS-${String(maxVisit + 1).padStart(4, "0")}`,
          queueNumber: todaysQueue + 1,
          employeeId: input.employeeId,
          locationId: input.locationId,
          date: today(),
          time: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          chiefComplaint: input.chiefComplaint,
          initialExam: "",
          diagnosisIds: [],
          diagnosisNote: "",
          treatment: "",
          doctorNote: "",
          status: "Registered",
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ visits: [visit, ...s.visits] }))
        return id
      },

      updateVisit: (id, patch) => {
        set((s) => ({
          visits: s.visits.map((v) => (v.id === id ? { ...v, ...patch } : v)),
        }))
      },

      referVisit: (id, facility, reason) => {
        set((s) => ({
          visits: s.visits.map((v) =>
            v.id === id ? { ...v, status: "Referred", referralFacility: facility, referralReason: reason } : v
          ),
          auditLogs: pushAudit(s.auditLogs, get().currentUserId ?? "", resolveUser(get())?.name ?? "", "REFER_VISIT", "ClinicVisit", id, { after: facility }),
        }))
      },

      receiveStock: (input) => {
        const id = uid("b")
        set((s) => ({
          stockBatches: [
            { id, ...input, receivedAt: today() },
            ...s.stockBatches,
          ],
          stockTransactions: [
            { id: uid("st"), type: "receive", medicineId: input.medicineId, batchId: id, locationId: input.locationId, quantity: input.quantity, by: resolveUser(get())?.name ?? "", at: new Date().toISOString() },
            ...s.stockTransactions,
          ],
          auditLogs: pushAudit(s.auditLogs, get().currentUserId ?? "", resolveUser(get())?.name ?? "", "RECEIVE_STOCK", "Medicine", input.medicineId, { after: `+${input.quantity}` }),
        }))
      },

      dispense: (visitId, items) => {
        const { stockBatches, medicines, visits } = get()
        const visit = visits.find((v) => v.id === visitId)
        if (!visit) return { ok: false, error: "Visit tidak ditemukan" }

        for (const item of items) {
          const batch = stockBatches.find((b) => b.id === item.batchId)
          if (!batch) return { ok: false, error: "Batch tidak ditemukan" }
          if (batch.quantity < item.quantity) {
            const med = medicines.find((m) => m.id === item.medicineId)
            return { ok: false, error: `Stok ${med?.name ?? ""} tidak mencukupi` }
          }
        }

        const now = new Date().toISOString()
        const newDispensings: Dispensing[] = items.map((item) => ({
          id: uid("disp"),
          visitId,
          medicineId: item.medicineId,
          batchId: item.batchId,
          quantity: item.quantity,
          dispensedAt: today(),
          by: resolveUser(get())?.name ?? "",
        }))
        const newTx: StockTransaction[] = items.map((item) => ({
          id: uid("st"),
          type: "dispense",
          medicineId: item.medicineId,
          batchId: item.batchId,
          locationId: visit.locationId,
          quantity: item.quantity,
          relatedVisitId: visitId,
          by: resolveUser(get())?.name ?? "",
          at: now,
        }))

        const lowStock: AppNotification[] = []
        const nextBatches = get().stockBatches.map((b) => {
          const item = items.find((i) => i.batchId === b.id)
          if (!item) return b
          const newQty = b.quantity - item.quantity
          const med = medicines.find((m) => m.id === b.medicineId)
          if (med && newQty < med.minStock) {
            lowStock.push({
              id: uid("n"),
              userId: "u1",
              title: "Stok obat rendah",
              message: `Stok ${med.name} di ${get().locations.find((l) => l.id === b.locationId)?.name ?? ""} di bawah minimum (${newQty}).`,
              read: false,
              createdAt: now,
            })
          }
          return { ...b, quantity: newQty }
        })

        set((s) => ({
          stockBatches: nextBatches,
          stockTransactions: [...newTx, ...s.stockTransactions],
          dispensings: [...newDispensings, ...s.dispensings],
          visits: s.visits.map((v) => (v.id === visitId ? { ...v, status: "Completed" as const } : v)),
          notifications: [...lowStock, ...s.notifications],
          auditLogs: pushAudit(s.auditLogs, get().currentUserId ?? "", resolveUser(get())?.name ?? "", "DISPENSE_MEDICINE", "ClinicVisit", visitId, { after: `${items.length} item` }),
        }))
        return { ok: true }
      },

      issueCertificate: (mcuId) => {
        const mcu = get().mcus.find((m) => m.id === mcuId)
        if (!mcu || mcu.status !== "Approved") return null
        const existing = get().certificates.find((c) => c.mcuId === mcuId)
        if (existing) return existing.id
        const whs = get().workHealthStatus.find((w) => w.mcuId === mcuId)
        const max = get().certificates.reduce((acc, c) => {
          const n = parseInt(c.certNumber.replace(/\D/g, ""), 10)
          return Number.isNaN(n) ? acc : Math.max(acc, n)
        }, 0)
        const id = uid("cert")
        const cert: HealthCertificate = {
          id,
          certNumber: `HC-2026-${String(max + 1).padStart(4, "0")}`,
          employeeId: mcu.employeeId,
          mcuId,
          healthStatus: whs?.status ?? mcu.decision ?? "Fit to Work",
          restrictions: whs?.restriction,
          doctorId: get().currentUserId ?? "u2",
          doctorName: resolveUser(get())?.name ?? "dr. Siti Rahayu",
          issuedAt: today(),
          validUntil: mcu.validUntil ?? "2027-09-22",
          qrToken: `kodein-cert-${mcuId}`,
          status: "valid",
        }
        set((s) => ({
          certificates: [cert, ...s.certificates],
          auditLogs: pushAudit(s.auditLogs, get().currentUserId ?? "", resolveUser(get())?.name ?? "", "ISSUE_CERTIFICATE", "HealthCertificate", id, { after: cert.certNumber }),
        }))
        return id
      },

      revokeCertificate: (id) => {
        set((s) => ({
          certificates: s.certificates.map((c) => (c.id === id ? { ...c, status: "revoked" } : c)),
          auditLogs: pushAudit(s.auditLogs, get().currentUserId ?? "", resolveUser(get())?.name ?? "", "REVOKE_CERTIFICATE", "HealthCertificate", id, { before: "valid", after: "revoked" }),
        }))
      },

      markNotificationRead: (id) => {
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        }))
      },

      markAllNotificationsRead: () => {
        set((s) => ({
          notifications: s.notifications.map((n) => ({ ...n, read: true })),
        }))
      },
    }),
    {
      name: "kodein-klinik-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        currentUserId: s.currentUserId,
        users: s.users,
        companies: s.companies,
        departments: s.departments,
        locations: s.locations,
        employees: s.employees,
        diagnoses: s.diagnoses,
        medicines: s.medicines,
        stockBatches: s.stockBatches,
        stockTransactions: s.stockTransactions,
        mcus: s.mcus,
        workHealthStatus: s.workHealthStatus,
        visits: s.visits,
        dispensings: s.dispensings,
        certificates: s.certificates,
        notifications: s.notifications,
        auditLogs: s.auditLogs,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)

export function useCurrentUser(): User | null {
  const currentUserId = useStore((s) => s.currentUserId)
  return useStore((s) => s.users.find((u) => u.id === currentUserId) ?? null)
}

export function useCurrentRole(): Role | null {
  return useCurrentUser()?.role ?? null
}
