import { describe, it, expect } from "vitest";
import type { BackendLabOrder } from "@/lib/services/diagnostic.service";
import type { RawImportRow } from "../parsing";
import { buildErrorReportCsv, validateImportRows } from "../validation";

const orders: BackendLabOrder[] = [
  {
    id: "ORD-100",
    status: "ORDERED",
    ordered_at: "2026-10-01T00:00:00Z",
    order_items: [
      {
        id: "item-hb",
        lab_test_type_id: "tt-hb",
        status: "PENDING",
        test_type: { id: "tt-hb", code: "HB", name: "Hemoglobin", unit: "g/dL" },
      },
    ],
  },
  {
    id: "ORD-200",
    status: "ORDERED",
    ordered_at: "2026-10-02T00:00:00Z",
    order_items: [
      {
        id: "item-glu",
        lab_test_type_id: "tt-glu",
        status: "PENDING",
        test_type: { id: "tt-glu", code: "GLU", name: "Glukosa", unit: "mg/dL" },
      },
    ],
  },
] as BackendLabOrder[];

function row(over: Partial<RawImportRow>): RawImportRow {
  return {
    line: 2,
    orderId: "ORD-100",
    parameterName: "Hemoglobin",
    value: "13.5",
    valueType: "",
    unit: "",
    ...over,
  };
}

describe("validateImportRows — baris valid", () => {
  it("order cocok + parameter cocok + angka → valid, nilai numerik diambil", () => {
    const result = validateImportRows([row({})], orders);
    expect(result.invalid).toHaveLength(0);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]).toMatchObject({
      orderId: "ORD-100",
      labOrderItemId: "item-hb",
      parameterName: "Hemoglobin",
      numericValue: 13.5,
      unit: "g/dL", // satuan default dari test_type API
    });
  });

  it("parameter bisa dicocokkan lewat kode tes (case-insensitive)", () => {
    const result = validateImportRows([row({ parameterName: "hb" })], orders);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0].parameterName).toBe("Hemoglobin"); // nama persis API
    expect(result.valid[0].labOrderItemId).toBe("item-hb");
  });

  it("tanpa value_type: teks non-angka dikirim sebagai textValue", () => {
    const result = validateImportRows([row({ value: "Negatif" })], orders);
    expect(result.valid[0].textValue).toBe("Negatif");
    expect(result.valid[0].numericValue).toBeUndefined();
  });

  it("unit dari berkas mengalahkan default API", () => {
    const result = validateImportRows([row({ unit: "mmol/L" })], orders);
    expect(result.valid[0].unit).toBe("mmol/L");
  });
});

describe("validateImportRows — kolom hilang / wajib kosong", () => {
  it("order_id kosong → error kolom order_id + nomor baris", () => {
    const result = validateImportRows([row({ orderId: "", line: 7 })], orders);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].issues[0]).toMatchObject({
      line: 7,
      column: "order_id",
    });
  });

  it("parameter_name kosong → error kolom parameter_name", () => {
    const result = validateImportRows([row({ parameterName: "" })], orders);
    expect(result.invalid[0].issues[0].column).toBe("parameter_name");
  });

  it("value kosong → error kolom value", () => {
    const result = validateImportRows([row({ value: "" })], orders);
    expect(result.invalid[0].issues[0].column).toBe("value");
  });
});

describe("validateImportRows — tipe salah", () => {
  it("value_type number tetapi isinya teks → ditolak dengan alasan jelas", () => {
    const result = validateImportRows([row({ value: "bukan-angka", valueType: "number" })], orders);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].issues[0]).toMatchObject({ column: "value" });
    expect(result.invalid[0].issues[0].reason).toContain("Tipe salah");
  });

  it("value_type di luar enum → ditolak", () => {
    const result = validateImportRows([row({ valueType: "boolean" })], orders);
    expect(result.invalid[0].issues[0].column).toBe("value_type");
  });
});

describe("validateImportRows — pencocokan tidak ditebak", () => {
  it("order_id tidak dikenal → ditandai, tidak ditebak", () => {
    const result = validateImportRows([row({ orderId: "ORD-999" })], orders);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].issues[0].reason).toContain("tidak ditemukan");
    expect(result.invalid[0].issues[0].reason).toContain("tidak ditebak");
  });

  it("parameter tidak ada pada order itu → ditandai + menyebut yang tersedia", () => {
    const result = validateImportRows(
      [row({ orderId: "ORD-200", parameterName: "Trombosit" })],
      orders
    );
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].issues[0].column).toBe("parameter_name");
    expect(result.invalid[0].issues[0].reason).toContain("Glukosa");
  });

  it("duplikat order+parameter pada baris berbeda → ditandai", () => {
    const result = validateImportRows(
      [row({ line: 2 }), row({ line: 3 })],
      orders
    );
    expect(result.valid).toHaveLength(1);
    expect(result.invalid).toHaveLength(1);
    expect(result.invalid[0].issues[0].reason).toContain("Duplikat");
  });

  it("beberapa issue pada satu baris tetap semuanya dilaporkan", () => {
    const result = validateImportRows(
      [row({ orderId: "", parameterName: "", value: "", line: 4 })],
      orders
    );
    expect(result.invalid[0].issues.map((i) => i.column)).toEqual([
      "order_id",
      "parameter_name",
      "value",
    ]);
  });
});

describe("buildErrorReportCsv", () => {
  it("menghasilkan laporan per baris (baris, kolom, alasan)", () => {
    const { invalid } = validateImportRows([row({ orderId: "", line: 9 })], orders);
    const csv = buildErrorReportCsv(invalid);
    expect(csv.split("\n")[0]).toBe("baris,kolom,alasan");
    expect(csv).toContain("9,order_id,");
  });

  it("menetralkan sel yang berpotensi jadi formula spreadsheet", () => {
    const { invalid } = validateImportRows(
      [row({ parameterName: "", value: "", orderId: "" })],
      orders
    );
    // paksa alasan berisi karakter formula (potensi CSV-injection)
    const csv = buildErrorReportCsv([
      {
        row: row({ line: 10 }),
        issues: [
          { line: 10, column: "order_id", reason: "=1+1" },
          { line: 11, column: "value", reason: '=cmd("x"),"y"' },
        ],
      },
      ...invalid,
    ]);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'=cmd");
  });
});
