/**
 * Helper untuk test service frontend (environment node).
 * Menyediakan stub localStorage/window agar api-client bisa diuji di Node,
 * serta fetch mock sederhana untuk memverifikasi kontrak endpoint backend.
 */

const mem = new Map<string, string>();

export function installBrowserStubs() {
  const localStorageStub = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => {
      mem.set(k, String(v));
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
    clear: () => mem.clear(),
    key: () => null,
    get length() {
      return mem.size;
    },
  };

  (globalThis as Record<string, unknown>).localStorage = localStorageStub;
  (globalThis as Record<string, unknown>).window = globalThis;
  if (!(globalThis as Record<string, unknown>).location) {
    // `origin` dibutuhkan perancang absolut new URL(..., location.origin).
    (globalThis as Record<string, unknown>).location = {
      href: "",
      origin: "http://localhost",
    };
  }
}

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

export type FetchHandler = (
  req: RecordedRequest,
  index: number
) => { status?: number; body?: unknown };

/** Ganti global.fetch dengan mock yang mencatat setiap request. */
export function mockFetch(handler: FetchHandler) {
  const calls: RecordedRequest[] = [];
  const fetchMock = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const req: RecordedRequest = {
      url: String(input),
      method: (init.method ?? "GET").toUpperCase(),
      headers: (init.headers as Record<string, string>) ?? {},
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(req);
    const res = handler(req, calls.length - 1);
    const status = res.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => res.body ?? {},
    } as Response;
  };
  (globalThis as Record<string, unknown>).fetch = fetchMock;
  return calls;
}

export function envelope<T>(data: T, meta?: unknown) {
  return {
    success: true,
    statusCode: 200,
    message: "Operation completed successfully",
    data,
    ...(meta ? { meta } : {}),
    timestamp: new Date().toISOString(),
  };
}

export function pathOf(url: string): string {
  const u = new URL(url, "http://localhost");
  return `${u.pathname}${u.search}`;
}
