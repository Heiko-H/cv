/**
 * Reveals the encrypted contact details - but only for a genuine human click.
 * The trigger is a plain `<div>` (no button, no link, no role), whose label is rendered via CSS,
 * so crawlers and AI agents neither see a "clickable" control nor its text in the DOM.
 * - the click event must be trusted (not `element.click()` / `dispatchEvent`),
 * - the browser must not be automated (`navigator.webdriver`),
 * - there must have been prior real interaction (pointer movement or touch),
 * - the page must have been open for a short dwell time,
 * - the click must land inside the trigger,
 * - after the click a countdown runs; the page must stay visible until it ends.
 * Only then the key file is fetched and the details are decrypted with WebCrypto.
 */
import { decryptContact, type ContactDetails } from '../lib/contact-decrypt';

const MIN_DWELL_MS = 1500;
const MIN_POINTER_MOVES = 3;
const REVEAL_DELAY_S = 3;

export function initContactReveal(): void {
  const root = document.querySelector<HTMLElement>('.contact[data-c]');
  const trigger = root?.querySelector<HTMLElement>('.contact__reveal');
  const list = root?.querySelector<HTMLUListElement>('.contact__list');
  if (!root || !trigger || !list) return;

  const loadedAt = performance.now();
  let pointerMoves = 0;
  let touched = false;
  let busy = false;

  const setLabel = (text: string) => trigger.setAttribute('data-l', text);

  const onPointerMove = (event: PointerEvent) => {
    if (event.isTrusted && event.pointerType === 'mouse') pointerMoves++;
  };
  const onTouch = (event: PointerEvent | TouchEvent) => {
    if (event.isTrusted && (!('pointerType' in event) || event.pointerType !== 'mouse')) touched = true;
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('touchstart', onTouch, { passive: true });
  window.addEventListener('pointerdown', onTouch, { passive: true });

  const isHumanClick = (event: MouseEvent): boolean => {
    if (!event.isTrusted || navigator.webdriver === true || event.detail === 0) return false;
    if (pointerMoves < MIN_POINTER_MOVES && !touched) return false;
    const rect = trigger.getBoundingClientRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  };

  const countdown = () =>
    new Promise<boolean>((done) => {
      let remaining = REVEAL_DELAY_S;
      setLabel(`Revealing in ${remaining}...`);
      const timer = window.setInterval(() => {
        if (document.hidden) {
          window.clearInterval(timer);
          done(false);
          return;
        }
        remaining--;
        if (remaining > 0) {
          setLabel(`Revealing in ${remaining}...`);
          return;
        }
        window.clearInterval(timer);
        done(true);
      }, 1000);
    });

  trigger.addEventListener('click', async (event) => {
    if (busy || !isHumanClick(event)) return;
    if (performance.now() - loadedAt < MIN_DWELL_MS) {
      setLabel('Please click again');
      return;
    }

    busy = true;
    trigger.classList.add('is-busy');

    try {
      if (!(await countdown())) throw new Error('Reveal interrupted');
      setLabel('Decrypting...');
      const response = await fetch(__CV_KEY_URL__, { cache: 'no-store', credentials: 'omit' });
      if (!response.ok) throw new Error(`Key request failed (${response.status})`);
      const maskedKey = new Uint8Array(await response.arrayBuffer());
      const details = await decryptContact(root.dataset.c ?? '', maskedKey, __CV_KEY_MASK__);

      render(list, details);
      list.hidden = false;
      trigger.remove();
      document.documentElement.classList.add('contact-revealed');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('pointerdown', onTouch);
    } catch (error) {
      console.error(error);
      setLabel('Could not load - click to try again');
      trigger.classList.remove('is-busy');
      busy = false;
    }
  });
}

function render(list: HTMLUListElement, details: ContactDetails): void {
  const tel = details.phone.replace(/[^\d+]/g, '');
  list.replaceChildren(
    item('Email', link(`mailto:${details.email}`, details.email)),
    item('Phone', link(`tel:${tel}`, details.phone)),
    item('Location', document.createTextNode(details.location)),
  );
}

function item(label: string, content: Node): HTMLLIElement {
  const li = document.createElement('li');
  const sr = document.createElement('span');
  sr.className = 'visually-hidden';
  sr.textContent = `${label}: `;
  li.append(sr, content);
  return li;
}

function link(href: string, text: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = text;
  return a;
}
