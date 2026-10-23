import { datePlusOne, methodNotAllowed, requireAdmin, sendJson, validDate } from '../_lib/admin.js';

function getConfig() {
  const key = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  const rawHost = process.env.POSTHOG_API_HOST || 'https://us.posthog.com';
  let host;
  try { host = new URL(rawHost); } catch { return null; }
  if (!key || !projectId || !/^\d+$/.test(projectId) || (host.protocol !== 'https:' && host.hostname !== 'localhost')) return null;
  return { key, projectId, host: host.origin };
}

async function runHogQL(config, query) {
  const response = await fetch(`${config.host}/api/projects/${config.projectId}/query/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    signal: AbortSignal.timeout(15000),
  });
    if (!response.ok) {
    // Read a limited diagnostic message without exposing credentials.
    const details = await response.text().catch(() => '');
    console.error('PostHog API error:', {
      status: response.status,
      host: config.host,
      projectId: config.projectId,
      details: details.slice(0, 500),
    });

    throw new Error(`PostHog query failed with status ${response.status}`);
  }
  const body = await response.json();
  if (!Array.isArray(body.results)) throw new Error('Unexpected PostHog query response');
  return body.results;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return methodNotAllowed(res, ['GET']);
  if (!requireAdmin(req, res)) return;

  const now = new Date();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const defaultStart = new Date(`${today}T00:00:00Z`);
  defaultStart.setUTCDate(defaultStart.getUTCDate() - 6);
  const from = typeof req.query?.from === 'string' ? req.query.from : defaultStart.toISOString().slice(0, 10);
  const to = typeof req.query?.to === 'string' ? req.query.to : today;
  if (!validDate(from) || !validDate(to) || from > to) return sendJson(res, 400, { error: 'Choose a valid date range.' });
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  if (span > 89) return sendJson(res, 400, { error: 'Date range cannot exceed 90 days.' });

  const config = getConfig();
  if (!config) return sendJson(res, 503, { error: 'PostHog server access is not configured. Set POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID, and POSTHOG_API_HOST in Vercel server-side environment variables.' });

  const startIso = `${from} 00:00:00`;
  const endIso = `${datePlusOne(to)} 00:00:00`;
  const where = `timestamp >= toDateTime('${startIso}', 'Asia/Kolkata') AND timestamp < toDateTime('${endIso}', 'Asia/Kolkata')`;
  const dailyQuery = `SELECT toString(toDate(toTimeZone(timestamp, 'Asia/Kolkata'))) AS day, uniq(distinct_id) AS daily_users, countIf(event IN ('crossword_started', 'bgm_started', 'hangman_started')) AS games_started, countIf(event = 'puzzle_submitted') AS games_completed, countIf(event = 'puzzle_won') AS wins, countIf(event = 'puzzle_lost') AS losses FROM events WHERE ${where} GROUP BY day ORDER BY day ASC`;
  const gameQuery = `SELECT ifNull(properties.game_type, 'crossword') AS game_type, countIf(event IN ('crossword_started', 'bgm_started', 'hangman_started')) AS games_started, countIf(event = 'puzzle_submitted') AS games_completed, countIf(event = 'puzzle_won') AS wins, countIf(event = 'puzzle_lost') AS losses FROM events WHERE ${where} AND event IN ('crossword_started', 'bgm_started', 'hangman_started', 'puzzle_submitted', 'puzzle_won', 'puzzle_lost') GROUP BY game_type ORDER BY games_started DESC`;

  try {
    const [dailyRows, gameRows] = await Promise.all([runHogQL(config, dailyQuery), runHogQL(config, gameQuery)]);
    const daily = dailyRows.map((row) => ({
      date: String(row[0]), users: Number(row[1]) || 0, started: Number(row[2]) || 0,
      completed: Number(row[3]) || 0, wins: Number(row[4]) || 0, losses: Number(row[5]) || 0,
    }));
    const games = gameRows.map((row) => ({
      type: String(row[0] || 'unknown'), started: Number(row[1]) || 0,
      completed: Number(row[2]) || 0, wins: Number(row[3]) || 0, losses: Number(row[4]) || 0,
    }));
    const totals = daily.reduce((acc, day) => {
      acc.started += day.started; acc.completed += day.completed; acc.wins += day.wins; acc.losses += day.losses;
      return acc;
    }, { started: 0, completed: 0, wins: 0, losses: 0 });
    return sendJson(res, 200, { from, to, daily, games, totals, source: 'posthog', consentNote: 'Metrics include only events recorded under the existing analytics consent policy.' });
  } catch (error) {
    console.error('MovieMatrix admin analytics query failed:', error.message);
    return sendJson(res, 502, { error: 'Could not load analytics from PostHog. Verify the project ID, API host, query:read permission, and event schema.' });
  }
}
