/* =============================================================
   Advanced roster kit — twelve system-teaching regulars.
   Fire: Cinder Beetle, Furnace Leech, Ash Revenant, Magma Harvester
   Ice:  Frost Mantis, Glacier Eel, Crystal Scarab, Snowbound Mimic
   Jungle: Barkback Beetle, Pollen Moth, Root Parasite, Jungle Chameleon
   ============================================================= */

const ROSTER_KIT_TYPES = {
	cinderBeetle:1, furnaceLeech:1, ashRevenant:1, magmaHarvester:1,
	frostMantis:1, glacierEel:1, crystalScarab:1, snowboundMimic:1,
	barkbackBeetle:1, pollenMoth:1, rootParasite:1, jungleChameleon:1
};
const ROSTER_KIT_ROW = {
	cinderBeetle: { heatShell:2, emberRoll:4, furnaceBack:2, cinderBurst:3, recover:1 },
	furnaceLeech: { manaSiphon:3, siphonBurst:4, furnaceFeeding:2, moltenSplit:2, recover:1 },
	ashRevenant: { ashenStrike:4, reformation:2, ashStep:3, lastEmber:2, recover:1 },
	magmaHarvester: { heatCollection:2, moltenSweep:4, coreDischarge:4, overheated:2, recover:1 },
	frostMantis: { frozenParry:2, iceStep:2, frostblade:4, winterCounter:2, recover:1 },
	glacierEel: { iceCurrent:3, snapTurn:4, frostLoop:3, breakingCharge:4, recover:1 },
	crystalScarab: { crystalCarapace:2, shardToss:4, crystalCharge:3, shatterback:3, recover:1 },
	snowboundMimic: { falseCrystal:1, frozenEcho:3, avalancheFeint:4, whiteout:3, recover:1 },
	barkbackBeetle: { barkArmor:2, rootCharge:4, barkRoll:4, splinterBurst:3, recover:1 },
	pollenMoth: { pollenCloud:4, falseBloom:2, flutterBurst:4, migration:2, recover:1 },
	rootParasite: { parasiteGrowth:3, hostTransfer:2, rootPulse:4, forcedBloom:3, recover:1 },
	jungleChameleon: { camouflage:1, tongueStrike:4, colorShift:2, predatorBurst:4, recover:1 }
};

const rosterWorldFX = [];

function rosterAim(en){
	if(typeof fireKitAim === 'function') return fireKitAim(en);
	return { x: player.x + player.w / 2, y: player.y + player.h / 2, vx: player.vx || 0, vy: player.vy || 0, box: player };
}
function rosterFriend(en){ return !!(en && (en.isNecroSummon || en.necroFriendly)); }
function rosterAtkS(n){ return n * 1.55 * ((typeof ENEMY_ATK_SCALE === 'number') ? ENEMY_ATK_SCALE : 1.3); }
function rosterDmg(n){
	return Math.round(n * 2.55 * ((typeof DIFF_DMG_MULT === 'number') ? DIFF_DMG_MULT : 1));
}
function rosterFloor(x, y){ return (typeof fireKitFloorY === 'function') ? fireKitFloorY(x, y) : ((y || 0) + 80); }
function rosterBlocked(x, y){ return (typeof fireKitBlocked === 'function') ? fireKitBlocked(x, y) : false; }
function rosterShake(a, t){ if(typeof shakeScreen === 'function') shakeScreen(a, t); }
function rosterTele(x, y, w, h, frames, color, label){
	if(typeof spawnTelegraph === 'function') spawnTelegraph(x, y, w, h, frames, color || 'rgba(255,140,40,0.28)', 'rect', label || '');
}
function rosterSpark(x, y, n, color){
	if(typeof particles === 'undefined') return;
	const c = color || { r: 255, g: 120, b: 50 };
	for(let i = 0; i < Math.min(n || 10, 20); i++){
		const a = Math.random() * Math.PI * 2, s = 1.4 + Math.random() * 5;
		particles.push({
			x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 12,
			vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.2,
			life: 14 + Math.random() * 16, maxLife: 30, r: 1.6 + Math.random() * 2.4, color: c
		});
	}
}
function rosterSpawn(en, x, y, vx, vy, opts){
	opts = opts || {};
	const p = spawnEnemyProj(x, y, vx, vy, opts);
	if(p){
		p._rosterStyle = opts._rosterStyle || 'orb';
		p._rosterEn = en;
		if(rosterFriend(en)){
			if(typeof markNecroFriendlyProj === 'function') markNecroFriendlyProj(p, en);
			else p.necroFriendly = true;
		}
	}
	return p;
}
function rosterHit(en, x, y, r, dmg, effects){
	r = rosterAtkS(r);
	if(rosterFriend(en)){
		if(typeof necroScaleKitDmg === 'function') dmg = necroScaleKitDmg(en, dmg);
		const pool = (typeof enemies !== 'undefined' ? enemies : []).concat(typeof dummies !== 'undefined' ? dummies : []);
		for(let i = 0; i < pool.length; i++){
			const t = pool[i];
			if(!t || t.dead) continue;
			if(circRect(x, y, r, t.x, t.y, t.w, t.h)){
				t.hp -= dmg; t.flash = 8;
				dmgNumbers.push({ x: t.x + t.w / 2, y: t.y - 10, text: Math.round(dmg) + '', age: 0, color: '#ffaa66' });
				return true;
			}
		}
		return false;
	}
	if(player.iFrames > 0) return false;
	if(circRect(x, y, r, player.x, player.y, player.w, player.h)){
		damagePlayer(dmg, effects || []);
		return true;
	}
	return false;
}
function rosterLineHit(en, x0, y0, x1, y1, r, dmg, effects){
	const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1;
	const rad = rosterAtkS(r);
	const steps = Math.max(3, Math.ceil(len / Math.max(14, rad * 0.55)));
	let hit = false;
	for(let i = 0; i <= steps; i++){
		const u = i / steps;
		if(rosterHit(en, x0 + dx * u, y0 + dy * u, r, dmg, effects)) hit = true;
	}
	return hit;
}
function rosterFX(fx){ rosterWorldFX.push(fx); return fx; }
function rosterType(en){ return (en && (en.necroType || en.type)) || ''; }

function rosterEnd(en){
	if(!en) return;
	en.rosterKit = null;
	en._rosterBusy = false;
	en._rosterHidden = false;
	en._rosterNoHit = false;
	en._rosterOpen = false;
	en._rosterParry = false;
	en._rosterCounter = false;
	en._rosterVulnerable = false;
}

function beginRosterKit(en, kind, extra){
	const type = rosterType(en);
	const rows = ROSTER_KIT_ROW[type] || {};
	en.rosterKit = Object.assign({
		kind, t: 0, type, row: rows[kind] != null ? rows[kind] : 2
	}, extra || {});
	en._rosterBusy = extra && extra.busy === false ? false : true;
	en.attackAnimTimer = Math.max(en.attackAnimTimer || 0, 48);
	const aim = rosterAim(en);
	en.facing = aim.x >= en.x + en.w / 2 ? 1 : -1;
	return en.rosterKit;
}

function rosterEnsure(en){
	if(!en._roster) en._roster = {};
	const r = en._roster;
	const type = rosterType(en);
	if(r._init) return r;
	r._init = true;
	r.heat = 0;
	if(type === 'cinderBeetle'){ r.plates = []; r.plateChain = 0; r.burstUsed = false; }
	if(type === 'furnaceLeech'){ r.stolen = 0; r.fed = 0; r.attached = false; }
	if(type === 'ashRevenant'){ r.lives = 2; r.piles = []; r.ember = null; }
	if(type === 'magmaHarvester'){ r.overheatUsed = false; }
	if(type === 'frostMantis'){ r.attacks = 0; }
	if(type === 'glacierEel'){ r.ice = []; }
	if(type === 'crystalScarab'){ r.armor = [1, 1, 1, 0]; r.exposed = 3; r.cracked = 0; }
	if(type === 'snowboundMimic'){ r.disguised = true; r.echo = null; }
	if(type === 'barkbackBeetle'){ r.armor = 120; r.armored = false; r.breakSide = 1; }
	if(type === 'pollenMoth'){ r.migrated = false; }
	if(type === 'rootParasite'){ r.host = null; }
	if(type === 'jungleChameleon'){ r.hiddenFor = 0; r.camoHue = 0; }
	return r;
}

function rosterSpawnEnemy(type, x, y, extra){
	if(typeof ENEMY_TYPES === 'undefined' || !ENEMY_TYPES[type] || typeof enemies === 'undefined') return null;
	const t = ENEMY_TYPES[type];
	const sizeM = (typeof DIFF_SIZE_MULT === 'number') ? DIFF_SIZE_MULT : 1.4;
	const hpM = (typeof DIFF_HP_MULT === 'number') ? DIFF_HP_MULT : 1;
	const scale = (extra && extra.scale) || 1;
	const en = {
		type: type, typeDef: t, x: x, y: y,
		w: Math.max(10, Math.round(t.w * sizeM * scale)),
		h: Math.max(10, Math.round(t.h * sizeM * scale)),
		vx: 0, vy: 0,
		hp: Math.round(t.hp * hpM * ((extra && extra.hpMul) || 1)),
		facing: 1, patrol: [x - 140, x + 140], patrolDir: 1, state: 'alert',
		alertTimer: 180, spellCooldowns: t.spells.map(function(){ return 40; }),
		currentSpell: 0, flash: 0, dots: [], stunTimer: 0, slowTimer: 0,
		animTimer: 0, attackAnimTimer: 0, dead: false, deathTimer: 0,
		baseY: y, flyOffset: 0, charging: false, chargeVx: 0, chargeVy: 0,
		chargeTimer: 0, chargeCastDone: false, bossPhase: 1,
		_safeX: x, _safeY: y, _rosterChild: true
	};
	en.maxHp = en.hp;
	if(extra){
		if(extra.roomId != null) en.roomId = extra.roomId;
		if(extra.puzzleSeg != null) en.puzzleSeg = extra.puzzleSeg;
		if(extra.small) en._rosterSmall = true;
		if(extra.noBestiary) en._rosterNoBestiary = true;
	}
	enemies.push(en);
	return en;
}

function rosterPlantHost(en, deco){
	return {
		deco: deco,
		x: deco.x + (deco.w || 40) * 0.5,
		y: deco.y + (deco.h || 40) * 0.35,
		kind: rosterPlantKind(deco)
	};
}
function rosterPlantKind(deco){
	const t = String((deco && deco.type) || '').toLowerCase();
	if(t.indexOf('flower') >= 0 || t.indexOf('bloom') >= 0) return 'flower';
	if(t.indexOf('vine') >= 0) return 'vine';
	if(t.indexOf('root') >= 0) return 'root';
	if(t.indexOf('tree') >= 0 || t.indexOf('moss') >= 0) return 'root';
	return 'vine';
}
function rosterFindPlants(cx, cy, range){
	const out = [];
	if(typeof decorations === 'undefined') return out;
	for(let i = 0; i < decorations.length; i++){
		const d = decorations[i];
		if(!d) continue;
		const t = String(d.type || '').toLowerCase();
		if(!(t.indexOf('vine') >= 0 || t.indexOf('root') >= 0 || t.indexOf('flower') >= 0 || t.indexOf('bloom') >= 0 || t.indexOf('tree') >= 0 || t.indexOf('moss') >= 0 || t.indexOf('jg') === 0)) continue;
		if(t.indexOf('light') >= 0 || t.indexOf('butter') >= 0) continue;
		const dx = (d.x + (d.w || 40) * 0.5) - cx;
		const dy = (d.y + (d.h || 40) * 0.5) - cy;
		const dist = Math.hypot(dx, dy);
		if(dist <= range) out.push(d);
	}
	return out;
}
function rosterNearFire(en){
	const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
	if(typeof decorations !== 'undefined'){
		for(let i = 0; i < decorations.length; i++){
			const d = decorations[i];
			if(!d) continue;
			if(d.type === 'embers' || d.type === 'lava' || d.type === 'torch'){
				if(Math.hypot((d.x || 0) - cx, (d.y || 0) - cy) < 110) return true;
			}
		}
	}
	if(typeof hazards !== 'undefined'){
		for(let i = 0; i < hazards.length; i++){
			const h = hazards[i];
			if(!h) continue;
			if(h.type === 'lava' || h.type === 'vent' || h.type === 'channel' || h.lava){
				const hx = h.x != null ? h.x + (h.w || 40) * 0.5 : cx + 999;
				const hy = h.y != null ? h.y : (h.yFromFloor != null ? en.y : cy);
				if(Math.hypot(hx - cx, hy - cy) < 130) return true;
			}
		}
	}
	return false;
}

/* ======================== FIRE CASTS ======================== */
function castBeetleHeatShell(en){
	const r = rosterEnsure(en);
	beginRosterKit(en, 'heatShell', { busy: true, heat0: r.heat });
	en._rosterOpen = false;
}
function castBeetleEmberRoll(en){
	const aim = rosterAim(en);
	beginRosterKit(en, 'emberRoll', {
		busy: true, nextTurn: 16,
		tx: aim.x + aim.vx * 22, ty: rosterFloor(aim.x, aim.y) - en.h
	});
	en._rosterOpen = false;
}
function castBeetleFurnaceBack(en){
	const r = rosterEnsure(en);
	r.plates = [
		{ hp: 1, x: 0.22, y: 0.18 }, { hp: 1, x: 0.42, y: 0.10 },
		{ hp: 1, x: 0.62, y: 0.10 }, { hp: 1, x: 0.80, y: 0.20 }
	];
	r.plateChain = 0;
	beginRosterKit(en, 'furnaceBack', { busy: true });
	en._rosterOpen = true;
}
function castBeetleCinderBurst(en){
	rosterEnsure(en).burstUsed = true;
	beginRosterKit(en, 'cinderBurst', { busy: true, rings: 0 });
	en.vx = 0;
}

function castLeechManaSiphon(en){
	beginRosterKit(en, 'manaSiphon', { busy: true });
}
function castLeechSiphonBurst(en){
	beginRosterKit(en, 'siphonBurst', { busy: true, launched: false });
}
function castLeechFurnaceFeeding(en){
	beginRosterKit(en, 'furnaceFeeding', { busy: true });
}
function castLeechMoltenSplit(en){
	beginRosterKit(en, 'moltenSplit', { busy: false });
	leechDoSplit(en);
}

function castRevenantAshenStrike(en){
	const aim = rosterAim(en);
	beginRosterKit(en, 'ashenStrike', { busy: true, hit: false, tx: aim.x, ty: aim.y });
}
function castRevenantReformation(en){
	beginRosterKit(en, 'reformation', { busy: true });
	revenantCollapse(en);
}
function castRevenantAshStep(en){
	const aim = rosterAim(en);
	const dir = aim.x >= en.x + en.w / 2 ? 1 : -1;
	beginRosterKit(en, 'ashStep', {
		busy: true, phase: 'throw',
		tx: aim.x + dir * 10, ty: rosterFloor(aim.x, aim.y) - en.h,
		cloud: { x: en.x + en.w / 2, y: en.y + en.h * 0.4 }
	});
}
function castRevenantLastEmber(en){
	beginRosterKit(en, 'lastEmber', { busy: true });
}

function castHarvesterHeatCollection(en){
	beginRosterKit(en, 'heatCollection', { busy: true });
}
function castHarvesterMoltenSweep(en){
	const r = rosterEnsure(en);
	const rad = 150 + r.heat * 1.15;
	beginRosterKit(en, 'moltenSweep', { busy: true, rad: rad, swung: false });
	const aim = rosterAim(en);
	const dir = aim.x >= en.x + en.w / 2 ? 1 : -1;
	rosterTele(en.x + en.w / 2 - (dir < 0 ? rad : 20), en.y + en.h - 40, rad + 30, 70, 16, 'rgba(255,90,20,0.28)', 'SWEEP');
}
function castHarvesterCoreDischarge(en){
	const r = rosterEnsure(en);
	beginRosterKit(en, 'coreDischarge', { busy: true, ang: -1.2, heat: r.heat });
}
function castHarvesterOverheated(en){
	beginRosterKit(en, 'overheated', { busy: true, interrupted: 0 });
	en._rosterVulnerable = true;
}

/* ======================== ICE CASTS ======================== */
function castMantisFrozenParry(en){
	beginRosterKit(en, 'frozenParry', { busy: true });
	en._rosterParry = true;
}
function castMantisIceStep(en){
	const aim = rosterAim(en);
	const side = aim.x >= en.x + en.w / 2 ? -1 : 1;
	beginRosterKit(en, 'iceStep', { busy: true, steps: 0, side: side, next: 4 });
}
function castMantisFrostblade(en){
	beginRosterKit(en, 'frostblade', { busy: true, slash: 0, next: 8 });
}
function castMantisWinterCounter(en){
	beginRosterKit(en, 'winterCounter', { busy: true, struck: false });
	en._rosterCounter = true;
}

function castEelIceCurrent(en){
	const aim = rosterAim(en);
	const ang = Math.atan2(aim.y - (en.y + en.h / 2), aim.x - (en.x + en.w / 2));
	beginRosterKit(en, 'iceCurrent', { busy: true, ang: ang });
}
function castEelSnapTurn(en){
	const aim = rosterAim(en);
	const ang = Math.atan2(aim.y - (en.y + en.h / 2), aim.x - (en.x + en.w / 2));
	beginRosterKit(en, 'snapTurn', { busy: true, ang: ang, dashed: false });
}
function castEelFrostLoop(en){
	const aim = rosterAim(en);
	beginRosterKit(en, 'frostLoop', { busy: true, cx: aim.x, cy: rosterFloor(aim.x, aim.y) - 8, passes: 0, ang: 0 });
}
function castEelBreakingCharge(en){
	const aim = rosterAim(en);
	beginRosterKit(en, 'breakingCharge', { busy: true, dir: aim.x >= en.x + en.w / 2 ? 1 : -1 });
}

function castScarabCrystalCarapace(en){
	const r = rosterEnsure(en);
	r.armor = [1, 1, 1, 1];
	r.exposed = Math.floor(Math.random() * 4);
	r.armor[r.exposed] = 0;
	beginRosterKit(en, 'crystalCarapace', { busy: true });
}
function castScarabShardToss(en){
	const aim = rosterAim(en);
	beginRosterKit(en, 'shardToss', { busy: true, lockX: aim.x, lockY: aim.y, fired: false });
}
function castScarabCrystalCharge(en){
	const aim = rosterAim(en);
	beginRosterKit(en, 'crystalCharge', { busy: true, dir: aim.x >= en.x + en.w / 2 ? 1 : -1, cracked: false });
}
function castScarabShatterback(en){
	beginRosterKit(en, 'shatterback', { busy: true, popped: false });
}

function castMimicFalseCrystal(en){
	rosterEnsure(en).disguised = true;
	beginRosterKit(en, 'falseCrystal', { busy: true });
}
function castMimicFrozenEcho(en){
	const aim = rosterAim(en);
	beginRosterKit(en, 'frozenEcho', { busy: true, side: aim.x >= en.x + en.w / 2 ? -1 : 1 });
}
function castMimicAvalancheFeint(en){
	const aim = rosterAim(en);
	beginRosterKit(en, 'avalancheFeint', { busy: true, tx: aim.x });
	rosterTele(aim.x - 110, aim.y - 120, 220, 200, 14, 'rgba(200,230,255,0.35)', 'AVALANCHE?');
}
function castMimicWhiteout(en){
	beginRosterKit(en, 'whiteout', { busy: true });
}

/* ======================== JUNGLE CASTS ======================== */
function castBarkBarkArmor(en){
	const r = rosterEnsure(en);
	r.armored = true;
	r.armor = 140;
	beginRosterKit(en, 'barkArmor', { busy: true });
}
function castBarkRootCharge(en){
	const aim = rosterAim(en);
	beginRosterKit(en, 'rootCharge', { busy: true, dir: aim.x >= en.x + en.w / 2 ? 1 : -1, lastDrop: 0 });
}
function castBarkBarkRoll(en){
	const aim = rosterAim(en);
	beginRosterKit(en, 'barkRoll', { busy: true, vx: (aim.x >= en.x + en.w / 2 ? 1 : -1) * 13.5, bounces: 0 });
}
function castBarkSplinterBurst(en){
	const r = rosterEnsure(en);
	beginRosterKit(en, 'splinterBurst', { busy: true, side: r.breakSide || 1, popped: false });
}

function castMothPollenCloud(en){
	beginRosterKit(en, 'pollenCloud', { busy: true });
}
function castMothFalseBloom(en){
	beginRosterKit(en, 'falseBloom', { busy: true, blooms: [], real: 0, hidden: false });
}
function castMothFlutterBurst(en){
	beginRosterKit(en, 'flutterBurst', { busy: true, hops: 0, next: 6 });
}
function castMothMigration(en){
	rosterEnsure(en).migrated = true;
	const room = (typeof dungeon !== 'undefined' && dungeon && dungeon.rooms && en.roomId != null) ? dungeon.rooms[en.roomId] : null;
	const destX = room ? room.x + room.w - 80 : en.x + 420;
	beginRosterKit(en, 'migration', { busy: true, destX: destX, spawned: false });
}

function castParaParasiteGrowth(en){
	const plants = rosterFindPlants(en.x + en.w / 2, en.y + en.h / 2, 360);
	const host = plants.length ? plants[Math.floor(Math.random() * plants.length)] : null;
	beginRosterKit(en, 'parasiteGrowth', { busy: true, host: host ? rosterPlantHost(en, host) : null });
}
function castParaHostTransfer(en){
	const plants = rosterFindPlants(en.x + en.w / 2, en.y + en.h / 2, 520);
	let next = null;
	const cur = rosterEnsure(en).host && rosterEnsure(en).host.deco;
	for(let i = 0; i < plants.length; i++){
		if(plants[i] !== cur){ next = plants[i]; break; }
	}
	beginRosterKit(en, 'hostTransfer', { busy: true, host: next ? rosterPlantHost(en, next) : null });
}
function castParaRootPulse(en){
	const plants = rosterFindPlants(en.x + en.w / 2, en.y + en.h / 2, 480);
	beginRosterKit(en, 'rootPulse', { busy: true, plants: plants.slice(0, 5), pi: 0, next: 8 });
}
function castParaForcedBloom(en){
	const r = rosterEnsure(en);
	beginRosterKit(en, 'forcedBloom', { busy: true, host: r.host, slammed: false });
}

function castChamCamouflage(en){
	const r = rosterEnsure(en);
	r.camoHue = (r.camoHue + 1) % 3;
	en._rosterCamo = true;
	en._rosterCamoAlpha = 0.2;
	r.hiddenFor = 0;
	beginRosterKit(en, 'camouflage', { busy: true });
}
function castChamTongueStrike(en){
	const aim = rosterAim(en);
	beginRosterKit(en, 'tongueStrike', { busy: true, tx: aim.x, ty: aim.y, pulled: false });
}
function castChamColorShift(en){
	rosterEnsure(en).camoHue = (rosterEnsure(en).camoHue + 1) % 3;
	en._rosterCamo = true;
	en._rosterCamoAlpha = 0.18;
	beginRosterKit(en, 'colorShift', { busy: false });
	setTimeout(function(){ if(en && en.rosterKit && en.rosterKit.kind === 'colorShift') rosterEnd(en); }, 360);
}
function castChamPredatorBurst(en){
	en._rosterCamo = false;
	en._rosterCamoAlpha = 1;
	beginRosterKit(en, 'predatorBurst', { busy: true, phase: 0 });
}

/* ======================== TICKS ======================== */
function tickCinderBeetle(en, kit){
	const r = rosterEnsure(en);
	const aim = rosterAim(en);
	if(kit.kind === 'heatShell'){
		en.vx *= 0.3;
		if(r.heat >= 50 || kit.t > 70){
			const rad = 110 + r.heat * 1.1;
			rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, rad, rosterDmg(28 + r.heat * 0.3), ['burn']);
			rosterSpark(en.x + en.w / 2, en.y + en.h / 2, 28, { r: 255, g: 80, b: 20 });
			rosterShake(8, 12);
			r.heat = 0;
			en._rosterOpen = true;
			en._rosterVulnerable = true;
			if(kit.t > 88){ en._rosterVulnerable = false; rosterEnd(en); }
		}
	} else if(kit.kind === 'emberRoll'){
		if(kit.t >= kit.nextTurn){
			kit.nextTurn = kit.t + 14;
			kit.tx = aim.x + aim.vx * 18;
			kit.ty = rosterFloor(aim.x, aim.y) - en.h;
			en._rosterOpen = true;
			kit.openUntil = kit.t + 8;
		}
		if(kit.openUntil && kit.t >= kit.openUntil) en._rosterOpen = false;
		const dx = kit.tx - (en.x + en.w / 2);
		en.vx = Math.max(-14, Math.min(14, Math.sign(dx) * 12.5));
		en.x += en.vx;
		en.facing = en.vx >= 0 ? 1 : -1;
		rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 58, rosterDmg(28), ['burn']);
		if(kit.t > 70 || Math.abs(dx) < 16) rosterEnd(en);
	} else if(kit.kind === 'furnaceBack'){
		en.vx *= 0.4;
		if(kit.t % 14 === 0){
			const dir = aim.x >= en.x + en.w / 2 ? 1 : -1;
			rosterSpawn(en, en.x + en.w / 2, en.y + en.h * 0.35, dir * 9.5, -1.4, {
				color: '#ff6622', color2: '#ffe080', power: 22, width: 36, height: 28,
				shape: 'circle', effects: ['burn'], trail: 'flame', maxAge: 70, _rosterStyle: 'siphon'
			});
		}
		if(kit.t > 80){
			r.plates = [];
			en._rosterOpen = false;
			rosterEnd(en);
		}
	} else if(kit.kind === 'cinderBurst'){
		en.vx = 0;
		if(kit.t === 8 || kit.t === 22 || kit.t === 36){
			kit.rings++;
			const rad = 80 + kit.rings * 55;
			rosterFX({ kind: 'ring', x: en.x + en.w / 2, y: en.y + en.h / 2, r: rad, age: 0, max: 28, color: 'rgba(255,90,20,0.55)' });
			rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, rad, rosterDmg(22 + kit.rings * 6), ['burn']);
		}
		if(kit.t === 48){
			rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 210, rosterDmg(42), ['burn']);
			rosterSpark(en.x + en.w / 2, en.y + en.h / 2, 30);
			rosterShake(12, 16);
			en.stunTimer = Math.max(en.stunTimer || 0, 50);
			en._rosterVulnerable = true;
		}
		if(kit.t > 78){ en._rosterVulnerable = false; rosterEnd(en); }
	}
}

function tickFurnaceLeech(en, kit){
	const r = rosterEnsure(en);
	const aim = rosterAim(en);
	if(kit.kind === 'manaSiphon'){
		const dx = aim.x - (en.x + en.w / 2), dy = aim.y - (en.y + en.h / 2);
		const d = Math.hypot(dx, dy) || 1;
		if(d < 52 || r.attached){
			r.attached = true;
			en._leechAttached = true;
			en.x = player.x + player.w * 0.55;
			en.y = player.y + 6;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
			if(kit.t % 12 === 0) rosterHit(en, player.x + player.w / 2, player.y + player.h / 2, 40, rosterDmg(10), ['burn']);
			if(kit.t > 140){ r.attached = false; en._leechAttached = false; rosterEnd(en); }
		} else {
			en.x += dx / d * 7.2;
			en.y += dy / d * 5.6;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
		}
	} else if(kit.kind === 'siphonBurst'){
		r.attached = false;
		en._leechAttached = false;
		if(!kit.launched){
			kit.launched = true;
			const d = Math.hypot(aim.x - (en.x + en.w / 2), aim.y - (en.y + en.h / 2)) || 1;
			const p = rosterSpawn(en, en.x + en.w / 2, en.y + en.h / 2,
				(aim.x - (en.x + en.w / 2)) / d * 10.5,
				(aim.y - (en.y + en.h / 2)) / d * 10.5, {
					color: '#ff6622', color2: '#ffe080', power: 28 + Math.min(22, (r.stolen || 0) * 0.35),
					width: 48 + Math.min(24, (r.stolen || 0) * 0.35), height: 48,
					shape: 'circle', effects: ['burn'], trail: 'flame', maxAge: 90, _rosterStyle: 'siphon'
				});
			if(p){ p._rosterAccel = true; p._stolen = r.stolen || 20; }
			r.stolen = 0;
		}
		if(kit.t > 12) rosterEnd(en);
	} else if(kit.kind === 'furnaceFeeding'){
		if(rosterNearFire(en)){
			r.fed = 220;
			en.w = Math.round((en.typeDef.w || 16) * ((typeof DIFF_SIZE_MULT === 'number') ? DIFF_SIZE_MULT : 1.4) * 1.35);
			en.h = Math.round((en.typeDef.h || 14) * ((typeof DIFF_SIZE_MULT === 'number') ? DIFF_SIZE_MULT : 1.4) * 1.35);
			rosterSpark(en.x + en.w / 2, en.y + en.h / 2, 12);
		}
		if(kit.t === 8){
			for(let i = 0; i < 5; i++){
				const a = -1.1 + i * 0.55;
				rosterSpawn(en, en.x + en.w / 2, en.y + en.h / 2, Math.cos(a) * 9.2, Math.sin(a) * 9.2, {
					color: '#ff8844', color2: '#ffe080', power: 20, width: 28, height: 28,
					shape: 'circle', effects: ['burn'], trail: 'flame', maxAge: 70, _rosterStyle: 'siphon'
				});
			}
		}
		if(kit.t > 24) rosterEnd(en);
	}
}

function tickAshRevenant(en, kit){
	const r = rosterEnsure(en);
	const aim = rosterAim(en);
	if(kit.kind === 'ashenStrike'){
		if(kit.t < 10){
			en.vx = (aim.x >= en.x + en.w / 2 ? 1 : -1) * 8.5;
			en.x += en.vx;
		} else if(kit.t === 10){
			kit.hit = rosterHit(en, en.x + en.w * (en.facing > 0 ? 0.95 : 0.05), en.y + en.h * 0.4, 72, rosterDmg(34), ['burn']);
			if(!kit.hit){
				const pile = { kind: 'ashPile', x: en.x + en.w * (en.facing > 0 ? 1.1 : -0.2), y: rosterFloor(en.x, en.y) - 10, hp: 28, age: 0, max: 420, en: en };
				rosterFX(pile);
				r.piles.push(pile);
			}
		}
		if(kit.t > 22) rosterEnd(en);
	} else if(kit.kind === 'ashStep'){
		if(kit.phase === 'throw'){
			const dx = kit.tx - kit.cloud.x, dy = kit.ty - kit.cloud.y;
			const d = Math.hypot(dx, dy) || 1;
			kit.cloud.x += dx / d * 14;
			kit.cloud.y += dy / d * 11;
			en._rosterHidden = true;
			en._rosterNoHit = true;
			if(d < 16 || kit.t > 22){
				en.x = kit.tx - en.w / 2; en.y = kit.ty;
				en._rosterHidden = false; en._rosterNoHit = false;
				kit.phase = 'form';
				rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 70, rosterDmg(26), ['burn']);
				rosterSpark(en.x + en.w / 2, en.y + en.h / 2, 14, { r: 90, g: 70, b: 60 });
			}
		} else if(kit.t > 32) rosterEnd(en);
	} else if(kit.kind === 'reformation'){
		if(kit.t > 8 && !kit.waiting){
			kit.waiting = true;
			en._rosterHidden = true;
			en._rosterNoHit = true;
		}
		if(kit.t > 150){
			let live = null;
			for(let i = 0; i < r.piles.length; i++) if(r.piles[i] && r.piles[i].hp > 0 && !r.piles[i].dead) live = r.piles[i];
			if(live){
				en.x = live.x - en.w / 2; en.y = live.y - en.h;
				en.hp = Math.round(en.maxHp * 0.45);
				en._rosterHidden = false; en._rosterNoHit = false;
				live.dead = true;
			}
			rosterEnd(en);
		}
	} else if(kit.kind === 'lastEmber'){
		if(kit.t === 6){
			rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 110, rosterDmg(36), ['burn']);
			rosterSpark(en.x + en.w / 2, en.y + en.h / 2, 22, { r: 255, g: 90, b: 30 });
		}
		if(kit.t > 18) rosterEnd(en);
	}
}
	const r = rosterEnsure(en);
	const aim = rosterAim(en);
	if(kit.kind === 'heatCollection'){
		harvestNearbyFire(en);
		if(kit.t === 6 || kit.t === 16 || kit.t === 26){
			const dx = aim.x - (en.x + en.w / 2), dy = aim.y - (en.y + en.h / 2), d = Math.hypot(dx, dy) || 1;
			rosterSpawn(en, en.x + en.w / 2, en.y + en.h * 0.35, dx / d * 8.8, dy / d * 8.8, {
				color: '#ff5522', color2: '#ffcc66', power: 24, width: 34, height: 34,
				shape: 'circle', effects: ['burn'], trail: 'flame', maxAge: 80, _rosterStyle: 'siphon'
			});
		}
		if(kit.t > 32) rosterEnd(en);
	} else if(kit.kind === 'moltenSweep'){
		if(kit.t === 18 && !kit.swung){
			kit.swung = true;
			const dir = aim.x >= en.x + en.w / 2 ? 1 : -1;
			rosterHit(en, en.x + en.w / 2 + dir * kit.rad * 0.5, en.y + en.h * 0.65, kit.rad * 0.95, rosterDmg(32 + r.heat * 0.2), ['burn']);
			rosterShake(8, 12);
		}
		if(kit.t > 32) rosterEnd(en);
	} else if(kit.kind === 'coreDischarge'){
		kit.ang += 0.07;
		const ox = en.x + en.w / 2, oy = en.y + en.h * 0.38;
		for(let d = 16; d < 420; d += 18){
			const x = ox + Math.cos(kit.ang) * d, y = oy + Math.sin(kit.ang) * d;
			if(kit.t % 2 === 0) rosterHit(en, x, y, 28, rosterDmg(18 + r.heat * 0.12), ['burn']);
		}
		if(kit.t > 55){ r.heat = Math.max(0, r.heat - 40); rosterEnd(en); }
	} else if(kit.kind === 'overheated'){
		en.vx = 0;
		en._rosterVulnerable = true;
		if(kit.interrupted >= 90){
			r.heat = 0;
			en._rosterVulnerable = false;
			rosterSpark(en.x + en.w / 2, en.y + en.h / 2, 16, { r: 255, g: 200, b: 80 });
			rosterEnd(en);
			return;
		}
		if(kit.t > 90){
			rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 240, rosterDmg(48), ['burn']);
			rosterShake(12, 18);
			r.heat = 0;
			en._rosterVulnerable = false;
			rosterEnd(en);
		}
	}
}

function tickFrostMantis(en, kit){
	const aim = rosterAim(en);
	if(kit.kind === 'frozenParry'){
		en.vx *= 0.2;
		en._rosterParry = kit.t > 10 && kit.t < 46;
		if(kit.t > 40){ en._rosterParry = false; rosterEnd(en); }
	} else if(kit.kind === 'iceStep'){
		if(kit.t >= kit.next && kit.steps < 3){
			rosterFX({ kind: 'foot', x: en.x + en.w / 2, y: en.y + en.h, age: 0, max: 90 });
			en.x += kit.side * 72;
			en.y += (kit.steps === 1 ? -16 : 8);
			if(typeof unstuckFromTiles === 'function') unstuckFromTiles(en);
			rosterHit(en, en.x + en.w / 2, en.y + en.h * 0.5, 54, rosterDmg(18), ['freeze']);
			kit.steps++;
			kit.next = kit.t + 7;
			kit.side *= -1;
		}
		if(kit.t > 32) rosterEnd(en);
	} else if(kit.kind === 'frostblade'){
		if(kit.t >= kit.next && kit.slash < 3){
			const pred = kit.slash === 2;
			const tx = pred ? aim.x + aim.vx * 12 : aim.x;
			const ty = pred ? aim.y + aim.vy * 6 : aim.y;
			const ox = en.x + en.w / 2, oy = en.y + en.h * 0.4;
			const dx = tx - ox, dy = ty - oy, d = Math.hypot(dx, dy) || 1;
			en.x += dx / d * 28;
			rosterLineHit(en, ox, oy, ox + dx / d * 90, oy + dy / d * 50, 42, rosterDmg(kit.slash === 2 ? 32 : 22), ['freeze']);
			kit.slash++;
			kit.next = kit.t + 6;
		}
		if(kit.t > 28) rosterEnd(en);
	} else if(kit.kind === 'winterCounter'){
		en.vx = 0;
		if(kit.struck && kit.t < kit.struck + 12){
			rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 90, rosterDmg(36), ['freeze']);
		}
		if(!kit.struck && kit.t > 40){
			en._rosterCounter = false;
			en._rosterVulnerable = true;
			rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 70, rosterDmg(22), ['freeze']);
		}
		if(kit.t > 70){ en._rosterVulnerable = false; en._rosterCounter = false; rosterEnd(en); }
	}
}

function tickGlacierEel(en, kit){
	const r = rosterEnsure(en);
	const aim = rosterAim(en);
	if(kit.kind === 'iceCurrent'){
		const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
		if(rosterLineHit(en, ox, oy, ox + Math.cos(kit.ang) * 360, oy + Math.sin(kit.ang) * 360, 36, rosterDmg(16), ['freeze'])){
			player._rosterSlide = Math.max(player._rosterSlide || 0, 180);
			player._rosterSlideIce = Math.max(player._rosterSlideIce || 0, 0.55);
		}
		if(kit.t > 40) rosterEnd(en);
	} else if(kit.kind === 'snapTurn'){
		en.vx = 0;
		if(kit.t === 8 && !kit.dashed){
			kit.dashed = true;
			en.vx = Math.cos(kit.ang) * 16;
			en.vy = Math.sin(kit.ang) * 7;
		}
		if(kit.dashed){
			en.x += en.vx;
			en.y += en.vy * 0.45;
			rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 48, rosterDmg(26), ['freeze']);
		}
		if(kit.t > 28) rosterEnd(en);
	} else if(kit.kind === 'frostLoop'){
		kit.ang += 0.14;
		en.x = kit.cx + Math.cos(kit.ang) * 140 - en.w / 2;
		en.y = kit.cy - 10 + Math.sin(kit.ang) * 36;
		rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 40, rosterDmg(16), ['freeze']);
		if(kit.t % 10 === 0){
			const ice = { kind: 'icePatch', x: en.x, y: rosterFloor(en.x, en.y) - 6, w: 110, h: 16, age: 0, max: 360, shattered: false };
			rosterFX(ice);
			r.ice.push(ice);
			kit.passes++;
		}
		if(kit.t > 60){
			rosterHit(en, kit.cx, kit.cy - 20, 90, rosterDmg(30), ['freeze']);
			rosterEnd(en);
		}
	} else if(kit.kind === 'breakingCharge'){
		en.vx = kit.dir * 16;
		en.x += en.vx;
		rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 50, rosterDmg(28), ['freeze']);
		for(let i = 0; i < r.ice.length; i++){
			const ice = r.ice[i];
			if(!ice || ice.shattered) continue;
			if(Math.abs(ice.x - en.x) < 70){ ice.shattered = true; ice.dead = true; }
		}
		if(kit.t > 28 || rosterBlocked(en.x + (kit.dir > 0 ? en.w + 4 : -4), en.y + en.h * 0.5)) rosterEnd(en);
	}
}

function tickCrystalScarab(en, kit){
	const r = rosterEnsure(en);
	const aim = rosterAim(en);
	if(kit.kind === 'crystalCarapace'){
		if(kit.t > 50) rosterEnd(en);
	} else if(kit.kind === 'shardToss'){
		if(kit.t === 8){
			kit.shards = [];
			for(let i = 0; i < 5; i++){
				kit.shards.push({
					x: en.x + en.w / 2 + (i - 2) * 26,
					y: en.y - 20 - (i % 2) * 16
				});
			}
			kit.lockX = aim.x; kit.lockY = aim.y;
		}
		if(kit.t === 22 && !kit.fired){
			kit.fired = true;
			for(let i = 0; i < (kit.shards || []).length; i++){
				const s = kit.shards[i];
				const dx = kit.lockX - s.x, dy = kit.lockY - s.y, d = Math.hypot(dx, dy) || 1;
				rosterSpawn(en, s.x, s.y, dx / d * 12.4, dy / d * 12.4, {
					color: '#b8e6ff', color2: '#ffffff', power: 26, width: 32, height: 32,
					shape: 'spike', effects: ['freeze'], trail: 'ice', maxAge: 90, _rosterStyle: 'shard'
				});
			}
		}
		if(kit.t > 36) rosterEnd(en);
	} else if(kit.kind === 'crystalCharge'){
		en.vx = kit.dir * 14;
		en.x += en.vx;
		rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 48, rosterDmg(26), ['freeze']);
		if(!kit.cracked && rosterBlocked(en.x + (kit.dir > 0 ? en.w + 6 : -6), en.y + en.h * 0.4)){
			kit.cracked = true;
			r.cracked += 2;
			for(let i = 0; i < r.armor.length && r.cracked > 0; i++){
				if(r.armor[i]){ r.armor[i] = 0; r.cracked--; }
			}
			rosterSpark(en.x + en.w / 2, en.y + en.h / 2, 14, { r: 180, g: 220, b: 255 });
			rosterEnd(en);
			return;
		}
		if(kit.t > 40) rosterEnd(en);
	} else if(kit.kind === 'shatterback'){
		if(!kit.popped){
			kit.popped = true;
			for(let i = 0; i < 8; i++){
				const a = i * Math.PI / 4;
				rosterSpawn(en, en.x + en.w / 2, en.y + en.h / 2, Math.cos(a) * 10.5, Math.sin(a) * 10.5, {
					color: '#d0f0ff', color2: '#ffffff', power: 22, width: 28, height: 28,
					shape: 'spike', effects: ['freeze'], trail: 'ice', maxAge: 70, _rosterStyle: 'shard'
				});
			}
			r.armor = [0, 0, 0, 0];
		}
		if(kit.t > 24) rosterEnd(en);
	}
}

function tickSnowboundMimic(en, kit){
	const r = rosterEnsure(en);
	const aim = rosterAim(en);
	if(kit.kind === 'falseCrystal'){
		r.disguised = true;
		en._rosterCamo = true;
		en._rosterCamoAlpha = 0.95;
		if(Math.hypot(aim.x - (en.x + en.w / 2), aim.y - (en.y + en.h / 2)) < 110 || kit.t > 80){
			r.disguised = false;
			en._rosterCamo = false;
			en._rosterCamoAlpha = 1;
			en.vy = -8;
			rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 80, rosterDmg(28), ['freeze']);
			rosterEnd(en);
		}
	} else if(kit.kind === 'frozenEcho'){
		if(kit.t === 4){
			r.echo = rosterFX({
				kind: 'echo', en: en, x: en.x - kit.side * 80, y: en.y, w: en.w, h: en.h,
				age: 0, max: 120, facing: en.facing
			});
		}
		if(r.echo && !r.echo.dead){
			r.echo.x += (en.x - r.echo.x) * 0.15;
			r.echo.y += (en.y - r.echo.y) * 0.15;
		}
		if(kit.t === 18){
			en.x += kit.side * 110;
			if(typeof unstuckFromTiles === 'function') unstuckFromTiles(en);
			rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 64, rosterDmg(28), ['freeze']);
		}
		if(kit.t > 36){ if(r.echo) r.echo.dead = true; rosterEnd(en); }
	} else if(kit.kind === 'avalancheFeint'){
		if(kit.t === 16){
			const behind = aim.x >= en.x + en.w / 2 ? -1 : 1;
			en.x = aim.x + behind * 50 - en.w / 2;
			if(typeof unstuckFromTiles === 'function') unstuckFromTiles(en);
			rosterHit(en, player.x + player.w / 2, player.y + player.h / 2, 90, rosterDmg(32), ['freeze']);
			rosterShake(8, 10);
		}
		if(kit.t > 28) rosterEnd(en);
	} else if(kit.kind === 'whiteout'){
		if(kit.t === 1) rosterFX({ kind: 'whiteout', x: en.x + en.w / 2, y: en.y + en.h / 2, r: 240, age: 0, max: 90 });
		if(kit.t === 8) rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 220, rosterDmg(24), ['freeze']);
		if(kit.t > 16) rosterEnd(en);
	}
}

function tickBarkbackBeetle(en, kit){
	const r = rosterEnsure(en);
	const aim = rosterAim(en);
	if(kit.kind === 'barkArmor'){
		r.armored = true;
		en.vx *= 0.45;
		if(kit.t > 36) rosterEnd(en);
	} else if(kit.kind === 'rootCharge'){
		en.vx = kit.dir * 12.5;
		en.x += en.vx;
		if(kit.t - kit.lastDrop > 4){
			kit.lastDrop = kit.t;
			rosterFX({
				kind: 'root', x: en.x + en.w / 2 - 16, y: rosterFloor(en.x, en.y) - 28,
				w: 36, h: 34, age: 0, max: 70, en: en
			});
		}
		rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 48, rosterDmg(26), []);
		if(kit.t > 28 || rosterBlocked(en.x + (kit.dir > 0 ? en.w + 4 : -4), en.y + en.h * 0.5)) rosterEnd(en);
	} else if(kit.kind === 'barkRoll'){
		en.vx = kit.vx;
		en.x += en.vx;
		if(rosterBlocked(en.x + (kit.vx > 0 ? en.w + 4 : -4), en.y + en.h * 0.45)){
			kit.vx *= -1;
			kit.bounces++;
			rosterSpark(en.x + en.w / 2, en.y + en.h / 2, 8, { r: 120, g: 80, b: 40 });
		}
		rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 50, rosterDmg(24), []);
		if(kit.t > 50 || kit.bounces >= 3) rosterEnd(en);
	} else if(kit.kind === 'splinterBurst'){
		if(!kit.popped){
			kit.popped = true;
			const side = kit.side || 1;
			for(let i = -3; i <= 3; i++){
				rosterSpawn(en, en.x + en.w / 2, en.y + en.h * 0.4, side * 10.5, i * 2.4, {
					color: '#8a6230', color2: '#c9a066', power: 22, width: 26, height: 18,
					shape: 'spike', maxAge: 70, _rosterStyle: 'splinter'
				});
			}
			r.armored = false;
		}
		if(kit.t > 14) rosterEnd(en);
	}
}

function tickPollenMoth(en, kit){
	const aim = rosterAim(en);
	if(kit.kind === 'pollenCloud'){
		if(kit.t === 4){
			rosterFX({ kind: 'pollen', x: en.x + en.w / 2, y: en.y + en.h / 2, r: 150, age: 0, max: 160, en: en, dmg: true });
			player._pollenDrift = Math.max(player._pollenDrift || 0, 180);
			rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 150, rosterDmg(22), []);
		}
		if(kit.t > 18) rosterEnd(en);
	} else if(kit.kind === 'falseBloom'){
		if(kit.t === 6){
			kit.real = Math.floor(Math.random() * 3);
			for(let i = 0; i < 3; i++){
				const bloom = {
					kind: 'bloom', x: en.x + (i - 1) * 70, y: en.y + (i === kit.real ? 0 : -10),
					hp: 12, age: 0, max: 220, real: i === kit.real, en: en
				};
				rosterFX(bloom);
				kit.blooms.push(bloom);
			}
			en._rosterHidden = true;
			en._rosterNoHit = true;
			kit.hidden = true;
		}
		for(let i = 0; i < kit.blooms.length; i++){
			const b = kit.blooms[i];
			if(b.dead && b.real){
				en._rosterHidden = false; en._rosterNoHit = false;
				rosterEnd(en);
				return;
			}
		}
		if(kit.t > 200){ en._rosterHidden = false; en._rosterNoHit = false; rosterEnd(en); }
	} else if(kit.kind === 'flutterBurst'){
		if(kit.t >= kit.next && kit.hops < 4){
			en.x += (Math.random() - 0.5) * 80;
			en.y += kit.hops % 2 ? 40 : -50;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
			rosterFX({ kind: 'pollen', x: en.x + en.w / 2, y: en.y + en.h / 2, r: 70, age: 0, max: 50, en: en, dmg: true });
			rosterHit(en, en.x + en.w / 2, en.y + en.h / 2, 64, rosterDmg(16), []);
			kit.hops++;
			kit.next = kit.t + 7;
		}
		if(kit.t > 36){
			const dx = (aim.x + aim.vx * 8) - (en.x + en.w / 2);
			en.x += Math.max(-50, Math.min(50, dx));
			rosterHit(en, aim.x, aim.y, 70, rosterDmg(24), []);
			rosterEnd(en);
		}
	} else if(kit.kind === 'migration'){
		const dx = kit.destX - en.x;
		en.x += Math.sign(dx) * 4.2;
		if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
		if((Math.abs(dx) < 16 || kit.t > 120) && !kit.spawned){
			kit.spawned = true;
			for(let i = 0; i < 3; i++){
				rosterSpawnEnemy('pollenMoth', en.x + (i - 1) * 28, en.y + 8, {
					scale: 0.62, hpMul: 0.28, small: true, noBestiary: true,
					roomId: en.roomId, puzzleSeg: en.puzzleSeg
				});
			}
			rosterEnd(en);
		}
	}
}

function tickRootParasite(en, kit){
	const r = rosterEnsure(en);
	if(kit.kind === 'parasiteGrowth'){
		if(kit.host){
			r.host = kit.host;
			en.x = kit.host.x - en.w / 2;
			en.y = kit.host.y - en.h / 2;
			en._rosterCamo = true;
			en._rosterCamoAlpha = 0.35;
			if(kit.t === 12) rosterHostAttack(en, kit.host);
		} else if(kit.t === 8){
			rosterHit(en, player.x + player.w / 2, player.y + player.h, 80, rosterDmg(22), []);
			rosterFX({ kind: 'root', x: player.x - 10, y: player.y + player.h - 8, w: 56, h: 24, age: 0, max: 50, en: en });
		}
		if(kit.t > 28) rosterEnd(en);
	} else if(kit.kind === 'hostTransfer'){
		en._rosterHidden = true;
		if(kit.t === 16 && kit.host){
			r.host = kit.host;
			en.x = kit.host.x - en.w / 2;
			en.y = kit.host.y - en.h / 2;
			en._rosterHidden = false;
			rosterSpark(en.x + en.w / 2, en.y + en.h / 2, 10, { r: 80, g: 160, b: 60 });
		}
		if(kit.t > 28){ en._rosterHidden = false; rosterEnd(en); }
	} else if(kit.kind === 'rootPulse'){
		if(kit.t >= kit.next && kit.pi < kit.plants.length){
			const p = kit.plants[kit.pi];
			const hx = p.x + (p.w || 40) * 0.5, hy = p.y + (p.h || 40) * 0.4;
			rosterFX({ kind: 'pulse', x: hx, y: hy, r: 8, age: 0, max: 22 });
			rosterHostAttack(en, rosterPlantHost(en, p));
			kit.pi++;
			kit.next = kit.t + 8;
		}
		if(!kit.plants.length && kit.t === 6){
			rosterHit(en, player.x + player.w / 2, player.y + player.h / 2, 90, rosterDmg(26), []);
			rosterFX({ kind: 'root', x: player.x - 16, y: player.y + player.h - 10, w: 70, h: 28, age: 0, max: 50, en: en });
		}
		if(kit.t > 50) rosterEnd(en);
	} else if(kit.kind === 'forcedBloom'){
		const host = kit.host || r.host;
		if(kit.t === 10 && host){
			rosterTele(host.x - 90, host.y - 90, 180, 180, 16, 'rgba(80,180,60,0.3)', 'BLOOM');
		}
		if(kit.t === 22 && !kit.slammed){
			kit.slammed = true;
			if(host) rosterHit(en, host.x, host.y, 110, rosterDmg(38), []);
			else rosterHit(en, player.x + player.w / 2, player.y + player.h / 2, 110, rosterDmg(34), []);
			r.host = null;
			en._rosterCamo = false;
			en._rosterVulnerable = true;
		}
		if(kit.t > 44){ en._rosterVulnerable = false; rosterEnd(en); }
	}
}

function rosterHostAttack(en, host){
	if(!host) return;
	if(host.kind === 'vine'){
		rosterHit(en, host.x + 40, host.y + 20, 70, rosterDmg(24), []);
		rosterFX({ kind: 'vineSwing', x: host.x, y: host.y, age: 0, max: 20 });
	} else if(host.kind === 'flower'){
		rosterHit(en, host.x, host.y + 10, 64, rosterDmg(26), []);
	} else {
		rosterFX({ kind: 'root', x: host.x - 28, y: host.y + 12, w: 70, h: 28, age: 0, max: 50, en: en });
		rosterHit(en, host.x, host.y + 20, 56, rosterDmg(20), []);
	}
}

function tickJungleChameleon(en, kit){
	const r = rosterEnsure(en);
	const aim = rosterAim(en);
	if(kit.kind === 'camouflage'){
		en._rosterCamo = true;
		en._rosterCamoAlpha = 0.2 + Math.sin(kit.t * 0.15) * 0.04;
		r.hiddenFor++;
		if(kit.t % 22 === 0) rosterFX({ kind: 'foot', x: en.x + en.w * 0.3, y: en.y + en.h, age: 0, max: 50, leaf: true });
		if(kit.t > 50) rosterEnd(en);
	} else if(kit.kind === 'tongueStrike'){
		if(kit.t === 6){
			kit.tx = aim.x; kit.ty = aim.y;
			const ox = en.x + en.w / 2, oy = en.y + 8;
			if(rosterLineHit(en, ox, oy, kit.tx, kit.ty, 34, rosterDmg(30), [])){
				kit.pulled = true;
				en.x = player.x - en.w * 0.2;
				en.y = player.y - 4;
			}
		}
		if(kit.t > 16) rosterEnd(en);
	} else if(kit.kind === 'predatorBurst'){
		if(kit.t === 4){
			const ox = en.x + en.w / 2, oy = en.y + 8;
			en.x += Math.sign(aim.x - ox) * 40;
			if(rosterLineHit(en, ox, oy, aim.x, aim.y, 36, rosterDmg(26), [])){
				en.x = player.x - en.w * 0.2;
			}
		}
		if(kit.t === 10) rosterHit(en, en.x + en.w / 2 + en.facing * 36, en.y + en.h * 0.5, 64, rosterDmg(28), []);
		if(kit.t === 16){
			en.x += (Math.random() < 0.5 ? -1 : 1) * 70;
			if(typeof unstuckFromTiles === 'function') unstuckFromTiles(en);
			en._rosterCamo = true;
			en._rosterCamoAlpha = 0.18;
			r.hiddenFor = 0;
		}
		if(kit.t > 22) rosterEnd(en);
	}
}

function harvestNearbyFire(en){
	const r = rosterEnsure(en);
	const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
	function consider(p, tag){
		if(!p || p[tag] === en) return;
		const fire = (p.effects && (p.effects.indexOf('burn') >= 0 || p.effects.indexOf('flame') >= 0)) ||
			p.trail === 'flame' || p._fireStyle || (p.color && /#f|#e[89a]|#c[3-9]|#ff/i.test(String(p.color)));
		if(!fire) return;
		if(Math.hypot((p.x || 0) - cx, (p.y || 0) - cy) < 230){
			p[tag] = en;
			r.heat = Math.min(100, (r.heat || 0) + 5);
		}
	}
	if(typeof projectiles !== 'undefined') for(let i = 0; i < projectiles.length; i++) consider(projectiles[i], '_rosterHarvest');
	if(typeof enemyProjectiles !== 'undefined') for(let i = 0; i < enemyProjectiles.length; i++) consider(enemyProjectiles[i], '_rosterHarvestE');
}

function leechDoSplit(en){
	if(en._leechSplitDone || en._rosterSmall) return;
	en._leechSplitDone = true;
	en._leechAttached = false;
	en._rosterFinal = true;
	for(let i = 0; i < 3; i++){
		rosterSpawnEnemy('furnaceLeech', en.x + (i - 1) * 22, en.y, {
			scale: 0.7, hpMul: 0.32, small: true, noBestiary: true,
			roomId: en.roomId, puzzleSeg: en.puzzleSeg
		});
	}
	rosterSpark(en.x + en.w / 2, en.y + en.h / 2, 16);
	en.hp = 0;
}

function revenantCollapse(en){
	const r = rosterEnsure(en);
	r.piles = [];
	en._rosterHidden = true;
	en._rosterNoHit = true;
	en.hp = Math.max(1, en.hp);
	for(let i = 0; i < 3; i++){
		const pile = {
			kind: 'ashPile', x: en.x + (i - 1) * 46, y: rosterFloor(en.x + (i - 1) * 46, en.y) - 8,
			hp: 36, age: 0, max: 400, en: en, reform: true
		};
		rosterFX(pile);
		r.piles.push(pile);
	}
}

function revenantLastEmber(en){
	const r = rosterEnsure(en);
	const ember = {
		kind: 'ember', x: en.x + en.w / 2, y: rosterFloor(en.x, en.y) - 6,
		hp: 18, age: 0, max: 480, en: en
	};
	r.ember = ember;
	en._rosterHidden = true;
	en._rosterNoHit = true;
	en.hp = 1;
	rosterFX(ember);
}

/* ======================== PASSIVE / UPDATE ======================== */
function rosterPassive(en){
	const r = rosterEnsure(en);
	const type = rosterType(en);
	if(r.fed > 0){
		r.fed--;
		if(r.fed <= 0 && type === 'furnaceLeech' && !en._rosterSmall){
			const sizeM = (typeof DIFF_SIZE_MULT === 'number') ? DIFF_SIZE_MULT : 1.4;
			en.w = Math.round((en.typeDef.w || 16) * sizeM);
			en.h = Math.round((en.typeDef.h || 14) * sizeM);
		}
	}
	if(type === 'cinderBeetle' && !r.burstUsed && en.hp <= en.maxHp * 0.28 && !en._rosterBusy){
		castBeetleCinderBurst(en);
	}
	if(type === 'magmaHarvester'){
		harvestNearbyFire(en);
		if(r.heat >= 100 && !en._rosterBusy && !r.overheatUsed){
			r.overheatUsed = true;
			castHarvesterOverheated(en);
		}
		if(r.heat < 40) r.overheatUsed = false;
	}
	if(type === 'furnaceLeech'){
		if(r.attached){
			en.x = player.x + player.w * 0.55;
			en.y = player.y + 4;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
		}
		if(!en._rosterBusy && r.stolen >= 42) castLeechSiphonBurst(en);
		if(!en._rosterBusy && en.hp <= en.maxHp * 0.3 && !en._leechSplitDone && !en._rosterSmall) leechDoSplit(en);
	}
	if(type === 'pollenMoth' && !en._rosterSmall && !r.migrated && en.hp <= en.maxHp * 0.32 && !en._rosterBusy){
		castMothMigration(en);
	}
	if(type === 'crystalScarab'){
		let gone = 0;
		for(let i = 0; i < (r.armor || []).length; i++) if(!r.armor[i]) gone++;
		if(gone >= 3 && !en._rosterBusy && !r.shatterFired){
			r.shatterFired = true;
			castScarabShatterback(en);
		}
	}
	if(type === 'barkbackBeetle' && r.armored && r.armor <= 0 && !en._rosterBusy){
		castBarkSplinterBurst(en);
	}
	if(type === 'jungleChameleon'){
		if(en._rosterCamo) r.hiddenFor++;
		if(!en._rosterBusy && r.hiddenFor > 70){
			r.hiddenFor = 0;
			castChamPredatorBurst(en);
		}
	}
	if(type === 'ashRevenant' && r.ember && !r.ember.dead && r.ember.age > 460){
		en.hp = Math.round(en.maxHp * 0.22);
		en._rosterHidden = false;
		en._rosterNoHit = false;
		en.dead = false;
		r.ember.dead = true;
		r.ember = null;
		rosterSpark(en.x + en.w / 2, en.y + en.h / 2, 18, { r: 255, g: 120, b: 40 });
	}
	if(type === 'snowboundMimic' && r.disguised && !en._rosterBusy){
		en._rosterCamo = true;
		en._rosterCamoAlpha = 0.92;
	}
}

function rosterTickKit(en){
	const kit = en.rosterKit;
	if(!kit) return;
	kit.t++;
	const type = kit.type || rosterType(en);
	if(type === 'cinderBeetle') tickCinderBeetle(en, kit);
	else if(type === 'furnaceLeech') tickFurnaceLeech(en, kit);
	else if(type === 'ashRevenant') tickAshRevenant(en, kit);
	else if(type === 'magmaHarvester') tickMagmaHarvester(en, kit);
	else if(type === 'frostMantis') tickFrostMantis(en, kit);
	else if(type === 'glacierEel') tickGlacierEel(en, kit);
	else if(type === 'crystalScarab') tickCrystalScarab(en, kit);
	else if(type === 'snowboundMimic') tickSnowboundMimic(en, kit);
	else if(type === 'barkbackBeetle') tickBarkbackBeetle(en, kit);
	else if(type === 'pollenMoth') tickPollenMoth(en, kit);
	else if(type === 'rootParasite') tickRootParasite(en, kit);
	else if(type === 'jungleChameleon') tickJungleChameleon(en, kit);
	else rosterEnd(en);
}

function rosterThink(en){
	if(!en || en.dead || en._rosterBusy || en.rosterKit) return;
	if((en.stunTimer || 0) > 0) return;
	const type = rosterType(en);
	if(!ROSTER_KIT_TYPES[type] || !en.typeDef) return;
	rosterEnsure(en);
	const spells = en.typeDef.spells || [];
	if(!spells.length) return;
	if(!en.spellCooldowns || en.spellCooldowns.length !== spells.length){
		en.spellCooldowns = spells.map(function(){ return 0; });
	}
	for(let i = 0; i < en.spellCooldowns.length; i++){
		if(en.spellCooldowns[i] > 0) en.spellCooldowns[i]--;
	}
	if((en._rosterGcd || 0) > 0){ en._rosterGcd--; return; }
	const aim = rosterAim(en);
	const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
	const dist = Math.hypot(aim.x - ox, aim.y - oy);
	const seeR = (typeof enemyDetectRange === 'function')
		? enemyDetectRange(en)
		: ((en.typeDef.detectRange || 600) * 1.4);
	if(dist > seeR) return;
	const ready = [];
	for(let i = 0; i < spells.length; i++){
		if((en.spellCooldowns[i] || 0) > 0) continue;
		const reach = (typeof enemyAtkRange === 'function')
			? enemyAtkRange(spells[i].range || en.typeDef.attackRange || 420)
			: (spells[i].range || 420);
		if(dist <= reach) ready.push(i);
	}
	if(!ready.length) return;
	const pick = ready[Math.floor(Math.random() * ready.length)];
	const sp = spells[pick];
	const fn = (typeof CAST_FNS !== 'undefined' && CAST_FNS[sp.castFn])
		|| (typeof window !== 'undefined' && window[sp.castFn]);
	if(!fn) return;
	fn(en);
	en.attackAnimTimer = Math.max(en.attackAnimTimer || 0, 48);
	en.spellCooldowns[pick] = Math.round((sp.cooldown || 120) * ((typeof DIFF_CD_MULT === 'number') ? DIFF_CD_MULT : 1));
	en._rosterGcd = 72;
}
function updateRosterEnemy(en){
	if(!en || en.dead) return false;
	if(!ROSTER_KIT_TYPES[rosterType(en)] && !en.rosterKit) return false;
	rosterPassive(en);
	if(en.rosterKit) rosterTickKit(en);
	else rosterThink(en);
	return !!en._rosterBusy;
}

function updateRosterWorld(){
	if((player._pollenDrift || 0) > 0){
		player._pollenDrift--;
		if(typeof projectiles !== 'undefined'){
			for(let i = 0; i < projectiles.length; i++){
				const p = projectiles[i];
				if(!p || p.hasHit || p._coopRemote) continue;
				p.vx += (Math.random() - 0.5) * 0.32;
				p.vy += (Math.random() - 0.5) * 0.2;
				if(p.angle != null) p.angle += (Math.random() - 0.5) * 0.035;
			}
		}
	}
	if((player._rosterSlideIce || 0) > 0 && (player._rosterSlide || 0) <= 0) player._rosterSlideIce *= 0.9;
	for(let i = rosterWorldFX.length - 1; i >= 0; i--){
		const fx = rosterWorldFX[i];
		fx.age = (fx.age || 0) + 1;
		if(fx.kind === 'root' && !fx.dead && player.iFrames <= 0){
			if(circRect(fx.x + fx.w / 2, fx.y + fx.h / 2, 28, player.x, player.y, player.w, player.h)){
				player._kitSlow = Math.max(player._kitSlow || 0, 0.55);
				if(fx.age % 8 === 0) damagePlayer(rosterDmg(10), []);
			}
		}
		if(fx.kind === 'icePatch' && !fx.shattered && !fx.dead){
			if(player.x + player.w > fx.x && player.x < fx.x + fx.w && player.y + player.h > fx.y - 8 && player.y + player.h < fx.y + 20){
				player._rosterSlide = Math.max(player._rosterSlide || 0, 90);
				player._rosterSlideIce = Math.max(player._rosterSlideIce || 0, 0.5);
			}
		}
		if(fx.kind === 'pollen' && circRect(fx.x, fx.y, fx.r, player.x, player.y, player.w, player.h)){
			player._pollenDrift = Math.max(player._pollenDrift || 0, 110);
			if(fx.dmg && player.iFrames <= 0 && fx.age % 8 === 0) damagePlayer(rosterDmg(12), []);
		}
		if(fx.kind === 'frozenShot' && !fx.dead && !fx.launched && fx.age >= 48){
			fx.launched = true;
			fx.dead = true;
			const aim = rosterAim(fx.en);
			const dx = aim.x - fx.x, dy = aim.y - fx.y, d = Math.hypot(dx, dy) || 1;
			rosterSpawn(fx.en, fx.x, fx.y, dx / d * 12.2, dy / d * 12.2, {
				color: '#cceeff', color2: '#ffffff', power: fx.power || 22, width: 34, height: 34,
				shape: 'circle', effects: ['freeze'], trail: 'ice', maxAge: 80, _rosterStyle: 'return'
			});
		}
		if(fx.dead || fx.age > (fx.max || 120)) rosterWorldFX.splice(i, 1);
	}
	if(typeof enemyProjectiles !== 'undefined'){
		for(let i = 0; i < enemyProjectiles.length; i++){
			const p = enemyProjectiles[i];
			if(!p || !p._rosterAccel) continue;
			const aimx = player.x + player.w / 2, aimy = player.y + player.h / 2;
			const dx = aimx - p.x, dy = aimy - p.y, d = Math.hypot(dx, dy) || 1;
			const spd = Math.hypot(p.vx, p.vy);
			const want = Math.min(14, spd + 0.28);
			p.vx = p.vx * 0.86 + (dx / d) * want * 0.14;
			p.vy = p.vy * 0.86 + (dy / d) * want * 0.14;
		}
	}
}

function rosterApplyPlayerMove(mx, currentSpeed){
	if((player._rosterSlide || 0) <= 0){
		player._rosterSlideVx = player.vx;
		return;
	}
	player._rosterSlide--;
	const slip = Math.min(0.74, 0.34 + (player._rosterSlideIce || 0));
	player._rosterSlideVx = player._rosterSlideVx || player.vx || 0;
	const target = mx * currentSpeed;
	const follow = 0.14 + (1 - slip) * 0.42;
	player._rosterSlideVx += (target - player._rosterSlideVx) * follow;
	if(mx === 0) player._rosterSlideVx *= (0.975 - slip * 0.05);
	const cap = currentSpeed * 1.55;
	if(Math.abs(player._rosterSlideVx) > cap) player._rosterSlideVx = Math.sign(player._rosterSlideVx) * cap;
	player.vx = player._rosterSlideVx;
	if(player._iceVx != null) player._iceVx = player._rosterSlideVx;
}

function rosterKitOnManaSpent(cost){
	if(!cost || typeof enemies === 'undefined') return;
	for(let i = 0; i < enemies.length; i++){
		const en = enemies[i];
		if(!en || en.dead || !en._leechAttached) continue;
		const r = rosterEnsure(en);
		const steal = Math.max(1, Math.ceil(cost * (en._rosterSmall ? 0.22 : 0.4)));
		r.stolen = (r.stolen || 0) + steal;
		r.heat = Math.min(100, (r.heat || 0) + steal * 0.4);
		dmgNumbers.push({ x: en.x + en.w / 2, y: en.y - 12, text: '-' + steal + ' mana', age: 0, color: '#ff8844' });
	}
}

function rosterHitProp(p, fx){
	if(!fx || fx.dead || fx.hp == null) return false;
	const pad = 10;
	if(!circRect(p.x, p.y, 10, fx.x - pad, (fx.y || 0) - pad, (fx.w || 22) + pad * 2, (fx.h || 16) + pad * 2)) return false;
	fx.hp -= Math.max(8, p.power || 8);
	if(typeof spawnImpact === 'function') spawnImpact(p.x, p.y, p.color || '#fff');
	if(fx.hp <= 0){
		fx.dead = true;
		if(fx.kind === 'ember' && fx.en){
			fx.en.hp = 0;
			fx.en._rosterHidden = false;
			fx.en._rosterNoHit = false;
			fx.en._rosterFinal = true;
		}
		if(fx.kind === 'bloom' && fx.real && fx.en){
			fx.en._rosterHidden = false;
			fx.en._rosterNoHit = false;
		}
	}
	p.hasHit = true;
	return true;
}

function rosterKitInterceptProj(p){
	if(!p || p.hasHit) return false;
	const pool = (typeof enemies !== 'undefined' ? enemies : []).concat(typeof playerMinions !== 'undefined' ? playerMinions : []);
	for(let i = 0; i < pool.length; i++){
		const en = pool[i];
		if(!en || en.dead || !en._rosterParry) continue;
		const hr = { x: en.x - 18, y: en.y - 18, w: en.w + 36, h: en.h + 36 };
		if(p.x > hr.x && p.x < hr.x + hr.w && p.y > hr.y && p.y < hr.y + hr.h){
			p.hasHit = true;
			rosterFX({
				kind: 'frozenShot', x: p.x, y: p.y, age: 0, max: 50, en: en,
				power: p.power || 10, color: p.color || '#88ddff'
			});
			rosterSpark(p.x, p.y, 10, { r: 180, g: 220, b: 255 });
			en._rosterParry = false;
			return true;
		}
	}
	for(let i = 0; i < rosterWorldFX.length; i++){
		const fx = rosterWorldFX[i];
		if(fx.kind === 'ashPile' || fx.kind === 'ember' || fx.kind === 'bloom'){
			if(rosterHitProp(p, fx)) return true;
		}
	}
	return false;
}

function rosterKitOnEnemyHit(en, p, baseDmg){
	if(!en || !ROSTER_KIT_TYPES[rosterType(en)]) return 1;
	const r = rosterEnsure(en);
	const type = rosterType(en);
	let mult = 1;
	if(en._rosterVulnerable) mult *= 1.55;
	if(type === 'cinderBeetle'){
		if(en.rosterKit && en.rosterKit.kind === 'heatShell' && !en._rosterOpen){
			r.heat = Math.min(100, (r.heat || 0) + 11);
			mult *= 0.22;
			dmgNumbers.push({ x: en.x + en.w / 2, y: en.y - 18, text: 'HEAT ' + Math.round(r.heat), age: 0, color: '#ff6622' });
		}
		if(en.rosterKit && en.rosterKit.kind === 'emberRoll' && en._rosterOpen){
			mult *= 1.7;
			rosterEnd(en);
		}
		if(en.rosterKit && en.rosterKit.kind === 'furnaceBack' && r.plates && p){
			const px = p.x, py = p.y;
			for(let i = 0; i < r.plates.length; i++){
				const pl = r.plates[i];
				if(!pl || pl.hp <= 0) continue;
				const x = en.x + en.w * pl.x, y = en.y + en.h * pl.y;
				if(Math.hypot(px - x, py - y) < 18){
					pl.hp = 0;
					r.plateChain = (r.plateChain || 0) + 1;
					rosterHit(en, x, y, r.plateChain >= 2 ? 70 : 28, rosterDmg(r.plateChain >= 2 ? 18 : 8), ['burn']);
					if(r.plateChain >= 2) rosterShake(6, 10);
					setTimeout(function(){ if(r) r.plateChain = Math.max(0, (r.plateChain || 1) - 1); }, 400);
					mult *= 1.25;
					break;
				}
			}
		}
	}
	if(type === 'furnaceLeech' && en._leechAttached){
		const strong = (baseDmg || 0) >= 34 || (p && (p.power || 0) >= 5);
		if(strong){
			en._leechAttached = false;
			r.attached = false;
			en.x = player.x + (Math.random() < 0.5 ? -50 : 50);
			rosterEnd(en);
			dmgNumbers.push({ x: en.x + en.w / 2, y: en.y - 14, text: 'DETACHED', age: 0, color: '#ffe080' });
		} else {
			mult *= 0.55;
		}
	}
	if(type === 'magmaHarvester'){
		if(en.rosterKit && en.rosterKit.kind === 'overheated'){
			en.rosterKit.interrupted = (en.rosterKit.interrupted || 0) + Math.max(8, (baseDmg || 10) * 0.35);
			mult *= 1.8;
		}
	}
	if(type === 'frostMantis' && en._rosterCounter && en.rosterKit){
		en.rosterKit.struck = en.rosterKit.t;
		en._rosterCounter = false;
		mult *= 0.4;
	}
	if(type === 'crystalScarab' && r.armor){
		const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
		const ox = p ? p.x : player.x + player.w / 2;
		const oy = p ? p.y : player.y + player.h / 2;
		const ang = Math.atan2(oy - cy, ox - cx);
		let dir = 0;
		if(Math.abs(Math.cos(ang)) > Math.abs(Math.sin(ang))) dir = Math.cos(ang) > 0 ? 1 : 3;
		else dir = Math.sin(ang) > 0 ? 2 : 0;
		if(r.armor[dir]){
			mult *= 0.18;
			dmgNumbers.push({ x: cx, y: en.y - 14, text: 'ARMORED', age: 0, color: '#aaddff' });
		} else {
			mult *= 1.15;
			if(r.armor[dir] === 0 && r.exposed === dir) r.armor[dir] = 0;
		}
	}
	if(type === 'barkbackBeetle'){
		if(r.armored && r.armor > 0){
			r.armor -= Math.max(8, baseDmg || 10);
			mult *= 0.32;
			if(p) r.breakSide = (p.x >= en.x + en.w / 2) ? 1 : -1;
			if(r.armor <= 0) dmgNumbers.push({ x: en.x + en.w / 2, y: en.y - 14, text: 'BARK BREAK', age: 0, color: '#c9a066' });
		}
	}
	if(type === 'jungleChameleon' && en._rosterCamo){
		en._rosterCamo = false;
		en._rosterCamoAlpha = 1;
		r.camoHue = (r.camoHue + 1) % 3;
		r.hiddenFor = 0;
	}
	if(type === 'pollenMoth' && en.rosterKit && en.rosterKit.kind === 'falseBloom'){
		mult = 0;
	}
	return mult;
}

function rosterKitPreventDeath(en){
	if(!en || !ROSTER_KIT_TYPES[rosterType(en)]) return false;
	if(en._rosterFinal || en._rosterChild && rosterType(en) !== 'ashRevenant') return false;
	const type = rosterType(en);
	const r = rosterEnsure(en);
	if(type === 'ashRevenant'){
		if(en._rosterNoHit && r.ember) return true;
		if((r.lives || 0) > 1){
			r.lives--;
			en.hp = 1;
			revenantCollapse(en);
			if(!en.rosterKit) beginRosterKit(en, 'reformation', { busy: true, waiting: true });
			return true;
		}
		if(!r.ember){
			en.hp = 1;
			revenantLastEmber(en);
			return true;
		}
	}
	if(type === 'furnaceLeech' && !en._leechSplitDone && !en._rosterSmall){
		leechDoSplit(en);
	}
	return false;
}

function rosterCamoAlpha(en){
	if(!en || !en._rosterCamo) return 1;
	return en._rosterCamoAlpha != null ? en._rosterCamoAlpha : 0.22;
}

function rosterKitSpriteRow(en){
	const type = rosterType(en);
	if(!ROSTER_KIT_TYPES[type]) return null;
	if(en.dead) return 5;
	if(en.rosterKit && en.rosterKit.row != null) return en.rosterKit.row;
	return null;
}
function rosterKitSheetGrid(en, img){
	if(typeof dungeonRegularKitGrid === 'function') return dungeonRegularKitGrid(en, img, ROSTER_KIT_TYPES);
	return null;
}

function drawRosterWorld(){
	if(typeof ctx === 'undefined' || typeof camera === 'undefined') return;
	for(let i = 0; i < rosterWorldFX.length; i++){
		const fx = rosterWorldFX[i];
		if(!fx || fx.dead) continue;
		const x = fx.x - camera.x, y = (fx.y || 0) - camera.y;
		ctx.save();
		if(fx.kind === 'ring'){
			ctx.strokeStyle = fx.color || 'rgba(255,90,20,0.5)';
			ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(x, y, fx.r * (0.65 + fx.age / fx.max * 0.4), 0, Math.PI * 2); ctx.stroke();
		} else if(fx.kind === 'ashPile'){
			ctx.fillStyle = 'rgba(70,50,40,0.9)';
			ctx.beginPath(); ctx.ellipse(x, y, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = 'rgba(255,120,40,0.35)';
			ctx.beginPath(); ctx.arc(x, y - 4, 4, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'ember'){
			const g = 0.5 + Math.sin(fx.age * 0.2) * 0.5;
			ctx.fillStyle = 'rgba(255,' + Math.round(80 + g * 80) + ',20,0.95)';
			ctx.beginPath(); ctx.arc(x, y, 5 + g * 2, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'icePatch'){
			if(fx.shattered){ ctx.restore(); continue; }
			ctx.fillStyle = 'rgba(180,220,255,0.35)';
			ctx.fillRect(x, y, fx.w || 70, fx.h || 10);
		} else if(fx.kind === 'foot'){
			ctx.fillStyle = fx.leaf ? 'rgba(80,140,50,0.45)' : 'rgba(200,230,255,0.4)';
			ctx.beginPath(); ctx.ellipse(x, y, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'pollen'){
			ctx.fillStyle = 'rgba(220,210,80,' + (0.18 + (1 - fx.age / fx.max) * 0.2) + ')';
			ctx.beginPath(); ctx.arc(x, y, fx.r, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'bloom'){
			ctx.fillStyle = fx.real ? '#e8c84a' : '#7ecb5a';
			ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'echo'){
			ctx.globalAlpha = 0.4;
			ctx.fillStyle = '#c8e8ff';
			ctx.fillRect(x, y, fx.w || 30, fx.h || 36);
		} else if(fx.kind === 'whiteout'){
			ctx.fillStyle = 'rgba(230,240,255,' + (0.22 + (1 - fx.age / fx.max) * 0.2) + ')';
			ctx.beginPath(); ctx.arc(x, y, fx.r, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'root'){
			ctx.fillStyle = 'rgba(70,50,30,0.85)';
			ctx.fillRect(x, y, fx.w || 16, fx.h || 18);
		} else if(fx.kind === 'pulse'){
			ctx.strokeStyle = 'rgba(90,200,70,0.7)';
			ctx.lineWidth = 2;
			ctx.beginPath(); ctx.arc(x, y, 10 + fx.age * 2, 0, Math.PI * 2); ctx.stroke();
		} else if(fx.kind === 'vineSwing'){
			ctx.strokeStyle = '#4a8a38';
			ctx.lineWidth = 4;
			ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.quadraticCurveTo(x + 40, y, x + 70, y + 30); ctx.stroke();
		} else if(fx.kind === 'frozenShot'){
			ctx.fillStyle = '#dff6ff';
			ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
		}
		ctx.restore();
	}
	if(typeof enemies === 'undefined') return;
	for(let i = 0; i < enemies.length; i++) drawRosterOverlay(enemies[i]);
}

function drawRosterOverlay(en){
	if(!en || en.dead || en._rosterHidden) return;
	if(!ROSTER_KIT_TYPES[rosterType(en)]) return;
	const r = en._roster;
	if(!r) return;
	const cx = en.x + en.w / 2 - camera.x, cy = en.y + en.h / 2 - camera.y;
	ctx.save();
	const type = rosterType(en);
	if(type === 'cinderBeetle' && r.heat > 8){
		ctx.strokeStyle = 'rgba(255,80,20,' + (0.25 + r.heat / 200) + ')';
		ctx.lineWidth = 2;
		ctx.beginPath(); ctx.arc(cx, cy, 20 + r.heat * 0.12, 0, Math.PI * 2); ctx.stroke();
	}
	if(type === 'cinderBeetle' && en.rosterKit && en.rosterKit.kind === 'furnaceBack' && r.plates){
		for(let i = 0; i < r.plates.length; i++){
			const pl = r.plates[i];
			if(!pl || pl.hp <= 0) continue;
			ctx.fillStyle = '#ff6622';
			ctx.fillRect(en.x + en.w * pl.x - 5 - camera.x, en.y + en.h * pl.y - 4 - camera.y, 10, 8);
		}
	}
	if(type === 'magmaHarvester'){
		const glow = 0.25 + (r.heat || 0) / 140;
		ctx.fillStyle = 'rgba(255,90,20,' + glow + ')';
		ctx.beginPath(); ctx.arc(cx, en.y + en.h * 0.28 - camera.y, 8 + (r.heat || 0) * 0.06, 0, Math.PI * 2); ctx.fill();
	}
	if(type === 'crystalScarab' && r.armor){
		const dirs = [[0, -18], [20, 0], [0, 16], [-20, 0]];
		for(let i = 0; i < 4; i++){
			if(!r.armor[i]) continue;
			ctx.fillStyle = 'rgba(180,230,255,0.55)';
			ctx.fillRect(cx + dirs[i][0] - 6, cy + dirs[i][1] - 4, 12, 8);
		}
	}
	if(type === 'frostMantis' && en._rosterParry){
		ctx.strokeStyle = 'rgba(160,220,255,0.8)';
		ctx.lineWidth = 2;
		ctx.beginPath(); ctx.arc(cx, cy, 26, 0, Math.PI * 2); ctx.stroke();
	}
	if(type === 'frostMantis' && en._rosterCounter){
		ctx.strokeStyle = 'rgba(80,160,255,0.7)';
		ctx.setLineDash([6, 4]);
		ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.stroke();
	}
	if(type === 'jungleChameleon' && en._rosterCamo){
		ctx.fillStyle = 'rgba(255,255,200,0.7)';
		ctx.beginPath(); ctx.arc(cx + 6, cy - 6, 2.2, 0, Math.PI * 2); ctx.fill();
	}
	if(type === 'furnaceLeech' && en._leechAttached){
		ctx.strokeStyle = 'rgba(255,100,40,0.7)';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(player.x + player.w / 2 - camera.x, player.y + player.h / 2 - camera.y);
		ctx.lineTo(cx, cy);
		ctx.stroke();
	}
	if(en.rosterKit && en.rosterKit.kind === 'ashStep' && en.rosterKit.cloud){
		const c = en.rosterKit.cloud;
		ctx.fillStyle = 'rgba(80,60,50,0.55)';
		ctx.beginPath(); ctx.arc(c.x - camera.x, c.y - camera.y, 16, 0, Math.PI * 2); ctx.fill();
	}
	if(en.rosterKit && en.rosterKit.kind === 'shardToss' && en.rosterKit.shards && !en.rosterKit.fired){
		for(let i = 0; i < en.rosterKit.shards.length; i++){
			const s = en.rosterKit.shards[i];
			ctx.fillStyle = '#d8f4ff';
			ctx.beginPath(); ctx.arc(s.x - camera.x, s.y - camera.y, 5, 0, Math.PI * 2); ctx.fill();
		}
	}
	if(en.rosterKit && en.rosterKit.kind === 'snapTurn'){
		ctx.strokeStyle = 'rgba(180,220,255,0.7)';
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx + Math.cos(en.rosterKit.ang) * 220, cy + Math.sin(en.rosterKit.ang) * 220);
		ctx.stroke();
	}
	if(en.rosterKit && en.rosterKit.kind === 'tongueStrike'){
		ctx.strokeStyle = '#e87878';
		ctx.lineWidth = 10;
		ctx.lineCap = 'round';
		ctx.beginPath();
		ctx.moveTo(cx, en.y + 8 - camera.y);
		ctx.lineTo(en.rosterKit.tx - camera.x, en.rosterKit.ty - camera.y);
		ctx.stroke();
	}
	ctx.restore();
}

function drawRosterKitProj(p){
	if(!p || !p._rosterStyle) return false;
	const px = p.x - camera.x, py = p.y - camera.y;
	ctx.save();
	if(p._rosterStyle === 'siphon'){
		const r = 16 + Math.sin((p.age || 0) * 0.3) * 4;
		ctx.fillStyle = '#ff6622';
		ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
	} else if(p._rosterStyle === 'shard' || p._rosterStyle === 'return'){
		ctx.fillStyle = '#e8f6ff';
		ctx.beginPath(); ctx.moveTo(px, py - 14); ctx.lineTo(px + 9, py + 10); ctx.lineTo(px - 9, py + 10); ctx.fill();
	} else if(p._rosterStyle === 'splinter'){
		ctx.fillStyle = '#8a6230';
		ctx.fillRect(px - 9, py - 4, 18, 8);
	} else {
		ctx.fillStyle = p.color || '#ff8844';
		ctx.beginPath(); ctx.arc(px, py, 12, 0, Math.PI * 2); ctx.fill();
	}
	ctx.restore();
	return true;
}

function registerRosterCasts(map){
	const casts = {
		castBeetleHeatShell, castBeetleEmberRoll, castBeetleFurnaceBack, castBeetleCinderBurst,
		castLeechManaSiphon, castLeechSiphonBurst, castLeechFurnaceFeeding, castLeechMoltenSplit,
		castRevenantAshenStrike, castRevenantReformation, castRevenantAshStep, castRevenantLastEmber,
		castHarvesterHeatCollection, castHarvesterMoltenSweep, castHarvesterCoreDischarge, castHarvesterOverheated,
		castMantisFrozenParry, castMantisIceStep, castMantisFrostblade, castMantisWinterCounter,
		castEelIceCurrent, castEelSnapTurn, castEelFrostLoop, castEelBreakingCharge,
		castScarabCrystalCarapace, castScarabShardToss, castScarabCrystalCharge, castScarabShatterback,
		castMimicFalseCrystal, castMimicFrozenEcho, castMimicAvalancheFeint, castMimicWhiteout,
		castBarkBarkArmor, castBarkRootCharge, castBarkBarkRoll, castBarkSplinterBurst,
		castMothPollenCloud, castMothFalseBloom, castMothFlutterBurst, castMothMigration,
		castParaParasiteGrowth, castParaHostTransfer, castParaRootPulse, castParaForcedBloom,
		castChamCamouflage, castChamTongueStrike, castChamColorShift, castChamPredatorBurst
	};
	for(const k in casts){
		if(typeof window !== 'undefined') window[k] = casts[k];
		if(map) map[k] = casts[k];
	}
}
registerRosterCasts(typeof CAST_FNS !== 'undefined' ? CAST_FNS : null);

if(typeof window !== 'undefined'){
	window.updateRosterEnemy = updateRosterEnemy;
	window.updateRosterWorld = updateRosterWorld;
	window.drawRosterWorld = drawRosterWorld;
	window.drawRosterKitProj = drawRosterKitProj;
	window.rosterKitOnEnemyHit = rosterKitOnEnemyHit;
	window.rosterKitInterceptProj = rosterKitInterceptProj;
	window.rosterKitPreventDeath = rosterKitPreventDeath;
	window.rosterKitOnManaSpent = rosterKitOnManaSpent;
	window.rosterApplyPlayerMove = rosterApplyPlayerMove;
	window.rosterKitSpriteRow = rosterKitSpriteRow;
	window.rosterKitSheetGrid = rosterKitSheetGrid;
	window.rosterCamoAlpha = rosterCamoAlpha;
	window.rosterEnd = rosterEnd;
	window.registerRosterCasts = registerRosterCasts;
	window.ROSTER_KIT_TYPES = ROSTER_KIT_TYPES;
}
