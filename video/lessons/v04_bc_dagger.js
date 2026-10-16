(() => {
  const X0 = 110, X1 = 1170;
  const center = x => 330 + 110 * Math.sin((x - X0) / 170);
  function road(g, width = 70, alpha = 1) {
    const top = [], bot = [];
    for (let x = X0; x <= X1; x += 10) { top.push([x, center(x) - width]); bot.push([x, center(x) + width]); }
    g.poly([...top, ...bot.reverse()], { fill: g.C.light, stroke: false, close: true, alpha });
    g.poly(top, { color: g.C.faint, width: 2, alpha }); g.poly(bot.reverse(), { color: g.C.faint, width: 2, alpha });
  }
  function expert(g, o = {}) { const pts = []; for (let x = X0; x <= X1; x += 8) pts.push([x, center(x)]); g.poly(pts, { color: g.C.green, width: 4, ...o }); }
  /* Learner drifts: heading error accumulates once outside the covered band (teaching model, not a trained net). */
  function rollout(steps, eps, coverage) {
    let x = X0, d = 0, v = 0; const pts = [[x, center(x)]];
    const F = eps * 0.12, k = 0.0003, c = 0.035;
    for (let i = 0; i < steps && x <= X1; i++) {
      const inside = Math.abs(d) < coverage;
      v += inside ? F - k * d - c * v : 3 * F;
      d += v; x += 8;
      pts.push([x, Math.min(600, center(x) + d)]);
    }
    return pts;
  }

  registerLesson({
    id: 'v04_bc_dagger',
    title: '行为克隆为什么会“越走越偏”',
    subtitle: '模仿学习的分布偏移、复合误差、多模态动作与 DAgger',
    module: '06 · 具身学习与 VLA',
    link: '06_具身学习与VLA.md',
    scenes: [
      { kind: 'title', say: '让机器人模仿人类演示，是具身智能最常用的学习方式。但直接模仿有两个经典陷阱：复合误差和多模态。这一讲用一条弯曲的路说明它们，以及 DAgger 怎么缓解。' },
      {
        title: '行为克隆 = 监督学习',
        say: '专家沿着道路中心驾驶，我们记录下每个时刻的观测和专家的动作，组成训练集。行为克隆把它当作普通的监督学习：输入观测，回归专家动作。训练误差可以做得很小。',
        draw(g, p) {
          road(g);
          const a = g.ease(g.seg(p, 0.05, 0.6));
          const pts = []; for (let x = X0; x <= X0 + (X1 - X0) * a; x += 8) pts.push([x, center(x)]);
          g.poly(pts, { color: g.C.green, width: 4 });
          const n = Math.floor(14 * a);
          for (let i = 0; i < n; i++) {
            const x = X0 + 40 + i * 75, y = center(x), s = (center(x + 5) - center(x - 5)) / 10;
            g.circle(x, y, 7, { fill: g.C.ink });
            g.arrow(x, y, x + 36, y + 36 * s, { color: g.C.orange, width: 3, head: 9 });
          }
          g.panel(760, 470, 440, 110, { alpha: g.seg(p, 0.55, 0.65) });
          g.formula('min_θ  E_(o,a)~D  ‖π_θ(o) − a‖²', 785, 520, { size: 26, alpha: g.seg(p, 0.55, 0.65) });
          g.text('数据集 D：(观测, 专家动作) 对', 785, 560, { size: 20, color: g.C.sub, alpha: g.seg(p, 0.6, 0.7) });
        }
      },
      {
        title: '复合误差：一步小错，步步皆错',
        say: '问题出在部署时。学到的策略每一步都有一点小误差，车稍微偏离了中心。而训练数据里几乎没有偏离中心的状态，策略在这里不知道该怎么纠正，于是越偏越远。训练时的状态分布来自专家，部署时的状态分布来自策略自己，这就是分布偏移。最坏情况下，误差随时域长度平方增长。',
        draw(g, p) {
          road(g); expert(g, { alpha: 0.6 });
          g.text('训练数据覆盖区域', X0 + 10, center(X0) - 82, { size: 18, color: g.C.sub });
          const pts = rollout(Math.floor(140 * g.ease(g.seg(p, 0.1, 0.7))), 0.35, 45);
          g.poly(pts, { color: g.C.red, width: 4 });
          if (pts.length > 1) { const q = pts[pts.length - 1]; g.circle(q[0], q[1], 9, { fill: g.C.red }); }
          const b = g.plotBox({ x: 500, y: 495, w: 260, h: 90, xmin: 0, xmax: 10, ymin: 0, ymax: 100 });
          const a = g.seg(p, 0.65, 0.75);
          if (a > 0) {
            g.panel(460, 450, 340, 150, { alpha: a });
            g.curve(b, t => t * t, { color: g.C.red, alpha: a });
            g.curve(b, t => t * 10 * 0.5, { color: g.C.green, alpha: a, dash: [6, 5] });
            g.text('BC 最坏 O(T²ε)', 480, 480, { size: 18, color: g.C.red, alpha: a });
            g.text('理想 O(Tε)', 640, 480, { size: 18, color: g.C.green, alpha: a });
          }
        }
      },
      {
        title: '多模态：平均一下就撞上了',
        say: '第二个陷阱是多模态。前方有障碍物，专家有时从左边绕，有时从右边绕，两种都对。如果用均方误差训练一个单峰高斯策略，它会学到两种动作的平均值，也就是直直地撞上去。解决办法是用能表达多峰分布的模型，比如混合高斯、离散动作 token，或者扩散策略。',
        draw(g, p) {
          const ox = 700, oy = 330;
          g.rect(ox - 50, oy - 50, 100, 100, { fill: '#e7cfc4', stroke: g.C.red, r: 10 });
          g.text('障碍', ox - 22, oy + 8, { size: 22, color: g.C.red, weight: 700 });
          const a = g.ease(g.seg(p, 0.05, 0.35));
          const path = (side) => { const pts = []; for (let x = 160; x <= 160 + 960 * a; x += 8) { const k = Math.exp(-(((x - ox) / 170) ** 2)); pts.push([x, oy + side * 150 * k]); } return pts; };
          g.poly(path(-1), { color: g.C.green, width: 4 }); g.poly(path(1), { color: g.C.green, width: 4 });
          g.text('专家 A：左绕', 360, 200, { size: 20, color: g.C.green, alpha: a }); g.text('专家 B：右绕', 360, 470, { size: 20, color: g.C.green, alpha: a });
          const b = g.ease(g.seg(p, 0.35, 0.6));
          if (b > 0) { g.arrow(160, oy, 160 + (ox - 70 - 160) * b, oy, { color: g.C.red, width: 5, dash: [10, 6] }); g.text('MSE 均值：直行撞墙', 260, oy - 16, { size: 22, color: g.C.red, weight: 700, alpha: b }); }
          const c = g.seg(p, 0.6, 0.7);
          if (c > 0) {
            const pb = g.plotBox({ x: 920, y: 450, w: 280, h: 110, xmin: -2, xmax: 2, ymin: 0, ymax: 1 });
            g.panel(880, 410, 360, 180, { alpha: c });
            g.curve(pb, x => 0.95 * Math.exp(-(((x + 1) / 0.25) ** 2)) + 0.95 * Math.exp(-(((x - 1) / 0.25) ** 2)), { color: g.C.green, alpha: c });
            g.curve(pb, x => 0.5 * Math.exp(-((x / 1.0) ** 2)), { color: g.C.red, alpha: c, dash: [6, 5] });
            g.text('转向动作分布', 900, 440, { size: 18, color: g.C.sub, alpha: c });
          }
        }
      },
      {
        title: 'DAgger：在自己犯错的地方请教专家',
        say: 'DAgger 的思路很直接：既然问题是策略会走到训练没覆盖的状态，那就让策略自己去跑，在它实际访问到的每个状态上，请专家标注正确的动作，然后把这些新数据合并进数据集重新训练。重复几轮，数据覆盖的区域就扩展到了策略真正会去的地方，偏差得到纠正。',
        draw(g, p) {
          const round = Math.min(3, Math.floor(p * 4));
          const cov = [45, 75, 105, 130][round];
          road(g, cov + 10, 0.9); expert(g, { alpha: 0.6 });
          const pts = rollout(140, [0.35, 0.22, 0.12, 0.05][round], cov);
          g.poly(pts, { color: g.C.red, width: 3 });
          for (let i = 6; i < pts.length; i += 12) {
            const [x, y] = pts[i], dev = center(x) - y;
            if (Math.abs(dev) > 12) g.arrow(x, y, x + 20, y + dev * 0.6, { color: g.C.purple, width: 2, head: 8 });
          }
          g.tag(`第 ${round + 1} 轮`, 130, 110, { fill: g.C.purple });
          g.text('紫色箭头：专家在策略访问的状态上给出的纠正动作', 260, 106, { size: 20, color: g.C.purple });
          g.panel(830, 470, 400, 110);
          g.text('1. 运行当前策略 π_i', 850, 505, { size: 19 });
          g.text('2. 专家标注访问到的状态', 850, 532, { size: 19 });
          g.text('3. D ← D ∪ 新数据，重新训练', 850, 559, { size: 19 });
        }
      },
      {
        title: '实践中的对策',
        say: '实际系统里，除了 DAgger，还常用这些办法：采集时故意加入扰动，让演示包含恢复动作；预测一段动作块而不是单步动作，减少决策次数；用扩散或流匹配表达多模态；以及在评测时专门记录偏离和人工干预。',
        draw(g, p) {
          g.text('缓解分布偏移与多模态', 120, 140, { size: 34, weight: 700 });
          g.bullets(['DAgger / 人在回路纠正：在策略访问的状态上补数据', '扰动注入采集：演示中包含从偏离中恢复的动作', '动作分块（ACT、DP）：减少决策步数、平滑轨迹', '多模态动作头：混合高斯、离散 token、扩散 / 流匹配', '评测记录偏离、干预与失败类别'], 130, 215, p, { size: 26, gap: 66, step: 0.15 });
          g.text('延伸阅读：06 · 具身学习与 VLA 推导 1；17 · 机器人基础模型', 130, 560, { size: 22, color: g.C.sub, alpha: g.seg(p, 0.8, 0.9) });
        }
      }
    ]
  });
})();
