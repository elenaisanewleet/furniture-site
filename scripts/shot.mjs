#!/usr/bin/env node
/**
 * Скриншоты собранных страниц — чтобы смотреть на вёрстку, а не на догадки.
 *
 *   node scripts/shot.mjs <путь> [ширина] [файл] [--full] [--dark]
 *
 * Поднимает статический сервер над dist/ с честным charset: без него
 * кириллица приезжает крокозябрами и вся страница выглядит сломанной.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith('--')));
const pos = args.filter((a) => !a.startsWith('--'));

const route = pos[0] || '/';
const width = Number(pos[1] || 1280);
const out = pos[2] || 'shot.png';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let p = path.join('dist', decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
  if (!fs.existsSync(p)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('404');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const CHROME =
  process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
});
const page = await browser.newPage({
  viewport: { width, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: flags.has('--dark') ? 'dark' : 'light',
});

await page.goto(base + route, { waitUntil: 'networkidle' });
// Рисунки прочерчиваются по мере появления в кадре — прокручиваем всё,
// иначе на длинной странице половина листов останется пустой.
await page.evaluate(async () => {
  // Плавная прокрутка сайта здесь во вред: scrollTo встают в очередь
  // анимаций, страница не успевает пройти мимо блоков и половина листов
  // остаётся непрочерченной.
  document.documentElement.style.scrollBehavior = 'auto';
  const step = innerHeight * 0.7;
  for (let y = 0; y < document.body.scrollHeight; y += step) {
    scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 200));
  }
  scrollTo(0, 0);
});
await page.waitForTimeout(1600);

fs.mkdirSync(path.dirname(out) || '.', { recursive: true });
await page.screenshot({ path: out, fullPage: flags.has('--full') });

await browser.close();
server.close();
console.log(`${out} — ${route} @ ${width}px${flags.has('--dark') ? ' (тёмная)' : ''}`);
