import { EmrShell } from "@/components/emr-shell";

export default function EmrLayout({ children }: { children: React.ReactNode }) {
  return <EmrShell>{children}</EmrShell>;
}
