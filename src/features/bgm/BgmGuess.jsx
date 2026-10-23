import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Music2 } from 'lucide-react';
import LetterKeyboard from '../../components/LetterKeyboard.jsx';
import { track } from '../../lib/analytics.js';
import { checkBgmGuess, composeGuess, emptySlots, eraseLetter, typeLetter } from '../../lib/bgm.js';
import { layoutTitle, letterFromKeyEvent, longestWord } from '../../lib/titles.js';

const fmt = (s) => {
  if (!Number.isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};

export default function BgmGuess({ puzzle, onSubmit, onContinue }) {
  const answer = puzzle.answer;
  const words = useMemo(() => layoutTitle(answer), [answer]);
  const longest = useMemo(() => longestWord(answer), [answer]);
  const [slots, setSlots] = useState(() => emptySlots(answer));
  const [cursor, setCursor] = useState(0);
  const [notice, setNotice] = useState('');
  const [outcome, setOutcome] = useState(null); // null | 'won' | 'lost'
  const [guessed, setGuessed] = useState(null); // slots as submitted (for wrong-letter marking)
  const [audioError, setAudioError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState({ current: 0, duration: 0 });
  const audioRef = useRef(null);
  const keyHandler = useRef(() => {});
  const done = outcome !== null;

  const missingMessage = (src) =>
    src && src.startsWith('/')
      ? `The audio clip could not be loaded from "${src}". Add the file at public${src} (or fix "audio" for ${puzzle.date} in content/puzzles.json).`
      : `The audio clip could not be loaded from "${src || '(not configured)'}". Check the "audio" field for ${puzzle.date} in content/puzzles.json.`;

  /* Release the audio when the game leaves the screen. The source is restored on
     setup so React StrictMode's mount -> cleanup -> mount cycle leaves a working player. */
  useEffect(() => {
    const audio = audioRef.current;
    if (audio && puzzle.audio && !audio.getAttribute('src')) audio.setAttribute('src', puzzle.audio);
    return () => {
      if (!audio) return;
      try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch { /* nothing to release */ }
    };
  }, [puzzle.audio]);

  const stopAudio = () => {
    try { audioRef.current?.pause(); } catch { /* ignore */ }
    setPlaying(false);
  };

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || audioError) return;
    if (!audio.paused) { audio.pause(); return; }
    try {
      await audio.play();
    } catch (error) {
      if (error?.name === 'NotSupportedError') setAudioError(missingMessage(puzzle.audio));
      else if (error?.name !== 'AbortError') setNotice('Could not start the audio. Tap Play to try again.');
    }
  };

  const retryAudio = () => {
    setAudioError('');
    try { audioRef.current?.load(); } catch { /* ignore */ }
  };

  const write = (letter) => {
    if (done || audioError) return;
    const next = typeLetter(slots, cursor, letter);
    setSlots(next.slots);
    setCursor(next.cursor);
    setNotice('');
  };
  const erase = () => {
    if (done || audioError) return;
    const next = eraseLetter(slots, cursor);
    setSlots(next.slots);
    setCursor(next.cursor);
    setNotice('');
  };
  const clearAll = () => { if (!done) { setSlots(emptySlots(answer)); setCursor(0); setNotice(''); } };

  const submit = () => {
    if (done || audioError) return;
    const check = checkBgmGuess(answer, composeGuess(answer, slots));
    if (check.status === 'empty' || check.status === 'incomplete') {
      track('check_blocked_incomplete', { puzzle_date: puzzle.date, game_type: 'bgm' });
      setNotice(check.status === 'empty' ? 'Enter the movie title before you submit.' : 'Fill every letter box before you submit.');
      return;
    }
    track('check_clicked', { puzzle_date: puzzle.date, puzzle_number: puzzle.puzzleNumber, game_type: 'bgm' });
    const won = check.status === 'correct';
    stopAudio();
    setGuessed(slots);
    setOutcome(won ? 'won' : 'lost');
    onSubmit({ won, score: won ? 1 : 0, total: 1, answers: 1, gameType: 'bgm' });
  };

  keyHandler.current = (event) => {
    if (done || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName)) return;
    if (document.querySelector('.modal-backdrop, .consent-backdrop')) return;
    const letter = letterFromKeyEvent(event);
    if (letter) { event.preventDefault(); write(letter); }
    else if (['Backspace', 'Delete'].includes(event.key) || ['Backspace', 'Delete'].includes(event.code)) { event.preventDefault(); erase(); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); setCursor((c) => Math.min(slots.length - 1, c + 1)); }
    else if (event.key === 'Enter' && target?.tagName !== 'BUTTON') { event.preventDefault(); submit(); }
  };
  useEffect(() => {
    const onKey = (event) => keyHandler.current(event);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  let slotIndex = -1;
  return (
    <section className="mm-game" aria-label="BGM Movie Guess">
      <p className="mm-instructions">Listen to the background music and identify the movie. Fill one box per letter.</p>

      <audio
        ref={audioRef}
        src={puzzle.audio}
        preload="metadata"
        data-testid="bgm-audio"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={(e) => {
          if (!e.currentTarget.getAttribute('src')) return; // intentionally emptied on release
          setPlaying(false);
          setAudioError(missingMessage(puzzle.audio));
        }}
        onLoadedMetadata={(e) => {
          const { duration } = e.currentTarget; // read now: currentTarget is cleared after the handler returns
          setTime((t) => ({ ...t, duration }));
        }}
        onTimeUpdate={(e) => setTime({ current: e.currentTarget.currentTime, duration: e.currentTarget.duration })}
      />

      {audioError ? (
        <div className="mm-error" role="alert">
          <strong>Audio unavailable</strong>
          <p>{audioError}</p>
          <button type="button" className="secondary-button" onClick={retryAudio}>Try again</button>
        </div>
      ) : (
        <>
          <div className="mm-player">
            <button type="button" className="mm-play" onClick={toggle} aria-label={playing ? 'Pause music' : 'Play music'} aria-pressed={playing}>
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <div className="mm-player-info">
              <span><Music2 size={13} /> {playing ? 'Now playing' : 'Background music'}</span>
              <div className="mm-progress" aria-hidden="true">
                <i style={{ width: `${time.duration ? Math.min(100, (time.current / time.duration) * 100) : 0}%` }} />
              </div>
            </div>
            <span className="mm-time">{fmt(time.current)} / {fmt(time.duration)}</span>
          </div>

          <div className="mm-board" style={{ '--n': longest }} role="group" aria-label={`Movie title, ${slots.length} letters`}>
            {words.map((word, w) => (
              <div className="mm-word" key={w}>
                {word.map((c, i) => {
                  if (!c.guessable) return <span key={i} className="mm-box fixed">{c.ch}</span>;
                  slotIndex += 1;
                  const idx = slotIndex;
                  const typed = slots[idx];
                  const wrong = done && outcome === 'lost' && guessed?.[idx] !== c.ch;
                  const shown = done ? c.ch : typed;
                  return (
                    <button
                      key={i}
                      type="button"
                      className={`mm-box ${!done && idx === cursor ? 'active' : ''} ${done ? (wrong ? 'wrong' : 'right') : ''}`}
                      onClick={() => !done && setCursor(idx)}
                      disabled={done}
                      aria-label={`Letter ${idx + 1} of ${slots.length}${shown ? `, ${shown}` : ', empty'}`}
                    >
                      {shown}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <p className={`mm-status ${outcome === 'won' ? 'good' : outcome === 'lost' ? 'bad' : ''}`} role="status" aria-live="polite">
            {outcome === 'won' && 'Correct! You named the movie.'}
            {outcome === 'lost' && 'Not quite — the correct title is shown above.'}
            {!done && notice}
          </p>

          {done ? (
            <div className="game-controls">
              <button type="button" className="primary-button" onClick={onContinue}>See results</button>
            </div>
          ) : (
            <div className="game-controls">
              <button type="button" className="secondary-button" onClick={clearAll}>Clear all</button>
              <button type="button" className="primary-button" onClick={submit}>Submit</button>
            </div>
          )}
          <LetterKeyboard onKey={write} onBackspace={erase} disabled={done} />
        </>
      )}
    </section>
  );
}
