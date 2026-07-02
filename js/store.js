/* ============================================================
   IronRank store — accounts + workout data in localStorage.
   No server, no tracking: everything stays in this browser.
   Passcodes are stored as SHA-256 hashes (never plaintext).
   ------------------------------------------------------------
   localStorage layout:
     ironrank.users            {username: {passHash, salt, created}}
     ironrank.data.<username>  {profile, workouts}
     ironrank.session          username currently logged in
   Workout: { id, date:'YYYY-MM-DD', name, entries:[
     { exId, sets:[{weight?, reps?, secs?, mins?, km?}] } ] }
   Weights are stored in kg internally.
   ============================================================ */

const Store = (() => {
  const LS_USERS = 'ironrank.users';
  const LS_SESSION = 'ironrank.session';
  const dataKey = u => 'ironrank.data.' + u;

  const KG_PER_LB = 0.45359237;

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  function writeJSON(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  /* ---------- hashing ---------- */
  async function hash(text) {
    if (crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    }
    // FNV-1a fallback for non-secure contexts (e.g. plain http)
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return 'fnv' + h.toString(16);
  }

  /* ---------- accounts ---------- */
  function users() { return readJSON(LS_USERS, {}); }
  function userExists(name) { return !!users()[name.toLowerCase()]; }

  async function register(name, pass, profile) {
    const key = name.toLowerCase().trim();
    if (!key) throw new Error('Username required.');
    const all = users();
    if (all[key]) throw new Error('That username already exists on this device.');
    const salt = Math.random().toString(36).slice(2, 10);
    all[key] = { passHash: await hash(salt + pass), salt, created: Date.now(), display: name.trim() };
    writeJSON(LS_USERS, all);
    writeJSON(dataKey(key), {
      profile: {
        bodyweight: profile.bodyweight, // kg
        sex: profile.sex,
        units: profile.units,
        created: new Date().toISOString().slice(0, 10)
      },
      workouts: []
    });
    localStorage.setItem(LS_SESSION, key);
    return key;
  }

  async function login(name, pass) {
    const key = name.toLowerCase().trim();
    const rec = users()[key];
    if (!rec) throw new Error('No account with that username on this device.');
    if (await hash(rec.salt + pass) !== rec.passHash) throw new Error('Wrong passcode.');
    localStorage.setItem(LS_SESSION, key);
    return key;
  }

  async function changePass(user, oldPass, newPass) {
    const all = users();
    const rec = all[user];
    if (await hash(rec.salt + oldPass) !== rec.passHash) throw new Error('Current passcode is wrong.');
    rec.passHash = await hash(rec.salt + newPass);
    writeJSON(LS_USERS, all);
  }

  function logout() { localStorage.removeItem(LS_SESSION); }
  function session() { return localStorage.getItem(LS_SESSION); }
  function userList() {
    return Object.entries(users()).map(([k, v]) => v.display || k);
  }

  function deleteAccount(user) {
    const all = users();
    delete all[user];
    writeJSON(LS_USERS, all);
    localStorage.removeItem(dataKey(user));
    logout();
  }

  /* ---------- per-user data ---------- */
  let _user = null;
  let _data = null;

  function load(user) {
    _user = user;
    _data = readJSON(dataKey(user), { profile: {}, workouts: [] });
    return _data;
  }
  function save() { if (_user) writeJSON(dataKey(_user), _data); }
  function data() { return _data; }
  function profile() { return _data.profile; }
  function currentUser() { return _user; }
  function displayName() { return users()[_user]?.display || _user; }

  /* ---------- units ---------- */
  function toKg(v) { return profile().units === 'lb' ? v * KG_PER_LB : v; }
  function fromKg(v) { return profile().units === 'lb' ? v / KG_PER_LB : v; }
  function fmtWeight(kg, digits = 1) {
    const v = fromKg(kg);
    const n = Math.abs(v % 1) < 0.05 ? Math.round(v) : v.toFixed(digits);
    return n + ' ' + profile().units;
  }

  /* ---------- workouts ---------- */
  function addWorkout(w) {
    w.id = 'w' + Date.now() + Math.random().toString(36).slice(2, 6);
    _data.workouts.push(w);
    _data.workouts.sort((a, b) => a.date.localeCompare(b.date));
    save();
    return w;
  }
  function updateWorkout(w) {
    const i = _data.workouts.findIndex(x => x.id === w.id);
    if (i >= 0) _data.workouts[i] = w;
    _data.workouts.sort((a, b) => a.date.localeCompare(b.date));
    save();
  }
  function deleteWorkout(id) {
    _data.workouts = _data.workouts.filter(w => w.id !== id);
    save();
  }
  function workouts() { return _data.workouts; }

  /* ---------- derived stats ---------- */

  /* Every logged set of one exercise: [{date, set, perf}] sorted by date */
  function setsOf(exId) {
    const ex = EXERCISES_BY_ID[exId];
    const out = [];
    for (const w of _data.workouts) {
      for (const en of w.entries) {
        if (en.exId !== exId) continue;
        for (const s of en.sets) out.push({ date: w.date, set: s, perf: performanceOfSet(ex, s) });
      }
    }
    return out;
  }

  /* Best performance per exercise (all time) => {exId: perf} */
  function bestPerformances() {
    const best = {};
    for (const w of _data.workouts) {
      for (const en of w.entries) {
        const ex = EXERCISES_BY_ID[en.exId];
        if (!ex) continue;
        for (const s of en.sets) {
          const p = performanceOfSet(ex, s);
          if (p > (best[en.exId] || 0)) best[en.exId] = p;
        }
      }
    }
    return best;
  }

  /* Per-exercise rank scores => {exId: score} */
  function exerciseScores() {
    const best = bestPerformances();
    const scores = {};
    const bw = profile().bodyweight, sex = profile().sex;
    for (const [exId, perf] of Object.entries(best)) {
      const ex = EXERCISES_BY_ID[exId];
      const ev = ex && evaluateExercise(ex, perf, bw, sex);
      if (ev) scores[exId] = ev.score;
    }
    return scores;
  }

  /* Muscle XP (all time) and 30-day heat sets.
     XP: 10/set primary, 5/set secondary. Cardio: 1 XP per 2 min. */
  function muscleStats() {
    const xp = {}, heat = {}, last = {};
    for (const m of Object.keys(MUSCLES)) { xp[m] = 0; heat[m] = 0; last[m] = null; }
    const cutoff = dateOffset(todayStr(), -30);
    for (const w of _data.workouts) {
      const recent = w.date >= cutoff;
      for (const en of w.entries) {
        const ex = EXERCISES_BY_ID[en.exId];
        if (!ex) continue;
        let units = en.sets.length; // per-set credit
        if (ex.type === 'c') {
          const mins = en.sets.reduce((a, s) => a + (s.mins || 0), 0);
          units = mins / 10; // 10 cardio minutes ~ one "set" of credit
        }
        for (const m of ex.p) {
          xp[m] += 10 * units;
          if (recent) heat[m] += units;
          if (!last[m] || w.date > last[m]) last[m] = w.date;
        }
        for (const m of ex.s || []) {
          xp[m] += 5 * units;
          if (recent) heat[m] += 0.5 * units;
          if (!last[m] || w.date > last[m]) last[m] = w.date;
        }
      }
    }
    return { xp, heat, last };
  }

  /* Weekly totals for the last n ISO weeks: [{label, sets, volume}] */
  function weeklyTotals(nWeeks = 12) {
    const weeks = [];
    const now = new Date(todayStr() + 'T12:00:00');
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    for (let i = nWeeks - 1; i >= 0; i--) {
      const start = new Date(monday); start.setDate(monday.getDate() - 7 * i);
      const end = new Date(start); end.setDate(start.getDate() + 6);
      weeks.push({ start: iso(start), end: iso(end), label: (start.getMonth() + 1) + '/' + start.getDate(), sets: 0, volume: 0 });
    }
    for (const w of _data.workouts) {
      const wk = weeks.find(x => w.date >= x.start && w.date <= x.end);
      if (!wk) continue;
      for (const en of w.entries) {
        const ex = EXERCISES_BY_ID[en.exId];
        if (!ex || ex.type === 'c') continue;
        wk.sets += en.sets.length;
        for (const s of en.sets) wk.volume += (s.weight || 0) * (s.reps || 0);
      }
    }
    return weeks;
  }

  /* Current streak: consecutive weeks (ending this week) with >=1 workout */
  function weekStreak() {
    if (!_data.workouts.length) return 0;
    const weeks = new Set(_data.workouts.map(w => isoWeek(w.date)));
    let streak = 0;
    let d = new Date(todayStr() + 'T12:00:00');
    while (weeks.has(isoWeek(iso(d)))) {
      streak++;
      d.setDate(d.getDate() - 7);
    }
    return streak;
  }

  /* All-time personal records list, newest first */
  function personalRecords(limit = 8) {
    const best = {}; const prs = [];
    for (const w of _data.workouts) {
      for (const en of w.entries) {
        const ex = EXERCISES_BY_ID[en.exId];
        if (!ex || ex.type === 'c') continue;
        for (const s of en.sets) {
          const p = performanceOfSet(ex, s);
          if (p > (best[en.exId] || 0)) {
            best[en.exId] = p;
            prs.push({ date: w.date, ex, set: s, perf: p });
          }
        }
      }
    }
    return prs.reverse().slice(0, limit);
  }

  /* ---------- export / import ---------- */
  function exportData() {
    return JSON.stringify({ app: 'ironrank', version: 1, user: _user, exported: new Date().toISOString(), data: _data }, null, 2);
  }
  function importData(json) {
    const obj = JSON.parse(json);
    if (obj.app !== 'ironrank' || !obj.data?.workouts) throw new Error('Not an IronRank export file.');
    _data = obj.data;
    save();
  }

  /* ---------- date helpers ---------- */
  function todayStr() {
    const d = new Date();
    return iso(d);
  }
  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dateOffset(dateStr, days) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return iso(d);
  }
  function isoWeek(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day + 3); // Thursday of this week
    const jan4 = new Date(d.getFullYear(), 0, 4);
    const week = 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
    return d.getFullYear() + '-W' + week;
  }

  return {
    register, login, logout, session, userList, userExists, changePass, deleteAccount,
    load, save, data, profile, currentUser, displayName,
    toKg, fromKg, fmtWeight,
    addWorkout, updateWorkout, deleteWorkout, workouts,
    setsOf, bestPerformances, exerciseScores, muscleStats, weeklyTotals, weekStreak, personalRecords,
    exportData, importData,
    todayStr, dateOffset
  };
})();
