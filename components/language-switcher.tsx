"use client";

import { Globe } from "lucide-react";
import { LANGUAGE_OPTIONS, useI18n, type Language } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Pemilih bahasa (ID/EN/ZH). Memakai <select> native agar aksesibel dan
 * ringan; preferensi disimpan oleh I18nProvider.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { language, setLanguage, t } = useI18n();

  return (
    <div className={cn("relative", className)}>
      <Globe
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        aria-label={t("common.language")}
        title={t("common.language")}
        className="h-9 appearance-none rounded-lg border border-border bg-card pl-8 pr-7 text-xs font-medium text-text-secondary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
