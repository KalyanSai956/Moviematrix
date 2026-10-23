import { dayNumber } from './date.js';

/* Repeating three-day rotation, anchored on puzzles.json `startDate` and the
   Asia/Kolkata date keys produced by date.js (never the browser's local date).
   Day 1 of the cycle is the existing crossword. */
export const GAME_CYCLE = ['crossword', 'bgm', 'hangman'];
export const GAME_LABELS = { crossword: 'Tollywood Crossword', bgm: 'BGM Movie Guess', hangman: 'Hangman' };
export const GAME_NOUNS = { crossword: 'crossword', bgm: 'BGM challenge', hangman: 'Hangman game' };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isRealDate(value) {
  if (!DATE_RE.test(value || '')) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function gameTypeForDate(startDate, dateKey) {
  if (!isRealDate(startDate) || !isRealDate(dateKey)) return null;
  const n = dayNumber(startDate, dateKey);
  return GAME_CYCLE[(((n - 1) % GAME_CYCLE.length) + GAME_CYCLE.length) % GAME_CYCLE.length];
}

/* A saved result without gameType predates the rotation and is a crossword. */
export const resultGameType = (result) => result?.gameType ?? 'crossword';

const AUDIO_EXT = /\.(mp3|ogg|oga|wav|m4a|aac|webm)$/i;
const ANSWER_RE = /^[A-Za-z0-9][A-Za-z0-9 .,'’:&!?-]*$/;
const letterCount = (s) => (String(s).match(/[A-Za-z]/g) || []).length;

function answerErrors(entry, minLetters) {
  if (typeof entry.answer !== 'string' || !entry.answer.trim()) return ['answer is required.'];
  const errors = [];
  if (entry.answer !== entry.answer.trim() || /\s{2,}/.test(entry.answer)) errors.push('answer must not have leading, trailing or repeated spaces.');
  if (!ANSWER_RE.test(entry.answer)) errors.push('answer may only contain A–Z, 0–9, spaces and . , \' : & ! ? -');
  if (letterCount(entry.answer) < minLetters) errors.push(`answer needs at least ${minLetters} letters.`);
  return errors;
}

export function validateAudioSource(src) {
  if (typeof src !== 'string' || !src.trim()) return 'audio is required (e.g. "/audio/bgm/2026-10-23.mp3").';
  const isLocal = src.startsWith('/') && !src.startsWith('//') && !src.includes('..');
  const isHttps = /^https:\/\/[^\s]+$/.test(src);
  if (!isLocal && !isHttps) return 'audio must be a root-relative path like "/audio/bgm/DATE.mp3" or an https:// URL.';
  if (!AUDIO_EXT.test(src.split(/[?#]/)[0])) return 'audio must point to .mp3, .ogg, .oga, .wav, .m4a, .aac or .webm.';
  return null;
}

export function validateBgmEntry(entry) {
  const errors = answerErrors(entry, 2);
  const audioError = validateAudioSource(entry.audio);
  if (audioError) errors.push(audioError);
  return errors;
}

export function validateHangmanEntry(entry) {
  const errors = answerErrors(entry, 3);
  if (typeof entry.hint !== 'string' || !entry.hint.trim()) errors.push('hint is required.');
  return errors;
}

/* Field validation for the non-crossword games. Crosswords keep using
   crossword.js (which the Crossword component already runs itself). */
export function validateGameEntry(entry) {
  if (entry?.gameType === 'bgm') return validateBgmEntry(entry);
  if (entry?.gameType === 'hangman') return validateHangmanEntry(entry);
  return [`unknown gameType "${entry?.gameType}".`];
}

/* One place that decides what today's game is and whether its data is usable.
   status: 'ready' | 'missing' | 'invalid'. Never substitutes another game. */
export function resolveDailyPuzzle(data, dateKey) {
  const gameType = gameTypeForDate(data?.startDate, dateKey);
  if (!gameType) return { status: 'invalid', gameType: null, puzzle: null, error: 'The puzzle schedule has an invalid start date.' };
  const entry = (data.puzzles || []).find((p) => p.date === dateKey);
  if (!entry) return { status: 'missing', gameType, puzzle: null, error: '' };
  const declared = entry.gameType ?? 'crossword';
  if (declared !== gameType) {
    return { status: 'invalid', gameType, puzzle: null, error: `The ${dateKey} entry is a "${declared}" puzzle but the schedule expects "${gameType}".` };
  }
  if (gameType !== 'crossword') {
    const errors = validateGameEntry(entry);
    if (errors.length) return { status: 'invalid', gameType, puzzle: null, error: errors.join(' ') };
  }
  return { status: 'ready', gameType, puzzle: entry, error: '' };
}
