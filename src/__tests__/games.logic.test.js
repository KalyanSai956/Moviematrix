import { describe, expect, it } from 'vitest';
import { checkBgmGuess, composeGuess, emptySlots, eraseLetter, slotsComplete, typeLetter } from '../lib/bgm.js';
import { MAX_WRONG, applyGuess, boardWords, deriveGame, parseGuess } from '../lib/hangman.js';
import { guessableCount, layoutTitle, letterFromKeyEvent, normalizeTitle } from '../lib/titles.js';

describe('title normalisation and layout', () => {
  it('ignores case, outer/repeated spaces and punctuation', () => {
    expect(normalizeTitle('  dj   tillu ')).toBe('DJTILLU');
    expect(normalizeTitle('D.J. Tillu')).toBe('DJTILLU');
    expect(normalizeTitle('Geetha-Govindam')).toBe('GEETHAGOVINDAM');
    expect(normalizeTitle('Pokirí')).toBe('POKIRI');
  });
  it('gives one guessable box per letter and keeps word boundaries', () => {
    const words = layoutTitle('Geetha Govindam');
    expect(words).toHaveLength(2);
    expect(words[0]).toHaveLength(6);
    expect(guessableCount('Geetha Govindam')).toBe(14);
  });
  it('treats digits and punctuation as fixed, not guessable', () => {
    const [kgf, ch, two] = layoutTitle('K.G.F: Chapter 2');
    expect(kgf.filter((c) => c.guessable)).toHaveLength(3);
    expect(ch).toHaveLength(7);
    expect(two[0].guessable).toBe(false);
    expect(guessableCount('K.G.F: Chapter 2')).toBe(10);
  });
});

describe('BGM answer checking', () => {
  const answer = 'DJ Tillu';
  it('creates one empty slot per letter', () => {
    expect(emptySlots(answer)).toHaveLength(7);
  });
  it('rejects empty and incomplete submissions', () => {
    expect(checkBgmGuess(answer, '').status).toBe('empty');
    expect(checkBgmGuess(answer, '   ').status).toBe('empty');
    expect(checkBgmGuess(answer, 'DJ Til').status).toBe('incomplete');
    expect(checkBgmGuess(answer, composeGuess(answer, ['D', 'J', 'T', '', 'L', 'L', 'U'])).status).toBe('incomplete');
  });
  it('compares case-insensitively and ignores spacing/punctuation', () => {
    for (const guess of ['DJ Tillu', 'dj tillu', '  DJTILLU ', 'D.J.   Tillu']) {
      expect(checkBgmGuess(answer, guess).status).toBe('correct');
    }
  });
  it('marks a complete wrong answer incorrect', () => {
    expect(checkBgmGuess(answer, 'DJ Tilly').status).toBe('incorrect');
    expect(checkBgmGuess(answer, 'DJ Tilluu').status).toBe('incorrect');
  });
  it('builds a complete guess from slots, including fixed characters', () => {
    const partial = ['B', 'A', 'A', 'H', 'U', 'B', 'A', 'L', ''];
    const full = ['B', 'A', 'A', 'H', 'U', 'B', 'A', 'L', 'I'];
    expect(slotsComplete(partial)).toBe(false);
    expect(slotsComplete(full)).toBe(true);
    expect(composeGuess('Baahubali 2', full)).toBe('BAAHUBALI 2');
    expect(checkBgmGuess('Baahubali 2', composeGuess('Baahubali 2', full)).status).toBe('correct');
    expect(checkBgmGuess('Baahubali 2', composeGuess('Baahubali 2', partial)).status).toBe('incomplete');
  });
  it('types and erases letters like the crossword does', () => {
    let state = { slots: emptySlots('Eega'), cursor: 0 };
    state = typeLetter(state.slots, state.cursor, 'E');
    state = typeLetter(state.slots, state.cursor, 'E');
    expect(state.slots.join('')).toBe('EE');
    expect(state.cursor).toBe(2);
    state = eraseLetter(state.slots, state.cursor);
    expect(state.slots.join('')).toBe('E');
    state = typeLetter(state.slots, 3, 'A');
    expect(state.cursor).toBe(3); // clamps on the last box
  });
});

describe('Hangman guess parsing', () => {
  it('accepts exactly one letter and upper-cases it', () => {
    expect(parseGuess('a')).toEqual({ ok: true, letter: 'A' });
    expect(parseGuess(' z ')).toEqual({ ok: true, letter: 'Z' });
  });
  it('rejects empty, multiple and non-letter input', () => {
    expect(parseGuess('').reason).toBe('empty');
    expect(parseGuess('   ').reason).toBe('empty');
    expect(parseGuess('ab').reason).toBe('multiple');
    expect(parseGuess('7').reason).toBe('not-letter');
    expect(parseGuess('!').reason).toBe('not-letter');
    expect(parseGuess('é').reason).toBe('not-letter');
  });
});

describe('Hangman rules', () => {
  const answer = 'Eega';

  it('reveals every occurrence of a correct letter without costing a chance', () => {
    const r = applyGuess(answer, [], 'e');
    expect(r.status).toBe('correct');
    expect(r.count).toBe(2);
    expect(r.state.remaining).toBe(MAX_WRONG);
    expect(boardWords(answer, r.guesses)[0].map((c) => c.kind)).toEqual(['revealed', 'revealed', 'hidden', 'hidden']);
  });

  it('keeps hidden letters out of the view model until the game ends', () => {
    const hidden = boardWords(answer, ['E']).flat().filter((c) => c.kind === 'hidden');
    expect(hidden.every((c) => c.ch === '')).toBe(true);
  });

  it('deducts one chance per distinct wrong letter', () => {
    let guesses = [];
    for (const [i, letter] of ['q', 'x', 'z'].entries()) {
      const r = applyGuess(answer, guesses, letter);
      expect(r.status).toBe('wrong');
      guesses = r.guesses;
      expect(r.state.remaining).toBe(MAX_WRONG - (i + 1));
    }
  });

  it('does not deduct for repeated or invalid guesses', () => {
    const first = applyGuess(answer, [], 'q');
    const repeat = applyGuess(answer, first.guesses, 'Q');
    expect(repeat.status).toBe('repeat');
    expect(repeat.guesses).toEqual(first.guesses);
    expect(repeat.state.remaining).toBe(4);
    const repeatCorrect = applyGuess(answer, applyGuess(answer, [], 'e').guesses, 'e');
    expect(repeatCorrect.status).toBe('repeat');
    for (const bad of ['', '1', 'ab', '?']) {
      const r = applyGuess(answer, first.guesses, bad);
      expect(r.status).toBe('invalid');
      expect(r.state.remaining).toBe(4);
      expect(r.guesses).toEqual(first.guesses);
    }
  });

  it('is lost after exactly five distinct wrong letters and then locks', () => {
    let guesses = [];
    for (const letter of 'QXZWJ') guesses = applyGuess(answer, guesses, letter).guesses;
    const state = deriveGame(answer, guesses);
    expect(state.phase).toBe('lost');
    expect(state.remaining).toBe(0);
    const locked = applyGuess(answer, guesses, 'e');
    expect(locked.status).toBe('closed');
    expect(locked.guesses).toEqual(guesses);
    const revealed = boardWords(answer, guesses, true).flat();
    expect(revealed.map((c) => c.ch).join('')).toBe('EEGA');
  });

  it('is still in play after four wrong letters', () => {
    let guesses = [];
    for (const letter of 'QXZW') guesses = applyGuess(answer, guesses, letter).guesses;
    expect(deriveGame(answer, guesses).phase).toBe('playing');
  });

  it('is won when every letter is revealed, even after some misses', () => {
    let guesses = applyGuess(answer, [], 'q').guesses;
    for (const letter of 'ega') guesses = applyGuess(answer, guesses, letter).guesses;
    const state = deriveGame(answer, guesses);
    expect(state.phase).toBe('won');
    expect(state.remaining).toBe(4);
    expect(applyGuess(answer, guesses, 'z').status).toBe('closed');
  });

  it('is not won while any letter is missing', () => {
    expect(deriveGame(answer, ['E', 'G']).phase).toBe('playing');
  });

  it('handles multi-word titles and fixed characters', () => {
    const title = 'Geetha Govindam';
    const view = boardWords(title, ['G']);
    expect(view).toHaveLength(2);
    expect(view[0][0].kind).toBe('revealed');
    expect(view[1][0].kind).toBe('revealed');
    const withDigit = boardWords('Baahubali 2', []);
    expect(withDigit[1][0]).toEqual({ ch: '2', kind: 'fixed' });
    expect(deriveGame('Baahubali 2', ['B', 'A', 'H', 'U', 'L', 'I']).phase).toBe('won');
  });
});

describe('keyboard event to letter', () => {
  it('uses event.key for Latin letters, any layout or case', () => {
    expect(letterFromKeyEvent({ key: 'a', code: 'KeyA' })).toBe('A');
    expect(letterFromKeyEvent({ key: 'Q', code: 'KeyA' })).toBe('Q'); // AZERTY: key wins over position
  });
  it('falls back to the physical key when an input method reports Process or a native character', () => {
    expect(letterFromKeyEvent({ key: 'Process', code: 'KeyM' })).toBe('M');
    expect(letterFromKeyEvent({ key: 'అ', code: 'KeyA' })).toBe('A');
  });
  it('ignores non-letters', () => {
    for (const e of [{ key: '7', code: 'Digit7' }, { key: 'Enter', code: 'Enter' }, { key: 'Shift', code: 'ShiftLeft' }, {}]) {
      expect(letterFromKeyEvent(e)).toBeNull();
    }
  });
});
