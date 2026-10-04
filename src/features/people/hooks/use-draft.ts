"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from "react";
import type { CreatePersonDraft } from "../api/people.types";
import { loadDraft, saveDraft, clearDraft } from "@/shared/storage/draft-storage";

interface UseDraftResult {
  draft: CreatePersonDraft | null;
  step: number;
  savedAt: string | null;
  hasSavedDraft: boolean;
  save: (data: CreatePersonDraft, step: number) => void;
  clear: () => void;
}

const EMPTY_DRAFT: CreatePersonDraft = {
  fullName: "",
  identifierType: "NIK",
  identifierValue: "",
  birthDate: "",
  sex: "MALE",
  employeeNo: "",
  organizationId: "",
  orgUnitId: "",
  siteId: "",
  jobTaskId: "",
  employmentStatus: "ACTIVE",
  joinDate: "",
  email: "",
  phone: "",
  emergencyContact: { name: "", relationship: "", phone: "" },
  documentIds: [],
  consentType: "EMR_DATA_PROCESSING",
  consentVersion: "1.0",
};

export function useDraft(): UseDraftResult {
  const [draft, setDraft] = useState<CreatePersonDraft | null>(null);
  const [step, setStep] = useState(1);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);

  useEffect(() => {
    const stored = loadDraft();
    if (stored) {
      setDraft(stored.data);
      setStep(stored.step);
      setSavedAt(stored.savedAt);
      setHasSavedDraft(true);
    }
  }, []);

  const save = useCallback((data: CreatePersonDraft, currentStep: number) => {
    saveDraft(data, currentStep);
    setDraft(data);
    setStep(currentStep);
    setSavedAt(new Date().toISOString());
    setHasSavedDraft(true);
  }, []);

  const clear = useCallback(() => {
    clearDraft();
    setDraft(null);
    setStep(1);
    setSavedAt(null);
    setHasSavedDraft(false);
  }, []);

  return { draft, step, savedAt, hasSavedDraft, save, clear };
}

export { EMPTY_DRAFT };
