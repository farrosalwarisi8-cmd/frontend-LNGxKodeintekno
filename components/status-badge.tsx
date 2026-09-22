import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  MCU_STATUS,
  HEALTH_STATUS,
  VISIT_STATUS,
  EMPLOYEE_STATUS,
  CERT_STATUS,
} from "@/lib/constants";

export function StatusBadge({
  value,
  kind,
  className,
}: {
  value: string;
  kind: "mcu" | "health" | "visit" | "employee" | "cert";
  className?: string;
}) {
  const map =
    kind === "mcu"
      ? MCU_STATUS[value as keyof typeof MCU_STATUS]
      : kind === "health"
        ? HEALTH_STATUS[value as keyof typeof HEALTH_STATUS]
        : kind === "visit"
          ? VISIT_STATUS[value as keyof typeof VISIT_STATUS]
          : kind === "employee"
            ? EMPLOYEE_STATUS[value as keyof typeof EMPLOYEE_STATUS]
            : CERT_STATUS[value as keyof typeof CERT_STATUS];

  if (!map) return <Badge variant="outline">{value}</Badge>;
  return (
    <Badge variant="outline" className={cn("border-transparent", map.color, className)}>
      {map.label}
    </Badge>
  );
}
