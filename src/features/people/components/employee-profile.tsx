"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Phone,
  Building2,
  FileText,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { usePerson } from "../hooks/use-person";
import { Can, useCan } from "@/components/can";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, ConsentStatusBadge, EmploymentStatusBadge } from "@/components/ui/badge";
import { notificationService } from "@/lib/services/notification.service";
import { patientService } from "@/lib/services/patient.service";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { ConsentTimeline } from "./consent-timeline";
import { EmailPreview } from "./email-preview";
import { maskIdentifier, maskEmail, maskPhone } from "@/shared/utils/masking";
import { formatDate, formatDateTime } from "@/shared/utils/date";

type Tab = "overview" | "identity" | "consent" | "documents" | "activity";

export function EmployeeProfile({ patientId }: { patientId: string }) {
  const { data: person, loading, error, refetch } = usePerson(patientId);
  const can = useCan();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  /**
   * Status pengiriman consent diambil dari backend (notifikasi CONSENT_DISPATCHED).
   * Endpoint `GET /patients/:id/profile` tidak menyertakan consent, dan tidak ada
   * endpoint baca consent per pasien — jadi status "belum ada consent" tidak boleh
   * disimpulkan dari ketiadaan field tersebut.
   */
  const [consentDispatch, setConsentDispatch] = useState<{ status: string; at?: string } | null>(null);
  const [consentLoaded, setConsentLoaded] = useState(false);
  const [resend, setResend] = useState<{ loading: boolean; error: string; link: string }>({
    loading: false,
    error: "",
    link: "",
  });

  const loadConsentDispatch = useCallback(async () => {
    try {
      const notifications = await notificationService.getAll();
      const mine = (notifications ?? [])
        .filter((n) => n.related_type === "CONSENT_DISPATCHED" && n.patient_id === patientId)
        .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
      setConsentDispatch(mine[0] ? { status: mine[0].status, at: mine[0].created_at } : null);
    } catch {
      setConsentDispatch(null);
    } finally {
      setConsentLoaded(true);
    }
  }, [patientId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConsentDispatch();
  }, [loadConsentDispatch]);

  const handleResendConsent = async () => {
    setResend({ loading: true, error: "", link: "" });
    const result = await patientService.sendConsent(patientId, "DATA_PROCESSING");
    if (result.success) {
      setResend({ loading: false, error: "", link: result.consentLink ?? "" });
      setShowEmailPreview(true);
      await loadConsentDispatch();
    } else {
      setResend({ loading: false, error: result.deliveryError ?? "Permintaan consent gagal dikirim.", link: "" });
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !person) {
    return <ErrorState onRetry={refetch} />;
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "identity", label: "Identity & Employment" },
    { id: "consent", label: "Consent" },
    { id: "documents", label: "Documents" },
    ...(can("people.edit") ? [{ id: "activity" as Tab, label: "Activity" }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/people">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">People</span>
          </Button>
        </Link>
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={person.fullName} size="lg" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">{person.fullName}</h1>
              <p className="text-sm text-muted-foreground">
                {person.mrn} · {person.employeeNo} · {person.siteName}
              </p>
              <div className="mt-1 flex items-center gap-2">
                {consentDispatch ? (
                  consentDispatch.status === "FAILED" ? (
                    <Badge variant="danger">Pengiriman consent gagal</Badge>
                  ) : (
                    <Badge variant="warning">Consent terkirim · menunggu keputusan</Badge>
                  )
                ) : consentLoaded ? (
                  <Badge variant="outline">Consent belum dikirim</Badge>
                ) : null}
                <EmploymentStatusBadge status={person.employmentStatus} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Can action="people.send-consent">
              <Button variant="outline" size="sm" loading={resend.loading} onClick={handleResendConsent}>
                <RefreshCw className="size-3.5" />
                Resend consent
              </Button>
            </Can>
          </div>
        </div>
        {resend.error && (
          <p className="mt-3 rounded-xl bg-danger-50 p-3 text-sm text-danger-700" role="alert">
            {resend.error}
          </p>
        )}
      </Card>

      <div className="border-b border-border">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-primary-600 text-primary-600"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "overview" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-4 text-muted-foreground" />
                Employment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Organisasi:</span> {person.organizationName}</p>
              <p><span className="text-muted-foreground">Unit:</span> {person.orgUnitName}</p>
              <p><span className="text-muted-foreground">Site:</span> {person.siteName}</p>
              <p><span className="text-muted-foreground">Job Task:</span> {person.jobTaskName ?? "—"}</p>
              <p><span className="text-muted-foreground">Join Date:</span> {formatDate(person.joinDate)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="size-4 text-muted-foreground" />
                Kontak
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Email:</span> {maskEmail(person.email)}</p>
              <p><span className="text-muted-foreground">Telepon:</span> {maskPhone(person.phone)}</p>
              <p><span className="text-muted-foreground">Kontak Darurat:</span> {person.emergencyContact.name}</p>
              <p><span className="text-muted-foreground">Hubungan:</span> {person.emergencyContact.relationship}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldCheck className="size-4 text-muted-foreground" />
                Consent Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {consentDispatch ? (
                <>
                  <div className="flex items-center gap-3">
                    <Badge variant={consentDispatch.status === "FAILED" ? "danger" : "warning"}>
                      {consentDispatch.status === "FAILED" ? "Pengiriman gagal" : "Terkirim · menunggu keputusan"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">status pengiriman: {consentDispatch.status}</span>
                  </div>
                  {consentDispatch.at && (
                    <p className="text-xs text-muted-foreground">Dikirim: {formatDateTime(consentDispatch.at)}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {consentLoaded
                    ? "Belum ada permintaan consent yang tercatat di backend."
                    : "Memuat status consent..."}
                </p>
              )}
              {/* Kejujuran data: keputusan consent tidak diekspos API. */}
              <p className="text-xs text-muted-foreground">
                Keputusan consent (pending/granted/expired) belum tersedia dari API — endpoint baca consent per
                pekerja belum ada.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="size-4 text-muted-foreground" />
                Dokumen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-secondary">{person.documents.length} dokumen terunggah</p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "identity" && (
        <Card>
          <CardHeader>
            <CardTitle>Identity & Employment Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Nama Lengkap</dt>
                <dd className="mt-1 text-sm text-foreground">{person.fullName}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">MRN</dt>
                <dd className="mt-1 font-mono text-sm text-foreground">{person.mrn}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Employee ID</dt>
                <dd className="mt-1 font-mono text-sm text-foreground">{person.employeeNo}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Identifier</dt>
                <dd className="mt-1 font-mono text-sm text-foreground">
                  {maskIdentifier(person.identifierValue, person.identifierType)}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Tanggal Lahir</dt>
                <dd className="mt-1 text-sm text-foreground">{formatDate(person.birthDate)}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Jenis Kelamin</dt>
                <dd className="mt-1 text-sm text-foreground">{person.sex === "MALE" ? "Laki-laki" : "Perempuan"}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Status Employment</dt>
                <dd className="mt-1"><EmploymentStatusBadge status={person.employmentStatus} /></dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Join Date</dt>
                <dd className="mt-1 text-sm text-foreground">{formatDate(person.joinDate)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {activeTab === "consent" && (
        <div className="space-y-4">
          {person.consent ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Consent Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Tipe</dt>
                      <dd className="mt-1 text-sm text-foreground">{person.consent.type}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Versi</dt>
                      <dd className="mt-1 text-sm text-foreground">{person.consent.version}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Status</dt>
                      <dd className="mt-1"><ConsentStatusBadge status={person.consent.status} /></dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Dibuat</dt>
                      <dd className="mt-1 text-sm text-foreground">{formatDateTime(person.consent.createdAt)}</dd>
                    </div>
                    {person.consent.sentAt && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Dikirim</dt>
                        <dd className="mt-1 text-sm text-foreground">{formatDateTime(person.consent.sentAt)}</dd>
                      </div>
                    )}
                    {person.consent.decidedAt && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground">Diputuskan</dt>
                        <dd className="mt-1 text-sm text-foreground">{formatDateTime(person.consent.decidedAt)}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground">Kedaluwarsa</dt>
                      <dd className="mt-1 text-sm text-foreground">{formatDateTime(person.consent.expiresAt)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Consent Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <ConsentTimeline events={person.consent?.events ?? []} />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card className="p-8 text-center">
              <ShieldCheck className="mx-auto mb-3 size-8 text-muted-foreground" />
              <p className="text-sm text-text-secondary">
                {consentDispatch
                  ? `Permintaan consent sudah dikirim (status pengiriman backend: ${consentDispatch.status}).`
                  : "Belum ada permintaan consent yang tercatat di backend."}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Rincian keputusan consent belum dapat ditampilkan: API hanya menyediakan endpoint kirim
                (POST /consents/send) dan verifikasi publik, tanpa endpoint baca per pekerja.
              </p>
              <Can action="people.send-consent">
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  loading={resend.loading}
                  onClick={handleResendConsent}
                >
                  <RefreshCw className="size-3.5" />
                  Kirim consent
                </Button>
              </Can>
              {resend.error && <p className="mt-3 text-sm text-danger-600">{resend.error}</p>}
            </Card>
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <Card>
          <CardHeader>
            <CardTitle>Dokumen Pekerja</CardTitle>
          </CardHeader>
          <CardContent>
            {person.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada dokumen.</p>
            ) : (
              <div className="space-y-2">
                {person.documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                    <FileText className="size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-secondary">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.type} · {(doc.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <Badge variant={doc.tamperCheck === "PASSED" ? "success" : "warning"}>
                      {doc.tamperCheck}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "activity" && can("people.edit") && (
        <Card>
          <CardHeader>
            <CardTitle>Activity Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                <CheckCircle2 className="size-5 text-success-600" />
                <div>
                  <p className="text-sm font-medium text-foreground">Pekerja didaftarkan</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(person.createdAt)}</p>
                </div>
              </div>
              {person.consent && (
                <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <ShieldCheck className="size-5 text-primary-600" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Consent dibuat</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(person.consent.createdAt)}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tautan consent hanya dari respons backend setelah permintaan dikirim. */}
      <EmailPreview
        open={showEmailPreview}
        onClose={() => setShowEmailPreview(false)}
        recipientName={person.fullName}
        recipientEmail={maskEmail(person.email)}
        consentLink={resend.link}
      />
    </div>
  );
}
