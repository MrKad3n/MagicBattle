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
	if(window.EFX){ const k = Math.min(n || 8, 16); EFX.emit('ice', x, y, Math.ceil(k * 0.6), { speed: 1.6 }); EFX.debris('ice', x, y, Math.ceil(k / 4), { speed: 4, kind: 'shard', scale: 0.7 }); return; }
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
		p._efxEl = 'ice';
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
				if(window.EFX) EFX.hit(t.x + t.w / 2, t.y + t.h / 2, 'ice', dmg);
				dmgNumbers.push({ x: t.x + t.w / 2, y: t.y - 10, text: Math.round(dmg) + '', age: 0, color: '#88ddff' });
				return true;
			}
		}
		return false;
	}
	if(player.iFrames > 0) return false;
	if(circRect(x, y, r, player.x, player.y, player.w, player.h)){
		if(window.EFX && EFX.armed(en, x, y, r)) return false;      // fair arming (enemy-fx.js)
		damagePlayer(dmg, effects || ['freeze']);
		if(window.EFX) EFX.hit(player.x + player.w / 2, player.y + player.h / 2, 'ice', dmg);
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
	if(window.EFX) EFX.charge(en.x + en.w / 2, en.y + en.h / 2, 'ice', Math.max(40, en.w * 1.3), 8, 18);
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
		tx: aim.x + (Math.random() < 0.5 ? -170 : 170),
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
		efxTelegraph(sx - 14, sy - 40, 28, 48, 40, 'rgba(140,200,255,0.3)', 'rect', '');
	}
	beginIceKit(en, 'shardPossession', { busy: true, shards, si: 0, next: 24 });
}
function castWraithFrozenMoment(en){
	const aim = iceAim(en);
	beginIceKit(en, 'frozenMoment', { busy: true, cx: aim.x, cy: aim.y, r: 20 });
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
	for(let i = 0; i < spots.length; i++) efxTelegraph(spots[i].x - 12, spots[i].y - 12, 24, 24, 16 + i * 4, 'rgba(160,220,255,0.42)', 'circle', '');
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
		efxTelegraph(x - 10, floor - 88, 20, 88, 36, 'rgba(140,200,255,0.22)', 'rect', '');
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
	efxTelegraph(en.x + (aim.x >= en.x ? en.w : -220), en.y + 10, 220, en.h, 50, 'rgba(140,200,255,0.28)', 'rect', '');
}
function castSentinelFrozenOrbit(en){
	const chunks = [];
	for(let i = 0; i < 4; i++) chunks.push({ ang: i * Math.PI / 2, r: atkS(70), gone: false });
	beginIceKit(en, 'frozenOrbit', { busy: true, chunks, launched: 0, next: 40 });
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
	else if(type === 'glacierSentinel') tickGlacierSentinel(en, kit);
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
		if(kit.t < 56){
			// the real wraith circles to the far side while its frozen reflection walks its old path
			const side = (kit.side = kit.side || (aim.x >= en.x + en.w / 2 ? 1 : -1));
			en.x += (aim.x + side * 170 - en.w / 2 - en.x) * 0.06;
			en.y += (aim.y - 60 - en.h / 2 - en.y) * 0.06;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
		}
		if(kit.t === 56){ kit.lock = { x: aim.x, y: aim.y }; en._iceHidden = false; }
		if(kit.t >= 64 && kit.t < 80 && kit.lock){
			// pincer: the wraith and its reflection lunge in from both sides
			const L = kit.lock;
			en.x += (L.x - en.w / 2 - en.x) * 0.22; en.y += (L.y - en.h / 2 - en.y) * 0.22;
			c.x += (L.x - en.w / 2 - c.x) * 0.22; c.y += (L.y - en.h / 2 - c.y) * 0.22;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
			if(!kit.hit1) kit.hit1 = iceHit(en, c.x + en.w / 2, c.y + en.h / 2, 26, iceDmg(16), ['freeze']);
			if(!kit.hit2) kit.hit2 = iceHit(en, en.x + en.w / 2, en.y + en.h / 2, 26, iceDmg(16), ['freeze']);
			if(kit.t === 79 && window.EFX){ EFX.burst(L.x, L.y, 'ice', 1.4); EFX.debris('ice', L.x, L.y, 6, { kind: 'shard', speed: 6 }); }
		}
		if(kit.t > 92) iceEnd(en);
	} else if(kit.kind === 'iceVeil'){
		en.x += ((kit.tx - en.w / 2) - en.x) * 0.07;
		en.y += ((kit.ty - en.h / 2) - en.y) * 0.07;
		if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
		if(kit.t % 5 === 0) kit.trail.push({ x: en.x + en.w / 2, y: en.y + en.h, age: 0 });
		if(window.EFX && kit.t < 60 && kit.t % 2 === 0){ EFX.smoke(en.x + en.w / 2, en.y + en.h / 2, 1, { size: 14, c: '#dff4ff', a: 0.45, rise: 0.2 }); EFX.mote('ice', en.x + en.w / 2, en.y + en.h / 2, 0, 0); }
		if(kit.t === 60){ en._iceHidden = false; kit.lock = { x: aim.x, y: aim.y }; if(window.EFX) EFX.smoke(en.x + en.w / 2, en.y + en.h / 2, 4, { size: 12, c: '#dff4ff', a: 0.5 }); }
		if(kit.t > 66 && kit.lock){
			// burst out of the mist straight through where the player stood
			const L = kit.lock, dx = L.x - (en.x + en.w / 2), dy = L.y - (en.y + en.h / 2), d = Math.hypot(dx, dy) || 1, sp = Math.min(d, 15);
			en.x += dx / d * sp; en.y += dy / d * sp;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
			if(!kit.hit) kit.hit = iceHit(en, en.x + en.w / 2, en.y + en.h / 2, 30, iceDmg(18), ['freeze']);
			if(d < 16 || kit.t > 96){ if(window.EFX) EFX.burst(en.x + en.w / 2, en.y + en.h / 2, 'ice', 1.2); iceEnd(en); }
		}
	} else if(kit.kind === 'shardPossession'){
		if(kit.t >= kit.next && kit.si < kit.shards.length){
			const s = kit.shards[kit.si];
			en.x = s.x - en.w / 2; en.y = s.y - en.h;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
			iceHit(en, s.x, s.y - 20, 38, iceDmg(14), ['freeze']);
			s.burst = kit.t;
			if(window.EFX){ EFX.burst(s.x, s.y - 18, 'ice', 1.3); EFX.debris('ice', s.x, s.y - 10, 7, { kind: 'shard', speed: 6, floor: s.y }); EFX.ring(s.x, s.y, 10, 70, 'ice', 18, { flat: 0.3, width: 4 }); }
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
			for(let k = -1; k <= 1; k++){
				const a2 = Math.atan2(aim.y - (en.y + en.h / 2), aim.x - (en.x + en.w / 2)) + k * 0.16;
				iceSpawn(en, en.x + en.w / 2, en.y + en.h / 2, Math.cos(a2) * 8, Math.sin(a2) * 8, {
					color: '#99eeff', color2: '#ffffff', power: 20, width: 30, height: 30,
					shape: 'circle', effects: ['freeze'], trail: 'ice', maxAge: 90, _iceStyle: 'shard'
				});
			}
			if(window.EFX) EFX.flash(en.x + en.w / 2, en.y + en.h / 2, 30, 'ice', 8);
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
			if(window.EFX){ EFX.flash(ox, oy, 18, 'ice', 6); EFX.sparks('ice', ox, oy, 4, { ang: Math.atan2(dy, dx), spread: 0.6, speed: 6 }); }
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
		if(window.EFX){
			if(kit.t % 2 === 0) EFX.smoke(wx, wy - 6, 2, { size: 10 + kit.wave * 0.12, c: '#eef8ff', a: 0.55, vx: dir * 2, spread: 2, rise: 1.4 });
			if(kit.t % 3 === 0) EFX.debris('ice', wx, wy - 4, 2, { kind: 'chunk', speed: 5, floor: wy + 10, ang: -Math.PI / 2 - dir * 0.6, spread: 1, scale: 0.8 });
		}
		if(kit.t > 54) iceEnd(en);
	} else if(kit.kind === 'frostquake'){
		if(kit.phase === 'jump'){
			// a heavy leap: rise, hang, slam
			if(kit.t === 1){ kit.y0 = en.y; }
			const u = Math.min(1, kit.t / 22);
			en.y = kit.y0 - Math.sin(u * Math.PI) * 120;
			if(kit.t === 22){
				en.y = kit.y0;
				kit.phase = 'land'; kit.waveT = 0; kit.waveI = 0; kit.waves = [];
				if(typeof shakeScreen === 'function') shakeScreen(9, 14);
				const fx = en.x + en.w / 2, fy = en.y + en.h;
				if(window.EFX){ EFX.burst(fx, fy - 10, 'ice', 1.8); EFX.groundWave(fx, fy, 160, 'ice', 24); EFX.debris('ice', fx, fy - 6, 10, { kind: 'chunk', speed: 7, floor: fy, spread: 2.4 }); EFX.smoke(fx, fy - 6, 5, { size: 16, c: '#eef8ff', a: 0.5, spread: 3 }); EFX.decal(fx, fy + 1, 60, 'ice', 200, { color: '#cfefff', glow: 0.4 }); }
			}
		} else {
			kit.waveT++;
			const fx = en.x + en.w / 2, fy = en.y + en.h;
			if(kit.waveI < 3 && kit.waveT >= (kit.waveI === 0 ? 1 : (kit.gaps[kit.waveI] || 20))){
				kit.waves.push({ r: 30, dmg: iceDmg(16 + kit.waveI * 4), hit: false });
				kit.waveI++; kit.waveT = 0;
			}
			// each wave is a wall of ice spikes racing outward along the floor — jump it
			for(let w = 0; w < kit.waves.length; w++){
				const W = kit.waves[w];
				W.r += 7.5;
				if(!W.hit && player.y + player.h > fy - 30){
					for(const sgn of [-1, 1]){
						if(!W.hit && iceHit(en, fx + sgn * W.r, fy - 16, 18, W.dmg, ['freeze'])) W.hit = true;
					}
				}
				if(window.EFX && kit.t % 2 === 0){ EFX.mote('ice', fx - W.r, fy - 6, 0, -1); EFX.mote('ice', fx + W.r, fy - 6, 0, -1); }
			}
			kit.fy = fy; kit.fx = fx;
			if(kit.waveI >= 3 && kit.waves.length && kit.waves[kit.waves.length - 1].r > 420) iceEnd(en);
		}
	} else if(kit.kind === 'iceback'){
		if(kit.t > 140){
			en._iceArmor = false;
			// the armour bursts off in a ring of shards
			for(let i = 0; i < 8; i++){
				const a = i / 8 * Math.PI * 2;
				iceSpawn(en, en.x + en.w / 2, en.y + en.h / 2, Math.cos(a) * 6, Math.sin(a) * 6, {
					color: '#cceeff', color2: '#ffffff', power: 12, width: 22, height: 22,
					shape: 'spike', effects: ['freeze'], trail: 'ice', maxAge: 60, _iceStyle: 'shard'
				});
			}
			if(window.EFX){ EFX.burst(en.x + en.w / 2, en.y + en.h / 2, 'ice', 1.8); EFX.debris('ice', en.x + en.w / 2, en.y + en.h / 2, 8, { kind: 'shard', speed: 7 }); }
			iceEnd(en);
		}
	} else if(kit.kind === 'whiteoutRoar'){
		if(kit.t % 8 === 0) kit.prints.push({ x: en.x + en.w / 2, y: en.y + en.h, age: 0 });
		if(kit.t < 80){
			// stalk through the blizzard, weaving closer
			const want = aim.x + Math.sin(kit.t * 0.09) * 160;
			en.x += Math.max(-4.2, Math.min(4.2, (want - en.w / 2 - en.x) * 0.06));
		}
		if(kit.t === 80){ kit.lock = { x: aim.x, y: iceFloorY(aim.x, aim.y) }; kit.y0 = en.y; kit.x0 = en.x + en.w / 2; en._iceHidden = false; if(window.EFX) EFX.alertFX(en.x + en.w / 2, en.y - 16, 'ice', 20); }
		if(kit.t > 86 && kit.t <= 104 && kit.lock){
			// a pouncing leap onto the locked spot
			const u = (kit.t - 86) / 18;
			en.x = kit.x0 + (kit.lock.x - kit.x0) * u - en.w / 2;
			en.y = kit.y0 - Math.sin(u * Math.PI) * 90;
			if(!kit.hit) kit.hit = iceHit(en, en.x + en.w / 2, en.y + en.h * 0.6, 34, iceDmg(26), ['freeze']);
			if(kit.t === 104){
				en.y = kit.y0;
				if(!kit.hit) iceHit(en, en.x + en.w / 2, en.y + en.h - 10, 56, iceDmg(20), ['freeze']);
				if(typeof shakeScreen === 'function') shakeScreen(8, 14);
				if(window.EFX){ EFX.burst(en.x + en.w / 2, en.y + en.h - 10, 'ice', 1.8); EFX.groundWave(en.x + en.w / 2, en.y + en.h, 120, 'ice'); EFX.smoke(en.x + en.w / 2, en.y + en.h - 6, 5, { size: 16, c: '#eef8ff', a: 0.55, spread: 3 }); }
			}
		}
		if(kit.t > 120) iceEnd(en);
	}
}

function tickCryo(en, kit){
	const aim = iceAim(en);
	if(kit.kind === 'frostGeometry'){
		for(let i = 0; i < kit.lines.length; i++){
			const L = kit.lines[i];
			L.h = Math.min(L.maxH, kit.t * 2.1);
			if(kit.t === 36 && window.EFX){ EFX.debris('ice', L.x, L.y - 6, 4, { kind: 'shard', speed: 5, floor: L.y }); EFX.flash(L.x, L.y - L.h * 0.5, 22, 'ice', 8); }
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
		if(kit.t < 60){ kit.cx += (aim.x - kit.cx) * 0.035; }
		const dist = Math.hypot(aim.x - kit.cx, aim.y - kit.cy);
		if(dist < kit.r){
			const t = dist / kit.r;
			if(t > 0.28) iceDragSet(0.15 + t * 0.6);
		}
		if(kit.t === 70){
			iceSpawn(en, kit.cx, kit.cy - 220, 0, 9, {
				color: '#88eeff', color2: '#ffffff', power: 22, width: 40, height: 40,
				shape: 'circle', effects: ['freeze'], trail: 'ice', maxAge: 50, _iceStyle: 'icicle'
			});
		}
		if(kit.t > 92) iceEnd(en);
	} else if(kit.kind === 'crystalCoffin'){
		kit.x += (aim.x - kit.x) * 0.04;
		kit.grow = Math.min(1, kit.t / 48);
		const half = atkS(46);
		const inside = Math.abs(aim.x - kit.x) < half && Math.abs(aim.y - kit.y) < atkS(50);
		if(kit.t === 52){
			kit.closed = inside;
			if(window.EFX){ EFX.flash(kit.x, kit.y - 30, 40, 'ice', 8); EFX.debris('ice', kit.x, kit.y - 30, 8, { kind: 'shard', speed: 5, floor: kit.y }); if(typeof shakeScreen === 'function') shakeScreen(4, 6); }
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

function tickGlacierSentinel(en, kit){
	const aim = iceAim(en);
	if(kit.kind === 'movingFortress'){
		en.x += kit.dir * (kit.t < 20 ? 0.6 : 3.2);
		if(window.EFX && kit.t % 4 === 0) EFX.smoke(en.x + en.w / 2 - kit.dir * en.w * 0.4, en.y + en.h - 4, 1, { size: 8, c: '#e8f6ff', a: 0.4 });
		const shieldW = atkS(70);
		const sx = en.x + (kit.dir > 0 ? en.w : -shieldW);
		const box = { x: sx, y: en.y, w: shieldW, h: en.h + 8 };
		if(!iceFriendly(en) && rectRect(box, player)){
			player.x += kit.dir * 2.2;
			iceDragSet(0.25);
			if(kit.t % 16 === 0) iceHit(en, player.x + player.w / 2, player.y + player.h / 2, 18, iceDmg(8), ['freeze']);
		}
		if(kit.t === 100){
			const bx = en.x + en.w / 2 + kit.dir * (en.w * 0.5 + 40);
			iceHit(en, bx, en.y + en.h * 0.5, 40, iceDmg(20), ['freeze']);
			if(window.EFX){ EFX.burst(bx, en.y + en.h * 0.5, 'ice', 1.4); EFX.debris('ice', bx, en.y + en.h * 0.5, 6, { kind: 'shard', speed: 6 }); }
		}
		if(kit.t > 108) iceEnd(en);
	} else if(kit.kind === 'glacierHammer'){
		if(kit.t < 40 && Math.abs(aim.x - (en.x + en.w / 2)) > 150) en.x += kit.dir * 2.2;
		if(kit.t === 52){
			kit.swung = true;
			const hx = en.x + en.w / 2 + kit.dir * 90, fy = iceFloorY(hx, en.y + en.h - 20);
			iceHit(en, hx, en.y + en.h * 0.55, 60, iceDmg(24), ['freeze']);
			// the hammer splits the floor: a ridge of ice spikes runs forward
			iceWorldFX.push({ kind: 'spikeLine', en, x: hx, y: fy, dir: kit.dir, len: 0, maxLen: 340, age: 0, max: 120, hit: false });
			if(window.EFX){ EFX.burst(hx, fy - 16, 'ice', 1.8); EFX.groundWave(hx, fy, 110, 'ice'); EFX.debris('ice', hx, fy - 6, 8, { kind: 'chunk', speed: 7, floor: fy }); }
			if(typeof shakeScreen === 'function') shakeScreen(7, 12);
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
			if(window.EFX){ EFX.flash(cx, cy, 24, 'ice', 7); EFX.sparks('ice', cx, cy, 5, { ang: Math.atan2(dy, dx), spread: 0.8, speed: 6 }); }
			kit.launched++; kit.next = kit.t + 26;
		}
		if(kit.launched >= kit.chunks.length && kit.t > kit.next + 8) iceEnd(en);
	} else if(kit.kind === 'absoluteGuard'){
		if(kit.t === 36) en._iceNoHit = false;
		if(kit.t === 100){
			iceHit(en, en.x + en.w / 2, en.y + en.h / 2, 80, iceDmg(18), ['freeze']);
			for(let i = 0; i < 10; i++){
				const a = i / 10 * Math.PI * 2;
				iceSpawn(en, en.x + en.w / 2, en.y + en.h / 2, Math.cos(a) * 5.5, Math.sin(a) * 5.5, {
					color: '#cceeff', color2: '#ffffff', power: 12, width: 22, height: 22,
					shape: 'spike', effects: ['freeze'], trail: 'ice', maxAge: 70, _iceStyle: 'shard'
				});
			}
			if(window.EFX){ EFX.burst(en.x + en.w / 2, en.y + en.h / 2, 'ice', 2.2); EFX.ring(en.x + en.w / 2, en.y + en.h / 2, 30, 150, 'ice', 22, { width: 6 }); EFX.debris('ice', en.x + en.w / 2, en.y + en.h / 2, 10, { kind: 'shard', speed: 7 }); }
			if(typeof shakeScreen === 'function') shakeScreen(6, 10);
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
		} else if(fx.kind === 'spikeLine'){
			if(fx.len < fx.maxLen){ fx.len += 12; if(window.EFX){ EFX.debris('ice', fx.x + fx.dir * fx.len, fx.y - 4, 1, { kind: 'shard', speed: 4, floor: fx.y }); } }
			if(!fx.hit && fx.age < 50){
				const lo = Math.min(fx.x, fx.x + fx.dir * fx.len), hi = Math.max(fx.x, fx.x + fx.dir * fx.len);
				const px = player.x + player.w / 2;
				if(px > lo - 10 && px < hi + 10 && player.y + player.h > fx.y - 50 && player.y < fx.y) fx.hit = iceHit(fx.en, px, fx.y - 20, 18, iceDmg(16), ['freeze']);
			}
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
	if(!window.EFX){
		const px = p.x - camera.x, py = p.y - camera.y, r = Math.max(p.width, p.height) * 0.5;
		ctx.fillStyle = p.color || '#88ccff'; ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
		return;
	}
	const st = p._iceStyle, r = Math.max(p.width, p.height) * 0.42;
	if(st === 'arrow' && p.width > p.height * 1.6){
		// a crystal arrow: long shaft, faceted head, frost fletching, thin trail
		const ang = Math.atan2(p.vy, p.vx), sx = p.x - camera.x, sy = p.y - camera.y, L = p.width * 0.9;
		const h = EFX.track(p, 8); EFX.trail(h, 4, 'ice', { alpha: 0.4 });
		ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang);
		ctx.globalCompositeOperation = 'lighter';
		EFX.glowS(L * 0.3, 0, 18, '#4aa6ff', 0.45);
		ctx.globalCompositeOperation = 'source-over';
		ctx.strokeStyle = '#d8f6ff'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
		ctx.beginPath(); ctx.moveTo(-L * 0.55, 0); ctx.lineTo(L * 0.3, 0); ctx.stroke();
		const g = ctx.createLinearGradient(L * 0.25, -6, L * 0.62, 6); g.addColorStop(0, '#7cc8ff'); g.addColorStop(1, '#ffffff');
		ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(L * 0.62, 0); ctx.lineTo(L * 0.26, -6); ctx.lineTo(L * 0.32, 0); ctx.lineTo(L * 0.26, 6); ctx.closePath(); ctx.fill();
		ctx.fillStyle = 'rgba(200,240,255,0.85)';
		for(const sg of [-1, 1]){ ctx.beginPath(); ctx.moveTo(-L * 0.38, 0); ctx.lineTo(-L * 0.6, sg * 6); ctx.lineTo(-L * 0.5, 0); ctx.closePath(); ctx.fill(); }
		ctx.globalCompositeOperation = 'lighter'; EFX.glowS(L * 0.55, 0, 6, '#ffffff', 0.9, true);
		ctx.restore();
		if(p.homing && (p.age & 1)) EFX.mote('ice', p.x, p.y, -p.vx, -p.vy);
		return;
	}
	if(st === 'icicle'){
		// a falling icicle, point down, with a ground warning
		const sx = p.x - camera.x, sy = p.y - camera.y, L = r * 2.4;
		const floor = p._floorY || (p._floorY = iceFloorY(p.x, p.y));
		EFX.warnCircle(p.x, floor, r * 1.6, Math.min(1, (p.age || 0) / 22), 'ice', { flat: 0.3 });
		ctx.save(); ctx.translate(sx, sy);
		const g = ctx.createLinearGradient(-r * 0.6, 0, r * 0.6, 0); g.addColorStop(0, '#4aa6ff'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#7cc8ff');
		ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-r * 0.6, -L * 0.5); ctx.lineTo(r * 0.6, -L * 0.5); ctx.lineTo(0, L * 0.6); ctx.closePath(); ctx.fill();
		ctx.globalCompositeOperation = 'lighter'; EFX.glowS(0, 0, r * 1.6, '#4aa6ff', 0.4);
		ctx.restore();
		return;
	}
	if(st === 'chunk'){
		EFX.bolt(p, p.x, p.y, r * 0.9, 'frost', { spin: 0.08, trailLen: 7 });
		return;
	}
	EFX.bolt(p, p.x, p.y, r * 0.8, 'ice', { trailLen: 8 });
}

function drawIceDungeonWorld(){
	if(!window.EFX) return;
	EFX.bind();
	for(let i = 0; i < iceWorldFX.length; i++){
		const fx = iceWorldFX[i];
		const u = fx.max ? fx.age / fx.max : 0;
		if(fx.kind === 'warm'){
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			EFX.glow(fx.x, fx.y, fx.r, '#ffb050', 0.35 * (1 - u));
			ctx.restore();
		} else if(fx.kind === 'echo'){
			// a hovering crystal totem that will replay the mage's next spell
			const bob = Math.sin(fx.age * 0.08) * 5, a = Math.min(1, fx.age / 15) * (u > 0.85 ? (1 - u) / 0.15 : 1);
			const sx = fx.x - camera.x, sy = fx.y - camera.y + bob;
			ctx.save(); ctx.globalAlpha = a;
			ctx.globalCompositeOperation = 'lighter'; EFX.glowS(sx, sy, 34, '#4aa6ff', 0.5 + (fx.pending ? 0.3 : 0));
			ctx.globalCompositeOperation = 'source-over';
			const g = ctx.createLinearGradient(sx - 10, 0, sx + 10, 0); g.addColorStop(0, '#4aa6ff'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#7cc8ff');
			ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx, sy - 24); ctx.lineTo(sx + 10, sy); ctx.lineTo(sx, sy + 20); ctx.lineTo(sx - 10, sy); ctx.closePath(); ctx.fill();
			ctx.strokeStyle = 'rgba(200,240,255,0.7)'; ctx.lineWidth = 1.5;
			ctx.beginPath(); ctx.ellipse(sx, sy, 20, 7, 0, fx.age * 0.06, fx.age * 0.06 + 4.5); ctx.stroke();
			ctx.restore();
			if(fx.age % 6 === 0) EFX.mote('ice', fx.x, fx.y, 0, 0);
		} else if(fx.kind === 'spikeLine'){
			const fade = u > 0.6 ? (1 - u) / 0.4 : 1;
			for(let d = 0; d <= fx.len; d += 22){
				const k = d / Math.max(1, fx.maxLen), grow = Math.min(1, (fx.len - d) / 40);
				const h = (34 + 22 * Math.sin(d * 0.21)) * (1 - k * 0.35) * grow;
				EFX.spike(fx.x + fx.dir * d, fx.y + 2, h, 16, 'ice', { lean: fx.dir * 0.12 * Math.sin(d), alpha: fade });
			}
		} else if(fx.kind === 'icewall'){
			const fade = 1 - u;
			for(let d = -fx.w / 2; d <= fx.w / 2; d += 20) EFX.spike(fx.x + d, fx.y + 8, 22 + 10 * Math.sin(d), 16, 'ice', { alpha: fade });
		}
	}
	if(typeof enemies !== 'undefined'){
		for(let i = 0; i < enemies.length; i++) drawIceEnemyFX(enemies[i]);
	}
	if(typeof playerMinions !== 'undefined'){
		for(let i = 0; i < playerMinions.length; i++) drawIceEnemyFX(playerMinions[i]);
	}
	if(player._iceMark > 0){
		// hunter's mark: a rotating reticle locked onto the player
		const mx = player.x + player.w / 2 - camera.x, my = player.y + player.h / 2 - camera.y, t = player._iceMark;
		const r = 26 + Math.sin(t * 0.2) * 3;
		ctx.save();
		ctx.strokeStyle = 'rgba(160,220,255,0.85)'; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.arc(mx, my, r, t * 0.05, t * 0.05 + 1.2); ctx.stroke();
		ctx.beginPath(); ctx.arc(mx, my, r, t * 0.05 + Math.PI, t * 0.05 + Math.PI + 1.2); ctx.stroke();
		for(let k = 0; k < 4; k++){ const a = k * Math.PI / 2; ctx.beginPath(); ctx.moveTo(mx + Math.cos(a) * (r + 4), my + Math.sin(a) * (r + 4)); ctx.lineTo(mx + Math.cos(a) * (r - 8), my + Math.sin(a) * (r - 8)); ctx.stroke(); }
		ctx.restore();
	}
}

function drawIceEnemyFX(en){
	if(!en || en.dead || !en.iceKit || !window.EFX) return;
	const kit = en.iceKit;
	const ecx = en.x + en.w / 2, ecy = en.y + en.h / 2;
	if(kit.kind === 'frozenReflection' && kit.clone){
		EFX.ghost(kit.clone.x + en.w / 2, kit.clone.y + en.h / 2, en.w, en.h, 'frost', 0.85, kit.t);
		if(kit.t % 3 === 0) EFX.mote('ice', kit.clone.x + en.w / 2, kit.clone.y + en.h / 2, 0, 0);
		if(kit.lock && kit.t < 64) EFX.warnCircle(kit.lock.x, kit.lock.y, 34, (kit.t - 56) / 8, 'ice');
	}
	if(kit.kind === 'iceVeil' && kit.lock && kit.t <= 66){
		EFX.warnLine(ecx, ecy, kit.lock.x, kit.lock.y, 28, (kit.t - 60) / 6, 'ice');
	}
	if(kit.kind === 'shardPossession' && kit.shards){
		for(let i = 0; i < kit.shards.length; i++){
			const s = kit.shards[i];
			if(i < kit.si) continue;
			const grow = Math.min(1, kit.t / 18), hot = i === kit.si;
			EFX.spike(s.x, s.y + 6, (30 + (hot ? 10 * Math.sin(kit.t * 0.5) : 0)) * grow, 18, 'ice', { lean: (i % 2 ? 0.15 : -0.15) });
			if(hot) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; EFX.glow(s.x, s.y - 14, 26, '#bdeeff', 0.4 + 0.3 * Math.sin(kit.t * 0.6)); ctx.restore(); }
		}
	}
	if(kit.kind === 'frozenMoment'){
		// a slowing dome of frozen air
		const sx = kit.cx - camera.x, sy = kit.cy - camera.y;
		ctx.save();
		const g = ctx.createRadialGradient(sx, sy, kit.r * 0.2, sx, sy, kit.r);
		g.addColorStop(0, 'rgba(200,240,255,0.05)'); g.addColorStop(0.8, 'rgba(140,200,255,0.12)'); g.addColorStop(1, 'rgba(220,245,255,0.3)');
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, kit.r, 0, Math.PI * 2); ctx.fill();
		ctx.strokeStyle = 'rgba(220,245,255,0.75)'; ctx.lineWidth = 2;
		ctx.setLineDash([3, 9]); ctx.lineDashOffset = kit.t * 0.6; ctx.beginPath(); ctx.arc(sx, sy, kit.r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
		ctx.restore();
		if(kit.t % 2 === 0){ const a = Math.random() * Math.PI * 2, d = Math.random() * kit.r; EFX.mote('ice', kit.cx + Math.cos(a) * d, kit.cy + Math.sin(a) * d, 0, 0); }
	}
	if(kit.kind === 'frostline' && kit.segs && kit.segs.length > 1){
		// a glassy sheet of ice with crystal tufts
		const a = kit.t > 55 ? (70 - kit.t) / 15 : 1;
		const first = kit.segs[0], last = kit.segs[kit.segs.length - 1];
		const x0 = Math.min(first.x, last.x) - 10, x1 = Math.max(first.x, last.x) + 10, y = first.y + 4;
		ctx.save(); ctx.globalAlpha = a;
		const g = ctx.createLinearGradient(0, y - camera.y - 8, 0, y - camera.y + 4);
		g.addColorStop(0, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(120,200,255,0.65)');
		ctx.fillStyle = g; ctx.fillRect(x0 - camera.x, y - 8 - camera.y, x1 - x0, 10);
		ctx.restore();
		for(let i = 0; i < kit.segs.length; i += 3) EFX.spike(kit.segs[i].x, y, 10 + (i * 7 % 9), 8, 'ice', { alpha: a, lean: ((i * 13) % 5 - 2) * 0.1 });
		if(kit.t % 4 === 0){ const s = kit.segs[(Math.random() * kit.segs.length) | 0]; EFX.mote('ice', s.x, y - 8, 0, 0); }
	}
	if(kit.kind === 'threePointShot' && kit.spots){
		for(let i = kit.fired; i < kit.spots.length; i++) EFX.warnCircle(kit.spots[i].x, kit.spots[i].y, 16, kit.t / (14 + i * 6), 'ice');
	}
	if(kit.kind === 'huntersMark' && kit.t < 8){
		EFX.charge(ecx, en.y + en.h * 0.4, 'ice', 30, 2, 8);
	}
	if(kit.kind === 'avalancheCharge'){
		// a rolling wall of snow ahead of the beast
		const dir = kit.dir, wx = ecx + dir * (en.w * 0.5 + kit.wave * 0.2), wy = en.y + en.h;
		ctx.save();
		for(let i = 0; i < 4; i++){
			const k = i / 3, r = kit.wave * (0.45 - k * 0.12);
			ctx.globalAlpha = 0.5 - k * 0.1;
			ctx.drawImage(EFX.smokeSprite('#f2faff'), wx + dir * k * kit.wave * 0.25 - camera.x - r, wy - r * 0.9 - camera.y - r * 0.3, r * 2, r * 1.6);
		}
		ctx.restore();
	}
	if(kit.kind === 'frostquake'){
		if(kit.phase === 'jump') EFX.warnCircle(ecx, (kit.y0 || en.y) + en.h, 120, kit.t / 22, 'ice', { flat: 0.25 });
		if(kit.waves){
			for(let w = 0; w < kit.waves.length; w++){
				const W = kit.waves[w];
				if(W.r > 440) continue;
				for(const sg of [-1, 1]){
					for(let k = 0; k < 3; k++) EFX.spike(kit.fx + sg * (W.r - k * 12), kit.fy + 2, (36 - k * 9) * (1 - W.r / 520), 16 - k * 3, 'ice', { lean: sg * 0.2 });
				}
			}
		}
	}
	if(kit.kind === 'whiteoutRoar'){
		if(kit.prints){
			ctx.save(); ctx.fillStyle = 'rgba(60,90,120,0.35)';
			for(let i = 0; i < kit.prints.length; i++){ const p = kit.prints[i]; ctx.beginPath(); ctx.ellipse(p.x - camera.x + (i % 2 ? 6 : -6), p.y - camera.y, 7, 3, 0, 0, Math.PI * 2); ctx.fill(); }
			ctx.restore();
		}
		if(kit.t % 2 === 0){ const vx = 6 + Math.random() * 4; EFX.add({ k: 'spark', x: camera.x + Math.random() * 1280, y: camera.y + Math.random() * 720, vx, vy: 1.5, drag: 1, size: 1.2, len: 2, c: '#ffffff', c2: '#dff4ff', max: 26 }); }
		if(kit.lock && kit.t < 86) EFX.warnCircle(kit.lock.x, kit.lock.y, 60, (kit.t - 80) / 6, 'ice', { flat: 0.3 });
	}
	if(kit.kind === 'frostGeometry' && kit.lines){
		for(let i = 0; i < kit.lines.length; i++){
			const L = kit.lines[i];
			if(L.h < 2) continue;
			EFX.spike(L.x - 6, L.y + 2, L.h * 0.85, 16, 'ice', { lean: -0.06, alpha: L.wall ? 1 : 0.6 });
			EFX.spike(L.x + 5, L.y + 2, L.h, 20, 'ice', { lean: 0.04, alpha: L.wall ? 1 : 0.6 });
		}
	}
	if(kit.kind === 'temperatureShift'){
		// a sinking cold front around the target — colder (slower) toward the rim
		const sx = kit.cx - camera.x, sy = kit.cy - camera.y, k = Math.min(1, kit.t / 20);
		ctx.save();
		const g = ctx.createRadialGradient(sx, sy, kit.r * 0.25, sx, sy, kit.r);
		g.addColorStop(0, 'rgba(255,200,140,0.08)'); g.addColorStop(0.3, 'rgba(160,215,255,0.06)'); g.addColorStop(1, 'rgba(140,200,255,' + (0.3 * k) + ')');
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, kit.r, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
		if(kit.t % 2 === 0){ const a = Math.random() * Math.PI * 2; EFX.mote('ice', kit.cx + Math.cos(a) * kit.r * 0.95, kit.cy + Math.sin(a) * kit.r * 0.95, 0, 0); }
		if(kit.t > 46 && kit.t < 70) EFX.warnCircle(kit.cx, kit.cy + 8, 34, (kit.t - 46) / 24, 'ice', { flat: 0.3 });
	}
	if(kit.kind === 'crystalCoffin'){
		// crystal walls grow up from both sides, then a lid seals it
		const half = atkS(48), H = atkS(56), g = kit.grow;
		const x = kit.x, y = kit.y + 4;
		if(!kit.closed || kit.t < 52){
			EFX.warnRect(x - half, y - H, half * 2, H, g, 'ice', { alpha: 0.7 });
			for(let k = 0; k < 3; k++){
				EFX.spike(x - half + k * 8, y, H * g * (1 - k * 0.15), 16, 'ice', { lean: 0.12 });
				EFX.spike(x + half - k * 8, y, H * g * (1 - k * 0.15), 16, 'ice', { lean: -0.12 });
			}
		} else {
			// sealed block
			const sx = x - camera.x, sy = y - camera.y;
			ctx.save();
			const gr = ctx.createLinearGradient(sx - half, sy - H, sx + half, sy);
			gr.addColorStop(0, 'rgba(180,230,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(120,190,255,0.55)');
			ctx.fillStyle = gr; ctx.fillRect(sx - half, sy - H, half * 2, H);
			ctx.strokeStyle = 'rgba(230,248,255,0.9)'; ctx.lineWidth = 2; ctx.strokeRect(sx - half, sy - H, half * 2, H);
			ctx.beginPath(); ctx.moveTo(sx - half, sy - H * 0.3); ctx.lineTo(sx - half * 0.3, sy - H); ctx.moveTo(sx + half * 0.2, sy); ctx.lineTo(sx + half, sy - H * 0.6); ctx.stroke();
			ctx.restore();
		}
	}
	if(kit.kind === 'movingFortress'){
		// a slab of glacier ice carried as a shield
		const shieldW = atkS(70), sx = en.x + (kit.dir > 0 ? en.w : -shieldW), sy = en.y - 6, H = en.h + 12;
		const X = sx - camera.x, Y = sy - camera.y;
		ctx.save();
		const g = ctx.createLinearGradient(X, 0, X + shieldW, 0);
		g.addColorStop(0, 'rgba(120,190,255,0.7)'); g.addColorStop(0.5, 'rgba(230,248,255,0.8)'); g.addColorStop(1, 'rgba(120,190,255,0.7)');
		ctx.fillStyle = g;
		ctx.beginPath(); ctx.moveTo(X + 6, Y); ctx.lineTo(X + shieldW - 4, Y + 8); ctx.lineTo(X + shieldW, Y + H - 4); ctx.lineTo(X + 2, Y + H); ctx.lineTo(X, Y + 10); ctx.closePath(); ctx.fill();
		ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5; ctx.stroke();
		ctx.beginPath(); ctx.moveTo(X + shieldW * 0.3, Y + 4); ctx.lineTo(X + shieldW * 0.5, Y + H * 0.5); ctx.lineTo(X + shieldW * 0.35, Y + H - 4); ctx.stroke();
		ctx.globalCompositeOperation = 'lighter'; EFX.glowS(X + shieldW / 2, Y + H / 2, shieldW, '#4aa6ff', 0.25);
		ctx.restore();
	}
	if(kit.kind === 'glacierHammer' && !kit.swung){
		const hx = ecx + kit.dir * 90, fy = iceFloorY(hx, en.y + en.h - 20);
		EFX.warnLine(hx, fy - 12, hx + kit.dir * 340, fy - 12, 26, kit.t / 52, 'ice');
		EFX.charge(ecx + kit.dir * 20, en.y + 4, 'ice', 40, 1, 12);
	}
	if(kit.kind === 'frozenOrbit' && kit.chunks){
		for(let i = 0; i < kit.chunks.length; i++){
			const c = kit.chunks[i];
			if(c.gone) continue;
			const cx = ecx + Math.cos(c.ang) * c.r, cy = ecy + Math.sin(c.ang) * c.r * 0.7;
			c.age = kit.t; c.x = cx; c.y = cy;
			EFX.bolt(c, cx, cy, atkS(11), 'frost', { spin: 0.06, trailLen: 5, ang: c.ang + Math.PI / 2 });
		}
	}
	if(kit.kind === 'absoluteGuard' || en._iceGuard){
		// a hexagonal crystal barrier
		const R = 54 + Math.sin(kit.t * 0.2) * 2, sx = ecx - camera.x, sy = ecy - camera.y, k = kit.t > 80 ? 0.5 + 0.5 * Math.sin(kit.t * 0.9) : 1;
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		EFX.glowS(sx, sy, R * 1.3, '#4aa6ff', 0.3 * k);
		ctx.strokeStyle = 'rgba(200,240,255,' + (0.8 * k) + ')'; ctx.lineWidth = 2.5;
		ctx.beginPath();
		for(let i = 0; i <= 6; i++){ const a = i / 6 * Math.PI * 2 + kit.t * 0.01; const x = sx + Math.cos(a) * R, y = sy + Math.sin(a) * R; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
		ctx.stroke();
		ctx.fillStyle = 'rgba(160,215,255,' + (0.12 * k) + ')'; ctx.fill();
		ctx.restore();
	}
	if(en._iceArmor){
		// frost crystals sprouting over the beast's back
		for(let i = 0; i < 5; i++) EFX.spike(en.x + en.w * (0.15 + i * 0.17), en.y + en.h * 0.35, 14 + (i % 2) * 8, 10, 'ice', { lean: (i - 2) * 0.15, alpha: 0.9 });
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
