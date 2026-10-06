import { beforeEach, describe, expect, it } from "vitest";
import { installBrowserStubs, mockFetch, envelope, pathOf } from "./helpers";

installBrowserStubs();

describe("api-client (kontrak response backend)", () => {
  beforeEach(() => {
    localStorage.clear();
    (globalThis as { location?: { href: string } }).location!.href = "";
  });

  it("membuka base URL default http://localhost:3000/api/v1", async () => {
    const calls = mockFetch(() => ({ body: envelope({ ok: true }) }));
    const { apiClient, API_BASE_URL } = await import("@/lib/api-client");

    expect(API_BASE_URL).toBe("http://localhost:3000/api/v1");

    await apiClient.get("/patients");
    expect(calls[0].url).toBe("http://localhost:3000/api/v1/patients");
  });

  it("mengembalikan `data` dari envelope dan `meta` untuk pagination", async () => {
    mockFetch(() => ({
      body: envelope([{ id: "p1" }], { page: 2, limit: 10, total: 25, totalPages: 3 }),
    }));
    const { apiClient } = await import("@/lib/api-client");

    const res = await apiClient.getPaged<unknown[]>("/patients?page=2&limit=10");
    expect(res.data).toEqual([{ id: "p1" }]);
    expect(res.meta).toEqual({ page: 2, limit: 10, total: 25, totalPages: 3 });
  });

  it("melempar ApiError dari error envelope backend (message + fieldErrors)", async () => {
    mockFetch(() => ({
      status: 422,
      body: {
        success: false,
        statusCode: 422,
        error: "Unprocessable Entity",
        message: "Validation failed on submitted payload",
        fieldErrors: [{ field: "systolicBp", message: "Systolic BP must be between 50 and 260 mmHg" }],
      },
    }));
    const { apiClient, ApiError } = await import("@/lib/api-client");

    const err = (await apiClient
      .post("/clinic/encounters/abc/vitals", {})
      .catch((e: unknown) => e)) as {
      status: number;
      message: string;
      fieldErrors?: Array<{ field: string; message: string }>;
    } & InstanceType<typeof ApiError>;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(422);
    expect(err.message).toBe("Validation failed on submitted payload");
    expect(err.fieldErrors?.[0].field).toBe("systolicBp");
  });

  it("mengirim header Authorization (JWT) dan X-Trace-Id", async () => {
    const calls = mockFetch(() => ({ body: envelope([]) }));
    const { apiClient, setToken } = await import("@/lib/api-client");
    setToken("jwt-tes-123");

    await apiClient.get("/notifications");
    expect(calls[0].headers["Authorization"]).toBe("Bearer jwt-tes-123");
    expect(calls[0].headers["X-Trace-Id"]).toMatch(/^req-/);
    expect(calls[0].headers["Content-Type"]).toBe("application/json");
  });

  it("mencoba refresh token saat 401 lalu mengulang request", async () => {
    const calls = mockFetch((req, index) => {
      if (req.url.endsWith("/auth/refresh")) {
        return { body: envelope({ accessToken: "token-baru" }) };
      }
      // percobaan pertama 401, setelah refresh berhasil -> 200
      if (index === 0) {
        return { status: 401, body: { success: false, message: "Unauthorized" } };
      }
      return { body: envelope({ ok: true }) };
    });

    const { apiClient, setToken, setRefreshToken } = await import("@/lib/api-client");
    setToken("jwt-lama");
    setRefreshToken("refresh-lama");

    const res = await apiClient.get<{ ok: boolean }>("/patients");
    expect(res.ok).toBe(true);
    expect(calls[1].url).toContain("/auth/refresh");
    expect(calls[1].body).toEqual({ refreshToken: "refresh-lama" });
    expect(calls[2].headers["Authorization"]).toBe("Bearer token-baru");
  });

  it("membersihkan sesi dan mengarahkan ke /login ketika token kedaluwarsa", async () => {
    mockFetch(() => ({ status: 401, body: { success: false, message: "Unauthorized" } }));
    const { apiClient, setToken, getToken } = await import("@/lib/api-client");
    setToken("jwt-kedaluwarsa");

    const err = (await apiClient.get("/patients").catch((e: unknown) => e)) as {
      status: number;
    };
    expect(err.status).toBe(401);
    expect(getToken()).toBeNull();
    expect((globalThis as { location: { href: string } }).location.href).toBe("/login");
  });

  it("path yang diminta service selalu diawali prefix /api/v1", async () => {
    const calls = mockFetch(() => ({ body: envelope([]) }));
    const { apiClient } = await import("@/lib/api-client");
    await apiClient.get("/clinic/queues");
    expect(pathOf(calls[0].url)).toBe("/api/v1/clinic/queues");
  });
});
