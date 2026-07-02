/* ============================================================
   IronRank body silhouette — stylized front/back muscle map.
   Each muscle group is an SVG shape that gets filled with the
   color of its training level / heat. Groups are hoverable and
   clickable. Right-side shapes are defined once and mirrored
   around x = 110 (viewBox 220 x 470).
   ============================================================ */

const Silhouette = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const BASE = '#232322';       // body backdrop
  const OUTLINE = 'rgba(255,255,255,0.10)';

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  /* base body: head + capsule limbs + torso, same for both views */
  function baseBody(svg) {
    const g = el('g', { fill: BASE, stroke: 'none' });
    const cap = (x1, y1, x2, y2, w) =>
      g.appendChild(el('line', { x1, y1, x2, y2, stroke: BASE, 'stroke-width': w, 'stroke-linecap': 'round' }));
    g.appendChild(el('circle', { cx: 110, cy: 28, r: 18 }));
    cap(110, 44, 110, 60, 18);                     // neck
    g.appendChild(el('path', { d: 'M79,64 L141,64 L131,150 L134,200 L86,200 L89,150 Z' })); // torso
    // arms
    cap(127, 74, 142, 130, 17); cap(93, 74, 78, 130, 17);
    cap(142, 130, 150, 186, 13); cap(78, 130, 70, 186, 13);
    g.appendChild(el('circle', { cx: 152, cy: 196, r: 6.5 }));
    g.appendChild(el('circle', { cx: 68, cy: 196, r: 6.5 }));
    // legs
    cap(122, 205, 127, 292, 23); cap(98, 205, 93, 292, 23);
    cap(127, 300, 130, 382, 15); cap(93, 300, 90, 382, 15);
    g.appendChild(el('ellipse', { cx: 131, cy: 392, rx: 9, ry: 5 }));
    g.appendChild(el('ellipse', { cx: 89, cy: 392, rx: 9, ry: 5 }));
    svg.appendChild(g);
  }

  /* shape spec: {m: muscleKey, kind: 'path'|'ellipse', mirror: bool, ...attrs}
     mirror:true => rendered twice (as-is + mirrored around x=110) */
  const FRONT = [
    { m: 'neck',      kind: 'path', mirror: false, d: 'M101,47 L119,47 L120,60 L100,60 Z' },
    { m: 'traps',     kind: 'path', mirror: true,  d: 'M120,56 L143,66 L120,67 Z' },
    { m: 'shoulders', kind: 'ellipse', mirror: true, cx: 137, cy: 76, rx: 13, ry: 11.5 },
    { m: 'chest',     kind: 'path', mirror: true,  d: 'M111,64 L134,68 C142,72 144,82 140,90 C133,99 117,100 111,96 Z' },
    { m: 'biceps',    kind: 'ellipse', mirror: true, cx: 135.5, cy: 103, rx: 8.5, ry: 20, rot: 14.5 },
    { m: 'forearms',  kind: 'ellipse', mirror: true, cx: 146, cy: 158, rx: 6.5, ry: 25, rot: 8.3 },
    { m: 'abs',       kind: 'path', mirror: false, d: 'M98,101 L122,101 L120,162 L100,162 Z' },
    { m: 'obliques',  kind: 'path', mirror: true,  d: 'M124,101 L134,100 L128,160 L122,160 Z' },
    { m: 'adductors', kind: 'path', mirror: true,  d: 'M111,203 L121,207 L117,248 L111,240 Z' },
    { m: 'quads',     kind: 'ellipse', mirror: true, cx: 125, cy: 247, rx: 12, ry: 44, rot: 2.5 },
    { m: 'calves',    kind: 'ellipse', mirror: true, cx: 128.5, cy: 338, rx: 7, ry: 31, rot: 2 }
  ];

  const BACK = [
    { m: 'upper-back',kind: 'path', mirror: true,  d: 'M111,80 L137,76 L134,112 L111,116 Z' },
    { m: 'traps',     kind: 'path', mirror: false, d: 'M110,46 L140,66 L110,102 L80,66 Z' },
    { m: 'shoulders', kind: 'ellipse', mirror: true, cx: 137, cy: 76, rx: 13, ry: 11.5 },
    { m: 'lats',      kind: 'path', mirror: true,  d: 'M112,94 L136,90 C139,104 134,124 126,140 C119,150 113,152 112,150 Z' },
    { m: 'lower-back',kind: 'path', mirror: false, d: 'M102,150 L118,150 L116,190 L104,190 Z' },
    { m: 'triceps',   kind: 'ellipse', mirror: true, cx: 135.5, cy: 103, rx: 8.5, ry: 20, rot: 14.5 },
    { m: 'forearms',  kind: 'ellipse', mirror: true, cx: 146, cy: 158, rx: 6.5, ry: 25, rot: 8.3 },
    { m: 'glutes',    kind: 'ellipse', mirror: true, cx: 122, cy: 213, rx: 14, ry: 16 },
    { m: 'hamstrings',kind: 'ellipse', mirror: true, cx: 125, cy: 266, rx: 11.5, ry: 36, rot: 2.5 },
    { m: 'calves',    kind: 'ellipse', mirror: true, cx: 128.5, cy: 338, rx: 8, ry: 30, rot: 2 }
  ];

  function makeShape(spec) {
    if (spec.kind === 'path') return el('path', { d: spec.d });
    const attrs = { cx: spec.cx, cy: spec.cy, rx: spec.rx, ry: spec.ry };
    if (spec.rot) attrs.transform = `rotate(${spec.rot} ${spec.cx} ${spec.cy})`;
    return el('ellipse', attrs);
  }

  /* abs definition lines drawn on top (decorative) */
  function absLines(svg) {
    const g = el('g', { stroke: BASE, 'stroke-width': 1.5, fill: 'none', 'pointer-events': 'none' });
    g.appendChild(el('line', { x1: 110, y1: 101, x2: 110, y2: 162 }));
    [116, 131, 146].forEach(y => g.appendChild(el('line', { x1: 99, y1: y, x2: 121, y2: y })));
    svg.appendChild(g);
  }

  /**
   * Render one figure.
   * @param container  DOM node to append the <svg> to
   * @param view       'front' | 'back'
   * @param colors     {muscleKey: fillColor}
   * @param onClick    (muscleKey) => void
   * @param titles     {muscleKey: tooltip string}
   */
  function render(container, view, colors, onClick, titles = {}) {
    const svg = el('svg', { viewBox: '0 0 220 470', class: 'silhouette', role: 'img',
      'aria-label': view === 'front' ? 'Front muscle map' : 'Back muscle map' });
    baseBody(svg);
    const specs = view === 'front' ? FRONT : BACK;
    for (const spec of specs) {
      const g = el('g', { class: 'muscle', 'data-muscle': spec.m });
      g.style.fill = colors[spec.m] || '#2c2c2a';
      g.appendChild(makeShape(spec));
      if (spec.mirror) {
        const mirrored = makeShape(spec);
        const t = mirrored.getAttribute('transform');
        mirrored.setAttribute('transform', `translate(220,0) scale(-1,1)` + (t ? ' ' + t : ''));
        g.appendChild(mirrored);
      }
      const title = el('title', {});
      title.textContent = titles[spec.m] || MUSCLES[spec.m].name;
      g.appendChild(title);
      if (onClick) {
        g.style.cursor = 'pointer';
        g.addEventListener('click', () => onClick(spec.m));
      }
      svg.appendChild(g);
    }
    if (view === 'front') absLines(svg);
    // label under the figure
    const label = el('text', { x: 110, y: 448, 'text-anchor': 'middle', class: 'silhouette-label' });
    label.textContent = view === 'front' ? 'FRONT' : 'BACK';
    svg.appendChild(label);
    container.appendChild(svg);
    return svg;
  }

  /* muscles visible per view (for tooltips / view routing) */
  const VIEW_MUSCLES = {
    front: FRONT.map(s => s.m),
    back: BACK.map(s => s.m)
  };

  return { render, VIEW_MUSCLES };
})();
