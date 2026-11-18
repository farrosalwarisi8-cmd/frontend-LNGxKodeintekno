/**
 * Pemetaan error TTE → pesan UX yang AMAN.
 *
 * Aturan:
 *  - Pesan yang dikirim backend/provider TIDAK dipakai apa-adanya di UI TTE.
 *    Pesan envelope bisa memuat detail internal (host provider, callback URL,
 *    header, atau credential) — semua itu disembunyikan di sini.
 *  - Detail fieldErrors juga tidak ditampilkan; pengguna diberi arahan netral.
 *  - Tidak ada status yang diterjemahkan menjadi "SIGNED".
 */

export type TteErrorKind =
  | "payload"
  | "session"
  | "permission"
  | "not-found"
  | "conflict"
  | "pdf-too-large"
  | "not-pdf"
  | "invalid-document"
  | "rate-limit"
  | "provider-unavailable"
  | "provider-timeout"
  | "backend"
  | "unsafe-link"
  | "offline"
  | "config"
  | "unknown";

export interface TteErrorView {
  kind: TteErrorKind;
  status: number;
  title: string;
  message: string;
  retryable: boolean;
  /** 403 harus tetap ditangani sebagai AccessDenied oleh UI. */
  accessDenied: boolean;
}

const VIEWS: Record<TteErrorKind, Omit<TteErrorView, "kind" | "status">> = {
  payload: {
    title: "Permintaan tidak valid",
    message: "Periksa kembali data dokumen dan jenis tanda tangan, lalu coba lagi.",
    retryable: false,
    accessDenied: false,
  },
  session: {
    title: "Sesi telah berakhir",
    message: "Silakan login kembali untuk melanjutkan proses tanda tangan.",
    retryable: false,
    accessDenied: false,
  },
  permission: {
    title: "Akses terbatas",
    message: "Anda tidak memiliki izin untuk tindakan tanda tangan ini.",
    retryable: false,
    accessDenied: true,
  },
  "not-found": {
    title: "Data tidak ditemukan",
    message: "Dokumen atau permintaan tanda tangan tidak ditemukan.",
    retryable: false,
    accessDenied: false,
  },
  conflict: {
    title: "Permintaan bertentangan",
    message: "Dokumen ini sudah memiliki permintaan aktif atau statusnya tidak memungkinkan tindakan ini.",
    retryable: false,
    accessDenied: false,
  },
  "pdf-too-large": {
    title: "PDF terlalu besar",
    message: "Ukuran PDF melebihi batas 15 MB. Kecilkan berkas lalu coba lagi.",
    retryable: false,
    accessDenied: false,
  },
  "not-pdf": {
    title: "Format berkas salah",
    message: "Berkas yang dikirim harus berformat PDF.",
    retryable: false,
    accessDenied: false,
  },
  "invalid-document": {
    title: "Dokumen tidak valid",
    message: "Dokumen belum memenuhi syarat untuk ditandatangani.",
    retryable: false,
    accessDenied: false,
  },
  "rate-limit": {
    title: "Terlalu banyak permintaan",
    message: "Tunggu beberapa saat sebelum mencoba lagi.",
    retryable: true,
    accessDenied: false,
  },
  "provider-unavailable": {
    title: "Layanan penandatanganan tidak tersedia",
    message: "Provider tanda tangan belum dapat diakses. Coba beberapa saat lagi.",
    retryable: true,
    accessDenied: false,
  },
  "provider-timeout": {
    title: "Penandatanganan timeout",
    message: "Provider tanda tangan tidak merespons tepat waktu. Status dapat diperiksa ulang.",
    retryable: true,
    accessDenied: false,
  },
  backend: {
    title: "Gangguan layanan",
    message: "Terjadi kesalahan pada layanan. Coba beberapa saat lagi.",
    retryable: true,
    accessDenied: false,
  },
  "unsafe-link": {
    title: "Tautan berkas tidak aman",
    message: "Tautan berkas dari backend tidak aman atau tidak dapat digunakan. Unduhan dibatalkan.",
    retryable: false,
    accessDenied: false,
  },
  offline: {
    title: "Tidak ada koneksi",
    message: "Periksa koneksi jaringan Anda, lalu coba lagi.",
    retryable: true,
    accessDenied: false,
  },
  config: {
    title: "Konfigurasi belum lengkap",
    message: "Alamat API backend belum dikonfigurasi. Hubungi administrator sistem.",
    retryable: false,
    accessDenied: false,
  },
  unknown: {
    title: "Terjadi kesalahan",
    message: "Terjadi kesalahan tak terduga. Silakan coba lagi.",
    retryable: true,
    accessDenied: false,
  },
};

/** Status HTTP → kind TTE. 0 = network/offline. */
export function tteErrorKindForStatus(status: number): TteErrorKind {
  switch (status) {
    case 0:
      return "offline";
    case 400:
      return "payload";
    case 401:
      return "session";
    case 403:
      return "permission";
    case 404:
      return "not-found";
    case 409:
      return "conflict";
    case 413:
      return "pdf-too-large";
    case 415:
      return "not-pdf";
    case 422:
      return "invalid-document";
    case 429:
      return "rate-limit";
    case 502:
      return "provider-unavailable";
    case 504:
      return "provider-timeout";
    default:
      if (status >= 500) return "backend";
      return "unknown";
  }
}

function statusOf(error: unknown): number {
  if (error && typeof error === "object" && "status" in error) {
    const value = Number((error as { status?: unknown }).status);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

/**
 * Pesan konfigurasi dari api-client bersifat aman (ditulis frontend), sehingga
 * boleh diteruskan. Pesan lain dari backend sengaja diabaikan.
 */
function isSafeConfigMessage(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("message" in error)) return null;
  const message = (error as { message?: unknown }).message;
  if (typeof message !== "string") return null;
  return message.includes("NEXT_PUBLIC_API_URL") ? message : null;
}

export function mapTteError(error: unknown): TteErrorView {
  const status = statusOf(error);
  // Error spesifik adapter unduhan: pesannya aman dan ditulis frontend.
  if (
    error instanceof Error &&
    error.name === "UnsafeDocumentUrlError"
  ) {
    return { kind: "unsafe-link", status, ...VIEWS["unsafe-link"] };
  }
  const kind = tteErrorKindForStatus(status);
  const config = kind === "offline" ? isSafeConfigMessage(error) : null;
  return {
    kind: config ? "config" : kind,
    status,
    ...(config ? { ...VIEWS.config, message: config } : VIEWS[kind]),
  };
}
