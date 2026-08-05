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
  await proxy(req, res, 'workshop-submissions');
};
