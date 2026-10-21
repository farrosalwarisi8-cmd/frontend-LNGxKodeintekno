import { describe, it, expect } from "vitest";
import { IMPORT_CONCURRENCY, runImport } from "../runner";

describe("runImport — pool konkurensi kecil", () => {
  it("mengirim semua baris dan menghitung progres", async () => {
    const items = [1, 2, 3, 4, 5];
    const seen: number[] = [];
    const progress: number[] = [];
    const result = await runImport(
      items,
      async (n) => {
        seen.push(n);
      },
      { onProgress: (done) => progress.push(done) }
    );
    expect(seen.sort()).toEqual(items);
    expect(result.succeeded).toHaveLength(5);
    expect(result.failed).toHaveLength(0);
    expect(result.total).toBe(5);
    expect(progress).toEqual([1, 2, 3, 4, 5]);
  });

  it("kegagalan per baris dikumpulkan dengan pesan, bukan menggugurkan batch", async () => {
    const result = await runImport(
      ["a", "b", "c"],
      async (item) => {
        if (item === "b") throw new Error("409 duplikat");
      },
      {}
    );
    expect(result.succeeded).toEqual(["a", "c"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({ item: "b", error: "409 duplikat" });
  });

  it("error non-Error tetap mendapat pesan default", async () => {
    const result = await runImport(["x"], async () => {
      throw "sekali-kali string";
    });
    expect(result.failed[0].error).toBe("Gagal mengirim baris.");
  });

  it("tidak pernah menjalankan lebih dari batas konkurensi sekaligus", async () => {
    let active = 0;
    let peak = 0;
    await runImport(
      Array.from({ length: 20 }, (_, i) => i),
      async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((r) => setTimeout(r, 1));
        active -= 1;
      },
      { concurrency: IMPORT_CONCURRENCY }
    );
    expect(peak).toBeLessThanOrEqual(IMPORT_CONCURRENCY);
    expect(peak).toBeGreaterThan(1);
  });

  it("daftar gagal siap dipakai untuk opsi ulang-hanya-gagal", async () => {
    const result = await runImport(
      [1, 2, 3],
      async (n) => {
        if (n % 2 === 0) throw new Error("boom");
      },
      {}
    );
    const retry = result.failed.map((f) => f.item);
    const second = await runImport(
      retry,
      async () => {
        /* ulang sukses */
      },
      {}
    );
    expect(retry).toEqual([2]);
    expect(second.succeeded).toEqual([2]);
    expect(second.failed).toHaveLength(0);
  });

  it("daftar kosong → hasil kosong tanpa pekerjaan", async () => {
    const result = await runImport([], async () => {
      throw new Error("tidak boleh dipanggil");
    });
    expect(result.total).toBe(0);
    expect(result.succeeded).toHaveLength(0);
  });
});
