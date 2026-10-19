# Project docs

| Doc | What it's for | Update it when… |
|---|---|---|
| [VISION.md](VISION.md) | What the game is, who it's for, and what it is not | the direction changes |
| [GAME_DESIGN.md](GAME_DESIGN.md) | How the game works right now: rules, content, numbers | a mechanic is added or changed |
| [ROADMAP.md](ROADMAP.md) | Milestones and every workstream, with status | work starts, finishes or gets reprioritized |
| [DECISIONS.md](DECISIONS.md) | Choices we've made and why, plus open questions | a choice is made or a question is raised |
| [ART_LIST.md](ART_LIST.md) | Every art asset the game needs, with specs and status | an asset is added, delivered or changes |
| [../CHANGELOG.md](../CHANGELOG.md) | What changed in each release | every merge to `main` |

## Working agreement

1. **Plan in the roadmap first.** New work goes into [ROADMAP.md](ROADMAP.md)
   before it's built, so nothing is done "from the hip" without a record.
2. **Record decisions.** If a change involves a real choice (a mechanic, a
   tool, a trade-off), add an entry to [DECISIONS.md](DECISIONS.md). Open
   questions go there too, so they don't get lost.
3. **Keep the design doc true.** [GAME_DESIGN.md](GAME_DESIGN.md) describes
   the game as it is on `main`. Numbers come from `src/sim/data.ts`, which
   is the source of truth if the two disagree.
4. **Every PR** updates the roadmap status, the changelog, and the design doc
   if mechanics changed. Tests and the build must pass (CI checks both).
5. **Playtest notes** go in GitHub issues with the `playtest` label, then get
   triaged into the roadmap.
