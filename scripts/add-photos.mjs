#!/usr/bin/env node
/**
 * Подставить фотографии в слоты сайта.
 *
 *   node scripts/add-photos.mjs <папка>
 *
 * Файл должен называться именем слота: `workshop-room.jpg`, `eq-press.png`.
 * Пропорции берутся из docs/PHOTO-BRIEF.md, то есть из самой вёрстки, —
 * поэтому кадр обрежется ровно так, как его ждёт страница, а не как
 * пришлось.
 *
 * Что делается с каждым файлом:
 *   • снимаются метаданные. В снимке с телефона лежат GPS-координаты и
 *     серийный номер аппарата; выкладывать их в открытый доступ нельзя,
 *     а увидеть их в готовой картинке невозможно — о них просто забывают;
 *   • кадрируется по пропорциям слота стратегией attention: она оставляет
 *     самую насыщенную часть кадра, а не геометрический центр, — иначе у
 *     вертикального снимка отрежется то, ради чего он снят;
 *   • пишется webp и размытая заглушка в 24px, чтобы при загрузке страница
 *     не дёргалась.
 */

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
const OUT = 'public/photo';
const LQIP_FILE = 'src/data/lqip.json';
const BRIEF = 'docs/PHOTO-BRIEF.md';

if (!SRC || !fs.existsSync(SRC)) {
  console.error('Укажите папку с файлами: node scripts/add-photos.mjs <папка>');
  process.exit(1);
}

/* ---- Пропорции слотов — из брифа, а не из головы --------------------- */

const brief = fs.readFileSync(BRIEF, 'utf8');
const RATIO = new Map();
// Разбором по разделителю, а не регуляркой с заглядыванием вперёд: у неё
// последний слот в файле терялся бы — за ним нет следующего заголовка.
for (const chunk of brief.split(/^### /m).slice(1)) {
  const slot = chunk.match(/^`(.+?)\.webp`/);
  const ratio = chunk.match(/\|\s*Пропорции\s*\|\s*`([^`]+)`/);
  if (slot && ratio) RATIO.set(slot[1], ratio[1].trim());
}
if (!RATIO.size) {
  console.error(`не удалось прочитать пропорции из ${BRIEF} — сначала npm run photos`);
  process.exit(1);
}

/* ---- Обработка -------------------------------------------------------- */

fs.mkdirSync(OUT, { recursive: true });
const lqip = fs.existsSync(LQIP_FILE) ? JSON.parse(fs.readFileSync(LQIP_FILE, 'utf8')) : {};

const files = fs.readdirSync(SRC).filter((f) => /\.(jpe?g|png|webp|avif|heic)$/i.test(f));
const done = [];
const unknown = [];

for (const file of files) {
  const slot = path.basename(file, path.extname(file));
  const ratio = RATIO.get(slot);
  if (!ratio) {
    unknown.push(file);
    continue;
  }

  const [rw, rh] = ratio.split('/').map(Number);
  const width = 1600;
  const height = Math.round((width * rh) / rw);
  const src = path.join(SRC, file);

  await sharp(src)
    .rotate() // по ориентации из EXIF — до того, как метаданные снимутся
    .resize(width, height, { fit: 'cover', position: sharp.strategy.attention })
    .webp({ quality: 82, effort: 5 })
    .toFile(path.join(OUT, `${slot}.webp`));

  const blur = await sharp(src)
    .rotate()
    .resize(24, Math.max(1, Math.round((24 * rh) / rw)), { fit: 'cover' })
    .webp({ quality: 42 })
    .toBuffer();
  lqip[slot] = `data:image/webp;base64,${blur.toString('base64')}`;

  const kb = (fs.statSync(path.join(OUT, `${slot}.webp`)).size / 1024).toFixed(0);
  done.push(`${slot}  ${ratio.padEnd(5)} ${kb} КБ`);
}

fs.writeFileSync(LQIP_FILE, JSON.stringify(lqip, null, 2) + '\n');

/* ---- Отчёт ------------------------------------------------------------ */

console.log(`\nПодставлено: ${done.length}`);
for (const d of done) console.log('  ' + d);

if (unknown.length) {
  console.log(`\nНе понял, куда положить (имя файла ≠ имя слота): ${unknown.length}`);
  for (const u of unknown) console.log('  ' + u);
  console.log('\nСписок слотов — в docs/PHOTO-BRIEF.md. Переименуйте и запустите снова.');
}

const filled = fs.readdirSync(OUT).filter((f) => f.endsWith('.webp')).length;
console.log(`\nВсего слотов: ${RATIO.size}. С фотографией: ${filled}. Остальные — рисунками.`);
