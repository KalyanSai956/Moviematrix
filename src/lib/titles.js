/* Shared helpers for movie-title games (BGM Movie Guess, Hangman).

   Answer-matching rule (documented, used everywhere):
     1. Unicode-decompose and drop accents, then upper-case.
     2. Keep only A–Z and 0–9. Spaces, repeated spaces, punctuation and
        leading/trailing whitespace are ignored.
   So "  dj   tillu " === "DJ Tillu" === "D.J. Tillu".

   Display rule: the title is split into words on whitespace. A–Z characters are
   "guessable" (they get a box the player fills / reveals). Digits and punctuation
   are "fixed": they are shown as-is and never need to be guessed. */

export function normalizeTitle(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export const isGuessable = (ch) => /^[A-Z]$/.test(ch);

/* words -> characters -> { ch, guessable } (ch is upper-case) */
export function layoutTitle(answer) {
  return String(answer ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => [...word.toUpperCase()].map((ch) => ({ ch, guessable: isGuessable(ch) })));
}

export function guessableCount(answer) {
  return layoutTitle(answer).flat().filter((c) => c.guessable).length;
}

export function longestWord(answer) {
  return layoutTitle(answer).reduce((max, word) => Math.max(max, word.length), 0);
}

/* A–Z letter for a keydown event. Uses event.key when it is a Latin letter; otherwise falls
   back to the physical key (event.code) so an active input method (Telugu/Hindi keyboard,
   Google Input Tools, ...) that reports key "Process" or a native character still types. */
export function letterFromKeyEvent(event) {
  if (/^[a-z]$/i.test(event.key || '')) return event.key.toUpperCase();
  const match = /^Key([A-Z])$/.exec(event.code || '');
  return match ? match[1] : null;
}
