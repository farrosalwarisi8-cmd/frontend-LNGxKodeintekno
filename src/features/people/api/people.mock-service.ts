import type {
  Consent,
  ConsentEvent,
  ConsentStatus,
  CreatePersonDraft,
  CreatedPersonResult,
  DuplicateCheckInput,
  DuplicateCheckResult,
  ListPeopleParams,
  MockConfig,
  MockDeliveryResult,
  MockDocumentUploadResult,
  Paginated,
  Person,
  PersonDocument,
  PersonListItem,
  PublicConsentView,
} from "./people.types";
import {
  CONSENT_TEXT,
  DELIVERY_FAILED_CONSENT,
  DUPLICATE_PERSON,
  EXPIRED_TOKEN_CONSENT,
  generatePeople,
} from "../fixtures/people.fixtures";

let mockPeople: Person[] = generatePeople();
let mockConfig: MockConfig = {
  simulateFailure: false,
  simulateOffline: false,
  duplicateScenario: false,
  emailFailure: false,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(): number {
  return 300 + Math.random() * 500;
}

function checkOffline(): void {
  if (mockConfig.simulateOffline) {
    throw new Error("Anda sedang offline. Data belum dikirim.");
  }
}

function checkFailure(): void {
  if (mockConfig.simulateFailure) {
    throw new Error("Kami tidak dapat memuat data saat ini. Coba lagi.");
  }
}

function toListItem(person: Person): PersonListItem {
  return {
    id: person.id,
    fullName: person.fullName,
    mrn: person.mrn,
    employeeNo: person.employeeNo,
    organizationName: person.organizationName,
    unitName: person.orgUnitName,
    siteName: person.siteName,
    emailMasked: person.email,
    employmentStatus: person.employmentStatus,
    consentStatus: person.consent?.status ?? "PENDING",
    updatedAt: person.updatedAt,
  };
}

export const peopleMockService = {
  async listPeople(params: ListPeopleParams): Promise<Paginated<PersonListItem>> {
    await delay(randomDelay());
    checkOffline();
    checkFailure();

    let filtered = [...mockPeople];

    if (params.search) {
      const q = params.search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.mrn.toLowerCase().includes(q) ||
          p.employeeNo.toLowerCase().includes(q)
      );
    }

    if (params.organizationId) {
      filtered = filtered.filter((p) => p.organizationId === params.organizationId);
    }
    if (params.orgUnitId) {
      filtered = filtered.filter((p) => p.orgUnitId === params.orgUnitId);
    }
    if (params.siteId) {
      filtered = filtered.filter((p) => p.siteId === params.siteId);
    }
    if (params.employmentStatus) {
      filtered = filtered.filter((p) => p.employmentStatus === params.employmentStatus);
    }
    if (params.consentStatus) {
      filtered = filtered.filter((p) => p.consent?.status === params.consentStatus);
    }

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 10;
    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize).map(toListItem);

    return { data, total, page, pageSize, totalPages };
  },

  async getPerson(patientId: string): Promise<Person> {
    await delay(randomDelay());
    checkOffline();
    checkFailure();

    const person = mockPeople.find((p) => p.id === patientId);
    if (!person) throw new Error("Pekerja tidak ditemukan.");
    return person;
  },

  async duplicateCheck(input: DuplicateCheckInput): Promise<DuplicateCheckResult> {
    await delay(400);
    checkOffline();

    if (mockConfig.duplicateScenario) {
      return {
        isDuplicate: true,
        severity: "BLOCK",
        message: "Identifier ini sudah terdaftar sebagai pekerja aktif. Periksa kembali data atau buka profil yang sudah ada.",
        existingPerson: {
          id: DUPLICATE_PERSON.id,
          fullName: DUPLICATE_PERSON.fullName,
          mrn: DUPLICATE_PERSON.mrn,
          employeeNo: DUPLICATE_PERSON.employeeNo,
          employmentStatus: DUPLICATE_PERSON.employmentStatus,
        },
      };
    }

    const existing = mockPeople.find(
      (p) => p.identifierValue === input.identifierValue && p.identifierType === input.identifierType
    );

    if (existing) {
      if (existing.employmentStatus === "ACTIVE") {
        return {
          isDuplicate: true,
          severity: "BLOCK",
          message: "Identifier ini sudah terdaftar sebagai pekerja aktif. Periksa kembali data atau buka profil yang sudah ada.",
          existingPerson: {
            id: existing.id,
            fullName: existing.fullName,
            mrn: existing.mrn,
            employeeNo: existing.employeeNo,
            employmentStatus: existing.employmentStatus,
          },
        };
      }
      return {
        isDuplicate: true,
        severity: "WARNING",
        message: "Identifier terdeteksi sudah digunakan. Record yang sama ditemukan dalam scope Anda.",
        existingPerson: {
          id: existing.id,
          fullName: existing.fullName,
          mrn: existing.mrn,
          employeeNo: existing.employeeNo,
          employmentStatus: existing.employmentStatus,
        },
      };
    }

    return { isDuplicate: false, severity: "NONE", message: "Identifier tersedia." };
  },

  async createPerson(input: CreatePersonDraft): Promise<CreatedPersonResult> {
    await delay(800);
    checkOffline();
    checkFailure();

    const maxMrn = mockPeople.reduce((acc, p) => {
      const n = parseInt(p.mrn.replace(/\D/g, ""), 10);
      return Number.isNaN(n) ? acc : Math.max(acc, n);
    }, 0);
    const maxEmp = mockPeople.reduce((acc, p) => {
      const n = parseInt(p.employeeNo.replace(/\D/g, ""), 10);
      return Number.isNaN(n) ? acc : Math.max(acc, n);
    }, 0);

    const id = `person-${Date.now().toString(36)}`;
    const employeeNo = `EMP-${String(maxEmp + 1).padStart(4, "0")}`;
    const mrn = `MRN-${String(maxMrn + 1).padStart(6, "0")}`;

    const consentId = `consent-${Date.now().toString(36)}`;
    const token = `consent-token-${id}`;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();

    const consent: Consent = {
      id: consentId,
      personId: id,
      type: input.consentType,
      version: input.consentVersion,
      status: "PENDING",
      token,
      createdAt: now,
      sentAt: now,
      expiresAt,
      events: [
        {
          id: `ce-${Date.now().toString(36)}`,
          type: "CREATED",
          label: "Consent dibuat",
          occurredAt: now,
          actorLabel: "Admin Klinik",
          metadata: { version: input.consentVersion },
        },
        {
          id: `ce-${Date.now().toString(36)}-2`,
          type: "SENT",
          label: "Link consent dikirim",
          occurredAt: now,
          actorLabel: "Sistem",
          metadata: { channel: "email" },
        },
      ],
    };

    const person: Person = {
      id,
      fullName: input.fullName,
      mrn,
      employeeNo,
      identifierType: input.identifierType,
      identifierValue: input.identifierValue,
      birthDate: input.birthDate,
      sex: input.sex,
      organizationId: input.organizationId,
      organizationName: "",
      orgUnitId: input.orgUnitId,
      orgUnitName: "",
      siteId: input.siteId,
      siteName: "",
      jobTaskId: input.jobTaskId,
      employmentStatus: input.employmentStatus,
      joinDate: input.joinDate,
      email: input.email,
      phone: input.phone,
      emergencyContact: input.emergencyContact,
      documents: [],
      consent,
      createdAt: now,
      updatedAt: now,
    };

    mockPeople = [person, ...mockPeople];

    const deliveryFailed = mockConfig.emailFailure;

    return {
      patientId: id,
      employeeId: employeeNo,
      mrn,
      consentId,
      consentStatus: "PENDING",
      consentLink: `/public/consent/${token}`,
      deliveryStatus: deliveryFailed ? "SIMULATED_FAILED" : "SIMULATED_SENT",
    };
  },

  async uploadDocument(file: File): Promise<MockDocumentUploadResult> {
    await delay(600);
    checkOffline();
    checkFailure();

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error("Ukuran file melebihi batas maksimum 5 MB.");
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Format file tidak didukung. Gunakan PDF, JPG, atau PNG.");
    }

    const tamperCheck: PersonDocument["tamperCheck"] =
      Math.random() > 0.9 ? "WARNING" : "PASSED";

    return {
      documentId: `doc-${Date.now().toString(36)}`,
      name: file.name,
      type: file.type,
      size: file.size,
      mimeType: file.type,
      tamperCheck,
    };
  },

  async resendConsent(consentId: string): Promise<MockDeliveryResult> {
    await delay(600);
    checkOffline();
    checkFailure();

    const person = mockPeople.find((p) => p.consent?.id === consentId);
    if (!person?.consent) throw new Error("Consent tidak ditemukan.");

    const failed = mockConfig.emailFailure;
    const now = new Date().toISOString();

    if (failed) {
      person.consent.status = "DELIVERY_FAILED";
      person.consent.events.push({
        id: `ce-${Date.now().toString(36)}`,
        type: "DELIVERY_FAILED",
        label: "Pengiriman ulang gagal",
        occurredAt: now,
        actorLabel: "Sistem",
        metadata: { reason: "Email tidak valid" },
      });
      return { success: false, status: "SIMULATED_FAILED", message: "Pengiriman email gagal. Periksa alamat email." };
    }

    person.consent.status = "PENDING";
    person.consent.sentAt = now;
    person.consent.events.push({
      id: `ce-${Date.now().toString(36)}`,
      type: "RESENT",
      label: "Link consent dikirim ulang",
      occurredAt: now,
      actorLabel: "Admin Klinik",
      metadata: { channel: "email" },
    });

    return { success: true, status: "SIMULATED_SENT", message: "Email consent berhasil dikirim (simulasi)." };
  },

  async getConsentByToken(token: string): Promise<PublicConsentView> {
    await delay(400);
    checkOffline();

    if (token === EXPIRED_TOKEN_CONSENT.token) {
      return {
        token,
        state: "EXPIRED",
        personName: "Pekerja",
        personInitials: "PK",
        consentType: "EMR_DATA_PROCESSING",
        consentVersion: "1.0",
        consentText: CONSENT_TEXT,
        expiresAt: EXPIRED_TOKEN_CONSENT.expiresAt,
        createdAt: EXPIRED_TOKEN_CONSENT.createdAt,
      };
    }

    if (token === DELIVERY_FAILED_CONSENT.token) {
      return {
        token,
        state: "DELIVERY_FAILED",
        personName: "Pekerja",
        personInitials: "PK",
        consentType: "EMR_DATA_PROCESSING",
        consentVersion: "1.0",
        consentText: CONSENT_TEXT,
        expiresAt: DELIVERY_FAILED_CONSENT.expiresAt,
        createdAt: DELIVERY_FAILED_CONSENT.createdAt,
      };
    }

    const person = mockPeople.find((p) => p.consent?.token === token);
    if (!person?.consent) {
      return {
        token,
        state: "INVALID",
        personName: "",
        personInitials: "",
        consentType: "",
        consentVersion: "",
        consentText: "",
        expiresAt: "",
        createdAt: "",
      };
    }

    if (person.consent.status === "APPROVED" || person.consent.status === "REJECTED") {
      return {
        token,
        state: "USED",
        personName: person.fullName,
        personInitials: person.fullName.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase(),
        consentType: person.consent.type,
        consentVersion: person.consent.version,
        consentText: CONSENT_TEXT,
        expiresAt: person.consent.expiresAt,
        createdAt: person.consent.createdAt,
      };
    }

    if (new Date(person.consent.expiresAt).getTime() < Date.now()) {
      return {
        token,
        state: "EXPIRED",
        personName: person.fullName,
        personInitials: person.fullName.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase(),
        consentType: person.consent.type,
        consentVersion: person.consent.version,
        consentText: CONSENT_TEXT,
        expiresAt: person.consent.expiresAt,
        createdAt: person.consent.createdAt,
      };
    }

    return {
      token,
      state: "VALID",
      personName: person.fullName,
      personInitials: person.fullName.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase(),
      consentType: person.consent.type,
      consentVersion: person.consent.version,
      consentText: CONSENT_TEXT,
      expiresAt: person.consent.expiresAt,
      createdAt: person.consent.createdAt,
    };
  },

  async decideConsent(
    token: string,
    decision: "APPROVED" | "REJECTED"
  ): Promise<{ success: boolean; status: ConsentStatus }> {
    await delay(600);
    checkOffline();
    checkFailure();

    const person = mockPeople.find((p) => p.consent?.token === token);
    if (!person?.consent) throw new Error("Consent tidak ditemukan.");

    const now = new Date().toISOString();
    person.consent.status = decision;
    person.consent.decidedAt = now;
    person.consent.events.push({
      id: `ce-${Date.now().toString(36)}`,
      type: decision,
      label: decision === "APPROVED" ? "Consent disetujui" : "Consent ditolak",
      occurredAt: now,
      actorLabel: "Pekerja",
      metadata: {},
    });

    return { success: true, status: decision };
  },

  async getConsentEvents(consentId: string): Promise<ConsentEvent[]> {
    await delay(300);
    checkOffline();

    const person = mockPeople.find((p) => p.consent?.id === consentId);
    if (!person?.consent) throw new Error("Consent tidak ditemukan.");
    return person.consent.events;
  },

  async resetDemoData(): Promise<void> {
    await delay(300);
    mockPeople = generatePeople();
    mockConfig = {
      simulateFailure: false,
      simulateOffline: false,
      duplicateScenario: false,
      emailFailure: false,
    };
  },

  setConfig(config: Partial<MockConfig>): void {
    mockConfig = { ...mockConfig, ...config };
  },

  getConfig(): MockConfig {
    return { ...mockConfig };
  },
};
