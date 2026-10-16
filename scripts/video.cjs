/* Lesson video pipeline: narration (edge-tts) + canvas animation (headless browser) + burned-in subtitles -> MP4.
   Usage: node scripts/video.cjs [lesson-id-prefix ...] [--stills] [--fps=24]
   --stills renders one preview frame per scene into build/stills without TTS or encoding. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const lessonsDir = path.join(root, 'video', 'lessons'), outDir = path.join(root, 'videos');
const cacheDir = path.join(root, 'build', 'tts'), stillsDir = path.join(root, 'build', 'stills');
const args = process.argv.slice(2), flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const filters = args.filter(a => !a.startsWith('--'));
const FPS = Number(flags.fps || 24), RATE = 24000, LEAD = 0.35, TAIL = 0.7;
const VOICE = process.env.VIDEO_VOICE || 'zh-CN-YunxiNeural', SPEED = process.env.VIDEO_RATE || '+5%';
const isWin = process.platform === 'win32';
const venvBin = path.join(root, '.venv', isWin ? 'Scripts' : 'bin');

function findFfmpeg() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  const py = path.join(venvBin, isWin ? 'python.exe' : 'python');
  if (fs.existsSync(py)) {
    const r = spawnSync(py, ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return 'ffmpeg';
}
function findEdgeTts() {
  if (process.env.EDGE_TTS) return process.env.EDGE_TTS;
  const local = path.join(venvBin, isWin ? 'edge-tts.exe' : 'edge-tts');
  return fs.existsSync(local) ? local : 'edge-tts';
}
const FFMPEG = findFfmpeg(), EDGE_TTS = findEdgeTts();

const toSec = s => { const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/); return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000; };
const fmt = t => { const ms = Math.round(t * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };

function parseSrt(text) {
  return text.replace(/\r/g, '').split(/\n\n+/).map(b => b.trim().split('\n')).filter(l => l.length >= 3 && l[1].includes('-->'))
    .map(l => { const [a, b] = l[1].split('-->'); return { start: toSec(a), end: toSec(b), text: l.slice(2).join('') }; });
}

/* Split long sentence cues at punctuation so each subtitle fits in two short lines. */
function splitCue(c, max = 30) {
  const text = c.text.replace(/[。．]$/, '');
  if (text.length <= max) return [{ ...c, text }];
  const parts = text.split(/(?<=[，、；：,;:？！])/), chunks = [];
  let cur = '';
  for (const p of parts) { if (cur && (cur + p).length > max) { chunks.push(cur); cur = p; } else cur += p; }
  if (cur) chunks.push(cur);
  const total = chunks.reduce((s, x) => s + x.length, 0), out = [];
  let t = c.start;
  for (const ch of chunks) { const d = (c.end - c.start) * ch.length / total; out.push({ start: t, end: t + d, text: ch.replace(/[，、；：,;:]$/, '') }); t += d; }
  return out;
}

function decodePcm(file) {
  const r = spawnSync(FFMPEG, ['-v', 'error', '-i', file, '-f', 's16le', '-ac', '1', '-ar', String(RATE), '-'], { maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`ffmpeg decode failed for ${file}: ${r.stderr}`);
  return r.stdout;
}

function tts(text) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const key = crypto.createHash('sha1').update(`${VOICE}|${SPEED}|${text}`).digest('hex').slice(0, 16);
  const mp3 = path.join(cacheDir, key + '.mp3'), srt = path.join(cacheDir, key + '.srt'), txt = path.join(cacheDir, key + '.txt');
  const tryDecode = () => {
    if (!fs.existsSync(mp3) || !fs.existsSync(srt) || fs.statSync(mp3).size === 0) return null;
    try { return decodePcm(mp3); } catch { return null; }
  };
  let pcm = tryDecode();
  if (!pcm) {
    fs.writeFileSync(txt, text);
    let err = '';
    for (let attempt = 0; attempt < 6 && !pcm; attempt++) {
      if (attempt) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000 * attempt);
      fs.rmSync(mp3, { force: true }); fs.rmSync(srt, { force: true });
      const r = spawnSync(EDGE_TTS, ['--voice', VOICE, `--rate=${SPEED}`, '--file', txt, '--write-media', mp3, '--write-subtitles', srt], { encoding: 'utf8', timeout: 120000 });
      err = (r.stderr || r.error?.message || '').split('\n').filter(Boolean).slice(-1)[0] || '';
      if (r.status === 0) pcm = tryDecode();
    }
    if (!pcm) { fs.rmSync(mp3, { force: true }); fs.rmSync(srt, { force: true }); throw new Error(`edge-tts failed (${EDGE_TTS}): ${err}`); }
  }
  return { pcm, dur: pcm.length / 2 / RATE, cues: parseSrt(fs.readFileSync(srt, 'utf8')) };
}

function wav(pcm) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

async function openLesson(browser, file) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  page.on('pageerror', e => console.error(`[${path.basename(file)}] ${e.message}`));
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;background:#000}</style></head><body></body></html>');
  await page.addScriptTag({ path: path.join(root, 'video', 'engine.js') });
  await page.addScriptTag({ path: file });
  return page;
}

async function stills(page, info) {
  fs.mkdirSync(stillsDir, { recursive: true });
  const scenes = info.scenes.map(s => Math.max(s.min, s.say.length / 4.6 + LEAD + TAIL));
  let start = 0; const tl = { scenes: [], cues: [], total: scenes.reduce((a, b) => a + b, 0) };
  for (const d of scenes) { tl.scenes.push({ start, dur: d }); start += d; }
  await page.evaluate(t => setTimeline(t), tl);
  for (let i = 0; i < tl.scenes.length; i++) {
    for (const frac of [0.35, 0.85]) {
      const [b64] = await page.evaluate((t, f) => renderBatch(t, 1, f, 0.9), tl.scenes[i].start + tl.scenes[i].dur * frac, FPS);
      fs.writeFileSync(path.join(stillsDir, `${info.id}-${i}-${Math.round(frac * 100)}.jpg`), Buffer.from(b64, 'base64'));
    }
  }
}

async function render(page, info) {
  const timeline = { scenes: [], cues: [], total: 0 }, pcmParts = [];
  let start = 0;
  for (const [i, s] of info.scenes.entries()) {
    const a = tts(s.say);
    const dur = Math.max(s.min, LEAD + a.dur + TAIL);
    timeline.scenes.push({ start, dur });
    for (const c of a.cues) for (const x of splitCue(c)) timeline.cues.push({ start: start + LEAD + x.start, end: Math.min(start + dur, start + LEAD + x.end), text: x.text });
    pcmParts.push({ at: start + LEAD, pcm: a.pcm });
    process.stdout.write(`  scene ${i}: ${dur.toFixed(1)}s\n`);
    start += dur;
  }
  timeline.total = start;
  const audio = Buffer.alloc(Math.ceil(start * RATE) * 2);
  for (const p of pcmParts) p.pcm.copy(audio, Math.round(p.at * RATE) * 2, 0, Math.min(p.pcm.length, audio.length - Math.round(p.at * RATE) * 2));
  fs.mkdirSync(path.join(root, 'build'), { recursive: true });
  const wavFile = path.join(root, 'build', `${info.id}.wav`);
  fs.writeFileSync(wavFile, wav(audio));
  await page.evaluate(t => setTimeline(t), timeline);

  const out = path.join(outDir, `${info.id}.mp4`);
  const ff = spawn(FFMPEG, ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-i', wavFile,
    '-vf', 'scale=in_range=full:out_range=limited,format=yuv420p', '-color_range', 'tv',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '28', '-tune', 'animation', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', code => code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`))));
  const frames = Math.ceil(start * FPS), batch = 12;
  for (let f = 0; f < frames; f += batch) {
    const imgs = await page.evaluate((t0, n, fps) => renderBatch(t0, n, fps, 0.9), f / FPS, Math.min(batch, frames - f), FPS);
    for (const b64 of imgs) if (!ff.stdin.write(Buffer.from(b64, 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
    if (f % (FPS * 30) < batch) process.stdout.write(`  frames ${f}/${frames}\n`);
  }
  ff.stdin.end();
  await done;
  fs.writeFileSync(path.join(outDir, `${info.id}.srt`), timeline.cues.map((c, i) => `${i + 1}\n${fmt(c.start)} --> ${fmt(c.end)}\n${c.text}\n`).join('\n'));
  const [poster] = await page.evaluate(t => renderBatch(t, 1, 24, 0.85), timeline.scenes[0].dur * 0.9);
  fs.writeFileSync(path.join(outDir, `${info.id}.jpg`), Buffer.from(poster, 'base64'));
  fs.rmSync(wavFile, { force: true });
  return timeline.total;
}

function writeIndexPage(entries) {
  const mins = t => `${Math.floor(t / 60)} 分 ${String(Math.round(t % 60)).padStart(2, '0')} 秒`;
  const total = entries.reduce((s, e) => s + e.duration, 0);
  let md = `# 18 · 视频讲解：动画、配音与字幕\n\n> 每个视频聚焦一个核心知识点，用动画演示几何与算法过程，配中文语音讲解与烧录字幕；时长 2–4 分钟，适合先看视频建立直觉，再回到对应讲义看完整推导。共 ${entries.length} 个视频，总时长约 ${Math.round(total / 60)} 分钟。\n\n`;
  md += `## 视频目录\n\n|编号|主题|对应讲义|时长|\n|---|---|---|---|\n`;
  for (const e of entries) md += `|${e.id.slice(0, 3).toUpperCase()}|[${e.title}](#${e.anchor})|[${e.module}](${e.link})|${mins(e.duration)}|\n`;
  for (const e of entries) {
    md += `\n## ${e.title}\n\n${e.subtitle || ''}\n\n<video class="lesson-video" controls preload="metadata" poster="videos/${e.id}.jpg" src="videos/${e.id}.mp4"></video>\n\n`;
    md += `**分段：** ${e.scenes.filter(s => s.title).map((s, i) => `${i + 1}. ${s.title}`).join(' · ')}\n\n`;
    md += `对应讲义：[${e.module}](${e.link}) · 字幕文件：[${e.id}.srt](videos/${e.id}.srt) · 时长 ${mins(e.duration)}\n`;
  }
  md += `\n## 制作方式与重新生成\n\n视频由脚本自动生成，源文件都在仓库中：\n\n- \`video/lessons/*.js\`：每个视频的分镜。每个场景包含旁白文本 \`say\` 和一个 Canvas 绘制函数 \`draw(g, p)\`，p 为场景进度 0→1。\n- \`video/engine.js\`：绘图工具、标题栏、进度条与字幕渲染。\n- \`scripts/video.cjs\`：调用 edge-tts 合成中文语音并得到逐句时间轴，按语音长度安排场景时长，在无头浏览器中逐帧渲染，再用 ffmpeg 编码为 H.264 MP4，同时导出 SRT 字幕与封面，最后重新生成本页。\n\n\`\`\`bash\npython -m venv .venv\n.venv/Scripts/pip install edge-tts imageio-ffmpeg   # macOS / Linux 使用 .venv/bin/pip\nnpm run video                 # 生成全部视频\nnpm run video -- v05          # 只生成编号前缀为 v05 的视频\nnpm run video -- --stills     # 只导出每个场景的预览帧到 build/stills\nnpm run build\n\`\`\`\n\n语音合成需要联网访问 edge-tts 服务；可用环境变量 \`VIDEO_VOICE\`（如 zh-CN-XiaoxiaoNeural）与 \`VIDEO_RATE\`（如 +10%）调整音色和语速，\`FFMPEG_PATH\`、\`EDGE_TTS\` 指定可执行文件。修改旁白后重新运行即可，未改动的语音会使用 \`build/tts\` 缓存。\n\n动画是教学示意：数值多为演示用的简化参数，严格的定义、假设与推导以对应讲义为准。\n`;
  fs.writeFileSync(path.join(root, '18_视频讲解.md'), md);
}

(async () => {
  const files = fs.readdirSync(lessonsDir).filter(f => f.endsWith('.js')).sort()
    .filter(f => !filters.length || filters.some(x => f.startsWith(x)));
  if (!files.length) throw new Error('no lesson matched');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await require('./browser.cjs').launch();
  const manifestFile = path.join(root, 'video', 'manifest.json');
  const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
  const failed = [];
  try {
    for (const f of files) {
      const page = await openLesson(browser, path.join(lessonsDir, f));
      try {
        const info = await page.evaluate(() => lessonInfo());
        console.log(`${info.id} · ${info.title}`);
        if (flags.stills) await stills(page, info);
        else {
          const t0 = Date.now(), duration = await render(page, info);
          manifest[info.id] = { ...info, duration, scenes: info.scenes.map(s => ({ title: s.title })) };
          fs.writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
          console.log(`  -> videos/${info.id}.mp4 ${duration.toFixed(1)}s (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
        }
      } catch (e) { failed.push(f); console.error(`  !! ${f}: ${e.message}`); }
      await page.close();
    }
  } finally { await browser.close(); }
  if (failed.length) { console.error(`failed: ${failed.join(', ')} (rerun with these ids)`); process.exitCode = 1; }
  if (!flags.stills) {
    const slug = s => s.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-');
    const entries = Object.values(manifest).filter(e => fs.existsSync(path.join(outDir, `${e.id}.mp4`))).sort((a, b) => a.id.localeCompare(b.id)).map(e => ({ ...e, anchor: slug(e.title) }));
    writeIndexPage(entries);
    console.log(`wrote 18_视频讲解.md with ${entries.length} videos`);
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
