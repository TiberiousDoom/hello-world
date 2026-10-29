// A game's connection to its co-op room (D-077): a WebSocket to the relay, or, for tests and trying
// co-op in two tabs without a network, a room run by the host's own page over a BroadcastChannel,
// with the relay's rules from room.ts.

import { CLOSE_LEAVING, HOST_GRACE_MS, RelayMessage, Role, RoomHost, RoomInfo, RoomStatus } from './protocol';
import { Peer, admit, expire, leave, retire, route, status, welcome } from './room';

/** The relay on Cloudflare. `?relay=ws://localhost:8787` picks a local one, `?relay=local` two tabs. */
export const RELAY_URL = 'wss://foundry-front-relay.stephen-pederson.workers.dev';
/**
 * The dedicated server's room (D-084, D-086): the code it opened, kept in its room.json. The Play together
 * screen joins it with one button and shows its status. `?server=CODE` picks another, for testing.
 */
export const SERVER_ROOM = '764D2J';

/**
 * A room's status from the relay (D-086), or null if it can't be told. A local room (two tabs) is known
 * only in the tab that hosts it; elsewhere it can't be told, so Join stays open.
 */
export async function roomStatus(relay: string, code: string, signal?: AbortSignal): Promise<RoomStatus | null> {
  if (relay === 'local') {
    const r = localRooms.get(code);
    return r ? status(r.peers, r.host, r.info) : null;
  }
  try {
    const res = await fetch(`${relay.replace(/^ws/, 'http')}/rooms/${code}/status`, { signal, cache: 'no-store' });
    return res.ok ? ((await res.json()) as RoomStatus) : null;
  } catch {
    return null;
  }
}

export interface RelayLink {
  /** The host sends a HostSend (JSON); a guest sends text for the host. */
  send(text: string): void;
  close(): void;
  onMessage: (message: RelayMessage) => void;
  /** The connection is gone (after a refusal or the room closing, too). */
  onClose: () => void;
  /** Tests: the connection ends without the leaving code, as a dropped network does. */
  drop?: () => void;
}

/**
 * `key`: the host's secret for its room, so it can take the room back after a dropped connection (D-081).
 * `pass`: the room's password, hashed (`passHash`, D-140): a host sets it, a guest gives it.
 */
export function connect(relay: string, code: string, role: Role, version: string, key = '', pass = ''): RelayLink {
  return relay === 'local' ? localRoom(code, role, version, key, pass) : socket(relay, code, role, version, key, pass);
}

function socket(relay: string, code: string, role: Role, version: string, key: string, pass: string): RelayLink {
  const ws = new WebSocket(`${relay}/rooms/${code}?role=${role}&v=${encodeURIComponent(version)}${key ? `&key=${key}` : ''}${pass ? `&pass=${pass}` : ''}`);
  const link: RelayLink = {
    send: (text) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(text);
    },
    close: () => ws.close(CLOSE_LEAVING, 'bye'),
    drop: () => ws.close(4000, 'dropped'),
    onMessage: () => {},
    onClose: () => {},
  };
  ws.onmessage = (e) => {
    let message: RelayMessage;
    try {
      message = JSON.parse(String(e.data)) as RelayMessage;
    } catch {
      return; // not ours to understand
    }
    // Outside the try: an error in the game's own handling shows up (as a page error) instead of vanishing.
    link.onMessage(message);
  };
  ws.onclose = () => link.onClose();
  return link;
}

/** What goes over the channel: a guest's join, data and goodbye, and the host's replies to one guest. */
type ChannelMessage =
  | { k: 'join'; from: string; version: string; key: string; pass: string }
  | { k: 'data'; from: string; raw: string }
  | { k: 'leave'; from: string }
  | { k: 'to'; to: string; message: RelayMessage }
  | { k: 'close'; to: string };

/** How long a guest waits for a host in the same browser before giving up. */
const LOCAL_WAIT_MS = 1500;

/** A room run by this page for its guests in other tabs. It outlives a host link that drops (D-081). */
interface LocalRoom {
  channel: BroadcastChannel;
  peers: Peer[];
  host: RoomHost;
  /** The host's link while it's connected. */
  link: RelayLink | null;
  /** Closes the room if the host isn't back in time. */
  timer: ReturnType<typeof setTimeout> | null;
  /** The host's room info (D-086). */
  info: RoomInfo | null;
}
const localRooms = new Map<string, LocalRoom>();

function localRoom(code: string, role: Role, version: string, key: string, pass: string): RelayLink {
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
    link.onClose();
  };
  if (role === 'host') return localHost(code, version, key, pass, link, end, () => closed);

  const channel = new BroadcastChannel(`foundry-front-room-${code}`);
  const post = (m: ChannelMessage) => channel.postMessage(m);
  const endGuest = end;
  const close = () => {
    channel.close();
    endGuest();
  };
  const id = Math.random().toString(36).slice(2);
  let welcomed = false;
  channel.onmessage = (e: MessageEvent<ChannelMessage>) => {
    const m = e.data;
    if (m.k === 'to' && m.to === id) {
      if (m.message.t === 'welcome') welcomed = true;
      link.onMessage(m.message);
      if (m.message.t === 'refused' || m.message.t === 'closed') close();
    } else if (m.k === 'close' && m.to === id) close();
  };
  post({ k: 'join', from: id, version, key, pass });
  setTimeout(() => {
    if (welcomed || closed) return;
    link.onMessage({ t: 'refused', reason: 'no-room' });
    close();
  }, LOCAL_WAIT_MS);
  link.send = (text) => {
    if (!closed) post({ k: 'data', from: id, raw: text });
  };
  link.close = link.drop = () => {
    if (closed) return;
    post({ k: 'leave', from: id });
    close();
  };
  return link;
}

/** The host's side of a local room: opens it, or takes it back after a dropped link (with its key). */
function localHost(code: string, version: string, key: string, pass: string, link: RelayLink, end: () => void, isClosed: () => boolean): RelayLink {
  let room = localRooms.get(code);
  const result = admit(room?.peers ?? [], 'host', version, key, room?.host ?? null);
  if ('refuse' in result) {
    setTimeout(() => {
      link.onMessage({ t: 'refused', reason: result.refuse });
      end();
    });
    return link;
  }
  const host: RoomHost = pass ? { key, version, pass } : { key, version };
  if (!room) room = openLocalRoom(code, host);
  const r = room;
  // The host's old link, if it's still in the room (D-085): told, closed, and out of the room.
  const old = retire(r.peers.filter((p) => p.role === 'host'));
  if (old) r.peers.splice(r.peers.indexOf(old), 1);
  r.host = host;
  if (r.timer) clearTimeout(r.timer);
  r.timer = null;
  r.link = link;
  // Closing waits its turn after messages already sent, as on the relay, where a goodbye arrives first.
  const me: Peer = { slot: 0, role: 'host', version, send: (m) => setTimeout(() => !isClosed() && link.onMessage(m)), close: () => setTimeout(end) };
  welcome(r.peers, me);
  r.peers.unshift(me);
  /** The host's link ends: on purpose (CLOSE_LEAVING) the room closes; dropped, it waits for the host. */
  const gone = (how: number) => {
    if (isClosed() || r.link !== link) return;
    r.link = null;
    r.peers.splice(r.peers.indexOf(me), 1);
    if (leave(r.peers, me, how) === 'wait') {
      r.timer = setTimeout(() => {
        expire(r.peers);
        closeLocalRoom(code);
      }, HOST_GRACE_MS);
    } else closeLocalRoom(code);
    end();
  };
  link.send = (text) => {
    if (!isClosed()) route(r.peers, me, text, (info) => (r.info = info));
  };
  link.close = () => gone(CLOSE_LEAVING);
  link.drop = () => gone(1006);
  return link;
}

function openLocalRoom(code: string, host: RoomHost): LocalRoom {
  const channel = new BroadcastChannel(`foundry-front-room-${code}`);
  const post = (m: ChannelMessage) => channel.postMessage(m);
  const room: LocalRoom = { channel, peers: [], host, link: null, timer: null, info: null };
  const guests = new Map<string, Peer>();
  channel.onmessage = (e: MessageEvent<ChannelMessage>) => {
    const m = e.data;
    if (m.k === 'join') {
      const result = admit(room.peers, 'guest', m.version, m.key, room.host, { pass: m.pass });
      if ('refuse' in result) return post({ k: 'to', to: m.from, message: { t: 'refused', reason: result.refuse, hostVersion: result.hostVersion } });
      // The guest's old link, if it's still in the room (#100): told, closed, and out of the room.
      const old = retire(
        room.peers.filter((p) => p.role === 'guest'),
        result.slot,
      );
      if (old) {
        room.peers.splice(room.peers.indexOf(old), 1);
        for (const [id, p] of guests) if (p === old) guests.delete(id);
      }
      const peer: Peer = { slot: result.slot, role: 'guest', version: m.version, key: m.key, send: (message) => post({ k: 'to', to: m.from, message }), close: () => post({ k: 'close', to: m.from }) };
      welcome(room.peers, peer);
      room.peers.push(peer);
      guests.set(m.from, peer);
    } else if (m.k === 'data') {
      const peer = guests.get(m.from);
      if (peer) route(room.peers, peer, m.raw);
    } else if (m.k === 'leave') {
      const peer = guests.get(m.from);
      if (!peer) return;
      guests.delete(m.from);
      room.peers.splice(room.peers.indexOf(peer), 1);
      leave(room.peers, peer);
      if (!room.peers.length) closeLocalRoom(code);
    }
  };
  localRooms.set(code, room);
  return room;
}

function closeLocalRoom(code: string): void {
  const room = localRooms.get(code);
  if (!room) return;
  if (room.timer) clearTimeout(room.timer);
  room.channel.close();
  localRooms.delete(code);
}
