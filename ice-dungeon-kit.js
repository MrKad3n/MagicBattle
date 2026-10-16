/* =============================================================
   Ice Dungeon kit — Frost Wraith, Ice Archer, Snow Beast,
   Cryo Mage, Glacier Sentinel.
   ============================================================= */

const ICE_KIT_TYPES = { frostWraith:1, iceArcher:1, snowBeast:1, cryoMage:1, glacierSentinel:1 };
const ICE_KIT_ROW = {
	frostWraith: { frozenReflection:2, iceVeil:2, shardPossession:3, frozenMoment:3, recover:4 },
	iceArcher: { ricochetArrow:2, frostline:2, threePointShot:3, huntersMark:2, recover:4 },
	snowBeast: { avalancheCharge:2, frostquake:3, iceback:3, whiteoutRoar:2, recover:4 },
	cryoMage: { frostGeometry:2, temperatureShift:2, iceEcho:2, crystalCoffin:3, recover:4 },
	glacierSentinel: { movingFortress:2, glacierHammer:2, frozenOrbit:3, absoluteGuard:3, recover:4 }
};

const iceWorldFX = [];

function iceAim(en){
	if(typeof fireKitAim === 'function') return fireKitAim(en);
	return { x: player.x + player.w / 2, y: player.y + player.h / 2, vx: player.vx || 0, vy: player.vy || 0, box: player };
}
function iceFriendly(en){ return !!(en && (en.isNecroSummon || en.necroFriendly)); }
/* Size/speed threat on top of the global projectile scale.
   Normal +22%, easy +12%, hard/nightmare +65%. */
function iceThreat(){
	const d = (typeof DIFFICULTY !== 'undefined') ? DIFFICULTY : 'normal';
	if(d === 'hard' || d === 'nightmare' || d === 'expert') return 1.65;
	if(d === 'easy') return 1.12;
	return 1.22;
}
function atkS(n){
	const g = (typeof ENEMY_ATK_SCALE === 'number') ? ENEMY_ATK_SCALE : 1.3;
	return n * g * iceThreat();
}
function iceSpd(n){ return n * iceThreat(); }
function iceDmg(n){
	const diff = (typeof DIFF_DMG_MULT === 'number') ? DIFF_DMG_MULT : 1;
	return Math.round(n * 1.4 * diff);
}
function iceFloorY(x, fromY){
	if(typeof fireKitFloorY === 'function') return fireKitFloorY(x, fromY);
	return (fromY || 0) + 80;
}
function iceBlocked(x, y){
	if(typeof fireKitBlocked === 'function') return fireKitBlocked(x, y);
	return false;
}
function iceSpark(x, y, n){
	if(typeof particles === 'undefined') return;
	for(let i = 0; i < Math.min(n || 8, 16); i++){
		const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3.5;
		particles.push({
			x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
			vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1,
			life: 14 + Math.random() * 14, maxLife: 28, r: 1.4 + Math.random() * 2,
			color: { r: 160, g: 210, b: 255 }
		});
	}
}
function iceSpawn(en, x, y, vx, vy, opts){
	opts = opts || {};
	if(!opts.effects) opts.effects = ['freeze'];
	if(!opts.trail) opts.trail = 'ice';
	const t = iceThreat();
	if(opts.width) opts.width *= t;
	if(opts.height) opts.height *= t;
	if(opts.aoeRadius) opts.aoeRadius *= t;
	const p = spawnEnemyProj(x, y, vx * t, vy * t, opts);
	if(p){
		p._iceStyle = opts._iceStyle || 'shard';
		if(iceFriendly(en)){
			if(typeof markNecroFriendlyProj === 'function') markNecroFriendlyProj(p, en);
			else p.necroFriendly = true;
		}
		const src = (en && (en.necroType || en.type)) || '';
		if(player._iceMark && !p.necroFriendly && src === 'iceArcher'){
			p.homing = true;
			p.homingStrength = 0.028;
		}
	}
	return p;
}
function iceHit(en, x, y, r, dmg, effects){
	r = atkS(r);
	if(iceFriendly(en)){
		if(typeof necroScaleKitDmg === 'function') dmg = necroScaleKitDmg(en, dmg);
		const pool = (typeof enemies !== 'undefined' ? enemies : []).concat(typeof dummies !== 'undefined' ? dummies : []);
		for(let i = 0; i < pool.length; i++){
			const t = pool[i];
			if(!t || t.dead) continue;
			if(circRect(x, y, r, t.x, t.y, t.w, t.h)){
				t.hp -= dmg; t.flash = 8;
				dmgNumbers.push({ x: t.x + t.w / 2, y: t.y - 10, text: Math.round(dmg) + '', age: 0, color: '#88ddff' });
				return true;
			}
		}
		return false;
	}
	if(player.iFrames > 0) return false;
	if(circRect(x, y, r, player.x, player.y, player.w, player.h)){
		damagePlayer(dmg, effects || ['freeze']);
		return true;
	}
	return false;
}
function iceDragSet(amt){
	player._iceDrag = Math.max(player._iceDrag || 0, amt);
}
function iceEnd(en){
	if(!en) return;
	en.iceKit = null;
	en._iceKitBusy = false;
	en._iceHidden = false;
	en._iceNoHit = false;
	en._iceArmor = false;
	en._iceGuard = false;
	en._iceVulnerable = false;
}
function beginIceKit(en, kind, extra){
	const type = en.necroType || en.type;
	const rows = ICE_KIT_ROW[type] || {};
	en.iceKit = Object.assign({ kind, t: 0, type, row: rows[kind] != null ? rows[kind] : 2 }, extra || {});
	en._iceKitBusy = extra && extra.busy === false ? false : true;
	en.attackAnimTimer = Math.max(en.attackAnimTimer || 0, 48);
	en.facing = iceAim(en).x >= en.x + en.w / 2 ? 1 : -1;
	if(kind !== 'iceEcho'){
		for(let i = 0; i < iceWorldFX.length; i++){
			const fx = iceWorldFX[i];
			if(fx.kind === 'echo' && fx.en === en && !fx.pending){
				fx.pending = kind;
				fx.copyAt = fx.age + 36;
			}
		}
	}
	return en.iceKit;
}

/* ---------- WRAITH ---------- */
function castWraithFrozenReflection(en){
	const path = en._iceLastPath ? en._iceLastPath.slice() : [];
	beginIceKit(en, 'frozenReflection', { busy: true, path, clone: { x: en.x, y: en.y, i: 0 }, phase: 'hide' });
	en._iceHidden = true;
}
function castWraithIceVeil(en){
	const aim = iceAim(en);
	beginIceKit(en, 'iceVeil', {
		busy: true, trail: [],
		tx: aim.x + (Math.random() < 0.5 ? -140 : 140),
		ty: aim.y - 40 - Math.random() * 50
	});
	en._iceHidden = true;
}
function castWraithShardPossession(en){
	const aim = iceAim(en);
	const shards = [];
	for(let i = 0; i < 4; i++){
		const sx = aim.x + (i - 1.5) * 110 + (Math.random() - 0.5) * 30;
		const sy = iceFloorY(sx, aim.y) - 8;
		shards.push({ x: sx, y: sy });
		spawnTelegraph(sx - 14, sy - 40, 28, 48, 40, 'rgba(140,200,255,0.3)', 'rect', '');
	}
	beginIceKit(en, 'shardPossession', { busy: true, shards, si: 0, next: 24 });
}
function castWraithFrozenMoment(en){
	beginIceKit(en, 'frozenMoment', { busy: true, cx: en.x + en.w / 2, cy: en.y + en.h / 2, r: 20 });
}

/* ---------- ARCHER — fast, precise, high damage ---------- */
function iceLead(aim, frames){
	return { x: aim.x + (aim.vx || 0) * frames, y: aim.y + (aim.vy || 0) * frames };
}
function castArcherRicochetArrow(en){
	const aim = iceAim(en);
	const ox = en.x + en.w / 2, oy = en.y + en.h * 0.4;
	const lead = iceLead(aim, 9);
	const dx = lead.x - ox, dy = lead.y - oy, d = Math.hypot(dx, dy) || 1;
	const p = iceSpawn(en, ox, oy, dx / d * 13.6, dy / d * 13.6, {
		color: '#d8f6ff', color2: '#ffffff', power: 28, width: 42, height: 12,
		shape: 'blade', effects: ['freeze'], trail: 'ice', maxAge: 150, _iceStyle: 'arrow'
	});
	if(p){ p._iceRicochet = true; p._iceBounces = 0; p._iceBounceMax = 1; }
	beginIceKit(en, 'ricochetArrow', { busy: false });
	setTimeout(function(){ if(en.iceKit && en.iceKit.kind === 'ricochetArrow') iceEnd(en); }, 200);
}
function castArcherFrostline(en){
	const aim = iceAim(en);
	const ox = en.x + en.w / 2, oy = en.y + en.h * 0.4;
	const lead = iceLead(aim, 7);
	const floor = iceFloorY(lead.x, lead.y);
	const dx = lead.x - ox, dy = (floor - 8) - oy, d = Math.hypot(dx, dy) || 1;
	iceSpawn(en, ox, oy, dx / d * 12.8, dy / d * 12.8, {
		color: '#9ae6ff', color2: '#ffffff', power: 22, width: 26, height: 26,
		shape: 'circle', effects: ['freeze'], trail: 'ice', maxAge: 30, _iceStyle: 'arrow'
	});
	beginIceKit(en, 'frostline', { busy: true, ix: lead.x, iy: floor - 4, tx: lead.x + ((aim.vx || 0) >= 0 ? 80 : -80), grew: 0, segs: [] });
}
function castArcherThreePointShot(en){
	const aim = iceAim(en);
	const spots = [iceLead(aim, 5), iceLead(aim, 12), iceLead(aim, 19)];
	for(let i = 0; i < spots.length; i++) spawnTelegraph(spots[i].x - 12, spots[i].y - 12, 24, 24, 16 + i * 4, 'rgba(160,220,255,0.42)', 'circle', '');
	beginIceKit(en, 'threePointShot', { busy: true, spots, fired: 0 });
}
function castArcherHuntersMark(en){
	player._iceMark = 200;
	beginIceKit(en, 'huntersMark', { busy: true, fired: false });
}

/* ---------- BEAST ---------- */
function castBeastAvalancheCharge(en){
	const aim = iceAim(en);
	const dir = aim.x >= en.x + en.w / 2 ? 1 : -1;
	beginIceKit(en, 'avalancheCharge', { busy: true, dir, wave: 40, dist: 0 });
}
function castBeastFrostquake(en){
	beginIceKit(en, 'frostquake', { busy: true, phase: 'jump', gaps: [18 + (Math.random() * 10 | 0), 20 + (Math.random() * 14 | 0), 24 + (Math.random() * 12 | 0)] });
}
function castBeastIceback(en){
	beginIceKit(en, 'iceback', { busy: true });
	en._iceArmor = true;
}
function castBeastWhiteoutRoar(en){
	player._iceWhiteout = 160;
	beginIceKit(en, 'whiteoutRoar', { busy: true, prints: [], phase: 'circle' });
	en._iceHidden = true;
}

/* ---------- CRYO MAGE ---------- */
function castCryoFrostGeometry(en){
	const aim = iceAim(en);
	const floor = iceFloorY(aim.x, aim.y);
	const lines = [];
	const origin = en.x + en.w / 2;
	const side = aim.x >= origin ? 1 : -1;
	for(let i = 0; i < 3; i++){
		const x = origin + side * (70 + i * 95);
		lines.push({ x, y: floor, h: 0, maxH: atkS(88), wall: false });
		spawnTelegraph(x - 10, floor - 88, 20, 88, 36, 'rgba(140,200,255,0.22)', 'rect', '');
	}
	beginIceKit(en, 'frostGeometry', { busy: true, lines });
}
function castCryoTemperatureShift(en){
	const aim = iceAim(en);
	beginIceKit(en, 'temperatureShift', { busy: true, cx: aim.x, cy: iceFloorY(aim.x, aim.y) - 8, r: atkS(160) });
}
function castCryoIceEcho(en){
	const aim = iceAim(en);
	const ox = en.x + en.w / 2, oy = en.y + en.h * 0.3;
	const d = Math.hypot(aim.x - ox, aim.y - oy) || 1;
	const p = iceSpawn(en, ox, oy, (aim.x - ox) / d * 6, (aim.y - oy) / d * 6 - 1.2, {
		color: '#77ccff', color2: '#eef8ff', power: 14, width: 28, height: 28,
		shape: 'spike', effects: ['freeze'], trail: 'ice', gravity: 0.12, maxAge: 90, _iceStyle: 'shard'
	});
	if(p) p._iceEchoSeed = en;
	beginIceKit(en, 'iceEcho', { busy: false, landX: aim.x, landY: iceFloorY(aim.x, aim.y) });
	setTimeout(function(){
		if(en.dead) return;
		iceWorldFX.push({ kind: 'echo', en, x: aim.x, y: iceFloorY(aim.x, aim.y) - 40, age: 0, max: 200, pending: null });
		if(en.iceKit && en.iceKit.kind === 'iceEcho') iceEnd(en);
	}, 700);
}
function castCryoCrystalCoffin(en){
	const aim = iceAim(en);
	beginIceKit(en, 'crystalCoffin', { busy: true, x: aim.x, y: iceFloorY(aim.x, aim.y), grow: 0, closed: false });
}

/* ---------- SENTINEL ---------- */
function castSentinelMovingFortress(en){
	const aim = iceAim(en);
	beginIceKit(en, 'movingFortress', { busy: true, dir: aim.x >= en.x + en.w / 2 ? 1 : -1 });
}
function castSentinelGlacierHammer(en){
	const aim = iceAim(en);
	beginIceKit(en, 'glacierHammer', { busy: true, dir: aim.x >= en.x + en.w / 2 ? 1 : -1, swung: false });
	spawnTelegraph(en.x + (aim.x >= en.x ? en.w : -220), en.y + 10, 220, en.h, 50, 'rgba(140,200,255,0.28)', 'rect', '');
}
function castSentinelFrozenOrbit(en){
	const chunks = [];
	for(let i = 0; i < 4; i++) chunks.push({ ang: i * Math.PI / 2, r: atkS(70), gone: false });
	beginIceKit(en, 'frozenOrbit', { busy: true, chunks, launched: 0, next: 50 });
}
function castSentinelAbsoluteGuard(en){
	beginIceKit(en, 'absoluteGuard', { busy: true });
	en._iceGuard = true;
	en._iceNoHit = true;
}

/* ---------- ticks ---------- */
function updateIceDungeonEnemy(en){
	if(en && !en.dead){
		en._iceLastPath = en._iceLastPath || [];
		en._iceLastPath.push({ x: en.x, y: en.y });
		if(en._iceLastPath.length > 36) en._iceLastPath.shift();
	}
	const kit = en.iceKit;
	if(!kit){ en._iceKitBusy = false; return false; }
	kit.t++;
	const type = kit.type || en.necroType || en.type;
	if(type === 'frostWraith') tickWraith(en, kit);
	else if(type === 'iceArcher') tickArcher(en, kit);
	else if(type === 'snowBeast') tickBeast(en, kit);
	else if(type === 'cryoMage') tickCryo(en, kit);
	else if(type === 'glacierSentinel') tickSentinel(en, kit);
	else iceEnd(en);
	return !!en._iceKitBusy;
}

function tickWraith(en, kit){
	const aim = iceAim(en);
	if(kit.kind === 'frozenReflection'){
		const c = kit.clone;
		if(kit.path && kit.path[c.i]){
			c.x = kit.path[c.i].x; c.y = kit.path[c.i].y; c.i++;
		}
		if(kit.t < 70){
			en.x += (aim.x + 140 - en.x) * 0.04;
			en.y += (aim.y - 70 - en.y) * 0.04;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
		}
		if(kit.t === 78){
			en._iceHidden = false;
			iceHit(en, c.x + en.w / 2, c.y + en.h / 2, 32, iceDmg(16), ['freeze']);
			iceHit(en, en.x + en.w / 2, en.y + en.h / 2, 32, iceDmg(16), ['freeze']);
			iceSpark(c.x, c.y, 12); iceSpark(en.x, en.y, 12);
		}
		if(kit.t > 90) iceEnd(en);
	} else if(kit.kind === 'iceVeil'){
		en.x += ((kit.tx - en.w / 2) - en.x) * 0.07;
		en.y += ((kit.ty - en.h / 2) - en.y) * 0.07;
		if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
		if(kit.t % 5 === 0) kit.trail.push({ x: en.x + en.w / 2, y: en.y + en.h, age: 0 });
		if(kit.t >= 70){
			en._iceHidden = false;
			iceHit(en, en.x + en.w / 2, en.y + en.h / 2, 36, iceDmg(18), ['freeze']);
			iceSpark(en.x + en.w / 2, en.y + en.h / 2, 14);
			iceEnd(en);
		}
	} else if(kit.kind === 'shardPossession'){
		if(kit.t >= kit.next && kit.si < kit.shards.length){
			const s = kit.shards[kit.si];
			en.x = s.x - en.w / 2; en.y = s.y - en.h;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
			iceHit(en, s.x, s.y - 20, 38, iceDmg(14), ['freeze']);
			iceSpark(s.x, s.y, 12);
			kit.si++; kit.next = kit.t + 28;
		}
		if(kit.si >= kit.shards.length && kit.t > kit.next) iceEnd(en);
	} else if(kit.kind === 'frozenMoment'){
		kit.r = Math.min(atkS(170), atkS(20) + kit.t * atkS(1.6));
		const dist = Math.hypot(aim.x - kit.cx, aim.y - kit.cy);
		if(dist < kit.r) iceDragSet(Math.min(0.72, 0.18 + (kit.r - dist) / kit.r * 0.55));
		if(kit.t === 70){
			const ang = Math.atan2(aim.y - (en.y + en.h / 2), aim.x - (en.x + en.w / 2));
			en.x = kit.cx + Math.cos(ang + Math.PI) * (kit.r + 30) - en.w / 2;
			en.y = kit.cy + Math.sin(ang + Math.PI) * 20 - en.h / 2;
			iceSpawn(en, en.x + en.w / 2, en.y + en.h / 2, Math.cos(ang) * 8, Math.sin(ang) * 8, {
				color: '#99eeff', color2: '#ffffff', power: 20, width: 34, height: 34,
				shape: 'circle', effects: ['freeze'], trail: 'ice', maxAge: 80, _iceStyle: 'shard'
			});
		}
		if(kit.t > 88) iceEnd(en);
	}
}

function tickArcher(en, kit){
	const aim = iceAim(en);
	if(kit.kind === 'frostline'){
		if(kit.t > 10 && kit.grew < 1){
			kit.grew = Math.min(1, (kit.t - 10) / 20);
			const n = Math.floor(kit.grew * 16);
			while(kit.segs.length < n){
				const t = kit.segs.length / 16;
				kit.segs.push({
					x: kit.ix + (kit.tx - kit.ix) * t,
					y: kit.iy
				});
			}
		}
		for(let i = 0; i < kit.segs.length; i++){
			const s = kit.segs[i];
			if(circRect(s.x, s.y, atkS(18), aim.box.x, aim.box.y, aim.box.w, aim.box.h)){
				iceDragSet(0.55);
				if(!iceFriendly(en)) player._iceSlip = 20;
			}
		}
		if(kit.t > 70) iceEnd(en);
	} else if(kit.kind === 'threePointShot'){
		const times = [14, 20, 26];
		if(kit.fired < 3 && kit.t >= times[kit.fired]){
			const i = kit.fired;
			const ox = en.x + en.w / 2, oy = en.y + en.h * 0.4;
			const dx = kit.spots[i].x - ox, dy = kit.spots[i].y - oy, d = Math.hypot(dx, dy) || 1;
			iceSpawn(en, ox, oy, dx / d * 13.2, dy / d * 13.2, {
				color: '#c8f4ff', color2: '#ffffff', power: 24, width: 36, height: 11,
				shape: 'blade', effects: ['freeze'], trail: 'ice', maxAge: 80, _iceStyle: 'arrow'
			});
			kit.fired++;
		}
		if(kit.t > 38) iceEnd(en);
	} else if(kit.kind === 'huntersMark'){
		if(kit.t === 8 && !kit.fired){
			kit.fired = true;
			const lead = iceLead(aim, 11);
			const ox = en.x + en.w / 2, oy = en.y + en.h * 0.4;
			const dx = lead.x - ox, dy = lead.y - oy, d = Math.hypot(dx, dy) || 1;
			const p = iceSpawn(en, ox, oy, dx / d * 15.4, dy / d * 15.4, {
				color: '#ffffff', color2: '#88ddff', power: 32, width: 46, height: 12,
				shape: 'blade', effects: ['freeze'], trail: 'ice', maxAge: 120, _iceStyle: 'arrow'
			});
			if(p){ p.homing = true; p.homingStrength = 0.06; }
		}
		if(kit.t > 22) iceEnd(en);
	}
}

function tickBeast(en, kit){
	const aim = iceAim(en);
	if(kit.kind === 'avalancheCharge'){
		let dir = kit.dir;
		if(Math.abs(aim.x - (en.x + en.w / 2)) < 90) dir = aim.x >= en.x + en.w / 2 ? 1 : -1;
		en.x += dir * 6.4;
		kit.dist += 6.4;
		kit.wave = Math.min(atkS(130), atkS(40) + kit.dist * 0.22);
		const wx = en.x + en.w / 2 + dir * (en.w * 0.6 + kit.wave * 0.25);
		const wy = en.y + en.h - 10;
		iceHit(en, wx, wy, kit.wave * 0.45, iceDmg(18), ['freeze']);
		if(kit.t > 54) iceEnd(en);
	} else if(kit.kind === 'frostquake'){
		if(kit.phase === 'jump'){
			en.y -= 7;
			if(kit.t === 16){ kit.phase = 'land'; en.y += 80; if(typeof shakeScreen === 'function') shakeScreen(8, 12); kit.waveT = 0; kit.waveI = 0; }
		} else {
			kit.waveT++;
			if(kit.waveI < 3 && kit.waveT >= (kit.gaps[kit.waveI] || 20)){
				const r = 70 + kit.waveI * 55;
				iceHit(en, en.x + en.w / 2, en.y + en.h, r * 0.55, iceDmg(16 + kit.waveI * 4), ['freeze']);
				const ring = iceSpawn(en, en.x + en.w / 2, en.y + en.h, 0, 0, {
					color: '#88ccff', color2: '#ffffff', power: 14, width: 12, height: 12,
					shape: 'ring', maxAge: 22, aoe: true, aoeRadius: r, aoeMax: 22
				});
				if(ring) ring._iceStyle = 'ring';
				kit.waveI++; kit.waveT = 0;
			}
			if(kit.waveI >= 3 && kit.waveT > 12) iceEnd(en);
		}
	} else if(kit.kind === 'iceback'){
		if(kit.t > 140){ en._iceArmor = false; iceEnd(en); }
	} else if(kit.kind === 'whiteoutRoar'){
		if(kit.t % 8 === 0) kit.prints.push({ x: en.x + en.w / 2, y: en.y + en.h, age: 0 });
		en.x += Math.cos(kit.t * 0.08) * 4.2;
		if(kit.t === 100){
			en._iceHidden = false;
			const dir = aim.x >= en.x + en.w / 2 ? 1 : -1;
			en.x += dir * 80;
			iceHit(en, en.x + en.w / 2, en.y + en.h / 2, 50, iceDmg(26), ['freeze']);
			if(typeof shakeScreen === 'function') shakeScreen(8, 14);
		}
		if(kit.t > 118) iceEnd(en);
	}
}

function tickCryo(en, kit){
	const aim = iceAim(en);
	if(kit.kind === 'frostGeometry'){
		for(let i = 0; i < kit.lines.length; i++){
			const L = kit.lines[i];
			L.h = Math.min(L.maxH, kit.t * 2.1);
			if(kit.t >= 36) L.wall = true;
			if(L.wall && Math.abs(aim.x - L.x) < 18 && aim.y > L.y - L.h && aim.y < L.y + 16){
				iceDragSet(0.75);
				const push = aim.x < L.x ? -2.4 : 2.4;
				if(!iceFriendly(en)) player.x += push;
				if(kit.t % 14 === 0) iceHit(en, L.x, aim.y, 16, iceDmg(8), ['freeze']);
			}
		}
		if(kit.t === 48 || kit.t === 62){
			const ox = en.x + en.w / 2, oy = en.y + en.h * 0.3;
			const d = Math.hypot(aim.x - ox, aim.y - oy) || 1;
			iceSpawn(en, ox, oy, (aim.x - ox) / d * 7.4, (aim.y - oy) / d * 7.4, {
				color: '#66ccee', color2: '#ddf6ff', power: 16, width: 30, height: 30,
				shape: 'spike', effects: ['freeze'], trail: 'ice', maxAge: 80, _iceStyle: 'shard'
			});
		}
		if(kit.t > 110) iceEnd(en);
	} else if(kit.kind === 'temperatureShift'){
		const dist = Math.hypot(aim.x - kit.cx, aim.y - kit.cy);
		if(dist < kit.r){
			const t = dist / kit.r;
			if(t > 0.28) iceDragSet(0.15 + t * 0.6);
		}
		if(kit.t === 70){
			iceSpawn(en, kit.cx, kit.cy - 80, 0, 7, {
				color: '#88eeff', color2: '#ffffff', power: 22, width: 40, height: 40,
				shape: 'circle', effects: ['freeze'], trail: 'ice', maxAge: 50, _iceStyle: 'shard'
			});
		}
		if(kit.t > 90) iceEnd(en);
	} else if(kit.kind === 'crystalCoffin'){
		kit.x += (aim.x - kit.x) * 0.04;
		kit.grow = Math.min(1, kit.t / 48);
		const half = atkS(46);
		const inside = Math.abs(aim.x - kit.x) < half && Math.abs(aim.y - kit.y) < atkS(50);
		if(kit.t === 52){
			kit.closed = inside;
			if(inside){
				if(!iceFriendly(en)){ player.stunTimer = Math.max(player.stunTimer || 0, 40); iceDragSet(0.85); }
				iceSpawn(en, en.x + en.w / 2, en.y + en.h * 0.3, 0, 0, {
					color: '#99ddff', color2: '#ffffff', power: 24, width: 36, height: 36,
					shape: 'circle', effects: ['freeze'], trail: 'ice', maxAge: 8, _iceStyle: 'shard'
				});
				const dx = kit.x - (en.x + en.w / 2), dy = kit.y - 30 - (en.y + en.h / 2), d = Math.hypot(dx, dy) || 1;
				iceSpawn(en, en.x + en.w / 2, en.y + en.h * 0.3, dx / d * 9, dy / d * 9, {
					color: '#cceeff', color2: '#ffffff', power: 26, width: 42, height: 42,
					shape: 'circle', effects: ['freeze'], trail: 'ice', maxAge: 70, _iceStyle: 'shard'
				});
			}
		}
		if(kit.t > 70) iceEnd(en);
	}
}

function tickSentinel(en, kit){
	const aim = iceAim(en);
	if(kit.kind === 'movingFortress'){
		en.x += kit.dir * 1.35;
		const shieldW = atkS(70);
		const sx = en.x + (kit.dir > 0 ? en.w : -shieldW);
		const box = { x: sx, y: en.y, w: shieldW, h: en.h + 8 };
		if(!iceFriendly(en) && rectRect(box, player)){
			player.x += kit.dir * 2.2;
			iceDragSet(0.25);
			if(kit.t % 16 === 0) iceHit(en, player.x + player.w / 2, player.y + player.h / 2, 18, iceDmg(8), ['freeze']);
		}
		if(kit.t > 100) iceEnd(en);
	} else if(kit.kind === 'glacierHammer'){
		if(kit.t === 52){
			kit.swung = true;
			const hx = en.x + en.w / 2 + kit.dir * 130;
			iceHit(en, hx, en.y + en.h * 0.55, 70, iceDmg(24), ['freeze']);
			iceWorldFX.push({ kind: 'icewall', en, x: hx, y: en.y + en.h - 8, w: atkS(180), h: atkS(18), age: 0, max: 140 });
			if(typeof shakeScreen === 'function') shakeScreen(6, 10);
		}
		if(kit.t > 80) iceEnd(en);
	} else if(kit.kind === 'frozenOrbit'){
		for(let i = 0; i < kit.chunks.length; i++) if(!kit.chunks[i].gone) kit.chunks[i].ang += 0.035;
		if(kit.t >= kit.next && kit.launched < kit.chunks.length){
			const c = kit.chunks[kit.launched];
			c.gone = true;
			const cx = en.x + en.w / 2 + Math.cos(c.ang) * c.r;
			const cy = en.y + en.h / 2 + Math.sin(c.ang) * c.r * 0.7;
			const dx = aim.x - cx, dy = aim.y - cy, d = Math.hypot(dx, dy) || 1;
			iceSpawn(en, cx, cy, dx / d * 6.4, dy / d * 6.4, {
				color: '#aadfff', color2: '#ffffff', power: 18, width: 38, height: 38,
				shape: 'circle', effects: ['freeze'], trail: 'ice', maxAge: 110, _iceStyle: 'chunk'
			});
			kit.launched++; kit.next = kit.t + 36;
		}
		if(kit.launched >= kit.chunks.length && kit.t > kit.next + 8) iceEnd(en);
	} else if(kit.kind === 'absoluteGuard'){
		if(kit.t === 36) en._iceNoHit = false;
		if(kit.t === 100){
			en._iceGuard = false; en._iceNoHit = false; en._iceVulnerable = true;
			en.stunTimer = Math.max(en.stunTimer || 0, 70);
		}
		if(kit.t > 170){ en._iceVulnerable = false; iceEnd(en); }
	}
}

function updateIceDungeonWorld(){
	if(player._iceMark > 0){
		player._iceMark--;
		for(let i = iceWorldFX.length - 1; i >= 0; i--){
			const w = iceWorldFX[i];
			if(w.kind === 'warm' && Math.hypot(player.x + player.w / 2 - w.x, player.y + player.h - w.y) < w.r){
				player._iceMark = 0;
				iceSpark(w.x, w.y, 10);
			}
		}
	}
	if(player._iceWhiteout > 0) player._iceWhiteout--;
	if(player._iceSlip > 0){
		player._iceSlip--;
		player.vx += (player.facing || 1) * 0.18;
	}
	if(player._iceDrag) player._iceDrag *= 0.92;
	if(player._iceDrag < 0.04) player._iceDrag = 0;

	for(let i = iceWorldFX.length - 1; i >= 0; i--){
		const fx = iceWorldFX[i];
		fx.age++;
		if(fx.kind === 'icewall'){
			if(circRect(fx.x, fx.y, fx.w * 0.45, player.x, player.y, player.w, player.h)) iceDragSet(0.6);
			if(fx.age >= fx.max) iceWorldFX.splice(i, 1);
		} else if(fx.kind === 'echo'){
			if(fx.pending && fx.age === fx.copyAt) iceEchoReplay(fx);
			if(fx.age >= fx.max) iceWorldFX.splice(i, 1);
		} else if(fx.kind === 'warm'){
			if(fx.age >= fx.max) iceWorldFX.splice(i, 1);
		}
	}
}

function iceKitTryBounce(p){
	if(!p || !p._iceRicochet) return false;
	const prevX = p.x - p.vx, prevY = p.y - p.vy;
	let hitV = iceBlocked(p.x, prevY), hitH = iceBlocked(prevX, p.y);
	if(!hitV && !hitH){ hitV = true; hitH = true; }
	if(hitV){ p.vy = -p.vy; p.y = prevY; }
	if(hitH){ p.vx = -p.vx; p.x = prevX; }
	p._iceBounces = (p._iceBounces || 0) + 1;
	p.homing = true; p.homingStrength = 0.045;
	iceSpark(p.x, p.y, 8);
	if(p._iceBounces >= (p._iceBounceMax || 2)) p._iceRicochet = false;
	return true;
}

function iceEchoReplay(fx){
	const en = fx.en;
	if(!en || en.dead) return;
	const aim = iceAim(en);
	const ox = fx.x, oy = fx.y;
	const dx = aim.x - ox, dy = aim.y - oy, d = Math.hypot(dx, dy) || 1;
	if(fx.pending === 'frostGeometry' || fx.pending === 'iceEcho'){
		iceSpawn(en, ox, oy, dx / d * 6.6, dy / d * 6.6, {
			color: '#77ddff', color2: '#ffffff', power: 14, width: 28, height: 28,
			shape: 'spike', effects: ['freeze'], trail: 'ice', maxAge: 80, _iceStyle: 'shard'
		});
	} else if(fx.pending === 'temperatureShift'){
		iceSpawn(en, ox, oy - 10, 0, 6.5, {
			color: '#88eeff', color2: '#ffffff', power: 18, width: 36, height: 36,
			shape: 'circle', effects: ['freeze'], trail: 'ice', maxAge: 50, _iceStyle: 'shard'
		});
	} else {
		iceSpawn(en, ox, oy, dx / d * 7.4, dy / d * 7.4, {
			color: '#cceeff', color2: '#ffffff', power: 20, width: 38, height: 38,
			shape: 'circle', effects: ['freeze'], trail: 'ice', maxAge: 70, _iceStyle: 'shard'
		});
	}
	iceSpark(ox, oy, 10);
	fx.pending = null;
}

function iceKitOnEnemyHit(en){
	if(!en) return 1;
	let mult = 1;
	if(en._iceVulnerable) mult *= 1.6;
	if(en._iceArmor){
		const a = Math.random() * Math.PI * 2;
		iceSpawn(en, en.x + en.w / 2, en.y + en.h / 2, Math.cos(a) * 5.5, Math.sin(a) * 5.5, {
			color: '#cceeff', color2: '#ffffff', power: 10, width: 22, height: 22,
			shape: 'spike', effects: ['freeze'], trail: 'ice', maxAge: 50, _iceStyle: 'shard'
		});
	}
	return mult;
}

function iceKitReflectCheck(p, en){
	if(!en || !en._iceGuard || !p || p.hasHit) return false;
	const aim = iceAim(en);
	const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
	const dx = aim.x - ox, dy = aim.y - oy, d = Math.hypot(dx, dy) || 1;
	iceSpawn(en, ox, oy, dx / d * 6.2, dy / d * 6.2, {
		color: '#e8f6ff', color2: '#ffffff', power: 16, width: 30, height: 30,
		shape: 'circle', effects: ['freeze'], trail: 'ice', maxAge: 70, _iceStyle: 'chunk'
	});
	p.hasHit = true;
	iceSpark(p.x, p.y, 8);
	return true;
}

function iceKitBlockPlayerProj(p){
	if(!p || p.hasHit) return false;
	const pool = (typeof enemies !== 'undefined' ? enemies : []).concat(typeof playerMinions !== 'undefined' ? playerMinions : []);
	for(let i = 0; i < pool.length; i++){
		const en = pool[i];
		if(!en || en.dead || !en.iceKit || en.iceKit.kind !== 'frozenOrbit' || !en.iceKit.chunks) continue;
		for(let c = 0; c < en.iceKit.chunks.length; c++){
			const ch = en.iceKit.chunks[c];
			if(ch.gone) continue;
			const cx = en.x + en.w / 2 + Math.cos(ch.ang) * ch.r;
			const cy = en.y + en.h / 2 + Math.sin(ch.ang) * ch.r * 0.7;
			if(circRect(cx, cy, atkS(10), p.x - 4, p.y - 4, 8, 8)){
				p.hasHit = true;
				iceSpark(cx, cy, 6);
				return true;
			}
		}
	}
	return false;
}

function iceKitSpriteRow(en){
	const type = (en && (en.necroType || en.type)) || '';
	if(!ICE_KIT_TYPES[type]) return null;
	if(en.dead){
		const img = (typeof ENEMY_SPRITE_SHEETS !== 'undefined') ? ENEMY_SPRITE_SHEETS[type] : null;
		const g = iceKitSheetGrid(en, img);
		return g && g.rows === 8 ? 7 : 5;
	}
	if(en.iceKit && en.iceKit.row != null) return en.iceKit.row;
	return null;
}
function iceKitSheetGrid(en, img){
	if(typeof dungeonRegularKitGrid === 'function') return dungeonRegularKitGrid(en, img, ICE_KIT_TYPES);
	return null;
}

function drawIceKitProj(p){
	const px = p.x - camera.x, py = p.y - camera.y;
	const r = Math.max(p.width, p.height) * 0.58;
	const pulse = 0.5 + Math.sin((p.age || 0) * 0.32) * 0.5;
	const g = ctx.createRadialGradient(px - r * 0.2, py - r * 0.25, r * 0.1, px, py, r);
	g.addColorStop(0, 'rgba(255,255,255,0.96)');
	g.addColorStop(0.32, p.color2 || '#ddf6ff');
	g.addColorStop(0.72, p.color || '#77ccff');
	g.addColorStop(1, 'rgba(40,80,120,0)');
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.arc(px, py, r * (0.92 + pulse * 0.08), 0, Math.PI * 2); ctx.fill();
	ctx.strokeStyle = 'rgba(220,245,255,0.5)';
	ctx.lineWidth = 2;
	ctx.beginPath(); ctx.arc(px, py, r * 0.7, -0.8, 1.2); ctx.stroke();
}

function drawIceDungeonWorld(){
	for(let i = 0; i < iceWorldFX.length; i++){
		const fx = iceWorldFX[i];
		const x = fx.x - camera.x, y = fx.y - camera.y;
		if(fx.kind === 'warm'){
			ctx.save();
			ctx.globalAlpha = 0.35;
			const g = ctx.createRadialGradient(x, y, 4, x, y, fx.r);
			g.addColorStop(0, 'rgba(255,200,120,0.7)');
			g.addColorStop(1, 'rgba(255,140,40,0)');
			ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, fx.r, 0, Math.PI * 2); ctx.fill();
			ctx.restore();
		} else if(fx.kind === 'echo'){
			ctx.save();
			ctx.globalAlpha = 0.4;
			ctx.fillStyle = '#88ccff';
			ctx.fillRect(x - 12, y - 20, 24, 40);
			ctx.restore();
		} else if(fx.kind === 'icewall'){
			ctx.save();
			ctx.globalAlpha = 0.7 * (1 - fx.age / fx.max);
			ctx.fillStyle = '#b8e6ff';
			ctx.fillRect(x - fx.w / 2, y - 16, fx.w, 22);
			ctx.restore();
		}
	}
	if(typeof enemies !== 'undefined'){
		for(let i = 0; i < enemies.length; i++) drawIceEnemyFX(enemies[i]);
	}
	if(typeof playerMinions !== 'undefined'){
		for(let i = 0; i < playerMinions.length; i++) drawIceEnemyFX(playerMinions[i]);
	}
	if(player._iceMark > 0){
		const mx = player.x + player.w / 2 - camera.x, my = player.y - 12 - camera.y;
		ctx.save();
		ctx.strokeStyle = 'rgba(160,220,255,0.85)';
		ctx.lineWidth = 2;
		ctx.beginPath(); ctx.arc(mx, my, 10 + Math.sin(player._iceMark * 0.2) * 2, 0, Math.PI * 2); ctx.stroke();
		ctx.restore();
	}
}

function drawIceEnemyFX(en){
	if(!en || en.dead || !en.iceKit) return;
	const kit = en.iceKit;
	if(kit.kind === 'frozenReflection' && kit.clone){
		ctx.save();
		ctx.globalAlpha = 0.4;
		ctx.fillStyle = '#a8e0ff';
		ctx.fillRect(kit.clone.x - camera.x, kit.clone.y - camera.y, en.w, en.h);
		ctx.restore();
	}
	if(kit.kind === 'iceVeil' && kit.trail){
		ctx.save();
		ctx.strokeStyle = 'rgba(180,230,255,0.45)';
		ctx.lineWidth = 4; ctx.lineCap = 'round';
		ctx.beginPath();
		for(let i = 0; i < kit.trail.length; i++){
			const p = kit.trail[i];
			if(i === 0) ctx.moveTo(p.x - camera.x, p.y - camera.y);
			else ctx.lineTo(p.x - camera.x, p.y - camera.y);
		}
		ctx.stroke(); ctx.restore();
	}
	if(kit.kind === 'shardPossession' && kit.shards){
		for(let i = 0; i < kit.shards.length; i++){
			const s = kit.shards[i];
			ctx.fillStyle = i === kit.si ? '#ffffff' : '#88ccff';
			ctx.beginPath(); ctx.moveTo(s.x - camera.x, s.y - 22 - camera.y);
			ctx.lineTo(s.x - 7 - camera.x, s.y - camera.y); ctx.lineTo(s.x + 7 - camera.x, s.y - camera.y); ctx.fill();
		}
	}
	if(kit.kind === 'frozenMoment'){
		ctx.save();
		ctx.strokeStyle = 'rgba(160,220,255,0.7)';
		ctx.lineWidth = 3;
		ctx.beginPath(); ctx.arc(kit.cx - camera.x, kit.cy - camera.y, kit.r, 0, Math.PI * 2); ctx.stroke();
		ctx.fillStyle = 'rgba(140,200,255,0.12)';
		ctx.fill(); ctx.restore();
	}
	if(kit.kind === 'frostline' && kit.segs){
		ctx.save();
		ctx.strokeStyle = 'rgba(190,240,255,0.85)';
		ctx.lineWidth = 8; ctx.lineCap = 'round';
		ctx.beginPath();
		for(let i = 0; i < kit.segs.length; i++){
			const s = kit.segs[i];
			if(i === 0) ctx.moveTo(s.x - camera.x, s.y - camera.y);
			else ctx.lineTo(s.x - camera.x, s.y - camera.y);
		}
		ctx.stroke(); ctx.restore();
	}
	if(kit.kind === 'avalancheCharge'){
		const dir = kit.dir;
		ctx.save();
		ctx.globalAlpha = 0.45;
		ctx.fillStyle = '#e8f4ff';
		ctx.beginPath();
		ctx.ellipse(en.x + en.w / 2 + dir * 40 - camera.x, en.y + en.h - camera.y, kit.wave * 0.5, 16, 0, 0, Math.PI * 2);
		ctx.fill(); ctx.restore();
	}
	if(kit.kind === 'whiteoutRoar' && kit.prints){
		ctx.save();
		ctx.fillStyle = 'rgba(80,110,140,0.45)';
		for(let i = 0; i < kit.prints.length; i++){
			const p = kit.prints[i];
			ctx.fillRect(p.x - 10 - camera.x, p.y - 4 - camera.y, 20, 7);
		}
		ctx.restore();
	}
	if(kit.kind === 'frostGeometry' && kit.lines){
		ctx.save();
		for(let i = 0; i < kit.lines.length; i++){
			const L = kit.lines[i];
			ctx.fillStyle = L.wall ? 'rgba(190,230,255,0.72)' : 'rgba(160,210,255,0.28)';
			ctx.fillRect(L.x - 8 - camera.x, L.y - L.h - camera.y, 16, L.h);
		}
		ctx.restore();
	}
	if(kit.kind === 'temperatureShift'){
		ctx.save();
		const g = ctx.createRadialGradient(kit.cx - camera.x, kit.cy - camera.y, 20, kit.cx - camera.x, kit.cy - camera.y, kit.r);
		g.addColorStop(0, 'rgba(200,240,255,0.08)');
		g.addColorStop(0.55, 'rgba(140,200,255,0.22)');
		g.addColorStop(1, 'rgba(80,140,200,0.08)');
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(kit.cx - camera.x, kit.cy - camera.y, kit.r, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
	}
	if(kit.kind === 'crystalCoffin'){
		const half = atkS(48), h = atkS(52) * kit.grow;
		ctx.save();
		const x = kit.x - camera.x, y = kit.y - camera.y;
		ctx.strokeStyle = 'rgba(180,230,255,0.85)';
		ctx.lineWidth = 3;
		ctx.strokeRect(x - half, y - atkS(54), half * 2, atkS(54));
		ctx.fillStyle = 'rgba(180,230,255,' + (0.18 + kit.grow * 0.3) + ')';
		ctx.fillRect(x - half, y - h, 10, h);
		ctx.fillRect(x + half - 10, y - h, 10, h);
		ctx.fillRect(x - half, y - atkS(54), half * 2, 8 * kit.grow);
		ctx.fillRect(x - half, y - 8, half * 2, 8 * kit.grow);
		ctx.restore();
	}
	if(kit.kind === 'movingFortress'){
		const shieldW = atkS(70);
		const sx = en.x + (kit.dir > 0 ? en.w : -shieldW) - camera.x;
		ctx.save();
		ctx.globalAlpha = 0.7;
		ctx.fillStyle = '#c8eefe';
		ctx.fillRect(sx, en.y - camera.y, shieldW, en.h + 6);
		ctx.restore();
	}
	if(kit.kind === 'frozenOrbit' && kit.chunks){
		for(let i = 0; i < kit.chunks.length; i++){
			const c = kit.chunks[i];
			if(c.gone) continue;
			const cx = en.x + en.w / 2 + Math.cos(c.ang) * c.r - camera.x;
			const cy = en.y + en.h / 2 + Math.sin(c.ang) * c.r * 0.7 - camera.y;
			ctx.fillStyle = '#d0f0ff';
			ctx.beginPath(); ctx.arc(cx, cy, atkS(14), 0, Math.PI * 2); ctx.fill();
		}
	}
	if(kit.kind === 'absoluteGuard'){
		ctx.save();
		ctx.strokeStyle = 'rgba(200,240,255,0.85)';
		ctx.lineWidth = 5;
		ctx.beginPath(); ctx.arc(en.x + en.w / 2 - camera.x, en.y + en.h / 2 - camera.y, 48, 0, Math.PI * 2); ctx.stroke();
		ctx.restore();
	}
	if(en._iceArmor){
		ctx.save();
		ctx.globalAlpha = 0.4;
		ctx.strokeStyle = '#e8f6ff';
		ctx.lineWidth = 4;
		ctx.strokeRect(en.x - 4 - camera.x, en.y - 4 - camera.y, en.w + 8, en.h + 8);
		ctx.restore();
	}
}

function registerIceDungeonCasts(map){
	const casts = {
		castWraithFrozenReflection, castWraithIceVeil, castWraithShardPossession, castWraithFrozenMoment,
		castArcherRicochetArrow, castArcherFrostline, castArcherThreePointShot, castArcherHuntersMark,
		castBeastAvalancheCharge, castBeastFrostquake, castBeastIceback, castBeastWhiteoutRoar,
		castCryoFrostGeometry, castCryoTemperatureShift, castCryoIceEcho, castCryoCrystalCoffin,
		castSentinelMovingFortress, castSentinelGlacierHammer, castSentinelFrozenOrbit, castSentinelAbsoluteGuard
	};
	for(const k in casts){
		if(typeof window !== 'undefined') window[k] = casts[k];
		if(map) map[k] = casts[k];
	}
}
registerIceDungeonCasts(typeof CAST_FNS !== 'undefined' ? CAST_FNS : null);

if(typeof window !== 'undefined'){
	window.updateIceDungeonEnemy = updateIceDungeonEnemy;
	window.updateIceDungeonWorld = updateIceDungeonWorld;
	window.drawIceDungeonWorld = drawIceDungeonWorld;
	window.drawIceKitProj = drawIceKitProj;
	window.iceKitTryBounce = iceKitTryBounce;
	window.iceKitOnEnemyHit = iceKitOnEnemyHit;
	window.iceKitReflectCheck = iceKitReflectCheck;
	window.iceKitBlockPlayerProj = iceKitBlockPlayerProj;
	window.iceKitSpriteRow = iceKitSpriteRow;
	window.iceKitSheetGrid = iceKitSheetGrid;
	window.iceEnd = iceEnd;
	window.ICE_KIT_TYPES = ICE_KIT_TYPES;
	window.registerIceDungeonCasts = registerIceDungeonCasts;
}
