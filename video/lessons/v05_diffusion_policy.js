(() => {
  const H = 16, SX = 200, SY = 340, GX = 760, OX = 480, OY = 340;
  const chunk = side => Array.from({ length: H }, (_, i) => { const s = (i + 1) / H, x = SX + (GX - SX) * s; return [x, SY + side * 150 * Math.sin(Math.PI * s) ** 1.2]; });
  const left = chunk(-1), right = chunk(1);
  const noiseA = (() => { const r = rng(3); return Array.from({ length: H }, () => [randn(r), randn(r)]); })();
  const noiseB = (() => { const r = rng(11); return Array.from({ length: H }, () => [randn(r), randn(r)]); })();
  function rng(seed) { let s = seed; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; }; }
  function randn(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const abar = s => Math.cos(Math.PI / 2 * s) ** 2;
  const noisy = (A0, eps, s) => A0.map((p, i) => { const cx = (SX + GX) / 2, cy = SY, a = Math.sqrt(abar(s)), b = Math.sqrt(1 - abar(s)); return [cx + a * (p[0] - cx) + b * eps[i][0] * 170, cy + a * (p[1] - cy) + b * eps[i][1] * 170]; });
  function scene(g) {
    g.rect(OX - 45, OY - 45, 90, 90, { fill: '#e7cfc4', stroke: g.C.red, r: 10 });
    g.text('障碍', OX - 22, OY + 8, { size: 20, color: g.C.red, weight: 700 });
    g.circle(SX, SY, 16, { fill: g.C.blue }); g.text('夹爪', SX - 22, SY + 42, { size: 18, color: g.C.blue });
    g.circle(GX + 30, SY, 18, { stroke: g.C.green, width: 3, fill: null }); g.text('目标', GX + 10, SY + 46, { size: 18, color: g.C.green });
  }
  function drawChunk(g, pts, color, o = {}) {
    g.poly([[SX, SY], ...pts], { color, width: 2, alpha: 0.5 * (o.alpha ?? 1) });
    pts.forEach((p, i) => g.circle(p[0], p[1], o.r ?? 7, { fill: (o.exec && i < o.exec) ? g.C.orange : color, alpha: o.alpha }));
  }

  registerLesson({
    id: 'v05_diffusion_policy',
    title: 'Diffusion Policy：从噪声中“雕刻”出动作',
    subtitle: '动作块、前向加噪、条件去噪、多模态与滚动执行',
    module: '06 · 具身学习与 VLA',
    link: '06_具身学习与VLA.md',
    scenes: [
      { kind: 'title', say: '扩散模型不只能生成图片，也能生成机器人动作。这一讲看 Diffusion Policy 怎么把一段未来动作当作样本，从高斯噪声里一步步去噪得到它。' },
      {
        title: '动作块：一次预测一段未来',
        say: 'Diffusion Policy 每次不是只输出一个动作，而是预测未来 H 步的动作块，这里 H 等于十六，每个点是夹爪未来的一个目标位置。整段动作作为一个高维样本来生成，这样前后动作是协调的。执行时只取前面几步，用橙色标出。',
        draw(g, p) {
          scene(g);
          const n = Math.floor(H * g.ease(g.seg(p, 0.1, 0.5)));
          drawChunk(g, left.slice(0, n), g.C.blue, { exec: g.seg(p, 0.6, 0.65) > 0 ? 8 : 0 });
          g.panel(880, 140, 360, 260);
          g.formula('A = [a_t, …, a_{t+H−1}]', 900, 200, { size: 26 });
          g.text('形状 H × d_a = 16 × 2', 900, 255, { size: 22 });
          g.text('橙色：实际执行的前 H_e = 8 步', 900, 310, { size: 20, color: g.C.orange, alpha: g.seg(p, 0.6, 0.7) });
          g.text('其余：用于协调，下一轮重新预测', 900, 350, { size: 20, color: g.C.sub, alpha: g.seg(p, 0.65, 0.75) });
        }
      },
      {
        title: '前向过程：逐步加噪',
        say: '训练时先做前向加噪。取一段专家动作块，按照噪声日程把它和高斯噪声混合：系数 alpha bar 从一逐渐降到零。扩散步 k 越大，动作越乱，最后变成纯噪声。关键是，任意一步的带噪样本都可以一次性闭式算出来。',
        draw(g, p) {
          scene(g);
          const s = g.ease(g.seg(p, 0.15, 0.8));
          drawChunk(g, noisy(left, noiseA, s), g.lerp(0, 1, s) > 0.5 ? g.C.purple : g.C.blue);
          g.panel(880, 130, 370, 300);
          g.formula('Aᵏ = √ᾱ_k A⁰ + √(1−ᾱ_k) ε', 895, 190, { size: 26 });
          g.text(`k / K = ${s.toFixed(2)}`, 900, 260, { size: 26, weight: 600 });
          g.text(`ᾱ = ${abar(s).toFixed(2)}`, 900, 305, { size: 26, color: g.C.purple, weight: 600 });
          g.rect(900, 340, 300, 16, { fill: g.C.grid, r: 8 }); g.rect(900, 340, 300 * abar(s), 16, { fill: g.C.blue, r: 8 });
          g.text('信号占比', 900, 390, { size: 18, color: g.C.sub });
        }
      },
      {
        title: '反向过程：从噪声去噪，天然多模态',
        say: '部署时反过来：从纯高斯噪声出发，网络在每一步预测噪声并把它减掉，经过若干步得到干净的动作块。不同的初始噪声会落到不同的模式上，这一次从左边绕，那一次从右边绕，两种都是合理的完整轨迹，而不会像均方误差那样平均成撞墙。',
        draw(g, p) {
          scene(g);
          const s = 1 - g.ease(g.seg(p, 0.1, 0.75));
          drawChunk(g, noisy(left, noiseA, s), g.C.blue);
          drawChunk(g, noisy(right, noiseB, s), g.C.teal, { alpha: g.seg(p, 0.05, 0.12) });
          g.panel(880, 140, 360, 270);
          g.text(`去噪步 k = ${Math.round(s * 100)}`, 900, 195, { size: 26, weight: 600 });
          g.text('样本 1 → 左绕', 900, 255, { size: 24, color: g.C.blue, weight: 600 });
          g.text('样本 2 → 右绕', 900, 300, { size: 24, color: g.C.teal, weight: 600 });
          g.text('每个样本都是完整、协调的轨迹', 900, 360, { size: 19, color: g.C.sub, alpha: g.seg(p, 0.75, 0.85) });
        }
      },
      {
        title: '训练目标：预测噪声',
        say: '网络的输入是带噪动作块、扩散步 k，以及观测条件，比如最近几帧图像和机器人本体状态；输出是同样形状的噪声估计。损失就是真实噪声和预测噪声的平方误差。注意，动作要先归一化，采样完再恢复成物理单位，并检查限位和碰撞。',
        draw(g, p) {
          const a = i => g.ease(g.seg(p, 0.05 + i * 0.1, 0.15 + i * 0.1));
          g.box(90, 150, 210, 70, '最近 T_o 帧图像', { fill: g.C.lightBlue, alpha: a(0) });
          g.box(90, 250, 210, 70, '关节 / 夹爪状态', { fill: g.C.lightBlue, alpha: a(0) });
          g.box(370, 200, 200, 70, '观测条件 c_t', { fill: g.C.light, alpha: a(1) });
          g.box(90, 380, 210, 70, '带噪动作块 Aᵏ', { fill: g.C.lightOrange, alpha: a(1) });
          g.box(90, 480, 210, 60, '扩散步 k', { fill: g.C.lightOrange, alpha: a(1) });
          g.box(640, 330, 240, 90, '条件去噪网络\nU-Net / Transformer', { fill: '#efe9f6', alpha: a(2) });
          g.box(950, 340, 220, 70, '噪声估计 ε̂', { fill: g.C.light, alpha: a(3) });
          if (a(1) > 0.5) { g.arrow(300, 185, 370, 225, { color: g.C.sub }); g.arrow(300, 285, 370, 250, { color: g.C.sub }); }
          if (a(2) > 0.5) { g.arrow(570, 235, 640, 350, { color: g.C.sub }); g.arrow(300, 415, 640, 380, { color: g.C.sub }); g.arrow(300, 510, 640, 400, { color: g.C.sub }); }
          if (a(3) > 0.5) g.arrow(880, 375, 950, 375, { color: g.C.sub });
          g.formula('L = E ‖ ε − ε_θ(Aᵏ, k, c_t) ‖²', 640, 520, { size: 30, alpha: a(4) });
        }
      },
      {
        title: '滚动执行与延迟预算',
        say: '执行时，策略预测十六步，只执行前八步，然后用新观测重新预测。这和模型预测控制的思想一样，既有长程协调，又能利用反馈纠错。还要满足一个时间预算：推理延迟加上预处理和通信，最好不超过执行这八步所用的时间，否则机器人会停顿或者执行过期的动作。',
        draw(g, p) {
          const y0 = 170, dt = 34;
          g.text('时间 →', 1110, y0 - 30, { size: 18, color: g.C.sub });
          const rounds = 4, shown = Math.min(rounds, Math.floor(g.seg(p, 0.05, 0.6) * rounds) + 1);
          for (let r = 0; r < shown; r++) {
            const x0 = 120 + r * 8 * dt, y = y0 + r * 70;
            g.rect(x0 - 70, y, 62, 40, { fill: g.C.lightOrange, r: 6 }); g.text('推理', x0 - 60, y + 27, { size: 16, color: g.C.orange });
            for (let i = 0; i < 16; i++) g.rect(x0 + i * dt, y, dt - 4, 40, { fill: i < 8 ? g.C.orange : g.C.grid, r: 4 });
            g.text(`第 ${r + 1} 次预测`, x0 + 16 * dt + 10, y + 27, { size: 16, color: g.C.sub });
          }
          g.panel(180, 470, 920, 110, { alpha: g.seg(p, 0.6, 0.7) });
          g.formula('L_infer + L_pre + L_comm  ≲  H_e · Δt', 210, 525, { size: 30, alpha: g.seg(p, 0.6, 0.7) });
          g.text('例：10 Hz 控制、H_e = 8 → 推理预算约 0.8 s', 210, 565, { size: 20, color: g.C.sub, alpha: g.seg(p, 0.7, 0.8) });
        }
      },
      {
        title: '小结',
        say: '总结：Diffusion Policy 把一段动作当作样本；训练时学习预测噪声；部署时从噪声去噪，能自然表达多种合理方案；滚动执行前几步再重规划。代价是多步去噪带来的延迟，DDIM 等少步采样器和流匹配可以缓解，详见第六章和第十七章。',
        draw(g, p) {
          g.text('四个要点', 120, 140, { size: 34, weight: 700 });
          g.bullets(['动作块 H × d_a 作为一个高维样本生成', '训练：闭式加噪 + 噪声回归，条件为图像与本体', '推理：从高斯噪声去噪，天然多模态', '滚动执行前 H_e 步；满足延迟预算'], 130, 220, p, { size: 28, gap: 70, step: 0.18 });
          g.text('延伸阅读：06 推导 2；02 DDPM；17 流匹配动作头', 130, 540, { size: 22, color: g.C.sub, alpha: g.seg(p, 0.75, 0.85) });
        }
      }
    ]
  });
})();
