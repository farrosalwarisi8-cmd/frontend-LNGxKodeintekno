/**
 * Konfigurasi environment frontend — SATU-SATUNYA tempat env publik dibaca.
 *
 * Aturan (gap F1-C / F1-D):
 *  - API base URL terpusat di sini (bukan nilai cadangan URL lokal yang
 *    tersebar di beberapa file).
 *  - **TIDAK ADA fallback localhost sama sekali** — termasuk di development:
 *    bila `NEXT_PUBLIC_API_URL` kosong/tidak valid, konfigurasi dinyatakan
 *    INVALID dan setiap request menolak jalan dengan pesan jelas (bukan request
 *    ke URL kosong atau diam-diam menembak localhost). Local development tetap
 *    berjalan lewat konfigurasi eksplisit di `.env.local`.
 *  - Karena itu tidak ada satu pun literal URL localhost di source runtime,
 *    sehingga bundle client tidak pernah memuat endpoint lokal.
 *  - Demo/mock mode hanya aktif bila diminta eksplisit (`NEXT_PUBLIC_ENABLE_DEMO`),
 *    default NONAKTIF pada staging/production.
 *  - Tidak ada secret pada `NEXT_PUBLIC_*` (semua nilai ter-inline ke bundle).
 */

export type FrontendEnvironment = "production" | "staging" | "development" | "unknown";

export interface ApiEnvConfig {
  /** Base URL ternormalisasi, atau `null` bila konfigurasi invalid. */
  baseUrl: string | null;
  /** Pesan konfigurasi yang harus ditampilkan bila `baseUrl === null`. */
  error: string | null;
  /** Berapa base URL menunjuk ke mesin lokal (localhost/127.0.0.1/[::1]). */
  isLocalhost: boolean;
  environment: FrontendEnvironment;
}

export const CONFIG_ERROR_MESSAGE =
  "Konfigurasi tidak valid: NEXT_PUBLIC_API_URL belum diisi untuk build ini. " +
  "Isi NEXT_PUBLIC_API_URL dengan URL API backend sebelum menjalankan build/deploy.";

export const DEV_CONFIG_ERROR_MESSAGE =
  "Konfigurasi tidak valid: NEXT_PUBLIC_API_URL belum diisi. " +
  "Tambahkan NEXT_PUBLIC_API_URL ke .env.local (contoh: https://api.example.com/api/v1).";

/**
 * Apakah kode berjalan pada test runner (vitest).
 * `null` berarti "tidak diketahui" (bukan membaca env).
 */
export function isTestEnvironment(
  nodeEnv: string | null | undefined = process.env.NODE_ENV
): boolean {
  return nodeEnv === "test";
}

/**
 * Membaca URL API mentah.
 *
 * Gap F1-D: pada test runner (`NODE_ENV=test`) `TEST_API_URL` / `E2E_API_URL`
 * diprioritaskan sehingga unit test **deterministik** dan tidak bergantung pada
 * `.env.local` milik developer; `NEXT_PUBLIC_API_URL` hanya dipakai sebagai
 * fallback terakhir.
 */
function readRawApiUrl(): string | null {
  const candidates = isTestEnvironment()
    ? [process.env.TEST_API_URL, process.env.E2E_API_URL, process.env.NEXT_PUBLIC_API_URL]
    : [process.env.NEXT_PUBLIC_API_URL];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

export function isLocalhostUrl(url: string): boolean {
  try {
    // URL harus absolut; tidak ada base URL cadangan (agar source bebas
    // literal endpoint lokal).
    const { hostname } = new URL(url);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

export function resolveEnvironment(baseUrl: string | null): FrontendEnvironment {
  if (!baseUrl) return "unknown";
  if (isLocalhostUrl(baseUrl)) return "development";
  try {
    const { protocol } = new URL(baseUrl);
    return protocol === "https:" ? "production" : "staging";
  } catch {
    return "unknown";
  }
}

/**
 * Menghitung konfigurasi API dari env.
 *
 * @param raw     default `process.env.NEXT_PUBLIC_API_URL`
 * @param nodeEnv default `process.env.NODE_ENV`
 */
export function resolveApiEnv(
  raw: string | null | undefined = readRawApiUrl(),
  nodeEnv: string | undefined = process.env.NODE_ENV
): ApiEnvConfig {
  const value = typeof raw === "string" ? raw.trim() : "";
  const isProductionBuild = nodeEnv === "production";

  if (!value) {
    return {
      baseUrl: null,
      error: isProductionBuild ? CONFIG_ERROR_MESSAGE : DEV_CONFIG_ERROR_MESSAGE,
      isLocalhost: false,
      environment: "unknown",
    };
  }

  try {
    // `new URL` menolak string relatif (mis. "api/v1") — itulah yang kita mau:
    // base URL API harus absolut.
    const parsed = new URL(value);
    if (!parsed.protocol.startsWith("http")) throw new Error("protokol tidak didukung");
    const baseUrl = normalizeBaseUrl(value);
    return {
      baseUrl,
      error: null,
      isLocalhost: isLocalhostUrl(baseUrl),
      environment: resolveEnvironment(baseUrl),
    };
  } catch {
    return {
      baseUrl: null,
      error:
        `Konfigurasi tidak valid: NEXT_PUBLIC_API_URL ("${value}") bukan URL absolut ` +
        "yang valid (contoh: https://api.example.com/api/v1).",
      isLocalhost: false,
      environment: "unknown",
    };
  }
}

/** Konfigurasi API yang berlaku pada bundle ini. */
export const API_ENV: ApiEnvConfig = resolveApiEnv();

/** Base URL API, atau string kosong bila konfigurasi invalid (lihat `API_CONFIG_ERROR`). */
export const API_BASE_URL: string = API_ENV.baseUrl ?? "";

/** Pesan konfigurasi invalid, atau `null` bila konfigurasi valid. */
export const API_CONFIG_ERROR: string | null = API_ENV.error;

/** Base URL API atau lempar error konfigurasi yang jelas. */
export function requireApiBaseUrl(): string {
  if (!API_ENV.baseUrl) throw new Error(API_ENV.error ?? CONFIG_ERROR_MESSAGE);
  return API_ENV.baseUrl;
}

/** Label environment yang konsisten untuk ditampilkan/di-log. */
export function environmentLabel(env: FrontendEnvironment = API_ENV.environment): string {
  switch (env) {
    case "production":
      return "Production";
    case "staging":
      return "Staging";
    case "development":
      return "Local Development";
    default:
      return "Tidak diketahui";
  }
}

export interface BuildInfo {
  environment: FrontendEnvironment;
  label: string;
  version: string;
  commit: string;
  /** Base URL API (string kosong bila konfigurasi invalid). */
  apiBaseUrl: string;
  /** Konfigurasi API valid? */
  apiConfigured: boolean;
}

export function getBuildInfo(): BuildInfo {
  return {
    environment: API_ENV.environment,
    label: environmentLabel(),
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
    commit: process.env.NEXT_PUBLIC_GIT_COMMIT ?? "",
    apiBaseUrl: API_BASE_URL,
    apiConfigured: API_ENV.baseUrl !== null,
  };
}

/**
 * Demo/mock mode.
 *
 * Hanya aktif bila diminta eksplisit lewat `NEXT_PUBLIC_ENABLE_DEMO=true`.
 * Default: aktif HANYA pada `NODE_ENV=development` (tetap dapat dimatikan
 * dengan `NEXT_PUBLIC_ENABLE_DEMO=false`), NONAKTIF pada staging/production.
 */
export function isDemoModeEnabled(
  raw: boolean | string | null | undefined = process.env.NEXT_PUBLIC_ENABLE_DEMO,
  nodeEnv: string | null | undefined = process.env.NODE_ENV
): boolean {
  if (raw === true) return true;
  if (raw === false) return false;
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (value === "true" || value === "1" || value === "yes") return true;
  if (value === "false" || value === "0" || value === "no") return false;
  return nodeEnv === "development";
}

/**
 * Password akun demo seed. **Tidak pernah ditulis di source** — hanya dibaca
 * dari env saat demo mode aktif, sehingga tidak ada kredensial pada bundle
 * production yang dibangun dengan benar.
 */
export function getDemoPassword(
  raw: string | undefined = process.env.NEXT_PUBLIC_DEMO_PASSWORD
): string {
  return typeof raw === "string" ? raw.trim() : "";
}

/** Helper aman untuk membentuk URL absolut ke API (tanpa fallback diam-diam). */
export function apiUrl(path: string): string {
  const base = requireApiBaseUrl();
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

// ---------------------------------------------------------------------------
// Feature flag publik — Fase A3 (Review MCU, Resume/Sertifikat, D&A)
// ---------------------------------------------------------------------------
//
// Default MATI. Aktifkan hanya pada build environment yang sudah siap
// (`NEXT_PUBLIC_FEATURE_OH_REVIEW=1` / `NEXT_PUBLIC_FEATURE_DNA=1`), agar
// merge dengan flag mati tidak mengubah perilaku aplikasi yang ada.
//
// Pembacaan `NEXT_PUBLIC_*` tetap terpusat di berkas ini (satu-satunya
// pembaca — dijaga test `src/lib/__tests__/frontend-config-audit.test.ts`).

/** Flag review MCU + pembatasan FTW/restriksi (Dokter OH). */
export function isFeatureOhReviewEnabled(
  raw: string | undefined = process.env.NEXT_PUBLIC_FEATURE_OH_REVIEW
): boolean {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return value === "true" || value === "1" || value === "yes" || value === "on";
}

/** Flag modul Drug & Alcohol (D&A) untuk Dokter OH. */
export function isFeatureDnaEnabled(
  raw: string | undefined = process.env.NEXT_PUBLIC_FEATURE_DNA
): boolean {
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  return value === "true" || value === "1" || value === "yes" || value === "on";
}
