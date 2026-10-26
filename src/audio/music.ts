// Music: tracks blend into one another with a crossfade. Every track is
// composed for the game in code (audio/compose/, D-051, D-052).
//
// Main menu: the menu theme, looping. In game: seven tracks in a shuffled
// order, some upbeat and some slow. Moving between the menu and the game
// never cuts the music: the track playing carries on, and the next one comes
// from the new mood. A first supply run delivered: the fanfare, at once. A new
// season: its short interlude, at once, then the playlist carries on (#42).
// Volume goes through Web Audio gain nodes, because iOS ignores an <audio>
// element's volume.
// Browsers only allow sound after the player has clicked or tapped, so nothing
// plays until then.

import { audioContext } from './context';

export type Mood = 'menu' | 'game' | 'win';

const TRACKS: Record<Mood, string[]> = {
  menu: ['menu-theme'],
  game: ['morning-clearing', 'workshop-polka', 'firefly-lullaby', 'conveyor-jig', 'deep-woods', 'market-day', 'starlit-night'],
  win: ['supplies-delivered'],
};

const FADE = 4; // seconds of overlap between tracks
const MOOD_FADE = 1.5; // seconds when the mood changes (e.g. leaving the menu)

interface Playing {
  el: HTMLAudioElement;
  gain: GainNode;
  name: string;
  next: boolean; // the following track has already been started
}

/**
 * The slider's 0–1 as a gain: squared, so the low end is really quiet (ears hear loudness in steps of ratio,
 * not of amount), and scaled down so the music sits under the sound effects (#97).
 */
export function musicGain(v: number): number {
  return 0.45 * v * v;
}

export class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private mood: Mood = 'menu';
  private queue: string[] = [];
  private current: Playing | null = null;
  private volume: number;
  private started = false;

  constructor(volume: number) {
    this.volume = volume;
    // Start on the first interaction anywhere on the page.
    const unlock = () => {
      this.started = true;
      this.ensureContext();
      void this.ctx?.resume();
      if (!this.current) this.playNext(MOOD_FADE);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.visibilityState === 'hidden') void this.ctx.suspend();
      else void this.ctx.resume();
    });
    setInterval(() => this.check(), 250);
  }

  /** 0–1. Zero mutes (and stops downloading tracks). */
  setVolume(v: number): void {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(musicGain(v), this.ctx.currentTime, 0.1);
    if (v > 0 && this.started && !this.current) this.playNext(MOOD_FADE);
  }

  /** What's playing (for tests and debugging). */
  get state(): { mood: Mood; track: string | null; time: number; volume: number } {
    return { mood: this.mood, track: this.current?.name ?? null, time: this.current?.el.currentTime ?? 0, volume: this.volume };
  }

  /**
   * Changes what plays next. Menu and game music flow into each other: the
   * current track finishes first. The fanfare for a delivery starts at once.
   */
  setMood(mood: Mood): void {
    if (mood === this.mood) return;
    this.mood = mood;
    this.queue = [];
    if (this.started && (mood === 'win' || !this.current)) this.playNext(MOOD_FADE);
  }

  /** Plays one piece now (a season's interlude), then carries on with the current mood's tracks. */
  playNow(name: string): void {
    this.queue.unshift(name);
    if (this.started) this.playNext(MOOD_FADE);
  }

  private ensureContext(): void {
    if (this.ctx) return;
    this.ctx = audioContext();
    if (!this.ctx) return;
    this.master = this.ctx.createGain();
    this.master.gain.value = musicGain(this.volume);
    this.master.connect(this.ctx.destination);
  }

  private nextName(): string {
    if (!this.queue.length) {
      // A fresh shuffle, never starting with the track that just played.
      const list = [...TRACKS[this.mood]];
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
      if (list.length > 1 && list[0] === this.current?.name) list.push(list.shift()!);
      this.queue = list;
    }
    return this.queue.shift()!;
  }

  /** Fades the current track out and the next one in over `fade` seconds. */
  private playNext(fade: number): void {
    if (!this.ctx || !this.master || this.volume <= 0) return;
    const ctx = this.ctx;
    const old = this.current;
    if (old) {
      old.next = true;
      const g = old.gain.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setValueAtTime(g.value, ctx.currentTime);
      g.linearRampToValueAtTime(0, ctx.currentTime + fade);
      setTimeout(() => {
        old.el.pause();
        old.el.removeAttribute('src');
        old.gain.disconnect();
      }, fade * 1000 + 100);
    }
    const name = this.nextName();
    const el = new Audio(`music/${name}.wav`);
    el.preload = 'auto';
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1, ctx.currentTime + fade);
    ctx.createMediaElementSource(el).connect(gain).connect(this.master);
    const playing: Playing = { el, gain, name, next: false };
    this.current = playing;
    el.addEventListener('error', () => {
      if (this.current === playing) this.current = null; // e.g. the single-page build has no music
    });
    void el.play().catch(() => {
      if (this.current === playing) this.current = null;
    });
  }

  /** Starts the next track a little before this one ends, so they overlap. */
  private check(): void {
    const p = this.current;
    if (!p || p.next || !p.el.duration) return;
    if (p.el.duration - p.el.currentTime <= FADE) this.playNext(FADE);
  }
}
