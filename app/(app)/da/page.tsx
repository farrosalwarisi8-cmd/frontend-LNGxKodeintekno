"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Avatar } from "@/shared/components/design-system/avatar";
import { Modal } from "@/shared/components/design-system/modal";
import { formatDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import { syncPatients, useSyncedModules } from "@/lib/remote-sync";
import { daService } from "@/lib/services/da.service";
import { FlaskConical, Plus, CheckCircle, Clock, AlertTriangle } from "lucide-react";

interface DATest {
  id: string;
  backendId?: string;
  backendSampleId?: string;
  employeeId: string;
  testDate: string;
  sampleType: string;
  result: "NEGATIVE" | "POSITIVE" | "PENDING";
  confirmationTest: boolean;
  chainOfCustody: string;
  doctorName: string;
  status: "PENDING" | "VERIFIED" | "CERTIFIED";
}

const INITIAL_DA_TESTS: DATest[] = [
  {
    id: "da1",
    employeeId: "e1",
    testDate: "2026-09-15",
    sampleType: "Urine",
    result: "NEGATIVE",
    confirmationTest: false,
    chainOfCustody: "Chain of custody terjaga",
    doctorName: "dr. Siti Rahayu",
    status: "CERTIFIED",
  },
  {
    id: "da2",
    employeeId: "e5",
    testDate: "2026-09-20",
    sampleType: "Urine",
    result: "PENDING",
    confirmationTest: false,
    chainOfCustody: "Chain of custody terjaga",
    doctorName: "dr. Siti Rahayu",
    status: "PENDING",
  },
];

export default function DAPage() {
  const employees = useStore((s) => s.employees);
  const [tests, setTests] = useState<DATest[]>(INITIAL_DA_TESTS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Modul 10 — daftar pekerja (pasien) dari backend untuk pendaftaran tes
  useSyncedModules(() => syncPatients(1, 100));

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState<{
    employeeId: string;
    testDate: string;
    sampleType: string;
    result: "NEGATIVE" | "POSITIVE" | "PENDING";
    confirmationTest: boolean;
    chainOfCustody: string;
  }>({
    employeeId: "",
    testDate: "",
    sampleType: "Urine",
    result: "NEGATIVE",
    confirmationTest: false,
    chainOfCustody: "",
  });

  /**
   * Pendaftaran tes D&A di backend:
   *   POST /da/tests -> POST /da/samples (spesimen + barcode)
   */
  const handleSubmit = async () => {
    if (!formData.employeeId) {
      setMsg("Pilih pekerja terlebih dahulu.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const daTest = await daService.createTest(formData.employeeId, "RANDOM_INSPECTION");
      const sample = await daService.createSample(
        daTest.id,
        `SMP-${new Date().getFullYear()}-LNG-${String(Date.now()).slice(-4)}`,
        (formData.sampleType || "Urine").toUpperCase()
      );
      const newTest: DATest = {
        id: `da${Date.now()}`,
        backendId: daTest.id,
        backendSampleId: sample.id,
        ...formData,
        doctorName: "dr. Siti Rahayu",
        status: "PENDING",
      };
      setTests((prev) => [newTest, ...prev]);
      setShowModal(false);
      setFormData({ employeeId: "", testDate: "", sampleType: "Urine", result: "NEGATIVE", confirmationTest: false, chainOfCustody: "" });
      setMsg("Tes D&A terdaftar di backend.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal mendaftarkan tes ke backend.");
    } finally {
      setBusy(false);
    }
  };

  /** Input hasil uji: POST /api/v1/da/tests/:id/results */
  const handleVerify = async (localId: string) => {
    const test = tests.find((t) => t.id === localId);
    if (!test?.backendId) return;
    setBusy(true);
    setMsg(null);
    try {
      await daService.submitResults(
        test.backendId,
        test.result === "POSITIVE" ? "NON_NEGATIVE" : "NEGATIVE",
        test.confirmationTest ? (test.result === "POSITIVE" ? "NON_NEGATIVE" : "NEGATIVE") : undefined,
        test.confirmationTest
      );
      setTests((prev) => prev.map((t) => (t.id === localId ? { ...t, status: "VERIFIED" } : t)));
      setMsg("Hasil uji tersimpan di backend.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal menyimpan hasil uji.");
    } finally {
      setBusy(false);
    }
  };

  /** Terbitkan sertifikat: POST /api/v1/da/tests/:id/certificate */
  const handleCertify = async (localId: string) => {
    const test = tests.find((t) => t.id === localId);
    if (!test?.backendId) return;
    setBusy(true);
    setMsg(null);
    try {
      await daService.issueCertificate(test.backendId);
      setTests((prev) => prev.map((t) => (t.id === localId ? { ...t, status: "CERTIFIED" } : t)));
      setMsg("Sertifikat D&A diterbitkan oleh backend.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal menerbitkan sertifikat.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Drug & Alcohol Test</h1>
          <p className="text-sm text-slate-500">Kelola tes D&A dengan chain of custody</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="size-4" />
          Tes Baru
        </Button>
      </div>

      {msg && (
        <div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{msg}</div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{tests.filter((t) => t.status === "PENDING").length}</p>
              <p className="text-xs text-slate-500">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-info-100 text-info-600">
              <CheckCircle className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{tests.filter((t) => t.status === "VERIFIED").length}</p>
              <p className="text-xs text-slate-500">Verified</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success-100 text-success-600">
              <FlaskConical className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-900">{tests.filter((t) => t.status === "CERTIFIED").length}</p>
              <p className="text-xs text-slate-500">Certified</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        {tests.map((test) => {
          const emp = employees.find((e) => e.id === test.employeeId);
          return (
            <Card key={test.id} className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Avatar name={emp?.fullName ?? "?"} />
                  <div>
                    <p className="font-medium text-slate-900">{emp?.fullName}</p>
                    <p className="text-xs text-slate-500">
                      {formatDate(test.testDate)} · {test.sampleType}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={test.result === "NEGATIVE" ? "success" : test.result === "POSITIVE" ? "danger" : "warning"}>
                        {test.result}
                      </Badge>
                      <Badge variant={test.status === "CERTIFIED" ? "success" : test.status === "VERIFIED" ? "info" : "warning"}>
                        {test.status}
                      </Badge>
                      {test.confirmationTest && (
                        <Badge variant="info">Confirmation Test</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {test.status === "PENDING" && (
                    <Button size="sm" variant="outline" onClick={() => handleVerify(test.id)} disabled={busy || !test.backendId || test.status !== "PENDING"}>Verify</Button>
                  )}
                  {test.status === "VERIFIED" && (
                    <Button size="sm" onClick={() => handleCertify(test.id)} disabled={busy || !test.backendId || test.status !== "VERIFIED"}>Certify</Button>
                  )}
                </div>
              </div>
              {test.result === "POSITIVE" && (
                <div className="mt-3 flex items-start gap-2 rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>Hasil positif — diperlukan confirmation test dan evaluasi dokter.</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Tes D&A Baru"
        size="md"
      >
        <div className="space-y-4">
          <Select
            label="Pekerja"
            value={formData.employeeId}
            onChange={(e) => setFormData((f) => ({ ...f, employeeId: e.target.value }))}
            placeholder="Pilih pekerja"
            options={employees.map((e) => ({ value: e.id, label: `${e.fullName} (${e.employeeId})` }))}
          />
          <Input label="Tanggal Tes" type="date" value={formData.testDate} onChange={(e) => setFormData((f) => ({ ...f, testDate: e.target.value }))} />
          <Select
            label="Jenis Sampel"
            value={formData.sampleType}
            onChange={(e) => setFormData((f) => ({ ...f, sampleType: e.target.value }))}
            options={[
              { value: "Urine", label: "Urine" },
              { value: "Blood", label: "Blood" },
              { value: "Hair", label: "Hair" },
              { value: "Saliva", label: "Saliva" },
            ]}
          />
          <Select
            label="Hasil"
            value={formData.result}
            onChange={(e) => setFormData((f) => ({ ...f, result: e.target.value as "NEGATIVE" | "POSITIVE" | "PENDING" }))}
            options={[
              { value: "NEGATIVE", label: "Negative" },
              { value: "POSITIVE", label: "Positive" },
              { value: "PENDING", label: "Pending" },
            ]}
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={formData.confirmationTest} onChange={(e) => setFormData((f) => ({ ...f, confirmationTest: e.target.checked }))} className="size-4 rounded border-slate-300" />
            Confirmation Test
          </label>
          <Input label="Chain of Custody" value={formData.chainOfCustody} onChange={(e) => setFormData((f) => ({ ...f, chainOfCustody: e.target.value }))} placeholder="Catatan chain of custody" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>Batal</Button>
            <Button onClick={handleSubmit} loading={busy} disabled={busy}>Simpan</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
