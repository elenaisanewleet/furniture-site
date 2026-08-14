import { track } from './analytics';

/**
 * Определитель детали.
 *
 * Filtering happens over data attributes rendered at build time, so the full
 * catalogue is in the HTML and works with JS disabled. The search is
 * deliberately forgiving: Russian visitors type «рельса», «направляйка»,
 * «дверца висит» — a strict substring match would find none of those, so we
 * normalise, drop the last letters of long words, and match on stems.
 */

/**
 * Progressively shorter prefixes of a word, longest first.
 *
 * Russian inflection means «направляющая», «направляйка» and «направляшка»
 * all point at the same part, and visitors type all three. Comparing stems
 * of decreasing length catches those without shipping a morphology library.
 */
function stems(word: string): string[] {
  const out: string[] = [word];
  for (let len = word.length - 1; len >= 4 && len >= word.length - 4; len--) {
    out.push(word.slice(0, len));
  }
  return out;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9\s-]/gi, ' ');
}

export function initPartFinder() {
  const root = document.querySelector<HTMLElement>('[data-part-finder]');
  // Re-runs on every view transition; wire each instance exactly once.
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';

  const cards = [...root.querySelectorAll<HTMLElement>('[data-pf-card]')];
  const search = root.querySelector<HTMLInputElement>('[data-pf-search]');
  const clear = root.querySelector<HTMLButtonElement>('[data-pf-clear]');
  const count = root.querySelector<HTMLElement>('[data-pf-count]');
  const empty = root.querySelector<HTMLElement>('[data-pf-empty]');
  const places = [...root.querySelectorAll<HTMLButtonElement>('[data-pf-place]')];

  let place = 'all';
  let query = '';

  const apply = () => {
    const terms = normalise(query)
      .split(/\s+/)
      .filter((t) => t.length > 1)
      .map(stems);
    let shown = 0;

    for (const card of cards) {
      const inPlace = place === 'all' || (card.dataset.place || '').includes(place);
      const hay = normalise(card.dataset.keywords || '');
      // Every typed word must match on at least one of its prefixes.
      const matches =
        terms.length === 0 || terms.every((variants) => variants.some((v) => hay.includes(v)));
      const visible = inPlace && matches;
      card.hidden = !visible;
      if (visible) shown += 1;
    }

    if (count) {
      count.textContent =
        query || place !== 'all' ? `Подходит: ${shown} из ${cards.length}` : '';
    }
    if (empty) empty.hidden = shown > 0;
    if (clear) clear.hidden = !query;
  };

  let debounce = 0;
  search?.addEventListener('input', () => {
    query = search.value;
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => {
      apply();
      if (query.length > 2) track('service_opened', { where: 'partfinder_search' });
    }, 120);
  });

  clear?.addEventListener('click', () => {
    query = '';
    if (search) search.value = '';
    apply();
    search?.focus();
  });

  places.forEach((btn) =>
    btn.addEventListener('click', () => {
      place = btn.dataset.pfPlace || 'all';
      places.forEach((b) => b.classList.toggle('is-on', b === btn));
      apply();
      track('request_type_selected', { type: `place_${place}` });
    })
  );

  // Only one card open at a time — otherwise the grid turns into a wall.
  root.querySelectorAll<HTMLButtonElement>('[data-pf-toggle]').forEach((toggle) => {
    const detail = toggle.parentElement?.querySelector<HTMLElement>('[data-pf-detail]');
    if (!detail) return;

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';

      root.querySelectorAll<HTMLButtonElement>('[data-pf-toggle]').forEach((t) => {
        t.setAttribute('aria-expanded', 'false');
        t.parentElement?.querySelector<HTMLElement>('[data-pf-detail]')?.setAttribute('hidden', '');
      });

      if (!open) {
        toggle.setAttribute('aria-expanded', 'true');
        detail.removeAttribute('hidden');
        track('project_opened', { where: 'partfinder' });
        // Keep the card in view once it grows to full width.
        requestAnimationFrame(() =>
          toggle.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        );
      }
    });
  });

  apply();
}
