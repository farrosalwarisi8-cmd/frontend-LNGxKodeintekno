import type {
  Consent,
  ConsentEvent,
  ConsentStatus,
  EmploymentStatus,
  IdentifierType,
  JobTask,
  Organization,
  OrgUnit,
  Person,
  PersonDocument,
  Sex,
  Site,
} from "../api/people.types";

export const ORGANIZATIONS: Organization[] = [
  { id: "org-1", name: "PT Layar Nusantara Gas" },
  { id: "org-2", name: "PT Nusantara Energi" },
  { id: "org-3", name: "PT Samudra Resources" },
];

export const ORG_UNITS: OrgUnit[] = [
  { id: "ou-1", organizationId: "org-1", name: "HR & GA" },
  { id: "ou-2", organizationId: "org-1", name: "Engineering" },
  { id: "ou-3", organizationId: "org-2", name: "Operations" },
  { id: "ou-4", organizationId: "org-2", name: "HSE" },
  { id: "ou-5", organizationId: "org-3", name: "Finance" },
  { id: "ou-6", organizationId: "org-3", name: "Logistics" },
];

export const SITES: Site[] = [
  { id: "site-1", orgUnitId: "ou-1", name: "Kantor Pusat Jakarta", type: "OFFICE" },
  { id: "site-2", orgUnitId: "ou-2", name: "Site LNG Balikpapan", type: "ONSHORE" },
  { id: "site-3", orgUnitId: "ou-3", name: "Site Onshore Balikpapan", type: "ONSHORE" },
  { id: "site-4", orgUnitId: "ou-4", name: "Rig Offshore Natuna", type: "OFFSHORE" },
  { id: "site-5", orgUnitId: "ou-5", name: "Kantor Cabang Surabaya", type: "OFFICE" },
  { id: "site-6", orgUnitId: "ou-6", name: "Depot Samarinda", type: "ONSHORE" },
];

export const JOB_TASKS: JobTask[] = [
  { id: "jt-1", name: "Field Operator" },
  { id: "jt-2", name: "Technician" },
  { id: "jt-3", name: "Engineer" },
  { id: "jt-4", name: "HSE Officer" },
  { id: "jt-5", name: "Administration Staff" },
  { id: "jt-6", name: "Supervisor" },
  { id: "jt-7", name: "Driver" },
  { id: "jt-8", name: "Electrician" },
  { id: "jt-9", name: "Mechanic" },
  { id: "jt-10", name: "Welder" },
];

const FIRST_NAMES = [
  "Budi", "Siti", "Agus", "Dewi", "Rizky", "Putri", "Joko", "Ratna",
  "Hendra", "Maya", "Fajar", "Indah", "Tono", "Lina", "Yusuf", "Nur",
  "Eko", "Sari", "Ahmad", "Fitri", "Deni", "Citra", "Irfan", "Rina",
  "Wahyu", "Dian", "Rudi", "Melati", "Slamet", "Ani",
];

const LAST_NAMES = [
  "Santoso", "Nurhaliza", "Salim", "Anggraini", "Ramadhan", "Maharani",
  "Widodo", "Sari", "Gunawan", "Anggraini", "Nugroho", "Permata",
  "Hartono", "Marlina", "Maulana", "Aini", "Prasetyo", "Wulandari",
  "Fauzi", "Handayani", "Saputra", "Kirana", "Hakim", "Marlina",
  "Hidayat", "Purnama", "Hartono", "Putih", "Riyadi", "Susanti",
];

const RELATIONSHIPS = ["Suami", "Istri", "Ayah", "Ibu", "Saudara", "Teman"];

function randomDate(start: Date, end: Date): string {
  const d = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return d.toISOString().slice(0, 10);
}

function generateNIK(index: number): string {
  return `32${String(50000000000000 + index * 137911).padStart(14, "0")}`;
}

function generateConsentEvents(
  status: ConsentStatus,
  createdAt: string,
  sentAt?: string,
  decidedAt?: string
): ConsentEvent[] {
  const events: ConsentEvent[] = [
    {
      id: `ce-${Math.random().toString(36).slice(2, 8)}`,
      type: "CREATED",
      label: "Consent dibuat",
      occurredAt: createdAt,
      actorLabel: "Admin Klinik",
      metadata: { version: "1.0" },
    },
  ];

  if (sentAt) {
    events.push({
      id: `ce-${Math.random().toString(36).slice(2, 8)}`,
      type: "SENT",
      label: "Link consent dikirim",
      occurredAt: sentAt,
      actorLabel: "Sistem",
      metadata: { channel: "email" },
    });
  }

  if (status === "APPROVED" && decidedAt) {
    events.push({
      id: `ce-${Math.random().toString(36).slice(2, 8)}`,
      type: "APPROVED",
      label: "Consent disetujui",
      occurredAt: decidedAt,
      actorLabel: "Pekerja",
      metadata: {},
    });
  }

  if (status === "REJECTED" && decidedAt) {
    events.push({
      id: `ce-${Math.random().toString(36).slice(2, 8)}`,
      type: "REJECTED",
      label: "Consent ditolak",
      occurredAt: decidedAt,
      actorLabel: "Pekerja",
      metadata: {},
    });
  }

  if (status === "EXPIRED") {
    events.push({
      id: `ce-${Math.random().toString(36).slice(2, 8)}`,
      type: "EXPIRED",
      label: "Consent kedaluwarsa",
      occurredAt: new Date(new Date(createdAt).getTime() + 72 * 3600 * 1000).toISOString(),
      actorLabel: "Sistem",
      metadata: {},
    });
  }

  if (status === "DELIVERY_FAILED") {
    events.push({
      id: `ce-${Math.random().toString(36).slice(2, 8)}`,
      type: "DELIVERY_FAILED",
      label: "Pengiriman gagal",
      occurredAt: sentAt ?? createdAt,
      actorLabel: "Sistem",
      metadata: { reason: "Email tidak valid" },
    });
  }

  return events;
}

function generateConsent(
  personId: string,
  status: ConsentStatus,
  index: number
): Consent {
  const createdAt = randomDate(new Date("2026-09-01"), new Date("2026-10-01"));
  const sentAt = new Date(new Date(createdAt).getTime() + 3600 * 1000).toISOString();
  const decidedAt =
    status === "APPROVED" || status === "REJECTED"
      ? new Date(new Date(sentAt).getTime() + 24 * 3600 * 1000).toISOString()
      : undefined;
  const expiresAt = new Date(new Date(createdAt).getTime() + 72 * 3600 * 1000).toISOString();

  return {
    id: `consent-${index}`,
    personId,
    type: "EMR_DATA_PROCESSING",
    version: "1.0",
    status,
    token: `consent-token-${personId}-${index}`,
    createdAt,
    sentAt,
    decidedAt,
    expiresAt,
    events: generateConsentEvents(status, createdAt, sentAt, decidedAt),
  };
}

function generateDocuments(personId: string): PersonDocument[] {
  const count = Math.floor(Math.random() * 3);
  const docs: PersonDocument[] = [];
  const types = ["KTP", "Passport", "Sertifikat", "Ijazah", "SIM"];
  for (let i = 0; i < count; i++) {
    docs.push({
      id: `doc-${personId}-${i}`,
      name: `${types[i % types.length]}_${personId}.pdf`,
      type: types[i % types.length],
      size: Math.floor(Math.random() * 4 * 1024 * 1024) + 100000,
      mimeType: "application/pdf",
      uploadedAt: randomDate(new Date("2026-08-01"), new Date("2026-10-01")),
      tamperCheck: Math.random() > 0.8 ? "WARNING" : "PASSED",
    });
  }
  return docs;
}

export function generatePeople(): Person[] {
  const people: Person[] = [];
  const consentStatuses: ConsentStatus[] = [
    "PENDING", "APPROVED", "APPROVED", "APPROVED", "REJECTED",
    "PENDING", "EXPIRED", "APPROVED", "DELIVERY_FAILED", "PENDING",
  ];

  for (let i = 0; i < 30; i++) {
    const idx = i + 1;
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const fullName = `${firstName} ${lastName}`;
    const orgIndex = i % ORGANIZATIONS.length;
    const org = ORGANIZATIONS[orgIndex];
    const orgUnits = ORG_UNITS.filter((ou) => ou.organizationId === org.id);
    const orgUnit = orgUnits[i % orgUnits.length];
    const sites = SITES.filter((s) => s.orgUnitId === orgUnit.id);
    const site = sites[i % sites.length];
    const jobTask = JOB_TASKS[i % JOB_TASKS.length];
    const sex: Sex = i % 2 === 0 ? "MALE" : "FEMALE";
    const birthYear = 1980 + (i % 20);
    const birthMonth = String((i % 12) + 1).padStart(2, "0");
    const birthDay = String((i % 27) + 1).padStart(2, "0");
    const employmentStatus: EmploymentStatus =
      i % 7 === 0 ? "INACTIVE" : i % 11 === 0 ? "ARCHIVED" : "ACTIVE";
    const consentStatus = consentStatuses[i % consentStatuses.length];
    const createdAt = randomDate(new Date("2026-08-01"), new Date("2026-09-15"));

    const person: Person = {
      id: `person-${idx}`,
      fullName,
      mrn: `MRN-${String(idx).padStart(6, "0")}`,
      employeeNo: `EMP-${String(idx).padStart(4, "0")}`,
      identifierType: "NIK" as IdentifierType,
      identifierValue: generateNIK(idx),
      birthDate: `${birthYear}-${birthMonth}-${birthDay}`,
      sex,
      organizationId: org.id,
      organizationName: org.name,
      orgUnitId: orgUnit.id,
      orgUnitName: orgUnit.name,
      siteId: site.id,
      siteName: site.name,
      jobTaskId: jobTask.id,
      jobTaskName: jobTask.name,
      employmentStatus,
      joinDate: `${2014 + (i % 9)}-${String((i % 12) + 1).padStart(2, "0")}-15`,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@kodein.co.id`,
      phone: `0812${String(30000000 + idx * 123457).slice(-8)}`,
      emergencyContact: {
        name: `${LAST_NAMES[(i + 5) % LAST_NAMES.length]} ${FIRST_NAMES[(i + 3) % FIRST_NAMES.length]}`,
        relationship: RELATIONSHIPS[i % RELATIONSHIPS.length],
        phone: `0813${String(40000000 + idx * 765432).slice(-8)}`,
      },
      documents: generateDocuments(`person-${idx}`),
      consent: generateConsent(`person-${idx}`, consentStatus, idx),
      createdAt,
      updatedAt: randomDate(new Date(createdAt), new Date("2026-10-01")),
    };

    people.push(person);
  }

  return people;
}

export const DUPLICATE_PERSON: Person = {
  id: "person-duplicate",
  fullName: "Budi Santoso",
  mrn: "MRN-000001",
  employeeNo: "EMP-0001",
  identifierType: "NIK",
  identifierValue: "3201234567890123",
  birthDate: "1985-05-15",
  sex: "MALE",
  organizationId: "org-1",
  organizationName: "PT Layar Nusantara Gas",
  orgUnitId: "ou-1",
  orgUnitName: "HR & GA",
  siteId: "site-1",
  siteName: "Kantor Pusat Jakarta",
  jobTaskId: "jt-5",
  jobTaskName: "Administration Staff",
  employmentStatus: "ACTIVE",
  joinDate: "2020-01-15",
  email: "budi.santoso@kodein.co.id",
  phone: "081234567890",
  emergencyContact: {
    name: "Siti Santoso",
    relationship: "Istri",
    phone: "081298765432",
  },
  documents: [],
  consent: {
    id: "consent-duplicate",
    personId: "person-duplicate",
    type: "EMR_DATA_PROCESSING",
    version: "1.0",
    status: "APPROVED",
    token: "consent-token-duplicate",
    createdAt: "2026-09-15T10:00:00Z",
    sentAt: "2026-09-15T10:01:00Z",
    decidedAt: "2026-09-16T14:30:00Z",
    expiresAt: "2026-09-18T10:00:00Z",
    events: generateConsentEvents(
      "APPROVED",
      "2026-09-15T10:00:00Z",
      "2026-09-15T10:01:00Z",
      "2026-09-16T14:30:00Z"
    ),
  },
  createdAt: "2026-09-15T10:00:00Z",
  updatedAt: "2026-09-16T14:30:00Z",
};

export const EXPIRED_TOKEN_CONSENT: Consent = {
  id: "consent-expired",
  personId: "person-expired",
  type: "EMR_DATA_PROCESSING",
  version: "1.0",
  status: "EXPIRED",
  token: "consent-token-expired",
  createdAt: "2026-09-01T10:00:00Z",
  sentAt: "2026-09-01T10:01:00Z",
  expiresAt: "2026-09-04T10:00:00Z",
  events: generateConsentEvents("EXPIRED", "2026-09-01T10:00:00Z", "2026-09-01T10:01:00Z"),
};

export const DELIVERY_FAILED_CONSENT: Consent = {
  id: "consent-delivery-failed",
  personId: "person-delivery-failed",
  type: "EMR_DATA_PROCESSING",
  version: "1.0",
  status: "DELIVERY_FAILED",
  token: "consent-token-delivery-failed",
  createdAt: "2026-09-20T10:00:00Z",
  sentAt: "2026-09-20T10:01:00Z",
  expiresAt: "2026-09-23T10:00:00Z",
  events: generateConsentEvents("DELIVERY_FAILED", "2026-09-20T10:00:00Z", "2026-09-20T10:01:00Z"),
};

export const CONSENT_TEXT = `PERSETUJUAN PEMROSESAN DATA EMR

Dengan ini, saya menyatakan bahwa saya telah membaca dan memahami informasi berikut:

1. DATA YANG DIPROSES
   Data pribadi dan data kesehatan saya akan diproses dalam sistem Electronic Medical Record (EMR) PT Layar Nusantara Gas untuk keperluan pelayanan kesehatan kerja, meliputi:
   - Data identitas pribadi
   - Data riwayat kesehatan
   - Data hasil pemeriksaan medis
   - Data sertifikat kesehatan

2. TUJUAN PEMROSESAN
   Pemrosesan data ini bertujuan untuk:
   - Menyelenggarakan program kesehatan kerja
   - Melakukan Medical Check Up (MCU) berkala
   - Menerbitkan sertifikat kesehatan kerja
   - Memenuhi ketentuan peraturan perundang-undangan

3. HAK ANDA
   Anda berhak untuk:
   - Meminta akses terhadap data pribadi Anda
   - Meminta koreksi data yang tidak akurat
   - Meminta penghapusan data sesuai ketentuan yang berlaku
   - Menarik kembali persetujuan ini dengan pemberitahuan tertulis

4. KEAMANAN DATA
   Data Anda akan disimpan dengan standar keamanan yang sesuai dan hanya dapat diakses oleh pihak yang berwenang.

5. MASA BERLAKU
   Persetujuan ini berlaku sejak tanggal persetujuan diberikan dan dapat dicabut kapan saja.

Dengan menyetujui, saya menyatakan bahwa seluruh informasi yang saya berikan adalah benar dan saya memahami konsekuensi dari persetujuan ini.`;
