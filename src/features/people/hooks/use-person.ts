"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Person } from "../api/people.types";
import { patientService } from "@/lib/services/patient.service";

interface UsePersonResult {
  data: Person | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePerson(patientId: string): UsePersonResult {
  const [state, setState] = useState<{
    data: Person | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });
  const mountedRef = useRef(true);

  const fetchPerson = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const person = await patientService.getProfile(patientId);
      if (mountedRef.current) {
        setState({ data: person, loading: false, error: null });
      }
    } catch (e) {
      if (mountedRef.current) {
        setState({
          data: null,
          loading: false,
          error: e instanceof Error ? e.message : "Terjadi kesalahan.",
        });
      }
    }
  }, [patientId]);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPerson();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchPerson]);

  return { ...state, refetch: fetchPerson };
}
