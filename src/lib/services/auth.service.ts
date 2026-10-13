import { apiClient, setToken, clearToken, setRefreshToken } from "@/lib/api-client";

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

export function toSessionUser(user: BackendUser): SessionUser {
  return {
    id: user.id,
    username: user.username,
    name: user.username,
    role: mapBackendRole(user.roles ?? []),
    isMedicalRole: user.isMedicalRole ?? false,
  };
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

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    return apiClient.post<{ accessToken: string }>("/auth/refresh", { refreshToken });
  },

  logout() {
    clearToken();
  },
};
