#!/usr/bin/env bash
# Keeps the dedicated server on master's newest version (D-084). Players must be on the server's version,
# and the game on GitHub Pages updates with every merge, so the server follows. It waits until nobody is
# playing, so no one is sent away mid-game. Run as root by foundry-update.timer every 5 minutes.
set -euo pipefail
REPO=/home/foundry/hello-world
DATA=/home/foundry/server-data
# Everything in the repo runs as its owner: git refuses a repo owned by someone else ("dubious ownership").
as_foundry() { runuser -u foundry -- "$@"; }
git_() { as_foundry git -C "$REPO" "$@"; }

# The commit the running server was built from. Checked as well as the checkout, so an update whose
# install or build failed after the merge is tried again next time instead of being forgotten.
BUILT="$REPO/dist-server/commit"

git_ fetch --quiet origin master
there=$(git_ rev-parse origin/master)
built=$(cat "$BUILT" 2>/dev/null || true)
[ "$built" = "$there" ] && exit 0

# Who's playing, from the server's status file. It's rewritten every minute; an older one means the
# server isn't running, so there's nobody to wait for.
players=$(node -e "
  try {
    const s = require('$DATA/status.json');
    console.log(Date.now() - Date.parse(s.at) < 5 * 60_000 ? s.players.length : 0);
  } catch { console.log(0); }
")
if [ "$players" != "0" ]; then
  echo "Version ${there:0:7} is waiting until nobody is playing ($players in)."
  exit 0
fi

echo "Updating ${built:0:7} -> ${there:0:7}."
git_ merge --ff-only --quiet origin/master
cd "$REPO"
as_foundry npm ci --no-audit --no-fund --silent
as_foundry npm run build:server --silent
echo "$there" | as_foundry tee "$BUILT" > /dev/null
systemctl restart foundry-server
echo "Updated to $(node -p "require('$REPO/package.json').version")."
