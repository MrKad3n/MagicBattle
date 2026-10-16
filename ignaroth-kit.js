/* =============================================================
   Ignaroth — Inferno Dragon.
   Walk / sprint / launch / fly, authored attack origins, wall-aware.
   ============================================================= */
(function(global){
	const ORB_COLORS = [
		['#ff2200', '#ffaa33'],
		['#ff5500', '#ffe680'],
		['#cc1100', '#ff6622'],
		['#ff8800', '#fff0a0'],
		['#aa0800', '#ff4400'],
		['#ff3300', '#ffcc66'],
	];

	function igRoom(en){
		const rooms = (typeof dungeon !== 'undefined' && dungeon && dungeon.rooms) || [];
		if(en.roomId != null && rooms[en.roomId]) return rooms[en.roomId];
		const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
		for(let i = 0; i < rooms.length; i++){
			const r = rooms[i];
			if(cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) return r;
		}
		return null;
	}
	function igDmg(n){
		const diff = (typeof DIFF_DMG_MULT === 'number') ? DIFF_DMG_MULT : 1;
		return Math.round(n * diff);
	}
	function igBurn(extra){ return extra || [{ type:'burn', dmg:5, interval:22, ticks:4, color:'#ff3300' }]; }
	function igPx(){ return player.x + player.w / 2; }
	function igPy(){ return player.y + player.h / 2; }
	function igIn(x, y, w, h){
		return player.x + player.w > x && player.x < x + w && player.y + player.h > y && player.y < y + h;
	}
	function igHit(dmg, extra){
		if(player.iFrames > 0) return false;
		damagePlayer(igDmg(dmg), extra || igBurn());
		return true;
	}
	function igDist(en){
		return Math.hypot(igPx() - (en.x + en.w / 2), igPy() - (en.y + en.h / 2));
	}
	function igGround(room){ return room.y + room.h - 40; }
	function igTile(){ return (typeof TILE === 'number') ? TILE : 40; }
	function igSolidAt(x, y){
		if(typeof isSolid !== 'function') return false;
		const T = igTile();
		return isSolid(Math.floor(x / T), Math.floor(y / T));
	}
	function igBoxSolid(x, y, w, h){
		if(typeof rectOverlapsSolid === 'function') return rectOverlapsSolid(x, y, w, h);
		return igSolidAt(x, y) || igSolidAt(x + w, y) || igSolidAt(x, y + h) || igSolidAt(x + w, y + h);
	}
	function igPlats(room){
		const plats = (typeof dungeon !== 'undefined' && dungeon.platforms) || [];
		return plats.filter(p => p.roomId === room.id && !p._gone);
	}
	function igPerches(room){
		return igPlats(room).filter(p => p.perch);
	}
	function igMainPlat(room){
		const plats = igPlats(room);
		for(let i = 0; i < plats.length; i++) if(plats[i].central) return plats[i];
		return plats[0] || null;
	}
	function igFloorY(x, fromY, maxDrop){
		const cap = (fromY || 0) + (maxDrop || 980);
		for(let y = (fromY || 0); y < cap; y += 5){
			if(igSolidAt(x, y)) return y;
		}
		return cap;
	}
	function igRiseH(x, y0, maxH){
		for(let y = y0 - 8; y > y0 - maxH; y -= 6){
			if(igSolidAt(x, y)) return Math.max(40, y0 - y - 6);
		}
		return maxH;
	}
	function igBanner(t){
		if(typeof showBanner === 'function') showBanner(t);
		if(typeof notify === 'function') notify(t);
	}
	function igShake(a, b){ if(typeof shakeScreen === 'function') shakeScreen(a, b); }
	function igPart(x, y, n, cols){
		if(typeof particles === 'undefined') return;
		for(let i = 0; i < n; i++){
			particles.push({
				x: x + (Math.random() - 0.5) * 46, y: y + (Math.random() - 0.5) * 28,
				vx: (Math.random() - 0.5) * 5, vy: -1.4 - Math.random() * 3.6,
				life: 22 + Math.random() * 24, color: cols[i % cols.length],
			});
		}
	}
	function igMouth(en){
		return { x: en.x + en.w / 2 + (en.facing || 1) * 118, y: en.y + en.h * 0.34 };
	}
	function igTail(en){
		return { x: en.x + en.w / 2 - (en.facing || 1) * 132, y: en.y + en.h * 0.66 };
	}
	function igBelly(en){
		return { x: en.x + en.w / 2 + (en.facing || 1) * 10, y: en.y + en.h - 10 };
	}
	function igWing(en, side){
		return { x: en.x + en.w / 2 + side * 92, y: en.y + 46 };
	}
	function igFX(ig, fx){
		ig.fx.push(fx);
	}

	function igOrb(x, y, vx, vy, opts){
		if(typeof spawnEnemyProj !== 'function') return null;
		opts = opts || {};
		const pal = ORB_COLORS[(opts.pal != null ? opts.pal : Math.floor(Math.random() * ORB_COLORS.length))];
		const p = spawnEnemyProj(x, y, vx, vy, {
			color: opts.color || pal[0],
			color2: opts.color2 || pal[1],
			power: opts.power || 40,
			width: opts.w || 34,
			height: opts.h || 34,
			shape: opts.shape || 'circle',
			effects: opts.effects || ['burn'],
			trail: opts.trail != null ? opts.trail : 'flame',
			maxAge: opts.age || 110,
			gravity: opts.grav || 0,
			noWallCollide: !!opts.ghost,
			_destroysSolid: !!opts.break,
			linger: !!opts.linger,
			lingerMax: opts.lingerMax || 0,
			lingerDmgInterval: opts.lingerIv || 24,
			aoe: !!opts.aoe,
			aoeRadius: opts.aoeR || 0,
			aoeMax: opts.aoeMax || 28,
			rotSpeed: opts.spin || 0,
		});
		if(p){
			p._igStyle = opts.style || 'orb';
			p._fireStyle = opts.style || 'orb';
		}
		return p;
	}
	function igTel(x, y, w, h, frames, label){
		if(typeof spawnTelegraph === 'function') spawnTelegraph(x, y, w, h, frames, 'rgba(255,90,10,0.22)', 'rect', label || '');
	}

	function igInit(en, room){
		const ig = en._ig = {
			stance: 'fly',
			loco: 'fly',
			phase: 1,
			atk: null,
			cd: 50,
			intro: 200,
			vulnerable: 0,
			walls: [],
			pools: [],
			zones: [],
			fx: [],
			combo: null,
			comboI: 0,
			target: null,
			ang: 0,
			pass: 0,
			didImpact: false,
			vx: 0,
			vy: 0.4,
			onGround: false,
			launchT: 0,
			sprintT: 0,
			flap: 0,
		};
		en.bossPhase = 1;
		const plat = igMainPlat(room);
		en._igGroundY = plat ? plat.y - en.h : igGround(room) - en.h;
		en.x = room.x + room.w * 0.38;
		en.y = room.y + 70;
		ig.vx = 0.8;
		ig.vy = 0.2;
		igBanner('IGNAROTH — THE INFERNO DRAGON');
		igShake(12, 28);
		return ig;
	}

	function igHitbox(en){
		return { x: en.x + 36, y: en.y + 16, w: en.w - 72, h: en.h - 20 };
	}
	function igResolveAxis(en, ig, axis){
		const b = igHitbox(en);
		if(!igBoxSolid(b.x, b.y, b.w, b.h)) return;
		const vel = axis === 'x' ? ig.vx : ig.vy;
		const step = vel >= 0 ? -1 : 1;
		const max = Math.min(48, Math.ceil(Math.abs(vel)) + 6);
		for(let i = 0; i < max; i++){
			if(axis === 'x') en.x += step;
			else en.y += step;
			const n = igHitbox(en);
			if(!igBoxSolid(n.x, n.y, n.w, n.h)){
				if(axis === 'x') ig.vx *= -0.18;
				else {
					if(ig.vy > 0) ig.onGround = true;
					ig.vy = 0;
				}
				return;
			}
		}
		if(axis === 'x') ig.vx = 0;
		else { ig.vy = 0; ig.onGround = vel > 0; }
	}
	function igApply(en, room, ig){
		ig.onGround = false;
		en.x += ig.vx;
		igResolveAxis(en, ig, 'x');
		en.y += ig.vy;
		igResolveAxis(en, ig, 'y');
		const feet = igHitbox(en);
		if(igBoxSolid(feet.x + 4, feet.y + feet.h + 2, feet.w - 8, 6)){
			ig.onGround = true;
			if(ig.vy > 0) ig.vy = 0;
		}
		if(en.x < room.x + 36){ en.x = room.x + 36; ig.vx = Math.max(0, ig.vx); }
		if(en.x + en.w > room.x + room.w - 36){ en.x = room.x + room.w - 36 - en.w; ig.vx = Math.min(0, ig.vx); }
		if(en.y < room.y + 24){ en.y = room.y + 24; ig.vy = Math.max(0, ig.vy); }
		if(en.y + en.h > room.y + room.h - 12){ en.y = room.y + room.h - 12 - en.h; ig.vy = Math.min(0, ig.vy); ig.onGround = true; }
		if(ig.onGround){
			const plat = igMainPlat(room);
			if(plat && en.y + en.h <= plat.y + 18 && en.y + en.h >= plat.y - 8) en._igGroundY = plat.y - en.h;
			else en._igGroundY = en.y;
		}
	}
	function igCap(ig, maxSpd){
		const s = Math.hypot(ig.vx, ig.vy);
		if(s > maxSpd){ ig.vx *= maxSpd / s; ig.vy *= maxSpd / s; }
	}
	function igAccel(ig, ax, ay, maxSpd){
		ig.vx += ax;
		ig.vy += ay;
		if(maxSpd) igCap(ig, maxSpd);
	}
	function igDrive(en, ig, room, mode){
		const dx = igPx() - (en.x + en.w / 2);
		const face = dx >= 8 ? 1 : dx <= -8 ? -1 : (en.facing || 1);
		if(mode === 'walk'){
			ig.vy += 0.38;
			const turn = Math.sign(dx) && Math.sign(ig.vx) && Math.sign(dx) !== Math.sign(ig.vx) && Math.abs(ig.vx) > 0.8;
			ig.vx += face * (turn ? 0.32 : 0.22);
			if(Math.abs(ig.vx) > 3.05) ig.vx = 3.05 * Math.sign(ig.vx);
			if(Math.abs(dx) < 64) ig.vx *= 0.84;
			en.facing = face;
			ig.stance = 'ground';
		} else if(mode === 'sprint'){
			ig.vy += 0.38;
			ig.sprintT = (ig.sprintT || 0) + 1;
			if(ig.sprintT < 9){
				ig.vx *= 0.88;
				igPart(igBelly(en).x, igBelly(en).y, 1, ['#ff6600', '#ffe080']);
			} else {
				ig.vx += face * 0.42;
				if(Math.abs(ig.vx) > 5.35) ig.vx = 5.35 * Math.sign(ig.vx);
				if(ig.sprintT % 5 === 0) igPart(igBelly(en).x - face * 20, igBelly(en).y, 2, ['#ff4400', '#ffaa33']);
			}
			en.facing = face;
			ig.stance = 'ground';
		} else if(mode === 'launch'){
			ig.launchT = (ig.launchT || 0) + 1;
			if(ig.launchT < 11){
				ig.vx *= 0.86;
				ig.vy = Math.min(ig.vy, 0.15);
				if(ig.launchT === 1) igPart(igBelly(en).x, igBelly(en).y, 6, ['#ff3300', '#ffcc66']);
			} else if(ig.launchT === 11){
				ig.vy = -8.6;
				ig.vx += face * 3.4;
				ig.onGround = false;
				ig.stance = 'fly';
				igShake(5, 8);
				igPart(igBelly(en).x, igBelly(en).y, 10, ['#ff2200', '#ffe680', '#ff8800']);
			} else {
				ig.vy += 0.14;
				ig.vx += face * 0.06;
				if(ig.launchT > 26 || ig.vy > 0.4){
					ig.loco = 'fly';
					ig.launchT = 0;
				}
			}
			en.facing = face;
		} else if(mode === 'fly'){
			ig.vy += 0.075;
			const ty = (igPy() - 118) - (en.y + en.h * 0.4);
			ig.vx += face * 0.18;
			ig.vy += Math.max(-0.22, Math.min(0.22, ty * 0.01));
			ig.flap = (ig.flap || 0) + 1;
			if(ig.flap % 18 === 0){
				ig.vy -= 2.35;
				igPart(igWing(en, -1).x, igWing(en, -1).y, 2, ['#ff6611', '#ffe080']);
				igPart(igWing(en, 1).x, igWing(en, 1).y, 2, ['#ff6611', '#ffe080']);
			}
			ig.vx *= 0.982;
			ig.vy *= 0.988;
			igCap(ig, 5.6);
			en.facing = Math.abs(ig.vx) > 0.45 ? Math.sign(ig.vx) : face;
			ig.stance = 'fly';
		} else if(mode === 'land'){
			const plat = igMainPlat(room) || igPlats(room)[0];
			const tx = plat ? plat.x + plat.w * 0.5 - en.w / 2 - en.x : 0;
			const ty = plat ? plat.y - en.h - en.y : 0;
			ig.vx += Math.sign(tx || face) * 0.2;
			ig.vy += 0.28;
			if(ty < -40) ig.vy += 0.12;
			igCap(ig, 5.8);
			if(ig.onGround){
				ig.loco = 'walk';
				ig.stance = 'ground';
				ig.vx *= 0.45;
				ig.sprintT = 0;
			}
		}
	}
	function igPickLoco(en, ig, room){
		if(ig.loco === 'launch' && ig.launchT > 0 && ig.launchT < 26) return;
		const dx = igPx() - (en.x + en.w / 2);
		const dy = igPy() - (en.y + en.h / 2);
		if(ig.onGround){
			if(ig.stance === 'fly' || dy < -140){
				ig.loco = 'launch';
				ig.launchT = 0;
				return;
			}
			ig.loco = Math.abs(dx) > 390 ? 'sprint' : 'walk';
			if(ig.loco === 'walk') ig.sprintT = 0;
		} else if(ig.stance === 'ground'){
			ig.loco = 'land';
		} else if(ig.loco !== 'launch'){
			ig.loco = 'fly';
		}
	}

	function igTickZones(ig){
		for(let i = ig.fx.length - 1; i >= 0; i--){
			ig.fx[i].life--;
			if(ig.fx[i].life <= 0) ig.fx.splice(i, 1);
		}
		for(let i = ig.zones.length - 1; i >= 0; i--){
			const z = ig.zones[i];
			z.life--;
			if(z.hot && z.life > 0 && z.life <= (z.hotFor || 9999)){
				if(z.kind === 'rect' && igIn(z.x, z.y, z.w, z.h)) igHit(z.dmg || 22, z.fx);
				if(z.kind === 'circ' && Math.hypot(igPx() - z.cx, igPy() - z.cy) < z.r) igHit(z.dmg || 22, z.fx);
			}
			if(z.life <= 0) ig.zones.splice(i, 1);
		}
		for(let i = ig.walls.length - 1; i >= 0; i--){
			const w = ig.walls[i];
			w.life--;
			if(igIn(w.x, w.y, w.w, w.h)) igHit(18, igBurn());
			if(w.life <= 0) ig.walls.splice(i, 1);
		}
		for(let i = ig.pools.length - 1; i >= 0; i--){
			const p = ig.pools[i];
			p.life--;
			if(igIn(p.x, p.y, p.w, p.h)) igHit(16, igBurn());
			if(p.life <= 0) ig.pools.splice(i, 1);
		}
	}

	function igBreakPlat(p){
		if(!p || p._gone) return;
		if(typeof DungeonEnv !== 'undefined' && DungeonEnv.breakPlatform) DungeonEnv.breakPlatform(p);
		else p._gone = true;
	}

	function igBehindPillar(en, room){
		const pillars = room.pillars || [];
		const cx = en.x + en.w / 2, px = igPx();
		for(let i = 0; i < pillars.length; i++){
			const p = pillars[i];
			const mid = p.x + p.w / 2;
			if((cx - mid) * (px - mid) < 0 && igIn(p.x - 30, p.y - 20, p.w + 60, p.h + 50)) return true;
		}
		return false;
	}

	function igPickAttack(en, ig){
		if(ig.combo && ig.comboI < ig.combo.length) return ig.combo[ig.comboI++];
		ig.combo = null;
		const dx = igPx() - (en.x + en.w / 2);
		const dist = Math.hypot(dx, igPy() - (en.y + en.h / 2));
		const close = dist < 300;
		const far = dist > 640;
		if(ig.phase >= 3 && Math.random() < 0.42){
			const combos = close
				? [['tail', 'breath', 'dive'], ['tempest', 'tail', 'breath']]
				: [['dive', 'breath'], ['pursuit', 'barrage'], ['scorch', 'dive', 'breath']];
			ig.combo = combos[Math.floor(Math.random() * combos.length)];
			ig.comboI = 1;
			return ig.combo[0];
		}
		const pool = [];
		const add = (n, w) => { for(let i = 0; i < w; i++) pool.push(n); };
		if(close){
			add('tail', 5); add('breath', 4); add('tempest', ig.phase >= 2 ? 2 : 1);
		} else if(far){
			add('dive', 5); add('pursuit', ig.phase >= 2 ? 4 : 2); add('barrage', 3);
			add('meteor', ig.phase >= 2 ? 2 : 0); add('breath', 2);
		} else {
			add('breath', 4); add('dive', 3); add('barrage', 3); add('tail', 2);
			add('scorch', ig.phase >= 2 ? 2 : 0);
		}
		if(igPy() < en.y + 20) add('dive', 3);
		if(ig.stance === 'fly'){ add('dive', 2); add('barrage', 2); }
		else add('breath', 2);
		if(ig.phase >= 2 && Math.random() < 0.22) add('roar', 2);
		if(ig.phase >= 2 && Math.random() < 0.18) add('erupt', 2);
		return pool[Math.floor(Math.random() * pool.length)];
	}

	function igStart(en, name){
		const ig = en._ig;
		ig.atk = { name: name, t: 0 };
		ig.didImpact = false;
		ig.target = null;
		ig.pass = 0;
		ig.suns = null;
		ig.meteorBall = null;
		en.attackAnimTimer = 48;
		const air = name === 'dive' || name === 'barrage' || name === 'scorch' || name === 'pursuit' || name === 'meteor' || name === 'erupt';
		if(air && ig.onGround){ ig.loco = 'launch'; ig.launchT = 0; }
		if(!air && !ig.onGround) ig.loco = 'land';
		if(name === 'breath') igBanner('His throat floods — get behind the jaws.');
		if(name === 'dive') igBanner('He gathers height — the crater will break.');
		if(name === 'tail') igBanner('The tail draws back.');
		if(name === 'barrage') igBanner('Suns form above his wings.');
		if(name === 'roar') igBanner('The mountain answers his roar.');
		if(name === 'scorch') igBanner('He draws a furnace wall.');
		if(name === 'pursuit') igBanner('He commits to the pass.');
		if(name === 'erupt') igBanner('He wakes the vents.');
		if(name === 'meteor') igBanner('A molten star gathers in his jaws.');
		if(name === 'tempest') igBanner('The wings take the air.');
	}

	function igEnd(en, cd, vuln){
		const ig = en._ig;
		ig.atk = null;
		ig.cd = cd || 58;
		if(vuln) ig.vulnerable = vuln;
		if(ig.combo && ig.comboI >= ig.combo.length){
			ig.combo = null;
			ig.vulnerable = Math.max(ig.vulnerable, 110);
			igBanner('The dragon’s weight pins him — strike!');
		}
	}

	function igPhase(en, ig, room){
		const hpR = en.maxHp ? en.hp / en.maxHp : 1;
		if(hpR <= 0.70 && ig.phase < 2){
			ig.phase = 2;
			en.bossPhase = 2;
			en.bossPhaseTransition = 130;
			igBanner('THE VOLCANO AWAKENS');
			igShake(16, 32);
			const plats = igPlats(room);
			let gone = 0;
			for(let i = 0; i < plats.length; i++){
				const p = plats[i];
				if(p.central || p.perch || p.pillar || p._gone) continue;
				if(gone < 2){ igBreakPlat(p); gone++; }
			}
		}
		if(hpR <= 0.35 && ig.phase < 3){
			ig.phase = 3;
			en.bossPhase = 3;
			en.bossPhaseTransition = 140;
			igBanner('AVATAR OF THE INFERNO');
			igShake(18, 36);
			ig.combo = ['erupt', 'pursuit', 'breath'];
			ig.comboI = 0;
		}
	}

	function breathVolley(en, ig, ph){
		const m = igMouth(en);
		const n = ph === 1 ? 4 : (ph === 2 ? 6 : 7);
		const half = ph === 1 ? 0.28 : 0.4;
		for(let i = 0; i < n; i++){
			const u = n <= 1 ? 0 : i / (n - 1);
			const spr = -half + u * half * 2;
			const ang = ig.ang + spr;
			const spd = 6.6 + Math.random() * 1.8 + (ph >= 3 ? 0.7 : 0);
			igOrb(m.x + Math.cos(ang) * 18, m.y + Math.sin(ang) * 18,
				Math.cos(ang) * spd, Math.sin(ang) * spd, {
					pal: i % ORB_COLORS.length,
					power: 38 + ph * 6,
					w: 22 + i * 3, h: 16 + i * 2,
					age: 90 + Math.random() * 24,
					style: 'breath',
				});
		}
		igFX(ig, { kind:'stream', x:m.x, y:m.y, ang:ig.ang, life:6, max:6 });
	}

	function dropFire(en, ig, life){
		const b = igBelly(en);
		const floor = igFloorY(b.x, b.y + 8, 520);
		const h = Math.max(70, Math.min(168, floor - b.y));
		const x = b.x - 22;
		ig.walls.push({ x: x, y: floor - h, w: 44, h: h, life: life || 300 });
		igOrb(b.x, b.y, ig.vx * 0.15, 2.4, {
			pal: (ig.atk.t || 0) % 6, power: 30, w: 34, h: 28, age: 22,
			style: 'drop', linger: true, lingerMax: 180, lingerIv: 20, ghost: true,
		});
	}

	function runAtk(en, room, ig){
		const a = ig.atk;
		a.t++;
		const cx = en.x + en.w / 2, cy = en.y + en.h * 0.4;
		const ground = igGround(room);
		const ph = ig.phase;
		const flyNeed = a.name === 'dive' || a.name === 'barrage' || a.name === 'scorch' || a.name === 'pursuit' || a.name === 'meteor' || a.name === 'erupt';

		if(ig.loco === 'launch' && ig.launchT < 12 && flyNeed){
			igDrive(en, ig, room, 'launch');
			igApply(en, room, ig);
			return;
		}

		if(a.name === 'breath'){
			ig.loco = ig.onGround ? (Math.abs(igPx() - cx) > 360 ? 'sprint' : 'walk') : 'land';
			igDrive(en, ig, room, ig.loco);
			en.facing = igPx() >= cx ? 1 : -1;
			const m0 = igMouth(en);
			const wantAng = Math.atan2(igPy() - m0.y, igPx() - m0.x);
			if(a.t === 1){
				ig.ang = wantAng;
				igTel(m0.x + (en.facing > 0 ? 0 : -520), m0.y - 70, 520, 160, 50, 'INFERNO BREATH');
			}
			const charge = 50;
			let da = wantAng - ig.ang;
			while(da > Math.PI) da -= Math.PI * 2;
			while(da < -Math.PI) da += Math.PI * 2;
			ig.ang += da * (a.t < charge ? 0.14 : 0.09);
			if(a.t < charge){
				igPart(m0.x, m0.y, 4, ['#ff2200', '#ff8800', '#ffe680']);
				if(a.t % 6 === 0) igFX(ig, { kind:'glow', x:m0.x, y:m0.y, r:18 + a.t * 0.4, life:8, max:8 });
			} else {
				if(a.t % (ph >= 3 ? 4 : 5) === 0) breathVolley(en, ig, ph);
				igShake(a.t % 8 === 0 ? 3 : 0, 6);
				const dur = ph >= 3 ? 88 : 70;
				if(a.t > charge + dur){
					if(ph >= 3 && !a.rev){ a.rev = true; a.t = charge; }
					else igEnd(en, 62, 0);
				}
			}
		} else if(a.name === 'dive'){
			ig.stance = 'fly';
			if(a.t < 50){
				ig.loco = 'fly';
				igAccel(ig, (igPx() - cx) * 0.004, -0.28, 4.4);
				if(a.t === 14) igTel(igPx() - 80, igFloorY(igPx(), igPy(), 400) - 20, 160, 36, 70, 'DIVE');
			} else if(a.t < 92){
				igAccel(ig, (igPx() - en.w / 2 - en.x) * 0.01, ((room.y + 160) - en.y) * 0.012, 4.2);
				ig.target = { x: igPx() + (player.vx || 0) * 10, y: igFloorY(igPx(), igPy(), 500) };
			} else if(a.t < 138){
				if(a.t === 92) igShake(6, 10);
				if(a.t < 112) ig.target = { x: igPx() + (player.vx || 0) * 8, y: igFloorY(igPx(), igPy(), 500) };
				igAccel(ig, (ig.target.x - en.w / 2 - en.x) * 0.02, (ig.target.y - en.h - en.y) * 0.02, 8.6);
				if(a.t % 3 === 0){
					const b = igBelly(en);
					igFX(ig, { kind:'streak', x:b.x, y:b.y, vx:ig.vx, vy:ig.vy, life:10, max:10 });
				}
			} else if(!ig.didImpact){
				ig.didImpact = true;
				ig.vx *= 0.18;
				ig.vy = 0;
				igShake(16, 24);
				const ix = en.x + en.w / 2, iy = en.y + en.h;
				const hit = Math.hypot(igPx() - ix, igPy() - iy) < 190;
				if(hit) igHit(54, ['horizontalLaunch']);
				for(let i = 0; i < 10; i++){
					const ang = (i / 10) * Math.PI * 2;
					igOrb(ix, iy - 8, Math.cos(ang) * 7.2, Math.sin(ang) * 5.4, {
						pal: i % 6, power: 36, w: 28 + (i % 3) * 6, h: 26, age: 64, style: 'shard',
					});
				}
				ig.zones.push({ kind:'circ', cx:ix, cy:iy, r:190, life:20, hot:true, hotFor:20, dmg:28 });
				igFX(ig, { kind:'crater', x:ix, y:iy, r:90, life:50, max:50 });
				if(!hit){
					ig.stance = 'ground';
					ig.loco = 'walk';
					igEnd(en, 24, 120);
					igBanner('The crash stuns him — pour it on!');
				} else igEnd(en, 70, 0);
			}
		} else if(a.name === 'scorch'){
			ig.loco = 'fly';
			igDrive(en, ig, room, 'fly');
			en.facing = igPx() >= cx ? 1 : -1;
			if(a.t > 16 && a.t % 8 === 0) dropFire(en, ig, 360);
			if(a.t > 176) igEnd(en, 55, 0);
		} else if(a.name === 'barrage'){
			ig.loco = 'fly';
			igDrive(en, ig, room, 'fly');
			if(a.t === 1){
				ig.suns = [
					{ side: -1, lead: 0, delay: 48, sz: 52 },
					{ side: 1, lead: 18, delay: 70, sz: 44 },
					{ side: -1, lead: -16, delay: 92, sz: 48 },
					{ side: 1, lead: 10, delay: 114, sz: 56, pool: true },
					{ side: -1, lead: 0, delay: 136, sz: 60 },
				];
				if(ph >= 2) ig.suns.push({ side: 1, lead: -10, delay: 158, sz: 46 });
			}
			for(let i = 0; i < (ig.suns || []).length; i++){
				const s = ig.suns[i];
				const wing = igWing(en, s.side);
				s.x = wing.x; s.y = wing.y;
				if(a.t === s.delay - 26){
					const tx = igPx() + (player.vx || 0) * s.lead;
					igTel(tx - s.sz, igFloorY(tx, igPy(), 420) - 28, s.sz * 2, 40, 26, '');
				}
				if(a.t === s.delay){
					const tx = igPx() + (player.vx || 0) * s.lead;
					const ty = igPy();
					const ddx = tx - wing.x, ddy = ty - wing.y, d = Math.max(50, Math.hypot(ddx, ddy));
					igOrb(wing.x, wing.y, ddx / d * 7.5, ddy / d * 7.5, {
						pal: i, power: 48, w: s.sz, h: s.sz, age: 110, style: 'sun',
					});
					igShake(7, 10);
					igPart(wing.x, wing.y, 8, ['#ffe680', '#ff4400']);
					if(s.pool){
						const fy = igFloorY(tx, ty, 420);
						ig.pools.push({ x: tx - 70, y: fy - 28, w: 140, h: 28, life: 240 });
					}
					s.gone = true;
				}
			}
			if(a.t > 190) igEnd(en, 65, 0);
		} else if(a.name === 'tail'){
			ig.loco = ig.onGround ? (Math.abs(igPx() - cx) > 340 ? 'sprint' : 'walk') : 'land';
			igDrive(en, ig, room, ig.loco);
			en.facing = igPx() >= cx ? 1 : -1;
			const tl = igTail(en);
			if(a.t === 1) igTel(tl.x - 160, tl.y - 80, 320, 180, 40, 'TAIL');
			if(a.t > 8 && a.t < 44 && a.t % 5 === 0){
				igFX(ig, { kind:'arc', x:tl.x, y:tl.y, r:40 + a.t * 4, life:7, max:7, dir:en.facing || 1 });
			}
			if(a.t === 44){
				const d = igDist(en);
				if(d > 50 && d < 380) igHit(46, ['horizontalLaunch']);
				const dir = en.facing || 1;
				for(let i = 0; i < 8; i++){
					const ang = (i / 7) * Math.PI - 0.1;
					igOrb(tl.x, tl.y, Math.cos(ang) * 7.6 * dir, -Math.sin(ang) * 6.0, {
						pal: i % 6, power: 40, w: 30 + i * 2, h: 26, age: 64, spin: 0.14, style: 'shard',
					});
				}
				igShake(12, 16);
			}
			if(a.t > 76) igEnd(en, 60, 0);
		} else if(a.name === 'roar'){
			ig.loco = ig.onGround ? 'walk' : 'land';
			igDrive(en, ig, room, ig.loco);
			en.facing = igPx() >= cx ? 1 : -1;
			const m = igMouth(en);
			if(a.t === 10) igShake(8, 14);
			if(a.t === 18 || a.t === 32 || a.t === 48){
				igFX(ig, { kind:'ring', x:m.x, y:m.y, r:30, life:22, max:22 });
			}
			if(a.t === 36){
				const cracks = room.cracks || [];
				for(let i = 0; i < cracks.length; i++){
					const c = cracks[i];
					const h = igRiseH(c.x + c.w * 0.5, c.y, 210);
					igTel(c.x, c.y - h, c.w, h, 40, '');
				}
			}
			if(a.t === 78){
				const cracks = room.cracks || [];
				for(let i = 0; i < cracks.length; i++){
					const c = cracks[i];
					const mid = c.x + c.w * 0.5;
					const h = igRiseH(mid, c.y, 200);
					for(let k = 0; k < 3; k++){
						igOrb(mid + (k - 1) * 14, c.y - 6, (k - 1) * 1.0, -8.0 - k * 0.4, {
							pal: (i + k) % 6, power: 36, w: 28 + k * 5, h: 36, age: 70, grav: 0.08, style: 'drop',
						});
					}
					ig.zones.push({ kind:'rect', x:c.x, y:c.y - h, w:c.w, h:h, life:36, hot:true, hotFor:24, dmg:26 });
				}
				igShake(14, 20);
			}
			if(a.t > 130) igEnd(en, 70, 0);
		} else if(a.name === 'erupt'){
			ig.loco = 'fly';
			const vents = room.vents || [];
			if(a.t === 1 && vents.length){
				let best = vents[0], bd = 1e9;
				for(let i = 0; i < vents.length; i++){
					const d = Math.abs((vents[i].x + vents[i].w / 2) - igPx());
					if(d < bd){ bd = d; best = vents[i]; }
				}
				ig.target = { x: best.x + best.w / 2 - en.w / 2, y: room.y + 160, vent: best };
			}
			if(ig.target) igAccel(ig, (ig.target.x - en.x) * 0.012, (ig.target.y - en.y) * 0.01, 4.0);
			else igDrive(en, ig, room, 'fly');
			if(a.t === 40 || a.t === 95 || a.t === 150){
				const wave = a.t === 40 ? 0 : a.t === 95 ? 1 : 2;
				for(let i = 0; i < vents.length; i++){
					if((i + wave) % 2) continue;
					const v = vents[i];
					const h = igRiseH(v.x + v.w / 2, v.y, 460);
					igTel(v.x - 16, v.y - h, v.w + 32, h, 36, '');
				}
				if(ig.target && ig.target.vent){
					const m = igMouth(en);
					igFX(ig, { kind:'stream', x:m.x, y:m.y, ang:Math.atan2(ig.target.vent.y - m.y, ig.target.vent.x + ig.target.vent.w / 2 - m.x), life:12, max:12 });
				}
			}
			if(a.t === 76 || a.t === 131 || a.t === 186){
				const wave = a.t === 76 ? 0 : a.t === 131 ? 1 : 2;
				for(let i = 0; i < vents.length; i++){
					if((i + wave) % 2) continue;
					const v = vents[i];
					const mid = v.x + v.w / 2;
					const h = igRiseH(mid, v.y, 460);
					for(let k = 0; k < 4; k++){
						igOrb(mid, v.y - 8, (Math.random() - 0.5) * 1.6, -9.0 - k * 0.7, {
							pal: (i + k) % 6, power: 40, w: 26 + k * 6, h: 40, age: 78, grav: 0.1, style: 'drop',
						});
					}
					ig.zones.push({ kind:'rect', x:v.x - 14, y:v.y - h, w:v.w + 28, h:h, life:32, hot:true, hotFor:22, dmg:30 });
				}
				igShake(10, 16);
			}
			if(a.t > 230) igEnd(en, 80, 0);
		} else if(a.name === 'pursuit'){
			ig.loco = 'fly';
			igAccel(ig, (igPx() - en.w / 2 + (player.vx || 0) * 8 - en.x) * 0.016, (igPy() - 70 - en.y) * 0.014, 5.8);
			en.facing = ig.vx >= 0 ? 1 : -1;
			if(Math.hypot(igPx() - cx, igPy() - cy) < 120 && a.t - (ig.passAt || 0) > 42){
				ig.passAt = a.t;
				ig.pass++;
				if(ig.pass >= 4){ igEnd(en, 55, 0); igApply(en, room, ig); return; }
			}
			if(a.t > 18 && a.t % 8 === 0) dropFire(en, ig, 260);
			if(igIn(en.x + 16, en.y + 24, en.w - 32, en.h - 36)) igHit(36, ['horizontalLaunch']);
			if(a.t > 300) igEnd(en, 70, 0);
		} else if(a.name === 'meteor'){
			ig.loco = 'fly';
			igDrive(en, ig, room, 'fly');
			const m = igMouth(en);
			if(a.t === 1) ig.target = { x: igPx() + (player.vx || 0) * 12, y: igFloorY(igPx(), igPy(), 500), r: 220 };
			if(a.t < 88) ig.target.x += ((igPx() + (player.vx || 0) * 10) - ig.target.x) * 0.07;
			if(a.t === 8) igTel(ig.target.x - ig.target.r, ig.target.y - 28, ig.target.r * 2, 46, 86, 'METEOR');
			if(a.t < 94){
				igPart(m.x, m.y, 3, ['#ff2200', '#ffe680']);
				if(a.t % 5 === 0) igFX(ig, { kind:'glow', x:m.x, y:m.y, r:16 + a.t * 0.35, life:8, max:8 });
			}
			if(a.t === 96){
				const t = ig.target;
				const ddx = t.x - m.x, ddy = t.y - m.y, d = Math.max(40, Math.hypot(ddx, ddy));
				ig.meteorBall = igOrb(m.x, m.y, ddx / d * 8.8, ddy / d * 8.8, {
					color:'#ff2200', color2:'#ffe680', power: 68, w: 78, h: 78, age: 90, grav: 0.08, style: 'meteor',
				});
				igShake(10, 14);
			}
			if(ig.meteorBall){
				const alive = typeof enemyProjectiles !== 'undefined' && enemyProjectiles.indexOf(ig.meteorBall) >= 0 && !ig.meteorBall.hasHit;
				if(alive){ ig.target.hitX = ig.meteorBall.x; ig.target.hitY = ig.meteorBall.y; }
				if(!alive && !a.boom){
					a.boom = true;
					const t = ig.target;
					const hx = t.hitX || t.x, hy = t.hitY || t.y;
					if(Math.hypot(igPx() - hx, igPy() - hy) < t.r + 20) igHit(62, ['horizontalLaunch']);
					for(let i = 0; i < 12; i++){
						const ang = (i / 12) * Math.PI * 2;
						igOrb(hx, hy, Math.cos(ang) * 8.2, Math.sin(ang) * 6.2, {
							pal: i % 6, power: 40, w: 28, h: 28, age: 60, style: 'shard',
						});
					}
					const fy = igFloorY(hx, hy - 10, 200);
					ig.pools.push({ x: hx - 160, y: fy - 32, w: 320, h: 32, life: 260 });
					igFX(ig, { kind:'crater', x:hx, y:fy, r:120, life:70, max:70 });
					const plats = igPlats(room);
					for(let i = 0; i < plats.length; i++){
						const p = plats[i];
						if(p.central || p.pillar || p._gone) continue;
						if(Math.abs(p.x + p.w / 2 - hx) < 400){
							igBreakPlat(p);
							break;
						}
					}
					igShake(18, 26);
				}
			}
			if(a.t > 150){
				if(ig.meteorBall && !a.boom){
					a.boom = true;
					const t = ig.target;
					const hx = t.hitX || t.x, hy = t.hitY || t.y;
					if(Math.hypot(igPx() - hx, igPy() - hy) < t.r + 20) igHit(62, ['horizontalLaunch']);
					for(let i = 0; i < 10; i++){
						const ang = (i / 10) * Math.PI * 2;
						igOrb(hx, hy, Math.cos(ang) * 8.0, Math.sin(ang) * 6.0, {
							pal: i % 6, power: 36, w: 26, h: 26, age: 55, style: 'shard',
						});
					}
					igShake(14, 20);
				}
				igEnd(en, 75, 0);
			}
		} else if(a.name === 'tempest'){
			ig.loco = ig.onGround ? 'walk' : (ig.stance === 'perch' ? 'fly' : 'land');
			if(ig.loco !== 'fly') igDrive(en, ig, room, ig.loco);
			en.facing = igPx() >= cx ? 1 : -1;
			const safe = igBehindPillar(en, room);
			if(a.t === 18) igTel(cx - 90, cy - 70, 180, 150, 36, 'TEMPEST');
			if(a.t > 40 && a.t < 130){
				const wL = igWing(en, -1), wR = igWing(en, 1);
				if(a.t % 6 === 0){
					igFX(ig, { kind:'gust', x:wL.x, y:wL.y, dir:en.facing || 1, life:12, max:12 });
					igFX(ig, { kind:'gust', x:wR.x, y:wR.y, dir:en.facing || 1, life:12, max:12 });
				}
				if(!safe){
					player.vx += (en.facing || 1) * 0.42;
					if(a.t % 14 === 0){
						igOrb(wR.x, wR.y, (en.facing || 1) * (6.6 + Math.random()), (Math.random() - 0.5) * 2.8, {
							pal: a.t % 6, power: 30, w: 26, h: 20, age: 70, spin: 0.2, style: 'gust',
						});
					}
				}
			}
			if(a.t > 145) igEnd(en, 80, 0);
		} else {
			igEnd(en, 70, 0);
		}
		igApply(en, room, ig);
	}

	function updateIgnaroth(en){
		if(!en || en.type !== 'fireDragon' || en.dead) return false;
		if(en.isNecroSummon || en.necroFriendly) return false;
		if(typeof IS_DUNGEON === 'undefined' || !IS_DUNGEON || DUNGEON_TYPE !== 'fire') return false;
		const room = igRoom(en);
		if(!room || room.kind !== 'boss') return false;

		if(!en._ig) igInit(en, room);
		const ig = en._ig;
		if(!ig.fx) ig.fx = [];
		en.animTimer = (en.animTimer || 0) + 1;
		if(!ig.atk || (ig.atk.name !== 'breath' && ig.atk.name !== 'tail')){
			const faceWant = igPx() >= en.x + en.w / 2 ? 1 : -1;
			if(en.animTimer % 6 === 0) en.facing = faceWant;
		}

		igTickZones(ig);
		igPhase(en, ig, room);

		if(en.bossPhaseTransition > 0){
			en.bossPhaseTransition--;
			ig.vx *= 0.9; ig.vy *= 0.9;
			igApply(en, room, ig);
			igPart(en.x + en.w / 2, en.y + 40, 5, ['#ff2200', '#ff8800', '#ffe680']);
			return true;
		}

		if(ig.intro > 0){
			ig.intro--;
			ig.stance = 'fly';
			if(ig.intro > 40) igDrive(en, ig, room, 'fly');
			else {
				ig.loco = 'land';
				ig.stance = 'ground';
				igDrive(en, ig, room, 'land');
			}
			igApply(en, room, ig);
			if(ig.intro === 1){
				ig.stance = 'ground';
				ig.loco = 'walk';
				igBanner('A mountain that learned to hate.');
			}
			return true;
		}

		if(ig.vulnerable > 0){
			ig.vulnerable--;
			ig.stance = 'ground';
			ig.loco = 'walk';
			ig.vx *= 0.82;
			ig.vy += 0.4;
			igApply(en, room, ig);
			return true;
		}

		if(ig.atk){
			runAtk(en, room, ig);
			return true;
		}

		ig.cd--;
		if(ig.cd > 0){
			igPickLoco(en, ig, room);
			igDrive(en, ig, room, ig.loco);
			if(ig.cd === 16){
				const perches = igPerches(room);
				if(perches.length && Math.random() < 0.1 && ig.onGround){
					ig.stance = 'perch';
					ig.loco = 'launch';
					ig.launchT = 0;
					ig.perch = perches[Math.floor(Math.random() * perches.length)];
					ig.vulnerable = 64;
					igBanner('He settles his weight — hit him.');
				} else if(ig.onGround && Math.random() < 0.5){
					ig.stance = 'fly';
					ig.loco = 'launch';
					ig.launchT = 0;
				} else if(!ig.onGround && Math.random() < 0.32){
					ig.stance = 'ground';
					ig.loco = 'land';
				}
			}
			igApply(en, room, ig);
			return true;
		}

		igStart(en, igPickAttack(en, ig));
		return true;
	}

	function igHex(c, a){
		if(typeof c === 'string' && c[0] === '#'){
			const n = parseInt(c.slice(1), 16);
			return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + (a == null ? 1 : a) + ')';
		}
		return c;
	}
	function drawFireBall(x, y, r, c1, c2, pulse){
		const g = ctx.createRadialGradient(x - r * 0.22, y - r * 0.28, r * 0.08, x, y, r);
		g.addColorStop(0, 'rgba(255,255,230,0.96)');
		g.addColorStop(0.22, igHex(c2, 0.95));
		g.addColorStop(0.62, igHex(c1, 0.88));
		g.addColorStop(1, 'rgba(70,8,0,0)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.ellipse(x, y, r * (0.95 + pulse * 0.08), r * (0.82 + pulse * 0.06), 0, 0, Math.PI * 2);
		ctx.fill();
	}

	function drawIgnarothProj(p){
		const x = p.x - camera.x, y = p.y - camera.y;
		const r = Math.max(p.width, p.height) * 0.55;
		const pulse = 0.5 + Math.sin((p.age || 0) * 0.38) * 0.5;
		const ang = Math.atan2(p.vy, p.vx);
		ctx.save();
		if(p._igStyle === 'breath' || p._igStyle === 'gust'){
			ctx.translate(x, y);
			ctx.rotate(ang);
			const g = ctx.createLinearGradient(-r * 1.6, 0, r * 1.8, 0);
			g.addColorStop(0, 'rgba(255,240,180,0)');
			g.addColorStop(0.35, igHex(p.color2 || '#ffe680', 0.95));
			g.addColorStop(0.75, igHex(p.color || '#ff3300', 0.85));
			g.addColorStop(1, 'rgba(80,10,0,0)');
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.ellipse(0, 0, r * 2.1, r * 0.62, 0, 0, Math.PI * 2);
			ctx.fill();
			ctx.restore();
			return;
		}
		if(p._igStyle === 'meteor'){
			drawFireBall(x, y, r * 1.15, p.color || '#ff2200', p.color2 || '#ffe680', pulse);
			ctx.strokeStyle = 'rgba(255,200,80,0.55)';
			ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(x, y, r * 1.25 + pulse * 6, 0, Math.PI * 2); ctx.stroke();
			ctx.restore();
			return;
		}
		if(p._igStyle === 'sun'){
			drawFireBall(x, y, r, p.color || '#ff4400', p.color2 || '#ffe680', pulse);
			ctx.globalAlpha = 0.45;
			ctx.strokeStyle = '#ffe680';
			ctx.lineWidth = 2;
			for(let i = 0; i < 6; i++){
				const a = i * Math.PI / 3 + (p.age || 0) * 0.08;
				ctx.beginPath();
				ctx.moveTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
				ctx.lineTo(x + Math.cos(a) * r * 1.35, y + Math.sin(a) * r * 1.35);
				ctx.stroke();
			}
			ctx.restore();
			return;
		}
		if(p._igStyle === 'drop'){
			ctx.translate(x, y);
			ctx.rotate(0.2);
			drawFireBall(0, 0, r, p.color || '#ff3300', p.color2 || '#ffaa33', pulse);
			ctx.restore();
			return;
		}
		drawFireBall(x, y, r, p.color || '#ff3300', p.color2 || '#ffcc66', pulse);
		ctx.restore();
	}

	function drawIgnarothWorld(){
		if(typeof IS_DUNGEON === 'undefined' || !IS_DUNGEON || DUNGEON_TYPE !== 'fire') return;
		if(typeof enemies === 'undefined') return;
		let en = null;
		for(let i = 0; i < enemies.length; i++){
			if(enemies[i] && enemies[i].type === 'fireDragon' && !enemies[i].dead && enemies[i]._ig){ en = enemies[i]; break; }
		}
		if(!en) return;
		const ig = en._ig;
		const room = igRoom(en);
		const camx = camera.x, camy = camera.y;
		const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;

		if(room && room.authoredArena){
			const pulse = 0.16 + 0.08 * Math.sin(t * 2.2);
			ctx.fillStyle = 'rgba(255,40,0,' + (ig.phase >= 2 ? 0.10 + pulse * 0.08 : 0.05) + ')';
			ctx.fillRect(room.x - camx, room.y - camy, room.w, 90);
			const cracks = room.cracks || [];
			for(let i = 0; i < cracks.length; i++){
				const c = cracks[i];
				ctx.fillStyle = ig.phase >= 2 ? 'rgba(255,90,20,0.55)' : 'rgba(80,20,8,0.8)';
				ctx.fillRect(c.x - camx, c.y - camy, c.w, 6);
			}
		}

		for(let i = 0; i < ig.walls.length; i++){
			const w = ig.walls[i];
			const u = (t * 9 + w.x * 0.02) % 1;
			const g = ctx.createLinearGradient(0, w.y - camy, 0, w.y + w.h - camy);
			g.addColorStop(0, 'rgba(255,230,120,0.15)');
			g.addColorStop(0.15 + u * 0.1, 'rgba(255,200,70,0.75)');
			g.addColorStop(0.45, 'rgba(255,80,0,0.88)');
			g.addColorStop(1, 'rgba(70,8,0,0.35)');
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.moveTo(w.x - camx, w.y + w.h - camy);
			ctx.quadraticCurveTo(w.x - camx + w.w * 0.2, w.y - camy + 10 * Math.sin(t * 14 + w.x), w.x - camx + w.w * 0.5, w.y - camy);
			ctx.quadraticCurveTo(w.x - camx + w.w * 0.8, w.y - camy + 8 * Math.cos(t * 12), w.x - camx + w.w, w.y + w.h - camy);
			ctx.closePath();
			ctx.fill();
		}
		for(let i = 0; i < ig.pools.length; i++){
			const p = ig.pools[i];
			if(typeof DungeonEnv !== 'undefined' && DungeonEnv.drawLavaPool) DungeonEnv.drawLavaPool(ctx, p.x, p.y, p.w, p.h, p.x);
			else { ctx.fillStyle = 'rgba(255,70,0,0.75)'; ctx.fillRect(p.x - camx, p.y - camy, p.w, p.h); }
		}
		for(let i = 0; i < ig.zones.length; i++){
			const z = ig.zones[i];
			const warn = !z.hot || z.life > (z.hotFor || 0);
			ctx.save();
			if(z.kind === 'circ'){
				ctx.strokeStyle = warn ? 'rgba(255,200,40,0.85)' : 'rgba(255,40,0,0.9)';
				ctx.fillStyle = warn ? 'rgba(255,160,0,0.16)' : 'rgba(255,40,0,0.28)';
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.arc(z.cx - camx, z.cy - camy, z.r, 0, Math.PI * 2);
				ctx.fill(); ctx.stroke();
			} else {
				const zg = ctx.createLinearGradient(0, z.y - camy, 0, z.y + z.h - camy);
				zg.addColorStop(0, warn ? 'rgba(255,180,40,0.08)' : 'rgba(255,80,0,0.08)');
				zg.addColorStop(1, warn ? 'rgba(255,140,20,0.42)' : 'rgba(255,40,0,0.5)');
				ctx.fillStyle = zg;
				ctx.fillRect(z.x - camx, z.y - camy, z.w, z.h);
			}
			ctx.restore();
		}

		const fxs = ig.fx || [];
		for(let i = 0; i < fxs.length; i++){
			const f = fxs[i];
			const a = f.life / (f.max || 1);
			ctx.save();
			if(f.kind === 'stream'){
				const len = 220 * a;
				const g = ctx.createLinearGradient(f.x - camx, f.y - camy, f.x - camx + Math.cos(f.ang) * len, f.y - camy + Math.sin(f.ang) * len);
				g.addColorStop(0, 'rgba(255,240,180,0.85)');
				g.addColorStop(0.4, 'rgba(255,120,20,0.55)');
				g.addColorStop(1, 'rgba(255,40,0,0)');
				ctx.strokeStyle = g;
				ctx.lineWidth = 18 * a;
				ctx.lineCap = 'round';
				ctx.beginPath();
				ctx.moveTo(f.x - camx, f.y - camy);
				ctx.lineTo(f.x - camx + Math.cos(f.ang) * len, f.y - camy + Math.sin(f.ang) * len);
				ctx.stroke();
			} else if(f.kind === 'glow'){
				drawFireBall(f.x - camx, f.y - camy, f.r * a, '#ff3300', '#ffe680', 1 - a);
			} else if(f.kind === 'ring'){
				ctx.strokeStyle = 'rgba(255,180,60,' + (0.7 * a) + ')';
				ctx.lineWidth = 4;
				ctx.beginPath();
				ctx.arc(f.x - camx, f.y - camy, 40 + (1 - a) * 160, 0, Math.PI * 2);
				ctx.stroke();
			} else if(f.kind === 'arc'){
				ctx.strokeStyle = 'rgba(255,160,40,' + (0.7 * a) + ')';
				ctx.lineWidth = 5;
				ctx.beginPath();
				ctx.arc(f.x - camx, f.y - camy, f.r, f.dir > 0 ? -0.4 : Math.PI - 0.4, f.dir > 0 ? 1.2 : Math.PI + 1.2);
				ctx.stroke();
			} else if(f.kind === 'streak'){
				ctx.strokeStyle = 'rgba(255,90,20,' + (0.65 * a) + ')';
				ctx.lineWidth = 10;
				ctx.lineCap = 'round';
				ctx.beginPath();
				ctx.moveTo(f.x - camx, f.y - camy);
				ctx.lineTo(f.x - camx - (f.vx || 0) * 8, f.y - camy - (f.vy || 0) * 8);
				ctx.stroke();
			} else if(f.kind === 'crater'){
				ctx.fillStyle = 'rgba(40,8,0,' + (0.45 * a) + ')';
				ctx.beginPath(); ctx.ellipse(f.x - camx, f.y - camy, f.r, f.r * 0.34, 0, 0, Math.PI * 2); ctx.fill();
				ctx.fillStyle = 'rgba(255,80,0,' + (0.28 * a) + ')';
				ctx.beginPath(); ctx.ellipse(f.x - camx, f.y - camy, f.r * 0.55, f.r * 0.18, 0, 0, Math.PI * 2); ctx.fill();
			} else if(f.kind === 'gust'){
				ctx.strokeStyle = 'rgba(255,200,120,' + (0.4 * a) + ')';
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.moveTo(f.x - camx, f.y - camy);
				ctx.quadraticCurveTo(f.x - camx + f.dir * 50, f.y - camy - 20, f.x - camx + f.dir * 90 * a, f.y - camy + 8);
				ctx.stroke();
			}
			ctx.restore();
		}

		if(ig.atk && ig.atk.name === 'barrage' && ig.suns){
			for(let i = 0; i < ig.suns.length; i++){
				const s = ig.suns[i];
				if(s.gone || ig.atk.t >= s.delay) continue;
				const grow = Math.min(1, ig.atk.t / Math.max(12, s.delay - 8));
				drawFireBall((s.x || en.x) - camx, (s.y || en.y) - camy, s.sz * 0.42 * grow, '#ff3300', '#ffe680', 1);
			}
		}

		if(ig.atk && ig.atk.name === 'dive' && ig.target && ig.atk.t >= 50 && ig.atk.t < 138){
			const pulse = 0.45 + 0.55 * Math.sin(t * 12);
			ctx.strokeStyle = 'rgba(255,210,40,' + pulse + ')';
			ctx.lineWidth = 4;
			ctx.beginPath();
			ctx.arc(ig.target.x - camx, ig.target.y - camy, 88, 0, Math.PI * 2);
			ctx.stroke();
		}
		if(ig.atk && ig.atk.name === 'meteor' && ig.target && !ig.atk.boom){
			ctx.strokeStyle = 'rgba(255,80,20,0.9)';
			ctx.fillStyle = 'rgba(255,40,0,0.16)';
			ctx.lineWidth = 5;
			ctx.beginPath();
			ctx.arc(ig.target.x - camx, ig.target.y - camy, ig.target.r, 0, Math.PI * 2);
			ctx.fill(); ctx.stroke();
		}
		if(ig.atk && ig.atk.name === 'tail' && ig.atk.t < 44){
			const tl = igTail(en);
			ctx.strokeStyle = 'rgba(255,180,40,0.75)';
			ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(tl.x - camx, tl.y - camy, 50, 0, Math.PI * 2); ctx.stroke();
		}
		if(ig.vulnerable > 0){
			ctx.strokeStyle = 'rgba(255,230,120,0.75)';
			ctx.lineWidth = 3;
			ctx.strokeRect(en.x - camx - 8, en.y - camy - 8, en.w + 16, en.h + 16);
		}
	}

	global.updateIgnaroth = updateIgnaroth;
	global.drawIgnarothWorld = drawIgnarothWorld;
	global.drawIgnarothProj = drawIgnarothProj;

	/* ---- Multi-sheet sprite draw (fireDragonA/B/C — all 4 rows × 6 cols) ---- */
	const IG_COLS = 6;
	const IG_ROWS = 4;
	const IG_FPS = (typeof SPRITE_FPS === 'number') ? SPRITE_FPS : 8;

	function igSheets(){
		return (typeof IGNAROTH_SHEETS !== 'undefined') ? IGNAROTH_SHEETS : null;
	}

	function igPickAnim(en){
		const ig = en._ig;
		if(en.dead) return { sheet:'A', row:3, once:true };
		const atk = ig && ig.atk && ig.atk.name;
		/* Sheet B — ground assault (README 6b) */
		if(atk === 'breath') return { sheet:'B', row:0 };
		if(atk === 'dive') return { sheet:'B', row:1 };
		if(atk === 'tail') return { sheet:'B', row:2 };
		if(atk === 'roar') return { sheet:'B', row:3 };
		/* Sheet C — aerial assault (README 6c) */
		if(atk === 'scorch') return { sheet:'C', row:0 };
		if(atk === 'pursuit') return { sheet:'C', row:1 };
		if(atk === 'meteor') return { sheet:'C', row:2 };
		if(atk === 'tempest') return { sheet:'C', row:3 };
		/* Generic attack poses on main sheet */
		if(atk === 'barrage' || atk === 'erupt') return { sheet:'A', row:2 };
		/* Locomotion on sheet A */
		const loco = ig && ig.loco;
		if(loco === 'fly' || loco === 'launch' || loco === 'land' || loco === 'sprint' || loco === 'walk'){
			if(loco === 'walk' && Math.abs(en.vx || 0) < 0.35 && Math.abs(en.vy || 0) < 0.35){
				return { sheet:'A', row:0 };
			}
			return { sheet:'A', row:1 };
		}
		return { sheet:'A', row:0 };
	}

	function drawIgnarothSprite(en){
		const sheets = igSheets();
		if(!sheets) return false;
		const pick = igPickAnim(en);
		const img = sheets[pick.sheet];
		if(!img || !img.complete || !img.naturalWidth) return false;

		const fW = img.naturalWidth / IG_COLS;
		const fH = img.naturalHeight / IG_ROWS;
		en._igSprKey = pick.sheet + ':' + pick.row;
		if(en._igSprLast !== en._igSprKey){
			en._igSprLast = en._igSprKey;
			en._igSprFrame = 0;
			en._igSprTimer = 0;
		}
		en._igSprTimer = (en._igSprTimer || 0) + 1;
		if(en._igSprTimer >= IG_FPS){
			en._igSprTimer = 0;
			if(pick.once){
				if((en._igSprFrame || 0) < IG_COLS - 1) en._igSprFrame = (en._igSprFrame || 0) + 1;
			} else {
				en._igSprFrame = ((en._igSprFrame || 0) + 1) % IG_COLS;
			}
		}
		const frame = Math.min(en._igSprFrame || 0, IG_COLS - 1);
		/* 4232x2362 does not divide evenly by 6x4, so inset a hair to avoid pulling in
		   a sliver of the neighbouring frame. */
		const bleed = 1;
		const sx = frame * fW + bleed;
		const sy = pick.row * fH + bleed;
		const sw = fW - bleed * 2;
		const sh = fH - bleed * 2;

		const dest = (typeof enemySpriteDestSize === 'function')
			? enemySpriteDestSize(en, sw, sh)
			: { rW: en.w * 1.15, rH: en.h * 1.15 };
		const rW = dest.rW, rH = dest.rH;
		const camx = (typeof camera !== 'undefined') ? camera.x : 0;
		const camy = (typeof camera !== 'undefined') ? camera.y : 0;
		const ex = en.x - camx;
		const ey = en.y - camy;
		const cx = ex + en.w / 2;
		const cy = ey + en.h / 2;
		const flying = !(en._ig && en._ig.onGround);

		ctx.save();
		if(en.flash > 0) ctx.filter = 'brightness(2.5) saturate(0.3)';
		if(en.facing === -1){
			ctx.translate(cx, flying ? cy : (ey + en.h - rH / 2));
			ctx.scale(-1, 1);
			ctx.drawImage(img, sx, sy, sw, sh, -rW / 2, -rH / 2, rW, rH);
		} else if(flying){
			ctx.drawImage(img, sx, sy, sw, sh, cx - rW / 2, cy - rH / 2, rW, rH);
		} else {
			ctx.drawImage(img, sx, sy, sw, sh, cx - rW / 2, ey + en.h - rH, rW, rH);
		}
		ctx.restore();
		return true;
	}

	global.drawIgnarothSprite = drawIgnarothSprite;
})(typeof window !== 'undefined' ? window : globalThis);
