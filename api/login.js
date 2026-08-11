const { signToken } = require('./_lib');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
    const { password } = req.body || {};
    if (!password || !process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
          res.status(401).json({ error: 'Incorrect password' });
          return;
    }
    const token = signToken();
    res.status(200).json({ token });
};
