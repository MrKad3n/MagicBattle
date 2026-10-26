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

## P drops your magical item, slashes for both Anti-Magic forms, zone-center redirect, drag-to-swap / insert runes (engine v41, techniques v29, forge v15 / css v6)

- **P key:** no longer opens the training yard. **P now releases the magical item you're holding.** Its energy disperses and the slot becomes an empty Magical item again.
- **Anti-Magic slash:**
  - The cooldown is now always **1 second**.
  - **Reverse Anti-Magic items** also slash. It's a crescent of restoring Anti-Magic that cuts through creatures (same damage) and restores / stabilises magic it passes instead of erasing it.
  - Specials are named in the move list: Anti-Magic Slash, Restoring Slash, Light Beam, Dark Beam, Throw.
- **Target → Zone, "Use the zone as: Center of the zone":** the branch keeps its energy and only aims at the zone's center. **Redirect → Toward target** then sends the energy there; with *Slow to a stop* it halts exactly at the center. The zone itself is not moved. *The zone itself* (the default) works as before (Technique / Draw Out act on the zone).
- **Rune Forge drag & drop:**
  - **Drop a rune onto another rune** to swap them: each keeps its own settings, and the connectors stay where they are. The target rune glows gold while you hover.
  - **Drop a rune onto a connector** (the badge between two runes) to move it between those two. Its old children reconnect to the rune before it, and the branch it lands in slides over to make room. The connector glows teal while you hover.
  - Dragging to empty space still moves the whole branch. Everything can be undone with Ctrl+Z.

### Dev tests

94 engine checks (1 new: Target → Zone center + Redirect toward target ends at the zone's center, and the zone doesn't move). Forge drag & drop was checked in the browser: swap, insert between, undo.

## Energy drawn from a zone follows "Redirect → Toward target" again (engine v42, techniques v30)

- **What was wrong:** after Draw Out, each drawn piece targets itself ("Afterwards you are targeting the drawn energy"). So in a spell like *Zone → Target environment in zone → Draw Out → Redirect toward target*, Redirect aimed every piece at itself and nothing moved.
- **Now:** drawn energy remembers what it was drawn from. That is the zone it fills, the zone / energy / creature it was pulled out of, the Infinity source, or the point of an environment draw.
- **Redirect → Toward target / Away from target**, used on drawn energy that targets itself, now aims at that origin. In the spell above the pieces fly to the zone's centre (with *Slow to a stop* they halt there and gather into one).
- If you put a different Target after Draw Out, Redirect uses that target as before.

### Dev tests

95 engine checks (1 new: a zone draw followed by Redirect toward target sends every piece to the zone's centre).

## Random page refreshes, one Draw Out at a time (engine v43, techniques v31)

### Random refreshes

- **Nothing in the game reloads the page.** But files in the Games folder keep being rewritten in the background: the same 14 files at once, every few hours, with only their line endings changed (CRLF). That's the work of Git / GitHub Desktop or OneDrive sync.
- **Why it looks random:** a live-reload dev server (VS Code Live Server, Five Server, live-server …) reloads the page every time a file changes, so each background rewrite refreshes the game.
- **The fix:** dungeon.html now holds back the dev server's "reload" message. A small banner appears instead: "Game files changed on disk — click (or press F5) to reload when you are ready". CSS refreshes and every other connection (co-op / PvP) are untouched.

### One Draw Out at a time

- While a Draw Out is still pulling energy, starting another one (from any of your spells) **interrupts the running one**: it stops at once and keeps what it already drew.
- The new Draw Out doesn't start. Its branch ends with "Already drawing energy — the running Draw Out was interrupted".

### Dev tests

96 engine checks (1 new: a second Draw Out stops the first, which keeps its energy, and doesn't start itself). The reload guard was checked in the browser: "reload" is held back and the banner shows; other messages still pass.

## Construction — energy made into solid matter (engine v44, techniques v32, forge v16)

A new technique, **Construction**, registered like the others (Technique rune → *Construction*, needs at least 1 Technique Point). It turns magical energy into a **construct**: a solid, temporary object in the world. It is not a summon and not a creature.

### Building (positive power)

- **The energy is used up.** It becomes the construct's material, and no energy body is left behind or duplicated. Material is 72–95% of the energy (more with points), so nothing is ever free.
- **Shape:** the energy's Shape (Compress / Shape) is the construct's form: line → platform, wall → wall, cube → block, spike, sword, ring (with its hole), arc, star and the rest. Unshaped energy becomes a block, and the forge says so.
- **Size and toughness:**
  - More energy → bigger.
  - Compression → denser: smaller and tougher from the same energy.
  - Technique points → better efficiency and integrity, never more material than the energy.
  - Everything is bounded: at most 640 px across, 12 collision boxes, integrity 6–6000.
- **Rune options:** *Construct faces* (the way you face, up, down, right, left, or the way the energy travels) and *Proportions* (0.4–3×, stretches it along its length — a longer, thinner platform).
- **It keeps the state its energy was in (Anchor / State):**

  | Energy state | Construct |
  | --- | --- |
  | Anchored | Stays in place, like terrain |
  | Free | Falls with gravity and keeps the energy's motion (a thrown boulder) |
  | Attached | Rides what it was attached to |
  | Guided | Flies after its target (and carries you if you stand on it) |
  | Bound | Falls, but is tethered |

- **Its material:** a technique already on the energy stays with the construct:
  - Thermal burns whatever touches it; reverse Thermal chills.
  - Kinetic keeps speeding up while it moves and flings creatures off; reverse slows them.
  - Gravity is heavy; reverse Gravity floats (a hanging platform).
  - Light glows and dazzles; reverse Light darkens.
  - Anti-Magic resists Anti-Magic and erases the magic that strikes it.
- **Safe placement:** it never forms inside you. If it would, it moves in front of you, under your feet, behind you or above you. If nothing fits, you pass through it until you're clear (enemies too). If it would be inside a wall, the rune fails ("No room to build there") and your energy stays.
- **Limits:** 12 constructs per caster (building more crumbles your oldest), 48 in the world.

### Physics

- **Real collision through the game's own movement:**
  - You can **stand on** a construct and you **ride** a moving one.
  - Its walls block you and enemies.
  - Your head stops on its underside.
  - It works in both the tile dungeons and the open / sandbox maps.
- **Free constructs:** fall, land on terrain and on other constructs, slide to a stop, and bounce a little off hard landings.
- **Moving constructs strike enemies** in their way (damage from speed and mass, knockback, one hit per 0.5 s per enemy).
- **What damages a construct:**
  - Enemy projectiles break against it and wear it down.
  - Energy flying into it strikes it like a surface: it's stopped, and the construct takes damage. Energy that sits still or formed inside it is left alone.
  - Your melee: once per attack.
  - Enemies pushing against it.
- **Pressure plates** count a construct resting on them.

### Integrity, breaking and lifetime

- **Damage cracks it** (the cracks spread as integrity falls) and it flashes when hit.
- **At zero it shatters at once:**
  - collision ends that frame and it can't be targeted any more;
  - fragments fly;
  - a quarter of what it could give back settles into the environment, where Draw Out can gather it.
- **Temporary:** it lasts 40–120 s (longer with more energy and compression), then flickers and crumbles the same way.
- **O** (clear your spells) and **death** dissolve your constructs, with nothing recovered. Nothing is saved.

### Reverse Construction (dismantle)

- *Target → Construct* (new target kind), then Construction with negative power.
- **It needs no energy of its own.** Your construct comes apart into raw energy, which becomes what the rest of the branch works on (Redirect it, compress it …).
- **What you get back:**
  - At most 45–70% of its material, and less if it's damaged.
  - Only once per construct.
  - Never more than your free Max Output (the rest disperses).
  - The energy keeps the construct's material technique.
- **Only your own constructs.**
- **Forge feedback:** without a Target → Construct before it, the forge shows an error.

### With the other techniques

| Technique | Energy hitting a construct |
| --- | --- |
| Thermal | Scorches it (more damage) |
| Reverse Thermal | Makes it brittle: ×1.5 damage for a few seconds |
| Kinetic | Shoves a free construct hard |
| Reverse Kinetic | Stops a moving one |
| Gravity | Weighs it down (it drops); not used up |
| Reverse Gravity | Lightens it; not used up |
| Spatial | Moves a free construct a short way through space; slips past an anchored one |
| Portals | Carry a free construct that fits through |
| Light | Normally passes through surfaces, but is **blocked** by a construct |
| Anti-Magic | Eats integrity fast (energy flying in or resting against it); an Anti-Magic zone wears constructs away |
| Reverse Anti-Magic | Restores integrity |
| Gravity fields | Pull free constructs |
| Gravity / Kinetic zones | Change how heavy / how fast free constructs are |
| Anti-Magic items | Their sweep cuts into other casters' constructs |

- **Infinity:** an Infinity source can't become a construct (forge error; the source is untouched). Energy drawn from one builds normally, and nothing is duplicated.
- **Reinforcement → Target Construct:** restores integrity, up to 1.6× its original, and adds a little life. It never raises what it can give back. Technique energy gives a raw construct that material.

### Spell Memory

New events: *Became a construct*, *Its construct was damaged / destroyed / dismantled*, *Energy was recovered from a construct*, *Its construct struck something*. A construct keeps its own history (starting from its energy's), and Spell Memory reads it after Construction or *Target → Construct*. Each blow is remembered once, not once per frame of contact.

### Forge

- **Construct section:** the inspector shows size, collision boxes, material, density, integrity, lifetime and how much it can give back. For reverse Construction it shows what dismantling returns.
- **Warnings:** too little energy (15 E minimum) and no Shape.
- **Errors:** an Infinity source, a zone, and reverse without a construct target.
- The live preview builds the construct.
- **F9 debug:** draws every construct's collision boxes, state, integrity and time left.

### Dev tests

158 engine checks (62 new, sections A–J of the spec):

- **A:** registration and access.
- **B:** conversion and accounting.
- **C:** every shape, the ring's hole, facing, drawn boxes = collision boxes.
- **D:** physics — standing, walls, never trapped, no-room failure, riding, construct-on-construct, projectiles, energy, impacts, melee, plates.
- **E:** integrity and breaking.
- **F:** each technique interaction, Reinforcement, every Anchor state, Infinity.
- **G:** dismantling, once only, Max Output, ownership, damage, forge.
- **H:** lifetime, expiry, O, cap, death.
- **I:** memory without duplicates.
- **J:** regressions and the crash guard.

Also checked in the browser:

- In the sandbox map and a fire dungeon: you land on a platform and a wall stops you.
- Shattering works.
- The forge shows the Construct section.
- No errors.

## Recoil switched off (engine v45)

- **No more recoil.** Redirecting powerful energy you generated near yourself no longer knocks you back.
- **Spatial rupture:** the blast no longer hurls you away. The rupture itself is unchanged.
- **How:** behind one switch, `CONFIG.recoil = false` in magic-engine.js. Set it to `true` to bring both back exactly as they were.
- **Anchor yourself:** Anchor / State → *Anchor yourself (resist recoil)* still roots its energy at your feet. It has nothing to resist for now.

## Constructs: full speed on top, Gravity cores you can steer, Rotate, true shapes (engine v46, techniques v33)

### No more slowdown on constructs

- **The cause:** a check meant to stop fast falls from skipping through thin platforms pulled you back along your path every frame. Running or dashing on a construct lost about half your speed.
- **The fix:** that check now only runs when you've gone clean through a construct, so walking and running on one is full speed.
- **Small edges:** you now step up over small edges (up to 14 px, such as the seams of a rounded construct) instead of being stopped by them.

### Gravity reinforcement → a Gravity core

- **How:** *Target → Construct*, then Generate → Technique *Gravity* → Reinforcement (or Reinforcement → Target → Construct).
- **What it does:** the Gravity energy stays inside the construct as its **Gravity core**, shown as a swirl in its middle.
  - **Normal Gravity:** heavier, so it falls faster and hits harder.
  - **Reverse Gravity:** lighter, so it falls slower. With enough energy for its size it stops and floats in the air.
  - **Strength:** depends on how much energy you pour in compared with the construct's mass.
  - **More Gravity reinforcement** adds to the core; a normal and a reverse core cancel each other out.
- **You can control it through that energy.** The core is still your energy, so target it (*Target → Raw energy*, *With technique: Gravity*) and use the normal runes:

  | Rune on the core | The construct… |
  | --- | --- |
  | Redirect | flies there (it still collides) |
  | Anchor / State → Anchored | holds where it is, even in mid-air |
  | Guided / Attached / Bound | follows, rides or is tethered |
  | Rotate | turns with it |

  When the energy stops moving and isn't anchored, the construct falls again, at its new heavier or lighter weight.
- **An anchored construct** stays anchored when you give it a core, until you move its energy.
- **The core's gravity acts only on the construct.** It doesn't pull you, enemies or other energy, and it doesn't merge with other Gravity energy.
- **It goes away with the construct:** breaking, expiring, dismantling and O all remove it.

### Rotate works on constructs

- **Where it works:** Construction → Rotate, or *Target → Construct* → Rotate, no energy needed.
- **Turn by an angle:** instantly or over time.
- **Spin continuously:** lasts while the spell runs.
- **What turns:** *its direction of travel* turns its motion too.
- **Never into a wall:** a turn that would push it into terrain or another construct stops there.
- **Through its core:** rotating a construct's Gravity core turns the construct.

### Constructs keep their Shape

- **What you see is the exact Shape.** A sphere is round, a star has points and a ring has its hole.
- **Its collision follows the outline closely:** up to 18 thin slices (instead of 12 coarse boxes) that reach every corner and tip of the outline.
- **Technique effects** (fire, light, Anti-Magic) also follow the true outline.

### Dev tests

163 engine checks (5 new: full speed on a construct and stepping over edges; Gravity cores falling faster / floating without pulling you; steering, anchoring and rotating through the core; Rotate on constructs; the core goes when the construct breaks. C5 now checks that the outline is drawn and the boxes hug it). In the browser, walking speed was the same on a platform as on the ground, and a reverse-Gravity sphere floated.

## Constructs face where they're sent, Gravity cores as an aura, a new look for Gravity energy (engine v47, techniques v34)

### Redirected constructs point where they go

- **Turning to face its travel:** when you move a construct through its Gravity core (Redirect, Guided …), it turns smoothly so its Shape points where it's going. A sword flies tip-first; a platform sent upward turns into a pillar.
- **Collision while turning:** the turn is collision-checked, so it never turns into a wall.
- **Rotate locks the facing:** once you've used a Rotate rune on the construct (or on its Gravity energy), it keeps the facing you gave it, and redirecting it no longer turns it.
- **Anchored or attached** constructs don't turn.

### A Gravity core shows as an aura

- **No more swirl:** the Gravity energy inside a construct is no longer drawn as Gravity energy, and the construct keeps its own colour.
- **The aura instead:** the construct gets a softly pulsing glow around its outline. It's brighter the more Gravity it holds for its size: violet when heavier, pale lavender when lighter or floating.
- **Still targetable:** the core is still there, so you can target and steer it as before.

### Gravity energy, redrawn

- **Normal Gravity — a small singularity.**
  - A pitch-black event horizon with a thin, flickering photon ring and a soft glow.
  - A tilted accretion disk: bands from white-hot inside to deep violet outside, brighter on the side turning toward you. Clumps of hot gas orbit it, faster near the centre.
  - The far side of the disk is bent up over the top of the horizon, and the near side crosses in front of it.
  - Motes spiral inward, and the space around it darkens.
- **Reverse Gravity — a white hole.**
  - A brilliant, breathing core with soft turning rays.
  - Soft shockwaves of pushed space rolling outward.
  - Motes thrown outward trailing light.
- **Compressed into a shape** (compress first, then Gravity): the shape is a hollow of darkness rimmed by bent light, with motes drawn into it. Reversed, it's a shape of bright, pushing space.
- **Removed:** the old thin spiral lines and the screen-copy lens. The lens made doubled ghost images.
- **Crowds:** many Gravity energies still render through the cached crowd frames (checked with 34 at once).

### Dev tests

165 engine checks (2 new: a redirected construct points where it's sent but keeps a Rotate-set facing; a core shows as an aura). Screenshots were checked in the browser.

## Falling constructs stick or settle, Gravity really moves constructs, Draw Out by amount (engine v48, techniques v35)

### Falling constructs

- **Pointing the way it falls:** a construct with Gravity on it (a Gravity core, Gravity material, or recently struck by Gravity energy) turns to point the way it's falling.
- **Pointed shapes stick in:** when a sword, spear, spike or arrow lands tip-first, it **sticks in the ground**.
  - It drives in a little (deeper the faster it fell, up to about 46 px) with a puff of debris, and it's stuck there (anchored).
  - Strong enough Gravity can pull it back out, and so can moving its core.
- **Other shapes settle flat:** they topple onto their flattest side when they land (a block onto a face, a platform lying down). They rise a little as they tip so they never dig into the ground.
- **A Rotate rune** (on the construct or its core) keeps the facing you set, as before.

### Gravity has a real effect on constructs

- **Pulling:** Gravity energy now pulls (reverse: pushes) constructs much harder, scaled by the energy's power. Heavier constructs move less, and they settle into the well instead of flying through it.
- **Anchored constructs can be torn loose:** when the pull beats the construct's hold (stronger pull, longer than 0.3 s), it breaks free and moves. A stuck sword holds 1.5× harder. A weak pull can't budge a heavy construct.
- **Gravity energy striking a construct** knocks an anchored one loose if it's strong enough, and weighs it down so it drops (reverse: lightens it so it floats). The Gravity energy isn't used up.
- **Fields:** Gravity fields (Gravity aimed at the environment) pull constructs too.

### Draw Out: you choose the amount

- **The amount works for everything now.** The *Amount to draw* option (it used to be Infinity-only) sets how much you pull from anything: environment, zones, energy, yourself, creatures. It's drawn over the Duration, and less if the source runs dry.
- **Drawing more at once is harder.** Strain is the amount per second divided by what you can safely draw:
  - Above 1×, part of what you pull spills away (sparks): 25% per 1× over, up to 60%.
  - Past 1.5× the draw can **backlash**: a burst at the source that also catches you if you're close, and the draw ends with what it had.
  - A longer duration, less at once, or more Energy Control makes it safe.
- **Safe rates (× Energy Control):**

  | Source | Safe rate |
  | --- | --- |
  | Environment | 60 E/s |
  | Yourself | 80 E/s |
  | Energy | 0.8 × its power per second |
  | Creatures | 20 E/s |
  | Filling a zone | its full capacity over 3 s |
  | Emptying a zone | its full capacity over 2 s |

- **Zone capacity depends on size:** 220 E at radius 180, about 620 at 360, 1080 at 520, 2880 at 1000 and 6960 at 1800. A zone fills to that from its whole area. If you ask for more, it's clamped, and the forge warns. A full zone can't be filled further.
- **Infinity sources** keep their own stress / backlash rules.
- **Forge:** warns when a draw will strain (how much will spill, and whether it can backlash) and when you ask for more than a zone can hold.

### Dev tests

173 engine checks (8 new):

- a heavy sword falls tip-down and sticks;
- a block settles flat;
- Gravity tears an anchored construct loose (a weak pull doesn't);
- Gravity energy knocks a construct loose so it drops;
- Draw Out gives the amount you ask for;
- zone capacity grows with size;
- a rushed draw loses more;
- an overstrained draw backlashes.

In the browser, a sword and a spear stuck into the ground and a platform, and a block settled flat.

## Domain Expansion, rune mages and the Mage Arena (c39)

### Domain Expansion — a zone with rules

- **The Domain rune** (in the Zone category) turns the zone its branch holds into a domain. Its child runes are the domain's **rules**, and they act on every foe inside it.
- **What it needs:** a zone holding at least **120 E** (draw it in first), **Energy Control 6+**, and at most `4 + Control/2` rule runes. The forge checks all three.
- **Options:**

  | Option | Choices |
  | --- | --- |
  | Form | *Closed* (a barrier: foes inside are held in, weaker outside energy can't get in) or *Open* (no barrier; 1.5× the radius, 70% of the duration, 80% refinement) |
  | Duration | 3–20 s (default 8) |
  | Sure-hit | Your moving energy inside the domain homes onto the nearest foe inside it |
  | Vow | *None*; *Shared* (rules ×1.5, but the rules can hit you too); *Brief* (×1.3, half the duration); *Narrow* (×1.3, 60% of the radius) |

- **Rules** run per foe inside (up to 6), depending on how they're linked:
  - **Instant:** once, on each foe.
  - **Delay:** every *delay* seconds, on each foe.
  - **Condition:** armed for each foe, and fires when that foe meets it. It re-arms 0.6 s later.
  - Two new conditions for rules: **Target is moving** and **Target attacks or casts**.
- **Rule energy comes from the zone:** a Generate in a rule draws from the zone's stored energy (×the vow) and costs only 1 in the forge.
- **Upkeep and ending:**
  - A domain burns 20% of its starting fuel over its duration (×3 while suspended).
  - When it ends you suffer **burnout** for `4 + 0.4 × duration` s. During burnout, Technique runes fail.
- **Clashes:** when two domains overlap, the more refined one wins (zone energy × draw control × form). The other one is suspended.
- **Barrier:** outside energy hitting a closed barrier is stopped if its power is below 15% of the domain's refinement. Otherwise it's halved.
- **Limits:** one domain per caster, and one domain per zone.
- **Look:** a tinted dome with a turning glyph ring and a timer arc. Yours is violet; an enemy's is red.

### Other casters use the engine as you do (foe perspective)

- **Each cast has its own perspective:** every spell instance sees the world from its own caster's side.
  - An enemy caster's spells see *you* as the enemy and use the caster's own aim as the "cursor".
  - Their damage goes to you, with their own trigger count and health checks.
- **Throughout the engine:** this covers bursts, explosions, tethers and cords, constructs, zone laws, domains, statuses and conditions.

### Rune mages — three enemy casters that fight as a player does

New file **rune-mages.js**. Each mage has:

- **A spell book:** real rune spells built from the same runes as the forge, checked against the mage's own magic profile, and cast through the engine with its own energy and aim.
- **Two techniques**, using the points system as you do.
- **Its own energy pool:** it pays each spell's cost and regenerates.
- **A mind that sets the field up first and then springs a combination.** It also keeps its range, strafes, jumps after you, and dodges your incoming energy.

**Vesk, the Tether Weaver** (Kinetic + Anti-Magic, 750 HP):

- **Kinetic Node:** sends kinetic energy to a spot and anchors it there. Vesk places these around you on paths that don't run through you.
- **Weave:** ties every anchored node to the next ones with strong tethers. Kinetic cords are solid: they fling you back and bounce your spells away.
- **Collapse the Web:** frees the woven nodes and drives them all at you.
- **Kinetic Lance:** a compressed kinetic lance aimed at you.
- **Null Ward:** Anti-Magic shot at your incoming spell to erase it.

**Morrow, the Gravewright** (Construction + Gravity, 950 HP):

- **Gravity Well:** gravity energy placed where you're heading, which pulls you in.
- **Grave Spike:** a compressed sword sent above the well. It becomes a construct pointing down, gets a gravity core, drops, and sticks into the ground.
- **Bulwark:** a construct wall raised as cover when Morrow is hurt or shot at.
- **Stone Shard:** a spike.
- **Domain: Crushing Court:**
  - It draws 450 E into a 340 px zone, then opens a closed 7 s domain.
  - Every 1.1 s a sure-hit spike strikes each foe inside.
  - Moving inside it pulls you toward Morrow with gravity.
  - Morrow opens it when you stay within about 330 px.

**Sola, the Ember Cartographer** (Thermal + Spatial, 650 HP):

- **Ember Mine:** thermal energy anchored on the ground you're about to cross. It discharges when you come near.
- **Cartographer's Gate:** a portal whose entrance is behind Sola and whose exit is just past you.
- **Gate Volley:** arrows fired into the entrance, which hit you in the back from the exit while you stand in its line.
- **Cinder Bolt:** a compressed thermal bolt aimed at you.
- **Blink:** a portal at her feet, which carries her away when you get close.

**Shared behaviour:**

- **Damage:** their hits are scaled to 30% of what the same spell does to an enemy (`RuneMages.damageScale`). Every hit lands, with no invulnerability window that would swallow a volley.
- **Your magic works on theirs:** your spells, melee, Anti-Magic, gravity and portals all work on the mages and their magic.
- **Death:** when a mage dies, all of its spells end.

### Mage Arena

- **⚔ Mage Arena button:** added to Sandbox mode, in the top right.
- **The arena** (`dungeon.html?mode=sandbox&arena=mages`):
  - a 9000 px wide open floor with a few platforms;
  - ruined pillars in the background;
  - a glowing summoning circle in the middle.
- **Summon panel** (top left):
  - Vesk / Morrow / Sola, with their techniques;
  - **Shift-click** adds another mage instead of replacing the current one;
  - **Clear mages**;
  - **← Back to Sandbox**.

### Magic shoves on you are capped

- **Being hit:** enemy kinetic hits, cords and gravity pushes on you are now a short knocked-back flight of about 70 px. Before, they could launch you across the map.
- **Your own Force / launch on yourself** works as before.

### Tests

- 181 engine checks, all passing. This adds DM1–DM8 for domains:
  - rules hit foes inside;
  - sure-hit homing;
  - the barrier stops weak outside energy;
  - burnout;
  - condition rules;
  - clashes;
  - forge validation.
- **`RuneMages.selfTest()`:** every mage's spells validate, and each mage sets up and lands hits on a target within 12 s. All 6 pass.
- **In the browser:** the arena button and panel, Vesk's woven web around the player, Morrow's Crushing Court domain and a stuck Grave Spike, and Sola's arrows coming out of the gate behind the player.

## Rune mages v2 — they play like a decent mage player (c40)

### How they think now

- **Tactics instead of spam:** each mage knows about 15 tactics, which are short plans of several steps (set up → wait for the opening → spring the combo).
  - Every tactic scores itself against the situation: range, your height, whether you stand still, cast or rush in, its own health and energy, and what it already has on the field.
  - It picks among the best ones, with some variety, and takes a breath between plans.
  - Plain shots are low-scoring tactics with their own cooldowns. In headless duels only 15–40% of casts are plain shots.
- **Wind-up:** before a planned spell the mage gathers it for 0.1–0.3 s. A glyph ring grows around its staff orb and the spell's name shows, so you can read it and react. It moves slower while gathering, and a stun or knockback cancels it.
- **Human perception:** it sees you about 0.25 s late (its reaction time).
  - Shots are aimed by hand: it leads where you will be when the shot arrives (by flight time), with an error that grows with distance. You can dodge them.
  - It reacts to your incoming spells only sometimes (a skill chance), and late.
- **Movement like a player:**
  - Run speeds are close to yours: Vesk 5, Morrow 4.2, Sola 5.4.
  - It keeps its range, strafes, hops, follows you up onto ledges and gets out of corners.
  - A **Reposition** tactic takes it to a flank or a platform without casting.
  - Movement spells: grapple, blink, Featherweight, raising its own ledge, Kinetic Stride.
- **Resources:**
  - Mana: it keeps a reserve and refills from its own mana zone (*Mana Well* / *Quarry Well* / *Ember Well*: it stands in it and draws it in).
  - Clearing: it lets go of stale spells that are far away (*Tidy Up*), but never a set-up it has just made.
- **Reinforcement counts for them:** a mage's self-reinforcement (for example Vesk's Null Aura) gives it the same damage resistance it gives you.
- **Condensed weapons:** up close it conjures a compressed weapon (Vesk's gauntlet, Morrow's maul, Sola's blade), holds it in its hand and swings it.

### What each mage does

**Vesk, the Tether Weaver** (Kinetic + Anti-Magic):

- **Cage:** kinetic nodes placed on paths that don't run through you, woven into tethers, then collapsed onto you.
- **Snare and Punish:** a tether shot that lodges in you, then a lance.
- **Bank Shot:** a shot aimed at your mirror image under the floor, so it bounces up into you.
- **Mirror Wall:** two stacked nodes woven into a kinetic wall that throws your spells back. They can now hurt you.
- **Null Ward:** erases your incoming spell.
- **Null Aura** *(new)*: Anti-Magic reinforcement on himself, an aura that eats magic plus toughness.
- **Null Field** *(new clear spell)*: an Anti-Magic zone that eats your zones, tethers, wells and parked energy around him. He uses it when your set-up is near him.
- **Movement:** grapple away or up to high ground, and Kinetic Stride.
- **Melee:** a condensed gauntlet.

**Morrow, the Gravewright** (Construction + Gravity):

- **Pin and Drop** (reworked):
  - The Gravity Well is now conjured right on you (Generate → *at current target*) and anchored there. It drags you back hard: at your run speed you move at about half speed.
  - Then the **Grave Spike** is raised high over his head, carried over you while it keeps adjusting, and built point-down with a gravity core. It drops and sticks in the ground.
  - It travels high, so his own well can't bend it any more. When it's done he lets the well go.
- **Bulwark** *(fixed)*: the wall is now built upright and anchored on the ground. It used to be built lying flat as a slab, which is why walls appeared under him.
- **Hurled Stone:** a cube construct thrown with its gravity core.
- **Recycle:** dismantles his old constructs and fires the energy at you.
- **Stone Shards:** a 3-spike fan.
- **Crushing Field:** a gravity zone that makes you heavy.
- **High Ground:** raises a ledge and steps up onto it.
- **Featherweight:** low-gravity reinforcement.
- **Crushing Court:** opens faster now (1.4 s draw); he opens it when you're close, especially while you're held in his well.

**Sola, the Ember Cartographer** (Thermal + Spatial):

- **Frost then Fire:** a chilling bolt, then a fireball that bursts near you.
- **Ember Fan.**
- **Minefield:** mines between you, followed by *Trap Spring* (detonating them) when you're near.
- **Displace into Trap:** a portal opened on you drops you over her mines or scorched ground.
- **Scorched Ground:** a thermal zone on you when you camp.
- **Flank Gate:** arrows through a portal into your back.
- **Blink Out / Blink Behind.**
- **Mirror Gate** *(new reaction)*: a portal opened in front of her with its exit behind you, so your own spell comes out into your back.
- **Melee:** a condensed blade.

### Engine

- **A different caster's portal turns your energy against you:** energy carried through another caster's portal can strike its own caster.
- **Kinetic cords:**
  - A kinetic cord that flings another caster's energy back also turns it against its caster.
  - One cord turns an energy only once per frame. Two cords along the same line (energy tied to each other both ways) used to turn it straight back.
- **Zone laws follow their caster's side:** an enemy caster's zone law sees that caster's foes, so their thermal ground burns *you*.
- **Mages and constructs:** a rune mage standing on or pressing against constructs no longer damages them.

### Dungeon

- **Enemy chill / slow on you:** an enemy caster's chill or slow now slows you.
- **Every hit lands:** mage hits carry their status effects, and every hit lands (your old invulnerability window is restored afterwards).
- **Mage Arena floor:** the floor is deep, so the fight happens above the hotbar.

### Tests

- 183 engine checks (MG1 portal turn, MG2 single cord turn), all passing.
- **`RuneMages.selfTest()`:** each mage duels a bot that runs at about your speed, strafes, jumps and shoots back, for 30 s. Each must use varied tactics and land damage, and fewer than 60% of its casts may be plain shots. All 6 checks pass.
- **`RuneMages.duel(kind, seconds)`:** returns casts, damage by spell and the tactics used.
- **In the browser:** fights against a strafing / shooting player bot for each mage, and all three at once. No errors.

## Gentler gravity on creatures, mana zones the mages really use, no "invalid" in the forge (c41)

### Gravity is less effective on enemies

- **Weaker, capped pull:** Gravity energy and Gravity fields now pull creatures at 40% of the old strength, and never faster than 0.9 px per frame.
  - A well slows a creature down; it no longer locks it in place.
  - A slow enemy (1.5 px/frame) still crawls out at about a third of its speed. A 2.5 px/frame enemy keeps about two thirds.
  - You (and other fast movers) are barely held.
- **Unchanged:** the pull on energy, projectiles and constructs, and the pull on yourself.
- **Applies to enemy casters too:** this includes Morrow's well on you, which now slows you rather than pinning you.

### Mages really use their mana zones

- **Before:** a mage's mana zone (*Mana Well* / *Quarry Well* / *Ember Well*) dissolved half a second after its energy was drawn in, leaving its energy unused. Also, the "drain" only lowered a number that the engine recalculated from the zone's blobs every frame.
- **The zone lasts:** the spell now holds its zone for 12 s.
- **The mage draws the energy in:** standing in its zone (or close to it), the mage pulls the zone's blobs to itself in a visible stream.
  - Each blob that reaches it is used up and becomes mana (×1.3).
  - A full zone (about 150 E) is drained in about 4 s, and the zone shrinks as it empties.
- **Better use of the zone:**
  - Mages step back into their own zone to refill while it still holds energy, and stay in it.
  - They cast a new one when their energy drops below 60% (it was 35%), but not if one is already out.

### The spell forge never says "invalid"

- **Rune picker tags:** when a rune doesn't fit a slot yet, its tag now says why: *needs energy*, *needs target*, *needs a zone*, *needs more Control*, *locked*, *wrong energy*, *set options*, *too many rules* or *needs set-up first*. The tooltip shows the full reason.
- **Rune option messages:** these are plain now, for example "Duration must be between 3 and 20", "Power cannot be 0 — pick a positive or negative power", "Choose an option for Shape".
- **Other messages:** casting an unfinished spell says "This spell is not finished yet". A bad pasted spell code says "That spell code could not be read".

## Trademark zone spells, Vesk becomes Kinetic + Light, no weapons or reverse techniques, kinetic cords you can stand on (c42)

### Rune mages

- **No more condensed weapons:** the gauntlet, maul and blade are gone, along with the brawling tactics. Up close each mage now has its own answer:
  - **Vesk — *Flashpoint*:** a burst of Light all around him that dazzles you, then he grapples away.
  - **Morrow — *Stonewall*:** a wall between you, then he backs off and throws shards.
  - **Sola — *Blink Out*:** she blinks away.
- **No reverse techniques:** every power in every mage spell is positive. Removed:
  - Sola's Frost Bolt (*Frost then Fire* became *Fan then Fire*);
  - Morrow's Featherweight (reverse gravity);
  - Morrow's Recycle (reverse construction).
- **Mana zones replaced by trademark spells:** each trademark is a single spell of 22–28 runes, with delays and conditions.
  - It draws a large zone (radius 300–320, about 420 E), then turns that energy into the mage's signature attack.
  - The mage keeps fighting while it plays out. Each spell has its own cursor, so the mage's other spells don't disturb where the trademark aims.
  - Spells that use Draw Out wait until the trademark's zone is done.
  - The trademarks:

    | Mage | Trademark | Runes | What it does |
    | --- | --- | --- | --- |
    | Vesk | **Lumen Loom** | 24 | The zone's energy is woven into a crown of 6 kinetic nodes above Vesk, tethered together. Vesk fights from under it. Come within 170 px and the crown flashes into Light lances that fly at you. A fan of 3 Light lances is drawn from the zone. After 9 s whatever is left of the crown falls on you as light. |
    | Morrow | **Cathedral Fall** | 28 | A row of 5 greatswords is carried high over where you'll be, built point-down and weighted with gravity cores, so they fall and stick in the ground. A fan of 3 stone spikes from the zone drives you under them. Then a great hammer is built over you and dropped. |
    | Sola | **Ember Orrery** | 22 | A ring of 6 burning stars forms around Sola, tied together with burning cords. A portal opened on you drops you into the middle of it. 0.6 s later the stars hurl themselves at you and burst. A fan of 4 ember arrows follows from her zone. |

- **Vesk is Kinetic + Light** (Anti-Magic is gone):
  - New: **Prism Lance** (a Light lance at 18 px/frame that pierces and dazzles) and **Flashpoint**.
  - Removed: Null Ward, Null Aura and Null Field.
  - His web, snare, bank shot, mirror wall, grapple and stride are unchanged.
- **Morrow's Stone Shards** are now a 4-spike fan.

### Kinetic tethers you can stand on

- **A slow touch is a solid line:** a kinetic cord touched gently (moving into it slower than 6.5 px per frame) is just a solid line. From above you stand on it and can walk along it and jump off it; from the side it stops you.
- **A real impact bounces you:** a fall, a dash or being thrown makes it a trampoline.
  - Land on it hard and you're launched back up with most of your fall speed (×0.85–1.0, capped at 22 px/frame), so the bounces die down unless you keep jumping.
  - From the side, a hard hit bounces you back off it.
- **Enemies:** only a hard hit (over about 10 px/frame) also hurts an enemy a little. A cord no longer bounces you over and over while you just stand near it.
- **Tested in the browser:**

  | Situation | Result |
  | --- | --- |
  | Standing on the cord | Stays on it |
  | Walking along it | Stays on it |
  | Dropped from 260 px | Bounces about 220, then 190, then settles |
  | Jumping off it | Normal jump |

### Engine

- **One cursor per spell:** a caster can give each spell its own cursor (`owner.aimFor(instance)`), so several spells can aim at once.
- **Cord behaviour:** `CONFIG.cordBounceSpeed` = 6.5.

### Tests

- 184 engine checks: MG3 checks that a kinetic cord holds you on a soft landing and bounces you on a hard one.
- **`RuneMages.selfTest()`** now has 12 checks. Per mage:
  - its spells validate;
  - it has a trademark with 20+ runes and no reverse techniques or weapons;
  - it casts its trademark in a duel and lands it;
  - it fights with varied tactics.
- **Known weak spot:** against the always-strafing test bot, Morrow's damage varies a lot from run to run (his attacks are slow and get dodged).

## Mages read the field: constructs, more webs, Morrow clears his stone, Sola uses her portals properly (c43)

### Seeing constructs and portals

- **Before every shot:** the mage checks the straight line to where you'll be.
  - If a construct (anyone's) or a portal end is in the way, it doesn't fire into it. It moves for a clear line instead: around the construct's nearer end, over it if it's low, or a side-step and jump.
  - For portals, the shot is held back only when a portal would swallow it.
- **While walking:**
  - It feels for constructs ahead: it hops a low one (rise under 150 px) and stops at a tall one, remembering it so it can go around.
  - It never walks into a portal end by accident.

### Vesk weaves more webs

- **Cage** is now his main play (score 3.3+, cooldown 6 s, used whenever there isn't already a web around you):
  - four nodes boxed around where you'll be;
  - the two far nodes are a new *arcing node* that first rises over you and then drops to its corner, so its path never runs through you;
  - the nodes are woven into a box of kinetic tethers: the sides stop you and the top bounces you;
  - it holds while you're inside (or for 2.6 s), then collapses onto you.
- **Tripline** (new): when you're running, two nodes and a vertical tether land across your path.
- **In a 45 s duel:** 15 nodes, 3 weaves and 2 collapses, against 2 cages before.

### Morrow lets his stone go

- **Clear the Field** (no reverse technique; he just dissolves his own constructs) takes away:
  - a construct of his that blocks his way or his line to you;
  - the one you're standing on;
  - the oldest ones beyond four.
- **Fewer builds:** he stops building walls, ledges and thrown stones at five constructs (was seven).

### Sola uses her portals deliberately

- **Fewer portals:**
  - Flank Gate only when she has no other portal open.
  - Mirror Gate and Displace only with fewer than 2 open; Blink with fewer than 3.
  - Blink portals are smaller.
- **She closes them when they're done:** Mirror Gate after 2.2 s, Blink 1.2 s, Displace 1.8 s, Flank Gate 4 s (kept open while she's still volleying), the Orrery's portal 1.6 s. Open portals no longer pile up in her way.
- **Shots through her own portals:** a shot solver works out, for each end of her portals, where the shot would come out and whether that line passes within about 34 px of where you'll be by then.
  - When it does she shoots into that end, and prefers it 65% of the time even when a direct shot is clear.
  - When a portal would swallow a direct shot and no portal route lines up, she doesn't waste the shot; she moves.
- **Flank Gate:** the entrance now opens 120 px behind her, and she stands still while it opens (before, she could back into it and send herself across the arena). The volleys go through the solver, so they go into the gate only when it lines up with you.
- **Portal Step** (new): if one of her portal ends is near her and its other end is well away from you, she walks through it instead of casting a new Blink.
- **In 45 s duels:** her damage roughly doubled (to about 200 to the stand-in player), and far fewer shots are lost to her own portals.

### Ember Orrery: bigger and dodgeable

- **Larger:** the zone is now radius 440 (was 320) and the ring of stars radius 220 (was 140), centred 200 px above her.
- **Slower to close in:** when you're inside or close (within 290 px), the stars hold for 1.8 s (was 0.6 s), then come at you at 55% speed and burst. You have time to get out after the portal drops you in.

### Engine

- **`W.breakConstruct(c, why)`:** a caster lets one construct go; it breaks up and nothing is recovered.

### Tests

- 184 engine checks; `RuneMages.selfTest()` 12/12.
- **Duel counters:** `m.stats.via` counts direct shots, shots through a portal, and shots held back because a construct or portal was in the way.
- **In the browser:** the Orrery ring forms wide around her, the portal drops you into it, and the stars launch about 1.8 s later. No errors with all three mages at once.

## Boss: Aster Vael, the Boundless — Infinity + Gravity (c44)

A boss in the Mage Arena (new button marked BOSS). He's an original character whose moveset follows the "limitless sorcerer" archetype: an untouchable Infinity layer, attraction, repulsion, the two forced together into erasure, and a domain that overwhelms your mind. He is fast, blinks constantly and hits far harder than the three mages. His techniques are innate (boss-side code), not forge spells, though his Infinity layer is real to the engine.

### Stats

- **4200 HP** (mages 700–1000). Run speed 7.6 (×1.2 in phase 3); reaction 0.12 s; 0.12–0.6 s between moves.
- **Phases:** 1 above 60% HP; 2 below 60% (adds Violet Void, Maximum Azure, the domain, floating); 3 below 25% ("Unbound": 28% shorter cooldowns, faster, Azure → Crimson chains, a bigger Violet Void).
- **Boss bar** at the top of the screen, with a second bar for the strain the Boundless can still take.

### Boundless (passive Infinity)

- **Your energy slows as it approaches and never arrives.** It's a real Infinity field fed to the engine (`W.infSources`), so the engine draws its rings, slows your spells and your projectiles, and pushes you back.
- **Your blows stop short:** melee and any damage that reaches him while the layer is up do nothing (hooks in the magic damage path and in melee `deal`). His stun and knockback are cancelled too.
- **Ways through:**
  - **Strain it:** every blocked hit adds strain (320 / 280 / 240 by phase, easing at 55 per second). At the cap it **shatters for 3.5 s**.
  - **Anti-Magic:** energy with Anti-Magic touching the layer cuts it for 2.5 s.
  - **Your sure-hit domain:** while he stands inside it, the layer is off.
  - **His own lapses:** 1.4 s after he fires Violet Void, and 2.5 s after his domain ends (burnout; no Azure or Crimson then either).
- **While it's down** he is stunned and knocked back only briefly (stun capped at 12 frames, knockback at 8).

### Moves

| Move | What it does |
| --- | --- |
| **Azure Collapse** (attraction) | A collapsing point just past you that drags you in (about 3.1–3.6 px per frame near it; you can walk out). It pulls your spells in and crushes those that reach its centre, then pops. He often blinks in after it with Azure Strikes. |
| **Crimson Repulse** (repulsion) | A charged red orb (0.52 s wind-up) fired at where you'll be. It bursts on contact: up to 58 damage and you're hurled away. It shoves your spells aside and cracks your constructs. |
| **Point Blank** | Up close: an instant Crimson burst at his hand (0.22 s). |
| **Azure Strikes** | He blinks behind you, gravity holds you in reach, and three blows land (17, 17, then 32 with a launch). |
| **Maximum Azure** (phase 2+) | A huge gravity star forms over you, drifts after you and sinks. It pulls you up and in, erases your spells inside it, crushes your constructs, then slams: 78 damage. He follows up with Crimson. |
| **Violet Void** (phase 2+) | Blue and red orbs in each hand converge over a long, loud 1.3 s wind-up, then a violet sphere (radius 72; 108 in phase 3) flies at you. It is only half-led, so step off the line. It erases every spell and construct of yours on its path and hits for 150 (190 in phase 3). |
| **Azure → Crimson** (phase 3) | Drags you to a point in front of him, then repels you from that point; may chain into Violet Void. |
| **Domain: Endless Expanse** (phase 2+) | 0.95 s of crossed fingers, then a 560 px starfield dome for 6.5 s. If you're inside when it opens you're **stunned** for 2.2 s (2.6 s in phase 3), then he lands strikes and a Crimson. Inside the dome his Azure lands on you and his Crimson homes. **Counters:** your own domain (a clash, 1 s stun) or an Anti-Magic shield on you (0.7 s). Afterwards he burns out (above). |
| **Blink** | Instant teleports with after-images: to close a long gap, and to dodge Anti-Magic, or anything when his layer is down. |

### Look

- An original design: a long open midnight-blue coat with silver lining, a high collar, short dark hair swept back, and a halo ring of six turning points behind his head. The halo greys out while the Boundless is down.
- He's drawn a head taller than a mage.
- His tells show in his hands: a blue or red charge, the two orbs converging for Violet Void, crossed fingers for the domain.

### Game hooks

- **dungeon.html:**
  - `blastPlayer` (a hard throw, up to 22 px / frame);
  - `stunPlayer` (sets `player.stunTimer`);
  - `magicDamageEnemy` asks `en.blockHit`;
  - the boss button in the spawn panel.
- **melee-combat.js v42:** `deal` asks `en.blockHit`.
- **magic-engine v54:** `W.infSources`, a list of functions that return extra Infinity fields each frame.

### Tests

- `RuneMages.selfTest()` adds 5 boss checks:
  - the layer holds off the bot's spells;
  - he uses 6+ moves and blinks across all three phases;
  - he deals 900+ in a 45 s duel (about 1400, against about 200 for Sola);
  - Violet Void erases your anchored energy;
  - your energy never reaches him through the engine's field.
- **Engine:** 184 / 184.
- **In the browser:** all three phases and every move, no errors.

## Aster Vael now casts real rune spells, and the Colour rune (c45)

Every one of the boss's attacks is now an ordinary rune spell from his own spell book (`KINDS.aster.spells`). His spells are validated against his profile like the mages' are, and cast through the same engine as yours. The boss-side orbs, the hand-made barrier and the scripted stun are gone. Each spell is coloured with the new **Colour** rune, so his attraction reads blue, his repulsion red and his erasure violet.

### His spells

| Spell | Runes | How it is built |
| --- | --- | --- |
| **Boundless** | 10 | 560 E → Spatial → Compress 24 → Infinity → held → Colour white → Draw Out 360 from the source → Reinforce → Target self. This is the same Spatial Infinity layer you can build. |
| **Azure Collapse** | 10 | A Gravity +7 Infinity source formed in his hand (560 E → Compress 22 → Gravity → Infinity, coloured azure). 220 E is drawn out, placed just short of you, and Discharged after 1.6 s (it implodes). |
| **Crimson Repulse** | 10 | The same with Reverse Gravity −7 (crimson): 200 E drawn out, fired where you'll be, discharged when it reaches you (Enemy near 64). |
| **Point Blank** | 9 | Crimson discharged at his hand. |
| **Azure Strikes** | 16 | He blinks behind you. Three Kinetic fists (30 / 30 / 56 E, compressed fist shape, azure). |
| **Violet Void** | 18 | Azure and Crimson energy sent to one point in front of him, each made an Infinity source there. Opposing Infinity tears space: a spatial rupture. Spell Memory "Infinity combined" → Colour violet → Target enemy → Redirect ×3 (a rupture turns only 40% per Redirect). It erases every spell it touches. Phase 3 casts **Violet Void: Unbound**, from 720 E halves. |
| **Maximum Azure** | 11 | 560 E sent over your head and made an Infinity source there. 320 E is drawn out (it lifts you toward it), sinks onto you and is discharged. |
| **Domain: Endless Expanse** | 18 | Zone 380 → Draw Out 480 from the environment → Domain (closed, 6 s, sure-hit, **opens with Overwhelm**). Rules: a white kinetic fist every 0.8 s; a crimson repulsion burst whenever you move; an azure well every 1.7 s. |

- **Phase 3 chains:** Azure → Crimson aimed at the same point. When the two meet first they can tear space themselves: a Violet Void that emerges from the two colliding.
- **Releasing his sources:** he lets each Infinity source go a moment after drawing from it (`SRC_LIFE`). A Blue or Red that found nothing to burst on fades after about 4.5 s.

### The Boundless is the engine's Infinity layer

- **Up:** the layer counts as up while he holds an Infinity reinforcement (`st.inf > 0`) that isn't suppressed. Its rings, the slowing of your energy and the push-back are all the engine's own.
- **Hits drain it:** whatever still reaches him is nullified, but it drains the layer's energy (×0.9). At 0 it **shatters**, and he recasts it after about 3.5 s.
- **Anti-Magic** suppresses it (the engine's rule).
- **Your sure-hit domain** around him suppresses it.
- **It lapses** for 1.6 s while he forces the Violet Void together.
- **Domain burnout:** his domain has the engine's burnout (no techniques, so no spells, for about 6 s). During it the Boundless is down and he keeps his distance.

### New in the engine (for everyone)

- **Colour rune** (new category: Appearance):
  - Colours: Technique colour, Azure, Crimson, Violet, White, Void, Gold, Ember, Rose, Emerald, Cyan, Frost.
  - The energy's glow, trail and burst take the colour, and so do the technique's own drawing (flames, the gravity disk, the rupture) and anything split, divided or drawn out of it (zone blobs, Infinity sources, Draw Out pieces).
  - Nothing else about the spell changes. Cost 1.
  - **Forge:** a grid of swatches.
- **Gravity drawn out of an Infinity source** (attraction only) is stronger:
  - it reaches 35% further;
  - it drags creatures with 3× the pull, capped at 4× the usual 0.9 px/frame;
  - it crushes creatures at its core (every 0.25 s).
  - Ordinary gravity is unchanged (it still only slows creatures).
- **Discharged Gravity:**
  - Reverse Gravity throws everything in the burst away; Gravity drags it inward.
  - Drawn from Infinity, Reverse Gravity is a **hard throw** (knockback ≥ 22 frames, which the game turns into a real launch of up to 22 px/frame instead of the short capped shove).
  - Your own energy nearby is pushed or pulled too.
- **Domain Expansion → "As it opens: Overwhelm"** (+30 cost):
  - Every foe inside when it opens is stunned for 1–2.5 s; a more refined domain stuns longer.
  - A foe with a domain of their own (a clash) shrugs off 60% of it. An Anti-Magic shield caps it at 0.6 s.
  - New status `stunned`: the player's `stunTimer`, or a creature's `stunTimer`.
- **Fix:** a spatial rupture hit the wrong side when an enemy caster made it (it used the player's foe list). It now uses its own caster's view, and its backlash on the caster goes through that caster's view.
- **Rendering:** a tinted body is excluded from crowd stamps. A technique's fixed colours are mapped onto the tint while it is drawn (`ME.tintHex`; hue and saturation from the tint, lightness from the original, greys kept). It's cached and costs about 0 when nothing is tinted.

### Game hooks

- **dungeon.html:**
  - `knockback` with frames ≥ 22 launches the player hard;
  - `applyStatus('stunned')` sets `player.stunTimer` and says "Overwhelmed!", "Domain clash" or "Your Anti-Magic shields your mind".
  - The c44 `blastPlayer` / `stunPlayer` hooks are removed.
- **Damage:** the boss's spells hurt you ×0.32 (`K.dmgScale`); the mages stay at ×0.3.

### Tests

- **188 engine checks.** New:
  - IG1: Colour propagation.
  - IG2: Infinity Gravity drags 142 px vs 41 px for ordinary gravity, and crushes.
  - IG3: Reverse Infinity Gravity discharge is a hard throw.
  - IG4: Overwhelm stuns (2.5 s).
- **Boss selfTest (6 checks):**
  - the book validates (9 spells, all coloured);
  - a real Violet Void erases your ward and hits;
  - Boundless is a real layer;
  - duels use 6+ spells across 3 phases.
- **In the browser:** about 55 fps with the boss, and no errors. The forge shows the Appearance → Colour swatches.

## Aster Vael: his own models, a vast brief domain, and planned combos (c46)

### His attacks look like his

His energy is still ordinary engine energy (same physics, same rules). Only how it is drawn changed: the engine now supports **skins** (`MagicEngine.registerSkin(name, fn)`, drawn instead of the body and its technique overlays). Every frame he dresses his own energy in his models:

| Energy | Model |
| --- | --- |
| Azure (Infinity Gravity) | A pinpoint of black inside blinding blue. Spiral streaks of space fall inward, rings close in, debris is dragged along the spiral. |
| Maximum Azure | The same at 2.2× scale. |
| Crimson (reverse Infinity Gravity) | A small white-hot star in red. Rays flare outward, rings push away, plus a horizontal lens streak. |
| Violet Void (the rupture) | A sphere of black-violet nothing, wound with bands of violet light. A blue and a red wisp still turn inside it, it crackles, and space closes in its wake. |
| His Infinity sources (in hand) | A small bright core of the colour it will become: blue, red, or white for Boundless. |
| Energy on its way (Void halves, the Max Azure seed) | A comet of its colour. |
| Azure Strikes | A pale-blue fist of force with a shock crescent ahead of it. |

Arena: 60 fps with the boss fighting. Skinned bodies skip crowd stamps.

### Domain: vast and brief

**Endless Expanse** is now a radius-820 zone (Draw Out 520 E). The domain is closed, with a sure-hit and a **Brief** vow (it lasts about 1.5 s). It opens with Overwhelm and has **no rules**: the Overwhelm is the attack, and he follows it with one Azure Strikes. Burnout afterwards is about 5 s.

### He plans instead of firing at random

He now picks **plans**: moves that work together, with waits between them. After each plan he rests 0.7–1.1 s (phase 1), 0.55–0.9 s (phase 2), or 0.4–0.7 s (phase 3). He used to rest 0.12–0.6 s between single moves.

| Plan | Steps |
| --- | --- |
| Lapse Strike | Azure is placed just short of you to drag you toward him; when it has you (or has imploded), Azure Strikes. |
| Repel | Crimson aimed where you'll be. |
| Point Blank | Up close: a Crimson burst at his hand. |
| Blink Combo | Azure Strikes (the last fist knocks you away), 0.45 s, then Crimson where you land. |
| Void (phase 2+) | Violet Void. |
| Collapse and Void (phase 2+) | Maximum Azure lifts and holds you, 1.1 s, then the Void is sent at you. |
| Domain (phase 2+) | Endless Expanse, wait until it opens, one Azure Strikes. |
| Blue then Red (phase 3) | Azure, wait until it has imploded, then Crimson. |
| Limitless (phase 3) | Azure → Strikes → 0.5 s → Violet Void. |

- **He never fights himself.** A projectile move (Azure, Crimson, Maximum Azure) waits until his own last Blue, Red or nearby Void has done its work; after 2.5 s of waiting the plan is dropped. His Blue and Red are therefore never out together, so they can't drag, push or accidentally tear into each other.
- **Cleanup:** a Void is let go after 3.4 s. A Void that has passed you (more than 520 px away) no longer holds him up.
- **Move tells:** every move has a wind-up of 0.12–0.6 s.

### Tests

- 188 engine checks.
- **Boss selfTest (7 checks, 60 s duel):** a new check counts frames with his Blue and Red out together and ruptures he didn't mean (both 0 in every run), and expects 5+ plans.
- He deals about 650–1100 in 60 s against the practice bot (about 3–5× a mage).
- **In the browser:** no errors, 60 fps.

## Hollow Purple is fast and only Anti-Magic can undo it; a domain fuelled without Draw Out (c47)

### Hollow Purple (a spatial rupture), for everyone (the boss and you)

- **Much faster:** once sent it travels at up to **20 px/frame** (was 7). Each Redirect turns it 70% toward the new course (was 40%).
- **Nothing bends it:** once a Redirect sends it, it holds that course. Gravity, kinetic cords and Infinity can't pull it off. Infinity never slowed it, and a closed domain's barrier no longer stops or halves it.
- **It absorbs magic:**
  - **energy:** any non-Anti-Magic energy that touches it is swallowed, and the Void **grows** (+25% of what it swallows, up to 1.3× its starting size; it used to shrink);
  - **enemy projectiles:** swallowed;
  - **constructs:** it swallows them too (+15% of their material). An Anti-Magic construct wears it down instead.
- **Only Anti-Magic undoes it:**
  - Anti-Magic energy that touches it is consumed 1:1.5 against it (1 Anti-Magic removes 1.5 E of the Void); with enough, the Void is gone.
  - An Anti-Magic zone withers it, like other magic.
  - Its natural fading over a few seconds is unchanged.
- **One heavy blow:** it passes too fast to linger, so its first touch on each foe lands as one blow (3×); the 0.12 s ticks follow.
- **It ignores the Boundless:** your Hollow Purple goes straight through Aster Vael's Infinity and hurts him.

### Domain: fuel from your own energy

- New Domain options: **Fuel → "Your own energy, poured in as it opens"** and **Energy poured in** (120–1500 E, paid when you cast).
- The domain opens without any Draw Out.
- **Aster Vael's Endless Expanse** now uses it (520 E): Zone 820 → Domain, with no drifting pieces of energy.

### Tests

- **191 engine checks.** New:
  - IG5: the Void travels at 20 px/frame, isn't bent by a gravity well, and swallows raw energy;
  - IG6: enough Anti-Magic in its path consumes it;
  - IG7: a self-fuelled domain opens at once.
- **Boss selfTest (8 checks):** your Hollow Purple goes through his Boundless (he took 600 from an 833 E Void).

## Cast from your cursor's side, draw your own shapes, and three melee fighters (c48)

### Casting from the cursor's side

When you cast, your character turns to face the cursor and keeps facing it for about 0.4 s, even while moving the other way. The spell's energy appears at the hand on that side (about half your width plus 8 px out, at chest height). Before, it came from your centre and you faced the way you were walking.

### Compress / Shape: draw your own shape

- **"Draw your own"** is a new tile in the Compress rune's shape grid. It opens the **shape editor**:
  - **Tools:** Brush, Eraser (with brush size), Mirror (paints top and bottom at once), Move / resize.
  - **Shape palette:** every built-in shape plus Circle, Box, Triangle and Bar. Drag any of them onto the canvas, or click one to add it in the middle.
  - **Reshape:** drag a shape to move it, stretch it by its 8 square handles, turn it by its round handle (Shift snaps). Duplicate, Flip, Delete, Undo (Ctrl+Z), Clear. Keys: V / B / E.
  - **Result:** everything is merged into one outline, shown in pink. The energy flies to the right ("forward"). Only the largest connected piece is used, and the editor says so.
  - Editing a built-in shape starts from that shape. Your drawing is saved with the rune (`shapeDoc`), so "Edit your shape" reopens it exactly as you left it.
- **Engine:**
  - Compress gets `shape: 'custom'` and `poly` (the outline in shape space, about −2.4…2.4 by −1.6…1.6).
  - `MagicEngine.customShapeKey(poly)` registers the outline once as a real shape. Everything that knows shapes works with it: drawing, hits, constructs, items.
  - An undrawn custom shape is a spell error ("Draw your shape first").
- **Files:** `shape-editor.js` (new), loaded by inventory.html.

### Three melee fighters (Mage Arena)

Each has one technique and fights up close. They use the boss's planner: plans of moves with waits between them, each move a real rune spell or a step. Their blows are fists, hammers or blades thrown at point-blank range that burst where their reach ends.

| Fighter | Technique | Style | Loadout |
| --- | --- | --- | --- |
| **Kael, the Ironfist** (900 HP, fast) | Kinetic | Rushdown brawler | Jab, Iron Combo (3 fists), Rising Fist (launches you), Hundred Fists, Grapple Line, Kinetic Stride (legs), Kinetic Guard, Shockwave |
| **Brannoc, the Hearthbreaker** (1200 HP, slow) | Thermal | Heavy bruiser | Hearth Hammer (explodes at the end of the swing), Cinder Sweep, Eruption (the ground under you bursts after 0.9 s), Frost Breath (slows), Scorched Ground, Ember Guard, Furnace Leap |
| **Sythe, the Rift Dancer** (760 HP, evasive) | Spatial | Hit-and-run duelist | Rift Cut, Crossing Cuts, Severance (a 3-blade fan), Rift Step (behind you), Displace (pulls you in front of her), Rift Mirror (a reverse-Spatial surface that bounces your spells back); steps out of spells through space |

**Their plans:**
- **Kael:**
  - Rush In: grapple, then a combo the moment he arrives.
  - Jab into Combo.
  - Launcher: up you go, he jumps after you and finishes the combo.
  - Hundred Fists.
  - Break Free: a shockwave and a backstep when you're beating him up close.
  - Guard Up and Stride: buffs.
- **Brannoc:**
  - Overhead.
  - Sweep and Smash.
  - Freeze and Erupt: Frost Breath slows you, then the ground under you erupts.
  - Eruption.
  - Scorch: when you keep your distance.
  - Leaping Slam: he leaps onto you and swings on landing.
  - Ember Guard.
- **Sythe:**
  - Lunge: step behind you, two crossing cuts, one more cut.
  - Cut and Away.
  - Pull and Cut: Displace, then cut.
  - Rift Mirror: when you cast or a spell is coming.
  - Severance.

**Movement:** they keep to arm's reach during a plan and circle you between plans. They jump to you when you're above them and hop over obstacles, and they dodge with a skill chance (Sythe steps out of the way through space). Their leftover energy fades after about 4 s.

**Look:** no staff. Kael has glowing gauntlets (one cocked back during the wind-up), Brannoc a great hammer raised over his shoulder and brought down, Sythe twin blades of folded space. Each move shows a wind-up ring.

**In 30 s duels against the practice bot:**
- Kael: about 230–520 damage;
- Brannoc: about 300–500;
- Sythe: about 90–200.
- Most of their damage comes from blows (≥ 74%).

### Tests

- **192 engine checks.** New SH1: a drawn shape becomes a real shape, and an undrawn one is flagged.
- **selfTest:** for each fighter, its spells validate (one technique), and it fights up close with planned combos (melee share and 4+ plans).
- **In the browser:**
  - casting while moving right with the cursor on the left: you face left, and the energy appears 27 px to your left;
  - the shape editor opens, takes a dragged Sword, a brush stroke and a resize, and the rune reads "your shape";
  - all three fighters fight, with no errors.

## c49 — Melee fighters use the player's melee combat; Sythe's rift lands beside you

**Kael, Brannoc and Sythe now fight with the same melee system you do.** Their old point-blank spell "blows" are gone.

- **Weapons:** each one swings a real weapon from your arsenal, using its own attack data:
  - Kael: gauntlets;
  - Brannoc: hammer;
  - Sythe: daggers.
- **Same rules as yours:** every attack keeps its startup, active, cancel and recovery frames, as well as its hitbox, damage, hitstop, hitstun, knockback, lunge, plunge and hop. Whiffs leave them in a longer recovery.
- **Combos:** they chain strings in the cancel window (g1 → g2 → g3), and use launchers, air strings (nair → nair2), plunging down-strikes, heavies and specials.
- **Their blows hit you like a weapon:** knockback and a short hitstun (capped).
- **You can parry them:** parry (Q) just before the blow lands and they stagger for about half a second.
- **Spells are utility only:** Kael has Grapple, Stride, Guard and Shock; Brannoc has Guard, Frost trap, Eruption and Scorch; Sythe has Rift, Mirror and Displace. Every plan ends in weapon attacks.
- **Movement:** they dash to close the gap and walk right into reach for a string. Between blows they keep a body's width from you instead of standing inside you.
- **Look:** they are drawn with the player rig (robe tint, weapon pose per attack phase, a weapon trail) and show a stun indicator.

**Sythe's Rift Step:**
- The exit portal opens about 80 px short of you, on her side. She never lands on you.
- She goes through it in the same frame, and both portals are dismissed about 0.3 s after she passes through.
- She only rifts when you're more than about 170 px away.

### Tests

- **selfTest** (30 s duels against the practice bot):
  - Kael: 70 damage dealt, 100% from blows;
  - Brannoc: 328 damage, 84% from blows;
  - Sythe: 115 damage, 89% from blows.
- **Engine:** 192/192.
- **In the browser:**
  - all three fighters render with the rig and swing their weapons, with no errors;
  - the Rift Step lands her about 45–73 px from you, and its portals are gone afterwards;
  - parrying Kael's string staggers him.

## c50 — Your shape library

**Shapes you draw can now be saved to a library and reused in any spell.**

- **In the shape editor:**
  - Name the shape in the box at the bottom and press **★ Save to library** (or Enter).
  - **★ Your library** sits at the top of the shape palette. Each saved shape can be:
    - dragged or clicked into the current drawing, like the built-in shapes;
    - opened with ⤢ to bring back its full drawing (pieces and brush strokes) and edit it. Saving it again under the same name updates it, and a new name saves a copy;
    - renamed with ✎ (Enter or clicking away keeps the name, Esc cancels);
    - deleted with ✕ (click twice to confirm).
- **In the forge** (Compress / Shape):
  - a **★ Your shape library** grid under the shape grid: one click puts that shape on the rune, and the shape in use is highlighted;
  - **Manage…** opens the editor;
  - the "Your shape" card shows **★ Save to library**, or the library name if the shape is already saved.
- **Storage:** the library is kept in this browser (`magicBattle_shapeLibrary`), shared by every spell slot, and holds up to 80 shapes. Saving the same outline twice updates the existing entry.
- **Fixes:**
  - typing a name in the editor no longer triggers the tool keys (B / E / V / Delete) or game keys;
  - the palette's three columns no longer overflow.

### Tests

In the browser:
- saved two shapes and dragged a library shape into a drawing;
- opened a library shape to edit, renamed one, then picked it from the forge grid (it highlights);
- the library survives a reload;
- no errors.

## c51 — EmberFall map remade (the World Map's EmberFall, `mode=city`; the story-mode EmberFall is untouched)

**The whole map is rebuilt as one connected, hilly region (78,000 px wide).** It was a flat strip with a castle in the middle.

**The three map lines, now one world:**
- **Western Approach** (`seg=west`): Valedorn Fields with a windmill, Westmere Farm, the River Mill with its stone bridge and water wheel, terraced Mill Field, Thornwood Rise (an old tower and a cache), the Roadside Waystation and Gate Field.
- **EmberFall City** (default): the West Gate, West Town on a rise, the Arches viaduct over the Ember Run ravine (with a shrine and the Undercroft cellar below), the Market Square, the Craft Quarter and its stone-lined canal, and the Castle Approach climbing the crag.
  - On the summit: EmberKeep's gate and ward, the Royal Gardens and Chapel, the Postern Stair (with a waterfall) and the Arcanum Terrace.
  - Then the Hundred Steps down to East Town, the Training Yard, the East Bailey and the closed Eastern Gate.
- **King's North Road** (`seg=north`): North Field, Northwatch tower and camp, the Old Bridge (a timber trestle over a deep gorge, broken in the middle; the river runs below and the east wall breaks into rock steps), the Abandoned Farmstead, Pinewood and the Hunter's Camp, then the snowy Cold Approach to a shrine.
- **Crossroads:** pressing L at the crossroads by the city gate still jumps between the city road and the North Road.

**Terrain (`emberfall-world.js`):**
- Heightfield ground with slopes, cliffs, ravines, hollows and cut-in rooms.
- Topsoil sits over bedded rock everywhere; the crag and cliff faces are bare stone.
- Depth shading works by distance to open air, so cliff faces stay lit and deep ground goes dark.
- Roads over the crag sit on a stone kerb.
- Turf, ferns and shrubs grow in rock hollows, and moss and ivy hang over cliff lips.
- Water follows its banks.
- One-way bridge decks.

**Art (generated, `images/emberfall/`):**
- Soil, rock face (warm and cold), deep rock, four grass edge strips and moss.
- 46 flora sprites: oaks, birches, pines, snowy pines, willow, apple and blossom trees, bushes, hedges, ferns, reeds, flowers, rocks, boulders, vines.
- Building textures.
- Generators are in `tools/ef_*.py`.

**Buildings (`emberfall-art.js`):** painted once from those textures: timber-framed and stone houses with jetties, dormers, balconies, shutters, window boxes, signs and awnings; barns, a windmill, the mill, market stalls, walls, towers, gatehouses, the keep and bridges.

**Interiors:** all 29 doors open into cutaway rooms with furniture and stairs (`emberfall-interiors.js`). EmberKeep is rebuilt inside as a real keep on 7 levels (`emberfall-keep.js`):
- two tower stairwells;
- a grand stair;
- wings on either side;
- three levels cut into the rock: stores and treasury, the dungeon and sewer, and the ancient foundations;
- a hidden passage out to the cliff path.

**Life (`emberfall-life.js`):**
- 52 NPCs and 25 townsfolk walking their streets, with the existing NPC sprites;
- birds, butterflies, falling leaves, chimney smoke, a turning windmill and water wheel, bunting, lamps, snow in the north;
- sun rays, haze and parallax mountains;
- grass drawn over your feet.

**Performance:**
- the sky, haze, sun rays and vignette are cached;
- parallax bands are pre-scaled;
- terrain is painted in 1024 px chunks, with the next chunk painted ahead of time.

### Tests (browser)

- A bot walked each map line end to end without getting stuck. The only jumps it needed were the gorge's rock steps.
- Every door (29) enters and exits, and you land on the floor inside.
- L at both crossroads works, and every segment starts on the ground.
- Other modes load without errors: sandbox, sylvaris, stormislands, hub.

## c52 — Shape editor fix; PvP arenas with the rune engine and melee; a direct online link

### Drawing your own shape no longer jumps to another spell

**Causes:**
- **Keys leaked to the forge.** The forge's keyboard handler ran before the shape editor's, so keys typed while drawing reached the forge behind it: Delete removed runes, the arrows changed the selected rune, Ctrl+Z undid, and Enter opened the rune picker. Enter or Space could also click a forge button that still had focus.
- **Stale node.** Saving wrote into the rune object captured when the editor opened. An undo or re-render in between replaced that object, so "Use this shape" could land in a stale node, or in another slot's spell if the forge had moved on.

**Fixes:**
- The editor takes the focus while it is open and traps it. The forge ignores keys while the editor is open, and also the Enter or Space that closes it (the next 0.6 s).
- The drawing is tied to the rune by its id and to that forge session. Closing the forge closes the editor.
- Cancelling "Draw your own" with nothing drawn puts back the shape the rune had.
- Dragging a palette tile listens on the editor's own backdrop.

**Tested in the browser:** while drawing, Space, Enter, Delete, Backspace, the arrows, digits, Ctrl+Z / Ctrl+Y and letters change nothing in the forge. "Use this shape" plus Enter does not open the picker, the right slot saves the custom shape, and the library still works.

### PvP — three arenas the host chooses (`pvp-arena.js`, new)

**Choosing the arena:** when both players are in, the host gets an arena picker with live previews, and the guest waits and sees the choice.
- Rematches go back to the picker.
- Matches are best of three rounds; a knock-out ends the round.
- The main menu's PvP window has a new 🎯 Practice Arena button: all three arenas offline, with an optional rune-mage sparring partner.

**The arenas** each have their own style, hazards and weather:

| Arena | Look and layout | Hazards | Weather |
| --- | --- | --- | --- |
| **Emberforge Caldera** (Fire) | Basalt floors split by a lava moat, hanging iron platforms on chains, stalactites, lava falls | Magma vents throw fighters skyward on a warning; lava burns and bounces you out | Ember storm |
| **Frostveil Sanctum** (Ice) | Glacier temple: frost-brick floor, an ice dais and pillars, ice beams | Polished patches make you slide; icicles shake loose from the vault (shadow warning, then damage and a slow) | Snow, aurora |
| **Tempest Spires** (Storm) | Grassy stone isles adrift above a cloud sea, mossy undersides, floating ledges and a spire | Gusts push you across the gaps; lightning strikes the high ground after a warning; falling off is a knock-out | Rain, lightning flashes |

- Generated textures are in `images/pvp/` (basalt, ice, cloudstone; generator `tools/pvp_textures.py`).
- Hazards run on a shared clock, so both players see the same vent, icicle and bolt at the same moment.

**Your own spells and weapons fight the other player:**
- **Rune spells:** a cast is sent once as the spell (the full definition the first time, then a short hash), with its origin, aim and spawn point. The other client casts the same spell in its own rune world, owned by "the opponent": a caster whose foe is you, with their magic profile. Every rune works, including portals, zones, domains, passives, Draw Out, reinforcement and gravity. The client being hit decides the hits on itself (spell damage ×0.45).
- **Melee:** the opponent's attacks are rebuilt from the same weapon data. Startup, active and recovery frames, reach, lunges and aim all match, and they show on your character rig.
  - Your blows on them are sent with their damage, knockback and hitstun.
  - Parrying works across the network: a parried attacker staggers.

**Netcode:**
- **State:** a 14-number array, sent 20 times a second through the relay or 30 over a direct link, and immediately on a jump, landing, turn or stop.
- **Opponent movement:**
  - Each snapshot is replayed forward by half the round trip on a ghost body with the same collision.
  - Corrections ease out instead of snapping.
  - An attack that started half a round trip ago starts that far in.
- **Clock sync:** uses the lowest-delay ping samples.
- **Direct link (WebRTC, new in `pvp-net.js`):**
  - The relay carries the handshake, then state travels on an unordered, no-retransmit channel and events on a reliable ordered one.
  - This removes the server hop and the relay's rate limit. If a direct link can't open or drops, the relay keeps working.
  - The HUD shows "direct" or "relay" with the ping.
- **Testing:** `local=1` connects two tabs through a BroadcastChannel; `lag=ms` adds an in-order one-way delay; `nop2p=1` forces the relay.

### Engine fix

Draw Out into a zone that disappeared mid-draw no longer throws (`vessel` null).

### Tests

- Two-tab duel:
  - map choice reaches the guest;
  - movement sync;
  - a spell cast hits the guest;
  - three sword blows land;
  - two knock-outs end the match (VICTORY / DEFEAT);
  - the direct link opens.
- **Spell sweep:** 60 spells from all 7 rune-mage books cast across the network. Every one replicates, with matching energy counts on both sides.
- **Accuracy at a 158 ms round trip (relay):** the opponent is drawn within 5 px (median) and 11 px (worst) of where they really are. Over the direct link it is 1 px.
- 60 fps on all three arenas (headless).
- 192/192 engine checks; other modes still load.

## c53 — Gentler gusts; two new PvP arenas; gear and stats now drive rune spells

### Tempest Spires gusts

A gust used to add speed every frame, so a jump carried you much too far. Now:
- it pushes you toward a speed cap instead of adding to your speed;
- in the air the push is about half, capped at about 2.6 px per frame (on the ground it is 4.5);
- it never slows a player who is already moving faster on their own.

### Two new arenas (the host now picks from five)

| Arena | Look and layout | Hazards | Weather |
| --- | --- | --- | --- |
| **The Grand Colosseum** (open arena, 6000 px wide) | Sand floor framed by sandstone walls. Behind the fight: a podium wall with three gates, statues, braziers and pennants, tiers of arches with a crowd, an awning and sun rays. Five marble balconies at two heights. | **None** | Drifting dust |
| **Glowroot Cavern** (Earth) | A dark cave with a hanging ceiling of stalactites, a central basin pool, stalagmites, shelves, glowing mushroom caps and bracket fungi. Glowing roots, crystals and fungus light the dark. Your own spells light the dark too. | Rockfalls: dust and shaking first, then two boulders (12 damage and a short stun) | Spores |

- New textures `images/pvp/sandstone.png`, `arenasand.png` and `cavestone.png` (generator `tools/pvp_textures.py`).
- The camera framing is set per arena (`camBias`).

### Gear reworked for the rune spell system (`gear-system.js`, `gear-data.js`)

**How gear reads a spell.** Gear effects used to read phase spells (shape, behaviour, count, effects). They now read a rune spell's runes:

| Old idea | What it means for a rune spell |
| --- | --- |
| Burn | Thermal |
| Freeze / slow | Reverse Thermal (gravity also slows) |
| Stun / blind | Light, or a Domain |
| Poison | Anti-Magic |
| Mark / sticky | Bound energy |
| Count / barrage | The energy is Divided into 3 or more pieces |
| Rain | A divided Gravity spell |
| Orbit | Rotate |
| Homing | Target → enemy |
| Ground / stationary | Anchored energy, or a zone |
| Wall / summon | A construct |
| Nova / explosion | Discharge |
| Teleport | Spatial on yourself |
| Lifesteal | Draw Out |
| Multi-phase | A spell with several stages (Wait / Then chains, Split branches, Domains) |

**Every hook now runs on rune casts and hits:**
- the cast checks (Wild Pact, Echo Oath);
- energy cost (Last Ember, Glacier Tear, Sporeheart, gems), and paying with blood (Blood Channeler);
- cooldown (Broken Chronometer, Frozen Hourglass);
- on-cast counters (Heat, Furnace Burst, Unstable Core, rotation curses, Root Network, Attunement);
- damage multipliers;
- on-hit triggers (Eruption, Ashen Pact energy, Brittle, Predator, Thorns);
- Burn power, Freeze duration, healing, and kill triggers.

**Changes to how some effects work:**
- **One-shot bonuses cover the whole cast.** Retaliate, Scorching Echo, Echo Oath and Chorus Bind used to be spent by the first hit. A rune spell can hit many times, so these bonuses now apply to every hit of the cast they empower.
- **Size, duration, speed and mirror effects change the rune tree.**
  - Size (Rooted Casting, Growth, Attunement): Generate gives more energy (up to +60%), zones get wider (up to +50%) and Discharge bursts get bigger.
  - Duration: Domains last longer.
  - Speed: raises Redirect speed.
  - Mirror of Still Water casts a second copy at half the energy.
  - If the grown spell would break your limits, the spell is cast as written.
- **Frozen Hourglass:** rune cooldowns are short, so it now speeds up spells built from 8 or more runes by 25% (it used to trim cooldowns longer than 5 s).
- **Cryomancer's Mantle:** its damage reduction now needs one of your anchored, zone, construct or slowed spells to be active. Before, any cast triggered it.
- **Verdant Prism:** grows when you cast a spell that Divides or Splits.
- **Nightmare Hoarfrost:** its damage bonus now only applies to cold spells.
- **Effects that did nothing before now work:**
  - Root Sovereign's bonus for persistent spells;
  - the persistent-power gem bonus (Worldroot Gem);
  - the effect-duration gem bonus (Spore Gem), which now makes chills last longer.
- **The mythic relics' spell boosts** used to match shapes. They now read runes:
  - Lightstep Blade: +35% for Kinetic spells and weapon Reinforcement.
  - Void Nullification: +40% for Gravity and Discharge spells.
  - Chrono Shard: +35% for Spatial and Target-seeking spells.

**Text:** every item, variant, corruption and gem description now uses rune wording ("energy", Divide, Thermal, zones, Domains …), and the numbers still match the effects. Corruption effect lines read the same way, and the gem labels were updated (Direct-hit damage, Multi-stage spell damage, Domain duration, Energy cost).

### Your stats now drive rune spells

| Stat | What it does to rune spells |
| --- | --- |
| **Magic Power** | Every hit is scaled by (1 + 0.08 × Power) ÷ 1.8, so 10 Power (the start) is ×1 and 30 Power is about ×1.89. This includes your Burns, and still raises Max Output as before. |
| **Energy Control** | Rune capacity, zone size and the rest of the magic profile, as before. Gear Control bonuses count. |
| **Magic Defence** | Enemy rune magic (rune mages, the PvP opponent) hits you for 1 ÷ (1 + 0.015 × (Defence − 8)). At 30 Defence that is about 25% less. Defence still adds +6 max HP per point. |
| **Mana Regen** | Unchanged. |

**Vows on the slot:**
- Power: +12% per point.
- Energy cost: −5% per point, plus global mana efficiency.
- Cooldown: −8% per point.
- Elemental damage (Thermal, Light, Gravity, Anti-Magic): +7% per point.
- Crit chance: 5% per point, for ×2 damage (shown as a yellow "!" number).
- Spell Vamp: heals 3% of the damage per point.

**Classes:**
- Warrior: ×1.5 within 200 px, ×1.2 within 350 px.
- Ranger: up to +80% with distance.
- Archmage: +20% on elemental spells.
- Dominion: +40% on Domain spells.

**Other bonuses** also apply: same-shape domain +30%, Domain Vow power, and dungeon environment and Nightmare modifiers.

**Other casts:**
- Passive spells use the slot's cost vows.
- **PvP:** your caster multiplier (power, relic boosts, vows, gear) travels with each cast as `pm` (kept between 0.4 and 3), and the client you hit applies it. Distance-based class bonuses don't cross the network.

**The inventory's stats panel** now shows rune damage ×, Max Output, rune capacity, the largest zone size, the enemy-magic reduction and the HP from Defence.

**Not changed:** spell scrolls still hold old phase spells.

### Tests

- **Damage numbers:**
  - 100 base damage becomes 188.9 at 30 Power.
  - A Ranger hit from 580 px away does 158.
  - Glass Cannon does 135.
  - An Echo Oath bonus gives +22% to both hits of one cast and nothing to the next cast.
  - Other casters' damage is not scaled.
- **Casting:**
  - Rooted Casting grows Generate from 20 to 24, and Mirror adds a 10-energy copy.
  - Vows cut the cost from 24 to 19 and the cooldown from 13 to 9 frames.
- **Two-tab PvP (Colosseum):** the opponent takes 5.4 damage at 10 Power and 10.1 at 30.
- **Inventory:** the stats panel renders, and Void Nullification boosts a Gravity spell ×1.4.
- **Other checks:**
  - Duel on the cavern;
  - 60 fps on the colosseum, cavern and storm arenas;
  - 192/192 engine checks;
  - every mode loads without errors.

## c54 — An open Colosseum; arena previews that look like the arenas

- **The Grand Colosseum has no platforms now.** All five marble balconies were removed, so the whole arena is one big open sand floor between the two walls.
- **The arena picker shows the real arena.**
  - Each card's preview is now drawn by the game's own renderer, from where the fight starts:
    - the backdrop layers and decor;
    - the textured floors and platforms;
    - lava and pools;
    - weather and the arena's lighting (the cavern's darkness too).
  - Two caster silhouettes mark the two sides, in blue and red. A spawn outside the picture is pulled in onto the nearest floor.
  - **How it works:** the arena state is swapped out for one frame on an offscreen 2000×1140 canvas, then put back. Each arena is drawn once and cached, then scaled down to twice the card size so it stays sharp.
  - Before, the previews were flat coloured blocks on a backdrop. If textures are still loading, a quick backdrop sketch shows until they arrive.
- **Cache-busters:** pvp-arena v3.

## c55 — The northern open world: five new roads and their junctions

- **Five new 22,000 px segments**, each about the size of the North Road. Together they form the loop I5 → I4 → J4 → J5 → I5, plus the Millstream from I6:
  - **I6–I5, the Upper Millstream** (going north):
    - Places: the Old Lockworks (turning the sluice drains an alcove chest), Splitwater Bridge, and Rook's Den behind its vines.
    - People: Mara the Lockkeeper, Tovin's overlook, and the stranded traveller.
    - Foes: slimes, bandits, and thorn wolves.
  - **I5–I4, the Pineward Rise** (going north):
    - Pinewatch Lodge has journals and letters. Its storeroom is locked, and the key is under the woodpile.
    - Edda marks the trappers' caches on your map.
    - Reading the Broken Milepost's three stones reveals the twin-pines cache.
    - Also: Hollowmere, and the Coldstone Cut with its side passage.
    - Foes: wolves, moss wraiths, bandits, and the Barkhide.
  - **I5–J5, the Frostline Causeway** (going east): woodland gives way to snow.
    - Rimewater Crossing has a broken approach and a cache under the bridge.
    - The Frostline markers: a fallen stone hides a compass.
    - The Stranded Caravan: Orin's strongbox is up on a ledge.
    - People: Sella and the northern peddler.
  - **J5–J4, the Northwatch Pass** (going north): windy all the way up.
    - The Frostline Gatehouse has a two-floor guardroom with the scholar and a map, and Captain Hadrik's shop.
    - The Shivercut Mine holds Mira's pack. Returning it opens her goat-path rope past the ravine.
    - The Broken Supply Span has a low ledge route, a pillar cache, and the Span Warden.
    - Then the upper shelves and the high snowfield.
  - **I4–J4, the Highland Traverse** (going east): pines first, then rock and snow under the mountains.
    - The King's Aqueduct: walk the dry channel on top, or the lower path under it. Its support tower holds two floors of maintenance chambers with a cache upstairs.
    - The supply team: push three fallen rocks off the road and their dialogue changes.
    - A looted cart guarded by bandits.
    - The Glassfall Grotto:
      - a frozen waterfall with a cave behind the ice (ice formations, an abandoned camp, a glass-ice seam);
      - Brother Caldus's hut, where talking to him reveals a hidden ledge cache;
    - Eagle's Rest: sighting through the theodolite finishes Tamsin's survey and reveals a concealed cairn. There is also an eagle-spire nest for future flight.
- **Junctions at every crossing** (press L at the fingerpost):
  - I6, I5, I4, J5 and J4, and J6 as before.
  - Every arrival matches the height and climate of the place you left. All 20 crossings were tested.
  - The North Road's climate now ramps up from J6 instead of jumping, so leaving the city doesn't drop you into a cold sky.
- **Supporting features (also covered in emberfall-map.md):**
  - a climate system (zones, a cold sky, snow, flurries, wind drift, frozen water and falls);
  - new frost, snow and ice ground; log cabins with snowy roofs; landmark painters;
  - caves you walk into through their mouths;
  - task NPCs, hidden or flag-gated loot, push and use interactions (`when`), and props that can hide on a flag (`show`);
  - world enemies with names, and bandits;
  - World map: the five new map lines are clickable.
- **Cache-busters:** emberfall-art v3 (assets v=2), world/layout/north/interiors/life v2, city v43, the new frontier, layout and foe files v1.

## c56 — Dungeons in the open world's art, and an N map

- **The Fire, Ice and Earth dungeons now use EmberFall's art** (`dungeon-skin.js`). Collision and the tile grid are unchanged; only the look is new.
  - **Rock:**
    - Painted in 1024 px chunks from the open world's textures: rockface for Fire and Earth, rockface-cold for Ice.
    - Edges come out rounded and rough instead of square.
    - The rock darkens with depth, has a lit rim on top and a shadow underneath.
    - Each theme has its own veins: molten cracks that pulse in Fire, pale frost veins in Ice, faint glowing lichen in Earth.
  - **Floors:** every floor carries a surface strip, like the open world's grass: ash with embers (Fire), drifted snow (Ice), cave moss (Earth).
  - **Props:**
    - Painted flora stands on floors and hangs from ceilings:
      - Fire: basalt, ember crystals, charred trees, dripstones;
      - Ice: ice crystals, snowy rocks, dead trees, icicles;
      - Earth: ferns, mushrooms, green crystals, roots and vines.
    - Glowing props add light to DungeonVision.
    - New props come from `tools/ef_dungeon.py`.
  - **Platforms:**
    - Stamped platforms show as the same rock.
    - Moving platforms are rock slabs with the floor strip; rafts are lashed logs, ice floes or basalt.
    - Collapsing, thin-ice and growing platforms keep their kit art, so their warnings still read.
  - **Cave wall:** the deeprock texture with slight parallax, tinted per theme.
  - **Turning it off:** `?skin=0`, or `DungeonSkin.setEnabled(false)`, switches back to the old look.
  - **Fix:** a float rounding loop in the floor-strip tiling could freeze the page; it is fixed.
  - **Performance:** in headless tests, about 30 fps with the skin against 34–36 without. The backdrop is pre-tinted into a seamless tile.
- **Press N for a map of where you are** (`where-map.js`). It uses the main menu's coordinate grid, A–S by 1–13, over the coordinate map.
  - **Open world:** every EmberFall road is drawn on the map. The road you're on is highlighted, with a "You are here" marker placed by how far along it you are. The heading names the road, its two grid points, the nearest grid point, and the district or the room you're in.
  - **Dungeons and other places:** the marker sits on the place the dungeon lies under (Cinderwatch, Aurorafall, the Sylvaris Wildes…), with how deep and how far across you are.
  - **Closing and pausing:** N or Esc closes it. The game pauses while it's open, except in co-op.
  - The controls line now shows "N — Map".
- **Cache-busters:** emberfall-art v4 (assets v=3), fire-art v16, ice-art v7, jungle-art v3, ice-world v15, dungeon-skin v1, where-map v2, tutorials v2, tutorial-coach v1, emberfall-frontier v2, frontier layouts v2 (north v3).

## c57 — Straight roads without transitions, tutorials, Story Mode 1 removed

- **Roads that carry straight on are now one continuous road.** Before, you had to press L at the end of a road even when the next road continued in the same direction. Now you only press L to turn, just like at J6, where the Western Approach runs straight into the city.
  - **J6 → J5 → J4:** the King's North Road runs straight into the Northwatch Pass at the J5 shrine.
  - **I6 → I5 → I4:** the Upper Millstream runs straight into the Pineward Rise at I5.
  - **At the crossroads:** the mountain walls and the "straight on" fingerposts are gone. One fingerpost stays at each crossroads for the turn: at I5 east to the Causeway, at J5 west to the Causeway.
  - **Arriving from the Causeway:** turning onto either J5 road puts you at the J5 shrine facing the right way; turning onto either I5 road puts you at the I5 crossroads. Height and climate match, as before.
  - **New world positions:**

    | Road | x |
    | --- | --- |
    | Northwatch Pass | 78000–100000 |
    | Upper Millstream | 102000–124000 |
    | Pineward Rise | 124000–146000 |
    | Frostline Causeway | 148000–170000 |
    | Highland Traverse | 172000–194000 |

    The seams are dressed with snow and pines, so they don't show.
  - **Updated to match:** the junction table, the N map (`where-map.js` ROADS) and the grid-map links.
- **🎓 Tutorials** (`tutorials.js`), a new tab in the inventory. A **🎓 Tutorials** button sits on the main menu's Inventory card, and `inventory.html?tab=tutorials&t=<id>` opens a single guide.
  - **29 illustrated guides in seven groups:**
    - Getting started: welcome, controls, spell slots, stats and rank.
    - Rune magic: your first spell, the Rune Forge, a rune reference, connectors and conditions, compression and shapes, techniques, zones and Draw Out, passives.
    - Advanced magic: Anchor and tethers, reinforcement, Domain Expansion, Construction, Infinity.
    - Combat: melee, engraving and magical items, enemy mages and bosses.
    - Your mage: gear, vows, classes and loadouts, bestiary and dictionary.
    - The world: EmberFall, roads, junctions and the N map.
    - Game modes: dungeons, sandbox and the Mage Arena, PvP, raids.
  - **What a guide holds:** steps, key tables and tips, with diagrams where they help.
  - **Finding and tracking:** guides can be searched, previous / next buttons move between them, and read guides get a ✓ (`magicBattle_tutorialsRead`).
- **Story Mode 1 removed.**
  - **Main menu:** the Story Mode 1 card is gone. The world map moved into the Map card, which now has **World Map** and **Grid Map** buttons.
  - **World map:** the "Academy Grounds" location is gone, and EmberFall is labelled City.
  - **Old links:** `dungeon.html?mode=openworld` now redirects to EmberFall City. The old mode's code is still in the file, but nothing reaches it.
- **Cache-busters:** emberfall-frontier v2, the layouts north v3 and millstream / pineward / causeway / northpass / traverse v2, where-map v2, tutorials v1.

## c57b — Fix: PvP arena render error

- **The bug:** the Tempest Spires arena threw `Cannot read properties of undefined (reading 'concat')` every frame once its lightning bolts started.
- **The cause:** c54 added a second function named `floorAt`, for the arena-picker previews, and it replaced the arena's own `floorAt(x)`.
- **The fix:** the preview helper is now `snapFloorAt`. Tested: all five arenas run in practice without errors.
- **Cache-buster:** pvp-arena v4.

## c58 — Hands-on guided lessons; constructs that push, crush and never fling you

- **Guided lessons** (`tutorial-coach.js`, plus the 🎓 Tutorials tab). The tutorials now have you *do* things instead of only telling you about them.
  - **How a step looks:**
    - A coach card says what to do next.
    - A glowing ring and a bouncing arrow point at the exact button, rune, connector or setting.
    - Each step ticks itself off the moment you've done it.
    - A forge window left open over the next target (Techniques…) is pointed out first, with "press Done".
  - **Spell lessons:** you build a real spell in the Rune Forge, saved into an empty slot. The coach then takes you to the **Sandbox** to select it and use it on the training dummies. Lessons carry on across pages.
  - **The ten lessons:**
    - Moving and fighting;
    - Your first spell (an arrow);
    - Timing (a proximity mine with a "Wait until enemy is nearby" connector);
    - Techniques (a Thermal fire bolt, including investing the Technique Point);
    - Over-compression (a piercing spear);
    - Zones (fill a zone from the environment, then draw a shot out of it in a second branch);
    - Reinforcement (a passive armour on yourself);
    - Construction (build a platform and stand on it);
    - Weapons (combo, launcher, special);
    - Exploring EmberFall (talk, the N map, a building).
  - **In game:** the ring and arrow point at your hotbar slot and at the nearest training dummy. In the forge, the view pans by itself to a rune that's off screen.
  - **Controls:** you can Skip a step or Exit a lesson at any time. Finished lessons get a ✓ (`magicBattle_lessonsDone`).
  - **Reference guides:** they are still there under 📖, and each links to its guided lesson.
  - **Forge changes:** fields, shape buttons, options and the Techniques rows carry `data-key` / `data-v` / `data-tech` tags so the coach can point at them.
- **Fix: a construct could throw you to the far end of the map.** This happened in the Colosseum and in other platform worlds.
  - **The cause:** the construct's "is this spot free" test only sampled five points, so a construct could push you a few pixels into the floor. The floor's sideways collision then threw you out of its *far* side — 3,900 px across the Colosseum.
  - **The fix:**
    - The free test is now an exact rectangle check against tiles, platforms and the ground.
    - A body sunk into a platform is now lifted onto it, or pushed out the shortest way.
- **Constructs touch people more naturally:**
  - A construct moving into someone pushes them the way it's moving: a falling block lands on your head instead of popping you out sideways.
  - Shoved creatures take on the construct's motion, and you ride constructs that lift you.
  - A deep overlap slides you out over a few frames (at most 12 px a frame) instead of jumping.
- **Crushing:**
  - **When it happens:** a construct that pins someone against terrain — falling on them, or driven into them against a wall or the floor — crushes them. This includes you, and it includes your own constructs.
  - **Pressure:** √mass × (closing speed + its weight when it lies on top).
  - **What you can bear:** 30 × Defence factor × (1 + 4 × self damage-resist reinforcement + 1.5 × self knockback-resist). Defence counts +6% per point over 8.
  - **Bracing:** bear it and you brace, and the construct is held up on you. Don't, and you take `(pressure − what you bear) × 0.12` damage every ¼ s, with the construct resting on you.
  - **Escape:** after 1.4 s pinned you always slip free.
  - **Enemies:** they bear `20 + 1.5·√maxHP`, and bosses ×3.
  - **New memory event:** "Its construct crushed someone" (`constructCrush`).
  - **Tests:** two new engine checks (194 / 194 passing).
- **Cache-busters:** magic-engine v61, magic-techniques v43, magic-forge v22, tutorials v2, tutorial-coach v1, and pvp-arena v4 is now referenced from dungeon.html.

## c59 — Liquid lag in dungeons, a raging river at the River Mill, doors win over props, seamless backdrops

**Dungeon liquids no longer lag the game.**
- **Fluid drawing (dungeon-fluid.js)**
  - Liquid is painted into cached 512 px world tiles (up to 40). A tile only repaints when the depths inside it change, at most 3 per frame. Falling streams are still drawn live on top.
  - `Fluid.clearDrawCache()` was added.
- **Fluid simulation**
  - Settled pools go to sleep after 60 calm ticks: flow runs every 4th tick and levelling every 16th. Any change to a pool wakes it.
  - Levelling uses column objects instead of string ids. Column keys only refresh when columns are added.
  - Pruning runs every 180 ticks, and only when needed.
  - Measured cost is about 0.45 ms tick and 0.5 ms draw per frame on a large lava level.
- **Lava lights (dungeon-vision.js)**
  - Lava adds one light per ~200 px instead of one per 48 px.
  - Lights of the same colour that are close together are merged once there are more than 24. The total is capped at 64.
  - Each light is stamped from a cached radial sprite instead of building a new gradient every frame.
- **Rock skin (dungeon-skin.js)**
  - The vein glow is baked into the rock chunks, so there is no per-frame glow pass.
  - Tile changes only mark chunks for checking: one visible chunk is re-checked per frame, and at most 2 stale chunks are rebuilt per frame.
  - This was a big stall in the fire dungeon. `reset()` now does a full clear.

**River Mill (West Approach).**
- **Water wheel removed:** the wheel, the mill race and its plank walk are gone, and the ground there is level.
- **Millwright Osric:** his lines now say the spring flood tore the wheel off and threw it at the bridge. He walks east of the mill door (9830–10080).
- **The river is a raging river** (`rapids: true, flow 4`). The Valedorn under the stone bridge is drawn by a new `drawRapids`:
  - a choppy surface;
  - current streaks sliding toward the viewer and fanning outward;
  - white foam boils at the rocks and bridge piers;
  - broken crests.
- **New `riverFar` back structure:** through the arches you see the river running in from the distance and widening toward the screen, with rapids rows and haze.
- **Spray:** spray particles fly up off the rapids.

**Doors win over interactables.**
- **The bug:** standing at a door or room exit with a prop, loot or person nearby, the prompt and the E key could pick the prop, which stopped you leaving.
- **The fix:** an unlocked door or exit now always takes E (`EmberfallCity.tryLoot` steps aside), and its prompt is always the one shown.

**Seamless backdrops.**
- **The painted bands tile with no visible cut.** All nine bg-far/mid/near bands were re-cut with `tools/ef_seamless.py`:
  - the strip's two ends are overlapped by 22%;
  - a minimum-error seam is found through the overlap and feathered across it.
  - The bands are now ~1000 px wide (were 1280). The originals are kept outside the game.
- **The far-city skyline** is painted wrapped, so roofs that cross its ends continue on the next copy.
- **Image cache-buster:** bg images v2.

Cache-busters: dungeon-fluid v23, dungeon-vision v11, dungeon-skin v2, emberfall-world / layout / life v3, emberfall-city v44, bg band images v2.

## c60 — The Grand Arcanist (a technique-free endgame boss), a raw-energy discovery sweep, sparser clouds, no green block

**Backdrop.**
- **Clouds:** the sky draws single clouds cut from bg-clouds.png. There is one slot every 430 px of drift and about two
  thirds of the slots are filled. It used to tile the whole strip twice.
- **Green block:** the flat green rectangle under the painted bands is gone. In its place is a procedural
  countryside strip (fields, hedgerows, copses, grass). It is cached, wraps seamlessly and has a snowy variant.
- **Far river:** the riverFar banks use the same painted fields instead of a flat green wedge.
- New export `EmberfallWorld.meadow(cold)`.

**The Grand Arcanist** (`grand-arcanist.js`). An endgame boss who uses **no technique**: every attack is a rune tree
cast through the engine with his own reserve.
- **Library:** 13 attacks plus 4 sequences. 11 are initial authored spells. Two come unchanged from the new
  discovery catalog:
  - the signature *Blooming Line* (RD-0099): discs that expand and burst only as they reach you;
  - *Waiting Mines* (RD-0234).
- **Policy (enforced in code):**
  - A static check runs on registration and again before every cast. It allows only raw runes, refuses technique
    parameters and other casters' energy, allows Draw Out only from himself, and enforces Max Output 960.
  - A per-frame scan covers every body, reinforcement, construct and domain he owns. Outside techniques are stripped
    and logged.
- **Mind:**
  - He perceives the player 0.2 s late.
  - A model tracks jump rhythm, close/far time, stillness, casts and dodge direction.
  - A utility score per attack feeds a softmax over the top 3.
  - Three phases (66 % / 33 %). Phase changes are a 1.8 s shift that clears his spells.
  - Telegraphs use engine-measured burst radii.
  - A stun interrupts his telegraph, followed by 3 s of poise.
  - No teleport.
  - He resets on the player's death.
- **Balance:** HP 5600, dmgScale 0.33, reserve 7000 with 150 / s regen (a documented allowance). His Draw Out pays
  per unit (`owner.drain`).
- **Trial:** `dungeon.html?mode=sandbox&arena=mages&boss=arcanist` is the Mage Arena with the player's real energy and
  regeneration (`ARCANIST_TRIAL`). There is a link in the summon panel.
- **RuneMages hooks:**
  - a kind may set `custom: { init, frame, draw, onDeath, pre }`;
  - `bookFor` accepts prebuilt defs;
  - `RuneMages.INTERNAL` exposes cast / perception / helpers.

**Tools** (Node, seeded and reproducible):
- `tools/sim-core.js`: the shared harness. It has the Mage Arena geometry and player policies (still, strafe, jumper,
  aggressive, kiter, reactive with a 0.22 s reaction, random, baseline, skilled).
- `tools/raw-discovery.js`: the discovery sweep. It writes `sim/raw-discovery/*`.
- `tools/arcanist-campaign.js`, which covers:
  - library and policy cases
  - individual attacks
  - counterplay
  - full and natural encounters
  - technique audit
  - stability (including a draw smoke test)
  - regression

  It writes `sim/arcanist/*`, `data/arcanist-spell-library.json`, `grand-arcanist-discovered.js` and
  `docs/grand-arcanist-report.md` (37 / 37 checks pass).
- `tools/selftest-seeded.js`: runs `RuneMages.selfTest` seeded, for before/after comparison. The results are identical
  to the pre-boss code.

Cache-busters: emberfall-world / life v4, rune-mages v13, grand-arcanist v1, grand-arcanist-discovered v1.

## c61 — The Grand Arcanist: more energy, faster attacks, no warnings

**Energy.** His reserve went from 7000 to 30000, and regeneration from 150 to 900 per second.

**Speed:**
- **Wind-ups:** 30 % of each attack's listed telegraph (`telegraphMul`), never under 0.1 s.
- **Cooldowns:** 40 % of the listed values (`cooldownMul`).
- **Recovery:** 45 / 38 / 30 % per phase.
- **Rest between decisions:** 0.12–0.4 s (it was 0.4–1.05 s).
- **Caps:** up to 90 bodies and 18 spell instances of his own.

**Warnings removed** (`CONFIG.showTelegraphs = false`):
- the aim lines, target marks, burst rings, mine and bloom circles, fuse rings and the watching line;
- the Absolute Output screen vignette;
- the hand gather and the brighter aura while gathering;
- the « attack name » label.

What you see now is only his energy itself. Set `showTelegraphs` back to `true` to restore all of it.

**Campaign** (34 / 37):
- **No longer met:**
  - "a clean counter for every attack" (Blooming Line: 50 % at best);
  - "no more than 60 % of your health in one second" (worst 407 of 500);
  - "a skilled player can win" (0 / 6 natural fights; before: 4 / 6).
- **Why those checks are kept:** they are fairness measurements and now document what the change cost.
- **Pressure** has roughly doubled: a still player takes 46.7 dps (before 25.3), strafing 24.8 (before 9.2).

Cache-buster: grand-arcanist v2.

## c62 — Four players in PvP and co-op

**PvP — up to 4 fighters: 1v1, free-for-all and 2v2.**
- **Net layer (`pvp-net.js`):**
  - Casual queues for 1v1, free-for-all and 2v2.
  - A free-for-all starts at 4 players, or at 2 or more once the oldest player has waited 25 s.
  - Private rooms hold up to 4 (`openRoom`; the host starts with a mode).
  - Each pair of players gets its own direct link (WebRTC mesh), falling back to the relay.
  - Every message carries its sender's slot.
  - Match URL: `matchUrl()` builds `…&slot=&n=&pm=` (it keeps `side=` for old links).
- **Arena (`pvp-arena.js`):** the single opponent (`R` / `ENT` / `OWNER_R`) became one remote fighter per slot (`REM`, `remote(slot)`).
  - **Each remote fighter** has its own ghost body, rig drawing, engine caster (`pvp-remote-<slot>`), cast table and rtt.
  - **Colours:** slots 0–3 are blue, red, green and yellow.
  - **Teams:** in 2v2, slots 0 and 2 (Team Azure) face 1 and 3 (Team Crimson).
  - **Friendly fire is off.** An ally's spells never hurt you, and allies are never in your targets (engine enemies, melee targets, old projectile hits).
  - **Referee:** the host, slot 0.
    - Every client reports its own knock-out.
    - The host keeps the list of who is still standing and broadcasts `dn` (down).
    - The round ends when one fighter (1v1, FFA) or one team (2v2) is left. A round can also end in a draw.
    - Scores are kept per slot (`s0`…) or per team (`t0` / `t1`); first to 2 wins.
  - **Knocked-out players watch until the round ends:** they cannot move, cast or swing, and the camera follows a fighter still standing.
  - **Leaving:** a player who leaves mid-round counts as down. Someone joining mid-round watches until the next round.
  - **Spawns:**
    - Even slots start on the left and odd slots on the right.
    - Slots 2 and 3 stand 240 px further in, on solid ground (checked on all five maps).
  - **HUD:**
    - The 1v1 versus bar is kept.
    - With 3–4 fighters there is a standings panel (name, health, round pips, team headers).
    - Allies show a team-colour ring and "(ally)" over their head.
    - The title shows PvP Duel, Free-for-all or 2v2.
  - **Pings:** each fighter's rtt is measured separately; the clock is synced to the host.
  - **Legacy:** `window.__pvpOpp` now points at the nearest opponent; `window.__pvpOpps` lists them all.
- **`dungeon.html`:** new `PVP_SLOT`; your colour and spawn now come from your slot.
- **Menu (`index.html`):**
  - Casual 1v1, Casual Free-for-all and Casual 2v2.
  - Private Room (up to 4): a 4-seat roster with team labels. The host picks 1v1, FFA or 2v2 (each enabled only for the right player count) and starts.
  - The `onMatched(matchId, info)` → `side=[object Object]` URL bug is fixed: the menu uses `PvPNet.matchUrl`.

**Co-op — four players for real.**
- **One layout for the party:** `DUNGEON_SEED` comes from `?seed=`, or in co-op from a hash of the match id. Every procedural generator (the inline fire generator and fire/ice/jungle `-world.js`) uses it, so host and guests build the same dungeon. Before this, each client generated its own random layout.
- **Threat-based aggro** (the host runs every enemy):
  - **Choosing a target:** each enemy picks among the living players. It weighs threat (damage dealt to it, which fades over time) against nearness, with some stickiness toward its current target. Bosses switch to someone else about every 7 s.
  - **Going after an ally:** while an enemy acts against an ally, the host's `player` is briefly stood in for by that ally (`coopAimBegin` / `coopAimEnd`). The enemy's own AI (movement, aim, spells, kits) then goes after that ally.
  - **Instant hits on an ally:** any instant damage is forwarded to that ally's client as a `hit` event. The ally's own i-frames and defences apply; there is a 0.25 s rate limit; enemies whose contact damage guests already compute locally are skipped.
  - **Raids:** the raid and chrono bosses are wrapped the same way.
  - **Threat from guests:** comes from their `enemyDmg` reports.
- **Testing:** `coop-net.js` gains a `?local=1` BroadcastChannel transport, so four tabs of one browser can run co-op with no server.

Tested headless with four local clients:
- **PvP:** FFA and 2v2 rounds to a result and the next round; friendly fire off in 2v2 and on in FFA; 1v1 and practice unchanged.
- **Co-op dungeon:** identical layout on all four; enemies chase and hurt guests.
- **Raid and chrono raid:** the bosses scale to 4 and target guests.

Cache-busters: pvp-arena v5, pvp-net v10, coop-net v4, fire-dungeon-world v56, ice-dungeon-world v17, jungle-dungeon-world v37.

## c66 — Binding Vows (a new rune family), Max Output cost on spell slots

**⛓ Binding Vow rune** (`magic-vows.js`, category *Binding Vow*). One rune holds a contract: a **condition** to meet, a **commitment** it accepts while the vow holds, a **reward**, and for energy vows a **failure clause**. Pick the kind of vow, then the vow; each vow has its own parameters.
- **Free.** The rune costs 0 mana and never lengthens the cooldown (`Runes[id].free`; `castCooldownFrames` skips free runes). Energy a vow grants is tracked as `b.vowShare` and never counts against Max Output (`outPow(b)` in `recomputeOutput`, the end-of-frame tally and `createBody`), so it can never trigger the Total-Mana overdrive either.
- **Energy vows (12)** bind the energy in the branch and pay bonus energy: Unerring Path, Solitude, Long Journey, Patience, Final Fragment, Gauntlet, Named Prey, Untouched, Sacrifice, Perfect Sequence, Stillness, Absolute Compression. Failure clause: lose the bonus / lose 35% of the energy (reward ×1.15) / the energy is destroyed (reward ×1.3).
- **Passive vows (12)** bind you while their spell runs: Still Mind, Immovable Resolve, Dormant Power, Sealed Hand, Singular Purpose, Unarmed Sage, First Spark, Conservation, Lone Star, Patient Guardian, Unbroken Thread, Narrow Gate.
- **Attribute vows (15)** — Strength: Iron Fist, Duelist, Physical Mastery · Defense: Unbroken Guard, Open Gate (no dash), Last Stand · Mana: Deep Reservoir, Scarcity, Unspent Cup · Mana Control: Few Words, Precision, Closed Circuit · Magic Power: Glass Cannon, Charged Heart, Forbidden Technique.
- **Exchange vows (6):** Arcane Glass (Defense → Magic Power), Iron Vessel (Magic Power → Defense), Empty Mind (Mana Control → Strength), Overflowing Mind (Strength → Mana Control), Vast Reservoir (Magic Power → Mana), Explosive Vessel (Mana → Magic Power). Rates are deliberately uneven.
- **Fair-play rules:** one contract pays once (energy split from a bound body carries the same contract object); bonuses add from the energy's own part and stop at +150% (`VB.stackCap`); player stat changes are clamped (`clampMods`); player vows last while their spell runs, with 2.5 s grace so a ∞ passive re-casting keeps its progress; breaking a player vow's rule switches it off for a few seconds.
- **Engine hooks** (`MagicEngine.registerWorldHook`): `W._vowCast`, `_vowPre`, `_vowTick`, `_vowHit` (may answer `'pass'`), `_vowBody`, `_vowEnd`, `_vowDraw`, `_vowClear`; `inst.vowPower` multiplies a cast's damage (Charged Heart); `inst._vowBoost` grows its freshly generated energy (Still Mind, Dormant Power, First Spark). World API: `W.vowMods(owner)`, `W.vowCostMult(owner, def)` (never above 1), `W.vowPassiveMult(inst)`, `W.vowNote(owner, 'melee')`, `W.vowHistory()`.
- **Game (`dungeon.html`):** Strength → melee damage and knockback, Defense → `damagePlayer`, Magic Power → `runeCasterMult`, Mana Control → `magicProfileForGame`, Mana → `maxMana` (now `let`, from `BASE_MAX_MANA`), regen, costs (casts, passive drain, hotbar), sealed mana (a cast may not dip into it), Open Gate seals the melee dash. Host: `vowText`, `vowPlayer`, `vowSacrificeHealth`. A vow HUD under the mana bars lists what you have sworn, whether it holds, and the net stat change.
- **Forge:** selecting the rune shows the whole contract (condition, commitment, reward, difficulty, failure, scope, price). A select whose choices depend on another field snaps to a legal choice.
- **Tutorial:** *Binding Vows* guide (Advanced); the Rune reference lists the rune.

**Spell slots show the Max Output price.** A spell whose estimated output is over your Max Output shows its (reduced) energy cost and, under it, `+N total` — the Total Mana it also costs (5 × the excess). `MagicEngine.overOutput(report, profile)`.

Tests: `node tools/vow-tests.js` (35 checks); engine checks unchanged (193/194, the compression-damage check fails as before).

Cache-busters: magic-engine v65, magic-vows v1, magic-forge v23 (css v10), melee-combat v47, tutorials v3.

## c67 — Spell parry, Anti-Magic weapons, darker Anti-Magic

Cache-busters: magic-engine v66, magic-techniques v45, melee-combat v48, spell-parry v2 (new), tutorials v4.

- **Dark Anti-Magic reinforcement.** Reinforcement used to draw additively (`lighter`), so a black palette vanished. Anti-Magic reinforcement (positive) now draws opaque (`source-over`): a black shroud with a cold grey rim and rising black wisps on a body (pooling at hands / feet), a black blade with a shadow halo, writhing tendrils, a void at the tip and drifting flakes on a weapon, a black ring on a reinforced spell. Reverse Anti-Magic is unchanged (mint light).
- **Parry turns aside spells.** Q / right-click parry now judges what hits it. A spell's **strength** = its damage per blow + ¼ of its energy (a game projectile: its power, +10% per effect; over-compressed energy ×(1 + 0.6·compression)). The weapon's **parry capacity** = (0.8 × its first strike's damage + 70 × each reinforcement's strength) × (1 + 2% × Strength + vow Strength) × (1 + 0.5 × heavy-weapon Gravity) × (1 + 0.5 × Anti-Magic hold). Empty-handed: 10. Spells at or under the capacity are broken up; stronger ones go through (red "Too strong to parry!" with both numbers). Melee blows keep the old rule (any parry holds).
- **Two ways it happens.** (1) *Guard zone*: during the parry window, spells entering the space in front of you or touching the weapon are judged in flight (`W.parry`). (2) *At the blow*: a hit landing inside the window goes through `MeleeMode.spellGate` → `SpellParry.gate` (`window.__curEProj` / `W.hitSrc` identify the spell).
- **Anti-Magic reflects.** A weapon with Anti-Magic reinforcement turns the spell about: an engine body becomes yours (`W.reflectBody`: `reflected`, `ownerId = 'player'`, aimed back at the nearest foe along the way it came, keeps 60–90% of its energy, loses 35% of its non-Anti-Magic techniques, `hostForB` uses the player's view so it strikes its own caster and never you); a game projectile becomes one of your projectiles at 60–90% power. A turned-about body survives the very blow that was landing.
- **Parrying strains the reinforcement**: 12% of the spell's strength (24% when reflecting) is taken from the weapon's reinforcement energy (a magical item does not shrink).
- **Anti-Magic contact (`W.weaponContact`).** An Anti-Magic reinforced weapon in hand erodes whatever magic its blade touches, every frame, not only while swung: bodies and projectiles under 10% of the reinforcement's energy are erased; bigger ones are worn down (`antiMagicExchange` / `antiForeignExchange`, budget `(rate + rate/s × hold) × (0.35 + strength) × dt`); zones are suppressed; constructs are chipped. It pays from the reinforcement. Suppressed reinforcement does nothing.
- **Engine additions.** `W.spellStrength`, `W.parry(zone, o)`, `W.parryBody`, `W.reflectBody`, `W.weaponContact`, `W.segDist`, `W.hitSrc`; host hook `parryForeign(p, o)`. `hostFor(b.inst)` → `hostForB(b)` for body hits.
- **Game side:** `spell-parry.js` (`window.SpellParry`: `info`, `describe`, `gate`, `update`) wraps `magicUpkeep`; `updateEnemyProjectiles` sets `window.__curEProj`; weapon slots show "Parry … strength N" on hover.
- **Tests:** `node tools/parry-tests.js` (17 checks); browser check in the sandbox.
- Not covered: projectiles from the boss kits that call `damagePlayer` without going through `enemyProjectiles` (they keep the old rule: any parry holds), area / laser / linger projectiles (judged only at the blow, never reflected), PvP opponents' spells (same engine path, untested online).

## c68 — Scroll of Mirror War (a 61-rune legion spell) and the 🪞 inventory button

Cache-busters: scrolls v3, mirror-war-spell v1 (new), tutorials v5. **No engine changes** — Mirror War is an ordinary serialized rune tree.

- **The spell.** One Generate (400 E), four two-way Splits that divide the energy (Executors 30% · Sweepers 21% · Crossfire 19.6% · Harriers 17.6% · Reserves 11.8% of E, before each Split's 2% loss), then five families: **Harriers** (3 small points), **Sweepers** (a wave stood on end + a cone), **Crossfire** (3 arrows; two leave 70° off the cursor line and swing back onto it from opposite sides), **Reserves** (a disc and a star) and **Executors** (3 spears; two come in 55° off and swing onto the cursor). Colour runes tint each family. Everything is shaped at t = 0 (shaped energy leaks far less than raw while it waits); the Delay connector sits on the Redirect that launches each projectile: 0 / 0.4 / 0.8 / 1.2 / 1.6 s. Nothing homes; every projectile is aimed once at the cursor when it is released.
- **Seven contracts, five kinds, each where its restriction is real:** Unerring Path ×2 (harriers; 250 px minimum, after the Redirect and Rotate), Patience (the waiting wave: 1.0 s, must hold still the first half, so its Redirect waits 0.6 s), Long Journey ×2 (350 px on a swinging arrow, 500 px on the straight one), Absolute Compression (level 10, sworn *before* the Compress 10), Solitude (strict *body*, after the spear's last split, before launch).
- **Cost.** 61 runes need Energy Control 17 (capacity = 10 + 3 × Control); mana 497; estimated output 798 — over most players' Max Output, so the rest is paid in Total Mana (ordinary overdrive rules). The engine's rune cap is 100, so the guide's 100–120 target was not reached: nothing more was needed, and every extra rune costs a third of a Control point.
- **The scroll.** `scroll_mirror_war` (legendary 🪞, not sold) in `scrolls.js`; its spell comes from `mirror-war-spell.js` (`window.MIRROR_WAR_SPELL`, generated by `node tools/mirror-war.js --write`). Using it copies the spell into a slot like any scroll.
- **The button.** Inventory toolbar **🪞 Mirror War**: adds the scroll (one is enough) and says what casting needs. **Shift+click** also raises base Control to 17 and base Power until Max Output covers the spell, so it casts without Total Mana (a testing aid, announced in the note). Scroll tooltips show the rune count and the Control a stored rune spell needs.
- **Tests.** `node tools/mirror-war-tests.js [--table]` — 39 checks: structure and capacity, five families and their order, energy division, no free energy, each vow completing / failing / expiring, split and merge with vow-bearing bodies, a failing branch, interruption, deflection, 6 casts at once and cleanup, and the comparison with smaller spells. `node tools/mirror-war-sim.js` prints the damage report. Builder: `tools/mirror-war.js` (tunables at the top). Write-up: `docs/mirror-war.md`.
- In the Binding Vows tutorial: "A worked example: Mirror War".

## c69 — Domain Laws, the opening, domain looks, grouped conditions, and Authentic Mutual Love

Cache-busters: magic-engine v67, magic-forge v24 (css v11), magic-domain v1 (new), magic-domain-art v1 (new), scrolls v4, yuta-spell v1 (new), tutorials v6.

- **Laws (new rune, `magic-domain.js`).** A **Domain Law** is a standing rule placed directly under a Domain: *WHO* it concerns (every foe / you / everyone), *WHEN* it applies, *THEN* what happens. Laws are not spawned spell branches: they are read from the tree once and checked every frame for every foe inside (up to 8). Old rule branches still work in the same domain.
  - **When:** always · every few seconds · domain opens · they step in · they try to leave · they cast · they attack · move fast · stand still · jump · take a blow · health low · carry enough marks.
  - **Then:** damage · burn · execute · drain · stun · slow · bind · pull · seal (casting or techniques) · negate · mark · clear · expose · heal · copy · cast a copy · run the runes below the law.
  - **Marks** are a per-foe counter (a trial: mark each offence, a law fires at N marks and can spend them). **Expose** makes blows taken inside hurt more. **Seal** silences a rival rune-caster (casting refused) or confiscates techniques (the Technique rune fails). Seals only work on rune casters.
  - **Copy / cast a copy.** A rival mage's real spell is stored when it is cast; an ordinary monster's attack leaves an "echo" built from its damage. Stored copies are cast back from the domain's own energy at each foe, owned by the caster, sure to land, max 3 live. Domains cannot be copied.
  - **Budget.** Every law has a weight; the total must fit `10 + 1.8 × Control` (×1.35 declared, ×1.25 shared, ×1.15 brief/narrow). The new Domain vow **Declared** (×1.4 power) is a spoken, announced domain. Each application takes a little energy from the zone, so a thin domain does less. Laws that act continuously tick in quarter-seconds; every law has a per-foe cooldown.
- **The opening (engine).** `cinematic` param on the Domain: **full** (gather ≈1.0 s → the world freezes for 0.9 s → a rapid 0.38 s expansion), **quick**, or **none** (opens at once, as before). Time does not advance during the freeze (`W.isFrozen()`); the domain's clock starts when the barrier is complete. Nothing is trapped or struck before it is up. Hosts that cannot freeze (`host.noFreeze`: PvP and co-op) still get the gather and burst, without the freeze. Boss, rival and technique domains use `none`, so they behave exactly as before.
- **Looks (`magic-domain-art.js`).** Ten themes (void, shrine, court, love, sea, eclipse, garden, frost, ember, galaxy), accent colour, ten barrier patterns, motes, interior air, four expansion bursts (shockwave, bloom, shattering, ink), and the on-screen title. **From outside a sealed (closed) domain you cannot see in** — an opaque shell is drawn, and you always see out of your own. `outside`: auto / sealed / misty / clear.
- **Conditions are grouped.** Eight groups (Target, Enemies around, You, This energy, Contact, This spell, Zone & domain, Other) as chips with a search box in the connector's "Wait until" panel. Every condition has a group (checked). New condition: *Target carries marks*.
- **Forge.** New param types: `text` (the domain's title and law call-outs), swatches for the theme, `<optgroup>` for long option lists (When / Then).
- **Authentic Mutual Love (Yuta).** `tools/yuta-domain.js` builds `yuta-spell.js` (5 runes: Zone → Domain with three laws). Sealed love domain, no sure-hit blow: every attack or spell inside is copied (4 kept), a copy is cast back at each foe every 1.2 s from 1000 E of its own energy, and you are healed 5/s inside. Needs Control 6, ≈1164 mana. Scroll `scroll_yuta` (not sold); inventory button **💞 Mutual Love** beside Mirror War (Shift+click lifts base Control to 6).
- **Dungeon.** `update()` skips the whole game while the world is frozen (only the opening advances); the veil and the opening are painted after the damage numbers.
- **Engine plumbing.** `W.cast` validates with a seeded target when a cast hands the branch one (so a copied spell that aims at its target is legal); hooks `_domGather/_domOpen/_domTick/_domEdge/_domCast/_domEnd/_domClear/_castBlocked`; internals now also expose `applyStatus, depositZone, endInstance, center, insideDomain, domainFoes, burnoutLeft, domainTitle, newBranch, spawnRule, takeFromZoneOf`.
- **Tests.** `node tools/domain-tests.js` — 61 checks (events, effects, marks and a trial, seals, negate, copy and cast-copy with a rival mage and with a plain monster, the budget, the opening phases and freeze, painter across every theme × burst × pattern, the veil, condition groups, Yuta's domain, load). `node tools/engine-checks.js magic-domain.js magic-domain-art.js` — 194 checks; the single failure ("Massive compression…") existed before.
- **Known limits.** Seal affects rune casters only. Copies of other domains are refused. The veil also hides the inside from the owner if they stand outside. Not tested online (PvP/co-op use no freeze).

## c70 — Domain looks: a world of its own, and the Domain Designer

Cache-busters: magic-engine v68, magic-domain v2, magic-domain-look v1 (new), magic-domain-art v2 (rewritten), magic-domain-designer v1 (new, inventory only), magic-forge v25 (css v12), yuta-spell v2, tutorials v7.

- **A domain is now a world seen through a window.** Behind every creature: a **sky**, a **landmark** on the horizon, a **floor** that meets the real ground under the caster (found from the caster's feet and `host.isSolid`), a **sigil** (on the floor in perspective, around you, both, or in the sky), light **rays**, ambience and a vignette. Over creatures: a colour grade, **two particle layers**, the **edge**, an optional rune band, the **burst**, time left and marks. The static part is painted once into an offscreen canvas per domain (capped at 1200 px) and reused; moving parts are live. Headless (no canvas) everything is painted live.
- **Layers and choices** (`magic-domain-look.js`): 4 colours (or 18 palettes) · 15 skies · 20 landmarks (some move: the eye follows the nearest foe and blinks, clock hands turn, halos spin, the sword ring circles) · landmark size · horizon height · 16 floors (water and mirror reflect the landmark) · 18 sigils × 4 placements · 18 particle kinds × 2 layers with amount and speed · 11 edges, width, glow, rune band · 4 light levels, rays, vignette, pulse, how much it replaces the level, animation speed · 12 bursts · 6 frozen-world tints, cinema bars · 7 title fonts × 4 layouts (centred, low, vertical, split) × 5 colours + a subtitle · 6 looks from outside. About 3 × 10¹⁴ combinations of the choices alone. 25 presets.
- **Stored as one param.** The Domain rune has a new `look` param (an object). Without it, the c69 params (theme, colour, pattern, drifting, expansion, air) still decide the look exactly as before, and those params hide once a look is set. `MagicDomainLook.sanitize` turns anything stored into a legal look; `random(seed, locked)` makes coherent random looks (light palettes get light skies and dark titles); `encode`/`decode` make a short `DOM1:` code.
- **The Domain Designer** (`magic-domain-designer.js`, opened by **🎨 Design the look** on the rune's look card, which shows a live thumbnail, 🎲 and ↺). Presets gallery · Ideas (10 random looks, or variations that keep your colours and world) · 8 tabs of layers. Every field has 🔒 (kept when rolling) and 🎲 (roll this one); hovering a choice previews it. Colour tools (hue ±30°, lighter, darker, swap, a pale world). Undo/redo, ⇄ Code. The preview is a private magic world with the real painter and the real opening (▶ Play, Quick, Burst again), seen from inside or outside, closed or open. Keys: R roll, Space play, Ctrl+Z / Y, Ctrl+S use, Esc cancel; the Forge ignores keys while it is open.
- **Dungeon.** The backdrop is painted before the terrain (`MAGIC_WORLD.drawDomainBackdrop`, with `hostDrawsDomainBackdrop = true`), so tiles and creatures stay on top; arena platforms (`sandboxPlatforms`) are redrawn inside the domain as dark slabs (`W.clipToDomains`). The zone's own energy blobs are hidden while its domain is open (engine: bodies with `zoneOf.domainShown`).
- **Authentic Mutual Love** now carries its own look: a pale rose world over a field of swords, a turning halo, petals and fireflies, a petal-storm burst, a low elegant title, a cocoon from outside.
- **Tests.** `node tools/domain-tests.js` — 72 checks (11 new: every option of every layer paints through backdrop / foreground / veil / bursts / frozen screen; 300 random looks and every preset; code round trip; junk cleaned; bad codes refused; old params kept; random looks hold together; in a world the backdrop paints and the zone is hidden; live look swap; Yuta's look). Browser: presets and random looks reviewed at thumbnail and full scale; under 1 ms a frame for a 340 px domain and an 820 px one.
- **Known limits.** Platforms in the open world, city and other non-tile, non-arena modes are not redrawn inside a domain (at 92% "replaces the world" they show faintly; lower it to see more). Title fonts depend on the fonts installed (brush and blackletter fall back to a serif). The Designer is in the inventory's Forge only.

## c71 — Domain size and cost, sealed domain energy, eight branches, Conditional and Loop

Cache-busters: magic-engine v69, magic-forge v26 (css v13), tutorials v8. Everything else as c70.

- **Domains cost mana by how long they last.** `CONFIG.domainManaPerSec = 14`. The Domain Expansion rune's cost adds `14 × the seconds it really lasts` (open domains last 70%, the Brief vow halves it): 5 s ≈ +70, 20 s ≈ +280. The domain also burns its energy by time now (`CONFIG.domainUpkeep = 0.03` of its starting energy per second, ×3 while losing a clash) instead of a fixed 20% — a longer domain spends more. The rune's note and the Forge's construct card show the size and the duration cost.
- **Every domain is 1400 px (radius).** `CONFIG.domainRadius = 1400`, whatever zone it grew from and open or closed (the old ×1.5 for open is gone). The zone itself is resized to 1400 when the domain opens. The **Narrow** vow still squeezes it to 60% (840 px) — it is the one thing a player chooses that can. The painter's cost does not change: a 1400 px domain paints in about 0.4 ms a frame (checked in Chromium over all 25 presets), because the static layer is cached.
- **Energy put into a domain is sealed.** When the domain opens, every zone blob becomes `sealed` (also `noContact`), and so does any blob deposited into the zone afterwards. A sealed blob is not drawn (always, not only once the domain is shown), cannot be targeted (Target → energy, zone pick skips a zone that is a domain), cannot be claimed, gathered, or drawn out (`takeFromZone(z, want)` skips it unless called with `internal = true`). The domain's own rules, laws and upkeep pass `internal` (`takeFromZoneOf` in the plugin internals does too), so they still spend it. When the domain ends the blobs go with the zone.
- **Eight branches off one rune.** `ME.DIRS` now has `n ne e se s sw w nw` (`OPPOSITE` too). The Forge shows eight `+` sockets per rune; diagonal connectors leave from corner to corner. `CONFIG.maxChildren = 8`: a rune with a ninth child fails validation (`KIDS`). Keys: Shift+Home / PgUp / End / PgDn add a child at NW / NE / SW / SE (arrow keys still do N/S/E/W). Old spells load unchanged.
- **New category `logic` (Logic, yellow).**
- **Conditional rune (`conditional`).** A waiting rune: hands its energy and target on unchanged, costs `1 + 0.5 × branches`. Each branch (up to 8) starts when its own "Wait until" connector's condition occurs; a branch added under a Conditional starts as a Wait-until connector. `mode`: **each** — every branch fires on its own condition; **first** — only the first condition to occur fires and the siblings are cancelled (a switch; checked in branch order when several are already true); **repeat** — each branch fires again every time its condition recurs, up to `times` (2–10) with a `rest` (0–20 s) between firings (a re-armed copy waits again). Branches with no condition are flagged (`COND_PLAIN`). Under the hood: `br.condRule` → `advance()` tags the new branches with a `cgroup`; `condFire()` handles first/repeat; a re-armed copy has `rearmed = true` so the "a rune runs once per energy" guard lets it through.
- **Loop rune (`loop`).** `times` 1–10 repeats, `gap` 0–10 s between passes. The return branch is stored on the Loop node as `node.loop = { to, mode: 'instant' | 'condition', check: 'wait' | 'now', cond: { type, params, timeout } }` — `to` must be an earlier rune on its own branch (never itself, never above a Domain or Law: errors `LOOP_TARGET`, `LOOP_DOMAIN`; a Loop with no `to` is only a warning, `LOOP_OPEN`). When a branch reaches the Loop: if repeats are left it pays, jumps back to `to` with the state that rune was first reached in (`br.snaps`; its energy only if it is still alive), and runs again after the pause. **Condition, "when it happens"**: waits (state `lwait`) until the condition occurs, gives up after the give-up time, then carries on past the Loop. **"While still true"**: checks once at that moment; false → the loop ends and the runes after it run. Runes after the Loop run once, when repeats are done or the loop ends. An inner loop starts over on every outer pass; a loop in a split repeats only its own branch (`loopN` and `snaps` are copied to forked branches); one spell may make at most `CONFIG.loopPassCap = 300` repeats.
- **Loop mana.** Every repeat costs the repeated runes' mana (from the first rune it returns to down to the Loop, using the per-rune cost `report.nodeCost`) × `CONFIG.loopFee = 1.5`, drained from the caster with `api.drainReserve` when the repeat starts; the runes' own share is added to the spell's energy budget so Generate has energy again. If the mana is not there the loop ends. The spell's reported cost (`report.cost`) includes all repeats (`report.loop` is that part); `report.upfront`, what is paid at the cast, does not. The Forge shows "+N ↻" beside the cost.
- **Forge.** The Loop rune has a **⟲ handle**: pull it onto an earlier rune (valid ones glow) — a dashed arrow with a ↻ badge shows the return branch; click the badge for its panel (Every time / Only when…, When it happens / While still true, the same grouped condition picker as connectors, give-up time, Disconnect); right-click it for a menu. The return branch lives outside the rune slots. The condition picker was split out of the connector panel (`condBox`) so both share it.
- **Tests.** `node tools/logic-tests.js` — 51 checks (eight branches, Conditional each / first / repeat, Loop counts / pause / cost / mana running dry / middle return / conditions / checks / splits / nested, domain cost, size, sealed energy). `domain-tests.js` still 72/72 (the leave-the-domain test now walks to a 1400 px wall; the painter loop test clears its recorder each frame). Browser: the Forge shows the eight sockets, the handle drag connects, a drop on a later rune is refused.
- **Not done / limits.** The Designer's thumbnails and other hosts are unchanged. The loop arrow is drawn under or beside runes and can cross other branches in a crowded tree. Online play (PvP, co-op) is untested with loops.

# Current state (summary of everything above, up to date)

Cache-busters: **magic-engine v69, magic-vows v1, magic-domain v2, magic-domain-look v1, magic-domain-art v2, magic-domain-designer v1, yuta-spell v2, scrolls v4, tutorials v8, magic-techniques v44, magic-forge v26 (css v13), shape-editor v3, pvp-arena v5, pvp-net v10, coop-net v4, fire/ice/jungle-dungeon-world v56/v17/v37, gear-data v5, gear-system v10, melee-combat v47, player-rig v4, slot-chooser js v4 / css v3, dungeon-vision v11, dungeon-fluid v23, emberfall-art v4, emberfall-city v44, fire-art v16, ice-art v7, jungle-art v3, ice-world v15, dungeon-skin v2, where-map v1, emberfall world/life v4, layout v3, interiors v2, rune-mages v13, grand-arcanist v2 (+ discovered v1), bg band images v2, frontier files v1.**

## Controls

| Key | What it does |
| --- | --- |
| O | Clears all your spells and passives (and dissolves your constructs) |
| T | The "trigger key" condition |
| R | Weapon special; on magical items, throw — or hold for the Light / dark beam, or an Anti-Magic / restoring slash |
| P | Release the magical item you are holding |
| L | Turn onto another road at a fingerpost (open world) |
| N | The map: where you are on the world grid |
| Del / Shift+Del (forge) | Delete branch / delete one rune |
| ⟲ Reset, ∞ Passive (forge top bar) | Start the spell over / make it a passive spell |

## Energy and techniques

- **Speeds:** raw energy ≤ 9; Kinetic 8–15; Light always 18. Kinetic reinforcement adds speed past the raw / Kinetic limits. Redirect speed is a % of the energy's top speed.
- **Leak:** energy leaks 30% slower than originally.
- **Recoil:** switched off for now (`CONFIG.recoil = false`). Neither launching energy nor a spatial rupture knocks you back.
- **Techniques don't stack:** a different technique converts the energy; the same technique adds; its reverse cancels. Technique → *Remove* makes it raw again. Generate *at current energy* takes on that energy's technique (optional).
- **Thermal:** flame / snowflake look.
- **Spatial:** portal (+) or bounce surface (−). A weapon reinforced with Spatial attacks through a portal at the cursor.
- **Gravity:**
  - looks like a small black hole with an accretion disk; reverse looks like a white hole;
  - pulls are 3.45× the original strength;
  - pulls you too, unless the rune's *Affects you too* is set to *No*;
  - does no damage and rests on walls;
  - on creatures: 40% strength, capped at 0.9 px per frame (it slows them, it does not lock them);
  - bends spells and enemy projectiles, which can then hit enemies;
  - merges with same-sign gravity energy;
  - cannot be compressed (compress first, then apply Gravity — the compression level counts for Infinity);
  - reinforcing yourself gives high / low gravity;
  - on a weapon: heavy = slower + harder, light = faster + weaker.
  - **drawn out of an Infinity source** (attraction): 3× pull on creatures (capped at 3.6 px/frame), 35% more reach, crushes at its core;
  - **discharged:** Reverse Gravity throws what is in the burst away (from Infinity, a hard throw); Gravity drags it in.
- **Light:** always travels at 18 and passes through enemies and surfaces (infinite pierce).
- **Anti-Magic:** consumes magic by magnitude (Anti 30 + raw 50 → raw 20). It suppresses techniques, other casters' zones (gradually, then they collapse — never your own), reinforcement (while touched), projectiles, portals and Infinity. Each technique resists differently: Spatial most, Light least. It does modest damage to non-magical creatures. Reverse Anti-Magic restores / stabilises existing magic and never creates energy.
- **Infinity** (a technique, but not an ordinary one): 450+ E at Compression 20+ becomes an Infinity source — a reservoir of its own kind of energy. Draw Out pulls that kind out, without limit. Compression is its stability. Over-drawing, Anti-Magic or very powerful spells build stress → backlash explosion. Spatial energy drawn from it and reinforced into you makes the distance layer. Infinity Gravity / Spatial meeting its reverse tears space.
- **Kinetic** behaves as described in "The six techniques". **Binding was removed** — it is now the Bound state of the Anchor / State rune.
- **Spatial** portals carry things through for free (no energy or time lost). Spatial energy can be moved; a portal's exit moves with it.
- **Generate** makes up to 1000 energy.
- **Kinetic** bounces off surfaces (Max bounces, default 3).
- **Draw Out:** you set the amount. Too much at once strains it: some spills, and it can backlash. A zone holds at most `220 × (radius/180)^1.5` E.
- **Compression** runs −10…50:
  - each level needs a minimum of energy (`2 + 0.5c + 0.04c²`: 11 at 10, 28 at 20, 127 at 50) or it collapses;
  - highly compressed energy resists gravity (×0.21 at 50);
  - past 10 it over-compresses: much smaller (under ⅓ size at 50), stronger, pierces enemies, lasts much longer — but it is a little unstable, and redirecting it can make it explode (less likely with Energy Control; inventory transfer is safe);
  - the glow stays inside its own shape;
  - Compress rune cost is `5 + (power − 10) × 0.9` past 10.
- **Enemy vortex attacks** pull your energy and can turn it against you.
- **Construction:** energy becomes a solid construct shaped by its Shape (bigger with energy, tougher with compression). It has real collision: you stand on it and ride it, walls block, projectiles and energy break against it, and Light is blocked. It keeps its energy's Anchor state and technique as its material. Integrity and cracks, shattering, lasts 40–120 s. 12 per caster. Drawn as its exact Shape. Rotate turns it. Gravity reinforcement gives it a Gravity core, shown as a pulsing aura: heavier, or lighter / floating. Target that Gravity energy to move, anchor or turn the construct; when moved, it points where it goes unless you've Rotated it. Reverse (*Target → Construct* first) dismantles yours back into raw energy: once, within Max Output, never all of it.
  - **Contact and crushing (c58):** a moving construct pushes creatures the way it moves.
  - **Crushing:** pinning someone against terrain crushes them (√mass × (closing speed + weight)).
    - You bear `30 × Defence factor × (1 + 4·damage-resist + 1.5·knockback-resist reinforcement on yourself)`; creatures bear `20 + 1.5·√maxHP` (bosses ×3).
    - If you can bear it, you brace and hold the construct up. If not, you take damage every ¼ s, and you always slip free after 1.4 s.

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
    - **Contact:** an ordinary cord strikes enemies that touch it (35%, with technique effects). A kinetic cord is solid to everything: energy bounces off it; a creature touching it gently stands on it or is stopped by it, and a hard impact (over 6.5 px/frame) bounces it like a trampoline.
- **Domain Expansion:**
  - The Domain rune turns a zone holding 120+ E into a domain, for 3–20 s. It needs Control 6+.
  - Its child runes are rules applied to every foe inside: instant (once), delay (repeating) or condition (per foe, re-arming).
  - Forms: closed (barrier) or open. Optional sure-hit homing.
  - Vows: shared ×1.5 (the rules can hit you), brief ×1.3, narrow ×1.3.
  - Rule Generates draw from the zone.
  - **Logic and domain rules (c71):** eight branches off a rune; the **Conditional** rune (up to 8 conditional branches: each / first wins / repeat) and the **Loop** rune (1–10 repeats back to an earlier rune, with an optional condition, each repeat costing the repeated runes × 1.5); domains are always 1400 px, cost 14 mana per second they last, and the energy put into them is sealed away. See the c71 section.
  - **Looks (c70):** a domain paints its own world (sky, landmark, floor meeting the real ground, sigil, two particle layers, edge, light, burst, title, look from outside), designed in the **Domain Designer** (🎨 on the Domain rune): 25 presets, random ideas, locks and dice, palettes, codes, a live preview of the real opening. See the c70 section and `docs/domain-looks.md`.
  - **Laws (c69):** WHO/WHEN/THEN rules under a Domain, with marks, seals, copies, a budget of `10 + 1.8 × Control`, a Declared vow, an opening (gather → freeze → burst), looks, and a veil from outside. See the c69 section and `docs/domain-laws.md`.
  - One domain per caster. Overlapping domains clash and the more refined one wins.
  - Burnout afterwards (`4 + 0.4 × duration` s; Technique runes fail).
  - **As it opens: Overwhelm** (+30 cost): foes inside are stunned for 1–2.5 s (×0.4 in a clash; at most 0.6 s behind an Anti-Magic shield).
  - **Fuel:** what the zone holds (Draw Out first), or your own energy poured in as it opens (no Draw Out).
- **Hollow Purple / spatial rupture:**
  - up to 20 px/frame once sent;
  - can't be bent off course;
  - swallows other magic and constructs (it grows);
  - only Anti-Magic undoes it (1:1.5);
  - its first touch is a heavy blow;
  - it goes through Infinity layers and domain barriers.
- **Compress → Draw your own:** a shape editor with brush, eraser, mirror and draggable built-in shapes (move / stretch / turn). The outline becomes a real shape.
- **Casting** comes from the hand on your cursor's side, and you face the cursor.
- **Shape library:** save drawn shapes (★ Save to library in the shape editor or the forge). Reuse them by dragging them into drawings, opening them to edit, renaming or deleting them, or picking them in one click from the forge's Compress / Shape grid. They are kept in this browser, up to 80.
- **Colour rune** (Appearance): 12 colours. It recolours the energy, its technique's look and everything made from it; nothing else changes.
- **Target → Energy in an anchor state:** finds your own energy that is anchored / free / attached / guided / bound / infinity.
- **Zones** dissipate once their spell is finished (no runes left, no conditions waiting, nothing drawing) — unless a technique gave them a **zone law** (Thermal, Light, Gravity, Kinetic, Anti-Magic, Spatial, each with a reverse; see the zone laws section); those last their full minute. *Target → Zone* picks an existing zone; Target on energy / spells can filter *With technique*.
- **Passive spells** (∞): cast to switch on and cast again to switch off. They drain `cost × 1.3 / cycle` energy per second, and their reinforcement holds steady.
- **Engraving:** a weapon's special can carry an engraved spell, cast every time the special strikes.
- **Binding Vows** (⛓, c66): one rune, 45 contracts in four kinds — energy vows (bonus energy when the energy meets its condition), passive vows, attribute vows and exchange vows (your stats while the spell runs). Free: no mana, no cooldown, never counts against Max Output. One payout per contract, +150% cap, clamped stats.
- **Scroll of Mirror War** (c68): a legendary scroll (inventory 🪞 button) holding a 61-rune, five-family legion spell with seven Binding Vow contracts; needs Energy Control 17; `node tools/mirror-war-tests.js` (39 checks); see `docs/mirror-war.md`.
- **Spell parry & Anti-Magic weapons** (c67): Q-parry turns aside spells whose strength (damage + ¼ energy) is within the weapon's capacity (0.8 × first-strike damage + 70 × reinforcement strength, × Strength / heavy / Anti-Magic bonuses); Anti-Magic reinforced weapons reflect what they parry and erode magic they touch; reinforced Anti-Magic draws as an opaque dark shroud / blade.
- **Spell slots** show `+N total` under the cost when a spell is over your Max Output (the Total Mana the overdrive takes).

## Enemy casters (rune mages)

- **rune-mages.js v2:** Vesk (Kinetic + Light), Morrow (Construction + Gravity) and Sola (Thermal + Spatial).
  - They cast real rune spells through the engine. Each spell instance has its own foe perspective (`W.hostFor`) and its own cursor (`owner.aimFor`).
  - No condensed weapons and no reverse techniques.
- **Trademark zone spells** (22–28 runes, conditions): Lumen Loom (Vesk), Cathedral Fall (Morrow), Ember Orrery (Sola). Each draws a large zone and turns it into a signature attack while the mage keeps fighting.
- **How they play:** like a decent player.
  - Tactic plans with scores, a wind-up tell before each planned spell, a reaction delay, imperfect leading aim and skill-chance reactions.
  - They keep range, strafe, hop and reposition.
- **Damage:** to you ×0.3.
- **Where to fight them:** Sandbox → ⚔ Mage Arena.
- **Turned energy:** another caster's portal or kinetic cord turns your energy against you.
- **Shoves:** magic shoving you (from foes) is capped at a short knockback.
- **Melee fighters** (one technique each, the boss's planner). They fight with the player's melee system (real weapon attacks, combos, launchers, plunges; you can parry them) and use spells only as utility:
  - Kael, the Ironfist (Kinetic): gauntlets;
  - Brannoc, the Hearthbreaker (Thermal): hammer;
  - Sythe, the Rift Dancer (Spatial): daggers. Her Rift Step exits beside you, then the portal closes.
- **Boss — Aster Vael, the Boundless** (Infinity + Gravity, 4200 HP, three phases):
  - **Every attack is a real rune spell**, coloured with the Colour rune.
  - **Boundless:** the Spatial Infinity layer reinforced into himself. Hits drain it until it shatters; Anti-Magic and your sure-hit domain suppress it; it lapses while he forms the Violet Void and during his burnout.
  - **Spells:** Azure Collapse and Crimson Repulse drawn from Gravity Infinity sources, Point Blank, Azure Strikes (kinetic fists after a blink), Maximum Azure, the Violet Void (opposing Infinity tears space) and Domain: Endless Expanse (opens with Overwhelm).
  - **Own models** (engine skins), the same energy underneath: the Blue collapse, the Red star, the Violet void, the in-hand cores and the force fists.
  - **Plays in plans** (combos with waits, 0.4–1.4 s rest between them). His Blue and Red are never out at once.
  - **Domain:** a vast (r 820), brief (about 1.5 s) Overwhelm, fuelled from his own energy (no Draw Out) with no rules, followed by one strike.
- **Colour rune** (Appearance): it tints energy and everything made from it, including the technique's own look.

## Reinforcement

- **Targets:** yourself, legs, arms, ally, weapon, active spell, raw energy, a construct (restores its integrity). Raw energy / active spell / anchor-state targets can select *All energy inside this spell*.
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
- **Special cooldowns:** `base + 0.45·√(power/100)` s (max 15): throw 1.2, beam 4; Anti-Magic / restoring slash always 1 s.
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

Rune Forge → 🧪 Tests (17 test spells) and "Run engine checks" (184 checks, all passing). Binding Vows: `node tools/vow-tests.js` (35 checks). Logic runes and domain rules: `node tools/logic-tests.js` (51 checks). Domains: `node tools/domain-tests.js` (72 checks). `RuneMages.selfTest()` checks the rune mages (12 checks: spells validate, trademark ≥ 20 runes with no reverse / weapons, trademark lands in a duel, varied tactics).

## Errors

The game never freezes on an error: the failing part is skipped for that frame, and the error is shown in a red box on screen (with *Copy*) and kept in localStorage `magicBattle_lastErrors`. Magic errors remove only the energy involved.

## Performance

More than 24 energies on screen → cached-frame stamps; a spatial grid for meeting / nearby / zone-blob checks; hit boxes once per frame; batched sparks; spark, ring and light limits in a crowd.

## c72 — Domain law balance pass
- Execute: weight now 4 + (pct/100)²×40 (25% ≈ 6.5, 50% = 14, 100% = 44 — over any budget), fuel per kill 6 + pct×0.6, cooldown floor 2 + (pct/100)²×14 s (100% = 16 s). Bosses/elites only fall at ≤15% health.
- Stun / bind / seal: weights grow faster than linearly with duration; cooldown floor is 1.6× / 1.5× / 1.3× the duration (never more than ~60% locked); fuel scales with duration.
- Negate: weight 3 → 6, cooldown floor 0.4 → 1.5 s, fuel 3 → 8.
- Damage, slow, expose, heal: superlinear weight at the high end; slow and expose fuel scale with strength. Drain refund to the domain 80% → 50%.
- magic-domain.js v3.

## c73 — Domain mana ×5 and multi-law surcharge
- `CONFIG.domainCostMult = 5`: the Domain rune's own mana (base 60 + 8/rune + opening + duration cost) is ×5. Energy poured in with "self fuel" stays 1×. An 8 s closed domain ≈ 860 mana, a 20 s one ≈ 1,700.
- Several laws: every law after the first adds 60% of the summed law cost again, ×5 (3 laws ≈ +170 mana, 6 laws ≈ +900). Shown as "Laws surcharge" in the construct info.
- Authentic Mutual Love now costs ~3,100 mana — only castable with a reserve of that size.
- engine v70, magic-domain v4; tools updated (maxEnergy raised in tests).

## c74 — Domain cost −33%
- `CONFIG.domainCostMult` 5 → 3.35 (the multi-law surcharge follows it). 8 s closed domain ≈ 575 mana, 20 s ≈ 1,140. Self-fuel unchanged. engine v71, magic-domain v5.

## c75 — Max mana from stats
- New `MagicEngine.maxManaFromStats(stats, vowPenalty)`: 500 at the starting stats, rising toward 3000 with `500 + 2500·(1 − e^(−score/230))`, score = Power gain ×1.0 + Control ×1.2 + Mana Regen ×0.15 + Defence ×0.6 (gain over the starting 10/5/100/8). Strength adds nothing. Typical endgame gear ≈ 2,200; extreme ≈ 2,800.
- dungeon.html and inventory.html use it (the old flat 1500 is gone). Vow "Max Mana" sacrifices now take a fraction (amount/1500) of the pool; the gear max-mana multipliers still apply. Fallback when unknown: 500. `deriveProfile` still defaults to 1500 when no maxMana is passed (tests/mages).
- Tutorial text updated. engine v72, tutorials v9.

## c76 — Sandbox ignores build limits
- `deriveProfile({ sandbox:true })` (set by `magicProfileForGame` when in Sandbox and not the Arcanist trial): the limit errors CAPACITY, RESERVE, DOMAIN_BUDGET, DOMAIN_CONTROL, DOMAIN_RULES, TECH_POINTS and ZONE_SIZE become warnings ("ignored in the sandbox") so any spell casts. Structural errors (missing zone, bad links…) and locked techniques still refuse. Mana is already infinite there; the hotbar no longer greys out spells for missing Control. engine v73.
