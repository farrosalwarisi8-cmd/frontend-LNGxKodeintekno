/**
 * Fingerprint perangkat untuk sinkronisasi offline (Domain 11).
 *
 * Backend menerima `deviceFingerprintHash` (SHA-256 hex) pada
 * `POST /sync/register-device`. Nilainya harus stabil per perangkat+browser
 * agar record yang di-push nanti dapat dikaitkan ke device yang sama, tetapi
 * TIDAK boleh memuat identitas pengguna (hanya atribut perangkat).
 *
 * Disimpan di localStorage setelah pertama kali dibuat; regenerasi hanya bila
 * storage kosong/rusak. Di lingkungan tanpa `crypto.subtle` (HTTP non-localhost
 * atau browser lama) dipakai fallback deterministik berbasis atribut perangkat.
 */

const STORAGE_KEY = "kodein-klinik-device-fingerprint";

function collectAttributes(): string {
  const parts = [
    navigator.userAgent,
    navigator.language,
    `${screen.width}x${screen.height}`,
    `${screen.colorDepth}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
  ];
  return parts.join("|");
}

/** SHA-256 hex bila tersedia; jika tidak, hash FNV-1a 64-bit deterministik. */
async function hashAttributes(raw: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const bytes = new TextEncoder().encode(raw);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // FNV-1a 64-bit (dua param 32-bit untuk memperpanjang keluaran).
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < raw.length; i++) {
    h1 ^= raw.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 = (h2 + raw.charCodeAt(i) * (i + 1)) >>> 0;
  }
  return `${h1.toString(16).padStart(8, "0")}${h2.toString(16).padStart(8, "0")}`.repeat(4);
}

/**
 * Fingerprint stabil untuk perangkat ini (hex).
 * Aman dipanggil berulang — hasilnya konsisten dan tersimpan lokal.
 */
export async function deviceFingerprintHash(): Promise<string> {
  if (typeof localStorage !== "undefined") {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached && /^[a-f0-9]{32,}$/.test(cached)) return cached;
  }
  const hash = await hashAttributes(collectAttributes());
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, hash);
    } catch {
      // Storage penuh/diblokir — fingerprint tetap dikembalikan untuk sesi ini.
    }
  }
  return hash;
}

/** Hapus fingerprint tersimpan (dipakai test / reset perangkat). */
export function clearDeviceFingerprint(): void {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY);
  }
}
