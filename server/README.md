# The dedicated server

Co-op rooms that are always open (D-084). The server is a host like a player's browser, run by Node
with no screen: it keeps a world per room, opens each with a fixed code, and lets players come and go.
Nobody has to host. Its main room is the one the game's **Join the server** button joins; players can
make more rooms on it, each with its own world (D-164).

- It connects out to the relay on Cloudflare, like a browser does. No ports are opened on your network.
- Each game is paused while nobody is in it, so bugs don't take a factory overnight.
- It saves every minute to `world.json`, with an hourly backup for the last day (made rooms in `rooms/<code>/`).
- A restart within a minute takes the room back: players see "The host is back" and carry on.
- If your internet drops (a router restart, a new IP address), it notices within about 20 seconds and
  takes the room back once the connection works again (D-085).
- `room.json` holds the main room's code, the desk's code and the key that hosts every room: whoever has it can take them. The server keeps it readable by its own user only.
- Run only one copy per room. A second copy with the same `room.json` takes the room, and the first
  then stays out and says so in its log.
- Rooms hold up to 10 players. The server takes slot 1 but has no engineer in the game (#184): players are 2 and up.

## Rooms players make (D-164)

Under Play together, **Make a room on the server** asks the server for a new room: a name, and an optional
password. The server opens it with a new world, lists it under its main room, and the player is in.

- Players ask the server's **desk**, a room that never starts a game. It has the server's password, so
  only people who can join the server can make rooms. A room made without its own password gets the server's.
- At most `FOUNDRY_MAX_ROOMS` made rooms (4 by default, up to 12; `0` turns making rooms off). Each one
  running costs memory even while paused, so keep the number modest on a small PC.
- A made room nobody plays in for `FOUNDRY_ROOM_DAYS` (30) is saved, closed and moved to `archive/<code>-<date>/`.
  To bring one back, stop the server, move its folder back into `rooms/` (named with its code) and start it.
- The browser that made a room can rename or delete it from Play together (D-165): it keeps a key whose hash
  is in the room's `room.json`. Deleting archives the room, like idling, and needs it empty. Rooms made
  before 0.90.0 have no key.
- To remove a room yourself, stop the server, delete or move its folder out of `rooms/`, and start it again.
- Every code the server uses starts with the main room's first 4 characters, so one relay entry reserves them all.

## Try it on your own computer

```bash
npm ci
npm run server
```

It prints the room code. Open the game, choose **Play together**, and join with that code. Stop it with
Ctrl+C. To test against a local relay, run `cd relay && npm ci && npm run dev` and start the server with
`FOUNDRY_RELAY=ws://localhost:8787`, then open the game with `?relay=ws://localhost:8787`.

## Settings

All optional, as environment variables:

| Variable | What it does | Default |
| --- | --- | --- |
| `FOUNDRY_DATA` | Folder for the room, the save and backups | `server-data/` |
| `FOUNDRY_ROOM` | The room code: 6 letters and digits, without 0, O, 1, I or L | Made on first start, then kept |
| `FOUNDRY_RELAY` | The relay | The one on Cloudflare |
| `FOUNDRY_ORIGIN` | The page origin the relay lets in | The game on GitHub Pages |
| `FOUNDRY_PAUSE_EMPTY` | `0` keeps the game running with nobody in | Paused when empty |
| `FOUNDRY_NAME` | The main room's name on the Play together screen | "Dedicated server" |
| `FOUNDRY_PASSWORD` | A password players type once to join (their browser keeps it), also needed to make a room. The relay only sees it hashed | None: anyone with the code |
| `FOUNDRY_MAX_ROOMS` | How many rooms players may make (`0`: none) | 4 |
| `FOUNDRY_ROOM_DAYS` | Days a made room may go unplayed before it's archived | 30 |

## Keep the room yours (D-140)

The room codes are public (they're in the game), and the relay forgets a room once it's empty and its host
is gone: while the server is down or restarting, anyone could open its codes. Reserve them on the relay so
only this server's key can ever host them:

1. Start the server once. Its log prints a line like
   `To reserve this server's rooms on the relay, add "764D*:3f9a…" to its RESERVED_ROOMS secret`.
   The `*` covers every code starting with `764D`: the main room, the desk and every room players make.
2. Set that as the relay's secret (several entries: comma separated):
   ```bash
   cd relay
   npx wrangler secret put RESERVED_ROOMS   # paste 764D*:3f9a…
   ```
   An older exact entry (`764D2J:3f9a…`) for the main room can stay or go.
3. A new `room.json` (a new key) needs the secret updated to its new line.

The game's Play together screen joins the room in `SERVER_ROOM` (`src/net/client.ts`) with one
button and shows its status (D-086). If you change the server's room code, change `SERVER_ROOM` to
match. To try a test server, open the game with `?server=CODE`.

`status.json` in the data folder shows the version, every room and who is in each.

## Running it on a spare PC (Ubuntu Server 24.04)

1. Make a user for it and install Node 22 and git:
   ```bash
   sudo adduser --disabled-password --gecos "" foundry
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install -y nodejs git
   ```
2. Get the game and build the server:
   ```bash
   sudo -u foundry git clone https://github.com/TiberiousDoom/hello-world /home/foundry/hello-world
   cd /home/foundry/hello-world
   sudo -u foundry npm ci
   sudo -u foundry npm run build:server
   sudo -u foundry mkdir -p /home/foundry/server-data
   ```
   The data folder must exist before the service starts: the service may write only there.
3. Install the service, and the timer that keeps it up to date:
   ```bash
   sudo cp server/foundry-server.service server/foundry-update.service server/foundry-update.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now foundry-server foundry-update.timer
   ```
4. Find the room code:
   ```bash
   journalctl -u foundry-server -n 20
   ```
   To choose your own code, uncomment the `FOUNDRY_ROOM` line in the service file, then
   `sudo systemctl daemon-reload && sudo systemctl restart foundry-server`.

## Updates

Players must be on the server's version, and the game on GitHub Pages updates with every merge to
`master`. Every 5 minutes, `update.sh` checks `master`. When there's something new and nobody is
playing, it updates, rebuilds and restarts the server. Someone opening the newer game meanwhile is told
that the versions differ. Run `sudo systemctl start foundry-update` to check now.

## When the connection drops

The log says why each connection to the relay ended, for example
`Room 764D2J: connection to the relay ended after 19 min (close code 1006).` Code 1006 means it was cut
with no goodbye, which a network drop does; 1001 or 1012 mean the relay restarted (as it does when a new
version deploys). "No answer to its heartbeat" means the connection died silently and the server noticed.
The room is back within seconds either way. If drops come every few minutes, check the relay's usage in
Cloudflare (Workers & Pages → foundry-front-relay → Metrics) for errors or limits being reached.

## Useful commands

```bash
journalctl -u foundry-server -f            # watch the log
cat /home/foundry/server-data/status.json  # who is in
sudo systemctl restart foundry-server      # restart (players get back in on their own)
```

To start a fresh world, stop the server, move `world.json` out of the data folder (or a made room's
folder in `rooms/`), and start it again. To go back to a backup, stop the server and copy one from
`backups/` over `world.json`.
