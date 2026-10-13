import type { IdentifierType } from "@/features/people/api/people.types";

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function validateFullName(name: string): ValidationResult {
  if (!name.trim()) return { valid: false, message: "Nama lengkap wajib diisi." };
  if (name.trim().length < 2) return { valid: false, message: "Nama minimal 2 karakter." };
  if (name.trim().length > 100) return { valid: false, message: "Nama maksimal 100 karakter." };
  return { valid: true };
}

export function validateIdentifier(value: string, type: IdentifierType): ValidationResult {
  if (!value.trim()) return { valid: false, message: "Nomor identitas wajib diisi." };
  if (type === "NIK") {
    if (!/^\d{16}$/.test(value)) return { valid: false, message: "NIK harus 16 digit angka." };
  } else if (type === "PASSPORT") {
    if (!/^[A-Z0-9]{6,12}$/i.test(value)) return { valid: false, message: "Paspor harus 6–12 karakter alfanumerik." };
  } else if (type === "KITAS") {
    if (!/^[A-Z0-9]{8,14}$/i.test(value)) return { valid: false, message: "KITAS harus 8–14 karakter alfanumerik." };
  }
  return { valid: true };
}

export function validateBirthDate(value: string): ValidationResult {
  if (!value) return { valid: false, message: "Tanggal lahir wajib diisi." };
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return { valid: false, message: "Format tanggal tidak valid." };
  if (d.getTime() > Date.now()) return { valid: false, message: "Tanggal lahir tidak boleh di masa depan." };
  return { valid: true };
}

export function validateSex(value: string): ValidationResult {
  if (!value) return { valid: false, message: "Jenis kelamin wajib dipilih." };
  if (!["MALE", "FEMALE"].includes(value)) return { valid: false, message: "Pilih jenis kelamin yang valid." };
  return { valid: true };
}

export function validateEmployeeNo(value: string): ValidationResult {
  if (!value.trim()) return { valid: false, message: "Employee ID wajib diisi." };
  return { valid: true };
}

export function validateEmail(value: string): ValidationResult {
  if (!value.trim()) return { valid: false, message: "Email wajib diisi untuk pengiriman consent." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return { valid: false, message: "Masukkan alamat email yang valid, contoh: nama@perusahaan.com." };
  }
  return { valid: true };
}

export function validatePhone(value: string): ValidationResult {
  if (!value.trim()) return { valid: true };
  if (!/^\+?[\d\s-]{8,15}$/.test(value)) {
    return { valid: false, message: "Format nomor telepon tidak valid." };
  }
  return { valid: true };
}

export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (!value.trim()) return { valid: false, message: `${fieldName} wajib diisi.` };
  return { valid: true };
}

export function validateConsentType(value: string): ValidationResult {
  if (!value.trim()) return { valid: false, message: "Tipe consent wajib dipilih." };
  return { valid: true };
}

export function validateConsentVersion(value: string): ValidationResult {
  if (!value.trim()) return { valid: false, message: "Versi consent wajib diisi." };
  return { valid: true };
}
