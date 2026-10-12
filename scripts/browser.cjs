const fs = require('node:fs');
const puppeteer = require('puppeteer');
exports.launch = () => {
  const configured = process.env.PUPPETEER_EXECUTABLE_PATH;
  const edge = process.platform === 'win32' && 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const executablePath = configured || (edge && fs.existsSync(edge) ? edge : undefined);
  return puppeteer.launch({ headless: true, executablePath, args: ['--disable-gpu', '--no-sandbox'] });
};
