"use client";

import { useEffect, useState } from "react";

/**
 * Lapisan sinkronisasi data modul frontend <-> backend.
 *
 * Setiap fungsi `syncX()` mengambil data dari endpoint backend lalu menaruhnya
 * ke dalam store (state) sehingga halaman yang sudah ada tetap bisa membaca
 * data lewat `useStore(...)` tanpa mengubah struktur UI.
 *
 * Pemetaan: response backend (snake_case / bentuk asli) -> tipe frontend.
 */
import { useStore } from "@/lib/store";
import { patientService } from "@/lib/services/patient.service";
import { encounterService, type BackendQueueTicket } from "@/lib/services/encounter.service";
import {
  mcuService,
  type BackendMcuCycle,
  type FtwStatus,
  type McuType,
} from "@/lib/services/mcu.service";
import { pharmacyService, type BackendInventoryItem } from "@/lib/services/pharmacy.service";
import { notificationService, type BackendNotification } from "@/lib/services/notification.service";
import { iamService, type BackendAuditLogRow, type BackendUserRow } from "@/lib/services/iam.service";
import { mapBackendRole, ROLE_TITLES } from "@/lib/services/auth.service";
import type {
  AppNotification,
  AuditLog,
  ClinicVisit,
  Company,
  Department,
  Dispensing,
  Employee,
  Medicine,
  MCU,
  StockBatch,
  User,
  VisitStatus,
  WorkHealthStatus,
  WorkLocation,
} from "@/lib/types";
import type { PersonListItem } from "@/features/people/api/people.types";

const PAGE_SIZE = 100;

function iso(value?: string | Date | null): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function mergeById<T extends { id: string }>(base: T[], extra: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of base) map.set(item.id, item);
  for (const item of extra) map.set(item.id, item);
  return Array.from(map.values());
}

// ---------------------------------------------------------------------------
// Modul 2 — Master Patient Index (MPI)
// ---------------------------------------------------------------------------
export async function syncPatients(page = 1, limit = PAGE_SIZE): Promise<PersonListItem[]> {
  const res = await patientService.list({ page, pageSize: limit });
  const rows = res.data;

  const employees: Employee[] = rows.map((p) => ({
    id: p.id,
    employeeId: p.employeeNo,
    mrn: p.mrn,
    fullName: p.fullName,
    nationalId: p.maskedIdentifier ?? "",
    dateOfBirth: p.birthDate ?? "",
    gender: p.sex === "F" ? "Female" : "Male",
    companyId: p.organizationName ? `cmp:${p.organizationName}` : "",
    departmentId: p.unitName ? `dep:${p.unitName}` : "",
    jobTitle: "",
    locationId: p.siteName ? `loc:${p.siteName}` : "",
    startDate: p.updatedAt ? p.updatedAt.slice(0, 10) : "",
    status: p.employmentStatus === "ACTIVE" ? "Active" : "Inactive",
    phone: "",
    email: "",
    employmentHistory: [],
    consentGiven: p.consentStatus === "APPROVED",
    documents: [],
  }));

  const companies: Company[] = [];
  const departments: Department[] = [];
  const locations: WorkLocation[] = [];

  for (const p of rows) {
    if (p.organizationName) {
      companies.push({ id: `cmp:${p.organizationName}`, name: p.organizationName });
    }
    if (p.unitName) {
      departments.push({
        id: `dep:${p.unitName}`,
        name: p.unitName,
        companyId: p.organizationName ? `cmp:${p.organizationName}` : "",
      });
    }
    if (p.siteName) {
      locations.push({
        id: `loc:${p.siteName}`,
        name: p.siteName,
        type: "office",
        companyId: p.organizationName ? `cmp:${p.organizationName}` : "",
      });
    }
  }

  useStore.setState((s) => ({
    employees,
    companies: mergeById(s.companies, companies),
    departments: mergeById(s.departments, departments),
    locations: mergeById(s.locations, locations),
  }));

  return rows;
}

// ---------------------------------------------------------------------------
// Modul 3 — Klinik Rawat Jalan (antrean / kunjungan)
// ---------------------------------------------------------------------------
const QUEUE_STATUS_MAP: Record<string, VisitStatus> = {
  WAITING: "In Queue",
  CALLED: "In Consultation",
  IN_SERVICE: "In Consultation",
  COMPLETED: "Completed",
  CANCELLED: "Referred",
};

export function mapQueueTicket(ticket: BackendQueueTicket, index: number): ClinicVisit {
  const patient = ticket.appointment?.patient;
  const createdAt = iso(ticket.created_at);
  return {
    id: ticket.id,
    visitNumber: ticket.ticket_no ?? `TKT-${index + 1}`,
    queueNumber: index + 1,
    employeeId: patient?.id ?? "",
    locationId: "",
    date: createdAt.slice(0, 10),
    time: createdAt ? new Date(createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "",
    chiefComplaint: "",
    initialExam: "",
    diagnosisIds: [],
    diagnosisNote: "",
    treatment: "",
    doctorNote: "",
    status: QUEUE_STATUS_MAP[ticket.status] ?? "In Queue",
    createdAt,
  };
}

export async function syncQueues(siteId?: string): Promise<ClinicVisit[]> {
  const tickets = await encounterService.getQueues(siteId);
  const visits = tickets.map(mapQueueTicket);
  useStore.setState({ visits });
  return visits;
}

// ---------------------------------------------------------------------------
// Modul 4 — MCU & Fitness to Work
// ---------------------------------------------------------------------------
export function mapMcuTypeToBackend(type: string): McuType {
  const map: Record<string, McuType> = {
    "Pre-Employment": "PRE_EMPLOYMENT",
    Periodic: "ANNUAL_PERIODIC",
    "Return to Work": "POST_ILLNESS",
    Special: "SPECIAL_HAZARD",
  };
  return map[type] ?? "ANNUAL_PERIODIC";
}

const MCU_TYPE_MAP: Record<string, MCU["type"]> = {
  PRE_EMPLOYMENT: "Pre-Employment",
  ANNUAL_PERIODIC: "Periodic",
  POST_ILLNESS: "Return to Work",
  SPECIAL_HAZARD: "Special",
  OFFSHORE_CLEARANCE: "Special",
};

export function mapHealthToFtw(status: string): FtwStatus {
  switch (status) {
    case "Fit to Work":
      return "FIT";
    case "Fit with Restriction":
      return "FIT_WITH_RESTRICTION";
    case "Unfit":
      return "UNFIT";
    default:
      return "TEMPORARILY_UNFIT";
  }
}

export function mapFtwToHealthStatus(ftw?: string | null): MCU["decision"] {
  switch (ftw) {
    case "FIT":
      return "Fit to Work";
    case "FIT_WITH_RESTRICTION":
      return "Fit with Restriction";
    case "TEMPORARILY_UNFIT":
      return "Temporarily Unfit";
    case "UNFIT":
      return "Unfit";
    default:
      return undefined;
  }
}

export function mapMcuCycle(cycle: BackendMcuCycle, index: number): MCU {
  const patient = cycle.patient;
  const employee = patient?.employee;
  const assessment = cycle.ftw_assessment;
  const decision = mapFtwToHealthStatus(assessment?.ftw_status);
  const status: MCU["status"] = assessment
    ? "Approved"
    : cycle.status === "DRAFT"
      ? "Draft"
      : "Submitted";

  return {
    id: cycle.id,
    mcuNumber: `MCU-${cycle.id.slice(0, 8).toUpperCase()}`,
    employeeId: patient?.id ?? "",
    type: MCU_TYPE_MAP[cycle.mcu_type] ?? "Periodic",
    examDate: (cycle.examination_date ?? "").slice(0, 10),
    facility: employee?.site?.name ?? "",
    result: { bloodPressure: "", heartRate: "", heightCm: "", weightKg: "", vision: "", hearing: "", notes: "" },
    documents: [],
    status,
    decision,
    decisionNote: assessment?.summary ?? undefined,
    validFrom: (cycle.valid_from ?? "").slice(0, 10),
    validUntil: (cycle.valid_until ?? "").slice(0, 10),
    history: [
      {
        id: `${cycle.id}-h${index}`,
        status,
        note: assessment?.summary ?? undefined,
        by: cycle.reviewer_user_id ?? "",
        byName: employee?.full_name ?? "",
        at: iso(cycle.created_at) || new Date().toISOString(),
      },
    ],
    createdAt: iso(cycle.created_at),
    createdBy: cycle.reviewer_user_id ?? "",
  };
}

export async function syncMcu(page = 1, limit = PAGE_SIZE, ftwStatus?: string): Promise<MCU[]> {
  const res = await mcuService.list({ page, limit, ftwStatus: ftwStatus as never });
  const mcus = (res.data ?? []).map(mapMcuCycle);
  useStore.setState({ mcus });
  return mcus;
}

// ---------------------------------------------------------------------------
// Modul 4 — Status Kepatuhan Kerja (FTW) diturunkan dari siklus MCU backend
//
// A1: halaman status kesehatan TIDAK boleh lagi menampilkan data seed
// (WORK_HEALTH_STATUS dari `lib/seed.ts`) sebagai data produksi. Sumber
// tunggalnya adalah assessment FTW pada siklus MCU yang dikembalikan backend.
// ---------------------------------------------------------------------------

export function mapWorkHealthStatus(cycle: BackendMcuCycle): WorkHealthStatus | null {
  const assessment = cycle.ftw_assessment;
  if (!assessment) return null;
  const restriction = assessment.restrictions?.[0];
  return {
    id: assessment.id ?? `${cycle.id}-whs`,
    employeeId: cycle.patient_id,
    mcuId: cycle.id,
    status: mapFtwToHealthStatus(assessment.ftw_status) ?? "Pending Further Evaluation",
    decisionDate: (assessment.assessed_at ?? "").slice(0, 10),
    validFrom: (cycle.valid_from ?? "").slice(0, 10),
    validUntil: (cycle.valid_until ?? "").slice(0, 10),
    restriction: restriction?.description,
    recommendation: assessment.summary ?? undefined,
    reviewDate: restriction?.review_date ? restriction.review_date.slice(0, 10) : undefined,
    doctorId: cycle.reviewer_user_id ?? "",
    doctorName: assessment.assessed_by ?? "",
    createdAt: iso(cycle.created_at),
  };
}

export async function syncWorkHealthStatus(
  page = 1,
  limit = PAGE_SIZE
): Promise<WorkHealthStatus[]> {
  const res = await mcuService.list({ page, limit });
  const rows = (res.data ?? [])
    .map(mapWorkHealthStatus)
    .filter((row): row is WorkHealthStatus => row !== null);
  useStore.setState({ workHealthStatus: rows });
  return rows;
}

// ---------------------------------------------------------------------------
// Modul 5 — Farmasi (FEFO)
// ---------------------------------------------------------------------------
export function mapInventory(items: BackendInventoryItem[]): {
  medicines: Medicine[];
  stockBatches: StockBatch[];
} {
  const medicines: Medicine[] = [];
  const stockBatches: StockBatch[] = [];

  for (const item of items) {
    const medicine: Medicine = {
      id: item.id,
      code: item.medicationCode,
      name: item.strength ? `${item.genericName} ${item.strength}` : item.genericName,
      category: item.dosageForm ?? "Obat",
      unit: item.dosageForm ?? "unit",
      minStock: item.minimumStock ?? 0,
    };
    medicines.push(medicine);

    stockBatches.push({
      id: item.id,
      medicineId: item.id,
      locationId: item.siteName ? `loc:${item.siteName}` : "",
      batchNumber: `${item.activeBatchesCount ?? 0} batch aktif`,
      quantity: item.currentStock ?? 0,
      receivedAt: "",
      expiresAt: (item.nearestExpiryDate ?? "").slice(0, 10),
    });
  }

  return { medicines, stockBatches };
}

export async function syncInventory(siteId?: string) {
  const items = await pharmacyService.getInventory(siteId);
  const { medicines, stockBatches } = mapInventory(items);
  useStore.setState((s) => ({
    medicines,
    stockBatches: mergeById(s.stockBatches, stockBatches),
  }));
  return items;
}

/**
 * Riwayat dispensing dari backend (GET /pharmacy/dispensing/history).
 *
 * A1: sebelumnya kartu "Dispensing" pada halaman laporan memakai data seed
 * (`DISPENSINGS` dari `lib/seed.ts`) — data demo yang tampil di produksi.
 */
export async function syncDispensings(): Promise<Dispensing[]> {
  const rows = await pharmacyService.getDispensingHistory();
  const dispensings: Dispensing[] = rows.map((d) => ({
    id: d.id,
    visitId: d.prescription?.encounter_id ?? d.prescription_id ?? "",
    medicineId: d.prescription?.items?.[0]?.medication_id ?? "",
    batchId: d.dispensing_items?.[0]?.stock_batch_id ?? "",
    quantity: (d.dispensing_items ?? []).reduce((sum, i) => sum + (i.quantity ?? 0), 0),
    dispensedAt: (d.dispensed_at ?? "").slice(0, 10),
    by: d.dispensed_by ?? "",
  }));
  useStore.setState({ dispensings });
  return dispensings;
}

// ---------------------------------------------------------------------------
// Modul 6 — Notifikasi
// ---------------------------------------------------------------------------
export function mapNotification(n: BackendNotification): AppNotification {
  const template = n.template;
  return {
    id: n.id,
    userId: n.user_id ?? "",
    title: template?.subject_template ?? n.related_type ?? "Notifikasi",
    message: template?.body_template ?? "",
    read: n.status === "READ",
    createdAt: iso(n.created_at),
  };
}

export async function syncNotifications(): Promise<AppNotification[]> {
  const notifications = (await notificationService.getAll()).map(mapNotification);
  useStore.setState({ notifications });
  return notifications;
}

// ---------------------------------------------------------------------------
// Modul 7 — Users & Audit Log
// ---------------------------------------------------------------------------
export function mapUser(u: BackendUserRow, existing?: User): User {
  const roleCodes = (u.user_roles ?? []).map((r) => r.role?.code).filter(Boolean) as string[];
  const role = mapBackendRole(roleCodes);
  const title =
    existing?.title ??
    (u.user_roles ?? []).find((r) => r.role?.code)?.role?.name ??
    ROLE_TITLES[role] ??
    role;
  return {
    id: u.id,
    username: u.username,
    password: existing?.password ?? "",
    name: existing?.name ?? u.username,
    role: role as User["role"],
    title,
    locationId: existing?.locationId,
    employeeId: existing?.employeeId,
    mfaEnabled: false,
    preferredLanguage: existing?.preferredLanguage ?? "id",
  };
}

export async function syncUsers(page = 1, limit = PAGE_SIZE): Promise<User[]> {
  const res = await iamService.listUsers(page, limit);
  const rows = res.data;
  const current = useStore.getState();
  const users = rows.map((u) => mapUser(u, current.users.find((x) => x.id === u.id)));

  // Pastikan sesi yang sedang login tidak hilang dari daftar
  if (
    current.currentUserId &&
    !users.some((u) => u.id === current.currentUserId)
  ) {
    const sessionUser = current.users.find((u) => u.id === current.currentUserId);
    if (sessionUser) users.unshift(sessionUser);
  }

  useStore.setState({ users });
  return users;
}

export function mapAuditLog(row: BackendAuditLogRow): AuditLog {
  return {
    id: row.id,
    userId: row.actor_user_id ?? "",
    userName: row.actor?.username ?? "SYSTEM",
    action: row.action,
    objectType: row.resource_type,
    objectId: row.resource_id ?? "",
    before: row.prev_hash,
    after: row.event_hash,
    at: iso(row.created_at),
  };
}

export async function syncAuditLogs(page = 1, limit = 50): Promise<AuditLog[]> {
  const res = await iamService.listAuditLogs(page, limit);
  const auditLogs = res.data.map(mapAuditLog);
  useStore.setState({ auditLogs });
  return auditLogs;
}

// ---------------------------------------------------------------------------
// Modul 11 — Master data (katalog ICD-10)
// ---------------------------------------------------------------------------
export async function syncMasterData(): Promise<void> {
  const rows = await encounterService.searchIcd10("");
  const diagnoses = rows.map((r) => ({
    id: r.id ?? r.code,
    code: r.code,
    description: r.description ?? "",
    category: "",
  }));
  if (diagnoses.length > 0) {
    useStore.setState({ diagnoses });
  }
}

// ---------------------------------------------------------------------------
// Hook untuk memicu sinkronisasi dari halaman ("use client")
// ---------------------------------------------------------------------------
export function useSyncedModules(syncOnce: () => Promise<unknown>): {
  loading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    // Jalankan sinkronisasi di task berikutnya agar tidak memanggil setState
    // secara sinkron di dalam effect (react-hooks/set-state-in-effect).
    const timer = setTimeout(() => {
      setLoading(true);
      syncOnce()
        .then(() => {
          if (alive) setError(null);
        })
        .catch((e: unknown) => {
          if (alive) setError(e instanceof Error ? e.message : "Gagal memuat data dari backend.");
        })
        .finally(() => {
          if (alive) setLoading(false);
        });
    }, 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  return { loading, error, refetch: () => setReloadKey((k) => k + 1) };
}
