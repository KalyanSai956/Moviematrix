import { describe, expect, it } from 'vitest';
import { dateKeyInIST, dayNumber, secondsUntilNextPuzzle } from '../lib/date.js';
import { solutionGrid, validateCrossword } from '../lib/crossword.js';

const puzzle = { rows: ['.##', '...', '.##'], answers: [
  { number: 1, direction: 'down', row: 0, col: 0, answer: 'RRR', clue: 'Test down' },
  { number: 2, direction: 'across', row: 1, col: 0, answer: 'RRR', clue: 'Test across' }
] };

describe('IST daily date logic', () => {
  it('uses the calendar date in India rather than UTC', () => {
    expect(dateKeyInIST(new Date('2026-10-21T19:00:00.000Z'))).toBe('2026-10-22');
  });
  it('calculates day numbers from the configured launch date', () => {
    expect(dayNumber('2026-10-22', '2026-10-22')).toBe(1);
    expect(dayNumber('2026-10-22', '2026-10-23')).toBe(2);
  });
  it('returns a positive number of seconds until the next IST midnight', () => {
    expect(secondsUntilNextPuzzle(
  new Date('2026-10-22T06:30:00.000Z')
)).toBe(12 * 60 * 60);
  });
});

describe('crossword schema', () => {
  it('builds an answer grid and accepts consistent intersections', () => {
    const clean = puzzle;
    expect(validateCrossword(clean)).toHaveLength(3);
    expect(solutionGrid(clean)[1]).toEqual(['R', 'R', 'R']);
  });
  it('rejects conflicting intersections', () => {
    const bad = { rows: ['.##', '...', '.##'], answers: [
      puzzle.answers[0], { number: 2, direction: 'across', row: 1, col: 0, answer: 'ABC', clue: 'Conflicts' }
    ] };
    expect(() => validateCrossword(bad)).toThrow(/conflicts/i);
  });
});

describe('strict crossword validation', () => {
  it('rejects independent question lists without both directions', () => {
    expect(() => validateCrossword({ rows: ['...'], answers: [
      { number: 1, direction: 'across', row: 0, col: 0, answer: 'ABC', clue: 'Only across' }
    ] })).toThrow(/Across and one Down/i);
  });
  it('rejects answers that do not fit the grid slot', () => {
    expect(() => validateCrossword({ rows: ['..#', '...'], answers: [
      { number: 1, direction: 'across', row: 0, col: 0, answer: 'ABC', clue: 'Too long' },
      { number: 2, direction: 'down', row: 0, col: 0, answer: 'AB', clue: 'Down' }
    ] })).toThrow(/open grid cells|shorter than its/i);
  });
});
