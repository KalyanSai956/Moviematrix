const STORAGE_KEY = 'moviematrix.progress.v1';
const EMPTY = { version: 1, results: {} };

export function readProgress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!parsed || parsed.version !== 1 || typeof parsed.results !== 'object' || !parsed.results) return structuredClone(EMPTY);
    return parsed;
  } catch { return structuredClone(EMPTY); }
}

export function saveResult(date, result) {
  const progress = readProgress();
  // One result per date and game. A leftover record from a different game (e.g. saved before the
  // 3-day rotation existed) must not block today's game, so only a same-game record is kept.
  const existing = progress.results[date];
  if (existing && (existing.gameType ?? 'crossword') === (result.gameType ?? 'crossword')) return progress;
  progress.results[date] = { ...result, date };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch { /* private browsing/storage disabled: game still works for this session */ }
  return progress;
}

export function calculateStats(progress, today) {
  const results = Object.values(progress.results || {}).sort((a, b) => a.date.localeCompare(b.date));
  const played = results.length;
  const wins = results.filter(r => r.won).length;
  let best = 0, run = 0, previous = null;
  for (const result of results) {
    if (result.won) {
      run = previous && daysBetween(previous, result.date) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
    } else run = 0;
    previous = result.date;
  }
  let current = 0;
  const byDate = new Map(results.map(r => [r.date, r]));
  let cursor = today;
  // A streak is current only if today's puzzle has been won; otherwise yesterday's streak remains valid until today is played.
  if (!byDate.get(today)?.won) cursor = shiftDate(today, -1);
  while (byDate.get(cursor)?.won) { current++; cursor = shiftDate(cursor, -1); }
  return { played, wins, winPercent: played ? Math.round((wins / played) * 100) : 0, currentStreak: current, maxStreak: best };
}

function daysBetween(a, b) { return (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000; }
function shiftDate(date, offset) { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + offset); return d.toISOString().slice(0, 10); }
