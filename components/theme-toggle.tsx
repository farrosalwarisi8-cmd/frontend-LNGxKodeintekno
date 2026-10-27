"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

type ThemeChoice = "light" | "dark" | "system";

const OPTIONS: ReadonlyArray<{
  value: ThemeChoice;
  label: string;
  Icon: typeof Sun;
}> = [
  { value: "light", label: "Terang", Icon: Sun },
  { value: "dark", label: "Gelap", Icon: Moon },
  { value: "system", label: "Sistem", Icon: Monitor },
];

/**
 * Pengalih tema Terang / Gelap / Sistem (Tugas 4 rebrand visible).
 *
 * - Tiga tombol dengan ikon Lucide + label teks, `aria-pressed` menandai
 *   pilihan aktif; grup ber-`role="radiogroup"` sehingga screen reader
 *   mengumumkan sebagai satu pilihan.
 * - Target sentuh ≥ 44 px (`size-11`), dapat dioperasikan keyboard penuh
 *   (tombol natif).
 * - Render aman hidrasi: sebelum mounted (tema belum diketahui klien),
 *   tampilkan placeholder non-interaktif agar tidak ada kilatan status
 *   yang salah dan tidak ada hydration mismatch.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // Render aman hidrasi: sebelum mounted (tema belum diketahui klien),
  // tampilkan placeholder non-interaktif agar tidak ada kilatan status
  // yang salah dan tidak ada hydration mismatch. `useSyncExternalStore`
  // (bukan setState di effect) agar lolos aturan react-hooks.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) {
    return (
      <div
        className={cn("flex items-center gap-1 rounded-xl border border-border p-1", className)}
        aria-hidden="true"
      >
        {OPTIONS.map(({ label, Icon }) => (
          <span
            key={label}
            className="flex size-11 items-center justify-center rounded-lg text-muted-foreground"
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        ))}
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label="Pilih tema tampilan" className={cn("flex items-center gap-1 rounded-xl border border-border bg-card p-1", className)}>
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            title={label}
            aria-label={`Tema ${label}`}
            onClick={() => setTheme(value)}
            className={cn(
              "flex size-11 flex-col items-center justify-center gap-0.5 rounded-lg text-[10px] font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
