#!/usr/bin/env node
/**
 * Generator ROLE_MAPPING.md — SATU-SATUNYA cara menghasilkan dokumen tersebut.
 *
 * Sumber kebenaran (semua dari kode):
 *   - lib/rbac.ts                      → daftar role, semua permission, matriks per role
 *   - src/lib/services/auth.service.ts → peta role frontend ↔ kode role backend
 *   - src/lib/demo-role-map.ts         → peta demo role → role session
 *
 * Pemakaian:
 *   node scripts/generate-role-mapping.mjs           # tulis ROLE_MAPPING.md
 *   node scripts/generate-role-mapping.mjs --check   # exit 1 bila file sudah usang
 *
 * Jangan edit ROLE_MAPPING.md secara manual — hasilnya akan ditimpa.
 * Catatan: `lib/rbac.ts` diimpor langsung (Node ≥ 22.6 strip-types); type-only
 * import di dalamnya di-erase sehingga path alias @/ tidak ikut di-resolve.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const { ROLE_PERMISSIONS, allPermissions } = await import(
  pathToFileURL(join(ROOT, "lib", "rbac.ts")).href
);
const { DEMO_ROLE_TO_ROLE, DEMO_ROLE_LABELS } = await import(
  pathToFileURL(join(ROOT, "src", "lib", "demo-role-map.ts")).href
);

/**
 * Parser toleran untuk peta string→string sederhana di auth.service.ts
 * (BACKEND_ROLE_MAP / FRONTEND_ROLE_TO_BACKEND). File itu mengimpor apiClient
 * sehingga tidak bisa diimpor runtime di skrip ini — ekstraksinya di sini,
 * dengan gagal keras bila blok tidak ditemukan.
 */
function extractStringMap(filePath, constName) {
  const source = readFileSync(filePath, "utf8");
  const start = source.indexOf(`export const ${constName}`);
  if (start === -1) throw new Error(`${constName} tidak ditemukan di ${filePath}`);
  const open = source.indexOf("{", start);
  const close = source.indexOf("}", open);
  if (open === -1 || close === -1) throw new Error(`Blok ${constName} tidak valid`);
  const entries = [
    ...source
      .slice(open + 1, close)
      .matchAll(/(?:"([^"]+)"|\b([A-Za-z_][A-Za-z0-9_-]*)\b)\s*:\s*"([^"]+)"/g),
  ];
  if (entries.length === 0) throw new Error(`${constName} kosong/tidak terbaca`);
  return Object.fromEntries(entries.map(([, q, u, v]) => [q ?? u, v]));
}

const authServicePath = join(ROOT, "src", "lib", "services", "auth.service.ts");
const BACKEND_ROLE_MAP = extractStringMap(authServicePath, "BACKEND_ROLE_MAP");
const FRONTEND_ROLE_TO_BACKEND = extractStringMap(
  authServicePath,
  "FRONTEND_ROLE_TO_BACKEND"
);

/**
 * Data scope per kode role backend — DOKUMENTASI SAJA (diaktifkan oleh backend
 * lewat data-scope guard, bukan frontend). Nilai dipertahankan dari dokumen
 * Tahap 4; ubah di sini bila kontrak backend berubah.
 */
const BACKEND_SCOPE = {
  SYSTEM_ADMIN: "GLOBAL",
  DOCTOR_OH: "GLOBAL",
  DOCTOR_CLINIC: "SITE",
  NURSE: "SITE",
  PHARMACIST: "SITE",
  LAB_ANALYST: "SITE",
  RADIOLOGIST: "SITE",
  HR_ADMIN: "ORG",
  HSE_OFFICER: "SITE",
  HSE_MANAGER: "GLOBAL",
  MANAGEMENT: "GLOBAL",
};

const ROLES = Object.keys(ROLE_PERMISSIONS);
const PERMISSIONS = [...allPermissions()];

// --- Validasi silang (gagal keras, jangan hasilkan dokumen salah) ------------
const known = new Set(PERMISSIONS);
for (const role of ROLES) {
  for (const p of ROLE_PERMISSIONS[role]) {
    if (!known.has(p)) throw new Error(`Permission tak dikenal "${p}" pada role "${role}"`);
  }
}
for (const role of Object.values(DEMO_ROLE_TO_ROLE)) {
  if (!ROLES.includes(role)) throw new Error(`Demo role memetakan ke role tak dikenal "${role}"`);
}
for (const [front, back] of Object.entries(FRONTEND_ROLE_TO_BACKEND)) {
  if (!ROLES.includes(front)) throw new Error(`FRONTEND_ROLE_TO_BACKEND: role tak dikenal "${front}"`);
  if (!BACKEND_SCOPE[back]) throw new Error(`FRONTEND_ROLE_TO_BACKEND: kode backend tak dikenal "${back}"`);
}

const cell = (role, perm) => (ROLE_PERMISSIONS[role].includes(perm) ? "✓" : "—");

function table(headers, rows) {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `|${headers.map(() => "---").join("|")}|`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`);
  return [head, sep, ...body].join("\n");
}

const lines = [];

lines.push("# Role Mapping & Permission Matrix");
lines.push("");
lines.push(
  "> **Dokumen ini dihasilkan otomatis dari kode.** Jangan edit manual. Jalankan:"
);
lines.push("> `node scripts/generate-role-mapping.mjs` lalu commit hasilnya.");
lines.push("> (mode verifikasi CI-lokal: tambah `--check` — exit 1 bila file usang)");
lines.push("");
lines.push("Sumber: `lib/rbac.ts` (registry permission), `src/lib/services/auth.service.ts`");
lines.push("(peta role backend), `src/lib/demo-role-map.ts` (mode demo).");
lines.push("");
lines.push("## Frontend Role → Backend Role Code");
lines.push("");
lines.push(
  table(
    ["Frontend Role", "Backend Role Code", "Data Scope (server-side)", "Notes"],
    ROLES.map((role) => {
      const code = FRONTEND_ROLE_TO_BACKEND[role] ?? "—";
      const scope = code === "—" ? "—" : (BACKEND_SCOPE[code] ?? "—");
      let note = "Role backend penuh";
      if (code === "—") {
        note =
          role === "pekerja"
            ? "Tanpa backend JWT; akses via token publik (consent/waiver)"
            : "Role UI saja; saat login dipetakan ke kode backend oleh backend";
      }
      return [`\`${role}\``, code === "—" ? "—" : `\`${code}\`` , scope, note];
    })
  )
);
lines.push("");
lines.push("## Backend Role → Frontend Role");
lines.push("");
lines.push(
  table(
    ["Backend Role Code", "Frontend Role", "Data Scope (server-side)"],
    Object.entries(BACKEND_ROLE_MAP).map(([back, front]) => [
      `\`${back}\``,
      `\`${front}\``,
      BACKEND_SCOPE[back] ?? "—",
    ])
  )
);
lines.push("");
lines.push("## Permission Matrix");
lines.push("");
lines.push("`✓` = role memiliki permission (registry `ROLE_PERMISSIONS` di `lib/rbac.ts`).");
lines.push("");
lines.push(
  table(
    ["Permission", ...ROLES],
    PERMISSIONS.map((perm) => [`\`${perm}\``, ...ROLES.map((r) => cell(r, perm))])
  )
);
lines.push("");
lines.push("## Demo Role Mapping");
lines.push("");
lines.push(
  table(
    ["Demo Role", "Label", "Maps To (role session)"],
    Object.entries(DEMO_ROLE_TO_ROLE).map(([demo, role]) => [
      `\`${demo}\``,
      DEMO_ROLE_LABELS[demo] ?? "—",
      `\`${role}\``,
    ])
  )
);
lines.push("");
lines.push("Demo role adalah simulasi UI. Backend selalu melakukan otorisasi final.");
lines.push("");
lines.push("## Worker Portal Policy");
lines.push("");
lines.push("- **No backend JWT**: pekerja tidak punya akun backend.");
lines.push(
  "- **Public token access**: pekerja memakai token consent/waiver untuk alur publik."
);
lines.push(
  "- **No clinical access**: pekerja tidak melihat data pekerja lain atau catatan klinis."
);
lines.push("");
lines.push("## Catatan keamanan");
lines.push("");
lines.push(
  "1. Permission frontend hanya mengatur tampilan/UX; **otorisasi sebenarnya di backend**."
);
lines.push(
  "2. Role `lab` (analis lab & radiolog) sengaja **tanpa** `view-mcu` — mengelola data"
);
lines.push("   penunjang (order/hasil lab & radiologi) saja, sesuai proposal Fase A1.");
lines.push(
  "3. Role tanpa padanan kode backend (`admin-klinik`, `pekerja`) dikembalikan `null`"
);
lines.push("   oleh `backendRoleCode()` sehingga UI menolak, bukan mengirim kode palsu.");
lines.push("");

const content = lines.join("\n");

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(join(ROOT, "ROLE_MAPPING.md"), "utf8");
  } catch {
    console.error("ROLE_MAPPING.md belum ada — jalankan skrip tanpa --check.");
    process.exit(1);
  }
  if (current !== content) {
    console.error(
      "ROLE_MAPPING.md sudah usang. Jalankan: node scripts/generate-role-mapping.mjs"
    );
    process.exit(1);
  }
  console.log("ROLE_MAPPING.md sudah sesuai dengan kode.");
} else {
  writeFileSync(join(ROOT, "ROLE_MAPPING.md"), content, "utf8");
  console.log("ROLE_MAPPING.md ditulis ulang dari kode.");
}
