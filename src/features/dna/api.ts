/**
 * A3 — Klien API modul D&A.
 *
 * Hanya memakai endpoint yang sudah ada di repo ini:
 *  - GET  /da/tests                          (daftar tes + sample + hasil + sertifikat)
 *  - POST /da/samples/:id/chain-of-custody   (tambah kejadian custody, append-only)
 *  - POST /da/tests/:id/results              (screening + confirmation test)
 *
 * `POST /da/tests/:id/certificate` TIDAK dipakai A3: penerbitan sertifikat
 * D&A adalah bagian alur tanda tangan (A4).
 */
import { daService, type BackendDaTest } from "@/lib/services/da.service";

export interface DnaTestQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  patientId?: string;
}

/** Ambil daftar tes D&A. */
export async function fetchDnaTests(query: DnaTestQuery = {}): Promise<BackendDaTest[]> {
  const res = await daService.getTests({
    page: query.page ?? 1,
    limit: query.limit ?? 100,
    status: query.status,
    patientId: query.patientId,
  });
  return res.data ?? [];
}

/** Tambahkan kejadian chain of custody (append-only). */
export async function appendCustodyEvent(
  sampleId: string,
  input: { fromParty: string; toParty: string; action: string }
): Promise<void> {
  await daService.addCustody(sampleId, input.fromParty, input.toParty, input.action);
}

/** Simpan hasil screening (dan konfirmasi bila ada). */
export async function submitDnaResult(
  testId: string,
  input: { screeningResult: string; confirmationResult?: string; confirmed?: boolean }
): Promise<void> {
  await daService.submitResults(
    testId,
    input.screeningResult,
    input.confirmationResult,
    input.confirmed
  );
}
