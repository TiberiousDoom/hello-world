// The in-game feedback form: a player's report, with optional diagnostics,
// turned into an email to the studio or plain text to copy. Nothing is sent from
// the game itself; the player sends it from their own email (D-064, D-193).

import { BUILDINGS, BuildingType } from '../sim/data';
import { nestAlive } from '../sim/nests';
import type { World } from '../sim/world';

/** Where feedback goes: the studio's address, which reaches the developer (D-193). */
export const FEEDBACK_EMAIL = 'hello@box47games.com';
/** Some email apps (and Windows) refuse mailto links longer than about 2,000 characters; reports are cut to fit. */
export const MAX_MAILTO = 1900;

export type FeedbackKind = 'bug' | 'idea' | 'other';
const KIND_LABEL: Record<FeedbackKind, string> = { bug: 'Bug', idea: 'Idea', other: 'Feedback' };

/** The last few errors the page hit, newest last, without repeats in a row. */
export class ErrorLog {
  readonly entries: string[] = [];
  constructor(private max = 5) {}

  push(message: string): void {
    const line = message.replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!line || this.entries[this.entries.length - 1] === line) return;
    this.entries.push(line);
    if (this.entries.length > this.max) this.entries.shift();
  }
}

/** Average frames a second over the last `window` frames. */
export class FrameRate {
  private times: number[] = [];
  constructor(private window = 120) {}

  frame(now: number): void {
    this.times.push(now);
    if (this.times.length > this.window) this.times.shift();
  }

  get fps(): number {
    const t = this.times;
    if (t.length < 2) return 0;
    return ((t.length - 1) * 1000) / (t[t.length - 1] - t[0]);
  }
}

export interface DiagnosticsInput {
  version: string;
  userAgent: string;
  screen: { width: number; height: number; dpr: number };
  touch: boolean;
  batterySaver: boolean;
  /** The pixel art test (D-186) is on. */
  pixelArt?: boolean;
  fps: number;
  errors: readonly string[];
  /** The game being played, or null on the main menu. */
  world: World | null;
  speed: number;
}

/** What the report says about the game and the device, as Markdown lines. */
export function diagnostics(d: DiagnosticsInput): string {
  const lines = [
    `- Version: ${d.version}`,
    `- Browser: ${d.userAgent}`,
    `- Screen: ${d.screen.width}×${d.screen.height} at ${round(d.screen.dpr, 2)}× (${d.touch ? 'touch' : 'mouse'})`,
    `- Frame rate: ${d.fps ? `${Math.round(d.fps)} a second` : 'not measured yet'}${d.batterySaver ? ', battery saver on' : ''}${d.pixelArt ? ', pixel art test on' : ''}`,
  ];
  const w = d.world;
  if (!w) lines.push('- Game: on the main menu');
  else {
    const s = w.state;
    const counts = new Map<BuildingType, number>();
    for (const b of s.buildings) if (b.type !== 'hub') counts.set(b.type, (counts.get(b.type) ?? 0) + 1);
    const built = [...counts].map(([t, n]) => `${n} ${BUILDINGS[t].name.toLowerCase()}`).join(', ') || 'nothing yet';
    lines.push(
      `- Game: ${s.mode}, ${Math.floor(s.time / 60)} min played, seed ${s.seed}, speed ${d.speed}×`,
      `- Built: ${built}`,
      `- Researched: ${s.researched.join(', ') || 'nothing yet'}${s.research.active ? ` (researching ${s.research.active})` : ''}`,
      `- Bugs: ${s.nests.filter((n) => nestAlive(w, n)).length} live nests, ${s.enemies.length} bugs; hub breached ${s.breaches} times`,
      `- Supply ship: stage ${s.ship.stage}, ${s.ship.runs} runs delivered`,
    );
  }
  lines.push(d.errors.length ? `- Recent errors:\n${d.errors.map((e) => `  - ${e}`).join('\n')}` : '- Recent errors: none');
  return lines.join('\n');
}

/** The issue title and body for a report. */
export function report(kind: FeedbackKind, message: string, diag: string | null): { title: string; body: string } {
  const text = message.trim();
  const first = text.split('\n')[0].slice(0, 70);
  const title = `${KIND_LABEL[kind]}: ${first || '(no description)'}`;
  let body = `${text || '(no description)'}\n`;
  if (diag) body += `\nDiagnostics:\n${diag}\n`;
  body += "\nSent from Nestfall's feedback form.";
  return { title, body };
}

/** A mailto link that starts an email to the studio with the report filled in, cut short if it would be too long. */
export function mailUrl(title: string, body: string, max = MAX_MAILTO): string {
  const make = (b: string) => `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(`Nestfall ${title}`)}&body=${encodeURIComponent(b)}`;
  let url = make(body);
  if (url.length <= max) return url;
  const note = '\n\n(Cut short to fit. Use Copy in the game for the full report.)';
  let keep = body.length;
  while (keep > 0 && url.length > max) {
    keep = Math.floor(keep * 0.9);
    url = make(body.slice(0, keep) + note);
  }
  return url;
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}
