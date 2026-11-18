/**
 * Keamanan unduhan PDF bertanda tangan.
 *
 * Frontend TIDAK pernah memanggil provider PSP dan TIDAK pernah menerima
 * secret provider. URL unduhan hanya berasal dari response backend
 * (`GET /documents/:id/download`). Helper di sini menolak URL berbahaya
 * sebelum dibuka serta memvalidasi payload bila backend mengembalikan PDF.
 */

import { MAX_PDF_BYTES } from "@/features/tte/validation";

const PDF_HEADER = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export class UnsafeDocumentUrlError extends Error {
  constructor() {
    super("Tautan berkas dari backend tidak aman. Unduhan dibatalkan.");
    this.name = "UnsafeDocumentUrlError";
  }
}

function apiOrigin(apiBaseUrl: string): URL | null {
  try {
    return new URL(apiBaseUrl);
  } catch {
    return null;
  }
}

/**
 * Terima URL absolut http(s) yang dikembalikan backend. Tolak:
 *  - skema javascript:/data:/blob:/file: dan sejenisnya,
 *  - URL dengan username/password (credential tersemat),
 *  - URL relatif yang tidak bisa dipetakan ke origin backend,
 *  - http:// pada host selain localhost (staging/production harus https).
 */
export function assertSafeDocumentUrl(value: unknown, apiBaseUrl: string): string {
  if (typeof value !== "string" || !value.trim()) throw new UnsafeDocumentUrlError();
  const base = apiOrigin(apiBaseUrl);
  let parsed: URL;
  try {
    parsed = new URL(value.trim(), base ?? undefined);
  } catch {
    throw new UnsafeDocumentUrlError();
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new UnsafeDocumentUrlError();
  }
  if (parsed.username || parsed.password) throw new UnsafeDocumentUrlError();
  const isLocal =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname === "[::1]";
  if (parsed.protocol === "http:" && !isLocal) throw new UnsafeDocumentUrlError();
  return parsed.toString();
}

export interface PdfPayloadCheck {
  ok: boolean;
  reason?: "content-type" | "empty" | "header" | "too-large";
  message?: string;
}

/**
 * Validasi payload PDF bila backend mengembalikan berkas (bukan URL).
 * Dipakai adapter unduhan saat response berupa blob; jangan pernah menyimpan
 * response bukan PDF dengan nama .pdf.
 */
export function validatePdfPayload(input: {
  contentType?: string | null;
  bytes?: Uint8Array | null;
  contentLength?: number | null;
}): PdfPayloadCheck {
  const type = (input.contentType ?? "").toLowerCase();
  if (!type.includes("application/pdf") && !type.includes("application/octet-stream")) {
    return { ok: false, reason: "content-type", message: "Berkas yang diterima bukan PDF." };
  }
  if (input.contentLength != null && input.contentLength > MAX_PDF_BYTES) {
    return { ok: false, reason: "too-large", message: "PDF melebihi batas 15 MB." };
  }
  const bytes = input.bytes;
  if (!bytes || bytes.length === 0) {
    return { ok: false, reason: "empty", message: "Berkas PDF kosong." };
  }
  if (bytes.length > MAX_PDF_BYTES) {
    return { ok: false, reason: "too-large", message: "PDF melebihi batas 15 MB." };
  }
  for (let i = 0; i < PDF_HEADER.length; i += 1) {
    if (bytes[i] !== PDF_HEADER[i]) {
      return { ok: false, reason: "header", message: "Struktur berkas bukan PDF yang valid." };
    }
  }
  return { ok: true };
}

/** Nama berkas aman untuk atribut download (tanpa token / query). */
export function safeDownloadFilename(title: string | undefined, documentId: string): string {
  const base = (title ?? "dokumen")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "-")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60);
  const id = documentId.replace(/[^\w-]/g, "").slice(0, 24);
  return `${base || "dokumen"}-${id || "signed"}.pdf`;
}
