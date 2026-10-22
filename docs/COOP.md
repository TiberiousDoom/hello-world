# Co-op plan

A plan for 2–4 players building and defending one factory together, in the browser, on desktop
and phones. We're going ahead with it (D-056); nothing is built yet. Progress is tracked in
[ROADMAP.md](ROADMAP.md) under Co-op (M4c).

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
  undo, testing), so it can be done first and safely.

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

The few ticks of delay are hidden the usual way: the placement preview, sounds and the
character's first step react at once on your own screen; the building appears when its
command lands.

**Why lockstep, not sending the world:** the world is large (a 256×256 map, every item on
every belt, hundreds of bugs). Sending it 20 times a second would be far too much on phones.
Commands are a few bytes each.

**Joining mid-game:** the host sends a snapshot (`world.toJSON()`, the same as a save) and the
commands since it. Saves are already one JSON object, so this is mostly done.

## Making the rules safe for lockstep

The rules must give exactly the same result on every device and browser. Most of this already
holds. To do:

- **`Math.hypot`** (16 uses in `src/sim/`): browsers may differ in the last bit. Replace with
  `Math.sqrt(dx * dx + dy * dy)`, which is exact everywhere.
- **`Math.sin` / `Math.cos`** (only in `mapgen.ts`): same risk. The map is made once by the
  host and joiners load the snapshot, so this only matters if two players generate the same
  seed separately. Keep it that way.
- **Game speed and pausing** become shared: only the host changes them. The blueprint pick
  screen and the first-delivery screen can't pause the game for everyone (see below).
- **A determinism test in CI:** run the same commands through the simulation in Chromium,
  Firefox and WebKit (Playwright already runs Chromium) and compare state hashes.

## Gameplay rules to decide

| Question | Suggestion |
|---|---|
| Shared or separate stock and research? | Shared: one hub, one research tree. It's a team factory |
| Who picks a colony blueprint? | The first player to choose, with the offer shown to everyone; no pause |
| Pausing | Only the host can pause. Pause menus for other players don't stop the game |
| Game speed | Host only |
| Tutorials | Per player, on their own screen. They never change the world |
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

**Suggestion:** serverless WebSocket rooms. For a quick prototype, a public WebRTC signalling
service is fine to test with.

## Phases

0. **Prepare, in single player** (no network, no visible change):
   - every world-changing call goes through a command list (`src/sim/commands.ts`); the UI
     issues commands instead of calling `World` directly
   - `players` in the saved state (with the player character, as a list from the start); a save
     version bump and migration
   - remove `Math.hypot` from the rules
   - a state hash, and the cross-browser determinism test
1. **Two-player prototype:** room codes, a test relay, lockstep with input delay, both
   characters visible. Both players start together; no joining later.
2. **Make it solid:** the real relay, joining mid-game by snapshot, desync detection and
   resync, reconnecting after a phone sleeps, the host leaving (the game ends, saved on the
   host).
3. **Co-op design:** pings, player colours, the blueprint pick without pausing, balance for
   more players, up to 4 players.

Phase 0 is worth doing even without co-op: a command list gives replays (attach one to a bug
report), undo (already on the roadmap), and tests that replay real games.

## Risks

- **Desyncs** are the main cost of lockstep: a single difference grows until the games
  disagree. The state hash catches them early, and the host snapshot recovers. The CI test
  keeps new rules from adding them.
- **The slowest device sets the pace.** If one phone can't keep up with 20 ticks a second at
  high game speed, everyone waits. Large factories and many bugs make this worse.
- **Everything that changes the world must be a command.** A new UI feature that calls
  `World` directly would break co-op. A lint rule or test can check that only the command
  layer does.
- **Hosting and accounts:** the relay is the project's first server. Room codes keep it
  anonymous: no accounts, no stored personal data.

## Open questions

- Is a co-op game saved only on the host, or can any player resume it?
- Drop-in strangers (public rooms), or only friends with a room code? Suggestion: room codes
  only.
