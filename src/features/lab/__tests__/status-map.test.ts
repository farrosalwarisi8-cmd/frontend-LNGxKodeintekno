import { describe, it, expect } from "vitest";
import {
  LAB_ORDER_STATUS_FILTERS,
  RADIOLOGY_ORDER_STATUS_FILTERS,
  labItemStatusInfo,
  labOrderStatusInfo,
  labResultStatusInfo,
  radiologyOrderStatusInfo,
} from "../status-map";

describe("labOrderStatusInfo — dari enum API", () => {
  it("memetakan setiap nilai enum LabOrderStatus ke label Indonesia + ikon", () => {
    expect(labOrderStatusInfo("ORDERED")).toMatchObject({
      label: "Menunggu sampel",
      icon: "clock",
    });
    expect(labOrderStatusInfo("SAMPLE_COLLECTED")).toMatchObject({
      label: "Sampel diterima",
      icon: "sample",
    });
    expect(labOrderStatusInfo("IN_ANALYSIS").label).toBe("Sedang dianalisis");
    expect(labOrderStatusInfo("COMPLETED").label).toBe("Hasil diinput");
    expect(labOrderStatusInfo("CANCELLED").label).toBe("Dibatalkan");
  });

  it("normalisasi huruf besar/kecil dan spasi", () => {
    expect(labOrderStatusInfo(" ordered ").key).toBe("ORDERED");
    expect(labOrderStatusInfo("sample_collected").key).toBe("SAMPLE_COLLECTED");
  });

  it("nilai tak dikenal TIDAK ditebak — ditampilkan apa adanya", () => {
    const info = labOrderStatusInfo("WEIRD_STATUS_X");
    expect(info.label).toBe("Status: WEIRD_STATUS_X");
    expect(info.variant).toBe("default");
    expect(labOrderStatusInfo(null).label).toBe("Status tidak diketahui");
  });

  it("semua status memiliki ikon + label (bukan warna saja)", () => {
    for (const { value } of LAB_ORDER_STATUS_FILTERS) {
      const info = labOrderStatusInfo(value);
      expect(info.label.length).toBeGreaterThan(0);
      expect(info.icon.length).toBeGreaterThan(0);
    }
  });
});

describe("radiologyOrderStatusInfo — dari enum API", () => {
  it("memetakan RadiologyOrderStatus", () => {
    expect(radiologyOrderStatusInfo("ORDERED").label).toBe("Menunggu pemeriksaan");
    expect(radiologyOrderStatusInfo("IMAGE_CAPTURED").label).toBe("Gambar diambil");
    expect(radiologyOrderStatusInfo("READING_PENDING").label).toBe("Menunggu pembacaan");
    expect(radiologyOrderStatusInfo("COMPLETED").label).toBe("Laporan selesai");
    expect(radiologyOrderStatusInfo("CANCELLED").label).toBe("Dibatalkan");
  });

  it("filter radiologi memakai kunci yang sama", () => {
    for (const { value } of RADIOLOGY_ORDER_STATUS_FILTERS) {
      expect(radiologyOrderStatusInfo(value).key).toBe(value);
    }
  });
});

describe("labResultStatusInfo — RecordStatus + verifikasi", () => {
  it("verified_at terisi → status batas akhir A2", () => {
    const info = labResultStatusInfo("FINAL", "2026-10-20T10:00:00Z");
    expect(info.label).toBe("Terverifikasi, menunggu tanda tangan");
    expect(info.key).toBe("VERIFIED_PENDING_SIGNATURE");
  });

  it("tanpa verifikasi → mengikuti enum RecordStatus", () => {
    expect(labResultStatusInfo("DRAFT").label).toBe("Draf hasil");
    expect(labResultStatusInfo("FINAL").label).toBe("Hasil diinput");
    expect(labResultStatusInfo("LOCKED").label).toBe("Terkunci");
    expect(labResultStatusInfo("AMENDED").label).toBe("Lewat addendum");
    expect(labResultStatusInfo("VOID").label).toBe("Dibatalkan");
  });

  it("verified_at null tidak mengubah status", () => {
    expect(labResultStatusInfo("FINAL", null).label).toBe("Hasil diinput");
  });
});

describe("labItemStatusInfo — string bebas backend", () => {
  it("default PENDING → Menunggu hasil", () => {
    expect(labItemStatusInfo("PENDING").label).toBe("Menunggu hasil");
    expect(labItemStatusInfo(undefined).label).toBe("Menunggu hasil");
  });

  it("nilai dikenal lain dipetakan, selain itu apa adanya", () => {
    expect(labItemStatusInfo("COMPLETED").label).toBe("Hasil diinput");
    expect(labItemStatusInfo("MAGIC").label).toBe("Status: MAGIC");
  });
});
