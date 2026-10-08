"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  UserRound,
  Building2,
  Phone,
  FileText,
  FileCheck2,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertTriangle,
  ShieldCheck,
  Upload,
  X,
  WifiOff,
} from "lucide-react";
import type { CreatePersonDraft, IdentifierType, Sex, CreatedPersonResult, DuplicateCheckResult } from "../api/people.types";
import { patientService } from "@/lib/services/patient.service";
import { useDraft, EMPTY_DRAFT } from "../hooks/use-draft";
import { useOnlineStatus } from "../hooks/use-online-status";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Card } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Modal } from "@/shared/components/design-system/modal";
import { ORGANIZATIONS, ORG_UNITS, SITES, JOB_TASKS } from "../fixtures/people.fixtures";
import { maskIdentifier } from "@/shared/utils/masking";
import {
  validateFullName,
  validateIdentifier,
  validateBirthDate,
  validateSex,
  validateEmployeeNo,
  validateEmail,
  validatePhone,
  validateConsentType,
  validateConsentVersion,
} from "@/shared/utils/validation";
import { formatDate } from "@/shared/utils/date";
import { EmailPreview } from "./email-preview";

const STEPS = [
  { id: 1, label: "Identitas", icon: UserRound },
  { id: 2, label: "Penempatan", icon: Building2 },
  { id: 3, label: "Kontak", icon: Phone },
  { id: 4, label: "Dokumen", icon: FileText },
  { id: 5, label: "Consent & Review", icon: FileCheck2 },
];

export function RegistrationWizard() {
  const router = useRouter();
  const isOnline = useOnlineStatus();
  const { draft, step, savedAt, hasSavedDraft, save, clear } = useDraft();

  const [currentStep, setCurrentStep] = useState(step);
  const [formData, setFormData] = useState<CreatePersonDraft>(() => draft ?? EMPTY_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string; name: string; size: number; tamperCheck: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<CreatedPersonResult | null>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const updateField = useCallback(<K extends keyof CreatePersonDraft>(key: K, value: CreatePersonDraft[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }, []);

  const validateStep = (stepNum: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNum === 1) {
      const nameErr = validateFullName(formData.fullName);
      if (!nameErr.valid) newErrors.fullName = nameErr.message!;
      const idErr = validateIdentifier(formData.identifierValue, formData.identifierType);
      if (!idErr.valid) newErrors.identifierValue = idErr.message!;
      const birthErr = validateBirthDate(formData.birthDate);
      if (!birthErr.valid) newErrors.birthDate = birthErr.message!;
      const sexErr = validateSex(formData.sex);
      if (!sexErr.valid) newErrors.sex = sexErr.message!;
      const empErr = validateEmployeeNo(formData.employeeNo);
      if (!empErr.valid) newErrors.employeeNo = empErr.message!;
    }

    if (stepNum === 2) {
      if (!formData.organizationId) newErrors.organizationId = "Organisasi wajib dipilih.";
      if (!formData.orgUnitId) newErrors.orgUnitId = "Unit kerja wajib dipilih.";
      if (!formData.siteId) newErrors.siteId = "Site wajib dipilih.";
    }

    if (stepNum === 3) {
      const emailErr = validateEmail(formData.email);
      if (!emailErr.valid) newErrors.email = emailErr.message!;
      const phoneErr = validatePhone(formData.phone);
      if (!phoneErr.valid) newErrors.phone = phoneErr.message!;
    }

    if (stepNum === 5) {
      const typeErr = validateConsentType(formData.consentType);
      if (!typeErr.valid) newErrors.consentType = typeErr.message!;
      const verErr = validateConsentVersion(formData.consentVersion);
      if (!verErr.valid) newErrors.consentVersion = verErr.message!;
      if (!acknowledged) newErrors.acknowledged = "Anda harus mencentang persetujuan.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkDuplicate = async () => {
    if (!formData.identifierValue) return;
    try {
      const result = await patientService.duplicateCheck({
        identifierType: formData.identifierType,
        identifierValue: formData.identifierValue,
        fullName: formData.fullName,
      });
      setDuplicateResult(result);
      if (result.severity === "BLOCK") {
        setShowDuplicateModal(true);
      }
    } catch {
      // silently fail
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;
    const nextStep = Math.min(currentStep + 1, 5);
    setCurrentStep(nextStep);
    save(formData, nextStep);
  };

  const handleBack = () => {
    const prevStep = Math.max(currentStep - 1, 1);
    setCurrentStep(prevStep);
    save(formData, prevStep);
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;
    if (!isOnline) return;

    setSubmitting(true);
    try {
      const result = await patientService.create({
        ...formData,
        documentIds: uploadedFiles.map((f) => f.id),
      });
      setSubmitResult(result);
      clear();
    } catch (e) {
      setErrors({ submit: e instanceof Error ? e.message : "Terjadi kesalahan." });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveDraft = () => {
    save(formData, currentStep);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);
        const token = localStorage.getItem("kodein_token");
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1"}/documents/upload`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          body: formData,
        });
        if (!res.ok) throw new Error("Upload dokumen gagal.");
        const result = await res.json();
        setUploadedFiles((prev) => [...prev, { id: result.documentId, name: result.name, size: result.size, tamperCheck: result.tamperCheck }]);
      }
    } catch (err) {
      setErrors({ upload: err instanceof Error ? err.message : "Upload gagal." });
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (id: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  if (submitResult) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="p-8 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-success-100">
            <Check className="size-8 text-success-600" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Pekerja berhasil didaftarkan</h1>
          <p className="mt-2 text-sm text-slate-500">Data pekerja dan consent telah dibuat.</p>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
            <div className="space-y-2 text-sm">
              <p><span className="font-medium text-slate-700">MRN:</span> <span className="font-mono text-slate-900">{submitResult.mrn}</span></p>
              <p><span className="font-medium text-slate-700">Employee ID:</span> <span className="font-mono text-slate-900">{submitResult.employeeId}</span></p>
              <p><span className="font-medium text-slate-700">Consent Status:</span> <Badge variant="warning">Pending</Badge></p>
              <p><span className="font-medium text-slate-700">Delivery:</span> <Badge variant={submitResult.deliveryStatus === "SIMULATED_SENT" ? "success" : "danger"}>{submitResult.deliveryStatus === "SIMULATED_SENT" ? "Terkirim (simulasi)" : "Gagal"}</Badge></p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={() => setShowEmailPreview(true)}>
              Buka preview email
            </Button>
            <Button className="flex-1" onClick={() => router.push(`/people/${submitResult.patientId}`)}>
              Buka profil
            </Button>
          </div>
        </Card>

        <EmailPreview
          open={showEmailPreview}
          onClose={() => setShowEmailPreview(false)}
          recipientName={formData.fullName}
          recipientEmail={formData.email}
          consentLink={submitResult.consentLink}
        />
      </div>
    );
  }

  const filteredOrgUnits = ORG_UNITS.filter(
    (ou) => !formData.organizationId || ou.organizationId === formData.organizationId
  );
  const filteredSites = SITES.filter(
    (s) => !formData.orgUnitId || s.orgUnitId === formData.orgUnitId
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Registrasi Pekerja Baru</h1>
        <p className="text-sm text-slate-500">Lengkapi data pekerja dalam 5 langkah mudah.</p>
      </div>

      <div className="mb-6">
        {/* items-start: semua lingkaran sejajar walau label baris 2 punya tinggi berbeda */}
        <div className="flex items-start justify-between">
          {STEPS.map((s, index) => {
            const Icon = s.icon;
            const isActive = currentStep === s.id;
            const isCompleted = currentStep > s.id;
            return (
              <div key={s.id} className="flex min-w-0 flex-1 items-start">
                <div className="flex min-w-0 flex-col items-center">
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors sm:size-10 ${
                      isCompleted
                        ? "border-primary-600 bg-primary-600 text-white"
                        : isActive
                          ? "border-primary-600 bg-white text-primary-600"
                          : "border-slate-200 bg-white text-slate-400"
                    }`}
                    aria-current={isActive ? "step" : undefined}
                  >
                    {isCompleted ? <Check className="size-4" /> : <Icon className="size-4" />}
                  </div>
                  {/* Label hanya di layar >= sm; di mobile cukup indikator + keterangan di bawah. */}
                  <span
                    className={`mt-1 hidden max-w-24 text-center text-xs font-medium leading-tight sm:block ${
                      isActive ? "text-primary-600" : "text-slate-400"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`mx-1.5 mt-4 h-0.5 min-w-2 flex-1 sm:mx-3 sm:mt-5 ${
                      currentStep > s.id ? "bg-primary-600" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-center text-xs font-medium text-slate-500 sm:hidden">
          Langkah {currentStep} dari {STEPS.length} ·{" "}
          <span className="text-primary-700">{STEPS.find((s) => s.id === currentStep)?.label}</span>
        </p>
      </div>

      {!isOnline && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-warning-50 p-3 text-sm text-warning-600">
          <WifiOff className="size-4 shrink-0" />
          <span>Anda sedang offline. Submit consent dinonaktifkan. Draft dapat disimpan secara lokal.</span>
        </div>
      )}

      <Card className="p-6">
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Identitas Pekerja</h2>
            <Input
              label="Nama Lengkap"
              value={formData.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
              error={errors.fullName}
              placeholder="Masukkan nama lengkap"
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Tipe Identifier"
                value={formData.identifierType}
                onChange={(e) => updateField("identifierType", e.target.value as IdentifierType)}
                options={[
                  { value: "NIK", label: "NIK" },
                  { value: "PASSPORT", label: "Passport" },
                  { value: "KITAS", label: "KITAS" },
                ]}
              />
              <Input
                label="Nomor Identifier"
                value={formData.identifierValue}
                onChange={(e) => updateField("identifierValue", e.target.value)}
                error={errors.identifierValue}
                placeholder={formData.identifierType === "NIK" ? "16 digit NIK" : "Nomor passport/KITAS"}
                onBlur={checkDuplicate}
              />
            </div>
            {duplicateResult && duplicateResult.severity !== "NONE" && (
              <div className={`rounded-xl p-3 text-sm ${duplicateResult.severity === "BLOCK" ? "bg-danger-50 text-danger-700" : "bg-warning-50 text-warning-700"}`}>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>{duplicateResult.message}</span>
                </div>
                {duplicateResult.existingPerson && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => router.push(`/people/${duplicateResult.existingPerson!.id}`)}
                  >
                    Lihat profil
                  </Button>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Tanggal Lahir"
                type="date"
                value={formData.birthDate}
                onChange={(e) => updateField("birthDate", e.target.value)}
                error={errors.birthDate}
              />
              <Select
                label="Jenis Kelamin"
                value={formData.sex}
                onChange={(e) => updateField("sex", e.target.value as Sex)}
                error={errors.sex}
                options={[
                  { value: "MALE", label: "Laki-laki" },
                  { value: "FEMALE", label: "Perempuan" },
                ]}
              />
            </div>
            <Input
              label="Employee ID"
              value={formData.employeeNo}
              onChange={(e) => updateField("employeeNo", e.target.value)}
              error={errors.employeeNo}
              placeholder="EMP-XXXX"
            />
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Penempatan Pekerja</h2>
            <Select
              label="Organization"
              value={formData.organizationId}
              onChange={(e) => updateField("organizationId", e.target.value)}
              error={errors.organizationId}
              placeholder="Pilih organisasi"
              options={ORGANIZATIONS.map((o) => ({ value: o.id, label: o.name }))}
            />
            <Select
              label="Unit Kerja"
              value={formData.orgUnitId}
              onChange={(e) => updateField("orgUnitId", e.target.value)}
              error={errors.orgUnitId}
              placeholder="Pilih unit kerja"
              options={filteredOrgUnits.map((o) => ({ value: o.id, label: o.name }))}
            />
            <Select
              label="Site/Office"
              value={formData.siteId}
              onChange={(e) => updateField("siteId", e.target.value)}
              error={errors.siteId}
              placeholder="Pilih site"
              options={filteredSites.map((s) => ({ value: s.id, label: s.name }))}
            />
            <Select
              label="Job Task"
              value={formData.jobTaskId}
              onChange={(e) => updateField("jobTaskId", e.target.value)}
              placeholder="Pilih job task"
              options={JOB_TASKS.map((j) => ({ value: j.id, label: j.name }))}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Select
                label="Employment Status"
                value={formData.employmentStatus}
                onChange={(e) => updateField("employmentStatus", e.target.value as "ACTIVE" | "INACTIVE")}
                options={[
                  { value: "ACTIVE", label: "Aktif" },
                  { value: "INACTIVE", label: "Nonaktif" },
                ]}
              />
              <Input
                label="Join Date"
                type="date"
                value={formData.joinDate}
                onChange={(e) => updateField("joinDate", e.target.value)}
              />
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Kontak Pekerja</h2>
            <Input
              label="Email Pekerja"
              type="email"
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              error={errors.email}
              placeholder="nama@perusahaan.com"
              helper="Email digunakan untuk mengirim tautan consent."
            />
            <Input
              label="Nomor Telepon"
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              error={errors.phone}
              placeholder="081234567890"
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-sm font-medium text-slate-700">Kontak Darurat</p>
              <div className="space-y-3">
                <Input
                  label="Nama"
                  value={formData.emergencyContact.name}
                  onChange={(e) =>
                    updateField("emergencyContact", { ...formData.emergencyContact, name: e.target.value })
                  }
                  placeholder="Nama kontak darurat"
                />
                <Input
                  label="Hubungan"
                  value={formData.emergencyContact.relationship}
                  onChange={(e) =>
                    updateField("emergencyContact", { ...formData.emergencyContact, relationship: e.target.value })
                  }
                  placeholder="Contoh: Suami, Istri, Orang tua"
                />
                <Input
                  label="Nomor Telepon"
                  value={formData.emergencyContact.phone}
                  onChange={(e) =>
                    updateField("emergencyContact", { ...formData.emergencyContact, phone: e.target.value })
                  }
                  placeholder="081234567890"
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Dokumen Pendukung</h2>
            <div className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <Upload className="mx-auto mb-3 size-8 text-slate-400" />
              <p className="text-sm font-medium text-slate-700">Upload dokumen pendukung</p>
              <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG · Maksimum 5 MB per file</p>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={uploading || !isOnline}
              />
              <label
                htmlFor="file-upload"
                className={`mt-3 inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 ${(uploading || !isOnline) ? "pointer-events-none opacity-50" : ""}`}
              >
                {uploading ? "Mengupload..." : "Pilih File"}
              </label>
            </div>
            {errors.upload && (
              <p className="text-sm text-danger-600">{errors.upload}</p>
            )}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    <FileText className="size-5 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <Badge variant={file.tamperCheck === "PASSED" ? "success" : "warning"}>
                      {file.tamperCheck}
                    </Badge>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label="Hapus file"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Consent & Review</h2>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-700">Ringkasan Data</h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium text-slate-600">Nama:</span> <span className="text-slate-900">{formData.fullName}</span></p>
                <p><span className="font-medium text-slate-600">Identifier:</span> <span className="font-mono text-slate-900">{maskIdentifier(formData.identifierValue, formData.identifierType)}</span></p>
                <p><span className="font-medium text-slate-600">Employee ID:</span> <span className="font-mono text-slate-900">{formData.employeeNo}</span></p>
                <p><span className="font-medium text-slate-600">Email:</span> <span className="text-slate-900">{formData.email}</span></p>
                <p><span className="font-medium text-slate-600">Dokumen:</span> <span className="text-slate-900">{uploadedFiles.length} file</span></p>
              </div>
            </div>

            <Select
              label="Tipe Consent"
              value={formData.consentType}
              onChange={(e) => updateField("consentType", e.target.value)}
              error={errors.consentType}
              options={[
                { value: "EMR_DATA_PROCESSING", label: "Pemrosesan Data EMR" },
                { value: "HEALTH_DATA_SHARING", label: "Berbagi Data Kesehatan" },
              ]}
            />
            <Input
              label="Versi Consent"
              value={formData.consentVersion}
              onChange={(e) => updateField("consentVersion", e.target.value)}
              error={errors.consentVersion}
              placeholder="1.0"
            />

            <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
              <input
                type="checkbox"
                id="acknowledge"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 size-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="acknowledge" className="text-sm text-slate-700">
                Saya sudah memeriksa data dan memahami bahwa consent link akan dikirim ke email pekerja.
              </label>
            </div>
            {errors.acknowledged && (
              <p className="text-sm text-danger-600">{errors.acknowledged}</p>
            )}

            {errors.submit && (
              <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
                {errors.submit}
              </div>
            )}
          </div>
        )}

        {/* Mobile: tombol ditumpuk full-width (tidak melebar ke luar layar); desktop: satu baris. */}
        <div className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="w-full justify-center sm:w-auto"
          >
            <ChevronLeft className="size-4" />
            Kembali
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button variant="outline" onClick={handleSaveDraft} className="w-full justify-center sm:w-auto">
              Simpan draft
            </Button>
            {currentStep < 5 ? (
              <Button onClick={handleNext} className="w-full justify-center sm:w-auto">
                Lanjut
                <ChevronRight className="size-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                loading={submitting}
                disabled={!isOnline}
                className="w-full justify-center sm:w-auto"
              >
                <ShieldCheck className="size-4" />
                Simpan & kirim consent
              </Button>
            )}
          </div>
        </div>
      </Card>

      {hasSavedDraft && savedAt && (
        <p className="mt-3 text-center text-xs text-slate-400">
          Draft tersimpan otomatis · {formatDate(savedAt)}
        </p>
      )}

      <Modal
        open={showDuplicateModal}
        onClose={() => setShowDuplicateModal(false)}
        title="Tidak dapat melanjutkan"
        description="Identifier ini sudah terdaftar sebagai pekerja aktif. Periksa kembali data atau buka profil yang sudah ada."
        size="sm"
      >
        <div className="flex flex-col gap-3">
          {duplicateResult?.existingPerson && (
            <Button
              variant="outline"
              onClick={() => {
                setShowDuplicateModal(false);
                router.push(`/people/${duplicateResult.existingPerson!.id}`);
              }}
            >
              Buka profil
            </Button>
          )}
          <Button variant="ghost" onClick={() => setShowDuplicateModal(false)}>
            Tutup
          </Button>
        </div>
      </Modal>
    </div>
  );
}
