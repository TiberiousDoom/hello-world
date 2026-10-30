---
name: ship
description: The release loop for Foundry Front, from a fresh branch to a merged PR. Use for any change that will be merged to master (a feature, a fix, a balance change or a docs-only change), and when asked to "release", "ship", "merge" or "close the issues".
---

# Shipping a change

Every merge to `master` is a release: it gets a version, a CHANGELOG entry and deploys to GitHub Pages.
CLAUDE.md holds the rules. This is the order to do them in, with the commands that work.

## 1. Start from the latest master

Other sessions merge to `master` too, so the version and the last decision row move under you.

```bash
git fetch origin master
git checkout -B <your branch> origin/master   # after a merged PR, restart the same branch here
git push -f -u origin <your branch>           # only when the branch holds nothing unmerged
```

If the owner said "record, don't build", the change is docs only (DECISIONS and ROADMAP), but it is still a release.

## 2. Make the change

- Rules in `src/sim/`, numbers in `data.ts`. UI reads, and changes the world only through commands.
- A command that spends for a player passes `player` (building pays from hub stock first, then that
  player's engineer, D-147).
- New rules get a unit test next to the code. Browser tests that assume a number (logs per tree, a cost)
  break when it changes: `grep -rn` the old value in `e2e/` before running them.

## 3. Docs, in the same commit

| File | What |
|---|---|
| `CHANGELOG.md` | A new `## X.Y.Z · YYYY-MM-DD · Title` at the top with `### New` and `### Fixed`, written for players. |
| `package.json` | `"version"` matches the new entry (a test checks). |
| `package-lock.json` | The same version, in **two** places (the top and `packages[""]`). |
| `docs/DECISIONS.md` | A new `D-0xx` row after the last one, 5 columns: `# \| Date \| Decision \| Why \| Status`. Never edit old rows: supersede them. |
| `docs/GAME_DESIGN.md` | Mechanics, numbers and controls, as they are after the change. |
| `docs/ROADMAP.md` | The item's status (✅ built, 🚧 under way, ⬜ to do). |
| `docs/ART_LIST.md`, `docs/CREDITS.md` | When sprites or third-party assets change. |

Bump the patch version for fixes and docs, the minor one for new features. Plain, short sentences.

`docs/DECISIONS.md` has lines thousands of characters long. Edit it with a short Python script or the
Edit tool; piping one of its lines through `rev` or `cut` has hung the shell.

## 4. Check, then push

```bash
scripts/check.sh            # lint, typecheck, unit tests, build, browser tests
scripts/check.sh --twice    # after touching input, the HUD or the tutorial
```

The full browser suite takes about 9 minutes per run: start it in the background and wait for it to finish.
`npm run format` fixes what Prettier complains about. One validated push beats three speculative ones.

Commit with the trailer the session asks for, then push.

## 5. The PR

- Title: `X.Y.Z: what changed (D-0xx)`. Body: `Closes #n.` for each issue fixed, what changed and why,
  and how it was checked.
- Subscribe to the PR's activity and arm one `send_later` check-in about 50 minutes out.
- When CI is green (`build` and `relay` pass, `deploy` is skipped on PRs), merge through the API with
  the exact head SHA (`git rev-parse HEAD`), then delete the check-in and unsubscribe.
- Red CI: read the job log, reproduce locally, fix, run the checks again and push. Never skip a test.

## 6. After the merge

- Issues listed as `Closes #n` close themselves. Close any others the release fixed, each with a
  short comment saying which version fixed it (end GitHub comments with the Claude Code footer).
- Tell the owner what changed in the game, and any choice you made that they may want changed.
