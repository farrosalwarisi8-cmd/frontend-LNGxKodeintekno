import { EmrShell } from "@/components/emr-shell";
import { RouteGuard } from "@/components/route-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <EmrShell>
      <RouteGuard>{children}</RouteGuard>
    </EmrShell>
  );
}
