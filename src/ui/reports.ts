// Error reports the player agreed to send (D-173): built from a page error, sent to our own relay.
import { REPORTS_PER_VISIT, clipReport, reportKind, type ErrorReport } from '../net/report';

/** Where the game is served for players: reports are sent only from there, never from tests or development. */
export const REPORT_HOSTS = ['tiberiousdoom.github.io', 'playnestfall.com', 'www.playnestfall.com'];

/** Builds reports from errors and sends each kind once a visit, a few at most, once the player has agreed. */
export class Reporter {
  /** Reports built this visit, for tests and the feedback form: whether each was sent. */
  readonly log: { report: ErrorReport; sent: boolean }[] = [];
  private kinds = new Set<string>();
  private sent = 0;

  constructor(
    /** Whether the player agreed: true, false, or null for not asked yet. */
    private consent: () => boolean | null,
    /** Asks the player, the first time there's something to send. */
    private ask: () => void,
    /** Sends one report; false if it couldn't be sent. */
    private post: (r: ErrorReport) => boolean,
  ) {}

  /** A page error happened. Waits for consent if the player hasn't been asked yet. */
  error(r: ErrorReport): void {
    const report = clipReport(r);
    const kind = reportKind(report);
    if (this.kinds.has(kind)) return;
    this.kinds.add(kind);
    this.log.push({ report, sent: false });
    if (this.consent() == null) this.ask();
    else this.flush();
  }

  /** Sends what's waiting, if the player agreed. Called again after they answer. */
  flush(): void {
    if (this.consent() !== true) return;
    for (const entry of this.log) {
      if (entry.sent || this.sent >= REPORTS_PER_VISIT) continue;
      entry.sent = this.post(entry.report);
      if (entry.sent) this.sent++;
    }
  }
}
