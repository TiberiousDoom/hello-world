#!/usr/bin/env bash
# Everything CI runs, in the same order, so a push doesn't turn CI red (see CLAUDE.md, "Before every push").
#
#   scripts/check.sh            lint, typecheck, unit tests, build, then the browser tests
#   scripts/check.sh --twice    the browser tests twice (after touching input, the HUD or the tutorial)
#   scripts/check.sh --fast     everything but the browser tests
#
# A leftover `vite preview` on :4173 would serve the browser tests an old build (Playwright reuses it), so
# it's stopped first. A local `pw.local.config.ts` (not committed, e.g. pointing at a preinstalled browser)
# is used when there is one.
set -euo pipefail
cd "$(dirname "$0")/.."

runs=1
case "${1:-}" in
  --twice) runs=2 ;;
  --fast) runs=0 ;;
  '') ;;
  *) echo "usage: scripts/check.sh [--twice|--fast]" >&2; exit 2 ;;
esac

# Stops whatever serves :4173. By PID, never `pkill -f`, whose pattern can match this shell itself.
stop_preview() {
  local pids=''
  if command -v lsof >/dev/null; then
    pids=$(lsof -ti tcp:4173 -sTCP:LISTEN 2>/dev/null || true)
  elif [ -d /proc ]; then
    # /proc/*/cmdline separates arguments with NUL bytes: turn them into spaces before matching.
    for p in /proc/[0-9]*; do
      if [ "$(cat "$p/comm" 2>/dev/null)" = node ] && tr '\0' ' ' <"$p/cmdline" 2>/dev/null | grep -q 'vite preview'; then
        pids="$pids ${p#/proc/}"
      fi
    done
  fi
  for pid in $pids; do kill "$pid" 2>/dev/null || true; done
}

step() { printf '\n== %s\n' "$*"; }

step lint
npm run lint
step typecheck
npm run typecheck
step 'unit tests'
npm test
step build
npm run build

config=playwright.config.ts
[ -f pw.local.config.ts ] && config=pw.local.config.ts
for ((i = 1; i <= runs; i++)); do
  stop_preview
  step "browser tests ($i of $runs, $config)"
  npx playwright test -c "$config"
done
stop_preview
step 'all checks passed'
