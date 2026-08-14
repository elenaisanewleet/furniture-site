import { bindDeclarative, track } from './analytics';
import { initTaskForms } from './task-form';
import { initBeforeAfter } from './before-after';
import { initPartFinder } from './part-finder';

/**
 * Client wiring.
 *
 * With view transitions the document body is swapped in place and module
 * scripts are NOT re-evaluated, so `boot()` runs again on every navigation.
 * That makes idempotence a hard requirement, and there are two kinds of it:
 *
 *   • listeners on elements — the elements are replaced on navigation, so
 *     each new one is wired once, guarded by `wire()`;
 *   • listeners on window/document — those survive navigation, so they are
 *     attached exactly once and re-query the DOM when they fire.
 */

/** Returns false if this element was already wired by an earlier boot. */
function wire(el: HTMLElement, key: string): boolean {
  const flag = `wired${key}`;
  if (el.dataset[flag]) return false;
  el.dataset[flag] = '1';
  return true;
}

let globalsBound = false;

/* ---------------------------------------------------------------- header */

function headerAndScroll() {
  const sync = () => {
    const y = window.scrollY;

    const hdr = document.querySelector<HTMLElement>('[data-header]');
    if (hdr) hdr.classList.toggle('is-stuck', y > 8);

    const bar = document.querySelector<HTMLElement>('[data-sticky-cta]');
    if (bar) {
      const past = y > window.innerHeight * 0.55;
      const nearBottom =
        y + window.innerHeight > document.documentElement.scrollHeight - 240;
      const down = y > lastY;
      bar.dataset.visible = String(past && (!down || nearBottom));
    }

    lastY = y;
  };

  let lastY = window.scrollY;
  sync();
  if (globalsBound) return;
  addEventListener('scroll', sync, { passive: true });
}

function mobileNav() {
  const burger = document.querySelector<HTMLButtonElement>('[data-burger]');
  const nav = document.querySelector<HTMLElement>('[data-mobile-nav]');
  if (!burger || !nav || !wire(burger, 'Nav')) return;

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
  if (!btn || !menu || !wire(btn, 'Mega')) return;

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

/* --------------------------------------------------------------- dialog */

function taskDialog() {
  const dlg = document.querySelector<HTMLDialogElement>('[data-task-dialog]');
  const usable = dlg && typeof dlg.showModal === 'function';

  document.querySelectorAll<HTMLElement>('[data-open-task]').forEach((btn) => {
    if (!wire(btn, 'Open')) return;

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
      dlg!.querySelector<HTMLElement>('.tdlg__title')?.focus();
    });
  });

  if (!usable || !wire(dlg!, 'Dlg')) return;

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
  if (!input || !wire(input, 'Intake')) return;

  const handoff = (list: FileList | null) => {
    if (!list?.length) return;
    track('photo_upload_started', { where: 'home_intake' });

    const form = dlg?.querySelector<HTMLFormElement>('[data-task-form]');
    const target = form?.querySelector<HTMLInputElement>('[data-files="photos"]');

    if (!form || !target || typeof dlg?.showModal !== 'function') {
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

/* ------------------------------------------------------------- polish */

/**
 * Primary actions drift a few pixels toward the cursor. Pointer-fine only —
 * on touch it would just cause jitter — and disabled under reduced motion.
 */
function magnetics() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  document.querySelectorAll<HTMLElement>('[data-magnet]').forEach((el) => {
    if (!wire(el, 'Magnet')) return;
    const reset = () => {
      el.style.setProperty('--mx', '0px');
      el.style.setProperty('--my', '0px');
    };
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.setProperty('--mx', `${(dx * 12).toFixed(1)}px`);
      el.style.setProperty('--my', `${(dy * 8).toFixed(1)}px`);
    });
    el.addEventListener('pointerleave', reset);
    reset();
  });
}

/** Slow counter-drift on large images, from one rAF-throttled listener. */
function parallax() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let ticking = false;
  const update = () => {
    ticking = false;
    const vh = window.innerHeight;
    document.querySelectorAll<HTMLElement>('[data-parallax]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const progress = (r.top + r.height / 2 - vh / 2) / vh;
      el.style.setProperty('--shift', `${(progress * -38).toFixed(1)}px`);
    });
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  update();
  if (globalsBound) return;
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
}

/* --------------------------------------------------------------- reveal */

function reveal() {
  // .dw — рисунки: линия прочерчивается, когда лист попал в кадр.
  const items = document.querySelectorAll<HTMLElement>('.reveal, .reveal-up, .reveal-wipe, .dw');
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
  items.forEach((i) => {
    if (wire(i, 'Reveal')) io.observe(i);
  });
}

/* --------------------------------------------------------------- boot */

function boot() {
  bindDeclarative();
  headerAndScroll();
  mobileNav();
  megaMenu();
  taskDialog();
  quickIntake();
  magnetics();
  parallax();
  reveal();
  initTaskForms();
  initBeforeAfter();
  initPartFinder();
  globalsBound = true;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}

// Fires on the initial load too when the view-transition router is active,
// which is why every step above must be safe to run more than once.
document.addEventListener('astro:page-load', boot);
