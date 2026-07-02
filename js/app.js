/* ============================================================
   IronRank app — views, workout logger, rank system UI.
   ============================================================ */

/* ---------------- tiny DOM helpers ---------------- */
const $ = s => document.querySelector(s);
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

function toast(msg, cls = '') {
  const el = h(`<div class="toast ${cls}">${msg}</div>`);
  $('#toast-container').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .4s'; }, 2600);
  setTimeout(() => el.remove(), 3100);
}

function openModal(contentEl) {
  const m = $('#modal');
  m.innerHTML = '';
  m.appendChild(contentEl);
  $('#modal-backdrop').classList.remove('hidden');
}
function closeModal() { $('#modal-backdrop').classList.add('hidden'); $('#modal').innerHTML = ''; }
$('#modal-backdrop').addEventListener('click', e => { if (e.target === $('#modal-backdrop')) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

function rankBadge(rankIdx, opts = {}) {
  const r = RANKS[rankIdx] || RANKS[0];
  return `<span class="rank-badge ${opts.lg ? 'lg' : ''}"><span class="rank-dot" style="background:${r.color}"></span>${r.name}</span>`;
}
function fmtDate(d) {
  return new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtPerf(ex, perf) {
  if (ex.type === 'w') return Store.fmtWeight(perf) + ' e1RM';
  if (ex.type === 'bw') return Math.round(perf) + ' reps';
  if (ex.type === 't') return Math.round(perf) + 's';
  return '';
}
function equipLabel(e) { return e.charAt(0).toUpperCase() + e.slice(1); }

/* ---------------- auth screen ---------------- */
function showAuth() {
  $('#app').classList.add('hidden');
  $('#auth-screen').classList.remove('hidden');
  const users = Store.userList();
  const ku = $('#known-users');
  ku.innerHTML = users.length
    ? 'Accounts on this device: ' + users.map(u => `<button type="button" data-u="${esc(u)}">${esc(u)}</button>`).join('')
    : '<span class="muted">No accounts on this device yet — create one.</span>';
  ku.querySelectorAll('button').forEach(b => b.onclick = () => { $('#login-user').value = b.dataset.u; $('#login-pass').focus(); });
}

$('#tab-login').onclick = () => switchAuthTab('login');
$('#tab-register').onclick = () => switchAuthTab('register');
function switchAuthTab(which) {
  $('#tab-login').classList.toggle('active', which === 'login');
  $('#tab-register').classList.toggle('active', which === 'register');
  $('#login-form').classList.toggle('hidden', which !== 'login');
  $('#register-form').classList.toggle('hidden', which !== 'register');
}

$('#login-form').onsubmit = async e => {
  e.preventDefault();
  const err = $('#login-error'); err.classList.add('hidden');
  try {
    const user = await Store.login($('#login-user').value, $('#login-pass').value);
    enterApp(user);
  } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
};

$('#register-form').onsubmit = async e => {
  e.preventDefault();
  const err = $('#reg-error'); err.classList.add('hidden');
  try {
    const units = $('#reg-units').value;
    let bw = parseFloat($('#reg-bw').value);
    if (units === 'lb') bw *= 0.45359237;
    const user = await Store.register($('#reg-user').value, $('#reg-pass').value, {
      bodyweight: +bw.toFixed(1), sex: $('#reg-sex').value, units
    });
    enterApp(user);
    toast('Welcome to IronRank, ' + esc(Store.displayName()) + '! 💪');
  } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
};

$('#logout-btn').onclick = () => { Store.logout(); location.reload(); };

function enterApp(user) {
  Store.load(user);
  $('#auth-screen').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#topbar-user').textContent = Store.displayName();
  restoreDraft();
  refreshTopbar();
  showView('dashboard');
}

function refreshTopbar() {
  const ov = overallRank(Store.exerciseScores());
  $('#topbar-rank').outerHTML = `<span id="topbar-rank">${rankBadge(ov.rankIdx)}</span>`;
}

/* ---------------- router ---------------- */
const VIEWS = {
  dashboard: renderDashboard, workout: renderWorkout, exercises: renderExercises,
  bodymap: renderBodymap, ranks: renderRanks, history: renderHistory, settings: renderSettings
};
let currentView = 'dashboard';
document.querySelectorAll('.nav-btn').forEach(b => b.onclick = () => showView(b.dataset.view));
function showView(name) {
  currentView = name;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === name));
  const main = $('#main');
  main.innerHTML = '';
  VIEWS[name](main);
  window.scrollTo({ top: 0 });
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboard(main) {
  const scores = Store.exerciseScores();
  const ov = overallRank(scores);
  const weeks = Store.weeklyTotals(12);
  const thisWeek = weeks[weeks.length - 1];
  const streak = Store.weekStreak();
  const prs = Store.personalRecords(6);
  const nWorkouts = Store.workouts().length;

  main.appendChild(h(`
    <div class="stat-row">
      <div class="stat-tile"><div class="stat-value" style="color:${ov.rank.color}">${ov.rank.name}</div>
        <div class="stat-label">Overall rank${ov.patterns < 2 ? ' — log 2+ movement patterns to get ranked' : ''}</div></div>
      <div class="stat-tile"><div class="stat-value">${thisWeek.sets}</div><div class="stat-label">Sets this week</div>
        <div class="stat-sub">${Store.fmtWeight(thisWeek.volume, 0)} lifted</div></div>
      <div class="stat-tile"><div class="stat-value">${streak}</div><div class="stat-label">Week streak ${streak >= 4 ? '🔥' : ''}</div></div>
      <div class="stat-tile"><div class="stat-value">${nWorkouts}</div><div class="stat-label">Total workouts</div></div>
    </div>`));

  const cta = h(`<div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
      <div><h2>${nWorkouts ? 'Ready to train?' : 'Log your first workout'}</h2>
      <span class="hint">${nWorkouts ? 'Every set feeds your ranks and lights up your muscle map.' : 'Pick from ' + EXERCISES.length + ' exercises and start earning ranks.'}</span></div>
      <button class="btn btn-primary" id="cta-workout">➕ Start workout</button></div>`);
  cta.querySelector('#cta-workout').onclick = () => showView('workout');
  main.appendChild(cta);

  const grid = h(`<div class="grid-2"></div>`);
  main.appendChild(grid);

  // weekly sets chart
  const chartCard = h(`<div class="card"><div class="card-title">Weekly training sets</div>
    <div class="chart-wrap" style="height:190px"><canvas></canvas></div></div>`);
  grid.appendChild(chartCard);
  requestAnimationFrame(() => Charts.bars(chartCard.querySelector('canvas'),
    weeks.map(w => ({ label: w.label, value: w.sets, sub: Store.fmtWeight(w.volume, 0) + ' total volume' }))));

  // mini muscle map
  const { xp } = Store.muscleStats();
  const colors = {}; const titles = {};
  for (const m of Object.keys(MUSCLES)) {
    const lvl = muscleLevelFor(xp[m]);
    colors[m] = lvl.color;
    titles[m] = `${MUSCLES[m].name}: ${lvl.name}`;
  }
  const mapCard = h(`<div class="card"><div class="card-title">Muscle map — training level</div>
    <div class="bodymap-figures"><div class="fig-f"></div><div class="fig-b"></div></div>
    <div style="text-align:center;margin-top:8px"><button class="btn btn-ghost btn-sm" id="open-map">Open full body map →</button></div></div>`);
  grid.appendChild(mapCard);
  Silhouette.render(mapCard.querySelector('.fig-f'), 'front', colors, m => openMuscleModal(m), titles);
  Silhouette.render(mapCard.querySelector('.fig-b'), 'back', colors, m => openMuscleModal(m), titles);
  mapCard.querySelector('#open-map').onclick = () => showView('bodymap');

  // recent PRs
  const prCard = h(`<div class="card"><div class="card-title">Recent personal records</div><div class="pr-list"></div></div>`);
  const prList = prCard.querySelector('.pr-list');
  if (!prs.length) prList.innerHTML = '<span class="hint">PRs will appear here once you log workouts.</span>';
  for (const pr of prs) {
    const row = h(`<div class="list-item">
      <div><span class="ex-name">${esc(pr.ex.name)}</span><br><span class="ex-tags">${fmtDate(pr.date)}</span></div>
      <div style="text-align:right"><strong style="color:var(--ink)">${fmtPerf(pr.ex, pr.perf)}</strong><br>
      <span class="ex-tags">${setLabel(pr.ex, pr.set)}</span></div></div>`);
    row.style.cursor = 'pointer';
    row.onclick = () => openExerciseModal(pr.ex.id);
    prList.appendChild(row);
  }
  main.appendChild(prCard);

  // top ranked lifts
  const ranked = Object.entries(scores).map(([id, s]) => ({ ex: EXERCISES_BY_ID[id], s }))
    .sort((a, b) => b.s - a.s).slice(0, 6);
  if (ranked.length) {
    const tl = h(`<div class="card"><div class="card-title">Your strongest lifts</div><div></div></div>`);
    const box = tl.querySelector('div:last-child');
    const best = Store.bestPerformances();
    for (const { ex, s } of ranked) {
      const ev = evaluateExercise(ex, best[ex.id], Store.profile().bodyweight, Store.profile().sex);
      const row = h(`<div class="list-item" style="cursor:pointer">
        <div><span class="ex-name">${esc(ex.name)}</span><br><span class="ex-tags">${fmtPerf(ex, best[ex.id])}</span></div>
        <div>${rankBadge(ev.rankIdx)}</div></div>`);
      row.onclick = () => openExerciseModal(ex.id);
      box.appendChild(row);
    }
    main.appendChild(tl);
  }
}

function setLabel(ex, s) {
  if (ex.type === 'w') return `${Store.fmtWeight(s.weight)} × ${s.reps}`;
  if (ex.type === 'bw') return `${s.reps} reps` + (s.weight ? ` (+${Store.fmtWeight(s.weight)})` : '');
  if (ex.type === 't') return `${s.secs}s hold`;
  return `${s.mins || 0} min` + (s.km ? ` · ${s.km} km` : '');
}

/* ============================================================
   WORKOUT LOGGER
   ============================================================ */
let draft = null;
const draftKey = () => 'ironrank.draft.' + Store.currentUser();

function newDraft() { draft = { date: Store.todayStr(), name: '', entries: [], editingId: null }; }
function saveDraft() { localStorage.setItem(draftKey(), JSON.stringify(draft)); }
function restoreDraft() {
  try { draft = JSON.parse(localStorage.getItem(draftKey())) || null; } catch { draft = null; }
  if (!draft || !draft.entries) newDraft();
}

function renderWorkout(main) {
  if (!draft) newDraft();
  const card = h(`<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
      <h2>${draft.editingId ? '✏️ Editing workout' : 'Log workout'}</h2>
      <div class="form-row" style="margin:0;align-items:center;gap:8px">
        <input type="date" id="w-date" value="${draft.date}" style="width:auto">
        <input type="text" id="w-name" placeholder="Name (optional)" value="${esc(draft.name)}" style="width:170px">
      </div>
    </div>
    <div id="entries"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
      <button class="btn" id="add-ex">＋ Add exercise</button>
      <button class="btn btn-primary" id="finish" style="margin-left:auto">✔ ${draft.editingId ? 'Save changes' : 'Finish workout'}</button>
      ${draft.entries.length || draft.editingId ? '<button class="btn btn-danger" id="discard">Discard</button>' : ''}
    </div></div>`);
  main.appendChild(card);

  card.querySelector('#w-date').onchange = e => { draft.date = e.target.value; saveDraft(); };
  card.querySelector('#w-name').oninput = e => { draft.name = e.target.value; saveDraft(); };
  card.querySelector('#add-ex').onclick = () => openExercisePicker(ex => { addEntry(ex); showView('workout'); });
  card.querySelector('#finish').onclick = finishWorkout;
  const discard = card.querySelector('#discard');
  if (discard) discard.onclick = () => {
    if (confirm('Discard this workout draft?')) { newDraft(); saveDraft(); showView('workout'); }
  };

  const box = card.querySelector('#entries');
  if (!draft.entries.length) {
    box.appendChild(h(`<p class="hint" style="padding:18px 4px">No exercises yet. Hit <b>＋ Add exercise</b> — search ${EXERCISES.length} movements by name, muscle or equipment.</p>`));
  }
  draft.entries.forEach((en, i) => box.appendChild(entryEl(en, i)));
}

function addEntry(ex) {
  // prefill from the most recent time this exercise was done
  const prev = Store.setsOf(ex.id);
  let sets = [{}];
  if (prev.length) {
    const lastDate = prev[prev.length - 1].date;
    sets = prev.filter(p => p.date === lastDate).map(p => displaySet(ex, p.set));
  }
  draft.entries.push({ exId: ex.id, sets });
  saveDraft();
}

/* convert a stored (kg) set to display units for editing */
function displaySet(ex, s) {
  const out = { ...s };
  if (out.weight != null) out.weight = +Store.fromKg(out.weight).toFixed(1);
  return out;
}

function entryEl(en, idx) {
  const ex = EXERCISES_BY_ID[en.exId];
  const best = Store.bestPerformances()[en.exId];
  const wrap = h(`<div class="workout-entry">
    <div class="workout-entry-head">
      <div><span class="ex-name" style="cursor:pointer">${esc(ex.name)}</span>
        <div class="ex-tags">${ex.p.map(m => MUSCLES[m].name).join(', ')} · ${equipLabel(ex.equip)}${best ? ' · best: ' + fmtPerf(ex, best) : ''}</div></div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-ghost btn-sm add-set">＋ Set</button>
        <button class="set-del rm-ex" title="Remove exercise">✕</button>
      </div></div>
    <div class="sets"></div></div>`);
  wrap.querySelector('.ex-name').onclick = () => openExerciseModal(ex.id);
  wrap.querySelector('.rm-ex').onclick = () => { draft.entries.splice(idx, 1); saveDraft(); showView('workout'); };
  wrap.querySelector('.add-set').onclick = () => {
    en.sets.push({ ...en.sets[en.sets.length - 1] } || {});
    saveDraft(); showView('workout');
  };
  const setsBox = wrap.querySelector('.sets');
  en.sets.forEach((s, si) => setsBox.appendChild(setRowEl(ex, en, s, si)));
  return wrap;
}

function setRowEl(ex, en, s, si) {
  const u = Store.profile().units;
  let fields = '';
  if (ex.type === 'w') fields = `
    <input type="number" step="any" min="0" data-f="weight" placeholder="${u}" value="${s.weight ?? ''}">
    <span class="muted">×</span>
    <input type="number" min="0" data-f="reps" placeholder="reps" value="${s.reps ?? ''}">`;
  else if (ex.type === 'bw') fields = `
    <input type="number" min="0" data-f="reps" placeholder="reps" value="${s.reps ?? ''}">
    <span class="muted">+</span>
    <input type="number" step="any" min="0" data-f="weight" placeholder="${u} (opt)" value="${s.weight ?? ''}">`;
  else if (ex.type === 't') fields = `
    <input type="number" min="0" data-f="secs" placeholder="seconds" value="${s.secs ?? ''}">`;
  else fields = `
    <input type="number" step="any" min="0" data-f="mins" placeholder="min" value="${s.mins ?? ''}">
    <input type="number" step="any" min="0" data-f="km" placeholder="km (opt)" value="${s.km ?? ''}">`;

  const row = h(`<div class="set-row"><span class="set-num">${si + 1}</span>${fields}
    <span class="set-perf"></span><button class="set-del" title="Remove set">✕</button></div>`);
  const perfEl = row.querySelector('.set-perf');

  const updatePerf = () => {
    if (ex.type === 'w' && s.weight && s.reps) {
      const e1 = epley1RM(Store.toKg(+s.weight), +s.reps);
      const ev = evaluateExercise(ex, e1, Store.profile().bodyweight, Store.profile().sex);
      perfEl.textContent = 'e1RM ' + Store.fmtWeight(e1) + (ev ? ' · ' + ev.rank.name : '');
    } else if (ex.type === 'bw' && s.reps) {
      const ev = evaluateExercise(ex, +s.reps, Store.profile().bodyweight, Store.profile().sex);
      perfEl.textContent = ev ? ev.rank.name : '';
    } else if (ex.type === 't' && s.secs) {
      const ev = evaluateExercise(ex, +s.secs, Store.profile().bodyweight, Store.profile().sex);
      perfEl.textContent = ev ? ev.rank.name : '';
    } else perfEl.textContent = '';
  };
  updatePerf();

  row.querySelectorAll('input').forEach(inp => inp.oninput = () => {
    const v = inp.value === '' ? undefined : +inp.value;
    s[inp.dataset.f] = v;
    saveDraft(); updatePerf();
  });
  row.querySelector('.set-del').onclick = () => {
    en.sets.splice(si, 1);
    if (!en.sets.length) en.sets.push({});
    saveDraft(); showView('workout');
  };
  return row;
}

function finishWorkout() {
  // build clean workout (weights -> kg, drop empty sets/entries)
  const entries = [];
  for (const en of draft.entries) {
    const ex = EXERCISES_BY_ID[en.exId];
    const sets = en.sets.filter(s =>
      ex.type === 'w' ? (s.weight && s.reps) :
      ex.type === 'bw' ? s.reps :
      ex.type === 't' ? s.secs : (s.mins || s.km)
    ).map(s => {
      const out = {};
      if (s.weight) out.weight = +Store.toKg(+s.weight).toFixed(2);
      if (s.reps) out.reps = Math.round(+s.reps);
      if (s.secs) out.secs = Math.round(+s.secs);
      if (s.mins) out.mins = +(+s.mins).toFixed(1);
      if (s.km) out.km = +(+s.km).toFixed(2);
      return out;
    });
    if (sets.length) entries.push({ exId: en.exId, sets });
  }
  if (!entries.length) { toast('Nothing to save — add at least one completed set.'); return; }

  const before = snapshotRanks();
  const w = { date: draft.date, name: draft.name.trim(), entries };
  if (draft.editingId) { w.id = draft.editingId; Store.updateWorkout(w); }
  else Store.addWorkout(w);
  announceRankUps(before);

  newDraft(); saveDraft();
  refreshTopbar();
  toast('Workout saved 💪');
  showView('dashboard');
}

function snapshotRanks() {
  const scores = Store.exerciseScores();
  const perEx = {};
  for (const [id, s] of Object.entries(scores)) perEx[id] = rankFromScore(Math.min(s, 1));
  return { perEx, overall: overallRank(scores).rankIdx };
}
function announceRankUps(before) {
  const after = snapshotRanks();
  let delay = 300;
  for (const [id, r] of Object.entries(after.perEx)) {
    if (r > (before.perEx[id] || 0)) {
      const ex = EXERCISES_BY_ID[id];
      setTimeout(() => toast(`🎉 Rank up! ${esc(ex.name)} → ${RANKS[r].name}`, 'rankup'), delay);
      delay += 900;
    }
  }
  if (after.overall > before.overall) {
    setTimeout(() => toast(`🏆 OVERALL RANK UP → ${RANKS[after.overall].name}!`, 'rankup'), delay);
  }
}

/* ---------------- exercise picker modal ---------------- */
function openExercisePicker(onPick) {
  const m = h(`<div>
    <div class="modal-head"><h2>Add exercise</h2><button class="modal-close">×</button></div>
    <div class="filters">
      <input type="search" placeholder="Search ${EXERCISES.length} exercises…" id="pk-q">
      <select id="pk-muscle"><option value="">All muscles</option>
        ${Object.entries(MUSCLES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select>
      <select id="pk-equip"><option value="">All equipment</option>
        ${EQUIPMENT.map(e => `<option value="${e}">${equipLabel(e)}</option>`).join('')}</select>
    </div>
    <div id="pk-list" style="max-height:55vh;overflow-y:auto"></div></div>`);
  m.querySelector('.modal-close').onclick = closeModal;

  const list = m.querySelector('#pk-list');
  const refresh = () => {
    const q = m.querySelector('#pk-q').value.toLowerCase();
    const mus = m.querySelector('#pk-muscle').value;
    const eq = m.querySelector('#pk-equip').value;
    list.innerHTML = '';
    const inDraft = new Set(draft ? draft.entries.map(e => e.exId) : []);
    const matches = EXERCISES.filter(ex =>
      (!q || ex.name.toLowerCase().includes(q)) &&
      (!mus || ex.p.includes(mus) || (ex.s || []).includes(mus)) &&
      (!eq || ex.equip === eq));
    for (const ex of matches.slice(0, 80)) {
      const row = h(`<div class="list-item" style="cursor:pointer">
        <div><span class="ex-name">${esc(ex.name)}</span>${inDraft.has(ex.id) ? ' <span class="chip">in workout</span>' : ''}<br>
          <span class="ex-tags">${ex.p.map(x => MUSCLES[x].name).join(', ')} · ${equipLabel(ex.equip)}</span></div>
        <span class="muted">＋</span></div>`);
      row.onclick = () => { closeModal(); onPick(ex); };
      list.appendChild(row);
    }
    if (!matches.length) list.innerHTML = '<p class="hint" style="padding:14px 4px">No exercises match.</p>';
  };
  m.querySelector('#pk-q').oninput = refresh;
  m.querySelector('#pk-muscle').onchange = refresh;
  m.querySelector('#pk-equip').onchange = refresh;
  refresh();
  openModal(m);
  m.querySelector('#pk-q').focus();
}

/* ============================================================
   EXERCISES LIBRARY
   ============================================================ */
function renderExercises(main) {
  const card = h(`<div class="card">
    <h2>Exercise library</h2>
    <p class="hint" style="margin-bottom:12px">${EXERCISES.length} exercises. Click one for standards, your history and progress chart.</p>
    <div class="filters">
      <input type="search" placeholder="Search…" id="lx-q">
      <select id="lx-muscle"><option value="">All muscles</option>
        ${Object.entries(MUSCLES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}</select>
      <select id="lx-equip"><option value="">All equipment</option>
        ${EQUIPMENT.map(e => `<option value="${e}">${equipLabel(e)}</option>`).join('')}</select>
      <select id="lx-done"><option value="">All</option><option value="done">Trained by me</option><option value="new">Not tried yet</option></select>
    </div>
    <div class="table-scroll"><table>
      <thead><tr><th>Exercise</th><th>Muscles</th><th class="num">Your best</th><th>Rank</th></tr></thead>
      <tbody id="lx-body"></tbody></table></div></div>`);
  main.appendChild(card);

  const best = Store.bestPerformances();
  const bw = Store.profile().bodyweight, sex = Store.profile().sex;
  const body = card.querySelector('#lx-body');
  const refresh = () => {
    const q = card.querySelector('#lx-q').value.toLowerCase();
    const mus = card.querySelector('#lx-muscle').value;
    const eq = card.querySelector('#lx-equip').value;
    const done = card.querySelector('#lx-done').value;
    body.innerHTML = '';
    const matches = EXERCISES.filter(ex =>
      (!q || ex.name.toLowerCase().includes(q)) &&
      (!mus || ex.p.includes(mus) || (ex.s || []).includes(mus)) &&
      (!eq || ex.equip === eq) &&
      (!done || (done === 'done') === !!best[ex.id]));
    for (const ex of matches.slice(0, 120)) {
      const ev = best[ex.id] ? evaluateExercise(ex, best[ex.id], bw, sex) : null;
      const tr = h(`<tr class="clickable">
        <td><span class="ex-name">${esc(ex.name)}</span><br><span class="ex-tags">${equipLabel(ex.equip)}</span></td>
        <td>${ex.p.map(x => `<span class="chip">${MUSCLES[x].name}</span>`).join('')}</td>
        <td class="num">${best[ex.id] ? fmtPerf(ex, best[ex.id]) : '—'}</td>
        <td>${ev ? rankBadge(ev.rankIdx) : (ex.std ? rankBadge(0) : '<span class="hint">volume only</span>')}</td></tr>`);
      tr.onclick = () => openExerciseModal(ex.id);
      body.appendChild(tr);
    }
    if (matches.length > 120) body.appendChild(h(`<tr><td colspan="4" class="hint">Showing 120 of ${matches.length} — refine your search.</td></tr>`));
    if (!matches.length) body.appendChild(h('<tr><td colspan="4" class="hint">No exercises match.</td></tr>'));
  };
  card.querySelector('#lx-q').oninput = refresh;
  ['#lx-muscle', '#lx-equip', '#lx-done'].forEach(sel => card.querySelector(sel).onchange = refresh);
  refresh();
}

/* ---------------- exercise detail modal ---------------- */
function openExerciseModal(exId) {
  const ex = EXERCISES_BY_ID[exId];
  const sets = Store.setsOf(exId);
  const best = sets.reduce((m, s) => Math.max(m, s.perf), 0);
  const bw = Store.profile().bodyweight, sex = Store.profile().sex;
  const ev = best ? evaluateExercise(ex, best, bw, sex) : null;

  const m = h(`<div>
    <div class="modal-head">
      <div><h2>${esc(ex.name)}</h2>
        <div class="ex-tags" style="margin-top:4px">${equipLabel(ex.equip)} ·
          ${ex.p.map(x => `<span class="chip">${MUSCLES[x].name}</span>`).join('')}
          ${(ex.s || []).map(x => `<span class="chip" style="opacity:.55">${MUSCLES[x].name}</span>`).join('')}</div></div>
      <button class="modal-close">×</button></div>
    <div class="body"></div></div>`);
  m.querySelector('.modal-close').onclick = closeModal;
  const body = m.querySelector('.body');

  // rank + progress to next
  if (ex.std) {
    const th = exThresholds(ex, sex);
    let rankHtml = `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">
      ${rankBadge(ev ? ev.rankIdx : 0, { lg: true })}
      <span class="hint">${ev ? 'best: ' + fmtPerf(ex, best) : 'No sets logged yet'}</span></div>`;
    if (ev && ev.rankIdx < 5) {
      const nextTarget = ev.targets[ev.rankIdx]; // targets index: 0..4 = B..E thresholds
      const need = th.kind === 'w' ? Store.fmtWeight(nextTarget) + ' e1RM'
        : th.kind === 'r' ? nextTarget + ' reps' : nextTarget + 's';
      rankHtml += `<div class="progressbar" style="margin-bottom:6px"><div style="width:${Math.min(100, (ev.score % 0.2) / 0.2 * 100).toFixed(0)}%"></div></div>
        <p class="hint" style="margin-bottom:12px">Next: <b style="color:var(--ink)">${RANKS[ev.rankIdx + 1].name}</b> at ${need}</p>`;
    }
    // standards table
    const unitRow = th.v.map((v, i) => {
      const val = th.kind === 'w' ? Store.fmtWeight(v * bw, 0) : th.kind === 'r' ? v + ' reps' : v + 's';
      const active = ev && ev.rankIdx === i + 1;
      return `<td class="num" style="${active ? 'color:var(--ink);font-weight:700' : ''}">${val}</td>`;
    }).join('');
    rankHtml += `<div class="table-scroll"><table><thead><tr>
      ${RANKS.slice(1).map(r => `<th class="num"><span class="rank-dot" style="background:${r.color};display:inline-block;margin-right:4px"></span>${r.name}</th>`).join('')}
      </tr></thead><tbody><tr>${unitRow}</tr></tbody></table></div>
      <p class="hint" style="margin-top:6px">${th.kind === 'w' ? 'Estimated-1RM targets at your bodyweight (' + Store.fmtWeight(bw) + ', ' + (sex === 'f' ? 'female' : 'male') + ' standards).' : 'Single-set targets (' + (sex === 'f' ? 'female' : 'male') + ' standards).'}</p>`;
    body.appendChild(h(`<div style="margin-bottom:16px">${rankHtml}</div>`));
  }

  // progression chart: best per day
  if (sets.length) {
    const byDay = {};
    for (const s of sets) byDay[s.date] = Math.max(byDay[s.date] || 0, ex.type === 'c' ? (s.set.mins || 0) : s.perf);
    const points = Object.entries(byDay).map(([d, v]) => ({
      x: new Date(d + 'T12:00:00').getTime(), y: ex.type === 'w' ? Store.fromKg(v) : v,
      label: fmtDate(d)
    })).sort((a, b) => a.x - b.x);
    const yLabel = ex.type === 'w' ? 'Estimated 1RM (' + Store.profile().units + ')' :
      ex.type === 'bw' ? 'Best reps in a set' : ex.type === 't' ? 'Longest hold (s)' : 'Minutes per session';
    const cc = h(`<div style="margin-bottom:16px"><div class="card-title">${yLabel}</div>
      <div class="chart-wrap" style="height:200px"><canvas></canvas></div></div>`);
    body.appendChild(cc);
    requestAnimationFrame(() => Charts.line(cc.querySelector('canvas'), points,
      { yFmt: v => ex.type === 'w' ? Math.round(v) + ' ' + Store.profile().units : String(Math.round(v)) }));

    // recent history
    const recent = sets.slice(-10).reverse();
    body.appendChild(h(`<div><div class="card-title">Recent sets</div><div class="table-scroll"><table>
      <thead><tr><th>Date</th><th>Set</th><th class="num">${ex.type === 'w' ? 'e1RM' : ''}</th></tr></thead>
      <tbody>${recent.map(s => `<tr><td>${fmtDate(s.date)}</td><td>${setLabel(ex, s.set)}</td>
        <td class="num">${ex.type === 'w' ? Store.fmtWeight(s.perf) : ''}</td></tr>`).join('')}</tbody></table></div></div>`));
  } else {
    body.appendChild(h('<p class="hint">You haven\'t logged this exercise yet.</p>'));
  }

  const foot = h(`<div style="margin-top:16px;text-align:right"><button class="btn btn-primary">➕ Add to workout</button></div>`);
  foot.querySelector('button').onclick = () => {
    if (!draft) newDraft();
    if (!draft.entries.some(e => e.exId === ex.id)) addEntry(ex);
    closeModal(); showView('workout');
  };
  body.appendChild(foot);
  openModal(m);
}

/* ============================================================
   BODY MAP
   ============================================================ */
let bodymapMode = 'level';
function renderBodymap(main) {
  const { xp, heat, last } = Store.muscleStats();

  const card = h(`<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:6px">
      <div><h2>Body map</h2><span class="hint">Muscles change color as you train them. Click any muscle for details.</span></div>
      <div class="mode-toggle">
        <button data-m="level" class="${bodymapMode === 'level' ? 'active' : ''}">All-time level</button>
        <button data-m="heat" class="${bodymapMode === 'heat' ? 'active' : ''}">Last 30 days</button>
      </div></div>
    <div class="bodymap-figures" style="margin-top:12px"><div class="fig-f"></div><div class="fig-b"></div></div>
    <div class="legend"></div></div>`);
  main.appendChild(card);

  card.querySelectorAll('.mode-toggle button').forEach(b => b.onclick = () => { bodymapMode = b.dataset.m; showView('bodymap'); });

  const colors = {}, titles = {};
  for (const mkey of Object.keys(MUSCLES)) {
    if (bodymapMode === 'level') {
      const lvl = muscleLevelFor(xp[mkey]);
      colors[mkey] = lvl.color;
      titles[mkey] = `${MUSCLES[mkey].name}: ${lvl.name} (${Math.round(xp[mkey])} XP)`;
    } else {
      const hl = heatLevelFor(heat[mkey]);
      colors[mkey] = hl.color;
      titles[mkey] = `${MUSCLES[mkey].name}: ${Math.round(heat[mkey])} sets in 30 days (${hl.name})`;
    }
  }
  Silhouette.render(card.querySelector('.fig-f'), 'front', colors, m => openMuscleModal(m), titles);
  Silhouette.render(card.querySelector('.fig-b'), 'back', colors, m => openMuscleModal(m), titles);

  const legend = card.querySelector('.legend');
  const levels = bodymapMode === 'level' ? MUSCLE_LEVELS : HEAT_LEVELS;
  legend.innerHTML = levels.map(l =>
    `<span class="legend-item"><span class="legend-swatch" style="background:${l.color}"></span>${l.name}</span>`).join('');

  // muscle table (accessibility + detail: never color-alone)
  const rows = Object.keys(MUSCLES).filter(k => k !== 'cardio').map(k => {
    const lvl = muscleLevelFor(xp[k]);
    return { k, lvl, xp: xp[k], heat: heat[k], last: last[k] };
  }).sort((a, b) => b.xp - a.xp);
  const table = h(`<div class="card"><div class="card-title">Muscle detail</div><div class="table-scroll"><table>
    <thead><tr><th>Muscle</th><th>Level</th><th class="num">XP</th><th class="num">Sets (30d)</th><th>Last trained</th><th style="width:26%">Next level</th></tr></thead>
    <tbody>${rows.map(r => `<tr class="clickable" data-m="${r.k}">
      <td class="ex-name">${MUSCLES[r.k].name}</td>
      <td><span class="rank-dot" style="background:${r.lvl.color};display:inline-block;margin-right:6px"></span>${r.lvl.name}</td>
      <td class="num">${Math.round(r.xp)}</td>
      <td class="num">${Math.round(r.heat)}</td>
      <td>${r.last ? fmtDate(r.last) : '—'}</td>
      <td><div class="progressbar"><div style="width:${(r.lvl.progress * 100).toFixed(0)}%"></div></div></td>
    </tr>`).join('')}</tbody></table></div></div>`);
  table.querySelectorAll('tr.clickable').forEach(tr => tr.onclick = () => openMuscleModal(tr.dataset.m));
  main.appendChild(table);

  // cardio tile
  const cardioXp = xp['cardio'];
  if (cardioXp > 0) {
    main.appendChild(h(`<div class="card"><div class="card-title">Cardio</div>
      <p>❤️ ${muscleLevelFor(cardioXp).name} — ${Math.round(cardioXp)} XP · ${Math.round(heat['cardio'])} session-equivalents in the last 30 days.</p></div>`));
  }
}

function openMuscleModal(mkey) {
  const mus = MUSCLES[mkey];
  const { xp, heat, last } = Store.muscleStats();
  const lvl = muscleLevelFor(xp[mkey]);
  const best = Store.bestPerformances();

  // exercises you've done for this muscle + suggestions
  const forMuscle = EXERCISES.filter(ex => ex.p.includes(mkey));
  const done = forMuscle.filter(ex => best[ex.id]);
  const suggestions = forMuscle.filter(ex => !best[ex.id]).slice(0, 5);

  const m = h(`<div>
    <div class="modal-head"><div><h2>${mus.name}</h2>
      <div style="margin-top:6px"><span class="rank-badge lg"><span class="rank-dot" style="background:${lvl.color}"></span>${lvl.name}</span></div></div>
      <button class="modal-close">×</button></div>
    <div class="stat-row" style="margin-bottom:14px">
      <div class="stat-tile"><div class="stat-value">${Math.round(xp[mkey])}</div><div class="stat-label">Total XP</div></div>
      <div class="stat-tile"><div class="stat-value">${Math.round(heat[mkey])}</div><div class="stat-label">Sets last 30 days</div></div>
      <div class="stat-tile"><div class="stat-value" style="font-size:1.05rem">${last[mkey] ? fmtDate(last[mkey]) : 'Never'}</div><div class="stat-label">Last trained</div></div>
    </div>
    ${lvl.next ? `<div class="progressbar" style="margin-bottom:4px"><div style="width:${(lvl.progress * 100).toFixed(0)}%"></div></div>
      <p class="hint" style="margin-bottom:14px">${Math.round(lvl.next.xp - xp[mkey])} XP to ${lvl.next.name} (10 XP per primary set, 5 per secondary)</p>` : ''}
    <div class="body"></div></div>`);
  m.querySelector('.modal-close').onclick = closeModal;
  const body = m.querySelector('.body');

  if (done.length) {
    body.appendChild(h(`<div style="margin-bottom:12px"><div class="card-title">Your ${mus.name.toLowerCase()} exercises</div>
      ${done.slice(0, 8).map(ex => `<div class="list-item"><span class="ex-name">${esc(ex.name)}</span>
        <span class="muted">${fmtPerf(ex, best[ex.id])}</span></div>`).join('')}</div>`));
  }
  if (suggestions.length) {
    const sug = h(`<div><div class="card-title">Try next</div></div>`);
    for (const ex of suggestions) {
      const row = h(`<div class="list-item" style="cursor:pointer"><div><span class="ex-name">${esc(ex.name)}</span><br>
        <span class="ex-tags">${equipLabel(ex.equip)}</span></div><span class="muted">＋</span></div>`);
      row.onclick = () => { closeModal(); openExerciseModal(ex.id); };
      sug.appendChild(row);
    }
    body.appendChild(sug);
  }
  openModal(m);
}

/* ============================================================
   RANKS
   ============================================================ */
function renderRanks(main) {
  const scores = Store.exerciseScores();
  const ov = overallRank(scores);
  const best = Store.bestPerformances();
  const bw = Store.profile().bodyweight, sex = Store.profile().sex;

  // overall card
  main.appendChild(h(`<div class="card" style="text-align:center;padding:28px">
    <div class="card-title">Overall strength rank</div>
    <div style="font-size:2.2rem;font-weight:800;color:${ov.rank.color};margin:4px 0">${ov.rank.name}</div>
    ${ov.patterns >= 2
      ? `<div class="progressbar" style="max-width:420px;margin:12px auto"><div style="width:${Math.min(100, ov.score * 100).toFixed(0)}%"></div></div>
         <p class="hint">Score ${(ov.score * 100).toFixed(0)} / 100 — average of your best lift in each of ${ov.patterns} movement patterns.
         Tiers: 20 Beginner · 40 Novice · 60 Intermediate · 80 Advanced · 100 Elite.</p>`
      : '<p class="hint">Log at least two movement patterns (e.g. a squat and a press) to receive an overall rank.</p>'}
  </div>`));

  // pattern breakdown
  const patNames = { squat: '🦵 Squat', hinge: '🍑 Hinge / Deadlift', 'h-push': '💥 Horizontal push', 'v-push': '🙌 Vertical push', pull: '🪝 Pull', arms: '💪 Arms', core: '🧱 Core' };
  const patCard = h(`<div class="card"><div class="card-title">Movement patterns</div><div class="table-scroll"><table>
    <thead><tr><th>Pattern</th><th>Best exercise</th><th class="num">Performance</th><th>Rank</th><th style="width:22%">To next rank</th></tr></thead>
    <tbody></tbody></table></div></div>`);
  const tb = patCard.querySelector('tbody');
  for (const [pat, ids] of Object.entries(PATTERNS)) {
    let bestEx = null, bestScore = -1;
    for (const id of ids) if (scores[id] != null && scores[id] > bestScore) { bestScore = scores[id]; bestEx = EXERCISES_BY_ID[id]; }
    if (bestEx) {
      const ev = evaluateExercise(bestEx, best[bestEx.id], bw, sex);
      tb.appendChild(h(`<tr class="clickable" data-ex="${bestEx.id}">
        <td>${patNames[pat]}</td><td class="ex-name">${esc(bestEx.name)}</td>
        <td class="num">${fmtPerf(bestEx, best[bestEx.id])}</td><td>${rankBadge(ev.rankIdx)}</td>
        <td>${ev.rankIdx < 5 ? `<div class="progressbar"><div style="width:${Math.min(100, (ev.score % 0.2) / 0.2 * 100).toFixed(0)}%"></div></div>` : '⭐ Elite'}</td></tr>`));
    } else {
      tb.appendChild(h(`<tr><td>${patNames[pat]}</td><td colspan="4" class="hint">Not trained yet</td></tr>`));
    }
  }
  tb.querySelectorAll('tr.clickable').forEach(tr => tr.onclick = () => openExerciseModal(tr.dataset.ex));
  main.appendChild(patCard);

  // simulator
  const rankedExs = EXERCISES.filter(e => e.std);
  const sim = h(`<div class="card"><div class="card-title">Rank simulator</div>
    <p class="hint" style="margin-bottom:12px">Plan your progress: enter a hypothetical set and see the rank it would earn you.</p>
    <div class="form-row" style="flex-wrap:wrap">
      <label style="flex:2;min-width:200px">Exercise
        <select id="sim-ex">${rankedExs.map(e => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></label>
      <label id="sim-wl" style="min-width:110px">Weight (${Store.profile().units})<input type="number" id="sim-w" step="any" min="0"></label>
      <label style="min-width:90px" id="sim-rl">Reps<input type="number" id="sim-r" min="1" value="5"></label>
    </div>
    <div id="sim-out" class="hint" style="min-height:44px"></div></div>`);
  main.appendChild(sim);
  const simRefresh = () => {
    const ex = EXERCISES_BY_ID[sim.querySelector('#sim-ex').value];
    sim.querySelector('#sim-wl').style.display = ex.type === 'w' ? '' : 'none';
    sim.querySelector('#sim-rl').firstChild.textContent = ex.type === 't' ? 'Seconds' : 'Reps';
    const wv = +sim.querySelector('#sim-w').value, rv = +sim.querySelector('#sim-r').value;
    let perf = 0;
    if (ex.type === 'w') perf = wv && rv ? epley1RM(Store.toKg(wv), rv) : 0;
    else perf = rv || 0;
    const out = sim.querySelector('#sim-out');
    if (!perf) { out.innerHTML = 'Enter a set above.'; return; }
    const ev = evaluateExercise(ex, perf, bw, sex);
    const cur = scores[ex.id];
    out.innerHTML = `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:4px">
      ${rankBadge(ev.rankIdx, { lg: true })}
      <span>${ex.type === 'w' ? 'Estimated 1RM: <b style="color:var(--ink)">' + Store.fmtWeight(perf) + '</b> (' + (perf / bw).toFixed(2) + '× bodyweight)' : ''}
      ${cur != null ? ' · your current score: ' + (Math.min(cur, 1.2) * 100).toFixed(0) : ''}</span></div>`;
  };
  ['#sim-ex', '#sim-w', '#sim-r'].forEach(s => { sim.querySelector(s).oninput = simRefresh; sim.querySelector(s).onchange = simRefresh; });
  simRefresh();

  // all ranked lifts
  const all = Object.entries(scores).map(([id, s]) => ({ ex: EXERCISES_BY_ID[id], s })).sort((a, b) => b.s - a.s);
  if (all.length) {
    const card = h(`<div class="card"><div class="card-title">All your ranked lifts (${all.length})</div><div class="table-scroll"><table>
      <thead><tr><th>Exercise</th><th class="num">Best</th><th>Rank</th><th class="num">Score</th></tr></thead><tbody></tbody></table></div></div>`);
    const b2 = card.querySelector('tbody');
    for (const { ex, s } of all) {
      const ev = evaluateExercise(ex, best[ex.id], bw, sex);
      b2.appendChild(h(`<tr class="clickable" data-ex="${ex.id}"><td class="ex-name">${esc(ex.name)}</td>
        <td class="num">${fmtPerf(ex, best[ex.id])}</td><td>${rankBadge(ev.rankIdx)}</td>
        <td class="num">${(Math.min(s, 1.2) * 100).toFixed(0)}</td></tr>`));
    }
    b2.querySelectorAll('tr').forEach(tr => tr.onclick = () => openExerciseModal(tr.dataset.ex));
    main.appendChild(card);
  }
}

/* ============================================================
   HISTORY
   ============================================================ */
function renderHistory(main) {
  const ws = [...Store.workouts()].reverse();
  if (!ws.length) {
    main.appendChild(h('<div class="card"><h2>History</h2><p class="hint" style="margin-top:8px">No workouts yet. Your training log will appear here.</p></div>'));
    return;
  }
  main.appendChild(h(`<div class="card" style="padding:14px 18px"><h2>History</h2><span class="hint">${ws.length} workouts logged.</span></div>`));
  for (const w of ws) {
    let vol = 0, nSets = 0;
    for (const en of w.entries) for (const s of en.sets) { nSets++; vol += (s.weight || 0) * (s.reps || 0); }
    const card = h(`<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <div><h3>${esc(w.name) || 'Workout'} <span class="muted" style="font-weight:400">· ${fmtDate(w.date)}</span></h3>
          <span class="hint">${w.entries.length} exercises · ${nSets} sets${vol ? ' · ' + Store.fmtWeight(vol, 0) + ' volume' : ''}</span></div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm w-toggle">Details</button>
          <button class="btn btn-ghost btn-sm w-edit">Edit</button>
          <button class="btn btn-danger btn-sm w-del">Delete</button></div></div>
      <div class="w-body hidden" style="margin-top:12px"></div></div>`);
    const bodyEl = card.querySelector('.w-body');
    card.querySelector('.w-toggle').onclick = () => {
      if (bodyEl.classList.contains('hidden')) {
        bodyEl.innerHTML = w.entries.map(en => {
          const ex = EXERCISES_BY_ID[en.exId];
          if (!ex) return '';
          return `<div style="margin-bottom:8px"><span class="ex-name">${esc(ex.name)}</span><br>
            <span class="ex-tags">${en.sets.map(s => setLabel(ex, s)).join('  ·  ')}</span></div>`;
        }).join('');
      }
      bodyEl.classList.toggle('hidden');
    };
    card.querySelector('.w-edit').onclick = () => {
      draft = {
        date: w.date, name: w.name || '', editingId: w.id,
        entries: w.entries.map(en => ({
          exId: en.exId,
          sets: en.sets.map(s => displaySet(EXERCISES_BY_ID[en.exId], s))
        }))
      };
      saveDraft();
      showView('workout');
    };
    card.querySelector('.w-del').onclick = () => {
      if (confirm('Delete this workout? This cannot be undone.')) {
        Store.deleteWorkout(w.id); refreshTopbar(); showView('history'); toast('Workout deleted.');
      }
    };
    main.appendChild(card);
  }
}

/* ============================================================
   SETTINGS
   ============================================================ */
function renderSettings(main) {
  const p = Store.profile();
  const card = h(`<div class="card"><h2>Profile</h2>
    <div class="form-row" style="margin-top:14px;flex-wrap:wrap">
      <label>Bodyweight (${p.units})<input type="number" id="st-bw" step="any" min="25" value="${+Store.fromKg(p.bodyweight).toFixed(1)}"></label>
      <label>Units<select id="st-units"><option value="kg" ${p.units === 'kg' ? 'selected' : ''}>kg</option><option value="lb" ${p.units === 'lb' ? 'selected' : ''}>lb</option></select></label>
      <label>Standards<select id="st-sex"><option value="m" ${p.sex === 'm' ? 'selected' : ''}>Male</option><option value="f" ${p.sex === 'f' ? 'selected' : ''}>Female</option></select></label>
    </div>
    <button class="btn btn-primary" id="st-save">Save profile</button>
    <p class="hint" style="margin-top:10px">Bodyweight and standards determine your rank thresholds. Weights are stored in kg and converted for display.</p></div>`);
  main.appendChild(card);
  card.querySelector('#st-save').onclick = () => {
    const units = card.querySelector('#st-units').value;
    let bwv = parseFloat(card.querySelector('#st-bw').value);
    if (!bwv || bwv <= 0) { toast('Enter a valid bodyweight.'); return; }
    // the input shows the CURRENT units; convert with the old setting
    const bwKg = p.units === 'lb' ? bwv * 0.45359237 : bwv;
    p.bodyweight = +bwKg.toFixed(1);
    p.units = units;
    p.sex = card.querySelector('#st-sex').value;
    Store.save(); refreshTopbar();
    toast('Profile saved.'); showView('settings');
  };

  // passcode
  const pass = h(`<div class="card"><h2>Passcode</h2>
    <div class="form-row" style="margin-top:14px">
      <label>Current<input type="password" id="pc-old"></label>
      <label>New<input type="password" id="pc-new" minlength="4"></label>
    </div><button class="btn" id="pc-save">Change passcode</button></div>`);
  main.appendChild(pass);
  pass.querySelector('#pc-save').onclick = async () => {
    try {
      const nv = pass.querySelector('#pc-new').value;
      if (nv.length < 4) throw new Error('New passcode must be at least 4 characters.');
      await Store.changePass(Store.currentUser(), pass.querySelector('#pc-old').value, nv);
      toast('Passcode changed.');
      pass.querySelector('#pc-old').value = pass.querySelector('#pc-new').value = '';
    } catch (e) { toast(e.message); }
  };

  // data
  const data = h(`<div class="card"><h2>Your data</h2>
    <p class="hint" style="margin:10px 0 14px">Everything lives in this browser's localStorage — nothing is sent anywhere.
    Export regularly to back up, or to move to another device / browser.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn" id="dt-export">⬇ Export data (JSON)</button>
      <label class="btn" style="display:inline-block;margin:0;color:var(--ink);font-size:1rem">⬆ Import data<input type="file" id="dt-import" accept=".json" style="display:none"></label>
      <button class="btn" id="dt-sample">✨ Load sample data</button>
    </div></div>`);
  main.appendChild(data);
  data.querySelector('#dt-export').onclick = () => {
    const blob = new Blob([Store.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ironrank-' + Store.currentUser() + '-' + Store.todayStr() + '.json';
    a.click(); URL.revokeObjectURL(a.href);
  };
  data.querySelector('#dt-import').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      Store.importData(await file.text());
      refreshTopbar(); toast('Data imported ✔'); showView('dashboard');
    } catch (err) { toast('Import failed: ' + err.message); }
  };
  data.querySelector('#dt-sample').onclick = () => {
    if (Store.workouts().length && !confirm('This adds ~12 weeks of sample workouts on top of your current data. Continue?')) return;
    loadSampleData(); refreshTopbar(); toast('Sample data loaded — check the body map!'); showView('dashboard');
  };

  // danger zone
  const danger = h(`<div class="card"><h2>Danger zone</h2>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
      <button class="btn btn-danger" id="dz-wipe">Delete all workouts</button>
      <button class="btn btn-danger" id="dz-del">Delete account</button>
    </div></div>`);
  main.appendChild(danger);
  danger.querySelector('#dz-wipe').onclick = () => {
    if (confirm('Delete ALL workouts? Ranks and muscle map reset. This cannot be undone.')) {
      Store.data().workouts = []; Store.save(); refreshTopbar(); toast('All workouts deleted.'); showView('dashboard');
    }
  };
  danger.querySelector('#dz-del').onclick = () => {
    if (confirm('Delete this account and all its data from this browser?')) {
      Store.deleteAccount(Store.currentUser()); location.reload();
    }
  };

  main.appendChild(h(`<p class="hint" style="text-align:center;padding:8px">IronRank · free & open · ${EXERCISES.length} exercises ·
    ranks modeled on public strength standards (Beginner→Elite) · no server, no subscription, no ads</p>`));
}

/* ---------------- sample data (12 weeks of linear progress) ---------------- */
function loadSampleData() {
  const plan = [
    // [exId, startKg, kgPerWeek, sets, reps] — day A / B / C
    { day: 0, items: [['barbell-bench-press', 50, 1.5, 3, 5], ['barbell-row', 45, 1.25, 3, 8], ['overhead-press', 30, 0.75, 3, 5], ['dumbbell-curl', 10, 0.25, 2, 10], ['cable-pushdown-rope', 20, 0.5, 2, 12]] },
    { day: 2, items: [['back-squat', 60, 2.5, 3, 5], ['romanian-deadlift', 50, 1.5, 3, 8], ['leg-press', 100, 3, 3, 10], ['standing-calf-raise-machine', 40, 1, 3, 12], ['plank', 0, 0, 3, 0]] },
    { day: 4, items: [['conventional-deadlift', 80, 2.5, 2, 5], ['pull-up', 0, 0, 3, 0], ['incline-dumbbell-press', 16, 0.5, 3, 8], ['lat-pulldown-wide', 40, 1, 3, 10], ['hanging-knee-raise', 0, 0, 3, 0]] }
  ];
  const start = Store.dateOffset(Store.todayStr(), -7 * 12);
  for (let wk = 0; wk < 12; wk++) {
    for (const d of plan) {
      const date = Store.dateOffset(start, wk * 7 + d.day);
      if (date > Store.todayStr()) continue;
      const entries = d.items.map(([id, w0, inc, sets, reps]) => {
        const ex = EXERCISES_BY_ID[id];
        const s = [];
        for (let i = 0; i < sets; i++) {
          if (ex.type === 'w') s.push({ weight: +(w0 + inc * wk).toFixed(1), reps });
          else if (ex.type === 'bw') s.push({ reps: Math.min(4 + Math.floor(wk / 2) + (id === 'plank' ? 0 : 0), 15) + (i === 0 ? 1 : 0) });
          else if (ex.type === 't') s.push({ secs: 40 + wk * 8 });
        }
        return { exId: id, sets: s };
      });
      Store.addWorkout({ date, name: ['Push & Pull', 'Legs', 'Full Body'][plan.indexOf(d)], entries });
    }
  }
}

/* ============================================================
   INIT
   ============================================================ */
(function init() {
  const user = Store.session();
  if (user && Store.userList().length) {
    try { enterApp(user); return; } catch { /* fall through to auth */ }
  }
  showAuth();
})();
