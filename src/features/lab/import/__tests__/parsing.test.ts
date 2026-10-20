import { describe, it, expect } from "vitest";
import {
  ImportError,
  MAX_FILE_BYTES,
  MAX_ROWS,
  buildTemplateCsv,
  checkFile,
  parseImportFile,
  sanitizeCsvCell,
} from "../parsing";

function makeFile(content: string, name = "impor.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

describe("checkFile — batas & format", () => {
  it("menolak berkas Excel dengan pesan konversi CSV", () => {
    expect(() => checkFile({ name: "data.xlsx", size: 100 })).toThrowError(/Excel/);
    expect(() => checkFile({ name: "DATA.XLS", size: 100 })).toThrowError(/Excel/);
  });

  it("menolak ekstensi tak dikenal", () => {
    expect(() => checkFile({ name: "malware.exe", size: 10 })).toThrowError(/CSV, TSV, atau TXT/);
  });

  it("menolak berkas terlalu besar dengan pesan jelas", () => {
    expect(() =>
      checkFile({ name: "besar.csv", size: MAX_FILE_BYTES + 1 })
    ).toThrowError(/melebihi batas/);
  });

  it("menerima berkas dalam batas", () => {
    expect(() => checkFile({ name: "ok.csv", size: 1024 })).not.toThrow();
  });
});

describe("parseImportFile — parse di browser", () => {
  it("membaca baris judul + data (termasuk pemisah titik koma)", async () => {
    const rows = await parseImportFile(
      makeFile("order_id;parameter_name;value\nORD-1;HB;13.5\n")
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      line: 2,
      orderId: "ORD-1",
      parameterName: "HB",
      value: "13.5",
    });
  });

  it("header berspasi/kapital dinormalisasi", async () => {
    const rows = await parseImportFile(
      makeFile("Order ID, Parameter Name,VALUE\nORD-2,Hb,7\n")
    );
    expect(rows[0].orderId).toBe("ORD-2");
    expect(rows[0].parameterName).toBe("Hb");
  });

  it("kolom wajib hilang → ImportError menyebut kolomnya", async () => {
    await expect(
      parseImportFile(makeFile("order_id,value\nORD-1,5\n"))
    ).rejects.toThrowError(/parameter_name/);
  });

  it("baris melebihi batas → ditolak", async () => {
    const body = [
      "order_id,parameter_name,value",
      ...Array.from({ length: MAX_ROWS + 1 }, (_, i) => `ORD-${i},HB,${i}`),
    ].join("\n");
    await expect(parseImportFile(makeFile(body))).rejects.toThrowError(/melebihi batas/);
  });

  it("hanya baris judul → ditolak", async () => {
    await expect(
      parseImportFile(makeFile("order_id,parameter_name,value\n"))
    ).rejects.toThrowError(/judul/);
  });

  it("isi berkas berbahaya diperlakukan sebagai teks biasa (bukan dievaluasi)", async () => {
    const rows = await parseImportFile(
      makeFile('order_id,parameter_name,value\nORD-1,HB,"=1+1; DROP TABLE x"\n')
    );
    expect(rows[0].value).toBe("=1+1; DROP TABLE x");
  });
});

describe("buildTemplateCsv — dari data order API", () => {
  it("menghasilkan baris per item order + header kolom", () => {
    const { csv, rowCount } = buildTemplateCsv([
      {
        id: "ORD-1",
        order_items: [
          { test_type: { name: "Hemoglobin", code: "HB", unit: "g/dL" } },
          { test_type: { name: "Glukosa", code: "GLU", unit: "mg/dL" } },
        ],
      },
    ]);
    expect(csv.split("\n")[0]).toBe("order_id,parameter_name,value_type,value,unit");
    expect(rowCount).toBe(2);
    expect(csv).toContain("ORD-1,Hemoglobin");
    expect(csv).toContain("g/dL");
  });

  it("tanpa order → hanya baris judul (tanpa daftar tes karangan)", () => {
    const { csv, rowCount } = buildTemplateCsv([]);
    expect(csv.split("\n")).toHaveLength(1);
    expect(rowCount).toBe(0);
  });

  it("item tanpa test_type dilewati, bukan diisi teks palsu", () => {
    const { rowCount } = buildTemplateCsv([{ id: "ORD-2", order_items: [null] }]);
    expect(rowCount).toBe(0);
  });
});

describe("sanitizeCsvCell", () => {
  it("menetralkan karakter formula di awal sel", () => {
    expect(sanitizeCsvCell("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(sanitizeCsvCell("+1")).toBe("'+1");
    expect(sanitizeCsvCell("@cmd")).toBe("'@cmd");
    expect(sanitizeCsvCell("13.5")).toBe("13.5");
  });
});

describe("ImportError", () => {
  it("membawa kolom terkait", () => {
    const e = new ImportError("pesan", "order_id");
    expect(e).toBeInstanceOf(Error);
    expect(e.column).toBe("order_id");
  });
});
