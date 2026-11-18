/**
 * Klasifikasi state verifikasi publik `/verify/[token]`.
 *
 * BACKEND CONTRACT: `GET /public/verify/:qrToken` mengembalikan
 * `{ isValid, status, documentType?, documentNumber?, issuedAt?, signedAt?,
 *   certificateSerial? }` dengan status yang teramati: VERIFIED, NOT_SIGNED,
 * INVALID, INVALID_OR_EXPIRED. Backend belum memisahkan status EXPIRED dan
 * REVOKED, jadi UI TIDAK boleh mengarang keduanya: INVALID_OR_EXPIRED tampil
 * sebagai state gabungan yang jujur. Mapping EXPIRED/REVOKED disiapkan bila
 * backend kelak mengirimkannya (defensif, bukan klaim kontrak saat ini).
 *
 * Tidak ada data klinis, token mentah, atau status internal yang ditampilkan.
 */

export type VerifyUiState =
  | "valid"
  | "found-unsigned"
  | "invalid"
  | "expired"
  | "revoked"
  | "expired-or-invalid"
  | "backend-error"
  | "empty";

export interface VerifyViewState {
  state: VerifyUiState;
  title: string;
  description: string;
  hint: string;
  /** Hanya true untuk state "valid" — dipakai untuk merender detail. */
  showAsValid: boolean;
  /** Status backend mentah dipakai hanya untuk badge, bukan penentu validitas. */
  statusLabel: string | null;
}

interface VerifyLike {
  isValid?: boolean;
  status?: string | null;
}

const VIEWS: Record<VerifyUiState, Omit<VerifyViewState, "state" | "statusLabel">> = {
  valid: {
    title: "Dokumen terverifikasi",
    description: "Dokumen ini memiliki tanda tangan elektronik yang tervalidasi.",
    hint: "Anda dapat mencetak halaman ini sebagai bukti verifikasi.",
    showAsValid: true,
  },
  "found-unsigned": {
    title: "Dokumen ditemukan, belum ditandatangani",
    description: "Dokumen terdaftar, tetapi belum memiliki tanda tangan elektronik yang tervalidasi.",
    hint: "Minta dokumen bertanda tangan resmi dari klinik penerbit.",
    showAsValid: false,
  },
  invalid: {
    title: "Sertifikat tidak valid",
    description: "Token tidak dikenali atau tidak cocok dengan data penerbit.",
    hint: "Minta tautan baru dari klinik penerbit bila diperlukan.",
    showAsValid: false,
  },
  expired: {
    title: "Sertifikat kedaluwarsa",
    description: "Masa berlaku tautan verifikasi sudah berakhir.",
    hint: "Minta tautan baru dari klinik penerbit.",
    showAsValid: false,
  },
  revoked: {
    title: "Sertifikat dicabut",
    description: "Dokumen ini sudah dicabut atau dibatalkan penerbitnya.",
    hint: "Hubungi klinik penerbit untuk informasi lebih lanjut.",
    showAsValid: false,
  },
  "expired-or-invalid": {
    title: "Tautan tidak valid atau kedaluwarsa",
    description: "Backend belum memisahkan status kedaluwarsa dan tidak valid untuk token ini.",
    hint: "Minta tautan baru dari klinik penerbit bila diperlukan.",
    showAsValid: false,
  },
  "backend-error": {
    title: "Tidak dapat memverifikasi",
    description: "Layanan verifikasi belum dapat dihubungi.",
    hint: "Periksa koneksi Anda lalu muat ulang halaman, atau minta tautan baru dari klinik.",
    showAsValid: false,
  },
  empty: {
    title: "Token verifikasi tidak ada",
    description: "Tautan verifikasi tidak lengkap.",
    hint: "Minta tautan verifikasi yang lengkap dari klinik penerbit.",
    showAsValid: false,
  },
};

export function normalizeVerifyStatus(raw: string | null | undefined): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

/**
 * Status backend hanya dipakai sebagai label. Validitas ditentukan oleh
 * kombinasi `isValid === true` DAN status VERIFIED — bukan oleh salah satunya.
 */
export function classifyVerifyResult(
  result: VerifyLike | null | undefined,
  options: { hasError?: boolean; hasToken?: boolean } = { hasToken: true }
): VerifyViewState {
  if (!options.hasToken) return { state: "empty", ...VIEWS.empty, statusLabel: null };
  if (!result) {
    return {
      state: options.hasError ? "backend-error" : "backend-error",
      ...VIEWS["backend-error"],
      statusLabel: null,
    };
  }

  const status = normalizeVerifyStatus(result.status);
  const statusLabel = status || null;
  const view = (state: VerifyUiState): VerifyViewState => ({ state, ...VIEWS[state], statusLabel });

  const isValid = result.isValid === true;
  if (status === "VERIFIED") return view(isValid ? "valid" : "invalid");
  if (status === "NOT_SIGNED") return view("found-unsigned");
  if (status === "EXPIRED") return view("expired");
  if (status === "REVOKED" || status === "VOID" || status === "CANCELLED") return view("revoked");
  if (status === "INVALID_OR_EXPIRED") return view("expired-or-invalid");
  if (status === "INVALID") return view("invalid");
  // Status tidak dikenali: jangan pernah jadikan valid hanya karena flag isValid.
  return view("invalid");
}

/**
 * Decode token dari param rute Next.js. `decodeURIComponent` bisa melempar
 * pada URI malformed — jangan sampai menabrak error boundary publik.
 */
export function decodeVerifyToken(raw: string | null | undefined): string {
  if (typeof raw !== "string" || !raw) return "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return "";
  }
}

/** Token ditampilkan paling banyak 8 karakter bila diperlukan untuk diagnosis UI. */
export function maskVerifyToken(token: string): string {
  if (!token) return "";
  const prefix = token.slice(0, 8);
  return token.length > 8 ? `${prefix}…` : prefix;
}
