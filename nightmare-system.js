/* =============================================================
   NIGHTMARE SYSTEM — enemy mutations, compatibility, ticks
   ============================================================= */
(function (global) {
	'use strict';

	const GENERIC = [
		{ id: 'empowered', name: 'Empowered', desc: 'Attacks are larger and faster.' },
		{ id: 'frenzied', name: 'Frenzied', desc: 'Attack speed rises as health falls.' },
		{ id: 'armored', name: 'Armored', desc: 'A breakable shell must be shattered first.' },
		{ id: 'volatile', name: 'Volatile', desc: 'Explodes in a telegraphed burst on death.' },
		{ id: 'rejuvenating', name: 'Rejuvenating', desc: 'Periodically tries to heal. Interrupt it.' },
		{ id: 'echoing', name: 'Echoing', desc: 'Attacks repeat on a delay along the same path.' },
		{ id: 'splitting', name: 'Splitting', desc: 'At low health, produces a weaker copy once.' },
		{ id: 'enraged', name: 'Enraged', desc: 'Gains a vicious extra pattern at low health.' },
		{ id: 'phasebound', name: 'Phasebound', desc: 'Changes attack rhythm at health thresholds.' },
		{ id: 'vengeful', name: 'Vengeful', desc: 'Repeated spell behaviors briefly resist that behavior.' },
		{ id: 'teleporter', name: 'Blink', desc: 'Periodically relocates after a clear warning.' },
		{ id: 'spellbreaker', name: 'Spellbreaker', desc: 'Can shatter nearby player projectiles.' },
		{ id: 'swarmcaller', name: 'Swarmcaller', desc: 'Summons a limited pack of weaker allies.' }
	];

	const DUNGEON_MUT = {
		fire: [
			{ id: 'nm_burned', name: 'Burned', desc: 'Attacks apply lingering Burn.' },
			{ id: 'nm_overheated', name: 'Overheated', desc: 'Periodically vents a fire ring.' },
			{ id: 'nm_erupting', name: 'Erupting', desc: 'Footsteps leave short-lived magma.' },
			{ id: 'nm_flame_echo', name: 'Flame Echo', desc: 'Projectiles leave a delayed flame copy.' }
		],
		ice: [
			{ id: 'nm_frozen_armor', name: 'Frozen Armor', desc: 'Starts with icy plating that must be broken.' },
			{ id: 'nm_shatter', name: 'Shatterwake', desc: 'Losing Freeze armor bursts ice shards.' },
			{ id: 'nm_rime_echo', name: 'Rime Echo', desc: 'Attacks leave a delayed frost copy.' },
			{ id: 'nm_permafrost', name: 'Permafrost', desc: 'Nearby ground slows you.' },
			{ id: 'nm_deep_freeze', name: 'Deep Freeze', desc: 'Hits apply heavier slow.' }
		],
		earth: [
			{ id: 'nm_rooted', name: 'Rooted', desc: 'Periodically roots nearby players.' },
			{ id: 'nm_sporeburst', name: 'Sporeburst', desc: 'Death releases a poison cloud.' },
			{ id: 'nm_regrowth', name: 'Regrowth', desc: 'Tries to mend, but only a few times.' },
			{ id: 'nm_thorned', name: 'Thorned', desc: 'Melee contact returns thorns.' },
			{ id: 'nm_overgrowth', name: 'Overgrowth', desc: 'Grows larger and slower, hitting harder.' }
		]
	};

	const INCOMPAT = [
		['rejuvenating', 'splitting'],
		['rejuvenating', 'swarmcaller'],
		['splitting', 'swarmcaller'],
		['teleporter', 'frenzied'],
		['nm_regrowth', 'rejuvenating'],
		['nm_frozen_armor', 'armored'],
		['nm_sporeburst', 'volatile'],
		['nm_flame_echo', 'echoing'],
		['nm_rime_echo', 'echoing']
	];

	function dungeonKey(type) {
		if (type === 'fire') return 'fire';
		if (type === 'ice') return 'ice';
		if (type === 'earth' || type === 'jungle') return 'earth';
		return type || 'fire';
	}

	function allForDungeon(dungeon) {
		return GENERIC.concat(DUNGEON_MUT[dungeonKey(dungeon)] || []);
	}

	function compatible(a, b) {
		for (const pair of INCOMPAT) {
			if ((pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a)) return false;
		}
		return true;
	}

	function pickMutations(en, opts) {
		opts = opts || {};
		const difficulty = opts.difficulty || 'normal';
		if (difficulty !== 'nightmare') return [];
		if (en && en.typeDef && en.typeDef.isBoss) return [];
		const dungeon = dungeonKey(opts.dungeon || 'fire');
		const pool = allForDungeon(dungeon);
		const elite = !!(en && (en.jungleElite || en.isMiniBoss || en._elite));
		const mini = !!(en && (en.isMiniBoss || (en.typeDef && en.typeDef.isMiniBoss)));
		let chance = elite ? 0.55 : (mini ? 0.35 : 0.15);
		if (Math.random() > chance) return [];
		const first = pool[Math.floor(Math.random() * pool.length)];
		const picked = [first.id];
		if (elite && Math.random() < 0.22) {
			const rest = pool.filter(m => picked.indexOf(m.id) < 0 && compatible(picked[0], m.id));
			if (rest.length) picked.push(rest[Math.floor(Math.random() * rest.length)].id);
		}
		return picked;
	}

	function applyMutations(en, ids, opts) {
		if (!en || !ids || !ids.length) return;
		en._nmMut = ids.slice();
		en._nm = en._nm || {};
		if (ids.indexOf('armored') >= 0 || ids.indexOf('nm_frozen_armor') >= 0) {
			en._nm.armor = Math.round((en.maxHp || 100) * 0.28);
			en._nm.armorMax = en._nm.armor;
		}
		if (ids.indexOf('nm_overgrowth') >= 0) {
			en.w = Math.round(en.w * 1.2);
			en.h = Math.round(en.h * 1.2);
			en._nm.overgrown = true;
		}
		if (ids.indexOf('rejuvenating') >= 0 || ids.indexOf('nm_regrowth') >= 0) {
			en._nm.healLeft = ids.indexOf('nm_regrowth') >= 0 ? 2 : 3;
			en._nm.healCd = 180 + Math.floor(Math.random() * 80);
		}
		if (ids.indexOf('splitting') >= 0) en._nm.splitDone = false;
		if (ids.indexOf('swarmcaller') >= 0) {
			en._nm.swarm = 0;
			en._nm.swarmCd = 220;
		}
		if (ids.indexOf('teleporter') >= 0) en._nm.blinkCd = 200 + Math.floor(Math.random() * 80);
		if (ids.indexOf('spellbreaker') >= 0) en._nm.breakCd = 160;
		if (ids.indexOf('vengeful') >= 0) en._nm.venge = {};
		if (ids.indexOf('phasebound') >= 0) en._nm.phase = 1;
		en._nm.echoQueue = [];
	}

	function rollAndApply(en, opts) {
		const ids = pickMutations(en, opts);
		if (ids.length) applyMutations(en, ids, opts);
		return ids;
	}

	function label(en) {
		if (!en || !en._nmMut || !en._nmMut.length) return '';
		const names = [];
		const all = GENERIC.concat(DUNGEON_MUT.fire, DUNGEON_MUT.ice, DUNGEON_MUT.earth);
		for (const id of en._nmMut) {
			const m = all.find(x => x.id === id);
			if (m) names.push(m.name);
		}
		return names.join(' / ');
	}

	function damageTakenMult(en, ctx) {
		if (!en || !en._nm) return 1;
		if (en._nm.armor > 0) {
			const hit = (ctx && ctx.damage) || 0;
			const absorb = Math.min(en._nm.armor, hit);
			en._nm.armor -= absorb;
			if (en._nm.armor <= 0) {
				en._nm.armor = 0;
				if (en._nmMut && en._nmMut.indexOf('nm_shatter') >= 0) {
					en._nm.shatterNow = true;
				}
			}
			return 0.35;
		}
		if (en._nm.venge && ctx && ctx.behavior) {
			const rec = en._nm.venge[ctx.behavior];
			if (rec && rec.t > 0 && rec.n >= 3) return 0.55;
		}
		return 1;
	}

	function noteHitBehavior(en, behavior) {
		if (!en || !en._nm || !en._nm.venge || !behavior) return;
		const rec = en._nm.venge[behavior] || (en._nm.venge[behavior] = { n: 0, t: 0 });
		rec.n++;
		if (rec.n >= 3) rec.t = 180;
	}

	function cooldownMult(en) {
		if (!en || !en._nmMut) return 1;
		let m = 1;
		if (en._nmMut.indexOf('frenzied') >= 0 && en.maxHp) {
			const p = en.hp / en.maxHp;
			if (p < 0.25) m *= 0.62;
			else if (p < 0.5) m *= 0.8;
		}
		if (en._nmMut.indexOf('enraged') >= 0 && en.maxHp && en.hp / en.maxHp < 0.3) m *= 0.78;
		if (en._nmMut.indexOf('phasebound') >= 0 && en.maxHp) {
			const p = en.hp / en.maxHp;
			if (p < 0.4) m *= 0.75;
			else if (p < 0.7) m *= 0.9;
		}
		if (en._nmMut.indexOf('empowered') >= 0) m *= 0.92;
		return m;
	}

	function moveMult(en) {
		if (!en || !en._nmMut) return 1;
		let m = 1;
		if (en._nmMut.indexOf('nm_overgrowth') >= 0) m *= 0.82;
		if (en._nmMut.indexOf('frenzied') >= 0 && en.maxHp && en.hp / en.maxHp < 0.35) m *= 1.18;
		if (en._nmMut.indexOf('teleporter') >= 0) m *= 0.95;
		return m;
	}

	function projScale(en) {
		if (!en || !en._nmMut) return 1;
		if (en._nmMut.indexOf('empowered') >= 0) return 1.22;
		return 1;
	}

	function tick(en, api) {
		if (!en || en.dead || !en._nmMut) return;
		const nm = en._nm || (en._nm = {});
		if (nm.venge) {
			for (const k of Object.keys(nm.venge)) {
				if (nm.venge[k].t > 0) nm.venge[k].t--;
				else nm.venge[k].n = Math.max(0, nm.venge[k].n - 1);
			}
		}
		if ((en._nmMut.indexOf('rejuvenating') >= 0 || en._nmMut.indexOf('nm_regrowth') >= 0) && nm.healLeft > 0) {
			nm.healCd--;
			if (nm.healCd <= 0 && en.hp < en.maxHp * 0.85) {
				nm.healLeft--;
				nm.healCd = 260;
				nm.healing = 70;
				if (api && api.banner) api.banner(en, 'Healing — interrupt!', '#66ff99');
			}
		}
		if (nm.healing > 0) {
			nm.healing--;
			if (nm.healing === 35 && !nm.healInterrupted) {
				en.hp = Math.min(en.maxHp, en.hp + en.maxHp * 0.12);
				if (api && api.flash) api.flash(en, '#66ff99');
			}
			if (nm.interrupted) {
				nm.healing = 0;
				nm.healInterrupted = true;
				nm.interrupted = false;
			}
		}
		if (en._nmMut.indexOf('teleporter') >= 0) {
			nm.blinkCd--;
			if (nm.blinkCd === 40 && api && api.warnBlink) api.warnBlink(en);
			if (nm.blinkCd <= 0 && api && api.blink) {
				api.blink(en);
				nm.blinkCd = 240 + Math.floor(Math.random() * 80);
			}
		}
		if (en._nmMut.indexOf('spellbreaker') >= 0) {
			nm.breakCd--;
			if (nm.breakCd <= 0 && api && api.breakProjectiles) {
				api.breakProjectiles(en, 70);
				nm.breakCd = 200;
			}
		}
		if (en._nmMut.indexOf('swarmcaller') >= 0 && nm.swarm < 2) {
			nm.swarmCd--;
			if (nm.swarmCd <= 0 && api && api.spawnMinion) {
				api.spawnMinion(en);
				nm.swarm++;
				nm.swarmCd = 320;
			}
		}
		if (en._nmMut.indexOf('nm_overheated') >= 0) {
			nm.ventCd = (nm.ventCd || 180) - 1;
			if (nm.ventCd <= 0 && api && api.fireRing) {
				api.fireRing(en);
				nm.ventCd = 200;
			}
		}
		if (en._nmMut.indexOf('nm_rooted') >= 0) {
			nm.rootCd = (nm.rootCd || 210) - 1;
			if (nm.rootCd <= 0 && api && api.rootPulse) {
				api.rootPulse(en);
				nm.rootCd = 240;
			}
		}
		if (en._nmMut.indexOf('nm_permafrost') >= 0 && api && api.chillAura) api.chillAura(en);
		if (nm.shatterNow && api && api.iceBurst) {
			api.iceBurst(en);
			nm.shatterNow = false;
		}
	}

	function onDeath(en, api) {
		if (!en || !en._nmMut) return;
		if (en._nmMut.indexOf('volatile') >= 0 && api && api.deathBurst) api.deathBurst(en, 'fire');
		if (en._nmMut.indexOf('nm_sporeburst') >= 0 && api && api.deathBurst) api.deathBurst(en, 'poison');
		if (en._nmMut.indexOf('splitting') >= 0 && en._nm && !en._nm.splitDone && api && api.splitOnce) {
			en._nm.splitDone = true;
			api.splitOnce(en);
		}
	}

	function echoAttack(en, shot, api) {
		if (!en || !en._nmMut) return;
		if (en._nmMut.indexOf('echoing') >= 0 || en._nmMut.indexOf('nm_flame_echo') >= 0 || en._nmMut.indexOf('nm_rime_echo') >= 0) {
			if (api && api.queueEcho) api.queueEcho(en, shot, 120);
		}
	}

	function bossUpgrade(en, dungeon) {
		if (!en || !en.typeDef || !en.typeDef.isBoss) return null;
		const map = {
			fire: { id: 'boss_inferno', name: 'Nightmare Inferno', desc: 'The boss vents extra eruptions between patterns.' },
			ice: { id: 'boss_absolute', name: 'Nightmare Absolute', desc: 'The boss locks floors in spreading frost.' },
			earth: { id: 'boss_wild', name: 'Nightmare Wildgrowth', desc: 'The boss seeds extra thorn zones.' }
		};
		const up = map[dungeonKey(dungeon)];
		if (!up) return null;
		en._nmBoss = up.id;
		en._nmMut = en._nmMut || [];
		if (en._nmMut.indexOf(up.id) < 0) en._nmMut.push(up.id);
		return up;
	}

	global.NightmareSystem = {
		GENERIC, DUNGEON_MUT, rollAndApply, applyMutations, pickMutations,
		label, damageTakenMult, noteHitBehavior, cooldownMult, moveMult, projScale,
		tick, onDeath, echoAttack, bossUpgrade, dungeonKey
	};
})(typeof window !== 'undefined' ? window : globalThis);
