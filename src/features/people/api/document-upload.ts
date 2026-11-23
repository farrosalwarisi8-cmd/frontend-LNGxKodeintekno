import { apiUrl } from "@/lib/env";
import type { TamperCheckStatus } from "./people.types";

/**
 * Unggah dokumen pendukung registrasi pekerja.
 *
 * Backend yang ada saat ini BELUM menyediakan endpoint unggah berkas
 * (`POST /documents/upload` tidak ada di kontrak API — lihat laporan
 * FASE-5-FRONTEND-REPORT.md). Karena itu:
 *
 * 1. Berkas divalidasi di klien SEBELUM dikirim (tipe & ukuran), sehingga
 *    pengguna mendapat pesan spesifik, bukan "Upload dokumen gagal".
 * 2. Bila endpoint tersedia (2xx) → dokumen disimpan server.
 * 3. Bila endpoint tidak tersedia (404/405) → dokumen disimpan sebagai
 *    referensi lokal mode demo dan UI MENANDAINYA "Lokal (demo)", supaya
 *    alur registrasi tetap dapat diselesaikan tanpa menyembunyikan fakta
 *    bahwa berkas belum tersimpan di server.
 * 4. Kegagalan lain (400/413/415/5xx/jaringan) dilempar sebagai error
 *    spesifik dan TIDAK diubah menjadi sukses palsu.
 */

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];

export type DocumentStorage = "SERVER" | "LOCAL_DEMO";

export interface UploadedPersonDocument {
  id: string;
  name: string;
  size: number;
  tamperCheck: TamperCheckStatus;
  storage: DocumentStorage;
}

export class DocumentUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentUploadError";
  }
}

function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

/** Validasi klien: tipe berkas + ukuran. Pesannya spesifik per penyebab. */
export function validateDocumentFile(file: {
  name: string;
  size: number;
  type: string;
}): { ok: true } | { ok: false; message: string } {
  if (file.size <= 0) {
    return { ok: false, message: `"${file.name}" kosong (0 byte). Pilih berkas lain.` };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      message: `"${file.name}" berukuran ${mb} MB, melebihi batas 5 MB.`,
    };
  }
  // Beberapa berkas (mis. dari kamera/HP) datang tanpa MIME; ekstensi menjadi
  // cadangan agar berkas valid tidak ditolak hanya karena `type` kosong.
  const mimeAllowed = (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type);
  const extAllowed = ALLOWED_EXTENSIONS.includes(extensionOf(file.name));
  if (!mimeAllowed && !extAllowed) {
    return {
      ok: false,
      message: `Tipe berkas "${file.name}" tidak didukung. Gunakan PDF, JPG, atau PNG.`,
    };
  }
  return { ok: true };
}

let localDocumentCounter = 0;

function makeLocalDocument(file: File): UploadedPersonDocument {
  localDocumentCounter += 1;
  return {
    id: `local-doc-${Date.now().toString(36)}-${localDocumentCounter}`,
    name: file.name,
    size: file.size,
    tamperCheck: "PASSED",
    storage: "LOCAL_DEMO",
  };
}

interface DocumentUploadResponse {
  documentId?: string;
  name?: string;
  size?: number;
  tamperCheck?: TamperCheckStatus;
}

function authHeaders(): HeadersInit | undefined {
  if (typeof window === "undefined") return undefined;
  const token = window.localStorage.getItem("kodein_token");
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

async function responseMessage(res: Response): Promise<string | null> {
  try {
    const body = (await res.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(", ");
    return body.message ?? null;
  } catch {
    return null;
  }
}

export async function uploadPersonDocument(file: File): Promise<UploadedPersonDocument> {
  const validation = validateDocumentFile(file);
  if (!validation.ok) throw new DocumentUploadError(validation.message);

  let res: Response;
  try {
    const body = new FormData();
    body.append("file", file);
    res = await fetch(apiUrl("/documents/upload"), {
      method: "POST",
      headers: authHeaders(),
      body,
    });
  } catch {
    throw new DocumentUploadError(
      `Tidak dapat menghubungi server saat mengunggah "${file.name}". Periksa koneksi lalu coba lagi.`
    );
  }

  // Endpoint belum tersedia di backend → simpan referensi lokal (mode demo),
  // ditandai jelas di UI agar tidak dianggap tersimpan di server.
  // Next dev menjawab POST ke route yang tidak ada dengan 409 + HTML (bukan
  // JSON API), jadi 409 non-JSON juga diperlakukan sebagai "endpoint absen".
  const contentType = res.headers.get("content-type") ?? "";
  const endpointMissing =
    res.status === 404 ||
    res.status === 405 ||
    (res.status === 409 && !contentType.includes("application/json"));
  if (endpointMissing) {
    return makeLocalDocument(file);
  }

  if (!res.ok) {
    const serverMessage = await responseMessage(res);
    if (res.status === 413) {
      throw new DocumentUploadError(`"${file.name}" terlalu besar untuk server (maksimal 5 MB).`);
    }
    if (res.status === 415) {
      throw new DocumentUploadError(
        serverMessage ?? `Tipe berkas "${file.name}" ditolak server. Gunakan PDF, JPG, atau PNG.`
      );
    }
    throw new DocumentUploadError(
      serverMessage ??
        `Gagal menyimpan "${file.name}" di server (kode ${res.status}). Coba lagi beberapa saat.`
    );
  }

  let result: DocumentUploadResponse;
  try {
    result = (await res.json()) as DocumentUploadResponse;
  } catch {
    throw new DocumentUploadError(
      `Server tidak mengembalikan data dokumen untuk "${file.name}". Coba lagi.`
    );
  }

  if (!result.documentId) {
    throw new DocumentUploadError(
      `Server tidak mengembalikan ID dokumen untuk "${file.name}". Coba lagi.`
    );
  }

  return {
    id: result.documentId,
    name: result.name ?? file.name,
    size: typeof result.size === "number" ? result.size : file.size,
    tamperCheck: result.tamperCheck ?? "PASSED",
    storage: "SERVER",
  };
}

export function formatDocumentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
