import { describe, expect, it } from "vitest";
import { translationKeys, type Language } from "@/lib/i18n";
import { dashboardPhraseKeys } from "@/features/dashboard/dashboard-i18n";

const LANGUAGES: Language[] = ["id", "en", "zh"];
// Semua prefiks yang dipakai kamus `src/lib/i18n.tsx`.
const PREFIXES = [
  "nav.",
  "shell.",
  "common.",
  "page.",
  "queue.",
  "dispense.",
  "ret.",
  "visits.",
  "medicalRecords.",
  "medicine.",
  "outside.",
  "referral.",
] as const;

describe("kelengkapan kamus i18n", () => {
  for (const prefix of PREFIXES) {
    describe(`kunci ${prefix}*`, () => {
      const idKeys = translationKeys("id").filter((key) => key.startsWith(prefix));
      const idKeySet = new Set(idKeys);

      it("ada di kamus Bahasa Indonesia", () => {
        expect(idKeys.length).toBeGreaterThan(0);
      });

      for (const language of LANGUAGES) {
        it(`lengkap di bahasa ${language}`, () => {
          const keys = new Set(translationKeys(language));
          const missing = idKeys.filter((key) => !keys.has(key));
          expect(missing, `kunci hilang di ${language}`).toEqual([]);
        });
      }

      it("tidak punya kunci tambahan di bahasa lain", () => {
        for (const language of LANGUAGES) {
          const extra = translationKeys(language).filter(
            (key) => key.startsWith(prefix) && !idKeySet.has(key)
          );
          expect(extra, `kunci ${prefix}* tidak ada di kamus id`).toEqual([]);
        }
      });
    });
  }
});

describe("kelengkapan kamus dashboard", () => {
  // Dashboard memakai peta frasa Indonesia (bukan kunci berprefiks), jadi
  // kelengkapannya diuji dengan membandingkan himpunan frasa EN dan ZH.
  it("EN dan ZH memuat frasa yang sama", () => {
    const en = dashboardPhraseKeys("en");
    const zhKeys = new Set(dashboardPhraseKeys("zh"));

    expect(en.length).toBeGreaterThan(0);
    expect(en.filter((phrase) => !zhKeys.has(phrase)), "frasa hilang di zh").toEqual(
      []
    );
    expect(
      [...zhKeys].filter((phrase) => !en.includes(phrase)),
      "frasa tidak ada di en"
    ).toEqual([]);
  });
});
