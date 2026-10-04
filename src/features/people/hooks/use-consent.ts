"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef, useCallback } from "react";
import type { ConsentEvent, PublicConsentView } from "../api/people.types";
import { peopleRepository } from "../api/people.repository";

export function useConsentByToken(token: string) {
  const [state, setState] = useState<{
    data: PublicConsentView | null;
    loading: boolean;
    error: string | null;
  }>({ data: null, loading: true, error: null });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    peopleRepository
      .getConsentByToken(token)
      .then((view) => {
        if (mountedRef.current) {
          setState({ data: view, loading: false, error: null });
        }
      })
      .catch((e) => {
        if (mountedRef.current) {
          setState({
            data: null,
            loading: false,
            error: e instanceof Error ? e.message : "Terjadi kesalahan.",
          });
        }
      });

    return () => {
      mountedRef.current = false;
    };
  }, [token]);

  return state;
}

export function useConsentEvents(consentId: string) {
  const [state, setState] = useState<{
    data: ConsentEvent[];
    loading: boolean;
    error: string | null;
  }>({ data: [], loading: true, error: null });
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!consentId) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    mountedRef.current = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    peopleRepository
      .getConsentEvents(consentId)
      .then((events) => {
        if (mountedRef.current) {
          setState({ data: events, loading: false, error: null });
        }
      })
      .catch((e) => {
        if (mountedRef.current) {
          setState({
            data: [],
            loading: false,
            error: e instanceof Error ? e.message : "Terjadi kesalahan.",
          });
        }
      });

    return () => {
      mountedRef.current = false;
    };
  }, [consentId]);

  return state;
}

export function useDecideConsent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const decide = useCallback(async (token: string, decision: "APPROVED" | "REJECTED") => {
    setLoading(true);
    setError(null);
    try {
      const result = await peopleRepository.decideConsent(token, decision);
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
