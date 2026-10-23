import { isAuthenticated, methodNotAllowed, sendJson } from '../_lib/admin.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  return sendJson(res, 200, { authenticated: isAuthenticated(req), configured: Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.length >= 32) });
}
