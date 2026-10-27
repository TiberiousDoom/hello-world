// The Settings screen's own parts (D-144): the size of text and buttons, reduced motion and the key list.
// The volumes and toggles are wired in main.ts, next to what they control.

import { KEY_ACTIONS, KeyAction, bindKey, keyFor, keyName, resetKeys } from './keys';

/** Settings' size steps run from 80% to 140%. */
export const UI_SCALE_MIN = 0.8;
export const UI_SCALE_MAX = 1.4;

/**
 * How much bigger than usual the browser's own text size is (1 by default): players who set larger
 * text in their browser or system get a bigger interface to start from.
 */
export function systemTextScale(): number {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;visibility:hidden;font-size:medium';
  document.body.append(probe);
  const px = parseFloat(getComputedStyle(probe).fontSize) || 16;
  probe.remove();
  return Math.min(1.5, Math.max(1, px / 16));
}

/** Sizes the interface: the player's choice times the system's text size. */
export function applyUiScale(scale: number): void {
  document.documentElement.style.setProperty('--ui', String(Math.round(scale * systemTextScale() * 100) / 100));
}

/** Less motion: CSS animations stop (a body class) and the renderer leaves out drifting things. */
export function systemReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The key list: a row per action, whose button waits for the next key pressed. */
export class KeyList {
  private waiting: KeyAction | null = null;

  constructor(
    private el: HTMLElement,
    private onChange: () => void,
    private onRefused: (key: string) => void,
  ) {
    el.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-key]');
      if (!btn) return;
      this.waiting = this.waiting === btn.dataset.key ? null : (btn.dataset.key as KeyAction);
      this.render();
    });
    // Caught before the game's own key handlers, so the key pressed only rebinds.
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.waiting) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        if (e.key === 'Escape') this.waiting = null;
        else if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' || e.key === 'Meta') return;
        else if (bindKey(this.waiting, e.key)) {
          this.waiting = null;
          this.onChange();
        } else this.onRefused(e.key);
        this.render();
      },
      { capture: true },
    );
  }

  reset(): void {
    resetKeys();
    this.waiting = null;
    this.render();
    this.onChange();
  }

  /** Stops waiting for a key (the screen closed). */
  stop(): void {
    if (!this.waiting) return;
    this.waiting = null;
    this.render();
  }

  render(): void {
    this.el.innerHTML = KEY_ACTIONS.map(
      (a) =>
        `<div class="key-row"><span>${a.label}</span><button data-key="${a.id}" class="${this.waiting === a.id ? 'waiting' : ''}">${this.waiting === a.id ? 'Press a key…' : keyName(keyFor(a.id))}</button></div>`,
    ).join('');
  }
}
