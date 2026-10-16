/* Canvas animation runtime for lesson videos. Loaded by scripts/video.cjs inside headless Chromium/Edge. */
(function () {
  const W = 1280, H = 720, TOP = 64, BOTTOM = 610;
  const C = {
    bg: '#f6f8f5', ink: '#1f3d4a', sub: '#5a737b', faint: '#9fb3b8', grid: '#dfe7e3', panel: '#ffffff',
    blue: '#366b83', sky: '#6aa5c4', green: '#4f9a7c', orange: '#c98345', red: '#c0564b', purple: '#7a62a8',
    gold: '#d6a33a', teal: '#2f8f8a', light: '#eaf2ed', lightBlue: '#e4eff7', lightOrange: '#f7eedf'
  };
  const FONT = "'Microsoft YaHei','PingFang SC','Noto Sans CJK SC','Segoe UI',sans-serif";
  const MATH = "'Cambria Math','Cambria','Times New Roman',serif";
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, s) => a + (b - a) * s;
  const ease = x => { x = clamp(x, 0, 1); return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; };
  const seg = (p, a, b) => clamp((p - a) / (b - a), 0, 1);
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; }; }
  function randn(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  function style(o = {}) {
    ctx.globalAlpha = o.alpha ?? 1;
    ctx.lineWidth = o.width ?? 2;
    ctx.strokeStyle = o.color ?? o.stroke ?? C.ink;
    ctx.fillStyle = o.fill ?? o.color ?? C.ink;
    ctx.setLineDash(o.dash ?? []);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }
  function reset() { ctx.globalAlpha = 1; ctx.setLineDash([]); }

  const g = {
    W, H, TOP, BOTTOM, C, clamp, lerp, ease, seg, rng, randn,
    text(s, x, y, o = {}) {
      style(o);
      ctx.font = `${o.weight ?? 400} ${o.size ?? 24}px ${o.math ? MATH : FONT}`;
      ctx.textAlign = o.align ?? 'left';
      ctx.textBaseline = o.baseline ?? 'alphabetic';
      ctx.fillStyle = o.color ?? C.ink;
      String(s).split('\n').forEach((line, i) => ctx.fillText(line, x, y + i * (o.lineHeight ?? (o.size ?? 24) * 1.45)));
      reset();
    },
    measure(s, size = 24, weight = 400, math = false) { ctx.font = `${weight} ${size}px ${math ? MATH : FONT}`; return ctx.measureText(s).width; },
    formula(s, x, y, o = {}) { g.text(s, x, y, { size: 30, color: C.ink, ...o, math: true }); },
    line(x1, y1, x2, y2, o = {}) { style(o); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); reset(); },
    arrow(x1, y1, x2, y2, o = {}) {
      const head = o.head ?? 12, a = Math.atan2(y2 - y1, x2 - x1);
      style(o); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2 - Math.cos(a) * head * 0.6, y2 - Math.sin(a) * head * 0.6); ctx.stroke();
      ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - head * Math.cos(a - 0.4), y2 - head * Math.sin(a - 0.4));
      ctx.lineTo(x2 - head * Math.cos(a + 0.4), y2 - head * Math.sin(a + 0.4)); ctx.closePath();
      ctx.fillStyle = o.color ?? C.ink; ctx.fill(); reset();
    },
    circle(x, y, r, o = {}) {
      style(o); ctx.beginPath(); ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
      if (o.fill !== null && o.fill !== undefined) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.stroke(); }
      if (o.fill === undefined && !o.stroke) { ctx.fillStyle = o.color ?? C.ink; ctx.fill(); }
      reset();
    },
    rect(x, y, w, h, o = {}) {
      style(o); ctx.beginPath();
      const r = Math.min(o.r ?? 0, Math.abs(w) / 2, Math.abs(h) / 2);
      ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.stroke(); }
      reset();
    },
    box(x, y, w, h, label, o = {}) {
      g.rect(x, y, w, h, { fill: o.fill ?? C.panel, stroke: o.stroke ?? C.faint, r: o.r ?? 10, width: o.width ?? 2, alpha: o.alpha });
      const lines = String(label).split('\n'), size = o.size ?? 20, lh = size * 1.35;
      lines.forEach((ln, i) => g.text(ln, x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * lh, { size, align: 'center', baseline: 'middle', color: o.color ?? C.ink, weight: o.weight ?? 500, alpha: o.alpha }));
    },
    poly(pts, o = {}) {
      if (!pts.length) return; style(o); ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts.slice(1)) ctx.lineTo(p[0], p[1]);
      if (o.close) ctx.closePath();
      if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
      if (o.stroke !== false) { ctx.strokeStyle = o.color ?? o.stroke ?? C.ink; ctx.stroke(); }
      reset();
    },
    /* Data-space plotting box: {x,y,w,h,xmin,xmax,ymin,ymax}. */
    plotBox(b) {
      return {
        ...b,
        X: v => b.x + (v - b.xmin) / (b.xmax - b.xmin) * b.w,
        Y: v => b.y + b.h - (v - b.ymin) / (b.ymax - b.ymin) * b.h
      };
    },
    axes(b, o = {}) {
      g.arrow(b.x, b.y + b.h, b.x + b.w + 16, b.y + b.h, { color: C.sub, width: 2, head: 10 });
      if (o.yaxis !== false) g.arrow(b.x, b.y + b.h, b.x, b.y - 14, { color: C.sub, width: 2, head: 10 });
      if (o.xlabel) g.text(o.xlabel, b.x + b.w + 20, b.y + b.h + 6, { size: 18, color: C.sub, baseline: 'middle' });
      if (o.ylabel) g.text(o.ylabel, b.x + 8, b.y - 18, { size: 18, color: C.sub });
    },
    curve(b, fn, o = {}) {
      const pts = [], n = o.n ?? 160, x0 = o.from ?? b.xmin, x1 = o.to ?? b.xmax;
      for (let i = 0; i <= n; i++) { const v = x0 + (x1 - x0) * i / n; pts.push([b.X(v), b.Y(fn(v))]); }
      if (o.fill) g.poly([[b.X(x0), b.Y(b.ymin)], ...pts, [b.X(x1), b.Y(b.ymin)]], { fill: o.fill, stroke: false, alpha: o.fillAlpha ?? 0.25, close: true });
      g.poly(pts, { color: o.color ?? C.blue, width: o.width ?? 3, dash: o.dash, alpha: o.alpha });
    },
    gauss: (x, mu, s) => Math.exp(-0.5 * ((x - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI)),
    bullets(items, x, y, p, o = {}) {
      const start = o.start ?? 0.05, step = o.step ?? (0.8 / Math.max(1, items.length)), gap = o.gap ?? 54, size = o.size ?? 26;
      items.forEach((it, i) => {
        const a = ease(seg(p, start + i * step, start + i * step + 0.06));
        if (a <= 0) return;
        g.circle(x + 8, y + i * gap - size * 0.32, 6, { fill: o.color ?? C.green, alpha: a });
        g.text(it, x + 28 + (1 - a) * 20, y + i * gap, { size, alpha: a, color: C.ink });
      });
    },
    panel(x, y, w, h, o = {}) { g.rect(x, y, w, h, { fill: o.fill ?? C.panel, stroke: o.stroke ?? C.grid, r: 14, width: 2, alpha: o.alpha }); },
    tag(s, x, y, o = {}) {
      const size = o.size ?? 18, w = g.measure(s, size, 600) + 22;
      g.rect(x, y - size - 4, w, size + 14, { fill: o.fill ?? C.blue, r: 8, alpha: o.alpha });
      g.text(s, x + 11, y + 1, { size, weight: 600, color: '#fff', alpha: o.alpha });
      return w;
    },
    /* Top-down mobile robot. theta is heading in radians (screen coords, y down). */
    robot(x, y, theta, o = {}) {
      const r = o.r ?? 22, color = o.color ?? C.blue;
      g.circle(x, y, r, { fill: color, alpha: o.alpha });
      g.poly([[x + Math.cos(theta) * (r + 14), y + Math.sin(theta) * (r + 14)], [x + Math.cos(theta + 2.5) * r * 0.6, y + Math.sin(theta + 2.5) * r * 0.6], [x + Math.cos(theta - 2.5) * r * 0.6, y + Math.sin(theta - 2.5) * r * 0.6]], { fill: '#fff', stroke: false, close: true, alpha: o.alpha });
    },
    /* Planar two-link arm; base at (bx,by), q measured counter-clockwise (screen y flipped). */
    arm(bx, by, l1, l2, q1, q2, o = {}) {
      const x1 = bx + l1 * Math.cos(q1), y1 = by - l1 * Math.sin(q1);
      const x2 = x1 + l2 * Math.cos(q1 + q2), y2 = y1 - l2 * Math.sin(q1 + q2);
      g.rect(bx - 34, by, 68, 18, { fill: C.sub, r: 4, alpha: o.alpha });
      g.line(bx, by, x1, y1, { color: o.c1 ?? C.blue, width: o.w ?? 16, alpha: o.alpha });
      g.line(x1, y1, x2, y2, { color: o.c2 ?? C.sky, width: (o.w ?? 16) * 0.8, alpha: o.alpha });
      g.circle(bx, by, 11, { fill: C.ink, alpha: o.alpha }); g.circle(x1, y1, 9, { fill: C.ink, alpha: o.alpha });
      g.circle(x2, y2, 8, { fill: o.tip ?? C.orange, alpha: o.alpha });
      return { x1, y1, x2, y2 };
    }
  };

  function wrap(text, maxW, size) {
    ctx.font = `500 ${size}px ${FONT}`;
    const lines = []; let cur = '';
    for (const ch of text) {
      if (ctx.measureText(cur + ch).width > maxW && cur) { lines.push(cur); cur = ch; } else cur += ch;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function chrome(lesson, si, scene, time, total) {
    g.rect(0, 0, W, 52, { fill: '#17323d' });
    g.text(lesson.title, 28, 34, { size: 20, weight: 600, color: '#e8f1ef' });
    if (scene.title) g.text(`${si} / ${lesson.scenes.length - 1}  ${scene.title}`, W - 28, 34, { size: 18, color: '#a9c4c6', align: 'right' });
    g.rect(0, H - 5, W, 5, { fill: '#d5dfdc' });
    g.rect(0, H - 5, W * clamp(time / total, 0, 1), 5, { fill: C.green });
  }

  function subtitle(text) {
    if (!text) return;
    const size = 28, lines = wrap(text, 1080, size).slice(0, 2), lh = 40;
    const w = Math.max(...lines.map(l => g.measure(l, size, 500))) + 48, h = lines.length * lh + 20;
    const y = H - 22 - h;
    g.rect((W - w) / 2, y, w, h, { fill: 'rgba(16,36,44,0.82)', r: 10 });
    lines.forEach((l, i) => g.text(l, W / 2, y + 10 + lh * (i + 0.5), { size, weight: 500, color: '#ffffff', align: 'center', baseline: 'middle' }));
  }

  function titleCard(lesson, p) {
    const a = ease(seg(p, 0, 0.25));
    g.rect(0, 0, W, H, { fill: '#17323d' });
    for (let i = 0; i < 14; i++) g.line(0, 120 + i * 40, W, 80 + i * 40, { color: '#21434f', width: 1 });
    g.text('EMBODIED AI KNOWLEDGE BASE · 视频讲解', 110, 210, { size: 20, color: '#8fb5b3', weight: 600, alpha: a });
    g.text(lesson.title, 110 + (1 - a) * 30, 300, { size: 54, weight: 700, color: '#ffffff', alpha: a });
    if (lesson.subtitle) g.text(lesson.subtitle, 110, 360, { size: 26, color: '#bcd3d2', alpha: ease(seg(p, 0.15, 0.4)) });
    if (lesson.module) g.text(`对应讲义：${lesson.module}`, 110, 430, { size: 22, color: '#e0b46a', alpha: ease(seg(p, 0.25, 0.5)) });
    g.rect(110, 460, 260 * ease(seg(p, 0.3, 0.7)), 4, { fill: C.green });
  }

  let LESSON = null, TL = null;
  window.registerLesson = l => { LESSON = l; };
  window.lessonInfo = () => ({ id: LESSON.id, title: LESSON.title, subtitle: LESSON.subtitle, module: LESSON.module, link: LESSON.link, scenes: LESSON.scenes.map(s => ({ title: s.title || '', say: s.say, min: s.min || 0 })) });
  window.setTimeline = tl => { TL = tl; };
  window.renderAt = time => {
    let si = TL.scenes.findIndex(s => time < s.start + s.dur);
    if (si < 0) si = TL.scenes.length - 1;
    const sc = LESSON.scenes[si], st = TL.scenes[si], t = clamp(time - st.start, 0, st.dur);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    g.rect(0, 0, W, H, { fill: C.bg });
    const p = t / st.dur;
    if (sc.kind === 'title') titleCard(LESSON, p);
    else {
      ctx.save();
      try { sc.draw(g, p, t, st.dur); } finally { ctx.restore(); reset(); }
      chrome(LESSON, si, sc, time, TL.total);
    }
    const cue = TL.cues.find(c => time >= c.start && time < c.end);
    subtitle(cue && cue.text);
  };
  window.renderBatch = (t0, n, fps, q) => {
    const out = [];
    for (let i = 0; i < n; i++) { window.renderAt(t0 + i / fps); out.push(canvas.toDataURL('image/jpeg', q).slice(23)); }
    return out;
  };
})();
