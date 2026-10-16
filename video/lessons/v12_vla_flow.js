(() => {
  function rng(seed) { let s = seed; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; }; }
  function randn(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  const pairs = (() => {
    const r = rng(21), out = [];
    for (let i = 0; i < 140; i++) {
      const e = [randn(r), randn(r)], mode = r() < 0.5 ? -1 : 1, t = (r() - 0.5) * 2.2;
      out.push({ e, a: [mode * 1.8 + 0.25 * randn(r), t + 0.15 * randn(r)], mode });
    }
    return out;
  })();

  registerLesson({
    id: 'v12_vla_flow',
    title: 'VLA：让大模型输出机器人动作',
    subtitle: '视觉—语言—动作架构、动作离散化、流匹配动作头与快慢双系统',
    module: '17 · 机器人基础模型与数据',
    link: '17_机器人基础模型与数据.md',
    scenes: [
      { kind: 'title', say: '视觉语言动作模型，简称 VLA，试图把大模型的语义理解能力直接用于机器人控制。这一讲看它的架构，以及动作这种连续量是怎么被“说”出来的。' },
      {
        title: 'VLA 架构：图像、语言、本体进，动作出',
        say: '典型的 VLA 以预训练的视觉语言模型为主干。多个相机的图像经过视觉编码器变成图像 token，语言指令变成文本 token，机器人本体状态也编码成 token，一起送进 Transformer。最后由动作头输出未来一段动作，再经过反归一化和安全检查交给控制器。',
        draw(g, p) {
          const a = i => g.ease(g.seg(p, 0.05 + i * 0.12, 0.15 + i * 0.12));
          for (let i = 0; i < 6; i++) g.rect(80 + i * 34, 150, 30, 30, { fill: g.C.sky, r: 4, alpha: a(0) });
          g.text('图像 token', 80, 135, { size: 18, color: g.C.blue, alpha: a(0) });
          ['把', '红', '杯', '放', '进', '槽'].forEach((w, i) => { g.rect(80 + i * 34, 250, 30, 30, { fill: g.C.gold, r: 4, alpha: a(0) }); g.text(w, 86 + i * 34, 272, { size: 16, alpha: a(0) }); });
          g.text('语言 token', 80, 235, { size: 18, color: g.C.orange, alpha: a(0) });
          for (let i = 0; i < 2; i++) g.rect(80 + i * 34, 350, 30, 30, { fill: g.C.green, r: 4, alpha: a(0) });
          g.text('本体状态', 80, 335, { size: 18, color: g.C.green, alpha: a(0) });
          g.box(400, 170, 300, 200, '预训练 VLM 主干\nTransformer', { fill: '#efe9f6', alpha: a(1), size: 24 });
          if (a(1) > 0.5) { g.arrow(290, 165, 400, 220, { color: g.C.sub }); g.arrow(290, 265, 400, 270, { color: g.C.sub }); g.arrow(150, 365, 400, 320, { color: g.C.sub }); }
          g.box(780, 140, 220, 80, '离散动作 token', { fill: g.C.lightOrange, alpha: a(2) });
          g.box(780, 320, 220, 80, '连续动作头\n扩散 / 流匹配', { fill: g.C.light, alpha: a(2) });
          if (a(2) > 0.5) { g.arrow(700, 240, 780, 180, { color: g.C.sub }); g.arrow(700, 300, 780, 360, { color: g.C.sub }); g.text('二选一', 715, 275, { size: 18, color: g.C.sub }); }
          g.box(1060, 230, 170, 90, '反归一化\n安全过滤', { fill: '#fff', alpha: a(3) });
          if (a(3) > 0.5) { g.arrow(1000, 180, 1060, 260, { color: g.C.sub }); g.arrow(1000, 360, 1060, 290, { color: g.C.sub }); }
          g.text('动作块 → 控制器', 1060, 360, { size: 20, color: g.C.ink, weight: 600, alpha: a(4) });
        }
      },
      {
        title: '离散化：把连续动作变成“词”',
        say: '最直接的做法是离散化。把每个动作维度的取值范围均匀切成若干个箱子，比如二百五十六个，每个箱子对应一个 token，模型像生成文字一样逐个生成。解码时取箱子中心，误差最多半个箱宽。缺点是高频控制下 token 很多、生成慢，于是出现了先做离散余弦变换再压缩的 FAST 分词。',
        draw(g, p) {
          const B = 8, x0 = 160, w = 900, y = 300, val = 0.37 + 0.45 * Math.sin(p * Math.PI * 2);
          for (let i = 0; i < B; i++) g.rect(x0 + i * w / B, y, w / B - 4, 60, { fill: i === Math.min(B - 1, Math.floor((val + 1) / 2 * B)) ? g.C.gold : g.C.grid, r: 6 });
          for (let i = 0; i < B; i++) g.text(`#${i}`, x0 + i * w / B + 40, y + 38, { size: 20, color: g.C.ink });
          g.text('−1', x0 - 10, y + 95, { size: 20, color: g.C.sub }); g.text('+1', x0 + w - 18, y + 95, { size: 20, color: g.C.sub });
          const vx = x0 + (val + 1) / 2 * w, b = Math.min(B - 1, Math.floor((val + 1) / 2 * B)), cxx = x0 + (b + 0.5) * w / B;
          g.arrow(vx, y - 70, vx, y - 6, { color: g.C.blue, width: 3 }); g.text(`a = ${val.toFixed(2)}`, vx - 40, y - 80, { size: 20, color: g.C.blue, weight: 600 });
          g.arrow(cxx, y + 130, cxx, y + 66, { color: g.C.green, width: 3 }); g.text(`解码 â = ${(-1 + (b + 0.5) * 2 / B).toFixed(2)}`, cxx - 60, y + 155, { size: 20, color: g.C.green, weight: 600 });
          g.panel(160, 120, 900, 90);
          g.formula('b = ⌊(a − a_min)/Δ⌋,   â = a_min + (b + ½)Δ,   |a − â| ≤ Δ/2', 185, 175, { size: 26 });
          g.text('示意：8 个箱；RT-2 / OpenVLA 每维 256 个', 160, 560, { size: 20, color: g.C.sub });
        }
      },
      {
        title: '流匹配：沿直线把噪声推向动作',
        say: '另一种做法是连续生成。流匹配在噪声和真实动作之间连一条直线，网络学习沿这条线的速度，也就是动作减去噪声。推理时从高斯噪声出发，用欧拉法沿学到的速度场积分大约十步，就得到动作。图中右边的动作分布有两个模式，从同一团噪声出发，样本自然分流到两边。',
        draw(g, p) {
          const tau = g.ease(g.seg(p, 0.15, 0.8)), cx = 400, cy = 330, s = 80;
          g.line(cx - 300, cy, cx + 300, cy, { color: g.C.grid, width: 1 }); g.line(cx, cy - 230, cx, cy + 230, { color: g.C.grid, width: 1 });
          pairs.forEach(q => {
            const x = (1 - tau) * q.e[0] + tau * q.a[0], y = (1 - tau) * q.e[1] + tau * q.a[1];
            if (tau < 0.98) g.line(cx + q.e[0] * s, cy - q.e[1] * s, cx + q.a[0] * s, cy - q.a[1] * s, { color: g.C.faint, width: 0.6, alpha: 0.25 });
            g.circle(cx + x * s, cy - y * s, 4.5, { fill: q.mode < 0 ? g.C.blue : g.C.teal, alpha: 0.85 });
          });
          g.text(`τ = ${tau.toFixed(2)}`, cx - 40, 120, { size: 26, weight: 700, color: g.C.purple });
          g.text('τ=0 噪声', cx - 60, 590, { size: 18, color: g.C.sub, alpha: 1 - tau });
          g.panel(800, 130, 450, 330);
          g.formula('A_τ = τA + (1−τ)ε', 820, 190, { size: 28 });
          g.formula('目标速度 = A − ε', 820, 245, { size: 28 });
          g.formula('L = E‖v_θ(A_τ, τ, o) − (A − ε)‖²', 820, 300, { size: 24 });
          g.formula('A ← A + δ·v_θ   (δ = 0.1, 10 步)', 820, 360, { size: 24 });
          g.text('τ 方向约定因论文而异，以代码为准', 820, 420, { size: 18, color: g.C.sub });
        }
      },
      {
        title: '快慢双系统',
        say: '大模型推理慢，机器人控制却需要高频。一种流行的结构是快慢双系统：慢系统是视觉语言模型，每秒一到十次，负责理解场景和指令、形成子目标；快系统是较小的动作模块，每秒几十到上百次，结合最新的本体状态输出平滑的动作块。两者通过潜表示或注意力上下文连接。',
        draw(g, p) {
          const t = p * 4;
          g.box(120, 150, 420, 110, '慢系统：VLM\n理解场景与指令，约 1–10 Hz', { fill: '#efe9f6', size: 22 });
          g.box(120, 380, 420, 110, '快系统：动作专家\n扩散 / 流匹配，30–200 Hz', { fill: g.C.light, size: 22 });
          g.arrow(330, 260, 330, 380, { color: g.C.purple, width: 3 }); g.text('潜规划 / 上下文', 345, 330, { size: 20, color: g.C.purple });
          const tl = 640, w = 560;
          g.text('时间 →', tl + w - 60, 130, { size: 18, color: g.C.sub });
          for (let i = 0; i < 4; i++) { const x = tl + i * 140; if (i <= t) g.rect(x, 180, 120, 50, { fill: '#cbbfe0', r: 6 }); }
          for (let i = 0; i < 28; i++) { const x = tl + i * 20; if (i <= t * 7) g.rect(x, 410, 16, 50, { fill: g.C.green, r: 3 }); }
          g.text('慢：每次更新目标', tl, 260, { size: 18, color: g.C.purple }); g.text('快：持续输出动作块', tl, 490, { size: 18, color: g.C.green });
        }
      },
      {
        title: '小结',
        say: '总结：VLA 以视觉语言模型为主干，把图像、语言和本体状态统一成 token；动作可以离散成词逐个生成，也可以用扩散或流匹配连续生成；快慢双系统平衡了语义理解和控制频率。数据采集、跨形态对齐和公平评测见第十七章。',
        draw(g, p) {
          g.text('四个要点', 120, 140, { size: 34, weight: 700 });
          g.bullets(['VLA = VLM 主干 + 动作头 + 动作适配器', '离散 token：分箱 / FAST 压缩，自回归生成', '流匹配：直线路径、速度回归、约 10 步积分', '快慢双系统：语义 1–10 Hz，控制 30–200 Hz'], 130, 220, p, { size: 28, gap: 70, step: 0.18 });
          g.text('延伸阅读：06 · VLA 推导 3；17 · 机器人基础模型 推导 3–4', 130, 540, { size: 22, color: g.C.sub, alpha: g.seg(p, 0.75, 0.85) });
        }
      }
    ]
  });
})();
