"use client";

import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { referralService } from "@/lib/services/referral.service";
import { today, formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Avatar } from "@/shared/components/design-system/avatar";
import { Search, ExternalLink, FileText } from "lucide-react";

export default function ReferralsPage() {
  const { t: translate } = useI18n();
  const visits = useStore((s) => s.visits);
  const employees = useStore((s) => s.employees);
  const referrals = useStore((s) => s.referrals);

  const [search, setSearch] = useState("");
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [reason, setReason] = useState("");
  const [referralDate, setReferralDate] = useState(() => today());
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const employeeFor = (employeeId: string) =>
    employees.find((e) => e.id === employeeId);

  const filteredVisits = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return visits;
    return visits.filter((visit) => {
      const employee = employees.find((e) => e.id === visit.employeeId);
      return (
        visit.visitNumber.toLowerCase().includes(needle) ||
        (employee?.fullName ?? "").toLowerCase().includes(needle) ||
        (employee?.mrn ?? "").toLowerCase().includes(needle)
      );
    });
  }, [visits, employees, search]);

  const selectedVisit = visits.find((v) => v.id === selectedVisitId) ?? null;
  const selectedEmployee = selectedVisit
    ? employeeFor(selectedVisit.employeeId)
    : undefined;
  const history = selectedVisitId
    ? referrals.filter((r) => r.visitId === selectedVisitId)
    : [];

  const resetForm = () => {
    setDestination("");
    setReason("");
    setReferralDate(today());
    setFormError(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedVisit) return;
    if (!destination.trim() || !reason.trim()) {
      setFormError(translate("referral.required"));
      return;
    }
    referralService.create({
      visitId: selectedVisit.id,
      destination,
      reason,
      referralDate,
    });
    resetForm();
    setSuccessMsg(translate("referral.saved"));
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {translate("page.referrals.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {translate("page.referrals.subtitle")}
        </p>
      </div>

      <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
        {translate("referral.demoNote")}
      </p>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="p-4">
          <Input
            placeholder={translate("referral.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search />}
            aria-label={translate("referral.searchAria")}
          />
          <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
            {filteredVisits.length === 0 && (
              <p className="p-2 text-sm text-muted-foreground">
                {translate("referral.noMatchingVisits")}
              </p>
            )}
            {filteredVisits.map((visit) => {
              const employee = employeeFor(visit.employeeId);
              const active = visit.id === selectedVisitId;
              return (
                <button
                  key={visit.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setSelectedVisitId(visit.id);
                    setSuccessMsg(null);
                    resetForm();
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                    active
                      ? "border-primary-300 bg-primary-50"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <Avatar name={employee?.fullName ?? translate("referral.patientFallback")} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {employee?.fullName ?? translate("referral.patientFallback")}
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
              <ExternalLink className="size-6 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {translate("referral.selectPrompt")}
              </p>
            </Card>
          )}

          {selectedVisit && (
            <>
              <Card className="p-4">
                <div className="mb-3 flex items-center gap-3">
                  <Avatar name={selectedEmployee?.fullName ?? translate("referral.patientFallback")} />
                  <div>
                    <p className="font-medium text-foreground">
                      {selectedEmployee?.fullName ?? translate("referral.patientFallback")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedVisit.visitNumber} · {formatDate(selectedVisit.date)}
                    </p>
                  </div>
                </div>

                <form className="space-y-3" onSubmit={handleSubmit}>
                  <Input
                    label={translate("referral.destination")}
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder={translate("referral.destinationPlaceholder")}
                    required
                  />
                  <div>
                    <label
                      htmlFor="referral-reason"
                      className="mb-1 block text-sm font-medium text-text-secondary"
                    >
                      {translate("referral.reason")}
                    </label>
                    <textarea
                      id="referral-reason"
                      className="w-full rounded-lg border border-input p-2 text-sm"
                      rows={3}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={translate("referral.reasonPlaceholder")}
                      required
                    />
                  </div>
                  <Input
                    label={translate("referral.date")}
                    type="date"
                    value={referralDate}
                    onChange={(e) => setReferralDate(e.target.value)}
                    required
                  />

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
                    <Button type="button" variant="ghost" onClick={resetForm}>
                      {translate("referral.clear")}
                    </Button>
                    <Button
                      type="submit"
                      disabled={!destination.trim() || !reason.trim()}
                    >
                      <FileText className="size-4" />
                      {translate("referral.save")}
                    </Button>
                  </div>
                </form>
              </Card>

              <Card className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <ExternalLink className="size-4 text-muted-foreground" aria-hidden="true" />
                  <h2 className="text-sm font-medium text-foreground">
                    {translate("referral.history")}
                  </h2>
                  {history.length > 0 && (
                    <Badge variant="info">{history.length}</Badge>
                  )}
                </div>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {translate("referral.emptyHistory")}
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {history.map((referral) => (
                      <li key={referral.id} className="space-y-1 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-foreground">
                            {referral.destination}
                          </p>
                          <Badge variant="success">
                            {translate("referral.status.issued")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(referral.referralDate)}
                          {referral.createdByName ? ` · ${referral.createdByName}` : ""}
                        </p>
                        <p className="text-sm text-text-secondary">{referral.reason}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
