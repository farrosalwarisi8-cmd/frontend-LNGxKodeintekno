"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  syncInventory,
  syncMasterData,
  syncPatients,
  useSyncedModules,
} from "@/lib/remote-sync";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { Database, Plus, Pill, Stethoscope, Building2, MapPin } from "lucide-react";

export default function MasterDataPage() {
  const diagnoses = useStore((s) => s.diagnoses);
  const medicines = useStore((s) => s.medicines);

  // Modul 11 — master data dari backend: ICD-10 (/clinic/icd10/search)
  // dan inventaris obat (/pharmacy/inventory)
  useSyncedModules(async () => {
    await syncMasterData();
    await syncInventory();
    await syncPatients(1, 100);
  });
  const companies = useStore((s) => s.companies);
  const departments = useStore((s) => s.departments);
  const locations = useStore((s) => s.locations);

  const [activeTab, setActiveTab] = useState<"diagnoses" | "medicines" | "companies" | "departments" | "locations">("diagnoses");

  const tabs = [
    { id: "diagnoses" as const, label: "Diagnosis ICD-10", icon: Stethoscope, count: diagnoses.length },
    { id: "medicines" as const, label: "Obat", icon: Pill, count: medicines.length },
    { id: "companies" as const, label: "Perusahaan", icon: Building2, count: companies.length },
    { id: "departments" as const, label: "Departemen", icon: Building2, count: departments.length },
    { id: "locations" as const, label: "Lokasi", icon: MapPin, count: locations.length },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Master Data</h1>
        <p className="text-sm text-slate-500">Kelola data master sistem</p>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-primary-600 text-white"
                  : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${activeTab === tab.id ? "bg-white/20" : "bg-slate-100"}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {activeTab === "diagnoses" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Diagnosis ICD-10</CardTitle>
              <Button size="sm">
                <Plus className="size-3.5" />
                Tambah
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {diagnoses.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{d.code} — {d.description}</p>
                    <p className="text-xs text-slate-500">{d.category}</p>
                  </div>
                  <Badge variant="info">{d.category}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "medicines" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Obat</CardTitle>
              <Button size="sm">
                <Plus className="size-3.5" />
                Tambah
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {medicines.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{m.name}</p>
                    <p className="text-xs text-slate-500">{m.code} · {m.category} · Min: {m.minStock}</p>
                  </div>
                  <Badge variant="success">{m.unit}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "companies" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Perusahaan</CardTitle>
              <Button size="sm">
                <Plus className="size-3.5" />
                Tambah
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {companies.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                  <p className="text-sm font-medium text-slate-900">{c.name}</p>
                  <Badge variant="default">{c.id}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "departments" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Departemen</CardTitle>
              <Button size="sm">
                <Plus className="size-3.5" />
                Tambah
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {departments.map((d) => {
                const company = companies.find((c) => c.id === d.companyId);
                return (
                  <div key={d.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{d.name}</p>
                      <p className="text-xs text-slate-500">{company?.name}</p>
                    </div>
                    <Badge variant="default">{d.id}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "locations" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lokasi Kerja</CardTitle>
              <Button size="sm">
                <Plus className="size-3.5" />
                Tambah
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {locations.map((l) => {
                const company = companies.find((c) => c.id === l.companyId);
                return (
                  <div key={l.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{l.name}</p>
                      <p className="text-xs text-slate-500">{company?.name}</p>
                    </div>
                    <Badge variant="default" className="capitalize">{l.type}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
