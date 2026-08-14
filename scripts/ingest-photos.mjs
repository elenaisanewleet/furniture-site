#!/usr/bin/env node
/**
 * One-off ingest for the workshop photographs.
 *
 * Phone photos carry GPS coordinates and device serials in EXIF. sharp drops
 * all metadata unless asked to keep it, so everything written here is clean.
 *
 * For each slot we emit:
 *   public/photo/<slot>.webp   — display image, long side capped
 *   src/data/lqip.json         — 24px blurred placeholder as a data URI,
 *                                used for blur-up so nothing pops in
 *
 * Landscape slots are cropped from portrait originals using sharp's
 * attention strategy, which keeps the busiest region rather than the centre.
 *
 *   node scripts/ingest-photos.mjs <source-dir>
 */

import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] || '/tmp/mast';
const OUT = 'public/photo';
const LQIP_FILE = 'src/data/lqip.json';

/** slot → [source id, target aspect ratio] */
const MAP = {
  // — atmosphere ————————————————————————————————————————————
  'hero-workshop': ['37D624C7', '4/5'],
  'workshop-room': ['E7A0456F', '4/5'],
  'workshop-bench': ['D06F860C', '4/3'],
  'workshop-tools-wall': ['80E66294', '4/5'],
  'workshop-storage': ['2AC0DDC5', '4/5'],
  'workshop-fasteners-shelf': ['01E486D8', '4/3'],
  'workshop-corner': ['3F252D23', '4/3'],
  'workshop-workbench-2': ['324EE2F1', '4/3'],

  // — hands & hardware ——————————————————————————————————————
  'master-hands': ['2403E7FD', '4/5'],
  'hardware-tray': ['76C98E4A', '4/5'],
  'hardware-screws': ['54BBF516', '4/3'],
  'hardware-jars': ['82E0FEDD', '4/3'],
  'hardware-boxes': ['0E3FEDE8', '4/3'],
  'hardware-bins': ['3F8B505C', '1/1'],
  'hardware-mixed': ['7BD87814', '1/1'],
  'hardware-sorted': ['00DD3B4D', '1/1'],
  'hardware-stock': ['235189F4', '1/1'],

  // — equipment ——————————————————————————————————————————————
  'eq-drill-press': ['1FEE8764', '4/5'],
  'eq-grinder': ['1AE07E79', '4/5'],
  'eq-mitre-saw': ['7AA1995B', '4/5'],
  'eq-planer': ['EB78E645', '4/5'],
  'eq-press': ['AA9C4E71', '4/5'],
  'eq-circular-saw': ['B46F65B0', '4/5'],
  'eq-drill-press-2': ['5E43804E', '4/3'],
  'eq-bench-drill': ['9ADD1CC1', '4/3'],

  // — process ————————————————————————————————————————————————
  'process-drill': ['0E919F1F', '4/3'],
  'process-clamps': ['48D92E0A', '4/3'],
  'process-measure': ['6EE28EE3', '4/3'],
  'process-bench': ['2D732FD4', '4/3'],
  'process-repair': ['9DE21AA0', '3/2'],
  'process-parts': ['B03A21FE', '4/3'],
  'process-shelf': ['F2B751E3', '4/3'],
  'process-panel': ['354465A2', '4/3'],
  'process-saw': ['2E83D5B2', '4/3'],
  'process-wall': ['F919462E', '4/3'],
  'process-tools': ['1A1E8BC8', '4/3'],
};

const files = fs.readdirSync(SRC).filter((f) => /\.(jpe?g|png|heic)$/i.test(f));
const find = (id) => files.find((f) => f.toUpperCase().startsWith(id.toUpperCase()));

fs.mkdirSync(OUT, { recursive: true });

const lqip = fs.existsSync(LQIP_FILE)
  ? JSON.parse(fs.readFileSync(LQIP_FILE, 'utf8'))
  : {};

let done = 0;
const missing = [];

for (const [slot, [id, ratio]] of Object.entries(MAP)) {
  const file = find(id);
  if (!file) {
    missing.push(`${slot} ← ${id}`);
    continue;
  }
  const src = path.join(SRC, file);
  const [rw, rh] = ratio.split('/').map(Number);

  // Long side 1600 keeps these sharp on a 2x phone without bloating the page.
  const width = rw >= rh ? 1600 : Math.round(1600 * (rw / rh));
  const height = rw >= rh ? Math.round(1600 * (rh / rw)) : 1600;

  await sharp(src)
    .rotate() // honour EXIF orientation before we strip it
    .resize(width, height, { fit: 'cover', position: sharp.strategy.attention })
    .webp({ quality: 76, effort: 5 })
    .toFile(path.join(OUT, `${slot}.webp`));

  const blur = await sharp(src)
    .rotate()
    .resize(24, Math.max(1, Math.round(24 * (height / width))), { fit: 'cover' })
    .blur(1.4)
    .webp({ quality: 40 })
    .toBuffer();
  lqip[slot] = `data:image/webp;base64,${blur.toString('base64')}`;

  done += 1;
}

fs.mkdirSync(path.dirname(LQIP_FILE), { recursive: true });
fs.writeFileSync(LQIP_FILE, JSON.stringify(lqip, null, 0) + '\n');

const bytes = fs
  .readdirSync(OUT)
  .filter((f) => f.endsWith('.webp'))
  .reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);

console.log(`${done} photo(s) written to ${OUT}/  (${(bytes / 1024 / 1024).toFixed(1)} MB total)`);
console.log(`LQIP entries: ${Object.keys(lqip).length} → ${LQIP_FILE}`);
if (missing.length) console.warn('missing sources:\n  ' + missing.join('\n  '));
