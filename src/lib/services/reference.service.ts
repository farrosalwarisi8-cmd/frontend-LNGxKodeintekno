import { apiClient, getToken } from "@/lib/api-client";

/**
 * Referensi cakupan organisasi (Organisasi / Unit Kerja / Site).
 *
 * Backend tidak menyediakan endpoint master data organisasi, tetapi ID
 * organisasi & site tersedia dari:
 *   1. JWT (`organizationId`) saat login
 *   2. GET /api/v1/iam/users  -> user_roles[].site (id + code) & org_unit_id
 *   3. GET /api/v1/patients/:id/profile -> employee.organization / org_unit / site
 *
 * Cakupan dibutuhkan oleh POST /api/v1/patients (FK organization_id, org_unit_id,
 * site_id wajib valid) dan `siteCode` untuk pembentukan MRN.
 */
export interface OrgScope {
  organizationId: string;
  orgUnitId: string;
  siteId: string;
  siteCode: string;
  orgName?: string;
  orgUnitName?: string;
  siteName?: string;
}

const CACHE_KEY = "kodein_org_scope";
let cached: OrgScope | null | undefined;

function readJwtOrganizationId(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return (payload.organizationId as string) ?? null;
  } catch {
    return null;
  }
}

function remember(scope: OrgScope) {
  cached = scope;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(scope));
  } catch {
    /* storage tidak tersedia (SSR) */
  }
}

function recall(): OrgScope | null {
  if (cached !== undefined) return cached;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    cached = raw ? (JSON.parse(raw) as OrgScope) : null;
  } catch {
    cached = null;
  }
  return cached;
}

interface UserWithRoles {
  id: string;
  user_roles?: Array<{
    org_unit_id?: string;
    site_id?: string;
    role?: { code?: string };
    site?: { id?: string; code?: string; name?: string };
  }>;
}

interface PatientProfileLike {
  employee?: {
    organization?: { id?: string; name?: string };
    org_unit?: { id?: string; name?: string };
    site?: { id?: string; code?: string; name?: string };
  };
}

export async function resolveScope(force = false): Promise<OrgScope> {
  if (!force) {
    const cachedScope = recall();
    if (cachedScope) return cachedScope;
  }

  const organizationId = readJwtOrganizationId();

  // 1. Dari data user yang sedang login (butuh role SYSTEM_ADMIN / HR_ADMIN)
  try {
    const users = await apiClient.getPaged<UserWithRoles[]>("/iam/users?page=1&limit=1");
    const roles = users.data?.[0]?.user_roles ?? [];
    const withSite = roles.find((r) => r.site?.id) ?? roles[0];
    const site = withSite?.site;
    if (site?.id && withSite?.org_unit_id && organizationId) {
      const scope: OrgScope = {
        organizationId,
        orgUnitId: withSite.org_unit_id,
        siteId: site.id,
        siteCode: site.code ?? "SITE-PLANT-01",
        siteName: site.name,
        orgUnitName: withSite.org_unit_id,
      };
      remember(scope);
      return scope;
    }
  } catch {
    /* bukan admin -> lanjut ke fallback */
  }

  // 2. Dari profil pasien pertama yang terdaftar
  try {
    const list = await apiClient.getPaged<Array<{ id: string }>>("/patients?page=1&limit=1");
    const first = list.data?.[0];
    if (first) {
      const profile = await apiClient.get<PatientProfileLike>(
        `/patients/${first.id}/profile`
      );
      const emp = profile.employee;
      if (emp?.site?.id && emp.org_unit?.id && emp.organization?.id) {
        const scope: OrgScope = {
          organizationId: emp.organization.id,
          orgUnitId: emp.org_unit.id,
          siteId: emp.site.id,
          siteCode: emp.site.code ?? "SITE-PLANT-01",
          orgName: emp.organization.name,
          orgUnitName: emp.org_unit.name,
          siteName: emp.site.name,
        };
        remember(scope);
        return scope;
      }
    }
  } catch {
    /* belum ada pasien -> lanjut */
  }

  throw new Error(
    "Cakupan organisasi/site tidak ditemukan untuk akun ini. Login dengan akun admin terlebih dahulu."
  );
}

export function clearScope() {
  cached = undefined;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
