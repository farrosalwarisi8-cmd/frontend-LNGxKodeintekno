/**
 * Pembacaan & artefak berkas impor hasil lab — Fase A2 (Tugas 4).
 *
 * - Parsing SEPENUHNYA di sisi klien; papaparse dimuat lazy (hanya saat
 *   halaman impor memanggil `parseImportFile`).
 * - Batas ukuran & jumlah baris ditegakkan di sini, dengan pesan jelas.
 * - Berkas Excel .xlsx DITOLAK eksplisit dan diminta dikonversi ke CSV
 *   (alasan: parser xlsx ringan-pun rawan advis keamanan/lisensi; lihat
 *   bagian "Pilihan pustaka" di LAPORAN_A2_LAB_RADIOLOGI.md).
 * - Isi berkas diperlakukan sebagai data tak tepercaya: tidak pernah
 *   dimasukkan sebagai HTML (tanpa dangerouslySetInnerHTML), dan sel yang
 *   berpotensi jadi formula spreadsheet dinetralkan saat diekspor.
 */

export const MAX_FILE_BYTES = 512 * 1024; // 512 KB
export const MAX_ROWS = 500;

export const REQUIRED_COLUMNS = ["order_id", "parameter_name", "value"] as const;
export const OPTIONAL_COLUMNS = ["value_type", "unit"] as const;

const ACCEPTED_EXTENSIONS = [".csv", ".tsv", ".txt"];
const REJECTED_EXTENSIONS = [".xlsx", ".xls", ".ods"];

export class ImportError extends Error {
  constructor(
    message: string,
    /** Kolom terkait bila ada (untuk laporan error per baris). */
    public column?: string
  ) {
    super(message);
    this.name = "ImportError";
  }
}

export interface RawImportRow {
  /** Nomor baris pada berkas (1 = judul kolom). */
  line: number;
  orderId: string;
  parameterName: string;
  value: string;
  valueType: string;
  unit: string;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/** Netralkan sel agar aman diekspor kembali ke CSV (anti CSV-injection). */
export function sanitizeCsvCell(value: string): string {
  const v = value ?? "";
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/** Escape nilai ke satu sel CSV. */
function csvCell(value: string): string {
  const safe = sanitizeCsvCell(value);
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function checkFile(file: { name: string; size: number }): void {
  const lower = file.name.toLowerCase();
  if (REJECTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    throw new ImportError(
      "Format Excel (.xlsx/.xls) belum didukung parser di browser ini. " +
        "Unduh template CSV, isi datanya, lalu unggah kembali sebagai CSV."
    );
  }
  if (!ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    throw new ImportError(
      "Berkas harus berformat CSV, TSV, atau TXT dengan ekstensi yang didukung."
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new ImportError(
      `Ukuran berkas melebihi batas ${Math.round(MAX_FILE_BYTES / 1024)} KB ` +
        `(berkas ${Math.round(file.size / 1024)} KB). Pisahkan menjadi beberapa berkas.`
    );
  }
}

/**
 * Parse berkas di browser. Mengembalikan baris mentah terstruktur atau
 * melempar `ImportError` dengan pesan yang bisa ditampilkan ke pengguna.
 */
export async function parseImportFile(file: File): Promise<RawImportRow[]> {
  checkFile(file);

  const text = await file.text();
  // Lazy: modul papaparse hanya dimuat saat fungsi ini dipanggil.
  const Papa = (await import("papaparse")).default;

  const parsed = Papa.parse<string[]>(text, {
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t"],
  });

  const table = parsed.data.filter((r) => Array.isArray(r) && r.some((c) => c.trim() !== ""));
  if (table.length === 0) {
    throw new ImportError("Berkas kosong atau tidak berisi baris apa pun.");
  }

  const header = table[0].map(normalizeHeader);
  const indexes = new Map(header.map((h, i) => [h, i]));
  for (const col of REQUIRED_COLUMNS) {
    if (!indexes.has(col)) {
      throw new ImportError(
        `Kolom wajib "${col}" tidak ditemukan pada baris judul. Gunakan template yang tersedia.`,
        col
      );
    }
  }

  const dataRows = table.slice(1);
  if (dataRows.length > MAX_ROWS) {
    throw new ImportError(
      `Jumlah baris melebihi batas ${MAX_ROWS} baris (berkas berisi ${dataRows.length} baris).`
    );
  }
  if (dataRows.length === 0) {
    throw new ImportError("Berkas hanya berisi baris judul, tanpa data.");
  }

  const get = (row: string[], col: string): string => {
    const i = indexes.get(col);
    return i === undefined || i >= row.length ? "" : (row[i] ?? "").trim();
  };

  return dataRows.map((row, idx) => ({
    line: idx + 2, // +2: judul = baris 1
    orderId: get(row, "order_id"),
    parameterName: get(row, "parameter_name"),
    value: get(row, "value"),
    valueType: get(row, "value_type").toLowerCase(),
    unit: get(row, "unit"),
  }));
}

/**
 * Template CSV — DIBANGKITKAN dari item order yang dimuat (jenis tes +
 * satuannya datang dari API per order). Endpoint katalog tes GLOBAL tidak
 * tersedia (BLOCKER BACKEND), sehingga template bersifat scope order yang
 * sedang dimuat.
 */
export function buildTemplateCsv(
  orders: Array<{
    id: string;
    order_items?: Array<{
      test_type?: { name?: string; code?: string; unit?: string } | null;
    } | null>;
  }>
): { csv: string; rowCount: number } {
  const lines = ["order_id,parameter_name,value_type,value,unit"];
  let rowCount = 0;
  for (const order of orders) {
    for (const item of order.order_items ?? []) {
      if (rowCount >= MAX_ROWS) break;
      if (!item) continue;
      const name = item.test_type?.name ?? item.test_type?.code ?? "";
      lines.push(
        [
          csvCell(order.id),
          csvCell(name),
          csvCell(""),
          csvCell(""),
          csvCell(item.test_type?.unit ?? ""),
        ].join(",")
      );
      rowCount += 1;
    }
  }
  return { csv: lines.join("\n"), rowCount };
}

/** Unduh berkas teks di browser (tanpa API eksternal). */
export function downloadTextFile(filename: string, content: string, mime = "text/csv"): void {
  const blob = new Blob([`\uFEFF${content}`], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
