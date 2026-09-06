/* =============================================================
   Late dungeon kit — Bone Wraith, Frost Hatchling,
   Flame Salamander, Magma Imp, Abyssal Guardian, Coral Sentinel,
   Depth Serpent, Sand Wraith, Tomb Guardian, Desert Serpent,
   Mummy Warrior, Scarab Swarm, Sandstorm Djinn.
   Threats spawn immediately and keep going if the caster dies.
   ============================================================= */

const LATE_KIT_TYPES = {
	boneWraith:1, babyDragon:1, flameSalamander:1, magmaImp:1,
	abyssalGuardian:1, coralSentinel:1, depthSerpent:1,
	sandWraith:1, tombGuardian:1, desertSerpent:1,
	mummyWarrior:1, scarabSwarm:1, sandstormDjinn:1
};
const lateWorldFX = [];

function lAtkS(n){ return n * ((typeof ENEMY_ATK_SCALE === 'number') ? ENEMY_ATK_SCALE : 1.3); }
function lAim(en){ return (typeof fireKitAim === 'function') ? fireKitAim(en) : { x: player.x + player.w / 2, y: player.y + player.h / 2, vx: player.vx || 0, vy: player.vy || 0, box: player }; }
function lLead(en, frames){
	const a = lAim(en);
	const t = frames == null ? 14 : frames;
	return { x: a.x + (a.vx || 0) * t, y: a.y + (a.vy || 0) * t, vx: a.vx || 0, vy: a.vy || 0, box: a.box };
}
function lFriend(en){ return !!(en && (en.isNecroSummon || en.necroFriendly)); }
function lDmg(n){ return Math.round(n * 2.55 * ((typeof DIFF_DMG_MULT === 'number') ? DIFF_DMG_MULT : 1)); }
function lFloor(x, y){ return (typeof fireKitFloorY === 'function') ? fireKitFloorY(x, y) : ((y || 0) + 80); }
function lBlocked(x, y){ return (typeof fireKitBlocked === 'function') ? fireKitBlocked(x, y) : false; }
function lShake(a, t){ if(typeof shakeScreen === 'function') shakeScreen(a, t); }
function lBoss(en){ return !!(en && en.bossPhase === 2); }
function lSpark(x, y, n, color){
	if(typeof particles === 'undefined') return;
	const c = color || { r: 180, g: 120, b: 220 };
	for(let i = 0; i < Math.min(n || 12, 22); i++){
		const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 6;
		particles.push({ x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 12, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.4, life: 16 + Math.random() * 16, maxLife: 32, r: 2 + Math.random() * 3, color: c });
	}
}
function lSpawn(en, x, y, vx, vy, opts){
	opts = opts || {};
	opts.noZoneNerf = true;
	const p = spawnEnemyProj(x, y, vx, vy, opts);
	if(p){
		p._lateStyle = opts._lateStyle || 'bolt';
		p._lateEn = en;
		if(lFriend(en)){
			if(typeof markNecroFriendlyProj === 'function') markNecroFriendlyProj(p, en);
			else p.necroFriendly = true;
		}
	}
	return p;
}
function lHit(en, x, y, r, dmg, effects){
	r = lAtkS(r);
	if(lFriend(en)){
		if(typeof necroScaleKitDmg === 'function') dmg = necroScaleKitDmg(en, dmg);
		const pool = (typeof enemies !== 'undefined' ? enemies : []).concat(typeof dummies !== 'undefined' ? dummies : []);
		for(let i = 0; i < pool.length; i++){
			const t = pool[i];
			if(!t || t.dead) continue;
			if(circRect(x, y, r, t.x, t.y, t.w, t.h)){
				t.hp -= dmg; t.flash = 8;
				dmgNumbers.push({ x: t.x + t.w / 2, y: t.y - 10, text: Math.round(dmg) + '', age: 0, color: '#c9a6ff' });
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
function lSlow(amt){ player._kitSlow = Math.max(player._kitSlow || 0, amt); }
function lFX(fx){ lateWorldFX.push(fx); return fx; }
function lateEnd(en){
	if(!en) return;
	en.lateKit = null;
	en._lateKitBusy = false;
	en._lateHidden = false;
	en._lateNoHit = false;
	en._lateAlpha = 1;
	en._lateShield = false;
	en._lateCalcify = 0;
	en._lateAbsorb = 0;
}
function beginLate(en, kind, extra){
	en.lateKit = Object.assign({ kind, t: 0, type: en.necroType || en.type, row: 2 }, extra || {});
	en._lateKitBusy = extra && extra.busy === false ? false : true;
	en.attackAnimTimer = Math.max(en.attackAnimTimer || 0, 36);
	en.facing = lAim(en).x >= en.x + en.w / 2 ? 1 : -1;
	return en.lateKit;
}
function lRelease(en, kind, ms){
	setTimeout(function(){ if(en.lateKit && en.lateKit.kind === kind) lateEnd(en); }, ms);
}
function lLookSide(){
	if(!player._lateLook) player._lateLook = { L: 1, R: 1 };
	if(player.facing < 0) player._lateLook.L += 1;
	else player._lateLook.R += 1;
	return player._lateLook.L <= player._lateLook.R ? -1 : 1;
}
function lClampFly(en){
	if(en.x < 20) en.x = 20;
	if(typeof WORLD_W === 'number' && en.x + en.w > WORLD_W - 20) en.x = WORLD_W - 20 - en.w;
	if(en.y < 20) en.y = 20;
	if(typeof WORLD_H === 'number' && en.y + en.h > WORLD_H - 20) en.y = WORLD_H - 20 - en.h;
}

/* ---------- BONE WRAITH ---------- */
function castShadowBolt(en){
	const ox = en.x + en.w / 2, oy = en.y + en.h * 0.35;
	const aim = lLead(en, 10);
	for(let i = 0; i < 5; i++){
		const a = Math.atan2(aim.y - oy, aim.x - ox) + (i - 2) * 0.22;
		lFX({ kind:'shadowBolt', en, x: ox, y: oy, vx: Math.cos(a) * 11.4, vy: Math.sin(a) * 11.4, age: 0, max: 90, phase: 'out', hit: false });
	}
	lSpark(ox, oy, 10, { r: 140, g: 80, b: 200 });
	beginLate(en, 'shadowBolt', { busy: false });
	lRelease(en, 'shadowBolt', 220);
}
function castPhaseStrike(en){
	const aim = lLead(en, 8);
	const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
	const ang = Math.atan2(aim.y - oy, aim.x - ox);
	beginLate(en, 'phaseStrike', { busy: true, ang, path: [{ x: ox, y: oy }], phase: 'pass' });
	en._lateAlpha = 0.28;
	en._lateNoHit = true;
}
function castSoulDrain(en){ castSoulEcho(en); }
function castSoulEcho(en){
	const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
	const copies = [];
	const real = Math.floor(Math.random() * 3);
	for(let i = 0; i < 3; i++){
		const a = -0.9 + i * 0.9 + (Math.random() - 0.5) * 0.2;
		copies.push({ x: ox, y: oy, vx: Math.cos(a) * 8.6, vy: Math.sin(a) * 6.2, real: i === real, trail: [] });
	}
	lFX({ kind:'soulEcho', en, copies, age: 0, max: 86, slashed: false });
	beginLate(en, 'soulEcho', { busy: true });
	en._lateHidden = true; en._lateNoHit = true;
}
function castGraveRift(en){
	const aim = lLead(en, 12);
	const ox = en.x + en.w / 2, oy = lFloor(en.x, en.y);
	const ang = Math.atan2(0, aim.x >= ox ? 1 : -1);
	lFX({ kind:'graveRift', en, x: ox, y: oy, ang, bones: [], age: 0, max: 140, next: 0 });
	spawnTelegraph(ox - 20, oy - 18, 40, 24, 16, 'rgba(90,40,120,0.45)', 'rect', '');
	beginLate(en, 'graveRift', { busy: false });
	lRelease(en, 'graveRift', 240);
}

/* ---------- FROST HATCHLING ---------- */
function castBabyIceBreath(en){
	const dir = en.facing || 1;
	beginLate(en, 'iceBreath', { busy: true, dir, sweep: -0.7, swDir: 1, shots: 0, p2: lBoss(en) });
}
function castBabyFrostNova(en){
	const ox = en.x + en.w / 2, oy = en.y + en.h;
	lShake(8, 12);
	lHit(en, ox, oy - 10, 110, lDmg(lBoss(en) ? 36 : 28), ['stun']);
	for(let i = 0; i < 7; i++){
		const a = -Math.PI + i * (Math.PI / 6);
		lSpawn(en, ox, oy - 8, Math.cos(a) * 10.5, Math.sin(a) * 7.2, {
			color: '#88ddff', color2: '#ddf6ff', power: lBoss(en) ? 30 : 24, width: 56, height: 56,
			shape: 'circle', maxAge: 55, trail: 'ice', _lateStyle: 'ice'
		});
	}
	for(let i = 0; i < 5; i++){
		const px = ox + (i - 2) * 70 + (Math.random() - 0.5) * 16;
		lFX({ kind:'icePatch', en, x: px, y: lFloor(px, oy), r: 28, age: 0, max: 260 });
	}
	beginLate(en, 'frostNova', { busy: false });
	lRelease(en, 'frostNova', 220);
}
function castBabyIcicleBarrage(en){
	const ox = en.x + en.w / 2, oy = en.y + 8;
	lFX({ kind:'icicleRain', en, x: ox, y: oy, age: 0, max: 90, next: 0, p2: lBoss(en) });
	beginLate(en, 'icicleBarrage', { busy: false });
	lRelease(en, 'icicleBarrage', 280);
}
function castBabyGlacialSlam(en){ castBabyFrozenDive(en); }
function castBabyFrozenDive(en){
	const aim = lLead(en, 10);
	beginLate(en, 'frozenDive', { busy: true, phase: 'up', tx: aim.x, ty: lFloor(aim.x, aim.y), p2: lBoss(en) });
}

/* ---------- FLAME SALAMANDER ---------- */
function castFireSpit(en){
	const ox = en.x + en.w / 2, oy = en.y + en.h * 0.35;
	const aim = lLead(en, 12);
	const a = Math.atan2(aim.y - oy, aim.x - ox);
	lFX({ kind:'fireSpit', en, x: ox, y: oy, vx: Math.cos(a) * 12.2, vy: Math.sin(a) * 12.2, age: 0, max: 70, phase: 'one', kids: null, hit: false });
	beginLate(en, 'fireSpit', { busy: false });
	lRelease(en, 'fireSpit', 200);
}
function castFlameDash(en){
	beginLate(en, 'flameDash', { busy: true, dashes: 0, maxDash: 3, wait: 0, phase: 'aim' });
}
function castEmberTrail(en){
	beginLate(en, 'emberTrail', { busy: true, ang: 0, embers: [], laps: 0 });
}
function castMagmaRoll(en){
	const aim = lAim(en);
	const a = Math.atan2(aim.y - (en.y + en.h / 2), aim.x - (en.x + en.w / 2));
	beginLate(en, 'magmaRoll', { busy: true, vx: Math.cos(a) * 13.4, vy: Math.sin(a) * 10.8, tLeft: 90 });
}

/* ---------- MAGMA IMP ---------- */
function castMagmaBolt(en){
	const ox = en.x + en.w / 2, oy = en.y + en.h * 0.3;
	const aim = lLead(en, 16);
	const a = Math.atan2(aim.y - oy, aim.x - ox);
	lFX({ kind:'magmaStick', en, x: ox, y: oy, vx: Math.cos(a) * 6.4, vy: Math.sin(a) * 6.4, age: 0, max: 220, stuck: false, boom: 46 });
	beginLate(en, 'magmaBolt', { busy: false });
	lRelease(en, 'magmaBolt', 180);
}
function castLavaSplash(en){
	const aim = lLead(en, 8);
	const ox = en.x + en.w / 2;
	const toward = aim.x >= ox ? 1 : -1;
	const spots = [];
	for(let ring = 0; ring < 3; ring++){
		const dist = 70 + ring * 78;
		spots.push({ x: aim.x - toward * dist, y: lFloor(aim.x, aim.y), delay: 8 + ring * 10 });
		spots.push({ x: aim.x - toward * (dist - 24), y: lFloor(aim.x, aim.y) - 2, delay: 10 + ring * 10 });
	}
	lFX({ kind:'lavaBox', en, spots, age: 0, max: 200 });
	lShake(6, 10);
	beginLate(en, 'lavaSplash', { busy: false });
	lRelease(en, 'lavaSplash', 220);
}
function castImpLeap(en){
	const aim = lLead(en, 14);
	beginLate(en, 'impLeap', { busy: true, phase: 'up', shadows: [], tx: aim.x, ty: lFloor(aim.x, aim.y) });
	en._lateHidden = true; en._lateNoHit = true;
}
function castMagmaTrap(en){
	const aim = lLead(en, 6);
	lFX({ kind:'magmaTrap', en, x: aim.x + (Math.random() - 0.5) * 40, y: lFloor(aim.x, aim.y), age: 0, max: 420, armed: false, grown: false });
	beginLate(en, 'magmaTrap', { busy: false });
	lRelease(en, 'magmaTrap', 180);
}

/* ---------- ABYSSAL GUARDIAN ---------- */
function castAbyssalStrike(en){
	const ox = en.x + (en.facing > 0 ? en.w : 0), oy = en.y + en.h * 0.4;
	const aim = lLead(en, 10);
	const a = Math.atan2(aim.y - oy, aim.x - ox);
	lFX({ kind:'waterBlade', en, x: ox, y: oy, ang: a, spd: 3.2, age: 0, max: 80, hit: false });
	beginLate(en, 'abyssalStrike', { busy: false });
	lRelease(en, 'abyssalStrike', 200);
}
function castTidalBash(en){
	const ox = en.x + en.w / 2, oy = lFloor(en.x, en.y);
	const dir = (lAim(en).x >= ox) ? 1 : -1;
	lFX({ kind:'tidalWave', en, x: ox - dir * 90, y: oy - 18, dir, age: 0, max: 90, hit: false });
	lShake(7, 10);
	beginLate(en, 'tidalBash', { busy: true, dir, follow: 0 });
}
function castDepthCrush(en){
	const aim = lAim(en);
	lFX({ kind:'depthCrush', en, x: aim.x, y: aim.y, r: 170, age: 0, max: 96 });
	beginLate(en, 'depthCrush', { busy: false });
	lRelease(en, 'depthCrush', 240);
}
function castUndertow(en){
	const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
	lFX({ kind:'undertow', en, x: ox, y: oy, age: 0, max: 110, shot: 0 });
	beginLate(en, 'undertow', { busy: false });
	lRelease(en, 'undertow', 260);
}

/* ---------- CORAL SENTINEL ---------- */
function castCoralSpine(en){
	const ox = en.x + en.w / 2, oy = lFloor(en.x, en.y);
	const aim = lLead(en, 10);
	const ang = Math.atan2(0, aim.x >= ox ? 1 : -1);
	lFX({ kind:'coralSpine', en, x: ox, y: oy, ang, age: 0, max: 70, next: 0, gap: 3 });
	beginLate(en, 'coralSpine', { busy: false });
	lRelease(en, 'coralSpine', 200);
}
function castCoralBurst(en){
	const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
	for(let i = 0; i < 7; i++){
		const a = (i / 7) * Math.PI * 2 + Math.random() * 0.2;
		lFX({ kind:'coralChunk', en, x: ox, y: oy, vx: Math.cos(a) * 9.6, vy: Math.sin(a) * 9.6, age: 0, max: 260, parked: false });
	}
	beginLate(en, 'coralBurst', { busy: false });
	lRelease(en, 'coralBurst', 200);
}
function castCalcifyShield(en){
	en._lateCalcify = 6;
	beginLate(en, 'calcify', { busy: false });
	lRelease(en, 'calcify', 240);
}
function castCoralGarden(en){
	const aim = lAim(en);
	for(let i = 0; i < 5; i++){
		const a = (i / 5) * Math.PI * 2;
		lFX({ kind:'coralNode', en, x: aim.x + Math.cos(a) * 130, y: lFloor(aim.x, aim.y), hp: 3, age: 0, max: 360, shot: 0, dead: false });
	}
	beginLate(en, 'coralGarden', { busy: false });
	lRelease(en, 'coralGarden', 220);
}

/* ---------- DEPTH SERPENT ---------- */
function castSerpentBite(en){
	const aim = lLead(en, 16);
	beginLate(en, 'serpentBite', { busy: true, phase: 'sink', tx: aim.x, ty: lFloor(aim.x, aim.y), rippleX: en.x + en.w / 2 });
	en._lateHidden = true; en._lateNoHit = true;
}
function castVenomSpit(en){
	const ox = en.x + en.w / 2, oy = en.y + en.h * 0.3;
	for(let i = 0; i < 5; i++){
		const a = -0.5 + i * 0.25;
		lFX({ kind:'venomBubble', en, x: ox, y: oy, vx: Math.cos(a) * (3.2 + i * 0.4) * (en.facing || 1), vy: Math.sin(a) * 2.2 - 0.6, r: 16, age: 0, max: 160, merged: false });
	}
	beginLate(en, 'venomSpit', { busy: false });
	lRelease(en, 'venomSpit', 200);
}
function castCoilingStrike(en){
	beginLate(en, 'coil', { busy: true, ang: 0, r: 150, phase: 'spiral' });
}
function castAbyssalCurrent(en){
	beginLate(en, 'current', { busy: true, phase: 'swim', dir: en.facing || 1, wake: [] });
}

/* ---------- SAND WRAITH ---------- */
function castSandBlast(en){
	beginLate(en, 'sandBlast', { busy: true, ang: Math.atan2(lAim(en).y - (en.y + en.h / 2), lAim(en).x - (en.x + en.w / 2)), tLeft: 48 });
}
function castDustDevil(en){
	const aim = lLead(en, 8);
	lFX({ kind:'dustDevil', en, x: aim.x, y: lFloor(aim.x, aim.y), r: 18, age: 0, max: 140, vx: (Math.random() < 0.5 ? -1 : 1) * 3.4 });
	beginLate(en, 'dustDevil', { busy: false });
	lRelease(en, 'dustDevil', 200);
}
function castMirageShift(en){
	const copies = [];
	for(let i = 0; i < 3; i++){
		copies.push({ x: en.x + (i - 1) * 90, y: en.y, vx: (i - 1) * 2.6, shot: 0 });
	}
	lFX({ kind:'mirages', en, copies, age: 0, max: 130 });
	beginLate(en, 'mirageShift', { busy: true });
	en._lateHidden = true; en._lateNoHit = true;
}
function castBuriedStrike(en){
	const aim = lLead(en, 14);
	const patches = [];
	const real = Math.floor(Math.random() * 4);
	for(let i = 0; i < 4; i++){
		patches.push({ x: aim.x + (i - 1.5) * 80, y: lFloor(aim.x, aim.y), real: i === real, vx: (Math.random() - 0.5) * 2.4 });
	}
	beginLate(en, 'buried', { busy: true, patches, phase: 'crawl' });
	en._lateHidden = true; en._lateNoHit = true;
}

/* ---------- TOMB GUARDIAN ---------- */
function castStoneSmash(en){
	const aim = lLead(en, 8);
	lFX({ kind:'stoneSmash', en, x: aim.x, y: lFloor(aim.x, aim.y), age: 0, max: 70, smashed: false, gx: en.x + en.w / 2 });
	beginLate(en, 'stoneSmash', { busy: true });
}
function castAncientCurse(en){
	const aim = lLead(en, 10);
	lFX({ kind:'glyph', en, x: aim.x, y: lFloor(aim.x, aim.y), rot: 0, age: 0, max: 280, fired: false });
	beginLate(en, 'ancientCurse', { busy: false });
	lRelease(en, 'ancientCurse', 200);
}
function castSandstoneShield(en){
	en._lateShield = true;
	en._lateAbsorb = 0;
	beginLate(en, 'sandShield', { busy: true, tLeft: 90 });
}
function castTombquake(en){
	const ox = en.x + en.w / 2;
	const slabs = [];
	for(let i = 0; i < 5; i++){
		slabs.push({ x: ox + (i - 2) * 92, y: lFloor(ox, en.y), h: 0, maxH: 28 + (i % 3) * 22, punch: 12 + i * 10 });
	}
	lFX({ kind:'tombquake', en, slabs, age: 0, max: 160, punched: 0 });
	beginLate(en, 'tombquake', { busy: true });
}

/* ---------- DESERT SERPENT ---------- */
function castVenomousFang(en){
	const aim = lLead(en, 8);
	beginLate(en, 'fang', { busy: true, phase: 'sink', tx: aim.x, ty: lFloor(aim.x, aim.y) });
	en._lateHidden = true; en._lateNoHit = true;
}
function castSandBurrow(en){
	const aim = lLead(en, 16);
	beginLate(en, 'sandBurrow', { busy: true, phase: 'dig', tx: aim.x, split: false, fake: null });
	en._lateHidden = true; en._lateNoHit = true;
}
function castConstrictingCoil(en){
	const aim = lAim(en);
	lFX({ kind:'coilRing', en, x: aim.x, y: aim.y, r: 150, age: 0, max: 90 });
	beginLate(en, 'constrict', { busy: false });
	lRelease(en, 'constrict', 240);
}
function castDuneAmbush(en){
	const aim = lAim(en);
	const dunes = [];
	const real = Math.floor(Math.random() * 4);
	for(let i = 0; i < 4; i++){
		dunes.push({ x: aim.x + (i - 1.5) * 100, y: lFloor(aim.x, aim.y), real: i === real });
	}
	beginLate(en, 'duneAmbush', { busy: true, dunes, phase: 'wait' });
	en._lateHidden = true; en._lateNoHit = true;
}

/* ---------- MUMMY WARRIOR ---------- */
function castCursedSwing(en){
	const ox = en.x + en.w / 2, oy = en.y + en.h * 0.4;
	const dir = (lAim(en).x >= ox) ? 1 : -1;
	lFX({ kind:'curseSlashes', en, x: ox, y: oy, dir, age: 0, max: 50, n: 0 });
	beginLate(en, 'cursedSwing', { busy: false });
	lRelease(en, 'cursedSwing', 200);
}
function castWrappingBinds(en){
	const ox = en.x + en.w / 2, oy = en.y + en.h * 0.35;
	const hooks = [];
	for(let i = 0; i < 3; i++){
		const a = -0.7 + i * 0.7;
		hooks.push({ x: ox, y: oy, tx: ox + Math.cos(a) * 220 * (en.facing || 1), ty: oy + Math.sin(a) * 80, latched: false });
	}
	beginLate(en, 'binds', { busy: true, hooks, phase: 'throw' });
}
function castTombRage(en){
	beginLate(en, 'tombRage', { busy: true, swings: 0, wait: 0 });
}
function castBurialSnare(en){
	const aim = lAim(en);
	lFX({ kind:'burialRing', en, x: aim.x, y: aim.y, r: 140, age: 0, max: 70 });
	beginLate(en, 'burialSnare', { busy: true, phase: 'wait', tx: aim.x, ty: aim.y });
}

/* ---------- SCARAB SWARM ---------- */
function castSwarmBite(en){
	const aim = lLead(en, 8);
	beginLate(en, 'swarmBite', { busy: true, phase: 'rush', tx: aim.x, ty: aim.y, split: false });
}
function castPlagueCloud(en){
	lFX({ kind:'plagueCloud', en, x: en.x + en.w / 2, y: en.y, vx: (lAim(en).x >= en.x ? 1.6 : -1.6), age: 0, max: 160, dive: 0 });
	beginLate(en, 'plagueCloud', { busy: false });
	lRelease(en, 'plagueCloud', 220);
}
function castBurstScatter(en){
	const bugs = [];
	for(let i = 0; i < 16; i++){
		const a = (i / 16) * Math.PI * 2;
		bugs.push({ x: en.x + en.w / 2, y: en.y + en.h / 2, vx: Math.cos(a) * 10.8, vy: Math.sin(a) * 10.8 });
	}
	lFX({ kind:'scatter', en, bugs, ox: en.x + en.w / 2, oy: en.y + en.h / 2, age: 0, max: 90, returning: false });
	beginLate(en, 'burstScatter', { busy: true });
	en._lateHidden = true; en._lateNoHit = true;
}
function castLivingCarpet(en){
	const aim = lAim(en);
	const safes = [];
	for(let i = 0; i < 3; i++) safes.push({ x: aim.x + (i - 1) * 110, y: lFloor(aim.x, aim.y), r: 28 });
	lFX({ kind:'carpet', en, x: en.x, y: lFloor(en.x, en.y), w: 520, age: 0, max: 140, safes, vx: (aim.x >= en.x ? 2.2 : -2.2) });
	beginLate(en, 'livingCarpet', { busy: false });
	lRelease(en, 'livingCarpet', 240);
}

/* ---------- SANDSTORM DJINN ---------- */
function castSandstormBolt(en){
	const ox = en.x + en.w / 2, oy = en.y + en.h * 0.35;
	const aim = lLead(en, 12);
	const a = Math.atan2(aim.y - oy, aim.x - ox);
	lFX({ kind:'stormBolt', en, x: ox, y: oy, vx: Math.cos(a) * 11.6, vy: Math.sin(a) * 11.6, age: 0, max: 36, hit: false });
	beginLate(en, 'sandstormBolt', { busy: false });
	lRelease(en, 'sandstormBolt', 200);
}
function castWhirlwindBarrage(en){
	const ox = en.x + en.w / 2, oy = lFloor(en.x, en.y) - 40;
	for(let i = 0; i < 4; i++){
		lFX({ kind:'tornado', en, x: ox + (i - 1.5) * 90, y: oy, r: 26, age: 0, max: 150, cw: i % 2 === 0 ? 1 : -1, base: ox + (i - 1.5) * 90 });
	}
	beginLate(en, 'whirlwind', { busy: false });
	lRelease(en, 'whirlwind', 220);
}
function castDesertMirage(en){
	const copies = [];
	for(let i = 0; i < 3; i++) copies.push({ x: en.x + (i - 1) * 80, y: en.y - 10, shot: 0 });
	lFX({ kind:'djinnMirage', en, copies, age: 0, max: 140, realDelay: 18 });
	beginLate(en, 'desertMirage', { busy: false });
	lRelease(en, 'desertMirage', 240);
}
function castSandstormPrison(en){
	const aim = lAim(en);
	lFX({ kind:'prison', en, x: aim.x, y: aim.y, r: 190, open: 0, age: 0, max: 130 });
	beginLate(en, 'prison', { busy: false });
	lRelease(en, 'prison', 260);
}

/* ---------- ENEMY TICKS ---------- */
function updateLateEnemy(en){
	lLookSide();
	const kit = en.lateKit;
	if(!kit){ en._lateKitBusy = false; return false; }
	kit.t++;
	const type = kit.type || en.necroType || en.type;
	if(type === 'boneWraith') tickBone(en, kit);
	else if(type === 'babyDragon') tickHatch(en, kit);
	else if(type === 'flameSalamander') tickSal(en, kit);
	else if(type === 'magmaImp') tickImp(en, kit);
	else if(type === 'abyssalGuardian') tickGuard(en, kit);
	else if(type === 'depthSerpent') tickDSerpent(en, kit);
	else if(type === 'sandWraith') tickSWraith(en, kit);
	else if(type === 'tombGuardian') tickTomb(en, kit);
	else if(type === 'desertSerpent') tickDesSerp(en, kit);
	else if(type === 'mummyWarrior') tickMummy(en, kit);
	else if(type === 'scarabSwarm') tickScarab(en, kit);
	else if(kit.t > 14) lateEnd(en);
	return !!en._lateKitBusy;
}

function tickBone(en, kit){
	if(kit.kind === 'phaseStrike'){
		const spd = 14.2;
		en.x += Math.cos(kit.ang) * spd;
		en.y += Math.sin(kit.ang) * spd;
		kit.path.push({ x: en.x + en.w / 2, y: en.y + en.h / 2 });
		lClampFly(en);
		if(kit.t > 22 && kit.phase === 'pass'){
			kit.phase = 'slash';
			en._lateAlpha = 1; en._lateNoHit = false;
			for(let i = 0; i < kit.path.length; i += 3){
				const p = kit.path[i];
				lFX({ kind:'ghostSlash', en, x: p.x, y: p.y, age: -i, max: 28, delay: 10 + i });
			}
			lateEnd(en);
		}
	} else if(kit.kind === 'soulEcho'){
		if(kit.t > 86){
			en._lateHidden = false; en._lateNoHit = false;
			lateEnd(en);
		}
	} else if(kit.t > 16) lateEnd(en);
}

function tickHatch(en, kit){
	const aim = lAim(en);
	if(kit.kind === 'iceBreath'){
		const ox = en.x + (kit.dir > 0 ? en.w : 0), oy = en.y + en.h * 0.32;
		kit.sweep += kit.swDir * 0.055;
		if(kit.sweep > 0.75) kit.swDir = -1;
		if(kit.sweep < -0.75) kit.swDir = 1;
		if(kit.t % 3 === 0){
			const a = (kit.dir > 0 ? 0 : Math.PI) + kit.sweep;
			const wide = kit.p2 ? 70 : 58;
			lSpawn(en, ox, oy, Math.cos(a) * 12.4, Math.sin(a) * 12.4, {
				color: '#88ddff', color2: '#e8f8ff', power: kit.p2 ? 28 : 22, width: wide, height: wide,
				shape: 'circle', maxAge: 42, trail: 'ice', _lateStyle: 'ice'
			});
		}
		en.facing = kit.dir;
		if(kit.t > (kit.p2 ? 70 : 56)) lateEnd(en);
	} else if(kit.kind === 'frozenDive'){
		if(kit.phase === 'up'){
			en.y -= 10;
			if(kit.t > 16){ kit.phase = 'drop'; en.x = kit.tx - en.w / 2; }
		} else if(kit.phase === 'drop'){
			en.y += 16;
			if(en.y + en.h >= kit.ty - 2 || kit.t > 46){
				en.y = kit.ty - en.h;
				lShake(10, 14);
				lHit(en, en.x + en.w / 2, en.y + en.h, 80, lDmg(kit.p2 ? 40 : 32), ['stun']);
				for(let i = 0; i < 14; i++){
					const a = (i / 14) * Math.PI * 2;
					lSpawn(en, en.x + en.w / 2, en.y + en.h, Math.cos(a) * 11.8, Math.sin(a) * 11.8, {
						color: '#66ccff', color2: '#ddf4ff', power: kit.p2 ? 26 : 20, width: 48, height: 48,
						shape: 'shard', maxAge: 50, trail: 'ice', _lateStyle: 'ice'
					});
				}
				lateEnd(en);
			}
		}
	} else if(kit.t > 16) lateEnd(en);
}

function tickSal(en, kit){
	const aim = lLead(en, 8);
	if(kit.kind === 'flameDash'){
		if(kit.phase === 'aim'){
			kit.wait++;
			if(kit.wait > 8){
				kit.phase = 'dash';
				kit.wait = 0;
				const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
				kit.ang = Math.atan2(aim.y - oy, (aim.x + (kit.dashes - 1) * 80) - ox);
			}
		} else {
			en.x += Math.cos(kit.ang) * 15.2;
			en.y += Math.sin(kit.ang) * 4.4;
			if(kit.t % 2 === 0) lFX({ kind:'fireLine', en, x: en.x + en.w / 2, y: lFloor(en.x, en.y), age: 0, max: 70 });
			if(!kit.hit && lHit(en, en.x + en.w / 2, en.y + en.h / 2, 34, lDmg(28), ['burn'])) kit.hit = true;
			kit.wait++;
			if(kit.wait > 12){
				kit.dashes++;
				kit.hit = false;
				if(kit.dashes >= kit.maxDash) lateEnd(en);
				else { kit.phase = 'aim'; kit.wait = 0; kit.ang = kit.ang + Math.PI * 0.65; }
			}
		}
	} else if(kit.kind === 'emberTrail'){
		kit.ang += 0.18;
		const px = aim.x + Math.cos(kit.ang) * 96;
		const py = aim.y + Math.sin(kit.ang) * 40;
		en.x = px - en.w / 2; en.y = py - en.h / 2;
		if(kit.t % 5 === 0) kit.embers.push({ x: px, y: lFloor(px, py), age: 0 });
		if(kit.ang > Math.PI * 2){
			for(let i = 0; i < kit.embers.length; i++){
				const e = kit.embers[i];
				lFX({ kind:'emberPop', en, x: e.x, y: e.y, age: 0, max: 28 });
			}
			lateEnd(en);
		}
	} else if(kit.kind === 'magmaRoll'){
		en.x += kit.vx; en.y += kit.vy;
		if(lBlocked(en.x, en.y + en.h / 2) || en.x < 20 || (typeof WORLD_W === 'number' && en.x + en.w > WORLD_W - 20)) kit.vx *= -1;
		if(lBlocked(en.x + en.w / 2, en.y) || en.y < 20) kit.vy *= -1;
		if(en.y + en.h > lFloor(en.x, en.y)){ en.y = lFloor(en.x, en.y) - en.h; kit.vy = -Math.abs(kit.vy); }
		if(kit.t % 3 === 0) lHit(en, en.x + en.w / 2, en.y + en.h / 2, 36, lDmg(24), ['burn']);
		if(kit.t > kit.tLeft) lateEnd(en);
	} else if(kit.t > 16) lateEnd(en);
}

function tickImp(en, kit){
	if(kit.kind === 'impLeap'){
		if(kit.phase === 'up'){
			if(kit.t === 10){
				const base = kit.tx;
				const n = 4;
				const real = Math.floor(Math.random() * n);
				for(let i = 0; i < n; i++){
					kit.shadows.push({ x: base + (i - 1.5) * 70, y: kit.ty, real: i === real });
				}
			}
			if(kit.t > 28){
				const land = kit.shadows.find(s => s.real) || kit.shadows[0];
				en.x = land.x - en.w / 2; en.y = land.y - en.h;
				en._lateHidden = false; en._lateNoHit = false;
				lHit(en, land.x, land.y - 10, 48, lDmg(34), ['stun']);
				lShake(7, 10);
				lateEnd(en);
			}
		}
	} else if(kit.t > 16) lateEnd(en);
}

function tickGuard(en, kit){
	if(kit.kind === 'tidalBash'){
		kit.follow++;
		if(kit.follow === 36){
			const ox = en.x + (kit.dir > 0 ? en.w : 0), oy = en.y + en.h * 0.4;
			lSpawn(en, ox, oy, kit.dir * 13.2, -1.2, {
				color: '#44aacc', color2: '#aaffee', power: 32, width: 64, height: 40,
				shape: 'slash', maxAge: 40, _lateStyle: 'water'
			});
			lateEnd(en);
		}
	} else if(kit.t > 20) lateEnd(en);
}

function tickDSerpent(en, kit){
	const aim = lLead(en, 10);
	if(kit.kind === 'serpentBite'){
		if(kit.phase === 'sink'){
			en.y += 12;
			if(kit.t > 8) kit.phase = 'seek';
		} else if(kit.phase === 'seek'){
			kit.tx += (aim.x - kit.tx) * 0.18;
			kit.rippleX += (kit.tx - kit.rippleX) * 0.08;
			if(kit.t > 34){
				en.x = kit.tx - en.w / 2;
				en.y = kit.ty - en.h;
				en._lateHidden = false; en._lateNoHit = false;
				lHit(en, kit.tx, kit.ty - 20, 46, lDmg(36), ['poison']);
				lSpark(kit.tx, kit.ty, 12, { r: 40, g: 180, b: 140 });
				lateEnd(en);
			}
		}
	} else if(kit.kind === 'coil'){
		kit.r -= 1.6;
		kit.ang += 0.22;
		en.x = aim.x + Math.cos(kit.ang) * kit.r - en.w / 2;
		en.y = aim.y + Math.sin(kit.ang) * kit.r * 0.45 - en.h / 2;
		if(kit.r < 48 && kit.phase === 'spiral'){
			kit.phase = 'launch';
			const a = Math.atan2(aim.y - (en.y + en.h / 2), aim.x - (en.x + en.w / 2));
			kit.lx = Math.cos(a) * 16; kit.ly = Math.sin(a) * 16;
		}
		if(kit.phase === 'launch'){
			en.x += kit.lx; en.y += kit.ly;
			if(!kit.hit && lHit(en, en.x + en.w / 2, en.y + en.h / 2, 36, lDmg(34), ['horizontalLaunch'])) kit.hit = true;
			if(kit.t > 70) lateEnd(en);
		}
	} else if(kit.kind === 'current'){
		if(kit.phase === 'swim'){
			en.x += kit.dir * 8.4;
			if(kit.t % 2 === 0) kit.wake.push({ x: en.x + en.w / 2, y: en.y + en.h / 2, age: 0 });
			player.vx += kit.dir * 0.45;
			if(kit.t > 28){ kit.phase = 'reverse'; kit.dir *= -1; }
		} else {
			en.x += kit.dir * 13.6;
			if(!kit.hit && lHit(en, en.x + en.w / 2, en.y + en.h / 2, 34, lDmg(32), [])) kit.hit = true;
			if(kit.t > 52) lateEnd(en);
		}
	} else if(kit.t > 16) lateEnd(en);
}

function tickSWraith(en, kit){
	const aim = lAim(en);
	if(kit.kind === 'sandBlast'){
		kit.ang += 0.045 * (aim.x >= en.x + en.w / 2 ? 1 : -1);
		if(kit.t % 2 === 0){
			lSpawn(en, en.x + en.w / 2, en.y + en.h * 0.4, Math.cos(kit.ang) * 13.2, Math.sin(kit.ang) * 13.2, {
				color: '#c4a050', color2: '#ffe08a', power: 22, width: 46, height: 46,
				shape: 'circle', maxAge: 36, _lateStyle: 'sand'
			});
		}
		if(kit.t > kit.tLeft) lateEnd(en);
	} else if(kit.kind === 'mirageShift'){
		if(kit.t > 120){
			const side = (player._lateLook && player._lateLook.L <= player._lateLook.R) ? -1 : 1;
			en.x = aim.x + side * 160 - en.w / 2;
			en.y = aim.y - 20;
			en._lateHidden = false; en._lateNoHit = false;
			lHit(en, en.x + en.w / 2, en.y + en.h / 2, 40, lDmg(30), []);
			lateEnd(en);
		}
	} else if(kit.kind === 'buried'){
		for(let i = 0; i < kit.patches.length; i++){
			kit.patches[i].x += kit.patches[i].vx;
			if(kit.patches[i].real) kit.patches[i].x += (aim.x - kit.patches[i].x) * 0.06;
		}
		if(kit.t > 40){
			const real = kit.patches.find(p => p.real) || kit.patches[0];
			en.x = real.x - en.w / 2; en.y = real.y - en.h;
			en._lateHidden = false; en._lateNoHit = false;
			lHit(en, real.x, real.y - 16, 50, lDmg(36), ['stun']);
			lateEnd(en);
		}
	} else if(kit.t > 16) lateEnd(en);
}

function tickTomb(en, kit){
	if(kit.kind === 'stoneSmash'){
		if(kit.t > 28) lateEnd(en);
	} else if(kit.kind === 'sandShield'){
		if(kit.t > kit.tLeft){
			if(en._lateAbsorb > 0){
				const aim = lAim(en);
				const a = Math.atan2(aim.y - (en.y + en.h / 2), aim.x - (en.x + en.w / 2));
				lSpawn(en, en.x + en.w / 2, en.y + en.h / 2, Math.cos(a) * 12.8, Math.sin(a) * 12.8, {
					color: '#8a7040', color2: '#e8c878', power: 28 + en._lateAbsorb * 6, width: 72, height: 56,
					shape: 'rect', maxAge: 55, _lateStyle: 'sand'
				});
			}
			en._lateShield = false; en._lateAbsorb = 0;
			lateEnd(en);
		}
	} else if(kit.kind === 'tombquake'){
		if(kit.t > 90){
			const fx = lateWorldFX.find(f => f.kind === 'tombquake' && f.en === en);
			if(fx){
				let best = fx.slabs[0];
				for(let i = 1; i < fx.slabs.length; i++) if(fx.slabs[i].h > best.h) best = fx.slabs[i];
				en.x = best.x - en.w / 2;
				en.y = best.y - best.h - en.h;
				lSpawn(en, en.x + en.w / 2, en.y + en.h / 2, (lAim(en).x >= en.x ? 1 : -1) * 12, 2, {
					color: '#7a6848', color2: '#ffaa22', power: 36, width: 70, height: 40,
					shape: 'slash', maxAge: 40, _lateStyle: 'sand'
				});
			}
			lateEnd(en);
		}
	} else if(kit.t > 16) lateEnd(en);
}

function tickDesSerp(en, kit){
	const aim = lLead(en, 8);
	if(kit.kind === 'fang'){
		if(kit.phase === 'sink'){
			en.y += 12;
			if(kit.t > 8){
				en.x = kit.tx - en.w / 2; en.y = kit.ty - en.h;
				en._lateHidden = false; en._lateNoHit = false;
				lHit(en, kit.tx, kit.ty - 18, 44, lDmg(34), ['poison']);
				for(let i = 0; i < 6; i++){
					lFX({ kind:'venomDrop', en, x: kit.tx + (i - 2.5) * 18, y: kit.ty - 70 - i * 8, age: 0, max: 50 });
				}
				kit.phase = 'dive';
			}
		} else if(kit.t > 22){
			en._lateHidden = true;
			lateEnd(en);
			en._lateHidden = false; en._lateNoHit = false;
		}
	} else if(kit.kind === 'sandBurrow'){
		en.x += (kit.tx - (en.x + en.w / 2)) * 0.12;
		if(!kit.split && kit.t > 12){
			kit.split = true;
			kit.fake = { x: en.x + en.w / 2, vx: (Math.random() < 0.5 ? -1 : 1) * 6 };
		}
		if(kit.fake) kit.fake.x += kit.fake.vx;
		lFX({ kind:'ridge', x: en.x + en.w / 2, y: lFloor(en.x, en.y), age: 0, max: 16 });
		if(kit.fake) lFX({ kind:'ridge', x: kit.fake.x, y: lFloor(kit.fake.x, en.y), age: 0, max: 16 });
		if(kit.t > 32){
			en.y = lFloor(en.x, en.y) - en.h;
			en._lateHidden = false; en._lateNoHit = false;
			lHit(en, en.x + en.w / 2, en.y + en.h / 2, 42, lDmg(34), []);
			lateEnd(en);
		}
	} else if(kit.kind === 'duneAmbush'){
		if(kit.t > 28){
			const d = kit.dunes.find(x => x.real) || kit.dunes[0];
			en.x = d.x - en.w / 2; en.y = d.y - en.h;
			en._lateHidden = false; en._lateNoHit = false;
			lHit(en, d.x, d.y - 12, 56, lDmg(36), ['horizontalLaunch']);
			for(let i = 0; i < 8; i++){
				const a = (i / 8) * Math.PI * 2;
				lSpawn(en, d.x, d.y, Math.cos(a) * 10.4, Math.sin(a) * 6.2, {
					color: '#c4a860', color2: '#ffe6a0', power: 22, width: 40, height: 40,
					shape: 'circle', maxAge: 40, _lateStyle: 'sand'
				});
			}
			lateEnd(en);
		}
	} else if(kit.t > 16) lateEnd(en);
}

function tickMummy(en, kit){
	const aim = lAim(en);
	if(kit.kind === 'binds'){
		if(kit.phase === 'throw'){
			if(kit.t > 16){
				kit.phase = 'yank';
				const h = kit.hooks[Math.floor(Math.random() * kit.hooks.length)];
				kit.tx = h.tx; kit.ty = h.ty;
			}
		} else {
			en.x += ((kit.tx - en.w / 2) - en.x) * 0.28;
			en.y += ((kit.ty - en.h / 2) - en.y) * 0.22;
			if(!kit.hit && lHit(en, en.x + en.w / 2, en.y + en.h / 2, 36, lDmg(30), [])) kit.hit = true;
			if(kit.t > 34) lateEnd(en);
		}
	} else if(kit.kind === 'tombRage'){
		if(kit.wait > 0) kit.wait--;
		else {
			const dir = aim.x >= en.x + en.w / 2 ? 1 : -1;
			lFX({ kind:'rageSlash', en, x: en.x + en.w / 2 + dir * 30, y: en.y + en.h * 0.4, dir, age: 0, max: 22 });
			kit.swings++;
			kit.wait = Math.max(4, 14 - kit.swings * 2);
			if(kit.swings >= 6) lateEnd(en);
		}
	} else if(kit.kind === 'burialSnare'){
		if(kit.phase === 'wait' && kit.t > 40){
			kit.phase = 'charge';
			const a = Math.atan2(kit.ty - (en.y + en.h / 2), kit.tx - (en.x + en.w / 2));
			kit.vx = Math.cos(a) * 15.4; kit.vy = Math.sin(a) * 8.2;
		}
		if(kit.phase === 'charge'){
			en.x += kit.vx; en.y += kit.vy;
			if(!kit.hit && lHit(en, en.x + en.w / 2, en.y + en.h / 2, 38, lDmg(36), ['horizontalLaunch'])) kit.hit = true;
			if(kit.t > 62) lateEnd(en);
		}
	} else if(kit.t > 16) lateEnd(en);
}

function tickScarab(en, kit){
	const aim = lLead(en, 6);
	if(kit.kind === 'swarmBite'){
		if(kit.phase === 'rush'){
			en.x += (kit.tx - (en.x + en.w / 2)) * 0.18;
			en.y += (kit.ty - (en.y + en.h / 2)) * 0.14;
			if(Math.hypot(kit.tx - (en.x + en.w / 2), kit.ty - (en.y + en.h / 2)) < 40){
				kit.phase = 'split';
				en._lateHidden = true; en._lateNoHit = true;
				lFX({ kind:'splitBugs', en, x: kit.tx, y: kit.ty, age: 0, max: 24 });
			}
		} else if(kit.phase === 'split'){
			if(kit.t > 28){
				en.x = kit.tx + (aim.x >= kit.tx ? -1 : 1) * 80 - en.w / 2;
				en.y = kit.ty - 10;
				en._lateHidden = false; en._lateNoHit = false;
				lHit(en, en.x + en.w / 2, en.y + en.h / 2, 40, lDmg(30), []);
				lateEnd(en);
			}
		}
	} else if(kit.kind === 'burstScatter'){
		if(kit.t > 90){
			en._lateHidden = false; en._lateNoHit = false;
			lateEnd(en);
		}
	} else if(kit.t > 16) lateEnd(en);
}

/* ---------- WORLD UPDATE ---------- */
function updateLateWorld(){
	if(player._kitSlow){ player._kitSlow *= 0.94; if(player._kitSlow < 0.04) player._kitSlow = 0; }
	if(typeof enemyProjectiles !== 'undefined'){
		for(let i = 0; i < enemyProjectiles.length; i++){
			const p = enemyProjectiles[i];
			if(!p || !p._lateHook) continue;
			if(p._lateAccel){ p.vx *= 1.045; p.vy *= 1.045; }
			if(p._lateCurve && p._lateTx != null){
				const a = Math.atan2(p._lateTy - p.y, p._lateTx - p.x);
				p.vx += Math.cos(a) * 0.55; p.vy += Math.sin(a) * 0.55;
			}
		}
	}
	for(let i = lateWorldFX.length - 1; i >= 0; i--){
		const fx = lateWorldFX[i];
		fx.age++;
		if(tickLateFX(fx) || fx.age >= (fx.max || 80)) lateWorldFX.splice(i, 1);
	}
}

function tickLateFX(fx){
	const en = fx.en;
	if(fx.kind === 'shadowBolt'){
		if(fx.phase === 'out'){
			fx.x += fx.vx; fx.y += fx.vy;
			if(!fx.hit && lHit(en, fx.x, fx.y, 22, lDmg(26), [])) fx.hit = true;
			if(fx.age === 16){
				fx.phase = 'hide';
			}
		} else if(fx.phase === 'hide'){
			if(fx.age === 24){
				const aim = lAim(en);
				const side = Math.random() * Math.PI * 2;
				fx.x = aim.x + Math.cos(side) * 140;
				fx.y = aim.y + Math.sin(side) * 80;
				const a = Math.atan2(aim.y - fx.y, aim.x - fx.x);
				fx.vx = Math.cos(a) * 12.6; fx.vy = Math.sin(a) * 12.6;
				fx.phase = 'in'; fx.hit = false;
			}
		} else {
			fx.x += fx.vx; fx.y += fx.vy;
			if(!fx.hit && lHit(en, fx.x, fx.y, 24, lDmg(28), [])) fx.hit = true;
		}
	} else if(fx.kind === 'ghostSlash'){
		if(fx.age === (fx.delay || 10)) lHit(en, fx.x, fx.y, 30, lDmg(30), []);
	} else if(fx.kind === 'soulEcho'){
		for(let i = 0; i < fx.copies.length; i++){
			const c = fx.copies[i];
			c.x += c.vx; c.y += c.vy;
			if(fx.age % 4 === 0) c.trail.push({ x: c.x, y: c.y, age: 0 });
			if(c.real && en && !en.dead){ en.x = c.x - en.w / 2; en.y = c.y - en.h / 2; }
		}
		if(fx.age === 40){
			for(let i = 0; i < fx.copies.length; i++){
				const tr = fx.copies[i].trail;
				for(let k = 0; k < tr.length; k += 2) lFX({ kind:'ghostSlash', en, x: tr[k].x, y: tr[k].y, age: -k, max: 26, delay: 8 + k });
			}
			if(en){ en._lateHidden = false; en._lateNoHit = false; }
		}
	} else if(fx.kind === 'graveRift'){
		if(fx.age >= fx.next && fx.bones.length < 10){
			const d = fx.bones.length * 46;
			fx.bones.push({ x: fx.x + Math.cos(fx.ang) * d, y: fx.y, rise: 0 });
			fx.next = fx.age + 6;
		}
		for(let i = 0; i < fx.bones.length; i++){
			const b = fx.bones[i];
			b.rise = Math.min(52, b.rise + 6);
			if(b.rise > 20) lHit(en, b.x, b.y - b.rise * 0.5, 20, lDmg(22), []);
		}
	} else if(fx.kind === 'icePatch'){
		if(circRect(fx.x, fx.y, fx.r, player.x, player.y, player.w, player.h)) lSlow(0.42);
	} else if(fx.kind === 'icicleRain'){
		if(fx.age >= fx.next){
			const lead = lLead(en, 18);
			const px = lead.x + (lead.vx || 0) * 10;
			lFX({ kind:'icicle', en, x: px + (Math.random() - 0.5) * 30, y: (typeof camera !== 'undefined' ? camera.y : 0) + 20, vy: 0, age: 0, max: 50 });
			fx.next = fx.age + (fx.p2 ? 6 : 8);
		}
	} else if(fx.kind === 'icicle'){
		fx.vy = Math.min(16, (fx.vy || 4) + 0.7);
		fx.y += fx.vy;
		if(!fx.hit && lHit(en, fx.x, fx.y, 18, lDmg(26), [])) fx.hit = true;
		if(fx.y > lFloor(fx.x, fx.y)) return true;
	} else if(fx.kind === 'fireSpit'){
		if(fx.phase === 'one'){
			fx.x += fx.vx; fx.y += fx.vy;
			if(!fx.hit && lHit(en, fx.x, fx.y, 20, lDmg(24), ['burn'])) fx.hit = true;
			if(fx.age === 16){
				fx.phase = 'split';
				fx.kids = [];
				const base = Math.atan2(fx.vy, fx.vx);
				for(let i = -1; i <= 1; i++){
					const a = base + i * 0.55;
					fx.kids.push({ x: fx.x, y: fx.y, vx: Math.cos(a) * 11.2, vy: Math.sin(a) * 11.2, hit: false, inward: 0 });
				}
			}
		} else if(fx.kids){
			const aim = lAim(en);
			for(let i = 0; i < fx.kids.length; i++){
				const k = fx.kids[i];
				k.inward++;
				if(k.inward > 10){
					const a = Math.atan2(aim.y - k.y, aim.x - k.x);
					k.vx += Math.cos(a) * 0.7; k.vy += Math.sin(a) * 0.7;
				}
				k.x += k.vx; k.y += k.vy;
				if(!k.hit && lHit(en, k.x, k.y, 16, lDmg(20), ['burn'])) k.hit = true;
			}
		}
	} else if(fx.kind === 'fireLine' || fx.kind === 'emberPop'){
		if(fx.age % 8 === 0) lHit(en, fx.x, fx.y, 18, lDmg(16), ['burn']);
	} else if(fx.kind === 'magmaStick'){
		if(!fx.stuck){
			fx.x += fx.vx; fx.y += fx.vy;
			if(fx.y >= lFloor(fx.x, fx.y) - 4 || lBlocked(fx.x, fx.y) || circRect(fx.x, fx.y, 14, player.x, player.y, player.w, player.h)){
				fx.stuck = true; fx.y = Math.min(fx.y, lFloor(fx.x, fx.y)); fx.age = 0; fx.max = fx.boom;
			}
		} else if(fx.age >= fx.boom - 1){
			lHit(en, fx.x, fx.y, 46, lDmg(34), ['burn']);
			lSpark(fx.x, fx.y, 14, { r: 255, g: 100, b: 30 });
			return true;
		}
	} else if(fx.kind === 'lavaBox'){
		for(let i = 0; i < fx.spots.length; i++){
			const s = fx.spots[i];
			if(fx.age === s.delay) lFX({ kind:'lavaPuddle', en, x: s.x, y: s.y, age: 0, max: 140 });
		}
	} else if(fx.kind === 'lavaPuddle'){
		if(fx.age % 10 === 0) lHit(en, fx.x, fx.y, 22, lDmg(16), ['burn']);
	} else if(fx.kind === 'magmaTrap'){
		const near = Math.hypot((player.x + player.w / 2) - fx.x, (player.y + player.h) - fx.y) < 42;
		if(near && !fx.grown && fx.age > 12){ fx.grown = true; fx.age = 0; fx.max = 36; }
		if(fx.grown) lHit(en, fx.x, fx.y - 30, 26, lDmg(32), ['burn']);
	} else if(fx.kind === 'waterBlade'){
		fx.spd = Math.min(16.5, fx.spd * 1.045 + 0.12);
		fx.x += Math.cos(fx.ang) * fx.spd;
		fx.y += Math.sin(fx.ang) * fx.spd;
		if(!fx.hit && lHit(en, fx.x, fx.y, 26, lDmg(30), [])) fx.hit = true;
	} else if(fx.kind === 'tidalWave'){
		fx.x += fx.dir * 8.8;
		if(!fx.hit && circRect(fx.x, fx.y, 28, player.x, player.y, player.w, player.h)){
			if(player.onGround){ lHit(en, fx.x, fx.y, 30, lDmg(28), ['horizontalLaunch']); fx.hit = true; }
		}
	} else if(fx.kind === 'depthCrush'){
		fx.r = Math.max(36, 170 - fx.age * 1.45);
		const gx = en ? en.x + en.w / 2 : fx.x - 80;
		const gy = en ? en.y + en.h / 2 : fx.y;
		const openA = Math.atan2(gy - fx.y, gx - fx.x);
		const px = player.x + player.w / 2, py = player.y + player.h / 2;
		const d = Math.hypot(px - fx.x, py - fx.y);
		const pa = Math.atan2(py - fx.y, px - fx.x);
		let diff = pa - openA;
		while(diff > Math.PI) diff -= Math.PI * 2;
		while(diff < -Math.PI) diff += Math.PI * 2;
		if(Math.abs(d - fx.r) < 16 && Math.abs(diff) > 0.55 && fx.age % 6 === 0) lHit(en, px, py, 20, lDmg(22), []);
	} else if(fx.kind === 'undertow'){
		const px = player.x + player.w / 2, py = player.y + player.h / 2;
		const d = Math.hypot(fx.x - px, fx.y - py) || 1;
		player.vx += ((fx.x - px) / d) * 0.55;
		player.vy += ((fx.y - py) / d) * 0.28;
		if(fx.age >= fx.shot){
			const a = Math.random() * Math.PI * 2;
			lSpawn(en, fx.x, fx.y, Math.cos(a) * 10.6, Math.sin(a) * 10.6, {
				color: '#2277aa', color2: '#88e0ff', power: 20, width: 40, height: 40,
				shape: 'circle', maxAge: 50, _lateStyle: 'water'
			});
			fx.shot = fx.age + 10;
		}
	} else if(fx.kind === 'coralSpine'){
		if(fx.age >= fx.next){
			const d = (fx.age / 6) * 40;
			const gap = Math.floor(d / 40) % 4 === fx.gap;
			if(!gap) lFX({ kind:'spineUp', en, x: fx.x + Math.cos(fx.ang) * d, y: fx.y, age: 0, max: 28 });
			fx.next = fx.age + 4;
		}
	} else if(fx.kind === 'spineUp'){
		if(fx.age === 8) lHit(en, fx.x, fx.y - 24, 16, lDmg(24), []);
	} else if(fx.kind === 'coralChunk'){
		if(!fx.parked){
			fx.x += fx.vx; fx.y += fx.vy;
			fx.vx *= 0.94; fx.vy *= 0.94;
			if(fx.age > 22){ fx.parked = true; fx.y = lFloor(fx.x, fx.y) - 8; }
		} else if(fx.age % 12 === 0) lHit(en, fx.x, fx.y, 16, lDmg(14), []);
	} else if(fx.kind === 'coralNode'){
		if(fx.dead) return fx.age > 8;
		if(fx.age % 28 === 0){
			const aim = lAim(en);
			const a = Math.atan2(aim.y - fx.y, aim.x - fx.x);
			lSpawn(en, fx.x, fx.y - 12, Math.cos(a) * 10.2, Math.sin(a) * 10.2, {
				color: '#cc5080', color2: '#ffe0aa', power: 18, width: 36, height: 36,
				shape: 'spike', maxAge: 50, _lateStyle: 'coral'
			});
		}
	} else if(fx.kind === 'venomBubble'){
		fx.x += fx.vx; fx.y += fx.vy;
		fx.vy += 0.02;
		for(let j = 0; j < lateWorldFX.length; j++){
			const o = lateWorldFX[j];
			if(o === fx || o.kind !== 'venomBubble' || o.merged || fx.merged) continue;
			if(Math.hypot(o.x - fx.x, o.y - fx.y) < fx.r + o.r - 4){
				fx.r += o.r * 0.55; fx.vx = (fx.vx + o.vx) * 0.5; fx.vy = (fx.vy + o.vy) * 0.5;
				o.merged = true; o.age = o.max;
				if(fx.r > 34){
					for(let k = 0; k < 6; k++){
						const a = (k / 6) * Math.PI * 2;
						lSpawn(en, fx.x, fx.y, Math.cos(a) * 9.4, Math.sin(a) * 9.4, {
							color: '#66ff88', color2: '#ccffaa', power: 16, width: 28, height: 28,
							shape: 'circle', maxAge: 40, effects: ['poison'], _lateStyle: 'venom'
						});
					}
					return true;
				}
			}
		}
		if(lHit(en, fx.x, fx.y, fx.r * 0.7, lDmg(18), ['poison'])) return true;
	} else if(fx.kind === 'dustDevil'){
		fx.x += fx.vx;
		fx.r = Math.min(70, 18 + fx.age * 0.4);
		if(fx.age % 8 === 0) lHit(en, fx.x, fx.y - fx.r * 0.4, fx.r * 0.6, lDmg(18), []);
		if(fx.age >= fx.max - 2){
			for(let i = 0; i < 5; i++) lFX({ kind:'sandHaz', en, x: fx.x + (i - 2) * 36, y: fx.y, age: 0, max: 160 });
			return true;
		}
	} else if(fx.kind === 'sandHaz'){
		if(fx.age % 12 === 0) lHit(en, fx.x, fx.y, 16, lDmg(12), []);
	} else if(fx.kind === 'mirages'){
		for(let i = 0; i < fx.copies.length; i++){
			const c = fx.copies[i];
			c.x += c.vx;
			if(fx.age % 22 === i * 4){
				const a = Math.atan2((player.y + player.h / 2) - c.y, (player.x + player.w / 2) - c.x);
				lSpawn(en, c.x, c.y, Math.cos(a) * 10.8, Math.sin(a) * 10.8, {
					color: '#ddbb66', color2: '#fff0aa', power: 20, width: 40, height: 40,
					shape: 'circle', maxAge: 40, _lateStyle: 'sand'
				});
			}
		}
	} else if(fx.kind === 'stoneSmash'){
		if(fx.age === 22){
			lShake(9, 12);
			lHit(en, fx.x, fx.y - 10, 40, lDmg(24), ['stun']);
			for(let i = 1; i <= 4; i++){
				const dist = 50 + i * 42;
				lFX({ kind:'farShock', en, x: fx.x + dist, y: fx.y, dmg: 16 + i * 6, age: 0, max: 18 });
				lFX({ kind:'farShock', en, x: fx.x - dist, y: fx.y, dmg: 16 + i * 6, age: 0, max: 18 });
			}
		}
	} else if(fx.kind === 'farShock'){
		if(fx.age === 6) lHit(en, fx.x, fx.y, 22, lDmg(fx.dmg), []);
	} else if(fx.kind === 'glyph'){
		fx.rot += 0.08;
		if(fx.age === 28 && !fx.fired){
			fx.fired = true;
			for(let i = 0; i < 6; i++){
				const a = fx.rot + i * (Math.PI / 3);
				lHit(en, fx.x + Math.cos(a) * 18, fx.y - 30, 16, lDmg(22), []);
			}
		}
		if(fx.fired && fx.age % 14 === 0) lHit(en, fx.x, fx.y, 20, lDmg(12), []);
	} else if(fx.kind === 'tombquake'){
		for(let i = 0; i < fx.slabs.length; i++){
			const s = fx.slabs[i];
			if(fx.age >= s.punch && s.h < s.maxH) s.h += 4;
			if(s.h > 8 && player.x + player.w > s.x - 36 && player.x < s.x + 36 && player.y + player.h > s.y - s.h - 6 && player.y + player.h < s.y + 8){
				player.y = s.y - s.h - player.h;
				player.vy = Math.min(0, player.vy);
				player.onGround = true;
			}
		}
	} else if(fx.kind === 'venomDrop'){
		fx.y += 7.4;
		if(!fx.hit && lHit(en, fx.x, fx.y, 12, lDmg(16), ['poison'])) fx.hit = true;
		if(fx.y > lFloor(fx.x, fx.y)) return true;
	} else if(fx.kind === 'ridge'){
		/* visual only */
	} else if(fx.kind === 'coilRing'){
		fx.r = Math.max(28, 150 - fx.age * 1.4);
		const px = player.x + player.w / 2, py = player.y + player.h / 2;
		if(Math.abs(Math.hypot(px - fx.x, py - fx.y) - fx.r) < 16 && fx.age % 6 === 0) lHit(en, px, py, 18, lDmg(24), []);
		if(fx.r <= 32) lHit(en, fx.x, fx.y, 36, lDmg(32), ['stun']);
	} else if(fx.kind === 'curseSlashes'){
		if(fx.age === 6 || fx.age === 14 || fx.age === 22){
			fx.n++;
			const reach = fx.n >= 3 ? 160 : 54;
			lHit(en, fx.x + fx.dir * (reach * 0.45), fx.y, reach * 0.4, lDmg(24 + fx.n * 4), []);
			lFX({ kind:'slashTrail', en, x: fx.x + fx.dir * 20, y: fx.y, w: reach, dir: fx.dir, age: 0, max: 16 });
		}
	} else if(fx.kind === 'slashTrail' || fx.kind === 'rageSlash'){
		if(fx.age === 2) lHit(en, fx.x + (fx.dir || 1) * 24, fx.y, fx.kind === 'rageSlash' ? 34 : 20, lDmg(20), []);
		if(fx.kind === 'rageSlash' && fx.age < 14) lHit(en, fx.x, fx.y, 16, lDmg(8), []);
	} else if(fx.kind === 'burialRing'){
		fx.r = Math.max(24, 140 - fx.age * 1.7);
		const px = player.x + player.w / 2, py = player.y + player.h / 2;
		if(Math.abs(Math.hypot(px - fx.x, py - fx.y) - fx.r) < 14 && fx.age % 6 === 0) lHit(en, px, py, 16, lDmg(20), []);
	} else if(fx.kind === 'plagueCloud'){
		fx.x += fx.vx;
		if(fx.age % 16 === 0){
			const aim = lLead(en, 8);
			lFX({ kind:'scarabDive', en, x: fx.x + (Math.random() - 0.5) * 80, y: fx.y - 20, tx: aim.x, ty: aim.y, age: 0, max: 28 });
		}
		if(fx.age % 12 === 0) lHit(en, fx.x, fx.y + 20, 40, lDmg(14), ['poison']);
	} else if(fx.kind === 'scarabDive'){
		fx.x += (fx.tx - fx.x) * 0.16;
		fx.y += (fx.ty - fx.y) * 0.16;
		if(fx.age === 16) lHit(en, fx.x, fx.y, 18, lDmg(20), ['poison']);
	} else if(fx.kind === 'scatter'){
		if(fx.age === 28) fx.returning = true;
		for(let i = 0; i < fx.bugs.length; i++){
			const b = fx.bugs[i];
			if(!fx.returning){ b.x += b.vx; b.y += b.vy; }
			else {
				b.x += (fx.ox - b.x) * 0.1;
				b.y += (fx.oy - b.y) * 0.1;
			}
			if(fx.age % 5 === i % 5) lHit(en, b.x, b.y, 10, lDmg(12), []);
		}
		if(fx.age > 80 && en){ en._lateHidden = false; en._lateNoHit = false; }
	} else if(fx.kind === 'splitBugs'){
		if(fx.age % 4 === 0) lHit(en, fx.x + (fx.age % 2 ? 40 : -40), fx.y, 18, lDmg(14), []);
	} else if(fx.kind === 'carpet'){
		fx.x += fx.vx;
		const px = player.x + player.w / 2, py = player.y + player.h;
		let safe = false;
		for(let i = 0; i < fx.safes.length; i++){
			if(Math.hypot(px - (fx.safes[i].x + fx.x * 0.02), py - fx.safes[i].y) < fx.safes[i].r) safe = true;
		}
		if(!safe && py > fx.y - 20 && px > fx.x - 40 && px < fx.x + fx.w && fx.age % 8 === 0) lHit(en, px, py, 18, lDmg(18), []);
	} else if(fx.kind === 'stormBolt'){
		fx.x += fx.vx; fx.y += fx.vy;
		if(!fx.hit && lHit(en, fx.x, fx.y, 20, lDmg(24), [])) fx.hit = true;
		if(fx.age >= fx.max - 1){
			lFX({ kind:'miniStorm', en, x: fx.x, y: fx.y, vx: fx.vx * 0.45, vy: fx.vy * 0.45, age: 0, max: 80 });
			return true;
		}
	} else if(fx.kind === 'miniStorm'){
		fx.x += fx.vx; fx.y += fx.vy;
		if(fx.age % 8 === 0) lHit(en, fx.x, fx.y, 36, lDmg(18), []);
	} else if(fx.kind === 'tornado'){
		fx.x = fx.base + Math.sin(fx.age * 0.08 * fx.cw) * 70;
		if(fx.age % 8 === 0) lHit(en, fx.x, fx.y, fx.r, lDmg(18), []);
	} else if(fx.kind === 'djinnMirage'){
		for(let i = 0; i < fx.copies.length; i++){
			const c = fx.copies[i];
			if(fx.age === 20 + i * 8){
				const a = Math.atan2((player.y + player.h / 2) - c.y, (player.x + player.w / 2) - c.x);
				lFX({ kind:'fakeBolt', en, x: c.x, y: c.y, vx: Math.cos(a) * 11.2, vy: Math.sin(a) * 11.2, age: 0, max: 40, real: false });
			}
		}
		if(fx.age === 20 + (fx.realDelay || 18)){
			const ox = en ? en.x + en.w / 2 : fx.copies[0].x;
			const oy = en ? en.y + en.h / 2 : fx.copies[0].y;
			const a = Math.atan2((player.y + player.h / 2) - oy, (player.x + player.w / 2) - ox);
			lFX({ kind:'fakeBolt', en, x: ox, y: oy, vx: Math.cos(a) * 12.4, vy: Math.sin(a) * 12.4, age: 0, max: 42, real: true });
		}
	} else if(fx.kind === 'fakeBolt'){
		fx.x += fx.vx; fx.y += fx.vy;
		if(fx.real){
			if(!fx.hit && lHit(en, fx.x, fx.y, 22, lDmg(28), [])) fx.hit = true;
		} else if(circRect(fx.x, fx.y, 20, player.x, player.y, player.w, player.h)){
			lSpark(fx.x, fx.y, 8, { r: 220, g: 190, b: 80 });
			return true;
		}
	} else if(fx.kind === 'prison'){
		fx.r = Math.max(48, 190 - fx.age * 1.1);
		fx.open += 0.07;
		const px = player.x + player.w / 2, py = player.y + player.h / 2;
		const d = Math.hypot(px - fx.x, py - fx.y);
		const pa = Math.atan2(py - fx.y, px - fx.x);
		let diff = pa - fx.open;
		while(diff > Math.PI) diff -= Math.PI * 2;
		while(diff < -Math.PI) diff += Math.PI * 2;
		if(Math.abs(d - fx.r) < 18 && Math.abs(diff) > 0.42 && fx.age % 6 === 0) lHit(en, px, py, 18, lDmg(22), []);
	}
	return false;
}

function lateBurstNode(node){
	if(!node || node.dead) return;
	node.dead = true;
	node.age = 0;
	node.max = 10;
	lHit(node.en, node.x, node.y, 50, lDmg(28), []);
	lSpark(node.x, node.y, 12, { r: 220, g: 80, b: 110 });
	for(let i = 0; i < lateWorldFX.length; i++){
		const o = lateWorldFX[i];
		if(o.kind !== 'coralNode' || o === node || o.dead) continue;
		if(Math.hypot(o.x - node.x, o.y - node.y) < 110) lateBurstNode(o);
	}
}

function drawLateWorld(){
	for(let i = 0; i < lateWorldFX.length; i++){
		const fx = lateWorldFX[i];
		const x = fx.x - camera.x, y = fx.y - camera.y;
		ctx.save();
		if(fx.kind === 'shadowBolt' && fx.phase !== 'hide'){
			ctx.shadowColor = '#aa66ff'; ctx.shadowBlur = 14;
			ctx.fillStyle = '#6a2aaa'; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'ghostSlash'){
			ctx.globalAlpha = 0.7; ctx.strokeStyle = '#ddbbff'; ctx.lineWidth = 4;
			ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 1.2); ctx.stroke();
		} else if(fx.kind === 'soulEcho'){
			for(let c = 0; c < fx.copies.length; c++){
				ctx.globalAlpha = fx.copies[c].real ? 0.95 : 0.45;
				ctx.fillStyle = '#442266';
				ctx.fillRect(fx.copies[c].x - 14 - camera.x, fx.copies[c].y - 22 - camera.y, 28, 44);
			}
		} else if(fx.kind === 'graveRift'){
			ctx.fillStyle = '#1a0a22'; ctx.fillRect(x - 8, y - 4, 220, 8);
			ctx.fillStyle = '#ddccff';
			for(let b = 0; b < fx.bones.length; b++) ctx.fillRect(fx.bones[b].x - 6 - camera.x, fx.bones[b].y - fx.bones[b].rise - camera.y, 12, fx.bones[b].rise);
		} else if(fx.kind === 'icePatch'){
			ctx.globalAlpha = 0.45; ctx.fillStyle = '#88ddee';
			ctx.beginPath(); ctx.ellipse(x, y, fx.r, 10, 0, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'icicle'){
			ctx.shadowColor = '#88eeff'; ctx.shadowBlur = 10;
			ctx.fillStyle = '#cceeff'; ctx.fillRect(x - 5, y - 16, 10, 22);
		} else if(fx.kind === 'fireSpit'){
			ctx.shadowColor = '#ff6622'; ctx.shadowBlur = 12;
			if(fx.phase === 'one'){ ctx.fillStyle = '#ff4400'; ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill(); }
			else if(fx.kids){ ctx.fillStyle = '#ff8844'; for(let k = 0; k < fx.kids.length; k++){ ctx.beginPath(); ctx.arc(fx.kids[k].x - camera.x, fx.kids[k].y - camera.y, 8, 0, Math.PI * 2); ctx.fill(); } }
		} else if(fx.kind === 'fireLine' || fx.kind === 'emberPop' || fx.kind === 'lavaPuddle'){
			ctx.globalAlpha = 0.7; ctx.fillStyle = '#ff5522';
			ctx.beginPath(); ctx.ellipse(x, y, fx.kind === 'lavaPuddle' ? 22 : 14, 8, 0, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'magmaStick'){
			ctx.fillStyle = fx.stuck ? '#aa3300' : '#ff7722'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'magmaTrap'){
			ctx.fillStyle = fx.grown ? '#ff4400' : '#662200';
			ctx.fillRect(x - (fx.grown ? 12 : 7), y - (fx.grown ? 56 : 10), fx.grown ? 24 : 14, fx.grown ? 56 : 10);
		} else if(fx.kind === 'waterBlade'){
			ctx.shadowColor = '#66eeff'; ctx.shadowBlur = 12;
			ctx.fillStyle = '#2288aa'; ctx.save(); ctx.translate(x, y); ctx.rotate(fx.ang);
			ctx.fillRect(-28, -8, 56, 16); ctx.restore();
		} else if(fx.kind === 'tidalWave'){
			ctx.globalAlpha = 0.7; ctx.fillStyle = '#1a6a88'; ctx.fillRect(x - 18, y - 28, 36, 36);
		} else if(fx.kind === 'depthCrush'){
			ctx.strokeStyle = 'rgba(80,200,230,0.75)'; ctx.lineWidth = 5;
			ctx.beginPath(); ctx.arc(x, y, fx.r, 0, Math.PI * 2); ctx.stroke();
		} else if(fx.kind === 'undertow'){
			ctx.globalAlpha = 0.25; ctx.fillStyle = '#114466';
			ctx.beginPath(); ctx.arc(x, y, 90 + Math.sin(fx.age * 0.2) * 8, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'spineUp'){
			ctx.fillStyle = '#cc5080'; ctx.fillRect(x - 5, y - 28, 10, 28);
		} else if(fx.kind === 'coralChunk' || fx.kind === 'coralNode'){
			ctx.fillStyle = fx.dead ? '#663344' : '#cc5080';
			ctx.beginPath(); ctx.arc(x, y - 8, fx.kind === 'coralNode' ? 14 : 10, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'venomBubble'){
			ctx.globalAlpha = 0.7; ctx.fillStyle = '#66ff88';
			ctx.beginPath(); ctx.arc(x, y, fx.r, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'dustDevil' || fx.kind === 'tornado' || fx.kind === 'miniStorm'){
			ctx.strokeStyle = 'rgba(220,190,90,0.75)'; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(x, y - 20, fx.r || 28, 0, Math.PI * 2); ctx.stroke();
		} else if(fx.kind === 'sandHaz'){
			ctx.fillStyle = 'rgba(180,140,50,0.55)'; ctx.beginPath(); ctx.ellipse(x, y, 16, 7, 0, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'mirages' || fx.kind === 'djinnMirage'){
			ctx.globalAlpha = 0.7; ctx.fillStyle = '#c4a050';
			for(let c = 0; c < fx.copies.length; c++) ctx.fillRect(fx.copies[c].x - camera.x, fx.copies[c].y - camera.y, 28, 46);
		} else if(fx.kind === 'stoneSmash'){
			ctx.globalAlpha = 0.4; ctx.fillStyle = '#221800';
			ctx.beginPath(); ctx.ellipse(x, y, 40, 14, 0, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'farShock'){
			ctx.globalAlpha = 0.35; ctx.strokeStyle = '#e8c878'; ctx.lineWidth = 4;
			ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.stroke();
		} else if(fx.kind === 'glyph'){
			ctx.save(); ctx.translate(x, y); ctx.rotate(fx.rot);
			ctx.strokeStyle = '#ffcc44'; ctx.lineWidth = 2;
			ctx.strokeRect(-18, -18, 36, 36); ctx.restore();
		} else if(fx.kind === 'tombquake'){
			ctx.fillStyle = '#7a6848';
			for(let s = 0; s < fx.slabs.length; s++) ctx.fillRect(fx.slabs[s].x - 36 - camera.x, fx.slabs[s].y - fx.slabs[s].h - camera.y, 72, fx.slabs[s].h);
		} else if(fx.kind === 'venomDrop'){
			ctx.fillStyle = '#66ff44'; ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'ridge'){
			ctx.fillStyle = '#c4a860'; ctx.beginPath(); ctx.ellipse(x, y, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'coilRing' || fx.kind === 'burialRing'){
			ctx.strokeStyle = fx.kind === 'burialRing' ? '#c4b880' : '#aa9040'; ctx.lineWidth = 5;
			ctx.beginPath(); ctx.arc(x, y, fx.r, 0, Math.PI * 2); ctx.stroke();
		} else if(fx.kind === 'slashTrail' || fx.kind === 'rageSlash'){
			ctx.strokeStyle = '#aa3344'; ctx.lineWidth = 4;
			ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (fx.dir || 1) * (fx.w || 50), y - 8); ctx.stroke();
		} else if(fx.kind === 'plagueCloud'){
			ctx.globalAlpha = 0.4; ctx.fillStyle = '#2a4a2a';
			ctx.beginPath(); ctx.ellipse(x, y, 70, 28, 0, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'scarabDive'){
			ctx.fillStyle = '#3a6a3a'; ctx.fillRect(x - 6, y - 4, 12, 8);
		} else if(fx.kind === 'scatter'){
			ctx.fillStyle = '#2a4a2a';
			for(let b = 0; b < fx.bugs.length; b++) ctx.fillRect(fx.bugs[b].x - 3 - camera.x, fx.bugs[b].y - 3 - camera.y, 6, 6);
		} else if(fx.kind === 'splitBugs'){
			ctx.fillStyle = '#3a6a3a'; ctx.fillRect(x - 30, y - 6, 16, 10); ctx.fillRect(x + 14, y - 6, 16, 10);
		} else if(fx.kind === 'carpet'){
			ctx.globalAlpha = 0.35; ctx.fillStyle = '#1a3a1a'; ctx.fillRect(x, y - 8, fx.w, 16);
			ctx.globalAlpha = 0.55; ctx.fillStyle = '#88aa44';
			for(let s = 0; s < fx.safes.length; s++) ctx.beginPath(), ctx.arc(fx.safes[s].x - camera.x, fx.safes[s].y - camera.y, fx.safes[s].r, 0, Math.PI * 2), ctx.fill();
		} else if(fx.kind === 'stormBolt' || fx.kind === 'fakeBolt'){
			ctx.shadowColor = '#e8c060'; ctx.shadowBlur = 12;
			ctx.fillStyle = fx.real === false ? '#ddcc88' : '#c4a040';
			ctx.beginPath(); ctx.arc(x, y, 11, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'prison'){
			ctx.strokeStyle = 'rgba(180,140,40,0.8)'; ctx.lineWidth = 10;
			ctx.beginPath(); ctx.arc(x, y, fx.r, 0, Math.PI * 2); ctx.stroke();
			const ox = x + Math.cos(fx.open) * fx.r, oy = y + Math.sin(fx.open) * fx.r;
			ctx.fillStyle = '#ffe080'; ctx.beginPath(); ctx.arc(ox, oy, 8, 0, Math.PI * 2); ctx.fill();
			ctx.globalAlpha = 0.22; ctx.fillStyle = '#221800';
			ctx.beginPath(); ctx.arc(x, y, fx.r - 8, 0, Math.PI * 2); ctx.fill();
		}
		ctx.restore();
	}
	if(typeof enemies !== 'undefined') for(let i = 0; i < enemies.length; i++) drawLateEnemyFX(enemies[i]);
	if(typeof playerMinions !== 'undefined') for(let i = 0; i < playerMinions.length; i++) drawLateEnemyFX(playerMinions[i]);
}

function drawLateEnemyFX(en){
	if(!en || en.dead) return;
	if(en._lateCalcify > 0){
		ctx.save(); ctx.strokeStyle = 'rgba(220,80,120,0.75)'; ctx.lineWidth = 3;
		ctx.strokeRect(en.x - 4 - camera.x, en.y - 4 - camera.y, en.w + 8, en.h + 8); ctx.restore();
	}
	if(en._lateShield){
		ctx.save(); ctx.fillStyle = 'rgba(180,140,60,0.55)';
		const dir = en.facing || 1;
		ctx.fillRect(en.x + (dir > 0 ? en.w : -18) - camera.x, en.y - camera.y, 18, en.h);
		ctx.restore();
	}
	if(en.lateKit && en.lateKit.kind === 'serpentBite' && en.lateKit.rippleX != null){
		ctx.save(); ctx.globalAlpha = 0.45; ctx.strokeStyle = '#44aacc'; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.ellipse(en.lateKit.rippleX - camera.x, (en.lateKit.ty || en.y) - camera.y, 22, 8, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
	}
	if(en.lateKit && en.lateKit.kind === 'impLeap' && en.lateKit.shadows){
		ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = '#111';
		for(let i = 0; i < en.lateKit.shadows.length; i++){
			const s = en.lateKit.shadows[i];
			ctx.beginPath(); ctx.ellipse(s.x - camera.x, s.y - camera.y, 18, 7, 0, 0, Math.PI * 2); ctx.fill();
		}
		ctx.restore();
	}
	if(en.lateKit && en.lateKit.kind === 'buried' && en.lateKit.patches){
		ctx.save(); ctx.fillStyle = 'rgba(180,140,50,0.7)';
		for(let i = 0; i < en.lateKit.patches.length; i++){
			const p = en.lateKit.patches[i];
			ctx.beginPath(); ctx.ellipse(p.x - camera.x, p.y - camera.y, 20, 8, 0, 0, Math.PI * 2); ctx.fill();
		}
		ctx.restore();
	}
	if(en.lateKit && en.lateKit.kind === 'duneAmbush' && en.lateKit.dunes){
		ctx.save(); ctx.fillStyle = '#c4a860';
		for(let i = 0; i < en.lateKit.dunes.length; i++){
			const d = en.lateKit.dunes[i];
			ctx.beginPath(); ctx.moveTo(d.x - 28 - camera.x, d.y - camera.y);
			ctx.lineTo(d.x - camera.x, d.y - 22 - camera.y);
			ctx.lineTo(d.x + 28 - camera.x, d.y - camera.y); ctx.fill();
		}
		ctx.restore();
	}
	if(en.lateKit && en.lateKit.kind === 'current' && en.lateKit.wake){
		ctx.save(); ctx.strokeStyle = 'rgba(60,160,200,0.55)';
		for(let w = 0; w < en.lateKit.wake.length; w++){
			ctx.strokeRect(en.lateKit.wake[w].x - 14 - camera.x, en.lateKit.wake[w].y - 8 - camera.y, 28, 16);
		}
		ctx.restore();
	}
}

function drawLateKitProj(p){
	const x = p.x - camera.x, y = p.y - camera.y;
	ctx.save();
	ctx.shadowBlur = 14;
	ctx.shadowColor = p.color || '#ffffff';
	ctx.fillStyle = p.color || '#fff';
	ctx.beginPath();
	ctx.ellipse(x, y, Math.max(8, (p.width || 16) * 0.45), Math.max(8, (p.height || 16) * 0.45), p.rotAngle || 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

function lateKitTryBounce(p){
	if(!p || !p._lateRoll) return false;
	p.vx = -p.vx;
	p.vy = -Math.abs(p.vy);
	return true;
}

function lateKitInterceptProj(p){
	if(!p || p.hasHit) return false;
	const pool = (typeof enemies !== 'undefined' ? enemies : []).concat(typeof playerMinions !== 'undefined' ? playerMinions : []);
	for(let i = 0; i < pool.length; i++){
		const en = pool[i];
		if(!en || en.dead || !en._lateShield) continue;
		const dir = en.facing || 1;
		const sx = en.x + (dir > 0 ? en.w - 4 : -20);
		if(circRect(p.x, p.y, 12, sx, en.y - 4, 24, en.h + 8)){
			en._lateAbsorb = (en._lateAbsorb || 0) + 1;
			p.hasHit = true;
			if(p.hitTargets && p.hitTargets.add) p.hitTargets.add(en);
			lSpark(p.x, p.y, 8, { r: 200, g: 160, b: 70 });
			return true;
		}
	}
	for(let i = 0; i < lateWorldFX.length; i++){
		const n = lateWorldFX[i];
		if(n.kind !== 'coralNode' || n.dead) continue;
		if(circRect(p.x, p.y, 10, n.x - 14, n.y - 18, 28, 28)){
			n.hp = (n.hp || 3) - 1;
			p.hasHit = true;
			if(n.hp <= 0) lateBurstNode(n);
			return true;
		}
	}
	return false;
}

function lateKitOnEnemyHit(en, p){
	if(!en || !en._lateCalcify) return 1;
	en._lateCalcify--;
	lFX({ kind:'coralChunk', en, x: en.x + en.w / 2, y: en.y + en.h, vx: (Math.random() - 0.5) * 6, vy: 2, age: 18, max: 200, parked: true });
	lSpark(en.x + en.w / 2, en.y + en.h / 2, 8, { r: 200, g: 80, b: 110 });
	return en._lateCalcify > 0 ? 0.55 : 1.15;
}

function lateKitSpriteRow(en){
	const type = (en && (en.necroType || en.type)) || '';
	if(!LATE_KIT_TYPES[type]) return null;
	if(en.dead){
		const meta = (typeof SPRITE_SHEET_META !== 'undefined') ? SPRITE_SHEET_META[type] : null;
		return (meta && meta.rows) ? meta.rows - 1 : 3;
	}
	if(en.lateKit) return 2;
	return null;
}

function registerLateDungeonCasts(map){
	const casts = {
		castShadowBolt, castPhaseStrike, castSoulDrain, castSoulEcho, castGraveRift,
		castBabyIceBreath, castBabyFrostNova, castBabyIcicleBarrage, castBabyGlacialSlam, castBabyFrozenDive,
		castFireSpit, castFlameDash, castEmberTrail, castMagmaRoll,
		castMagmaBolt, castLavaSplash, castImpLeap, castMagmaTrap,
		castAbyssalStrike, castTidalBash, castDepthCrush, castUndertow,
		castCoralSpine, castCoralBurst, castCalcifyShield, castCoralGarden,
		castSerpentBite, castVenomSpit, castCoilingStrike, castAbyssalCurrent,
		castSandBlast, castDustDevil, castMirageShift, castBuriedStrike,
		castStoneSmash, castAncientCurse, castSandstoneShield, castTombquake,
		castVenomousFang, castSandBurrow, castConstrictingCoil, castDuneAmbush,
		castCursedSwing, castWrappingBinds, castTombRage, castBurialSnare,
		castSwarmBite, castPlagueCloud, castBurstScatter, castLivingCarpet,
		castSandstormBolt, castWhirlwindBarrage, castDesertMirage, castSandstormPrison
	};
	for(const k in casts){
		if(typeof window !== 'undefined') window[k] = casts[k];
		if(map) map[k] = casts[k];
	}
}
registerLateDungeonCasts(typeof CAST_FNS !== 'undefined' ? CAST_FNS : null);

if(typeof window !== 'undefined'){
	window.updateLateEnemy = updateLateEnemy;
	window.updateLateWorld = updateLateWorld;
	window.drawLateWorld = drawLateWorld;
	window.drawLateKitProj = drawLateKitProj;
	window.lateKitTryBounce = lateKitTryBounce;
	window.lateKitInterceptProj = lateKitInterceptProj;
	window.lateKitOnEnemyHit = lateKitOnEnemyHit;
	window.lateKitSpriteRow = lateKitSpriteRow;
	window.lateEnd = lateEnd;
	window.LATE_KIT_TYPES = LATE_KIT_TYPES;
	window.registerLateDungeonCasts = registerLateDungeonCasts;
}
