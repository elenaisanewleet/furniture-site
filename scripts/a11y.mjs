#!/usr/bin/env node
/**
 * Accessibility gate.
 *
 * Runs axe-core over the built site at both a phone and a desktop viewport,
 * in light and dark schemes. Exits non-zero on any violation, so it can sit
 * in CI next to the type check.
 *
 *   npm run build && npm run preview   # in one terminal
 *   npm run a11y                       # in another
 */

import fs from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const BASE = process.env.A11Y_BASE || 'http://localhost:4321';
const CHROME =
  process.env.CHROME_PATH ||
  '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const PAGES = [
  '/', '/uslugi/', '/mebel-na-zakaz/', '/remont-mebeli/', '/furnitura/',
  '/furnitura/petli/', '/detali-na-zakaz/', '/proekty/',
  '/proekty/vstroennyi-shkaf-v-nishu/', '/pokazat-zadachu/',
  '/chto-sluchilos/', '/journal/', '/journal/provisla-dvertsa-shkafa/',
  '/faq/', '/kontakty/', '/o-mastere/', '/404',
];

const MODES = [
  { label: 'mobile/light', width: 390, height: 844, colorScheme: 'light' },
  { label: 'desktop/light', width: 1440, height: 900, colorScheme: 'light' },
  { label: 'desktop/dark', width: 1440, height: 900, colorScheme: 'dark' },
];

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'];

const browser = await chromium.launch({
  executablePath: fs.existsSync(CHROME) ? CHROME : undefined,
  args: ['--no-sandbox'],
});

let failures = 0;
let checked = 0;

for (const mode of MODES) {
  const ctx = await browser.newContext({
    viewport: { width: mode.width, height: mode.height },
    colorScheme: mode.colorScheme,
  });
  const page = await ctx.newPage();

  for (const path of PAGES) {
    const res = await page.goto(BASE + path, { waitUntil: 'networkidle' });
    // The 404 page is supposed to answer 404 — that is the page under test.
    const expected = path === '/404' ? 404 : 200;
    if (!res || res.status() !== expected) {
      console.error(`✗ ${mode.label} ${path} → HTTP ${res?.status()}`);
      failures += 1;
      continue;
    }
    checked += 1;
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(
      async (tags) => await window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
      TAGS
    );

    if (result.violations.length) {
      failures += result.violations.length;
      console.error(`\n✗ ${mode.label} ${path}`);
      for (const v of result.violations) {
        console.error(`   ${String(v.impact).padEnd(8)} ${v.id}: ${v.help} (${v.nodes.length})`);
        console.error(`      → ${v.nodes[0].html.slice(0, 140).replace(/\s+/g, ' ')}`);
        if (v.nodes[0].any?.[0]?.message) {
          console.error(`      ${v.nodes[0].any[0].message.replace(/\s+/g, ' ')}`);
        }
      }
    }
  }
  await ctx.close();
}

await browser.close();

if (failures) {
  console.error(`\n${failures} violation group(s) across ${checked} page loads`);
  process.exit(1);
}
console.log(`✓ no accessibility violations (${checked} page loads)`);
