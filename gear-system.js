/* =============================================================
   GEAR SYSTEM — instances, loot, collection, combat runtime
   ============================================================= */
(function (global) {
	'use strict';

	const D = global.GEAR_DATA || {};
	const ITEMS = D.ITEMS || {};
	const VARIANTS = D.VARIANTS || {};
	const CORRUPTIONS = D.CORRUPTIONS || {};
	const NIGHTMARE_CORRUPTIONS = D.NIGHTMARE_CORRUPTIONS || {};
	const GEMS = D.GEMS || {};
	const GEM_QUALITIES = D.GEM_QUALITIES || {
		cracked: { id: 'cracked', name: 'Cracked', mult: 0.6 },
		normal: { id: 'normal', name: 'Normal', mult: 1 },
		refined: { id: 'refined', name: 'Refined', mult: 1.25 },
		pristine: { id: 'pristine', name: 'Pristine', mult: 1.55 },
		perfect: { id: 'perfect', name: 'Perfect', mult: 1.9 }
	};
	const GEM_QUALITY_ORDER = D.GEM_QUALITY_ORDER || ['cracked', 'normal', 'refined', 'pristine', 'perfect'];
	const GEM_MOD_LABELS = {
		burnPower: 'Burn power', burnDuration: 'Burn duration', heatBonus: 'Heat bonus',
		burstRadius: 'Burst radius', burstPower: 'Burst power', freezeDuration: 'Freeze duration',
		stillBonus: 'Still bonus', shield: 'Shield', dr: 'Damage reduction',
		persistDuration: 'Domain duration', persistPower: 'Persistent-spell power', moveBonus: 'Move bonus',
		effectDuration: 'Effect duration', healBonus: 'Healing', projectileDamage: 'Direct-hit damage',
		manaCost: 'Energy cost', defense: 'Magic Defence', momentum: 'Momentum',
		execute: 'Execute damage', multiPhase: 'Multi-stage spell damage', variety: 'Variety bonus'
	};

	function uid(prefix) {
		return (prefix || 'g') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
	}
	function clone(o) { return o ? JSON.parse(JSON.stringify(o)) : o; }
	function itemDef(id) { return ITEMS[id] || null; }
	function isGear(id) { return !!(ITEMS[id]); }
	function isGem(id) { return !!(GEMS[id]); }
	function rarityOf(id) { return (ITEMS[id] && ITEMS[id].rarity) || 'common'; }

	function mergeGearItems(itemDb) {
		if (!itemDb) return;
		for (const id of Object.keys(ITEMS)) {
			const it = ITEMS[id];
			itemDb[id] = {
				name: it.name,
				type: it.type,
				icon: it.icon,
				rarity: it.rarity,
				stats: Object.assign({}, it.stats || {}),
				desc: it.desc,
				dungeon: it.dungeon,
				effectText: it.effectText,
				curseText: it.curseText,
				gemSlots: it.gemSlots || 2,
				slots: it.slots,
				isCursed: !!it.isCursed,
				tags: it.tags || []
			};
		}
		for (const id of Object.keys(GEMS)) {
			const g = GEMS[id];
			itemDb[id] = {
				name: g.name,
				type: 'gem',
				icon: g.icon,
				rarity: g.rarity,
				stats: {},
				desc: g.desc + ' ' + formatGemModList(g.mods, 1),
				tags: g.tags || []
			};
		}
	}

	function defaultCollection() {
		return { items: {}, variants: {}, corruptions: {}, nightmare: {}, gems: {}, gemQualities: {} };
	}

	function scrubRetiredCollectionKeys(col) {
		if (!col) return col;
		function scrub(map, live) {
			if (!map) return;
			for (const k of Object.keys(map)) {
				const id = k.indexOf(':') >= 0 ? k.slice(k.indexOf(':') + 1) : k;
				if (!live[id]) delete map[k];
			}
		}
		scrub(col.corruptions, CORRUPTIONS);
		scrub(col.nightmare, NIGHTMARE_CORRUPTIONS);
		return col;
	}

	function ensureCollection(state) {
		if (!state.gearCollection) state.gearCollection = defaultCollection();
		if (!state.gearCollection.gemQualities) state.gearCollection.gemQualities = {};
		return scrubRetiredCollectionKeys(state.gearCollection);
	}

	function discover(state, inst) {
		if (!state || !inst) return;
		const col = ensureCollection(state);
		if (inst.itemId && ITEMS[inst.itemId]) col.items[inst.itemId] = true;
		if (inst.variantId) col.variants[inst.itemId + ':' + inst.variantId] = true;
		if (inst.corruptionId) {
			if (inst.nightmare && NIGHTMARE_CORRUPTIONS[inst.corruptionId]) {
				col.nightmare[inst.itemId + ':' + inst.corruptionId] = true;
			} else if (!inst.nightmare && CORRUPTIONS[inst.corruptionId]) {
				col.corruptions[inst.itemId + ':' + inst.corruptionId] = true;
			}
		}
		if (inst.gems) {
			for (const g of inst.gems) {
				if (!g) continue;
				const ref = parseGemRef(g);
				if (ref.id) discoverGem(state, ref.id, ref.quality);
			}
		}
	}

	function parseGemRef(g) {
		if (!g) return { id: null, quality: 'normal' };
		if (typeof g === 'string') {
			const parts = g.split('|');
			return { id: parts[0], quality: parts[1] || 'normal' };
		}
		return { id: g.itemId || g.gemId || g.id || null, quality: g.quality || 'normal' };
	}
	function gemQualityMult(q) {
		return (GEM_QUALITIES[q] && GEM_QUALITIES[q].mult) || 1;
	}
	function formatGemModValue(key, val) {
		if (key === 'defense') return (val >= 0 ? '+' : '') + Math.round(val) + ' Magic Defence';
		const label = GEM_MOD_LABELS[key] || key;
		if (Math.abs(val) < 2) {
			const pct = Math.round(val * 1000) / 10;
			const n = (pct % 1 ? pct.toFixed(1) : String(Math.round(pct)));
			return (val >= 0 ? '+' : '') + n + '% ' + label;
		}
		return (val >= 0 ? '+' : '') + (Math.round(val * 10) / 10) + ' ' + label;
	}
	function formatGemModList(mods, mult) {
		if (!mods) return '';
		mult = mult == null ? 1 : mult;
		return Object.keys(mods).map(k => formatGemModValue(k, mods[k] * mult)).join(', ');
	}
	function discoverGem(state, gemId, quality) {
		if (!state || !gemId) return;
		const col = ensureCollection(state);
		col.gems[gemId] = true;
		if (!col.gemQualities) col.gemQualities = {};
		if (!col.gemQualities[gemId]) col.gemQualities[gemId] = {};
		if (quality) col.gemQualities[gemId][quality] = true;
	}

	function applyNumericMods(obj, mods) {
		if (!obj || !mods) return obj;
		for (const k of Object.keys(mods)) {
			if (typeof obj[k] === 'number') obj[k] = obj[k] * mods[k];
		}
		return obj;
	}

	function resolvedEffects(inst) {
		const def = itemDef(inst && inst.itemId);
		if (!def) return [];
		let effects = clone(def.effects || []);
		const variant = inst.variantId ? VARIANTS[inst.variantId] : null;
		if (variant && variant.mods) {
			for (const ef of effects) applyNumericMods(ef, variant.mods);
		}
		if (variant && variant.flags) {
			for (const ef of effects) ef._flags = Object.assign({}, ef._flags || {}, variant.flags);
		}
		if (inst.corruptionId) {
			const c = CORRUPTIONS[inst.corruptionId] || NIGHTMARE_CORRUPTIONS[inst.corruptionId];
			if (c && c.replaces) effects = effects.filter(e => c.replaces.indexOf(e.type) < 0);
			if (c && c.effects) effects = effects.concat(clone(c.effects));
		}
		return effects;
	}

	function gemMods(inst) {
		const out = {};
		if (!inst || !inst.gems) return out;
		for (const raw of inst.gems) {
			const ref = parseGemRef(raw);
			const g = ref.id ? GEMS[ref.id] : null;
			if (!g || !g.mods) continue;
			const m = gemQualityMult(ref.quality);
			for (const k of Object.keys(g.mods)) {
				out[k] = (out[k] || 0) + g.mods[k] * m;
			}
		}
		return out;
	}

	function rollItemStats(base) {
		const out = {};
		const src = base || {};
		for (const k of Object.keys(src)) {
			const n = src[k];
			if (typeof n !== 'number') continue;
			const f = 0.8 + Math.random() * 0.4;
			out[k] = Math.max(1, Math.round(n * f));
		}
		return out;
	}

	function getInstanceStats(inst) {
		const def = itemDef(inst && inst.itemId);
		if (!def) return {};
		const stats = Object.assign({}, (inst && inst.stats) || def.stats || {});
		const variant = inst.variantId ? VARIANTS[inst.variantId] : null;
		if (variant && variant.mods && variant.mods.statMods) {
			for (const k of Object.keys(variant.mods.statMods)) {
				stats[k] = (stats[k] || 0) + variant.mods.statMods[k];
			}
		}
		const gm = gemMods(inst);
		if (gm.defense) stats.magicDefence = (stats.magicDefence || 0) + gm.defense;
		return stats;
	}

	function createInstance(itemId, opts) {
		opts = opts || {};
		const def = itemDef(itemId);
		if (!def) return null;
		const inst = {
			uid: opts.uid || uid('g'),
			itemId: itemId,
			baseItemId: itemId,
			qty: 1,
			variantId: opts.variantId || null,
			corruptionId: opts.corruptionId || null,
			nightmare: !!opts.nightmare,
			gems: opts.gems ? opts.gems.slice(0, def.gemSlots || 2) : [null, null],
			rarity: def.rarity,
			dungeon: def.dungeon,
			stats: opts.stats || rollItemStats(def.stats)
		};
		while (inst.gems.length < (def.gemSlots || 2)) inst.gems.push(null);
		return inst;
	}

	function displayName(inst) {
		const def = itemDef(inst && inst.itemId);
		if (!def) return (inst && inst.itemId) || 'Unknown';
		let name = def.name;
		if (inst.variantId && VARIANTS[inst.variantId]) name += ' — ' + VARIANTS[inst.variantId].displayName;
		if (inst.nightmare) name = 'Nightmare ' + name;
		else if (inst.corruptionId && (CORRUPTIONS[inst.corruptionId] || NIGHTMARE_CORRUPTIONS[inst.corruptionId])) name = 'Corrupted ' + name;
		return name;
	}

	function displayRarity(inst) {
		const def = itemDef(inst && inst.itemId) || {};
		if (inst && inst.nightmare) return 'nightmare';
		if (inst && inst.corruptionId && !def.isCursed) return 'corrupted';
		return def.rarity || 'common';
	}

	function niceStatName(k) {
		return String(k || '')
			.replace('magicPower', 'Magic Power')
			.replace('magicControl', 'Magic Control')
			.replace('magicDefence', 'Magic Defence')
			.replace('manaRegen', 'Mana Regen')
			.replace('magic', 'Magic ')
			.replace('mana', 'Mana ')
			.replace(/([A-Z])/g, ' $1')
			.replace(/^./, function (c) { return c.toUpperCase(); })
			.trim();
	}

	function statRangeLines(def) {
		const stats = (def && def.stats) || {};
		const keys = Object.keys(stats);
		if (!keys.length) return '<div class="insp-stat">No numeric stats.</div>';
		return keys.map(k => {
			const base = stats[k];
			let lo = base, hi = base;
			(def.variantPool || []).forEach(vid => {
				const vr = VARIANTS[vid];
				const add = vr && vr.mods && vr.mods.statMods ? vr.mods.statMods[k] : null;
				if (typeof add === 'number') {
					lo = Math.min(lo, base + add);
					hi = Math.max(hi, base + add);
				}
			});
			const range = lo === hi ? ('+' + base) : (lo + '–' + hi);
			return '<div class="insp-stat"><b>' + esc(niceStatName(k)) + '</b> ' + range + (lo !== hi ? ' <span class="insp-sub">(base +' + base + ')</span>' : '') + '</div>';
		}).join('');
	}

	function inspectHtml(inst, itemDb) {
		const def = itemDef(inst && inst.itemId);
		if (!def) return '<div>Unknown item</div>';
		const rarity = displayRarity(inst);
		const color = (D.RARITY_COLORS && D.RARITY_COLORS[def.rarity]) || '#fff';
		const stats = getInstanceStats(inst);
		const statLines = Object.keys(stats).map(k => {
			return '<div class="insp-stat">+' + stats[k] + ' ' + esc(niceStatName(k)) + '</div>';
		}).join('') + '<div class="insp-sub" style="margin-top:6px">Item stat range</div>' + statRangeLines(def);
		const variant = inst.variantId ? VARIANTS[inst.variantId] : null;
		const corr = inst.corruptionId ? (NIGHTMARE_CORRUPTIONS[inst.corruptionId] || CORRUPTIONS[inst.corruptionId]) : null;
		const gm = gemMods(inst);
		const gemLines = (inst.gems || []).map((g, i) => {
			const ref = parseGemRef(g);
			if (!ref.id || !GEMS[ref.id]) return '<div class="insp-gem empty">Gem slot ' + (i + 1) + ' — empty</div>';
			const gem = GEMS[ref.id];
			const qn = (GEM_QUALITIES[ref.quality] && GEM_QUALITIES[ref.quality].name) || 'Normal';
			const nums = formatGemModList(gem.mods, gemQualityMult(ref.quality));
			return '<div class="insp-gem filled" data-gem="' + ref.id + '">' + gem.icon + ' ' + qn + ' ' + gem.name + '<div class="insp-sub">' + esc(gem.desc) + '</div><div class="insp-sub">' + esc(nums) + '</div></div>';
		}).join('');
		let extraMods = '';
		const mk = Object.keys(gm);
		if (mk.length) extraMods = '<div class="insp-block"><div class="insp-label">Gem bonuses</div>' + mk.map(k => '<div class="insp-sub">' + k + ': ' + gm[k] + '</div>').join('') + '</div>';
		const both = !!(variant && corr);
		return (
			'<div class="insp-head">' +
				'<div class="insp-icon">' + def.icon + '</div>' +
				'<div><div class="insp-name" style="color:' + color + '">' + esc(displayName(inst)) + '</div>' +
				'<div class="insp-type">' + def.type + ' · ' + rarity + (def.dungeon && def.dungeon !== 'special' ? ' · ' + def.dungeon : '') + '</div></div>' +
			'</div>' +
			'<div class="insp-block"><div class="insp-label">Stats</div>' + (statLines || '<div class="insp-stat">None</div>') + '</div>' +
			'<div class="insp-block"><div class="insp-label">Base effect</div><div class="insp-body">' + esc(def.effectText || 'None.') + '</div></div>' +
			(both ? '<div class="insp-block combo"><div class="insp-label">Together on this piece</div><div class="insp-body">Variant and corruption both apply at once.</div></div>' : '') +
			(variant ? '<div class="insp-block variant"><div class="insp-label">Variant — ' + esc(variant.displayName) + '</div><div class="insp-body">' + esc(variant.description) + '</div></div>' : '') +
			(corr ? corruptionBlockHtml(corr, !!inst.nightmare) : '') +
			'<div class="insp-block"><div class="insp-label">Gems</div>' + gemLines + extraMods + '</div>' +
			'<div class="insp-block"><div class="insp-label">Description</div><div class="insp-body">' + esc(def.desc || '') + '</div></div>'
		);
	}

	const STAT_COLORS = {
		magicPower: '#ff6b3d', magicControl: '#6ea8ff', magicDefence: '#3dcc7a', manaRegen: '#5ee0d4'
	};
	const LOCATIONS = {
		fire: { name: 'The Infernal Depths', scene: 'fire', blurb: 'Dropped in the Infernal Depths.' },
		ice: { name: 'The Glacial Reach', scene: 'ice', blurb: 'Dropped in the Glacial Reach.' },
		earth: { name: 'The Sylvaris Wildes', scene: 'jungle', blurb: 'Dropped in the Sylvaris Wildes.' },
		special: { name: 'Mythic encounters', scene: 'mythic', blurb: 'Found on unique bosses and relics.' }
	};
	const FLAG_PHRASES = {
		echo: 'The effect happens a second time at half strength.',
		chain: 'The effect can jump to another nearby enemy.',
		convert: 'The effect leans into an alternate damage identity.',
		executePct: 'Stronger against low-health enemies.',
		openingBonus: 'Strongest at the beginning of combat.',
		momentum: 'Grows stronger through consecutive successful actions.',
		desperationHp: 'Stronger when you are low on health.',
		grantShield: 'Grants a short ward when the effect triggers.',
		chargeNext: 'Charges your next spell after a defensive trigger.',
		manaCost: 'Spells cost more energy.',
		precision: 'Rewards accurate direct hits.',
		behaviorBonus: 'Stronger with divided volleys, gravity rain, Rotate orbits and Target-seeking energy.',
		applyBurn: 'Applies stronger Burn.',
		vsBurning: 'Deals extra damage to burning enemies.',
		chargeErupt: 'Successful hits charge an enhanced eruption.',
		crystalGuard: 'Stationary casting creates protective crystal fragments.',
		shatterBurst: 'Breaking Freeze causes an area burst.',
		stillControl: 'Remaining stationary progressively increases control.',
		rootPulse: 'Persistent effects periodically root enemies.',
		thorn: 'Enemies interacting with you or your terrain take extra damage.',
		agePower: 'Longer-lasting effects grow stronger over time.',
		variety: 'Casting different spells in succession produces stronger effects.',
		cycleDiscount: 'Completing a rotation cheapens the next spell.',
		cycleThorn: 'Completing a rotation fires a thorn from you.',
		lingerStacks: 'Rotation stacks linger longer before being lost.'
	};
	const WORD_NUM = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty'];

	function itemCorruptions(itemId, nightmare) {
		const list = compatibleCorruptions(itemId, nightmare).slice();
		const def = itemDef(itemId);
		return list;
	}

	function ownedKeys(map, itemId) {
		const out = [];
		if (!map) return out;
		const p = itemId + ':';
		for (const k of Object.keys(map)) if (k.indexOf(p) === 0) out.push(k.slice(p.length));
		return out;
	}

	function collectionTier(itemId, col) {
		const def = itemDef(itemId);
		if (!def || !col || !col.items[itemId]) return '';
		const pool = def.variantPool || [];
		const allVar = !pool.length || pool.every(v => col.variants[itemId + ':' + v]);
		if (!allVar) return '';
		const nms = itemCorruptions(itemId, true);
		const hasAllNm = nms.length > 0 && nms.every(id => col.nightmare[itemId + ':' + id]);
		if (hasAllNm) return 'purple';
		const corrs = itemCorruptions(itemId, false);
		const hasCorr = corrs.some(id => col.corruptions[itemId + ':' + id]);
		if (hasCorr) return 'red';
		return 'gold';
	}

	function unlockAllCollection(state) {
		const col = ensureCollection(state);
		for (const id of Object.keys(ITEMS)) {
			col.items[id] = true;
			(ITEMS[id].variantPool || []).forEach(v => { col.variants[id + ':' + v] = true; });
			itemCorruptions(id, false).forEach(c => { col.corruptions[id + ':' + c] = true; });
			itemCorruptions(id, true).forEach(c => { col.nightmare[id + ':' + c] = true; });
		}
		for (const id of Object.keys(GEMS)) {
			col.gems[id] = true;
			if (!col.gemQualities) col.gemQualities = {};
			col.gemQualities[id] = {};
			GEM_QUALITY_ORDER.forEach(q => { col.gemQualities[id][q] = true; });
		}
		return col;
	}

	function pruneCollectionToOwned(state) {
		const fresh = defaultCollection();
		const dummy = { gearCollection: fresh };
		function consider(raw) {
			if (!raw) return;
			if (typeof raw === 'string') {
				if (ITEMS[raw]) discover(dummy, createInstance(raw));
				if (GEMS[raw]) fresh.gems[raw] = true;
				return;
			}
			if (raw.itemId && GEMS[raw.itemId]) discoverGem(dummy, raw.itemId, raw.quality || 'normal');
			if (raw.itemId && ITEMS[raw.itemId]) discover(dummy, raw.uid ? raw : createInstance(raw.itemId, raw));
		}
		(state.inventory || []).forEach(consider);
		const eq = state.equipment || {};
		['staff', 'robe', 'relic1', 'relic2'].forEach(k => consider(eq[k]));
		state.gearCollection = fresh;
		return fresh;
	}

	function ordinal(n) {
		const v = n % 100;
		if (v >= 11 && v <= 13) return n + 'th';
		return n + (['th', 'st', 'nd', 'rd'][n % 10] || 'th');
	}

	function isPctKey(k, val) {
		if (/pct|percent|damage|bonus|perstack|restore|reduction|dr|shield|hp|penalty|mult/i.test(k)) {
			return Math.abs(val) <= 2;
		}
		return Math.abs(val) > 0 && Math.abs(val) < 1 && val !== 0.5;
	}

	function formatEffectNum(key, val) {
		if (typeof val !== 'number' || !isFinite(val)) return String(val);
		if (isPctKey(key, val)) {
			const pct = Math.round(val * 1000) / 10;
			return (pct % 1 ? pct.toFixed(1) : String(Math.round(pct))) + '%';
		}
		if (Math.abs(val - Math.round(val)) < 0.001) return String(Math.round(val));
		return (Math.round(val * 100) / 100).toString();
	}

	function fmtPct(val) {
		const pct = Math.round(Number(val) * 1000) / 10;
		return (pct % 1 ? pct.toFixed(1) : String(Math.round(pct))) + '%';
	}
	function fmtSec(val) {
		const n = Math.round(Number(val) * 10) / 10;
		return n + (n === 1 ? ' second' : ' seconds');
	}
	function fmtList(arr) {
		return (arr || []).map(v => String(v)).join(', ');
	}

	/* the old spell words, as the rune system names them (for descriptions) */
	const RUNE_WORDS = { homing: 'Target-seeking', orbit: 'orbiting (Rotate / Bind)', barrage: 'divided-volley', ground: 'anchored', rain: 'gravity-rain', stationary: 'zone',
		burn: 'Thermal', freeze: 'cold', stun: 'Light', blind: 'Light', poison: 'Anti-Magic', wall: 'construct', nova: 'Discharge', explosion: 'Discharge', beam: 'Light beam' };
	function runeWord(k) { return RUNE_WORDS[k] || k; }
	function describeCorruptionEffect(ef) {
		if (!ef) return [];
		const t = ef.type;
		if (t === 'ashenTithe') return [
			'Killing an enemy restores ' + ef.killMana + ' energy.',
			'Spell damage no longer restores energy, and normal energy regen stays off.',
			'While you sit at 0 energy, you lose ' + ef.drainHp + ' HP every second.'
		];
		if (t === 'ashenMercy') return [
			'Healing yourself or an ally restores energy equal to ' + fmtPct(ef.healRestore) + ' of that heal.',
			'Spell damage no longer restores energy, and normal energy regen stays off.',
			'While you sit at 0 energy, you lose ' + ef.drainHp + ' HP every second.'
		];
		if (t === 'frozenHeart' && ef.invert) return [
			'While you keep moving, spell damage is increased by ' + fmtPct(ef.stillDamage) + ' and you gain +' + ef.controlFlat + ' Control.',
			'If you stand still for ' + fmtSec(ef.moveGraceSec) + ', that bonus fades over ' + fmtSec(ef.downSec) + '.',
			'Your movement speed is reduced by ' + fmtPct(ef.movePenalty) + '.'
		];
		if (t === 'frozenHeart') {
			const lines = [
				'While standing still, spell damage is increased by ' + fmtPct(ef.stillDamage) + ' and you gain +' + ef.controlFlat + ' Control.',
				'You can move for ' + fmtSec(ef.moveGraceSec) + ' before the still bonus starts fading (' + fmtSec(ef.downSec) + ' fade).',
				'Your movement speed is reduced by ' + fmtPct(ef.movePenalty) + '.'
			];
			if (ef.stillDr) lines.push('While still, you take ' + fmtPct(ef.stillDr) + ' less damage.');
			if (ef.moveHurt) lines.push('Moving deals ' + ef.moveHurt + ' HP damage.');
			return lines;
		}
		if (t === 'wildEcho') return [
			'You must cast the same spell ' + ef.repeats + ' times before you may switch.',
			'The last cast in that repeat is ' + fmtPct(ef.bonus) + ' stronger.',
			'Switching early dumps the rotation bonus.'
		];
		if (t === 'wildChorus') return [
			'Cast ' + ef.cycle + ' different spells in a row (no repeats) to finish a chorus.',
			'Finishing it empowers your next ' + ef.cycle + ' casts by ' + fmtPct(ef.bonus) + '.',
			'Breaking the chorus cuts your damage by ' + fmtPct(ef.breakPenalty) + ' for ' + fmtSec(ef.penaltySec) + '.'
		];
		if (t === 'corruptRimeBargain') return [
			'Freeze lasts ' + fmtPct(ef.freezeDur) + ' longer.',
			'Frozen enemies take ' + fmtPct(ef.vsFrozen) + ' more damage.',
			'Each Freeze you apply slows you by ' + fmtPct(ef.selfSlow) + ' for ' + fmtSec(ef.selfSlowSec) + '.'
		];
		if (t === 'corruptStillWound') return [
			'While standing still your spells deal ' + fmtPct(ef.stillBonus) + ' more damage.',
			'Taking a hit while standing still staggers your casting for ' + fmtSec(ef.staggerSec) + '.'
		];
		if (t === 'corruptColdBlood') return [
			'Every spell costs ' + fmtPct(ef.costMult) + ' of its normal energy.',
			'Your maximum HP is reduced to ' + fmtPct(ef.maxHpMult) + '.'
		];
		if (t === 'corruptHoarfrost') return [
			'Freeze lasts ' + fmtPct(ef.freezeDur) + ' longer.',
			'You gain +' + ef.controlFlat + ' Control.',
			'Your maximum energy is reduced to ' + fmtPct(ef.maxManaMult) + '.'
		];
		if (t === 'corruptGlass') return [
			'Your spells deal ' + fmtPct(ef.damage) + ' more damage.',
			'Your Magic Defence is reduced to ' + fmtPct(ef.defMult) + ' of normal.'
		];
		if (t === 'corruptBlood') return [
			'If you do not have enough mana, the spell is paid with HP equal to ' + fmtPct(ef.hpCostPct) + ' of your maximum HP.'
		];
		if (t === 'corruptChrono') return [
			'Spell cooldowns are reduced to ' + fmtPct(ef.cdMult) + ' of normal.',
			'Your maximum energy is reduced to ' + fmtPct(ef.maxManaMult) + '.'
		];
		if (t === 'corruptLens') return [
			fmtList((ef.good || []).map(runeWord)) + ' spells deal ' + fmtPct(ef.goodBonus) + ' more damage.',
			fmtList((ef.bad || []).map(runeWord)) + ' spells deal ' + fmtPct(ef.badPenalty) + ' less damage.'
		];
		if (t === 'corruptUnstable') return [
			'Each cast increases your damage by ' + fmtPct(ef.perCast) + ', up to ' + fmtPct(ef.max) + '.',
			'Taking damage resets the stacked bonus to 0.'
		];
		if (t === 'nightmareRimeCrown') return [
			'Frozen enemies take ' + fmtPct(ef.vsFrozen) + ' more damage.',
			'Breaking Freeze deals a burst equal to ' + fmtPct(ef.shatter) + ' extra damage.',
			'After you Freeze something, you are slowed by ' + fmtPct(ef.selfSlow) + ' for ' + fmtSec(ef.selfSlowSec) + '.'
		];
		if (t === 'nightmareStillTomb') return [
			'While standing still your spells deal ' + fmtPct(ef.stillBonus) + ' more damage.',
			'Leaving your standing circle deals ' + ef.leaveHurt + ' HP damage.'
		];
		if (t === 'nightmareHoarfrost') return [
			'Cold (Reverse Thermal) spells deal ' + fmtPct(ef.iceDamage) + ' more damage.',
			'Freeze lasts ' + fmtPct(ef.freezeDur) + ' longer.',
			'Your maximum energy is reduced to ' + fmtPct(ef.maxManaMult) + ' and your maximum HP to ' + fmtPct(ef.maxHpMult) + '.'
		];
		if (t === 'nightmareGlassInferno') return [
			'Thermal (heat) spells deal ' + fmtPct(ef.fireDamage) + ' more damage, and Burn can chain.',
			'Your Magic Defence is reduced to ' + fmtPct(ef.defMult) + ' of normal.',
			'If a single hit deals at least ' + fmtPct(ef.bigHitPct) + ' of your max HP, the extra fire damage turns off for ' + fmtSec(ef.disableSec) + '.'
		];
		if (t === 'nightmareRootSovereign') return [
			'Persistent spells (zones, anchors, constructs, Domains) are ' + fmtPct(ef.persistBonus) + ' stronger and empowers later spells.',
			'You can only keep ' + ef.maxPersist + ' persistent spells at once. Destroying or replacing one dumps the stacked power.'
		];
		const lines = [];
		Object.keys(ef).forEach(k => {
			if (k === 'type' || k === 'kind' || ef[k] == null) return;
			if (typeof ef[k] === 'boolean') {
				if (ef[k]) lines.push(niceStatName(k) + ' is on.');
				return;
			}
			if (Array.isArray(ef[k])) {
				lines.push(niceStatName(k) + ': ' + fmtList(ef[k]) + '.');
				return;
			}
			if (typeof ef[k] === 'number') {
				const n = /sec|time|delay|duration|grace|down|stagger|penaltySec|disable/i.test(k) && ef[k] > 2
					? fmtSec(ef[k])
					: (isPctKey(k, ef[k]) ? fmtPct(ef[k]) : String(formatEffectNum(k, ef[k])));
				lines.push(niceStatName(k) + ': ' + n + '.');
			}
		});
		return lines;
	}

	function effectNumbersList(effects) {
		const lines = [];
		(effects || []).forEach(ef => {
			describeCorruptionEffect(ef).forEach(l => lines.push(l));
		});
		return lines;
	}

	function effectNumbersHtml(effects) {
		const lines = effectNumbersList(effects);
		if (!lines.length) return '';
		return '<div class="insp-body col-corr-nums"><b>Numbers:</b><ul class="col-corr-num-list">' +
			lines.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul></div>';
	}

	function corruptionBlockHtml(c, nightmare) {
		if (!c) return '';
		return '<div class="insp-block ' + (nightmare ? 'combo' : 'corruption') + '"><div class="insp-label">' + (nightmare ? 'Nightmare Corruption' : 'Corruption') + ' — ' + esc(c.displayName) + '</div>' +
			'<div class="insp-body"><b>Benefit:</b> ' + esc(c.benefitDescription) + '</div>' +
			'<div class="insp-body drawback"><b>Drawback:</b> ' + esc(c.drawbackDescription) + '</div>' +
			effectNumbersHtml(c.effects) + '</div>';
	}

	function tokensFor(key, val) {
		const out = [];
		if (typeof val !== 'number' || !isFinite(val)) return out;
		const int = Math.round(val);
		const pct = Math.round(val * 1000) / 10;
		if (isPctKey(key, val)) {
			out.push('+' + (pct % 1 ? pct.toFixed(1) : Math.round(pct)) + '%');
			out.push((pct % 1 ? pct.toFixed(1) : String(Math.round(pct))) + '%');
		}
		if (Math.abs(val - int) < 0.001 && int >= 0 && int <= 20) {
			out.push(ordinal(int));
			if (WORD_NUM[int]) out.push(WORD_NUM[int]);
			out.push(String(int));
		} else {
			const f = (Math.round(val * 100) / 100).toString();
			out.push(f);
		}
		return out;
	}

	function replaceOnce(hay, needle, repl) {
		const i = hay.toLowerCase().indexOf(needle.toLowerCase());
		if (i < 0) return hay;
		return hay.slice(0, i) + repl + hay.slice(i + needle.length);
	}

	function variantEffectHtml(def, variantId) {
		const raw = def.effectText || 'None.';
		if (!variantId || !VARIANTS[variantId]) return esc(raw);
		const variant = VARIANTS[variantId];
		const origFx = clone(def.effects || []);
		const newFx = clone(def.effects || []);
		if (variant.mods) for (const ef of newFx) applyNumericMods(ef, variant.mods);
		let html = esc(raw);
		const swaps = [];
		for (let i = 0; i < origFx.length; i++) {
			const a = origFx[i], b = newFx[i];
			if (!a || !b) continue;
			for (const k of Object.keys(a)) {
				if (typeof a[k] !== 'number' || typeof b[k] !== 'number') continue;
				if (Math.abs(a[k] - b[k]) < 0.0001) continue;
				swaps.push({ key: k, from: a[k], to: b[k], applied: false });
			}
		}
		swaps.sort((x, y) => String(y.from).length - String(x.from).length);
		for (const sw of swaps) {
			const toks = tokensFor(sw.key, sw.from);
			const neu = formatEffectNum(sw.key, sw.to);
			const wrap = '<span class="insp-changed">' + esc(neu) + '</span>';
			for (const tok of toks) {
				if (!tok || tok.length < 1) continue;
				const next = replaceOnce(html, tok, wrap);
				if (next !== html) { html = next; sw.applied = true; break; }
			}
		}
		const extra = [];
		if (variant.description) extra.push(variant.description);
		for (const sw of swaps) {
			extra.push(niceStatName(sw.key) + ' ' + formatEffectNum(sw.key, sw.from) + ' → ' + formatEffectNum(sw.key, sw.to));
		}
		if (variant.flags) {
			for (const fk of Object.keys(variant.flags)) {
				if (FLAG_PHRASES[fk]) extra.push(FLAG_PHRASES[fk]);
			}
		}
		if (extra.length) html += ' <span class="insp-changed">' + esc(extra.join(' ')) + '</span>';
		return html;
	}

	function statRangeRow(def) {
		const stats = (def && def.stats) || {};
		const keys = Object.keys(stats);
		if (!keys.length) return '<div class="col-stat-row"><div class="col-stat-chip">No numeric stats</div></div>';
		return '<div class="col-stat-row">' + keys.map(k => {
			const base = stats[k];
			const lo = Math.max(1, Math.round(base * 0.8));
			const hi = Math.round(base * 1.2);
			const range = lo + '–' + hi;
			const col = STAT_COLORS[k] || '#e8d48a';
			return '<div class="col-stat-chip" style="color:' + col + ';border-color:' + col + '"><span>' + esc(niceStatName(k)) + '</span><b>' + range + '</b></div>';
		}).join('') + '</div>';
	}

	function locationBox(def) {
		const loc = LOCATIONS[def.dungeon] || LOCATIONS.special;
		return '<div class="col-insp-loc scene-' + loc.scene + '">' +
			'<div class="col-loc-label">Found in</div>' +
			'<div class="col-loc-name">' + esc(loc.name) + '</div>' +
			'<div class="col-loc-icon">' + (def.icon || '◆') + '</div>' +
			'<div class="col-loc-blurb">' + esc(loc.blurb) + '</div>' +
			'</div>';
	}

	function collectionGemHtml(gemId, col) {
		const g = GEMS[gemId];
		if (!g) return '<div>Unknown gem</div>';
		col = col || defaultCollection();
		const qs = (col.gemQualities && col.gemQualities[gemId]) || {};
		const rows = GEM_QUALITY_ORDER.map(q => {
			const got = !!qs[q];
			const qn = GEM_QUALITIES[q] ? GEM_QUALITIES[q].name : q;
			const nums = formatGemModList(g.mods, gemQualityMult(q));
			return '<div class="insp-block' + (q === 'perfect' && got ? ' combo' : '') + '"><div class="insp-label">' + (got ? qn : '? ' + qn) + '</div>' +
				'<div class="insp-body">' + (got ? esc(nums) : 'Not discovered') + '</div></div>';
		}).join('');
		return '<div class="insp-head"><div class="insp-icon">' + g.icon + '</div><div><div class="insp-name">' + esc(g.name) + '</div>' +
			'<div class="insp-type">gem · ' + g.rarity + '</div></div></div>' +
			'<div class="insp-block"><div class="insp-label">What it does</div><div class="insp-body">' + esc(g.desc) + '</div>' +
			'<div class="insp-sub">' + esc(formatGemModList(g.mods, 1)) + ' at Normal quality</div></div>' + rows;
	}

	function collectionInspectHtml(itemId, col, view) {
		const def = itemDef(itemId);
		if (!def) return '<div>Unknown item</div>';
		col = col || defaultCollection();
		if (!col.items[itemId]) {
			return '<div class="insp-name">???</div><div class="insp-body">You have not discovered this item yet.</div>';
		}
		view = view || {};
		const pool = def.variantPool || [];
		const ownedVars = pool.filter(v => col.variants[itemId + ':' + v]);
		const liveCorr = itemCorruptions(itemId, false);
		const liveNm = itemCorruptions(itemId, true);
		const ownedCorr = ownedKeys(col.corruptions, itemId).filter(id => liveCorr.indexOf(id) >= 0 && CORRUPTIONS[id]);
		const ownedNm = ownedKeys(col.nightmare, itemId).filter(id => liveNm.indexOf(id) >= 0 && NIGHTMARE_CORRUPTIONS[id]);
		let variantId = view.variantId || null;
		if (variantId && ownedVars.indexOf(variantId) < 0) variantId = null;
		let mode = view.mode || 'normal';
		if (mode === 'corruption' && !ownedCorr.length) mode = 'normal';
		if (mode === 'nightmare' && !ownedNm.length) mode = 'normal';
		let corrId = view.corrId || (mode === 'nightmare' ? ownedNm[0] : ownedCorr[0]) || null;
		if (mode === 'corruption' && ownedCorr.indexOf(corrId) < 0) corrId = ownedCorr[0] || null;
		if (mode === 'nightmare' && ownedNm.indexOf(corrId) < 0) corrId = ownedNm[0] || null;
		const color = (D.RARITY_COLORS && D.RARITY_COLORS[def.rarity]) || '#fff';
		const activeCorr = (mode === 'corruption' || mode === 'nightmare')
			? ((mode === 'nightmare' ? NIGHTMARE_CORRUPTIONS[corrId] : CORRUPTIONS[corrId])
				|| NIGHTMARE_CORRUPTIONS[corrId] || CORRUPTIONS[corrId] || null)
			: null;
		const effectHtml = (activeCorr && activeCorr.effectText)
			? variantEffectHtml({ effectText: activeCorr.effectText, effects: activeCorr.effects || def.effects }, variantId)
			: variantEffectHtml(def, variantId);
		const effectNums = activeCorr ? effectNumbersHtml(activeCorr.effects) : '';
		const varRow = '<div class="col-var-row">' +
			'<button type="button" class="col-var-ico' + (!variantId ? ' on' : '') + '" data-col-var="">Base</button>' +
			pool.map(vid => {
				const v = VARIANTS[vid];
				const got = ownedVars.indexOf(vid) >= 0;
				return '<button type="button" class="col-var-ico' + (variantId === vid ? ' on' : '') + (got ? '' : ' locked') + '" data-col-var="' + (got ? vid : '') + '" ' + (got ? '' : 'disabled') + ' title="' + esc(v ? v.displayName : vid) + '">' +
					(got ? '◆' : '?') + ' ' + esc(v ? v.displayName : vid) + '</button>';
			}).join('') + '</div>';
		const modeRow = '<div class="col-mode-row">' +
			'<button type="button" class="col-mode' + (mode === 'normal' ? ' on' : '') + '" data-col-mode="normal">Normal</button>' +
			'<button type="button" class="col-mode corr' + (mode === 'corruption' ? ' on' : '') + (ownedCorr.length ? '' : ' locked') + '" data-col-mode="corruption" ' + (ownedCorr.length ? '' : 'disabled') + '>Corruption</button>' +
			'<button type="button" class="col-mode nm' + (mode === 'nightmare' ? ' on' : '') + (ownedNm.length ? '' : ' locked') + '" data-col-mode="nightmare" ' + (ownedNm.length ? '' : 'disabled') + '>Nightmare</button>' +
			'</div>';
		let below = '';
		if (mode === 'corruption' || mode === 'nightmare') {
			const list = mode === 'nightmare' ? ownedNm : ownedCorr;
			const poolMap = mode === 'nightmare' ? NIGHTMARE_CORRUPTIONS : CORRUPTIONS;
			below += '<div class="col-corr-picks">';
			list.forEach(id => {
				const c = poolMap[id] || NIGHTMARE_CORRUPTIONS[id] || CORRUPTIONS[id];
				below += '<button type="button" class="col-corr-chip' + (corrId === id ? ' on' : '') + '" data-col-corr="' + id + '">' + esc(c ? c.displayName : id) + '</button>';
			});
			below += '</div>';
			const c = (mode === 'nightmare' ? NIGHTMARE_CORRUPTIONS[corrId] : CORRUPTIONS[corrId]) || NIGHTMARE_CORRUPTIONS[corrId] || CORRUPTIONS[corrId];
			if (c) below += corruptionBlockHtml(c, mode === 'nightmare');
		}
		return (
			'<div class="col-insp" data-col-id="' + esc(itemId) + '" data-col-var="' + esc(variantId || '') + '" data-col-mode="' + mode + '" data-col-corr="' + esc(corrId || '') + '">' +
				'<div class="col-insp-main">' +
					'<div class="insp-head">' +
						'<div class="insp-icon">' + def.icon + '</div>' +
						'<div><div class="insp-name" style="color:' + color + '">' + esc(def.name) + '</div>' +
						'<div class="insp-type">' + def.type + ' · ' + def.rarity + '</div></div>' +
					'</div>' +
					statRangeRow(def) +
					varRow +
					modeRow +
					'<div class="insp-block"><div class="insp-label">What it does</div><div class="insp-body col-effect">' + effectHtml + '</div>' + effectNums + '</div>' +
					below +
					'<div class="insp-block"><div class="insp-label">About</div><div class="insp-body">' + esc(def.desc || '') + '</div></div>' +
				'</div>' +
				locationBox(def) +
			'</div>'
		);
	}

	function esc(s) {
		return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	function tooltipExtra(inst) {
		if (!inst || !inst.itemId) return '';
		const def = itemDef(inst.itemId);
		if (!def) return '';
		let html = '';
		if (def.effectText && def.effectText !== 'None.') html += '<div class="tt-stat" style="color:#f0c060">⚡ ' + esc(def.effectText) + '</div>';
		if (inst.variantId && VARIANTS[inst.variantId]) html += '<div class="tt-stat" style="color:#7ecbff">◆ ' + esc(VARIANTS[inst.variantId].displayName) + ': ' + esc(VARIANTS[inst.variantId].description) + '</div>';
		if (inst.corruptionId) {
			const corr = NIGHTMARE_CORRUPTIONS[inst.corruptionId] || CORRUPTIONS[inst.corruptionId];
			const nums = corr ? effectNumbersList(corr.effects).join(' · ') : '';
			if (inst.nightmare) html += '<div class="tt-stat" style="color:#e070ff">☠ Nightmare' + (corr ? ' — ' + esc(corr.displayName) : '') + (nums ? ': ' + esc(nums) : '') + '</div>';
			else if (!def.isCursed) html += '<div class="tt-stat" style="color:#c0392b">☠ Corrupted' + (corr ? ' — ' + esc(corr.displayName) : '') + (nums ? ': ' + esc(nums) : '') + '</div>';
			else if (corr) html += '<div class="tt-stat" style="color:#c0392b">☠ ' + esc(corr.displayName) + (nums ? ': ' + esc(nums) : '') + '</div>';
		}
		if (def.curseText) html += '<div class="tt-stat" style="color:#ff6b6b">⛓ ' + esc(def.curseText) + '</div>';
		const filled = (inst.gems || []).filter(Boolean).length;
		if (filled) html += '<div class="tt-stat" style="color:#9ad">💎 Gems ' + filled + '/' + (inst.gems.length) + '</div>';
		return html;
	}

	function pickWeighted(map) {
		let total = 0;
		const keys = Object.keys(map);
		for (const k of keys) total += map[k];
		if (total <= 0) return keys[0];
		let r = Math.random() * total;
		for (const k of keys) {
			r -= map[k];
			if (r <= 0) return k;
		}
		return keys[keys.length - 1];
	}

	function itemsFor(dungeon, rarity) {
		const out = [];
		for (const id of Object.keys(ITEMS)) {
			const it = ITEMS[id];
			if (it.rarity !== rarity) continue;
			if (it.rarity === 'mythic') continue;
			if (dungeon && it.dungeon !== dungeon && it.dungeon !== 'special') {
				/* allow any dungeon gear when dungeon is null; otherwise match or earth=jungle */
				if (!(dungeon === 'earth' && it.dungeon === 'earth') && it.dungeon !== dungeon) continue;
			}
			out.push(id);
		}
		return out;
	}

	function allGearIds() {
		return Object.keys(ITEMS).filter(id => ITEMS[id].rarity !== 'mythic');
	}

	function compatibleCorruptions(itemId, nightmare) {
		const def = itemDef(itemId);
		if (!def) return [];
		const pool = nightmare ? NIGHTMARE_CORRUPTIONS : CORRUPTIONS;
		const out = [];
		for (const id of Object.keys(pool)) {
			const c = pool[id];
			if (c.baseItemIds && c.baseItemIds.indexOf(itemId) >= 0) { out.push(id); continue; }
			if (def.isCursed) continue;
			if (c.compatibleTags && def.tags) {
				if (c.compatibleTags.some(t => def.tags.indexOf(t) >= 0)) out.push(id);
			}
		}
		return out;
	}

	function rollGearDrop(opts) {
		opts = opts || {};
		const difficulty = opts.difficulty || 'normal';
		const dungeon = opts.dungeon || null;
		const order = (D.RARITY_ORDER) || { common:0, uncommon:1, rare:2, epic:3, legendary:4, cursed:5 };
		const base = (D.LOOT_WEIGHTS && D.LOOT_WEIGHTS[difficulty]) || D.LOOT_WEIGHTS.normal;
		const weights = Object.assign({}, base);
		if (opts.better) {
			weights.common = (weights.common || 0) * 0.84;
			weights.uncommon = (weights.uncommon || 0) * 1.12;
			weights.rare = (weights.rare || 0) * 1.18;
			weights.epic = (weights.epic || 0) * 1.10;
			if (difficulty === 'easy' || difficulty === 'normal') {
				weights.legendary = 0;
				weights.cursed = 0;
				weights.mythical = 0;
				weights.mythic = 0;
			}
		}
		let rarity = pickWeighted(weights);
		if ((difficulty === 'easy' || difficulty === 'normal') && (order[rarity] || 0) >= (order.legendary || 4)) {
			rarity = (weights.epic > 0) ? 'epic' : 'rare';
		}
		let pool = dungeon ? itemsFor(dungeon, rarity) : allGearIds().filter(id => ITEMS[id].rarity === rarity);
		if (!pool.length) {
			pool = allGearIds().filter(id => ITEMS[id].rarity === rarity);
		}
		if (!pool.length) {
			rarity = 'common';
			pool = allGearIds().filter(id => ITEMS[id].rarity === 'common');
		}
		if (!pool.length) return null;
		const itemId = pool[Math.floor(Math.random() * pool.length)];
		const def = ITEMS[itemId];
		const instOpts = {};
		if (difficulty === 'nightmare' && def.variantPool && def.variantPool.length && Math.random() < ((D.VARIANT_CHANCE && D.VARIANT_CHANCE.nightmare) || 0.40)) {
			instOpts.variantId = def.variantPool[Math.floor(Math.random() * def.variantPool.length)];
		}
		if (Math.random() < ((D.NIGHTMARE_CORRUPT_CHANCE && D.NIGHTMARE_CORRUPT_CHANCE[difficulty]) || 0)) {
			const nm = compatibleCorruptions(itemId, true);
			if (nm.length) {
				instOpts.corruptionId = nm[Math.floor(Math.random() * nm.length)];
				instOpts.nightmare = true;
			}
		} else if (Math.random() < ((D.CORRUPT_CHANCE && D.CORRUPT_CHANCE[difficulty]) || 0)) {
			const cr = compatibleCorruptions(itemId, false);
			if (cr.length) instOpts.corruptionId = cr[Math.floor(Math.random() * cr.length)];
		}
		return createInstance(itemId, instOpts);
	}

	function rollGemDrop(opts) {
		opts = opts || {};
		const difficulty = opts.difficulty || 'normal';
		if (Math.random() > ((D.GEM_DROP_CHANCE && D.GEM_DROP_CHANCE[difficulty]) || 0.1)) return null;
		const ids = Object.keys(GEMS);
		const weights = { common: 40, uncommon: 28, rare: 18, epic: 10, legendary: 4 };
		const byR = {};
		for (const id of ids) {
			const r = GEMS[id].rarity;
			(byR[r] || (byR[r] = [])).push(id);
		}
		if (difficulty === 'easy') { weights.epic = 0; weights.legendary = 0; }
		if (difficulty === 'normal') { weights.legendary = 0; }
		if (difficulty === 'nightmare') { weights.common = 10; weights.legendary = 10; }
		const rarity = pickWeighted(weights);
		const pool = byR[rarity] || byR.common || ids;
		const id = pool[Math.floor(Math.random() * pool.length)];
		const qW = {
			easy: { cracked: 55, normal: 38, refined: 7, pristine: 0, perfect: 0 },
			normal: { cracked: 22, normal: 42, refined: 26, pristine: 9, perfect: 1 },
			hard: { cracked: 8, normal: 28, refined: 34, pristine: 22, perfect: 8 },
			nightmare: { cracked: 0, normal: 12, refined: 30, pristine: 38, perfect: 20 }
		};
		const quality = pickWeighted(qW[difficulty] || qW.normal);
		return { itemId: id, qty: 1, quality: quality };
	}

	function allBaseGearInstances() {
		const list = [];
		for (const id of Object.keys(ITEMS)) {
			if (ITEMS[id].rarity === 'mythic') continue;
			list.push(createInstance(id));
		}
		for (const id of ['lightstep_blade', 'void_nullification', 'chrono_shard']) {
			if (ITEMS[id]) list.push(createInstance(id));
		}
		return list;
	}

	function allGemEntries() {
		return Object.keys(GEMS).map(id => ({ itemId: id, qty: 1, quality: 'perfect' }));
	}

	function equipSlotsFor(instOrId) {
		const id = typeof instOrId === 'string' ? instOrId : instOrId && instOrId.itemId;
		const def = itemDef(id);
		if (!def) return [];
		if (def.slots) return def.slots.slice();
		if (def.type === 'staff') return ['staff'];
		if (def.type === 'robe') return ['robe'];
		if (def.type === 'relic') return ['relic1', 'relic2'];
		return [];
	}

	function resolveEquip(slotVal) {
		if (!slotVal) return null;
		if (typeof slotVal === 'string') return { itemId: slotVal, gems: [null, null] };
		return slotVal;
	}

	function equippedInstances(equipment) {
		const out = [];
		if (!equipment) return out;
		for (const k of ['staff', 'robe', 'relic1', 'relic2']) {
			const inst = resolveEquip(equipment[k]);
			if (inst && inst.itemId) out.push(inst);
		}
		return out;
	}

	function hasEquipped(equipment, itemId) {
		return equippedInstances(equipment).some(i => i.itemId === itemId);
	}

	/* ---------------- Reading a spell ----------------
	   Gear effects talk about what a spell IS (an area spell, a barrage, a burning spell, a lasting one …).
	   Rune spells (the forge) are read from their runes; the old phase spells keep their old reading. */
	const RUNE_CACHE = new WeakMap();
	function isRuneSpell(spell) { return !!(spell && spell.nodes && spell.rootId); }
	function runeTraits(spell) {
		let t = RUNE_CACHE.get(spell);
		if (t && t.seq === spell.seq) return t;
		t = {
			seq: spell.seq, techs: {}, count: 1, divides: 0, zone: false, domain: false, anchored: false, bound: false,
			construct: false, discharge: false, reinforce: false, homing: false, drawOut: false, slow: false,
			energy: 0, leaves: 0, branches: 0, rotate: false, spatialSelf: false, passive: !!spell.passive, types: []
		};
		const nodes = Object.values(spell.nodes || {});
		const kids = {};
		for (const n of nodes) { if (n.parent) kids[n.parent] = (kids[n.parent] || 0) + 1; }
		for (const n of nodes) {
			const P = n.params || {};
			t.types.push(n.type);
			if (!kids[n.id]) t.leaves++;
			if ((kids[n.id] || 0) > 1) t.branches += kids[n.id] - 1;
			switch (n.type) {
				case 'generate': t.energy += +P.amount || 0; break;
				case 'technique': case 'reverseTechnique': {
					const id = P.technique; if (!id) break;
					const neg = n.type === 'reverseTechnique' || (+P.power || 0) < 0;
					t.techs[id + (neg ? '-' : '+')] = true;
					t.techs[id] = true;
					if (id === 'construction') t.construct = true;
					break;
				}
				case 'divide': t.count *= Math.max(1, +P.count || 1); t.divides++; break;
				case 'split': t.count *= Math.max(2, +P.count || 2); t.divides++; break;
				case 'zone': t.zone = true; break;
				case 'domain': t.domain = true; break;
				case 'anchor': if (P.state === 'bound') t.bound = true; else if (P.state === 'anchored') t.anchored = true; break;
				case 'target': if (P.kind === 'enemy') t.homing = true; if (P.kind === 'self' || P.kind === 'caster') t.selfTarget = true; break;
				case 'redirect': if ((+P.speedPct || 100) <= 60 || P.arrive === 'stop') t.slow = true; break;
				case 'discharge': t.discharge = true; break;
				case 'reinforce': case 'infuse': t.reinforce = true; break;
				case 'drawOut': t.drawOut = true; break;
				case 'rotate': t.rotate = true; break;
			}
		}
		t.count = Math.min(60, t.count);
		t.spatialSelf = !!(t.techs['spatial'] && t.selfTarget);
		RUNE_CACHE.set(spell, t);
		return t;
	}
	/* what the old effect words mean for a rune spell */
	function runeHas(t, key) {
		switch (key) {
			case 'burn': return !!t.techs['thermal+'];
			case 'freeze': case 'slow': return !!t.techs['thermal-'] || (key === 'slow' && !!t.techs['gravity+']);
			case 'stun': case 'blind': return !!t.techs['light+'] || t.domain;
			case 'poison': return !!t.techs['antimagic'];
			case 'mark': case 'sticky': case 'bound': return t.bound;
			case 'barrage': case 'spread': return t.count >= 3 && !t.zone && !t.construct;
			case 'rain': return t.count >= 3 && !!t.techs['gravity'];
			case 'orbit': return t.rotate || (t.bound && !t.homing);
			case 'homing': return t.homing;
			case 'ground': case 'stationary': case 'underfoot': return t.anchored || t.zone;
			case 'wall': case 'solidify': case 'summon': case 'allyOrb': return t.construct;
			case 'gravityWell': return !!t.techs['gravity+'];
			case 'domain': return t.domain;
			case 'nova': case 'explosion': case 'ring': case 'meteor': return t.discharge;
			case 'teleport': return !!t.techs['spatial'] && (t.spatialSelf || t.reinforce);
			case 'lifesteal': return t.drawOut;
			case 'beam': return !!t.techs['light'] && !t.discharge;
			case 'shatter': return !!t.techs['thermal-'] && t.discharge;
		}
		return false;
	}

	function classifySpell(spell) {
		if (isRuneSpell(spell)) {
			const t = runeTraits(spell);
			if (t.construct) return 'summon';
			if (t.spatialSelf || (t.reinforce && !t.discharge && !t.zone && t.count === 1 && t.techs['kinetic'])) return 'movement';
			if (t.discharge || t.zone || t.domain) return 'area';
			if (Object.keys(t.techs).filter(k => /[+-]$/.test(k)).length >= 2 || t.bound) return 'effect';
			return 'projectile';
		}
		if (!spell || !spell.phases || !spell.phases.length) return 'projectile';
		const ph = spell.phases[0];
		const shape = ph.shape || 'missile';
		const beh = ph.behavior || 'straight';
		if (shape === 'summon' || shape === 'allyOrb') return 'summon';
		if (beh === 'teleport' || beh === 'transformation') return 'movement';
		if (shape === 'nova' || shape === 'ring' || shape === 'explosion' || shape === 'meteor' || beh === 'ground' || beh === 'rain' || beh === 'underfoot') return 'area';
		if ((ph.effects && ph.effects.length >= 2) || beh === 'control') return 'effect';
		return 'projectile';
	}

	function spellFingerprint(spell) {
		if (!spell) return '';
		try {
			if (isRuneSpell(spell)) {
				const t = runeTraits(spell);
				return 'r:' + (spell.name || '') + ':' + spell.rootId + ':' + t.types.length + ':' + Object.keys(t.techs).sort().join(',');
			}
			return JSON.stringify({
				n: spell.name || '',
				p: (spell.phases || []).map(ph => [ph.shape, ph.behavior, ph.count, ph.power, (ph.effects || []).slice().sort().join(',')])
			});
		} catch (e) { return String(spell.name || ''); }
	}

	function maxCount(spell) {
		if (isRuneSpell(spell)) return runeTraits(spell).count;
		if (!spell || !spell.phases) return 1;
		let n = 1;
		for (const ph of spell.phases) n = Math.max(n, ph.count || 1, ph.aroundSelfCount || 0);
		return n;
	}

	/* how many stages a spell has: phases (old) or branches and delayed steps (runes) */
	function stageCount(spell) {
		if (isRuneSpell(spell)) { const t = runeTraits(spell); return 1 + t.branches + (t.divides ? 1 : 0); }
		return (spell && spell.phases) ? spell.phases.length : 1;
	}

	function spellHas(spell, key) {
		if (isRuneSpell(spell)) return runeHas(runeTraits(spell), key);
		if (!spell || !spell.phases) return false;
		for (const ph of spell.phases) {
			if (ph.shape === key || ph.behavior === key) return true;
			if (ph.effects && ph.effects.indexOf(key) >= 0) return true;
		}
		return false;
	}

	function isPersistentSpell(spell) {
		if (isRuneSpell(spell)) { const t = runeTraits(spell); return t.zone || t.domain || t.construct || t.anchored || t.passive; }
		return spellHas(spell, 'ground') || spellHas(spell, 'rain') || spellHas(spell, 'stationary') ||
			spellHas(spell, 'solidify') || spellHas(spell, 'gravityWell') || spellHas(spell, 'wall') ||
			spellHas(spell, 'domain') || spellHas(spell, 'underfoot');
	}

	function isSlowOrStationary(spell) {
		if (isRuneSpell(spell)) { const t = runeTraits(spell); return t.anchored || t.zone || t.slow || t.construct; }
		if (!spell || !spell.phases) return false;
		for (const ph of spell.phases) {
			if (ph.behavior === 'stationary' || ph.behavior === 'ground' || ph.behavior === 'rain' || ph.behavior === 'underfoot') return true;
			if ((ph.speed || 1) <= 0.7) return true;
		}
		return false;
	}

	function hasDurationEffect(spell) {
		if (isRuneSpell(spell)) { const t = runeTraits(spell); return !!(t.techs['thermal'] || t.techs['light+'] || t.techs['gravity+'] || t.bound || t.domain); }
		if (!spell || !spell.phases) return false;
		const dur = ['burn', 'freeze', 'poison', 'stun', 'blind', 'mark', 'sticky', 'slow'];
		for (const ph of spell.phases) {
			for (const fx of (ph.effects || [])) if (dur.indexOf(fx) >= 0) return true;
		}
		return false;
	}

	/* ---------------- Combat runtime ---------------- */
	const rt = {
		inited: false,
		equipment: null,
		state: {},
		pending: [],
		persist: [],
		combatTimer: 0,
		inCombat: false,
		lastPx: 0,
		lastPy: 0,
		movedFor: 0,
		stillFor: 0,
		stillOrigin: null
	};

	function effectsOfEquipped() {
		const list = [];
		for (const inst of equippedInstances(rt.equipment)) {
			const efs = resolvedEffects(inst);
			const flags = {};
			const variant = inst.variantId ? VARIANTS[inst.variantId] : null;
			if (variant && variant.flags) Object.assign(flags, variant.flags);
			list.push({ inst, effects: efs, gems: gemMods(inst), flags, def: itemDef(inst.itemId) });
		}
		return list;
	}

	function eachEffect(fn) {
		for (const pack of effectsOfEquipped()) {
			for (const ef of pack.effects) fn(ef, pack);
		}
	}

	function banner(text, color) {
		rt.pending.push({ kind: 'banner', text: text, color: color || '#ffcc66' });
	}

	function GearRuntime() {}

	GearRuntime.init = function (equipment, player) {
		rt.inited = true;
		rt.equipment = equipment;
		rt.state = {};
		rt.pending = [];
		rt.persist = [];
		rt.combatTimer = 0;
		rt.inCombat = false;
		if (player) {
			rt.lastPx = player.x;
			rt.lastPy = player.y;
			rt.stillOrigin = { x: player.x, y: player.y };
		}
		rt.movedFor = 0;
		rt.stillFor = 0;
		eachEffect((ef) => {
			if (ef.maxManaMult) rt.state.maxManaMult = Math.min(rt.state.maxManaMult || 1, ef.maxManaMult);
			if (ef.maxHpMult) rt.state.maxHpMult = Math.min(rt.state.maxHpMult || 1, ef.maxHpMult);
		});
	};

	GearRuntime.setEquipment = function (equipment) { rt.equipment = equipment; };

	GearRuntime.consumePending = function () {
		const p = rt.pending;
		rt.pending = [];
		return p;
	};

	GearRuntime.maxManaMult = function () { return rt.state.maxManaMult || 1; };
	GearRuntime.maxHpMult = function () { return rt.state.maxHpMult || 1; };

	GearRuntime.controlBonus = function () {
		let flat = 0, pct = 0;
		eachEffect((ef) => {
			if (ef.type === 'frozenHeart' && rt.state.frozenHeartOn) flat += ef.controlFlat || 0;
			if (ef.type === 'corruptHoarfrost') flat += ef.controlFlat || 0;
			if (ef.type === 'stillness' && rt.state.stillnessOn) pct += ef.controlPct || 0;
		});
		if (rt.state.stillControlAcc) pct += rt.state.stillControlAcc;
		return { flat, pct };
	};

	GearRuntime.effectiveControl = function (base) {
		const b = GearRuntime.controlBonus();
		return Math.round((base + b.flat) * (1 + b.pct));
	};

	GearRuntime.modifyManaCost = function (cost, ctx) {
		ctx = ctx || {};
		let mult = 1;
		const gems = {};
		eachEffect((ef, pack) => {
			Object.assign(gems, pack.gems);
			if (pack.flags.manaCost) mult *= pack.flags.manaCost;
			if (ef.type === 'lastEmber' && rt.state.lastEmberReady) mult = 0;
			if (ef.type === 'hitCheaperSpell' && rt.state.hitCheapReady) mult *= (ef.costMult || 0.85);
			if (ef.type === 'durationEffectDiscount' && rt.state.durationDiscount) mult *= (ef.costMult || 0.90);
			if (ef.type === 'corruptColdBlood') mult *= (ef.costMult || 0.82);
			if (ef.type === 'wildPact' && pack.flags.cycleDiscount && (rt.state.wildStacks || 0) > 0) {
				/* applied on next spell after cycle via wildNextDiscount */
			}
		});
		if (rt.state.wildNextDiscount) {
			mult *= (1 - rt.state.wildNextDiscount);
			rt.state.wildNextDiscount = 0;
		}
		if (gems.manaCost) mult *= (1 + gems.manaCost);
		return Math.max(0, Math.round(cost * mult));
	};

	GearRuntime.canCast = function (spell, slot) {
		const fp = spellFingerprint(spell);
		let blocked = null;
		eachEffect((ef) => {
			if (ef.type === 'wildPact' || ef.type === 'wildChorus') {
				const locked = rt.state.wildLocked || [];
				if (locked.indexOf(fp) >= 0 && (rt.state.wildUnique || []).length < (ef.cycle || 3)) {
					blocked = 'Wild Pact: cast ' + Math.max(0, (ef.cycle || 3) - (rt.state.wildUnique || []).length) + ' different spell(s) first';
				}
			}
			if (ef.type === 'wildEcho') {
				const last = rt.state.echoFp;
				const n = rt.state.echoN || 0;
				const need = ef.repeats || 2;
				if (last && n < need && fp !== last) blocked = 'Echo Oath: recast the same spell first';
				if (last && n >= need && fp === last) blocked = 'Echo Oath: switch spells now';
			}
		});
		return { ok: !blocked, reason: blocked };
	};

	GearRuntime.bloodPay = function (cost, mana, health, maxHealth) {
		let allow = false, pct = 0;
		eachEffect((ef) => {
			if (ef.type === 'corruptBlood') { allow = true; pct = ef.hpCostPct || 0.08; }
		});
		if (!allow || mana >= cost) return { used: false, hp: 0 };
		return { used: true, hp: Math.max(1, Math.round(maxHealth * pct)) };
	};

	GearRuntime.modifyCooldown = function (cd) {
		let mult = 1;
		eachEffect((ef) => {
			if (ef.type === 'corruptChrono') mult *= (ef.cdMult || 0.65);
			if (ef.type === 'longCooldownTrim' && cd > (ef.minSec || 5) * 60) {
				/* trim applied after assignment via onCast */
			}
		});
		return Math.max(1, Math.round(cd * mult));
	};

	GearRuntime.onCast = function (ctx) {
		const spell = ctx.spell;
		const fp = spellFingerprint(spell);
		const now = ctx.frame || 0;
		rt.state.lastCastFrame = now;
		rt.state.lastCastFp = fp;
		rt.state.castCount = (rt.state.castCount || 0) + 1;
		rt.state.recentCasts = (rt.state.recentCasts || []).filter(t => now - t < 4 * 60);
		rt.state.recentCasts.push(now);
		rt.inCombat = true;
		rt.combatTimer = 0;

		eachEffect((ef, pack) => {
			if (ef.type === 'castWindowBonus') {
				const windowF = (ef.windowSec || 3.5) * 60;
				rt.state.heatCasts = (rt.state.heatCasts || []).filter(t => now - t < windowF);
				rt.state.heatCasts.push(now);
				if (!rt.state.heatReady && rt.state.heatCasts.length >= (ef.casts || 3)) rt.state.heatReady = true;
			}
			if (ef.type === 'nthCastBurst') {
				rt.state.burstN = (rt.state.burstN || 0) + 1;
				const need = Math.max(2, Math.round(ef.n || 10));
				if (rt.state.burstN >= need) {
					rt.state.burstN = 0;
					rt.pending.push({
						kind: 'burst', style: ef.kind || 'fireRing',
						power: ef.power || 16, radius: (ef.radius || 72) * (1 + (pack.gems.burstRadius || 0)),
						echo: pack.flags.echo, chain: pack.flags.chain,
						x: ctx.x, y: ctx.y
					});
					banner('Furnace Burst', '#ff8844');
				}
			}
			if (ef.type === 'lastEmber' && rt.state.lastEmberReady) rt.state.lastEmberReady = false;
			if (ef.type === 'hitCheaperSpell' && rt.state.hitCheapReady) rt.state.hitCheapReady = false;
			if (ef.type === 'durationEffectDiscount') {
				if (rt.state.durationDiscount) rt.state.durationDiscount = false;
				if (hasDurationEffect(spell)) rt.state.durationDiscount = true;
			}
			if (ef.type === 'scorchingEcho') {
				if (rt.state.scorchReady && rt.state.scorchFp && rt.state.scorchFp !== fp) {
					rt.state.scorchConsume = true;
				}
				if (spellHas(spell, 'burn')) {
					rt.state.scorchReady = true;
					rt.state.scorchFp = fp;
				}
			}
			if (ef.type === 'retaliateCharge' && rt.state.retaliateReady) {
				rt.state.retaliateConsume = true;
			}
			if (ef.type === 'longCooldownTrim') {
				/* rune spells: big spells (many runes) recover faster; old spells: long cooldowns are trimmed */
				const big = isRuneSpell(spell) ? Object.keys(spell.nodes || {}).length >= (ef.minRunes || 8) : ctx.cooldownFrames > (ef.minSec || 5) * 60;
				if (big) ctx.cooldownFrames = Math.round(ctx.cooldownFrames * (1 - (ef.trim || 0.10)));
			}
			if (ef.type === 'stillDuplicate') {
				if (rt.stillFor >= (ef.stillSec || 1) * 60 && !rt.state.mirrorCd) {
					rt.state.mirrorReady = true;
					rt.state.mirrorCd = Math.round((ef.cooldownSec || 12) * 60);
				}
			}
			if (ef.type === 'plantedCharge') {
				rt.state.plantedOn = rt.stillFor >= (ef.stillSec || 1) * 60;
			}
			if (ef.type === 'thornRetaliation' && rt.state.thornReady) {
				rt.pending.push({ kind: 'thorn', power: ef.power || 0.45, x: ctx.x, y: ctx.y, facing: ctx.facing || 1 });
				rt.state.thornReady = false;
				rt.state.thornCd = Math.round((ef.cooldownSec || 4) * 60);
			}
			if (ef.type === 'rootNetwork' && isPersistentSpell(spell) && ctx.x != null) {
				rt.persist.push({ x: ctx.x, y: ctx.y, frame: now });
				if (rt.persist.length > 8) rt.persist.shift();
				rt.state.rootStacks = (rt.state.rootStacks || 0) + 1;
				if (rt.state.rootStacks >= (ef.stacksNeeded || 3)) {
					rt.state.rootFire = true;
					rt.state.rootStacks = 0;
				}
			}
			if (ef.type === 'nightmareRootSovereign' && isPersistentSpell(spell)) {
				rt.state.sovereignStacks = (rt.state.sovereignStacks || 0) + 1;
				if (rt.persist.length > (ef.maxPersist || 2)) {
					rt.persist.shift();
					rt.state.sovereignStacks = 0;
					banner('Root Sovereign reset', '#88cc66');
				}
			}
			if (ef.type === 'growthStacks') {
				/* incremented on secondary projectile creation */
			}
			if (ef.type === 'adaptiveCasting') {
				if (!rt.state.attune && rt.inCombat) {
					rt.state.attune = classifySpell(spell);
					rt.state.attuneLeft = ef.spells || 3;
					banner('Attunement: ' + rt.state.attune, '#88dd88');
				} else if (rt.state.attuneLeft > 0) {
					rt.state.attuneLeft--;
				}
			}
			if (ef.type === 'wildEcho') {
				const need = ef.repeats || 2;
				if (rt.state.echoFp === fp) rt.state.echoN = (rt.state.echoN || 0) + 1;
				else { rt.state.echoFp = fp; rt.state.echoN = 1; }
				if (rt.state.echoN === need) {
					rt.state.wildNextBonus = ef.bonus || 0.22;
					banner('Echo Oath', '#88eeaa');
				}
			}
			if (ef.type === 'wildChorus') {
				const locked = rt.state.wildLocked || (rt.state.wildLocked = []);
				const unique = rt.state.wildUnique || (rt.state.wildUnique = []);
				if (locked.indexOf(fp) >= 0 && unique.length < (ef.cycle || 3)) {
					rt.state.chorusBonus = 0;
					rt.state.wildPenalty = ef.breakPenalty || 0.28;
					rt.state.wildPenaltyT = Math.round((ef.penaltySec || 6) * 60);
					banner('Chorus broken', '#ff5555');
				} else {
					if (unique.indexOf(fp) < 0) unique.push(fp);
					locked.push(fp);
					if (unique.length >= (ef.cycle || 3)) {
						rt.state.chorusLeft = 3;
						rt.state.chorusBonus = ef.bonus || 0.20;
						rt.state.wildLocked = [];
						rt.state.wildUnique = [];
						banner('Chorus Bind', '#c44dff');
					}
				}
			}
			if (ef.type === 'wildPact') {
				const locked = rt.state.wildLocked || (rt.state.wildLocked = []);
				const unique = rt.state.wildUnique || (rt.state.wildUnique = []);
				if (locked.indexOf(fp) >= 0 && unique.length < (ef.cycle || 3)) {
					rt.state.wildStacks = 0;
					if (ef.repeatPenalty) {
						rt.state.wildPenalty = ef.repeatPenalty;
						rt.state.wildPenaltyT = Math.round((ef.penaltySec || 8) * 60);
						banner('Wild Pact broken', '#ff5555');
					} else {
						banner('Wild Pact reset', '#ff8844');
					}
				} else {
					if (unique.indexOf(fp) < 0) unique.push(fp);
					locked.push(fp);
					if (unique.length >= (ef.cycle || 3)) {
						rt.state.wildStacks = Math.min((ef.maxStacks || 3), (rt.state.wildStacks || 0) + 1);
						rt.state.wildLocked = [];
						rt.state.wildUnique = [];
						if (pack.flags.cycleDiscount) rt.state.wildNextDiscount = pack.flags.cycleDiscount;
						if (pack.flags.cycleThorn) rt.pending.push({ kind: 'thorn', power: 0.4, x: ctx.x, y: ctx.y, facing: ctx.facing || 1 });
						banner('Wild Cycle x' + rt.state.wildStacks, '#66ee88');
					}
				}
			}
			if (ef.type === 'corruptUnstable') {
				rt.state.unstable = Math.min(ef.max || 0.28, (rt.state.unstable || 0) + (ef.perCast || 0.04));
			}
			if (ef.type === 'heatStacks') {
				rt.state.heatActive = true;
			}
		});

		if (rt.state.lastEmberReady) rt.state.lastEmberReady = false;
		return ctx.cooldownFrames;
	};

	GearRuntime.getDamageMult = function (ctx) {
		ctx = ctx || {};
		let mult = 1;
		const hpPct = ctx.hpPct != null ? ctx.hpPct : 1;
		const manaPct = ctx.manaPct != null ? ctx.manaPct : 1;
		const en = ctx.en;
		const spell = ctx.spell;
		const gems = {};
		/* one-shot bonuses (Scorching Echo, Retaliate, Echo Oath, Chorus …) belong to a whole cast: a rune spell
		   can hit many times, so the first hit of a cast captures them and every later hit of that cast reuses them */
		const key = ctx.castKey;
		const cache = rt.castOnce || (rt.castOnce = new Map());
		const cached = key != null && cache.has(key);
		let once = 1;
		eachEffect((ef, pack) => {
			Object.assign(gems, pack.gems);
			const flags = pack.flags || {};
			if (ef.type === 'castWindowBonus' && rt.state.heatReady) {
				mult *= 1 + (ef.damage || 0.12) * (1 + (gems.heatBonus || 0) + (gems.momentum || 0));
			}
			if (ef.type === 'lowHpDamage' && hpPct < (ef.hpPct || 0.5)) mult *= 1 + (ef.damage || 0.08);
			if (ef.type === 'overcast' && (ctx.cost || 0) > (ef.manaThreshold || 100)) mult *= 1 + (ef.damage || 0.15);
			if (ef.type === 'countDamage' && spell) {
				const c = maxCount(spell);
				if (c >= (ef.countHigh || 6)) mult *= 1 + (ef.bonusHigh || 0.30);
				else if (c >= (ef.count || 3)) mult *= 1 + (ef.bonus || 0.20);
			}
			if (!cached && ef.type === 'retaliateCharge' && rt.state.retaliateConsume) once *= 1 + (ef.damage || 0.20);
			if (!cached && ef.type === 'scorchingEcho' && rt.state.scorchConsume) once *= 1 + (ef.damage || 0.15);
			if (ef.type === 'heatStacks') {
				const stacks = rt.state.heatStacks || 0;
				mult *= 1 + stacks * ((ef.perStack || 0.03) * (1 + (gems.heatBonus || 0) + (gems.momentum || 0)));
			}
			if (ef.type === 'alreadyFrozenBonus' && en && (en.slowTimer > 0 || en._gearFrozen)) mult *= 1 + (ef.damage || 0.20);
			if (ef.type === 'brittle' && en && (en.slowTimer > 0 || en._gearFrozen) && !en._brittleUsed) {
				mult *= 1 + (ef.damage || 0.20);
				en._brittleConsume = true;
				if (flags.shatterBurst) rt.pending.push({ kind: 'burst', style: 'iceBurst', power: 14, radius: 54, x: en.x + en.w / 2, y: en.y + en.h / 2 });
			}
			if (ef.type === 'frozenMomentum') {
				mult *= 1 + (rt.state.frostStacks || 0) * (ef.perDamage || 0.04);
			}
			if (ef.type === 'frozenHeart') {
				if (rt.state.frozenHeartOn) {
					mult *= 1 + (ef.stillDamage || 0.40) * (1 + (gems.stillBonus || 0));
				}
			}
			if (ef.type === 'corruptRimeBargain' && en && (en.slowTimer > 0 || en._gearFrozen)) mult *= 1 + (ef.vsFrozen || 0.16);
			if (ef.type === 'nightmareRimeCrown' && en && (en.slowTimer > 0 || en._gearFrozen)) mult *= 1 + (ef.vsFrozen || 0.28);
			if (ef.type === 'nightmareHoarfrost' && spell && spellHas(spell, 'freeze')) mult *= 1 + (ef.iceDamage || 0.22);
			if ((ef.type === 'corruptStillWound' || ef.type === 'nightmareStillTomb') && rt.stillFor > 30) mult *= 1 + (ef.stillBonus || 0.14);
			if (ef.type === 'closeRangeDamage' && ctx.dist != null && ctx.dist <= (ef.range || 110)) {
				mult *= 1 + (ef.damage || 0.08);
			}
			if (ef.type === 'predator' && rt.state.predatorMode === 'near') {
				mult *= 1 + (ef.damage || 0.15);
			}
			if (ef.type === 'wildPact') {
				if ((rt.state.wildStacks || 0) > 0) mult *= 1 + rt.state.wildStacks * (ef.bonus || 0.12);
				if (rt.state.wildPenalty) mult *= (1 - rt.state.wildPenalty);
			}
			if (ef.type === 'corruptGlass') mult *= 1 + (ef.damage || 0.35);
			if (ef.type === 'corruptUnstable') mult *= 1 + (rt.state.unstable || 0);
			if (ef.type === 'corruptLens' && spell) {
				let good = false, bad = false;
				for (const b of (ef.good || [])) if (spellHas(spell, b)) good = true;
				for (const b of (ef.bad || [])) if (spellHas(spell, b)) bad = true;
				if (good) mult *= 1 + (ef.goodBonus || 0.28);
				if (bad) mult *= 1 - (ef.badPenalty || 0.35);
			}
			if (ef.type === 'nightmareGlassInferno') {
				if (!rt.state.glassDisabled && spell && (spellHas(spell, 'burn') || (pack.def && pack.def.dungeon === 'fire'))) {
					mult *= 1 + (ef.fireDamage || 0.40);
				}
			}
			if (ef.type === 'nightmareRootSovereign') {
				if (spell && isPersistentSpell(spell)) mult *= 1 + (ef.persistBonus || 0.30);
				mult *= 1 + Math.min(0.45, (rt.state.sovereignStacks || 0) * 0.08);
			}
			if (ef.type === 'nthDamagingErupt') {
				/* counted on damaging hit */
			}
			if (flags.desperationHp && hpPct < flags.desperationHp) mult *= 1 + (flags.desperationBonus || 0.16);
			if (flags.openingBonus && rt.state.combatHits === 0) mult *= 1 + flags.openingBonus;
			if (flags.momentum) mult *= 1 + Math.min(flags.momentumMax || 5, rt.state.castCount || 0) * flags.momentum;
			if (flags.executePct && en && en.maxHp && en.hp / en.maxHp < flags.executePct) mult *= 1 + (flags.executeBonus || 0.22);
			if (flags.vsBurning && en && en.dots && en.dots.some(d => d.type === 'burn')) mult *= 1 + flags.vsBurning;
			if (flags.vsFrozen && en && en.slowTimer > 0) mult *= 1 + flags.vsFrozen;
			if (flags.precision) mult *= 1 + flags.precision;
			if (flags.behaviorBonus && spell && (spellHas(spell, 'barrage') || spellHas(spell, 'rain') || spellHas(spell, 'orbit') || spellHas(spell, 'homing'))) {
				mult *= 1 + flags.behaviorBonus;
			}
			if (flags.variety && rt.state.lastCastFp && rt.state.lastCastFp !== spellFingerprint(spell)) {
				mult *= 1 + flags.variety;
			}
		});
		if (gems.projectileDamage && ctx.isProjectile) mult *= 1 + gems.projectileDamage;
		if (gems.execute && en && en.maxHp && en.hp / en.maxHp < 0.25) mult *= 1 + gems.execute;
		if (gems.multiPhase && spell && stageCount(spell) > 1) mult *= 1 + gems.multiPhase;
		if (gems.persistPower && spell && isPersistentSpell(spell)) mult *= 1 + gems.persistPower;
		if (gems.variety && rt.state.lastCastFp && spell && rt.state.lastCastFp !== spellFingerprint(spell)) mult *= 1 + gems.variety;
		if (rt.state.glassDisabled) {
			/* already skipped glass inferno */
		}
		if (cached) return mult * cache.get(key);
		if (rt.state.wildNextBonus) { once *= 1 + rt.state.wildNextBonus; rt.state.wildNextBonus = 0; }
		if (rt.state.chorusLeft > 0 && rt.state.chorusBonus) {
			once *= 1 + rt.state.chorusBonus;
			rt.state.chorusLeft--;
		}
		if (key != null) {
			cache.set(key, once);
			if (cache.size > 64) cache.delete(cache.keys().next().value);
		}
		return mult * once;
	};

	GearRuntime.onDamagingHit = function (ctx) {
		const now = ctx.frame || 0;
		rt.state.combatHits = (rt.state.combatHits || 0) + 1;
		rt.inCombat = true;
		rt.combatTimer = 0;
		const en = ctx.en;
		const dmg = ctx.damage || 0;
		eachEffect((ef, pack) => {
			if (ef.type === 'nthDamagingErupt') {
				rt.state.eruptN = (rt.state.eruptN || 0) + 1;
				const need = Math.max(3, Math.round(ef.n || 8));
				const chargeNeed = pack.flags.chargeErupt;
				const ready = chargeNeed ? ((rt.state.eruptCharge || 0) >= chargeNeed) : (rt.state.eruptN >= need);
				if (chargeNeed) rt.state.eruptCharge = (rt.state.eruptCharge || 0) + 1;
				if (ready && en) {
					if (chargeNeed) rt.state.eruptCharge = 0;
					rt.state.eruptN = 0;
					rt.pending.push({
						kind: 'erupt',
						x: en.x + en.w / 2, y: en.y + en.h / 2,
						delay: Math.round((ef.delaySec || 0.55) * 60),
						power: (ef.power || 46) * (1 + (pack.gems.burstPower || 0)),
						radius: (ef.radius || 62) * (1 + (pack.gems.burstRadius || 0)),
						knockUp: ef.knockUp || 30,
						echo: pack.flags.echo,
						chain: pack.flags.chain,
						applyBurn: pack.flags.applyBurn,
						vsBurning: pack.flags.vsBurning
					});
					banner('ERUPTION', '#ff6622');
				}
			}
			if (ef.type === 'ashenPact' && dmg > 0) {
				let pct = ef.restorePct || 0.08;
				if (pack.flags.vsBurning && en && en.dots && en.dots.some(d => d.type === 'burn')) pct += pack.flags.vsBurning;
				rt.pending.push({ kind: 'mana', amount: Math.max(1, dmg * pct) });
			}
			if (ef.type === 'brittle' && en && en._brittleConsume) {
				en.slowTimer = 0;
				en._gearFrozen = false;
				en._brittleUsed = true;
				en._brittleConsume = false;
			}
			if (ef.type === 'predator' && ctx.dist != null) {
				if (ctx.dist > (ef.farRange || 220)) {
					rt.state.predatorMode = 'far';
					rt.state.predatorT = Math.round((ef.durationSec || 3) * 60);
				} else if (ctx.dist < (ef.nearRange || 120)) {
					rt.state.predatorMode = 'near';
					rt.state.predatorT = Math.round((ef.durationSec || 3) * 60);
				}
			}
			if (ef.type === 'castWindowBonus' && rt.state.heatReady) {
				rt.state.heatReady = false;
				rt.state.heatCasts = [];
			}
		});
		if (rt.state.scorchConsume) {
			rt.state.scorchConsume = false;
			rt.state.scorchReady = false;
			rt.state.scorchFp = null;
		}
		if (rt.state.retaliateConsume) {
			rt.state.retaliateConsume = false;
			rt.state.retaliateReady = false;
		}
		if (rt.state.rootFire && en) {
			const origin = rt.persist[0] || { x: en.x, y: en.y };
			rt.pending.push({ kind: 'rootShot', x: origin.x, y: origin.y, tx: en.x + en.w / 2, ty: en.y + en.h / 2, power: 0.55 });
			rt.state.rootFire = false;
			banner('Root Network', '#66cc55');
		}
	};

	GearRuntime.onStatusApplied = function (en, fx, ctx) {
		if (fx === 'freeze' && en) {
			eachEffect((ef) => {
				if (ef.type === 'corruptRimeBargain' || ef.type === 'nightmareRimeCrown') {
					rt.state.selfChill = Math.round((ef.selfSlowSec || 1.4) * 60);
					rt.state.selfChillAmt = ef.selfSlow || 0.18;
					if (ef.shatter && en) rt.pending.push({ kind: 'burst', style: 'iceBurst', power: 16, radius: 50, x: en.x + en.w / 2, y: en.y + en.h / 2 });
				}
			});
			en._gearFrozen = true;
			eachEffect((ef) => {
				if (ef.type === 'frozenMomentum') {
					const stacks = rt.state.frostTimes || (rt.state.frostTimes = []);
					stacks.push((ctx && ctx.frame) || 0);
					if (stacks.length > (ef.max || 5)) stacks.shift();
					rt.state.frostStacks = stacks.length;
				}
			});
		}
		if (fx === 'burn') {
			eachEffect((ef) => {
				if (ef.type === 'scorchingEcho') {
					rt.state.scorchReady = true;
					rt.state.scorchFp = rt.state.lastCastFp;
				}
				if (ef.type === 'nightmareGlassInferno' && en) {
					rt.pending.push({ kind: 'burnChain', en: en, power: 8 });
				}
			});
		}
	};

	GearRuntime.freezeDurationMult = function () {
		let m = 1;
		eachEffect((ef, pack) => {
			if (ef.type === 'corruptRimeBargain') m *= 1 + (ef.freezeDur || 0.22);
			if (ef.type === 'corruptHoarfrost' || ef.type === 'nightmareHoarfrost') m *= 1 + (ef.freezeDur || 0.12);
			if (ef.type === 'freezeDuration') m *= 1 + (ef.bonus || 0.05);
			if (pack.gems.freezeDuration) m *= 1 + pack.gems.freezeDuration;
			if (pack.gems.effectDuration) m *= 1 + pack.gems.effectDuration;
		});
		return m;
	};

	GearRuntime.healMult = function () {
		let m = 1;
		eachEffect((ef, pack) => {
			if (ef.type === 'healBonus') m *= 1 + (ef.bonus || 0.05);
			if (pack.gems.healBonus) m *= 1 + pack.gems.healBonus;
		});
		return m;
	};

	GearRuntime.burnMult = function () {
		let m = 1;
		eachEffect((ef, pack) => {
			if (pack.gems.burnPower) m *= 1 + pack.gems.burnPower;
			if (pack.gems.burnDuration) m *= 1 + pack.gems.burnDuration * 0.5;
		});
		return m;
	};

	GearRuntime.onKill = function (en) {
		if (!en) return;
		const burning = en.dots && en.dots.some(d => d.type === 'burn');
		eachEffect((ef) => {
			if (ef.type === 'manaOnBurningKill' && burning) {
				rt.pending.push({ kind: 'mana', amount: ef.mana || 6 });
			}
			if (ef.type === 'ashenTithe') {
				rt.pending.push({ kind: 'mana', amount: ef.killMana || 28 });
			}
		});
	};

	GearRuntime.onHealed = function (amount) {
		if (!(amount > 0)) return;
		eachEffect((ef) => {
			if (ef.type === 'ashenMercy') {
				rt.pending.push({ kind: 'mana', amount: Math.max(1, amount * (ef.healRestore || 0.55)) });
			}
		});
	};

	GearRuntime.onPlayerDamaged = function (ctx) {
		const dmg = ctx.damage || 0;
		const hpPct = ctx.hpPct != null ? ctx.hpPct : 1;
		const maxHp = ctx.maxHp || 100;
		rt.inCombat = true;
		rt.combatTimer = 0;
		rt.state.lastHitFrame = ctx.frame || 0;
		rt.state.untouched = 0;
		eachEffect((ef, pack) => {
			if (ef.type === 'lastEmber' && hpPct < (ef.hpPct || 0.25) && !rt.state.lastEmberCd) {
				rt.state.lastEmberReady = true;
				rt.state.lastEmberT = Math.round((ef.windowSec || 5) * 60);
				rt.state.lastEmberCd = Math.round((ef.cooldownSec || 30) * 60);
				banner('Last Ember', '#ffaa44');
			}
			if (ef.type === 'retaliateCharge' && !rt.state.retaliateCd) {
				rt.state.retaliateReady = true;
				rt.state.retaliateCd = Math.round((ef.cooldownSec || 5) * 60);
			}
			if (ef.type === 'hitCheaperSpell' && !rt.state.hitCheapCd) {
				rt.state.hitCheapReady = true;
				rt.state.hitCheapCd = Math.round((ef.cooldownSec || 8) * 60);
			}
			if (ef.type === 'thornRetaliation' && !rt.state.thornCd) {
				rt.state.thornReady = true;
			}
			if (ef.type === 'panicShield' && hpPct < (ef.hpPct || 0.25) && !rt.state.panicUsed) {
				rt.state.panicUsed = true;
				rt.state.panicCd = Math.round((ef.cooldownSec || 60) * 60);
				rt.pending.push({ kind: 'shield', amount: Math.round(maxHp * (ef.shieldPct || 0.20)) });
				banner('Frozen Resolve', '#88ddff');
			}
			if (ef.type === 'barkskin' && !rt.state.barkCd && dmg >= maxHp * (ef.hitPct || 0.12)) {
				rt.state.barkT = Math.round((ef.durationSec || 3) * 60);
				rt.state.barkDr = ef.reduction || 0.20;
				rt.state.barkCd = Math.round((ef.cooldownSec || 15) * 60);
				banner('Barkskin', '#88aa66');
			}
			if (ef.type === 'untouchedShield') {
				rt.state.snowShield = 0;
			}
			if (ef.type === 'corruptUnstable') rt.state.unstable = 0;
			if (ef.type === 'ashenPact' && ef.manaLostOnHit) {
				rt.pending.push({ kind: 'manaLosePct', pct: ef.manaLostOnHit });
			}
			if (ef.type === 'nightmareGlassInferno' && dmg >= maxHp * (ef.bigHitPct || 0.16)) {
				rt.state.glassDisabled = Math.round((ef.disableSec || 6) * 60);
				banner('Glass Inferno shattered', '#ff6688');
			}
			if (pack.flags.chargeNext) {
				rt.state.retaliateReady = true;
			}
			if (pack.flags.grantShield && ef.type !== 'panicShield') {
				/* crystal / defensive variants grant a small shield on trigger for defensive items */
			}
		});
	};

	GearRuntime.incomingDamageMult = function (ctx) {
		let m = 1;
		const gems = {};
		eachEffect((ef, pack) => {
			Object.assign(gems, pack.gems);
			if (ef.type === 'slowCastDefense' && ctx && ctx.castingSlow) m *= (1 - (ef.reduction || 0.15));
			if (ef.type === 'stillness' && rt.state.stillnessOn) m *= (1 - (ef.dr || 0.15) * (1 + (pack.gems.dr || 0)));
			if (ef.type === 'frozenHeart' && rt.state.frozenHeartOn && ef.stillDr) m *= (1 - ef.stillDr);
			if (ef.type === 'barkskin' && rt.state.barkT > 0) m *= (1 - (rt.state.barkDr || 0.20));
			if (ef.type === 'corruptGlass') m /= Math.max(0.25, ef.defMult || 0.45);
			if (ef.type === 'nightmareGlassInferno') m /= Math.max(0.25, ef.defMult || 0.40);
			if (pack.flags.grantShield) {
				/* handled as extra shield pending on stillness */
			}
		});
		if (gems.dr) m *= (1 - gems.dr);
		return m;
	};

	GearRuntime.defenseStatMult = function () {
		let m = 1;
		eachEffect((ef) => {
			if (ef.type === 'corruptGlass') m *= (ef.defMult || 0.45);
			if (ef.type === 'nightmareGlassInferno') m *= (ef.defMult || 0.40);
		});
		return m;
	};

	GearRuntime.moveSpeedMult = function () {
		let m = 1;
		eachEffect((ef, pack) => {
			if (ef.type === 'frozenHeart') m *= (1 - (ef.movePenalty || 0.25));
			if (ef.type === 'edgeMoveSpeed') {
				const hp = rt.state.hpPct != null ? rt.state.hpPct : 1;
				if (hp > (ef.highPct || 0.75) || hp < (ef.lowPct || 0.30)) m *= 1 + (ef.bonus || 0.12);
			}
			if (ef.type === 'predator' && rt.state.predatorMode === 'far' && rt.state.predatorT > 0) {
				m *= 1 + (ef.speed || 0.15) * (1 + (pack.gems.moveBonus || 0));
			}
			if (ef.type === 'canopy' ) { /* unused alias */ }
		});
		if (rt.state.selfChill > 0) m *= 1 - (rt.state.selfChillAmt || 0.18);
		return m;
	};

	GearRuntime.manaRegenMult = function () {
		let m = 1;
		let disable = false;
		eachEffect((ef, pack) => {
			if (ef.type === 'ashenPact' || ef.type === 'ashenTithe' || ef.type === 'ashenMercy') disable = true;
			if (ef.type === 'stillness' && rt.state.stillnessOn) m *= 1 + (ef.manaRegenPct || 0.20);
			if (ef.type === 'moveManaRegen' && rt.state.moveRegenT > 0) m *= 1 + (ef.bonus || 0.10);
		});
		if (disable) return 0;
		return m;
	};

	GearRuntime.disableManaRegen = function () {
		let d = false;
		eachEffect((ef) => { if (ef.type === 'ashenPact' || ef.type === 'ashenTithe' || ef.type === 'ashenMercy') d = true; });
		return d;
	};

	GearRuntime.projMods = function (spell) {
		const mods = { size: 1, duration: 1, speed: 1, duplicate: 0 };
		eachEffect((ef, pack) => {
			if (ef.type === 'plantedCharge' && rt.state.plantedOn) {
				mods.size *= 1 + (ef.size || 0.20);
				mods.duration *= 1 + (ef.duration || 0.15);
			}
			if (ef.type === 'growthStacks') {
				mods.size *= 1 + Math.min(ef.max || 3, rt.state.growth || 0) * (ef.per || 0.10);
			}
			if (ef.type === 'frozenMomentum') {
				mods.speed *= 1 + (rt.state.frostStacks || 0) * (ef.perSpeed || 0.02);
			}
			if (ef.type === 'stillDuplicate' && rt.state.mirrorReady) {
				mods.duplicate = ef.damage || 0.5;
				rt.state.mirrorReady = false;
			}
			if (ef.type === 'adaptiveCasting' && rt.state.attune && rt.state.attuneLeft > 0) {
				if (rt.state.attune === 'projectile') mods.speed *= 1 + (ef.projSpeed || 0.15);
				if (rt.state.attune === 'area') mods.size *= 1 + (ef.area || 0.15);
				if (rt.state.attune === 'effect') mods.duration *= 1 + (ef.effectDur || 0.20);
			}
			if (pack.gems.persistDuration && isPersistentSpell(spell)) mods.duration *= 1 + pack.gems.persistDuration;
		});
		if (rt.state.growth) rt.state.growth = 0;
		rt.state.plantedOn = false;
		return mods;
	};

	GearRuntime.onSecondaryProjectile = function () {
		eachEffect((ef) => {
			if (ef.type === 'growthStacks') {
				rt.state.growth = Math.min(ef.max || 3, (rt.state.growth || 0) + 1);
			}
		});
	};

	GearRuntime.noteCastingSlow = function (on) { rt.state.castingSlow = !!on; };
	GearRuntime.isSlowSpell = function (spell) { return isSlowOrStationary(spell); };
	GearRuntime.isPersistentSpell = function (spell) { return isPersistentSpell(spell); };

	GearRuntime.tick = function (ctx) {
		ctx = ctx || {};
		const player = ctx.player;
		if (player) {
			const dx = player.x - rt.lastPx, dy = player.y - rt.lastPy;
			const moved = (dx * dx + dy * dy) > 1.2;
			if (moved) {
				rt.movedFor++;
				rt.stillFor = 0;
				rt.stillOrigin = { x: player.x, y: player.y };
			} else {
				rt.movedFor = 0;
				rt.stillFor++;
			}
			rt.lastPx = player.x;
			rt.lastPy = player.y;
			rt.state.hpPct = ctx.hpPct;
		}
		if (rt.inCombat) {
			rt.combatTimer++;
			if (rt.combatTimer > 8 * 60) {
				rt.inCombat = false;
				rt.state.attune = null;
				rt.state.attuneLeft = 0;
				rt.state.combatHits = 0;
			}
		}

		const now = ctx.frame || 0;
		const dec = (key) => { if (rt.state[key] > 0) rt.state[key]--; };

		dec('lastEmberT'); dec('lastEmberCd'); dec('retaliateCd'); dec('hitCheapCd');
		dec('thornCd'); dec('mirrorCd'); dec('panicCd'); dec('barkT'); dec('barkCd');
		dec('predatorT'); dec('moveRegenT'); dec('wildPenaltyT'); dec('glassDisabled'); dec('selfChill');
		if (rt.state.lastEmberT <= 0) rt.state.lastEmberReady = false;
		if (rt.state.wildPenaltyT <= 0) rt.state.wildPenalty = 0;
		if (rt.state.predatorT <= 0) rt.state.predatorMode = null;
		if (rt.state.panicCd <= 0) rt.state.panicUsed = false;

		eachEffect((ef, pack) => {
			if (ef.type === 'heatStacks') {
				if (rt.state.lastCastFrame && now - rt.state.lastCastFrame < (ef.dropSec || 4) * 60) {
					rt.state.heatAcc = (rt.state.heatAcc || 0) + 1;
					if (rt.state.heatAcc >= (ef.everySec || 2) * 60) {
						rt.state.heatAcc = 0;
						rt.state.heatStacks = Math.min(ef.max || 5, (rt.state.heatStacks || 0) + 1);
					}
				} else {
					rt.state.heatStacks = 0;
					rt.state.heatAcc = 0;
				}
			}
			if (ef.type === 'frozenMomentum') {
				const life = (ef.decaySec || 6) * 60;
				rt.state.frostTimes = (rt.state.frostTimes || []).filter(t => now - t < life);
				rt.state.frostStacks = rt.state.frostTimes.length;
			}
			if (ef.type === 'untouchedShield') {
				if (!rt.state.lastHitFrame || now - rt.state.lastHitFrame >= (ef.delaySec || 4) * 60) {
					if (!rt.state.snowShield) {
						rt.state.snowShield = ef.amount || 18;
						rt.pending.push({ kind: 'shield', amount: rt.state.snowShield });
					}
				}
			}
			if (ef.type === 'stillness') {
				const origin = rt.stillOrigin || { x: player && player.x, y: player && player.y };
				const dist = player ? Math.hypot(player.x - origin.x, player.y - origin.y) : 0;
				rt.state.stillnessOn = rt.stillFor >= (ef.stillSec || 2) * 60 && dist <= (ef.radius || 36);
				if (rt.state.stillnessOn && pack.flags.crystalGuard && (now % 90 === 0)) {
					rt.pending.push({ kind: 'shield', amount: pack.flags.crystalGuard });
				}
				if (rt.state.stillnessOn && pack.flags.stillControl) {
					rt.state.stillControlAcc = Math.min(0.25, (rt.state.stillControlAcc || 0) + pack.flags.stillControl / 60);
				} else if (!rt.state.stillnessOn) {
					rt.state.stillControlAcc = 0;
				}
			}
			if (ef.type === 'frozenHeart') {
				if (ef.invert) {
					if (rt.movedFor > (ef.moveGraceSec || 0.35) * 60 && (rt.state.fhDown || 0) <= 0) {
						rt.state.frozenHeartOn = true;
					} else if (rt.stillFor > 18) {
						rt.state.frozenHeartOn = false;
						rt.state.fhDown = Math.round((ef.downSec || 2.5) * 60);
					}
				} else if (rt.movedFor > (ef.moveGraceSec || 1) * 60) {
					if (rt.state.frozenHeartOn && ef.lingerSec && !rt.state.fhLinger) {
						rt.state.fhLinger = Math.round(ef.lingerSec * 60);
					} else if (!rt.state.fhLinger || rt.state.fhLinger <= 0) {
						if (rt.state.frozenHeartOn && ef.moveHurt) rt.pending.push({ kind: 'hp', amount: ef.moveHurt });
						rt.state.frozenHeartOn = false;
						rt.state.fhDown = Math.round((ef.downSec || 3) * 60);
					}
				} else if (rt.stillFor > 12 && (rt.state.fhDown || 0) <= 0) {
					rt.state.frozenHeartOn = true;
				}
			}
			if (ef.type === 'moveManaRegen') {
				if (rt.movedFor >= (ef.moveSec || 2) * 60) {
					rt.state.moveRegenT = Math.round((ef.durationSec || 3) * 60);
				}
			}
			if (ef.type === 'ashenPact' || ef.type === 'ashenTithe' || ef.type === 'ashenMercy') {
				if ((ctx.mana || 0) <= 0) {
					rt.state.ashenDrainAcc = (rt.state.ashenDrainAcc || 0) + 1;
					if (rt.state.ashenDrainAcc >= 60) {
						rt.state.ashenDrainAcc = 0;
						rt.pending.push({ kind: 'hp', amount: ef.drainHp || 4 });
					}
				} else rt.state.ashenDrainAcc = 0;
			}
			if (ef.type === 'stillDuplicate' && rt.state.mirrorCd > 0) { /* ticking via dec */ }
		});
		if (rt.state.fhLinger > 0) rt.state.fhLinger--;
		if (rt.state.fhDown > 0) rt.state.fhDown--;

		if (rt.movedFor > 8) rt.state.plantedOn = false;
	};

	GearRuntime.isStill = function () { return rt.stillFor > 30; };
	/* the mythic relics' spell boosts, read from rune traits (the old ones matched shapes / behaviours) */
	const RUNE_ITEM_BOOSTS = {
		lightstep_blade: { boost: 1.35, desc: '+35% damage for Kinetic spells and weapon Reinforcement', test: t => !!(t.techs['kinetic'] || t.techs['kinetic+'] || t.reinforce) },
		void_nullification: { boost: 1.40, desc: '+40% damage for Gravity and Discharge spells', test: t => !!(t.techs['gravity'] || t.discharge) },
		chrono_shard: { boost: 1.35, desc: '+35% damage for Spatial and Target-seeking spells', test: t => !!(t.techs['spatial'] || t.homing) }
	};
	GearRuntime.runeItemBoost = function (spell, equipment) {
		if (!isRuneSpell(spell)) return 1;
		const t = runeTraits(spell);
		let m = 1;
		for (const id in RUNE_ITEM_BOOSTS) if (hasEquipped(equipment || rt.equipment, id) && RUNE_ITEM_BOOSTS[id].test(t)) m *= RUNE_ITEM_BOOSTS[id].boost;
		return m;
	};
	GearRuntime.runeItemBoostDesc = function (id) { return RUNE_ITEM_BOOSTS[id] ? RUNE_ITEM_BOOSTS[id].desc : null; };
	GearRuntime.spellTraits = function (spell) { return isRuneSpell(spell) ? runeTraits(spell) : null; };
	GearRuntime.classify = classifySpell;
	GearRuntime.spellHas = spellHas;
	GearRuntime.state = function () { return rt.state; };

	function addGearToInventory(inventory, inst) {
		if (!inst) return;
		if (inst.uid) inventory.push(inst);
		else inventory.push(createInstance(inst.itemId, inst));
	}

	global.mergeGearItems = mergeGearItems;
	global.GearSystem = {
		ITEMS, VARIANTS, CORRUPTIONS, NIGHTMARE_CORRUPTIONS, GEMS, GEM_QUALITIES, GEM_QUALITY_ORDER,
		isGear, isGem, itemDef, rarityOf, uid, clone,
		mergeGearItems, createInstance, displayName, displayRarity,
		getInstanceStats, resolvedEffects, gemMods, inspectHtml, collectionInspectHtml, tooltipExtra,
		collectionTier, unlockAllCollection, pruneCollectionToOwned, itemCorruptions,
		rollGearDrop, rollGemDrop, allBaseGearInstances, allGemEntries,
		equipSlotsFor, resolveEquip, equippedInstances, hasEquipped,
		ensureCollection, discover, discoverGem, defaultCollection,
		parseGemRef, formatGemModList, gemQualityMult, collectionGemHtml,
		addGearToInventory, classifySpell, spellFingerprint,
		RARITY_COLORS: D.RARITY_COLORS, RARITY_ORDER: D.RARITY_ORDER
	};
	global.GearRuntime = GearRuntime;
})(typeof window !== 'undefined' ? window : globalThis);
