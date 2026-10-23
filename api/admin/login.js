import { adminConfigPresent, checkLoginRateLimit, createSessionCookie, methodNotAllowed, parseJsonBody, sameOriginRequest, sendJson, verifyCredentials } from '../_lib/admin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!sameOriginRequest(req)) return sendJson(res, 403, { error: 'Request origin was not accepted.' });
  if (!adminConfigPresent()) return sendJson(res, 503, { error: 'Admin login is not configured. Add the required server-side environment variables in Vercel.' });
  if (!checkLoginRateLimit(req)) return sendJson(res, 429, { error: 'Too many sign-in attempts. Please wait 15 minutes and try again.' });
  try {
    const { username, password } = await parseJsonBody(req);
    if (typeof username !== 'string' || typeof password !== 'string' || username.length > 200 || password.length > 1000 || !verifyCredentials(username, password)) {
      return sendJson(res, 401, { error: 'Invalid username or password.' });
    }
    res.setHeader('Set-Cookie', createSessionCookie(process.env.ADMIN_USERNAME));
    return sendJson(res, 200, { authenticated: true, username: process.env.ADMIN_USERNAME });
  } catch {
    return sendJson(res, 400, { error: 'Invalid sign-in request.' });
  }
}
