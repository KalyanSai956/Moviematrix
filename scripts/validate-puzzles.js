import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCrossword } from '../src/lib/crossword.js';
import { GAME_CYCLE, gameTypeForDate, isRealDate, validateGameEntry } from '../src/lib/schedule.js';

const file = new URL('../content/puzzles.json', import.meta.url);
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
let data;
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (error) { console.error(`Could not parse content/puzzles.json: ${error.message}`); process.exit(1); }
const fail = message => { console.error(`Puzzle validation failed: ${message}`); process.exitCode = 1; };
const warn = message => console.warn(`Warning: ${message}`);
if (data.version !== 1) fail('version must be 1.');
if (!isRealDate(data.startDate)) fail('startDate must be a real calendar date in YYYY-MM-DD format.');
if (data.timezone !== 'Asia/Kolkata') fail('timezone must be Asia/Kolkata.');
if (!Array.isArray(data.puzzles) || !data.puzzles.length) fail('puzzles must be a non-empty array.');
const dates = new Set();
const counts = {};
for (const puzzle of data.puzzles || []) {
  if (!isRealDate(puzzle.date)) { fail(`invalid date: ${puzzle.date}`); continue; }
  if (dates.has(puzzle.date)) fail(`duplicate puzzle date: ${puzzle.date}`);
  dates.add(puzzle.date);
  if (isRealDate(data.startDate) && puzzle.date < data.startDate) fail(`${puzzle.date}: is before startDate ${data.startDate}.`);
  if (!Number.isInteger(puzzle.puzzleNumber) || puzzle.puzzleNumber < 1) fail(`${puzzle.date}: puzzleNumber must be a positive integer.`);
  // Entries without gameType are crosswords, exactly as before the rotation existed.
  const declared = puzzle.gameType ?? 'crossword';
  if (!GAME_CYCLE.includes(declared)) { fail(`${puzzle.date}: unknown gameType "${declared}" (use ${GAME_CYCLE.join(', ')}).`); continue; }
  const expected = gameTypeForDate(data.startDate, puzzle.date);
  if (declared !== expected) fail(`${puzzle.date}: the 3-day rotation schedules "${expected}" for this date but the entry is "${declared}".`);
  counts[declared] = (counts[declared] || 0) + 1;
  if (declared !== 'crossword') {
    for (const message of validateGameEntry(puzzle)) fail(`${puzzle.date}: ${message}`);
    if (declared === 'bgm' && typeof puzzle.audio === 'string' && puzzle.audio.startsWith('/') && !puzzle.audio.includes('..')) {
      if (!fs.existsSync(path.join(publicDir, puzzle.audio))) warn(`${puzzle.date}: audio file is missing. Add it at public${puzzle.audio} before this date, or the BGM game will show an audio configuration error.`);
    }
    continue;
  }
  if (!Array.isArray(puzzle.rows) || !puzzle.rows.length || !puzzle.rows.every(r => typeof r === 'string' && r.length === puzzle.rows[0].length)) { fail(`${puzzle.date}: rows must be a rectangular array of strings.`); continue; }
  try {
    const grid = validateCrossword(puzzle);
    if (grid.some(row => row.length !== puzzle.rows[0].length)) fail(`${puzzle.date}: grid dimensions mismatch.`);
  } catch (error) { fail(`${puzzle.date}: ${error.message}`); }
}
if (!process.exitCode) {
  const summary = Object.entries(counts).map(([type, n]) => `${n} ${type}`).join(', ');
  console.log(`Validated ${data.puzzles.length} puzzle(s) (${summary}). Remember: the bundled JSON exposes answer data to visitors.`);
}
