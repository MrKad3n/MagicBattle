/* =============================================================
   The Glacial Reach — ice runtime.

   Owns every ice-only system: traction and momentum, the Frost
   meter, all ten glacier hazards, fragile ice decks, the ancient
   mechanisms, and the dungeon's atmosphere pass.

   The shared dungeon runtime delegates to this file whenever the
   active theme is ice, so no fire behaviour ever leaks in.
   ============================================================= */
(function(global){
	const T = 40;

	const Ice = {
		ready: false,
		squall: 0,          /* current visibility loss, 0..1 */
		submerged: 0,       /* how deep the player is in meltwater, 0..1 */
		rings: Object.create(null),
		flags: { knightSlain:false, shortcutOpen:false, hearths:0 },
		shards: [],         /* live falling icicles */
		debris: [],         /* collapse rubble */
		puffs: [],          /* snow bursts from breaks and geysers */
	};

	function D(){ return (typeof dungeon !== 'undefined' && dungeon && dungeon.worldW) ? dungeon : null; }
	function isIce(){ const d = D(); return !!d && d._theme === 'ice'; }
	function Env(){ return global.DungeonEnv; }
	function rooms(){ const d = D(); return (d && d.rooms) || []; }
	function hazards(){ const d = D(); return (d && d.hazards) || []; }
	function platforms(){ const d = D(); return (d && d.platforms) || []; }
	function interacts(){ const d = D(); return (d && d.interactables) || []; }
	function props(){ return global.IceProps; }
	function bless(){ const e = Env(); return (e && e.blessings) || {}; }
	function curRoom(){ const e = Env(); return e && e.currentRoom; }

	function frost(){ const e = Env(); return e ? e.heat : 0; }
	function addFrost(n, why){ const e = Env(); if(e && e.addHeat) e.addHeat(n, why); }
	function banner(t){ const e = Env(); if(e && e.showBanner) e.showBanner(t); }

	function hitRect(x, y, w, h){
		return player.x + player.w > x && player.x < x + w && player.y + player.h > y && player.y < y + h;
	}
	function shake(a, b){ if(typeof shakeScreen === 'function') shakeScreen(a, b); }

	function stamp(x, y, w, h, air){
		if(typeof tileMap === 'undefined') return;
		const sc = Math.floor(x / T), ec = Math.ceil((x + w) / T);
		const sr = Math.floor(y / T), er = Math.ceil((y + h) / T);
		for(let r = Math.max(0, sr); r < er && r < MAP_ROWS; r++){
			for(let c = Math.max(0, sc); c < ec && c < MAP_COLS; c++) tileMap[r][c] = air ? 1 : 0;
		}
	}
	function retile(){ if(typeof computeTileEdges === 'function') computeTileEdges(); }

	/* First solid surface below a world point — used so falling ice
	   lands on the actual geometry instead of a guessed floor. */
	function floorBelow(x, y, limit){
		if(typeof tileMap === 'undefined') return y + (limit || 900);
		const c = Math.max(0, Math.min(MAP_COLS - 1, Math.floor(x / T)));
		const start = Math.max(0, Math.floor(y / T));
		const stop = Math.min(MAP_ROWS - 1, start + Math.ceil((limit || 900) / T));
		for(let r = start; r <= stop; r++){
			if(!tileMap[r][c]) return r * T;
		}
		return stop * T;
	}
	function tileSolidAt(c, r){
		if(typeof tileMap === 'undefined' || r < 0 || c < 0 || r >= MAP_ROWS || c >= MAP_COLS) return true;
		return !tileMap[r][c];
	}
	function surfaceY(x, hintY){
		const c = Math.max(0, Math.min(MAP_COLS - 1, Math.floor(x / T)));
		let r = Math.max(0, Math.min(MAP_ROWS - 1, Math.floor(hintY / T)));
		while(r > 0 && tileSolidAt(c, r)) r--;
		while(r < MAP_ROWS && !tileSolidAt(c, r)) r++;
		if(r >= MAP_ROWS) return null;
		return r * T;
	}
	function platY(x, hintY){
		let best = null, bestD = 1e9;
		for(const p of platforms()){
			if(!p || p._gone) continue;
			if(x < p.x - 4 || x > p.x + p.w + 4) continue;
			const d = Math.abs(p.y - hintY);
			if(d < bestD && p.y >= hintY - 90 && p.y <= hintY + 520){
				best = p.y; bestD = d;
			}
		}
		return best;
	}
	const PLANT_GROUND = {
		snowDrift:1, iceRidge:1, crystalCluster:1, frozenCamp:1, frozenStatue:1,
		frozenAltar:1, frozenPool:1, hoarFrost:1, mistBank:1, iceColumn:1,
		carvedPillar:1, preservedBeast:1, prisonBlock:1, iceGlyphs:1, buriedDoor:1,
		iceFence:1, iceIdol:1, warmHearth:1, runeTablet:1, buriedRuin:1,
		iceCacheProp:1, iceLantern:1, frozenRiverBand:1, subglacialWater:1,
		meltRunnel:1, ruinedStair:1, iceArch:1, ancientMechanism:1, iceDoor:1
	};
	const PLANT_HANG = { icicleCluster:1, dripCurtain:1, frozenBanner:1 };
	function plantDecorations(){
		const dng = D();
		if(!dng || !isIce() || typeof tileMap === 'undefined' || !tileMap.length) return;
		if(dng._iceDecorPlanted) return;
		const decs = dng.decorations || [];
		for(let i = 0; i < decs.length; i++){
			const d = decs[i];
			if(!d || !d.type) continue;
			const w = d.w || (d.r ? d.r * 2 : 80);
			const h = d.h || 24;
			const midX = d.x + w * 0.5;
			if(PLANT_HANG[d.type]){
				const c = Math.max(0, Math.min(MAP_COLS - 1, Math.floor(midX / T)));
				let r = Math.max(0, Math.floor((d.y + 8) / T));
				while(r < MAP_ROWS - 1 && !tileSolidAt(c, r)) r++;
				while(r > 0 && tileSolidAt(c, r)) r--;
				d.y = (r + 1) * T;
				continue;
			}
			if(!PLANT_GROUND[d.type]) continue;
			const hint = d.y + h;
			const tileFl = surfaceY(midX, hint - 20);
			const platFl = platY(midX, hint);
			let fl = tileFl;
			if(platFl != null && (fl == null || Math.abs(platFl - hint) < Math.abs(fl - hint))) fl = platFl;
			if(fl == null) continue;
			d.y = fl - h + 65;
		}
		dng._iceDecorPlanted = true;
	}

	/* =========================================================
	   FROST

	   Frost is exposure, not a damage timer. It rises when the
	   player chooses cold ground and only comes off at authored
	   relief points, so the meter is a routing decision.
	   ========================================================= */
	function frostGain(base){
		let g = base;
		if(bless().sink) g *= 0.5;      /* Cold Blood */
		if(bless().fortune) g *= 1.35;  /* Frozen Fortune */
		return g;
	}
	function frostPenalty(){
		const f = frost();
		if(f >= 70) return 2;
		if(f >= 40) return 1;
		return 0;
	}

	let frostCarry = 0;
	function accrueFrost(amount){
		frostCarry += frostGain(amount);
		if(frostCarry >= 1){
			const whole = Math.floor(frostCarry);
			frostCarry -= whole;
			addFrost(whole, null);
		}
	}

	/* =========================================================
	   TRACTION + MOMENTUM
	   ========================================================= */
	function tractionAt(){
		let slip = 0;
		if(!player.onGround) return 0;
		const footY = player.y + player.h;
		for(const hz of hazards()){
			if(hz.type !== 'slick') continue;
			if(player.x + player.w < hz.x || player.x > hz.x + hz.w) continue;
			if(footY < hz.y - 14 || footY > hz.y + hz.h + 22) continue;
			slip = Math.max(slip, hz.slip);
		}
		if(!slip) return 0;
		/* High frost stiffens the legs; the shrine blessing undoes it. */
		const pen = frostPenalty();
		if(pen === 2) slip += 0.1;
		else if(pen === 1) slip += 0.04;
		if(bless().step) slip *= 0.5;
		return Math.min(0.78, slip);
	}

	function applyMove(mx, speed){
		if(!isIce() || !player) return;
		const slip = tractionAt();
		const push = (player._iceCurrent || 0) + (player._iceWind || 0);
		player._iceCurrent = 0;
		player._iceWind = 0;

		if(slip <= 0.02 && !push && !player._iceVx){ player._iceVx = player.vx; return; }

		player._iceVx = player._iceVx || 0;
		const target = mx * speed;
		const grip = 1 - slip;
		/* Grip 1 gives near-instant response, so ordinary stone still
		   feels like ordinary stone. Only authored ice drifts. */
		const accel = 0.12 + grip * 0.58;
		player._iceVx += (target - player._iceVx) * accel;
		if(mx === 0) player._iceVx *= (0.895 + slip * 0.09);
		player._iceVx += push * 0.16;

		const cap = speed * (1.15 + slip * 0.65);
		if(player._iceVx > cap) player._iceVx = cap;
		if(player._iceVx < -cap) player._iceVx = -cap;
		if(Math.abs(player._iceVx) < 0.1 && mx === 0 && !push) player._iceVx = 0;
		player.vx = player._iceVx;
	}

	/* =========================================================
	   FRAGILE ICE DECKS

	   Cracks always precede a break, and thin ice regrows so a
	   room never becomes impassable behind the player.
	   ========================================================= */
	function updateFragile(){
		for(const p of platforms()){
			if(!p._iceFragile) continue;
			if(p._gone){
				if(p.kind !== 'thinIce') continue;
				p._regrow = (p._regrow || 0) + 1;
				if(p._regrow >= (p.regrow || 520)){
					stamp(p.x, p.y, p.w, p.h || T, false);
					p._gone = false;
					p._tick = 0;
					p._cracks = 0;
					p._regrow = 0;
					p._warned = false;
					retile();
				}
				continue;
			}
			const standing = player.onGround &&
				player.x + player.w > p.x + 4 && player.x < p.x + p.w - 4 &&
				player.y + player.h >= p.y - 10 && player.y + player.h <= p.y + (p.h || T) + 14;
			if(standing){
				p._tick = (p._tick || 0) + 1;
			} else if(p._tick > 0 && p.kind === 'thinIce'){
				/* Stepping off lets thin ice settle — rewards light feet. */
				p._tick = Math.max(0, p._tick - 0.6);
			}
			const life = p.life || 140;
			p._cracks = Math.min(1, (p._tick || 0) / life);
			if(p._cracks > 0.45 && !p._warned){
				p._warned = true;
				shake(3, 7);
				if(typeof notify === 'function') notify('The ice is cracking.');
			}
			if(p._cracks >= 1){
				stamp(p.x, p.y, p.w, p.h || T, true);
				p._gone = true;
				p._regrow = 0;
				retile();
				shake(6, 12);
				for(let i = 0; i < 10; i++){
					Ice.puffs.push({
						x: p.x + Math.random() * p.w, y: p.y + 6,
						vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2,
						age: 0, life: 34, r: 3 + Math.random() * 5,
					});
				}
			}
		}
	}

	/* =========================================================
	   HAZARDS
	   ========================================================= */
	function inActiveRoom(hz){
		const r = curRoom();
		return r && hz.roomId === r.id;
	}

	function updateFang(hz){
		hz._t = (hz._t || hz.phase || 0) + 1;
		if(hz._floorY == null) hz._floorY = floorBelow(hz.x + 22, hz.y + T, 1600);
		const cyc = hz._t % hz.period;
		hz.warnOn = cyc >= hz.period - hz.warn;
		if(cyc === hz.period - 1){
			Ice.shards.push({ x: hz.x + 6, y: hz.y + 10, vy: 2, floor: hz._floorY, w: 32, hit:false });
		}
	}

	function updateShards(){
		for(let i = Ice.shards.length - 1; i >= 0; i--){
			const s = Ice.shards[i];
			s.vy += 0.85;
			s.y += s.vy;
			if(!s.hit && player.iFrames <= 0 && hitRect(s.x, s.y, s.w, 56)){
				s.hit = true;
				const soft = bless().cinder ? 0.6 : 1;
				damagePlayer(Math.max(4, Math.round(11 * soft * (typeof DIFF_DMG_MULT === 'number' ? DIFF_DMG_MULT : 1))),
					[{ type:'freeze', dmg: bless().cinder ? 1 : 2, interval:38, ticks:2, color:'#88ddff' }]);
				accrueFrost(2);
			}
			if(s.y >= s.floor - 40){
				for(let k = 0; k < 8; k++){
					Ice.puffs.push({
						x: s.x + 16 + (Math.random() - 0.5) * 30, y: s.floor - 10,
						vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 3,
						age:0, life:26, r:2 + Math.random() * 4,
					});
				}
				Ice.shards.splice(i, 1);
			}
		}
	}

	function updateGeyser(hz){
		hz._t = (hz._t || hz.phase || 0) + 1;
		const cyc = hz._t % hz.period;
		hz.warnOn = cyc >= hz.period - hz.warn && cyc < hz.period - 18;
		hz.erupting = cyc >= hz.period - 18;
		if(!hz.erupting) return;
		const colH = 300;
		if(hitRect(hz.x, hz.y - colH, hz.w, colH + 30)){
			/* A launcher, not a damage source. */
			if(player.vy > -hz.lift * 0.6) player.vy = -hz.lift;
			player.onGround = false;
			accrueFrost(0.4);
		}
		if(cyc === hz.period - 18){
			for(let k = 0; k < 12; k++){
				Ice.puffs.push({
					x: hz.x + Math.random() * hz.w, y: hz.y,
					vx: (Math.random() - 0.5) * 3, vy: -4 - Math.random() * 6,
					age:0, life:40, r:3 + Math.random() * 5,
				});
			}
			shake(3, 6);
		}
	}

	function updateCurrent(hz){
		if(!hitRect(hz.x, hz.y, hz.w, hz.h)) return;
		player._iceCurrent = (player._iceCurrent || 0) + hz.dir * hz.force;
	}

	function updateWater(hz){
		let surface = hz.y, bodyH = hz.h;
		if(global.DungeonFluid && global.DungeonFluid.ready && hz._fluidConsumed){
			const f = global.DungeonFluid.hits(player.x, player.y, player.w, player.h, 'water');
			if(!f) return;
			if(player.x + player.w <= hz.x || player.x >= hz.x + hz.w) return;
			surface = f.y;
			bodyH = f.h;
		} else if(!hitRect(hz.x, hz.y, hz.w, hz.h)) return;
		const mid = player.y + player.h / 2;
		const depth = Math.max(0, Math.min(1, (mid - surface) / Math.max(1, bodyH)));
		Ice.submerged = Math.max(Ice.submerged, depth);
		/* Buoyant and heavy: you can get out, but not quickly. */
		if(player.vy > 1.4) player.vy = 1.4;
		player.vy -= 0.12;
		player._iceVx = (player._iceVx || 0) * 0.9;
		accrueFrost(0.11 + depth * 0.1);
		hz._chill = (hz._chill || 0) + 1;
		if(hz._chill % 72 === 0 && player.iFrames <= 0 && depth > 0.4){
			const soft = bless().cinder ? 0.55 : 1;
			damagePlayer(Math.max(2, Math.round(5 * soft)), null);
		}
	}

	function updateSquall(hz){
		hz._t = (hz._t || 0) + 1;
		const cyc = hz._t % hz.period;
		const q = hz.period * 0.25;
		let s = 0;
		if(cyc < q) s = cyc / q;                      /* building */
		else if(cyc < q * 2) s = 1;                   /* peak */
		else if(cyc < q * 3) s = 1 - (cyc - q * 2) / q; /* easing */
		else s = 0;                                   /* readable lull */
		hz.level = s * hz.strength;
		if(!inActiveRoom(hz)) return;
		Ice.squall = Math.max(Ice.squall, hz.level * (bless().cinder ? 0.72 : 1));
		if(hz.level > 0.5){
			/* Wind shoves along the room; windbreak platforms shelter. */
			let sheltered = false;
			for(const p of platforms()){
				if(!p.windbreak || p._gone) continue;
				if(player.x + player.w > p.x - 60 && player.x < p.x + p.w + 60 &&
				   player.y + player.h > p.y - 200 && player.y < p.y + 120){ sheltered = true; break; }
			}
			if(!sheltered){
				player._iceWind = (player._iceWind || 0) + Math.sin(hz._t * 0.011) * 2.4 * hz.level;
				accrueFrost(0.07 * hz.level);
			}
		}
	}

	function jawClosedAmt(hz){
		const period = hz.period || 200;
		const u = ((hz._t || 0) % period) / period;
		if(u < 0.22){
			const t = u / 0.22;
			return t * t;
		}
		if(u < 0.34) return 1;
		const t = (u - 0.34) / 0.66;
		return Math.pow(1 - t, 1.65);
	}

	function jawPair(hz){
		let L = null, R = null;
		for(const h of hazards()){
			if(h.type !== 'jaw' || h.roomId !== hz.roomId) continue;
			if(h.side === 'left') L = h;
			if(h.side === 'right') R = h;
		}
		return (L && R) ? { L:L, R:R } : null;
	}

	function crushedByJaws(hz){
		const pair = jawPair(hz);
		if(!pair) return false;
		const L = pair.L, R = pair.R;
		const lx = L._x != null ? L._x : L.x;
		const rx = R._x != null ? R._x : R.x;
		const gap = rx - (lx + L.w);
		const inBand = player.y + player.h > L.y + 16 && player.y < L.y + L.h;
		if(!inBand) return false;
		const inSpan = player.x + player.w > lx && player.x < rx + R.w;
		if(!inSpan) return false;
		if(gap < player.w + 10 && (L._closing || R._closing)) return true;
		return hitRect(lx, L.y, L.w, L.h) && hitRect(rx, R.y, R.w, R.h);
	}

	function inJawGap(hz){
		const pair = jawPair(hz);
		if(!pair) return false;
		const L = pair.L, R = pair.R;
		const leftFace = (L._x != null ? L._x : L.x) + L.w;
		const rightFace = R._x != null ? R._x : R.x;
		return player.y + player.h > L.y + 8 && player.y < L.y + L.h &&
			player.x + player.w > leftFace && player.x < rightFace;
	}

	function crushPlayer(){
		if(player._jawCrushed) return;
		player._jawCrushed = true;
		player.iFrames = 0;
		if(typeof damagePlayer === 'function') damagePlayer(9999, ['freeze']);
		else if(typeof health !== 'undefined') health = 0;
		banner('CRUSHED');
		shake(16, 24);
	}

	function updateJaw(hz){
		hz._t = (hz._t || hz.phase || 0) + 1;
		const prev = hz._x != null ? hz._x : (hz.openX != null ? hz.openX : hz.x);
		const k = jawClosedAmt(hz);
		const openX = hz.openX != null ? hz.openX : hz.x;
		const closeX = hz.closeX != null ? hz.closeX : hz.x;
		hz._x = openX + (closeX - openX) * k;
		hz._y = hz.y;
		hz.x = hz._x;
		hz._closing = hz.side === 'left' ? hz._x > prev + 0.15 : hz._x < prev - 0.15;

		const onTop = player.x + player.w > hz._x + 4 && player.x < hz._x + hz.w - 4 &&
			player.y + player.h >= hz._y - 10 && player.y + player.h <= hz._y + 16 &&
			player.vy >= -0.4;
		if(onTop){
			player.y = hz._y - player.h;
			player.vy = 0;
			player.onGround = true;
			player.x += hz._x - prev;
			return;
		}

		if(crushedByJaws(hz)){ crushPlayer(); return; }
		/* Do not shove while you are in the open bite — that was the
		   teleport off the old wall blocks. */
		if(inJawGap(hz)) return;
		if(!hitRect(hz._x, hz._y + 18, hz.w, hz.h - 18)) return;
		if(hz.side === 'left'){
			player.x = hz._x + hz.w + 1;
			player._iceVx = 3;
		} else {
			player.x = hz._x - player.w - 1;
			player._iceVx = -3;
		}
	}

	function updatePress(hz){
		hz._t = (hz._t || hz.phase || 0) + 1;
		const prevX = hz._x != null ? hz._x : hz.x;
		const prevY = hz._y != null ? hz._y : hz.y;
		const u = (hz._t % hz.period) / hz.period;
		/* Ease in and out — glacier creep, not a piston. */
		const off = (1 - Math.cos(u * Math.PI * 2)) * 0.5 * hz.dist;
		hz._x = hz.x + (hz.axis === 'x' ? off : 0);
		hz._y = hz.y + (hz.axis === 'y' ? off : 0);
		const onTop = player.x + player.w > hz._x + 6 && player.x < hz._x + hz.w - 6 &&
			player.y + player.h >= hz._y - 12 && player.y + player.h <= hz._y + 20 &&
			player.vy >= -0.5;
		if(onTop){
			player.y = hz._y - player.h;
			player.vy = 0;
			player.onGround = true;
			player.x += hz._x - prevX;
			return;
		}
		if(!hitRect(hz._x, hz._y + 20, hz.w, Math.max(16, hz.h - 20))) return;
		/* Side overlap only — never fling the player to the far face. */
		if(player.x + player.w * 0.5 < hz._x + hz.w * 0.5){
			player.x = Math.min(player.x, hz._x - player.w - 1);
			player._iceVx = Math.min(player._iceVx || 0, -1);
		} else {
			player.x = Math.max(player.x, hz._x + hz.w + 1);
			player._iceVx = Math.max(player._iceVx || 0, 1);
		}
	}

	function updateRise(hz){
		const r = rooms()[hz.roomId];
		if(hz.armed && r && Env() && Env().visited[hz.roomId] && !hz.active && !hz.vault) hz.active = true;
		if(hz.level == null) hz.level = hz.y0;
		if(hz.active){
			if(hz.level > hz.y1){
				hz.level -= (hz.speed || 0.3);
			} else {
				hz.level = hz.y1;
				hz._upDone = true;
				hz._hold = (hz._hold == null ? (hz.hold || 400) : hz._hold - 1);
				if(hz._hold <= 0){ hz.active = false; }
			}
		} else if(hz._upDone && hz.level < hz.y0){
			hz.level += (hz.speed || 0.3) * 0.7;
		}
		const bottom = r ? r.y + r.h : hz.level + 400;
		if(hz.level < bottom && hitRect(hz.x, hz.level, hz.w, bottom - hz.level)){
			updateWater({ x:hz.x, y:hz.level, w:hz.w, h:bottom - hz.level, _chill:hz._chillRef || 0, roomId:hz.roomId });
			hz._chillRef = (hz._chillRef || 0) + 1;
		}
	}

	function updateCollapse(hz){
		const r = rooms()[hz.roomId];
		if(!r || !Env() || !Env().visited[hz.roomId]) return;
		r._collapseT = (r._collapseT || 0) + (hz === firstCollapseOf(r) ? 1 : 0);
		const t = r._collapseT || 0;
		if(hz.fired) return;
		if(t < hz.delay) return;
		hz.fired = true;
		hz._floorY = floorBelow(hz.x + hz.w / 2, hz.y + hz.h, 1800);
		Ice.debris.push({
			x: hz.x, y: hz.y + hz.h, w: hz.w, vy: 1,
			floor: hz._floorY, age: 0, hit: false,
		});
		shake(8, 16);
	}
	function firstCollapseOf(r){
		for(const hz of hazards()){ if(hz.type === 'collapse' && hz.roomId === r.id) return hz; }
		return null;
	}

	function updateDebris(){
		for(let i = Ice.debris.length - 1; i >= 0; i--){
			const d = Ice.debris[i];
			d.vy += 0.7;
			d.y += d.vy;
			d.age++;
			if(!d.hit && player.iFrames <= 0 && hitRect(d.x, d.y, d.w, 90)){
				d.hit = true;
				damagePlayer(Math.max(6, Math.round(16 * (typeof DIFF_DMG_MULT === 'number' ? DIFF_DMG_MULT : 1))),
					[{ type:'freeze', dmg:2, interval:36, ticks:2, color:'#88ddff' }]);
				accrueFrost(3);
			}
			if(d.y >= d.floor - 60){
				for(let k = 0; k < 14; k++){
					Ice.puffs.push({
						x: d.x + Math.random() * d.w, y: d.floor - 20,
						vx: (Math.random() - 0.5) * 7, vy: -Math.random() * 4,
						age:0, life:38, r:3 + Math.random() * 6,
					});
				}
				Ice.debris.splice(i, 1);
			}
		}
	}

	function updateFrostField(hz){
		if(!hitRect(hz.x, hz.y, hz.w, hz.h)) return;
		accrueFrost(hz.rate);
	}

	function updateHazards(){
		if(!isIce()) return;
		Ice.squall = Math.max(0, Ice.squall - 0.035);
		Ice.submerged = Math.max(0, Ice.submerged - 0.06);
		for(const hz of hazards()){
			switch(hz.type){
				case 'fang': updateFang(hz); break;
				case 'geyser': updateGeyser(hz); break;
				case 'current': updateCurrent(hz); break;
				case 'water': updateWater(hz); break;
				case 'squall': updateSquall(hz); break;
				case 'press': updatePress(hz); break;
				case 'jaw': updateJaw(hz); break;
				case 'rise': updateRise(hz); break;
				case 'collapse': updateCollapse(hz); break;
				case 'frostField': updateFrostField(hz); break;
				default: break; /* slick and mirror are read elsewhere */
			}
		}
		updateShards();
		updateDebris();
		updateFragile();
		for(let i = Ice.puffs.length - 1; i >= 0; i--){
			const p = Ice.puffs[i];
			p.age++;
			p.x += p.vx;
			p.y += p.vy;
			p.vy += 0.14;
			p.vx *= 0.97;
			if(p.age >= p.life) Ice.puffs.splice(i, 1);
		}
	}

	/* =========================================================
	   ROOM RULES
	   ========================================================= */
	function roomEnemies(r){
		if(typeof enemies === 'undefined' || !r) return [];
		return enemies.filter(e => {
			if(!e || e.dead || e.hp <= 0) return false;
			if(e.typeDef && e.typeDef.isBoss) return false;
			if(e.roomId !== r.id) return false;
			const ew = e.w || 40, eh = e.h || 40;
			return e.x + ew > r.x - 8 && e.x < r.x + r.w + 8 &&
				e.y + eh > r.y - 8 && e.y < r.y + r.h + 8;
		});
	}

	/* Returns true when this file has taken responsibility for the
	   room's clear condition. */
	function roomClear(r){
		if(!isIce() || !r || r.cleared) return false;
		if(global.IcePuzzles && IcePuzzles.holdsClear && IcePuzzles.holdsClear(r)) return true;
		const e = Env();
		const done = (msg) => { e.clearRoom(r, msg); return true; };
		const inZone = (z) => z && hitRect(z.x, z.y, z.w, z.h);

		switch(r.kind){
			case 'combat':
			case 'elite':
			case 'shatter':
			case 'secretElite':
				if((e.visited[r.id] || e.currentRoom === r) && roomEnemies(r).length === 0) return done('THE CHAMBER STILLS');
				return true;
			case 'knight':
				if(e.visited[r.id] && roomEnemies(r).length === 0) return done('THE ICE RELEASES ITS WARRIOR');
				return true;
			case 'traversal':
			case 'lake':
			case 'river':
			case 'bridge':
			case 'ascent':
			case 'descent':
			case 'slide':
			case 'heart':
			case 'mirror':
				if(r.kind === 'mirror') return true;
				if(inZone(r.clearZone)) return done('THE FAR SIDE');
				return true;
			case 'flood':
				if(inZone(r.clearZone)) return done('HIGHER GROUND');
				return true;
			case 'collapseEvent':
				if(inZone(r.clearZone)) return done('CLEAR OF THE COLLAPSE');
				return true;
			case 'blizzard':
				if(r.surviveLeft > 0){
					r.surviveLeft--;
					r.objective = 'SURVIVE THE SQUALL — ' + Math.ceil(r.surviveLeft / 60) + 's';
					if(r.surviveLeft <= 0) return done('The squall passes.');
				}
				return true;
			case 'mechanism': {
				const rings = interacts().filter(i => i.kind === 'ring' && i.roomId === r.id);
				const done2 = rings.filter(i => i.used).length;
				r.objective = 'ENGAGE THE RINGS IN ORDER — ' + done2 + ' / ' + rings.length;
				if(rings.length && done2 >= rings.length){
					if(!Ice.flags.shortcutOpen && r.shortcutTo != null){
						Ice.flags.shortcutOpen = true;
						banner('An ancient gate opens behind you.');
					}
					addFrost(-8, '-FROST');
					return done('The rings align.');
				}
				return true;
			}
			case 'prison': {
				const it = interacts().find(i => i.kind === 'prison' && i.roomId === r.id);
				if(it && it.used && roomEnemies(r).length === 0) return done('The sealed one falls.');
				if(!it || !it.used){ r.objective = 'FREE IT, OR WALK AWAY'; }
				return true;
			}
			case 'secretMemory': {
				const it = interacts().find(i => i.kind === 'memory' && i.roomId === r.id);
				if(it && it.used) return done('The ice lets the memory go.');
				return true;
			}
			case 'secretShrine': {
				const it = interacts().find(i => i.kind === 'relic' && i.roomId === r.id);
				if(it && it.used) return done('The relic is yours.');
				return true;
			}
			case 'vault': {
				const it = interacts().find(i => i.kind === 'vault' && i.roomId === r.id);
				if(it && it.used && !it._pendingLoot) return done('The vault stills.');
				return true;
			}
			case 'trial':
				if(r._trialDone) return done('The trial is complete.');
				return true;
			case 'warming':
			case 'shrine':
			case 'iceFork':
			case 'deepFork':
			case 'cache':
			case 'secretCave':
			case 'start':
			case 'preboss':
				return true;
			case 'boss': {
				const living = (typeof enemies !== 'undefined' ? enemies : []).some(en =>
					en && !en.dead && en.hp > 0 && en.type === 'frostColossus' &&
					(en.roomId === r.id || (en.x + (en.w || 40) > r.x && en.x < r.x + r.w && en.y + (en.h || 40) > r.y && en.y < r.y + r.h))
				);
				if(living) return true;
				if(e.visited[r.id] || e.currentRoom === r) return done('THE COLOSSUS IS STILL');
				return true;
			}
			default:
				return false;
		}
	}

	function lockKnightCourt(r){
		if(!r || r._knightLocked || r.cleared) return;
		r._knightLocked = true;
		r.locked = true;
		const e = Env();
		const used = r.usedExits || {};
		const ex = r.exits || {};
		const gates = r.outGates || [];
		function addGate(g){
			for(let i = 0; i < gates.length; i++){
				if(Math.abs(gates[i].x - g.x) < 8 && Math.abs(gates[i].y - g.y) < 8) return gates[i];
			}
			gates.push(g);
			return g;
		}
		if(used.left && ex.left) addGate({ x:r.x - 40, y:r.y + ex.left.y, w:80, h:ex.left.h || 200 });
		if(used.right && ex.right) addGate({ x:r.x + r.w - 40, y:r.y + ex.right.y, w:80, h:ex.right.h || 200 });
		if(used.top && ex.top) addGate({ x:r.x + (ex.top.x || 0), y:r.y - 40, w:ex.top.w || 200, h:80 });
		if(used.bottom && ex.bottom) addGate({ x:r.x + (ex.bottom.x || 0), y:r.y + r.h - 40, w:ex.bottom.w || 200, h:80 });
		r.outGates = gates;
		if(e && e.sealGate){
			for(let i = 0; i < gates.length; i++) e.sealGate(gates[i], true);
		}
	}

	/* Room-entry beats: banner, frost from exposure, event arming. */
	function roomEnter(r){
		if(!isIce() || !r) return;
		let gain = 0;
		if(r.section >= 3) gain += 2;
		if(r.section >= 4) gain += 2;
		if(r.hot) gain += 5;
		if(r.kind === 'blizzard' || r.kind === 'lake' || r.kind === 'river' || r.kind === 'flood') gain += 3;
		if(gain) addFrost(Math.round(frostGain(gain)), '+FROST');

		const L = r.label || 'Chamber';
		switch(r.kind){
			case 'start': banner('THE GLACIAL REACH'); break;
			case 'traversal': case 'bridge': banner(L + ' — reach the far side.'); break;
			case 'lake': banner(L + ' — the ice will not hold everywhere.'); break;
			case 'river': banner(L + ' — mind the current.'); break;
			case 'ascent': banner(L + ' — climb.'); break;
			case 'descent': banner(L + ' — go down.'); break;
			case 'slide': banner(L + ' — you will not be able to stop.'); break;
			case 'flood': banner('THE WATER IS RISING'); break;
			case 'collapseEvent': banner('THE GALLERY IS FAILING — RUN'); break;
			case 'blizzard': banner('A SQUALL IS COMING IN'); break;
			case 'mirror': banner(L + ' — not everything here is real.'); break;
			case 'mechanism': banner(L + ' — the rings remember an order.'); break;
			case 'shatter': banner(L + ' — the floor is not all floor.'); break;
			case 'prison': banner(L + ' — something is sealed here.'); break;
			case 'vault': banner(L + ' — optional, and it will notice you.'); break;
			case 'shrine': banner(L + ' — choose one blessing.'); break;
			case 'warming': banner(L + ' — warmth, at last.'); break;
			case 'trial': banner(L + ' — optional challenge.'); break;
			case 'iceFork': case 'deepFork': banner(L + ' — choose a route.'); break;
			case 'heart': banner('THE GLACIAL HEART'); break;
			case 'knight':
				banner('THE ICE KEPT ITS WARRIOR');
				lockKnightCourt(r);
				break;
			case 'preboss': banner('THE LAST GATE'); break;
			case 'boss':
				banner('THE GLACIAL HEART — SOMETHING ENORMOUS MOVES');
				lockKnightCourt(r);
				break;
			case 'secretCave': case 'secretShrine': case 'secretMemory': banner('A HIDDEN PLACE'); break;
			case 'elite': banner(L + ' — an elite holds this ground.'); break;
			default: if(!r.noCombat) banner(L + ' — clear it.'); break;
		}
	}

	function onEnemyDeath(en){
		if(!isIce() || !en) return;
		if(en.type === 'frostboundKnight'){
			Ice.flags.knightSlain = true;
			const e = Env();
			if(e && e.modifiers) e.modifiers.knightSlain = true;
			addFrost(-18, '-FROST');
			banner('THE FROSTBOUND KNIGHT IS STILL');
		}
		const host = rooms()[en.roomId];
		if(host && !host.cleared) roomClear(host);
	}

	/* =========================================================
	   INTERACTION
	   ========================================================= */
	function near(it, reach){
		const px = player.x + player.w / 2, py = player.y + player.h / 2;
		const r = reach || 96;
		return Math.abs(px - (it.x + (it.w || 60) / 2)) < r && Math.abs(py - (it.y + (it.h || 60) / 2)) < r + 24;
	}

	/* Returns true when this file handled the interaction. */
	function tryInteract(){
		if(!isIce()) return false;
		const e = Env();
		if(!e || e.choiceOpen) return false;
		for(const it of interacts()){
			if(it.used || it.kind === 'banner' || it.kind === 'doorSign') continue;
			if(!near(it)) continue;

			if(it.kind === 'hearth'){
				it.used = true;
				Ice.flags.hearths++;
				addFrost(-45, '-FROST');
				if(typeof health !== 'undefined' && typeof maxHealth !== 'undefined'){
					health = Math.min(maxHealth, health + Math.round(maxHealth * 0.22));
				}
				banner('The old hearth still holds heat. Frost recedes.');
				return true;
			}
			if(it.kind === 'ring'){
				if(global.IcePuzzles && IcePuzzles.tryInteract(it)) return true;
				const room = rooms()[it.roomId];
				const rings = interacts().filter(i => i.kind === 'ring' && i.roomId === it.roomId)
					.sort((a, b) => a.order - b.order);
				const nextOrder = rings.filter(i => i.used).length + 1;
				if(it.order !== nextOrder){
					/* Wrong ring resets the sequence — readable, not punishing. */
					for(const rg of rings) rg.used = false;
					banner('The rings grind and reset.');
					shake(5, 10);
					accrueFrost(2);
					return true;
				}
				it.used = true;
				shake(4, 8);
				banner('Ring ' + it.order + ' engages.');
				for(const dec of ((D() && D().decorations) || [])){
					if(dec.type === 'ancientMechanism' && Math.abs(dec.x - it.x) < 160) dec.active = true;
				}
				return true;
			}
			if(it.kind === 'crackedIce'){
				it.used = true;
				const gates = (D() && D()._gates) || [];
				const g = gates[it.secretGate];
				if(g && e.sealGate) e.sealGate(g, false);
				banner('The cracked ice gives way.');
				shake(7, 14);
				for(let k = 0; k < 18; k++){
					Ice.puffs.push({
						x: it.x + Math.random() * it.w, y: it.y + Math.random() * it.h,
						vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 6,
						age:0, life:40, r:2 + Math.random() * 5,
					});
				}
				return true;
			}
			if(it.kind === 'relic'){
				it.used = true;
				if(e.blessings){ e.blessings.step = true; e.blessings.sink = true; }
				addFrost(-30, '-FROST');
				if(e.grantLoot) e.grantLoot(e.themeLoot ? e.themeLoot(true) : null, 'The relic answers.');
				banner('GLACIER RELIC — Winter Step and Cold Blood, together.');
				return true;
			}
			/* Shared fixtures: IceWorld shows the prompt, so it must
			   also fire the action. Delegate to the env helpers. */
			if(it.kind === 'shrine' && e.openShrine){ e.openShrine(it); return true; }
			if(it.kind === 'trial' && e.startTrial){ e.startTrial(it); return true; }
			if(it.kind === 'vault' && e.openVault){ e.openVault(it); return true; }
			if(it.kind === 'prison' && e.openPrison){ e.openPrison(it); return true; }
			if(it.kind === 'cache' && e.openCache){ e.openCache(it); return true; }
			if(it.kind === 'memory'){
				if(global.IcePuzzles && IcePuzzles.tryInteract(it)) return true;
				if(e.openMemory){ e.openMemory(it); return true; }
			}
		}
		return false;
	}

	function prompt(){
		if(!isIce()) return null;
		for(const it of interacts()){
			if(it.used || it.kind === 'banner' || it.kind === 'doorSign') continue;
			if(!near(it)) continue;
			if(it.kind === 'hearth') return 'E — Warm yourself at the hearth';
			if(it.kind === 'ring') return 'E — Engage the ring';
			if(it.kind === 'crackedIce') return 'E — Break the cracked ice';
			if(it.kind === 'relic') return 'E — Take the glacier relic';
			if(it.kind === 'prison') return 'E — Break the seal';
			if(it.kind === 'shrine') return 'E — Choose a blessing';
			if(it.kind === 'vault') return 'E — Open the frozen vault';
			if(it.kind === 'cache') return 'E — Open the chest';
			if(it.kind === 'memory') return 'E — Read the ice';
			if(it.kind === 'trial') return 'E — Begin the frost trial';
		}
		return null;
	}

	/* =========================================================
	   RENDERING
	   ========================================================= */
	function cam(){ return (typeof camera !== 'undefined') ? camera : { x:0, y:0 }; }
	function now(){ return Date.now() * 0.001; }

	/* Ice-material platform. Every walkable surface in the Reach is
	   drawn from the same glacier material so the dungeon reads as
	   one continuous mass of ice. */
	function platformOverWater(p){
		for(const hz of hazards()){
			if(hz.type !== 'water' && hz.type !== 'current' && hz.type !== 'frozenRiverBand') continue;
			if(p.x + p.w < hz.x || p.x > hz.x + hz.w) continue;
			if(p.y < hz.y + 20 && p.y + 140 > hz.y) return true;
		}
		return false;
	}

	function drawPlatform(ctx, p){
		const P = props();
		const c = cam();
		const sx = p.x - c.x, sy = p.y - c.y;
		const h = p.h || T;
		if(sx + p.w < -60 || sx > canvas.width + 60 || sy + h < -60 || sy > canvas.height + 60) return;
		ctx.save();
		ctx.translate(sx, sy);
		if(P && P.iceMass) P.iceMass(ctx, p.w, h, { seed: p.x * 0.017, alpha: p._iceFragile ? 0.72 : 0.95 });
		else { ctx.fillStyle = '#3f7fa8'; ctx.fillRect(0, 0, p.w, h); }
		/* Snow on the walk surface and icicles only under this slab —
		   never a second ledge floating above the collision. */
		if(P){
			ctx.fillStyle = '#f2f9ff';
			ctx.globalAlpha = 0.82;
			ctx.fillRect(1, 0, p.w - 2, 3);
			ctx.globalAlpha = 1;
			if(P.icicle && p.w > 36 && !platformOverWater(p)){
				const n = Math.max(2, Math.round(p.w / 38));
				for(let i = 0; i < n; i++){
					const ix = (i + 0.5) * (p.w / n);
					P.icicle(ctx, ix, h, 7 + (i % 3) * 5, 4.5, p.x * 0.013 + i);
				}
			}
		}
		if(p._iceFragile){
			const k = p._cracks || 0;
			/* Cracks grow visibly before anything gives way. */
			if(k > 0.05 && P && P.crackWeb){
				ctx.globalAlpha = 0.35 + k * 0.6;
				const rings = 1 + Math.floor(k * 3);
				for(let i = 0; i < rings; i++){
					P.crackWeb(ctx, p.w * (0.2 + i * 0.3), h * 0.5, Math.min(p.w * 0.3, 20 + k * 34),
						4 + i, p.x * 0.01 + i, 'rgba(255,255,255,' + (0.5 + k * 0.4) + ')', 1 + k);
				}
				ctx.globalAlpha = 1;
			}
			if(k > 0.45){
				const flash = 0.2 + Math.abs(Math.sin(now() * 7)) * 0.35 * k;
				ctx.globalAlpha = flash;
				ctx.fillStyle = '#e6f5ff';
				ctx.fillRect(0, 0, p.w, h);
				ctx.globalAlpha = 1;
			}
		}
		if(p.safeZone){
			/* Knight-arena safe daises are always legible. */
			ctx.globalAlpha = 0.3 + Math.sin(now() * 1.6) * 0.08;
			ctx.strokeStyle = '#8fe0ff';
			ctx.lineWidth = 2;
			ctx.strokeRect(1, 1, p.w - 2, h - 2);
			ctx.globalAlpha = 1;
		}
		ctx.restore();
	}

	function overlaySolidTiles(ctx){
		if(typeof tileMap === 'undefined' || typeof camera === 'undefined') return;
		const d = D();
		const wc1 = (d && d.wallColor) || '#12304a';
		const wc2 = (d && d.wallColor2) || '#1b4467';
		const we = (d && d.wallEdge) || '#5fa6cc';
		const startCol = Math.max(0, Math.floor(camera.x / T));
		const endCol = Math.min((typeof MAP_COLS === 'number' ? MAP_COLS : tileMap[0].length) - 1, Math.ceil((camera.x + canvas.width) / T));
		const startRow = Math.max(0, Math.floor(camera.y / T));
		const endRow = Math.min((typeof MAP_ROWS === 'number' ? MAP_ROWS : tileMap.length) - 1, Math.ceil((camera.y + canvas.height) / T));
		for(let r = startRow; r <= endRow; r++){
			const row = tileMap[r];
			if(!row) continue;
			for(let c = startCol; c <= endCol; c++){
				if(row[c] !== 0) continue;
				const sx = c * T - camera.x, sy = r * T - camera.y;
				const hash = (r * 73 + c * 137) % 20;
				ctx.fillStyle = hash < 14 ? wc1 : wc2;
				ctx.fillRect(sx, sy, T, T);
				const airTop = r > 0 && tileMap[r - 1] && tileMap[r - 1][c] === 1;
				const airBot = tileMap[r + 1] && tileMap[r + 1][c] === 1;
				const airLeft = row[c - 1] === 1;
				const airRight = row[c + 1] === 1;
				if(airTop || airBot || airLeft || airRight){
					ctx.fillStyle = we;
					if(airTop) ctx.fillRect(sx, sy, T, 3);
					if(airBot) ctx.fillRect(sx, sy + T - 3, T, 3);
					if(airLeft) ctx.fillRect(sx, sy, 3, T);
					if(airRight) ctx.fillRect(sx + T - 3, sy, 3, T);
				}
			}
		}
	}

	function drawWorld(ctx){
		if(!isIce()) return;
		plantDecorations();
		const P = props();
		const c = cam();
		const off = (x, y) => ({ x: x - c.x, y: y - c.y });
		const vis = (x, y, w, h) => (x - c.x + w > -80 && x - c.x < canvas.width + 80 && y - c.y + h > -80 && y - c.y < canvas.height + 80);

		/* --- current beds sit under everything else (no water-body fill) --- */
		for(const hz of hazards()){
			if(hz.type === 'current' && vis(hz.x, hz.y, hz.w, hz.h)){
				const s = off(hz.x, hz.y);
				const flowT = (now() * 0.55) % 1;
				ctx.save();
				for(let i = 0; i < 8; i++){
					const t = ((i / 8) + flowT) % 1;
					const cx = hz.dir > 0 ? t * hz.w : (1 - t) * hz.w;
					ctx.globalAlpha = 0.26 * Math.sin(t * Math.PI);
					ctx.strokeStyle = '#e6f5ff';
					ctx.lineWidth = 2.2;
					ctx.beginPath();
					ctx.moveTo(s.x + cx - 10 * hz.dir, s.y + hz.h * 0.45 - 7);
					ctx.lineTo(s.x + cx + 8 * hz.dir, s.y + hz.h * 0.45);
					ctx.lineTo(s.x + cx - 10 * hz.dir, s.y + hz.h * 0.45 + 7);
					ctx.stroke();
				}
				ctx.restore();
			}
		}

		/* --- slick sheen so low-traction ground is never a surprise --- */
		for(const hz of hazards()){
			if(hz.type !== 'slick' || !vis(hz.x, hz.y, hz.w, hz.h + 8)) continue;
			const s = off(hz.x, hz.y);
			const a = 0.1 + hz.slip * 0.22;
			ctx.save();
			ctx.globalAlpha = a;
			ctx.fillStyle = '#cfeaf8';
			ctx.fillRect(s.x, s.y, hz.w, 6);
			/* Sliding specular streaks read as "this is polished". */
			const streak = ((now() * 0.16 + hz.x * 0.001) % 1) * (hz.w + 200) - 100;
			ctx.globalAlpha = a * 1.4;
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(s.x + streak, s.y + 1, 90, 2.5);
			ctx.globalAlpha = 1;
			ctx.restore();
		}

		/* Authored ice props sit behind walkable ice so walls read as
		   the chamber, not as stickers pasted on the floor. */
		const decs = (D() && D().decorations) || [];
		for(const dec of decs){
			const dw = dec.w || (dec.r ? dec.r * 2 : 80), dh = dec.h || (dec.r ? dec.r * 2 : 80);
			if(!vis(dec.x, dec.y - 180, Math.max(dw, 200), dh + 220)) continue;
			if(global.IceArt && IceArt.handlesDecor && IceArt.handlesDecor(dec)){
				IceArt.drawDecor(ctx, dec);
				continue;
			}
			const s = off(dec.x, dec.y);
			if(P && P.draw) P.draw(ctx, dec, s.x, s.y);
		}
		/* Tile walls sit in front of props so ice does not phase through stone.
		   When IceArt already painted the tileset, skip the flat overlay. */
		if(!(global.IceArt && IceArt.isIce && IceArt.isIce())) overlaySolidTiles(ctx);

		/* --- platforms --- */
		for(const p of platforms()){
			if(p._gone) continue;
			if(global.DungeonSkin && DungeonSkin.owns && DungeonSkin.owns(p)) continue;
			drawPlatform(ctx, p);
		}

		/* --- mirror planes and their lies --- */
		for(const hz of hazards()){
			if(hz.type !== 'mirror' || !vis(hz.x, hz.y, hz.w, hz.h)) continue;
			const s = off(hz.x, hz.y);
			ctx.save();
			ctx.globalAlpha = 0.5 + Math.sin(now() * 0.6 + hz.x * 0.01) * 0.08;
			if(hz.fake === 'ledge'){
				/* A ledge that is not there. Drawn a shade too clean. */
				ctx.translate(s.x, s.y + hz.h - 26);
				if(P) P.iceMass(ctx, hz.w, 24, { seed: hz.x * 0.02, alpha: 0.7 });
			} else {
				ctx.translate(s.x, s.y);
				ctx.fillStyle = 'rgba(154,212,236,0.35)';
				ctx.fillRect(0, hz.h - 12, hz.w, 12);
			}
			ctx.restore();
			/* The tell: a specular seam that slides the wrong way. */
			ctx.save();
			ctx.globalAlpha = 0.22;
			const seam = ((now() * -0.2 + hz.x * 0.002) % 1) * hz.w;
			ctx.fillStyle = '#ffffff';
			ctx.fillRect(s.x + seam, s.y, 3, hz.h);
			ctx.restore();
		}

		/* --- glacier creep masses --- */
		for(const hz of hazards()){
			if(hz.type !== 'press' && hz.type !== 'jaw') continue;
			const hx = hz._x == null ? hz.x : hz._x;
			const hy = hz._y == null ? hz.y : hz._y;
			if(!vis(hx, hy, hz.w, hz.h)) continue;
			const s = off(hx, hy);
			ctx.save();
			ctx.translate(s.x, s.y);
			if(P){
				P.iceMass(ctx, hz.w, hz.h, { seed: hz.x * 0.013, alpha: 0.96 });
				P.strata(ctx, hz.w, hz.h, hz.x * 0.02, 24);
			}
			/* Leading edge is bright so the closing side is obvious. */
			ctx.globalAlpha = 0.55;
			ctx.fillStyle = '#f2f9ff';
			if(hz.type === 'jaw'){
				if(hz.side === 'left') ctx.fillRect(hz.w - 6, 0, 6, hz.h);
				else ctx.fillRect(0, 0, 6, hz.h);
			} else if(hz.axis === 'x') ctx.fillRect(hz.w - 5, 0, 5, hz.h);
			else ctx.fillRect(0, hz.h - 5, hz.w, 5);
			ctx.globalAlpha = 1;
			ctx.restore();
		}

		/* --- ceiling fangs: shadow first, then the drop --- */
		for(const hz of hazards()){
			if(hz.type !== 'fang' || !vis(hz.x, hz.y, hz.w, 120)) continue;
			const s = off(hz.x, hz.y);
			ctx.save();
			if(P) P.icicle(ctx, s.x + 22, s.y, hz.warnOn ? 52 : 38, 26, hz.x * 0.01);
			if(hz.warnOn){
				const fy = (hz._floorY == null ? hz.y + 400 : hz._floorY) - c.y;
				const pulse = 0.25 + Math.abs(Math.sin(now() * 9)) * 0.3;
				ctx.globalAlpha = pulse;
				ctx.fillStyle = '#0a1622';
				ctx.beginPath();
				ctx.ellipse(s.x + 22, fy - 4, 26, 7, 0, 0, Math.PI * 2);
				ctx.fill();
				ctx.globalAlpha = pulse * 0.8;
				ctx.strokeStyle = '#e6f5ff';
				ctx.lineWidth = 1.5;
				ctx.beginPath();
				ctx.ellipse(s.x + 22, fy - 4, 26, 7, 0, 0, Math.PI * 2);
				ctx.stroke();
				ctx.globalAlpha = 1;
			}
			ctx.restore();
		}
		for(const s of Ice.shards){
			const o = off(s.x, s.y);
			ctx.save();
			if(P) P.icicle(ctx, o.x + 16, o.y, 58, 30, s.x * 0.01);
			ctx.globalAlpha = 0.35;
			ctx.fillStyle = '#cfeaf8';
			ctx.fillRect(o.x + 12, o.y - 30, 8, 30);
			ctx.globalAlpha = 1;
			ctx.restore();
		}

		/* --- geysers --- */
		for(const hz of hazards()){
			if(hz.type !== 'geyser' || !vis(hz.x, hz.y - 320, hz.w, 360)) continue;
			const s = off(hz.x, hz.y);
			ctx.save();
			/* Vent rim. */
			ctx.globalAlpha = 0.7;
			ctx.fillStyle = '#9ad4ec';
			ctx.fillRect(s.x - 6, s.y - 4, hz.w + 12, 6);
			ctx.globalAlpha = 1;
			if(hz.warnOn){
				const pulse = 0.3 + Math.abs(Math.sin(now() * 8)) * 0.35;
				ctx.globalAlpha = pulse;
				ctx.fillStyle = '#e6f5ff';
				ctx.beginPath();
				ctx.ellipse(s.x + hz.w / 2, s.y - 2, hz.w * 0.6, 10, 0, 0, Math.PI * 2);
				ctx.fill();
				ctx.globalAlpha = pulse * 0.5;
				ctx.strokeStyle = '#8fe0ff';
				ctx.lineWidth = 2;
				for(let i = 1; i <= 3; i++){
					ctx.beginPath();
					ctx.moveTo(s.x + hz.w * 0.5 - 10, s.y - i * 24);
					ctx.lineTo(s.x + hz.w * 0.5, s.y - i * 24 - 12);
					ctx.lineTo(s.x + hz.w * 0.5 + 10, s.y - i * 24);
					ctx.stroke();
				}
				ctx.globalAlpha = 1;
			}
			if(hz.erupting){
				const colH = 300;
				const g = ctx.createLinearGradient(0, s.y, 0, s.y - colH);
				g.addColorStop(0, 'rgba(232,247,255,0.85)');
				g.addColorStop(0.4, 'rgba(154,212,236,0.55)');
				g.addColorStop(1, 'rgba(154,212,236,0)');
				ctx.fillStyle = g;
				ctx.beginPath();
				ctx.moveTo(s.x + 4, s.y);
				ctx.lineTo(s.x + hz.w * 0.5 - 26, s.y - colH);
				ctx.lineTo(s.x + hz.w * 0.5 + 26, s.y - colH);
				ctx.lineTo(s.x + hz.w - 4, s.y);
				ctx.closePath();
				ctx.fill();
			}
			ctx.restore();
		}

		/* --- collapse debris --- */
		for(const d of Ice.debris){
			const o = off(d.x, d.y);
			ctx.save();
			ctx.translate(o.x, o.y);
			if(P) P.iceMass(ctx, d.w, 80, { seed: d.x * 0.02, alpha: 0.9 });
			ctx.globalAlpha = 0.4;
			ctx.fillStyle = '#cfeaf8';
			ctx.fillRect(0, -140, d.w, 140);
			ctx.globalAlpha = 1;
			ctx.restore();
		}
		/* Warning band for a collapse that has not dropped yet. */
		for(const hz of hazards()){
			if(hz.type !== 'collapse' || hz.fired) continue;
			const r = rooms()[hz.roomId];
			if(!r || !Env() || !Env().visited[hz.roomId]) continue;
			const t = r._collapseT || 0;
			const lead = hz.delay - t;
			if(lead > 90 || lead < 0) continue;
			if(!vis(hz.x, hz.y, hz.w, hz.h)) continue;
			const s = off(hz.x, hz.y);
			const pulse = 0.2 + (1 - lead / 90) * 0.5;
			ctx.save();
			ctx.globalAlpha = pulse;
			ctx.strokeStyle = '#8fe0ff';
			ctx.lineWidth = 2;
			ctx.strokeRect(s.x, s.y, hz.w, hz.h);
			if(P) P.crackWeb(ctx, s.x + hz.w / 2, s.y + hz.h, hz.w * 0.4, 6, hz.x * 0.01, 'rgba(232,247,255,0.7)', 1.6);
			ctx.globalAlpha = 1;
			ctx.restore();
		}

		/* --- gates --- */
		for(const r of rooms()){
			if(!r.outGates || r.cleared) continue;
			for(const g of r.outGates){
				if(!vis(g.x, g.y, g.w, g.h)) continue;
				const s = off(g.x, g.y);
				ctx.save();
				ctx.translate(s.x, s.y);
				if(P) P.iceMass(ctx, g.w, g.h, { seed: g.x * 0.02, alpha: 0.9 });
				ctx.globalAlpha = 0.5;
				ctx.strokeStyle = '#8fe0ff';
				ctx.lineWidth = 2;
				ctx.strokeRect(1, 1, g.w - 2, g.h - 2);
				ctx.globalAlpha = 1;
				if(P) P.icicle(ctx, g.w * 0.5, 4, Math.min(60, g.h * 0.4), 12, g.x * 0.01);
				ctx.restore();
			}
		}

		/* --- snow bursts --- */
		for(const p of Ice.puffs){
			const o = off(p.x, p.y);
			ctx.save();
			ctx.globalAlpha = 0.7 * (1 - p.age / p.life);
			ctx.fillStyle = '#f2f9ff';
			ctx.beginPath();
			ctx.arc(o.x, o.y, p.r * (1 - p.age / p.life * 0.4), 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
		}
	}

	/* Ice-only interactable art. Returns true when handled. */
	function drawInteractable(ctx, it, sx, sy){
		if(!isIce()) return false;
		if(it.kind !== 'doorSign') return false;
		ctx.save();
		ctx.globalAlpha = 0.72;
		ctx.fillStyle = '#04101c';
		const tw = Math.max(180, (it.text || '').length * 8);
		ctx.fillRect(sx + (it.w || 200) / 2 - tw / 2, sy, tw, 30);
		ctx.globalAlpha = 0.5;
		ctx.strokeStyle = '#5fa6cc';
		ctx.lineWidth = 1.5;
		ctx.strokeRect(sx + (it.w || 200) / 2 - tw / 2, sy, tw, 30);
		ctx.globalAlpha = 1;
		ctx.fillStyle = '#cfeaf8';
		ctx.font = 'bold 12px Arial';
		ctx.textAlign = 'center';
		ctx.fillText(it.text || '', sx + (it.w || 200) / 2, sy + 20);
		ctx.restore();
		return true;
	}

	/* Depth pass: drawn right after the tilemap so the air in every
	   chamber has cold aerial perspective instead of a flat fill. */
	function drawAmbience(ctx){
		if(!isIce()) return;
		const c = cam();
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);

		/* Vertical depth grade — deeper is darker and bluer. */
		const d = D();
		const depthT = Math.max(0, Math.min(1, (c.y + canvas.height * 0.5) / Math.max(1, d.worldH)));
		const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
		g.addColorStop(0, 'rgba(18,48,74,' + (0.1 + depthT * 0.12) + ')');
		g.addColorStop(0.55, 'rgba(7,24,41,' + (0.05 + depthT * 0.1) + ')');
		g.addColorStop(1, 'rgba(4,16,28,' + (0.16 + depthT * 0.2) + ')');
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		/* Ghosted strata drifting behind the play space — parallax, so
		   large chambers read as genuinely large. */
		const par = 0.35;
		const bandH = 150;
		const y0 = -((c.y * par) % bandH);
		ctx.globalAlpha = 0.05;
		ctx.fillStyle = '#9ad4ec';
		for(let y = y0; y < canvas.height; y += bandH){
			ctx.fillRect(0, y, canvas.width, 2);
			ctx.fillRect(0, y + bandH * 0.42, canvas.width, 1);
		}
		ctx.globalAlpha = 1;

		/* Airborne snow, three parallax layers. */
		const t = now();
		for(let layer = 0; layer < 3; layer++){
			const pf = 0.25 + layer * 0.35;
			const count = 26 + layer * 12;
			const size = 1 + layer * 0.8;
			ctx.globalAlpha = 0.1 + layer * 0.08;
			ctx.fillStyle = '#f2f9ff';
			for(let i = 0; i < count; i++){
				const seed = i * 37.7 + layer * 911;
				const sx = ((seed * 71 + t * (12 + layer * 22) - c.x * pf) % (canvas.width + 60)) - 30;
				const sy = ((seed * 53 + t * (26 + layer * 40) - c.y * pf) % (canvas.height + 60)) - 30;
				const wob = Math.sin(t * 0.8 + seed) * (3 + layer * 3);
				ctx.beginPath();
				ctx.arc(sx + wob, sy, size, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		ctx.globalAlpha = 1;
		ctx.restore();
	}

	/* Weather and player-state pass: drawn after entities so a squall
	   actually obscures the fight, while never hiding the player. */
	function drawOverlay(ctx){
		if(!isIce()) return;
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);

		if(Ice.squall > 0.02){
			const s = Ice.squall;
			const px = player.x + player.w / 2 - cam().x;
			const py = player.y + player.h / 2 - cam().y;
			/* A guaranteed clear bubble keeps the room understandable. */
			const clear = 300 - s * 90;
			const g = ctx.createRadialGradient(px, py, clear * 0.35, px, py, clear * 2.6);
			g.addColorStop(0, 'rgba(214,235,248,0)');
			g.addColorStop(0.4, 'rgba(214,235,248,' + (s * 0.4) + ')');
			g.addColorStop(1, 'rgba(224,240,250,' + (s * 0.72) + ')');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			/* Driven snow streaks. */
			const t = now();
			ctx.globalAlpha = s * 0.45;
			ctx.strokeStyle = '#ffffff';
			ctx.lineWidth = 1.4;
			for(let i = 0; i < 70; i++){
				const seed = i * 17.3;
				const sx = ((seed * 91 + t * 900) % (canvas.width + 200)) - 100;
				const sy = ((seed * 57 + t * 260) % (canvas.height + 120)) - 60;
				ctx.beginPath();
				ctx.moveTo(sx, sy);
				ctx.lineTo(sx - 34 - s * 26, sy + 9);
				ctx.stroke();
			}
			ctx.globalAlpha = 1;
		}

		if(Ice.submerged > 0.05){
			ctx.globalAlpha = Ice.submerged * 0.3;
			const g = ctx.createLinearGradient(0, canvas.height * 0.4, 0, canvas.height);
			g.addColorStop(0, 'rgba(31,111,158,0)');
			g.addColorStop(1, 'rgba(13,58,92,0.9)');
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.globalAlpha = 1;
		}

		/* Frost rime creeping in from the screen edges. Cosmetic, but
		   it is the readout the player actually feels. */
		const pen = frostPenalty();
		if(pen > 0){
			const f = frost();
			const strength = pen === 2 ? 0.4 + (f - 70) / 100 : 0.18;
			ctx.globalAlpha = strength;
			const vg = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.35,
				canvas.width / 2, canvas.height / 2, canvas.height * 0.85);
			vg.addColorStop(0, 'rgba(214,235,248,0)');
			vg.addColorStop(1, 'rgba(232,247,255,0.9)');
			ctx.fillStyle = vg;
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.globalAlpha = strength * 0.8;
			/* Rime spines along the frame. */
			const P = props();
			if(P){
				for(let i = 0; i < 26; i++){
					const t2 = i / 26;
					P.icicle(ctx, t2 * canvas.width + 12, 0, 14 + Math.sin(i * 2.3) * 10 + pen * 8, 16, i);
				}
			}
			ctx.globalAlpha = 1;
		}
		ctx.restore();
	}

	function meterHint(){
		const f = Math.round(frost());
		const lvl = f >= 70 ? 'Deep Frost — you are slowing down'
			: f >= 40 ? 'Frost is setting in'
			: 'Frost is manageable';
		return f + ' — ' + lvl + '. Warm yourself where you can.';
	}

	function init(){
		if(!isIce()) return;
		const dng = D();
		if(dng) dng._iceDecorPlanted = false;
		Ice.ready = true;
		Ice.squall = 0;
		Ice.submerged = 0;
		Ice.shards.length = 0;
		Ice.debris.length = 0;
		Ice.puffs.length = 0;
		Ice.flags = { knightSlain:false, shortcutOpen:false, hearths:0 };
		frostCarry = 0;
		for(const p of platforms()){
			if(p._iceFragile){ p._tick = 0; p._cracks = 0; p._gone = false; p._warned = false; p._regrow = 0; }
		}
	}

	global.IceWorld = {
		state: Ice,
		init: init,
		updateHazards: updateHazards,
		applyMove: applyMove,
		roomClear: roomClear,
		roomEnter: roomEnter,
		onEnemyDeath: onEnemyDeath,
		tryInteract: tryInteract,
		prompt: prompt,
		drawWorld: drawWorld,
		drawInteractable: drawInteractable,
		drawAmbience: drawAmbience,
		drawOverlay: drawOverlay,
		drawPlatform: drawPlatform,
		meterHint: meterHint,
		frostPenalty: frostPenalty,
		addFrost: addFrost,
		accrueFrost: accrueFrost,
		isIce: isIce,
	};
})(typeof window !== 'undefined' ? window : globalThis);
