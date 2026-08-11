const { put, list } = require('@vercel/blob');
const crypto = require('crypto');

const STATE_PATH = 'state.json';
const DEFAULT_STATE = { edits: {}, links: {}, deleted: {}, photos: {}, importedCards: null };

async function loadState() {
    try {
          const { blobs } = await list({ prefix: STATE_PATH, limit: 10 });
          const match = blobs.find(b => b.pathname === STATE_PATH);
          if (!match) return { ...DEFAULT_STATE };
          const res = await fetch(match.url, { cache: 'no-store' });
          if (!res.ok) return { ...DEFAULT_STATE };
          const data = await res.json();
          return { ...DEFAULT_STATE, ...data };
    } catch (e) {
          console.error('loadState failed', e);
          return { ...DEFAULT_STATE };
    }
}

async function saveState(state) {
    await put(STATE_PATH, JSON.stringify(state), {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: 'application/json',
          cacheControlMaxAge: 0,
    });
}

function b64url(input) {
    return Buffer.from(input).toString('base64url');
}

function signToken() {
    const exp = Date.now() + 12 * 60 * 60 * 1000;
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

module.exports = { loadState, saveState, signToken, verifyToken };
