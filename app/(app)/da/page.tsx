"use client";

import { Can } from "@/components/can";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Avatar } from "@/shared/components/design-system/avatar";
import { Modal } from "@/shared/components/design-system/modal";
import { EmptyState } from "@/shared/components/design-system/empty-state";
import { ErrorState } from "@/shared/components/design-system/error-state";
import { Skeleton } from "@/shared/components/design-system/skeleton";
import { formatDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import { syncPatients, useSyncedModules } from "@/lib/remote-sync";
import {
  daService,
  type BackendDaTest,
  type BackendCustodyEntry,
} from "@/lib/services/da.service";
import {
  FlaskConical,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Search,
} from "lucide-react";

const STATUS_VARIANT: Record<string, "success" | "danger" | "warning" | "default" | "info"> = {
  REGISTERED: "warning",
  SAMPLE_COLLECTED: "info",
  CONFIRMATION_PENDING: "warning",
  FINALIZED: "success",
  CANCELLED: "danger",
};

const CUSTODY_ACTION_LABEL: Record<string, string> = {
  SAMPLE_COLLECTED_AND_SEALED: "Sampel dikumpulkan & disegel",
  HANDED_TO_COURIER: "Diserahkan ke kurier",
  RECEIVED_BY_LAB: "Diterima oleh laboratorium",
  ANALYSIS_STARTED: "Analisis dimulai",
  ANALYSIS_COMPLETED: "Analisis selesai",
  RESULTS_REPORTED: "Hasil dilaporkan",
  STORED: "Disimpan",
  DISPOSED: "Dibuang",
};

function CustodyTimeline({ entries }: { entries: BackendCustodyEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic">Belum ada chain of custody tercatat.</p>
    );
  }
  return (
    <div className="space-y-0">
      {entries.map((entry, i) => (
        <div key={entry.id} className="flex gap-3">
          {/* Vertical line + dot */}
          <div className="flex flex-col items-center">
            <div
              className={`mt-1 size-3 rounded-full border-2 ${
                i === 0
                  ? "border-success-500 bg-success-100"
                  : "border-border bg-muted"
              }`}
            />
            {i < entries.length - 1 && (
              <div className="w-px flex-1 border-l border-border" />
            )}
          </div>
          {/* Content */}
          <div className="pb-3">
            <p className="text-xs font-medium text-text-secondary">
              {CUSTODY_ACTION_LABEL[entry.action] ?? entry.action}
            </p>
            <p className="text-xs text-muted-foreground">
              {entry.from_party} → {entry.to_party}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(entry.event_at)} ·{" "}
              <span className="font-mono text-[10px]">
                #{entry.signature_hash.slice(0, 12)}…
              </span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DAPage() {
  const employees = useStore((s) => s.employees);
  const [tests, setTests] = useState<BackendDaTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

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
  }>({
    employeeId: "",
    testDate: "",
    sampleType: "Urine",
    result: "NEGATIVE",
    confirmationTest: false,
  });

  // Chain of custody modal
  const [showCustodyModal, setShowCustodyModal] = useState(false);
  const [selectedTest, setSelectedTest] = useState<BackendDaTest | null>(null);
  const [custodyForm, setCustodyForm] = useState({
    fromParty: "",
    toParty: "",
    action: "",
  });
  const [custodyBusy, setCustodyBusy] = useState(false);
  const [custodyError, setCustodyError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { page?: number; limit?: number; status?: string } = {
        page: 1,
        limit: 100,
      };
      if (statusFilter) params.status = statusFilter;
      const res = await daService.getTests(params);
      setTests(res.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data tes D&A.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

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
      await daService.createSample(
        daTest.id,
        `SMP-${new Date().getFullYear()}-LNG-${String(Date.now()).slice(-4)}`,
        (formData.sampleType || "Urine").toUpperCase()
      );
      setShowModal(false);
      setFormData({
        employeeId: "",
        testDate: "",
        sampleType: "Urine",
        result: "NEGATIVE",
        confirmationTest: false,
      });
      setMsg("Tes D&A terdaftar di backend.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal mendaftarkan tes ke backend.");
    } finally {
      setBusy(false);
    }
  };

  /** Input hasil uji: POST /api/v1/da/tests/:id/results */
  const handleVerify = async (testId: string) => {
    const test = tests.find((t) => t.id === testId);
    if (!test) return;
    const result = test.results?.[0]?.screening_result ?? "NEGATIVE";
    setBusy(true);
    setMsg(null);
    try {
      await daService.submitResults(
        testId,
        result === "NON_NEGATIVE" ? "NON_NEGATIVE" : "NEGATIVE",
        test.results?.[0]?.confirmation_result ?? undefined,
        test.results?.[0]?.confirmed ?? false
      );
      setMsg("Hasil uji tersimpan di backend.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal menyimpan hasil uji.");
    } finally {
      setBusy(false);
    }
  };

  /** Terbitkan sertifikat: POST /api/v1/da/tests/:id/certificate */
  const handleCertify = async (testId: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await daService.issueCertificate(testId);
      setMsg("Sertifikat D&A diterbitkan oleh backend.");
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Gagal menerbitkan sertifikat.");
    } finally {
      setBusy(false);
    }
  };

  /** Tambah chain of custody entry */
  const handleAddCustody = async () => {
    if (!selectedTest) return;
    const sample = selectedTest.samples?.[0];
    if (!sample) {
      setCustodyError("Tidak ada sample pada tes ini.");
      return;
    }
    if (!custodyForm.fromParty || !custodyForm.toParty || !custodyForm.action) {
      setCustodyError("Semua field wajib diisi.");
      return;
    }
    setCustodyBusy(true);
    setCustodyError(null);
    try {
      await daService.addCustody(sample.id, custodyForm.fromParty, custodyForm.toParty, custodyForm.action);
      setShowCustodyModal(false);
      setCustodyForm({ fromParty: "", toParty: "", action: "" });
      setMsg("Chain of custody ditambahkan.");
      await load();
    } catch (e) {
      setCustodyError(e instanceof Error ? e.message : "Gagal menambahkan custody.");
    } finally {
      setCustodyBusy(false);
    }
  };

  const filtered = tests.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const patientName = t.patient?.full_name ?? "";
    const mrn = t.patient?.medical_record_no ?? "";
    return (
      patientName.toLowerCase().includes(q) ||
      mrn.toLowerCase().includes(q) ||
      t.id.toLowerCase().includes(q) ||
      t.test_type?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Drug & Alcohol Test</h1>
          <p className="text-sm text-muted-foreground">
            Kelola tes D&A dengan chain of custody kriptografis
          </p>
        </div>
        <Can action="da.manage">
          <Button onClick={() => setShowModal(true)}>
            <Plus className="size-4" />
            Tes Baru
          </Button>
        </Can>
      </div>

      {msg && (
        <div className="rounded-xl bg-muted p-3 text-sm text-text-secondary">{msg}</div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari pekerja / MRN / ID tes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          aria-label="Filter status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: "", label: "Semua Status" },
            { value: "REGISTERED", label: "Registered" },
            { value: "SAMPLE_COLLECTED", label: "Sample Collected" },
            { value: "CONFIRMATION_PENDING", label: "Confirmation Pending" },
            { value: "FINALIZED", label: "Finalized" },
          ]}
        />
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-warning-100 text-warning-600">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">
                {tests.filter((t) => t.status === "REGISTERED" || t.status === "SAMPLE_COLLECTED").length}
              </p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-info-100 text-info-600">
              <CheckCircle className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">
                {tests.filter((t) => t.status === "FINALIZED").length}
              </p>
              <p className="text-xs text-muted-foreground">Finalized</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-success-100 text-success-600">
              <FlaskConical className="size-5" />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground">
                {tests.filter((t) => t.certificate).length}
              </p>
              <p className="text-xs text-muted-foreground">Certified</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <ErrorState title="Gagal memuat data" message={error} onRetry={load} />
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title="Belum ada tes D&A"
          description="Daftar tes D&A akan muncul setelah didaftarkan."
          icon={FlaskConical}
        />
      )}

      {/* Test List */}
      {!loading && !error && (
        <div className="space-y-3">
          {filtered.map((test) => {
            const emp = employees.find((e) => e.id === test.patient_id);
            const sample = test.samples?.[0];
            const custodyEntries = sample?.custody_chain ?? [];
            const hasCustody = custodyEntries.length > 0;
            const isFinalized = test.status === "FINALIZED";
            const hasCertificate = !!test.certificate;
            const screeningResult = test.results?.[0]?.screening_result;

            return (
              <Card key={test.id} className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  {/* Left: Info */}
                  <div className="flex items-start gap-3">
                    <Avatar name={emp?.fullName ?? test.patient?.full_name ?? "?"} />
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        {emp?.fullName ?? test.patient?.full_name ?? "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {test.patient?.medical_record_no ?? test.patient_id ?? "—"} ·{" "}
                        {formatDate(test.created_at ?? "")}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_VARIANT[test.status ?? ""] ?? "default"}>
                          {test.status}
                        </Badge>
                        {test.test_type && (
                          <Badge variant="info">{test.test_type}</Badge>
                        )}
                        {sample?.sample_no && (
                          <Badge variant="default">
                            <ShieldCheck className="mr-1 size-3" />
                            {sample.sample_no}
                          </Badge>
                        )}
                        {screeningResult && (
                          <Badge
                            variant={
                              screeningResult === "NON_NEGATIVE"
                                ? "danger"
                                : "success"
                            }
                          >
                            {screeningResult}
                          </Badge>
                        )}
                        {hasCertificate && (
                          <Badge variant="success">
                            <CheckCircle className="mr-1 size-3" />
                            Sertifikat
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Can action="da.manage">
                      {hasCustody && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedTest(test);
                            setShowCustodyModal(true);
                            setCustodyError(null);
                          }}
                        >
                          <Plus className="size-3.5" />
                          Custody
                        </Button>
                      )}
                    </Can>
                    <Can action="da.manage">
                      {test.status === "SAMPLE_COLLECTED" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVerify(test.id)}
                          disabled={busy}
                        >
                          <CheckCircle className="size-3.5" />
                          Input Hasil
                        </Button>
                      )}
                    </Can>
                    <Can action="da.manage">
                      {isFinalized && !hasCertificate && (
                        <Button
                          size="sm"
                          onClick={() => handleCertify(test.id)}
                          disabled={busy}
                        >
                          <CheckCircle className="size-3.5" />
                          Terbitkan Sertifikat
                        </Button>
                      )}
                    </Can>
                  </div>
                </div>

                {/* Chain of Custody Timeline */}
                {hasCustody && (
                  <div className="mt-4 rounded-xl border border-border p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <ShieldCheck className="size-4 text-muted-foreground" />
                      <h3 className="text-xs font-semibold text-text-secondary">
                        Chain of Custody ({custodyEntries.length} event)
                      </h3>
                    </div>
                    <CustodyTimeline entries={custodyEntries} />
                  </div>
                )}

                {/* Positive result warning */}
                {screeningResult === "NON_NEGATIVE" && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>
                      Hasil non-negatif — diperlukan confirmation test dan evaluasi dokter.
                    </span>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Test Modal */}
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
            options={employees.map((e) => ({
              value: e.id,
              label: `${e.fullName} (${e.employeeId})`,
            }))}
          />
          <Input
            label="Tanggal Tes"
            type="date"
            value={formData.testDate}
            onChange={(e) => setFormData((f) => ({ ...f, testDate: e.target.value }))}
          />
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
            label="Hasil Screening"
            value={formData.result}
            onChange={(e) =>
              setFormData((f) => ({
                ...f,
                result: e.target.value as "NEGATIVE" | "POSITIVE" | "PENDING",
              }))
            }
            options={[
              { value: "NEGATIVE", label: "Negative" },
              { value: "POSITIVE", label: "Positive (Non-Negative)" },
              { value: "PENDING", label: "Pending" },
            ]}
          />
          <label className="flex items-center gap-2 text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={formData.confirmationTest}
              onChange={(e) => setFormData((f) => ({ ...f, confirmationTest: e.target.checked }))}
              className="size-4 rounded border-input"
            />
            Confirmation Test
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowModal(false)}>
              Batal
            </Button>
            <Can action="da.manage">
              <Button onClick={handleSubmit} loading={busy} disabled={busy}>
                Simpan
              </Button>
            </Can>
          </div>
        </div>
      </Modal>

      {/* Add Custody Modal */}
      <Modal
        open={showCustodyModal}
        onClose={() => setShowCustodyModal(false)}
        title="Tambah Chain of Custody"
        description={
          selectedTest
            ? `Sample: ${selectedTest.samples?.[0]?.sample_no ?? "?"}`
            : ""
        }
      >
        <div className="space-y-4">
          <Input
            label="Dari (From Party)"
            value={custodyForm.fromParty}
            onChange={(e) => setCustodyForm((f) => ({ ...f, fromParty: e.target.value }))}
            placeholder="Contoh: Officer Rudi (Collector)"
          />
          <Input
            label="Ke (To Party)"
            value={custodyForm.toParty}
            onChange={(e) => setCustodyForm((f) => ({ ...f, toParty: e.target.value }))}
            placeholder="Contoh: Courier JNE Express Secure"
          />
          <Select
            label="Aksi"
            value={custodyForm.action}
            onChange={(e) => setCustodyForm((f) => ({ ...f, action: e.target.value }))}
            options={[
              { value: "", label: "-- Pilih aksi --" },
              { value: "HANDED_TO_COURIER", label: "Handed to Courier" },
              { value: "RECEIVED_BY_LAB", label: "Received by Lab" },
              { value: "ANALYSIS_STARTED", label: "Analysis Started" },
              { value: "ANALYSIS_COMPLETED", label: "Analysis Completed" },
              { value: "RESULTS_REPORTED", label: "Results Reported" },
              { value: "STORED", label: "Stored" },
              { value: "DISPOSED", label: "Disposed" },
            ]}
          />
          {custodyError && <p className="text-xs text-danger-600">{custodyError}</p>}
          <div className="flex items-start gap-2 rounded-lg bg-info-50 p-3 text-xs text-info-700">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <p>
              Setiap event dicatat dengan HMAC-SHA256 signature chain yang
              terhubung dengan event sebelumnya. Data tidak dapat diubah setelah
              tercatat.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowCustodyModal(false)}>
              Batal
            </Button>
            <Button onClick={handleAddCustody} disabled={custodyBusy}>
              {custodyBusy ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
