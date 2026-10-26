// The co-op relay (D-056, D-077): a Cloudflare Worker with one Durable Object per room. Games connect
// by WebSocket to /rooms/<code>; the room passes messages between them (rules in room.ts). Rooms use
// the hibernation API so an idle room costs nothing. The only thing stored is the host's key and
// version while the room is open, so a host whose connection drops can come back (D-081); it's
// deleted when the room closes.

import { DurableObject } from 'cloudflare:workers';
import { HEARTBEAT, HEARTBEAT_REPLY, HOST_GRACE_MS, RelayMessage, Role, RoomHost, RoomInfo, validCode } from '../../src/net/protocol';
import { Allowance, CLOSE_POLICY, Peer, admit, expire, leave, retire, route, status, welcome } from '../../src/net/room';

export interface Env {
  ROOMS: DurableObjectNamespace<Room>;
}

/** Pages that may connect: the game on GitHub Pages, and local development. */
function allowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin === 'https://tiberiousdoom.github.io') return true;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('ok', { headers: { 'access-control-allow-origin': '*' } });
    const m = url.pathname.match(/^\/rooms\/([A-Z0-9]+)(\/status)?$/);
    if (!m || !validCode(m[1])) return new Response('Not found', { status: 404 });
    // A room's status, for the Play together screen (D-086): public, read by any page.
    if (m[2]) return request.method === 'GET' ? env.ROOMS.getByName(m[1]).fetch(request) : new Response('Use GET', { status: 405 });
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
      const host = this.ctx.getWebSockets().map((ws) => ws.deserializeAttachment() as Attachment | null).find((a) => a?.role === 'host');
      const room = (await this.ctx.storage.get<RoomHost>('host')) ?? null;
      return Response.json(status(this.peers(), room, host?.info ?? null), {
        headers: { 'access-control-allow-origin': '*', 'cache-control': 'no-store' },
      });
    }
    const role: Role = url.searchParams.get('role') === 'host' ? 'host' : 'guest';
    const version = url.searchParams.get('v') ?? '';
    const key = url.searchParams.get('key') ?? '';
    const [client, server] = Object.values(new WebSocketPair());
    const room = (await this.ctx.storage.get<RoomHost>('host')) ?? null;
    const result = admit(this.peers(), role, version, key, room);
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
      await this.ctx.storage.put('host', { key, version } satisfies RoomHost);
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
