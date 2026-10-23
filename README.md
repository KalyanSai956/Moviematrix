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

## Static-only limitations

- Puzzle answers ship to browsers in `content/puzzles.json` and can be inspected.
- Local game statistics are browser-specific and can be cleared or edited.
- Analytics visitors are estimates based on anonymous browser identifiers, not authenticated people.
- This stage implements analytics capture and external PostHog setup only. It does **not** include an in-app `/admin` dashboard or serverless analytics proxy.


## Daily crossword content contract

Edit only `content/puzzles.json` to publish a daily puzzle. Keep `version: 1` and `timezone: "Asia/Kolkata"`. Each puzzle's `rows` is the authoritative rectangular grid: `.` is an open cell and `#` is a blocked cell. `answers` entries use zero-based `row` and `col`, `direction` (`across` or `down`), uppercase A–Z `answer`, `clue`, and the standard crossword `number` for that starting cell.

Before publishing, run `npm run validate:puzzles`. Validation rejects malformed grids, answers that do not fit their open slots, mismatched intersections, incorrect clue numbering, uncovered open cells, and question lists that have no Across/Down crossing structure. `npm run build` runs this validation before Vite builds. The current bundled October 22 content is a list of isolated Across entries, not a valid crossword, and therefore intentionally fails strict validation until replaced with a genuine intersecting grid.


## Private in-app admin dashboard

The private dashboard is available at `/admin`. It uses Vercel serverless functions in `api/admin/` and an HttpOnly, SameSite=Strict, signed session cookie. It does not add admin credentials or privileged PostHog keys to browser bundles. Admin requests are same-origin checked, login attempts have a best-effort per-function-instance limit, and analytics queries are restricted to a maximum 90-day range.

Configure these **server-side Vercel environment variables** in Project Settings → Environment Variables (Production and Preview only if needed):

- `ADMIN_USERNAME`: the admin login name.
- `ADMIN_PASSWORD`: a long, unique password; rotate it if exposed.
- `ADMIN_SESSION_SECRET`: at least 32 random characters, used to sign sessions. Generate one with `openssl rand -base64 48`.
- `POSTHOG_PERSONAL_API_KEY`: a PostHog personal API key with only the `query:read` scope required for querying. Never use a project ingest key here.
- `POSTHOG_PROJECT_ID`: the numeric PostHog project ID.
- `POSTHOG_API_HOST`: the PostHog app/API host for your region, e.g. `https://us.posthog.com` or `https://eu.posthog.com` (not the ingest host).

Do **not** prefix any of these values with `VITE_`. Only `VITE_POSTHOG_KEY` (the public project ingest key) and `VITE_POSTHOG_HOST` belong in browser environment settings. Do not commit `.env` or real secrets. Redeploy after adding server-side environment variables. The included `.env.example` contains placeholders only.

The dashboard currently uses the existing events (`game_page_viewed`, `crossword_started`, `puzzle_submitted`, `puzzle_won`, `puzzle_lost`). Until BGM and Hangman event tracking is implemented, their metrics will not appear. New game events should include a `game_type` property (`crossword`, `bgm`, or `hangman`) on start/result events. The user metric is a sum of daily unique anonymous identifiers, not a count of verified people unique across the full range. All metrics reflect only events captured under the existing analytics consent policy.

Security note: the included login rate limit is best-effort and held in serverless function memory; it is not a distributed rate limiter. For a public production admin endpoint, add a durable edge/WAF rate limit or identity provider if the dashboard becomes a higher-risk target. Admin API authentication is server-enforced; the frontend route alone is not treated as security.
