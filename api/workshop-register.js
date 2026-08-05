const { proxy } = require('./_supabase');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }
  await proxy(req, res, 'workshop-register', 'application/json; charset=utf-8');
};
