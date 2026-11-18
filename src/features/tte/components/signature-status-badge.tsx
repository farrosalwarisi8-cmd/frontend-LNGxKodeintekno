"use client";

import {
  AlertTriangle,
  CheckCircle,
  Clock,
  HelpCircle,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Badge } from "@/shared/components/design-system/badge";
import { mapSignatureStatus } from "@/features/tte/signature-status";

const ICONS = {
  PENDING: Clock,
  PROCESSING: RefreshCw,
  SIGNED: CheckCircle,
  FAILED: XCircle,
  EXPIRED: AlertTriangle,
  CANCELLED: XCircle,
} as const;

/**
 * Badge status TTE. Status tidak dikenal tidak pernah ditampilkan sebagai
 * "SIGNED" — ia memakai label fallback aman dan ikon tanda tanya.
 */
export function SignatureStatusBadge({
  status,
  animate = false,
}: {
  status: string | null | undefined;
  animate?: boolean;
}) {
  const view = mapSignatureStatus(status);
  const Icon = view.known ? ICONS[view.status as keyof typeof ICONS] ?? HelpCircle : HelpCircle;
  return (
    <Badge variant={view.variant} role="status">
      <Icon
        className={`mr-1 size-3 ${animate && view.isActive ? "animate-spin" : ""}`}
        aria-hidden="true"
      />
      {view.label}
    </Badge>
  );
}
