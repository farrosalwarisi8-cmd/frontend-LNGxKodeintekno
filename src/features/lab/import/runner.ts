/**
 * Pengirim baris impor — Fase A2 (Tugas 4).
 *
 * Kontrak TIDAK menyediakan endpoint massal untuk hasil lab, jadi baris
 * dikirim SATU PER SATU lewat `POST /diagnostic/lab-results` dengan pool
 * konkurensi kecil (default 3), progres, ringkasan sukses/gagal, dan opsi
 * mengulang HANYA baris yang gagal.
 */

export const IMPORT_CONCURRENCY = 3;

export interface ImportRunResult<T> {
  succeeded: T[];
  failed: Array<{ item: T; error: string }>;
  /** Total baris yang diproses. */
  total: number;
}

export async function runImport<T>(
  items: T[],
  send: (item: T) => Promise<void>,
  options: {
    concurrency?: number;
    onProgress?: (done: number, total: number) => void;
  } = {}
): Promise<ImportRunResult<T>> {
  const concurrency = Math.max(1, options.concurrency ?? IMPORT_CONCURRENCY);
  const queue = [...items];
  const succeeded: T[] = [];
  const failed: Array<{ item: T; error: string }> = [];
  const total = items.length;
  let done = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const item = queue.shift();
      if (item === undefined) return;
      try {
        await send(item);
        succeeded.push(item);
      } catch (e) {
        failed.push({ item, error: e instanceof Error ? e.message : "Gagal mengirim baris." });
      }
      done += 1;
      options.onProgress?.(done, total);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  return { succeeded, failed, total };
}
