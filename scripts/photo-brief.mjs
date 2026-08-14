#!/usr/bin/env node
/**
 * Regenerates docs/PHOTO-BRIEF.md — the shot list.
 *
 * Slot names come from the built HTML (every <Photo> emits data-slot), so the
 * list is exactly what the site actually renders. Briefs and alt text come
 * from the sources that declare them. Run after a build:
 *
 *   npm run build && npm run photos
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src');
const PHOTO_DIR = path.join(ROOT, 'public', 'photo');
const OUT = path.join(ROOT, 'docs', 'PHOTO-BRIEF.md');

if (!fs.existsSync(DIST)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

/* ---- 1. Which slots does the site actually render, and where? ----------- */

const usage = new Map(); // name -> Set(url)

function walk(dir, fn) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, fn);
    else fn(p);
  }
}

walk(DIST, (file) => {
  if (!file.endsWith('.html')) return;
  const html = fs.readFileSync(file, 'utf8');
  const url =
    '/' +
    path
      .relative(DIST, file)
      .replace(/index\.html$/, '')
      .replace(/\\/g, '/');
  for (const m of html.matchAll(/data-slot="([^"]+)"/g)) {
    if (!usage.has(m[1])) usage.set(m[1], new Set());
    usage.get(m[1]).add(url);
  }
});

/* ---- 2. Pull alt + brief + ratio from wherever they are declared -------- */

const meta = new Map(); // name -> {alt, brief, ratio}

const strip = (s) =>
  s
    .trim()
    .replace(/^["'](.*)["']$/s, '$1')
    .replace(/\\"/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

function harvest(text) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    // YAML/object form:  name: service-repair   |   name: 'x'
    // JSX prop form:     name="service-repair"
    const m =
      lines[i].match(/^\s*-?\s*name:\s*(.+?)\s*,?\s*$/) ||
      lines[i].match(/\bname=["']([^"']+)["']/);
    if (!m) continue;
    const name = strip(m[1]);
    if (!/^[a-z0-9-]+$/i.test(name)) continue;

    // Look a few lines ahead for the sibling fields of the same slot.
    const win = lines.slice(i, i + 8).join('\n');
    // Values may be quoted (JS objects, JSX props) or bare (YAML scalars).
    const pick = (key) => {
      const quoted = win.match(
        new RegExp(`\\b${key}[:=]\\s*(["'])((?:\\\\.|(?!\\1).)*)\\1`, 's')
      );
      if (quoted) return strip(quoted[2]);
      const bare = win.match(new RegExp(`\\b${key}:\\s*([^\\n]+)`));
      return bare ? strip(bare[1].replace(/,\s*$/, '')) : '';
    };

    const prev = meta.get(name) || {};
    meta.set(name, {
      alt: prev.alt || pick('alt'),
      brief: prev.brief || pick('brief'),
      ratio: prev.ratio || pick('ratio'),
    });
  }
}

walk(SRC, (f) => {
  if (/\.(md|astro|ts)$/.test(f)) harvest(fs.readFileSync(f, 'utf8'));
});

/* ---- 3. Which slots already have a real photograph? -------------------- */

const have = new Set();
if (fs.existsSync(PHOTO_DIR)) {
  for (const f of fs.readdirSync(PHOTO_DIR)) {
    have.add(path.basename(f, path.extname(f)));
  }
}

/* ---- 4. Emit ------------------------------------------------------------ */

const names = [...usage.keys()].sort();
const missing = names.filter((n) => !have.has(n));

const STYLE = `## Общий стиль съёмки

Перед работой прочитайте **\`docs/WORKSHOP-REFERENCE.md\`** — там описано,
как выглядит именно эта мастерская: сосновая вагонка на стенах, бетонный
пол, самодельные верстаки, тёплый свет лампы, старые крашеные станки и
полки с крепежом, разобранным по банкам и коробкам.

Это описание составлено по фотографиям владельца. Сами фотографии не
публикуются — они только источник достоверности.

**Что нужно**

\`\`\`
documentary workshop photography, small private workshop,
pine tongue-and-groove walls, concrete floor, homemade workbenches,
warm incandescent light with some daylight, honey-brown wood tones,
galvanised hardware, glass jars and plastic bins of screws,
old repainted machines, sawdust and worn paint,
35mm or 50mm lens, subtle depth of field, unposed, non-stock
\`\`\`

**Чего быть не должно**

\`\`\`
luxury interiors, marble, large bright industrial workshop,
brand-new shiny machines, empty tidy benches, people in white,
staged smiles, CGI render look, perfect symmetry, showroom lighting,
watermark, text, HDR glow, obvious AI artifacts
(wrong hinge geometry, melted hardware, extra fingers)
\`\`\`

**Контекст клиента**

Заказчик живёт в обычной ульяновской квартире: типовой дом, обои,
натяжной потолок, узкий коридор, кухня 6–9 м². Мебель на кадрах —
настоящая, бывшая в употреблении.

**Люди**

Лицо мастера не публикуется до его согласия. Снимайте руки, работу с
инструментом, вид со спины, детали процесса. Слот \`master-portrait\`
заменяется настоящим портретом позже.

## Как подставить настоящую фотографию

1. Назовите файл так же, как слот: \`hero-workshop.webp\`.
2. Положите в \`public/photo/\`.
3. Пересоберите сайт.

Вёрстку менять не нужно: компонент сам увидит файл и заменит заглушку.
Пропорции указаны для каждого слота — кадрируйте по ним, иначе снимок
обрежется по центру. Форматы: \`.webp\` (предпочтительно), \`.avif\`,
\`.jpg\`, \`.png\`.

Пакетный импорт с очисткой EXIF, сжатием и генерацией размытых заглушек:
\`node scripts/ingest-photos.mjs <папка>\` (карта слотов внутри скрипта).
`;

let md = `# Брифы на фотографии

Файл сгенерирован: \`npm run photos\`. Не редактируйте вручную —
правьте \`brief\` в исходниках и перегенерируйте.

**Всего слотов: ${names.length}. Загружено: ${names.length - missing.length}. Осталось: ${missing.length}.**

${STYLE}

---

## Список слотов

`;

for (const name of names) {
  const m = meta.get(name) || {};
  const done = have.has(name);
  const where = [...(usage.get(name) || [])].sort();
  md += `### \`${name}.webp\`${done ? ' ✅ загружено' : ''}\n\n`;
  md += `| | |\n|---|---|\n`;
  md += `| Пропорции | \`${m.ratio || '3/2'}\` |\n`;
  md += `| Alt | ${m.alt || '—'} |\n`;
  md += `| Страницы | ${where.map((w) => `\`${w}\``).join(', ') || '—'} |\n\n`;
  md += `${m.brief || '_Бриф не задан — добавьте `brief` рядом со слотом в исходнике._'}\n\n`;
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, md, 'utf8');
console.log(
  `docs/PHOTO-BRIEF.md: ${names.length} слотов, ${missing.length} без фотографии`
);
