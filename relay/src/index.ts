// The co-op relay (D-056, D-077): a Cloudflare Worker with one Durable Object per room. Games connect
// by WebSocket to /rooms/<code>; the room passes messages between them (rules in room.ts). Rooms use
// the hibernation API so an idle room costs nothing. The only thing stored is the host's key and
// version while the room is open, so a host whose connection drops can come back (D-081); it's
// deleted when the room closes.

import { DurableObject } from 'cloudflare:workers';
import { HEARTBEAT, HEARTBEAT_REPLY, HOST_GRACE_MS, RelayMessage, Role, RoomHost, RoomInfo, reservedHash, sha256, validCode } from '../../src/net/protocol';
import { Allowance, CLOSE_POLICY, Peer, admit, expire, leave, retire, route, status, welcome } from '../../src/net/room';
import { REPORT_MAX_BYTES, type ErrorReport, reportKind, validReport } from '../../src/net/report';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
  /** Reserved rooms (D-140), a secret: "CODE:sha256-of-host-key", comma separated. */
  RESERVED_ROOMS?: string;
  /** Error reports (D-173): one Durable Object keeps them. */
  REPORTS: DurableObjectNamespace<Reports>;
  /** Mail about new kinds of error goes to REPORT_TO (a secret: a verified Email Routing address). */
  REPORT_MAIL?: SendEmail;
  REPORT_TO?: string;
  /** A secret that reads the reports: GET /reports with "Authorization: Bearer <it>". */
  REPORTS_KEY?: string;
}

/**
 * Pages that may connect: the game at playnestfall.com (D-181), its old address on GitHub Pages (which now
 * forwards there, and which a dedicated server on an older build still names), and local development.
 */
const ORIGINS = ['https://playnestfall.com', 'https://www.playnestfall.com', 'https://tiberiousdoom.github.io'];

function allowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ORIGINS.includes(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

/**
 * Room statuses answered in the last STATUS_MS, per Worker instance: a page polling, or many pages at
 * once, don't each wake the room's Durable Object. Kept small and short; a status a few seconds old is fine.
 */
const STATUS_MS = 3000;
const STATUS_KEEP = 500;
const statuses = new Map<string, { at: number; body: string }>();

async function roomStatus(code: string, request: Request, env: Env): Promise<Response> {
  const now = Date.now();
  let hit = statuses.get(code);
  if (!hit || now - hit.at > STATUS_MS) {
    const res = await env.ROOMS.getByName(code).fetch(request);
    hit = { at: now, body: await res.text() };
    statuses.delete(code);
    statuses.set(code, hit);
    if (statuses.size > STATUS_KEEP) statuses.delete(statuses.keys().next().value!);
  }
  return new Response(hit.body, { headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'cache-control': 'no-store' } });
}

/**
 * Error reports (D-173). POST: a page sends one (as text, so the browser needs no preflight), only from the
 * game's own pages. GET: the developer reads them, with the REPORTS_KEY secret.
 */
async function reports(request: Request, env: Env): Promise<Response> {
  const store = env.REPORTS.getByName('all');
  if (request.method === 'GET') {
    const auth = request.headers.get('Authorization') ?? '';
    if (!env.REPORTS_KEY || auth !== `Bearer ${env.REPORTS_KEY}`) return new Response('Forbidden', { status: 403 });
    return store.list();
  }
  if (request.method !== 'POST') return new Response('Use POST', { status: 405 });
  const origin = request.headers.get('Origin');
  if (!allowedOrigin(origin)) return new Response('Forbidden', { status: 403 });
  const cors = { 'access-control-allow-origin': origin! };
  const body = await request.text();
  if (body.length > REPORT_MAX_BYTES) return new Response('Too large', { status: 413, headers: cors });
  let report: ErrorReport | null = null;
  try {
    report = validReport(JSON.parse(body));
  } catch {
    // not JSON
  }
  if (!report) return new Response('Not a report', { status: 400, headers: cors });
  await store.add(report);
  return new Response(null, { status: 204, headers: cors });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('ok', { headers: { 'access-control-allow-origin': '*' } });
    if (url.pathname === '/reports') return reports(request, env);
    const m = url.pathname.match(/^\/rooms\/([A-Z0-9]+)(\/status)?$/);
    if (!m || !validCode(m[1])) return new Response('Not found', { status: 404 });
    // A room's status, for the Play together screen (D-086): public, read by any page.
    if (m[2]) return request.method === 'GET' ? roomStatus(m[1], request, env) : new Response('Use GET', { status: 405 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    if (!allowedOrigin(request.headers.get('Origin'))) return new Response('Forbidden', { status: 403 });
    return env.ROOMS.getByName(m[1]).fetch(request);
  },
} satisfies ExportedHandler<Env>;

/** Who a connection is, kept on the socket so it survives the room sleeping. */
interface Attachment {
  slot: number;
  role: Role;
  version: string;
  /** A guest's own key (#100), so that reconnecting takes back its slot. */
  key?: string;
  /** The host's room info (D-086), kept here so it costs no storage and goes when the host does. */
  info?: RoomInfo;
}

export class Room extends DurableObject<Env> {
  private allowances = new WeakMap<WebSocket, Allowance>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Heartbeats are answered by Cloudflare without waking the room, so they cost next to nothing (D-085).
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(HEARTBEAT, HEARTBEAT_REPLY));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith('/status')) {
      const host = this.ctx
        .getWebSockets()
        .map((ws) => ws.deserializeAttachment() as Attachment | null)
        .find((a) => a?.role === 'host');
      const room = (await this.ctx.storage.get<RoomHost>('host')) ?? null;
      return Response.json(status(this.peers(), room, host?.info ?? null), {
        headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
      });
    }
    const role: Role = url.searchParams.get('role') === 'host' ? 'host' : 'guest';
    const version = url.searchParams.get('v') ?? '';
    const key = url.searchParams.get('key') ?? '';
    const pass = url.searchParams.get('pass') ?? '';
    const code = url.pathname.split('/')[2] ?? '';
    const reserved = role === 'host' ? reservedHash(this.env.RESERVED_ROOMS, code) : undefined;
    const keyHash = reserved != null ? await sha256(key) : undefined;
    const [client, server] = Object.values(new WebSocketPair());
    const room = (await this.ctx.storage.get<RoomHost>('host')) ?? null;
    const result = admit(this.peers(), role, version, key, room, { reserved, keyHash, pass });
    if ('refuse' in result) {
      // Not let in: say why, then close. This socket isn't part of the room, so no hibernation.
      server.accept();
      server.send(JSON.stringify({ t: 'refused', reason: result.refuse, hostVersion: result.hostVersion } satisfies RelayMessage));
      server.close(CLOSE_POLICY, result.refuse);
      return new Response(null, { status: 101, webSocket: client });
    }
    // Its old connection, if it still looks open (D-085, #100): told, closed, and forgotten, so that its
    // closing later isn't taken for the player leaving.
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment | null;
      if (a?.role !== role || a.slot !== result.slot) continue;
      retire([this.peer(ws, a)], result.slot);
      try {
        ws.serializeAttachment(null);
      } catch {
        // Closed already.
      }
    }
    const others = this.peers();
    if (role === 'host') {
      // A new room, or its host back: remember who may take it back, and stop waiting.
      await this.ctx.storage.put('host', (pass ? { key, version, pass } : { key, version }) satisfies RoomHost);
      await this.ctx.storage.deleteAlarm();
    }
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment((role === 'guest' && key ? { slot: result.slot, role, version, key } : { slot: result.slot, role, version }) satisfies Attachment);
    welcome(others, this.peer(server));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (!ws.deserializeAttachment()) return; // already gone
    const from = this.peer(ws);
    if (from.role === 'guest') {
      let allowance = this.allowances.get(ws);
      if (!allowance) this.allowances.set(ws, (allowance = new Allowance(Date.now())));
      if (!allowance.take(Date.now())) return from.close(CLOSE_POLICY, 'too many messages');
    }
    route(this.peers(), from, message, (info) => {
      try {
        ws.serializeAttachment({ ...(ws.deserializeAttachment() as Attachment), info } satisfies Attachment);
      } catch {
        // Closed meanwhile.
      }
    });
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    // Answer the close, so the game's side knows at once that it's closed (and can reconnect).
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code, 'bye');
    } catch {
      // Already closed.
    }
    await this.gone(ws, code);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.gone(ws, 1006);
  }

  /** The host isn't back in time: the room closes (D-081). */
  async alarm(): Promise<void> {
    const peers = this.peers();
    if (peers.some((p) => p.role === 'host')) return;
    expire(peers);
    await this.ctx.storage.deleteAll();
  }

  private async gone(ws: WebSocket, code: number): Promise<void> {
    const a = ws.deserializeAttachment() as Attachment | null;
    if (!a) return;
    try {
      ws.serializeAttachment(null); // counted once, whether it closes or errors
    } catch {
      // Closed already: it won't be seen again anyway.
    }
    const peers = this.peers();
    if (leave(peers, this.peer(ws, a), code) === 'wait') {
      await this.ctx.storage.setAlarm(Date.now() + HOST_GRACE_MS);
    } else if (a.role === 'host' || !peers.length) {
      await this.ctx.storage.deleteAll(); // closed, or empty: nothing to remember
    }
  }

  private peers(): Peer[] {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws.readyState === WebSocket.OPEN && ws.deserializeAttachment())
      .map((ws) => this.peer(ws));
  }

  private peer(ws: WebSocket, a = ws.deserializeAttachment() as Attachment): Peer {
    return {
      ...a,
      send: (message) => {
        try {
          ws.send(JSON.stringify(message));
        } catch {
          // Already closing: it'll be gone in a moment.
        }
      },
      close: (code, reason) => {
        try {
          ws.close(code, reason);
        } catch {
          // Already closed.
        }
      },
    };
  }
}

/** Kinds of error kept (each with a count and its latest report), and new kinds mailed a day at most. */
const REPORT_KINDS = 300;
const MAILS_PER_DAY = 20;
/** Reports taken a minute at most, so a page gone wrong can't flood the store. */
const REPORTS_PER_MINUTE = 60;

/**
 * Error reports (D-173), in one Durable Object's SQLite storage: one row per kind of error (the same message
 * from the same version), counted. The first report of a kind is mailed to the developer, a few a day at most.
 */
export class Reports extends DurableObject<Env> {
  private minute = 0;
  private taken = 0;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      'CREATE TABLE IF NOT EXISTS kinds (kind TEXT PRIMARY KEY, count INTEGER, first INTEGER, last INTEGER, report TEXT); CREATE TABLE IF NOT EXISTS mails (day TEXT PRIMARY KEY, sent INTEGER)',
    );
  }

  async add(report: ErrorReport): Promise<void> {
    const now = Date.now();
    const minute = Math.floor(now / 60_000);
    if (minute !== this.minute) [this.minute, this.taken] = [minute, 0];
    if (++this.taken > REPORTS_PER_MINUTE) return;
    const sql = this.ctx.storage.sql;
    const kind = reportKind(report);
    const known = sql.exec('SELECT count FROM kinds WHERE kind = ?', kind).toArray().length > 0;
    if (known) sql.exec('UPDATE kinds SET count = count + 1, last = ?, report = ? WHERE kind = ?', now, JSON.stringify(report), kind);
    else {
      sql.exec('INSERT INTO kinds VALUES (?, 1, ?, ?, ?)', kind, now, now, JSON.stringify(report));
      sql.exec('DELETE FROM kinds WHERE kind NOT IN (SELECT kind FROM kinds ORDER BY last DESC LIMIT ?)', REPORT_KINDS);
      await this.mail(report);
    }
  }

  /** The kinds of error, newest first. */
  list(): Response {
    const rows = this.ctx.storage.sql.exec('SELECT kind, count, first, last, report FROM kinds ORDER BY last DESC').toArray();
    const out = rows.map((r) => ({ count: r.count, first: new Date(Number(r.first)).toISOString(), last: new Date(Number(r.last)).toISOString(), report: JSON.parse(String(r.report)) }));
    return Response.json(out);
  }

  /** Mails a new kind of error to the developer, if mail is set up and today's few aren't used up. */
  private async mail(r: ErrorReport): Promise<void> {
    if (!this.env.REPORT_MAIL || !this.env.REPORT_TO) return;
    const sql = this.ctx.storage.sql;
    const day = new Date().toISOString().slice(0, 10);
    const sent = Number(sql.exec('SELECT sent FROM mails WHERE day = ?', day).toArray()[0]?.sent ?? 0);
    if (sent >= MAILS_PER_DAY) return;
    sql.exec('INSERT INTO mails VALUES (?, 1) ON CONFLICT(day) DO UPDATE SET sent = sent + 1', day);
    sql.exec('DELETE FROM mails WHERE day < ?', day);
    try {
      await this.env.REPORT_MAIL.send({
        from: { email: 'reports@box47games.com', name: 'Nestfall error reports' },
        to: this.env.REPORT_TO,
        subject: `Nestfall ${r.v}: ${r.message.slice(0, 80)}`,
        text: [
          `A new kind of error in Nestfall ${r.v}.`,
          '',
          `Error: ${r.message}`,
          `Where: ${r.where}`,
          `Game: ${r.game}`,
          `Browser: ${r.ua}`,
          `Screen: ${r.screen}`,
          '',
          'Stack:',
          r.stack || '(none)',
          '',
          'All reports: GET /reports on the relay, with the REPORTS_KEY secret.',
        ].join('\n'),
      });
    } catch (err) {
      console.error('Could not mail an error report.', err);
    }
  }
}
