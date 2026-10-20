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
| Q-1 | Final **name** and art direction | Needed before store listings and the logo. Check trademarks |
| Q-2 | **Monetization** for the app stores: premium, free with ads, or free plus an optional purchase? | Affects store setup, privacy policy and UI |
| Q-3 | Is clearing wave 10 the right unlock for hardcore? | It could instead be finishing all research |
| Q-4 | Should **research take time**, rather than being paid for and done at once? | Builderment-like research could use a research building that's fed by belts |
| Q-5 | Should there be a **win condition** or campaign (for example, a final wave or a launch goal), or should the game be endless? | Affects pacing and the content plan |
| Q-6 | Should enemies **target** specific buildings (turrets first) rather than whatever blocks their path? | Affects how walls work as a strategy |
| Q-7 | **Analytics and crash reporting**: which provider, if any, and how players consent | Needed before a public launch |
