import { apiClient, setToken, clearToken } from "@/lib/api-client";

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    name: string;
    role: string;
    isMedicalRole: boolean;
  };
  mfaRequired?: boolean;
}

export interface MfaVerifyResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    name: string;
    role: string;
    isMedicalRole: boolean;
  };
}

export const authService = {
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await apiClient.post<LoginResponse>("/auth/login", { username, password });
    if (res.accessToken) {
      setToken(res.accessToken);
    }
    return res;
  },

  async verifyMfa(userId: string, totpCode: string): Promise<MfaVerifyResponse> {
    const res = await apiClient.post<MfaVerifyResponse>("/auth/mfa/verify", { userId, totpCode });
    if (res.accessToken) {
      setToken(res.accessToken);
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
