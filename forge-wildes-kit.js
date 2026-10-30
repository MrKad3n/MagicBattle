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
	if(window.EFX){ EFX.sparkRGB(x, y, n, color, 'metal'); return; }
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
		p._efxEl = p._forgeStyle === 'thorn' ? 'nature' : (p._forgeStyle === 'slag' ? 'magma' : 'metal');
		if(kitFriendly(en)){
			if(typeof markNecroFriendlyProj === 'function') markNecroFriendlyProj(p, en);
			else p.necroFriendly = true;
		}
	}
	return p;
}
function forgeKitEl(en){ const t = en && (en.necroType || en.type); return t === 'thornWolf' ? 'nature' : (t === 'slagBrute' ? 'magma' : 'metal'); }
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
		if(window.EFX && EFX.armed(en, x, y, r)) return false;      // fair arming (enemy-fx.js)
		damagePlayer(dmg, effects || []);
		if(window.EFX) EFX.hit(player.x + player.w / 2, player.y + player.h / 2, forgeKitEl(en), dmg * 0.5);
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
	if(window.EFX) EFX.charge(en.x + en.w / 2, en.y + en.h / 2, forgeKitEl(en), Math.max(40, en.w * 1.3), 8, 16);
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
	efxTelegraph(aim.x - 56, aim.y - 40, 112, 80, 22, 'rgba(255,170,60,0.4)', 'rect', '');
	beginForgeKit(en, 'assemblyStrike', { busy: false });
	setTimeout(function(){ if(en.forgeKit && en.forgeKit.kind === 'assemblyStrike') forgeEnd(en); }, 240);
}

/* ---------- FORGE DRONE ---------- */
function castDroneWeldingBeam(en){
	const aim = kitLead(en, 8);
	const dir = aim.x >= en.x + en.w / 2 ? 1 : -1;
	// the beam's foot sweeps along the floor from in front of the drone, through the player, a little past
	const x0 = aim.x - dir * 140, x1 = aim.x + dir * 70;
	beginForgeKit(en, 'weldingBeam', { busy: true, x0, x1, fy: kitFloor(aim.x, aim.y), hitCd: 0 });
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
	efxTelegraph(x - 64, y - 24, 128, 28, 18, 'rgba(255,80,20,0.45)', 'rect', '');
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
	const aim = kitAim(en);
	beginForgeKit(en, 'huntingCircle', { busy: true, dang: Math.atan2((en.y + en.h / 2) - aim.y, (en.x + en.w / 2) - aim.x), y0: en.y });
}
function castWolfThornPounce(en){
	const aim = kitLead(en, 8);
	const dir = aim.x >= en.x + en.w / 2 ? 1 : -1;
	beginForgeKit(en, 'thornPounce', { busy: true, dir, x0: en.x, y0: en.y, tx: aim.x - en.w / 2, landed: false });
}
function castWolfPackEcho(en){
	const aim = kitAim(en);
	const dir = aim.x >= en.x + en.w / 2 ? 1 : -1;
	const dist = Math.min(320, Math.abs(aim.x - (en.x + en.w / 2)) + 70);
	beginForgeKit(en, 'packEcho', { busy: true, dir, x0: en.x, dist, echoes: [{ d: 0, delay: 0, hit: false }, { d: 0, delay: 7, hit: false }], dashed: false, hit: false });
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
	if(type === 'ironSentinel') tickIronSentinel(en, kit);
	else if(type === 'forgeDrone') tickDrone(en, kit);
	else if(type === 'slagBrute') tickBrute(en, kit);
	else if(type === 'thornWolf') tickWolf(en, kit);
	else forgeEnd(en);
	return !!en._forgeKitBusy;
}

function tickIronSentinel(en, kit){
	const aim = kitAim(en);
	if(kit.kind === 'shieldMarch'){
		en.x += kit.dir * (kit.t < 12 ? 1 : 4.2);
		if(window.EFX && kit.t % 3 === 0) EFX.smoke(en.x + en.w / 2 - kit.dir * en.w * 0.3, en.y + en.h - 4, 1, { size: 8, c: '#4a4440', a: 0.4 });
		const sx = en.x + (kit.dir > 0 ? en.w : -22);
		if(!kitFriendly(en) && rectRect({ x: sx, y: en.y, w: 26, h: en.h }, player)){
			if(!kit.bashed && kit.t > 18){
				kit.bashed = true;
				forgeHit(en, player.x + player.w / 2, player.y + player.h / 2, 36, kitDmg(34), ['stun', 'horizontalLaunch']);
				player.x += kit.dir * 28;
				if(window.EFX){ EFX.burst(player.x + player.w / 2, player.y + player.h / 2, 'metal', 1.6); EFX.sparks('metal', en.x + (kit.dir > 0 ? en.w : 0), en.y + en.h / 2, 10, { ang: kit.dir > 0 ? 0 : Math.PI, spread: 1.4, speed: 8 }); }
				kitShake(6, 10);
			}
		}
		if(kit.t > 56){ en._ironFrontGuard = false; forgeEnd(en); }
	} else if(kit.kind === 'counterSpark'){
		if(kit.t > 50){
			// nobody struck it: the stored charge vents anyway, smaller
			if(en._ironCounter){
				forgeHit(en, en.x + en.w / 2, en.y + en.h / 2, 60, kitDmg(18), ['stun']);
				if(window.EFX){ EFX.burst(en.x + en.w / 2, en.y + en.h / 2, 'lightning', 1.3); EFX.ring(en.x + en.w / 2, en.y + en.h / 2, 10, 80, 'lightning', 14, { width: 4 }); }
			}
			en._ironCounter = false; forgeEnd(en);
		}
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
	if(kit.kind === 'weldingBeam'){
		const u = Math.max(0, Math.min(1, (kit.t - 14) / 40));
		kit.bx = kit.x0 + (kit.x1 - kit.x0) * u;
		kit.by = kitFloor(kit.bx, kit.fy - 40);
		if(kit.hitCd > 0) kit.hitCd--;
		if(kit.t > 14 && kit.t < 56){
			const ox = en.x + en.w / 2, oy = en.y + en.h * 0.6;
			// the beam hurts along its length near the foot, and at the foot itself
			if(kit.hitCd <= 0 && (forgeHit(en, kit.bx, kit.by - 18, 22, kitDmg(16), ['burn']) || (segHitsPlayer(ox, oy, kit.bx, kit.by) && forgeHit(en, player.x + player.w / 2, player.y + player.h / 2, 30, kitDmg(10), ['burn'])))) kit.hitCd = 18;
			if(window.EFX){ if(kit.t % 2 === 0) EFX.sparks('metal', kit.bx, kit.by - 4, 3, { ang: -Math.PI / 2, spread: 2.2, speed: 6 }); if(kit.t % 4 === 0) EFX.decal(kit.bx, kit.by + 1, 14, 'metal', 140, { color: '#2a2018', glow: 0.8 }); }
		}
		if(kit.t === 56){
			forgeFX({ kind: 'barrier', en, x: kit.bx, y: kit.by, h: 16, maxH: atkS(96), age: 0, max: 220 });
			if(window.EFX){ EFX.burst(kit.bx, kit.by - 20, 'metal', 1.4); }
		}
		if(kit.t > 62) forgeEnd(en);
	} else if(kit.kind === 'overheat'){
		kit.heat = Math.min(1, kit.t / 44);
		if(en.dead){ en._droneOverheat = false; forgeEnd(en); return; }
		// the glowing drone homes in on the player before it vents
		if(kit.t < 40){
			const ax = aim.x - (en.x + en.w / 2), ay = (aim.y - 30) - (en.y + en.h / 2), ad = Math.hypot(ax, ay) || 1;
			const sp = Math.min(ad, 3 + kit.t * 0.12);
			en.x += ax / ad * sp; en.y += ay / ad * sp;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
		}
		if(window.EFX && kit.t % 2 === 0) EFX.sparks('metal', en.x + en.w / 2, en.y + en.h / 2, 1 + (kit.heat * 3 | 0), { speed: 3 + kit.heat * 4 });
		if(kit.t === 46){
			forgeHit(en, en.x + en.w / 2, en.y + en.h / 2, 92, kitDmg(42), ['burn', 'stun']);
			const ring = forgeSpawn(en, en.x + en.w / 2, en.y + en.h / 2, 0, 0, {
				color: '#ff5511', color2: '#ffe080', power: 34, width: 22, height: 22,
				shape: 'ring', maxAge: 28, aoe: true, aoeRadius: 120, aoeMax: 26, _forgeStyle: 'spark'
			});
			if(ring) ring._forgeStyle = 'spark';
			kitShake(8, 14);
			if(window.EFX){ EFX.burst(en.x + en.w / 2, en.y + en.h / 2, 'metal', 2.4); EFX.smoke(en.x + en.w / 2, en.y + en.h / 2, 5, { size: 16, c: '#2a2420', a: 0.55, spread: 3 }); }
			en._droneOverheat = false;
		}
		if(kit.t > 56) forgeEnd(en);
	} else if(kit.kind === 'droneDive'){
		if(kit.hitCd > 0) kit.hitCd--;
		en.x += Math.cos(kit.ang) * 12.2;
		en.y += Math.sin(kit.ang) * 12.2;
		if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
		if(kit.hitCd <= 0 && forgeHit(en, en.x + en.w / 2, en.y + en.h / 2, 32, kitDmg(26), ['burn'])) kit.hitCd = 8;
		if(window.EFX) EFX.sparks('metal', en.x + en.w / 2, en.y + en.h / 2, 2, { ang: kit.ang + Math.PI, spread: 0.7, speed: 5 });
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

function wolfSlash(en, dir, big){
	if(!window.EFX) return;
	const cx = en.x + en.w / 2 + dir * en.w * 0.4, cy = en.y + en.h * 0.45;
	EFX.slash(cx, cy, dir > 0 ? 0 : Math.PI, big ? 44 : 34, 2.4, 'nature', { dir: dir > 0 ? 1 : -1, width: big ? 16 : 12, life: 12 });
}
function tickWolf(en, kit){
	const aim = kitAim(en);
	const ecx = () => en.x + en.w / 2;
	if(kit.kind === 'huntingCircle'){
		// circle the prey at a distance, leaving thorns, then lunge straight through it
		if(kit.t < 36){
			kit.dang += 0.11;
			const tx = aim.x + Math.cos(kit.dang) * 170 - en.w / 2;
			en.x += (tx - en.x) * 0.16;
			if(kit.t % 4 === 0) forgeFX({ kind: 'thorntrail', x: ecx(), y: en.y + en.h - 4, age: 0, max: 90, en });
			en.facing = aim.x >= ecx() ? 1 : -1;
		}
		if(kit.t === 30) kit.lock = { x: aim.x, dir: aim.x >= ecx() ? 1 : -1 };
		if(kit.t >= 38 && kit.lock){
			en.x += kit.lock.dir * 15;
			en.facing = kit.lock.dir;
			if(!kit.hit && forgeHit(en, ecx() + kit.lock.dir * en.w * 0.3, en.y + en.h / 2, 30, kitDmg(30), ['horizontalLaunch'])){ kit.hit = true; wolfSlash(en, kit.lock.dir, true); }
			if(window.EFX && kit.t % 2 === 0) EFX.emit('nature', ecx(), en.y + en.h * 0.6, 2, { speed: 1 });
			if((kit.lock.dir > 0 ? ecx() > kit.lock.x + 90 : ecx() < kit.lock.x - 90) || kit.t > 60 || kitBlocked(ecx() + kit.lock.dir * (en.w * 0.6 + 6), en.y + en.h / 2)) forgeEnd(en);
		}
		if(kit.t > 64) forgeEnd(en);
	} else if(kit.kind === 'thornPounce'){
		// crouch, then a leaping pounce that lands in a burst of thorns
		if(kit.t > 10 && kit.t <= 28){
			const u = (kit.t - 10) / 18;
			en.x = kit.x0 + (kit.tx - kit.x0) * u;
			en.y = kit.y0 - Math.sin(u * Math.PI) * 80;
			if(!kit.hit && forgeHit(en, ecx(), en.y + en.h / 2, 28, kitDmg(28), [])){ kit.hit = true; wolfSlash(en, kit.dir, false); }
		}
		if(kit.t === 28 && !kit.landed){
			kit.landed = true; en.y = kit.y0;
			const lx = ecx(), ly = en.y + en.h;
			if(!kit.hit) forgeHit(en, lx, ly - 18, 40, kitDmg(22), []);
			for(let k = 0; k < 7; k++){
				const a = -Math.PI / 2 + (k - 3) * 0.32;
				forgeSpawn(en, lx, ly - 10, Math.cos(a) * 7.4, Math.sin(a) * 6.2, {
					color: '#6a8a3a', color2: '#e8ff88', power: 18, width: 30, height: 18,
					shape: 'spike', maxAge: 55, gravity: 0.2, _forgeStyle: 'thorn'
				});
			}
			if(window.EFX){ EFX.burst(lx, ly - 12, 'nature', 1.4); EFX.groundWave(lx, ly, 90, 'nature'); EFX.debris('earth', lx, ly - 4, 5, { speed: 5, floor: ly }); }
			kitShake(5, 8);
		}
		if(kit.t > 36) forgeEnd(en);
	} else if(kit.kind === 'packEcho'){
		// two spectral pack-mates dash the lane first, then the wolf follows
		const dir = kit.dir;
		for(let i = 0; i < kit.echoes.length; i++){
			const E = kit.echoes[i];
			if(kit.t > 8 + E.delay && E.d < kit.dist){
				E.d = Math.min(kit.dist, E.d + 17);
				const ex = kit.x0 + en.w / 2 + dir * E.d;
				if(!E.hit && forgeHit(en, ex, en.y + en.h / 2, 26, kitDmg(16), [])) E.hit = true;
				if(window.EFX && kit.t % 2 === 0) EFX.emit('nature', ex, en.y + en.h * 0.6, 1, { speed: 1 });
			}
		}
		if(kit.t > 22){
			const target = kit.x0 + dir * kit.dist;
			if((dir > 0 ? en.x < target : en.x > target) && !kitBlocked(ecx() + dir * (en.w * 0.6 + 6), en.y + en.h / 2)){
				en.x += dir * 16;
				if(!kit.hit && forgeHit(en, ecx() + dir * en.w * 0.3, en.y + en.h / 2, 30, kitDmg(30), [])){ kit.hit = true; wolfSlash(en, dir, true); }
			}
		}
		if(kit.t > 48) forgeEnd(en);
	} else if(kit.kind === 'predatoryFeint'){
		if(kit.phase === 'fake'){
			en.x += kit.dir * 6.5;
			if(kit.t === 8){ kit.phase = 'slide'; kit.dir *= -1; }
		} else if(kit.phase === 'slide'){
			en.x += kit.dir * 5;
			if(kit.t === 16){ kit.phase = 'real'; kit.dir *= -1; kit.lockX = aim.x; if(window.EFX) EFX.alertFX(ecx(), en.y - 14, 'nature', 16); }
		} else {
			// the real lunge — fast and long
			if(kit.t > 20){
				en.x += kit.dir * 17;
				if(!kit.hit && forgeHit(en, ecx() + kit.dir * en.w * 0.3, en.y + en.h / 2, 32, kitDmg(36), ['horizontalLaunch'])){ kit.hit = true; wolfSlash(en, kit.dir, true); }
				if((kit.dir > 0 ? ecx() > kit.lockX + 80 : ecx() < kit.lockX - 80) || kitBlocked(ecx() + kit.dir * (en.w * 0.6 + 6), en.y + en.h / 2)) forgeEnd(en);
			}
		}
		if(kit.t > 44) forgeEnd(en);
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
			const near = Math.hypot(player.x + player.w / 2 - fx.x, player.y + player.h - fx.y) < 70;
			if(near && !fx.hot){ fx.hot = true; if(window.EFX) EFX.flash(fx.x, fx.y, 22, 'lightning', 8); }
			if(!fx.hot && fx.age === 40) fx.hot = true;
			if(fx.hot){
				for(let j = 0; j < forgeWorldFX.length; j++){
					const o = forgeWorldFX[j];
					if(o.kind !== 'mine' || o === fx) continue;
					if(Math.hypot(o.x - fx.x, o.y - fx.y) < 110){
						o.hot = true;
						if(fx.age % 10 === 0 && segHitsPlayer(fx.x, fx.y - 6, o.x, o.y - 6)) forgeHit(fx.en, player.x + player.w / 2, player.y + player.h / 2, 20, kitDmg(20), []);
					}
				}
			}
		} else if(fx.kind === 'hammer' && !fx.slammed && fx.age === 16){
			fx.slammed = true;
			forgeHit(fx.en, fx.x, fx.y - 24, 64, kitDmg(40), ['burn', 'horizontalLaunch']);
			forgeFX({ kind: 'crater', en: fx.en, x: fx.x, y: fx.y, r: atkS(62), age: 0, max: 180 });
			if(window.EFX){ EFX.burst(fx.x, fx.y - 20, 'magma', 2.2); EFX.groundWave(fx.x, fx.y, 150, 'magma', 26); EFX.debris('magma', fx.x, fx.y - 6, 10, { speed: 8, floor: fx.y, spread: 2 }); EFX.smoke(fx.x, fx.y - 8, 4, { size: 16, c: '#2a1a12', a: 0.55, spread: 3 }); }
			kitShake(8, 14);
		} else if(fx.kind === 'crater'){
			if(circRect(fx.x, fx.y, fx.r * 0.6, player.x, player.y, player.w, player.h)){
				kitSlowSet(0.4);
				if(fx.age % 12 === 0) forgeHit(fx.en, fx.x, fx.y, 28, kitDmg(16), ['burn']);
			}
		} else if(fx.kind === 'chunk' && !fx.erupted && fx.age === 36){
			fx.erupted = true;
			if(window.EFX){ EFX.burst(fx.x, fx.y - 10, 'magma', 1.2); EFX.debris('magma', fx.x, fx.y - 4, 4, { speed: 6, floor: fx.y }); }
			forgeSpawn(fx.en, fx.x, fx.y, 0, -10.2, {
				color: '#ee5520', color2: '#ffe080', power: 32, width: 44, height: 58,
				shape: 'meteor', maxAge: 55, trail: 'flame', effects: ['burn'], _forgeStyle: 'slag'
			});
		} else if(fx.kind === 'collapse'){
			if(fx.age % 5 === 0 && fx.age < 24 && fx.en){
				forgeFX({ kind: 'slagblock', x: fx.en.x + Math.random() * fx.en.w, y: kitFloor(fx.en.x, fx.en.y) - 4, w: atkS(36), h: atkS(24), age: 0, max: 220 });
			}
			if(fx.age < 26 && fx.en && !fx.en.dead){
				// lumber forward, shedding molten blocks
				const want = fx.tx != null ? fx.tx : (fx.tx = kitAim(fx.en).x);
				const dx = want - (fx.en.x + fx.en.w / 2);
				if(Math.abs(dx) > 30) fx.en.x += Math.sign(dx) * Math.min(Math.abs(dx), 9);
			}
			if(fx.age === 26 && !fx.slammed && fx.en){
				fx.slammed = true;
				const cx = fx.en.x + fx.en.w / 2, fy = kitFloor(cx, fx.en.y + fx.en.h - 20);
				forgeHit(fx.en, cx, fx.en.y + fx.en.h / 2, 70, kitDmg(40), ['burn', 'horizontalLaunch']);
				fx.wave = { x: cx, y: fy, r: 20, hit: false };
				if(window.EFX){ EFX.burst(cx, fy - 20, 'magma', 2.4); EFX.groundWave(cx, fy, 220, 'magma', 30); EFX.debris('magma', cx, fy - 6, 12, { speed: 9, floor: fy, spread: 2.2 }); }
				kitShake(9, 14);
			}
			if(fx.wave){
				const W = fx.wave;
				W.r += 9;
				if(!W.hit && W.r < 260 && player.y + player.h > W.y - 26){
					const px = player.x + player.w / 2;
					if(Math.abs(Math.abs(px - W.x) - W.r) < 22) W.hit = forgeHit(fx.en, px, W.y - 14, 18, kitDmg(22), ['burn']);
				}
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
				if(window.EFX){ EFX.burst(fx.hx, fx.hy, 'metal', 2); EFX.sparks('metal', fx.hx, fx.hy, 12, { speed: 9 }); }
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
			if(window.EFX){ EFX.burst(ox, oy, 'lightning', 1.6); EFX.ring(ox, oy, 20, 140, 'lightning', 18, { width: 4 }); }
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
	// sample the segment against the player's box (with a little padding)
	const pad = 8;
	for(let k = 0; k <= 8; k++){
		const t = k / 8, x = x1 + (x2 - x1) * t, y = y1 + (y2 - y1) * t;
		if(x > player.x - pad && x < player.x + player.w + pad && y > player.y - pad && y < player.y + player.h + pad) return true;
	}
	return false;
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
		if(window.EFX){ EFX.burst(en.x + en.w / 2, en.y + en.h / 2, 'lightning', 2); EFX.ring(en.x + en.w / 2, en.y + en.h / 2, 10, 100, 'lightning', 16, { width: 5 }); for(let k = 0; k < 5; k++){ const a = k / 5 * Math.PI * 2; EFX.add({ k: 'spark', x: en.x + en.w / 2, y: en.y + en.h / 2, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, drag: 0.9, size: 2, len: 3, c: '#ffffff', c2: '#c8ecff', max: 14 }); } }
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

/* ---------- drawing (EFX) ---------- */
function drawForgeKitProj(p){
	if(!window.EFX) return;
	const style = p._forgeStyle || 'spark', r = Math.max(p.width, p.height) * 0.42;
	if(style === 'steel'){
		// a spinning steel shard with a hot edge
		const ang = Math.atan2(p.vy || 0, p.vx || 1), sx = p.x - camera.x, sy = p.y - camera.y;
		const h = EFX.track(p, 7); EFX.trail(h, r * 0.4, 'metal', { alpha: 0.35 });
		ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang);
		const g = ctx.createLinearGradient(-r, -r, r, r); g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#c8d0dc'); g.addColorStop(1, '#5a6472');
		ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(r * 1.2, 0); ctx.lineTo(-r * 0.5, -r * 0.55); ctx.lineTo(-r * 0.2, 0); ctx.lineTo(-r * 0.5, r * 0.55); ctx.closePath(); ctx.fill();
		ctx.strokeStyle = 'rgba(255,190,80,0.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(r * 1.2, 0); ctx.lineTo(-r * 0.5, -r * 0.55); ctx.stroke();
		ctx.globalCompositeOperation = 'lighter'; EFX.glowS(r * 0.9, 0, r * 0.6, '#ffd468', 0.7, true);
		ctx.restore();
	} else if(style === 'slag'){
		EFX.bolt(p, p.x, p.y, r * 0.85, 'magma', { trailLen: 8 });
	} else if(style === 'thorn'){
		EFX.bolt(p, p.x, p.y, r * 0.75, 'nature', { trailLen: 5, trailAlpha: 0.3 });
	} else {
		EFX.bolt(p, p.x, p.y, r * 0.8, 'metal');
	}
}

function forgeDrawPillar(x, y, h, w, a, hot){
	// a riveted steel barrier, glowing where it was welded
	const sx = x - camera.x, sy = y - camera.y;
	ctx.save(); ctx.globalAlpha = a;
	const g = ctx.createLinearGradient(sx - w / 2, 0, sx + w / 2, 0);
	g.addColorStop(0, '#3a404a'); g.addColorStop(0.35, '#c8d0dc'); g.addColorStop(0.55, '#eef2f8'); g.addColorStop(1, '#4a525e');
	ctx.fillStyle = g; ctx.fillRect(sx - w / 2, sy - h, w, h);
	ctx.fillStyle = '#2a2e36';
	for(let yy = sy - h + 8; yy < sy - 4; yy += 16){ ctx.beginPath(); ctx.arc(sx - w * 0.3, yy, 1.8, 0, Math.PI * 2); ctx.arc(sx + w * 0.3, yy, 1.8, 0, Math.PI * 2); ctx.fill(); }
	ctx.globalCompositeOperation = 'lighter';
	EFX.glowS(sx, sy - 4, w * 1.2, '#ff7a20', 0.5 * hot);
	ctx.fillStyle = 'rgba(255,200,90,' + (0.7 * hot) + ')'; ctx.fillRect(sx - w / 2, sy - 6, w, 4);
	ctx.restore();
}

function drawForgeKitWorld(){
	if(!window.EFX) return;
	EFX.bind();
	for(let i = 0; i < forgeWorldFX.length; i++){
		const fx = forgeWorldFX[i];
		const u = fx.max ? fx.age / fx.max : 0, fade = u > 0.85 ? (1 - u) / 0.15 : 1;
		const x = fx.x - camera.x, y = fx.y - camera.y;
		if(fx.kind === 'barrier'){
			forgeDrawPillar(fx.x, fx.y + 2, fx.h, 24, fade, Math.max(0, 1 - fx.age / 90));
		} else if(fx.kind === 'mine'){
			// a magnetic spark mine; hot mines arc lightning to their neighbours
			const pulse = 0.5 + 0.5 * Math.sin(fx.age * (fx.hot ? 0.6 : 0.15));
			ctx.save();
			ctx.fillStyle = '#3a3a40'; ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
			ctx.strokeStyle = '#8a8a96'; ctx.lineWidth = 2; ctx.stroke();
			ctx.globalCompositeOperation = 'lighter';
			EFX.glowS(x, y, fx.hot ? 26 : 12, fx.hot ? '#5a8cff' : '#ffd468', 0.4 + 0.4 * pulse);
			EFX.glowS(x, y, 5, '#ffffff', 0.5 + 0.5 * pulse, true);
			ctx.restore();
			if(fx.hot){
				for(let j = 0; j < forgeWorldFX.length; j++){
					const o = forgeWorldFX[j];
					if(o.kind !== 'mine' || o === fx || !o.hot || j < i) continue;
					if(Math.hypot(o.x - fx.x, o.y - fx.y) < 110) EFX.lightning(fx.x, fx.y - 6, o.x, o.y - 6, 'lightning', { width: 2, jag: 16, seed: (fx.age / 3 | 0) + i * 7, branches: false, alpha: fade });
				}
			}
		} else if(fx.kind === 'crater'){
			const a = (1 - u) * fade;
			ctx.save(); ctx.globalAlpha = 0.8 * a; ctx.fillStyle = '#2a0c04';
			ctx.beginPath(); ctx.ellipse(x, y + 2, fx.r, fx.r * 0.24, 0, 0, Math.PI * 2); ctx.fill();
			ctx.restore();
			EFX.flameStrip(fx.x - fx.r * 0.8, fx.x + fx.r * 0.8, fx.y + 2, 'magma', 0.8 * a, { height: 16, step: 14, emit: fx.age % 3 === 0 });
		} else if(fx.kind === 'chunk'){
			if(!fx.erupted){
				// glowing slag lumps that bulge before they burst
				const k = fx.age / 36;
				EFX.warnCircle(fx.x, fx.y + 4, 24, k, 'magma', { flat: 0.35 });
				ctx.save(); ctx.translate(x, y - 6); ctx.scale(1 + k * 0.3, 1 + k * 0.3);
				ctx.drawImage(EFX.rockSprite('magma', i & 7), -14, -14, 28, 28);
				ctx.globalCompositeOperation = 'lighter'; EFX.glowS(0, 0, 18, '#ff6a12', 0.3 + 0.5 * k);
				ctx.restore();
			}
		} else if(fx.kind === 'slagblock'){
			const sx = x, sy = y + 2, w = fx.w, h = fx.h, a = fade;
			ctx.save(); ctx.globalAlpha = a;
			const g = ctx.createLinearGradient(0, sy - h, 0, sy);
			g.addColorStop(0, '#5a2a14'); g.addColorStop(1, '#1a0a04');
			ctx.fillStyle = g; ctx.fillRect(sx - w / 2, sy - h, w, h);
			ctx.globalCompositeOperation = 'lighter';
			ctx.strokeStyle = 'rgba(255,120,30,' + (0.8 * Math.max(0.2, 1 - u * 1.5)) + ')'; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.moveTo(sx - w * 0.4, sy - h * 0.2); ctx.lineTo(sx, sy - h * 0.7); ctx.lineTo(sx + w * 0.3, sy - h * 0.3); ctx.stroke();
			ctx.restore();
		} else if(fx.kind === 'thorntrail'){
			const a = 1 - u;
			ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = '#4f8a26'; ctx.strokeStyle = '#d8ff9a'; ctx.lineWidth = 1;
			for(let k = 0; k < 3; k++){
				const an = k * 2.1 + fx.x * 0.1;
				ctx.beginPath(); ctx.moveTo(x + Math.cos(an) * 7, y + Math.sin(an) * 7); ctx.lineTo(x + Math.cos(an + 2.6) * 3, y + Math.sin(an + 2.6) * 3); ctx.lineTo(x + Math.cos(an - 2.6) * 3, y + Math.sin(an - 2.6) * 3); ctx.closePath(); ctx.fill(); ctx.stroke();
			}
			ctx.restore();
		} else if(fx.kind === 'assembly' && fx.bits){
			if(!fx.punched) EFX.warnCircle(fx.hx, fx.hy, 56, fx.age / 20, 'metal');
			for(let b = 0; b < fx.bits.length; b++){
				const B = fx.bits[b], bx = B.x - camera.x, by = B.y - camera.y;
				ctx.save(); ctx.translate(bx, by); ctx.rotate(fx.age * 0.3 + b);
				const g = ctx.createLinearGradient(-8, -8, 8, 8); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#5a6472');
				ctx.fillStyle = g; ctx.fillRect(-7, -7, 14, 14);
				ctx.strokeStyle = 'rgba(255,190,80,0.8)'; ctx.lineWidth = 1.2; ctx.strokeRect(-7, -7, 14, 14);
				ctx.restore();
				if(!fx.punched && fx.age % 2 === 0) EFX.sparks('metal', B.x, B.y, 1, { speed: 3 });
			}
		} else if(fx.kind === 'hammer' && !fx.slammed){
			// a giant slag hammer falls from above onto the marked spot
			const k = fx.age / 16;
			EFX.warnCircle(fx.x, fx.y, 64, k, 'magma', { flat: 0.3 });
			const hy = fx.y - 30 - (1 - k * k) * 320;
			ctx.save(); ctx.translate(x, hy - camera.y);
			ctx.fillStyle = '#3a2a22'; ctx.fillRect(-4, -90, 8, 70);
			const g = ctx.createLinearGradient(-30, 0, 30, 0); g.addColorStop(0, '#2a1a12'); g.addColorStop(0.5, '#6a3a24'); g.addColorStop(1, '#2a1a12');
			ctx.fillStyle = g; ctx.fillRect(-30, -24, 60, 30);
			ctx.globalCompositeOperation = 'lighter'; EFX.glowS(0, 6, 30, '#ff6a12', 0.6 * k);
			ctx.fillStyle = 'rgba(255,140,40,0.8)'; ctx.fillRect(-30, 2, 60, 4);
			ctx.restore();
		} else if(fx.kind === 'collapse' && fx.wave){
			const W = fx.wave;
			if(W.r < 260){
				const a = 1 - W.r / 260;
				EFX.flameStrip(W.x - W.r - 16, W.x - W.r + 16, W.y, 'magma', a, { height: 30, step: 10, emit: false });
				EFX.flameStrip(W.x + W.r - 16, W.x + W.r + 16, W.y, 'magma', a, { height: 30, step: 10, emit: false });
			}
		} else if(fx.kind === 'magnetburst' && !fx.fired && fx.en){
			EFX.charge(fx.en.x + fx.en.w / 2, fx.en.y + fx.en.h * 0.4, 'lightning', 70, 2, 14);
		}
	}
	if(typeof enemies !== 'undefined') for(let i = 0; i < enemies.length; i++) drawForgeEnemyFX(enemies[i]);
	if(typeof playerMinions !== 'undefined') for(let i = 0; i < playerMinions.length; i++) drawForgeEnemyFX(playerMinions[i]);
}

function drawForgeEnemyFX(en){
	if(!en || en.dead || !en.forgeKit || !window.EFX) return;
	const kit = en.forgeKit, ecx = en.x + en.w / 2, ecy = en.y + en.h / 2;
	if(kit.kind === 'shieldMarch'){
		// a tower shield held out front
		const W = 18, sx = en.x + (kit.dir > 0 ? en.w - 2 : -W + 2) - camera.x, sy = en.y - 4 - camera.y, H = en.h + 6;
		ctx.save();
		const g = ctx.createLinearGradient(sx, 0, sx + W, 0); g.addColorStop(0, '#5a6472'); g.addColorStop(0.5, '#e8eef6'); g.addColorStop(1, '#5a6472');
		ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx, sy + 4); ctx.lineTo(sx + W, sy); ctx.lineTo(sx + W, sy + H - 6); ctx.lineTo(sx + W / 2, sy + H); ctx.lineTo(sx, sy + H - 6); ctx.closePath(); ctx.fill();
		ctx.strokeStyle = '#ffd468'; ctx.lineWidth = 1.5; ctx.stroke();
		ctx.restore();
	}
	if(kit.kind === 'counterSpark' && en._ironCounter){
		// crackling static stored in the armour
		if(kit.t % 3 === 0){ const a = Math.random() * Math.PI * 2; EFX.lightning(ecx, ecy, ecx + Math.cos(a) * en.w * 0.8, ecy + Math.sin(a) * en.h * 0.6, 'lightning', { width: 1.5, branches: false, seed: kit.t }); }
		ctx.save(); ctx.globalCompositeOperation = 'lighter'; EFX.glow(ecx, ecy, en.w, '#5a8cff', 0.25 + 0.15 * Math.sin(kit.t * 0.5)); ctx.restore();
	}
	if(kit.kind === 'magneticPull'){
		// field lines bending toward the sentinel
		ctx.save(); ctx.strokeStyle = 'rgba(140,190,255,0.5)'; ctx.lineWidth = 1.5;
		for(let k = 0; k < 3; k++){ const rr = 50 + ((kit.t * 4 + k * 40) % 120); ctx.globalAlpha = 1 - rr / 170; ctx.beginPath(); ctx.ellipse(ecx - camera.x, ecy - camera.y, rr, rr * 0.6, 0, 0, Math.PI * 2); ctx.stroke(); }
		ctx.restore();
	}
	if(kit.kind === 'weldingBeam' && kit.bx != null){
		const ox = ecx, oy = en.y + en.h * 0.6;
		if(kit.t <= 14){ EFX.warnLine(kit.x0, kit.fy - 8, kit.x1, kit.fy - 8, 20, kit.t / 14, 'metal'); EFX.charge(ox, oy, 'metal', 24, 1, 8); }
		else if(kit.t < 56){ EFX.beam(ox, oy, kit.bx, kit.by - 2, 4, 'metal', { speed: 10 }); ctx.save(); ctx.globalCompositeOperation = 'lighter'; EFX.glow(kit.bx, kit.by - 4, 26, '#ffffff', 0.7, true); ctx.restore(); }
	}
	if(kit.kind === 'overheat'){
		const k = kit.heat;
		ctx.save(); ctx.globalCompositeOperation = 'lighter';
		EFX.glow(ecx, ecy, 20 + k * 40, '#ff4a0a', 0.3 + k * 0.5);
		EFX.glow(ecx, ecy, 10 + k * 10, '#fff4c8', 0.4 + k * 0.6 * (0.5 + 0.5 * Math.sin(kit.t * (0.3 + k))), true);
		ctx.restore();
		if(kit.t > 30) EFX.warnCircle(ecx, ecy, atkS(92), (kit.t - 30) / 16, 'fire');
	}
	if(kit.kind === 'furnaceHeart'){
		const k = kit.grow, cy = en.y + en.h * 0.45;
		ctx.save(); ctx.globalCompositeOperation = 'lighter';
		EFX.glow(ecx, cy, 26 + k * 30, '#ff7a12', 0.5 + 0.3 * k);
		EFX.glow(ecx, cy, 10 + k * 8, '#fff0a0', 0.9, true);
		ctx.restore();
		if(kit.t % 3 === 0) EFX.charge(ecx, cy, 'magma', 120, 1, 20);
	}
	if(kit.kind === 'foundryCollapse' && kit.t < 26){
		if(kit.t % 3 === 0) EFX.debris('magma', ecx, en.y + en.h * 0.3, 1, { speed: 3 });
	}
	if(kit.kind === 'huntingCircle' && kit.lock && kit.t < 38){
		EFX.warnLine(ecx, ecy, kit.lock.x + kit.lock.dir * 90, ecy, 26, (kit.t - 30) / 8, 'nature');
	}
	if(kit.kind === 'thornPounce' && kit.t <= 10){
		EFX.warnCircle(kit.tx + en.w / 2, kit.y0 + en.h, 40, kit.t / 10, 'nature', { flat: 0.3 });
	}
	if(kit.kind === 'packEcho'){
		for(let i = 0; i < kit.echoes.length; i++){
			const E = kit.echoes[i];
			if(E.d <= 0 || E.d >= kit.dist) continue;
			EFX.ghost(kit.x0 + en.w / 2 + kit.dir * E.d, ecy, en.w, en.h, 'nature', 0.75, kit.t + i * 9);
		}
		if(kit.t < 10) EFX.warnLine(ecx, ecy, ecx + kit.dir * kit.dist, ecy, 24, kit.t / 10, 'nature');
	}
	if(kit.kind === 'predatoryFeint' && kit.phase === 'real' && kit.t <= 20){
		EFX.warnLine(ecx, ecy, kit.lockX + kit.dir * 80, ecy, 26, (kit.t - 16) / 4, 'nature');
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
