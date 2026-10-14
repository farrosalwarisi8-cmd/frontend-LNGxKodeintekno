import { apiClient } from "@/lib/api-client";

/**
 * Modul 11 — Master Data (Organization / Department / Site).
 * Endpoint backend (Domain 12):
 *   GET/POST/PATCH /api/v1/master-data/organizations[/:id]
 *   GET/POST/PATCH /api/v1/master-data/departments[/:id]
 *   GET/POST/PATCH /api/v1/master-data/sites[/:id]
 *   PATCH /api/v1/master-data/{organizations|departments|sites}/:id/status
 */

export interface BackendOrganization {
  id: string;
  code: string;
  name: string;
  timezone?: string;
  status: "ACTIVE" | "INACTIVE";
}

export interface BackendDepartment {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  unit_type?: string;
  active: boolean;
  organization?: { id?: string; code?: string; name?: string };
}

export interface BackendSite {
  id: string;
  org_unit_id: string;
  code: string;
  name: string;
  site_type?: string;
  address?: string | null;
  active: boolean;
  org_unit?: {
    id?: string;
    code?: string;
    name?: string;
    organization?: { id?: string; code?: string; name?: string };
  };
}

/**
 * Fase 4 — guard kode duplikat di lapisan client.
 *
 * Backend memberlakukan unique constraint (409); pemeriksaan awal ini memberi
 * umpan balik instan tanpa mengeluarkan request DAN TIDAK menggantikan 409
 * dari backend (tetap ditangani sebagai kebenaran terakhir).
 *
 * @returns kode yang bentrok (sudah di-trim) atau null bila unik/kosong.
 */
export function findDuplicateCode(
  rows: Array<{ id: string; code: string }>,
  code: string,
  excludeId?: string
): string | null {
  const normalized = code.trim().toLowerCase();
  if (!normalized) return null;
  const clash = rows.find(
    (r) => r.id !== excludeId && (r.code ?? "").trim().toLowerCase() === normalized
  );
  return clash ? clash.code.trim() : null;
}

export const masterDataService = {
  async listOrganizations(search?: string): Promise<BackendOrganization[]> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    return apiClient.get<BackendOrganization[]>(`/master-data/organizations${qs}`);
  },
  async createOrganization(input: { code: string; name: string; timezone?: string }) {
    return apiClient.post<BackendOrganization>("/master-data/organizations", input);
  },
  async updateOrganization(id: string, input: { name?: string; timezone?: string }) {
    return apiClient.patch<BackendOrganization>(`/master-data/organizations/${id}`, input);
  },
  async setOrganizationStatus(id: string, status: "ACTIVE" | "INACTIVE", force?: boolean) {
    return apiClient.patch<BackendOrganization>(`/master-data/organizations/${id}/status`, {
      status,
      force,
    });
  },

  async listDepartments(organizationId?: string, search?: string): Promise<BackendDepartment[]> {
    const query = new URLSearchParams();
    if (organizationId) query.set("organizationId", organizationId);
    if (search) query.set("search", search);
    const qs = query.toString();
    return apiClient.get<BackendDepartment[]>(`/master-data/departments${qs ? `?${qs}` : ""}`);
  },
  async createDepartment(input: {
    organizationId: string;
    code: string;
    name: string;
    unitType?: string;
  }) {
    return apiClient.post<BackendDepartment>("/master-data/departments", input);
  },
  async updateDepartment(id: string, input: { name?: string; unitType?: string }) {
    return apiClient.patch<BackendDepartment>(`/master-data/departments/${id}`, input);
  },
  async setDepartmentStatus(id: string, active: boolean) {
    return apiClient.patch<BackendDepartment>(`/master-data/departments/${id}/status`, { active });
  },

  async listSites(params: { active?: boolean; orgUnitId?: string; search?: string } = {}) {
    const query = new URLSearchParams();
    if (params.active !== undefined) query.set("active", String(params.active));
    if (params.orgUnitId) query.set("orgUnitId", params.orgUnitId);
    if (params.search) query.set("search", params.search);
    const qs = query.toString();
    return apiClient.get<BackendSite[]>(`/master-data/sites${qs ? `?${qs}` : ""}`);
  },
  async createSite(input: {
    orgUnitId: string;
    code: string;
    name: string;
    siteType?: string;
    address?: string;
  }) {
    return apiClient.post<BackendSite>("/master-data/sites", input);
  },
  async updateSite(id: string, input: { name?: string; siteType?: string; address?: string }) {
    return apiClient.patch<BackendSite>(`/master-data/sites/${id}`, input);
  },
  async setSiteStatus(id: string, active: boolean, force?: boolean) {
    return apiClient.patch<BackendSite>(`/master-data/sites/${id}/status`, { active, force });
  },
};
