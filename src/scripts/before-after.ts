/**
 * Before/after comparison.
 *
 * Driven by a real <input type="range">, so it is keyboard-operable and
 * screen-reader-announced for free, and it still shows both images side by
 * side if JS never runs.
 */
export function initBeforeAfter() {
  document.querySelectorAll<HTMLElement>('[data-before-after]').forEach((el) => {
    const range = el.querySelector<HTMLInputElement>('input[type="range"]');
    if (!range) return;

    const apply = () => el.style.setProperty('--split', `${range.value}%`);
    apply();
    range.addEventListener('input', apply);

    // Dragging anywhere on the image is more natural than finding the handle.
    const fromPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const pct = ((e.clientX - r.left) / r.width) * 100;
      range.value = String(Math.max(0, Math.min(100, Math.round(pct))));
      apply();
    };

    el.addEventListener('pointerdown', (e) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      el.setPointerCapture(e.pointerId);
      fromPointer(e);
    });
    el.addEventListener('pointermove', (e) => {
      if (el.hasPointerCapture(e.pointerId)) fromPointer(e);
    });
    el.addEventListener('pointerup', (e) => el.releasePointerCapture(e.pointerId));
  });
}
