# 🏋️ IronRank — free gym progress tracker

A completely free, no-server web app that does what the paid tracking apps do:
log your lifts, get placed into strength **ranks**, and watch a **body
silhouette light up** muscle by muscle as you train — all in the browser, with
simple username + passcode accounts that keep your progress between visits.

**No subscription. No server. No ads. No AI. Your data never leaves your device.**

## Features

- **243-exercise database** — barbell, dumbbell, machine, cable, Smith,
  bodyweight, kettlebell, cardio and more, each tagged with primary and
  secondary muscles.
- **Strength ranks** — every ranked lift places you into
  *Beginner → Novice → Intermediate → Advanced → Elite*, using
  bodyweight-relative 1RM standards (Epley estimated 1RM), rep standards for
  bodyweight moves, and time standards for holds. Male/female standards and
  kg/lb both supported.
- **Overall rank** — the average of your best lift in each movement pattern
  (squat, hinge, push, pull, arms, core), just like the paid standards apps.
- **Body map** — front + back muscle silhouette that changes color as muscles
  gain training XP (10 XP per primary set, 5 per secondary). Toggle between
  all-time level and last-30-days heat. Click any muscle for details and
  exercise suggestions.
- **Workout logger** — searchable exercise picker, per-set live estimated 1RM
  and rank readout, prefills from your last session, rank-up celebrations.
- **Progress charts** — estimated-1RM progression per exercise, weekly set
  volume, PR feed, week streaks.
- **Rank simulator** — enter a hypothetical set and see the rank it would earn.
- **Local accounts** — username + passcode (stored as a SHA-256 hash) in your
  browser's localStorage. Log out and back in and your progress is still there.
  Export/import JSON to back up or move devices.

## Running it

It's a plain static site — no build step, no dependencies.

- **Locally:** open `index.html`, or `python3 -m http.server` and visit
  `http://localhost:8000`.
- **Free hosting:** push to GitHub and enable **GitHub Pages**
  (Settings → Pages → deploy from branch), or drop the folder into Netlify /
  Cloudflare Pages / Vercel.

Tip: in **Settings → Load sample data** you can generate 12 weeks of training
to see the ranks, charts and body map in action.

## How the numbers work

- **Estimated 1RM:** Epley — `weight × (1 + reps/30)`, reps capped at 15.
- **Weight-standard ranks:** your best estimated 1RM divided by bodyweight,
  compared against published-style strength standard ratios (e.g. bench press
  Elite = 2.0× bodyweight for men). Female thresholds are scaled
  (×0.78 lower body, ×0.65 upper body, ×0.6 reps/time).
- **Muscle XP:** each logged set gives 10 XP to the exercise's primary muscles
  and 5 XP to secondaries, scaled by an intensity multiplier (0.5×–3.5×) based
  on how the set measures against the exercise's strength standards — heavy,
  hard sets level muscles far faster than easy ones. Levels at
  150 / 600 / 1500 / 3200 / 6000 / 10000 XP.

## Privacy

Everything is stored in `localStorage` under `ironrank.*` keys. Nothing is ever
sent to any server. Clearing browser data deletes your progress — use
**Settings → Export data** for backups.

## Stack

Vanilla HTML/CSS/JS. No frameworks, no build, no network calls.

- `js/data/exercises.js` — exercise database
- `js/data/standards.js` — rank thresholds + scoring engine
- `js/store.js` — accounts, persistence, derived stats
- `js/silhouette.js` — SVG muscle map
- `js/charts.js` — canvas charts
- `js/app.js` — views and UI
