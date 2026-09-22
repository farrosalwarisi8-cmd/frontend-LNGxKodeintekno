"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, FileText, Save, Send, Upload, XCircle, RotateCcw, BadgeCheck, CheckCircle2 } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { can } from "@/lib/rbac";
import { HEALTH_STATUS_OPTIONS } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import type { HealthStatus } from "@/lib/types";

export default function MCUDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useCurrentUser();
  const mcu = useStore((s) => s.mcus.find((m) => m.id === params.id));
  const employee = useStore((s) => s.employees.find((e) => e.id === mcu?.employeeId));
  const updateMCUResult = useStore((s) => s.updateMCUResult);
  const addMCUDocument = useStore((s) => s.addMCUDocument);
  const submitMCU = useStore((s) => s.submitMCU);
  const requestRevision = useStore((s) => s.requestRevision);
  const resubmitMCU = useStore((s) => s.resubmitMCU);
  const approveMCU = useStore((s) => s.approveMCU);
  const rejectMCU = useStore((s) => s.rejectMCU);
  const issueCertificate = useStore((s) => s.issueCertificate);

  const [result, setResult] = useState(mcu?.result ?? { bloodPressure: "", heartRate: "", heightCm: "", weightKg: "", vision: "", hearing: "", notes: "" });
  const [docName, setDocName] = useState("");
  const [docType, setDocType] = useState("Lab Result");
  const [noteDialog, setNoteDialog] = useState<"revision" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [decisionDialog, setDecisionDialog] = useState(false);

  if (!user || !mcu || !employee) {
    return <div className="text-muted-foreground">MCU tidak ditemukan.</div>;
  }

  const canInput = can(user.role, "input-mcu-result");
  const canReview = can(user.role, "review-mcu");
  const canIssue = can(user.role, "issue-certificate");
  const editable = canInput && (mcu.status === "Draft" || mcu.status === "Revision Required");
  const canSubmit = canInput && mcu.status === "Draft";
  const canResubmit = canInput && mcu.status === "Revision Required";
  const pendingReview = mcu.status === "Submitted" || mcu.status === "Resubmitted";
  const mcuId = mcu.id;

  function saveResult() {
    updateMCUResult(mcuId, result);
    toast.success("Hasil pemeriksaan disimpan.");
  }

  function doSubmit() {
    updateMCUResult(mcuId, result);
    const ok = submitMCU(mcuId);
    if (ok) toast.success("MCU berhasil disubmit.");
    else toast.error("Lengkapi hasil pemeriksaan wajib terlebih dahulu.");
  }

  function doResubmit() {
    updateMCUResult(mcuId, result);
    resubmitMCU(mcuId);
    toast.success("MCU diresubmit.");
  }

  function doRevision() {
    if (!note.trim()) {
      toast.error("Catatan revisi wajib diisi.");
      return;
    }
    requestRevision(mcuId, note);
    setNote("");
    setNoteDialog(null);
    toast.success("MCU dikembalikan untuk revisi.");
  }

  function doReject() {
    if (!note.trim()) {
      toast.error("Catatan penolakan wajib diisi.");
      return;
    }
    rejectMCU(mcuId, note);
    setNote("");
    setNoteDialog(null);
    toast.success("MCU ditolak.");
  }

  function doIssue() {
    const id = issueCertificate(mcuId);
    if (id) {
      toast.success("Sertifikat diterbitkan.");
      router.push(`/certificates/${id}`);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`MCU ${mcu.mcuNumber}`} description={`Pekerja: ${employee.fullName} (${employee.employeeId})`}>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft /> Kembali
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge value={mcu.status} kind="mcu" />
        <span className="text-sm text-muted-foreground">Jenis: {mcu.type}</span>
        <span className="text-sm text-muted-foreground">Fasilitas: {mcu.facility}</span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Hasil Pemeriksaan</CardTitle>
              <CardDescription>
                {editable ? "Isi hasil terstruktur, lalu submit." : "Hasil pemeriksaan tersimpan."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <Field label="Tekanan darah *" value={result.bloodPressure} disabled={!editable} onChange={(v) => setResult((r) => ({ ...r, bloodPressure: v }))} placeholder="120/80" />
                <Field label="Denyut jantung *" value={result.heartRate} disabled={!editable} onChange={(v) => setResult((r) => ({ ...r, heartRate: v }))} placeholder="72" />
                <Field label="Tinggi badan (cm) *" value={result.heightCm} disabled={!editable} onChange={(v) => setResult((r) => ({ ...r, heightCm: v }))} />
                <Field label="Berat badan (kg) *" value={result.weightKg} disabled={!editable} onChange={(v) => setResult((r) => ({ ...r, weightKg: v }))} />
                <Field label="Penglihatan" value={result.vision} disabled={!editable} onChange={(v) => setResult((r) => ({ ...r, vision: v }))} placeholder="6/6" />
                <Field label="Pendengaran" value={result.hearing} disabled={!editable} onChange={(v) => setResult((r) => ({ ...r, hearing: v }))} placeholder="Normal" />
              </div>
              <div className="space-y-2">
                <Label>Catatan hasil</Label>
                <Textarea value={result.notes} disabled={!editable} onChange={(e) => setResult((r) => ({ ...r, notes: e.target.value }))} />
              </div>
              {editable && (
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={saveResult}>
                    <Save /> Simpan
                  </Button>
                  {canSubmit && (
                    <Button onClick={doSubmit}>
                      <Send /> Submit MCU
                    </Button>
                  )}
                  {canResubmit && (
                    <Button onClick={doResubmit}>
                      <RotateCcw /> Resubmit
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dokumen Lampiran</CardTitle>
              <CardDescription>Upload dokumen pendukung (dummy).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {mcu.documents.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <FileText className="size-4 text-muted-foreground" />
                    <span>{d.name}</span>
                    <span className="text-xs text-muted-foreground">({d.type})</span>
                  </div>
                ))}
                {mcu.documents.length === 0 && (
                  <p className="text-sm text-muted-foreground">Belum ada dokumen.</p>
                )}
              </div>
              {(editable || mcu.status === "Draft") && (
                <div className="flex gap-2">
                  <Input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Nama dokumen (mis. Hasil Lab.pdf)" className="max-w-xs" />
                  <Input value={docType} onChange={(e) => setDocType(e.target.value)} className="max-w-[140px]" />
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!docName.trim()) {
                        toast.error("Isi nama dokumen.");
                        return;
                      }
                      addMCUDocument(mcu.id, docName, docType);
                      setDocName("");
                      toast.success("Dokumen ditambahkan.");
                    }}
                  >
                    <Upload /> Tambah
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {canReview && pendingReview && (
            <Card>
              <CardHeader>
                <CardTitle>Review Dokter</CardTitle>
                <CardDescription>Setujui, minta revisi, atau tolak.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" onClick={() => setDecisionDialog(true)}>
                  <CheckCircle2 /> Setujui & Tetapkan Status
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setNoteDialog("revision")}>
                  <RotateCcw /> Minta Revisi
                </Button>
                <Button variant="outline" className="w-full text-destructive" onClick={() => setNoteDialog("reject")}>
                  <XCircle /> Tolak
                </Button>
              </CardContent>
            </Card>
          )}

          {canIssue && mcu.status === "Approved" && (
            <Card>
              <CardHeader>
                <CardTitle>Health Certificate</CardTitle>
                <CardDescription>Terbitkan sertifikat dari MCU yang disetujui.</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" onClick={doIssue}>
                  <BadgeCheck /> Terbitkan Sertifikat
                </Button>
              </CardContent>
            </Card>
          )}

          {mcu.decision && (
            <Card>
              <CardHeader>
                <CardTitle>Keputusan Dokter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <StatusBadge value={mcu.decision} kind="health" />
                {mcu.decisionNote && <p className="text-muted-foreground">{mcu.decisionNote}</p>}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {mcu.history.map((h) => (
                <div key={h.id} className="relative border-l pb-3 pl-4 last:pb-0">
                  <div className="absolute -left-1 top-1 size-2 rounded-full bg-primary" />
                  <div className="flex items-center gap-2">
                    <StatusBadge value={h.status} kind="mcu" />
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {h.byName} · {formatDateTime(h.at)}
                  </p>
                  {h.note && <p className="mt-1 text-sm text-muted-foreground">{h.note}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Revision / Reject note dialog */}
      <Dialog open={noteDialog !== null} onOpenChange={(o) => !o && setNoteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{noteDialog === "revision" ? "Minta Revisi" : "Tolak MCU"}</DialogTitle>
            <DialogDescription>
              {noteDialog === "revision"
                ? "Catatan revisi wajib diisi dan akan tampil pada timeline."
                : "Catatan alasan penolakan wajib diisi."}
            </DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tulis catatan…" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialog(null)}>
              Batal
            </Button>
            <Button variant={noteDialog === "reject" ? "destructive" : "default"} onClick={noteDialog === "revision" ? doRevision : doReject}>
              Konfirmasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decision dialog */}
      <DecisionDialog
        open={decisionDialog}
        onOpenChange={setDecisionDialog}
        onApprove={(decision, note, extra) => {
          approveMCU(mcu.id, decision, note, extra);
          setDecisionDialog(false);
          toast.success("Status kesehatan kerja ditetapkan.");
        }}
      />
    </div>
  );
}

function Field({
  label,
  value,
  disabled,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function DecisionDialog({
  open,
  onOpenChange,
  onApprove,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onApprove: (
    decision: HealthStatus,
    note: string,
    extra: { validFrom: string; validUntil: string; restriction?: string; recommendation?: string; reviewDate?: string }
  ) => void;
}) {
  const [decision, setDecision] = useState<string>("Fit to Work");
  const [note, setNote] = useState("");
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState("2027-09-22");
  const [restriction, setRestriction] = useState("");
  const [recommendation, setRecommendation] = useState("");
  const [reviewDate, setReviewDate] = useState("");

  const needRestriction = decision === "Fit with Restriction";

  function submit() {
    if (needRestriction && (!restriction.trim() || !recommendation.trim() || !reviewDate)) {
      toast.error("Restriction wajib memiliki periode dan rekomendasi.");
      return;
    }
    onApprove(decision as HealthStatus, note, {
      validFrom,
      validUntil,
      restriction: needRestriction ? restriction : undefined,
      recommendation: needRestriction ? recommendation : undefined,
      reviewDate: needRestriction ? reviewDate : undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tetapkan Status Kesehatan Kerja</DialogTitle>
          <DialogDescription>Hanya dokter berwenang yang dapat menetapkan status.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={decision} onValueChange={(v) => setDecision(v as string)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HEALTH_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Berlaku dari</Label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Berlaku sampai</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>
          </div>
          {needRestriction && (
            <>
              <div className="space-y-2">
                <Label>Restriction *</Label>
                <Textarea value={restriction} onChange={(e) => setRestriction(e.target.value)} placeholder="mis. Tidak bekerja di ketinggian > 2m" />
              </div>
              <div className="space-y-2">
                <Label>Rekomendasi kerja *</Label>
                <Textarea value={recommendation} onChange={(e) => setRecommendation(e.target.value)} placeholder="mis. Penempatan di area non-ketinggian" />
              </div>
              <div className="space-y-2">
                <Label>Tanggal review *</Label>
                <Input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>Catatan</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan keputusan (opsional)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={submit}>Setujui</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
