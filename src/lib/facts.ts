/**
 * Fact gate.
 *
 * The brief is explicit: nothing may be stated on the public site that has not
 * been confirmed by the master. Rather than relying on the copywriter's
 * discipline, every claim on this site carries a status and passes through
 * `isPublic()` before it can render.
 *
 *   fact                — confirmed. Renders publicly.
 *   hypothesis          — a plausible business direction, not yet confirmed.
 *   needs-confirmation  — an open question with a concrete answer required.
 *
 * Only `fact` reaches production. The other two render *only* in a review
 * build, wrapped in a visible badge, and are collected on /review/ so the
 * owner can walk the list with the master and promote items one by one.
 *
 * Review build:  PUBLIC_SHOW_UNCONFIRMED=true npm run build
 */

export type FactStatus = 'fact' | 'hypothesis' | 'needs-confirmation';

/** True in a review build, false in the public production build. */
export const SHOW_UNCONFIRMED =
  import.meta.env.PUBLIC_SHOW_UNCONFIRMED === 'true';

/** May this claim be shown to a real visitor right now? */
export function isPublic(status: FactStatus | undefined): boolean {
  if (!status || status === 'fact') return true;
  return SHOW_UNCONFIRMED;
}

/** Filter any list of status-carrying records down to what may be published. */
export function publicOnly<T extends { status?: FactStatus }>(items: T[]): T[] {
  return items.filter((i) => isPublic(i.status));
}

export const STATUS_LABEL: Record<FactStatus, string> = {
  fact: 'подтверждено',
  hypothesis: 'гипотеза — нужно подтвердить',
  'needs-confirmation': 'нужно уточнить у мастера',
};

/**
 * Open questions that must be answered before the corresponding copy,
 * schema.org field or page section can go live. Surfaced on /review/.
 *
 * Sourced from the brief (§1, §7) and the research report's closing
 * "восемь вопросов отцу".
 */
export interface OpenQuestion {
  id: string;
  question: string;
  /** What on the site is blocked until this is answered. */
  blocks: string;
  area: 'услуги' | 'производство' | 'география' | 'контакты' | 'коммерция' | 'юридическое';
}

/**
 * Что мастер ответил в анкете (28 из 30 вопросов).
 *
 * Хранится здесь, а не в переписке, по одной причине: через полгода никто не
 * вспомнит, откуда на сайте взялось «отвечаем в течение часа» — а проверить
 * источник утверждения должно быть можно всегда.
 *
 * Ограничения, которые важнее разрешений:
 *   • раскроем ЛДСП не занимается — сайт не должен обещать распил;
 *   • кухни целиком и мягкую мебель брать не хочет, но «ничего не исключаю»;
 *   • гарантия только устная — письменных обещаний на сайте нет;
 *   • съёмки мастерской не будет, мастера не фотографировать,
 *     готовых работ почти нет: рисунки остаются языком сайта навсегда,
 *     а не до появления фотографий.
 */
export const MASTER_ANSWERS = {
  date: '2026-08-15',
  answered: 28,
  total: 30,
} as const;

export const OPEN_QUESTIONS: OpenQuestion[] = [
            {
    id: 'q-hardware-brands',
    question: 'С какой фурнитурой и какими брендами мастер обычно работает?',
    blocks:
      'Раздел /furnitura/ — названия брендов нигде не указаны и не будут указаны до ответа.',
    area: 'производство',
  },
      {
    id: 'q-geography',
    question:
      'Куда мастер готов выезжать на замер и монтаж: Ульяновск, область, какие районы и населённые пункты?',
    blocks:
      'Блок «Куда выезжаем», schema.org areaServed, местные SEO-формулировки, страница контактов.',
    area: 'география',
  },
  {
    id: 'q-address-public',
    /* Анкета, вопрос 19: публиковать можно только село и район, не адрес.
       Само название села мастер не назвал — без него блок не построить. */
    question:
      'Как называется село и район? Адрес целиком публиковать нельзя, но без названия места не построить ни блок контактов, ни локальный поиск.',
    blocks:
      'schema.org LocalBusiness (address), карта на /kontakty/, карточка Яндекс Бизнеса.',
    area: 'контакты',
  },
  {
    id: 'q-master-name',
    /* Анкета, вопрос 27: публиковать можно только имя, без фамилии.
       Какое именно имя — не сказано. */
    question: 'Имя мастера, которое можно публиковать.',
    blocks: 'Блок «Кто будет делать вашу мебель», schema.org, страница /o-mastere/.',
    area: 'контакты',
  },
      {
    id: 'q-messengers',
    question:
      'Какие мессенджеры использовать для приёма заявок: Telegram, WhatsApp, MAX?',
    blocks: 'Кнопки мессенджеров в шапке, футере и на экране контактов.',
    area: 'контакты',
  },
];
