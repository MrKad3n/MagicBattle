/* =============================================================
   THE GRAND CHALLENGER — moon raid
   Custom attack FX only. Never uses shared raid projectile shapes.
   ============================================================= */
(function(){
	// Loads in Survival too (the wave-250 fight raises IS_CHALLENGER only while it runs).
	const SURV = typeof IS_SURVIVAL !== 'undefined' && IS_SURVIVAL;
	if(typeof IS_CHALLENGER === 'undefined' || !(IS_CHALLENGER || SURV)) return;

	const FLOOR = CHALLENGER_RAID_CONFIG.arenaBottom;
	const VOID_Y = CHALLENGER_RAID_CONFIG.voidY || 3120;
	const A_L = CHALLENGER_RAID_CONFIG.arenaLeft;
	const A_R = CHALLENGER_RAID_CONFIG.arenaRight;
	const DIRECT = 64;
	const WAVE = 32;
	const CATACLYSM_DMG = 110;
	const T = 1.18; // ~15% slower attack timing
	const SZ = 1.95; // attack visuals / hitboxes
	const VEL = 0.85;
	const ACT_COLS = 8, ACT_ROWS = 4;
	const COLS = 8, ROWS = 4;
	const DEBRIS_SKY = 160;
	const SHOCK_H = 70;
	const ATK_GAP = 45; // ~0.75s between attacks at 60fps

	function F(n){ return Math.round(n * T); }
	function INTRO_X(){ return 1980 + (A_L + A_R) / 2 - 2500; }

	function loadImg(src){
		const im = new Image();
		im.src = src;
		return im;
	}
	function loadSheet(name){
		return loadImg('images/enemies/grand-challenger-' + name + '.png?v=3');
	}
	const SHEETS = {
		'p1-idle-walk': loadSheet('p1-idle-walk'),
		'p1-body': loadSheet('p1-body'),
		'p1-presence': loadSheet('p1-presence'),
		'p1-jump': loadSheet('p1-jump'),
		'p1-slam-land': loadSheet('p1-slam-land'),
		'p1-punch-stand': loadSheet('p1-punch-stand'),
		'p1-punch-float': loadSheet('p1-punch-float'),
		'p1-uppercut': loadSheet('p1-uppercut'),
		'p1-space': loadSheet('p1-space'),
		'p1-arena': loadSheet('p1-arena'),
		'p1-motion': loadSheet('p1-motion'),
		'p2-awaken': loadSheet('p2-awaken'),
		'p2-idle-move': loadSheet('p2-idle-move'),
		'p2-cataclysm': loadSheet('p2-cataclysm'),
		'p2-barrage': loadSheet('p2-barrage'),
		'p2-onehit': loadSheet('p2-onehit'),
		'p2-living': loadSheet('p2-living'),
		'p3-martial': loadSheet('p3-martial'),
		'p3-end': loadSheet('p3-end'),
		'p1-combos': loadSheet('p1-combos'),
		'p2-combos': loadSheet('p2-combos'),
	};
	const ACT = {
		idle:            { sheet:'p1-idle-walk', row:0, n:8, hold:true },
		idleShift:       { sheet:'p1-idle-walk', row:1, n:8, hold:true },
		walk:            { sheet:'p1-idle-walk', row:2, n:8, hold:true },
		heavyWalk:       { sheet:'p1-idle-walk', row:3, n:8, hold:true },
		getUp:           { sheet:'p1-body', row:0, n:8 },
		crouch:          { sheet:'p1-body', row:1, n:8 },
		standFromCrouch: { sheet:'p1-body', row:2, n:8 },
		neckCrack:       { sheet:'p1-body', row:3, n:8 },
		shoulderRoll:    { sheet:'p1-presence', row:0, n:8 },
		beckon:          { sheet:'p1-presence', row:1, n:8 },
		point:           { sheet:'p1-presence', row:2, n:8 },
		stance:          { sheet:'p1-presence', row:3, n:8 },
		crouchJump:      { sheet:'p1-jump', row:0, n:8 },
		jumpAscend:      { sheet:'p1-jump', row:1, n:8 },
		float:           { sheet:'p1-jump', row:2, n:8, hold:true },
		airWindup:       { sheet:'p1-jump', row:3, n:8 },
		slam:            { sheet:'p1-slam-land', row:0, n:8 },
		landStand:       { sheet:'p1-slam-land', row:1, n:8 },
		landCrouch:      { sheet:'p1-slam-land', row:2, n:8 },
		landFloat:       { sheet:'p1-slam-land', row:3, n:8 },
		chargeStand:     { sheet:'p1-punch-stand', row:0, n:8 },
		punch:           { sheet:'p1-punch-stand', row:1, n:8 },
		followStand:     { sheet:'p1-punch-stand', row:2, n:8 },
		jab:             { sheet:'p1-punch-stand', row:3, n:8 },
		chargeFloat:     { sheet:'p1-punch-float', row:0, n:8 },
		punchFloat:      { sheet:'p1-punch-float', row:1, n:8 },
		followFloat:     { sheet:'p1-punch-float', row:2, n:8 },
		cross:           { sheet:'p1-punch-float', row:3, n:8 },
		crouchUnder:     { sheet:'p1-uppercut', row:0, n:8 },
		uppercutLaunch:  { sheet:'p1-uppercut', row:1, n:8 },
		uppercutAir:     { sheet:'p1-uppercut', row:2, n:8 },
		crashDown:       { sheet:'p1-uppercut', row:3, n:8 },
		pointSky:        { sheet:'p1-space', row:0, n:8 },
		spacePunch:      { sheet:'p1-space', row:1, n:8 },
		spaceStand:      { sheet:'p1-space', row:2, n:8 },
		spaceFloat:      { sheet:'p1-space', row:3, n:8 },
		gravCompress:    { sheet:'p1-arena', row:0, n:8 },
		heavyStep:       { sheet:'p1-arena', row:1, n:8 },
		grabGround:      { sheet:'p1-arena', row:2, n:8 },
		liftSlab:        { sheet:'p1-arena', row:3, n:8 },
		flashVanish:     { sheet:'p1-motion', row:0, n:8 },
		flashPunch:      { sheet:'p1-motion', row:1, n:8 },
		dashIn:          { sheet:'p1-motion', row:2, n:8 },
		throwSlab:       { sheet:'p1-motion', row:3, n:8 },
		armorOff:        { sheet:'p2-awaken', row:0, n:8 },
		smileSpeak:      { sheet:'p2-awaken', row:1, n:8 },
		nowFight:        { sheet:'p2-awaken', row:2, n:8 },
		limitSlam:       { sheet:'p2-awaken', row:3, n:8 },
		idleAura:        { sheet:'p2-idle-move', row:0, n:8, hold:true },
		floatIdle:       { sheet:'p2-idle-move', row:1, n:8, hold:true },
		fastWalk:        { sheet:'p2-idle-move', row:2, n:8, hold:true },
		floatDash:       { sheet:'p2-idle-move', row:3, n:8 },
		grabHunk:        { sheet:'p2-cataclysm', row:0, n:8 },
		splitRock:       { sheet:'p2-cataclysm', row:1, n:8 },
		punchPiece:      { sheet:'p2-cataclysm', row:2, n:8 },
		pullBack:        { sheet:'p2-cataclysm', row:3, n:8 },
		leapSpace:       { sheet:'p2-barrage', row:0, n:8 },
		spacePunchDown:  { sheet:'p2-barrage', row:1, n:8 },
		thousandBlur:    { sheet:'p2-barrage', row:2, n:8, hold:true },
		fistBack:        { sheet:'p2-barrage', row:3, n:8 },
		oneStill:        { sheet:'p2-onehit', row:0, n:8, hold:true },
		raiseFist:       { sheet:'p2-onehit', row:1, n:8 },
		tinyCircle:      { sheet:'p2-onehit', row:2, n:8 },
		onePunch:        { sheet:'p2-onehit', row:3, n:8 },
		lookExcited:     { sheet:'p2-living', row:0, n:8 },
		neckFast:        { sheet:'p2-living', row:1, n:8 },
		chargeOverflow:  { sheet:'p2-living', row:2, n:8 },
		landSpaceFloat:  { sheet:'p2-living', row:3, n:8 },
		tiredIdle:       { sheet:'p3-martial', row:0, n:8, hold:true },
		pureIdle:        { sheet:'p3-martial', row:1, n:8, hold:true },
		jabCross:        { sheet:'p3-martial', row:2, n:8 },
		dashPunch:       { sheet:'p3-martial', row:3, n:8 },
		kneel:           { sheet:'p3-end', row:0, n:8 },
		laugh:           { sheet:'p3-end', row:1, n:8 },
		dust:            { sheet:'p3-end', row:2, n:8 },
		dustEmpty:       { sheet:'p3-end', row:3, n:8 },
		walkIntoCrouch:  { sheet:'p1-combos', row:0, n:8 },
		rollBeckon:      { sheet:'p1-combos', row:1, n:8 },
		getUpNeck:       { sheet:'p1-combos', row:2, n:8 },
		jumpIntoWindup:  { sheet:'p1-combos', row:3, n:8 },
		floatDashPunch:  { sheet:'p2-combos', row:0, n:8 },
		excitedNeck:     { sheet:'p2-combos', row:1, n:8 },
		runGrab:         { sheet:'p2-combos', row:2, n:8 },
		chargeOverflowCombo: { sheet:'p2-combos', row:3, n:8 },
	};
	const ACT_PACE = {
		dashIn: 7, flashVanish: 7, flashPunch: 7, floatDash: 7, dashPunch: 7,
		slam: 4, punch: 4, jab: 4, punchFloat: 4, punchPiece: 4, onePunch: 4,
		throwSlab: 5, crashDown: 5, uppercutLaunch: 5, jumpAscend: 5,
		spacePunch: 5, spacePunchDown: 5, limitSlam: 5, jabCross: 5,
		thousandBlur: 4,
		crouchJump: 6, airWindup: 6, landStand: 6, landCrouch: 6,
		followStand: 6, followFloat: 6, landFloat: 6, standFromCrouch: 6,
		crouch: 9, grabGround: 9, liftSlab: 9, grabHunk: 9, splitRock: 8,
		gravCompress: 10, chargeStand: 9, chargeFloat: 9, chargeOverflow: 9,
		pointSky: 9, pullBack: 8, heavyStep: 8, heavyWalk: 8,
		raiseFist: 11, tinyCircle: 10, oneStill: 12,
		neckCrack: 10, beckon: 9, smileSpeak: 10, armorOff: 9, nowFight: 8,
		kneel: 12, laugh: 10, dust: 11, dustEmpty: 12,
		idle: 9, idleShift: 10, idleAura: 10, floatIdle: 11, tiredIdle: 12, pureIdle: 10,
		crouchUnder: 6, uppercutAir: 5, leapSpace: 6, fistBack: 7,
		getUp: 8, point: 8, stance: 9, shoulderRoll: 8,
		walkIntoCrouch: 6, rollBeckon: 7, getUpNeck: 7, jumpIntoWindup: 5,
		floatDashPunch: 5, excitedNeck: 7, runGrab: 6, chargeOverflowCombo: 7,
		lookExcited: 8, neckFast: 7, chargeOverflow: 8, landSpaceFloat: 6,
	};
	const FX = {
		bg: loadImg('images/backgrounds/challenger-moon-bg.png'),
		shock: loadImg('images/fx/challenger-shockwave.png'),
		shockBand: loadImg('images/fx/challenger-shockwave-band.png'),
		shockRing: loadImg('images/fx/challenger-shockwave-ring.png'),
		debris: loadImg('images/fx/challenger-debris.png'),
		gust: loadImg('images/fx/challenger-gust.png'),
		flash: loadImg('images/fx/challenger-flash-impact.png'),
		chunk: loadImg('images/fx/challenger-worldchunk.png'),
		crater: loadImg('images/fx/challenger-crater.png'),
		column: loadImg('images/fx/challenger-uppercut-column.png'),
		circle: loadImg('images/fx/challenger-magic-circle.png'),
		planetOrange: loadImg('images/fx/challenger-planet-orange.png'),
		planetIce: loadImg('images/fx/challenger-planet-ice.png'),
		ring: loadImg('images/fx/challenger-ring-wave.png'),
		fist: loadImg('images/fx/challenger-fist-pulse.png'),
		rock: loadImg('images/fx/challenger-cataclysm-rock.png'),
		rockDebris: loadImg('images/fx/challenger-rock-debris.png'),
		fireDebris: loadImg('images/fx/challenger-debris.png'),
		rockExplode: loadImg('images/fx/challenger-rock-explode.png'),
		fireExplode: loadImg('images/fx/challenger-fire-explode.png'),
		shard: loadImg('images/fx/challenger-shard.png'),
		starfall: loadImg('images/fx/challenger-starfall.png'),
		gravity: loadImg('images/fx/challenger-gravity-field.png'),
		impact: loadImg('images/fx/challenger-punch-impact.png'),
	};

	const hits = [];
	window.__challengerHits = hits;
	window.resetChallengerFx = function(){ hits.length = 0; };

	function ready(img){ return img && img.complete && img.naturalWidth > 0; }

	function knockOutWhite(img){
		if(!ready(img)) return img;
		if(img._clean) return img._clean;
		const c = document.createElement('canvas');
		c.width = img.naturalWidth;
		c.height = img.naturalHeight;
		const x = c.getContext('2d');
		x.drawImage(img, 0, 0);
		const data = x.getImageData(0, 0, c.width, c.height);
		const d = data.data;
		const w = c.width, h = c.height;
		const isPaper = (i) => {
			const r = d[i], g = d[i+1], b = d[i+2], a = d[i+3];
			if(a < 8) return true;
			const avg = (r + g + b) / 3;
			const spread = Math.max(Math.abs(r-g), Math.abs(g-b), Math.abs(r-b));
			return avg > 232 && spread < 22;
		};
		const seen = new Uint8Array(w * h);
		const stack = [];
		const push = (px, py) => {
			if(px < 0 || py < 0 || px >= w || py >= h) return;
			const idx = py * w + px;
			if(seen[idx]) return;
			if(!isPaper(idx * 4)) return;
			seen[idx] = 1;
			stack.push(idx);
		};
		for(let px = 0; px < w; px++){ push(px, 0); push(px, h - 1); }
		for(let py = 0; py < h; py++){ push(0, py); push(w - 1, py); }
		while(stack.length){
			const idx = stack.pop();
			d[idx * 4 + 3] = 0;
			const px = idx % w, py = (idx - px) / w;
			push(px + 1, py); push(px - 1, py); push(px, py + 1); push(px, py - 1);
		}
		x.putImageData(data, 0, 0);
		img._clean = c;
		return c;
	}

	function knockOutBlack(img){
		if(!ready(img)) return img;
		if(img._cleanDark) return img._cleanDark;
		const c = document.createElement('canvas');
		c.width = img.naturalWidth;
		c.height = img.naturalHeight;
		const x = c.getContext('2d');
		x.drawImage(img, 0, 0);
		const data = x.getImageData(0, 0, c.width, c.height);
		const d = data.data;
		const w = c.width, h = c.height;
		for(let i = 0; i < d.length; i += 4){
			const r = d[i], g = d[i+1], b = d[i+2];
			const avg = (r + g + b) / 3;
			if(avg < 22){ d[i+3] = 0; continue; }
			if(avg < 48) d[i+3] = Math.round(d[i+3] * ((avg - 22) / 26));
		}
		x.putImageData(data, 0, 0);
		let minX = w, minY = h, maxX = 0, maxY = 0;
		for(let py = 0; py < h; py++){
			for(let px = 0; px < w; px++){
				if(d[(py * w + px) * 4 + 3] < 12) continue;
				if(px < minX) minX = px;
				if(py < minY) minY = py;
				if(px > maxX) maxX = px;
				if(py > maxY) maxY = py;
			}
		}
		if(maxX > minX && maxY > minY){
			const cw = maxX - minX + 1, ch = maxY - minY + 1;
			const cropped = document.createElement('canvas');
			cropped.width = cw; cropped.height = ch;
			cropped.getContext('2d').drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
			img._cleanDark = cropped;
			return cropped;
		}
		img._cleanDark = c;
		return c;
	}

	function knockOutSheet(img){
		if(!ready(img)) return img;
		if(img._sheetClean) return img._sheetClean;
		const c = document.createElement('canvas');
		c.width = img.naturalWidth;
		c.height = img.naturalHeight;
		const x = c.getContext('2d');
		x.drawImage(img, 0, 0);
		const data = x.getImageData(0, 0, c.width, c.height);
		const d = data.data;
		const w = c.width, h = c.height;
		const isInk = (i) => {
			const r = d[i], g = d[i+1], b = d[i+2], a = d[i+3];
			if(a < 8) return true;
			const avg = (r + g + b) / 3;
			const spread = Math.max(Math.abs(r-g), Math.abs(g-b), Math.abs(r-b));
			return avg < 22 && spread < 16;
		};
		const seen = new Uint8Array(w * h);
		const stack = [];
		const push = (px, py) => {
			if(px < 0 || py < 0 || px >= w || py >= h) return;
			const idx = py * w + px;
			if(seen[idx]) return;
			if(!isInk(idx * 4)) return;
			seen[idx] = 1;
			stack.push(idx);
		};
		for(let px = 0; px < w; px++){ push(px, 0); push(px, h - 1); }
		for(let py = 0; py < h; py++){ push(0, py); push(w - 1, py); }
		while(stack.length){
			const idx = stack.pop();
			d[idx * 4 + 3] = 0;
			const px = idx % w, py = (idx - px) / w;
			push(px + 1, py); push(px - 1, py); push(px, py + 1); push(px, py - 1);
		}
		x.putImageData(data, 0, 0);
		img._sheetClean = c;
		return c;
	}

	function say(text, ms){
		if(typeof showRaidWarning === 'function') showRaidWarning(text, ms || 1800);
	}

	function spawnHit(o){
		const h = Object.assign({
			kind: 'sprite',
			x: 0, y: 0, w: 80, h: 80,
			vx: 0, vy: 0, grav: 0,
			rot: 0, rotSpd: 0,
			age: 0, max: 40,
			dmg: 0, knockY: 0, effects: [],
			pierce: false, hit: false,
			solid: false, landed: false,
			img: null, scale: 1, alpha: 1, face: 1,
			r: 0, vr: 0, thick: 40, gaps: null,
		}, o);
		hits.push(h);
		return h;
	}

	function floorAt(x){
		let best = FLOOR + 40;
		let found = false;
		const shattered = challengerBoss && challengerBoss.arenaShattered;
		for(const plat of sandboxPlatforms){
			if(plat.isWall || plat._gone) continue;
			if(shattered && plat.isFloor) continue;
			if(shattered && !plat._flying && Math.abs(plat.tilt || 0) < 0.07) continue;
			if(x >= plat.x - 8 && x <= plat.x + plat.w + 8){
				if(!found || plat.y < best){ best = plat.y; found = true; }
			}
		}
		return found ? best : FLOOR;
	}

	function inGaps(h, px){
		if(!h.gaps) return false;
		for(const g of h.gaps){
			if(px > g.x && px < g.x + g.w) return true;
		}
		return false;
	}

	function overlapBox(h){
		const hw = (h.w * (h.scale || 1)) / 2;
		const hh = (h.h * (h.scale || 1)) / 2;
		return player.x + player.w > h.x - hw && player.x < h.x + hw &&
			player.y + player.h > h.y - hh && player.y < h.y + hh;
	}

	function applyHit(h){
		if(h.dmg <= 0 || !player || player.iFrames > 0) return;
		if(h.hit && !h.pierce) return;
		let struck = false;
		if(h.kind === 'ring'){
			const pcx = player.x + player.w / 2;
			const dist = Math.abs(pcx - h.x);
			const nearFloor = (player.y + player.h) > h.y - 90;
			if(nearFloor && dist >= h.r - h.thick && dist <= h.r + 12 && !inGaps(h, pcx)) struck = true;
		} else if(h.kind === 'column'){
			const pcx = player.x + player.w / 2;
			if(Math.abs(pcx - h.x) < h.w / 2 && player.y < h.y + h.h / 2 && player.y + player.h > h.y - h.h / 2) struck = true;
		} else if(h.kind === 'gust'){
			const dir = h.face || 1;
			const left = dir > 0 ? h.x : h.x - h.w;
			if(player.x + player.w > left && player.x < left + h.w &&
				player.y + player.h > h.y - h.h / 2 && player.y < h.y + h.h / 2) struck = true;
		} else if(h.kind === 'shock'){
			const left = h.x - h.w / 2;
			const top = h.y - (h.h || SHOCK_H) / 2;
			const bot = h.y + (h.h || SHOCK_H) / 2;
			if(player.x + player.w > left && player.x < left + h.w &&
				player.y + player.h > top && player.y < bot) struck = true;
		} else if(h.kind === 'shockRing'){
			const pcx = player.x + player.w / 2;
			const pcy = player.y + player.h / 2;
			const dist = Math.hypot(pcx - h.x, pcy - h.y);
			if(dist >= h.r - h.thick && dist <= h.r + 14) struck = true;
		} else {
			struck = overlapBox(h);
		}
		if(!struck) return;
		h.hit = true;
		damagePlayer(h.dmg, h.effects || []);
		if(h.knockY) player.vy = Math.min(player.vy, h.knockY);
	}

	function hitBox(x, y, w, h, dmg, effects, knockY){
		if(player.iFrames > 0) return false;
		if(player.x + player.w > x && player.x < x + w && player.y + player.h > y && player.y < y + h){
			damagePlayer(dmg, effects || []);
			if(knockY) player.vy = Math.min(player.vy, knockY);
			return true;
		}
		return false;
	}

	function clearPlayerSpells(){
		for(let i = projectiles.length - 1; i >= 0; i--){
			const p = projectiles[i];
			spawnImpact(p.x, p.y, '#c8e8ff');
			projectiles.splice(i, 1);
		}
	}

	function skyY(){
		return (typeof camera !== 'undefined' ? camera.y : 200) + 36;
	}

	function facePlayer(){
		const pcx = player.x + player.w / 2;
		const bcx = challengerBoss.x + challengerBoss.w / 2;
		challengerBoss.facing = pcx >= bcx ? 1 : -1;
	}

	function walkToward(tx, spd){
		const cx = challengerBoss.x + challengerBoss.w / 2;
		if(Math.abs(tx - cx) < 8){ challengerBoss.vx = 0; return true; }
		challengerBoss.facing = tx > cx ? 1 : -1;
		challengerBoss.vx = challengerBoss.facing * spd;
		return false;
	}

	function setAct(name){
		const b = challengerBoss;
		if(b.act === name) return;
		b.act = name;
		b.anim = name;
		b.spriteFrame = 0;
		b.spriteTimer = 0;
	}

	function actFrameHold(b){
		const act = b.act || 'idle';
		const def = ACT[act] || ACT.idle;
		if(act === 'walk' || act === 'fastWalk' || act === 'heavyWalk'){
			const introWalk = b.inIntro && b.introTimer < F(130);
			const spd = introWalk ? (b._introWalkSpd || 0) : Math.abs(b.vx || 0);
			const n = Math.max(0, Math.min(1, spd / 14));
			return Math.round(17 - n * 11);
		}
		if(ACT_PACE[act] != null) return ACT_PACE[act];
		return def.hold ? 9 : 7;
	}

	function takePlanet(name){
		const b = challengerBoss;
		if(!b.planets[name]) return;
		b.planets[name] = false;
		if(!b.planetTake) b.planetTake = { orange: 0, ice: 0, gas: 0 };
		if(!b.planetSpawn) b.planetSpawn = { orange: 0, ice: 0, gas: 0 };
		b.planetTake[name] = 1;
		b.planetSpawn[name] = 0;
	}

	function restorePlanet(name){
		const b = challengerBoss;
		if(!b || b.planets[name]) return;
		b.planets[name] = true;
		if(!b.planetTake) b.planetTake = { orange: 0, ice: 0, gas: 0 };
		if(!b.planetSpawn) b.planetSpawn = { orange: 0, ice: 0, gas: 0 };
		b.planetTake[name] = 0;
		b.planetSpawn[name] = 1;
	}

	function spawnShockPair(x, extra){
		const y = (extra && extra.y != null) ? extra.y : shockLayerY();
		const spd = 8.4 * VEL;
		const spec = Object.assign({
			kind: 'shock',
			y,
			w: 240,
			h: SHOCK_H,
			max: F(210),
			dmg: WAVE,
			knockY: -8,
			pierce: true,
			img: FX.shockBand,
		}, extra || {});
		spec.y = y;
		spawnHit(Object.assign({}, spec, { x, vx: -spd, face: -1 }));
		spawnHit(Object.assign({}, spec, { x, vx: spd, face: 1 }));
	}

	function spawnBlitzGust(ang){
		const b = challengerBoss;
		const cx = b.x + b.w / 2;
		const cy = b.y + b.h * 0.38;
		const spd = (17 + Math.random() * 8) * VEL;
		spawnHit({
			kind: 'sprite',
			x: cx, y: cy,
			w: 260, h: 112,
			vx: Math.cos(ang) * spd,
			vy: Math.sin(ang) * spd,
			rot: ang,
			face: 1,
			max: F(68),
			dmg: DIRECT,
			img: FX.gust,
			pierce: false,
			knockY: -5,
		});
		spawnHit({
			kind: 'sprite',
			x: cx + Math.cos(ang) * 48, y: cy + Math.sin(ang) * 48,
			w: 150 * SZ * 0.45, h: 150 * SZ * 0.45,
			max: 10, img: FX.impact, dmg: 0,
		});
	}

	function blitzBurst(){
		const spin = Math.random() * Math.PI * 2;
		for(let i = 0; i < 10; i++) spawnBlitzGust(spin + i * (Math.PI / 5));
	}

	function spawnFlashRing(x, y, extra){
		return spawnHit(Object.assign({
			kind: 'shockRing',
			x, y,
			r: 36,
			vr: 9.5 * VEL,
			maxR: 544,
			thick: 46,
			w: 72, h: 72,
			max: F(86),
			dmg: WAVE,
			knockY: -7,
			pierce: true,
			img: FX.shockRing,
		}, extra || {}));
	}

	function attackStillGoing(){
		for(const h of hits){
			if(!h) continue;
			if(h.kind === 'sprite' && h.dmg <= 0) continue;
			return true;
		}
		return false;
	}

	function explodeDebris(h, atY){
		const fl = atY != null ? atY : floorAt(h.x);
		const col = h.fire ? '#ff6a1a' : '#c2b4a4';
		const expR = Math.max(86, (h.w || 52) * 1.65);
		if(typeof activeExplosions !== 'undefined'){
			activeExplosions.push({
				x: h.x, y: fl - 8,
				maxR: expR,
				age: 0, maxAge: 36,
				color: col,
			});
		}
		const fx = h.fire ? ['burn'] : [];
		hitBox(h.x - expR, fl - expR, expR * 2, expR * 2, WAVE, fx, -5);
		if(typeof particles !== 'undefined'){
			const rgb = (typeof hexToRgb === 'function' ? hexToRgb(col) : null) || { r: 194, g: 180, b: 164 };
			const n = 24;
			for(let i = 0; i < n; i++){
				const ang = Math.random() * Math.PI * 2;
				const spd = (3 + Math.random() * 9) * (expR / 80);
				const pcol = i % 3 === 0
					? { r: 255, g: 255, b: 220 }
					: i % 3 === 1
						? { r: Math.min(255, rgb.r + 80), g: Math.min(255, rgb.g + 80), b: Math.min(255, rgb.b + 80) }
						: { r: rgb.r, g: rgb.g, b: rgb.b };
				particles.push({
					x: h.x, y: fl - 8,
					vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 2.5,
					life: Math.round(18 + Math.random() * 18), maxLife: 36,
					r: (2.5 + Math.random() * 5) * (expR / 80),
					color: pcol,
				});
			}
		}
	}

	let _debrisBonus = 0;
	function debrisCount(base){
		const n = Math.max(1, base | 0);
		_debrisBonus += n * 0.15;
		let extra = 0;
		while(_debrisBonus >= 1){ extra++; _debrisBonus -= 1; }
		return n + extra;
	}

	function debrisAimScreen(){
		const ps = challengerPlayerList();
		const p = (ps.length ? ps[Math.floor(Math.random() * ps.length)] : player);
		const vw = (typeof canvas !== 'undefined' ? canvas.width : 1280);
		const vh = (typeof canvas !== 'undefined' ? canvas.height : 720);
		let left, top;
		if(p === player && typeof camera !== 'undefined'){
			left = camera.x;
			top = camera.y;
		} else {
			left = (p.x + (p.w || 32) / 2) - vw / 2;
			top = (p.y + (p.h || 56) / 2) - vh / 2;
		}
		const x = Math.max(A_L + 50, Math.min(A_R - 50, left + 48 + Math.random() * Math.max(80, vw - 96)));
		const y = Math.max(24, top + 12 + Math.random() * 56);
		return { x, y };
	}

	function spawnGroundArcDebris(fire, extraIn){
		const extra = extraIn ? Object.assign({}, extraIn) : {};
		const pos = debrisAimScreen();
		const x = extra.x != null ? extra.x : pos.x;
		delete extra.x;
		const size = extra.w || (68 + Math.random() * 34);
		const fl = floorAt(x);
		const launch = -(12.5 + Math.random() * 12.5);
		const grav = 0.48 + Math.random() * 0.16;
		return spawnDebris(x, fl - size / 2 - 6, fire, Object.assign({
			w: size, h: size,
			vx: (Math.random() - 0.5) * 7.8,
			vy: launch,
			grav,
			rotSpd: (Math.random() - 0.5) * 0.09,
			max: 260,
			skipSpeedMul: true,
			hurtOnDown: true,
		}, extra));
	}

	function spawnPlanetbreakerUpburst(){
		const vw = (typeof canvas !== 'undefined' ? canvas.width : 1280);
		const left = (typeof camera !== 'undefined' ? camera.x : 0);
		const n = debrisCount(8);
		for(let i = 0; i < n; i++){
			const u = (i + 0.2 + Math.random() * 0.6) / n;
			const x = Math.max(A_L + 50, Math.min(A_R - 50, left + 36 + u * Math.max(120, vw - 72)));
			spawnGroundArcDebris(false, { x });
		}
	}

	function spawnScreenDebris(fire, extra){
		const n = debrisCount(1);
		let last = null;
		for(let i = 0; i < n; i++){
			const pos = debrisAimScreen();
			last = spawnDebris(pos.x, pos.y, fire, extra);
		}
		return last;
	}

	function spawnDebris(x, y, fire, extraIn){
		const extra = extraIn ? Object.assign({}, extraIn) : {};
		const speedMul = extra.speedMul || 1;
		const skipSpeedMul = !!extra.skipSpeedMul;
		delete extra.speedMul;
		delete extra.skipSpeedMul;
		function make(xx){
			const size = 68 + Math.random() * 34;
			const h = spawnHit(Object.assign({
				kind: 'debris',
				x: xx, y: y == null ? skyY() + 28 : y,
				w: size, h: size,
				vx: (Math.random() - 0.5) * 0.18 * VEL,
				vy: (0.16 + Math.random() * 0.20) * VEL,
				grav: 0.012,
				rot: Math.random() * 6,
				rotSpd: (Math.random() - 0.5) * 0.035,
				max: 1100,
				dmg: WAVE,
				effects: fire ? ['burn'] : [],
				img: null,
				solid: true,
				pierce: false,
				fire: !!fire,
				seed: Math.random() * 20,
			}, extra));
			if(!skipSpeedMul){
				let mul = 1.4 * 1.8 * 1.5;
				if(fire) mul *= 2.2;
				mul *= speedMul;
				h.vx = (h.vx || 0) * mul;
				h.vy = (h.vy || 0) * mul;
				h.grav = (h.grav || 0) * mul;
			}
			return h;
		}
		const h = make(x);
		if(Math.random() < 0.10){
			make(x + (x > (A_L + A_R) / 2 ? -70 : 70));
		}
		return h;
	}

	function startAtk(name, data){
		challengerBoss.atk = name;
		challengerBoss.atkT = 0;
		challengerBoss.atkData = data || {};
		challengerBoss.anim = 'attack';
		challengerBoss.busyTimer = 9999;
	}

	function endAtk(cd){
		const name = challengerBoss.atk;
		if(name === 'meteorpunch') restorePlanet('orange');
		if(name === 'cataclysm') restorePlanet('ice');
		if(name === 'starfall') restorePlanet('gas');
		challengerBoss.atk = null;
		challengerBoss.atkT = 0;
		challengerBoss.atkData = {};
		challengerBoss.anim = 'idle';
		setAct(challengerBoss.phase >= 3 ? 'tiredIdle' : challengerBoss.phase >= 2 ? 'idleAura' : 'idle');
		challengerBoss.busyTimer = 0;
		challengerBoss.globalCd = cd == null ? ATK_GAP : cd;
		challengerBoss.vx = 0;
	}

	function pickAttack(){
		const b = challengerBoss;
		if(b.phase >= 3) return 'mortal';
		if(b.phase === 2){
			const pool = SURV ? ['starfall', 'thousand', 'onehit', 'mortal', 'blitz'] : ['cataclysm', 'starfall', 'thousand', 'onehit', 'mortal', 'blitz'];   // Survival: no slab-throwing, the room is never broken
			let n = pool[Math.floor(Math.random() * pool.length)];
			if(n === b.lastAttack) n = pool[(pool.indexOf(n) + 1) % pool.length];
			return n;
		}
		const air = (floorAt(player.x + player.w / 2) - (player.y + player.h)) > 180;
		if(air && Math.random() < 0.45) return 'uppercut';
		const pool = SURV ? ['planetbreaker', 'meteorpunch', 'gravitystep', 'flashstep', 'mortal', 'blitz'] : ['planetbreaker', 'meteorpunch', 'gravitystep', 'flashstep', 'mortal', 'worldbreaker', 'blitz'];
		let n = pool[Math.floor(Math.random() * pool.length)];
		if(n === b.lastAttack) n = pool[(pool.indexOf(n) + 1) % pool.length];
		return n;
	}

	function knockUpChallengerPlayers(mult, fromNet){
		const pow = (typeof player !== 'undefined' && player.jumpPow ? player.jumpPow : -20) * (mult == null ? 1 : mult);
		player.vy = Math.min(player.vy, pow);
		player.onGround = false;
		if(!fromNet && typeof CoopSync !== 'undefined') CoopSync.queueEvent('knockup', { m: mult == null ? 1 : mult });
	}
	window.knockUpChallengerPlayers = knockUpChallengerPlayers;

	function challengerPlayerList(){
		const list = [];
		if(typeof player !== 'undefined' && player) list.push(player);
		const al = window.__coopAllies;
		if(al){
			for(const id in al){
				const a = al[id];
				if(a && a.active) list.push(a);
			}
		}
		return list;
	}

	function challengerLayerFeet(){
		if(!challengerBoss || !challengerBoss.arenaShattered) return FLOOR;
		const ps = challengerPlayerList();
		if(!ps.length) return 2460;
		let y = 0, n = 0;
		for(const p of ps){
			const feet = p.y + (p.h || 56);
			if(feet > 2700) continue;
			y += feet;
			n++;
		}
		if(!n) return 2460;
		return Math.max(2200, Math.min(2580, y / n));
	}

	function bossRestY(){
		return challengerLayerFeet() - challengerBoss.h;
	}

	function shockLayerY(){
		return challengerLayerFeet() - SHOCK_H * 0.42 - 34;
	}

	function carryChallengerPlat(plat, dx, dy){
		if(!dx && !dy) return;
		function carryEnt(ent){
			if(!ent) return;
			const w = ent.w || 38, h = ent.h || 56;
			if(ent.x + w > plat.x && ent.x < plat.x + plat.w && ent.y + h > plat.y - 10 && ent.y < plat.y + plat.h + 24){
				ent.x += dx;
				ent.y += dy;
			}
		}
		carryEnt(typeof player !== 'undefined' ? player : null);
		const al = window.__coopAllies;
		if(al){
			for(const id in al){
				if(al[id] && al[id].active) carryEnt(al[id]);
			}
		}
	}

	function vanishThrownPlat(plat){
		if(!plat || plat._gone) return;
		plat._flying = false;
		plat._lifting = false;
		plat._gone = true;
		plat.vx = 0;
		plat.vy = 0;
		plat._flyAge = 0;
		plat._reviveT = 600;
	}

	function tickThrownPlatforms(){
		if(!challengerBoss || !challengerBoss.arenaShattered) return;
		for(const plat of sandboxPlatforms){
			if(!plat._frag) continue;
			if(plat._gone){
				plat._reviveT = (plat._reviveT || 0) - 1;
				if(plat._reviveT <= 0){
					plat._gone = false;
					plat._rising = true;
					plat.x = plat._homeX != null ? plat._homeX : plat.x;
					plat.y = VOID_Y - 40;
					plat.vx = 0;
					plat.vy = 0;
				}
				continue;
			}
			if(plat._rising){
				const ty = plat._homeY != null ? plat._homeY : plat.y;
				plat.y -= 11;
				if(plat.y <= ty){
					plat.y = ty;
					if(plat._homeX != null) plat.x = plat._homeX;
					plat._rising = false;
				}
				continue;
			}
			if(!plat._flying) continue;
			const ox = plat.x, oy = plat.y;
			plat.x += plat.vx || 0;
			plat.y += plat.vy || 0;
			plat._flyAge = (plat._flyAge || 0) + 1;
			carryChallengerPlat(plat, plat.x - ox, plat.y - oy);
			if(typeof player !== 'undefined' && player && player.iFrames <= 0){
				const pad = 26;
				if(player.x + player.w > plat.x - pad && player.x < plat.x + plat.w + pad &&
					player.y + player.h > plat.y - pad && player.y < plat.y + plat.h + pad){
					damagePlayer(plat._throwDmg || CATACLYSM_DMG, []);
				}
			}
			if(plat._flyAge > 100 || plat.x < A_L - 260 || plat.x + plat.w > A_R + 260 || plat.y > VOID_Y || plat.y < 30){
				vanishThrownPlat(plat);
			}
		}
	}

	window.tickChallengerThrownPlatforms = tickThrownPlatforms;
	window.vanishChallengerThrownPlat = vanishThrownPlat;
	window.challengerThrownCanStop = function(p){
		if(!p || !p.isUltimate) return false;
		const ph = p.phase || {};
		return (ph.speed || 0) >= 5 && (ph.width || 0) >= 10 && (ph.height || 0) >= 10;
	};

	function playerOnChalPlat(plat){
		for(const p of challengerPlayerList()){
			const cx = p.x + (p.w || 32) / 2;
			const feet = p.y + (p.h || 56);
			if(cx >= plat.x - 8 && cx <= plat.x + plat.w + 8 && feet >= plat.y - 50 && feet <= plat.y + plat.h + 90) return true;
		}
		return false;
	}

	function pickThrowPlatform(used){
		const frags = sandboxPlatforms.filter(p => p._frag && !p.isWall && !p._gone && !p._flying && !p._lifting && !p._rising && (!used || used.indexOf(p) < 0));
		const empty = frags.filter(p => !playerOnChalPlat(p));
		const pool = empty.length ? empty : frags;
		if(!pool.length) return null;
		return pool[Math.floor(Math.random() * pool.length)];
	}

	function platformUnderX(x, fromY){
		let bestY = Infinity, best = null;
		const shattered = challengerBoss && challengerBoss.arenaShattered;
		for(const plat of sandboxPlatforms){
			if(plat.isWall || plat._gone) continue;
			if(shattered && plat.isFloor) continue;
			if(shattered && !plat._flying && Math.abs(plat.tilt || 0) < 0.07) continue;
			if(x < plat.x - 6 || x > plat.x + plat.w + 6) continue;
			const surf = plat.y + Math.tan(plat.tilt || 0) * (x - plat.x - plat.w / 2);
			if(surf + 8 < fromY) continue;
			if(surf < bestY){ bestY = surf; best = plat; }
		}
		return best ? { plat: best, y: bestY } : null;
	}

	function starfallAroundX(){
		const ps = challengerPlayerList();
		const p = (ps.length ? ps[Math.floor(Math.random() * ps.length)] : player);
		const pcx = p.x + (p.w || 32) / 2;
		const spread = 160 + Math.random() * 340;
		return Math.max(A_L + 70, Math.min(A_R - 70, pcx + (Math.random() - 0.5) * 2 * spread));
	}

	function nearestChallengerPlayer(){
		const ps = challengerPlayerList();
		if(!ps.length) return player;
		const b = challengerBoss;
		const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
		let best = ps[0], bd = Infinity;
		for(const p of ps){
			const d = Math.hypot((p.x + (p.w || 32) / 2) - cx, (p.y + (p.h || 56) / 2) - cy);
			if(d < bd){ bd = d; best = p; }
		}
		return best;
	}

	function shatterArena(opts){
		const silent = !!(opts && opts.silent);
		if(!challengerBoss._platsShattered){
			challengerBoss._platsShattered = true;
			const keepWalls = sandboxPlatforms.filter(p => p.isWall);
			const frags = [];
			const specs = [
				{ x: 380,  y: 2488, w: 440, h: 46, tilt: -0.18, spikes: true },
				{ x: 980,  y: 2360, w: 320, h: 44, tilt: 0.22, spikes: true },
				{ x: 1460, y: 2510, w: 400, h: 48, tilt: -0.16 },
				{ x: 2040, y: 2280, w: 360, h: 42, tilt: -0.18 },
				{ x: 2520, y: 2464, w: 420, h: 50, tilt: 0.17, spikes: true },
				{ x: 3100, y: 2320, w: 320, h: 44, tilt: 0.14, spikes: true },
				{ x: 3580, y: 2496, w: 400, h: 48, tilt: -0.15 },
				{ x: 4120, y: 2390, w: 380, h: 46, tilt: 0.13, spikes: true },
			];
			for(const s of specs){
				const plat = Object.assign({ layer: 'frag', isFloor: false, _frag: true }, s);
				plat.verts = fragmentVerts(plat);
				plat._homeX = plat.x;
				plat._homeY = plat.y;
				frags.push(plat);
				if(!silent) spawnHit({ kind:'sprite', x: plat.x + plat.w/2, y: plat.y, w: plat.w, h: 90, max: 28, img: FX.flash, dmg: 0 });
			}
			sandboxPlatforms.length = 0;
			sandboxPlatforms.push(...frags, ...keepWalls);
			if(!silent){
				shakeScreen(22, 36);
				say('LIMIT RELEASE — THE MOON BREAKS', 2200);
			}
		}
		challengerBoss.arenaShattered = true;
		if(!silent) knockUpChallengerPlayers(1.15);
	}
	window.shatterChallengerArena = shatterArena;

	window.snapChallengerPlatform = function(){
		if(!player) return;
		let best = null, bd = Infinity;
		for(const plat of sandboxPlatforms){
			if(plat.isWall || plat.isFloor || plat._gone) continue;
			if(challengerBoss && challengerBoss.arenaShattered && Math.abs(plat.tilt || 0) < 0.07) continue;
			const dx = Math.abs((player.x + player.w / 2) - (plat.x + plat.w / 2));
			if(dx < bd){ bd = dx; best = plat; }
		}
		if(best){
			const cx = Math.max(best.x + 20, Math.min(best.x + best.w - 20, player.x + player.w / 2));
			player.x = cx - player.w / 2;
			const surf = best.y + Math.tan(best.tilt || 0) * (cx - best.x - best.w / 2);
			player.y = surf - player.h - 2;
			player.vy = 0;
			player.onGround = true;
		}
	};

	function fragmentVerts(p){
		const j = (n) => (Math.sin(p.x * 0.017 + n * 1.7) * 0.5 + 0.5);
		return [
			{ x: 0, y: 4 + j(1) * 8 },
			{ x: p.w * 0.18, y: -6 - j(2) * 10 },
			{ x: p.w * 0.42, y: 2 + j(3) * 6 },
			{ x: p.w * 0.7, y: -8 - j(4) * 8 },
			{ x: p.w, y: 3 + j(5) * 7 },
			{ x: p.w - 8, y: p.h + 18 + j(6) * 16 },
			{ x: p.w * 0.62, y: p.h + 28 + j(7) * 22 },
			{ x: p.w * 0.35, y: p.h + 14 + j(8) * 18 },
			{ x: 6, y: p.h + 20 + j(9) * 14 },
		];
	}

	/* ---------- attacks ---------- */
	function tickPlanetbreaker(){
		const b = challengerBoss, t = b.atkT, d = b.atkData;
		const restY = FLOOR - b.h;
		const apexY = restY - 820;
		if(t === 1){
			say('PLANETBREAKER', 1600);
			facePlayer();
			setAct('crouch');
			d.phase = 'crouch';
			d.landed = false;
		}
		if(t === F(10)) setAct('jumpIntoWindup');
		if(t === F(16) && d.phase === 'crouch'){
			setAct('jumpAscend');
			d.phase = 'rise';
		}
		if(d.phase === 'rise'){
			const span = Math.max(40, restY - apexY);
			const u = Math.max(0, Math.min(1, (b.y - apexY) / span));
			b.vy = -38 * Math.pow(u, 1.35);
			b.y += Math.min(-1.4, b.vy);
			if(u < 0.22) setAct('airWindup');
			if(b.y <= apexY + 8){
				b.y = apexY;
				b.vy = 0;
				d.phase = 'hang';
				d.hangT = 0;
				setAct('airWindup');
			}
		} else if(d.phase === 'hang'){
			d.hangT++;
			b.vy = 0;
			b.y = apexY;
			if(d.hangT >= F(18)){
				d.phase = 'fall';
				setAct('slam');
				b.vy = 8;
			}
		} else if(d.phase === 'fall'){
			setAct('slam');
			b.y += b.vy;
			b.vy += 1.65;
			if(b.y >= restY){
				b.y = restY;
				b.vy = 0;
				d.phase = 'land';
				d.landT = t;
				d.landed = true;
				shakeScreen(28, 50);
				spawnHit({ kind:'sprite', x: b.x + b.w/2, y: FLOOR, w: 420 * SZ, h: 220 * SZ, max: 40, img: FX.crater, dmg: 0 });
				spawnShockPair(b.x + b.w/2, { knockY: -12 });
				knockUpChallengerPlayers(1);
				spawnPlanetbreakerUpburst();
				challengerBoss.horizonCrack = Math.min(1, (challengerBoss.horizonCrack || 0) + 0.35);
				setAct('slam');
			}
		} else if(d.phase === 'land'){
			const since = t - (d.landT || t);
			if(since === F(10)) setAct('landStand');
			if(since === F(42)) spawnShockPair(b.x + b.w/2, { knockY: -6 });
			if(since === F(84)) spawnShockPair(b.x + b.w/2, { knockY: -6 });
			if(since > 0 && since <= F(140) && since % 16 === 0){
				spawnGroundArcDebris(false);
			}
			if(since > F(160)) endAtk();
		}
	}

	function tickUppercut(){
		const b = challengerBoss, t = b.atkT;
		const pcx = player.x + player.w / 2;
		if(t === 1){
			say('CELESTIAL UPPERCUT', 1400);
			setAct('dashIn');
			addRaidIndicator(pcx - 70, skyY(), 140, FLOOR - skyY(), F(42), 'rgba(180,220,255,0.35)', 'rect');
		}
		if(t < F(26)){
			setAct('crouchUnder');
			b.x += (pcx - b.w/2 - b.x) * 0.32;
			b.y += ((FLOOR - 18) - b.h - b.y) * 0.36;
		}
		if(t === F(26)){
			spawnHit({ kind:'sprite', x: b.x + b.w/2, y: FLOOR - 8, w: 280 * SZ, h: 280 * SZ, max: 30, img: FX.circle, dmg: 0 });
		}
		if(t === F(34)){
			setAct('uppercutLaunch');
			b.vy = -22 * VEL;
			const cx = b.x + b.w/2;
			spawnHit({
				kind:'column', x: cx, y: FLOOR/2, w: 170 * SZ, h: FLOOR - 80,
				max: F(36), dmg: DIRECT, img: FX.column, pierce: true,
			});
			hitBox(cx - 40 * SZ, 80, 80 * SZ, FLOOR - 100, DIRECT, [], -4);
			shakeScreen(16, 22);
		}
		if(t > F(34) && t < F(82)){
			setAct('uppercutAir');
			b.y += b.vy;
			b.vy += 0.72;
			if(b.y > FLOOR - b.h){ b.y = FLOOR - b.h; b.vy = 0; setAct('crashDown'); }
		}
		if(t === F(80)){
			setAct('landCrouch');
			spawnHit({ kind:'sprite', x: b.x + b.w/2, y: FLOOR, w: 360 * SZ, h: 160 * SZ, max: 24, img: FX.crater, dmg: 0 });
			hitBox(b.x - 40, FLOOR - 80, b.w + 80, 80, WAVE, [], -6);
		}
		if(t === F(92)) setAct('standFromCrouch');
		if(t > F(108)) endAtk();
	}

	function tickMeteorPunch(){
		const b = challengerBoss, t = b.atkT;
		if(t === 1){
			facePlayer();
			setAct('stance');
			say('…', 700);
			takePlanet('orange');
		}
		if(t === F(16)) setAct('pointSky');
		if(t === F(36)) setAct('chargeStand');
		if(t === F(52)){
			setAct('spacePunch');
			spawnHit({
				kind:'fist', x: b.x + b.w/2 + b.facing * 60, y: b.y + 28,
				w: 260 * SZ, h: 130 * SZ, vx: b.facing * 18 * VEL, max: F(26), img: FX.fist, dmg: 0, face: b.facing,
			});
		}
		if(t === F(64)) setAct('followStand');
		if(t === F(106)){
			say('METEOR PUNCH', 1600);
			shakeScreen(10, 16);
		}
		if(t >= F(118) && t <= F(250) && t % 22 === 0){
			const size = (118 + Math.random() * 44) * 1.2;
			spawnScreenDebris(true, {
				w: size, h: size,
				vy: (0.08 + Math.random() * 0.10) * VEL,
				grav: 0.008,
				vx: (Math.random() - 0.5) * 0.10 * VEL,
			});
		}
		if(t > F(320)) endAtk();
	}

	function tickBlitz(){
		const b = challengerBoss, t = b.atkT, d = b.atkData;
		const p2 = b.phase >= 2 && b.arenaShattered;
		const restY = FLOOR - b.h;
		function hoverY(){
			if(p2) return Math.max(140, challengerLayerFeet() - b.h - 400);
			return restY - 540;
		}
		if(t === 1){
			say('BLITZ', 1400);
			facePlayer();
			setAct('crouch');
			d.landed = false;
			d.voidDive = false;
		}
		if(t === F(8)) setAct('crouchJump');
		if(t === F(16)){
			setAct('jumpAscend');
			b.vy = -28;
		}
		if(t > F(16) && t < F(46)){
			setAct(t < F(28) ? 'jumpAscend' : 'float');
			b.y += b.vy;
			b.vy += 0.38;
			if(b.y <= hoverY()){ b.y = hoverY(); b.vy = 0; }
		}
		if(t >= F(46) && t < F(186) && !d.landed && !d.voidDive){
			const hy = hoverY();
			b.y += (hy + Math.sin(t * 0.22) * 18 - b.y) * 0.16;
			const tx = player.x + player.w / 2 - b.w / 2;
			b.x += (tx - b.x) * 0.05;
			b.x = Math.max(A_L + 40, Math.min(A_R - b.w - 40, b.x));
			if(t === F(46) || t === F(82) || t === F(118) || t === F(154)){
				setAct('floatDashPunch');
				blitzBurst();
				shakeScreen(8, 10);
			} else if(t % 4 === 0){
				const ang = Math.random() * Math.PI * 2;
				b.facing = Math.cos(ang) >= 0 ? 1 : -1;
				setAct(t % 8 === 0 ? 'punchFloat' : 'cross');
				spawnBlitzGust(ang);
			}
		}
		if(t === F(186) && !d.landed && !d.voidDive){
			setAct('slam');
			b.vy = 14;
		}
		if(t > F(186) && !d.landed && !d.voidDive){
			setAct('crashDown');
			b.y += b.vy;
			b.vy += 1.85;
			const under = platformUnderX(b.x + b.w / 2, b.y + b.h - 20);
			const landY = under ? under.y - b.h : (p2 ? null : restY);
			if(landY != null && b.y >= landY){
				b.y = landY;
				b.vy = 0;
				d.landed = true;
				d.landT = t;
				setAct('slam');
				shakeScreen(22, 36);
				const hitY = under ? under.y : FLOOR;
				spawnHit({ kind:'sprite', x: b.x + b.w/2, y: hitY, w: 420 * SZ, h: 220 * SZ, max: 36, img: FX.crater, dmg: 0 });
				spawnShockPair(b.x + b.w/2, { knockY: -10, y: hitY - SHOCK_H * 0.42 - 34 });
			} else if(p2 && !under && b.y > challengerLayerFeet() + 40){
				d.voidDive = true;
				setAct('crashDown');
			}
		}
		if(d.voidDive && !d.landed){
			setAct('crashDown');
			b.y += Math.max(18, b.vy);
			b.vy += 2.4;
			if(b.y + b.h > VOID_Y - 80){
				spawnHit({ kind:'sprite', x: b.x + b.w/2, y: b.y + b.h/2, w: 320 * SZ, h: 320 * SZ, max: 16, img: FX.flash, dmg: 0 });
				const px = player.x + player.w / 2;
				const dest = platformUnderX(px, player.y + player.h - 40) || platformUnderX(b.x + b.w / 2, 200);
				if(dest){
					b.x = dest.plat.x + dest.plat.w / 2 - b.w / 2;
					b.y = dest.y - b.h;
				} else {
					b.y = bossRestY();
				}
				spawnHit({ kind:'sprite', x: b.x + b.w/2, y: b.y + b.h/2, w: 360 * SZ, h: 360 * SZ, max: 18, img: FX.flash, dmg: 0 });
				setAct('flashVanish');
				d.voidDive = false;
				d.landed = true;
				d.landT = t;
				shakeScreen(16, 22);
			}
			if(t > F(280)){
				d.voidDive = false;
				d.landed = true;
				d.landT = t;
				b.y = bossRestY();
			}
		}
		if(d.landed){
			if(t - d.landT === F(8)) setAct('landStand');
			if(t - d.landT > F(28)) endAtk();
		}
	}

	function tickGravityStep(){
		const b = challengerBoss, d = b.atkData, t = b.atkT;
		if(t === 1){
			say('GRAVITY STEP', 1600);
			b.gravityField = true;
			setAct('gravCompress');
			d.dir = (player.x + player.w/2) > (b.x + b.w/2) ? 1 : -1;
			b.facing = d.dir;
			d.steps = [F(38), F(94), F(150), F(206)];
		}
		if(t === F(20)) setAct('heavyWalk');
		b.vx = d.dir * 2.05 * VEL;
		if(d.steps && d.steps.includes(t)){
			setAct('heavyStep');
			const cx = b.x + b.w/2;
			spawnShockPair(cx, { knockY: -4 });
			shakeScreen(20, 26);
		}
		if(b.x < A_L + 40){ b.x = A_L + 40; d.dir = 1; b.facing = 1; }
		if(b.x + b.w > A_R - 40){ b.x = A_R - 40 - b.w; d.dir = -1; b.facing = -1; }
		if(t > F(250)){
			b.gravityField = false;
			b.vx = 0;
			endAtk();
		}
	}

	function tickFlashstep(){
		const b = challengerBoss, d = b.atkData, t = b.atkT;
		if(t === 1){
			say('FLASHSTEP', 1400);
			setAct('flashVanish');
			d.slots = [];
			const slotW = (A_R - A_L) / 12;
			const hitsSet = new Set();
			while(hitsSet.size < 7){
				const n = 1 + Math.floor(Math.random() * 10);
				hitsSet.add(n);
			}
			for(const n of hitsSet){
				const delay = F(78 + d.slots.length * 18);
				d.slots.push({ x: A_L + n * slotW, w: slotW * 0.78, delay });
				addRaidIndicator(A_L + n * slotW + 8, FLOOR - 220, slotW * 0.78, 220, delay + F(6), 'rgba(200,230,255,0.4)', 'rect');
			}
			b.hidden = true;
		}
		for(const s of d.slots){
			if(t === s.delay){
				setAct('flashPunch');
				spawnHit({ kind:'sprite', x: s.x + s.w/2, y: FLOOR - 90, w: 260 * SZ, h: 260 * SZ, max: 18, img: FX.flash, dmg: 0 });
				spawnHit({ kind:'sprite', x: s.x + s.w/2, y: FLOOR - 50, w: 200 * SZ, h: 200 * SZ, max: 16, img: FX.impact, dmg: DIRECT });
			}
			if(t === s.delay + F(8)){
				spawnFlashRing(s.x + s.w/2, FLOOR - 50, { knockY: -6 });
			}
		}
		const lastDelay = d.slots.length ? d.slots[d.slots.length - 1].delay : F(78);
		if(t === lastDelay + F(14)){
			b.hidden = false;
			setAct('landStand');
			b.x = player.x + player.w/2 - b.w/2 + (Math.random() < 0.5 ? -180 : 180);
			b.x = Math.max(A_L + 40, Math.min(A_R - b.w - 40, b.x));
			b.y = FLOOR - b.h;
			shakeScreen(14, 18);
		}
		if(t > lastDelay + F(100)) endAtk();
	}

	function tickMortal(){
		const b = challengerBoss, d = b.atkData, t = b.atkT;
		const spd = b.phase >= 3 ? 1.1 : 1;
		const combo = b.phase >= 3 ? 5 : 4;
		function markTarget(){
			const p = nearestChallengerPlayer();
			d.targetX = p.x + (p.w || 32) / 2;
			d.targetY = Math.max(80, Math.min((b.arenaShattered ? VOID_Y - 240 : FLOOR) - b.h, (p.y + (p.h || 56)) - b.h));
		}
		function chaseY(rate){
			markTarget();
			b.y += (d.targetY - b.y) * (rate == null ? 0.22 : rate);
		}
		if(t === 1){
			if(!b.saidStand){
				say('You. Stand.', 2200);
				b.saidStand = true;
			} else {
				say('MORTAL CHALLENGE', 1600);
			}
			b.markedPlayer = true;
			setAct('point');
			facePlayer();
			markTarget();
			d.mode = 'startup';
			d.hits = 0;
			d.wait = 0;
			b.vx = 0;
		}
		if(d.mode === 'startup'){
			b.vx = 0;
			chaseY(0.12);
			if(t === F(16)) setAct(b.phase >= 3 ? 'pureIdle' : 'stance');
			if(t >= F(64)){
				d.mode = 'dash';
				markTarget();
				facePlayer();
				setAct('dashIn');
			}
			return;
		}
		if(d.mode === 'dash'){
			setAct('dashIn');
			markTarget();
			const cx = b.x + b.w / 2;
			b.facing = d.targetX >= cx ? 1 : -1;
			b.vx = b.facing * 45 * spd;
			b.x = Math.max(A_L + 20, Math.min(A_R - b.w - 20, b.x));
			chaseY(0.28);
			const ncx = b.x + b.w / 2;
			const passed = (b.facing > 0 && ncx >= d.targetX - 40) || (b.facing < 0 && ncx <= d.targetX + 40);
			const closeX = Math.abs(ncx - d.targetX) < 120 || passed;
			const closeY = Math.abs(b.y - d.targetY) < 70;
			if(closeX && closeY){
				d.mode = 'brake';
				d.wait = 0;
				b.vx = b.facing * 4;
				setAct('chargeStand');
			} else if(closeX && !closeY){
				b.vx *= 0.35;
			}
			return;
		}
		if(d.mode === 'brake'){
			b.vx *= 0.62;
			if(Math.abs(b.vx) < 0.8) b.vx = 0;
			chaseY(0.2);
			d.wait++;
			if(d.wait === 1) setAct(b.phase >= 3 ? 'dashPunch' : 'chargeStand');
			if(d.wait >= F(39)){
				d.mode = 'punch';
			}
			return;
		}
		if(d.mode === 'punch'){
			facePlayer();
			chaseY(0.35);
			const acts = b.phase >= 3 ? ['jabCross', 'dashPunch', 'jab', 'cross'] : ['punch', 'jab', 'cross', 'chargeStand'];
			setAct(acts[d.hits % acts.length]);
			const cx = b.x + b.w / 2, cy = b.y + 40;
			const dir = b.facing;
			spawnHit({
				kind:'fist', x: cx + dir * 50, y: cy, w: 240 * SZ, h: 120 * SZ,
				vx: dir * 9 * spd * VEL, max: F(40), dmg: DIRECT, img: FX.fist, face: dir, pierce: true,
			});
			hitBox(cx + dir * 10, b.y, 100, b.h, DIRECT, []);
			shakeScreen(6, 8);
			d.hits++;
			const air = (floorAt(player.x + player.w/2) - (player.y + player.h)) > 180;
			if(air && b.phase < 2 && d.hits >= 2){
				endAtk(F(8));
				startAtk('uppercut', {});
				return;
			}
			if(d.hits >= combo){
				d.mode = 'done';
				d.wait = 0;
				setAct(b.phase >= 3 ? 'pureIdle' : 'stance');
			} else {
				d.mode = 'dash';
				markTarget();
				setAct('dashIn');
			}
			return;
		}
		if(d.mode === 'done'){
			b.vx = 0;
			d.wait++;
			if(d.wait > F(16)) endAtk();
		}
	}

	function crashWorldChunk(h){
		h.crashed = true;
		if(challengerBoss.atkData) challengerBoss.atkData.crashT = challengerBoss.atkT;
		const cx = h.x;
		shakeScreen(28, 50);
		spawnHit({ kind:'sprite', x: cx, y: FLOOR, w: 620 * SZ * 1.26, h: 280 * SZ * 1.26, max: 44, img: FX.crater, dmg: 0 });
		spawnShockPair(cx, { knockY: -12 });
		hitBox(cx - 520, FLOOR - 380, 1040, 420, DIRECT, [], -10);
		challengerBoss.horizonCrack = Math.min(1, (challengerBoss.horizonCrack || 0) + 0.45);
		if(typeof particles !== 'undefined'){
			for(let i = 0; i < 36; i++){
				const ang = Math.random() * Math.PI * 2;
				const spd = 4 + Math.random() * 12;
				particles.push({
					x: cx, y: FLOOR - 12,
					vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 3,
					life: 28 + Math.random() * 22, maxLife: 50,
					r: 3 + Math.random() * 6,
					color: { r: 200, g: 180, b: 150 },
				});
			}
		}
	}

	function tickWorldbreaker(){
		const b = challengerBoss, t = b.atkT, d = b.atkData;
		const restY = FLOOR - b.h;
		if(t === 1){
			say('WORLDBREAKER', 1600);
			setAct('crouch');
			facePlayer();
			challengerBoss.horizonCrack = 1;
		}
		if(t === F(28)) setAct('grabGround');
		if(t < F(90)){
			b.y = restY + Math.sin(t * 0.28) * 7;
		}
		if(t === F(86)) setAct('liftSlab');
		if(t >= F(90) && t < F(155)){
			setAct(t < F(118) ? 'liftSlab' : 'float');
			const floatY = restY - 420;
			b.y += (floatY - b.y) * 0.11;
		}
		if(t === F(155)){
			setAct('throwSlab');
			facePlayer();
			const dir = b.facing;
			const chunkW = Math.round(1152 * 0.7);
			const chunkH = Math.round(504 * 0.7);
			const sx = b.x + b.w / 2 + dir * 70;
			const sy = b.y + 8;
			const tx = Math.max(A_L + 180, Math.min(A_R - 180, player.x + player.w / 2));
			const landY = FLOOR - 40;
			const flight = F(108);
			const g = 0.46;
			const vx = (tx - sx) / flight;
			const vy = (landY - sy) / flight - 0.5 * g * flight - 10;
			d.landX = tx;
			addRaidIndicator(tx - 227, FLOOR - 302, 454, 302, flight, 'rgba(255,180,80,0.38)', 'rect');
			d.chunk = spawnHit({
				kind:'chunk', x: sx, y: sy,
				w: chunkW, h: chunkH,
				vx, vy, grav: g,
				rot: 0, rotSpd: dir * 0.04,
				max: flight + F(20),
				dmg: DIRECT, img: FX.chunk,
				face: dir, pierce: false, knockY: -8,
				solid: false,
			});
			shakeScreen(14, 18);
		}
		if(t === F(200)) setAct('followStand');
		if(d.crashT && t - d.crashT > F(28)) endAtk();
		if(t > F(340)) endAtk();
	}

	function tickCataclysm(){
		const b = challengerBoss, d = b.atkData, t = b.atkT;
		if(t === 1){
			say('PLANETARY CATACLYSM', 1800);
			setAct('grabHunk');
			takePlanet('ice');
			d.throws = 0;
			d.used = [];
			d.phase = 'pick';
		}
		if(d.phase === 'pick'){
			const plat = pickThrowPlatform(d.used);
			if(!plat){
				d.phase = 'end';
				d.endT = t;
				setAct('pullBack');
			} else {
				d.plat = plat;
				d.used.push(plat);
				d.phase = 'dash';
				d.dashT = 0;
				setAct('runGrab');
			}
		}
		if(d.phase === 'dash'){
			d.dashT++;
			const plat = d.plat;
			const tx = plat.x + plat.w / 2 - b.w / 2;
			const ty = plat.y - b.h - 10;
			b.facing = (plat.x + plat.w / 2) >= (b.x + b.w / 2) ? 1 : -1;
			b.x += (tx - b.x) * 0.32;
			b.y += (ty - b.y) * 0.32;
			if(d.dashT > 12 || (Math.abs(tx - b.x) < 16 && Math.abs(ty - b.y) < 16)){
				b.x = tx;
				b.y = ty;
				d.phase = 'grab';
				d.grabT = 0;
				d.grabPlatY = plat.y;
				d.grabBossY = b.y;
				plat._lifting = true;
				setAct('grabHunk');
				const tgt = nearestChallengerPlayer();
				const tw = Math.max(plat.w + 80, 420);
				const th = Math.max(280, plat.h + 220);
				addRaidIndicator(tgt.x + (tgt.w || 32) / 2 - tw / 2, tgt.y + (tgt.h || 56) / 2 - th / 2, tw, th, 50, 'rgba(255,70,30,0.62)', 'rect');
				addRaidIndicator(plat.x - 30, plat.y - 120, plat.w + 60, plat.h + 220, 50, 'rgba(255,200,70,0.55)', 'rect');
			}
		}
		if(d.phase === 'grab'){
			d.grabT++;
			const plat = d.plat;
			if(d.grabT === 8) setAct('splitRock');
			const lift = Math.min(130, d.grabT * 7);
			const ny = d.grabPlatY - lift;
			carryChallengerPlat(plat, 0, ny - plat.y);
			plat.y = ny;
			b.y = d.grabBossY - lift;
			if(d.grabT >= 28){
				setAct('punchPiece');
				plat._lifting = false;
				plat._flying = true;
				plat._flyAge = 0;
				plat._throwDmg = CATACLYSM_DMG;
				const tgt = nearestChallengerPlayer();
				const cx = plat.x + plat.w / 2;
				const cy = plat.y + plat.h / 2;
				const tcx = tgt.x + (tgt.w || 32) / 2;
				const tcy = tgt.y + (tgt.h || 56) / 2;
				const dist = Math.max(40, Math.hypot(tcx - cx, tcy - cy));
				const spd = 34;
				plat.vx = (tcx - cx) / dist * spd;
				plat.vy = (tcy - cy) / dist * spd;
				spawnHit({ kind:'sprite', x: b.x + b.w / 2 + b.facing * 40, y: b.y + 24, w: 170 * SZ, h: 170 * SZ, max: 14, img: FX.impact, dmg: CATACLYSM_DMG, pierce: true, knockY: -6 });
				shakeScreen(10, 14);
				d.phase = 'watch';
				d.watchT = 0;
			}
		}
		if(d.phase === 'watch'){
			d.watchT++;
			if(d.watchT > 24){
				d.throws++;
				if(d.throws >= 3){
					d.phase = 'end';
					d.endT = t;
					setAct('followStand');
				} else {
					d.phase = 'pick';
				}
			}
		}
		if(d.phase === 'end' && t - (d.endT || t) > 22) endAtk();
		if(t > 900) endAtk();
	}

	function tickStarfall(){
		const b = challengerBoss, t = b.atkT;
		if(t === 1){
			say('STARFALL BARRAGE', 1600);
			setAct('crouchJump');
			takePlanet('gas');
		}
		if(t === F(14)){
			setAct('leapSpace');
			b.hidden = true;
			b.y = 80;
		}
		if(t >= F(24) && t < F(430)){
			setAct('spacePunchDown');
			const pace = Math.max(F(7), F(14) - Math.floor(t / 50));
			if(t % pace === 0){
				const n = 4 + (Math.random() < 0.45 ? 1 : 0);
				for(let i = 0; i < n; i++){
					const tx = starfallAroundX();
					addRaidIndicator(tx - 46, DEBRIS_SKY, 92, FLOOR - DEBRIS_SKY, pace + 8, 'rgba(255,140,60,0.42)', 'rect');
					spawnDebris(tx, DEBRIS_SKY, true, { speedMul: 1.8 });
				}
			}
		}
		if(t === F(448)){
			b.hidden = false;
			setAct('landSpaceFloat');
			b.x = Math.max(A_L+40, Math.min(A_R-b.w-40, player.x - 40));
			b.y = bossRestY();
		}
		if(t > F(490)) endAtk();
	}

	function tickThousand(){
		const b = challengerBoss, d = b.atkData, t = b.atkT;
		const PUNCHES = 80;
		const SPAN = 600;
		const WIND = 90;
		if(t === 1){
			say('THOUSAND-FIST ASCENSION', 1800);
			setAct('floatDash');
			b.hidden = true;
			d.hits = [];
			d.showUntil = 0;
			for(let i = 0; i < PUNCHES; i++){
				const tInd = 8 + Math.round(i * (SPAN / PUNCHES));
				const x = A_L + 100 + Math.random() * (A_R - A_L - 200);
				const y = 160 + Math.random() * 2360;
				d.hits.push({ x, y, tInd, tHit: tInd + WIND, ring: Math.random() < 0.8, doneInd: false, doneHit: false });
			}
		}
		if(t === 8) setAct('thousandBlur');
		if(t > (d.showUntil || 0) && t < 8 + SPAN + WIND) b.hidden = true;
		for(const h of d.hits){
			if(!h.doneInd && t >= h.tInd){
				h.doneInd = true;
				addRaidIndicator(h.x - 70, h.y - 70, 140, 140, WIND, 'rgba(220,240,255,0.45)', 'rect');
			}
			if(!h.doneHit && t >= h.tHit){
				h.doneHit = true;
				b.hidden = false;
				d.showUntil = t + 6;
				b.x = Math.max(A_L + 20, Math.min(A_R - b.w - 20, h.x - b.w / 2));
				b.y = h.y - b.h * 0.55;
				setAct('onePunch');
				spawnHit({ kind:'sprite', x: h.x, y: h.y, w: 240 * SZ, h: 240 * SZ, max: 12, img: FX.flash, dmg: 0 });
				spawnHit({ kind:'sprite', x: h.x, y: h.y, w: 180 * SZ, h: 180 * SZ, max: 10, img: FX.impact, dmg: DIRECT, knockY: -8 });
				if(h.ring) spawnFlashRing(h.x, h.y, { knockY: -6, maxR: 435, thick: 37 });
				else spawnShockPair(h.x, { y: h.y, knockY: -6 });
				shakeScreen(4, 6);
			}
		}
		const last = 8 + SPAN + WIND + 18;
		if(t === last){
			b.hidden = false;
			setAct('fistBack');
			b.x = Math.max(A_L + 30, Math.min(A_R - b.w - 30, player.x + player.w / 2 - b.w / 2));
			b.y = bossRestY();
			say('…', 800);
		}
		if(t > last + 26) endAtk();
	}

	function tickOneHit(){
		const b = challengerBoss, t = b.atkT, d = b.atkData;
		const CHARGE = 120; // 2 seconds at 60fps
		if(t === 1){
			b.aura = 0;
			setAct('oneStill');
			say('[ MOVE ]', 1800);
			const tgt = nearestChallengerPlayer();
			const px = tgt.x + (tgt.w || 32) / 2;
			const py = tgt.y + (tgt.h || 56) / 2;
			const bx = b.x + b.w / 2;
			const by = b.y + b.h * 0.38;
			const ang = Math.atan2(py - by, px - bx);
			d.aimAng = ang;
			d.dir = Math.cos(ang) >= 0 ? 1 : -1;
			d.originX = bx;
			d.originY = by;
			b.facing = d.dir;
			const len = 2200;
			spawnHit({
				kind: 'beamTele',
				x: bx, y: by,
				w: 36, h: 36,
				ang, len,
				max: CHARGE,
				dmg: 0,
			});
		}
		if(t === 18) setAct('raiseFist');
		if(t === 36){
			setAct('tinyCircle');
			spawnHit({
				kind:'sprite',
				x: b.x + b.w / 2 + Math.cos(d.aimAng) * 36,
				y: b.y + b.h * 0.38 + Math.sin(d.aimAng) * 36,
				w: 70, h: 70, max: CHARGE - 36, img: FX.circle, dmg: 0,
			});
		}
		if(t > 36 && t < CHARGE){
			setAct('tinyCircle');
			const u = (t - 36) / (CHARGE - 36);
			b.aura = u * 0.6;
		}
		if(t === CHARGE){
			setAct('onePunch');
			const ang = d.aimAng;
			const spd = 26;
			const ox = b.x + b.w / 2 + Math.cos(ang) * 40;
			const oy = b.y + b.h * 0.38 + Math.sin(ang) * 40;
			spawnHit({
				kind: 'onehit',
				x: ox, y: oy,
				w: 220, h: 95,
				startW: 220, startH: 95,
				maxW: 1480, maxH: 640,
				growFrames: 7,
				vx: Math.cos(ang) * spd,
				vy: Math.sin(ang) * spd,
				rot: ang,
				max: 86,
				dmg: 500,
				img: FX.gust,
				pierce: false,
				solid: false,
				knockY: -14,
			});
			spawnHit({
				kind: 'sprite',
				x: ox, y: oy,
				w: 150 * SZ * 0.45, h: 150 * SZ * 0.45,
				max: 10, img: FX.impact, dmg: 0,
			});
			shakeScreen(22, 30);
			b.aura = 1.4;
		}
		if(t === CHARGE + 4) b.aura = 1;
		if(t > CHARGE + 36) endAtk();
	}

	const ATK = {
		planetbreaker: tickPlanetbreaker,
		uppercut: tickUppercut,
		meteorpunch: tickMeteorPunch,
		blitz: tickBlitz,
		gravitystep: tickGravityStep,
		flashstep: tickFlashstep,
		mortal: tickMortal,
		worldbreaker: tickWorldbreaker,
		cataclysm: tickCataclysm,
		starfall: tickStarfall,
		thousand: tickThousand,
		onehit: tickOneHit,
	};

	function updateHits(){
		const gPull = challengerBoss && challengerBoss.gravityField;
		for(let i = hits.length - 1; i >= 0; i--){
			const h = hits[i];
			h.age++;
			if(h.kind === 'ring'){
				h.r += h.vr || 0;
			} else if(h.kind === 'shock'){
				h.x += h.vx || 0;
			} else if(h.kind === 'shockRing'){
				h.r = Math.min(h.maxR || h.r, h.r + (h.vr || 0));
				h.w = h.r * 2;
				h.h = h.r * 2;
			} else if(h.kind === 'beamTele'){
				// telegraph only
			} else {
				h.x += h.vx || 0;
				h.y += h.vy || 0;
				if(h.grav) h.vy += h.grav;
				if(gPull && h.kind !== 'gust' && h.kind !== 'fist' && h.kind !== 'shock' && h.kind !== 'shockRing' && h.kind !== 'chunk' && h.kind !== 'onehit') h.vy += 0.42;
			}
			if(h.kind === 'onehit'){
				const u = Math.min(1, h.age / (h.growFrames || 7));
				const ease = 1 - (1 - u) * (1 - u);
				h.w = (h.startW || 220) + ((h.maxW || 1480) - (h.startW || 220)) * ease;
				h.h = (h.startH || 95) + ((h.maxH || 640) - (h.startH || 95)) * ease;
			}
			h.rot += h.rotSpd || 0;
			if(h.kind === 'debris'){
				const hw = (h.w || 0) / 2;
				if(h.x - hw < A_L){ h.x = A_L + hw; h.vx = Math.abs(h.vx || 0) * 0.35; }
				if(h.x + hw > A_R){ h.x = A_R - hw; h.vx = -Math.abs(h.vx || 0) * 0.35; }
				const rising = h.hurtOnDown && (h.vy || 0) < 0;
				if(!rising){
					const fl = floorAt(h.x);
					const bot = h.y + (h.h || 0) / 2;
					const hitSurface = bot >= fl || h.x - hw < A_L || h.x + hw > A_R;
					const crush = !!(player && player.onGround && (h.vy || 0) > 0.2 && overlapBox(h) &&
						(player.y + player.h) >= floorAt(player.x + player.w / 2) - 8);
					if(hitSurface || crush){
						explodeDebris(h, hitSurface ? Math.min(fl, bot) : (player.y + player.h));
						hits.splice(i, 1);
						continue;
					}
				}
			}
			if(h.kind === 'chunk'){
				const fl = floorAt(h.x);
				if(!h.crashed && h.age > 18 && (h.y + (h.h || 0) / 2 >= fl || h.age >= h.max)){
					h.y = Math.min(h.y, fl - (h.h || 0) / 2);
					crashWorldChunk(h);
					hits.splice(i, 1);
					continue;
				}
				applyHit(h);
			} else if(h.kind !== 'beamTele' && h.kind !== 'debris'){
				applyHit(h);
			}
			if(h.age >= h.max) hits.splice(i, 1);
		}
	}

	window.updateChallengerBoss = function(){
		if(!IS_CHALLENGER || !challengerBoss) return;
		if(COOP_GUEST){ if(typeof updateCoopRemoteBoss === 'function') updateCoopRemoteBoss(challengerBoss); updateHits(); return; }
		const b = challengerBoss;
		b.animTimer++;
		if(b.flash > 0) b.flash--;
		if(b.stunTimer > 0) b.stunTimer--;
		if(b.slowTimer > 0) b.slowTimer--;
		if(b.globalCd > 0) b.globalCd--;
		if(b.busyTimer > 0) b.busyTimer--;
		b.spriteTimer++;
		if(b.planetTake){
			for(const k of ['orange', 'ice', 'gas']){
				if(b.planetTake[k] > 0 && b.planetTake[k] < 220) b.planetTake[k]++;
			}
		}
		if(b.planetSpawn){
			for(const k of ['orange', 'ice', 'gas']){
				if(b.planetSpawn[k] > 0 && b.planetSpawn[k] < 90) b.planetSpawn[k]++;
				else if(b.planetSpawn[k] >= 90) b.planetSpawn[k] = 0;
			}
		}
		if(b.inIntro && b.introTimer < F(130)){
			b._introWalkSpd = Math.abs(INTRO_X() - b.x) * 0.04;
		}
		const actDef = ACT[b.act] || ACT.idle;
		const frameHold = actFrameHold(b);
		if(b.spriteTimer >= frameHold){
			b.spriteTimer = 0;
			const n = actDef.n || ACT_COLS;
			b.spriteFrame = actDef.hold ? (b.spriteFrame + 1) % n : Math.min(b.spriteFrame + 1, n - 1);
		}

		if(b.dead){
			b.hidden = false;
			b.deathTimer++;
			if(b.deathTimer === 1) setAct('kneel');
			if(b.deathTimer === F(20)){ setAct('laugh'); say('Finally.', 1800); }
			if(b.deathTimer === F(90)){
				setAct('dust');
				for(let i = 0; i < 40; i++){
					particles.push({ x: b.x + Math.random()*b.w, y: b.y + Math.random()*b.h, vx:(Math.random()-0.5)*4, vy:-1-Math.random()*3, life: 50+Math.random()*30, maxLife: 80, r: 2, color:{r:200,g:216,b:232} });
				}
			}
			if(b.deathTimer === F(130)) setAct('dustEmpty');
			if(b.deathTimer === F(200) && typeof showChallengerVictory === 'function') showChallengerVictory();
			updateHits();
			return;
		}

		if(b.inIntro){
			b.introTimer++;
			b.facing = -1;
			if(b.introTimer < F(130)){
				setAct('walk');
				b.x += (INTRO_X() - b.x) * 0.04;
			} else if(b.introTimer === F(140)){
				setAct('neckCrack');
				b.vx = 0;
				say('…', 800);
			} else if(b.introTimer === F(190)){
				setAct('rollBeckon');
				say('Come.', 1600);
			} else if(b.introTimer > F(250)){
				b.inIntro = false;
				setAct('idle');
				b.globalCd = F(44);
			}
			updateHits();
			return;
		}

		if(b.hp <= 0){ b.hp = 0; b.dead = true; b.deathTimer = 0; b.atk = null; return; }

		const hpPct = b.hp / b.maxHp;
		if(b.phase === 1 && hpPct <= 0.5 && !b.atk){
			b.phase = 2;
			b.phaseCut = 1;
			b.phaseCutT = 0;
			b.armorOff = true;
			b.aura = 1.4;
		}
		if(b.phase === 2 && hpPct <= 0.05 && !b.atk){
			b.phase = 3;
			b.phaseCut = 3;
			b.phaseCutT = 0;
			b.aura = 0;
			b.gravityField = false;
		}

		if(b.phaseCut){
			b.phaseCutT++;
			b.vx = 0;
			if(b.phaseCut === 1){
				if(b.phaseCutT === 1) setAct('armorOff');
				if(b.phaseCutT === F(8)){ setAct('smileSpeak'); say('Enough testing.', 1800); }
				if(b.phaseCutT === F(50)){ setAct('limitSlam'); if(!SURV) shatterArena(); else { shakeScreen(18, 30); if(window.SurvivalArena) SurvivalArena.flash && SurvivalArena.flash(); } }
				if(b.phaseCutT === F(90)){ setAct('nowFight'); say('Now... fight me.', 2000); }
				if(b.phaseCutT > F(165)){ b.phaseCut = 0; b.globalCd = F(32); setAct('idleAura'); }
			} else {
				if(b.phaseCutT === 1) setAct('tiredIdle');
				if(b.phaseCutT === F(10)) say('You have earned the final exchange.', 2400);
				if(b.phaseCutT > F(155)){ b.phaseCut = 0; b.globalCd = F(22); setAct('pureIdle'); }
			}
			updateHits();
			return;
		}

		if(!b.arenaShattered && player.y > CHALLENGER_RAID_CONFIG.groundY + 40){
			damagePlayer(22, []);
			let best = null, bd = Infinity;
			for(const plat of sandboxPlatforms){
				if(plat.isWall) continue;
				const dx = Math.abs((player.x+player.w/2) - (plat.x+plat.w/2));
				if(dx < bd){ bd = dx; best = plat; }
			}
			if(best){
				player.x = best.x + best.w/2 - player.w/2;
				player.y = best.y - player.h - 2;
				player.vy = -8;
			}
		}

		if(b.gravityField){
			player.vy += GRAVITY * 1.2;
			if(player.vy > 24) player.vy = 24;
			for(const p of projectiles){ p.vy += 0.78; }
		}

		b.x += b.vx;
		if(!b.hidden){
			if(b.x < A_L + 20) b.x = A_L + 20;
			if(b.x + b.w > A_R - 20) b.x = A_R - 20;
			if(!b.atk){
				const ty = bossRestY();
				b.y += (ty - b.y) * 0.16;
			}
		}

		if(b.atk && ATK[b.atk]){
			b.atkT++;
			ATK[b.atk]();
		} else if(b.globalCd <= 0 && b.busyTimer <= 0){
			const n = pickAttack();
			b.lastAttack = n;
			startAtk(n, {});
		} else {
			if(!b.atk){
				facePlayer();
				if(Math.abs(b.vx) > 0.4) setAct(b.phase >= 2 ? 'fastWalk' : 'walk');
				else if(b.phase >= 3) setAct('pureIdle');
				else if(b.phase >= 2){
					if(b.globalCd === F(26)) setAct('lookExcited');
					else if(b.globalCd === F(18)) setAct('neckFast');
					else if(b.act !== 'lookExcited' && b.act !== 'neckFast' && b.act !== 'excitedNeck') setAct(b.act === 'floatIdle' ? 'floatIdle' : 'idleAura');
				}
				else setAct('idle');
			}
		}

		updateHits();
	};

	function drawImg(img, x, y, w, h, rot, face, alpha){
		ctx.save();
		ctx.globalAlpha = alpha == null ? 1 : alpha;
		ctx.translate(x - camera.x, y - camera.y);
		if(rot) ctx.rotate(rot);
		if(face < 0) ctx.scale(-1, 1);
		if(img && ready(img)){
			const plate = (img === FX.shockBand) ? img : knockOutWhite(img);
			ctx.drawImage(plate, -w/2, -h/2, w, h);
		} else {
			ctx.fillStyle = 'rgba(200,230,255,0.7)';
			ctx.beginPath(); ctx.ellipse(0, 0, w/2, h/2, 0, 0, Math.PI*2); ctx.fill();
		}
		ctx.restore();
	}

	let skyPlate = null;
	function ensureSkyPlate(){
		if(skyPlate) return skyPlate;
		const c = document.createElement('canvas');
		c.width = 1600; c.height = 900;
		const x = c.getContext('2d');
		const sky = x.createLinearGradient(0, 0, 0, c.height);
		sky.addColorStop(0, '#02040c');
		sky.addColorStop(0.42, '#0a1024');
		sky.addColorStop(0.72, '#14101c');
		sky.addColorStop(1, '#1a1410');
		x.fillStyle = sky;
		x.fillRect(0, 0, c.width, c.height);
		const nebulae = [
			[0.22, 0.28, 380, 'rgba(70,30,110,0.28)', 'rgba(20,8,40,0)'],
			[0.78, 0.22, 420, 'rgba(40,20,90,0.24)', 'rgba(10,6,24,0)'],
			[0.55, 0.18, 260, 'rgba(20,50,90,0.16)', 'rgba(8,12,28,0)'],
			[0.40, 0.55, 300, 'rgba(90,40,30,0.10)', 'rgba(20,10,8,0)'],
		];
		for(const n of nebulae){
			const g = x.createRadialGradient(n[0]*c.width, n[1]*c.height, 10, n[0]*c.width, n[1]*c.height, n[2]);
			g.addColorStop(0, n[3]); g.addColorStop(1, n[4]);
			x.fillStyle = g;
			x.fillRect(0, 0, c.width, c.height);
		}
		for(let i = 0; i < 220; i++){
			const sx = (i * 137.3) % c.width;
			const sy = (i * 89.1) % (c.height * 0.78);
			const a = 0.25 + (i % 7) * 0.09;
			x.fillStyle = i % 11 === 0 ? 'rgba(200,220,255,'+a+')' : 'rgba(255,255,255,'+a+')';
			const sz = i % 13 === 0 ? 2.2 : i % 5 === 0 ? 1.4 : 1;
			x.fillRect(sx, sy, sz, sz);
		}
		skyPlate = c;
		return c;
	}

	function drawSpacePlanet(kind, homeX, homeY, homeR){
		const b = challengerBoss;
		const take = (b.planetTake && b.planetTake[kind]) || 0;
		const spawn = (b.planetSpawn && b.planetSpawn[kind]) || 0;
		const gone = !b.planets[kind] && take >= 180;
		const pulling = !b.planets[kind] && take > 0 && take < 180;
		const spawning = b.planets[kind] && spawn > 0;
		if(gone){
			ctx.save();
			ctx.globalAlpha = 0.22;
			const hole = ctx.createRadialGradient(homeX, homeY, 4, homeX, homeY, homeR * 1.35);
			hole.addColorStop(0, 'rgba(180,210,255,0.18)');
			hole.addColorStop(0.45, 'rgba(40,50,80,0.12)');
			hole.addColorStop(1, 'transparent');
			ctx.fillStyle = hole;
			ctx.beginPath(); ctx.arc(homeX, homeY, homeR * 1.35, 0, Math.PI*2); ctx.fill();
			ctx.restore();
			return;
		}
		let px = homeX, py = homeY, pr = homeR, squish = 1, alpha = 0.88;
		if(pulling){
			const u = Math.min(1, take / 130);
			px += (canvas.width * 0.5 - homeX) * u * 0.72;
			py += (canvas.height * 0.52 - homeY) * u;
			pr *= 1 + u * 0.55;
			squish = 1 - u * 0.42;
			if(take > 110){
				const fade = (take - 110) / 70;
				pr *= Math.max(0.12, 1 - fade);
				alpha *= Math.max(0, 1 - fade);
			}
		} else if(spawning){
			const u = Math.min(1, spawn / 90);
			const ease = 1 - Math.pow(1 - u, 3);
			pr *= 0.08 + 0.92 * ease;
			alpha *= Math.min(1, 0.2 + u * 1.1);
			squish = 0.72 + 0.28 * ease;
		}
		ctx.save();
		ctx.translate(px, py);
		ctx.scale(1, squish);
		ctx.globalAlpha = alpha;
		const glow = ctx.createRadialGradient(0, 0, pr * 0.7, 0, 0, pr * 1.7);
		if(kind === 'orange'){ glow.addColorStop(0, 'rgba(255,140,40,0.22)'); glow.addColorStop(1, 'transparent'); }
		else if(kind === 'ice'){ glow.addColorStop(0, 'rgba(90,170,255,0.10)'); glow.addColorStop(1, 'transparent'); }
		else { glow.addColorStop(0, 'rgba(255,190,90,0.16)'); glow.addColorStop(1, 'transparent'); }
		ctx.fillStyle = glow;
		ctx.beginPath(); ctx.arc(0, 0, pr * 1.7, 0, Math.PI*2); ctx.fill();

		const body = ctx.createRadialGradient(-pr * 0.35, -pr * 0.4, pr * 0.1, 0, 0, pr);
		if(kind === 'orange'){
			body.addColorStop(0, '#ffd08a'); body.addColorStop(0.35, '#d07028');
			body.addColorStop(0.75, '#7a3010'); body.addColorStop(1, '#2a1008');
		} else if(kind === 'ice'){
			body.addColorStop(0, '#e8f4ff'); body.addColorStop(0.28, '#6aa8e0');
			body.addColorStop(0.62, '#2a5a88'); body.addColorStop(1, '#0a1828');
		} else {
			body.addColorStop(0, '#fff0c8'); body.addColorStop(0.3, '#d4a040');
			body.addColorStop(0.7, '#7a4a10'); body.addColorStop(1, '#2a1806');
		}
		ctx.fillStyle = body;
		ctx.beginPath(); ctx.arc(0, 0, pr, 0, Math.PI*2); ctx.fill();

		if(kind === 'ice'){
			ctx.fillStyle = 'rgba(240,248,255,0.55)';
			ctx.beginPath(); ctx.ellipse(-pr*0.15, -pr*0.1, pr*0.42, pr*0.22, -0.4, 0, Math.PI*2); ctx.fill();
			ctx.beginPath(); ctx.ellipse(pr*0.22, pr*0.18, pr*0.28, pr*0.14, 0.5, 0, Math.PI*2); ctx.fill();
		} else if(kind === 'gas'){
			ctx.globalAlpha = alpha * 0.28;
			for(let i = 0; i < 5; i++){
				ctx.fillStyle = i % 2 ? '#ffe6a0' : '#8a5010';
				ctx.beginPath();
				ctx.ellipse(0, (i - 2) * pr * 0.22, pr * 0.96, pr * 0.1, 0, 0, Math.PI*2);
				ctx.fill();
			}
			ctx.globalAlpha = alpha * 0.45;
			ctx.strokeStyle = '#e8c070';
			ctx.lineWidth = 5;
			ctx.beginPath(); ctx.ellipse(0, pr * 0.08, pr * 1.75, pr * 0.34, 0.18, 0, Math.PI*2); ctx.stroke();
			ctx.lineWidth = 2; ctx.strokeStyle = '#fff0b0';
			ctx.beginPath(); ctx.ellipse(0, pr * 0.08, pr * 2.05, pr * 0.4, 0.18, 0, Math.PI*2); ctx.stroke();
			ctx.globalAlpha = alpha;
		} else {
			ctx.fillStyle = 'rgba(80,30,10,0.35)';
			ctx.beginPath(); ctx.ellipse(-pr*0.2, pr*0.1, pr*0.22, pr*0.12, 0.3, 0, Math.PI*2); ctx.fill();
			ctx.beginPath(); ctx.ellipse(pr*0.25, -pr*0.15, pr*0.16, pr*0.1, -0.4, 0, Math.PI*2); ctx.fill();
		}

		if(pulling){
			ctx.strokeStyle = 'rgba(200,230,255,0.75)';
			ctx.lineWidth = 2;
			for(let i = 0; i < 5; i++){
				const a0 = take * 0.08 + i * 1.1;
				ctx.beginPath();
				ctx.moveTo(Math.cos(a0)*pr*0.15, Math.sin(a0)*pr*0.15);
				ctx.lineTo(Math.cos(a0)*pr*0.95, Math.sin(a0)*pr*0.95);
				ctx.stroke();
			}
		}
		if(spawning){
			const u = Math.min(1, spawn / 90);
			ctx.strokeStyle = 'rgba(220,240,255,' + (0.85 * (1 - u)) + ')';
			ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(0, 0, pr * (1.15 + (1 - u) * 0.8), 0, Math.PI * 2); ctx.stroke();
			ctx.fillStyle = 'rgba(200,230,255,' + (0.22 * (1 - u)) + ')';
			ctx.beginPath(); ctx.arc(0, 0, pr * 1.4, 0, Math.PI * 2); ctx.fill();
		}
		ctx.restore();
	}

	window.drawChallengerWorld = function(){
		if(!IS_CHALLENGER) return;
		const b = challengerBoss;
		const t = Date.now();

		if(!SURV){   // Survival paints the Sanctum itself
		ctx.drawImage(ensureSkyPlate(), 0, 0, canvas.width, canvas.height);

		const parX = -(camera.x * 0.012);
		const twinkle = t / 900;
		ctx.fillStyle = '#ffffff';
		for(let i = 0; i < 40; i++){
			const sx = ((i * 211.7 + parX) % (canvas.width + 20) + canvas.width + 20) % (canvas.width + 20);
			const sy = (i * 73.3) % (canvas.height * 0.62);
			ctx.globalAlpha = 0.35 + Math.sin(twinkle + i) * 0.2;
			ctx.fillRect(sx, sy, i % 6 === 0 ? 2 : 1, 1);
		}
		ctx.globalAlpha = 1;

		drawSpacePlanet('ice', canvas.width * 0.16 + parX, canvas.height * 0.20, 48);
		drawSpacePlanet('gas', canvas.width * 0.62 + parX * 0.6, canvas.height * 0.24, 86);
		drawSpacePlanet('orange', canvas.width * 0.82 + parX * 0.8, canvas.height * 0.16, 64);

		const floorS = FLOOR - camera.y;
		if(b && b.arenaShattered){
			const abyssY = 2680 - camera.y;
			if(abyssY < canvas.height){
				const abyssGrad = ctx.createLinearGradient(0, abyssY, 0, canvas.height);
				abyssGrad.addColorStop(0, 'rgba(4,8,18,0.15)');
				abyssGrad.addColorStop(0.35, 'rgba(2,4,12,0.72)');
				abyssGrad.addColorStop(1, '#000208');
				ctx.fillStyle = abyssGrad;
				ctx.fillRect(0, abyssY, canvas.width, canvas.height - abyssY + 40);
				ctx.strokeStyle = `rgba(90,180,255,${0.08 + Math.sin(t/700)*0.04})`;
				ctx.lineWidth = 2;
				for(let i = 0; i < 8; i++){
					const tx = ((i * 523.7 + t * 0.04) % WORLD_W) - camera.x;
					if(tx > -50 && tx < canvas.width + 50){
						ctx.beginPath();
						ctx.moveTo(tx, abyssY + 90);
						ctx.quadraticCurveTo(tx + Math.sin(t/800 + i) * 28, abyssY + 18, tx + Math.sin(i*2.1) * 14, abyssY - 16);
						ctx.stroke();
					}
				}
			}
		} else {
			ctx.beginPath();
			ctx.moveTo(-50, canvas.height + 60);
			ctx.lineTo(-50, floorS + 10);
			for(let x = -50; x <= canvas.width + 50; x += 16){
				const wx = x + camera.x;
				const rise = Math.sin(wx * 0.0038) * 34 + Math.sin(wx * 0.011) * 16 + Math.sin(wx * 0.027) * 8;
				ctx.lineTo(x, floorS - 36 - rise);
			}
			ctx.lineTo(canvas.width + 50, canvas.height + 60);
			ctx.closePath();
			const dirt = ctx.createLinearGradient(0, floorS - 90, 0, canvas.height);
			dirt.addColorStop(0, '#6e6860');
			dirt.addColorStop(0.28, '#4a4640');
			dirt.addColorStop(1, '#161410');
			ctx.fillStyle = dirt;
			ctx.fill();
			ctx.save();
			ctx.beginPath();
			ctx.rect(0, floorS - 120, canvas.width, 220);
			ctx.clip();
			ctx.fillStyle = 'rgba(20,18,16,0.35)';
			for(let i = 0; i < 18; i++){
				const cx = ((i * 347 + camera.x * 0.2) % (canvas.width + 160)) - 80;
				const cy = floorS - 10 + (i % 5) * 12;
				ctx.beginPath(); ctx.ellipse(cx, cy, 28 + (i%4)*10, 8 + (i%3)*3, 0, 0, Math.PI*2); ctx.fill();
			}
			ctx.restore();
		}

		if(b.horizonCrack > 0 && !(b && b.arenaShattered)){
			ctx.save();
			ctx.globalAlpha = 0.7 * b.horizonCrack;
			ctx.strokeStyle = '#b8e0ff';
			ctx.shadowColor = '#8ec8ff';
			ctx.shadowBlur = 8;
			ctx.lineWidth = 2.5;
			const hy = floorS + 6;
			for(let i = 0; i < 10; i++){
				ctx.beginPath();
				ctx.moveTo(-20, hy + i * 9);
				let x = -20;
				while(x < canvas.width + 20){
					x += 40 + (i * 13) % 30;
					ctx.lineTo(x, hy + 10 + Math.sin(i + x * 0.02 + t/400) * 14);
				}
				ctx.stroke();
			}
			ctx.restore();
		}

		for(const plat of sandboxPlatforms){
			if(plat.isWall || plat._gone) continue;
			const px = plat.x - camera.x, py = plat.y - camera.y;
			if(px + plat.w < -80 || px > canvas.width + 80) continue;
			ctx.save();
			ctx.translate(px + plat.w/2, py);
			ctx.rotate(plat.tilt || 0);
			ctx.translate(-plat.w/2, 0);
			if(plat._frag && plat.verts){
				ctx.beginPath();
				ctx.moveTo(plat.verts[0].x, plat.verts[0].y);
				for(let i = 1; i < plat.verts.length; i++) ctx.lineTo(plat.verts[i].x, plat.verts[i].y);
				ctx.closePath();
				const lg = ctx.createLinearGradient(0, 0, 0, plat.h + 30);
				lg.addColorStop(0, '#e8e2d6');
				lg.addColorStop(0.4, '#b8b0a2');
				lg.addColorStop(1, '#6a6258');
				ctx.fillStyle = lg; ctx.fill();
				ctx.strokeStyle = '#fff8ee'; ctx.lineWidth = 3; ctx.stroke();
				if(plat.spikes){
					ctx.fillStyle = '#7a7268';
					for(let s = 12; s < plat.w - 10; s += 22){
						ctx.beginPath();
						ctx.moveTo(s, plat.h + 6);
						ctx.lineTo(s + 7, plat.h + 22 + (s%3)*4);
						ctx.lineTo(s + 14, plat.h + 6);
						ctx.fill();
					}
				}
				if(plat.crater){
					ctx.fillStyle = 'rgba(20,16,12,0.4)';
					ctx.beginPath(); ctx.ellipse(plat.w*0.5, 10, plat.w*0.22, 8, 0, 0, Math.PI*2); ctx.fill();
				}
			} else {
				ctx.fillStyle = '#9a9286';
				ctx.fillRect(0, 0, plat.w, plat.h + 18);
				ctx.fillStyle = '#ddd6cc';
				ctx.fillRect(0, 0, plat.w, 8);
				ctx.fillStyle = '#5c564e';
				ctx.fillRect(0, plat.h + 10, plat.w, 8);
				ctx.strokeStyle = '#fff8ee';
				ctx.lineWidth = 2;
				ctx.beginPath(); ctx.moveTo(0, 1); ctx.lineTo(plat.w, 1); ctx.stroke();
			}
			ctx.restore();
		}

		}
		if(typeof raidIndicators !== 'undefined'){
			for(const ind of raidIndicators){
				const progress = ind.age / ind.maxAge;
				const ix = ind.x - camera.x, iy = ind.y - camera.y;
				ctx.save();
				ctx.globalAlpha = 0.38 + progress * 0.5;
				ctx.fillStyle = ind.color || 'rgba(200,230,255,0.4)';
				if(ind.type === 'circle'){
					ctx.beginPath();
					ctx.arc(ix + ind.w / 2, iy + ind.h / 2, ind.w / 2, 0, Math.PI * 2);
					ctx.fill();
					ctx.strokeStyle = 'rgba(255,255,255,0.85)';
					ctx.lineWidth = 4;
					ctx.stroke();
				} else {
					ctx.fillRect(ix, iy, ind.w, ind.h);
					ctx.strokeStyle = 'rgba(255,255,255,0.9)';
					ctx.lineWidth = 4 + progress * 3;
					ctx.strokeRect(ix, iy, ind.w, ind.h);
					ctx.strokeStyle = 'rgba(255,220,80,0.7)';
					ctx.lineWidth = 2;
					ctx.strokeRect(ix + 6, iy + 6, ind.w - 12, ind.h - 12);
				}
				ctx.restore();
				ctx.globalAlpha = 1;
			}
		}

		drawChallengerSprite(b);
	};

	function drawDebrisRock(h){
		const gx = h.x - camera.x, gy = h.y - camera.y;
		const r = Math.max(14, (h.w || 52) / 2);
		const seed = h.seed || 1;
		ctx.save();
		ctx.translate(gx, gy);
		ctx.rotate(h.rot || 0);
		if(h.fire){
			const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, r * 1.7);
			glow.addColorStop(0, 'rgba(255,140,40,0.5)');
			glow.addColorStop(1, 'transparent');
			ctx.fillStyle = glow;
			ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, Math.PI*2); ctx.fill();
		}
		ctx.beginPath();
		ctx.arc(0, 0, r, 0, Math.PI * 2);
		const g = ctx.createRadialGradient(-r * 0.3, -r * 0.32, r * 0.12, 0, 0, r);
		if(h.fire){
			g.addColorStop(0, '#ffd078');
			g.addColorStop(0.4, '#c05818');
			g.addColorStop(1, '#3a1808');
		} else {
			g.addColorStop(0, '#d0c8bc');
			g.addColorStop(0.45, '#7a746c');
			g.addColorStop(1, '#32302c');
		}
		ctx.fillStyle = g;
		ctx.fill();
		ctx.strokeStyle = h.fire ? '#ffaa55' : '#9a948a';
		ctx.lineWidth = 1.6;
		ctx.stroke();
		ctx.fillStyle = h.fire ? 'rgba(80,30,8,0.45)' : 'rgba(30,28,26,0.4)';
		for(let i = 0; i < 3; i++){
			const a = seed + i * 2.1;
			ctx.beginPath();
			ctx.ellipse(Math.cos(a)*r*0.32, Math.sin(a)*r*0.28, r*0.18, r*0.12, a, 0, Math.PI*2);
			ctx.fill();
		}
		ctx.restore();
	}

	window.drawChallengerFx = function(){
		if(!IS_CHALLENGER) return;
		for(const h of hits){
			const fade = Math.max(0.25, 1 - h.age / h.max);
			const sc = h.scale || 1;
			const w = h.w * sc, ht = h.h * sc;
			if(h.kind === 'shock'){
				const life = 1 - h.age / h.max;
				ctx.save();
				ctx.globalCompositeOperation = 'screen';
				drawImg(h.img || FX.shockBand, h.x, h.y, h.w, 124, 0, h.face || 1, Math.max(0.85, life));
				ctx.restore();
			} else if(h.kind === 'shockRing'){
				const life = 1 - h.age / h.max;
				ctx.save();
				ctx.globalCompositeOperation = 'screen';
				drawImg(h.img || FX.shockRing, h.x, h.y, h.r * 2, h.r * 2, 0, 1, Math.max(0.8, life));
				ctx.restore();
			} else if(h.kind === 'ring'){
				ctx.save();
				ctx.globalCompositeOperation = 'screen';
				drawImg(h.img || FX.shockBand, h.x, h.y, Math.max(80, h.r * 2), 124, 0, 1, Math.max(0.8, fade));
				ctx.restore();
			} else if(h.kind === 'column'){
				drawImg(h.img || FX.column, h.x, h.y, w, ht, 0, 1, fade);
			} else if(h.kind === 'gust'){
				drawImg(h.img || FX.gust, h.x + (h.face || 1) * w * 0.25, h.y, w, ht, 0, h.face || 1, fade);
			} else if(h.kind === 'beamTele'){
				const life = 1 - h.age / h.max;
				const pulse = 0.35 + Math.sin(h.age * 0.28) * 0.18;
				ctx.save();
				ctx.translate(h.x - camera.x, h.y - camera.y);
				ctx.rotate(h.ang || 0);
				ctx.globalCompositeOperation = 'screen';
				const len = h.len || 1800;
				const thick = 22 + (1 - life) * 28;
				const g = ctx.createLinearGradient(0, 0, len, 0);
				g.addColorStop(0, 'rgba(255,255,255,' + (0.55 * pulse) + ')');
				g.addColorStop(0.45, 'rgba(180,220,255,' + (0.28 * pulse) + ')');
				g.addColorStop(1, 'rgba(255,255,255,0)');
				ctx.fillStyle = g;
				ctx.fillRect(0, -thick / 2, len, thick);
				ctx.strokeStyle = 'rgba(255,255,255,' + (0.7 * pulse) + ')';
				ctx.lineWidth = 2;
				ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len * 0.92, 0); ctx.stroke();
				ctx.restore();
			} else if(h.kind === 'onehit'){
				const sc = h.scale || 1;
				const w = h.w * sc, ht = h.h * sc;
				ctx.save();
				ctx.globalCompositeOperation = 'screen';
				drawImg(h.img || FX.gust, h.x, h.y, w, ht, h.rot || 0, 1, 0.95);
				ctx.restore();
			} else if(h.kind === 'debris'){
				ctx.save();
				ctx.globalAlpha = fade;
				drawDebrisRock(h);
				ctx.restore();
			} else {
				drawImg(h.img, h.x, h.y, w, ht, h.rot, h.face || 1, fade * (h.alpha || 1));
			}
		}
	};

	window.drawChallengerHud = function(){
		if(!IS_CHALLENGER || !challengerBoss) return;
		const b = challengerBoss;
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		const barW = Math.min(640, canvas.width - 60);
		const phaseName = b.inIntro ? 'Approaching' : (b.phase === 1 ? 'Show Me Your Strength' : b.phase === 2 ? 'Now I Fight' : 'Final Exchange');
		const col = b.phase >= 3 ? '#cfd6de' : b.phase >= 2 ? '#2fb6e8' : '#5a9fd8';
		const sub = phaseName + (b.markedPlayer && !b.dead ? '  •  Mortal Challenge' : '');
		if(typeof drawBossBar === 'function'){
			drawBossBar(ctx, { key: 'challenger', x: (canvas.width - barW) / 2, y: 62, w: barW, h: 24, name: 'The Grand Challenger', sub,
				hp: b.hp, max: b.maxHp, c1: col, c2: '#ffffff', accent: '#9ad8ff', nameColor: '#eaf6ff', ticks: [1/3, 2/3],
				text: Math.round(b.hp).toLocaleString() + ' / ' + Math.round(b.maxHp).toLocaleString() });
		}
		ctx.restore();
	};

	function drawChallengerSprite(b){
		if(!b || b.hidden) return;
		const bx = b.x - camera.x, by = b.y - camera.y;
		const def = ACT[b.act] || ACT.idle;
		const sheet = SHEETS[def.sheet];
		const frame = Math.min(b.spriteFrame, (def.n || ACT_COLS) - 1);

		if(b.phase === 2 && b.aura){
			const cx = bx + b.w/2, cy = by + b.h/2;
			const ag = ctx.createRadialGradient(cx, cy, 10, cx, cy, 90);
			ag.addColorStop(0, 'rgba(120,220,255,0.35)');
			ag.addColorStop(1, 'transparent');
			ctx.fillStyle = ag;
			ctx.beginPath(); ctx.arc(cx, cy, 90, 0, Math.PI*2); ctx.fill();
		}

		if(sheet && ready(sheet)){
			const plate = knockOutSheet(sheet);
			const fw = plate.width / ACT_COLS;
			const fh = plate.height / ACT_ROWS;
			const dw = b.w * 1.62, dh = b.h * 1.55;
			const dx = bx - (dw - b.w) / 2;
			const dy = by + b.h - dh;
			ctx.save();
			if(b.facing < 0){
				ctx.translate(dx + dw, dy);
				ctx.scale(-1, 1);
				ctx.drawImage(plate, frame * fw, def.row * fh, fw, fh, 0, 0, dw, dh);
			} else {
				ctx.drawImage(plate, frame * fw, def.row * fh, fw, fh, dx, dy, dw, dh);
			}
			ctx.restore();
		} else {
			drawProceduralBoss(b, bx, by);
		}
		if(b.flash > 0){
			ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#fff';
			ctx.fillRect(bx, by, b.w, b.h); ctx.restore();
		}
		if(b.markedPlayer && !b.dead){
			ctx.fillStyle = '#ffcc66';
			ctx.font = 'bold 16px Arial';
			ctx.textAlign = 'center';
			ctx.fillText('▼', bx + b.w/2, by - 8);
		}
	}

	function drawProceduralBoss(b, bx, by){
		const glow = b.phase === 2 ? '#66e0ff' : (b.phase === 3 ? '#c8d0d8' : '#9ad8ff');
		const act = b.act || 'idle';
		let dip = 0, lean = 0;
		if(/crouch|grab|kneel|lift/.test(act)) dip = 18;
		if(/jump|float|ascend|leap|air|uppercut/.test(act)) dip = -10;
		if(/punch|jab|cross|slam|throw|dash/.test(act)) lean = 8;
		if(/charge|fistBack|raiseFist/.test(act)) lean = -6;
		ctx.save();
		ctx.translate(bx + b.w/2, by + dip);
		if(lean) ctx.rotate(lean * 0.012 * (b.facing || 1));
		if(b.facing > 0) ctx.scale(-1, 1);
		ctx.fillStyle = 'rgba(0,0,0,0.45)';
		ctx.beginPath(); ctx.ellipse(0, b.h - 2, 28, 7, 0, 0, Math.PI*2); ctx.fill();
		ctx.fillStyle = '#2a3038';
		ctx.fillRect(-18, 78, 14, 48);
		ctx.fillRect(4, 78, 14, 48);
		ctx.fillStyle = '#14181e';
		ctx.fillRect(-20, 118, 18, 12);
		ctx.fillRect(2, 118, 18, 12);
		ctx.fillStyle = '#3a424c';
		ctx.beginPath();
		ctx.moveTo(-26, 24); ctx.lineTo(26, 24); ctx.lineTo(18, 86); ctx.lineTo(-18, 86);
		ctx.closePath(); ctx.fill();
		ctx.strokeStyle = glow; ctx.lineWidth = b.phase === 2 ? 2.6 : 1.6;
		ctx.shadowColor = glow; ctx.shadowBlur = 8;
		ctx.beginPath(); ctx.moveTo(-10, 30); ctx.lineTo(-5, 78); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(10, 32); ctx.lineTo(6, 80); ctx.stroke();
		ctx.shadowBlur = 0;
		if(b.phase === 1 && !b.armorOff){
			ctx.fillStyle = '#6a727c';
			ctx.fillRect(-34, 20, 22, 18);
			ctx.fillRect(12, 20, 22, 18);
			ctx.fillRect(-16, 22, 32, 12);
			ctx.fillStyle = '#8a92a0';
			ctx.fillRect(-32, 48, 14, 20);
			ctx.fillRect(18, 48, 14, 20);
		}
		ctx.fillStyle = '#3a424c';
		ctx.fillRect(-36, 32, 14, 42);
		ctx.fillRect(22, 32, 14, 42);
		ctx.fillStyle = '#2e343c';
		ctx.beginPath(); ctx.arc(-28, 78, 11, 0, Math.PI*2); ctx.fill();
		ctx.beginPath(); ctx.arc(28, 78, 11, 0, Math.PI*2); ctx.fill();
		ctx.fillStyle = glow;
		ctx.globalAlpha = 0.55;
		ctx.beginPath(); ctx.arc(-28, 78, 5, 0, Math.PI*2); ctx.fill();
		ctx.beginPath(); ctx.arc(28, 78, 5, 0, Math.PI*2); ctx.fill();
		ctx.globalAlpha = 1;
		ctx.fillStyle = '#2c323a';
		ctx.beginPath(); ctx.arc(0, 14, 15, 0, Math.PI*2); ctx.fill();
		ctx.fillStyle = b.phase === 2 ? '#fff' : '#e8f4ff';
		ctx.shadowColor = '#fff'; ctx.shadowBlur = 6;
		ctx.beginPath(); ctx.arc(-5, 12, b.phase === 2 ? 2.8 : 2, 0, Math.PI*2); ctx.fill();
		ctx.beginPath(); ctx.arc(5, 12, b.phase === 2 ? 2.8 : 2, 0, Math.PI*2); ctx.fill();
		ctx.shadowBlur = 0;
		if(b.phase === 1 && !b.armorOff){
			ctx.fillStyle = '#3a4048';
			ctx.beginPath();
			ctx.moveTo(-20, 20); ctx.lineTo(-40, 48); ctx.lineTo(-28, 28); ctx.closePath(); ctx.fill();
		}
		ctx.restore();
	}

	window.showChallengerVictory = function(){
		if(!IS_CHALLENGER || SURV) return;
		const overlay = document.createElement('div');
		overlay.id = 'victoryOverlay';
		overlay.style.cssText = 'position:fixed;inset:0;z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Arial,sans-serif;color:#fff;background:rgba(0,0,0,0.78);';
		overlay.innerHTML = `
			<div style="background:rgba(12,16,24,0.96);border:2px solid rgba(160,210,255,0.4);border-radius:16px;padding:36px 48px;max-width:460px;text-align:center;box-shadow:0 0 50px rgba(140,200,255,0.25);">
				<div style="font-size:52px;margin-bottom:8px;">🌌</div>
				<h2 style="font-size:26px;margin-bottom:6px;color:#c8e8ff;text-shadow:0 0 12px rgba(160,210,255,0.5);">The Grand Challenger Falls</h2>
				<p style="color:#9ab;margin-bottom:16px;font-size:14px;line-height:1.5;">He kneels. He laughs. For the first time in millennia, someone stood.</p>
				<div style="font-size:18px;color:#fff;font-style:italic;margin-bottom:22px;">“Finally.”</div>
				<button onclick="location.href='raids.html'" style="padding:12px 32px;font-size:16px;font-weight:bold;border:none;border-radius:8px;background:linear-gradient(135deg,#3a5a7a,#8ec8ff);color:#fff;cursor:pointer;">Return to Raids</button>
			</div>`;
		document.body.appendChild(overlay);
	};
})();
