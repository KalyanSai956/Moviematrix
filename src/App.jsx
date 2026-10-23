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
import Rules from "./components/Rules.jsx";
import Stats from "./components/Stats.jsx";
import AnalyticsConsent from "./components/AnalyticsConsent.jsx";
import { track } from "./lib/analytics.js";
import { dateKeyInIST, dayNumber, secondsUntilNextPuzzle } from "./lib/date.js";
import { calculateStats, readProgress, saveResult } from "./lib/storage.js";

const INSTAGRAM_URL =
  "https://www.instagram.com/kalyan__since__2004?obrf=MWx4aHl5NjI5bzd0NQ==";

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
  const puzzle = useMemo(
    () => puzzleData.puzzles.find((p) => p.date === today),
    [today],
  );
  const [progress, setProgress] = useState(() => readProgress());
  const [screen, setScreen] = useState("home");
  const [showRules, setShowRules] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [remaining, setRemaining] = useState(() => secondsUntilNextPuzzle());
  const gameStartedAt = useRef(null);
  const [result, setResult] = useState(null);
  const stats = calculateStats(progress, today);
  const savedResult = progress.results[today];
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
      });
      track("crossword_started", {
        puzzle_date: today,
        puzzle_number: puzzleNo,
      });
      let seen = false;
      try {
        seen = Boolean(localStorage.getItem("moviematrix.rulesSeen.v1"));
      } catch {
        /* rules can still be shown */
      }
      if (!seen) {
        setShowRules(true);
        track("rules_viewed", {
          puzzle_date: today,
          puzzle_number: puzzleNo,
          placement: "first_visit",
        });
      }
      return undefined;
    }
    const timer = window.setTimeout(() => setCountdown((n) => n - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [screen, countdown, today, puzzleNo]);

  function play() {
    track("play_clicked", { puzzle_date: today, puzzle_number: puzzleNo });
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
      localStorage.setItem("moviematrix.rulesSeen.v1", "1");
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
    };
    track("puzzle_submitted", eventProperties);
    track(gameResult.won ? "puzzle_won" : "puzzle_lost", {
      ...eventProperties,
      outcome: gameResult.won ? "won" : "lost",
    });
    const next = saveResult(today, completed);
    setProgress(next);
    setResult(next.results[today]);
    setScreen("result");
  }

  function share() {
    const won = Boolean(result?.won);
    const score = `${result?.score ?? 0}/${result?.total ?? puzzle?.answers.length ?? 0}`;
    track("whatsapp_share_clicked", {
      puzzle_date: today,
      puzzle_number: puzzleNo,
      outcome: won ? "won" : "lost",
    });
    const message = `MovieMatrix #${puzzleNo} 🎬\n${won ? `I solved today's Tollywood Crossword: ${score}!` : `I scored ${score} on today's Tollywood Crossword.`}\nCan you beat my score? ${window.location.origin}`;
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
            <p className="muted">Your daily crossword is loading…</p>
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
                <h1>{puzzle.title || "Tollywood Crossword"}</h1>
                <p className="muted">
                  {puzzle.subtitle || "Cross the clues. Complete the grid."}
                </p>
              </div>
            </div>
            <Crossword
              key={puzzle.date}
              puzzle={puzzle}
              onSubmit={finishGame}
            />
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
                    puzzle?.answers.length ??
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
              <p>One new crossword, every day at midnight IST.</p>
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
              {puzzle.answers.map((entry) => (
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
              ))}
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
            <p className="eyebrow">COMING SOON</p>
            <h1>Today's puzzle is being prepared.</h1>
            <p className="muted">
              The puzzle schedule doesn't have an entry for {today} yet. Check
              back soon.
            </p>
            <button
              className="secondary-button"
              onClick={() => setScreen("home")}
            >
              Back home
            </button>
          </section>
        )}
      </main>
      {showRules && <Rules onClose={closeRules} />}
    </div>
  );
}
