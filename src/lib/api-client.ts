/**
 * API client terpusat untuk seluruh modul frontend.
 *
 * Disesuaikan dengan kontrak backend NestJS (lihat API_ENDPOINTS.md):
 * - Base URL : http://localhost:3000/api/v1  (prefix global `api/v1`)
 * - Envelope : { success, statusCode, message, data, meta?, timestamp }  -> dikembalikan sebagai `data`
 * - Error    : { success: false, statusCode, error, message, fieldErrors?, traceId } -> dilempar sebagai ApiError
 * - Header   : Content-Type, Accept, Authorization: Bearer <jwt>, X-Trace-Id
 */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

const TOKEN_KEY = "kodein_token";
const REFRESH_TOKEN_KEY = "kodein_refresh_token";

export interface ApiFieldError {
  field: string;
  message: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResult<T> {
  data: T;
  meta?: PageMeta;
}

interface BackendEnvelope<T> {
  success: boolean;
  statusCode: number;
  message?: string | string[];
  error?: string;
  data?: T;
  meta?: PageMeta;
  fieldErrors?: ApiFieldError[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fieldErrors?: ApiFieldError[]
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function setRefreshToken(token: string) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

/** Trace ID per request (sesuai spesifikasi header X-Trace-Id backend). */
function newTraceId(): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(16).slice(2) + Date.now().toString(16);
  return `req-${rnd}`;
}

function toMessage(body: BackendEnvelope<unknown> | Record<string, unknown>, status: number): string {
  const msg = (body as BackendEnvelope<unknown>).message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string" && msg) return msg;
  const err = (body as BackendEnvelope<unknown>).error;
  if (typeof err === "string" && err) return err;
  return `Request failed with status ${status}`;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Trace-Id": newTraceId() },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as BackendEnvelope<{ accessToken: string }>;
    const accessToken = body?.data?.accessToken ?? (body as unknown as { accessToken?: string })?.accessToken;
    if (!accessToken) return null;
    setToken(accessToken);
    return accessToken;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}, allowRefresh = true): Promise<T> {
  return (await requestFull<T>(path, options, allowRefresh)).data;
}

/**
 * Mengirim request dan mengembalikan `{ data, meta }` sehingga modul
 * dengan pagination (patients, mcu, users, audit-log) tetap mendapat `meta`.
 */
async function requestFull<T>(
  path: string,
  options: RequestInit = {},
  allowRefresh = true
): Promise<ApiResult<T>> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Trace-Id": newTraceId(),
    ...((options.headers as Record<string, string>) ?? {}),
  };

  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiError(0, "Tidak dapat terhubung ke server backend. Pastikan backend berjalan di port 3000.");
  }

  // Token kedaluwarsa -> coba refresh sekali lalu ulangi request
  if (res.status === 401 && allowRefresh && !path.startsWith("/auth/")) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return requestFull<T>(path, options, false);
    }
  }

  if (res.status === 401) {
    clearToken();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiError(401, "Sesi telah berakhir. Silakan login kembali.");
  }

  if (res.status === 204) return { data: undefined as unknown as T };

  const body = (await res.json().catch(() => ({}))) as BackendEnvelope<T> & Record<string, unknown>;

  if (!res.ok || body?.success === false) {
    throw new ApiError(
      typeof body?.statusCode === "number" ? body.statusCode : res.status,
      toMessage(body, res.status),
      body?.fieldErrors
    );
  }

  // Envelope standar backend: ambil `data` + `meta`
  if (body && typeof body === "object" && "success" in body && "data" in body) {
    return { data: body.data as T, meta: body.meta };
  }

  return { data: body as unknown as T };
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  getPaged: <T>(path: string) => requestFull<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export {
  getToken,
  setToken,
  clearToken,
  getRefreshToken,
  setRefreshToken,
  API_BASE_URL,
};
