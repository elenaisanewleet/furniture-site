/**
 * Analytics.
 *
 * Vendor-neutral: every event lands in `dataLayer` and, when the Metrika
 * counter is present, in `reachGoal`. Never carries personal data — no
 * phone, no name, no description, no file contents. Only the shape of the
 * interaction: which step, which type, which page.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    ym?: (id: number, action: string, ...rest: unknown[]) => void;
  }
}

let counterId: number | null = null;

function resolveCounter(): number | null {
  if (counterId !== null) return counterId;
  const raw = document.querySelector<HTMLElement>('[data-metrika]')?.dataset.metrika;
  counterId = raw ? Number(raw) : null;
  return counterId;
}

export type EventName =
  | 'hero_cta_click'
  | 'form_started'
  | 'request_type_selected'
  | 'photo_upload_started'
  | 'photo_upload_completed'
  | 'reference_added'
  | 'voice_description_started'
  | 'voice_description_completed'
  | 'form_step_completed'
  | 'form_completed'
  | 'form_abandoned'
  | 'phone_click'
  | 'messenger_click'
  | 'project_opened'
  | 'service_opened';

export function track(name: EventName, params: Record<string, string | number> = {}) {
  const payload = { event: name, ...params, page: location.pathname };
  (window.dataLayer ||= []).push(payload);

  const id = resolveCounter();
  if (id && typeof window.ym === 'function') {
    window.ym(id, 'reachGoal', name, params);
  }

  if (import.meta.env.DEV) console.debug('[track]', name, params);
}

let declarativeBound = false;

/** Wires every element carrying `data-track`. Delegated, so bind once. */
export function bindDeclarative() {
  if (declarativeBound) return;
  declarativeBound = true;
  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('[data-track]');
      if (!el) return;
      track(el.dataset.track as EventName, {
        where: el.dataset.trackWhere ?? 'unknown',
      });
    },
    { passive: true }
  );
}
