// Password-protected viewer for workshop registrations, served at /submissions.
//
// GET  -> login screen (or the table, if a valid session cookie is present)
// POST -> checks the ID/password, sets a signed short-lived session cookie and
//         renders the table with time-limited signed links to each receipt.
//
// Deployed with verify_jwt = false: this function implements its own
// credential check, because the people opening it are staff with an ID and
// password, not Supabase auth users.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "mindcare-receipts";
const TABLE = "mindcare_workshop_registrations";

// Credentials are checked against a salted SHA-256 digest so the plaintext
// password is not committed to the website repository. Override either value
// with Supabase function secrets to rotate without a redeploy.
const SALT = "mindcare-submissions";
const CREDENTIAL_HASH = Deno.env.get("SUBMISSIONS_HASH") ??
  "d2e575cacc657d37ff02286715540343538c3359dd375713c1971a371e4d7373";

const SESSION_COOKIE = "mc_submissions";
const SESSION_SECONDS = 8 * 60 * 60;
const RECEIPT_LINK_SECONDS = 60 * 60;

const encoder = new TextEncoder();

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SERVICE_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time-ish comparison so a wrong password leaks no timing signal. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function checkCredentials(id: string, password: string): Promise<boolean> {
  const digest = await sha256Hex(`${SALT}:${id.trim()}:${password}`);
  return safeEqual(digest, CREDENTIAL_HASH.toLowerCase());
}

async function issueSession(): Promise<string> {
  const expires = String(Date.now() + SESSION_SECONDS * 1000);
  return `${expires}.${await hmacHex(expires)}`;
}

async function sessionIsValid(token: string | null): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const expires = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;
  return safeEqual(signature, await hmacHex(expires));
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatWhen(iso: string): string {
  // Pakistan Standard Time is UTC+5 year round, so a fixed offset is exact.
  const d = new Date(new Date(iso).getTime() + 5 * 60 * 60 * 1000);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${hh}:${mm} PKT`;
}

const PAGE_CSS = `
:root{--bg:#f5f8f7;--card:#fff;--ink:#12241a;--muted:#5b6b63;--line:#dfe8e4;--teal:#2BBDC9;--teal-deep:#0F9AA8}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--teal-deep)}
.wrap{max-width:1180px;margin:0 auto;padding:28px 20px 60px}
.top{display:flex;flex-wrap:wrap;gap:14px;align-items:center;justify-content:space-between;margin-bottom:22px}
.brand{font-size:1.35rem;font-weight:700;letter-spacing:-.01em}
.brand span{color:var(--teal-deep)}
.sub{color:var(--muted);font-size:.88rem;margin-top:2px}
.tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);background:var(--card);color:var(--ink);
 padding:9px 15px;border-radius:10px;font:inherit;font-size:.86rem;font-weight:600;cursor:pointer;text-decoration:none}
.btn:hover{border-color:var(--teal)}
.btn-primary{background:var(--teal-deep);border-color:var(--teal-deep);color:#fff}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;box-shadow:0 8px 26px rgba(6,43,49,.06)}
.search{flex:1;min-width:200px;padding:10px 13px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:.9rem;background:var(--card);color:var(--ink)}
.tablewrap{overflow-x:auto;border-radius:16px}
table{border-collapse:collapse;width:100%;min-width:1280px;font-size:.87rem}
th{position:sticky;top:0;background:#eef4f2;text-align:left;font-size:.7rem;letter-spacing:.09em;text-transform:uppercase;
 color:var(--teal-deep);padding:12px 14px;border-bottom:1px solid var(--line);white-space:nowrap}
td{padding:13px 14px;border-bottom:1px solid var(--line);vertical-align:top}
tr:last-child td{border-bottom:0}
tr:hover td{background:#f8fbfa}
.name{font-weight:600;white-space:nowrap}
.long{max-width:280px;color:var(--muted);white-space:pre-wrap}
.name .long{font-size:.76rem;margin-top:2px;max-width:190px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nowrap{white-space:nowrap}
.count{display:inline-block;background:var(--teal);color:#fff;border-radius:999px;padding:2px 10px;font-size:.78rem;font-weight:700;margin-left:8px}
.empty{padding:60px 20px;text-align:center;color:var(--muted)}
.login{max-width:390px;margin:14vh auto 0;padding:34px}
.login h1{font-size:1.3rem;margin:0 0 4px}
.login p{color:var(--muted);font-size:.88rem;margin:0 0 22px}
.login label{display:block;font-size:.76rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px}
.login input{width:100%;padding:11px 13px;border:1px solid var(--line);border-radius:10px;font:inherit;margin-bottom:16px;background:#fff;color:var(--ink)}
.login input:focus{border-color:var(--teal);outline:none;box-shadow:0 0 0 3px rgba(43,189,201,.15)}
.login .btn{width:100%;justify-content:center;padding:12px}
.err{background:#fdecec;border:1px solid #f3c4c4;color:#a12a2a;border-radius:10px;padding:10px 13px;font-size:.85rem;margin-bottom:16px}
@media(prefers-color-scheme:dark){
 :root{--bg:#0e1b13;--card:#12241a;--ink:#e8f2ed;--muted:#93a89e;--line:#22392c}
 th{background:#162c20}
 tr:hover td{background:#16281d}
 .login input{background:#0e1b13;color:var(--ink)}
 .err{background:#3a1c1c;border-color:#5e2b2b;color:#f0b4b4}
}
`;

function shell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="color-scheme" content="light dark">
<title>${esc(title)}</title>
<link rel="icon" href="/mindcare.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${PAGE_CSS}</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function loginPage(error?: string): Response {
  const body = `<div class="wrap">
  <form class="card login" method="POST" action="">
    <h1>MIND<span style="color:var(--teal-deep)">CARE</span> Submissions</h1>
    <p>Workshop registrations. Authorised staff only.</p>
    ${error ? `<div class="err">${esc(error)}</div>` : ""}
    <label for="id">ID</label>
    <input id="id" name="id" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button class="btn btn-primary" type="submit">Sign in</button>
  </form>
</div>`;
  return new Response(shell("Submissions | MindCare Services", body), {
    status: error ? 401 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

type Registration = {
  id: string;
  created_at: string;
  workshop: string;
  name: string;
  institute: string;
  phone: string;
  email: string;
  education: string;
  prior_info: string;
  expectations: string;
  certificate: boolean;
  receipt_path: string | null;
  receipt_name: string | null;
};

async function signedReceiptUrls(paths: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  if (!paths.length) return map;
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: RECEIPT_LINK_SECONDS, paths }),
  });
  if (!res.ok) {
    console.error("signing receipts failed", res.status, await res.text());
    return map;
  }
  for (const row of await res.json() as Array<{ path?: string; signedURL?: string }>) {
    if (row.path && row.signedURL) map[row.path] = `${SUPABASE_URL}/storage/v1${row.signedURL}`;
  }
  return map;
}

async function submissionsPage(): Promise<Response> {
  const query = new URLSearchParams({
    select: "id,created_at,workshop,name,institute,phone,email,education,prior_info,expectations,certificate,receipt_path,receipt_name",
    order: "created_at.desc",
    limit: "1000",
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?${query}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) {
    console.error("fetching registrations failed", res.status, await res.text());
    return new Response(shell("Submissions | MindCare Services", `<div class="wrap"><div class="card empty">We could not load the registrations right now. Please refresh in a moment.</div></div>`), {
      status: 502,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const rows = await res.json() as Registration[];
  const links = await signedReceiptUrls(
    rows.map((r) => r.receipt_path).filter((p): p is string => !!p),
  );

  const tableRows = rows.map((r) => {
    // The workshop is free: only people who bought the certificate have a receipt.
    const link = r.receipt_path ? links[r.receipt_path] : undefined;
    const receiptCell = !r.certificate
      ? `<span class="long">Free seat, no payment</span>`
      : link
      ? `<a class="btn" href="${esc(link)}" target="_blank" rel="noopener">View receipt</a>`
      : `<span class="long">${esc(r.receipt_name || "uploaded")}</span>`;
    return `<tr>
      <td class="nowrap">${esc(formatWhen(r.created_at))}</td>
      <td class="name">${esc(r.name)}<div class="long">${esc(r.workshop)}</div></td>
      <td>${esc(r.institute)}</td>
      <td class="nowrap"><a href="tel:${esc(r.phone.replace(/[^\d+]/g, ""))}">${esc(r.phone)}</a></td>
      <td><a href="mailto:${esc(r.email)}">${esc(r.email)}</a></td>
      <td>${esc(r.education)}</td>
      <td class="long">${esc(r.prior_info)}</td>
      <td class="long">${esc(r.expectations)}</td>
      <td class="nowrap">${r.certificate ? "Yes, PKR 1,000" : "No"}</td>
      <td>${receiptCell}</td>
    </tr>`;
  }).join("");

  const table = rows.length
    ? `<div class="card tablewrap"><table id="grid">
        <thead><tr>
          <th>Received</th><th>Name</th><th>Institute / University</th><th>Phone</th><th>Email</th>
          <th>Current education</th><th>Prior knowledge</th><th>Expectations</th><th>Certificate</th><th>Receipt</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table></div>`
    : `<div class="card empty">No registrations yet. They will appear here as soon as someone submits the workshop form.</div>`;

  const csvData = rows.map((r) => [
    formatWhen(r.created_at), r.workshop, r.name, r.institute, r.phone, r.email,
    r.education, r.prior_info, r.expectations, r.certificate ? "Yes" : "No",
    r.certificate ? (r.receipt_name ?? r.receipt_path ?? "uploaded") : "",
  ]);

  const body = `<div class="wrap">
  <div class="top">
    <div>
      <div class="brand">MIND<span>CARE</span> Submissions<span class="count">${rows.length}</span></div>
      <div class="sub">Workshop registrations, newest first. The workshop is free; receipts belong to paid certificates only, and their links expire after one hour.</div>
    </div>
    <div class="tools">
      <input class="search" id="q" type="search" placeholder="Search name, email, institute...">
      <button class="btn" id="csv" type="button">Download CSV</button>
      <a class="btn" href="">Refresh</a>
      <form method="POST" action="" style="margin:0"><input type="hidden" name="action" value="logout"><button class="btn" type="submit">Sign out</button></form>
    </div>
  </div>
  ${table}
</div>
<script id="rowdata" type="application/json">${
    JSON.stringify(csvData).replace(/</g, "\\u003c")
  }</script>
<script>
(function(){
  var q = document.getElementById('q'), grid = document.getElementById('grid');
  if (q && grid) {
    q.addEventListener('input', function(){
      var needle = q.value.toLowerCase();
      Array.prototype.forEach.call(grid.tBodies[0].rows, function(row){
        row.style.display = row.textContent.toLowerCase().indexOf(needle) === -1 ? 'none' : '';
      });
    });
  }
  var btn = document.getElementById('csv');
  if (btn) btn.addEventListener('click', function(){
    var head = ['Received','Workshop','Name','Institute','Phone','Email','Current education','Prior knowledge','Expectations','Certificate','Receipt'];
    var rows = JSON.parse(document.getElementById('rowdata').textContent);
    var csv = [head].concat(rows).map(function(r){
      return r.map(function(c){ return '"' + String(c == null ? '' : c).replace(/"/g,'""') + '"'; }).join(',');
    }).join('\\r\\n');
    var url = URL.createObjectURL(new Blob(['\\ufeff' + csv], {type:'text/csv;charset=utf-8'}));
    var a = document.createElement('a');
    a.href = url; a.download = 'mindcare-workshop-registrations.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
})();
</script>`;

  return new Response(shell("Submissions | MindCare Services", body), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function withCookie(res: Response, value: string, maxAge: number): Response {
  const headers = new Headers(res.headers);
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`,
  );
  return new Response(res.body, { status: res.status, headers });
}

Deno.serve(async (req: Request) => {
  if (req.method === "POST") {
    const form = await req.formData().catch(() => null);
    if (!form) return loginPage("Something went wrong. Please try again.");

    if (form.get("action") === "logout") {
      return withCookie(loginPage(), "", 0);
    }

    const id = String(form.get("id") ?? "");
    const password = String(form.get("password") ?? "");
    if (!await checkCredentials(id, password)) {
      // Slow failed attempts down a little to blunt password guessing.
      await new Promise((r) => setTimeout(r, 700));
      return loginPage("That ID and password did not match.");
    }
    return withCookie(await submissionsPage(), await issueSession(), SESSION_SECONDS);
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405 });
  }

  if (await sessionIsValid(readCookie(req, SESSION_COOKIE))) {
    return await submissionsPage();
  }
  return loginPage();
});
