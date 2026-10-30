/* =============================================================
   Sylvaris Wildes + Corrupted Roots kit
   Spore Fungus, Moss Wraith, Willow Wisp, Glow Beetle,
   Stalactite Bat, Sky Vine, Wind Sylph,
   Dark Vine Crawler, Dark Thorn Wolf, Dark Moss Wraith.
   Threats spawn immediately and keep going if the caster dies.
   ============================================================= */

const WILDES_KIT_TYPES = {
	sporeFungus:1, mossWraith:1, willowWisp:1, glowBeetle:1, stalactiteBat:1,
	skyVine:1, windSylph:1, darkVineCrawler:1, darkThornWolf:1, darkMossWraith:1
};
const wildesWorldFX = [];
const wildesPatches = [];

function wAtkS(n){ return n * ((typeof ENEMY_ATK_SCALE === 'number') ? ENEMY_ATK_SCALE : 1.3); }
function wAim(en){ return (typeof fireKitAim === 'function') ? fireKitAim(en) : { x: player.x + player.w / 2, y: player.y + player.h / 2, vx: player.vx || 0, vy: player.vy || 0, box: player }; }
function wLead(en, frames){
	const a = wAim(en);
	const t = frames == null ? 14 : frames;
	return { x: a.x + (a.vx || 0) * t, y: a.y + (a.vy || 0) * t, vx: a.vx || 0, vy: a.vy || 0, box: a.box };
}
function wFriend(en){ return !!(en && (en.isNecroSummon || en.necroFriendly)); }
function wDmg(n){ return Math.round(n * 2.55 * ((typeof DIFF_DMG_MULT === 'number') ? DIFF_DMG_MULT : 1)); }
function wFloor(x, y){ return (typeof fireKitFloorY === 'function') ? fireKitFloorY(x, y) : ((y || 0) + 80); }
function wBlocked(x, y){ return (typeof fireKitBlocked === 'function') ? fireKitBlocked(x, y) : false; }
function wShake(a, t){ if(typeof shakeScreen === 'function') shakeScreen(a, t); }
function wSpark(x, y, n, color){
	if(window.EFX){ EFX.sparkRGB(x, y, n, color, 'nature'); return; }
	if(typeof particles === 'undefined') return;
	const c = color || { r: 140, g: 220, b: 80 };
	for(let i = 0; i < Math.min(n || 12, 22); i++){
		const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 6;
		particles.push({ x: x + (Math.random() - 0.5) * 12, y: y + (Math.random() - 0.5) * 12, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, life: 16 + Math.random() * 16, maxLife: 32, r: 2 + Math.random() * 3, color: c });
	}
}
function wSpawn(en, x, y, vx, vy, opts){
	opts = opts || {};
	opts.noZoneNerf = true;
	const p = spawnEnemyProj(x, y, vx, vy, opts);
	if(p){
		p._wildesStyle = opts._wildesStyle || 'spore';
		p._wildesEn = en;
		p._efxEl = wStyleEl(p._wildesStyle);
		if(wFriend(en)){
			if(typeof markNecroFriendlyProj === 'function') markNecroFriendlyProj(p, en);
			else p.necroFriendly = true;
		}
	}
	return p;
}
function wStyleEl(st){ return ({ wisp: 'wisp', leaf: 'nature', slash: 'wind', void: 'rot', sonic: 'sonic', rock: 'earth', spore: 'spore' })[st] || 'nature'; }
function wKitEl(en){
	const t = en && (en.necroType || en.type);
	return ({ sporeFungus: 'spore', mossWraith: 'nature', willowWisp: 'wisp', glowBeetle: 'glow', stalactiteBat: 'sonic', skyVine: 'nature', windSylph: 'wind', darkVineCrawler: 'rot', darkThornWolf: 'rot', darkMossWraith: 'rot' })[t] || 'nature';
}
function wHit(en, x, y, r, dmg, effects){
	r = wAtkS(r);
	if(wFriend(en)){
		if(typeof necroScaleKitDmg === 'function') dmg = necroScaleKitDmg(en, dmg);
		const pool = (typeof enemies !== 'undefined' ? enemies : []).concat(typeof dummies !== 'undefined' ? dummies : []);
		for(let i = 0; i < pool.length; i++){
			const t = pool[i];
			if(!t || t.dead) continue;
			if(circRect(x, y, r, t.x, t.y, t.w, t.h)){
				t.hp -= dmg; t.flash = 8;
				dmgNumbers.push({ x: t.x + t.w / 2, y: t.y - 10, text: Math.round(dmg) + '', age: 0, color: '#9ee06a' });
				return true;
			}
		}
		return false;
	}
	if(player.iFrames > 0) return false;
	if(circRect(x, y, r, player.x, player.y, player.w, player.h)){
		if(window.EFX && EFX.armed(en, x, y, r)) return false;      // fair arming (enemy-fx.js)
		damagePlayer(dmg, effects || []);
		if(window.EFX) EFX.hit(player.x + player.w / 2, player.y + player.h / 2, wKitEl(en), dmg * 0.5);
		return true;
	}
	return false;
}
function wSlow(amt){ player._kitSlow = Math.max(player._kitSlow || 0, amt); }
function wLOS(x1, y1, x2, y2){
	const d = Math.hypot(x2 - x1, y2 - y1) || 1;
	const steps = Math.max(4, Math.floor(d / 18));
	for(let i = 1; i < steps; i++){
		const t = i / steps;
		if(wBlocked(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
	}
	return true;
}
function wildesEnd(en){
	if(!en) return;
	en.wildesKit = null;
	en._wildesKitBusy = false;
	en._wildesHidden = false;
	en._wildesNoHit = false;
	en._wildesFade = 0;
	en._wildesReflect = false;
	en._wildesShell = false;
	en._wildesDark = false;
}
function beginWildes(en, kind, extra){
	en.wildesKit = Object.assign({ kind, t: 0, type: en.necroType || en.type, row: 2 }, extra || {});
	en._wildesKitBusy = extra && extra.busy === false ? false : true;
	en.attackAnimTimer = Math.max(en.attackAnimTimer || 0, 36);
	en.facing = wAim(en).x >= en.x + en.w / 2 ? 1 : -1;
	if(window.EFX) EFX.charge(en.x + en.w / 2, en.y + en.h / 2, wKitEl(en), Math.max(40, en.w * 1.3), 8, 16);
	return en.wildesKit;
}
function wFX(fx){ wildesWorldFX.push(fx); return fx; }
function wPatch(x, y, r, max, en){
	wildesPatches.push({ x, y, r: r || 28, age: 0, max: max || 240, grow: 0.18, en });
}
function wRelease(en, kind, ms){
	setTimeout(function(){ if(en.wildesKit && en.wildesKit.kind === kind) wildesEnd(en); }, ms);
}

/* ---------- SPORE FUNGUS ---------- */
function castFungusSporeCloud(en){
	const aim = wLead(en, 10);
	const ox = en.x + en.w / 2, oy = en.y - 8;
	wFX({ kind:'cloud', en, x: ox, y: oy - 30, tx: aim.x, age: 0, max: 160, phase: 'swell', drift: aim.x >= ox ? 1.1 : -1.1, rain: 0 });
	efxTelegraph(ox - 36, oy - 70, 72, 50, 18, 'rgba(180,220,80,0.4)', 'circle', '');
	wSpark(ox, oy, 14, { r: 200, g: 230, b: 90 });
	beginWildes(en, 'sporeCloud', { busy: false });
	wRelease(en, 'sporeCloud', 260);
}
function castFungusToxicBurst(en){
	const ox = en.x + en.w / 2, oy = en.y + en.h * 0.45;
	wFX({
		kind:'rings', en, x: ox, y: oy, age: 0, max: 70,
		rings: [
			{ r: 8, spd: 7.6, gaps: 0, reverse: 0 },
			{ r: 8, spd: 4.4, gaps: 1, gapA: 0.35, gapW: 0.55 },
			{ r: 8, spd: 2.6, gaps: 0, reverse: 0 }
		]
	});
	efxTelegraph(ox - 40, oy - 40, 80, 80, 14, 'rgba(160,200,50,0.45)', 'circle', '');
	wShake(6, 10);
	beginWildes(en, 'toxicBurst', { busy: false });
	wRelease(en, 'toxicBurst', 240);
}
function castFungusFungalGrowth(en){
	const aim = wLead(en, 8);
	for(let i = 0; i < 5; i++){
		const sx = aim.x + (i - 2) * 86 + (Math.random() - 0.5) * 18;
		const sy = wFloor(sx, aim.y) - 4;
		wFX({ kind:'shroom', en, x: sx, y: sy, age: 0, max: 220, stage: 0, shot: 0 });
		efxTelegraph(sx - 14, sy - 10, 28, 16, 20, 'rgba(140,180,50,0.4)', 'rect', '');
	}
	beginWildes(en, 'fungalGrowth', { busy: false });
	wRelease(en, 'fungalGrowth', 240);
}
function castFungusMycelium(en){
	const ox = en.x + en.w / 2, oy = wFloor(en.x, en.y);
	const aim = wLead(en, 20), dir = aim.x >= ox ? 1 : -1;
	const reach = Math.max(120, Math.min(380, Math.abs(aim.x - ox) + 40));
	const lines = [];
	for(let i = 0; i < 5; i++){
		// fan of lengths around the player's spot, one tendril curling back behind the fungus
		const back = i === 4;
		const max = back ? 110 : reach * (0.55 + i * 0.2);
		lines.push({ x1: ox, y1: oy, x2: ox, y2: oy, dir: back ? -dir : dir, len: 0, max, spd: 4 + i * 0.6, live: true });
	}
	wFX({ kind:'myco', en, lines, joins: [], age: 0, max: 220, pulse: 0 });
	beginWildes(en, 'mycelium', { busy: false });
	wRelease(en, 'mycelium', 260);
}

/* ---------- MOSS WRAITH ---------- */
function castMossMossGrasp(en){
	const aim = wLead(en, 18);
	const spots = [];
	for(let i = 0; i < 4; i++) spots.push({ x: aim.x + (i - 1.5) * 70, y: wFloor(aim.x, aim.y), emerge: 22 + i * 3 });
	const rise = spots[Math.floor(Math.random() * spots.length)];
	beginWildes(en, 'mossGrasp', { busy: true, spots, riseX: rise.x, phase: 'sink' });
	en._wildesHidden = true; en._wildesNoHit = true;
}
function castMossVerdantDrain(en){
	beginWildes(en, 'verdantDrain', { busy: true, pull: 0 });
}
function castMossDouble(en){
	const copies = [];
	for(let i = 0; i < 3; i++){
		copies.push({ x: en.x + (i - 1) * 70, y: en.y, vx: en.facing * 2.4, real: false });
	}
	copies[Math.floor(Math.random() * copies.length)].real = true;
	wFX({ kind:'mossCopies', en, copies, age: 0, max: 110, struck: false });
	beginWildes(en, 'mossDouble', { busy: true });
	en._wildesHidden = true; en._wildesNoHit = true;
}
function castMossFadeStrike(en){
	beginWildes(en, 'fadeStrike', { busy: true, ang: Math.random() * Math.PI * 2, phase: 'circle', r: 92 });
	en._wildesHidden = true; en._wildesNoHit = true;
}

/* ---------- WILLOW WISP ---------- */
function castWispWispBolt(en){
	const aim = wAim(en);
	const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
	const away = Math.atan2(oy - aim.y, ox - aim.x) + (Math.random() - 0.5) * 0.5;
	const p = wSpawn(en, ox, oy, Math.cos(away) * 9.2, Math.sin(away) * 9.2, {
		color: '#d8ffe0', color2: '#88ffaa', power: 34, width: 52, height: 52,
		shape: 'circle', maxAge: 90, trail: 'spark', _wildesStyle: 'wisp'
	});
	if(p){ p._wildesHook = true; p._hookAt = 14; }
	beginWildes(en, 'wispBolt', { busy: false });
	wRelease(en, 'wispBolt', 200);
}
function castWispWispFlare(en){
	// blink beside the player, swell, then burst in a flare of light motes
	const aim = wLead(en, 8);
	if(window.EFX){ EFX.flash(en.x + en.w / 2, en.y + en.h / 2, 30, 'wisp', 8); }
	en.x = aim.x + (Math.random() < 0.5 ? -90 : 90) - en.w / 2;
	en.y = aim.y - 60;
	if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
	if(window.EFX){ EFX.flash(en.x + en.w / 2, en.y + en.h / 2, 30, 'wisp', 8); }
	beginWildes(en, 'wispFlare', { busy: true });
}
function castWispEnchantPulse(en){
	const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
	if(typeof enemyProjectiles !== 'undefined'){
		for(let i = 0; i < enemyProjectiles.length; i++){
			const p = enemyProjectiles[i];
			if(!p || Math.hypot(p.x - ox, p.y - oy) > 220) continue;
			p.vx *= -1; p.vy *= -1;
			p._wildesPull = { x: ox, y: oy };
		}
	}
	wFX({ kind:'pulse', en, x: ox, y: oy, age: 0, max: 34, r: 20, hit: false });
	beginWildes(en, 'enchantPulse', { busy: false });
	wRelease(en, 'enchantPulse', 200);
}
function castWispLightTrail(en){
	beginWildes(en, 'lightTrail', { busy: true, pts: [], phase: 'paint', ang: 0 });
}

/* ---------- GLOW BEETLE ---------- */
function castBeetleShellCharge(en){
	const aim = wAim(en);
	beginWildes(en, 'shellCharge', {
		busy: true, ang: Math.atan2(0, aim.x >= en.x ? 1 : -1), spd: 8.4, hitCd: 0, bounces: 0
	});
	en._wildesShell = true; en._wildesNoHit = true;
}
function castBeetleLuminanceBeam(en){
	const aim = wAim(en);
	const base = Math.atan2(aim.y - (en.y + en.h / 2), aim.x - (en.x + en.w / 2)), side = Math.random() < 0.5 ? 1 : -1;
	beginWildes(en, 'lumaBeam', {
		busy: true, ang: base - side * 0.75, rot: side * 0.026, hitCd: 0
	});
}
function castBeetleGlowBurst(en){
	const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
	wFX({
		kind:'rings', en, x: ox, y: oy, age: 0, max: 78, tint: 'teal',
		rings: [
			{ r: 10, spd: 6.8, gaps: 0, reverse: 0 },
			{ r: 10, spd: 4.2, gaps: 1, gapA: 1.1, gapW: 0.7 },
			{ r: 10, spd: 3.2, gaps: 0, reverseAt: 28 }
		]
	});
	wShake(5, 8);
	beginWildes(en, 'glowBurst', { busy: false });
	wRelease(en, 'glowBurst', 240);
}
function castBeetleShellReflect(en){
	beginWildes(en, 'shellReflect', { busy: true });
	en._wildesReflect = true; en._wildesShell = true;
}

/* ---------- STALACTITE BAT ---------- */
function castBatSonicShriek(en){
	const aim = wAim(en);
	const ang = Math.atan2(aim.y - (en.y + en.h / 2), aim.x - (en.x + en.w / 2));
	wFX({ kind:'shriek', en, x: en.x + en.w / 2, y: en.y + en.h / 2, ang, age: 0, max: 46, len: 40 });
	beginWildes(en, 'sonicShriek', { busy: false });
	wRelease(en, 'sonicShriek', 220);
}
function castBatDiveBomb(en){
	const aim = wLead(en, 10);
	beginWildes(en, 'diveBomb', { busy: true, phase: 'up', sx: aim.x, lock: 0 });
	en._wildesHidden = true; en._wildesNoHit = true;
}
function castBatEchoBlast(en){
	beginWildes(en, 'echoBlast', { busy: true, orbs: [], phase: 'fly', ang: 0 });
}
function castBatCeilingDrop(en){
	const aim = wLead(en, 8);
	const rocks = [];
	for(let i = 0; i < 7; i++){
		const x = aim.x + (i - 3) * 64 + (Math.random() - 0.5) * 20;
		rocks.push({ x, y: wFloor(x, aim.y), fake: Math.random() < 0.35, drop: 18 + i * 4, fallen: false });
		efxTelegraph(x - 14, wFloor(x, aim.y) - 8, 28, 12, 16 + i * 4, rocks[i].fake ? 'rgba(120,120,140,0.25)' : 'rgba(40,40,50,0.45)', 'rect', '');
	}
	beginWildes(en, 'ceilingDrop', { busy: true, rocks, phase: 'hang', hide: rocks[3] });
	en._wildesHidden = true; en._wildesNoHit = true;
}

/* ---------- SKY VINE ---------- */
function castVineVineLash(en){
	const aim = wAim(en);
	const ox = en.x + en.w / 2, oy = en.y + 12;
	const ang = Math.atan2(aim.y - oy, aim.x - ox);
	const reach = Math.min(440, Math.max(wAtkS(210), Math.hypot(aim.x - ox, aim.y - oy) + 50));
	wFX({ kind:'lash', en, x: ox, y: oy, ang: ang - 0.7, sweep: 0.06, r: reach, age: 0, max: 26, hitCd: 0, delay: 10 });
	wFX({ kind:'lash', en, x: ox, y: oy, ang: ang + 0.55, sweep: -0.05, r: reach * 0.85, age: 0, max: 30, hitCd: 0, delay: 16 });
	beginWildes(en, 'vineLash', { busy: false });
	wRelease(en, 'vineLash', 220);
}
function castVineLeafBarrage(en){
	const aim = wLead(en, 8);
	const ox = en.x + en.w / 2, oy = en.y + 8;
	const modes = ['straight', 'curve', 'spiral', 'boom'];
	for(let i = 0; i < 4; i++){
		const a = Math.atan2(aim.y - oy, aim.x - ox) + (i - 1.5) * 0.18;
		const p = wSpawn(en, ox, oy, Math.cos(a) * 8.8, Math.sin(a) * 8.8, {
			color: '#66cc44', color2: '#d8ff90', power: 30, width: 54, height: 28,
			shape: 'blade', maxAge: 90, _wildesStyle: 'leaf'
		});
		if(p){ p._wildesLeaf = modes[i]; p._leafT = 0; p._leafAng = a; }
	}
	beginWildes(en, 'leafBarrage', { busy: false });
	wRelease(en, 'leafBarrage', 220);
}
function castVineVineGrab(en){
	const aim = wLead(en, 10);
	for(let i = 0; i < 5; i++){
		const x = aim.x + (i - 2) * 54;
		wFX({ kind:'grab', en, x, y: wFloor(x, aim.y), age: 0, max: 90, snapped: false, stay: false });
		efxTelegraph(x - 12, wFloor(x, aim.y) - 28, 24, 28, 16, 'rgba(80,180,60,0.4)', 'rect', '');
	}
	beginWildes(en, 'vineGrab', { busy: false });
	wRelease(en, 'vineGrab', 240);
}
function castVineCanopyCollapse(en){
	const aim = wAim(en);
	const ox = aim.x, oy = Math.min(en.y - 40, aim.y - 260);
	const panels = [];
	for(let i = 0; i < 6; i++) panels.push({ x: ox - 210 + i * 70, y: oy, w: 66, h: 36, fall: 28 + i * 8, dropped: false });
	wFX({ kind:'canopy', en, panels, age: 0, max: 130 });
	wShake(5, 8);
	beginWildes(en, 'canopy', { busy: false });
	wRelease(en, 'canopy', 260);
}

/* ---------- WIND SYLPH ---------- */
function castSylphCycloneSpin(en){
	const aim = wAim(en);
	const dir = aim.x >= en.x ? 1 : -1;
	wFX({ kind:'cyclone', en, x: en.x + en.w / 2, y: en.y + en.h / 2, dir, age: 0, max: 110, hitCd: 0, wake: [] });
	beginWildes(en, 'cyclone', { busy: false });
	wRelease(en, 'cyclone', 260);
}
function castSylphAirSlash(en){
	const aim = wLead(en, 10);
	const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
	for(let i = 0; i < 3; i++){
		const a = Math.atan2(aim.y - oy, aim.x - ox) + (i - 1) * 0.22;
		const p = wSpawn(en, ox, oy, Math.cos(a) * 4.2, Math.sin(a) * 4.2, {
			color: '#c8e8ff', color2: '#ffffff', power: 32, width: 70, height: 26,
			shape: 'blade', maxAge: 70, _wildesStyle: 'slash'
		});
		if(p) p._wildesAccel = 1.085;
	}
	beginWildes(en, 'airSlash', { busy: false });
	wRelease(en, 'airSlash', 200);
}
function castSylphWindGust(en){
	const aim = wAim(en);
	beginWildes(en, 'windGust', { busy: true, dir: aim.x >= en.x ? 1 : -1, phase: 'push' });
}
function castSylphPressureDrop(en){
	beginWildes(en, 'pressure', { busy: true, phase: 'still' });
}

/* ---------- DARK VINE CRAWLER ---------- */
function castDarkVoidWhip(en){
	const aim = wLead(en, 8);
	const ox = en.x + en.w / 2, oy = en.y + en.h * 0.4;
	const a = Math.atan2(aim.y - oy, aim.x - ox);
	const p = wSpawn(en, ox, oy, Math.cos(a) * 13.2, Math.sin(a) * 13.2, {
		color: '#4a2058', color2: '#cc66ff', power: 36, width: 78, height: 22,
		shape: 'blade', maxAge: 46, _wildesStyle: 'void'
	});
	if(p) p._wildesCorrupt = true;
	beginWildes(en, 'voidWhip', { busy: false });
	wRelease(en, 'voidWhip', 200);
}
function castDarkRootSnare(en){
	const aim = wLead(en, 12);
	wFX({ kind:'snare', en, x: aim.x, y: wFloor(aim.x, aim.y), age: 0, max: 100, hops: 0, erupted: false });
	beginWildes(en, 'rootSnare', { busy: false });
	wRelease(en, 'rootSnare', 240);
}
function castDarkBlackBloom(en){
	const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
	for(let i = 0; i < 8; i++){
		const a = (i / 8) * Math.PI * 2;
		const p = wSpawn(en, ox, oy, Math.cos(a) * 8.6, Math.sin(a) * 8.6, {
			color: '#2a1030', color2: '#aa44cc', power: 28, width: 40, height: 40,
			shape: 'spike', maxAge: 70, _wildesStyle: 'void'
		});
		if(p) p._wildesSeekPatch = true;
	}
	wShake(6, 10);
	beginWildes(en, 'blackBloom', { busy: false });
	wRelease(en, 'blackBloom', 220);
}
function castDarkRottingTunnel(en){
	const aim = wLead(en, 14);
	beginWildes(en, 'rotTunnel', { busy: true, tx: aim.x, ty: wFloor(aim.x, aim.y), phase: 'dig', trail: [] });
	en._wildesHidden = true; en._wildesNoHit = true;
}

/* ---------- DARK THORN WOLF ---------- */
function castDarkWolfBite(en){
	const aim = wLead(en, 6);
	beginWildes(en, 'darkBite', {
		busy: true, phase: 'lunge',
		ang: Math.atan2(aim.y - (en.y + en.h / 2), aim.x - (en.x + en.w / 2)),
		cancel: Math.random() < 0.55, hit: false
	});
	en._wildesFade = 0.25;
}
function castDarkWolfShadowDash(en){
	const aim = wLead(en, 8);
	const ang = Math.atan2(aim.y - (en.y + en.h / 2), aim.x - (en.x + en.w / 2));
	wFX({ kind:'afterimage', en, x: en.x, y: en.y, w: en.w, h: en.h, ang, age: 0, max: 46, fired: false });
	beginWildes(en, 'shadowDash', { busy: true, ang, hit: false });
}
function castDarkWolfSpines(en){
	const ox = en.x + en.w / 2, oy = en.y + en.h * 0.4;
	for(let i = 0; i < 7; i++){
		const a = -1.1 + i * 0.32;
		wFX({ kind:'spine', en, x: ox + Math.cos(a) * 40, y: wFloor(ox, en.y) - 4, age: 0, max: 90, fired: false });
	}
	beginWildes(en, 'spines', { busy: false });
	wRelease(en, 'spines', 220);
}
function castDarkWolfMark(en){
	if(!wFriend(en)) player._wildesMarked = 210;
	beginWildes(en, 'predMark', { busy: false });
	wRelease(en, 'predMark', 180);
}

/* ---------- DARK MOSS WRAITH ---------- */
function castDarkWraithVoidGrasp(en){
	const aim = wLead(en, 10);
	const spots = [];
	for(let i = 0; i < 5; i++){
		const a = Math.random() * Math.PI * 2;
		spots.push({ x: aim.x + Math.cos(a) * (70 + Math.random() * 80), y: wFloor(aim.x, aim.y), emerge: 16 + i * 5 });
	}
	wFX({ kind:'voidHands', en, spots, age: 0, max: 70 });
	beginWildes(en, 'voidGrasp', { busy: false });
	wRelease(en, 'voidGrasp', 240);
}
function castDarkWraithCorrDrain(en){
	beginWildes(en, 'corrDrain', { busy: true });
}
function castDarkWraithCopies(en){
	const copies = [];
	for(let i = 0; i < 3; i++){
		copies.push({
			x: en.x + (i - 1) * 90, y: en.y, vx: (i - 1) * 2.2, vy: 0,
			hitCd: 0, shot: 20 + i * 12
		});
	}
	wFX({ kind:'shadowCopies', en, copies, age: 0, max: 130 });
	beginWildes(en, 'shadowCopies', { busy: true });
	en._wildesHidden = true; en._wildesNoHit = true;
}
function castDarkWraithDarkFade(en){
	beginWildes(en, 'darkFade', { busy: true, phase: 'dim', eyeA: 0, side: Math.random() < 0.5 ? 1 : -1 });
	en._wildesHidden = true; en._wildesNoHit = true; en._wildesDark = true;
}

/* ---------- ENEMY TICKS ---------- */
function updateWildesEnemy(en){
	if(player._wildesMarked > 0 && (en.necroType || en.type) === 'darkThornWolf' && !wFriend(en)){
		player._wildesMarked--;
		const dx = (player.x + player.w / 2) - (en.x + en.w / 2);
		if(Math.abs(dx) < 420){
			en.x += (dx > 0 ? 1 : -1) * 2.4;
			en.facing = dx > 0 ? 1 : -1;
		} else player._wildesMarked = 0;
	}
	const kit = en.wildesKit;
	if(!kit){ en._wildesKitBusy = false; return false; }
	kit.t++;
	const type = kit.type || en.necroType || en.type;
	if(type === 'mossWraith') tickMoss(en, kit);
	else if(type === 'willowWisp') tickWisp(en, kit);
	else if(type === 'glowBeetle') tickBeetle(en, kit);
	else if(type === 'stalactiteBat') tickBat(en, kit);
	else if(type === 'windSylph') tickSylph(en, kit);
	else if(type === 'darkVineCrawler') tickDarkVine(en, kit);
	else if(type === 'darkThornWolf') tickDarkWolf(en, kit);
	else if(type === 'darkMossWraith') tickDarkMoss(en, kit);
	else if(kit.t > 12) wildesEnd(en);
	return !!en._wildesKitBusy;
}

function tickMoss(en, kit){
	const aim = wLead(en, 8);
	if(kit.kind === 'mossGrasp'){
		if(kit.phase === 'sink'){
			en.y += 10;
			if(kit.t > 10) kit.phase = 'wait';
		} else if(kit.phase === 'wait'){
			if(kit.t === 18){
				for(let i = 0; i < kit.spots.length; i++){
					const s = kit.spots[i];
					wFX({ kind:'hand', en, x: s.x, y: s.y, age: 0, max: 40 });
				}
			}
			if(kit.t > 34){
				en.x = kit.riseX - en.w / 2;
				en.y = wFloor(kit.riseX, aim.y) - en.h;
				en._wildesHidden = false; en._wildesNoHit = false;
				wHit(en, en.x + en.w / 2, en.y + en.h / 2, 42, wDmg(34), ['stun']);
				wildesEnd(en);
			}
		}
	} else if(kit.kind === 'verdantDrain'){
		const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
		if(!wLOS(ox, oy, aim.x, aim.y)){ wildesEnd(en); return; }
		if(!wFriend(en)){
			player.x += ((ox - aim.x) > 0 ? 1 : -1) * 1.7;
			player.y += ((oy - aim.y) > 0 ? 0.4 : -0.4);
		}
		if(kit.t % 10 === 0) wHit(en, aim.x, aim.y, 22, wDmg(10), []);
		en.x += (aim.x > ox ? 1.4 : -1.4);
		if(kit.t > 54){
			en._wildesHidden = true;
			setTimeout(function(){ if(en && !en.dead){ en._wildesHidden = false; } }, 200);
			wildesEnd(en);
		}
	} else if(kit.kind === 'mossDouble'){
		if(kit.t > 70){
			const cf = wildesWorldFX.find(function(f){ return f.kind === 'mossCopies' && f.en === en; });
			const real = cf && (cf.copies.find(function(c){ return c.real; }) || cf.copies[0]);
			if(real){ en.x = real.x; en.y = real.y; if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0); cf.age = cf.max - 1; }
			en._wildesHidden = false; en._wildesNoHit = false;
			wHit(en, en.x + en.w / 2, en.y + en.h / 2, 48, wDmg(36), ['stun']);
			if(window.EFX){ EFX.burst(en.x + en.w / 2, en.y + en.h / 2, 'nature', 1.6); EFX.slash(en.x + en.w / 2, en.y + en.h / 2, en.facing > 0 ? 0 : Math.PI, 40, 2.4, 'nature', { dir: en.facing > 0 ? 1 : -1, width: 14 }); }
			wildesEnd(en);
		}
	} else if(kit.kind === 'fadeStrike'){
		kit.ang += 0.11;
		en.x = aim.x + Math.cos(kit.ang) * kit.r - en.w / 2;
		en.y = aim.y + Math.sin(kit.ang) * 28 - en.h / 2;
		if(kit.t % 3 === 0) wFX({ kind:'mosstrail', x: en.x + en.w / 2, y: en.y + en.h, age: 0, max: 28 });
		if(kit.t === 36){
			en._wildesHidden = false; en._wildesNoHit = false;
			wHit(en, aim.x, aim.y, 40, wDmg(32), []);
		}
		if(kit.t > 42){
			en._wildesHidden = true;
			setTimeout(function(){ if(en && !en.dead){ en._wildesHidden = false; en._wildesNoHit = false; } }, 180);
			wildesEnd(en);
		}
	} else if(kit.t > 14) wildesEnd(en);
}

function tickWisp(en, kit){
	const aim = wLead(en, 6);
	if(kit.kind === 'wispFlare'){
		if(kit.t === 20){
			const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
			wHit(en, ox, oy, 80, wDmg(22), []);
			for(let i = 0; i < 8; i++){
				const a = (i / 8) * Math.PI * 2;
				wSpawn(en, ox, oy, Math.cos(a) * 9, Math.sin(a) * 9, {
					color: '#eeffcc', color2: '#aaff88', power: 22, width: 30, height: 30,
					shape: 'circle', maxAge: 50, _wildesStyle: 'wisp'
				});
			}
			if(window.EFX){ EFX.burst(ox, oy, 'wisp', 2.2); EFX.ring(ox, oy, 10, 120, 'wisp', 18, { width: 6 }); }
		}
		if(kit.t > 28) wildesEnd(en);
		return;
	}
	if(kit.kind === 'enchantPulse'){
		if(kit.t > 10) wildesEnd(en);
		return;
	}
	if(kit.kind === 'lightTrail'){
		if(kit.phase === 'paint'){
			kit.ang += 0.28;
			en.x = aim.x + Math.cos(kit.ang) * 110 - en.w / 2;
			en.y = aim.y - 40 + Math.sin(kit.ang * 1.4) * 50;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
			if(kit.t % 2 === 0) kit.pts.push({ x: en.x + en.w / 2, y: en.y + en.h / 2 });
			if(kit.t > 48){ kit.phase = 'arm'; wFX({ kind:'trails', en, pts: kit.pts.slice(), age: 0, max: 70, on: false }); }
		} else if(kit.phase === 'arm'){
			if(kit.t > 62){
				en.x = aim.x - en.w / 2; en.y = aim.y - 90;
				kit.phase = 'dive';
			}
		} else {
			en.y += 13;
			wHit(en, en.x + en.w / 2, en.y + en.h / 2, 28, wDmg(30), []);
			if(kit.t > 78) wildesEnd(en);
		}
	} else if(kit.t > 10) wildesEnd(en);
}

function tickBeetle(en, kit){
	const aim = wAim(en);
	if(kit.kind === 'shellCharge'){
		if(kit.hitCd > 0) kit.hitCd--;
		en.x += Math.cos(kit.ang) * kit.spd;
		en.y += Math.sin(kit.ang) * kit.spd * 0.15;
		if(kit.hitCd <= 0 && wHit(en, en.x + en.w / 2, en.y + en.h / 2, 36, wDmg(30), ['stun'])) kit.hitCd = 8;
		const nx = en.x + (Math.cos(kit.ang) > 0 ? en.w + 8 : -8);
		const past = (Math.cos(kit.ang) > 0 ? (en.x + en.w / 2) - aim.x : aim.x - (en.x + en.w / 2)) > 140;
		if(window.EFX && kit.t % 2 === 0) EFX.emit('glow', en.x + en.w / 2, en.y + en.h - 4, 1, { speed: 1 });
		if(wBlocked(nx, en.y + en.h / 2) || (past && kit.t > 8)){
			kit.ang = Math.PI - kit.ang + (Math.random() - 0.5) * 0.4;
			kit.spd = Math.min(14.5, kit.spd + 1.1);
			kit.bounces++;
			wSpark(en.x, en.y, 8, { r: 80, g: 200, b: 220 });
		}
		if(kit.t > 70 || kit.bounces > 5){ en._wildesShell = false; en._wildesNoHit = false; wildesEnd(en); }
	} else if(kit.kind === 'lumaBeam'){
		const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
		kit.len = 0;
		if(kit.t > 14){
			kit.ang += kit.rot;
			for(let s = 12; s < 440; s += 16){
				const x = ox + Math.cos(kit.ang) * s, y = oy + Math.sin(kit.ang) * s;
				kit.len = s;
				if(wBlocked(x, y)) break;
				if(kit.hitCd <= 0 && wHit(en, x, y, 16, wDmg(18), [])) kit.hitCd = 10;
			}
			const ex = ox + Math.cos(kit.ang) * kit.len, ey = oy + Math.sin(kit.ang) * kit.len;
			if(window.EFX && kit.t % 2 === 0) EFX.sparks('glow', ex, ey, 2, { speed: 4 });
		}
		if(kit.hitCd > 0) kit.hitCd--;
		if(kit.t > 74) wildesEnd(en);
	} else if(kit.kind === 'shellReflect'){
		if(!wFriend(en)){
			const dx = aim.x - (en.x + en.w / 2);
			en.x += (dx > 0 ? 1 : -1) * 1.15;
		}
		if(kit.t > 70){ en._wildesReflect = false; en._wildesShell = false; wildesEnd(en); }
	} else if(kit.t > 12) wildesEnd(en);
}

function tickBat(en, kit){
	const aim = wLead(en, 8);
	if(kit.kind === 'diveBomb'){
		if(kit.phase === 'up'){
			en.y -= 12;
			if(kit.t > 10){ kit.phase = 'track'; kit.lock = 0; }
		} else if(kit.phase === 'track'){
			kit.sx += (aim.x - kit.sx) * 0.22;
			kit.lock++;
			if(kit.lock > 18){ kit.phase = 'dive'; en.x = kit.sx - en.w / 2; en._wildesHidden = false; en._wildesNoHit = false; }
		} else {
			en.y += 15;
			if(en.y + en.h >= wFloor(en.x, en.y) || kit.t > 56){
				wHit(en, en.x + en.w / 2, en.y + en.h, 48, wDmg(36), ['stun', 'horizontalLaunch']);
				wShake(7, 12);
				wildesEnd(en);
			}
		}
	} else if(kit.kind === 'echoBlast'){
		kit.ang += 0.16;
		en.x += Math.cos(kit.ang) * 6.4;
		en.y += Math.sin(kit.ang * 1.3) * 3.2;
		if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
		if(kit.t % 8 === 0 && kit.orbs.length < 6){
			kit.orbs.push({ x: en.x + en.w / 2, y: en.y + en.h / 2 });
			wFX({ kind:'echo', x: en.x + en.w / 2, y: en.y + en.h / 2, age: 0, max: 50, en: en });
		}
		if(kit.t === 52){
			for(let i = 0; i < kit.orbs.length; i++){
				const o = kit.orbs[i];
				const a = Math.atan2(aim.y - o.y, aim.x - o.x);
				wSpawn(en, o.x, o.y, Math.cos(a) * 11, Math.sin(a) * 11, {
					color: '#c8d8ff', color2: '#ffffff', power: 26, width: 56, height: 18,
					shape: 'blade', maxAge: 60, _wildesStyle: 'sonic'
				});
			}
		}
		if(kit.t > 64) wildesEnd(en);
	} else if(kit.kind === 'ceilingDrop'){
		if(kit.phase === 'hang'){
			for(let i = 0; i < kit.rocks.length; i++){
				const r = kit.rocks[i];
				if(!r.fallen && kit.t >= r.drop){
					r.fallen = true;
					if(!r.fake){
						wSpawn(en, r.x, r.y - 220, 0, 11.5, {
							color: '#8a8a9a', color2: '#dde0ee', power: 28, width: 36, height: 52,
							shape: 'spike', maxAge: 50, gravity: 0.18, _wildesStyle: 'rock'
						});
					}
				}
			}
			if(kit.t > 52){
				en.x = kit.hide.x - en.w / 2;
				en.y = kit.hide.y - en.h - 8;
				en._wildesHidden = false; en._wildesNoHit = false;
				wHit(en, en.x + en.w / 2, en.y + en.h / 2, 40, wDmg(32), ['stun']);
				wildesEnd(en);
			}
		}
	} else if(kit.t > 12) wildesEnd(en);
}

function tickSylph(en, kit){
	const aim = wLead(en, 8);
	if(kit.kind === 'windGust'){
		if(kit.phase === 'push'){
			if(!wFriend(en)) player.x += kit.dir * 4.2;
			if(window.EFX && kit.t % 2 === 0) EFX.add({ k: 'spark', x: en.x + en.w / 2 + kit.dir * (20 + Math.random() * 60), y: en.y + Math.random() * en.h * 1.6, vx: kit.dir * 9, vy: 0, drag: 0.98, size: 1.4, len: 3, c: '#ffffff', c2: '#dafff4', max: 30 });
			if(kit.t > 16){
				kit.phase = 'cut';
				const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
				const aimG = wAim(en), ga = Math.atan2(aimG.y - oy, aimG.x - ox);
				for(let i = 0; i < 3; i++){
					const a = ga + (i - 1) * 0.16;
					const p = wSpawn(en, ox, oy, Math.cos(a) * (4 + i), Math.sin(a) * (4 + i), {
						color: '#d0eeff', color2: '#ffffff', power: 30, width: 66, height: 22,
						shape: 'blade', maxAge: 55, _wildesStyle: 'slash'
					});
					if(p) p._wildesAccel = 1.09;
				}
			}
		}
		if(kit.t > 36) wildesEnd(en);
	} else if(kit.kind === 'pressure'){
		if(kit.t < 28 && !wFriend(en)){
			const dx = (en.x + en.w / 2) - (player.x + player.w / 2);
			if(Math.abs(dx) < 460) player.x += Math.sign(dx) * Math.min(Math.abs(dx) * 0.5, 4 + kit.t * 0.25);
			if(window.EFX && kit.t % 2 === 0) EFX.charge(en.x + en.w / 2, en.y + en.h / 2, 'wind', 180, 2, 20);
		}
		if(kit.t === 28){
			if(window.EFX){ EFX.burst(en.x + en.w / 2, en.y + en.h / 2, 'wind', 2.4); EFX.ring(en.x + en.w / 2, en.y + en.h / 2, 20, 170, 'wind', 20, { width: 8 }); }
			wFX({ kind:'shock', en, x: en.x + en.w / 2, y: en.y + en.h / 2, age: 0, max: 22, r: 8 });
			wHit(en, en.x + en.w / 2, en.y + en.h / 2, 120, wDmg(40), ['stun', 'horizontalLaunch']);
			wShake(8, 14);
		}
		if(kit.t > 36) wildesEnd(en);
	} else if(kit.t > 12) wildesEnd(en);
}

function tickDarkVine(en, kit){
	const aim = wLead(en, 8);
	if(kit.kind === 'rotTunnel'){
		if(kit.phase === 'dig'){
			en.x += (kit.tx - (en.x + en.w / 2)) * 0.12;
			en.y = wFloor(en.x, en.y) - 4;
			if(kit.t % 2 === 0) kit.trail.push({ x: en.x + en.w / 2, y: en.y + 6 });
			wFX({ kind:'rottrail', x: en.x + en.w / 2, y: wFloor(en.x, en.y), age: 0, max: 36 });
			if(kit.t > 28 || Math.abs(en.x + en.w / 2 - kit.tx) < 18){
				kit.phase = 'burst';
				en._wildesHidden = false; en._wildesNoHit = false;
				en.y = kit.ty - en.h;
				wHit(en, en.x + en.w / 2, en.y + en.h / 2, 56, wDmg(38), ['stun', 'horizontalLaunch']);
				for(let i = 0; i < 8; i++){
					const a = -Math.PI + i * 0.4;
					wSpawn(en, en.x + en.w / 2, en.y, Math.cos(a) * 9.4, Math.sin(a) * 9.4, {
						color: '#3a1844', color2: '#cc66ff', power: 28, width: 38, height: 38,
						shape: 'spike', maxAge: 50, _wildesStyle: 'void'
					});
				}
				wPatch(en.x + en.w / 2, wFloor(en.x, en.y), 40, 200, en);
				wShake(8, 12);
			}
		} else if(kit.t > 44) wildesEnd(en);
	} else if(kit.t > 12) wildesEnd(en);
}

function tickDarkWolf(en, kit){
	if(kit.kind === 'darkBite'){
		if(kit.phase === 'lunge'){
			en.x += Math.cos(kit.ang) * 13.6;
			en.y += Math.sin(kit.ang) * 4.2;
			if(!kit.hit && wHit(en, en.x + en.w / 2, en.y + en.h / 2, 34, wDmg(34), [])){ kit.hit = true; if(window.EFX) EFX.slash(en.x + en.w / 2 + Math.cos(kit.ang) * 20, en.y + en.h / 2, kit.ang, 34, 2.4, 'rot', { dir: Math.cos(kit.ang) >= 0 ? 1 : -1, width: 14 }); }
			if(kit.cancel && kit.t > 8){ kit.phase = 'back'; kit.ang += Math.PI; }
			else if(kit.t > 16){ en._wildesFade = 0; wildesEnd(en); }
		} else {
			en.x += Math.cos(kit.ang) * 11.2;
			if(kit.t > 24){ en._wildesFade = 0; wildesEnd(en); }
		}
	} else if(kit.kind === 'shadowDash'){
		en.x += Math.cos(kit.ang) * 12.8;
		en.y += Math.sin(kit.ang) * 2.4;
		if(!kit.hit && wHit(en, en.x + en.w / 2, en.y + en.h / 2, 32, wDmg(30), [])){ kit.hit = true; if(window.EFX) EFX.slash(en.x + en.w / 2, en.y + en.h / 2, kit.ang, 36, 2.6, 'rot', { dir: Math.cos(kit.ang) >= 0 ? 1 : -1, width: 15 }); }
		if(window.EFX && kit.t % 2 === 0) EFX.emit('rot', en.x + en.w / 2, en.y + en.h / 2, 2, { speed: 1 });
		if(kit.t > 18) wildesEnd(en);
	} else if(kit.t > 12) wildesEnd(en);
}

function tickDarkMoss(en, kit){
	const aim = wAim(en);
	if(kit.kind === 'corrDrain'){
		const ox = en.x + en.w / 2, oy = en.y + en.h / 2;
		if(!wLOS(ox, oy, aim.x, aim.y)){ wildesEnd(en); return; }
		if(kit.t % 8 === 0) wPatch(aim.x + (Math.random() - 0.5) * 50, wFloor(aim.x, aim.y), 26, 160, en);
		if(kit.t > 56) wildesEnd(en);
	} else if(kit.kind === 'shadowCopies'){
		if(kit.t > 120){
			en._wildesHidden = false; en._wildesNoHit = false;
			wildesEnd(en);
		}
	} else if(kit.kind === 'darkFade'){
		kit.eyeA += 0.13;
		if(kit.t === 36){
			en._wildesHidden = false; en._wildesNoHit = false; en._wildesDark = false;
			en.x = aim.x - kit.side * 46 - en.w / 2;
			en.y = aim.y - en.h / 2;
			if(en.typeDef && en.typeDef.flies) en.baseY = en.y - (en.flyOffset || 0);
			wHit(en, aim.x - kit.side * 16, aim.y, 44, wDmg(36), ['stun']);
			if(window.EFX){ EFX.slash(aim.x - kit.side * 10, aim.y, kit.side > 0 ? 0 : Math.PI, 38, 2.6, 'rot', { dir: kit.side, width: 16 }); EFX.burst(aim.x, aim.y, 'rot', 1.4); }
			wildesEnd(en);
		}
	} else if(kit.t > 14) wildesEnd(en);
}

/* ---------- WORLD ---------- */
function updateWildesWorld(){
	if(player._kitSlow){ player._kitSlow *= 0.94; if(player._kitSlow < 0.04) player._kitSlow = 0; }
	if(typeof enemyProjectiles !== 'undefined'){
		for(let i = 0; i < enemyProjectiles.length; i++){
			const p = enemyProjectiles[i];
			if(!p) continue;
			if(p._wildesHook && p.age >= (p._hookAt || 12)){
				const a = wAim(p._wildesEn);
				const behind = a.x + (a.x > p.x ? -80 : 80);
				const dx = behind - p.x, dy = a.y - p.y, d = Math.hypot(dx, dy) || 1;
				p.vx += dx / d * 1.15; p.vy += dy / d * 1.15;
				if(p.age > 28){
					const hx = a.x - p.x, hy = a.y - p.y, hd = Math.hypot(hx, hy) || 1;
					p.vx += hx / hd * 0.9; p.vy += hy / hd * 0.9;
				}
			}
			if(p._wildesAccel){ p.vx *= p._wildesAccel; p.vy *= p._wildesAccel; }
			if(p._wildesPull){
				const dx = p._wildesPull.x - p.x, dy = p._wildesPull.y - p.y, d = Math.hypot(dx, dy) || 1;
				p.vx += dx / d * 0.35; p.vy += dy / d * 0.35;
			}
			if(p._wildesLeaf === 'curve') p.vy += Math.sin(p.age * 0.22) * 0.7;
			if(p._wildesLeaf === 'spiral'){
				p._leafT = (p._leafT || 0) + 0.2;
				const a = (p._leafAng || 0) + p._leafT;
				p.vx = Math.cos(a) * 9.2; p.vy = Math.sin(a) * 9.2;
			}
			if(p._wildesLeaf === 'boom' && p.age === 28){ p.vx *= -1.15; p.vy *= -1.15; }
			if(p._wildesCorrupt && p.age % 5 === 0) wPatch(p.x, wFloor(p.x, p.y), 22, 160, null);
			if(p._wildesSeekPatch && wildesPatches.length){
				let best = wildesPatches[0], bd = 1e9;
				for(let k = 0; k < wildesPatches.length; k++){
					const d = Math.hypot(wildesPatches[k].x - p.x, wildesPatches[k].y - p.y);
					if(d < bd){ bd = d; best = wildesPatches[k]; }
				}
				const dx = best.x - p.x, dy = best.y - p.y, d = Math.hypot(dx, dy) || 1;
				p.vx += dx / d * 0.7; p.vy += dy / d * 0.7;
			}
		}
	}
	for(let i = wildesPatches.length - 1; i >= 0; i--){
		const pt = wildesPatches[i];
		pt.age++; pt.r += pt.grow;
		if(!wFriend(pt.en) && circRect(pt.x, pt.y, pt.r, player.x, player.y, player.w, player.h)){
			wSlow(0.55);
			if(pt.age % 12 === 0) wHit(pt.en, pt.x, pt.y, pt.r, wDmg(8), ['poison']);
		}
		if(pt.age >= pt.max) wildesPatches.splice(i, 1);
	}
	for(let i = wildesWorldFX.length - 1; i >= 0; i--){
		const fx = wildesWorldFX[i];
		fx.age++;
		if(fx.kind === 'cloud') tickCloud(fx);
		else if(fx.kind === 'rings') tickRings(fx);
		else if(fx.kind === 'shroom') tickShroom(fx);
		else if(fx.kind === 'join') tickJoin(fx);
		else if(fx.kind === 'myco') tickMyco(fx);
		else if(fx.kind === 'hand' || fx.kind === 'voidHands') tickHands(fx);
		else if(fx.kind === 'mossCopies') tickMossCopies(fx);
		else if(fx.kind === 'trails') tickTrails(fx);
		else if(fx.kind === 'shriek') tickShriek(fx);
		else if(fx.kind === 'lash') tickLash(fx);
		else if(fx.kind === 'grab') tickGrab(fx);
		else if(fx.kind === 'canopy') tickCanopy(fx);
		else if(fx.kind === 'cyclone') tickCyclone(fx);
		else if(fx.kind === 'snare') tickSnare(fx);
		else if(fx.kind === 'afterimage') tickAfter(fx);
		else if(fx.kind === 'spine') tickSpine(fx);
		else if(fx.kind === 'shadowCopies') tickShadowCopies(fx);
		else if(fx.kind === 'shock'){ fx.r += 9; if(fx.age === 2) wHit(fx.en, fx.x, fx.y, 90, wDmg(18), []); }
		else if(fx.kind === 'pulse'){
			fx.r = 20 + fx.age * 8;
			if(!fx.hit && !wFriend(fx.en)){ const d = Math.hypot(player.x + player.w / 2 - fx.x, player.y + player.h / 2 - fx.y); if(Math.abs(d - fx.r) < 20) fx.hit = wHit(fx.en, player.x + player.w / 2, player.y + player.h / 2, 20, wDmg(16), []); }
		}
		if(fx.age >= fx.max) wildesWorldFX.splice(i, 1);
	}
}

function wSporeDrops(){
	let n = 0;
	if(typeof enemyProjectiles !== 'undefined') for(let i = 0; i < enemyProjectiles.length; i++) if(enemyProjectiles[i]._wildesStyle === 'spore') n++;
	return n;
}
function tickCloud(fx){
	if(fx.phase === 'swell'){
		if(fx.age > 16) fx.phase = 'hang';
	} else {
		const aim = wAim(fx.en);
		fx.x += Math.max(-4.5, Math.min(4.5, (aim.x - fx.x) * 0.07));
		fx.y += ((aim.y - 150) - fx.y) * 0.03;
		// 13 heavier drops instead of 24 light ones: the same threat with half the projectiles,
		// and a ceiling on spore drops in the air so a crowd of fungi can't flood the screen
		if(fx.age > 22 && fx.age % 9 === 0 && fx.rain < 13 && wSporeDrops() < 26){
			fx.rain++;
			wSpawn(fx.en, fx.x + (Math.random() - 0.5) * 70, fx.y + 10, 0.4, 6.8, {
				color: '#c8e060', color2: '#eeffaa', power: 32, width: 30, height: 38,
				shape: 'circle', maxAge: 70, gravity: 0.08, effects: ['poison'], _wildesStyle: 'spore'
			});
		}
		const under = !wFriend(fx.en) && Math.abs((player.x + player.w / 2) - fx.x) < 80 && player.y > fx.y;
		if(under) wSlow(0.45 + Math.min(0.3, fx.age * 0.004));
	}
}
function tickRings(fx){
	for(let i = 0; i < fx.rings.length; i++){
		const R = fx.rings[i];
		R.r += R.reverse ? -Math.abs(R.spd) : R.spd;
		if(R.reverseAt && fx.age === R.reverseAt) R.spd = -Math.abs(R.spd);
		if(R.spd < 0 && R.r < 16) R.spd = Math.abs(R.spd);
		const aim = wAim(fx.en);
		const d = Math.hypot(aim.x - fx.x, aim.y - fx.y);
		if(Math.abs(d - R.r) < 16){
			let blocked = false;
			if(R.gaps){
				const ang = Math.atan2(aim.y - fx.y, aim.x - fx.x);
				if(Math.abs(((ang - R.gapA + Math.PI) % (Math.PI * 2)) - Math.PI) < R.gapW) blocked = true;
			}
			if(!blocked) wHit(fx.en, aim.x, aim.y, 18, wDmg(16), []);
		}
	}
}
function tickShroom(fx){
	if(fx.en && fx.en.dead && fx.stage < 2){ fx.age = fx.max; return; }
	if(fx.age === 16) fx.stage = 1;
	if(fx.age === 34) fx.stage = 2;
	// puffs only while you're near it, and not more often than every ~0.55 s
	if(fx.stage >= 2 && fx.age % 34 === 0 && Math.abs((player.x + player.w / 2) - fx.x) < 280 && wSporeDrops() < 26){
		wSpawn(fx.en, fx.x, fx.y - 36, 0, -8.4, {
			color: '#d8ee66', color2: '#ffffcc', power: 20, width: 24, height: 32,
			shape: 'circle', maxAge: 50, gravity: 0.16, effects: ['poison'], _wildesStyle: 'spore'
		});
	}
}
function tickMyco(fx){
	// tendrils race along the floor toward the player at different speeds and lengths;
	// each one erupts once where it stops, so the ground bursts in a staggered line toward you
	for(let i = 0; i < fx.lines.length; i++){
		const L = fx.lines[i];
		if(!L.live) continue;
		L.len = Math.min(L.max, L.len + (L.spd || 4.6));
		L.x2 = L.x1 + (L.dir || 1) * L.len;
		L.y2 = wFloor(L.x2, L.y1 - 40);
		if(L.len >= L.max){
			L.live = false;
			wFX({ kind:'join', x: L.x2, y: L.y2 - 4, age: 0, max: 46, en: fx.en, r: 34 });
			wSpawn(fx.en, L.x2, L.y2 - 20, 0, -7.2, {
				color: '#d8ee66', color2: '#ffffcc', power: 22, width: 24, height: 30,
				shape: 'circle', maxAge: 46, gravity: 0.2, effects: ['poison'], _wildesStyle: 'spore'
			});
			if(window.EFX) EFX.burst(L.x2, L.y2 - 6, 'spore', 0.8, { debris: false });
		}
	}
}
function tickJoin(j){
	if(!wFriend(j.en) && circRect(j.x, j.y, j.r, player.x, player.y, player.w, player.h)){
		wHit(j.en, j.x, j.y, j.r, wDmg(14), ['poison']);
		wSlow(0.5);
	}
}
function tickHands(fx){
	if(fx.spots){
		for(let i = 0; i < fx.spots.length; i++){
			const s = fx.spots[i];
			if(fx.age === s.emerge) wHit(fx.en, s.x, s.y - 20, 30, wDmg(24), []);
		}
	} else if(fx.age === 8) wHit(fx.en, fx.x, fx.y - 18, 28, wDmg(22), []);
}
function tickMossCopies(fx){
	const aim = wAim(fx.en);
	for(let i = 0; i < fx.copies.length; i++){
		const c = fx.copies[i];
		c.x += ((aim.x + (i - 1) * 60) - c.x) * 0.04;
		c.y += (aim.y - 24 - c.y) * 0.03;
	}
	if(fx.age === 80 && fx.en){
		fx.en._wildesHidden = false; fx.en._wildesNoHit = false;
		const real = fx.copies.find(function(c){ return c.real; }) || fx.copies[0];
		if(real) fx.en.x = real.x;
	}
}
function tickTrails(fx){
	if(fx.age === 8) fx.on = true;
	if(fx.on){
		for(let i = 1; i < fx.pts.length; i++){
			const a = fx.pts[i - 1], b = fx.pts[i];
			const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
			if(segHit(a.x, a.y, b.x, b.y, 10)) wHit(fx.en, mx, my, 16, wDmg(14), []);
		}
	}
}
function segHit(x1, y1, x2, y2, pad){
	const px = player.x + player.w / 2, py = player.y + player.h / 2;
	const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1;
	const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (d * d)));
	return Math.hypot(px - (x1 + dx * t), py - (y1 + dy * t)) < pad + 14;
}
function tickShriek(fx){
	fx.len += 8.4;
	const wide = 0.22 + fx.len / 420;
	const aim = wAim(fx.en);
	const ang = Math.atan2(aim.y - fx.y, aim.x - fx.x);
	const d = Math.hypot(aim.x - fx.x, aim.y - fx.y);
	if(d < fx.len && Math.abs(((ang - fx.ang + Math.PI) % (Math.PI * 2)) - Math.PI) < wide){
		wHit(fx.en, aim.x, aim.y, 20, wDmg(18), []);
	}
}
function tickLash(fx){
	if(fx.delay && fx.age < fx.delay) return;
	fx.ang += fx.sweep;
	if(fx.hitCd > 0) fx.hitCd--;
	const aim = wAim(fx.en);
	const d = Math.hypot(aim.x - fx.x, aim.y - fx.y);
	const ang = Math.atan2(aim.y - fx.y, aim.x - fx.x);
	if(d < fx.r && Math.abs(((ang - fx.ang + Math.PI) % (Math.PI * 2)) - Math.PI) < 0.18){
		if(fx.hitCd <= 0 && wHit(fx.en, aim.x, aim.y, 22, wDmg(26), [])) fx.hitCd = 7;
	}
}
function tickGrab(fx){
	if(fx.age === 18){
		const aim = wAim(fx.en);
		if(Math.abs(aim.x - fx.x) < 28 && Math.abs(aim.y - fx.y) < 40){
			fx.snapped = true;
			wHit(fx.en, fx.x, fx.y, 30, wDmg(28), ['stun']);
		} else { fx.stay = true; fx.max = 160; }
	}
	if(fx.stay && !wFriend(fx.en) && Math.abs((player.x + player.w / 2) - fx.x) < 18 && player.y + player.h > fx.y - 40){
		if(player.vx > 0 && player.x < fx.x) player.x = fx.x - player.w - 2;
		if(player.vx < 0 && player.x > fx.x) player.x = fx.x + 10;
	}
}
function tickCanopy(fx){
	for(let i = 0; i < fx.panels.length; i++){
		const P = fx.panels[i];
		if(!P.dropped && fx.age >= P.fall){
			P.dropped = true;
			wSpawn(fx.en, P.x + P.w / 2, P.y, 0, 9.6, {
				color: '#3a8a30', color2: '#c8ee88', power: 32, width: P.w, height: 28,
				shape: 'blade', maxAge: 55, gravity: 0.12, _wildesStyle: 'leaf'
			});
		}
	}
}
function tickCyclone(fx){
	fx.x += fx.dir * 5.8;
	fx.y += Math.sin(fx.age * 0.12) * 3.4;
	if(fx.hitCd > 0) fx.hitCd--;
	if(fx.hitCd <= 0 && wHit(fx.en, fx.x, fx.y, 46, wDmg(22), ['horizontalLaunch'])) fx.hitCd = 8;
	if(fx.age % 3 === 0) fx.wake.push({ x: fx.x, y: fx.y, age: 0, max: 24 });
	for(let i = fx.wake.length - 1; i >= 0; i--){
		fx.wake[i].age++;
		if(!wFriend(fx.en) && circRect(fx.wake[i].x, fx.wake[i].y, 20, player.x, player.y, player.w, player.h)) wSlow(0.4);
		if(fx.wake[i].age >= fx.wake[i].max) fx.wake.splice(i, 1);
	}
}
function tickSnare(fx){
	const aim = wLead(fx.en, 8);
	if(fx.age === 16 || fx.age === 32 || fx.age === 48){
		fx.x += (aim.x - fx.x) * 0.7;
		fx.y = wFloor(fx.x, aim.y);
		fx.hops++;
		efxTelegraph(fx.x - 16, fx.y - 20, 32, 24, 10, 'rgba(80,20,90,0.45)', 'rect', '');
	}
	if(fx.age === 62){
		fx.erupted = true;
		wHit(fx.en, fx.x, fx.y - 24, 38, wDmg(32), ['stun']);
		wPatch(fx.x, fx.y, 34, 180, fx.en);
	}
}
function tickAfter(fx){
	if(fx.age === 16 && !fx.fired){
		fx.fired = true;
		const p = wSpawn(fx.en, fx.x + fx.w / 2, fx.y + fx.h / 2, Math.cos(fx.ang) * 12.4, Math.sin(fx.ang) * 3.2, {
			color: '#1a1028', color2: '#8844cc', power: 30, width: fx.w + 8, height: fx.h,
			shape: 'blade', maxAge: 22, _wildesStyle: 'void'
		});
		if(p) p.pierce = true;
	}
}
function tickSpine(fx){
	if(fx.age === 36 && !fx.fired){
		fx.fired = true;
		const aimS = wAim(fx.en), base = Math.atan2(aimS.y - (fx.y - 8), aimS.x - fx.x);
		if(window.EFX) EFX.flash(fx.x, fx.y - 10, 18, 'rot', 6);
		for(let i = 0; i < 3; i++){
			const a = base + (i - 1) * 0.35;
			wSpawn(fx.en, fx.x, fx.y - 8, Math.cos(a) * 10.6, Math.sin(a) * 10.6, {
				color: '#2a1838', color2: '#bb66ee', power: 22, width: 28, height: 28,
				shape: 'spike', maxAge: 45, _wildesStyle: 'void'
			});
		}
	}
}
function tickShadowCopies(fx){
	const aim = wAim(fx.en);
	for(let i = 0; i < fx.copies.length; i++){
		const c = fx.copies[i];
		c.x += c.vx + Math.sin(fx.age * 0.1 + i) * 0.8;
		c.y += (aim.y - 30 - c.y) * 0.04;
		if(c.hitCd > 0) c.hitCd--;
		if(c.hitCd <= 0 && wHit(fx.en, c.x + 16, c.y + 20, 24, wDmg(16), [])) c.hitCd = 14;
		if(fx.age === c.shot){
			const a = Math.atan2(aim.y - c.y, aim.x - c.x);
			wSpawn(fx.en, c.x, c.y, Math.cos(a) * 10.2, Math.sin(a) * 10.2, {
				color: '#201028', color2: '#aa66cc', power: 24, width: 36, height: 36,
				shape: 'circle', maxAge: 50, _wildesStyle: 'void'
			});
		}
	}
}

/* ---------- DRAW (EFX) ---------- */
function wDrawLeaf(x, y, ang, L, W, c1, c2, a){
	const sx = x - camera.x, sy = y - camera.y;
	ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang); ctx.globalAlpha = a == null ? 1 : a;
	const g = ctx.createLinearGradient(0, -W, 0, W); g.addColorStop(0, c2); g.addColorStop(1, c1);
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.moveTo(L, 0); ctx.quadraticCurveTo(0, -W * 1.2, -L, 0); ctx.quadraticCurveTo(0, W * 1.2, L, 0); ctx.fill();
	ctx.strokeStyle = 'rgba(20,50,10,0.5)'; ctx.lineWidth = 1;
	ctx.beginPath(); ctx.moveTo(L * 0.9, 0); ctx.lineTo(-L, 0);
	for(let k = -0.5; k <= 0.5; k += 0.33){ ctx.moveTo(L * k, 0); ctx.lineTo(L * k - W * 0.6, -W * 0.7); ctx.moveTo(L * k, 0); ctx.lineTo(L * k - W * 0.6, W * 0.7); }
	ctx.stroke();
	ctx.restore();
}
function wDrawMushroom(x, y, h, capR, a, glowK){
	const sx = x - camera.x, sy = y - camera.y;
	ctx.save(); ctx.globalAlpha = a;
	const g = ctx.createLinearGradient(sx - 6, 0, sx + 6, 0); g.addColorStop(0, '#d8ccaa'); g.addColorStop(1, '#8a7a5a');
	ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(sx - 5, sy); ctx.quadraticCurveTo(sx - 7, sy - h * 0.5, sx - 4, sy - h); ctx.lineTo(sx + 4, sy - h); ctx.quadraticCurveTo(sx + 7, sy - h * 0.5, sx + 5, sy); ctx.closePath(); ctx.fill();
	const cg = ctx.createRadialGradient(sx - capR * 0.3, sy - h - capR * 0.4, 1, sx, sy - h, capR * 1.1);
	cg.addColorStop(0, '#fff6c0'); cg.addColorStop(0.4, '#c8d060'); cg.addColorStop(1, '#6a7a20');
	ctx.fillStyle = cg; ctx.beginPath(); ctx.ellipse(sx, sy - h, capR, capR * 0.6, 0, Math.PI, 0); ctx.quadraticCurveTo(sx, sy - h + capR * 0.25, sx - capR, sy - h); ctx.fill();
	ctx.fillStyle = 'rgba(255,255,230,0.75)';
	for(let k = 0; k < 4; k++){ ctx.beginPath(); ctx.arc(sx + (k - 1.5) * capR * 0.42, sy - h - capR * (0.25 + (k % 2) * 0.18), capR * 0.1, 0, Math.PI * 2); ctx.fill(); }
	if(glowK > 0){ ctx.globalCompositeOperation = 'lighter'; EFX.glowS(sx, sy - h, capR * 1.8, '#9ad030', 0.35 * glowK); }
	ctx.restore();
}
function wDrawHand(x, y, h, el, a, t){
	// a grasping hand of moss / shadow reaching out of the ground
	const P = EFX.pal(el), sx = x - camera.x, sy = y - camera.y;
	ctx.save(); ctx.globalAlpha = a;
	const g = ctx.createLinearGradient(0, sy - h, 0, sy); g.addColorStop(0, P.mid); g.addColorStop(1, P.dark);
	ctx.fillStyle = g;
	ctx.beginPath(); ctx.moveTo(sx - 7, sy); ctx.quadraticCurveTo(sx - 9, sy - h * 0.6, sx - 10, sy - h * 0.72);
	const curl = Math.sin(t * 0.3) * 3;
	for(let f = 0; f < 4; f++){ const fx = sx - 9 + f * 6; ctx.lineTo(fx - 1, sy - h - (f === 1 || f === 2 ? 8 : 3) + curl); ctx.lineTo(fx + 3, sy - h * 0.78); }
	ctx.lineTo(sx + 12, sy - h * 0.7); ctx.quadraticCurveTo(sx + 9, sy - h * 0.5, sx + 7, sy); ctx.closePath(); ctx.fill();
	ctx.globalCompositeOperation = 'lighter'; EFX.glowS(sx, sy - h * 0.7, 18, P.outer, 0.35);
	ctx.restore();
}
function drawWildesKitProj(p){
	if(!window.EFX) return;
	const style = p._wildesStyle || 'spore', r = Math.max(p.width, p.height) * 0.4;
	const ang = Math.atan2(p.vy || 0, p.vx || 1);
	if(style === 'leaf'){
		const h = EFX.track(p, 6); EFX.trail(h, r * 0.35, 'nature', { ribbon: false, alpha: 0.35 });
		wDrawLeaf(p.x, p.y, ang + Math.sin((p.age || 0) * 0.4) * 0.3, p.width * 0.48, p.height * 0.32, '#2f6a1a', '#a8e860');
		if((p.age & 3) === 0) EFX.mote('nature', p.x, p.y, -p.vx, -p.vy, 0.7);
	} else if(style === 'slash'){
		// a crescent of compressed air
		const sx = p.x - camera.x, sy = p.y - camera.y, L = p.width * 0.55;
		const h = EFX.track(p, 6); EFX.trail(h, r * 0.3, 'wind', { alpha: 0.3 });
		ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang); ctx.globalCompositeOperation = 'lighter';
		for(let k = 0; k < 2; k++){
			ctx.strokeStyle = k ? 'rgba(255,255,255,0.9)' : 'rgba(170,230,215,0.6)'; ctx.lineWidth = k ? 2 : 6;
			ctx.beginPath(); ctx.ellipse(-L * 0.3, 0, L * 0.6, L * 0.9, 0, -1.1, 1.1); ctx.stroke();
		}
		ctx.restore();
	} else if(style === 'sonic'){
		const sx = p.x - camera.x, sy = p.y - camera.y, L = p.width * 0.4;
		ctx.save(); ctx.translate(sx, sy); ctx.rotate(ang); ctx.globalCompositeOperation = 'lighter';
		for(let k = 0; k < 3; k++){
			ctx.strokeStyle = 'rgba(200,190,255,' + (0.8 - k * 0.22) + ')'; ctx.lineWidth = 3 - k * 0.7;
			ctx.beginPath(); ctx.arc(-k * 10, 0, L * (0.55 + k * 0.25), -0.9, 0.9); ctx.stroke();
		}
		ctx.restore();
	} else if(style === 'rock'){
		EFX.bolt(p, p.x, p.y, r * 0.95, 'earth', { spin: 0.15, moteEvery: 4 });
	} else if(style === 'void'){
		EFX.bolt(p, p.x, p.y, r * 0.8, 'rot', { trailLen: 8 });
	} else if(style === 'wisp'){
		EFX.bolt(p, p.x, p.y, r * 0.7, 'wisp', { trailLen: 11 });
	} else {
		EFX.bolt(p, p.x, p.y, r * 0.8, 'spore', { trailLen: 6, moteEvery: 2 });
	}
}

function drawWildesWorld(){
	if(!window.EFX) return;
	EFX.bind();
	// corruption patches: rotting purple ground with bubbles
	for(let i = 0; i < wildesPatches.length; i++){
		const p = wildesPatches[i];
		const x = p.x - camera.x, y = p.y - camera.y + 2, a = Math.min(1, p.age / 10) * Math.min(1, (p.max - p.age) / 30);
		ctx.save(); ctx.globalAlpha = a;
		const g = ctx.createRadialGradient(x, y, 2, x, y, p.r);
		g.addColorStop(0, 'rgba(40,6,50,0.85)'); g.addColorStop(0.7, 'rgba(70,16,90,0.5)'); g.addColorStop(1, 'rgba(60,10,70,0)');
		ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, p.r, p.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
		if(p.age % 9 === (i % 9)) EFX.add({ k: 'bubble', x: p.x + (Math.random() - 0.5) * p.r * 1.4, y: p.y - 2, vx: 0, vy: -0.4, drag: 0.98, size: 2 + Math.random() * 2, c: '#c070ff', c2: '#ffffff', max: 22 });
	}
	for(let i = 0; i < wildesWorldFX.length; i++){
		const fx = wildesWorldFX[i];
		const u = fx.max ? fx.age / fx.max : 0, fade = u > 0.85 ? (1 - u) / 0.15 : 1;
		const x = (fx.x || 0) - camera.x, y = (fx.y || 0) - camera.y;
		if(fx.kind === 'cloud'){
			// a billowing spore cloud
			const sw = fx.phase === 'swell' ? fx.age / 16 : 1;
			ctx.save(); ctx.globalAlpha = 0.85 * fade;
			for(let k = 0; k < 6; k++){
				const ox = Math.cos(k * 1.05 + fx.age * 0.02) * 34 * sw, oy = Math.sin(k * 1.7 + fx.age * 0.03) * 12 * sw, rr = (30 + (k % 3) * 8) * sw;
				ctx.drawImage(EFX.smokeSprite(k % 2 ? '#b8d860' : '#d8c870'), x + ox - rr, y + oy - rr, rr * 2, rr * 2);
			}
			ctx.restore();
			if(fx.age % 3 === 0) EFX.mote('spore', fx.x + (Math.random() - 0.5) * 80, fx.y + (Math.random() - 0.5) * 20, 0, 0);
			if(fx.phase !== 'swell'){ const aim = wAim(fx.en); EFX.warnCircle(fx.x, wFloor(fx.x, aim.y) - 2, 50, 0.6 + 0.4 * Math.sin(fx.age * 0.2), 'spore', { flat: 0.25, alpha: 0.6 * fade }); }
		} else if(fx.kind === 'rings'){
			const el = fx.tint === 'teal' ? 'glow' : 'spore', P = EFX.pal(el);
			for(let r = 0; r < fx.rings.length; r++){
				const R = fx.rings[r], rr = Math.max(4, R.r);
				ctx.save(); ctx.globalAlpha = fade;
				ctx.lineWidth = 7; ctx.strokeStyle = EFX.rgba(P.outer, 0.45);
				ctx.globalCompositeOperation = 'lighter';
				if(R.gaps){
					ctx.beginPath(); ctx.arc(x, y, rr, R.gapA + R.gapW, R.gapA - R.gapW + Math.PI * 2); ctx.stroke();
					ctx.lineWidth = 2.5; ctx.strokeStyle = EFX.rgba(P.mid, 0.9); ctx.beginPath(); ctx.arc(x, y, rr, R.gapA + R.gapW, R.gapA - R.gapW + Math.PI * 2); ctx.stroke();
				} else {
					ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
					ctx.lineWidth = 2.5; ctx.strokeStyle = EFX.rgba(P.mid, 0.9); ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
				}
				ctx.restore();
			}
		} else if(fx.kind === 'shroom'){
			const grow = fx.stage === 0 ? Math.min(1, fx.age / 16) * 0.35 : (fx.stage === 1 ? 0.35 + (fx.age - 16) / 18 * 0.65 : 1);
			const puff = fx.stage >= 2 ? Math.max(0, 1 - (fx.age % 22) / 6) : 0;
			wDrawMushroom(fx.x, fx.y + 2, 10 + 22 * grow, (9 + 9 * grow) * (1 + puff * 0.15), fade, puff + (fx.stage >= 2 ? 0.4 : 0));
		} else if(fx.kind === 'myco'){
			// glowing fungal threads spreading under the floor
			for(let k = 0; k < fx.lines.length; k++){
				const L = fx.lines[k];
				const pts = [];
				for(let j = 0; j <= 8; j++){ const t = j / 8; pts.push(L.x1 + (L.x2 - L.x1) * t + Math.sin(t * 9 + k) * 4, L.y1 + (L.y2 - L.y1) * t + 2); }
				EFX.crack(pts, 'spore', { width: 2, heat: 0.7 * fade });
			}
		} else if(fx.kind === 'join'){
			const a = 1 - u;
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			EFX.glow(fx.x, fx.y - 6, fx.r * 1.2, '#9ad030', 0.5 * a);
			ctx.restore();
			if(fx.age % 3 === 0) EFX.mote('spore', fx.x + (Math.random() - 0.5) * fx.r, fx.y - 4, 0, -1);
		} else if(fx.kind === 'hand' || fx.kind === 'voidHands'){
			const el = fx.kind === 'voidHands' ? 'rot' : 'nature';
			const spots = fx.spots || [{ x: fx.x, y: fx.y, emerge: 0 }];
			for(let k = 0; k < spots.length; k++){
				const s = spots[k], em = s.emerge || (fx.kind === 'hand' ? 8 : 0);
				if(fx.age < em) EFX.warnCircle(s.x, s.y + 2, 22, fx.age / Math.max(1, em), el, { flat: 0.3 });
				else wDrawHand(s.x, s.y + 2, 34 * Math.min(1, (fx.age - em) / 5), el, fade, fx.age + k);
				if(fx.age === em && em > 0) EFX.debris('earth', s.x, s.y - 2, 3, { speed: 4, floor: s.y + 2 });
			}
		} else if(fx.kind === 'mossCopies'){
			for(let k = 0; k < fx.copies.length; k++){ const c = fx.copies[k]; EFX.ghost(c.x + 15, c.y + 22, 30, 44, 'nature', 0.8 * fade, fx.age + k * 11); }
		} else if(fx.kind === 'mosstrail'){
			if(fx.age === 1) EFX.mote('nature', fx.x, fx.y, 0, 0);
		} else if(fx.kind === 'trails'){
			// the wisp's painted light lines: dim while arming, blazing when live
			const live = fx.on, a = fade;
			ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
			ctx.globalCompositeOperation = 'lighter';
			for(let pass = 0; pass < 2; pass++){
				ctx.beginPath();
				for(let k = 0; k < fx.pts.length; k++){ const P = fx.pts[k]; k ? ctx.lineTo(P.x - camera.x, P.y - camera.y) : ctx.moveTo(P.x - camera.x, P.y - camera.y); }
				ctx.strokeStyle = pass ? 'rgba(255,255,255,' + (live ? 0.9 * a : 0.3) + ')' : 'rgba(72,216,160,' + (live ? 0.55 * a : 0.2) + ')';
				ctx.lineWidth = pass ? (live ? 3 : 1.5) : (live ? 12 : 5);
				if(!live) ctx.setLineDash([6, 8]);
				ctx.stroke(); ctx.setLineDash([]);
			}
			ctx.restore();
		} else if(fx.kind === 'pulse'){
			const rr = fx.r || 20, a = 1 - u;
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			ctx.strokeStyle = 'rgba(200,255,216,' + (0.8 * a) + ')'; ctx.lineWidth = 4;
			ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
			ctx.strokeStyle = 'rgba(72,216,160,' + (0.4 * a) + ')'; ctx.lineWidth = 12;
			ctx.beginPath(); ctx.arc(x, y, rr - 4, 0, Math.PI * 2); ctx.stroke();
			ctx.restore();
		} else if(fx.kind === 'shriek'){
			// expanding sonic wavefronts in a cone
			const wide = 0.22 + fx.len / 420;
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			for(let k = 0; k < 4; k++){
				const rr = fx.len - k * 26;
				if(rr < 10) continue;
				ctx.strokeStyle = 'rgba(200,190,255,' + ((0.75 - k * 0.16) * fade) + ')'; ctx.lineWidth = 4 - k * 0.6;
				ctx.beginPath(); ctx.arc(x, y, rr, fx.ang - wide, fx.ang + wide); ctx.stroke();
			}
			ctx.restore();
		} else if(fx.kind === 'echo'){
			const a = 1 - u;
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			EFX.glowS(x, y, 16, '#9a80ff', 0.6 * a);
			ctx.strokeStyle = 'rgba(220,210,255,' + (0.7 * a) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 8 + fx.age * 0.3, 0, Math.PI * 2); ctx.stroke();
			ctx.restore();
		} else if(fx.kind === 'lash'){
			if(fx.delay && fx.age < fx.delay){
				EFX.warnLine(fx.x, fx.y, fx.x + Math.cos(fx.ang) * fx.r, fx.y + Math.sin(fx.ang) * fx.r, 14, fx.age / fx.delay, 'nature', { alpha: 0.7 });
			} else {
				// a whipping vine: bowed, tapering, with thorns
				const ex = fx.x + Math.cos(fx.ang) * fx.r, ey = fx.y + Math.sin(fx.ang) * fx.r;
				const bow = Math.sin(fx.age * 0.5) * 20 * Math.sign(fx.sweep || 1);
				const mx = (fx.x + ex) / 2 - Math.sin(fx.ang) * bow, my = (fx.y + ey) / 2 + Math.cos(fx.ang) * bow;
				ctx.save(); ctx.globalAlpha = fade; ctx.lineCap = 'round';
				for(let pass = 0; pass < 3; pass++){
					ctx.strokeStyle = ['#1f3d12', '#5aa630', '#c8f080'][pass]; ctx.lineWidth = [9, 6, 1.5][pass];
					ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(mx - camera.x, my - camera.y, ex - camera.x, ey - camera.y); ctx.stroke();
				}
				ctx.restore();
				if(fx.age % 2 === 0) EFX.mote('nature', ex, ey, 0, 0);
			}
		} else if(fx.kind === 'grab'){
			// vines that snap shut, or stay as a thorny fence
			const up = fx.age < 18 ? 0.25 : (fx.snapped || fx.stay ? 1 : 0.25);
			const h = (fx.stay || fx.snapped ? 46 : 16) * Math.min(1, up + fx.age / 40);
			for(let k = -1; k <= 1; k++) if(typeof earthDrawVine === 'function') earthDrawVine(fx.x + k * 5, fx.y + 4, fx.x + k * 9 + Math.sin(fx.age * 0.1 + k) * 3, fx.y - h, 3, fade, fx.age + k);
		} else if(fx.kind === 'canopy'){
			for(let k = 0; k < fx.panels.length; k++){
				const P = fx.panels[k];
				if(P.dropped) continue;
				const shake = fx.age > P.fall - 12 ? Math.sin(fx.age * 1.7 + k) * 2 : 0;
				for(let j = 0; j < 4; j++) wDrawLeaf(P.x + P.w * (0.15 + j * 0.24) + shake, P.y + P.h * 0.5 + (j % 2) * 6, Math.PI / 2 + (j - 1.5) * 0.3, P.h * 0.6, P.h * 0.3, '#1f4a14', '#6ab040', fade);
				EFX.warnRect(P.x, wFloor(P.x + P.w / 2, P.y) - 16, P.w, 16, Math.min(1, fx.age / P.fall), 'nature', { alpha: 0.6 });
			}
		} else if(fx.kind === 'cyclone'){
			// a spinning funnel of wind and leaves
			const sx = x, sy = y;
			ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fade;
			for(let k = 0; k < 6; k++){
				const yy = sy + 34 - k * 14, rr = 14 + k * 7, a0 = fx.age * 0.5 + k;
				ctx.strokeStyle = 'rgba(220,255,245,' + (0.65 - k * 0.06) + ')'; ctx.lineWidth = 2.5;
				ctx.beginPath(); ctx.ellipse(sx + Math.sin(fx.age * 0.2 + k) * 4, yy, rr, rr * 0.3, 0, a0, a0 + 4.2); ctx.stroke();
			}
			EFX.glowS(sx, sy, 50, '#8adcc8', 0.25);
			ctx.restore();
			if(fx.age % 2 === 0) EFX.add({ k: 'leaf', x: fx.x + (Math.random() - 0.5) * 50, y: fx.y + 30 - Math.random() * 70, vx: (Math.random() - 0.5) * 3, vy: -1.5, drag: 0.96, size: 2.6, rot: Math.random() * 6, vr: 0.4, c: '#8edc48', max: 22 });
		} else if(fx.kind === 'shock'){
			const a = 1 - u;
			ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(230,250,255,' + (0.6 * a) + ')'; ctx.lineWidth = 6;
			ctx.beginPath(); ctx.arc(x, y, fx.r, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
		} else if(fx.kind === 'snare'){
			EFX.warnCircle(fx.x, fx.y + 2, 30, fx.erupted ? 1 : (fx.age % 16) / 16, 'rot', { flat: 0.3, alpha: fx.erupted ? 1 - u : 1 });
			if(fx.erupted && fx.age < 80) for(let k = -1; k <= 1; k++) wDrawHand(fx.x + k * 14, fx.y + 2, 40 - Math.abs(k) * 10, 'rot', 1 - (fx.age - 62) / 18, fx.age + k);
			if(fx.age % 3 === 0 && !fx.erupted) EFX.debris('earth', fx.x, fx.y - 2, 1, { speed: 3, floor: fx.y + 2, scale: 0.5 });
		} else if(fx.kind === 'rottrail'){
			if(fx.age === 1){ EFX.debris('earth', fx.x, fx.y - 2, 1, { speed: 3, floor: fx.y + 2, scale: 0.6 }); EFX.mote('rot', fx.x, fx.y - 4, 0, -1); }
		} else if(fx.kind === 'afterimage'){
			if(!fx.fired) EFX.ghost(fx.x + fx.w / 2, fx.y + fx.h / 2, fx.w, fx.h, 'rot', 0.8, fx.age);
		} else if(fx.kind === 'spine'){
			const h = fx.fired ? 20 * (1 - (fx.age - 36) / 54) : 6 + 18 * Math.min(1, fx.age / 30);
			EFX.spike(fx.x, fx.y + 4, h, 9, 'rot', { lean: Math.sin(fx.x) * 0.2, alpha: fade });
		} else if(fx.kind === 'shadowCopies'){
			for(let k = 0; k < fx.copies.length; k++){
				const c = fx.copies[k];
				EFX.ghost(c.x + 14, c.y + 21, 28, 42, 'rot', 0.85 * fade, fx.age + k * 7);
				if(fx.age < c.shot && c.shot - fx.age < 10) EFX.charge(c.x + 14, c.y + 14, 'rot', 26, 1, 8);
			}
		}
	}
	if(typeof enemies !== 'undefined') for(let i = 0; i < enemies.length; i++) drawWildesEnemyFX(enemies[i]);
	if(typeof playerMinions !== 'undefined') for(let i = 0; i < playerMinions.length; i++) drawWildesEnemyFX(playerMinions[i]);
}

function drawWildesEnemyFX(en){
	if(!en || en.dead || !en.wildesKit || !window.EFX) return;
	const kit = en.wildesKit;
	const aim = wAim(en);
	const ecx = en.x + en.w / 2, ecy = en.y + en.h / 2;
	if(kit.kind === 'verdantDrain' || kit.kind === 'corrDrain'){
		const el = kit.kind === 'corrDrain' ? 'rot' : 'nature';
		EFX.beam(ecx, ecy, aim.x, aim.y, 3, el, { alpha: 0.75, speed: -8 });
		if(kit.t % 2 === 0){ EFX.add({ k: 'gather', x: aim.x, y: aim.y, sx: aim.x, sy: aim.y, tx: ecx, ty: ecy, size: 2, c: EFX.pal(el).core, c2: EFX.pal(el).mid, max: 22 }); }
	}
	if(kit.kind === 'lumaBeam'){
		if(kit.t <= 14){ EFX.charge(ecx, ecy, 'glow', 30, 2, 10); EFX.warnLine(ecx, ecy, ecx + Math.cos(kit.ang) * 420, ecy + Math.sin(kit.ang) * 420, 16, kit.t / 14, 'glow', { alpha: 0.6 }); }
		else EFX.beam(ecx, ecy, ecx + Math.cos(kit.ang) * (kit.len || 300), ecy + Math.sin(kit.ang) * (kit.len || 300), 6, 'glow', { speed: 9 });
	}
	if(kit.kind === 'diveBomb' && kit.phase === 'track'){
		EFX.warnCircle(kit.sx, wFloor(kit.sx, en.y), 46, (kit.lock || 0) / 18, 'sonic', { flat: 0.3 });
	}
	if(kit.kind === 'diveBomb' && kit.phase === 'dive'){
		kit.x = ecx; kit.y = ecy; EFX.track(kit, 8); EFX.trail(kit._efxH, 10, 'sonic', { alpha: 0.4 });
	}
	if(kit.kind === 'ceilingDrop' && kit.rocks){
		for(let k = 0; k < kit.rocks.length; k++){
			const r = kit.rocks[k];
			if(r.fallen) continue;
			// stalactites trembling in the dark above their mark
			const sx = r.x + Math.sin(kit.t * 1.3 + k) * (kit.t > r.drop - 10 ? 2 : 0.5);
			EFX.spike(sx, r.y - 214, 26, 16, 'earth', { down: true });
		}
	}
	if(kit.kind === 'darkFade'){
		ctx.save(); ctx.fillStyle = 'rgba(4,0,10,' + Math.min(0.55, kit.t / 30) + ')'; ctx.fillRect(0, 0, canvas.width, canvas.height);
		const ex = aim.x + Math.cos(kit.eyeA) * 80, ey = aim.y + Math.sin(kit.eyeA) * 40;
		ctx.globalCompositeOperation = 'lighter';
		EFX.glow(ex - 8, ey, 10, '#eeff66', 0.8, true); EFX.glow(ex + 8, ey, 10, '#eeff66', 0.8, true);
		ctx.restore();
		if(kit.t > 26) EFX.warnCircle(aim.x, aim.y, 34, (kit.t - 26) / 10, 'rot');
	}
	if(kit.kind === 'wispFlare' && kit.t < 20){
		EFX.charge(ecx, ecy, 'wisp', 50, 2, 12);
		EFX.warnCircle(ecx, ecy, wAtkS(80), kit.t / 20, 'wisp');
	}
	if(kit.kind === 'pressure' && kit.t < 28){
		EFX.warnCircle(ecx, ecy, wAtkS(120), kit.t / 28, 'wind');
	}
	if(kit.kind === 'windGust' && kit.phase === 'push'){
		ctx.save(); ctx.globalCompositeOperation = 'lighter'; EFX.glow(ecx + kit.dir * 30, ecy, 50, '#8adcc8', 0.3); ctx.restore();
	}
	if(kit.kind === 'shellCharge' && kit.t % 2 === 0){
		EFX.add({ k: 'flash', x: ecx, y: ecy, size: en.w * 0.8, c: '#1cc0cc', c2: '#a8fff0', max: 8 });
	}
	if(en._wildesShell){
		ctx.save(); ctx.globalCompositeOperation = 'lighter';
		const R = Math.max(en.w, en.h) * 0.7;
		ctx.strokeStyle = 'rgba(160,255,240,' + (0.45 + 0.25 * Math.sin(kit.t * 0.4)) + ')'; ctx.lineWidth = 2.5;
		ctx.beginPath(); ctx.ellipse(ecx - camera.x, ecy - camera.y, R, R * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
		EFX.glowS(ecx - camera.x, ecy - camera.y, R * 1.2, '#1cc0cc', 0.2);
		ctx.restore();
	}
	if(kit.kind === 'darkBite' || kit.kind === 'shadowDash'){ EFX.ghost(ecx - Math.cos(kit.ang) * 26, ecy, en.w, en.h, 'rot', 0.45, kit.t); }
	if(kit.kind === 'rotTunnel' && kit.phase === 'dig'){
		EFX.warnCircle(kit.tx, kit.ty, 56, kit.t / 28, 'rot', { flat: 0.3 });
	}
}

function wildesKitTryBounce(p){
	if(!p || !(p._wildesHook || p._wildesAccel || p._wildesLeaf)) return false;
	p.vx = -p.vx; p.vy = -Math.abs(p.vy);
	return true;
}
function wildesKitInterceptProj(p){
	if(!p || p.hasHit) return false;
	const pool = (typeof enemies !== 'undefined' ? enemies : []).concat(typeof playerMinions !== 'undefined' ? playerMinions : []);
	for(let i = 0; i < pool.length; i++){
		const en = pool[i];
		if(!en || en.dead || !en._wildesReflect) continue;
		if(circRect(p.x, p.y, 12, en.x - 4, en.y - 4, en.w + 8, en.h + 8)){
			const a = Math.random() * Math.PI * 2;
			p.vx = Math.cos(a) * 11; p.vy = Math.sin(a) * 11;
			if(p.hitTargets && p.hitTargets.add) p.hitTargets.add(en);
			wSpark(p.x, p.y, 8, { r: 80, g: 220, b: 230 });
			return true;
		}
	}
	return false;
}
function wildesKitSpriteRow(en){
	const type = (en && (en.necroType || en.type)) || '';
	if(!WILDES_KIT_TYPES[type]) return null;
	if(en.dead){
		const meta = (typeof SPRITE_SHEET_META !== 'undefined') ? SPRITE_SHEET_META[type] : null;
		return (meta && meta.rows) ? meta.rows - 1 : 3;
	}
	if(en.wildesKit) return 2;
	return null;
}

function registerWildesDungeonCasts(map){
	const casts = {
		castFungusSporeCloud, castFungusToxicBurst, castFungusFungalGrowth, castFungusMycelium,
		castMossMossGrasp, castMossVerdantDrain, castMossDouble, castMossFadeStrike,
		castWispWispBolt, castWispWispFlare, castWispEnchantPulse, castWispLightTrail,
		castBeetleShellCharge, castBeetleLuminanceBeam, castBeetleGlowBurst, castBeetleShellReflect,
		castBatSonicShriek, castBatDiveBomb, castBatEchoBlast, castBatCeilingDrop,
		castVineVineLash, castVineLeafBarrage, castVineVineGrab, castVineCanopyCollapse,
		castSylphCycloneSpin, castSylphAirSlash, castSylphWindGust, castSylphPressureDrop,
		castDarkVoidWhip, castDarkRootSnare, castDarkBlackBloom, castDarkRottingTunnel,
		castDarkWolfBite, castDarkWolfShadowDash, castDarkWolfSpines, castDarkWolfMark,
		castDarkWraithVoidGrasp, castDarkWraithCorrDrain, castDarkWraithCopies, castDarkWraithDarkFade
	};
	for(const k in casts){
		if(typeof window !== 'undefined') window[k] = casts[k];
		if(map) map[k] = casts[k];
	}
}
registerWildesDungeonCasts(typeof CAST_FNS !== 'undefined' ? CAST_FNS : null);

if(typeof window !== 'undefined'){
	window.updateWildesEnemy = updateWildesEnemy;
	window.updateWildesWorld = updateWildesWorld;
	window.drawWildesWorld = drawWildesWorld;
	window.drawWildesKitProj = drawWildesKitProj;
	window.wildesKitTryBounce = wildesKitTryBounce;
	window.wildesKitInterceptProj = wildesKitInterceptProj;
	window.wildesKitSpriteRow = wildesKitSpriteRow;
	window.wildesEnd = wildesEnd;
	window.WILDES_KIT_TYPES = WILDES_KIT_TYPES;
	window.registerWildesDungeonCasts = registerWildesDungeonCasts;
}