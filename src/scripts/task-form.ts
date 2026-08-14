import { track } from './analytics';

/**
 * The request flow.
 *
 * Without JS the form is a single long page that posts natively. With JS it
 * becomes four steps with previews, voice and background upload. Every
 * enhancement degrades: if the microphone is unavailable the voice block
 * never appears; if the endpoint is unset the form runs in demo mode and
 * says so instead of pretending to send.
 */

const MAX_FILES = 8;
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_VOICE_MS = 90_000;
const STORE_KEY = 'task-draft-v1';

type Bucket = 'photos' | 'references';

interface Draft {
  request_type?: string;
  description?: string;
  phone?: string;
  name?: string;
  preferred_contact?: string;
}

export function initTaskForms() {
  document.querySelectorAll<HTMLFormElement>('[data-task-form]').forEach(setup);
}

function setup(form: HTMLFormElement) {
  if (form.dataset.ready) return;
  form.dataset.ready = 'true';

  const steps = [...form.querySelectorAll<HTMLElement>('.tf__step')];
  const numbered = steps.filter((s) => /^\d+$/.test(s.dataset.step ?? ''));
  const live = form.querySelector<HTMLElement>('[data-live]');
  const files: Record<Bucket, File[]> = { photos: [], references: [] };
  let voiceBlob: Blob | null = null;
  let current = 1;
  let started = false;
  let sent = false;

  /* ---------------------------------------------------------------- steps */

  const show = (step: string) => {
    steps.forEach((s) => {
      const on = s.dataset.step === step;
      s.toggleAttribute('data-active', on);
    });
    const n = Number(step);
    if (!Number.isNaN(n)) {
      current = n;
      form.querySelectorAll<HTMLElement>('[data-step-dot]').forEach((dot) => {
        const i = Number(dot.dataset.stepDot);
        dot.dataset.state = i < n ? 'done' : i === n ? 'current' : 'todo';
      });
      const legend = steps.find((s) => s.dataset.step === step)?.querySelector('.tf__legend');
      if (live && legend) live.textContent = `Шаг ${n} из ${numbered.length}. ${legend.textContent?.trim()}`;
    }
    // Keep the top of the step in view inside dialog or page.
    const scroller = form.closest('.tdlg__body') ?? null;
    if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
    else if (started) form.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const begin = () => {
    if (started) return;
    started = true;
    track('form_started', { form: form.id });
  };

  form.querySelectorAll('[data-next]').forEach((b) =>
    b.addEventListener('click', () => {
      begin();
      track('form_step_completed', { step: current });
      save();
      show(String(Math.min(current + 1, numbered.length)));
    })
  );

  form.querySelectorAll('[data-prev]').forEach((b) =>
    b.addEventListener('click', () => show(String(Math.max(current - 1, 1))))
  );

  form.querySelectorAll('[data-retry]').forEach((b) =>
    b.addEventListener('click', () => show('4'))
  );

  // Lets outside controls (the home-page intake) jump straight to a step.
  form.addEventListener('task:goto', (e) => {
    begin();
    show(String((e as CustomEvent<number>).detail));
  });

  /* ----------------------------------------------------------- step 1 type */

  form.querySelectorAll<HTMLInputElement>('[data-type-input]').forEach((input) =>
    input.addEventListener('change', () => {
      begin();
      track('request_type_selected', { type: input.value });
      save();
      // Choosing is the whole of step 1 — move on without a second tap.
      window.setTimeout(() => show('2'), 180);
    })
  );

  /* ---------------------------------------------------------- step 2 files */

  (['photos', 'references'] as Bucket[]).forEach((bucket) => {
    const input = form.querySelector<HTMLInputElement>(`[data-files="${bucket}"]`);
    const drop = form.querySelector<HTMLElement>(`[data-drop="${bucket}"]`);
    const list = form.querySelector<HTMLElement>(`[data-thumbs="${bucket}"]`);
    if (!input || !list) return;

    const render = () => {
      list.textContent = '';
      files[bucket].forEach((file, i) => {
        const li = document.createElement('li');
        const ok = file.size <= MAX_BYTES;
        if (ok && file.type.startsWith('image/')) {
          const img = document.createElement('img');
          img.alt = '';
          img.src = URL.createObjectURL(file);
          img.addEventListener('load', () => URL.revokeObjectURL(img.src), { once: true });
          li.append(img);
        } else {
          const bad = document.createElement('span');
          bad.className = 'tf__thumb-bad';
          bad.textContent = ok ? file.name.slice(0, 22) : 'слишком большой файл';
          li.append(bad);
        }
        const x = document.createElement('button');
        x.type = 'button';
        x.className = 'tf__thumb-x';
        x.innerHTML = '&times;';
        x.setAttribute('aria-label', `Убрать ${file.name}`);
        x.addEventListener('click', () => {
          files[bucket].splice(i, 1);
          sync();
        });
        li.append(x);
        list.append(li);
      });
    };

    // Mirror our array back into the input so a native fallback submit works.
    const sync = () => {
      const dt = new DataTransfer();
      files[bucket].forEach((f) => dt.items.add(f));
      input.files = dt.files;
      render();
    };

    const add = (incoming: FileList | File[]) => {
      begin();
      if (bucket === 'photos') track('photo_upload_started', {});
      const room = MAX_FILES - files[bucket].length;
      const accepted = [...incoming].slice(0, Math.max(room, 0));
      files[bucket].push(...accepted);
      sync();
      if (accepted.length) {
        track(bucket === 'photos' ? 'photo_upload_completed' : 'reference_added', {
          count: files[bucket].length,
        });
      }
    };

    input.addEventListener('change', () => {
      // The input holds only the latest pick; merge it into what we have.
      const picked = [...(input.files ?? [])];
      const known = new Set(files[bucket].map(fingerprint));
      add(picked.filter((f) => !known.has(fingerprint(f))));
    });

    if (drop) {
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
        const dropped = (e as DragEvent).dataTransfer?.files;
        if (dropped?.length) add(dropped);
      });
    }
  });

  /* ---------------------------------------------------------- step 3 voice */

  setupVoice(form, (blob) => (voiceBlob = blob));

  /* ------------------------------------------------------------- step 4 */

  const phoneInput = form.querySelector<HTMLInputElement>('[data-phone]');
  phoneInput?.addEventListener('blur', () => validatePhone(form, false));
  phoneInput?.addEventListener('input', () => {
    if (phoneInput.getAttribute('aria-invalid') === 'true') validatePhone(form, false);
    save();
  });

  form.querySelector('[data-consent]')?.addEventListener('change', () =>
    setError(form, 'consent', '')
  );
  form.querySelector('[name="description"]')?.addEventListener('input', save);
  form.querySelector('[name="name"]')?.addEventListener('input', save);
  form
    .querySelectorAll('[name="preferred_contact"]')
    .forEach((r) => r.addEventListener('change', save));

  /* -------------------------------------------------------------- submit */

  form.addEventListener('submit', async (e) => {
    // Bots that filled the honeypot get a silent no-op.
    const trap = form.querySelector<HTMLInputElement>('.tf__trap');
    if (trap?.value) {
      e.preventDefault();
      return;
    }

    const endpoint = form.dataset.endpoint;
    if (!endpoint) {
      // Demo mode: no backend wired up yet. Say so rather than fake success.
      e.preventDefault();
      if (!validate(form)) return;
      show('error');
      const msg = form.querySelector('[data-error-text]');
      if (msg)
        msg.textContent =
          'Приём заявок ещё не подключён: не задан адрес обработчика (PUBLIC_LEAD_ENDPOINT). Пока можно позвонить.';
      return;
    }

    e.preventDefault();
    if (!validate(form)) return;
    if (sent) return;

    const btn = form.querySelector<HTMLButtonElement>('[data-submit]');
    const label = form.querySelector<HTMLElement>('[data-submit-label]');
    const was = label?.textContent ?? '';
    if (btn) btn.disabled = true;
    if (label) label.textContent = 'Отправляем…';

    try {
      const fd = new FormData(form);
      fd.delete('photos');
      fd.delete('references');
      files.photos.forEach((f) => fd.append('photos', f, f.name));
      files.references.forEach((f) => fd.append('references', f, f.name));
      if (voiceBlob) fd.append('voice', voiceBlob, 'voice.webm');

      const res = await fetch(endpoint, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      sent = true;
      track('form_completed', {
        type: (fd.get('request_type') as string) || 'none',
        photos: files.photos.length,
        voice: voiceBlob ? 1 : 0,
      });
      sessionStorage.removeItem(STORE_KEY);
      show('done');
    } catch (err) {
      show('error');
      const msg = form.querySelector('[data-error-text]');
      if (msg)
        msg.textContent =
          'Не получилось отправить — возможно, пропала связь. Попробуйте ещё раз или позвоните.';
      if (import.meta.env.DEV) console.error(err);
    } finally {
      if (btn) btn.disabled = false;
      if (label) label.textContent = was;
    }
  });

  /* ------------------------------------------------------------- draft */

  function save() {
    const draft: Draft = {
      request_type: (form.querySelector<HTMLInputElement>('[name="request_type"]:checked')?.value),
      description: form.querySelector<HTMLTextAreaElement>('[name="description"]')?.value,
      phone: form.querySelector<HTMLInputElement>('[name="phone"]')?.value,
      name: form.querySelector<HTMLInputElement>('[name="name"]')?.value,
      preferred_contact: form.querySelector<HTMLInputElement>('[name="preferred_contact"]:checked')?.value,
    };
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(draft));
    } catch {
      /* private mode — drafts are a convenience, not a requirement */
    }
  }

  function restore() {
    let draft: Draft | null = null;
    try {
      draft = JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null');
    } catch {
      draft = null;
    }
    if (!draft) return;
    const set = (sel: string, v?: string) => {
      if (!v) return;
      const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement>(sel);
      if (el) el.value = v;
    };
    set('[name="description"]', draft.description);
    set('[name="phone"]', draft.phone);
    set('[name="name"]', draft.name);
    if (draft.request_type) {
      const r = form.querySelector<HTMLInputElement>(
        `[name="request_type"][value="${CSS.escape(draft.request_type)}"]`
      );
      if (r) r.checked = true;
    }
    if (draft.preferred_contact) {
      const r = form.querySelector<HTMLInputElement>(
        `[name="preferred_contact"][value="${CSS.escape(draft.preferred_contact)}"]`
      );
      if (r) r.checked = true;
    }
  }

  restore();

  // Context for the operator: which page and which button produced this lead.
  const setHidden = (k: string, v: string) => {
    const el = form.querySelector<HTMLInputElement>(`[data-field="${k}"]`);
    if (el) el.value = v;
  };
  setHidden('landing_page', location.pathname + location.search);
  setHidden('utm', location.search.replace(/^\?/, ''));

  // A preset arriving from a service page skips straight to "show me".
  const preset = form.dataset.preset;
  if (preset) {
    const r = form.querySelector<HTMLInputElement>(
      `[name="request_type"][value="${CSS.escape(preset)}"]`
    );
    if (r) r.checked = true;
  }

  show(form.querySelector<HTMLInputElement>('[name="request_type"]:checked') ? '2' : '1');

  window.addEventListener('pagehide', () => {
    if (started && !sent) track('form_abandoned', { step: current });
  });
}

/* ------------------------------------------------------------------ utils */

function fingerprint(f: File) {
  return `${f.name}:${f.size}:${f.lastModified}`;
}

function setError(form: HTMLFormElement, key: string, msg: string) {
  const el = form.querySelector<HTMLElement>(`[data-err="${key}"]`);
  if (el) el.textContent = msg;
}

function digits(s: string) {
  return s.replace(/\D/g, '');
}

function validatePhone(form: HTMLFormElement, focus: boolean): boolean {
  const input = form.querySelector<HTMLInputElement>('[data-phone]');
  if (!input) return true;
  const d = digits(input.value);
  const ok = d.length >= 10 && d.length <= 15;
  input.setAttribute('aria-invalid', ok ? 'false' : 'true');
  setError(form, 'phone', ok ? '' : 'Проверьте номер — нужно не меньше 10 цифр.');
  if (!ok && focus) input.focus();
  return ok;
}

function validate(form: HTMLFormElement): boolean {
  const phoneOk = validatePhone(form, true);
  const consent = form.querySelector<HTMLInputElement>('[data-consent]');
  const consentOk = !!consent?.checked;
  setError(form, 'consent', consentOk ? '' : 'Без согласия мы не сможем обработать обращение.');
  if (phoneOk && !consentOk) consent?.focus();
  return phoneOk && consentOk;
}

/* ------------------------------------------------------------------ voice */

function setupVoice(form: HTMLFormElement, onBlob: (b: Blob | null) => void) {
  const wrap = form.querySelector<HTMLElement>('[data-voice]');
  if (!wrap) return;
  const voiceWrap: HTMLElement = wrap;

  const supported =
    typeof MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;
  if (!supported) return; // Block stays hidden; the textarea is enough.

  wrap.hidden = false;

  const toggle = wrap.querySelector<HTMLButtonElement>('[data-voice-toggle]')!;
  const label = wrap.querySelector<HTMLElement>('[data-voice-label]')!;
  const time = wrap.querySelector<HTMLElement>('[data-voice-time]')!;
  const clear = wrap.querySelector<HTMLButtonElement>('[data-voice-clear]')!;
  const audio = wrap.querySelector<HTMLAudioElement>('[data-voice-audio]')!;

  let rec: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];
  let t0 = 0;
  let timer = 0;
  let stopAt = 0;

  const fmt = (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  const tick = () => {
    const el = Date.now() - t0;
    time.textContent = fmt(el);
    if (el >= MAX_VOICE_MS) stop();
  };

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: rec?.mimeType || 'audio/webm' });
        onBlob(blob);
        audio.src = URL.createObjectURL(blob);
        audio.hidden = false;
        clear.hidden = false;
        label.textContent = 'Записать заново';
        toggle.removeAttribute('data-recording');
        track('voice_description_completed', { seconds: Math.round((stopAt - t0) / 1000) });
      };
      rec.start();
      t0 = Date.now();
      toggle.setAttribute('data-recording', '');
      label.textContent = 'Остановить';
      time.hidden = false;
      audio.hidden = true;
      timer = window.setInterval(tick, 250);
      track('voice_description_started', {});
    } catch {
      // Permission refused or no device — fall back silently to text.
      voiceWrap.hidden = true;
      onBlob(null);
    }
  }

  function stop() {
    stopAt = Date.now();
    window.clearInterval(timer);
    rec?.state === 'recording' && rec.stop();
  }

  toggle.addEventListener('click', () => {
    if (rec?.state === 'recording') stop();
    else start();
  });

  clear.addEventListener('click', () => {
    onBlob(null);
    audio.hidden = true;
    audio.removeAttribute('src');
    clear.hidden = true;
    time.hidden = true;
    label.textContent = 'Рассказать голосом';
  });
}
