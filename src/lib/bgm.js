import { guessableCount, layoutTitle, normalizeTitle } from './titles.js';

export const emptySlots = (answer) => Array(guessableCount(answer)).fill('');

/* Rebuild the player's guess as text: typed letters + the fixed characters
   (digits / punctuation), with words separated by one space. */
export function composeGuess(answer, slots) {
  let i = 0;
  return layoutTitle(answer)
    .map((word) => word.map((c) => (c.guessable ? slots[i++] || '' : c.ch)).join(''))
    .join(' ');
}

/* status: 'empty' | 'incomplete' | 'correct' | 'incorrect' */
export function checkBgmGuess(answer, guess) {
  const given = normalizeTitle(guess);
  const wanted = normalizeTitle(answer);
  if (!given) return { status: 'empty' };
  if (given.length < wanted.length) return { status: 'incomplete' };
  return { status: given === wanted ? 'correct' : 'incorrect' };
}

export const slotsComplete = (slots) => slots.length > 0 && slots.every(Boolean);

export function typeLetter(slots, cursor, letter) {
  const next = slots.slice();
  next[cursor] = letter;
  return { slots: next, cursor: Math.min(slots.length - 1, cursor + 1) };
}

export function eraseLetter(slots, cursor) {
  const next = slots.slice();
  if (next[cursor]) {
    next[cursor] = '';
    return { slots: next, cursor };
  }
  if (cursor > 0) {
    next[cursor - 1] = '';
    return { slots: next, cursor: cursor - 1 };
  }
  return { slots: next, cursor };
}
