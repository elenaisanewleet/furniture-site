#!/usr/bin/env node
/**
 * Собирает анкету для мастера в один самодостаточный файл.
 *
 * Смысл: вопросы, на которые сейчас держится половина сайта, должны
 * закрываться за пять минут с телефона. Поэтому не «расскажи о себе», а
 * готовые варианты в один тап, и в конце — текст, который можно переслать
 * обратно в мессенджер.
 *
 *   node scripts/make-quiz.mjs [файл]
 */

import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'preview/anketa.html';
const FONTS = 'public/fonts';

const font = (f) =>
  `data:font/woff2;base64,${fs.readFileSync(path.join(FONTS, f)).toString('base64')}`;

/* ------------------------------------------------------------- вопросы --- */

const Q = [
  {
    section: 'Что берёшь в работу',
    hint: 'Самое важное. От этих ответов зависит, о чём вообще сайт.',
    items: [
      {
        id: 'repair',
        q: 'Ремонт мебели — берёшь отдельно, без заказа новой?',
        why: 'На этом держатся все страницы про ремонт.',
        a: [
          'Да, это нормальная работа',
          'Да, но неохотно — мелочь невыгодна',
          'Только вместе с другим заказом',
          'Нет, не берусь',
        ],
      },
      {
        id: 'hardware',
        q: 'Замена фурнитуры — петли, направляющие, ручки, механизмы?',
        a: ['Да, обычное дело', 'Да, если по пути', 'Только своим клиентам', 'Нет'],
      },
      {
        id: 'onepart',
        q: 'Одна деталь на заказ — полка, дверца, вставка?',
        why: 'Главное отличие от конкурентов: за одну деталь мало кто берётся.',
        a: [
          'Да, любую',
          'Да, если есть образец или размеры',
          'Только простую, прямоугольную',
          'Нет',
        ],
      },
      {
        id: 'shopfurn',
        q: 'Мебель из IKEA, Hoff, Леруа — доработка и ремонт?',
        a: ['Да, обычное дело', 'Смотря что', 'Нет, там всё одноразовое'],
      },
      {
        id: 'remake',
        q: 'Переделка: поменять фасады, наполнение, размер у существующей мебели?',
        a: ['Да', 'Фасады и наполнение — да, размер — нет', 'Нет'],
      },
      {
        id: 'b2b',
        q: 'Заказы от других мебельщиков — детали, присадка, фурнитура?',
        a: ['Да, интересно', 'Можно обсудить', 'Нет'],
      },
    ],
  },
  {
    section: 'Что делаешь охотнее',
    items: [
      {
        id: 'like',
        q: 'Что берёшь охотнее всего?',
        multi: true,
        a: [
          'Шкафы и встроенные',
          'Кухни',
          'Гардеробные',
          'Прихожие',
          'Полки и стеллажи',
          'Столы',
          'Тумбы, комоды',
          'Нестандартное и сложное',
          'Ремонт',
          'Отдельные детали',
        ],
      },
      {
        id: 'dislike',
        q: 'А что не хочешь брать вообще?',
        multi: true,
        a: [
          'Кухни целиком',
          'Шкафы-купе',
          'Мягкую мебель',
          'Реставрацию старинной',
          'Детскую',
          'Мелкий ремонт',
          'Выезды за город',
          'Ничего не исключаю',
        ],
      },
    ],
  },
  {
    section: 'Мастерская',
    hint: 'По фотографиям видно станки — нужно понять, что из этого идёт в работу на заказ.',
    items: [
      {
        id: 'machines',
        q: 'Что из этого используешь для заказов?',
        why: 'На фото: сверлильный станок, точило, торцовочная пила, деревообрабатывающий станок, ручной пресс, дисковая пила.',
        multi: true,
        a: [
          'Сверлильный станок',
          'Торцовочная пила',
          'Деревообрабатывающий станок',
          'Точило',
          'Ручной пресс',
          'Дисковая пила',
          'Только ручной инструмент',
        ],
      },
      {
        id: 'cut',
        q: 'Раскрой ЛДСП — сам или заказываешь?',
        a: ['Сам', 'Заказываю на стороне', 'Обычно заказываю, мелочь сам'],
      },
      {
        id: 'edge',
        q: 'Кромку клеишь сам?',
        a: ['Да', 'Только мелочь', 'Нет, заказываю с кромкой'],
      },
      {
        id: 'drill',
        q: 'Присадку под петли и стяжки делаешь сам?',
        a: ['Да', 'Иногда', 'Нет'],
      },
      {
        id: 'metal',
        q: 'Металл: пресс и точило — это для работы или для себя?',
        why: 'Если берёшь металлические детали — этого нет ни у кого из местных.',
        a: [
          'Беру металлические детали в работу',
          'Могу, если несложное',
          'Только для себя',
          'Нет',
        ],
      },
      {
        id: 'materials',
        q: 'С какими материалами работаешь?',
        multi: true,
        a: ['ЛДСП', 'МДФ', 'Массив', 'Фанера', 'Мебельный щит', 'Стекло', 'Металл', 'Пластик'],
      },
    ],
  },
  {
    section: 'Крепёж и фурнитура',
    hint: 'На фотографиях большой разобранный запас — это сильный аргумент, если им можно пользоваться.',
    items: [
      {
        id: 'stock',
        q: 'Можно обещать, что нужная мелочь часто находится сразу у тебя?',
        a: [
          'Да, запас большой',
          'Часто, но не всегда',
          'Редко, обычно покупаю под заказ',
          'Лучше не обещать',
        ],
      },
      {
        id: 'sell',
        q: 'Продаёшь фурнитуру отдельно, без работы?',
        a: ['Да', 'Могу, если есть', 'Нет, только с работой'],
      },
      {
        id: 'brands',
        q: 'С какими марками фурнитуры обычно работаешь?',
        multi: true,
        a: ['Blum', 'Hettich', 'Boyard', 'GTV', 'AKS', 'FGV', 'Что есть в наличии', 'Не смотрю на марку'],
      },
    ],
  },
  {
    section: 'География',
    items: [
      {
        id: 'geo',
        q: 'Куда готов выезжать на замер и монтаж?',
        multi: true,
        a: [
          'Ульяновск, весь город',
          'Только правый берег',
          'Только Заволжье',
          'Область до 30 км',
          'Область до 100 км',
          'Только Архангельское и рядом',
          'Не выезжаю, работаю в мастерской',
        ],
      },
      {
        id: 'address',
        q: 'Можно ли писать на сайте адрес мастерской?',
        a: ['Да, можно полностью', 'Только село / район', 'Нет, адрес не публиковать'],
      },
      {
        id: 'visit',
        q: 'Могут ли клиенты приезжать к тебе?',
        a: ['Да, по договорённости', 'Только свои', 'Нет'],
      },
    ],
  },
  {
    section: 'Деньги и сроки',
    items: [
      {
        id: 'price',
        q: 'Как быть с ценами на сайте?',
        a: [
          'Можно писать «от такой-то суммы»',
          'Только после осмотра задачи',
          'Цены вообще не публиковать',
        ],
      },
      {
        id: 'minorder',
        q: 'Есть минимальный заказ?',
        a: ['Нет, берусь за любую мелочь', 'Да, есть порог', 'Смотрю по задаче'],
      },
      {
        id: 'warranty',
        q: 'Даёшь гарантию?',
        a: ['Да, даю', 'Устно, по-человечески', 'Нет', 'Не думал об этом'],
      },
      {
        id: 'reply',
        q: 'За какое время реально отвечаешь на заявку?',
        why: 'Сайт сейчас ничего не обещает — лучше молчать, чем не выдержать.',
        a: ['В течение часа', 'В тот же день', 'День-два', 'Когда как, обещать не надо'],
      },
      {
        id: 'legal',
        q: 'Как оформляешь заказы и оплату?',
        a: ['ИП', 'Самозанятый', 'Без оформления, наличными', 'По-разному'],
      },
    ],
  },
  {
    section: 'Название и фотографии',
    items: [
      {
        id: 'name',
        q: 'Как назвать мастерскую на сайте?',
        why: 'Сейчас стоит рабочее слово «Мастерская».',
        a: [
          'Название уже есть, скажу',
          'Пусть будет по имени мастера',
          'Придумайте сами',
          'Оставьте «Мастерская»',
        ],
      },
      {
        id: 'myname',
        q: 'Какое имя можно публиковать?',
        a: ['Имя и фамилию', 'Только имя', 'Имя и отчество', 'Не публиковать'],
      },
      {
        id: 'portrait',
        q: 'Можно ли сфотографировать тебя для сайта?',
        why: 'Люди доверяют конкретному человеку сильнее, чем «мастерской».',
        a: ['Да, можно портрет', 'Только руки и работу', 'Со спины', 'Нет'],
      },
      {
        id: 'works',
        q: 'Есть фотографии готовых работ?',
        why: 'Каждая работа — отдельная страница в поиске. Это главный источник клиентов.',
        a: ['Да, много', 'Несколько найдётся', 'Почти нет', 'Нет совсем'],
      },
      {
        id: 'shoot',
        q: 'Можно приехать и поснимать мастерскую и процесс?',
        a: ['Да, в любое время', 'Да, но заранее договориться', 'Лучше не надо'],
      },
    ],
  },
];

/* --------------------------------------------------------------- вёрстка -- */

const total = Q.reduce((n, s) => n + s.items.length, 0);

const html = `<title>Анкета мастеру</title>
<style>
@font-face{font-family:'Onest';src:url('${font('onest-cyrillic.woff2')}') format('woff2');font-weight:300 800;font-display:swap;unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}
@font-face{font-family:'Onest';src:url('${font('onest-latin.woff2')}') format('woff2');font-weight:300 800;font-display:swap;}
@font-face{font-family:'Inter';src:url('${font('inter-cyrillic.woff2')}') format('woff2');font-weight:300 800;font-display:swap;unicode-range:U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116;}
@font-face{font-family:'Inter';src:url('${font('inter-latin.woff2')}') format('woff2');font-weight:300 800;font-display:swap;}

:root{
  color-scheme: light dark;
  --paper:#faf7f2; --raised:#fffdfa; --sunken:#efe9e0;
  --ink:#14110f; --ink-2:#46403a; --ink-3:#6e665e;
  --line:#e0d8cc; --line-2:#c7bcac;
  --accent:#c04a21; --accent-ink:#97381a; --accent-soft:#f8e8df; --on-accent:#fff;
  --ok:#3f6b3a;
  --display:'Onest',ui-sans-serif,system-ui,sans-serif;
  --body:'Inter',ui-sans-serif,system-ui,sans-serif;
  --mono:ui-monospace,'SF Mono',Menlo,monospace;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme='light']){
    --paper:#131110; --raised:#1c1917; --sunken:#0e0c0b;
    --ink:#f5f1ea; --ink-2:#b8afa4; --ink-3:#8b8279;
    --line:#2e2a27; --line-2:#453f3a;
    --accent:#e4794e; --accent-ink:#f3a882; --accent-soft:#2a1b14; --on-accent:#17110d;
    --ok:#8fbf86;
  }
}
:root[data-theme='dark']{
  --paper:#131110; --raised:#1c1917; --sunken:#0e0c0b;
  --ink:#f5f1ea; --ink-2:#b8afa4; --ink-3:#8b8279;
  --line:#2e2a27; --line-2:#453f3a;
  --accent:#e4794e; --accent-ink:#f3a882; --accent-soft:#2a1b14; --on-accent:#17110d;
  --ok:#8fbf86;
}

*,*::before,*::after{box-sizing:border-box}
body{
  margin:0; background:var(--paper); color:var(--ink);
  font-family:var(--body); font-size:16px; line-height:1.6;
  -webkit-font-smoothing:antialiased;
}
.wrap{max-width:44rem;margin:0 auto;padding:1.25rem 1.15rem 7rem}

header.top{padding:2rem 0 1.5rem;border-bottom:1px solid var(--line);margin-bottom:2rem}
.kicker{
  font-family:var(--mono);font-size:.7rem;letter-spacing:.12em;
  text-transform:uppercase;color:var(--accent-ink);margin:0 0 .6rem
}
h1{
  font-family:var(--display);font-size:clamp(1.7rem,1.2rem+2.2vw,2.5rem);
  font-weight:650;letter-spacing:-.03em;line-height:1.08;margin:0;text-wrap:balance
}
.sub{margin:.9rem 0 0;color:var(--ink-2);max-width:38rem}

.bar{
  position:sticky;top:0;z-index:5;margin:0 -1.15rem 1.5rem;
  padding:.6rem 1.15rem;background:color-mix(in srgb,var(--paper) 92%,transparent);
  backdrop-filter:blur(10px);border-bottom:1px solid var(--line);
  display:flex;align-items:center;gap:.75rem;font-size:.82rem
}
.bar progress{flex:1;height:5px;appearance:none;border:0;background:var(--line);border-radius:3px}
.bar progress::-webkit-progress-bar{background:var(--line);border-radius:3px}
.bar progress::-webkit-progress-value{background:var(--accent);border-radius:3px}
.bar progress::-moz-progress-bar{background:var(--accent);border-radius:3px}
.bar b{font-family:var(--mono);font-variant-numeric:tabular-nums;color:var(--ink-2);font-weight:500}

section{margin-bottom:2.5rem}
.sec-h{
  font-family:var(--display);font-size:.72rem;font-weight:650;letter-spacing:.13em;
  text-transform:uppercase;color:var(--ink-3);
  padding-bottom:.5rem;border-bottom:1px solid var(--line);margin:0 0 .35rem
}
.sec-hint{margin:.6rem 0 1.25rem;font-size:.85rem;color:var(--ink-3);max-width:34rem}

.q{
  background:var(--raised);border:1px solid var(--line);border-radius:12px;
  padding:1.1rem 1.15rem;margin-bottom:.7rem;transition:border-color .2s;
  /* Липкая полоса прогресса не должна накрывать карточку при прокрутке. */
  scroll-margin-top:4.5rem
}
.q[data-done]{border-color:color-mix(in srgb,var(--ok) 45%,transparent)}
.q-head{display:flex;gap:.7rem;align-items:baseline}
.q-no{
  font-family:var(--mono);font-size:.72rem;color:var(--ink-3);
  font-variant-numeric:tabular-nums;flex:none;padding-top:.15rem
}
.q-t{font-family:var(--display);font-weight:600;font-size:1.02rem;line-height:1.35;margin:0}
.q-why{margin:.5rem 0 0 1.9rem;font-size:.8rem;color:var(--ink-3);line-height:1.5}
.q-multi{margin:.5rem 0 0 1.9rem;font-size:.75rem;color:var(--accent-ink);font-weight:600}

.opts{display:flex;flex-wrap:wrap;gap:.4rem;margin:.85rem 0 0 1.9rem;padding:0;border:0}
.opt{position:relative}
.opt input{position:absolute;inset:0;opacity:0;cursor:pointer;margin:0}
.opt span{
  display:block;padding:.5rem .85rem;border:1.5px solid var(--line);
  border-radius:999px;font-size:.88rem;cursor:pointer;transition:.15s;
  user-select:none
}
.opt input:hover+span{border-color:var(--line-2)}
.opt input:checked+span{
  background:var(--accent);border-color:var(--accent);color:var(--on-accent);font-weight:550
}
.opt input:focus-visible+span{outline:2.5px solid var(--accent-ink);outline-offset:2px}

.note{margin:.7rem 0 0 1.9rem}
.note input{
  width:100%;padding:.55rem .8rem;background:var(--paper);
  border:1.5px solid var(--line);border-radius:8px;font:inherit;font-size:.88rem;color:inherit
}
.note input:focus{outline:none;border-color:var(--accent)}
.note input::placeholder{color:var(--ink-3)}

.done{
  position:fixed;left:0;right:0;bottom:0;padding:.75rem 1.15rem calc(.75rem + env(safe-area-inset-bottom));
  background:color-mix(in srgb,var(--paper) 94%,transparent);backdrop-filter:blur(10px);
  border-top:1px solid var(--line)
}
.done-in{max-width:44rem;margin:0 auto;display:flex;gap:.6rem;align-items:center}
button.go{
  flex:1;min-height:3rem;padding:.8rem 1.2rem;border:0;border-radius:999px;
  background:var(--ink);color:var(--paper);font-family:var(--display);
  font-size:1rem;font-weight:650;cursor:pointer
}
button.go:hover{opacity:.9}
.done small{font-size:.75rem;color:var(--ink-3);flex:none}

dialog{
  width:min(40rem,94vw);border:0;border-radius:16px;padding:0;
  background:var(--raised);color:var(--ink)
}
dialog::backdrop{background:rgb(10 8 7/.6)}
.dlg{padding:1.5rem}
.dlg h2{font-family:var(--display);font-size:1.25rem;margin:0 0 .5rem}
.dlg p{margin:0 0 1rem;color:var(--ink-2);font-size:.9rem}
textarea{
  width:100%;min-height:16rem;padding:.9rem;background:var(--paper);
  border:1.5px solid var(--line);border-radius:10px;
  font-family:var(--mono);font-size:.78rem;line-height:1.55;color:inherit;resize:vertical
}
.dlg-act{display:flex;gap:.5rem;margin-top:.9rem;flex-wrap:wrap}
.dlg-act button{
  padding:.65rem 1.1rem;border-radius:999px;border:1.5px solid var(--line-2);
  background:transparent;color:inherit;font:inherit;font-size:.88rem;font-weight:600;cursor:pointer
}
.dlg-act button.primary{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.ok{color:var(--ok);font-size:.82rem;font-weight:600}

@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>

<div class="wrap">
  <header class="top">
    <p class="kicker">Для сайта мастерской</p>
    <h1>Короткая анкета</h1>
    <p class="sub">
      ${total} вопросов с готовыми ответами — нужно только выбрать. Пять минут.
      Пропускать можно любые. В конце появится текст, который надо скопировать
      и отправить обратно.
    </p>
  </header>

  <div class="bar">
    <progress id="pr" max="${total}" value="0"></progress>
    <b id="cnt">0 / ${total}</b>
  </div>

  <form id="f">
${Q.map(
  (sec) => `    <section>
      <h2 class="sec-h">${sec.section}</h2>
      ${sec.hint ? `<p class="sec-hint">${sec.hint}</p>` : ''}
${sec.items
  .map(
    (it) => `      <div class="q" data-q data-id="${it.id}" data-label="${it.q.replace(/"/g, '&quot;')}">
        <div class="q-head">
          <span class="q-no" data-no></span>
          <p class="q-t">${it.q}</p>
        </div>
        ${it.why ? `<p class="q-why">${it.why}</p>` : ''}
        ${it.multi ? '<p class="q-multi">можно выбрать несколько</p>' : ''}
        <fieldset class="opts">
${it.a
  .map(
    (opt, i) => `          <label class="opt"><input type="${it.multi ? 'checkbox' : 'radio'}" name="${it.id}" value="${opt.replace(/"/g, '&quot;')}" ${it.multi ? '' : ''}><span>${opt}</span></label>`
  )
  .join('\n')}
        </fieldset>
        <div class="note"><input type="text" data-note placeholder="Добавить своими словами — необязательно"></div>
      </div>`
  )
  .join('\n')}
    </section>`
).join('\n')}
  </form>
</div>

<div class="done">
  <div class="done-in">
    <button class="go" type="button" id="finish">Готово — показать ответы</button>
  </div>
</div>

<dialog id="out">
  <div class="dlg">
    <h2>Ответы готовы</h2>
    <p>Скопируйте этот текст и отправьте обратно — в WhatsApp, Telegram, куда удобно.</p>
    <textarea id="txt" readonly></textarea>
    <div class="dlg-act">
      <button type="button" class="primary" id="copy">Скопировать</button>
      <button type="button" id="close">Закрыть</button>
      <span class="ok" id="okmsg" hidden>Скопировано</span>
    </div>
  </div>
</dialog>

<script>
(function(){
  var form=document.getElementById('f');
  var cards=[].slice.call(form.querySelectorAll('[data-q]'));
  var pr=document.getElementById('pr'), cnt=document.getElementById('cnt');

  cards.forEach(function(c,i){ c.querySelector('[data-no]').textContent=String(i+1).padStart(2,'0'); });

  function answered(c){
    if (c.querySelector('input[type=radio]:checked, input[type=checkbox]:checked')) return true;
    var n=c.querySelector('[data-note]');
    return !!(n && n.value.trim());
  }
  function sync(){
    var n=0;
    cards.forEach(function(c){
      var ok=answered(c);
      if(ok){ n++; c.setAttribute('data-done',''); } else c.removeAttribute('data-done');
    });
    pr.value=n; cnt.textContent=n+' / '+cards.length;
  }
  form.addEventListener('change',sync);
  form.addEventListener('input',sync);
  sync();

  function build(){
    var out=['ОТВЕТЫ ПО АНКЕТЕ','']; var n=0;
    cards.forEach(function(c,i){
      var picked=[].slice.call(c.querySelectorAll('input:checked')).map(function(x){return x.value;});
      var note=c.querySelector('[data-note]').value.trim();
      if(!picked.length && !note) return;
      n++;
      out.push((i+1)+'. '+c.getAttribute('data-label'));
      if(picked.length) out.push('   → '+picked.join('; '));
      if(note) out.push('   * '+note);
      out.push('');
    });
    if(!n) return 'Пока ничего не выбрано.';
    out.push('—'); out.push('Отвечено: '+n+' из '+cards.length);
    return out.join('\\n');
  }

  var dlg=document.getElementById('out'), txt=document.getElementById('txt');
  document.getElementById('finish').addEventListener('click',function(){
    txt.value=build();
    if(dlg.showModal) dlg.showModal(); else dlg.setAttribute('open','');
    txt.focus(); txt.setSelectionRange(0,0);
  });
  document.getElementById('close').addEventListener('click',function(){ dlg.close(); });
  document.getElementById('copy').addEventListener('click',function(){
    var ok=document.getElementById('okmsg');
    txt.select(); txt.setSelectionRange(0,txt.value.length);
    function shown(){ ok.hidden=false; setTimeout(function(){ok.hidden=true;},2500); }
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(txt.value).then(shown,function(){
        // Буфер может быть недоступен — текст уже выделен, останется Ctrl+C.
        try{document.execCommand('copy');shown();}catch(e){}
      });
    } else { try{document.execCommand('copy');shown();}catch(e){} }
  });
})();
</script>
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');
console.log(`${OUT}: ${total} вопросов, ${(Buffer.byteLength(html) / 1024).toFixed(0)} КБ`);
