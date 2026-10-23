import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Clapperboard,
  Instagram,
  Share2,
  Trophy,
} from "lucide-react";
import puzzleData from "../content/puzzles.json";
import Crossword from "./features/crossword/Crossword.jsx";
import BgmGuess from "./features/bgm/BgmGuess.jsx";
import Hangman from "./features/hangman/Hangman.jsx";
import Rules from "./components/Rules.jsx";
import Stats from "./components/Stats.jsx";
import AnalyticsConsent from "./components/AnalyticsConsent.jsx";
import { track } from "./lib/analytics.js";
import { dateKeyInIST, dayNumber, secondsUntilNextPuzzle } from "./lib/date.js";
import { calculateStats, readProgress, saveResult } from "./lib/storage.js";
import {
  GAME_LABELS,
  GAME_NOUNS,
  resolveDailyPuzzle,
  resultGameType,
} from "./lib/schedule.js";

const INSTAGRAM_URL =
  "https://www.instagram.com/kalyan__since__2004?obrf=MWx4aHl5NjI5bzd0NQ==";

// Crossword keeps its original key so its "rules seen" state is untouched.
const rulesKeyFor = (kind) =>
  kind === "crossword"
    ? "moviematrix.rulesSeen.v1"
    : `moviematrix.rulesSeen.${kind}.v1`;

function formatCountdown(total) {
  const hours = Math.floor(total / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((total % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export default function App() {
  const [now, setNow] = useState(() => new Date());
  const today = dateKeyInIST(now);
  const [previousDay, setPreviousDay] = useState(today);
  // The 3-day rotation (crossword -> BGM -> Hangman) is decided in lib/schedule.js.
  const daily = useMemo(() => resolveDailyPuzzle(puzzleData, today), [today]);
  const puzzle = daily.puzzle;
  const kind = daily.gameType || "crossword";
  const [progress, setProgress] = useState(() => readProgress());
  const [screen, setScreen] = useState("home");
  const [showRules, setShowRules] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [remaining, setRemaining] = useState(() => secondsUntilNextPuzzle());
  const gameStartedAt = useRef(null);
  const [result, setResult] = useState(null);
  const stats = calculateStats(progress, today);
  const storedResult = progress.results[today];
  // Ignore a record that belongs to a different game than today's.
  const savedResult =
    storedResult && resultGameType(storedResult) === kind
      ? storedResult
      : undefined;
  const puzzleNo =
    puzzle?.puzzleNumber ?? dayNumber(puzzleData.startDate, today);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const current = new Date();
      setNow(current);
      setRemaining(secondsUntilNextPuzzle(current));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (previousDay !== today) {
      setPreviousDay(today);
      setScreen("home");
      setResult(null);
      setShowRules(false); // rules are per-game; don't carry yesterday's modal into today's game
    }
  }, [today, previousDay]);

  useEffect(() => {
    if (screen !== "loading") return undefined;
    if (countdown <= 0) {
      setScreen("game");
      gameStartedAt.current = Date.now();
      track("countdown_completed", {
        puzzle_date: today,
        puzzle_number: puzzleNo,
        game_type: kind,
      });
      if (kind === "crossword") {
        track("crossword_started", {
          puzzle_date: today,
          puzzle_number: puzzleNo,
        });
      }
      track("game_started", {
        puzzle_date: today,
        puzzle_number: puzzleNo,
        game_type: kind,
      });
      let seen = false;
      try {
        seen = Boolean(localStorage.getItem(rulesKeyFor(kind)));
      } catch {
        /* rules can still be shown */
      }
      if (!seen) {
        setShowRules(true);
        track("rules_viewed", {
          puzzle_date: today,
          puzzle_number: puzzleNo,
          placement: "first_visit",
          game_type: kind,
        });
      }
      return undefined;
    }
    const timer = window.setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [screen, countdown, today, puzzleNo, kind]);

  function play() {
    track("play_clicked", {
      puzzle_date: today,
      puzzle_number: puzzleNo,
      game_type: kind,
    });
    if (!puzzle) {
      setScreen("unavailable");
      return;
    }
    if (savedResult) {
      setResult(savedResult);
      setScreen("result");
      return;
    }
    setCountdown(5);
    setScreen("loading");
  }

  function closeRules() {
    setShowRules(false);
    try {
      localStorage.setItem(rulesKeyFor(kind), "1");
    } catch {
      /* optional */
    }
  }

  function finishGame(gameResult) {
    const durationSeconds = gameStartedAt.current
      ? Math.max(0, Math.round((Date.now() - gameStartedAt.current) / 1000))
      : null;
    const completed = { ...gameResult, submittedAt: new Date().toISOString() };
    const eventProperties = {
      puzzle_date: today,
      puzzle_number: puzzleNo,
      correct_answers: gameResult.score,
      total_answers: gameResult.total,
      duration_seconds: durationSeconds,
      game_type: kind,
    };
    // Aggregate count only: never the typed letters or the answer.
    if (typeof gameResult.wrongGuesses === "number") {
      eventProperties.wrong_guesses = gameResult.wrongGuesses;
    }
    track("puzzle_submitted", eventProperties);
    track(gameResult.won ? "puzzle_won" : "puzzle_lost", {
      ...eventProperties,
      outcome: gameResult.won ? "won" : "lost",
    });
    const next = saveResult(today, completed);
    setProgress(next);
    setResult(next.results[today]);
    // BGM and Hangman stay on screen so the player sees the answer/hint, then
    // press "See results" (their onContinue). The result is already saved.
    if (kind === "crossword") setScreen("result");
  }

  function share() {
    const won = Boolean(result?.won);
    const score = `${result?.score ?? 0}/${result?.total ?? puzzle?.answers?.length ?? 0}`;
    track("whatsapp_share_clicked", {
      puzzle_date: today,
      puzzle_number: puzzleNo,
      outcome: won ? "won" : "lost",
      game_type: kind,
    });
    const message =
      kind === "crossword"
        ? `MovieMatrix #${puzzleNo} 🎬\n${won ? `I solved today's Tollywood Crossword: ${score}!` : `I scored ${score} on today's Tollywood Crossword.`}\nCan you beat my score? ${window.location.origin}`
        : `MovieMatrix #${puzzleNo} 🎬\n${won ? `I cracked today's ${GAME_LABELS[kind]}!` : `Today's ${GAME_LABELS[kind]} beat me.`}\nCan you beat me? ${window.location.origin}`;
    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  const resultWon = result?.won ?? savedResult?.won;
  return (
    <div className="app-shell">
      <main>
        {screen === "home" && (
          <section className="hero">
            <div className="hero-copy">
              <p className="eyebrow">YOUR DAILY DOSE OF TOLLYWOOD</p>
              <h1>
                Movie
                <span>Matrix</span>
              </h1>
              <p>Think like a movie buff. New puzzle every day. </p>
              <div className="hero-actions">
                <button className="primary-button play-button" onClick={play}>
                  Play
                </button>
                <AnalyticsConsent />
              </div>
            </div>
          </section>
        )}
        {screen === "loading" && (
          <section className="state-screen loading-screen">
            <div className="loader-emblem">
              <Clapperboard size={34} />
            </div>
            <p className="eyebrow">PREPARING TODAY'S CHALLENGE</p>
            <div className="countdown-number">
              {countdown > 0 ? countdown : "GO"}
            </div>
            <h2>
              {countdown > 0
                ? "Get your movie brain ready."
                : "Let the game begin."}
            </h2>
            <p className="muted">{`Your daily ${GAME_NOUNS[kind]} is loading…`}</p>
            <div className="loading-track">
              <span style={{ width: `${((5 - countdown) / 5) * 100}%` }} />
            </div>
          </section>
        )}
        {screen === "game" && puzzle && (
          <section className="game-screen">
            <div className="section-heading">
              <div>
                <p className="eyebrow">TODAY'S CHALLENGE · #{puzzleNo}</p>
                <h1>{puzzle.title || GAME_LABELS[kind]}</h1>
                <p className="muted">
                  {puzzle.subtitle ||
                    (kind === "crossword"
                      ? "Cross the clues. Complete the grid."
                      : GAME_LABELS[kind])}
                </p>
              </div>
            </div>
            {kind === "crossword" && (
              <Crossword
                key={puzzle.date}
                puzzle={puzzle}
                onSubmit={finishGame}
              />
            )}
            {kind === "bgm" && (
              <BgmGuess
                key={puzzle.date}
                puzzle={puzzle}
                onSubmit={finishGame}
                onContinue={() => setScreen("result")}
              />
            )}
            {kind === "hangman" && (
              <Hangman
                key={puzzle.date}
                puzzle={puzzle}
                onSubmit={finishGame}
                onContinue={() => setScreen("result")}
              />
            )}
          </section>
        )}
        {screen === "result" && (
          <section className="result-screen">
            <div className={`result-icon ${resultWon ? "win" : "loss"}`}>
              {resultWon ? <Trophy size={34} /> : <Clapperboard size={34} />}
            </div>
            <p className="eyebrow">
              PUZZLE #{puzzleNo} ·{" "}
              {resultWon ? "CHALLENGE COMPLETE" : "THAT’S A WRAP"}
            </p>
            <h1>
              {resultWon ? "Well done, movie buff." : "Better luck tomorrow."}
            </h1>
            <div className="score-card">
              <span className="score-label">TODAY'S SCORE</span>
              <strong>
                {result?.score ?? savedResult?.score ?? 0}
                <i>
                  /
                  {result?.total ??
                    savedResult?.total ??
                    puzzle?.answers?.length ??
                    0}
                </i>
              </strong>
              <span>
                {resultWon
                  ? "PERFECT SOLVE"
                  : "KEEP THAT MOVIE KNOWLEDGE GROWING"}
              </span>
            </div>
            <Stats stats={stats} />
            <div className="result-actions">
              <button className="primary-button" onClick={share}>
                <Share2 size={18} /> Share on WhatsApp
              </button>
              <button
                className="secondary-button"
                onClick={() => setScreen("answers")}
              >
                Review answers
              </button>
            </div>
            <div className="next-puzzle">
              <div>
                <span className="eyebrow">NEXT CHALLENGE IN</span>
                <strong>{formatCountdown(remaining)}</strong>
              </div>
              <p>One new puzzle, every day at midnight IST.</p>
            </div>
            <a
              className="instagram-result-link"
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                track("instagram_clicked", {
                  placement: "results",
                  puzzle_date: today,
                  puzzle_number: puzzleNo,
                })
              }
            >
              <Instagram size={16} />
              <span>Follow @kalyan__since__2004 on Instagram</span>
              <ArrowUpRight size={14} />
            </a>
          </section>
        )}
        {screen === "answers" && puzzle && (
          <section className="answers-screen">
            <p className="eyebrow">PUZZLE #{puzzleNo}</p>
            <h1>Today's answers</h1>
            <p className="muted">Come back tomorrow for a fresh challenge.</p>
            <div className="answer-list">
              {kind !== "crossword" ? (
                <div className="answer-row">
                  <span>{kind === "bgm" ? "MOVIE" : "TITLE"}</span>
                  <div>
                    <strong>{puzzle.answer.toUpperCase()}</strong>
                    {kind === "hangman" && <p>{puzzle.hint}</p>}
                  </div>
                </div>
              ) : (
                puzzle.answers.map((entry) => (
                  <div
                    className="answer-row"
                    key={`${entry.number}-${entry.direction}`}
                  >
                    <span>
                      {entry.number} {entry.direction.toUpperCase()}
                    </span>
                    <div>
                      <strong>{entry.answer}</strong>
                      <p>{entry.clue}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              className="primary-button"
              onClick={() => setScreen("result")}
            >
              Back to results
            </button>
          </section>
        )}
        {screen === "unavailable" && (
          <section className="state-screen">
            <div className="loader-emblem">
              <Clapperboard size={32} />
            </div>
            {daily.status === "invalid" ? (
              <>
                <p className="eyebrow">PUZZLE UNAVAILABLE</p>
                <h1>Today's puzzle can't be shown.</h1>
                <p className="muted" role="alert">
                  {daily.error}
                </p>
              </>
            ) : (
              <>
                <p className="eyebrow">COMING SOON</p>
                <h1>Today's puzzle is being prepared.</h1>
                <p className="muted">
                  The puzzle schedule doesn't have an entry for {today} yet.
                  Check back soon.
                </p>
              </>
            )}
            <button
              className="secondary-button"
              onClick={() => setScreen("home")}
            >
              Back home
            </button>
          </section>
        )}
      </main>
      {showRules && <Rules onClose={closeRules} gameType={kind} />}
    </div>
  );
}
