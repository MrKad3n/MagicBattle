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
		if(kitFriendly(en)){
			if(typeof markNecroFriendlyProj === 'function') markNecroFriendlyProj(p, en);
			else p.necroFriendly = true;
		}
	}
	return p;
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
		damagePlayer(dmg, effects || []);
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
	spawnTelegraph(sx - 28, sy - 14, 56, 22, 16, 'rgba(220,160,60,0.45)', 'rect', '');
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
		spawnTelegraph(roots[i].x - 16, roots[i].y - 24, 32, 32, 22, 'rgba(90,170,50,0.4)', 'circle', '');
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
		else if(fx.kind === 'mudstrip' && circRect(fx.x, fx.y, fx.w * 0.45, player.x, player.y, player.w, player.h)){
			kitSlowSet(0.58);
			if(fx.age % 14 === 0) earthHit(fx.en, fx.x, fx.y, 22, kitDmg(10), []);
		} else if(fx.kind === 'thorntrail' && circRect(fx.x, fx.y, 16, player.x, player.y, player.w, player.h)){
			if(fx.age % 10 === 0) earthHit(fx.en, fx.x, fx.y, 16, kitDmg(12), []);
		}
		if(fx.age >= fx.max) earthWorldFX.splice(i, 1);
	}
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
		if(!airborne && Math.abs(aim.x - L.x2) < 34 && Math.abs(aim.y - fx.y) < 46){
			earthHit(fx.en, L.x2, fx.y, 28, kitDmg(26), ['stun']);
		}
	}
}
function tickGripFX(fx){
	const aim = kitAim(fx.en);
	for(let i = 0; i < fx.pillars.length; i++){
		const P = fx.pillars[i];
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
		kitSpark(last.x, last.y, 16, { r: 80, g: 170, b: 50 });
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
		kitSlowSet(0.55);
	}
}
function tickSeedFX(fx){
	if(!fx.grown && fx.age > 20){
		fx.grown = true;
		fx.h = atkS(62);
		kitSpark(fx.x, fx.y, 8, { r: 70, g: 160, b: 40 });
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
		kitSpark(fx.orb.x, fx.orb.y, 12, { r: 220, g: 140, b: 255 });
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
	}
}

function earthKitTryBounce(p){
	if(!p || !p._earthRoll) return false;
	const prevX = p.x - p.vx, prevY = p.y - p.vy;
	if(kitBlocked(p.x, prevY)){ p.vy = -Math.abs(p.vy) * 0.92; p.y = prevY; }
	if(kitBlocked(prevX, p.y)){ p.vx = -p.vx * 1.05; p.x = prevX; }
	p._earthBounces = (p._earthBounces || 0) + 1;
	kitSpark(p.x, p.y, 12, { r: 180, g: 140, b: 80 });
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
			if(fx.hp <= 0) fx.age = fx.max;
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

function drawEarthKitProj(p){
	const px = p.x - camera.x, py = p.y - camera.y;
	const r = Math.max(p.width, p.height) * 0.68;
	const pulse = 0.5 + Math.sin((p.age || 0) * 0.34) * 0.5;
	const style = p._earthStyle || 'rock';
	ctx.save();
	ctx.translate(px, py);
	ctx.shadowColor = style === 'crystal' ? '#e0a0ff' : (style === 'web' ? '#fff6d8' : '#d4b070');
	ctx.shadowBlur = 16 + pulse * 8;
	if(style === 'boulder' || style === 'rock'){
		ctx.rotate((p.age || 0) * 0.22 * (p.vx >= 0 ? 1 : -1));
		const g = ctx.createRadialGradient(-r * 0.28, -r * 0.32, r * 0.08, 0, 0, r);
		g.addColorStop(0, '#fff4d4');
		g.addColorStop(0.35, p.color2 || '#e8d4b0');
		g.addColorStop(1, p.color || '#6a5030');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(-r * 0.9, -r * 0.15);
		ctx.lineTo(-r * 0.15, -r);
		ctx.lineTo(r * 0.82, -r * 0.4);
		ctx.lineTo(r, r * 0.38);
		ctx.lineTo(r * 0.1, r * 0.95);
		ctx.lineTo(-r * 0.78, r * 0.48);
		ctx.closePath(); ctx.fill();
		ctx.strokeStyle = 'rgba(255,230,170,0.55)'; ctx.lineWidth = 3;
		ctx.stroke();
	} else if(style === 'crystal'){
		ctx.rotate((p.age || 0) * 0.12 + Math.atan2(p.vy || 0, p.vx || 1));
		const g = ctx.createLinearGradient(0, -r, 0, r);
		g.addColorStop(0, '#ffffff');
		g.addColorStop(0.3, '#f4d8ff');
		g.addColorStop(1, p.color || '#b040ee');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(0, -r * 1.15);
		ctx.lineTo(r * 0.62, 0);
		ctx.lineTo(0, r * 1.15);
		ctx.lineTo(-r * 0.62, 0);
		ctx.closePath(); ctx.fill();
		ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.stroke();
	} else if(style === 'web'){
		ctx.rotate(Math.atan2(p.vy || 0, p.vx || 1));
		ctx.strokeStyle = 'rgba(255,245,210,0.9)'; ctx.lineWidth = 2.5;
		for(let i = 0; i < 6; i++){
			const a = i * Math.PI / 3;
			ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.stroke();
		}
		ctx.fillStyle = 'rgba(255,248,230,0.82)';
		ctx.beginPath(); ctx.ellipse(0, 0, r * 0.82, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
	} else if(style === 'mud'){
		const g = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.08, 0, 0, r);
		g.addColorStop(0, '#f0d8a8');
		g.addColorStop(0.45, '#b89058');
		g.addColorStop(1, '#3a2814');
		ctx.fillStyle = g;
		ctx.beginPath(); ctx.ellipse(0, 0, r * (1.05 + pulse * 0.1), r * 0.82, 0, 0, Math.PI * 2); ctx.fill();
	} else {
		ctx.fillStyle = p.color || '#8a7350';
		ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
	}
	ctx.restore();
}

function drawEarthDungeonWorld(){
	for(let i = 0; i < earthWorldFX.length; i++){
		const fx = earthWorldFX[i];
		const x = fx.x - camera.x, y = fx.y - camera.y;
		if(fx.kind === 'decoy' || fx.kind === 'bog' || fx.kind === 'prism'){
			ctx.save();
			ctx.globalAlpha = fx.kind === 'prism' ? 0.55 : 0.88;
			ctx.shadowColor = fx.kind === 'prism' ? '#e0a0ff' : '#c4a060';
			ctx.shadowBlur = 12;
			const w = fx.w || 32, h = fx.h || 44;
			const g = ctx.createLinearGradient(x, y, x + w, y + h);
			if(fx.kind === 'prism'){ g.addColorStop(0, '#fff0ff'); g.addColorStop(1, '#8a30cc'); }
			else if(fx.kind === 'bog'){ g.addColorStop(0, '#d4b888'); g.addColorStop(1, '#3a2814'); }
			else { g.addColorStop(0, '#ead8b0'); g.addColorStop(1, '#5a4020'); }
			ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
			ctx.restore();
		} else if(fx.kind === 'seed'){
			ctx.save();
			ctx.shadowColor = '#66cc44'; ctx.shadowBlur = fx.grown ? 10 : 0;
			ctx.fillStyle = fx.grown ? '#2a6a1c' : '#8a6828';
			ctx.fillRect(x - 10, y - (fx.grown ? 52 : 12), 20, fx.grown ? 52 : 12);
			if(fx.grown){
				ctx.strokeStyle = '#b8ee66'; ctx.lineWidth = 3;
				ctx.beginPath(); ctx.moveTo(x, y - 44); ctx.lineTo(x - 18, y - 62); ctx.moveTo(x, y - 36); ctx.lineTo(x + 20, y - 58); ctx.stroke();
			}
			ctx.restore();
		} else if(fx.kind === 'mudstrip'){
			ctx.save(); ctx.globalAlpha = 0.72;
			const g = ctx.createLinearGradient(x, y - 10, x, y + 10);
			g.addColorStop(0, '#c4a060'); g.addColorStop(1, '#2a1c0c');
			ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, fx.w * 0.62, 13, 0, 0, Math.PI * 2); ctx.fill();
			ctx.restore();
		} else if(fx.kind === 'eggsac'){
			ctx.save(); ctx.shadowColor = '#e8c890'; ctx.shadowBlur = 10;
			const g = ctx.createRadialGradient(x - 4, y - 5, 2, x, y, 16);
			g.addColorStop(0, '#fff6e0'); g.addColorStop(1, '#8a6840');
			ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill(); ctx.restore();
		} else if(fx.kind === 'spiderling'){
			ctx.fillStyle = '#2a1c10'; ctx.fillRect(x - 7, y - 5, 14, 10);
			ctx.strokeStyle = '#110c08'; ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.stroke();
		} else if(fx.kind === 'thorntrail'){
			ctx.save(); ctx.strokeStyle = 'rgba(160,220,70,0.75)'; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
		} else if(fx.kind === 'fault') drawFaultFX(fx);
		else if(fx.kind === 'grip') drawGripFX(fx);
		else if(fx.kind === 'vinepath') drawVinePathFX(fx);
		else if(fx.kind === 'roots') drawRootsFX(fx);
		else if(fx.kind === 'maze') drawMazeFX(fx);
		else if(fx.kind === 'relay') drawRelayFX(fx);
		else if(fx.kind === 'prison') drawPrisonFX(fx);
		else if(fx.kind === 'sinkhole') drawSinkFX(fx);
		else if(fx.kind === 'mudwave'){
			ctx.save(); ctx.globalAlpha = 0.8;
			const g = ctx.createLinearGradient(x - fx.w / 2, y, x + fx.w / 2, y);
			g.addColorStop(0, 'rgba(80,50,20,0)'); g.addColorStop(0.5, '#c4a060'); g.addColorStop(1, 'rgba(80,50,20,0)');
			ctx.fillStyle = g; ctx.fillRect(x - fx.w / 2, y - 18, fx.w, 32); ctx.restore();
		}
	}
	if(typeof enemies !== 'undefined') for(let i = 0; i < enemies.length; i++) drawEarthEnemyFX(enemies[i]);
	if(typeof playerMinions !== 'undefined') for(let i = 0; i < playerMinions.length; i++) drawEarthEnemyFX(playerMinions[i]);
}

function drawFaultFX(fx){
	ctx.save(); ctx.lineCap = 'round';
	for(let i = 0; i < fx.lines.length; i++){
		const L = fx.lines[i];
		if(i === 0 && fx.split) continue;
		ctx.strokeStyle = 'rgba(70,40,10,0.95)'; ctx.lineWidth = 14;
		ctx.beginPath(); ctx.moveTo(L.x1 - camera.x, L.y1 - camera.y); ctx.lineTo(L.x2 - camera.x, L.y2 - camera.y); ctx.stroke();
		ctx.strokeStyle = 'rgba(255,200,80,0.9)'; ctx.lineWidth = 5;
		ctx.beginPath(); ctx.moveTo(L.x1 - camera.x, L.y1 - camera.y); ctx.lineTo(L.x2 - camera.x, L.y2 - camera.y); ctx.stroke();
	}
	ctx.restore();
}
function drawGripFX(fx){
	for(let i = 0; i < fx.pillars.length; i++){
		const P = fx.pillars[i];
		const px = P.x - 14 - camera.x, py = P.y - P.h - camera.y;
		ctx.save(); ctx.shadowColor = '#e8c880'; ctx.shadowBlur = 8;
		const g = ctx.createLinearGradient(px, py, px + 28, py + P.h);
		g.addColorStop(0, '#f4e4c0'); g.addColorStop(1, '#5a4020');
		ctx.fillStyle = g; ctx.fillRect(px, py, 28, P.h); ctx.restore();
	}
}
function drawVinePathFX(fx){
	ctx.save(); ctx.lineWidth = 7; ctx.lineCap = 'round';
	for(let p = 0; p < fx.paths.length; p++){
		ctx.strokeStyle = 'rgba(90,190,60,0.75)';
		ctx.beginPath();
		const vis = Math.max(1, Math.floor(fx.paths[p].length * Math.min(1, fx.age / 20)));
		for(let i = 0; i < vis; i++){
			const pt = fx.paths[p][i];
			if(i === 0) ctx.moveTo(pt.x - camera.x, pt.y - camera.y);
			else ctx.lineTo(pt.x - camera.x, pt.y - camera.y);
		}
		ctx.stroke();
	}
	ctx.restore();
}
function drawRootsFX(fx){
	const aim = kitAim(fx.en);
	for(let i = 0; i < fx.roots.length; i++){
		const r = fx.roots[i];
		ctx.save(); ctx.strokeStyle = r.snap ? '#b8ee55' : '#5a8a30'; ctx.lineWidth = r.snap ? 5 : 3;
		ctx.beginPath(); ctx.moveTo(r.x - camera.x, r.y - camera.y);
		ctx.lineTo((r.snap ? aim.x : r.x) - camera.x, (r.snap ? aim.y : r.y - 26) - camera.y); ctx.stroke(); ctx.restore();
	}
}
function drawMazeFX(fx){
	ctx.save(); ctx.strokeStyle = 'rgba(255,240,200,0.7)'; ctx.lineWidth = 3;
	for(let i = 0; i < fx.webs.length; i++){
		const w = fx.webs[i];
		ctx.strokeRect(w.x - w.w / 2 - camera.x, w.y - w.h - camera.y, w.w, w.h);
		ctx.beginPath();
		ctx.moveTo(w.x - w.w / 2 - camera.x, w.y - w.h - camera.y);
		ctx.lineTo(w.x + w.w / 2 - camera.x, w.y - camera.y);
		ctx.stroke();
	}
	ctx.restore();
}
function drawRelayFX(fx){
	ctx.save();
	ctx.strokeStyle = 'rgba(230,160,255,0.55)'; ctx.lineWidth = 3;
	ctx.beginPath();
	if(fx.en) ctx.moveTo(fx.en.x + fx.en.w / 2 - camera.x, fx.en.y + fx.en.h * 0.28 - camera.y);
	else ctx.moveTo(fx.nodes[0].x - camera.x, fx.nodes[0].y - camera.y);
	for(let i = 0; i < fx.nodes.length; i++) ctx.lineTo(fx.nodes[i].x - camera.x, fx.nodes[i].y - camera.y);
	ctx.stroke();
	ctx.fillStyle = '#f0c0ff';
	for(let i = 0; i < fx.nodes.length; i++){
		ctx.shadowColor = '#e080ff'; ctx.shadowBlur = 12;
		ctx.beginPath(); ctx.arc(fx.nodes[i].x - camera.x, fx.nodes[i].y - camera.y, 11, 0, Math.PI * 2); ctx.fill();
	}
	if(fx.orb){
		const g = ctx.createRadialGradient(fx.orb.x - camera.x, fx.orb.y - camera.y, 2, fx.orb.x - camera.x, fx.orb.y - camera.y, 22);
		g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(180,60,255,0)');
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx.orb.x - camera.x, fx.orb.y - camera.y, 22, 0, Math.PI * 2); ctx.fill();
	}
	ctx.restore();
}
function drawPrisonFX(fx){
	ctx.save(); ctx.shadowColor = '#d080ff'; ctx.shadowBlur = 10;
	for(let i = 0; i < fx.gems.length; i++){
		const g = fx.gems[i];
		const gx = fx.cx + Math.cos(g.ang + fx.age * 0.08) * g.r;
		ctx.fillStyle = '#e8b0ff';
		ctx.beginPath(); ctx.arc(gx - camera.x, fx.cy - camera.y, 14, 0, Math.PI * 2); ctx.fill();
	}
	ctx.restore();
}
function drawSinkFX(fx){
	ctx.save();
	const g = ctx.createRadialGradient(fx.cx - camera.x, fx.cy - camera.y, 6, fx.cx - camera.x, fx.cy - camera.y, fx.r);
	g.addColorStop(0, 'rgba(20,12,6,0.65)'); g.addColorStop(0.6, 'rgba(90,60,30,0.35)'); g.addColorStop(1, 'rgba(90,70,40,0)');
	ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fx.cx - camera.x, fx.cy - camera.y, fx.r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

function drawEarthEnemyFX(en){
	if(!en || en.dead || !en.earthKit) return;
	const kit = en.earthKit;
	if(kit.kind === 'ceilingDrop'){
		ctx.save(); ctx.globalAlpha = 0.45; ctx.fillStyle = '#111';
		ctx.beginPath(); ctx.ellipse(kit.dropX - camera.x, kitFloor(kit.dropX, en.y) - camera.y, 32, 11, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
	}
	if(kit.kind === 'webSwing'){
		ctx.save(); ctx.strokeStyle = 'rgba(255,240,200,0.85)'; ctx.lineWidth = 2;
		ctx.beginPath(); ctx.moveTo(kit.ox - camera.x, kit.oy - camera.y);
		ctx.lineTo(en.x + en.w / 2 - camera.x, en.y - camera.y); ctx.stroke(); ctx.restore();
	}
	if(kit.kind === 'crystalRelay' && kit.nodes){
		ctx.fillStyle = '#f0c0ff';
		for(let i = 0; i < kit.nodes.length; i++){
			ctx.beginPath(); ctx.arc(kit.nodes[i].x - camera.x, kit.nodes[i].y - camera.y, 8, 0, Math.PI * 2); ctx.fill();
		}
	}
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
