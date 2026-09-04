// Workshop registration intake for themindcareservices.com.
//
// Accepts a JSON registration and, when the registration is a paid one, a
// base64 payment receipt. `paid` is what makes a receipt compulsory: the
// Montessori Teacher Training Course charges a registration fee, so every one
// of its registrations carries a receipt, while `certificate` stays a plain
// record of whether the optional certificate add-on was bought. A free
// workshop sends neither and remains perfectly valid. Receipts go to the private
// `mindcare-receipts` bucket and the details to
// `mindcare_workshop_registrations`. Both are service-role only; the data is
// read back through the password-protected `workshop-submissions` function.
//
// Deployed with verify_jwt = false because this is a public website form. The
// service role key never leaves Supabase: it is injected by the edge runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "mindcare-receipts";
const TABLE = "mindcare_workshop_registrations";
const MAX_BYTES = 8 * 1024 * 1024;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

// Email alert for every new registration. Sent through Resend. The whole step
// is optional: with no RESEND_API_KEY set the registration still saves and the
// visitor still gets a success message, the alert is just skipped.
// Read with `|| fallback` rather than `??`: a secret that exists but is blank
// is exactly how this silently stopped sending, and an empty string is never a
// usable key or sender.
const env = (name: string) => (Deno.env.get(name) ?? "").trim();
const RESEND_KEY = env("RESEND_API_KEY");
const NOTIFY_FROM = env("NOTIFY_FROM") ||
  "MindCare Website <onboarding@resend.dev>";
// Every registration is emailed here. shaistatariq2002@gmail.com is always on
// the list, so a stray NOTIFY_TO secret can never silence the alerts; the
// variable only adds extra recipients.
//
// Keep this list to the Resend account owner while NOTIFY_FROM is the shared
// onboarding@resend.dev sender: Resend rejects the entire request (403) if any
// recipient is someone else, which is what was silently dropping every alert.
// Verify themindcareservices.com in Resend, point NOTIFY_FROM at it, and then
// extra addresses such as info@themindcareservices.com can go in NOTIFY_TO.
const ALWAYS_NOTIFY = "shaistatariq2002@gmail.com";
const NOTIFY_TO = [...new Set([
  ALWAYS_NOTIFY,
  ...env("NOTIFY_TO").split(",").map((a) => a.trim()).filter(Boolean),
])];

// Phone alerts. Staff subscribe from the /submissions dashboard (installed to
// the home screen) and every registration then rings their phone through the
// Web Push protocol. Like the email, the whole step is optional: with no
// VAPID_PRIVATE_KEY set the registration still saves silently.
//
// The public half is not a secret - the browser needs it to subscribe - so it
// lives in the source and must match the copy in workshop-submissions.
const VAPID_PUBLIC_KEY =
  "BPeDHwj_As58mnmxaXsAoqd4WQ-v2fOuZHOl4Ylucqdmxmr25sTGpdrZsMrPaakFTwYx5TXBs1MgRd5fy6XQNFc";
const VAPID_PRIVATE_KEY = env("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = env("VAPID_SUBJECT") || "mailto:info@themindcareservices.com";
const PUSH_TABLE = "mindcare_push_subscriptions";

function b64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Signs a VAPID token for one push service origin. The notification itself is
 * sent without a payload, which keeps the registration's details off Google's
 * servers and means no message encryption is needed here.
 */
async function vapidHeader(audience: string): Promise<string | null> {
  if (!VAPID_PRIVATE_KEY) return null;
  const raw = atob(VAPID_PUBLIC_KEY.replace(/-/g, "+").replace(/_/g, "/"));
  const pub = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: VAPID_PRIVATE_KEY,
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
    enc({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: VAPID_SUBJECT })
  }`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `vapid t=${signingInput}.${b64url(new Uint8Array(signature))}, k=${VAPID_PUBLIC_KEY}`;
}

/**
 * Rings every subscribed phone. Failures are logged and swallowed for the same
 * reason as the email: an alert is never worth losing a registration over.
 * Subscriptions the push service has retired (404/410) are dropped so the list
 * does not fill up with dead phones.
 */
async function notifyPhones(): Promise<void> {
  if (!VAPID_PRIVATE_KEY) return;
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
        const auth = await vapidHeader(new URL(sub.endpoint).origin);
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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function decodeBase64(raw: string): Uint8Array {
  const comma = raw.indexOf(",");
  const b64 = raw.startsWith("data:") && comma !== -1 ? raw.slice(comma + 1) : raw;
  const binary = atob(b64.replace(/\s/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Emails the team a copy of a new registration. Failures are logged and
 * swallowed: a dropped alert must never cost us the registration itself, which
 * is already safe in the database and visible at /submissions.
 */
async function notifyTeam(
  record: Record<string, unknown>,
  certificate: boolean,
  receiptName: string,
  feeSummary: string,
  notes: boolean,
): Promise<void> {
  if (!RESEND_KEY || !NOTIFY_TO.length) {
    console.error("notification skipped", { hasKey: !!RESEND_KEY, recipients: NOTIFY_TO.length });
    return;
  }

  const row = (label: string, value: unknown) => {
    const v = text(value);
    return v
      ? `<tr><td style="padding:6px 12px 6px 0;color:#5b6b63;font-size:13px;white-space:nowrap">${label}</td>` +
        `<td style="padding:6px 0;font-size:14px;color:#12241a">${escapeHtml(v)}</td></tr>`
      : "";
  };

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px">
  <h2 style="margin:0 0 4px;font-size:18px;color:#12241a">New workshop registration</h2>
  <p style="margin:0 0 16px;font-size:13px;color:#5b6b63">${escapeHtml(text(record.workshop))}</p>
  <table style="border-collapse:collapse;width:100%">
    ${row("Name", record.name)}
    ${row("Institute", record.institute)}
    ${row("Phone", record.phone)}
    ${row("Email", record.email)}
    ${row("Current education", record.education)}
    ${row("Prior knowledge", record.prior_info)}
    ${row("Expectations", record.expectations)}
    ${row("Fee paid", feeSummary)}
    ${row("Notes PDF", feeSummary ? (notes ? "Yes" : "No") : "")}
    ${row("Certificate", certificate ? "Yes" : (feeSummary ? "No" : "No (free seat)"))}
    ${row("Receipt", receiptName || (feeSummary ? "uploaded" : ""))}
  </table>
  <p style="margin:18px 0 0;font-size:13px">
    <a href="https://themindcareservices.com/submissions" style="color:#0F9AA8">Open all submissions</a>
  </p>
</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: NOTIFY_FROM,
        to: NOTIFY_TO,
        // Replying to the alert writes straight back to the person who registered.
        reply_to: text(record.email) || undefined,
        subject: `New registration: ${text(record.name)}${feeSummary ? ` (${feeSummary})` : ""}`,
        html,
      }),
    });
    if (!res.ok) console.error("notification email failed", res.status, await res.text());
    else console.log("notification email sent", NOTIFY_TO.join(","));
  } catch (err) {
    console.error("notification email threw", err);
  }
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

  const certificate = body.certificate === true || body.certificate === "true";
  const notes = body.notes === true || body.notes === "true";
  // A receipt is demanded whenever money changed hands. Paid registration is
  // the general case now; the certificate-only flow is kept working for the
  // older free workshops, which send `certificate` and nothing else.
  const paid = certificate || body.paid === true || body.paid === "true";
  const feeSummary = text(body.fee_summary).slice(0, 300);

  const record = {
    // Carries the fee breakdown for paid courses, so it is capped rather than
    // trusted to be a short label.
    workshop: text(body.workshop).slice(0, 300) || "Telepathy & Meditation Workshop",
    name: text(body.name),
    institute: text(body.institute),
    phone: text(body.phone),
    email: text(body.email),
    education: text(body.education),
    prior_info: text(body.prior_info),
    expectations: text(body.expectations),
    certificate,
  };

  const required = ["name", "institute", "phone", "email", "education"] as const;
  const missing = required.filter((key) => !record[key]);
  if (missing.length) {
    return json({ error: "Please fill in every required field.", fields: missing }, 400);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(record.email)) {
    return json({ error: "Please enter a valid email address.", fields: ["email"] }, 400);
  }
  if (record.phone.replace(/\D/g, "").length < 7) {
    return json({ error: "Please enter a valid phone number.", fields: ["phone"] }, 400);
  }

  const receipt = body.receipt as Record<string, unknown> | undefined;
  let path: string | null = null;
  let receiptType = "";

  if (paid) {
    if (!receipt || !text(receipt.data)) {
      return json({
        error: "Please attach the screenshot of your payment so we can verify it.",
        fields: ["receipt"],
      }, 400);
    }

    receiptType = text(receipt.type).toLowerCase();
    const ext = EXT_BY_TYPE[receiptType];
    if (!ext) {
      return json({
        error: "The receipt must be a JPG, PNG, WEBP, GIF or HEIC image, or a PDF.",
        fields: ["receipt"],
      }, 400);
    }

    let bytes: Uint8Array;
    try {
      bytes = decodeBase64(text(receipt.data));
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
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      ...record,
      receipt_path: path,
      receipt_name: (paid && text(receipt?.name).slice(0, 200)) || null,
      receipt_type: receiptType || null,
      source_ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400) || null,
    }),
  });
  if (!insert.ok) {
    console.error("registration insert failed", insert.status, await insert.text());
    return json({ error: "We could not save your registration. Please try again in a moment." }, 502);
  }

  await notifyTeam(record, certificate, text(receipt?.name), feeSummary, notes);
  await notifyPhones();

  return json({ ok: true });
});
