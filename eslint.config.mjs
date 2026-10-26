import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import noRawColors from "./eslint-rules/no-raw-colors.mjs";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Rebrand LNG: semua warna harus dari token semantik (app/globals.css).
  // Lingkup = berkas UI saja; berkas token itu sendiri bukan file JS,
  // dan KODEINxLNG-Backend di luar cakupan frontend.
  {
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
      "src/**/*.{ts,tsx}",
      "e2e/**/*.{ts,tsx,mjs}",
      "scripts/**/*.mjs",
      "middleware.ts",
      "*.{ts,mjs}",
    ],
    plugins: {
      rebrand: { rules: { "no-raw-colors": noRawColors } },
    },
    rules: {
      "rebrand/no-raw-colors": "error",
    },
  },
  // E2E Playwright: `use()` pada `test.extend()` adalah API fixture Playwright,
  // bukan React Hook — aturan react-hooks tidak berlaku di folder ini.
  {
    files: ["e2e/playwright/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
