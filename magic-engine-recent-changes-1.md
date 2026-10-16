# Recent magic engine changes

These notes cover the latest edits in `magic-engine.js`: Draw Out scaling with zone size, the lower zone radius cap, and redirected natural energy keeping its course until it reaches its point.

## Zone radius cap is 1800px

`zoneRadiusLimit` still starts at 520px. After Energy Control rises past 6, the cap grows by 60px per point and now stops at **1800px** (previously 4800).

```
min(1800, 520 + max(0, control - 6) * 60)
```

Control 5 stays at 520px. Control 50 reaches 1800px. The Create Zone radius slider max, spell validation, and Compress/Expand on a zone all use that same 1800px ceiling. A radius above the caster's cap is rejected.

## Draw Out scales with the zone's area

A large zone was still pulling about as much energy as a medium one, so the mana looked like a small gathered patch inside a big circle.

The zone multiplier is now the area relative to a 180px zone:

```
zoneDrawMul = clamp((radius / 180) ^ 2, 0.12, 100)
```

Draw rate is `drawPerSec` (9.9 energy per second) times that multiplier, times the existing power multiplier when the source is energy or a spell. A draw with no zone still uses a multiplier of 1.

Checked with a 1.25s environment draw:

| Zone radius | Energy drawn | Separate blobs |
| --- | ---: | ---: |
| 180px | ~12 | 3 |
| 900px | ~308 | 16 |
| 1800px | ~1231 | 31 |

Each new blob's size is `drawPiece`: at least 4 energy, and 4 times `radius / 180` in a larger zone, so the extra mana is spread as more pieces instead of one lump. If the zone is already full of blobs, the leftover is split across the blobs already drawn. A zone can hold up to `min(220, max(90, round(28 * zoneDrawMul)))` blobs.

Zone blobs in a zone larger than 180px are drawn bigger by `sqrt(zoneRadius / 180)` so the gathered mana stays visible.

Drawn energy still does not count toward the spell's max output.

## Redirected energy keeps its course

Redirect marks the body `guided`. If the redirect has a point (cursor, target, or you), it also stores that point on `aim`. Slow to a stop still uses `arrive` to ease the body onto that point and halt there.

Natural energy from the same caster still drifts together and merges when the pieces are almost touching. That pull does not apply to energy that is currently being redirected.

While a body is `guided`, it combines with other natural energy only when all of these are true:

- Both bodies were redirected.
- Their aim points are within 16px of each other.
- Both are already within 28px of that point.

Until then they do not nudge each other and do not merge, so a heavier blob cannot pull redirected mana off its path or swallow it back in the zone. Once both have reached the point, they can meet from farther apart (about 40px) and combine there. That is the mass you compress into a shape such as a sword.

If a merge does happen and either body is guided, the survivor keeps that body's velocity and arrive goal instead of averaging the two velocities. A guided body is also not tugged by the weak natural drift. Split copies of a redirected body keep `guided`, `aim`, and `arrive`.

---

# Changes since these notes (techniques onward)

Everything below was added after the notes above, in order. Each section describes things as they were at that point — later sections may change earlier numbers. **The "Current state" section at the very end is the up-to-date summary.** Files: `magic-engine.js` (framework + runtime), `magic-techniques.js` (the six techniques, balance table `BAL`, dev tests), `magic-forge.js/.css` (Rune Forge), `melee-combat.js`, `player-rig.js`, `slot-chooser.js/.css`, `dungeon.html`, `inventory.html`.

Cache-busters at the time of this section: magic-engine v17, magic-techniques v9, magic-forge v10 (css v5), melee-combat v38, player-rig v3, slot-chooser js v2 / css v2, dungeon-vision v10 (see Current state for today's).

## Controls and quality of life

- **O** ends every spell you have running (`MAGIC_WORLD.clearOwner('player')`): energy, zones and reinforcements.
- **T** is the trigger key for the "Wait until you press the trigger key" condition (`window.__magicTriggers`). It works in the forge preview too.
- Zones expire after **60 s**, taking their untouched blobs with them.
- Generate no longer has an "At cursor" spawn. Old spells are converted to "At you" by `normalize()`.
- Rune Forge top bar, far right: **⟲ Reset**. It asks first, then replaces the tree with an empty slot (Ctrl+Z undoes it).
- Rune Forge deleting:
  - **Del** removes a rune and everything after it.
  - **Shift+Del** (or "✕ Delete rune only" in the inspector or right-click menu) removes just that rune.
    - The runes after it reconnect to the rune before it, in the same order.
    - A removed Delay / Wait until connector carries over onto children whose connector was Instant.
    - On the first rune, it only works when exactly one rune follows; that rune becomes the new start.

## Techniques (framework)

- A technique is a **property of energy**, registered with `MagicEngine.Techniques.register(def)`.
  - **Hooks:** `onApply`, `tick`, `field`, `onHit`, `onSurface`, `onForeign`, `onCancel`, `interact`, `draw`, `drawField`, `drawBody`, `reinforce`, `onReinforcedHit`, `drawReinforce`.
  - **Data:** `targets`, `balance`, `params`, `analyze`, `canApply`, `combines`.
- The engine runs techniques generically through the `T` interface. `T.merge(keep, drop)` combines two of the caster's energies.
- **One Technique rune, signed power −10…10.** Negative power is the reverse technique.
  - Opposite intensities cancel. Equal and opposite leaves neutral energy, which remains.
  - Old `reverseTechnique` nodes and `mode:'reverse'` convert to negative power.
- **Technique Points per technique.** Access follows `1 − e^(−0.55·points)`, and intensity = 2.2 × (power/10) × access, capped at 3.
- No cooldowns or mana per technique. Converting raw energy loses a little energy, depending on efficiency.
- Thermal and Kinetic have `combines: true`: their energy combines like raw energy (`techCombines(b)`).

## The six techniques

- **Thermal:**
  - Heat burns. The reverse chills and can freeze.
  - Loose thermal energy is drawn as a living **flame**, or a **snowflake** when reversed. Compressed into a shape, the shape is made of fire / ice.
- **Spatial:**
  - Positive power makes a **portal**. Anything in one end when it opens passes instantly; a portal opened on yourself teleports you. Lasts at most 15 s.
  - Negative power makes a **bounce surface**. It can't be put on an enemy.
  - Spatial energy cannot be moved.
- **Gravity** — see the Gravity section below.
- **Kinetic:** keeps accelerating and transfers force on hit. The reverse decelerates and drains momentum.
- **Light:** bounces up to `light_bounces` times (default 3), pierces and dazzles.
- **Binding:** holds, tethers and freezes in place.

## Reinforcement (not a technique)

- The `reinforce` rune pours energy into **yourself, an ally, your weapon or an active spell**.
- **How it adds up:**
  - Strength = `1 − e^(−energy × density × efficiency / 55)`.
  - Properties add up with a soft cap: `cap × (1 − e^(−total / cap))`, via `W.reinforcedValue(target, prop)`.
  - Techniques on the energy add their own properties through each technique's `reinforce` table.
- **Lifetime:** it counts toward Max Output and ends with the spell, the target's death, or O.
- **Spatial on a weapon:** every attack, specials included, comes out of a portal at your cursor.
  - You can see the weapon go through: the near half stays in your hand and the far half comes out of the exit portal (drawn by `player-rig.js` when given `o.portal`).
  - `MeleeMode.strikeBox(def)` moves special hit shapes (slam / spin / flurry) and their effects onto the exit too.

## Runes and shapes

- **Draw Out** hands each drawn piece to the following runes immediately (`api.forkChildren`), instead of waiting for the draw to finish.
- **Redirect** speeds above 9 cost 1.5% of the energy per unit over 9.
- New compressed shapes: **fist** and **hammer**.
- New **Rotate** rune:
  - **Continuous** spins at a set °/s until the spell ends. **Set angle** turns a number of degrees over a time (0 = instant) in a chosen direction.
  - It can turn the energy's facing (shape), its path (continuous = circling), or both.
- **A rune runs at most once on the same energy.** When merged pieces' branches reach the same body, only the first continues (`body._ranNodes`).

## "Wait until" conditions

- The connector mode formerly called Condition is labelled **Wait until**.
- **Bug fixed:** the forge's condition panel used an undefined variable, so any condition with settings broke the panel.
- There are now **33 conditions**. Highlights:
  - **combined**: waits until the pieces became one again (works with Divide and Draw Out).
  - **restFinished** ("the rest of the spell is finished"): waits until every other branch has run all its runes. Other "rest finished" waits don't block each other. Option: "…and its other energy is gone".
  - Spell hit, caster hurt / grounded / airborne / moving / still, cursor near, energy above / below, enemies near, zone full, spell age, trigger key, and more.

## Weapons

- **Engrave a spell into a weapon's special:**
  - In the inventory, click a weapon slot and choose ✎ Engrave. The Rune Forge opens on the weapon's engraving (stored as `slot.engraved`).
  - The spell casts every time the special (R) strikes, paying energy like a normal cast. Generate spawns its energy where the special hits (`castOpts.spawnAt`).
  - Re-picking the same weapon keeps the engraving; switching weapons drops it.
- **Gravity on a weapon:**
  - Normal → `heavyWeapon`: swings slower (frames × `1 + 0.7h`), hits harder (damage × `1 + 0.9h`).
  - Reverse → `lightWeapon`: swings faster (frames ÷ `1 + 0.7l`), hits softer (damage × `1 − 0.75l`).
  - Sword at power ±7: 24 → 30 frames and 34 → 56 damage when heavy; 24 → 18 frames and 34 → 28 damage when light.

## Gravity

- **Strength:** the pulls are **3.45× the original tuning** (+15%, then ×1.5, then ×2): `pullEnemy 1.898`, `pullEnergy 0.759`, `pullProjectile 0.552`, `linkPull 2.07`, `foreignWeight 0.621`.
- **Gravity energy** (gravity is its strongest technique):
  - does **no damage** and passes through creatures;
  - **rests on walls** instead of disappearing.
- **Bends other spells:** it pulls other energy and enemy projectiles. Redirected energy is bent directly, since it re-aims every frame.
- **Combining:** gravity energy touching your other gravity energy of the same sign combines into one.
- **Reverse:** a slight push far away that grows steeply up close (`0.2u + 1.7u³`). It pushes you too, unless you aimed it at yourself.
- **Reinforcing yourself:**
  - Normal → **high gravity** (`heavyGravity`; player gravity × `1 + 1.4h`).
  - Reverse → **low gravity** (`lowGravity`; × `1 − 0.75l`, slower max fall speed).

## Energy lasts longer

- Every energy leak (flying, idle, anchored, zone blobs) runs at `CONFIG.leakScale = 1 / 1.3`. Energy now takes **30% longer** to disappear.

## Dev tests

- Rune Forge → 🧪 Tests: 17 test spells, plus "Run engine checks" (16 headless checks, all passing).
- In node: `MagicEngine.devTests.run()`.

## Techniques don't stack any more

- Applying a **different** technique to energy that already has one **converts** it: the old technique is removed and only the newest remains (`convertTech`). Thermal → Gravity → Kinetic ends up as Kinetic energy only.
  - The forge warns about it, and the Technique rune shows "Converted to … energy".
  - Turning a portal / bounce surface into another technique makes it loose energy again.
- The **same** technique still adds to itself, and a technique and its reverse still cancel by magnitude.
- Only the same kind of energy combines (`techKey`: raw, or the same technique with the same sign). A thermal field no longer heats energy that carries a different technique.

## Spell Memory

- Energy remembers what happened to it (`b.mem`, counts):

  | Key | What happened |
  | --- | --- |
  | `portal` | passed through a portal |
  | `hitEnemy` | hit an enemy |
  | `hitSurface` | hit a surface (once per contact) |
  | `compressed` | was compressed |
  | `split` | was split or divided |
  | `reinforced` | was reinforced by other energy |
  | `redirected` | was redirected |

- Two derived values: `collided` = enemy + surface hits, and `merged` = how many times it combined.
- Memory is copied to split / divided pieces and kept as the maximum of each key when energy merges.
- **New condition** "Its energy remembers… (spell memory)": waits until an event has happened at least N times.
- **New rune** "Spell Memory" (its own category): continues only if the energy matches.
  - Tests: *at least N times*, *exactly N times*, or *never*.
  - Energy that doesn't match ends that branch quietly. With divided energy, only the matching pieces carry on.
  - Example: Compress 30 → Redirect → *Wait until it has hit an enemy 2×* → Spell Memory *never passed through a portal* → Discharge.
- F9 debug shows each energy's memory.
- Engine exports: `remember`, `memCount`, `MEM_EVENTS`, `T.remember`.

## Reinforcement: legs, arms, yourself

- Two new targets, picked with Target → **Your legs** / **Your arms** after a Reinforcement rune:
  - **Legs:** run faster and jump higher (`moveForce` 0.55, `jumpForce` 0.55).
  - **Arms:** your swings hit harder (`meleeDamage` 0.75). Arms also carry technique effects onto your melee hits, like reinforcing yourself.
  - Techniques on the energy act on legs / arms as they do on yourself (gravity → heavy / low gravity, …).
- **Yourself:** now mainly makes you take less damage (`damageResist` 0.45, knockback resist, stability). It still adds a little melee, running and jumping, but each of those has its own lower maximum (`kindCaps`: melee 25%, run 15%, jump 12%).
- `W.reinforcedValue` adds each kind up separately (soft-capped by its own maximum), then soft-caps the total. Global caps raised: `moveForce` 0.7, `jumpForce` 0.6.
- Measured with 60 energy:

  | Target | Run | Jump | Melee | Damage resist |
  | --- | ---: | ---: | ---: | ---: |
  | Yourself | +3% | +3% | +8% | 19% |
  | Legs | +23% | +22% | — | — |
  | Arms | — | — | +31% | — |

- Raw energy targeting: **Strongest (most power)** / **Weakest (least power)** are labelled as such for raw energy.

## Reinforcing magic with magic

Reinforcement → Target *raw energy* or *an active spell*, with energy of your own:

- **Same kind** (raw → raw, +Thermal → +Thermal …): the energy is simply added to it.
- **A technique into its reverse** (+Thermal → −Thermal): they cancel by amount. 10 positive with 8 negative leaves 2 positive. If the reinforcing side is bigger, the rest flips to its side. Equal amounts destroy both.
- **Any other combination:** the old reinforcement (stability / impact) as before.
- In every case the target remembers it was `reinforced`.
- Test: 48 hot energy + 19 hot = 67; + 86 cold → 19 cold remains.

## Over-compression (Compress up to 50)

- Compress power now runs −10…50. Past 10 the energy is **over-compressed** (`b.over` = power − 10, up to 40):
  - It shrinks further: minimum scale ÷ (1 + 3·o), where o = over / 40.
  - It keeps getting stronger (density): 30 energy at power 10 → power 69; at 50 → power 144 (before the Max Output clamp).
  - It **pierces** enemies: each hit costs only 15% − 10%·o of its energy, and damage is +35%·o.
  - It lasts much longer: leak × 0.6 / (1 + 3·o). Over 4 s, 25% lost at power 10 vs 4% at 50.
  - It glows brighter until it is white-hot at 50, with its own colour only at the rim (`drawOverGlow`, `bodyColors`).
  - It costs far more: rune cost 5 + (power − 10)^1.4 × 0.6 (≈110 at 50), plus a little extra conversion loss.
- Expanding (negative power) clears over-compression.
- **Gravity energy cannot be compressed.** The forge and the rune refuse it, and turning compressed energy into gravity springs it back to normal size.

## Dev tests

- 20 headless checks now (all passing). New ones cover: technique conversion, legs vs. yourself caps, add / cancel reinforcement, compression 50, gravity compression refused.

Cache-busters: magic-engine v18, magic-techniques v10, magic-forge v11.

## Compression cost, speeds, gravity on you, recoil

- **Compression 20–50 costs less upfront.** The Compress rune now costs `5 + (power − 10) × 0.9` past 10 (20 → 14, 50 → 41; it was ≈110 at 50). A compression-50 spell could cost more than your maximum reserve, which blocks casting ("Costs … more than your maximum reserve").
- **Speed ranges** (`speedRange(b)`), enforced by Redirect and every frame:

  | Energy | Speed range |
  | --- | --- |
  | Raw | 0–9 (`CONFIG.rawMaxSpeed`) |
  | Kinetic | 8–15 |
  | Light | 12–18 (never slower than 12 while it travels) |

  Kinetic reinforcement adds `b.speedBonus` on top. The old "speeds above 9 cost energy" loss is gone; the ranges replace it.
- **Gravity pulls you too.** Reverse gravity pushes you. The Technique rune has a Gravity option, **"Affects you too"**: *No — never you* switches both off (`b.gravNoYou`).
- **Spell recoil:** Redirecting energy with power above 60 (`CONFIG.recoilFrom`) from within 180 px of you knocks you back. The push is `(power − 60) × 0.045 × (0.5 + speed/18)`, capped at 18, through the host's `knockback`.

## Reinforcing energy with a different kind of energy (`oddReinforce`)

| Reinforcing energy | What happens to the target energy |
| --- | --- |
| **+Kinetic** | +0.1 speed per point of energy, instantly, past any maximum (`speedBonus`) |
| −Kinetic | slows it (−2% per point) |
| **Light** | adds its energy to the target, whatever kind it is |
| +Thermal / −Thermal | its hits burn / chill (`burnOnHit` / `chillOnHit`) |
| +Gravity | weighed down: it arcs downward and hits harder (`heavy`) |
| −Gravity | it floats upward (`lift`) |
| Binding | held still for energy × 0.05 s (max 6), then carries on |
| +Spatial | the target jumps to where the reinforcing energy is |

Raw energy into technique energy still uses ordinary reinforcement. Same kind adds; a technique and its reverse cancel (unchanged).

## Passive spells

- Forge top bar: **∞ Passive** (`def.passive`).
- Casting a passive spell switches it **on**; casting it again switches it **off**. O also stops all passives.
- While on, it drains energy constantly: `cost × 1.3 / cycle` per second.
  - The cycle is 4 s for spells that keep running (reinforcement).
  - For spells that finish, the cycle is how often it re-casts itself (min 1 s, max 8 s).
  - This is 30% more than casting it yourself as often. It stops when you run out.
- The instance runs with `passive: true`: it has no lifetime limit, and its **reinforcement holds steady** (no upkeep decay) instead of fading.
- Hotbar shows "∞ … · passive" and "ON".

## Reinforcement that costs energy while used

- **Legs:** moving or in the air costs `(4 + 12 × strength)` energy/s.
- **Arms:** each attack costs `3 + 12 × strength`.
- **Weapon reinforcement:** each swing costs `3 + 12 × strength`.
- With not enough energy, the reinforcement itself burns down instead.

## Magical items

- New slot type **Magical item** in the slot chooser (`weaponId: 'magic'`). It does nothing while empty.
- **Fill it** with Redirect → **"Into your inventory (magical item)"**:
  - The energy must be compressed **20+** (`b.over ≥ 10`) and shaped as a **fist, sword, spear or hammer**.
  - The energy flies back to you and becomes the item in that slot (`slot.item = { shape, amount, over, scale, tech }`).
  - The active magical slot is preferred, then one holding the same shape, then an empty one.
  - More energy of the **same shape** feeds it. A different shape is refused. A different technique converts it (newest technique wins).
- **As a weapon**, it uses the base moveset of its shape (fist → gauntlets) with **no special**.
  - Range follows the item's size: `0.55 + R / 22` (0.6–2.4).
  - Damage × `1.25 + power / 100` (up to 4.5).
  - Example: a 34-energy thermal sword at compression 25 hit for 165 and burned.
- **Energy effects:** the item automatically carries the reinforcement effects of its technique, through a permanent item reinforcement (`W.addItemReinforcement`). It is drawn as a glowing energy blade.
- **Upkeep:** every item in a slot draws `2 + 0.05 × energy + 0.05 × over-compression` energy/s. Without energy it decays 4%/s and falls apart below 5.
- Items are saved with the slot. Re-picking Magical item in the chooser keeps what it holds.

Cache-busters: magic-engine v19, magic-techniques v11, magic-forge v12, slot-chooser js v3 / css v3.

## Turned projectiles

- **Your gravity / portals on enemy projectiles:**
  - When your gravity bends an enemy projectile enough (accumulated pull ≥ 1.2, `T.turnForeign`), the projectile is **turned** (`_magicTurned`). The same happens when it passes through your portal, or when gravity is applied to it directly.
  - From then on it can also hit enemies, once per enemy, for its own power (`magicDamageEnemy`). It still can hit you as well.
  - Test: a 30-power shot fired over a dummy was pulled down by a gravity well and hit the dummy for 42.
- **An enemy's gravity on your energy:**
  - Enemy vortex attacks (`shape: 'vortex'`, or any enemy projectile with `gravityPull`) now pull your energy toward them.
  - Your energy they take hold of becomes **hostile** (`W.turnHostile`). That only happens after it has left you: age > 0.3 s and more than 60 px away.
  - Hostile energy can hit **you** (`host.hurtCaster`) as well as enemies.
  - The game has no enemy portals yet; `W.turnHostile(body)` is the hook for them.

## Over-compression looks

- **Much smaller:** over-compressed energy pulls in much tighter: radius × `1 / (1 + 2.5·o²)` (`overShrink`). At 50 it is under a third of its size (30 energy: 15.5 → 6 at compression 30 → 2.2 at 50). Power is unchanged by this; only size and contact size shrink.
- **Masked glow:** the glow is now masked to the energy's own outline — a sword glows as a sword. It has a thin rim of light instead of a large halo.
- **Not as bright:** the generic outer glow fades with over-compression, and the white-out is gentler (mid colour 60% toward white at 50 instead of 90%).

Cache-busters: magic-engine v20, magic-techniques v12.

## Magical items look like the compressed energy

- **In your hand:** a magical item is drawn as the energy it was compressed from — the same shape, colours, technique look (fire, ice …) and over-compression glow as the loose energy (`drawItemInHand` → `drawBody` on an item body).
  - No physical weapon sprite and no reinforcement glow are drawn any more. The rig still positions an invisible weapon for the swing (player-rig `o.hideWeapon`); fists use your bare hand.
  - It is drawn at its **own size**: the radius the energy would have as that shape, over-compression shrink included, minimum 7 px so it can be held. You hold it by its back end.
- **Reach follows that size:** range × `0.35 + length / 45` (0.5–2.4), where length is the shape's grip-to-tip length. The rig's swing length uses the same multiplier (`weaponReachPx × reach`).
- **Icons:** the hotbar, inventory row and slot chooser now show the item as its energy shape (`MagicEngine.drawItemIcon`).
- **Fix:** the Spear shape is called `lance` inside the engine, so spear energy was never accepted as an item before. It is now; items store it as `spear`.

Cache-busters: magic-engine v21, player-rig v4, melee-combat v39, slot-chooser js v4.

## Fix: "must be compressed to 20" warning on compression 20+ spells

- The spell checker's Compress step didn't record over-compression or the chosen shape. Every Redirect "Into your inventory" was therefore flagged with *"It must be compressed to 20 or more…"*, even at 50.
- It now tracks both (`b.over`, `b.shape` in the analyzer), so a compression 20+ fist / sword / spear / hammer shows no warning.
- The game itself already accepted these. Tested in a dungeon: compression 50 → *Magical sword forged*.
- If the energy is refused when it reaches you, the reason is now shown on screen (host `say`), not only in the spell log. Possible reasons:
  - wrong shape for your existing item;
  - no Magical item slot;
  - not compressed enough.

Cache-busters: magic-engine v22.

## Magical items: per run, true reach, more damage, R specials

- **Only for the run.**
  - Items are stripped when the page loads (`sanitizeSlots(…, { dropItems: true })` in dungeon and inventory) and broken on death (`respawnPlayer` wrapper). They are no longer written to storage.
  - Editing your slots in the inventory mid-run keeps the items in the same magical slots.
- **Reach = size.** Every swing's hitbox is rebuilt from the item: it reaches the hand (~22 px) plus the item's own length (`hitbox.w = length`, centre at hand + length/2). The rig's swing length follows. Before, the base weapon's reach was only scaled, so it hit far beyond the drawn item.
- **More damage for high compression.** Damage × `(1.25 + power/80) × (1 + 1.6·o)` (o = over-compression 0–1), up to ×10. In testing, a compression-40 item hit ≈ 2.4× harder than a compression-20 one with the same energy.
- **R special.** Every magical item now has an R special (`noHit` swing; the item does the hitting):

  | Item energy | R special |
  | --- | --- |
  | Default (raw, gravity, spatial, binding …) | **Throw**: the item flies out (240 + 5×length px, max 560), stops early at walls, then flies back to your hand. It hits each enemy once going out and once coming back, with its technique's weapon effects. It is gone from your hand while out, and swings do nothing until it returns. |
  | **Kinetic** | Same throw, twice as fast (26 vs 13), +35% damage. |
  | **Thermal** | Leaves a trail behind the throw for 2.6 s: flames that burn and damage, or ice that chills for reverse Thermal. |
  | **Light** | A **beam** instead of a throw: a line along your aim (380 + 5×length px, stops at walls). It strikes and dazzles everything on it; the item stays in your hand. |

Cache-busters: magic-engine v23, melee-combat v40.

## Magical items: exact reach, beams, trails, costs

- **Reach fixed at every size.**
  - What was wrong: a leftover reach multiplier was still being applied on top of the rebuilt hitboxes, so large items (10k energy) hit about twice as far as they were drawn.
  - Hitboxes now reach exactly from your hand (`ITEM_HAND` 12 px, measured mid-swing) to the drawn tip: `itemStats.reach = (front + 0.8·back) × R`.
  - Measured mid-swing, hitbox vs. drawn tip from your centre:

    | Item energy | Hitbox | Drawn tip |
    | --- | ---: | ---: |
    | 20 | 37 | 37 |
    | 200 | 52 | 52 |
    | 2000 | 120 | 120 |
    | 10000 | 243 | 243 |

  - The weapon is rebuilt whenever its size changes.
- **Light R special is a held beam.**
  - It costs **4% of your max energy once**, then **charges for 0.6 s**: energy gathers at your hand.
  - It then fires a **steady beam** that follows your aim for as long as you hold R (max ≈4 s). The beam hits everything on its line every 0.15 s and stops at walls.
  - Beam **width follows the energy in the weapon** (`5 + √energy × 1.1`, 6–140 px).
  - **Reverse Light** fires a beam of **darkness**: a black core with crackling violet edges, which obscures (slows) what it hits instead of dazzling it.
  - Fix: the old beam sometimes failed and only the swing slash showed. The dazzle status was being applied with a missing argument, which threw an error.
- **No slash on R.** Throws and beams no longer show the swing slash or its trail (`def.noHit` attacks skip `rememberTip` heat and `paintSpecialFx`).
- **Trails:**
  - Thermal throws leave proper **flames**: flickering tongues of fire with rising embers.
  - Reverse Thermal leaves turning six-armed **snowflakes** in a frost mist.
  - Burn and ice from the trail are **60% weaker** (burn 0.008 × power, damage 0.016 × power per tick, chill 0.24 for 0.6 s).
- **Costs:**
  - Every swing of a magical item: **3 energy**. Arms or weapon reinforcement per attack: **3 energy** (was 3 + 12 × strength).
  - Throw R special: **30 energy**. Light / dark beam: **4% of max energy**, once.
  - Item upkeep now grows with √energy: `2 + 0.3·√energy + 0.05·over` per second (10k energy ≈ 34/s instead of ≈500/s).

Cache-busters: magic-engine v25, melee-combat v41.



## Binding removed, Spell Anchoring, new shapes, stronger items

- **Binding technique removed.** Five techniques remain: Thermal, Spatial, Gravity, Kinetic, Light.
  - Points spent on Binding come back.
  - Old spells convert: a Binding Technique rune becomes an Anchor / State rune set to **Bound**, or **Free** if it was reverse Binding.
  - Test spell 7 is now *Anchored restraint*.
- **Spell Anchoring:** the Anchor rune is now **Anchor / State**, giving energy a physical state:

  | State | What it does |
  | --- | --- |
  | **Anchored** | Held at a location — where it is, or the target's position. |
  | **Free** | Released: no anchor, attachment, guidance or tether. |
  | **Attached** | Rides along on the target (keep offset / snap to centre). |
  | **Guided** | Keeps steering after the target or point every frame (unlike Redirect, which turns once). |
  | **Bound** | A magical tether to the target, with a set length (10–600 px). If the target moves farther, it is dragged back and slowed. Drawn as a shimmering cord; uses 0.35 energy/s. |

  - **States combine.** For example, Bound + Anchored is a restraint fixed in place.
  - **Lodging:** energy whose branch is *waiting for a hit* (Wait until *the spell hits*, *target hurt*, *spell memory* or *energy state*) no longer bursts on that hit. It **lodges** in what it struck, so the next runes can act on it.
  - Example (test spell 7): Target enemy → Generate → Redirect at it → *Wait until the spell hits* → Bound 50 px → Anchored. The bolt lodges in the enemy, tethers to it and anchors. When the enemy tried to walk away 360 px it stayed about 55 px from the anchor, slowed.
  - **New condition** *Energy is in a state* (anchored / free / attached / guided / bound).
  - **New Spell Memory events:** *Was bound*, *Lodged in what it hit*.
  - F9 debug shows each energy's state.
  - Redirect and Attach clear Guided.
- **New compression shapes:** Point, Line, Arc, Cone, Wall, Tether, Spiral. (Ring, Sphere and Wave already existed.)
- **Magical items keep getting stronger.** Damage is now × `(1 + 0.9·√(power/20)) × (1 + 1.6·over-compression)` with no cap. The old cap of ×10 was reached right after the first absorb, so feeding more energy did nothing.
  - Sword at compression 30: 40 energy ×6.9 · 400 ×17.9 · 4000 ×52.7 · 10000 ×82.
- **Generate** makes up to **500** energy (was 200).
- **Spatial portals** no longer lose energy or duration when they carry creatures, energy or projectiles through.

Cache-busters: magic-engine v31, magic-techniques v18.

---

## Mana zone draw nerf and spell-only raw-energy targeting (engine v27, techniques v14)

- **Draw Out from a mana zone:** the zone-size multiplier is now `1.5 × (radius / 180)^1.6`, kept between 0.2× and 60×. Before, it was `(radius / 180)²`, kept between 0.12× and 100×.
  - The biggest zones draw 40% less: 60× instead of 100× at 1800 px.
  - Small zones are more effective, so large and small zones are closer together:

    | Zone radius | Before | Now |
    | --- | --- | --- |
    | 90 px | 0.25× | ≈0.5× |
    | 180 px | 1× | 1.5× |
    | 900 px | 25× | ≈19.7× |
    | 1800 px | 100× | 60× |

  - The cap on blobs a zone can hold uses the same multiplier.
- **Target → Raw energy (this spell):** a raw-energy target now only picks energy that belongs to the spell you are casting. This includes energy it spawned and energy it drew into its zone. Energy from your other spells is ignored. If nothing qualifies, the rune fails with *"No raw energy from this spell in range"*.
- **New engine check:** *"Raw-energy target only reaches energy from the spell being cast"*. The *"Same energy adds"* check now reinforces energy from the same spell.

## Zones dissipate, anchor-state targeting, stronger tethers (engine v28, techniques v15)

- **Zones dissipate when the spell is finished.** Once a spell has no runes left to run, no conditions waiting and nothing drawing into its zone, the zone fades out after half a second. The untouched energy inside goes with it, and the forge debug log notes it. Energy that already left the zone is not affected.
- **Raw energy target reverted.** Target → Raw energy can again pick any raw energy of yours, not only energy from the spell being cast.
- **New target: "Energy in an anchor state".** Pick it under Target, then choose the state: Anchored, Free, Attached / lodged, Guided or Bound. It finds **your own** energy in that state and uses the same selections as raw energy: nearest, strongest, weakest, in zone, all, and radius around you. If none is found, the rune fails with "None of your energy is … in range".
- **Bound (Anchor / State rune) — new options:**
  - **Bind to:**
    - **Current target** — as before.
    - **You.**
    - **Nearest other energy of yours** — the two energies are drawn together, and the larger one moves less.
  - **Bound to you:**
    - **Energy follows you** — it trails after you on its tether, and you are not slowed.
    - **Energy pulls you** — it reels you toward it, like a grapple, and helps hold you up when the pull is upward.
  - **Bond strength (1–10, default 5):** a stronger bond drags harder, slows creatures more and is harder to snap. It costs `1 + 0.3 × strength` to cast and `0.07 × strength` energy per second to hold. The cord is drawn thicker when it is stronger.
  - A tether can also hold another caster's projectile on a leash.
- **Tethers can be snapped.**
  - Energy that crosses the cord hits it with `power × (0.4 + speed / 8)`. This includes your own energy and enemy magic.
  - If that is more than the bond's hold, `(8 + 9 × strength) × (1 + √energy / 12)`, the tether snaps.
  - Example: a 60 E bolt snaps a strength-1 tether, while a strength-10 tether holds.
  - New Spell Memory event: *Its tether was snapped*.
- **Kinetic bonds.** If the bound energy carries Kinetic, its cord is gold, and enemy magic that hits it is caught.
  - The cord stretches around the projectile like a rubber band for about 0.2 s, then flings it back.
  - The projectile goes out at 1.25–1.75× its speed and is turned, so it hurts enemies.
  - A kinetic cord holds up to 3× its normal strength against enemy magic before it snaps.
  - New Spell Memory event: *Its kinetic tether flung back enemy magic*.
- **Recoil checked — it works.**
  - Redirecting energy with more than 60 power from within 180 px of you knocks you back, opposite to the throw.
  - Example: a 300 E raw bolt pushes you about 300 px.
  - Energy sent into your inventory doesn't recoil.
- **New engine checks:** anchor-state targeting, energy-to-energy bonds and zone dissipation. The raw-energy test from the last batch was removed with the revert. Total: 22 checks, all passing.

## Compression minimums, unstable over-compression, % redirect speed, recoil rework (engine v29, techniques v16)

- **Each compression level needs a minimum of energy.** Below the minimum, the energy ceases to exist: it collapses with a small white flash. The minimum is `2 + 0.5·c + 0.04·c²` energy:

  | Compression | Minimum energy |
  | --- | --- |
  | 5 | 6 |
  | 10 | 11 |
  | 20 | 28 |
  | 30 | 53 |
  | 50 | 127 |

  - It's checked right after compressing (after the compression's own loss) and every frame while the energy leaks.
  - Splitting compressed energy keeps its compression level, so small pieces can collapse.
  - The forge warns when the expected energy is too low, and the Compress rune shows the minimum.
  - Expanding (negative power) resets the level.
  - Magical items in your inventory are not affected.
- **Highly compressed energy resists gravity.** Gravity pulls it with ×`1 / (1 + (c − 5)/12)`: ×0.7 at 10, ×0.44 at 20, ×0.21 at 50. This applies to your own gravity energy and to enemy vortexes.
- **Over-compressed energy (past 10) is a little unstable** until it is safely in your inventory:
  - it trembles and throws sparks;
  - it loses a tiny bit of extra energy.
- **Redirecting it can make it explode.**
  - The chance is `0.5 × ((c − 10)/40)^1.4 / (1 + 0.12 × Energy Control)`, capped at 60%. It goes up with compression and down with Energy Control.
  - Examples: compression 50 is ~31% at control 5 and ~15% at control 20; compression 20 at control 10 is ~3%.
  - The explosion hurts enemies and you within `50 + 9·√power` px and knocks everyone back.
  - Redirect → *Into your inventory* is always safe.
- **Redirect speed is now a percentage** (0–100%, default 100%) of the energy's top speed:
  - raw: 9;
  - Kinetic: 15, never under 8;
  - plus any Kinetic reinforcement bonus.
  - **Light always travels at 18**, whatever the percentage.
  - 0% keeps its current speed.
  - Old spells convert automatically: the old speed ÷ 9 becomes the percentage, so a speed of 9 becomes 100%.
- **Recoil is lighter.** It is about 25% weaker, with a 14 cap instead of 18.
  - It only happens for energy that was **generated near you** (within 80 px) and is launched from within 180 px. Energy generated at a target or elsewhere never recoils.
  - **Kinetic in your legs** reduces it: Reinforce legs with Kinetic energy, for up to ~55% less.
  - **Anchoring yourself** reduces it more: Anchor / State → Anchored → *Anchor yourself (resist recoil)*. The energy roots at your feet and removes 55–90% of recoil while it lasts.
  - Together they cancel up to 95% of recoil.
- **Bound fix — pieces tie to each other.**
  - When each piece is its own target (for example after *Target → Energy … · All*), Bound now ties every piece to the next one in the group, forming a ring. Before, it failed with "Nothing to bind to".
  - A single piece ties to your nearest other energy.
  - Target *Energy in an anchor state → Bound* now explains that nothing has been bound yet when it finds nothing.
- **New engine checks:** too little energy collapses; compressed energy resists gravity; explosion odds fall with control. The compression-50 test now uses enough energy. Total: 24 checks, all passing.

## "Inside this spell" targeting, light pierces everything, technique carry-over and removal (engine v30, techniques v17)

- **New selection, "All energy inside this spell":** on Target → *Raw energy*, *Energy in an anchor state* and *Active spell / projectile*. It selects every piece of energy the casting spell has made, as one group, and ignores your other spells.
  - There's no range limit.
  - It combines with an anchor state: for example, only this spell's anchored energy.
- **Light pierces everything.** Light energy now passes straight through enemies and surfaces, with infinite pierce and no energy lost per hit. Each enemy can be hit again after 0.45 s. The old "Max bounces" option is gone.
- **Divided energy keeps its technique — fix for "Sword and Lance".**
  - Divide always copied the technique. But in that spell, the 500 E is a *new* Generate, which used to come out as plain raw energy.
  - Generate → *At current energy* now has a **Technique** option: *Take on that energy's technique* (default) or *Raw*. The new energy grows out of the light energy as light, so all 10 divided pieces are light.
- **Technique rune → Action: "Remove its technique (back to raw energy)".** It strips any technique off the targeted energy and costs 1. Spatial portal / surface forms end and become normal energy again.
- **New engine checks:** Generate-at-energy + Divide keep the technique; Remove; "inside this spell" targeting; light pierce. Total: 27 checks, all passing.

## Anti-Magic (new technique) and Infinity (new energy state) (engine v31, techniques v18)

Both are built into the existing rules, not as named attacks. Every combination comes from the same generic interactions, so a "Hollow Purple"-style result is something you build, not a button.

### Anti-Magic — Technique rune → Anti-Magic (−10…+10)

- **Basics:**
  - A normal technique: it needs Technique Points; a different technique converts it.
  - Same-sign Anti-Magic adds; opposite signs cancel by magnitude.
  - **It does not mainly deal damage.** It consumes magic.
- **Vs energy:** energy is conserved by magnitude.

  | Meeting | Result |
  | --- | --- |
  | Anti 30 + raw 50 | raw 20 |
  | Anti 60 + raw 50 | Anti 10 |

  - How much happens depends on Anti-Magic power, energy, contact time and the target's resistance.
  - **Resistance per technique** (`antiResist`):

    | Technique | Resistance |
    | --- | --- |
    | Light | 0.9 |
    | Thermal, Kinetic | 1.0 |
    | Gravity | 1.25 |
    | Spatial | 2.2 (×1.6 more for an active portal / surface) |

  - Infinity adds resistance (+45% per level), and so does over-compression.
- **Vs techniques:**
  - the technique is suppressed faster than the energy (×1.6);
  - Kinetic loses force and speed;
  - Gravity's field weakens;
  - Light is absorbed;
  - a portal resists strongly, but its remaining time is cut and enough Anti-Magic destroys it.
- **Vs reinforcement:**
  - while Anti-Magic touches it, reinforcement is suppressed (its effects drop to 30%) and part of its energy is consumed;
  - when the Anti-Magic leaves, the rest works again;
  - your own reinforcement is only attacked by Anti-Magic that has turned on you.
- **Vs zones:**
  - suppression builds up gradually: Draw Out weakens, blobs drain, fields fade, the zone flickers;
  - at 100% the zone collapses, leaving a temporary dead area;
  - Anti-Magic *applied to a zone* makes the whole zone a dead area.
- **Vs projectiles** (enemy magic uses the same rules):
  - weakened, slowed and stripped of their effects (inert), or destroyed outright;
  - a strong projectile overpowers weak Anti-Magic.
- **Vs creatures:**
  - it does modest damage to non-magical enemies (×0.55) and a little more to magical ones;
  - it clears magical statuses (burn, chill, slowed, dazzle…) and applies *suppressed*.
- **Your own magic:** it works on your spells too.
  - Generate → Thermal → Anti-Magic converts the energy.
  - An Anti-Magic spell → Reinforce → your Thermal spell suppresses that spell.
- **Reverse Anti-Magic (negative power) = restoration / stabilisation.** It never creates energy and never revives anything; it spends its own energy 1:1. It can:
  - give weakened energy back up to its peak;
  - return suppressed technique strength;
  - lower a zone's suppression;
  - extend portals;
  - help Infinity recover;
  - steady over-compression (its explosion chance is ×0.25 while steadied).
- **Reinforcing with Anti-Magic:** yourself / legs / arms gain an aura that eats incoming projectiles and hostile magic, paid for by the reinforcement.
- **Anti-Magic magical items** look like a dark, light-swallowing version of the shape.
  - Hits suppress magic on what they strike.
  - **While swung or thrown, any spell or projectile under 10% of the item's energy is erased on contact**; bigger ones are worn down. Your own spells are left alone unless they have turned on you.
- **New Spell Memory events:** *Touched Anti-Magic*, *Lost energy to Anti-Magic*, *Had its technique / structure disrupted by Anti-Magic*, *Was restored / stabilised*.

### Infinity — Energy State rune (Anchor / State) → State: Infinity, level 1–5 (or Dissolve)

- **It is a state of space, not a technique.** The energy keeps whatever technique it has, so Infinity + Thermal / Gravity / Kinetic / Light / Spatial all work.
- **Cost per level:**

  | Level | Name | Energy Control | Energy needed | Rune cost |
  | --- | --- | --- | --- | --- |
  | 1 | Weak | 3 | 12 | 12 |
  | 2 | Stable | 7 | 48 | 30 |
  | 3 | Strong | 11 | 108 | 60 |
  | 4 | Extreme | 15 | 192 | 102 |
  | 5 | Maximum | 19 | 300 | 156 |

  - Upkeep is `(0.6 + 0.02·energy) × level^1.5` E/s.
  - It counts ×(1 + 0.25·level) toward Max Output.
  - You can hold at most 6 Infinity structures at once.
  - Too little Control → it forms at the level you can hold.
- **The field:**
  - Anything approaching an Infinity body — energy, projectiles, enemies, other players — slows ever more and never quite arrives.
  - It uses a bounded falloff (no infinite loops). Sideways motion is kept, so things slide around it.
  - Higher levels mean a stronger, wider field.
  - Your own Infinity never holds *you* back.
- **Stability:** `energy × efficiency / (need × difficulty)`.
  - Difficulty grows with compression past 10, with Gravity, with Spatial (×1.8) and with Anti-Magic (×2.5).
  - Low stability makes the level sink.
  - Starved, it collapses.
  - Pushed far past its limit, it collapses violently: space snaps back, throwing things out and hurting what's close, you included.
  - Heavy kinetic impacts on the field strain it. Carrying Infinity through a portal strains it hard.
- **Anti-Magic vs Infinity:** Anti-Magic cuts through the field and lowers the level; weak Anti-Magic weakens it, strong Anti-Magic suppresses it completely.
- **Combinations:**

  | Combination | Effect |
  | --- | --- |
  | + Thermal + Compress + Line | A held-together beam: leaks 40% less per level, loses less per hit, can't be undone by walls (level 2+ stops at a wall as a barrier) |
  | + Kinetic | Acceleration is stored while in Infinity (+1.2 top speed per level); when the Infinity ends, all of it is released at once |
  | + Gravity | Gravity **can be compressed while held by Infinity**. Its well gets ×(1 + 0.35·level) stronger and wider. With Rotate, things caught in the field are swept around it (an orbital trap) |
  | + Light | Light caught in a field is held back; Light-Infinity shows several apparent paths |
  | + Spatial | Portal ends are separated ×(1 + 0.3·level) farther |

- **Recursion protection:** anything passing portals more than 6 times in a second is stopped.
  - Energy: its branch ends (logged as *Spatial recursion detected*).
  - Creatures and projectiles: blocked for 1.5 s.
- **States combine:**
  - Anchored + Infinity is a fixed barrier.
  - Attached to you, it is a shield that follows you.
  - Guided, it is a moving distortion.
  - Bound + Infinity is a tether whose energy also holds space apart.
- **Reinforcement with Infinity energy:**

  | Target | Effect | Upkeep |
  | --- | --- | --- |
  | Yourself / ally | Infinity layer around the body; enemies and projectiles can't close in, but you move slower (×1/(1 + 0.12·level)) | Huge |
  | Arms / weapon | Up to +8% reach per level | Huge |
  | Legs | A little movement | Huge |
  | A spell | That energy becomes Infinity | — |

- **Magical items:** reach ×(1 + 0.07·level), never past the 260 px hard limit, plus extra upkeep.
- **Emergent spatial rupture** (no hard-coded spell).
  - It forms when two Infinity bodies with **opposite spatial behaviour** collide head on. That means Gravity + against Gravity −, or a portal against a surface.
  - Both must have Infinity 3+, compression 20+, and 220+ energy together.
  - Opposing Infinity folds space *toward* each other instead of apart.
  - Without enough level, density or energy, the two only tear at each other.
  - When the conditions are met, space tears and the two become a rupture:
    - it erases any magic it touches (energy, projectiles, zones, reinforcement);
    - it drags gravity and projectiles in;
    - it wrecks enemies, and it hurts you if you touch it;
    - the caster is thrown back hard;
    - it is hard to steer (max speed 7; Redirect only partly turns it);
    - it burns out within a few seconds.
- **New Spell Memory events:** *Was converted into Infinity*, *Entered / Left an Infinity field*, *Its Infinity held something back*, *Its Infinity collapsed*, *Opposing Infinity combined*. Condition *Energy is in a state* and *Target → Energy in an anchor state* both include Infinity.

### Forge

- The Anchor rune is now **Energy State (Anchor / Infinity)**, and its category is *Energy State*. Techniques: Thermal, Spatial, Gravity, Kinetic, Light, Anti-Magic.
- **Analyzer warnings:**
  - Infinity upkeep;
  - Control requirement;
  - energy needed;
  - Infinity + high compression, Spatial, Gravity or Anti-Magic;
  - "This spell may exceed practical energy requirements".
- Warnings never block a spell.

### Tests

63 engine checks, all passing (36 new). I also built these spells in the sandbox and checked their behaviour:

| Spell | Result |
| --- | --- |
| Precision thermal beam | 1244 damage across the dummies |
| Spatial gravity weapon | Dragged a dummy |
| Anti-Magic projectile | Ate an incoming burning projectile |
| Infinity defence | Three projectiles stalled ~90–115 px away; 0 damage taken |
| Opposing gravity / Infinity / compression pair | Tore space into a 544 E rupture |
| Anti-Magic sword swing | Erased a 40 E enemy spell |

## Tethers touch things, Infinity level fix, your Infinity affects you (engine v32, techniques v19, forge v13)

- **Tethers come into contact with things.**
  - **Ordinary cord:** it is part of its energy. An enemy touching the cord is struck, at most every 0.5 s, for 35% of a direct hit, with the energy's technique effects (for example a Thermal cord burns). Each strike costs the energy 2%. Fast or strong energy can still snap it.
  - **Kinetic cord:** it is solid to *everything*.
    - Energy, yours included, bounces off it like a rubber band, at 1.15–1.45× its speed.
    - Enemy projectiles are caught and flung back, as before.
    - Creatures, you included, are pushed out and knocked back off it. Enemies also take a small hit.
    - The cord flexes where it is struck.
    - Only something more than 3× stronger than the cord's hold snaps it.
- **Infinity level fix.** The level dropdown kept snapping back to "1 · Weak". There were two causes:
  - the dropdown handed back text ("3") that the checker didn't recognise;
  - the Forge then showed the first option.

  Both are fixed: the level stays where you set it, and old spells convert automatically. The card now reads, for example, "Infinity 4 · Extreme".
  - **If it still forms lower, that's Energy Control:** Infinity 2 needs Control 7, 3 needs 11, 4 needs 15 and 5 needs 19. Below that, it forms at the highest level your Control allows; the Forge shows this as a warning.
  - Generic fix: every Forge dropdown now keeps its option's own type.
- **Your own Infinity affects you too.** You can't walk into your own Infinity field: you approach ever more slowly and are held back, like anything else.
  - Infinity that rides on you is the exception. That covers Infinity attached to you and an Infinity reinforcement layer: it moves with you and never pushes you.
  - Things that are already inside a field when it forms are not thrown out; only what comes from outside is kept out.
- **New engine checks:** tether contact / kinetic bounce (you included); your own Infinity holds you back; a level picked as text works. Total: 65 checks, all passing.

## Infinity reworked into a reservoir technique, test points, kinetic bounces, several tethers, movable Spatial (engine v33, techniques v20, forge v14)

### Infinity — now a technique that turns energy into an Infinity source (replaces the old Infinity state)

The old Infinity energy state is gone: no levels, no upkeep fields, and no automatic distance field. Old spells that used it are converted to the Infinity technique.

- **How to make one:**
  - Technique rune → **Infinity**.
  - It works on energy of **at least 450 E** at **Compression 20 or more**. Both are required.
  - If either is missing the rune fails cleanly: nothing is converted and nothing is used up. The Forge warns beforehand.
  - **Generate now makes up to 1000 E**, so one Generate can feed it. Compression loses some energy, so generate a bit more than 450. Max Output still applies.
  - **Gravity:** gravity can't be compressed, so compress first and then apply Gravity. The compression level is kept. A Gravity Infinity source can also be compressed further.
- **It keeps its own kind:**
  - Raw → Infinity Raw; Thermal → Infinity Thermal; Spatial, Gravity, Kinetic, Light and Anti-Magic work the same way.
  - The source is still a physical body, looks like its own energy, and carries an ∞ mark and inward-falling rings.
  - It never leaks and never runs dry. Walls stop it rather than destroy it. It doesn't strike what it touches: it's a reservoir, not an attack.
  - It can be moved, anchored, attached and so on like any energy.
- **Draw Out from it:**
  - Use **Draw Out** right after making the source, or **Target → Energy in an anchor state → Infinity source** and then Draw Out.
  - New parameter **Amount from an Infinity source**: the amount pulled over the duration.
  - The energy forms at the edge of the source and visibly streams out of it, as **the source's own kind** (Infinity Thermal gives Thermal).
  - From there it is normal energy for the following runes. The source stays and can be drawn from again and again.
  - Drawn energy doesn't count toward Max Output.
- **Stability is compression:**

  | Compression | Stability | Safe draw rate (Control 20, 2 Infinity points) |
  | --- | --- | --- |
  | 20–29 | Extremely unstable | ~100 E/s |
  | 30–39 | Very unstable | ~300 E/s |
  | 40–49 | Relatively stable | ~600 E/s |
  | 50 | Maximum | ~1000 E/s |

  - The safe rate also grows with your Infinity technique points and your Energy Control.
- **Backlash:**
  - Drawing faster than you can control, or one huge pull far beyond a few seconds of safe drawing, builds **stress** (0 → 1).
  - Above 60% the source shakes, cracks and warns you ("Infinity is destabilising!").
  - At 100% it **backlashes**: a violent explosion, scaled by its energy, its compression and how hard it was being drawn. It hurts enemies and you nearby, drains and throws nearby energy, and destroys the source.
  - Stress eases while the source is left alone, faster at high compression.
  - Safe drawing never randomly destroys it.
- **Anti-Magic** doesn't consume a source. It disrupts its flow: stress rises fast (lower compression rises faster), and enough of it makes the source explode. The explosion is bigger the more Anti-Magic went in.
  - Reverse Anti-Magic calms a stressed source.
  - An Anti-Magic Infinity source is at war with itself and slowly destabilises.
- **Powerful spells disrupt it:** stress per strike is `(power / (2000 × (0.5 + 1.5 × stability)))²`. Weak spells barely matter; around 2000+ power seriously disrupts a Compression 20 source, while a Compression 50 source takes about twice the power.
- **The distance effect only comes from Spatial:**
  - Spatial energy → Infinity → Draw Out → Reinforce → Target yourself (or an ally, or your legs) makes an **Infinity spatial layer**.
  - Enemies, projectiles and other energy approaching you slow ever more and never arrive. Your own spells pass, and the layer moves with you.
  - It has a strength 0.5–5 from how much you poured in, a heavy upkeep, and you move a little slower.
  - Ordinary Infinity energy gives no such effect.
- **Hollow-Purple-style rupture:**
  - **Infinity Gravity (or Spatial) meeting its own reverse tears space.** That means two sources, or energy drawn from them, of opposite spatial behaviour, with 300+ energy together.
  - The rupture erases magic, wrecks enemies and throws you back. Ordinary opposing energy only cancels as before.
- **Spell Memory:** *Became an Infinity source*, *drawn from Infinity*, *source became unstable*, *Infinity disrupted*, *source exploded*, *source collapsed*, *became an Infinity spatial layer*, plus *entered / left / was held back by* a spatial layer and *opposing Infinity combined*.
- Technique → *Remove* (or negative power on Infinity) dissolves a source calmly.

### Other changes

- **Forge → Techniques:** new **🧪 Test: 1 point in each technique** button. It adds points if you don't have enough. Anti-Magic's name is now readable in that panel.
- **Kinetic energy bounces off surfaces**, like Light used to: up to *Max bounces* (default 3, new Kinetic option). Each bounce knocks a small shock into the wall. Out of bounces, it ends with the shockwave as before.
- **Bound: Tethers 1–8.** This sets how many tethers the energy makes.
  - Extra tethers go to your nearest other energies, or, in a group of pieces, to the next pieces along. With 2, each piece in a ring ties to its next two.
  - The cost scales with the count.
  - Every tether snaps, strikes and bounces on its own.
- **Spatial energy can be moved.** Portals and surfaces can be Redirected, attached, guided and so on, and a portal's exit travels with it.
- **Engine checks:** the old Infinity checks were replaced by 24 new ones covering creation, all six kinds, stability, extraction, backlash, Anti-Magic, powerful spells, the Spatial layer, memory and the rupture, plus kinetic bounces, tether count and movable Spatial. Total: 68 checks, all passing.

## Less lag with lots of energy, and Light / darkness beams made of real energy (engine v34, techniques v21)

### Performance with many energies (50–500 at once)

Measured in the sandbox with 6 casts of Generate 900 → Divide ×8 → Divide ×8 (frame time, lower is better):

| Energy | Before | Now |
| --- | --- | --- |
| Kinetic | 77 ms | 41 ms |
| Light | 65 ms | 29 ms |
| Thermal | 71 ms | 20 ms |
| Raw | 46 ms | 18 ms |

The energy update itself went from about 14 ms to about 1 ms per frame.

- **Crowd drawing:** when more than 24 energies are on screen, each loose energy is stamped from small cached animation frames of its look (body + technique effects) instead of being drawn with paths, gradients and clips every frame.
  - Frames are trimmed to what is actually visible, so each stamp covers as few pixels as possible.
  - Kinetic and Light streaks turn with the energy's motion; flames still trail behind the way they move.
  - Shaped, over-compressed, tethered and Infinity energy is still drawn in full detail.
- **Opposite states meeting:** only nearby energy is compared (a spatial grid), and nothing is compared at all when no opposite states exist. Results are identical to checking every pair.
- **Nearby searches** used by fields, Anti-Magic auras and similar effects use the same grid in a crowd.
- **Each spell's output** is now worked out in one pass over all energy instead of once per spell.
- **Limits in a crowd:**
  - fewer stray sparks are kept (260 instead of 480);
  - at most 160 flash rings;
  - lights close together are merged into one, since the lighting pass costs per light.

### Light / darkness item beams

- Holding R with a Light (or Reverse Light) magical item now fires a steady stream of real Light / darkness energy blobs from your hand, one every frame, at Light's speed (18).
  - The blobs carry the item's energy, so they behave like any energy of that kind: Light passes through creatures and walls and dazzles; darkness obscures and is swallowed by the first thing it meets or a wall.
  - Gravity bends the stream, Anti-Magic erases blobs, portals carry them.
- The stream follows your aim a little heavily, so sweeping it curves like a hose. When you let go, the last blobs keep flying.
- Blob size follows the item's energy (the old beam width). Each blob fades at the beam's range.
- Damage is about the same as before: each blob carries a set damage, so the stream deals what the old beam did per second.
- Cost unchanged: 4% of max energy once.
- **New engine API** `W.emitEnergy({...})` puts energy straight into the world from the game (no runes), as part of a small emitter spell of the owner's.

### Dev tests

70 engine checks (2 new: the crowd grid gives exactly the same results as a full search; emitted beam energy pierces / is absorbed / fades with a set damage per hit).

## Draw Out: draw from the energy you hold, and a constant flow from Infinity (engine v35, techniques v22)

### Draw Out — new settings

- **Draw from:**
  - *The current target* (as before).
  - *The energy this branch holds (split part of it off)*: part of the energy the spell is carrying is pulled out and separated. The rest of the branch acts on the drawn part; the main energy keeps doing what it was doing (moving, being a source …).
  - Works on ordinary energy and on an Infinity source. A source this spell made can keep travelling while you draw from it.
- **Drawn energy comes out as:**
  - *Auto* (default): from an Infinity source, a constant flow; from anything else, one energy as before.
  - *Gather it into one energy*: the old behaviour.
  - *A constant flow of small pieces*: small pieces leave several times a second (**Pieces per second**, 2–30, default 14) for the whole Draw Out duration. Each piece goes through the rest of the branch the moment it comes out, so Draw Out → Redirect makes a steady stream, like the Light sword's beam.
- **Infinity draws happen over the duration:** *Amount from an Infinity source* is spread over the Draw Out duration (300 E over 1 s at 14/s = about 21 pieces). Stress and backlash work as before.
- **Your own energy keeps its kind when drawn:**
  - Energy drawn out of your own energy keeps its techniques (Thermal stays Thermal).
  - It forms at the edge of the energy it came from, facing you.
  - It never merges back into the energy it was drawn from.
  - Its Spell Memory records *was split*.
- **If the spell's body limit is full** during a flow, what was drawn waits and nothing more is pulled until a piece can leave.

### Less lag with lots of moving energy

These come on top of last batch's crowd stamps and grid. In my sandbox tests (6 big zones drawing, 300–400 energies) frame time was 45 ms before both batches, 23 ms now. This batch alone changes little there; the remaining time in my tests is the browser painting.

- **Hit checks:** each creature's hit box is fetched once per frame instead of once per energy per creature, and energy far from a creature is skipped before the exact shape test. This matters most in dungeons with many enemies.
- **Body creation:** creating a body no longer recounts every body for the spell's output (O(n²) when a zone or a flow spawns many pieces).
- **Zone blobs:** a new zone blob checks spacing only against nearby blobs instead of every body in the world.
- **Sparks:** drawn in batches, one fill per colour and fade step instead of one per spark.
- **Rotated stamps:** Kinetic / Light streaks are drawn without save / restore.
- **Lights:** spell lights are hard-capped at the 24 strongest after merging.

### Dev tests

73 engine checks. 3 new:

- Infinity flows over the duration and each piece is redirected as it leaves.
- Drawing from the held energy separates a same-kind part while the main energy keeps going.
- A moving Infinity source keeps moving while its flow separates from it.

## Anti-Magic slash, and Draw Out flows that combine again (engine v36, techniques v23)

### Anti-Magic item special: a slash

- R with an Anti-Magic magical item now fires a slash: a black crescent of the weapon's anti-magic that flies out from your swing.
  - **Speed and range:** it travels at 15 px/frame, out to 320 px + 4 × the item's reach (at most 720).
  - **Creatures:** it cuts through every creature in its path (each takes 1.3 × the item's damage once).
  - **Magic:** it erases any spell or projectile under 10% of the weapon's energy and wears bigger ones down, the same as swinging the weapon.
  - **Its own energy:** it is made of the weapon's energy, so magic stronger than it uses it up (Anti-Magic's usual rule).
  - **Floors and walls:** it only stops when its centre meets a wall, so it can graze the floor.
- Size follows the item's reach and energy. It costs 30 energy, and the weapon stays in your hand.

### Draw Out flow pieces combine again

- Pieces of one Draw Out flow (from Infinity or anything else) used to never combine: drawn pieces were left out of combining entirely.
- Now they stay apart while they stream. Once both have slowed right down, they pull together and merge back into one energy: stopped, arrived with Redirect → *Slow to a stop*, or nearly still (under 1.2 px/frame).
- This works for any kind of energy from the flow, including ones that normally don't combine (Light, Gravity).
- *Wait until: Energy has combined* after the flow now finishes when the whole draw is done and all its pieces have become one.
- Spatial pieces still don't combine, because they become portals / surfaces.

### Engine

`W.emitEnergy` now also takes:

- `shape` / `form`: a compressed shape;
- `radius`: a set size;
- `pierce`: passes through creatures, each one once;
- `speedBonus`: faster than raw energy's limit;
- `surfaceProbe`: 0 means it meets surfaces only at its centre.

### Dev tests

75 engine checks (2 new: flow pieces recombine once stopped and "wait until combined" carries them on; an emitted slash pierces creatures and grazes the floor).

## Crash guard: errors can no longer freeze the game (engine v37, techniques v24)

- **What the freeze was:** the game loop scheduled its next frame only after everything else in the frame had run. So a single error anywhere (magic, HUD, drawing …) stopped the game for good. The page itself stayed alive, which is why the Back button still reacted when you hovered it.
- **I could not make the exact freeze happen:** several giant-zone → Anti-Magic → compress → magical item spells, in the sandbox and in a dungeon, ran without errors. These changes make sure that whatever caused it can't freeze the game again, and show what it was.
- **The game loop** now schedules the next frame first and runs each part (update, HUD, drawing, map, networking) on its own. An error skips only that part for that frame. A drawing error also resets the canvas so the next frame draws cleanly.
- **Errors are shown on screen** in a small red box: what failed, where, and for magic, which energy was involved. It has *Copy* and close buttons, and the last 20 errors are also kept in localStorage under `magicBattle_lastErrors`.
- **Magic errors are contained:**
  - If something fails while the engine is handling one energy, that energy fizzles and everything else carries on.
  - A body that fails to draw is skipped from then on.
  - If errors keep coming every frame without a culprit, all active spells are ended so the game recovers.
- **Angle smoothing** no longer uses a loop, so a huge or broken angle value can't hang the game.

### Dev tests

76 engine checks (1 new: a runtime error in a technique removes only that energy, the rest keeps moving, and the error is reported).

## Your own Anti-Magic no longer destroys your zone (techniques v25)

- Anti-Magic energy used to suppress any zone it sat in, including your own. So turning gathered mana into Anti-Magic inside your zone collapsed the zone you were gathering with.
- Now your Anti-Magic never suppresses **your own** zones.
- It also leaves alone the rest of **its own spell** (the energy it is being formed from or alongside).
- It still suppresses and consumes everyone else's zones and magic, and your other spells' energy, as before.

### Dev tests

77 engine checks (1 new: your own Anti-Magic inside your own zone leaves it intact; the existing suppression check now uses another caster's zone).

## Zone laws: techniques on zones, Target → Zone, Target "with technique" (engine v38, techniques v26)

### Techniques on zones

Put a Technique on a zone (right after *Create Zone*, or with the new *Target → Zone*) and the zone gets a **zone law**: it changes the rules inside it for its whole minute.

- A zone with a law no longer dissipates when its spell finishes.
- It shows a faint dashed boundary in the technique's colour.
- Its strength comes from the technique's intensity and is weakened if something suppresses the zone.

| Technique | Zone | Reverse zone |
| --- | --- | --- |
| Thermal | Enemies inside take a steady trickle of heat damage; Thermal hits on enemies inside are up to 60% stronger | Enemies inside are slowed; reverse Thermal hits inside build up frost until the enemy freezes solid (about 3–5 weak hits) |
| Light | The area is brightly lit (big light + glow); Light energy inside travels faster (18 → up to ~29) | The area goes dark; reverse Light energy inside fades to near-invisible and its effects aren't drawn |
| Gravity | High gravity for you inside (up to ×2.2: heavier, faster falls, lower jumps) | Low gravity (down to ×0.35) |
| Kinetic | Everything inside (you, enemies, enemy projectiles, magic energy) speeds up the longer it stays, up to ×1.9; it eases back outside | Everything inside slows down over time, down to about ×0.5 |
| Anti-Magic | All magic inside withers much faster and weak magic (under ~11 E) disappears; enemy projectiles weaken and small ones vanish; Anti-Magic can't break the zone down | Your magic inside does not shrink over time |
| Spatial | Portals and surfaces with an end inside it last much longer (time runs at ¼ speed for them) | Portals with either end inside stop working (they flicker shut) |
| Infinity | Not possible (clear error) | — |

### Targeting

- **Target → Zone** picks a zone: nearest to energy / to you / to the cursor, the largest, or a zone of this spell.
  - A Technique after it gives that zone its law.
  - Draw Out after it pulls out the energy the zone holds (as one energy or a flow).
- **Target → Raw energy / Active spell / Energy in an anchor state** has a new *With technique* filter:
  - choose *Any*, *Raw only*, or a technique (Infinity = Infinity sources);
  - for a technique, also choose *Normal only*, *Reverse only* or both.
  - Other casters' projectiles have no technique state, so a filter skips them.

### Fixes

Draw Out *from the energy this branch holds* (or from a zone) no longer drops what it draws into a zone earlier in the branch.

### Dev tests

88 engine checks. 12 new:

- one per zone law;
- Infinity zones are refused;
- Target → Zone with Technique and Draw Out;
- the technique filter.

The forge test spell "Zone → Gravity well" is now "Zone → Heavy gravity".

## Draw Out from every energy the branch holds — e.g. all your Infinity sources at once (engine v39, techniques v27)

- **What was wrong:** Target → *All raw energy* with technique *Infinity* did find every source, but Draw Out only drew from the first one. That single source then took the whole amount (e.g. 5000 E in 4 s), was pushed far past what it can handle, and backlashed.
- **Now:** when the branch holds several energies (Target → all / around / this spell, Divide …), Draw Out draws from **every one at the same time**. This works with *Draw from: the energy this branch holds* or with the current target.
  - **Infinity sources share "Amount from an Infinity source" equally:** 5000 E from 4 sources = 1250 E from each. Each source is only stressed by its own share, and each sends out its own stream of its own kind of energy.
  - **Ordinary energies** are each drawn at the normal rate, keep their kind, and stay separate from the energy they came from.
  - **Output:**
    - With a flow, every piece from every source goes through the rest of the branch as it comes out (e.g. → Redirect to cursor makes one stream from each source).
    - With *Gather it into one energy*, each source gives one energy at the end, and the branch holds them as a group.
- Your spell (Target all Infinity → Draw Out held 4 s, 5000 E → Redirect to cursor) now draws about 1667 E from each of 3 sources with no backlash.

### Dev tests

89 engine checks (1 new: 3 sources, 3000 E shared → about 1000 E from each, all sources intact).

## Damage cuts, special cooldowns, Spatial Infinity master portals, one zone at a time (engine v40, techniques v28)

### Damage

- **Massive compression:** hits from over-compressed energy are damped by `1 / (1 + 2.2 × over-compression)`. Compression 50 now hits about as hard as the same energy uncompressed (it was about 3×). It still pierces and lasts much longer.
- **Magical items:** damage multiplier is now `(1 + 0.28·√(power/20)) × (1 + 0.5 × over-compression)`. A 400 E sword at compression 40 is about ×5 instead of about ×18. Throws, beams and slashes scale from this, so they all drop too.

### Weapon special cooldowns

- **Magical item R specials:** each has a cooldown that grows with the item's power: `base + 0.45·√(power/100)` seconds, at most 15 s. Base: throw 1.2 s, Anti-Magic slash 1.6 s, Light / darkness beam 4 s. Pressing R early shows "Special ready in X s".
- **Engraved specials:** the cooldown now grows with the spell's cost (`0.6 + cost/45` s, at most 15 s). Pressing early shows "Engraving ready in X s".

### Spatial + Infinity

- **No instant portal:** a Spatial portal / surface now forms one frame after the Technique rune. So *Spatial → Infinity* on an instant link makes a **Spatial Infinity source** instead of opening a portal first.
- **The master portal:** a Spatial Infinity source is the master portal.
  - **Drawn energy is harmless:** Spatial energy drawn out of it passes through creatures without doing damage.
  - **Portals home:** once a drawn energy holds **500 E or more** (drawn as one energy, or pieces that combined), it opens a one-way portal home. Stepping in sends you to the master. If it came from several sources, which one you arrive at is random.
  - **Leaving through the master:** stepping into the master sends you out of one of its portals home, chosen at random.
  - **Coverage:** creatures, your energy and enemy projectiles all use these portals. You can't be thrown straight back, and the usual portal-loop protection applies.
- **Only Anti-Magic can harm a Spatial Infinity source.** Over-drawing, powerful spells, enemy magic and portal strain no longer stress it, and it never backlashes on its own. Spatial ± Infinity can still tear space (hollow purple), because that is a deliberate combination.

### Tethers

Bound can't tether to an Infinity source, and an Infinity source can't hold a tether.

### Zones

- **One zone at a time:** opening a new zone closes your old one.
- **Drawn energy takes the zone's technique:** energy taken from a zone with a technique becomes that technique's energy (Thermal zone → Thermal energy …). This covers blobs a rune acts on, and Target → Zone → Draw Out.
  - Spatial energy from a zone works like Spatial energy from Infinity: harmless and stored until 500 E, then it opens a portal home to its zone.

### Dev tests

93 engine checks (4 new: Spatial Infinity master portals; only Anti-Magic harms it; tether / one-zone / zone-kind; damage cuts).

# Current state (summary of everything above, up to date)

Cache-busters: **magic-engine v40, magic-techniques v28, magic-forge v14 (css v5), melee-combat v41, player-rig v4, slot-chooser js v4 / css v3, dungeon-vision v10.**

## Controls

| Key | What it does |
| --- | --- |
| O | Clears all your spells and passives |
| T | The "trigger key" condition |
| R | Weapon special; on magical items, throw — or hold for the Light / dark beam |
| Del / Shift+Del (forge) | Delete branch / delete one rune |
| ⟲ Reset, ∞ Passive (forge top bar) | Start the spell over / make it a passive spell |

## Energy and techniques

- **Speeds:** raw energy ≤ 9; Kinetic 8–15; Light always 18. Kinetic reinforcement adds speed past the raw / Kinetic limits. Redirect speed is a % of the energy's top speed.
- **Leak:** energy leaks 30% slower than originally.
- **Recoil:** launching energy with power > 60 that you generated near yourself knocks you back. Kinetic legs and *Anchor yourself* soak it up (up to 95%).
- **Techniques don't stack:** a different technique converts the energy; the same technique adds; its reverse cancels. Technique → *Remove* makes it raw again. Generate *at current energy* takes on that energy's technique (optional).
- **Thermal:** flame / snowflake look.
- **Spatial:** portal (+) or bounce surface (−). A weapon reinforced with Spatial attacks through a portal at the cursor.
- **Gravity:**
  - pulls are 3.45× the original strength;
  - pulls you too, unless the rune's *Affects you too* is set to *No*;
  - does no damage and rests on walls;
  - bends spells and enemy projectiles, which can then hit enemies;
  - merges with same-sign gravity energy;
  - cannot be compressed (compress first, then apply Gravity — the compression level counts for Infinity);
  - reinforcing yourself gives high / low gravity;
  - on a weapon: heavy = slower + harder, light = faster + weaker.
- **Light:** always travels at 18 and passes through enemies and surfaces (infinite pierce).
- **Anti-Magic:** consumes magic by magnitude (Anti 30 + raw 50 → raw 20). It suppresses techniques, other casters' zones (gradually, then they collapse — never your own), reinforcement (while touched), projectiles, portals and Infinity. Each technique resists differently: Spatial most, Light least. It does modest damage to non-magical creatures. Reverse Anti-Magic restores / stabilises existing magic and never creates energy.
- **Infinity** (a technique, but not an ordinary one): 450+ E at Compression 20+ becomes an Infinity source — a reservoir of its own kind of energy. Draw Out pulls that kind out, without limit. Compression is its stability. Over-drawing, Anti-Magic or very powerful spells build stress → backlash explosion. Spatial energy drawn from it and reinforced into you makes the distance layer. Infinity Gravity / Spatial meeting its reverse tears space.
- **Kinetic** behaves as described in "The six techniques". **Binding was removed** — it is now the Bound state of the Anchor / State rune.
- **Spatial** portals carry things through for free (no energy or time lost). Spatial energy can be moved; a portal's exit moves with it.
- **Generate** makes up to 1000 energy.
- **Kinetic** bounces off surfaces (Max bounces, default 3).
- **Mana zone Draw Out:** zone size multiplies the draw by `1.5 × (radius/180)^1.6`, kept between 0.2× and 60×. That is about 0.5× at 90 px, 1.5× at 180 px and 60× at 1800 px.
- **Compression** runs −10…50:
  - each level needs a minimum of energy (`2 + 0.5c + 0.04c²`: 11 at 10, 28 at 20, 127 at 50) or it collapses;
  - highly compressed energy resists gravity (×0.21 at 50);
  - past 10 it over-compresses: much smaller (under ⅓ size at 50), stronger, pierces enemies, lasts much longer — but it is a little unstable, and redirecting it can make it explode (less likely with Energy Control; inventory transfer is safe);
  - the glow stays inside its own shape;
  - Compress rune cost is `5 + (power − 10) × 0.9` past 10.
- **Enemy vortex attacks** pull your energy and can turn it against you.

## Spells

- **Conditions:** 35 "Wait until" conditions, including *combined*, *the rest of the spell is finished* and *spell memory*.
- **Spell Memory:** the Spell Memory rune and condition check whether the energy passed a portal, hit an enemy or surface, was compressed, split, reinforced, redirected, combined, bound, lodged, had its tether snapped, flung back enemy magic with a kinetic tether, touched / lost energy to / was disrupted by Anti-Magic, was restored, or was converted into / entered / left / was blocked by / collapsed / combined Infinity.
- **Runes:** Rotate; Draw Out hands pieces on immediately, draws from Infinity sources (over its duration, as a constant flow of pieces by default), can draw from *the energy this branch holds* (a same-kind part splits off and stays separate), and can output one energy or a flow (flow pieces combine again once they stop); with several energies held it draws from all of them at once (Infinity sources share the amount equally); shapes include fist, hammer, point, line, arc, cone, wall, tether, spiral.
- **Anchor / State:** anchored, free, attached, guided, bound (tether; Tethers 1–8). Energy waiting for a hit lodges in what it strikes; *Energy is in a state* condition.
  - **Bound:**
    - Binds to the current target, to you (the energy *follows you* or *pulls you*) or to your nearest other energy (the two are drawn together).
    - **Strength 1–10:** sets drag, slow, hold and cost.
    - **Snapping:** fast / strong energy crossing the cord snaps it.
    - **Kinetic bond:** with Kinetic on the energy, the cord catches enemy magic, stretches and flings it back, turned.
    - **Contact:** an ordinary cord strikes enemies that touch it (35%, with technique effects); a kinetic cord is solid to everything — energy bounces off it, creatures (you too) are thrown back.
- **Target → Energy in an anchor state:** finds your own energy that is anchored / free / attached / guided / bound / infinity.
- **Zones** dissipate once their spell is finished (no runes left, no conditions waiting, nothing drawing) — unless a technique gave them a **zone law** (Thermal, Light, Gravity, Kinetic, Anti-Magic, Spatial, each with a reverse; see the zone laws section); those last their full minute. *Target → Zone* picks an existing zone; Target on energy / spells can filter *With technique*.
- **Passive spells** (∞): cast to switch on and cast again to switch off. They drain `cost × 1.3 / cycle` energy per second, and their reinforcement holds steady.
- **Engraving:** a weapon's special can carry an engraved spell, cast every time the special strikes.

## Reinforcement

- **Targets:** yourself, legs, arms, ally, weapon, active spell, raw energy. Raw energy / active spell / anchor-state targets can select *All energy inside this spell*.
  - Yourself: mainly damage resistance, with small capped melee, run and jump bonuses.
  - Legs: run and jump.
  - Arms: melee damage.
- **Energy into energy:**
  - same kind adds; a technique into its reverse cancels;
  - a different kind has its own effect: Kinetic → +speed, Light → +energy, Thermal → burn / chill on hit, Gravity → heavy / floating, Spatial → swap position, Anti-Magic → consumes it (reverse: restores it), Infinity energy → makes it Infinity.
- **Infinity spatial layer:** Spatial energy drawn from an Infinity source, reinforced into yourself / an ally / legs → approaches slow ever more and never arrive; heavy upkeep; you move slower. **Anti-Magic reinforcement:** an aura that eats incoming magic.
- **Costs while used:**
  - legs: `4 + 12 × strength` energy/s while moving;
  - arms or weapon reinforcement: 3 energy per attack.

## Magical items

- **Making one:**
  - Put a *Magical item* in a slot.
  - Compress energy to **20+** as a fist / sword / spear / hammer, then Redirect it *Into your inventory*.
  - Same-shape energy feeds an existing item. A refusal reason is shown on screen.
- **Only for the run:** items are gone on reload or death.
- **Looks:** exactly like the compressed energy, in your hand and as its icon.
- **Reach:** from your hand to the drawn tip (`(front + 0.8·back) × R`) — what you see is what hits. Reach never exceeds 260 px.
- **Anti-Magic items:** while swung or thrown, they erase any spell or projectile under 10% of their energy and wear down bigger ones.
- **Damage:** × `(1 + 0.28·√(power/20)) × (1 + 0.5 × over-compression)` — keeps growing as you feed it, much more slowly than before.
- **Special cooldowns:** `base + 0.45·√(power/100)` s (max 15): throw 1.2, slash 1.6, beam 4.
- **Upkeep:** `2 + 0.3·√energy + 0.05·over` energy/s while in a slot. Without energy it decays and falls apart below 5.
- **Attack costs:** swing 3 energy. R throw 30. Light / dark beam 4% of max energy, once.
- **R special:**

  | Item energy | R special |
  | --- | --- |
  | Default | Throw: it comes back to your hand and hits on the way out and back |
  | Kinetic | A fast throw that hits harder |
  | Thermal | A throw that leaves flames (or snowflakes / ice for reverse); trail effects are 60% weaker than at first |
  | Light | Charge 0.6 s, then hold: a stream of real Light blobs (width follows the item's energy; passes walls and creatures) |
  | Reverse Light | The same stream, made of darkness blobs (absorbed by the first thing they hit) |
| Anti-Magic | A slash: a crescent of anti-magic that cuts through creatures and erases weaker magic it passes (30 energy) |

## Dev tests

Rune Forge → 🧪 Tests (17 test spells) and "Run engine checks" (93 checks, all passing).

## Errors

The game never freezes on an error: the failing part is skipped for that frame, and the error is shown in a red box on screen (with *Copy*) and kept in localStorage `magicBattle_lastErrors`. Magic errors remove only the energy involved.

## Performance

More than 24 energies on screen → cached-frame stamps; a spatial grid for meeting / nearby / zone-blob checks; hit boxes once per frame; batched sparks; spark, ring and light limits in a crowd.
