import { describe, it, expect, beforeEach } from "vitest";
import { peopleMockService } from "../people.mock-service";
import type { CreatePersonDraft } from "../people.types";

function makeDraft(overrides?: Partial<CreatePersonDraft>): CreatePersonDraft {
  return {
    fullName: "Test Person",
    identifierType: "NIK",
    identifierValue: "9998887776665554",
    birthDate: "1990-01-01",
    sex: "MALE",
    employeeNo: "EMP-TEST",
    organizationId: "org-1",
    orgUnitId: "ou-1",
    siteId: "site-1",
    jobTaskId: "jt-1",
    employmentStatus: "ACTIVE",
    joinDate: "2026-01-01",
    email: "test@kodein.co.id",
    phone: "081234567890",
    emergencyContact: { name: "Emergency", relationship: "Teman", phone: "081298765432" },
    documentIds: [],
    consentType: "EMR_DATA_PROCESSING",
    consentVersion: "1.0",
    ...overrides,
  };
}

describe("peopleMockService", () => {
  beforeEach(async () => {
    await peopleMockService.resetDemoData();
  });

  describe("listPeople", () => {
    it("returns paginated list", async () => {
      const result = await peopleMockService.listPeople({ page: 1, pageSize: 10 });
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(10);
    });

    it("filters by search term", async () => {
      const result = await peopleMockService.listPeople({ search: "Budi", page: 1, pageSize: 50 });
      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach((p) => {
        const q = "budi";
        const match =
          p.fullName.toLowerCase().includes(q) ||
          p.mrn.toLowerCase().includes(q) ||
          p.employeeNo.toLowerCase().includes(q);
        expect(match).toBe(true);
      });
    });

    it("filters by organization", async () => {
      const result = await peopleMockService.listPeople({ organizationId: "org-1", page: 1, pageSize: 50 });
      result.data.forEach((p) => {
        expect(p.organizationName).toBe("PT Layar Nusantara Gas");
      });
    });

    it("filters by consent status", async () => {
      const result = await peopleMockService.listPeople({ consentStatus: "APPROVED", page: 1, pageSize: 50 });
      result.data.forEach((p) => {
        expect(p.consentStatus).toBe("APPROVED");
      });
    });

    it("returns empty array for non-matching search", async () => {
      const result = await peopleMockService.listPeople({ search: "zzzznonexistent", page: 1, pageSize: 10 });
      expect(result.data.length).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe("getPerson", () => {
    it("returns person by id", async () => {
      const list = await peopleMockService.listPeople({ page: 1, pageSize: 1 });
      const person = await peopleMockService.getPerson(list.data[0].id);
      expect(person).toBeDefined();
      expect(person.id).toBe(list.data[0].id);
    });

    it("throws for non-existent person", async () => {
      await expect(peopleMockService.getPerson("non-existent")).rejects.toThrow("Pekerja tidak ditemukan.");
    });
  });

  describe("duplicateCheck", () => {
    it("returns NONE for unique identifier", async () => {
      const result = await peopleMockService.duplicateCheck({
        identifierType: "NIK",
        identifierValue: "9998887776665554",
        fullName: "Unique Person",
      });
      expect(result.isDuplicate).toBe(false);
      expect(result.severity).toBe("NONE");
    });

    it("returns BLOCK for duplicate active identifier", async () => {
      const list = await peopleMockService.listPeople({ page: 1, pageSize: 50 });
      const activePerson = list.data.find((p) => p.employmentStatus === "ACTIVE");
      if (!activePerson) throw new Error("No active person found");
      const person = await peopleMockService.getPerson(activePerson.id);

      const result = await peopleMockService.duplicateCheck({
        identifierType: person.identifierType,
        identifierValue: person.identifierValue,
        fullName: person.fullName,
      });

      expect(result.isDuplicate).toBe(true);
      expect(result.severity).toBe("BLOCK");
      expect(result.existingPerson).toBeDefined();
    });

    it("returns BLOCK when duplicateScenario is enabled", async () => {
      peopleMockService.setConfig({ duplicateScenario: true });
      const result = await peopleMockService.duplicateCheck({
        identifierType: "NIK",
        identifierValue: "anything",
        fullName: "Any",
      });
      expect(result.severity).toBe("BLOCK");
    });
  });

  describe("createPerson", () => {
    it("creates person with MRN and consent", async () => {
      const result = await peopleMockService.createPerson(makeDraft());
      expect(result.patientId).toBeDefined();
      expect(result.mrn).toMatch(/^MRN-\d+$/);
      expect(result.employeeId).toMatch(/^EMP-\d+$/);
      expect(result.consentId).toBeDefined();
      expect(result.consentStatus).toBe("PENDING");
      expect(result.consentLink).toContain("/public/consent/");
      expect(result.deliveryStatus).toBe("SIMULATED_SENT");
    });

    it("increments MRN for each new person", async () => {
      const r1 = await peopleMockService.createPerson(makeDraft({ identifierValue: "1111111111111111" }));
      const r2 = await peopleMockService.createPerson(makeDraft({ identifierValue: "2222222222222222" }));
      expect(r1.mrn).not.toBe(r2.mrn);
    });

    it("returns SIMULATED_FAILED when emailFailure is enabled", async () => {
      peopleMockService.setConfig({ emailFailure: true });
      const result = await peopleMockService.createPerson(makeDraft());
      expect(result.deliveryStatus).toBe("SIMULATED_FAILED");
    });

    it("throws when simulateOffline is enabled", async () => {
      peopleMockService.setConfig({ simulateOffline: true });
      await expect(peopleMockService.createPerson(makeDraft())).rejects.toThrow();
      peopleMockService.setConfig({ simulateOffline: false });
    });
  });

  describe("uploadDocument", () => {
    it("accepts valid PDF file", async () => {
      const file = new File(["test content"], "test.pdf", { type: "application/pdf" });
      const result = await peopleMockService.uploadDocument(file);
      expect(result.documentId).toBeDefined();
      expect(result.name).toBe("test.pdf");
      expect(result.tamperCheck).toBeDefined();
    });

    it("rejects files larger than 5 MB", async () => {
      const bigFile = new File([new ArrayBuffer(6 * 1024 * 1024)], "big.pdf", { type: "application/pdf" });
      await expect(peopleMockService.uploadDocument(bigFile)).rejects.toThrow("Ukuran file melebihi");
    });

    it("rejects unsupported file types", async () => {
      const file = new File(["test"], "test.exe", { type: "application/x-msdownload" });
      await expect(peopleMockService.uploadDocument(file)).rejects.toThrow("Format file tidak didukung");
    });
  });

  describe("getConsentByToken", () => {
    it("returns INVALID for unknown token", async () => {
      const result = await peopleMockService.getConsentByToken("unknown-token");
      expect(result.state).toBe("INVALID");
    });

    it("returns EXPIRED for expired token", async () => {
      const result = await peopleMockService.getConsentByToken("consent-token-expired");
      expect(result.state).toBe("EXPIRED");
    });

    it("returns DELIVERY_FAILED for delivery failed token", async () => {
      const result = await peopleMockService.getConsentByToken("consent-token-delivery-failed");
      expect(result.state).toBe("DELIVERY_FAILED");
    });

    it("returns VALID for valid token", async () => {
      const created = await peopleMockService.createPerson(makeDraft());
      const result = await peopleMockService.getConsentByToken(`consent-token-${created.patientId}`);
      expect(result.state).toBe("VALID");
    });
  });

  describe("decideConsent", () => {
    it("approves consent", async () => {
      const created = await peopleMockService.createPerson(makeDraft());
      const result = await peopleMockService.decideConsent(
        `consent-token-${created.patientId}`,
        "APPROVED"
      );
      expect(result.success).toBe(true);
      expect(result.status).toBe("APPROVED");
    });

    it("rejects consent", async () => {
      const created = await peopleMockService.createPerson(makeDraft());
      const result = await peopleMockService.decideConsent(
        `consent-token-${created.patientId}`,
        "REJECTED"
      );
      expect(result.success).toBe(true);
      expect(result.status).toBe("REJECTED");
    });
  });

  describe("getConsentEvents", () => {
    it("returns events for consent", async () => {
      const list = await peopleMockService.listPeople({ page: 1, pageSize: 1 });
      const person = await peopleMockService.getPerson(list.data[0].id);
      if (person.consent) {
        const events = await peopleMockService.getConsentEvents(person.consent.id);
        expect(events.length).toBeGreaterThan(0);
        expect(events[0].type).toBe("CREATED");
      }
    });
  });

  describe("resendConsent", () => {
    it("resends consent successfully", async () => {
      const list = await peopleMockService.listPeople({ page: 1, pageSize: 1 });
      const person = await peopleMockService.getPerson(list.data[0].id);
      if (person.consent) {
        const result = await peopleMockService.resendConsent(person.consent.id);
        expect(result.success).toBe(true);
        expect(result.status).toBe("SIMULATED_SENT");
      }
    });

    it("fails when emailFailure is enabled", async () => {
      peopleMockService.setConfig({ emailFailure: true });
      const list = await peopleMockService.listPeople({ page: 1, pageSize: 1 });
      const person = await peopleMockService.getPerson(list.data[0].id);
      if (person.consent) {
        const result = await peopleMockService.resendConsent(person.consent.id);
        expect(result.success).toBe(false);
        expect(result.status).toBe("SIMULATED_FAILED");
      }
      peopleMockService.setConfig({ emailFailure: false });
    });
  });

  describe("resetDemoData", () => {
    it("resets data to initial state", async () => {
      await peopleMockService.createPerson(makeDraft());
      await peopleMockService.resetDemoData();
      const result = await peopleMockService.listPeople({ page: 1, pageSize: 100 });
      expect(result.total).toBe(30);
    });
  });
});
