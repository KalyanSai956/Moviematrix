import fs from 'node:fs';
import { validateCrossword } from '../src/lib/crossword.js';

const file = new URL('../content/puzzles.json', import.meta.url);
let data;
try { data = JSON.parse(fs.readFileSync(file, 'utf8')); }
catch (error) { console.error(`Could not parse content/puzzles.json: ${error.message}`); process.exit(1); }
const fail = message => { console.error(`Puzzle validation failed: ${message}`); process.exitCode = 1; };
if (data.version !== 1) fail('version must be 1.');
if (!/^\d{4}-\d{2}-\d{2}$/.test(data.startDate || '')) fail('startDate must use YYYY-MM-DD.');
if (data.timezone !== 'Asia/Kolkata') fail('timezone must be Asia/Kolkata.');
if (!Array.isArray(data.puzzles) || !data.puzzles.length) fail('puzzles must be a non-empty array.');
const dates = new Set();
for (const puzzle of data.puzzles || []) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(puzzle.date || '')) { fail(`invalid date: ${puzzle.date}`); continue; }
  if (dates.has(puzzle.date)) fail(`duplicate puzzle date: ${puzzle.date}`);
  dates.add(puzzle.date);
  if (!Number.isInteger(puzzle.puzzleNumber) || puzzle.puzzleNumber < 1) fail(`${puzzle.date}: puzzleNumber must be a positive integer.`);
  if (!Array.isArray(puzzle.rows) || !puzzle.rows.length || !puzzle.rows.every(r => typeof r === 'string' && r.length === puzzle.rows[0].length)) { fail(`${puzzle.date}: rows must be a rectangular array of strings.`); continue; }
  try {
    const grid = validateCrossword(puzzle);
    if (grid.some(row => row.length !== puzzle.rows[0].length)) fail(`${puzzle.date}: grid dimensions mismatch.`);
  } catch (error) { fail(`${puzzle.date}: ${error.message}`); }
}
if (!process.exitCode) console.log(`Validated ${data.puzzles.length} puzzle(s). Remember: the bundled JSON exposes answer data to visitors.`);
