# Mirror War — the Autonomous Spell Legion

A 61-rune player spell, built with the ordinary rune engine and carried by the **Scroll of Mirror War**. One cast fires five families of projectiles in sequence, under seven Binding Vow contracts. No engine code was changed, and nothing in the spell homes, tracks or predicts.

- Get it: Inventory → **🪞 Mirror War** (adds the scroll; **Shift+click** also raises base Control to 17 and base Power until Max Output covers it — a testing aid). Then use the scroll to copy the spell into a slot.
- Source of truth: `tools/mirror-war.js` (builder, tunables at the top). The scroll carries `mirror-war-spell.js`, generated with `node tools/mirror-war.js --write`.
- Checks: `node tools/mirror-war-tests.js --table` (39) · report: `node tools/mirror-war-sim.js`.

## Cost and limits

| | |
| --- | --- |
| Runes | 61 (engine cap 100) |
| Energy Control needed | 17 (rune capacity = 10 + 3 × Control) |
| Generate | 400 E |
| Mana | 497 |
| Estimated output | 798 — over most Max Outputs; the excess is paid in Total Mana (5 × the excess) |

The guide's 100–120 rune target was not reached on purpose. The engine caps a spell at 100 runes, and every three runes also cost a point of Energy Control, so padding would only have made the spell harder to cast. Every rune in the tree does something.

## Tree

Rune types used: Generate, Split, Colour, Compress / Shape, Redirect, Rotate, Binding Vow. Connectors: Instant and Delay only — no conditions, because none were needed.

```
Generate 400
└ Split 30% ─┬ [first]  EXECUTORS    Colour crimson → Split ÷3
             │             #1  Vow: Absolute Compression 10 → Compress 10 lance → Redirect mouse 75%        [+1.6 s]
             │             #2  Compress 8 lance → Vow: Solitude (body) → Redirect mouse 75% [+1.95 s]
             │                 → Rotate path 55° ccw → Redirect mouse 75% [+0.35 s]
             │             #3  Compress 8 lance → Redirect mouse 75% [+2.3 s] → Rotate path 55° cw → Redirect mouse 75% [+0.35 s]
             └ Split 30% ─┬ SWEEPERS   Colour cyan → Split ÷2
                          │             A  Compress 5 wave → Vow: Patience 1.0 s (hold still) → Redirect mouse 80% [+0.6 s] → Rotate shape 90°
                          │             B  Compress 4 cone → Redirect mouse 80% [+0.4 s]
                          └ Split 40% ─┬ CROSSFIRE  Colour gold → Split ÷3
                                       │             A  Compress 6 arrow → Redirect mouse 90% [+0.8 s] → Rotate path 70° ccw → Redirect mouse 90% [+0.35 s] → Vow: Long Journey 350 px
                                       │             B  Compress 6 arrow → Redirect [+0.8 s] → Rotate path 70° cw → Redirect [+0.35 s]
                                       │             C  Compress 6 arrow → Redirect mouse 90% [+1.15 s] → Vow: Long Journey 500 px
                                       └ Split 60% ─┬ HARRIERS   Colour azure → Split ÷3
                                                    │             A  Compress 4 point → Redirect mouse 100% → Vow: Unerring Path (250 px)
                                                    │             B  Compress 4 point → Redirect mouse 100% [+0.12 s] → Rotate path 4° cw → Vow: Unerring Path (250 px)
                                                    │             C  Compress 4 point → Redirect mouse 100% [+0.24 s] → Rotate path 4° ccw
                                                    └ RESERVES   Colour rose → Split ÷2
                                                                  A  Compress 5 disc → Redirect mouse 85% [+1.2 s] → Rotate path 4° ccw
                                                                  B  Compress 5 star → Redirect mouse 85% [+1.6 s] → Rotate path 4° cw
```

Rune counts: Generate 1 · Split 9 · Colour 5 · Compress 13 · Redirect 17 · Rotate 9 · Vow 7 = 61.

## Why it is built this way

- **Energy division.** Split divides, never duplicates. A Split's "first branch share" is the only knob, so the five-way allocation is a cascade of two-way Splits: Executors 30%, then Sweepers 30% of the rest, Crossfire 40% of that, Harriers 60% of that, Reserves the remainder. Measured shares at t = 0 (after each Split's 2% loss and the Compress losses): Executors 30.1%, Sweepers 21.5%, Crossfire 19.4%, Harriers 17.5%, Reserves 11.5%. Executors hold the most; Reserves still carry 37 E.
- **Shape first, wait compressed.** Raw waiting energy leaks about 11% a second; shaped (compressed) energy leaks about 7%. So every projectile is shaped at t = 0 and the Delay connector sits on the Redirect that launches it. Sequence: Harriers 0 s, Sweepers 0.4, Crossfire 0.8, Reserves 1.2, Executors 1.6.
- **Aim.** Each projectile is aimed once, at the cursor at the moment it is released. Offsets are made with Rotate (path) so they stay relative to the cursor line whichever way you face. The wave is stood on end with Rotate (shape), which turns the shape, not the path.
- **Crossfire and Executors converge** by leaving 70° / 55° off the line, then a second Redirect (0.35 s later) swings them back onto the cursor from opposite sides — a real second approach angle, with no homing. Long Journey does not forbid turning; Unerring Path (which does) is only on the Harriers, which never turn after launch.
- **Offsets are small on purpose.** Harriers fan only ±4°: a bigger fan simply misses a 30 px target at range (it did, in the first simulation). They are a net against dodging, not a spread.

## Vow contracts

| Vow | Where | Settings | What it really restricts |
| --- | --- | --- | --- |
| Unerring Path ×2 | Harriers A, B — after Redirect (and Rotate) | minDist 250, failure *lose* | No turn > ~8° after launch; pays only for a straight flight of at least 250 px |
| Patience | Sweeper A (wave) — before its delayed Redirect | 1.0 s, *hold still*, failure *lose* | Waits 1.0 s holding still; passes through enemies harmlessly until then; pays on the first hit after |
| Long Journey ×2 | Crossfire A (350 px) and C (500 px) — after launch | failure *lose* | Striking before the distance breaks it |
| Absolute Compression | Executor 1 — before its Compress | level 10, failure *lose* | Must reach and hold compression 10; breaks if it strikes first |
| Solitude | Executor 2 — after its last split, before launch | strict *body*, failure *lose* | Must stay one body; any Split / Divide breaks it |

All failure clauses are the mildest (*lose the bonus*). The vow system's own rules apply: one contract, one payout (split pieces share the contract, merges keep each contract once), bonus capped at +150% of the body's own energy, bonus energy is free and never counts against Max Output. Perfect Sequence and Final Fragment are not used (the guide marks them as needing shared branch-completion tracking, which was not added).

## Simulation (real engine, headless, Power 50 / Control 20, Generate 400)

Cursor lags the enemy by 12 frames (a human aim). Damage is what the engine's host received.

| Scenario | Damage | Notes |
| --- | ---: | --- |
| Stationary @ 700 px | 468 | all 13 launch; all 7 contracts pay |
| Stationary @ 250 px | 391 | too close: both Unerring end unpaid (struck after 117 px), both Long Journey break; Patience is left unpaid (one wave misses); Compression and Solitude pay |
| Slow walker ±140 px | 457 | one Unerring ends unpaid, six contracts pay; Crossfire hits hardest (128) |
| Fast, erratic, jumping | 306 | 3 bodies still in flight at the end; one Unerring ends unpaid; one Long Journey still active |
| Deflector (turns bodies under 28 E) | 276 | 8 bodies turned (harriers, arrows, reserves); both Unerring contracts *break*; sweepers and spears land |
| Cast cancelled at 1.2 s | 58 | harriers already landed; no Executor launches; nothing left behind; only the two Unerring contracts pay |

Per-family result against the stationary target at 700 px:

| Family | Launched | E formed | E at launch | Hit | Damage | Launched at |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Harriers | 3 | 61 | 61 | 3 | 71 | 0.00 s |
| Sweepers | 2 | 75 | 73 | 2 | 98 | 0.40 s |
| Crossfire | 3 | 68 | 64 | 3 | 99 | 0.78 s |
| Reserves | 2 | 40 | 37 | 2 | 23 | 1.18 s |
| Executors | 3 | 105 | 94 | 3 | 178 | 1.60 s |

Vow bonuses recorded separately from the 400 E: +45 E in this run (Compression +7, Solitude +9, Patience +8, Unerring +6 / +6, Journey +4 / +5).

Against smaller spells with the same Generate amount:

| Spell | Mana | Still @700 | Still @250 | Slow | Fast (8 runs) | Average | Dmg / mana |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Energy Bolt | 404 | 235 | 239 | 235 | 176 | 221 | 0.55 |
| Fan of five | 412 | 231 | 234 | 230 | 202 | 224 | 0.54 |
| Spear (compress 10) | 409 | 391 | 396 | 390 | 342 | 380 | 0.93 |
| Bolt (compress 6) | 407 | 409 | 413 | 409 | 307 | 384 | 0.94 |
| Fan ×5 (compress 5) | 415 | 405 | 410 | 405 | 354 | 394 | 0.95 |
| **Mirror War** | 497 | 468 | 391 | 457 | 325 | **410** | 0.82 |

It out-damages every smaller spell on average and by a wide margin on stationary or predictable targets, but it costs a fifth more mana, is less efficient than any compressed small spell, and against the erratic jumper it lands less than the compressed fan or the spear. It does not dominate. Cleanup: one cast peaks at 13 bodies, six at once at 78, worst frame 12.5 ms headless; everything is gone afterwards, with no open contracts.

## Known limits and weaker spots

- **Reserves are the weakest family** (23 damage from 37 E). They are insurance, not a payload; they could take a Patience variant or more compression.
- The 400 E / 798 output makes it a Total Mana spell for anyone below Power ~52.
- A caster who walks away leaves the waiting shapes where the cast began; they are released from there.
- Not simulated: PvP and co-op; the real feel of the 0.4 s stagger against a moving player.
- The vow suite showed one failure in one of four runs (35/35 on the three reruns): its random draw is not seeded.
