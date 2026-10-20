# Decisions

A short record of each choice: what we decided, and why. New entries go at
the bottom. To reverse a decision, add a new entry that supersedes the old
one; don't edit the old entry.

| # | Date | Decision | Why | Status |
|---|---|---|---|---|
| D-001 | 2026-10-19 | Build for the **web** with TypeScript, Vite and Canvas 2D | It's playable from a link right away, and Capacitor can wrap the same code into phone apps later | Accepted |
| D-002 | 2026-10-19 | **2D first.** Keep the simulation (`src/sim`) free of rendering code | It's faster to make playable, and a 3D renderer can be added later without changing the rules | Accepted |
| D-003 | 2026-10-19 | The old Godot game lives on in **git history** only | It's not needed in the working tree | Accepted |
| D-004 | 2026-10-19 | **Tower defense** where turrets fire items the factory makes | Ties both halves of the game together, and sets it apart from Builderment | Accepted |
| D-005 | 2026-10-19 | **Placeholder art** (shapes and colors) until the mechanics settle | Avoids redrawing art as the design changes | Accepted |
| D-006 | 2026-10-19 | The hub stays a **sink**. **Hub ports** (researched) let you send chosen items back out | See the analysis below | Proposed. Please review |
| D-007 | 2026-10-19 | **Research replaces tiers.** You start with 3 buildings, and research is paid from hub stock | Builderment-style progression, and fewer choices up front for new players | Accepted (from playtest notes) |
| D-008 | 2026-10-19 | **Standard mode** has a soft fail (a breach). **Hardcore** ends the run and is unlocked by clearing wave 10 | Matches the request: hardcore is unlocked, and the default is forgiving | Accepted. The unlock condition is open to tuning |
| D-009 | 2026-10-19 | The **tutorial** is a series of spotlight steps (Next, Back, ✕). It explains but doesn't require actions | Matches the request, and is simple to keep accurate | Accepted. An interactive version may come later |
| D-010 | 2026-10-19 | Deploy `master` to **GitHub Pages** via Actions. CI runs the tests and the build on every PR | Gives a public link with no servers to run | Accepted |
| D-011 | 2026-10-20 | **Menu style:** flat navy and sky-blue icons with bold rounded type (Montserrat), inspired by a stock factory icon set the owner shared. Our icons are drawn from scratch; the stock art is not used | Clean, readable, works on phones. The stock image is watermarked and licensed | Accepted |
| D-012 | 2026-10-20 | **Art pipeline:** sprites in `src/art/`, SVG placeholders that same-named PNGs override, pre-rendered once at load | The owner's art drops in with no code changes. Pre-rendering keeps drawing fast on phones | Accepted |
| D-013 | 2026-10-20 | The game opens on a **main menu** with a demo factory running behind it | A first impression that shows the game, and a home for Continue, New game and Help | Accepted |
| D-014 | 2026-10-20 | **Story (Q-9):** adopt "keep up appearances". What you thought was a job is really indentured servitude: debt keeps piling up and your pay keeps getting docked. Your real goal is escape | The owner's idea. It gives the factory a purpose and a villain | Accepted |
| D-015 | 2026-10-20 | **Tone (Q-10):** dry corporate satire, delivered mostly through Company emails | Funny without cutscenes, and cheap to write and change | Accepted |
| D-016 | 2026-10-20 | **Getting caught (Q-11):** Standard mode fines you. Hardcore confiscates or destroys your unauthorized (black-market) equipment | Keeps hardcore harsh without ending the run on a single audit | Accepted (black market is phase 2) |
| D-017 | 2026-10-20 | **Monetization (Q-2):** an optional purchase, plus donations or tips | Donations and tips allow repeat support from the same player. No ads | Accepted |
| D-018 | 2026-10-20 | **Research takes time (Q-4):** items are delivered to the research and consumed by it over time, not paid all at once | Builderment-style, and makes research a logistics job | Accepted (not built yet) |
| D-019 | 2026-10-20 | **Win condition (Q-5):** escaping wins the run and unlocks endless mode. Story beat: you couldn't survive on your own, so you came back | A satisfying ending that keeps the sandbox | Accepted (not built yet) |
| D-020 | 2026-10-20 | **Enemy targeting (Q-6):** basic enemies attack the nearest building. Later enemies also attack the nearest, but switch to a turret that shoots them. Both still attack a wall in the way if they can't easily go around | Makes walls and turret placement matter | Accepted (not built yet) |
| D-021 | 2026-10-20 | **Vehicles and gear (Q-8):** on hold | Decide after the story's core systems are in | Deferred |
| D-022 | 2026-10-20 | **Contracts and the inbox** (story phase 1): timed contracts paid in wages minus deductions; missed contracts fined and the next one enlarged; a store on credit; licence fees for research; repair invoices for breaches. Placeholder company name: **Halcyon Extraction Co.** | Smallest slice that gives the game its voice and the factory a purpose | Accepted (built) |
| D-023 | 2026-10-20 | **Mouse wheel (Q-13):** rotates the building being placed, and zooms otherwise. Ctrl+wheel (also a trackpad pinch) always zooms | Owner agreed with the recommendation. Touch is unchanged | Accepted (built) |
| D-024 | 2026-10-20 | **Hub gun:** 9 damage, 1.2 shots/s, range 6, no ammo, no upgrades | Meets the owner's target (wave 1 alone for at most 25% HP) and still needs turrets from wave 2 on | Accepted (built) |
| D-025 | 2026-10-20 | **Tutorial as lessons** (supersedes D-009): short lessons triggered by game events, with action steps that wait for the player. The game runs during action steps and pauses during explanations. Seen lessons are stored in the browser profile; players can replay them or switch them off | Owner's playtest notes: split by priority, make it interactive, trigger it by events | Accepted (built) |

## D-006: How should turrets get ammo?

**Problem (from playtesting):** items that go into the hub never come
out, so turrets can only be fed by a separate line from production.

| Option | Pros | Cons |
|---|---|---|
| A. Production lines only (with splitters) | Purest logistics puzzle | Stockpiles can't help in an emergency, and every turret needs its own line from production |
| **B. Hub ports** (chosen) | The stockpile becomes a strategic reserve. The trade-off is ammo now versus building and research later. It's still a belt puzzle | Can make production lines for ammo less necessary |
| C. Turrets draw from hub stock within a radius | Simplest for the player | Removes logistics from defense, which is the core idea |
| D. Dedicated ammo items (e.g. a bullet recipe) | Gives the factory a clear defensive goal | More items and recipes to learn early on |

**Recommendation:** B now. Consider D later, as an upgrade (for example,
higher-damage ammo recipes) rather than a requirement. Ports are researched,
not available at the start, so early defense still depends on production lines.

## Open questions

| # | Question | Notes |
|---|---|---|
| Q-1 | Final **name** and art direction, including the Company's name (placeholder: Halcyon Extraction Co.) | Needed before store listings and the logo. Check trademarks |
| Q-3 | Is clearing wave 10 the right unlock for hardcore? | It could instead be finishing all research, or escaping once |
| Q-7 | **Analytics and crash reporting**: which provider, if any, and how players consent | Needed before a public launch |
| Q-8 | **Vehicles and gear**: should the player steer one around the map, or should vehicles go on off-screen expeditions? | On hold (D-021) |
| Q-12 | **Contract balance:** are the sizes, the 6-minute deadline, fines and wages right? | Tune after playtesting |

Answered: Q-13 (D-023), Q-2 (D-017), Q-4 (D-018), Q-5 (D-019), Q-6 (D-020), Q-9 (D-014), Q-10 (D-015), Q-11 (D-016).
