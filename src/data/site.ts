import type { FactStatus } from '~/lib/facts';

/**
 * Single source of truth for everything the business "is".
 *
 * Every value that has not been confirmed by the master carries a `status`.
 * Changing a value here changes it across the whole site — copy, footer,
 * schema.org, OpenGraph and the contact page all read from this file.
 */

export interface Contact {
  id: string;
  /** Public-facing role, not an internal job title. */
  role: string;
  name: string | null;
  phone: string | null;
  /** tel: href — digits only, leading +. */
  tel: string | null;
  note?: string;
  /** false = kept in config but never rendered on the public site. */
  publish: boolean;
  status: FactStatus;
}

export const site = {
  /**
   * [НУЖНО УТОЧНИТЬ] Рабочее название. Меняется здесь — меняется везде.
   * Намеренно нейтральное: не выдуманное юрлицо и не чужой бренд.
   */
  brand: {
    name: 'Мастерская',
    /** Used where the bare word would be ambiguous (title tags, schema). */
    legalIsh: 'Мебельная мастерская',
    tagline: 'мебель · фурнитура · ремонт',
    status: 'needs-confirmation' as FactStatus,
  },

  /** Positioning line used in <title> suffixes and schema description. */
  positioning:
    'Мебель, фурнитура, ремонт и нестандартные детали. Покажите задачу — разберёмся, что можно сделать.',

  city: 'Ульяновск',
  region: 'Ульяновская область',
  /** ISO 3166-2 — used in schema.org address. */
  regionCode: 'RU-ULY',

  /**
   * Точный адрес мастерской НЕ публикуется до ответа на q-address-public.
   * Исследование прямо предупреждает: частный дом нельзя выдавать за шоурум.
   */
  address: {
    streetAddress: null as string | null,
    locality: null as string | null,
    status: 'needs-confirmation' as FactStatus,
  },

  /**
   * География выезда. Публикуется только после подтверждения (q-geography),
   * поэтому пока весь список помечен и в продакшене скрыт.
   */
  serviceAreas: [
    { name: 'Ульяновск', status: 'needs-confirmation' as FactStatus },
    { name: 'Ульяновская область', status: 'needs-confirmation' as FactStatus },
  ],

  contacts: [
    {
      id: 'operator',
      role: 'Приём заявок',
      name: 'Елена',
      phone: '+7 985 198-29-45',
      tel: '+79851982945',
      note: 'Можно объяснить задачу обычными словами — технические детали уточним сами.',
      publish: true,
      status: 'fact',
    },
    {
      /**
       * Телефон мастера в репозитории не хранится: репозиторий публичный,
       * а git помнит всё — один раз попав в историю, номер оттуда уже не
       * убирается обычным коммитом.
       *
       * Номер нужен, только если мастер разрешит его публиковать. Тогда:
       * MASTER_PHONE='+7 000 000-00-00' в окружении сборки и publish: true.
       */
      id: 'master',
      role: 'Мастер, технические вопросы',
      name: null,
      phone: import.meta.env.MASTER_PHONE || null,
      tel: (import.meta.env.MASTER_PHONE || '').replace(/[^\d+]/g, '') || null,
      note: 'Не публикуется до подтверждения: мастеру не нужны нецелевые звонки.',
      publish: false,
      status: 'needs-confirmation',
    },
  ] satisfies Contact[],

  /**
   * Telegram. Задайте PUBLIC_TG_BOT (имя бота без @) — и появятся:
   * кнопка в шапке и контактах, и главное — передача заявки в переписку,
   * чтобы человек получил ответ там, где ему удобно.
   * Бот поднимается из server/bot.mjs.
   */
  telegram: {
    bot: import.meta.env.PUBLIC_TG_BOT || '',
    get publish() {
      return Boolean(this.bot);
    },
  },

  /** Прочие мессенджеры — включаются после подтверждения (q-messengers). */
  messengers: [
    { id: 'whatsapp', label: 'WhatsApp', href: null as string | null, publish: false, status: 'needs-confirmation' as FactStatus },
    { id: 'max', label: 'MAX', href: null as string | null, publish: false, status: 'needs-confirmation' as FactStatus },
  ],

  /**
   * Часы работы не подтверждены — в schema.org openingHours не уходят.
   */
  openingHours: null as string[] | null,

  /** Куда уходит заявка. Пусто = форма работает в демонстрационном режиме. */
  leadEndpoint: import.meta.env.PUBLIC_LEAD_ENDPOINT || '',

  /** Яндекс.Метрика. Пусто = счётчик не подключается. */
  metrikaId: import.meta.env.PUBLIC_METRIKA_ID || '',

  /** Максимум файлов и размер — совпадают с валидацией на сервере. */
  upload: {
    maxFiles: 8,
    maxFileMb: 12,
    accept: 'image/*,.heic,.heif',
    maxVoiceSeconds: 90,
  },
} as const;

/** Контакты, которые действительно можно показывать посетителю. */
export const publicContacts = site.contacts.filter((c) => c.publish && c.phone);

/** Основной телефон для CTA и schema.org. */
export const primaryContact = publicContacts[0] ?? null;
