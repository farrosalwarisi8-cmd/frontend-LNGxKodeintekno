import { canAll, type Permission } from "@/lib/rbac";
import type { Role } from "@/lib/types";

/**
 * Registry aksi UI → permission.
 *
 * Halaman TIDAK boleh menulis `role === "dokter-oh"` untuk menampilkan tombol.
 * Semua keputusan tampil/sembunyi tombol lewat `canPerform()` / `<Can action>`.
 *
 * Sebuah aksi boleh membutuhkan LEBIH dari satu permission (lihat
 * `ActionRequirement`). Contoh: `visits.edit-soap` butuh `edit-visit`
 * (mengubah data kunjungan) DAN `view-clinical-notes` (isi SOAP adalah catatan
 * klinis). Admin Klinik punya `edit-visit` untuk keperluan administratif/
 * antrean, tetapi TIDAK boleh menyentuh SOAP karena tidak punya
 * `view-clinical-notes`.
 */
export type ActionRequirement = Permission | readonly Permission[];

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
  // SOAP = catatan klinis → butuh izin klinis, bukan hanya izin edit kunjungan.
  "visits.edit-soap": ["edit-visit", "view-clinical-notes"],
  // Memanggil tiket antrean ke konter (POST /clinic/queues/call).
  "visits.call-ticket": "edit-visit",
  // Kolom klinis pada daftar kunjungan/antrean (keluhan utama, diagnosis).
  "visits.view-clinical": "view-clinical-notes",
  "pharmacy.receive-stock": "manage-stock",
  "pharmacy.dispense": "dispense-medicine",
  "certificates.issue": "issue-certificate",
  "certificates.revoke": "issue-certificate",
  // Permintaan tanda tangan PSrE (POST /signatures/request) adalah bagian alur
  // penerbitan sertifikat — memakai ulang permission `issue-certificate`.
  "documents.request-signature": "issue-certificate",
  "reports.view": "view-reports",
  "reports.export": "export-reports",
  // Kartu pada halaman laporan memakai izin sesuai sumber datanya, supaya role
  // non-klinis (mis. HR/System Administrator) tidak melihat detail medis.
  "reports.view-mcu": "view-mcu",
  "reports.view-visits": "view-visits",
  "reports.view-diagnosis": "view-diagnosis",
  "reports.view-pharmacy": "manage-stock",
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
  // Menjalankan mesin eskalasi reminder MCU (POST /admin/escalation/run-check).
  "escalation.run": "manage-hse",
  // --- A3: Review MCU, FTW, restriksi, resume/sertifikat, D&A -------------
  // Penetapan FTW (POST /mcu/cycles/:id/ftw-assessment) — Dokter OH saja.
  "mcu.set-ftw": "set-ftw",
  // Tambah/ubah/akhiri restriksi kerja — Dokter OH saja.
  "mcu.manage-restriction": "manage-restriction",
  // Melihat resume MCU (isi klinis) — tidak untuk HR/manajemen.
  "mcu.view-resume": "view-resume",
  // Melihat pratinjau sertifikat (belum sah) — bukan dokumen final.
  "mcu.view-certificate-preview": "view-certificate-preview",
  // Modul D&A: akses terbatas (Dokter OH; HSE hanya bila ditunjuk).
  "dna.view": "view-dna",
  // Pencatatan kejadian chain of custody (append-only).
  "dna.record-custody": "record-dna-custody",
  // Pencatatan hasil screening & confirmation test.
  "dna.record-confirmation": "record-dna-confirmation",
} as const satisfies Record<string, ActionRequirement>;

export type ActionId = keyof typeof ACTION_PERMISSIONS;

/** Seluruh permission yang harus dimiliki role agar sebuah aksi boleh dijalankan. */
export function permissionsForAction(action: ActionId): readonly Permission[] {
  const requirement = ACTION_PERMISSIONS[action] as ActionRequirement;
  return Array.isArray(requirement) ? requirement : [requirement as Permission];
}

/**
 * Permission utama sebuah aksi (yang pertama pada daftar requirement).
 * Dipertahankan agar pemakaian single-permission lama tetap valid.
 */
export function permissionForAction(action: ActionId): Permission {
  return permissionsForAction(action)[0];
}

export function canPerform(role: Role | null | undefined, action: ActionId): boolean {
  if (!role) return false;
  return canAll(role, permissionsForAction(action));
}

export function isActionId(value: string): value is ActionId {
  return value in ACTION_PERMISSIONS;
}

/** Daftar seluruh aksi (dipakai dokumentasi & test konsistensi). */
export function allActionIds(): readonly ActionId[] {
  return Object.keys(ACTION_PERMISSIONS) as ActionId[];
}
