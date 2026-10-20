# The Grand Arcanist — implementation and simulation report

An endgame boss who uses **no technique at all**. Every attack is an ordinary rune tree cast through the real
magic engine with his own reserve. Generated alongside `tools/arcanist-campaign.js` (37 / 37 checks pass).

> **c61 update.** At the user's request he now has a 30000 reserve with 900 / s regeneration, faster attacks and no
> warnings drawn. The numbers below are from c60.
>
> | | c60 | c61 |
> |---|---|---|
> | Wind-ups | as listed | 30 % of listed, never under 0.1 s |
> | Cooldowns | as listed | 40 % of listed |
> | Rest between decisions | 0.4–1.05 s | 0.12–0.4 s |
> | Damage to a still player | 25.3 dps | 46.7 dps |
> | Damage to a strafing player | 9.2 dps | 24.8 dps |
> | Worst one second | 220 | 407 |
> | Skilled bot (natural fights) | wins 4 / 6 | wins 0 / 6 |
> | Blooming Line, best counter | 100 % clean | 50 % clean |
>
> Campaign: 34 / 37. The three fairness checks above no longer pass. `CONFIG.showTelegraphs = true` restores the
> warnings; `CONFIG.hp` and `cooldownMul` are the main difficulty dials.

## How to fight him

There are two ways in:

- **The trial:** `dungeon.html?mode=sandbox&arena=mages&boss=arcanist`.
  - It is the Mage Arena with your real energy reserve (1500) and real regeneration.
  - The sandbox's infinite energy is switched off.
  - He is summoned at the start.
- **The Mage Arena summon panel.** There is also a "⚜ The Grand Arcanist — Trial" link there.

How the fight works:

- **Phases:** three. The phase shifts are at 66 % and 33 % of his health.
- **If you die:** his spells end and he recovers fully. The fight restarts from phase I.

## 1. Simulation discoveries

The repository had **no spell-discovery system and no simulation artifacts**. Nothing matched discover, catalog,
manifest or campaign. So nothing below is borrowed from an earlier run: the discovery sweep was built first, for this
boss.

### The sweep (`tools/raw-discovery.js`, seed 6060)

**What it searches**

- A bounded grammar of raw-energy spells: amount × compression/shape × Divide/Split × a motion program × a terminal.
- **Motion programs:** direct, staged hold, staggered, arcing, guided, lurking for a condition, rise and drop.
- **Terminals:** none, burst near the target, burst on arrival, expand then burst.

**How each candidate is tested**

1. It is built as an engine spell.
2. It is validated with the boss's profile.
3. It is cast in a fresh world in the Mage Arena's real geometry.
4. It runs against 7 player policies from 2 distances.
5. It is re-run once with the same seed to prove it reproduces.

**Outputs** (`sim/raw-discovery/`)

- `capability-manifest.json`
- `catalog.json` (every serialised tree)
- `campaign-summary.json`
- `coverage.json`
- `performance.json`
- `bugs.json` (with a minimised repro)

**Results**

- **Evaluated:** 404 candidates (116 more were rejected for exceeding Max Output 960).
- **Clean:** 401. The other 3 were flagged.
- **Speed:** mean update 0.005 ms, worst frame 9 ms, peak 8 bodies.
- **Bugs found:**
  - No crashes, NaN or self-damage.
  - No energy stuck outside the arena.
  - One exploit class, *lingering repeat hits* (RD-0019, RD-0310, RD-0379). A guided or anchored piece with no
    terminal keeps striking and is still alive after 10 s. RD-0379 dealt 1641 engine damage to a still target.
  - A 9-rune minimised reproduction is saved.

### Used

| Discovery | Became | Why |
|---|---|---|
| **RD-0099** | **Blooming Line** (signature) | 400 E → Compress 8 disc → Divide 5 horizontal (spacing 160, keep) → Redirect → *when the target is within 110 px*: Compress −6 (expand) → Discharge 1.4. Five narrow, fast discs that swell into wide bursts only as they arrive. Dodging the disc is not enough; you have to leave the bloom. It hit **every** policy in the sweep, including the dodging ones (hit-rate on moving targets 1.00 vs 0.58 for the best plain shot). That is a real interaction of compression, expansion and a proximity condition, not a bigger projectile. Used unchanged (the campaign checks the tree is byte-identical to the catalog's). |
| **RD-0234** | **Waiting Mines** | 240 E → Compress 8 → Divide 3 cluster → Redirect (stop) → when arrived: Anchor → when an enemy is within 120: Discharge 1.8. It caught the reactive dodger 100 % of the time, because the bot fled the incoming energy straight into the mines that landed where it was heading. Pure kiting beats it (0 %), which gives it clear counterplay. |

### Considered and rejected

| Discovery | Why not |
|---|---|
| RD-0357 (descending curtain of 8 lances) | Strong (1.00 against every moving policy), but Divide-outward spawns the outer lances up to ~560 px from him at once. At mid range a lance can appear on the player with no readable telegraph (first hits at 0.1–0.2 s). |
| RD-0207 (top score, ring split ×3 staggered) | Peak output 947 of 960, and its role duplicates Delayed Crossfire, which has clearer fuse telegraphs. |
| RD-0428 / 0188 / 0052 … (guided bursts) | Homing that leaves 1–2 bodies alive after 10 s; against non-dodgers it is close to a guaranteed hit. |
| RD-0379 / 0019 / 0310 | The lingering-repeat-hit exploit above. |
| Anything with a Technique rune or Draw Out from the world | Out of scope by construction. The sweep's grammar has no such rune, and the boss's policy refuses them. |

The other eleven attacks are **initial authored spells** (marked `source: "authored"`). They are verified by the same
campaign, but they did not come out of the sweep.

## 2. How his library differs from player spells

- **No technique at all:**
  - His profile has no technique points.
  - The policy refuses Technique / reverse / legacy runes, technique parameters, Infinity anchor-state targets,
    domains, zones, and targets that could take another caster's energy (spell / energy / environment).
  - Draw Out is allowed only from himself.
- **Real cost:**
  - Every cast pays its validated upfront cost from his 7000 reserve (regenerating 150 / s, a documented boss
    allowance).
  - His Draw Out stream pays for every unit drawn (`owner.drain`). Rune mages' Draw Out had been free.
- **Within Max Output:** every tree fits 960. The Absolute Output finisher was redesigned from a 3540-output draft to 813.
- **Metadata on top of the tree:** each attack carries role, phases, range, prep, telegraph, recovery, cooldown,
  intended response, counters and limitations. The tree is untouched; the metadata only decides when he casts it.

## 3. Attack library (`data/arcanist-spell-library.json`)

| Attack | Role | Source | Phases I/II/III | Cost (E) | Peak output | Telegraph | Still hit | Strafe hit | Earliest hit | Best counter |
|---|---|---|---|---|---|---|---|---|---|---|
| Precision Lance | A | authored | 1 / 1 / 0.8 | 81 | 177 | 0.5 s | 100% | 75% | 0.97 s | away (100% clean) |
| Converging Volley | B | authored | 1 / 1 / 1 | 250 | 400 | 0.4 s | 100% | 50% | 1.22 s | away (100% clean) |
| Heavy Orb | F | authored | 0.9 / 0.8 / 0.6 | 490 | 713 | 0.9 s | 75% | 25% | 2.03 s | away (100% clean) |
| Watching Shard | H | authored | 0.5 / 1 / 1 | 101 | 217 | 0.45 s | 0% | 0% | 0.90 s | don't attack (100% clean) |
| Delayed Crossfire | C | authored | 0 / 1 / 1 | 257 | 474 | 0.4 s | 100% | 25% | 1.25 s | away (100% clean) |
| Saturation Stream | E | authored | 0 / 1 / 1 | 249 * | — | 0.5 s | 100% | 67% | 1.17 s | away (100% clean) |
| Branching Pursuit | G | authored | 0 / 1 / 1 | 212 | 395 | 0.45 s | 100% | 50% | 1.20 s | away (100% clean) |
| Expanding Burst | D | authored | 0.6 / 1 / 1 | 274 | 561 | 0.45 s | 100% | 50% | 1.20 s | away (100% clean) |
| Gilded Ward | I | authored | 0.5 / 0.8 / 0.8 | 373 | 336 | 0.35 s | — | — | 2.78 s | step back (100% clean) |
| Lattice of Mines | K | authored | 0 / 0.8 / 1 | 333 | 635 | 0.45 s | 100% | 100% | 0.95 s | away (100% clean) |
| Absolute Output | J | authored | 0 / 0 / 1 | 324 | 813 | 1.0 s (+1.4 s hold) | 100% | 38% | 3.27 s | away / toward (100% clean) |
| **Blooming Line** | L | **RD-0099** | 0 / 0.6 / 1.2 | 444 | 947 | 0.7 s | 100% | 100% | 0.97 s | away (100% clean) |
| Waiting Mines | H | **RD-0234** | 0 / 0.7 / 0.7 | 263 | 568 | 0.45 s | 100% | 100% | 1.13 s | away (100% clean) |

\* 9 E upfront plus 240 E drawn from his reserve while it streams. The validator reports no peak output for drawn energy.

He also runs four sequences, which chain attacks with timed gaps:

- Pin and Lance
- Crossfire into Volley
- Pressure (mines, then a stream)
- Bloom and Chase

### Telegraphs

Telegraphs come from the engine's own geometry:

- **Aim lines** are drawn to the cursor the spell will actually use.
- **Burst circles** use the real Discharge formula (`(bodyRadius·2.6 + 28) × radius`). They are measured at load by
  casting each spell in a private world: nova 254 px, mines 140 px, bloom 118 px, volley 90 px, ward 90 px.
- **Live spells** draw their own circles (mines, orb, blooms), fuse rings (crossfire, pursuit) and a "watching" line
  (shard).

## 4. How he chooses

**Perception.** He sees you 0.2 s late (RuneMages' perception), with aim noise.

**What he remembers** (only what is visible on screen):

- jump rhythm regularity
- time spent close or far
- how long you have stood still
- attacks and casts in the last 10 s
- which way you dodge after his shots (away / toward / up)
- damage he took recently

**Scoring.** Every attack gets a utility score:

> phase weight × range fit × behaviour fit × redundancy (his energy already near you) × recently-seen penalty
> (half-life 8 s) × risk (long rooted casts up close) × tier

- Attacks that are unaffordable (a 350 E floor is kept back), on cooldown or over the body cap score 0.
- He picks with a softmax over the best three (temperature 0.35), so he is not perfectly predictable.
- Each choice is logged in `GA.decisions` with its features and the top three scores.

**Adaptation (measured).** The attack whose share rises most for each player behaviour:

| Player behaviour | His favourite | Lift over his average mix |
|---|---|---|
| Standing still | Precision Lance | ×2.0 |
| Rushing in | Expanding Burst | ×7.8 |
| Kiting | Saturation Stream | ×1.6 |
| Rhythmic jumping | Converging Volley | ×1.6 |

**Phases** (the ones a player feels):

- **Phase I:** lance, volley, orb, a limited Watching Shard.
- **Phase II:** adds crossfire, stream, pursuit, mines, the burst and the sequences.
- **Phase III:**
  - the finisher and the signature at full weight
  - 30 % shorter recovery
  - 15 % shorter cooldowns
  - faster movement

**Interrupts and limits:**

- A stun during his telegraph cancels the attack.
- He then has 3 s of poise (no stun-lock). Knockback is capped at 8 frames.
- He never teleports or flies.

## 5. Measured difficulty

**Phase sweeps** (his health lowered on a schedule; 90 s, 3 seeds each):

| Player policy | His damage / s | Player deaths per 90 s | Worst 1 s burst |
|---|---|---|---|
| still | 25.3 | 3.67 | 205 |
| aggressive | 21.5 | 3.33 | 220 |
| random | 12.6 | 1.67 | 213 |
| kiter | 10.3 | 1.00 | 168 |
| strafe | 9.2 | 1.33 | 177 |
| jumper | 8.7 | 1.00 | 135 |
| reactive (0.22 s reaction) | 5.8 | 1.00 | 146 |
| baseline | 5.5 | 0.67 | 168 |
| skilled (reads his tells, punishes rooted casts) | 4.2 | 0.00 | 126 |

**Natural fights.** Nothing was forced:

- The player has the real 1500 reserve and 81 E/s regeneration, and fires 160 E compressed lances.
- He resets fully on the player's death.
- Each fight lasts up to 300 s, with 6 seeds per policy.

| Player | Wins | Kill times | Deaths |
|---|---|---|---|
| skilled | 4 / 6 | 86–214 s | 7 |
| reactive | 1 / 6 | 214 s | 13 |
| baseline | 0 / 6 | — | 20 |
| strafe | 0 / 6 | — | 34 (about 1.1 per minute) |

**Safety:**

- The worst one second of damage in any run was 220 of 500 health.
- No attack can hit sooner than 0.9 s after its telegraph starts.

## 6. Technique-free, stability, regression

**Technique-free:**

- 2.47 million body-frames were inspected (every frame, every body he owned): no technique, Infinity, spatial state or
  rupture ever appeared.
- The policy refused nothing during the fights.
- A technique pushed onto his energy from outside is stripped at once and logged as external.
- The control case (technique energy that appears on his own side) is caught.

**Stability:**

- **Load:** 28 bodies at once, 0.32 ms 99th-percentile update.
- **Phase change:** with live energy, everything of his ends and nothing lands during the 1.8 s shift.
- **His death mid-attack:** nothing is left behind.
- **Player death:** he clears his spells, deals no damage while you are down, and fights again after.
- **Scene exit (`RuneMages.clear`):** everything is removed.
- **Long fight:** 600 s stays bounded (≤ 32 bodies, ≤ 10 instances), with no errors.
- **Confined arena:** a 2200 px walled room shows no errors and no trap.
- **Drawing:** across every attack, a phase change and his death, the drawing never throws.

**Regression:**

- Engine checks: 194 / 194.
- The rune mages' and Aster Vael's self-tests are random by design, so they were run seeded (seeds 1–4). The results
  are **identical to the pre-boss code, seed for seed**: 25, 24, 24 and 24 of 26. The same checks fail before and
  after, as they did before this work.

## 7. Known limits and open points

- **Running away is the best counter to every attack in the open arena:**
  - In the counterplay test, running straight away from him took no damage in every run. That reflects a 9000 px
    floor.
  - Running away never damages him.
  - In the confined arena the wall ends it.
  - A future pass could add an attack that rewards closing in.
- **Telegraph sizes are measured once at load.** A spell whose size depended on the moment could drift from its circle.
- **The bots are approximations of players:**
  - The reactive bot sees energy within 300 px with a 0.22 s delay.
  - The skilled bot also reads his gather glow and the drawn circles.
  - Real players use techniques, so they will deal more damage than the 160 E lance used here. If he proves too easy
    for strong players, `CONFIG.hp` is the dial.
- **No audio system in the game:** phase changes and big wind-ups use a small built-in WebAudio chime.
- **The sweep's grammar is narrow by design** (raw runes only, 404 candidates). A broader discovery system could
  later feed this library through the same policy and campaign.
