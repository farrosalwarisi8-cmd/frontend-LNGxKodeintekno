/**
 * Generator ROLE_MAPPING.md dari peta permission DI KODE.
 *
 * Jalankan:  node scripts/generate-role-matrix.mjs
 *
 * File hasil TIDAK boleh diedit manual. Bila koding berubah, jalankan ulang
 * skrip ini. Test `src/lib/__tests__/role-mapping-doc.test.ts` membandingkan
 * isi file dengan hasil generator dan GAGAL bila keduanya berbeda.
 *
 * Catatan: skrip ini membaca file sumber TypeScript secara statis (tanpa
 * evaluator TypeScript) supaya dapat dijalankan dengan Node polos. Akurasi
 * parser dijaga oleh test yang membandingkan hasil parser dengan modul asli.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_FILE = path.join(ROOT, "ROLE_MAPPING.md");

function readSource(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

/**
 * Mengambil literal nilai dari `export const <name> = <literal>`.
 * Mengembalikan objek/array yang sudah dievaluasi.
 */
export function extractExportedConst(relativePath, name) {
  const source = readSource(relativePath);
  const declaration = `export const ${name}`;
  const declIndex = source.indexOf(declaration);
  if (declIndex === -1) {
    throw new Error(`Tidak menemukan "${declaration}" di ${relativePath}`);
  }
  const equalsIndex = source.indexOf("=", declIndex + declaration.length);
  if (equalsIndex === -1) {
    throw new Error(`Tidak menemukan '=' untuk "${name}" di ${relativePath}`);
  }

  const valueStart = source.slice(equalsIndex + 1).search(/[[{]/);
  if (valueStart === -1) {
    throw new Error(`Nilai "${name}" di ${relativePath} bukan object/array literal`);
  }
  const start = equalsIndex + 1 + valueStart;
  const open = source[start];
  const close = open === "{" ? "}" : "]";

  let depth = 0;
  let end = -1;
  let inString = null;
  let inRegex = false;
  let previousSignificant = "";

  for (let i = start; i < source.length; i++) {
    const char = source[i];

    if (inString) {
      if (char === "\\") {
        i += 1;
        continue;
      }
      if (char === inString) inString = null;
      continue;
    }

    if (inRegex) {
      if (char === "\\") {
        i += 1;
        continue;
      }
      if (char === "/") inRegex = false;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      inString = char;
      continue;
    }
    // Regex literal hanya terdeteksi setelah karakter yang membolehkan ekspresi.
    if (char === "/" && !/[A-Za-z0-9_$)\]]/.test(previousSignificant)) {
      inRegex = true;
      continue;
    }
    // Komentar baris: lompat ke akhir baris.
    if (char === "/" && source[i + 1] === "/") {
      const newline = source.indexOf("\n", i);
      i = newline === -1 ? source.length : newline;
      continue;
    }
    if (char === "/" && source[i + 1] === "*") {
      const endComment = source.indexOf("*/", i);
      i = endComment === -1 ? source.length : endComment + 1;
      continue;
    }

    if (char === open) depth += 1;
    if (char === close) {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
    if (!/\s/.test(char)) previousSignificant = char;
  }

  if (end === -1) {
    throw new Error(`Tidak menemukan akhir literal untuk "${name}" di ${relativePath}`);
  }

  const literal = source.slice(start, end + 1);
  // Literal hanya berisi data statis (string, boolean, array, object, regex).
  return new Function(`"use strict"; return (${literal});`)();
}

/** Sumber kebenaran seluruh registry yang dipakai dokumen. */
export function collectRegistry() {
  const rolePermissions = extractExportedConst("lib/rbac.ts", "ROLE_PERMISSIONS");
  const allPermissions = extractExportedConst("lib/rbac.ts", "ALL_PERMISSIONS");
  const backendRoleMap = extractExportedConst(
    "src/lib/services/auth.service.ts",
    "BACKEND_ROLE_MAP"
  );
  const frontendToBackend = extractExportedConst(
    "src/lib/services/auth.service.ts",
    "FRONTEND_ROLE_TO_BACKEND"
  );
  const demoRoleToRole = extractExportedConst("src/lib/demo-role-map.ts", "DEMO_ROLE_TO_ROLE");
  const demoRoleLabels = extractExportedConst("src/lib/demo-role-map.ts", "DEMO_ROLE_LABELS");
  const navigationItems = extractExportedConst("src/lib/navigation.ts", "NAVIGATION_ITEMS");
  const routePermissions = extractExportedConst(
    "components/route-guard.tsx",
    "ROUTE_PERMISSIONS"
  );

  return {
    rolePermissions,
    allPermissions,
    backendRoleMap,
    frontendToBackend,
    demoRoleToRole,
    demoRoleLabels,
    navigationItems,
    routePermissions,
  };
}

const MARK = "✓";
const BLANK = "—";

function mark(allowed) {
  return allowed ? MARK : BLANK;
}

export function buildRoleMappingMarkdown(registry = collectRegistry()) {
  const {
    rolePermissions,
    allPermissions,
    backendRoleMap,
    frontendToBackend,
    demoRoleToRole,
    demoRoleLabels,
    navigationItems,
    routePermissions,
  } = registry;

  const roles = Object.keys(rolePermissions);
  const permissions = [...allPermissions];
  const lines = [];

  lines.push("# Role Mapping & Permission Matrix");
  lines.push("");
  lines.push(
    "> **Dihasilkan otomatis** oleh `node scripts/generate-role-matrix.mjs` dari kode"
  );
  lines.push(
    "> (`lib/rbac.ts`, `lib/actions.ts`, `src/lib/navigation.ts`, `components/route-guard.tsx`)."
  );
  lines.push(
    "> Jangan diedit manual — ubah kode lalu jalankan ulang skrip. Test"
  );
  lines.push(
    "> `src/lib/__tests__/role-mapping-doc.test.ts` gagal bila file ini tidak sinkron dengan kode."
  );
  lines.push("");
  lines.push(
    "Permission frontend adalah **proteksi UI/UX**. Otorisasi sebenarnya tetap milik backend."
  );
  lines.push("");

  // ---- 1. Frontend role -> backend role code --------------------------
  lines.push("## 1. Frontend Role → Backend Role Code");
  lines.push("");
  lines.push("| Frontend Role | Backend Role Code | Sumber |");
  lines.push("|---|---|---|");
  for (const role of roles) {
    const backend = frontendToBackend[role];
    lines.push(
      `| \`${role}\` | ${backend ? `\`${backend}\`` : "— (tanpa padanan backend)"} | ` +
        "`lib/rbac.ts` (`ROLE_PERMISSIONS`) |"
    );
  }
  lines.push("");

  // ---- 2. Backend role -> frontend role -------------------------------
  lines.push("## 2. Backend Role Code → Frontend Role");
  lines.push("");
  lines.push("| Backend Role Code | Frontend Role |");
  lines.push("|---|---|");
  for (const [backend, frontend] of Object.entries(backendRoleMap)) {
    lines.push(`| \`${backend}\` | \`${frontend}\` |`);
  }
  lines.push("");

  // ---- 3. Matriks permission ------------------------------------------
  lines.push("## 3. Matriks Permission (role × permission)");
  lines.push("");
  lines.push(`| Permission | ${roles.join(" | ")} |`);
  lines.push(`|---|${roles.map(() => "---").join("|")}|`);
  for (const permission of permissions) {
    const cells = roles.map((role) => mark(rolePermissions[role].includes(permission)));
    lines.push(`| \`${permission}\` | ${cells.join(" | ")} |`);
  }
  lines.push("");

  // ---- 4. Akses route per role ----------------------------------------
  lines.push("## 4. Akses Route per Role");
  lines.push("");
  lines.push(
    "Permission route diambil dari `components/route-guard.tsx` (`ROUTE_PERMISSIONS`)."
  );
  lines.push("");
  lines.push(`| Route | Permission | ${roles.join(" | ")} |`);
  lines.push(`|---|---${roles.map(() => "---").join("|")}|`);
  for (const item of navigationItems) {
    const rule = routePermissions.find((r) => r.pattern.test(item.href));
    const permission = rule ? rule.permission : null;
    const cells = roles.map((role) =>
      mark(permission ? rolePermissions[role].includes(permission) : true)
    );
    lines.push(
      `| \`${item.href}\` | ${permission ? `\`${permission}\`` : "— (route publik)"} | ${cells.join(" | ")} |`
    );
  }
  lines.push("");

  // ---- 5. Demo role ---------------------------------------------------
  lines.push("## 5. Demo Role Mapping");
  lines.push("");
  lines.push(
    "Demo role hanyalah simulasi UI. **Bukan** authorization produksi — backend tetap"
  );
  lines.push("memverifikasi setiap request.");
  lines.push("");
  lines.push("| Demo Role | Role Frontend | Label |");
  lines.push("|---|---|---|");
  for (const [demoRole, role] of Object.entries(demoRoleToRole)) {
    lines.push(`| \`${demoRole}\` | \`${role}\` | ${demoRoleLabels[demoRole] ?? "-"} |`);
  }
  lines.push("");

  // ---- 6. Catatan proposta --------------------------------------------
  lines.push("## 6. Catatan aturan proposal");
  lines.push("");
  lines.push(
    "- **System Administrator (`admin`)** — konfigurasi sistem, kelola user & role, audit log"
  );
  lines.push(
    "  (read-only), monitoring. **Tidak punya akses data klinis** (MCU, catatan klinis,"
  );
  lines.push("  diagnosis, farmasi/dispense) maupun data pekerja.");
  lines.push(
    "- **HR/PIC (`hr`)** — data pekerja dan status kepatuhan (MCU/FTW/restriction). Tidak"
  );
  lines.push("  mengelola user & master data, tidak melihat detail medis.");
  lines.push(
    "- **Analis Lab/Radiolog (`lab`)** — hanya data penunjang (input/impor dan verifikasi"
  );
  lines.push("  hasil lab). Tidak punya akses data MCU penuh.");
  lines.push(
    "- **Admin Klinik (`admin-klinik`)** — registrasi, antrean, dan entri berobat luar klinik."
  );
  lines.push(
    "  Kolom klinis (keluhan utama, diagnosis) pada daftar kunjungan disembunyikan di UI."
  );
  lines.push(
    "- **Penguatan sisi server tetap tanggung jawab backend.** Frontend hanya menyembunyikan"
  );
  lines.push("  menu, menampilkan AccessDenied, dan menyembunyikan aksi.");
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function main() {
  const markdown = buildRoleMappingMarkdown();
  fs.writeFileSync(OUT_FILE, markdown, "utf8");
  console.log(`ROLE_MAPPING.md diperbarui (${OUT_FILE})`);
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main();
}
