import { can, type Permission } from "@/lib/rbac";
import type { Role } from "@/lib/types";

/**
 * Registry aksi UI → permission.
 *
 * Halaman TIDAK boleh menulis `role === "dokter-oh"` untuk menampilkan tombol.
 * Semua keputusan tampil/sembunyi tombol lewat `canPerform()` / `<Can action>`.
 */
export const ACTION_PERMISSIONS = {
  "people.create": "manage-employees",
  "people.edit": "manage-employees",
  "people.upload-document": "upload-document",
  "people.send-consent": "manage-employees",
  "mcu.create": "create-mcu",
  "mcu.review": "review-mcu",
  "mcu.approve": "approve-mcu",
  // Acknowledgement restriksi kerja HSE (POST /mcu/restrictions/:id/acknowledge).
  "mcu.acknowledge-restriction": "acknowledge-restriction",
  "visits.create": "register-patient",
  "visits.edit-soap": "edit-visit",
  // Memanggil tiket antrean ke konter (POST /clinic/queues/call).
  "visits.call-ticket": "edit-visit",
  "pharmacy.receive-stock": "manage-stock",
  "pharmacy.dispense": "dispense-medicine",
  "certificates.issue": "issue-certificate",
  "certificates.revoke": "issue-certificate",
  // Permintaan tanda tangan PSrE (POST /signatures/request) adalah bagian alur
  // penerbitan sertifikat — memakai ulang permission `issue-certificate`.
  "documents.request-signature": "issue-certificate",
  "reports.view": "view-reports",
  "reports.export": "export-reports",
  "users.manage": "manage-users",
  "master-data.edit": "manage-master-data",
  "audit.view": "view-audit-logs",
  "waiver.decide": "manage-hse",
  // D&A forensik: backend membatasi modul da-test ke DOCTOR_OH, LAB_ANALYST,
  // SYSTEM_ADMIN. Permission `manage-da` dipetakan ke ketiga role itu saja
  // supaya tombol tidak pernah tampil untuk role yang pasti ditolak (403).
  "da.manage": "manage-da",
  "emergency.create": "view-emergency",
  "input-lab-result": "input-lab-result",
} as const satisfies Record<string, Permission>;

export type ActionId = keyof typeof ACTION_PERMISSIONS;

export function permissionForAction(action: ActionId): Permission {
  return ACTION_PERMISSIONS[action];
}

export function canPerform(role: Role | null | undefined, action: ActionId): boolean {
  if (!role) return false;
  return can(role, ACTION_PERMISSIONS[action]);
}

export function isActionId(value: string): value is ActionId {
  return value in ACTION_PERMISSIONS;
}
