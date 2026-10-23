export const cellKey = (row, col) => `${row}:${col}`;

const isOpen = (rows, row, col) =>
  row >= 0 && row < rows.length && col >= 0 && col < rows[0].length && rows[row][col] !== '#';

export function clueNumbers(rows) {
  const numbers = new Map();
  let number = 0;
  rows.forEach((line, row) => {
    [...line].forEach((cell, col) => {
      if (cell === '#') return;
      const across = !isOpen(rows, row, col - 1) && isOpen(rows, row, col + 1);
      const down = !isOpen(rows, row - 1, col) && isOpen(rows, row + 1, col);
      if (across || down) numbers.set(cellKey(row, col), ++number);
    });
  });
  return numbers;
}

export function solutionGrid(puzzle) {
  const rows = puzzle?.rows;
  if (!Array.isArray(rows) || !rows.length ||
      rows.some(row => typeof row !== 'string' || !row.length || row.length !== rows[0].length || !/^[.#]+$/.test(row))) {
    throw new Error('rows must be a non-empty rectangular grid containing only "." (open) and "#" (blocked) cells.');
  }
  if (!Array.isArray(puzzle.answers) || !puzzle.answers.length) throw new Error('Puzzle needs at least one answer.');
  const grid = rows.map(row => [...row].map(cell => cell === '#' ? '#' : ''));
  for (const entry of puzzle.answers) {
    if (!entry || !Number.isInteger(entry.row) || !Number.isInteger(entry.col) || entry.row < 0 || entry.col < 0) {
      throw new Error(`Answer ${entry?.number ?? '?'} position must use non-negative integer row and col.`);
    }
    if (!['across', 'down'].includes(entry.direction)) throw new Error(`Answer ${entry.number ?? '?'} direction must be across or down.`);
    if (!/^[A-Z]+$/.test(entry.answer || '')) throw new Error(`Answer ${entry.number ?? '?'} must contain A–Z letters only.`);
    if (!entry.clue?.trim()) throw new Error(`Answer ${entry.number ?? '?'} needs a clue.`);
    for (let i = 0; i < entry.answer.length; i++) {
      const row = entry.row + (entry.direction === 'down' ? i : 0);
      const col = entry.col + (entry.direction === 'across' ? i : 0);
      if (!isOpen(rows, row, col)) throw new Error(`Answer ${entry.number} (${entry.direction}) extends outside open grid cells at row ${row}, column ${col}.`);
      const letter = entry.answer[i];
      if (grid[row][col] && grid[row][col] !== letter) throw new Error(`Answer ${entry.number} conflicts at row ${row}, column ${col}: ${grid[row][col]} vs ${letter}.`);
      grid[row][col] = letter;
    }
    const beforeRow = entry.row - (entry.direction === 'down' ? 1 : 0);
    const beforeCol = entry.col - (entry.direction === 'across' ? 1 : 0);
    const afterRow = entry.row + (entry.direction === 'down' ? entry.answer.length : 0);
    const afterCol = entry.col + (entry.direction === 'across' ? entry.answer.length : 0);
    if (isOpen(rows, beforeRow, beforeCol)) throw new Error(`Answer ${entry.number} does not start at the beginning of its ${entry.direction} entry.`);
    if (isOpen(rows, afterRow, afterCol)) throw new Error(`Answer ${entry.number} is shorter than its ${entry.direction} slot in rows.`);
  }
  const seen = new Set();
  const starts = clueNumbers(rows);
  for (const entry of puzzle.answers) {
    const key = `${entry.row}:${entry.col}:${entry.direction}`;
    if (seen.has(key)) throw new Error(`Duplicate ${entry.direction} answer start at row ${entry.row}, column ${entry.col}.`);
    seen.add(key);
    const expected = starts.get(cellKey(entry.row, entry.col));
    if (expected === undefined || expected !== entry.number) throw new Error(`Answer ${entry.number} clue number mismatch at row ${entry.row}, column ${entry.col}; grid numbering is ${expected ?? 'not a clue start'}.`);
  }
  if (!puzzle.answers.some(e => e.direction === 'across') || !puzzle.answers.some(e => e.direction === 'down')) {
    throw new Error('A valid crossword must contain at least one Across and one Down answer; independent questions are not a crossword.');
  }
  const covered = new Set();
  for (const entry of puzzle.answers) [...entry.answer].forEach((_, i) => covered.add(cellKey(entry.row + (entry.direction === 'down' ? i : 0), entry.col + (entry.direction === 'across' ? i : 0))));
  rows.forEach((line, r) => [...line].forEach((cell, c) => {
    if (cell === '.' && !covered.has(cellKey(r, c))) throw new Error(`Open grid cell at row ${r}, column ${c} is not covered by an answer.`);
  }));
  return grid;
}

export function validateCrossword(puzzle) {
  return solutionGrid(puzzle);
}

export function answerIsCorrect(entry, letters) {
  return [...entry.answer].every((letter, i) =>
    letters[cellKey(entry.row + (entry.direction === 'down' ? i : 0), entry.col + (entry.direction === 'across' ? i : 0))]?.toUpperCase() === letter);
}
