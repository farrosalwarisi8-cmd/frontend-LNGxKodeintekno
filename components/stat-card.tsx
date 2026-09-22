import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: "default" | "warning" | "danger" | "success" | "info";
  hint?: string;
}) {
  const tones: Record<string, string> = {
    default: "bg-muted text-foreground",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
    success: "bg-emerald-100 text-emerald-700",
    info: "bg-blue-100 text-blue-700",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold leading-tight">{value}</div>
          <div className="truncate text-sm text-muted-foreground">{label}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
