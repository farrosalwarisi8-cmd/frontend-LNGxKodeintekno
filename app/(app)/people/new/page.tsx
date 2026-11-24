"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
import type { CreatePersonDraft, IdentifierType, Sex, CreatedPersonResult, DuplicateCheckResult } from "@/features/people/api/people.types";
import {
  MAX_DOCUMENT_BYTES,
  formatDocumentSize,
  uploadPersonDocument,
  type UploadedPersonDocument,
} from "@/features/people/api/document-upload";
import { patientService } from "@/lib/services/patient.service";
import { useDraft, EMPTY_DRAFT } from "@/features/people/hooks/use-draft";
import { useOnlineStatus } from "@/features/people/hooks/use-online-status";
import { Button } from "@/components/ui/button";
import { toastError } from "@/lib/use-toast";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ORGANIZATIONS, ORG_UNITS, SITES, JOB_TASKS } from "@/features/people/fixtures/people.fixtures";
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
import { EmailPreview } from "@/features/people/components/email-preview";

const STEPS = [
  { id: 1, label: "Identitas", icon: UserRound },
  { id: 2, label: "Penempatan", icon: Building2 },
  { id: 3, label: "Kontak", icon: Phone },
  { id: 4, label: "Dokumen", icon: FileText },
  { id: 5, label: "Consent & Review", icon: FileCheck2 },
];

/**
 * Judul panel langkah — dapat menerima fokus secara terprogram (`tabIndex=-1`)
 * sehingga perpindahan langkah memindahkan fokus ke konteks baru, bukan
 * membiarkannya tertinggal di tombol "Lanjut". Tidak masuk tab order.
 */
function StepHeading({
  headingRef,
  children,
}: {
  headingRef: React.Ref<HTMLHeadingElement>;
  children: React.ReactNode;
}) {
  return (
    <h2
      ref={headingRef}
      tabIndex={-1}
      className="text-lg font-semibold text-foreground focus:outline-none"
    >
      {children}
    </h2>
  );
}

interface WizardFormProps {
  initialDraft: CreatePersonDraft | null;
  initialStep: number;
  savedAt: string | null;
  hasSavedDraft: boolean;
  save: (data: CreatePersonDraft, step: number) => void;
  clear: () => void;
}

/**
 * Form wizard — menerima nilai awal draft sebagai prop sehingga state form
 * sudah benar sejak render pertama (tidak perlu setState di dalam effect).
 */
function WizardForm({
  initialDraft,
  initialStep,
  savedAt,
  hasSavedDraft,
  save,
  clear,
}: WizardFormProps) {
  const router = useRouter();
  const isOnline = useOnlineStatus();

  const [currentStep, setCurrentStep] = useState(() =>
    Math.min(Math.max(initialStep, 1), STEPS.length)
  );
  const [formData, setFormData] = useState<CreatePersonDraft>(() => initialDraft ?? EMPTY_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedPersonDocument[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadNotice, setUploadNotice] = useState("");
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<CreatedPersonResult | null>(null);
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [consentSent, setConsentSent] = useState(false);
  const [consentError, setConsentError] = useState("");
  const [resending, setResending] = useState(false);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  /** Heading langkah aktif — tujuan fokus saat berpindah langkah (a11y). */
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const firstStepRender = useRef(true);
  /** Diminta oleh validateStep: fokuskan field error pertama setelah render. */
  const focusFirstErrorRef = useRef(false);
  /** Promise cek duplikat yang sedang berjalan + hasil terakhir (tanpa stale closure). */
  const duplicateCheckRef = useRef<Promise<void> | null>(null);
  const duplicateResultRef = useRef<DuplicateCheckResult | null>(null);
  /** Satu klik submit/resend = maksimal satu request (anti double-submit). */
  const submitInFlightRef = useRef(false);
  const resendInFlightRef = useRef(false);
  /** Region hasil unggah — fokus dipindahkan setelah unggahan selesai. */
  const uploadNoticeRef = useRef<HTMLParagraphElement | null>(null);

  // Pindah langkah = pindah konteks: fokus ikut ke heading langkah baru supaya
  // pengguna keyboard/screen reader tidak tertinggal di tombol "Lanjut".
  // Render pertama dilewati agar tidak merebut fokus saat halaman baru dibuka
  // (fokus awal halaman diatur oleh focus management antar-route di EmrShell).
  useEffect(() => {
    if (firstStepRender.current) {
      firstStepRender.current = false;
      return;
    }
    stepHeadingRef.current?.focus();
  }, [currentStep]);

  // Validasi gagal: fokus ke field error pertama (setelah DOM error ter-render).
  useEffect(() => {
    if (!focusFirstErrorRef.current) return;
    focusFirstErrorRef.current = false;
    document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

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
    const valid = Object.keys(newErrors).length === 0;
    if (!valid) focusFirstErrorRef.current = true;
    return valid;
  };

  const checkDuplicate = async () => {
    if (!formData.identifierValue) return;
    setCheckingDuplicate(true);
    const task = (async () => {
      try {
        const result = await patientService.duplicateCheck({
          identifierType: formData.identifierType,
          identifierValue: formData.identifierValue,
          fullName: formData.fullName,
        });
        duplicateResultRef.current = result;
        setDuplicateResult(result);
        if (result.severity === "BLOCK") {
          setShowDuplicateModal(true);
        }
      } catch {
        // silently fail
      } finally {
        setCheckingDuplicate(false);
        duplicateCheckRef.current = null;
      }
    })();
    duplicateCheckRef.current = task;
    await task;
  };

  const handleNext = async () => {
    if (!validateStep(currentStep)) return;
    // Cek duplikat (async) mungkin masih berjalan saat pengguna menekan Lanjut.
    // Tunggu selesai alih-alih maju dengan hasil yang belum diketahui.
    if (duplicateCheckRef.current) await duplicateCheckRef.current;
    if (duplicateResultRef.current?.severity === "BLOCK") {
      setShowDuplicateModal(true);
      return;
    }
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
    if (submitInFlightRef.current) return;
    if (!isOnline) {
      toastError(
        "Offline",
        "Anda sedang offline. Draft tetap tersimpan secara lokal dan akan dikirim saat tersambung kembali."
      );
      return;
    }

    submitInFlightRef.current = true;
    setSubmitting(true);
    try {
      const result = await patientService.create({
        ...formData,
        documentIds: uploadedFiles.map((f) => f.id),
      });
      setSubmitResult(result);
      setConsentSent(result.deliveryStatus === "SIMULATED_SENT");
      setConsentError(result.deliveryError ?? "");
      clear();
    } catch (e) {
      setErrors({ submit: e instanceof Error ? e.message : "Terjadi kesalahan." });
    } finally {
      setSubmitting(false);
      submitInFlightRef.current = false;
    }
  };

  const handleSaveDraft = () => {
    save(formData, currentStep);
  };

  const handleResendConsent = async () => {
    if (!submitResult || resendInFlightRef.current) return;
    resendInFlightRef.current = true;
    setResending(true);
    setConsentError("");
    try {
      const res = await patientService.sendConsent(
        submitResult.patientId,
        formData.consentType || "DATA_PROCESSING"
      );
      if (res.success) {
        setSubmitResult({
          ...submitResult,
          consentId: res.consentId ?? submitResult.consentId,
          consentStatus: "PENDING",
          consentLink: res.consentLink ?? submitResult.consentLink,
          deliveryStatus: "SIMULATED_SENT",
          deliveryError: undefined,
        });
        setConsentSent(true);
      } else {
        setConsentSent(false);
        setConsentError(res.deliveryError ?? "Permintaan consent gagal dikirim.");
      }
    } catch {
      setConsentSent(false);
      setConsentError("Permintaan consent gagal dikirim. Periksa koneksi lalu coba lagi.");
    } finally {
      setResending(false);
      resendInFlightRef.current = false;
    }
  };

  /** Unggah satu atau beberapa berkas; setiap kegagalan dilaporkan spesifik. */
  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setUploadError("");
    setUploadNotice("");
    setUploading(true);
    setUploadProgress({ done: 0, total: list.length });

    const failures: string[] = [];
    let successCount = 0;
    for (const file of list) {
      try {
        const uploaded = await uploadPersonDocument(file);
        setUploadedFiles((prev) => {
          const duplicate = prev.some(
            (f) => f.name === uploaded.name && f.size === uploaded.size && f.storage === uploaded.storage
          );
          return duplicate ? prev : [...prev, uploaded];
        });
        successCount += 1;
      } catch (err) {
        failures.push(err instanceof Error ? err.message : `"${file.name}" gagal diunggah.`);
      } finally {
        setUploadProgress((prev) => ({ ...prev, done: prev.done + 1 }));
      }
    }

    if (failures.length > 0) setUploadError(failures.join(" "));
    if (successCount > 0) {
      setUploadNotice(
        `${successCount} berkas berhasil diproses untuk registrasi ini.`
      );
      // Pindahkan fokus ke region hasil agar screen reader mengumumkan hasil
      // unggahan, bukan meninggalkan fokus pada tombol/input berkas.
      setTimeout(() => uploadNoticeRef.current?.focus(), 0);
    }
    setUploading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) void uploadFiles(e.target.files);
    // Reset agar berkas yang sama dapat dipilih ulang setelah dihapus.
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (uploading || !isOnline) return;
    if (e.dataTransfer.files?.length) void uploadFiles(e.dataTransfer.files);
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
          <h1 className="text-2xl font-semibold text-foreground">Pekerja berhasil didaftarkan</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {consentSent
              ? "Data pekerja tersimpan dan permintaan consent dikirim."
              : "Data pekerja tersimpan, namun permintaan consent BELUM terkirim."}
          </p>

          <div className="mt-6 rounded-xl border border-border bg-muted p-4 text-left">
            <div className="space-y-2 text-sm">
              <p><span className="font-medium text-text-secondary">MRN:</span> <span className="font-mono text-foreground">{submitResult.mrn}</span></p>
              <p><span className="font-medium text-text-secondary">Employee ID:</span> <span className="font-mono text-foreground">{submitResult.employeeId}</span></p>
              <p>
                <span className="font-medium text-text-secondary">Consent:</span>{" "}
                {consentSent ? (
                  <Badge variant="warning">Menunggu keputusan pekerja</Badge>
                ) : (
                  <Badge variant="danger">Gagal dikirim</Badge>
                )}
              </p>
              <p>
                <span className="font-medium text-text-secondary">Delivery:</span>{" "}
                <Badge variant={consentSent ? "success" : "danger"}>
                  {consentSent ? "Terkirim (simulasi provider)" : "Gagal"}
                </Badge>
              </p>
            </div>
          </div>

          {!consentSent && (
            <div className="mt-4 rounded-xl bg-warning-50 p-3 text-left text-sm text-warning-700" role="alert">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-4 shrink-0" />
                <div className="space-y-2">
                  <p>{consentError || "Permintaan consent gagal dikirim ke backend."}</p>
                  <Button variant="outline" size="sm" loading={resending} onClick={handleResendConsent}>
                    Kirim ulang consent
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              disabled={!submitResult.consentLink}
              onClick={() => setShowEmailPreview(true)}
            >
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

  // Ringkasan error untuk role="alert" (duplikat pesan dibuang, urutan stabil).
  // `submit` BUKAN error validasi field: kegagalan request ditampilkan sekali
  // di kotak error tersendiri agar tidak dihitung sebagai "isian belum valid".
  const { submit: submitError, ...fieldErrors } = errors;
  const errorSummary = Array.from(new Set(Object.values(fieldErrors).filter(Boolean)));

  const filteredOrgUnits = ORG_UNITS.filter(
    (ou) => !formData.organizationId || ou.organizationId === formData.organizationId
  );
  const filteredSites = SITES.filter(
    (s) => !formData.orgUnitId || s.orgUnitId === formData.orgUnitId
  );

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Registrasi Pekerja Baru</h1>
        <p className="text-sm text-muted-foreground">Lengkapi data pekerja dalam 5 langkah mudah.</p>
      </div>

      <div className="mb-6">
        {/* Grid 5 kolom: garis penghubung selalu sejajar dengan pusat lingkaran,
            label punya lebar penuh sendiri sehingga "Consent & Review" tidak
            mendorong garis atau memotong label langkah lain. */}
        <ol className="flex items-start" aria-label="Langkah registrasi">
          {STEPS.map((s, index) => {
            const Icon = s.icon;
            const isActive = currentStep === s.id;
            const isCompleted = currentStep > s.id;
            const leftActive = currentStep >= s.id;
            const rightActive = currentStep > s.id;
            return (
              <li
                key={s.id}
                className="flex min-w-0 flex-1 flex-col items-center"
                data-step={s.id}
                aria-current={isActive ? "step" : undefined}
              >
                <div className="flex w-full items-center">
                  <span
                    aria-hidden="true"
                    className={`h-0.5 flex-1 ${index === 0 ? "bg-transparent" : leftActive ? "bg-primary-600" : "bg-border"}`}
                  />
                  <span
                    data-step={s.id}
                    className={`mx-1 flex size-9 shrink-0 items-center justify-center rounded-full border-2 transition-colors sm:mx-2 sm:size-10 ${
                      isCompleted
                        ? "border-primary-600 bg-primary-600 text-primary-foreground"
                        : isActive
                          ? "border-primary-600 bg-card text-primary-600"
                          : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {isCompleted ? <Check className="size-4" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`h-0.5 flex-1 ${index === STEPS.length - 1 ? "bg-transparent" : rightActive ? "bg-primary-600" : "bg-border"}`}
                  />
                </div>
                <span
                  className={`mt-2 min-h-8 w-full px-0.5 text-center text-[10px] font-medium leading-tight sm:text-xs ${
                    isActive ? "text-primary-700" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
        {/* Counter langkah tersedia untuk SEMUA breakpoint: terlihat di mobile,
            sr-only di desktop (tetap dibaca screen reader & diumumkan saat
            langkah berpindah). Sebelumnya `sm:hidden` membuatnya hilang sama
            sekali dari accessibility tree desktop. */}
        <p
          className="mt-2 text-center text-xs text-muted-foreground sm:sr-only"
          aria-live="polite"
          data-step-counter={`${currentStep}/${STEPS.length}`}
        >
          Langkah {currentStep} dari {STEPS.length}:{" "}
          <span className="font-medium text-primary-700">
            {STEPS.find((s) => s.id === currentStep)?.label}
          </span>
        </p>
      </div>

      {!isOnline && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-warning-50 p-3 text-sm text-warning-600">
          <WifiOff className="size-4 shrink-0" />
          <span>Anda sedang offline. Submit consent dinonaktifkan. Draft dapat disimpan secara lokal.</span>
        </div>
      )}

      <Card className="p-6">
        {/* Ringkasan error validasi: satu titik pengumuman (role="alert") supaya
            screen reader langsung tahu ada yang harus diperbaiki, sementara
            fokus dipindahkan ke field error pertama oleh effect di atas. */}
        {errorSummary.length > 0 && (
          <div
            role="alert"
            className="mb-4 rounded-xl bg-danger-50 p-3 text-sm text-danger-700"
          >
            <p className="font-medium">
              {errorSummary.length} isian belum valid. Perbaiki sebelum melanjutkan:
            </p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              {errorSummary.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </div>
        )}
        {currentStep === 1 && (
          <div className="space-y-4">
            <StepHeading headingRef={stepHeadingRef}>Identitas Pekerja</StepHeading>
            <Input
              label="Nama Lengkap"
              value={formData.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
              error={errors.fullName}
              placeholder="Masukkan nama lengkap"
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NativeSelect
                label="Tipe Identifier"
                value={formData.identifierType}
                onChange={(v) => updateField("identifierType", v as IdentifierType)}
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
              <NativeSelect
                label="Jenis Kelamin"
                value={formData.sex}
                onChange={(v) => updateField("sex", v as Sex)}
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
            <StepHeading headingRef={stepHeadingRef}>Penempatan Pekerja</StepHeading>
            <NativeSelect
              label="Organization"
              value={formData.organizationId}
              onChange={(v) => updateField("organizationId", v)}
              error={errors.organizationId}
              placeholder="Pilih organisasi"
              options={ORGANIZATIONS.map((o) => ({ value: o.id, label: o.name }))}
            />
            <NativeSelect
              label="Unit Kerja"
              value={formData.orgUnitId}
              onChange={(v) => updateField("orgUnitId", v)}
              error={errors.orgUnitId}
              placeholder="Pilih unit kerja"
              options={filteredOrgUnits.map((o) => ({ value: o.id, label: o.name }))}
            />
            <NativeSelect
              label="Site/Office"
              value={formData.siteId}
              onChange={(v) => updateField("siteId", v)}
              error={errors.siteId}
              placeholder="Pilih site"
              options={filteredSites.map((s) => ({ value: s.id, label: s.name }))}
            />
            <NativeSelect
              label="Job Task"
              value={formData.jobTaskId}
              onChange={(v) => updateField("jobTaskId", v)}
              placeholder="Pilih job task"
              options={JOB_TASKS.map((j) => ({ value: j.id, label: j.name }))}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NativeSelect
                label="Employment Status"
                value={formData.employmentStatus}
                onChange={(v) => updateField("employmentStatus", v as "ACTIVE" | "INACTIVE")}
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
            <StepHeading headingRef={stepHeadingRef}>Kontak Pekerja</StepHeading>
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
            <div className="rounded-xl border border-border bg-muted p-4">
              <p className="mb-3 text-sm font-medium text-text-secondary">Kontak Darurat</p>
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
            <div>
              <StepHeading headingRef={stepHeadingRef}>Dokumen Pendukung</StepHeading>
              <p className="mt-1 text-sm text-muted-foreground">
                Opsional — berkas pendukung (mis. KTP, ijazah, hasil MCU) dapat ditambahkan sekarang.
                Anda tetap dapat melanjutkan tanpa dokumen.
              </p>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (!uploading && isOnline) setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors sm:p-8 ${
                dragActive ? "border-primary-600 bg-primary-50" : "border-border bg-muted/50"
              }`}
            >
              <Upload className="mx-auto mb-3 size-8 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium text-text-secondary">
                Tarik &amp; lepas berkas di sini, atau pilih dari perangkat
              </p>
              <p id="upload-help" className="mt-1 text-xs text-muted-foreground">
                PDF, JPG, atau PNG · maksimum {MAX_DOCUMENT_BYTES / (1024 * 1024)} MB per berkas
              </p>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                disabled={uploading || !isOnline}
                aria-describedby="upload-help upload-error"
              />
              <label
                htmlFor="file-upload"
                className={`mt-3 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-ring ${
                  uploading || !isOnline ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {uploading ? "Mengunggah…" : "Pilih File"}
              </label>
              {uploading && (
                <p role="status" aria-live="polite" className="mt-3 text-xs text-muted-foreground">
                  Mengunggah {uploadProgress.done} dari {uploadProgress.total} berkas…
                </p>
              )}
              {uploadError && (
                <p
                  id="upload-error"
                  role="alert"
                  className="mt-3 rounded-lg bg-danger-50 px-3 py-2 text-left text-sm text-danger-700"
                >
                  {uploadError}
                </p>
              )}
            </div>

            {uploadNotice && (
              <p
                ref={uploadNoticeRef}
                tabIndex={-1}
                role="status"
                aria-live="polite"
                className="rounded-lg bg-success-50 px-3 py-2 text-sm text-success-700 focus:outline-none"
              >
                {uploadNotice}
              </p>
            )}

            {uploadedFiles.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada dokumen diunggah.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium text-text-secondary">
                  {uploadedFiles.length} berkas terunggah
                </p>
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                    <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-text-secondary">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDocumentSize(file.size)}</p>
                    </div>
                    {file.storage === "LOCAL_DEMO" && (
                      <Badge variant="outline" title="Backend belum menyediakan endpoint unggah; berkas hanya tercatat di sesi ini.">
                        Lokal (demo)
                      </Badge>
                    )}
                    <Badge variant={file.tamperCheck === "PASSED" ? "success" : "warning"}>
                      {file.tamperCheck}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => removeFile(file.id)}
                      className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Hapus ${file.name}`}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <StepHeading headingRef={stepHeadingRef}>Consent & Review</StepHeading>

            <div className="rounded-xl border border-border bg-muted p-4">
              <h3 className="mb-3 text-sm font-medium text-text-secondary">Ringkasan Data</h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium text-text-secondary">Nama:</span> <span className="text-foreground">{formData.fullName}</span></p>
                <p><span className="font-medium text-text-secondary">Identifier:</span> <span className="font-mono text-foreground">{maskIdentifier(formData.identifierValue, formData.identifierType)}</span></p>
                <p><span className="font-medium text-text-secondary">Employee ID:</span> <span className="font-mono text-foreground">{formData.employeeNo}</span></p>
                <p><span className="font-medium text-text-secondary">Email:</span> <span className="text-foreground">{formData.email}</span></p>
                <p><span className="font-medium text-text-secondary">Dokumen:</span> <span className="text-foreground">{uploadedFiles.length} file</span></p>
              </div>
            </div>

            <NativeSelect
              label="Tipe Consent"
              value={formData.consentType}
              onChange={(v) => updateField("consentType", v)}
              error={errors.consentType}
              options={[
                { value: "DATA_PROCESSING", label: "Pemrosesan Data EMR" },
                { value: "MEDICAL_TREATMENT", label: "Tindakan Medis" },
                { value: "DRUG_ALCOHOL_SCREENING", label: "Skrining Narkoba & Alkohol" },
                { value: "TELEMEDICINE", label: "Telemedicine" },
              ]}
            />
            <Input
              label="Versi Consent"
              value={formData.consentVersion}
              onChange={(e) => updateField("consentVersion", e.target.value)}
              error={errors.consentVersion}
              placeholder="1.0"
            />

            <div className="flex items-start gap-3 rounded-xl border border-border p-4">
              <input
                type="checkbox"
                id="acknowledge"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-0.5 size-4 rounded border-input text-primary-600 focus:ring-ring"
                aria-invalid={errors.acknowledged ? true : undefined}
                aria-describedby={errors.acknowledged ? "acknowledge-error" : undefined}
              />
              <label htmlFor="acknowledge" className="text-sm text-text-secondary">
                Saya sudah memeriksa data dan memahami bahwa consent link akan dikirim ke email pekerja.
              </label>
            </div>
            {errors.acknowledged && (
              <p id="acknowledge-error" className="text-sm text-danger-600">{errors.acknowledged}</p>
            )}

            {submitError && (
              <div role="alert" className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
                {submitError}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
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
              <Button
                onClick={() => void handleNext()}
                loading={checkingDuplicate}
                aria-busy={checkingDuplicate || undefined}
                className="w-full justify-center sm:w-auto"
              >
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
        <p
          role="status"
          aria-live="polite"
          className="mt-3 text-center text-xs text-muted-foreground"
        >
          Draft tersimpan ·{" "}
          {new Date(savedAt).toLocaleString("id-ID", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
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

/**
 * Menunggu draft selesai dibaca dari localStorage, baru merender form dengan
 * nilai awal draft tersebut. Ini memperbaiki bug "draft tersimpan tetapi form
 * kembali ke langkah 1" tanpa setState di dalam effect.
 */
export function RegistrationWizard() {
  const draftState = useDraft();

  if (!draftState.ready) {
    return (
      <div className="mx-auto max-w-2xl space-y-3" aria-busy="true">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <WizardForm
      initialDraft={draftState.draft}
      initialStep={draftState.step}
      savedAt={draftState.savedAt}
      hasSavedDraft={draftState.hasSavedDraft}
      save={draftState.save}
      clear={draftState.clear}
    />
  );
}

export default function NewPersonRoute() {
  return <RegistrationWizard />;
}
