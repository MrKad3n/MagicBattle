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
				spawnImpact(x, y, '#ff6622');
				return true;
			}
		}
		return false;
	}
	if(player.iFrames > 0) return false;
	if(circRect(x, y, r, player.x, player.y, player.w, player.h)){
		damagePlayer(dmg, effects || ['burn']);
		spawnImpact(x, y, '#ff6622');
		return true;
	}
	return false;
}
function fireKitFloorY(x, fromY){
	const start = (fromY != null) ? fromY : 0;
	if(typeof TILE === 'number' && typeof MAP_ROWS === 'number' && typeof isSolid === 'function'){
		const col = Math.floor(x / TILE);
		const sr = Math.max(0, Math.floor(start / TILE));
		for(let r = sr; r < MAP_ROWS; r++){
			if(isSolid(col, r)) return r * TILE;
		}
	}
	let best = (typeof WORLD_H === 'number') ? WORLD_H - 8 : 2400;
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
			spawnTelegraph(spots[i].x - 22, spots[i].y - 22, 44, 44, 28, 'rgba(255,90,0,0.28)', 'circle', '');
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
		spawnTelegraph(pts[i].x - 18, pts[i].y - 18, 36, 36, 70, 'rgba(255,120,20,0.3)', 'circle', '◆');
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
	spawnTelegraph(en.x - 10, en.y + 8, en.w + 20, en.h - 10, 50, 'rgba(255,80,0,0.28)', 'rect', 'CORE');
}
function castGolemVolcanicFists(en){
	const aim = fireKitAim(en);
	const a = { x: aim.x, y: fireKitFloorY(aim.x, aim.y) };
	const b = { x: aim.x + (aim.vx >= 0 ? 130 : -130), y: fireKitFloorY(aim.x + 130, aim.y) };
	beginFireKit(en, 'volcanicFists', { busy: true, a, b, phase: 'tell' });
	spawnTelegraph(a.x - 70, a.y - 160, 140, 170, 55, 'rgba(255,70,0,0.26)', 'rect', '');
	spawnTelegraph(b.x - 70, b.y - 160, 140, 170, 55, 'rgba(255,70,0,0.26)', 'rect', '');
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
	for(let i = 0; i < 5; i++){
		fireKitPushFX({
			kind: 'mine', en, age: 0, armed: 70, dead: false,
			x: en.x + en.w / 2 + (i - 2) * 46,
			y: en.y + (i % 2 ? -30 : 10),
			vx: 0, vy: 0, r: atkS(14), chasing: false
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
			life: 150
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
				const up = Math.random() < 0.55;
				en.x = aim.x + behind * 70 - en.w / 2;
				en.y = up ? aim.y - 110 : aim.y - 20;
				if(typeof unstuckFromTiles === 'function') unstuckFromTiles(en);
				if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
				fireKitSpark(en.x + en.w / 2, en.y + en.h / 2, 14, { r: 80, g: 40, b: 20 });
			}
		} else if(kit.phase === 'vanish' && kit.t >= 28){
			kit.phase = 'dive';
			en._fireHidden = false;
		} else if(kit.phase === 'dive'){
			en.y += 9;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
			fireKitHit(en, en.x + en.w / 2, en.y + en.h, 26, fireKitDmg(20), ['burn']);
			if(kit.t >= 42) fireKitEnd(en);
		}
	} else if(kit.kind === 'wildfireTrail'){
		const dest = kit.pts[kit.pi];
		if(!dest){ fireKitEnd(en); return; }
		const dx = dest.x - (en.x + en.w / 2), dy = dest.y - (en.y + en.h / 2);
		const d = Math.hypot(dx, dy) || 1;
		en.x += dx / d * 6.2;
		en.y += dy / d * 6.2;
		if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
		if(kit.t - kit.lastDrop >= 5){
			kit.lastDrop = kit.t;
			const fx = en.x + en.w / 2, fy = fireKitFloorY(en.x + en.w / 2, en.y + en.h);
			fireKitPushFX({ kind: 'trail', en, x: fx, y: fy - 6, w: atkS(56), h: atkS(16), age: 0, max: 160, hitCd: 0 });
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
				spawnTelegraph(ex - 16, kit.floor - 150, 32, 160, 22, 'rgba(255,80,0,0.35)', 'rect', '');
				setTimeout(function(){
					if(en.dead) return;
					en._fireHidden = false; en._fireNoHit = false;
					en.x = ex - en.w / 2;
					en.y = kit.floor - en.h;
					fireKitHit(en, ex, kit.floor - 80, 22, fireKitDmg(26), ['burn']);
					fireKitSpark(ex, kit.floor - 20, 16);
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
			spawnTelegraph(kit.cx - 28, kit.cy - 28, 56, 56, 16, 'rgba(255,40,0,0.4)', 'circle', '');
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
			spawnTelegraph(px - 22, kit.floor - 70, 44, 74, 24, 'rgba(255,90,0,0.3)', 'rect', '');
			setTimeout(function(){
				if(en.dead) return;
				fireKitHit(en, px, kit.floor - 36, 28, fireKitDmg(16), ['burn']);
				fireKitSpawn(en, px, kit.floor - 8, 0, -6.5, {
					color: '#cc3300', color2: '#ff8800', power: 14, width: 28, height: 48,
					shape: 'spike', effects: ['burn'], trail: 'flame', maxAge: 36, gravity: -0.05, _fireStyle: 'erupt'
				});
				fireKitSpark(px, kit.floor, 10);
			}, 260);
		}
		if(kit.pops >= kit.maxPops && kit.t > kit.nextPop + 8){
			const pred = aim.x + aim.vx * 8;
			en._fireHidden = false; en._fireNoHit = false;
			en.x = pred - en.w / 2;
			en.y = kit.floor - en.h;
			fireKitHit(en, pred, kit.floor - 40, 36, fireKitDmg(24), ['burn']);
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
			fireKitSpark(kit.x, kit.y, 18);
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
				fireKitSpark(p.x, p.y, 14);
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
				if(ring) ring._fireStyle = 'ring';
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
					vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2,
					age: 0, max: 110, grounded: false
				}));
			}
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
				spawnTelegraph(
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
			if(c.life <= 0) kit.copies.splice(i, 1);
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
		} else if(fx.kind === 'crater'){
			if(fx.age >= fx.max) fireWorldFX.splice(i, 1);
		} else if(fx.kind === 'chunk'){
			if(!fx.grounded){
				fx.vy += 0.32; fx.x += fx.vx; fx.y += fx.vy;
				const fl = fireKitFloorY(fx.x, fx.y);
				if(fx.y + fx.h / 2 >= fl){ fx.y = fl - fx.h / 2; fx.vy = 0; fx.grounded = true; }
			}
			if(fx.age % 8 === 0) fireKitHit(fx.en, fx.x, fx.y, Math.max(fx.w, fx.h) * 0.45, fireKitDmg(10), ['burn']);
			if(fx.age >= fx.max) fireWorldFX.splice(i, 1);
		} else if(fx.kind === 'blinkPop'){
			if(fx.age === 18) fireKitHit(fx.en, fx.x, fx.y, fx.r, fx.dmg, ['burn']);
			if(fx.age >= fx.max) fireWorldFX.splice(i, 1);
		} else if(fx.kind === 'mine'){
			if(fx.en && fx.en.dead){ fireWorldFX.splice(i, 1); continue; }
			const aim = fireKitAim(fx.en);
			const dist = Math.hypot(aim.x - fx.x, aim.y - fx.y);
			if(fx.age > fx.armed && dist < 70) fx.chasing = true;
			if(fx.chasing){
				const d = dist || 1;
				fx.vx += (aim.x - fx.x) / d * 0.45;
				fx.vy += (aim.y - fx.y) / d * 0.45;
				const spd = Math.hypot(fx.vx, fx.vy);
				if(spd > 6.5){ fx.vx *= 6.5 / spd; fx.vy *= 6.5 / spd; }
				fx.x += fx.vx; fx.y += fx.vy;
				if(dist < 22 || fx.age > 260){
					fireKitHit(fx.en, fx.x, fx.y, 32, fireKitDmg(14), ['burn']);
					fireKitSpark(fx.x, fx.y, 12);
					fireWorldFX.splice(i, 1);
				}
			} else if(fx.age > 300) fireWorldFX.splice(i, 1);
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

/* ---------- drawing ---------- */
function fireKitHex(c, a){
	if(typeof c === 'string' && c[0] === '#'){
		const n = parseInt(c.slice(1), 16);
		const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
		return 'rgba(' + r + ',' + g + ',' + b + ',' + (a == null ? 1 : a) + ')';
	}
	return c;
}
function drawFireKitOrb(x, y, r, c1, c2, pulse){
	const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.3, r * 0.1, x, y, r);
	g.addColorStop(0, 'rgba(255,255,230,0.95)');
	g.addColorStop(0.28, fireKitHex(c2, 0.95));
	g.addColorStop(0.7, fireKitHex(c1, 0.9));
	g.addColorStop(1, 'rgba(80,10,0,0)');
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.arc(x, y, r * (0.92 + (pulse || 0) * 0.08), 0, Math.PI * 2); ctx.fill();
	ctx.strokeStyle = 'rgba(255,220,120,0.45)';
	ctx.lineWidth = 2;
	ctx.beginPath(); ctx.arc(x, y, r * 0.72, -0.6, 1.1); ctx.stroke();
}
function drawFireKitProj(p){
	const px = p.x - camera.x, py = p.y - camera.y;
	const r = Math.max(p.width, p.height) * 0.55;
	const pulse = 0.5 + Math.sin((p.age || 0) * 0.35) * 0.5;
	drawFireKitOrb(px, py, r, p.color, p.color2, pulse);
	if(p._firePinball){
		ctx.save();
		ctx.globalAlpha = 0.35;
		ctx.strokeStyle = '#ffee88';
		ctx.lineWidth = 3;
		ctx.beginPath(); ctx.arc(px, py, r + 6 + pulse * 3, 0, Math.PI * 2); ctx.stroke();
		ctx.restore();
	}
}

function drawFireDungeonWorld(){
	if(!fireWorldFX.length && typeof enemies === 'undefined') return;
	for(let i = 0; i < fireWorldFX.length; i++){
		const fx = fireWorldFX[i];
		const x = fx.x - camera.x, y = fx.y - camera.y;
		if(fx.kind === 'silhouette'){
			ctx.save();
			ctx.globalAlpha = 0.35 * (1 - fx.age / fx.max);
			ctx.fillStyle = '#4a2210';
			ctx.fillRect(x, y, fx.w, fx.h);
			ctx.fillStyle = 'rgba(255,80,0,0.25)';
			ctx.fillRect(x + 2, y + 2, fx.w - 4, fx.h - 4);
			ctx.restore();
		} else if(fx.kind === 'trail'){
			const a = 1 - fx.age / fx.max;
			ctx.save();
			const g = ctx.createLinearGradient(x, y - 10, x, y + 10);
			g.addColorStop(0, 'rgba(255,180,40,' + (0.15 * a) + ')');
			g.addColorStop(0.5, 'rgba(255,70,0,' + (0.7 * a) + ')');
			g.addColorStop(1, 'rgba(80,10,0,' + (0.1 * a) + ')');
			ctx.fillStyle = g;
			ctx.beginPath(); ctx.ellipse(x, y, fx.w * 0.55, 9, 0, 0, Math.PI * 2); ctx.fill();
			ctx.restore();
		} else if(fx.kind === 'crater'){
			const a = 1 - fx.age / fx.max;
			ctx.save();
			ctx.globalAlpha = 0.55 * a;
			ctx.fillStyle = '#3a1208';
			ctx.beginPath(); ctx.ellipse(x, y, fx.r, fx.r * 0.38, 0, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = 'rgba(255,90,0,0.45)';
			ctx.beginPath(); ctx.ellipse(x, y, fx.r * 0.55, fx.r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
			ctx.restore();
		} else if(fx.kind === 'chunk'){
			ctx.save();
			ctx.translate(x, y);
			ctx.rotate(fx.age * 0.03);
			ctx.fillStyle = '#6a2a10';
			ctx.fillRect(-fx.w / 2, -fx.h / 2, fx.w, fx.h);
			ctx.fillStyle = '#ff6611';
			ctx.globalAlpha = 0.7;
			ctx.fillRect(-fx.w / 4, -fx.h / 4, fx.w / 2, fx.h / 2);
			ctx.restore();
		} else if(fx.kind === 'blinkPop'){
			const u = fx.age / fx.max;
			ctx.save();
			ctx.globalAlpha = u < 0.7 ? 0.25 + u * 0.4 : 1 - u;
			ctx.strokeStyle = '#ffcc66';
			ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(x, y, fx.r * (0.4 + u * 0.8), 0, Math.PI * 2); ctx.stroke();
			ctx.restore();
		} else if(fx.kind === 'mine'){
			const armed = fx.age > fx.armed;
			drawFireKitOrb(x, y, fx.r * (armed ? 1.1 : 0.9), '#ff4400', armed ? '#ffe080' : '#ffaa44', Math.sin(fx.age * 0.2));
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
	if(!en || en.dead || !en.fireKit) return;
	const kit = en.fireKit;
	if(kit.kind === 'emberOrbit' && kit.orbs){
		for(let i = 0; i < kit.orbs.length; i++){
			drawFireKitOrb(kit.orbs[i].x - camera.x, kit.orbs[i].y - camera.y, 13, '#ff3300', '#ffcc55', Math.sin(kit.t * 0.2 + i));
		}
	}
	if(kit.kind === 'burrowingFang' && kit.glow){
		ctx.save();
		ctx.lineWidth = 6;
		ctx.strokeStyle = 'rgba(255,90,0,0.55)';
		ctx.lineCap = 'round';
		ctx.beginPath();
		for(let i = 0; i < kit.glow.length; i++){
			const g = kit.glow[i];
			const px = g.x - camera.x, py = g.y - camera.y;
			if(i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
		}
		ctx.stroke();
		ctx.lineWidth = 2;
		ctx.strokeStyle = 'rgba(255,220,80,0.8)';
		ctx.stroke();
		ctx.restore();
	}
	if(kit.kind === 'burningCoil'){
		ctx.save();
		const cx = kit.cx - camera.x, cy = kit.cy - camera.y;
		ctx.strokeStyle = kit.ignited ? 'rgba(255,70,0,0.85)' : 'rgba(255,140,40,0.55)';
		ctx.lineWidth = kit.ignited ? 14 : 9;
		ctx.beginPath(); ctx.arc(cx, cy, kit.r, 0, Math.PI * 2); ctx.stroke();
		if(kit.ignited){
			ctx.strokeStyle = 'rgba(255,230,120,0.7)';
			ctx.lineWidth = 4;
			ctx.beginPath(); ctx.arc(cx, cy, kit.r - 5, 0, Math.PI * 2); ctx.stroke();
		}
		ctx.restore();
	}
	if(kit.kind === 'fireSigil' && kit.pts){
		ctx.save();
		for(let i = 0; i < kit.pts.length; i++){
			const p = kit.pts[i];
			drawFireKitOrb(p.x - camera.x, p.y - camera.y, 16, '#ff5511', '#ffe080', Math.sin(kit.t * 0.15 + i));
		}
		if(kit.linked){
			ctx.strokeStyle = 'rgba(255,90,20,0.7)';
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.moveTo(kit.pts[0].x - camera.x, kit.pts[0].y - camera.y);
			ctx.lineTo(kit.pts[1].x - camera.x, kit.pts[1].y - camera.y);
			ctx.lineTo(kit.pts[2].x - camera.x, kit.pts[2].y - camera.y);
			ctx.closePath(); ctx.stroke();
			ctx.fillStyle = 'rgba(255,50,0,' + (0.12 + Math.sin(kit.t * 0.2) * 0.05) + ')';
			ctx.fill();
		}
		ctx.restore();
	}
	if(kit.kind === 'combustionMark' && !kit.boom){
		const pulse = 18 + Math.sin(kit.t * 0.25) * 4;
		ctx.save();
		ctx.strokeStyle = 'rgba(255,80,0,0.75)';
		ctx.lineWidth = 3;
		ctx.beginPath(); ctx.arc(kit.x - camera.x, kit.y - camera.y, pulse, 0, Math.PI * 2); ctx.stroke();
		ctx.fillStyle = 'rgba(255,40,0,0.2)';
		ctx.beginPath(); ctx.arc(kit.x - camera.x, kit.y - camera.y, pulse * 0.55, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
	}
	if(kit.kind === 'faultline' && kit.cracks){
		ctx.save();
		ctx.lineCap = 'round';
		const vis = kit.grow || 1;
		for(let c = 0; c < kit.cracks.length; c++){
			const line = kit.cracks[c];
			const n = Math.max(2, Math.floor(line.length * vis));
			ctx.strokeStyle = kit.phase === 'erupt' ? 'rgba(255,70,0,0.9)' : 'rgba(80,20,8,0.85)';
			ctx.lineWidth = kit.phase === 'erupt' ? 7 : 4;
			ctx.beginPath();
			for(let i = 0; i < n; i++){
				const p = line[i];
				if(i === 0) ctx.moveTo(p.x - camera.x, p.y - camera.y);
				else ctx.lineTo(p.x - camera.x, p.y - camera.y);
			}
			ctx.stroke();
		}
		ctx.restore();
	}
	if(kit.kind === 'volcanicFists' && kit.t < 52){
		[kit.a, kit.b].forEach(function(p){
			const u = kit.t / 52;
			ctx.save();
			ctx.strokeStyle = 'rgba(255,90,0,' + (0.35 + u * 0.45) + ')';
			ctx.lineWidth = 3;
			ctx.beginPath(); ctx.ellipse(p.x - camera.x, p.y - camera.y, 68 * (0.7 + u * 0.3), 26, 0, 0, Math.PI * 2); ctx.stroke();
			ctx.restore();
		});
	}
	if(kit.kind === 'magmaCore' && en._fireCoreOpen){
		const cx = en.x + en.w / 2 - camera.x, cy = en.y + en.h * 0.42 - camera.y;
		drawFireKitOrb(cx, cy, 18 + Math.sin(kit.t * 0.2) * 3, '#ff2200', '#ffe080', 1);
	}
	if(kit.kind === 'flickerSwarm' && kit.copies){
		for(let i = 0; i < kit.copies.length; i++){
			const c = kit.copies[i];
			ctx.save();
			ctx.globalAlpha = 0.55;
			drawFireKitOrb(c.x - camera.x, c.y - camera.y, 11, '#ff6600', '#ffcc66', 0.4);
			ctx.restore();
		}
		if(kit.flashT % 40 < 5){
			const cx = en.x + en.w / 2 - camera.x, cy = en.y + en.h / 2 - camera.y;
			ctx.save();
			ctx.globalAlpha = 0.85;
			ctx.strokeStyle = '#fff6c8';
			ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.stroke();
			ctx.restore();
		}
	}
	if(kit.kind === 'cometDive' && kit.phase === 'hang'){
		ctx.save();
		ctx.strokeStyle = 'rgba(255,200,80,0.45)';
		ctx.lineWidth = 3;
		ctx.setLineDash([10, 8]);
		ctx.beginPath();
		ctx.moveTo(en.x + en.w / 2 - camera.x, en.y + en.h / 2 - camera.y);
		ctx.lineTo(en.x + en.w / 2 + Math.cos(kit.ang) * 480 - camera.x, en.y + en.h / 2 + Math.sin(kit.ang) * 480 - camera.y);
		ctx.stroke();
		ctx.restore();
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
