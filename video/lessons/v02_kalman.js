(() => {
  const box = g => g.plotBox({ x: 90, y: 150, w: 760, h: 330, xmin: 0, xmax: 10, ymin: 0, ymax: 1.1 });
  function corridor(g, b) {
    g.axes(b, { xlabel: '位置 x (m)', ylabel: '概率密度' });
    for (let x = 0; x <= 10; x += 2) g.text(String(x), b.X(x) - 5, b.Y(0) + 26, { size: 16, color: g.C.sub });
  }
  function bot(g, b, x) { g.rect(b.X(x) - 22, b.Y(0) + 34, 44, 26, { fill: g.C.blue, r: 6 }); g.circle(b.X(x) - 12, b.Y(0) + 62, 6, { fill: g.C.ink }); g.circle(b.X(x) + 12, b.Y(0) + 62, 6, { fill: g.C.ink }); }
  const N = (x, m, v) => Math.exp(-0.5 * (x - m) ** 2 / v) / Math.sqrt(2 * Math.PI * v);

  registerLesson({
    id: 'v02_kalman',
    title: '贝叶斯滤波：机器人如何“相信”自己在哪',
    subtitle: '信念分布、预测与校正、卡尔曼增益的直觉',
    module: '05 · 空间智能',
    link: '05_空间智能.md',
    scenes: [
      { kind: 'title', say: '机器人永远无法直接知道自己的精确位置。这一讲用一维走廊的例子，看贝叶斯滤波和卡尔曼滤波怎样维护一个关于位置的信念。' },
      {
        title: '信念：用概率分布表示“我在哪”',
        say: '与其说机器人在四米处，不如说它的位置服从一个分布。这里用高斯分布表示信念：均值是最可能的位置，方差表示有多不确定。分布越宽，机器人越没有把握。',
        draw(g, p) {
          const b = box(g); corridor(g, b);
          const v = g.lerp(0.15, 0.8, (Math.sin(p * Math.PI * 2) + 1) / 2);
          g.curve(b, x => N(x, 3, v), { color: g.C.blue, fill: g.C.sky, fillAlpha: 0.3 });
          bot(g, b, 3);
          g.panel(900, 150, 340, 230);
          g.formula('b(x) = N(μ, σ²)', 925, 210);
          g.text('μ = 3.0 m', 925, 270, { size: 24 });
          g.text(`σ² = ${v.toFixed(2)} m²`, 925, 315, { size: 24, color: g.C.blue, weight: 600 });
          g.text(v > 0.5 ? '不太确定' : '比较确定', 925, 355, { size: 20, color: g.C.sub });
        }
      },
      {
        title: '预测：运动让信念变宽',
        say: '机器人命令自己前进一米。里程计会告诉它大概走了多远，但轮子打滑、地面不平都会带来误差。于是预测步把均值向前平移，同时把方差加上过程噪声 Q。不看新观测，只靠运动，信念只会越来越宽。',
        draw(g, p) {
          const b = box(g); corridor(g, b);
          const a = g.ease(g.seg(p, 0.15, 0.7));
          const mu = 3 + a, v = 0.3 + 0.7 * a;
          g.curve(b, x => N(x, 3, 0.3), { color: g.C.faint, dash: [6, 6], width: 2 });
          g.curve(b, x => N(x, mu, v), { color: g.C.blue, fill: g.C.sky, fillAlpha: 0.3 });
          bot(g, b, mu);
          g.arrow(b.X(3), b.Y(0.85), b.X(3 + a), b.Y(0.85), { color: g.C.orange, width: 3 });
          g.text('u = +1 m', b.X(3.1), b.Y(0.9), { size: 20, color: g.C.orange });
          g.panel(900, 150, 350, 260);
          g.formula('μ̄ = μ + u', 925, 210);
          g.formula('σ̄² = σ² + Q', 925, 265);
          g.text(`μ̄ = ${mu.toFixed(2)}`, 925, 330, { size: 24 });
          g.text(`σ̄² = 0.30 + ${(0.7 * a).toFixed(2)} = ${v.toFixed(2)}`, 925, 375, { size: 22, color: g.C.blue, weight: 600 });
        }
      },
      {
        title: '校正：观测让信念变窄',
        say: '接着，机器人看到墙上的路标，测得自己大约在五米处，测量噪声方差为零点五。把预测的先验和测量的似然相乘再归一化，就得到后验。后验的均值落在两者之间，偏向更可靠的一方，而方差比两者都小。这里先验方差是一，测量方差是零点五，后验均值约四点六七，方差约零点三三。',
        draw(g, p) {
          const b = box(g); corridor(g, b);
          const m0 = 4, v0 = 1, z = 5, R = 0.5, K = v0 / (v0 + R), m1 = m0 + K * (z - m0), v1 = (1 - K) * v0;
          g.curve(b, x => N(x, m0, v0), { color: g.C.blue, width: 3, alpha: 1 - 0.5 * g.seg(p, 0.6, 0.7) });
          g.text('先验 (预测)', b.X(2.0), b.Y(0.45), { size: 20, color: g.C.blue });
          const a = g.ease(g.seg(p, 0.15, 0.3));
          g.curve(b, x => N(x, z, R), { color: g.C.orange, width: 3, alpha: a });
          g.text('测量似然 z = 5', b.X(5.6), b.Y(0.6), { size: 20, color: g.C.orange, alpha: a });
          const c = g.ease(g.seg(p, 0.45, 0.65));
          g.curve(b, x => N(x, m1, v1), { color: g.C.green, width: 4, fill: g.C.green, fillAlpha: 0.3 * c, alpha: c });
          if (c > 0.5) g.text('后验', b.X(m1) - 20, b.Y(0.74), { size: 22, color: g.C.green, weight: 700 });
          bot(g, b, c > 0.5 ? m1 : m0);
          g.panel(900, 140, 350, 330);
          g.formula('K = σ̄² / (σ̄² + R)', 920, 195, { size: 26 });
          g.formula('μ = μ̄ + K (z − μ̄)', 920, 245, { size: 26 });
          g.formula('σ² = (1 − K) σ̄²', 920, 295, { size: 26 });
          g.text(`K = 1 / 1.5 = ${K.toFixed(3)}`, 920, 360, { size: 22, alpha: c });
          g.text(`μ = ${m1.toFixed(2)} m`, 920, 400, { size: 22, color: g.C.green, weight: 700, alpha: c });
          g.text(`σ² = ${v1.toFixed(2)} m²`, 920, 440, { size: 22, color: g.C.green, weight: 700, alpha: c });
        }
      },
      {
        title: '卡尔曼增益的直觉',
        say: '卡尔曼增益 K 决定了更相信预测还是更相信测量。测量噪声 R 很小时，K 接近一，后验几乎直接跳到测量值；R 很大时，K 接近零，机器人基本忽略这次测量。滤波器做的事情，就是按照各自的不确定性加权平均。',
        draw(g, p) {
          const R = Math.exp(g.lerp(Math.log(0.05), Math.log(4), (1 - Math.cos(p * Math.PI * 2)) / 2));
          const b = box(g); corridor(g, b);
          const m0 = 4, v0 = 1, z = 6, K = v0 / (v0 + R), m1 = m0 + K * (z - m0), v1 = (1 - K) * v0;
          g.curve(b, x => N(x, m0, v0), { color: g.C.blue, width: 2, dash: [6, 5] });
          g.curve(b, x => Math.min(N(x, z, R), 1.1), { color: g.C.orange, width: 2, dash: [6, 5] });
          g.curve(b, x => Math.min(N(x, m1, v1), 1.1), { color: g.C.green, width: 4 });
          g.line(b.X(m1), b.Y(0), b.X(m1), b.y, { color: g.C.green, width: 1, dash: [3, 4] });
          const kb = g.plotBox({ x: 930, y: 170, w: 280, h: 200, xmin: 0, xmax: 4, ymin: 0, ymax: 1 });
          g.axes(kb, { xlabel: 'R', ylabel: 'K' });
          g.curve(kb, r => 1 / (1 + r), { color: g.C.purple, from: 0.02 });
          g.circle(kb.X(R), kb.Y(K), 8, { fill: g.C.purple });
          g.text(`R = ${R.toFixed(2)}   K = ${K.toFixed(2)}`, 930, 430, { size: 24, weight: 600 });
          g.text(K > 0.7 ? '更相信测量' : K < 0.3 ? '更相信预测' : '两者折中', 930, 470, { size: 22, color: g.C.purple });
        }
      },
      {
        title: '循环：预测—校正—预测',
        say: '实际运行时，预测和校正不断交替。每次运动，不确定性上升；每次看到路标，不确定性下降。画出标准差随时间的变化，会得到一条锯齿形曲线。如果长时间看不到路标，不确定性会一直累积，这时就该主动寻找路标或者重定位。',
        draw(g, p) {
          const b = g.plotBox({ x: 110, y: 140, w: 980, h: 330, xmin: 0, xmax: 20, ymin: 0, ymax: 1.6 });
          g.axes(b, { xlabel: '时间步', ylabel: '标准差 σ (m)' });
          let v = 0.2; const pts = [], Q = 0.15, R = 0.3, upto = 20 * g.ease(g.seg(p, 0.05, 0.9));
          for (let k = 0; k < 20 && k < upto; k++) {
            pts.push([b.X(k), b.Y(Math.sqrt(v))]);
            v += Q; pts.push([b.X(k + 0.5), b.Y(Math.sqrt(v))]);
            const seeLandmark = !(k >= 10 && k < 16);
            if (seeLandmark) { v = v * R / (v + R); }
            pts.push([b.X(k + 0.5), b.Y(Math.sqrt(v))]);
          }
          g.rect(b.X(10.5), b.y, b.X(16) - b.X(10.5), b.h, { fill: g.C.lightOrange, alpha: 0.7 });
          g.text('看不到路标', b.X(11.6), b.y + 30, { size: 20, color: g.C.orange, weight: 600 });
          g.poly(pts, { color: g.C.blue, width: 3 });
          g.text('↑ 预测：运动增加不确定性', 140, 540, { size: 22, color: g.C.blue });
          g.text('↓ 校正：观测降低不确定性', 560, 540, { size: 22, color: g.C.green });
        }
      },
      {
        title: '推广与局限',
        say: '在多维情况下，均值变成向量，方差变成协方差矩阵，增益变成矩阵，这就是知识库第五章的式五点四。非线性系统要用扩展卡尔曼、无迹卡尔曼或粒子滤波。还要记住，如果把路标认错了，这属于数据关联错误，高斯滤波本身没法修复。',
        draw(g, p) {
          g.text('从一维到实际系统', 120, 140, { size: 34, weight: 700 });
          g.bullets(['多维：μ → 向量，σ² → 协方差 Σ，K = Σ̄Hᵀ(HΣ̄Hᵀ+R)⁻¹', '非线性：EKF 线性化 / UKF sigma 点 / 粒子滤波', '数据关联错误（认错路标）不能靠高斯更新修复', '工程上用 Joseph 形式保持协方差对称正定'], 130, 220, p, { size: 26, gap: 72, step: 0.18 });
          g.text('延伸阅读：05 · 空间智能 推导 2；04 · SLAM 因子图', 130, 540, { size: 22, color: g.C.sub, alpha: g.seg(p, 0.75, 0.85) });
        }
      }
    ]
  });
})();
