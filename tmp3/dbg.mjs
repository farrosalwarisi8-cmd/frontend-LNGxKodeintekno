const spec = await fetch("http://localhost:3000/docs-json").then((r) => r.json());
const routes = [];
for (const [p, ops] of Object.entries(spec.paths ?? {})) {
  for (const method of Object.keys(ops)) {
    if (!["get","post","put","patch","delete"].includes(method)) continue;
    routes.push({ method: method.toUpperCase(), path: p.replace(/^\/api\/v1/, "").replace(/\{[^}]+\}/g, ":p") });
  }
}
console.log("route contoh:", routes.filter((r)=>r.path.startsWith("/auth")||r.path.startsWith("/pharmacy")).map(r=>r.method+" "+r.path).join(" | "));

function normalizeCallPath(raw) {
  let out = "", i = 0;
  while (i < raw.length) {
    if (raw[i] === "$" && raw[i+1] === "{") {
      let depth = 1, j = i + 2;
      while (j < raw.length && depth > 0) {
        if (raw[j] === "{") depth++;
        else if (raw[j] === "}") depth--;
        if (depth === 0) break;
        j++;
      }
      const segment = raw.slice(i + 2, j);
      if (!segment.includes("?")) out += ":p";
      i = j + 1;
      continue;
    }
    out += raw[i]; i++;
  }
  return out.split("?")[0].replace(/\/+$/, "") || "/";
}
console.log("auth.login path:", normalizeCallPath('"/auth/login"'));
console.log("match:", routes.some(r=>r.method==="POST" && r.path===normalizeCallPath('"/auth/login"')));
console.log("match pharmacy:", routes.some(r=>r.method==="POST" && r.path===normalizeCallPath('"/pharmacy/dispensing"')));

// cek live
const T = await fetch("http://localhost:3000/api/v1/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"hse.officer",password:"KlinikLNG2026!"})}).then(r=>r.json());
const res = await fetch("http://localhost:3000/api/v1/auth/login",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+(T?.data?.accessToken??"")},body:"{}"});
console.log("POST /auth/login live:", res.status, (await res.text()).slice(0,120));
