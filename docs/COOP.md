# Co-op plan

A plan for 2–4 players building and defending one factory together, in the browser, on desktop
and phones. We're going ahead with it (D-056). Phases 0 and 1 are built: players can host and join
a game with a room code (0.42.0). Progress is tracked in [ROADMAP.md](ROADMAP.md) under Co-op (M4c);
how it plays is in [GAME_DESIGN.md](GAME_DESIGN.md) under Playing together.

## The short version

- **One shared world, everyone playing on it.** One hub, one research tree, one supply ship.
  Each player has their own character (see the player character issue) and their own camera.
- **Lockstep:** every player runs the same simulation. Players send only their *actions*
  ("place a belt here", "start research X"), never the world itself. This works because the
  rules in `src/sim/` are already deterministic: a fixed 1/20 s tick and a seeded RNG kept in
  the save.
- **A small relay server** passes actions between players and stamps each with the tick it
  applies on. GitHub Pages only serves static files, so the relay is the one new piece of
  hosting.
- **Build it in four phases.** Phase 0 changes no gameplay and is useful on its own (replays,
  undo, testing), so it can be done first and safely, even before the player character. The
  character is then built on commands from the start instead of being retrofitted.

## How the game stays in sync

Today, input and the HUD call `World` methods directly (`world.place`, `world.demolish`,
`world.setRecipe`, `startResearch`, `launch`, `pickBlueprint`, ...). In co-op:

1. A player's action becomes a **command**: `{ tick, player, kind, args }`.
2. The command goes to the relay, which gives it a tick a few steps ahead (about 3 ticks,
   150 ms) and sends it to everyone, the sender included.
3. Each game only advances to tick N once it has every player's commands for tick N (even if
   that's "nothing"). Then it applies them in a fixed order (by player, then arrival) and runs
   `world.tick()`.
4. Every second or so, each game sends a **hash of its state**. If hashes differ (a
   *desync*), the host's state wins: it sends a snapshot and the others reload from it.
5. **A clock that waits for commands.** Today `main.ts` runs as many ticks as the frame's time
   allows, at most 20 a frame, so a slow frame quietly loses game time. In co-op the next tick
   runs only once its commands are in, and a game that falls behind catches up faster than
   real time instead of dropping ticks.

**Every game checks every command.** `World` methods already refuse an action that isn't
allowed (no stock, blocked tile, research not unlocked) and return an error instead. Since every
game runs the same rules on the same state, a command that can't happen fails the same way
everywhere. The relay never needs to understand the game.

**Everyone on the same version.** A deploy to GitHub Pages during a session would put a new
joiner on newer rules than the host, and they would desync at once. Each game sends its build
version when it joins, and a mismatch is refused with "Reload to update".

The few ticks of delay are hidden the usual way: the placement preview, sounds and the
character's first step react at once on your own screen; the building appears when its
command lands.

**Why lockstep, not sending the world:** the world is large (a 256×256 map, every item on
every belt, hundreds of bugs). Sending it 20 times a second would be far too much on phones.
Commands are a few bytes each.

**Joining mid-game:** the host sends a snapshot (`world.toJSON()`, the same as a save) and the
commands since it. Saves are already one JSON object, so this is mostly done. Measured on the
main menu's demo factory: 385 KB of JSON, 46 KB gzipped (browsers have gzip built in, as
`CompressionStream`), and about 2 ms to write.

**Hidden state has to travel too.** A few values that steer the rules aren't in the save:
when each path field was last refreshed and whether it's due (`flowAt`, `flowDirty`,
`shipFlowAt`, `shipFlowDirty` in `World`). A game loaded from a snapshot would refresh its paths
on a different tick from the host's, bugs would step differently, and the games would drift
apart. Phase 0 moves these into the saved state. (The rest of `World` outside the save, such as
the tile index and recent effects, is rebuilt from it or only drives sound and pictures.)

Building phase 0 showed the timers aren't enough on their own: the path fields themselves aren't
saved, and what's in them depends on when they were last rebuilt. So a loaded game rebuilds them,
and a **checkpoint** command makes every game rebuild them on the same tick, just before the host
takes a snapshot. A test shows the difference: without the checkpoint, a game joining from a
snapshot drifts from the host; with it, the two stay identical (D-058).

## Making the rules safe for lockstep

The rules must give exactly the same result on every device and browser. Most of this already
holds. To do:

- **`Math.hypot`** (16 uses in `src/sim/`): browsers may differ in the last bit. Replace with
  `Math.sqrt(dx * dx + dy * dy)`, which is exact everywhere.
- **`Math.sin` / `Math.cos`** (only in `mapgen.ts`): same risk. The map is made once by the
  host and joiners load the snapshot, so this only matters if two players generate the same
  seed separately. Keep it that way.
- **Game speed and pausing** become shared: only the host changes them.
- **Nothing else may stop the shared clock.** Today the game pauses for tutorial explanations
  (they set the speed to 0), the blueprint pick, the first-delivery screen and the menus. In
  co-op, tutorials explain without pausing, and the pick and the celebration become cards that
  don't block play.
- **A cheap check each second.** Hashing the whole save every second costs a few milliseconds
  on a phone. Hash a small summary instead: time, the RNG state, the next id, hub stock,
  building HP and bug positions. The RNG state alone changes with nearly every random event, so
  it catches most desyncs. On a mismatch, comparing the two full saves shows the cause.
- **A determinism test in CI:** run the same commands through the simulation in Chromium,
  Firefox and WebKit and compare the saves. Playwright only installs Chromium today; the other
  two add about a minute, so run them on pull requests that touch `src/sim/`.

## Gameplay rules to decide

| Question | Suggestion |
|---|---|
| Shared or separate stock and research? | Shared: one hub, one research tree. It's a team factory |
| Who picks a colony blueprint? | The first player to choose, with the offer shown to everyone; no pause |
| Pausing | Only the host can pause. Pause menus for other players don't stop the game |
| Game speed | Host only |
| Tutorials | Per player, on their own screen. They never change the world or pause it |
| Undo | Only your own last action, sent as a command like any other |
| Dropping out and back in | A rejoin code kept on the device gives you your character back |
| Messages like "You disturbed a nest" | Everyone sees them: they come from the shared rules |
| Carried items when a player leaves | Dropped into the hub |
| More players, more bugs? | Not at first. Tune after playtesting |
| How many players? | 2 to start, then up to 4 |
| Seeing each other | Each player's character in their own colour; a "ping" to point at a spot. No text chat at first (no moderation needed) |

## Phones

- **A phone that locks or switches apps stops sending commands**, which would freeze lockstep
  for everyone. Rule: if a player is silent for about 3 seconds, the others carry on without
  them; when they come back, they reload from a snapshot.
- Mobile networks lag more. A slightly longer delay (4–5 ticks) can be set per room.
- Data use is small: commands plus a hash a second.

## Hosting the relay

The game stays on GitHub Pages. The relay is a small separate service that keeps a room per
game (room code, the players in it, the command stream). Options:

| Option | Good | Less good |
|---|---|---|
| **Serverless WebSocket rooms** (for example Cloudflare Workers with Durable Objects) | Made for exactly this; free tier for small use; no server to look after | A new account and a little config |
| **Peer-to-peer (WebRTC)**, the host's browser is the relay | No relay traffic costs | Still needs a small signalling service to connect; some networks block direct connections |
| **A small always-on server** (Node.js on a cheap VPS) | Full control | Upkeep, security updates, and it costs money even when no one is playing |

**Chosen (D-077): serverless WebSocket rooms on Cloudflare**, in `relay/`: a Worker with one
Durable Object per room, on the free plan. It's live at
`wss://foundry-front-relay.stephen-pederson.workers.dev/rooms/<code>` (`/health` answers `ok`), deployed by
CI from master.

- **The relay only routes.** A guest's messages go to the host; the host's go to one guest or to
  all. Joining, leaving and the host's version are checked by the relay; everything else is the
  games' business. The rules are in `src/net/room.ts` (unit tested), the messages in
  `src/net/protocol.ts`, shared by the relay and the game.
- **The host stamps the ticks**, not the relay: guests send their commands to the host, which gives
  each a tick a few steps ahead of its own and sends it out to every game in turns. The relay then
  needs no clock and no knowledge of the game, and everyone's commands wait the same delay.
- **Rooms:** 6-character codes without easily confused characters; one host and up to 3 guests; a
  guest on another version is refused with the host's version; the room closes when the host
  leaves. Nothing is stored. Rooms sleep between messages (hibernation), so idle rooms cost nothing.
- **Limits:** only the game's own pages (GitHub Pages, and localhost for development) may connect;
  guests may send 4 KB per message and about 30 messages a second; the host up to 1 MB (a snapshot).

## Phases

0. **Prepare, in single player** (no network, no visible change):
   - every world-changing call goes through a command list (`src/sim/commands.ts`); the UI
     issues commands instead of calling `World` directly. This is small: about a dozen places in
     `input.ts` and `hud.ts` change the world today (place, demolish, rotate, recipe, filter,
     starting and pausing research, the Express Belt upgrade, launch, the blueprint pick)
   - `players` in the saved state (a list from the start, ready for the player character), and
     the path-refresh timers above; a save version bump and migration
   - a clock that runs ticks from the command list (still driven by the frame in single player)
   - remove `Math.hypot` from the rules
   - the summary hash, and the cross-browser determinism test
1. **Two-player prototype:** room codes, a test relay, lockstep with input delay, both
   characters visible. Both players start together; no joining later. The relay is done (D-077).
2. **Make it solid:** the real relay, joining mid-game by snapshot, desync detection and
   resync, reconnecting after a phone sleeps, the host leaving (the game ends, saved in every
   player's browser).
3. **Co-op design:** pings, player colours, the blueprint pick without pausing, balance for
   more players, up to 4 players.

Phase 0 is worth doing even without co-op: a command list gives replays (attach one to a bug
report), undo (already on the roadmap), and tests that replay real games.

**Phase 0 is done (D-058):** `src/sim/commands.ts` (the commands), `src/sim/session.ts` (the
session, its log and clock, replays and the summary hash), `src/sim/scenario.ts` (the scripted fight
the determinism tests run), save version 12, and the tests: exact replays, a game joining from a
checkpointed snapshot, the interface changing the world only through commands, and every browser
computing the same game as Node.

## Risks

- **Desyncs** are the main cost of lockstep: a single difference grows until the games
  disagree. The state hash catches them early, and the host snapshot recovers. The CI test
  keeps new rules from adding them.
- **A stalled player holds everyone up, briefly.** The rules themselves are cheap: 0.13 ms a
  tick on the demo factory on a desktop, so even a slow phone at 4× speed spends a few percent
  of its time on them. The real limits are drawing and the network. A player whose game stalls
  delays the others by at most a few ticks; past that they're dropped and resync like a
  sleeping phone.
- **Everything that changes the world must be a command.** A new UI feature that calls
  `World` directly would break co-op. A lint rule or test can check that only the command
  layer does.
- **Hosting and accounts:** the relay is the project's first server. Room codes keep it
  anonymous: no accounts, no stored personal data. It limits message size and rate per player,
  and drops rooms once they're empty, so it can't be used to store or flood anything.

**Phase 1 is done (D-078):** main menu → Play together. `src/net/coop.ts` (the room from a game's side:
host, join, lobby, start), `src/net/lockstep.ts` (the host stamping commands 3 ticks ahead and sending
turns; guests running only as far as their turns go; a fingerprint each second), `src/net/client.ts` (the
WebSocket to the relay, or `?relay=local`: a room between tabs over a BroadcastChannel with the relay's
rules, which the browser test uses), `src/net/pack.ts` (the world gzipped for the start) and
`src/ui/lobby.ts` (the dialog). What phase 1 leaves for phase 2: joining a game under way, resync after a
mismatch (it's only detected), reconnecting, the shared game saved in every browser, and waiting on or
dropping a guest that falls behind (the host never waits today).

## Decided (D-076)

- **Any player can resume a co-op game.** Every browser in a game holds the same world, so each
  player saves it locally, as in single player. Whoever resumes it hosts, gets a new room code,
  and the others join with that code. Engineers are matched to players by their slot in the game
  (first to join takes slot 1, and so on); an empty slot's engineer waits at the hub.
- **Room codes only.** Friends join with a short code; no public rooms, no strangers, no
  accounts.
