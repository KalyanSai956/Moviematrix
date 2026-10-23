import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'moviematrix_admin';
const SESSION_SECONDS = 8 * 60 * 60;
const loginAttempts = new Map();

export function sendJson(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
  res.end(JSON.stringify(body));
}

export function methodNotAllowed(res, allowed) {
  return sendJson(res, 405, { error: 'Method not allowed' }, { Allow: allowed.join(', ') });
}

export function adminConfigPresent() {
  return Boolean(
    process.env.ADMIN_USERNAME &&
    process.env.ADMIN_PASSWORD &&
    process.env.ADMIN_SESSION_SECRET &&
    process.env.ADMIN_SESSION_SECRET.length >= 32
  );
}

function constantTimeEqual(left, right) {
  const a = createHash('sha256').update(String(left ?? '')).digest();
  const b = createHash('sha256').update(String(right ?? '')).digest();
  return timingSafeEqual(a, b);
}

function cookieValue(req, name) {
  const cookieHeader = req.headers.cookie || '';
  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    if (part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return '';
}

function signature(payload) {
  return createHmac('sha256', process.env.ADMIN_SESSION_SECRET).update(payload).digest('base64url');
}

export function createSessionCookie(username) {
  const payload = Buffer.from(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS })).toString('base64url');
  const value = `${payload}.${signature(payload)}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=${value}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${secure}`;
}

export function isAuthenticated(req) {
  if (!adminConfigPresent()) return false;
  const value = cookieValue(req, COOKIE_NAME);
  const splitAt = value.lastIndexOf('.');
  if (splitAt < 1) return false;
  const payload = value.slice(0, splitAt);
  const suppliedSignature = value.slice(splitAt + 1);
  if (!constantTimeEqual(suppliedSignature, signature(payload))) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.sub === process.env.ADMIN_USERNAME && Number(session.exp) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function requireAdmin(req, res) {
  if (!adminConfigPresent()) {
    sendJson(res, 503, { error: 'Admin authentication is not configured. Set the required server-side environment variables.' });
    return false;
  }
  if (!isAuthenticated(req)) {
    sendJson(res, 401, { error: 'Please sign in to the admin dashboard.' });
    return false;
  }
  return true;
}

export function sameOriginRequest(req) {
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!origin || !host) return false;
  try {
    const parsed = new URL(origin);
    return parsed.host.toLowerCase() === String(host).toLowerCase();
  } catch {
    return false;
  }
}

export function checkLoginRateLimit(req) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (req.headers['x-real-ip'] || (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '') || 'unknown').slice(0, 100);
  const now = Date.now();
  const current = loginAttempts.get(ip);
  if (!current || now - current.startedAt > 15 * 60 * 1000) {
    loginAttempts.set(ip, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= 8;
}

export function verifyCredentials(username, password) {
  return constantTimeEqual(username, process.env.ADMIN_USERNAME) && constantTimeEqual(password, process.env.ADMIN_PASSWORD);
}

export function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 8192) reject(new Error('Request body too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); }
      catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

export function validDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

export function datePlusOne(date) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}
