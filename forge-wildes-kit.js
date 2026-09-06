/* =============================================================
   Iron Forge + Thorn Wolf kit
   Iron Sentinel, Forge Drone, Slag Brute, Thorn Wolf
   Threats spawn immediately and keep going if the caster dies.
   ============================================================= */

const FORGE_KIT_TYPES = { ironSentinel:1, forgeDrone:1, slagBrute:1, thornWolf:1 };
const forgeWorldFX = [];

function atkS(n){ return n * ((typeof ENEMY_ATK_SCALE === 'number') ? ENEMY_ATK_SCALE : 1.3); }
function kitAim(en){ return (typeof fireKitAim === 'function') ? fireKitAim(en) : { x: player.x + player.w / 2, y: player.y + player.h / 2, vx: player.vx || 0, vy: player.vy || 0, box: player }; }
function kitLead(en, frames){
	const a = kitAim(en);
	const t = frames == null ? 14 : frames;
	return { x: a.x + (a.vx || 0) * t, y: a.y + (a.vy || 0) * t, vx: a.vx || 0, vy: a.vy || 0, box: a.box };
}
function kitFriendly(en){ return !!(en && (en.isNecroSummon || en.necroFriendly)); }
function kitDmg(n){ return Math.round(n * 2.55 * ((typeof DIFF_DMG_MULT === 'number') ? DIFF_DMG_MULT : 1)); }
function kitFloor(x, y){ return (typeof fireKitFloorY === 'function') ? fireKitFloorY(x, y) : ((y || 0) + 80); }
function kitBlocked(x, y){ return (typeof fireKitBlocked === 'function') ? fireKitBlocked(x, y) : false; }
function kitShake(a, t){ if(typeof shakeScreen === 'function') shakeScreen(a, t); }
function kitSpark(x, y, n, color){
	if(typeof particles === 'undefined') return;
	const c = color || { r: 255, g: 170, b: 60 };
	for(let i = 0; i < Math.min(n || 12, 22); i++){
		const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 6;
		particles.push({ x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 12, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.6, life: 16 + Math.random() * 16, maxLife: 32, r: 2 + Math.random() * 3, color: c });
	}
}
function forgeSpawn(en, x, y, vx, vy, opts){
	opts = opts || {};
	opts.noZoneNerf = true;
	const p = spawnEnemyProj(x, y, vx, vy, opts);
	if(p){
		p._forgeStyle = opts._forgeStyle || 'spark';
		if(kitFriendly(en)){
			if(typeof markNecroFriendlyProj === 'function') markNecroFriendlyProj(p, en);
			else p.necroFriendly = true;
		}
	}
	return p;
}
function forgeHit(en, x, y, r, dmg, effects){
	r = atkS(r);
	if(kitFriendly(en)){
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
function kitSlowSet(amt){ player._kitSlow = Math.max(player._kitSlow || 0, amt); }
function forgeEnd(en){
	if(!en) return;
	en.forgeKit = null;
	en._forgeKitBusy = false;
	en._ironFrontGuard = false;
	en._ironCounter = false;
	en._ironMagnet = false;
	en._furnaceOpen = false;
	en._droneOverheat = false;
}
function beginForgeKit(en, kind, extra){
	en.forgeKit = Object.assign({ kind, t: 0, type: en.necroType || en.type, row: 2 }, extra || {});
	en._forgeKitBusy = extra && extra.busy === false ? false : true;
	en.attackAnimTimer = Math.max(en.attackAnimTimer || 0, 36);
	en.facing = kitAim(en).x >= en.x + en.w / 2 ? 1 : -1;
	return en.forgeKit;
}
function forgeFX(fx){ forgeWorldFX.push(fx); return fx; }

/* ---------- IRON SENTINEL ---------- */
function castSentinelShieldMarch(en){
	const aim = kitAim(en);
	beginForgeKit(en, 'shieldMarch', { busy: true, dir: aim.x >= en.x + en.w / 2 ? 1 : -1, bashed: false });
	en._ironFrontGuard = true;
}
function castSentinelCounterSpark(en){
	beginForgeKit(en, 'counterSpark', { busy: true });
	en._ironCounter = true;
}
function castSentinelMagneticPull(en){
	beginForgeKit(en, 'magneticPull', { busy: true });
	en._ironMagnet = true;
	forgeFX({ kind: 'magnetburst', en, x: en.x + en.w / 2, y: en.y + en.h * 0.4, age: 0, max: 40, fired: false });
	kitSpark(en.x + en.w / 2, en.y + en.h * 0.4, 14, { r: 120, g: 180, b: 255 });
}
function castSentinelAssemblyStrike(en){
	const aim = kitLead(en, 12);
	const bits = [];
	for(let i = 0; i < 5; i++){
		bits.push({ x: en.x + en.w / 2, y: en.y + 10, tx: aim.x + (i - 2) * 36, ty: aim.y - 8 + i * 10 });
	}
	forgeFX({ kind: 'assembly', en, bits, age: 0, max: 55, punched: false, hx: aim.x, hy: aim.y });
	spawnTelegraph(aim.x - 56, aim.y - 40, 112, 80, 22, 'rgba(255,170,60,0.4)', 'rect', '');
	beginForgeKit(en, 'assemblyStrike', { busy: false });
	setTimeout(function(){ if(en.forgeKit && en.forgeKit.kind === 'assemblyStrike') forgeEnd(en); }, 240);
}

/* ---------- FORGE DRONE ---------- */
function castDroneWeldingBeam(en){
	const aim = kitLead(en, 8);
	const x = aim.x + (Math.random() < 0.5 ? -64 : 64);
	forgeFX({ kind: 'barrier', en, x, y: kitFloor(x, aim.y), h: 16, maxH: atkS(96), age: 0, max: 220 });
	kitSpark(x, kitFloor(x, aim.y), 10, { r: 255, g: 160, b: 50 });
	beginForgeKit(en, 'weldingBeam', { busy: false });
	setTimeout(function(){ if(en.forgeKit && en.forgeKit.kind === 'weldingBeam') forgeEnd(en); }, 200);
}
function castDroneSparkMine(en){
	const aim = kitLead(en, 6);
	for(let i = 0; i < 5; i++){
		forgeFX({ kind: 'mine', en, x: aim.x + (i - 2) * 70, y: kitFloor(aim.x, aim.y) - 6, age: 0, max: 260, hot: false });
	}
	beginForgeKit(en, 'sparkMine', { busy: false });
	setTimeout(function(){ if(en.forgeKit && en.forgeKit.kind === 'sparkMine') forgeEnd(en); }, 220);
}
function castDroneOverheat(en){
	beginForgeKit(en, 'overheat', { busy: true, heat: 0 });
	en._droneOverheat = true;
}
function castDroneDive(en){
	const aim = kitLead(en, 10);
	const ang = Math.atan2(aim.y - (en.y + en.h / 2), aim.x - (en.x + en.w / 2));
	beginForgeKit(en, 'droneDive', { busy: true, ang, bounced: false, hitCd: 0 });
}

/* ---------- SLAG BRUTE ---------- */
function castBruteSlagHammer(en){
	const aim = kitLead(en, 8);
	const x = aim.x, y = kitFloor(aim.x, aim.y);
	forgeFX({ kind: 'hammer', en, x, y, age: 0, max: 50, slammed: false });
	spawnTelegraph(x - 64, y - 24, 128, 28, 18, 'rgba(255,80,20,0.45)', 'rect', '');
	beginForgeKit(en, 'slagHammer', { busy: false });
	setTimeout(function(){ if(en.forgeKit && en.forgeKit.kind === 'slagHammer') forgeEnd(en); }, 220);
}
function castBruteFurnaceHeart(en){
	if(!en._savedW){ en._savedW = en.w; en._savedH = en.h; }
	beginForgeKit(en, 'furnaceHeart', { busy: true, grow: 0 });
	en._furnaceOpen = true;
}
function castBruteSlagThrow(en){
	const aim = kitLead(en, 8);
	for(let i = 0; i < 4; i++){
		const sx = aim.x + (i - 1.5) * 78;
		forgeFX({ kind: 'chunk', en, x: sx, y: kitFloor(sx, aim.y) - 4, age: 0, max: 140, erupted: false });
	}
	kitSpark(en.x + en.w / 2, en.y, 12, { r: 255, g: 100, b: 30 });
	beginForgeKit(en, 'slagThrow', { busy: false });
	setTimeout(function(){ if(en.forgeKit && en.forgeKit.kind === 'slagThrow') forgeEnd(en); }, 220);
}
function castBruteFoundryCollapse(en){
	const dir = kitAim(en).x >= en.x + en.w / 2 ? 1 : -1;
	forgeFX({ kind: 'collapse', en, dir, age: 0, max: 70, slammed: false, x: en.x, y: en.y });
	beginForgeKit(en, 'foundryCollapse', { busy: true, dir });
}

/* ---------- THORN WOLF ---------- */
function castWolfHuntingCircle(en){
	const aim = kitLead(en, 10);
	forgeFX({ kind: 'wolfdash', en, x: aim.x, y: aim.y, age: 0, max: 36, fireAt: 24, r: 42, dmg: 34, launch: true });
	beginForgeKit(en, 'huntingCircle', { busy: true, dang: Math.random() * Math.PI * 2 });
}
function castWolfThornPounce(en){
	const aim = kitLead(en, 8);
	const dir = aim.x >= en.x + en.w / 2 ? 1 : -1;
	forgeFX({ kind: 'wolfdash', en, x: aim.x, y: aim.y, age: 0, max: 24, fireAt: 12, r: 36, dmg: 28, launch: false, thorns: true, dir });
	beginForgeKit(en, 'thornPounce', { busy: true, dir });
	spawnTelegraph(en.x + (dir > 0 ? en.w : -150), en.y - 6, 150, en.h + 16, 14, 'rgba(140,200,60,0.4)', 'rect', '');
}
function castWolfPackEcho(en){
	beginForgeKit(en, 'packEcho', { busy: true, echoes: [{ t: 6 }, { t: 12 }], dashed: false });
}
function castWolfPredatoryFeint(en){
	const aim = kitAim(en);
	beginForgeKit(en, 'predatoryFeint', { busy: true, dir: aim.x >= en.x + en.w / 2 ? 1 : -1, phase: 'fake' });
}

/* ---------- ticks ---------- */
function updateForgeKitEnemy(en){
	const kit = en.forgeKit;
	if(!kit){ en._forgeKitBusy = false; return false; }
	kit.t++;
	const type = kit.type || en.necroType || en.type;
	if(type === 'ironSentinel') tickSentinel(en, kit);
	else if(type === 'forgeDrone') tickDrone(en, kit);
	else if(type === 'slagBrute') tickBrute(en, kit);
	else if(type === 'thornWolf') tickWolf(en, kit);
	else forgeEnd(en);
	return !!en._forgeKitBusy;
}

function tickSentinel(en, kit){
	const aim = kitAim(en);
	if(kit.kind === 'shieldMarch'){
		en.x += kit.dir * 2.55;
		const sx = en.x + (kit.dir > 0 ? en.w : -22);
		if(!kitFriendly(en) && rectRect({ x: sx, y: en.y, w: 26, h: en.h }, player)){
			if(!kit.bashed && kit.t > 18){
				kit.bashed = true;
				forgeHit(en, player.x + player.w / 2, player.y + player.h / 2, 36, kitDmg(34), ['stun', 'horizontalLaunch']);
				player.x += kit.dir * 28;
				kitShake(6, 10);
			}
		}
		if(kit.t > 56){ en._ironFrontGuard = false; forgeEnd(en); }
	} else if(kit.kind === 'counterSpark'){
		if(kit.t > 50){ en._ironCounter = false; forgeEnd(en); }
	} else if(kit.kind === 'magneticPull'){
		if(!kitFriendly(en)){
			const dx = (en.x + en.w / 2) - (player.x + player.w / 2);
			if(Math.abs(dx) < 280) player.x += (dx > 0 ? 1 : -1) * 1.55;
		}
		if(kit.t === 28) en._ironMagnet = false;
		if(kit.t > 42) forgeEnd(en);
	} else if(kit.t > 14) forgeEnd(en);
}

function tickDrone(en, kit){
	const aim = kitLead(en, 8);
	if(kit.kind === 'overheat'){
		kit.heat = Math.min(1, kit.t / 44);
		if(en.dead){ en._droneOverheat = false; forgeEnd(en); return; }
		if(kit.t === 46){
			forgeHit(en, en.x + en.w / 2, en.y + en.h / 2, 92, kitDmg(42), ['burn', 'stun']);
			const ring = forgeSpawn(en, en.x + en.w / 2, en.y + en.h / 2, 0, 0, {
				color: '#ff5511', color2: '#ffe080', power: 34, width: 22, height: 22,
				shape: 'ring', maxAge: 28, aoe: true, aoeRadius: 120, aoeMax: 26, _forgeStyle: 'spark'
			});
			if(ring) ring._forgeStyle = 'spark';
			kitShake(8, 14);
			en._droneOverheat = false;
		}
		if(kit.t > 56) forgeEnd(en);
	} else if(kit.kind === 'droneDive'){
		if(kit.hitCd > 0) kit.hitCd--;
		en.x += Math.cos(kit.ang) * 12.2;
		en.y += Math.sin(kit.ang) * 12.2;
		if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
		if(kit.hitCd <= 0 && forgeHit(en, en.x + en.w / 2, en.y + en.h / 2, 32, kitDmg(26), ['burn'])) kit.hitCd = 8;
		if(!kit.bounced && (kitBlocked(en.x + en.w / 2 + Math.cos(kit.ang) * 16, en.y + en.h / 2) || kit.t > 18)){
			kit.bounced = true;
			kit.ang = Math.atan2(aim.y - (en.y + en.h / 2), aim.x - (en.x + en.w / 2));
		} else if(kit.bounced && kit.t > 38) forgeEnd(en);
	} else if(kit.t > 10) forgeEnd(en);
}

function tickBrute(en, kit){
	const aim = kitAim(en);
	if(kit.kind === 'furnaceHeart'){
		kit.grow = Math.min(1, kit.t / 70);
		if(!kitFriendly(en) && Math.hypot(aim.x - (en.x + en.w / 2), aim.y - (en.y + en.h / 2)) < 200){
			player.x += ((en.x + en.w / 2) - aim.x) * 0.02;
		}
		if(kit.t > 80){
			en._furnaceOpen = false;
			en.w = Math.min(Math.round((en._savedW || en.w) * 1.32), Math.round((en._savedW || en.w) * (1 + kit.grow * 0.32)));
			en.h = Math.min(Math.round((en._savedH || en.h) * 1.2), Math.round((en._savedH || en.h) * (1 + kit.grow * 0.2)));
			forgeEnd(en);
		}
	} else if(kit.kind === 'foundryCollapse'){
		if(kit.t > 44) forgeEnd(en);
	} else if(kit.t > 10) forgeEnd(en);
}

function tickWolf(en, kit){
	const aim = kitLead(en, 6);
	if(kit.kind === 'huntingCircle'){
		kit.dang += 0.2;
		const r = 78;
		en.x = aim.x + Math.cos(kit.dang) * r - en.w / 2;
		en.y = aim.y + Math.sin(kit.dang) * 16 - en.h / 2;
		if(kit.t % 4 === 0) forgeFX({ kind: 'thorntrail', x: en.x + en.w / 2, y: en.y + en.h, age: 0, max: 40, en });
		if(kit.t === 24){
			const dx = aim.x - (en.x + en.w / 2), dy = aim.y - (en.y + en.h / 2), d = Math.hypot(dx, dy) || 1;
			en.x += dx / d * 110;
		}
		if(kit.t > 38) forgeEnd(en);
	} else if(kit.kind === 'thornPounce'){
		if(kit.t === 12){
			en.x += kit.dir * 120;
		}
		if(kit.t > 24) forgeEnd(en);
	} else if(kit.kind === 'packEcho'){
		if(kit.t === 10 && !kit.dashed){
			kit.dashed = true;
			const dir = aim.x >= en.x + en.w / 2 ? 1 : -1;
			kit.dashDir = dir;
			kit.fromX = en.x; kit.fromY = en.y;
			en.x += dir * 120;
			forgeHit(en, en.x + en.w / 2, en.y + en.h / 2, 34, kitDmg(32), []);
		}
		if(kit.dashed){
			for(let i = 0; i < kit.echoes.length; i++){
				if(kit.t === 10 + kit.echoes[i].t){
					forgeHit(en, (kit.fromX || en.x) + kit.dashDir * 120 + en.w / 2, en.y + en.h / 2, 28, kitDmg(18), []);
				}
			}
		}
		if(kit.t > 30) forgeEnd(en);
	} else if(kit.kind === 'predatoryFeint'){
		if(kit.phase === 'fake'){
			en.x += kit.dir * 8.4;
			if(kit.t === 8){ kit.phase = 'slide'; kit.dir *= -1; }
		} else if(kit.phase === 'slide'){
			en.x += kit.dir * 10.2;
			if(kit.t === 16){
				kit.phase = 'real';
				en.x += kit.dir * 70;
				forgeHit(en, en.x + en.w / 2, en.y + en.h / 2, 38, kitDmg(36), ['horizontalLaunch']);
			}
		}
		if(kit.t > 26) forgeEnd(en);
	}
}

function updateForgeKitWorld(){
	for(let i = forgeWorldFX.length - 1; i >= 0; i--){
		const fx = forgeWorldFX[i];
		fx.age++;
		if(fx.kind === 'barrier'){
			fx.h = Math.min(fx.maxH, 20 + fx.age * 6);
			if(Math.abs((player.x + player.w / 2) - fx.x) < 18 && player.y + player.h > fx.y - fx.h){
				player.x += player.x + player.w / 2 < fx.x ? -3.2 : 3.2;
			}
		} else if(fx.kind === 'mine'){
			const near = Math.hypot(player.x + player.w / 2 - fx.x, player.y + player.h - fx.y) < 58;
			if(near) fx.hot = true;
			if(fx.hot){
				for(let j = 0; j < forgeWorldFX.length; j++){
					const o = forgeWorldFX[j];
					if(o.kind !== 'mine' || o === fx) continue;
					if(Math.hypot(o.x - fx.x, o.y - fx.y) < 110){
						o.hot = true;
						if(segHitsPlayer(fx.x, fx.y, o.x, o.y)) forgeHit(fx.en, player.x + player.w / 2, player.y + player.h / 2, 20, kitDmg(20), []);
					}
				}
			}
		} else if(fx.kind === 'hammer' && !fx.slammed && fx.age === 16){
			fx.slammed = true;
			forgeHit(fx.en, fx.x, fx.y - 24, 64, kitDmg(40), ['burn', 'horizontalLaunch']);
			forgeFX({ kind: 'crater', en: fx.en, x: fx.x, y: fx.y, r: atkS(62), age: 0, max: 180 });
			kitShake(8, 14);
		} else if(fx.kind === 'crater'){
			if(circRect(fx.x, fx.y, fx.r * 0.6, player.x, player.y, player.w, player.h)){
				kitSlowSet(0.4);
				if(fx.age % 12 === 0) forgeHit(fx.en, fx.x, fx.y, 28, kitDmg(16), ['burn']);
			}
		} else if(fx.kind === 'chunk' && !fx.erupted && fx.age === 36){
			fx.erupted = true;
			forgeSpawn(fx.en, fx.x, fx.y, 0, -10.2, {
				color: '#ee5520', color2: '#ffe080', power: 32, width: 44, height: 58,
				shape: 'meteor', maxAge: 55, trail: 'flame', effects: ['burn'], _forgeStyle: 'slag'
			});
		} else if(fx.kind === 'collapse'){
			if(fx.age % 5 === 0 && fx.age < 24 && fx.en){
				forgeFX({ kind: 'slagblock', x: fx.en.x + Math.random() * fx.en.w, y: kitFloor(fx.en.x, fx.en.y) - 4, w: atkS(36), h: atkS(24), age: 0, max: 220 });
			}
			if(fx.age === 26 && !fx.slammed && fx.en){
				fx.slammed = true;
				fx.en.x += fx.dir * 90;
				forgeHit(fx.en, fx.en.x + fx.en.w / 2, fx.en.y + fx.en.h / 2, 60, kitDmg(40), ['burn', 'horizontalLaunch']);
				kitShake(9, 14);
			}
		} else if(fx.kind === 'slagblock'){
			if(Math.abs(player.x + player.w / 2 - fx.x) < fx.w * 0.55 && player.y + player.h > fx.y - fx.h){
				player.x += player.x < fx.x ? -2.2 : 2.2;
			}
		} else if(fx.kind === 'assembly' && !fx.punched){
			for(let b = 0; b < fx.bits.length; b++){
				fx.bits[b].x += (fx.bits[b].tx - fx.bits[b].x) * 0.2;
				fx.bits[b].y += (fx.bits[b].ty - fx.bits[b].y) * 0.2;
			}
			if(fx.age === 20){
				fx.punched = true;
				if(fx.en && !fx.en.dead) fx.en.x = fx.hx - fx.en.w / 2;
				forgeHit(fx.en, fx.hx, fx.hy, 62, kitDmg(40), ['horizontalLaunch']);
				kitShake(7, 12);
			}
		} else if(fx.kind === 'magnetburst' && !fx.fired && fx.age === 20){
			fx.fired = true;
			const ox = fx.en && !fx.en.dead ? fx.en.x + fx.en.w / 2 : fx.x;
			const oy = fx.en && !fx.en.dead ? fx.en.y + fx.en.h * 0.4 : fx.y;
			for(let k = 0; k < 10; k++){
				const a = (k / 10) * Math.PI * 2;
				forgeSpawn(fx.en, ox, oy, Math.cos(a) * 8.8, Math.sin(a) * 8.8, {
					color: '#d0d8e4', color2: '#ffffff', power: 30, width: 34, height: 34,
					shape: 'spike', maxAge: 70, trail: 'spark', _forgeStyle: 'steel'
				});
			}
			kitShake(6, 10);
		} else if(fx.kind === 'wolfdash' && fx.age === fx.fireAt){
			const aim = kitLead(fx.en, 4);
			forgeHit(fx.en, aim.x, aim.y, fx.r, kitDmg(fx.dmg), fx.launch ? ['horizontalLaunch'] : []);
			if(fx.thorns){
				const dir = fx.dir || 1;
				for(let k = 0; k < 7; k++){
					const a = Math.PI + (k - 3) * 0.26;
					forgeSpawn(fx.en, aim.x, aim.y, Math.cos(a) * dir * -8.4, Math.sin(a) * 4.2, {
						color: '#6a8a3a', color2: '#e8ff88', power: 24, width: 32, height: 20,
						shape: 'spike', maxAge: 55, _forgeStyle: 'thorn'
					});
				}
			}
			kitShake(5, 8);
		} else if(fx.kind === 'thorntrail' && circRect(fx.x, fx.y, 14, player.x, player.y, player.w, player.h)){
			if(fx.age % 10 === 0) forgeHit(fx.en, fx.x, fx.y, 14, kitDmg(12), []);
		}
		if(fx.age >= fx.max) forgeWorldFX.splice(i, 1);
	}
}

function segHitsPlayer(x1, y1, x2, y2){
	const px = player.x + player.w / 2, py = player.y + player.h / 2;
	const dx = x2 - x1, dy = y2 - y1, d2 = dx * dx + dy * dy || 1;
	let t = ((px - x1) * dx + (py - y1) * dy) / d2;
	t = Math.max(0, Math.min(1, t));
	return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t)) < 18;
}

function forgeKitSteerPlayerProj(p){
	if(!p || p.hasHit) return;
	const pool = (typeof enemies !== 'undefined' ? enemies : []).concat(typeof playerMinions !== 'undefined' ? playerMinions : []);
	for(let i = 0; i < pool.length; i++){
		const en = pool[i];
		if(!en || !en._ironMagnet) continue;
		const dx = en.x + en.w / 2 - p.x, dy = en.y + en.h / 2 - p.y, d = Math.hypot(dx, dy) || 1;
		if(d < 300){ p.vx += dx / d * 0.75; p.vy += dy / d * 0.75; }
	}
}

function forgeKitOnEnemyHit(en, p){
	if(!en) return 1;
	let mult = 1;
	if(en._ironFrontGuard && p){
		const fromFront = (en.facing >= 0 && p.x < en.x + en.w * 0.55) || (en.facing < 0 && p.x > en.x + en.w * 0.45);
		if(fromFront){
			p.hasHit = true;
			kitSpark(p.x, p.y, 8, { r: 200, g: 200, b: 210 });
			dmgNumbers.push({ x: en.x + en.w / 2, y: en.y - 10, text: 'BLOCKED', age: 0, color: '#ccd0d8' });
			return 0;
		}
	}
	if(en._ironCounter){
		en._ironCounter = false;
		forgeHit(en, en.x + en.w / 2, en.y + en.h / 2, 72, kitDmg(30), ['stun']);
		kitSpark(en.x + en.w / 2, en.y + en.h / 2, 18, { r: 255, g: 200, b: 80 });
		kitShake(5, 8);
	}
	if(en._furnaceOpen){
		en._furnaceOpen = false;
		if(en.forgeKit && en.forgeKit.kind === 'furnaceHeart') forgeEnd(en);
		mult *= 1.45;
	}
	if(en._droneOverheat){
		en._droneOverheat = false;
		if(en.forgeKit && en.forgeKit.kind === 'overheat') forgeEnd(en);
	}
	return mult;
}

function forgeKitTryBounce(p){
	if(!p || !p._droneRico) return false;
	p.vx = -p.vx; p.vy = -Math.abs(p.vy);
	return true;
}

function forgeKitSpriteRow(en){
	const type = (en && (en.necroType || en.type)) || '';
	if(!FORGE_KIT_TYPES[type]) return null;
	if(en.dead){
		const meta = (typeof SPRITE_SHEET_META !== 'undefined') ? SPRITE_SHEET_META[type] : null;
		return (meta && meta.rows) ? meta.rows - 1 : 3;
	}
	if(en.forgeKit) return 2;
	return null;
}

function drawForgeKitProj(p){
	const px = p.x - camera.x, py = p.y - camera.y;
	const r = Math.max(p.width, p.height) * 0.68;
	const pulse = 0.5 + Math.sin((p.age || 0) * 0.32) * 0.5;
	const style = p._forgeStyle || 'spark';
	ctx.save();
	ctx.translate(px, py);
	ctx.shadowColor = style === 'thorn' ? '#b8ee55' : (style === 'steel' ? '#d0e4ff' : '#ff8844');
	ctx.shadowBlur = 16 + pulse * 8;
	if(style === 'steel'){
		ctx.rotate(Math.atan2(p.vy || 0, p.vx || 1));
		const g = ctx.createLinearGradient(-r, -r, r, r);
		g.addColorStop(0, '#ffffff');
		g.addColorStop(0.4, '#e8eef8');
		g.addColorStop(1, '#6a7484');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(r * 1.15, 0); ctx.lineTo(-r * 0.5, -r * 0.62); ctx.lineTo(-r * 0.15, 0); ctx.lineTo(-r * 0.5, r * 0.62);
		ctx.closePath(); ctx.fill();
		ctx.strokeStyle = 'rgba(255,200,80,0.7)'; ctx.lineWidth = 2; ctx.stroke();
	} else if(style === 'slag'){
		const g = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.08, 0, 0, r);
		g.addColorStop(0, '#fff6c0');
		g.addColorStop(0.3, '#ff7722');
		g.addColorStop(1, '#6a1400');
		ctx.fillStyle = g;
		ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * (1.15 + pulse * 0.12), 0, 0, Math.PI * 2); ctx.fill();
	} else if(style === 'thorn'){
		ctx.rotate(Math.atan2(p.vy || 0, p.vx || 1));
		ctx.fillStyle = '#88cc44';
		ctx.beginPath(); ctx.moveTo(r * 1.1, 0); ctx.lineTo(-r * 0.7, -r * 0.45); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(-r * 0.7, r * 0.45); ctx.closePath(); ctx.fill();
		ctx.strokeStyle = '#f0ff88'; ctx.lineWidth = 2; ctx.stroke();
	} else {
		const g = ctx.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.08, 0, 0, r);
		g.addColorStop(0, 'rgba(255,255,230,0.98)');
		g.addColorStop(0.35, '#ffe08a');
		g.addColorStop(0.75, '#ff6622');
		g.addColorStop(1, 'rgba(40,10,0,0)');
		ctx.fillStyle = g;
		ctx.beginPath(); ctx.arc(0, 0, r * (0.95 + pulse * 0.1), 0, Math.PI * 2); ctx.fill();
	}
	ctx.restore();
}

function drawForgeKitWorld(){
	for(let i = 0; i < forgeWorldFX.length; i++){
		const fx = forgeWorldFX[i];
		const x = fx.x - camera.x, y = fx.y - camera.y;
		if(fx.kind === 'barrier'){
			ctx.save(); ctx.shadowColor = '#ffaa44'; ctx.shadowBlur = 8;
			const g = ctx.createLinearGradient(x - 12, y - fx.h, x + 12, y);
			g.addColorStop(0, '#f4f7fc'); g.addColorStop(1, '#5a6270');
			ctx.fillStyle = g; ctx.fillRect(x - 12, y - fx.h, 24, fx.h); ctx.restore();
		} else if(fx.kind === 'mine'){
			ctx.save(); ctx.shadowColor = fx.hot ? '#ffe060' : '#aa7722'; ctx.shadowBlur = 10;
			ctx.fillStyle = fx.hot ? '#ffe060' : '#8a6622';
			ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
			if(fx.hot){
				ctx.strokeStyle = 'rgba(255,230,80,0.8)'; ctx.lineWidth = 2;
				ctx.beginPath(); ctx.arc(x, y, 18 + Math.sin(fx.age * 0.45) * 3, 0, Math.PI * 2); ctx.stroke();
				for(let j = 0; j < forgeWorldFX.length; j++){
					const o = forgeWorldFX[j];
					if(o.kind !== 'mine' || o === fx || !o.hot) continue;
					if(Math.hypot(o.x - fx.x, o.y - fx.y) < 110){
						ctx.strokeStyle = 'rgba(255,220,70,0.75)'; ctx.lineWidth = 3;
						ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(o.x - camera.x, o.y - camera.y); ctx.stroke();
					}
				}
			}
			ctx.restore();
		} else if(fx.kind === 'crater'){
			ctx.save(); ctx.globalAlpha = 0.65;
			const g = ctx.createRadialGradient(x, y, 4, x, y, fx.r);
			g.addColorStop(0, '#ff7722'); g.addColorStop(1, 'rgba(80,10,0,0)');
			ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, fx.r, 20, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
		} else if(fx.kind === 'chunk'){
			ctx.save(); ctx.shadowColor = '#ff6622'; ctx.shadowBlur = 8;
			ctx.fillStyle = '#ee6622';
			ctx.beginPath(); ctx.moveTo(x, y - 16); ctx.lineTo(x + 14, y); ctx.lineTo(x, y + 8); ctx.lineTo(x - 14, y); ctx.closePath(); ctx.fill(); ctx.restore();
		} else if(fx.kind === 'slagblock'){
			ctx.fillStyle = '#4a2210'; ctx.fillRect(x - fx.w / 2, y - fx.h, fx.w, fx.h);
			ctx.strokeStyle = '#ee6622'; ctx.strokeRect(x - fx.w / 2, y - fx.h, fx.w, fx.h);
		} else if(fx.kind === 'thorntrail'){
			ctx.strokeStyle = 'rgba(170,230,70,0.75)'; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.stroke();
		} else if(fx.kind === 'assembly' && fx.bits){
			ctx.save(); ctx.shadowColor = '#ffaa44'; ctx.shadowBlur = 8;
			ctx.fillStyle = '#c8d0dc';
			for(let b = 0; b < fx.bits.length; b++){
				ctx.fillRect(fx.bits[b].x - 7 - camera.x, fx.bits[b].y - 7 - camera.y, 14, 14);
			}
			ctx.restore();
		} else if(fx.kind === 'hammer' && !fx.slammed){
			ctx.save(); ctx.globalAlpha = 0.45; ctx.strokeStyle = '#ff6622'; ctx.lineWidth = 4;
			ctx.beginPath(); ctx.ellipse(x, y, 54, 16, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
		}
	}
	if(typeof enemies !== 'undefined') for(let i = 0; i < enemies.length; i++) drawForgeEnemyFX(enemies[i]);
	if(typeof playerMinions !== 'undefined') for(let i = 0; i < playerMinions.length; i++) drawForgeEnemyFX(playerMinions[i]);
}

function drawForgeEnemyFX(en){
	if(!en || en.dead || !en.forgeKit) return;
	const kit = en.forgeKit;
	if(kit.kind === 'shieldMarch'){
		const sx = en.x + (kit.dir > 0 ? en.w : -20) - camera.x;
		ctx.save(); ctx.shadowColor = '#dde4f0'; ctx.shadowBlur = 10;
		ctx.fillStyle = '#d8dee8'; ctx.fillRect(sx, en.y - camera.y, 20, en.h); ctx.restore();
	}
	if(kit.kind === 'counterSpark'){
		ctx.save(); ctx.strokeStyle = 'rgba(255,210,70,0.9)'; ctx.lineWidth = 4;
		ctx.shadowColor = '#ffcc44'; ctx.shadowBlur = 12;
		ctx.strokeRect(en.x - 6 - camera.x, en.y - 6 - camera.y, en.w + 12, en.h + 12); ctx.restore();
	}
	if(kit.kind === 'magneticPull'){
		ctx.save(); ctx.strokeStyle = 'rgba(130,190,255,0.7)'; ctx.lineWidth = 3;
		ctx.beginPath(); ctx.arc(en.x + en.w / 2 - camera.x, en.y + en.h / 2 - camera.y, 60 + Math.sin(kit.t * 0.25) * 12, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
	}
	if(kit.kind === 'overheat'){
		ctx.save(); ctx.globalAlpha = 0.3 + kit.heat * 0.55;
		ctx.fillStyle = '#ff3300';
		ctx.beginPath(); ctx.arc(en.x + en.w / 2 - camera.x, en.y + en.h / 2 - camera.y, 22 + kit.heat * 34, 0, Math.PI * 2); ctx.fill(); ctx.restore();
	}
	if(kit.kind === 'furnaceHeart'){
		ctx.save(); ctx.shadowColor = '#ff8800'; ctx.shadowBlur = 16;
		ctx.fillStyle = 'rgba(255,150,40,0.85)';
		ctx.beginPath(); ctx.arc(en.x + en.w / 2 - camera.x, en.y + en.h * 0.45 - camera.y, 14 + kit.grow * 14, 0, Math.PI * 2); ctx.fill(); ctx.restore();
	}
	if(kit.kind === 'packEcho' && kit.dashed){
		ctx.save(); ctx.globalAlpha = 0.4; ctx.fillStyle = '#9acc44';
		ctx.fillRect((kit.fromX || en.x) - camera.x, en.y - camera.y, en.w, en.h);
		ctx.fillRect((kit.fromX || en.x) + (kit.dashDir || 1) * 50 - camera.x, en.y - camera.y, en.w, en.h);
		ctx.restore();
	}
}

function registerForgeWildesCasts(map){
	const casts = {
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
registerForgeWildesCasts(typeof CAST_FNS !== 'undefined' ? CAST_FNS : null);

if(typeof window !== 'undefined'){
	window.updateForgeKitEnemy = updateForgeKitEnemy;
	window.updateForgeKitWorld = updateForgeKitWorld;
	window.drawForgeKitWorld = drawForgeKitWorld;
	window.drawForgeKitProj = drawForgeKitProj;
	window.forgeKitOnEnemyHit = forgeKitOnEnemyHit;
	window.forgeKitSteerPlayerProj = forgeKitSteerPlayerProj;
	window.forgeKitTryBounce = forgeKitTryBounce;
	window.forgeKitSpriteRow = forgeKitSpriteRow;
	window.forgeEnd = forgeEnd;
	window.FORGE_KIT_TYPES = FORGE_KIT_TYPES;
	window.registerForgeWildesCasts = registerForgeWildesCasts;
}
