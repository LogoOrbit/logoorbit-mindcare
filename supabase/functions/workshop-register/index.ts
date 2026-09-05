// Submission intake for themindcareservices.com.
//
// Every form on the website posts here: workshop and course registrations, the
// consultation and appointment requests and the general question box on
// /contact, and the "request a workshop" topic box on the home page. `kind`
// says which one, and one row per submission lands in
// `mindcare_workshop_registrations`, which the password-protected
// `workshop-submissions` function reads back at /submissions.
//
// Paid registrations also carry a base64 payment receipt. `paid` is what makes
// a receipt compulsory: the Montessori Teacher Training Course charges a
// registration fee, so every one of its registrations carries a receipt, while
// `certificate` stays a plain record of whether the optional certificate add-on
// was bought. A free workshop and every contact form send neither.
//
// Whatever the kind, the team is emailed and every subscribed phone is rung.
// The email never fails silently any more: the outcome is written back onto the
// row and shown on the dashboard.
//
// Deployed with verify_jwt = false because this is a public website form. The
// service role key never leaves Supabase: it is injected by the edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "mindcare-receipts";
const TABLE = "mindcare_workshop_registrations";
const SETTINGS_TABLE = "mindcare_settings";
const PUSH_TABLE = "mindcare_push_subscriptions";
const MAX_BYTES = 8 * 1024 * 1024;
const SITE = "https://themindcareservices.com";

// Every submission is emailed here. This address is hard-coded on purpose, so
// no missing or mistyped setting can ever silence the alerts; configuration
// only ever adds further recipients.
const ALWAYS_NOTIFY = "shaistatariq2002@gmail.com";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

// What each form is called in the subject line and on the dashboard.
const KINDS: Record<string, string> = {
  "workshop": "registration",
  "consultation": "free consultation request",
  "appointment": "appointment request",
  "question": "message",
  "workshop-request": "workshop request",
};

const env = (name: string) => (Deno.env.get(name) ?? "").trim();

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
// Notification config lives in `mindcare_settings`, which is service-role only,
// so the team can set the email provider from the /submissions dashboard on a
// phone instead of going near the Supabase console. Function secrets still work
// and win over the stored value, so an existing deployment keeps its behaviour.

type NotifySettings = {
  provider: string;
  api_key: string;
  from: string;
  extra_to: string;
  confirm_registrant: boolean;
  smtp: { host?: string; port?: number; user?: string; pass?: string };
};

type PushSettings = {
  vapid_public: string;
  vapid_private: string;
  vapid_subject: string;
};

let settingsCache: { at: number; rows: Record<string, Record<string, unknown>> } | null = null;

async function loadSettings(): Promise<Record<string, Record<string, unknown>>> {
  // One read per isolate per minute. A settings change shows up on the next
  // submission rather than instantly, which is the right trade for not adding a
  // database round trip to every request.
  if (settingsCache && Date.now() - settingsCache.at < 60_000) return settingsCache.rows;
  const rows: Record<string, Record<string, unknown>> = {};
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${SETTINGS_TABLE}?select=key,value`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (res.ok) {
      for (const row of await res.json() as Array<{ key: string; value: Record<string, unknown> }>) {
        rows[row.key] = row.value ?? {};
      }
    } else {
      console.error("loading settings failed", res.status, await res.text());
    }
  } catch (err) {
    console.error("loading settings threw", err);
  }
  settingsCache = { at: Date.now(), rows };
  return rows;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function notifySettings(): Promise<NotifySettings> {
  const stored = (await loadSettings()).notify ?? {};
  const smtp = (stored.smtp ?? {}) as Record<string, unknown>;
  return {
    // A function secret always wins, so nothing about the existing deployment
    // changes when it already has one set.
    provider: env("EMAIL_PROVIDER") || str(stored.provider),
    api_key: env("RESEND_API_KEY") || env("EMAIL_API_KEY") || str(stored.api_key),
    from: env("NOTIFY_FROM") || str(stored.from),
    extra_to: env("NOTIFY_TO") || str(stored.extra_to),
    confirm_registrant: stored.confirm_registrant !== false,
    smtp: {
      host: env("SMTP_HOST") || str(smtp.host),
      port: Number(env("SMTP_PORT") || smtp.port || 465) || 465,
      user: env("SMTP_USER") || str(smtp.user),
      pass: env("SMTP_PASS") || str(smtp.pass),
    },
  };
}

async function pushSettings(): Promise<PushSettings> {
  const stored = (await loadSettings()).push ?? {};
  return {
    vapid_public: str(stored.vapid_public),
    vapid_private: env("VAPID_PRIVATE_KEY") || str(stored.vapid_private),
    vapid_subject: env("VAPID_SUBJECT") || str(stored.vapid_subject) ||
      "mailto:info@themindcareservices.com",
  };
}

/** Where the alerts go: the owner always, plus anyone configured on top. */
export function recipients(extra: string): string[] {
  return [...new Set([
    ALWAYS_NOTIFY,
    ...extra.split(/[,;\s]+/).map((a) => a.trim()).filter((a) => a.includes("@")),
  ])];
}

/**
 * Picks the provider to send through. Explicit configuration wins; otherwise it
 * is inferred from whichever credential exists, so setting one field is enough.
 */
export function resolveProvider(s: NotifySettings): string {
  const named = s.provider.toLowerCase();
  if (named) return named;
  if (s.smtp.host && s.smtp.user && s.smtp.pass) return "smtp";
  if (!s.api_key) return "";
  if (s.api_key.startsWith("ebk_")) return "emailbump";
  if (s.api_key.startsWith("SG.")) return "sendgrid";
  if (s.api_key.startsWith("xkeysib-")) return "brevo";
  return "resend";
}

// Each provider's shared sender, used until a domain of our own is verified
// with them. Mail from one of these still arrives; it just says the platform's
// name rather than ours, which is why the settings sheet pushes for a real one.
const SHARED_SENDERS: Record<string, string> = {
  emailbump: "MindCare Website <noreply@viaemailbump.com>",
  resend: "MindCare Website <onboarding@resend.dev>",
};

/**
 * The From address. A verified domain of your own is what keeps these out of
 * spam; the provider's shared sender is the fallback so alerts still arrive
 * before the domain is verified.
 */
function sender(s: NotifySettings, provider: string): string {
  if (s.from) return s.from;
  if (provider === "smtp" && s.smtp.user) return `MindCare Website <${s.smtp.user}>`;
  return SHARED_SENDERS[provider] ?? SHARED_SENDERS.resend;
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

type Mail = {
  to: string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  reference: string;
};

function splitAddress(value: string): { name: string; email: string } {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (match) return { name: match[1].replace(/^"|"$/g, ""), email: match[2].trim() };
  return { name: "", email: value.trim() };
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<{ ok: boolean; status: number; detail: string }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const detail = res.ok ? "" : (await res.text()).slice(0, 400);
  return { ok: res.ok, status: res.status, detail };
}

/**
 * Hands one message to whichever provider is configured. Every provider gets
 * both a plain-text and an HTML part and a Reply-To, because a message with no
 * text alternative is one of the cheapest ways to score as spam.
 */
async function deliver(
  s: NotifySettings,
  provider: string,
  from: string,
  mail: Mail,
): Promise<{ ok: boolean; status: number; detail: string }> {
  const fromParts = splitAddress(from);

  if (provider === "emailbump") {
    // Email Bump meters and tracks each send separately, so `to` is one address
    // and the team's copies go out as one call each. A single refusal is
    // reported rather than swallowed, but the other recipients still get theirs.
    let failure: { ok: boolean; status: number; detail: string } | null = null;
    for (const address of mail.to) {
      const res = await postJson("https://emailbump.com/api/v1/emails", {
        Authorization: `Bearer ${s.api_key}`,
      }, {
        from,
        to: address,
        reply_to: mail.replyTo || undefined,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      });
      if (!res.ok && !failure) failure = res;
    }
    return failure ?? { ok: true, status: 200, detail: "" };
  }

  if (provider === "resend") {
    return await postJson("https://api.resend.com/emails", {
      Authorization: `Bearer ${s.api_key}`,
    }, {
      from,
      to: mail.to,
      reply_to: mail.replyTo || undefined,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
      // A distinct reference per message stops Gmail collapsing separate
      // registrations into one thread and trimming the details away.
      headers: { "X-Entity-Ref-ID": mail.reference },
    });
  }

  if (provider === "brevo") {
    return await postJson("https://api.brevo.com/v3/smtp/email", {
      "api-key": s.api_key,
    }, {
      sender: { email: fromParts.email, name: fromParts.name || "MindCare Website" },
      to: mail.to.map((email) => ({ email })),
      replyTo: mail.replyTo ? { email: mail.replyTo } : undefined,
      subject: mail.subject,
      htmlContent: mail.html,
      textContent: mail.text,
    });
  }

  if (provider === "sendgrid") {
    return await postJson("https://api.sendgrid.com/v3/mail/send", {
      Authorization: `Bearer ${s.api_key}`,
    }, {
      personalizations: [{ to: mail.to.map((email) => ({ email })) }],
      from: { email: fromParts.email, name: fromParts.name || "MindCare Website" },
      reply_to: mail.replyTo ? { email: mail.replyTo } : undefined,
      subject: mail.subject,
      content: [
        { type: "text/plain", value: mail.text },
        { type: "text/html", value: mail.html },
      ],
    });
  }

  if (provider === "smtp") {
    // Imported here rather than at the top so a provider nobody uses can never
    // hold up the rest of the function.
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
    const client = new SMTPClient({
      connection: {
        hostname: s.smtp.host!,
        port: s.smtp.port ?? 465,
        tls: (s.smtp.port ?? 465) === 465,
        auth: { username: s.smtp.user!, password: s.smtp.pass! },
      },
    });
    try {
      await client.send({
        from,
        to: mail.to,
        replyTo: mail.replyTo || undefined,
        subject: mail.subject,
        content: mail.text,
        html: mail.html,
      });
      return { ok: true, status: 250, detail: "" };
    } finally {
      await client.close().catch(() => {});
    }
  }

  return {
    ok: false,
    status: 0,
    detail: "No email provider is configured. Open /submissions, tap Settings and add one.",
  };
}

/**
 * Sends one message, retrying once on the failures that are worth retrying
 * (rate limits and provider outages). A bad key or a rejected sender fails
 * immediately: retrying those only delays the error the team needs to see.
 */
async function sendMail(mail: Mail): Promise<{ ok: boolean; detail: string }> {
  const s = await notifySettings();
  const provider = resolveProvider(s);
  if (!provider || (provider !== "smtp" && !s.api_key)) {
    const detail = "No email provider is configured. Open /submissions, tap Settings and add one.";
    console.error("email skipped:", detail);
    return { ok: false, detail };
  }
  const from = sender(s, provider);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await deliver(s, provider, from, mail);
      if (res.ok) return { ok: true, detail: "" };
      const worthRetrying = res.status === 429 || res.status >= 500;
      console.error("email failed", provider, res.status, res.detail);
      if (!worthRetrying || attempt === 1) {
        return { ok: false, detail: `${provider} ${res.status}: ${res.detail}`.slice(0, 300) };
      }
      await new Promise((r) => setTimeout(r, 900));
    } catch (err) {
      console.error("email threw", provider, err);
      if (attempt === 1) return { ok: false, detail: `${provider}: ${String(err)}`.slice(0, 300) };
      await new Promise((r) => setTimeout(r, 900));
    }
  }
  return { ok: false, detail: "unreachable" };
}

// ---------------------------------------------------------------------------
// Web Push
// ---------------------------------------------------------------------------

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Signs a VAPID token for one push service origin. The notification itself is
 * sent without a payload, which keeps the submission's details off Google's
 * servers and means no message encryption is needed here.
 */
async function vapidHeader(audience: string, keys: PushSettings): Promise<string | null> {
  if (!keys.vapid_private || !keys.vapid_public) return null;
  const raw = atob(keys.vapid_public.replace(/-/g, "+").replace(/_/g, "/"));
  const pub = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: keys.vapid_private,
      x: b64url(pub.slice(1, 33)),
      y: b64url(pub.slice(33, 65)),
      ext: true,
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const enc = (obj: unknown) => b64url(new TextEncoder().encode(JSON.stringify(obj)));
  const signingInput = `${enc({ typ: "JWT", alg: "ES256" })}.${
    enc({
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
      sub: keys.vapid_subject,
    })
  }`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `vapid t=${signingInput}.${b64url(new Uint8Array(signature))}, k=${keys.vapid_public}`;
}

/**
 * Rings every subscribed phone. Failures are logged and swallowed for the same
 * reason as the email: an alert is never worth losing a submission over.
 * Subscriptions the push service has retired (404/410) are dropped so the list
 * does not fill up with dead phones.
 */
async function notifyPhones(): Promise<void> {
  const keys = await pushSettings();
  if (!keys.vapid_private) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${PUSH_TABLE}?select=id,endpoint`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    if (!res.ok) {
      console.error("loading push subscriptions failed", res.status, await res.text());
      return;
    }
    const subs = await res.json() as Array<{ id: string; endpoint: string }>;

    await Promise.all(subs.map(async (sub) => {
      try {
        const auth = await vapidHeader(new URL(sub.endpoint).origin, keys);
        if (!auth) return;
        const sent = await fetch(sub.endpoint, {
          method: "POST",
          headers: { Authorization: auth, TTL: "86400" },
        });
        if (sent.status === 404 || sent.status === 410) {
          await fetch(`${SUPABASE_URL}/rest/v1/${PUSH_TABLE}?id=eq.${sub.id}`, {
            method: "DELETE",
            headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
          });
        } else if (!sent.ok) {
          console.error("push failed", sent.status, await sent.text());
        }
      } catch (err) {
        console.error("push threw", err);
      }
    }));
  } catch (err) {
    console.error("push notification threw", err);
  }
}

// ---------------------------------------------------------------------------
// Composing the alert
// ---------------------------------------------------------------------------

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function decodeBase64(raw: string): Uint8Array {
  const comma = raw.indexOf(",");
  const b64 = raw.startsWith("data:") && comma !== -1 ? raw.slice(comma + 1) : raw;
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

type Field = [string, string];

function teamEmail(heading: string, subtitle: string, fields: Field[]): { html: string; text: string } {
  const rows = fields
    .filter(([, value]) => value)
    .map(([label, value]) =>
      `<tr><td style="padding:7px 14px 7px 0;color:#5b6b63;font-size:13px;vertical-align:top;white-space:nowrap">${
        escapeHtml(label)
      }</td><td style="padding:7px 0;font-size:14px;color:#12241a">${
        escapeHtml(value).replace(/\n/g, "<br>")
      }</td></tr>`
    ).join("");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#12241a">
  <h2 style="margin:0 0 4px;font-size:18px">${escapeHtml(heading)}</h2>
  <p style="margin:0 0 16px;font-size:13px;color:#5b6b63">${escapeHtml(subtitle)}</p>
  <table style="border-collapse:collapse;width:100%">${rows}</table>
  <p style="margin:18px 0 0;font-size:13px">
    <a href="${SITE}/submissions" style="color:#0F9AA8">Open all submissions</a>
  </p>
</div>`;

  const text = [
    heading,
    subtitle,
    "",
    ...fields.filter(([, v]) => v).map(([label, value]) => `${label}: ${value}`),
    "",
    `All submissions: ${SITE}/submissions`,
  ].join("\n");

  return { html, text };
}

function registrantEmail(name: string, what: string): { html: string; text: string } {
  const greeting = name ? `Hello ${name},` : "Hello,";
  const body =
    `We have received your ${what} and someone from the MindCare Services team will be in touch shortly.`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;color:#12241a">
  <p style="font-size:15px;margin:0 0 12px">${escapeHtml(greeting)}</p>
  <p style="font-size:15px;line-height:1.55;margin:0 0 12px">${escapeHtml(body)}</p>
  <p style="font-size:15px;line-height:1.55;margin:0 0 18px">If it is urgent, call
    <a href="tel:+923272337631" style="color:#0F9AA8">+92 327 2337631</a> or message us on WhatsApp.</p>
  <p style="font-size:13px;color:#5b6b63;margin:0">MindCare Services&reg; &middot; Karachi, Pakistan<br>
    <a href="${SITE}" style="color:#0F9AA8">themindcareservices.com</a></p>
</div>`;
  const text = [
    greeting,
    "",
    body,
    "",
    "If it is urgent, call +92 327 2337631 or message us on WhatsApp.",
    "",
    "MindCare Services, Karachi, Pakistan",
    SITE,
  ].join("\n");
  return { html, text };
}

/** Writes the outcome of the alert back onto the row it belongs to. */
async function recordNotifyStatus(id: string, status: string): Promise<void> {
  if (!id) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}?id=eq.${id}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ notify_status: status.slice(0, 300), notified_at: new Date().toISOString() }),
    });
  } catch (err) {
    console.error("recording notify status threw", err);
  }
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

/**
 * A crude flood guard. The contact forms are open to the whole internet, so one
 * address filling the table in a loop is stopped here rather than in the inbox.
 * A failure to check never blocks a genuine submission.
 */
async function tooManyRecently(ip: string): Promise<boolean> {
  if (!ip) return false;
  try {
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${TABLE}?select=id&source_ip=eq.${encodeURIComponent(ip)}&created_at=gte.${since}&limit=9`,
      {
        headers: {
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Prefer: "count=exact",
        },
      },
    );
    if (!res.ok) return false;
    return (await res.json() as unknown[]).length >= 8;
  } catch {
    return false;
  }
}

// The /submissions dashboard proves who it is with the same session cookie it
// issues itself: both functions sign with the service role key, so the token
// verifies here without the credentials being shared or re-checked.
const SESSION_COOKIE = "mc_submissions";

async function hmacHex(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SERVICE_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function staffSession(req: Request): Promise<boolean> {
  const header = req.headers.get("cookie");
  if (!header) return false;
  let token: string | null = null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq !== -1 && part.slice(0, eq).trim() === SESSION_COOKIE) {
      token = decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const expires = token.slice(0, dot);
  if (!/^\d+$/.test(expires) || Number(expires) < Date.now()) return false;
  const expected = await hmacHex(expires);
  const given = token.slice(dot + 1);
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Proves the whole alert path works, end to end, from the dashboard. */
async function sendTestEmail(): Promise<Response> {
  settingsCache = null;
  const settings = await notifySettings();
  const to = recipients(settings.extra_to);
  const { html, text } = teamEmail(
    "Test alert from your website",
    "If this is in your inbox, new submissions will reach you the same way.",
    [
      ["Sent", new Date().toISOString()],
      ["Provider", resolveProvider(settings) || "none configured"],
      ["Going to", to.join(", ")],
    ],
  );
  const result = await sendMail({
    to,
    subject: "MindCare website: alert test",
    html,
    text,
    reference: crypto.randomUUID(),
  });
  return result.ok
    ? json({ ok: true, to })
    : json({ error: result.detail || "The provider refused the message." }, 502);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "We could not read that submission. Please try again." }, 400);
  }

  if (str(body.action) === "test") {
    if (!await staffSession(req)) return json({ error: "Please sign in again." }, 401);
    return await sendTestEmail();
  }

  // Honeypot. The field is hidden from people and left empty by them; a bot
  // that fills in every input gets a success it can do nothing with.
  if (str(body.company)) return json({ ok: true });

  const kind = KINDS[str(body.kind)] ? str(body.kind) : "workshop";
  const kindLabel = KINDS[kind];
  const isWorkshop = kind === "workshop";

  const certificate = body.certificate === true || body.certificate === "true";
  const notes = body.notes === true || body.notes === "true";
  // A receipt is demanded whenever money changed hands. Paid registration is
  // the general case now; the certificate-only flow is kept working for the
  // older free workshops, which send `certificate` and nothing else.
  const paid = isWorkshop && (certificate || body.paid === true || body.paid === "true");
  const feeSummary = str(body.fee_summary).slice(0, 300);

  const record = {
    kind,
    // Carries the fee breakdown for paid courses, so it is capped rather than
    // trusted to be a short label.
    workshop: str(body.workshop).slice(0, 300) ||
      (isWorkshop ? "Telepathy & Meditation Workshop" : `Website ${kindLabel}`),
    name: str(body.name).slice(0, 200),
    institute: str(body.institute).slice(0, 200),
    phone: str(body.phone).slice(0, 60),
    email: str(body.email).slice(0, 200),
    education: str(body.education).slice(0, 200),
    prior_info: str(body.prior_info).slice(0, 4000),
    expectations: str(body.expectations).slice(0, 4000),
    service: str(body.service).slice(0, 200),
    message: str(body.message).slice(0, 4000),
    preferred_date: str(body.preferred_date).slice(0, 60),
    preferred_time: str(body.preferred_time).slice(0, 60),
    certificate,
  };

  // A registration is a commitment and asks for everything. A contact form only
  // needs a name and one way of replying, because demanding more is how you
  // lose the enquiry.
  if (!record.name) {
    return json({ error: "Please tell us your name.", fields: ["name"] }, 400);
  }
  if (isWorkshop) {
    const missing = (["institute", "phone", "email", "education"] as const)
      .filter((key) => !record[key]);
    if (missing.length) {
      return json({ error: "Please fill in every required field.", fields: missing }, 400);
    }
  } else if (!record.phone && !record.email) {
    return json({
      error: "Please leave a phone number or an email address so we can reply.",
      fields: ["phone", "email"],
    }, 400);
  }
  if (record.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(record.email)) {
    return json({ error: "Please enter a valid email address.", fields: ["email"] }, 400);
  }
  if (record.phone && record.phone.replace(/\D/g, "").length < 7) {
    return json({ error: "Please enter a valid phone number.", fields: ["phone"] }, 400);
  }

  const sourceIp = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (await tooManyRecently(sourceIp)) {
    return json({
      error: "That is a lot of submissions from one place. Please wait a few minutes and try again.",
    }, 429);
  }

  const receipt = body.receipt as Record<string, unknown> | undefined;
  let path: string | null = null;
  let receiptType = "";

  if (paid) {
    if (!receipt || !str(receipt.data)) {
      return json({
        error: "Please attach the screenshot of your payment so we can verify it.",
        fields: ["receipt"],
      }, 400);
    }

    receiptType = str(receipt.type).toLowerCase();
    const ext = EXT_BY_TYPE[receiptType];
    if (!ext) {
      return json({
        error: "The receipt must be a JPG, PNG, WEBP, GIF or HEIC image, or a PDF.",
        fields: ["receipt"],
      }, 400);
    }

    let bytes: Uint8Array;
    try {
      bytes = decodeBase64(str(receipt.data));
    } catch {
      return json({ error: "We could not read that file. Please try another screenshot.", fields: ["receipt"] }, 400);
    }
    if (!bytes.length) {
      return json({ error: "That receipt file appears to be empty.", fields: ["receipt"] }, 400);
    }
    if (bytes.length > MAX_BYTES) {
      return json({ error: "That receipt is too large. Please upload a file under 8 MB.", fields: ["receipt"] }, 400);
    }

    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    path = `${now.getUTCFullYear()}/${month}/${crypto.randomUUID()}.${ext}`;

    const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": receiptType,
        "x-upsert": "false",
      },
      body: bytes,
    });
    if (!upload.ok) {
      console.error("receipt upload failed", upload.status, await upload.text());
      return json({ error: "We could not save your receipt. Please try again in a moment." }, 502);
    }
  }

  const insert = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      ...record,
      receipt_path: path,
      receipt_name: (paid && str(receipt?.name).slice(0, 200)) || null,
      receipt_type: receiptType || null,
      source_ip: sourceIp || null,
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400) || null,
    }),
  });
  if (!insert.ok) {
    console.error("submission insert failed", insert.status, await insert.text());
    return json({ error: "We could not save your submission. Please try again in a moment." }, 502);
  }
  const [saved] = await insert.json().catch(() => [] as Array<{ id: string }>) as Array<{ id: string }>;
  const rowId = saved?.id ?? "";

  // Everything below is an alert. The submission is already safe, so nothing
  // here is allowed to turn into an error for the person who just sent it.
  const settings = await notifySettings();
  const to = recipients(settings.extra_to);
  const heading = isWorkshop
    ? "New workshop registration"
    : `New ${kindLabel} from the website`;
  const { html, text } = teamEmail(heading, record.workshop, [
    ["Name", record.name],
    ["Phone", record.phone],
    ["Email", record.email],
    ["Service", record.service],
    ["Preferred date", record.preferred_date],
    ["Preferred time", record.preferred_time],
    ["Message", record.message],
    ["Institute", record.institute],
    ["Current education", record.education],
    ["Prior knowledge", record.prior_info],
    ["Expectations", record.expectations],
    ["Fee paid", feeSummary],
    ["Notes PDF", feeSummary ? (notes ? "Yes" : "No") : ""],
    ["Certificate", isWorkshop ? (certificate ? "Yes" : (feeSummary ? "No" : "No (free seat)")) : ""],
    ["Receipt", str(receipt?.name) || (paid ? "uploaded" : "")],
  ]);

  const alert = await sendMail({
    to,
    subject: `New ${kindLabel}: ${record.name}${feeSummary ? ` (${feeSummary})` : ""}`,
    html,
    text,
    // Replying to the alert writes straight back to the person who wrote in.
    replyTo: record.email || undefined,
    reference: rowId || crypto.randomUUID(),
  });
  await recordNotifyStatus(rowId, alert.ok ? "sent" : `failed: ${alert.detail}`);

  // A confirmation back to the person is only sent from a sender of our own:
  // mail to a stranger from a shared provider address is what gets that address
  // marked as spam in the first place, and it would not say MindCare anyway.
  const fromAddress = sender(settings, resolveProvider(settings));
  const sharedSender = Object.values(SHARED_SENDERS).some((shared) =>
    fromAddress === shared || fromAddress.includes(splitAddress(shared).email)
  );
  if (settings.confirm_registrant && record.email && alert.ok && !sharedSender) {
    const confirmation = registrantEmail(record.name.split(/\s+/)[0], kindLabel);
    await sendMail({
      to: [record.email],
      subject: `We have your ${kindLabel} | MindCare Services`,
      html: confirmation.html,
      text: confirmation.text,
      replyTo: ALWAYS_NOTIFY,
      reference: `confirm-${rowId || crypto.randomUUID()}`,
    });
  }

  await notifyPhones();

  return json({ ok: true });
});
