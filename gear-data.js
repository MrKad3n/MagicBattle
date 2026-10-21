/* =============================================================
   GEAR DATA — dungeon equipment, variants, gems, corruptions
   Data only. Runtime lives in gear-system.js.
   ============================================================= */
(function (global) {
	'use strict';

	function I(def) { return def; }

	const ITEMS = {
		/* ---------- MYTHIC (preserved) ---------- */
		lightstep_blade: I({
			name: 'Lightstep Blade', type: 'staff', icon: '⚔️', rarity: 'mythic', dungeon: 'special',
			stats: { magicPower: 25, magicControl: 12, manaRegen: 30, strength: 10 },
			desc: 'A blade of severed light from Seraphel. Warriors gain Backstep anchors on melee attacks — press B to warp back.',
			effectText: 'Mythic Seraphel relic. Warriors leave Backstep anchors on melee attacks. Its power feeds straight into every rune you cast.',
			effects: [], tags: ['mythic', 'special'], gemSlots: 2, variantPool: []
		}),
		void_nullification: I({
			name: 'Void Nullification', type: 'relic', icon: '🌑', rarity: 'mythic', dungeon: 'special',
			stats: { magicPower: 30, magicControl: 15, manaRegen: 40, magicDefence: 12 },
			desc: 'A mythic relic forged from the defeated Void Arbiter\'s essence. Nullifies void energy around the wielder.',
			effectText: 'Mythic Void Arbiter relic. Its Magic Power and Defence scale every rune spell you cast and ward you from enemy magic.',
			effects: [], tags: ['mythic', 'special'], gemSlots: 2, variantPool: []
		}),
		chrono_shard: I({
			name: 'Chrono Shard', type: 'relic', icon: '⏳', rarity: 'mythic', dungeon: 'special',
			stats: { magicPower: 25, magicControl: 20, manaRegen: 35, magicDefence: 10 },
			desc: 'A fragment of shattered time torn from the Chrono Tyrant. Grants temporal power to your rune spells.',
			effectText: 'Mythic Chrono Tyrant relic.',
			effects: [], tags: ['mythic', 'special'], gemSlots: 2, variantPool: []
		}),

		/* ===================== FIRE ===================== */
		cinderwood_wand: I({
			name: 'Cinderwood Wand', type: 'staff', icon: '🪄', rarity: 'common', dungeon: 'fire',
			stats: { magicPower: 5, manaRegen: 3 },
			desc: 'A simple early-game offensive staff. Its Magic Power makes every rune spell hit harder.',
			effectText: 'None.',
			effects: [], tags: ['fire', 'staff', 'offense'], gemSlots: 2,
			variantPool: ['focused']
		}),
		scorched_apprentice_robes: I({
			name: 'Scorched Apprentice Robes', type: 'robe', icon: '👘', rarity: 'common', dungeon: 'fire',
			stats: { magicPower: 4, magicControl: 3, magicDefence: 2, strength: 2 },
			desc: 'A balanced starter piece for players who want a little of everything.',
			effectText: 'None.',
			effects: [], tags: ['fire', 'robe'], gemSlots: 2,
			variantPool: ['offensive']
		}),
		coalheart_charm: I({
			name: 'Coalheart Charm', type: 'relic', icon: '🪨', rarity: 'common', dungeon: 'fire',
			stats: { manaRegen: 5, magicDefence: 2, strength: 2 },
			desc: 'Simple sustain-oriented gear.',
			effectText: 'None.',
			effects: [], tags: ['fire', 'relic', 'sustain'], gemSlots: 2,
			variantPool: ['lingering']
		}),
		embercoil_staff: I({
			name: 'Embercoil Staff', type: 'staff', icon: '🔥', rarity: 'uncommon', dungeon: 'fire',
			stats: { magicPower: 7, manaRegen: 5 },
			desc: 'Rewards a fast casting rhythm.',
			effectText: 'Heat: After casting three spells within 3.5 seconds, your next spell deals +12% damage (every hit of that cast). The counter resets after the bonus activates.',
			effects: [{ type: 'castWindowBonus', casts: 3, windowSec: 3.5, damage: 0.12 }],
			tags: ['fire', 'staff', 'heat', 'aggression'], gemSlots: 2,
			variantPool: ['empowered', 'momentum', 'reduced_cd']
		}),
		magmaweave_mantle: I({
			name: 'Magmaweave Mantle', type: 'robe', icon: '🧥', rarity: 'uncommon', dungeon: 'fire',
			stats: { magicDefence: 6, magicPower: 5, magicControl: 4, strength: 4 },
			desc: 'A small taste of Fire\'s risk/reward identity.',
			effectText: 'While below 50% HP, your rune spells deal +8% damage.',
			effects: [{ type: 'lowHpDamage', hpPct: 0.5, damage: 0.08 }],
			tags: ['fire', 'robe', 'desperation'], gemSlots: 2,
			variantPool: ['desperation', 'empowered', 'defensive']
		}),
		emberheart_ring: I({
			name: 'Emberheart Ring', type: 'relic', icon: '💍', rarity: 'uncommon', dungeon: 'fire',
			stats: { manaRegen: 8, magicPower: 3, strength: 3 },
			desc: 'Fire elemental builds get better sustain without making the item universally powerful.',
			effectText: 'Enemies that die while Burning (Thermal heat) restore 6 energy.',
			effects: [{ type: 'manaOnBurningKill', mana: 6 }],
			tags: ['fire', 'relic', 'burn', 'sustain'], gemSlots: 2,
			variantPool: ['empowered', 'lingering']
		}),
		volcanic_channeler: I({
			name: 'Volcanic Channeler', type: 'staff', icon: '🌋', rarity: 'rare', dungeon: 'fire',
			stats: { magicPower: 11, magicControl: 6, manaRegen: 7 },
			desc: 'Big, expensive rune spells. Pairs well with high Energy Control.',
			effectText: 'Overcast: Spells costing more than 100 energy deal +15% damage.',
			effects: [{ type: 'overcast', manaThreshold: 100, damage: 0.15 }],
			tags: ['fire', 'staff', 'control'], gemSlots: 2,
			variantPool: ['empowered', 'sacrifice', 'opening', 'focused']
		}),
		ashen_warcloak: I({
			name: 'Ashen Warcloak', type: 'robe', icon: '🧣', rarity: 'rare', dungeon: 'fire',
			stats: { magicPower: 9, magicDefence: 9, magicControl: 5, strength: 8 },
			desc: 'A panic-button item rather than a constant DPS boost.',
			effectText: 'Last Ember: When you fall below 25% HP, your next spell within 5 seconds costs no energy. Cooldown: 30 seconds.',
			effects: [{ type: 'lastEmber', hpPct: 0.25, windowSec: 5, cooldownSec: 30 }],
			tags: ['fire', 'robe', 'panic'], gemSlots: 2,
			variantPool: ['reduced_cd', 'desperation', 'defensive', 'empowered']
		}),
		infernal_furnace_core: I({
			name: 'Furnace Core', type: 'relic', icon: '🔶', rarity: 'rare', dungeon: 'fire',
			stats: { manaRegen: 12, magicPower: 6, magicDefence: 4 },
			desc: 'Long encounters and spell-heavy builds.',
			effectText: 'Every 10th spell you cast releases a small burst of fire around you.',
			effects: [{ type: 'nthCastBurst', n: 10, kind: 'fireRing', power: 16, radius: 72 }],
			tags: ['fire', 'relic', 'burst'], gemSlots: 2,
			variantPool: ['reduced_cd', 'expanded', 'echo', 'chain']
		}),
		pyroclast_staff: I({
			name: 'Pyroclast Staff', type: 'staff', icon: '☄️', rarity: 'epic', dungeon: 'fire',
			stats: { magicPower: 17, magicControl: 9, manaRegen: 10 },
			desc: 'Built for spells that Divide or Split their energy into many pieces.',
			effectText: 'Critical Mass: Spells whose energy is divided into 3 or more pieces deal +20% damage. At 6 or more pieces the bonus becomes +30%.',
			effects: [{ type: 'countDamage', count: 3, bonus: 0.20, countHigh: 6, bonusHigh: 0.30 }],
			tags: ['fire', 'staff', 'count'], gemSlots: 2,
			variantPool: ['empowered', 'spell_type', 'focused', 'momentum', 'execution']
		}),
		infernal_heartplate: I({
			name: 'Infernal Heartplate', type: 'robe', icon: '❤️‍🔥', rarity: 'epic', dungeon: 'fire',
			stats: { magicDefence: 13, magicPower: 13, magicControl: 7, strength: 12 },
			desc: 'Get hit, then immediately retaliate.',
			effectText: 'Blood for Fire: Taking damage empowers your next spell by +20% (all of its hits). Cooldown: 5 seconds.',
			effects: [{ type: 'retaliateCharge', damage: 0.20, cooldownSec: 5 }],
			tags: ['fire', 'robe', 'reactive'], gemSlots: 2,
			variantPool: ['empowered', 'reduced_cd', 'offensive', 'desperation', 'reactive']
		}),
		magma_prism: I({
			name: 'Magma Prism', type: 'relic', icon: '🔺', rarity: 'epic', dungeon: 'fire',
			stats: { magicPower: 12, manaRegen: 12, magicControl: 8 },
			desc: 'Encourages alternating a Thermal spell with something different.',
			effectText: 'Scorching Echo: When one of your spells applies Burn (Thermal heat), the next different spell you cast deals +15% damage. The effect cannot stack.',
			effects: [{ type: 'scorchingEcho', damage: 0.15 }],
			tags: ['fire', 'relic', 'burn', 'rotation'], gemSlots: 2,
			variantPool: ['empowered', 'lingering', 'chain', 'momentum', 'conversion']
		}),
		heart_of_the_caldera: I({
			name: 'Heart of the Caldera', type: 'staff', icon: '🌋', rarity: 'legendary', dungeon: 'fire',
			stats: { magicPower: 25, magicControl: 12, manaRegen: 15, strength: 9 },
			desc: 'General offensive build with periodic burst. Eruptions do not need a Thermal spell.',
			effectText: 'Eruption: Every 8th damaging hit creates a delayed volcanic eruption beneath the target. Deals significant fire damage in a small area and briefly knocks enemies upward.',
			effects: [{ type: 'nthDamagingErupt', n: 8, kind: 'volcano', delaySec: 0.55, power: 46, radius: 62, knockUp: 30 }],
			tags: ['fire', 'staff', 'eruption', 'burst'], gemSlots: 2,
			variantPool: ['molten', 'volatile', 'infernal', 'seismic', 'overheated', 'chainfire', 'scorching']
		}),
		crown_of_the_inferno: I({
			name: 'Crown of the Inferno', type: 'relic', icon: '👑', rarity: 'legendary', dungeon: 'fire',
			stats: { magicPower: 20, magicControl: 14, magicDefence: 10, strength: 10 },
			desc: 'Rewards constant aggression.',
			effectText: 'Unrelenting Flame: While continuously casting spells, gain one stack of Heat every 2 seconds. Each stack gives +3% spell damage. Maximum 5 stacks. Taking no action for 4 seconds removes all stacks.',
			effects: [{ type: 'heatStacks', everySec: 2, perStack: 0.03, max: 5, dropSec: 4 }],
			tags: ['fire', 'relic', 'heat', 'aggression'], gemSlots: 2,
			variantPool: ['empowered', 'momentum', 'desperation', 'lingering', 'sacrifice', 'critical']
		}),
		ashen_pact: I({
			name: 'Ashen Pact', type: 'relic', icon: '🖤', rarity: 'cursed', dungeon: 'fire',
			stats: { magicPower: 30, magicControl: 18, manaRegen: 10, strength: 14 },
			desc: 'Your energy is fuel. Cast, deal damage, recover energy, cast again.',
			effectText: 'Curse — Your Energy Is Fuel: You no longer regenerate energy normally. Spell damage restores 8% of the damage dealt as energy. Reaching 0 energy drains 4 HP every second until you regain some.',
			curseText: 'Normal energy regeneration is disabled. At 0 energy you lose HP every second.',
			effects: [{ type: 'ashenPact', restorePct: 0.08, drainHp: 4 }],
			tags: ['fire', 'relic', 'cursed', 'mana'], gemSlots: 2,
			variantPool: ['emberfueled', 'bloodfuel', 'overburn'],
			isCursed: true
		}),

		/* ===================== ICE ===================== */
		frostglass_wand: I({
			name: 'Frostglass Wand', type: 'staff', icon: '🧊', rarity: 'common', dungeon: 'ice',
			stats: { magicPower: 5, magicControl: 4 },
			desc: 'A precise starter staff with no gimmick.',
			effectText: 'None.',
			effects: [], tags: ['ice', 'staff'], gemSlots: 2, variantPool: ['focused']
		}),
		frostbound_vestments: I({
			name: 'Frostbound Vestments', type: 'robe', icon: '🧥', rarity: 'common', dungeon: 'ice',
			stats: { magicDefence: 5, manaRegen: 3, strength: 3 },
			desc: 'Simple icy protection.',
			effectText: 'None.',
			effects: [], tags: ['ice', 'robe'], gemSlots: 2, variantPool: ['defensive']
		}),
		icicle_pendant: I({
			name: 'Icicle Pendant', type: 'relic', icon: '❄️', rarity: 'common', dungeon: 'ice',
			stats: { magicControl: 5, manaRegen: 3 },
			desc: 'A cold charm for careful casters.',
			effectText: 'None.',
			effects: [], tags: ['ice', 'relic', 'control'], gemSlots: 2, variantPool: ['lingering']
		}),
		rimecaster: I({
			name: 'Rimecaster', type: 'staff', icon: '🌨️', rarity: 'uncommon', dungeon: 'ice',
			stats: { magicPower: 7, magicControl: 6 },
			desc: 'Simple elemental specialization.',
			effectText: 'Freeze and chill from your Reverse Thermal (cold) spells last 5% longer.',
			effects: [{ type: 'freezeDuration', bonus: 0.05 }],
			tags: ['ice', 'staff', 'freeze'], gemSlots: 2,
			variantPool: ['permafrost', 'empowered', 'lingering']
		}),
		snowveil_robes: I({
			name: 'Snowveil Robes', type: 'robe', icon: '👘', rarity: 'uncommon', dungeon: 'ice',
			stats: { magicDefence: 7, magicControl: 5 },
			desc: 'Rewards staying untouched.',
			effectText: 'After avoiding damage for 4 seconds, gain a small temporary shield. The shield disappears when damaged.',
			effects: [{ type: 'untouchedShield', delaySec: 4, amount: 18 }],
			tags: ['ice', 'robe', 'defense'], gemSlots: 2,
			variantPool: ['bastion', 'lingering', 'empowered']
		}),
		glacier_tear: I({
			name: 'Glacier Tear', type: 'relic', icon: '💧', rarity: 'uncommon', dungeon: 'ice',
			stats: { manaRegen: 7, magicDefence: 5 },
			desc: 'Turns incoming hits into cheaper replies.',
			effectText: 'When you are hit, your next spell costs 15% less energy. Cooldown: 8 seconds.',
			effects: [{ type: 'hitCheaperSpell', costMult: 0.85, cooldownSec: 8 }],
			tags: ['ice', 'relic', 'reactive'], gemSlots: 2,
			variantPool: ['reduced_cd', 'empowered', 'reactive']
		}),
		permafrost_scepter: I({
			name: 'Permafrost Scepter', type: 'staff', icon: '🔷', rarity: 'rare', dungeon: 'ice',
			stats: { magicPower: 10, magicControl: 10, manaRegen: 5 },
			desc: 'Rewards spell sequencing.',
			effectText: 'Deep Freeze: Your hits deal +20% damage to enemies that are already chilled or Frozen.',
			effects: [{ type: 'alreadyFrozenBonus', damage: 0.20 }],
			tags: ['ice', 'staff', 'freeze', 'setup'], gemSlots: 2,
			variantPool: ['empowered', 'deep_freeze', 'glacial', 'execution']
		}),
		cryomancer_mantle: I({
			name: 'Cryomancer\'s Mantle', type: 'robe', icon: '🧥', rarity: 'rare', dungeon: 'ice',
			stats: { magicDefence: 10, magicControl: 8, manaRegen: 5 },
			desc: 'Niche: anchored, zone and construct casters.',
			effectText: 'You take 15% less damage while one of your anchored, zone, construct or slowed spells is active.',
			effects: [{ type: 'slowCastDefense', reduction: 0.15 }],
			tags: ['ice', 'robe', 'stationary', 'defense'], gemSlots: 2,
			variantPool: ['bastion', 'stillwater', 'defensive', 'lingering']
		}),
		frozen_hourglass: I({
			name: 'Frozen Hourglass', type: 'relic', icon: '⏳', rarity: 'rare', dungeon: 'ice',
			stats: { magicControl: 8, manaRegen: 10 },
			desc: 'Big, carefully built spells rather than spam.',
			effectText: 'Time to Breathe: Spells built from 8 or more runes recover 25% faster.',
			effects: [{ type: 'longCooldownTrim', minRunes: 8, trim: 0.25 }],
			tags: ['ice', 'relic', 'cooldown'], gemSlots: 2,
			variantPool: ['reduced_cd', 'empowered', 'opening', 'sacrifice']
		}),
		absolute_frost_staff: I({
			name: 'Absolute Frost Staff', type: 'staff', icon: '🧊', rarity: 'epic', dungeon: 'ice',
			stats: { magicPower: 18, magicControl: 11, manaRegen: 7 },
			desc: 'Makes Freeze a setup tool rather than simply crowd control.',
			effectText: 'Brittle: Chilled or Frozen enemies take +20% damage from your next hit. The Freeze is removed when the bonus damage occurs.',
			effects: [{ type: 'brittle', damage: 0.20 }],
			tags: ['ice', 'staff', 'freeze', 'setup'], gemSlots: 2,
			variantPool: ['shatter', 'empowered', 'focused', 'glacial', 'execution']
		}),
		colossus_mantle: I({
			name: 'Colossus Mantle', type: 'robe', icon: '🏔️', rarity: 'epic', dungeon: 'ice',
			stats: { magicDefence: 17, magicControl: 8, manaRegen: 7, strength: 14 },
			desc: 'Extremely good for difficult content without being universally offensive.',
			effectText: 'Frozen Resolve: The first time you would fall below 25% HP, gain a shield equal to 20% of max HP. Cooldown: 60 seconds.',
			effects: [{ type: 'panicShield', hpPct: 0.25, shieldPct: 0.20, cooldownSec: 60 }],
			tags: ['ice', 'robe', 'defense'], gemSlots: 2,
			variantPool: ['bastion', 'reduced_cd', 'crystal', 'defensive', 'lingering']
		}),
		mirror_of_still_water: I({
			name: 'Mirror of Still Water', type: 'relic', icon: '🪞', rarity: 'epic', dungeon: 'ice',
			stats: { magicControl: 13, manaRegen: 10, magicPower: 6 },
			desc: 'Niche: stationary precision casters.',
			effectText: 'Reflection: Every 12 seconds, if you have not moved for at least 1 second, your next spell is mirrored — a second copy is cast at 50% of its energy.',
			effects: [{ type: 'stillDuplicate', stillSec: 1, cooldownSec: 12, damage: 0.50 }],
			tags: ['ice', 'relic', 'stationary', 'precision'], gemSlots: 2,
			variantPool: ['stillwater', 'echo', 'precision', 'empowered', 'focused']
		}),
		crown_of_permafrost: I({
			name: 'Crown of Permafrost', type: 'staff', icon: '👑', rarity: 'legendary', dungeon: 'ice',
			stats: { magicPower: 24, magicControl: 15, manaRegen: 12 },
			desc: 'Builds Frozen Momentum through successful freezes.',
			effectText: 'Frozen Momentum: Whenever you Freeze an enemy, gain one stack. Each stack gives +4% spell damage and +2% Redirect speed. Maximum 5 stacks. Stacks decay individually after 6 seconds.',
			effects: [{ type: 'frozenMomentum', perDamage: 0.04, perSpeed: 0.02, max: 5, decaySec: 6 }],
			tags: ['ice', 'staff', 'freeze', 'momentum'], gemSlots: 2,
			variantPool: ['permafrost', 'glacial', 'momentum', 'empowered', 'lingering', 'deep_freeze']
		}),
		absolute_zero_raiment: I({
			name: 'Absolute Zero Raiment', type: 'robe', icon: '🧊', rarity: 'legendary', dungeon: 'ice',
			stats: { magicDefence: 21, magicControl: 12, manaRegen: 10, strength: 16 },
			desc: 'Niche: deliberate turret/caster builds.',
			effectText: 'Stillness: If you remain within a small area for 2 seconds, gain 15% damage reduction, +15% Energy Control, and +20% energy regeneration. Moving removes the bonus.',
			effects: [{ type: 'stillness', stillSec: 2, radius: 36, dr: 0.15, controlPct: 0.15, manaRegenPct: 0.20 }],
			tags: ['ice', 'robe', 'stationary', 'defense'], gemSlots: 2,
			variantPool: ['bastion', 'stillwater', 'crystal', 'permafrost', 'defensive', 'lingering']
		}),
		heart_of_the_eternal_winter: I({
			name: 'Heart of the Eternal Winter', type: 'relic', icon: '💔', rarity: 'cursed', dungeon: 'ice',
			stats: { magicControl: 28, magicDefence: 20, manaRegen: 15 },
			desc: 'Motionless power. Build an almost completely stationary arcane artillery caster.',
			effectText: 'Curse — Motionless Power: +40% spell damage while standing still. Moving continuously for more than 1 second removes the bonus for 3 seconds. Movement speed is reduced by 25%. You gain +10 Energy Control (more rune capacity).',
			curseText: 'You are slower, and leaving your firing position dumps your damage.',
			effects: [{ type: 'frozenHeart', stillDamage: 0.40, moveGraceSec: 1, downSec: 3, movePenalty: 0.25, controlFlat: 10 }],
			tags: ['ice', 'relic', 'cursed', 'stationary'], gemSlots: 2,
			variantPool: ['glacial_lock', 'rimebound', 'crystal_heart'],
			isCursed: true
		}),

		/* ===================== JUNGLE ===================== */
		vinebound_staff: I({
			name: 'Vinebound Staff', type: 'staff', icon: '🌿', rarity: 'common', dungeon: 'earth',
			stats: { magicPower: 5, manaRegen: 4 },
			desc: 'A living staff bound in young vines.',
			effectText: 'None.',
			effects: [], tags: ['jungle', 'staff'], gemSlots: 2, variantPool: ['thorned']
		}),
		mosswoven_cloak: I({
			name: 'Mosswoven Cloak', type: 'robe', icon: '🧥', rarity: 'common', dungeon: 'earth',
			stats: { magicDefence: 5, magicControl: 3, strength: 3 },
			desc: 'Soft moss armor from the deep canopy.',
			effectText: 'None.',
			effects: [], tags: ['jungle', 'robe'], gemSlots: 2, variantPool: ['vinebound']
		}),
		glowseed_charm: I({
			name: 'Glowseed Charm', type: 'relic', icon: '🌱', rarity: 'common', dungeon: 'earth',
			stats: { manaRegen: 6, magicPower: 2 },
			desc: 'A seed that hums with stored sunlight.',
			effectText: 'None.',
			effects: [], tags: ['jungle', 'relic'], gemSlots: 2, variantPool: ['blooming']
		}),
		thornbranch_staff: I({
			name: 'Thornbranch Staff', type: 'staff', icon: '🌵', rarity: 'uncommon', dungeon: 'earth',
			stats: { magicPower: 8, magicControl: 4, manaRegen: 3, strength: 4 },
			desc: 'Jungle\'s aggressive short-range caster.',
			effectText: 'Your hits on enemies within 110 px deal +8% damage.',
			effects: [{ type: 'closeRangeDamage', range: 110, damage: 0.08 }],
			tags: ['jungle', 'staff', 'melee'], gemSlots: 2,
			variantPool: ['thorned', 'distance', 'empowered']
		}),
		sylvan_mantle: I({
			name: 'Sylvan Mantle', type: 'robe', icon: '🧣', rarity: 'uncommon', dungeon: 'earth',
			stats: { magicDefence: 6, magicControl: 6, manaRegen: 4 },
			desc: 'Niche: mobile casters.',
			effectText: 'After moving continuously for 2 seconds, gain +10% energy regeneration for 3 seconds.',
			effects: [{ type: 'moveManaRegen', moveSec: 2, bonus: 0.10, durationSec: 3 }],
			tags: ['jungle', 'robe', 'mobility'], gemSlots: 2,
			variantPool: ['vinebound', 'momentum', 'lingering']
		}),
		wispflower: I({
			name: 'Wispflower', type: 'relic', icon: '🌸', rarity: 'uncommon', dungeon: 'earth',
			stats: { magicControl: 6, manaRegen: 7 },
			desc: 'Simple support niche.',
			effectText: 'Healing from your spells (Target Self, Draw Out) restores 5% more HP.',
			effects: [{ type: 'healBonus', bonus: 0.05 }],
			tags: ['jungle', 'relic', 'heal'], gemSlots: 2,
			variantPool: ['blooming', 'empowered']
		}),
		thorncaller: I({
			name: 'Thorncaller', type: 'staff', icon: '🥀', rarity: 'rare', dungeon: 'earth',
			stats: { magicPower: 11, magicControl: 8, manaRegen: 5 },
			desc: 'Answers incoming hits with thorns.',
			effectText: 'Retaliation: When an enemy hits you, your next spell also fires a small Thorn bolt. Cooldown: 4 seconds.',
			effects: [{ type: 'thornRetaliation', cooldownSec: 4, power: 0.45 }],
			tags: ['jungle', 'staff', 'reactive'], gemSlots: 2,
			variantPool: ['thorned', 'reactive', 'echo', 'empowered']
		}),
		canopywalker_cloak: I({
			name: 'Canopywalker Cloak', type: 'robe', icon: '🍃', rarity: 'rare', dungeon: 'earth',
			stats: { magicDefence: 9, magicControl: 8, manaRegen: 6, strength: 7 },
			desc: 'Interesting risk/reward rather than a flat speed increase.',
			effectText: 'Gain +12% movement speed while above 75% HP. When below 30% HP, instead gain +12% movement speed. The middle health range has no bonus.',
			effects: [{ type: 'edgeMoveSpeed', highPct: 0.75, lowPct: 0.30, bonus: 0.12 }],
			tags: ['jungle', 'robe', 'mobility'], gemSlots: 2,
			variantPool: ['desperation', 'vinebound', 'momentum', 'conditional']
		}),
		sporeheart: I({
			name: 'Sporeheart', type: 'relic', icon: '🍄', rarity: 'rare', dungeon: 'earth',
			stats: { manaRegen: 10, magicControl: 7, magicPower: 4 },
			desc: 'Rewards chaining utility effects.',
			effectText: 'When you cast a spell with a lasting effect (Thermal, Light, Gravity, Bind or a Domain), the next spell costs 10% less energy.',
			effects: [{ type: 'durationEffectDiscount', costMult: 0.90 }],
			tags: ['jungle', 'relic', 'utility'], gemSlots: 2,
			variantPool: ['blooming', 'empowered', 'lingering', 'wild']
		}),
		ancient_root_staff: I({
			name: 'Ancient Root Staff', type: 'staff', icon: '🌳', rarity: 'epic', dungeon: 'earth',
			stats: { magicPower: 16, magicControl: 12, manaRegen: 9 },
			desc: 'Encourages periodically planting yourself rather than permanently standing still.',
			effectText: 'Rooted Casting: If you have not moved for 1 second, your next spell gains +20% size (more energy, wider zones and bursts) and +15% longer Domains. Moving removes the charge.',
			effects: [{ type: 'plantedCharge', stillSec: 1, size: 0.20, duration: 0.15 }],
			tags: ['jungle', 'staff', 'planted'], gemSlots: 2,
			variantPool: ['spreading', 'ancient', 'empowered', 'lingering', 'expanded']
		}),
		treants_bark: I({
			name: 'Treant\'s Bark', type: 'robe', icon: '🪵', rarity: 'epic', dungeon: 'earth',
			stats: { magicDefence: 18, magicControl: 8, manaRegen: 5 },
			desc: 'Hardens after a heavy blow.',
			effectText: 'Barkskin: Taking a large hit grants 20% damage reduction for 3 seconds. Cooldown: 15 seconds.',
			effects: [{ type: 'barkskin', hitPct: 0.12, reduction: 0.20, durationSec: 3, cooldownSec: 15 }],
			tags: ['jungle', 'robe', 'defense'], gemSlots: 2,
			variantPool: ['ancient', 'defensive', 'reduced_cd', 'lingering', 'thorned']
		}),
		verdant_prism: I({
			name: 'Verdant Prism', type: 'relic', icon: '💎', rarity: 'epic', dungeon: 'earth',
			stats: { magicControl: 13, manaRegen: 11, magicPower: 6 },
			desc: 'Great with Divide, Split and other multi-energy spell designs.',
			effectText: 'Growth: Every spell that Divides or Splits its energy grants a Growth stack: your next spell gains +10% size per stack. Maximum 3 stacks.',
			effects: [{ type: 'growthStacks', per: 0.10, max: 3 }],
			tags: ['jungle', 'relic', 'secondary'], gemSlots: 2,
			variantPool: ['spreading', 'blooming', 'empowered', 'wild', 'expanded']
		}),
		worldroot_staff: I({
			name: 'Worldroot Staff', type: 'staff', icon: '🌍', rarity: 'legendary', dungeon: 'earth',
			stats: { magicPower: 23, magicControl: 15, manaRegen: 14 },
			desc: 'Builds around zones, anchored energy, constructs and Domains.',
			effectText: 'Root Network: Whenever you cast a persistent spell (a zone, anchored energy, a construct or a Domain), gain one Root stack. At 3 stacks, your next hit fires a root bolt from your oldest persistent spell. Then the stacks reset.',
			effects: [{ type: 'rootNetwork', stacksNeeded: 3, power: 0.55 }],
			tags: ['jungle', 'staff', 'terrain', 'persistent'], gemSlots: 2,
			variantPool: ['entangling', 'blooming', 'thorned', 'vinebound', 'spreading', 'ancient', 'wild']
		}),
		mantle_of_the_wild_hunt: I({
			name: 'Mantle of the Wild Hunt', type: 'robe', icon: '🦌', rarity: 'legendary', dungeon: 'earth',
			stats: { magicDefence: 18, magicPower: 14, magicControl: 10, strength: 15 },
			desc: 'Creates a range-switching playstyle.',
			effectText: 'Predator: After damaging an enemy from more than moderate distance, gain +15% movement speed for 3 seconds. After damaging an enemy from very close range, gain +15% spell damage for 3 seconds. Only one bonus can be active at a time.',
			effects: [{ type: 'predator', farRange: 220, nearRange: 120, speed: 0.15, damage: 0.15, durationSec: 3 }],
			tags: ['jungle', 'robe', 'distance', 'hunt'], gemSlots: 2,
			variantPool: ['distance', 'momentum', 'thorned', 'wild', 'empowered', 'conditional']
		}),
		eye_of_sylvaris: I({
			name: 'Eye of Sylvaris', type: 'relic', icon: '👁️', rarity: 'legendary', dungeon: 'earth',
			stats: { magicControl: 20, manaRegen: 13, magicPower: 8 },
			desc: 'Encourages players to deliberately construct their opening spell.',
			effectText: 'Adaptive Casting: The first spell you cast after entering combat becomes your Attunement. Your next three spells gain a bonus based on it: launched energy +15% Redirect speed, zones/bursts/Domains +15% size, status-heavy spells +20% Domain duration, constructs +15% effectiveness, self-movement spells +15% movement effect.',
			effects: [{ type: 'adaptiveCasting', spells: 3, projSpeed: 0.15, area: 0.15, effectDur: 0.20, summon: 0.15, move: 0.15 }],
			tags: ['jungle', 'relic', 'adaptive'], gemSlots: 2,
			variantPool: ['wild', 'opening', 'empowered', 'blooming', 'ancient', 'spell_type']
		}),
		the_wild_pact: I({
			name: 'The Wild Pact', type: 'staff', icon: '🌀', rarity: 'cursed', dungeon: 'earth',
			slots: ['staff', 'relic1', 'relic2'],
			stats: { magicPower: 25, magicControl: 20, manaRegen: 15 },
			desc: 'No spell may be cast twice. Transforms the entire spell rotation.',
			effectText: 'Curse — No Spell May Be Cast Twice: After casting a spell, that exact spell cannot be cast again until you have cast three different spells. Completing the cycle grants +12% spell damage, stacking up to 3 times. Repeating a spell early loses the accumulated bonus.',
			curseText: 'You must rotate spells. Repeating too early dumps your power.',
			effects: [{ type: 'wildPact', cycle: 3, bonus: 0.12, maxStacks: 3 }],
			tags: ['jungle', 'staff', 'cursed', 'rotation'], gemSlots: 2,
			variantPool: ['bloomcycle', 'thorncycle', 'ancientcycle'],
			isCursed: true
		})
	};

	/* Variant definitions. mods patch numeric effect fields and/or add flags. */
	const VARIANTS = {
		/* generic archetypes */
		empowered: { id: 'empowered', displayName: 'Empowered', description: 'The item\'s existing effect is stronger.',
			mods: { damage: 1.25, bonus: 1.25, power: 1.22, restorePct: 1.2, perStack: 1.2, shieldPct: 1.15, reduction: 1.15 } },
		reduced_cd: { id: 'reduced_cd', displayName: 'Quickened', description: 'The item\'s effect activates more frequently.',
			mods: { cooldownSec: 0.75, n: 0.75, everySec: 0.8, windowSec: 0.85 } },
		expanded: { id: 'expanded', displayName: 'Expanded', description: 'Larger area, slightly less focused power.',
			mods: { radius: 1.35, area: 1.3, size: 1.25, damage: 0.9, power: 0.92 } },
		focused: { id: 'focused', displayName: 'Focused', description: 'Tighter area, stronger single-target effect.',
			mods: { radius: 0.7, area: 0.75, damage: 1.2, power: 1.18, bonus: 1.15 } },
		lingering: { id: 'lingering', displayName: 'Lingering', description: 'Effects last longer.',
			mods: { durationSec: 1.35, decaySec: 1.3, dropSec: 1.25, windowSec: 1.2, bonus: 1.1 } },
		echo: { id: 'echo', displayName: 'Echo', description: 'The effect happens twice. The second activation is weaker.',
			flags: { echo: 0.5 }, mods: {} },
		chain: { id: 'chain', displayName: 'Chained', description: 'The effect can jump to another nearby enemy.',
			flags: { chain: 0.55 }, mods: {} },
		conversion: { id: 'conversion', displayName: 'Converted', description: 'The effect leans into an alternate damage identity.',
			flags: { convert: 'arcane' }, mods: { damage: 1.08 } },
		execution: { id: 'execution', displayName: 'Execution', description: 'Stronger against low-health enemies.',
			flags: { executePct: 0.25, executeBonus: 0.22 }, mods: {} },
		opening: { id: 'opening', displayName: 'Opening', description: 'Strongest at the beginning of combat.',
			flags: { openingBonus: 0.28 }, mods: {} },
		momentum: { id: 'momentum', displayName: 'Momentum', description: 'Grows stronger through consecutive successful actions.',
			flags: { momentum: 0.03, momentumMax: 5 }, mods: {} },
		desperation: { id: 'desperation', displayName: 'Desperate', description: 'Stronger when you are low on health.',
			flags: { desperationHp: 0.35, desperationBonus: 0.16 }, mods: {} },
		defensive: { id: 'defensive', displayName: 'Warding', description: 'The item gains a short defensive interaction.',
			flags: { grantShield: 14 }, mods: {} },
		offensive: { id: 'offensive', displayName: 'Aggressive', description: 'The item charges your next spell after a defensive trigger.',
			flags: { chargeNext: 0.12 }, mods: {} },
		sacrifice: { id: 'sacrifice', displayName: 'Sacrificial', description: 'Significant power in exchange for a higher energy cost.',
			flags: { manaCost: 1.12 }, mods: { damage: 1.22, bonus: 1.2, power: 1.2 } },
		conditional: { id: 'conditional', displayName: 'Conditional', description: 'Much stronger while its condition is maintained.',
			mods: { damage: 1.18, bonus: 1.15 } },
		reactive: { id: 'reactive', displayName: 'Reactive', description: 'Answers enemy actions more sharply.',
			mods: { cooldownSec: 0.85, damage: 1.1 } },
		precision: { id: 'precision', displayName: 'Precise', description: 'Rewards accurate direct hits.',
			flags: { precision: 0.10 }, mods: {} },
		distance: { id: 'distance', displayName: 'Ranging', description: 'Effectiveness shifts with distance from the target.',
			mods: { farRange: 1.1, nearRange: 0.9, damage: 1.08 } },
		spell_type: { id: 'spell_type', displayName: 'Attuned', description: 'Stronger with divided volleys, gravity rain, Rotate orbits and Target-seeking energy.',
			flags: { behaviorBonus: 0.12 }, mods: {} },

		/* Fire-themed */
		molten: { id: 'molten', displayName: 'Molten', description: 'Volcanic eruptions occur more frequently.',
			mods: { n: 0.75 } },
		volatile: { id: 'volatile', displayName: 'Volatile', description: 'Larger explosions but slightly lower direct damage.',
			mods: { radius: 1.4, power: 0.88, damage: 0.9 } },
		infernal: { id: 'infernal', displayName: 'Infernal', description: 'Eruptions apply stronger Burn.',
			flags: { applyBurn: 1.35 }, mods: {} },
		seismic: { id: 'seismic', displayName: 'Seismic', description: 'Eruptions launch enemies farther upward.',
			mods: { knockUp: 1.7 } },
		overheated: { id: 'overheated', displayName: 'Overheated', description: 'Higher eruption damage, but spells cost more energy.',
			flags: { manaCost: 1.10 }, mods: { power: 1.28 } },
		chainfire: { id: 'chainfire', displayName: 'Chainfire', description: 'The eruption can jump to nearby enemies.',
			flags: { chain: 0.6 }, mods: {} },
		scorching: { id: 'scorching', displayName: 'Scorching', description: 'Burning enemies increase the item\'s damage.',
			flags: { vsBurning: 0.20 }, mods: {} },
		critical: { id: 'critical', displayName: 'Critical', description: 'Successful hits charge an enhanced eruption.',
			flags: { chargeErupt: 6 }, mods: {} },
		emberfueled: { id: 'emberfueled', displayName: 'Emberfueled', description: 'Damage restores slightly more energy.',
			mods: { restorePct: 1.25 } },
		bloodfuel: { id: 'bloodfuel', displayName: 'Bloodfuel', description: 'Zero-energy drain is harsher, restore is stronger.',
			mods: { restorePct: 1.35, drainHp: 1.4 } },
		overburn: { id: 'overburn', displayName: 'Overburn', description: 'Burning targets restore extra energy.',
			flags: { vsBurning: 0.15 }, mods: { restorePct: 1.15 } },

		/* Ice-themed */
		permafrost: { id: 'permafrost', displayName: 'Permafrost', description: 'Freeze lasts longer.',
			mods: { bonus: 1.6, decaySec: 1.25, durationSec: 1.3 } },
		crystal: { id: 'crystal', displayName: 'Crystal', description: 'Stationary casting creates protective crystal fragments.',
			flags: { crystalGuard: 12 }, mods: {} },
		bastion: { id: 'bastion', displayName: 'Bastion', description: 'Stationary bonuses provide additional defense.',
			mods: { dr: 1.25, shieldPct: 1.2, amount: 1.25, reduction: 1.2 } },
		shatter: { id: 'shatter', displayName: 'Shatter', description: 'Breaking Freeze causes an area burst.',
			flags: { shatterBurst: 0.7 }, mods: {} },
		stillwater: { id: 'stillwater', displayName: 'Stillwater', description: 'Remaining stationary progressively increases control.',
			flags: { stillControl: 0.04 }, mods: {} },
		deep_freeze: { id: 'deep_freeze', displayName: 'Deep Freeze', description: 'Longer setup produces a much stronger freeze payoff.',
			mods: { damage: 1.3, bonus: 1.25 } },
		glacial: { id: 'glacial', displayName: 'Glacial', description: 'Your hits deal more damage to Frozen targets.',
			flags: { vsFrozen: 0.12 }, mods: {} },
		glacial_lock: { id: 'glacial_lock', displayName: 'Glacial Lock', description: 'Stationary damage is higher, downtime is longer.',
			mods: { stillDamage: 1.2, downSec: 1.25 } },
		rimebound: { id: 'rimebound', displayName: 'Rimebound', description: 'Control bonus is larger while the curse holds.',
			mods: { controlFlat: 1.3, stillDamage: 1.1 } },
		crystal_heart: { id: 'crystal_heart', displayName: 'Crystal Heart', description: 'Stationary mode also grants a small shield.',
			flags: { grantShield: 20 }, mods: { stillDamage: 1.08 } },

		/* Jungle-themed */
		entangling: { id: 'entangling', displayName: 'Entangling', description: 'Persistent effects periodically root enemies.',
			flags: { rootPulse: 1 }, mods: {} },
		blooming: { id: 'blooming', displayName: 'Blooming', description: 'Persistent and support effects create extra value over time.',
			mods: { bonus: 1.2, duration: 1.2, per: 1.15 } },
		thorned: { id: 'thorned', displayName: 'Thorned', description: 'Enemies interacting with you or your terrain take extra damage.',
			flags: { thorn: 0.12 }, mods: { damage: 1.08, power: 1.1 } },
		vinebound: { id: 'vinebound', displayName: 'Vinebound', description: 'Terrain and movement effects improve control.',
			mods: { moveSec: 0.85, speed: 1.15, bonus: 1.1 } },
		spreading: { id: 'spreading', displayName: 'Spreading', description: 'Size bonuses are larger.',
			mods: { size: 1.2, radius: 1.25, area: 1.2 } },
		ancient: { id: 'ancient', displayName: 'Ancient', description: 'Longer-lasting effects become stronger over time.',
			flags: { agePower: 0.08 }, mods: { duration: 1.15 } },
		wild: { id: 'wild', displayName: 'Wild', description: 'Casting different spells in succession produces stronger effects.',
			flags: { variety: 0.10 }, mods: {} },
		bloomcycle: { id: 'bloomcycle', displayName: 'Bloomcycle', description: 'Completing a rotation also cheapens the next spell.',
			flags: { cycleDiscount: 0.12 }, mods: { bonus: 1.1 } },
		thorncycle: { id: 'thorncycle', displayName: 'Thorncycle', description: 'Completing a rotation fires a thorn from you.',
			flags: { cycleThorn: 1 }, mods: {} },
		ancientcycle: { id: 'ancientcycle', displayName: 'Ancientcycle', description: 'Rotation stacks linger longer before being lost.',
			mods: { maxStacks: 1.0 }, flags: { lingerStacks: 1 } }
	};

	const GEM_QUALITIES = {
		cracked:  { id: 'cracked',  name: 'Cracked',  mult: 0.60 },
		normal:   { id: 'normal',   name: 'Normal',   mult: 1.00 },
		refined:  { id: 'refined',  name: 'Refined',  mult: 1.25 },
		pristine: { id: 'pristine', name: 'Pristine', mult: 1.55 },
		perfect:  { id: 'perfect',  name: 'Perfect',  mult: 1.90 }
	};
	const GEM_QUALITY_ORDER = ['cracked', 'normal', 'refined', 'pristine', 'perfect'];

	const CORRUPTIONS = {
		cinder_tithe: {
			corruptionId: 'cinder_tithe', displayName: 'Cinder Tithe', rarityTier: 'corrupted',
			benefitDescription: 'Killing an enemy restores a burst of energy. Damage no longer feeds you energy.',
			drawbackDescription: 'Normal energy regen stays disabled. Sitting at 0 energy burns more HP.',
			nightmareOnly: false, visual: 'ashen', baseItemIds: ['ashen_pact'],
			replaces: ['ashenPact'],
			effectText: 'Corruption — Cinder Tithe: You no longer regenerate energy, and spell damage no longer restores energy. Killing an enemy restores a burst of energy. Sitting at 0 energy burns more HP each second.',
			effects: [{ type: 'ashenTithe', killMana: 28, drainHp: 7 }]
		},
		thawed_veins: {
			corruptionId: 'thawed_veins', displayName: 'Thawed Veins', rarityTier: 'corrupted',
			benefitDescription: 'The motionless curse flips: spell damage and Control rise while you keep moving.',
			drawbackDescription: 'Standing still dumps the bonus. You are still slower than a normal mage.',
			nightmareOnly: false, visual: 'rime', baseItemIds: ['heart_of_the_eternal_winter'],
			replaces: ['frozenHeart'],
			effectText: 'Corruption — Thawed Veins: The motionless curse flips. Spell damage and Control rise while you keep moving. Standing still dumps the bonus. Movement speed is still reduced.',
			effects: [{ type: 'frozenHeart', invert: true, stillDamage: 0.36, moveGraceSec: 0.35, downSec: 2.5, movePenalty: 0.18, controlFlat: 10 }]
		},
		echo_oath: {
			corruptionId: 'echo_oath', displayName: 'Echo Oath', rarityTier: 'corrupted',
			benefitDescription: 'You must cast a spell twice before you may switch. The second cast is empowered.',
			drawbackDescription: 'Switching before the echo dumps your rotation bonus.',
			nightmareOnly: false, visual: 'wild', baseItemIds: ['the_wild_pact'],
			replaces: ['wildPact'],
			effectText: 'Corruption — Echo Oath: You must cast a spell twice before you may switch. The second cast is empowered. Switching before that echo dumps the rotation bonus.',
			effects: [{ type: 'wildEcho', repeats: 2, bonus: 0.22 }]
		},
		rime_bargain: {
			corruptionId: 'rime_bargain', displayName: 'Rime Bargain', rarityTier: 'corrupted',
			benefitDescription: 'Freeze lasts longer and frozen enemies take more damage.',
			drawbackDescription: 'Each Freeze you apply briefly chills your own movement.',
			nightmareOnly: false, visual: 'rime',
			compatibleTags: ['ice', 'freeze'],
			effects: [{ type: 'corruptRimeBargain', freezeDur: 0.22, vsFrozen: 0.16, selfSlow: 0.18, selfSlowSec: 1.4 }]
		},
		still_wound: {
			corruptionId: 'still_wound', displayName: 'Still Wound', rarityTier: 'corrupted',
			benefitDescription: 'Stationary and defensive ice bonuses are stronger.',
			drawbackDescription: 'Taking a hit while standing still briefly staggers your casting.',
			nightmareOnly: false, visual: 'rime',
			compatibleTags: ['ice', 'stationary', 'defense'],
			effects: [{ type: 'corruptStillWound', stillBonus: 0.14, staggerSec: 1.2 }]
		},
		cold_blood: {
			corruptionId: 'cold_blood', displayName: 'Cold Blood', rarityTier: 'corrupted',
			benefitDescription: 'Every spell costs less energy.',
			drawbackDescription: 'Maximum health is reduced.',
			nightmareOnly: false, visual: 'rime',
			compatibleTags: ['ice', 'control', 'cooldown'],
			effects: [{ type: 'corruptColdBlood', costMult: 0.82, maxHpMult: 0.88 }]
		},
		hoarfrost: {
			corruptionId: 'hoarfrost', displayName: 'Hoarfrost', rarityTier: 'corrupted',
			benefitDescription: 'Extra Energy Control and longer Freeze.',
			drawbackDescription: 'Your energy pool is smaller in the cold.',
			nightmareOnly: false, visual: 'rime',
			compatibleTags: ['ice'],
			effects: [{ type: 'corruptHoarfrost', freezeDur: 0.12, controlFlat: 4, maxManaMult: 0.90 }]
		},
		glass_cannon: {
			corruptionId: 'glass_cannon', displayName: 'Glass Cannon', rarityTier: 'corrupted',
			benefitDescription: 'Your spells deal dramatically more damage.',
			drawbackDescription: 'Magic Defense is gutted. You are fragile.',
			nightmareOnly: false, visual: 'glass',
			compatibleTags: ['offense', 'staff', 'burst', 'heat', 'count'],
			effects: [{ type: 'corruptGlass', damage: 0.35, defMult: 0.45 }]
		},
		blood_channeler: {
			corruptionId: 'blood_channeler', displayName: 'Blood Channeler', rarityTier: 'corrupted',
			benefitDescription: 'If you lack energy, spells can be paid with health.',
			drawbackDescription: 'Health becomes a casting resource.',
			nightmareOnly: false, visual: 'blood',
			compatibleTags: ['aggression', 'panic', 'desperation', 'mana'],
			effects: [{ type: 'corruptBlood', hpCostPct: 0.08 }]
		},
		broken_chronometer: {
			corruptionId: 'broken_chronometer', displayName: 'Broken Chronometer', rarityTier: 'corrupted',
			benefitDescription: 'Spell cooldowns are dramatically reduced.',
			drawbackDescription: 'Maximum energy is reduced.',
			nightmareOnly: false, visual: 'chrono',
			compatibleTags: ['cooldown', 'control', 'utility'],
			effects: [{ type: 'corruptChrono', cdMult: 0.65, maxManaMult: 0.72 }]
		},
		void_lens: {
			corruptionId: 'void_lens', displayName: 'Void Lens', rarityTier: 'corrupted',
			benefitDescription: 'Target-seeking, orbiting (Rotate / Bind) and divided-volley spells are much stronger.',
			drawbackDescription: 'Anchored, zone and gravity-rain spells are weakened.',
			nightmareOnly: false, visual: 'void',
			compatibleTags: ['staff', 'adaptive', 'count'],
			effects: [{ type: 'corruptLens', good: ['homing', 'orbit', 'barrage'], bad: ['ground', 'rain', 'stationary'], goodBonus: 0.28, badPenalty: 0.35 }]
		},
		unstable_core: {
			corruptionId: 'unstable_core', displayName: 'Unstable Core', rarityTier: 'corrupted',
			benefitDescription: 'Power grows as you continue casting.',
			drawbackDescription: 'Taking damage resets accumulated power.',
			nightmareOnly: false, visual: 'unstable',
			compatibleTags: ['heat', 'momentum', 'aggression', 'burst'],
			effects: [{ type: 'corruptUnstable', perCast: 0.04, max: 0.28 }]
		}
	};

	const NIGHTMARE_CORRUPTIONS = {
		cinder_mercy: {
			corruptionId: 'cinder_mercy', displayName: 'Cinder Mercy', rarityTier: 'nightmare',
			benefitDescription: 'Healing yourself or an ally restores energy. Damage no longer feeds the pact.',
			drawbackDescription: 'Normal energy regen stays disabled. Sitting at 0 energy still burns HP.',
			nightmareOnly: true, visual: 'nightmare-ashen', baseItemIds: ['ashen_pact'],
			replaces: ['ashenPact', 'ashenTithe'],
			effectText: 'Nightmare — Cinder Mercy: You no longer regenerate energy, and spell damage no longer restores energy. Healing yourself or an ally restores energy. Sitting at 0 energy still burns HP.',
			effects: [{ type: 'ashenMercy', healRestore: 0.55, drainHp: 4 }]
		},
		still_prison: {
			corruptionId: 'still_prison', displayName: 'Still Prison', rarityTier: 'nightmare',
			benefitDescription: 'Standing still grants enormous spell damage, Control, and damage reduction.',
			drawbackDescription: 'Moving hurts you. The motionless prison is now literal.',
			nightmareOnly: true, visual: 'nightmare-ice', baseItemIds: ['heart_of_the_eternal_winter'],
			replaces: ['frozenHeart'],
			effectText: 'Nightmare — Still Prison: Standing still grants huge spell damage, Control, and damage reduction. Moving hurts you. The motionless prison is now literal.',
			effects: [{ type: 'frozenHeart', stillDamage: 0.58, moveGraceSec: 0.4, downSec: 4, movePenalty: 0.30, controlFlat: 14, stillDr: 0.16, moveHurt: 8 }]
		},
		chorus_bind: {
			corruptionId: 'chorus_bind', displayName: 'Chorus Bind', rarityTier: 'nightmare',
			benefitDescription: 'Finishing a three-spell chorus empowers your next three casts at once.',
			drawbackDescription: 'You cannot repeat a spell during the chorus. Breaking it silences your bonus and cuts damage.',
			nightmareOnly: true, visual: 'nightmare-wild', baseItemIds: ['the_wild_pact'],
			replaces: ['wildPact', 'wildEcho'],
			effectText: 'Nightmare — Chorus Bind: You must finish a three-spell chorus (no repeats). Completing it empowers your next three casts. Breaking it silences the bonus and cuts damage.',
			effects: [{ type: 'wildChorus', cycle: 3, bonus: 0.20, breakPenalty: 0.28, penaltySec: 6 }]
		},
		nightmare_rime_crown: {
			corruptionId: 'nightmare_rime_crown', displayName: 'Nightmare Rime Crown', rarityTier: 'nightmare',
			benefitDescription: 'Freeze shatters for a burst and frozen targets take far more damage.',
			drawbackDescription: 'After you Freeze something, you are briefly chilled yourself.',
			nightmareOnly: true, visual: 'nightmare-ice',
			compatibleTags: ['ice', 'freeze'],
			effects: [{ type: 'nightmareRimeCrown', vsFrozen: 0.28, shatter: 0.8, selfSlow: 0.28, selfSlowSec: 1.8 }]
		},
		nightmare_still_tomb: {
			corruptionId: 'nightmare_still_tomb', displayName: 'Nightmare Still Tomb', rarityTier: 'nightmare',
			benefitDescription: 'Stationary ice bonuses are nearly doubled.',
			drawbackDescription: 'Leaving your standing circle wounds you.',
			nightmareOnly: true, visual: 'nightmare-ice',
			compatibleTags: ['ice', 'stationary'],
			effects: [{ type: 'nightmareStillTomb', stillBonus: 0.22, leaveHurt: 12 }]
		},
		nightmare_hoarfrost: {
			corruptionId: 'nightmare_hoarfrost', displayName: 'Nightmare Hoarfrost', rarityTier: 'nightmare',
			benefitDescription: 'Cold (Reverse Thermal) spells hit harder and Freeze longer.',
			drawbackDescription: 'Your maximum energy and health shrink in the nightmare cold.',
			nightmareOnly: true, visual: 'nightmare-ice',
			compatibleTags: ['ice'],
			effects: [{ type: 'nightmareHoarfrost', iceDamage: 0.22, freezeDur: 0.20, maxManaMult: 0.82, maxHpMult: 0.90 }]
		},
		nightmare_glass_inferno: {
			corruptionId: 'nightmare_glass_inferno', displayName: 'Nightmare Glass Inferno', rarityTier: 'nightmare',
			benefitDescription: 'Enormous Thermal (heat) spell damage. Burn effects can chain.',
			drawbackDescription: 'Magic Defense is dramatically reduced. A major hit temporarily disables the bonus.',
			nightmareOnly: true, visual: 'nightmare-glass',
			compatibleTags: ['fire', 'burn', 'heat', 'eruption'],
			effects: [{ type: 'nightmareGlassInferno', fireDamage: 0.40, defMult: 0.40, disableSec: 6, bigHitPct: 0.16 }]
		},
		nightmare_root_sovereign: {
			corruptionId: 'nightmare_root_sovereign', displayName: 'Nightmare Root Sovereign', rarityTier: 'nightmare',
			benefitDescription: 'Persistent spells (zones, anchors, constructs, Domains) become extremely powerful and empower later spells.',
			drawbackDescription: 'You may maintain far fewer persistent spells. Replacing one dumps accumulated power.',
			nightmareOnly: true, visual: 'nightmare-root',
			compatibleTags: ['terrain', 'persistent', 'jungle'],
			effects: [{ type: 'nightmareRootSovereign', persistBonus: 0.30, maxPersist: 2 }]
		}
	};

	const GEMS = {
		ember_gem: { gemId: 'ember_gem', name: 'Ember Gem', icon: '🔶', rarity: 'common', tags: ['fire', 'burn'],
			desc: 'Your Thermal Burns hit a little harder.', mods: { burnPower: 0.10, burnDuration: 0.08 } },
		cinder_gem: { gemId: 'cinder_gem', name: 'Cinder Gem', icon: '🔥', rarity: 'uncommon', tags: ['fire', 'heat'],
			desc: 'Slightly improves consecutive-cast Fire bonuses.', mods: { heatBonus: 0.08 } },
		inferno_gem: { gemId: 'inferno_gem', name: 'Inferno Gem', icon: '🌋', rarity: 'rare', tags: ['fire', 'burst'],
			desc: 'Slightly improves gear eruption and fire-burst size.', mods: { burstRadius: 0.10, burstPower: 0.08 } },
		rime_gem: { gemId: 'rime_gem', name: 'Rime Gem', icon: '❄️', rarity: 'common', tags: ['ice', 'freeze'],
			desc: 'Your chills and Freezes last a little longer.', mods: { freezeDuration: 0.08 } },
		still_gem: { gemId: 'still_gem', name: 'Still Gem', icon: '🧊', rarity: 'uncommon', tags: ['ice', 'stationary'],
			desc: 'Slightly improves bonuses gained while standing still.', mods: { stillBonus: 0.08 } },
		glacier_gem: { gemId: 'glacier_gem', name: 'Glacier Gem', icon: '🔷', rarity: 'rare', tags: ['ice', 'defense'],
			desc: 'Slightly improves icy shields and damage reduction.', mods: { shield: 0.10, dr: 0.06 } },
		root_gem: { gemId: 'root_gem', name: 'Root Gem', icon: '🌱', rarity: 'common', tags: ['jungle', 'terrain'],
			desc: 'Domains you expand last a little longer.', mods: { persistDuration: 0.10 } },
		vine_gem: { gemId: 'vine_gem', name: 'Vine Gem', icon: '🍃', rarity: 'uncommon', tags: ['jungle', 'mobility'],
			desc: 'Slightly improves movement bonuses from Jungle gear.', mods: { moveBonus: 0.08 } },
		spore_gem: { gemId: 'spore_gem', name: 'Spore Gem', icon: '🍄', rarity: 'rare', tags: ['jungle', 'utility'],
			desc: 'Slightly improves status duration and healing.', mods: { effectDuration: 0.08, healBonus: 0.05 } },
		precision_gem: { gemId: 'precision_gem', name: 'Precision Gem', icon: '🎯', rarity: 'uncommon', tags: ['projectile'],
			desc: 'Direct hits from launched energy deal a little more damage (not zones or bursts).', mods: { projectileDamage: 0.06 } },
		reservoir_gem: { gemId: 'reservoir_gem', name: 'Reservoir Gem', icon: '💧', rarity: 'common', tags: ['mana'],
			desc: 'Spells cost a little less energy.', mods: { manaCost: -0.06 } },
		bastion_gem: { gemId: 'bastion_gem', name: 'Bastion Gem', icon: '🛡️', rarity: 'uncommon', tags: ['defense'],
			desc: 'Slightly improves defensive effects.', mods: { defense: 3, dr: 0.04 } },
		momentum_gem: { gemId: 'momentum_gem', name: 'Momentum Gem', icon: '⚡', rarity: 'rare', tags: ['momentum'],
			desc: 'Slightly improves consecutive-casting bonuses.', mods: { momentum: 0.12 } },
		execution_gem: { gemId: 'execution_gem', name: 'Execution Gem', icon: '☠️', rarity: 'rare', tags: ['execute'],
			desc: 'Slightly improves damage against low-health enemies.', mods: { execute: 0.10 } },
		phase_gem: { gemId: 'phase_gem', name: 'Phase Gem', icon: '🔗', rarity: 'epic', tags: ['phases'],
			desc: 'Multi-stage spells (Wait/Then chains, Split branches, Domains) deal a little more damage.', mods: { multiPhase: 0.08 } },
		wild_gem: { gemId: 'wild_gem', name: 'Wild Gem', icon: '🌀', rarity: 'epic', tags: ['rotation'],
			desc: 'Slightly improves bonuses from casting different spells in sequence.', mods: { variety: 0.08 } },
		caldera_gem: { gemId: 'caldera_gem', name: 'Caldera Gem', icon: '🌋', rarity: 'legendary', tags: ['fire', 'burst'],
			desc: 'Meaningful Fire burst specialization without replacing the item.', mods: { burstPower: 0.14, heatBonus: 0.08 } },
		permafrost_gem: { gemId: 'permafrost_gem', name: 'Permafrost Gem', icon: '👑', rarity: 'legendary', tags: ['ice', 'freeze'],
			desc: 'Meaningful Freeze and stillness specialization.', mods: { freezeDuration: 0.12, stillBonus: 0.10 } },
		worldroot_gem: { gemId: 'worldroot_gem', name: 'Worldroot Gem', icon: '🌍', rarity: 'legendary', tags: ['jungle', 'terrain'],
			desc: 'Meaningful persistent-spell specialization: longer Domains, stronger zones, anchors and constructs.', mods: { persistDuration: 0.14, persistPower: 0.10 } }
	};

	const RARITY_ORDER = {
		common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, cursed: 5, mythical: 6, mythic: 7
	};

	const RARITY_COLORS = {
		common: '#aaa', uncommon: '#2ecc71', rare: '#3498db', epic: '#9b59b6',
		legendary: '#f39c12', cursed: '#c0392b', corrupted: '#c0392b', nightmare: '#e070ff',
		mythical: '#cc44ff', mythic: '#ffd700'
	};

	const LOOT_WEIGHTS = {
		easy:      { common: 70, uncommon: 24, rare: 5.5, epic: 0.5, legendary: 0, cursed: 0 },
		normal:    { common: 48, uncommon: 32, rare: 15, epic: 4.2, legendary: 0.7, cursed: 0.1 },
		hard:      { common: 18, uncommon: 36, rare: 30, epic: 12, legendary: 3.4, cursed: 0.6 },
		nightmare: { common: 0, uncommon: 16, rare: 48, epic: 24, legendary: 9.5, cursed: 2.5 }
	};

	const VARIANT_CHANCE = { easy: 0, normal: 0, hard: 0, nightmare: 0.40 };
	const CORRUPT_CHANCE = { easy: 0, normal: 0.01, hard: 0.04, nightmare: 0.10 };
	const NIGHTMARE_CORRUPT_CHANCE = { easy: 0, normal: 0, hard: 0.002, nightmare: 0.012 };
	const GEM_DROP_CHANCE = { easy: 0.08, normal: 0.14, hard: 0.22, nightmare: 0.34 };

	global.GEAR_DATA = {
		ITEMS, VARIANTS, CORRUPTIONS, NIGHTMARE_CORRUPTIONS, GEMS,
		GEM_QUALITIES, GEM_QUALITY_ORDER,
		RARITY_ORDER, RARITY_COLORS, LOOT_WEIGHTS,
		VARIANT_CHANCE, CORRUPT_CHANCE, NIGHTMARE_CORRUPT_CHANCE, GEM_DROP_CHANCE
	};
})(typeof window !== 'undefined' ? window : globalThis);
