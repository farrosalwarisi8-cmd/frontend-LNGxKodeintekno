"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ListPeopleParams, Paginated, PersonListItem } from "../api/people.types";
import { patientService } from "@/lib/services/patient.service";

interface UsePeopleResult {
  data: Paginated<PersonListItem> | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function usePeople(params: ListPeopleParams): UsePeopleResult {
  const [state, setState] = useState<{
    data: Paginated<PersonListItem> | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });
  const mountedRef = useRef(true);
  const paramsKey = JSON.stringify(params);

  const fetchPeople = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const result = await patientService.list(JSON.parse(paramsKey));
      if (mountedRef.current) {
        setState({ data: result, loading: false, error: null });
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
  }, [paramsKey]);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPeople();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchPeople]);

  return { ...state, refetch: fetchPeople };
}
