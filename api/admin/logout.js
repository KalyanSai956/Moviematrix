import { clearSessionCookie, methodNotAllowed, sameOriginRequest, sendJson } from '../_lib/admin.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  if (!sameOriginRequest(req)) return sendJson(res, 403, { error: 'Request origin was not accepted.' });
  res.setHeader('Set-Cookie', clearSessionCookie());
  return sendJson(res, 200, { authenticated: false });
}
