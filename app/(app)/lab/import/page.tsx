"use client";

/**
 * Impor hasil lab (CSV) — Fase A2 (Tugas 4).
 *
 * Alur: pilih berkas → parse di browser (papaparse lazy) → validasi per
 * baris → pratinjau (valid & error) → kirim per baris (pool konkurensi
 * kecil) → ringkasan sukses/gagal + ulang hanya baris gagal.
 *
 * Keamanan: batas ukuran/baris, tanpa dangerouslySetInnerHTML, laporan
 * kesalahan menetralkan sel berpotensi formula, dan baris yang tidak
 * cocok ke order ditandai — tidak pernah ditebak.
 */

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/shared/components/design-system/button";
import { Card } from "@/shared/components/design-system/card";
import { Input } from "@/shared/components/design-system/input";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { useStore } from "@/lib/store";
import { diagnosticService } from "@/lib/services/diagnostic.service";
import {
  MAX_FILE_BYTES,
  MAX_ROWS,
  buildTemplateCsv,
  downloadTextFile,
  parseImportFile,
  type RawImportRow,
} from "@/features/lab/import/parsing";
import {
  buildErrorReportCsv,
  validateImportRows,
  type ValidImportRow,
} from "@/features/lab/import/validation";
import { runImport, IMPORT_CONCURRENCY } from "@/features/lab/import/runner";
import { useLabWorkspace } from "@/features/lab/api";

type Step = "pick" | "preview" | "sending" | "summary";

export default function LabImportPage() {
  const isOnline = useStore((s) => s.isOnline);
  const workspace = useLabWorkspace();
  const orders = useMemo(() => workspace.data?.orders ?? [], [workspace.data]);

  const [step, setStep] = useState<Step>("pick");
  const [fileError, setFileError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [rows, setRows] = useState<RawImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [summary, setSummary] = useState<{
    succeeded: ValidImportRow[];
    failed: Array<{ item: ValidImportRow; error: string }>;
  } | null>(null);
  const [sendingError, setSendingError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validation = useMemo(
    () => (rows.length > 0 ? validateImportRows(rows, orders) : null),
    [rows, orders]
  );

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    setFileError(null);
    setSummary(null);
    setParsing(true);
    try {
      const parsed = await parseImportFile(file);
      setRows(parsed);
      setFileName(file.name);
      setStep("preview");
    } catch (e) {
      setRows([]);
      setFileError(e instanceof Error ? e.message : "Gagal membaca berkas.");
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadTemplate = () => {
    const { csv, rowCount } = buildTemplateCsv(orders);
    downloadTextFile("template-impor-hasil-lab.csv", csv);
    if (rowCount === 0) {
      // Template tanpa baris data — dikatakan apa adanya ke pengguna.
      setFileError(
        "Template hanya berisi baris judul: daftar order/jenis tes belum dimuat " +
          "(katalog tes global tidak tersedia dari API — lihat laporan A2)."
      );
    }
  };

  const sendRows = async (targets: ValidImportRow[]) => {
    if (!isOnline) {
      setSendingError("Anda sedang offline. Impor dibatalkan — periksa koneksi lalu ulangi.");
      setStep("summary");
      return;
    }
    setStep("sending");
    setSendingError(null);
    setProgress({ done: 0, total: targets.length });
    const result = await runImport(
      targets,
      async (row) => {
        await diagnosticService.submitLabResult({
          labOrderItemId: row.labOrderItemId,
          values: [
            {
              parameterName: row.parameterName,
              ...(row.numericValue !== undefined
                ? { numericValue: row.numericValue }
                : { textValue: row.textValue ?? "" }),
              ...(row.unit ? { unit: row.unit } : {}),
            },
          ],
        });
      },
      {
        concurrency: IMPORT_CONCURRENCY,
        onProgress: (done, total) => setProgress({ done, total }),
      }
    );
    setSummary({ succeeded: result.succeeded, failed: result.failed });
    setStep("summary");
    workspace.reload();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/lab"
          className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label="Kembali ke daftar order lab"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Impor hasil lab (CSV)</h1>
          <p className="text-sm text-slate-500">
            Parsing di browser · maksimal {Math.round(MAX_FILE_BYTES / 1024)} KB dan {MAX_ROWS}{" "}
            baris per berkas
          </p>
        </div>
      </div>

      {step === "pick" && (
        <Card className="space-y-4 p-5">
          <div className="space-y-2">
            <Input
              ref={fileInputRef}
              id="import-file"
              label="Pilih berkas CSV hasil lab"
              type="file"
              accept=".csv,.tsv,.txt"
              onChange={(e) => void onPickFile(e.target.files?.[0])}
              aria-describedby="import-format-help"
            />
            <p id="import-format-help" className="text-xs text-slate-500">
              Kolom wajib: <code>order_id</code>, <code>parameter_name</code>, <code>value</code>.
              Kolom opsional: <code>value_type</code> (number/text), <code>unit</code>. Berkas
              Excel (.xlsx) belum didukung — gunakan CSV.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={downloadTemplate}>
              <Download className="size-4" aria-hidden="true" /> Unduh template (dari order
              termuat)
            </Button>
          </div>

          {parsing && (
            <p className="text-sm text-slate-600" role="status">
              Membaca berkas...
            </p>
          )}
          {fileError && (
            <p className="text-sm text-danger-600" role="alert">
              {fileError}
            </p>
          )}
          {workspace.error && (
            <ErrorState
              title="Daftar order belum termuat"
              message={`${workspace.error} Validasi baris membutuhkan daftar order dari API.`}
              onRetry={workspace.reload}
            />
          )}
        </Card>
      )}

      {step === "preview" && validation && (
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="text-sm text-slate-700">
              <span className="font-medium">{fileName}</span> · {rows.length} baris dibaca ·{" "}
              <span className="font-medium text-success-600">{validation.valid.length} valid</span>{" "}
              ·{" "}
              <span className="font-medium text-danger-600">
                {validation.invalid.length} bermasalah
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setStep("pick");
                  setRows([]);
                }}
              >
                Ganti berkas
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={validation.valid.length === 0 || !isOnline}
                onClick={() => void sendRows(validation.valid)}
              >
                <Upload className="size-4" aria-hidden="true" /> Kirim {validation.valid.length}{" "}
                baris valid
              </Button>
            </div>
          </Card>

          {!isOnline && (
            <p className="rounded-xl border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-700" role="status">
              Anda sedang offline — pengiriman dinonaktifkan sampai koneksi pulih.
            </p>
          )}

          <section aria-labelledby="preview-valid" className="space-y-2">
            <h2 id="preview-valid" className="text-base font-semibold text-slate-900">
              Pratinjau baris valid ({validation.valid.length})
            </h2>
            {validation.valid.length === 0 ? (
              <EmptyState
                icon={FileSpreadsheet}
                title="Tidak ada baris valid"
                description="Perbaiki berkas sesuai format kolom, atau unduh laporan kesalahan di bawah."
              />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <caption className="sr-only">Pratinjau baris impor yang valid</caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-left text-xs uppercase text-slate-500">
                      <th scope="col" className="px-3 py-2">Baris</th>
                      <th scope="col" className="px-3 py-2">order_id</th>
                      <th scope="col" className="px-3 py-2">parameter_name</th>
                      <th scope="col" className="px-3 py-2">value</th>
                      <th scope="col" className="px-3 py-2">unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validation.valid.map((r) => (
                      <tr key={`${r.line}-${r.labOrderItemId}`}>
                        <td className="px-3 py-1.5 text-slate-500">{r.line}</td>
                        <td className="px-3 py-1.5 font-mono">{r.orderId}</td>
                        <td className="px-3 py-1.5">{r.parameterName}</td>
                        <td className="px-3 py-1.5 font-mono">
                          {r.numericValue !== undefined ? r.numericValue : r.textValue}
                        </td>
                        <td className="px-3 py-1.5 text-slate-600">{r.unit ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {validation.invalid.length > 0 && (
            <section aria-labelledby="preview-error" className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="preview-error" className="text-base font-semibold text-danger-700">
                  Baris bermasalah ({validation.invalid.length})
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    downloadTextFile(
                      `laporan-kesalahan-${fileName.replace(/\.[^.]+$/, "") || "impor"}.csv`,
                      buildErrorReportCsv(validation.invalid)
                    )
                  }
                >
                  <Download className="size-4" aria-hidden="true" /> Unduh laporan kesalahan
                </Button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-danger-200 bg-white">
                <table className="w-full text-sm">
                  <caption className="sr-only">Kesalahan per baris</caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-danger-50 text-left text-xs uppercase text-danger-700">
                      <th scope="col" className="px-3 py-2">Baris</th>
                      <th scope="col" className="px-3 py-2">Kolom</th>
                      <th scope="col" className="px-3 py-2">Alasan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {validation.invalid.flatMap(({ issues }) =>
                      issues.map((issue) => (
                        <tr key={`${issue.line}-${issue.column}-${issue.reason}`}>
                          <td className="px-3 py-1.5 text-slate-600">{issue.line}</td>
                          <td className="px-3 py-1.5 font-mono">{issue.column}</td>
                          <td className="px-3 py-1.5 text-slate-700">{issue.reason}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {step === "sending" && (
        <Card className="space-y-3 p-5" aria-busy="true">
          <h2 className="text-base font-semibold text-slate-900">Mengirim baris...</h2>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            aria-label="Progres pengiriman baris impor"
          >
            <div
              className="h-full bg-primary-600 transition-all"
              style={{
                width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%`,
              }}
            />
          </div>
          <p className="text-sm text-slate-600" role="status">
            {progress.done} dari {progress.total} baris · konkurensi {IMPORT_CONCURRENCY}
          </p>
        </Card>
      )}

      {step === "summary" && summary && (
        <div className="space-y-4">
          <Card className="space-y-3 p-5">
            <h2 className="text-base font-semibold text-slate-900">Ringkasan pengiriman</h2>
            <p className="text-sm text-slate-700">
              <span className="font-medium text-success-600">{summary.succeeded.length} sukses</span>{" "}
              ·{" "}
              <span className={summary.failed.length ? "font-medium text-danger-600" : ""}>
                {summary.failed.length} gagal
              </span>{" "}
              dari {progress.total || summary.succeeded.length + summary.failed.length} baris.
            </p>
            {sendingError && (
              <p className="text-sm text-danger-600" role="alert">
                {sendingError}
              </p>
            )}

            {summary.failed.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <caption className="sr-only">Baris yang gagal dikirim</caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <th scope="col" className="px-3 py-2">Baris</th>
                      <th scope="col" className="px-3 py-2">order_id</th>
                      <th scope="col" className="px-3 py-2">Kesalahan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.failed.map((f, i) => (
                      <tr key={i}>
                        <td className="px-3 py-1.5 text-slate-600">{f.item.line}</td>
                        <td className="px-3 py-1.5 font-mono">{f.item.orderId}</td>
                        <td className="px-3 py-1.5 text-danger-700">{f.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {summary.failed.length > 0 && (
                <Button
                  type="button"
                  onClick={() => void sendRows(summary.failed.map((f) => f.item))}
                  disabled={!isOnline}
                >
                  Ulangi {summary.failed.length} baris gagal
                </Button>
              )}
              <Link href="/lab">
                <Button type="button" variant="outline">
                  Selesai — kembali ke daftar order
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
