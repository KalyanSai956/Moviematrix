export const TIME_ZONE = 'Asia/Kolkata';

export function dateKeyInIST(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function nextMidnightIST(now = new Date()) {
  const today = dateKeyInIST(now);
  const [year, month, day] = today.split('-').map(Number);
  // IST is UTC+05:30. This produces the UTC instant for the next IST midnight.
  return new Date(Date.UTC(year, month - 1, day + 1) - (5 * 60 + 30) * 60_000);
}

export function secondsUntilNextPuzzle(now = new Date()) {
  return Math.max(0, Math.floor((nextMidnightIST(now).getTime() - now.getTime()) / 1000));
}

export function dayNumber(startDate, currentDate) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const current = Date.parse(`${currentDate}T00:00:00Z`);
  return Math.floor((current - start) / 86_400_000) + 1;
}
