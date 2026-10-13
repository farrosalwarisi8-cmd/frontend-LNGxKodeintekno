import { describe, expect, it } from "vitest";
import {
  API_BASE_URL,
  CONFIG_ERROR_MESSAGE,
  DEV_CONFIG_ERROR_MESSAGE,
  environmentLabel,
  getBuildInfo,
  isDemoModeEnabled,
  isLocalhostUrl,
  isTestEnvironment,
  resolveApiEnv,
  resolveEnvironment,
} from "@/lib/env";

describe("resolveApiEnv — konfigurasi API (gap F1-C/F1-D)", () => {
  it("build production TANPA NEXT_PUBLIC_API_URL → konfigurasi invalid (bukan localhost)", () => {
    const env = resolveApiEnv("", "production");
    expect(env.baseUrl).toBeNull();
    expect(env.error).toBe(CONFIG_ERROR_MESSAGE);
    expect(env.isLocalhost).toBe(false);
    expect(env.environment).toBe("unknown");
  });

  it("nilai kosong/absen pada production juga invalid", () => {
    expect(resolveApiEnv(null, "production").baseUrl).toBeNull();
    expect(resolveApiEnv(null, "production").error).toBe(CONFIG_ERROR_MESSAGE);
  });

  it("development tanpa nilai juga INVALID — tidak ada fallback localhost di source", () => {
    const env = resolveApiEnv("", "development");
    expect(env.baseUrl).toBeNull();
    expect(env.error).toBe(DEV_CONFIG_ERROR_MESSAGE);
    expect(env.isLocalhost).toBe(false);
    expect(env.environment).toBe("unknown");
  });

  it("test runner tanpa nilai juga INVALID (nilai test di-inject vitest.config.ts)", () => {
    expect(resolveApiEnv("", "test").baseUrl).toBeNull();
  });

  it("URL https non-lokal tidak dianggap localhost", () => {
    const env = resolveApiEnv("https://api.kodein.example.com/api/v1", "production");
    expect(env.baseUrl).toBe("https://api.kodein.example.com/api/v1");
    expect(env.isLocalhost).toBe(false);
    expect(env.environment).toBe("production");
    expect(env.error).toBeNull();
  });

  it("trailing slash dinormalisasi (tidak menghasilkan //path)", () => {
    expect(resolveApiEnv("https://api.example.com/api/v1/", "production").baseUrl).toBe(
      "https://api.example.com/api/v1"
    );
  });

  it("URL relatif/aneh ditolak dengan pesan konfigurasi", () => {
    for (const bad of ["api/v1", "/api/v1", "localhost:3000", "ftp://x.example.com"]) {
      const env = resolveApiEnv(bad, "production");
      expect(env.baseUrl, bad).toBeNull();
      expect(env.error, bad).toBeTruthy();
    }
  });

  it("http non-lokal → label staging (belum TLS)", () => {
    expect(resolveApiEnv("http://staging.internal/api/v1", "production").environment).toBe("staging");
  });
});

describe("isLocalhostUrl", () => {
  it("mengenali localhost, 127.0.0.1, 0.0.0.0 dan subdomain .localhost", () => {
    expect(isLocalhostUrl("http://localhost:3000/api/v1")).toBe(true);
    expect(isLocalhostUrl("http://127.0.0.1:3100/api/v1")).toBe(true);
    expect(isLocalhostUrl("http://0.0.0.0:8080")).toBe(true);
    expect(isLocalhostUrl("http://app.localhost/api/v1")).toBe(true);
    expect(isLocalhostUrl("https://api.example.com/api/v1")).toBe(false);
  });
});

describe("isDemoModeEnabled (gap F1-C: mock/demo eksplisit)", () => {
  it("default NONAKTIF di staging/production dan pada nilai tak dikenal", () => {
    expect(isDemoModeEnabled(null, "production")).toBe(false);
    expect(isDemoModeEnabled("", "production")).toBe(false);
    expect(isDemoModeEnabled(null, "staging")).toBe(false);
    expect(isDemoModeEnabled("mungkin", "production")).toBe(false);
  });

  it("default AKTIF hanya pada development", () => {
    expect(isDemoModeEnabled(null, "development")).toBe(true);
    expect(isDemoModeEnabled(null, "test")).toBe(false);
  });

  it("dapat dipaksa mati di development dan hidup secara eksplisit", () => {
    expect(isDemoModeEnabled("false", "development")).toBe(false);
    expect(isDemoModeEnabled("0", "development")).toBe(false);
    expect(isDemoModeEnabled("true", "production")).toBe(true);
    expect(isDemoModeEnabled(true, "production")).toBe(true);
  });
});

describe("environmentLabel & isTestEnvironment", () => {
  it("label konsisten per environment", () => {
    expect(environmentLabel("production")).toBe("Production");
    expect(environmentLabel("staging")).toBe("Staging");
    expect(environmentLabel("development")).toBe("Local Development");
    expect(environmentLabel("unknown")).toBe("Tidak diketahui");
  });

  it("test runner terdeteksi dari NODE_ENV", () => {
    expect(isTestEnvironment("test")).toBe(true);
    expect(isTestEnvironment("production")).toBe(false);
    expect(isTestEnvironment(null)).toBe(false);
  });
});

describe("konfigurasi pada proses test ini", () => {
  it("konfigurasi yang dipakai modul sama dengan env test aktif (di-inject vitest.config.ts)", () => {
    expect(API_BASE_URL).toBe(process.env.NEXT_PUBLIC_API_URL ?? "");
    expect(process.env.NODE_ENV).toBe("test");
    // Demo mode dimatikan eksplisit pada test runner.
    expect(isDemoModeEnabled()).toBe(false);
  });

  it("getBuildInfo melaporkan status konfigurasi", () => {
    const info = getBuildInfo();
    expect(typeof info.apiConfigured).toBe("boolean");
    expect(info.apiBaseUrl).toBe(API_BASE_URL);
    expect(info.label.length).toBeGreaterThan(0);
  });

  it("resolveEnvironment tidak crash untuk input aneh", () => {
    expect(resolveEnvironment(null)).toBe("unknown");
  });
});
