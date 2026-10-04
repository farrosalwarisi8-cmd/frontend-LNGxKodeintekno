"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Avatar } from "@/shared/components/design-system/avatar";
import { formatDate } from "@/lib/format";
import { UserRound, MapPin, FileText, ChevronLeft, ChevronRight, Check, HeartPulse, Stethoscope } from "lucide-react";

const STEPS = [
  { id: 1, label: "Pasien", icon: UserRound },
  { id: 2, label: "Lokasi", icon: MapPin },
  { id: 3, label: "Keluhan", icon: FileText },
  { id: 4, label: "Vital Sign", icon: HeartPulse },
  { id: 5, label: "Review", icon: Stethoscope },
];

export default function VisitNewPage() {
  const router = useRouter();
  const employees = useStore((s) => s.employees);
  const locations = useStore((s) => s.locations);
  const registerVisit = useStore((s) => s.registerVisit);

  const [currentStep, setCurrentStep] = useState(1);
  const [employeeId, setEmployeeId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [initialExam, setInitialExam] = useState("");
  const [systolic, setSystolic] = useState("");
  const [diastolic, setDiastolic] = useState("");
  const [heartRate, setHeartRate] = useState("");
  const [temperature, setTemperature] = useState("");
  const [weight, setWeight] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedEmployee = employees.find((e) => e.id === employeeId);
  const selectedLocation = locations.find((l) => l.id === locationId);

  const canProceed = () => {
    if (currentStep === 1) return !!employeeId;
    if (currentStep === 2) return !!locationId;
    if (currentStep === 3) return !!chiefComplaint;
    if (currentStep === 4) return !!systolic && !!diastolic && !!heartRate;
    return true;
  };

  const handleSubmit = () => {
    setSubmitting(true);
    try {
      const visitId = registerVisit({ employeeId, locationId, chiefComplaint });
      router.push("/visits");
    } catch (e) {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Kunjungan Baru</h1>
        <p className="text-sm text-slate-500">Registrasi kunjungan klinik</p>
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
            <h2 className="text-lg font-semibold text-slate-900">Pilih Pasien</h2>
            <Select
              label="Pasien"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="Pilih pasien"
              options={employees.map((e) => ({ value: e.id, label: `${e.fullName} (${e.employeeId})` }))}
            />
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
            <h2 className="text-lg font-semibold text-slate-900">Lokasi Klinik</h2>
            <Select
              label="Lokasi"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              placeholder="Pilih lokasi"
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
            />
            {selectedLocation && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="font-medium text-slate-900">{selectedLocation.name}</p>
                <p className="text-xs text-slate-500 capitalize">{selectedLocation.type}</p>
              </div>
            )}
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Keluhan Utama</h2>
            <Input
              label="Keluhan Utama"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="Tuliskan keluhan utama pasien..."
            />
            <Input
              label="Pemeriksaan Awal"
              value={initialExam}
              onChange={(e) => setInitialExam(e.target.value)}
              placeholder="Hasil pemeriksaan awal..."
            />
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Vital Sign</h2>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Sistolik (mmHg)" type="number" value={systolic} onChange={(e) => setSystolic(e.target.value)} placeholder="120" />
              <Input label="Diastolik (mmHg)" type="number" value={diastolic} onChange={(e) => setDiastolic(e.target.value)} placeholder="80" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Heart Rate (bpm)" type="number" value={heartRate} onChange={(e) => setHeartRate(e.target.value)} placeholder="72" />
              <Input label="Suhu (°C)" type="number" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="36.5" />
            </div>
            <Input label="Berat Badan (kg)" type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="65" />
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Review & Submit</h2>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-medium text-slate-700">Ringkasan</h3>
              <div className="space-y-2 text-sm">
                <p><span className="font-medium text-slate-600">Pasien:</span> {selectedEmployee?.fullName}</p>
                <p><span className="font-medium text-slate-600">Lokasi:</span> {selectedLocation?.name}</p>
                <p><span className="font-medium text-slate-600">Keluhan:</span> {chiefComplaint}</p>
                <p><span className="font-medium text-slate-600">TD:</span> {systolic}/{diastolic} mmHg</p>
                <p><span className="font-medium text-slate-600">HR:</span> {heartRate} bpm</p>
              </div>
            </div>
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
              Submit Kunjungan
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
