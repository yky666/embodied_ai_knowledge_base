(() => {
  const L1 = 1, L2 = 1, S = 140;
  const fk = (q1, q2) => [L1 * Math.cos(q1) + L2 * Math.cos(q1 + q2), L1 * Math.sin(q1) + L2 * Math.sin(q1 + q2)];
  const jac = (q1, q2) => [[-L1 * Math.sin(q1) - L2 * Math.sin(q1 + q2), -L2 * Math.sin(q1 + q2)], [L1 * Math.cos(q1) + L2 * Math.cos(q1 + q2), L2 * Math.cos(q1 + q2)]];
  function dlsStep(q, target, lambda, eta) {
    const p = fk(q[0], q[1]), e = [target[0] - p[0], target[1] - p[1]], J = jac(q[0], q[1]);
    const A = [[J[0][0] ** 2 + J[0][1] ** 2 + lambda ** 2, J[0][0] * J[1][0] + J[0][1] * J[1][1]], [0, J[1][0] ** 2 + J[1][1] ** 2 + lambda ** 2]];
    A[1][0] = A[0][1];
    const det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    const y = [(A[1][1] * e[0] - A[0][1] * e[1]) / det, (-A[1][0] * e[0] + A[0][0] * e[1]) / det];
    const dq = [J[0][0] * y[0] + J[1][0] * y[1], J[0][1] * y[0] + J[1][1] * y[1]];
    return { q: [q[0] + eta * dq[0], q[1] + eta * dq[1]], err: Math.hypot(e[0], e[1]) };
  }
  const target = [1.15, 1.05], path = [[0.2, 2.4]], errs = [];
  for (let i = 0; i < 25; i++) { const r = dlsStep(path[path.length - 1], target, 0.1, 0.5); path.push(r.q); errs.push(r.err); }
  errs.push(Math.hypot(...fk(...path[path.length - 1]).map((v, i) => target[i] - v)));
  function svd2(J) {
    const a = J[0][0], b = J[0][1], c = J[1][0], d = J[1][1];
    const S1 = a * a + b * b + c * c + d * d, S2 = Math.sqrt((a * a + b * b - c * c - d * d) ** 2 + 4 * (a * c + b * d) ** 2);
    const s1 = Math.sqrt((S1 + S2) / 2), s2 = Math.sqrt(Math.max(0, (S1 - S2) / 2));
    const theta = 0.5 * Math.atan2(2 * (a * c + b * d), a * a + b * b - c * c - d * d);
    return { s1, s2, theta };
  }
  const BX = 400, BY = 470;

  registerLesson({
    id: 'v03_two_link_ik',
    title: '二连杆机械臂：从关节角到末端，再反过来',
    subtitle: '正运动学、工作空间、雅可比与奇异、阻尼最小二乘逆运动学',
    module: '03 · 机器人学',
    link: '03_机器人学.md',
    scenes: [
      { kind: 'title', say: '机械臂控制的核心问题是：关节角和末端位置之间怎么互相换算。这一讲用最简单的平面二连杆，把正运动学、雅可比和逆运动学串起来。' },
      {
        title: '正运动学：关节角 → 末端位置',
        say: '两根连杆长度都是一米。第一个关节角 q1 决定第一根连杆的方向，第二根连杆的绝对方向是 q1 加 q2。把两段向量首尾相加，就得到末端位置。比如 q1 等于零、q2 等于九十度时，末端在一、一。',
        draw(g, p) {
          const q1 = 0.3 + 0.7 * Math.sin(p * Math.PI * 2), q2 = 1.2 + 0.6 * Math.sin(p * Math.PI * 4 + 1);
          const a = g.arm(BX, BY, L1 * S, L2 * S, q1, q2);
          g.line(BX, BY, BX + 320, BY, { color: g.C.faint, dash: [5, 5], width: 1 });
          g.text('q1', BX + 50, BY - 12, { size: 22, color: g.C.blue, weight: 700 });
          g.text('q2', a.x1 + 14, a.y1 + 8, { size: 22, color: g.C.sky, weight: 700 });
          const tip = fk(q1, q2);
          g.text(`(${tip[0].toFixed(2)}, ${tip[1].toFixed(2)})`, a.x2 + 14, a.y2 - 12, { size: 20, color: g.C.orange, weight: 600 });
          g.panel(760, 130, 490, 250);
          g.formula('pₓ = l₁ cos q₁ + l₂ cos(q₁ + q₂)', 785, 195, { size: 28 });
          g.formula('p_y = l₁ sin q₁ + l₂ sin(q₁ + q₂)', 785, 250, { size: 28 });
          g.text(`q1 = ${(q1 * 180 / Math.PI).toFixed(0)}°   q2 = ${(q2 * 180 / Math.PI).toFixed(0)}°`, 785, 320, { size: 24, color: g.C.sub });
        }
      },
      {
        title: '工作空间：手能够到哪里',
        say: '让两个关节扫过所有角度，末端划出的区域就是工作空间。对两根等长连杆，它是一个半径为二的圆盘；如果连杆不等长，中间会出现半径为两者之差的空洞。目标点在工作空间外，任何算法都无解。',
        draw(g, p) {
          const n = Math.floor(900 * g.ease(g.seg(p, 0.05, 0.75))), r = g.rng(7);
          for (let i = 0; i < n; i++) { const q1 = r() * Math.PI * 2, q2 = (r() * 2 - 1) * Math.PI, t = fk(q1, q2); g.circle(BX + 40 + t[0] * 110, 330 - t[1] * 110, 2.5, { fill: g.C.orange, alpha: 0.5 }); }
          const q1 = p * Math.PI * 6, q2 = Math.sin(p * 9) * 2.5;
          g.arm(BX + 40, 330, 110, 110, q1, q2, { w: 12 });
          g.circle(BX + 40, 330, 220, { stroke: g.C.green, width: 2, fill: null, alpha: g.seg(p, 0.7, 0.8) });
          g.panel(830, 160, 400, 230);
          g.formula('|l₁ − l₂| ≤ ‖p‖ ≤ l₁ + l₂', 855, 230, { size: 28 });
          g.text('等长：0 ≤ ‖p‖ ≤ 2 m', 855, 290, { size: 22 });
          g.text('目标在外 → 无解', 855, 340, { size: 22, color: g.C.red, weight: 600 });
        }
      },
      {
        title: '雅可比：速度的映射与奇异',
        say: '雅可比矩阵把关节速度映射成末端速度。把单位大小的关节速度送进去，末端速度会形成一个椭圆：椭圆越圆，各方向越灵活。行列式等于 l1 乘 l2 乘 sin q2，当手臂伸直、q2 趋近零时，椭圆被压扁成一条线，末端在某个方向上完全动不了，这就是奇异位形。',
        draw(g, p) {
          const q1 = 0.5, q2 = g.lerp(1.8, 0.03, g.ease(g.seg(p, 0.25, 0.8)));
          const a = g.arm(BX, BY, L1 * S, L2 * S, q1, q2);
          const { s1, s2, theta } = svd2(jac(q1, q2));
          ctxEllipse(g, a.x2, a.y2, s1 * 70, s2 * 70, -theta);
          g.panel(760, 120, 490, 340);
          g.formula('ṗ = J(q) q̇', 785, 180, { size: 30 });
          g.formula('det J = l₁ l₂ sin q₂', 785, 235, { size: 30 });
          g.text(`q2 = ${(q2 * 180 / Math.PI).toFixed(1)}°`, 785, 300, { size: 24 });
          g.text(`奇异值 σ₁ = ${s1.toFixed(2)}, σ₂ = ${s2.toFixed(3)}`, 785, 345, { size: 22 });
          g.text(s2 < 0.1 ? '接近奇异：沿连杆方向几乎不能动' : '各方向都能运动', 785, 400, { size: 22, weight: 600, color: s2 < 0.1 ? g.C.red : g.C.green });
        }
      },
      {
        title: '逆运动学：阻尼最小二乘迭代',
        say: '逆运动学反过来，给定目标位置求关节角。思路是局部线性化：当前误差 e 约等于 J 乘关节增量。阻尼最小二乘在拟合误差的同时惩罚过大的关节步长，每一步解一个小的线性方程，再更新关节角。可以看到，几次迭代后末端就收敛到目标，误差曲线迅速下降。',
        draw(g, p) {
          const k = Math.min(path.length - 1, Math.floor(g.ease(g.seg(p, 0.15, 0.85)) * (path.length - 1)));
          for (let i = 0; i < k; i++) { const t = fk(...path[i]); g.circle(BX + t[0] * S, BY - t[1] * S, 4, { fill: g.C.faint }); }
          g.arm(BX, BY, L1 * S, L2 * S, path[k][0], path[k][1]);
          const tx = BX + target[0] * S, ty = BY - target[1] * S;
          g.circle(tx, ty, 14, { stroke: g.C.red, width: 3, fill: null }); g.line(tx - 20, ty, tx + 20, ty, { color: g.C.red }); g.line(tx, ty - 20, tx, ty + 20, { color: g.C.red });
          g.text('目标', tx + 18, ty - 18, { size: 20, color: g.C.red, weight: 600 });
          g.panel(760, 110, 490, 200);
          g.formula('Δq = Jᵀ (J Jᵀ + λ² I)⁻¹ e', 780, 170, { size: 28 });
          g.formula('q ← q + η Δq', 780, 225, { size: 28 });
          g.text(`迭代 ${k}   误差 ${errs[k].toFixed(3)} m`, 780, 280, { size: 22, color: g.C.purple, weight: 600 });
          const b = g.plotBox({ x: 800, y: 350, w: 400, h: 150, xmin: 0, xmax: 25, ymin: 0, ymax: errs[0] * 1.05 });
          g.axes(b, { xlabel: '迭代', ylabel: '误差' });
          g.poly(errs.slice(0, k + 1).map((e, i) => [b.X(i), b.Y(e)]), { color: g.C.purple, width: 3 });
        }
      },
      {
        title: '为什么要“阻尼”',
        say: '用奇异值分解看得最清楚。普通伪逆在每个方向的增益是一除以奇异值，奇异值趋近零时增益爆炸，关节会猛地乱转。阻尼版本的增益是 sigma 除以 sigma 平方加 lambda 平方，在奇异值很小时反而回落到零，代价是误差不能一步完全消除。lambda 就是在精度和稳定之间做权衡。',
        draw(g, p) {
          const lam = g.lerp(0.05, 0.3, g.ease(g.seg(p, 0.45, 0.85)));
          const b = g.plotBox({ x: 120, y: 130, w: 700, h: 380, xmin: 0, xmax: 1.5, ymin: 0, ymax: 10 });
          g.axes(b, { xlabel: '奇异值 σ', ylabel: '增益' });
          g.curve(b, s => Math.min(1 / s, 10), { color: g.C.red, from: 0.1, width: 3 });
          g.curve(b, s => s / (s * s + lam * lam), { color: g.C.green, from: 0.001, width: 4, alpha: g.ease(g.seg(p, 0.2, 0.3)) });
          g.text('伪逆 1/σ', b.X(0.13), b.Y(9.3), { size: 22, color: g.C.red, weight: 600 });
          g.text('阻尼 σ/(σ²+λ²)', b.X(0.5), b.Y(3.2), { size: 22, color: g.C.green, weight: 600, alpha: g.seg(p, 0.2, 0.3) });
          g.panel(880, 160, 360, 220);
          g.text(`λ = ${lam.toFixed(2)}`, 905, 225, { size: 30, weight: 700, color: g.C.green });
          g.text(`最大增益 1/(2λ) = ${(1 / (2 * lam)).toFixed(1)}`, 905, 285, { size: 22 });
          g.text('λ 大：稳但慢；λ 小：准但易抖', 905, 340, { size: 20, color: g.C.sub });
        }
      },
      {
        title: '小结',
        say: '回顾一下：正运动学是变换的连乘；工作空间决定有没有解；雅可比把关节速度映射到末端速度，行列式为零就是奇异；逆运动学用阻尼最小二乘迭代求解，阻尼防止奇异附近的大步长。实际系统还要检查关节限位和碰撞，详见第三章。',
        draw(g, p) {
          g.text('四个要点', 120, 140, { size: 34, weight: 700 });
          g.bullets(['正运动学：沿运动链把变换连乘', '工作空间：目标超出可达范围时无解', '雅可比：ṗ = J q̇，det J = 0 时奇异', '阻尼 IK：小奇异值方向不再放大步长'], 130, 220, p, { size: 28, gap: 70, step: 0.18 });
          g.text('延伸阅读：03 · 机器人学 推导 1–2；10 · 交互实验 二连杆', 130, 540, { size: 22, color: g.C.sub, alpha: g.seg(p, 0.75, 0.85) });
        }
      }
    ]
  });

  function ctxEllipse(g, x, y, rx, ry, rot) {
    const pts = [];
    for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 2, u = rx * Math.cos(a), v = ry * Math.sin(a); pts.push([x + u * Math.cos(rot) - v * Math.sin(rot), y + u * Math.sin(rot) + v * Math.cos(rot)]); }
    g.poly(pts, { color: g.C.purple, width: 3, fill: 'rgba(122,98,168,0.18)', close: true });
  }
})();
