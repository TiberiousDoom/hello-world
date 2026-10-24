// A game's connection to its co-op room (D-077): a WebSocket to the relay, or, for tests and trying
// co-op in two tabs without a network, a room run by the host's own page over a BroadcastChannel,
// with the relay's rules from room.ts.

import { RelayMessage, Role } from './protocol';
import { Peer, leave, route, welcome, admit } from './room';

/** The relay on Cloudflare. `?relay=ws://localhost:8787` picks a local one, `?relay=local` two tabs. */
export const RELAY_URL = 'wss://foundry-front-relay.stephen-pederson.workers.dev';

export interface RelayLink {
  /** The host sends a HostSend (JSON); a guest sends text for the host. */
  send(text: string): void;
  close(): void;
  onMessage: (message: RelayMessage) => void;
  /** The connection is gone (after a refusal or the room closing, too). */
  onClose: () => void;
}

export function connect(relay: string, code: string, role: Role, version: string): RelayLink {
  return relay === 'local' ? localRoom(code, role, version) : socket(relay, code, role, version);
}

function socket(relay: string, code: string, role: Role, version: string): RelayLink {
  const ws = new WebSocket(`${relay}/rooms/${code}?role=${role}&v=${encodeURIComponent(version)}`);
  const link: RelayLink = {
    send: (text) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(text);
    },
    close: () => ws.close(1000, 'bye'),
    onMessage: () => {},
    onClose: () => {},
  };
  ws.onmessage = (e) => {
    try {
      link.onMessage(JSON.parse(String(e.data)) as RelayMessage);
    } catch {
      // Not ours to understand.
    }
  };
  ws.onclose = () => link.onClose();
  return link;
}

/** What goes over the channel: a guest's join, data and goodbye, and the host's replies to one guest. */
type ChannelMessage =
  | { k: 'join'; from: string; version: string }
  | { k: 'data'; from: string; raw: string }
  | { k: 'leave'; from: string }
  | { k: 'to'; to: string; message: RelayMessage }
  | { k: 'close'; to: string };

/** How long a guest waits for a host in the same browser before giving up. */
const LOCAL_WAIT_MS = 1500;

function localRoom(code: string, role: Role, version: string): RelayLink {
  const channel = new BroadcastChannel(`foundry-front-room-${code}`);
  const post = (m: ChannelMessage) => channel.postMessage(m);
  let closed = false;
  const link: RelayLink = {
    send: () => {},
    close: () => {},
    onMessage: () => {},
    onClose: () => {},
  };
  const end = () => {
    if (closed) return;
    closed = true;
    channel.close();
    link.onClose();
  };

  if (role === 'host') {
    const peers: Peer[] = [];
    const guests = new Map<string, Peer>();
    const me: Peer = { slot: 0, role: 'host', version, send: (m) => setTimeout(() => link.onMessage(m)), close: () => end() };
    peers.push(me);
    setTimeout(() => link.onMessage({ t: 'welcome', slot: 0, players: [0] }));
    channel.onmessage = (e: MessageEvent<ChannelMessage>) => {
      const m = e.data;
      if (m.k === 'join') {
        const result = admit(peers, 'guest', m.version);
        if ('refuse' in result) return post({ k: 'to', to: m.from, message: { t: 'refused', reason: result.refuse, hostVersion: result.hostVersion } });
        const peer: Peer = { slot: result.slot, role: 'guest', version: m.version, send: (message) => post({ k: 'to', to: m.from, message }), close: () => post({ k: 'close', to: m.from }) };
        welcome(peers, peer);
        peers.push(peer);
        guests.set(m.from, peer);
      } else if (m.k === 'data') {
        const peer = guests.get(m.from);
        if (peer) route(peers, peer, m.raw);
      } else if (m.k === 'leave') {
        const peer = guests.get(m.from);
        if (!peer) return;
        guests.delete(m.from);
        peers.splice(peers.indexOf(peer), 1);
        leave(peers, peer);
      }
    };
    link.send = (text) => route(peers, me, text);
    link.close = () => {
      if (closed) return;
      leave(peers.filter((p) => p !== me), me);
      end();
    };
    return link;
  }

  const id = Math.random().toString(36).slice(2);
  let welcomed = false;
  channel.onmessage = (e: MessageEvent<ChannelMessage>) => {
    const m = e.data;
    if (m.k === 'to' && m.to === id) {
      if (m.message.t === 'welcome') welcomed = true;
      link.onMessage(m.message);
      if (m.message.t === 'refused' || m.message.t === 'closed') end();
    } else if (m.k === 'close' && m.to === id) end();
  };
  post({ k: 'join', from: id, version });
  setTimeout(() => {
    if (welcomed || closed) return;
    link.onMessage({ t: 'refused', reason: 'no-room' });
    end();
  }, LOCAL_WAIT_MS);
  link.send = (text) => {
    if (!closed) post({ k: 'data', from: id, raw: text });
  };
  link.close = () => {
    if (closed) return;
    post({ k: 'leave', from: id });
    end();
  };
  return link;
}
