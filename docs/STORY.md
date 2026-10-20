# Story proposal: "Keep up appearances"

**Status:** Proposal, from a conversation the project owner had with a friend.
Nothing here is built yet. The decisions it needs are listed as Q-8 to Q-11 in
[DECISIONS.md](DECISIONS.md).

## The pitch

You're a contract worker shipped to a hostile planet by a megacorp (working
name: **the Company**). Your job is to build a factory and teleport goods home
through the hub. The Company watches every shipment, and docks your pay by
email whenever something goes missing.

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
| Open question Q-5 (win condition) | **Escape.** Launching the ship wins the run, and endless play continues afterwards |
| Standard and hardcore modes | Standard: get caught and you're fined. Hardcore: get caught and you're fired, which ends the run |

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
- **The escape ship:** a multi-stage project built at a hidden shipyard. Stages: hull, engine, life support, fuel, navigation. Each stage needs late-tier parts from the stash. Launching it wins the run.

## Rough phasing

1. **Quota and inbox.** Contracts, credits, fines and emails. Small, and gives the game its voice right away.
2. **Suspicion and the black market.** Skimmer, stash, black-market research, audits.
3. **Food.** A new resource chain with meal buffs.
4. **Escape ship.** The win condition, plus a victory screen and a stats summary.
5. **Vehicles.** Depends on Q-8.
