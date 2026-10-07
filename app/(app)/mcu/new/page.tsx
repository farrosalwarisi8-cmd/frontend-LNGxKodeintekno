"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import {
  mapMcuTypeToBackend,
  syncMcu,
  syncPatients,
  useSyncedModules,
} from "@/lib/remote-sync";
import { mcuService } from "@/lib/services/mcu.service";
import { MCU_TYPES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Badge } from "@/shared/components/design-system/badge";
import { Avatar } from "@/shared/components/design-system/avatar";
import { formatDate } from "@/lib/format";
import {
  UserRound,
  Building2,
  Phone,
  FileText,
  ChevronLeft,
  ChevronRight,
  Check,
  Activity,
  Heart,
  Ruler,
  Weight,
  Eye,
  Ear,
  Stethoscope,
} from "lucide-react";

const STEPS = [
  { id: 1, label: "Pekerja", icon: UserRound },
  { id: 2, label: "Tipe MCU", icon: Activity },
  { id: 3, label: "Vital Sign", icon: Heart },
  { id: 4, label: "Kalkulasi Klinis", icon: Stethoscope },
  { id: 5, label: "Review", icon: FileText },
];

function calculateBMI(heightCm: number, weightKg: number): { value: number; category: string; color: string } {
  if (!heightCm || !weightKg) return { value: 0, category: "—", color: "" };
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  if (bmi < 18.5) return { value: bmi, category: "Underweight", color: "text-info-600" };
  if (bmi < 25) return { value: bmi, category: "Normal", color: "text-success-600" };
  if (bmi < 30) return { value: bmi, category: "Overweight", color: "text-warning-600" };
  return { value: bmi, category: "Obese", color: "text-danger-600" };
}

function classifyBloodPressure(systolic: number, diastolic: number): { category: string; color: string } {
  if (!systolic || !diastolic) return { category: "—", color: "" };
  if (systolic < 120 && diastolic < 80) return { category: "Normal", color: "text-success-600" };
  if (systolic < 130 && diastolic < 80) return { category: "Elevated", color: "text-warning-600" };
  if (systolic < 140 || diastolic < 90) return { category: "Hypertension Stage 1", color: "text-warning-600" };
  if (systolic >= 140 || diastolic >= 90) return { category: "Hypertension Stage 2", color: "text-danger-600" };
  return { category: "—", color: "" };
}

function calculateFramingham(age: number, totalChol: number, hdlChol: number, systolic: number, smoker: boolean): number {
  if (!age || !totalChol || !hdlChol || !systolic) return 0;
  let risk = 0;
  risk += (age - 20) * 0.0483;
  risk += (Math.log(totalChol) - Math.log(160)) * 0.3377;
  risk -= (Math.log(hdlChol) - Math.log(45)) * 0.3021;
  risk += (Math.log(systolic) - Math.log(120)) * 0.1999;
  if (smoker) risk += 0.5496;
  const score = 100 * (1 - Math.exp(-Math.exp(risk - 22.325)));
  return Math.round(score * 10) / 10;
}

function calculateASCVD(age: number, totalChol: number, hdlChol: number, systolic: number, smoker: boolean, diabetic: boolean): number {
  if (!age || !totalChol || !hdlChol || !systolic) return 0;
  let risk = 0;
  risk += (age - 55) * 0.0609;
  risk += (Math.log(totalChol) - Math.log(170)) * 0.2489;
  risk -= (Math.log(hdlChol) - Math.log(50)) * 0.2614;
  risk += (Math.log(systolic) - Math.log(120)) * 0.2216;
  if (smoker) risk += 0.4284;
  if (diabetic) risk += 0.5316;
  const score = 100 * (1 - Math.exp(-Math.exp(risk - 29.18)));
  return Math.round(score * 10) / 10;
}

function classifyAudiometry(thresholdDb: number): { category: string; color: string } {
  if (!thresholdDb) return { category: "—", color: "" };
  if (thresholdDb <= 25) return { category: "Normal", color: "text-success-600" };
  if (thresholdDb <= 40) return { category: "Mild Hearing Loss", color: "text-warning-600" };
  if (thresholdDb <= 55) return { category: "Moderate Hearing Loss", color: "text-warning-600" };
  if (thresholdDb <= 70) return { category: "Moderately Severe", color: "text-danger-600" };
  if (thresholdDb <= 90) return { category: "Severe Hearing Loss", color: "text-danger-600" };
  return { category: "Profound Hearing Loss", color: "text-danger-600" };
}

function classifySpirometry(fev1Percent: number): { category: string; color: string } {
  if (!fev1Percent) return { category: "—", color: "" };
  if (fev1Percent >= 80) return { category: "Normal", color: "text-success-600" };
  if (fev1Percent >= 60) return { category: "Mild Obstruction", color: "text-warning-600" };
  if (fev1Percent >= 40) return { category: "Moderate Obstruction", color: "text-warning-600" };
  return { category: "Severe Obstruction", color: "text-danger-600" };
}

export default function MCUNewPage() {
  const router = useRouter();
  const employees = useStore((s) => s.employees);

  // Modul 4 — daftar pekerja (Modul 2) untuk memilih subjek MCU
  const { loading: loadingPatients, error: patientsError, refetch } = useSyncedModules(() =>
    syncPatients(1, 100)
  );

  const [currentStep, setCurrentStep] = useState(1);
  const [employeeId, setEmployeeId] = useState("");
  const [mcuType, setMcuType] = useState("");
  const [examDate, setExamDate] = useState("");
  const [facility, setFacility] = useState("");

  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [vision, setVision] = useState("");
  const [hearing, setHearing] = useState("");

  const [totalChol, setTotalChol] = useState("");
  const [hdlChol, setHdlChol] = useState("");
  const [ldlChol, setLdlChol] = useState("");
  const [triglycerides, setTriglycerides] = useState("");
  const [hba1c, setHba1c] = useState("");
  const [audiometryRight, setAudiometryRight] = useState("");
  const [audiometryLeft, setAudiometryLeft] = useState("");
  const [fev1, setFev1] = useState("");
  const [fvc, setFvc] = useState("");
  const [smoker, setSmoker] = useState(false);
  const [diabetic, setDiabetic] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const selectedEmployee = employees.find((e) => e.id === employeeId);

  const bmi = calculateBMI(parseFloat(heightCm), parseFloat(weightKg));
  const bp = classifyBloodPressure(parseInt(systolic), parseInt(diastolic));
  const framingham = calculateFramingham(
    selectedEmployee ? new Date().getFullYear() - new Date(selectedEmployee.dateOfBirth).getFullYear() : 0,
    parseFloat(totalChol),
    parseFloat(hdlChol),
    parseInt(systolic),
    smoker
  );
  const ascvd = calculateASCVD(
    selectedEmployee ? new Date().getFullYear() - new Date(selectedEmployee.dateOfBirth).getFullYear() : 0,
    parseFloat(totalChol),
    parseFloat(hdlChol),
    parseInt(systolic),
    smoker,
    diabetic
  );
  const audioRight = classifyAudiometry(parseFloat(audiometryRight));
  const audioLeft = classifyAudiometry(parseFloat(audiometryLeft));
  const fev1Percent = fev1 && fvc ? Math.round((parseFloat(fev1) / parseFloat(fvc)) * 100) : 0;
  const spirometry = classifySpirometry(fev1Percent);

  const canProceed = () => {
    if (currentStep === 1) return !!employeeId;
    if (currentStep === 2) return !!mcuType && !!examDate && !!facility;
    if (currentStep === 3) return !!systolic && !!diastolic && !!heartRate && !!heightCm && !!weightKg;
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      // 1. Buat siklus MCU di backend: POST /api/v1/mcu/cycles
      const cycle = await mcuService.create(
        employeeId,
        mapMcuTypeToBackend(mcuType),
        examDate
      );

      // 2. Jalankan dynamic clinical calculation engine:
      //    POST /api/v1/mcu/cycles/:id/calculate
      await mcuService.calculate(cycle.id, {
        parameters: {
          weightKg: Number(weightKg),
          heightCm: Number(heightCm),
          systolicBp: Number(systolic),
          diastolicBp: Number(diastolic),
        },
      });

      // 3. Sinkronkan daftar MCU terbaru dari backend
      await syncMcu(1, 100);

      router.push("/mcu");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Buat MCU Baru</h1>
        <p className="text-sm text-slate-500">Lengkapi data MCU dalam 5 langkah</p>
      </div>

      <div className="mb-6 flex items-center justify-between">
        {STEPS.map((s, index) => {
          const Icon = s.icon;
          const isActive = currentStep === s.id;
          const isCompleted = currentStep > s.id;
          return (
            <div key={s.id} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex size-10 items-center justify-center rounded-full border-2 transition-colors ${
                    isCompleted
                      ? "border-primary-600 bg-primary-600 text-white"
                      : isActive
                        ? "border-primary-600 bg-white text-primary-600"
                        : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {isCompleted ? <Check className="size-4" /> : <Icon className="size-4" />}
                </div>
                <span className={`mt-1 text-xs font-medium ${isActive ? "text-primary-600" : "text-slate-400"}`}>
                  {s.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className={`mx-2 h-0.5 flex-1 ${currentStep > s.id ? "bg-primary-600" : "bg-slate-200"}`} />
              )}
            </div>
          );
        })}
      </div>

      <Card className="p-6">
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Pilih Pekerja</h2>
            <Select
              label="Pekerja"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder={loadingPatients ? "Memuat pekerja..." : "Pilih pekerja"}
              options={employees.map((e) => ({ value: e.id, label: `${e.fullName} (${e.employeeId})` }))}
            />
            {patientsError && (
              <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">
                Gagal memuat daftar pekerja: {patientsError}{" "}
                <button className="underline" onClick={refetch}>
                  Coba lagi
                </button>
              </div>
            )}
            {selectedEmployee && (
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <Avatar name={selectedEmployee.fullName} />
                <div>
                  <p className="font-medium text-slate-900">{selectedEmployee.fullName}</p>
                  <p className="text-xs text-slate-500">
                    {selectedEmployee.employeeId} · {selectedEmployee.mrn}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selectedEmployee.jobTitle} · {selectedEmployee.status}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Tipe MCU</h2>
            <Select
              label="Tipe MCU"
              value={mcuType}
              onChange={(e) => setMcuType(e.target.value)}
              placeholder="Pilih tipe MCU"
              options={MCU_TYPES.map((t) => ({ value: t, label: t }))}
            />
            <Input
              label="Tanggal Pemeriksaan"
              type="date"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
            />
            <Input
              label="Fasilitas"
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
              placeholder="Nama fasilitas pemeriksaan"
            />
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Vital Sign</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Sistolik (mmHg)"
                type="number"
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                placeholder="120"
              />
              <Input
                label="Diastolik (mmHg)"
                type="number"
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                placeholder="80"
              />
            </div>
            <Input
              label="Heart Rate (bpm)"
              type="number"
              value={heartRate}
              onChange={(e) => setHeartRate(e.target.value)}
              placeholder="72"
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Tinggi Badan (cm)"
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="170"
              />
              <Input
                label="Berat Badan (kg)"
                type="number"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="65"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Visus"
                value={vision}
                onChange={(e) => setVision(e.target.value)}
                placeholder="6/6"
              />
              <Input
                label="Pendengaran"
                value={hearing}
                onChange={(e) => setHearing(e.target.value)}
                placeholder="Normal"
              />
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Kalkulasi Klinis</h2>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-700">BMI (Body Mass Index)</h3>
              <div className="flex items-center gap-4">
                <div className="text-2xl font-semibold text-slate-900">
                  {bmi.value > 0 ? bmi.value.toFixed(1) : "—"}
                </div>
                <Badge variant={bmi.category === "Normal" ? "success" : bmi.category === "Underweight" ? "info" : bmi.category === "Overweight" ? "warning" : "danger"}>
                  {bmi.category}
                </Badge>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-700">Tekanan Darah</h3>
              <div className="flex items-center gap-4">
                <div className="text-2xl font-semibold text-slate-900">
                  {systolic && diastolic ? `${systolic}/${diastolic}` : "—"}
                </div>
                <Badge variant={bp.category === "Normal" ? "success" : bp.category === "Elevated" ? "warning" : "danger"}>
                  {bp.category}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label="Total Kolesterol (mg/dL)" type="number" value={totalChol} onChange={(e) => setTotalChol(e.target.value)} placeholder="200" />
              <Input label="HDL (mg/dL)" type="number" value={hdlChol} onChange={(e) => setHdlChol(e.target.value)} placeholder="50" />
              <Input label="LDL (mg/dL)" type="number" value={ldlChol} onChange={(e) => setLdlChol(e.target.value)} placeholder="130" />
              <Input label="Trigliserida (mg/dL)" type="number" value={triglycerides} onChange={(e) => setTriglycerides(e.target.value)} placeholder="150" />
            </div>

            <Input label="HbA1c (%)" type="number" value={hba1c} onChange={(e) => setHba1c(e.target.value)} placeholder="5.7" />

            <div className="grid grid-cols-2 gap-4">
              <Input label="Audiometri Kanan (dB)" type="number" value={audiometryRight} onChange={(e) => setAudiometryRight(e.target.value)} placeholder="25" />
              <Input label="Audiometri Kiri (dB)" type="number" value={audiometryLeft} onChange={(e) => setAudiometryLeft(e.target.value)} placeholder="25" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label="FEV1 (L)" type="number" value={fev1} onChange={(e) => setFev1(e.target.value)} placeholder="3.5" />
              <Input label="FVC (L)" type="number" value={fvc} onChange={(e) => setFvc(e.target.value)} placeholder="4.2" />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={smoker} onChange={(e) => setSmoker(e.target.checked)} className="size-4 rounded border-slate-300" />
                Perokok
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={diabetic} onChange={(e) => setDiabetic(e.target.checked)} className="size-4 rounded border-slate-300" />
                Diabetes
              </label>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-700">Skor Risiko Kardiovaskular</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Framingham Risk Score</span>
                  <span className="font-semibold text-slate-900">{framingham > 0 ? `${framingham}%` : "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">ASCVD Risk Score</span>
                  <span className="font-semibold text-slate-900">{ascvd > 0 ? `${ascvd}%` : "—"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Audiometri Kanan</span>
                  <Badge variant={audioRight.category === "Normal" ? "success" : "warning"}>{audioRight.category}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Audiometri Kiri</span>
                  <Badge variant={audioLeft.category === "Normal" ? "success" : "warning"}>{audioLeft.category}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Spirometri (FEV1/FVC)</span>
                  <Badge variant={spirometry.category === "Normal" ? "success" : "warning"}>
                    {fev1Percent > 0 ? `${fev1Percent}% — ${spirometry.category}` : "—"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Review & Submit</h2>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-700">Ringkasan</h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium text-slate-600">Pekerja:</span> {selectedEmployee?.fullName}</p>
                <p><span className="font-medium text-slate-600">Tipe MCU:</span> {mcuType}</p>
                <p><span className="font-medium text-slate-600">Tanggal:</span> {formatDate(examDate)}</p>
                <p><span className="font-medium text-slate-600">Fasilitas:</span> {facility}</p>
                <p><span className="font-medium text-slate-600">TD:</span> {systolic}/{diastolic} mmHg ({bp.category})</p>
                <p><span className="font-medium text-slate-600">BMI:</span> {bmi.value > 0 ? `${bmi.value.toFixed(1)} (${bmi.category})` : "—"}</p>
                <p><span className="font-medium text-slate-600">Framingham:</span> {framingham > 0 ? `${framingham}%` : "—"}</p>
                <p><span className="font-medium text-slate-600">ASCVD:</span> {ascvd > 0 ? `${ascvd}%` : "—"}</p>
              </div>
            </div>
            {error && (
              <div className="rounded-xl bg-danger-50 p-3 text-sm text-danger-700">{error}</div>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
          <Button variant="ghost" onClick={() => setCurrentStep((s) => Math.max(1, s - 1))} disabled={currentStep === 1}>
            <ChevronLeft className="size-4" />
            Kembali
          </Button>
          {currentStep < 5 ? (
            <Button onClick={() => setCurrentStep((s) => Math.min(5, s + 1))} disabled={!canProceed()}>
              Lanjut
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} loading={submitting}>
              <Check className="size-4" />
              Submit MCU
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
