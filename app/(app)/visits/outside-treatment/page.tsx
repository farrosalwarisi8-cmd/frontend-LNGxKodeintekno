"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import {
  syncMasterData,
  syncPatients,
  syncQueues,
  useSyncedModules,
} from "@/lib/remote-sync";
import {
  encounterService,
  type BackendOutsideTreatment,
} from "@/lib/services/encounter.service";
import { patientService } from "@/lib/services/patient.service";
import type { ClinicVisit } from "@/lib/types";
import { Card } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Avatar } from "@/shared/components/design-system/avatar";
import { formatDate } from "@/lib/format";
import { Search, Stethoscope, ReceiptText, FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const rupiahFormatter = new Intl.NumberFormat("id-ID");

/** "1.250.000" → 1250000 (hanya digit, aman untuk input terkendali). */
function parseRupiah(value: string): number {
  const digits = value.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

function formatRupiahInput(value: string): string {
  const amount = parseRupiah(value);
  return amount === 0 ? "" : rupiahFormatter.format(amount);
}

function formatRupiah(amount?: number | null): string {
  if (amount === undefined || amount === null) return "—";
  return `Rp ${rupiahFormatter.format(amount)}`;
}

export default function OutsideTreatmentPage() {
  const { t: translate } = useI18n();
  const visits = useStore((s) => s.visits);
  const employees = useStore((s) => s.employees);
  const updateVisit = useStore((s) => s.updateVisit);

  const { loading, error, refetch } = useSyncedModules(async () => {
    await syncPatients(1, 100);
    await syncQueues();
    await syncMasterData();
  });

  const [search, setSearch] = useState("");
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  // Mengabaikan hasil resolve yang sudah basi bila pengguna cepat memilih
  // kunjungan lain.
  const selectionSeq = useRef(0);
  const [encounterId, setEncounterId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [treatments, setTreatments] = useState<BackendOutsideTreatment[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [providerName, setProviderName] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [therapy, setTherapy] = useState("");
  const [sickLetterNo, setSickLetterNo] = useState("");
  const [costInput, setCostInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const selectedVisit = visits.find((v) => v.id === selectedVisitId) ?? null;
  const selectedEmployee = selectedVisit
    ? employees.find((e) => e.id === selectedVisit.employeeId)
    : null;

  const filteredVisits = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const withPatient = visits.map((v) => ({
      visit: v,
      name: employees.find((e) => e.id === v.employeeId)?.fullName ?? "Pasien",
    }));
    if (!needle) return withPatient.slice(0, 30);
    return withPatient
      .filter(
        ({ visit, name }) =>
          name.toLowerCase().includes(needle) ||
          visit.visitNumber.toLowerCase().includes(needle)
      )
      .slice(0, 30);
  }, [visits, employees, search]);

  /**
   * Kunjungan dari antrean hanya membawa ticket id. Encounter backend dicari
   * lewat profil pasien (unique constraint appointment_id) sebelum formulir
   * berobat luar boleh dikirim.
   */
  const resolveEncounter = useCallback(
    async (v: ClinicVisit): Promise<string | null> => {
      if (v.encounterId) return v.encounterId;
      if (!v.employeeId || !v.appointmentId) return null;
      const encounters = await patientService.getClinicalEncounters(v.employeeId);
      const existing = encounters.find((e) => e.appointment_id === v.appointmentId);
      if (!existing) return null;
      updateVisit(v.id, {
        encounterId: existing.id,
        recordStatus:
          String(existing.status ?? "").toUpperCase() === "LOCKED" ? "LOCKED" : "DRAFT",
        lockedAt: existing.locked_at ?? undefined,
      });
      return existing.id;
    },
    [updateVisit]
  );

  const loadTreatments = useCallback(async (id: string) => {
    setListLoading(true);
    setListError(null);
    try {
      setTreatments(await encounterService.listOutsideTreatments(id));
    } catch (e) {
      setTreatments([]);
      setListError(
        e instanceof Error ? e.message : translate("outside.historyLoadError")
      );
    } finally {
      setListLoading(false);
    }
  }, [translate]);

  const handleSelectVisit = async (visit: ClinicVisit) => {
    const seq = ++selectionSeq.current;
    setSelectedVisitId(visit.id);
    setEncounterId(null);
    setTreatments([]);
    setResolving(true);
    setResolveError(null);
    setFormError(null);
    setSuccessMsg(null);
    try {
      const id = await resolveEncounter(visit);
      if (seq !== selectionSeq.current) return;
      setEncounterId(id);
      if (!id) {
        setResolveError(translate("outside.encounterUnavailable"));
        return;
      }
      await loadTreatments(id);
    } catch (e) {
      if (seq !== selectionSeq.current) return;
      setResolveError(
        e instanceof Error ? e.message : translate("outside.encounterLoadError")
      );
    } finally {
      if (seq === selectionSeq.current) setResolving(false);
    }
  };

  const resetForm = () => {
    setProviderName("");
    setDiagnosis("");
    setTherapy("");
    setSickLetterNo("");
    setCostInput("");
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!encounterId) {
      setFormError(translate("outside.encounterMissing"));
      return;
    }
    if (!providerName.trim()) {
      setFormError(translate("outside.providerRequired"));
      return;
    }
    const costIdr = parseRupiah(costInput);
    if (costInput && (!Number.isFinite(costIdr) || costIdr < 0)) {
      setFormError(translate("outside.invalidCost"));
      return;
    }

    setSaving(true);
    setFormError(null);
    setSuccessMsg(null);
    try {
      await encounterService.addOutsideTreatment(encounterId, {
        providerName: providerName.trim(),
        diagnosis: diagnosis.trim() || undefined,
        therapy: therapy.trim() || undefined,
        sickLetterNo: sickLetterNo.trim() || undefined,
        costIdr: costInput ? costIdr : undefined,
      });
      setSuccessMsg("Entri berobat luar tersimpan.");
      resetForm();
      await loadTreatments(encounterId);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : translate("outside.saveFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{translate("page.outsideTreatment.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {translate("page.outsideTreatment.subtitle")}
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
          {translate("outside.loadError")}: {error}{" "}
          <button className="underline" onClick={refetch}>
            {translate("outside.retry")}
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="p-4">
          <Input
            placeholder="Cari nama pasien atau nomor kunjungan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search />}
            aria-label="Cari kunjungan"
          />
          <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
            {loading && (
              <div className="h-16 animate-pulse rounded-xl bg-muted" />
            )}
            {!loading && filteredVisits.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">
                {translate("outside.noMatchingVisits")}
              </p>
            )}
            {filteredVisits.map(({ visit, name }) => {
              const active = visit.id === selectedVisitId;
              return (
                <button
                  key={visit.id}
                  type="button"
                  onClick={() => void handleSelectVisit(visit)}
                  aria-pressed={active}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-primary-300 bg-primary-50"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <Avatar name={name} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {visit.visitNumber} · {formatDate(visit.date)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          {!selectedVisit && (
            <Card className="flex flex-col items-center gap-2 p-8 text-center">
              <Stethoscope className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                Pilih kunjungan di sebelah kiri untuk mencatat berobat luar.
              </p>
            </Card>
          )}

          {selectedVisit && (
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-3">
                <Avatar name={selectedEmployee?.fullName ?? "Pasien"} />
                <div>
                  <p className="font-medium text-foreground">
                    {selectedEmployee?.fullName ?? "Pasien"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedVisit.visitNumber} · {formatDate(selectedVisit.date)}
                  </p>
                </div>
              </div>

              {resolving && (
                <p className="text-sm text-muted-foreground" role="status">
                  Memuat encounter kunjungan...
                </p>
              )}
              {resolveError && (
                <p className="rounded-xl bg-warning-50 p-3 text-sm text-warning-700" role="status">
                  {resolveError}
                </p>
              )}

              <form className="mt-3 space-y-3" onSubmit={handleSubmit}>
                <Input
                  label="Fasilitas / penyedia layanan"
                  value={providerName}
                  onChange={(e) => setProviderName(e.target.value)}
                  placeholder="cth. RS Umum Daerah"
                  required
                  disabled={!encounterId || saving}
                />
                <Input
                  label="Diagnosis"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="cth. ISPA"
                  disabled={!encounterId || saving}
                />
                <Input
                  label="Terapi"
                  value={therapy}
                  onChange={(e) => setTherapy(e.target.value)}
                  placeholder="cth. Antibiotik 5 hari"
                  disabled={!encounterId || saving}
                />
                <Input
                  label="Nomor surat sakit"
                  value={sickLetterNo}
                  onChange={(e) => setSickLetterNo(e.target.value)}
                  placeholder="cth. SK/2026/001"
                  disabled={!encounterId || saving}
                />
                <div>
                  <label
                    htmlFor="biaya-berobat-luar"
                    className="mb-1 block text-sm font-medium text-text-secondary"
                  >
                    Biaya (Rupiah)
                  </label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      Rp
                    </span>
                    <Input
                      id="biaya-berobat-luar"
                      className="pl-9"
                      inputMode="numeric"
                      value={costInput}
                      onChange={(e) => setCostInput(formatRupiahInput(e.target.value))}
                      placeholder="0"
                      disabled={!encounterId || saving}
                    />
                  </div>
                  {costInput && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatRupiah(parseRupiah(costInput))}
                    </p>
                  )}
                </div>

                {formError && (
                  <p className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700" role="alert">
                    {formError}
                  </p>
                )}
                {successMsg && (
                  <p className="rounded-xl bg-success-50 p-3 text-sm text-success-700" role="status">
                    {successMsg}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetForm}
                    disabled={saving}
                  >
                    Bersihkan
                  </Button>
                  <Button
                    type="submit"
                    loading={saving}
                    disabled={saving || !encounterId || !providerName.trim()}
                  >
                    <FileText className="size-4" />
                    Simpan entri
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {selectedVisit && encounterId && (
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2">
                <ReceiptText className="size-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-sm font-medium text-foreground">
                  Riwayat berobat luar
                </h2>
                {treatments.length > 0 && (
                  <Badge variant="info">{treatments.length} entri</Badge>
                )}
              </div>
              {listLoading && (
                <div className="h-16 animate-pulse rounded-xl bg-muted" />
              )}
              {listError && (
                <p className="text-sm text-danger-700" role="alert">
                  {listError}
                </p>
              )}
              {!listLoading && !listError && treatments.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {translate("outside.emptyHistory")}
                </p>
              )}
              <ul className="divide-y divide-border">
                {treatments.map((t) => (
                  <li key={t.id} className="py-2 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-foreground">
                        {t.provider_name ?? "Fasilitas tidak dicatat"}
                      </p>
                      <p className="font-medium text-foreground">
                        {formatRupiah(t.cost_idr)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.diagnosis || "Tanpa diagnosis"} · {t.therapy || "Tanpa terapi"}
                      {t.sick_letter_no ? ` · Surat sakit ${t.sick_letter_no}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
