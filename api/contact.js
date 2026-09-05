const { proxy } = require('./_supabase');

// The consultation, appointment and question forms on /contact. They go to the
// same Edge Function as the workshop registrations, which stores every
// submission and emails the team; only the `kind` in the payload differs. This
// alias exists so the contact page posts to a URL that says what it is.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }
  await proxy(req, res, 'workshop-register', 'application/json; charset=utf-8');
};
