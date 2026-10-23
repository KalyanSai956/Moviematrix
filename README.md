# MovieMatrix

A static React + JavaScript daily Tollywood crossword hosted on Vercel. No player accounts or game backend are required. Daily puzzles live in `content/puzzles.json`.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The game works without PostHog configuration. Analytics events are sent only after a visitor explicitly allows analytics and valid PostHog configuration is present.

## Stage 1: PostHog analytics setup

1. Create a PostHog project at [posthog.com](https://posthog.com/) and choose the appropriate data region for your audience and obligations.
2. In PostHog project settings, copy the **project API key** (not a personal or privileged API key) and the project's ingest host.
3. Put them in `.env.local`:

   ```env
   VITE_POSTHOG_KEY=phc_your_project_key
   VITE_POSTHOG_HOST=https://us.i.posthog.com
   ```

   Use the exact host shown by PostHog for your project. EU projects commonly use `https://eu.i.posthog.com`. These are public browser settings, not secrets. Never put a privileged PostHog API key in a `VITE_` variable.
4. Restart Vite after changing environment variables. Deploy the same variables in Vercel → Project Settings → Environment Variables, for Preview and Production as appropriate, then redeploy.
5. On first visit, choose **Allow analytics** to start sending events or **Reject analytics** to keep custom analytics off. Change the selection using **Privacy settings** in the footer.
6. Verify events in PostHog's live events/activity view. Use a private browser session and test both consent choices. Do not use real visitor metrics for test runs.

## Events tracked

All custom events are gated by explicit consent and PostHog configuration. Autocapture, automatic pageviews, session recording and person profiles are disabled in the SDK configuration.

| Event | Meaning | Properties |
|---|---|---|
| `game_page_viewed` | Initial game page load after consent | `page` |
| `play_clicked` | Play button pressed | `puzzle_date`, `puzzle_number` |
| `countdown_completed` | Five-second countdown finished | `puzzle_date`, `puzzle_number` |
| `crossword_started` | Crossword becomes playable | `puzzle_date`, `puzzle_number` |
| `rules_viewed` | First-visit rules displayed | `puzzle_date`, `puzzle_number`, `placement` |
| `clue_selected` | Player selects a clue/cell | `puzzle_date`, `clue_number`, `direction` |
| `check_blocked_incomplete` | Submission blocked because answers are missing | `puzzle_date` |
| `check_clicked` | Complete crossword submitted | `puzzle_date`, `puzzle_number` |
| `puzzle_submitted` | Final result recorded | `puzzle_date`, `puzzle_number`, `correct_answers`, `total_answers`, `duration_seconds` |
| `puzzle_won` / `puzzle_lost` | Final outcome | Same aggregate outcome properties; no answer text |
| `whatsapp_share_clicked` | WhatsApp share link clicked | `puzzle_date`, `puzzle_number`, `outcome` |
| `instagram_clicked` | Instagram link clicked | `placement`, `puzzle_date` |

No names, email addresses, phone numbers, typed letters or crossword answer text are intentionally sent. Analytics identifiers are anonymous browser identifiers and do not constitute a player account. Browser-based analytics cannot reliably deduplicate the same person across devices or after storage is cleared.

## Create external PostHog dashboards

Create these insights from the events above, then add them to a PostHog dashboard:

1. **Daily traffic:** unique visitors / sessions by day. Use PostHog's web analytics or pageview insights for traffic; the custom `game_page_viewed` event is emitted only after consent.
2. **Game funnel:** `play_clicked` → `crossword_started` → `puzzle_submitted` → `puzzle_won`.
3. **Puzzle difficulty:** `puzzle_won` and `puzzle_lost` by `puzzle_number` or `puzzle_date`; compare win rate and median `duration_seconds`.
4. **Sharing:** `whatsapp_share_clicked` and `instagram_clicked` by day.
5. **Retention:** use PostHog retention insights with returning activity, and interpret results as anonymous-browser retention rather than verified people.

PostHog interface labels may change. Build insights from actual received events and check their property names before saving dashboards. No analytics data is fabricated by the app.

## Privacy controls

- The consent dialog offers Allow analytics and Reject analytics; the saved choice can be changed through **Privacy settings** in the footer.
- Analytics is not initialized until consent is accepted. Events are not queued before consent.
- `autocapture`, automatic pageviews, pageleave capture, session recording and person profiles are disabled.
- `respect_dnt` is enabled. PostHog custom events are gated by the consent choice and configuration.
- The `public/privacy.html` page describes this setup. Review it against your actual PostHog region, settings, retention and applicable law before public launch; it is a starter notice, not legal advice.
- If someone rejects analytics after previously accepting it, new capture is opted out. For stricter deletion semantics, you may additionally clear PostHog's stored browser persistence as part of your reviewed privacy policy implementation.

## Update daily puzzles

Edit only `content/puzzles.json`. Add one object per date. The grid is explicit: `rows` is a rectangular array; `#` means blocked and `.` means playable. Each answer requires `number`, `direction` (`across` or `down`), zero-based `row` and `col`, `answer` (A–Z only), and `clue`.

Run:

```bash
npm run validate:puzzles
npm test
npm run build
```

The build runs puzzle validation automatically. Commit and push to GitHub; Vercel deploys the production branch.


## Daily game rotation (crossword → BGM → Hangman)

The game is chosen from the date, never stored per visitor. Starting at `startDate` in `content/puzzles.json` and using the Asia/Kolkata date, the cycle repeats every three days:

| Day in cycle | `gameType` | Example (startDate 2026-10-22) |
|---|---|---|
| 1 | `crossword` (default when `gameType` is omitted) | 2026-10-22, 10-25, 10-28 … |
| 2 | `bgm` – BGM Movie Guess | 2026-10-23, 10-26 … |
| 3 | `hangman` | 2026-10-24, 10-27 … |

The schedule lives in `src/lib/schedule.js`. An entry whose `gameType` does not match its date's slot, or a date with no entry, shows an unavailable state; no other game is substituted. `npm run validate:puzzles` fails on a mismatch.

### BGM Movie Guess entry

```json
{ "date": "2026-10-23", "puzzleNumber": 2, "gameType": "bgm",
  "title": "BGM Movie Guess", "answer": "Magadheera", "audio": "/audio/bgm/2026-10-23.mp3" }
```

Put your own licensed clip at `public/audio/bgm/<date>.mp3` (served as `/audio/bgm/<date>.mp3`), or set `audio` to an `https://` URL you have rights to use. Allowed: mp3, ogg, oga, wav, m4a, aac, webm. **The `answer` must match the clip you supply.** If the file cannot be loaded the game shows a configuration error naming the expected path, and validation prints a warning for missing local files. No audio is bundled or downloaded by the project.

Answer rule: case, accents, spaces and punctuation are ignored ("dj  tillu" = "DJ Tillu" = "D.J. Tillu"). One box is shown per A–Z letter; digits and punctuation are shown pre-filled.

### Hangman entry

```json
{ "date": "2026-10-24", "puzzleNumber": 3, "gameType": "hangman",
  "title": "Hangman", "answer": "Geetha Govindam", "hint": "Vijay Deverakonda and Rashmika Mandanna's romantic hit" }
```

Five chances = five distinct wrong letters. Correct, repeated and invalid guesses are free. The hint and answer appear only after the fifth wrong letter. Guesses are kept in `localStorage` (`moviematrix.hangman.v1`) so a reload cannot reset the chances.

### Results, analytics and answer exposure

- New results add `gameType` (and `wrongGuesses` for Hangman). Results without `gameType` are crosswords. A leftover record from a different game on the same date does not block today's game.
- Existing events gain a `game_type` property; `game_started` is new; `crossword_started` still fires for crosswords only. Hangman's `puzzle_submitted` adds an aggregate `wrong_guesses`. No letters or answers are sent.
- **Answers for BGM and Hangman are shipped in the JavaScript bundle (as the crossword's are) and can be read by anyone who inspects it.** The audio file URL is public as well. Real protection needs server-side checking, e.g. one Vercel serverless function in `api/` that holds the answers (outside `content/`) and returns `{correct}` for a BGM guess or the matching positions for a Hangman letter, plus the hint only after the fifth miss. This was not added because it changes the static-only deployment.

## Static-only limitations

- Puzzle answers ship to browsers in `content/puzzles.json` and can be inspected.
- Local game statistics are browser-specific and can be cleared or edited.
- Analytics visitors are estimates based on anonymous browser identifiers, not authenticated people.
- This stage implements analytics capture and external PostHog setup only. It does **not** include an in-app `/admin` dashboard or serverless analytics proxy.


## Daily crossword content contract

Edit only `content/puzzles.json` to publish a daily puzzle. Keep `version: 1` and `timezone: "Asia/Kolkata"`. Each puzzle's `rows` is the authoritative rectangular grid: `.` is an open cell and `#` is a blocked cell. `answers` entries use zero-based `row` and `col`, `direction` (`across` or `down`), uppercase A–Z `answer`, `clue`, and the standard crossword `number` for that starting cell.

Before publishing, run `npm run validate:puzzles`. Validation rejects malformed grids, answers that do not fit their open slots, mismatched intersections, incorrect clue numbering, uncovered open cells, and question lists that have no Across/Down crossing structure. `npm run build` runs this validation before Vite builds. The current bundled October 22 content is a list of isolated Across entries, not a valid crossword, and therefore intentionally fails strict validation until replaced with a genuine intersecting grid.
