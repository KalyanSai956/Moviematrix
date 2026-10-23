import { beforeEach, describe, expect, it } from 'vitest';
import puzzleData from '../../content/puzzles.json';
import { dateKeyInIST } from '../lib/date.js';
import { GAME_CYCLE, gameTypeForDate, resolveDailyPuzzle, resultGameType, validateGameEntry } from '../lib/schedule.js';
import { calculateStats, readProgress, saveResult } from '../lib/storage.js';

const START = '2026-10-22';

describe('three-day game rotation', () => {
  it('maps consecutive dates to crossword, BGM, Hangman and repeats', () => {
    expect(GAME_CYCLE).toEqual(['crossword', 'bgm', 'hangman']);
    expect(gameTypeForDate(START, '2026-10-22')).toBe('crossword');
    expect(gameTypeForDate(START, '2026-10-23')).toBe('bgm');
    expect(gameTypeForDate(START, '2026-10-24')).toBe('hangman');
    expect(gameTypeForDate(START, '2026-10-25')).toBe('crossword');
    expect(gameTypeForDate(START, '2026-10-26')).toBe('bgm');
  });

  it('is stable across month and year boundaries', () => {
    expect(gameTypeForDate(START, '2026-10-31')).toBe('crossword'); // day 10
    expect(gameTypeForDate(START, '2026-11-01')).toBe('bgm');
    // 2026-12-31 is day 71, 2027-01-01 is day 72, 2027-01-02 is day 73
    expect(gameTypeForDate(START, '2026-12-31')).toBe('bgm');
    expect(gameTypeForDate(START, '2027-01-01')).toBe('hangman');
    expect(gameTypeForDate(START, '2027-01-02')).toBe('crossword');
  });

  it('rejects malformed dates instead of guessing', () => {
    expect(gameTypeForDate(START, 'nope')).toBeNull();
    expect(gameTypeForDate('nope', START)).toBeNull();
    expect(gameTypeForDate(START, '2026-02-31')).toBeNull();
  });

  it('switches game at midnight in Asia/Kolkata, not UTC', () => {
    const justBefore = new Date('2026-10-23T18:29:59.000Z'); // 23:59:59 IST on the 23rd
    const midnight = new Date('2026-10-23T18:30:00.000Z');   // 00:00:00 IST on the 24th
    expect(gameTypeForDate(START, dateKeyInIST(justBefore))).toBe('bgm');
    expect(gameTypeForDate(START, dateKeyInIST(midnight))).toBe('hangman');
    // 00:30 UTC on the 24th is already 06:00 IST on the 24th
    expect(gameTypeForDate(START, dateKeyInIST(new Date('2026-10-24T00:30:00.000Z')))).toBe('hangman');
  });
});

describe('bundled puzzle data follows the rotation', () => {
  it('every entry matches its scheduled game type and dates are unique', () => {
    const seen = new Set();
    for (const entry of puzzleData.puzzles) {
      expect(seen.has(entry.date)).toBe(false);
      seen.add(entry.date);
      expect(entry.gameType ?? 'crossword').toBe(gameTypeForDate(puzzleData.startDate, entry.date));
    }
  });

  it('resolves the first four days as specified', () => {
    const kinds = ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map((d) => resolveDailyPuzzle(puzzleData, d));
    expect(kinds.map((k) => k.gameType)).toEqual(['crossword', 'bgm', 'hangman', 'crossword']);
    expect(kinds.every((k) => k.status === 'ready')).toBe(true);
  });

  it('keeps the 2026-10-22 crossword as a legacy-shaped entry', () => {
    const first = puzzleData.puzzles.find((p) => p.date === '2026-10-22');
    expect(first.gameType).toBeUndefined();
    expect(first.puzzleNumber).toBe(1);
    expect(first.answers).toHaveLength(10);
  });
});

describe('resolveDailyPuzzle', () => {
  const data = (puzzles) => ({ startDate: START, puzzles });
  it('reports a missing entry without substituting another game', () => {
    const r = resolveDailyPuzzle(data([]), '2026-10-23');
    expect(r.status).toBe('missing');
    expect(r.gameType).toBe('bgm');
    expect(r.puzzle).toBeNull();
  });
  it('reports an entry of the wrong game type as invalid', () => {
    const r = resolveDailyPuzzle(data([{ date: '2026-10-23', rows: ['.'], answers: [] }]), '2026-10-23');
    expect(r.status).toBe('invalid');
    expect(r.puzzle).toBeNull();
  });
  it('reports a BGM entry with no audio as invalid', () => {
    const r = resolveDailyPuzzle(data([{ date: '2026-10-23', gameType: 'bgm', answer: 'Pokiri' }]), '2026-10-23');
    expect(r.status).toBe('invalid');
    expect(r.error).toMatch(/audio/i);
  });
  it('reports a Hangman entry with no hint as invalid', () => {
    const r = resolveDailyPuzzle(data([{ date: '2026-10-24', gameType: 'hangman', answer: 'Pokiri' }]), '2026-10-24');
    expect(r.status).toBe('invalid');
    expect(r.error).toMatch(/hint/i);
  });
  it('never echoes the answer in an error message', () => {
    const r = resolveDailyPuzzle(data([{ date: '2026-10-24', gameType: 'hangman', answer: 'Secret Title' }]), '2026-10-24');
    expect(r.error.toLowerCase().includes('secret')).toBe(false);
  });
});

describe('entry validation', () => {
  it('accepts well-formed BGM and Hangman entries', () => {
    expect(validateGameEntry({ gameType: 'bgm', answer: 'DJ Tillu', audio: '/audio/bgm/x.mp3' })).toEqual([]);
    expect(validateGameEntry({ gameType: 'bgm', answer: 'RRR', audio: 'https://cdn.example.com/a.ogg' })).toEqual([]);
    expect(validateGameEntry({ gameType: 'hangman', answer: 'K.G.F: Chapter 2', hint: 'A hint' })).toEqual([]);
  });
  it('rejects bad audio sources', () => {
    for (const audio of [undefined, '', 'audio/x.mp3', 'http://a/b.mp3', '/a/../b.mp3', '/a/b.txt', '//evil.com/a.mp3']) {
      expect(validateGameEntry({ gameType: 'bgm', answer: 'Pokiri', audio }).length > 0).toBe(true);
    }
  });
  it('rejects bad answers', () => {
    for (const answer of [undefined, '', ' Pokiri', 'Po  kiri', 'A', '###']) {
      expect(validateGameEntry({ gameType: 'hangman', answer, hint: 'h' }).length > 0).toBe(true);
    }
  });
});

/* ---- progress storage: backward compatibility, one result per day ---- */
function memoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}

describe('progress storage', () => {
  beforeEach(() => { globalThis.localStorage = memoryStorage(); });

  it('reads results saved before the rotation existed as crosswords', () => {
    localStorage.setItem('moviematrix.progress.v1', JSON.stringify({
      version: 1,
      results: { '2026-10-22': { date: '2026-10-22', won: true, score: 10, total: 10, answers: 10, submittedAt: 'x' } },
    }));
    const progress = readProgress();
    expect(resultGameType(progress.results['2026-10-22'])).toBe('crossword');
    expect(calculateStats(progress, '2026-10-22').wins).toBe(1);
  });

  it('keeps one result per date and game', () => {
    saveResult('2026-10-23', { won: true, score: 1, total: 1, gameType: 'bgm' });
    const again = saveResult('2026-10-23', { won: false, score: 0, total: 1, gameType: 'bgm' });
    expect(again.results['2026-10-23'].won).toBe(true);
    expect(Object.keys(readProgress().results)).toHaveLength(1);
  });

  it('does not let a result for one date touch another date', () => {
    saveResult('2026-10-23', { won: true, score: 1, total: 1, gameType: 'bgm' });
    saveResult('2026-10-24', { won: false, score: 0, total: 1, gameType: 'hangman' });
    const { results } = readProgress();
    expect(results['2026-10-23'].gameType).toBe('bgm');
    expect(results['2026-10-24'].won).toBe(false);
  });

  it('lets today\'s game replace a leftover record from a different game on the same date', () => {
    saveResult('2026-10-23', { won: true, score: 10, total: 10, answers: 10 }); // legacy crossword record
    const next = saveResult('2026-10-23', { won: false, score: 0, total: 1, gameType: 'bgm' });
    expect(next.results['2026-10-23'].gameType).toBe('bgm');
  });

  it('still refuses a second crossword result for the same date', () => {
    saveResult('2026-10-22', { won: true, score: 10, total: 10, answers: 10 });
    const next = saveResult('2026-10-22', { won: false, score: 3, total: 10, answers: 10 });
    expect(next.results['2026-10-22'].score).toBe(10);
  });
});
