const fs = require('node:fs'), path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
const files = fs.readdirSync(root).filter(f => f.endsWith('.html'));
const errors = [];
for (const file of files) {
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  if (/ATLASCHUNK\d+END|katex-error/.test(html)) errors.push(`${file}: unrendered content`);
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = match[1].replaceAll('&amp;', '&');
    if (/^(https?:|data:|mailto:)/.test(url)) continue;
    const [target, hash] = url.split('#');
    const dest = path.resolve(root, decodeURIComponent(target || file));
    if (!dest.startsWith(root + path.sep) || !fs.existsSync(dest)) errors.push(`${file}: missing ${url}`);
    else if (hash && dest.endsWith('.html') && !fs.readFileSync(dest, 'utf8').includes(`id="${decodeURIComponent(hash)}"`)) errors.push(`${file}: missing anchor ${url}`);
  }
}
async function browserChecks() {
  const browser = await require('./browser.cjs').launch();
  try {
    const page = await browser.newPage();
    page.on('pageerror', e => errors.push(e.message));
    page.on('requestfailed', r => errors.push(`request failed: ${r.url()}`));
    page.on('request', r => { if (/^https?:/.test(r.url())) errors.push(`offline page requests network: ${r.url()}`); });
    for (const width of [1440, 390]) {
      await page.setViewport({ width, height: 1000 });
      for (const file of files) {
        await page.goto(pathToFileURL(path.join(root, file)).href);
        await page.evaluate(() => document.fonts.ready);
        const issues = await page.evaluate(() => ({
          broken: [...document.images].filter(i => i.hasAttribute('src') && (!i.complete || !i.naturalWidth)).length,
          overflow: document.documentElement.scrollWidth > innerWidth + 2,
          wrappers: [...document.querySelectorAll('details.derivation')].every(d => !!d.querySelector(':scope > div'))
        }));
        if (issues.broken || issues.overflow || !issues.wrappers) errors.push(`${file} at ${width}px: ${JSON.stringify(issues)}`);
      }
    }
    await page.goto(pathToFileURL(path.join(root, '02_AI与深度学习.html')).href);
    await page.click('#brief-mode');
    if (await page.$('details.derivation[open]')) errors.push('brief mode failed');
    await page.click('#detail-mode');
    if (await page.$('details.derivation:not([open])')) errors.push('detail mode failed');
    await page.click('.diagram img');
    if (!await page.$eval('#zoom', d => d.open)) errors.push('diagram zoom failed');
    await page.click('#zoom button');
    await page.goto(pathToFileURL(path.join(root, '10_交互实验.html')).href);
    await page.click('#causal');
    if (!await page.$eval('#attention-output', e => e.textContent.includes('[1.000, 0.000, 0.000, 0.000]'))) errors.push('attention numerical check failed');
    await page.$eval('#q2', e => { e.value = '0'; e.dispatchEvent(new Event('input')); });
    if (!await page.$eval('#arm-output', e => e.textContent.includes('接近奇异'))) errors.push('arm singularity check failed');
    if (!await page.$eval('#memory-output', e => e.textContent.includes('0.500 GiB'))) errors.push('KV estimate check failed');
  } finally { await browser.close(); }
}
(async () => {
  if (process.argv.includes('--browser')) await browserChecks();
  console.log(JSON.stringify({ pages: files.length, browser: process.argv.includes('--browser'), errors }, null, 2));
  if (errors.length) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
