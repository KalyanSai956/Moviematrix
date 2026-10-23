import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { cellKey, validateCrossword } from "../../lib/crossword.js";
import { track } from "../../lib/analytics.js";

/* On-screen keyboard: QWERTY stagger. `pad` is a half-key spacer. */
const KEY_ROWS = [
  { keys: "QWERTYUIOP" },
  { keys: "ASDFGHJKL", pad: 0.5 },
  { keys: "ZXCVBNM", pad: 1, back: true },
];

const ARROWS = {
  ArrowLeft: ["across", -1],
  ArrowRight: ["across", 1],
  ArrowUp: ["down", -1],
  ArrowDown: ["down", 1],
};

const cellAt = (entry, i) => ({
  row: entry.row + (entry.direction === "down" ? i : 0),
  col: entry.col + (entry.direction === "across" ? i : 0),
});

/* Scroll `container` just enough to show `el`. Never touches ancestors, so the
   locked page can't be shifted the way element.scrollIntoView() can. */
function keepInView(container, el, margin = 10) {
  if (!container || !el) return;
  const c = container.getBoundingClientRect();
  const e = el.getBoundingClientRect();
  if (e.top < c.top + margin) container.scrollTop -= c.top + margin - e.top;
  else if (e.bottom > c.bottom - margin)
    container.scrollTop += e.bottom - (c.bottom - margin);
  if (e.left < c.left + margin)
    container.scrollLeft -= c.left + margin - e.left;
  else if (e.right > c.right - margin)
    container.scrollLeft += e.right - (c.right - margin);
}

export default function Crossword({ puzzle, onSubmit }) {
  const answers = Array.isArray(puzzle?.answers) ? puzzle.answers : [];
  const validation = useMemo(() => {
    try {
      return { grid: validateCrossword(puzzle), error: "" };
    } catch (error) {
      return {
        grid: [],
        error:
          error instanceof Error
            ? error.message
            : "The puzzle data is invalid.",
      };
    }
  }, [puzzle]);
  const solution = validation.grid;

  const [letters, setLetters] = useState({});
  const [active, setActive] = useState(answers[0]);
  const [activeCell, setActiveCell] = useState({
    row: answers[0]?.row ?? 0,
    col: answers[0]?.col ?? 0,
  });
  const [notice, setNotice] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);
  const viewportRef = useRef(null);
  const cluesRef = useRef(null);
  const keyHandler = useRef(() => {});

  /* cell -> entries crossing it */
  const entryCells = useMemo(() => {
    const map = new Map();
    answers.forEach((entry) =>
      [...entry.answer].forEach((_, i) => {
        const { row, col } = cellAt(entry, i);
        const key = cellKey(row, col);
        map.set(key, [...(map.get(key) || []), entry]);
      }),
    );
    return map;
  }, [puzzle]);

  /* clue-number badges */
  const startNumbers = useMemo(() => {
    const map = new Map();
    answers.forEach((e) => map.set(cellKey(e.row, e.col), e.number));
    return map;
  }, [puzzle]);

  /* Across 1..n then Down 1..n — also the order for previous / next clue */
  const across = useMemo(
    () =>
      answers
        .filter((e) => e.direction === "across")
        .sort((a, b) => a.number - b.number),
    [puzzle],
  );
  const down = useMemo(
    () =>
      answers
        .filter((e) => e.direction === "down")
        .sort((a, b) => a.number - b.number),
    [puzzle],
  );
  const ordered = useMemo(() => [...across, ...down], [across, down]);

  const currentIndex = active
    ? [...active.answer].findIndex((_, i) => {
        const c = cellAt(active, i);
        return c.row === activeCell.row && c.col === activeCell.col;
      })
    : -1;

  const activeCellKeys = new Set(
    active
      ? [...active.answer].map((_, i) => {
          const c = cellAt(active, i);
          return cellKey(c.row, c.col);
        })
      : [],
  );

  const entryAt = (cell, direction) =>
    (entryCells.get(cellKey(cell.row, cell.col)) || []).find(
      (e) => e.direction === direction,
    );

  const move = (delta) => {
    const i = currentIndex < 0 ? 0 : currentIndex;
    const next = Math.max(0, Math.min(active.answer.length - 1, i + delta));
    setActiveCell(cellAt(active, next));
  };

  const write = (value) => {
    if (showAnswers) return;
    setLetters((old) => ({
      ...old,
      [cellKey(activeCell.row, activeCell.col)]: value,
    }));
    setNotice("");
    move(1);
  };

  const erase = () => {
    if (showAnswers) return;
    const here = cellKey(activeCell.row, activeCell.col);
    if (letters[here]) {
      setLetters((old) => ({ ...old, [here]: "" }));
    } else if (currentIndex > 0) {
      const prev = cellAt(active, currentIndex - 1);
      setLetters((old) => ({ ...old, [cellKey(prev.row, prev.col)]: "" }));
      setActiveCell(prev);
    }
    setNotice("");
  };

  /* Jump to an entry, landing on its first empty cell */
  const selectEntry = (entry) => {
    const target =
      [...entry.answer]
        .map((_, i) => cellAt(entry, i))
        .find((c) => !letters[cellKey(c.row, c.col)]) || cellAt(entry, 0);
    setActive(entry);
    setActiveCell(target);
    setNotice("");
  };

  const stepClue = (delta) => {
    if (!ordered.length) return;
    const at = ordered.indexOf(active);
    selectEntry(ordered[(at + delta + ordered.length) % ordered.length]);
  };

  const switchDirection = () => {
    const other = entryAt(
      activeCell,
      active.direction === "across" ? "down" : "across",
    );
    if (other) setActive(other);
    else {
      const next = ordered.find((e) => e.direction !== active.direction);
      if (next) selectEntry(next);
    }
  };

  const chooseCell = (row, col) => {
    const here = { row, col };
    const entries = entryCells.get(cellKey(row, col)) || [];
    const sameCell = activeCell.row === row && activeCell.col === col;
    let matching;
    if (sameCell) {
      /* tapping the selected cell again flips direction */
      matching =
        entries.find((e) => e.direction !== active.direction) || active;
    } else {
      matching =
        entries.find((e) => e.direction === active.direction) || entries[0];
    }
    if (matching) {
      setActive(matching);
      track("clue_selected", {
        puzzle_date: puzzle.date,
        clue_number: matching.number,
        direction: matching.direction,
      });
    }
    setActiveCell(here);
    setNotice("");
  };

  const clearAll = () => {
    setLetters({});
    setNotice("");
  };

  const submit = () => {
    const missing = answers.some((entry) =>
      [...entry.answer].some((_, i) => {
        const c = cellAt(entry, i);
        return !letters[cellKey(c.row, c.col)];
      }),
    );
    if (missing) {
      track("check_blocked_incomplete", { puzzle_date: puzzle.date });
      setNotice(
        "Fill every answer before you submit. You still have your attempt.",
      );
      return;
    }
    track("check_clicked", {
      puzzle_date: puzzle.date,
      puzzle_number: puzzle.puzzleNumber,
    });
    const correct = answers.filter((entry) =>
      [...entry.answer].every((letter, i) => {
        const c = cellAt(entry, i);
        return letters[cellKey(c.row, c.col)] === letter;
      }),
    ).length;
    setShowAnswers(true);
    onSubmit({
      won: correct === answers.length,
      score: correct,
      total: answers.length,
      answers: answers.length,
    });
  };

  /* Physical keyboard — listens on window so it works wherever focus is,
     but stays out of the way of modals and form fields. */
  keyHandler.current = (event) => {
    if (showAnswers || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (
      target?.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName)
    )
      return;
    if (document.querySelector(".modal-backdrop, .consent-backdrop")) return;
    if (/^[a-z]$/i.test(event.key)) {
      event.preventDefault();
      write(event.key.toUpperCase());
    } else if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      erase();
    } else if (ARROWS[event.key]) {
      event.preventDefault();
      const [direction, delta] = ARROWS[event.key];
      if (direction === active.direction) move(delta);
      else {
        const other = entryAt(activeCell, direction);
        if (other) setActive(other);
      }
    }
  };
  useEffect(() => {
    const onKey = (event) => flushSync(() => keyHandler.current(event));
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* Keep the selected cell visible when the grid is larger than its window */
  useEffect(() => {
    const viewport = viewportRef.current;
    const el = viewport?.querySelector(
      `[data-cell="${cellKey(activeCell.row, activeCell.col)}"]`,
    );
    keepInView(viewport, el, 14);
  }, [activeCell]);

  /* ...and the selected clue visible in the side list */
  useEffect(() => {
    const panel = cluesRef.current;
    keepInView(panel, panel?.querySelector(".clue-active"), 8);
  }, [active]);

  if (validation.error) {
    return (
      <section className="game-layout" role="alert" aria-live="assertive">
        <div className="board-panel invalid-panel">
          <div className="active-clue">
            <div className="active-clue-text">
              <span>Puzzle unavailable</span>
              <strong>This daily crossword has an invalid layout.</strong>
            </div>
          </div>
          <p className="notice">{validation.error}</p>
          <p>
            Check <code>content/puzzles.json</code> and correct the grid before
            publishing this puzzle.
          </p>
        </div>
      </section>
    );
  }

  const renderClue = (e) => {
    const isActive =
      active.number === e.number && active.direction === e.direction;
    return (
      <button
        key={`${e.direction}-${e.number}`}
        type="button"
        className={`clue ${isActive ? "clue-active" : ""}`}
        aria-current={isActive ? "true" : undefined}
        onClick={() => selectEntry(e)}
      >
        <b>{e.number}</b>
        <span>{e.clue}</span>
      </button>
    );
  };

  return (
    <section className="game-layout" aria-label="Crossword game">
      <div
        className="board-panel"
        style={{
          "--cols": puzzle.rows[0].length,
          "--rows": puzzle.rows.length,
        }}
      >
        <div className="active-clue">
          <button
            type="button"
            className="clue-nav"
            aria-label="Previous clue"
            onClick={() => stepClue(-1)}
          >
            ‹
          </button>
          <div className="active-clue-text" aria-live="polite">
            <span>
              {active.number} {active.direction.toUpperCase()}
            </span>
            <strong>{active.clue}</strong>
          </div>
          <button
            type="button"
            className="clue-nav"
            aria-label="Next clue"
            onClick={() => stepClue(1)}
          >
            ›
          </button>
        </div>

        <div className="grid-wrap">
          <div className="grid-viewport" ref={viewportRef}>
            <div
              className="crossword-grid"
              style={{ "--cols": puzzle.rows[0].length }}
              role="grid"
              aria-label="Crossword grid"
            >
              {puzzle.rows.map((row, r) =>
                row.split("").map((char, c) => {
                  const key = cellKey(r, c);
                  if (char === "#")
                    return (
                      <div key={key} className="cell blocked" role="gridcell" />
                    );
                  const number = startNumbers.get(key);
                  const isActive = activeCell.row === r && activeCell.col === c;
                  const letter = showAnswers
                    ? solution[r][c]
                    : letters[key] || "";
                  return (
                    <button
                      key={key}
                      type="button"
                      role="gridcell"
                      data-cell={key}
                      tabIndex={isActive ? 0 : -1}
                      aria-selected={isActive}
                      aria-label={`Row ${r + 1}, column ${c + 1}${letter ? `, ${letter}` : ""}`}
                      className={`cell ${activeCellKeys.has(key) ? "in-word" : ""} ${isActive ? "selected" : ""} ${showAnswers && letters[key] !== solution[r][c] ? "wrong-cell" : ""}`}
                      onClick={() => chooseCell(r, c)}
                    >
                      {number !== undefined && (
                        <span className="cell-number">{number}</span>
                      )}
                      {letter}
                    </button>
                  );
                }),
              )}
            </div>
          </div>
          {notice && (
            <p className="notice" role="alert">
              {notice}
            </p>
          )}
        </div>

        <div className="game-controls">
          <button
            type="button"
            className="secondary-button"
            onClick={switchDirection}
          >
            Switch direction
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={clearAll}
            disabled={showAnswers}
          >
            Clear all
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={submit}
            disabled={showAnswers}
          >
            Check
          </button>
        </div>

        <div className="virtual-keyboard" aria-label="On-screen keyboard">
          {KEY_ROWS.map((row) => (
            <div className="kb-row" key={row.keys}>
              {row.pad && (
                <span className="kb-gap" style={{ flexGrow: row.pad }} />
              )}
              {row.keys.split("").map((key) => (
                <button
                  type="button"
                  key={key}
                  onClick={() => write(key)}
                  disabled={showAnswers}
                >
                  {key}
                </button>
              ))}
              {row.back && (
                <button
                  type="button"
                  className="key-wide"
                  aria-label="Backspace"
                  onClick={erase}
                  disabled={showAnswers}
                >
                  ⌫
                </button>
              )}
              {row.pad && !row.back && (
                <span className="kb-gap" style={{ flexGrow: row.pad }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <aside className="clues-panel" ref={cluesRef} aria-label="Clues">
        <div className="clue-column">
          <h3>Across</h3>
          {across.map(renderClue)}
        </div>
        <div className="clue-column">
          <h3>Down</h3>
          {down.map(renderClue)}
        </div>
      </aside>
    </section>
  );
}
