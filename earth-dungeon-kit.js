/* =============================================================
   Earth Dungeon kit — Rock Golem, Vine Crawler, Cave Spider,
   Crystal Mage, Mud Elemental.
   Threats spawn immediately and keep going if the caster dies.
   ============================================================= */

const EARTH_KIT_TYPES = { rockGolem:1, vineCrawler:1, caveSpider:1, crystalMage:1, mudElemental:1 };
const earthWorldFX = [];

function atkS(n){ return n * ((typeof ENEMY_ATK_SCALE === 'number') ? ENEMY_ATK_SCALE : 1.3); }
function kitAim(en){ return (typeof fireKitAim === 'function') ? fireKitAim(en) : { x: player.x + player.w / 2, y: player.y + player.h / 2, vx: player.vx || 0, vy: player.vy || 0, box: player }; }
function kitLead(en, frames){
	const a = kitAim(en);
	const t = frames == null ? 16 : frames;
	return { x: a.x + (a.vx || 0) * t, y: a.y + (a.vy || 0) * t, vx: a.vx || 0, vy: a.vy || 0, box: a.box };
}
function kitFriendly(en){ return !!(en && (en.isNecroSummon || en.necroFriendly)); }
function kitDmg(n){ return Math.round(n * 2.55 * ((typeof DIFF_DMG_MULT === 'number') ? DIFF_DMG_MULT : 1)); }
function kitFloor(x, y){ return (typeof fireKitFloorY === 'function') ? fireKitFloorY(x, y) : ((y || 0) + 80); }
function kitBlocked(x, y){ return (typeof fireKitBlocked === 'function') ? fireKitBlocked(x, y) : false; }
function kitShake(a, t){ if(typeof shakeScreen === 'function') shakeScreen(a, t); }
function kitSpark(x, y, n, color){
	if(window.EFX){ EFX.sparkRGB(x, y, n, color, 'earth'); return; }
	if(typeof particles === 'undefined') return;
	const c = color || { r: 200, g: 160, b: 90 };
	for(let i = 0; i < Math.min(n || 12, 22); i++){
		const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 6;
		particles.push({ x: x + (Math.random() - 0.5) * 14, y: y + (Math.random() - 0.5) * 14, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.4, life: 16 + Math.random() * 16, maxLife: 32, r: 2 + Math.random() * 3, color: c });
	}
}
function earthSpawn(en, x, y, vx, vy, opts){
	opts = opts || {};
	if(!opts.effects) opts.effects = [];
	opts.noZoneNerf = true;
	const p = spawnEnemyProj(x, y, vx, vy, opts);
	if(p){
		p._earthStyle = opts._earthStyle || 'rock';
		p._efxEl = earthStyleEl(p._earthStyle);
		if(kitFriendly(en)){
			if(typeof markNecroFriendlyProj === 'function') markNecroFriendlyProj(p, en);
			else p.necroFriendly = true;
		}
	}
	return p;
}
function earthStyleEl(st){ return st === 'crystal' ? 'crystal' : (st === 'web' ? 'silk' : (st === 'mud' ? 'mud' : 'earth')); }
function earthKitEl(en){
	const t = en && (en.necroType || en.type);
	return t === 'vineCrawler' ? 'nature' : (t === 'caveSpider' ? 'silk' : (t === 'crystalMage' ? 'crystal' : (t === 'mudElemental' ? 'mud' : 'earth')));
}
function earthHit(en, x, y, r, dmg, effects){
	r = atkS(r);
	if(kitFriendly(en)){
		if(typeof necroScaleKitDmg === 'function') dmg = necroScaleKitDmg(en, dmg);
		const pool = (typeof enemies !== 'undefined' ? enemies : []).concat(typeof dummies !== 'undefined' ? dummies : []);
		for(let i = 0; i < pool.length; i++){
			const t = pool[i];
			if(!t || t.dead) continue;
			if(circRect(x, y, r, t.x, t.y, t.w, t.h)){
				t.hp -= dmg; t.flash = 8;
				dmgNumbers.push({ x: t.x + t.w / 2, y: t.y - 10, text: Math.round(dmg) + '', age: 0, color: '#c9a66b' });
				return true;
			}
		}
		return false;
	}
	if(player.iFrames > 0) return false;
	if(circRect(x, y, r, player.x, player.y, player.w, player.h)){
		if(window.EFX && EFX.armed(en, x, y, r)) return false;      // fair arming (enemy-fx.js)
		damagePlayer(dmg, effects || []);
		if(window.EFX) EFX.hit(player.x + player.w / 2, player.y + player.h / 2, earthKitEl(en), dmg * 0.5);
		return true;
	}
	return false;
}
function kitSlowSet(amt){ player._kitSlow = Math.max(player._kitSlow || 0, amt); }
function earthEnd(en){
	if(!en) return;
	en.earthKit = null;
	en._earthKitBusy = false;
	en._earthHidden = false;
	en._earthNoHit = false;
}
function beginEarthKit(en, kind, extra){
	en.earthKit = Object.assign({ kind, t: 0, type: en.necroType || en.type, row: 2 }, extra || {});
	en._earthKitBusy = extra && extra.busy === false ? false : true;
	en.attackAnimTimer = Math.max(en.attackAnimTimer || 0, 36);
	en.facing = kitAim(en).x >= en.x + en.w / 2 ? 1 : -1;
	if(window.EFX) EFX.charge(en.x + en.w / 2, en.y + en.h / 2, earthKitEl(en), Math.max(40, en.w * 1.3), 8, 16);
	if(kind !== 'prismClone'){
		for(let i = 0; i < earthWorldFX.length; i++){
			const fx = earthWorldFX[i];
			if(fx.kind === 'prism' && fx.en === en && !fx.pending){ fx.pending = kind; fx.copyAt = fx.age + 18; }
		}
	}
	return en.earthKit;
}
function earthFX(fx){ earthWorldFX.push(fx); return fx; }

/* ---------- ROCK GOLEM ---------- */
function castGolemBoulderRoll(en){
	const aim = kitLead(en, 14);
	const ox = en.x + en.w / 2, oy = en.y + 6;
	const dir = aim.x >= ox ? 1 : -1;
	const p = earthSpawn(en, ox + dir * 28, oy, dir * 10.2, -2.8, {
		color: '#8a7350', color2: '#f0e0b8', power: 40, width: 78, height: 78,
		shape: 'circle', gravity: 0.2, maxAge: 220, trail: 'smoke', _earthStyle: 'boulder'
	});
	if(p){ p._earthRoll = true; p._earthBounces = 0; p._earthSplitAt = 90; }
	kitSpark(ox, oy, 16, { r: 180, g: 140, b: 70 });
	kitShake(7, 12);
	beginEarthKit(en, 'boulderRoll', { busy: false });
	setTimeout(function(){ if(en.earthKit && en.earthKit.kind === 'boulderRoll') earthEnd(en); }, 280);
}
function castGolemFaultStep(en){
	const aim = kitLead(en, 10);
	const sx = en.x + en.w / 2, sy = kitFloor(sx, en.y + en.h) - 2;
	earthFX({
		kind: 'fault', en, x: sx, y: sy, tx: aim.x, age: 0, max: 64, split: false,
		lines: [{ x1: sx, y1: sy, x2: sx, y2: sy, alive: true }]
	});
	efxTelegraph(sx - 28, sy - 14, 56, 22, 16, 'rgba(220,160,60,0.45)', 'rect', '');
	kitShake(5, 8);
	beginEarthKit(en, 'faultStep', { busy: false });
	setTimeout(function(){ if(en.earthKit && en.earthKit.kind === 'faultStep') earthEnd(en); }, 240);
}
function castGolemStoneDecoy(en){
	const aim = kitAim(en);
	const dx = aim.x >= en.x ? 110 : -110;
	earthFX({ kind: 'decoy', en, x: en.x + dx, y: en.y, w: en.w + 8, h: en.h + 6, age: 0, max: 240, hp: 6 });
	kitSpark(en.x + dx, en.y, 12);
	beginEarthKit(en, 'stoneDecoy', { busy: true, tx: en.x - dx * 1.6 });
}
function castGolemGravityGrip(en){
	const aim = kitLead(en, 8);
	const pillars = [];
	const r = atkS(96);
	for(let i = 0; i < 6; i++){
		const a = (i / 6) * Math.PI * 2 + 0.15;
		pillars.push({ x: aim.x + Math.cos(a) * r, y: kitFloor(aim.x, aim.y), h: 8, maxH: atkS(92) });
	}
	earthFX({ kind: 'grip', en, pillars, cx: aim.x, cy: kitFloor(aim.x, aim.y), age: 0, max: 110, drops: 0 });
	kitShake(6, 10);
	beginEarthKit(en, 'gravityGrip', { busy: false });
	setTimeout(function(){ if(en.earthKit && en.earthKit.kind === 'gravityGrip') earthEnd(en); }, 300);
}

/* ---------- VINE CRAWLER ---------- */
function castVineTunnel(en){
	const aim = kitLead(en, 12);
	const floor = kitFloor(aim.x, aim.y);
	const real = Math.random() < 0.5 ? 0 : 1;
	earthFX({
		kind: 'vinepath', en, real, age: 0, max: 70, erupted: false, pi: 0,
		paths: [
			[{ x: en.x + en.w / 2, y: floor }, { x: aim.x - 50, y: floor }, { x: aim.x + 36, y: floor }],
			[{ x: en.x + en.w / 2, y: floor }, { x: aim.x + 110, y: floor }, { x: aim.x - 28, y: floor }]
		]
	});
	beginEarthKit(en, 'vineTunnel', { busy: true });
	en._earthHidden = true; en._earthNoHit = true;
}
function castVineThornWheel(en){
	const aim = kitAim(en);
	beginEarthKit(en, 'thornWheel', { busy: true, dir: aim.x >= en.x + en.w / 2 ? 1 : -1, phase: 'roll', climbed: false, hitCd: 0 });
}
function castVineGraspingGround(en){
	const aim = kitLead(en, 6);
	const roots = [];
	for(let i = 0; i < 6; i++){
		const a = (i / 6) * Math.PI * 2;
		roots.push({ x: aim.x + Math.cos(a) * atkS(88), y: kitFloor(aim.x, aim.y) - 4, snap: false });
		efxTelegraph(roots[i].x - 16, roots[i].y - 24, 32, 32, 22, 'rgba(90,170,50,0.4)', 'circle', '');
	}
	earthFX({ kind: 'roots', en, roots, age: 0, max: 70, snapped: false });
	beginEarthKit(en, 'graspingGround', { busy: false });
	setTimeout(function(){ if(en.earthKit && en.earthKit.kind === 'graspingGround') earthEnd(en); }, 260);
}
function castVineSeedBomb(en){
	const aim = kitLead(en, 8);
	for(let i = 0; i < 5; i++){
		const sx = aim.x + (i - 2) * 78 + (Math.random() - 0.5) * 16;
		earthFX({ kind: 'seed', en, x: sx, y: kitFloor(sx, aim.y) - 6, age: 0, max: 360, grown: false });
	}
	kitSpark(aim.x, aim.y, 10, { r: 80, g: 160, b: 50 });
	beginEarthKit(en, 'seedBomb', { busy: false });
	setTimeout(function(){ if(en.earthKit && en.earthKit.kind === 'seedBomb') earthEnd(en); }, 220);
}

/* ---------- CAVE SPIDER ---------- */
function castSpiderCeilingDrop(en){
	const aim = kitLead(en, 10);
	beginEarthKit(en, 'ceilingDrop', { busy: true, tx: aim.x, phase: 'up', dropX: aim.x });
	en._earthNoHit = true;
}
function castSpiderWebSwing(en){
	const aim = kitLead(en, 8);
	beginEarthKit(en, 'webSwing', {
		busy: true,
		ox: en.x + en.w / 2, oy: en.y - 90,
		ang: aim.x >= en.x ? 0.2 : Math.PI - 0.2,
		rel: 0.32 + Math.random() * 0.28
	});
}
function castSpiderEggSac(en){
	earthFX({ kind: 'eggsac', en, x: en.x + en.w / 2, y: kitFloor(en.x, en.y) - 8, age: 0, max: 200, hatched: false });
	beginEarthKit(en, 'eggSac', { busy: true, climb: true });
}
function castSpiderWebMaze(en){
	const aim = kitLead(en, 6);
	const webs = [];
	for(let i = 0; i < 6; i++){
		webs.push({ x: aim.x - 150 + i * 60, y: kitFloor(aim.x, aim.y) - 8, w: atkS(84), h: atkS(58) });
	}
	earthFX({ kind: 'maze', en, webs, age: 0, max: 140, shots: 0 });
	beginEarthKit(en, 'webMaze', { busy: true, webs });
}

/* ---------- CRYSTAL MAGE ---------- */
function castCrystalRelay(en){
	const aim = kitLead(en, 12);
	const nodes = [];
	const dir = aim.x >= en.x ? 1 : -1;
	for(let i = 0; i < 4; i++){
		nodes.push({ x: en.x + en.w / 2 + (i + 1) * 78 * dir, y: en.y + 8 - i * 16 });
	}
	earthFX({
		kind: 'relay', en, nodes, age: 0, max: 90,
		orb: { x: en.x + en.w / 2, y: en.y + en.h * 0.28, i: 0 }
	});
	kitSpark(en.x + en.w / 2, en.y, 12, { r: 210, g: 130, b: 255 });
	beginEarthKit(en, 'crystalRelay', { busy: false, nodes });
	setTimeout(function(){ if(en.earthKit && en.earthKit.kind === 'crystalRelay') earthEnd(en); }, 280);
}
function castCrystalShardRain(en){
	const aim = kitLead(en, 10);
	earthFX({ kind: 'rain', en, cx: aim.x, cy: aim.y, ang: Math.random() * Math.PI, age: 0, max: 80, drops: 0 });
	beginEarthKit(en, 'shardRain', { busy: false });
	setTimeout(function(){ if(en.earthKit && en.earthKit.kind === 'shardRain') earthEnd(en); }, 280);
}
function castCrystalPrismClone(en){
	const aim = kitAim(en);
	earthFX({ kind: 'prism', en, x: aim.x + (Math.random() < 0.5 ? -100 : 100), y: en.y, w: en.w, h: en.h, age: 0, max: 240, pending: null });
	beginEarthKit(en, 'prismClone', { busy: false });
	setTimeout(function(){ if(en.earthKit && en.earthKit.kind === 'prismClone') earthEnd(en); }, 260);
}
function castCrystalPrison(en){
	const aim = kitLead(en, 6);
	const gems = [];
	for(let i = 0; i < 4; i++) gems.push({ ang: i * Math.PI / 2, r: atkS(110) });
	earthFX({ kind: 'prison', en, cx: aim.x, cy: kitFloor(aim.x, aim.y) - 22, gems, age: 0, max: 70, closed: false });
	beginEarthKit(en, 'crystalPrison', { busy: false });
	setTimeout(function(){ if(en.earthKit && en.earthKit.kind === 'crystalPrison') earthEnd(en); }, 260);
}

/* ---------- MUD ELEMENTAL ---------- */
function castMudWave(en){
	const aim = kitAim(en);
	earthFX({
		kind: 'mudwave', en, dir: aim.x >= en.x + en.w / 2 ? 1 : -1,
		x: en.x + en.w / 2, y: kitFloor(en.x, en.y) - 8, w: atkS(56), age: 0, max: 55, hitCd: 0
	});
	beginEarthKit(en, 'mudWave', { busy: false });
	setTimeout(function(){ if(en.earthKit && en.earthKit.kind === 'mudWave') earthEnd(en); }, 240);
}
function castMudBogClone(en){
	const aim = kitAim(en);
	earthFX({ kind: 'bog', en, x: aim.x + (Math.random() < 0.5 ? -90 : 90), y: en.y, w: en.w + 6, h: en.h + 6, age: 0, max: 120, struck: false });
	beginEarthKit(en, 'bogClone', { busy: false });
	setTimeout(function(){ if(en.earthKit && en.earthKit.kind === 'bogClone') earthEnd(en); }, 280);
}
function castMudSinkhole(en){
	const aim = kitLead(en, 8);
	earthFX({ kind: 'sinkhole', en, cx: aim.x, cy: kitFloor(aim.x, aim.y), r: atkS(118), age: 0, max: 90, shots: 0 });
	beginEarthKit(en, 'sinkhole', { busy: false });
	setTimeout(function(){ if(en.earthKit && en.earthKit.kind === 'sinkhole') earthEnd(en); }, 280);
}
function castMudslide(en){
	const aim = kitAim(en);
	beginEarthKit(en, 'mudslide', { busy: true, dir: aim.x >= en.x + en.w / 2 ? 1 : -1, hitCd: 0 });
	en._earthNoHit = true;
}

/* ---------- ticks ---------- */
function updateEarthDungeonEnemy(en){
	const kit = en.earthKit;
	if(!kit){ en._earthKitBusy = false; return false; }
	kit.t++;
	const type = kit.type || en.necroType || en.type;
	if(type === 'rockGolem') tickGolem(en, kit);
	else if(type === 'vineCrawler') tickVine(en, kit);
	else if(type === 'caveSpider') tickSpider(en, kit);
	else if(type === 'crystalMage'){ if(kit.t > 8) earthEnd(en); }
	else if(type === 'mudElemental') tickMud(en, kit);
	else earthEnd(en);
	return !!en._earthKitBusy;
}

function tickGolem(en, kit){
	if(kit.kind === 'stoneDecoy'){
		en.x += (kit.tx - en.x) * 0.07;
		if(kit.t > 70) earthEnd(en);
	} else if(kit.t > 12) earthEnd(en);
}

function tickVine(en, kit){
	if(kit.kind === 'vineTunnel'){
		if(kit.t > 40){ en._earthHidden = false; en._earthNoHit = false; earthEnd(en); }
	} else if(kit.kind === 'thornWheel'){
		if(kit.hitCd > 0) kit.hitCd--;
		if(kit.t % 3 === 0) earthFX({ kind: 'thorntrail', x: en.x + en.w / 2, y: en.y + en.h * 0.5, age: 0, max: 36, en });
		if(kit.phase === 'roll'){
			en.x += kit.dir * 10.4;
			if(kit.hitCd <= 0 && earthHit(en, en.x + en.w / 2, en.y + en.h / 2, 40, kitDmg(28), [])) kit.hitCd = 8;
			if(kitBlocked(en.x + (kit.dir > 0 ? en.w + 8 : -8), en.y + en.h / 2) || kit.t > 28){
				kit.phase = 'climb'; kit.ct = 0;
			}
		} else if(kit.phase === 'climb'){
			en.y -= 8; kit.ct++;
			if(kit.ct > 8){ kit.phase = 'dive'; kit.dir *= -1; }
		} else {
			en.x += kit.dir * 9.2; en.y += 10.5;
			if(kit.hitCd <= 0 && earthHit(en, en.x + en.w / 2, en.y + en.h / 2, 42, kitDmg(32), ['stun'])) kit.hitCd = 8;
			if(kit.t > 58) earthEnd(en);
		}
	} else if(kit.t > 16) earthEnd(en);
}

function tickSpider(en, kit){
	const aim = kitLead(en, 8);
	if(kit.kind === 'ceilingDrop'){
		if(kit.phase === 'up'){
			en.y -= 11;
			if(kit.t > 10){ kit.phase = 'hang'; kit.hang = 0; }
		} else if(kit.phase === 'hang'){
			kit.hang++;
			kit.dropX += (aim.x - kit.dropX) * 0.16;
			if(kit.hang === 10) kit.dropX += (Math.random() < 0.5 ? -48 : 48);
			if(kit.hang > 14){ kit.phase = 'drop'; en.x = kit.dropX - en.w / 2; en._earthNoHit = false; }
		} else {
			en.y += 14;
			if(en.y + en.h >= kitFloor(en.x, en.y) || kit.t > 48){
				earthHit(en, en.x + en.w / 2, en.y + en.h, 46, kitDmg(34), ['poison', 'stun']);
				earthSpawn(en, en.x + en.w / 2, en.y + 8, (aim.x - (en.x + en.w / 2)) * 0.06, 0, {
					color: '#e8d8b8', color2: '#fff8e8', power: 28, width: 48, height: 48,
					shape: 'circle', maxAge: 50, effects: ['slow'], _earthStyle: 'web'
				});
				if(window.EFX){ const fy = en.y + en.h; EFX.burst(en.x + en.w / 2, fy - 10, 'silk', 1.3); EFX.groundWave(en.x + en.w / 2, fy, 90, 'earth'); EFX.debris('earth', en.x + en.w / 2, fy - 4, 6, { speed: 5, floor: fy }); }
				kitShake(6, 10);
				earthEnd(en);
			}
		}
	} else if(kit.kind === 'webSwing'){
		kit.ang += (en.facing || 1) * 0.12;
		const rel = kit.t / 26;
		en.x = kit.ox + Math.sin(kit.ang) * 170 - en.w / 2;
		en.y = kit.oy + Math.abs(Math.cos(kit.ang)) * 100;
		if(rel >= kit.rel){
			const dx = aim.x - (en.x + en.w / 2), dy = aim.y - (en.y + en.h / 2), d = Math.hypot(dx, dy) || 1;
			earthSpawn(en, en.x + en.w / 2, en.y + en.h / 2, dx / d * 12.2, dy / d * 12.2, {
				color: '#e8d8b8', color2: '#fff8e8', power: 32, width: 52, height: 52,
				shape: 'circle', maxAge: 70, trail: 'smoke', effects: ['slow'], _earthStyle: 'web'
			});
			earthEnd(en);
		}
		if(kit.t > 40) earthEnd(en);
	} else if(kit.kind === 'eggSac'){
		en.y -= 5.5;
		if(kit.t === 16 || kit.t === 24){
			earthSpawn(en, en.x + en.w / 2, en.y + en.h, (aim.x - (en.x + en.w / 2)) * 0.05, 10.4, {
				color: '#d8c8a0', color2: '#fff6e0', power: 26, width: 40, height: 40,
				shape: 'circle', maxAge: 60, effects: ['slow'], _earthStyle: 'web'
			});
		}
		if(kit.t > 30) earthEnd(en);
	} else if(kit.kind === 'webMaze'){
		if(kit.t === 8 && kit.webs && kit.webs[2]){
			en.x = kit.webs[2].x - en.w / 2;
			en.y = kit.webs[2].y - kit.webs[2].h - 4;
		}
		if(kit.t > 36) earthEnd(en);
	}
}

function tickMud(en, kit){
	if(kit.kind === 'mudslide'){
		if(kit.hitCd > 0) kit.hitCd--;
		en.x += kit.dir * 11.6;
		earthFX({ kind: 'mudstrip', x: en.x + en.w / 2, y: kitFloor(en.x, en.y) - 6, w: 70, h: 22, age: 0, max: 220 });
		if(kit.hitCd <= 0 && earthHit(en, en.x + en.w / 2, en.y + en.h / 2, 50, kitDmg(32), ['horizontalLaunch'])) kit.hitCd = 8;
		kitSlowSet(0.62);
		if(window.EFX && kit.t % 2 === 0) EFX.debris('mud', en.x + en.w / 2 - kit.dir * en.w * 0.4, en.y + en.h - 6, 2, { kind: 'drop', speed: 5, ang: -Math.PI / 2 - kit.dir * 0.9, spread: 0.8 });
		if(kitBlocked(en.x + (kit.dir > 0 ? en.w + 10 : -10), en.y + en.h / 2) || kit.t > 36){
			en._earthNoHit = false;
			earthEnd(en);
		}
	} else if(kit.t > 10) earthEnd(en);
}

function updateEarthDungeonWorld(){
	if(player._kitSlow){ player._kitSlow *= 0.94; if(player._kitSlow < 0.04) player._kitSlow = 0; }
	for(let i = earthWorldFX.length - 1; i >= 0; i--){
		const fx = earthWorldFX[i];
		fx.age++;
		if(fx.kind === 'fault') tickFaultFX(fx);
		else if(fx.kind === 'grip') tickGripFX(fx);
		else if(fx.kind === 'vinepath') tickVinePathFX(fx);
		else if(fx.kind === 'roots') tickRootsFX(fx);
		else if(fx.kind === 'seed') tickSeedFX(fx);
		else if(fx.kind === 'eggsac') tickEggFX(fx);
		else if(fx.kind === 'spiderling') tickLingFX(fx);
		else if(fx.kind === 'maze') tickMazeFX(fx);
		else if(fx.kind === 'relay') tickRelayFX(fx);
		else if(fx.kind === 'rain') tickRainFX(fx);
		else if(fx.kind === 'prism') tickPrismFX(fx);
		else if(fx.kind === 'prison') tickPrisonFX(fx);
		else if(fx.kind === 'mudwave') tickMudWaveFX(fx);
		else if(fx.kind === 'sinkhole') tickSinkFX(fx);
		else if(fx.kind === 'bog') tickBogFX(fx);
		else if(fx.kind === 'decoy' && fx.age === fx.max - 1) earthDecoyBurst(fx);
		else if(fx.kind === 'mudstrip' && circRect(fx.x, fx.y, fx.w * 0.45, player.x, player.y, player.w, player.h)){
			kitSlowSet(0.58);
			if(fx.age % 14 === 0) earthHit(fx.en, fx.x, fx.y, 22, kitDmg(10), []);
		} else if(fx.kind === 'thorntrail' && circRect(fx.x, fx.y, 16, player.x, player.y, player.w, player.h)){
			if(fx.age % 10 === 0) earthHit(fx.en, fx.x, fx.y, 16, kitDmg(12), []);
		}
		if(fx.age >= fx.max) earthWorldFX.splice(i, 1);
	}
}

// the stone decoy bursts into shrapnel when it breaks or expires
function earthDecoyBurst(fx){
	const cx = fx.x + fx.w / 2, cy = fx.y + fx.h * 0.45;
	const aim = kitAim(fx.en);
	for(let i = 0; i < 6; i++){
		const a = Math.atan2(aim.y - cy, aim.x - cx) + (i - 2.5) * 0.28;
		earthSpawn(fx.en, cx, cy, Math.cos(a) * 8, Math.sin(a) * 8 - 2, {
			color: '#8a7350', color2: '#f0e0b8', power: 18, width: 26, height: 26,
			shape: 'circle', gravity: 0.2, maxAge: 70, _earthStyle: 'rock'
		});
	}
	if(window.EFX){ EFX.burst(cx, cy, 'earth', 1.8); EFX.debris('earth', cx, cy, 10, { speed: 7 }); EFX.smoke(cx, cy, 4, { size: 16, c: '#5a4a38', a: 0.5 }); }
	kitShake(5, 8);
}
function tickFaultFX(fx){
	const grow = Math.min(1, fx.age / 16);
	const midX = fx.x + (fx.tx - fx.x) * 0.5;
	if(!fx.split && grow > 0.48){
		fx.split = true;
		fx.lines.push({ x1: midX, y1: fx.y, x2: midX, y2: fx.y, alive: true, off: -48 });
		fx.lines.push({ x1: midX, y1: fx.y, x2: midX, y2: fx.y, alive: true, off: 48 });
		fx.lines[0].alive = false;
	}
	const aim = kitAim(fx.en);
	for(let i = 0; i < fx.lines.length; i++){
		const L = fx.lines[i];
		if(!L.alive && i === 0 && fx.split) continue;
		const t = fx.split && i > 0 ? Math.min(1, (fx.age - 8) / 16) : grow;
		L.x2 = (i === 0 ? fx.x + (fx.tx - fx.x) * t : midX + (fx.tx - midX) * t);
		if(L.off) L.x2 += L.off * t;
		L.y2 = fx.y;
		const airborne = aim.box && (aim.box.y + aim.box.h < fx.y - 20);
		if(window.EFX && fx.age % 2 === 0 && fx.age < 24) EFX.debris('earth', L.x2, fx.y - 4, 1, { speed: 5, floor: fx.y, scale: 0.8 });
		if(!airborne && Math.abs(aim.x - L.x2) < 34 && Math.abs(aim.y - fx.y) < 46){
			earthHit(fx.en, L.x2, fx.y, 28, kitDmg(26), ['stun']);
		}
	}
}
function tickGripFX(fx){
	const aim = kitAim(fx.en);
	for(let i = 0; i < fx.pillars.length; i++){
		const P = fx.pillars[i];
		if(fx.age === 1 && window.EFX){ EFX.debris('earth', P.x, P.y - 4, 3, { speed: 5, floor: P.y }); EFX.smoke(P.x, P.y - 6, 1, { size: 12, c: '#6a5a44', a: 0.45 }); }
		P.h = Math.min(P.maxH, 16 + fx.age * 4.4);
		if(Math.abs(aim.x - P.x) < 20 && aim.y > P.y - P.h){
			kitSlowSet(0.7);
			player.x += aim.x < P.x ? -3.2 : 3.2;
		}
	}
	if((fx.age === 12 || fx.age === 22 || fx.age === 32 || fx.age === 42) && fx.drops < 4){
		fx.drops++;
		earthSpawn(fx.en, fx.cx + (Math.random() - 0.5) * 70, fx.cy - 170, (Math.random() - 0.5) * 2.2, 10.4, {
			color: '#9a8060', color2: '#f2e0b8', power: 34, width: 56, height: 56,
			shape: 'circle', gravity: 0.2, maxAge: 70, trail: 'smoke', effects: ['horizontalLaunch'], _earthStyle: 'boulder'
		});
	}
}
function tickVinePathFX(fx){
	fx.pi = Math.min(1, fx.age / 26);
	if(fx.age === 28 && !fx.erupted){
		fx.erupted = true;
		const real = fx.paths[fx.real], last = real[real.length - 1];
		if(fx.en && !fx.en.dead){
			fx.en.x = last.x - fx.en.w / 2; fx.en.y = last.y - fx.en.h;
			fx.en._earthHidden = false; fx.en._earthNoHit = false;
		}
		earthHit(fx.en, last.x, last.y - 24, 48, kitDmg(36), ['stun']);
		const fake = fx.paths[1 - fx.real], fl = fake[fake.length - 1];
		earthHit(fx.en, fl.x, fl.y - 20, 36, kitDmg(18), []);
		if(window.EFX){
			EFX.burst(last.x, last.y - 20, 'nature', 1.6); EFX.debris('earth', last.x, last.y - 4, 8, { speed: 7, floor: last.y }); EFX.groundWave(last.x, last.y, 90, 'nature');
			EFX.debris('earth', fl.x, fl.y - 4, 4, { speed: 5, floor: fl.y }); EFX.smoke(fl.x, fl.y - 6, 2, { size: 12, c: '#5a4a38', a: 0.5 });
		} else kitSpark(last.x, last.y, 16, { r: 80, g: 170, b: 50 });
		kitShake(6, 10);
	}
}
function tickRootsFX(fx){
	if(fx.age === 22 && !fx.snapped){
		fx.snapped = true;
		const aim = kitAim(fx.en);
		for(let i = 0; i < fx.roots.length; i++){
			fx.roots[i].snap = true;
			earthHit(fx.en, fx.roots[i].x, fx.roots[i].y - 12, 34, kitDmg(22), []);
		}
		earthHit(fx.en, aim.x, aim.y, 30, kitDmg(20), ['stun']);
		fx.snapX = aim.x; fx.snapY = aim.y;
		if(window.EFX){ EFX.burst(aim.x, aim.y, 'nature', 1.3); for(let i = 0; i < fx.roots.length; i++) EFX.debris('earth', fx.roots[i].x, fx.roots[i].y, 2, { speed: 4, floor: fx.roots[i].y + 4 }); }
		kitSlowSet(0.55);
	}
}
function tickSeedFX(fx){
	if(!fx.grown && fx.age > 20){
		fx.grown = true;
		fx.h = atkS(62);
		if(window.EFX){ EFX.debris('earth', fx.x, fx.y, 4, { speed: 4, floor: fx.y + 6 }); EFX.emit('nature', fx.x, fx.y - 20, 6, { speed: 1.5 }); }
	}
	if(fx.grown && circRect(fx.x, fx.y - 28, 22, player.x, player.y, player.w, player.h)){
		kitSlowSet(0.5);
		if(fx.age % 12 === 0) earthHit(fx.en, fx.x, fx.y - 20, 20, kitDmg(14), []);
		if(Math.abs(player.x + player.w / 2 - fx.x) < 16) player.x += player.x < fx.x ? -2.4 : 2.4;
	}
}
function tickEggFX(fx){
	if(!fx.hatched && fx.age === 22){
		fx.hatched = true;
		for(let s = 0; s < 6; s++){
			earthFX({ kind: 'spiderling', en: fx.en, x: fx.x + (s - 2.5) * 20, y: fx.y, age: 0, max: 150, hitCd: 0 });
		}
	}
}
function tickLingFX(fx){
	const aim = kitAim(fx.en);
	fx.x += (aim.x - fx.x) * 0.11;
	fx.y += (aim.y - fx.y) * 0.08;
	if(fx.hitCd > 0) fx.hitCd--;
	if(fx.hitCd <= 0 && earthHit(fx.en, fx.x, fx.y, 16, kitDmg(12), ['poison'])) fx.hitCd = 10;
}
function tickMazeFX(fx){
	const aim = kitAim(fx.en);
	for(let i = 0; i < fx.webs.length; i++){
		const w = fx.webs[i];
		if(aim.x > w.x - w.w / 2 && aim.x < w.x + w.w / 2 && aim.y > w.y - w.h && aim.y < w.y + 12) kitSlowSet(0.72);
	}
	if((fx.age === 16 || fx.age === 28 || fx.age === 40) && fx.en){
		const ox = fx.en.x + fx.en.w / 2, oy = fx.en.y + fx.en.h * 0.3;
		const d = Math.hypot(aim.x - ox, aim.y - oy) || 1;
		earthSpawn(fx.en, ox, oy, (aim.x - ox) / d * 11.2, (aim.y - oy) / d * 11.2, {
			color: '#e8d8b8', color2: '#fff8e8', power: 30, width: 46, height: 22,
			shape: 'blade', maxAge: 70, effects: ['slow'], _earthStyle: 'web'
		});
	}
}
function tickRelayFX(fx){
	const aim = kitLead(fx.en, 8);
	const dest = fx.orb.i < fx.nodes.length ? fx.nodes[fx.orb.i] : { x: aim.x, y: aim.y };
	const dx = dest.x - fx.orb.x, dy = dest.y - fx.orb.y, d = Math.hypot(dx, dy) || 1;
	fx.orb.x += dx / d * 14.2;
	fx.orb.y += dy / d * 14.2;
	earthHit(fx.en, fx.orb.x, fx.orb.y, 30, kitDmg(24), []);
	if(d < 18){
		if(window.EFX){ EFX.flash(fx.orb.x, fx.orb.y, 30, 'crystal', 8); EFX.sparks('crystal', fx.orb.x, fx.orb.y, 6, { speed: 5 }); }
		fx.orb.i++;
		if(fx.orb.i > fx.nodes.length) fx.age = fx.max;
	}
}
function tickRainFX(fx){
	fx.ang += 0.07;
	if(fx.age % 4 === 0 && fx.drops < 14){
		fx.drops++;
		const ox = fx.cx + Math.cos(fx.ang + fx.drops * 0.62) * atkS(118);
		earthSpawn(fx.en, ox, fx.cy - 210, Math.sin(fx.ang) * 1.6, 9.6, {
			color: '#d080ff', color2: '#fff0ff', power: 26, width: 34, height: 48,
			shape: 'spike', maxAge: 70, gravity: 0.14, _earthStyle: 'crystal'
		});
	}
}
function tickPrismFX(fx){
	if(!fx.pending && !fx.volley && fx.age === 110){ fx.pending = 'volley'; fx.copyAt = fx.age; fx.volley = true; }
	if(fx.pending && fx.age === fx.copyAt){
		const aim = kitLead(fx.en, 10);
		const dx = aim.x - fx.x, dy = aim.y - fx.y, d = Math.hypot(dx, dy) || 1;
		for(let k = 0; k < 3; k++){
			const spr = 0.22 * (k - 1);
			earthSpawn(fx.en, fx.x + (fx.w || 20) / 2, fx.y + 10, Math.cos(Math.atan2(dy, dx) + spr) * 11.4, Math.sin(Math.atan2(dy, dx) + spr) * 11.4, {
				color: '#e0a0ff', color2: '#ffffff', power: 28, width: 42, height: 42,
				shape: 'spike', maxAge: 70, trail: 'spark', _earthStyle: 'crystal'
			});
		}
		fx.pending = null;
	}
}
function tickPrisonFX(fx){
	const aim = kitAim(fx.en);
	fx.cx += (aim.x - fx.cx) * 0.05;
	for(let i = 0; i < fx.gems.length; i++) fx.gems[i].r = Math.max(16, fx.gems[i].r - 2.1);
	if(fx.age === 38 && !fx.closed){
		fx.closed = true;
		let trapped = Math.hypot(aim.x - fx.cx, aim.y - fx.cy) < 42;
		if(window.EFX){ EFX.flash(fx.cx, fx.cy, 46, 'crystal', 10); EFX.ring(fx.cx, fx.cy, 50, 6, 'crystal', 14, { width: 5 }); }
		if(trapped){
			earthHit(fx.en, fx.cx, fx.cy, 48, kitDmg(38), ['stun']);
			for(let i = 0; i < 10; i++){
				const a = i * Math.PI / 5;
				earthSpawn(fx.en, fx.cx, fx.cy, Math.cos(a) * 8.8, Math.sin(a) * 8.8, {
					color: '#e090ff', color2: '#ffffff', power: 28, width: 36, height: 36,
					shape: 'spike', maxAge: 50, _earthStyle: 'crystal'
				});
			}
			kitShake(8, 12);
		}
	}
}
function tickMudWaveFX(fx){
	if(fx.hitCd > 0) fx.hitCd--;
	fx.x += fx.dir * 10.6;
	fx.w = Math.min(atkS(210), fx.w + 4.2);
	if(window.EFX && fx.age % 2 === 0) EFX.debris('mud', fx.x + fx.dir * fx.w * 0.3, fx.y - 14, 2, { kind: 'drop', speed: 5, ang: -Math.PI / 2 + fx.dir * 0.5, spread: 0.9, floor: fx.y + 6 });
	earthFX({ kind: 'mudstrip', x: fx.x, y: fx.y, w: 50, h: 18, age: 0, max: 200 });
	const aim = kitAim(fx.en);
	if(Math.abs(aim.x - fx.x) < fx.w * 0.48 && Math.abs(aim.y - fx.y) < 36){
		kitSlowSet(0.64);
		if(fx.hitCd <= 0 && earthHit(fx.en, fx.x, fx.y, 28, kitDmg(22), [])) fx.hitCd = 10;
	}
}
function tickSinkFX(fx){
	const aim = kitAim(fx.en);
	const dx = fx.cx - aim.x;
	if(Math.abs(dx) < fx.r && !kitFriendly(fx.en)){
		player.x += (dx > 0 ? 1 : -1) * 2.15;
		kitSlowSet(0.5);
		if(Math.abs(dx) < 28 && fx.age % 12 === 0) earthHit(fx.en, fx.cx, fx.cy, 24, kitDmg(16), []);
	}
	if(fx.age === 14 || fx.age === 26 || fx.age === 38 || fx.age === 50){
		const edge = fx.cx + (aim.x >= fx.cx ? fx.r * 0.75 : -fx.r * 0.75);
		const ox = (fx.en ? fx.en.x + fx.en.w / 2 : fx.cx);
		earthSpawn(fx.en, ox, (fx.en ? fx.en.y + 8 : fx.cy - 40), (edge - ox) * 0.055, -3.2, {
			color: '#6a5438', color2: '#d4b888', power: 30, width: 46, height: 46,
			shape: 'circle', gravity: 0.18, maxAge: 70, _earthStyle: 'mud'
		});
	}
}
function tickBogFX(fx){
	if(!fx.struck && fx.age === 22){
		fx.struck = true;
		const aim = kitLead(fx.en, 8);
		earthSpawn(fx.en, fx.x + 18, fx.y + 10, (aim.x - fx.x) * 0.07, -1.2, {
			color: '#6a5438', color2: '#d4b888', power: 28, width: 50, height: 40,
			shape: 'circle', gravity: 0.14, maxAge: 55, _earthStyle: 'mud'
		});
		earthHit(fx.en, fx.x + 16, fx.y + 20, 36, kitDmg(20), []);
		if(window.EFX){ EFX.burst(fx.x + fx.w / 2, fx.y + fx.h * 0.4, 'mud', 1.4); EFX.debris('mud', fx.x + fx.w / 2, fx.y + fx.h * 0.4, 8, { kind: 'drop', speed: 6 }); }
	}
}

function earthKitTryBounce(p){
	if(!p || !p._earthRoll) return false;
	const prevX = p.x - p.vx, prevY = p.y - p.vy;
	if(kitBlocked(p.x, prevY)){ p.vy = -Math.abs(p.vy) * 0.92; p.y = prevY; }
	if(kitBlocked(prevX, p.y)){ p.vx = -p.vx * 1.05; p.x = prevX; }
	p._earthBounces = (p._earthBounces || 0) + 1;
	if(window.EFX){ EFX.debris('earth', p.x, p.y + p.height * 0.3, 5, { speed: 5 }); EFX.smoke(p.x, p.y + p.height * 0.3, 2, { size: 14, c: '#6a5a44', a: 0.5 }); EFX.groundWave(p.x, p.y + p.height * 0.4, 70, 'earth', 16); }
	kitShake(4, 6);
	if(p.age >= (p._earthSplitAt || 90) || p._earthBounces >= 3){
		for(let i = 0; i < 5; i++){
			const a = -1.1 + i * 0.55;
			const em = spawnEnemyProj(p.x, p.y, Math.cos(a) * 6.4 * (p.vx >= 0 ? 1 : -1), Math.sin(a) * 4.2 - 2, {
				color: '#8a7350', color2: '#f0e0b8', power: 22, width: 36, height: 36,
				shape: 'circle', gravity: 0.22, maxAge: 80, trail: 'smoke', noZoneNerf: true
			});
			if(em){ em._earthStyle = 'rock'; if(p.necroFriendly) em.necroFriendly = true; }
		}
		p.age = p.maxAge;
	}
	return true;
}

function earthKitInterceptProj(p){
	if(!p || p.hasHit) return false;
	for(let i = 0; i < earthWorldFX.length; i++){
		const fx = earthWorldFX[i];
		if(fx.kind !== 'decoy' || fx.hp <= 0) continue;
		if(circRect(p.x, p.y, 12, fx.x, fx.y, fx.w, fx.h)){
			fx.hp--; p.hasHit = true; kitSpark(p.x, p.y, 8, { r: 160, g: 130, b: 80 });
			if(fx.hp <= 0){ fx.age = fx.max - 2; }
			return true;
		}
	}
	return false;
}

function earthKitSpriteRow(en){
	const type = (en && (en.necroType || en.type)) || '';
	if(!EARTH_KIT_TYPES[type]) return null;
	if(en.dead){
		const meta = (typeof SPRITE_SHEET_META !== 'undefined') ? SPRITE_SHEET_META[type] : null;
		return (meta && meta.rows) ? meta.rows - 1 : 3;
	}
	if(en.earthKit) return 2;
	return null;
}

/* ---------- drawing (EFX) ---------- */
// a radial spider web, r = radius, spin = rotation
function earthDrawWeb(x, y, r, spin, a, squash){
	const sx = x - camera.x, sy = y - camera.y;
	ctx.save(); ctx.translate(sx, sy); ctx.rotate(spin || 0); ctx.scale(1, squash || 1);
	ctx.globalAlpha = a == null ? 1 : a;
	ctx.strokeStyle = 'rgba(250,244,228,0.9)'; ctx.lineWidth = 1.4;
	ctx.beginPath();
	for(let i = 0; i < 8; i++){ const an = i / 8 * Math.PI * 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); }
	ctx.stroke();
	ctx.lineWidth = 1;
	for(let k = 1; k <= 3; k++){
		const rr = r * k / 3.4;
		ctx.beginPath();
		for(let i = 0; i <= 8; i++){ const an = i / 8 * Math.PI * 2, sag = (i % 2 ? 0.86 : 1); const px = Math.cos(an) * rr * sag, py = Math.sin(an) * rr * sag; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
		ctx.stroke();
	}
	ctx.globalCompositeOperation = 'lighter';
	EFX.glowS(0, 0, r * 0.6, '#f4ecd8', 0.25);
	ctx.restore();
}
function earthDrawSpiderling(x, y, t){
	const sx = x - camera.x, sy = y - camera.y;
	ctx.save(); ctx.translate(sx, sy);
	ctx.strokeStyle = '#1a120a'; ctx.lineWidth = 1.4;
	for(let i = 0; i < 4; i++){
		const k = Math.sin(t * 0.6 + i * 1.6) * 2;
		ctx.beginPath(); ctx.moveTo(-2, 0); ctx.lineTo(-7 - i, -4 + i * 2.5 + k); ctx.lineTo(-10 - i, 3 + i * 1.5); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(7 + i, -4 + i * 2.5 - k); ctx.lineTo(10 + i, 3 + i * 1.5); ctx.stroke();
	}
	ctx.fillStyle = '#2e2014'; ctx.beginPath(); ctx.ellipse(0, 0, 6, 4.5, 0, 0, Math.PI * 2); ctx.fill();
	ctx.fillStyle = '#ff5544'; ctx.fillRect(-2.5, -2, 1.6, 1.6); ctx.fillRect(1, -2, 1.6, 1.6);
	ctx.restore();
}
// a thorny vine from (x0,y0) curving to (x1,y1)
function earthDrawVine(x0, y0, x1, y1, w, a, t){
	const sx0 = x0 - camera.x, sy0 = y0 - camera.y, sx1 = x1 - camera.x, sy1 = y1 - camera.y;
	const mx = (sx0 + sx1) / 2 + Math.sin(t * 0.2 + x0) * 18, my = Math.min(sy0, sy1) - 30;
	ctx.save(); ctx.globalAlpha = a == null ? 1 : a; ctx.lineCap = 'round';
	ctx.strokeStyle = '#1f3d12'; ctx.lineWidth = w + 3;
	ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.quadraticCurveTo(mx, my, sx1, sy1); ctx.stroke();
	ctx.strokeStyle = '#5aa630'; ctx.lineWidth = w;
	ctx.stroke();
	ctx.strokeStyle = '#b8ee66'; ctx.lineWidth = Math.max(1, w * 0.25);
	ctx.stroke();
	// thorns along the curve
	ctx.fillStyle = '#e8ffc0';
	for(let k = 0.2; k < 0.95; k += 0.18){
		const u = 1 - k;
		const px = u * u * sx0 + 2 * u * k * mx + k * k * sx1, py = u * u * sy0 + 2 * u * k * my + k * k * sy1;
		ctx.beginPath(); ctx.moveTo(px - 3, py); ctx.lineTo(px, py - 7); ctx.lineTo(px + 3, py); ctx.fill();
	}
	ctx.restore();
}
function drawEarthKitProj(p){
	if(!window.EFX) return;
	const style = p._earthStyle || 'rock', r = Math.max(p.width, p.height) * 0.42;
	if(style === 'boulder' || style === 'rock'){
		EFX.bolt(p, p.x, p.y, r * 1.05, 'earth', { spin: 0.2 * (p.vx >= 0 ? 1 : -1), moteEvery: style === 'boulder' ? 2 : 4 });
		if(style === 'boulder' && (p.age & 3) === 0) EFX.debris('earth', p.x, p.y + r * 0.6, 1, { speed: 3, scale: 0.6 });
	} else if(style === 'crystal'){
		EFX.bolt(p, p.x, p.y, r * 0.8, 'crystal', { trailLen: 8 });
	} else if(style === 'web'){
		const ang = Math.atan2(p.vy || 0, p.vx || 1);
		const h = EFX.track(p, 6); EFX.trail(h, r * 0.4, 'silk', { ribbon: false, alpha: 0.3 });
		earthDrawWeb(p.x, p.y, r * 1.05, ang + (p.age || 0) * 0.08, 1, p.width > p.height * 1.6 ? 0.5 : 0.9);
	} else if(style === 'mud'){
		EFX.bolt(p, p.x, p.y, r * 0.9, 'mud', { trailLen: 6 });
	} else EFX.bolt(p, p.x, p.y, r, 'earth');
}

function drawEarthDungeonWorld(){
	if(!window.EFX) return;
	EFX.bind();
	for(let i = 0; i < earthWorldFX.length; i++){
		const fx = earthWorldFX[i];
		const u = fx.max ? fx.age / fx.max : 0;
		const fade = u > 0.85 ? (1 - u) / 0.15 : 1;
		if(fx.kind === 'decoy'){
			// a stacked-stone likeness of the golem; cracks spread as it is hit
			const cx = fx.x + fx.w / 2, by = fx.y + fx.h;
			const s1 = fx.w * 0.62, s2 = fx.w * 0.5, s3 = fx.w * 0.34;
			ctx.save(); ctx.globalAlpha = Math.min(1, fx.age / 10) * fade;
			ctx.drawImage(EFX.rockSprite('earth', 1), cx - s1 - camera.x, by - s1 * 1.7 - camera.y, s1 * 2, s1 * 2);
			ctx.drawImage(EFX.rockSprite('earth', 4), cx - s2 - camera.x, by - s1 * 1.7 - s2 * 1.4 - camera.y, s2 * 2, s2 * 2);
			ctx.drawImage(EFX.rockSprite('earth', 6), cx - s3 - camera.x, by - s1 * 1.7 - s2 * 1.4 - s3 * 1.2 - camera.y, s3 * 2, s3 * 2);
			const dmg = 1 - Math.max(0, fx.hp) / 6;
			if(dmg > 0){ ctx.strokeStyle = 'rgba(30,20,10,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - camera.x - 8, fx.y + 10 - camera.y); ctx.lineTo(cx - camera.x + 4, fx.y + 10 + fx.h * dmg * 0.6 - camera.y); ctx.lineTo(cx - camera.x - 6, fx.y + fx.h * dmg - camera.y); ctx.stroke(); }
			ctx.restore();
		} else if(fx.kind === 'bog'){
			// a dripping mud double rising out of a puddle
			const rise = Math.min(1, fx.age / 16), cx = fx.x + fx.w / 2 - camera.x, by = fx.y + fx.h - camera.y;
			const H = fx.h * rise, W = fx.w, sway = Math.sin(fx.age * 0.15) * 3;
			ctx.save(); ctx.globalAlpha = fade;
			ctx.fillStyle = '#3e2a14'; ctx.beginPath(); ctx.ellipse(cx, by + 2, W * 0.9, 6, 0, 0, Math.PI * 2); ctx.fill();
			const g = ctx.createLinearGradient(cx - W / 2, by - H, cx + W / 2, by);
			g.addColorStop(0, '#b89058'); g.addColorStop(0.5, '#7a5430'); g.addColorStop(1, '#3a2614');
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.moveTo(cx - W * 0.55, by);
			ctx.quadraticCurveTo(cx - W * 0.62, by - H * 0.55, cx - W * 0.32 + sway, by - H * 0.78);
			ctx.lineTo(cx - W * 0.62 + sway, by - H * 0.5);
			ctx.lineTo(cx - W * 0.42 + sway, by - H * 0.46);
			ctx.quadraticCurveTo(cx - W * 0.25 + sway, by - H * 0.98, cx + sway, by - H);
			ctx.quadraticCurveTo(cx + W * 0.28 + sway, by - H * 0.98, cx + W * 0.36 + sway, by - H * 0.74);
			ctx.lineTo(cx + W * 0.66 + sway, by - H * 0.42);
			ctx.lineTo(cx + W * 0.44 + sway, by - H * 0.4);
			ctx.quadraticCurveTo(cx + W * 0.62, by - H * 0.4, cx + W * 0.55, by);
			ctx.closePath(); ctx.fill();
			// eyes and a glossy streak
			ctx.fillStyle = 'rgba(255,220,140,' + (0.8 * rise) + ')';
			ctx.fillRect(cx - 6 + sway, by - H * 0.82, 3, 3); ctx.fillRect(cx + 3 + sway, by - H * 0.82, 3, 3);
			ctx.strokeStyle = 'rgba(240,215,170,0.45)'; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.moveTo(cx - W * 0.2 + sway, by - H * 0.7); ctx.quadraticCurveTo(cx - W * 0.3, by - H * 0.4, cx - W * 0.25, by - H * 0.15); ctx.stroke();
			ctx.restore();
			if(fx.age % 4 === 0) EFX.add({ k: 'drop', x: fx.x + fx.w / 2 + (Math.random() - 0.5) * W, y: fx.y + fx.h - H * (0.3 + Math.random() * 0.5), vx: 0, vy: 0.5, g: 0.25, drag: 0.99, size: 2, c: '#7a5430', c2: '#e8d0a0', max: 24 });
		} else if(fx.kind === 'prism'){
			EFX.ghost(fx.x + fx.w / 2, fx.y + fx.h / 2, fx.w, fx.h, 'crystal', 0.8 * fade, fx.age);
			ctx.save(); ctx.globalAlpha = 0.7 * fade; ctx.translate(fx.x + fx.w / 2 - camera.x, fx.y + fx.h * 0.3 - camera.y); ctx.rotate(fx.age * 0.05);
			ctx.strokeStyle = '#f2dcff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(14, 8); ctx.lineTo(-14, 8); ctx.closePath(); ctx.stroke();
			ctx.restore();
			if(fx.pending) EFX.charge(fx.x + fx.w / 2, fx.y + fx.h * 0.3, 'crystal', 30, 1, 10);
		} else if(fx.kind === 'seed'){
			if(!fx.grown){
				const k = fx.age / 20, sx = fx.x - camera.x, sy = fx.y - camera.y;
				ctx.save(); ctx.fillStyle = '#6a4a1c'; ctx.beginPath(); ctx.ellipse(sx, sy, 6, 5, 0, 0, Math.PI * 2); ctx.fill();
				ctx.globalCompositeOperation = 'lighter'; EFX.glowS(sx, sy, 10 + 8 * k, '#8edc48', 0.3 + 0.5 * k * (0.5 + 0.5 * Math.sin(fx.age * 0.8))); ctx.restore();
			} else {
				// a thorn bush: three curling stalks with barbs
				const h = (fx.h || 50) * Math.min(1, (fx.age - 20) / 10) * fade;
				for(let k = -1; k <= 1; k++) earthDrawVine(fx.x + k * 6, fx.y + 4, fx.x + k * 16 + Math.sin(fx.age * 0.05 + k) * 4, fx.y - h * (k ? 0.8 : 1), 4, fade, fx.age + k * 10);
			}
		} else if(fx.kind === 'mudstrip'){
			const sx = fx.x - camera.x, sy = fx.y - camera.y + 4, a = Math.min(1, fx.age / 6) * (u > 0.7 ? (1 - u) / 0.3 : 1);
			ctx.save(); ctx.globalAlpha = 0.85 * a;
			ctx.fillStyle = '#3e2a14'; ctx.beginPath(); ctx.ellipse(sx, sy, fx.w * 0.62, 8, 0, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = 'rgba(232,208,160,0.35)'; ctx.beginPath(); ctx.ellipse(sx - fx.w * 0.1, sy - 3, fx.w * 0.3, 2.5, 0, 0, Math.PI * 2); ctx.fill();
			ctx.restore();
			if(fx.age % 23 === 0) EFX.mote('mud', fx.x + (Math.random() - 0.5) * fx.w, fx.y, 0, -1);
		} else if(fx.kind === 'eggsac'){
			const sx = fx.x - camera.x, sy = fx.y - camera.y, beat = 1 + 0.06 * Math.sin(fx.age * (fx.age > 14 ? 0.9 : 0.3));
			ctx.save();
			const g = ctx.createRadialGradient(sx - 5, sy - 6, 2, sx, sy, 18 * beat);
			g.addColorStop(0, '#fffaf0'); g.addColorStop(0.6, '#e8d8b0'); g.addColorStop(1, '#8a6840');
			ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx, sy, 16 * beat, 19 * beat, 0, 0, Math.PI * 2); ctx.fill();
			ctx.strokeStyle = 'rgba(255,250,235,0.7)'; ctx.lineWidth = 1;
			for(let k = 0; k < 4; k++){ ctx.beginPath(); ctx.ellipse(sx, sy, 16 * beat * (0.3 + k * 0.22), 19 * beat, 0, 0, Math.PI * 2); ctx.stroke(); }
			ctx.beginPath(); ctx.moveTo(sx, sy - 19); ctx.lineTo(sx, sy - 80); ctx.stroke();
			ctx.restore();
		} else if(fx.kind === 'spiderling'){
			earthDrawSpiderling(fx.x, fx.y, fx.age);
		} else if(fx.kind === 'thorntrail'){
			// scattered thorn caltrops
			const sx = fx.x - camera.x, sy = fx.y - camera.y, a = 1 - u;
			ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#4f8a26'; ctx.strokeStyle = '#d8ff9a'; ctx.lineWidth = 1;
			for(let k = 0; k < 3; k++){
				const an = k * 2.1 + fx.x * 0.1;
				ctx.beginPath(); ctx.moveTo(sx + Math.cos(an) * 7, sy + Math.sin(an) * 7); ctx.lineTo(sx + Math.cos(an + 2.6) * 3, sy + Math.sin(an + 2.6) * 3); ctx.lineTo(sx + Math.cos(an - 2.6) * 3, sy + Math.sin(an - 2.6) * 3); ctx.closePath(); ctx.fill(); ctx.stroke();
			}
			ctx.restore();
		} else if(fx.kind === 'fault') drawFaultFX(fx);
		else if(fx.kind === 'grip') drawGripFX(fx);
		else if(fx.kind === 'vinepath') drawVinePathFX(fx);
		else if(fx.kind === 'roots') drawRootsFX(fx);
		else if(fx.kind === 'maze') drawMazeFX(fx);
		else if(fx.kind === 'relay') drawRelayFX(fx);
		else if(fx.kind === 'prison') drawPrisonFX(fx);
		else if(fx.kind === 'sinkhole') drawSinkFX(fx);
		else if(fx.kind === 'rain'){
			EFX.warnCircle(fx.cx, kitFloor(fx.cx, fx.cy) - 2, atkS(130), Math.min(1, fx.age / 20), 'crystal', { flat: 0.25, alpha: 1 - u });
		} else if(fx.kind === 'mudwave'){
			// a rolling crest of mud
			const P = EFX.pal('mud'), sx = fx.x - camera.x, sy = fx.y - camera.y + 6;
			ctx.save();
			for(let k = 0; k < 5; k++){
				const off = (k - 2) * fx.w * 0.17, hh = (26 + 10 * Math.sin(fx.age * 0.5 + k)) * (1 - Math.abs(k - 2) * 0.22);
				const g = ctx.createLinearGradient(0, sy - hh, 0, sy);
				g.addColorStop(0, P.core); g.addColorStop(0.35, P.mid); g.addColorStop(1, P.outer);
				ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx + off + fx.dir * 6, sy - hh * 0.4, fx.w * 0.17, hh * 0.7, fx.dir * 0.3, 0, Math.PI * 2); ctx.fill();
			}
			ctx.restore();
		}
	}
	if(typeof enemies !== 'undefined') for(let i = 0; i < enemies.length; i++) drawEarthEnemyFX(enemies[i]);
	if(typeof playerMinions !== 'undefined') for(let i = 0; i < playerMinions.length; i++) drawEarthEnemyFX(playerMinions[i]);
}

function drawFaultFX(fx){
	const heat = fx.age < 20 ? 1 : Math.max(0, 1 - (fx.age - 20) / 40);
	for(let i = 0; i < fx.lines.length; i++){
		const L = fx.lines[i];
		if(i === 0 && fx.split) continue;
		const n = 8, pts = [];
		for(let k = 0; k <= n; k++){ const t = k / n; pts.push(L.x1 + (L.x2 - L.x1) * t + (k % 2 ? 4 : -3), L.y1 + (k % 3 === 1 ? 2 : 0)); }
		EFX.crack(pts, 'sand', { width: 5, heat });
		if(fx.age < 30) EFX.spike(L.x2, L.y2 + 3, 26 * heat, 18, 'earth', { lean: Math.sign(L.x2 - L.x1) * 0.25 });
	}
}
function drawGripFX(fx){
	EFX.warnCircle(fx.cx, fx.cy, atkS(96), Math.min(1, fx.age / 12), 'earth', { flat: 0.25, alpha: Math.max(0, 1 - fx.age / 60) });
	for(let i = 0; i < fx.pillars.length; i++){
		const P = fx.pillars[i];
		EFX.spike(P.x, P.y + 4, P.h, 30, 'earth', { lean: (fx.cx - P.x) / 600 });
	}
}
function drawVinePathFX(fx){
	for(let p = 0; p < fx.paths.length; p++){
		const path = fx.paths[p], vis = Math.min(1, fx.age / 20);
		const pts = [];
		for(let i = 0; i < path.length; i++) pts.push(path[i].x, path[i].y + 2);
		if(!fx.erupted){
			EFX.crack(pts, 'nature', { progress: vis, width: 3, heat: 0.6 });
			// the burrowing tip throws up dirt
			const seg = Math.min(path.length - 1, Math.floor(vis * (path.length - 1)));
			const a = path[seg], b = path[Math.min(path.length - 1, seg + 1)], k = vis * (path.length - 1) - seg;
			const hx = a.x + (b.x - a.x) * k;
			if(fx.age % 2 === 0) EFX.debris('earth', hx, a.y - 2, 1, { speed: 3, floor: a.y, scale: 0.6 });
		}
	}
	if(fx.erupted && fx.age < fx.max){
		const real = fx.paths[fx.real], last = real[real.length - 1], k = Math.min(1, (fx.age - 28) / 6), a = 1 - Math.max(0, (fx.age - 40) / 30);
		for(let j = -1; j <= 1; j++) earthDrawVine(last.x + j * 12, last.y + 4, last.x + j * 26, last.y - 70 * k, 6, a, fx.age + j);
	}
}
function drawRootsFX(fx){
	for(let i = 0; i < fx.roots.length; i++){
		const r = fx.roots[i];
		if(!r.snap){
			const k = Math.min(1, fx.age / 22);
			earthDrawVine(r.x, r.y + 4, r.x + Math.sin(i) * 6, r.y - 10 - 18 * k, 3, 0.9, fx.age + i * 5);
		} else {
			const a = Math.max(0, 1 - (fx.age - 22) / 40);
			earthDrawVine(r.x, r.y + 4, fx.snapX != null ? fx.snapX : r.x, fx.snapY != null ? fx.snapY : r.y - 30, 5, a, fx.age + i * 5);
		}
	}
}
function drawMazeFX(fx){
	const a = fx.age < 10 ? fx.age / 10 : (fx.age > fx.max - 20 ? (fx.max - fx.age) / 20 : 1);
	for(let i = 0; i < fx.webs.length; i++){
		const w = fx.webs[i];
		const x0 = w.x - w.w / 2 - camera.x, y0 = w.y - w.h - camera.y;
		ctx.save(); ctx.globalAlpha = a * 0.85; ctx.strokeStyle = 'rgba(250,244,228,0.85)'; ctx.lineWidth = 1.2;
		ctx.beginPath();
		ctx.moveTo(x0, y0); ctx.lineTo(x0 + w.w, y0 + w.h); ctx.moveTo(x0 + w.w, y0); ctx.lineTo(x0, y0 + w.h);
		ctx.moveTo(x0 + w.w / 2, y0); ctx.lineTo(x0 + w.w / 2, y0 + w.h);
		ctx.stroke();
		ctx.restore();
		earthDrawWeb(w.x, w.y - w.h / 2, Math.min(w.w, w.h) * 0.5, i * 0.4, a * 0.9, 1);
	}
}
function drawRelayFX(fx){
	const src = fx.en ? { x: fx.en.x + fx.en.w / 2, y: fx.en.y + fx.en.h * 0.28 } : fx.nodes[0];
	let prev = src;
	for(let i = 0; i < fx.nodes.length; i++){
		const N = fx.nodes[i];
		EFX.beam(prev.x, prev.y, N.x, N.y, i < (fx.orb ? fx.orb.i : 0) ? 3 : 1.5, 'crystal', { alpha: i < (fx.orb ? fx.orb.i : 0) ? 0.9 : 0.35 });
		prev = N;
	}
	for(let i = 0; i < fx.nodes.length; i++){
		const N = fx.nodes[i], sx = N.x - camera.x, sy = N.y - camera.y + Math.sin(fx.age * 0.1 + i) * 3;
		ctx.save(); ctx.globalCompositeOperation = 'lighter'; EFX.glowS(sx, sy, 22, '#9a5cff', 0.5); ctx.restore();
		ctx.save(); ctx.translate(sx, sy); ctx.rotate(fx.age * 0.04 + i);
		const g = ctx.createLinearGradient(-8, -12, 8, 12); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#e6b8ff'); g.addColorStop(1, '#9a5cff');
		ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(8, 0); ctx.lineTo(0, 13); ctx.lineTo(-8, 0); ctx.closePath(); ctx.fill();
		ctx.restore();
	}
	if(fx.orb){ EFX.bolt(fx.orb, fx.orb.x, fx.orb.y, 11, 'crystal', { ang: fx.age * 0.3 }); fx.orb.age = fx.age; }
}
function drawPrisonFX(fx){
	EFX.warnCircle(fx.cx, fx.cy, 48, Math.min(1, fx.age / 38), 'crystal', { alpha: fx.closed ? Math.max(0, 1 - (fx.age - 38) / 20) : 1 });
	for(let i = 0; i < fx.gems.length; i++){
		const g = fx.gems[i];
		const an = g.ang + fx.age * 0.08, gx = fx.cx + Math.cos(an) * g.r, gy = fx.cy + Math.sin(an) * g.r * 0.35;
		g.age = fx.age; g.x = gx; g.y = gy;
		EFX.bolt(g, gx, gy, 12, 'crystal', { ang: -Math.PI / 2, trailLen: 6, moteEvery: 5 });
	}
}
function drawSinkFX(fx){
	// a swirling sinkhole: dark core, turning rings, debris sucked in
	const sx = fx.cx - camera.x, sy = fx.cy - camera.y + 4, a = fx.age < 10 ? fx.age / 10 : (fx.age > fx.max - 15 ? (fx.max - fx.age) / 15 : 1);
	ctx.save(); ctx.globalAlpha = a;
	const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, fx.r);
	g.addColorStop(0, 'rgba(10,6,2,0.95)'); g.addColorStop(0.5, 'rgba(70,46,22,0.6)'); g.addColorStop(1, 'rgba(110,80,46,0)');
	ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(sx, sy, fx.r, fx.r * 0.28, 0, 0, Math.PI * 2); ctx.fill();
	ctx.strokeStyle = 'rgba(200,160,100,0.5)'; ctx.lineWidth = 2;
	for(let k = 0; k < 3; k++){ const rr = fx.r * (0.3 + k * 0.22), st = fx.age * 0.08 * (k + 1); ctx.beginPath(); ctx.ellipse(sx, sy, rr, rr * 0.28, 0, st, st + 2.4); ctx.stroke(); }
	ctx.restore();
	if(fx.age % 3 === 0){
		const side = Math.random() < 0.5 ? -1 : 1, d = fx.r * (0.7 + Math.random() * 0.3);
		EFX.add({ k: 'gather', x: fx.cx + side * d, y: fx.cy - 2, sx: fx.cx + side * d, sy: fx.cy - 2, tx: fx.cx, ty: fx.cy + 2, size: 2, c: '#e8d0a0', c2: '#8a6236', max: 26 });
	}
}

function drawEarthEnemyFX(en){
	if(!en || en.dead || !en.earthKit || !window.EFX) return;
	const kit = en.earthKit;
	if(kit.kind === 'ceilingDrop'){
		const fl = kitFloor(kit.dropX, en.y);
		EFX.warnCircle(kit.dropX, fl, 40, kit.phase === 'drop' ? 1 : Math.min(1, (kit.hang || 0) / 14), 'silk', { flat: 0.3 });
		ctx.save(); ctx.strokeStyle = 'rgba(250,244,228,0.75)'; ctx.lineWidth = 1.2;
		ctx.beginPath(); ctx.moveTo(en.x + en.w / 2 - camera.x, en.y - camera.y); ctx.lineTo(en.x + en.w / 2 - camera.x, en.y - 400 - camera.y); ctx.stroke(); ctx.restore();
	}
	if(kit.kind === 'webSwing'){
		ctx.save(); ctx.strokeStyle = 'rgba(250,244,228,0.85)'; ctx.lineWidth = 1.5;
		ctx.beginPath(); ctx.moveTo(kit.ox - camera.x, kit.oy - camera.y);
		ctx.lineTo(en.x + en.w / 2 - camera.x, en.y - camera.y); ctx.stroke(); ctx.restore();
		earthDrawWeb(kit.ox, kit.oy, 10, 0, 0.8, 1);
	}
	if(kit.kind === 'thornWheel'){
		// a spinning ring of thorns around the curled crawler
		const cx = en.x + en.w / 2, cy = en.y + en.h / 2, R = Math.max(en.w, en.h) * 0.75;
		ctx.save(); ctx.translate(cx - camera.x, cy - camera.y); ctx.rotate(kit.t * 0.5 * kit.dir);
		ctx.strokeStyle = '#3f8a22'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();
		ctx.fillStyle = '#d8ff9a';
		for(let i = 0; i < 10; i++){ const a = i / 10 * Math.PI * 2; ctx.save(); ctx.rotate(a); ctx.beginPath(); ctx.moveTo(R - 3, -4); ctx.lineTo(R + 9, 0); ctx.lineTo(R - 3, 4); ctx.fill(); ctx.restore(); }
		ctx.restore();
		if(kit.t % 2 === 0) EFX.emit('nature', cx, en.y + en.h, 1, { speed: 1.5 });
	}
	if(kit.kind === 'mudslide' && kit.t % 2 === 0) EFX.smoke(en.x + en.w / 2, en.y + en.h - 6, 1, { size: 10, c: '#5a4024', a: 0.5 });
}

function registerEarthDungeonCasts(map){
	const casts = {
		castGolemBoulderRoll, castGolemFaultStep, castGolemStoneDecoy, castGolemGravityGrip,
		castVineTunnel, castVineThornWheel, castVineGraspingGround, castVineSeedBomb,
		castSpiderCeilingDrop, castSpiderWebSwing, castSpiderEggSac, castSpiderWebMaze,
		castCrystalRelay, castCrystalShardRain, castCrystalPrismClone, castCrystalPrison,
		castMudWave, castMudBogClone, castMudSinkhole, castMudslide
	};
	for(const k in casts){
		if(typeof window !== 'undefined') window[k] = casts[k];
		if(map) map[k] = casts[k];
	}
}
registerEarthDungeonCasts(typeof CAST_FNS !== 'undefined' ? CAST_FNS : null);

if(typeof window !== 'undefined'){
	window.updateEarthDungeonEnemy = updateEarthDungeonEnemy;
	window.updateEarthDungeonWorld = updateEarthDungeonWorld;
	window.drawEarthDungeonWorld = drawEarthDungeonWorld;
	window.drawEarthKitProj = drawEarthKitProj;
	window.earthKitTryBounce = earthKitTryBounce;
	window.earthKitInterceptProj = earthKitInterceptProj;
	window.earthKitSpriteRow = earthKitSpriteRow;
	window.earthEnd = earthEnd;
	window.EARTH_KIT_TYPES = EARTH_KIT_TYPES;
	window.registerEarthDungeonCasts = registerEarthDungeonCasts;
}
