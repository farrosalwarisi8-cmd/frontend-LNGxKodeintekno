const T = await fetch("http://localhost:3000/api/v1/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:"hse.officer",password:"KlinikLNG2026!"})}).then(r=>r.json());
// replikasi persis probeLive checker: tanpa Content-Type, body string
const res = await fetch("http://localhost:3000/api/v1/auth/login",{method:"POST",headers:{Authorization:"Bearer "+T.data.accessToken},body:"{}"});
console.log("tanpa content-type:", res.status, (await res.text()).slice(0,140));
const res2 = await fetch("http://localhost:3000/api/v1/auth/mfa/verify",{method:"POST",headers:{Authorization:"Bearer "+T.data.accessToken},body:"{}"});
console.log("mfa/verify:", res2.status, (await res2.text()).slice(0,140));
