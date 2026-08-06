// Zoho's HTML domain verification. Served through a function rather than a
// static file on purpose: `cleanUrls` in vercel.json redirects any request for
// a *.html path to its extensionless twin, and Zoho's verification bot reads
// that 308 as a missing file. A rewrite to this handler keeps the .html URL
// answering 200 with the code and nothing else.
module.exports = (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send('06917847');
};
