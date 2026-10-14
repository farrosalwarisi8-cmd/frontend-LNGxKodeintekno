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
  Employee,
  Medicine,
  MCU,
  StockBatch,
  User,
  VisitStatus,
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
  // Fase 4 — GET /patients tidak menerima siteId (kontrak backend), jadi untuk
  // user GLOBAL yang memilih scope site tertentu, filter baris dilakukan di
  // client berdasarkan nama site (satu-satunya info site pada response list).
  const { activeSiteName } = useStore.getState();
  const rows = activeSiteName
    ? res.data.filter((p) => (p.siteName ?? "") === activeSiteName)
    : res.data;

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
    appointmentId: ticket.appointment_id,
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

/**
 * Jejak yang hanya dimiliki lapisan frontend dan harus bertahan saat
 * antrean di-refetch: id encounter backend, status kunci (LOCKED), dan
 * isi SOAP yang sudah tersimpan. Tanpa ini bukti "SOAP tersimpan" dan
 * "record terkunci" hilang setiap kali halaman dimuat ulang.
 */
function keepLocalClinicalTrace(prev: ClinicVisit, next: ClinicVisit): ClinicVisit {
  return {
    ...next,
    appointmentId: prev.appointmentId || next.appointmentId,
    encounterId: prev.encounterId,
    recordStatus: prev.recordStatus,
    lockedAt: prev.lockedAt,
    employeeId: prev.employeeId || next.employeeId,
    locationId: prev.locationId || next.locationId,
    chiefComplaint: prev.chiefComplaint || next.chiefComplaint,
    initialExam: prev.initialExam || next.initialExam,
    diagnosisIds: prev.diagnosisIds.length > 0 ? prev.diagnosisIds : next.diagnosisIds,
    diagnosisNote: prev.diagnosisNote || next.diagnosisNote,
    treatment: prev.treatment || next.treatment,
    doctorNote: prev.doctorNote || next.doctorNote,
  };
}

export async function syncQueues(siteId?: string): Promise<ClinicVisit[]> {
  // Fase 4 — bila caller tidak menentukan site, pakai scope site aktif dari UI
  // (GET /clinic/queues?siteId= didukung backend).
  const activeSiteId = useStore.getState().activeSiteId;
  const tickets = await encounterService.getQueues(siteId ?? activeSiteId ?? undefined);
  const fresh = tickets.map(mapQueueTicket);
  const visits = useStore.getState().visits;
  const queuedIds = new Set(fresh.map((v) => v.id));
  const merged = fresh.map((next) => {
    const prev = visits.find((v) => v.id === next.id);
    return prev ? keepLocalClinicalTrace(prev, next) : next;
  });
  // Kunjungan yang dibuat via POST /clinic/encounters (bukan dari antrean)
  // tetap ditampilkan — kalau tidak, bukti "SOAP tersimpan" hilang begitu
  // halaman Rekam Medis di-refresh.
  const localEncounters = visits.filter((v) => v.encounterId && !queuedIds.has(v.id));
  const result = [...merged, ...localEncounters];
  useStore.setState({ visits: result });
  return result;
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
  // Fase 4 — GET /mcu/cycles tidak menerima siteId; filter scope site aktif
  // berdasarkan nama site pekerja pada response.
  const { activeSiteName } = useStore.getState();
  const mcus = (res.data ?? [])
    .filter((c) => {
      if (!activeSiteName) return true;
      const siteName = c.patient?.employee?.site?.name;
      return typeof siteName === "string" && siteName === activeSiteName;
    })
    .map(mapMcuCycle);
  useStore.setState({ mcus });
  return mcus;
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
  // Fase 4 — scope site aktif diteruskan ke backend (GET /pharmacy/inventory?siteId=).
  const activeSiteId = useStore.getState().activeSiteId;
  const items = await pharmacyService.getInventory(siteId ?? activeSiteId ?? undefined);
  const { medicines, stockBatches } = mapInventory(items);
  useStore.setState((s) => ({
    medicines,
    stockBatches: mergeById(s.stockBatches, stockBatches),
  }));
  return items;
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
    read: n.status === "READ" || n.status === "SENT" || n.status === "DELIVERED",
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
  // Fase 4 — setiap perpindahan scope site menaikkan scopeVersion di store;
  // halaman yang sedang terbuka ikut membuang hasil lama dan memuat ulang
  // data sesuai scope baru.
  const scopeVersion = useStore((s) => s.scopeVersion);

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
  }, [reloadKey, scopeVersion]);

  return { loading, error, refetch: () => setReloadKey((k) => k + 1) };
}
