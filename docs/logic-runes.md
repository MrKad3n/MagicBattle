# Logic runes, eight branches and domain rules (c71)

## Eight branches off one rune

Every rune in the Rune Forge has **eight `+` sockets**: N, NE, E, SE, S, SW, W and NW. Up to **8 runes** can branch off one rune; a ninth is a validation error. Diagonal connectors run corner to corner. Keys: Shift+arrows add N / S / W / E, Shift+Home / PgUp / End / PgDn add NW / NE / SW / SE. Spells saved before this load unchanged.

## ❖ Conditional (Logic)

A waiting rune. It hands its energy and target on unchanged, then waits. Each of its branches (up to 8) starts only when **its own** "Wait until" condition occurs. A branch added under a Conditional starts as a Wait-until connector; a branch with no condition runs at once and is flagged.

| Setting | What it does |
| --- | --- |
| Branches fire → each | Every branch fires on its own condition, once. |
| Branches fire → only the first | A switch: the first condition to occur fires and the other branches are cancelled. If several are already true when it is reached, the first branch in order wins. |
| Branches fire → every time | Each branch fires again whenever its condition recurs, up to *Most firings per branch* (2–10), with a *Rest between firings* (0–20 s). |

Cost: `1 + 0.5 × branches`. Example: enemy near → bolt; your health low → heal; you press T → detonate — one Conditional, three branches.

## ↻ Loop (Logic)

Repeats part of the spell, **1–10 times**, with a pause (0–10 s) between passes.

1. Place the Loop at the end of the part to repeat.
2. **Pull its ⟲ handle onto an earlier rune on the same branch.** Valid runes glow while you pull. A dashed arrow with a ↻ badge shows the return branch. A rune after the Loop, a rune on another branch, or the Loop itself is refused.
3. Click the ↻ badge to edit the return branch:
   - **Every time** — go back as soon as the Loop is reached.
   - **Only when… → When it happens** — each repeat waits for the condition (any of the grouped conditions) and gives up after the give-up time.
   - **Only when… → While still true** — each repeat first checks the condition at that moment ("the target is still alive", "the energy is still there"); when it no longer holds, the loop ends.
4. Runes after the Loop run once, when the repeats are used up or the loop ends early.

When a repeat starts the runes run again from the rune it returned to, in the state that rune was first reached in (its energy only if that energy is still alive). An inner Loop starts over on every pass of an outer one. A Loop in a split repeats only its own branch. One spell can make at most 300 repeats.

**Mana.** Each repeat costs the repeated runes' mana **× 1.5** — from the rune it returns to down to the Loop — taken from you when the repeat starts. If you do not have it, the loop ends there. The spell's shown cost includes every repeat ("+N ↻" in the Forge); what is paid when you cast is only the first pass.

## Domains

- **Mana by duration.** A Domain Expansion costs **14 mana for every second it really lasts** on top of its other costs (open domains last 70% as long; the Brief vow halves it). The domain also burns its energy by time (3% of its starting energy a second), so a longer domain spends more.
- **Forced size.** Every domain is **1400 px** in radius. The Narrow vow still squeezes it to 60%.
- **Sealed energy.** The energy put into a domain is spent on it: it is not drawn, cannot be targeted (including its zone), drawn back out, gathered or claimed. Only the domain's own rules, laws and upkeep use it. It goes when the domain ends.

## Files and tests

`magic-engine.js` (runes, executor, validation), `magic-forge.js` / `magic-forge.css` (sockets, return branch). `node tools/logic-tests.js` (51 checks) and `node tools/domain-tests.js` (72).
