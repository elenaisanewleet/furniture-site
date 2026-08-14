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

export const OPEN_QUESTIONS: OpenQuestion[] = [
  {
    id: 'q-services-scope',
    question:
      'Какие виды мебели мастер хочет делать чаще всего, а какие не берёт вообще?',
    blocks: 'Состав раздела «Услуги», приоритет карточек на главной, SEO-страницы категорий.',
    area: 'услуги',
  },
  {
    id: 'q-operations',
    question:
      'Какие операции выполняются в мастерской: раскрой, кромка, присадка, фрезеровка, изготовление деталей, покраска?',
    blocks:
      'Страница /detali-na-zakaz/ — сейчас нельзя перечислить, что именно можно изготовить.',
    area: 'производство',
  },
  {
    id: 'q-hardware-brands',
    question: 'С какой фурнитурой и какими брендами мастер обычно работает?',
    blocks:
      'Раздел /furnitura/ — названия брендов нигде не указаны и не будут указаны до ответа.',
    area: 'производство',
  },
  {
    id: 'q-repair-standalone',
    question:
      'Берётся ли ремонт и замена фурнитуры отдельно, без заказа новой мебели?',
    blocks:
      'Ключевое обещание страниц /remont-mebeli/ и /zamena-furnitury/ — вся стратегия низкого чека держится на этом.',
    area: 'услуги',
  },
  {
    id: 'q-single-part',
    question:
      'Берётся ли заказ на одну нестандартную деталь по фото, образцу или чертежу?',
    blocks: 'Страницы /detali-na-zakaz/ и /detal-po-foto/ — главный дифференциатор сайта.',
    area: 'услуги',
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
    question:
      'Можно ли публиковать адрес мастерской и принимать там клиентов, или адрес показывать не нужно?',
    blocks:
      'schema.org LocalBusiness (address), карта на /kontakty/, карточка Яндекс Бизнеса.',
    area: 'контакты',
  },
  {
    id: 'q-legal',
    question:
      'Как юридически принимаются заказы и оплата, какие документы и гарантии можно давать клиенту?',
    blocks:
      'Политика обработки персональных данных, текст согласия, реквизиты оператора данных в футере, любые упоминания гарантии.',
    area: 'юридическое',
  },
  {
    id: 'q-price-model',
    question:
      'Можно ли публиковать хотя бы порядок цен или минимальный чек? Или цена только после осмотра задачи?',
    blocks:
      'FAQ «Сколько стоит», блок ориентиров стоимости на коммерческих страницах.',
    area: 'коммерция',
  },
  {
    id: 'q-response-time',
    question: 'Через какое время реально получается отвечать на заявки?',
    blocks:
      'Экран успешной отправки и микрокопия у форм — сейчас нигде не обещается срок ответа.',
    area: 'коммерция',
  },
  {
    id: 'q-ready-furniture',
    question:
      'Работает ли мастер с готовой мебелью из IKEA, Hoff, Леруа Мерлен и подобных — доработка, ремонт, замена деталей?',
    blocks: 'Вопрос FAQ и потенциально сильный отдельный SEO-кластер.',
    area: 'услуги',
  },
  {
    id: 'q-b2b',
    question:
      'Берутся ли заказы от других мебельщиков — изготовление деталей или работа с фурнитурой?',
    blocks: 'Потенциальное B2B-направление. Пока на сайте не упоминается.',
    area: 'коммерция',
  },
  {
    id: 'q-brand-name',
    question: 'Как называется мастерская? Сейчас на сайте стоит рабочее название.',
    blocks: 'Логотип, <title> всех страниц, schema.org Organization, OpenGraph.',
    area: 'контакты',
  },
  {
    id: 'q-master-name',
    question: 'Имя мастера, которое можно публиковать.',
    blocks: 'Блок «Кто будет делать вашу мебель», schema.org, страница /o-mastere/.',
    area: 'контакты',
  },
  {
    id: 'q-photos',
    question:
      'Фотографии мастерской, инструмента, процесса и выполненных работ.',
    blocks:
      'Все изображения сайта. Сейчас стоят помеченные заглушки — см. docs/PHOTO-BRIEF.md.',
    area: 'производство',
  },
  {
    id: 'q-messengers',
    question:
      'Какие мессенджеры использовать для приёма заявок: Telegram, WhatsApp, MAX?',
    blocks: 'Кнопки мессенджеров в шапке, футере и на экране контактов.',
    area: 'контакты',
  },
];
