import { describe, expect, it } from "vitest";
import {
  ACK_PERSISTENCE_NOTE,
  INITIAL_ACK_SESSION,
  ackButtonLabel,
  acknowledgeReducer,
  ackPersistenceNote,
  canSubmitAck,
  extractRestrictions,
  formatAckTimestamp,
  isClosedRestriction,
} from "@/lib/hse-acknowledgement";

/** Gap F2-A: unit test logika status UI acknowledgement HSE. */
describe("acknowledgeReducer", () => {
  it("tidak pernah menjadi acknowledged tanpa action success", () => {
    const states = [
      acknowledgeReducer(INITIAL_ACK_SESSION, { type: "submit" }),
      acknowledgeReducer(INITIAL_ACK_SESSION, { type: "failure", message: "x" }),
      acknowledgeReducer(INITIAL_ACK_SESSION, { type: "reset" }),
    ];
    for (const s of states) {
      expect(s.state).not.toBe("acknowledged");
    }
  });

  it("submit → submitting, success → acknowledged memakai timestamp dari backend", () => {
    const submitting = acknowledgeReducer(INITIAL_ACK_SESSION, { type: "submit" });
    expect(submitting.state).toBe("submitting");

    const done = acknowledgeReducer(submitting, {
      type: "success",
      acknowledgementId: "ack-1",
      acknowledgedAt: "2026-10-13T03:04:05.000Z",
    });
    expect(done.state).toBe("acknowledged");
    expect(done.acknowledgementId).toBe("ack-1");
    expect(done.acknowledgedAt).toBe("2026-10-13T03:04:05.000Z");
    expect(done.error).toBeNull();
  });

  it("success tanpa timestamp backend tidak mengarang waktu lokal", () => {
    const done = acknowledgeReducer(INITIAL_ACK_SESSION, { type: "success" });
    expect(done.acknowledgedAt).toBeNull();
  });

  it("double submit tidak menghasilkan state baru / request ganda", () => {
    const first = acknowledgeReducer(INITIAL_ACK_SESSION, { type: "submit" });
    const second = acknowledgeReducer(first, { type: "submit" });
    expect(second).toBe(first);
  });

  it("submit setelah acknowledged tidak mengubah status", () => {
    const done = acknowledgeReducer(INITIAL_ACK_SESSION, { type: "success" });
    expect(acknowledgeReducer(done, { type: "submit" })).toBe(done);
  });

  it("failure menyimpan pesan dan dapat dikirim ulang", () => {
    const failed = acknowledgeReducer(INITIAL_ACK_SESSION, { type: "failure", message: "Timeout" });
    expect(failed.state).toBe("failed");
    expect(failed.error).toBe("Timeout");
    expect(canSubmitAck(failed.state)).toBe(true);

    const retry = acknowledgeReducer(failed, { type: "submit" });
    expect(retry.state).toBe("submitting");
    expect(retry.error).toBeNull();
  });

  it("failure tanpa pesan memakai pesan default yang jelas", () => {
    expect(acknowledgeReducer(INITIAL_ACK_SESSION, { type: "failure", message: "" }).error).toBeTruthy();
  });

  it("reset mengembalikan state awal", () => {
    const done = acknowledgeReducer(INITIAL_ACK_SESSION, { type: "success", acknowledgedAt: "x" });
    expect(acknowledgeReducer(done, { type: "reset" })).toEqual(INITIAL_ACK_SESSION);
  });
});

describe("canSubmitAck / ackButtonLabel", () => {
  it("hanya boleh submit saat not-acknowledged atau failed", () => {
    expect(canSubmitAck("not-acknowledged")).toBe(true);
    expect(canSubmitAck("failed")).toBe(true);
    expect(canSubmitAck("submitting")).toBe(false);
    expect(canSubmitAck("acknowledged")).toBe(false);
    expect(canSubmitAck("not-available")).toBe(false);
  });

  it("label tombol mengikuti status", () => {
    expect(ackButtonLabel("not-acknowledged")).toBe("Acknowledge restriction");
    expect(ackButtonLabel("submitting")).toBe("Mengirim...");
    expect(ackButtonLabel("failed")).toBe("Coba kirim ulang");
    expect(ackButtonLabel("acknowledged")).toBe("Terkonfirmasi");
    expect(ackButtonLabel("not-available")).toBe("Tidak tersedia");
  });
});

describe("keterbatasan persistence (tidak boleh disembunyikan)", () => {
  it("menampilkan catatan keterbatasan bila status tidak dapat dibaca ulang", () => {
    expect(ackPersistenceNote(false)).toBe(ACK_PERSISTENCE_NOTE);
    expect(ACK_PERSISTENCE_NOTE).toMatch(/belum dapat diverifikasi oleh API/i);
    expect(ACK_PERSISTENCE_NOTE).toMatch(/sesi ini/i);
  });

  it("tidak menampilkan catatan bila backend memang menyediakan baca status", () => {
    expect(ackPersistenceNote(true)).toBeNull();
  });
});

describe("extractRestrictions", () => {
  const cycles = [
    {
      id: "c1",
      patient: { employee: { full_name: "Budi", employee_no: "EMP-1" } },
      ftw_assessment: {
        ftw_status: "FIT_WITH_RESTRICTION",
        restrictions: [
          { id: "r-late", description: "Hindari shift malam", review_date: "2027-01-10", status: "ACTIVE" },
          { id: "r-early", description: "Batasi angkat beban", review_date: "2026-12-01", status: "ACTIVE" },
          { id: "r-closed", description: "Sudah dicabut", review_date: "2026-01-01", status: "CLOSED" },
          { id: null, description: "tanpa id", review_date: "2026-02-02" },
        ],
      },
    },
    { id: "c2", ftw_assessment: { ftw_status: "FIT", restrictions: [] } },
    { id: "c3" },
  ];

  it("hanya restriksi aktif dan ber-id, terurut review date", () => {
    const items = extractRestrictions(cycles as never);
    expect(items.map((i) => i.id)).toEqual(["r-early", "r-late"]);
    expect(items[0].patientName).toBe("Budi");
    expect(items[0].employeeNo).toBe("EMP-1");
    expect(items[0].ftwStatus).toBe("FIT_WITH_RESTRICTION");
  });

  it("aman untuk input kosong/aneh (tidak crash)", () => {
    expect(extractRestrictions([])).toEqual([]);
    expect(extractRestrictions([null as never, {} as never])).toEqual([]);
  });

  it("deskripsi kosong diberi teks netral (tidak dikarang)", () => {
    const items = extractRestrictions([
      { id: "c", ftw_assessment: { restrictions: [{ id: "r1", description: "  " }] } },
    ] as never);
    expect(items[0].description).toMatch(/tanpa deskripsi dari API/i);
  });

  it("isClosedRestriction mengenali status penutupan", () => {
    expect(isClosedRestriction("CLOSED")).toBe(true);
    expect(isClosedRestriction("closed")).toBe(true);
    expect(isClosedRestriction("LIFTED")).toBe(true);
    expect(isClosedRestriction("ACTIVE")).toBe(false);
    expect(isClosedRestriction(null)).toBe(false);
  });
});

describe("formatAckTimestamp", () => {
  it("null/invalid → null (tidak menampilkan tanggal palsu)", () => {
    expect(formatAckTimestamp(null)).toBeNull();
    expect(formatAckTimestamp("")).toBeNull();
    expect(formatAckTimestamp("bukan-tanggal")).toBeNull();
  });

  it("timestamp valid diformat", () => {
    expect(formatAckTimestamp("2026-10-13T03:04:05.000Z")).toBeTruthy();
  });
});
