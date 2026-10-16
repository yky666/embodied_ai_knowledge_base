(() => {
  const clip = (x, a, b) => Math.min(b, Math.max(a, x));
  registerLesson({
    id: 'v08_ppo_sim2real',
    title: '强化学习与 Sim2Real：在仿真里学会走路',
    subtitle: '策略梯度直觉、PPO 裁剪、并行仿真、域随机化与教师—学生蒸馏',
    module: '11 · 强化学习与 Sim2Real',
    link: '11_强化学习与Sim2Real.md',
    scenes: [
      { kind: 'title', say: '四足和人形机器人的稳健行走，大多是在仿真里用强化学习训练出来的。这一讲看策略梯度和 PPO 的直觉，以及怎样把仿真里学到的策略迁移到真实机器人上。' },
      {
        title: '强化学习循环',
        say: '智能体观察状态，策略给出动作，环境返回新的状态和奖励。目标是最大化未来奖励的折扣总和。和模仿学习不同，这里没有人告诉它每一步该怎么做，只有奖励信号告诉它做得好不好。',
        draw(g, p) {
          g.box(160, 250, 260, 110, '智能体 / 策略 π_θ', { fill: g.C.lightBlue, size: 24 });
          g.box(780, 250, 260, 110, '环境 / 仿真器', { fill: g.C.light, size: 24 });
          g.arrow(420, 280, 780, 280, { color: g.C.orange, width: 3 }); g.text('动作 a_t', 560, 268, { size: 22, color: g.C.orange });
          g.arrow(780, 335, 420, 335, { color: g.C.blue, width: 3 }); g.text('状态 s_{t+1}，奖励 r_t', 500, 372, { size: 22, color: g.C.blue });
          const t = (p * 4) % 1;
          if (t < 0.5) g.circle(g.lerp(420, 780, t * 2), 280, 10, { fill: g.C.orange }); else g.circle(g.lerp(780, 420, (t - 0.5) * 2), 335, 10, { fill: g.C.blue });
          g.formula('J(θ) = E[ Σ γᵗ r_t ]', 470, 490, { size: 34, alpha: g.seg(p, 0.4, 0.5) });
        }
      },
      {
        title: '策略梯度：多做“比预期好”的动作',
        say: '策略梯度的直觉很简单：如果某个动作带来的回报比平均水平好，也就是优势为正，就提高它的概率；如果比平均差，就降低。数学上，梯度等于对数概率的梯度乘以优势的期望。减去基线不改变梯度的期望，只是让估计更稳定。',
        draw(g, p) {
          const acts = ['左转', '直行', '右转', '停下'], adv = [-0.6, 1.2, 0.3, -1.0];
          const base = [0.25, 0.25, 0.25, 0.25], s = g.ease(g.seg(p, 0.3, 0.75));
          const logits = base.map((b, i) => Math.log(b) + s * 0.9 * adv[i]); const Z = logits.reduce((a, l) => a + Math.exp(l), 0);
          const probs = logits.map(l => Math.exp(l) / Z);
          acts.forEach((a, i) => {
            const x = 160 + i * 170, h = probs[i] * 600;
            g.rect(x, 520 - h, 110, h, { fill: adv[i] > 0 ? g.C.green : g.C.red, r: 6, alpha: 0.85 });
            g.text(a, x + 30, 555, { size: 22 });
            g.text(probs[i].toFixed(2), x + 32, 510 - h, { size: 20, weight: 600 });
            g.text(`A = ${adv[i] > 0 ? '+' : ''}${adv[i]}`, x + 18, 590, { size: 18, color: adv[i] > 0 ? g.C.green : g.C.red });
          });
          g.panel(860, 160, 390, 200);
          g.formula('∇J = E[ ∇log π(a|s) · Â ]', 875, 220, { size: 26 });
          g.text('Â > 0：概率上升', 880, 280, { size: 22, color: g.C.green });
          g.text('Â < 0：概率下降', 880, 320, { size: 22, color: g.C.red });
        }
      },
      {
        title: 'PPO：每次别改太多',
        say: '直接用策略梯度大步更新，新策略可能和采样时的旧策略差得太远，估计就不准了。PPO 用新旧策略的概率比 rho 来衡量改变幅度，并把它裁剪在一减 epsilon 到一加 epsilon 之间。优势为正时，rho 超过一点二就不再奖励；优势为负时，rho 低于零点八就不再惩罚。这样形成一个保守的下界。',
        draw(g, p) {
          const eps = 0.2;
          const mk = (x0, A, label) => {
            const b = g.plotBox({ x: x0, y: 160, w: 420, h: 300, xmin: 0, xmax: 2, ymin: -2.4, ymax: 2.4 });
            g.axes(b, { xlabel: 'ρ', ylabel: label });
            g.line(b.X(0), b.Y(0), b.X(2), b.Y(0), { color: g.C.faint, width: 1 });
            g.rect(b.X(1 - eps), b.y, b.X(1 + eps) - b.X(1 - eps), b.h, { fill: g.C.light, alpha: 0.8 });
            g.curve(b, r => r * A, { color: g.C.faint, dash: [6, 5], width: 2 });
            g.curve(b, r => Math.min(r * A, clip(r, 1 - eps, 1 + eps) * A), { color: A > 0 ? g.C.green : g.C.red, width: 4, to: 2 * g.ease(g.seg(p, 0.1, 0.6)) });
            [1 - eps, 1 + eps].forEach(v => g.text(v.toFixed(1), b.X(v) - 12, b.Y(-2.4) + 24, { size: 16, color: g.C.sub }));
          };
          mk(110, 1, 'L（Â > 0）'); mk(680, -1, 'L（Â < 0）');
          g.formula('L = E[ min( ρÂ, clip(ρ, 1−ε, 1+ε) Â ) ]', 280, 545, { size: 30, alpha: g.seg(p, 0.6, 0.7) });
        }
      },
      {
        title: '并行仿真与域随机化',
        say: 'PPO 需要大量样本，所以在 GPU 上同时运行几千个仿真环境。每个环境的物理参数都随机化：地面摩擦、机身质量、电机强度、传感器延迟、地形起伏各不相同。策略必须在所有这些变化下都表现好，真实世界就更可能落在它见过的范围之内。',
        draw(g, p) {
          const r = g.rng(5);
          for (let i = 0; i < 3; i++) for (let j = 0; j < 6; j++) {
            const x = 70 + j * 190, y = 90 + i * 125, fr = r(), ms = r(), slope = (r() - 0.5) * 0.3;
            g.rect(x, y, 175, 110, { fill: '#fff', stroke: g.C.grid, r: 8 });
            const gy = y + 85;
            g.line(x + 8, gy + slope * 80, x + 167, gy - slope * 80, { color: `hsl(${30 + fr * 90},45%,45%)`, width: 4 });
            const phase = p * 30 + i * 1.3 + j * 0.7, bx = x + 50 + ((p * 120 + j * 13) % 70), by = gy - slope * (bx - x - 87) * 1.0 - 28;
            g.rect(bx - 22, by - 12, 44 + ms * 14, 18, { fill: g.C.blue, r: 4 });
            g.line(bx - 14, by + 6, bx - 14 + 8 * Math.sin(phase), by + 22, { color: g.C.ink, width: 3 });
            g.line(bx + 14, by + 6, bx + 14 - 8 * Math.sin(phase), by + 22, { color: g.C.ink, width: 3 });
            g.text(`μ=${(0.3 + fr).toFixed(1)}`, x + 8, y + 20, { size: 13, color: g.C.sub });
          }
          g.text('每格一个仿真环境：摩擦 μ、质量、坡度、延迟各不相同（实际常并行数千个）', 70, 495, { size: 20, color: g.C.sub });
          g.panel(300, 515, 680, 70);
          g.formula('θ* = argmax_θ E_{ξ∼p(ξ)} [ J_ξ(θ) ]', 330, 560, { size: 28 });
        }
      },
      {
        title: '教师—学生：用特权信息先学，再蒸馏',
        say: '仿真里我们知道真实的地形、摩擦和接触状态，这些叫特权信息，真实机器人拿不到。常见做法是两阶段：先训练一个能看到特权信息的教师策略，它学得又快又好；再训练一个只看可部署观测历史的学生策略去模仿教师。学生从历史里隐式推断出环境参数，实现在线适应。',
        draw(g, p) {
          const a = i => g.ease(g.seg(p, 0.05 + i * 0.12, 0.15 + i * 0.12));
          g.box(80, 140, 260, 80, '特权信息\n地形 / 摩擦 / 接触', { fill: g.C.lightOrange, alpha: a(0) });
          g.box(80, 260, 260, 80, '本体观测\nIMU / 关节 / 指令', { fill: g.C.lightBlue, alpha: a(0) });
          g.box(450, 190, 260, 90, '教师策略 π_T\n（RL 训练）', { fill: '#efe9f6', alpha: a(1) });
          if (a(1) > 0.5) { g.arrow(340, 180, 450, 220, { color: g.C.sub }); g.arrow(340, 300, 450, 250, { color: g.C.sub }); }
          g.box(80, 420, 260, 80, '观测历史\n过去 H 步', { fill: g.C.lightBlue, alpha: a(2) });
          g.box(450, 410, 260, 90, '学生策略 π_S\n（模仿教师）', { fill: g.C.light, alpha: a(2) });
          if (a(2) > 0.5) g.arrow(340, 460, 450, 455, { color: g.C.sub });
          if (a(3) > 0.5) { g.arrow(580, 280, 580, 410, { color: g.C.purple, width: 3, dash: [8, 6] }); g.text('蒸馏：‖π_S − π_T‖²', 600, 350, { size: 22, color: g.C.purple, weight: 600 }); }
          g.box(850, 410, 300, 90, '部署到实机\n50 Hz → PD 1 kHz', { fill: g.C.light, alpha: a(4) });
          if (a(4) > 0.5) g.arrow(710, 455, 850, 455, { color: g.C.green, width: 3 });
        }
      },
      {
        title: '小结',
        say: '总结：策略梯度提高优势为正的动作概率；PPO 用裁剪限制每次更新的幅度；大规模并行仿真加域随机化让策略见多识广；教师—学生蒸馏把特权信息转化为可部署的能力。奖励设计和势函数整形等细节见第十一章。',
        draw(g, p) {
          g.text('四个要点', 120, 140, { size: 34, weight: 700 });
          g.bullets(['策略梯度：∇log π · 优势，基线降方差', 'PPO：概率比裁剪在 [1−ε, 1+ε]', '并行仿真 + 域随机化：覆盖真实参数范围', '教师—学生：特权信息 → 观测历史'], 130, 220, p, { size: 28, gap: 70, step: 0.18 });
          g.text('延伸阅读：11 · 强化学习与 Sim2Real；16 · 腿足与人形机器人', 130, 540, { size: 22, color: g.C.sub, alpha: g.seg(p, 0.75, 0.85) });
        }
      }
    ]
  });
})();
