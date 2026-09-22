"use client";

import { useStore, useCurrentUser } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LOCATION_TYPES } from "@/lib/constants";

export default function MasterDataPage() {
  const user = useCurrentUser();
  const companies = useStore((s) => s.companies);
  const departments = useStore((s) => s.departments);
  const locations = useStore((s) => s.locations);
  const diagnoses = useStore((s) => s.diagnoses);
  const medicines = useStore((s) => s.medicines);

  if (!user) return null;

  return (
    <div className="space-y-4">
      <PageHeader title="Master Data" description="Data referensi demo (read-only)." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Perusahaan & Departemen</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Perusahaan</TableHead>
                  <TableHead>Departemen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      {departments
                        .filter((d) => d.companyId === c.id)
                        .map((d) => d.name)
                        .join(", ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lokasi Kerja</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Tipe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell>{LOCATION_TYPES[l.type] ?? l.type}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Diagnosis (ICD-10)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Deskripsi</TableHead>
                  <TableHead>Kategori</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {diagnoses.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.code}</TableCell>
                    <TableCell>{d.description}</TableCell>
                    <TableCell>{d.category}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Obat</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Satuan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicines.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.code}</TableCell>
                    <TableCell>{m.name}</TableCell>
                    <TableCell>{m.category}</TableCell>
                    <TableCell>{m.unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
