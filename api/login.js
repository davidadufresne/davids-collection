const { signToken, checkLoginRateLimit, recordFailedLogin, clearLoginAttempts } = require('./_lib');

module.exports = async function handler(req, res) {
        if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

        const ip = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();

        const allowed = await checkLoginRateLimit(ip);
        if (!allowed) {
                    res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
                    return;
        }

        const { password } = req.body || {};
        if (!password || !process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
                    await recordFailedLogin(ip);
                    res.status(401).json({ error: 'Incorrect password' });
                    return;
        }

        await clearLoginAttempts(ip);
        const token = signToken();
        res.status(200).json({ token });
};
