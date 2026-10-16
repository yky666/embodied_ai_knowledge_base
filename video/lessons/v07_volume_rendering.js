(() => {
  const NS = 40, T0 = 0, T1 = 6;
  const sigma = t => 0.15 + 5.5 * Math.exp(-(((t - 3.0) / 0.25) ** 2)) + 1.2 * Math.exp(-(((t - 4.6) / 0.3) ** 2));
  const color = t => t < 3.8 ? [200, 110, 70] : [80, 130, 190];
  const samples = (() => {
    const out = []; let T = 1; const d = (T1 - T0) / NS;
    for (let i = 0; i < NS; i++) {
      const t = T0 + (i + 0.5) * d, s = sigma(t), a = 1 - Math.exp(-s * d);
      out.push({ t, s, a, T, w: T * a, c: color(t) }); T *= 1 - a;
    }
    return { out, Tend: T };
  })();
  const pixel = (() => { const c = [0, 0, 0]; for (const s of samples.out) for (let k = 0; k < 3; k++) c[k] += s.w * s.c[k]; for (let k = 0; k < 3; k++) c[k] += samples.Tend * 245; return c.map(Math.round); })();
  const rgb = c => `rgb(${c[0]},${c[1]},${c[2]})`;
  const RX0 = 230, RX1 = 1050, RY = 300, X = t => RX0 + (t - T0) / (T1 - T0) * (RX1 - RX0);
  function cameraAndRay(g, alpha = 1) {
    g.poly([[110, RY - 40], [180, RY - 22], [180, RY + 22], [110, RY + 40]], { fill: g.C.ink, close: true, alpha });
    g.rect(196, RY - 70, 10, 140, { fill: g.C.sky, alpha }); g.text('像素', 176, RY - 82, { size: 18, color: g.C.sky, alpha });
    g.arrow(206, RY, RX1 + 40, RY, { color: g.C.ink, width: 2, alpha });
    g.text('r(t) = o + t·d', RX1 - 90, RY - 16, { size: 20, math: true, alpha });
  }
  function blobs(g, alpha = 1) {
    for (let i = 0; i < 60; i++) { const t = 1 + i * 0.075, s = sigma(t); if (s > 0.6) g.circle(X(t), RY + Math.sin(i * 1.7) * 24, 4 + s * 3, { fill: rgb(color(t)), alpha: Math.min(1, s / 6) * 0.35 * alpha }); }
    g.text('表面 (高密度)', X(3.0) - 50, RY - 90, { size: 18, color: g.C.orange, alpha });
    g.text('半透明物体', X(4.6) - 40, RY - 90, { size: 18, color: g.C.blue, alpha });
  }

  registerLesson({
    id: 'v07_volume_rendering',
    title: '体渲染：NeRF 与 3D 高斯泼溅如何算出一个像素',
    subtitle: '射线、体密度、透射率、权重合成与高斯 alpha 混合',
    module: '04 · 视觉与三维表示',
    link: '04_视觉与三维表示.md',
    scenes: [
      { kind: 'title', say: 'NeRF 和 3D 高斯泼溅是近年最流行的三维表示。它们渲染图像的核心是同一个思想：沿着射线累积颜色。这一讲把一个像素的计算过程拆开来看。' },
      {
        title: '从像素发出一条射线',
        say: '对图像上的每个像素，从相机中心穿过像素发出一条射线。场景被表示成空间中每一点的体密度 sigma 和颜色 c。体密度可以理解为光在这里被“挡住”的速率：在实心表面处很高，在空气中接近零。',
        draw(g, p) {
          cameraAndRay(g, g.ease(g.seg(p, 0, 0.2)));
          blobs(g, g.ease(g.seg(p, 0.25, 0.5)));
          const b = g.plotBox({ x: RX0, y: 400, w: RX1 - RX0, h: 150, xmin: T0, xmax: T1, ymin: 0, ymax: 6 });
          const a = g.ease(g.seg(p, 0.5, 0.75));
          if (a > 0) { g.axes(b, { xlabel: 't', ylabel: '密度 σ(t)' }); g.curve(b, sigma, { color: g.C.red, to: T0 + (T1 - T0) * a, fill: g.C.red, fillAlpha: 0.2 }); }
        }
      },
      {
        title: '透射率：光能走多远',
        say: '沿射线采样很多点。透射率 T 表示光从相机走到这里还没被挡住的比例，它等于之前所有小段透过率的乘积。每一小段的不透明度 alpha 等于一减去 e 的负 sigma 乘段长。所以 T 一开始接近一，碰到高密度的表面就迅速掉下去。',
        draw(g, p) {
          cameraAndRay(g); blobs(g, 0.5);
          const n = Math.floor(NS * g.ease(g.seg(p, 0.1, 0.7)));
          samples.out.slice(0, n).forEach(s => g.circle(X(s.t), RY, 5, { fill: g.C.ink }));
          const b = g.plotBox({ x: RX0, y: 400, w: RX1 - RX0, h: 150, xmin: T0, xmax: T1, ymin: 0, ymax: 1.05 });
          g.axes(b, { xlabel: 't', ylabel: '透射率 T' });
          g.poly(samples.out.slice(0, n).map(s => [b.X(s.t), b.Y(s.T)]), { color: g.C.blue, width: 3 });
          g.panel(830, 90, 420, 150);
          g.formula('α_i = 1 − exp(−σ_i δ_i)', 850, 140, { size: 26 });
          g.formula('T_i = ∏_{j<i} (1 − α_j)', 850, 200, { size: 26 });
        }
      },
      {
        title: '权重与颜色合成',
        say: '每个采样点对像素颜色的贡献权重，是“光能到达这里”乘以“在这里被挡住”，也就是 T 乘 alpha。权重在第一个表面处形成尖峰，后面的物体几乎被遮挡。把所有采样点的颜色按权重相加，再加上剩余透射率乘背景色，就得到最终像素。训练时，用多视角图像的颜色误差反向传播，调整整个场。',
        draw(g, p) {
          cameraAndRay(g, 0.6);
          const b = g.plotBox({ x: RX0, y: 360, w: RX1 - RX0 - 160, h: 180, xmin: T0, xmax: T1, ymin: 0, ymax: 0.6 });
          g.axes(b, { xlabel: 't', ylabel: '权重 w = T·α' });
          const a = g.ease(g.seg(p, 0.1, 0.45));
          samples.out.forEach(s => g.rect(b.X(s.t) - 7, b.Y(s.w * a), 14, b.Y(0) - b.Y(s.w * a), { fill: rgb(s.c) }));
          const c = g.ease(g.seg(p, 0.5, 0.7));
          g.panel(900, 90, 350, 220, { alpha: c });
          g.formula('Ĉ = Σ T_i α_i c_i + T_end c_bg', 915, 145, { size: 23, alpha: c });
          g.rect(1000, 175, 110, 110, { fill: rgb(pixel), r: 10, alpha: c });
          g.text('合成像素', 1010, 300, { size: 18, color: g.C.sub, alpha: c });
          g.text(`前表面权重和 ≈ ${samples.out.filter(s => s.t < 3.8).reduce((x, s) => x + s.w, 0).toFixed(2)}`, 870, 470, { size: 20, color: g.C.orange, alpha: g.seg(p, 0.7, 0.8) });
        }
      },
      {
        title: '3D 高斯泼溅：用显式椭球代替神经场',
        say: '三维高斯泼溅不再用神经网络查询密度，而是把场景表示成大量带颜色和不透明度的三维高斯椭球。渲染时把每个高斯投影到图像平面，变成二维椭圆，按深度从前到后排序，然后用同样的公式做 alpha 混合。因为是显式的、可以栅格化，渲染速度比 NeRF 快得多。',
        draw(g, p) {
          const gs = [
            { x: 420, y: 300, rx: 120, ry: 60, rot: 0.4, c: [201, 131, 69], a: 0.75, d: 1 },
            { x: 520, y: 330, rx: 90, ry: 90, rot: 0, c: [79, 154, 124], a: 0.6, d: 2 },
            { x: 600, y: 270, rx: 140, ry: 50, rot: -0.5, c: [106, 165, 196], a: 0.55, d: 3 },
            { x: 470, y: 380, rx: 70, ry: 40, rot: 1.0, c: [122, 98, 168], a: 0.7, d: 0.5 }];
          const order = [...gs].sort((a, b) => b.d - a.d);
          const n = Math.ceil(order.length * g.ease(g.seg(p, 0.2, 0.75)));
          order.slice(0, n).forEach(e => {
            const pts = []; for (let i = 0; i <= 50; i++) { const t = i / 50 * Math.PI * 2, u = e.rx * Math.cos(t), v = e.ry * Math.sin(t); pts.push([e.x + u * Math.cos(e.rot) - v * Math.sin(e.rot), e.y + u * Math.sin(e.rot) + v * Math.cos(e.rot)]); }
            g.poly(pts, { fill: rgb(e.c), stroke: false, close: true, alpha: e.a });
          });
          g.text('从后往前依次叠加（等价于从前往后的透射率累乘）', 160, 520, { size: 20, color: g.C.sub });
          g.panel(830, 140, 420, 280);
          g.formula('Σ_2D ≈ J R Σ Rᵀ Jᵀ', 850, 200, { size: 26 });
          g.formula('C = Σ c_i α̃_i ∏_{j<i}(1 − α̃_j)', 850, 260, { size: 24 });
          g.text('α̃_i = α_i · 二维高斯在像素处的值', 850, 315, { size: 19, color: g.C.sub });
          g.text('排序 + 栅格化 → 实时渲染', 850, 370, { size: 22, color: g.C.green, weight: 600 });
        }
      },
      {
        title: '渲染得好，不等于能用来碰撞',
        say: '最后提醒一点：NeRF 和高斯泼溅优化的是图像看起来对不对，而不是几何是否精确。半透明的漂浮物、缺失的背面都可能存在。机器人要做碰撞检测和抓取，还需要另外提取表面、融合深度传感器，并维护不确定性。',
        draw(g, p) {
          g.text('用于机器人时要注意', 120, 140, { size: 34, weight: 700 });
          g.bullets(['优化目标是光度一致，不是几何精度', '漂浮物、背面缺失、反光与透明区域易出错', '碰撞 / 抓取需另外提取网格、TSDF 或占据地图', '与深度传感器融合，并保留不确定性'], 130, 220, p, { size: 28, gap: 70, step: 0.18 });
        }
      },
      {
        title: '小结',
        say: '总结：体渲染沿射线累积颜色；透射率是之前所有小段透过率的乘积；权重等于透射率乘不透明度；NeRF 用神经场查询密度和颜色，三维高斯泼溅用显式椭球加排序栅格化。完整推导见第四章推导四和推导五。',
        draw(g, p) {
          g.text('四个要点', 120, 140, { size: 34, weight: 700 });
          g.bullets(['射线 r(t) = o + t·d 上采样密度与颜色', 'α = 1 − e^(−σδ)，T = ∏(1 − α)', '像素 = Σ T·α·c + T_end·背景', 'NeRF：神经场查询；3DGS：显式高斯 + 排序混合'], 130, 220, p, { size: 28, gap: 70, step: 0.18 });
          g.text('延伸阅读：04 · 视觉与三维表示 推导 4–5', 130, 540, { size: 22, color: g.C.sub, alpha: g.seg(p, 0.75, 0.85) });
        }
      }
    ]
  });
})();
