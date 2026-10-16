(() => {
  function rng(seed) { let s = seed; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; }; }
  function randn(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const Hh = 10, N = 60, K = 8, GOAL = [10, 0], OBS = [5, 0.2], OR = 1.6;
  const rollout = A => { const pts = [[0, 0]]; for (const a of A) { const q = pts[pts.length - 1]; pts.push([q[0] + a[0], q[1] + a[1]]); } return pts; };
  const cost = A => { const pts = rollout(A); let c = (pts[Hh][0] - GOAL[0]) ** 2 + (pts[Hh][1] - GOAL[1]) ** 2; for (const q of pts) if (Math.hypot(q[0] - OBS[0], q[1] - OBS[1]) < OR) c += 40; for (const a of A) c += 0.05 * (a[0] ** 2 + a[1] ** 2); return c; };
  const iters = (() => {
    const r = rng(42); let mu = Array.from({ length: Hh }, () => [1, 0]), sd = Array.from({ length: Hh }, () => [0.6, 0.9]); const out = [];
    for (let it = 0; it < 4; it++) {
      const S = [];
      for (let n = 0; n < N; n++) { const A = mu.map((m, k) => [Math.max(-1.6, Math.min(1.6, m[0] + sd[k][0] * randn(r))), Math.max(-1.6, Math.min(1.6, m[1] + sd[k][1] * randn(r)))]); S.push({ A, c: cost(A) }); }
      S.sort((a, b) => a.c - b.c); const E = S.slice(0, K);
      out.push({ S, E, mu: mu.map(x => x.slice()) });
      mu = mu.map((_, k) => [0, 1].map(d => E.reduce((s, e) => s + e.A[k][d], 0) / K));
      sd = sd.map((_, k) => [0, 1].map(d => Math.max(0.05, Math.sqrt(E.reduce((s, e) => s + (e.A[k][d] - mu[k][d]) ** 2, 0) / K))));
    }
    out.push({ S: [], E: [], mu });
    return out;
  })();
  const MX = x => 120 + x * 70, MY = y => 330 - y * 70;

  registerLesson({
    id: 'v10_world_model_cem',
    title: '世界模型：在“想象”中规划',
    subtitle: '潜动力学模型、RSSM、多步误差累积与 CEM 采样规划',
    module: '15 · 世界模型',
    link: '15_世界模型.md',
    scenes: [
      { kind: 'title', say: '如果机器人能在脑子里预演动作的后果，就不必每次都在真实世界里试错。这一讲介绍世界模型，以及怎样用它在想象中规划。' },
      {
        title: '世界模型做什么',
        say: '世界模型接收当前观测和候选动作，预测未来会发生什么。通常先把高维图像编码成紧凑的潜状态，再在潜空间里学习转移函数，并预测奖励。有了它，智能体可以只在模型里滚动展开很多步，这就是“想象”。',
        draw(g, p) {
          const a = i => g.ease(g.seg(p, 0.05 + i * 0.12, 0.15 + i * 0.12));
          g.box(70, 260, 170, 80, '图像观测 o_t', { fill: g.C.lightBlue, alpha: a(0) });
          g.box(300, 260, 150, 80, '编码器', { fill: '#fff', alpha: a(1) });
          g.box(510, 260, 150, 80, '潜状态 z_t', { fill: '#efe9f6', alpha: a(1) });
          g.box(720, 260, 170, 80, '转移 f_θ', { fill: g.C.light, alpha: a(2) });
          g.box(950, 260, 160, 80, 'z_{t+1}', { fill: '#efe9f6', alpha: a(2) });
          g.box(720, 420, 170, 70, '动作 a_t', { fill: g.C.lightOrange, alpha: a(2) });
          g.box(950, 120, 220, 70, '预测奖励 / 图像', { fill: '#fff', alpha: a(3) });
          if (a(1) > 0.5) { g.arrow(240, 300, 300, 300, { color: g.C.sub }); g.arrow(450, 300, 510, 300, { color: g.C.sub }); }
          if (a(2) > 0.5) { g.arrow(660, 300, 720, 300, { color: g.C.sub }); g.arrow(890, 300, 950, 300, { color: g.C.sub }); g.arrow(805, 420, 805, 340, { color: g.C.orange }); }
          if (a(3) > 0.5) g.arrow(1030, 260, 1050, 190, { color: g.C.sub });
          if (a(4) > 0.5) { g.poly([[1030, 340], [1030, 380], [585, 380], [585, 340]], { color: g.C.purple, width: 3, dash: [8, 6] }); g.text('想象：反复调用 f_θ 展开多步', 640, 405, { size: 20, color: g.C.purple, weight: 600 }); }
        }
      },
      {
        title: 'RSSM：确定性记忆 + 随机潜变量',
        say: 'Dreamer 系列使用的 RSSM 有两条路径。确定性的循环状态 h 负责长期记忆；随机潜变量 z 表达不确定性。先验只根据 h 预测 z，用于想象；后验还能看到当前观测，用于训练。损失由重建项和两者之间的 KL 散度组成，迫使不看观测的先验也能预测得准。',
        draw(g, p) {
          const a = i => g.ease(g.seg(p, 0.05 + i * 0.13, 0.15 + i * 0.13));
          g.box(80, 180, 170, 70, 'h_{t−1}, z_{t−1}', { fill: '#fff', alpha: a(0) });
          g.box(80, 300, 170, 70, 'a_{t−1}', { fill: g.C.lightOrange, alpha: a(0) });
          g.box(320, 230, 150, 80, 'GRU', { fill: g.C.light, alpha: a(1) });
          g.box(540, 230, 140, 80, 'h_t', { fill: g.C.lightBlue, alpha: a(1) });
          g.box(760, 130, 230, 80, '先验 p(z_t | h_t)', { fill: '#efe9f6', alpha: a(2) });
          g.box(760, 330, 230, 80, '后验 q(z_t | h_t, o_t)', { fill: '#efe9f6', alpha: a(2) });
          g.box(1040, 330, 150, 80, 'o_t', { fill: g.C.lightBlue, alpha: a(2) });
          if (a(1) > 0.5) { g.arrow(250, 215, 320, 260, { color: g.C.sub }); g.arrow(250, 335, 320, 285, { color: g.C.sub }); g.arrow(470, 270, 540, 270, { color: g.C.sub }); }
          if (a(2) > 0.5) { g.arrow(680, 255, 760, 175, { color: g.C.sub }); g.arrow(680, 285, 760, 365, { color: g.C.sub }); g.arrow(1040, 370, 990, 370, { color: g.C.sub }); }
          if (a(3) > 0.5) { g.line(875, 210, 875, 330, { color: g.C.red, width: 3, dash: [6, 5] }); g.text('KL', 888, 278, { size: 24, color: g.C.red, weight: 700 }); }
          g.formula('L = Σ E[ log p(o_t|s_t) + log p(r_t|s_t) ] − KL( q ‖ p )', 140, 520, { size: 26, alpha: a(4) });
        }
      },
      {
        title: '多步预测：误差会累积',
        say: '世界模型每一步都有一点误差，多步展开时误差会叠加。如果转移函数会放大偏差，误差可能随步数指数增长。图中绿色是真实轨迹，紫色是模型从同一起点、同样动作下的多次预测，越往后越发散。所以想象的时域通常只有十几步，部署时还要不断用真实观测重新估计状态。',
        draw(g, p) {
          const b = g.plotBox({ x: 110, y: 130, w: 700, h: 380, xmin: 0, xmax: 20, ymin: -3, ymax: 3 });
          g.axes(b, { xlabel: '预测步数 k', ylabel: '状态' });
          const truth = k => 1.5 * Math.sin(k / 3.5);
          const n = 20 * g.ease(g.seg(p, 0.05, 0.6));
          g.curve(b, truth, { color: g.C.green, width: 4, to: n });
          const r = rng(9);
          for (let m = 0; m < 6; m++) { let x = truth(0), drift = 0; const pts = [[b.X(0), b.Y(x)]]; for (let k = 1; k <= n; k++) { drift = drift * 1.12 + 0.05 * randn(r); x = truth(k) + drift; pts.push([b.X(k), b.Y(Math.max(-3, Math.min(3, x)))]); } g.poly(pts, { color: g.C.purple, width: 2, alpha: 0.6 }); }
          g.panel(860, 150, 390, 230, { alpha: g.seg(p, 0.55, 0.65) });
          g.formula('e_{k+1} ≤ L e_k + ε', 880, 210, { size: 28, alpha: g.seg(p, 0.55, 0.65) });
          g.formula('e_H ≤ Lᴴ e₀ + ε Σ Lʲ', 880, 265, { size: 28, alpha: g.seg(p, 0.6, 0.7) });
          g.text('L > 1 时误差可能指数增长', 880, 330, { size: 20, color: g.C.red, alpha: g.seg(p, 0.65, 0.75) });
        }
      },
      {
        title: 'CEM：采样、选优、重新拟合',
        say: '有了模型，就能在线规划。交叉熵方法维护一个关于未来十步动作的高斯分布：先采样几十条动作序列，在模型里展开并计算代价；挑出最好的几条，也就是精英；再用精英的均值和方差更新高斯分布。重复几轮，分布就收敛到一条绕开障碍、到达目标的好轨迹。',
        draw(g, p) {
          const u = Math.min(3.999, g.seg(p, 0.05, 0.85) * 4), it = Math.floor(u), sub = u - it, I = iters[it];
          g.circle(MX(OBS[0]), MY(OBS[1]), OR * 70, { fill: '#e7cfc4', stroke: g.C.red, width: 2 });
          g.text('障碍', MX(OBS[0]) - 20, MY(OBS[1]) + 8, { size: 20, color: g.C.red, weight: 700 });
          g.circle(MX(GOAL[0]), MY(GOAL[1]), 16, { stroke: g.C.green, width: 3, fill: null }); g.text('目标', MX(GOAL[0]) - 18, MY(GOAL[1]) + 42, { size: 18, color: g.C.green });
          g.circle(MX(0), MY(0), 12, { fill: g.C.blue });
          const show = Math.floor(N * Math.min(1, sub * 2.5));
          I.S.slice(0, show).forEach(s => g.poly(rollout(s.A).map(q => [MX(q[0]), MY(q[1])]), { color: g.C.faint, width: 1.5, alpha: 0.6 }));
          if (sub > 0.45) I.E.forEach(s => g.poly(rollout(s.A).map(q => [MX(q[0]), MY(q[1])]), { color: g.C.orange, width: 3 }));
          if (sub > 0.7) g.poly(rollout(iters[it + 1].mu).map(q => [MX(q[0]), MY(q[1])]), { color: g.C.purple, width: 5 });
          g.tag(`第 ${it + 1} 轮`, 120, 120, { fill: g.C.purple });
          g.text(`采样 ${N} 条 · 精英 ${K} 条 · 最低代价 ${I.S[0].c.toFixed(1)}`, 240, 116, { size: 20, color: g.C.sub });
          g.panel(900, 440, 350, 140);
          g.text('灰：采样轨迹', 920, 480, { size: 19, color: g.C.sub });
          g.text('橙：精英（代价最低）', 920, 515, { size: 19, color: g.C.orange });
          g.text('紫：重新拟合的均值', 920, 550, { size: 19, color: g.C.purple });
        }
      },
      {
        title: '执行与学习',
        say: '规划完只执行第一个动作，下一时刻用新观测重新规划，并把上次的均值平移一步作为热启动。另一种用法是在想象轨迹上训练策略和价值网络，用 lambda 回报作为目标，这样部署时只需一次前向，速度更快。无论哪种，都要警惕策略利用模型的错误，在想象中找到虚高的回报。',
        draw(g, p) {
          g.text('两种用法', 120, 140, { size: 34, weight: 700 });
          g.panel(110, 180, 500, 330); g.panel(670, 180, 500, 330);
          g.text('在线规划（MPC / CEM / MPPI）', 135, 225, { size: 24, weight: 700, color: g.C.purple });
          g.bullets(['每步重新优化动作序列', '只执行第一个动作', '均值平移热启动', '计算量大，需批处理'], 140, 285, g.seg(p, 0, 0.5), { size: 22, gap: 52, step: 0.2 });
          g.text('想象中训练策略（Dreamer）', 695, 225, { size: 24, weight: 700, color: g.C.green });
          g.bullets(['从真实后验状态出发想象 H 步', 'λ 回报训练价值与策略', '部署只需一次前向', '注意模型被策略“钻空子”'], 700, 285, g.seg(p, 0.45, 0.95), { size: 22, gap: 52, step: 0.2 });
        }
      },
      {
        title: '小结',
        say: '总结：世界模型在潜空间预测未来状态和奖励；RSSM 结合确定性记忆和随机潜变量，用变分下界训练；多步预测误差会累积，必须闭环；CEM 通过采样、选精英、重拟合在模型中规划。视频生成式和嵌入预测式世界模型见第十五章。',
        draw(g, p) {
          g.text('四个要点', 120, 140, { size: 34, weight: 700 });
          g.bullets(['世界模型：编码 → 潜空间转移 → 预测奖励 / 观测', 'RSSM：h 记忆 + z 不确定性，ELBO = 重建 − KL', '误差随步数累积：短时域 + 闭环重估', 'CEM：采样 → 精英 → 重拟合高斯'], 130, 220, p, { size: 28, gap: 70, step: 0.18 });
          g.text('延伸阅读：15 · 世界模型；05 · 空间智能 推导 3', 130, 540, { size: 22, color: g.C.sub, alpha: g.seg(p, 0.75, 0.85) });
        }
      }
    ]
  });
})();
