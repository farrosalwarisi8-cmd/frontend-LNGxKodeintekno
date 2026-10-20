/**
 * Validasi baris impor — Fase A2 (Tugas 4).
 *
 * Murni & dapat diuji tanpa DOM. Prinsip:
 * - Pencocokan HANYA lewat identifier yang disediakan data (`order_id`)
 *   terhadap daftar order yang dimuat dari API. Tidak ada fuzzy matching,
 *   tidak ada penebakan: baris yang tidak cocok ditandai sebagai error.
 * - Parameter harus cocok persis (case-insensitive) dengan nama/kode jenis
 *   tes pada item order tersebut — daftarnya datang dari API, bukan hardcode.
 * - Validasi tipe hanya teknis (angka vs teks, wajib isi) — tanpa ambang
 *   klinis apa pun.
 */

import type { BackendLabOrder } from "@/lib/services/diagnostic.service";
import type { RawImportRow } from "@/features/lab/import/parsing";

export interface RowIssue {
  line: number;
  column: "order_id" | "parameter_name" | "value" | "value_type" | string;
  reason: string;
}

export interface ValidImportRow {
  line: number;
  orderId: string;
  /** Nama parameter persis seperti terdaftar pada order (dari API). */
  parameterName: string;
  labOrderItemId: string;
  numericValue?: number;
  textValue?: string;
  unit?: string;
}

export interface ValidationResult {
  valid: ValidImportRow[];
  invalid: Array<{ row: RawImportRow; issues: RowIssue[] }>;
}

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** Validasi seluruh baris terhadap order yang dimuat dari API. */
export function validateImportRows(
  rows: RawImportRow[],
  orders: BackendLabOrder[]
): ValidationResult {
  const orderById = new Map(orders.map((o) => [o.id.trim(), o]));
  const seen = new Set<string>();
  const valid: ValidImportRow[] = [];
  const invalid: Array<{ row: RawImportRow; issues: RowIssue[] }> = [];

  for (const row of rows) {
    const issues: RowIssue[] = [];

    if (!row.orderId) {
      issues.push({ line: row.line, column: "order_id", reason: "order_id wajib diisi." });
    }
    if (!row.parameterName) {
      issues.push({
        line: row.line,
        column: "parameter_name",
        reason: "parameter_name wajib diisi.",
      });
    }
    if (!row.value) {
      issues.push({ line: row.line, column: "value", reason: "value wajib diisi." });
    }
    if (row.valueType && row.valueType !== "number" && row.valueType !== "text") {
      issues.push({
        line: row.line,
        column: "value_type",
        reason: 'value_type hanya boleh "number" atau "text" (atau kosong).',
      });
    }

    const order = row.orderId ? orderById.get(row.orderId.trim()) : undefined;
    if (row.orderId && !order) {
      issues.push({
        line: row.line,
        column: "order_id",
        reason: `order_id "${row.orderId}" tidak ditemukan pada daftar order — baris ditandai, tidak ditebak.`,
      });
    }

    let targetItem: NonNullable<BackendLabOrder["order_items"]>[number] | undefined;

    if (order && row.parameterName) {
      const needle = normalize(row.parameterName);
      const items = order.order_items ?? [];
      const match = items.find((item) => {
        const t = item.test_type;
        if (!t) return false;
        return normalize(t.name ?? "") === needle || normalize(t.code ?? "") === needle;
      });
      if (!match) {
        const known = items
          .map((i) => i.test_type?.name ?? i.test_type?.code ?? "")
          .filter(Boolean)
          .join(", ");
        issues.push({
          line: row.line,
          column: "parameter_name",
          reason: `Parameter "${row.parameterName}" tidak cocok dengan jenis tes order ini${
            known ? ` (tersedia: ${known})` : ""
          }.`,
        });
      } else {
        targetItem = match;
      }
    }

    if (order && row.parameterName && row.value) {
      const key = `${order.id.trim()}::${normalize(row.parameterName)}`;
      if (seen.has(key)) {
        issues.push({
          line: row.line,
          column: "parameter_name",
          reason: "Duplikat: parameter ini sudah ada di baris sebelumnya untuk order yang sama.",
        });
      } else {
        seen.add(key);
      }
    }

    if (issues.length > 0) {
      invalid.push({ row, issues });
      continue;
    }

    // Validasi tipe nilai (teknis saja).
    const normalizedValue = row.value.replace(",", ".");
    const wantsNumber = row.valueType === "number" || (row.valueType === "" && isNumeric(normalizedValue));
    if (row.valueType === "number" && !isNumeric(normalizedValue)) {
      invalid.push({
        row,
        issues: [
          {
            line: row.line,
            column: "value",
            reason: `Tipe salah: value harus angka, berisi "${row.value}".`,
          },
        ],
      });
      continue;
    }

    const item = targetItem as
      | { id: string; test_type?: { name?: string; code?: string; unit?: string } | null }
      | undefined;
    if (!order || !item) {
      invalid.push({
        row,
        issues: [
          { line: row.line, column: "parameter_name", reason: "Item pemeriksaan tidak ditemukan." },
        ],
      });
      continue;
    }

    valid.push({
      line: row.line,
      orderId: order.id,
      parameterName: matchParameterName(order, row.parameterName),
      labOrderItemId: item.id,
      ...(wantsNumber
        ? { numericValue: Number(normalizedValue) }
        : { textValue: row.value.trim() }),
      ...(row.unit || item.test_type?.unit ? { unit: row.unit || item.test_type?.unit } : {}),
    });
  }

  return { valid, invalid };
}

function isNumeric(value: string): boolean {
  return value !== "" && Number.isFinite(Number(value));
}

/** Kembalikan nama parameter persis seperti terdaftar di API (bukan kiriman user). */
function matchParameterName(order: BackendLabOrder, input: string): string {
  const needle = normalize(input);
  for (const item of order.order_items ?? []) {
    const t = item.test_type;
    if (!t) continue;
    if (normalize(t.name ?? "") === needle || normalize(t.code ?? "") === needle) {
      return t.name || t.code || input.trim();
    }
  }
  return input.trim();
}

/** Bangun laporan kesalahan per baris (CSV) yang bisa diunduh. */
export function buildErrorReportCsv(
  invalid: Array<{ row: RawImportRow; issues: RowIssue[] }>
): string {
  const lines = ["baris,kolom,alasan"];
  for (const entry of invalid) {
    for (const issue of entry.issues) {
      lines.push([String(issue.line), issue.column, issue.reason].map(safeCell).join(","));
    }
  }
  return lines.join("\n");
}

function safeCell(value: string): string {
  const v = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
