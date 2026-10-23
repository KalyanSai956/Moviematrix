import { useEffect, useMemo, useRef, useState } from 'react';
import LetterKeyboard from '../../components/LetterKeyboard.jsx';
import { track } from '../../lib/analytics.js';
import { MAX_WRONG, applyGuess, boardWords, deriveGame, loadGuesses, saveGuesses } from '../../lib/hangman.js';
import { letterFromKeyEvent, longestWord } from '../../lib/titles.js';

const INVALID = {
  empty: 'Enter a letter from A to Z.',
  multiple: 'Guess one letter at a time.',
  'not-letter': 'Only the letters A to Z can be guessed.',
};

export default function Hangman({ puzzle, onSubmit, onContinue }) {
  const answer = puzzle.answer;
  const [guesses, setGuesses] = useState(() => loadGuesses(puzzle.date));
  const [message, setMessage] = useState({ tone: '', text: '' });
  const reported = useRef(false);
  const keyHandler = useRef(() => {});
  const game = useMemo(() => deriveGame(answer, guesses), [answer, guesses]);
  const longest = useMemo(() => longestWord(answer), [answer]);
  const over = game.phase !== 'playing';
  const words = boardWords(answer, guesses, game.phase === 'lost');

  const guess = (input) => {
    const result = applyGuess(answer, guesses, input);
    if (result.status === 'closed') return;
    if (result.status === 'invalid') return setMessage({ tone: 'warn', text: INVALID[result.reason] });
    if (result.status === 'repeat') return setMessage({ tone: 'warn', text: `You already tried ${result.letter}.` });
    setGuesses(result.guesses);
    saveGuesses(puzzle.date, result.guesses);
    if (result.state.phase === 'won') setMessage({ tone: 'good', text: 'You revealed the whole title!' });
    else if (result.state.phase === 'lost') setMessage({ tone: 'bad', text: 'No letter in the word. You are out of guesses.' });
    else if (result.status === 'correct') setMessage({ tone: 'good', text: `Yes! ${result.letter} appears ${result.count === 1 ? 'once' : `${result.count} times`}.` });
    else setMessage({ tone: 'bad', text: 'No letter in the word.' });
  };

  /* Record the result exactly once when the guessing phase ends. */
  useEffect(() => {
    if (game.phase === 'playing' || reported.current) return;
    reported.current = true;
    const won = game.phase === 'won';
    track('check_clicked', { puzzle_date: puzzle.date, puzzle_number: puzzle.puzzleNumber, game_type: 'hangman' });
    onSubmit({ won, score: won ? 1 : 0, total: 1, answers: 1, gameType: 'hangman', wrongGuesses: game.wrong.length });
  }, [game.phase]);

  keyHandler.current = (event) => {
    if (over || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;
    if (document.querySelector('.modal-backdrop, .consent-backdrop')) return;
    const letter = letterFromKeyEvent(event);
    if (letter) { event.preventDefault(); guess(letter); return; }
    if (event.key.length !== 1 || event.key === ' ') return; // Shift, Enter, Tab, space etc. are not guesses
    event.preventDefault();
    guess(event.key); // digits / symbols -> "invalid input" message, no chance used
  };
  useEffect(() => {
    const onKey = (event) => keyHandler.current(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const keyStates = {};
  game.correct.forEach((l) => { keyStates[l] = 'hit'; });
  game.wrong.forEach((l) => { keyStates[l] = 'miss'; });
  const letterTotal = words.flat().filter((c) => c.kind !== 'fixed').length;

  return (
    <section className="mm-game" aria-label="Hangman">
      <p className="mm-instructions">
        Guess the movie title one letter at a time. You can miss {MAX_WRONG} letters before the game is over.
      </p>

      <div className="mm-chances" aria-live="polite">
        <span>Guesses left</span>
        <b data-testid="remaining">{game.remaining}</b>
        <span className="mm-pips" aria-hidden="true">
          {Array.from({ length: MAX_WRONG }, (_, i) => <i key={i} className={i < game.wrong.length ? 'spent' : ''} />)}
        </span>
      </div>

      <div className="mm-board" style={{ '--n': longest }} role="group" aria-label={`Movie title, ${letterTotal} letters`}>
        {words.map((word, w) => (
          <div className="mm-word" key={w}>
            {word.map((c, i) => (
              <span
                key={i}
                className={`mm-box ${c.kind}`}
                aria-label={c.kind === 'hidden' ? 'hidden letter' : undefined}
              >
                {c.ch}
              </span>
            ))}
          </div>
        ))}
      </div>

      <p className="mm-wrong" aria-live="polite">
        {game.wrong.length > 0 ? <>Not in the title: <b>{game.wrong.join(' ')}</b></> : 'No wrong letters yet'}
      </p>

      <p className={`mm-status ${message.tone}`} role="status" aria-live="polite">{message.text}</p>

      {game.phase === 'lost' && (
        <div className="mm-hint" data-testid="hint">
          <span>HINT</span>
          <strong>{puzzle.hint}</strong>
        </div>
      )}

      {over ? (
        <div className="game-controls">
          <button type="button" className="primary-button" onClick={onContinue}>See results</button>
        </div>
      ) : null}
      <LetterKeyboard onKey={guess} disabled={over} keyStates={keyStates} />
    </section>
  );
}
