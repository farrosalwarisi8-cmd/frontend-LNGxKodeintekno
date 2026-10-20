import { describe, it, expect } from "vitest";
import type { BackendLabOrder } from "@/lib/services/diagnostic.service";
import {
  DEFAULT_PAGE_SIZE,
  EMPTY_FILTERS,
  abnormalInfo,
  filterLabOrders,
  formatReferenceRange,
  paginate,
  resultValueText,
  sortLabOrders,
  testTypeOptions,
} from "../order-utils";

function order(over: Partial<BackendLabOrder>): BackendLabOrder {
  return {
    id: "ord-1",
    status: "ORDERED",
    ordered_at: "2026-10-01T08:00:00Z",
    order_items: [],
    ...over,
  } as BackendLabOrder;
}

const orders: BackendLabOrder[] = [
  order({
    id: "ord-a",
    ordered_at: "2026-10-03T08:00:00Z",
    status: "ORDERED",
    order_items: [
      {
        id: "i1",
        lab_test_type_id: "t1",
        status: "PENDING",
        test_type: { id: "t1", code: "HB", name: "Hemoglobin", unit: "g/dL" },
      },
    ],
  }),
  order({
    id: "ord-b",
    ordered_at: "2026-10-01T08:00:00Z",
    status: "COMPLETED",
    order_items: [
      {
        id: "i2",
        lab_test_type_id: "t2",
        status: "PENDING",
        test_type: { id: "t2", code: "GLU", name: "Glukosa", unit: "mg/dL" },
      },
    ],
  }),
];

describe("filterLabOrders", () => {
  it("filter kosong = semua order", () => {
    expect(filterLabOrders(orders, EMPTY_FILTERS)).toHaveLength(2);
  });

  it("pencarian cocok id order dan nama/kode tes", () => {
    expect(filterLabOrders(orders, { ...EMPTY_FILTERS, search: "ord-a" })).toHaveLength(1);
    expect(filterLabOrders(orders, { ...EMPTY_FILTERS, search: "glukosa" })).toHaveLength(1);
    expect(filterLabOrders(orders, { ...EMPTY_FILTERS, search: "GLU" })).toHaveLength(1);
  });

  it("filter status persis (kunci API)", () => {
    expect(filterLabOrders(orders, { ...EMPTY_FILTERS, status: "ORDERED" })).toHaveLength(1);
    expect(filterLabOrders(orders, { ...EMPTY_FILTERS, status: "nope" })).toHaveLength(0);
  });

  it("filter jenis tes dari data API (lab_test_type_id)", () => {
    expect(filterLabOrders(orders, { ...EMPTY_FILTERS, testType: "t2" })).toEqual([
      orders[1],
    ]);
  });

  it("filter tanggal pada ordered_at (hari)", () => {
    expect(
      filterLabOrders(orders, { ...EMPTY_FILTERS, dateFrom: "2026-10-02" })
    ).toHaveLength(1);
    expect(
      filterLabOrders(orders, { ...EMPTY_FILTERS, dateFrom: "2026-09-01", dateTo: "2026-10-02" })
    ).toHaveLength(1);
  });
});

describe("sortLabOrders", () => {
  it("terbaru = ordered_at menurun", () => {
    const sorted = sortLabOrders(orders, "newest");
    expect(sorted[0].id).toBe("ord-a");
  });
  it("terlama = ordered_at naik", () => {
    const sorted = sortLabOrders(orders, "oldest");
    expect(sorted[0].id).toBe("ord-b");
  });
  it("tidak memutasi input", () => {
    const before = orders.map((o) => o.id).join();
    sortLabOrders(orders, "newest");
    expect(orders.map((o) => o.id).join()).toBe(before);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 25 }, (_, i) => i + 1);

  it("default page size dipakai bila tidak dispesifikkan", () => {
    const page = paginate(items, 1);
    expect(page.items).toHaveLength(DEFAULT_PAGE_SIZE);
    expect(page.totalPages).toBe(Math.ceil(25 / DEFAULT_PAGE_SIZE));
    expect(page.total).toBe(25);
  });

  it("halaman di luar jangkauan dikunci valid", () => {
    expect(paginate(items, 99).items.length).toBeGreaterThan(0);
    expect(paginate(items, 0).items[0]).toBe(1);
  });
});

describe("testTypeOptions — diturunkan dari data API", () => {
  it("unik, terurut, tanpa mengulang jenis tes sama", () => {
    const options = testTypeOptions([...orders, orders[0]]);
    // value = id jenis tes dari API, label = nama — terurut berdasarkan nama
    expect(options.map((o) => o.value)).toEqual(["t2", "t1"]);
    expect(options.find((o) => o.value === "t1")?.label).toBe("Hemoglobin");
  });
});

describe("formatReferenceRange — hanya membaca nilai API", () => {
  it("bentuk {min,max}", () => {
    expect(formatReferenceRange({ min: 12, max: 17 })).toBe("12 – 17");
  });
  it("hanya salah satu sisi", () => {
    expect(formatReferenceRange({ min: 5 })).toBe("≥ 5");
    expect(formatReferenceRange({ max: 9 })).toBe("≤ 9");
  });
  it("bentuk bertingkat (per jenis kelamin)", () => {
    expect(
      formatReferenceRange({ male: { min: 13, max: 17 }, female: { min: 12, max: 15 } })
    ).toBe("male: 13 – 17; female: 12 – 15");
  });
  it("string & angka apa adanya; null/undefined → null", () => {
    expect(formatReferenceRange("negatif")).toBe("negatif");
    expect(formatReferenceRange(7)).toBe("7");
    expect(formatReferenceRange(null)).toBeNull();
    expect(formatReferenceRange(undefined)).toBeNull();
    expect(formatReferenceRange("")).toBeNull();
  });
  it("objek tak dikenal tetap ditampilkan sebagai data (bukan angka baru)", () => {
    expect(formatReferenceRange({ catatan: "lihat SOP lab" })).toBe(
      "catatan: lihat SOP lab"
    );
    expect(formatReferenceRange({ a: { b: { c: 1 } } })).toBe("a: b: c: 1");
  });
});

describe("abnormalInfo — flag API boolean", () => {
  it("true → label jujur tanpa mengarang arah tinggi/rendah", () => {
    expect(abnormalInfo(true)).toEqual({ label: "Di luar rentang", tone: "danger" });
  });
  it("false/null/undefined → tanpa penandaan", () => {
    expect(abnormalInfo(false).label).toBe("");
    expect(abnormalInfo(null).label).toBe("");
    expect(abnormalInfo(undefined).label).toBe("");
  });
});

describe("resultValueText", () => {
  it("numerik, teks, atau placeholder", () => {
    expect(
      resultValueText({ id: "v", parameter_name: "p", numeric_value: 12.5 })
    ).toBe("12.5");
    expect(
      resultValueText({ id: "v", parameter_name: "p", text_value: "Negatif" })
    ).toBe("Negatif");
    expect(resultValueText({ id: "v", parameter_name: "p" })).toBe("—");
  });
});
