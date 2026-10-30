/* =============================================================
   Fire Dungeon kit — Imp, Flame Serpent, Ember Mage,
   Magma Golem, Fire Sprite.
   Loaded after dungeon.html so spawnEnemyProj / damagePlayer exist.
   ============================================================= */

const FIRE_KIT_TYPES = { imp:1, flameSerpent:1, emberMage:1, magmaGolem:1, fireSprite:1 };
const FIRE_KIT_ROW = {
	imp: { emberOrbit:2, cinderFakeout:3, infernoPinball:2, wildfireTrail:3, recover:4 },
	flameSerpent: { burrowingFang:3, burningCoil:3, magmaFang:2, eruptionChase:3, recover:4 },
	emberMage: { fireSigil:2, reboundFlame:2, combustionMark:2, recover:4 },
	magmaGolem: { faultline:2, magmaCore:3, volcanicFists:2, moltenCollapse:3, recover:4 },
	fireSprite: { emberBlink:3, cometDive:2, emberMines:2, flickerSwarm:3, recover:4 }
};

const fireWorldFX = [];

function fireKitAim(en){
	if(en && (en.isNecroSummon || en.necroFriendly)){
		let best = null, bd = 1e9;
		const pool = (typeof enemies !== 'undefined' ? enemies : []).concat(typeof dummies !== 'undefined' ? dummies : []);
		for(let i = 0; i < pool.length; i++){
			const t = pool[i];
			if(!t || t.dead) continue;
			const d = Math.hypot(t.x + t.w / 2 - (en.x + en.w / 2), t.y + t.h / 2 - (en.y + en.h / 2));
			if(d < bd){ bd = d; best = t; }
		}
		if(best) return { x: best.x + best.w / 2, y: best.y + best.h / 2, vx: best.vx || 0, vy: best.vy || 0, box: best };
	}
	return {
		x: player.x + player.w / 2,
		y: player.y + player.h / 2,
		vx: player.vx || 0,
		vy: player.vy || 0,
		box: player
	};
}
function fireKitFriendly(en){
	return !!(en && (en.isNecroSummon || en.necroFriendly));
}
function atkS(n){
	return n * ((typeof ENEMY_ATK_SCALE === 'number') ? ENEMY_ATK_SCALE : 1.3);
}
function fireKitDmg(n){
	const diff = (typeof DIFF_DMG_MULT === 'number') ? DIFF_DMG_MULT : 1;
	return Math.round(n * 1.4 * diff);
}
function fireKitSpawn(en, x, y, vx, vy, opts){
	opts = opts || {};
	if(!opts.effects) opts.effects = ['burn'];
	if(!opts.trail) opts.trail = 'flame';
	const p = spawnEnemyProj(x, y, vx, vy, opts);
	if(p){
		p._fireStyle = opts._fireStyle || 'orb';
		p._efxEl = (p._fireStyle === 'glob' || p._fireStyle === 'drop' || p._fireStyle === 'erupt') ? 'magma' : 'fire';
		if(fireKitFriendly(en)){
			if(typeof markNecroFriendlyProj === 'function') markNecroFriendlyProj(p, en);
			else p.necroFriendly = true;
		}
	}
	return p;
}
function fireKitHit(en, x, y, r, dmg, effects){
	r = atkS(r);
	if(fireKitFriendly(en)){
		if(typeof necroScaleKitDmg === 'function') dmg = necroScaleKitDmg(en, dmg);
		const pool = (typeof enemies !== 'undefined' ? enemies : []).concat(typeof dummies !== 'undefined' ? dummies : []);
		for(let i = 0; i < pool.length; i++){
			const t = pool[i];
			if(!t || t.dead) continue;
			if(circRect(x, y, r, t.x, t.y, t.w, t.h)){
				t.hp -= dmg;
				t.flash = 8;
				dmgNumbers.push({ x: t.x + t.w / 2, y: t.y - 10, text: Math.round(dmg) + '', age: 0, color: '#ff8844' });
				if(window.EFX) EFX.hit(t.x + t.w / 2, t.y + t.h / 2, 'fire', dmg); else spawnImpact(x, y, '#ff6622');
				return true;
			}
		}
		return false;
	}
	if(player.iFrames > 0) return false;
	if(circRect(x, y, r, player.x, player.y, player.w, player.h)){
		if(window.EFX && EFX.armed(en, x, y, r)) return false;      // fair arming (enemy-fx.js)
		damagePlayer(dmg, effects || ['burn']);
		if(window.EFX) EFX.hit(player.x + player.w / 2, player.y + player.h / 2, 'fire', dmg); else spawnImpact(x, y, '#ff6622');
		return true;
	}
	return false;
}
function fireKitFloorY(x, fromY){
	const start = (fromY != null) ? fromY : 0;
	// the nearest surface below: solid tiles or a sandbox platform, whichever is higher
	let best = (typeof WORLD_H === 'number') ? WORLD_H - 8 : 2400;
	if(typeof TILE === 'number' && typeof MAP_ROWS === 'number' && typeof isSolid === 'function'){
		const col = Math.floor(x / TILE);
		const sr = Math.max(0, Math.floor(start / TILE));
		for(let r = sr; r < MAP_ROWS; r++){
			if(isSolid(col, r)){ best = Math.min(best, r * TILE); break; }
		}
	}
	if(typeof sandboxPlatforms !== 'undefined'){
		for(let i = 0; i < sandboxPlatforms.length; i++){
			const plat = sandboxPlatforms[i];
			if(!plat || plat.isWall || plat._gone) continue;
			if(x >= plat.x - 6 && x <= plat.x + plat.w + 6 && plat.y >= start - 30 && plat.y < best) best = plat.y;
		}
	}
	return best;
}
function fireKitBlocked(x, y){
	if(typeof TILE === 'number' && typeof isSolid === 'function' && isSolid(Math.floor(x / TILE), Math.floor(y / TILE))) return true;
	if(typeof sandboxPlatforms !== 'undefined'){
		for(let i = 0; i < sandboxPlatforms.length; i++){
			const plat = sandboxPlatforms[i];
			if(!plat || plat._gone) continue;
			if(x > plat.x && x < plat.x + plat.w && y > plat.y && y < plat.y + plat.h) return true;
		}
	}
	return false;
}
function fireKitSpark(x, y, n, color){
	if(window.EFX){
		const c = color || { r: 255, g: 120, b: 40 };
		const k = Math.min(n || 8, 18);
		if(c.r + c.g + c.b < 260){ EFX.smoke(x, y, Math.max(1, k / 4 | 0), { size: 10, c: '#2a1a12', a: 0.55 }); EFX.emit('fire', x, y, k / 3 | 0, { speed: 1.5 }); return; }
		EFX.emit('fire', x, y, Math.ceil(k * 0.6), { speed: 1.6 });
		EFX.sparks('fire', x, y, Math.ceil(k * 0.4), { speed: 4.5, up: 1 });
		return;
	}
	if(typeof particles === 'undefined') return;
	const c = color || { r: 255, g: 120, b: 40 };
	const count = Math.min(n || 8, 18);
	for(let i = 0; i < count; i++){
		const a = Math.random() * Math.PI * 2;
		const s = 1.2 + Math.random() * 4.5;
		particles.push({
			x: x + (Math.random() - 0.5) * 10,
			y: y + (Math.random() - 0.5) * 10,
			vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.2,
			life: 14 + Math.random() * 16, maxLife: 30,
			r: 1.6 + Math.random() * 2.4, color: c
		});
	}
}
function fireKitGeyser(en, x, floor, h, max){
	fireKitPushFX({ kind: 'geyser', en, x, floor, h: h || 90, age: 0, max: max || 30 });
	if(window.EFX){
		EFX.flash(x, floor - 10, 40, 'magma', 10);
		EFX.groundWave(x, floor, 60, 'magma', 20);
		EFX.debris('magma', x, floor - 6, 6, { speed: 7, floor: floor, spread: 1.3 });
		EFX.sparks('magma', x, floor - 10, 8, { ang: -Math.PI / 2, spread: 1.1, speed: 9, g: 0.25 });
		EFX.decal(x, floor + 1, 34, 'magma', 150);
	}
}
function fireKitPushFX(fx){
	fireWorldFX.push(fx);
	return fx;
}
function fireKitEnd(en){
	if(!en) return;
	en.fireKit = null;
	en._fireKitBusy = false;
	en._fireHidden = false;
	en._fireNoHit = false;
	en._fireCoreOpen = false;
	if(en._fireSavedW){ en.w = en._fireSavedW; en.h = en._fireSavedH; en._fireSavedW = 0; }
}

function beginFireKit(en, kind, extra){
	const type = en.necroType || en.type;
	const rows = FIRE_KIT_ROW[type] || {};
	en.fireKit = Object.assign({
		kind, t: 0, type, row: rows[kind] != null ? rows[kind] : 2
	}, extra || {});
	en._fireKitBusy = extra && extra.busy === false ? false : true;
	en.attackAnimTimer = Math.max(en.attackAnimTimer || 0, 48);
	en.facing = fireKitAim(en).x >= en.x + en.w / 2 ? 1 : -1;
	if(window.EFX) EFX.charge(en.x + en.w / 2, en.y + en.h / 2, (type === 'magmaGolem' || type === 'flameSerpent') ? 'magma' : 'fire', Math.max(40, en.w * 1.3), 8, 18);
	return en.fireKit;
}

/* ---------- IMP ---------- */
function castImpEmberOrbit(en){
	const kit = beginFireKit(en, 'emberOrbit', { busy: true, launchAt: 96, orbs: [] });
	const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
	for(let i = 0; i < 3; i++){
		kit.orbs.push({ ang: i * (Math.PI * 2 / 3), r: atkS(42), x: cx, y: cy });
	}
	const aim = fireKitAim(en);
	const away = Math.atan2(cy - aim.y, cx - aim.x);
	kit.strafeA = away + (Math.random() < 0.5 ? 0.7 : -0.7);
	fireKitSpark(cx, cy, 12);
}
function castImpCinderFakeout(en){
	const aim = fireKitAim(en);
	const ang = Math.atan2(aim.y - (en.y + en.h / 2), aim.x - (en.x + en.w / 2));
	beginFireKit(en, 'cinderFakeout', {
		busy: true, phase: 'dash',
		dashVx: Math.cos(ang) * 11, dashVy: Math.sin(ang) * 7,
		sil: null
	});
}
function castImpInfernoPinball(en){
	const aim = fireKitAim(en);
	const d = Math.hypot(aim.x - (en.x + en.w / 2), aim.y - (en.y + en.h / 2)) || 1;
	const spd = 5.2;
	const p = fireKitSpawn(en, en.x + en.w / 2, en.y + en.h / 2,
		(aim.x - (en.x + en.w / 2)) / d * spd,
		(aim.y - (en.y + en.h / 2)) / d * spd, {
			color: '#ff3a00', color2: '#ffdd66', power: 22, width: 46, height: 46,
			shape: 'circle', effects: ['burn'], trail: 'flame', rotSpeed: 0.22, maxAge: 280,
			_destroysSolid: true, _fireStyle: 'pinball'
		});
	if(p){ p._firePinball = true; p._pinBounces = 0; }
	beginFireKit(en, 'infernoPinball', { busy: false });
	en.attackAnimTimer = 40;
	fireKitSpark(en.x + en.w / 2, en.y + en.h / 2, 10);
	if(typeof shakeScreen === 'function') shakeScreen(3, 6);
	setTimeout(function(){ if(en && en.fireKit && en.fireKit.kind === 'infernoPinball') fireKitEnd(en); }, 400);
}
function castImpWildfireTrail(en){
	const aim = fireKitAim(en);
	const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
	const pts = [];
	const box = 150 + Math.random() * 40;
	pts.push({ x: aim.x - box, y: Math.min(aim.y - 30, cy) });
	pts.push({ x: aim.x - box, y: aim.y + 70 });
	pts.push({ x: aim.x + box, y: aim.y + 70 });
	pts.push({ x: aim.x + box, y: aim.y - 80 });
	pts.push({ x: cx, y: cy });
	beginFireKit(en, 'wildfireTrail', { busy: true, pts, pi: 0, lastDrop: 0 });
}

/* ---------- SERPENT ---------- */
function castSerpentBurrowingFang(en){
	const aim = fireKitAim(en);
	const floor = fireKitFloorY(aim.x, en.y);
	const passX = aim.x + (aim.x >= en.x + en.w / 2 ? 160 : -160);
	beginFireKit(en, 'burrowingFang', {
		busy: true, phase: 'dive',
		path: [
			{ x: en.x + en.w / 2, y: floor - 2 },
			{ x: passX, y: floor - 2 },
			{ x: aim.x - (passX - aim.x) * 0.35, y: floor - 2 }
		],
		pi: 0, glow: [], eruptX: aim.x, floor
	});
	en._fireHidden = true;
	en._fireNoHit = true;
}
function castSerpentBurningCoil(en){
	const aim = fireKitAim(en);
	beginFireKit(en, 'burningCoil', {
		busy: true, phase: 'form',
		cx: aim.x, cy: aim.y, r: atkS(108), segs: 14, ignited: false
	});
}
function castSerpentMagmaFang(en){
	const aim = fireKitAim(en);
	const ox = en.x + en.w * (en.facing > 0 ? 0.85 : 0.15);
	const oy = en.y + en.h * 0.25;
	const lead = 70;
	const spots = [
		{ x: aim.x, y: aim.y },
		{ x: aim.x + aim.vx * 10 + (aim.vx >= 0 ? lead : -lead), y: aim.y + aim.vy * 8 },
		{ x: aim.x - (aim.vx >= 0 ? lead : -lead) * 0.85, y: aim.y - 8 }
	];
	for(let i = 0; i < spots.length; i++){
		const dx = spots[i].x - ox, dy = spots[i].y - oy;
		const d = Math.hypot(dx, dy) || 1;
		setTimeout(function(){
			if(en.dead) return;
			fireKitSpawn(en, ox, oy, dx / d * 6.4, dy / d * 6.4 - 0.4, {
				color: '#e85a00', color2: '#ffcc44', power: 20, width: 36, height: 36,
				shape: 'circle', effects: ['burn'], trail: 'flame', gravity: 0.07, maxAge: 150,
				_fireStyle: 'glob'
			});
			efxTelegraph(spots[i].x - 22, spots[i].y - 22, 44, 44, 28, 'rgba(255,90,0,0.28)', 'circle', '');
		}, i * 90);
	}
	beginFireKit(en, 'magmaFang', { busy: false });
	en.attackAnimTimer = 50;
	setTimeout(function(){ if(en && en.fireKit && en.fireKit.kind === 'magmaFang') fireKitEnd(en); }, 420);
}
function castSerpentEruptionChase(en){
	const floor = fireKitFloorY(en.x + en.w / 2, en.y);
	beginFireKit(en, 'eruptionChase', {
		busy: true, floor, pops: 0, nextPop: 50, maxPops: 4, lastX: fireKitAim(en).x
	});
	en._fireHidden = true;
	en._fireNoHit = true;
}

/* ---------- EMBER MAGE ---------- */
function castEmberFireSigil(en){
	const aim = fireKitAim(en);
	const r = 150;
	const pts = [];
	for(let i = 0; i < 3; i++){
		const a = -Math.PI / 2 + i * (Math.PI * 2 / 3) + 0.18;
		pts.push({ x: aim.x + Math.cos(a) * r, y: aim.y + Math.sin(a) * r * 0.72, glow: 0 });
	}
	beginFireKit(en, 'fireSigil', { busy: true, pts, linked: false, warped: false });
	for(let i = 0; i < pts.length; i++){
		efxTelegraph(pts[i].x - 18, pts[i].y - 18, 36, 36, 70, 'rgba(255,120,20,0.3)', 'circle', '◆');
	}
}
function castEmberReboundFlame(en){
	const aim = fireKitAim(en);
	const n = 2;
	for(let i = 0; i < n; i++){
		setTimeout(function(){
			if(en.dead) return;
			const ox = en.x + en.w / 2, oy = en.y + en.h * 0.28;
			const ang = Math.atan2(aim.y - oy, aim.x - ox) + (i === 0 ? -0.18 : 0.22);
			const p = fireKitSpawn(en, ox, oy, Math.cos(ang) * 3.4, Math.sin(ang) * 3.4, {
				color: '#ff5511', color2: '#ffee88', power: 18, width: 40, height: 40,
				shape: 'circle', effects: ['burn'], trail: 'flame', rotSpeed: 0.12, maxAge: 260,
				_fireStyle: 'rebound'
			});
			if(p){ p._fireRebound = true; p._rebounds = 0; }
		}, i * 220);
	}
	beginFireKit(en, 'reboundFlame', { busy: false });
	en.attackAnimTimer = 48;
	setTimeout(function(){ if(en && en.fireKit && en.fireKit.kind === 'reboundFlame') fireKitEnd(en); }, 500);
}
function castEmberCombustionMark(en){
	const aim = fireKitAim(en);
	beginFireKit(en, 'combustionMark', {
		busy: false, x: aim.x, y: fireKitFloorY(aim.x, aim.y) - 4, follow: 110, boom: false
	});
	en.attackAnimTimer = 40;
}

/* ---------- MAGMA GOLEM ---------- */
function castGolemFaultline(en){
	const aim = fireKitAim(en);
	const sx = en.x + en.w / 2, sy = fireKitFloorY(sx, en.y + en.h) - 2;
	const cracks = fireBuildCracks(sx, sy, aim.x, fireKitFloorY(aim.x, aim.y) - 2);
	beginFireKit(en, 'faultline', { busy: true, cracks, phase: 'grow', grow: 0 });
	if(typeof shakeScreen === 'function') shakeScreen(8, 14);
}
function fireBuildCracks(sx, sy, tx, ty){
	const cracks = [];
	const main = [];
	const steps = 8;
	for(let i = 0; i <= steps; i++){
		const t = i / steps;
		main.push({
			x: sx + (tx - sx) * t + (Math.random() - 0.5) * 18,
			y: sy + (ty - sy) * t
		});
	}
	cracks.push(main);
	for(let b = 0; b < 3; b++){
		const from = 2 + b * 2;
		if(from >= main.length - 1) continue;
		const origin = main[from];
		const branch = [origin];
		const dir = (b % 2 ? 1 : -1);
		for(let k = 1; k <= 4; k++){
			branch.push({
				x: origin.x + dir * k * 36 + (Math.random() - 0.5) * 12,
				y: origin.y + k * 4
			});
		}
		cracks.push(branch);
	}
	return cracks;
}
function castGolemMagmaCore(en){
	beginFireKit(en, 'magmaCore', { busy: true, phase: 'open', dropT: 0 });
	en._fireCoreOpen = true;
}
function castGolemVolcanicFists(en){
	const aim = fireKitAim(en);
	const a = { x: aim.x, y: fireKitFloorY(aim.x, aim.y) };
	const b = { x: aim.x + (aim.vx >= 0 ? 130 : -130), y: fireKitFloorY(aim.x + 130, aim.y) };
	beginFireKit(en, 'volcanicFists', { busy: true, a, b, phase: 'tell' });
}
function castGolemMoltenCollapse(en){
	beginFireKit(en, 'moltenCollapse', { busy: true, phase: 'crack', pieces: [] });
}

/* ---------- FIRE SPRITE ---------- */
function castSpriteEmberBlink(en){
	const aim = fireKitAim(en);
	const spots = [];
	for(let i = 0; i < 3; i++){
		spots.push({
			x: aim.x + (Math.random() - 0.5) * 260,
			y: aim.y - 40 - Math.random() * 90
		});
	}
	spots.push({
		x: aim.x + (Math.random() < 0.5 ? -90 : 90),
		y: aim.y - 50
	});
	beginFireKit(en, 'emberBlink', { busy: true, spots, si: 0, next: 8 });
}
function castSpriteCometDive(en){
	beginFireKit(en, 'cometDive', { busy: true, phase: 'rise' });
}
function castSpriteEmberMines(en){
	const aim = fireKitAim(en);
	// five mines are tossed in an arc and settle in a field around the player
	const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
	for(let i = 0; i < 5; i++){
		const tx = aim.x + (i - 2) * 70 + (Math.random() - 0.5) * 20;
		const floor = fireKitFloorY(tx, aim.y - 40) - 16;
		const T = 34 + i * 4, vx = (tx - ox) / T, vy = (floor - oy) / T - 0.5 * 0.32 * T;
		fireKitPushFX({
			kind: 'mine', en, age: 0, armed: T + 40, dead: false,
			x: ox, y: oy, vx, vy, floor, flying: true, r: atkS(14), chasing: false
		});
	}
	beginFireKit(en, 'emberMines', { busy: false });
	en.attackAnimTimer = 36;
	setTimeout(function(){ if(en && en.fireKit && en.fireKit.kind === 'emberMines') fireKitEnd(en); }, 360);
	fireKitSpark(en.x + en.w / 2, en.y + en.h / 2, 10, { r: 255, g: 200, b: 80 });
}
function castSpriteFlickerSwarm(en){
	const copies = [];
	for(let i = 0; i < 4; i++){
		copies.push({
			x: en.x + (Math.random() - 0.5) * 180,
			y: en.y + (Math.random() - 0.5) * 100,
			vx: (Math.random() - 0.5) * 3.4,
			vy: (Math.random() - 0.5) * 2.6,
			life: 110 + i * 12
		});
	}
	beginFireKit(en, 'flickerSwarm', { busy: true, copies, flashT: 0 });
}

/* ---------- per-enemy tick ---------- */
function updateFireDungeonEnemy(en){
	const kit = en.fireKit;
	if(!kit){
		en._fireKitBusy = false;
		return false;
	}
	kit.t++;
	const type = kit.type || en.necroType || en.type;
	if(type === 'imp') tickImpKit(en, kit);
	else if(type === 'flameSerpent') tickSerpentKit(en, kit);
	else if(type === 'emberMage') tickMageKit(en, kit);
	else if(type === 'magmaGolem') tickGolemKit(en, kit);
	else if(type === 'fireSprite') tickSpriteKit(en, kit);
	else fireKitEnd(en);
	return !!en._fireKitBusy;
}

function tickImpKit(en, kit){
	const aim = fireKitAim(en);
	if(kit.kind === 'emberOrbit'){
		const want = kit.t < 50 ? 42 : 68;
		kit.strafeA += 0.012;
		en.x += Math.cos(kit.strafeA) * 2.15;
		en.y += Math.sin(kit.strafeA * 1.4) * 1.15;
		if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
		const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
		for(let i = 0; i < kit.orbs.length; i++){
			const o = kit.orbs[i];
			o.r += (want - o.r) * 0.08;
			o.ang += 0.085;
			o.x = cx + Math.cos(o.ang) * o.r;
			o.y = cy + Math.sin(o.ang) * o.r * 0.72;
			if(kit.t % 4 === 0) fireKitSpark(o.x, o.y, 1, { r: 255, g: 140, b: 40 });
		}
		if(kit.t === 70) kit.lock = { x: aim.x, y: aim.y };
		if(kit.t === kit.launchAt){
			const lock = kit.lock || aim;
			for(let i = 0; i < kit.orbs.length; i++){
				const o = kit.orbs[i];
				const dx = lock.x - o.x, dy = lock.y - o.y;
				const d = Math.hypot(dx, dy) || 1;
				if(window.EFX) EFX.flash(o.x, o.y, 22, 'fire', 7);
				fireKitSpawn(en, o.x, o.y, dx / d * 7.2, dy / d * 7.2, {
					color: '#ff4400', color2: '#ffcc55', power: 16, width: 32, height: 32,
					shape: 'circle', effects: ['burn'], trail: 'flame', maxAge: 90, _fireStyle: 'orb'
				});
			}
			kit.orbs = [];
			if(typeof shakeScreen === 'function') shakeScreen(4, 8);
		}
		if(kit.t > kit.launchAt + 12) fireKitEnd(en);
	} else if(kit.kind === 'cinderFakeout'){
		if(kit.phase === 'dash'){
			en.x += kit.dashVx; en.y += kit.dashVy;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
			if(kit.t >= 16){
				kit.phase = 'vanish';
				en._fireHidden = true;
				kit.sil = fireKitPushFX({
					kind: 'silhouette', en, age: 0, max: 28,
					x: en.x, y: en.y, w: en.w, h: en.h,
					vx: kit.dashVx * 0.92, vy: kit.dashVy * 0.55, facing: en.facing
				});
				const behind = aim.x >= en.x + en.w / 2 ? -1 : 1;
				en.x = aim.x + behind * 90 - en.w / 2;
				en.y = aim.y - 150;
				kit.target = { x: aim.x, y: fireKitFloorY(aim.x, aim.y) - 4 };
				if(window.EFX) EFX.smoke(en.x + en.w / 2, en.y + en.h / 2, 3, { size: 12, c: '#2a1a12', a: 0.6 });
				if(typeof unstuckFromTiles === 'function') unstuckFromTiles(en);
				if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
				fireKitSpark(en.x + en.w / 2, en.y + en.h / 2, 14, { r: 80, g: 40, b: 20 });
			}
		} else if(kit.phase === 'vanish' && kit.t >= 28){
			kit.phase = 'dive';
			en._fireHidden = false;
		} else if(kit.phase === 'dive'){
			// swoop onto the spot the player stood on when the imp vanished
			const tg = kit.target || { x: aim.x, y: aim.y };
			const dx = tg.x - (en.x + en.w / 2), dy = tg.y - (en.y + en.h);
			const d = Math.hypot(dx, dy) || 1, sp = Math.min(d, 13);
			en.x += dx / d * sp; en.y += dy / d * sp;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
			if(window.EFX && kit.t % 2 === 0) EFX.emit('fire', en.x + en.w / 2, en.y + en.h / 2, 2, { speed: 1 });
			if(!kit.slammed) fireKitHit(en, en.x + en.w / 2, en.y + en.h * 0.6, 30, fireKitDmg(20), ['burn']);
			if(!kit.slammed && d < 14){
				kit.slammed = true;
				if(window.EFX){ EFX.burst(tg.x, tg.y, 'fire', 1.3, { shake: 4 }); EFX.groundWave(tg.x, tg.y + 4, 70, 'fire'); EFX.decal(tg.x, tg.y + 5, 30, 'fire', 140); }
				fireKitHit(en, tg.x, tg.y - 14, 40, fireKitDmg(16), ['burn']);
				kit.endAt = kit.t + 10;
			}
			if(kit.t >= 70 || (kit.endAt && kit.t >= kit.endAt)) fireKitEnd(en);
		}
	} else if(kit.kind === 'wildfireTrail'){
		const dest = kit.pts[kit.pi];
		if(!dest){ fireKitEnd(en); return; }
		const dx = dest.x - (en.x + en.w / 2), dy = dest.y - (en.y + en.h / 2);
		const d = Math.hypot(dx, dy) || 1;
		en.x += dx / d * 6.2;
		en.y += dy / d * 6.2;
		if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
		// one burning patch per ~patch width travelled (every 5 frames they overlapped 2:1 and doubled the drawing)
		if(kit.t - kit.lastDrop >= 9){
			kit.lastDrop = kit.t;
			const fx = en.x + en.w / 2, fy = fireKitFloorY(en.x + en.w / 2, en.y + en.h);
			fireKitPushFX({ kind: 'trail', en, x: fx, y: fy - 6, w: atkS(56), h: atkS(16), age: 0, max: 160, hitCd: 0 });
			if(window.EFX) EFX.decal(fx, fy + 1, atkS(32), 'fire', 170, { glow: 0.35 });
			fireKitSpark(fx, fy - 8, 3);
		}
		if(d < 16) kit.pi++;
		if(kit.pi >= kit.pts.length){
			const adx = aim.x - (en.x + en.w / 2), ady = aim.y - (en.y + en.h / 2);
			const ad = Math.hypot(adx, ady) || 1;
			fireKitSpawn(en, en.x + en.w / 2, en.y + en.h / 2, adx / ad * 8.4, ady / ad * 8.4, {
				color: '#ff2200', color2: '#ffaa33', power: 22, width: 38, height: 38,
				shape: 'circle', effects: ['burn'], trail: 'flame', maxAge: 100, _fireStyle: 'bolt'
			});
			fireKitEnd(en);
		}
	}
}

function tickSerpentKit(en, kit){
	const aim = fireKitAim(en);
	if(kit.kind === 'burrowingFang'){
		if(kit.t > 220){
			en._fireHidden = false;
			en._fireNoHit = false;
			fireKitEnd(en);
			return;
		}
		const dest = kit.path[kit.pi];
		if(!dest){
			en._fireHidden = false; en._fireNoHit = false;
			fireKitEnd(en); return;
		}
		const dx = dest.x - (en.x + en.w / 2), dy = dest.y - (en.y + en.h / 2);
		const d = Math.hypot(dx, dy) || 1;
		en.x += dx / d * 5.4;
		en.y = dest.y - en.h + 6;
		kit.glow.push({ x: en.x + en.w / 2, y: dest.y, age: 0 });
		if(kit.glow.length > 40) kit.glow.shift();
		if(d < 14){
			kit.pi++;
			if(kit.pi >= kit.path.length){
				const ex = kit.path[kit.path.length - 1].x;
				efxTelegraph(ex - 16, kit.floor - 150, 32, 160, 22, 'rgba(255,80,0,0.35)', 'rect', '', 'magma');
				setTimeout(function(){
					if(en.dead) return;
					en._fireHidden = false; en._fireNoHit = false;
					en.x = ex - en.w / 2;
					en.y = kit.floor - en.h;
					if(!fireKitHit(en, ex, kit.floor - 24, 26, fireKitDmg(26), ['burn'])) fireKitHit(en, ex, kit.floor - 84, 26, fireKitDmg(26), ['burn']);
					fireKitGeyser(en, ex, kit.floor, 150, 34);
					if(typeof shakeScreen === 'function') shakeScreen(6, 10);
					fireKitEnd(en);
				}, 180);
				kit.pi = kit.path.length;
			}
		}
	} else if(kit.kind === 'burningCoil'){
		if(kit.t < 36){
			kit.cx += (aim.x - kit.cx) * 0.08;
			kit.cy += (aim.y - kit.cy) * 0.08;
			en.x = kit.cx + kit.r - en.w / 2;
			en.y = kit.cy - en.h / 2;
		} else if(kit.t === 36){
			kit.ignited = true;
			if(typeof shakeScreen === 'function') shakeScreen(5, 8);
		} else if(kit.t < 78){
			const pcx = aim.x, pcy = aim.y;
			const dist = Math.hypot(pcx - kit.cx, pcy - kit.cy);
			if(Math.abs(dist - kit.r) < atkS(22)) fireKitHit(en, pcx, pcy, 18, fireKitDmg(14), ['burn']);
		} else if(kit.t === 78){
			efxTelegraph(kit.cx - 28, kit.cy - 28, 56, 56, 16, 'rgba(255,40,0,0.4)', 'circle', '');
		} else if(kit.t >= 92 && kit.t < 104){
			fireKitHit(en, kit.cx, kit.cy, 34, fireKitDmg(28), ['burn']);
			en.x = kit.cx - en.w / 2; en.y = kit.cy - en.h / 2;
		} else if(kit.t >= 110) fireKitEnd(en);
	} else if(kit.kind === 'eruptionChase'){
		if(kit.t > 360){
			en._fireHidden = false;
			en._fireNoHit = false;
			fireKitEnd(en);
			return;
		}
		en.x += ((aim.x - 8) - en.x) * 0.09;
		en.y = kit.floor - 8;
		if(kit.t >= kit.nextPop && kit.pops < kit.maxPops){
			const px = kit.lastX;
			kit.lastX = aim.x;
			kit.pops++;
			kit.nextPop = kit.t + 52;
			efxTelegraph(px - 22, kit.floor - 70, 44, 74, 24, 'rgba(255,90,0,0.3)', 'rect', '');
			setTimeout(function(){
				if(en.dead) return;
				fireKitHit(en, px, kit.floor - 36, 28, fireKitDmg(16), ['burn']);
				fireKitSpawn(en, px, kit.floor - 8, 0, -6.5, {
					color: '#cc3300', color2: '#ff8800', power: 14, width: 28, height: 48,
					shape: 'spike', effects: ['burn'], trail: 'flame', maxAge: 36, gravity: -0.05, _fireStyle: 'erupt'
				});
				fireKitGeyser(en, px, kit.floor, 80, 26);
			}, 260);
		}
		if(kit.pops >= kit.maxPops && kit.t > kit.nextPop + 8){
			const pred = aim.x + aim.vx * 8;
			en._fireHidden = false; en._fireNoHit = false;
			en.x = pred - en.w / 2;
			en.y = kit.floor - en.h;
			fireKitHit(en, pred, kit.floor - 40, 36, fireKitDmg(24), ['burn']);
			fireKitGeyser(en, pred, kit.floor, 120, 30);
			if(typeof shakeScreen === 'function') shakeScreen(7, 12);
			fireKitEnd(en);
		}
	}
}

function pointInTri(px, py, a, b, c){
	const v0x = c.x - a.x, v0y = c.y - a.y;
	const v1x = b.x - a.x, v1y = b.y - a.y;
	const v2x = px - a.x, v2y = py - a.y;
	const dot00 = v0x * v0x + v0y * v0y;
	const dot01 = v0x * v1x + v0y * v1y;
	const dot02 = v0x * v2x + v0y * v2y;
	const dot11 = v1x * v1x + v1y * v1y;
	const dot12 = v1x * v2x + v1y * v2y;
	const inv = 1 / (dot00 * dot11 - dot01 * dot01 || 1);
	const u = (dot11 * dot02 - dot01 * dot12) * inv;
	const v = (dot00 * dot12 - dot01 * dot02) * inv;
	return u >= 0 && v >= 0 && u + v < 1;
}
function tickMageKit(en, kit){
	const aim = fireKitAim(en);
	if(kit.kind === 'fireSigil'){
		if(kit.t === 84) kit.linked = true;
		if(kit.linked && kit.t < 150){
			if(pointInTri(aim.x, aim.y, kit.pts[0], kit.pts[1], kit.pts[2]) && kit.t % 10 === 0){
				fireKitHit(en, aim.x, aim.y, 20, fireKitDmg(10), ['burn']);
			}
		}
		if(kit.t === 118 && !kit.warped){
			kit.warped = true;
			const cx = (kit.pts[0].x + kit.pts[1].x + kit.pts[2].x) / 3;
			const cy = (kit.pts[0].y + kit.pts[1].y + kit.pts[2].y) / 3;
			en.x = cx - en.w / 2; en.y = cy - en.h / 2;
			if(typeof unstuckFromTiles === 'function') unstuckFromTiles(en);
			fireKitSpark(cx, cy, 16, { r: 255, g: 180, b: 60 });
		}
		if(kit.t > 160) fireKitEnd(en);
	} else if(kit.kind === 'combustionMark'){
		if(kit.t < kit.follow){
			const fy = fireKitFloorY(aim.x, aim.y) - 4;
			kit.x += (aim.x - kit.x) * 0.14;
			kit.y += (fy - kit.y) * 0.18;
		} else if(!kit.boom){
			kit.boom = true;
			fireKitHit(en, kit.x, kit.y - 20, 52, fireKitDmg(22), ['burn']);
			for(let i = 0; i < 4; i++){
				const a = i * Math.PI / 2 + 0.4;
				fireKitSpawn(en, kit.x, kit.y - 18, Math.cos(a) * 5.6, Math.sin(a) * 5.6, {
					color: '#ff6611', color2: '#ffdd66', power: 14, width: 28, height: 28,
					shape: 'circle', effects: ['burn'], trail: 'flame', maxAge: 80, _fireStyle: 'orb'
				});
			}
			if(window.EFX){
				EFX.burst(kit.x, kit.y - 20, 'fire', 2.2, { shake: 0 });
				EFX.groundWave(kit.x, kit.y + 2, 110, 'fire', 24);
				EFX.decal(kit.x, kit.y + 3, 48, 'fire', 180);
				fireKitPushFX({ kind: 'geyser', en, x: kit.x, floor: kit.y + 4, h: 110, age: 0, max: 26 });
			} else fireKitSpark(kit.x, kit.y, 18);
			if(typeof shakeScreen === 'function') shakeScreen(5, 8);
		} else if(kit.t > kit.follow + 24) fireKitEnd(en);
	}
}

function tickGolemKit(en, kit){
	if(kit.kind === 'faultline'){
		if(kit.phase === 'grow'){
			kit.grow = Math.min(1, kit.t / 40);
			if(kit.t === 48) kit.phase = 'pause';
		} else if(kit.phase === 'pause' && kit.t === 66){
			kit.phase = 'erupt';
		} else if(kit.phase === 'erupt'){
			if(kit.t % 3 === 0){
				for(let c = 0; c < kit.cracks.length; c++){
					const line = kit.cracks[c];
					const idx = Math.min(line.length - 1, Math.floor((kit.t - 66) / 3));
					const pt = line[idx];
					if(pt){
						fireKitHit(en, pt.x, pt.y - 28, 24, fireKitDmg(18), ['burn']);
						if(kit.t % 6 === 0){
							if(window.EFX){ EFX.debris('magma', pt.x, pt.y - 4, 2, { speed: 6, floor: pt.y }); EFX.decal(pt.x, pt.y + 1, 26, 'magma', 120); }
							fireKitSpawn(en, pt.x, pt.y - 4, 0, -5.8, {
								color: '#cc4400', color2: '#ff8800', power: 16, width: 26, height: 46,
								shape: 'spike', effects: ['burn'], trail: 'flame', maxAge: 32, _fireStyle: 'erupt'
							});
						}
					}
				}
			}
			if(kit.t > 100) fireKitEnd(en);
		}
	} else if(kit.kind === 'magmaCore'){
		if(kit.t % 14 === 0 && kit.t < 96){
			const dx = (Math.random() - 0.5) * 160;
			fireKitSpawn(en, en.x + en.w / 2 + dx, en.y - 30, 0, 2.8, {
				color: '#ff5500', color2: '#ffaa33', power: 12, width: 22, height: 22,
				shape: 'circle', effects: ['burn'], trail: 'flame', gravity: 0.16, maxAge: 80, _fireStyle: 'drop'
			});
		}
		if(kit.t === 100){
			en._fireCoreOpen = false;
			if(window.EFX){ EFX.burst(en.x + en.w / 2, en.y + en.h * 0.4, 'magma', 2.2, { shake: 0 }); EFX.ring(en.x + en.w / 2, en.y + en.h * 0.4, 20, 180, 'magma', 24, { width: 6 }); }
			for(let i = 0; i < 14; i++){
				const a = Math.PI * 2 / 14 * i;
				fireKitSpawn(en, en.x + en.w / 2, en.y + en.h * 0.4, Math.cos(a) * 5.2, Math.sin(a) * 5.2, {
					color: '#ff3300', color2: '#ffcc44', power: 16, width: 30, height: 30,
					shape: 'circle', effects: ['burn'], trail: 'flame', maxAge: 70, _destroysSolid: true, _fireStyle: 'orb'
				});
			}
			if(typeof shakeScreen === 'function') shakeScreen(8, 12);
		}
		if(kit.t > 118) fireKitEnd(en);
	} else if(kit.kind === 'volcanicFists'){
		if(kit.t === 52){
			kit.phase = 'impact';
			[kit.a, kit.b].forEach(function(p){
				fireKitHit(en, p.x, p.y - 40, 62, fireKitDmg(26), ['burn']);
				fireKitPushFX({ kind: 'crater', en, x: p.x, y: p.y, r: atkS(70), age: 0, max: 90, wave: false });
				if(window.EFX){
					EFX.burst(p.x, p.y - 20, 'magma', 2, { floor: p.y });
					EFX.groundWave(p.x, p.y, 150, 'magma', 26);
					EFX.debris('earth', p.x, p.y - 8, 10, { speed: 9, floor: p.y, spread: 2 });
					EFX.smoke(p.x, p.y - 10, 4, { size: 16, c: '#3a2a20', a: 0.5, spread: 3 });
				}
			});
			if(typeof shakeScreen === 'function') shakeScreen(10, 16);
		}
		if(kit.t === 82){
			[kit.a, kit.b].forEach(function(p){
				fireKitHit(en, p.x, p.y - 20, 80, fireKitDmg(18), ['burn']);
				const ring = fireKitSpawn(en, p.x, p.y - 8, 0, 0, {
					color: '#cc5500', color2: '#ff9900', power: 18, width: 16, height: 16,
					shape: 'ring', maxAge: 28, aoe: true, aoeRadius: 120, aoeMax: 28
				});
				if(ring){ ring._fireStyle = 'ring'; ring._efxEl = 'magma'; }
				if(window.EFX){ EFX.ring(p.x, p.y - 8, 20, atkS(120), 'magma', 28, { flat: 0.35, width: 8 }); EFX.sparks('magma', p.x, p.y - 6, 10, { ang: -Math.PI / 2, spread: 2.6, speed: 7 }); }
			});
		}
		if(kit.t > 100) fireKitEnd(en);
	} else if(kit.kind === 'moltenCollapse'){
		if(kit.phase === 'crack' && kit.t === 36){
			kit.phase = 'fall';
			en._fireHidden = true;
			en._fireNoHit = true;
			for(let i = 0; i < 5; i++){
				kit.pieces.push(fireKitPushFX({
					kind: 'chunk', en,
					x: en.x + Math.random() * en.w,
					y: en.y + Math.random() * en.h * 0.6,
					w: 34 + Math.random() * 18, h: 26 + Math.random() * 16,
					vx: (fireKitAim(en).x - (en.x + en.w / 2)) / 55 * (0.55 + Math.random() * 0.8) + (Math.random() - 0.5) * 2, vy: -5 - Math.random() * 3.5,
					age: 0, max: 110, grounded: false
				}));
			}
			if(window.EFX){ EFX.burst(en.x + en.w / 2, en.y + en.h / 2, 'magma', 1.6); EFX.smoke(en.x + en.w / 2, en.y + en.h / 2, 5, { size: 16, c: '#2a1a12', a: 0.55, spread: 3 }); }
			if(typeof shakeScreen === 'function') shakeScreen(8, 14);
		}
		if(kit.phase === 'fall' && kit.t === 150){
			en._fireHidden = false; en._fireNoHit = false;
			for(let i = 0; i < kit.pieces.length; i++) kit.pieces[i].dead = true;
			fireKitSpark(en.x + en.w / 2, en.y + en.h / 2, 18);
			fireKitEnd(en);
		}
	}
}

function tickSpriteKit(en, kit){
	const aim = fireKitAim(en);
	if(kit.kind === 'emberBlink'){
		if(kit.t >= kit.next && kit.si < kit.spots.length){
			const prevX = en.x + en.w / 2, prevY = en.y + en.h / 2;
			const last = kit.si === kit.spots.length - 1;
			fireKitPushFX({
				kind: 'blinkPop', en, x: prevX, y: prevY, age: 0, max: 22,
				r: last ? 36 : 26, dmg: fireKitDmg(last ? 18 : 12)
			});
			const s = kit.spots[kit.si];
			en.x = s.x - en.w / 2; en.y = s.y - en.h / 2;
			if(typeof unstuckFromTiles === 'function') unstuckFromTiles(en);
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
			kit.si++;
			kit.next = kit.t + 16;
			fireKitSpark(s.x, s.y, 8, { r: 255, g: 200, b: 70 });
		}
		if(kit.si >= kit.spots.length && kit.t > kit.next + 8){
			const dx = aim.x - (en.x + en.w / 2), dy = aim.y - (en.y + en.h / 2);
			const d = Math.hypot(dx, dy) || 1;
			fireKitSpawn(en, en.x + en.w / 2, en.y + en.h / 2, dx / d * 7.8, dy / d * 7.8, {
				color: '#ffaa22', color2: '#fff0aa', power: 14, width: 26, height: 26,
				shape: 'circle', effects: ['burn'], trail: 'flame', maxAge: 70, _fireStyle: 'orb'
			});
			fireKitEnd(en);
		}
	} else if(kit.kind === 'cometDive'){
		if(kit.phase === 'rise'){
			en.y -= 10;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
			if(kit.t === 18){
				kit.phase = 'hang';
				const ang = Math.atan2(aim.y - (en.y + en.h / 2), aim.x - (en.x + en.w / 2));
				kit.ang = ang;
				kit.spd = 16;
				const len = 520;
				efxTelegraph(
					en.x + en.w / 2 + Math.cos(ang) * len * 0.5 - 40,
					en.y + en.h / 2 + Math.sin(ang) * len * 0.5 - 16,
					80, 32, 20, 'rgba(255,180,40,0.28)', 'rect', ''
				);
			}
		} else if(kit.phase === 'hang' && kit.t >= 32){
			kit.phase = 'dive';
		} else if(kit.phase === 'dive'){
			en.x += Math.cos(kit.ang) * kit.spd;
			en.y += Math.sin(kit.ang) * kit.spd;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
			fireKitHit(en, en.x + en.w / 2, en.y + en.h / 2, 22, fireKitDmg(16), ['burn']);
			if(kit.t % 2 === 0) fireKitSpark(en.x + en.w / 2, en.y + en.h / 2, 2, { r: 255, g: 210, b: 80 });
			if(!kit.bounced && (fireKitBlocked(en.x + en.w / 2 + Math.cos(kit.ang) * 20, en.y + en.h / 2 + Math.sin(kit.ang) * 20) || kit.t > 70)){
				kit.bounced = true;
				kit.ang += Math.PI;
				kit.spd = 14;
			} else if(kit.bounced && kit.t > 96) fireKitEnd(en);
		}
	} else if(kit.kind === 'flickerSwarm'){
		kit.flashT++;
		for(let i = kit.copies.length - 1; i >= 0; i--){
			const c = kit.copies[i];
			c.life--;
			c.x += c.vx; c.y += c.vy;
			if(c.x < 40 || c.x > (typeof WORLD_W === 'number' ? WORLD_W - 40 : 4000)) c.vx *= -1;
			if(c.life <= 0){
				const dx = aim.x - c.x, dy = aim.y - c.y, d = Math.hypot(dx, dy) || 1;
				fireKitSpawn(en, c.x, c.y, dx / d * 7, dy / d * 7, {
					color: '#ff7a1a', color2: '#ffe08a', power: 9, width: 20, height: 20,
					shape: 'circle', effects: ['burn'], trail: 'flame', maxAge: 80, _fireStyle: 'ember'
				});
				if(window.EFX) EFX.flash(c.x, c.y, 20, 'fire', 6);
				kit.copies.splice(i, 1);
			}
			else if(typeof projectiles !== 'undefined'){
				for(let pi = 0; pi < projectiles.length; pi++){
					const p = projectiles[pi];
					if(p && !p.hasHit && Math.hypot(p.x - c.x, p.y - c.y) < 22){
						kit.copies.splice(i, 1);
						fireKitSpark(c.x, c.y, 8, { r: 180, g: 80, b: 20 });
						break;
					}
				}
			}
		}
		if(kit.t > 150) fireKitEnd(en);
	}
}

function updateFireDungeonWorld(){
	for(let i = fireWorldFX.length - 1; i >= 0; i--){
		const fx = fireWorldFX[i];
		if(fx.dead){ fireWorldFX.splice(i, 1); continue; }
		fx.age = (fx.age || 0) + 1;
		if(fx.kind === 'silhouette'){
			fx.x += fx.vx; fx.y += fx.vy;
			fx.vx *= 0.96; fx.vy *= 0.96;
			if(fx.age >= fx.max) fireWorldFX.splice(i, 1);
		} else if(fx.kind === 'trail'){
			if(fx.hitCd > 0) fx.hitCd--;
			if(!fx.hitCd && fireKitHit(fx.en, fx.x, fx.y, 22, fireKitDmg(8), ['burn'])) fx.hitCd = 22;
			if(fx.age >= fx.max) fireWorldFX.splice(i, 1);
		} else if(fx.kind === 'crater' || fx.kind === 'geyser'){
			if(fx.age >= fx.max) fireWorldFX.splice(i, 1);
		} else if(fx.kind === 'chunk'){
			if(!fx.grounded){
				fx.vy += 0.32; fx.x += fx.vx; fx.y += fx.vy;
				const fl = fireKitFloorY(fx.x, fx.y);
				if(fx.y + fx.h / 2 >= fl){ fx.y = fl - fx.h / 2; fx.vy = 0; fx.grounded = true; if(window.EFX){ EFX.debris('magma', fx.x, fl - 4, 4, { speed: 4, floor: fl }); EFX.groundWave(fx.x, fl, 50, 'magma', 16); EFX.decal(fx.x, fl + 1, 30, 'magma', 120); } }
			}
			if(fx.age % 8 === 0) fireKitHit(fx.en, fx.x, fx.y, Math.max(fx.w, fx.h) * 0.45, fireKitDmg(10), ['burn']);
			if(fx.age >= fx.max) fireWorldFX.splice(i, 1);
		} else if(fx.kind === 'blinkPop'){
			if(fx.age === 18){ fireKitHit(fx.en, fx.x, fx.y, fx.r, fx.dmg, ['burn']); if(window.EFX) EFX.burst(fx.x, fx.y, 'fire', fx.r / 26); }
			if(fx.age >= fx.max) fireWorldFX.splice(i, 1);
		} else if(fx.kind === 'mine'){
			if(fx.en && fx.en.dead){ fireWorldFX.splice(i, 1); continue; }
			if(fx.flying){
				fx.vy += 0.32; fx.x += fx.vx; fx.y += fx.vy;
				if(fx.y >= fx.floor){ fx.y = fx.floor; fx.flying = false; fx.vx = 0; fx.vy = 0; if(window.EFX){ EFX.emit('fire', fx.x, fx.y + 8, 4, { speed: 1.2 }); EFX.decal(fx.x, fx.y + 16, 18, 'fire', 200, { glow: 0.3 }); } }
				continue;
			}
			const aim = fireKitAim(fx.en);
			const dist = Math.hypot(aim.x - fx.x, aim.y - fx.y);
			if(fx.age > fx.armed && dist < 150 && !fx.chasing){ fx.chasing = true; if(window.EFX) EFX.flash(fx.x, fx.y, 26, 'fire', 8); }
			if(fx.chasing){
				const d = dist || 1;
				fx.vx += (aim.x - fx.x) / d * 0.45;
				fx.vy += (aim.y - fx.y) / d * 0.45;
				const spd = Math.hypot(fx.vx, fx.vy);
				if(spd > 6.5){ fx.vx *= 6.5 / spd; fx.vy *= 6.5 / spd; }
				fx.x += fx.vx; fx.y += fx.vy;
				if(dist < 22 || fx.age > 260){
					fireKitHit(fx.en, fx.x, fx.y, 32, fireKitDmg(14), ['burn']);
					if(window.EFX) EFX.burst(fx.x, fx.y, 'fire', 1.4); else fireKitSpark(fx.x, fx.y, 12);
					fireWorldFX.splice(i, 1);
				}
			} else if(fx.age > 420){ if(window.EFX) EFX.burst(fx.x, fx.y, 'fire', 0.7); fireKitHit(fx.en, fx.x, fx.y, 24, fireKitDmg(8), ['burn']); fireWorldFX.splice(i, 1); }
		}
	}
}

/* ---------- bounce hook for pinball / rebound ---------- */
function fireKitTryBounce(p){
	if(!p || (!p._firePinball && !p._fireRebound)) return false;
	const prevX = p.x - p.vx, prevY = p.y - p.vy;
	let hitV = fireKitBlocked(p.x, prevY);
	let hitH = fireKitBlocked(prevX, p.y);
	if(!hitV && !hitH){ hitV = true; hitH = true; }
	if(hitV){ p.vy = -p.vy; p.y = prevY; }
	if(hitH){ p.vx = -p.vx; p.x = prevX; }
	if(p._fireRebound){
		const kick = (Math.random() < 0.5 ? 1 : -1) * 0.55;
		const nx = -p.vy * kick, ny = p.vx * kick;
		p.vx += nx; p.vy += ny;
		p._rebounds = (p._rebounds || 0) + 1;
		spawnImpact(p.x, p.y, p.color2 || '#ffaa44');
		fireKitSpark(p.x, p.y, 8);
		if(p._rebounds >= 5){ p.age = p.maxAge; }
		return true;
	}
	p.vx *= 1.18; p.vy *= 1.18;
	const cap = 13;
	const spd = Math.hypot(p.vx, p.vy);
	if(spd > cap){ p.vx *= cap / spd; p.vy *= cap / spd; }
	p._pinBounces = (p._pinBounces || 0) + 1;
	spawnImpact(p.x, p.y, '#ffee88');
	fireKitSpark(p.x, p.y, 12, { r: 255, g: 180, b: 50 });
	if(typeof shakeScreen === 'function') shakeScreen(3, 5);
	if(p._pinBounces >= 3){
		for(let i = 0; i < 7; i++){
			const a = Math.PI * 2 / 7 * i + Math.random() * 0.2;
			const em = spawnEnemyProj(p.x, p.y, Math.cos(a) * 4.6, Math.sin(a) * 4.6, {
				color: '#ff6600', color2: '#ffdd66', power: 10, width: 20, height: 20,
				shape: 'circle', effects: ['burn'], trail: 'flame', maxAge: 55
			});
			if(em){
				em._fireStyle = 'ember';
				if(p.necroFriendly) em.necroFriendly = true;
			}
		}
		p.age = p.maxAge;
	}
	return true;
}

/* ---------- drawing (EFX) ---------- */
function fireKitHex(c, a){
	if(typeof c === 'string' && c[0] === '#'){
		const n = parseInt(c.slice(1), 16);
		const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
		return 'rgba(' + r + ',' + g + ',' + b + ',' + (a == null ? 1 : a) + ')';
	}
	return c;
}
// screen-space orb kept for callers outside this file
function drawFireKitOrb(x, y, r, c1, c2, pulse){
	if(window.EFX){ EFX.bolt(null, x + camera.x, y + camera.y, r * 0.75, 'fire', { trail: false, motes: false }); return; }
	const g = ctx.createRadialGradient(x, y, r * 0.1, x, y, r);
	g.addColorStop(0, 'rgba(255,255,230,0.95)'); g.addColorStop(0.3, fireKitHex(c2, 0.95)); g.addColorStop(1, 'rgba(80,10,0,0)');
	ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}
// a geyser of magma standing on the floor at (x, floor), h tall, a = 0..1 strength
function fireDrawGeyser(x, floor, h, a, w){
	if(!window.EFX || a <= 0.02) return;
	const P = EFX.pal('magma'), sx = x - camera.x, sy = floor - camera.y;
	w = w || 26;
	ctx.save(); ctx.globalCompositeOperation = 'lighter';
	EFX.glowS(sx, sy, w * 2.4, P.outer, 0.6 * a);
	for(let i = 0; i < 7; i++){
		const k = i / 6, wob = Math.sin(EFX.frame * 0.5 + i * 1.3) * w * 0.18;
		EFX.glowS(sx + wob, sy - h * k, w * (1.25 - k * 0.55), k < 0.5 ? P.mid : P.outer, (0.85 - k * 0.4) * a);
	}
	EFX.glowS(sx, sy - h * 0.35, w * 0.7, P.core, 0.9 * a, true);
	ctx.restore();
}
function drawFireKitProj(p){
	if(!window.EFX){ drawFireKitOrb(p.x - camera.x, p.y - camera.y, Math.max(p.width, p.height) * 0.55, p.color, p.color2, 0.5); return; }
	const st = p._fireStyle, r = Math.max(p.width, p.height) * 0.42;
	if(st === 'erupt'){
		const floor = p._floorY || (p._floorY = fireKitFloorY(p.x, p.y - 10));
		const u = (p.age || 0) / (p.maxAge || 36);
		fireDrawGeyser(p.x, floor, Math.max(20, floor - p.y + p.height * 0.6), Math.sin(Math.min(1, u * 1.4) * Math.PI) * 0.95 + 0.05, p.width * 0.75);
		return;
	}
	if(st === 'glob' || st === 'drop'){
		EFX.bolt(p, p.x, p.y, r * 0.85, 'magma', { trailLen: 7 });
		return;
	}
	if(st === 'pinball'){
		EFX.bolt(p, p.x, p.y, r * 0.8, 'fire', { trailLen: 12 });
		// spinning ring of flame tongues
		const P = EFX.pal('fire'), t = p.age || 0, rr = r * 1.35;
		ctx.save(); ctx.globalCompositeOperation = 'lighter';
		for(let i = 0; i < 6; i++){
			const a = t * 0.22 + i * Math.PI / 3;
			EFX.glow(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr, r * 0.55, i % 2 ? P.mid : P.outer, 0.8);
		}
		ctx.restore();
		return;
	}
	if(st === 'rebound'){
		EFX.bolt(p, p.x, p.y, r * 0.75, 'fire', { trailLen: 11 });
		ctx.save(); ctx.globalCompositeOperation = 'lighter';
		EFX.glow(p.x, p.y, r * 2.2, '#ffe28a', 0.25 + 0.15 * Math.sin((p.age || 0) * 0.4));
		ctx.restore();
		return;
	}
	EFX.bolt(p, p.x, p.y, r * (st === 'ember' ? 0.7 : 0.8), 'fire');
}

function drawFireSigilRune(x, y, r, t, a){
	const P = EFX.pal('fire'), sx = x - camera.x, sy = y - camera.y;
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	EFX.glowS(sx, sy, r * 2.2, P.outer, 0.5 * a);
	ctx.translate(sx, sy); ctx.rotate(t * 0.04);
	ctx.strokeStyle = EFX.rgba(P.mid, 0.9 * a); ctx.lineWidth = 2.2;
	ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
	ctx.strokeStyle = EFX.rgba(P.core, 0.8 * a); ctx.lineWidth = 1.4;
	ctx.beginPath();
	for(let i = 0; i < 3; i++){ const an = -Math.PI / 2 + i * Math.PI * 2 / 3; const px = Math.cos(an) * r * 0.78, py = Math.sin(an) * r * 0.78; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
	ctx.closePath(); ctx.stroke();
	ctx.rotate(-t * 0.09);
	ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.arc(0, 0, r * 1.3, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
	EFX.glowS(0, 0, r * 0.55, P.core, 0.9 * a, true);
	ctx.restore();
}

function drawFireDungeonWorld(){
	if(!window.EFX) return;
	EFX.bind();
	for(let i = 0; i < fireWorldFX.length; i++){
		const fx = fireWorldFX[i];
		const u = fx.max ? fx.age / fx.max : 0;
		if(fx.kind === 'silhouette'){
			// a smouldering after-image of the imp that drifts and burns away
			const a = 1 - u;
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			const cx0 = fx.x + fx.w / 2, cy0 = fx.y + fx.h / 2;
			EFX.glow(cx0, cy0, fx.w * 1.3, '#ff4a0a', 0.45 * a);
			for(let k = 0; k < 4; k++) EFX.glow(cx0 + Math.sin(k * 2.1 + fx.age * 0.2) * fx.w * 0.3, cy0 - fx.h * 0.4 + k * fx.h * 0.25, fx.w * 0.45, '#ffa526', 0.5 * a);
			ctx.restore();
		} else if(fx.kind === 'trail'){
			// burning ground left by Wildfire Trail
			const a = u < 0.08 ? u / 0.08 : (u > 0.7 ? (1 - u) / 0.3 : 1);
			EFX.flameStrip(fx.x - fx.w * 0.5, fx.x + fx.w * 0.5, fx.y + 6, 'fire', a, { height: 22 + 6 * Math.sin(fx.x), step: 15, emit: (fx.age & 7) === 0 });
		} else if(fx.kind === 'geyser'){
			fireDrawGeyser(fx.x, fx.floor, fx.h * Math.min(1, u * 4), Math.sin(Math.min(1, u * 1.2) * Math.PI * 0.5 + (u > 0.5 ? (u - 0.5) * Math.PI : 0)) * (1 - u * 0.6), 30);
		} else if(fx.kind === 'crater'){
			// molten crater from a Volcanic Fist
			const a = 1 - u, sx = fx.x - camera.x, sy = fx.y - camera.y;
			ctx.save();
			ctx.globalAlpha = 0.75 * a; ctx.fillStyle = '#2a0c04';
			ctx.beginPath(); ctx.ellipse(sx, sy, fx.r, fx.r * 0.26, 0, 0, Math.PI * 2); ctx.fill();
			ctx.globalCompositeOperation = 'lighter';
			ctx.globalAlpha = 1;
			EFX.glowS(sx, sy - 2, fx.r * 0.75, '#ff6a12', 0.65 * a);
			for(let k = 0; k < 5; k++){ const ox = (k - 2) * fx.r * 0.3; EFX.glowS(sx + ox, sy - 4 - Math.abs(Math.sin(fx.age * 0.15 + k)) * 10 * a, fx.r * 0.18, '#ffd060', 0.6 * a, true); }
			ctx.restore();
		} else if(fx.kind === 'chunk'){
			// cooling magma boulder from Molten Collapse
			const sx = fx.x - camera.x, sy = fx.y - camera.y, s = Math.max(fx.w, fx.h) * 0.62;
			ctx.save(); ctx.translate(sx, sy); ctx.rotate(fx.grounded ? 0.3 : fx.age * 0.06);
			ctx.drawImage(EFX.rockSprite('magma', (i * 3) & 7), -s, -s, s * 2, s * 2);
			ctx.globalCompositeOperation = 'lighter';
			EFX.glowS(0, 0, s * 0.9, '#ff5a00', 0.55 * (1 - u * 0.7) * (0.75 + 0.25 * Math.sin(fx.age * 0.2)));
			ctx.restore();
		} else if(fx.kind === 'blinkPop'){
			// ember burst left behind by a blink — swells, then detonates at age 18
			const sx = fx.x - camera.x, sy = fx.y - camera.y;
			if(fx.age < 18){
				const k = fx.age / 18;
				EFX.warnCircle(fx.x, fx.y, fx.r, k, 'fire');
				ctx.save(); ctx.globalCompositeOperation = 'lighter';
				EFX.glowS(sx, sy, fx.r * (0.3 + k * 0.5), '#ffd060', 0.4 + k * 0.5, true);
				ctx.restore();
			}
		} else if(fx.kind === 'mine'){
			const armed = fx.age > fx.armed, sx = fx.x - camera.x, sy = fx.y - camera.y;
			const beat = armed ? (0.6 + 0.4 * Math.sin(fx.age * (fx.chasing ? 0.9 : 0.35))) : fx.age / fx.armed;
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			EFX.glowS(sx, sy, fx.r * 3, '#ff4a0a', 0.35 + 0.35 * beat);
			EFX.glowS(sx, sy, fx.r * 1.2, '#ffa526', 0.9, true);
			EFX.glowS(sx, sy, fx.r * 0.6, '#fff4c8', beat, true);
			ctx.strokeStyle = 'rgba(255,220,140,' + (armed ? 0.7 : 0.35) + ')'; ctx.lineWidth = 1.5;
			ctx.beginPath(); ctx.arc(sx, sy, fx.r * 1.6, fx.age * 0.1, fx.age * 0.1 + Math.PI * 2 * Math.min(1, fx.age / fx.armed)); ctx.stroke();
			ctx.restore();
			if(fx.chasing) EFX.track(fx, 6), EFX.trail(fx._efxH, fx.r * 0.7, 'fire', { ribbon: false });
		}
	}
	if(typeof enemies !== 'undefined'){
		for(let i = 0; i < enemies.length; i++) drawFireDungeonEnemyFX(enemies[i]);
	}
	if(typeof playerMinions !== 'undefined'){
		for(let i = 0; i < playerMinions.length; i++) drawFireDungeonEnemyFX(playerMinions[i]);
	}
}

function drawFireDungeonEnemyFX(en){
	if(!en || en.dead || !en.fireKit || !window.EFX) return;
	const kit = en.fireKit, P = EFX.pal('fire');
	const ecx = en.x + en.w / 2, ecy = en.y + en.h / 2;
	if(kit.kind === 'emberOrbit' && kit.orbs){
		for(let i = 0; i < kit.orbs.length; i++){
			const o = kit.orbs[i];
			o.age = kit.t + i * 5; o.vx = o.x - (o._px == null ? o.x : o._px); o.vy = o.y - (o._py == null ? o.y : o._py); o._px = o.x; o._py = o.y;
			EFX.bolt(o, o.x, o.y, 9 + Math.min(1, kit.t / 30) * 3, 'fire', { trailLen: 7, moteEvery: 4 });
			if(kit.lock && kit.t < kit.launchAt) EFX.warnLine(o.x, o.y, kit.lock.x, kit.lock.y, 10, (kit.t - 70) / (kit.launchAt - 70), 'fire', { alpha: 0.6 });
		}
	}
	if(kit.kind === 'cinderFakeout' && kit.phase === 'vanish' && kit.target){
		EFX.warnCircle(kit.target.x, kit.target.y, 34, (kit.t - 16) / 12, 'fire');
	}
	if(kit.kind === 'wildfireTrail' && kit.t % 2 === 0){
		EFX.mote('fire', ecx + (Math.random() - 0.5) * en.w, ecy + en.h * 0.3, 0, 0, 1.2);
	}
	if(kit.kind === 'burrowingFang' && kit.glow && kit.glow.length > 1){
		EFX.crack(kit.glow, 'magma', { width: 4, heat: 0.8 });
		const h = kit.glow[kit.glow.length - 1];
		if(kit.t % 3 === 0){ EFX.debris('earth', h.x, h.y - 2, 1, { speed: 3, floor: h.y, scale: 0.6 }); EFX.mote('magma', h.x, h.y - 4, 0, -1); }
		ctx.save(); ctx.globalCompositeOperation = 'lighter'; EFX.glow(h.x, h.y, 26, P.outer, 0.5); ctx.restore();
	}
	if(kit.kind === 'burningCoil'){
		// a ring of fire tongues; before ignition a dashed warning
		const prog = Math.min(1, kit.t / 36);
		if(!kit.ignited) EFX.warnCircle(kit.cx, kit.cy, kit.r, prog, 'fire', { alpha: 0.9 });
		else {
			const n = 22, sc = 1 + 0.06 * Math.sin(kit.t * 0.4);
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			for(let i = 0; i < n; i++){
				const a = i / n * Math.PI * 2 + kit.t * 0.05, x = kit.cx + Math.cos(a) * kit.r * sc, y = kit.cy + Math.sin(a) * kit.r * sc;
				const fl = 0.7 + 0.3 * Math.sin(kit.t * 0.6 + i * 1.7);
				EFX.glow(x, y, 20 * fl, P.outer, 0.6);
				EFX.glow(x, y - 6 * fl, 11 * fl, P.mid, 0.85, true);
			}
			EFX.glow(kit.cx, kit.cy, kit.r * 1.1, P.outer, 0.12);
			ctx.restore();
			if(kit.t % 3 === 0){ const a = Math.random() * Math.PI * 2; EFX.mote('fire', kit.cx + Math.cos(a) * kit.r, kit.cy + Math.sin(a) * kit.r, 0, -1, 1.2); }
			if(kit.t >= 78 && kit.t < 92) EFX.warnCircle(kit.cx, kit.cy, 44, (kit.t - 78) / 14, 'fire');
		}
	}
	if(kit.kind === 'eruptionChase'){
		// the serpent is a glowing bulge travelling under the floor
		const x = ecx, y = kit.floor;
		ctx.save(); ctx.globalCompositeOperation = 'lighter';
		EFX.glow(x, y - 4, 34, P.outer, 0.5); EFX.glow(x, y - 2, 14, P.mid, 0.8, true);
		ctx.restore();
		if(kit.t % 2 === 0) EFX.debris('earth', x + (Math.random() - 0.5) * 20, y - 2, 1, { speed: 2.5, floor: y, scale: 0.5 });
		if(kit.t % 5 === 0) EFX.smoke(x, y - 4, 1, { size: 8, c: '#3a2a20', a: 0.35 });
	}
	if(kit.kind === 'fireSigil' && kit.pts){
		const a = Math.min(1, kit.t / 20);
		for(let i = 0; i < kit.pts.length; i++) drawFireSigilRune(kit.pts[i].x, kit.pts[i].y, 18, kit.t + i * 20, a);
		if(kit.linked){
			const pts = kit.pts, t = kit.t;
			ctx.save();
			ctx.beginPath(); ctx.moveTo(pts[0].x - camera.x, pts[0].y - camera.y); ctx.lineTo(pts[1].x - camera.x, pts[1].y - camera.y); ctx.lineTo(pts[2].x - camera.x, pts[2].y - camera.y); ctx.closePath();
			ctx.fillStyle = 'rgba(255,70,10,' + (0.13 + Math.sin(t * 0.25) * 0.05) + ')'; ctx.fill();
			ctx.restore();
			for(let i = 0; i < 3; i++){ const A = pts[i], B = pts[(i + 1) % 3]; EFX.beam(A.x, A.y, B.x, B.y, 5, 'fire', { alpha: 0.9 }); }
			if(t % 2 === 0){ const k1 = Math.random(), k2 = Math.random() * (1 - k1); const x = pts[0].x + (pts[1].x - pts[0].x) * k1 + (pts[2].x - pts[0].x) * k2, y = pts[0].y + (pts[1].y - pts[0].y) * k1 + (pts[2].y - pts[0].y) * k2; EFX.mote('fire', x, y, 0, -1, 1.3); }
		} else if(kit.t > 40){
			for(let i = 0; i < 3; i++){ const A = kit.pts[i], B = kit.pts[(i + 1) % 3]; EFX.warnLine(A.x, A.y, B.x, B.y, 6, (kit.t - 40) / 44, 'fire', { alpha: 0.6 }); }
		}
	}
	if(kit.kind === 'combustionMark' && !kit.boom){
		EFX.warnCircle(kit.x, kit.y, 54, kit.t / kit.follow, 'fire', { flat: 0.35 });
		ctx.save(); ctx.globalCompositeOperation = 'lighter';
		EFX.glow(kit.x, kit.y - 2, 30 + 20 * (kit.t / kit.follow), P.outer, 0.35 + 0.4 * (kit.t / kit.follow));
		ctx.restore();
		if(kit.t % 4 === 0) EFX.mote('fire', kit.x + (Math.random() - 0.5) * 70, kit.y - 2, 0, -1);
		// a thread of heat from the mage's hand to the mark
		EFX.beam(ecx, en.y + en.h * 0.3, kit.x, kit.y - 4, 2, 'fire', { alpha: 0.35 });
	}
	if(kit.kind === 'faultline' && kit.cracks){
		const vis = kit.grow || 1, erupt = kit.phase === 'erupt';
		const heat = erupt ? 1 : (kit.phase === 'pause' ? 0.45 + 0.35 * Math.sin(kit.t * 0.6) : 0.25);
		for(let c = 0; c < kit.cracks.length; c++) EFX.crack(kit.cracks[c], 'magma', { progress: vis, heat, width: c ? 3 : 5 });
	}
	if(kit.kind === 'volcanicFists'){
		[kit.a, kit.b].forEach(function(p, j){
			if(kit.t < 52){
				const u = kit.t / 52;
				EFX.warnCircle(p.x, p.y, 70, u, 'magma', { flat: 0.3 });
				// a magma fist plunges from above, slowing as it lines up
				const fy = p.y - 40 - (1 - u * u) * 360, s = 30 + u * 6;
				ctx.save(); ctx.translate(p.x - camera.x, fy - camera.y);
				ctx.globalAlpha = Math.min(1, u * 3);
				ctx.drawImage(EFX.rockSprite('magma', 3 + j), -s, -s, s * 2, s * 2);
				ctx.globalCompositeOperation = 'lighter'; EFX.glowS(0, s * 0.4, s, '#ff5a00', 0.6 * u);
				ctx.restore();
			}
		});
	}
	if(kit.kind === 'magmaCore' && en._fireCoreOpen){
		const cx = ecx, cy = en.y + en.h * 0.42, k = Math.min(1, kit.t / 100);
		ctx.save(); ctx.globalCompositeOperation = 'lighter';
		EFX.glow(cx, cy, 30 + 30 * k, '#ff4a0a', 0.5 + 0.3 * k);
		EFX.glow(cx, cy, 14 + Math.sin(kit.t * 0.4) * 3, '#fff0a0', 0.95, true);
		ctx.restore();
		if(kit.t % 3 === 0) EFX.charge(cx, cy, 'magma', 70, 1, 16);
		if(kit.t > 80) EFX.warnCircle(cx, cy, 120, (kit.t - 80) / 20, 'magma', { alpha: 0.7 });
	}
	if(kit.kind === 'moltenCollapse' && kit.phase === 'crack'){
		const k = kit.t / 36;
		ctx.save(); ctx.globalCompositeOperation = 'lighter';
		for(let i = 0; i < 4; i++) EFX.glow(en.x + en.w * (0.2 + i * 0.2), en.y + en.h * (0.3 + (i % 2) * 0.3), 10 + 10 * k, '#ff6a12', 0.4 + 0.5 * k);
		ctx.restore();
		if(kit.t % 3 === 0) EFX.sparks('magma', ecx, ecy, 1, { speed: 4 });
	}
	if(kit.kind === 'flickerSwarm' && kit.copies){
		for(let i = 0; i < kit.copies.length; i++){
			const c = kit.copies[i];
			ctx.save(); ctx.globalAlpha = 0.6 + 0.2 * Math.sin(kit.t * 0.5 + i);
			EFX.bolt(c, c.x, c.y, 9, 'fire', { trailLen: 6, moteEvery: 5 });
			ctx.restore();
		}
		if(kit.flashT % 40 < 5){ ctx.save(); ctx.globalCompositeOperation = 'lighter'; EFX.glow(ecx, ecy, 30, '#fff4c8', 0.7); ctx.restore(); }
	}
	if(kit.kind === 'cometDive'){
		if(kit.phase === 'hang'){
			EFX.warnLine(ecx, ecy, ecx + Math.cos(kit.ang) * 480, ecy + Math.sin(kit.ang) * 480, 34, (kit.t - 18) / 14, 'fire');
			EFX.charge(ecx, ecy, 'fire', 40, 1, 12);
		} else if(kit.phase === 'dive'){
			kit.x = ecx; kit.y = ecy; EFX.track(kit, 10);
			EFX.trail(kit._efxH, 14, 'fire');
		}
	}
}

function dungeonRegularKitGrid(en, img, typeSet){
	const type = (en && (en.necroType || en.type)) || '';
	if(typeSet && !typeSet[type]) return null;
	if(typeof SPRITE_SHEET_META !== 'undefined' && SPRITE_SHEET_META[type]){
		const m = SPRITE_SHEET_META[type];
		return { cols: m.cols, rows: m.rows, startCol: m.startCol || 0 };
	}
	if(!img || !img.naturalWidth || !img.naturalHeight) return { cols: 8, rows: 6 };
	const r = img.naturalWidth / img.naturalHeight;
	if(r > 1.22 && r < 1.42) return { cols: 8, rows: 6 };
	if(r > 1.55 && r < 1.95) return { cols: 10, rows: 6 };
	if(r > 0.68 && r < 0.86) return { cols: 6, rows: 8 };
	return { cols: 8, rows: 6 };
}
function fireKitSpriteRow(en){
	const type = (en && (en.necroType || en.type)) || '';
	if(!FIRE_KIT_TYPES[type]) return null;
	if(en.dead){
		const img = (typeof ENEMY_SPRITE_SHEETS !== 'undefined') ? ENEMY_SPRITE_SHEETS[type] : null;
		const g = dungeonRegularKitGrid(en, img, FIRE_KIT_TYPES);
		return g && g.rows === 8 ? 7 : 5;
	}
	if(en.fireKit && en.fireKit.row != null) return en.fireKit.row;
	return null;
}
function fireKitSheetRows(en, img){
	const g = dungeonRegularKitGrid(en, img, FIRE_KIT_TYPES);
	return g ? g.rows : null;
}
function fireKitSheetGrid(en, img){
	return dungeonRegularKitGrid(en, img, FIRE_KIT_TYPES);
}

function registerFireDungeonCasts(map){
	const casts = {
		castImpEmberOrbit, castImpCinderFakeout, castImpInfernoPinball, castImpWildfireTrail,
		castSerpentBurrowingFang, castSerpentBurningCoil, castSerpentMagmaFang, castSerpentEruptionChase,
		castEmberFireSigil, castEmberReboundFlame, castEmberCombustionMark,
		castGolemFaultline, castGolemMagmaCore, castGolemVolcanicFists, castGolemMoltenCollapse,
		castSpriteEmberBlink, castSpriteCometDive, castSpriteEmberMines, castSpriteFlickerSwarm
	};
	for(const k in casts){
		if(typeof window !== 'undefined') window[k] = casts[k];
		if(map) map[k] = casts[k];
	}
}
registerFireDungeonCasts(typeof CAST_FNS !== 'undefined' ? CAST_FNS : null);

if(typeof window !== 'undefined'){
	window.updateFireDungeonEnemy = updateFireDungeonEnemy;
	window.updateFireDungeonWorld = updateFireDungeonWorld;
	window.drawFireDungeonWorld = drawFireDungeonWorld;
	window.drawFireKitProj = drawFireKitProj;
	window.fireKitTryBounce = fireKitTryBounce;
	window.fireKitSpriteRow = fireKitSpriteRow;
	window.fireKitSheetRows = fireKitSheetRows;
	window.fireKitSheetGrid = fireKitSheetGrid;
	window.dungeonRegularKitGrid = dungeonRegularKitGrid;
	window.registerFireDungeonCasts = registerFireDungeonCasts;
	window.fireKitEnd = fireKitEnd;
	window.FIRE_KIT_TYPES = FIRE_KIT_TYPES;
}
