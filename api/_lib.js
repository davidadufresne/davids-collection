const crypto = require('crypto');

const STATE_KEY = 'state';
const DEFAULT_STATE = { edits: {}, links: {}, deleted: {}, photos: {}, importedCards: null };

// Shared mutable state lives in Redis (Upstash, via Vercel's KV REST API), which is
// strongly consistent for a single key. Blob storage was tried first but overwriting
// the same blob path repeatedly has a multi-second propagation lag, which caused
// admin edits/photos to appear to save and then vanish on the next page load.
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

async function loadState() {
      if (!KV_URL || !KV_TOKEN) {
              console.error('KV_REST_API_URL/KV_REST_API_TOKEN not configured');
              return { ...DEFAULT_STATE };
      }
      try {
              const res = await fetch(`${KV_URL}/get/${STATE_KEY}`, {
                        headers: { Authorization: `Bearer ${KV_TOKEN}` },
                        cache: 'no-store',
              });
              if (!res.ok) return { ...DEFAULT_STATE };
              const data = await res.json();
              if (!data.result) return { ...DEFAULT_STATE };
              const parsed = JSON.parse(data.result);
              return { ...DEFAULT_STATE, ...parsed };
      } catch (e) {
              console.error('loadState failed', e);
              return { ...DEFAULT_STATE };
      }
}

async function saveState(state) {
      const res = await fetch(`${KV_URL}/set/${STATE_KEY}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${KV_TOKEN}`, 'Content-Type': 'text/plain' },
              body: JSON.stringify(state),
      });
      if (!res.ok) {
              const text = await res.text().catch(() => '');
              throw new Error('Failed to save state: ' + res.status + ' ' + text);
      }
}

function b64url(input) {
      return Buffer.from(input).toString('base64url');
}

function signToken() {
      const exp = Date.now() + 12 * 60 * 60 * 1000; // 12 hours
  const payload = b64url(JSON.stringify({ exp }));
      const sig = crypto.createHmac('sha256', process.env.ADMIN_SECRET).update(payload).digest('base64url');
      return payload + '.' + sig;
}

function verifyToken(token) {
      if (!token || typeof token !== 'string') return false;
      const parts = token.split('.');
      if (parts.length !== 2) return false;
      const [payload, sig] = parts;
      let expected;
      try {
              expected = crypto.createHmac('sha256', process.env.ADMIN_SECRET).update(payload).digest('base64url');
      } catch (e) {
              return false;
      }
      const sigBuf = Buffer.from(sig);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return false;
      try {
              const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
              return typeof data.exp === 'number' && data.exp > Date.now();
      } catch (e) {
              return false;
      }
}

const LOGIN_ATTEMPTS_PREFIX = 'login_attempts:';
const MAX_LOGIN_ATTEMPTS = 6;
const LOGIN_WINDOW_SECONDS = 15 * 60;

async function kvGet(key) {
        if (!KV_URL || !KV_TOKEN) return null;
        try {
                  const res = await fetch(`${KV_URL}/get/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` }, cache: 'no-store' });
                  if (!res.ok) return null;
                  const data = await res.json();
                  return data.result;
        } catch (e) { return null; }
}

async function kvIncrWithExpiry(key, seconds) {
        if (!KV_URL || !KV_TOKEN) return null;
        try {
                  const res = await fetch(`${KV_URL}/incr/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } });
                  if (!res.ok) return null;
                  const data = await res.json();
                  if (data.result === 1) {
                              await fetch(`${KV_URL}/expire/${key}/${seconds}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } }).catch(() => {});
                  }
                  return data.result;
        } catch (e) { return null; }
}

async function kvDel(key) {
        if (!KV_URL || !KV_TOKEN) return;
        try { await fetch(`${KV_URL}/del/${key}`, { headers: { Authorization: `Bearer ${KV_TOKEN}` } }); } catch (e) {}
}

async function checkLoginRateLimit(ip) {
        const count = parseInt((await kvGet(LOGIN_ATTEMPTS_PREFIX + ip)) || '0', 10);
        return count < MAX_LOGIN_ATTEMPTS;
}

async function recordFailedLogin(ip) {
        await kvIncrWithExpiry(LOGIN_ATTEMPTS_PREFIX + ip, LOGIN_WINDOW_SECONDS);
}

async function clearLoginAttempts(ip) {
        await kvDel(LOGIN_ATTEMPTS_PREFIX + ip);
}

module.exports = { loadState, saveState, signToken, verifyToken, checkLoginRateLimit, recordFailedLogin, clearLoginAttempts };
