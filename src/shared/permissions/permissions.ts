import type { DemoRole } from "@/features/people/api/people.types";

export interface PermissionSet {
  canCreatePerson: boolean;
  canEditAdministrativeData: boolean;
  canUploadDocument: boolean;
  canResendConsent: boolean;
  canViewActivity: boolean;
  canViewClinicalData: boolean;
}

export const PERMISSIONS: Record<DemoRole, PermissionSet> = {
  ADMIN_CLINIC: {
    canCreatePerson: true,
    canEditAdministrativeData: true,
    canUploadDocument: true,
    canResendConsent: true,
    canViewActivity: true,
    canViewClinicalData: false,
  },
  HR_PIC: {
    canCreatePerson: true,
    canEditAdministrativeData: false,
    canUploadDocument: true,
    canResendConsent: true,
    canViewActivity: true,
    canViewClinicalData: false,
  },
  SYSTEM_ADMIN: {
    canCreatePerson: false,
    canEditAdministrativeData: false,
    canUploadDocument: false,
    canResendConsent: false,
    canViewActivity: true,
    canViewClinicalData: false,
  },
  PUBLIC_WORKER: {
    canCreatePerson: false,
    canEditAdministrativeData: false,
    canUploadDocument: false,
    canResendConsent: false,
    canViewActivity: false,
    canViewClinicalData: false,
  },
};

export function getPermissions(role: DemoRole): PermissionSet {
  return PERMISSIONS[role];
}

export function hasPermission(role: DemoRole, permission: keyof PermissionSet): boolean {
  return PERMISSIONS[role][permission];
}
