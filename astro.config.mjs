// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/**
 * Demo project pages carry `placeholder: true`: they are labelled on-page and
 * set to noindex, so they must not be advertised in the sitemap either.
 */
function placeholderProjectUrls() {
  const dir = fileURLToPath(new URL('./src/content/projects', import.meta.url));
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .filter((f) =>
      /^placeholder:\s*true\s*$/m.test(fs.readFileSync(path.join(dir, f), 'utf8'))
    )
    .map((f) => `/proekty/${path.basename(f, '.md')}/`);
}

const EXCLUDED = new Set([
  '/review/',
  '/spasibo/',
  '/soglasie/',
  ...placeholderProjectUrls(),
]);

/**
 * Production origin. Override with SITE_URL at build time:
 *   SITE_URL=https://example.ru npm run build
 *
 * На Vercel до появления своего домена SITE_URL задавать не нужно: адрес
 * берётся из системной переменной. Важно, что это именно
 * VERCEL_PROJECT_PRODUCTION_URL, а не VERCEL_URL — второй уникален для
 * каждой выкладки, и canonical на нём менялся бы после каждого коммита,
 * то есть указывал бы на адрес, которого через день уже нет.
 *
 * Пока адрес временный, сайт закрыт от индексации — см. src/lib/origin.ts.
 */
const VERCEL_HOST = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const SITE =
  process.env.SITE_URL ||
  (VERCEL_HOST ? `https://${VERCEL_HOST}` : null) ||
  'https://masterskaya.example.ru';

export default defineConfig({
  site: SITE,
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  integrations: [
    sitemap({
      filter: (page) => !EXCLUDED.has(new URL(page).pathname),
      i18n: undefined,
      changefreq: 'weekly',
      lastmod: new Date(),
      serialize(item) {
        const u = new URL(item.url);
        const path = u.pathname;
        // Priority mirrors the commercial hierarchy, not page depth.
        if (path === '/') item.priority = 1.0;
        else if (/^\/(pokazat-zadachu|remont-mebeli|furnitura|mebel-na-zakaz)\/$/.test(path))
          item.priority = 0.9;
        else if (/^\/journal\//.test(path)) item.priority = 0.5;
        else if (/^\/(privacy)\//.test(path)) item.priority = 0.2;
        else item.priority = 0.7;
        return item;
      },
    }),
  ],
  image: {
    // Keep the build light: we ship pre-sized assets rather than
    // asking sharp to fan out dozens of variants per photo.
    responsiveStyles: true,
  },
  vite: {
    resolve: {
      alias: {
        '~': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      cssCodeSplit: false,
    },
  },
});
