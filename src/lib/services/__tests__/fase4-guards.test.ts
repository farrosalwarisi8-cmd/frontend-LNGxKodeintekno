import { beforeEach, describe, expect, it } from "vitest";
import { installBrowserStubs, mockFetch, envelope, pathOf } from "./helpers";

installBrowserStubs();

// Store memakai cookie saat logout — sediakan stub document untuk environment node.
Object.defineProperty(globalThis, "document", {
  value: { cookie: "" },
  writable: true,
});

/**
 * Fase 4 — bukti lapisan frontend untuk kriteria penerimaan:
 *   1. Waiver create/send/approve/reject/revoke (kontrak endpoint).
 *   2. Scope switching: data scope sebelumnya dibuang + refetch.
 *   3. Duplicate code guard (client) + unique constraint 409 backend.
 *   4. Dependency guard: flag `force` pada nonaktifkan site/organisasi.
 * Kriteria "data lama tidak tampil setelah pindah scope" diuji lewat
 * pembersihan store (setActiveSite) + penyaringan sync (sinkronisasi).
 */

describe("Fase 4 — waiver: kontrak lifecycle create/send/decide/revoke", () => {
  it("create, approve, reject, send, revoke memanggil endpoint yang benar", async () => {
    const calls = mockFetch(() => ({ body: envelope({ id: "w1" }) }));
    const { waiverService } = await import("@/lib/services/waiver.service");

    await waiverService.list(1, 50, "kantor");
    await waiverService.create({
      visitorName: "Budi",
      purpose: "Inspeksi",
      validUntil: "2026-12-31",
    });
    await waiverService.decide("w1", "APPROVED");
    await waiverService.decide("w2", "REJECTED");
    await waiverService.send("w1", "host@example.com");
    await waiverService.send("w2");
    await waiverService.revoke("w1");

    expect(calls[0].method).toBe("GET");
    expect(pathOf(calls[0].url)).toBe("/api/v1/waivers?page=1&limit=50&search=kantor");

    expect(pathOf(calls[1].url)).toBe("/api/v1/waivers");
    expect(calls[1].method).toBe("POST");
    expect(calls[1].body).toMatchObject({ visitorName: "Budi", purpose: "Inspeksi" });

    expect(pathOf(calls[2].url)).toBe("/api/v1/waivers/w1/decision");
    expect(calls[2].method).toBe("POST");
    expect(calls[2].body).toEqual({ status: "APPROVED" });

    expect(pathOf(calls[3].url)).toBe("/api/v1/waivers/w2/decision");
    expect(calls[3].body).toEqual({ status: "REJECTED" });

    expect(pathOf(calls[4].url)).toBe("/api/v1/waivers/w1/send");
    expect(calls[4].method).toBe("POST");
    expect(calls[4].body).toEqual({ email: "host@example.com" });

    // Tanpa email: body kosong (UI meminta email lebih dulu bila host_email kosong).
    expect(pathOf(calls[5].url)).toBe("/api/v1/waivers/w2/send");
    expect(calls[5].body).toEqual({});

    expect(pathOf(calls[6].url)).toBe("/api/v1/waivers/w1/revoke");
    expect(calls[6].method).toBe("POST");
  });
});

describe("Fase 4 — waiver: penyaringan scope site", () => {
  const w = (id: string, siteId: string | null, viaRelation = false) => ({
    id,
    visitor_name: "Tamu",
    purpose: "Kunjungan",
    valid_until: "2026-12-31",
    status: "PENDING",
    site_id: viaRelation ? null : siteId,
    site: viaRelation && siteId ? { id: siteId } : null,
  });

  it("scope null → semua baris ditampilkan (cakupan bawaan token)", async () => {
    const { filterWaiversBySite } = await import("@/lib/services/waiver.service");
    const rows = [w("a", "site-a"), w("b", "site-b")];
    expect(filterWaiversBySite(rows, null)).toHaveLength(2);
    expect(filterWaiversBySite(rows, undefined)).toHaveLength(2);
  });

  it("scope site aktif → hanya baris site itu (via site_id ATAU relasi site.id)", async () => {
    const { filterWaiversBySite } = await import("@/lib/services/waiver.service");
    const rows = [
      w("a", "site-a"),
      w("b", "site-b"),
      w("c", "site-a", true), // relasi site { id }
      w("tanpa-site", null),
    ];
    const scoped = filterWaiversBySite(rows, "site-a");
    expect(scoped.map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("fail-closed: baris tanpa site ikut dibuang saat scope aktif", async () => {
    const { filterWaiversBySite } = await import("@/lib/services/waiver.service");
    expect(filterWaiversBySite([w("x", null)], "site-a")).toHaveLength(0);
  });
});

describe("Fase 4 — master data: guard kode duplikat (client)", () => {
  const rows = [
    { id: "o1", code: "HO" },
    { id: "o2", code: "PLANT-01" },
    { id: "o3", code: "  mixed  " },
  ];

  it("menemukan bentrokan kode tanpa memandang besar-kecil huruf & spasi", async () => {
    const { findDuplicateCode } = await import("@/lib/services/master-data.service");
    expect(findDuplicateCode(rows, "ho")).toBe("HO");
    expect(findDuplicateCode(rows, " plant-01 ")).toBe("PLANT-01");
    expect(findDuplicateCode(rows, "  Ho  ")).toBe("HO");
    expect(findDuplicateCode(rows, "MIXED")).toBe("  mixed  ".trim());
  });

  it("kode unik / kosong → lolos (tidak ada bentrokan)", async () => {
    const { findDuplicateCode } = await import("@/lib/services/master-data.service");
    expect(findDuplicateCode(rows, "new-code")).toBeNull();
    expect(findDuplicateCode(rows, "")).toBeNull();
    expect(findDuplicateCode(rows, "   ")).toBeNull();
  });

  it("baris yang dikecualikan (edit) tidak dianggap bentrok dengan dirinya sendiri", async () => {
    const { findDuplicateCode } = await import("@/lib/services/master-data.service");
    expect(findDuplicateCode(rows, "HO", "o1")).toBeNull();
    // tetap menangkap bentrokan dengan baris lain
    expect(findDuplicateCode(rows, "PLANT-01", "o1")).toBe("PLANT-01");
  });
});

describe("Fase 4 — dependency guard: flag force pada nonaktifkan", () => {
  it("setSiteStatus mengirim { active, force } ke backend", async () => {
    const calls = mockFetch(() => ({ body: envelope({ id: "s1" }) }));
    const { masterDataService } = await import("@/lib/services/master-data.service");

    await masterDataService.setSiteStatus("s1", false, false);
    await masterDataService.setSiteStatus("s1", false, true);
    await masterDataService.setSiteStatus("s1", true);

    expect(pathOf(calls[0].url)).toBe("/api/v1/master-data/sites/s1/status");
    expect(calls[0].method).toBe("PATCH");
    expect(calls[0].body).toEqual({ active: false, force: false });
    expect(calls[1].body).toEqual({ active: false, force: true });
    expect(calls[2].body).toEqual({ active: true, force: undefined });
  });

  it("setOrganizationStatus mengirim { status, force } (409 men-trigger alur force)", async () => {
    const calls = mockFetch((req, i) =>
      i === 1
        ? {
            status: 409,
            body: {
              success: false,
              statusCode: 409,
              message: "Organisasi masih memiliki data aktif",
            },
          }
        : { body: envelope({ id: "o1" }) }
    );
    const [md, api] = await Promise.all([
      import("@/lib/services/master-data.service"),
      import("@/lib/api-client"),
    ]);
    const { masterDataService } = md;
    const ApiError = api.ApiError;

    await masterDataService.setOrganizationStatus("o1", "INACTIVE", false);
    // Percobaan kedua tanpa force → 409 (dependency guard backend).
    const err = await masterDataService
      .setOrganizationStatus("o1", "INACTIVE")
      .then(() => null)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as InstanceType<typeof ApiError>).status).toBe(409);

    // Percobaan force → diterima backend.
    await masterDataService.setOrganizationStatus("o1", "INACTIVE", true);

    expect(pathOf(calls[0].url)).toBe("/api/v1/master-data/organizations/o1/status");
    expect(calls[0].body).toEqual({ status: "INACTIVE", force: false });
    expect(calls[2].body).toEqual({ status: "INACTIVE", force: true });
  });
});

describe("Fase 4 — scope switching: store membuang data scope lama", () => {
  const seedScopeData = () => {
    const { useStore } = storeModule!;
    useStore.setState({
      employees: [
        {
          id: "e1",
          employeeId: "E1",
          mrn: "MRN-1",
          fullName: "Pekerja Site A",
          nationalId: "111",
          dateOfBirth: "",
          gender: "Male",
          companyId: "",
          departmentId: "",
          jobTitle: "",
          locationId: "",
          startDate: "",
          status: "Active",
          phone: "",
          email: "",
          employmentHistory: [],
          consentGiven: false,
          documents: [],
        },
      ],
      visits: [
        {
          id: "v1",
          visitNumber: "V-1",
          queueNumber: 1,
          employeeId: "e1",
          appointmentId: "",
          locationId: "",
          date: "2026-10-14",
          time: "08:00",
          chiefComplaint: "",
          initialExam: "",
          diagnosisIds: [],
          diagnosisNote: "",
          treatment: "",
          doctorNote: "",
          status: "In Queue",
          createdAt: new Date().toISOString(),
        },
      ],
      mcus: [],
      medicines: [],
      stockBatches: [],
      companies: [],
      departments: [],
      locations: [],
      activeSiteId: null,
      activeSiteName: null,
      scopeVersion: 0,
    });
  };

  let storeModule: typeof import("@/lib/store") | null = null;

  beforeEach(async () => {
    storeModule = await import("@/lib/store");
    seedScopeData();
  });

  it("setActiveSite menghapus data tersinkron scope lama & menaikkan scopeVersion", async () => {
    const { useStore } = storeModule!;
    const before = useStore.getState().scopeVersion;

    useStore.getState().setActiveSite("site-b", "Site B");

    const s = useStore.getState();
    expect(s.activeSiteId).toBe("site-b");
    expect(s.activeSiteName).toBe("Site B");
    expect(s.scopeVersion).toBe(before + 1);
    // Data scope lama tidak boleh tersisa (kriteria utama Fase 4).
    expect(s.employees).toEqual([]);
    expect(s.visits).toEqual([]);
    expect(s.mcus).toEqual([]);
    expect(s.medicines).toEqual([]);
    expect(s.stockBatches).toEqual([]);
    expect(s.companies).toEqual([]);
    expect(s.departments).toEqual([]);
    expect(s.locations).toEqual([]);
  });

  it("site yang sama dipilih ulang → tidak ada perubahan (tidak memicu refetch)", async () => {
    const { useStore } = storeModule!;
    useStore.getState().setActiveSite("site-b", "Site B");
    const snapshot = useStore.getState();
    useStore.getState().setActiveSite("site-b", "Site B");
    const after = useStore.getState();
    expect(after.scopeVersion).toBe(snapshot.scopeVersion);
    expect(after.activeSiteId).toBe("site-b");
  });

  it("kembali ke 'Semua site' (null) → scope dibersihkan & versi naik", async () => {
    const { useStore } = storeModule!;
    useStore.getState().setActiveSite("site-b", "Site B");
    const before = useStore.getState().scopeVersion;
    useStore.getState().setActiveSite(null);
    const s = useStore.getState();
    expect(s.activeSiteId).toBeNull();
    expect(s.activeSiteName).toBeNull();
    expect(s.scopeVersion).toBe(before + 1);
  });

  it("logout me-reset scope site agar tidak bocor ke sesi berikutnya", async () => {
    const { useStore } = storeModule!;
    useStore.setState({ currentUserId: "u1" });
    useStore.getState().setActiveSite("site-b", "Site B");
    useStore.getState().logout();
    const s = useStore.getState();
    expect(s.activeSiteId).toBeNull();
    expect(s.activeSiteName).toBeNull();
  });
});

describe("Fase 4 — scope switching: sinkronisasi mengikuti site aktif", () => {
  beforeEach(async () => {
    const { useStore } = await import("@/lib/store");
    useStore.setState({
      activeSiteId: null,
      activeSiteName: null,
      visits: [],
      employees: [],
      companies: [],
      departments: [],
      locations: [],
      mcus: [],
      medicines: [],
      stockBatches: [],
    });
  });

  it("syncPatients menyaring baris di luar scope site aktif", async () => {
    const { useStore } = await import("@/lib/store");
    useStore.setState({ activeSiteName: "Site A" });

    const calls = mockFetch(() => ({
      body: envelope(
        [
          { id: "p1", mrn: "MRN-1", fullName: "Ani", employeeNo: "E1", site: "Site A" },
          { id: "p2", mrn: "MRN-2", fullName: "Budi", employeeNo: "E2", site: "Site B" },
        ],
        { page: 1, limit: 100, total: 2, totalPages: 1 }
      ),
    }));

    const { syncPatients } = await import("@/lib/remote-sync");
    const rows = await syncPatients(1, 100);

    expect(calls[0].url).toContain("/api/v1/patients");
    expect(rows.map((r) => r.id)).toEqual(["p1"]);
    expect(useStore.getState().employees.map((e) => e.id)).toEqual(["p1"]);
    // Lokasi yang dibangun dari site juga hanya milik scope aktif.
    expect(useStore.getState().locations.map((l) => l.name)).toEqual(["Site A"]);
  });

  it("syncQueues meneruskan siteId scope aktif ke backend", async () => {
    const { useStore } = await import("@/lib/store");
    useStore.setState({ activeSiteId: "site-a" });

    const calls = mockFetch(() => ({ body: envelope([]) }));
    const { syncQueues } = await import("@/lib/remote-sync");
    await syncQueues();

    expect(pathOf(calls[0].url)).toBe("/api/v1/clinic/queues?siteId=site-a");
  });

  it("syncInventory mengirim ?siteId= scope aktif", async () => {
    const { useStore } = await import("@/lib/store");
    useStore.setState({ activeSiteId: "site-a" });

    const calls = mockFetch(() => ({ body: envelope([]) }));
    const { syncInventory } = await import("@/lib/remote-sync");
    await syncInventory();

    expect(pathOf(calls[0].url)).toBe("/api/v1/pharmacy/inventory?siteId=site-a");
  });

  it("syncMcu membuang cycle milik site lain (filter client by nama site)", async () => {
    const { useStore } = await import("@/lib/store");
    useStore.setState({ activeSiteName: "Site A" });

    mockFetch(() => ({
      body: envelope(
        [
          {
            id: "mcu-a",
            patient_id: "p1",
            mcu_type: "ANNUAL_PERIODIC",
            examination_date: "2026-10-01",
            patient: { id: "p1", employee: { full_name: "Ani", site: { name: "Site A" } } },
          },
          {
            id: "mcu-b",
            patient_id: "p2",
            mcu_type: "ANNUAL_PERIODIC",
            examination_date: "2026-10-01",
            patient: { id: "p2", employee: { full_name: "Budi", site: { name: "Site B" } } },
          },
        ],
        { page: 1, limit: 100, total: 2, totalPages: 1 }
      ),
    }));

    const { syncMcu } = await import("@/lib/remote-sync");
    const mcus = await syncMcu(1, 100);

    expect(mcus.map((m) => m.id)).toEqual(["mcu-a"]);
    expect(useStore.getState().mcus.map((m) => m.id)).toEqual(["mcu-a"]);
  });

  it("setelah pindah scope, refetch tidak menyisakan data scope lama", async () => {
    const { useStore } = await import("@/lib/store");
    // Scope Site A: data masuk.
    useStore.setState({ activeSiteId: "site-a", activeSiteName: "Site A" });
    const { syncQueues } = await import("@/lib/remote-sync");

    mockFetch(() => ({
      body: envelope([
        {
          id: "tkt-1",
          ticket_no: "T-1",
          status: "WAITING",
          appointment_id: "ap-1",
          created_at: "2026-10-14T08:00:00.000Z",
          appointment: { patient: { id: "p1" } },
        },
      ]),
    }));
    await syncQueues();
    expect(useStore.getState().visits).toHaveLength(1);

    // Pindah scope → store dibersihkan sebelum refetch.
    useStore.getState().setActiveSite("site-b", "Site B");
    expect(useStore.getState().visits).toEqual([]);

    // Refetch di scope baru (respons kosong) → tidak ada baris scope lama.
    mockFetch(() => ({ body: envelope([]) }));
    await syncQueues();
    expect(useStore.getState().visits).toEqual([]);
  });
});
