# Story proposal: "Keep up appearances"

**Status:** Adopted (D-014). Phase 1 (contracts and the inbox) and phase 2 (suspicion, audits and the black market) are built. Suspicion is being reworked (Q-16). Phase 4 (the escape ship and win condition) is built. The
idea came from a conversation the project owner had with a friend. The
related decisions are D-014 to D-022 in [DECISIONS.md](DECISIONS.md).

## The pitch

You're a contract worker shipped to a hostile planet by a megacorp (working
name: **the Company**). Your job is to build a factory and teleport goods home
through the hub. The Company watches every shipment, and docks your pay by
email whenever something goes missing.

It turns out it isn't really a job. It's **indentured servitude**: your
passage, equipment and oxygen are all billed to you, the debt keeps growing,
and your pay keeps getting docked.

**Your real goal is to escape.** While you keep the quota flowing to keep up
appearances, you quietly divert parts into a hidden ship. You build black-market
machines the Company can't see, and you make things for yourself: food, gear and
vehicles. That breaks up "factory after factory", because you're building a
second, secret economy inside the first.

Tone: dry corporate satire. Cheerful HR emails, passive-aggressive memos, and
fines itemised to the cent.

## Why it fits what we have

| Already built | Becomes |
|---|---|
| Hub (a sink for items) | The Company uplink. Everything delivered is "theirs" |
| Hub port (takes stock back out) | Visibly suspicious. The Company notices withdrawals |
| Research paid from stock | **Company research**, paid in quota credits, versus **black-market research**, paid in diverted parts |
| Waves of enemies | The planet's wildlife. When suspicion runs high, Company "security sweeps" can come too |
| The win condition | **Escape.** Launching the ship wins the run and unlocks endless mode: you couldn't survive on your own, so you came back (D-019) |
| Standard and hardcore modes | Getting caught: Standard fines you. Hardcore confiscates or destroys your unauthorized equipment (D-016) |

## New systems

### 1. Quota contracts
- Every few minutes the Company issues a contract, for example "Ship 120 iron plates and 40 gears in 8 minutes".
- Meeting it earns **credits**, which pay for Company research and keep suspicion down.
- Missing it means a fine and higher suspicion.
- This gives the main factory a clear, changing purpose.

### 2. Suspicion
A meter from 0 to 100. It rises when you:
- miss quotas
- withdraw stock through hub ports
- have contraband machines within view of a Company asset
- skim items from Company lines

It falls slowly while you meet quotas. At thresholds it triggers:
- warning emails
- **audits**: an inspection drone flies a route, and any contraband in its scan radius gets you fined, or the item confiscated
- security sweeps

### 3. The inbox
A mail icon in the HUD. Company emails react to what you do ("Re: Missing 3 iron plates (ref #44812)").
- This delivers the story and humour without any cutscenes.
- It doubles as the quota board and the audit warnings.
- Later, an unknown contact on the black market offers you secret jobs.

### 4. Black-market machines
Secret buildings unlocked by black-market research:
- **Skimmer:** a belt piece that siphons about 1 in 10 items into a hidden stash. Small suspicion while it's active.
- **Hidden workshop / still:** crafts parts for you. It's contraband, so build it away from Company eyes.
- **Disguised machine:** looks like a Company furnace to audits, but costs more and is slower.
- **Stash:** hidden storage for diverted goods. Black-market research and the ship draw from it, not from hub stock.

### 5. Things for you
These are what break up the factory loop.
- **Food factory:** farms, then kitchen, then meals. Company rations are free but bland. Your own meals give buffs (faster building, faster machines), and the Company charges you for "unauthorised catering".
- **Personal gear and vehicles:** a jetpack, a rover or a small ship that you use. The form depends on Q-8 below.
- **The escape ship:** a multi-stage project built at a hidden shipyard. Stages: hull, engine, life support and navigation (fuel is left out for now). Each stage is fed by belt straight into the shipyard, so every part is one the Company never sees. Launching it, and holding the shipyard while the planet comes for it, wins the run.

## Rough phasing

1. ✅ **Quota and inbox.** Contracts, wages and deductions, fines, debt, the Company Store on credit, licence fees and repair invoices. See [GAME_DESIGN.md](GAME_DESIGN.md#the-company).
2. ✅ **Suspicion and the black market.** A Friend, stash, skimmer, black-market research (skimmer, disguise kit), suspicion, audits with mode-specific penalties. The hidden workshop moves to phase 4, where it builds ship parts. See [GAME_DESIGN.md](GAME_DESIGN.md#the-black-market).
3. **Food.** A new resource chain with meal buffs.
4. ✅ **Escape ship.** Shipyard, four stages, a launch to defend, a victory screen with the run's numbers, and endless mode afterwards. See [GAME_DESIGN.md](GAME_DESIGN.md#the-escape-ship).
5. **Vehicles.** On hold (D-021).
