const { proxy } = require('./_supabase');

// Served at /submissions through the rewrite in vercel.json. The ID/password
// check and the rendering both happen inside the Supabase Edge Function.
module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, HEAD, POST');
    res.status(405).send('Method not allowed');
    return;
  }
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  // The type has to be pinned by us: Supabase's gateway rewrites the Edge
  // Function's own Content-Type to text/plain on the way out, so relaying the
  // upstream value would serve the admin page as raw markup. Everything here is
  // a page except ?latest=1, which the service worker reads as JSON.
  const wantsJson = (req.url || '').indexOf('latest') !== -1;
  await proxy(
    req,
    res,
    'workshop-submissions',
    wantsJson ? 'application/json; charset=utf-8' : 'text/html; charset=utf-8',
  );
};
