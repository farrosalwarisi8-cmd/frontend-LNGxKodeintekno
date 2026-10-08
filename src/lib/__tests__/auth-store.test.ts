import { describe, it, expect, beforeEach, afterEach } from "vitest";

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

const documentMock = { cookie: "" };

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });
Object.defineProperty(globalThis, "document", { value: documentMock, writable: true });

import { useStore } from "../../../lib/store";

const realFetch = globalThis.fetch;
// Snapshot pengguna awal: test login/MFA menambahkan user baru ke store.
const seedUsers = useStore.getState().users;

interface StubResponse {
  status: number;
  ok: boolean;
  body: unknown;
}

function stubFetch(responses: StubResponse[]) {
  let index = 0;
  globalThis.fetch = (async () => {
    const res = responses[Math.min(index++, responses.length - 1)];
    return {
      status: res.status,
      ok: res.ok,
      json: async () => res.body,
    } as unknown as Response;
  }) as typeof fetch;
}

function envelope(data: unknown) {
  return { success: true, statusCode: 200, message: "ok", data };
}

const backendAdmin = {
  id: "be-admin",
  username: "admin",
  roles: ["SYSTEM_ADMIN"],
  isMedicalRole: true,
};

beforeEach(() => {
  localStorageMock.clear();
  documentMock.cookie = "";
  useStore.setState({ currentUserId: null, session: null, _hasHydrated: false, users: seedUsers });
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("store.login()", () => {
  it("login sukses menyimpan sesi, user, dan cookie middleware", async () => {
    stubFetch([
      {
        status: 200,
        ok: true,
        body: envelope({ accessToken: "tok-1", refreshToken: "rt-1", user: backendAdmin }),
      },
    ]);

    const result = await useStore.getState().login("admin", "AdminLNG2026!");

    expect(result.ok).toBe(true);
    const state = useStore.getState();
    expect(state.currentUserId).toBe("be-admin");
    expect(state.session?.userId).toBe("be-admin");
    expect(state.session?.mfaVerified).toBe(true);
    expect(localStorageMock.getItem("kodein_token")).toBe("tok-1");
    expect(documentMock.cookie).toContain("kodein-klinik-store");
    expect(documentMock.cookie).toContain("be-admin");
  });

  it("login gagal mengembalikan pesan backend dan tidak membuat sesi", async () => {
    stubFetch([
      {
        status: 400,
        ok: false,
        body: { success: false, statusCode: 400, message: "Invalid username or password" },
      },
    ]);

    const result = await useStore.getState().login("admin", "salah");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Invalid username or password");
    expect(useStore.getState().currentUserId).toBeNull();
  });

  it("MFA diperlukan → tidak ada sesi sampai verifyMfa", async () => {
    stubFetch([
      {
        status: 200,
        ok: true,
        body: envelope({ mfaRequired: true, userId: "be-mfa", mfaMethod: "TOTP" }),
      },
    ]);

    const result = await useStore.getState().login("admin", "AdminLNG2026!");

    expect(result.ok).toBe(false);
    expect(result.mfaRequired).toBe(true);
    expect(result.userId).toBe("be-mfa");
    expect(useStore.getState().currentUserId).toBeNull();
  });

  it("backend tidak dapat dihubungi → error yang bisa dibaca", async () => {
    globalThis.fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;

    const result = await useStore.getState().login("admin", "x");

    expect(result.ok).toBe(false);
    expect(typeof result.error).toBe("string");
    expect(result.error?.length).toBeGreaterThan(0);
  });
});

describe("store.verifyMfa()", () => {
  it("MFA sukses membuat sesi", async () => {
    stubFetch([
      {
        status: 200,
        ok: true,
        body: envelope({ accessToken: "tok-mfa", refreshToken: "rt-mfa", user: backendAdmin }),
      },
    ]);

    const result = await useStore.getState().verifyMfa("be-mfa", "123456");

    expect(result.ok).toBe(true);
    expect(useStore.getState().currentUserId).toBe("be-admin");
  });

  it("MFA gagal mengembalikan error tanpa sesi", async () => {
    stubFetch([
      {
        status: 401,
        ok: false,
        body: { success: false, statusCode: 401, message: "Kode MFA salah" },
      },
    ]);

    const result = await useStore.getState().verifyMfa("be-mfa", "000000");

    expect(result.ok).toBe(false);
    expect(useStore.getState().currentUserId).toBeNull();
  });
});

describe("session restore & logout", () => {
  it("sesi dapat dipulihkan dari state tersimpan (refresh tidak logout)", () => {
    const seeded = useStore.getState().users[0];
    useStore.setState({
      currentUserId: seeded.id,
      session: {
        userId: seeded.id,
        loginAt: "2026-10-01T00:00:00.000Z",
        lastActivity: "2026-10-01T00:00:00.000Z",
        mfaVerified: true,
      },
      _hasHydrated: true,
    });

    const state = useStore.getState();
    const user = state.users.find((u) => u.id === state.currentUserId);
    expect(state._hasHydrated).toBe(true);
    expect(user?.id).toBe(seeded.id);
  });

  it("logout menghapus sesi, token, dan cookie", () => {
    useStore.setState({
      currentUserId: "u1",
      session: {
        userId: "u1",
        loginAt: "2026-10-01T00:00:00.000Z",
        lastActivity: "2026-10-01T00:00:00.000Z",
        mfaVerified: true,
      },
    });
    localStorageMock.setItem("kodein_token", "tok");
    documentMock.cookie = "kodein-klinik-store=abc";

    useStore.getState().logout();

    expect(useStore.getState().currentUserId).toBeNull();
    expect(useStore.getState().session).toBeNull();
    expect(localStorageMock.getItem("kodein_token")).toBeNull();
    expect(documentMock.cookie).toContain("kodein-klinik-store=;");
  });
});
