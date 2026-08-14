#!/usr/bin/env node
/**
 * Упаковывает весь собранный сайт в один самодостаточный HTML-файл.
 *
 * Нужно, чтобы показать работающий сайт там, где нет хостинга: строгий CSP
 * блокирует любые внешние запросы, а нескольких файлов отдать нельзя.
 * Поэтому стили, шрифты, текстура и разметка всех страниц вшиваются внутрь,
 * а переходы между страницами делает маленький роутер на клиенте.
 *
 * Сам сайт при этом не меняется: в бандл попадает ровно то, что собрал
 * Astro, включая всю клиентскую обвязку. Она уже идемпотентна, потому что
 * рассчитана на переходы без перезагрузки, — этим роутер и пользуется.
 *
 *   npm run build && node scripts/make-site-bundle.mjs
 */

import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const OUT = process.argv[2] || 'preview/glavnaya.html';
const HOME = '/';

if (!fs.existsSync(DIST)) {
  console.error('нет dist/ — сначала npm run build');
  process.exit(1);
}

/* ------------------------------------------------------------ утилиты ---- */

const dataUri = (file, mime) =>
  `data:${mime};base64,${fs.readFileSync(path.join(DIST, file)).toString('base64')}`;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

/* ---------------------------------------------- 1. стили, шрифты, фон ---- */

let css = '';
const cssFiles = new Set();
const modules = new Map(); // src → код, чтобы одинаковые бандлы не дублировать

/* ------------------------------------------------------- 2. страницы ---- */

const pages = {};
let firstTitle = 'Мастерская';

for (const file of walk(DIST).sort()) {
  let html = fs.readFileSync(file, 'utf8');

  const url =
    '/' +
    path
      .relative(DIST, file)
      .replace(/index\.html$/, '')
      .replace(/\\/g, '/');

  // Служебные и системные страницы в бандл не нужны.
  if (url.startsWith('/review/') || url.startsWith('/admin/')) continue;

  // Стили: внешние собираем один раз, инлайновые — как есть.
  html = html.replace(
    /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/g,
    (_m, href) => {
      if (!cssFiles.has(href)) {
        cssFiles.add(href);
        css += fs.readFileSync(path.join(DIST, href), 'utf8') + '\n';
      }
      return '';
    }
  );
  html = html.replace(/<style>([\s\S]*?)<\/style>/g, (_m, body) => {
    if (!cssFiles.has(body)) {
      cssFiles.add(body);
      css += body + '\n';
    }
    return '';
  });

  // Скрипты: каждый бандл — отдельный модуль, дубликаты отбрасываем.
  html = html.replace(
    /<script[^>]+type="module"[^>]+src="([^"]+)"[^>]*><\/script>/g,
    (_m, src) => {
      const p = path.join(DIST, src);
      if (!modules.has(src) && fs.existsSync(p)) {
        modules.set(src, fs.readFileSync(p, 'utf8'));
      }
      return '';
    }
  );
  html = html.replace(/<script type="module">([\s\S]*?)<\/script>/g, (_m, body) => {
    if (!modules.has(body)) modules.set(body, body);
    return '';
  });
  // Разметка структурированных данных внутри бандла бесполезна.
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '');

  const title = (html.match(/<title>([^<]*)<\/title>/) || [, 'Мастерская'])[1];
  const bodyAttrs = (html.match(/<body([^>]*)>/) || [, ''])[1];
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/) || [, ''])[1];

  pages[url] = {
    title,
    top: /data-top="ink"/.test(bodyAttrs) ? 'ink' : 'paper',
    html: body.trim(),
  };
  if (url === HOME) firstTitle = title;
}

css = css
  .replace(/url\(['"]?\/fonts\/([^'")]+)['"]?\)/g, (_m, f) =>
    `url("${dataUri(`fonts/${f}`, 'font/woff2')}")`
  )
  .replace(/url\(['"]?\/noise\.png['"]?\)/g, () => `url("${dataUri('noise.png', 'image/png')}")`);

/* --------------------------------------------------------- 3. сборка ---- */

const shell = `<title>Покажите задачу</title>
<style>
${css}

/* ---- надстройка бандла ------------------------------------------------- */
.site-root { background: var(--paper); color: var(--ink); }

/* Инверсия шапки над тёмным первым экраном на сайте висит на body[data-top].
   Здесь body чужой, поэтому те же правила повторяем на корне бандла. */
.site-root[data-top='ink'] .hdr__bar {
  background: transparent;
  backdrop-filter: none;
  border-block-end-color: transparent;
}
.site-root[data-top='ink'] .hdr { color: var(--ink-invert); }
.site-root[data-top='ink'] .hdr__link,
.site-root[data-top='ink'] .hdr__phone {
  color: color-mix(in srgb, var(--ink-invert) 82%, transparent);
}
.site-root[data-top='ink'] .logo__tag {
  color: color-mix(in srgb, var(--ink-invert) 74%, transparent);
}
.site-root[data-top='ink'] .hdr__cta {
  --btn-bg: var(--paper);
  --btn-fg: var(--ink);
  --btn-bd: var(--paper);
}
.site-root[data-top='ink'] .hdr__burger { color: var(--ink-invert); }
.site-root[data-top='ink'] main { margin-block-start: calc(var(--header-h) * -1); }

/* Липкая шапка внутри вложенной страницы ведёт себя непредсказуемо. */
.site-root .hdr { position: relative; }

.bundle-note {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.7rem var(--gutter);
  background: var(--ink);
  color: var(--ink-invert);
  font-size: 0.8rem;
  line-height: 1.5;
}
.bundle-note p { max-width: 80ch; margin: 0; }
.bundle-note b { color: var(--accent-on-ink); font-weight: 650; }
.bundle-note span {
  width: 0.5rem; height: 0.5rem; flex: none; margin-top: 0.4rem;
  border-radius: 50%; background: var(--accent-on-ink);
}
</style>

<div class="bundle-note">
  <span aria-hidden="true"></span>
  <p><b>Демонстрационная сборка сайта.</b> Все страницы внутри одного файла,
  переходы работают. Фотографий нет — на их местах рамки с описанием
  будущего кадра. Форма заявки не отправляется: обработчик не подключён.</p>
</div>

<div class="site-root" data-top="${pages[HOME]?.top || 'paper'}" data-site-root>
${pages[HOME]?.html || '<p>Главная не найдена</p>'}
</div>

<script id="site-pages" type="application/json">${JSON.stringify(pages).replace(/</g, '\\u003c')}</script>

${[...modules.values()].map((m) => `<script type="module">\n${m}\n</script>`).join('\n')}

<script>
/**
 * Роутер бандла.
 *
 * Подменяет содержимое корня и заново запускает клиентскую обвязку сайта —
 * ту же, что работает при переходах без перезагрузки. Перехват идёт в фазе
 * захвата, чтобы штатный роутер Astro не попытался сходить в сеть.
 */
(function () {
  var pages = JSON.parse(document.getElementById('site-pages').textContent);
  var root = document.querySelector('[data-site-root]');
  var baseTitle = document.title;

  function normalise(href) {
    try {
      var u = new URL(href, 'http://x' + location.pathname);
      var p = u.pathname;
      if (!p.endsWith('/') && !p.includes('.')) p += '/';
      return p;
    } catch (e) {
      return null;
    }
  }

  function show(path, push) {
    var page = pages[path];
    if (!page) return false;

    root.innerHTML = page.html;
    root.setAttribute('data-top', page.top);
    document.title = page.title;

    // Модальное окно живёт внутри страницы — после подмены оно новое.
    document.body.style.overflow = '';

    // Та же точка входа, что и при обычных переходах на сайте.
    document.dispatchEvent(new Event('astro:page-load'));

    if (push) history.pushState({ path: path }, '', '#' + path);
    root.scrollIntoView({ block: 'start', behavior: 'auto' });
    return true;
  }

  document.addEventListener(
    'click',
    function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a) return;

      var href = a.getAttribute('href');
      if (!href || href.startsWith('#') || /^(tel:|mailto:|https?:)/.test(href)) return;

      e.preventDefault();
      e.stopPropagation();

      var path = normalise(href);
      if (!show(path, true)) {
        // Страницы нет в сборке — гасим переход заметно, но без ошибки.
        a.animate([{ opacity: 1 }, { opacity: 0.3 }, { opacity: 1 }], {
          duration: 420,
          easing: 'ease-in-out',
        });
      }
    },
    true
  );

  addEventListener('popstate', function () {
    var path = location.hash.slice(1) || '/';
    show(path, false);
  });

  if (location.hash.length > 1) show(location.hash.slice(1), false);
  document.title = baseTitle;
})();
</script>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, shell, 'utf8');

console.log(
  `${OUT}: ${Object.keys(pages).length} страниц, ${(Buffer.byteLength(shell) / 1024 / 1024).toFixed(2)} МБ`
);
