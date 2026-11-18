/**
 * Satu-satunya pemetaan status signature_request untuk UI TTE.
 *
 * Sumber kontrak: OpenAPI backend (snapshot Fase 6, `tmp2/openapi.json`) dan
 * `POST /api/v1/signatures/request` (RequestSignatureDto). Backend belum
 * mengirim `CANCELLED`; status itu ditangani secara defensif sebagai terminal,
 * BUKAN diubah menjadi SIGNED. Status yang tidak dikenal jatuh ke fallback aman.
 */

export const KNOWN_SIGNATURE_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SIGNED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
] as const;

export type KnownSignatureStatus = (typeof KNOWN_SIGNATURE_STATUSES)[number];

export const UNKNOWN_STATUS_MESSAGE = "Status tidak dikenali — hubungi administrator";

export type StatusVariant = "success" | "danger" | "warning" | "info" | "default";

export interface SignatureStatusView {
  /** Status mentah dari backend (uppercase), atau "" bila tidak ada. */
  status: string;
  /** Label aman untuk ditampilkan. Tidak pernah mengarang status baru. */
  label: string;
  variant: StatusVariant;
  /** Status aktif = boleh dipoll. Hanya PENDING/PROCESSING. */
  isActive: boolean;
  isTerminal: boolean;
  /** Hanya true untuk status SIGNED yang benar-benar diterima backend. */
  isSigned: boolean;
  /** Retry hanya untuk status yang memang boleh diulang. */
  canRetry: boolean;
  /** Download hanya untuk status SIGNED (atau izin eksplisit backend). */
  canDownload: boolean;
  known: boolean;
}

const VIEWS: Record<KnownSignatureStatus, Omit<SignatureStatusView, "status" | "known">> = {
  PENDING: {
    label: "Menunggu provider",
    variant: "warning",
    isActive: true,
    isTerminal: false,
    isSigned: false,
    canRetry: false,
    canDownload: false,
  },
  PROCESSING: {
    label: "Diproses provider",
    variant: "info",
    isActive: true,
    isTerminal: false,
    isSigned: false,
    canRetry: false,
    canDownload: false,
  },
  SIGNED: {
    label: "Tertandatangani",
    variant: "success",
    isActive: false,
    isTerminal: true,
    isSigned: true,
    canRetry: false,
    canDownload: true,
  },
  FAILED: {
    label: "Gagal",
    variant: "danger",
    isActive: false,
    isTerminal: true,
    isSigned: false,
    canRetry: true,
    canDownload: false,
  },
  EXPIRED: {
    label: "Kedaluwarsa",
    variant: "danger",
    isActive: false,
    isTerminal: true,
    isSigned: false,
    canRetry: true,
    canDownload: false,
  },
  CANCELLED: {
    label: "Dibatalkan",
    variant: "default",
    isActive: false,
    isTerminal: true,
    isSigned: false,
    canRetry: false,
    canDownload: false,
  },
};

const UNKNOWN_VIEW: Omit<SignatureStatusView, "status" | "known"> = {
  label: UNKNOWN_STATUS_MESSAGE,
  variant: "default",
  isActive: false,
  isTerminal: true,
  isSigned: false,
  canRetry: false,
  canDownload: false,
};

export function normalizeStatus(raw: string | null | undefined): string {
  return typeof raw === "string" ? raw.trim().toUpperCase() : "";
}

export function isKnownSignatureStatus(raw: string | null | undefined): raw is KnownSignatureStatus {
  const status = normalizeStatus(raw);
  return (KNOWN_SIGNATURE_STATUSES as readonly string[]).includes(status);
}

export function mapSignatureStatus(raw: string | null | undefined): SignatureStatusView {
  const status = normalizeStatus(raw);
  const known = isKnownSignatureStatus(status);
  return { status, known, ...(known ? VIEWS[status] : UNKNOWN_VIEW) };
}

/** True bila salah satu status masih aktif (PENDING/PROCESSING). */
export function hasActiveSignatureStatus(statuses: readonly (string | null | undefined)[]): boolean {
  return statuses.some((status) => mapSignatureStatus(status).isActive);
}

/** Semua status terminal boleh menghentikan polling. */
export function allStatusesTerminal(statuses: readonly (string | null | undefined)[]): boolean {
  return statuses.every((status) => mapSignatureStatus(status).isTerminal);
}
