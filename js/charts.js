/* ============================================================
   Minimal canvas charts for IronRank (dark surface).
   Line chart (progression over time) and bar chart (weekly
   totals), both with a hover layer + tooltip.
   Colors follow the validated dark-mode palette:
   series blue #3987e5, grid #2c2c2a, axis #383835,
   muted ink #898781, secondary ink #c3c2b7.
   ============================================================ */

const Charts = (() => {
  const C = {
    series: '#3987e5',
    seriesSoft: 'rgba(57,135,229,0.14)',
    grid: '#2c2c2a',
    axis: '#383835',
    muted: '#898781',
    ink: '#c3c2b7',
    surface: '#1a1a19',
    tipBg: '#242423',
    tipBorder: 'rgba(255,255,255,0.10)'
  };
  const FONT = '11px system-ui, -apple-system, "Segoe UI", sans-serif';

  function setupCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w: rect.width, h: rect.height };
  }

  function niceTicks(min, max, count = 4) {
    if (min === max) { max = min + 1; }
    const span = max - min;
    const step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => span / s <= count) || 10 * mag;
    const lo = Math.floor(min / step) * step;
    const ticks = [];
    for (let v = lo; v <= max + step * 0.001; v += step) if (v >= min - step * 0.001) ticks.push(+v.toFixed(6));
    return ticks;
  }

  /* ---------- line chart ----------
     points: [{x: Date-ms, y: number, label: tooltip line 2}]
     opts: {yFmt, xFmt} */
  function line(canvas, points, opts = {}) {
    const { ctx, w, h } = setupCanvas(canvas);
    const pad = { l: 44, r: 12, t: 10, b: 22 };
    ctx.clearRect(0, 0, w, h);
    if (!points.length) return drawEmpty(ctx, w, h);

    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    let xMin = Math.min(...xs), xMax = Math.max(...xs);
    if (xMin === xMax) { xMin -= 43200000; xMax += 43200000; }
    const yMinRaw = Math.min(...ys), yMaxRaw = Math.max(...ys);
    const yPad = (yMaxRaw - yMinRaw) * 0.15 || yMaxRaw * 0.15 || 1;
    const yMin = Math.max(0, yMinRaw - yPad), yMax = yMaxRaw + yPad;
    const X = x => pad.l + (x - xMin) / (xMax - xMin) * (w - pad.l - pad.r);
    const Y = y => h - pad.b - (y - yMin) / (yMax - yMin) * (h - pad.t - pad.b);
    const yFmt = opts.yFmt || (v => String(Math.round(v)));
    const xFmt = opts.xFmt || (ms => { const d = new Date(ms); return (d.getMonth() + 1) + '/' + d.getDate(); });

    // grid + y labels
    ctx.font = FONT;
    for (const t of niceTicks(yMin, yMax)) {
      const y = Y(t);
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(yFmt(t), pad.l - 6, y);
    }
    // x labels (first, middle, last)
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = C.muted;
    const xTicks = [xMin, (xMin + xMax) / 2, xMax];
    for (const t of xTicks) ctx.fillText(xFmt(t), X(t), h - pad.b + 6);
    // baseline
    ctx.strokeStyle = C.axis;
    ctx.beginPath(); ctx.moveTo(pad.l, h - pad.b); ctx.lineTo(w - pad.r, h - pad.b); ctx.stroke();

    // area fill
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)));
    ctx.lineTo(X(points[points.length - 1].x), h - pad.b);
    ctx.lineTo(X(points[0].x), h - pad.b);
    ctx.closePath();
    ctx.fillStyle = C.seriesSoft; ctx.fill();

    // line
    ctx.beginPath();
    points.forEach((p, i) => i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y)));
    ctx.strokeStyle = C.series; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

    // markers on sparse data
    if (points.length <= 40) {
      for (const p of points) {
        ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), points.length <= 15 ? 4 : 3, 0, 7);
        ctx.fillStyle = C.series; ctx.fill();
        ctx.strokeStyle = C.surface; ctx.lineWidth = 2; ctx.stroke();
      }
    }

    attachHover(canvas, evt => {
      const mx = evt.offsetX;
      let best = null, bestD = Infinity;
      for (const p of points) {
        const d = Math.abs(X(p.x) - mx);
        if (d < bestD) { bestD = d; best = p; }
      }
      if (!best || bestD > 40) return null;
      return {
        x: X(best.x), y: Y(best.y),
        lines: [xFmt(best.x) + '  ·  ' + yFmt(best.y), best.label || ''],
        crosshair: { x: X(best.x), top: pad.t, bottom: h - pad.b }
      };
    });
  }

  /* ---------- bar chart ----------
     bars: [{label, value, sub}] */
  function bars(canvas, bars_, opts = {}) {
    const { ctx, w, h } = setupCanvas(canvas);
    const pad = { l: 40, r: 8, t: 10, b: 22 };
    ctx.clearRect(0, 0, w, h);
    if (!bars_.length || bars_.every(b => !b.value)) return drawEmpty(ctx, w, h);

    const max = Math.max(...bars_.map(b => b.value)) * 1.12 || 1;
    const yFmt = opts.yFmt || (v => String(Math.round(v)));
    const iw = (w - pad.l - pad.r) / bars_.length;
    const bw = Math.max(4, Math.min(28, iw - 2)); // 2px surface gap between bars
    const Y = v => h - pad.b - v / max * (h - pad.t - pad.b);

    ctx.font = FONT;
    for (const t of niceTicks(0, max, 3)) {
      const y = Y(t);
      ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(w - pad.r, y); ctx.stroke();
      ctx.fillStyle = C.muted; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(yFmt(t), pad.l - 6, y);
    }
    ctx.strokeStyle = C.axis;
    ctx.beginPath(); ctx.moveTo(pad.l, h - pad.b); ctx.lineTo(w - pad.r, h - pad.b); ctx.stroke();

    const rects = [];
    bars_.forEach((b, i) => {
      const x = pad.l + i * iw + (iw - bw) / 2;
      const y = Y(b.value);
      const bh = h - pad.b - y;
      ctx.fillStyle = C.series;
      // rounded top (4px), flat baseline
      if (bh > 0) {
        const r = Math.min(4, bw / 2, bh);
        ctx.beginPath();
        ctx.moveTo(x, h - pad.b);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.lineTo(x + bw - r, y);
        ctx.arcTo(x + bw, y, x + bw, y + r, r);
        ctx.lineTo(x + bw, h - pad.b);
        ctx.closePath();
        ctx.fill();
      }
      rects.push({ x, y, bw, b });
      // x labels: at most ~6
      if (bars_.length <= 6 || i % Math.ceil(bars_.length / 6) === 0) {
        ctx.fillStyle = C.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillText(b.label, x + bw / 2, h - pad.b + 6);
      }
    });

    attachHover(canvas, evt => {
      const mx = evt.offsetX;
      const r = rects.find(r => mx >= r.x - 2 && mx <= r.x + r.bw + 2);
      if (!r) return null;
      return {
        x: r.x + r.bw / 2, y: r.y,
        lines: ['Week of ' + r.b.label + '  ·  ' + yFmt(r.b.value), r.b.sub || '']
      };
    });
  }

  function drawEmpty(ctx, w, h) {
    ctx.font = FONT;
    ctx.fillStyle = C.muted;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('No data yet — log a workout to see progress', w / 2, h / 2);
  }

  /* ---------- shared hover/tooltip layer ---------- */
  function attachHover(canvas, hitFn) {
    let tip = canvas.parentElement.querySelector('.chart-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tip hidden';
      canvas.parentElement.style.position = 'relative';
      canvas.parentElement.appendChild(tip);
    }
    canvas.onmousemove = evt => {
      const hit = hitFn(evt);
      if (!hit) { tip.classList.add('hidden'); redrawCross(canvas, null); return; }
      tip.innerHTML = hit.lines.filter(Boolean).map((l, i) =>
        `<div class="${i ? 'tip-sub' : 'tip-main'}">${l}</div>`).join('');
      tip.classList.remove('hidden');
      const cw = canvas.getBoundingClientRect().width;
      const left = Math.min(Math.max(hit.x + 10, 4), cw - tip.offsetWidth - 4);
      tip.style.left = left + 'px';
      tip.style.top = Math.max(2, hit.y - tip.offsetHeight - 10) + 'px';
    };
    canvas.onmouseleave = () => tip.classList.add('hidden');
  }
  function redrawCross() { /* crosshair kept simple: marker + tooltip only */ }

  return { line, bars };
})();
