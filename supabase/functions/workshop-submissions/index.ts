// Password-protected viewer for everything the website collects, served at
// /submissions: workshop and course registrations, and the consultation,
// appointment and question forms on /contact.
//
// GET  -> login screen (or the submissions, if a valid session cookie is present)
// POST -> login, logout, deleting one submission, or saving the alert settings
//
// The submissions are laid out as a card grid rather than a wide table, so
// the page never scrolls sideways and reads properly on a phone.
//
// Deployed with verify_jwt = false: this function implements its own
// credential check, because the people opening it are staff with an ID and
// password, not Supabase auth users.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "mindcare-receipts";
const TABLE = "mindcare_workshop_registrations";
// Kept for the older free workshops, whose only payment was the certificate.
const CERT_FEE = "PKR 1,000";

// Credentials are checked against a salted SHA-256 digest so the plaintext
// password is not committed to the website repository. Override either value
// with Supabase function secrets to rotate without a redeploy.
const SALT = "mindcare-submissions";
const CREDENTIAL_HASH = Deno.env.get("SUBMISSIONS_HASH") ??
  "d2e575cacc657d37ff02286715540343538c3359dd375713c1971a371e4d7373";

const SESSION_COOKIE = "mc_submissions";
// A signed in phone stays signed in. The cookie lasts a year and is renewed on
// every visit, so the dashboard only ever asks again after someone taps Sign
// out (or a full year away from it).
const SESSION_SECONDS = 365 * 24 * 60 * 60;
const PUSH_TABLE = "mindcare_push_subscriptions";
const SETTINGS_TABLE = "mindcare_settings";
const RECEIPT_LINK_SECONDS = 60 * 60;
// Shown on the settings sheet. Must match ALWAYS_NOTIFY in workshop-register,
// which is the address every alert is sent to no matter what is configured.
const ALWAYS_NOTIFY = "shaistatariq2002@gmail.com";

// What each form is called on a card and in the filter row.
const KIND_LABELS: Record<string, string> = {
  "workshop": "Registration",
  "consultation": "Free consultation",
  "appointment": "Appointment",
  "question": "Question",
  "workshop-request": "Workshop request",
};

type Settings = Record<string, Record<string, unknown>>;

/** Reads the notification settings. Service role only, same as everything else here. */
async function loadSettings(): Promise<Settings> {
  const out: Settings = {};
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${SETTINGS_TABLE}?select=key,value`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!res.ok) {
      console.error("loading settings failed", res.status, await res.text());
      return out;
    }
    for (const row of await res.json() as Array<{ key: string; value: Record<string, unknown> }>) {
      out[row.key] = row.value ?? {};
    }
  } catch (err) {
    console.error("loading settings threw", err);
  }
  return out;
}

async function saveSettings(key: string, value: Record<string, unknown>): Promise<boolean> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${SETTINGS_TABLE}?on_conflict=key`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) console.error("saving settings failed", res.status, await res.text());
  return res.ok;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
:root{--bg:#f5f8f7;--card:#fff;--ink:#12241a;--muted:#5b6b63;--line:#dfe8e4;--teal:#2BBDC9;--teal-deep:#0F9AA8;
 --green:#2D6A1F;--green-bg:#eaf4e6;--danger:#c2413f}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
 -webkit-font-smoothing:antialiased;overflow-wrap:anywhere}
a{color:var(--teal-deep)}
.wrap{max-width:1180px;margin:0 auto;padding:22px 16px 56px}
.top{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end;justify-content:space-between;margin-bottom:18px}
.brandline{display:flex;align-items:center;gap:11px}
.logo{width:44px;height:44px;flex:none;border-radius:11px;background:#fff;padding:3px;border:1px solid var(--line)}
.brand{font-size:1.3rem;font-weight:700;letter-spacing:-.01em;line-height:1.2}
.brand span{color:var(--teal-deep)}
.sub{color:var(--muted);font-size:.85rem;margin-top:4px;max-width:52ch}
.count{display:inline-block;background:var(--teal);color:#fff;border-radius:999px;padding:2px 10px;font-size:.75rem;font-weight:700;
 margin-left:8px;vertical-align:middle}
.tools{display:flex;gap:9px;align-items:center;flex-wrap:wrap;flex:1;min-width:min(100%,280px);justify-content:flex-end}
.tools form{margin:0}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:1px solid var(--line);background:var(--card);color:var(--ink);
 padding:10px 15px;border-radius:10px;font:inherit;font-size:.85rem;font-weight:600;cursor:pointer;text-decoration:none;min-height:42px;white-space:nowrap}
.btn:hover{border-color:var(--teal)}
.btn-primary{background:var(--teal-deep);border-color:var(--teal-deep);color:#fff}
.search{flex:1;min-width:180px;padding:10px 13px;border:1px solid var(--line);border-radius:10px;font:inherit;font-size:.9rem;
 background:var(--card);color:var(--ink);min-height:42px}
.search:focus{border-color:var(--teal);outline:none;box-shadow:0 0 0 3px rgba(43,189,201,.15)}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;box-shadow:0 8px 26px rgba(6,43,49,.06)}
.notice{background:var(--teal-deep);color:#fff;border-radius:12px;padding:12px 16px;font-size:.88rem;font-weight:600;margin-bottom:16px}

.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;align-items:start}
.reg{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px;box-shadow:0 6px 20px rgba(6,43,49,.05)}
.reg-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.reg-name{font-size:1.05rem;font-weight:700;margin:0;line-height:1.25}
.reg-when{color:var(--muted);font-size:.76rem;margin-top:3px}
.reg-del{margin:0;flex:none}
.icon-btn{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;cursor:pointer;
 border:1px solid var(--line);background:transparent;color:var(--muted);font:inherit;padding:0}
.icon-btn:hover{border-color:var(--danger);color:var(--danger);background:rgba(194,65,63,.07)}
.icon-btn svg{width:17px;height:17px;display:block}
.tag{display:inline-block;font-size:.72rem;font-weight:700;border-radius:999px;padding:4px 11px;margin:12px 0 0}
/* Money is green across the site, so a paid certificate reads green here too. */
.tag-paid{color:var(--green);background:var(--green-bg);border:1px solid rgba(45,106,31,.22)}
.tag-free{color:var(--muted);background:var(--bg);border:1px solid var(--line)}
.tag-kind{color:var(--teal-deep);background:rgba(43,189,201,.1);border:1px solid rgba(43,189,201,.28)}
.tag-warn{color:var(--danger);background:rgba(194,65,63,.08);border:1px solid rgba(194,65,63,.28);margin-left:6px}

/* filter chips */
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.chip{border:1px solid var(--line);background:var(--card);color:var(--muted);border-radius:999px;padding:8px 14px;
 font:inherit;font-size:.8rem;font-weight:600;cursor:pointer;min-height:38px}
.chip.on{background:var(--teal-deep);border-color:var(--teal-deep);color:#fff}

/* settings sheet */
.notice-warn{background:var(--danger)}
.sheet{position:fixed;inset:0;z-index:60;background:rgba(6,20,16,.55);display:flex;align-items:flex-start;
 justify-content:center;padding:18px;overflow-y:auto;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}
.sheet[hidden]{display:none}
.sheet-card{width:100%;max-width:460px;margin:auto;padding:22px}
.sheet-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:6px}
.sheet-head h2{font-size:1.1rem;margin:0}
.sheet-head .icon-btn{font-size:1.4rem;line-height:1}
.sheet-note{color:var(--muted);font-size:.85rem;line-height:1.5;margin:0 0 18px}
.sheet-hint{color:var(--muted);font-size:.78rem;line-height:1.45;margin:-10px 0 16px}
.sheet label{display:block;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px}
.sheet input[type=text],.sheet input[type=password],.sheet input:not([type]),.sheet select{
 width:100%;padding:11px 13px;border:1px solid var(--line);border-radius:10px;font:inherit;margin-bottom:16px;
 background:var(--card);color:var(--ink)}
.sheet input:focus,.sheet select:focus{border-color:var(--teal);outline:none;box-shadow:0 0 0 3px rgba(43,189,201,.15)}
.sheet-more{border:1px solid var(--line);border-radius:10px;padding:12px 14px;margin-bottom:16px}
.sheet-more summary{cursor:pointer;font-size:.85rem;font-weight:600}
.sheet-more>*:not(summary){margin-top:12px}
.sheet-check{display:flex;align-items:center;gap:9px;text-transform:none;letter-spacing:0;font-size:.87rem;
 font-weight:500;margin-bottom:18px}
.sheet-check input{width:18px;height:18px;margin:0;flex:none}
.sheet-actions{display:flex;gap:9px;flex-wrap:wrap}
.sheet-actions .btn{flex:1;min-width:140px}
.sheet-result{margin:14px 0 0;font-size:.85rem;line-height:1.5;padding:10px 13px;border-radius:10px;
 background:var(--green-bg);color:var(--green);overflow-wrap:anywhere}
.sheet-result[hidden]{display:none}
.sheet-result.bad{background:#fdecec;color:#a12a2a}
html[data-theme="dark"] .sheet-result.bad{background:#3a1c1c;color:#f0b4b4}

.reg-fields{display:grid;grid-template-columns:1fr;gap:11px;margin:14px 0 0}
.reg-fields>div{margin:0}
.reg-fields dt{font-size:.66rem;letter-spacing:.09em;text-transform:uppercase;color:var(--teal-deep);font-weight:700;margin-bottom:2px}
.reg-fields dd{margin:0;font-size:.9rem;line-height:1.4}
.reg-note{margin-top:12px;padding-top:12px;border-top:1px dashed var(--line)}
.reg-note-label{font-size:.66rem;letter-spacing:.09em;text-transform:uppercase;color:var(--teal-deep);font-weight:700}
.reg-note p{margin:3px 0 0;font-size:.87rem;line-height:1.5;color:var(--muted);white-space:pre-wrap}
.reg-foot{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:14px;padding-top:13px;
 border-top:1px solid var(--line)}
.reg-workshop{font-size:.72rem;color:var(--muted);flex:1;min-width:110px}
.reg-foot .btn{padding:8px 13px;font-size:.8rem;min-height:38px}

.empty{padding:56px 20px;text-align:center;color:var(--muted)}
.noresults{text-align:center;color:var(--muted);padding:34px 10px;font-size:.9rem}
.login{max-width:390px;margin:12vh auto 0;padding:30px}
.login .logo{width:auto;max-width:210px;height:auto;display:block;margin:0 auto 16px;border:0;background:none;padding:0}
.login h1{font-size:1.25rem;margin:0 0 4px;text-align:center}
.login p{color:var(--muted);font-size:.88rem;margin:0 0 22px;text-align:center}
.btn-on{border-color:var(--teal);color:var(--teal-deep)}
.login label{display:block;font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px}
.login input{width:100%;padding:12px 13px;border:1px solid var(--line);border-radius:10px;font:inherit;margin-bottom:16px;background:#fff;color:var(--ink)}
.login input:focus{border-color:var(--teal);outline:none;box-shadow:0 0 0 3px rgba(43,189,201,.15)}
.login .btn{width:100%;padding:13px}
.err{background:#fdecec;border:1px solid #f3c4c4;color:#a12a2a;border-radius:10px;padding:10px 13px;font-size:.85rem;margin-bottom:16px}

@media(max-width:640px){
 .wrap{padding:18px 12px 44px}
 .top{flex-direction:column;align-items:stretch;gap:12px}
 .tools{justify-content:stretch;min-width:0}
 .search{flex:1 1 100%;min-width:0}
 .tools .btn,.tools form{flex:1 1 0;min-width:0}
 .tools form .btn{width:100%}
 .grid{grid-template-columns:1fr;gap:12px}
 .login{margin-top:6vh}
}
html[data-theme="dark"]{--bg:#0e1b13;--card:#12241a;--ink:#e8f2ed;--muted:#93a89e;--line:#22392c;
 --green:#6ede8a;--green-bg:#16281a;--danger:#e8817f}
html[data-theme="dark"] .login input{background:#0e1b13;color:var(--ink)}
html[data-theme="dark"] .err{background:#3a1c1c;border-color:#5e2b2b;color:#f0b4b4}
html[data-theme="dark"] .tag-paid{border-color:rgba(110,222,138,.28)}
html[data-theme="dark"] .icon-btn:hover{background:rgba(232,129,127,.12)}
.theme-btn{cursor:pointer}
html[data-theme="dark"] .theme-btn .sun{display:none}
html[data-theme="light"] .theme-btn .moon{display:none}
`;

function shell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="color-scheme" content="light dark">
<script>(function(){try{var t=localStorage.getItem('mc-theme')||'light';document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light');}catch(e){}})();</script>
<title>${esc(title)}</title>
<link rel="icon" href="/assets/icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png">
<link rel="manifest" href="/submissions.webmanifest">
<meta name="theme-color" content="#2BBDC9">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${PAGE_CSS}</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

function htmlResponse(body: string, status = 200): Response {
  return new Response(shell("Submissions | MindCare Services", body), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function loginPage(error?: string): Response {
  return htmlResponse(
    `<div class="wrap">
  <form class="card login" method="POST" action="">
    <img class="logo" src="/mindcare.png" alt="MindCare Services" width="210" height="84">
    <h1>Submissions</h1>
    <p>Website submissions. Authorised staff only.</p>
    ${error ? `<div class="err">${esc(error)}</div>` : ""}
    <label for="id">ID</label>
    <input id="id" name="id" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus>
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required>
    <button class="btn btn-primary" type="submit">Sign in</button>
  </form>
</div>`,
    error ? 401 : 200,
  );
}

type Registration = {
  id: string;
  created_at: string;
  kind: string;
  workshop: string;
  name: string;
  institute: string;
  phone: string;
  email: string;
  education: string;
  prior_info: string;
  expectations: string;
  service: string;
  message: string;
  preferred_date: string;
  preferred_time: string;
  certificate: boolean;
  receipt_path: string | null;
  receipt_name: string | null;
  notify_status: string;
  notified_at: string | null;
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

/** Removes one registration and whatever receipt came with it. */
async function deleteRegistration(id: string): Promise<string | null> {
  if (!UUID_RE.test(id)) return null;

  const lookup = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}&select=name,receipt_path`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!lookup.ok) {
    console.error("delete lookup failed", lookup.status, await lookup.text());
    return null;
  }
  const [row] = await lookup.json() as Array<{ name: string; receipt_path: string | null }>;
  if (!row) return null;

  const removal = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}`, {
    method: "DELETE",
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!removal.ok) {
    console.error("delete failed", removal.status, await removal.text());
    return null;
  }

  // Free seats have no receipt. When there is one, the row is what matters, so
  // a file that will not delete is logged and left rather than failing the action.
  if (row.receipt_path) {
    const dropped = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${row.receipt_path}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!dropped.ok) console.error("receipt delete failed", dropped.status, await dropped.text());
  }
  return row.name;
}

const TRASH_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

async function submissionsPage(notice?: string): Promise<Response> {
  const query = new URLSearchParams({
    select: "id,created_at,kind,workshop,name,institute,phone,email,education,prior_info," +
      "expectations,service,message,preferred_date,preferred_time,certificate," +
      "receipt_path,receipt_name,notify_status,notified_at",
    order: "created_at.desc",
    limit: "1000",
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?${query}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) {
    console.error("fetching submissions failed", res.status, await res.text());
    return htmlResponse(
      `<div class="wrap"><div class="card empty">We could not load the submissions right now. Please refresh in a moment.</div></div>`,
      502,
    );
  }

  const rows = await res.json() as Registration[];
  const links = await signedReceiptUrls(
    rows.map((r) => r.receipt_path).filter((p): p is string => !!p),
  );

  const cards = rows.map((r) => {
    const kind = KIND_LABELS[r.kind] ? r.kind : "workshop";
    const isWorkshop = kind === "workshop";
    // A paid registration has a receipt; a free seat has nothing to collect,
    // and the badge already says so.
    const link = r.receipt_path ? links[r.receipt_path] : undefined;
    const receipt = !r.receipt_path
      ? ""
      : link
      ? `<a class="btn" href="${esc(link)}" target="_blank" rel="noopener">View receipt</a>`
      : `<span class="reg-workshop">${esc(r.receipt_name || "Receipt unavailable")}</span>`;
    const note = (label: string, value: string) =>
      value
        ? `<div class="reg-note"><span class="reg-note-label">${label}</span><p>${esc(value)}</p></div>`
        : "";
    const field = (label: string, value: string, href?: string) =>
      value
        ? `<div><dt>${label}</dt><dd>${
          href ? `<a href="${esc(href)}">${esc(value)}</a>` : esc(value)
        }</dd></div>`
        : "";
    // A registration is badged by what was paid. Everything else is badged by
    // which form it came from, because that is the thing worth seeing first.
    const badge = isWorkshop
      ? `<span class="tag ${r.receipt_path ? "tag-paid" : "tag-free"}">${
        r.receipt_path
          ? `Paid${r.certificate ? " &middot; with certificate" : ""}`
          : (r.certificate ? `Certificate &middot; ${CERT_FEE}` : "Free seat")
      }</span>`
      : `<span class="tag tag-kind">${esc(KIND_LABELS[kind])}</span>`;
    // An alert that did not go out is worth knowing about here rather than in
    // the function logs, because this page is the only other copy.
    const alertState = r.notify_status && r.notify_status !== "sent"
      ? `<span class="tag tag-warn" title="${esc(r.notify_status)}">Alert email failed</span>`
      : "";
    const when = [r.preferred_date, r.preferred_time].filter(Boolean).join(" at ");

    return `<article class="reg" data-row data-kind="${esc(kind)}">
      <div class="reg-top">
        <div>
          <h2 class="reg-name">${esc(r.name)}</h2>
          <div class="reg-when">${esc(formatWhen(r.created_at))}</div>
        </div>
        <form class="reg-del" method="POST" action="" data-delete data-name="${esc(r.name)}">
          <input type="hidden" name="action" value="delete">
          <input type="hidden" name="id" value="${esc(r.id)}">
          <button class="icon-btn" type="submit" title="Delete this submission"
                  aria-label="Delete the submission from ${esc(r.name)}">${TRASH_ICON}</button>
        </form>
      </div>
      ${badge}${alertState}
      <dl class="reg-fields">
        ${field("Phone", r.phone, r.phone ? `tel:${r.phone.replace(/[^\d+]/g, "")}` : undefined)}
        ${field("Email", r.email, r.email ? `mailto:${r.email}` : undefined)}
        ${field("Service", r.service)}
        ${field("Preferred slot", when)}
        ${field("Institute / University", r.institute)}
        ${field("Current education", r.education)}
      </dl>
      ${note("Message", r.message)}
      ${note("Prior knowledge", r.prior_info)}
      ${note("Expectations", r.expectations)}
      <div class="reg-foot">
        <span class="reg-workshop">${esc(r.workshop)}</span>
        ${receipt}
      </div>
    </article>`;
  }).join("");

  const counts: Record<string, number> = {};
  for (const r of rows) {
    const kind = KIND_LABELS[r.kind] ? r.kind : "workshop";
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  const filters = [`<button class="chip on" type="button" data-filter="">All ${rows.length}</button>`]
    .concat(
      Object.keys(KIND_LABELS)
        .filter((k) => counts[k])
        .map((k) =>
          `<button class="chip" type="button" data-filter="${esc(k)}">${
            esc(KIND_LABELS[k])
          } ${counts[k]}</button>`
        ),
    ).join("");

  const list = rows.length
    ? `<div class="chips">${filters}</div><div class="grid" id="grid">${cards}</div>` +
      `<p class="noresults" id="noresults" hidden>Nothing matches that search.</p>`
    : `<div class="card empty">No submissions yet. Registrations, consultation and appointment
       requests and messages from the website all appear here the moment they are sent.</div>`;

  const csvData = rows.map((r) => [
    formatWhen(r.created_at), KIND_LABELS[r.kind] ?? r.kind, r.workshop, r.name, r.phone, r.email,
    r.service, [r.preferred_date, r.preferred_time].filter(Boolean).join(" "), r.message,
    r.institute, r.education, r.prior_info, r.expectations, r.certificate ? "Yes" : "No",
    r.receipt_path ? (r.receipt_name ?? r.receipt_path) : "",
    r.notify_status || (r.notified_at ? "sent" : ""),
  ]);

  const settings = await loadSettings();
  const notify = settings.notify ?? {};
  const smtp = (notify.smtp ?? {}) as Record<string, unknown>;
  const vapidPublic = typeof settings.push?.vapid_public === "string" ? settings.push.vapid_public : "";
  const value = (v: unknown) => esc(typeof v === "string" ? v : "");
  const failed = rows.filter((r) => r.notify_status && r.notify_status !== "sent").length;
  // Either a credential of some kind, or a function secret doing the same job.
  const smtpReady = !!(smtp.host && smtp.user && smtp.pass);
  const configured = !!(typeof notify.api_key === "string" && notify.api_key) || smtpReady ||
    !!Deno.env.get("RESEND_API_KEY") || !!Deno.env.get("SMTP_HOST");

  const body = `<div class="wrap">
  <div class="top">
    <div>
      <div class="brandline">
        <img class="logo" src="/assets/icons/icon-192.png" alt="MindCare Services" width="44" height="44">
        <div class="brand">MIND<span>CARE</span> Submissions<span class="count">${rows.length}</span></div>
      </div>
      <div class="sub">Every registration, consultation and message from the website, newest first.
        Receipt links expire after one hour.</div>
    </div>
    <div class="tools">
      <input class="search" id="q" type="search" placeholder="Search name, email, institute...">
      <button class="btn theme-btn" id="themeBtn" type="button" aria-label="Toggle theme"><span class="sun">Dark</span><span class="moon">Light</span></button>
      <button class="btn" id="alerts" type="button" hidden>Alerts</button>
      <button class="btn" id="settingsBtn" type="button">Settings</button>
      <button class="btn" id="csv" type="button">CSV</button>
      <a class="btn" href="">Refresh</a>
      <form method="POST" action=""><input type="hidden" name="action" value="logout"><button class="btn" type="submit">Sign out</button></form>
    </div>
  </div>
  ${notice ? `<div class="notice">${esc(notice)}</div>` : ""}
  ${
    configured
      ? (failed
        ? `<div class="notice notice-warn">${failed} alert email${failed === 1 ? "" : "s"} could not be
           sent. Open Settings, check the email provider and send a test.</div>`
        : "")
      : `<div class="notice notice-warn">No email provider is set up yet, so nothing here has been
         emailed to you. Tap <strong>Settings</strong>, paste an API key from Email Bump, Resend or Brevo
         (or your mailbox's SMTP details), save, then tap <strong>Send test email</strong>. Everything
         below is safe either way.</div>`
  }
  ${list}
</div>

<div class="sheet" id="settings" hidden>
  <form class="card sheet-card" method="POST" action="">
    <input type="hidden" name="action" value="settings">
    <div class="sheet-head">
      <h2>Alert settings</h2>
      <button class="icon-btn" type="button" id="settingsClose" aria-label="Close settings">&times;</button>
    </div>
    <p class="sheet-note">Every submission is emailed to <strong>${esc(ALWAYS_NOTIFY)}</strong>,
      always. Add an email provider below so those alerts can actually be sent, then use
      <strong>Send test email</strong> to prove it.</p>

    <label for="s-extra">Also email these addresses</label>
    <input id="s-extra" name="extra_to" value="${value(notify.extra_to)}"
           placeholder="info@themindcareservices.com, someone@else.com" autocapitalize="none" spellcheck="false">

    <label for="s-provider">Provider</label>
    <select id="s-provider" name="provider">
      ${
    [["", "Detect from the key"], ["emailbump", "Email Bump"], ["resend", "Resend"], ["brevo", "Brevo"], [
      "sendgrid",
      "SendGrid",
    ], ["smtp", "Any mailbox over SMTP (Zoho, Gmail, ...)"]]
      .map(([v, label]) =>
        `<option value="${v}"${value(notify.provider) === v ? " selected" : ""}>${label}</option>`
      ).join("")
  }
    </select>

    <label for="s-key">API key</label>
    <input id="s-key" name="api_key" type="password" value="${value(notify.api_key)}"
           placeholder="ebk_... or re_... or xkeysib-... or SG...." autocapitalize="none" spellcheck="false">

    <label for="s-from">Send from</label>
    <input id="s-from" name="from" value="${value(notify.from)}"
           placeholder="MindCare Website &lt;alerts@themindcareservices.com&gt;" autocapitalize="none" spellcheck="false">
    <p class="sheet-hint">Leave empty to use the provider's shared sender. Once themindcareservices.com
      is verified with the provider, put an address on it here: a borrowed sender is the main reason
      alerts land in spam.</p>

    <details class="sheet-more"${smtp.host ? " open" : ""}>
      <summary>SMTP details (only for the SMTP provider)</summary>
      <label for="s-host">Host</label>
      <input id="s-host" name="smtp_host" value="${value(smtp.host)}" placeholder="smtp.zoho.com" autocapitalize="none" spellcheck="false">
      <label for="s-port">Port</label>
      <input id="s-port" name="smtp_port" value="${value(String(smtp.port ?? ""))}" placeholder="465" inputmode="numeric">
      <label for="s-user">Username</label>
      <input id="s-user" name="smtp_user" value="${value(smtp.user)}" placeholder="info@themindcareservices.com" autocapitalize="none" spellcheck="false">
      <label for="s-pass">Password</label>
      <input id="s-pass" name="smtp_pass" type="password" value="${value(smtp.pass)}" autocapitalize="none" spellcheck="false">
    </details>

    <label class="sheet-check">
      <input type="checkbox" name="confirm_registrant" value="1"${notify.confirm_registrant === false ? "" : " checked"}>
      Also send the person a short confirmation
    </label>

    <div class="sheet-actions">
      <button class="btn" type="button" id="testBtn">Send test email</button>
      <button class="btn btn-primary" type="submit">Save</button>
    </div>
    <p class="sheet-result" id="testResult" hidden></p>
  </form>
</div>
<script id="rowdata" type="application/json">${
    JSON.stringify(csvData).replace(/</g, "\\u003c")
  }</script>
<script>
(function(){
  var q = document.getElementById('q');
  var grid = document.getElementById('grid');
  var none = document.getElementById('noresults');
  var kind = '';

  // Search and the kind chips narrow the same list, so they are applied together
  // rather than one undoing the other.
  function refilter(){
    if (!grid) return;
    var needle = q ? q.value.toLowerCase() : '';
    var shown = 0;
    Array.prototype.forEach.call(grid.querySelectorAll('[data-row]'), function(card){
      var hit = (!needle || card.textContent.toLowerCase().indexOf(needle) !== -1) &&
                (!kind || card.getAttribute('data-kind') === kind);
      card.style.display = hit ? '' : 'none';
      if (hit) shown++;
    });
    if (none) none.hidden = shown !== 0;
  }
  if (q) q.addEventListener('input', refilter);
  Array.prototype.forEach.call(document.querySelectorAll('.chip'), function(chip){
    chip.addEventListener('click', function(){
      kind = chip.getAttribute('data-filter') || '';
      Array.prototype.forEach.call(document.querySelectorAll('.chip'), function(c){
        c.classList.toggle('on', c === chip);
      });
      refilter();
    });
  });

  // Alert settings.
  var sheet = document.getElementById('settings');
  var openBtn = document.getElementById('settingsBtn');
  var closeBtn = document.getElementById('settingsClose');
  var testBtn = document.getElementById('testBtn');
  var testOut = document.getElementById('testResult');
  function closeSheet(){ if (sheet) sheet.hidden = true; }
  if (openBtn && sheet) openBtn.addEventListener('click', function(){ sheet.hidden = false; });
  if (closeBtn) closeBtn.addEventListener('click', closeSheet);
  if (sheet) sheet.addEventListener('click', function(e){ if (e.target === sheet) closeSheet(); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeSheet(); });

  if (testBtn && testOut) testBtn.addEventListener('click', function(){
    testBtn.disabled = true;
    testOut.hidden = false;
    testOut.className = 'sheet-result';
    testOut.textContent = 'Sending...';
    // Goes through the registration endpoint, which owns the sending code and
    // accepts this session cookie. Save first: it sends with what is stored.
    fetch('/api/workshop-register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test' }),
      credentials: 'same-origin'
    }).then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(data){
        if (res.ok && data.ok) {
          testOut.textContent = 'Sent to ' + (data.to || []).join(', ') +
            '. If it is not in the inbox, look in spam and mark it "Not spam".';
        } else {
          testOut.className = 'sheet-result bad';
          testOut.textContent = data.error || 'The test email could not be sent.';
        }
      });
    }).catch(function(){
      testOut.className = 'sheet-result bad';
      testOut.textContent = 'The test email could not be sent. Please try again.';
    }).then(function(){ testBtn.disabled = false; });
  });

  Array.prototype.forEach.call(document.querySelectorAll('[data-delete]'), function(form){
    form.addEventListener('submit', function(e){
      var who = form.getAttribute('data-name') || 'this registration';
      if (!confirm('Delete the submission from ' + who + '?\\n\\nThe details and any uploaded receipt are removed for good.')) {
        e.preventDefault();
      }
    });
  });

  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', function(){
    var d = document.documentElement;
    var t = d.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    d.setAttribute('data-theme', t);
    try { localStorage.setItem('mc-theme', t); } catch (e) {}
  });

  // Phone alerts. The service worker lives at the site root so it keeps working
  // when the dashboard is installed to the home screen, which is what Chrome on
  // Android and Safari on iOS need before a push can arrive at all.
  var alerts = document.getElementById('alerts');
  var VAPID = '${vapidPublic}';
  if (VAPID && alerts && 'serviceWorker' in navigator && 'PushManager' in window && window.isSecureContext) {
    var reg = null;
    alerts.hidden = false;

    function keyBytes(value) {
      var padded = (value + '==='.slice((value.length + 3) % 4)).replace(/-/g, '+').replace(/_/g, '/');
      var raw = atob(padded);
      var out = new Uint8Array(raw.length);
      for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
      return out;
    }
    function paint(on, busy) {
      alerts.textContent = busy ? 'Working...' : (on ? 'Alerts on' : 'Alerts off');
      alerts.className = 'btn' + (on && !busy ? ' btn-on' : '');
      alerts.disabled = !!busy;
    }
    function tell(payload) {
      return fetch('', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'same-origin'
      });
    }

    paint(false, true);
    navigator.serviceWorker.register('/sw.js').then(function (r) {
      reg = r;
      return r.pushManager.getSubscription();
    }).then(function (sub) {
      paint(!!sub && Notification.permission === 'granted');
    }).catch(function () { paint(false); });

    alerts.addEventListener('click', function () {
      if (!reg) return;
      paint(false, true);
      reg.pushManager.getSubscription().then(function (sub) {
        if (sub && Notification.permission === 'granted') {
          var endpoint = sub.endpoint;
          return sub.unsubscribe().then(function () {
            return tell({ action: 'unsubscribe', endpoint: endpoint });
          }).then(function () { paint(false); });
        }
        return Notification.requestPermission().then(function (permission) {
          if (permission !== 'granted') {
            paint(false);
            alert('Notifications are blocked for this site. Allow them in your browser settings, then tap Alerts again.');
            return;
          }
          return reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: keyBytes(VAPID)
          }).then(function (fresh) {
            var json = fresh.toJSON();
            return tell({
              action: 'subscribe',
              endpoint: json.endpoint,
              p256dh: json.keys.p256dh,
              auth: json.keys.auth
            }).then(function (res) {
              if (!res.ok) throw new Error('save failed');
              paint(true);
            });
          });
        });
      }).catch(function (err) {
        console.error(err);
        paint(false);
        alert('We could not turn alerts on just now. Please try again.');
      });
    });
  }

  var btn = document.getElementById('csv');
  if (btn) btn.addEventListener('click', function(){
    var head = ['Received','Type','Workshop / subject','Name','Phone','Email','Service','Preferred slot',
                'Message','Institute','Current education','Prior knowledge','Expectations','Certificate',
                'Receipt','Alert email'];
    var rows = JSON.parse(document.getElementById('rowdata').textContent);
    var csv = [head].concat(rows).map(function(r){
      return r.map(function(c){ return '"' + String(c == null ? '' : c).replace(/"/g,'""') + '"'; }).join(',');
    }).join('\\r\\n');
    var url = URL.createObjectURL(new Blob(['\\ufeff' + csv], {type:'text/csv;charset=utf-8'}));
    var a = document.createElement('a');
    a.href = url; a.download = 'mindcare-submissions.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
})();
</script>`;

  return htmlResponse(body);
}

function withCookie(res: Response, value: string, maxAge: number): Response {
  const headers = new Headers(res.headers);
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`,
  );
  return new Response(res.body, { status: res.status, headers });
}

/** Stores (or drops) one phone's push subscription. Session required. */
async function handlePushJson(req: Request): Promise<Response> {
  if (!await sessionIsValid(readCookie(req, SESSION_COOKIE))) {
    return new Response(JSON.stringify({ error: "Please sign in again." }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const action = body?.action;
  let ok = false;

  if (endpoint.startsWith("https://") && (action === "subscribe" || action === "unsubscribe")) {
    if (action === "unsubscribe") {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${PUSH_TABLE}?endpoint=eq.${encodeURIComponent(endpoint)}`,
        { method: "DELETE", headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
      );
      ok = res.ok;
      if (!ok) console.error("push unsubscribe failed", res.status, await res.text());
    } else if (typeof body?.p256dh === "string" && typeof body?.auth === "string") {
      // The same phone re-subscribing keeps one row: the endpoint is unique.
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${PUSH_TABLE}?on_conflict=endpoint`, {
        method: "POST",
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          endpoint,
          p256dh: body.p256dh,
          auth: body.auth,
          user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400) || null,
        }),
      });
      ok = res.ok;
      if (!ok) console.error("push subscribe failed", res.status, await res.text());
    }
  }

  return new Response(JSON.stringify(ok ? { ok: true } : { error: "That did not work." }), {
    status: ok ? 200 : 400,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "POST") {
    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
      return await handlePushJson(req);
    }
    const form = await req.formData().catch(() => null);
    if (!form) return loginPage("Something went wrong. Please try again.");
    const action = form.get("action");

    if (action === "logout") return withCookie(loginPage(), "", 0);

    if (action === "settings") {
      if (!await sessionIsValid(readCookie(req, SESSION_COOKIE))) return loginPage();
      const field = (name: string) => String(form.get(name) ?? "").trim();
      const port = Number(field("smtp_port"));
      const saved = await saveSettings("notify", {
        provider: field("provider"),
        api_key: field("api_key"),
        from: field("from"),
        extra_to: field("extra_to"),
        confirm_registrant: form.get("confirm_registrant") !== null,
        smtp: {
          host: field("smtp_host"),
          port: Number.isFinite(port) && port > 0 ? port : 465,
          user: field("smtp_user"),
          pass: field("smtp_pass"),
        },
      });
      return await submissionsPage(
        saved
          ? "Alert settings saved. Open Settings again and tap Send test email to check them."
          : "Those settings could not be saved. Please try again.",
      );
    }

    if (action === "delete") {
      // Deleting is only ever reachable with a live session. SameSite=Lax on the
      // cookie keeps a cross-site form from posting here on someone's behalf.
      if (!await sessionIsValid(readCookie(req, SESSION_COOKIE))) return loginPage();
      const name = await deleteRegistration(String(form.get("id") ?? ""));
      return await submissionsPage(
        name
          ? `Deleted the submission from ${name}.`
          : "That submission could not be deleted. It may already be gone.",
      );
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

  // Renewing on every visit is what keeps a signed in phone signed in: the
  // year only ever starts counting from the last time the page was opened.
  if (await sessionIsValid(readCookie(req, SESSION_COOKIE))) {
    return withCookie(await submissionsPage(), await issueSession(), SESSION_SECONDS);
  }
  return loginPage();
});
