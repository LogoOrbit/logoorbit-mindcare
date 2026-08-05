// Workshop registration intake for themindcareservices.com.
//
// Accepts a JSON registration and, when the visitor opted into the paid
// certificate of participation, a base64 payment receipt. The workshop itself
// is free, so a registration without a receipt is perfectly valid; a receipt is
// only required when `certificate` is true. Receipts go to the private
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

  const record = {
    workshop: text(body.workshop) || "Telepathy & Meditation Workshop",
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

  // Attending is free, so a receipt is only demanded from people who asked for
  // the paid certificate. Everyone else registers with nothing to upload.
  const receipt = body.receipt as Record<string, unknown> | undefined;
  let path: string | null = null;
  let receiptType = "";

  if (certificate) {
    if (!receipt || !text(receipt.data)) {
      return json({
        error: "Please attach the payment screenshot so we can verify your certificate fee.",
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
      receipt_name: (certificate && text(receipt?.name).slice(0, 200)) || null,
      receipt_type: receiptType || null,
      source_ip: (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 400) || null,
    }),
  });
  if (!insert.ok) {
    console.error("registration insert failed", insert.status, await insert.text());
    return json({ error: "We could not save your registration. Please try again in a moment." }, 502);
  }

  return json({ ok: true });
});
