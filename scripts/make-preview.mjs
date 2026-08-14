#!/usr/bin/env node
/**
 * Собирает самодостаточную страницу-превью из готовой сборки.
 *
 * Артефакт публикуется под строгим CSP: внешние запросы блокируются, а
 * многостраничного роутинга там нет. Поэтому всё — стили, скрипты, шрифты,
 * текстура — вшивается в один файл, а внутренние ссылки обезвреживаются,
 * чтобы посетитель превью не упирался в 404.
 *
 *   node scripts/make-preview.mjs <страница> <файл-назначения> "<подпись>"
 */

import fs from 'node:fs';
import path from 'node:path';

const page = process.argv[2] || 'index.html';
const out = process.argv[3] || 'preview/home.html';
const note = process.argv[4] || 'Превью главной страницы';

const DIST = 'dist';
const src = path.join(DIST, page);
if (!fs.existsSync(src)) {
  console.error(`нет ${src} — сначала npm run build`);
  process.exit(1);
}

let html = fs.readFileSync(src, 'utf8');

const dataUri = (file, mime) =>
  `data:${mime};base64,${fs.readFileSync(path.join(DIST, file)).toString('base64')}`;

/* ---- 1. Стили: собрать, вшить шрифты и текстуру ------------------------ */

let css = '';
html = html.replace(
  /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g,
  (_m, href) => {
    css += fs.readFileSync(path.join(DIST, href), 'utf8') + '\n';
    return '';
  }
);
// Astro инлайнит часть стилей сам — забираем и их.
html = html.replace(/<style>([\s\S]*?)<\/style>/g, (_m, body) => {
  css += body + '\n';
  return '';
});

css = css.replace(/url\(['"]?\/fonts\/([^'")]+)['"]?\)/g, (_m, f) =>
  `url("${dataUri(`fonts/${f}`, 'font/woff2')}")`
);
css = css.replace(/url\(['"]?\/noise\.png['"]?\)/g, () =>
  `url("${dataUri('noise.png', 'image/png')}")`
);

/* ---- 2. Скрипты -------------------------------------------------------- */

// Каждый бандл остаётся отдельным модулем: у модулей своя область
// видимости, а склеенные в один файл они конфликтуют именами.
const modules = [];
html = html.replace(
  /<script[^>]+type="module"[^>]+src="([^"]+)"[^>]*><\/script>/g,
  (_m, s) => {
    const p = path.join(DIST, s);
    if (fs.existsSync(p)) modules.push(fs.readFileSync(p, 'utf8'));
    return '';
  }
);
// Инлайновые модули (их Astro пишет прямо в разметку).
html = html.replace(
  /<script type="module">([\s\S]*?)<\/script>/g,
  (_m, body) => {
    modules.push(body);
    return '';
  }
);

/* ---- 3. Достаём содержимое <body> и заголовок -------------------------- */

const title = (html.match(/<title>([^<]*)<\/title>/) || [, 'Мастерская'])[1]
  .replace(/\s*—\s*Мастерская$/, '');
const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/) || [, html])[1];
const bodyAttrs = (html.match(/<body([^>]*)>/) || [, ''])[1];
const topTheme = /data-top="ink"/.test(bodyAttrs) ? 'ink' : 'paper';

/* ---- 4. Собираем страницу --------------------------------------------- */

const banner = `
<div class="prev-note">
  <span class="prev-note__dot" aria-hidden="true"></span>
  <p><strong>${note}.</strong> Это один экран из сайта на 43 страницы —
  ссылки внутри превью намеренно выключены. Фотографии не загружены:
  на их местах стоят рамки с описанием будущего кадра.</p>
</div>`;

const shell = `<title>${title}</title>
<style>
${css}

/* ---- надстройка превью ------------------------------------------------ */
.prev-wrap {
  /* Токены живут на :root; в артефакте страница вложена, поэтому
     переносим окраску фона сюда. */
  background: var(--paper);
  color: var(--ink);
}
.prev-note {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.75rem var(--gutter);
  background: var(--ink);
  color: var(--ink-invert);
  font-size: 0.82rem;
  line-height: 1.5;
}
.prev-note p { max-width: 78ch; margin: 0; }
.prev-note strong { color: var(--accent-on-ink); }
.prev-note__dot {
  width: 0.5rem; height: 0.5rem; flex: none;
  margin-top: 0.42rem;
  border-radius: 50%;
  background: var(--accent-on-ink);
}
.prev-wrap .sticky-cta { display: none; }

/* На сайте инверсия шапки над тёмным экраном висит на body[data-top].
   В артефакте body чужой, поэтому те же правила повторяем на обёртке —
   иначе тёмный текст ляжет на тёмный герой. */
.prev-wrap[data-top='ink'] .hdr__bar {
  background: transparent;
  backdrop-filter: none;
  border-block-end-color: transparent;
}
.prev-wrap[data-top='ink'] .hdr { color: var(--ink-invert); }
.prev-wrap[data-top='ink'] .hdr__link,
.prev-wrap[data-top='ink'] .hdr__phone {
  color: color-mix(in srgb, var(--ink-invert) 82%, transparent);
}
.prev-wrap[data-top='ink'] .logo__tag {
  color: color-mix(in srgb, var(--ink-invert) 74%, transparent);
}
.prev-wrap[data-top='ink'] .hdr__cta {
  --btn-bg: var(--paper);
  --btn-fg: var(--ink);
  --btn-bd: var(--paper);
}
.prev-wrap[data-top='ink'] .hdr__burger { color: var(--ink-invert); }
/* И так же переносим подтяжку контента под шапку: без неё прозрачная
   шапка окажется на светлом фоне и её содержимое станет невидимым. */
.prev-wrap[data-top='ink'] main { margin-block-start: calc(var(--header-h) * -1); }
</style>

<div class="prev-wrap" data-top="${topTheme}">
${banner}
${body}
</div>

${modules.map((m) => `<script type="module">\n${m}\n</script>`).join('\n')}

<script>
// Ссылки на другие страницы в превью никуда не ведут — гасим переход,
// но оставляем видимую реакцию, чтобы это не выглядело поломкой.
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href^="/"]');
  if (!a) return;
  e.preventDefault();
  a.animate(
    [{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }],
    { duration: 420, easing: 'ease-in-out' }
  );
}, true);
</script>
`;

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, shell, 'utf8');
console.log(
  `${out}: ${(Buffer.byteLength(shell) / 1024 / 1024).toFixed(2)} МБ, заголовок «${title}»`
);
