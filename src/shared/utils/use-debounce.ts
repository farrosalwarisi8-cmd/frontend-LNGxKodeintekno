"use client";

import { useState, useEffect } from "react";

/**
 * Nilai debounce untuk input pencarian.
 *
 * Contoh:
 *   const debouncedSearch = useDebounce(search, 300);
 *   // gunakan debouncedSearch sebagai parameter query ke API
 */
export function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
