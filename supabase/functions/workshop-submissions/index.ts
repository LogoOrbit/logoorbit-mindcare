// Password-protected viewer for everything the website collects, served at
// /submissions: workshop and course registrations, and the consultation,
// appointment and question forms on /contact.
//
// GET  -> login screen (or the submissions, if a valid session cookie is present)
// POST -> login, logout, deleting one submission, or saving the alert settings
//
// The page is built for a phone first. Each submission is one calm card that
// shows who it is and what they wanted; everything else opens on a tap. The
// destructive and technical bits (delete, provider keys) live one level in, so
// the surface anybody sees at a glance is just names, times and buttons that
// call, message or email the person.
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

// What each form is called on a card.
const KIND_LABELS: Record<string, string> = {
  "workshop": "Registration",
  "consultation": "Free consultation",
  "appointment": "Appointment",
  "question": "Question",
  "workshop-request": "Workshop request",
};

// The same names on the filter row, where they count things.
const KIND_PLURAL: Record<string, string> = {
  "workshop": "Registrations",
  "consultation": "Consultations",
  "appointment": "Appointments",
  "question": "Questions",
  "workshop-request": "Workshop requests",
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

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Pakistan Standard Time is UTC+5 year round, so a fixed offset is exact.
function pkt(iso: string): Date {
  return new Date(new Date(iso).getTime() + 5 * 60 * 60 * 1000);
}

/** 6:08 am, rather than 06:08. Nobody reads a phone in 24-hour time. */
function clock(d: Date): string {
  let h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, "0");
  const ap = h < 12 ? "am" : "pm";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${ap}`;
}

/** The full stamp, used where the exact moment matters (details, CSV). */
function formatWhen(iso: string): string {
  const d = pkt(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${clock(d)} PKT`;
}

/** The short stamp on a card. The year is dropped when it is this one. */
function shortWhen(iso: string): string {
  const d = pkt(iso);
  const now = pkt(new Date().toISOString());
  const year = d.getUTCFullYear() === now.getUTCFullYear() ? "" : ` ${d.getUTCFullYear()}`;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${year}, ${clock(d)}`;
}

/** Two letters for the avatar. First and last name where there are two. */
function initials(name: string): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** A stable colour per person, so the same name always looks the same. */
function tone(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 6;
}

/** The first line of something long, for the front of a card. */
function excerpt(text: string, max = 120): string {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

/** wa.me wants digits only, and a local 03xx number needs the country code. */
function waNumber(phone: string): string {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `92${digits.slice(1)}`;
  return digits;
}

const icon = (body: string) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const I = {
  search: icon('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>'),
  close: icon('<path d="M18 6 6 18M6 6l12 12"/>'),
  chevron: icon('<path d="m9 6 6 6-6 6"/>'),
  phone: icon(
    '<path d="M6.6 3h3l1.5 4-2 1.4a12 12 0 0 0 5.5 5.5l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.2 2 2 0 0 1 6.6 3Z"/>',
  ),
  mail: icon('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7.5 7.1 5a1.6 1.6 0 0 0 1.8 0l7.1-5"/>'),
  receipt: icon(
    '<path d="M6 3h9l4 4v13a1 1 0 0 1-1.5.9L15 20l-2.5 1.4a1 1 0 0 1-1 0L9 20l-2.5 1.4A1 1 0 0 1 5 20.5V4a1 1 0 0 1 1-1Z"/><path d="M9 9h6M9 13h4"/>',
  ),
  trash: icon('<path d="M4 7h16M9.5 7V4.8A.8.8 0 0 1 10.3 4h3.4a.8.8 0 0 1 .8.8V7"/><path d="M6.5 7 7.6 20h8.8L17.5 7"/><path d="M10.5 11v5M13.5 11v5"/>'),
  gear: icon('<path d="M4 7h9M17.5 7H20M4 17h2.5M11 17h9"/><circle cx="15" cy="7" r="2.4"/><circle cx="8.5" cy="17" r="2.4"/>'),
  download: icon('<path d="M12 4v11M8 11.5l4 4 4-4"/><path d="M5 19h14"/>'),
  refresh: icon('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20 4v4.5h-4.5"/>'),
  logout: icon('<path d="M15 5V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1"/><path d="M11 12h10M18 9l3 3-3 3"/>'),
  bell: icon('<path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z"/><path d="M10 18.5a2 2 0 0 0 4 0"/>'),
  sun: icon('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/>'),
  moon: icon('<path d="M20 14.2A8.4 8.4 0 0 1 9.8 4 8.5 8.5 0 1 0 20 14.2Z"/>'),
  dots: icon('<circle cx="12" cy="5.5" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="18.5" r="1.4" fill="currentColor"/>'),
  inbox: icon('<path d="M3.5 13.5 5.8 6a2 2 0 0 1 1.9-1.4h8.6A2 2 0 0 1 18.2 6l2.3 7.5"/><path d="M3.5 13.5h4l1.2 2.4h6.6l1.2-2.4h4v4a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/>'),
  eye: icon('<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>'),
  alert: icon('<path d="M12 4.5 21 20H3l9-15.5Z"/><path d="M12 10v4.2M12 17.2h.01"/>'),
  wa:
    '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.14-.14.3-.35.44-.53.15-.17.2-.3.3-.5.1-.19.05-.37-.02-.52-.08-.14-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.42.25-.69.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35M12.05 21.78h-.01a9.87 9.87 0 0 1-5.03-1.37l-.36-.22-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26C2.16 6.44 6.6 2.01 12.05 2.01c2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.43 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.15 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45c6.55 0 11.89-5.34 11.89-11.9a11.82 11.82 0 0 0-3.48-8.41Z"/></svg>',
};

const PAGE_CSS = `
:root{
 --bg:#f2f6f5;--bg-2:#e7efec;--surface:#ffffff;--surface-2:#f2f6f5;--surface-3:#e9f1ee;
 --ink:#0d1f18;--ink-2:#33463d;--muted:#647a70;--line:#e1eae6;--line-2:#d3e0da;
 --brand:#0F9AA8;--brand-2:#2BBDC9;--brand-ink:#0a7a86;--brand-soft:rgba(43,189,201,.12);
 --good:#2c7a3f;--good-soft:#e7f4e9;--warn:#a35a09;--warn-soft:#fdf1e2;--danger:#c2413f;--danger-soft:#fdeceb;
 --wa:#128C7E;
 --r-lg:20px;--r-md:14px;--r-sm:11px;
 --sh-1:0 1px 2px rgba(9,40,34,.05),0 10px 24px -18px rgba(9,40,34,.5);
 --sh-2:0 10px 34px -12px rgba(9,40,34,.28),0 2px 8px -4px rgba(9,40,34,.14);
 --ease:cubic-bezier(.22,.61,.36,1);--fast:.15s;--mid:.26s;--slow:.4s;
 --safe-t:env(safe-area-inset-top,0px);--safe-b:env(safe-area-inset-bottom,0px);
}
html[data-theme="dark"]{
 --bg:#0a1411;--bg-2:#0f1d18;--surface:#111f1a;--surface-2:#16271f;--surface-3:#1c3227;
 --ink:#e9f2ee;--ink-2:#c6d6ce;--muted:#8fa79c;--line:#1f352a;--line-2:#284336;
 --brand:#3ecbd6;--brand-2:#2BBDC9;--brand-ink:#5fdbe4;--brand-soft:rgba(62,203,214,.14);
 --good:#7fdd97;--good-soft:#15291b;--warn:#e5b071;--warn-soft:#2b2013;--danger:#f08c8a;--danger-soft:#33191a;
 --wa:#5fe0a8;
 --sh-1:0 1px 2px rgba(0,0,0,.3),0 10px 26px -20px #000;
 --sh-2:0 14px 40px -14px rgba(0,0,0,.7),0 2px 8px -4px rgba(0,0,0,.5);
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);
 font-family:"DM Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",sans-serif;
 font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
 overflow-wrap:break-word;-webkit-tap-highlight-color:transparent;min-height:100%}
h1,h2,h3,p,dl,dd{margin:0}
a{color:var(--brand-ink);text-decoration:none}
a:hover{text-decoration:underline}
button,input,select,textarea{font:inherit;color:inherit}
:focus-visible{outline:2.5px solid var(--brand-2);outline-offset:2px;border-radius:6px}
::selection{background:var(--brand-soft)}
.sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}

/* ---------- shell ---------- */
.wrap{max-width:1160px;margin:0 auto;padding:0 14px calc(64px + var(--safe-b))}
.bar{position:sticky;top:0;z-index:40;background:var(--bg);
 background:color-mix(in srgb,var(--bg) 86%,transparent);
 -webkit-backdrop-filter:saturate(1.6) blur(16px);backdrop-filter:saturate(1.6) blur(16px);
 padding-top:var(--safe-t);border-bottom:1px solid transparent;
 transition:transform var(--mid) var(--ease),border-color var(--mid),box-shadow var(--mid)}
.bar.stuck{border-bottom-color:var(--line);box-shadow:0 10px 26px -22px rgba(9,40,34,.9)}
/* Reading a long list gets the whole screen: the toolbar slides out of the way
   on the way down and comes straight back the moment you scroll up. */
.bar.away{transform:translateY(-101%)}
.bar-in{max-width:1160px;margin:0 auto;padding:11px 14px 12px;display:flex;flex-wrap:wrap;align-items:center;gap:11px 12px}
.mark{order:1;width:38px;height:38px;flex:none;border-radius:12px;background:#fff;padding:3px;border:1px solid var(--line);box-shadow:var(--sh-1)}
.bar-id{order:2;flex:1;min-width:0}
.bar-id h1{font-size:1.12rem;font-weight:700;letter-spacing:-.02em;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar-id h1 b{color:var(--brand-ink);font-weight:700}
.bar-id p{font-size:.78rem;color:var(--muted);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar-actions{order:3;display:flex;align-items:center;gap:6px;position:relative;flex:none}

.iconbtn{display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;flex:none;
 border-radius:13px;border:1px solid transparent;background:transparent;color:var(--ink-2);cursor:pointer;padding:0;
 transition:background var(--fast) var(--ease),color var(--fast),transform var(--fast) var(--ease)}
.iconbtn svg{width:20px;height:20px}
.iconbtn:hover{background:var(--surface-3);color:var(--ink)}
.iconbtn:active{transform:scale(.92)}
.iconbtn.on{color:var(--brand-ink);background:var(--brand-soft)}
html[data-theme="dark"] .theme-btn .moon,html[data-theme="light"] .theme-btn .sun{display:none}

.bar-search{order:4;flex:1 1 100%;min-width:0}
.field{position:relative;display:flex;align-items:center}
.field>svg{position:absolute;left:15px;width:19px;height:19px;color:var(--muted);pointer-events:none}
.search{width:100%;height:48px;padding:0 46px 0 44px;border:1px solid var(--line);border-radius:15px;
 background:var(--surface);color:var(--ink);font-size:.95rem;box-shadow:var(--sh-1);
 transition:border-color var(--fast),box-shadow var(--fast)}
.search::placeholder{color:var(--muted)}
.search:focus{outline:none;border-color:var(--brand-2);box-shadow:0 0 0 4px var(--brand-soft)}
.search::-webkit-search-cancel-button{display:none}
.clearq{position:absolute;right:5px;width:38px;height:38px;border-radius:11px;border:0;background:transparent;
 color:var(--muted);cursor:pointer;display:none;align-items:center;justify-content:center}
.clearq svg{width:17px;height:17px}
.clearq.show{display:flex}
.clearq:hover{background:var(--surface-3);color:var(--ink)}

/* ---------- menu ---------- */
.menu{position:absolute;top:calc(100% + 8px);right:0;width:252px;z-index:60;padding:7px;
 background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--sh-2);
 opacity:0;transform:translateY(-8px) scale(.97);transform-origin:top right;pointer-events:none;visibility:hidden;
 transition:opacity var(--fast) var(--ease),transform var(--fast) var(--ease),visibility var(--fast)}
.menu.on{opacity:1;transform:none;pointer-events:auto;visibility:visible}
.mi{display:flex;align-items:center;gap:11px;width:100%;min-height:46px;padding:10px 12px;border:0;border-radius:13px;
 background:transparent;color:var(--ink);font-size:.92rem;font-weight:600;text-align:left;cursor:pointer;
 text-decoration:none;transition:background var(--fast)}
.mi:hover{background:var(--surface-2);text-decoration:none}
.mi svg{width:19px;height:19px;flex:none;color:var(--muted)}
.mi:hover svg{color:var(--brand-ink)}
.mi span{flex:1;min-width:0}
.mi small{display:block;font-size:.75rem;font-weight:500;color:var(--muted);line-height:1.3}
.mi.danger{color:var(--danger)}
.mi.danger svg,.mi.danger:hover svg{color:var(--danger)}
.mi.danger:hover{background:var(--danger-soft)}
.menu form{margin:0}
.menu hr{border:0;border-top:1px solid var(--line);margin:6px 8px}

/* ---------- filters ---------- */
.chips{display:flex;gap:8px;overflow-x:auto;padding:2px 14px 14px;margin:0 auto;max-width:1160px;
 scrollbar-width:none;-ms-overflow-style:none;scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.chips::-webkit-scrollbar{display:none}
.chip{display:inline-flex;align-items:center;gap:7px;flex:none;min-height:40px;padding:8px 15px;scroll-snap-align:start;
 border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--ink-2);
 font-size:.87rem;font-weight:600;cursor:pointer;white-space:nowrap;
 transition:background var(--fast) var(--ease),color var(--fast),border-color var(--fast),transform var(--fast) var(--ease)}
.chip:active{transform:scale(.96)}
.chip b{font-weight:700;font-size:.78rem;padding:1px 8px;border-radius:999px;background:var(--surface-3);color:var(--muted)}
.chip.on{background:var(--brand);border-color:var(--brand);color:#fff}
html[data-theme="dark"] .chip.on{color:#06201f}
.chip.on b{background:rgba(255,255,255,.24);color:inherit}

/* ---------- banners ---------- */
.banner{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border-radius:var(--r-lg);margin-bottom:14px;
 background:var(--warn-soft);border:1px solid color-mix(in srgb,var(--warn) 26%,transparent);color:var(--ink);
 font-size:.89rem;line-height:1.5;animation:rise var(--slow) var(--ease) both}
.banner svg{width:20px;height:20px;flex:none;color:var(--warn);margin-top:1px}
.banner-body{flex:1;min-width:0}
.banner strong{display:block;margin-bottom:2px;font-size:.94rem}
.banner .linkbtn{margin-top:10px}
.linkbtn{display:inline-flex;align-items:center;gap:7px;min-height:38px;padding:8px 14px;border-radius:11px;
 border:1px solid var(--line-2);background:var(--surface);color:var(--ink);font-size:.85rem;font-weight:600;cursor:pointer;
 transition:transform var(--fast) var(--ease),border-color var(--fast)}
.linkbtn:hover{border-color:var(--brand-2);text-decoration:none}
.linkbtn:active{transform:scale(.97)}

/* ---------- cards ---------- */
/* min() so a narrow phone gets one full-width column instead of a 330px one it
   has to scroll to, and min-width:0 so a very long name cannot widen the track. */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(330px,100%),1fr));gap:13px;align-items:start}
.sub{min-width:0;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);box-shadow:var(--sh-1);
 padding:6px 6px 14px;animation:rise var(--slow) var(--ease) both;animation-delay:calc(var(--i,0) * 28ms);
 transition:box-shadow var(--mid) var(--ease),border-color var(--mid),transform var(--mid) var(--ease)}
@media(hover:hover){.sub:hover{box-shadow:var(--sh-2);border-color:var(--line-2)}}
.sub.open{box-shadow:var(--sh-2);border-color:var(--line-2)}
.sub.going{opacity:0;transform:scale(.96);transition:opacity .2s ease,transform .2s ease}
@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}

.sub-head{display:flex;align-items:center;gap:12px;width:100%;padding:12px 10px;border:0;border-radius:15px;
 background:transparent;text-align:left;cursor:pointer;transition:background var(--fast)}
.sub-head:hover{background:var(--surface-2)}
.sub-head:active{background:var(--surface-3)}
.ava{display:flex;align-items:center;justify-content:center;width:44px;height:44px;flex:none;border-radius:14px;
 font-size:.94rem;font-weight:700;letter-spacing:.01em}
.ava[data-t="0"]{background:#d9f0f3;color:#0a6f7a}
.ava[data-t="1"]{background:#e2eedd;color:#3f6b31}
.ava[data-t="2"]{background:#f2e6da;color:#8a5a26}
.ava[data-t="3"]{background:#e6e4f5;color:#514a94}
.ava[data-t="4"]{background:#f7e2e6;color:#96435a}
.ava[data-t="5"]{background:#dde9f6;color:#2f5d8f}
html[data-theme="dark"] .ava[data-t="0"]{background:#0e3a3f;color:#7fdfe8}
html[data-theme="dark"] .ava[data-t="1"]{background:#1c3418;color:#a8dd97}
html[data-theme="dark"] .ava[data-t="2"]{background:#3a2b17;color:#e6bb84}
html[data-theme="dark"] .ava[data-t="3"]{background:#252248;color:#b3addf}
html[data-theme="dark"] .ava[data-t="4"]{background:#3d1f27;color:#eaa6b6}
html[data-theme="dark"] .ava[data-t="5"]{background:#17304a;color:#9cc4ea}
.sub-id{flex:1;min-width:0}
.sub-name{display:block;font-size:1.03rem;font-weight:700;letter-spacing:-.01em;line-height:1.3;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sub-meta{display:block;font-size:.79rem;color:var(--muted);margin-top:1px;
 white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chev{flex:none;color:var(--muted);display:flex;transition:transform var(--mid) var(--ease),color var(--fast)}
.chev svg{width:19px;height:19px}
.sub.open .chev{transform:rotate(90deg);color:var(--brand-ink)}

.sub-body{padding:0 12px}
.pills{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:9px}
.pill{display:inline-flex;align-items:center;gap:5px;font-size:.75rem;font-weight:700;border-radius:999px;padding:5px 11px;
 border:1px solid transparent;letter-spacing:.01em}
.pill-paid{color:var(--good);background:var(--good-soft);border-color:color-mix(in srgb,var(--good) 26%,transparent)}
.pill-plain{color:var(--muted);background:var(--surface-2);border-color:var(--line)}
.pill-kind{color:var(--brand-ink);background:var(--brand-soft);border-color:color-mix(in srgb,var(--brand-2) 30%,transparent)}
.pill-warn{color:var(--danger);background:var(--danger-soft);border-color:color-mix(in srgb,var(--danger) 30%,transparent)}
.subject{font-size:.93rem;color:var(--ink-2);line-height:1.45}
.amount{display:block;margin-top:7px;font-size:1.02rem;font-weight:700;letter-spacing:-.01em;color:var(--good)}

.qa{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
.qbtn{display:inline-flex;align-items:center;gap:7px;min-height:40px;padding:9px 14px;border-radius:12px;
 border:1px solid var(--line);background:var(--surface-2);color:var(--ink);font-size:.85rem;font-weight:600;cursor:pointer;
 transition:transform var(--fast) var(--ease),border-color var(--fast),background var(--fast)}
.qbtn:hover{border-color:var(--line-2);background:var(--surface-3);text-decoration:none}
.qbtn:active{transform:scale(.96)}
.qbtn svg{width:16px;height:16px;flex:none}
.qbtn-wa svg{color:var(--wa)}
.qbtn-r{border-color:color-mix(in srgb,var(--brand-2) 40%,transparent);background:var(--brand-soft);color:var(--brand-ink)}
.qbtn-r:hover{background:color-mix(in srgb,var(--brand-2) 20%,transparent);border-color:var(--brand-2)}

.more{display:grid;grid-template-rows:0fr;transition:grid-template-rows var(--mid) var(--ease)}
.sub.open .more{grid-template-rows:1fr}
.more-in{overflow:hidden;min-height:0}
.rows{margin-top:14px}
.row{padding:10px 0;border-top:1px solid var(--line)}
.rk{display:block;font-size:.73rem;font-weight:600;color:var(--muted);margin-bottom:2px}
.rv{font-size:.93rem;line-height:1.5}
/* A phone number worth tapping needs to be worth tapping with a thumb. The
   padding does that without inline-flex, which would stop a long address wrapping. */
.rv a{display:inline-block;padding:9px 0;overflow-wrap:anywhere}
.rv.note{white-space:pre-wrap;color:var(--ink-2)}
.rec-hint{display:block;margin-top:7px;font-size:.75rem;color:var(--muted)}
.del{display:inline-flex;align-items:center;gap:8px;min-height:42px;margin-top:12px;padding:10px 14px;border-radius:12px;
 border:1px solid transparent;background:transparent;color:var(--danger);font-size:.86rem;font-weight:600;cursor:pointer;
 transition:background var(--fast),border-color var(--fast),transform var(--fast) var(--ease)}
.del:hover{background:var(--danger-soft);border-color:color-mix(in srgb,var(--danger) 26%,transparent)}
.del:active{transform:scale(.97)}
.del svg{width:16px;height:16px}
.sub form{margin:0}

/* ---------- empty ---------- */
.blank{text-align:center;padding:60px 22px;background:var(--surface);border:1px solid var(--line);
 border-radius:var(--r-lg);box-shadow:var(--sh-1)}
.blank svg{width:44px;height:44px;color:var(--brand-2);margin-bottom:12px}
.blank h2{font-size:1.05rem;font-weight:700;margin-bottom:6px}
.blank p{color:var(--muted);font-size:.9rem;max-width:38ch;margin:0 auto;line-height:1.55}
.blank[hidden]{display:none}

/* ---------- overlays ---------- */
.scrim{position:fixed;inset:0;z-index:70;display:flex;align-items:center;justify-content:center;padding:18px;
 background:rgba(5,18,14,.5);-webkit-backdrop-filter:blur(5px);backdrop-filter:blur(5px);
 opacity:0;transition:opacity var(--mid) var(--ease);overflow-y:auto;overscroll-behavior:contain}
.scrim.on{opacity:1}
.scrim[hidden]{display:none}
.modal{width:100%;max-width:470px;margin:auto;background:var(--surface);border:1px solid var(--line);
 border-radius:24px;box-shadow:var(--sh-2);padding:22px;
 transform:translateY(16px) scale(.985);opacity:0;transition:transform var(--mid) var(--ease),opacity var(--mid) var(--ease)}
.scrim.on .modal{transform:none;opacity:1}
.modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:4px}
.modal-head h2{font-size:1.12rem;font-weight:700;letter-spacing:-.01em}
.lede{color:var(--muted);font-size:.88rem;line-height:1.55;margin-bottom:18px}
.modal label{display:block;font-size:.78rem;font-weight:600;color:var(--ink-2);margin:0 0 6px}
.modal input[type=text],.modal input[type=password],.modal input:not([type]),.modal select{
 width:100%;height:46px;padding:0 14px;border:1px solid var(--line);border-radius:13px;background:var(--surface-2);
 color:var(--ink);margin-bottom:15px;font-size:.94rem;transition:border-color var(--fast),box-shadow var(--fast),background var(--fast)}
.modal select{padding-right:38px;-webkit-appearance:none;appearance:none;
 background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23647a70' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
 background-repeat:no-repeat;background-position:right 13px center;background-size:17px}
.modal input:focus,.modal select:focus{outline:none;border-color:var(--brand-2);background:var(--surface);box-shadow:0 0 0 4px var(--brand-soft)}
.hint{color:var(--muted);font-size:.79rem;line-height:1.5;margin:-9px 0 15px}
.fold{border:1px solid var(--line);border-radius:14px;padding:13px 15px;margin-bottom:15px;background:var(--surface-2)}
.fold summary{cursor:pointer;font-size:.88rem;font-weight:600;list-style:none}
.fold summary::-webkit-details-marker{display:none}
.fold summary::after{content:"+";float:right;color:var(--muted);font-weight:700}
.fold[open] summary::after{content:"–"}
.fold>*:not(summary){margin-top:13px}
.check{display:flex;align-items:center;gap:11px;font-size:.9rem;font-weight:500;color:var(--ink);margin-bottom:18px;cursor:pointer}
.check input{width:20px;height:20px;margin:0;flex:none;accent-color:var(--brand)}
.acts{display:flex;gap:9px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;flex:1;min-width:130px;min-height:48px;
 padding:12px 18px;border-radius:14px;border:1px solid var(--line-2);background:var(--surface);color:var(--ink);
 font-size:.92rem;font-weight:700;cursor:pointer;
 transition:transform var(--fast) var(--ease),background var(--fast),border-color var(--fast),box-shadow var(--fast)}
.btn:hover{border-color:var(--brand-2);text-decoration:none}
.btn:active{transform:scale(.98)}
.btn[disabled]{opacity:.55;cursor:default}
.btn-primary{background:var(--brand);border-color:var(--brand);color:#fff;box-shadow:0 8px 20px -12px var(--brand)}
html[data-theme="dark"] .btn-primary{color:#06201f}
.btn-primary:hover{background:var(--brand-ink);border-color:var(--brand-ink)}
.btn-danger{background:var(--danger);border-color:var(--danger);color:#fff}
html[data-theme="dark"] .btn-danger{color:#2a0f10}
.result{margin-top:14px;padding:11px 14px;border-radius:12px;font-size:.87rem;line-height:1.5;
 background:var(--good-soft);color:var(--good)}
.result[hidden]{display:none}
.result.bad{background:var(--danger-soft);color:var(--danger)}

/* ---------- toasts + new pill ---------- */
.toasts{position:fixed;left:0;right:0;bottom:calc(18px + var(--safe-b));z-index:90;display:flex;flex-direction:column;
 align-items:center;gap:8px;padding:0 14px;pointer-events:none}
.toast{max-width:min(94vw,430px);padding:13px 20px;border-radius:999px;background:var(--ink);color:var(--bg);
 font-size:.89rem;font-weight:600;text-align:center;box-shadow:var(--sh-2);animation:toastin .3s var(--ease) both}
.toast.out{animation:toastout .25s var(--ease) both}
@keyframes toastin{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}
@keyframes toastout{to{opacity:0;transform:translateY(10px) scale(.97)}}
.newpill{position:fixed;left:50%;top:calc(var(--safe-t) + 74px);z-index:50;transform:translate(-50%,-14px);
 display:inline-flex;align-items:center;gap:8px;padding:10px 18px;border-radius:999px;border:1px solid var(--brand);
 background:var(--brand);color:#fff;font-size:.86rem;font-weight:700;cursor:pointer;box-shadow:var(--sh-2);
 opacity:0;pointer-events:none;visibility:hidden;
 transition:opacity var(--mid) var(--ease),transform var(--mid) var(--ease),visibility var(--mid)}
html[data-theme="dark"] .newpill{color:#06201f}
.newpill.on{opacity:1;transform:translate(-50%,0);pointer-events:auto;visibility:visible}

/* ---------- login ---------- */
.login-page{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px 18px;position:relative;overflow:hidden}
.login-page::before,.login-page::after{content:"";position:absolute;border-radius:50%;filter:blur(70px);opacity:.5;pointer-events:none}
.login-page::before{width:340px;height:340px;background:var(--brand-2);top:-120px;right:-90px}
.login-page::after{width:300px;height:300px;background:#8fd8b0;bottom:-110px;left:-90px;opacity:.35}
html[data-theme="dark"] .login-page::before{opacity:.2}
html[data-theme="dark"] .login-page::after{opacity:.14}
.login{position:relative;width:100%;max-width:400px;background:var(--surface);border:1px solid var(--line);
 border-radius:26px;box-shadow:var(--sh-2);padding:30px 26px;animation:rise .45s var(--ease) both}
.login img{display:block;max-width:190px;height:auto;margin:0 auto 18px}
/* The wordmark is dark green: on a dark card it needs its own light plate. */
html[data-theme="dark"] .login img{background:#fff;border-radius:14px;padding:9px 13px;max-width:210px}
.login h1{font-size:1.3rem;font-weight:700;letter-spacing:-.02em;text-align:center}
.login .lede{text-align:center;margin-bottom:22px}
.login label{display:block;font-size:.78rem;font-weight:600;color:var(--ink-2);margin-bottom:6px}
.login input{width:100%;height:50px;padding:0 14px;border:1px solid var(--line);border-radius:14px;
 background:var(--surface-2);color:var(--ink);margin-bottom:16px;font-size:1rem;
 transition:border-color var(--fast),box-shadow var(--fast),background var(--fast)}
.login input:focus{outline:none;border-color:var(--brand-2);background:var(--surface);box-shadow:0 0 0 4px var(--brand-soft)}
.pw{position:relative}
.pw input{padding-right:50px}
.peek{position:absolute;right:6px;top:6px;width:38px;height:38px;border:0;border-radius:11px;background:transparent;
 color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center}
.peek svg{width:18px;height:18px}
.peek:hover{background:var(--surface-3);color:var(--ink)}
.login .btn{width:100%;flex:none}
.err{display:flex;gap:9px;align-items:flex-start;background:var(--danger-soft);color:var(--danger);
 border:1px solid color-mix(in srgb,var(--danger) 28%,transparent);border-radius:13px;padding:11px 14px;
 font-size:.86rem;font-weight:600;margin-bottom:16px;animation:shake .4s var(--ease)}
.err svg{width:18px;height:18px;flex:none;margin-top:1px}
@keyframes shake{10%,90%{transform:translateX(-2px)}30%,70%{transform:translateX(3px)}50%{transform:translateX(-3px)}}

/* ---------- responsive ---------- */
/* Wide enough for one row: the search moves up beside the title. */
@media(min-width:900px){
 .bar-in{flex-wrap:nowrap;padding:14px;gap:14px}
 .mark{width:44px;height:44px}
 .bar-id{flex:0 1 auto}
 .bar-id h1{font-size:1.28rem}
 .bar-search{order:3;flex:1 1 auto;max-width:430px;margin-left:auto}
 .bar-actions{order:4}
}
/* A very narrow phone keeps the mark, not the full title. */
@media(max-width:379px){.hide-tiny{display:none}.bar-in{gap:9px 10px;padding:10px 12px 11px}}
@media(max-width:640px){
 .grid{grid-template-columns:1fr;gap:12px}
 .scrim{align-items:flex-end;padding:0}
 .modal{max-width:none;border-radius:26px 26px 0 0;padding:22px 18px calc(24px + var(--safe-b));
  transform:translateY(100%);max-height:92dvh;overflow-y:auto}
 .toasts{bottom:calc(14px + var(--safe-b))}
}
@media(prefers-reduced-motion:reduce){
 *,*::before,*::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;
  transition-duration:.001ms !important;scroll-behavior:auto !important}
}
`;

function shell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow, noarchive">
<meta name="color-scheme" content="light dark">
<script>(function(){try{var s=localStorage.getItem('mc-theme');
if(s!=='dark'&&s!=='light'){s=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
document.documentElement.setAttribute('data-theme',s);}catch(e){}})();</script>
<title>${esc(title)}</title>
<link rel="icon" href="/assets/icons/icon-192.png" type="image/png">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png">
<link rel="manifest" href="/submissions.webmanifest">
<meta name="theme-color" content="#f2f6f5" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0a1411" media="(prefers-color-scheme: dark)">
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
    `<div class="login-page">
  <form class="login" method="POST" action="">
    <img src="/mindcare.png" alt="MindCare Services" width="190" height="76">
    <h1>Submissions</h1>
    <p class="lede">Everything people send from the website. Staff only.</p>
    ${error ? `<div class="err">${I.alert}<span>${esc(error)}</span></div>` : ""}
    <label for="id">ID</label>
    <input id="id" name="id" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus>
    <label for="password">Password</label>
    <div class="pw">
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button class="peek" type="button" id="peek" aria-label="Show password">${I.eye}</button>
    </div>
    <button class="btn btn-primary" type="submit">Sign in</button>
  </form>
</div>
<script>
(function(){
  var peek = document.getElementById('peek');
  var pw = document.getElementById('password');
  if (peek && pw) peek.addEventListener('click', function(){
    var show = pw.type === 'password';
    pw.type = show ? 'text' : 'password';
    peek.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    pw.focus();
  });
})();
</script>`,
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
      // apikey as well as the bearer token: the newer Supabase keys are not
      // JWTs, and Storage rejects a bearer token it cannot parse as one.
      method: "DELETE",
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!dropped.ok) console.error("receipt delete failed", dropped.status, await dropped.text());
  }
  return row.name;
}

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
      `<div class="wrap"><div class="blank">${I.alert}<h2>We could not load the submissions</h2>
       <p>Nothing has been lost. Please pull down to refresh in a moment.</p></div></div>`,
      502,
    );
  }

  const rows = await res.json() as Registration[];
  const links = await signedReceiptUrls(
    rows.map((r) => r.receipt_path).filter((p): p is string => !!p),
  );

  const cards = rows.map((r, index) => {
    const kind = KIND_LABELS[r.kind] ? r.kind : "workshop";
    const isWorkshop = kind === "workshop";
    const name = String(r.name ?? "").trim() || "Someone";

    // The workshop field is one long line: subject, then the fee parts, then a
    // total. Split it so a card can show the course name and the amount, and
    // keep the arithmetic for the details.
    const bits = String(r.workshop ?? "").split("·").map((s) => s.trim()).filter(Boolean);
    const subject = bits[0] ?? "";
    const totalBit = bits.find((b) => /^total\b/i.test(b)) ?? "";
    const total = totalBit.replace(/^total[\s:·-]*/i, "");
    const breakdown = bits.slice(1).filter((b) => b !== totalBit).join(" · ");
    // For a registration the course is the story. For everything else the form
    // name is already on the card, so what they actually want is: the service
    // they asked about, or the first line of what they wrote.
    const headline = isWorkshop ? subject : (r.service || excerpt(r.message) || subject);

    // Only a registration carries a badge: what was paid. Which form the rest
    // came from is already on the line under the name, so a pill repeating it
    // would be noise. That leaves a badge here meaning "look at this".
    const pills: string[] = [];
    if (isWorkshop) {
      if (r.receipt_path) {
        pills.push(`<span class="pill pill-paid">Paid</span>`);
        if (r.certificate) pills.push(`<span class="pill pill-plain">Certificate</span>`);
      } else {
        pills.push(`<span class="pill pill-plain">Free seat</span>`);
        if (r.certificate) pills.push(`<span class="pill pill-plain">Certificate ${CERT_FEE}</span>`);
      }
    }
    // An alert that did not go out is worth knowing about here rather than in
    // the function logs, because this page is the only other copy.
    if (r.notify_status && r.notify_status !== "sent") {
      pills.push(`<span class="pill pill-warn" title="${esc(r.notify_status)}">Email alert failed</span>`);
    }

    const link = r.receipt_path ? links[r.receipt_path] : undefined;
    const quick: string[] = [];
    if (r.phone) {
      quick.push(
        `<a class="qbtn" href="tel:${esc(r.phone.replace(/[^\d+]/g, ""))}">${I.phone}Call</a>`,
      );
      const wa = waNumber(r.phone);
      if (wa.length >= 10) {
        quick.push(
          `<a class="qbtn qbtn-wa" href="https://wa.me/${esc(wa)}" target="_blank" rel="noopener">${I.wa}WhatsApp</a>`,
        );
      }
    }
    if (r.email) quick.push(`<a class="qbtn" href="mailto:${esc(r.email)}">${I.mail}Email</a>`);
    if (link) {
      quick.push(
        `<a class="qbtn qbtn-r" href="${esc(link)}" target="_blank" rel="noopener">${I.receipt}Receipt</a>`,
      );
    }

    const row = (label: string, value: string, cls = "", href?: string) =>
      value
        ? `<div class="row"><span class="rk">${label}</span><div class="rv${cls}">${
          href ? `<a href="${esc(href)}">${esc(value)}</a>` : esc(value)
        }</div></div>`
        : "";
    const slot = [r.preferred_date, r.preferred_time].filter(Boolean).join(" at ");
    const details = [
      row("Phone", r.phone, "", r.phone ? `tel:${r.phone.replace(/[^\d+]/g, "")}` : undefined),
      row("Email", r.email, "", r.email ? `mailto:${r.email}` : undefined),
      row("Service", r.service),
      row("Preferred time", slot),
      row("Institute", r.institute),
      row("Studying", r.education),
      row("What they wrote", r.message, " note"),
      row("What they already know", r.prior_info, " note"),
      row("What they are hoping for", r.expectations, " note"),
      row("Fees", breakdown),
      row("Received", formatWhen(r.created_at)),
      !link && r.receipt_path
        ? `<div class="row"><span class="rk">Receipt</span><div class="rv">${
          esc(r.receipt_name || "Could not be opened just now")
        }</div></div>`
        : "",
      link ? `<div class="row"><span class="rk">Receipt</span><div class="rv"><a href="${esc(link)}" target="_blank" rel="noopener">Open the receipt</a><span class="rec-hint">This link works for one hour.</span></div></div>` : "",
    ].join("");

    return `<article class="sub" data-row data-kind="${esc(kind)}" data-id="${esc(r.id)}" data-name="${esc(name)}" style="--i:${
      Math.min(index, 14)
    }">
      <button class="sub-head" type="button" aria-expanded="false" data-toggle>
        <span class="ava" data-t="${tone(name)}" aria-hidden="true">${esc(initials(name))}</span>
        <span class="sub-id">
          <span class="sub-name">${esc(name)}</span>
          <span class="sub-meta"><span data-ts="${esc(r.created_at)}">${esc(shortWhen(r.created_at))}</span> &middot; ${
      esc(KIND_LABELS[kind])
    }</span>
        </span>
        <span class="chev">${I.chevron}</span>
      </button>
      <div class="sub-body">
        ${pills.length ? `<div class="pills">${pills.join("")}</div>` : ""}
        ${headline ? `<p class="subject">${esc(headline)}</p>` : ""}
        ${total ? `<span class="amount">${esc(total)}</span>` : ""}
        ${quick.length ? `<div class="qa">${quick.join("")}</div>` : ""}
        <div class="more">
          <div class="more-in">
            <div class="rows">${details}</div>
            <form method="POST" action="" data-delete>
              <input type="hidden" name="action" value="delete">
              <input type="hidden" name="id" value="${esc(r.id)}">
              <button class="del" type="submit">${I.trash}Delete this submission</button>
            </form>
          </div>
        </div>
      </div>
    </article>`;
  }).join("");

  const counts: Record<string, number> = {};
  for (const r of rows) {
    const kind = KIND_LABELS[r.kind] ? r.kind : "workshop";
    counts[kind] = (counts[kind] ?? 0) + 1;
  }
  const chips = [
    `<button class="chip on" type="button" data-filter="">All <b>${rows.length}</b></button>`,
  ].concat(
    Object.keys(KIND_LABELS).filter((k) => counts[k]).map((k) =>
      `<button class="chip" type="button" data-filter="${esc(k)}">${esc(KIND_PLURAL[k])} <b>${counts[k]}</b></button>`
    ),
  ).join("");

  const csvData = rows.map((r) => ({
    i: r.id,
    c: [
      formatWhen(r.created_at),
      KIND_LABELS[r.kind] ?? r.kind,
      r.workshop,
      r.name,
      r.phone,
      r.email,
      r.service,
      [r.preferred_date, r.preferred_time].filter(Boolean).join(" "),
      r.message,
      r.institute,
      r.education,
      r.prior_info,
      r.expectations,
      r.certificate ? "Yes" : "No",
      r.receipt_path ? (r.receipt_name ?? r.receipt_path) : "",
      r.notify_status || (r.notified_at ? "sent" : ""),
    ],
  }));

  // Anything crossing into a <script> is JSON-encoded with "<" neutered too, so
  // a name someone typed into a form can never close the tag early.
  const inScript = (value: unknown) => JSON.stringify(value ?? "").replace(/</g, "\\u003c");

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

  const banner = !configured
    ? `<div class="banner">${I.alert}<div class="banner-body"><strong>Email alerts are not switched on</strong>
       <p>Everything below is saved safely, but none of it has been emailed to you yet.</p>
       <button class="linkbtn" type="button" data-open-settings>${I.gear}Set up email alerts</button></div></div>`
    : failed
    ? `<div class="banner">${I.alert}<div class="banner-body"><strong>${failed} alert email${
      failed === 1 ? "" : "s"
    } did not go out</strong>
       <p>The submissions themselves are safe. Check the email provider and send yourself a test.</p>
       <button class="linkbtn" type="button" data-open-settings>${I.gear}Check email settings</button></div></div>`
    : "";

  const list = rows.length
    ? `<div class="grid" id="grid">${cards}</div>
       <div class="blank" id="noresults" hidden>${I.search}<h2>Nothing matches that</h2>
         <p>Try a shorter search, or tap <strong>All</strong> above to see everything again.</p></div>`
    : `<div class="blank">${I.inbox}<h2>Nothing here yet</h2>
       <p>Registrations, consultation and appointment requests and messages from the website
          all land here the moment someone sends them.</p></div>`;

  const body = `<header class="bar" id="bar">
  <div class="bar-in">
    <img class="mark" src="/assets/icons/icon-192.png" alt="" width="44" height="44">
    <div class="bar-id">
      <h1>MIND<b>CARE</b><span class="hide-tiny"> Submissions</span></h1>
      <p><span id="total">${rows.length}</span> in total &middot; newest first</p>
    </div>
    <div class="bar-actions">
      <button class="iconbtn theme-btn" id="themeBtn" type="button" aria-label="Switch between light and dark">
        <span class="sun">${I.sun}</span><span class="moon">${I.moon}</span>
      </button>
      <button class="iconbtn" id="menuBtn" type="button" aria-label="More" aria-haspopup="true" aria-expanded="false">${I.dots}</button>
      <div class="menu" id="menu" role="menu">
        <button class="mi" type="button" id="alerts" role="menuitem" hidden>${I.bell}<span>Phone alerts<small id="alertsState">Off</small></span></button>
        <button class="mi" type="button" data-open-settings role="menuitem">${I.gear}<span>Email settings</span></button>
        <button class="mi" type="button" id="csv" role="menuitem">${I.download}<span>Download as spreadsheet</span></button>
        <a class="mi" href="" role="menuitem">${I.refresh}<span>Refresh</span></a>
        <hr>
        <form method="POST" action="">
          <input type="hidden" name="action" value="logout">
          <button class="mi danger" type="submit" role="menuitem">${I.logout}<span>Sign out</span></button>
        </form>
      </div>
    </div>
    ${
    rows.length
      ? `<div class="bar-search">
      <div class="field">
        ${I.search}
        <input class="search" id="q" type="search" placeholder="Search a name, email or course" autocomplete="off"
               aria-label="Search submissions">
        <button class="clearq" id="clearq" type="button" aria-label="Clear the search">${I.close}</button>
      </div>
    </div>`
      : ""
  }
  </div>
  ${rows.length ? `<div class="chips" id="chips">${chips}</div>` : ""}
</header>

<main class="wrap">
  ${banner}
  ${list}
</main>

<button class="newpill" id="newpill" type="button">${I.bell} New submission &middot; tap to refresh</button>
<div class="toasts" id="toasts" aria-live="polite"></div>

<div class="scrim" id="settings" hidden>
  <form class="modal" method="POST" action="" id="settingsForm">
    <input type="hidden" name="action" value="settings">
    <div class="modal-head">
      <h2>Email settings</h2>
      <button class="iconbtn" type="button" data-close aria-label="Close">${I.close}</button>
    </div>
    <p class="lede">Every submission is emailed to <strong>${esc(ALWAYS_NOTIFY)}</strong>, always.
      Add a provider below so those emails can actually be sent, then send yourself a test.</p>

    <label for="s-extra">Also email these addresses</label>
    <input id="s-extra" name="extra_to" value="${value(notify.extra_to)}"
           placeholder="info@themindcareservices.com, someone@else.com" autocapitalize="none" spellcheck="false">

    <label for="s-provider">Provider</label>
    <select id="s-provider" name="provider">
      ${
    [["", "Work it out from the key"], ["emailbump", "Email Bump"], ["resend", "Resend"], ["brevo", "Brevo"], [
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
    <p class="hint">Leave this empty to use the provider's shared address. Once themindcareservices.com is
      verified with the provider, put an address on it here: a borrowed sender is the main reason alerts
      land in spam.</p>

    <details class="fold"${smtp.host ? " open" : ""}>
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

    <label class="check">
      <input type="checkbox" name="confirm_registrant" value="1"${notify.confirm_registrant === false ? "" : " checked"}>
      Also send the person a short confirmation
    </label>

    <div class="acts">
      <button class="btn" type="button" id="testBtn">Send test email</button>
      <button class="btn btn-primary" type="submit">Save</button>
    </div>
    <p class="result" id="testResult" hidden></p>
  </form>
</div>

<div class="scrim" id="confirm" hidden>
  <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle">
    <div class="modal-head"><h2 id="confirmTitle">Delete this submission?</h2></div>
    <p class="lede" id="confirmText">The details and any uploaded receipt are removed for good.</p>
    <div class="acts">
      <button class="btn" type="button" data-close>Keep it</button>
      <button class="btn btn-danger" type="button" id="confirmYes">Delete</button>
    </div>
  </div>
</div>

<script id="rowdata" type="application/json">${inScript(csvData)}</script>
<script>
(function(){
  var doc = document;
  var $ = function(id){ return doc.getElementById(id); };

  /* ---------- toasts ---------- */
  var toasts = $('toasts');
  function toast(text){
    if (!toasts) return;
    var el = doc.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    toasts.appendChild(el);
    setTimeout(function(){
      el.className = 'toast out';
      setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }, 3200);
  }
  ${notice ? `toast(${inScript(notice)});` : ""}

  /* ---------- the toolbar gets out of the way ---------- */
  var bar = $('bar');
  var ticking = false;
  var lastY = 0;
  function onScroll(){
    if (ticking || !bar) return;
    ticking = true;
    requestAnimationFrame(function(){
      var y = window.scrollY;
      bar.classList.toggle('stuck', y > 4);
      // Never hide it while something is open on top of it.
      var busy = openScrim || (menu && menu.classList.contains('on'));
      if (!busy) {
        if (y > lastY + 3 && y > 220) bar.classList.add('away');
        else if (y < lastY - 3 || y <= 4) bar.classList.remove('away');
      }
      lastY = y;
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- friendlier times ---------- */
  Array.prototype.forEach.call(doc.querySelectorAll('[data-ts]'), function(el){
    var then = new Date(el.getAttribute('data-ts')).getTime();
    if (!then) return;
    var mins = Math.round((Date.now() - then) / 60000);
    if (mins < 1) el.textContent = 'Just now';
    else if (mins < 60) el.textContent = mins + (mins === 1 ? ' minute ago' : ' minutes ago');
    else if (mins < 1440) { var h = Math.round(mins / 60); el.textContent = h + (h === 1 ? ' hour ago' : ' hours ago'); }
    else if (mins < 10080) { var d = Math.round(mins / 1440); el.textContent = d === 1 ? 'Yesterday' : d + ' days ago'; }
  });

  /* ---------- expand a card ---------- */
  Array.prototype.forEach.call(doc.querySelectorAll('[data-toggle]'), function(btn){
    btn.addEventListener('click', function(){
      var card = btn.closest('.sub');
      var open = card.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });

  /* ---------- search + filter ---------- */
  var q = $('q');
  var clearq = $('clearq');
  var grid = $('grid');
  var none = $('noresults');
  var kind = '';

  function refilter(){
    if (!grid) return;
    var needle = q ? q.value.trim().toLowerCase() : '';
    var shown = 0;
    Array.prototype.forEach.call(grid.querySelectorAll('[data-row]'), function(card){
      var hit = (!needle || card.textContent.toLowerCase().indexOf(needle) !== -1) &&
                (!kind || card.getAttribute('data-kind') === kind);
      card.style.display = hit ? '' : 'none';
      if (hit) shown++;
    });
    if (none) none.hidden = shown !== 0;
    if (clearq) clearq.classList.toggle('show', !!needle);
  }
  if (q) {
    q.addEventListener('input', refilter);
    q.addEventListener('keydown', function(e){ if (e.key === 'Escape') { q.value = ''; refilter(); } });
  }
  if (clearq) clearq.addEventListener('click', function(){ if (q) { q.value = ''; q.focus(); } refilter(); });

  var chips = doc.querySelectorAll('.chip');
  Array.prototype.forEach.call(chips, function(chip){
    chip.addEventListener('click', function(){
      kind = chip.getAttribute('data-filter') || '';
      Array.prototype.forEach.call(chips, function(c){ c.classList.toggle('on', c === chip); });
      chip.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      refilter();
    });
  });

  /* keeps the counts honest after something is deleted */
  function recount(){
    if (!grid) return 0;
    var all = grid.querySelectorAll('[data-row]');
    var by = {};
    Array.prototype.forEach.call(all, function(card){
      var k = card.getAttribute('data-kind');
      by[k] = (by[k] || 0) + 1;
    });
    var totalEl = $('total');
    if (totalEl) totalEl.textContent = all.length;
    Array.prototype.forEach.call(chips, function(chip){
      var f = chip.getAttribute('data-filter');
      var n = f ? (by[f] || 0) : all.length;
      var b = chip.querySelector('b');
      if (b) b.textContent = n;
      if (f) chip.hidden = n === 0;
    });
    return all.length;
  }

  /* ---------- overlays ---------- */
  var openScrim = null;
  function show(el){
    if (!el) return;
    el.hidden = false;
    openScrim = el;
    requestAnimationFrame(function(){ el.classList.add('on'); });
    doc.body.style.overflow = 'hidden';
  }
  function hide(el){
    if (!el) return;
    el.classList.remove('on');
    doc.body.style.overflow = '';
    if (openScrim === el) openScrim = null;
    setTimeout(function(){ if (!el.classList.contains('on')) el.hidden = true; }, 280);
  }
  Array.prototype.forEach.call(doc.querySelectorAll('.scrim'), function(scrim){
    scrim.addEventListener('click', function(e){ if (e.target === scrim) hide(scrim); });
  });
  Array.prototype.forEach.call(doc.querySelectorAll('[data-close]'), function(btn){
    btn.addEventListener('click', function(){ hide(btn.closest('.scrim')); });
  });

  /* ---------- the menu ---------- */
  var menu = $('menu');
  var menuBtn = $('menuBtn');
  function closeMenu(){
    if (!menu) return;
    menu.classList.remove('on');
    if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
  }
  if (menuBtn && menu) {
    menuBtn.addEventListener('click', function(e){
      e.stopPropagation();
      var on = menu.classList.toggle('on');
      menuBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    });
    doc.addEventListener('click', function(e){
      if (menu.classList.contains('on') && !menu.contains(e.target)) closeMenu();
    });
  }
  doc.addEventListener('keydown', function(e){
    if (e.key !== 'Escape') return;
    closeMenu();
    if (openScrim) hide(openScrim);
  });

  var settings = $('settings');
  Array.prototype.forEach.call(doc.querySelectorAll('[data-open-settings]'), function(btn){
    btn.addEventListener('click', function(){ closeMenu(); show(settings); });
  });

  /* ---------- saving the settings, without a full reload ---------- */
  var settingsForm = $('settingsForm');
  if (settingsForm) settingsForm.addEventListener('submit', function(e){
    if (!window.fetch || !window.FormData) return;
    e.preventDefault();
    var save = settingsForm.querySelector('button[type=submit]');
    if (save) { save.disabled = true; save.textContent = 'Saving...'; }
    fetch('', { method: 'POST', body: new FormData(settingsForm), credentials: 'same-origin' })
      .then(function(res){
        if (!res.ok) throw new Error('save failed');
        hide(settings);
        toast('Email settings saved.');
      })
      .catch(function(){ toast('Those settings could not be saved. Please try again.'); })
      .then(function(){ if (save) { save.disabled = false; save.textContent = 'Save'; } });
  });

  var testBtn = $('testBtn');
  var testOut = $('testResult');
  if (testBtn && testOut) testBtn.addEventListener('click', function(){
    testBtn.disabled = true;
    testOut.hidden = false;
    testOut.className = 'result';
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
          testOut.className = 'result bad';
          testOut.textContent = data.error || 'The test email could not be sent.';
        }
      });
    }).catch(function(){
      testOut.className = 'result bad';
      testOut.textContent = 'The test email could not be sent. Please try again.';
    }).then(function(){ testBtn.disabled = false; });
  });

  /* ---------- deleting, with our own confirmation ---------- */
  var confirmBox = $('confirm');
  var confirmYes = $('confirmYes');
  var confirmText = $('confirmText');
  var pending = null;

  Array.prototype.forEach.call(doc.querySelectorAll('[data-delete]'), function(form){
    form.addEventListener('submit', function(e){
      if (!window.fetch || !confirmBox) return;   // no JS help: the plain form still works
      e.preventDefault();
      pending = form;
      var card = form.closest('.sub');
      var who = card ? card.getAttribute('data-name') : '';
      if (confirmText) {
        confirmText.textContent = (who ? 'The details ' + who + ' sent' : 'These details') +
          ', and any receipt they uploaded, are removed for good. This cannot be undone.';
      }
      show(confirmBox);
    });
  });

  if (confirmYes) confirmYes.addEventListener('click', function(){
    if (!pending) return;
    var form = pending;
    pending = null;
    var card = form.closest('.sub');
    var id = card ? card.getAttribute('data-id') : '';
    var who = card ? card.getAttribute('data-name') : '';
    confirmYes.disabled = true;
    fetch('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id: id }),
      credentials: 'same-origin'
    }).then(function(res){
      return res.json().catch(function(){ return {}; }).then(function(data){
        if (!res.ok || !data.ok) throw new Error('delete failed');
        hide(confirmBox);
        if (card) {
          card.classList.add('going');
          setTimeout(function(){
            if (card.parentNode) card.parentNode.removeChild(card);
            if (recount() === 0) window.location.reload();
            refilter();
          }, 210);
        }
        toast(who ? 'Deleted the submission from ' + who + '.' : 'Submission deleted.');
      });
    }).catch(function(){
      hide(confirmBox);
      toast('That could not be deleted. Please refresh and try again.');
    }).then(function(){ confirmYes.disabled = false; });
  });

  /* ---------- theme ---------- */
  var themeBtn = $('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', function(){
    var d = doc.documentElement;
    var t = d.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    d.setAttribute('data-theme', t);
    try { localStorage.setItem('mc-theme', t); } catch (e) {}
  });

  /* ---------- spreadsheet ---------- */
  var csvBtn = $('csv');
  if (csvBtn) csvBtn.addEventListener('click', function(){
    closeMenu();
    var head = ['Received','Type','Course / subject','Name','Phone','Email','Service','Preferred time',
                'Message','Institute','Studying','Prior knowledge','Expectations','Certificate',
                'Receipt','Email alert'];
    var here = {};
    Array.prototype.forEach.call(doc.querySelectorAll('[data-row]'), function(c){ here[c.getAttribute('data-id')] = 1; });
    var stored = JSON.parse($('rowdata').textContent);
    var body = [];
    for (var i = 0; i < stored.length; i++) if (here[stored[i].i]) body.push(stored[i].c);
    var csv = [head].concat(body).map(function(r){
      return r.map(function(c){ return '"' + String(c == null ? '' : c).replace(/"/g,'""') + '"'; }).join(',');
    }).join('\\r\\n');
    var url = URL.createObjectURL(new Blob(['\\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
    var a = doc.createElement('a');
    a.href = url; a.download = 'mindcare-submissions.csv';
    doc.body.appendChild(a); a.click(); doc.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Spreadsheet downloaded.');
  });

  /* ---------- a quiet nudge when something new arrives ---------- */
  var newpill = $('newpill');
  var firstCard = grid ? grid.querySelector('[data-row]') : null;
  var newestId = firstCard ? firstCard.getAttribute('data-id') : '';
  if (newpill && window.fetch) {
    newpill.addEventListener('click', function(){ window.location.reload(); });
    setInterval(function(){
      if (doc.hidden || newpill.classList.contains('on')) return;
      fetch('?latest=1', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } })
        .then(function(res){ return res.ok ? res.json() : null; })
        .then(function(data){
          if (data && data.tag && data.tag !== newestId) newpill.classList.add('on');
        }).catch(function(){});
    }, 45000);
  }

  /* ---------- phone alerts ---------- */
  // The service worker lives at the site root so it keeps working when the
  // dashboard is installed to the home screen, which is what Chrome on Android
  // and Safari on iOS need before a push can arrive at all.
  var alerts = $('alerts');
  var alertsState = $('alertsState');
  var VAPID = ${inScript(vapidPublic)};
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
      if (alertsState) alertsState.textContent = busy ? 'Working...' : (on ? 'On for this phone' : 'Off');
      alerts.classList.toggle('on', !!on && !busy);
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
          }).then(function () { paint(false); toast('Phone alerts turned off.'); });
        }
        return Notification.requestPermission().then(function (permission) {
          if (permission !== 'granted') {
            paint(false);
            toast('Notifications are blocked for this site. Allow them in your browser settings, then try again.');
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
              toast('Phone alerts are on for this phone.');
            });
          });
        });
      }).catch(function (err) {
        console.error(err);
        paint(false);
        toast('We could not turn alerts on just now. Please try again.');
      });
    });
  }
})();
</script>`;

  return htmlResponse(body);
}

/**
 * What the newest submission is, in one line, for the phone notification.
 *
 * The service worker calls this when a push arrives: the push carries no
 * payload, so the name and the kind are fetched from here over the staff
 * session instead of travelling through Google's push service. A signed-out
 * phone gets a 401 and shows its generic notification.
 */
async function latestJson(req: Request): Promise<Response> {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (!await sessionIsValid(readCookie(req, SESSION_COOKIE))) {
    return new Response(JSON.stringify({ error: "Please sign in again." }), { status: 401, headers });
  }
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${TABLE}?select=id,kind,name,workshop,service&order=created_at.desc&limit=1`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } },
  );
  if (!res.ok) {
    console.error("latest lookup failed", res.status, await res.text());
    return new Response(JSON.stringify({ error: "unavailable" }), { status: 502, headers });
  }
  const [row] = await res.json() as Array<
    { id: string; kind: string; name: string; workshop: string; service: string }
  >;
  if (!row) return new Response(JSON.stringify({ error: "empty" }), { status: 404, headers });

  // The subject line matters more than the form name on a lock screen, so the
  // service is preferred where there is one and the workshop name otherwise.
  const detail = row.service || row.workshop;
  return new Response(
    JSON.stringify({
      title: `New ${(KIND_LABELS[row.kind] ?? "submission").toLowerCase()}: ${row.name}`,
      body: detail ? `${detail}. Tap to open the dashboard.` : "Tap to open the dashboard.",
      tag: row.id,
    }),
    { headers },
  );
}

function withCookie(res: Response, value: string, maxAge: number): Response {
  const headers = new Headers(res.headers);
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`,
  );
  return new Response(res.body, { status: res.status, headers });
}

/**
 * The page's own background calls: storing (or dropping) one phone's push
 * subscription, and deleting one submission without a full page reload. Both
 * do exactly what the plain form posts below do; only the reply differs.
 * Session required.
 */
async function handleJsonPost(req: Request): Promise<Response> {
  const headers = { "Content-Type": "application/json", "Cache-Control": "no-store" };
  if (!await sessionIsValid(readCookie(req, SESSION_COOKIE))) {
    return new Response(JSON.stringify({ error: "Please sign in again." }), { status: 401, headers });
  }

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action;

  if (action === "delete") {
    const name = await deleteRegistration(String(body?.id ?? ""));
    return new Response(
      JSON.stringify(name ? { ok: true, name } : { error: "That submission could not be deleted." }),
      { status: name ? 200 : 400, headers },
    );
  }

  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
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
    headers,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "POST") {
    if ((req.headers.get("content-type") ?? "").includes("application/json")) {
      return await handleJsonPost(req);
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
          ? "Email settings saved. Open them again and tap Send test email to check them."
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

  // Answered before the session is renewed below: this is the service worker
  // asking what to put on a notification, not somebody opening the page.
  if (new URL(req.url).searchParams.has("latest")) return await latestJson(req);

  // Renewing on every visit is what keeps a signed in phone signed in: the
  // year only ever starts counting from the last time the page was opened.
  if (await sessionIsValid(readCookie(req, SESSION_COOKIE))) {
    return withCookie(await submissionsPage(), await issueSession(), SESSION_SECONDS);
  }
  return loginPage();
});
