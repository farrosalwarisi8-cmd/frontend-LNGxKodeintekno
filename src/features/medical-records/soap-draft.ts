/**
 * Autosave draft SOAP (lokal).
 *
 * Dokter sering harus keluar dari form (pasien lain, telepon, sinyal hilang)
 * sebelum menekan "Simpan SOAP". Draft disimpan per kunjungan supaya mengetik
 * ulang tidak pernah diperlukan, dan TIDAK pernah dianggap sebagai data
 * tersimpan di backend — begitu penyimpanan resmi berhasil, draft dibuang.
 */

export interface SoapDraft {
  visitId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  diagnosisIds: string[];
  savedAt: string;
}

const PREFIX = "emr-soap-draft:";

export function soapDraftKey(visitId: string): string {
  return `${PREFIX}${visitId}`;
}

export function parseSoapDraft(raw: string | null | undefined): SoapDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const d = parsed as Record<string, unknown>;
    if (typeof d.visitId !== "string" || typeof d.savedAt !== "string") return null;
    const asString = (v: unknown) => (typeof v === "string" ? v : "");
    return {
      visitId: d.visitId,
      subjective: asString(d.subjective),
      objective: asString(d.objective),
      assessment: asString(d.assessment),
      plan: asString(d.plan),
      diagnosisIds: Array.isArray(d.diagnosisIds)
        ? d.diagnosisIds.filter((x): x is string => typeof x === "string")
        : [],
      savedAt: d.savedAt,
    };
  } catch {
    return null;
  }
}

export function serializeSoapDraft(draft: SoapDraft): string {
  return JSON.stringify(draft);
}

/** Draft tanpa isi apa pun tidak perlu disimpan. */
export function isSoapDraftEmpty(
  draft: Pick<
    SoapDraft,
    "subjective" | "objective" | "assessment" | "plan" | "diagnosisIds"
  >
): boolean {
  return (
    !draft.subjective.trim() &&
    !draft.objective.trim() &&
    !draft.assessment.trim() &&
    !draft.plan.trim() &&
    draft.diagnosisIds.length === 0
  );
}

/** Status singkat untuk ditampilkan di form. */
export function soapDraftLabel(savedAt: string | null): string {
  if (!savedAt) return "Draft tersimpan otomatis";
  const time = new Date(savedAt).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Draft tersimpan otomatis ${time}`;
}
