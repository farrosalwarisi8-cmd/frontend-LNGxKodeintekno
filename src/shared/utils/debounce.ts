/**
 * Fungsi debounce murni (bisa diuji di lingkungan node tanpa DOM).
 *
 * Panggilan berikutnya mereset timer; `func` hanya dieksekusi setelah
 * `waitMs` milidetik sejak panggilan terakhir.
 */
export function debounce<Args extends unknown[]>(
  func: (...args: Args) => void,
  waitMs: number
): { (...args: Args): void; cancel: () => void; flush: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Args | null = null;

  function debounced(...args: Args): void {
    lastArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const current = lastArgs;
      lastArgs = null;
      if (current) func(...current);
    }, waitMs);
  }

  debounced.cancel = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      lastArgs = null;
    }
  };

  debounced.flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      const current = lastArgs;
      lastArgs = [] as unknown as Args;
      if (current) func(...current);
    }
  };

  return debounced;
}
