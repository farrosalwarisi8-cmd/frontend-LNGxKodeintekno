import type {
  AuditLog,
  AppNotification,
  ClinicVisit,
  Company,
  Department,
  Diagnosis,
  Dispensing,
  Employee,
  HealthCertificate,
  MCU,
  Medicine,
  StockBatch,
  StockTransaction,
  User,
  WorkHealthStatus,
  WorkLocation,
} from "@/lib/types"

export const COMPANIES: Company[] = [
  { id: "c1", name: "PT Nusantara Energi" },
  { id: "c2", name: "PT Samudra Resources" },
  { id: "c3", name: "PT Bumi Mineral" },
]

export const DEPARTMENTS: Department[] = [
  { id: "d1", name: "HR & GA", companyId: "c1" },
  { id: "d2", name: "Engineering", companyId: "c1" },
  { id: "d3", name: "Operations", companyId: "c2" },
  { id: "d4", name: "HSE", companyId: "c2" },
  { id: "d5", name: "Finance", companyId: "c3" },
]

export const LOCATIONS: WorkLocation[] = [
  { id: "l1", name: "Kantor Pusat Jakarta", type: "office", companyId: "c1" },
  { id: "l2", name: "Site Onshore Balikpapan", type: "onshore", companyId: "c2" },
  { id: "l3", name: "Rig Offshore Natuna", type: "offshore", companyId: "c3" },
]

export const USERS: User[] = [
  { id: "u1", username: "admin", password: "", name: "Bagus Pratama", role: "admin", title: "System Administrator", mfaEnabled: true, mfaMethod: "totp", mfaSecret: "123456", preferredLanguage: "id" },
  { id: "u2", username: "dokter", password: "", name: "dr. Siti Rahayu", role: "dokter-oh", title: "Dokter OH", mfaEnabled: false, preferredLanguage: "id" },
  { id: "u3", username: "klinik", password: "", name: "Andi Wijaya, Amd.Kep", role: "perawat", title: "Perawat Klinik", mfaEnabled: false, preferredLanguage: "id" },
  { id: "u4", username: "hr", password: "", name: "Rina Kurnia", role: "hr", title: "HR Officer", mfaEnabled: false, preferredLanguage: "id" },
  { id: "u5", username: "manajemen", password: "", name: "Dewi Lestari", role: "manajemen", title: "Management", mfaEnabled: false, preferredLanguage: "id" },
  { id: "u6", username: "pekerja", password: "", name: "Budi Santoso", role: "pekerja", title: "Employee", employeeId: "EMP-0001", mfaEnabled: false, preferredLanguage: "id" },
  { id: "u7", username: "dokter-klinik", password: "", name: "dr. Ahmad Hidayat", role: "dokter-klinik", title: "Dokter Klinik", mfaEnabled: false, preferredLanguage: "id" },
  { id: "u8", username: "apoteker", password: "", name: "Sari Wulandari, S.Farm", role: "apoteker", title: "Apoteker", mfaEnabled: false, preferredLanguage: "id" },
  { id: "u9", username: "lab", password: "", name: "Dian Prasetyo, A.Md", role: "lab", title: "Analis Lab", mfaEnabled: false, preferredLanguage: "id" },
  { id: "u10", username: "admin-klinik", password: "", name: "Rudi Hartono", role: "admin-klinik", title: "Admin Klinik", mfaEnabled: false, preferredLanguage: "id" },
  { id: "u11", username: "hse", password: "", name: "Hendra Gunawan", role: "hse", title: "HSE Officer", mfaEnabled: false, preferredLanguage: "id" },
]

const NAMES: { name: string; gender: "Male" | "Female" }[] = [
  { name: "Budi Santoso", gender: "Male" },
  { name: "Siti Nurhaliza", gender: "Female" },
  { name: "Agus Salim", gender: "Male" },
  { name: "Dewi Anggraini", gender: "Female" },
  { name: "Rizky Ramadhan", gender: "Male" },
  { name: "Putri Maharani", gender: "Female" },
  { name: "Joko Widodo", gender: "Male" },
  { name: "Ratna Sari", gender: "Female" },
  { name: "Hendra Gunawan", gender: "Male" },
  { name: "Maya Anggraini", gender: "Female" },
  { name: "Fajar Nugroho", gender: "Male" },
  { name: "Indah Permata", gender: "Female" },
  { name: "Tono Hartono", gender: "Male" },
  { name: "Lina Marlina", gender: "Female" },
  { name: "Yusuf Maulana", gender: "Male" },
  { name: "Nur Aini", gender: "Female" },
  { name: "Eko Prasetyo", gender: "Male" },
  { name: "Sari Wulandari", gender: "Female" },
  { name: "Ahmad Fauzi", gender: "Male" },
  { name: "Fitri Handayani", gender: "Female" },
  { name: "Deni Saputra", gender: "Male" },
  { name: "Citra Kirana", gender: "Female" },
  { name: "Irfan Hakim", gender: "Male" },
  { name: "Rina Marlina", gender: "Female" },
  { name: "Wahyu Hidayat", gender: "Male" },
  { name: "Dian Purnama", gender: "Female" },
  { name: "Rudi Hartono", gender: "Male" },
  { name: "Melati Putih", gender: "Female" },
  { name: "Slamet Riyadi", gender: "Male" },
  { name: "Ani Susanti", gender: "Female" },
]

const JOBS = [
  "Field Operator",
  "Technician",
  "Engineer",
  "HSE Officer",
  "Administration Staff",
  "Supervisor",
  "Driver",
  "Electrician",
  "Mechanic",
  "Welder",
]

const pad = (n: number) => String(n).padStart(4, "0")

function buildEmployees(): Employee[] {
  return NAMES.map((item, i) => {
    const idx = i + 1
    const companyId = COMPANIES[(i % 3)].id
    const dept = DEPARTMENTS[i % DEPARTMENTS.length]
    const loc = LOCATIONS[i % 3]
    const startYear = 2014 + (i % 9)
    const startMonth = String((i % 12) + 1).padStart(2, "0")
    const birthYear = 1980 + (i % 20)
    return {
      id: `e${idx}`,
      employeeId: `EMP-${pad(idx)}`,
      mrn: `MRN-${String(idx).padStart(6, "0")}`,
      fullName: item.name,
      nationalId: `32${String(50000000000000 + idx * 137911).padStart(14, "0")}`,
      dateOfBirth: `${birthYear}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
      gender: item.gender,
      companyId,
      departmentId: dept.id,
      jobTitle: JOBS[i % JOBS.length],
      locationId: loc.id,
      startDate: `${startYear}-${startMonth}-15`,
      status: i % 7 === 0 ? "Inactive" : i % 5 === 0 ? "Contract Ended" : "Active",
      phone: `0812${String(30000000 + idx * 123457).slice(-8)}`,
      email: `${item.name.toLowerCase().replace(/\s+/g, ".")}@kodein.co.id`,
      employmentHistory: [
        {
          id: `eh-${idx}`,
          departmentId: dept.id,
          locationId: loc.id,
          jobTitle: JOBS[i % JOBS.length],
          from: `${startYear}-${startMonth}-15`,
          note: "Penempatan awal",
        },
      ],
      consentGiven: i % 3 !== 0,
      consentDate: i % 3 !== 0 ? `${startYear}-${startMonth}-15` : undefined,
      documents: [],
    }
  })
}

export const EMPLOYEES: Employee[] = buildEmployees()

export const DIAGNOSES: Diagnosis[] = [
  { id: "dx1", code: "J00", description: "Acute nasopharyngitis (common cold)", category: "Respiratory" },
  { id: "dx2", code: "J20", description: "Acute bronchitis", category: "Respiratory" },
  { id: "dx3", code: "I10", description: "Essential (primary) hypertension", category: "Cardiovascular" },
  { id: "dx4", code: "M54.5", description: "Low back pain", category: "Musculoskeletal" },
  { id: "dx5", code: "K30", description: "Functional dyspepsia", category: "Gastrointestinal" },
  { id: "dx6", code: "R51", description: "Headache", category: "Neurological" },
  { id: "dx7", code: "A09", description: "Infectious gastroenteritis", category: "Gastrointestinal" },
  { id: "dx8", code: "L30.9", description: "Dermatitis, unspecified", category: "Skin" },
  { id: "dx9", code: "H10", description: "Conjunctivitis", category: "Ophthalmology" },
  { id: "dx10", code: "T14.0", description: "Superficial injury", category: "Trauma" },
]

export const MEDICINES: Medicine[] = [
  { id: "m1", code: "MDC-001", name: "Paracetamol 500mg", category: "Analgesic", unit: "tablet", minStock: 50 },
  { id: "m2", code: "MDC-002", name: "Ibuprofen 400mg", category: "Analgesic", unit: "tablet", minStock: 40 },
  { id: "m3", code: "MDC-003", name: "Amoxicillin 500mg", category: "Antibiotic", unit: "capsule", minStock: 30 },
  { id: "m4", code: "MDC-004", name: "Cetirizine 10mg", category: "Antihistamine", unit: "tablet", minStock: 30 },
  { id: "m5", code: "MDC-005", name: "Omeprazole 20mg", category: "Gastric", unit: "capsule", minStock: 30 },
  { id: "m6", code: "MDC-006", name: "Ranitidine 150mg", category: "Gastric", unit: "tablet", minStock: 30 },
  { id: "m7", code: "MDC-007", name: "Chlorpheniramine 4mg", category: "Antihistamine", unit: "tablet", minStock: 30 },
  { id: "m8", code: "MDC-008", name: "Oralit sachet", category: "Rehydration", unit: "sachet", minStock: 20 },
  { id: "m9", code: "MDC-009", name: "Povidone Iodine 30ml", category: "Antiseptic", unit: "bottle", minStock: 10 },
  { id: "m10", code: "MDC-010", name: "Antasida Doen", category: "Antacid", unit: "tablet", minStock: 40 },
  { id: "m11", code: "MDC-011", name: "Dexamethasone 0.5mg", category: "Corticosteroid", unit: "tablet", minStock: 20 },
  { id: "m12", code: "MDC-012", name: "Chloramphenicol Eye Drop", category: "Antibiotic", unit: "bottle", minStock: 10 },
  { id: "m13", code: "MDC-013", name: "Ambroxol 30mg", category: "Mucolytic", unit: "tablet", minStock: 30 },
  { id: "m14", code: "MDC-014", name: "Vitamin C 500mg", category: "Vitamin", unit: "tablet", minStock: 50 },
  { id: "m15", code: "MDC-015", name: "Plaster / Hansaplast", category: "Dressing", unit: "pcs", minStock: 25 },
]

function buildBatches(): StockBatch[] {
  const batches: StockBatch[] = []
  MEDICINES.forEach((m, mi) => {
    const qty = [80, 120, 60, 100, 40, 25, 90][mi % 7]
    batches.push({
      id: `b${mi + 1}-1`,
      medicineId: m.id,
      locationId: LOCATIONS[mi % 3].id,
      batchNumber: `BN-${String(202600 + mi).slice(-6)}-A`,
      quantity: qty,
      receivedAt: "2026-08-01",
      expiresAt: mi % 3 === 0 ? "2026-10-15" : "2027-06-30",
    })
    if (mi % 2 === 0) {
      batches.push({
        id: `b${mi + 1}-2`,
        medicineId: m.id,
        locationId: LOCATIONS[(mi + 1) % 3].id,
        batchNumber: `BN-${String(202600 + mi).slice(-6)}-B`,
        quantity: [15, 8, 22, 5, 10, 18][mi % 6],
        receivedAt: "2026-09-01",
        expiresAt: "2027-12-31",
      })
    }
  })
  return batches
}

export const STOCK_BATCHES: StockBatch[] = buildBatches()

function buildMCU(): MCU[] {
  const list: MCU[] = []
  const statuses = [
    "Draft",
    "Submitted",
    "Under Review",
    "Revision Required",
    "Resubmitted",
    "Approved",
    "Approved",
    "Approved",
    "Rejected",
    "Closed",
    "Draft",
    "Submitted",
    "Approved",
    "Closed",
    "Approved",
  ]
  const types = ["Pre-Employment", "Periodic", "Return to Work", "Special", "Periodic"]
  for (let i = 0; i < 15; i++) {
    const emp = EMPLOYEES[i % EMPLOYEES.length]
    const status = statuses[i] as MCU["status"]
    const approved = status === "Approved" || status === "Closed"
    list.push({
      id: `mcu${i + 1}`,
      mcuNumber: `MCU-${pad(i + 1)}`,
      employeeId: emp.id,
      type: types[i % types.length] as MCU["type"],
      examDate: `2026-09-${String((i % 20) + 1).padStart(2, "0")}`,
      facility: "Klinik Kodein",
      result: {
        bloodPressure: `${110 + (i % 5) * 5}/${70 + (i % 3) * 5}`,
        heartRate: `${72 + (i % 10)}`,
        heightCm: `${160 + (i % 25)}`,
        weightKg: `${55 + (i % 30)}`,
        vision: i % 4 === 0 ? "6/9" : "6/6",
        hearing: "Normal",
        notes: "",
      },
      documents: approved
        ? [{ id: `mcu${i + 1}-doc1`, mcuId: `mcu${i + 1}`, name: "Hasil Lab Dummy.pdf", type: "Lab Result", uploadedAt: `2026-09-${String((i % 20) + 2).padStart(2, "0")}` }]
        : [],
      reviewerId: approved ? "u2" : undefined,
      decision: approved ? "Fit to Work" : undefined,
      validFrom: approved ? `2026-09-${String((i % 20) + 1).padStart(2, "0")}` : undefined,
      validUntil: approved ? "2027-09-22" : undefined,
      status,
      history: [
        {
          id: `mcu${i + 1}-h1`,
          status: "Draft",
          by: "u4",
          byName: "Rina Kurnia",
          at: `2026-09-${String((i % 20) + 1).padStart(2, "0")}`,
        },
        ...(status !== "Draft"
          ? [{ id: `mcu${i + 1}-h2`, status: "Submitted" as const, by: "u4", byName: "Rina Kurnia", at: `2026-09-${String((i % 20) + 2).padStart(2, "0")}` }]
          : []),
        ...(approved
          ? [{ id: `mcu${i + 1}-h3`, status: "Approved" as const, by: "u2", byName: "dr. Siti Rahayu", at: `2026-09-${String((i % 20) + 3).padStart(2, "0")}` }]
          : []),
      ],
      createdAt: `2026-09-${String((i % 20) + 1).padStart(2, "0")}`,
      createdBy: "u4",
    })
  }
  return list
}

export const MCUS: MCU[] = buildMCU()

function buildWorkHealthStatus(): WorkHealthStatus[] {
  return MCUS.filter((m) => m.status === "Approved" || m.status === "Closed")
    .slice(0, 8)
    .map((m, i) => {
      return {
        id: `whs${i + 1}`,
        employeeId: m.employeeId,
        mcuId: m.id,
        status: i === 2 ? "Fit with Restriction" : i === 4 ? "Temporarily Unfit" : "Fit to Work",
        decisionDate: m.validFrom ?? "2026-09-22",
        validFrom: m.validFrom ?? "2026-09-22",
        validUntil: m.validUntil ?? "2027-09-22",
        restriction: i === 2 ? "Tidak bekerja di ketinggian > 2m selama 3 bulan" : undefined,
        recommendation: i === 2 ? "Penempatan di area non-ketinggian" : i === 4 ? "Evaluasi ulang dalam 30 hari" : "Layak bekerja",
        reviewDate: i === 2 || i === 4 ? "2026-12-22" : undefined,
        doctorId: "u2",
        doctorName: "dr. Siti Rahayu",
        createdAt: m.validFrom ?? "2026-09-22",
      }
    })
}

export const WORK_HEALTH_STATUS: WorkHealthStatus[] = buildWorkHealthStatus()

function buildVisits(): ClinicVisit[] {
  const list: ClinicVisit[] = []
  for (let i = 0; i < 20; i++) {
    const emp = EMPLOYEES[i % EMPLOYEES.length]
    const statuses: ClinicVisit["status"][] = [
      "Completed",
      "Completed",
      "In Queue",
      "In Consultation",
      "Referred",
      "Completed",
      "Awaiting Pharmacy",
      "Completed",
    ]
    const st = statuses[i % statuses.length]
    const diag = DIAGNOSES[i % DIAGNOSES.length]
    list.push({
      id: `v${i + 1}`,
      visitNumber: `VIS-${pad(i + 1)}`,
      queueNumber: i + 1,
      employeeId: emp.id,
      locationId: LOCATIONS[i % 3].id,
      date: `2026-09-${String((i % 20) + 1).padStart(2, "0")}`,
      time: `${String(8 + (i % 8)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}`,
      chiefComplaint: ["Demam dan batuk", "Sakit kepala", "Nyeri punggung", "Mual dan kembung", "Gatal-gatal", "Mata merah"][i % 6],
      initialExam: "TD normal, kesadaran compos mentis",
      diagnosisIds: st === "In Queue" || st === "Registered" ? [] : [diag.id],
      diagnosisNote: st === "In Queue" || st === "Registered" ? "" : diag.description,
      treatment: st === "In Queue" || st === "Registered" ? "" : "Observasi dan pemberian obat simtomatik",
      doctorNote: st === "In Queue" || st === "Registered" ? "" : "Kontrol bila keluhan menetap",
      referralFacility: st === "Referred" ? "RS Umum Daerah" : undefined,
      referralReason: st === "Referred" ? "Perlu pemeriksaan penunjang lanjutan" : undefined,
      status: st,
      createdAt: `2026-09-${String((i % 20) + 1).padStart(2, "0")}`,
    })
  }
  return list
}

export const VISITS: ClinicVisit[] = buildVisits()

export const DISPENSINGS: Dispensing[] = [
  { id: "disp1", visitId: "v1", medicineId: "m1", batchId: "b1-1", quantity: 10, dispensedAt: "2026-09-02", by: "Andi Wijaya" },
  { id: "disp2", visitId: "v2", medicineId: "m4", batchId: "b4-1", quantity: 5, dispensedAt: "2026-09-03", by: "Andi Wijaya" },
  { id: "disp3", visitId: "v6", medicineId: "m5", batchId: "b5-1", quantity: 10, dispensedAt: "2026-09-07", by: "Andi Wijaya" },
]

export const STOCK_TRANSACTIONS: StockTransaction[] = [
  { id: "st1", type: "receive", medicineId: "m1", batchId: "b1-1", locationId: "l1", quantity: 80, by: "Bagus Pratama", at: "2026-08-01" },
  { id: "st2", type: "dispense", medicineId: "m1", batchId: "b1-1", locationId: "l1", quantity: 10, relatedVisitId: "v1", by: "Andi Wijaya", at: "2026-09-02" },
]

function buildCertificates(): HealthCertificate[] {
  return WORK_HEALTH_STATUS.slice(0, 5).map((w, i) => {
    const emp = EMPLOYEES.find((e) => e.id === w.employeeId)!
    return {
      id: `cert${i + 1}`,
      certNumber: `HC-2026-${pad(i + 1)}`,
      employeeId: emp.id,
      mcuId: w.mcuId,
      healthStatus: w.status,
      restrictions: w.restriction,
      doctorId: "u2",
      doctorName: "dr. Siti Rahayu",
      issuedAt: w.decisionDate,
      validUntil: w.validUntil,
      qrToken: `kodein-cert-${w.mcuId}-${i + 1}`,
      status: i === 4 ? "revoked" : "valid",
    }
  })
}

export const CERTIFICATES: HealthCertificate[] = buildCertificates()

export const NOTIFICATIONS: AppNotification[] = [
  { id: "n1", userId: "u2", title: "MCU baru menunggu review", message: "MCU-0002 dari Budi Santoso telah disubmit.", read: false, createdAt: "2026-09-21T09:00:00" },
  { id: "n2", userId: "u4", title: "Health certificate diterbitkan", message: "Sertifikat HC-2026-0001 untuk Budi Santoso telah diterbitkan.", read: false, createdAt: "2026-09-21T14:00:00" },
  { id: "n3", userId: "u3", title: "Stok obat rendah", message: "Stok Povidone Iodine 30ml di Site Onshore Balikpapan di bawah minimum.", read: true, createdAt: "2026-09-20T08:00:00" },
  { id: "n4", userId: "u4", title: "MCU perlu revisi", message: "MCU-0003 dikembalikan untuk revisi oleh dokter.", read: false, createdAt: "2026-09-21T10:30:00" },
]

export const AUDIT_LOGS: AuditLog[] = [
  { id: "a1", userId: "u2", userName: "dr. Siti Rahayu", action: "APPROVE_MCU", objectType: "MCU", objectId: "mcu6", before: "Submitted", after: "Approved", at: "2026-09-21T13:00:00" },
  { id: "a2", userId: "u2", userName: "dr. Siti Rahayu", action: "ISSUE_CERTIFICATE", objectType: "HealthCertificate", objectId: "cert1", after: "valid", at: "2026-09-21T14:00:00" },
  { id: "a3", userId: "u3", userName: "Andi Wijaya", action: "DISPENSE_MEDICINE", objectType: "Medicine", objectId: "m1", after: "-10 tablet", at: "2026-09-02T10:00:00" },
  { id: "a4", userId: "u4", userName: "Rina Kurnia", action: "CREATE_EMPLOYEE", objectType: "Employee", objectId: "e1", after: "EMP-0001", at: "2026-09-01T09:00:00" },
]
