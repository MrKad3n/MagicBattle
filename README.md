# StoryLine(just the story)

GAME START
Starting Region — Emberfall Valley

A lush valley filled with forests and rolling hills.

Major Location

The City of Emberfall

A medium-sized magical city where young mages train.

Architecture:

Stone buildings with glowing runic lanterns

Mage towers rising above rooftops

Market full of magical artifacts

IMPORTANT NPCS (STARTING AREA)
Archmage Thalen

Elderly mage who runs the academy.

Appearance:

Long silver beard

Blue robes covered in runic patterns

Carries a floating spellbook

Role:

Teaches player basic spell creation

Encourages exploration

Hidden Detail:
Sometimes he says strange things like:

“You remind me of someone… though I cannot remember who.”

This hints that the timeline has changed before.

Mira the Spell Merchant

Energetic traveling merchant.

Appearance:

Red cloak

Large backpack full of scrolls

Goggles on forehead

Role:

Sells spell fragments

Provides hints about ruins

Secret:
She claims she has visited the world many times before, though she doesn't understand why she feels that way.

Captain Dorn

Commander of the city guard.

Appearance:

Heavy armor

Scar across left eye

Massive sword

Role:

Sends player on early quests

Warns about monsters appearing across the land

FIRST STORY ARC
The Awakening of Ignaroth

Rumors spread that an ancient dragon has awakened in the volcanic region.

The dragon is Ignaroth.

Region

Ashfang Mountains

Environment:

Rivers of lava

Black volcanic rock

Ruined dragon temples

Key Structure

Temple of Cinders

Inside lies ancient writings describing:

“A force that bends time to shape destiny.”

The dragon boss battle happens here.

The player believes this dragon is the major threat.

After defeating it, strange magical energy pulses across the world.

SECOND STORY ARC
The Frozen Catastrophe

A distant northern region begins freezing rapidly.

Region

Frostveil Expanse

Environment:

Frozen lakes

Ice storms

Ancient glaciers

Major Structure

The Crystal Citadel

A towering fortress made entirely of ice.

Boss:
Kryonax

This titan appears to be freezing the land intentionally.

After the fight, the player finds a strange artifact:

A broken hourglass carved from black stone.

IMPORTANT NPC (MID GAME)
Scholar Elric

Historian studying magical disasters.

Appearance:

Thin and pale

Round glasses

Always carrying scrolls

Role:
He explains that each magical disaster seems to occur in a precise order, as if something is controlling events.

He begins researching chronomancy, a forbidden magic.

THIRD STORY ARC
The Earth Titan

Earthquakes begin destroying cities.

Boss:
Terravox

Region:
Stoneheart Plateau

Environment:

Massive canyon cliffs

Crumbling ruins

Giant stone statues

Structure:
The Buried Vault

Inside the vault are ancient murals showing:

A hooded figure surrounded by clocks and broken timelines.

WORLD EVENTS START CHANGING

After defeating the third boss strange things begin happening:

NPCs repeat dialogue they already said

Enemies appear in places they shouldn't

The sky flickers briefly

The player occasionally sees ghostly versions of previous locations.

LATE GAME REGION
The Ruins of the Arcane Council

A shattered magical city in the far east.

Architecture:

Floating towers

Collapsed bridges

Magical energy storms

NPC here:

The Grand Arcanist

Leader of a hidden order trying to stop magical disasters.

The player initially believes he is responsible for everything.

He claims someone has been altering time itself.

THE FALSE FINAL BOSS

The player fights the Grand Arcanist.

After defeat he reveals:

“I tried to stop him… but time bends to his will.”

Reality freezes.

The world glitches.

The Arcanist disappears.

FINAL REGION
The Chrono Citadel

A fortress floating outside time.

Architecture:

Massive floating clockwork structures

Bridges made of glowing energy

Broken fragments of different timelines

Inside lives the true mastermind:

The Chrono Tyrant

He reveals he has reset the timeline hundreds of times trying to prevent the world's destruction.

Every boss the player defeated was part of his plan to maintain balance.

The player unknowingly broke that balance.

FINAL STORY MOMENT

The Tyrant says:

“I have lived this moment more times than the stars in the sky.
Every path ends in ruin.
Except one… where you never existed.”

The boss fight begins.

# Magic Battle Menu Assets

This project now includes custom menu art in:

- `images/backgrounds/menu-bg.jpg`
- `images/backgrounds/sandbox-card.jpg`
- `images/backgrounds/inventory-card.jpg`
- `images/backgrounds/dungeons-card.jpg`
- `images/backgrounds/pvp-card.jpg`

`index.html` uses these for the page background and each menu option card.

## Spell Customization Reference

Magic Battle's spell system lets you build spells from scratch using a phase-based architecture. Every spell is a sequence of one or more **phases**, and each phase independently defines its shape, behavior, effects, and numeric properties. The result is a fully custom projectile (or chain of projectiles) that you designed yourself.

---

### How Spells Work — The Phase System

A spell is an array of **phases**. When you cast:

1. **Phase 0** fires immediately — projectiles spawn from your character.
2. When a phase transition triggers, the projectile either **morphs** into the next phase (inheriting position/velocity) or **spawns fresh projectiles** at the impact point (if the `resetProjectiles` effect is applied).
3. This continues through all phases in order.

**Phase transitions** are controlled by the `nextTrigger` property on each phase:

| Trigger | When it fires | Use case |
|---|---|---|
| **onHit** | The instant the projectile damages an enemy | Impact explosions, chain reactions, on-contact transformations |
| **afterHitDelay** | At the hit position after a customizable delay | Time-bomb combos, delayed detonation at impact point, mine-style traps where the explosion lingers at where you landed the hit |
| **afterDelay** | When the projectile's total duration expires (it ran out of lifetime) | Mid-flight morphs, persistent projectile converts to AoE, fallback blast if no enemy was hit |
| **onExpire** | When the projectile's lifetime ends after it has already hit | Cleanup second hit — fires at the enemy's position after a kill, or used to sequence follow-up phases after the initial hit fades |

**Example 3-phase spell:**
- Phase 0: Homing orb (seeks enemy) → `onHit`
- Phase 1: Nova explosion (AoE burst on impact) → `onExpire`
- Phase 2: Rain of spikes (falling projectiles from where the nova was)

Each additional phase adds **+3 Magic Control requirement** and multiplies mana cost by `0.6 + phases × 0.25`.

---

### Player Stats

Your character has four core stats, boosted by equipped items (staff, robe, relics) and class bonuses:

| Stat | What it does | Scaling |
|---|---|---|
| **Magic Power** | Increases all spell damage | +8% damage per point |
| **Magic Control** | Unlocks advanced shapes/behaviors/effects; reduces mana costs | -1.5% mana cost per point (caps at -70%) |
| **Mana Regen** | Passive mana recovery per frame | +0.009 mana/frame per point (base 0.45/frame) |
| **Magic Defence** | Increases max HP pool | +6 max HP per point |

Magic Control also acts as a **gating requirement** — complex shapes, behaviors, and effects each have a minimum Magic Control threshold. If your control is below the requirement, you cannot cast that spell.

---

### Shapes (17 types)

The shape defines the visual appearance, hitbox geometry, and any special mechanical behavior of each projectile.

#### Missile
- **Mana: 5 · Control: 0**
- Small glowing circle (radius = width × 0.7) with a white inner highlight.
- Standard circular hitbox. The bread-and-butter projectile — cheap, fast, no frills.
- **Niche:** Domain missile projectiles spawn at random positions within the domain field. The `chain` shape uses the same visual but adds bounce-between-targets logic.

#### Orb
- **Mana: 8 · Control: 1**
- Larger circle (radius = width × 1.3) with a bright sparkle core.
- Wider hitbox than missile. Feels heavier and more impactful.
- **Niche:** Good for homing behavior since the larger hitbox makes connecting with targets easier despite homing's -50% damage penalty.

#### Ally Orb
- **Mana: 6 · Control: 1**
- Green-tinted circle (radius = width × 1.3) with a light inner glow.
- **Cannot damage enemies.** Instead, it targets and heals the player when effects like `healSelf` or `damageHeal` are attached.
- **Niche:** Combine with `selfCast` or `underfoot` behavior for reliable self-healing. The `damageHeal` effect converts accumulated damage (from `damageStore`) into a heal on contact.

#### Blade
- **Mana: 7 · Control: 2 · Requires: Dragon Heart**
- Rotating rectangle that spins at `age × 0.3` radians per frame.
- Circular hitbox (radius = width × 0.85). Visually distinct from orbs due to the spin.
- **Niche:** The constant spin makes it feel like a slashing melee attack. Works well with `straight` or `boomerang` behavior for a throwing-blade fantasy.

#### Spike
- **Mana: 8 · Control: 3 · Requires: Crystal Crown**
- Pointed diamond shape that auto-rotates to face its velocity direction.
- Slightly smaller hitbox (radius × 0.9) than standard. Looks sharp and aggressive.
- **Niche:** In a domain expansion, spike-shaped projectiles erupt **upward from the ground** instead of spawning randomly, creating a field-of-spikes effect. Also forced to `straight` behavior in domains (not converted to homing like other shapes).

#### Polygon
- **Mana: 9 · Control: 3 · Requires: Crystal Crown**
- Regular polygon (default 6-sided hexagon) with a white inner star. Rotates slowly at `age × 0.04`.
- Customizable via the `polygonSides` property (6, 8, or 10 sides).
- **Niche:** In a domain expansion, polygon shape creates a **push effect** — all enemies inside the domain are continuously pushed away from center (1.2 strength per frame). Standard hitbox (radius = width × 1.0).

#### Slash
- **Mana: 7 · Control: 2**
- Curved crescent arc with a bright inner edge and trailing glow.
- Circular hitbox (radius = width × 0.85). Auto-rotates to face velocity like spike.
- **Niche:** Visually reads as a melee swing. Warrior class benefits heavily from slash since melee-range hits get +50% damage (within 200px) or +20% (within 350px).

#### Beam
- **Mana: 10 · Control: 4**
- Continuous line drawn from spawn point, rotating at `beamAngle` with length = `beamLen`.
- **Unique hitbox:** Checked as line segments every 40px along the beam's length, not as a circle.
- Deals **-35% damage** (0.65× multiplier) to compensate for hitting multiple targets simultaneously.
- Naturally homes toward the nearest enemy by adjusting its angle.
- **Niche:** The beam shape is one of the few shapes that can hit multiple enemies in a line per frame. Excellent for hallway fights. Affected by ceiling/floor collision — the beam stops at walls.

#### Ring
- **Mana: 12 · Control: 5 · Requires: Sun Medallion**
- Expanding circular ring that grows over its lifetime. Final radius = `(age / maxAge) × width × 8`.
- Hitbox is a circle at the expanding radius — hits enemies as the ring passes through them.
- **Niche:** In a domain expansion, ring causes projectiles to spawn **from the domain's center point** rather than random positions. Good for radial AoE warning zones.

#### Cone
- **Mana: 10 · Control: 4 · Requires: Sun Medallion**
- Triangle shape that expands over time: width = `(age / maxAge) × 200 × width`, height = 40% of width.
- **Directional hitbox:** Triangular area check, not circular. Points forward (toward cursor aim) or downward (if rain behavior).
- **Special rain/barrage interaction:** When combined with rain or barrage behavior, the cone's horizontal velocity is zeroed — it points straight down instead of forward.
- **Niche:** The only shape with a true triangular hitbox. Best for wide-angle breath/blast attacks. Pairs well with `straight` behavior for a spreading flame breath.

#### Wall
- **Mana: 12 · Control: 6 · Requires: Celestial Robe**
- Large vertical rectangle (width × 2 wide, height × 6 tall) with a visible border.
- **Rectangular hitbox** (extends ±width horizontally, ±height × 3 vertically).
- **Blocks enemy projectiles** on contact. Functions as a physical barrier.
- **Niche:** In a domain expansion, wall shape makes the entire domain **50% larger** (1.5× size multiplier). As a normal spell, it's a defensive tool — place it between you and enemies to absorb incoming fire. Combine with `stationary` behavior for a lasting barricade.

#### Solidify (Platform)
- **Mana: 10 · Control: 4**
- Flat rectangle (width × 3 wide, height × 1.5 tall).
- Rectangular hitbox (±width × 1.5, ±height × 0.75). Deals no damage.
- **Becomes a solid platform** the player can physically stand on. Creates temporary terrain.
- **Niche:** Pure utility. Use it to reach high places, create bridges, or block off paths. The platform disappears when the projectile's duration expires.

#### Nova
- **Mana: 15 · Control: 7**
- Expanding filled circle + outer stroke ring. Grows like ring: `(age / maxAge) × width × 8`.
- Hitbox matches the expanding radius — damages everything inside the expanding sphere.
- **Niche:** In a domain expansion, nova triggers an **instant shockwave on activation** that hits all enemies inside the domain for `power × 5` damage and knocks them away from center with 40 shockwave particles. The most explosive domain opener.

#### Meteor
- **Mana: 16 · Control: 6 · Requires: Stardust Staff**
- Rocky sphere with a heat glow, molten interior, and core detail. Rotates to face velocity.
- **Larger hitbox** than default (radius = max(width, height) × 1.5).
- Deals **-25% base damage** (0.75× nerf), but gets **up to +200% bonus damage** based on distance traveled (calculated as `1 + min(distance / 300, 2.0)`). The farther it flies, the harder it hits.
- **Splash explosion on hit:** Deals 50% of its damage in an AoE splash to nearby enemies.
- **Niche:** In a domain expansion, meteor projectiles **rain from the top of the domain** downward with a +75% damage bonus. Also forced to `straight` behavior in domains (not converted to homing). Best for long-range bombardment — pair with `lob` behavior for maximum distance bonus.

#### Vortex
- **Mana: 18 · Control: 7 · Requires: Void Staff**
- Dark void gradient ring with rotating distortion tendrils and crackling energy.
- **Growing hitbox:** radius = `width × 3 + width × 2 × (age / maxAge)`. Gets bigger over time.
- Automatically **slows itself** (velocity × 0.985 per frame) — gradually comes to a halt.
- **Pulls enemies** toward its center every frame. Deals damage-over-time to enemies in range (every 20 frames).
- **Niche:** In a domain expansion, vortex creates a continuous **pull-to-center effect** (1.5 pull strength per frame) on all enemies inside the domain for the entire duration. A crowd control domain.

#### Chain
- **Mana: 18 · Control: 9 · Requires: Elder Staff**
- Visually identical to missile (small circle, radius = width × 0.7).
- **Bounces between enemies**: after hitting one target, it seeks the nearest unhit enemy within 500px and redirects toward them. Chains up to `chainMax` times (default 3). Resets pierce tracking every 60 frames.
- Customizable `chainStunTime` property — adds stun to each chain link (costs +25 mana per point of stun time).
- **Niche:** In a domain expansion, chain shape applies a **30-frame stun** to all grounded enemies inside the domain every pulse. High mana cost but devastating crowd control. Best for multi-enemy encounters.

#### Summon
- **Mana: 20 · Control: 8**
- Rotating circles with radiating spokes and a glow effect.
- **No direct hitbox** — does not damage enemies. Instead, spawns an allied minion entity.
- Minions fire the spell's **next phase** as their attack. The summon itself is just a delivery mechanism.
- **Niche:** In a domain expansion with `summon` shape + Necromancer class, the domain spawns **3 powerful enemy allies** from your bestiary over its duration (first at 2s, then every ~18s). Summon power scales at `(phase power) × 2.5`. Without Necromancer class, summon in domain has no special behavior.

#### Same
- **Mana: 0 · Control: 0**
- Reuses the shape from the previous phase. Costs nothing extra.
- **Niche:** In a domain expansion, `same` shape creates a **buff-only domain** — no projectile waves spawn at all. The domain purely provides the movement speed, damage, and damage reduction buffs without any automatic attacks. Useful when you want domain buffs without the mana cost of wave projectiles.

---

### Behaviors (16 types)

The behavior controls how the projectile moves through space after being spawned.

#### Straight
- **Mana: 0 · Control: 0**
- Travels in a constant direction toward where your cursor was aimed at cast time.
- No damage modifier. The simplest and cheapest option.
- **Niche:** Always reliable. The baseline everything else is measured against. In a domain, most shapes get force-converted to homing, but `straight` is used for spike and meteor shapes.

#### Lob / Arc
- **Mana: 2 · Control: 1**
- Fires in the aimed direction but applies +0.25 gravity per frame, creating a parabolic arc.
- **+25% damage bonus** to compensate for the difficulty of aiming arcs.
- **Niche:** The gravity makes projectiles naturally fall toward ground-level enemies. Pairs excellently with `meteor` shape since lob gives you distance (for meteor's distance bonus) plus lob's own +25%. The two stack multiplicatively.

#### Homing
- **Mana: 5 · Control: 3**
- Curves toward the nearest valid target (enemy, dummy, or slime) with a maximum turn rate of 12° per frame, scaled to the projectile's speed.
- **-50% damage penalty** — the tradeoff for guaranteed hits.
- **Niche:** In domain expansions, almost all projectile shapes get force-converted to homing behavior (exceptions: meteor and spike keep straight). This makes homing the de-facto domain behavior. The -50% penalty still applies to domain projectiles, which is why meteor domains (forced straight) deal more per-projectile damage.

#### Boomerang
- **Mana: 4 · Control: 3 · Requires: Chaos Orb**
- Travels outward in a straight line, then **returns to the player** at 45% of its total lifetime.
- Resets its `hitTargets` set on the return trip — can hit the same enemy twice (once going out, once coming back).
- **Niche:** Effectively doubles your hit count on a single enemy. Synergizes with effects that trigger per-hit like `lifesteal`, `burn`, and `damageStore`.

#### Ground Surge
- **Mana: 5 · Control: 4 · Requires: World Seed**
- Applies +0.6 gravity per frame but **bounces** off the ground and platforms (reverses to -1.5 vertical velocity on impact).
- Rolls along the floor in low bouncing arcs. Horizontal velocity is frozen on initial contact until it hits something.
- **Niche:** Automatically follows terrain contours. Good for clearing ground-level enemies in uneven environments. Less useful against flying enemies.

#### Orbit Caster
- **Mana: 8 · Control: 6**
- Circles around the player at `orbitRadius` (default 80px) with `orbitSpeed` (default 3) for `orbitDuration` (default 1.5 seconds).
- After the orbit duration expires, the projectile **launches toward the nearest enemy**.
- **-30% damage penalty** during and after orbit.
- **Tunable:** `orbitRadius` (50–150), `orbitSpeed` (1–10), `orbitDuration` (0.5–3 seconds).
- **Niche:** Creates a defensive shield that then becomes offensive. High count + orbit = protective ring of projectiles. The launch phase inherits homing-like targeting.

#### Rain Down
- **Mana: 8 · Control: 7**
- Spawns projectiles high above the player (y = origin - 150px) spread across an area. Projectiles fall straight down with ±0.8 random horizontal drift.
- **+50% damage bonus** — highest damage multiplier of any behavior.
- Cone and beam shapes have their horizontal velocity zeroed when combined with rain, pointing straight down.
- **Niche:** The +50% damage is enormous. Pair with high-power meteor shape for devastating area bombardment. The tradeoff is unpredictability — you can't precisely aim where rain lands. Best in large rooms.

#### Barrage
- **Mana: 8 · Control: 7**
- Fires a horizontal wall of projectiles from your side (offset 120px in facing direction), spread vertically.
- **+35% damage bonus.**
- Like rain, cone and beam shapes get their horizontal velocity zeroed.
- **Niche:** Think of it as a sideways rain. Created for area control in hallways and corridors. The vertical spread covers a wide zone.

#### Stationary
- **Mana: 0 · Control: 0**
- Spawns at the cast point and stays fixed. No velocity. Lingers for full duration.
- No damage modifier. Acts as a persistent area-of-effect zone.
- **Niche:** Combine with `wall` shape for a lasting barrier, or `vortex` shape for a stationary gravity pull. Also great for `nova` — a stationary expanding explosion.

#### Underfoot
- **Mana: 3 · Control: 2**
- Spawns directly at the player's feet (y = player.y + height + 4). Pinned to player position, zero velocity.
- **Niche:** Primarily for self-buffs and defensive effects. Combine with `shield`, `healSelf`, or `ally orb` shape for reliable self-targeting. The projectile follows you since it's pinned.

#### Self Cast
- **Mana: 2 · Control: 1**
- Spawns at the player's center and stays pinned. Triggers player-targeting effects like `healSelf`, `shield`, `forceJump`, and `damageHeal`.
- **Niche:** The dedicated healing/buff behavior. No offensive capability. Use with ally orb + healSelf for a pure heal, or with forceJump for a rocket-jump effect.

#### Around Self
- **Mana: 5 · Control: 3**
- Spawns a ring of projectiles orbiting the player. Each is evenly spaced around a circle at `aroundSelfRadius` (default 50px).
- The total count is determined by the phase's `count` parameter — that many projectiles orbit simultaneously.
- Unlike Orbit Caster, these never launch. They stay orbiting until duration expires.
- **Tunable:** `aroundSelfCount` (2–8), `aroundSelfRadius` (30–150).
- **Niche:** Defensive ring that damages anything that touches you. Combine with `burn` or `freeze` effects for a persistent elemental aura.

#### Ground
- **Mana: 4 · Control: 3**
- Auto-locks to the nearest enemy within `groundRadius` (default 200px) and erupts upward from the ground at their position.
- If no enemy is in range, erupts at the player's position instead.
- **+40% damage bonus** and **3× duration multiplier.**
- **Tunable:** `groundRadius` (100–500), `groundAutoLock` (true/false).
- **Niche:** The auto-targeting makes this very consistent. The +40% damage and 3× duration are excellent. Best with spike or nova shapes for ground-eruption effects.

#### Zigzag
- **Mana: 5 · Control: 4**
- Moves in the aimed direction but oscillates sideways in a sine wave. Amplitude = `40 + width × 0.5`, frequency = 0.09 radians/frame.
- **Niche:** Harder for enemies to dodge (in PvP contexts). The weaving path also gives wider coverage than straight. Larger projectiles (higher width) zigzag with wider amplitude.

#### Teleport
- **Mana: 7 · Control: 6 · Requires: Celestial Robe**
- Blinks forward 60px every 20 frames along its aim direction. Between blinks, it's invisible/intangible.
- Automatically **re-aims at nearby enemies** after each blink — has built-in homing between teleport jumps.
- Spawns visual particles on each teleport.
- Auto-advances to the next phase on enemy contact.
- **Niche:** Bypasses obstacles and closes gaps. The periodic re-targeting makes it semi-homing without the -50% damage penalty. One of the stronger advanced behaviors.

#### Domain
- **Mana: 1000 · Control: 10**
- Must be the **first phase (Phase 0)** of a spell. Can only be cast as an **Ultimate** (slot 10).
- Creates a massive domain expansion field. See the **Domain Expansion** section below for full details.

---

### Effects (24 types)

Effects are applied on-hit (or on-cast for self-targeting effects). Each phase can have multiple effects, but some categories are exclusive (only one per phase):

- **Elemental** (exclusive): burn, freeze, poison, stun, shatter
- **Movement** (exclusive): knockback, pull, forceJump, horizontalLaunch, gravityWell
- **Support**: healSelf, shield, lifesteal
- **Store**: damageStore, damageRelease, damageHeal
- **Utility**: timedRelease, phaseFork, resetProjectiles, phaseThrough, ricochet, dispel, randomDelay
- **CC**: mark

Each effect has `effectPower` and `effectDuration` multiplier sliders that scale its strength.

#### Burn
- **Mana: 5 · Control: 2** · Elemental
- Applies fire damage-over-time to the target. Deals **5 ticks** at intervals of 60 frames.
- Total burn damage = 50% of the base hit damage × `effectDuration` multiplier, divided across 5 ticks.
- If the player gets hit by a burn effect, they take **20% of the tick damage**.
- **Niche:** Stacks favorably with boomerang (double application on out + return). The `effectDuration` slider directly multiplies total burn damage, making it one of the most scalable effects. Vow elemental damage bonus (+7% per point) applies to burn spells.

#### Freeze
- **Mana: 5 · Control: 2** · Elemental
- Slows enemy movement to **50% speed** and prevents attacks for the duration.
- Duration = 90 frames × `effectDuration` multiplier. Maximum duration wins if reapplied (doesn't stack additively).
- **Niche:** Pure crowd control. The slow lasts 1.5 seconds base — long enough to create safe windows. Best on fast, high-count projectiles to keep the slow permanently refreshed.

#### Poison
- **Mana: 5 · Control: 3** · Elemental
- Applies poison DoT. Deals **6 ticks** at intervals of 75 frames (slower than burn but more ticks).
- Total poison damage = 40% of base hit damage × `effectDuration`, divided across 6 ticks.
- Visual: Green cloud appears over poisoned enemies. If the player is poisoned, same green cloud.
- **Niche:** Slightly less total damage than burn but lasts longer (6 ticks × 75 = 450 frames vs burn's 5 × 60 = 300 frames). Better for sustained pressure.

#### Stun
- **Mana: 7 · Control: 5** · Elemental
- Prevents all enemy actions (movement, attacks, AI decisions) for the duration.
- Duration = 60 frames × `effectDuration` multiplier (1 second base). Yellow text indicator appears.
- **Niche:** The most powerful CC effect. Unlike freeze (which only slows), stun completely locks the target. Higher mana/control cost is justified. Best on chain shape (which can stun multiple targets in sequence).

#### Knockback
- **Mana: 3 · Control: 1** · Movement
- Pushes the enemy horizontally away from the caster. Displacement = `facing × 40 × effectPower × ultMultiplier`.
- Instant, no ramp-up — enemy is shoved immediately.
- **Niche:** Cheap defensive tool. Keep enemies at range. Pairs well with meteor (knock them away to get distance bonus on the next meteor shot).

#### Pull
- **Mana: 4 · Control: 3** · Movement
- Drags the enemy toward the player. Force = `50 × effectPower` horizontal + `30 × effectPower` vertical.
- **Niche:** The opposite of knockback. Group enemies together for AoE follow-up. Combine with nova or ring on the next phase for a pull → explosion combo.

#### Force Jump
- **Mana: 4 · Control: 2** · Movement
- Launches the target upward. Force = `60 × effectPower × ultMultiplier`.
- When applied to the player (via self-cast), gives an enhanced jump boost instead.
- **Niche:** Repositioning tool. Launch enemies into the air where they can't attack, or use it on yourself as a rocket jump. Self-cast + forceJump is a mobility tool.

#### Horizontal Launch
- **Mana: 5 · Control: 2** · Movement
- Launches the enemy/player based on the **projectile's direction** (not the caster's facing).
- Force = `projectile.power × 3.5 × effectPower × ultMultiplier`.
- **Niche:** Differs from knockback in that the launch direction follows the projectile, not the caster. A homing missile that curves around will launch the enemy in the direction it was traveling on impact.

#### Lifesteal
- **Mana: 8 · Control: 6** · Support · Requires: Blood Staff
- Heals the player for **20% of damage dealt** × `effectPower` × `ultMultiplier`.
- Shows pink healing numbers. Stacks with vow spellVamp bonus.
- **Niche:** Sustain in prolonged fights. Best on high-damage, multi-hit spells (rain + high count) for massive healing throughput. The 20% base rate scales with effectPower, so maxing effectPower can push it toward 40%+.

#### Heal Self
- **Mana: 6 · Control: 4** · Support · Requires: Phoenix Feather
- Heals the player for `power × 5 × effectPower × ultMultiplier × healerBoost`.
- Healer class gets **+40% healing** on this effect.
- Green healing numbers appear. Must be on an `allyOrb` shape or `selfCast`/`underfoot` behavior.
- **Niche:** Direct healing — the only way to cast a dedicated heal spell. Power slider directly controls heal amount. Healer class makes this 40% stronger, making it the class's core mechanic.

#### Shield
- **Mana: 6 · Control: 4** · Support
- Grants a temporary damage-absorbing shield: `power × 3 × effectPower × ultMultiplier` points.
- Displays as a blue shield bar. Absorbs damage before HP. Decays over time.
- **Niche:** Stacks with existing shield. Casting shield repeatedly builds up a large absorb buffer. Best on fast-cooldown, low-cost spells for constant shield refreshing.

#### Damage Store
- **Mana: 4 · Control: 2** · Store · Requires: Phoenix Feather
- Accumulates a percentage of all damage dealt into a stored pool.
- Default: 50% of each hit stored. Tunable via `damageStorePercent` (10%–100%).
- Stored damage appears as a ⚡ overlay on your character.
- **Niche:** Does nothing by itself — requires `damageRelease` or `damageHeal` on another spell to consume the stored pool. Build up massive stored damage, then release it all at once.

#### Damage Release
- **Mana: 6 · Control: 4** · Store · Requires: Phoenix Feather
- Consumes all stored damage. Adds **+1 damage per 500 stored** as a flat bonus to the hit.
- Also slightly increases projectile size on release for visual feedback.
- Resets `damageStored` to 0 after consumption.
- **Niche:** The payoff for damageStore. Build up damage with rapid-fire spells on one slot, then release it with a big single-hit spell on another slot. The bonus is multiplied into the full damage formula.

#### Damage Heal
- **Mana: 5 · Control: 3** · Store · Requires: Phoenix Feather
- Converts stored damage into healing: `damageStored × 0.5 × healerBoost`.
- Must be on an ally orb. Healer class gets the +40% bonus here too.
- **Niche:** Alternative to damageRelease — trade offense for sustain. Store damage with combat spells, then heal with an ally orb + damageHeal spell.

#### Timed Release
- **Mana: 3 · Control: 2** · Utility
- Delays all hits by `timedReleaseDelay` frames (default 0.5 seconds / 30 frames). The projectile's maxAge is auto-extended to accommodate the delay.
- **Niche:** Queue up multiple projectiles on a target, then they all hit simultaneously when the timer expires. Useful for overwhelming burst damage that bypasses per-hit diminishing returns.

#### Phase Fork
- **Mana: 6 · Control: 5** · Utility · Requires: Eye of Eternity
- When the current phase triggers its next phase, the original projectile **continues existing** instead of being consumed.
- `phaseForkRepeats` controls how many times the fork spawns (each adds +35 mana cost).
- **Niche:** Creates branching spell trees. Phase 0 fires a homing orb → on hit, it forks: the orb keeps going AND a nova explodes at the impact point. Without phaseFork, the orb would be consumed.

#### Reset Projectiles
- **Mana: 0 · Control: 0** · Utility
- When the next phase triggers, instead of morphing the existing projectile, **fresh projectiles spawn** at the trigger point.
- Also resets `hitTargets`, allowing the new phase to hit enemies that were already hit by the previous phase.
- **Niche:** Required for phase transitions that should feel like a new spell being cast (e.g., an explosion spawning new projectiles) rather than the same projectile transforming.

#### Phase Through
- **Mana: 20 · Control: 6** · Utility · Requires: Void Robe
- Allows the projectile to pass through solid walls and platforms freely.
- **-45% damage penalty** unless the projectile was spawned by a domain expansion (domain projectiles get phaseThrough free, no penalty).
- **Niche:** Bypasses terrain. Expensive but essential in tilemap dungeons where walls would otherwise block your shots. In domains, projectiles naturally phase through (no cost needed).

#### Dispel
- **Mana: 8 · Control: 4** · Utility
- Destroys enemy projectiles and spell walls on contact within an AoE radius = `max(width, height) × 0.8`.
- Shows a 🚫 indicator and purple impact visual.
- **Niche:** Anti-projectile defense. Shoot a dispel missile into incoming enemy fire to clear it. Larger projectiles (higher width/height) create larger dispel zones.

#### Ricochet
- **Mana: 18 · Control: 6** · Utility · Requires: Chaos Orb
- Reflects off walls and solid surfaces. Bounces at the wall's angle and resets pierce tracking on each bounce.
- Maximum 1 bounce per wall contact. Maintains velocity through bounces.
- **Niche:** Excellent in enclosed spaces — the projectile keeps bouncing and hitting. Combine with high-duration for maximum bounces. Works well in pyramid corridors and tight dungeon rooms.

#### Shatter
- **Mana: 8 · Control: 6** · Elemental · Requires: Dragon Heart
- When an enemy dies while shatter is applied, the enemy explodes into **fragments** that deal area damage.
- Stores `power × 0.3` + the projectile's color for the fragment explosion.
- **Niche:** Chain-reaction potential. If shatter fragments kill another shattered enemy, it chains. Best on high-power spells fighting groups of weaker enemies.

#### Gravity Well
- **Mana: 10 · Control: 7** · Movement · Requires: World Seed
- Creates a persistent **pull zone** at the impact point with a 120px radius.
- The well lasts 120 frames (2 seconds). Power affects pull strength.
- Animated as a dark void with spinning rings.
- **Niche:** Area denial + crowd control. Drop a gravity well in a corridor, then follow up with rain or nova on the clustered enemies. Unlike pull (instant), gravity well is persistent and affects all enemies in range over time.

#### Mark
- **Mana: 5 · Control: 4** · CC · Requires: Eye of Eternity
- Tags the enemy with a debuff marker. Marked enemies take increased incoming damage.
- **Niche:** Currently a combo-setup mechanic. Mark a tough enemy, then switch to your damage spell — the mark increases all subsequent damage.

---

### Damage Formula

Every projectile hit runs through this formula:

```
Final Damage = power × 8 × [all multipliers below]
```

| Multiplier | Value | When |
|---|---|---|
| Magic Power | `1 + magicPower × 0.08` | Always (stat-based) |
| Homing penalty | `× 0.5` | Homing behavior |
| Lob bonus | `× 1.25` | Lob behavior |
| Orbit penalty | `× 0.7` | Orbit behavior |
| Rain bonus | `× 1.5` | Rain behavior |
| Barrage bonus | `× 1.35` | Barrage behavior |
| Beam penalty | `× 0.65` | Beam shape |
| Meteor base nerf | `× 0.75` | Meteor shape |
| Meteor distance bonus | `× (1 + min(dist/300, 2.0))` | Meteor shape (up to +200%) |
| Phase-through penalty | `× 0.55` | phaseThrough effect (non-domain) |
| Spread bonus | `× (1 + spread × 0.0025 × count)` | Multi-projectile spread |
| Diminishing returns | `× 1 / (1 + hitNum × 0.04)` | Each successive hit on same target |
| Domain active | `× 1.3` | Player inside active domain |
| Domain element match | `× 1.5 – 2.25` | Spell element matches domain element |
| Same-shape domain | `× 1.3` | Projectile shape matches domain shape |
| Dominion class | `× 1.4` | Domain projectiles + Dominion Master class |
| Ranger distance | `× (1 + min(dist/1000, 0.8))` | Ranger class (up to +80%) |
| Warrior melee | `× 1.5 / 1.2 / 1.0` | Warrior class (<200px / <350px / >350px) |
| Vow power boost | `× (1 + vowPower × 0.12)` | Per-slot vow power boost |
| Vow elemental | `× (1 + vowElemDmg × 0.07)` | Elemental effect + vow boost |
| Item boost | Varies | Equipped item multiplier |

**Domain projectiles** skip diminishing returns (dimMult always = 1).

---

### Trails & After-Hit Visuals

**Trails** add particle effects behind moving projectiles:

| Trail | Color | Description |
|---|---|---|
| **none** | — | No trail |
| **sparkle** | Light blue (200,220,255) | Magical sparkle particles; 25% spawn rate per frame |
| **flame** | Orange (255,140,50) | Fire particles; 25% spawn rate |
| **smoke** | Gray (100,100,100) | Subtle smoke puffs |
| **ice** | Cyan (150,220,255) | Frosty crystalline trail |
| **lightning** | Purple-white (180,180,255) | Electric arc particles; 25% spawn rate |

**After-hit visuals** play on impact:
- `none`, `explosion`, `flame_burst`, `ice_shatter`, `electric_spark`, `poison_cloud`, `star_burst`

---

### Domain Expansion

Domain Expansion is the most powerful mechanic in Magic Battle. It creates a massive reality-warping field that alters the battlefield for 60 seconds.

#### How to Set Up a Domain

1. Create a spell with **Phase 0 behavior = "domain"**. This must be your ultimate (slot 10).
2. The Phase 0 shape determines the **domain's special effect** (see table below).
3. Phase 1+ defines what projectiles the domain automatically spawns in waves.
4. Hold down cast to charge your ultimate, then release to expand.

#### Activation Cost

- **1000 base mana** for the domain behavior alone.
- Plus all shape/effect costs from other phases, multiplied by the multi-phase formula.
- Necromancer class doubles the ultimate cost (paying 20k+ instead of 10k+).
- Consumes your total accumulated mana pool (not regular mana).

#### What Happens Inside a Domain

| Effect | Value |
|---|---|
| **Spell damage boost** | +30% to all your spells |
| **Movement speed boost** | +40% player movement |
| **Incoming damage reduction** | -35% damage taken |
| **Platform removal** | All platforms inside the domain boundary vanish (restored on collapse) |
| **Duration** | 60 seconds (3600 frames) |
| **Size** | 1.8× canvas width/height (Dominion class: +30% larger) |
| **Screen shake** | Intensity 25–30 for 45–50 frames on activation |

#### Domain Shape Effects

The shape you choose for Phase 0 determines the domain's unique mechanic:

| Shape | Domain Effect |
|---|---|
| **Nova** | Instant shockwave on activation — damages all enemies for `power × 5`, knocks them away, 40 shockwave particles |
| **Vortex** | Continuous pull-to-center (1.5 strength/frame) for entire domain duration |
| **Polygon** | Continuous push-from-center (1.2 strength/frame) — scatter enemies outward |
| **Chain** | Periodic 30-frame stun on all grounded enemies inside domain |
| **Wall** | Domain is 50% larger (1.5× multiplier stacks with Dominion's 1.3×) |
| **Same** | Buff-only domain — no projectile waves, just the stat boosts |
| **Spike** | Projectile waves erupt upward from the ground |
| **Meteor** | Projectile waves rain from the top of the domain (+75% damage) |
| **Ring** | Projectile waves spawn from domain center outward |
| **Other** | Projectile waves spawn at random positions throughout the domain |

#### Domain Projectile Waves

Over the 60-second duration, the domain fires **35 waves** of projectiles from Phase 1+:
- Waves spawn every 80–130 frames (1.3–2.2 seconds apart).
- All projectiles are **forced to homing behavior** (exceptions: meteor and spike keep straight).
- Domain projectiles **bypass diminishing returns** (no damage reduction from multi-hit).
- Domain projectiles with `phaseThrough` effect get **no damage penalty** (normally -45%).
- Power is capped at `10 × (1 + magicPower × 0.08) × vowPowerMult` per projectile.

#### Element Matching

The domain has an element (from `domainElement`, default "burn"). When your spells match the domain's element:
- **Matching element** (e.g., burn spell in burn domain): **225% damage** (2.25×)
- **Any spell in active domain**: **150% damage** (1.5×) minimum

#### Domain Collapse

After 60 seconds, the domain collapses:
- "Domain Collapse" message appears.
- All hidden platforms are restored.
- All buffs end instantly.

---

### Vows — Sacrifice & Power

Vows are sacred contracts where you **sacrifice something to gain power**. You have **3 vow slots**, each containing one sacrifice and one or more boosts.

#### Sacrifice Types (What You Give Up)

| Sacrifice | Effect | Details |
|---|---|---|
| **Health** | Reduces max HP by a percentage | Caps at 90% HP loss. A 50-point health sacrifice = 50% less max HP. |
| **Max Mana** | Reduces your mana pool | Applied as: `max(100, 1500 - penalty)`. Even at maximum sacrifice, you keep 100 mana. |
| **Spell Slots** | Locks specific spell slots | Locked slots show 🔒 and cannot be cast. Frees up vow points to boost remaining slots. |
| **Effects** | Removes specific effects from all spells | Any spell with a locked effect has that effect stripped on cast. |
| **Shapes** | Bans specific shapes | Any spell using a banned shape gets forcibly converted to `missile`. |
| **Movement** | Reduces movement speed | -1% speed per point of penalty (minimum 50% speed). |
| **Visibility** | Creates fog-of-war overlay | Strength = `min(penalty, 60) / 100`. At 60+, you can barely see beyond your character. |
| **Item Slots** | Disables equipment slots | Sacrificed slots cannot equip items. Lose those stat bonuses. |

#### Boost Types — Global (Apply to All Spells)

| Boost | Per Point | Details |
|---|---|---|
| **Max Health** | +8% bonus HP | `vowMaxHealthBonus += amount × 8` |
| **Jump Height** | +8% jump boost | Stacks with items and class bonuses |
| **Player Speed** | +8% movement speed | Stacks multiplicatively with movement penalty if both are vowed |
| **Defense** | -5% damage taken | Caps at 70% damage reduction (min 30% damage taken) |
| **Elemental Damage** | +7% for burn/freeze/poison/stun spells | Only applies to spells that have an elemental effect |
| **Crit Chance** | Flat crit % increase | Adds to base critical hit chance |
| **Spell Vamp** | Healing on damage dealt | Passive lifesteal from all spell damage |
| **Thorns** | Damage reflection | Enemies take damage when they hit you |
| **Mana Efficiency** | -2.5% mana cost on all spells | Global cost reducer, stacks with Magic Control discount |

#### Boost Types — Per-Spell-Slot (Apply to One Slot Only)

These are assigned to a specific spell slot via `targetSlot`:

| Boost | Per Point | Details |
|---|---|---|
| **Power** | +12% damage | Multiplicative with all other damage bonuses |
| **Size** | +10% projectile size | Bigger hitboxes = easier to hit |
| **Speed** | +10% projectile velocity | Faster projectiles reach targets sooner |
| **Count** | +1 projectile (flat) | Capped at 20 total. Extra projectiles = extra hits |
| **Duration** | +10% projectile lifetime | Longer-lived projectiles travel farther and persist longer |
| **Effects** | +15% effect power/duration | Burn ticks harder, freeze lasts longer, etc. |
| **Mana Cost** | -5% mana cost for this slot | Slot-specific discount on top of global efficiency |
| **Cooldown** | -8% cooldown for this slot | Cast this spell more frequently |
| **Size Bonus** | +50% size (if flagged) | Binary flag — either on or off, gives flat 50% |

#### Vow Strategy

The key to vows is **specialization**. Lock away things you don't use to supercharge things you do:
- Lock 3 spell slots you never cast → boost the 2 spells you rely on with +power, +count, +effects.
- Sacrifice HP → gain defense (you end up roughly the same survivability but with extra room for offensive boosts).
- Ban shapes you never use → free points for elemental damage boosts.
- Sacrifice visibility → gain mana efficiency for nearly free spells (if you can handle the fog).

---

### Mage Classes

Classes provide permanent passive bonuses that affect every spell you cast, your movement, survivability, and how certain mechanics interact. You choose a class via the class NPC and can change it at any time. Classes affect all spell slots simultaneously, not just specific spells.

There are **7 classes** (plus the classless default). Some bonuses are purely numerical, while others add entirely new mechanics — read each carefully before committing.

---

#### None / Unspecialized ⚪
No bonuses, no penalties, no restrictions. A blank slate for players who want pure freedom to mix any shapes, behaviors, and effects without any trade-offs. Ideal during early experimentation.

---

#### Warrior ⚔️
Close-range combat specialist. The Warrior class transforms Magic Battle into a high-aggression melee-centric style. Every stat bonus pushes you toward getting inside an enemy's guard, landing point-blank spells, and dominating with physical combos.

**Passive Bonuses:**
- **Movement speed:** Highest of all classes — closes distance faster than anyone.
- **Defence:** Flat defence bonus, making melee range survivable despite the constant proximity to danger.
- **Spell range reduced:** All spell durations and max travel distances are cut. Your spells don't perform well at long range by design — this is intentional pressure to fight up close.
- **Melee damage bonus:** Spells that hit within **200px** deal **+50% damage**. Hits within **350px** deal **+20%**. Beyond 350px, no bonus (and reduced range means most spells won't reach farther anyway).

**Active Mechanics:**
- **Spell Blade (F key):** Press F to swing a Spell Blade that deals melee damage AND reflects nearby enemy projectiles back at them. Invaluable for both offense and defense.
- **Blade Combo:** Successive close-range hits build a melee combo, granting bonus melee damage per stack.
- **Backstep Anchors (Lightstep Blade item only):** When using the Lightstep Blade staff, melee attacks plant a warp anchor at the attack point. Press **B** to teleport back to your most recent anchor — a high-skill repositioning tool.

**Best Shape + Behavior + Effect Combinations:**

| Category | Option | Synergy |
|---|---|---|
| **Behavior** | Underfoot 👣 | **BEST** — spawns directly at your feet, always in melee range, always full +50% |
| **Behavior** | Orbit 🔄 | **Great** — circles your position at melee distance, full damage bonus the entire time |
| **Behavior** | Straight 💫 | **Good** — fire point-blank at an adjacent enemy for the melee range bonus |
| **Behavior** | Rain 🌧️ | **AVOID** — rain falls from above after long travel; it lands past the 350px threshold with no bonus |
| **Shape** | Chain ⛓️ | Chain stun is a melee setup tool — stun an enemy, then press F for Spell Blade while they're locked |
| **Effect** | Pull 🧲 | **BEST** — drags enemies directly into your melee zone, making the range bonus reliable without you running to them |
| **Effect** | Knockback 💨 | **AVOID** — sends enemies away from you, directly contradicting the Warrior's need for closeness |

**Playstyle:** Get in, stay in. Max melee is 200px — roughly the distance of one enemy sprite. Pair Pull with an entry spell and Underfoot/Orbit as your main damage dealers. The Spell Blade (F) makes your defensive pressure constant — tanks incoming fire while building counter-damage. Run the Lightstep Blade staff for the Backstep warp if you want a full melee-assassin experience.

---

#### Ranger 🏹
Swift and precise. Ranger is the opposite philosophy to Warrior — every stat pushes projectiles as far as possible, and damage scales steeply with travel distance.

**Passive Bonuses:**
- **Spell range and duration +60%:** Projectiles fly farther and last longer before expiring.
- **Distance damage scaling:** All spells deal increasing damage the farther they travel (up to **+80% damage** at 1000px, scaling linearly).
- **Max HP reduced:** Slight HP penalty as the trade-off for the potent distance bonus — getting hit is expensive.

**Best Shape + Behavior Combinations:**

| Category | Option | Synergy |
|---|---|---|
| **Shape** | Meteor ☄️ | **BEST** — Meteor has its own distance scaling (up to +200%). Ranger's bonus stacks on top for extreme multipliers |
| **Behavior** | Straight 💫 | **BEST** — fire at max range toward a distant enemy for full Ranger distance bonus |
| **Behavior** | Rain 🌧️ | **Good** — rain projectiles fall from high above the screen, accumulating distance the whole vertical drop |
| **Behavior** | Orbit 🔄 | **Moderate** — orbit circles close then launches outward; only gains distance bonus from the launch phase |
| **Behavior** | Homing 🏠 | **AVOID** — homing locks onto nearby enemies, minimizing travel and negating most Ranger bonus |

**Playstyle:** Keep enemies at maximum range. Lob + Meteor is the iconic Ranger combo — both add distance bonus independently and multiplicatively. The +60% range means you can keep enemies at ranges they struggle to close before you kill them.

---

#### Healer 💚
Masters of restoration. Healer amplifies all recovery mechanics on the player and reduces incoming damage, making you nearly unkillable in extended fights.

**Passive Bonuses:**
- **Incoming damage reduced:** Takes less damage from all sources.
- **HealSelf effect amplified:** The `healSelf` effect heals for significantly more per hit.
- **Lifesteal rate increased:** Base 20% lifesteal rises further (stacks on top of Archmage's 30% and Vow Vamp bonuses).

**Best Shape + Behavior + Effect Combinations:**

| Category | Option | Synergy |
|---|---|---|
| **Shape** | Ally Orb 💚 | **BEST** — Ally Orb's healing projectiles are directly boosted by Healer amplification; use with Damage Heal for massive burst healing |
| **Behavior** | Beam ⚡ | **Great** — beam hits multiple times per second; each tick triggers the amplified HealSelf for constant HP recovery |
| **Effect** | HealSelf 💚 | Core effect — Healer amplifies this above all other classes |
| **Effect** | Lifesteal 🩸 | Passive sustain kept high on any damage-dealing spell |
| **Effect** | Damage Heal 💗 | Store damage with combat spells, convert to healing via Ally Orb; Healer boosts the 50% conversion rate further |

**Playstyle:** Run a dedicated heal spell (Ally Orb + selfCast/underfoot + healSelf) alongside your offensive spells. The reduced incoming damage and amplified healing create a virtuous loop — you shrug off hits and restore whatever gets through. Lifesteal on high-count spells covers the in-between.

---

#### Dominion Master 👁️
Controllers of the battlefield. Dominion Master is entirely defined by Domain Expansion — every bonus exists to make your ultimate bigger and more destructive.

**Passive Bonuses:**
- **Domain zone size +30%:** The domain field is 30% wider and taller than normal (stacks multiplicatively with the Wall shape's +50% bonus).
- **Domain sub-phase damage +40%:** Every projectile the domain fires from Phase 1+ deals 40% more damage.
- **No penalties.**

**Best Behavior and Combinations:**

| Category | Option | Synergy |
|---|---|---|
| **Behavior** | Domain ⚡ | The only class that meaningfully upgrades the domain itself — a Dominion domain at +30% size covers the entire screen |
| **Shape (P0)** | Same 🔄 | `Same` domain gives a +30% player damage buff; Dominion's +40% sub-phase bonus stacks on top — +70% total on all spells while active |
| **Shape (P0)** | Wall 🧱 | Wall's ×1.5 size multiplier × Dominion's ×1.3 = ×1.95 size (nearly double standard domain) |

**Playstyle:** Charge your ultimate through fast-cooldown normal spells, then expand. The domain covers an enormous area, and +40% on 35 waves of homing projectiles is devastating sustained DPS. Pair with Vow Domain boosts (range, power, duration, mana regen) for a fully specialized domain build.

---

#### Necromancer 💀
Masters of death magic. The Necromancer's summon mechanic is completely transformed — instead of generic minions, you raise defeated enemies from your Bestiary as undead servants.

**Passive Bonuses / Changed Mechanics:**
- **Summon shape raises Bestiary entries:** The Summon shape no longer creates generic AI minions. It raises actual enemies you've previously defeated as undead allies, inheriting their full stats scaled to your power.
- **Costs full current mana:** Each necro-summon consumes your entire current mana pool at cast time.
- **Max 3 necro-summons active simultaneously:** Raising a 4th will overwrite the weakest existing summon.
- **Bestiary requirement:** An enemy must have been defeated at least once before it can be raised.
- **Ultimate cost doubled:** Domain ultimates cost ×2 mana (20k+ instead of 10k+).

**Summon Domain interaction:**
When using Domain Expansion with a Summon shape, the domain raises **3 strong defeated enemies from the Bestiary** over the domain's duration (first at 2 seconds, then roughly every 18 seconds thereafter). Summon power at `phase power × 2.5`.

**Playstyle:** Farm hard, powerful enemies in the Bestiary. Build summon spells designed to raise specific opponents (e.g., dungeon boss types). The doubled ultimate cost is steep, but fighting alongside 3 boss-tier allies for 60 seconds changes fights entirely.

---

#### Archmage 🔮
Elemental spell master. Archmage gives the most mechanically rich bonuses — a blanket +5 Magic Control, a base +20% damage boost to all elemental spells, and a unique **secondary effect** for every single elemental type.

**Passive Bonuses:**
- **+5 Magic Control:** Unlocks higher-tier shapes, behaviors, and effects earlier than any other class. As Archmage you reach high-value effects before other classes pass those control thresholds.
- **+20% damage on elemental spells:** Applies to any spell with Burn, Freeze, Poison, Stun, Lifesteal, or Shatter equipped.
- **Elemental secondary effects:** Each elemental effect gains an extra behavior on top of its normal function (see below).
- **Summoned minion behaviors:** Minions summoned via the Summon shape inherit the spell's elemental effect type — burn minions apply burn DoT, ice minions slow, etc.

**Archmage Elemental Secondary Effects:**

| Effect | Standard Behavior | Archmage Bonus |
|---|---|---|
| **Burn 🔥** | Fire DoT over 5 ticks | Burning enemies receive a **heal-block** — they cannot regenerate HP or receive healing while the burn DoT is active |
| **Freeze ❄️** | Slows movement to 50% speed | Frozen/slowed enemies have their attacks **locked entirely** — they cannot fire projectiles or trigger contact-attack behaviors while frozen |
| **Poison ☠️** | Poison DoT over 6 ticks | Each successive tick **escalates by +15%** — early ticks are light, but sustained poison becomes exponentially deadlier over its full duration |
| **Stun ⚡** | Prevents all actions briefly | Stun highlights the enemy with a visual burst; the stun source projectile gets a brief speed boost. (Note: stun duration caps are kept intentionally short to prevent permanent lock.) |
| **Lifesteal 🩸** | Heals 20% of damage dealt | Lifesteal rate increases from **20% → 30%**. Additionally, every enemy whose life you steal is **blinded**, reducing their detection range |
| **Shatter 💎** | 12 shards on hit, 16-shard burst on kill | Each shard that hits an enemy **cascades into 3 additional micro-shards**, creating a chain reaction of crystal fragments that can devastate tightly grouped enemies |

**Playstyle:** Build around a single elemental effect and push it to its extreme. A Burn Archmage applies permanent heal-block making bosses unable to recover. A Shatter Archmage turns every group fight into an exponential crystal explosion. The +5 Magic Control makes this class the easiest to build high-complexity spell combos on — effects that normally require 5–6 control are accessible early.

---

#### Dual Class System

You can unlock a **second mage class** by assigning a **Vow Enhancement of type "Dual Class"** (costs **15 Vow Points**) in any vow slot. Both your primary and secondary class bonuses activate simultaneously for every spell cast.

**Setup:** Open any Vow slot → choose a sacrifice → select "Dual Class" as the Enhancement type → pick your secondary class. The vow point cost is deducted from the points the sacrifice generates — ensure you have 15 points remaining after the sacrifice.

**Limit:** Only **one Dual Class enhancement** is allowed across all vow slots at a time.

**Powerful Dual Class Combinations:**

| Combination | Why it works |
|---|---|
| **Archmage + Ranger** | Elemental +20% damage AND distance scaling stack multiplicatively. Long-range elemental casts deal maximum possible damage |
| **Necromancer + Archmage** | Necro-summons raised from Bestiary AND those minions gain full Archmage elemental behaviors matching the summon spell's effect |
| **Warrior + Ranger** | Maximum damage at both extremes — melee +50% within 200px AND Ranger distance bonus at range. Extreme risk/reward with a huge dead zone in between |
| **Dominion + Archmage** | +30%/+40% domain bonuses with elemental +20% on sub-phases. Massive domain DPS especially in element-matched domains |
| **Healer + Archmage** | Archmage pushes lifesteal to 30% on top of Healer's own amplification, plus burn's heal-block makes aggressive play self-sustaining |

---


### Item Grant Quick Map

Some shapes, behaviors, and effects require specific items equipped to unlock:

| Item | Unlocks |
|---|---|
| **Stardust Staff** | Meteor |
| **Void Staff** | Vortex |
| **Blood Staff** | Lifesteal, Leech Mana |
| **Elder Staff** | Chain |
| **Shadow Robe** | Blind |
| **Void Robe** | Phase Through |
| **Celestial Robe** | Teleport, Wall |
| **Chaos Orb** | Ricochet, Boomerang |
| **Sun Medallion** | Cone, Ring |
| **Moon Pendant** | Spiral, Zigzag |
| **Crystal Crown** | Polygon, Spike |
| **Phoenix Feather** | Heal Self, Damage Heal, Damage Store, Damage Release |
| **Dragon Heart** | Blade, Shatter |
| **World Seed** | Gravity Well, Ground Surge |
| **Eye of Eternity** | Phase Fork, Mark |

Items can also be unlocked through vows at a cost of **5 vow points per unlock**, bypassing the equipment requirement.

---

### Rank Unlocks

Shapes, behaviors, and effects are gated behind your player rank:

| Rank | Name | Shapes Unlocked | Behaviors Unlocked |
|---|---|---|---|
| 0 | Novice | Missile, Orb, Ally Orb, Same | Straight, Stationary, Self Cast |
| 1 | Apprentice | Blade, Spike, Polygon, Solidify, Slash | Lob, Underfoot |
| 2 | Adept | Beam, Cone, Wall | Homing, Boomerang, Ground Surge |
| 3 | Mage | Ring, Nova, Meteor | Around Self, Ground, Zigzag |
| 4 | Archmage | Chain, Vortex, Summon | Orbit, Rain, Barrage, Teleport |
| 5 | Grandmaster | — | Domain |

## AI Image Prompts

Use these prompts in your image model (DALL·E, Midjourney, SDXL, Firefly, etc.) if you want to regenerate/upgrade the art.

### 1) Main Menu Background
**File target:** `images/backgrounds/menu-bg.png` (or `.webp`)

**Prompt:**
> A wide cinematic dark-fantasy game menu background, 16:9 landscape, no characters and no text. A moonlit night over distant layered mountain ranges receding into atmospheric haze: nearest ridges sharp with cool slate rock and faint snow edges, mid-range peaks softened by indigo fog, farthest silhouettes almost black against the sky. A huge pale moon hangs slightly off-center, rim-lighting cloud layers and throwing long silver highlights across low-lying mist in the valleys. Subtle arcane energy streaks drift through the foreground like thin violet-cyan filaments, never crossing the empty central third so menu cards can sit cleanly. Palette is deep indigo, violet, midnight blue, and muted silver, with high contrast but midtones kept readable for UI overlays. Polished game concept-art lighting: strong moonlight key, soft fog fill, faint rim on mountain edges. Clean center composition, no logos, no watermark, no UI chrome.
> END OF PROMPT;

**Suggested settings:**
- Aspect ratio: `16:9`
- Resolution: `1920x1080` or higher

---

### 2) Sandbox Option Image
**File target:** `images/backgrounds/sandbox-card.png` (or `.webp`)

**Prompt:**
> Vertical 3:4 game menu card still of a fantasy magic training ground at night, no characters, no faces, no text, no logo. A quiet courtyard of dark stone tiles with floating runes and glowing practice pillars arranged in a shallow arc, each pillar carved from pale granite and banded with teal-cyan light. Soft spell circles lie on the floor as thin luminous rings, not solid objects. Cyan particle motes hang in still air like dust in moonlight. Materials: worn flagstone, polished rune-inlaid stone, faint metallic inlay on the pillars. Lighting is cool and experimental — a teal-blue key from the circles, soft moonlight fill, gentle bloom on the brightest glyphs. Composition is vertical and centered, with a clear empty mid-field for a card crop; pillars and runes frame the sides. Palette: teal, cyan, midnight blue, pale silver. Crisp concept-art style, no watermark.
> END OF PROMPT;

**Suggested settings:**
- Aspect ratio: `3:4` (or `4:5`)
- Resolution: `1024x1365` or higher

---

### 3) Inventory Option Image
**File target:** `images/backgrounds/inventory-card.png` (or `.webp`)

**Prompt:**
> Vertical 3:4 game menu card still of an arcane vault interior, no text, no logos, no watermark, no people. Tall dark-wood and black-iron shelves recede slightly, packed with floating relics, glass potion vials, and leather-bound enchanted tomes whose edges catch magenta light. A faint item-grid feeling comes from evenly spaced shelf bays and hovering gems, not from drawn UI. Materials: aged oak, tarnished brass fittings, cut glass, velvet-dark shadows between shelves. Lighting is a warm-purple interior: magenta and violet highlights on glass and metal, a single cooler shaft of light from above that reads the dust. Composition is vertical and UI-friendly, shelves framing a darker readable center. Palette: deep purple, magenta, antique gold, bottle-glass teal. Mystical sparkles stay sparse and attached to objects. Dark-fantasy concept art, no characters.
> END OF PROMPT;

**Suggested settings:**
- Aspect ratio: `3:4` (or `4:5`)
- Resolution: `1024x1365` or higher

---

### 4) Dungeons Option Image
**File target:** `images/backgrounds/dungeons-card.png` (or `.webp`)

**Prompt:**
> Vertical 3:4 game menu card still of an ancient dungeon entrance, no characters, no text. A heavy stone gate of weathered granite and basalt fills the mid-ground, iron bands rusted, carved lintel cracked. Worn stairs descend into a black mouth; torch brackets on either side throw golden-amber firelight that dies quickly into shadow. Materials: pitted stone, soot-stained mortar, tarnished iron, wet-looking steps. Lighting is dramatic and dangerous: warm torch key from both sides, deep cool shadows in the stairwell, a faint gold rim on the gate edge. Composition is vertical, stairs and gate centered so the card crop stays readable. Palette: amber, gold, charcoal, umber, black. High-detail fantasy concept art, no logos, no watermark, no figures on the stairs.
> END OF PROMPT;

**Suggested settings:**
- Aspect ratio: `3:4` (or `4:5`)
- Resolution: `1024x1365` or higher

---

### 5) PvP Option Image
**File target:** `images/backgrounds/pvp-card.png` (or `.webp`)

**Prompt:**
> Vertical 3:4 game menu card still of an intense magical duel arena, no characters, no logos, no text. Two opposing spell energies collide in the exact center: a crimson-red shock cone meeting a dark-purple vortex, sparks and a circular shockwave ringing the impact. The arena floor is dark basalt scored with faint dueling rings; distant pillar silhouettes stay out of the focal center. Materials: scorched stone, incandescent energy, metallic spark debris. Lighting is high-energy and competitive: the collision is the key light, throwing red on one side and violet on the other, with a white-hot core. Composition is vertical with a clean focal center for a card crop. Palette: crimson, dark purple, ember orange, black. Polished concept art, no watermarks, no faces.
> END OF PROMPT;

**Suggested settings:**
- Aspect ratio: `3:4` (or `4:5`)
- Resolution: `1024x1365` or higher

---

### 6) Raid Bosses Option Image
**File target:** `images/backgrounds/raids-card.png` (or `.webp`)

**Prompt:**
> Vertical 3:4 game menu card still of an ominous sorcerer-boss throne room, no character faces, no logos, no text. A massive dark chamber with a cracked marble floor and a central elevated platform; swirling purple and violet chaos energy radiates from that empty dais. Floating arcane runes and shattered mask fragments orbit in the air around the platform, never forming a face. Materials: fractured white-grey marble, blackened columns, violet energy like liquid glass, broken ceramic mask shards. Lighting is a dramatic spotlight from above that isolates the platform, with magenta bounce in the cracks and deep black falloff at the edges. Composition is vertical, platform centered, plenty of dark margin for a card crop. Palette: deep purple, magenta, black, cold marble grey. Epic dark-fantasy concept art, menacing atmosphere, no people.
> END OF PROMPT;

**Suggested settings:**
- Aspect ratio: `3:4` (or `4:5`)
- Resolution: `1024x1365` or higher

## Enemy Sprite Sheet Prompts

Each prompt below is designed to generate a **sprite sheet** with evenly spaced frames. Fire, Ice, Earth, Iron Forge, Sylvaris, Graveyard, Storm, Sea, and Desert regulars use an **8 column × 6 row** grid; each cell is **128×128 px**, and those sheets target **1024×768 px**. Every animation row must be a full motion paragraph — begin pose, progressive body-part motion across the frames, later frames versus early frames, and an explicit final frame — so the generator cannot collapse a row into identical stills or a standing pose with one limb nudged. Regular rows are **body actions only**: never draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX (combat effects are added in-game); dust at the feet, robe sway, and vein pulse that stay on the character are allowed. Use a **transparent or solid‑color background**. Fire, Ice, Earth, and Iron bosses use **4 rows × 4 columns (16 frames)** on **2048×2048 px** unless a sheet size says otherwise.

---

### FIRE DUNGEON ENEMIES

#### 1) Imp
**File target:** `images/enemies/imp-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the character. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: small demonic fire Imp, about 24×28 pixel logical size, dark crimson red skin with glowing orange-red highlights, bat-like wings, two small curved horns, glowing yellow eyes, thin pointed tail. Cute but mischievous dark fantasy enemy. Side-view facing right in every frame.
>
> Row 1 (8 frames) – Idle: Begin hovering in a relaxed mid-air crouch with knees slightly bent and both bat-like wings raised about halfway. Across the early frames the wings beat in a gentle cycle — downstroke, then upstroke — while the torso bobs a few pixels up and then down, the thin pointed tail curling and uncurling, and the orange-red skin highlights pulsing brighter on the down-bob. Later frames complete a second small wing-beat and the body drifts back toward the starting height so the loop can repeat. Final frame shows the Imp near the original hover height with wings mid-beat and the tail still in motion. This must be a living hover cycle with changing wing angles and vertical bob, not eight identical stills of a posed Imp.
>
> Row 2 (8 frames) – Fly: Begin in the hover pose, then lean the torso and horns forward and kick the trailing foot back as the wings take a stronger downstroke. Early frames show one wing pair at the bottom of the beat and the body stretching ahead; middle frames tuck the knees, snap the tail straight behind, and drive a full upstroke so the Imp clearly travels forward through the cell. Later frames recover the opposite wing beat and bring the lead foot through a small air-step. Final frame is mid-flight with the body still leaning forward and the wings at a different angle than the first frame. This must look like an actual flying cycle with contact, pass, and lift in the wings, not a standing pose that has been tilted.
>
> Row 3 (8 frames) – Gesture: Begin hovering with both fists near the hips and wings held close. Early frames lift both hands in front of the chest and spread the fingers as if shaping something in the empty air, while the wings open wider and the tail coils. Middle frames push the hands farther apart and flare the wings to their widest readable silhouette; later frames hold that open pose for a beat, then begin to pull the hands slightly back together. Final frame shows the Imp still airborne with arms spread, wings wide, and no extra objects between the hands. The hands, wings, and tail must travel through space — do not draw eight copies of one “arms out” still.
>
> Row 4 (8 frames) – Dash / Dive: Begin from a hover, then lunge the whole body forward with one shoulder leading and the wings swept back. Early frames stretch the Imp into a horizontal dash, horns first, feet trailing; middle frames tuck the knees to the chest, fold the wings tight against the back, and tip the head and horns downward into a diving stab line. Later frames drive the tucked body lower and farther forward as if completing the dive. Final frame is a compact downward-stab silhouette with wings pinned and the tail streaming behind. This must read as a dash that becomes a dive, not a standing Imp with one foot slid forward.
>
> Row 5 (8 frames) – Recoil: Begin in a normal hover, then snap the torso backward as if struck. Early frames tuck both wings against the body, fling the tail forward from the impact, and knock the head and horns up and back. Middle frames show the Imp drifting rearward through the cell with knees pulled in; later frames start a shaky recovery as the wings half-open again. Final frame is a brief hit-stun crouch in the air, body still displaced backward from the first frame. The recoil must travel — not a single flinch pose repeated.
>
> Row 6 (8 frames) – Defeat: Begin upright in the air, then let the wings collapse and lose their beat. Early frames send the body tumbling, one horn dipping, the tail going limp; middle frames drop the Imp lower as the crimson skin darkens and the orange highlights shrink to dying embers. Later frames crumple the silhouette into a shrinking heap. Final frame is a fading ember-shaped remnant, play-once death, not a loop back to idle. Progressive collapse only — never eight identical fallen poses.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

#### 2) Flame Serpent
**File target:** `images/enemies/flame-serpent-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the serpent. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Flame Serpent, long sinusoidal snake-like fire creature, about 44×20 pixel logical size, deep burnt-orange segmented body with bright orange-yellow underbelly, forked red tongue, single glowing red eye, no limbs. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin coiled in a gentle S-curve with the head raised just off the ground and the forked red tongue starting inside the mouth. Early frames flick the tongue out, then back, while the front segments lift a little and the rear coil settles; the orange-yellow underbelly brightens and dims as the body breathes. Later frames pass the wave the other way so the mid-body rises as the head dips a pixel. Final frame returns near the original S-curve with the tongue mid-flick and the eye still glowing. This must be a living coil with segment travel, not eight identical stills.
>
> Row 2 (8 frames) – Slither: Begin in a shallow S with the head pointed forward. Early frames push a traveling wave from tail toward head so the rear segments flatten and the head lunges a step ahead; middle frames show the mid-body at the crest of the wave (pass position) while the tail follows. Later frames plant the head and pull the tail through. Final frame is mid-slither with a different wave phase than frame 1, weight clearly transferred along the body. This must look like an actual sinusoidal crawl cycle, not a posed snake with the head nudged forward.
>
> Row 3 (8 frames) – Dive / Rear: Begin in a slither curve, then dive the head and first segments downward as if slipping underground. Early frames flatten the body and bury the snout; middle frames keep the tail last above the line, then reverse — the head punches upward and the front half rears with jaws opening and the forked tongue out. Later frames stretch the reared neck to its highest readable height. Final frame is fully reared, jaws open, rear segments still on the ground. Early frames dive; later frames rear — do not freeze one pose for the whole row.
>
> Row 4 (8 frames) – Coil / Strike: Begin stretched, then curl the body inward segment by segment into a tight ring with the head on the outside. Early frames complete the ring; middle frames wind the neck tighter so the glowing red eye aims at the ring’s center. Later frames stab the head inward toward that center while the coil compresses. Final frame is the strike: jaws at the center of the ring, body still coiled. This is a coil-then-stab, not a still donut shape.
>
> Row 5 (8 frames) – Recoil: Begin in an S-curve, then snap the whole body backward. Early frames bunch the front segments, yank the head up and away, and flatten the tongue; middle frames stack the mid-body in a compressed zigzag; later frames start to unwind a little. Final frame shows the serpent bunched and displaced rearward from frame 1. Motion through the row, not one hunched still.
>
> Row 6 (8 frames) – Defeat: Begin in a raised S, then let the body go limp. Early frames drop the head, sag the underbelly, and dim the red eye; middle frames crumple segments into a collapsing heap; later frames crumble the burnt-orange plates. Final frame is a low, broken pile of cooling segments, play-once death. Progressive collapse — not eight copies of a dead pose.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

#### 3) Ember Mage
**File target:** `images/enemies/ember-mage-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the mage and its staff. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Ember Mage, humanoid fire sorcerer, about 26×44 pixel logical size, dark brown hooded robe with burnt-orange trim, glowing orange eyes under the hood, wooden staff with a flaming orange orb, robe flares at the bottom. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin standing with the staff planted beside the right foot, hood forward, both hands quiet on the shaft. Early frames lift the chest in a breath, the robe hem sways a few pixels, and the flaming staff orb pulses brighter; middle frames shift weight onto the rear foot so the hip and shoulder tilt. Later frames exhale, the hem swings the other way, and the orb dims. Final frame is a slightly different weight shift than frame 1, robe still drifting. This must be a breathing idle, not eight identical stills.
>
> Row 2 (8 frames) – Walk: Begin with the staff at the side and the lead foot about to leave the ground. Early frames lift that foot, swing the opposite arm and the staff backward, and let the robe flow behind the stride. Middle frames show contact as the lead boot plants and the hips pass over it, then the rear foot lifts (pass). Later frames drive the next step. Final frame is mid-stride with weight clearly on the stepping leg. This must look like an actual walk cycle — contact, pass, lift — not a standing pose with one foot moved slightly forward.
>
> Row 3 (8 frames) – Cast: Begin standing, then plant the staff firmly so both hands slide down the shaft. Early frames lean the torso over the planted staff; middle frames point the flaming orb at the ground with the robe pulling tight; later frames raise the staff overhead, hood tipping back, the free hand opening. Final frame is the staff high, body extended upward. Hands and robe do the work — no extra spells drawn. The three stages (plant, point, raise) must progress across the eight frames, not one freeze.
>
> Row 4 (8 frames) – Step / Vanish: Begin in a square stance, then take a sharp sideways step so the whole body slides. Early frames whip the robe hem hard in the opposite direction of the step; middle frames squeeze the silhouette as if disappearing (robe wrapping the body, staff tucked); later frames snap the mage back into view a step away with the robe still unfurling. Final frame is the reappeared stance, robe settling. This is a step-and-whip, not a still mage with a fluttering hem painted on.
>
> Row 5 (8 frames) – Recoil: Begin upright, then flinch as if hit. Early frames snap the hood backward, dip the staff, and twist the shoulders; middle frames stumble a half-step back with the robe flaring; later frames catch balance. Final frame is a hunched hit-stun with the staff low. Travel through the flinch — not one repeated pose.
>
> Row 6 (8 frames) – Defeat: Begin standing, then stagger. Early frames lose the grip so the staff slips and drops; middle frames buckle the knees and fold the robe around a collapsing torso; later frames hit the ground. Final frame is a crumpled heap with the staff lying beside the body, play-once death. Progressive collapse only.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

#### 4) Magma Golem
**File target:** `images/enemies/magma-golem-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the golem. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Magma Golem, large heavy rock creature, about 40×56 pixel logical size, dark brown-gray rocky body, broad shoulders, thick arms and legs, glowing orange-red lava cracks through torso and joints, bright orange-red eyes, no neck — head merges into shoulders. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin standing with both fists clenched at the hips, shoulders square. Early frames expand the torso a fraction as the lava veins brighten; middle frames shift the weight onto one thick leg so the opposite hip drops and the fists hang a pixel lower. Later frames exhale, veins dim, and the weight eases back. Final frame is a settled stance with veins mid-pulse, not a copy of frame 1. This must be a breathing, weight-shifting idle — not eight identical stills.
>
> Row 2 (8 frames) – Walk: Begin with the rear foot loaded. Early frames lift one enormous rocky foot high enough that the sole clearly leaves the ground, swing the opposite thick arm forward, and tip the merged head with the stride. Middle frames drive that foot down (tiny dust only at the boot, on the character) and dip the whole body from the landing, then the other foot begins to lift. Later frames complete the opposite arm swing. Final frame is mid-stride or fully planted with weight on the stepping leg. This must look like an actual heavy walk, not a standing pose with one foot moved slightly forward.
>
> Row 3 (8 frames) – Slam: Begin in the idle stance, then raise one fist. Early frames punch that fist downward so the shoulder and torso follow; middle frames recover and lift both fists together; later frames drop both fists in a double slam, knees bending, lava cracks flaring. Final frame is the bottom of the double slam, fists low, body compressed. One-fist then both-fists must progress — not a single slam pose.
>
> Row 4 (8 frames) – Open / Collapse: Begin closed and upright. Early frames split the chest plates so a glowing core shows between the rocky halves; middle frames slump the whole body forward as if coming apart, arms hanging, head dipping; later frames haul the plates shut and pull the torso upright again. Final frame is nearly upright with the chest just resealed. Open, slump, recover — not one opened still.
>
> Row 5 (8 frames) – Brace: Begin standing tall, then settle into a heavy brace. Early frames hunch the broad shoulders, bend the knees, and dim the lava cracks; middle frames sink the hips lower and clench the fists tighter; later frames the cracks glow brighter as the golem holds the brace. Final frame is a compressed, shoulders-forward guard. This is a settle-into-brace cycle, not eight copies of a squat.
>
> Row 6 (8 frames) – Defeat: Begin standing, then let the lava cracks dim from the head downward. Early frames sag the shoulders; middle frames buckle the legs and fold the arms inward; later frames collapse the rocky body into a cooling heap. Final frame is a dark, slumped pile, play-once death. Progressive collapse only.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

#### 5) Fire Sprite
**File target:** `images/enemies/fire-sprite-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one sprite. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Fire Sprite, tiny floating ball of living flame, about 16×16 pixel logical size, bright orange-yellow core with a white-hot center, pulsing outer flame aura, two tiny bright eyes. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin as a round flame ball at mid height with the outer aura close to the core. Early frames bob the whole body a few pixels up while the aura expands and the white-hot center brightens; middle frames drift down and the aura tightens; later frames complete a second smaller pulse. Final frame is near the start height with the aura at a different size than frame 1. This must be a hover-and-pulse cycle, not eight identical stills. Draw only this one body — no extra motes leaving the cell.
>
> Row 2 (8 frames) – Fly: Begin round and upright, then stretch the core slightly along the direction of travel. Early frames lean the eyes forward and elongate the trailing aura; middle frames snap the body into a dart, then shorten again as if completing a wingless beat; later frames recover the rounder shape while still moving ahead. Final frame is mid-dart with a different stretch than frame 1. This must look like an actual darting fly cycle, not a still ball slid to the right.
>
> Row 3 (8 frames) – Stretch / Rise: Begin as a ball, then thin the body into a vertical streak. Early frames shoot the white-hot center upward so the sprite becomes tall and narrow; middle frames reach the highest stretch; later frames snap back into a ball, falling a little toward the original height. Final frame is a reformed ball, still slightly above the start. Stretch then snap — not one tall still.
>
> Row 4 (8 frames) – Flicker: Begin at normal brightness, then rapidly brighten the whole body. Early frames blow the aura wide and the eyes flare; middle frames dim almost to a coal; later frames brighten and dim again as if blinking in and out, still one body. Final frame is mid-flicker, neither the brightest nor the darkest. Changing brightness and size across the row — not a static glow.
>
> Row 5 (8 frames) – Recover: Begin large and agitated, then shrink. Early frames pull the aura inward; middle frames settle the core to a calm ember size; later frames the eyes soften and the bob slows. Final frame is a small, quiet ember-ball. Progressive recover, not eight calm stills.
>
> Row 6 (8 frames) – Defeat: Begin full flame, then sputter. Early frames tear the aura, shrink the core, and wink one eye; middle frames collapse smaller; later frames the white-hot center dies. Final frame is a last tiny spark or empty space where the sprite was, play-once death. Progressive wink-out only.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### FIRE DUNGEON BOSS

#### 6) Ignaroth, The Inferno Dragon
**File target:** `images/enemies/fire-dragon-sheet.png`  
**Sheet size:** `2048×2048 px` (large boss)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 4 columns (16 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Ignaroth, The Inferno Dragon — massive fire-breathing dragon boss, about 320×240 pixel logical size. Deep crimson-red scaled body with an orange-red belly covered in horizontal scale lines, enormous bat-like dark-red wings with visible membrane vein details, long muscular neck leading to a fierce horned head with two pairs of curved dark-brown horns (large outer pair, smaller inner pair), glowing orange-yellow slit-pupil eyes with fiery glow aura, wide jaw with rows of pale-yellow teeth, nostrils with wisps of fire, thick spiked tail ending in a large pointed tail blade with bony spines along the tail, four powerful clawed legs, bony spines running down the neck. Epic dark fantasy dungeon boss.
>
> Row 1 (4 frames) – Idle animation: Begin standing with wings half-spread and the long neck in a proud curve, fire wisps just starting at the nostrils. Across the early frames the chest and orange-red belly rise with a breath, the wing membranes lift a few degrees, and the spiked tail sways toward the rear; later frames exhale, the belly sinks, the wings ease down, and the tail swings the other way while the nostril wisps drift. Final frame is mid-breath with wings and tail at a different angle than frame 1. This must be a living idle with wing and tail travel, not four identical posed stills.
>
> Row 2 (4 frames) – Fly/Move animation: Begin grounded or just leaving the ground, then take a powerful downstroke so the enormous wings drive the body forward. Early frames tuck the four clawed legs underneath and lunge the horned head ahead; later frames complete the upstroke, the tail blade streaming behind, the belly scales stretching with the effort. Final frame is mid-flight, wings at the opposite beat from the first frame, body still leaning forward. This must look like an actual wing-beat fly cycle, not a standing dragon with wings simply held open.
>
> Row 3 (4 frames) – Attack animation: Begin with the neck coiled back and the jaws nearly shut. Early frames rear the horned head, spread both wings fully, and raise the spiked tail; later frames thrust the neck forward and unleash a massive cone of fire breath from the open jaw, teeth bared, eyes blazing, wings still wide. Final frame is the breath fully projected, head extended, body committed to the attack. Head-back then breath-forward must progress across the four frames — not one frozen roar.
>
> Row 4 (4 frames) – Defeat animation: Begin upright with wings still spread, then crumple. Early frames fold the wings inward and the neck droops; later frames crash the body toward the ground, scales cracking with escaping lava light along the belly and joints. Final frame is a grounded, collapsing heap fading toward embers, play-once death. Progressive crash — not four copies of a dead dragon.
>
> Style: clean digital pixel-art sprite sheet, epic dark fantasy boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### ICE DUNGEON ENEMIES

#### 7) Frost Wraith
**File target:** `images/enemies/frost-wraith-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one wraith. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Frost Wraith, ghostly floating ice spirit, about 28×40 pixel logical size, semi-transparent steel-blue body that fades and wavers at the bottom edge like tattered ghostly robes, no legs — lower body dissolves into a ragged wispy tail, pale blue-white glowing eyes, no mouth visible, body slightly luminous. Eerie spectral dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin floating with the ragged wispy tail hanging almost straight and the pale eyes at rest. Early frames the tattered robe-edge wavers like cloth, the torso bobs a few pixels up, and the luminosity brightens; middle frames the tail drifts sideways and the body sinks; later frames complete the opposite sway. Final frame is near the start height with the robe-edge in a different ripple than frame 1. This must be a wavering hover, not eight identical stills. Draw only this one wraith — no extra copies or frost fields.
>
> Row 2 (8 frames) – Glide: Begin upright, then tilt the torso and eyes forward. Early frames stream the wispy tail behind and stretch the tattered edge; middle frames the body drifts clearly through the cell, one arm-shape trailing; later frames level the tilt slightly as the tail catches up. Final frame is mid-glide, still moving, silhouette longer than idle. This must look like actual forward drift, not a standing ghost slid one pixel right.
>
> Row 3 (8 frames) – Fade / Phase: Begin at normal opacity. Early frames the steel-blue body grows thinner and more transparent from the tail upward as if slipping through something; middle frames are the most see-through, eyes still visible; later frames the form thickens again from the chest downward. Final frame is nearly solid once more, robe still unsettled. Thin then thick — not one faded still.
>
> Row 4 (8 frames) – Reach: Begin with both arms hidden in the robe mass. Early frames one arm rises from the torso; middle frames the second arm stretches forward; later frames both arms extend in a seizing reach, the wispy tail pulling tight. Final frame is the full two-arm seize, body leaning after the hands. Arms must travel — not eight copies of a grab pose.
>
> Row 5 (8 frames) – Recoil: Begin in the idle float, then distort. Early frames smear the torso backward and snap the eyes wide; middle frames the ragged tail whips forward from the hit; later frames the form snaps toward a shaky hover. Final frame is a warped, rearward hit-stun. Distortion that moves, not one smear.
>
> Row 6 (8 frames) – Defeat: Begin whole, then scatter. Early frames the robe-edge shreds upward; middle frames the body breaks into fading wisps; later frames the eyes dim last. Final frame is nearly gone — a last pale scrap — play-once death. Progressive fade-out only.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

#### 8) Ice Archer
**File target:** `images/enemies/ice-archer-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the archer and its bow. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Ice Archer, humanoid frost ranger, about 24×42 pixel logical size, dark steel-blue armor and clothing, lighter blue-gray secondary color, icy blue glowing eyes, holds a curved frost bow, lean build, hooded. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin standing with the curved frost bow down at the side, hood settled, feet planted. Early frames the chest rises with a breath and the bow tip dips a pixel; middle frames shift weight onto the rear foot so the hip and hood tilt; later frames exhale and the weight eases forward. Final frame is a slightly different stance than frame 1, eyes still glowing. This must be a breathing idle, not eight identical stills. No arrows in flight.
>
> Row 2 (8 frames) – Walk: Begin with the bow held at the side and the lead foot about to lift. Early frames pick that foot up, swing the opposite arm, and let the hood and cloak-edge trail; middle frames plant the lead foot (contact), hips pass over it, then the rear foot leaves the ground (pass). Later frames start the next cautious step. Final frame is mid-stride with weight on the stepping leg. This must look like an actual walk cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (8 frames) – Draw: Begin with the bow low, then raise it. Early frames lift the bow to shoulder height and set the string hand; middle frames draw the string back until it is clearly taut, the torso twisting, the hood turning toward the aim; later frames settle into a full draw with the bow arm straight. Final frame is the fully drawn aim. The string is taut on the bow — do not draw a flying arrow. Draw progress across the row, not one freeze.
>
> Row 4 (8 frames) – Loose / Step: Begin at full draw, then release the string so the bow arm kicks forward. Early frames the string snaps toward the grip (still no flying arrow); middle frames the archer takes a small side-step, bow still in hand, the free foot lifting and planting; later frames the torso follows the step and the bow lowers a little. Final frame is the post-loose stance one step aside. Loose then step — not a still release pose.
>
> Row 5 (8 frames) – Recoil: Begin aiming or idle, then flinch. Early frames dip the bow, snap the hood back, and twist the shoulders; middle frames stumble rearward; later frames catch the bow before it drops. Final frame is a hunched hit-stun with the bow low. Travel through the flinch.
>
> Row 6 (8 frames) – Defeat: Begin standing, then drop the bow. Early frames the bow leaves the hands; middle frames the knees buckle and the hood falls forward; later frames the body slumps to the ground. Final frame is a crumpled heap beside the fallen bow, play-once death. Progressive collapse only.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

#### 9) Snow Beast
**File target:** `images/enemies/snow-beast-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the beast. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Snow Beast, large hulking yeti-like ice creature, about 44×48 pixel logical size, pale gray-blue shaggy fur, lighter blue-white fur accents, broad chest, thick arms that hang past the knees, small dark steel-blue eyes, large white fangs, hunched posture. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin in a hunched stand with both thick arms hanging past the knees. Early frames the shaggy fur rustles along the back and the broad chest swells with a breath; middle frames a puff of heavy frost-breath leaves the fanged mouth (on the character, not a storm) and the weight shifts to one stumpy leg. Later frames the chest sinks and the fur settles the other way. Final frame is mid-breath with a different arm hang than frame 1. This must be a living idle, not eight identical stills. No snow waves or storm clouds.
>
> Row 2 (8 frames) – Walk: Begin hunched, rear foot loaded. Early frames lift one heavy foot, swing the opposite long arm far forward, and tip the hunched shoulders with the gait. Middle frames plant that foot with a dip of the whole body, then the other arm and foot exchange (pass). Later frames drive the next lumbering step. Final frame is mid-stride, weight on the stepping leg, arms in opposite swing. This must look like an actual lumbering walk, not a standing pose with one foot moved slightly forward.
>
> Row 3 (8 frames) – Charge / Roar: Begin upright-hunched, then lower the head and barrel the torso forward. Early frames the arms pump and the fangs show as the beast runs into the charge; middle frames plant and rear up, chest opening; later frames the head tips back and the mouth opens in a roar, frost-breath at the teeth. Final frame is the full rear-and-roar. Charge then roar must progress — not one roar still.
>
> Row 4 (8 frames) – Curl / Slam: Begin standing, then tuck the head and pull the long arms in as the body curls into a defensive ball. Early frames complete the ball; middle frames uncoil, legs extending; later frames slam both fists downward, shoulders dropping, fur bristling. Final frame is the bottom of the double-fist slam. Curl then uncoil-slam — not one ball pose.
>
> Row 5 (8 frames) – Recoil: Begin hunched, then stagger. Early frames the fur bristles and the head snaps aside; middle frames one foot slides back and the arms flail; later frames the beast catches itself. Final frame is a bristling hit-stun, body rearward of frame 1. Motion through the stagger.
>
> Row 6 (8 frames) – Defeat: Begin standing, then collapse onto the knees. Early frames the arms hit the ground; middle frames the torso folds; later frames the beast slumps onto its side. Final frame is a limp heap of fur, play-once death. Progressive collapse only.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

#### 10) Cryo Mage
**File target:** `images/enemies/cryo-mage-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the mage and its staff. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Cryo Mage, humanoid ice sorcerer, about 26×44 pixel logical size, dark navy-blue hooded robe, medium blue trim, glowing icy-blue eyes under the hood, dark gray staff topped with a glowing icy-blue crystal orb, robe flares at the bottom. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin standing with the staff beside the forward foot, hood down, both hands on the shaft. Early frames a breath lifts the chest, the flared robe hem sways, and the icy-blue crystal pulses brighter; middle frames shift weight to the rear foot so the hip and hood tilt. Later frames exhale, the hem swings back, the crystal dims. Final frame is a different weight shift than frame 1. This must be a breathing idle, not eight identical stills. No extra lines, walls, or cages.
>
> Row 2 (8 frames) – Walk: Begin with the staff at the side and the lead foot lifting. Early frames that foot leaves the ground, the opposite arm and staff swing back, and the navy robe flows behind. Middle frames plant the lead foot (contact), hips pass, rear foot lifts (pass). Later frames take the next step. Final frame is mid-stride with weight on the stepping leg. This must look like an actual walk cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (8 frames) – Cast: Begin idle, then raise the staff so the crystal lifts past the hood. Early frames the free hand opens; middle frames sweep the staff in a straight horizontal line, robe twisting with the shoulders; later frames point the crystal at the ground, torso folding over the shaft. Final frame is the downward point. Raise, sweep, point must progress across the eight frames — no extra frost drawn.
>
> Row 4 (8 frames) – Guard / Close: Begin with the staff out, then pull it inward against the chest as if sealing something. Early frames both hands gather on the shaft and the robe wraps closer; middle frames hold the closed guard; later frames a sharp stabbing point sends the crystal forward again. Final frame is the stab, body extended. Close then stab — not one pose.
>
> Row 5 (8 frames) – Recoil: Begin upright, then flinch. Early frames the crystal flares on the staff (on the prop only), the robe snaps, and the hood flies back; middle frames a stumble rearward; later frames a shaky recover. Final frame is hunched hit-stun, staff dipped. Travel through the flinch.
>
> Row 6 (8 frames) – Defeat: Begin standing, then let the staff slip. Early frames the robe stiffens as if freezing; middle frames the knees give and the hood drops; later frames the mage slumps. Final frame is a crumpled heap with the staff beside the body, play-once death. Progressive collapse only.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

#### 11) Glacier Sentinel
**File target:** `images/enemies/glacier-sentinel-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the sentinel. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Glacier Sentinel, large armored ice golem guardian, about 42×54 pixel logical size, dark steel-blue rocky/icy body, lighter blue-gray highlights, translucent blue ice vein cracks on the torso, broad flat shoulders, thick rectangular arms and blocky legs, small pale blue-cyan glowing eyes. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin standing guard with both rectangular arms at the sides, eyes forward. Early frames the translucent ice veins pulse brighter and the chest plates settle a pixel; middle frames shift weight onto one blocky leg so a shoulder drops; later frames the veins dim and the weight eases back. Final frame is mid-pulse with a slightly different arm hang than frame 1. This must be a living guard idle, not eight identical stills. No extra shields or orbiting chunks.
>
> Row 2 (8 frames) – Walk: Begin with the rear blocky foot loaded. Early frames lift one heavy foot high enough to clear the ground, the opposite arm barely swinging. Middle frames plant that foot with a dip of the whole torso (tiny dust only at the boot), then the other foot begins to rise. Later frames complete the opposite micro-swing. Final frame is mid-stride or planted with weight on the stepping leg. This must look like an actual deliberate stomp cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (8 frames) – Advance / Swing: Begin square, then raise one thick arm like a barrier and lean the whole torso forward. Early frames the barrier-arm reaches its height and the sentinel steps into the lean; later frames drop that arm into a wide horizontal sweep, shoulders rotating, the other arm countering. Final frame is the end of the sweep, body still twisted. Advance-lean then sweep must progress — not one arm-out still.
>
> Row 4 (8 frames) – Lock / Open: Begin in a living stance, then freeze the whole body perfectly still for the early frames as if locked in ice, veins going pale. Middle frames hairline cracks show in the stance; later frames the lock breaks and the sentinel slumps as if stunned, arms hanging, head dipping. Final frame is the stunned slump. Stillness is only the lock phase — the row must then crack and slump, not stay frozen for all eight frames.
>
> Row 5 (8 frames) – Brace: Begin tall, then square the broad flat shoulders. Early frames the veins dim and the knees bend; middle frames the arms tuck closer to the torso; later frames the veins glow as the brace holds. Final frame is a compact, shoulders-forward brace. Settle-into-brace, not eight copies of a squat.
>
> Row 6 (8 frames) – Defeat: Begin standing, then the ice veins go dark from the head down. Early frames cracks spread across the torso; middle frames the arms sag and the legs buckle; later frames the body slumps into a broken ice-rock heap. Final frame is that dark heap, play-once death. Progressive collapse only.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### ICE DUNGEON BOSS

#### 12) Kryonax, The Frozen Colossus
**File target:** `images/enemies/frost-colossus-sheet.png`  
**Sheet size:** `2048×2048 px` (large boss)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 4 columns (16 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Kryonax, The Frozen Colossus — massive crystalline ice titan boss, about 360×280 pixel logical size. Dark navy-blue angular crystalline body, torso is a faceted hexagonal ice shape with glowing icy-blue vein lines running vertically, bright diamond-shaped ice core crystal embedded in the chest glowing intense cyan-blue, massive angular shoulder crystals (double-layered ice shards jutting upward on each shoulder), long powerful arms ending in three ice-claw fingers, angular crystalline head with a pointed crown shape and a glowing blue face plate with two bright cyan slit eyes and a V-shaped visor, lower body dissolves into swirling ice mist rather than distinct legs, floating above the ground. Epic dark fantasy dungeon boss.
>
> Row 1 (4 frames) – Idle animation: Begin hovering with the ice mist gathered close under the torso and the diamond chest core at medium glow. Early frames the whole crystalline body rises a little, the shoulder shards catch a brighter refraction, and the mist swirls wider; later frames the body sinks, the core pulses dimmer, and the clawed arms drift. Final frame is mid-hover at a different height than frame 1, mist still moving. This must be a rise-and-fall idle with a pulsing core, not four identical stills.
>
> Row 2 (4 frames) – Float/Move animation: Begin in the hover, then lean the crowned head and hexagonal torso forward. Early frames the ice mist streams behind and both arms lift slightly; later frames the body glides clearly through the cell, shoulder crystals trailing the lean, claws opening. Final frame is mid-glide, still traveling, mist stretched aft. This must look like actual forward float, not a hovering pose slid sideways.
>
> Row 3 (4 frames) – Attack animation: Begin with both long arms down. Early frames raise both ice-clawed arms overhead, the chest core blazing bright and the visor flaring; later frames slam both arms down, the torso dropping with the blow, a massive ice shockwave and icicle eruption reading as part of this boss attack. Final frame is the bottom of the slam with the shockwave at its widest. Arms-up then slam-down must progress across the four frames — not one freeze.
>
> Row 4 (4 frames) – Defeat animation: Begin intact, then the crystals crack from the crown downward. Early frames the chest core flashes and fractures; later frames the body fragments into ice shards scattering outward and the ice mist dissipates. Final frame is a broken scatter / empty core remnant, play-once death. Progressive shatter — not four copies of a ruined still.
>
> Style: clean digital pixel-art sprite sheet, epic dark fantasy boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### EARTH DUNGEON ENEMIES

#### 13) Rock Golem
**File target:** `images/enemies/rock-golem-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the golem. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Rock Golem, large humanoid stone creature, about 40×52 pixel logical size, dark brown-tan rocky body with lighter brown-yellow highlights, broad flat shoulders, thick arms and blocky legs, faint tan-yellow stone vein cracks on the torso, dull yellow-tan glowing eyes, rough hewn texture, no neck — head sits directly on shoulders. Heavy tanky dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin standing with both fists clenched, head planted on the shoulders. Early frames a slight settle drops the weight into the blocky legs and the stone veins tick brighter; middle frames shift onto one leg so a shoulder and fist hang lower; later frames the weight eases back and the eyes dim a notch. Final frame is mid-settle, veins mid-pulse. This must be a weight-shifting idle, not eight identical stills. No extra rocks or pillars.
>
> Row 2 (8 frames) – Walk: Begin with the rear foot loaded. Early frames lift one thick stone foot until the sole is clearly off the ground, swing the opposite arm, and tip the neckless head with the stride. Middle frames plant that foot with a body dip and tiny dust only at the boot, then the other foot lifts (pass). Later frames complete the opposite arm swing. Final frame is mid-stride with weight on the stepping leg. This must look like an actual heavy walk, not a standing pose with one foot moved slightly forward.
>
> Row 3 (8 frames) – Tear / Stomp: Begin square, then rip one thick arm downward as if pulling something from the ground, shoulder rolling, torso folding. Early frames finish that downward tear with the fist low; later frames raise one blocky foot high and stomp it down, hips and head dropping with the impact. Final frame is the planted stomp, body compressed. Tear then stomp must progress — body-only, no torn objects drawn.
>
> Row 4 (8 frames) – Throw / Punch: Begin with one arm cocked, then hurl an empty hand forward so the whole shoulder and torso rotate (no rock in the hand). Early frames complete the empty throw; later frames drop both fists into the ground, knees bending, veins flaring. Final frame is the double-fist ground punch, body low. Throw then punch — not one pose. No extra objects.
>
> Row 5 (8 frames) – Recoil: Begin standing, then the stone plates knock backward. Early frames the eyes flare then dim, the head (on the shoulders) jolts; middle frames a stumble; later frames a brace. Final frame is a rearward hit-stun. Travel through the knockback.
>
> Row 6 (8 frames) – Defeat: Begin standing, then the veins darken. Early frames cracks spread; middle frames the arms sag and the legs crumble; later frames the body collapses downward. Final frame is a low rubble heap, play-once death. Progressive collapse only.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

#### 14) Vine Crawler
**File target:** `images/enemies/vine-crawler-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the crawler. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Vine Crawler, low serpentine plant creature, about 36×24 pixel logical size, dark green segmented body that undulates like a caterpillar, brighter green head with a single bright lime-green eye, small leaf-like crest on top of the body, no visible limbs — moves by rippling its vine-body along the ground. Creepy crawling dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin in a gentle S-shape on the ground with the leaf-like crest upright. Early frames the segments wave so the mid-body rises while the head stays put, and the crest rustles forward; middle frames the wave travels the other way and the lime-green eye blinks a brighter pulse; later frames the crest rustles back. Final frame is an S-curve in a different phase than frame 1. This must be a living wave idle, not eight identical stills. No extra vines or ground roots around it.
>
> Row 2 (8 frames) – Crawl: Begin in a shallow S, head pointed forward. Early frames push a ripple from tail to head so the rear segments flatten and the head lunges a step; middle frames the mid-body is at the crest of the wave (pass); later frames the tail pulls through. Final frame is mid-crawl with a different ripple phase than frame 1. This must look like an actual caterpillar slither cycle, not a posed worm with the head nudged forward.
>
> Row 3 (8 frames) – Burrow / Curl: Begin on the surface, then flatten the whole body and sink the head as if slipping underground. Early frames the crest folds flat; middle frames only the tail remains high, then the motion reverses as the body curls segment by segment into a tight ring. Later frames complete the ring with the eye on the outside. Final frame is the tight curl. Flatten-sink then curl — not one pose for the whole row.
>
> Row 4 (8 frames) – Rear / Plant: Begin low, then rear the front half so the brighter green head and crest lift high, segments stacking. Early frames reach the highest rear; later frames dip the body as if planting itself, head driving down, crest folding. Final frame is the planted dip, no extra objects. Rear then plant must progress.
>
> Row 5 (8 frames) – Recoil: Begin in an S, then bunch the segments. Early frames the crest snaps back and the head recoils; middle frames the body compresses into a short zigzag; later frames a shaky unwind. Final frame is bunched and rearward of frame 1. Motion through the recoil.
>
> Row 6 (8 frames) – Defeat: Begin raised, then go limp. Early frames the leaves wilt and the eye dims; middle frames the segments sag; later frames the body shrivels into a low heap. Final frame is a wilted pile, play-once death. Progressive collapse only.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

#### 15) Cave Spider
**File target:** `images/enemies/cave-spider-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the spider. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Cave Spider, compact arachnid creature, about 30×20 pixel logical size, dark brown elliptical body with lighter gray-brown head segment, four pairs of red eyes arranged in a cluster on the head, eight thin dark-brown legs splayed outward, fangs visible at the front. Fast creepy dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin crouched with all eight legs splayed and the elliptical body low. Early frames a few legs twitch at different joints and the body bobs a pixel up; middle frames the red eye cluster pulses and the fangs tap; later frames the body sinks and a different pair of legs twitches. Final frame is a crouch with legs in a different arrangement than frame 1. This must be a twitching idle, not eight identical stills. No webs or silk.
>
> Row 2 (8 frames) – Skitter: Begin crouched, then fire a rapid low run. Early frames the lead pairs of legs reach forward and the body stretches; middle frames those legs plant (contact) while the rear pairs swing through (pass); later frames the next set lifts. Final frame is mid-skitter, body still low, legs in a different phase than frame 1. This must look like an actual eight-leg run cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (8 frames) – Climb / Hang: Begin on the ground, then gather the legs inward and upward as if climbing a vertical face. Early frames the body rises and the head segment tips up; later frames the legs splay below as the body hangs ready to drop, abdomen slightly higher than the head. Final frame is the hang. Climb then hang must progress — body-only, no web line drawn.
>
> Row 4 (8 frames) – Swing / Lunge: Begin hanging or crouched, then swing the whole body forward on tucked legs. Early frames the abdomen trails the swing; later frames a short fang lunge snaps the head and fangs ahead, front legs reaching. Final frame is the lunge extension. Swing then lunge — not one bite still.
>
> Row 5 (8 frames) – Recoil: Begin crouched, then splay all eight legs. Early frames the body knocks backward and the eyes flare; middle frames the legs scramble; later frames a shaky crouch. Final frame is a splayed hit-stun, rearward of frame 1. Travel through the knockback.
>
> Row 6 (8 frames) – Defeat: Begin upright on its legs, then curl the legs inward. Early frames the body tips; middle frames it flips onto its back; later frames the legs tuck over the abdomen. Final frame is belly-up and still, play-once death. Progressive collapse only.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

#### 16) Crystal Mage
**File target:** `images/enemies/crystal-mage-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the mage and its staff. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Crystal Mage, humanoid gem-wielding sorcerer, about 26×44 pixel logical size, dark purple hooded robe, lighter purple-violet trim, glowing pinkish-purple eyes under the hood, carries a dark purple staff topped with a diamond-shaped glowing purple crystal, robe flares at the bottom. Arcane caster dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin standing with the staff at the side, diamond crystal at medium glow. Early frames a breath lifts the chest, the flared robe hem sways, and the crystal pulses brighter; middle frames shift weight onto the rear foot so the hip and hood tilt. Later frames exhale, the hem swings back, the crystal dims. Final frame is a different weight shift than frame 1. This must be a breathing idle, not eight identical stills. No extra crystals or clones.
>
> Row 2 (8 frames) – Walk: Begin with the staff at the side and the lead foot lifting. Early frames that foot leaves the ground, the staff swings back, and the purple robe flows behind. Middle frames plant the lead foot (contact), hips pass, rear foot lifts (pass). Later frames take the next step. Final frame is mid-stride with weight on the stepping leg. This must look like an actual walk cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (8 frames) – Cast: Begin standing, then plant the staff so both hands slide down the shaft. Early frames lean over the plant; middle frames point the diamond crystal forward, robe pulling tight; later frames raise the staff overhead, hood tipping back. Final frame is the staff high. Plant, point, raise — hands and robe do the work, no beams or floor marks. The three stages must progress across the eight frames.
>
> Row 4 (8 frames) – Gesture: Begin with the staff in one hand, then a wide two-handed sweep so both arms and the robe arc across the body. Early frames finish the open sweep; later frames a closed inward gather pulls the staff and free hand to the chest as if closing a space. Final frame is the gathered close. Sweep then gather — no extra objects. Do not freeze one gesture.
>
> Row 5 (8 frames) – Recoil: Begin upright, then flinch. Early frames the hood snaps back, the staff dips, and the shoulders twist; middle frames a stumble rearward; later frames a shaky recover. Final frame is hunched hit-stun. Travel through the flinch.
>
> Row 6 (8 frames) – Defeat: Begin standing, then stagger. Early frames the staff drops; middle frames the knees buckle and the robe collapses around the torso; later frames the mage hits the ground. Final frame is a crumpled heap with the staff beside the body, play-once death. Progressive collapse only.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

#### 17) Mud Elemental
**File target:** `images/enemies/mud-elemental-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the elemental. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Mud Elemental, amorphous blob-like earth creature, about 36×44 pixel logical size, dark brown blobby body with smooth rounded shape (no hard edges), lighter tan-brown dripping highlights, two dull yellow-tan eyes near the top, no mouth, small mud drips constantly falling from the bottom of the body, body bulges and shifts shape slightly. Oozing amorphous dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin as a rounded blob with drips starting at the underside and the two eyes level. Early frames the body pulses wider, a drip slides down the tan highlight, and the eyes rise a pixel; middle frames the blob contracts and the weight sloshes to one side; later frames another drip falls and the pulse eases. Final frame is a slightly different bulge than frame 1, drips still moving. This must be a wobbling idle, not eight identical stills. No extra puddles or thrown mud around it.
>
> Row 2 (8 frames) – Ooze: Begin upright-blob, then stretch the whole mass forward. Early frames the lead edge elongates and the eyes slide toward that edge; middle frames the rear contracts and pulls up (pass); later frames the body reforms a step ahead. Final frame is mid-ooze with a different stretch than frame 1. This must look like an actual stretch-and-contract move cycle, not a still blob slid to the right.
>
> Row 3 (8 frames) – Slam / Rise: Begin rounded, then form two arm-like bulges and slam them down, the eyes dipping with the hit. Early frames complete the slam, the body flattening; later frames a second body-shape rises beside the first as if a copy is forming from its own mass — still attached or clearly the same mud, not a separate extra creature with its own VFX. Final frame is the risen second mass at its highest. Slam then rise — body-only.
>
> Row 4 (8 frames) – Surge: Begin upright, then lean and stretch the whole upper body far forward like a wave, eyes riding the crest. Early frames reach maximum stretch; later frames the mass snaps back and reforms upright, drips catching up. Final frame is a reformed blob, still settling. Wave-out then reform — not one stretched still.
>
> Row 5 (8 frames) – Recoil: Begin cohesive, then splatter slightly. Early frames chunks of the silhouette knock backward (still on the character); middle frames the eyes wobble; later frames the mud pulls back together. Final frame is a lumpy, rearward hit-stun. Splatter then rejoin — not one smear.
>
> Row 6 (8 frames) – Defeat: Begin upright, then lose cohesion. Early frames the drips increase and the eyes sink; middle frames the body flattens; later frames the heap spreads. Final frame is a low puddle-like heap with sunken eyes, play-once death. Progressive collapse only.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### EARTH DUNGEON BOSS

#### 18) Terravox, The Stone Titan
**File target:** `images/enemies/earth-colossus-sheet.png`  
**Sheet size:** `2048×2048 px` (large boss)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 4 columns (16 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Terravox, The Stone Titan — colossal earth golem boss, about 400×320 pixel logical size. Dark earthy-brown body made of layered stone slabs and boulders, lighter tan-gold stone highlights and accent lines, massive broad shoulders and trunk-like arms that reach the ground, thick pillar legs, relatively small angular head with glowing amber-yellow eyes set deep in a stone brow, no visible mouth — just a carved stone face plate, glowing golden-orange energy veins visible in the joints and cracks of the stone body, mossy patches on shoulders and back, stalactite-like stone spikes protruding from shoulders and spine. Epic dark fantasy dungeon boss.
>
> Row 1 (4 frames) – Idle animation: Begin standing imposingly with the trunk-like arms hanging to the ground and the amber veins at medium glow. Early frames the chest slabs rise with a tectonic breath, dust lifts at the pillar feet (on the character), and the veins brighten; later frames the body settles, moss on the shoulders shifts, and the veins dim. Final frame is mid-breath with a different arm hang than frame 1. This must be a living, weighty idle, not four identical stills.
>
> Row 2 (4 frames) – Walk animation: Begin with the rear pillar leg loaded. Early frames lift one enormous foot high enough that the sole leaves the ground, the opposite trunk-arm swinging like a pendulum, boulders on the shoulder shaking loose as part of the body. Later frames drive that foot down so the whole titan dips, then the other leg begins to rise. Final frame is mid-stride or planted with weight clearly on the stepping leg. This must look like an actual thunderous walk, not a standing pose with one foot moved slightly forward.
>
> Row 3 (4 frames) – Attack animation: Begin with both massive fists down. Early frames raise both fists overhead, the small angular head tipping back, golden-orange veins blazing; later frames smash both fists into the ground, knees bending, stone pillars and stalagmites erupting from the floor as part of this boss attack, shockwave cracks radiating. Final frame is the bottom of the smash with the eruptions at their height. Arms-up then smash-down must progress across the four frames — not one freeze.
>
> Row 4 (4 frames) – Defeat animation: Begin intact, then the amber veins go dark from the head down. Early frames cracks spread across every slab; later frames the stone slabs separate and the pillar legs buckle. Final frame is a massive rubble pile with a cloud of dust, play-once death. Progressive collapse — not four copies of a ruined still.
>
> Style: clean digital pixel-art sprite sheet, epic dark fantasy boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### IRON FORGE ENEMIES

#### 21) Iron Sentinel
**File target:** `images/enemies/iron-sentinel-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the sentinel. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Iron Sentinel — armored mechanical guardian, about 44×56 pixel logical size. Dark gunmetal-grey body (#4a4a5a) made of riveted iron plates, lighter steel-grey (#6a6a7a) highlights along pauldrons and joints, bulky square torso with a single glowing orange slit visor for a face, thick segmented arms ending in heavy iron gauntlets, blocky armored legs with pistons at the knees, faint orange forge-glow seeping from gaps between plates, a heavy iron shield fused to the left arm, slow imposing posture. Dark fantasy dungeon enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin standing guard with the fused shield hanging at the left arm and the orange slit visor at medium glow. Early frames a slight mechanical sway rocks the square torso, the knee pistons compress a pixel, and the visor pulses brighter; middle frames the weight shifts onto one blocky leg so a pauldron drops; later frames the visor dims and the sway eases the other way. Final frame is mid-sway with a different piston height than frame 1. This must be a living mechanical idle, not eight identical stills. No extra sparks or flying metal.
>
> Row 2 (8 frames) – Walk: Begin with the rear foot loaded. Early frames lift one armored foot high enough to clear the ground, the knee piston compressing, the opposite gauntlet and shield swinging. Middle frames plant that foot with a dip of the bulky torso (tiny dust only at the boot), then the other piston drives the next lift (pass). Later frames complete the opposite arm swing. Final frame is mid-stride with weight on the stepping leg. This must look like an actual clanking march, not a standing pose with one foot moved slightly forward.
>
> Row 3 (8 frames) – Guard: Begin with the shield low, then raise the fused shield until it covers the front of the square torso. Early frames the visor ducks behind the shield rim and the free gauntlet tucks; later frames shift into a defensive weapon-high stance, the free arm lifting beside the shield, knees bent. Final frame is the high guard, body committed. Shield-up then weapon-high must progress — body-only, not one freeze.
>
> Row 4 (8 frames) – Reach / Punch: Begin square, then one segmented arm separates slightly at the joints so the gauntlet hangs a gap from the forearm. Early frames that gap shows; later frames the joints snap shut as the same arm drives a long punch from a new angle, torso rotating, shield countering. Final frame is the punch fully extended. Separate then snap-punch — no extra flying pieces drawn off-body. Do not hold one punch pose for the whole row.
>
> Row 5 (8 frames) – Recoil: Begin guard or idle, then the plates knock. Early frames the visor flashes and the torso jolts back; middle frames a stumble, pistons jamming; later frames a shaky brace. Final frame is a rearward hit-stun, visor still bright. Travel through the knock.
>
> Row 6 (8 frames) – Defeat: Begin standing, then the visor dims. Early frames plates buckle at the shoulders; middle frames the pistons give and the shield arm droops; later frames the body collapses into scrap. Final frame is a crumpled heap of iron plates, play-once death. Progressive collapse only.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### 22) Forge Drone
**File target:** `images/enemies/forge-drone-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the drone. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Forge Drone — small flying mechanical construct, about 24×24 pixel logical size. Compact rounded copper-orange body (#cc6622) with bright amber-orange (#ff8844) glowing propulsion vents on the sides, a single large red-orange lens eye in the center, two small articulated grabber arms beneath, thin rotating gear-blade propeller on top keeping it airborne, faint heat shimmer below from exhaust. Dark fantasy dungeon enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin hovering level with the gear-blade propeller at a readable angle and the grabber arms hanging. Early frames the whole body bobs up, the propeller rotates to a new blade angle, the lens scans a few degrees, and the side vents pulse; middle frames the body sinks and the grabbers twitch; later frames a second bob and another propeller angle. Final frame is near the start height with the propeller clearly in a different rotation than frame 1. This must be a hover-and-spin idle, not eight identical stills. No beams, mines, or explosion rings.
>
> Row 2 (8 frames) – Fly: Begin level, then tilt the copper body and lens forward. Early frames tuck the grabber arms, brighten the propulsion vents, and drive a stronger propeller beat; middle frames the drone zips ahead through the cell, body elongated by the tilt; later frames a shallower tilt as the next blade-pass happens. Final frame is mid-flight, propeller at a different angle than frame 1. This must look like an actual flying cycle, not a still drone slid to the right.
>
> Row 3 (8 frames) – Work: Begin hovering, then point the lens and grabbers downward as if welding the floor. Early frames the arms extend toward the ground and the vents glow hotter; middle frames the body holds the downward aim while the heat shimmer under the hull brightens (on the character); later frames the glow grows hotter still, propeller still spinning. Final frame is the hottest downward work pose. Point then heat-up must progress — no extra weld sparks drawn off-body as combat VFX.
>
> Row 4 (8 frames) – Fold / Dive: Begin open, then fold plates or the grabber arms inward so the silhouette becomes a spinning dart, propeller still suggesting spin. Early frames complete the fold; later frames tip the dart onto a diagonal dive line, lens leading. Final frame is the diving dart, body committed. Fold then dive — not one tucked still.
>
> Row 5 (8 frames) – Recoil: Begin hover, then knock the body backward. Early frames the lens cracks with light (on the eye only) and the propeller stutters to an uneven angle; middle frames the drone tumbles a little in the air; later frames a shaky hover. Final frame is a rearward hit-stun. Travel through the knock.
>
> Row 6 (8 frames) – Defeat: Begin airborne, then the propeller stops. Early frames the blades freeze and the body tips; middle frames it tumbles; later frames the hull breaks into pieces. Final frame is a small scrap heap or last falling fragment, play-once death. Progressive breakup only.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### 23) Slag Brute
**File target:** `images/enemies/slag-brute-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the brute. Do not draw extra spells, orbs, arrows, trails, clones, walls, or impact VFX.
>
> Character: Slag Brute — hulking molten-metal humanoid, about 52×60 pixel logical size. Massive broad-shouldered body made of dark scorched iron-brown (#553322) with glowing cracks of molten copper-orange (#774433) running through the surface, heavy hunched posture, enormous fists that drag near the ground, a crude face with two deep-set glowing orange ember eyes and a jagged mouth leaking molten drips, thick stumpy legs, patches of still-cooling slag crusted on shoulders and back. Dark fantasy dungeon enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin hunched with both enormous fists near the ground and the ember eyes at medium glow. Early frames the molten cracks pulse brighter, the jagged mouth leaks a drip, and the broad chest swells with a heavy breath; middle frames shift weight onto one stumpy leg so a slag-crusted shoulder drops; later frames the cracks dim and the breath sinks. Final frame is mid-pulse with a different fist hang than frame 1. This must be a breathing idle, not eight identical stills. No extra slag chunks or craters around it.
>
> Row 2 (8 frames) – Walk: Begin with the rear foot loaded and the fists hanging. Early frames lift one thick foot, swing the opposite enormous arm wide, and tip the hunched head with the gait. Middle frames plant that foot with a dip of the whole body (tiny dust only at the boot), then the other arm and foot exchange (pass). Later frames drive the next lumbering step. Final frame is mid-stride with weight on the stepping leg. This must look like an actual walk, not a standing pose with one foot moved slightly forward.
>
> Row 3 (8 frames) – Hammer / Open: Begin hunched, then swell one fist and slam it down so the shoulder and torso follow. Early frames complete that hammer slam, knees bending; later frames the chest plates split to show a glowing furnace inside the rib-slag, eyes flaring, mouth opening. Final frame is the opened chest at its widest, body still low from the slam. Hammer then open must progress — body-only, no extra debris.
>
> Row 4 (8 frames) – Throw / Shake: Begin with one shoulder hunched, then rip a chunk from that shoulder (the missing slag is a hole on the body) and throw an empty hand forward, torso rotating. Early frames finish the empty throw; later frames the whole body shakes violently, fists and head jerking, then slams forward. Final frame is the forward slam, weight committed. Throw then shake-slam — not one pose.
>
> Row 5 (8 frames) – Recoil: Begin hunched, then the cracks dim and the body knocks back. Early frames the ember eyes stutter; middle frames a stumble, fists dragging; later frames a shaky hunch. Final frame is a rearward hit-stun. Travel through the knockback.
>
> Row 6 (8 frames) – Defeat: Begin standing, then the glow fades from the cracks. Early frames the body hardens and the drips stop; middle frames the legs shatter and the torso folds; later frames the brute breaks into a cooling heap. Final frame is a dark, shattered pile, play-once death. Progressive collapse only.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### IRON FORGE BOSS

#### 24) The Iron Colossus
**File target:** `images/enemies/iron-colossus-sheet.png`  
**Sheet size:** `2048×2048 px` (large boss)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 4 columns (16 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: The Iron Colossus — towering mechanical war-golem boss, about 500×400 pixel logical size. Colossal body of dark blackened iron (#3a3a4a) with lighter gunmetal-grey (#5a5a6a) segmented armor plates, enormous barrel-shaped torso covered in rivets and welded seams, two massive piston-driven arms with giant forge-hammer fists that could flatten buildings, thick pillar legs with hydraulic joints glowing faintly orange from internal furnace, a relatively small angular head with a single visor slit blazing bright orange-white like a furnace window, smokestacks on the shoulders venting dark smoke and orange embers, glowing molten-orange energy core visible through a cracked chest plate, chains and broken anvils hanging from the waist as trophies. Epic dark fantasy dungeon boss.
>
> Row 1 (4 frames) – Idle animation: Begin standing titanic with the hammer-fists hanging and the chest furnace core at medium glow. Early frames the core pulses brighter, the shoulder smokestacks billow, the visor intensifies, and the ground at the pillar feet cracks from the weight (on the character); later frames the core dims, the chains and broken anvils at the waist sway, and the visor eases. Final frame is mid-pulse with smoke and chains in a different position than frame 1. This must be a living furnace idle, not four identical stills.
>
> Row 2 (4 frames) – Walk animation: Begin with the rear hydraulic leg loaded. Early frames lift one enormous pillar foot high enough that the sole is clearly off the ground, the opposite piston-arm swinging, chains trailing, embers shedding from the smokestacks as part of the body. Later frames drive that foot down so the whole colossus dips and a visible shockwave reads at the boot; then the other leg begins to rise. Final frame is mid-stride or fully planted with weight clearly transferred onto the stepping leg. This must look like an actual earth-trembling march, not a standing pose with one foot moved slightly forward.
>
> Row 3 (4 frames) – Attack animation: Begin with both colossal hammer-fists down. Early frames raise both fists overhead, pistons extending, the furnace core and visor blazing white-hot, smokestacks roaring; later frames bring both hammers crashing down, the barrel torso dropping with the blow, a massive shockwave erupting outward with molten sparks and debris as part of this boss attack. Final frame is the bottom of the crash with the shockwave at its widest. Arms-up then crash-down must progress across the four frames — not one freeze.
>
> Row 4 (4 frames) – Defeat animation: Begin intact, then the furnace core destabilizes and overloads with blinding orange light. Early frames armor plates blow outward one by one from the shoulders and chest; later frames the internal skeleton frame buckles and the pillar legs collapse. Final frame is a mountain of twisted metal and cooling embers, play-once death. Progressive breakup — not four copies of a ruined still.
>
> Style: clean digital pixel-art sprite sheet, epic dark fantasy boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### CORRUPTED SYLVARIS ENEMIES

These are twisted originals, not recolors. Same **8×6** action-only rule: draw only the character, no baked corruption patches, extra copies, or projectiles.

#### 25) Darkened Vine Crawler
**File target:** `images/enemies/dark-vine-crawler-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this crawler. Do not draw extra vines, black flowers, floor patches, or tunnels.
>
> Character: Darkened Vine Crawler, low corrupted plant predator, about 38×18 pixel logical size. The body is longer and more stretched than a normal vine crawler, woven from black-purple vines with a second smaller maw splitting from the shoulder, wilted black leaves with magenta veins, thorn barbs that look melted, two magenta eyes plus a third dim eye on the extra maw. Twisted underground dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin low to the ground in a coiled crawl, both maws slightly open. Across the eight frames the main maw and the smaller shoulder maw twitch out of sync — the extra maw opens a beat later than the primary. The black-purple vine body pulses unevenly, swelling then tightening so the silhouette lengthens and shortens. Wilted black leaves lift and droop with each pulse; melted thorn barbs twitch. The two magenta eyes and the dim third eye on the extra maw flicker independently. Later frames show a stronger body pulse and a wider extra-maw twitch than the early frames. Final frame returns near the start pose with both maws mid-twitch so the row can loop. This must look like living, uneven breathing, not eight identical still poses.
>
> Row 2 (8 frames) – Skitter: Begin in the idle crawl. Ripple the vine body forward in a broken crawl: front coils pull, mid-body bunches, tail drags. The extra maw hangs and drags along the ground in the early frames, then snaps upward in the later frames as the body surges. Vine loops plant and peel in sequence so the whole body travels right. Wilted leaves stream backward with the crawl. Final frame is mid-skitter with the extra maw raised and the body clearly farther forward than frame 1. This must look like an actual rippling crawl cycle, not a planted pose with the maw angled differently.
>
> Row 3 (8 frames) – Sink / Stretch: Begin on the surface in a crawl. The front half flattens and presses down as if diving underground — head and primary maw lower, shoulders compress, wilted leaves flatten against the body. Mid frames show the front half nearly flush while the rear still has volume. Then the body unnaturally lengthens: coils pull apart, the extra maw lags on the stretching shoulder, the silhouette becomes longer and thinner. Body-only — do not draw tunnels, holes, or floor patches. Final frame shows a stretched, half-sunk crawler, front low and body clearly longer than the start. This must look like a dive-then-stretch, not a still worm posed flatter.
>
> Row 4 (8 frames) – Curl / Bloom: Begin extended in a crawl. Pull the vine body into a tightening knot — head tucks, extra maw folds in, coils stack, leaves crush inward. Mid frames are a tight black-purple knot. Then the back splits open like a black flower: rear vines peel apart, wilted leaves flare, the extra maw gapes from the split. No extra objects — the bloom is the crawler’s own back opening, not a separate flower. Final frame shows the knot opened from behind with the split back fully flared. This must progress from curl to bloom, not eight frames of a posed flower.
>
> Row 5 (8 frames) – Recoil: Begin in a crawl that has just been hit. Raised barbs flatten against the body across the early frames. Both maws flinch shut; the extra maw recoils later than the primary. Magenta eyes flicker out of sync — one bright, one dim, the third eye stuttering. The body jerks backward and shortens. Later frames show barbs fully flat and the eyes still desynchronized. Final frame is a flattened, flinching crawler still on its coils. This is a hit recoil, not a new idle pose.
>
> Row 6 (8 frames) – Defeat: Play-once death. Begin from a recoiling crawl. Vines unravel from the extra maw first — the second mouth loosens, then slumps into slack coils. The primary body follows: leaves wilt completely, eyes go dark in sequence, melted thorn barbs droop. Later frames collapse into a heap of dead black coils with the extra maw already a loose tangle. Final frame is a collapsed pile of lifeless black-purple vines, no living pose. Do not loop this row.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy dungeon style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

#### 26) Darkened Thorn Wolf
**File target:** `images/enemies/dark-thorn-wolf-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one wolf. Do not draw afterimages, extra wolves, thorns in the air, or floor spikes.
>
> Character: Darkened Thorn Wolf, corrupted pack hunter, about 36×28 pixel logical size. Not a purple thorn wolf — the body is a black silhouette of bark and thorn with a hollow ribcage glow, magenta eyes, a torn second jaw of thorns hanging under the real mouth, legs too long and jointed the wrong way, tail a frayed void-wisp. Predatory dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin in a low predatory stand on wrong-jointed legs. The legs tick and twitch at the backward knees — one paw lifts a fraction, then another, never settling into a normal stance. The torn second jaw of thorns hangs under the real mouth and drips in a slow irregular rhythm. The hollow ribcage glow pulses dimmer then brighter. Magenta eyes stay locked forward. The void-wisp tail flicks once in the later frames. Final frame returns near the start with a leg still ticking and the second jaw mid-drip so the row can loop. This must look like unstable ticking idle, not eight identical still wolves.
>
> Row 2 (8 frames) – Run: Begin from the idle stand and break into a broken gallop facing right. The too-long legs over-reach: the body stretches too far in the early-to-mid frames, then snaps short as the rear legs catch up. The hollow ribs flash with each stretch. The second jaw flails under the real mouth. The void-wisp tail streams backward, then cracks forward when the body snaps short. Later frames complete the opposite-leg plant so the cycle can loop. Final frame is mid-gallop with the body either stretched or freshly snapped short. This must look like an actual broken run, not a standing wolf with one paw forward.
>
> Row 3 (8 frames) – Lunge / Cancel: Begin in a gathered crouch. Commit to a full forward lunge — hind legs drive, the stretched body leaves the ground, jaws opening, thorns along the neck flaring. Mid frames are fully airborne and committed forward. Then a mid-air halt: the body stops its forward travel, legs scramble, and he leaps backward, landing or still reversing in the later frames. Body-only — no extra copies, no air thorns. Final frame is the backward leap or a planted reverse, clearly not still in the lunge. This must show lunge then cancel, not eight frames of a posed pounce.
>
> Row 4 (8 frames) – Shake / Mark: Begin standing. A violent full-body shake runs from head to void-wisp tail — bark-thorn silhouette blurs with the shake, second jaw slapping, hollow ribs flashing. Mid frames finish the shake. Then he drops into a low stare: head lowers, magenta eyes lock, and the second jaw slowly opens wide under the real mouth. No extra objects. Final frame is the low marked stare with the second jaw open. This must be shake then stare, not a held growl pose.
>
> Row 5 (8 frames) – Recoil: Begin as if struck. The hollow ribcage glow flashes hard in the early frames, then stutters. Thorns that were raised flatten along the silhouette. The second jaw snaps or hangs slack. Wrong-jointed legs buckle and the body shortens backward. Later frames show thorns fully flat and the rib glow fading. Final frame is a flattened, flinching wolf still on its feet. This is a hit recoil, not a new idle.
>
> Row 6 (8 frames) – Defeat: Play-once death. Begin from the recoil. The black silhouette splits — a crack opens through the hollow ribs. The second jaw drops off and falls through the later frames. The body collapses downward into a heap of black thorns, magenta eyes going dark, void-wisp tail unraveling. Final frame is a collapsed pile of black thorns with the second jaw already separate and dead. Do not loop this row.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy dungeon style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

#### 27) Darkened Moss Wraith
**File target:** `images/enemies/dark-moss-wraith-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the wraith. Do not draw extra copies, hands, tethers, or a darkened arena.
>
> Character: Darkened Moss Wraith, false-information spirit, about 30×44 pixel logical size. Taller and thinner than the forest moss wraith, body of black-green rot with holes you can see through, no legs — a smoke-trail of ash-moss, arms too long, a hood that hides everything except two sickly yellow eyes that can sit slightly off-center from the head. Corrupted underground dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin floating with the ash-moss trail hanging still. Holes in the torso breathe — they widen on the early frames and pinch shut on the later frames so you can see through the body in a slow pulse. The two sickly yellow eyes drift a little off the face, sliding toward the edge of the hood and then partway back. Too-long arms hang and sway out of sync with the hood. The ash-moss trail below the robe-body lengthens and shortens with the breath. Final frame returns near the start with holes mid-breath and eyes still slightly off-center so the row can loop. This must look like hollow breathing, not eight identical floats.
>
> Row 2 (8 frames) – Glide: Begin in the idle float. The body shears sideways to the right as if the hood and torso move first and the lower smoke-trail is late. Early frames show the upper body offset ahead of the ash-moss. Mid frames catch the trail up, then it lags again. Too-long arms trail behind the shear. The yellow eyes lag a frame behind the hood. Final frame is mid-glide, body clearly farther right, cloak-trail still late. This must look like a sheared glide, not a still wraith slid over one pixel.
>
> Row 3 (8 frames) – Fade / Eyes: Begin fully visible. The black-green rot body thins and turns translucent until it is almost gone — holes eat the silhouette, arms fade, hood becomes a suggestion — while the two sickly yellow eyes stay bright and readable the whole time. Mid frames are nearly empty except the eyes. Then the body returns: rot fills back in from the hood downward, arms reappearing last. Body-only — no extra copies, no leftover hands. Final frame is the body fully returned, eyes still bright. This must fade then return, not eight frames of a ghost at one opacity.
>
> Row 4 (8 frames) – Reach / Split: Begin floating with arms at its sides. Both too-long arms stretch toward the ground — fingers lengthen, shoulders drop, hood tilts. Mid frames the hands are at their lowest. Then the torso opens as if peeling shadows off itself: the holes tear wider, the chest splits, rot edges peel outward. No extra objects — the peeled shadows are the wraith’s own torso opening, not separate hands or tethers. Final frame shows arms still reaching and the torso split open. This must reach then split, not a held open-chest pose.
>
> Row 5 (8 frames) – Recoil: Begin from a reach or idle. The off-center eyes snap back onto the face in the early frames. Ash-moss tears — strips of the trail and hood rip and hang. The body jerks backward and the holes pinch. Later frames show the eyes locked on the face and the torn moss still hanging. Final frame is a torn, flinching wraith, eyes on-center. This is a hit recoil, not a new idle.
>
> Row 6 (8 frames) – Defeat: Play-once death. Begin from the recoil. The two yellow eyes vanish first — empty hood in the early frames. Then the hollow body collapses: arms drop, holes eat the rest of the torso, the ash-moss trail unravels downward into a dying heap. Later frames are a collapsing pile of ash-moss with no face. Final frame is dead ash-moss on the ground, no eyes. Do not loop this row.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy dungeon style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

### RAID BOSS

#### 19) The Manipulator
**File target:** `images/enemies/manipulator-sheet.png`  
**Sheet size:** `2048×2048 px` (large boss)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 4 columns (16 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: The Manipulator — sinister floating sorcerer raid boss, about 180×260 pixel logical size. Wears a long flowing dark-purple/near-black robe that obscures the lower body entirely (no visible legs — the robe tapers to a ragged floating point), inner robe glows faintly with dark purple magical energy, long spindly dark-purple arms extending from the robe with glowing bright-purple/magenta energy orbs for hands, a smooth pale white porcelain mask for a face (oval shaped with thin sinister curved mouth line), glowing purple-violet eyes emitting light trails, dark hood/cowl over the head framing the mask, five arcane rune symbols orbiting slowly around the body at mid-height (lightning bolt, crystal ball, star, hexagon, diamond shapes), casts a faint shadow on the ground below while floating, menacing ethereal presence. Epic dark fantasy raid boss.
>
> Row 1 (4 frames) – Idle animation: Begin floating at a stable height, spindly arms slightly outstretched, porcelain mask facing right. Gentle vertical bobbing lifts the whole body on the early frames and lowers it on the later frames. The magenta hand-orbs pulse brighter, then dim. The five orbiting runes rotate slowly around mid-height — each frame they have moved further along the orbit. The ragged robe sways and the inner glow breathes. Light trails from the purple-violet eyes drift. Final frame is still floating, ready to loop back to the start bob. This must be a living float, not four identical still portraits.
>
> Row 2 (4 frames) – Float/Move animation: Begin from the idle float. Glide forward to the right with a slight forward tilt of the hood and mask. The ragged robe trails behind and the taper point streams backward. The rune orbit speeds up — later frames show the five symbols farther along their circle than a slow idle would. Hand-orbs stretch slightly ahead of the arms. The ground shadow slides right with him. Final frame is mid-glide, body clearly farther forward and still tilted. This must look like travel, not an idle bob with the robe posed backward.
>
> Row 3 (4 frames) – Attack animation: Begin with arms still near the idle spread. Both spindly arms thrust forward; the magenta hand-orbs blaze brighter than any other row. Chaos orbs and a purple projectile burst leave the hands in the mid-to-later frames and travel right. The five runes flash brightly and stall in their orbit. The robe billows outward from the cast, inner glow spiking, eye trails lengthening. Final frame is the full thrust with projectiles already launched and runes still flashing. This must show the thrust then the launch, not four frames of an already-fired pose.
>
> Row 4 (4 frames) – Defeat animation: Play-once death. Begin in a hit or idle float. The porcelain mask cracks fully across the early frames, then shatters and the pieces fall. The robe unravels into dark energy wisps. The body disintegrates from the center outward into purple-magenta particles; the five runes break into fading fragments in the later frames. Hand-orbs wink out. Final frame is a loose cloud of fading particles and rune shards with no readable body. Do not loop this row.
>
> Style: clean digital pixel-art sprite sheet, epic dark fantasy raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### 20) The Chrono Tyrant
**File target:** `images/enemies/chrono-tyrant-sheet.png`  
**Sheet size:** `2048×2048 px` (large boss)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 4 columns (16 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: The Chrono Tyrant — imposing temporal sorcerer raid boss, about 180×260 pixel logical size. Wears a long flowing dark midnight-blue robe edged with ornate golden clockwork trim, the robe obscures the lower body entirely (tapers to ragged floating hem), inner robe fabric glows faintly with warm golden temporal energy, broad armored shoulders with golden clock-gear pauldrons, long dark arms with golden gauntlets that emanate faint golden light, a dark angular hood framing a shadowed face with two piercing golden glowing eyes that leave light trails, a large ornate golden clock emblem on the chest with slowly turning hands, faint golden clock-gear particles orbit the body at mid-height, hovers above the ground with golden energy wisps trailing beneath the robe, radiates an aura of ancient unstoppable time magic. Epic dark fantasy raid boss.
>
> Row 1 (4 frames) – Idle animation: Begin hovering, arms slightly outstretched, hood facing right. Gentle vertical bobbing lifts him on the early frames and lowers him on the later frames. Golden gauntlets pulse with light. Orbiting clock-gears rotate slowly around mid-height. The chest-clock hands tick to a new position each frame. The midnight-blue robe sways and golden wisps drift under the hem. Eye trails hang and fade. Final frame is still hovering, ready to loop. This must be a living temporal idle, not four identical still portraits.
>
> Row 2 (4 frames) – Float/Move animation: Begin from the idle hover. Glide forward to the right with a slight forward lean of the hood and gear pauldrons. The robe trails behind; golden energy wisps under the hem intensify and streak backward. The clock-gear orbit speeds up — later frames show the particles farther along their circle. The chest-clock hands tick faster. Gauntlets lead the lean. Final frame is mid-glide, body farther forward and still leaning. This must look like travel, not an idle bob with the robe posed backward.
>
> Row 3 (4 frames) – Attack animation: Begin with arms near the idle spread. Both arms thrust forward; the golden gauntlets blaze with temporal energy. A golden vortex and clock-hand projectiles launch from the hands in the mid-to-later frames and travel right. The chest clock emblem flares brightly and the hands spin. The robe billows outward; gear pauldrons lift with the cast. Final frame is the full thrust with vortex and clock-hands already launched and the emblem still flaring. This must show the thrust then the launch, not four frames of an already-fired pose.
>
> Row 4 (4 frames) – Defeat animation: Play-once death. Begin in a hit or idle hover. The chest clock emblem cracks in the early frames, then shatters. The robe unravels into golden temporal wisps. The body dissolves from the extremities inward — gauntlets and pauldrons first, then hood and torso — into golden clock fragments and fading time particles in the later frames. Orbiting gears break apart. Final frame is a loose scatter of fading clock fragments with no readable body. Do not loop this row.
>
> Style: clean digital pixel-art sprite sheet, epic dark fantasy raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

### The Grand Challenger — Action Sprite Sheets (16:9)

These sheets are **actions**, not whole attacks. Each row is **8 frames** (in the 5–10 range). Attacks are built by playing actions in sequence (crouch → jump → slam → land, etc.). Some rows are the same action with a different **end pose** (stand vs float). Every row must be a full motion paragraph, not a one-liner.

**Shared sheet spec (every Challenger sheet below):**
- Aspect **16:9** — `2560×1440 px`
- Grid **8 columns × 4 rows** (32 frames)
- Fully **transparent** background (no white paper, no canvas color)
- Side-view facing **right**, even spacing, no crop, no overlap
- Logical size about **96×132**
- Every row is a full motion paragraph (Begin → progressive body motion → named body parts → later vs early frames → Final frame), not a one-liner

**Phase looks (keep consistent inside a sheet):**
- **P1:** gunmetal skin, cyan vein cracks, tiny white-point eyes, pauldrons / forearm armor / boots / belt-chest, torn cloak, no weapon, calm
- **P2:** armor gone, brighter cyan-magenta cracks, blazing white eyes, smile, cloak only + boots, overflowing aura
- **P3:** no aura, dim cracks, scuffed skin, tired but proud, tatters, pure martial

**Style line to append to every prompt:**  
`Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.`

---

#### Sheet 1 — P1 Idle & Walk
**File target:** `images/enemies/grand-challenger-p1-idle-walk.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 1 — 8-foot muscular humanoid alien warrior. Dark gunmetal metallic skin with glowing cyan-white cosmic vein cracks, two tiny white-light eyes (no pupils), minimal armor (heavy pauldrons, armored forearms, boots, belt/chest), torn charcoal cloak, no weapon, fists only. Calm, unimpressed. About 96×132 logical size.
>
> Row 1 (8 frames) – Idle breathe: Begin in a planted fighting-ready stand, feet apart, knees softly bent, fists loose at his sides, facing right. Across the eight frames the chest and belt/chest armor rise and fall in a slow breath cycle — inhale on the early frames, exhale on the later frames. The torn charcoal cloak sways a few pixels with each breath. Cyan-white vein cracks pulse brighter on the inhale and dim on the exhale. Tiny white-light eyes stay dim points. Shoulders and heavy pauldrons barely lift with the breath. Final frame returns near the start pose so the row can loop, still standing. This is a living breath cycle, not eight identical still frames.
>
> Row 2 (8 frames) – Idle weight-shift: Begin in the same planted idle as Row 1. Shift his weight from the rear heel onto the lead heel, hips sliding, one knee softening while the other straightens. Roll one pauldron and that shoulder backward, then settle it. Head and tiny white-light eyes glance slightly more forward in the mid frames. The cloak follows the weight shift a frame late. Cyan veins pulse once with the shoulder roll. Later frames complete the shift onto the other foot and return toward center. Final frame is standing again, weight recently settled. This must show a real heel-to-heel weight transfer, not a still idle with the head turned.
>
> Row 3 (8 frames) – Walk: Begin standing, then lift the lead boot and step forward into a heavy deliberate walk cycle facing right. Hips and shoulders roll opposite each other. Each boot plants with enough force to crush lunar dust under the sole — dust puffs on contact in the later plant frames. The torn cloak trails behind and swings with each stride. Pauldrons roll with the shoulders; fists stay loose and swing slightly. Knees lift high enough that the boot clearly leaves the ground before planting. Final frame is mid-stride or opposite-foot plant so the cycle can loop. This must look like an actual enormous walk, not a standing pose with one foot slid forward.
>
> Row 4 (8 frames) – Heavy stomp walk: Begin standing or mid-walk. This walk is slower and heavier than Row 3: each step lifts the boot high, then drives it down with more knee bend and a deeper hip drop. On later contact frames the boot makes a crater pose — the ground depresses, dust and small rocks kick outward. The cloak hangs heavier and straighter between steps, then kicks on impact. Shoulders and pauldrons dip with each stomp. Cyan veins brighten on the drive-down. Final frame is a fully planted stomp or mid-stride with the weight clearly on the stomping leg. This must look like cratering footsteps, not Row 3 copied with a slightly lower knee.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 2 — P1 Body Mechanics
**File target:** `images/enemies/grand-challenger-p1-body.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 1 — 8-foot muscular humanoid alien warrior. Dark gunmetal metallic skin with glowing cyan-white cosmic vein cracks, two tiny white-light eyes (no pupils), minimal armor (heavy pauldrons, armored forearms, boots, belt/chest), torn charcoal cloak, no weapon, fists only. Calm, unimpressed. About 96×132 logical size.
>
> Row 1 (8 frames) – Get up: Begin down on one knee with one fist planted in lunar dust, head still up, cloak pooled on the ground, calm and unimpressed. Push through the planted fist and the bent leg: hips rise, the rear boot steps under him, the torso unfolds through a crouch. Dust falls from the knuckles and cloak in the early frames. Mid frames are a deep athletic crouch, both boots under him. Later frames extend the knees and hips until he is fully upright. Final frame is a full standing idle, fists at his sides, cloak hanging. This must be a real rise from the ground, not a standing pose that starts slightly lower.
>
> Row 2 (8 frames) – Crouch: Begin standing tall and relaxed. Drop into a deep athletic crouch: hips shoot back and down, knees bend sharply, torso stays proud. Both fists lower until they are near the ground. The cloak pools and folds onto the lunar surface around the boots. Pauldrons drop with the shoulders; cyan veins brighten as he coils. Later frames settle the depth — no bounce back up. Final frame is a held deep crouch, fists near the ground, cloak pooled. This must be a full drop, not a slight knee bend.
>
> Row 3 (8 frames) – Stand from crouch: Begin in the deep athletic crouch from Row 2, fists near the ground, cloak pooled. Reverse the drop: drive through the legs, extend the knees and hips, fists rise back to the sides, torso unfolds. The cloak lifts off the ground and falls back into a hanging drape. Mid frames are a rising half-stand. Later frames settle the shoulders and pauldrons. Final frame is a standing idle. This is the reverse of Row 2, not a different pose set.
>
> Row 4 (8 frames) – Neck crack: Begin standing. Roll the head in a slow circle — chin toward one pauldron, then back, then the other side. Frames 3–5 are the crack: the neck snaps to a new angle, cyan veins along the neck flash, shoulders and pauldrons drop a notch as tension releases. The cloak barely moves. Tiny white-light eyes stay calm. Later frames return the head to center and settle the shoulders. Final frame is standing, head forward, shoulders dropped. This must show a real head roll and crack, not eight standing portraits.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 3 — P1 Presence
**File target:** `images/enemies/grand-challenger-p1-presence.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 1 — 8-foot muscular humanoid alien warrior. Dark gunmetal metallic skin with glowing cyan-white cosmic vein cracks, two tiny white-light eyes (no pupils), minimal armor (heavy pauldrons, armored forearms, boots, belt/chest), torn charcoal cloak, no weapon, fists only. Calm, unimpressed. About 96×132 logical size.
>
> Row 1 (8 frames) – Shoulder roll: Begin standing, arms loose. Roll both shoulders and heavy pauldrons in a backward circle — up, back, and down. The torn cloak tosses up off the back in the mid frames and falls again. Cyan-white veins pulse once at the peak of the roll. The chest and belt armor shift with the roll. Later frames complete the circle and settle. Final frame is standing, shoulders settled, cloak hanging. This must be a full shoulder roll, not a still pose with the pauldrons tilted.
>
> Row 2 (8 frames) – Beckon: Begin standing. Raise one armored forearm and open hand, then slowly curl the fingers inward in a “come” gesture across the mid and later frames. The elbow stays close; the other fist stays down. Tiny white-light eyes brighten a little as the fingers curl. The cloak stays mostly still. Pauldrons stay level. Final frame is standing with the beckoning hand held, fingers curled. This must show the hand rising then curling, not a frozen “come here” pose for all eight frames.
>
> Row 3 (8 frames) – Point: Begin standing. Extend one full arm straight toward the viewer / right, first the forearm, then the pointing finger locking out (“You. Stand.”). No extra flourish — no cloak whip, no second-hand motion. The torso turns slightly into the point. Eyes stay dim white points. Later frames hold the locked point. Final frame is standing, arm fully extended, finger pointing. This must travel from rest to a full point, not eight frames of an already-pointing arm.
>
> Row 4 (8 frames) – Fight stance settle: Begin in a casual standing idle. Step the lead boot forward and drop into a lower guard: both knees bend, hips sink, both fists rise to a compact guard in front of the chest/belt. Eyes become brighter white points. The cloak settles behind the new stance. Pauldrons square up. Later frames stop moving and hold the guard. Final frame is the fight stance, not a casual idle. This must be a committed step-into-guard, not a still fighting pose from frame 1.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 4 — P1 Jump & Air
**File target:** `images/enemies/grand-challenger-p1-jump.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 1 — 8-foot muscular humanoid alien warrior. Dark gunmetal metallic skin with glowing cyan-white cosmic vein cracks, two tiny white-light eyes (no pupils), minimal armor (heavy pauldrons, armored forearms, boots, belt/chest), torn charcoal cloak, no weapon, fists only. Calm, unimpressed. About 96×132 logical size.
>
> Row 1 (8 frames) – Crouch-to-jump: Begin standing, then drop into a deep coil: hips back, knees bent, fists near the thighs, cloak gathering. Mid frames explode upward — legs extend, arms swing, torso stretches tall. Later frames leave the ground entirely, boots clear of the lunar surface, dust kicking up at the boots. Final frame is rising just off the ground with dust at the empty boot prints. This must show coil then launch, not a standing hop.
>
> Row 2 (8 frames) – Jump ascend: Begin already off the ground and rising. Knees tuck toward the chest in the early frames, then extend as he climbs. The torn cloak streams straight down. Fists stay ready at the hips or guard. Pauldrons and shoulders stay compact. Cyan veins stay lit. Later frames are higher in the cell than early frames, body more extended. Final frame is high in the air, legs extended, still rising. This is an ascent, not a hover with the legs posed differently.
>
> Row 3 (8 frames) – Midair float hold: Begin airborne at a stable height as if gravity forgot him. He hovers with tiny vertical bobbing — a few pixels up then down across the eight frames so the row can loop. The cloak hangs nearly still with a slow drift. Small cyan-white cracks glow a little brighter than on the ground. Boots dangle; knees soft; fists relaxed. Final frame is still floating at the same height as the start. Loop-friendly. Keep the motion to a gentle hover, not a new jump.
>
> Row 4 (8 frames) – Aerial punch windup: Begin in the midair float. Draw one fist all the way back past the pauldron, elbow high, torso rotating and coiling. The other arm guards. The cloak twists with the coil. Hips turn; boots adjust in the air. Later frames show the fist fully loaded behind him. Final frame is still floating with the fist charged — he does not punch yet. This must be a real coil, not a float with the arm already back from frame 1.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 5 — P1 Slam & Land (end-pose variants)
**File target:** `images/enemies/grand-challenger-p1-slam-land.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 1 — 8-foot muscular humanoid alien warrior. Dark gunmetal metallic skin with glowing cyan-white cosmic vein cracks, two tiny white-light eyes (no pupils), minimal armor (heavy pauldrons, armored forearms, boots, belt/chest), torn charcoal cloak, no weapon, fists only. Calm, unimpressed. About 96×132 logical size.
>
> Row 1 (8 frames) – Downward slam punch: Begin in the air, body high in the cell. Drive one fist straight down; the shoulders, hips, and boots follow the fist so the whole body becomes a downward spear. The cloak streams upward from the speed. Cyan veins blaze on the striking arm. Later frames approach the ground; the last frames are the impact pose — fist at or through ground level, knees bent from the hit, dust and a small crater suggested at the contact. Final frame is the slammed impact pose. This must travel from high air to impact, not eight frames of a posed slam.
>
> Row 2 (8 frames) – Land recover → STAND: Begin with the same crash landing as Rows 3 and 4: one knee and one fist in the dust, cloak thrown forward, body compressed from impact. Early frames hold that crash. Then he pushes up through the planted fist and bent leg, hips rising, the free boot stepping under him. Later frames extend to full height. Final frame is a standing idle. Same landing start as Row 3/4; only the ending differs.
>
> Row 3 (8 frames) – Land recover → CROUCH: Use identical first 3 landing frames as Row 2 (crash, one knee and one fist). Then instead of rising he stays low: the hips settle, the second boot plants wide, fists stay near the ground, cloak pools. Later frames are a stable deep crouch. Final frame is crouched, not standing. Do not stand up in this row.
>
> Row 4 (8 frames) – Land recover → FLOAT: Use identical first 3 landing frames as Row 2 (crash, one knee and one fist). Then he pushes off the ground: legs extend, body lifts, boots leave the dust. Later frames rise into a hover, cloak hanging, fists relaxing. Final frame is hovering/floating, not standing. The first three frames must match Row 2.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 6 — P1 Punch (stand endings)
**File target:** `images/enemies/grand-challenger-p1-punch-stand.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 1 — 8-foot muscular humanoid alien warrior. Dark gunmetal metallic skin with glowing cyan-white cosmic vein cracks, two tiny white-light eyes (no pupils), minimal armor (heavy pauldrons, armored forearms, boots, belt/chest), torn charcoal cloak, no weapon, fists only. Calm, unimpressed. About 96×132 logical size.
>
> Row 1 (8 frames) – Charge punch → STAND: Begin standing. Plant both boots wider, drop the hips a little, and pull one fist all the way back past the pauldron. Cyan-white veins on that arm and the chest brighten as the coil builds. The cloak pulls tight against the rotating torso. Mid frames are the peak charge — fist fully back, body loaded. Then he eases the fist down and the knees unbend without throwing. Final frame is a standing idle, uncharged. He does not punch in this row. This must show plant → coil → ease-off, not a held pose.
>
> Row 2 (8 frames) – Punch forward: Begin from the charged pose (fist back, feet planted, veins bright). Drive a straight right-hand punch: the fist travels forward, the hip and shoulder rotate, the rear boot pushes. Shock lines appear at the knuckles on the later hit frames — no projectile leaves the hand. The cloak snaps backward. Pauldrons follow the punch. Final frame is full follow-through, arm extended, weight on the lead boot. This must be a traveling punch, not a standing pose with the arm already out.
>
> Row 3 (8 frames) – Follow-through → STAND: Begin in the punch follow-through (arm extended). Recoil the punching arm back, step the rear boot up, shoulders settle, veins dim. Mid frames are a recovering step. Later frames return to a casual standing idle. Final frame is standing, fists down. This is a recovery, not another punch.
>
> Row 4 (8 frames) – Jab: Begin in a fight stance. Snap a short jab — the lead fist fires and returns faster than Row 2, less hip rotation, less cloak snap. The punch lands in the mid frames and the arm is already retracting in the later frames. Cyan veins flash briefly on the jabbing arm. Final frame is back in the stance, guard up. This must be a quick jab cycle, not a copy of Row 2.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 7 — P1 Punch (float endings — same charges, different finish)
**File target:** `images/enemies/grand-challenger-p1-punch-float.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 1 — 8-foot muscular humanoid alien warrior. Dark gunmetal metallic skin with glowing cyan-white cosmic vein cracks, two tiny white-light eyes (no pupils), minimal armor (heavy pauldrons, armored forearms, boots, belt/chest), torn charcoal cloak, no weapon, fists only. Calm, unimpressed. About 96×132 logical size.
>
> Row 1 (8 frames) – Charge punch → FLOAT: Begin standing and use the same charge motion as Sheet 6 Row 1: plant the boots, pull one fist all the way back past the pauldron, cyan veins brighten, cloak tightens against the rotating torso. After the peak charge he does not ease back to a stand — the boots leave the ground and the body lifts. Later frames are airborne with the fist still fully back. Final frame is floating, fist still charged. Same coil as Sheet 6 Row 1; different finish.
>
> Row 2 (8 frames) – Punch forward from float: Begin floating in the charged pose. Throw the straight punch while airborne: fist travels forward, torso rotates, the body kicks slightly backward from the force so he drifts opposite the punch. The cloak snaps. No projectile. Later frames show full extension in the air. Final frame is floating in follow-through, still off the ground. This must be a traveling airborne punch, not a hover with the arm already out.
>
> Row 3 (8 frames) – Follow-through → FLOAT: Begin in the airborne punch follow-through. Recoil the arm in the air, body settles, veins dim. He does not land. Later frames ease into a float idle — knees soft, cloak hanging, fists relaxed. Final frame is a float idle, not standing.
>
> Row 4 (8 frames) – Cross / hook: Begin from a float or a light hop off the ground. Swing a wide hook: the punching fist travels in a horizontal arc, the whole torso and both pauldrons rotate, the cloak fans out. Hips turn with the hook. Later frames complete the arc and the body is still airborne. Final frame is floating after the hook. This must be a wide traveling hook, not a straight punch with the elbow bent.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 8 — P1 Uppercut
**File target:** `images/enemies/grand-challenger-p1-uppercut.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 1 — 8-foot muscular humanoid alien warrior. Dark gunmetal metallic skin with glowing cyan-white cosmic vein cracks, two tiny white-light eyes (no pupils), minimal armor (heavy pauldrons, armored forearms, boots, belt/chest), torn charcoal cloak, no weapon, fists only. Calm, unimpressed. About 96×132 logical size.
>
> Row 1 (8 frames) – Crouch under: Begin standing or in a short dash. Drop and slide low to the right as if ducking under a flying target: knees and hips sink, torso leans forward, one fist skims near the ground, cloak streaming back. Later frames a magic circle begins to form under the boots — faint cyan ring, incomplete at first, stronger in the last frames. Final frame is a deep slide-crouch with the circle starting under the boots. This is a dash-into-crouch, not a still duck.
>
> Row 2 (8 frames) – Uppercut launch: Begin in that deep crouch with the circle under the boots. The magic circle fully forms in the early frames. Then he launches straight up: legs extend, the rising fist drives from the hip past the chin to full overhead, body leaves the ground. The cloak streams down. Cyan veins blaze on the rising arm. Later frames are high in the cell, circle left on the ground or fading. Final frame is rising with the uppercut fist high. This must leave the ground, not an uppercut posed while crouched.
>
> Row 3 (8 frames) – Aerial rising fist: Begin already going up from the uppercut. The striking arm is fully extended overhead, body stretched in a vertical line, cloak streaming straight down. He continues to climb across the frames — later frames higher than early frames. Vertical force is suggested in the pose only (stretched body, streaming cloak), no extra beam. Final frame is still rising, fist at the top of the silhouette. This is continued ascent, not a hover.
>
> Row 4 (8 frames) – Crash down: Begin high in the air from the rising fist. The body falls — fist-first or feet-first, pick one and keep it consistent — accelerating toward the ground. Cloak streams upward. Later frames approach impact; the last frames are an impact crouch, knees bent, dust at the boots. Final frame is the crash crouch on the ground. This must travel from high air to ground, not eight impact poses.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 9 — P1 Space Point & Punch
**File target:** `images/enemies/grand-challenger-p1-space.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 1 — 8-foot muscular humanoid alien warrior. Dark gunmetal metallic skin with glowing cyan-white cosmic vein cracks, two tiny white-light eyes (no pupils), minimal armor (heavy pauldrons, armored forearms, boots, belt/chest), torn charcoal cloak, no weapon, fists only. Calm, unimpressed. About 96×132 logical size.
>
> Row 1 (8 frames) – Point at distant planet: Begin standing. Plant the boots, then raise one full arm and point at the sky/horizon — not at the viewer, upward and out. Nothing leaves his hand. The other fist stays down. Head tilts up to follow the point. Cloak hangs. Later frames hold the locked point. Final frame is standing, arm raised, still pointing. This must rise from rest to a full sky-point, not eight frames already pointing.
>
> Row 2 (8 frames) – Space punch: Begin from the pointing pose. Close the pointing hand into a fist and throw a straight punch into empty air — the spell is the punch itself. Nothing leaves the hand. Hip and shoulder rotate, cloak snaps, veins brighten on the punching arm. Later frames are full extension into empty space. Final frame is follow-through, still standing. This is a traveling punch from the point, not a held punch pose.
>
> Row 3 (8 frames) – Recover → STAND: Begin in the space-punch follow-through. Lower the punching arm, step the feet back under him, shoulders settle, veins dim. Early frames still have the arm high/extended. Mid frames are the step. Later frames are a standing idle. Final frame is standing idle, fists down.
>
> Row 4 (8 frames) – Recover → FLOAT: Use the same first 3 recover frames as Row 3 (arm lowering, first step). Then instead of settling on the ground he lifts off: knees tuck, boots leave the dust, body rises into a hover. Later frames are a float idle. Final frame is floating, not standing. First 3 frames must match Row 3.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 10 — P1 Arena Body
**File target:** `images/enemies/grand-challenger-p1-arena.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 1 — 8-foot muscular humanoid alien warrior. Dark gunmetal metallic skin with glowing cyan-white cosmic vein cracks, two tiny white-light eyes (no pupils), minimal armor (heavy pauldrons, armored forearms, boots, belt/chest), torn charcoal cloak, no weapon, fists only. Calm, unimpressed. About 96×132 logical size.
>
> Row 1 (8 frames) – Gravity compress: Begin standing tall and relaxed. Suddenly an enormous gravitational force presses down on him. His shoulders lower, knees bend, hips sink, and torso compresses downward as though his body has become several times heavier. His boots press firmly into the ground, causing tiny cracks to appear around them. His cloak hangs almost perfectly straight downward from the increased gravity. The cyan veins brighten as he resists the force. Final frame shows him in a dramatically compressed stance with bent knees, lowered hips, and shoulders close to his center of gravity.
>
> Row 2 (8 frames) – Heavy crater step: Begin standing or slightly compressed. Lift one enormous boot high enough that the leg is clearly separated from the ground, then drive it forward and downward with tremendous force. The hips and shoulders move with the step, and the cloak swings backward from the momentum. The boot makes contact in the later frames, creating a crater and sending dust and small rocks outward. His entire body dips from the force of the landing. Final frame should be mid-stride or fully planted with the weight clearly transferred onto the stepping leg. This must look like an actual enormous step, not a standing pose with one foot moved slightly forward.
>
> Row 3 (8 frames) – Grab the ground: Begin standing and then lower rapidly into a deep crouch. Spread both feet for stability and bend deeply at the knees and hips. Both arms reach toward the ground simultaneously. His fingers extend and then curl into the lunar surface, with his hands visibly sinking into the crust. His shoulders and back tense as he prepares to lift something impossibly heavy. Dust gathers around both hands and boots. Final frames show both hands firmly embedded in the ground, arms tense, back lowered, and body clearly braced for a powerful lift.
>
> Row 4 (8 frames) – Rip / lift slab: Begin with both hands gripping the ground. Pull upward with both arms while driving through the legs and extending the hips. A huge slab of planetary crust begins breaking free beneath his hands. The slab should rise progressively higher across the frames: ground level → knees → waist → chest → shoulder height. His torso leans backward under the weight and his legs widen to maintain balance. Dust, debris, and cracks spread outward as the slab separates. Final frame shows him holding an enormous chunk of planetary crust at chest/shoulder height, clearly demonstrating immense physical strength.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 11 — P1 Motion
**File target:** `images/enemies/grand-challenger-p1-motion.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 1 — 8-foot muscular humanoid alien warrior. Dark gunmetal metallic skin with glowing cyan-white cosmic vein cracks, two tiny white-light eyes (no pupils), minimal armor (heavy pauldrons, armored forearms, boots, belt/chest), torn charcoal cloak, no weapon, fists only. Calm, unimpressed. About 96×132 logical size.
>
> Row 1 (8 frames) – Flashstep vanish: Begin standing in a ready stance. He does not teleport. He accelerates hard to the right: early frames show a lean and a violent step, mid frames smear into motion-blur and torn-cloak afterimages, later frames are a nearly empty streak where the body used to be. Pauldrons, boots, and fists stretch into the blur. Final frame is an almost-empty motion streak, not a posed stand. This must be acceleration into blur, not eight afterimage stickers on a still body.
>
> Row 2 (8 frames) – Flashstep punch pose: He is already at the impact — do not show the travel. Mid-punch silhouettes sit at slightly different offsets, afterimages of the fist and cloak stacked around the real body. Early frames are the densest smear; later frames resolve toward a single punch-connect pose. Final frame is a clear punch-connect, arm extended, weight committed. This is an arrival-at-impact, not a vanish row.
>
> Row 3 (8 frames) – Dash-in: Begin standing or in stance. Explosive step toward the right: body drops low, lead fist leading, rear boot driving. Hips and shoulders commit forward. Cloak streams back. Later frames plant the lead boot and transfer all the weight. Final frame is planted after the dash, low and stopped. This must be a real dash, not a standing lean.
>
> Row 4 (8 frames) – Throw slab: Begin holding a huge rock mass in both hands at chest/shoulder height (or, if the slab is not shown, an empty two-handed overhead grip). Heave it forward: arms extend, torso rotates, rear boot pushes, cloak snaps back. The slab (or implied mass) leaves his hands in the later frames and travels right. Follow-through with both arms out. Final frame is standing after the throw, empty hands. This must show the release, not eight frames holding the rock.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 12 — P2 Awaken / Limit Release
**File target:** `images/enemies/grand-challenger-p2-awaken.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 2 — 8-foot muscular humanoid alien warrior. Armor is REMOVED over this sheet. Row 1 still wears Phase 1 armor: dark gunmetal metallic skin with glowing cyan-white cosmic vein cracks, two tiny white-light eyes (no pupils), heavy pauldrons, armored forearms, boots, belt/chest, torn charcoal cloak, no weapon, fists only. After Row 1: armor gone, unarmored dark metallic skin with brighter cyan-magenta cosmic vein cracks overflowing with light, two blazing white eyes (no pupils), a sharp eager smile, torn charcoal cloak and heavy boots only, overflowing cyan-magenta aura. About 96×132 logical size.
>
> Row 1 (8 frames) – Armor discard: Begin still wearing Phase 1 armor, standing, calm. Roll both shoulders; heavy pauldrons crack, then forearm plates and the belt/chest split and fall away across the mid frames. Cyan-white cracks ignite into brighter cyan-magenta as the plates leave. The face changes: tiny eyes begin to blaze and a smile starts. The cloak stays. Boots stay. Later frames show armor pieces mid-fall and the body newly unarmored. Final frame is unarmored, markings ignited, smile beginning. This must be armor breaking off over time, not eight frames of already-bare skin.
>
> Row 2 (8 frames) – Smile / “Enough testing.”: Begin unarmored as Row 1 ended. The smile widens into a slight laugh-smile, blazing white eyes narrowing with amusement. One hand rises in a small dismissive wave or flick, then drops. Overflowing aura starts to wrap the torso and snap the cloak. Cracks pulse. Later frames settle the hand. Final frame is standing unarmored, smiling, dismissive motion finished. This must show the smile and the dismissive hand moving, not eight grinning portraits.
>
> Row 3 (8 frames) – “Now… fight me.”: Begin standing unarmored, smiling. Open both hands, step the lead boot in, drop into an eager stance. The overflowing aura flares brighter and the cloak snaps. Eyes at their brightest white. Hips lower; both fists then close into a ready guard. Later frames hold the eager stance. Final frame is the eager fight stance, not a casual stand. This must be a step-in and flare, not a held pose from frame 1.
>
> Row 4 (8 frames) – Limit Release slam: Begin in the eager stance. Drive one fist down into the moon: whole body follows, knees bend on impact. The ground shatters under the fist — fragments of crust lift and hang in the later frames. Body at max glow, cyan-magenta cracks and aura at peak. Cloak blown upward from the slam. Final frame is the slammed pose with fragments lifting around the embedded fist. This must travel into the slam, not a held explosion pose.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 13 — P2 Idle & Move
**File target:** `images/enemies/grand-challenger-p2-idle-move.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 2 — 8-foot muscular humanoid alien warrior. Unarmored: dark metallic skin with brighter cyan-magenta cosmic vein cracks overflowing with light, two blazing white eyes (no pupils), a sharp eager smile, torn charcoal cloak and heavy boots only (no pauldrons, no forearm plates, no belt/chest armor), no weapon, fists only. Overflowing cyan-magenta aura wraps the torso and snaps the cloak. About 96×132 logical size.
>
> Row 1 (8 frames) – Idle aura: Begin standing unarmored, slight smile, boots planted. The overflowing aura whips the torn cloak left and right across the frames. Cyan-magenta cracks pulse hard — brighter, then slightly less, then brighter. Chest rises with a small breath. Blazing white eyes stay lit. Loop-friendly: final frame matches the start enough to cycle. This is a living aura idle, not eight identical stands.
>
> Row 2 (8 frames) – Float idle: Begin hovering about a foot off the ground, relaxed, slight smile. Tiny vertical bob — a few pixels up then down so the row can loop. The cloak hangs in his own wind; the overflowing aura makes it drift. Boots dangle; knees soft; fists relaxed. Cracks pulse. Final frame is still floating. Ends floating. Loop-friendly hover, not a jump.
>
> Row 3 (8 frames) – Fast walk / run: Begin in a stand or first step. Aggressive lean-forward run to the right, much faster than Phase 1 walk: longer strides, lower torso, pumping fists. Afterimages suggested on the cloak and trailing leg in the mid-to-late frames. Boots cycle clearly off and onto the ground. Hips and shoulders roll hard. Final frame is mid-run so it can loop. This must be a real run cycle, not a leaning stand.
>
> Row 4 (8 frames) – Float dash: Begin from the hover. Kick forward through the air as a streak: body elongates, cloak and aura stream into a line, boots trail. Later frames are farther right and more smeared. Final frame is floating again after the dash, still off the ground. This is a travel dash, not a hover with a tilted pose.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 14 — P2 Cataclysm Actions
**File target:** `images/enemies/grand-challenger-p2-cataclysm.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 2 — 8-foot muscular humanoid alien warrior. Unarmored: dark metallic skin with brighter cyan-magenta cosmic vein cracks overflowing with light, two blazing white eyes (no pupils), a sharp eager smile, torn charcoal cloak and heavy boots only (no pauldrons, no forearm plates, no belt/chest armor), no weapon, fists only. Overflowing cyan-magenta aura wraps the torso and snaps the cloak. About 96×132 logical size.
>
> Row 1 (8 frames) – Grab planet hunk: Begin standing or reaching. Both arms reach “off screen” (up or to the side, hands leaving the comfortable frame). Then he hauls a huge irregular rock hunk into frame: the mass appears at the hands and drops to a held position at chest/shoulder height. Legs widen, torso leans back under the weight, cloak pulls, aura tightens around the hunk. Dust on the rock. Later frames show the hunk fully in frame and gripped. Final frame is holding the huge irregular rock. The rock must arrive over the frames, not sit in his hands from frame 1.
>
> Row 2 (8 frames) – Split into 3: Begin holding the single hunk. Both hands tear it: early frames strain, cracks appear in the rock, then it splits into three pieces that he holds or suspends — one in each hand and one between or hovering at the aura. Arms spread as the pieces separate. Smile stays. Later frames show three distinct fragments. Final frame is the three pieces held/suspended. This must split over time, not start as three rocks.
>
> Row 3 (8 frames) – Punch a piece out: Begin holding/suspending the three pieces. One sharp punch sends one fragment flying right: the punching fist travels, that piece accelerates off the hand/aura and exits or sits farther right in later frames. The other two pieces stay. Body rotates with the punch, cloak snaps, aura lashes. Replayable — the pose should work if this row is played three times. Final frame is follow-through with one piece gone/flying. This is a punch that launches a rock, not a still hold.
>
> Row 4 (8 frames) – Pull pieces back: Begin with an open hand, body slightly open. The three rocks (suggested) fly back in from the right / off-frame toward him across the mid frames. He braces: feet widen, knees bend, free arm guards, overflowing aura tightens. Later frames the pieces arrive close to his body. Final frame is braced for a collision, pieces close. This must show inbound travel, not three rocks already stacked on him.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 15 — P2 Barrage & Thousand-Fist
**File target:** `images/enemies/grand-challenger-p2-barrage.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 2 — 8-foot muscular humanoid alien warrior. Unarmored: dark metallic skin with brighter cyan-magenta cosmic vein cracks overflowing with light, two blazing white eyes (no pupils), a sharp eager smile, torn charcoal cloak and heavy boots only (no pauldrons, no forearm plates, no belt/chest armor), no weapon, fists only. Overflowing cyan-magenta aura wraps the torso and snaps the cloak. About 96×132 logical size.
>
> Row 1 (8 frames) – Leap into space: Begin standing, then crouch deep: hips back, knees bent, cloak gathering, aura compressing. Explode upward so hard he leaves the top of the frame: mid frames extend and leave the ground, later frames the body is cropped by the top of the cell — head and shoulders gone or only boots/cloak visible. Final frame is almost off-sheet, only the lower body or a cloak edge. This is a launch out of frame, not a normal jump that stays fully visible.
>
> Row 2 (8 frames) – Space punch downward: Begin hanging in space, high in the cell or partly in frame, facing down-right toward a distant world (world not required). Punch “down”: the fist travels downward, torso folds, cloak streams up, aura lashes. Replayable — start and end should allow a loop of repeated downward punches. Final frame is downward follow-through, still hanging in space. This is a traveling downward punch, not a posed stab.
>
> Row 3 (8 frames) – Thousand-fist blur: Begin already in a flurry. The body is almost a smear of fists and afterimages — multiple fist offsets, cloak fragments, blazing eyes somewhere in the smear. The smear shifts across the eight frames so it can loop (pattern moves, does not freeze). Final frame is still blurred, not a clean pose. Loop-friendly flurry. Do not resolve to a single readable idle.
>
> Row 4 (8 frames) – Silence, fist back: Begin with the blur from Row 3 still present in the first frame or two. The blur STOPS — afterimages vanish, the single unarmored body resolves, standing or hovering, facing right, one fist drawn all the way back. No extra VFX. Remaining frames are an almost motionless hold of that charged silence; tiny breathing only after the stop. Stillness is the point after the blur dies. Final frame is the silent charged pose, fist fully back, no blur.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 16 — P2 One Hit
**File target:** `images/enemies/grand-challenger-p2-onehit.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 2 body, but this sheet has almost no aura — magic withdrawn on purpose. 8-foot muscular humanoid alien warrior, unarmored dark metallic skin, cyan-magenta vein cracks dimmer than other Phase 2 sheets, two tiny white-light eyes (no pupils, not blazing), no giant glow, torn charcoal cloak and heavy boots only, no overflowing aura, no weapon, fists only. About 96×132 logical size.
>
> Row 1 (8 frames) – Still: Begin and stay standing. Tiny breathing only — a one- or two-pixel rise and fall of the chest and a faint cloak tick. Cracks do not pulse hard. Eyes stay tiny white points. No aura, no weight shift, no shoulder roll, no smile change. Stillness is the point; the near-motionlessness is what makes it terrifying. Do not add a gesture. Final frame is the same stand as the start.
>
> Row 2 (8 frames) – Raise one fist: Begin from that still stand. Slowly raise one fist from the side to a loaded position beside the head/shoulder. No flourish — no cloak whip, no aura. The elbow bends, the shoulder rises, the torso barely rotates. Early frames the fist is low; mid frames halfway; later frames the fist is up. Final frame is the fist fully raised, body otherwise still. This must travel, not start already raised.
>
> Row 3 (8 frames) – Tiny magic circle: Begin with the fist already up. A small cyan circle appears around the knuckles — faint in the early frames, complete and readable in the later frames. Nothing else appears: no aura bloom, no ground ring, no second circle. The body stays almost still, fist up. Final frame is fist up plus the small cyan circle on the knuckles.
>
> Row 4 (8 frames) – Simple punch: Begin with fist up and the tiny circle on the knuckles. One clean straight punch: the fist travels forward, the circle rides the knuckles, the hip turns a little. No beam, no giant spell. Later frames are the punch at full extension. Final frame is a short follow-through, still no extra VFX. The punch must travel, not appear already extended.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 17 — P2 Living Extras (duplicate actions, different finish)
**File target:** `images/enemies/grand-challenger-p2-living.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 2 — 8-foot muscular humanoid alien warrior. Unarmored: dark metallic skin with brighter cyan-magenta cosmic vein cracks overflowing with light, two blazing white eyes (no pupils), a sharp eager smile, torn charcoal cloak and heavy boots only (no pauldrons, no forearm plates, no belt/chest armor), no weapon, fists only. Overflowing cyan-magenta aura wraps the torso and snaps the cloak. About 96×132 logical size.
>
> Row 1 (8 frames) – Look at player, excited: Begin standing, looking slightly off. The head turns toward the player/right, smile widens, blazing white eyes flare brighter. The cloak snaps once with the head turn. Shoulders and overflowing aura react. Later frames hold the excited look. Final frame is standing, looking at the player, excited. This must turn and flare, not eight grinning portraits.
>
> Row 2 (8 frames) – Fast neck crack → STAND: Begin standing, smiling. Same idea as Phase 1 neck crack but quicker: the head snaps through the roll in fewer frames, neck crack in the mid frames, shoulders drop, smile stays, overflowing aura ticks once. Faster than P1. Later frames return the head to center. Final frame is standing, head forward, smiling.
>
> Row 3 (8 frames) – Charge punch → FLOAT (overflow): Begin standing. Same charge as P1 Sheet 6 Row 1: plant the boots, pull one fist all the way back, body coils — but cyan-magenta aura overflows and lashes the cloak as he coils. After the peak he lifts off and finishes floating with the fist still back. Later frames are airborne, fist loaded. Final frame is floating, overflowing aura, fist charged. He does not punch.
>
> Row 4 (8 frames) – Land from space → FLOAT: Begin crashing in from above, high in the cell. Same first landing frames as P1 land: impact, one knee and one fist, dust, cloak thrown forward. Then he bounces: legs extend, body leaves the ground, overflowing aura lifts him into a hover. Later frames are the hover. Final frame is floating after the bounce. First landing frames match a P1 crash land.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 18 — P3 Martial
**File target:** `images/enemies/grand-challenger-p3-martial.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 3 — 8-foot muscular humanoid alien warrior. All magic gone: no overflowing aura, dim dark cosmic vein cracks, scuffed and cut gunmetal metallic skin, tired but proud, two tiny dim white-light eyes (no pupils), no armor, cloak in tatters, boots still on, no weapon, fists only. Pure martial artist. About 96×132 logical size.
>
> Row 1 (8 frames) – Tired idle: Begin standing, no aura, tatters hanging, fists loose, watching. Breathing hard: chest and shoulders heave more than Phase 1 idle — inhale on the early frames, heavier exhale on the later frames. Scuffed skin and dim cracks stay dim. Head stays up, tired but proud. Loop-friendly breath. Final frame matches the start enough to cycle. This is exhausted breathing, not a statue.
>
> Row 2 (8 frames) – Pure martial idle: Begin in a tighter guard than Row 1: fists up, no glow, more focused. Small weight shifts heel to heel — one knee softens, then the other. Tiny head adjustments; cloak tatters drift. Dim cracks do not pulse like Phase 2. Loop-friendly. Final frame still in the martial guard. No magic, no aura pulse.
>
> Row 3 (8 frames) – Jab-cross combo: Begin in the martial guard. First half (frames 1–4): a clean jab — lead fist fires and retracts, hip ticks, no magic trails. Second half (frames 5–8): a cross from the rear hand, full hip rotation, committed shoulder, cloak tatters snap, still no trails. Later frames recover toward guard. Final frame is back in guard. Body mechanics only. Both punches must travel.
>
> Row 4 (8 frames) – Dash-in punch: Begin in guard. Short explosive step to the right, body low, rear boot driving, then a committed straight punch as the lead boot plants. Cloak tatters stream back. Knees and hips commit with the step. No glow. Final frame is planted after the punch, weight on the lead leg. This is a dash then punch, not a standing punch.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 19 — P3 End
**File target:** `images/enemies/grand-challenger-p3-end.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 3 — 8-foot muscular humanoid alien warrior. All magic gone: no overflowing aura, dim dark cosmic vein cracks, scuffed and cut gunmetal metallic skin, tired but proud, two tiny dim white-light eyes (no pupils), no armor, cloak in tatters, boots still on, no weapon, fists only. Pure martial artist. About 96×132 logical size.
>
> Row 1 (8 frames) – Kneel: Begin standing, tired but proud. He drops to one knee: the lead knee lowers, the other boot stays planted, hands find the thigh or hang, head stays up the whole time. Cloak tatters pool. Hips and shoulders sink with the drop. Later frames settle the kneel. Final frame is one knee, head still up. This must drop from stand, not start kneeling.
>
> Row 2 (8 frames) – Look up and laugh: Begin from the kneel. The head tilts up, the mouth opens into a real joyful laugh (“Finally.”), eyes still dim but alive. Shoulders shake once with the laugh in the mid frames. Cloak tatters barely move. He stays kneeling — hips do not rise. Final frame is kneeling, looking up, laughing. This must look up and open into the laugh, not eight identical laughing portraits.
>
> Row 3 (8 frames) – Dust crumble: Begin still kneeling and laughing. The body crumbles into pale cosmic dust from the feet up: early frames the boots and lower legs dissolve into motes, mid frames the thighs and torso, later frames the shoulders and head while the laugh shape remains as long as there is a face. Final frame is mostly dust with a faint upper-body remnant or a dust-cloud kneel. Progressive crumble, not eight identical dust piles.
>
> Row 4 (8 frames) – Empty dust fade: Begin with the last of the dust where he knelt. Across the frames the motes thin and fade. Later frames are emptier. Final frames are empty or nearly empty fading motes where he stood — no body. This row ends empty. Do not redraw the character.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 20 — P1 Multi-Action Combos
**File target:** `images/enemies/grand-challenger-p1-combos.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 1 — 8-foot muscular humanoid alien warrior. Dark gunmetal metallic skin with glowing cyan-white cosmic vein cracks, two tiny white-light eyes (no pupils), minimal armor (heavy pauldrons, armored forearms, boots, belt/chest), torn charcoal cloak, no weapon, fists only. Calm, unimpressed. About 96×132 logical size. Each row is TWO actions in one 8-frame clip.
>
> Row 1 (8 frames) – Walk into crouch: First 4 frames are the heavy walk: lift the lead boot, plant it with lunar dust, hips and shoulders roll, cloak trailing — a real step, not a slide. Last 4 frames drop from that walk into the deep athletic crouch: hips shoot back, knees bend, fists lower to the ground, cloak pools, and he holds the crouch. Final frame is the held deep crouch. Both halves must move.
>
> Row 2 (8 frames) – Shoulder roll into beckon: First 4 frames roll both shoulders and heavy pauldrons in a backward circle, cloak tosses, cyan veins pulse once. Last 4 frames raise one hand and slowly curl the fingers “come”, eyes a little brighter, other fist staying down. Final frame is standing with the beckon held. Both halves must move.
>
> Row 3 (8 frames) – Get up into neck crack: First 4 frames rise from one knee and one fist in the dust: push up through a crouch to a full stand, cloak lifting off the ground. Last 4 frames roll the head and crack the neck (the snap in the middle of those four), shoulders and pauldrons drop. Final frame is standing after the crack. Both halves must move.
>
> Row 4 (8 frames) – Crouch-jump into aerial windup: First 4 frames coil into a deep crouch then explode upward, boots leaving the ground with dust at the prints. Last 4 frames are midair: he draws a fist all the way back past the pauldron, torso coils, cloak twists, still floating. Final frame is floating charged. He does not punch. Both halves must move.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

---

#### Sheet 21 — P2 Multi-Action Combos
**File target:** `images/enemies/grand-challenger-p2-combos.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 8 columns (32 frames total) arranged in a perfectly aligned grid with even spacing. 16:9 sheet.
> Transparent background.
>
> Character: The Grand Challenger Phase 2 — 8-foot muscular humanoid alien warrior. Unarmored: dark metallic skin with brighter cyan-magenta cosmic vein cracks overflowing with light, two blazing white eyes (no pupils), a sharp eager smile, torn charcoal cloak and heavy boots only (no pauldrons, no forearm plates, no belt/chest armor), no weapon, fists only. Overflowing cyan-magenta aura wraps the torso and snaps the cloak. About 96×132 logical size. Each row is TWO actions in one 8-frame clip.
>
> Row 1 (8 frames) – Float dash into punch: First 4 frames are the hover-dash: from a float, kick forward through the air as a streak, cloak and overflowing aura streaming, body elongating. Last 4 frames throw a midair straight punch: fist travels forward, torso rotates, body kicks back slightly. Final frame is floating after the punch. Both halves must move.
>
> Row 2 (8 frames) – Excited look into fast neck crack: First 4 frames turn the head toward the player, smile widens, blazing white eyes flare, cloak snaps. Last 4 frames are a quick smiling neck crack: head snaps through the roll, shoulders drop, aura ticks. Final frame is standing after the crack. Both halves must move.
>
> Row 3 (8 frames) – Fast walk into grab hunk: First 4 frames are the aggressive lean-forward run, longer strides than Phase 1, afterimage suggested on the cloak and trailing leg. Last 4 frames he reaches off-screen and hauls a huge irregular rock hunk into frame, legs widening, torso leaning back under the weight. Final frame is holding the hunk. Both halves must move. The rock must arrive in the second half, not sit in his hands from frame 1.
>
> Row 4 (8 frames) – Charge overflow into float: Frames 1–5 are the same punch charge as other charge rows: plant the boots, pull one fist all the way back, body coils, cyan-magenta aura overflows and lashes the cloak. Frames 6–8 he lifts off and finishes hovering with the fist still back. Duplicate of the charge, different end pose. He does not punch. Final frame is hovering, fist charged. This must show coil then lift-off, not a held floating charge.
>
> Style: clean digital pixel-art sprite sheet, epic cosmic raid boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
>
> END OF PROMPT;

### Grand Challenger — Attack choreography (actions → attacks)

Play the named action rows in order. Do not animate a whole attack as a single row.

**Intro:** Walk → Neck crack → Shoulder roll into beckon → Idle  
**Phase 2 cut:** Armor discard → Smile / Enough testing → Limit Release slam → Now fight me → Idle aura  
**Phase 3 cut:** Tired idle  
**Death:** Kneel → Laugh → Dust crumble → Empty dust fade

21 sheets × 4 rows × 8 frames = **672 frames** (Seraphel is ~168). Attacks are sequences of those rows, not single rows.

| Attack | Action sequence |
|---|---|
| **Planetbreaker** | Crouch → Crouch-to-jump → Crouch-jump into aerial windup → Aerial punch windup → Downward slam → Land recover → STAND. Then shockwave rings. Then a long rain of **cold rock debris**. |
| **Celestial Uppercut** | Dash-in → Crouch under → Uppercut launch → Aerial rising fist → Crash down → Land recover → CROUCH → Stand from crouch |
| **Meteor Punch** | Stance → Point at planet → Charge punch → STAND → Space punch → Follow-through → STAND. Delay. Then a long rain of **burning debris**. |
| **Gravity Step** | Gravity compress → Heavy stomp walk, with Heavy crater step on each footfall |
| **Flashstep** | Flashstep vanish (hide) → Flashstep punch poses at the impact slots → Land recover → STAND |
| **Mortal Challenge** | Point (“You. Stand.” first time only) → Stance → (loop) Charge/Jab/Cross/Punch → Dash-in. If the target stays airborne in Phase 1, branch into **Celestial Uppercut**. Phase 3 uses Jab-cross and Dash-in punch at 110% of the slowed base. |
| **Worldbreaker** | Crouch → Grab the ground → Rip / lift slab → Throw slab → Follow-through → STAND |
| **Planetary Cataclysm** | Grab hunk → Split into 3 → Punch a piece ×3 → Pull pieces back → collision |
| **Starfall Barrage** | Crouch-to-jump → Leap into space (hide) → Space punch downward (repeating, accelerating) → Land from space → FLOAT |
| **Thousand-Fist** | Float dash → Thousand-fist blur → Silence, fist back → Simple punch (gust, destroys spells) → Follow-through → STAND |
| **One Hit** | Still (no aura) → Raise one fist → Tiny magic circle → Simple punch |

**Debris rules (combat, not a sprite row):** two types — **cold rock** and **burning rock**. Both behave like a **solidify** projectile while airborne (the player can land on them). They fall slower, last longer, and there are many more of them. On ground contact they **explode and vanish** (do not stay as platforms).

---

### Grand Challenger — Attack VFX (individual assets)

Use these for isolated transparent VFX plates (not sprite sheets). Target roughly 1024×1024 unless noted.

**Planetbreaker traveling wave** — `images/fx/challenger-ring-wave.png` (16:9)

**Prompt:**
> Transparent background, isolated 2D VFX plate, 16:9 wide. Side-view traveling ground shockwave: a wide horizontal crescent of shattered grey lunar rock and compressed pale cyan-white air, riding low to the ground as if racing left to right. Jagged moon-dust spray hangs just above the crescent; concentric force ripples stack behind the leading edge like stacked glass rings. Materials: fractured regolith, pulverized dust, compressed air that reads as pale cyan glass. Lighting is a hard cyan-white rim on the leading edge with cooler grey fill in the rock. Composition sits low in the frame, empty sky above, empty center not required. Palette: lunar grey, cyan-white, faint ice-blue mineral flecks. No characters, no fists, no text, no UI.
> END OF PROMPT;

**Mortal Challenge fist pulse** — `images/fx/challenger-fist-pulse.png` (16:9)

**Prompt:**
> Transparent background, isolated 2D VFX plate, 16:9 wide. Side-view punch pulse of glowing cyan-white compressed air shaped like a traveling fist, moving left to right. A knuckle shock cone flares at the front; pale force streaks trail behind like torn wind. Lunar dust is kicked in a short wake, not a ground crater. Materials: compressed air, cyan-white energy, fine grey dust. Lighting is brightest at the knuckle face, fading to translucent streaks. Composition is a single traveling burst centered horizontally. Not a magic missile, not a beam, not a fireball. Palette: cyan-white, pale ice, grey dust. No character body, no text.
> END OF PROMPT;

**Planetary Cataclysm rock** — `images/fx/challenger-cataclysm-rock.png`

**Prompt:**
> Transparent background, isolated 2D still of a large irregular hunk of ripped planetary crust. Grey-brown rock with icy-blue mineral veins and cyan-white impact cracks splitting the surface; the underside is lined with jagged spikes of broken stone. Materials: layered lunar crust, frozen mineral veins, freshly broken faces that catch light. Lighting is a cool overhead key with cyan glow leaking from the cracks, darker umber in the recesses. Composition is a single flying boulder, three-quarter view, filling the square without touching edges. Palette: grey-brown, icy blue, cyan-white. Isolated flying boulder, no ground, no characters, no text.
> END OF PROMPT;

**Cataclysm shard** — `images/fx/challenger-shard.png`

**Prompt:**
> Transparent background, isolated 2D still of a single sharp irregular rock shard. Grey lunar stone with glowing cyan-white fracture edges and a faint dust trail off the trailing point. Materials: dense grey rock, glassy fracture planes, powder-fine dust. Lighting is a hard cyan rim on the broken edges, cooler grey fill on the faces. Composition is one shard centered, diagonal, with the dust trail suggesting motion but remaining a still plate. Palette: lunar grey, cyan-white, pale dust. Isolated, no characters, no text, no extra debris field.
> END OF PROMPT;

**Starfall chunk** — `images/fx/challenger-starfall.png`

**Prompt:**
> Transparent background, isolated 2D still of a burning celestial debris chunk falling from space. A jagged rocky meteor with molten orange-gold fire cracks splitting the stone and a trailing flame tail of orange-white fire and soot. Materials: pitted meteor rock, molten metal in the cracks, realistic fire — not a cartoon fireball, not a magic orb. Lighting is self-lit: orange-gold key from the cracks, cooler grey on the unburned rock, bright white-hot spots at the leading underside. Composition is a single falling chunk, tail receding upward, rock filling the center. Palette: charcoal rock, molten orange, gold, ember white. No characters, no text.
> END OF PROMPT;

**Gravity Step field** — `images/fx/challenger-gravity-field.png`

**Prompt:**
> Transparent background, isolated 2D VFX plate of a gravity-field distortion. Concentric warped rings of compressed space stack around a dark center, as if the air itself is being pulled inward and down. Downward-pulling cyan-white force lines streak toward the center; fine dust falls along those lines. Materials: warped air like bent glass, cyan force filaments, grey dust. Lighting is a cool cyan glow strongest on the inner rings, fading outward. Top-down or slight 3/4 view of a circular field, empty enough in the very center to sit under a character later. Palette: cyan-white, pale grey, void-dark gaps. No characters, no text, no planet.
> END OF PROMPT;

**Punch impact burst** — `images/fx/challenger-punch-impact.png`

**Prompt:**
> Transparent background, isolated 2D close-range fist-impact burst. A white-cyan starburst with a knuckle-shaped air cavity at the center, shattered moon dust exploding outward, and a short shockwave ring. Materials: compressed air, pulverized grey dust, sharp cyan-white energy shards. Lighting is a blinding white core fading to cyan, dust lit from the inside. Composition is a tight circular burst, centered, readable at small size. No character body, no arm, no text. Palette: white, cyan, lunar grey.
> END OF PROMPT;

**Planetbreaker shockwave** — `images/fx/challenger-shockwave.png`

**Prompt:**
> Transparent background, isolated 2D massive circular planetary shockwave ring. Shattered grey moon rock and cyan-white compressed air form concentric rings around a clearly empty center so the plate can scale as an expanding blast. Materials: broken regolith fragments along the ring, glass-like compressed air between rings, dust veil on the outer edge. Lighting is a cyan-white rim on the innermost ring, cooler grey on outer debris. Top-down or slight 3/4 circular composition, hollow middle. Palette: lunar grey, cyan-white, pale dust. No characters, no text, no planet body.
> END OF PROMPT;

**Celestial uppercut column** — `images/fx/challenger-uppercut-column.png` (9:16)

**Prompt:**
> Transparent background, isolated 2D VFX plate, 9:16 tall. A tall vertical column of compressed air and pale cyan force, as if a fist launched straight through the sky. Dust and moon-rock fragments rise with the column, denser at the base and thinning toward the top. Materials: pale cyan force like a glass pillar, grey dust, small rock chips. Lighting is brightest along the column core, with a white-hot streak up the center and cooler edges. Composition fills the vertical frame, base slightly wider, empty sides. No characters, no fist mesh, no text. Palette: cyan-white, lunar grey, faint ice-blue.
> END OF PROMPT;

**Cold rock debris** — `images/fx/challenger-rock-debris.png`

**Prompt:**
> Transparent background, isolated 2D still of a jagged grey lunar rock chunk, no fire. Icy-blue mineral veins run through the stone; pale dust clings to the broken faces. About the size of a solidify platform — a solid, readable boulder, not a pebble. Materials: cold lunar rock, ice-mineral veins, dry dust. Lighting is cool and even, a pale key from upper left, no molten glow. Composition is a single falling boulder centered, three-quarter view. Palette: grey, icy blue, pale dust. Isolated, no characters, no text, no flame.
> END OF PROMPT;

**Burning rock debris** — `images/fx/challenger-debris.png`

**Prompt:**
> Transparent background, isolated 2D still of the same kind of irregular planet rock as the cold debris, but on fire. Molten orange-gold cracks split the grey stone, a trailing flame hangs off the rear, and the underside glows. Materials: the same jagged crust, now with lava in the fractures and soot on the trailing edge. Lighting is self-lit from the cracks and underside, orange key, cooler grey on unburned faces. Composition is a single flying boulder, flame tail suggesting motion. Palette: grey rock, molten orange, gold, ember white. Isolated, no characters, no text. Not a cartoon fireball.
> END OF PROMPT;

**Rock debris ground explosion** — `images/fx/challenger-rock-explode.png`

**Prompt:**
> Transparent background, isolated 2D grey moon-rock impact burst at ground level. Shattered stone sprays outward, a dust dome rises, and a short shock ring sits on the floor line. No fire. The center is empty-ish so the burst can sit on the floor under a landing. Materials: broken grey stone, powder dust, compressed air ring. Lighting is a cool grey-white flash from the impact point, dust backlit. Composition is a wide low burst, horizon implied only by the shock ring. Palette: lunar grey, pale dust, cyan-white rim. No characters, no text.
> END OF PROMPT;

**Fire debris ground explosion** — `images/fx/challenger-fire-explode.png`

**Prompt:**
> Transparent background, isolated 2D still of a burning rock hitting the ground and detonating. An orange-white fireball blooms at ground level, flying embers scatter, cracked stone fragments fly, and a short shock ring sits on the floor. Materials: fire, cracked grey stone, glowing embers, soot. Lighting is a hot orange-white core with darker smoke at the edges. Composition is a single isolated explosion, slightly empty at the very center so it can sit on a floor contact. Palette: orange, white, ember red, charcoal. No characters, no text.
> END OF PROMPT;

**Gravity crater** — `images/fx/challenger-crater.png`

**Prompt:**
> Transparent background, isolated 2D circular moon-crater stamp from a giant footstep. Radial fractures run out from a depressed center; lifted dust hangs just above the rim; faint cyan energy glows in the cracks. Materials: compacted grey regolith, cracked crust, fine dust, cyan mineral light in the fractures. Lighting is a cool overhead with cyan leaking from the cracks, rim of the crater catching a pale highlight. Top-down circular composition, readable as a ground decal. Palette: lunar grey, cyan, pale dust. No characters, no boot, no text.
> END OF PROMPT;

**Flashstep impact** — `images/fx/challenger-flash-impact.png`

**Prompt:**
> Transparent background, isolated 2D white-cyan starburst punch impact with a shockwave ring and fist-shaped air compression at the core. Materials: blinding white-cyan energy, a knuckle-shaped cavity of compressed air, a thin circular shock ring, faint dust. Lighting is a white core fading to cyan. Composition is a tight centered burst, isolated, readable at small size. Palette: white, cyan, pale grey. Isolated, no character body, no text.
> END OF PROMPT;

**Worldbreaker chunk** — `images/fx/challenger-worldchunk.png` (16:9)

**Prompt:**
> Transparent background, isolated 2D still, 16:9 side view. A gigantic irregular slab of torn lunar crust: hanging dirt and dust along the broken edges, underside stone spikes, cratered top as if it was surface ground a moment ago. Materials: layered grey-brown crust, hanging soil, jagged rock teeth underneath. Lighting is a cool side key that reads the thickness of the slab, cyan-white glints on fresh breaks. Composition is a single huge slab filling the wide frame, isolated, no ground plane. Palette: lunar grey, umber dirt, pale cyan cracks. No characters, no text.
> END OF PROMPT;

**One Hit gust** — `images/fx/challenger-gust.png` (16:9)

**Prompt:**
> Transparent background, isolated 2D VFX plate, 16:9 wide. A giant horizontal gust of pure physical force traveling left to right: compressed air ripples stacked behind a sharp leading edge, pale white-cyan streaks, torn dust. This is air split by a fist, not a magic beam, not a laser, not an energy missile. Materials: warped air, cyan-white force streaks, grey dust. Lighting is brightest on the leading edge, translucent ripples behind. Composition is a wide traveling gust, low-to-mid frame. Palette: white, pale cyan, dust grey. No characters, no text.
> END OF PROMPT;

**Magic circle** — `images/fx/challenger-magic-circle.png`

**Prompt:**
> Transparent background, isolated 2D top-down martial-magic circle, simple but ornate. Concentric cyan-white rings and tick marks, as if forming under a warrior's feet — geometric, not floral, not a pentagram cluttered with runes. Materials: glowing line-work like inlaid light on dark air, faint inner fill that stays mostly empty. Lighting is self-lit cyan-white, even, no cast shadow. Composition is a perfect circle centered in the square, readable when scaled under feet. Palette: cyan-white, pale ice, empty transparency. No characters, no text, no boots.
> END OF PROMPT;

**Background planets (destroyable)** — `images/fx/challenger-planet-orange.png`, `images/fx/challenger-planet-ice.png`

**Prompt:**
> Transparent background, isolated 2D planet sprites for a space backdrop, 3/4 view. Two separate stills implied by the same brief: (1) an orange-rust rocky world with cratered continents, dusty ochre atmosphere limb, no rings; (2) an icy blue world with faint thin rings, white polar haze, cold ocean-glass seas. Materials: planetary crust, thin atmosphere glow, subtle cloud bands. Lighting is a single star key from upper left, sharp terminator, soft atmosphere rim. Each planet is a complete isolated sphere, no stars drawn behind, no characters, no text, no UI. Palette for orange: rust, ochre, burnt umber. Palette for ice: pale blue, white, silver rings.
> END OF PROMPT;

**Moon arena backdrop** — `images/backgrounds/challenger-moon-bg.png` (16:9)

**Prompt:**
> Cinematic 2D side-view lunar fighting plateau, 16:9, no characters, no UI, no text. A cracked grey-regolith arena floor stretches across the lower third, cratered and scored, with a sharp horizon. Above: a black starfield, Earth as a small blue-white marble, a banded gas giant, and a distant nebula in muted magenta-violet. Materials: dusty lunar rock, star-pricked void, planetary atmospheres. Lighting is hard and airless on the plateau — a cold white key, long shadows in craters — with the planets self-lit against the black. Composition leaves the mid-ground plateau readable as a fighting stage, sky deep and uncluttered. Palette: lunar grey, void black, Earth blue, gas-giant cream, nebula violet. Polished game concept art.
> END OF PROMPT;

## Player Sprite Sheet

#### 21) Player Character — Battle Mage
**File target:** `images/player/player-sheet.png`  
**Sheet size:** `768×512 px` (6 columns × 4 rows)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game player.
> 6 columns and 4 rows (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Young battle mage adventurer, about 32×48 pixel logical size. Slim athletic build with a narrow waist and visible knee bend in the robe, wearing a deep blue-indigo wizard robe with subtle arcane silver trim and tiny rune stitches along the hem, cuffs, and front placket, a pointed wizard hat in matching dark navy-blue with a silver band and a slightly bent tip, sturdy brown leather boots with visible soles, tan/light skin on face and hands, bright white-blue glowing eyes, a wooden staff with a softly glowing blue crystal orb at the top held in the right hand, short windswept brown hair peeking under the hat brim, a determined confident expression. Clean readable proportions suitable for a side-scrolling 2D platformer. Side-view facing right.
>
> Row 1 (6 frames) – Idle: Begin standing relaxed with weight on the back foot, staff held loosely at the right hip, left hand resting near the robe, hat brim level. Then the chest rises and falls with a clear breath, the robe hem drifts a few pixels as if in a light breeze, and the crystal orb brightens then dims. Knees soften and restiffen, the hips rock a fraction, the hat brim nods, and the shoulders settle. Later frames shift weight onto the front foot and back again so the stance is never frozen. Final frame returns to the starting relaxed stand with the crystal at its dimmest point, ready to loop. This must look like a living idle, not six copies of the same standing pose.
>
> Row 2 (6 frames) – Run: Begin with the left knee driving high and the right boot pushing off the ground, robe already streaming backward, staff angled forward, hat bouncing. Then a full contact-pass-flight cycle: the right knee pumps, the left boot strikes, hips rotate, the torso leans into the run, and the crystal trails the swinging staff. Later frames complete the opposite stride with the robe snapping, hair peeking from the hat, and both boots clearly leaving and hitting the ground. Final frame is mid-stride again so the row loops as a continuous run. This must look like an actual run cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (6 frames) – Cast/Attack: Begin planted with both boots flat, knees bent, staff still at the hip. Then the mage steps into the cast, hips twisting, the right arm thrusting the staff forward while the left hand opens toward the target. Later frames the crystal orb flares bright blue-white, the free hand holds a small arcane circle, and magical particles burst from the staff tip as the robe flares backward from the force. Final frame is the full extension: staff punched forward, circle brightest, body leaning into the cast before a loop would recover.
>
> Row 4 (6 frames) – Hurt/Death: Begin the first hit-frame with the torso snapping backward, hat tilting, staff dipping, eyes flaring. Then the mage staggers, boots dragging, robe twisting, free hand clutching toward the chest as the crystal glow stutters and dims. Later frames the knees buckle and the body folds toward the ground, hat slipping further, staff leaving the grip. Final frame is crumpled on the ground with the staff fallen beside the body and the crystal orb dark. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy adventurer style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

**Suggested settings:**
- Aspect ratio: `3:2`
- Resolution: `768×512` or `1536×1024` (2x)

---

### NPC COMBATANTS

#### 21) Captain Dorn — City Guard Captain
**File target:** `images/enemies/captain-dorn-sheet.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game NPC boss combatant.
> 4 rows and 6 columns (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Captain Dorn, battle-hardened male city guard captain, about 44×88 pixel logical size, heavy dark steel plate armor with gold trim accents on the breastplate, gorget, and greaves, large pauldrons on each shoulder, a short dark shoulder-cloth hanging from the left pauldron, long jagged scar across the left eye, massive two-handed greatsword with a broad notched blade, short cropped dark hair, stern intimidating expression, dark leather boots, gold belt buckle. Fantasy military commander design. Side-view facing right.
>
> Row 1 (6 frames) – Idle: Begin standing with the greatsword resting on the right shoulder, both boots planted, chin slightly down. Then the chest rises under the breastplate with a visible breath, the shoulder-cloth drifts, and weight eases from the back foot to the front. Knees soften inside the greaves, the blade tip nods a fraction, and gold trim catches a faint light pulse. Later frames shift the hips the other way so the stance rocks. Final frame returns to the starting shoulder-rest with the cloth settled. This must look like a living idle, not six identical armor statues.
>
> Row 2 (6 frames) – Walk/Run: Begin the aggressive forward march with the left boot stepping long, greatsword held low at the right side, torso leaning in. Then the right boot slams, hips rotate, pauldrons bounce, and the shoulder-cloth streams backward. Later frames complete the opposite stride with the blade swinging in time with the arms and both greaves clearly leaving and hitting the ground. Final frame is mid-stride again so the row loops as a charging march. This must look like an actual run cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (6 frames) – Attack: Begin coiled with the greatsword pulled back over the right shoulder, knees bent, hips wound. Then the torso unwinds into a wide horizontal slash, the blade sweeping through a powerful arc with a short golden energy trail along the edge. Later frames follow through into a second heavy downward slash, body twisting, boots replanting, sparks flying from the blade tip as the shoulder-cloth snaps. Final frame is the end of the follow-through, sword low and forward, weight over the front boot.
>
> Row 4 (6 frames) – Defeat: Begin the first stagger with the torso snapping back, greatsword dipping, scarred eye flaring. Then Dorn drops toward one knee, the blade planting into the ground for support, armor plates shifting as if dented, gold trim sparking. Later frames the supporting arm fails and the body folds. Final frame is collapsed on the ground with the greatsword fallen beside him. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

**Suggested settings:**
- Aspect ratio: `3:2`
- Resolution: `768×512` or `1536×1024` (2x)

---

## Item & Ingredient Art Prompts

Use these prompts to generate individual item icons (square, transparent background) for the inventory system.

### Staves

#### Oak Staff
**File target:** `images/items/oak-staff.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A simple rustic oak-wood staff isolated in the center, slightly gnarled shaft with readable wood grain, warm honey-brown and umber tones, a rounded worn knob at the top, faint darker knots along the length. Soft studio key from the upper left, cool rim so the grain pops. Staff sits on a gentle diagonal, filling the square without touching the edges. Palette: warm oak, muted gold highlights, deep umber shadows. Fantasy RPG inventory icon, no text, no hands, no characters.
> END OF PROMPT;

#### Crystal Staff
**File target:** `images/items/crystal-staff.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. An elegant staff with a large multifaceted glowing blue crystal head mounted on a polished silver shaft; faint arcane energy wisps cling to the crystal faces, not flying off as projectiles. Materials: cut sapphire-like crystal, brushed silver, tiny engraved bands. Lighting is a cool blue inner glow from the crystal plus a soft studio fill on the metal. Centered three-quarter view, crystal dominant in the upper half. Palette: luminous blue, silver, pale cyan wisps. Fantasy RPG item icon, no text, no characters.
> END OF PROMPT;

#### Storm Staff
**File target:** `images/items/storm-staff.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A dark ironwood staff with twin metal prongs at the top and crackling yellow-white lightning arcing between those prongs only — a stormy electric aura hugging the head, not a sky bolt. Materials: nearly-black ironwood, tarnished steel prongs, electric arcs. Lighting is a hard yellow-white key from the lightning, cooler fill on the shaft. Centered diagonal composition. Palette: ironwood black-brown, yellow-white lightning, storm-grey metal. Fantasy RPG item icon, no text, no characters.
> END OF PROMPT;

#### Blood Staff
**File target:** `images/items/blood-staff.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A sinister crimson staff of twisted dark bone, a pulsing blood-red gem at the top dripping with faint red energy that stays on the gem. Materials: yellowed-to-black bone, wet-looking crimson gem, dark marrow grooves. Lighting is a low red inner pulse from the gem, deep shadows in the twists. Centered, gem in the upper third. Palette: crimson, dried-blood maroon, bone umber, black. Dark fantasy RPG item icon, no text, no characters.
> END OF PROMPT;

#### Void Staff
**File target:** `images/items/void-staff.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A sleek black obsidian staff with a swirling dark purple-black void orb at the top; faint purple energy tendrils hug the orb, and tiny stars are visible inside the glass-like sphere. Materials: polished obsidian, liquid-void glass, starfield interior. Lighting is a dim purple rim, the orb self-lit, shaft almost silhouette. Centered, orb dominant. Palette: black, deep purple, star-white specks. Dark fantasy RPG item icon, no text, no characters.
> END OF PROMPT;

#### Elder Staff
**File target:** `images/items/elder-staff.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. An ancient living-wood staff covered in glowing golden runes, a radiant warm-white crystal bloom at the top, tiny leaves and vines growing along the shaft and staying attached. Materials: living bark, gold-inlaid runes, crystalline flower-head, small green leaves. Lighting is a warm legendary glow from the bloom and runes, soft daylight fill. Centered diagonal. Palette: living brown, gold, warm white, leaf green. Legendary fantasy RPG item icon, no text, no characters.
> END OF PROMPT;

#### Stardust Staff
**File target:** `images/items/stardust-staff.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A magnificent celestial staff of crystallized starlight, shimmering with rainbow iridescence, a brilliant white-gold star at the top radiating cosmic sparkles that stay close to the head. Materials: translucent star-crystal shaft, iridescent facets, a solid star-shaped finial. Lighting is a white-gold core with prismatic rim highlights. Centered, star dominant. Palette: white-gold, rainbow iridescence, pale cosmic blue. Legendary fantasy RPG item icon, no text, no characters.
> END OF PROMPT;

#### Bone Staff
**File target:** `images/items/bone-staff.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A staff carved from a large yellowed animal bone, a small skull at the top with faintly glowing green eye sockets, leather strips wrapping the grip. Materials: aged ivory-yellow bone, cracked skull, worn leather. Lighting is a sickly green glow from the sockets, warm dusty fill on the bone. Centered, skull in the upper third. Palette: bone yellow, leather brown, ghost-green. Dark fantasy RPG item icon, no text, no characters.
> END OF PROMPT;

#### Prism Staff
**File target:** `images/items/prism-staff.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A polished white-silver staff with a triangular prism crystal at the top splitting light into a short rainbow spectrum that stays attached to the prism faces. Materials: chrome-smooth silver shaft, optically clear triangular prism, clean geometric bands. Lighting is a bright studio key that actually splits on the prism. Centered, geometric, prism dominant. Palette: white-silver, spectral rainbow, pale grey. Fantasy RPG item icon, no text, no characters.
> END OF PROMPT;

### Robes

#### Linen Robe
**File target:** `images/items/linen-robe.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A simple off-white linen robe with a rope belt, basic apprentice wizard clothing, plain and unadorned — folded or hanging as a wearable icon, not on a body. Materials: coarse woven linen, frayed hem, hemp rope. Lighting is soft and even, a warm-neutral studio key that reads the weave. Centered hanging or neatly folded three-quarter view. Palette: off-white, flax beige, rope tan. Fantasy RPG item icon, no text, no mannequin, no face.
> END OF PROMPT;

#### Silk Robe
**File target:** `images/items/silk-robe.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A flowing violet silk robe with faint silver embroidery along the edges, elegant and lightweight, a subtle magical shimmer on the folds. Displayed as a hanging garment, not worn. Materials: glossy silk, silver thread, soft drape. Lighting is a cool side key that makes the silk catch, plus a faint violet sheen. Centered, folds readable at 128px. Palette: violet, silver, deep plum shadows. Fantasy RPG item icon, no text, no character.
> END OF PROMPT;

#### Arcane Vestment
**File target:** `images/items/arcane-robe.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A deep purple robe with glowing blue arcane runes sewn into the fabric and a golden clasp at the collar; a protective magical aura hugs the cloth. Hanging garment, not on a body. Materials: heavy enchanted cloth, embroidered luminous runes, gold clasp. Lighting is a blue rune glow plus a warm glint on the clasp. Centered. Palette: deep purple, rune blue, gold. Fantasy RPG item icon, no text, no character.
> END OF PROMPT;

#### Shadowweave Robe
**File target:** `images/items/shadow-robe.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A black robe that seems to absorb light, edges dissolving into shadow wisps that stay attached to the hem, faint dark-purple inner glow in the folds. Hanging garment. Materials: void-black cloth, dissolving edge wisps, purple lining. Lighting is mostly rim: a thin purple edge so the silhouette reads on transparency. Centered. Palette: black, dark purple, charcoal. Dark fantasy RPG item icon, no text, no character. Sinister and powerful.
> END OF PROMPT;

#### Ember Robe
**File target:** `images/items/ember-robe.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A dark red-orange robe with glowing ember-like particles along the hem and smoldering edges that never fully burn, warm firelight in the folds. Hanging garment. Materials: heat-darkened cloth, ember motes, glowing hem. Lighting is a warm fire key from the hem upward. Centered. Palette: dark red, orange, ember gold, soot black. Fantasy RPG item icon, no text, no character.
> END OF PROMPT;

#### Void Robe
**File target:** `images/items/void-robe.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A robe woven from pure darkness with tiny stars and nebula visible in the fabric, deep purple-black with sparse cosmic particle motes clinging to the cloth. Hanging garment. Materials: starfield textile, nebula sheen, cosmic dust. Lighting is a faint purple-blue fabric glow, stars as tiny highlights. Centered. Palette: purple-black, star white, nebula magenta. Epic fantasy RPG item icon, no text, no character.
> END OF PROMPT;

#### Celestial Robe
**File target:** `images/items/celestial-robe.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A magnificent white-gold robe threaded with literal starlight, constellation patterns glowing across the fabric, radiant golden trim. Hanging garment, divine and legendary. Materials: luminous white cloth, gold embroidery, constellation pinpoints. Lighting is a soft divine white-gold key. Centered. Palette: white, gold, pale star-blue. Fantasy RPG item icon, no text, no character.
> END OF PROMPT;

#### Hunter's Cloak
**File target:** `images/items/hunter-cloak.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A forest-green hooded cloak with brown leather shoulder pads and small utility pouches, lightweight agile ranger design. Displayed hanging or folded as an item, hood empty. Materials: wool-green cloak, oiled leather, brass buckle dots. Lighting is a natural outdoor-style key, mossy and matte. Centered. Palette: forest green, leather brown, dull brass. Fantasy RPG item icon, no text, no face in the hood.
> END OF PROMPT;

#### Tide Robe
**File target:** `images/items/tide-robe.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A flowing aqua-blue robe that ripples like living water, seafoam-white trim, tiny bubble particles clinging to the hem. Hanging garment. Materials: water-like silk, seafoam embroidery, glass-bubble motes. Lighting is a cool underwater caustic sheen. Centered. Palette: aqua, seafoam white, deep teal shadows. Ocean-themed fantasy RPG item icon, no text, no character.
> END OF PROMPT;

### Relics

#### Mana Gem
**File target:** `images/items/mana-gem.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A large faceted brilliant-blue gem glowing with inner mana, soft blue light radiating just around the stone, hovering slightly with no stand. Materials: cut crystal, inner luminous core, sharp facets. Lighting is an inner blue glow plus studio sparkle on the cuts. Centered, gem filling most of the square. Palette: brilliant blue, pale cyan, white facet hits. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Ring of Embers
**File target:** `images/items/fire-ring.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A dark metal ring with a small embedded ruby that glows orange-red; tiny flames lick around the band and stay attached. Materials: blackened iron, cabochon ruby, small fire tongues. Lighting is a warm ruby key, metal rim-lit. Three-quarter view of a single ring, large in frame. Palette: dark metal, ruby red, ember orange. Fantasy RPG item icon, no text, no hand.
> END OF PROMPT;

#### Frost Amulet
**File target:** `images/items/frost-amulet.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A silver chain necklace with a teardrop ice-crystal pendant; frost particles cling around the crystal, cold blue glow. Materials: polished silver links, translucent ice pendant, rime. Lighting is a cold blue inner glow, silver highlights. Centered pendant, chain looping above. Palette: silver, ice blue, white frost. Fantasy RPG item icon, no text, no neck.
> END OF PROMPT;

#### Chaos Orb
**File target:** `images/items/chaos-orb.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A swirling multicolored orb of chaotic magical energy, colors shifting between purple, red, green, and blue in the still (all visible at once in bands), unstable crackling aura hugging the sphere. Materials: liquid energy glass, crackling edge sparks. Lighting is multi-hue self-light. Centered sphere. Palette: purple, red, green, blue, white cracks. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Phoenix Feather
**File target:** `images/items/phoenix-feather.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A magnificent golden-red feather with a fiery gradient from orange base to brilliant gold tip, glowing ember particles along the barbs. Materials: layered vanes, ember motes, luminous quill. Lighting is a warm legendary radiance from the feather itself. Diagonal composition, feather filling the square. Palette: orange, gold, crimson, ember white. Fantasy RPG item icon, no text, no bird.
> END OF PROMPT;

#### Sun Medallion
**File target:** `images/items/sun-medallion.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A golden circular medallion with a stylized sun face in the center, short radiating golden light beams that stay attached to the rim. Materials: stamped gold, engraved sun face, warm divine metal. Lighting is a warm frontal glow. Centered coin-like disc. Palette: gold, amber, warm white. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Moon Pendant
**File target:** `images/items/moon-pendant.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A silver crescent-moon pendant on a thin chain, soft white-blue moonlight glow, tiny star sparkles close around it. Materials: polished silver, crescent silhouette, star motes. Lighting is a serene cool glow. Centered pendant. Palette: silver, white-blue, pale starlight. Mystical fantasy RPG item icon, no text.
> END OF PROMPT;

#### Dragon Heart
**File target:** `images/items/dragon-heart.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A massive crystallized dragon heart, dark red with an inner fire glow pulsing like a heartbeat (readable as brighter core), scale-textured surface, veins of glowing orange magma. Materials: crystalized flesh-stone, scale facets, magma veins. Lighting is a legendary inner pulse, darker at the edges. Centered, large in frame. Palette: dark red, orange magma, black scale. Fantasy RPG item icon, no text, no dragon body.
> END OF PROMPT;

#### World Seed
**File target:** `images/items/world-seed.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A small glowing green-gold seed with tiny roots and a sprout emerging, surrounded by close-orbiting particles of earth, water, fire, and air that stay near the seed. Materials: living seed shell, fine roots, elemental motes. Lighting is a cosmic creation glow from the seed. Centered, seed dominant. Palette: green-gold, brown earth, blue water, orange fire, white air. Legendary fantasy RPG item icon, no text.
> END OF PROMPT;

#### Thunder Tooth
**File target:** `images/items/thunder-tooth.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A large curved fang from a storm serpent, ivory-white with crackling yellow-blue lightning veins running through the enamel, electric sparks only at the tip. Materials: ivory dentine, lightning-glass veins. Lighting is an electric key from the veins. Diagonal fang, tip upper-right. Palette: ivory, yellow lightning, blue-white sparks. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Ghost Lantern
**File target:** `images/items/ghost-lantern.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A small ornate paper lantern with a ghostly green-blue flame inside; wispy spirit faces are visible only as suggestions in the light, never as a full character. Materials: painted paper, thin wood frame, spirit-flame. Lighting is an eerie green-blue inner glow through the paper. Centered lantern. Palette: pale paper, green-blue flame, dark frame. Fantasy RPG item icon, no text, no full figure.
> END OF PROMPT;

#### Bloodstone
**File target:** `images/items/bloodstone.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A dark crimson gemstone with a polished surface, deep red inner glow pulsing rhythmically (brighter core), dark veins running through it. Materials: polished bloodstone, internal veins. Lighting is an ominous red inner pulse, glossy highlight on the face. Centered cabochon. Palette: dark crimson, black veins, dull sheen. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Wind Charm
**File target:** `images/items/wind-charm.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A small jade-green charm shaped like a leaf with swirling wind currents visible as translucent ribbons around it, light and airy floating particles close to the charm. Materials: carved jade, translucent wind ribbons. Lighting is a bright airy key, jade translucency. Centered leaf. Palette: jade green, white wind, pale gold. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Eye of Eternity
**File target:** `images/items/eye-of-eternity.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A floating all-seeing eye made of crystallized time: iris shifts through all spectrum colors in the still (banded), golden sclera, cosmic knowledge radiating as a faint halo. Isolated organ-relic, not attached to a face. Materials: time-crystal, gold sclera, spectrum iris. Lighting is a legendary multi-hue glow. Centered eye. Palette: gold, spectrum iris, cosmic white. Fantasy RPG item icon, no text, no head.
> END OF PROMPT;

#### Crystal Crown
**File target:** `images/items/crystal-crown.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. An ornate crown of interlocking purple and clear crystals, magical refracted light in the facets, regal and powerful, fit for an archmage. Empty crown, no head. Materials: amethyst, clear quartz, gold-minimal setting. Lighting is refracted studio sparkle plus a purple inner glow. Centered front-three-quarter. Palette: purple, clear crystal, white refraction. Fantasy RPG item icon, no text, no wearer.
> END OF PROMPT;

### Crafting Ingredients

#### Arcane Dust
**File target:** `images/items/arcane-dust.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A small glass vial holding a pile of shimmering iridescent magical dust that glitters with blue, purple, and gold sparkles. Materials: clear glass, cork or crystal stopper, iridescent powder. Lighting is sparkly and cool, dust catching multiple hues. Centered vial. Palette: blue, purple, gold, glass highlight. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Ember Shard
**File target:** `images/items/ember-shard.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A jagged angular shard of solidified fire, glowing orange-red with inner heat, small flames flickering from cracks and staying on the shard. Materials: volcanic glass-fire, cracked ember faces. Lighting is a warm radiance from inside. Centered shard. Palette: orange-red, yellow heat, soot edges. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Ice Crystal
**File target:** `images/items/ice-crystal.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A perfectly formed hexagonal ice crystal, brilliant translucent blue, frost particles radiating just off the faces, never melting. Materials: optical ice, hexagonal geometry, rime motes. Lighting is a cold blue glow through the hex. Centered, geometric. Palette: brilliant blue, white frost, pale cyan. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Shadow Essence
**File target:** `images/items/shadow-essence.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A small dark-glass bottle containing swirling black-purple shadow energy that reads as moving even in a still; faint purple glow at the cork. Materials: smoked glass, liquid shadow, cork. Lighting is a dim purple at the neck, bottle mostly silhouette. Centered bottle. Palette: black, purple, glass sheen. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Dragon Scale
**File target:** `images/items/dragon-scale.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A large iridescent dragon scale, dark red-gold with a metallic sheen, nearly indestructible looking, reflecting light like polished armor. Single scale, not a hide. Materials: keratin-metal, iridescent overlay. Lighting is a hard armor highlight. Centered scale, slight curve. Palette: dark red, gold, metallic sheen. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Starlight Dew
**File target:** `images/items/starlight-dew.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A small crystal phial containing luminous silvery-white liquid that glows like captured starlight, tiny star particles floating inside the liquid. Materials: cut-crystal phial, glowing liquid, star motes. Lighting is a legendary inner silver glow. Centered phial. Palette: silver-white, pale blue, crystal sparkle. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Mana Herb
**File target:** `images/items/mana-herb.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A small bundle of glowing blue-green herbs tied with string, leaves shimmering with mana, soft cyan aura around the bundle. Materials: fresh leaves, twine, luminous veins. Lighting is a soft cyan aura plus natural leaf fill. Centered bundle. Palette: blue-green, cyan, twine tan. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Void Shard
**File target:** `images/items/void-shard.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A fragment of pure void: a small black crystalline shard that absorbs surrounding light, faint purple anti-energy humming only around the edges. Materials: light-eating crystal, purple edge haze. Lighting is a thin purple rim so the shard reads on transparency. Centered shard. Palette: black, faint purple, void. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Molten Core
**File target:** `images/items/molten-core.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A rough spherical core of molten rock, cracked surface revealing bright orange-yellow magma underneath, heat shimmer and smoke wisps clinging to the sphere. Materials: cooled crust, liquid magma, smoke. Lighting is a hot inner key through the cracks. Centered sphere. Palette: orange-yellow, scorched brown, smoke grey. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Inferno Fang
**File target:** `images/items/inferno-fang.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A massive curved dragon tooth, dark obsidian-black with glowing orange-red fire veins, the tip still smoldering with a small eternal flame that stays on the tip. Materials: black enamel, fire veins, ember tip. Lighting is a fire-vein glow. Diagonal fang. Palette: obsidian, orange-red, ember. Epic fantasy RPG item icon, no text.
> END OF PROMPT;

#### Lava Essence
**File target:** `images/items/lava-essence.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A small sealed stone jar containing swirling bright-orange lava energy, glowing cracks on the container, intense volcanic heat visible as a shimmer around the jar. Materials: carved stone vessel, lava interior, cracked glaze. Lighting is a volcanic inner glow. Centered jar. Palette: orange lava, stone grey, crack-gold. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Frost Core
**File target:** `images/items/frost-core.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A perfectly spherical core of eternal ice, brilliant pale blue with a bright white center, frost crystals growing outward from the surface, intensely cold aura. Materials: solid ice sphere, growing frost spikes. Lighting is a white core through pale blue. Centered sphere. Palette: pale blue, white, frost. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Glacial Shard
**File target:** `images/items/glacial-shard.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A jagged fragment of ancient glacial ice, deep blue with streaks of white, impossibly cold, frost mist trailing a short distance from one edge. Materials: deep glacial ice, white compression streaks, mist. Lighting is a cold inner blue. Centered shard. Palette: deep blue, white, mist. Epic fantasy RPG item icon, no text.
> END OF PROMPT;

#### Permafrost
**File target:** `images/items/permafrost.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A chunk of ancient permafrost ground, layers of ice and frozen earth visible in cross-section, tiny frozen crystals embedded throughout. Materials: stratified frozen soil, ice lenses, embedded crystals. Lighting is a cold even key that reads the layers. Centered chunk. Palette: dirty ice, frozen brown earth, crystal white. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Terra Core
**File target:** `images/items/terra-core.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A rough spherical stone core with glowing amber-green veins of living earth energy, tiny crystals and roots growing from the cracks, pulsing with geological power (brighter vein cores). Materials: rough stone, living veins, roots, crystals. Lighting is an amber-green inner pulse. Centered sphere. Palette: stone grey, amber-green, root brown. Fantasy RPG item icon, no text.
> END OF PROMPT;

#### Titan Shard
**File target:** `images/items/titan-shard.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A massive angular fragment of enchanted stone, covered in ancient glowing golden-brown runes, impossibly dense and heavy looking. Materials: granite-dense stone, carved glowing runes. Lighting is a rune glow plus a weighty matte fill. Centered heavy shard. Palette: stone grey, golden-brown runes. Epic fantasy RPG item icon, no text.
> END OF PROMPT;

#### Ancient Amber
**File target:** `images/items/ancient-amber.png` (128×128)

**Prompt:**
> Clean 2D game icon, transparent background, 128×128 pixels. A large polished piece of deep golden-orange amber, a tiny prehistoric insect visible inside, warm honey glow through the resin. Materials: polished amber, trapped insect inclusion, internal bubbles. Lighting is a warm honey translucency, studio rim. Centered gem-like chunk. Palette: golden-orange, honey yellow, dark inclusion. Fantasy RPG item icon, no text. Ancient and mysterious.
> END OF PROMPT;

## Open World — Chapter 1 AI Image Prompts

Use these prompts to generate sprite sheets and backgrounds for the Open World mode (Chapter 1: Emberfall Awakening). All sprite sheets use a transparent background.

### Region Backgrounds

#### Emberfall Valley Panorama
**File target:** `images/backgrounds/ow-valley-bg.png` (3840×1080)

**Prompt:**
> Clean 2D painted side-scroller background, wide parallax panorama, 3840×1080 composition, no characters, no creatures, no UI, no text.
> Foreground band: lush rolling meadows filling the lower third, tall grass tufts, glowing arcane wildflowers in pink, blue, and gold, small crystal formations growing from the soil and catching the light.
> Midground band: layered green hills receding in soft parallax steps, a few distant tree clumps, sparkling magical motes hanging in still air.
> Background band: bright clear blue sky with soft white cumulus clouds, warm late-morning sunlight from the upper left, high-key cheerful palette of sap green, sky blue, flower pink, and pale gold.
> Serene inviting tutorial countryside, polished 2D game art, readable silhouettes, even lighting, no fog hiding the horizon.
> END OF PROMPT;

#### Emberfall City
**File target:** `images/backgrounds/ow-city-bg.png` (3840×1080)

**Prompt:**
> Clean 2D painted side-scroller background, wide parallax panorama, 3840×1080 composition, no characters, no creatures, no UI, no text.
> Foreground band: cobblestone street edge, arcane market stall awnings, warm lantern glow on stone, low walls and steps.
> Midground band: medieval fantasy city at dusk, tightly packed stone buildings with warm lit windows, tall mage towers painted with glowing runes, a prominent clock tower placed in the center-right, floating golden lanterns drifting through the air between rooftops.
> Background band: purple-indigo twilight sky, last orange light on the highest towers, atmospheric haze between building layers.
> Palette of dusk purple, warm window amber, rune gold, and cool stone grey. Bustling city read without any people. Polished 2D game concept art.
> END OF PROMPT;

#### Whispering Woods
**File target:** `images/backgrounds/ow-woods-bg.png` (3840×1080)

**Prompt:**
> Clean 2D painted side-scroller background, wide parallax panorama, 3840×1080 composition, no characters, no creatures, no UI, no text.
> Foreground band: thick undergrowth, glowing mushrooms clustered on mossy ground, ferns, fallen logs, floating green spores close to camera.
> Midground band: dense magical forest of very tall ancient trunks with glowing teal and green bioluminescent bark veins, thick mystical fog rolling through the trunks, an abandoned stone ruin visible in the mid-distance between trees.
> Background band: darker receding tree wall, faint teal light shafts, no open sky — canopy-filtered gloom.
> Palette of dark green, teal glow, moss yellow-green, and cool fog grey. Eerie but beautiful atmosphere, polished 2D game art.
> END OF PROMPT;

#### Ashfang Foothills
**File target:** `images/backgrounds/ow-foothills-bg.png` (3840×1080)

**Prompt:**
> Clean 2D painted side-scroller background, wide parallax panorama, 3840×1080 composition, no characters, no creatures, no UI, no text.
> Foreground band: black and dark red volcanic rock, scorched dead trees, ground cracks emitting orange-red lava light, ash drifting near the camera.
> Midground band: broken volcanic foothills, more dead timber, haze and ash particles in layered bands.
> Background band: distant smoking volcanoes with orange lava glow at the peaks, ominous dark red-brown sky, thick atmospheric smoke.
> Palette of charcoal, rust red, lava orange, and ash brown. Desolate and dangerous, polished 2D game art, readable ground line for a walker.
> END OF PROMPT;

#### Temple of Cinders
**File target:** `images/backgrounds/ow-temple-bg.png` (3840×1080)

**Prompt:**
> Clean 2D painted side-scroller background, wide interior panorama, 3840×1080 composition, no characters, no creatures, no UI, no text.
> Foreground band: a stone walkway edge over pools of glowing orange lava, cracked tiles, fallen masonry, brazier glow on the nearest pillar bases.
> Midground band: interior of an ancient dragon-worship temple, massive stone pillars carved with dragon reliefs, crumbling dragon statues, magical-fire braziers spaced along the hall.
> Background band: deeper sanctuary gloom, more pillars fading into darkness, lava light as the primary illumination, no daylight.
> Palette of dark red, black stone, lava orange, and faint ember gold. Epic and foreboding, polished 2D game art, strong silhouette contrast.
> END OF PROMPT;

---

### NPC Sprite Sheets

#### Archmage Thalen
**File target:** `images/npcs/thalen-sheet.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game NPC.
> 6 columns and 4 rows (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Archmage Thalen, elderly human wizard, about 28×52 pixel logical size, long silver beard that reaches the chest, deep blue and gold robes with arcane rune patterns along the hem and sleeves, a tall pointed wizard hat with a glowing crystal tip, gnarled wooden staff with a blue orb held in the right hand, lined face, wise calm eyes, thin aged hands, gold sash at the waist. Side-view facing right.
>
> Row 1 (6 frames) – Idle: Begin standing with the staff planted lightly, beard still, hat crystal dim. Then the chest breathes, the robe hem drifts, and the staff orb plus hat crystal pulse brighter then softer. Knees soften, the beard shifts, and the free hand idly adjusts a sleeve. Later frames the weight rocks from back foot to front. Final frame returns to the starting staff-planted stand. This must look like a living idle, not six identical portraits.
>
> Row 2 (6 frames) – Walk: Begin with the left foot stepping, staff swinging forward, robe already trailing. Then the right foot passes, hips rotate, the tall hat nods, and the beard sways. Later frames complete the opposite stride with the gold hem fluttering and both boots clearly leaving and hitting the ground. Final frame is mid-stride so the row loops. This must look like an actual walk cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (6 frames) – Casting gesture: Begin with the staff still at his side. Then both hands rise, the staff lifts overhead, sleeves falling back from the wrists, knees bending to plant. Later frames the orb flares and the free hand traces a small arcane motion beside it. Final frame is the full raised-staff cast pose, body leaned slightly forward.
>
> Row 4 (6 frames) – Talking: Begin facing right with a closed mouth, free hand down. Then the mouth opens, the beard moves with speech, and the free hand lifts into a teaching gesture. Later frames the hand turns palm-up, the head nods, and the staff stays planted. Final frame is a held talking pose with the mouth still open and the hand raised, ready to loop as conversation.
>
> Style: clean digital pixel-art sprite sheet, fantasy RPG style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Mira — Spell Merchant
**File target:** `images/npcs/mira-sheet.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game NPC.
> 6 columns and 4 rows (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Mira, young woman spell merchant, about 26×44 pixel logical size, short red hair, green eyes, a confident welcoming expression, crimson scarf around the neck, brown leather vest over a white blouse, belt crowded with small pouches of spell components, fitted trousers, worn travel boots, light freckles, a rolled scroll tucked at the belt. Side-view facing right.
>
> Row 1 (6 frames) – Idle: Begin standing with a scroll held in both hands at chest height, head tilted down as if reading. Then the thumbs shift on the parchment, the scarf drifts, and she breathes so the vest rises. Knees soften, the scroll tilts, and a pouch on the belt bumps. Later frames she glances up from the scroll and back down. Final frame returns to the starting examine pose. This must look like a living idle, not six frozen shopkeeper stills.
>
> Row 2 (6 frames) – Walk: Begin with the left knee forward, scarf already streaming, arms swinging, scroll now tucked. Then the right boot strikes, hips rotate, hair bounces, and pouches jiggle on the belt. Later frames complete the opposite stride with a clear contact-pass-flight on both boots. Final frame is mid-stride so the row loops. This must look like an actual walk cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (6 frames) – Offering item: Begin with both hands near the belt, as if drawing a small item. Then the right hand comes forward holding a tiny vial or charm, elbow extending, torso leaning in a welcome. Later frames the left hand gestures toward the offer and the scarf settles. Final frame is the full offer: arm extended, palm up, a small item on the palm, weight on the front foot.
>
> Row 4 (6 frames) – Talking: Begin with a closed-mouth smile, hands down. Then the mouth opens, the head tips, and one hand lifts in a friendly wave-talk. Later frames the smile widens, the scarf shifts, and the gesturing hand turns. Final frame is a held talking smile with the hand still raised, ready to loop.
>
> Style: clean digital pixel-art sprite sheet, fantasy RPG style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Captain Dorn — City Guard
**File target:** `images/npcs/dorn-sheet.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game NPC.
> 6 columns and 4 rows (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Captain Dorn as city-guard NPC, burly male, about 32×50 pixel logical size, polished steel plate armor, a dark grey tabard bearing a gold sun emblem on the chest, close-cropped brown hair, square jaw, clean-shaven, holding a tall halberd (axe-head and spike) in the right hand, dark boots, leather sword-belt, stern professional expression. This is the town-guard kit with a halberd, not the greatsword combatant. Side-view facing right.
>
> Row 1 (6 frames) – Idle: Begin standing at attention, halberd vertical at the right side, both boots aligned, chin level. Then the chest breathes under the tabard, the tabard hem drifts, and the halberd shaft nods a fraction. Knees soften inside the greaves, weight rocks to the back heel and forward again. Later frames the head turns a few degrees as if scanning, then returns. Final frame is the starting attention pose. This must look like a living idle, not six identical parade stills.
>
> Row 2 (6 frames) – Walk: Begin with the left boot stepping, halberd swinging in time, tabard already moving. Then the right boot strikes, hips rotate, pauldrons bounce, and the sun emblem folds with the cloth. Later frames complete the opposite stride with both boots leaving and hitting the ground. Final frame is mid-stride so the row loops. This must look like an actual walk cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (6 frames) – Pointing/commanding: Begin at attention with the halberd still vertical. Then the free left hand rises and points forward-right, torso twisting, the tabard pulling tight. Later frames the halberd plants as a brace and the pointing arm locks straight. Final frame is the full command pose: pointing, jaw set, weight over the front boot.
>
> Row 4 (6 frames) – Talking: Begin with a closed stern mouth, halberd at rest. Then the mouth opens, the head juts a fraction, and the free hand makes a short chopping gesture. Later frames the brow stays hard, the tabard shifts, and the gesture repeats smaller. Final frame is a held stern talking pose, mouth open, hand mid-gesture, ready to loop.
>
> Style: clean digital pixel-art sprite sheet, fantasy RPG style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### Open World Enemy Sprite Sheets

#### Corrupted Wolf
**File target:** `images/enemies/corrupted-wolf-sheet.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 columns and 4 rows (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Corrupted Wolf, feral canine twisted by dark magic, about 40×28 pixel logical size, slightly larger than a normal wolf, matted dark purple-grey fur, glowing magenta veins and cracks running along the neck, ribs, and haunches, glowing purple eyes, bared fangs, lean muscular build, four clawed paws, a ragged tail. Menacing and feral. Side-view facing right.
>
> Row 1 (6 frames) – Idle: Begin standing alert with the head low, lips already starting to peel from the fangs, tail hanging. Then the ears twitch, the chest pants, and the magenta veins pulse brighter then dim. Paws shift weight, the tail swishes, and the jaw opens into a snarl then eases. Later frames the shoulders roll as if the corruption itches. Final frame returns to the starting alert stand. This must look like a living idle, not six frozen snarls.
>
> Row 2 (6 frames) – Run: Begin with the front left paw reaching and the rear legs coiled, spine already stretching. Then a full gallop: spine compresses, rear paws pass the fronts, body bunches, then the spine extends and all four paws cycle. Later frames the tail streams, the veins streak along the stretching ribs, and both pairs of legs clearly leave and hit the ground. Final frame is mid-gallop so the row loops. This must look like an actual run cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (6 frames) – Attack: Begin crouched with the haunches loaded, jaws half open. Then the wolf springs, front paws leaving the ground, spine extending, fangs driving forward. Later frames the bite clamps at full stretch, then the body starts to drop back toward a landing. Final frame is the extended lunging bite, forelegs out, jaws open on the target line.
>
> Row 4 (6 frames) – Death: Begin the first hit with the torso snapping sideways, veins flaring. Then the legs splay, the head whips, and the body loses its run posture. Later frames the legs buckle and the wolf folds toward the ground. Final frame is collapsed on its side, veins dark, jaws slack. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, fantasy RPG style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Arcane Wisp
**File target:** `images/enemies/arcane-wisp-sheet.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 columns and 4 rows (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Arcane Wisp, a floating ball of unstable arcane energy with no solid body, about 20×20 pixel logical size, teal and green glowing core, swirling magical trails bound to the core, small sparks orbiting close to the body, ethereal and dangerous, pulsing light. Side-view facing right.
>
> Row 1 (6 frames) – Idle: Begin hovering with the core at rest brightness, sparks in a tight orbit. Then the core swells and brightens, the bound trails rotate, and the whole mass bobs up a few pixels. Later frames the core shrinks and dims while the mass sinks, sparks changing spacing. Final frame matches the starting hover so the pulse loops. This must look like a living idle, not six identical orbs.
>
> Row 2 (6 frames) – Float/drift: Begin with the core leaning right, trails streaming slightly back. Then the mass drifts forward in a bobbing path, trails rotating the other way, sparks stretching along the motion. Later frames it dips then rises again as it continues right. Final frame is still moving forward so the row loops as a drift, not a parked hover. This must look like an actual travel cycle, not a still orb slid sideways.
>
> Row 3 (6 frames) – Attack: Begin with the core compressing smaller and darker. Then it brightens hard, trails pulling inward, sparks clustering at the front. Later frames a short energy bolt launches from the core toward the right while the body recoils. Final frame is the spent core, slightly flattened, after the bolt has left.
>
> Row 4 (6 frames) – Dissipate/death: Begin with the core flaring unstable. Then trails unwind, sparks fly off the orbit, and the sphere loses its round silhouette. Later frames the light guts out in patches. Final frame is a faint fading wisp-smear, almost empty. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, fantasy RPG style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Living Vine
**File target:** `images/enemies/living-vine-sheet.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 columns and 4 rows (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Living Vine, magically animated plant creature rooted to the ground, about 28×48 pixel logical size, thick dark green vine trunk, thorny whip-like tendrils for arms, a single glowing amber eye-like bud at the top, knotted root base that never leaves the soil, menacing plant monster. Stationary rooted enemy. Side-view facing right.
>
> Row 1 (6 frames) – Idle: Begin upright with tendrils hanging, bud-eye dim. Then the trunk sways a few pixels, thorns lift and settle, and the amber bud pulses. Later frames the tendrils coil then uncoil while the root base stays planted. Final frame returns to the starting sway pose. This must look like a living idle, not six identical plants.
>
> Row 2 (6 frames) – Idle (stationary): Same rooted creature, no walk. Begin on the opposite sway from Row 1 so the loop feels like continued breathing. Then the trunk leans the other way, tendrils drag, and the bud blinks brighter. Later frames settle back through a slower coil. Final frame matches a loopable sway. Do not make this a travel cycle — the base never steps. This must still move; not six copies of one still.
>
> Row 3 (6 frames) – Attack: Begin with both tendrils coiled tight against the trunk. Then one tendril uncoils and whips forward in a rising arc, thorns catching the light, the bud-eye flaring. Later frames the whip reaches full extension to the right, then starts to recoil. Final frame is the fully extended tendril-lash, trunk leaned into the strike.
>
> Row 4 (6 frames) – Withering/death: Begin with the bud flaring then cracking. Then tendrils go limp, thorns droop, and the trunk loses tension. Later frames the whole plant folds toward the root base. Final frame is a withered heap of vines, bud dark. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, fantasy RPG style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Fire Imp
**File target:** `images/enemies/fire-imp-sheet.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 columns and 4 rows (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Fire Imp, small humanoid fire demon, about 24×32 pixel logical size, bright red-orange skin, short curved horns, glowing yellow eyes, sharp teeth in a wicked grin, small bat-like wings (decorative, not a flight kit), wiry arms, hands wreathed in flame bound to the fingers, thin tail, digitigrade legs. Side-view facing right.
>
> Row 1 (6 frames) – Idle: Begin crouched with wings half-folded, hands flickering. Then the chest bounces with a snicker-breath, the tail flicks, and the hand-flames brighten then dim. Knees bob, horns nod, wings twitch. Later frames the weight rocks from one foot to the other. Final frame returns to the starting crouch. This must look like a living idle, not six identical grins.
>
> Row 2 (6 frames) – Run: Begin with the front foot reaching, body hunched, wings swept back, tail acting as a counterweight. Then a full scurrying cycle: opposite knee pumps, hips twist, both feet leave and hit the ground, wings flap once for balance not flight. Later frames the grin holds as the stride completes. Final frame is mid-run so the row loops. This must look like an actual run cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (6 frames) – Attack: Begin with both hands pulled back at the hip, a small fireball gathering in the right palm. Then the torso twists and the right arm snaps forward, the fireball leaving the hand toward the right. Later frames the follow-through, wings flaring, left hand still burning. Final frame is the thrown-arm extension after the fireball has left.
>
> Row 4 (6 frames) – Death: Begin with the torso snapping back, flames flaring white. Then the wings crumple, the grin breaks, and the body loses its crouch. Later frames the silhouette breaks into ember chunks. Final frame is a small pile of fading embers, no standing body. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, fantasy RPG style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Lava Beetle
**File target:** `images/enemies/lava-beetle-sheet.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 columns and 4 rows (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Lava Beetle, large armored beetle, about 38×26 pixel logical size, volcanic-rock shell, glowing orange-red lava visible through cracks in the carapace, six thick legs, small fiery mandibles, lumbering tank-like silhouette. Side-view facing right.
>
> Row 1 (6 frames) – Idle: Begin low with all six legs planted, mandibles closed, cracks dim. Then the shell lifts a fraction with a breath-like pulse, lava light brightens in the cracks, and the mandibles twitch. Later frames the weight shifts to the rear legs then forward again. Final frame returns to the starting plant. This must look like a living idle, not six identical shells.
>
> Row 2 (6 frames) – Walk: Begin with the front-right and mid-left legs lifting, shell already rocking forward. Then a slow heavy hexapod cycle: opposite tripods plant, the shell seesaws, lava light sloshes in the cracks. Later frames the next tripod steps so it clearly travels right. Final frame is mid-step so the row loops. This must look like an actual walk cycle, not a standing beetle slid sideways.
>
> Row 3 (6 frames) – Attack: Begin with the head pulled in, mandibles open. Then the whole front end lunges, mandibles snapping together, front legs planting hard. Later frames the bite holds then the neck recoils. Final frame is the clamped mandible snap at full reach.
>
> Row 4 (6 frames) – Death: Begin with the shell cracking wider, lava flaring. Then legs splay, mandibles hang, and plates separate. Later frames the body slumps as the shell splits. Final frame is a broken carapace heap, glow dying. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, fantasy RPG style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### Boss Sprite Sheets

#### Fire Warden (Mid-Boss)
**File target:** `images/enemies/fire-warden-sheet.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss.
> 4 columns and 4 rows (16 frames total) arranged in a perfectly aligned grid with even spacing. 256×256 frame size.
> Transparent background.
>
> Character: Fire Warden, massive stone guardian infused with fire, about 72×88 pixel logical size, humanoid body of cracked dark stone with molten lava glowing through the fissures, one giant rocky fist, the other arm ending in a short flame blade fused to the wrist, a carved stone face with burning eye sockets, thick pillar legs, standing tall and imposing. Epic boss design. Side-view facing right.
>
> Row 1 (4 frames) – Idle: Begin standing square, fist hanging, flame blade at a low rest, eyes dim. Then the chest fissures brighten, the flame blade lengthens a little as it flickers, and the stone shoulders settle with a breath-like heave. Later frames the weight rocks from the back pillar-leg to the front. Final frame returns toward the starting stand with the blade flickering. This must look like a living idle, not four identical statues.
>
> Row 2 (4 frames) – Walk: Begin lifting the front pillar-leg, torso tilting, fist swinging back. Then that foot slams, hips rotate, lava light sloshes in the cracks, and the rear leg starts to pass. Later frames the opposite stomp completes the stride, flame blade trailing the arm swing. Final frame is mid-stomp so the row loops. This must look like an actual walk cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (4 frames) – Attack: Begin coiled with the giant fist raised overhead, knees bent, eyes flaring. Then the whole body drops as the fist slams the ground, torso compressing, flame blade braced out for balance. Later frames a low fire shockwave reads at the fist impact while the stone body is still in the slam pose. Final frame is the full ground-slam, fist buried at ground line, cracks brightest.
>
> Row 4 (4 frames) – Special: Begin with the flame-blade arm pulled across the body, fist clenched for counterweight. Then the blade arm sweeps in a wide horizontal arc, the flame stretching along the cut, hips rotating, back foot pivoting. Later frames the sweep passes the front and the torso follows through. Final frame is the end of the blade sweep, arm fully extended to the right, flame longest.
>
> Style: clean digital pixel-art sprite sheet, epic boss design, fantasy RPG style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Ignaroth — Young Inferno Dragon (Final Boss Ch.1)
**File target:** `images/enemies/ignaroth-sheet.png`

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss.
> 4 columns and 4 rows (16 frames total) arranged in a perfectly aligned grid with even spacing. 256×256 frame size.
> Transparent background.
>
> Character: Ignaroth, a young but fearsome inferno dragon, about 96×80 pixel logical size, dark red and black scales, massive wings partially folded against the body, long neck with a spiked crest, glowing orange eyes, flames licking from the jaws, powerful clawed feet, a long barbed tail, body language of a dragon perched on volcanic ground rather than a tiny lizard. Epic boss design. Side-view facing right.
>
> Row 1 (4 frames) – Idle: Begin crouched on both clawed feet, wings tucked, a thin smoke line at the nostrils, tail curled. Then the chest heaves, smoke thickens, the tail swishes, and the inner-mouth flames brighten. Later frames the wings hitch a little and the neck rises then settles. Final frame returns toward the starting perch. This must look like a living idle, not four identical dragon stills.
>
> Row 2 (4 frames) – Charge: Begin coiled with the hind legs loaded, wings opening, neck low. Then the dragon lunges forward, front claws reaching, wings beating once for drive, tail streaming. Later frames the body stretches into a full forward charge, jaws opening. Final frame is the extended lunge, weight over the front claws.
>
> Row 3 (4 frames) – Fire breath: Begin with the neck pulled back, jaws closed, chest glowing. Then the head drives forward, jaws wide, a wide cone of flame leaving the mouth toward the right. Later frames the neck sweeps the cone slightly while the wings brace. Final frame is the full breath pose, cone at its widest, feet planted.
>
> Row 4 (4 frames) – Meteor rain: Begin looking forward, then the neck cranes skyward, wings opening wide, chest fire climbing the throat. Then the dragon roars straight up, flames erupting around the shoulders and wing-pits as if calling fire from the sky. Later frames the roar holds, wings fully spread, tail planted. Final frame is the skyward roar, mouth a white-hot furnace, no separate meteor sprites required beyond flames around the body.
>
> Style: clean digital pixel-art sprite sheet, epic boss design, fantasy RPG style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### Story Item Art

#### Moon Pendant Fragment
**File target:** `images/items/moon-pendant-fragment.png` (128×128)

**Prompt:**
> Clean 2D game item icon, transparent background, 128×128 pixels, centered, no characters, no UI, no text.
> A crescent-shaped silver pendant fragment, broken from a larger necklace, a crack down the middle, small arcane runes etched along the curved edge, soft blue-white moonlight glow wrapping the metal, faint magical sparkles bound close to the silhouette.
> Three-quarter view, slight top-left key light, cool moonlight palette of silver, pale blue, and white, dark metal in the recesses.
> Mysterious and ancient fantasy RPG item icon, readable at small size, no chain hanging out of frame, no extra relics.
> END OF PROMPT;

#### Sun Medallion Fragment
**File target:** `images/items/sun-medallion-fragment.png` (128×128)

**Prompt:**
> Clean 2D game item icon, transparent background, 128×128 pixels, centered, no characters, no UI, no text.
> A triangular golden medallion fragment broken from a larger circular sun disc, engraved with a partial sun symbol and a scrap of ancient script, glowing edges, warm golden-orange sunlight radiating from the metal.
> Three-quarter view, warm key light from the upper right, palette of gold, amber, and deep bronze in the cuts.
> Powerful and ancient fantasy RPG item icon, readable at small size, no full medallion, no extra coins.
> END OF PROMPT;

#### Broken Black Hourglass
**File target:** `images/items/broken-hourglass.png` (128×128)

**Prompt:**
> Clean 2D game item icon, transparent background, 128×128 pixels, centered, no characters, no UI, no text.
> A small ornate hourglass of dark obsidian-black glass with silver filigree, cracked down the middle of both bulbs, the sand inside visibly flowing UPWARD defying gravity, faint purple-blue temporal magic glow leaking from the cracks.
> Straight-on icon view, rim light on the filigree, palette of black glass, silver, violet, and pale temporal blue.
> Eerie key story item, fantasy RPG item icon style, readable at small size, no table, no hands.
> END OF PROMPT;

---

### Sylvaris Wildes Enemies

Regulars use the same **8×6** action-only sheet as Fire/Ice/Earth/Iron. Draw only the character. Do not bake clouds, trails, beams, rocks, or copies into the frames.

#### Thorn Wolf
**File target:** `images/enemies/thorn-wolf-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one wolf. Do not draw extra wolves, thorn sprays, trails, or echo silhouettes.
>
> Character: Thorn Wolf, feral wolf covered in bark-like armor and thorny vines, about 36×28 pixel logical size, dark green-brown fur, glowing amber eyes, lean muscular build, thorn spikes along its spine, four lean legs ending in clawed paws, a bushy tail of frayed vines. Fast predatory dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin standing alert with the head high, ears forward, thorns along the spine slightly raised, vine-tail hanging. Then the ears twitch independently, the amber eyes blink, and the chest pants so the bark plates shift. Paws knead the ground, the tail swishes left then right, and the thorns settle then lift again. Later frames the weight rocks from the front paws to the haunches and back. Final frame returns to the starting alert stand so the row loops. This must look like a living idle, not eight copies of one still.
>
> Row 2 (8 frames) – Run: Begin with the front left paw reaching and the spine already stretching, thorns streaming back. Then a full bounding gallop: spine compresses, rear paws pass the fronts, body bunches, then the spine extends and all four legs cycle. Middle frames show a clear flight pose with no paws planted. Later frames land and immediately coil for the next bound, vine-tail whipping. Final frame is mid-gallop so the row loops. This must look like an actual run cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (8 frames) – Circle / Crouch: Begin turning in a tight circle, front paws crossing, spine curving, head tracking the turn. Then the body completes the circling steps, hips rotating, thorns leaning with the curve. Later frames drop into an extremely low crouch, elbows almost on the ground, haunches loaded, tail still, ready to leap. Final frame is the lowest crouch, weight on the rear paws. Body-only. This must show real turning steps, not a standing wolf rotated in place.
>
> Row 4 (8 frames) – Lunge / Feint: Begin exploding out of a crouch, front paws leaving the ground, jaws opening, spine straightening. Then a full forward lunge at stretch. Later frames cancel mid-air: the body twists, paws tuck, and it slides sideways on the landing instead of biting through. Final frame is the end of the sideways slide, legs splayed, thorns still forward. No extra objects.
>
> Row 5 (8 frames) – Recoil: Begin the first hit with the torso snapping backward, amber eyes flaring, thorns standing straight. Then the front paws leave the ground as the body knocks back, bark plates shifting. Later frames the thorns flatten against the spine and the head shakes. Final frame is a recovered but hurt stance, thorns still flat, ready to loop into idle.
>
> Row 6 (8 frames) – Defeat: Begin with the legs buckling, thorns drooping, eyes dimming. Then the forelegs fold, the chest hits, and the vine-tail goes limp. Later frames the body rolls onto its side. Final frame is a collapsed wolf, thorns dull, no standing pose. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Spore Fungus
**File target:** `images/enemies/spore-fungus-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the fungus. Do not draw spore clouds, falling pollen, extra mushrooms, or floor roots.
>
> Character: Spore Fungus, squat sentient mushroom, about 36×40 pixel logical size, thick stubby stem legs, bulbous brown-orange cap with pale cream spots, a cluster of small glowing yellow-green pores under the cap rim, two tiny amber eyes on the stem. Heavy plant dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin planted with the cap level, pores dim, stem legs slightly bent. Then the stem settles a few pixels, the cap pores pulse brighter then softer, and the spots seem to stretch as the cap breathes. Later frames the whole body leans a fraction and the eyes blink. Final frame returns to the starting plant. This must look like a living idle, not eight identical mushrooms.
>
> Row 2 (8 frames) – Waddle: Begin lifting the front stem-leg, cap already tilting that way. Then a short heavy step lands, the cap bobs hard, and the opposite stem-leg swings. Middle frames show the cap rocking opposite the planted foot. Later frames complete the next step so it clearly travels right. Final frame is mid-waddle so the row loops. This must look like an actual walk cycle, not a standing fungus slid sideways.
>
> Row 3 (8 frames) – Swell / Compress: Begin with the cap inflating, pores opening, stem stretching taller. Then the cap reaches maximum swell. Later frames the whole body squeezes inward, cap flattening, stem shortening, pores pinching shut. Final frame is the most compressed squat. Body-only.
>
> Row 4 (8 frames) – Reach / Plant: Begin stretching the stem upward, cap lifting as if about to release something, eyes looking up. Then the stretch peaks. Later frames the body dips and the stem-legs flatten as if planting itself into the ground, cap lowering. Final frame is the planted squat, stem wide. No extra objects.
>
> Row 5 (8 frames) – Recoil: Begin with the cap knocking backward, spots flashing bright cream. Then the stem-legs stumble, pores flare yellow-green. Later frames the spots dim and the cap settles off-center. Final frame is a hurt lean, glow low.
>
> Row 6 (8 frames) – Defeat: Begin with the cap wilting at the edges, eyes dimming. Then the stem buckles, spots wrinkle, and the cap folds. Later frames the body collapses. Final frame is a flat mushroom pile, pores dark. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Moss Wraith
**File target:** `images/enemies/moss-wraith-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the wraith. Do not draw extra hands, copies, tethers, or moss trails.
>
> Character: Moss Wraith, floating forest spirit, about 32×46 pixel logical size, body of living green moss and thin vines, no legs — tapers to a wispy moss trail that is part of the body, long thin arms ending in clawed mossy fingers, hooded head of drooping moss with two glowing lime-green eyes. Phasing dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin hovering with the moss-trail hanging, arms at its sides, eyes dim. Then the whole body bobs up, tendrils on the hood sway, and the eyes brighten. Later frames it sinks, the trail curls, and the clawed fingers flex. Final frame matches the starting hover height so the bob loops. This must look like a living idle, not eight identical ghosts.
>
> Row 2 (8 frames) – Glide: Begin tilting the torso forward, moss cloak pulling back, trail streaming as part of the silhouette. Then the body slides right, arms trailing, hood tendrils swept. Middle frames dip then rise along the path. Later frames keep traveling, not parking. Final frame is still gliding forward so the row loops. This must look like an actual travel cycle, not a still hover moved over.
>
> Row 3 (8 frames) – Sink / Rise: Begin melting downward, the moss-trail spreading as if entering the ground, eyes still visible. Then the torso sinks until only the hood and eyes remain high. Later frames the body surges back up, arms rising with it, moss reforming the torso. Final frame is the fully risen hover, slightly taller than idle. Body-only.
>
> Row 4 (8 frames) – Reach / Split: Begin raising both clawed arms, chest moss pulling apart down the middle as if peeling. Then the arms reach their peak. Later frames the torso splits as if starting to peel a copy from itself — but draw only this one body stretching and parting, no second wraith. Final frame is the widest split of the single torso, arms high. No extra objects.
>
> Row 5 (8 frames) – Recoil: Begin with the moss snapping backward, eyes flaring lime. Then the arms flail, the trail bunches. Later frames the eyes dim and the moss settles. Final frame is a hurt hover, tendrils messy.
>
> Row 6 (8 frames) – Defeat: Begin with the moss drying, color going brown-grey, eyes fading. Then the arms drop and the body loses cohesion. Later frames it crumbles downward. Final frame is a small heap of dead moss, eyes out. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Willow Wisp
**File target:** `images/enemies/willow-wisp-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one wisp. Do not draw extra wisps, trails, or pulses leaving the cell.
>
> Character: Willow Wisp, tiny hovering light spirit, about 18×18 pixel logical size, pale green-white core, two small leaf-like wings, a faint inner spark like a seed of light. Delicate evasive dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin hovering with wings at mid-beat, core at rest brightness. Then the core pulses brighter, wings rise, and the body bobs up. Later frames the core dims, wings drop, and it sinks. Final frame matches the starting hover so the pulse loops. This must look like a living idle, not eight identical sparks.
>
> Row 2 (8 frames) – Dart: Begin with wings swept back, core leaning right. Then a quick forward hop, wings beating hard, body stretching. Middle frames a brief coast. Later frames the next hop so it clearly travels right. Final frame is mid-dart so the row loops. This must look like an actual travel cycle, not a still orb slid sideways.
>
> Row 3 (8 frames) – Flare / Shrink: Begin expanding, core going bright white-green, wings spreading. Then the body reaches maximum flare. Later frames it snaps small, wings tucking, spark tiny. Final frame is the smallest shrink. Body-only.
>
> Row 4 (8 frames) – Loop / Dive: Begin banking into a small looping turn, wings tilting, core tracing the loop as the body itself. Then the loop completes. Later frames a sharp downward dart, wings pinned, core stretched. Final frame is the lowest dive pose. No extra objects.
>
> Row 5 (8 frames) – Recoil: Begin with the core flickering, wings crumpling. Then the body knocks backward and up. Later frames the flicker steadies dim. Final frame is a hurt hover, wings drooped.
>
> Row 6 (8 frames) – Defeat: Begin with the light gutting out in patches, wings failing. Then the core collapses into a dim seed-shape that is the same creature dying, not a dropped item. Later frames that seed-body falls. Final frame is a tiny dim seed at the bottom of the cell. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Glow Beetle
**File target:** `images/enemies/glow-beetle-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the beetle. Do not draw beams, rings, sparks, or bounced objects.
>
> Character: Glow Beetle, armored cave beetle, about 38×24 pixel logical size, teal-blue carapace with brighter cyan glowing seams, six segmented legs, short mandibles, a heavy closed-shell silhouette when tucked. Defensive dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin low with the shell slightly open, seams dim, legs planted. Then the legs shift in a slow ripple, seams pulse cyan, and the mandibles twitch. Later frames the shell lifts a fraction and the weight rocks. Final frame returns to the starting plant. This must look like a living idle, not eight identical shells.
>
> Row 2 (8 frames) – Walk: Begin lifting a front and mid leg, shell already rocking. Then a low scuttle cycle: opposite legs plant, the shell seesaws, seams slosh with light. Later frames the next steps travel right. Final frame is mid-scuttle so the row loops. This must look like an actual walk cycle, not a standing beetle slid sideways.
>
> Row 3 (8 frames) – Close / Charge: Begin with the shell slamming shut, legs tucking under the tucked ball. Then the closed body leans into a forward rush, remaining legs pumping. Later frames the tucked rush stretches longer. Final frame is the closed-shell charge at full lean. Body-only.
>
> Row 4 (8 frames) – Open / Aim: Begin with the shell cracking open, cyan seams flaring. Then the elytra lift and the body rotates as if sweeping a facing, mandibles tracking the turn. Later frames the open stance holds while the body finishes the rotate. Final frame is fully open, aimed right. No extra objects.
>
> Row 5 (8 frames) – Recoil: Begin with the legs splaying, seams flashing white-cyan. Then the shell knocks backward. Later frames the flash dies and the legs scramble for purchase. Final frame is a hurt crouch, seams dim.
>
> Row 6 (8 frames) – Defeat: Begin with the shell cracking, glow stuttering. Then the legs curl, mandibles hang. Later frames the glow dies and the body slumps. Final frame is a cracked shell with curled legs, seams dark. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Stalactite Bat
**File target:** `images/enemies/stalactite-bat-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the bat. Do not draw rocks, shadows, or sonic rings.
>
> Character: Stalactite Bat, cave bat with stone growths, about 34×28 pixel logical size, grey-purple fur, leathery wings edged with hanging stone spikes that are part of the wing membrane, red eyes, small hooked feet, small fangs. Vertical ambush dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Hang: Begin hanging upside-down from the top of the cell by hooked feet, wings folded, stone tips hanging along the wings. Then the body sways like a pendulum, toes gripping, ears twitching, eyes blinking. Later frames the sway goes the other way and the wings hitch. Final frame returns to the starting hang so the sway loops. This must look like a living idle, not eight identical hanging stills.
>
> Row 2 (8 frames) – Fly: Begin right-side-up with wings up, stone tips on the trailing edge. Then a full wingbeat cycle: wings down, body surging forward, feet trailing, then wings up again. Middle frames show a clear flight pose. Later frames the next beat travels right, stone tips dragging the silhouette but never leaving as separate rocks. Final frame is mid-flap so the row loops. This must look like an actual fly cycle, not a standing bat with wings slightly tilted.
>
> Row 3 (8 frames) – Screech / Fold: Begin with the mouth opening wide, ears back, wings spreading. Then the screech pose peaks, tongue and fangs visible. Later frames the wings tuck and the body rolls back toward a hang, feet reaching up. Final frame is a folded hang-ready pose. Body-only.
>
> Row 4 (8 frames) – Dive / Pull-up: Begin tucking the wings for a steep downward dive, head first, stone tips swept back. Then the dive stretches. Later frames a sharp pull-up, wings beating hard, body curving back to level. Final frame is the pull-up at the top of the recovery. No extra objects.
>
> Row 5 (8 frames) – Recoil: Begin with the wings snapping back, red eyes flaring. Then the body knocks off its line, feet flailing. Later frames the eyes dim and the wings find air again. Final frame is a hurt glide, wings uneven.
>
> Row 6 (8 frames) – Defeat: Begin with the wings crumpling, stone tips drooping, eyes dimming. Then the hooked feet lose their grip or the flight fails and the body goes limp. Later frames it falls. Final frame is a limp bat at the bottom of the cell, wings folded wrong. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Deep Root Horror
**File target:** `images/enemies/deepRootHorror.png` (1024×1024, mini-boss)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 4 rows and 4 columns (16 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background. Draw only this one horror. Do not draw extra root copies, flying dirt, or projectile thorns.
>
> Character: Deep Root Horror, massive underground plant-horror, about 88×96 pixel logical size, towering torso of twisted dark roots and corrupted wood, a pulsing purple corruption core embedded in the chest, multiple thick tendril-like arms, glowing violet eyes set in a knotted wooden face, a skirt of smaller roots that act as legs, bark plates along the shoulders. Menacing dark fantasy mini-boss. Side-view facing right.
>
> Row 1 (4 frames) – Idle: Begin standing with tendril-arms hanging, core dim, root-skirt planted. Then the chest core pulses brighter, the tendrils slowly coil, and the wooden face creaks as the eyes blink. Later frames the root-skirt kneads the ground and the shoulders settle. Final frame returns toward the starting loom. This must look like a living idle, not four identical tree-stumps.
>
> Row 2 (4 frames) – Walk: Begin dragging the front root-cluster forward, torso tilting, tendril-arms swinging for balance. Then that cluster plants and pulls the body right, hips of wood rotating, rear roots tearing free. Later frames the opposite cluster steps so it clearly travels. Final frame is mid-drag so the row loops. This must look like an actual walk cycle, not a standing pose with one root moved slightly forward.
>
> Row 3 (4 frames) – Attack: Begin rearing both primary tendril-arms overhead, core flaring white-violet, root-skirt bracing. Then the arms slam and lash forward in a downward strike, torso dropping with the hit, eyes blazing. Later frames the tendrils are at full reach to the right. Final frame is the end of the lash, arms extended, core brightest. Body-only.
>
> Row 4 (4 frames) – Defeat: Begin with the core sputtering, tendrils losing tension, eyes flickering. Then the arms slacken and the torso cracks along the root-grain. Later frames the body folds downward as the skirt collapses. Final frame is a dead heap of roots, core dark. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Sky Vine
**File target:** `images/enemies/sky-vine-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one vine. Do not draw extra lashes, falling leaves, or a canopy.
>
> Character: Sky Vine, tall rooted plant monster, about 30×54 pixel logical size, thick bright-green trunk growing from a knotted base, two long leaf-blade arms, thorned coils along the body, a flower-like head with a single gold-green eye. Stationary arena-control dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin upright with leaf-arms hanging, coils loose, eye dim. Then the coils tighten and loosen, the leaf-arms sway, and the flower-head nods. Later frames the eye pulses and the trunk twists a few degrees. Final frame returns to the starting sway. The knotted base never steps. This must look like a living idle, not eight identical plants.
>
> Row 2 (8 frames) – Shift: Begin with the base planted and the upper body leaning right. Then the trunk re-centers, leaf-arms counter-swinging, coils sliding. Middle frames lean the other way. Later frames return toward center. Final frame is a re-centered lean so the row loops as a weight-shift, not a walk. The base stays planted.
>
> Row 3 (8 frames) – Lash / Sweep: Begin snapping one leaf-blade arm out to the right, thorns along that arm standing. Then that arm reaches full lash. Later frames both arms sweep together in a wide arc across the front of the body. Final frame is the end of the double-arm sweep. Body-only.
>
> Row 4 (8 frames) – Grow / Drop: Begin stretching the flower-head and upper trunk upward as if making a roof, arms rising. Then the stretch peaks. Later frames the whole upper body ducks as if something fell past it, coils compressing. Final frame is the ducked squat, head low. No extra objects.
>
> Row 5 (8 frames) – Recoil: Begin with the thorns flattening, eye flashing gold. Then the trunk knocks backward, leaf-arms flailing. Later frames the flash dies. Final frame is a hurt lean, coils slack.
>
> Row 6 (8 frames) – Defeat: Begin with the leaves wilting, eye dimming, color going dull. Then the trunk slackens and the flower-head droops. Later frames it collapses. Final frame is a heap of vines, eye dark. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Wind Sylph
**File target:** `images/enemies/wind-sylph-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only the sylph. Do not draw tornados, slashes, gust arrows, or shockwaves.
>
> Character: Wind Sylph, slim floating air spirit, about 28×38 pixel logical size, translucent blue-white humanoid torso, flowing wispy hair, no solid legs — lower body fades into a wind-tail that is part of the body, long arms with sharp hands. Fast momentum dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin hovering with hair drifting back, wind-tail curling, arms loose. Then the hair and tail drift the other way, the torso bobs up, and the hands flex. Later frames it sinks and the hair floats as if in a breeze. Final frame matches the starting hover so the drift loops. This must look like a living idle, not eight identical still poses.
>
> Row 2 (8 frames) – Dash: Begin leaning hard right, hair swept back, wind-tail streaming as part of the silhouette. Then the body streaks forward, arms pinning, torso stretching. Middle frames a coast. Later frames the next pulse of speed so it clearly travels. Final frame is mid-dash so the row loops. This must look like an actual travel cycle, not a standing pose slid sideways.
>
> Row 3 (8 frames) – Spin / Swing: Begin a tight spin, hair wrapping the torso, wind-tail corkscrewing. Then the spin completes. Later frames one sharp arm cuts a crescent across the front — the arm is the crescent, no slash VFX. Final frame is the end of that arm-cut, body facing right again. Body-only.
>
> Row 4 (8 frames) – Push / Freeze: Begin shoving both palms forward, torso leaning, hair blasting back. Then the shove pose peaks. Later frames the whole body locks perfectly still in that shove for the remaining frames — hold the same silhouette so the freeze reads. Final frame is the locked shove. No extra objects.
>
> Row 5 (8 frames) – Recoil: Begin with the form smearing thinner, eyes (if visible) flaring. Then the smear snaps backward. Later frames the body reforms off-center. Final frame is a hurt hover, hair messy.
>
> Row 6 (8 frames) – Defeat: Begin thinning to mist at the edges, wind-tail unraveling. Then the arms dissolve and the torso loses its humanoid read. Later frames it unravels further. Final frame is a faint mist curl, almost empty. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Elder Treant
**File target:** `images/enemies/elderTreant.png` (1024×1024, mini-boss)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 4 rows and 4 columns (16 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background. Draw only this one treant. Do not draw extra falling leaves as a projectile sheet, thrown rocks, or root copies.
>
> Character: Elder Treant, colossal ancient tree creature, about 96×110 pixel logical size, a face carved into a thick trunk, massive branch-like arms with finger-twigs, a green canopy crown that is part of the head, roots for legs, layered bark armor on the chest and shoulders, glowing green eyes in the carved face, moss in the joints. Imposing and ancient dark fantasy mini-boss. Side-view facing right.
>
> Row 1 (4 frames) – Idle: Begin standing with both root-feet planted, branch-arms hanging, canopy still. Then the canopy sways, the carved mouth eases, and the green eyes pulse. Later frames the roots knead the ground and a few leaves on the crown shift as part of the head, not as dropped objects. Final frame returns toward the starting loom. This must look like a living idle, not four identical trees.
>
> Row 2 (4 frames) – Walk: Begin lifting the front root-leg, trunk tilting, canopy rocking, far arm swinging back. Then that root slams, bark plates shift, and the rear root starts to pass. Later frames the opposite step completes so it clearly travels right. Final frame is mid-stomp so the row loops. This must look like an actual walk cycle, not a standing pose with one root moved slightly forward.
>
> Row 3 (4 frames) – Attack: Begin raising one massive branch-arm overhead, canopy pulling back, eyes flaring, other arm bracing. Then the raised arm slams and sweeps downward-forward, trunk rotating, root-feet planting hard. Later frames the sweep is at full reach. Final frame is the end of the branch slam, arm low and forward. Body-only.
>
> Row 4 (4 frames) – Defeat: Begin with the canopy wilting, eyes dimming, carved face cracking. Then the branch-arms slacken and the trunk splits along a vertical seam. Later frames the body folds. Final frame is a fallen timber heap, eyes dark. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Storm Raptor
**File target:** `images/enemies/stormRaptor.png` (1024×1024, mini-boss)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 4 rows and 4 columns (16 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background. Draw only this one raptor. Do not draw lightning bolts leaving the cell, storm-cloud copies, or trail ribbons.
>
> Character: Storm Raptor, huge predatory bird, about 90×70 pixel logical size, dark blue-purple plumage with paler storm-grey wing linings, sharp golden beak and talons, a crest of spiked feathers, electric-blue crackle bound to the feather edges (on the body only), fierce golden eyes, long steering tail-fan. Powerful dark fantasy mini-boss. Side-view facing right.
>
> Row 1 (4 frames) – Idle: Begin perched with wings half-spread, talons planted, crest down. Then the chest breathes, the crest lifts, wing-tips twitch, and the bound crackle brightens along the primaries. Later frames the tail-fan fans and the weight shifts from one talon to the other. Final frame returns toward the starting perch. This must look like a living idle, not four identical bird stills.
>
> Row 2 (4 frames) – Fly: Begin with wings up, body lifting off the perch line, talons tucking. Then the wings beat down, the body surges right, tail steering. Later frames the next upstroke so it clearly travels. Final frame is mid-flap so the row loops. This must look like an actual fly cycle, not a standing bird with wings slightly tilted.
>
> Row 3 (4 frames) – Attack: Begin tucking for a dive, talons forward, beak opening, wings pinned. Then the body stretches into a stoop, legs extending for a rake. Later frames the talons and beak snap at full reach as the wings brake. Final frame is the striking pose, talons out, beak biting. Body-only.
>
> Row 4 (4 frames) – Defeat: Begin with the wings crumpling, crackle dying, eyes dimming. Then the talons curl and the body loses lift. Later frames it falls. Final frame is a crumpled bird on the ground line, wings wrong, glow out. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### DRAGON GRAVEYARD ENEMIES

Regulars use the same **8×6** action-only sheet as Fire/Ice/Earth. Draw only the character. Do not bake bolts, clones, bone walls, or trails into the frames. Target **1024×768**. Frost Hatchling stays a boss sheet.

#### Bone Wraith
**File target:** `images/enemies/bone-wraith-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one wraith. Do not draw shadow bolts, extra ghosts, bone walls, or slash trails.
>
> Character: Bone Wraith, ghostly floating undead dragon spirit, about 32×50 pixel logical size, tattered dark purple-violet cloak that frays into wisps that are part of the body, no visible legs, pale bone-white skull with glowing magenta eye sockets, skeletal clawed hands. Ancient dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin hovering with the cloak hanging, claws at its sides, eye sockets dim. Then the cloak wavers, the skull tilts, and the magenta sockets pulse. Later frames the body bobs up then sinks, finger-bones flexing. Final frame matches the starting hover so the pulse loops. This must look like a living idle, not eight identical skulls.
>
> Row 2 (8 frames) – Glide: Begin tilting the torso forward, cloak trailing as part of the silhouette, skull leading. Then the body slides right, claws trailing, hem wisps swept. Middle frames dip then rise. Later frames keep traveling. Final frame is still gliding so the row loops. This must look like an actual travel cycle, not a still hover moved over.
>
> Row 3 (8 frames) – Phase / Pass: Begin turning translucent (same body, lighter pixels), leaning into a pass, cloak flattening. Then the lean stretches as if slipping through something. Later frames the body snaps solid again, sockets flaring, cloak billowing. Final frame is fully solid, slightly past the pass. Body-only.
>
> Row 4 (8 frames) – Reach / Split: Begin raising both skeletal arms as if hurling, cloak opening. Then the arms reach their peak. Later frames the torso peels down the middle as if splitting copies — draw only this one ribcage stretching and parting, no second skull. Final frame is the widest single-body split, arms high. No extra objects.
>
> Row 5 (8 frames) – Recoil: Begin with the cloak snapping back, skull cracking a hairline then holding, sockets flaring. Then the body knocks backward. Later frames the crack stays but the flare dies. Final frame is a hurt hover, cloak messy.
>
> Row 6 (8 frames) – Defeat: Begin with the cloak shredding at the hem, sockets guttering. Then the skull spiderwebs and the claws drop. Later frames the body dissolves downward. Final frame is a shattered skull fragment and empty cloak scraps, no standing pose. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

#### Frost Hatchling (Baby Ice Dragon — Mini-Boss)
**File target:** `images/enemies/baby-dragon-sheet.png` (1024×1024, boss)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game mini-boss enemy.
> 4 rows and 4 columns (16 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background. Draw only the hatchling. Do not bake ice cones, falling icicles, or shatter bursts into the frames.
>
> Character: Frost Hatchling, a young ice dragon recently hatched from ancient remains, about 120×90 pixel logical size, pale icy blue-white scaled body with a lighter underbelly, small sharp ice-blue wings, rounded head with two small curved horns, large cyan eyes, stubby clawed legs, icicle-tipped tail. Youthful dragon proportions. Side-view facing right.
>
> Row 1 (4 frames) – Idle: Begin standing on both stubby legs, wings folded, tail curved, a frost puff starting at the nostrils. Then the chest heaves, frost puffs, the tail swishes, and the wings hitch. Later frames the weight rocks from one clawed foot to the other and the cyan eyes blink. Final frame returns toward the starting stand. This must look like a living idle, not four identical hatchling stills.
>
> Row 2 (4 frames) – Walk: Begin lifting the front left claw, wings giving a small flap for balance, tail countering. Then that foot plants, the body bounces, and the opposite rear leg swings. Later frames the next step travels right with another small wing flap. Final frame is mid-trot so the row loops. This must look like an actual walk cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (4 frames) – Attack: Begin rearing onto the hind legs, wings opening, mouth closed, tail bracing. Then the mouth opens and the head sweeps as if breathing — jaw and neck do the work, no ice cone leaving the cell. Later frames the body curls down into a tight ice-ball crouch, wings wrapping the torso, tail tucking. Final frame is the tightest ice-ball crouch. Body-only.
>
> Row 4 (4 frames) – Defeat: Begin stumbling, crystals along the scales cracking, eyes widening. Then the legs buckle and the wings crumple. Later frames the body collapses onto its side, tail slapping limp. Final frame is the hatchling down on its side, glow gone from the eyes. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### STORM ISLANDS NPC

#### Marek the Fisherman
**File target:** `images/npcs/marek-sheet.png` (512×512)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game NPC.
> 6 columns and 4 rows (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Marek, weathered middle-aged fisherman NPC, about 28×46 pixel logical size, tanned sun-darkened skin, short scruffy brown hair with grey streaks, kind tired eyes, a faded blue fisherman's tunic with rolled-up sleeves, tan trousers tucked into worn leather boots, a rope belt with a fish hook hanging from it, a wide-brimmed straw sun hat, a simple wooden fishing rod carried over one shoulder. Side-view facing right.
>
> Row 1 (6 frames) – Idle: Begin standing with the rod over the right shoulder, hat brim level, eyes looking out to the right as if watching the sea. Then the chest breathes, the tunic hem drifts, and the rod tip nods. Knees soften, the hook on the belt sways, and the hat brim lifts in a light breeze then settles. Later frames the weight rocks from the back boot to the front. Final frame returns to the starting sea-watch stand. This must look like a living idle, not six identical portraits.
>
> Row 2 (6 frames) – Walk: Begin with the left boot stepping, rod bouncing on the shoulder, hat already tipping. Then the right boot strikes, hips rotate, trousers wrinkle at the knees, and the hook swings. Later frames complete the opposite stride with both boots leaving and hitting the ground. Final frame is mid-stroll so the row loops. This must look like an actual walk cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (6 frames) – Talking: Begin with a closed mouth, rod lowered to the right hand, free hand down. Then the mouth opens, the free hand lifts into an expressive gesture, and the tired eyes crinkle. Later frames the hand turns palm-up, the head nods, and the hat brim dips with the nod. Final frame is a held talking pose, mouth open, hand raised, ready to loop as conversation.
>
> Row 4 (6 frames) – Alarmed: Begin from a casual stand, then the eyes go wide and the free hand snaps up to point toward the upper right as if at a volcano. Then the torso twists into the point, the rod drops lower, and the straw hat blows backward off-level. Later frames the pointing arm locks and the knees bend as if ready to run. Final frame is the full alarm pose: pointing, wide eyes, hat blown, weight on the front boot.
>
> Style: clean digital pixel-art sprite sheet, fantasy RPG style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### STORM ISLANDS ENEMIES

Regulars use the same **8×6** action-only sheet as Fire/Ice/Earth. Draw only the character. Do not bake fireballs, lava puddles, or extra shadows into the frames. Target **1024×768**.

#### Flame Salamander
**File target:** `images/enemies/flame-salamander-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one salamander. Do not draw fireballs, fire lines, embers, or extra bodies.
>
> Character: Flame Salamander, long low-slung fire lizard, about 48×24 pixel logical size, charcoal-grey body with orange-red spine markings, four short clawed legs, thick tail ending in a glowing ember tip that is part of the tail, flat wide head, small glowing orange eyes. Volcanic dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin in a low stance, belly close to the ground line, tail curved, markings dim. Then the tail swishes, the spine markings pulse brighter then softer, and the ember tip brightens. Paws knead, the head turns a few degrees, and the chest pants. Later frames the weight rocks from the front pair of legs to the rear. Final frame returns to the starting low stand. This must look like a living idle, not eight identical lizards.
>
> Row 2 (8 frames) – Run: Begin with the body already undulating, front left claw reaching, tail streaming. Then a quick scurrying cycle: opposite diagonal legs plant, the spine flexes in an S-wave, the ember tip whips. Middle frames show a stretched flight-like reach. Later frames the next undulation travels right. Final frame is mid-scurry so the row loops. This must look like an actual run cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (8 frames) – Crouch / Dash: Begin dropping into a tight crouch, elbows in, tail coiled, head low. Then the crouch loads. Later frames the body stretches into a long dash pose, legs extended, spine straight, ember tip streaming as part of the tail. Final frame is the fully stretched dash. Body-only. The crouch-to-dash must change the whole silhouette, not slide one still.
>
> Row 4 (8 frames) – Spit / Roll: Begin with the mouth opening wide, throat glowing, front legs planting. Then the spit pose peaks — jaws and neck do the work, nothing leaves the mouth. Later frames the body curls the head to the tail into a tight ball, legs tucking. Final frame is the rolled ball. No extra objects.
>
> Row 5 (8 frames) – Recoil: Begin with the markings flaring white-orange, body knocking backward. Then the legs splay and the ember tip sputters. Later frames the flare dies and the body settles off-center. Final frame is a hurt low stance, markings dim.
>
> Row 6 (8 frames) – Defeat: Begin with the legs buckling, markings fading, ember tip dying. Then the belly slumps and the jaw hangs. Later frames the body crumbles as if cooling to ash while staying one creature. Final frame is a cooling ash-lizard heap, eyes dark. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

#### Magma Imp
**File target:** `images/enemies/magma-imp-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one imp. Do not draw magma bolts, puddles, extra shadows, or pillars.
>
> Character: Magma Imp, small volcanic demon, about 32×40 pixel logical size, obsidian-black skin with orange magma cracks, short curved horns, wicked yellow-orange eyes, wiry limbs, short pointed tail, digitigrade legs, clawed hands. Agile dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin crouched with the tail twitching, cracks dim, hands near the ground. Then the magma cracks pulse brighter, the tail flicks the other way, and the chest bounces. Knees bob, horns nod, eyes narrow then widen. Later frames the weight rocks from one foot to the other. Final frame returns to the starting crouch. This must look like a living idle, not eight identical demons.
>
> Row 2 (8 frames) – Run: Begin hunched with the front foot reaching, tail acting as a counterweight, cracks already stretching along the moving limbs. Then a darting cycle: opposite knee pumps, hips twist, both feet leave and hit the ground. Middle frames a clear airborne hop. Later frames the next stride travels right. Final frame is mid-run so the row loops. This must look like an actual run cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (8 frames) – Leap: Begin a jump squat, knees deeply bent, arms back, tail down. Then the legs fire and the body leaves the ground. Later frames the body tucks mid-air, knees to chest, tail wrapping, cracks brightest. Final frame is the tightest tucked mid-air pose. Body-only.
>
> Row 4 (8 frames) – Throw / Slam: Begin with one arm hurling forward from the hip, torso twisting, empty hand — nothing leaves the fingers. Then the throw follow-through peaks. Later frames both arms rise and slam the ground, knees bending, tail snapping. Final frame is the double-arm slam, fists at ground line. No extra objects.
>
> Row 5 (8 frames) – Recoil: Begin with the cracks flashing white-orange, body knocking backward. Then the feet leave the ground for a hit-stun hop. Later frames the flash dies and it lands off-balance. Final frame is a hurt crouch, cracks dim.
>
> Row 6 (8 frames) – Defeat: Begin with the cracks dimming, limbs losing tension, eyes guttering. Then the body shatters along the crack lines while remaining one silhouette breaking apart. Later frames the pieces slump. Final frame is a heap of cooled obsidian shards in the imp's shape, no standing pose. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, dark fantasy game style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### STORM ISLANDS BOSS

#### Pyraxis, The Fire Colossus
**File target:** `images/enemies/fireColossus.png` (2048×2048, large boss)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 4 columns (16 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Pyraxis, The Fire Colossus — a massive living volcano titan boss, about 380×300 pixel logical size. Dark volcanic-grey rocky body with deep glowing orange-red magma veins running through every joint and crevice, enormous broad torso covered in jagged volcanic rock plates with bright lava visible between the cracks, two massive arms ending in huge rocky fists with lava dripping from the knuckles as part of the fists, thick pillar-like legs with magma pooling at the feet as part of the ankles, a crowned head with two enormous curved horns made of dark volcanic rock glowing orange at the tips, a deep-set face with two blazing yellow-white eyes like molten metal, a wide jaw with lava dripping from the corners, a radial heat-aura distortion bound close to the body, glowing orange-red core visible in the center of the chest, volcanic smoke and ember particles rising from the shoulders as part of the silhouette. Towering apocalyptic dark fantasy dungeon boss. Side-view facing right.
>
> Row 1 (4 frames) – Idle: Begin standing imposingly, both pillar-legs planted, fists hanging, chest core at rest glow, a thin smoke line at each shoulder. Then the magma veins pulse brighter down the arms and legs, the chest core throbs deep orange, and smoke thickens from the shoulders and horn-tips. Later frames the ground-glow under the feet brightens and the weight rocks from the back pillar-leg to the front so the plates shift. Final frame returns toward the starting loom with the core at its dimmer beat. This must look like a living idle, not four identical mountain statues.
>
> Row 2 (4 frames) – Walk/Move: Begin lifting the front pillar-leg, torso tilting, opposite fist swinging back, magma stretching in the hip-cracks. Then that foot slams, lava at the ankle splashes as part of the foot, and the rear leg starts to pass. Later frames the opposite thundering step completes, arms swinging with molten rock dripping from the knuckles, ember particles trailing the shoulders as part of the body. Final frame is mid-stomp so the row loops. This must look like an actual walk cycle, not a standing pose with one foot moved slightly forward.
>
> Row 3 (4 frames) – Attack: Begin raising both fists overhead, knees bending, chest core climbing toward white-hot, horns glowing. Then the whole body drops as both fists slam the ground, torso compressing, jaw opening. Later frames a massive lava eruption reads at the impact — magma pillars shooting upward from the fists and shockwave cracks along the ground line — while the body is still in the slam. Final frame is the full slam, fists buried, core white-hot, horns brightest.
>
> Row 4 (4 frames) – Defeat: Begin with the magma veins flickering and dimming, eyes sputtering, smoke thinning. Then cracks open along every vein line and the chest core goes dark. Later frames massive chunks of volcanic rock break away from the shoulders and arms as the body slumps. Final frame is a collapsed mountain of cooling stone and fading embers in Pyraxis's fallen silhouette, a last wisp of smoke rising, no standing pose. Play-once death.
>
> Style: clean digital pixel-art sprite sheet, epic dark fantasy boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

### SEA TEMPLE ENEMIES

Regulars use the same **8×6** action-only sheet as Fire/Ice/Earth. Draw only the character. Do not bake water blades, coral spikes, bubbles, or currents into the frames. Target **1024×768**.

#### Abyssal Guardian
**File target:** `images/enemies/abyssal-guardian-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one guardian. Do not draw water blades, waves, spheres, or extra projectiles.
>
> Character: Abyssal Guardian, armored deep-sea fish-warrior, about 40×48 pixel logical size, dark blue-black scales under barnacle plate, thick armored fins as arms, massive jaw with cyan teeth, pale cyan eyes, coral-encrusted helmet. Heavy melee dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin planted in a heavy ready stance, both armored fins held forward at chest height, tail hanging just off the floor, jaw shut. Across the eight frames the chest plates rise and fall in a slow breathe, the cyan markings along the barnacle armor pulse bright then dim, the fin-arms drift a few pixels up and down, and the tail makes a short side-to-side sweep. Later frames must not match the first: the helmet tilts a degree, the jaw cracks open then closes, the markings hit a brighter peak then fade. Final frame returns to the ready stance with fins held, markings mid-pulse, so the row can loop. This is a living idle, not eight copies of one still.
>
> Row 2 (8 frames) – Walk: Begin with the rear fin-leg planted and the lead fin-leg lifting clear of the ground. Progressive contact–pass–lift across all eight frames: hips and barnacle torso shift over the planted leg, the tail sweeps opposite the step for balance, the fin-arms pump, the helmet bobs. Mid-row the lead foot plants and weight transfers; later frames lift the trailing leg. Final frame is mid-stride or newly planted with weight clearly on the stepping leg. This must look like an actual heavy step, not a standing pose with one foot slid forward.
>
> Row 3 (8 frames) – Swing / Slam: Begin in the idle ready stance. Early frames wind the lead armored fin back behind the hip, torso coils, tail counters. Mid-row the fin swings in a wide horizontal arc across the body — shoulder, elbow-fin, and helmet all rotate with the swing. Later frames the swing finishes and both fins rise, then drive straight down into a ground-slam pose, knees bending, tail flaring, jaw opening. Body-only: no shockwave, no water blade. Final frame is the fully planted slam, fins low, body compressed. The late slam must not look like the early wind-up.
>
> Row 4 (8 frames) – Raise / Pull: Begin with fins low. Both armored fins rise together as if calling water — shoulders lift, helmet tips back, cyan markings brighten, tail hangs. Mid-row the fins peak overhead, fingers-of-fin splayed, chest expanded. Later frames both fins pull inward toward the sternum, elbows tucking, torso crunching, markings flaring then settling. No extra objects, no orbs, no currents. Final frame is the inward-pull hold, fins close to the chest. Early frames are a reach-up; late frames are a gather-in — they must not be the same pose.
>
> Row 5 (8 frames) – Recoil: Begin in a combat stance. A hit snaps the torso backward: helmet whips, barnacle plates chip (chips stay on the body silhouette), cyan markings flicker off then stutter back, fin-arms fling wide, tail lashes. Progressive knockback across the row — later frames are further back and more crumpled than early frames. Final frame is a staggered lean, one fin raised, markings still flickering. Not a single flinch copied eight times.
>
> Row 6 (8 frames) – Defeat: Play-once death. Begin from a standing hit. Plates crack wider each frame, cyan teeth go dark, helmet tilts, knees buckle. Later frames the body sinks and slumps, tail going limp, fins hanging. Final frame is a crumpled heap on the floor, markings dead, no standing silhouette. Do not loop this row.
>
> Style: clean digital pixel-art sprite sheet, dark underwater fantasy style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Coral Sentinel
**File target:** `images/enemies/coral-sentinel-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one sentinel. Do not draw flying coral chunks, floor spikes, extra nodes, or armor pieces leaving the cell.
>
> Character: Coral Sentinel, living coral construct, about 36×36 pixel logical size, red-orange-purple-teal coral body, branching arms, amber eyes, calcified torso plates. Temple guardian. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin upright with branching arms slightly open, polyps along the shoulders closed. Across all eight frames the whole body sways a few pixels like a current is moving it, polyps on the arms and chest pulse open then shut, amber eyes brighten and dim, calcified plates shift a crack-width. Later frames the sway is on the opposite side from the start, and a different cluster of polyps is open. Final frame is near the start of the sway so the idle can loop. Not eight identical stills.
>
> Row 2 (8 frames) – Walk: Begin with one coral-limb planted and the other lifting, branches recoiling. Lurching coral-limb steps: the torso tilts over the planted limb, the lifted branch-leg unfolds then plants, the trailing limb peels off the ground, arms swing for balance, polyps flatten on the down limb. Mid-row weight transfers with a visible lurch. Final frame is mid-lurch or newly planted. This must look like an actual step, not a standing pose with one branch slid forward.
>
> Row 3 (8 frames) – Grow / Armor: Begin with plates at normal thickness. Early frames coral plates thicken over the torso, shoulders, and upper arms — the silhouette grows chunkier, branches pull in, amber eyes narrow. Mid-row the armor is at maximum, body hunched behind the new bulk. Later frames those same plates crack along the seams (cracks stay on the body), chips cling to the silhouette, the extra bulk recedes. Body-only, no flying chunks. Final frame is the cracked, thinner post-armor pose. Late frames must not match the early grow-up.
>
> Row 4 (8 frames) – Reach / Plant: Begin with arms close. Early frames both branching arms extend forward and out as if launching something — joints straighten, polyps flare, torso leans. Mid-row the reach is at full stretch. Later frames the arms dip and drive downward as if planting nodes, knees bend, head lowers, fingers-of-coral splay toward the floor. No extra objects, no nodes, no spikes. Final frame is the planted dip, arms low. Reach and plant are two different poses in one row.
>
> Row 5 (8 frames) – Recoil: Begin upright. A hit knocks plates on the body silhouette (they stay attached, they do not leave the cell), amber eyes flare white-hot, branches snap backward, torso twists. Progressive knockback: later frames are more open and further back, with more plates knocked askew. Final frame is a staggered lean, eyes still flared, a plate hanging but attached. Not one recoil pose repeated.
>
> Row 6 (8 frames) – Defeat: Play-once death. Begin from a standing hit. Branches snap one after another, polyps go dark, torso cracks. Later frames the construct crumbles into a rubble heap, amber eyes dying last. Final frame is a coral rubble pile, no standing figure. Do not loop.
>
> Style: clean digital pixel-art sprite sheet, underwater fantasy style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Depth Serpent
**File target:** `images/enemies/depth-serpent-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one serpent. Do not draw ripples, venom bubbles, or extra coils leaving the cell.
>
> Character: Depth Serpent, sleek deep-sea snake, about 50×20 pixel logical size, teal-green scales, pale bioluminescent underbelly, pointed snout, glowing green eyes, spine fins, forked tail. Underwater predator. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin in a loose S-coil, head raised above the coils, tongue just starting to flick. Across all eight frames the coil tightens then eases, the head bobs, the forked tongue flicks in and out, spine fins ripple, the underbelly glow pulses. Later frames the head is in a different part of the bob and the coil has shifted. Final frame is a loose coil with head raised, tongue mid-flick, ready to loop. Not a frozen snake.
>
> Row 2 (8 frames) – Swim: Begin with the body in an S-wave, head leading right, tail left. Rapid S-wave movement: each frame the wave travels down the body, spine fins flatten then flare, the underbelly stretches on the outside of each curve, the head yaws with the stroke. Later frames are a different phase of the wave than early frames. Final frame continues the cycle so it can loop as swimming. This must look like actual undulation, not a still S-pose with the head nudged forward.
>
> Row 3 (8 frames) – Sink / Rise: Begin at normal swim height in a loose coil. Early frames the body melts downward — coils flatten, head drops, fins fold, silhouette sinks toward the bottom of the cell as if slipping under. Mid-row the serpent is at its lowest, almost a compressed line. Later frames it erupts upward: head first, jaws opening, body following in a rising column, fins flaring. Body-only, no ripples. Final frame is the fully risen strike height, head high. Early sink and late rise must be opposite poses.
>
> Row 4 (8 frames) – Coil / Strike: Begin extended. Early frames the body tightens into a spiral, head tucking toward the center, tail wrapping, spine fins folding in. Mid-row is the tightest spiral. Later frames the spiral uncoils into a launch — head shoots forward, body straightens behind it, jaws open, fins flare. No extra objects, no second snake. Final frame is the launched extension, head farthest right. The late strike must not look like the early coil.
>
> Row 5 (8 frames) – Recoil: Begin in a mid-coil. The body knocks back: head whips opposite the facing, spine fins flare wide, underbelly flash-bright then stutters, coils bunch. Progressive knockback across the row. Final frame is a bunched, fins-flared stagger. Not one flinch tile.
>
> Row 6 (8 frames) – Defeat: Play-once death. Begin from a hit. Glow dies along the underbelly, eyes dim, body goes limp segment by segment and curls into a loose dead coil. Final frame is a limp curled heap, no raised head. Do not loop.
>
> Style: clean digital pixel-art sprite sheet, dark underwater fantasy style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### Leviathan Head

**File target:** `images/enemies/leviathanHead.png` (512×512)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss part.
> 4 rows and 6 columns (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Leviathan Head — the massive angular reptilian skull of an ancient sea serpent boss. Armored blue-green scales with deep ocean teal base (#0a3a5a), glowing cyan eyes (#44ffdd) with slit pupils, long snout lined with rows of crystalline teeth, bioluminescent vein markings along the jaw, fins and tendrils trailing from the back of the skull, luminous cyan (#44ffdd) energy veins pulsing across armored plates.
>
> Row 1 (6 frames) – Idle: Begin with the mouth fully closed, eyes forward, jaw tendrils hanging, throat glow dim. Across all six frames the slit-pupil eyes scan — they drift a few pixels then return — the jaw tendrils drift independently, the throat glow pulses brighter then fades, bioluminescent veins along the jaw flicker in sequence, and the rear fins make a slow breathe-like lift. Later frames the eyes are looking a different direction than frame 1 and the glow is on a different beat. Final frame is mouth closed, tendrils mid-drift, glow mid-pulse, loop-friendly. Not a still skull.
>
> Row 2 (6 frames) – Move / Swim: Begin with the head slightly lifted, tendrils hanging. The head pushes forward through water: snout lowers into a streamlined line, the jaw tucks, tendrils sweep back along the skull as if a current caught them, eyes lock ahead, faint wake ripples form only at the snout (on-body water, not a separate VFX plate). Progressive lean: later frames are more streamlined and more forward than early frames. Final frame is the fully streamlined swim pose, tendrils swept back, eyes locked. This must look like the head is driving forward, not a still head with tendrils redrawn.
>
> Row 3 (6 frames) – Attack: Begin mouth closed. Early frames the jaw unhinges downward, crystalline teeth catch light, cyan energy glow builds in the throat. Mid-row the mouth is wide, a roar pose, tendrils flare outward from the skull, energy blast forming in the throat (stays in the mouth, does not become a long beam leaving the cell). Later frames shockwave rings leave the mouth as short on-snout rings and the jaw holds the unhinged roar. Final frame is jaws at maximum, tendrils fully flared, throat blazing. Late frames must not match the closed-mouth start.
>
> Row 4 (6 frames) – Hurt / Defeat: Play-once. Begin from a forward roar or idle. The head recoils: neck-base pulls back, scales crack and chip (chips stay on the silhouette), cyan glow fades from the eyes frame by frame, the jaw drops open limply, tendrils go slack, energy veins dim and flicker out in sequence. Final frame is a slack, cracked, dark-eyed head with the jaw hanging. Do not loop.
>
> Style: clean digital pixel-art sprite sheet, dark underwater fantasy style, consistent proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### Leviathan Body

**File target:** `images/enemies/leviathanBody.png` (512×512)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss part.
> 4 rows and 6 columns (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Leviathan Body Segment — a thick serpentine body section of an ancient sea serpent boss. Layered armored scales in dark ocean teal (#0a3a5a) with deep blue underbelly (#0a2040), ridged spine with dorsal fins running along the top, subtle bioluminescent stripes along the sides glowing cyan (#44ffdd), muscular and imposing underwater predator segment.
>
> Row 1 (6 frames) – Idle: Begin as a resting horizontal segment, dorsal fins half-raised, stripes dim. Across all six frames the segment undulates a few pixels — a slow muscular breathe — scales shimmer as highlight travels, dorsal fins wave independently, bioluminescent stripes pulse along the sides in a traveling glow. Later frames the bulge of the undulation is in a different place than frame 1. Final frame is a resting undulation mid-cycle. Not six identical tubes.
>
> Row 2 (6 frames) – Move / Swim: Begin near-straight. The body forms a fluid S-curve that travels along the segment: dorsal fins flatten for speed, stripes brighten with exertion, water-displacement ripples cling to the scale edges (on-body only). Each frame is a different phase of the S. Final frame continues the swim cycle. This must look like the segment is actually traveling a wave, not a still curve.
>
> Row 3 (6 frames) – Attack: Begin in the idle curve. Scales flare outward defensively — the silhouette fattens — dorsal fins spike straight up, stripes flash rapidly, small bubble particles erupt from between the scales (they stay in the cell, on the body), the whole segment tenses for a strike, underbelly tightening. Progressive flare: later frames are more spiked and brighter than early frames. Final frame is the fully tensed, fins-up, stripes-blazing strike-ready segment. Late frames must not match the calm start.
>
> Row 4 (6 frames) – Hurt / Defeat: Play-once. Begin tensed. Scales crack and fall away on the silhouette revealing pale flesh, dorsal fins droop then break, bioluminescent glow fades stripe by stripe, the segment goes limp and sags as if sinking. Final frame is a limp, dark, cracked segment hanging downward. Do not loop.
>
> Style: clean digital pixel-art sprite sheet, dark underwater fantasy style, consistent proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### Leviathan Tail

**File target:** `images/enemies/leviathanTail.png` (512×512)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss part.
> 4 rows and 6 columns (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Leviathan Tail — the massive tail fin of an ancient sea serpent boss. Dark teal armored scales tapering into a thinner flexible tail ending in a wide translucent fin with glowing cyan (#44ffdd) vein patterns, trailing bioluminescent particles, fin edges glow bright cyan, powerful and sweeping.
>
> Row 1 (6 frames) – Idle: Begin with the tail resting horizontal, fin half-spread, veins dim. Across all six frames the fin gently waves — leading edge up, then down — bioluminescent particles drift off the fin edges (stay near the fin), vein patterns pulse in a slow rhythm. Later frames the fin is on the opposite beat of the wave. Final frame is horizontal, fin mid-wave, loop-friendly. Not a still tail.
>
> Row 2 (6 frames) – Move / Swim: Begin near-horizontal. The tail sweeps side to side to propel: the fin fully extends for thrust on the power stroke, folds slightly on the return, a trailing particle wake follows the tip, veins brighten with each sweep. Progressive sweep: early frames start the stroke, mid-row is the widest extension, later frames complete the opposite sweep. Final frame is mid-cycle ready to loop. This must look like an actual swimming stroke, not a still fin tilted once.
>
> Row 3 (6 frames) – Attack: Begin horizontal. The tail curls upward — scales bunch on the inside of the curl, fin folding — then swipes and slams down. Vortex energy gathers at the tip during the curl (on the tip only), fin edges flare bright cyan, a short shockwave ripple sits at the impact of the slam, bioluminescent flash on contact. Progressive: curl, peak, slam. Final frame is the fully slammed-down tail, fin flared, tip flashing. The slam must not look like the idle wave.
>
> Row 4 (6 frames) – Hurt / Defeat: Play-once. Begin from a raised pose. The tail goes rigid, then limp; the fin tears and becomes ragged; vein glow dims and extinguishes; bioluminescent particles scatter and fade; the tail drifts downward. Final frame is a ragged, dark, downward-drifting tail. Do not loop.
>
> Style: clean digital pixel-art sprite sheet, dark underwater fantasy style, consistent proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### DESERT PYRAMID ENEMIES

Regulars use the same **8×6** action-only sheet as Fire/Ice/Earth. Draw only the character. Do not bake sandstorms, extra mirages, dunes, or tornadoes into the frames. Target **1024×768**.

### Sand Wraith

**File target:** `images/enemies/sand-wraith-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one wraith. Do not draw extra mirages, sand streams, tornadoes, or moving dunes.
>
> Character: Sand Wraith, ghostly desert spirit, about 50×58 pixel logical size, translucent sandy body, hollow amber eyes, tattered burial wraps. Deceptive dark fantasy enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin hovering a few pixels off the implied floor, wraps hanging. Across all eight frames the body bobs, tattered burial wraps drift in different directions, hollow amber eyes pulse, sand-grains on the silhouette shift. Later frames the wraps have moved to a new drape and the hover is on the opposite bob. Final frame is a hover mid-bob, wraps mid-drift, loop-friendly. Not eight still ghosts.
>
> Row 2 (8 frames) – Glide: Begin upright hover. The body tilts forward, wraps trail behind, the lower sand-body streams slightly backward, eyes lock ahead. Progressive tilt and travel-pose across the row: later frames are more leaned and more stretched than early frames. Final frame is the full glide lean, wraps trailing. This must look like forward motion, not a standing hover with wraps redrawn.
>
> Row 3 (8 frames) – Sink / Rise: Begin at hover height. Early frames the sandy body melts into the floor — legs and wraps dissolve downward, eyes sink, silhouette shortens. Mid-row the wraith is almost gone, a low sand smear with eyes. Later frames it erupts upward: torso reforms, wraps snap out, eyes flare, full height restored. Body-only, no extra sandstorm. Final frame is the fully risen erupt pose, taller than idle. Early melt and late erupt are opposite.
>
> Row 4 (8 frames) – Blast / Split: Begin upright. Early frames the torso leans forward as if blasting sand — chest opens, wraps whip back, one arm-shape extends. Mid-row is the blast lean at peak. Later frames the body peels as if splitting copies: the torso shears into a double-thickness silhouette of the SAME body (a peel, not a second wraith), then the peel collapses back. No extra objects, no extra mirages. Final frame is the post-peel stagger, still one wraith. Late peel must not look like the early lean.
>
> Row 5 (8 frames) – Recoil: Begin hovering. The sand body knocks back, wraps snap the wrong way, amber eyes flare. Progressive knockback. Final frame is a back-leaning stagger, eyes flared. Not one flinch tile.
>
> Row 6 (8 frames) – Defeat: Play-once death. Begin from a hit. The form dissolves grain by grain into a sand pile, wraps falling in, eyes last to fade. Final frame is a sand pile with empty wraps, no standing wraith. Do not loop.
>
> Style: clean digital pixel-art sprite sheet, desert fantasy style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### Tomb Guardian

**File target:** `images/enemies/tomb-guardian-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one guardian. Do not draw shockwaves, glyphs, floating slabs, or extra platforms.
>
> Character: Tomb Guardian, sandstone golem, about 56×68 pixel logical size, heavy sandstone body, amber cracks, carved Egyptian face, gold inlay. Slow arena-shaping tank. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin standing firm, feet planted, arms at the sides, carved face forward. Across all eight frames the amber cracks in the sandstone pulse bright then dim, gold inlay catches a traveling highlight, the chest rises a stone-breathe, the head tilts a degree. Later frames the glow is on a different crack network than frame 1. Final frame is the firm stand, cracks mid-pulse, loop-friendly. Not eight identical statues.
>
> Row 2 (8 frames) – Walk: Begin with the rear foot planted, lead foot lifting. Heavy deliberate steps: the whole sandstone mass shifts over the planted leg, the lifted foot clears the ground, gold skirt-inlay swings, arms counter, the carved face bobs. Mid-row the lead foot plants and the body dips. Final frame is mid-stride or newly planted with weight on the stepping leg. This must look like an actual heavy step, not a standing pose with one foot slid forward.
>
> Row 3 (8 frames) – Smash / Shield: Begin standing. Early frames both fists rise overhead for a smash — elbows high, torso leaning back, cracks brightening. Mid-row the fists are at the peak. Later frames a sandstone slab-shape is held in front as a shield (the slab is part of the golem’s arms and chest, body-only, not a floating platform). Final frame is the shield-hold, fists and a slab of self-stone covering the front. The late shield must not look like the early overhead smash.
>
> Row 4 (8 frames) – Punch / Rise: Begin standing. Early-to-mid frames are repeated ground punches: one fist then the other drives down, shoulders dropping, body rocking with each punch (two or three punch beats across the first frames). Later frames the guardian steps onto a higher stance — both feet plant wider, torso rises, chin lifts, as if it has stepped up a level, still body-only, no extra platform drawn. No extra objects. Final frame is the high wide stance after the punches. Punches and the rise are different poses.
>
> Row 5 (8 frames) – Recoil: Begin firm. Stone knocks back, hieroglyphs on the body flicker off then on, gold inlay cracks (stays on the body), carved face turns. Progressive knockback. Final frame is a staggered lean, glyphs still flickering.
>
> Row 6 (8 frames) – Defeat: Play-once death. Begin from a hit. Chunks break away on the silhouette, amber cracks go dark, the carved face splits. Later frames it crumbles to rubble. Final frame is a sandstone rubble heap. Do not loop.
>
> Style: clean digital pixel-art sprite sheet, desert fantasy style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### Desert Serpent

**File target:** `images/enemies/desert-serpent-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one serpent. Do not draw extra ridges, dunes, or venom droplets leaving the cell.
>
> Character: Desert Serpent, long venomous snake, about 64×30 pixel logical size, sandy tan scales, diamond back pattern, green fangs, yellow slit eyes. Burrowing predator. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin in a loose ground coil, head up, tongue just starting out. Across all eight frames the coil breathes, the forked tongue flicks in and out, yellow slit eyes blink, the diamond-back pattern shifts as scales ride. Later frames the head is in a different part of the bob. Final frame is a loose coil, tongue mid-flick, loop-friendly. Not a still snake.
>
> Row 2 (8 frames) – Slither: Begin in an S-curve on the ground. S-curve ground movement: the wave travels down the body, belly scales flatten on contact, head yaws, tail follows. Each frame is a different phase. Final frame continues the cycle. This must look like an actual slither, not a standing S with the head nudged.
>
> Row 3 (8 frames) – Sink / Rise: Begin on the surface in a loose coil. Early frames the body burrows down — coils flatten, head dives, silhouette sinks toward the bottom of the cell. Mid-row it is almost a buried line. Later frames it erupts upward: head first, green fangs bared, body following. Body-only, no dunes. Final frame is the risen strike height. Early burrow and late erupt are opposite.
>
> Row 4 (8 frames) – Coil / Strike: Begin extended. Early frames the body forms a ring, head meeting tail. Mid-row is the tightest ring. Later frames the head snaps through the center of the ring, body uncoiling behind the strike, fangs forward. No extra objects. Final frame is the snapped-through extension. The strike must not look like the ring.
>
> Row 5 (8 frames) – Recoil: Begin mid-coil. Body knocks back, green fangs flare, eyes flash. Progressive knockback. Final frame is a bunched stagger, fangs flared.
>
> Row 6 (8 frames) – Defeat: Play-once death. Begin from a hit. The body flattens and goes limp, diamond pattern dulls, fangs close. Final frame is a flat limp snake. Do not loop.
>
> Style: clean digital pixel-art sprite sheet, desert fantasy style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### Mummy Warrior

**File target:** `images/enemies/mummy-warrior-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one mummy. Do not draw extra bandage projectiles, cursed trails, or shrinking rings.
>
> Character: Mummy Warrior, reanimated soldier, about 48×62 pixel logical size, yellowed linen wraps, glowing red eyes, rusted bronze khopesh, gold-trimmed skirt. Persistent melee enemy. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin in an alert stance, khopesh held in the lead hand at hip height, free hand open, feet planted. Across all eight frames the yellowed linen wraps sway, red eyes pulse, the gold-trimmed skirt shifts, the khopesh tip dips and rises a few pixels, the chest makes a dry breathe. Later frames the wraps have moved to a new drape. Final frame is the alert stance, wraps mid-sway, loop-friendly. Not eight still mummies.
>
> Row 2 (8 frames) – Walk: Begin with the rear foot planted, lead foot lifting in a stiff shuffle. Stiff menacing shuffle: knees barely bend, the torso stays upright, wraps drag then snap, the khopesh bobs, the free hand claws. Mid-row the lead foot plants with a stiff jolt. Final frame is mid-shuffle or newly planted. This must look like an actual step, not a standing pose with one foot slid forward.
>
> Row 3 (8 frames) – Swing / Rage: Begin in idle guard. Early frames a wide khopesh arc starts — the rusted bronze blade winds behind the hip, torso coils. Mid-row the first arc completes across the body. Later frames the swings get faster: a second tighter arc, then a third, shoulders climbing, eyes brighter, wraps flaring — rage tempo, still body-only, the blade never leaves the hand as a projectile. Final frame is the end of the fastest arc, blade through, body twisted. Late fast swings must not match the early wind-up.
>
> Row 4 (8 frames) – Yank / Charge: Begin standing. Early frames the wraps on the lead arm pull taut as if latching — the arm extends, linen stretches, the body leans back against the pull, khopesh held back. Mid-row the taut peak. Later frames a forward charge: both feet cycle, torso dumps forward, khopesh trails, wraps snap loose. No extra objects, no bandage missiles. Final frame is the full charge lean, one foot off the ground. Yank and charge are different poses.
>
> Row 5 (8 frames) – Recoil: Begin in guard. Wraps snap (stay on the body), red eyes flare, khopesh dips, torso knocks back. Progressive stagger. Final frame is a snapped-wrap lean, eyes flared.
>
> Row 6 (8 frames) – Defeat: Play-once death. Begin from a hit. Wraps unravel strip by strip, the gold skirt drops, the body collapses to bones, khopesh falling with the hand. Final frame is a bone heap in empty linen. Do not loop.
>
> Style: clean digital pixel-art sprite sheet, desert fantasy style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### Scarab Swarm

**File target:** `images/enemies/scarab-swarm-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one swarm-mass. Do not draw a second swarm, a floor carpet, or beetles leaving the cell.
>
> Character: Scarab Swarm, one enemy made of many beetles, about 52×40 pixel logical size, gold-green carapaces forming a shifting blob. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin as a compact gold-green blob. Across all eight frames the cluster pulses — the outer silhouette breathes in and out — individual beetles shift inside the mass, legs and wing-cases catching light, the blob’s high point moves. Later frames a different beetle is on the surface. Final frame is a compact pulse mid-cycle. The mass must crawl internally, not sit as a still pile.
>
> Row 2 (8 frames) – Flow: Begin compact. The mass streams forward as a wave: the leading edge stretches right, the trailing edge thins, beetles tumble over each other, the silhouette becomes a longer lower wave then gathers. Progressive flow across all eight frames. Final frame is a forward-streaming wave, still one mass. This must look like the blob is actually moving, not a still oval nudged right.
>
> Row 3 (8 frames) – Split / Reform: Begin as one blob. Early frames the blob parts around empty space — a hole opens in the middle, left and right lobes separate but stay one connected enemy. Mid-row the gap is widest. Later frames the lobes close and the mass reforms into a single blob. Body-only, no second swarm. Final frame is a closed compact mass. Split and reform are opposite halves of the row.
>
> Row 4 (8 frames) – Scatter / Rise: Begin compact. Early frames the mass explodes outward — silhouette fattens, beetles spread to the edges of the cell but do not leave it. Mid-row is the most scattered (still one swarm). Later frames the beetles gather back into a rising mound, the mass stacking taller. No extra objects. Final frame is a tall gathered mound. Scatter and rise must not be the same pose.
>
> Row 5 (8 frames) – Recoil: Begin compact. The cluster knocks back, gaps open then close inside the mass, gold-green flash. Progressive knockback. Final frame is a gappy, back-shifted blob that is already starting to close.
>
> Row 6 (8 frames) – Defeat: Play-once death. Begin from a hit. Beetles fall within the cell and the mass dissipates into a thinning scatter, then a few still carapaces. Final frame is a sparse dead scatter, no living blob. Do not loop.
>
> Style: clean digital pixel-art sprite sheet, desert fantasy style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### Sandstorm Djinn

**File target:** `images/enemies/sandstorm-djinn-sheet.png`  
**Sheet size:** `1024×768 px` — **8 columns × 6 rows** (48 frames)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game enemy.
> 6 rows and 8 columns (48 frames total) arranged in a perfectly aligned grid with even spacing. Every cell is the same size. Transparent background. Draw only this one djinn. Do not draw extra copies, tornadoes, or a prison ring.
>
> Character: Sandstorm Djinn, desert storm spirit, about 54×66 pixel logical size, humanoid torso, lower body a sand tornado, white pupil-less eyes, gold armbands, sand crown. Arena manipulator. Side-view facing right.
>
> Row 1 (8 frames) – Idle: Begin with arms crossed over the chest, sand-tornado base at normal height, crown level. Across all eight frames the tornado base spins — striations on the sand column rotate, the waist twists, gold armbands catch light, white eyes pulse, the sand crown drifts a few pixels. Later frames the spin phase has moved; the arms stay crossed but the shoulders rise and fall. Final frame is arms crossed, base mid-spin, loop-friendly. The base must actually spin, not sit as a still cone.
>
> Row 2 (8 frames) – Glide: Begin idle-upright. The tornado elongates downward and back, the humanoid torso leans forward, one arm uncrosses for balance, the crown tilts, eyes lock ahead. Progressive lean and stretch across the row. Final frame is the full glide: long tornado, body leaned, wraps of sand trailing on the body only. This must look like travel, not a still lean.
>
> Row 3 (8 frames) – Cast / Bolt: Begin arms crossed. Early frames both arms extend forward as if firing — shoulders punch, gold armbands slide, the torso leans, the tornado tightens. Mid-row is the bolt-point, fingers aimed. Later frames the arms widen as if calling wind — both hands open, elbows high, chest broad, tornado flaring wider at the base (still the same one body, no extra tornado). Body-only. Final frame is the wide-arm wind-call. Point and widen are different poses.
>
> Row 4 (8 frames) – Mirage / Prison: Begin upright. Early frames the torso duplicates a half-step of the SAME body — a short double-exposure peel of the chest and arms, not a second djinn, then the peel collapses. Later frames both arms raise and join in a circle overhead as if forming a prison, the tornado stretching tall. No extra objects, no prison ring drawn, no extra copies left in the cell. Final frame is the overhead circle hold, one body. Mirage peel and prison-circle are different poses.
>
> Row 5 (8 frames) – Recoil: Begin upright. The sand body knocks back, lightning in the tornado base flickers (on the body only), eyes flare, crown tilts. Progressive stagger. Final frame is a back-lean, lightning still flickering in the base.
>
> Row 6 (8 frames) – Defeat: Play-once death. Begin from a hit. The tornado unravels into loose sand, the torso blows apart grain by grain, armbands falling, eyes last. Final frame is a blown-apart sand scatter, no standing djinn. Do not loop.
>
> Style: clean digital pixel-art sprite sheet, desert fantasy style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

---

### Zenith, the Final Convergence (Boss — 4 Sprite Sheets)

Zenith is a cosmic convergence entity with 4 sprite sheets split across two forms. Form 1 covers the base fight; Form 2 covers the enraged phase (below 40% HP). Each sheet has one row per Will, with a distinct color theme per behavior.

#### Sheet 1: Form 1 — Idle & Float (`zenith-form1-idle-sheet.png`)

**File target:** `images/enemies/zenith-form1-idle-sheet.png` (1024×1024)

**Prompt:**
> Clean 2D pixel-art sprite sheet, video game raid boss.
> 7 rows × 6 columns (42 frames), perfectly aligned grid, transparent background.
>
> Character: Zenith, the Final Convergence — a floating five-pointed star entity, 100×100px. Sharp angular points radiate from a glowing convergence core with two white eyes at center. Orbiting halos ring the middle. Void-black gaps between points. Point tips glow per-Will color. Symmetrical, cosmic silhouette. Not a humanoid. Pose change comes from halo rotation, point extend/retract, and core pulse — never a walk cycle.
>
> Row 1 (6 frames) – Idle Arc (#aaddff): Begin with all five points at rest length, tips soft blue (#aaddff), halos level. Across all six frames the halos rotate (tick marks travel around the rings), the points gently extend and retract in a breathing cycle, calm energy lines between points drift, the core pulses a soft blue. Later frames the halo has rotated a visible quarter-turn from frame 1 and a different point is at peak length. Final frame is near the start of the halo rotation so the idle can loop. This must look like orbiting motion, not a still blue star.
>
> Row 2 (6 frames) – Idle Wait (#cc88ff): Begin slightly expanded, tips purple (#cc88ff). The star pulses inward: points retract toward the core, a purple vortex distortion warps the void-black gaps between points (gap shapes change every frame), the core dimms then flares. Mid-row is the most compressed. Later frames the points ease back out. Final frame is the inward-pulse peak starting to release. Not a still purple star.
>
> Row 3 (6 frames) – Idle Drop (#88ccff): Begin with points at rest, ice-blue tips (#88ccff). Ice-blue energy condenses at the tips — each tip fattens then drips a short on-point streak that stays attached (faint rain-streak aura on the points only). Halos tilt a few degrees, the core pulses cold. Later frames a different pair of tips is swollen. Final frame has the top points slightly lowered after a drip cycle. Not a still ice star.
>
> Row 4 (6 frames) – Idle Drift (#ff88ee): Begin with points at rest, magenta tips (#ff88ee). Energy spirals along each point from core to tip; a magenta homing pulse travels around the core (the pulse is a bright knot that moves). Halos drift out of phase with each other. Later frames the spiral has traveled farther and the core-knot is on the opposite side. Final frame continues the spiral cycle. Not a still magenta star.
>
> Row 5 (6 frames) – Idle Weave (#ffdd44): Begin with points at rest, gold tips (#ffdd44). Halos travel in zigzag arcs — they do not spin in a clean circle; they hitch left then right. Golden energy crackles at the point tips, jumping from tip to neighboring tip. The whole star yaws a few degrees then yaws back. Later frames the zigzag is on the opposite hitch. Final frame is mid-zigzag, tips crackling. Not a still gold star.
>
> Row 6 (6 frames) – Idle Creep (#eeffee): Begin with the body rigid, four points locked, one point already slightly longer, pale-green (#eeffee) charging along that extended point from core to tip. Across the row the charge travels (bright band moving along the point), that one point extends further then holds, the other points stay rigid, the core stays a pale-green slit. Later frames the charge is nearer the tip than in early frames. Final frame is the fully charged extended point, still rigid. This is a charge cycle, not a still green star.
>
> Row 7 (6 frames) – Idle Apex (#ffffff): Begin with halos level, white-blue tips (#ffffff). Halos angle upward frame by frame until they cup the top point; white-blue energy builds at the crown point (the top point thickens and brightens). The lower points retract slightly to feed the crown. Later frames the top point is clearly larger and brighter than in frame 1. Final frame is the charged crown hold, halos angled up. Not a still white star.
>
> Style: pixel-art sprite sheet, cosmic void boss, consistent proportions, centered silhouette, evenly spaced frames, no cropping, no overlap.
> END OF PROMPT;

#### Sheet 2: Form 1 — Attacks (`zenith-form1-attack-sheet.png`)

**File target:** `images/enemies/zenith-form1-attack-sheet.png` (1024×1024)

**Prompt:**
> Clean 2D pixel-art sprite sheet, video game raid boss attacking.
> 7 rows × 8 columns (56 frames), perfectly aligned grid, transparent background.
>
> Character: Zenith — five-pointed star entity, glowing core, orbiting halos, two centered eyes. Each row uses the Will's color at the active firing point. Not a humanoid. Points extend and retract; halos recoil; the core changes size. Still frames that only recolor the same star are wrong.
>
> Row 1 (8 frames) – Attack Arc (#aaddff): Begin at rest, tips soft blue. Early frames one point charges and extends, blue gathering at the tip. Mid-row a blue orb leaves that tip in a high arc (the orb is on-sheet for the fire frames only), the halo recoils opposite the shot. Later frames the tip retracts and the halo settles. Final frame is the retracted rest after recoil. Charge, fire, and retract must be three different silhouettes.
>
> Row 2 (8 frames) – Attack Wait (#cc88ff): Begin expanded. The star compresses inward, purple building in the core. Mid-row a vortex field bursts outward from the core (a ring that grows, still centered on Zenith). Later frames the zone stabilizes as a held purple halo-field, points locked short. Final frame is the stabilized compressed star with the field settled. Compress, burst, and stabilize must not be the same pose.
>
> Row 3 (8 frames) – Attack Drop (#88ccff): Begin at rest. Top points raise, ice-blue gathering along their edges. Mid-row ice-blue slashes form on those points and fall in sequence (short slash marks leaving the tips, one after another). Later frames the tips lower. Final frame is the lowered rest after the last slash. Raised charge and lowered recovery are opposite.
>
> Row 4 (8 frames) – Attack Drift (#ff88ee): Begin at rest. One point extends, a magenta homing orb spins at the tip (the orb rotates in place for a few frames). Mid-to-late the orb fires spiraling toward the right, the point recoils. Final frame is the point retracted, core pulsing magenta. Spin-at-tip and fire-away are different frames.
>
> Row 5 (8 frames) – Attack Weave (#ffdd44): Begin at rest. A side point sweeps in a zigzag, gold blade-energy charging along its edge. Mid-row a jagged zigzag shot leaves the tip. Later frames the point returns to rest length and the halo settles. Final frame is the returned rest. Sweep, fire, and return must read as motion, not a still gold star.
>
> Row 6 (8 frames) – Attack Creep (#eeffee): Begin with one point locked rigid, pale-green. The spike charges (a bright band traveling core-to-tip). Mid-row the straight-shot fires from that tip. Later frames the point resets to rest length. Final frame is the reset rest. Lock, fire, and reset are three silhouettes.
>
> Row 7 (8 frames) – Attack Apex (#ffffff): Begin at rest. Top points raise, a wide white orb forms at the crown. Mid-row the wide lob fires upward-then-out, a short descent trail on the orb. Later frames the star returns to rest. Final frame is the rest after the lob. Raise, fire, and rest must differ.
>
> Style: pixel-art sprite sheet, cosmic void boss, consistent proportions, centered silhouette, evenly spaced frames, no cropping, no overlap.
> END OF PROMPT;

#### Sheet 3: Form 2 — Idle & Float (`zenith-form2-idle-sheet.png`)

**File target:** `images/enemies/zenith-form2-idle-sheet.png` (1024×1024)

**Prompt:**
> Clean 2D pixel-art sprite sheet, video game raid boss enraged second form.
> 7 rows × 6 columns (42 frames), perfectly aligned grid, transparent background.
>
> Character: Zenith Form 2 — same five-pointed star but destabilizing: points cracked and jagged, halos broken and erratic, eyes blazing white-red, violent fracture patterns between points. Slightly larger silhouette, more saturated colors than Form 1. Not a humanoid. Cracked points extend/retract, broken halos tumble, the core pulse is a violent cycle.
>
> Row 1 (6 frames) – Idle Arc F2 (#66bbff): Begin with cracked tips tilting, electric-blue (#66bbff). Across all six frames the cracked tips tilt further then snap back, electric arcs crackle between halo fragments (the arcs jump to different fragment pairs), broken halo pieces orbit unevenly. Later frames a different tip is the most tilted. Final frame is mid-tilt, arcs jumping, loop-friendly. Not a still cracked star.
>
> Row 2 (6 frames) – Idle Wait F2 (#aa44ff): Begin with broken halos already collapsed inward, purple (#aa44ff). Vortex distortion warps around the core — gap shapes twist every frame — dark energy implodes toward the eyes. Mid-row is the most imploded. Later frames a partial release that still looks violent. Final frame is the imploded hold starting to shudder. Not a still purple fracture.
>
> Row 3 (6 frames) – Idle Drop F2 (#aaeeff): Begin with cracked tips low. The tips fling ice shards upward (shards stay on the points as jagged ice growth) and violent rain-streaks extend down the points then retract. Later frames a different pair of tips is flinging. Final frame has the longest rain-streaks starting to recede. Not a still ice star.
>
> Row 4 (6 frames) – Idle Drift F2 (#ff44cc): Begin with magenta-red (#ff44cc) tendrils just leaving the core. Tendrils grow and whip, homing spirals around the points more aggressive than Form 1, the core lurches off-center then snaps back. Later frames the tendrils are on the opposite side. Final frame is a whipped tendril hold. Not a still magenta star.
>
> Row 5 (6 frames) – Idle Weave F2 (#ffaa00): Begin with points in a slight yaw, gold-orange (#ffaa00). Points hitch through sharp erratic arcs, gold-orange sparks trail the broken halo edges (sparks stay on the halo). The whole star jitters. Later frames the yaw is opposite. Final frame is mid-erratic hitch. Not a still gold star.
>
> Row 6 (6 frames) – Idle Creep F2 (#aaff88): Begin with the body forward-tilted, sickly-green (#aaff88) burning along every fracture line. The green travels along the cracks (bright bands moving), the tilt increases then holds, all points stay rigid. Later frames more fracture lines are lit than in frame 1. Final frame is the maximum forward tilt, every crack burning. A charge cycle, not a still green star.
>
> Row 7 (6 frames) – Idle Apex F2 (#ffeecc): Begin with top points rising, cream-white (#ffeecc). Top points climb toward vertical, a blazing wide orb of energy builds at the crown (the crown fattens). Lower points retract. Later frames the crown orb is clearly larger. Final frame is near-vertical top points, crown blazing. Not a still white star.
>
> Style: pixel-art sprite sheet, corrupted cosmic void boss, consistent proportions, centered silhouette, evenly spaced frames, no cropping, no overlap.
> END OF PROMPT;

#### Sheet 4: Form 2 — Attacks (`zenith-form2-attack-sheet.png`)

**File target:** `images/enemies/zenith-form2-attack-sheet.png` (1024×1024)

**Prompt:**
> Clean 2D pixel-art sprite sheet, video game raid boss enraged form attacking.
> 7 rows × 8 columns (56 frames), perfectly aligned grid, transparent background.
>
> Character: Zenith Form 2 — cracked jagged star, blazing white-red eyes, fractured erratic halos. All attacks more explosive than Form 1. Not a humanoid. Points crack further as they fire; halos shatter and reform; the core changes size every few frames.
>
> Row 1 (8 frames) – Arc F2 (#66bbff): Begin at rest, cracked tips electric-blue. Early frames a point sweeps and the crack along it widens. Mid-row an electric arc-orb fires with a shock-ring recoil and a short afterimage of the point. Later frames the point snaps back to rest length. Final frame is the snapped-back rest, crack still glowing. Sweep, fire, and snap-back must differ.
>
> Row 2 (8 frames) – Wait F2 (#aa44ff): Begin expanded. The star fully compresses, purple imploding. Mid-row a massive vortex explodes outward violently (a growing ring). Later frames a shockwave ring dissipates around a still-compressed core. Final frame is the post-blast compressed star, ring almost gone. Compress, explode, and dissipate are three silhouettes.
>
> Row 3 (8 frames) – Drop F2 (#aaeeff): Begin at rest. Points arch back, ice-white gathering. Mid-row large ice-white slash clusters materialize on the arched points and fall in a rapid dense sequence. Later frames the star snaps upright. Final frame is the snapped-upright rest. Arch and snap-upright are opposite.
>
> Row 4 (8 frames) – Drift F2 (#ff44cc): Begin at rest. Two points extend together, a large spinning hot-pink orb forms between/at the tips. Mid-to-late the orb fires aggressively tracking right, both points recoil. Final frame is the double-point retract. Extend, spin, and fire must not be one still.
>
> Row 5 (8 frames) – Weave F2 (#ffaa00): Begin at rest. A point sweeps with gold-orange sparks along the edge. Mid-row a blade-shot fires in an erratic burst with afterimages of the point and a short impact aura at the tip. Later frames the point returns. Final frame is the returned rest. Sweep, burst, and return differ.
>
> Row 6 (8 frames) – Creep F2 (#aaff88): Begin tilting. The star leans near-horizontal, sickly-green energy locking along one point. Mid-row a vicious spike fires with visible recoil (the whole star kicks backward). Later frames it rights itself. Final frame is the reset upright, crack still green. Lean, fire, and righting are three poses.
>
> Row 7 (8 frames) – Apex F2 (#ffeecc): Begin at rest. Top points slam upward, a massive blazing cream-white orb forms at the crown. Mid-row the orb fires with full thrust, the lower points streaming backward. Later frames a dramatic hold — crown still huge, eyes blazing. Final frame is that dramatic hold, not a rest. Slam, fire, and hold must differ.
>
> Style: pixel-art sprite sheet, corrupted cosmic void boss attack, consistent proportions, centered silhouette, evenly spaced frames, no cropping, no overlap.
> END OF PROMPT;

---

### Seraphel, the Severed Light (Boss — 6 Sprite Sheets)

Seraphel is a fallen angel boss with 6 separate sprite sheets for different animation states:

#### Sheet 1: Idle (`seraphel-idle-sheet.png`)

**File target:** `images/enemies/seraphel-idle-sheet.png` (1024×1024)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 6 columns (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Seraphel, the Severed Light — a fallen angel of divine judgment. Tall armored humanoid figure in white-gold plate armor with ornate filigree, 6 wings made of golden light extending from the back (3 per side, slightly broken/cracked at tips), a rotating golden halo floating above the head, glowing golden eyes, a long blade of pure condensed light held in the right hand. Dimensions: 70×90 pixels in-game.
>
> Row 1 (6 frames) – Idle: Begin hovering in place, boots a few pixels off the implied floor, six golden-light wings half-spread, halo level, light blade held at the side. Across all six frames the wings gently pulse (inner wings tuck as outer wings open, then reverse), the halo slowly rotates (ornament marks travel), the blade’s edge shimmers bright then dims, armor filigree catches a traveling highlight, small golden particles drift upward from the boots. Later frames the halo has turned and a different wing pair is at peak spread. Final frame is the hover mid-pulse, loop-friendly. This must look like a living hover, not six copies of one still.
>
> Row 2 (6 frames) – Idle variant: Begin in the same hover as Row 1’s start, then the wings shift to a different stack (upper pair higher, lower pair tucked), the head tilts a few degrees, the light blade pulses brighter then dims more than Row 1. Progressive: tilt increases, then eases. Final frame is the variant hover with head mid-tilt, blade mid-dim, loop-friendly. Not a duplicate of Row 1 and not a still.
>
> Row 3 (6 frames) – Idle combat ready: Begin from a relaxed hover. Early frames Seraphel raises the light blade to a guard position (blade diagonal across the chest), wings spread wider than Row 1, halo spin visibly faster, eyes glow brighter, armor plates shift at the shoulders, particle effects intensify around the boots. Later frames hold and micro-adjust the guard — the blade tip dips then steadies. Final frame is the full combat-ready guard, wings wide, halo fast. Late guard must not match the early relaxed start.
>
> Row 4 (6 frames) – Idle to alert transition: Begin in the combat-ready guard. Seraphel turns the torso slightly toward the viewer-right, wings flare outward past the guard spread, the halo tilts, the blade extends forward from guard to a point, golden energy crackles along armor seams (on the armor only). Progressive turn and flare. Final frame is the alert point: blade forward, wings flared, halo tilted. This is a one-way transition, not a loop of one pose.
>
> Style: clean digital pixel-art sprite sheet, epic celestial boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Sheet 2: Walk/Glide (`seraphel-walk-sheet.png`)

**File target:** `images/enemies/seraphel-walk-sheet.png` (1024×1024)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 6 columns (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Seraphel, the Severed Light — fallen angel boss in white-gold plate armor, 6 golden light wings (3 per side), rotating halo, glowing golden eyes, light blade weapon.
>
> Row 1 (6 frames) – Forward glide: Begin upright hover. Seraphel glides forward through the air: the six wings beat slowly for propulsion (downstroke then upstroke across the row), the torso leans a few degrees, armor gleaming as the highlight travels, the light blade trails golden sparks along its edge, the halo stays level and rotating. Later frames are a different wing-beat phase than early frames. Final frame continues the beat so the glide can loop. This must look like actual wing-powered travel, not a standing hover with one foot slid forward.
>
> Row 2 (6 frames) – Fast advance: Begin from a mild lean. Wings beat harder (bigger amplitude), the body leans farther forward, the light blade extends back along the line of motion, a trailing golden streak clings to the blade, the halo tilts forward, armor plates streamline (pauldron and skirt flatten). Progressive acceleration-pose across the row. Final frame is the full fast-advance lean, wings mid-power-stroke. Not a still lean.
>
> Row 3 (6 frames) – Strafe / circle: Begin upright. Seraphel moves laterally: leading-side wings tuck, trailing-side wings extend, the blade is held across the body, a golden trail curves behind the hips (on-body only). The torso yaws as if circling. Later frames the wing asymmetry is more extreme. Final frame is the full strafe, trail curving, still facing right. This must look like sideways travel, not a standing pose with wings redrawn.
>
> Row 4 (6 frames) – Retreat / reposition: Begin from a forward lean. Wings spread wide for braking, the body leans back, the blade comes up to a defensive guard, golden energy pulses outward from the armor as afterimage particles trail the previous lean (particles stay in the cell). Progressive brake. Final frame is the braked back-lean, wings wide, blade defensive. Early forward lean and late brake are opposite.
>
> Style: clean digital pixel-art sprite sheet, epic celestial boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Sheet 3: Attack (`seraphel-attack-sheet.png`)

**File target:** `images/enemies/seraphel-attack-sheet.png` (1024×1024)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy.
> 4 rows and 10 columns (40 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Seraphel, the Severed Light — fallen angel boss in white-gold armor, 6 golden light wings, rotating halo, light blade. 10 columns per row for complex boss attack animations.
>
> Row 1 (10 frames) – Blink Strike: Begin solid in a hover-guard. Frames 1–3 Seraphel dissolves into golden light particles — armor and wings break into motes, the silhouette thinning until nearly empty. Frames 4–6 the body reappears behind the implied target (still facing right) with the blade already raised overhead, wings snapping open, halo reforming. Frames 7–9 the blade slashes downward in a wide golden arc, torso rotating, wings driving the cut. Frame 10 is the follow-through with a fading afterimage of the slash pose, blade low. Dissolve, reappear, slash, and afterimage must be different silhouettes — not a still slash held for ten frames.
>
> Row 2 (10 frames) – Halo Blades: Begin with the halo rotating at normal height. Frames 1–3 the halo stops rotating and rises above the head, Seraphel’s arms lowering, eyes brightening. Frames 4–7 the halo splits into 12 spinning golden blade fragments that orbit the body (they stay in the cell, around Seraphel). Frames 8–9 the blades launch outward in all directions (short outgoing streaks still in-cell). Frame 10 a new intact halo reforms above the head, fragments gone. Rise, orbit, launch, and reform must not be one pose.
>
> Row 3 (10 frames) – Radiant Rush: Begin hovering upright. Frames 1–3 the wings flare and the body crouches, boots gathering under the hips, blade back. Frames 4–5 golden energy charges along the blade (the blade thickens and brightens). Frames 6–8 an explosive forward dash, body stretched, a golden trail clinging to the armor. Frames 9–10 a skid and recovery pose, wings braking, blade coming back to guard. Crouch, charge, dash, and skid are four different poses.
>
> Row 4 (10 frames) – Skyfall Spears: Begin with both arms at the sides. Frames 1–3 the left hand rises toward the sky, head tipping back, wings cupping upward. Frames 4–6 golden spear shapes form above the raised hand (short spear silhouettes in the top of the cell, attached to the cast). Frames 7–9 the hand sweeps down and the spears rain from above (spears travel downward through the cell). Frame 10 the arm returns to neutral, spears gone. Raise, form, rain, and recover must progress — not a still raised hand.
>
> Style: clean digital pixel-art sprite sheet, epic celestial boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Sheet 4: Phase 2 Attacks (`seraphel-phase2-sheet.png`)

**File target:** `images/enemies/seraphel-phase2-sheet.png` (1024×1024)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss enemy in corrupted/enraged Phase 2 form.
> 4 rows and 10 columns (40 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Seraphel Phase 2 — same armored angel but now corrupted: armor has orange-red cracks glowing through gold, wings are shattered/jagged with flickering orange-white fragments, halo is cracked and split into two halves orbiting the head, eyes burn red-orange. Light blade is unstable, flickering between gold and orange-red.
>
> Row 1 (10 frames) – Lightstorm Arena: Begin with arms down. Frames 1–3 both arms spread wide, the body surrounded by a swirling light storm that clings to the armor and jagged wings (storm stays on-body / in-cell). Frames 4–7 the storm intensifies, bolts raining down along the silhouette, cracks in the armor brightening. Frames 8–9 an explosive pulse sends golden-orange bolts across the cell from the chest. Frame 10 the storm subsides, arms still wide but dimmer. Spread, intensify, pulse, and subside must differ — not a still storm pose.
>
> Row 2 (10 frames) – Judgment Cage: Begin arms at the sides. Frames 1–4 both hands rise and form a golden ring-shape around an implied target area (the ring is held between the hands, in-cell). Frames 5–7 the hands pull inward as a ring of light pillars constricts (pillars sit in the cell around the lower body). Frames 8–9 the pillars explode inward with a massive flash, Seraphel’s cracks blazing. Frame 10 the cage dissipates, hands lowering. Form, constrict, explode, and dissipate are four silhouettes.
>
> Row 3 (10 frames) – Core Overload: Begin upright. Frames 1–4 the body curls inward, broken wings folding around the torso, blade tucking, split halo tightening. Frames 5–7 an intense golden-orange glow builds at the center, the curled silhouette brightening until the armor is a shell of light. Frames 8–9 a massive explosion outward shatters that energy shell, wings blasting open. Frame 10 recovery as the wings re-extend, body opening. Curl, build, explode, and recover must not be one pose.
>
> Row 4 (10 frames) – Divine Rush Combo: Frames 1–2 a dash forward, body stretched, jagged wings swept back. Frames 3–6 a rapid 3-slash sequence, the unstable blade trailing orange arcs — each slash a different blade angle and torso twist (slash 1 horizontal, slash 2 rising, slash 3 downward). Frame 7 a leap upward, boots leaving the bottom of the pose, blade overhead. Frames 8–9 an overhead slam creating a short shockwave ring at the feet. Frame 10 landing recovery, knees bent, wings settling. Dash, slashes, leap, slam, and land are distinct — not a still combo pose held for ten frames.
>
> Style: clean digital pixel-art sprite sheet, corrupted celestial boss style, consistent character proportions across every frame, side-view facing right, clear readable silhouette, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

#### Sheet 5: Wings Detail (`seraphel-wings-sheet.png`)

**File target:** `images/enemies/seraphel-wings-sheet.png` (1024×512)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for boss wing overlay animations.
> 2 rows and 8 columns (16 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Wings for Seraphel, the Severed Light — 6 wings of pure golden light, 3 per side. Each wing is made of translucent golden energy with feather-like light rays at the edges. No body, no halo, no blade — wings only.
>
> Row 1 (8 frames) – Phase 1 Wings: A full beat cycle of intact golden light wings, all 6 visible, translucent golden glow. Frame 1 is folded close to an implied back. Frames 2–3 slightly spread, the upper pair leading. Frames 4–5 fully extended with a bright glow, feather-rays longest. Frames 6–7 beat downward (the wings travel through a downstroke, tips below the midline). Frame 8 returns toward folded, ready to loop. This must look like an actual wing beat, not eight still spreads. Later frames differ from early frames.
>
> Row 2 (8 frames) – Phase 2 Wings: The same eight positions as Row 1 — folded, slight spread, full extend, downbeat, return — but shattered and damaged: broken at the tips with jagged edges, flickering between gold and orange-red, trailing loose energy fragments that stay in the cell, some wing segments missing or detached and orbiting nearby. Progressive deterioration across the frames: frame 1 is cracked but mostly whole, later frames lose more segments, frame 8 is the most incomplete, fragments still orbiting. Do not draw a second pair of intact wings. The beat still happens; it is not a still ruined pose.
>
> Style: clean digital pixel-art sprite sheet, celestial energy wing overlay, consistent proportions, transparent golden glow effects, no cropping, no overlapping frames.
> END OF PROMPT;

#### Sheet 6: Defeat (`seraphel-defeat-sheet.png`)

**File target:** `images/enemies/seraphel-defeat-sheet.png` (1024×1024)

**Prompt:**
> Clean 2D pixel-art style sprite sheet for a video game boss death sequence.
> 4 rows and 6 columns (24 frames total) arranged in a perfectly aligned grid with even spacing.
> Transparent background.
>
> Character: Seraphel, the Severed Light (Phase 2 corrupted form) — fallen angel boss dying after defeat.
>
> Row 1 (6 frames) – Final blow impact: Play-once. Frames 1–2 Seraphel staggers back, jagged wings collapsing inward, split halo wobbling, orange-red cracks flashing. Frames 3–4 the armor cracks widen and golden-orange light pours out of the seams, the torso arching. Frames 5–6 the unstable blade dissolves into sparks in the hand, fingers opening on empty air. Final frame is the stagger with an empty hand, light pouring from the cracks. Stagger, rupture, and blade-loss must progress — not one hit pose.
>
> Row 2 (6 frames) – Wings shatter: Play-once, continuing from Row 1’s broken wings. Frames 1–3 remaining wing fragments burst apart one by one (upper pair first, then mid, then lower), the silhouette shrinking. Frames 4–5 golden feather particles scatter in all directions inside the cell. Frame 6 the halo fragments spin away from the head. Final frame is a nearly wingless armored body with halo shards leaving. Early winged stagger and late wingless body must differ.
>
> Row 3 (6 frames) – Body dissolving: Play-once. Frames 1–3 armor plates fall away (they stay in-cell as falling plates) revealing pure light underneath, the humanoid shape still readable. Frames 4–6 the body dissolves upward into golden particles, an ethereal silhouette remaining briefly, the cracked halo gone. Final frame is a faint light-silhouette, plates at the bottom of the cell. Plated body and light-silhouette are different.
>
> Row 4 (6 frames) – Final ascension: Play-once. Frames 1–3 the remaining light form rises toward the top of the cell, particles streaming up. Frames 4–5 an explosion of golden particles that leaves no body behind. Frame 6 is empty space with only fading golden sparkles. Final frame must be nearly empty — not a standing angel. Do not loop this row.
>
> Style: clean digital pixel-art sprite sheet, epic celestial boss death sequence, consistent character proportions across every frame, side-view facing right, evenly spaced animation frames, no cropping, no overlapping frames.
> END OF PROMPT;

## Notes

- Current assets are JPG images in `images/backgrounds`.
- If you regenerate images in another format (`.png`/`.webp`), update the file references in `index.html` to match.
- Keep image file names the same base names to avoid changing CSS selectors.
