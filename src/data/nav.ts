/**
 * Navigation.
 *
 * Two mental models, one set of pages (see docs/PRODUCT-MODEL.md §2):
 *   MODEL A — "I know what object I need"  → `catalogue`
 *   MODEL B — "I only know what went wrong" → `problems`
 */

export interface NavItem {
  label: string;
  href: string;
  note?: string;
}

export interface NavGroup {
  label: string;
  href: string;
  items: NavItem[];
}

export const catalogue: NavGroup[] = [
  {
    label: 'Мебель на заказ',
    href: '/mebel-na-zakaz/',
    items: [
      { label: 'Шкафы и хранение', href: '/shkafy-na-zakaz/', note: 'встроенные, купе, в нишу' },
      { label: 'Кухни', href: '/kuhni-na-zakaz/', note: 'по месту, нестандартные размеры' },
      { label: 'Гардеробные', href: '/garderobnye/', note: 'наполнение и планировка' },
      { label: 'Прихожие', href: '/prihozhie/', note: 'узкие и неудобные' },
      { label: 'Нестандартная мебель', href: '/nestandartnaya-mebel/', note: 'то, чего не бывает в магазине' },
      { label: 'Мебель по фото', href: '/mebel-po-foto/', note: 'повторить или адаптировать' },
    ],
  },
  {
    label: 'Ремонт и переделка',
    href: '/remont-mebeli/',
    items: [
      { label: 'Ремонт мебели', href: '/remont-mebeli/', note: 'сломалось, перекосилось' },
      { label: 'Переделка мебели', href: '/peredelka-mebeli/', note: 'изменить, а не покупать' },
      { label: 'Замена фурнитуры', href: '/zamena-furnitury/', note: 'петли, направляющие, механизмы' },
    ],
  },
  {
    label: 'Фурнитура и детали',
    href: '/furnitura/',
    items: [
      { label: 'Определитель детали', href: '/opredelitel/', note: 'что это за штука' },
      { label: 'Фурнитура', href: '/furnitura/', note: 'не знаете название — покажите' },
      { label: 'Петли', href: '/furnitura/petli/' },
      { label: 'Направляющие и ящики', href: '/furnitura/napravlyayushchie/' },
      { label: 'Механизмы', href: '/furnitura/mehanizmy/' },
      { label: 'Детали на заказ', href: '/detali-na-zakaz/', note: 'одна деталь — тоже заказ' },
      { label: 'Деталь по фото', href: '/detal-po-foto/' },
    ],
  },
];

/** MODEL B — entry by symptom. Order matters: most common first. */
export const problems: (NavItem & { preset: string; icon: string })[] = [
  { label: 'Сломалось', href: '/remont-mebeli/', preset: 'repair', icon: 'break', note: 'дверца, ящик, механизм' },
  { label: 'Не знаю, что это за деталь', href: '/opredelitel/', preset: 'part', icon: 'part', note: 'определим по картинке' },
  { label: 'Нужно заменить', href: '/zamena-furnitury/', preset: 'part', icon: 'swap', note: 'петля, ручка, направляющая' },
  { label: 'Не помещается', href: '/nestandartnaya-mebel/', preset: 'new', icon: 'fit', note: 'ниша, скос, узкое место' },
  { label: 'Хочу переделать', href: '/peredelka-mebeli/', preset: 'remake', icon: 'remake', note: 'фасады, наполнение, размер' },
  { label: 'Хочу такое же', href: '/mebel-po-foto/', preset: 'new', icon: 'copy', note: 'нашли пример — покажите' },
];

export const primary: NavItem[] = [
  { label: 'Услуги', href: '/uslugi/' },
  { label: 'Работы', href: '/proekty/' },
  { label: 'Мастерская', href: '/o-mastere/' },
  { label: 'Вопросы', href: '/faq/' },
  { label: 'Журнал', href: '/journal/' },
  { label: 'Контакты', href: '/kontakty/' },
];

export const footerLegal: NavItem[] = [
  { label: 'Обработка персональных данных', href: '/privacy/' },
  { label: 'Согласие на обработку', href: '/soglasie/' },
];
