import fs from 'node:fs';
import path from 'node:path';

/**
 * Photo resolution.
 *
 * Layout never knows whether a real photograph exists. Every image slot is
 * addressed by a stable name; if `public/photo/<name>.<ext>` is present it is
 * used, otherwise <Photo> draws a designed placeholder of the same aspect
 * ratio. Swapping a placeholder for the real thing = dropping in a file.
 *
 * Slots are collected at build time so `npm run photos` can regenerate
 * docs/PHOTO-BRIEF.md — the shot list handed to a photographer or an image
 * generator.
 */

const PHOTO_DIR = path.resolve(process.cwd(), 'public/photo');
const EXTS = ['.avif', '.webp', '.jpg', '.jpeg', '.png'];

export interface PhotoSlot {
  name: string;
  alt: string;
  ratio: string;
  brief?: string;
  /** Where this slot appears — for the shot list. */
  where?: string;
}

/** Every slot rendered during this build, keyed by name. */
export const registry = new Map<string, PhotoSlot>();

export function register(slot: PhotoSlot) {
  const prev = registry.get(slot.name);
  if (prev) {
    // Same asset used on several pages — keep the richest brief.
    if (!prev.brief && slot.brief) prev.brief = slot.brief;
    if (slot.where && prev.where && !prev.where.includes(slot.where)) {
      prev.where = `${prev.where}, ${slot.where}`;
    }
    return;
  }
  registry.set(slot.name, { ...slot });
}

let cache: Map<string, string | null> | null = null;

function index(): Map<string, string | null> {
  if (cache) return cache;
  cache = new Map();
  if (!fs.existsSync(PHOTO_DIR)) return cache;
  for (const file of fs.readdirSync(PHOTO_DIR)) {
    const ext = path.extname(file).toLowerCase();
    if (!EXTS.includes(ext)) continue;
    const base = path.basename(file, ext);
    // Prefer the most modern format available for a given name.
    const existing = cache.get(base);
    if (!existing || EXTS.indexOf(ext) < EXTS.indexOf(path.extname(existing).toLowerCase())) {
      cache.set(base, `/photo/${file}`);
    }
  }
  return cache;
}

/** Public URL of the real photograph, or null when none has been supplied. */
export function resolve(name: string): string | null {
  return index().get(name) ?? null;
}

export function hasPhoto(name: string): boolean {
  return resolve(name) !== null;
}

/** Numeric aspect ratio, for width/height attributes that prevent CLS. */
export function ratioBox(ratio: string, base = 1600): { w: number; h: number } {
  const [a, b] = ratio.split('/').map((n) => Number(n.trim()));
  if (!a || !b) return { w: base, h: Math.round((base * 2) / 3) };
  return { w: base, h: Math.round((base * b) / a) };
}
