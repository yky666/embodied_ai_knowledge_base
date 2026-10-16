(() => {
  const MAP = [
    '############################',
    '#.........#................#',
    '#.........#................#',
    '#.........#.......#####....#',
    '#.........#.......#........#',
    '#....###..#.......#........#',
    '#....#.............#.......#',
    '#....#.............#.......#',
    '#....#......########.......#',
    '#...........#..............#',
    '#...........#..............#',
    '#######.....#.....######...#',
    '#...........#..............#',
    '#...........#..............#',
    '############################'];
  const R = MAP.length, Cn = MAP[0].length, CS = 32, OX = 50, OY = 90;
  const occ = (r, c) => r < 0 || c < 0 || r >= R || c >= Cn || MAP[r][c] === '#';
  const cx = c => OX + c * CS, cy = r => OY + r * CS;
  function astar(start, goal, cost) {
    const key = (r, c) => r * Cn + c, g = new Map([[key(...start), 0]]), parent = new Map(), open = [[...start]], closed = new Set(), order = [];
    const h = (r, c) => Math.abs(r - goal[0]) + Math.abs(c - goal[1]);
    while (open.length) {
      open.sort((a, b) => (g.get(key(...a)) + h(...a)) - (g.get(key(...b)) + h(...b)));
      const [r, c] = open.shift(), k = key(r, c);
      if (closed.has(k)) continue; closed.add(k); order.push([r, c]);
      if (r === goal[0] && c === goal[1]) break;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nr = r + dr, nc = c + dc, nk = key(nr, nc);
        if (occ(nr, nc) || closed.has(nk)) continue;
        const ng = g.get(k) + 1 + (cost ? cost(nr, nc) : 0);
        if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); parent.set(nk, k); open.push([nr, nc]); }
      }
    }
    const path = []; let k = key(...goal);
    while (k !== undefined) { path.unshift([Math.floor(k / Cn), k % Cn]); k = parent.get(k); }
    return { order, path };
  }
  const start = [12, 2], goal = [2, 25];
  const plain = astar(start, goal);
  const dist = (r, c) => { let d = 9; for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (occ(r + i, c + j)) d = Math.min(d, Math.max(Math.abs(i), Math.abs(j))); return d; };
  const inflCost = (r, c) => { const d = dist(r, c); return d === 1 ? 6 : d === 2 ? 2 : 0; };
  const inflated = astar(start, goal, inflCost);
  function scan(pos, known, upto = 1) {
    const rays = Math.floor(360 * upto);
    for (let a = 0; a < rays; a++) {
      const th = a * Math.PI / 180;
      for (let s = 0; s < 9; s += 0.2) {
        const r = Math.round(pos[0] + s * Math.sin(th)), c = Math.round(pos[1] + s * Math.cos(th));
        if (r < 0 || c < 0 || r >= R || c >= Cn) break;
        if (occ(r, c)) { known[r][c] = 2; break; }
        known[r][c] = Math.max(known[r][c], 1);
      }
    }
    return known;
  }
  const blank = () => Array.from({ length: R }, () => Array(Cn).fill(0));
  const pos1 = [10, 8], known1 = scan(pos1, blank());
  function frontiers(known) {
    const fr = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < Cn; c++) if (known[r][c] === 1 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => known[r + a]?.[c + b] === 0)) fr.push([r, c]);
    const seen = new Set(), clusters = [];
    for (const f of fr) {
      const k = f.join(); if (seen.has(k)) continue;
      const q = [f], cl = []; seen.add(k);
      while (q.length) { const [r, c] = q.pop(); cl.push([r, c]); for (const g2 of fr) { const k2 = g2.join(); if (!seen.has(k2) && Math.abs(g2[0] - r) <= 1 && Math.abs(g2[1] - c) <= 1) { seen.add(k2); q.push(g2); } } }
      clusters.push(cl);
    }
    return clusters.filter(cl => cl.length >= 2).map(cl => { const m = cl.reduce((s, x) => [s[0] + x[0] / cl.length, s[1] + x[1] / cl.length], [0, 0]); return { cells: cl, center: m, gain: cl.length * 6, dist: Math.hypot(m[0] - pos1[0], m[1] - pos1[1]) }; });
  }
  const fcl = frontiers(known1).map(f => ({ ...f, U: f.gain - 2 * f.dist })).sort((a, b) => b.U - a.U);
  const best = fcl[0], pos2 = [Math.round(best.center[0]), Math.round(best.center[1])];
  const known2 = scan(pos2, known1.map(r => r.slice()));

  function grid(g, known, o = {}) {
    for (let r = 0; r < R; r++) for (let c = 0; c < Cn; c++) {
      const k = known ? known[r][c] : (occ(r, c) ? 2 : 1);
      const fill = k === 2 ? '#34525e' : k === 1 ? '#ffffff' : '#c9d3d6';
      g.rect(cx(c), cy(r), CS - 1, CS - 1, { fill });
      if (o.cost && k === 1) { const v = inflCost(r, c); if (v) g.rect(cx(c), cy(r), CS - 1, CS - 1, { fill: v > 3 ? 'rgba(201,131,69,0.55)' : 'rgba(201,131,69,0.25)' }); }
    }
  }
  const cellDot = (g, r, c, color, s = 0.32) => g.circle(cx(c) + CS / 2, cy(r) + CS / 2, CS * s, { fill: color });
  const N = (x) => x;

  registerLesson({
    id: 'v06_occupancy_astar',
    title: '机器人导航：建图、规划与主动探索',
    subtitle: '占据栅格的对数几率更新、A* 搜索、代价地图膨胀与前沿探索',
    module: '13 · 导航与视觉语言导航',
    link: '13_导航与视觉语言导航.md',
    scenes: [
      { kind: 'title', say: '移动机器人要导航，先得知道哪里能走，再规划一条路，未知的地方还要主动去探索。这一讲依次看占据栅格、A 星搜索和前沿探索。' },
      {
        title: '占据栅格：每个格子一个概率',
        say: '把环境切成小格子，每个格子记录被占据的概率。为了方便更新，存的是对数几率 l。激光击中这个格子一次，就加上零点八四七；激光穿过它，就减去一个值。连续击中三次后，l 约为二点五四，占据概率约百分之九十三。乘法变成了加法，这就是对数几率的好处。',
        draw(g, p) {
          const seq = ['击中', '击中', '击中', '穿过', '击中'], inc = { '击中': Math.log(0.7 / 0.3), '穿过': Math.log(0.4 / 0.6) };
          const n = Math.min(seq.length, Math.floor(g.seg(p, 0.1, 0.85) * (seq.length + 1)));
          let l = 0; const ls = [0];
          for (let i = 0; i < n; i++) { l += inc[seq[i]]; ls.push(l); }
          const prob = 1 / (1 + Math.exp(-l));
          g.rect(160, 200, 160, 160, { fill: `rgb(${Math.round(255 - 200 * prob)},${Math.round(255 - 180 * prob)},${Math.round(255 - 160 * prob)})`, stroke: g.C.ink, width: 3, r: 6 });
          g.text(`p = ${prob.toFixed(3)}`, 165, 400, { size: 26, weight: 700 });
          g.text(`l = ${l.toFixed(3)}`, 165, 440, { size: 24, color: g.C.blue });
          seq.slice(0, n).forEach((s, i) => g.tag(s, 380 + i * 92, 240, { fill: s === '击中' ? g.C.red : g.C.green }));
          const b = g.plotBox({ x: 380, y: 300, w: 420, h: 200, xmin: 0, xmax: 5, ymin: -1, ymax: 3.2 });
          g.axes(b, { xlabel: '观测次数', ylabel: 'l' });
          g.line(b.X(0), b.Y(0), b.X(5), b.Y(0), { color: g.C.faint, dash: [4, 4], width: 1 });
          g.poly(ls.map((v, i) => [b.X(i), b.Y(v)]), { color: g.C.blue, width: 3 });
          ls.forEach((v, i) => g.circle(b.X(i), b.Y(v), 5, { fill: g.C.blue }));
          g.panel(860, 160, 380, 240);
          g.formula('l_t = l_{t−1} + log(p/(1−p)) − l₀', 875, 215, { size: 23 });
          g.text('击中：p = 0.7 → +0.847', 880, 275, { size: 21, color: g.C.red });
          g.text('穿过：p = 0.4 → −0.405', 880, 315, { size: 21, color: g.C.green });
          g.text('概率 = 1 / (1 + e^(−l))', 880, 365, { size: 21, color: g.C.sub });
        }
      },
      {
        title: '激光扫描建图',
        say: '机器人站在原地，激光雷达向四周发射射线。射线经过的格子被标为空闲，射线打到的格子被标为占据，没被照到的地方保持未知，用灰色表示。注意未知和空闲不同，规划时要区别对待。',
        draw(g, p) {
          const known = scan(pos1, blank(), g.ease(g.seg(p, 0.05, 0.7)));
          grid(g, known);
          const ang = g.ease(g.seg(p, 0.05, 0.7)) * Math.PI * 2;
          if (p < 0.72) g.line(cx(pos1[1]) + CS / 2, cy(pos1[0]) + CS / 2, cx(pos1[1]) + CS / 2 + 280 * Math.cos(ang), cy(pos1[0]) + CS / 2 + 280 * Math.sin(ang), { color: g.C.red, width: 2, alpha: 0.6 });
          g.robot(cx(pos1[1]) + CS / 2, cy(pos1[0]) + CS / 2, 0, { r: 13 });
          g.panel(970, 150, 280, 200);
          g.rect(990, 185, 26, 26, { fill: '#fff', stroke: g.C.faint }); g.text('空闲', 1030, 206, { size: 20 });
          g.rect(990, 235, 26, 26, { fill: '#34525e' }); g.text('占据', 1030, 256, { size: 20 });
          g.rect(990, 285, 26, 26, { fill: '#c9d3d6' }); g.text('未知', 1030, 306, { size: 20 });
        }
      },
      {
        title: 'A* 搜索：先扩展最有希望的格子',
        say: '有了地图，就可以规划路径。A 星搜索每次从待扩展集合里取出 g 加 h 最小的格子：g 是从起点走过来的代价，h 是到终点的估计。只要 h 不高估真实距离，找到的路径就是最短的。浅蓝色是已扩展的格子，可以看到搜索被启发式引向终点，比盲目搜索省很多。',
        draw(g, p) {
          grid(g, null);
          const n = Math.floor(plain.order.length * g.ease(g.seg(p, 0.05, 0.7)));
          for (let i = 0; i < n; i++) { const [r, c] = plain.order[i]; g.rect(cx(c) + 2, cy(r) + 2, CS - 5, CS - 5, { fill: 'rgba(106,165,196,0.45)', r: 4 }); }
          if (p > 0.72) { const m = Math.floor(plain.path.length * g.seg(p, 0.72, 0.9)); for (let i = 0; i < m; i++) cellDot(g, ...plain.path[i], g.C.orange); }
          cellDot(g, ...start, g.C.blue, 0.42); cellDot(g, ...goal, g.C.green, 0.42);
          g.panel(970, 150, 280, 250);
          g.formula('f(n) = g(n) + h(n)', 985, 205, { size: 26 });
          g.text('h：曼哈顿距离', 990, 255, { size: 20 });
          g.text('（四邻域下可采纳）', 990, 285, { size: 18, color: g.C.sub });
          g.text(`已扩展 ${n} 格`, 990, 335, { size: 22, color: g.C.sky, weight: 600 });
          if (p > 0.72) g.text(`路径长度 ${plain.path.length - 1}`, 990, 375, { size: 22, color: g.C.orange, weight: 600 });
        }
      },
      {
        title: '代价地图：离墙远一点',
        say: '最短路径往往紧贴墙角，而真实机器人有体积，定位也有误差。代价地图会把障碍物膨胀：先按机器人半径把不可通行区域扩大，再在周围加一圈渐变的代价。重新规划后，路径会主动和墙保持距离，虽然稍长，但安全得多。',
        draw(g, p) {
          const a = g.ease(g.seg(p, 0.1, 0.35));
          grid(g, null, { cost: a > 0.5 });
          const showNew = p > 0.45;
          plain.path.forEach(([r, c]) => cellDot(g, r, c, showNew ? g.C.faint : g.C.orange, showNew ? 0.18 : 0.32));
          if (showNew) { const m = Math.floor(inflated.path.length * g.seg(p, 0.45, 0.75)); for (let i = 0; i < m; i++) cellDot(g, ...inflated.path[i], g.C.purple); }
          cellDot(g, ...start, g.C.blue, 0.42); cellDot(g, ...goal, g.C.green, 0.42);
          g.panel(970, 150, 280, 230);
          g.rect(990, 185, 26, 26, { fill: 'rgba(201,131,69,0.55)' }); g.text('紧邻障碍 +6', 1030, 206, { size: 20 });
          g.rect(990, 235, 26, 26, { fill: 'rgba(201,131,69,0.25)' }); g.text('两格内 +2', 1030, 256, { size: 20 });
          g.text('灰点：原最短路径', 990, 310, { size: 18, color: g.C.sub, alpha: showNew ? 1 : 0 });
          g.text('紫点：膨胀后的路径', 990, 345, { size: 18, color: g.C.purple, alpha: showNew ? 1 : 0 });
        }
      },
      {
        title: '前沿探索：下一步去哪看',
        say: '在未知环境里，机器人要自己决定往哪里探索。前沿是已知空闲区域和未知区域的交界，用黄色标出。对每段前沿，估计到达后能看到多少未知格子，也就是信息增益，再减去路程代价，选效用最高的那一段。机器人走过去再次扫描，地图就扩展了。找物体的任务还可以把语义先验加进效用里。',
        draw(g, p) {
          const moved = p > 0.6, known = moved ? known2 : known1;
          grid(g, known);
          if (!moved) fcl.forEach((f, i) => { f.cells.forEach(([r, c]) => g.rect(cx(c) + 3, cy(r) + 3, CS - 7, CS - 7, { fill: i === 0 ? g.C.gold : 'rgba(214,163,58,0.45)', r: 4 })); if (i < 3) g.text(`U=${f.U.toFixed(0)}`, cx(f.center[1]) - 10, cy(f.center[0]) - 6, { size: 17, weight: 700, color: i === 0 ? g.C.red : g.C.sub }); });
          const t = g.ease(g.seg(p, 0.42, 0.6));
          const rr = g.lerp(pos1[0], pos2[0], t), cc = g.lerp(pos1[1], pos2[1], t);
          g.robot(cx(cc) + CS / 2, cy(rr) + CS / 2, Math.atan2(pos2[0] - pos1[0], pos2[1] - pos1[1]), { r: 13 });
          g.panel(970, 140, 280, 260);
          g.formula('U(f) = 增益 − λ·距离', 985, 195, { size: 24 });
          g.text('增益 ≈ 可见未知格数', 990, 245, { size: 19 });
          g.text('λ 权衡远近', 990, 280, { size: 19 });
          g.text(moved ? '到达后重新扫描' : '选择 U 最大的前沿', 990, 340, { size: 22, weight: 700, color: g.C.red });
        }
      },
      {
        title: '小结',
        say: '回顾：占据栅格用对数几率把贝叶斯更新变成加法；A 星用可采纳的启发式高效找到最短路；代价地图让路径远离障碍；前沿探索按信息增益减路程代价选择下一个目标。语义导航和视觉语言导航都建立在这套几何栈之上，详见第十三章。',
        draw(g, p) {
          g.text('四个要点', 120, 140, { size: 34, weight: 700 });
          g.bullets(['占据栅格：对数几率加法更新，区分未知与空闲', 'A*：f = g + h，h 可采纳则最优', '代价地图膨胀：考虑机器人体积与定位误差', '前沿探索：效用 = 信息增益 − λ·路程'], 130, 220, p, { size: 28, gap: 70, step: 0.18 });
          g.text('延伸阅读：13 · 导航与视觉语言导航；03 · 规划算法表', 130, 540, { size: 22, color: g.C.sub, alpha: g.seg(p, 0.75, 0.85) });
        }
      }
    ]
  });
})();
