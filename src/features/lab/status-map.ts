/**
 * Pemetaan status laboratorium & radiologi — Fase A2.
 *
 * ATURAN: setiap label berasal dari nilai status yang dikembalikan API
 * (enum backend `LabOrderStatus` / `RecordStatus` / `RadiologyOrderStatus`
 * terlihat di kontrak: ORDERED, SAMPLE_COLLECTED, IN_ANALYSIS, COMPLETED,
 * CANCELLED; DRAFT, FINAL, LOCKED, AMENDED, VOID; IMAGE_CAPTURED,
 * READING_PENDING). Nilai yang tidak dikenal TIDAK ditebak: ditampilkan
 * apa adanya dengan variant netral, sehingga UI tidak pernah mengklaim
 * status yang bukan milik data.
 */

import type { BadgeProps } from "@/shared/components/design-system/badge";

export type StatusTone = NonNullable<BadgeProps["variant"]>;

export interface StatusInfo {
  /** Kunci stabil (untuk filter & test). */
  key: string;
  /** Label tampilan Bahasa Indonesia. */
  label: string;
  variant: StatusTone;
  /** Nama ikon lucide yang dipetakan komponen badge (bukan warna saja). */
  icon: "clock" | "sample" | "flask" | "check" | "lock" | "ban" | "file" | "draft";
}

const ORDERED: StatusInfo = {
  key: "ORDERED",
  label: "Menunggu sampel",
  variant: "warning",
  icon: "clock",
};
const SAMPLE_COLLECTED: StatusInfo = {
  key: "SAMPLE_COLLECTED",
  label: "Sampel diterima",
  variant: "info",
  icon: "sample",
};
const IN_ANALYSIS: StatusInfo = {
  key: "IN_ANALYSIS",
  label: "Sedang dianalisis",
  variant: "info",
  icon: "flask",
};
const COMPLETED: StatusInfo = {
  key: "COMPLETED",
  label: "Hasil diinput",
  variant: "success",
  icon: "check",
};
const CANCELLED: StatusInfo = {
  key: "CANCELLED",
  label: "Dibatalkan",
  variant: "danger",
  icon: "ban",
};

function normalize(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

/** Status order lab (enum `LabOrderStatus` backend). */
export function labOrderStatusInfo(raw: string | null | undefined): StatusInfo {
  switch (normalize(raw)) {
    case "ORDERED":
      return ORDERED;
    case "SAMPLE_COLLECTED":
      return SAMPLE_COLLECTED;
    case "IN_ANALYSIS":
      return IN_ANALYSIS;
    case "COMPLETED":
      return COMPLETED;
    case "CANCELLED":
      return CANCELLED;
    default:
      return unknownStatus(raw);
  }
}

/** Status order radiologi (enum `RadiologyOrderStatus` backend). */
export function radiologyOrderStatusInfo(raw: string | null | undefined): StatusInfo {
  switch (normalize(raw)) {
    case "ORDERED":
      return { key: "ORDERED", label: "Menunggu pemeriksaan", variant: "warning", icon: "clock" };
    case "IMAGE_CAPTURED":
      return { key: "IMAGE_CAPTURED", label: "Gambar diambil", variant: "info", icon: "file" };
    case "READING_PENDING":
      return { key: "READING_PENDING", label: "Menunggu pembacaan", variant: "warning", icon: "clock" };
    case "COMPLETED":
      return { key: "COMPLETED", label: "Laporan selesai", variant: "success", icon: "check" };
    case "CANCELLED":
      return CANCELLED;
    default:
      return unknownStatus(raw);
  }
}

/**
 * Status hasil lab (enum `RecordStatus` backend) + status verifikasi.
 *
 * Kontrak "Terverifikasi, menunggu tanda tangan": `verified_at` terisi pada
 * hasil (diisi oleh endpoint verify) → hasil terverifikasi. TTE tersertifikasi
 * adalah Fase A4 — di sini status berhenti di "menunggu tanda tangan".
 */
export function labResultStatusInfo(
  rawStatus: string | null | undefined,
  verifiedAt?: string | null
): StatusInfo {
  if (verifiedAt) {
    return {
      key: "VERIFIED_PENDING_SIGNATURE",
      label: "Terverifikasi, menunggu tanda tangan",
      variant: "info",
      icon: "check",
    };
  }
  switch (normalize(rawStatus)) {
    case "DRAFT":
      return { key: "DRAFT", label: "Draf hasil", variant: "default", icon: "draft" };
    case "FINAL":
      return { key: "FINAL", label: "Hasil diinput", variant: "success", icon: "check" };
    case "LOCKED":
      return { key: "LOCKED", label: "Terkunci", variant: "info", icon: "lock" };
    case "AMENDED":
      return { key: "AMENDED", label: "Lewat addendum", variant: "info", icon: "file" };
    case "VOID":
      return VOID_STATUS;
    default:
      return unknownStatus(rawStatus);
  }
}

const VOID_STATUS: StatusInfo = {
  key: "VOID",
  label: "Dibatalkan",
  variant: "danger",
  icon: "ban",
};

function unknownStatus(raw: string | null | undefined): StatusInfo {
  const value = (raw ?? "").trim();
  return {
    key: value || "UNKNOWN",
    label: value ? `Status: ${value}` : "Status tidak diketahui",
    variant: "default",
    icon: "draft",
  };
}

/** Status item order (string bebas di backend, default "PENDING"). */
export function labItemStatusInfo(raw: string | null | undefined): StatusInfo {
  const normalized = normalize(raw);
  if (!normalized || normalized === "PENDING") {
    return { key: "PENDING", label: "Menunggu hasil", variant: "warning", icon: "clock" };
  }
  if (normalized === "COMPLETED") return COMPLETED;
  if (normalized === "IN_ANALYSIS") return IN_ANALYSIS;
  if (normalized === "CANCELLED") return CANCELLED;
  return unknownStatus(raw);
}

/** Pilihan status untuk filter daftar order (nilai = kunci dari API). */
export const LAB_ORDER_STATUS_FILTERS: readonly { value: string; label: string }[] = [
  { value: "ORDERED", label: "Menunggu sampel" },
  { value: "SAMPLE_COLLECTED", label: "Sampel diterima" },
  { value: "IN_ANALYSIS", label: "Sedang dianalisis" },
  { value: "COMPLETED", label: "Hasil diinput" },
  { value: "CANCELLED", label: "Dibatalkan" },
];

export const RADIOLOGY_ORDER_STATUS_FILTERS: readonly { value: string; label: string }[] = [
  { value: "ORDERED", label: "Menunggu pemeriksaan" },
  { value: "IMAGE_CAPTURED", label: "Gambar diambil" },
  { value: "READING_PENDING", label: "Menunggu pembacaan" },
  { value: "COMPLETED", label: "Laporan selesai" },
  { value: "CANCELLED", label: "Dibatalkan" },
];
