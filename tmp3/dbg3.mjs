// Replikasi extractCalls utk menemukan call path yang aneh
import fs from "node:fs";
import path from "node:path";

function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".") || e.name === "KODEINxLNG-Backend" || e.name === ".next") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) files.push(full);
  }
  return files;
}
const CLIENT_ROOTS = ["app", "src", "components", "lib"];
const roots = CLIENT_ROOTS.filter((p) => fs.existsSync(p));
const files = roots.flatMap((r) => walk(r, []));

function extractCalls(content) {
  const calls = [];
  const re = /apiClient\.(get|getPaged|post|put|patch|delete)\s*(<[^<>]*>)?\s*\(\s*([\s\S]{0,2000}?)(?:,\s*(?:\{[\s\S]*?\}\s*)?\)\s*;)/g;
  function normalize(raw) {
    let out = "", i = 0;
    while (i < raw.length) {
      if (raw[i] === "$" && raw[i + 1] === "{") {
        let depth = 1, j = i + 2;
        while (j < raw.length && depth > 0) { if (raw[j] === "{") depth++; else if (raw[j] === "}") { depth--; if (depth === 0) break; } j++; }
        const segment = raw.slice(i + 2, j);
        if (!segment.includes("?")) out += ":p";
        i = j + 1; continue;
      }
      out += raw[i]; i++;
    }
    return out.split("?")[0].replace(/\/+$/, "") || "/";
  }
  let m;
  while ((m = re.exec(content)) !== null) {
    let raw = m[3].trim();
    let p = null;
    if (raw.startsWith('"') || raw.startsWith("'")) {
      const q = raw[0]; const end = raw.indexOf(q, 1);
      p = end === -1 ? null : raw.slice(1, end);
    } else if (raw.startsWith("`")) {
      const end = raw.indexOf("`", 1);
      const body = end === -1 ? raw.slice(1) : raw.slice(1, end);
      p = normalize(body);
    }
    if (!p) continue;
    if (!p.startsWith("/")) continue;
    calls.push({ verb: m[1].toUpperCase(), path: p });
  }
  return calls;
}

const counts = new Map();
for (const f of files) {
  const c = fs.readFileSync(f, "utf8");
  for (const call of extractCalls(c)) {
    const k = call.verb + " " + call.path;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
}
// Cari path yang mengandung karakter aneh atau yang cocok dgn /auth/login secara tidak persis
for (const k of counts.keys()) {
  if (k.includes("auth/login") || k.includes("mfa/verify") || k.includes("pharmacy/dispensing")) {
    console.log(JSON.stringify(k), "->", counts.get(k));
  }
}
