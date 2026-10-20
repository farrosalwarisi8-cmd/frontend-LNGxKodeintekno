import {
  Ban,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  FileText,
  FlaskConical,
  Lock,
  TestTubeDiagonal,
} from "lucide-react";
import { Badge } from "@/shared/components/design-system/badge";
import type { StatusInfo } from "@/features/lab/status-map";

const ICONS = {
  clock: Clock,
  sample: TestTubeDiagonal,
  flask: FlaskConical,
  check: CheckCircle2,
  lock: Lock,
  ban: Ban,
  file: FileText,
  draft: ClipboardCheck,
} as const;

/**
 * Badge status dengan IKON + LABEL TEKS + warna — status tidak pernah
 * dikomunikasikan lewat warna saja (WCAG 1.4.1). Label berasal dari
 * `status-map.ts` yang membaca nilai API.
 */
export function LabStatusBadge({
  info,
  className,
}: {
  info: StatusInfo;
  className?: string;
}) {
  const Icon = ICONS[info.icon] ?? Clock;
  return (
    <Badge variant={info.variant} className={className}>
      <Icon className="size-3" aria-hidden="true" />
      {info.label}
    </Badge>
  );
}
