"use client";

import { useState, useCallback } from "react";
import { patientService } from "@/lib/services/patient.service";

export function useDecideConsent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = useCallback(async (token: string, decision: "APPROVED" | "REJECTED") => {
    setLoading(true);
    setError(null);
    try {
      const result = await patientService.verifyConsent(token, decision === "APPROVED" ? "AGREED" : "DECLINED");
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Terjadi kesalahan.";
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  return { decide, loading, error };
}
