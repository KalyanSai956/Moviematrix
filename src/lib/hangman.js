import { layoutTitle } from './titles.js';

/* Five chances = five DISTINCT WRONG letters. Correct, repeated and invalid
   input never consume a chance. */
export const MAX_WRONG = 5;

/* reason: 'empty' | 'multiple' | 'not-letter' */
export function parseGuess(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return { ok: false, reason: 'empty' };
  if ([...raw].length !== 1) return { ok: false, reason: 'multiple' };
  if (!/^[A-Za-z]$/.test(raw)) return { ok: false, reason: 'not-letter' };
  return { ok: true, letter: raw.toUpperCase() };
}

export function answerLetters(answer) {
  return new Set([...String(answer ?? '').toUpperCase()].filter((c) => /^[A-Z]$/.test(c)));
}

/* guesses: ordered list of distinct, valid, upper-case letters */
export function deriveGame(answer, guesses) {
  const letters = answerLetters(answer);
  const correct = guesses.filter((l) => letters.has(l));
  const wrong = guesses.filter((l) => !letters.has(l));
  const solved = letters.size > 0 && [...letters].every((l) => guesses.includes(l));
  const phase = solved ? 'won' : wrong.length >= MAX_WRONG ? 'lost' : 'playing';
  return { correct, wrong, remaining: Math.max(0, MAX_WRONG - wrong.length), phase, solved };
}

/* status: 'closed' | 'invalid' | 'repeat' | 'correct' | 'wrong' */
export function applyGuess(answer, guesses, input) {
  const before = deriveGame(answer, guesses);
  if (before.phase !== 'playing') return { status: 'closed', guesses, state: before };
  const parsed = parseGuess(input);
  if (!parsed.ok) return { status: 'invalid', reason: parsed.reason, guesses, state: before };
  const { letter } = parsed;
  if (guesses.includes(letter)) return { status: 'repeat', letter, guesses, state: before };
  const next = [...guesses, letter];
  const count = [...String(answer).toUpperCase()].filter((c) => c === letter).length;
  return {
    status: count > 0 ? 'correct' : 'wrong',
    letter,
    count,
    guesses: next,
    state: deriveGame(answer, next),
  };
}

/* View model. Hidden letters carry NO character, so the answer is never in the
   DOM before the game ends. `showAll` (game over) reveals the rest as 'missed'. */
export function boardWords(answer, guesses, showAll = false) {
  return layoutTitle(answer).map((word) =>
    word.map(({ ch, guessable }) => {
      if (!guessable) return { ch, kind: 'fixed' };
      if (guesses.includes(ch)) return { ch, kind: 'revealed' };
      return showAll ? { ch, kind: 'missed' } : { ch: '', kind: 'hidden' };
    }),
  );
}

/* In-progress guesses survive a reload so the five chances can't be reset by
   refreshing. Only letters are stored. */
const KEY = 'moviematrix.hangman.v1';

export function loadGuesses(date) {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!saved || saved.date !== date || !Array.isArray(saved.guesses)) return [];
    const seen = new Set();
    return saved.guesses.filter((l) => typeof l === 'string' && /^[A-Z]$/.test(l) && !seen.has(l) && seen.add(l));
  } catch {
    return [];
  }
}

export function saveGuesses(date, guesses) {
  try { localStorage.setItem(KEY, JSON.stringify({ date, guesses })); } catch { /* storage unavailable: game still works */ }
}
