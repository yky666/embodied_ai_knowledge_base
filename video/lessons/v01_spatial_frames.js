(() => {
  const erf = x => { const s = Math.sign(x); x = Math.abs(x); const t = 1 / (1 + 0.3275911 * x); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)); };
  const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
  const world = (ox, oy, s) => ({ X: x => ox + s * x, Y: y => oy - s * y, s });
  function floor(g, m, x0, y0, x1, y1) {
    for (let x = x0; x <= x1; x++) g.line(m.X(x), m.Y(y0), m.X(x), m.Y(y1), { color: g.C.grid, width: 1 });
    for (let y = y0; y <= y1; y++) g.line(m.X(x0), m.Y(y), m.X(x1), m.Y(y), { color: g.C.grid, width: 1 });
    g.arrow(m.X(x0), m.Y(y0), m.X(x1) + 20, m.Y(y0), { color: g.C.sub, width: 2 });
    g.arrow(m.X(x0), m.Y(y0), m.X(x0), m.Y(y1) - 20, { color: g.C.sub, width: 2 });
    g.text('世界 x', m.X(x1) + 4, m.Y(y0) + 30, { size: 18, color: g.C.sub });
    g.text('世界 y', m.X(x0) - 20, m.Y(y1) - 30, { size: 18, color: g.C.sub });
  }
  function cup(g, x, y, label = '杯子') { g.circle(x, y, 16, { fill: g.C.orange }); g.circle(x, y, 9, { fill: '#f3d2b4' }); g.text(label, x + 22, y - 18, { size: 20, color: g.C.orange, weight: 600 }); }
  function axesOf(g, m, px, py, th, len = 1.1, alpha = 1) {
    const f = [Math.cos(th), Math.sin(th)], l = [-Math.sin(th), Math.cos(th)];
    g.arrow(m.X(px), m.Y(py), m.X(px + f[0] * len), m.Y(py + f[1] * len), { color: g.C.blue, width: 4, alpha });
    g.arrow(m.X(px), m.Y(py), m.X(px + l[0] * len), m.Y(py + l[1] * len), { color: g.C.green, width: 4, alpha });
    g.text('f 前', m.X(px + f[0] * (len + 0.25)) - 12, m.Y(py + f[1] * (len + 0.25)) + 6, { size: 20, color: g.C.blue, weight: 600, alpha });
    g.text('l 左', m.X(px + l[0] * (len + 0.3)) - 14, m.Y(py + l[1] * (len + 0.3)) + 6, { size: 20, color: g.C.green, weight: 600, alpha });
    return { f, l };
  }

  registerLesson({
    id: 'v01_spatial_frames',
    title: '空间参考系：杯子到底在哪一边？',
    subtitle: '自我中心与环境中心、坐标变换、带不确定性的空间关系',
    module: '05 · 空间智能',
    link: '05_空间智能.md',
    scenes: [
      { kind: 'title', say: '这一讲我们从一个简单的问题出发，理解空间智能里最基础、也最容易出错的概念：参考系。' },
      {
        title: '同一个杯子，两种说法',
        say: '桌上有一个杯子，机器人面朝上方时，杯子在它的左前方。现在机器人原地向右转九十度，杯子没有动，但对机器人来说，它变成了左后方。在世界坐标里，杯子的位置始终不变；而以机器人自身为基准的前后左右，会随着机器人一起旋转。',
        draw(g, p) {
          const m = world(330, 560, 100);
          floor(g, m, 0, 0, 6, 4.6);
          const th = Math.PI / 2 - (Math.PI / 2) * g.ease(g.seg(p, 0.35, 0.6));
          cup(g, m.X(1.6), m.Y(3.3));
          g.robot(m.X(3), m.Y(2), -th, { r: 26 });
          axesOf(g, m, 3, 2, th, 1.0);
          const before = p < 0.5;
          g.panel(980, 140, 270, 200);
          g.text('机器人看来：', 1000, 185, { size: 22, color: g.C.sub });
          g.text(before ? '杯子在左前方' : '杯子在左后方', 1000, 235, { size: 30, weight: 700, color: before ? g.C.green : g.C.red });
          g.text('世界坐标：(1.6, 3.3) m', 1000, 300, { size: 20, color: g.C.ink });
          if (p > 0.6) g.text('参考系变了，关系就变了', 980, 400, { size: 24, weight: 600, color: g.C.purple, alpha: g.ease(g.seg(p, 0.6, 0.7)) });
        }
      },
      {
        title: '用向量投影定义关系',
        say: '要让关系可计算，就把它写成向量投影。取参考物 A 指向查询物 B 的位移 delta p，再用机器人的前向单位向量 f 和左向单位向量 l 去点乘它。左向分量大于一个小阈值 tau，就说 B 在左侧；阈值是为了避免几乎正前方的物体被硬性分成左或右。',
        draw(g, p) {
          const m = world(260, 560, 100);
          floor(g, m, 0, 0, 5.5, 4.6);
          const A = [2, 1.5], B = [1, 3.6], th = Math.PI / 2 - 0.35;
          g.robot(m.X(A[0]), m.Y(A[1]), -th, { r: 24 });
          const { f, l } = axesOf(g, m, A[0], A[1], th, 1.0);
          cup(g, m.X(B[0]), m.Y(B[1]), 'B');
          g.text('A', m.X(A[0]) + 26, m.Y(A[1]) + 34, { size: 22, weight: 700 });
          const a1 = g.ease(g.seg(p, 0.1, 0.3));
          g.arrow(m.X(A[0]), m.Y(A[1]), m.X(A[0] + (B[0] - A[0]) * a1), m.Y(A[1] + (B[1] - A[1]) * a1), { color: g.C.orange, width: 4, dash: [8, 6] });
          if (a1 > 0.9) g.text('Δp', m.X(1.3), m.Y(2.5), { size: 24, color: g.C.orange, weight: 700, math: true });
          const d = [B[0] - A[0], B[1] - A[1]], sf = f[0] * d[0] + f[1] * d[1], sl = l[0] * d[0] + l[1] * d[1];
          const a2 = g.ease(g.seg(p, 0.35, 0.55));
          if (a2 > 0) {
            const pf = [A[0] + f[0] * sf, A[1] + f[1] * sf], pl = [A[0] + l[0] * sl, A[1] + l[1] * sl];
            g.line(m.X(B[0]), m.Y(B[1]), m.X(pf[0]), m.Y(pf[1]), { color: g.C.blue, dash: [4, 5], alpha: a2 });
            g.line(m.X(B[0]), m.Y(B[1]), m.X(pl[0]), m.Y(pl[1]), { color: g.C.green, dash: [4, 5], alpha: a2 });
            g.circle(m.X(pf[0]), m.Y(pf[1]), 6, { fill: g.C.blue, alpha: a2 }); g.circle(m.X(pl[0]), m.Y(pl[1]), 6, { fill: g.C.green, alpha: a2 });
          }
          g.panel(860, 110, 390, 360);
          g.formula('s_front = fᵀ Δp', 890, 170, { alpha: g.ease(g.seg(p, 0.3, 0.4)) });
          g.formula('s_left  = lᵀ Δp', 890, 225, { alpha: g.ease(g.seg(p, 0.35, 0.45)) });
          g.text(`= ${sf.toFixed(2)} m`, 1110, 170, { size: 24, color: g.C.blue, alpha: a2 });
          g.text(`= ${sl.toFixed(2)} m`, 1110, 225, { size: 24, color: g.C.green, alpha: a2 });
          const a3 = g.ease(g.seg(p, 0.6, 0.7));
          g.formula('s_left > τ  ⇒  B 在 A 左侧', 890, 300, { size: 26, alpha: a3 });
          g.text('τ 例如 0.05 m：避免近乎正前方', 890, 350, { size: 19, color: g.C.sub, alpha: a3 });
          g.text('被硬分为左或右', 890, 378, { size: 19, color: g.C.sub, alpha: a3 });
          g.text('“上 / 里面”还需支撑与包含证据', 890, 430, { size: 19, color: g.C.purple, alpha: g.ease(g.seg(p, 0.8, 0.9)) });
        }
      },
      {
        title: '从世界坐标变到机器人坐标',
        say: '同样的计算也可以写成坐标变换。设机器人在世界中的位置是 t，朝向由旋转矩阵 R 给出，它的两列分别是前向和左向。物体在机器人坐标系下的坐标，等于 R 的转置乘以物体世界坐标减去 t。第一项是前方距离，第二项是左方距离。例子中机器人在二、一，面朝世界 y 轴，杯子在一、三，算出来是前方两米、左方一米。',
        draw(g, p) {
          const m = world(240, 560, 95);
          floor(g, m, 0, 0, 5, 4.6);
          const t = [2, 1], th = Math.PI / 2, P = [1, 3];
          g.robot(m.X(t[0]), m.Y(t[1]), -th, { r: 24 });
          axesOf(g, m, t[0], t[1], th, 1.0);
          cup(g, m.X(P[0]), m.Y(P[1]));
          const a = g.ease(g.seg(p, 0.55, 0.75));
          if (a > 0) {
            g.line(m.X(t[0]), m.Y(t[1]), m.X(t[0]), m.Y(P[1]), { color: g.C.blue, width: 3, alpha: a, dash: [6, 5] });
            g.line(m.X(t[0]), m.Y(P[1]), m.X(P[0]), m.Y(P[1]), { color: g.C.green, width: 3, alpha: a, dash: [6, 5] });
            g.text('前 2 m', m.X(t[0]) + 10, m.Y(2.1), { size: 20, color: g.C.blue, alpha: a, weight: 600 });
            g.text('左 1 m', m.X(1.25), m.Y(P[1]) - 14, { size: 20, color: g.C.green, alpha: a, weight: 600 });
          }
          g.panel(780, 100, 470, 420);
          g.formula('pᴿ = Rᵀ ( pᵂ − t )', 810, 165, { size: 34, alpha: g.ease(g.seg(p, 0.05, 0.15)) });
          g.text('R = [ f  l ]：列向量是机器人的前、左轴', 810, 215, { size: 20, color: g.C.sub, alpha: g.ease(g.seg(p, 0.15, 0.25)) });
          const b = g.ease(g.seg(p, 0.35, 0.5));
          g.text('t = (2, 1)，面朝世界 +y：', 810, 280, { size: 22, alpha: b });
          g.text('f = (0, 1)，l = (−1, 0)', 810, 318, { size: 22, alpha: b });
          g.text('pᵂ − t = (1−2, 3−1) = (−1, 2)', 810, 368, { size: 22, alpha: g.ease(g.seg(p, 0.45, 0.55)) });
          g.text('pᴿ = ( fᵀ(−1,2), lᵀ(−1,2) ) = (2, 1)', 810, 418, { size: 22, weight: 700, color: g.C.purple, alpha: a });
          g.text('→ 前方 2 m，左方 1 m', 810, 465, { size: 22, weight: 700, color: g.C.purple, alpha: a });
        }
      },
      {
        title: '不确定性：别同样自信',
        say: '真实感知总有误差。如果左向分量服从均值零点一米的高斯分布，那么 B 在左侧的概率，就是高斯分布落在阈值右边的面积。标准差只有两厘米时，概率接近百分之九十九点四；当标准差增大到十厘米，概率掉到大约百分之六十九。一个好的空间推理系统，应该把这种不确定性报告出来，必要时换个视角再看一次。',
        draw(g, p) {
          const sigma = g.lerp(0.02, 0.1, g.ease(g.seg(p, 0.35, 0.75)));
          const b = g.plotBox({ x: 120, y: 130, w: 640, h: 380, xmin: -0.25, xmax: 0.45, ymin: 0, ymax: 21 });
          g.axes(b, { xlabel: 's_left (m)', ylabel: '概率密度' });
          const mu = 0.1, tau = 0.05;
          g.curve(b, x => g.gauss(x, mu, sigma), { color: g.C.blue, from: tau, to: b.xmax, fill: g.C.green, fillAlpha: 0.35 });
          g.curve(b, x => g.gauss(x, mu, sigma), { color: g.C.blue, width: 3 });
          g.line(b.X(tau), b.Y(0), b.X(tau), b.y, { color: g.C.red, width: 2, dash: [6, 5] });
          g.text('τ = 0.05', b.X(tau) + 6, b.y + 20, { size: 18, color: g.C.red });
          g.line(b.X(mu), b.Y(0), b.X(mu), b.Y(0) + 10, { color: g.C.ink });
          g.text('μ = 0.10', b.X(mu) - 30, b.Y(0) + 30, { size: 18, color: g.C.ink });
          const P = Phi((mu - tau) / sigma);
          g.panel(830, 130, 410, 330);
          g.formula('P = Φ( (μ − τ) / σ )', 860, 195, { size: 30 });
          g.text(`σ = ${(sigma * 100).toFixed(1)} cm`, 860, 270, { size: 30, weight: 600, color: g.C.blue });
          g.text(`P(B 在左侧) = ${(P * 100).toFixed(1)}%`, 860, 330, { size: 30, weight: 700, color: P > 0.95 ? g.C.green : g.C.orange });
          g.text(P > 0.95 ? '证据充分' : '应报告不确定 / 换视角', 860, 400, { size: 24, color: P > 0.95 ? g.C.green : g.C.red, weight: 600 });
        }
      },
      {
        title: '换位思考：从别人的视角',
        say: '问题里如果说，从门口的人看过去，沙发在左边还是右边，就需要把关系放到那个人的坐标系里计算。做法完全相同：用那个人的位置和朝向构造旋转矩阵，再做一次变换。很多视觉语言模型在这里出错，是因为默认用了相机视角。',
        draw(g, p) {
          const m = world(230, 560, 90);
          floor(g, m, 0, 0, 7, 4.8);
          g.rect(m.X(4.2), m.Y(4.2), 2.4 * 90, 0.9 * 90, { fill: '#cfd9e6', stroke: g.C.sky, r: 8 });
          g.text('沙发', m.X(5.1), m.Y(3.65), { size: 22, weight: 600, color: g.C.blue });
          const k = g.ease(g.seg(p, 0.3, 0.5));
          g.robot(m.X(1), m.Y(1), -Math.PI / 2, { r: 20, color: g.C.sub });
          g.text('相机 / 机器人', m.X(1) - 50, m.Y(1) + 50, { size: 18, color: g.C.sub });
          g.robot(m.X(6.6), m.Y(1.0), -Math.PI / 2, { r: 20, color: g.C.purple });
          g.text('门口的人', m.X(6.6) - 36, m.Y(1.0) + 50, { size: 18, color: g.C.purple, weight: 600 });
          axesOf(g, m, 1, 1, Math.PI / 2, 0.9, 1 - k * 0.7);
          axesOf(g, m, 6.6, 1.0, Math.PI / 2, 0.9, k);
          g.panel(900, 120, 350, 300);
          g.text('相机视角：沙发在右前方', 920, 180, { size: 22, color: g.C.sub });
          g.text('门口的人：', 920, 240, { size: 22, color: g.C.purple, alpha: k });
          g.text('也在右前方？', 920, 280, { size: 22, color: g.C.purple, alpha: k * (1 - g.seg(p, 0.6, 0.65)) });
          if (p > 0.62) {
            g.text('他在 (6.6, 1.0)，左轴指向 −x', 920, 280, { size: 20, color: g.C.sub });
            g.text('沙发在他的左前方', 920, 330, { size: 26, color: g.C.purple, weight: 700 });
            g.text('与相机视角的答案相反', 920, 370, { size: 20, color: g.C.red });
          }
        }
      },
      {
        title: '小结',
        say: '总结一下：空间关系一定要附带参考系；关系可以写成位移向量在参考轴上的投影；换参考系就是一次坐标变换；感知有噪声时，应该输出概率而不是武断的结论。完整的推导见知识库第五章和第十四章。',
        draw(g, p) {
          g.text('四个要点', 120, 140, { size: 34, weight: 700 });
          g.bullets(['关系必须写明参考系：相机、机器人、世界或他人', '关系 = 位移在参考轴上的投影 + 阈值', '换参考系 = 一次刚体坐标变换 pᴿ = Rᵀ(pᵂ − t)', '有噪声时输出概率，证据不足就主动换视角'], 130, 220, p, { size: 28, gap: 70, step: 0.18 });
          g.text('延伸阅读：05 · 空间智能 / 14 · 三维基础模型与空间推理', 130, 540, { size: 22, color: g.C.sub, alpha: g.seg(p, 0.75, 0.85) });
        }
      }
    ]
  });
})();
