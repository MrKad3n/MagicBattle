/* =============================================================
   Earth / Iron Forge / Thorn Wolf kits
   ============================================================= */

const ZONE_KIT_TYPES = {
	rockGolem:1, vineCrawler:1, caveSpider:1, crystalMage:1, mudElemental:1,
	ironSentinel:1, forgeDrone:1, slagBrute:1, thornWolf:1
};
const ZONE_KIT_ROW = {
	rockGolem: { boulderRoll:2, faultStep:2, stoneDecoy:3, gravityGrip:2, recover:4 },
	vineCrawler: { vineTunnel:3, thornWheel:3, graspingGround:2, seedBomb:2, recover:4 },
	caveSpider: { ceilingDrop:3, webSwing:3, eggSac:2, webMaze:2, recover:4 },
	crystalMage: { crystalRelay:2, shardRain:2, prismClone:2, crystalPrison:3, recover:4 },
	mudElemental: { mudWave:2, bogClone:3, sinkhole:2, mudslide:3, recover:4 },
	ironSentinel: { shieldMarch:2, counterSpark:3, magneticPull:2, assemblyStrike:2, recover:4 },
	forgeDrone: { weldingBeam:2, sparkMine:2, overheat:3, droneDive:3, recover:4 },
	slagBrute: { slagHammer:2, furnaceHeart:3, slagThrow:2, foundryCollapse:3, recover:4 },
	thornWolf: { huntingCircle:3, thornPounce:2, packEcho:2, predatoryFeint:3, recover:4 }
};

const zoneWorldFX = [];

function zoneAim(en){
	if(typeof fireKitAim === 'function') return fireKitAim(en);
	return { x: player.x + player.w / 2, y: player.y + player.h / 2, vx: player.vx || 0, vy: player.vy || 0, box: player };
}
function zoneFriendly(en){ return !!(en && (en.isNecroSummon || en.necroFriendly)); }
function atkS(n){ return n * ((typeof ENEMY_ATK_SCALE === 'number') ? ENEMY_ATK_SCALE : 1.3); }
function zoneDmg(n){
	const diff = (typeof DIFF_DMG_MULT === 'number') ? DIFF_DMG_MULT : 1;
	return Math.round(n * 1.4 * diff);
}
function zoneFloorY(x, fromY){
	if(typeof fireKitFloorY === 'function') return fireKitFloorY(x, fromY);
	return (fromY || 0) + 80;
}
function zoneBlocked(x, y){
	if(typeof fireKitBlocked === 'function') return fireKitBlocked(x, y);
	return false;
}
function zoneSpark(x, y, n, color){
	if(typeof particles === 'undefined') return;
	const c = color || { r: 180, g: 150, b: 90 };
	for(let i = 0; i < Math.min(n || 8, 16); i++){
		const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 3.5;
		particles.push({
			x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 8,
			vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1,
			life: 14 + Math.random() * 14, maxLife: 28, r: 1.4 + Math.random() * 2, color: c
		});
	}
}
function zoneSpawn(en, x, y, vx, vy, opts){
	opts = opts || {};
	const p = spawnEnemyProj(x, y, vx, vy, opts);
	if(p){
		p._zoneStyle = opts._zoneStyle || 'rock';
		if(zoneFriendly(en)) p.necroFriendly = true;
	}
	return p;
}
function zoneHit(en, x, y, r, dmg, effects){
	r = atkS(r);
	if(zoneFriendly(en)){
		const pool = (typeof enemies !== 'undefined' ? enemies : []).concat(typeof dummies !== 'undefined' ? dummies : []);
		for(let i = 0; i < pool.length; i++){
			const t = pool[i];
			if(!t || t.dead) continue;
			if(circRect(x, y, r, t.x, t.y, t.w, t.h)){
				t.hp -= dmg; t.flash = 8;
				dmgNumbers.push({ x: t.x + t.w / 2, y: t.y - 10, text: Math.round(dmg) + '', age: 0, color: '#c4a46a' });
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
function zoneSlowSet(amt){ player._zoneSlow = Math.max(player._zoneSlow || 0, amt); }
function zonePushFX(fx){ zoneWorldFX.push(fx); return fx; }
function zoneEnd(en){
	if(!en) return;
	en.zoneKit = null;
	en._zoneKitBusy = false;
	en._zoneHidden = false;
	en._zoneNoHit = false;
	en._zoneFrontGuard = false;
	en._zoneCounter = false;
	en._zoneFurnace = false;
	if(en._zoneSavedW){ en.w = en._zoneSavedW; en.h = en._zoneSavedH; en._zoneSavedW = 0; }
}
function beginZoneKit(en, kind, extra){
	const type = en.necroType || en.type;
	const rows = ZONE_KIT_ROW[type] || {};
	en.zoneKit = Object.assign({ kind, t: 0, type, row: rows[kind] != null ? rows[kind] : 2 }, extra || {});
	en._zoneKitBusy = extra && extra.busy === false ? false : true;
	en.attackAnimTimer = Math.max(en.attackAnimTimer || 0, 48);
	en.facing = zoneAim(en).x >= en.x + en.w / 2 ? 1 : -1;
	if(kind !== 'prismClone' && kind !== 'packEcho'){
		for(let i = 0; i < zoneWorldFX.length; i++){
			const fx = zoneWorldFX[i];
			if(fx.kind === 'prism' && fx.en === en && !fx.pending){ fx.pending = kind; fx.copyAt = fx.age + 34; }
			if(fx.kind === 'wolfEcho' && fx.en === en && !fx.pending){ fx.pending = kind; fx.copyAt = fx.age + 10; }
		}
	}
	return en.zoneKit;
}

/* ---------- ROCK GOLEM ---------- */
function castGolemBoulderRoll(en){
	const aim = zoneAim(en);
	const ox = en.x + en.w / 2, oy = en.y + 8;
	const dir = aim.x >= ox ? 1 : -1;
	const p = zoneSpawn(en, ox + dir * 20, oy, dir * 5.4, 0, {
		color: '#8a7348', color2: '#c4a46a', power: 20, width: 44, height: 44,
		shape: 'circle', trail: 'dust', gravity: 0.18, maxAge: 160, _zoneStyle: 'boulder'
	});
	if(p){ p._zoneRoll = true; p._zoneBounces = 0; p._zoneBounceMax = 3; }
	beginZoneKit(en, 'boulderRoll', { busy: false });
	setTimeout(function(){ if(en.zoneKit && en.zoneKit.kind === 'boulderRoll') zoneEnd(en); }, 400);
}
function castGolemFaultStep(en){
	const aim = zoneAim(en);
	const floor = zoneFloorY(aim.x, aim.y);
	const ox = en.x + en.w / 2;
	beginZoneKit(en, 'faultStep', {
		busy: true, x0: ox, y: floor - 2, x1: aim.x, split: false,
		a: null, b: null
	});
	spawnTelegraph(ox - 8, floor - 10, Math.abs(aim.x - ox) + 16, 14, 36, 'rgba(180,140,70,0.3)', 'rect', '');
}
function castGolemStoneDecoy(en){
	const aim = zoneAim(en);
	const dx = aim.x >= en.x ? 1 : -1;
	zonePushFX({ kind: 'decoy', en, x: en.x + dx * 80, y: en.y, w: en.w, h: en.h, age: 0, max: 180, persist: true });
	beginZoneKit(en, 'stoneDecoy', { busy: true, dir: dx < 0 ? 1 : -1 });
}
function castGolemGravityGrip(en){
	const aim = zoneAim(en);
	const floor = zoneFloorY(aim.x, aim.y);
	const pillars = [];
	for(let i = 0; i < 4; i++){
		const a = i * Math.PI / 2 + 0.4;
		pillars.push({ x: aim.x + Math.cos(a) * atkS(70), y: floor, h: 0 });
	}
	beginZoneKit(en, 'gravityGrip', { busy: true, pillars, cx: aim.x, cy: aim.y });
}

/* ---------- VINE CRAWLER ---------- */
function castVineTunnel(en){
	const aim = zoneAim(en);
	const floor = zoneFloorY(aim.x, aim.y);
	const real = Math.random() < 0.5 ? 0 : 1;
	beginZoneKit(en, 'vineTunnel', {
		busy: true,
		paths: [
			{ x: en.x + en.w / 2, tx: aim.x + (real === 0 ? 0 : 110), y: floor, real: real === 0 },
			{ x: en.x + en.w / 2, tx: aim.x + (real === 1 ? 0 : -110), y: floor, real: real === 1 }
		]
	});
	en._zoneHidden = true; en._zoneNoHit = true;
}
function castVineThornWheel(en){
	const aim = zoneAim(en);
	beginZoneKit(en, 'thornWheel', { busy: true, dir: aim.x >= en.x + en.w / 2 ? 1 : -1, phase: 'roll' });
}
function castVineGraspingGround(en){
	const aim = zoneAim(en);
	const floor = zoneFloorY(aim.x, aim.y);
	const roots = [];
	for(let i = 0; i < 5; i++){
		roots.push({ x: aim.x + (i - 2) * 52 + (Math.random() - 0.5) * 18, y: floor, snap: false });
	}
	beginZoneKit(en, 'graspingGround', { busy: true, roots });
}
function castVineSeedBomb(en){
	const aim = zoneAim(en);
	const floor = zoneFloorY(aim.x, aim.y);
	for(let i = 0; i < 4; i++){
		zonePushFX({
			kind: 'seed', en, persist: true, age: 0, grow: 70, plant: false,
			x: aim.x + (i - 1.5) * 64, y: floor - 4, r: atkS(16)
		});
	}
	beginZoneKit(en, 'seedBomb', { busy: false });
	setTimeout(function(){ if(en.zoneKit && en.zoneKit.kind === 'seedBomb') zoneEnd(en); }, 360);
}

/* ---------- CAVE SPIDER ---------- */
function castSpiderCeilingDrop(en){
	const aim = zoneAim(en);
	beginZoneKit(en, 'ceilingDrop', { busy: true, sx: aim.x + (Math.random() - 0.5) * 40, sy: en.y - 90, drop: false });
	en._zoneHidden = true;
}
function castSpiderWebSwing(en){
	const aim = zoneAim(en);
	const dir = aim.x >= en.x + en.w / 2 ? 1 : -1;
	beginZoneKit(en, 'webSwing', { busy: true, dir, ang: -1.1, release: 18 + (Math.random() * 22 | 0) });
}
function castSpiderEggSac(en){
	const floor = zoneFloorY(en.x, en.y);
	beginZoneKit(en, 'eggSac', { busy: true, x: en.x + en.w / 2, y: floor - 6, hatched: false });
}
function castSpiderWebMaze(en){
	const aim = zoneAim(en);
	const webs = [];
	for(let i = 0; i < 5; i++){
		webs.push({
			x1: aim.x - 90 + i * 20, y1: aim.y - 70,
			x2: aim.x + 90 - i * 16, y2: aim.y + 40,
			age: 0, persist: true
		});
	}
	beginZoneKit(en, 'webMaze', { busy: true, webs });
}

/* ---------- CRYSTAL MAGE ---------- */
function castCrystalRelay(en){
	const aim = zoneAim(en);
	const nodes = [];
	for(let i = 0; i < 4; i++){
		nodes.push({ x: aim.x + (i - 1.5) * 70, y: aim.y - 20 + (i % 2 ? -40 : 30) });
	}
	beginZoneKit(en, 'crystalRelay', { busy: true, nodes, beam: 0 });
}
function castCrystalShardRain(en){
	beginZoneKit(en, 'shardRain', { busy: true, ang: 0, cx: zoneAim(en).x, cy: zoneAim(en).y - 120 });
}
function castCrystalPrismClone(en){
	const aim = zoneAim(en);
	zonePushFX({ kind: 'prism', en, x: aim.x + 90, y: en.y, w: en.w, h: en.h, age: 0, max: 220, persist: true, pending: null });
	beginZoneKit(en, 'prismClone', { busy: false });
	setTimeout(function(){ if(en.zoneKit && en.zoneKit.kind === 'prismClone') zoneEnd(en); }, 360);
}
function castCrystalPrison(en){
	const aim = zoneAim(en);
	const pillars = [];
	for(let i = 0; i < 4; i++) pillars.push({ ang: i * Math.PI / 2, r: atkS(78) });
	beginZoneKit(en, 'crystalPrison', { busy: true, cx: aim.x, cy: zoneFloorY(aim.x, aim.y) - 8, pillars, closed: false });
}

/* ---------- MUD ELEMENTAL ---------- */
function castMudWave(en){
	const aim = zoneAim(en);
	const dir = aim.x >= en.x + en.w / 2 ? 1 : -1;
	beginZoneKit(en, 'mudWave', { busy: true, x: en.x + en.w / 2, y: zoneFloorY(aim.x, aim.y) - 4, dir, w: atkS(40) });
}
function castMudBogClone(en){
	const aim = zoneAim(en);
	beginZoneKit(en, 'bogClone', { busy: true, x: aim.x + (Math.random() < 0.5 ? -80 : 80), y: en.y, fired: false });
}
function castMudSinkhole(en){
	const aim = zoneAim(en);
	beginZoneKit(en, 'sinkhole', { busy: true, cx: aim.x, cy: zoneFloorY(aim.x, aim.y), r: atkS(90) });
}
function castMudMudslide(en){
	const aim = zoneAim(en);
	beginZoneKit(en, 'mudslide', { busy: true, dir: aim.x >= en.x + en.w / 2 ? 1 : -1 });
	en._zoneHidden = true;
}

/* ---------- IRON SENTINEL ---------- */
function castSentinelShieldMarch(en){
	const aim = zoneAim(en);
	beginZoneKit(en, 'shieldMarch', { busy: true, dir: aim.x >= en.x + en.w / 2 ? 1 : -1 });
	en._zoneFrontGuard = true;
}
function castSentinelCounterSpark(en){
	beginZoneKit(en, 'counterSpark', { busy: true });
	en._zoneCounter = true;
}
function castSentinelMagneticPull(en){
	beginZoneKit(en, 'magneticPull', { busy: true, gathered: [] });
}
function castSentinelAssemblyStrike(en){
	const aim = zoneAim(en);
	beginZoneKit(en, 'assemblyStrike', { busy: true, tx: aim.x, ty: aim.y, punched: false });
}

/* ---------- FORGE DRONE ---------- */
function castDroneWeldingBeam(en){
	const aim = zoneAim(en);
	const floor = zoneFloorY(aim.x, aim.y);
	zonePushFX({ kind: 'barrier', en, persist: true, x: aim.x, y: floor - 40, w: atkS(18), h: atkS(70), age: 0, max: 200 });
	beginZoneKit(en, 'weldingBeam', { busy: false });
	setTimeout(function(){ if(en.zoneKit && en.zoneKit.kind === 'weldingBeam') zoneEnd(en); }, 320);
}
function castDroneSparkMine(en){
	const aim = zoneAim(en);
	const floor = zoneFloorY(aim.x, aim.y);
	for(let i = 0; i < 4; i++){
		zonePushFX({ kind: 'sparkMine', en, persist: true, x: aim.x + (i - 1.5) * 56, y: floor - 6, r: atkS(14), age: 0, max: 220, live: false });
	}
	beginZoneKit(en, 'sparkMine', { busy: false });
	setTimeout(function(){ if(en.zoneKit && en.zoneKit.kind === 'sparkMine') zoneEnd(en); }, 320);
}
function castDroneOverheat(en){
	beginZoneKit(en, 'overheat', { busy: true, heat: 0 });
}
function castDroneDive(en){
	const aim = zoneAim(en);
	const ang = Math.atan2(aim.y - (en.y + en.h / 2), aim.x - (en.x + en.w / 2));
	beginZoneKit(en, 'droneDive', { busy: true, ang, bounced: false });
}

/* ---------- SLAG BRUTE ---------- */
function castBruteSlagHammer(en){
	const aim = zoneAim(en);
	beginZoneKit(en, 'slagHammer', { busy: true, x: aim.x, y: zoneFloorY(aim.x, aim.y) });
	spawnTelegraph(aim.x - 40, zoneFloorY(aim.x, aim.y) - 20, 80, 24, 48, 'rgba(220,80,30,0.3)', 'rect', '');
}
function castBruteFurnaceHeart(en){
	beginZoneKit(en, 'furnaceHeart', { busy: true, grow: 0 });
	en._zoneFurnace = true;
	en._zoneSavedW = en.w; en._zoneSavedH = en.h;
}
function castBruteSlagThrow(en){
	const aim = zoneAim(en);
	const floor = zoneFloorY(aim.x, aim.y);
	for(let i = 0; i < 3; i++){
		zonePushFX({ kind: 'slagChunk', en, persist: true, x: aim.x + (i - 1) * 70, y: floor - 4, age: 0, boom: 70 + i * 12, done: false });
	}
	beginZoneKit(en, 'slagThrow', { busy: false });
	setTimeout(function(){ if(en.zoneKit && en.zoneKit.kind === 'slagThrow') zoneEnd(en); }, 360);
}
function castBruteFoundryCollapse(en){
	beginZoneKit(en, 'foundryCollapse', { busy: true, slammed: false });
}

/* ---------- THORN WOLF ---------- */
function castWolfHuntingCircle(en){
	beginZoneKit(en, 'huntingCircle', { busy: true, laps: 0, ang: 0 });
}
function castWolfThornPounce(en){
	const aim = zoneAim(en);
	beginZoneKit(en, 'thornPounce', { busy: true, tx: aim.x, ty: aim.y, landed: false });
	spawnTelegraph(aim.x - 30, aim.y - 20, 80, 40, 28, 'rgba(80,140,50,0.28)', 'rect', '');
}
function castWolfPackEcho(en){
	zonePushFX({ kind: 'wolfEcho', en, x: en.x, y: en.y, w: en.w, h: en.h, age: 0, max: 160, persist: true, pending: null, delay: 8 });
	zonePushFX({ kind: 'wolfEcho', en, x: en.x, y: en.y, w: en.w, h: en.h, age: 0, max: 160, persist: true, pending: null, delay: 16 });
	beginZoneKit(en, 'packEcho', { busy: false });
	setTimeout(function(){ if(en.zoneKit && en.zoneKit.kind === 'packEcho') zoneEnd(en); }, 280);
}
function castWolfPredatoryFeint(en){
	const aim = zoneAim(en);
	beginZoneKit(en, 'predatoryFeint', { busy: true, dir: aim.x >= en.x + en.w / 2 ? 1 : -1, phase: 'fake' });
}

/* ---------- ticks ---------- */
function updateZoneKitEnemy(en){
	const kit = en.zoneKit;
	if(!kit){ en._zoneKitBusy = false; return false; }
	kit.t++;
	const type = kit.type || en.necroType || en.type;
	if(type === 'rockGolem') tickGolem(en, kit);
	else if(type === 'vineCrawler') tickVine(en, kit);
	else if(type === 'caveSpider') tickSpider(en, kit);
	else if(type === 'crystalMage') tickCrystal(en, kit);
	else if(type === 'mudElemental') tickMud(en, kit);
	else if(type === 'ironSentinel') tickIronSentinel(en, kit);
	else if(type === 'forgeDrone') tickDrone(en, kit);
	else if(type === 'slagBrute') tickBrute(en, kit);
	else if(type === 'thornWolf') tickWolf(en, kit);
	else zoneEnd(en);
	return !!en._zoneKitBusy;
}

function tickGolem(en, kit){
	const aim = zoneAim(en);
	if(kit.kind === 'faultStep'){
		if(kit.t === 28 && !kit.split){
			kit.split = true;
			const mid = kit.x0 + (kit.x1 - kit.x0) * 0.5;
			kit.a = { x: mid, tx: kit.x1 + 70 }; kit.b = { x: mid, tx: kit.x1 - 70 };
		}
		const t = Math.min(1, kit.t / 50);
		const cx = kit.x0 + (kit.x1 - kit.x0) * t;
		if(!kit.hitMain && player.onGround && Math.abs(aim.x - cx) < 18 && Math.abs(aim.y - kit.y) < 28){
			kit.hitMain = true;
			zoneHit(en, cx, kit.y, 16, zoneDmg(14), []);
		}
		if(kit.split){
			const u = Math.min(1, (kit.t - 28) / 28);
			[kit.a, kit.b].forEach(function(L){
				const x = L.x + (L.tx - L.x) * u;
				if(!L.hit && player.onGround && Math.abs(aim.x - x) < 16 && Math.abs(aim.y - kit.y) < 28){
					L.hit = true;
					zoneHit(en, x, kit.y, 14, zoneDmg(12), []);
				}
			});
		}
		if(kit.t > 70) zoneEnd(en);
	} else if(kit.kind === 'stoneDecoy'){
		en.x += kit.dir * 1.6;
		if(kit.t > 90) zoneEnd(en);
	} else if(kit.kind === 'gravityGrip'){
		for(let i = 0; i < kit.pillars.length; i++){
			const P = kit.pillars[i];
			P.h = Math.min(atkS(86), kit.t * 2.2);
			if(Math.abs(aim.x - P.x) < 16 && aim.y > P.y - P.h){
				zoneSlowSet(0.55);
				player.x += aim.x < P.x ? -2 : 2;
			}
		}
		if(kit.t === 55 || kit.t === 70){
			zoneSpawn(en, en.x + en.w / 2, en.y, (kit.cx - (en.x + en.w / 2)) * 0.04, -2.2, {
				color: '#9a7a48', color2: '#d4b47a', power: 16, width: 32, height: 32,
				shape: 'circle', gravity: 0.2, maxAge: 80, _zoneStyle: 'boulder'
			});
		}
		if(kit.t > 95) zoneEnd(en);
	}
}

function tickVine(en, kit){
	const aim = zoneAim(en);
	if(kit.kind === 'vineTunnel'){
		for(let i = 0; i < kit.paths.length; i++){
			const P = kit.paths[i];
			P.x += (P.tx - P.x) * 0.08;
		}
		if(kit.t === 54){
			en._zoneHidden = false; en._zoneNoHit = false;
			for(let i = 0; i < kit.paths.length; i++){
				const P = kit.paths[i];
				zoneHit(en, P.x, P.y - 20, P.real ? 36 : 22, zoneDmg(P.real ? 20 : 8), []);
				if(P.real){ en.x = P.x - en.w / 2; en.y = P.y - en.h; }
			}
		}
		if(kit.t > 70) zoneEnd(en);
	} else if(kit.kind === 'thornWheel'){
		if(kit.phase === 'roll'){
			en.x += kit.dir * 6.8;
			zoneHit(en, en.x + en.w / 2, en.y + en.h / 2, 26, zoneDmg(16), []);
			if(zoneBlocked(en.x + (kit.dir > 0 ? en.w + 8 : -8), en.y + en.h / 2) || kit.t > 40){
				kit.phase = 'climb'; kit.ct = 0;
			}
		} else if(kit.phase === 'climb'){
			en.y -= 5; kit.ct++;
			if(kit.ct > 14){ kit.phase = 'drop'; kit.dir *= -1; }
		} else {
			en.x += kit.dir * 5.5; en.y += 7;
			zoneHit(en, en.x + en.w / 2, en.y + en.h / 2, 28, zoneDmg(18), []);
			if(kit.t > 80) zoneEnd(en);
		}
	} else if(kit.kind === 'graspingGround'){
		if(kit.t === 48){
			for(let i = 0; i < kit.roots.length; i++){
				kit.roots[i].snap = true;
				zoneHit(en, kit.roots[i].x, aim.y, 22, zoneDmg(12), []);
			}
		}
		if(kit.t > 70){
			const plants = zoneWorldFX.filter(function(f){ return f.kind === 'seed' && f.en === en && f.plant; });
			if(plants.length && Math.random() < 0.45){
				const p = plants[Math.floor(Math.random() * plants.length)];
				en.x = p.x - en.w / 2;
			}
			zoneEnd(en);
		}
	}
}

function tickSpider(en, kit){
	const aim = zoneAim(en);
	if(kit.kind === 'ceilingDrop'){
		if(kit.t < 36){
			en.x += (kit.sx - en.w / 2 - en.x) * 0.12;
			en.y += (kit.sy - en.y) * 0.12;
		}
		if(kit.t === 36){
			kit.sx += (Math.random() - 0.5) * 50;
			en._zoneHidden = false;
		}
		if(kit.t > 36){
			en.x += (kit.sx - en.w / 2 - en.x) * 0.2;
			en.y += 9;
			if(kit.t === 48) zoneHit(en, en.x + en.w / 2, en.y + en.h, 28, zoneDmg(18), []);
		}
		if(kit.t > 58) zoneEnd(en);
	} else if(kit.kind === 'webSwing'){
		kit.ang += 0.085;
		const cx = en.x + en.w / 2;
		en.x += kit.dir * 5.2;
		en.y += Math.sin(kit.ang) * 4.5;
		if(kit.t === kit.release){
			const d = Math.hypot(aim.x - (en.x + en.w / 2), aim.y - (en.y + en.h / 2)) || 1;
			zoneSpawn(en, en.x + en.w / 2, en.y + en.h / 2, (aim.x - cx) / d * 7.2, (aim.y - (en.y + en.h / 2)) / d * 7.2, {
				color: '#d8d0c0', color2: '#fff', power: 14, width: 22, height: 22,
				shape: 'circle', maxAge: 70, _zoneStyle: 'web'
			});
			zoneHit(en, en.x + en.w / 2, en.y + en.h / 2, 24, zoneDmg(16), []);
		}
		if(kit.t > kit.release + 16) zoneEnd(en);
	} else if(kit.kind === 'eggSac'){
		if(kit.t === 50 && !kit.hatched){
			kit.hatched = true;
			for(let i = 0; i < 4; i++){
				zonePushFX({ kind: 'spiderling', en, persist: true, x: kit.x, y: kit.y, age: 0, max: 140 });
			}
			en.y -= 50;
		}
		if(kit.t === 70) zoneHit(en, aim.x, aim.y - 40, 26, zoneDmg(14), []);
		if(kit.t > 85) zoneEnd(en);
	} else if(kit.kind === 'webMaze'){
		for(let i = 0; i < kit.webs.length; i++){
			const w = kit.webs[i];
			const minx = Math.min(w.x1, w.x2), maxx = Math.max(w.x1, w.x2);
			if(aim.x > minx && aim.x < maxx && aim.y > Math.min(w.y1, w.y2) - 10 && aim.y < Math.max(w.y1, w.y2) + 10){
				zoneSlowSet(0.62);
			}
		}
		if(kit.t === 40){
			zoneSpawn(en, en.x + en.w / 2, en.y, (aim.x - (en.x + en.w / 2)) * 0.05, 0, {
				color: '#e8e0d0', color2: '#fff', power: 14, width: 20, height: 20, shape: 'circle', maxAge: 70, _zoneStyle: 'web'
			});
		}
		if(kit.t > 80){
			kit.webs.forEach(function(w){ w.persist = true; w.max = 160; w.age = 0; zonePushFX(Object.assign({ kind: 'web' }, w)); });
			zoneEnd(en);
		}
	}
}

function tickCrystal(en, kit){
	const aim = zoneAim(en);
	if(kit.kind === 'crystalRelay'){
		if(kit.t === 40){
			const n0 = kit.nodes[0];
			zoneSpawn(en, n0.x, n0.y, 0, 0, {
				color: '#c88aff', color2: '#ffe8ff', power: 16, width: 26, height: 26,
				shape: 'orb', maxAge: 8, _zoneStyle: 'crystal'
			});
			kit.beam = 1;
		}
		if(kit.beam > 0 && kit.t === 40 + kit.beam * 12 && kit.beam < kit.nodes.length){
			const a = kit.nodes[kit.beam - 1], b = kit.nodes[kit.beam];
			const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
			zoneSpawn(en, a.x, a.y, dx / d * 8, dy / d * 8, {
				color: '#d090ff', color2: '#fff', power: 16, width: 28, height: 28,
				shape: 'orb', maxAge: 40, _zoneStyle: 'crystal'
			});
			if(circRect((a.x + b.x) / 2, (a.y + b.y) / 2, 18, aim.box.x, aim.box.y, aim.box.w, aim.box.h)){
				zoneHit(en, aim.x, aim.y, 16, zoneDmg(14), []);
			}
			kit.beam++;
		}
		if(kit.t > 100) zoneEnd(en);
	} else if(kit.kind === 'shardRain'){
		kit.ang += 0.04;
		if(kit.t % 8 === 0){
			for(let i = 0; i < 5; i++){
				const a = kit.ang + i * (Math.PI * 2 / 5);
				const sx = kit.cx + Math.cos(a) * atkS(90);
				zoneSpawn(en, sx, kit.cy, 0, 5.4, {
					color: '#c070ee', color2: '#f4d0ff', power: 12, width: 16, height: 22,
					shape: 'spike', maxAge: 70, _zoneStyle: 'crystal'
				});
			}
		}
		if(kit.t > 90) zoneEnd(en);
	} else if(kit.kind === 'crystalPrison'){
		for(let i = 0; i < kit.pillars.length; i++){
			kit.pillars[i].ang += 0.03;
			kit.pillars[i].r = Math.max(atkS(22), kit.pillars[i].r - 0.9);
		}
		const gap = kit.pillars[0].r > atkS(36);
		if(kit.t === 70){
			kit.closed = !gap && Math.hypot(aim.x - kit.cx, aim.y - kit.cy) < atkS(40);
			if(kit.closed){
				for(let i = 0; i < 8; i++){
					const a = i * Math.PI / 4;
					zoneSpawn(en, kit.cx, kit.cy, Math.cos(a) * 5.5, Math.sin(a) * 5.5, {
						color: '#e0a0ff', color2: '#fff', power: 14, width: 20, height: 20,
						shape: 'spike', maxAge: 50, _zoneStyle: 'crystal'
					});
				}
			}
		}
		if(kit.t > 88) zoneEnd(en);
	}
}

function tickMud(en, kit){
	const aim = zoneAim(en);
	if(kit.kind === 'mudWave'){
		kit.x += kit.dir * 5.2;
		kit.w = Math.min(atkS(140), kit.w + 1.4);
		if(Math.abs(aim.x - kit.x) < kit.w * 0.45 && Math.abs(aim.y - kit.y) < 24) zoneSlowSet(0.5);
		if(kit.t > 70){
			zonePushFX({ kind: 'mud', persist: true, x: kit.x, y: kit.y, w: kit.w, h: 16, age: 0, max: 160 });
			zoneEnd(en);
		}
	} else if(kit.kind === 'bogClone'){
		if(kit.t === 40 && !kit.fired){
			kit.fired = true;
			const d = Math.hypot(aim.x - kit.x, aim.y - kit.y) || 1;
			zoneSpawn(en, kit.x, kit.y, (aim.x - kit.x) / d * 5.5, (aim.y - kit.y) / d * 5.5, {
				color: '#6a5438', color2: '#a08050', power: 12, width: 28, height: 28,
				shape: 'circle', maxAge: 60, _zoneStyle: 'mud'
			});
		}
		if(kit.t > 70) zoneEnd(en);
	} else if(kit.kind === 'sinkhole'){
		const dx = kit.cx - aim.x, dy = 0, dist = Math.abs(dx);
		if(dist < kit.r && !zoneFriendly(en)){
			player.x += (dx > 0 ? 1 : -1) * 1.1;
			zoneSlowSet(0.35);
		}
		if(kit.t === 40 || kit.t === 58){
			const edge = kit.cx + (aim.x < kit.cx ? -kit.r * 0.7 : kit.r * 0.7);
			zoneSpawn(en, en.x + en.w / 2, en.y, (edge - (en.x + en.w / 2)) * 0.05, -1.5, {
				color: '#7a6040', color2: '#c0a070', power: 14, width: 26, height: 26,
				shape: 'circle', gravity: 0.16, maxAge: 70, _zoneStyle: 'mud'
			});
		}
		if(kit.t > 80) zoneEnd(en);
	} else if(kit.kind === 'mudslide'){
		en.x += kit.dir * 7.2;
		zoneHit(en, en.x + en.w / 2, en.y + en.h / 2, 34, zoneDmg(18), []);
		if(kit.t % 5 === 0) zonePushFX({ kind: 'mud', persist: true, x: en.x + en.w / 2, y: en.y + en.h, w: atkS(50), h: 14, age: 0, max: 150 });
		if(zoneBlocked(en.x + (kit.dir > 0 ? en.w + 6 : -6), en.y + en.h / 2) || kit.t > 54){
			en._zoneHidden = false;
			zoneEnd(en);
		}
	}
}

function tickIronSentinel(en, kit){
	const aim = zoneAim(en);
	if(kit.kind === 'shieldMarch'){
		en.x += kit.dir * 1.5;
		if(Math.abs(aim.x - (en.x + en.w / 2)) < 50 && kit.t > 40){
			zoneHit(en, en.x + en.w / 2 + kit.dir * 30, en.y + en.h / 2, 32, zoneDmg(20), []);
			en._zoneFrontGuard = false;
			zoneEnd(en);
		}
		if(kit.t > 110){ en._zoneFrontGuard = false; zoneEnd(en); }
	} else if(kit.kind === 'counterSpark'){
		if(kit.t > 70){ en._zoneCounter = false; zoneEnd(en); }
	} else if(kit.kind === 'magneticPull'){
		const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
		if(kit.t < 50 && typeof projectiles !== 'undefined'){
			for(let i = 0; i < projectiles.length; i++){
				const p = projectiles[i];
				if(!p || p.hasHit) continue;
				const d = Math.hypot(p.x - cx, p.y - cy) || 1;
				if(d < 220){ p.vx += (cx - p.x) / d * 0.55; p.vy += (cy - p.y) / d * 0.55; }
			}
		}
		if(kit.t === 55){
			for(let i = 0; i < 8; i++){
				const a = i * Math.PI / 4;
				zoneSpawn(en, cx, cy, Math.cos(a) * 6.2, Math.sin(a) * 6.2, {
					color: '#8a8a9a', color2: '#d0d0d8', power: 14, width: 22, height: 22,
					shape: 'circle', maxAge: 70, _zoneStyle: 'metal'
				});
			}
		}
		if(kit.t > 75) zoneEnd(en);
	} else if(kit.kind === 'assemblyStrike'){
		if(kit.t === 40 && !kit.punched){
			kit.punched = true;
			zoneHit(en, kit.tx, kit.ty, 40, zoneDmg(22), []);
			zoneSpark(kit.tx, kit.ty, 14, { r: 255, g: 160, b: 60 });
		}
		if(kit.t > 60) zoneEnd(en);
	}
}

function tickDrone(en, kit){
	const aim = zoneAim(en);
	if(kit.kind === 'overheat'){
		kit.heat = Math.min(1, kit.t / 70);
		if(kit.t === 80){
			zoneHit(en, en.x + en.w / 2, en.y + en.h / 2, 70, zoneDmg(24), ['burn']);
			zoneSpark(en.x + en.w / 2, en.y + en.h / 2, 16, { r: 255, g: 120, b: 40 });
		}
		if(kit.t > 95) zoneEnd(en);
	} else if(kit.kind === 'droneDive'){
		en.x += Math.cos(kit.ang) * 7.4;
		en.y += Math.sin(kit.ang) * 7.4;
		if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
		zoneHit(en, en.x + en.w / 2, en.y + en.h / 2, 22, zoneDmg(16), ['burn']);
		if(!kit.bounced && (zoneBlocked(en.x + en.w / 2 + Math.cos(kit.ang) * 16, en.y + en.h / 2 + Math.sin(kit.ang) * 16) || kit.t > 36)){
			kit.bounced = true; kit.ang = Math.PI - kit.ang;
		} else if(kit.bounced && kit.t > 70) zoneEnd(en);
	}
}

function tickBrute(en, kit){
	const aim = zoneAim(en);
	if(kit.kind === 'slagHammer'){
		if(kit.t === 50){
			zoneHit(en, kit.x, kit.y - 20, 48, zoneDmg(24), ['burn']);
			zonePushFX({ kind: 'crater', persist: true, x: kit.x, y: kit.y, r: atkS(46), age: 0, max: 160, en });
			if(typeof shakeScreen === 'function') shakeScreen(7, 12);
		}
		if(kit.t > 70) zoneEnd(en);
	} else if(kit.kind === 'furnaceHeart'){
		kit.grow = Math.min(1, kit.t / 90);
		const s = 1 + kit.grow * 0.45;
		if(en._zoneSavedW){ en.w = en._zoneSavedW * s; en.h = en._zoneSavedH * s; }
		if(kit.t > 100){ en._zoneFurnace = false; zoneEnd(en); }
	} else if(kit.kind === 'foundryCollapse'){
		if(kit.t % 8 === 0 && kit.t < 40){
			zonePushFX({
				kind: 'debris', persist: true, en,
				x: en.x + Math.random() * en.w, y: en.y + 8,
				w: atkS(20), h: atkS(14), age: 0, max: 200
			});
		}
		if(kit.t === 48 && !kit.slammed){
			kit.slammed = true;
			const dir = aim.x >= en.x + en.w / 2 ? 1 : -1;
			en.x += dir * 50;
			zoneHit(en, en.x + en.w / 2, en.y + en.h, 56, zoneDmg(26), ['burn']);
		}
		if(kit.t > 70) zoneEnd(en);
	}
}

function tickWolf(en, kit){
	const aim = zoneAim(en);
	if(kit.kind === 'huntingCircle'){
		kit.ang += 0.11;
		const r = 90;
		en.x = aim.x + Math.cos(kit.ang) * r - en.w / 2;
		en.y = aim.y + Math.sin(kit.ang) * 18 - en.h / 2;
		if(kit.t % 6 === 0) zoneSpark(en.x + en.w / 2, en.y + en.h, 3, { r: 90, g: 140, b: 50 });
		if(kit.t % 22 === 0) kit.laps++;
		if(kit.laps >= 3 && kit.t > 70){
			en.x += (aim.x - (en.x + en.w / 2)) * 0.8;
			zoneHit(en, aim.x, aim.y, 30, zoneDmg(20), []);
			zoneEnd(en);
		}
		if(kit.t > 110) zoneEnd(en);
	} else if(kit.kind === 'thornPounce'){
		if(!kit.landed){
			en.x += (kit.tx - en.w / 2 - en.x) * 0.18;
			en.y += (kit.ty - en.h - en.y) * 0.18;
			if(kit.t > 18){
				kit.landed = true;
				zoneHit(en, kit.tx, kit.ty, 26, zoneDmg(16), []);
				const back = en.facing > 0 ? -1 : 1;
				for(let i = 0; i < 5; i++){
					zoneSpawn(en, kit.tx, kit.ty, back * (3 + i), -2 + i * 0.8, {
						color: '#6a8a3a', color2: '#c0d070', power: 10, width: 16, height: 16,
						shape: 'spike', maxAge: 40, _zoneStyle: 'thorn'
					});
				}
			}
		}
		if(kit.t > 40) zoneEnd(en);
	} else if(kit.kind === 'predatoryFeint'){
		if(kit.phase === 'fake'){
			en.x += kit.dir * 5.5;
			if(kit.t === 14){ kit.phase = 'side'; kit.dir *= -1; }
		} else if(kit.phase === 'side'){
			en.x += kit.dir * 6.2;
			if(kit.t === 26) kit.phase = 'real';
		} else {
			en.x += (aim.x - en.w / 2 - en.x) * 0.22;
			if(kit.t === 34) zoneHit(en, aim.x, aim.y, 28, zoneDmg(18), []);
			if(kit.t > 44) zoneEnd(en);
		}
	}
}

function updateZoneKitWorld(){
	if(player._zoneSlow) player._zoneSlow *= 0.91;
	if(player._zoneSlow < 0.04) player._zoneSlow = 0;
	for(let i = zoneWorldFX.length - 1; i >= 0; i--){
		const fx = zoneWorldFX[i];
		fx.age++;
		if(fx.kind === 'seed' && !fx.plant && fx.age >= fx.grow){ fx.plant = true; fx.r = atkS(22); }
		if(fx.kind === 'seed' && fx.plant && circRect(fx.x, fx.y, fx.r, player.x, player.y, player.w, player.h)) zoneSlowSet(0.3);
		if(fx.kind === 'spiderling'){
			const ax = player.x + player.w / 2, ay = player.y + player.h / 2;
			const d = Math.hypot(ax - fx.x, ay - fx.y) || 1;
			fx.x += (ax - fx.x) / d * 2.4;
			fx.y += (ay - fx.y) / d * 2.4;
			if(circRect(fx.x, fx.y, 10, player.x, player.y, player.w, player.h) && player.iFrames <= 0){
				damagePlayer(zoneDmg(6), []);
				fx.age = fx.max;
			}
		}
		if(fx.kind === 'sparkMine'){
			if(Math.hypot(player.x + player.w / 2 - fx.x, player.y + player.h - fx.y) < 50) fx.live = true;
			if(fx.live){
				for(let j = 0; j < zoneWorldFX.length; j++){
					const o = zoneWorldFX[j];
					if(o === fx || o.kind !== 'sparkMine' || !o.live) continue;
					const midX = (fx.x + o.x) / 2, midY = (fx.y + o.y) / 2;
					if(circRect(midX, midY, 12, player.x, player.y, player.w, player.h)) zoneHit(fx.en, midX, midY, 14, zoneDmg(10), []);
				}
			}
		}
		if(fx.kind === 'slagChunk' && !fx.done && fx.age >= fx.boom){
			fx.done = true;
			zoneHit(fx.en, fx.x, fx.y - 30, 32, zoneDmg(16), ['burn']);
		}
		if(fx.kind === 'crater' && circRect(fx.x, fx.y, fx.r * 0.5, player.x, player.y, player.w, player.h)){
			zoneHit(fx.en, fx.x, fx.y, 18, zoneDmg(8), ['burn']);
		}
		if(fx.kind === 'mud' && Math.abs(player.x + player.w / 2 - fx.x) < fx.w * 0.5 && Math.abs(player.y + player.h - fx.y) < 18){
			zoneSlowSet(0.48);
		}
		if(fx.kind === 'debris' && circRect(fx.x, fx.y, 14, player.x, player.y, player.w, player.h)) zoneSlowSet(0.4);
		if(fx.kind === 'barrier' && Math.abs(player.x + player.w / 2 - fx.x) < fx.w && player.y + player.h > fx.y && player.y < fx.y + fx.h){
			player.x += player.x + player.w / 2 < fx.x ? -2.2 : 2.2;
		}
		if(fx.kind === 'web'){
			const minx = Math.min(fx.x1, fx.x2), maxx = Math.max(fx.x1, fx.x2);
			if(player.x + player.w / 2 > minx && player.x + player.w / 2 < maxx) zoneSlowSet(0.55);
		}
		if(fx.kind === 'prism' && fx.pending && fx.age === fx.copyAt){
			const aim = zoneAim(fx.en);
			const dx = aim.x - fx.x, dy = aim.y - fx.y, d = Math.hypot(dx, dy) || 1;
			zoneSpawn(fx.en, fx.x, fx.y, dx / d * 6.8, dy / d * 6.8, {
				color: '#d090ff', color2: '#fff', power: 14, width: 24, height: 24,
				shape: 'orb', maxAge: 70, _zoneStyle: 'crystal'
			});
			fx.pending = null;
		}
		if(fx.kind === 'wolfEcho' && fx.pending && fx.age === fx.copyAt){
			zoneHit(fx.en, fx.x + fx.w / 2, fx.y + fx.h / 2, 18, zoneDmg(8), []);
			fx.x = fx.en.x; fx.y = fx.en.y;
			fx.pending = null;
		}
		if(fx.age >= (fx.max || 200)) zoneWorldFX.splice(i, 1);
	}
}

function zoneKitTryBounce(p){
	if(!p || !p._zoneRoll) return false;
	const prevX = p.x - p.vx, prevY = p.y - p.vy;
	let hitV = zoneBlocked(p.x, prevY), hitH = zoneBlocked(prevX, p.y);
	if(!hitV && !hitH){ hitH = true; }
	if(hitV){ p.vy = -Math.abs(p.vy) * 0.7; p.y = prevY; }
	if(hitH){ p.vx = -p.vx; p.x = prevX; }
	p._zoneBounces = (p._zoneBounces || 0) + 1;
	zoneSpark(p.x, p.y, 8, { r: 160, g: 130, b: 80 });
	if(p._zoneBounces >= (p._zoneBounceMax || 3)){
		p._zoneRoll = false;
		for(let i = 0; i < 3; i++){
			const a = -0.8 + i * 0.8;
			const s = zoneSpawn(null, p.x, p.y, Math.cos(a) * 4.2, Math.sin(a) * 3.2, {
				color: '#8a7348', color2: '#c4a46a', power: 10, width: 18, height: 18,
				shape: 'circle', gravity: 0.2, maxAge: 70, _zoneStyle: 'boulder'
			});
			if(s && p.necroFriendly) s.necroFriendly = true;
		}
		p.age = p.maxAge;
	}
	return true;
}

function zoneKitBlockPlayerProj(p){
	if(!p) return false;
	for(let i = 0; i < zoneWorldFX.length; i++){
		const fx = zoneWorldFX[i];
		if(fx.kind !== 'decoy') continue;
		if(p.x > fx.x && p.x < fx.x + fx.w && p.y > fx.y && p.y < fx.y + fx.h){
			fx.age = fx.max || 180;
			zoneSpark(p.x, p.y, 10, { r: 160, g: 130, b: 80 });
			return true;
		}
	}
	return false;
}
function zoneKitOnEnemyHit(en){
	if(!en) return 1;
	if(en._zoneFrontGuard){
		const px = player.x + player.w / 2;
		const cx = en.x + en.w / 2;
		const fromFront = en.facing > 0 ? px >= cx : px <= cx;
		if(fromFront) return 0;
	}
	if(en._zoneCounter){
		zoneHit(en, en.x + en.w / 2, en.y + en.h / 2, 48, zoneDmg(14), []);
		zoneSpark(en.x + en.w / 2, en.y + en.h / 2, 12, { r: 255, g: 180, b: 60 });
		return 0.2;
	}
	if(en._zoneFurnace){
		if(en.zoneKit) en.zoneKit.t = Math.max(en.zoneKit.t, 96);
		en._zoneFurnace = false;
		return 1.5;
	}
	return 1;
}

function zoneKitSpriteRow(en){
	const type = (en && (en.necroType || en.type)) || '';
	if(!ZONE_KIT_TYPES[type]) return null;
	const img = (typeof ENEMY_SPRITE_SHEETS !== 'undefined') ? ENEMY_SPRITE_SHEETS[type] : null;
	const g = zoneKitSheetGrid(en, img);
	const six = g && g.rows === 6;
	if(en.dead) return six ? 5 : 3;
	if(en.zoneKit && en.zoneKit.row != null){
		let row = en.zoneKit.row;
		if(!six && row > 2) row = 2;
		return row;
	}
	return null;
}
function zoneKitSheetGrid(en, img){
	if(typeof dungeonRegularKitGrid === 'function') return dungeonRegularKitGrid(en, img, ZONE_KIT_TYPES);
	return null;
}

function drawZoneKitProj(p){
	const px = p.x - camera.x, py = p.y - camera.y;
	const r = Math.max(p.width, p.height) * 0.55;
	const g = ctx.createRadialGradient(px - r * 0.2, py - r * 0.25, r * 0.1, px, py, r);
	g.addColorStop(0, 'rgba(255,255,230,0.9)');
	g.addColorStop(0.4, p.color2 || '#e8d0a0');
	g.addColorStop(0.8, p.color || '#8a7040');
	g.addColorStop(1, 'rgba(40,30,10,0)');
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
}

function drawZoneKitWorld(){
	for(let i = 0; i < zoneWorldFX.length; i++){
		const fx = zoneWorldFX[i];
		const x = fx.x - camera.x, y = fx.y - camera.y;
		ctx.save();
		if(fx.kind === 'decoy' || fx.kind === 'prism' || fx.kind === 'wolfEcho'){
			ctx.globalAlpha = fx.kind === 'decoy' ? 0.7 : 0.4;
			ctx.fillStyle = fx.kind === 'prism' ? '#c090ee' : (fx.kind === 'wolfEcho' ? '#88aa55' : '#8a7348');
			ctx.fillRect(x, y, fx.w, fx.h);
		} else if(fx.kind === 'seed'){
			ctx.fillStyle = fx.plant ? '#4a7a30' : '#7a5a20';
			ctx.beginPath(); ctx.arc(x, y, fx.r || 8, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'spiderling'){
			ctx.fillStyle = '#4a3828'; ctx.fillRect(x - 5, y - 4, 10, 8);
		} else if(fx.kind === 'sparkMine'){
			ctx.fillStyle = fx.live ? '#ffe060' : '#c07030';
			ctx.beginPath(); ctx.arc(x, y, fx.r || 10, 0, Math.PI * 2); ctx.fill();
			if(fx.live){
				ctx.strokeStyle = 'rgba(255,220,80,0.45)'; ctx.lineWidth = 2;
				for(let j = i + 1; j < zoneWorldFX.length; j++){
					const o = zoneWorldFX[j];
					if(o.kind !== 'sparkMine' || !o.live) continue;
					ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(o.x - camera.x, o.y - camera.y); ctx.stroke();
				}
			}
		} else if(fx.kind === 'barrier'){
			ctx.fillStyle = 'rgba(160,160,180,0.7)'; ctx.fillRect(x - fx.w / 2, y, fx.w, fx.h);
		} else if(fx.kind === 'slagChunk' || fx.kind === 'crater'){
			ctx.fillStyle = 'rgba(200,80,30,0.55)';
			ctx.beginPath(); ctx.arc(x, y, fx.r || 16, 0, Math.PI * 2); ctx.fill();
		} else if(fx.kind === 'mud'){
			ctx.globalAlpha = 0.55; ctx.fillStyle = '#6a5438';
			ctx.fillRect(x - fx.w / 2, y - 6, fx.w, fx.h || 14);
		} else if(fx.kind === 'debris'){
			ctx.fillStyle = '#553322'; ctx.fillRect(x - fx.w / 2, y - fx.h / 2, fx.w, fx.h);
		} else if(fx.kind === 'web'){
			ctx.strokeStyle = 'rgba(230,220,200,0.45)'; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.moveTo(fx.x1 - camera.x, fx.y1 - camera.y); ctx.lineTo(fx.x2 - camera.x, fx.y2 - camera.y); ctx.stroke();
		}
		ctx.restore();
	}
	if(typeof enemies !== 'undefined') for(let i = 0; i < enemies.length; i++) drawZoneEnemyFX(enemies[i]);
	if(typeof playerMinions !== 'undefined') for(let i = 0; i < playerMinions.length; i++) drawZoneEnemyFX(playerMinions[i]);
}

function drawZoneEnemyFX(en){
	if(!en || en.dead || !en.zoneKit) return;
	const kit = en.zoneKit;
	ctx.save();
	if(kit.kind === 'faultStep'){
		ctx.strokeStyle = 'rgba(200,160,80,0.8)'; ctx.lineWidth = 4;
		const t = Math.min(1, kit.t / 50);
		ctx.beginPath(); ctx.moveTo(kit.x0 - camera.x, kit.y - camera.y);
		ctx.lineTo(kit.x0 + (kit.x1 - kit.x0) * t - camera.x, kit.y - camera.y); ctx.stroke();
		if(kit.split){
			const u = Math.min(1, (kit.t - 28) / 28);
			[kit.a, kit.b].forEach(function(L){
				ctx.beginPath(); ctx.moveTo(L.x - camera.x, kit.y - camera.y);
				ctx.lineTo(L.x + (L.tx - L.x) * u - camera.x, kit.y - camera.y); ctx.stroke();
			});
		}
	}
	if(kit.kind === 'gravityGrip' && kit.pillars){
		ctx.fillStyle = 'rgba(150,120,70,0.75)';
		for(let i = 0; i < kit.pillars.length; i++){
			const P = kit.pillars[i];
			ctx.fillRect(P.x - 8 - camera.x, P.y - P.h - camera.y, 16, P.h);
		}
	}
	if(kit.kind === 'vineTunnel' && kit.paths){
		ctx.strokeStyle = 'rgba(80,140,50,0.6)'; ctx.lineWidth = 5;
		for(let i = 0; i < kit.paths.length; i++){
			const P = kit.paths[i];
			ctx.beginPath(); ctx.moveTo(en.x + en.w / 2 - camera.x, P.y - camera.y);
			ctx.lineTo(P.x - camera.x, P.y - camera.y); ctx.stroke();
		}
	}
	if(kit.kind === 'graspingGround' && kit.roots){
		ctx.fillStyle = kit.t > 48 ? '#5a8a30' : '#3a5a20';
		for(let i = 0; i < kit.roots.length; i++) ctx.fillRect(kit.roots[i].x - 4 - camera.x, kit.roots[i].y - 18 - camera.y, 8, 18);
	}
	if(kit.kind === 'ceilingDrop'){
		ctx.fillStyle = 'rgba(0,0,0,0.35)';
		ctx.beginPath(); ctx.ellipse(kit.sx - camera.x, zoneFloorY(kit.sx, en.y) - camera.y, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
	}
	if(kit.kind === 'crystalRelay' && kit.nodes){
		ctx.fillStyle = '#d090ff';
		for(let i = 0; i < kit.nodes.length; i++){
			ctx.beginPath(); ctx.arc(kit.nodes[i].x - camera.x, kit.nodes[i].y - camera.y, 8, 0, Math.PI * 2); ctx.fill();
		}
	}
	if(kit.kind === 'crystalPrison' && kit.pillars){
		ctx.fillStyle = 'rgba(200,140,255,0.7)';
		for(let i = 0; i < kit.pillars.length; i++){
			const P = kit.pillars[i];
			const px = kit.cx + Math.cos(P.ang) * P.r - camera.x;
			const py = kit.cy + Math.sin(P.ang) * P.r * 0.4 - camera.y;
			ctx.fillRect(px - 6, py - 28, 12, 36);
		}
	}
	if(kit.kind === 'sinkhole'){
		ctx.fillStyle = 'rgba(80,60,30,0.35)';
		ctx.beginPath(); ctx.arc(kit.cx - camera.x, kit.cy - camera.y, kit.r, 0, Math.PI * 2); ctx.fill();
	}
	if(kit.kind === 'mudWave'){
		ctx.fillStyle = 'rgba(100,80,40,0.55)';
		ctx.fillRect(kit.x - kit.w / 2 - camera.x, kit.y - 10 - camera.y, kit.w, 16);
	}
	if(kit.kind === 'bogClone'){
		ctx.globalAlpha = 0.55; ctx.fillStyle = '#6a5438';
		ctx.fillRect(kit.x - 16 - camera.x, kit.y - camera.y, 32, 40);
	}
	if(kit.kind === 'overheat'){
		ctx.strokeStyle = 'rgba(255,120,40,' + (0.4 + kit.heat * 0.5) + ')';
		ctx.lineWidth = 3;
		ctx.beginPath(); ctx.arc(en.x + en.w / 2 - camera.x, en.y + en.h / 2 - camera.y, 20 + kit.heat * 18, 0, Math.PI * 2); ctx.stroke();
	}
	if(kit.kind === 'furnaceHeart'){
		ctx.fillStyle = 'rgba(255,140,40,0.55)';
		ctx.beginPath(); ctx.arc(en.x + en.w / 2 - camera.x, en.y + en.h * 0.4 - camera.y, 12 + kit.grow * 10, 0, Math.PI * 2); ctx.fill();
	}
	if(kit.kind === 'assemblyStrike' && !kit.punched){
		ctx.strokeStyle = 'rgba(200,200,220,0.7)'; ctx.lineWidth = 2;
		ctx.strokeRect(kit.tx - 20 - camera.x, kit.ty - 20 - camera.y, 40, 40);
	}
	if(en._zoneFrontGuard){
		ctx.fillStyle = 'rgba(180,180,200,0.45)';
		ctx.fillRect(en.x + (en.facing > 0 ? en.w - 6 : -10) - camera.x, en.y - camera.y, 16, en.h);
	}
	ctx.restore();
}

function registerZoneKitCasts(map){
	const casts = {
		castGolemBoulderRoll, castGolemFaultStep, castGolemStoneDecoy, castGolemGravityGrip,
		castVineTunnel, castVineThornWheel, castVineGraspingGround, castVineSeedBomb,
		castSpiderCeilingDrop, castSpiderWebSwing, castSpiderEggSac, castSpiderWebMaze,
		castCrystalRelay, castCrystalShardRain, castCrystalPrismClone, castCrystalPrison,
		castMudWave, castMudBogClone, castMudSinkhole, castMudMudslide,
		castSentinelShieldMarch, castSentinelCounterSpark, castSentinelMagneticPull, castSentinelAssemblyStrike,
		castDroneWeldingBeam, castDroneSparkMine, castDroneOverheat, castDroneDive,
		castBruteSlagHammer, castBruteFurnaceHeart, castBruteSlagThrow, castBruteFoundryCollapse,
		castWolfHuntingCircle, castWolfThornPounce, castWolfPackEcho, castWolfPredatoryFeint
	};
	for(const k in casts){
		if(typeof window !== 'undefined') window[k] = casts[k];
		if(map) map[k] = casts[k];
	}
}
registerZoneKitCasts(typeof CAST_FNS !== 'undefined' ? CAST_FNS : null);

if(typeof window !== 'undefined'){
	window.updateZoneKitEnemy = updateZoneKitEnemy;
	window.updateZoneKitWorld = updateZoneKitWorld;
	window.drawZoneKitWorld = drawZoneKitWorld;
	window.drawZoneKitProj = drawZoneKitProj;
	window.zoneKitTryBounce = zoneKitTryBounce;
	window.zoneKitOnEnemyHit = zoneKitOnEnemyHit;
	window.zoneKitBlockPlayerProj = zoneKitBlockPlayerProj;
	window.zoneKitSpriteRow = zoneKitSpriteRow;
	window.zoneKitSheetGrid = zoneKitSheetGrid;
	window.zoneEnd = zoneEnd;
	window.ZONE_KIT_TYPES = ZONE_KIT_TYPES;
	window.registerZoneKitCasts = registerZoneKitCasts;
}
