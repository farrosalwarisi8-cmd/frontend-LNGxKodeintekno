"use client";

import { Can } from "@/components/can";
import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/env";
import { useStore } from "@/lib/store";
import { Card, CardContent } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Modal } from "@/shared/components/design-system/modal";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/design-system/tabs";
import { formatDate } from "@/lib/format";
import {
  diagnosticService,
  type BackendLabOrder,
  type BackendLabResult,
  type BackendRadiologyOrder,
  type BackendRadiologyResult,
} from "@/lib/services/diagnostic.service";
import { FlaskConical, Plus, CheckCircle, Clock, XCircle, Search, FileText } from "lucide-react";

const STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "default" | "info"> = {
  ORDERED: "warning",
  SAMPLE_COLLECTED: "info",
  IN_ANALYSIS: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
  PENDING: "warning",
  FINAL: "success",
  VERIFIED: "success",
  IMAGE_CAPTURED: "info",
  READING_PENDING: "warning",
};

export default function LabRadiologyPage() {
  const [activeTab, setActiveTab] = useState("lab");
  const [labOrders, setLabOrders] = useState<BackendLabOrder[]>([]);
  const [labResults, setLabResults] = useState<BackendLabResult[]>([]);
  const [radOrders, setRadOrders] = useState<BackendRadiologyOrder[]>([]);
  const [radResults, setRadResults] = useState<BackendRadiologyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Error khusus radiologi: role tertentu (mis. LAB_ANALYST) ditolak backend pada
  // endpoint radiologi. Kegagalan itu TIDAK boleh mengosongkan seluruh halaman.
  const [radError, setRadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [showLabResultModal, setShowLabResultModal] = useState(false);
  const [selectedLabOrder, setSelectedLabOrder] = useState<BackendLabOrder | null>(null);
  const [labResultValues, setLabResultValues] = useState([
    { parameterName: "", numericValue: "", unit: "", abnormalFlag: false },
  ]);
  const [savingLabResult, setSavingLabResult] = useState(false);
  const [labResultError, setLabResultError] = useState<string | null>(null);

  const [showRadResultModal, setShowRadResultModal] = useState(false);
  const [selectedRadOrder, setSelectedRadOrder] = useState<BackendRadiologyOrder | null>(null);
  // Fase 4 — scope site aktif: halaman ikut memuat ulang saat user berpindah scope.
  const scopeVersion = useStore((s) => s.scopeVersion);
  const [radFindings, setRadFindings] = useState("");
  const [radImpression, setRadImpression] = useState("");
  const [savingRadResult, setSavingRadResult] = useState(false);
  const [radResultError, setRadResultError] = useState<string | null>(null);

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<BackendLabResult | null>(null);
  const [verifyComment, setVerifyComment] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRadError(null);

    const toMessage = (e: unknown, fallback: string) =>
      e instanceof Error ? e.message : fallback;

    // Sumber diambil terpisah (allSettled) supaya 403 pada satu sumber —
    // misalnya radiologi untuk LAB_ANALYST — tidak memblokir tab laboratorium.
    const [labOrd, labRes, radOrd] = await Promise.allSettled([
      diagnosticService.listLabOrders(),
      diagnosticService.listLabOrderResults(),
      diagnosticService.listRadiologyOrders(),
    ]);

    // Laboratorium adalah sumber utama halaman ini.
    if (labOrd.status === "rejected" && labRes.status === "rejected") {
      setError(toMessage(labOrd.reason, toMessage(labRes.reason, "Gagal memuat data laboratory.")));
      setLoading(false);
      return;
    }
    if (labOrd.status === "fulfilled") setLabOrders(labOrd.value);
    if (labRes.status === "fulfilled") setLabResults(labRes.value);

    // Radiologi bersifat opsional per-role: kegagalan ditampilkan terpisah.
    if (radOrd.status === "rejected") {
      setRadError(
        toMessage(radOrd.reason, "Anda tidak memiliki akses ke data radiologi pada scope ini.")
      );
      setRadOrders([]);
      setRadResults([]);
    } else {
      setRadOrders(radOrd.value);
      const results: BackendRadiologyResult[] = [];
      for (const o of radOrd.value) {
        if (o.status !== "COMPLETED") continue;
        try {
          const r = await fetch(apiUrl(`/diagnostic/radiology-orders/${o.id}`), {
            headers: { Authorization: `Bearer ${localStorage.getItem("kodein_token") ?? ""}` },
          });
          if (r.ok) {
            const data = await r.json();
            if (data.radiology_result) results.push(data.radiology_result);
          }
        } catch {
          // satu order gagal dibaca tidak boleh menggagalkan seluruh daftar
        }
      }
      setRadResults(results);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    // Defer agar setState tidak dipanggil sinkron di dalam effect
    // (react-hooks/set-state-in-effect), konsisten dengan useSyncedModules.
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
    // Fase 4 — refetch saat user berpindah scope site (data scope lama
    // diganti skeleton saat loading, sehingga baris lama tidak tampil).
  }, [load, scopeVersion]);

  const handleSubmitLabResult = async () => {
    if (!selectedLabOrder) return;
    const item = selectedLabOrder.order_items?.[0];
    if (!item) {
      setLabResultError("Tidak ada item pada order ini.");
      return;
    }
    const values = labResultValues
      .filter((v) => v.parameterName)
      .map((v) => ({
        parameterName: v.parameterName,
        numericValue: v.numericValue ? Number(v.numericValue) : undefined,
        unit: v.unit || undefined,
        abnormalFlag: v.abnormalFlag,
      }));
    if (values.length === 0) {
      setLabResultError("Minimal satu parameter hasil diisi.");
      return;
    }
    setSavingLabResult(true);
    setLabResultError(null);
    try {
      await diagnosticService.submitLabResult({
        labOrderItemId: item.id,
        values,
      });
      setShowLabResultModal(false);
      setLabResultValues([{ parameterName: "", numericValue: "", unit: "", abnormalFlag: false }]);
      await load();
    } catch (e) {
      setLabResultError(e instanceof Error ? e.message : "Gagal menyimpan hasil lab.");
    } finally {
      setSavingLabResult(false);
    }
  };

  const handleSubmitRadResult = async () => {
    if (!selectedRadOrder) return;
    if (!radFindings || !radImpression) {
      setRadResultError("Findings dan impression wajib diisi.");
      return;
    }
    setSavingRadResult(true);
    setRadResultError(null);
    try {
      await diagnosticService.submitRadiologyResult({
        radiologyOrderId: selectedRadOrder.id,
        findings: radFindings,
        impression: radImpression,
      });
      setShowRadResultModal(false);
      setRadFindings("");
      setRadImpression("");
      await load();
    } catch (e) {
      setRadResultError(e instanceof Error ? e.message : "Gagal menyimpan hasil radiologi.");
    } finally {
      setSavingRadResult(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedResult) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      await diagnosticService.verifyLabResult(selectedResult.id, verifyComment || undefined);
      setShowVerifyModal(false);
      setVerifyComment("");
      await load();
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Gagal verifikasi hasil.");
    } finally {
      setVerifying(false);
    }
  };

  const filteredLabOrders = labOrders.filter(
    (o) =>
      !search ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.order_items?.some((item) =>
        item.test_type?.name.toLowerCase().includes(search.toLowerCase())
      )
  );

  const filteredRadOrders = radOrders.filter(
    (o) =>
      !search ||
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.modality.toLowerCase().includes(search.toLowerCase()) ||
      o.body_part.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Lab & Radiologi</h1>
        <p className="text-sm text-slate-500">
          Kelola order dan hasil pemeriksaan laboratorium serta radiologi
        </p>
      </div>

      {error && <ErrorState title="Gagal memuat data" message={error} onRetry={load} />}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="lab">Laboratorium</TabsTrigger>
          <TabsTrigger value="rad">Radiologi</TabsTrigger>
        </TabsList>

        <TabsContent value="lab" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Cari order atau tes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {!loading && !error && filteredLabOrders.length === 0 && (
            <EmptyState
              title="Belum ada order lab"
              description="Belum ada order laboratorium pada scope Anda."
              icon={FlaskConical}
            />
          )}

          {!loading && !error && (
            <div className="space-y-3">
              {filteredLabOrders.map((order) => {
                const result = labResults.find(
                  (r) => r.lab_order_item_id === order.id
                );
                return (
                  <Card key={order.id} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">
                          Order #{order.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(order.ordered_at)} · {order.status}
                        </p>
                        {order.order_items?.map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-xs text-slate-600">
                            <FileText className="size-3.5" />
                            <span>{item.test_type?.name ?? item.lab_test_type_id}</span>
                            <Badge variant={STATUS_VARIANT[item.status] ?? "default"}>
                              {item.status}
                            </Badge>
                          </div>
                        ))}
                        {result && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-medium text-slate-700">Hasil:</p>
                            {result.values?.map((v) => (
                              <p
                                key={v.id}
                                className={`text-xs ${v.abnormal_flag ? "font-medium text-danger-600" : "text-slate-600"}`}
                              >
                                {v.parameter_name}: {v.numeric_value ?? v.text_value}{" "}
                                {v.unit ?? ""}
                                {v.abnormal_flag && " ⚠️"}
                              </p>
                            ))}
                            {result.verified_at && (
                              <p className="text-xs text-success-600">
                                ✓ Terverifikasi {formatDate(result.verified_at)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_VARIANT[order.status] ?? "default"}>
                          {order.status}
                        </Badge>
                        <Can action="input-lab-result">
                          {order.status === "ORDERED" && !result && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedLabOrder(order);
                                setShowLabResultModal(true);
                                setLabResultError(null);
                              }}
                            >
                              <Plus className="size-3.5" />
                              Input Hasil
                            </Button>
                          )}
                        </Can>
                        <Can action="input-lab-result">
                          {result && !result.verified_at && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedResult(result);
                                setShowVerifyModal(true);
                                setVerifyError(null);
                              }}
                            >
                              <CheckCircle className="size-3.5" />
                              Verify
                            </Button>
                          )}
                        </Can>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="rad" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Cari order radiologi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {!loading && radError && (
            <ErrorState title="Radiologi tidak dapat diakses" message={radError} onRetry={load} />
          )}

          {!loading && !radError && filteredRadOrders.length === 0 && (
            <EmptyState
              title="Belum ada order radiologi"
              description="Belum ada order radiologi pada scope Anda."
              icon={FlaskConical}
            />
          )}

          {!loading && !radError && (
            <div className="space-y-3">
              {filteredRadOrders.map((order) => {
                const result = radResults.find(
                  (r) => r.radiology_order_id === order.id
                );
                return (
                  <Card key={order.id} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <p className="font-medium text-slate-900">
                          Order #{order.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(order.ordered_at)} · {order.modality} · {order.body_part}
                        </p>
                        {result && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs text-slate-600">
                              <span className="font-medium">Findings:</span> {result.findings}
                            </p>
                            <p className="text-xs text-slate-600">
                              <span className="font-medium">Impression:</span> {result.impression}
                            </p>
                            {result.verified_at && (
                              <p className="text-xs text-success-600">
                                ✓ Terverifikasi {formatDate(result.verified_at)}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_VARIANT[order.status] ?? "default"}>
                          {order.status}
                        </Badge>
                        <Can action="input-lab-result">
                          {order.status === "ORDERED" && !result && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedRadOrder(order);
                                setShowRadResultModal(true);
                                setRadResultError(null);
                              }}
                            >
                              <Plus className="size-3.5" />
                              Input Hasil
                            </Button>
                          )}
                        </Can>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Modal
        open={showLabResultModal}
        onClose={() => setShowLabResultModal(false)}
        title="Input Hasil Lab"
        size="lg"
      >
        <div className="space-y-4">
          {selectedLabOrder?.order_items?.map((item) => (
            <p key={item.id} className="text-sm text-slate-600">
              Tes: <span className="font-medium">{item.test_type?.name}</span>
            </p>
          ))}
          {labResultValues.map((v, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Input
                placeholder="Parameter"
                value={v.parameterName}
                onChange={(e) =>
                  setLabResultValues((prev) =>
                    prev.map((p, j) => (j === i ? { ...p, parameterName: e.target.value } : p))
                  )
                }
              />
              <Input
                placeholder="Nilai"
                value={v.numericValue}
                onChange={(e) =>
                  setLabResultValues((prev) =>
                    prev.map((p, j) => (j === i ? { ...p, numericValue: e.target.value } : p))
                  )
                }
              />
              <Input
                placeholder="Satuan"
                value={v.unit}
                onChange={(e) =>
                  setLabResultValues((prev) =>
                    prev.map((p, j) => (j === i ? { ...p, unit: e.target.value } : p))
                  )
                }
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  aria-label="Tandai abnormal"
                  checked={v.abnormalFlag}
                  onChange={(e) =>
                    setLabResultValues((prev) =>
                      prev.map((p, j) => (j === i ? { ...p, abnormalFlag: e.target.checked } : p))
                    )
                  }
                />
                Abnormal
              </label>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setLabResultValues((prev) => [
                ...prev,
                { parameterName: "", numericValue: "", unit: "", abnormalFlag: false },
              ])
            }
          >
            + Parameter
          </Button>
          {labResultError && <p className="text-xs text-danger-600">{labResultError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowLabResultModal(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmitLabResult} disabled={savingLabResult}>
              {savingLabResult ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showRadResultModal}
        onClose={() => setShowRadResultModal(false)}
        title="Input Hasil Radiologi"
        size="lg"
      >
        <div className="space-y-4">
          {selectedRadOrder && (
            <p className="text-sm text-slate-600">
              {selectedRadOrder.modality} · {selectedRadOrder.body_part}
            </p>
          )}
          <div>
            <label htmlFor="rad-findings" className="mb-1 block text-sm font-medium text-slate-700">Findings</label>
            <textarea
              id="rad-findings"
              className="w-full rounded-lg border border-slate-200 p-2 text-sm"
              rows={3}
              value={radFindings}
              onChange={(e) => setRadFindings(e.target.value)}
              placeholder="Deskripsi temuan radiologis..."
            />
          </div>
          <div>
            <label htmlFor="rad-impression" className="mb-1 block text-sm font-medium text-slate-700">Impression</label>
            <textarea
              id="rad-impression"
              className="w-full rounded-lg border border-slate-200 p-2 text-sm"
              rows={2}
              value={radImpression}
              onChange={(e) => setRadImpression(e.target.value)}
              placeholder="Kesimpulan/impresi..."
            />
          </div>
          {radResultError && <p className="text-xs text-danger-600">{radResultError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowRadResultModal(false)}>
              Batal
            </Button>
            <Button onClick={handleSubmitRadResult} disabled={savingRadResult}>
              {savingRadResult ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showVerifyModal}
        onClose={() => setShowVerifyModal(false)}
        title="Verifikasi Hasil Lab"
      >
        <div className="space-y-4">
          {selectedResult && (
            <div className="space-y-1">
              {selectedResult.values?.map((v) => (
                <p key={v.id} className="text-sm text-slate-600">
                  {v.parameter_name}: {v.numeric_value ?? v.text_value} {v.unit ?? ""}
                  {v.abnormal_flag && " ⚠️"}
                </p>
              ))}
            </div>
          )}
          <Input
            label="Komentar verifikasi (opsional)"
            value={verifyComment}
            onChange={(e) => setVerifyComment(e.target.value)}
          />
          {verifyError && <p className="text-xs text-danger-600">{verifyError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowVerifyModal(false)}>
              Batal
            </Button>
            <Button onClick={handleVerify} disabled={verifying}>
              {verifying ? "Memverifikasi..." : "Verifikasi"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
