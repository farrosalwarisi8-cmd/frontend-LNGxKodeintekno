"use client";

import { useRouter } from "next/navigation";
import { useStore, useCurrentUser } from "@/lib/store";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function QueuePage() {
  const router = useRouter();
  const user = useCurrentUser();
  const visits = useStore((s) => s.visits);
  const employees = useStore((s) => s.employees);

  if (!user) return null;
  const queue = visits
    .filter((v) => ["Registered", "In Queue", "In Consultation", "Awaiting Pharmacy"].includes(v.status))
    .sort((a, b) => a.queueNumber - b.queueNumber);

  return (
    <div>
      <PageHeader title="Queue Board" description="Antrean pasien klinik hari ini." />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {queue.map((v) => {
          const emp = employees.find((e) => e.id === v.employeeId);
          return (
            <Card key={v.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-lg font-semibold">
                    {v.queueNumber}
                  </div>
                  <div>
                    <p className="font-medium">{emp?.fullName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.visitNumber} · {v.chiefComplaint}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge value={v.status} kind="visit" />
                  <Button size="xs" variant="outline" onClick={() => router.push(`/visits/${v.id}`)}>
                    Proses
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {queue.length === 0 && (
          <div className="col-span-full rounded-xl border bg-white py-12 text-center text-muted-foreground">
            Tidak ada pasien dalam antrean.
          </div>
        )}
      </div>
    </div>
  );
}
