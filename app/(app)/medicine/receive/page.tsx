"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useStore } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function ReceiveStockPage() {
  const router = useRouter();
  const medicines = useStore((s) => s.medicines);
  const locations = useStore((s) => s.locations);
  const receiveStock = useStore((s) => s.receiveStock);
  const [medicineId, setMedicineId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  function submit() {
    const qty = parseInt(quantity, 10);
    if (!medicineId || !locationId || !batchNumber || Number.isNaN(qty) || qty <= 0 || !expiresAt) {
      toast.error("Lengkapi semua field.");
      return;
    }
    receiveStock({ medicineId, locationId, batchNumber, quantity: qty, expiresAt });
    toast.success("Stok obat diterima.");
    router.push("/medicine");
  }

  return (
    <div className="max-w-2xl">
      <PageHeader title="Terima Stok Obat" description="Catat obat masuk berdasarkan lokasi, batch, dan kedaluwarsa.">
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft /> Kembali
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle>Data Penerimaan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Obat *</Label>
            <Select value={medicineId} onValueChange={(v) => setMedicineId(v as string)}>
              <SelectTrigger className="w-full">
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
          <div className="space-y-2">
            <Label>Lokasi *</Label>
            <Select value={locationId} onValueChange={(v) => setLocationId(v as string)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih lokasi" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nomor batch *</Label>
            <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="mis. BN-202609-A" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Jumlah *</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Tanggal kedaluwarsa *</Label>
              <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Batal
        </Button>
        <Button onClick={submit}>Simpan Penerimaan</Button>
      </div>
    </div>
  );
}
