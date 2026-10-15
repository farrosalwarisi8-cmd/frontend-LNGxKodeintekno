import {
  apiClient,
  setToken,
  clearToken,
  setRefreshToken,
  getToken,
  decodeJwtPayload,
} from "@/lib/api-client";

/**
 * Modul 1 — IAM / Autentikasi.
 * Endpoint mengikuti backend (Domain 1: IAM):
 *   POST /api/v1/auth/login
 *   POST /api/v1/auth/mfa/verify
 *   POST /api/v1/auth/refresh
 */

/** Role backend (kode RBAC) -> role frontend (lib/types Role). */
export const BACKEND_ROLE_MAP: Record<string, string> = {
  SYSTEM_ADMIN: "admin",
  DOCTOR_OH: "dokter-oh",
  DOCTOR_CLINIC: "dokter-klinik",
  NURSE: "perawat",
  PHARMACIST: "apoteker",
  LAB_ANALYST: "lab",
  RADIOLOGIST: "lab",
  HR_ADMIN: "hr",
  HSE_OFFICER: "hse",
  HSE_MANAGER: "hse",
  MANAGEMENT: "manajemen",
};

/** Nama tampilan peran (dipakai untuk title user pada sidebar/topbar). */
export const ROLE_TITLES: Record<string, string> = {
  admin: "System Administrator",
  "dokter-oh": "Dokter Spesialis Okupasi",
  "dokter-klinik": "Dokter Klinik",
  perawat: "Perawat Klinik",
  apoteker: "Apoteker",
  lab: "Analis Lab / Radiolog",
  "admin-klinik": "Admin Klinik",
  hr: "HR Officer",
  hse: "HSE Officer",
  manajemen: "Management",
  pekerja: "Pekerja",
};

/**
 *Inverse map: role frontend -> kode role backend.
 * Dipakai oleh Manajemen User saat membuat/mengubah akun (POST/PATCH /iam/users).
 * Role frontend tanpa padanan backend (admin-klinik, pekerja) dikembalikan null
 * sehingga UI dapat menolak dengan pesan jelas, bukan mengirim kode palsu.
 */
export const FRONTEND_ROLE_TO_BACKEND: Record<string, string> = {
  admin: "SYSTEM_ADMIN",
  "dokter-oh": "DOCTOR_OH",
  "dokter-klinik": "DOCTOR_CLINIC",
  perawat: "NURSE",
  apoteker: "PHARMACIST",
  lab: "LAB_ANALYST",
  hr: "HR_ADMIN",
  hse: "HSE_OFFICER",
  manajemen: "MANAGEMENT",
};

export function backendRoleCode(frontendRole: string): string | null {
  return FRONTEND_ROLE_TO_BACKEND[frontendRole] ?? null;
}

export function mapBackendRole(roles: string[] = []): string {
  for (const r of roles) {
    if (BACKEND_ROLE_MAP[r]) return BACKEND_ROLE_MAP[r];
  }
  // Role tidak dikenal: batasi akses UI ke modul paling rendah (least privilege)
  return "pekerja";
}

/** Bentuk `user` pada response login backend. */
export interface BackendUser {
  id: string;
  username: string;
  email?: string;
  roles?: string[];
  isMedicalRole?: boolean;
}

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: string;
  isMedicalRole: boolean;
}

export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: BackendUser;
  mfaRequired?: boolean;
  /**
   * TRUE bila role pengguna mewajibkan MFA tetapi akun belum punya secret TOTP.
   * Backend membalas `{ mfaRequired: true, mfaSetupRequired: true, userId, mfaMethod: "TOTP" }`
   * TANPA token — frontend harus menyelesaikan setup (`/auth/mfa/setup` → `/auth/mfa/enable`)
   * lalu memverifikasi kode (`/auth/mfa/verify`) sebelum token diterbitkan.
   */
  mfaSetupRequired?: boolean;
  userId?: string;
  mfaMethod?: string;
  message?: string;
}

export interface MfaVerifyResponse {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: BackendUser;
}

/** Response `POST /auth/mfa/setup` — parameter pendaftaran authenticator. */
export interface MfaSetupResponse {
  secret: string;
  otpauthUri: string;
  issuer: string;
  account: string;
  instructions?: string;
}

/** Response `POST /auth/mfa/enable`. */
export interface MfaEnableResponse {
  success: boolean;
  message: string;
}

/** Response `POST /auth/mfa/disable`. */
export interface MfaDisableResponse {
  success: boolean;
  message: string;
}

export function toSessionUser(user: BackendUser): SessionUser {
  return {
    id: user.id,
    username: user.username,
    name: user.username,
    role: mapBackendRole(user.roles ?? []),
    isMedicalRole: user.isMedicalRole ?? false,
  };
}

/**
 * Klaim `employeeId` (id tabel `employees` di backend) dari access token JWT
 * yang sedang aktif.
 *
 * Response `POST /auth/login` tidak mengembalikan tautan user -> pekerja,
 * tetapi payload JWT berisi `employeeId` (lihat auth.service backend), sehingga
 * halaman `/my/*` dapat menautkan sesi login ke data pekerja/pasien tanpa
 * endpoint tambahan.
 */
export function getSessionEmployeeId(): string | null {
  const token = getToken();
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  const value = payload?.employeeId;
  return typeof value === "string" && value ? value : null;
}

/**
 * Cari baris pekerja (`Employee` di store) yang dimiliki akun sedang login.
 *
 * Urutan pencocokan (semua frontend-only, tanpa endpoint tambahan):
 *  1. `user.employeeId` (diisi oleh alur login lokal / seed) terhadap
 *     `employeeId` (NIP) maupun `id` (patient id) baris pekerja.
 *  2. Klaim `employeeId` dari JWT — terhadap dua field yang sama.
 *  3. Fallback terakhir: username/nama akun == NIP/nama pekerja
 *     (dinormalisasi huruf kecil tanpa pemisah), karena daftar pasien dari
 *     backend tidak mengekspos `employee.id`.
 *
 * Mengembalikan `undefined` bila akun memang belum tertaut ke pekerja —
 * halaman lalu menampilkan empty state "belum tertaut", bukan data palsu.
 */
export function findMyEmployee<
  T extends { id: string; employeeId: string; fullName: string },
>(
  employees: T[],
  user?: { employeeId?: string; username?: string; name?: string } | null
): T | undefined {
  if (!user) return undefined;

  const keys = [user.employeeId, getSessionEmployeeId()].filter(
    (k): k is string => typeof k === "string" && k.length > 0
  );
  for (const key of keys) {
    const hit = employees.find((e) => e.id === key || e.employeeId === key);
    if (hit) return hit;
  }

  const normalize = (v?: string) => (v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const candidates = [normalize(user.username), normalize(user.name)].filter(Boolean);
  if (candidates.length === 0) return undefined;
  return employees.find((e) => {
    const empNo = normalize(e.employeeId);
    const fullName = normalize(e.fullName);
    return candidates.some((c) => c === empNo || c === fullName);
  });
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>("/auth/login", { username, password });
    if (res.accessToken) {
      setToken(res.accessToken);
      if (res.refreshToken) setRefreshToken(res.refreshToken);
    }
    return res;
  },

  async verifyMfa(userId: string, totpCode: string): Promise<MfaVerifyResponse> {
    const res = await apiClient.post<MfaVerifyResponse>("/auth/mfa/verify", { userId, totpCode });
    if (res.accessToken) {
      setToken(res.accessToken);
      if (res.refreshToken) setRefreshToken(res.refreshToken);
    }
    return res;
  },

  /**
   * Modul 1 — `POST /auth/mfa/setup`.
   *
   * Menghasilkan secret base32 + URI `otpauth://` (RFC 6238) untuk didaftarkan
   * ke Google/Microsoft Authenticator. Wajib Bearer token; dipakai pada alur
   * `mfaSetupRequired` — lihat catatan di `LoginResponse.mfaSetupRequired`.
   */
  async setupMfa(): Promise<MfaSetupResponse> {
    return apiClient.post<MfaSetupResponse>("/auth/mfa/setup", {});
  },

  /**
   * Modul 1 — `POST /auth/mfa/enable`.
   *
   * Memverifikasi kode TOTP pertama dan mengaktifkan MFA pada akun. Wajib
   * Bearer token (token sementara dari login tahap pertama belum cukup; alur
   * demo memakai bypass OTP `123456` yang dikontrol kebijakan backend).
   */
  async enableMfa(secret: string, totpCode: string): Promise<MfaEnableResponse> {
    return apiClient.post<MfaEnableResponse>("/auth/mfa/enable", { secret, totpCode });
  },

  /**
   * Modul 1 — `POST /auth/mfa/disable`.
   *
   * Menonaktifkan MFA akun (mfa_method → NONE, secret dihapus). Wajib
   * Bearer token; password bersifat opsional sesuai `DisableMfaDto`.
   */
  async disableMfa(password?: string): Promise<MfaDisableResponse> {
    return apiClient.post<MfaDisableResponse>("/auth/mfa/disable", password ? { password } : {});
  },

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    return apiClient.post<{ accessToken: string }>("/auth/refresh", { refreshToken });
  },

  logout() {
    clearToken();
  },
};
