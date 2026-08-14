#!/usr/bin/env node
/**
 * Reference lead intake.
 *
 * Deliberately dependency-free and small enough to read in one sitting.
 * It implements the architecture the site assumes:
 *
 *   browser --HTTPS--> this service --> JSONL + object storage on disk
 *                                   \-> messenger notification only
 *
 * Personal data (phone, description, photos, voice) never leaves the disk it
 * is written to. The messenger is told a lead arrived and what kind — never
 * the phone number, the text or the files.
 *
 * Run:
 *   node server/index.mjs
 *
 * Environment:
 *   PORT              default 8787
 *   DATA_DIR          default ./data
 *   ALLOW_ORIGIN      comma-separated origins allowed to POST (default *)
 *   REDIRECT_URL      where a no-JS form post lands (default /spasibo/)
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   optional notification
 */

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';

const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const LEADS_FILE = path.join(DATA_DIR, 'leads.jsonl');
const REDIRECT_URL = process.env.REDIRECT_URL || '/spasibo/';
const ALLOW_ORIGIN = (process.env.ALLOW_ORIGIN || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const MAX_FILES = 8;
const MAX_FILE_BYTES = 12 * 1024 * 1024;
const MAX_BODY_BYTES = 80 * 1024 * 1024;
const MAX_TEXT = 4000;

const ALLOWED_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif',
  'image/heic', 'image/heif',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
]);

const EXT = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'image/avif': '.avif', 'image/gif': '.gif', 'image/heic': '.heic',
  'image/heif': '.heif', 'audio/webm': '.webm', 'audio/ogg': '.ogg',
  'audio/mp4': '.m4a', 'audio/mpeg': '.mp3', 'audio/wav': '.wav',
};

/* ------------------------------------------------------------ rate limit */
// Crude but effective for a workshop-sized site: N submissions per IP/hour.
const RATE_MAX = 12;
const RATE_WINDOW = 60 * 60 * 1000;
const hits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear(); // bounded memory
  return list.length > RATE_MAX;
}

/* ---------------------------------------------------------------- helpers */

const digits = (s) => String(s || '').replace(/\D/g, '');

function leadId(date = new Date()) {
  const d = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `ULY-${d}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function clean(v, max = MAX_TEXT) {
  return String(v ?? '').replace(/\0/g, '').trim().slice(0, max);
}

function corsHeaders(origin) {
  const allow =
    ALLOW_ORIGIN.includes('*') || (origin && ALLOW_ORIGIN.includes(origin))
      ? origin || '*'
      : ALLOW_ORIGIN[0] || '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

async function notify(lead) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;

  // Notification only. No phone, no name, no description, no files.
  const text = [
    `🆕 Заявка ${lead.lead_id}`,
    ``,
    `Тип: ${lead.request_type || 'не выбран'}`,
    `Страница: ${lead.landing_page || '—'}`,
    `Материалы: ${lead.photos.length} фото, ${lead.references.length} референс, ${lead.voice ? 'голосовое есть' : 'без голосового'}`,
    `Связь: ${lead.preferred_contact}`,
    ``,
    `Открыть карточку в панели заявок.`,
  ].join('\n');

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    // A failed notification must never lose the lead.
    console.error('[notify] failed:', err.message);
  }
}

/* ------------------------------------------------------------------ main */

async function handleSubmit(req, res, origin) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown';

  if (rateLimited(ip)) {
    return json(res, 429, { ok: false, error: 'too_many_requests' }, origin);
  }

  const length = Number(req.headers['content-length'] || 0);
  if (length > MAX_BODY_BYTES) {
    return json(res, 413, { ok: false, error: 'payload_too_large' }, origin);
  }

  // Node's fetch primitives parse multipart for us — no parser to maintain.
  const request = new Request('http://local/submit', {
    method: 'POST',
    headers: { 'content-type': req.headers['content-type'] || '' },
    body: Readable.toWeb(req),
    duplex: 'half',
  });

  let form;
  try {
    form = await request.formData();
  } catch {
    return json(res, 400, { ok: false, error: 'bad_multipart' }, origin);
  }

  // Honeypot: a filled "company" field means a bot. Answer 200 so it stops.
  if (clean(form.get('company'), 200)) {
    return respond(req, res, 200, { ok: true, lead_id: null }, origin);
  }

  const phone = digits(form.get('phone'));
  if (phone.length < 10 || phone.length > 15) {
    return json(res, 422, { ok: false, error: 'invalid_phone' }, origin);
  }
  if (!form.get('consent')) {
    return json(res, 422, { ok: false, error: 'consent_required' }, origin);
  }

  const id = leadId();
  const now = new Date();
  const dir = path.join(
    UPLOAD_DIR,
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, '0'),
    id
  );

  const saved = { photos: [], references: [], voice: null };
  let stored = 0;

  for (const field of ['photos', 'references', 'voice']) {
    for (const value of form.getAll(field)) {
      if (typeof value === 'string' || !value?.size) continue;
      if (stored >= MAX_FILES + 1) break;
      if (value.size > MAX_FILE_BYTES) continue;

      const type = (value.type || '').split(';')[0].toLowerCase();
      if (!ALLOWED_TYPES.has(type)) continue;

      // Never trust the client filename; derive our own from the MIME type.
      const name = `${field}-${String(saved.photos.length + saved.references.length + 1).padStart(2, '0')}${EXT[type] || '.bin'}`;
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, name),
        Buffer.from(await value.arrayBuffer())
      );
      stored += 1;

      const rel = path.relative(DATA_DIR, path.join(dir, name));
      if (field === 'voice') saved.voice = rel;
      else saved[field].push(rel);
    }
  }

  const lead = {
    lead_id: id,
    created_at: now.toISOString(),

    // context
    landing_page: clean(form.get('landing_page'), 500),
    cta_type: clean(form.get('cta_type'), 100),
    utm: clean(form.get('utm'), 500),

    // task
    request_type: clean(form.get('request_type'), 40),
    description: clean(form.get('description')),

    // contact
    name: clean(form.get('name'), 120),
    phone: `+${phone}`,
    preferred_contact: clean(form.get('preferred_contact'), 20) || 'any',

    // attachments
    photos: saved.photos,
    references: saved.references,
    voice: saved.voice,

    // consent
    consent: true,
    consent_version: clean(form.get('consent_version'), 40),
    consent_at: now.toISOString(),

    // operator workflow
    status: 'new',
    assigned_to: null,
    next_action: null,
    result: null,

    // reserved for later image analysis — populated by nothing today
    ai_guess_type: null,
    ai_guess_problem: null,
    ai_confidence: null,
    ai_questions: [],
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.appendFile(LEADS_FILE, JSON.stringify(lead) + '\n', 'utf8');

  notify(lead); // fire and forget

  console.log(
    `[lead] ${id} type=${lead.request_type || '-'} files=${saved.photos.length + saved.references.length}${saved.voice ? '+voice' : ''} from=${lead.landing_page}`
  );

  return respond(req, res, 200, { ok: true, lead_id: id }, origin);
}

/** fetch() callers get JSON; a native no-JS form post gets a redirect. */
function respond(req, res, status, body, origin) {
  const accept = String(req.headers.accept || '');
  const wantsHtml = accept.includes('text/html');
  if (wantsHtml) {
    res.writeHead(303, { Location: REDIRECT_URL, ...corsHeaders(origin) });
    return res.end();
  }
  return json(res, status, body, origin);
}

function json(res, status, body, origin) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...corsHeaders(origin),
  });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    return res.end();
  }

  const url = new URL(req.url || '/', 'http://local');

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true }, origin);
  }

  if (req.method === 'POST' && (url.pathname === '/submit' || url.pathname === '/')) {
    try {
      return await handleSubmit(req, res, origin);
    } catch (err) {
      console.error('[submit] error:', err);
      return json(res, 500, { ok: false, error: 'internal' }, origin);
    }
  }

  return json(res, 404, { ok: false, error: 'not_found' }, origin);
});

server.listen(PORT, () => {
  console.log(`lead intake listening on http://localhost:${PORT}`);
  console.log(`  data dir:  ${DATA_DIR}`);
  console.log(`  telegram:  ${process.env.TELEGRAM_BOT_TOKEN ? 'on' : 'off'}`);
});
