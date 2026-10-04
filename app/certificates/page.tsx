"use client";

import { useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { CERT_STATUS } from "@/lib/constants";
import { Card, CardContent } from "@/shared/components/design-system/card";
import { Badge } from "@/shared/components/design-system/badge";
import { Button } from "@/shared/components/design-system/button";
import { Input } from "@/shared/components/design-system/input";
import { Select } from "@/shared/components/design-system/select";
import { formatDate } from "@/lib/format";
import { Search, BadgeCheck, Plus, QrCode, ChevronRight } from "lucide-react";

export default function CertificatesPage() {
  const certificates = useStore((s) => s.certificates);
  const employees = useStore((s) => s.employees);
  const mcus = useStore((s) => s.mcus);
  const issueCertificate = useStore((s) => s.issueCertificate);
  const revokeCertificate = useStore((s) => s.revokeCertificate);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = certificates.filter((c) => {
    const emp = employees.find((e) => e.id === c.employeeId);
    const q = search.toLowerCase();
    const matchSearch = !q || c.certNumber.toLowerCase().includes(q) || emp?.fullName.toLowerCase().includes(q);
    const matchStatus = !statusFilter || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const approvedMCUs = mcus.filter((m) => m.status === "Approved" && !certificates.find((c) => c.mcuId === m.id));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Sertifikat Kesehatan</h1>
        <p className="text-sm text-slate-500">Sertifikat kesehatan kerja dengan QR verification</p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Cari nomor sertifikat, nama pekerja..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            placeholder="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={Object.entries(CERT_STATUS).map(([value, { label }]) => ({ value, label }))}
          />
        </div>
      </Card>

      {approvedMCUs.length > 0 && (
        <Card className="border-primary-200 bg-primary-50/50 p-4">
          <h3 className="mb-2 text-sm font-medium text-primary-700">MCU Approved — Belum Ada Sertifikat</h3>
          <div className="space-y-2">
            {approvedMCUs.map((mcu) => {
              const emp = employees.find((e) => e.id === mcu.employeeId);
              return (
                <div key={mcu.id} className="flex items-center justify-between rounded-xl border border-primary-100 bg-white p-3">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{emp?.fullName}</p>
                    <p className="text-xs text-slate-500">{mcu.mcuNumber} · {mcu.decision}</p>
                  </div>
                  <Button size="sm" onClick={() => issueCertificate(mcu.id)}>
                    <Plus className="size-3.5" />
                    Terbitkan
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <p className="text-sm text-slate-500">{filtered.length} sertifikat</p>

      <div className="space-y-3">
        {filtered.map((cert) => {
          const emp = employees.find((e) => e.id === cert.employeeId);
          const statusMeta = CERT_STATUS[cert.status];
          return (
            <Card key={cert.id} className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
                    <BadgeCheck className="size-6" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{cert.certNumber}</p>
                    <p className="text-xs text-slate-500">{emp?.fullName} · {emp?.employeeId}</p>
                    <p className="text-xs text-slate-500">
                      {cert.healthStatus} · Berlaku s.d. {formatDate(cert.validUntil)}
                    </p>
                    {cert.restrictions && (
                      <p className="text-xs text-warning-600">Restriction: {cert.restrictions}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={statusMeta?.color}>
                    {statusMeta?.label}
                  </Badge>
                  <Link href={`/verify/${encodeURIComponent(cert.qrToken)}`} target="_blank">
                    <Button variant="outline" size="sm">
                      <QrCode className="size-3.5" />
                      QR
                    </Button>
                  </Link>
                  {cert.status === "valid" && (
                    <Button variant="danger" size="sm" onClick={() => revokeCertificate(cert.id)}>
                      Cabut
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
