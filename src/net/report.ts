// Error reports (D-173): a page error the player agreed to send, posted to our own relay, which keeps the
// most recent ones and emails the developer about new kinds. Shared by the game and the relay.

/** One error, as sent. Nothing that identifies the player: no save, no room, no address. */
export interface ErrorReport {
  /** The game's version. */
  v: string;
  /** The error's message, and where it happened (file:line). */
  message: string;
  where: string;
  /** The first lines of its stack, if there was one. */
  stack: string;
  /** The browser, and its screen: "390×844 at 3× (touch)". */
  ua: string;
  screen: string;
  /** On the main menu, or the game's mode and minutes played. */
  game: string;
}

/** The most a report's fields may hold, so a report stays small. */
export const REPORT_LIMITS: Record<keyof ErrorReport, number> = { v: 20, message: 300, where: 120, stack: 1200, ua: 300, screen: 60, game: 60 };
/** The largest report body the relay reads, in bytes. */
export const REPORT_MAX_BYTES = 4096;
/** Reports a page sends at most, per visit. */
export const REPORTS_PER_VISIT = 5;

/** A report from untrusted JSON, or null if it isn't one. */
export function validReport(x: unknown): ErrorReport | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const out = {} as ErrorReport;
  for (const k of Object.keys(REPORT_LIMITS) as (keyof ErrorReport)[]) {
    const val = o[k];
    if (typeof val !== 'string' || val.length > REPORT_LIMITS[k]) return null;
    out[k] = val;
  }
  return out.message && /^\d+\.\d+\.\d+$/.test(out.v) ? out : null;
}

/** Reports of the same error, from the same version, count as one kind: the key they are grouped by. */
export function reportKind(r: ErrorReport): string {
  return `${r.v} ${r.where} ${r.message.replace(/\d+/g, '#')}`;
}

/** A report's fields cut to their limits. */
export function clipReport(r: ErrorReport): ErrorReport {
  const out = { ...r };
  for (const k of Object.keys(REPORT_LIMITS) as (keyof ErrorReport)[]) out[k] = out[k].slice(0, REPORT_LIMITS[k]);
  return out;
}
