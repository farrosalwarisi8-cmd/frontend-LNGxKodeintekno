"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, Save, CheckCircle2, ExternalLink, Pill } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { can } from "@/lib/rbac";
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
import { formatDate, formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import type { DispenseItem } from "@/lib/store";

export default function VisitDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useCurrentUser();
  const visit = useStore((s) => s.visits.find((v) => v.id === params.id));
  const employee = useStore((s) => s.employees.find((e) => e.id === visit?.employeeId));
  const diagnoses = useStore((s) => s.diagnoses);
  const medicines = useStore((s) => s.medicines);
  const stockBatches = useStore((s) => s.stockBatches);
  const dispensings = useStore((s) => s.dispensings);
  const locations = useStore((s) => s.locations);
  const updateVisit = useStore((s) => s.updateVisit);
  const referVisit = useStore((s) => s.referVisit);
  const dispense = useStore((s) => s.dispense);

  const [form, setForm] = useState({
    chiefComplaint: visit?.chiefComplaint ?? "",
    initialExam: visit?.initialExam ?? "",
    diagnosisIds: visit?.diagnosisIds ?? [],
    diagnosisNote: visit?.diagnosisNote ?? "",
    treatment: visit?.treatment ?? "",
    doctorNote: visit?.doctorNote ?? "",
  });
  const [dispenseItems, setDispenseItems] = useState<DispenseItem[]>([]);
  const [selMedicine, setSelMedicine] = useState("");
  const [selBatch, setSelBatch] = useState("");
  const [selQty, setSelQty] = useState("1");
  const [referOpen, setReferOpen] = useState(false);
  const [referFacility, setReferFacility] = useState("");
  const [referReason, setReferReason] = useState("");

  if (!user || !visit || !employee) {
    return <div className="text-muted-foreground">Kunjungan tidak ditemukan.</div>;
  }

  const visitId = visit.id;
  const seeClinical = can(user.role, "view-clinical-notes");
  const canManage = user.role === "admin" || user.role === "clinic" || user.role === "doctor";
  const isOpen = !["Completed", "Referred"].includes(visit.status);

  const batchOptions = stockBatches.filter((b) => b.medicineId === selMedicine);
  const visitDispensings = dispensings.filter((d) => d.visitId === visitId);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function saveExam() {
    updateVisit(visitId, {
      chiefComplaint: form.chiefComplaint,
      initialExam: form.initialExam,
      diagnosisIds: form.diagnosisIds,
      diagnosisNote: form.diagnosisNote,
      treatment: form.treatment,
      doctorNote: form.doctorNote,
    });
    toast.success("Pemeriksaan disimpan.");
  }

  function startConsultation() {
    updateVisit(visitId, { status: "In Consultation" });
    toast.success("Konsultasi dimulai.");
  }

  function addDispense() {
    if (!selMedicine || !selBatch || !selQty) {
      toast.error("Pilih obat, batch, dan jumlah.");
      return;
    }
    const qty = parseInt(selQty, 10);
    if (Number.isNaN(qty) || qty <= 0) {
      toast.error("Jumlah tidak valid.");
      return;
    }
    const batch = stockBatches.find((b) => b.id === selBatch);
    if (batch && qty > batch.quantity) {
      toast.error("Jumlah melebihi stok tersedia.");
      return;
    }
    setDispenseItems((items) => {
      const existing = items.find((i) => i.batchId === selBatch);
      if (existing) {
        return items.map((i) => (i.batchId === selBatch ? { ...i, quantity: i.quantity + qty } : i));
      }
      return [...items, { medicineId: selMedicine, batchId: selBatch, quantity: qty }];
    });
    setSelMedicine("");
    setSelBatch("");
    setSelQty("1");
  }

  function finishWithoutMedicine() {
    saveExam();
    updateVisit(visitId, { status: "Completed" });
    toast.success("Kunjungan selesai.");
  }

  function doDispense() {
    saveExam();
    if (dispenseItems.length === 0) {
      toast.error("Tambahkan obat untuk dispensing.");
      return;
    }
    const res = dispense(visitId, dispenseItems);
    if (res.ok) toast.success("Obat diberikan, stok berkurang.");
    else toast.error(res.error ?? "Gagal dispensing.");
  }

  function doRefer() {
    if (!referFacility.trim() || !referReason.trim()) {
      toast.error("Lengkapi fasilitas dan alasan rujukan.");
      return;
    }
    saveExam();
    referVisit(visitId, referFacility, referReason);
    setReferOpen(false);
    toast.success("Kunjungan dirujuk.");
  }

  return (
    <div className="space-y-4">
      <PageHeader title={`Kunjungan ${visit.visitNumber}`} description={`${employee.fullName} (${employee.employeeId})`}>
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft /> Kembali
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge value={visit.status} kind="visit" />
        <span className="text-sm text-muted-foreground">Antrean #{visit.queueNumber}</span>
        <span className="text-sm text-muted-foreground">{locations.find((l) => l.id === visit.locationId)?.name}</span>
        <span className="text-sm text-muted-foreground">{formatDate(visit.date)} {visit.time}</span>
      </div>

      {isOpen && canManage && visit.status === "Registered" && (
        <Button onClick={startConsultation}>Mulai Konsultasi</Button>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Pemeriksaan Klinis</CardTitle>
              <CardDescription>Keluhan, pemeriksaan, diagnosis, dan tindakan.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Keluhan utama</Label>
                <Textarea value={form.chiefComplaint} disabled={!isOpen} onChange={(e) => set("chiefComplaint", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Pemeriksaan awal</Label>
                <Textarea value={form.initialExam} disabled={!isOpen} onChange={(e) => set("initialExam", e.target.value)} placeholder="TD, nadi, suhu, dll." />
              </div>

              <div className="space-y-2">
                <Label>Diagnosis (ICD-10)</Label>
                <div className="grid gap-1.5 md:grid-cols-2">
                  {diagnoses.map((d) => {
                    const checked = form.diagnosisIds.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? "border-primary bg-primary/5" : ""} ${isOpen ? "cursor-pointer" : "opacity-60"}`}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={checked}
                          disabled={!isOpen}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...form.diagnosisIds, d.id]
                              : form.diagnosisIds.filter((x) => x !== d.id);
                            set("diagnosisIds", next);
                          }}
                        />
                        <span>
                          <span className="font-medium">{d.code}</span> — {d.description}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tindakan</Label>
                <Textarea value={form.treatment} disabled={!isOpen} onChange={(e) => set("treatment", e.target.value)} placeholder="Tindakan dan terapi yang diberikan" />
              </div>
              <div className="space-y-2">
                <Label>Catatan dokter</Label>
                <Textarea value={form.doctorNote} disabled={!isOpen} onChange={(e) => set("doctorNote", e.target.value)} />
              </div>

              {isOpen && canManage && (
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={saveExam}>
                    <Save /> Simpan
                  </Button>
                  <Button variant="outline" onClick={finishWithoutMedicine}>
                    <CheckCircle2 /> Selesai (tanpa obat)
                  </Button>
                  <Button variant="outline" onClick={() => setReferOpen(true)}>
                    <ExternalLink /> Rujuk
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Obat & Dispensing</CardTitle>
              <CardDescription>Pemberian obat terhubung dengan kunjungan dan mengurangi stok otomatis.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isOpen && canManage && (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Obat</Label>
                    <Select value={selMedicine} onValueChange={(v) => { setSelMedicine(v as string); setSelBatch(""); }}>
                      <SelectTrigger className="w-52">
                        <SelectValue placeholder="Pilih obat" />
                      </SelectTrigger>
                      <SelectContent>
                        {medicines.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Batch</Label>
                    <Select value={selBatch} onValueChange={(v) => setSelBatch(v as string)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Pilih batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {batchOptions.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.batchNumber} ({b.quantity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Jumlah</Label>
                    <Input type="number" min={1} value={selQty} onChange={(e) => setSelQty(e.target.value)} className="w-20" />
                  </div>
                  <Button variant="outline" onClick={addDispense}>
                    <Plus /> Tambah
                  </Button>
                </div>
              )}

              {dispenseItems.length > 0 && (
                <div className="rounded-lg border p-2">
                  {dispenseItems.map((i) => {
                    const med = medicines.find((m) => m.id === i.medicineId);
                    const batch = stockBatches.find((b) => b.id === i.batchId);
                    return (
                      <div key={i.batchId} className="flex items-center justify-between py-1 text-sm">
                        <span className="font-medium">{med?.name}</span>
                        <span className="text-muted-foreground">
                          {batch?.batchNumber} · {i.quantity} {med?.unit}
                        </span>
                      </div>
                    );
                  })}
                  {isOpen && (
                    <Button className="mt-2 w-full" onClick={doDispense}>
                      <Pill /> Konfirmasi Dispensing & Selesai
                    </Button>
                  )}
                </div>
              )}

              {visitDispensings.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Obat yang telah diberikan:</p>
                  {visitDispensings.map((d) => {
                    const med = medicines.find((m) => m.id === d.medicineId);
                    return (
                      <div key={d.id} className="flex items-center justify-between py-0.5 text-sm">
                        <span>{med?.name}</span>
                        <span className="text-muted-foreground">{d.quantity} {med?.unit}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {!seeClinical && user.role === "hr" && (
            <Card>
              <CardHeader>
                <CardTitle>Informasi Terbatas</CardTitle>
                <CardDescription>
                  Akun HR tidak menampilkan diagnosis atau catatan klinis.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Info label="Keluhan" value={visit.chiefComplaint} />
              {seeClinical && (
                <>
                  <Info label="Diagnosis" value={form.diagnosisIds.map((id) => diagnoses.find((d) => d.id === id)?.code).filter(Boolean).join(", ") || "—"} />
                  <Info label="Tindakan" value={visit.treatment} />
                </>
              )}
              {visit.referralFacility && (
                <>
                  <Info label="Rujukan ke" value={visit.referralFacility} />
                  <Info label="Alasan" value={visit.referralReason ?? ""} />
                </>
              )}
              <Info label="Terdaftar" value={formatDateTime(visit.createdAt)} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={referOpen} onOpenChange={setReferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rujukan</DialogTitle>
            <DialogDescription>Simpan fasilitas tujuan dan alasan rujukan.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Fasilitas tujuan *</Label>
              <Input value={referFacility} onChange={(e) => setReferFacility(e.target.value)} placeholder="mis. RS Umum Daerah" />
            </div>
            <div className="space-y-2">
              <Label>Alasan rujukan *</Label>
              <Textarea value={referReason} onChange={(e) => setReferReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReferOpen(false)}>
              Batal
            </Button>
            <Button onClick={doRefer}>Simpan Rujukan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value || "—"}</span>
    </div>
  );
}
