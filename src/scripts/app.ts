import { bindDeclarative, track } from './analytics';
import { initTaskForms } from './task-form';
import { initBeforeAfter } from './before-after';

/* ---------------------------------------------------------------- header */

function header() {
  const el = document.querySelector<HTMLElement>('[data-header]');
  if (!el) return;
  const onScroll = () => el.classList.toggle('is-stuck', window.scrollY > 8);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
}

function mobileNav() {
  const burger = document.querySelector<HTMLButtonElement>('[data-burger]');
  const nav = document.querySelector<HTMLElement>('[data-mobile-nav]');
  if (!burger || !nav) return;

  const set = (open: boolean) => {
    burger.setAttribute('aria-expanded', String(open));
    nav.hidden = !open;
    document.body.style.overflow = open ? 'hidden' : '';
  };

  burger.addEventListener('click', () =>
    set(burger.getAttribute('aria-expanded') !== 'true')
  );
  nav.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('a')) set(false);
  });
  addEventListener('keydown', (e) => e.key === 'Escape' && set(false));
  // Rotating into desktop must not leave a stuck scroll lock.
  matchMedia('(min-width: 60rem)').addEventListener('change', (m) => m.matches && set(false));
}

function megaMenu() {
  const btn = document.querySelector<HTMLButtonElement>('[data-disclosure]');
  const menu = document.querySelector<HTMLElement>('[data-menu]');
  if (!btn || !menu) return;

  let closeTimer = 0;
  const set = (open: boolean) => {
    btn.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  };
  const host = btn.closest('li')!;

  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  host.addEventListener('mouseenter', () => {
    clearTimeout(closeTimer);
    set(true);
  });
  host.addEventListener('mouseleave', () => {
    closeTimer = window.setTimeout(() => set(false), 160);
  });
  menu.addEventListener('mouseenter', () => clearTimeout(closeTimer));
  menu.addEventListener('mouseleave', () => {
    closeTimer = window.setTimeout(() => set(false), 160);
  });
  addEventListener('keydown', (e) => e.key === 'Escape' && set(false));
  document.addEventListener('focusin', (e) => {
    if (!host.contains(e.target as Node) && !menu.contains(e.target as Node)) set(false);
  });
}

/* ------------------------------------------------------------ sticky CTA */

function stickyCta() {
  const bar = document.querySelector<HTMLElement>('[data-sticky-cta]');
  if (!bar) return;

  let last = window.scrollY;
  const update = () => {
    const y = window.scrollY;
    const down = y > last;
    last = y;
    // Appears once the hero is behind you; retreats while scrolling down so
    // it never fights with the content being read.
    const past = y > window.innerHeight * 0.55;
    const nearBottom =
      y + window.innerHeight > document.documentElement.scrollHeight - 240;
    bar.dataset.visible = String(past && (!down || nearBottom));
  };
  update();
  addEventListener('scroll', update, { passive: true });
}

/* --------------------------------------------------------------- dialog */

function taskDialog() {
  const dlg = document.querySelector<HTMLDialogElement>('[data-task-dialog]');
  const openers = document.querySelectorAll<HTMLElement>('[data-open-task]');
  if (!openers.length) return;

  const usable = dlg && typeof dlg.showModal === 'function';

  openers.forEach((btn) => {
    if (!usable) {
      // No <dialog> support: send them to the standalone page instead.
      const a = document.createElement('a');
      a.className = btn.className;
      a.href = '/pokazat-zadachu/';
      a.innerHTML = btn.innerHTML;
      btn.replaceWith(a);
      return;
    }

    btn.addEventListener('click', () => {
      track('hero_cta_click', { where: btn.dataset.cta ?? 'unknown' });
      const preset = btn.dataset.preset;
      if (preset) {
        const input = dlg!.querySelector<HTMLInputElement>(
          `[name="request_type"][value="${CSS.escape(preset)}"]`
        );
        if (input) {
          input.checked = true;
          input.dispatchEvent(new Event('change', { bubbles: true }));
          // Skip step 1 immediately — the change handler's own transition
          // would otherwise flash the (already answered) first question.
          dlg!
            .querySelector('[data-task-form]')
            ?.dispatchEvent(new CustomEvent('task:goto', { detail: 2 }));
        }
      }
      dlg!.showModal();
      document.body.style.overflow = 'hidden';
      // Focus the panel, not the first radio — less jarring on open.
      dlg!.querySelector<HTMLElement>('.tdlg__title')?.focus();
    });
  });

  if (!usable) return;

  dlg!.querySelectorAll('[data-close-task]').forEach((b) =>
    b.addEventListener('click', () => dlg!.close())
  );
  dlg!.addEventListener('close', () => {
    document.body.style.overflow = '';
  });
  // Click on the backdrop closes; clicks inside the panel do not.
  dlg!.addEventListener('click', (e) => {
    if (e.target === dlg) dlg!.close();
  });
}

/* --------------------------------------------------------- quick intake */

function quickIntake() {
  const drop = document.querySelector<HTMLElement>('[data-quick-drop]');
  const input = document.querySelector<HTMLInputElement>('[data-quick-intake]');
  const dlg = document.querySelector<HTMLDialogElement>('[data-task-dialog]');
  if (!input) return;

  const handoff = (list: FileList | null) => {
    if (!list?.length) return;
    track('photo_upload_started', { where: 'home_intake' });

    const form = dlg?.querySelector<HTMLFormElement>('[data-task-form]');
    const target = form?.querySelector<HTMLInputElement>('[data-files="photos"]');

    if (!form || !target || typeof dlg?.showModal !== 'function') {
      // No dialog available — carry on to the standalone page.
      location.href = '/pokazat-zadachu/';
      return;
    }

    const dt = new DataTransfer();
    [...list].forEach((f) => dt.items.add(f));
    target.files = dt.files;
    target.dispatchEvent(new Event('change', { bubbles: true }));

    dlg.showModal();
    document.body.style.overflow = 'hidden';
    form.dispatchEvent(new CustomEvent('task:goto', { detail: 2 }));
  };

  input.addEventListener('change', () => {
    handoff(input.files);
    input.value = '';
  });

  if (!drop) return;
  ['dragenter', 'dragover'].forEach((t) =>
    drop.addEventListener(t, (e) => {
      e.preventDefault();
      drop.setAttribute('data-dragover', '');
    })
  );
  ['dragleave', 'drop'].forEach((t) =>
    drop.addEventListener(t, () => drop.removeAttribute('data-dragover'))
  );
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    handoff((e as DragEvent).dataTransfer?.files ?? null);
  });
}

/* --------------------------------------------------------------- reveal */

function reveal() {
  const items = document.querySelectorAll<HTMLElement>('.reveal');
  if (!items.length) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    items.forEach((i) => i.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
  );
  items.forEach((i) => io.observe(i));
}

/* --------------------------------------------------------------- boot */

function boot() {
  bindDeclarative();
  header();
  mobileNav();
  megaMenu();
  stickyCta();
  taskDialog();
  quickIntake();
  reveal();
  initTaskForms();
  initBeforeAfter();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
