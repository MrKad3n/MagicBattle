/* =============================================================
   Canonical spell mana / control costs
   Loaded by dungeon.html and inventory.html so the hotbar, inventory
   list, and spell builder all charge and display the same numbers.
   ============================================================= */

const SHAPE_MANA = {
	missile:5, orb:8, blade:7, beam:10, ring:12, cone:10, nova:15, chain:18,
	wall:12, spike:8, allyOrb:6, polygon:9, meteor:16, vortex:18, same:0,
	explosion:14, slash:7, summon:20
};
const SHAPE_CTRL = {
	missile:0, orb:1, blade:2, beam:4, ring:5, cone:4, nova:7, chain:9,
	wall:6, spike:3, allyOrb:1, polygon:3, meteor:6, vortex:7, same:0,
	explosion:5, slash:2, summon:8
};
const BEH_MANA = {
	straight:0, lob:2, homing:5, boomerang:4, groundSurge:5, orbit:8, rain:8,
	barrage:8, stationary:0, underfoot:3, selfCast:2, aroundSelf:6, ground:4,
	zigzag:5, spiral:6, teleport:7, control:30, domain:1000, transformation:1000
};
const BEH_CTRL = {
	straight:0, lob:1, homing:3, boomerang:3, groundSurge:4, orbit:6, spiral:5,
	rain:7, barrage:7, stationary:0, underfoot:2, selfCast:1, aroundSelf:3,
	ground:3, zigzag:4, teleport:6, control:3, domain:10, transformation:10
};
const FX_MANA = {
	burn:36, freeze:36, knockback:8, pull:10, poison:36, stun:54, healSelf:15,
	shield:15, lifesteal:48, timedRelease:8, phaseFork:6, resetProjectiles:0,
	forceJump:10, randomDelay:5, evenDelay:5, phaseThrough:35, damageStore:10,
	damageRelease:15, damageHeal:12, dispel:45, ricochet:35, shatter:60,
	gravityWell:120, classDisable:0, rotate:8, solidify:0, awayFromPlayer:5,
	solidObjectBreak:100, sticky:35, blind:6, mark:5
};
const FX_CTRL = {
	burn:2, freeze:2, knockback:1, pull:3, poison:3, stun:5, healSelf:4, shield:4,
	lifesteal:3, timedRelease:2, phaseFork:5, resetProjectiles:0, forceJump:2,
	randomDelay:1, evenDelay:1, phaseThrough:6, damageStore:2, damageRelease:4,
	damageHeal:3, dispel:4, ricochet:6, shatter:6, gravityWell:7, classDisable:0,
	rotate:2, solidify:4, awayFromPlayer:2, solidObjectBreak:1, sticky:5, blind:5,
	mark:4
};

function groundRadiusMana(radius){
	const r = radius || 200;
	if(r <= 200) return 0;
	const t = r / 200;
	return Math.round((t * t * t - 1) * 40);
}

function phaseSpeedMana(ph, powerMax, speedCap){
	const s = Math.max(0.1, Number(ph && ph.speed) || 1);
	const sMax = Math.max(1.1, Number(speedCap) || 10);
	const t = Math.max(0, Math.min(1, (s - 1) / (sMax - 1)));
	const isArea = ph && (ph.behavior === 'rain' || ph.behavior === 'barrage');
	const ec = phaseEffectiveCount(ph);
	const countMult = 1 + (ec - 1) * (isArea ? 0.1 : 0.4);
	return (powerMax || 10) * 50 * countMult * t * t;
}

function phasePowerCap(spell, phaseIdx){
	if(spell && spell.phases && spell.phases[0] && spell.phases[0].behavior === 'domain' && phaseIdx > 0) return 10;
	return (spell && spell.isUltimate) ? 20 : 10;
}

function phaseEffectiveCount(ph){
	if(!ph) return 1;
	if(ph.behavior === 'aroundSelf') return Math.max(1, ph.aroundSelfCount || 4);
	if(ph.shape === 'same') return 1;
	return Math.max(1, ph.count || 1);
}

function isNecroCaster(opts){
	if(opts && (opts.mageClass === 'necromancer' || opts.mageClass2 === 'necromancer')) return true;
	if(typeof STATE !== 'undefined' && STATE && (STATE.mageClass === 'necromancer' || STATE.mageClass2 === 'necromancer')) return true;
	if(typeof playerData !== 'undefined' && playerData && (playerData.mageClass === 'necromancer' || playerData.mageClass2 === 'necromancer')) return true;
	return false;
}

function calcPhaseRawMana(spell, ph, phaseIdx, opts){
	opts = opts || {};
	if(!ph) return 0;
	let cost = 0;
	cost += SHAPE_MANA[ph.shape] || 0;
	cost += ph.behavior === 'aroundSelf'
		? (BEH_MANA.aroundSelf || 0) * (ph.aroundSelfCount || 4)
		: (BEH_MANA[ph.behavior] || 0);
	const isAreaBeh = ph.behavior === 'rain' || ph.behavior === 'barrage';
	const isSame = ph.shape === 'same';
	const effectiveCount = phaseEffectiveCount(ph);
	const countMult = 1 + (effectiveCount - 1) * (isAreaBeh ? 0.1 : 0.4);
	const cW = isSame ? 1 : (ph.width || 1);
	const cH = isSame ? 1 : (ph.height || 1);
	const power = Number(ph.power);
	const necroSummon = ph.shape === 'summon' && isNecroCaster(opts);
	const necroTypeId = ph.necroSummonType && ph.necroSummonType !== 'random' && ph.necroSummonType !== 'choose' ? ph.necroSummonType : '';
	const necroCaps = necroSummon
		? necroSummonStatCaps(necroTypeId || 'imp', !!(opts.isUltimate || opts.slot === 9 || (spell && spell.isUltimate)))
		: null;
	const powerCost = (Number.isFinite(power) ? power : 1) * 50 * countMult;
	const necroStatMult = necroSummon ? necroBuffManaMult(necroCaps.points) : 1;
	const necroFlatMult = necroSummon ? Math.min(1, necroStatMult / 3) : 1;
	cost += necroSummon ? powerCost * necroStatMult : powerCost;
	cost += (effectiveCount - 1) * (isAreaBeh ? 1 : 4);
	if(necroSummon){
		cost += necroSizeManaCost(cW, necroCaps.sizeMax) * necroFlatMult;
		cost += necroSizeManaCost(cH, necroCaps.sizeMax) * necroFlatMult;
		cost += phaseSpeedMana(ph, phasePowerCap(spell, phaseIdx), necroCaps.speedMax) * necroFlatMult;
	} else {
		cost += (cW - 1) * 6 + Math.max(0, cW - 2) * 4;
		cost += (cH - 1) * 6 + Math.max(0, cH - 2) * 4;
		cost += phaseSpeedMana(ph, phasePowerCap(spell, phaseIdx));
	}
	cost += Math.max(0, (ph.duration || 1) - 1) * 22 * necroFlatMult;
	if(ph.shape === 'chain' && ph.chainStunTime > 0) cost += ph.chainStunTime * 25;
	if(ph.behavior === 'ground') cost += groundRadiusMana(ph.groundRadius);
	if(ph.shape === 'summon'){
		const statCost = (ph.summonRange || 0) * 4;
		cost += necroSummon ? statCost * necroStatMult : statCost;
	}
	const fxList = ph.effects || [];
	for(const fx of fxList) cost += FX_MANA[fx] || 0;
	if(fxList.includes('solidify')){
		const solNonOutward = new Set(['stationary', 'underfoot', 'selfCast', 'aroundSelf', 'ground']);
		cost += solNonOutward.has(ph.behavior) ? 10 : 100;
		if(ph.shape === 'beam') cost += 180;
	}
	if(ph.behavior === 'rain' && ph.stackedRain) cost += 50;
	if(fxList.includes('phaseFork')){
		const beamForkMult = ph.shape === 'beam' ? 2.5 : 1;
		cost += (ph.phaseForkRepeats || 1) * 35 * beamForkMult;
	}
	if(fxList.includes('gravityWell'))
		cost += (ph.power || 1) * 14 + Math.max(0, (ph.width || 1) - 1) * 10 + Math.max(0, (ph.height || 1) - 1) * 10;
	return cost;
}

function spellPhaseMult(spell){
	const n = (spell && spell.phases && spell.phases.length) || 0;
	return 0.6 + n * 0.25;
}

function spellExtraPhaseCost(spell){
	if(!spell || !spell.phases || spell.phases.length <= 1) return 0;
	const fp0 = spell.phases[0];
	const fp0c = phaseEffectiveCount(fp0);
	const fp0fork = (fp0.effects || []).includes('phaseFork') ? (1 + (fp0.phaseForkRepeats || 1)) : 1;
	const fp0tot = fp0c * fp0fork;
	const phCountCost = fp0tot * Math.pow(Math.max(1, fp0tot) / 10, 0.65) * 0.15;
	return (spell.phases.length - 1) * phCountCost;
}

function spellCrossPhaseCost(spell){
	if(!spell || !spell.phases || !spell.phases.length) return 0;
	const totalProj = spell.phases.reduce((prod, ph) => {
		const forkMult = (ph.effects || []).includes('phaseFork') ? (1 + (ph.phaseForkRepeats || 1)) : 1;
		return prod * phaseEffectiveCount(ph) * forkMult;
	}, 1);
	const maxPow = Math.max(...spell.phases.map(ph => ph.power || 1));
	return totalProj * totalProj * maxPow * 0.02;
}

function calcSpellManaCost(spell, opts){
	if(!spell || !spell.phases || !spell.phases.length) return 0;
	let cost = 5;
	for(let i = 0; i < spell.phases.length; i++){
		cost += calcPhaseRawMana(spell, spell.phases[i], i, opts);
	}
	cost *= spellPhaseMult(spell);
	cost += spellExtraPhaseCost(spell);
	cost += spellCrossPhaseCost(spell);
	return Math.round(cost);
}

function calcSpellCost(spell){ return calcSpellManaCost(spell); }

function calcSpellControlReq(spell){
	if(!spell || !spell.phases || !spell.phases.length) return 0;
	let req = 0;
	for(const ph of spell.phases){
		req = Math.max(req, SHAPE_CTRL[ph.shape] || 0, BEH_CTRL[ph.behavior] || 0);
		for(const fx of (ph.effects || [])) req = Math.max(req, FX_CTRL[fx] || 0);
	}
	req += (spell.phases.length - 1) * 3;
	return req;
}

function calcSpellCtrl(spell){ return calcSpellControlReq(spell); }

function spellHasBehavior(spell, beh){
	return !!(spell && spell.phases && spell.phases.some(p => p.behavior === beh));
}

function spellManaDiscountMult(opts){
	opts = opts || {};
	const stats = opts.stats || {};
	const controlDiscount = Math.max(0.3, 1 - (stats.magicControl || 0) * 0.015);
	const vowMana = Math.max(0.1, 1 - (opts.slotManaCost || 0) * 0.05);
	const vowGlobal = Math.max(0.1, 1 - (opts.manaEfficiency || 0) * 0.025);
	return controlDiscount * vowMana * vowGlobal;
}

function isFlatUltimateMana(spell){
	return spellHasBehavior(spell, 'domain') || spellHasBehavior(spell, 'transformation');
}

function displayedSpellMana(spell, opts){
	opts = opts || {};
	if(!spell || !spell.phases || !spell.phases.length) return 0;
	const isUlt = !!(opts.isUltimate || (opts.slot === 9 && spell.isUltimate));
	if(isUlt && isFlatUltimateMana(spell)){
		if((opts.mageClass === 'necromancer') && spellHasBehavior(spell, 'domain')) return 50000;
		return 25000;
	}
	const discounted = Math.round(calcSpellManaCost(spell, opts) * spellManaDiscountMult(opts));
	return isUlt ? discounted * 10 : discounted;
}

function phaseManaShares(spell, opts){
	const total = displayedSpellMana(spell, opts);
	const n = (spell && spell.phases && spell.phases.length) || 0;
	if(!n) return [];
	const raws = spell.phases.map((ph, i) => Math.max(0, calcPhaseRawMana(spell, ph, i, opts)));
	const sum = raws.reduce((a, b) => a + b, 0);
	if(sum <= 0){
		const even = Math.floor(total / n);
		const shares = new Array(n).fill(even);
		shares[n - 1] = total - even * (n - 1);
		return shares;
	}
	const exact = raws.map(r => total * r / sum);
	const floors = exact.map(Math.floor);
	let used = floors.reduce((a, b) => a + b, 0);
	const order = exact.map((e, i) => ({ i, frac: e - floors[i] })).sort((a, b) => b.frac - a.frac);
	for(let k = 0; k < total - used; k++) floors[order[k % n].i]++;
	return floors;
}

/* =============================================================
   Necromancer summon point costs
   Basic fire trash = 1, Fire Dragon = 5, Zenith-tier bosses = 15.
   Regular necro summons share a 15-point cap. Domain summons
   use a separate 50-point cap.
   ============================================================= */
const NECRO_POINT_CAP = 15;
const NECRO_DOMAIN_POINT_CAP = 50;
const SUMMON_POINT_VALUES = {
	imp:1, flameSerpent:1, emberMage:1, fireSprite:1, magmaGolem:2, cinderBeetle:2, furnaceLeech:1, ashRevenant:2, magmaHarvester:2, fireDragon:5,
	frostWraith:1, iceArcher:1, snowBeast:1, cryoMage:1, glacierSentinel:1, frostMantis:1, glacierEel:1, crystalScarab:1, snowboundMimic:1, frostColossus:5,
	rockGolem:1, vineCrawler:1, caveSpider:1, crystalMage:1, mudElemental:1, earthColossus:5, verdantColossus:5,
	ironSentinel:2, forgeDrone:1, slagBrute:2, ironColossus:8,
	thornWolf:1, sporeFungus:1, mossWraith:1, willowWisp:1, glowBeetle:1, stalactiteBat:1, barkbackBeetle:1, pollenMoth:1, rootParasite:1, jungleChameleon:1,
	skyVine:1, windSylph:1, elderTreant:5, stormRaptor:5, deepRootHorror:8,
	darkVineCrawler:2, darkThornWolf:2, darkMossWraith:2,
	boneWraith:1, babyDragon:5,
	flameSalamander:1, magmaImp:1, fireColossus:8,
	abyssalGuardian:2, coralSentinel:2, depthSerpent:2,
	sandWraith:3, tombGuardian:3, desertSerpent:3, mummyWarrior:3, scarabSwarm:2, sandstormDjinn:3,
	seraphel:15, voidArbiter:12, infernalKitten:15, zenith:15,
};

function getSummonPointCost(typeId){
	if(typeId && SUMMON_POINT_VALUES[typeId] != null) return SUMMON_POINT_VALUES[typeId];
	return 1;
}

function isUltOnlyNecroType(typeId){
	return getSummonPointCost(typeId) >= 12;
}

function necroSummonStatCaps(typeId, isUlt){
	const pts = getSummonPointCost(typeId);
	const raid = isUltOnlyNecroType(typeId);
	const expanded = !!(isUlt && pts < 6 && !raid);
	return {
		sizeMax: expanded ? (9 - pts) : 2,
		powerMax: expanded ? (20 + (5 - pts) * 5) : (isUlt ? 20 : 10),
		speedMax: expanded ? (10 + (5 - pts) * 2) : 10,
		durMax: isUlt ? 90 : 60,
		points: pts,
		expanded,
		ultOnly: raid
	};
}

function necroBuffManaMult(points){
	const p = Math.max(1, Number(points) || 1);
	return Math.pow(p, Math.log(3) / Math.log(5));
}

function necroSizeManaCost(size, sizeMax){
	const s = Number(size);
	const val = Number.isFinite(s) ? s : 1;
	const max = Math.max(0.4, Number(sizeMax) || 2);
	const t = Math.max(0, Math.min(1, (val - 0.3) / (max - 0.3)));
	const equiv = 0.3 + t * (2 - 0.3);
	return (equiv - 1) * 6 + Math.max(0, equiv - 2) * 4;
}

/* Combat HP / boss flags. Used when ENEMY_TYPES is not loaded (inventory). */
const SUMMON_HP = {
	imp:350, flameSerpent:480, emberMage:300, magmaGolem:1100, fireSprite:200, cinderBeetle:720, furnaceLeech:180, ashRevenant:540, magmaHarvester:980, fireDragon:15000,
	frostWraith:200, iceArcher:170, snowBeast:600, cryoMage:160, glacierSentinel:700, frostMantis:280, glacierEel:460, crystalScarab:400, snowboundMimic:340, frostColossus:15000,
	rockGolem:700, vineCrawler:200, caveSpider:80, crystalMage:170, mudElemental:400, earthColossus:15000, verdantColossus:20000,
	ironSentinel:800, forgeDrone:350, slagBrute:1200, ironColossus:25000,
	thornWolf:224, sporeFungus:280, mossWraith:176, willowWisp:112, glowBeetle:144, stalactiteBat:96, barkbackBeetle:520, pollenMoth:240, rootParasite:300, jungleChameleon:380,
	skyVine:208, windSylph:144, elderTreant:4000, stormRaptor:4000, deepRootHorror:25000,
	darkVineCrawler:800, darkThornWolf:900, darkMossWraith:700,
	boneWraith:280, babyDragon:5000,
	flameSalamander:600, magmaImp:450, fireColossus:20000,
	abyssalGuardian:850, coralSentinel:750, depthSerpent:700,
	sandWraith:1800, tombGuardian:3000, desertSerpent:2200, mummyWarrior:2600, scarabSwarm:1500, sandstormDjinn:3500,
	seraphel:85000, voidArbiter:50000, infernalKitten:80000, zenith:120000
};
const SUMMON_BOSS = {
	fireDragon:1, frostColossus:1, earthColossus:1, verdantColossus:1, ironColossus:1,
	elderTreant:1, stormRaptor:1, deepRootHorror:1, babyDragon:1, fireColossus:1,
	seraphel:1, voidArbiter:1, infernalKitten:1, zenith:1
};

function playerMaxManaEstimate(opts){
	if(opts && opts.maxMana != null && isFinite(opts.maxMana)) return opts.maxMana;
	if(typeof maxMana === 'number' && isFinite(maxMana)) return maxMana;
	let penalty = 0;
	const vows = (typeof STATE !== 'undefined' && STATE && STATE.vows)
		|| (typeof playerData !== 'undefined' && playerData && playerData.vows)
		|| [];
	for(const v of vows){
		if(v && v.sacrifice === 'maxMana') penalty += v.amount || 0;
	}
	const dv = (typeof STATE !== 'undefined' && STATE && STATE.domainVow)
		|| (typeof playerData !== 'undefined' && playerData && playerData.domainVow);
	if(dv){
		if(dv.sacrifices && dv.sacrifices.maxMana > 0) penalty += dv.sacrifices.maxMana;
		else if(dv.sacrifice === 'maxMana') penalty += dv.amount || 0;
	}
	return Math.max(100, 1500 - penalty);
}

function optionalGlobal(name){
	try {
		if(typeof window !== 'undefined' && window[name] != null) return window[name];
	} catch(e){}
	return null;
}

function getNecroSummonStats(idOrEt){
	const id = typeof idOrEt === 'string' ? idOrEt
		: (idOrEt && (idOrEt.id || idOrEt.type || idOrEt.necroType)) || null;
	let name = '', hp = 0, boss = false;
	const enemyTypes = optionalGlobal('ENEMY_TYPES');
	if(id && enemyTypes && enemyTypes[id]){
		const et = enemyTypes[id];
		name = et.name || id;
		hp = et.hp || 0;
		boss = !!et.isBoss;
	}
	const bestiary = optionalGlobal('BESTIARY_ENTRIES');
	if(id && bestiary && bestiary.find){
		const be = bestiary.find(e => e.id === id);
		if(be){
			if(!name) name = be.name;
			if(!hp && be.hp != null) hp = be.hp;
			if(be.boss) boss = true;
		}
	}
	if(id && !hp && SUMMON_HP[id] != null) hp = SUMMON_HP[id];
	if(id && SUMMON_BOSS[id]) boss = true;
	if(!name && idOrEt && typeof idOrEt === 'object') name = idOrEt.name || '';
	if(!hp && idOrEt && typeof idOrEt === 'object') hp = idOrEt.hp != null ? idOrEt.hp : (idOrEt.maxHp || 0);
	if(!boss && idOrEt && typeof idOrEt === 'object') boss = !!(idOrEt.isBoss || idOrEt.boss);
	return {
		id,
		name: name || id || 'Summon',
		hp: hp || 0,
		boss,
		isBoss: boss,
		points: getSummonPointCost(id)
	};
}

function getSummonCatalog(){
	let discovered = {};
	try {
		const raw = localStorage.getItem('magicBattle_bestiary');
		if(raw) discovered = JSON.parse(raw) || {};
	} catch(e){}
	const ids = Object.keys(SUMMON_POINT_VALUES).filter(id => !!discovered[id]);
	return ids.map(id => {
		const st = getNecroSummonStats(id);
		return { id, name: st.name, points: st.points, boss: st.boss, hp: st.hp };
	});
}

function necroDisplayedManaForType(spell, typeId, opts){
	if(!spell || !spell.phases) return 0;
	const copy = Object.assign({}, spell, {
		phases: spell.phases.map(p => p && p.shape === 'summon'
			? Object.assign({}, p, { necroSummonType: typeId || 'random' })
			: p)
	});
	if(typeof displayedSpellMana === 'function') return displayedSpellMana(copy, opts);
	if(typeof calcSpellManaCost === 'function') return Math.round(calcSpellManaCost(copy, opts));
	return 0;
}

function isNecroUltimateRaise(opts, spell){
	opts = opts || {};
	const sp = spell || opts.spell;
	return !!(opts.isUltimate || opts.slot === 9 || (sp && sp.isUltimate));
}

function necroRaiseManaCosts(et, opts){
	opts = opts || {};
	if(isNecroUltimateRaise(opts, opts.spell)) return { total: 0, mana: 0 };
	const st = getNecroSummonStats(et);
	const hp = st.hp || 0;
	const isBoss = !!st.boss;
	let magicControl = opts.magicControl;
	if(magicControl == null && opts.stats) magicControl = opts.stats.magicControl;
	if(magicControl == null && typeof stats !== 'undefined' && stats) magicControl = stats.magicControl;
	if(magicControl == null && typeof computeStats === 'function'){
		try { magicControl = computeStats().magicControl; } catch(e){}
	}
	magicControl = Number(magicControl) || 0;
	const controlDiscount = Math.max(0.3, 1 - magicControl * 0.015);
	const spell = opts.spell;
	let paidMana = 0;
	let actualMana = 0;
	if(spell){
		if(typeof displayedSpellMana === 'function') paidMana = displayedSpellMana(spell, opts);
		else if(typeof calcSpellManaCost === 'function') paidMana = Math.round(calcSpellManaCost(spell, opts));
		actualMana = st.id ? necroDisplayedManaForType(spell, st.id, opts) : paidMana;
	}
	const extraBuff = Math.max(0, actualMana - paidMana);
	const spellCostBonus = Math.round(actualMana * 0.5);
	const bossMult = isBoss ? 5.5 : 1;
	return {
		total: Math.round((200 + hp * 0.15) * bossMult * controlDiscount) + extraBuff + spellCostBonus,
		mana: 0
	};
}

function necroSummonPhase(spell){
	if(!spell || !spell.phases) return null;
	for(let i = 0; i < spell.phases.length; i++){
		if(spell.phases[i] && spell.phases[i].shape === 'summon') return spell.phases[i];
	}
	return null;
}

function necroSpellRaiseCosts(spell, opts){
	opts = opts || {};
	if(!isNecroCaster(opts) || !necroSummonPhase(spell)) return null;
	if(isNecroUltimateRaise(opts, spell)) return null;
	const ph = necroSummonPhase(spell);
	const typeId = ph && ph.necroSummonType;
	return necroRaiseManaCosts(typeId || { hp: 0, boss: false }, Object.assign({}, opts, { spell }));
}

if(typeof window !== 'undefined'){
	window.NECRO_POINT_CAP = NECRO_POINT_CAP;
	window.NECRO_DOMAIN_POINT_CAP = NECRO_DOMAIN_POINT_CAP;
	window.SUMMON_POINT_VALUES = SUMMON_POINT_VALUES;
	window.getSummonPointCost = getSummonPointCost;
	window.isUltOnlyNecroType = isUltOnlyNecroType;
	window.necroSummonStatCaps = necroSummonStatCaps;
	window.necroBuffManaMult = necroBuffManaMult;
	window.necroSizeManaCost = necroSizeManaCost;
	window.getNecroSummonStats = getNecroSummonStats;
	window.playerMaxManaEstimate = playerMaxManaEstimate;
	window.getSummonCatalog = getSummonCatalog;
	window.isNecroUltimateRaise = isNecroUltimateRaise;
	window.necroRaiseManaCosts = necroRaiseManaCosts;
	window.necroSummonPhase = necroSummonPhase;
	window.necroSpellRaiseCosts = necroSpellRaiseCosts;
}

function syncCatalogueCosts(){
	if(typeof SHAPES !== 'undefined'){
		for(const k in SHAPE_MANA) if(SHAPES[k]) SHAPES[k].manaCost = SHAPE_MANA[k];
		for(const k in SHAPE_CTRL) if(SHAPES[k]) SHAPES[k].controlReq = SHAPE_CTRL[k];
	}
	if(typeof BEHAVIORS !== 'undefined'){
		for(const k in BEH_MANA) if(BEHAVIORS[k]) BEHAVIORS[k].manaCost = BEH_MANA[k];
		for(const k in BEH_CTRL) if(BEHAVIORS[k]) BEHAVIORS[k].controlReq = BEH_CTRL[k];
	}
	if(typeof EFFECTS !== 'undefined'){
		for(const k in FX_MANA) if(EFFECTS[k]) EFFECTS[k].manaCost = FX_MANA[k];
		for(const k in FX_CTRL) if(EFFECTS[k]) EFFECTS[k].controlReq = FX_CTRL[k];
	}
}

/* =============================================================
   Spell rule migration — clamp saved spells to current caps
   (projectile product, domain waves, ultimate slot flag).
   Called on local load and before every cloud push.
   ============================================================= */
const SPELL_RULE_NORMAL_CAP = 50;
const SPELL_RULE_ULT_CAP = 200;
const SPELL_RULE_DOMAIN_WAVE_CAP = 5;

function spellProjCapForSlot(slotIdx){
	return slotIdx === 9 ? SPELL_RULE_ULT_CAP : SPELL_RULE_NORMAL_CAP;
}

function spellProjectileProduct(spell){
	if(!spell || !Array.isArray(spell.phases) || !spell.phases.length) return 1;
	let total = 1;
	for(const ph of spell.phases) total *= phaseEffectiveCount(ph);
	return total;
}

function setPhaseEffectiveCount(ph, n){
	n = Math.max(1, n | 0);
	if(ph.behavior === 'aroundSelf') ph.aroundSelfCount = n;
	else ph.count = n;
}

function enforceSpellRulesOnSpell(spell, slotIdx){
	if(!spell || !Array.isArray(spell.phases) || !spell.phases.length) return false;
	let changed = false;
	const isUlt = slotIdx === 9;
	if(isUlt){
		if(!spell.isUltimate){ spell.isUltimate = true; changed = true; }
	} else if(spell.isUltimate){
		delete spell.isUltimate;
		changed = true;
	}
	const hasDomain = !!(spell.phases[0] && spell.phases[0].behavior === 'domain');
	for(let i = 0; i < spell.phases.length; i++){
		const ph = spell.phases[i];
		if(!ph) continue;
		if(ph.shape === 'same' && (ph.count || 1) !== 1){
			ph.count = 1;
			changed = true;
		}
		if(hasDomain && i > 0){
			const c = phaseEffectiveCount(ph);
			if(c > SPELL_RULE_DOMAIN_WAVE_CAP){
				setPhaseEffectiveCount(ph, SPELL_RULE_DOMAIN_WAVE_CAP);
				changed = true;
			}
		}
	}
	const cap = spellProjCapForSlot(slotIdx);
	while(spellProjectileProduct(spell) > cap){
		let idx = -1;
		for(let i = spell.phases.length - 1; i >= 0; i--){
			const ph = spell.phases[i];
			if(!ph || ph.shape === 'same') continue;
			if(phaseEffectiveCount(ph) > 1){ idx = i; break; }
		}
		if(idx < 0) break;
		setPhaseEffectiveCount(spell.phases[idx], phaseEffectiveCount(spell.phases[idx]) - 1);
		changed = true;
	}
	return changed;
}

function enforceSpellRulesOnData(playerData){
	if(!playerData || typeof playerData !== 'object') return false;
	let changed = false;
	const walk = arr => {
		if(!Array.isArray(arr)) return;
		for(let i = 0; i < arr.length; i++){
			if(arr[i] && enforceSpellRulesOnSpell(arr[i], i)) changed = true;
		}
	};
	walk(playerData.spells);
	walk(playerData.transformSpells);
	if(Array.isArray(playerData.loadouts)){
		for(const ld of playerData.loadouts){
			if(ld) walk(ld.spells);
		}
	}
	return changed;
}

function enforceSpellRulesInStorage(){
	try {
		const raw = localStorage.getItem('magicBattle_playerData');
		if(!raw) return false;
		const data = JSON.parse(raw);
		if(!enforceSpellRulesOnData(data)) return false;
		localStorage.setItem('magicBattle_playerData', JSON.stringify(data));
		return true;
	} catch(e){
		console.warn('[spell-rules] migrate failed:', e);
		return false;
	}
}

if(typeof window !== 'undefined'){
	window.SPELL_RULE_NORMAL_CAP = SPELL_RULE_NORMAL_CAP;
	window.SPELL_RULE_ULT_CAP = SPELL_RULE_ULT_CAP;
	window.enforceSpellRulesOnSpell = enforceSpellRulesOnSpell;
	window.enforceSpellRulesOnData = enforceSpellRulesOnData;
	window.enforceSpellRulesInStorage = enforceSpellRulesInStorage;
}
