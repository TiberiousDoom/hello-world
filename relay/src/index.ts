// The co-op relay (D-056, D-077): a Cloudflare Worker with one Durable Object per room. Games connect
// by WebSocket to /rooms/<code>; the room passes messages between them (rules in room.ts). Rooms keep
// nothing in storage, and use the hibernation API so an idle room costs nothing.

import { DurableObject } from 'cloudflare:workers';
import { RelayMessage, Role, validCode } from '../../src/net/protocol';
import { Allowance, CLOSE_POLICY, Peer, admit, leave, route, welcome } from '../../src/net/room';

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
    const m = url.pathname.match(/^\/rooms\/([A-Z0-9]+)$/);
    if (!m || !validCode(m[1])) return new Response('Not found', { status: 404 });
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
}

export class Room extends DurableObject<Env> {
  private allowances = new WeakMap<WebSocket, Allowance>();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const role: Role = url.searchParams.get('role') === 'host' ? 'host' : 'guest';
    const version = url.searchParams.get('v') ?? '';
    const [client, server] = Object.values(new WebSocketPair());
    const result = admit(this.peers(), role, version);
    if ('refuse' in result) {
      // Not let in: say why, then close. This socket isn't part of the room, so no hibernation.
      server.accept();
      server.send(JSON.stringify({ t: 'refused', reason: result.refuse, hostVersion: result.hostVersion } satisfies RelayMessage));
      server.close(CLOSE_POLICY, result.refuse);
      return new Response(null, { status: 101, webSocket: client });
    }
    const others = this.peers();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ slot: result.slot, role, version } satisfies Attachment);
    welcome(others, this.peer(server));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const from = this.peer(ws);
    if (from.role === 'guest') {
      let allowance = this.allowances.get(ws);
      if (!allowance) this.allowances.set(ws, (allowance = new Allowance(Date.now())));
      if (!allowance.take(Date.now())) return from.close(CLOSE_POLICY, 'too many messages');
    }
    route(this.peers(), from, message);
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.gone(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.gone(ws);
  }

  private gone(ws: WebSocket): void {
    const a = ws.deserializeAttachment() as Attachment | null;
    if (!a) return;
    leave(this.peers(), this.peer(ws));
  }

  private peers(): Peer[] {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws.readyState === WebSocket.OPEN && ws.deserializeAttachment())
      .map((ws) => this.peer(ws));
  }

  private peer(ws: WebSocket): Peer {
    const a = ws.deserializeAttachment() as Attachment;
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
