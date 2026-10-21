"use client";

/**
 * Form input hasil lab manual — Fase A2 (Tugas 3).
 *
 * - Baris form DIBANGUN DINAMIS dari `test_type` pada item order (data API);
 *   tidak ada daftar tes yang ditulis di kode.
 * - Validasi hanya teknis: wajib isi, angka harus berupa angka, satuan bebas.
 *   TIDAK ada ambang klinis / rentang karangan.
 * - Nilai referensi ditampilkan HANYA dari `test_type.reference_range` API.
 * - Draf disimpan per order+item di localStorage (offline-safe).
 * - Ada langkah ringkasan sebelum kirim (Tinjau → Kirim).
 * - `abnormalFlag` TIDAK dikirim dari klien: penandaan abnormal adalah
 *   kewenangan konfigurasi/server (lihat BLOCKER di laporan A2).
 */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Card } from "@/shared/components/design-system/card";
import { NativeSelect } from "@/components/ui/native-select";
import { diagnosticService, type BackendLabOrder, type BackendLabResult } from "@/lib/services/diagnostic.service";
import { formatReferenceRange } from "@/features/lab/order-utils";
import { labItemStatusInfo } from "@/features/lab/status-map";

interface DraftRow {
  parameterName: string;
  valueType: "number" | "text";
  numberValue: string;
  textValue: string;
  unit: string;
}

interface RowError {
  field: "parameterName" | "value";
  message: string;
}

const draftKey = (orderId: string, itemId: string) =>
  `kodein_lab_result_draft__${orderId}__${itemId}`;

function readDraft(orderId: string, itemId: string): DraftRow[] | null {
  try {
    const raw = localStorage.getItem(draftKey(orderId, itemId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as DraftRow[];
  } catch {
    return null;
  }
}

function clearDraft(orderId: string, itemId: string) {
  try {
    localStorage.removeItem(draftKey(orderId, itemId));
  } catch {
    // storage penuh/diblokir — bukan alasan untuk gagal
  }
}

/** Validasi teknis per baris (tanpa ambang klinis). */
export function validateRows(rows: DraftRow[]): (RowError | null)[] {
  return rows.map((row) => {
    if (!row.parameterName.trim()) {
      return { field: "parameterName", message: "Nama parameter wajib diisi." };
    }
    if (row.valueType === "number") {
      const raw = row.numberValue.trim().replace(",", ".");
      if (!raw) return { field: "value", message: "Nilai wajib diisi." };
      if (!Number.isFinite(Number(raw))) {
        return { field: "value", message: "Nilai harus berupa angka yang valid." };
      }
    } else if (!row.textValue.trim()) {
      return { field: "value", message: "Nilai wajib diisi." };
    }
    return null;
  });
}

export function ResultEntryForm({
  order,
  results,
  onSubmitted,
}: {
  order: BackendLabOrder;
  results: BackendLabResult[];
  onSubmitted: () => void;
}) {
  const items = useMemo(() => order.order_items ?? [], [order]);
  const firstOpen = items.find((i) => !results.some((r) => r.lab_order_item_id === i.id));
  const [itemId, setItemId] = useState(firstOpen?.id ?? items[0]?.id ?? "");
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [touched, setTouched] = useState(false);
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState(false);

  const item = items.find((i) => i.id === itemId) ?? null;
  const existingResult = results.find((r) => r.lab_order_item_id === itemId) ?? null;
  const testType = item?.test_type ?? null;

  // Muat draf per item (offline-safe, pola draft localStorage repo ini).
  // Seluruh setState di-defer ke callback (pola repo: react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      const draft = readDraft(order.id, item.id);
      if (draft) {
        setRows(draft);
        setDraftNotice(true);
      } else {
        setRows([
          {
            parameterName: testType?.name ?? "",
            valueType: testType?.unit || testType?.reference_range ? "number" : "text",
            numberValue: "",
            textValue: "",
            unit: testType?.unit ?? "",
          },
        ]);
        setDraftNotice(false);
      }
      setTouched(false);
      setStep("edit");
      setError(null);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [item, order.id, testType?.name, testType?.unit, testType?.reference_range]);

  // Simpan draf otomatis.
  useEffect(() => {
    if (!item || rows.length === 0) return;
    try {
      localStorage.setItem(draftKey(order.id, item.id), JSON.stringify(rows));
    } catch {
      // abaikan
    }
  }, [rows, item, order.id]);

  if (!item) {
    return (
      <p className="text-sm text-slate-500">Order ini tidak memiliki item pemeriksaan.</p>
    );
  }

  if (existingResult) {
    return (
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-slate-900">Hasil tersimpan</h3>
        <ul className="space-y-2">
          {(existingResult.values ?? []).map((v) => (
            <li key={v.id} className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="font-medium text-slate-800">{v.parameter_name}</span>
              <span className="font-mono text-slate-700">
                {v.numeric_value ?? v.text_value ?? "—"}
                {v.unit ? ` ${v.unit}` : ""}
              </span>
              {v.abnormal_flag && (
                <span className="inline-flex items-center gap-1 text-danger-600">
                  <AlertTriangle className="size-3.5" aria-hidden="true" />
                  Di luar rentang
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-500">
          Hasil sudah diinput untuk item ini. Koreksi dilakukan lewat addendum (alur addendum
          dikerjakan Fase A4).
        </p>
      </div>
    );
  }

  const errors = touched ? validateRows(rows) : rows.map(() => null);

  const patchRow = (index: number, patch: Partial<DraftRow>) =>
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const canReview = rows.length > 0 && validateRows(rows).every((e) => e === null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await diagnosticService.submitLabResult({
        labOrderItemId: item.id,
        values: rows.map((r) => ({
          parameterName: r.parameterName.trim(),
          ...(r.valueType === "number"
            ? { numericValue: Number(r.numberValue.trim().replace(",", ".")) }
            : { textValue: r.textValue.trim() }),
          ...(r.unit.trim() ? { unit: r.unit.trim() } : {}),
        })),
      });
      clearDraft(order.id, item.id);
      setRows([]);
      setStep("edit");
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan hasil lab.");
    } finally {
      setSaving(false);
    }
  };

  const refText = formatReferenceRange(testType?.reference_range);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <NativeSelect
            label="Item pemeriksaan"
            value={itemId}
            onChange={(v) => setItemId(v)}
            options={items.map((i) => ({
              value: i.id,
              label: `${i.test_type?.name ?? i.lab_test_type_id} (${
                labItemStatusInfo(i.status).label
              })`,
            }))}
          />
        </div>
        <div className="text-sm text-slate-500">
          Order: <span className="font-mono">{order.id}</span>
        </div>
      </div>

      {testType && (
        <Card className="bg-slate-50 p-3 text-sm text-slate-700">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              <span className="font-medium">Jenis tes (API):</span> {testType.name}
              {testType.code ? ` · ${testType.code}` : ""}
            </span>
            {testType.specimen_type && (
              <span>
                <span className="font-medium">Spesimen:</span> {testType.specimen_type}
              </span>
            )}
            <span>
              <span className="font-medium">Rentang referensi (API):</span>{" "}
              {refText ?? "tidak disediakan konfigurasi"}
            </span>
          </div>
        </Card>
      )}

      {draftNotice && (
        <p className="rounded-xl border border-warning-200 bg-warning-50 px-3 py-2 text-sm text-warning-700">
          Draf tersimpan sebelumnya dipulihkan.{" "}
          <button
            type="button"
            className="font-medium underline underline-offset-2"
            onClick={() => {
              clearDraft(order.id, item.id);
              setRows([
                {
                  parameterName: testType?.name ?? "",
                  valueType: testType?.unit || testType?.reference_range ? "number" : "text",
                  numberValue: "",
                  textValue: "",
                  unit: testType?.unit ?? "",
                },
              ]);
              setDraftNotice(false);
            }}
          >
            Hapus draf
          </button>
        </p>
      )}

      {step === "edit" && (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div
              key={index}
              className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-12"
            >
              <div className="sm:col-span-4">
                <Input
                  label="Parameter"
                  value={row.parameterName}
                  onChange={(e) => patchRow(index, { parameterName: e.target.value })}
                  error={errors[index]?.field === "parameterName" ? errors[index]?.message : undefined}
                  aria-describedby={errors[index]?.field === "parameterName" ? `param-err-${index}` : undefined}
                  disabled={saving}
                />
              </div>
              <div className="sm:col-span-2">
                <NativeSelect
                  label="Tipe nilai"
                  value={row.valueType}
                  onChange={(v) => patchRow(index, { valueType: v as DraftRow["valueType"] })}
                  options={[
                    { value: "number", label: "Angka" },
                    { value: "text", label: "Teks" },
                  ]}
                  disabled={saving}
                />
              </div>
              <div className="sm:col-span-3">
                {row.valueType === "number" ? (
                  <Input
                    label="Nilai"
                    inputMode="decimal"
                    value={row.numberValue}
                    onChange={(e) => patchRow(index, { numberValue: e.target.value })}
                    error={errors[index]?.field === "value" ? errors[index]?.message : undefined}
                    disabled={saving}
                  />
                ) : (
                  <Input
                    label="Nilai"
                    value={row.textValue}
                    onChange={(e) => patchRow(index, { textValue: e.target.value })}
                    error={errors[index]?.field === "value" ? errors[index]?.message : undefined}
                    disabled={saving}
                  />
                )}
              </div>
              <div className="sm:col-span-2">
                <Input
                  label="Satuan"
                  value={row.unit}
                  placeholder={testType?.unit ?? "—"}
                  onChange={(e) => patchRow(index, { unit: e.target.value })}
                  disabled={saving}
                />
              </div>
              <div className="flex items-end justify-end sm:col-span-1">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  aria-label={`Hapus baris parameter ${index + 1}`}
                  onClick={() => setRows((rs) => rs.filter((_, i) => i !== index))}
                  disabled={saving || rows.length <= 1}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setRows((rs) => [
                  ...rs,
                  {
                    parameterName: "",
                    valueType: "text",
                    numberValue: "",
                    textValue: "",
                    unit: "",
                  },
                ])
              }
              disabled={saving}
            >
              <Plus className="size-4" aria-hidden="true" /> Tambah parameter
            </Button>
            <Button
              type="button"
              onClick={() => {
                setTouched(true);
                if (canReview) setStep("review");
              }}
              disabled={saving}
            >
              Tinjau sebelum kirim
            </Button>
          </div>
          {touched && !canReview && (
            <p className="text-sm text-danger-600" role="alert">
              Perbaiki input yang belum valid sebelum melanjutkan.
            </p>
          )}
        </div>
      )}

      {step === "review" && (
        <Card className="space-y-3 p-4">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <FileText className="size-4" aria-hidden="true" /> Ringkasan sebelum kirim
          </h3>
          <table className="w-full text-sm">
            <caption className="sr-only">Ringkasan hasil yang akan dikirim</caption>
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase text-slate-500">
                <th scope="col" className="py-2">Parameter</th>
                <th scope="col" className="py-2">Nilai</th>
                <th scope="col" className="py-2">Satuan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="py-2 font-medium text-slate-800">{r.parameterName}</td>
                  <td className="py-2 font-mono">
                    {r.valueType === "number" ? r.numberValue : r.textValue}
                  </td>
                  <td className="py-2 text-slate-600">{r.unit || testType?.unit || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500">
            Item: {testType?.name ?? item.lab_test_type_id} · Order{" "}
            <span className="font-mono">{order.id}</span>
          </p>
          {error && (
            <p className="text-sm text-danger-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("edit")} disabled={saving}>
              Kembali mengedit
            </Button>
            <Button type="button" onClick={submit} disabled={saving}>
              {saving ? "Mengirim..." : "Kirim hasil"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
