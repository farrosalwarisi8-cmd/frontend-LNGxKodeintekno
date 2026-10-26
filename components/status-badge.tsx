import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import type { StatusMeta } from "@/lib/status-map";

interface StatusBadgeProps {
  /** Entri dari peta status terpusat (`lib/status-map.ts`). */
  meta?: StatusMeta | null;
  /** Nilai mentah bila status tidak ada di peta (tetap ditampilkan teks). */
  fallback?: string;
  className?: string;
}

/**
 * Badge status klinis: SELALU ikon + label teks, bukan warna saja.
 *
 * Warna datang dari `meta.color` (token semantik), ikon dari `meta.icon`,
 * sehingga makna status tetap terbaca pada layar buta warna dan saat dicetak
 * hitam-putih.
 */
export function StatusBadge({ meta, fallback, className }: StatusBadgeProps) {
  if (!meta) {
    if (!fallback) return null;
    return (
      <Badge variant="outline" className={className}>
        {fallback}
      </Badge>
    );
  }

  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={cn("gap-1.5", meta.color, className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span>{meta.label}</span>
    </Badge>
  );
}

StatusBadge.displayName = "StatusBadge";