import { EmrShell } from "@/components/emr-shell";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <EmrShell>{children}</EmrShell>;
}
