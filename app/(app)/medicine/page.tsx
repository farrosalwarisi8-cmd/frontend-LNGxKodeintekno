"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus } from "lucide-react";
import { useStore, useCurrentUser } from "@/lib/store";
import { can } from "@/lib/rbac";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { AlertTriangle } from "lucide-react";

export default function MedicinePage() {
  const router = useRouter();
  const user = useCurrentUser();
  const medicines = useStore((s) => s.medicines);
  const stockBatches = useStore((s) => s.stockBatches);
  const locations = useStore((s) => s.locations);
  const [locationId, setLocationId] = useState("all");

  const locationStock = useMemo(() => {
    const rows = medicines.map((m) => {
      const batches = stockBatches.filter(
        (b) => b.medicineId === m.id && (locationId === "all" || b.locationId === locationId)
      );
      const qty = batches.reduce((acc, b) => acc + b.quantity, 0);
      const nearestExpiry = batches
        .map((b) => b.expiresAt)
        .sort((a, b) => a.localeCompare(b))[0];
      return { medicine: m, qty, nearestExpiry, batches };
    });
    return rows;
  }, [medicines, stockBatches, locationId]);

  if (!user) return null;
  const canManage = can(user.role, "manage-stock");

  const lowStock = locationStock.filter((r) => r.qty < r.medicine.minStock);

  return (
    <div>
      <PageHeader title="Medicine Stock" description="Stok obat per lokasi, batch, dan kedaluwarsa.">
        <Select value={locationId} onValueChange={(v) => setLocationId(v as string)}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua lokasi</SelectItem>
            {locations.map((l) => (
              <SelectItem key={l.id} value={l.id}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canManage && (
          <Button onClick={() => router.push("/medicine/receive")}>
            <PackagePlus /> Terima Stok
          </Button>
        )}
      </PageHeader>

      {lowStock.length > 0 && (
        <Card className="mb-4 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="size-4" /> Peringatan Stok Minimum
            </CardTitle>
            <CardDescription>Obat dengan stok di bawah batas minimum.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            {lowStock.map((r) => (
              <div key={r.medicine.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="font-medium">{r.medicine.name}</span>
                <span className="text-amber-700">
                  {r.qty} {r.medicine.unit} <span className="text-muted-foreground">(min {r.medicine.minStock})</span>
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="rounded-xl border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kode</TableHead>
              <TableHead>Nama Obat</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Stok</TableHead>
              <TableHead>Kedaluwarsa terdekat</TableHead>
              <TableHead>Batas min</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locationStock.map((r) => (
              <TableRow key={r.medicine.id}>
                <TableCell className="font-medium">{r.medicine.code}</TableCell>
                <TableCell>{r.medicine.name}</TableCell>
                <TableCell>{r.medicine.category}</TableCell>
                <TableCell className={r.qty < r.medicine.minStock ? "font-medium text-amber-700" : ""}>
                  {r.qty} {r.medicine.unit}
                </TableCell>
                <TableCell>{r.nearestExpiry ? formatDate(r.nearestExpiry) : "—"}</TableCell>
                <TableCell>{r.medicine.minStock}</TableCell>
              </TableRow>
            ))}
            {locationStock.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Tidak ada obat.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
