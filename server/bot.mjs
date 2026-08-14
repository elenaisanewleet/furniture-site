#!/usr/bin/env node
/**
 * Telegram-мост между клиентом и оператором.
 *
 * Зачем он нужен. Человек отправил фотографии с сайта и ушёл. Дальше обычно
 * происходит худшее: через несколько часов ему звонит незнакомый номер, он
 * не берёт трубку, заявка теряется. Здесь вместо этого на экране успеха
 * появляется кнопка «Продолжить в Telegram» — она открывает бота с меткой
 * заявки, и разговор продолжается там, где человеку удобно.
 *
 *   клиент ──/start ULY-…──► бот ──► оператор (в своём чате)
 *   клиент ◄── ответ ────── бот ◄── reply на сообщение заявки
 *
 * Без зависимостей: long polling через fetch. Персональные данные остаются
 * в базе сайта — бот хранит только связку «чат ↔ номер заявки».
 *
 * Запуск:
 *   TELEGRAM_BOT_TOKEN=… TELEGRAM_CHAT_ID=… node server/bot.mjs
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OPERATOR = process.env.TELEGRAM_CHAT_ID;
const DATA_DIR = path.resolve(process.env.DATA_DIR || './data');
const LINKS_FILE = path.join(DATA_DIR, 'tg-links.json');
const LEADS_FILE = path.join(DATA_DIR, 'leads.jsonl');

if (!TOKEN || !OPERATOR) {
  console.error('Нужны TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.');
  process.exit(1);
}

const API = `https://api.telegram.org/bot${TOKEN}`;

/* ------------------------------------------------------------------ state */

/**
 * links = {
 *   chats:  { [chatId]: leadId },        клиентский чат → заявка
 *   routes: { [operatorMsgId]: chatId }, сообщение у оператора → куда отвечать
 * }
 */
let links = { chats: {}, routes: {} };
if (fs.existsSync(LINKS_FILE)) {
  try {
    links = { chats: {}, routes: {}, ...JSON.parse(fs.readFileSync(LINKS_FILE, 'utf8')) };
  } catch {
    console.warn('tg-links.json повреждён, начинаем с чистого состояния');
  }
}

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    await fsp.mkdir(DATA_DIR, { recursive: true });
    // Routes grow forever otherwise; keep the most recent 2000.
    const entries = Object.entries(links.routes);
    if (entries.length > 2000) links.routes = Object.fromEntries(entries.slice(-2000));
    await fsp.writeFile(LINKS_FILE, JSON.stringify(links), 'utf8');
  }, 300);
}

/* -------------------------------------------------------------------- api */

async function call(method, payload) {
  try {
    const res = await fetch(`${API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
    const json = await res.json();
    if (!json.ok) console.error(`[tg] ${method}:`, json.description);
    return json.result;
  } catch (err) {
    console.error(`[tg] ${method} failed:`, err.message);
    return null;
  }
}

const send = (chat_id, text, extra = {}) =>
  call('sendMessage', { chat_id, text, parse_mode: 'HTML', ...extra });

/* ------------------------------------------------------------------ leads */

/** Reads the lead back from the JSONL journal written by server/index.mjs. */
async function findLead(leadId) {
  if (!fs.existsSync(LEADS_FILE)) return null;
  const text = await fsp.readFile(LEADS_FILE, 'utf8');
  for (const line of text.trimEnd().split('\n').reverse()) {
    try {
      const lead = JSON.parse(line);
      if (lead.lead_id === leadId) return lead;
    } catch {
      /* skip malformed line */
    }
  }
  return null;
}

const TYPE_LABEL = {
  new: 'новая мебель',
  remake: 'переделка',
  repair: 'ремонт',
  part: 'деталь / фурнитура',
  'custom-part': 'нестандартная деталь',
  unknown: 'пока не знает',
};

/* --------------------------------------------------------------- handlers */

async function onStart(msg, payload) {
  const chatId = msg.chat.id;
  const leadId = (payload || '').trim();

  if (!leadId) {
    await send(
      chatId,
      'Здравствуйте. Здесь можно показать мебельную задачу.\n\n' +
        'Пришлите фотографию того, что нужно сделать или что сломалось — ' +
        'разбираться в названиях деталей не нужно. Можно и голосовым.'
    );
    links.chats[chatId] = links.chats[chatId] || 'DIRECT';
    save();
    return;
  }

  links.chats[chatId] = leadId;
  save();

  const lead = await findLead(leadId);

  await send(
    chatId,
    `Заявка <b>${leadId}</b> получена.\n\n` +
      'Посмотрим фотографии и ответим здесь. Если что-то забыли приложить — ' +
      'дошлите прямо в этот чат.'
  );

  const sent = await send(
    OPERATOR,
    [
      `💬 <b>Клиент подключился в Telegram</b>`,
      `Заявка: <code>${leadId}</code>`,
      lead ? `Тип: ${TYPE_LABEL[lead.request_type] || '—'}` : '',
      lead ? `Страница: ${lead.landing_page || '—'}` : '',
      lead
        ? `Материалы: ${lead.photos.length} фото, ${lead.references.length} референс${lead.voice ? ', голосовое' : ''}`
        : '',
      '',
      '<i>Ответьте reply на это сообщение — клиент получит ваш ответ.</i>',
    ]
      .filter(Boolean)
      .join('\n')
  );

  if (sent?.message_id) {
    links.routes[sent.message_id] = chatId;
    save();
  }
}

/** Message from a client — relay it to the operator. */
async function fromClient(msg) {
  const chatId = msg.chat.id;
  const leadId = links.chats[chatId];
  const who = msg.from?.first_name || 'Клиент';

  const header =
    `📨 <b>${who}</b>` + (leadId && leadId !== 'DIRECT' ? ` · <code>${leadId}</code>` : ' · без заявки');

  let sent;
  if (msg.photo?.length) {
    // Largest available size is the last entry.
    sent = await call('sendPhoto', {
      chat_id: OPERATOR,
      photo: msg.photo[msg.photo.length - 1].file_id,
      caption: `${header}\n${msg.caption || ''}`.trim(),
      parse_mode: 'HTML',
    });
  } else if (msg.voice) {
    sent = await call('sendVoice', {
      chat_id: OPERATOR,
      voice: msg.voice.file_id,
      caption: header,
      parse_mode: 'HTML',
    });
  } else if (msg.document) {
    sent = await call('sendDocument', {
      chat_id: OPERATOR,
      document: msg.document.file_id,
      caption: `${header}\n${msg.caption || ''}`.trim(),
      parse_mode: 'HTML',
    });
  } else if (msg.text) {
    sent = await send(OPERATOR, `${header}\n\n${escapeHtml(msg.text)}`);
  } else {
    return;
  }

  if (sent?.message_id) {
    links.routes[sent.message_id] = chatId;
    save();
  }
}

/** Operator replied to a relayed message — send it back to that client. */
async function fromOperator(msg) {
  const target = msg.reply_to_message && links.routes[msg.reply_to_message.message_id];
  if (!target) {
    if (msg.text?.startsWith('/')) return;
    await send(
      OPERATOR,
      'Чтобы ответить клиенту, используйте reply на сообщение заявки.'
    );
    return;
  }

  if (msg.photo?.length) {
    await call('sendPhoto', {
      chat_id: target,
      photo: msg.photo[msg.photo.length - 1].file_id,
      caption: msg.caption || '',
    });
  } else if (msg.voice) {
    await call('sendVoice', { chat_id: target, voice: msg.voice.file_id });
  } else if (msg.text) {
    await send(target, escapeHtml(msg.text));
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ---------------------------------------------------------------- polling */

async function handle(update) {
  const msg = update.message || update.edited_message;
  if (!msg) return;

  const isOperator = String(msg.chat.id) === String(OPERATOR);

  if (msg.text?.startsWith('/start')) {
    if (!isOperator) await onStart(msg, msg.text.slice(6));
    return;
  }

  if (isOperator) await fromOperator(msg);
  else await fromClient(msg);
}

let offset = 0;
let stopping = false;

async function poll() {
  while (!stopping) {
    const updates = await call('getUpdates', {
      offset,
      timeout: 25,
      allowed_updates: ['message', 'edited_message'],
    });
    if (!updates) {
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }
    for (const u of updates) {
      offset = u.update_id + 1;
      try {
        await handle(u);
      } catch (err) {
        console.error('[bot] handler error:', err);
      }
    }
  }
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    stopping = true;
    save();
    console.log('\nостановлен');
    process.exit(0);
  });
}

const me = await call('getMe', {});
console.log(`бот @${me?.username || '?'} запущен, оператор ${OPERATOR}`);
console.log(`связок в памяти: ${Object.keys(links.chats).length}`);
await poll();
