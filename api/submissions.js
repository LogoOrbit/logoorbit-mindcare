const { proxy } = require('./_supabase');

// Served at /submissions through the rewrite in vercel.json. The ID/password
// check and the rendering both happen inside the Supabase Edge Function.
module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    res.status(405).send('Method not allowed');
    return;
  }
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  // This function only ever renders a page, so pin the type rather than trust
  // whatever survives the hop through Supabase's CDN.
  await proxy(req, res, 'workshop-submissions', 'text/html; charset=utf-8');
};
