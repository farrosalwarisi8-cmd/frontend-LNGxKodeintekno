/**
 * Pemetaan error HTTP/network → UI frontend.
 *
 * Dipakai oleh `api-client` (pesan default) dan oleh halaman/komponen yang
 * perlu memutuskan *tampilan* (retry? bersihkan sesi? AccessDenied? ErrorState?).
 *
 * Gap yang ditutup (F1-E / F2-F):
 *  - 401 → sesi dibersihkan + arahkan login (ditangani api-client) dan pesan netral
 *  - 403 → AccessDenied
 *  - 404 → ErrorState
 *  - 409 / 422 / 400 → pesan field/modal
 *  - 429 → rate limit (dapat dicoba ulang)
 *  - 500 / 503 → "server tidak tersedia" (dapat dicoba ulang)
 *  - network/offline/timeout → pesan koneksi (dapat dicoba ulang)
 *
 * Tidak ada stack trace, nama tabel, atau detail internal yang ditampilkan.
 */

export type ErrorKind =
  | "config"
  | "offline"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "conflict"
  | "validation"
  | "rate-limit"
  | "server"
  | "unavailable"
  | "unknown";

export interface MappedError {
  kind: ErrorKind;
  status: number;
  /** Judul singkat untuk ErrorState/heading. */
  title: string;
  /** Pesan netral (backend dipakai bila tersedia & aman). */
  message: string;
  /** Aman untuk dicoba ulang tanpa efek samping. */
  retryable: boolean;
  /** UI harus membersihkan sesi + mengarahkan ke login. */
  clearSession: boolean;
}

const DEFAULTS: Record<ErrorKind, { title: string; message: string; retryable: boolean; clearSession: boolean }> = {
  config: {
    title: "Konfigurasi aplikasi belum lengkap",
    message:
      "Alamat API backend belum dikonfigurasi pada build ini. Hubungi administrator sistem.",
    retryable: false,
    clearSession: false,
  },
  offline: {
    title: "Tidak dapat terhubung ke server",
    message: "Periksa koneksi jaringan Anda, lalu coba lagi.",
    retryable: true,
    clearSession: false,
  },
  unauthorized: {
    title: "Sesi telah berakhir",
    message: "Silakan login kembali untuk melanjutkan.",
    retryable: false,
    clearSession: true,
  },
  forbidden: {
    title: "Akses terbatas",
    message: "Anda tidak memiliki izin untuk tindakan ini.",
    retryable: false,
    clearSession: false,
  },
  "not-found": {
    title: "Data tidak ditemukan",
    message: "Data yang Anda cari tidak tersedia atau sudah dihapus.",
    retryable: false,
    clearSession: false,
  },
  conflict: {
    title: "Data sudah ada",
    message: "Data ini bertentangan dengan data yang sudah tersimpan.",
    retryable: false,
    clearSession: false,
  },
  validation: {
    title: "Data belum valid",
    message: "Periksa kembali isian Anda.",
    retryable: false,
    clearSession: false,
  },
  "rate-limit": {
    title: "Terlalu banyak permintaan",
    message: "Tunggu beberapa saat sebelum mencoba lagi.",
    retryable: true,
    clearSession: false,
  },
  server: {
    title: "Server sedang bermasalah",
    message: "Terjadi kesalahan pada server. Coba beberapa saat lagi.",
    retryable: true,
    clearSession: false,
  },
  unavailable: {
    title: "Layanan tidak tersedia",
    message: "Server tidak dapat melayani permintaan saat ini. Coba beberapa saat lagi.",
    retryable: true,
    clearSession: false,
  },
  unknown: {
    title: "Terjadi kesalahan",
    message: "Terjadi kesalahan tak terduga. Silakan coba lagi.",
    retryable: true,
    clearSession: false,
  },
};

export function errorKindForStatus(status: number): ErrorKind {
  switch (status) {
    case 0:
      return "offline";
    case 400:
    case 422:
      return "validation";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not-found";
    case 409:
      return "conflict";
    case 429:
      return "rate-limit";
    case 500:
    case 502:
    case 504:
      return "server";
    case 503:
      return "unavailable";
    default:
      if (status >= 500) return "server";
      if (status >= 400) return "unknown";
      return "unknown";
  }
}

/**
 * Memetakan status + pesan backend menjadi UI state.
 * Pesan backend dipakai bila ada (pesan validasi/konflik memang informatif),
 * selain itu dipakai pesan netral.
 */
export function mapApiError(
  status: number,
  backendMessage?: string | null,
  options: { configError?: string | null } = {}
): MappedError {
  const kind: ErrorKind = status === 0 && options.configError ? "config" : errorKindForStatus(status);
  const base = DEFAULTS[kind];
  const message = options.configError
    ? options.configError
    : backendMessage && backendMessage.trim()
      ? backendMessage.trim()
      : base.message;
  return { kind, status, title: base.title, message, retryable: base.retryable, clearSession: base.clearSession };
}

/** Pesan aman untuk ditampilkan (tanpa stack trace / detail internal). */
export function safeErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "status" in error) {
    const status = Number((error as { status?: unknown }).status ?? 0);
    const message = (error as { message?: unknown }).message;
    return mapApiError(status, typeof message === "string" ? message : null).message;
  }
  if (error instanceof Error && error.message) return error.message;
  return DEFAULTS.unknown.message;
}
