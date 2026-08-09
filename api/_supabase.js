// Shared proxy helper for the two Supabase Edge Functions that back workshop
// registration. Keeping the hop here means the browser only ever talks to
// themindcareservices.com: no CORS, no third-party origin in the address bar,
// and the API key is attached server side.
//
// The publishable key below is safe in source control. It grants nothing on its
// own: the registrations table and the receipts bucket are service-role only,
// and that key lives exclusively inside the Supabase runtime.
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://kcamfetippgrawhgiabo.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ||
  'sb_publishable_XjxVmD8PFSyjXjZVXKj2gQ_2tNejmQe';

// Must match SESSION_COOKIE in supabase/functions/workshop-submissions.
const SESSION_COOKIE = 'mc_submissions';

/** Reads one cookie out of a Cookie header, raw, exactly as the browser sent it. */
function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}

function encodeBody(req) {
  const type = (req.headers['content-type'] || '').toLowerCase();
  const body = req.body;

  if (body === undefined || body === null || body === '') return { body: undefined, type: null };
  if (typeof body === 'string' || Buffer.isBuffer(body)) return { body, type: type || 'text/plain' };

  if (type.includes('application/x-www-form-urlencoded')) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) params.append(key, String(value));
    return { body: params.toString(), type: 'application/x-www-form-urlencoded' };
  }
  return { body: JSON.stringify(body), type: 'application/json' };
}

/**
 * Forwards the incoming request to a Supabase Edge Function and streams the
 * answer back, preserving status, content type and any session cookie.
 */
async function proxy(req, res, functionName, contentType) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  // Only the session cookie is any of Supabase's business. Forwarding the whole
  // header would hand it the visitor's analytics cookies as well.
  const session = readCookie(req.headers.cookie, SESSION_COOKIE);
  if (session !== null) headers.cookie = `${SESSION_COOKIE}=${session}`;
  if (req.headers['user-agent']) headers['user-agent'] = req.headers['user-agent'];

  const forwardedFor = req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
  if (forwardedFor) headers['x-forwarded-for'] = String(forwardedFor);

  const init = { method: req.method, headers, redirect: 'manual' };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const { body, type } = encodeBody(req);
    if (body !== undefined) {
      init.body = body;
      if (type) headers['content-type'] = type;
    }
  }

  let upstream;
  try {
    upstream = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, init);
  } catch (err) {
    console.error(`proxy to ${functionName} failed`, err);
    res.status(502).json({ error: 'The service is unreachable right now. Please try again in a moment.' });
    return;
  }

  // Pass our own session cookie back, but not the CDN cookies Supabase sets for
  // its own domain: the browser would reject them and they only add noise.
  const upstreamCookies = typeof upstream.headers.getSetCookie === 'function'
    ? upstream.headers.getSetCookie()
    : [upstream.headers.get('set-cookie')].filter(Boolean);
  const ourCookies = upstreamCookies.filter((c) => c.startsWith(SESSION_COOKIE + '='));

  const outgoing = {
    // Written with writeHead rather than res.send, which rewrites the content
    // type when handed a Buffer. The type has to be pinned by the caller too:
    // Supabase's gateway rewrites the Edge Function's own Content-Type to
    // text/plain on the way out, so relaying the upstream value would serve
    // the admin page as raw markup.
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  };
  if (ourCookies.length) outgoing['Set-Cookie'] = ourCookies;

  res.writeHead(upstream.status, outgoing);
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

module.exports = { proxy, SUPABASE_URL, SUPABASE_ANON_KEY };
