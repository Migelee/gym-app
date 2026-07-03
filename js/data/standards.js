/* ============================================================
   IronRank ranking engine
   ------------------------------------------------------------
   Strength ranks follow the widely used 5-tier standard
   (as on strengthlevel.com / Symmetric Strength):
   Beginner < Novice < Intermediate < Advanced < Elite.

   Weight standards are 1RM-to-bodyweight ratios (male base).
   Female thresholds are scaled: upper-body x0.65, lower-body
   x0.78, rep/time standards x0.6 — a documented approximation
   of published strength-standard tables.
   ============================================================ */

/* Rank tier colors: ordered multi-hue ramp (indigo -> teal ->
   green -> lime -> gold) so each tier is clearly distinguishable.
   Validated on the dark surface: adjacent CVD dE >= 11.7, all
   steps >= 3:1 contrast; tiers always carry a text label too. */
const RANKS = [
  { key: 'unranked',     name: 'Unranked',     color: '#7a7973' },
  { key: 'beginner',     name: 'Beginner',     color: '#5c64c9' },
  { key: 'novice',       name: 'Novice',       color: '#1e8cb0' },
  { key: 'intermediate', name: 'Intermediate', color: '#18a86b' },
  { key: 'advanced',     name: 'Advanced',     color: '#66c73b' },
  { key: 'elite',        name: 'Elite',        color: '#ffd60a' }
];

const LOWER_BODY = new Set(['quads','hamstrings','glutes','calves','adductors']);

/* Muscle level tiers for the body map (XP thresholds).
   XP: 10 per hard set on a primary muscle, 5 on a secondary.
   ~12 productive sets/week => ~1 level per 6-10 weeks early on. */
/* Body-map level colors: same ordered multi-hue ramp as the ranks
   (indigo -> teal -> green -> lime -> yellow -> gold) so each level
   is visibly different; shades blend continuously between levels. */
const MUSCLE_LEVELS = [
  { xp: 0,    name: 'Untrained', color: '#2c2c2a' },
  { xp: 150,  name: 'Level 1',   color: '#4a4da0' },
  { xp: 600,  name: 'Level 2',   color: '#1e8cb0' },
  { xp: 1500, name: 'Level 3',   color: '#18a86b' },
  { xp: 3200, name: 'Level 4',   color: '#66c73b' },
  { xp: 6000, name: 'Level 5',   color: '#c9cf1d' },
  { xp: 10000,name: 'Level 6',   color: '#ffdf0f' }
];

/* 30-day heat tiers for the body map (sets in last 30 days,
   primary = 1 set, secondary = 0.5). */
const HEAT_LEVELS = [
  { sets: 0,  name: 'Not trained', color: '#2c2c2a' },
  { sets: 1,  name: 'Light',       color: '#4a4da0' },
  { sets: 12, name: 'Moderate',    color: '#1e8cb0' },
  { sets: 24, name: 'Solid',       color: '#18a86b' },
  { sets: 40, name: 'High',        color: '#66c73b' },
  { sets: 60, name: 'Very high',   color: '#ffdf0f' }
];

/* Estimated 1RM — Epley formula, reps capped at 15 where the
   estimate stops being meaningful. reps=1 returns the weight. */
function epley1RM(weight, reps) {
  if (!weight || !reps) return 0;
  const r = Math.min(reps, 15);
  return weight * (1 + r / 30);
}

function isLowerBody(ex) {
  return ex.p.some(m => LOWER_BODY.has(m));
}

/* Thresholds for one exercise adjusted for the user's sex. */
function exThresholds(ex, sex) {
  if (!ex.std) return null;
  if (ex.std.w) {
    const f = sex === 'f' ? (isLowerBody(ex) ? 0.78 : 0.65) : 1;
    return { kind: 'w', v: ex.std.w.map(x => x * f) };
  }
  const f = sex === 'f' ? 0.6 : 1;
  if (ex.std.r) return { kind: 'r', v: ex.std.r.map(x => Math.max(1, Math.round(x * f))) };
  if (ex.std.t) return { kind: 't', v: ex.std.t.map(x => Math.max(5, Math.round(x * f))) };
  return null;
}

/* The user's best "performance number" for an exercise:
   'w' -> best estimated 1RM (kg), 'bw'/'r' -> most strict reps
   in a single set, 't' -> longest hold in seconds. */
function performanceOfSet(ex, set) {
  if (ex.type === 'w') return epley1RM(set.weight, set.reps);
  if (ex.type === 'bw') return set.reps || 0;
  if (ex.type === 't') return set.secs || 0;
  return 0; // cardio has no rank performance
}

/* Score 0..1+ where tier boundaries are Beginner .2 / Novice .4 /
   Intermediate .6 / Advanced .8 / Elite 1.0 (linear between). */
function scoreFromThresholds(value, thresholds) {
  if (value <= 0) return 0;
  const t = thresholds;
  if (value < t[0]) return 0.2 * (value / t[0]);
  for (let i = 0; i < 4; i++) {
    if (value < t[i + 1]) {
      return 0.2 * (i + 1) + 0.2 * ((value - t[i]) / (t[i + 1] - t[i]));
    }
  }
  return 1 + 0.2 * ((value - t[4]) / t[4]); // beyond elite
}

/* Rank index 0..5 (RANKS array) from a score. Your rank is the
   highest standard you have reached: score 0.2 = hit the Beginner
   standard, 1.0 = hit Elite; below 0.2 you are still Unranked. */
function rankFromScore(score) {
  if (score >= 1) return 5;
  return Math.max(0, Math.floor(score / 0.2));
}

/* Full rank evaluation for an exercise given the user's best
   performance value. Returns null if the exercise has no standard. */
function evaluateExercise(ex, bestPerf, bodyweight, sex) {
  const th = exThresholds(ex, sex);
  if (!th || bestPerf <= 0) return null;
  let value = bestPerf;
  let thresholds = th.v;
  if (th.kind === 'w') value = bestPerf / bodyweight; // ratio
  const score = scoreFromThresholds(value, thresholds);
  const rankIdx = rankFromScore(score);
  // absolute targets for display (kg for weight standards)
  const targets = th.kind === 'w' ? th.v.map(r => r * bodyweight) : th.v;
  return { score, rankIdx, rank: RANKS[rankIdx], kind: th.kind, value, thresholds, targets };
}

/* Overall rank: average score of the user's best exercise in each
   movement pattern they have trained (needs at least 2 patterns). */
const PATTERNS = {
  'squat':   ['back-squat','front-squat','hack-squat-machine','leg-press','smith-machine-squat','goblet-squat','box-squat','pause-squat','safety-bar-squat','belt-squat','bulgarian-split-squat'],
  'hinge':   ['conventional-deadlift','sumo-deadlift','romanian-deadlift','trap-bar-deadlift','barbell-hip-thrust','good-morning','stiff-leg-deadlift','rack-pull'],
  'h-push':  ['barbell-bench-press','dumbbell-bench-press','incline-barbell-bench-press','machine-chest-press','smith-machine-bench-press','push-up','chest-dip','incline-dumbbell-press','close-grip-bench-press','weighted-dip'],
  'v-push':  ['overhead-press','dumbbell-shoulder-press','push-press','seated-barbell-press','machine-shoulder-press','seated-dumbbell-press','handstand-push-up'],
  'pull':    ['pull-up','chin-up','barbell-row','lat-pulldown-wide','seated-cable-row-close-grip','one-arm-dumbbell-row','weighted-pull-up','pendlay-row','t-bar-row','machine-row'],
  'arms':    ['barbell-curl','ez-bar-curl','dumbbell-curl','skull-crusher-ez-bar','cable-pushdown-rope','triceps-dip','hammer-curl','close-grip-bench-press'],
  'core':    ['plank','hanging-leg-raise','cable-crunch','ab-wheel-rollout','sit-up','crunch','toes-to-bar','l-sit-hold']
};

function overallRank(perExerciseScores) {
  // perExerciseScores: {exerciseId: score}
  const patScores = [];
  for (const ids of Object.values(PATTERNS)) {
    let best = null;
    for (const id of ids) {
      if (perExerciseScores[id] != null) {
        best = best == null ? perExerciseScores[id] : Math.max(best, perExerciseScores[id]);
      }
    }
    if (best != null) patScores.push(Math.min(best, 1.2));
  }
  if (patScores.length < 2) return { rankIdx: 0, rank: RANKS[0], score: 0, patterns: patScores.length };
  const score = patScores.reduce((a, b) => a + b, 0) / patScores.length;
  return { rankIdx: rankFromScore(score), rank: RANKS[rankFromScore(score)], score, patterns: patScores.length };
}

function muscleLevelFor(xp) {
  let lvl = MUSCLE_LEVELS[0], idx = 0;
  MUSCLE_LEVELS.forEach((l, i) => { if (xp >= l.xp) { lvl = l; idx = i; } });
  const next = MUSCLE_LEVELS[idx + 1] || null;
  return { ...lvl, idx, next, progress: next ? (xp - lvl.xp) / (next.xp - lvl.xp) : 1 };
}

function heatLevelFor(sets) {
  let lvl = HEAT_LEVELS[0], idx = 0;
  HEAT_LEVELS.forEach((l, i) => { if (sets >= l.sets) { lvl = l; idx = i; } });
  const next = HEAT_LEVELS[idx + 1] || null;
  return { ...lvl, idx, next, progress: next ? (sets - lvl.sets) / (next.sets - lvl.sets) : 1 };
}

/* ---- continuous shading ----
   The body map shades continuously: every set nudges the color
   toward the next level, and completing the XP bar lands exactly
   on that level's full color. */
function hexLerp(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function muscleColor(xp) {
  const lvl = muscleLevelFor(xp);
  if (!lvl.next) return lvl.color;
  return hexLerp(lvl.color, lvl.next.color, lvl.progress);
}

function heatColor(sets) {
  const lvl = heatLevelFor(sets);
  if (!lvl.next) return lvl.color;
  return hexLerp(lvl.color, lvl.next.color, lvl.progress);
}
