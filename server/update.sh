#!/usr/bin/env bash
# Keeps the dedicated server on master's newest version (D-084). Players must be on the server's version,
# and the game at playnestfall.com updates with every merge, so the server follows. It waits until nobody is
# playing, so no one is sent away mid-game. Run as root by nestfall-update.timer every 5 minutes.
# Servers set up before the rename (D-194) run it as foundry-update, as the user foundry, with the server unit
# foundry-server: so the repo, its owner, the data folder and the unit are all found, not assumed.
set -euo pipefail
REPO=$(cd "$(dirname "$0")/.." && pwd)
DATA=${NESTFALL_DATA:-${FOUNDRY_DATA:-$(dirname "$REPO")/server-data}}
OWNER=$(stat -c %U "$REPO")
UNIT=nestfall-server
systemctl cat nestfall-server > /dev/null 2>&1 || UNIT=foundry-server
# Everything in the repo runs as its owner: git refuses a repo owned by someone else ("dubious ownership").
as_owner() { runuser -u "$OWNER" -- "$@"; }
git_() { as_owner git -C "$REPO" "$@"; }

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
as_owner npm ci --no-audit --no-fund --silent
as_owner npm run build:server --silent
echo "$there" | as_owner tee "$BUILT" > /dev/null
systemctl restart "$UNIT"
echo "Updated to $(node -p "require('$REPO/package.json').version")."
