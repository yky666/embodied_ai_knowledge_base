(() => {
  const deg = r => r * 180 / Math.PI;
  /* Unit step response of m e'' + d e' + k e = k (normalized), analytic for zeta < 1, = 1, > 1. */
  function step(t, zeta, wn = 6) {
    if (zeta < 1) { const wd = wn * Math.sqrt(1 - zeta * zeta); return 1 - Math.exp(-zeta * wn * t) * (Math.cos(wd * t) + zeta / Math.sqrt(1 - zeta * zeta) * Math.sin(wd * t)); }
    if (zeta === 1) return 1 - Math.exp(-wn * t) * (1 + wn * t);
    const s = Math.sqrt(zeta * zeta - 1), r1 = -wn * (zeta - s), r2 = -wn * (zeta + s);
    return 1 + (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r1 - r2);
  }
  function cone(g, x, y, nx, ny, mu, len = 150, alpha = 1) {
    const a = Math.atan2(ny, nx), h = Math.atan(mu);
    g.poly([[x, y], [x + len * Math.cos(a - h), y + len * Math.sin(a - h)], [x + len * Math.cos(a + h), y + len * Math.sin(a + h)]], { fill: 'rgba(79,154,124,0.18)', stroke: false, close: true, alpha });
    g.line(x, y, x + len * Math.cos(a - h), y + len * Math.sin(a - h), { color: g.C.green, width: 2, alpha });
    g.line(x, y, x + len * Math.cos(a + h), y + len * Math.sin(a + h), { color: g.C.green, width: 2, alpha });
  }

  registerLesson({
    id: 'v11_grasp_friction',
    title: '抓取力学：摩擦锥、对拓抓取与柔顺控制',
    subtitle: '为什么夹爪能夹住物体，要用多大力，以及接触时为何要“软”一点',
    module: '12 · 抓取与灵巧操作',
    link: '12_抓取与灵巧操作.md',
    scenes: [
      { kind: 'title', say: '机器人抓取看起来简单，背后却是接触力学的问题。这一讲解释摩擦锥、平行夹爪的对拓条件、夹持力的大小，以及接触时的阻抗控制。' },
      {
        title: '摩擦锥：接触力能指向哪里',
        say: '手指压在物体表面，接触力可以分解为法向力和切向摩擦力。库仑摩擦要求切向力不超过摩擦系数乘法向力。几何上，合力必须落在以法向为轴、半角为反正切 mu 的圆锥里，这就是摩擦锥。力的方向一旦超出锥面，手指就会打滑。',
        draw(g, p) {
          const x = 420, y = 430, mu = 0.5;
          g.rect(160, y, 560, 120, { fill: '#e6ded3', stroke: g.C.sub });
          g.text('物体表面', 180, y + 60, { size: 20, color: g.C.sub });
          cone(g, x, y, 0, -1, mu, 260, g.ease(g.seg(p, 0.15, 0.3)));
          g.arrow(x, y, x, y - 280, { color: g.C.ink, width: 2, dash: [6, 5] }); g.text('法向 n', x + 8, y - 285, { size: 20 });
          const ang = Math.sin(p * Math.PI * 2.2) * 0.75, inside = Math.abs(ang) <= Math.atan(mu);
          g.arrow(x, y, x + 220 * Math.sin(ang), y - 220 * Math.cos(ang), { color: inside ? g.C.blue : g.C.red, width: 5 });
          g.circle(x, y, 8, { fill: g.C.ink });
          g.panel(820, 140, 420, 260);
          g.formula('‖f_t‖ ≤ μ f_n', 840, 200, { size: 30 });
          g.formula('半角 = arctan μ', 840, 255, { size: 30 });
          g.text(`μ = 0.5 → ${deg(Math.atan(mu)).toFixed(1)}°`, 840, 305, { size: 22, color: g.C.sub });
          g.text(`当前力偏角 ${deg(Math.abs(ang)).toFixed(0)}°：${inside ? '不打滑' : '打滑！'}`, 840, 360, { size: 24, weight: 700, color: inside ? g.C.blue : g.C.red });
        }
      },
      {
        title: '对拓抓取：两指如何夹住',
        say: '平行夹爪的两根手指只能沿着连线互相挤压。要夹住物体，两个接触力必须大小相等、方向相反、共线。所以条件是：两接触点的连线方向，要同时落在两侧的摩擦锥里，也就是和两侧法向的夹角都不超过摩擦角。这叫对拓抓取。抓取检测算法常用这个条件来采样候选。',
        draw(g, p) {
          const cx = 460, cy = 330, A = 190, B = 120, mu = 0.4;
          const pts = []; for (let i = 0; i <= 80; i++) { const t = i / 80 * Math.PI * 2; pts.push([cx + A * Math.cos(t), cy + B * Math.sin(t)]); }
          g.poly(pts, { fill: '#efe2cf', color: g.C.orange, width: 3, close: true });
          const phi = g.lerp(0.0, 1.1, (1 - Math.cos(p * Math.PI * 2)) / 2), d = [Math.cos(phi), Math.sin(phi)];
          const tHit = 1 / Math.sqrt((d[0] / A) ** 2 + (d[1] / B) ** 2);
          const c1 = [cx - d[0] * tHit, cy - d[1] * tHit], c2 = [cx + d[0] * tHit, cy + d[1] * tHit];
          const nrm = q => { const v = [-(q[0] - cx) / (A * A), -(q[1] - cy) / (B * B)], l = Math.hypot(...v); return [v[0] / l, v[1] / l]; };
          const n1 = nrm(c1), n2 = nrm(c2);
          cone(g, c1[0], c1[1], n1[0], n1[1], mu, 130); cone(g, c2[0], c2[1], n2[0], n2[1], mu, 130);
          g.line(c1[0], c1[1], c2[0], c2[1], { color: g.C.blue, width: 3, dash: [8, 6] });
          const ang1 = Math.acos(Math.min(1, n1[0] * d[0] + n1[1] * d[1])), ang2 = Math.acos(Math.min(1, -(n2[0] * d[0] + n2[1] * d[1])));
          const ok = ang1 <= Math.atan(mu) && ang2 <= Math.atan(mu);
          [c1, c2].forEach((c, i) => { const s = i ? 1 : -1; g.rect(c[0] + s * d[0] * 30 - 14, c[1] + s * d[1] * 30 - 14, 28, 28, { fill: ok ? g.C.blue : g.C.red, r: 4 }); });
          g.panel(830, 130, 420, 290);
          g.formula('∠(u, n₁) ≤ arctan μ', 850, 190, { size: 28 });
          g.formula('∠(−u, n₂) ≤ arctan μ', 850, 240, { size: 28 });
          g.text(`μ = 0.4 → 摩擦角 ${deg(Math.atan(mu)).toFixed(1)}°`, 850, 290, { size: 20, color: g.C.sub });
          g.text(`夹角 ${deg(ang1).toFixed(0)}° / ${deg(ang2).toFixed(0)}°`, 850, 335, { size: 22 });
          g.text(ok ? '满足对拓条件：能夹住' : '超出摩擦锥：会滑出', 850, 385, { size: 24, weight: 700, color: ok ? g.C.blue : g.C.red });
        }
      },
      {
        title: '夹持力要多大',
        say: '把物体竖直提起来，重力要靠两侧的摩擦力平衡。两侧摩擦力之和最多是二乘 mu 乘法向力，所以法向夹持力至少是 m g 除以二 mu。半公斤的物体、摩擦系数零点五，至少需要四点九牛；再留两倍安全系数，设十牛左右。易碎物体则要在这个下限附近精细控制。',
        draw(g, p) {
          const lift = g.ease(g.seg(p, 0.3, 0.6)) * 80;
          g.rect(470, 240 - lift, 140, 200, { fill: '#efe2cf', stroke: g.C.orange, width: 3, r: 8 });
          g.text('m = 0.5 kg', 487, 345 - lift, { size: 20, weight: 600, color: g.C.orange });
          g.rect(430, 260 - lift, 40, 160, { fill: g.C.blue, r: 6 }); g.rect(610, 260 - lift, 40, 160, { fill: g.C.blue, r: 6 });
          g.arrow(380, 340 - lift, 466, 340 - lift, { color: g.C.ink, width: 4 }); g.arrow(700, 340 - lift, 614, 340 - lift, { color: g.C.ink, width: 4 });
          g.text('f_n', 380, 325 - lift, { size: 22, math: true }); g.text('f_n', 680, 325 - lift, { size: 22, math: true });
          g.arrow(450, 420 - lift, 450, 350 - lift, { color: g.C.green, width: 4 }); g.arrow(630, 420 - lift, 630, 350 - lift, { color: g.C.green, width: 4 });
          g.arrow(540, 440 - lift, 540, 540 - lift, { color: g.C.red, width: 4 }); g.text('mg', 552, 520 - lift, { size: 22, color: g.C.red, math: true });
          g.panel(820, 150, 420, 270);
          g.formula('2 μ f_n ≥ m g', 840, 210, { size: 32 });
          g.formula('f_n ≥ m g / (2μ)', 840, 265, { size: 32 });
          g.text('= 0.5 × 9.81 / (2 × 0.5) ≈ 4.9 N', 840, 320, { size: 22, alpha: g.seg(p, 0.5, 0.6) });
          g.text('安全系数 2 → 约 10 N', 840, 370, { size: 24, weight: 700, color: g.C.green, alpha: g.seg(p, 0.65, 0.75) });
        }
      },
      {
        title: '阻抗控制：接触时要“软”',
        say: '纯位置控制碰到刚性桌面时，一毫米的误差都可能产生巨大的力。阻抗控制让末端表现得像质量、弹簧和阻尼组成的系统。阻尼比 zeta 决定响应：太小会振荡，太大会迟缓，等于一时是临界阻尼，最快且不超调。例如有效质量二千克、刚度五百牛每米，临界阻尼约六十三牛秒每米。',
        draw(g, p) {
          const b = g.plotBox({ x: 110, y: 140, w: 640, h: 360, xmin: 0, xmax: 2, ymin: 0, ymax: 1.6 });
          g.axes(b, { xlabel: '时间 (s)', ylabel: '位置 / 目标' });
          g.line(b.X(0), b.Y(1), b.X(2), b.Y(1), { color: g.C.faint, dash: [5, 5], width: 1 });
          const T = 2 * g.ease(g.seg(p, 0.1, 0.65));
          g.curve(b, t => step(t, 0.2), { color: g.C.red, to: T });
          g.curve(b, t => step(t, 1), { color: g.C.green, to: T, width: 4 });
          g.curve(b, t => step(t, 2.5), { color: g.C.blue, to: T });
          g.text('ζ = 0.2 振荡', b.X(0.55), b.Y(1.5), { size: 20, color: g.C.red, alpha: g.seg(p, 0.3, 0.4) });
          g.text('ζ = 1 临界阻尼', b.X(1.2), b.Y(1.13), { size: 20, color: g.C.green, weight: 700, alpha: g.seg(p, 0.4, 0.5) });
          g.text('ζ = 2.5 迟缓', b.X(1.2), b.Y(0.7), { size: 20, color: g.C.blue, alpha: g.seg(p, 0.5, 0.6) });
          g.panel(810, 150, 440, 270);
          g.formula('M_d ë + D_d ė + K_d e = F_ext', 825, 210, { size: 26 });
          g.formula('ζ = D_d / (2√(K_d M_d))', 825, 265, { size: 26 });
          g.text('M = 2 kg, K = 500 N/m', 830, 320, { size: 21, alpha: g.seg(p, 0.65, 0.75) });
          g.text('→ D = 2√1000 ≈ 63 N·s/m', 830, 360, { size: 21, weight: 700, color: g.C.green, alpha: g.seg(p, 0.7, 0.8) });
        }
      },
      {
        title: '小结',
        say: '总结：接触力必须在摩擦锥内；平行夹爪的对拓条件要求连线落在两侧摩擦锥内；夹持力下限是 m g 除以二 mu；接触阶段用阻抗控制，按临界阻尼选择参数。学习式抓取检测、触觉和灵巧手见第十二章。',
        draw(g, p) {
          g.text('四个要点', 120, 140, { size: 34, weight: 700 });
          g.bullets(['摩擦锥：‖f_t‖ ≤ μ f_n，半角 arctan μ', '对拓抓取：连线同时落在两侧摩擦锥内', '夹持力下限：f_n ≥ mg / (2μ)，再加安全系数', '阻抗控制：D = 2√(KM) 临界阻尼'], 130, 220, p, { size: 28, gap: 70, step: 0.18 });
          g.text('延伸阅读：12 · 抓取与灵巧操作 推导 1–4', 130, 540, { size: 22, color: g.C.sub, alpha: g.seg(p, 0.75, 0.85) });
        }
      }
    ]
  });
})();
