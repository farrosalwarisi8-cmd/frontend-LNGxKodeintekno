import type { CreatePersonDraft } from "@/features/people/api/people.types";

const DRAFT_KEY = "emr-registration-draft";

export interface StoredDraft {
  data: CreatePersonDraft;
  savedAt: string;
  step: number;
}

export function saveDraft(data: CreatePersonDraft, step: number): void {
  if (typeof window === "undefined") return;
  const draft: StoredDraft = {
    data,
    savedAt: new Date().toISOString(),
    step,
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

export function loadDraft(): StoredDraft | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredDraft;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
}

export function hasDraft(): boolean {
  return loadDraft() !== null;
}
