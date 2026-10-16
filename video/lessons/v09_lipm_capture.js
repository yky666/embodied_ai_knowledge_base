(() => {
  const g0 = 9.81, zc = 0.9, w = Math.sqrt(g0 / zc), SC = 380;
  const lipm = (c0, v0, p, t) => ({ c: p + (c0 - p) * Math.cosh(w * t) + v0 / w * Math.sinh(w * t), v: (c0 - p) * w * Math.sinh(w * t) + v0 * Math.cosh(w * t) });
  function pendulum(g, gx, gy, p, c, o = {}) {
    const px = gx + p * SC, cx = gx + c * SC, cy = gy - zc * SC * 0.5;
    g.line(gx - 520, gy, gx + 560, gy, { color: g.C.sub, width: 3 });
    g.line(px, gy, cx, cy, { color: g.C.ink, width: 5 });
    g.circle(cx, cy, 26, { fill: o.color ?? g.C.blue });
    g.poly([[px - 16, gy], [px + 16, gy], [px, gy - 14]], { fill: g.C.orange, close: true, stroke: false });
    g.line(cx, cy + 30, cx, gy, { color: g.C.faint, dash: [4, 5], width: 1 });
    return { px, cx, cy };
  }

  registerLesson({
    id: 'v09_lipm_capture',
    title: '双足平衡：倒立摆、ZMP 与捕获点',
    subtitle: '线性倒立摆模型、支撑多边形，以及被推一下时该往哪一步踩',
    module: '16 · 腿足与人形机器人',
    link: '16_腿足与人形机器人.md',
    scenes: [
      { kind: 'title', say: '人形机器人被推了一下，应该把脚踩到哪里才能站稳？这一讲用线性倒立摆模型推出一个简洁的答案：捕获点。' },
      {
        title: '线性倒立摆：质心被推离支点',
        say: '把机器人简化成一个质点加一根无质量的腿，质心保持在固定高度。压力中心，也就是地面合力的作用点，是这个倒立摆的支点。推导可得：质心加速度等于 omega 平方乘以质心到支点的水平距离，omega 等于根号下 g 除以质心高度。质心偏离支点越远，被推开得越快，这是一个不稳定的系统。',
        draw(g, p) {
          const t = g.seg(p, 0.25, 0.8) * 0.9;
          const s = lipm(0.03, 0, 0, t);
          pendulum(g, 640, 470, 0, Math.min(s.c, 1.3));
          g.panel(860, 110, 390, 200);
          g.formula('c̈ = ω² (c − p)', 880, 170, { size: 30 });
          g.formula('ω = √(g / z_c)', 880, 225, { size: 30 });
          g.text(`z_c = 0.9 m → ω ≈ ${w.toFixed(2)} s⁻¹`, 880, 280, { size: 20, color: g.C.sub });
          g.text('支点 p（压力中心）', 520, 520, { size: 20, color: g.C.orange });
          g.text(`t = ${t.toFixed(2)} s   c = ${s.c.toFixed(2)} m`, 120, 140, { size: 22 });
        }
      },
      {
        title: 'ZMP：压力中心必须在脚底范围内',
        say: '地面只能推、不能拉，所以压力中心只能落在脚底接触区域的凸包里，这个区域叫支撑多边形。单脚支撑时很小，双脚支撑时变大。经典的 ZMP 步行规划，就是设计质心轨迹，使对应的压力中心始终留在支撑多边形内。',
        draw(g, p) {
          const ox = 420, oy = 330;
          const foot = (x, y, a = 1) => g.rect(x - 45, y - 90, 90, 180, { fill: '#e4eff7', stroke: g.C.sky, r: 20, alpha: a });
          const both = p > 0.45;
          foot(ox - 90, oy); foot(ox + 90, oy, both ? 1 : 0.25);
          const poly = both ? [[ox - 135, oy - 90], [ox + 135, oy - 90], [ox + 135, oy + 90], [ox - 135, oy + 90]] : [[ox - 135, oy - 90], [ox - 45, oy - 90], [ox - 45, oy + 90], [ox - 135, oy + 90]];
          g.poly(poly, { color: g.C.green, width: 3, dash: [8, 6], close: true, fill: 'rgba(79,154,124,0.12)' });
          const zx = (both ? ox : ox - 90) + 40 * Math.sin(p * 18), zy = oy + 50 * Math.cos(p * 13);
          g.circle(zx, zy, 10, { fill: g.C.orange });
          g.text('ZMP', zx + 14, zy - 10, { size: 20, color: g.C.orange, weight: 700 });
          g.text(both ? '双脚支撑：多边形大' : '单脚支撑：多边形小', ox - 140, oy + 150, { size: 22, weight: 600, color: g.C.green });
          g.panel(780, 150, 460, 220);
          g.formula('p = c − c̈ / ω²', 800, 210, { size: 30 });
          g.text('约束：p ∈ 支撑多边形', 800, 270, { size: 24, weight: 600 });
          g.text('否则脚会翻转 / 机器人倾倒', 800, 320, { size: 20, color: g.C.red });
        }
      },
      {
        title: '捕获点：一步停下来要踩哪里',
        say: '定义捕获点 xi 等于质心位置加上质心速度除以 omega。可以证明，xi 只受压力中心驱动，并以 omega 的速率指数发散；而质心总是追着 xi 走。所以只要一步踩到 xi，它就不再移动，质心会渐渐停在脚的正上方。踩得太近，机器人继续往前倒；踩得太远，又会被推回来。',
        draw(g, p) {
          const c0 = 0, v0 = 0.5, xi = c0 + v0 / w;
          const trials = [{ p: xi * 0.5, label: '踩近了：继续前倒', color: g.C.red }, { p: xi, label: '踩在捕获点：稳稳停下', color: g.C.green }, { p: xi * 1.6, label: '踩远了：被推回去', color: g.C.orange }];
          const k = Math.min(2, Math.floor(p * 3)), tr = trials[k], tt = ((p * 3) % 1) * 1.4;
          const s = lipm(c0, v0, tr.p, tt);
          const d = pendulum(g, 360, 470, tr.p, Math.max(-0.4, Math.min(s.c, 0.6)), { color: tr.color });
          g.line(360 + xi * SC, 480, 360 + xi * SC, 500, { color: g.C.purple, width: 3 });
          g.text('ξ', 360 + xi * SC - 6, 525, { size: 24, color: g.C.purple, weight: 700, math: true });
          g.tag(`试验 ${k + 1}`, 120, 120, { fill: tr.color });
          g.text(tr.label, 240, 116, { size: 24, weight: 700, color: tr.color });
          g.panel(860, 150, 390, 230);
          g.formula('ξ = c + ċ / ω', 880, 210, { size: 30 });
          g.formula('dξ/dt = ω (ξ − p)', 880, 265, { size: 30 });
          g.text(`ċ = ${s.v.toFixed(2)} m/s`, 880, 330, { size: 22, color: tr.color, weight: 600 });
        }
      },
      {
        title: '数值例与上身的作用',
        say: '算一个例子：质心高零点九米，omega 约三点三。被推后质心速度为每秒零点五米，捕获点就在质心前方零点五除以三点三，大约十五厘米处。如果最大步长不够，就需要连续迈好几步，或者借助挥臂、弯腰改变角动量，这已经超出了线性倒立摆的假设。',
        draw(g, p) {
          const b = g.plotBox({ x: 130, y: 150, w: 600, h: 330, xmin: 0, xmax: 1.2, ymin: 0, ymax: 0.4 });
          g.axes(b, { xlabel: '质心速度 ċ (m/s)', ylabel: '捕获点偏移 ξ − c (m)' });
          g.curve(b, v => v / w, { color: g.C.purple, width: 4, to: 1.2 * g.ease(g.seg(p, 0.05, 0.4)) });
          const a = g.seg(p, 0.35, 0.45);
          g.line(b.X(0.5), b.Y(0), b.X(0.5), b.Y(0.5 / w), { color: g.C.orange, dash: [5, 5], alpha: a });
          g.line(b.X(0), b.Y(0.5 / w), b.X(0.5), b.Y(0.5 / w), { color: g.C.orange, dash: [5, 5], alpha: a });
          g.circle(b.X(0.5), b.Y(0.5 / w), 8, { fill: g.C.orange, alpha: a });
          g.text('0.15 m', b.X(0.52), b.Y(0.5 / w) - 12, { size: 20, color: g.C.orange, weight: 700, alpha: a });
          g.line(b.X(0), b.Y(0.3), b.X(1.2), b.Y(0.3), { color: g.C.red, dash: [8, 6], alpha: g.seg(p, 0.55, 0.65) });
          g.text('最大单步偏移（示例）', b.X(0.05), b.Y(0.3) - 10, { size: 18, color: g.C.red, alpha: g.seg(p, 0.55, 0.65) });
          g.panel(800, 170, 440, 230);
          g.text('超出单步能力时：', 820, 220, { size: 22, weight: 600 });
          g.text('• 连续多步', 830, 270, { size: 22 });
          g.text('• 挥臂 / 弯腰改变角动量', 830, 310, { size: 22 });
          g.text('• 需要更完整的质心动力学模型', 830, 350, { size: 22 });
        }
      },
      {
        title: '从模型到真实控制器',
        say: '真实的人形控制器通常分层：步态规划决定何时、在哪里落脚；质心模型预测控制预测未来一秒左右的运动；全身控制把期望的接触力和任务加速度转化为每个关节的力矩，频率上千赫兹。近年来，强化学习策略也越来越多地直接输出关节目标，但捕获点这样的物理直觉仍然是理解和调试它们的基础。',
        draw(g, p) {
          const items = [['任务指令', '速度 / 目标 / 遥操作'], ['步态规划', '接触时序、落脚点 ≈ 捕获点'], ['质心 MPC', '预测 0.5–1 s'], ['全身控制 QP', '力矩，0.5–1 kHz'], ['机器人', '关节 + IMU 反馈']];
          items.forEach(([a, b], i) => {
            const al = g.ease(g.seg(p, 0.05 + i * 0.13, 0.15 + i * 0.13)), y = 100 + i * 95;
            g.box(380, y, 520, 72, `${a}：${b}`, { fill: i === 4 ? g.C.light : g.C.lightBlue, alpha: al, size: 22 });
            if (i > 0 && al > 0.5) g.arrow(640, y - 23, 640, y, { color: g.C.sub });
          });
        }
      },
      {
        title: '小结',
        say: '总结：线性倒立摆把平衡问题简化为质心被推离压力中心；压力中心必须在支撑多边形内；捕获点等于质心位置加上质心速度除以 omega，一步踩到这里就能停下。完整推导和全身控制的二次规划写法见第十六章。',
        draw(g, p) {
          g.text('四个要点', 120, 140, { size: 34, weight: 700 });
          g.bullets(['LIPM：c̈ = ω²(c − p)，ω = √(g/z_c)', 'ZMP 必须位于支撑多边形内', '捕获点 ξ = c + ċ/ω，踩到 ξ 即可停下', '真实系统：步态规划 → 质心 MPC → 全身控制'], 130, 220, p, { size: 28, gap: 70, step: 0.18 });
          g.text('延伸阅读：16 · 腿足与人形机器人 推导 2–4', 130, 540, { size: 22, color: g.C.sub, alpha: g.seg(p, 0.75, 0.85) });
        }
      }
    ]
  });
})();
