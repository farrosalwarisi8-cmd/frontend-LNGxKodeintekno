/**
 * Titik masuk tunggal data seed demo ke store.
 *
 * Pada build production/staging, `next.config.ts` meng-alias modul ini ke
 * `./demo-seed.production.ts` (semua koleksi kosong) sehingga `lib/seed.ts`
 * beserta seluruh data klinis fiktif TIDAK masuk ke bundel sama sekali.
 * Pada development modul ini meneruskan seed asli agar demo tetap berjalan.
 */
export * from "./seed"
