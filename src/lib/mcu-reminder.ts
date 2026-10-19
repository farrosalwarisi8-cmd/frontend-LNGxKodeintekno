/**
 * A1 (Tugas 2) — Tahapan reminder MCU & garis waktu eskalasi.
 *
 * Tahapan yang dipakai (proposal): H-30, H-14, H-7, hari berakhir (Hari-H),
 * lalu status overdue. Setiap tahap selalu disajikan sebagai TEKS + IKON —
 * tidak pernah hanya dengan warna (aksesibilitas).
 *
 * Tahap dihitung dari field `valid_until` yang dikirim backend pada siklus MCU
 * (`GET /mcu/cycles`). Backend belum menyediakan field "tahap reminder" atau
 * "level eskalasi" per record — lihat BLOCKER BACKEND di
 * LAPORAN_A1_STABILISASI_FASE2_4.md.
 */

/** Tahapan reminder yang memiliki label & ikon sendiri. */
export const REMINDER_STAGES = ["H-30", "H-14", "H-7", "HARI-H", "OVERDUE"] as const;

export type ReminderStage = (typeof REMINDER_STAGES)[number];

/** Seluruh kemungkinan status reminder sebuah record. */
export type ReminderStatus = ReminderStage | "AKTIF" | "TIDAK_DIKETAHUI";

/** Kunci ikon (dipetakan ke komponen lucide di lapisan UI). */
export type ReminderIcon = "bell" | "clock" | "alert" | "check" | "help";

export type ReminderTone = "info" | "warning" | "danger" | "success" | "muted";

export interface ReminderMeta {
  status: ReminderStatus;
  /** Label pendek yang selalu tampil (bukan hanya warna). */
  label: string;
  /** Penjelasan panjang (dipakai sebagai title/aria). */
  description: string;
  icon: ReminderIcon;
  tone: ReminderTone;
}

export interface ReminderState extends ReminderMeta {
  /** Sisa hari sampai tanggal berakhir (negatif = sudah lewat). */
  daysRemaining: number | null;
  /** Tanggal berakhir (YYYY-MM-DD) bila tersedia. */
  validUntil: string | null;
}

const META: Record<ReminderStatus, Omit<ReminderMeta, "status">> = {
  "H-30": {
    label: "H-30",
    description: "Tahap reminder H-30: batas waktu berakhir sudah masuk 30 hari.",
    icon: "bell",
    tone: "info",
  },
  "H-14": {
    label: "H-14",
    description: "Tahap reminder H-14: batas waktu berakhir sudah masuk 14 hari.",
    icon: "bell",
    tone: "info",
  },
  "H-7": {
    label: "H-7",
    description: "Tahap reminder H-7: batas waktu berakhir sudah masuk 7 hari.",
    icon: "clock",
    tone: "warning",
  },
  "HARI-H": {
    label: "Hari-H",
    description: "Hari-H: batas waktu berakhir adalah hari ini.",
    icon: "alert",
    tone: "danger",
  },
  OVERDUE: {
    label: "Overdue",
    description: "Status overdue: batas waktu berakhir sudah lewat.",
    icon: "alert",
    tone: "danger",
  },
  AKTIF: {
    label: "Aktif",
    description: "Masih berlaku dan belum masuk jadwal reminder.",
    icon: "check",
    tone: "success",
  },
  TIDAK_DIKETAHUI: {
    label: "Tanpa Tanggal",
    description: "Tanggal berakhir tidak tersedia sehingga tahap reminder tidak dapat dihitung.",
    icon: "help",
    tone: "muted",
  },
};

/** Ambil bagian tanggal (YYYY-MM-DD) dari berbagai format tanggal backend. */
function dateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Sisa hari (per hari kalender) sampai `validUntil`.
 * Negatif berarti tanggal sudah lewat. `null` bila tanggal tidak valid/tidak ada.
 */
export function daysUntil(validUntil: string | null | undefined, now: Date = new Date()): number | null {
  const target = dateOnly(validUntil);
  if (!target) return null;
  const base = startOfDay(now);
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

/** Tahap reminder untuk satu tanggal berakhir. */
export function reminderStatus(validUntil: string | null | undefined, now: Date = new Date()): ReminderStatus {
  const days = daysUntil(validUntil, now);
  if (days === null) return "TIDAK_DIKETAHUI";
  if (days < 0) return "OVERDUE";
  if (days === 0) return "HARI-H";
  if (days <= 7) return "H-7";
  if (days <= 14) return "H-14";
  if (days <= 30) return "H-30";
  return "AKTIF";
}

/** Status reminder lengkap (label, ikon, sisa hari). */
export function reminderState(
  validUntil: string | null | undefined,
  now: Date = new Date()
): ReminderState {
  const status = reminderStatus(validUntil, now);
  return {
    status,
    ...META[status],
    daysRemaining: daysUntil(validUntil, now),
    validUntil: validUntil ? validUntil.slice(0, 10) : null,
  };
}

export interface ReminderTimelineEntry {
  stage: ReminderStage;
  label: string;
  description: string;
  icon: ReminderIcon;
  tone: ReminderTone;
  /** Tahap ini sudah tercapai (sudah masuk/dilewati). */
  reached: boolean;
  /** Tahap ini adalah tahap saat record berada sekarang. */
  current: boolean;
}

/** Ambang hari untuk setiap tahap (H-30 = 30 hari, dan seterusnya). */
const THRESHOLD: Record<ReminderStage, number> = {
  "H-30": 30,
  "H-14": 14,
  "H-7": 7,
  "HARI-H": 0,
  OVERDUE: -1,
};

/**
 * Garis waktu tahapan reminder (H-30 → H-14 → H-7 → Hari-H → Overdue).
 *
 * `reached` menandai tahap yang sudah masuk; `current` menandai tahap aktif.
 */
export function reminderTimeline(
  validUntil: string | null | undefined,
  now: Date = new Date()
): ReminderTimelineEntry[] {
  const days = daysUntil(validUntil, now);
  const current = reminderStatus(validUntil, now);

  return REMINDER_STAGES.map((stage) => {
    const meta = META[stage];
    let reached = false;
    if (days !== null) {
      if (stage === "OVERDUE") reached = days < 0;
      else reached = days <= THRESHOLD[stage];
    }
    return {
      stage,
      label: meta.label,
      description: meta.description,
      icon: meta.icon,
      tone: meta.tone,
      reached,
      current: current === stage,
    };
  });
}

/** Ringkasan singkat untuk list/tabel (mis. "H-14 · 12 hari lagi"). */
export function reminderSummary(state: ReminderState): string {
  if (state.status === "TIDAK_DIKETAHUI") return state.label;
  if (state.daysRemaining === null) return state.label;
  if (state.daysRemaining < 0) {
    const late = Math.abs(state.daysRemaining);
    return `${state.label} · telat ${late} hari`;
  }
  if (state.daysRemaining === 0) return `${state.label} · hari ini`;
  return `${state.label} · ${state.daysRemaining} hari lagi`;
}
