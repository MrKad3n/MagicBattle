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


	/* =============================================================
	   FIRE ENGINE — turbulent additive particles (white-hot core → yellow → orange → red → smoke).
	   Everything the dragon does is built from this, so fire behaves like fire: it rises, licks,
	   spreads, cools and turns to smoke instead of being a static gradient.
	   ============================================================= */
	const FP = [];
	const FP_MAX = 1400;
	const FP_SPR = {};
	let _curIg = null;
	function fpSprite(kind){
		if(FP_SPR[kind]) return FP_SPR[kind];
		const S = 64, c = document.createElement('canvas'); c.width = c.height = S;
		const g = c.getContext('2d');
		const cols = {
			hot:   ['rgba(255,255,245,1)', 'rgba(255,238,150,0.85)', 'rgba(255,190,60,0.35)', 'rgba(255,150,30,0)'],
			fire:  ['rgba(255,235,140,0.95)', 'rgba(255,160,40,0.8)', 'rgba(255,90,10,0.32)', 'rgba(255,60,0,0)'],
			red:   ['rgba(255,120,30,0.8)', 'rgba(230,50,10,0.6)', 'rgba(150,20,0,0.25)', 'rgba(90,10,0,0)'],
			ember: ['rgba(255,250,200,1)', 'rgba(255,170,50,0.9)', 'rgba(255,90,10,0.3)', 'rgba(255,60,0,0)'],
			smoke: ['rgba(46,36,34,0.55)', 'rgba(36,28,26,0.4)', 'rgba(28,22,20,0.15)', 'rgba(20,16,14,0)'],
			lava:  ['rgba(255,220,120,1)', 'rgba(255,110,20,0.95)', 'rgba(110,20,0,0.9)', 'rgba(40,6,0,0)'],
		}[kind];
		const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
		gr.addColorStop(0, cols[0]); gr.addColorStop(0.3, cols[1]); gr.addColorStop(0.65, cols[2]); gr.addColorStop(1, cols[3]);
		g.fillStyle = gr; g.fillRect(0, 0, S, S);
		return FP_SPR[kind] = c;
	}
	/* o: vx vy life size grow(per frame, ×) rise(buoyancy) drag turb heat(start 0-1) kind smoke */
	function fpEmit(x, y, o){
		if(FP.length >= FP_MAX) return;
		FP.push({
			x: x, y: y, vx: o.vx || 0, vy: o.vy || 0,
			life: o.life || 30, max: o.life || 30, size: o.size || 20, grow: o.grow == null ? 1.0 : o.grow,
			rise: o.rise == null ? 0.12 : o.rise, drag: o.drag == null ? 0.96 : o.drag, turb: o.turb == null ? 0.5 : o.turb,
			heat: o.heat == null ? 1 : o.heat, kind: o.kind || 'fire', smoke: o.smoke || 0, ph: Math.random() * 6.28, gnd: !!o.gnd,
		});
	}
	function fpUpdate(){
		for(let i = FP.length - 1; i >= 0; i--){
			const p = FP[i];
			p.life--;
			if(p.life <= 0){
				if(p.smoke && FP.length < FP_MAX && Math.random() < p.smoke) fpEmit(p.x, p.y, { kind:'smoke', vx:p.vx * 0.3, vy:-0.7 - Math.random() * 0.8, life:46 + Math.random() * 30, size:p.size * 1.2, grow:1.03, rise:0.02, drag:0.98, turb:0.3 });
				FP.splice(i, 1); continue;
			}
			const u = 1 - p.life / p.max;
			p.vx += Math.sin(p.ph + u * 9) * p.turb * 0.18;
			p.vy -= p.rise;
			p.vx *= p.drag; p.vy *= p.drag;
			p.x += p.vx; p.y += p.vy;
			p.size *= p.grow;
		}
	}
	function fpDraw(camx, camy){
		if(!FP.length) return;
		ctx.save();
		// smoke first (normal blend), then fire additively on top
		for(let pass = 0; pass < 2; pass++){
			ctx.globalCompositeOperation = pass ? 'lighter' : 'source-over';
			for(let i = 0; i < FP.length; i++){
				const p = FP[i];
				if((p.kind === 'smoke') === (pass === 1)) continue;
				const u = p.life / p.max;
				let img, a;
				if(p.kind === 'smoke'){ img = fpSprite('smoke'); a = Math.min(1, u * 1.6) * 0.9; }
				else if(p.kind === 'ember'){ img = fpSprite('ember'); a = Math.min(1, u * 2.2); }
				else if(p.kind === 'lava'){ img = fpSprite('lava'); a = Math.min(1, u * 2); }
				else {
					const h = u * p.heat;
					img = fpSprite(h > 0.62 ? 'hot' : h > 0.3 ? 'fire' : 'red');
					a = Math.min(1, u * 1.9);
				}
				const sx = p.x - camx, sy = p.y - camy, r = p.size * 0.5;
				if(sx < -90 || sy < -90 || sx > canvas.width + 90 || sy > canvas.height + 90) continue;
				ctx.globalAlpha = a;
				ctx.drawImage(img, sx - r, sy - r, r * 2, r * 2);
			}
		}
		ctx.restore();
	}
	/* radial blast: flame + embers + a ring of smoke */
	function fpBurst(x, y, n, spd, size, o){
		o = o || {};
		for(let i = 0; i < n; i++){
			const a = (o.arc ? o.a0 + Math.random() * o.arc : Math.random() * 6.283), v = spd * (0.35 + Math.random() * 0.75);
			fpEmit(x, y, { vx:Math.cos(a) * v, vy:Math.sin(a) * v * (o.flat || 1), life:20 + Math.random() * 24, size:size * (0.7 + Math.random() * 0.7), grow:1.035, rise:0.08, drag:0.93, smoke:0.5 });
		}
		for(let i = 0; i < n * 0.6; i++){
			const a = Math.random() * 6.283, v = spd * (0.6 + Math.random() * 1.1);
			fpEmit(x, y, { kind:'ember', vx:Math.cos(a) * v, vy:Math.sin(a) * v * (o.flat || 1) - 2, life:34 + Math.random() * 40, size:6 + Math.random() * 7, grow:0.985, rise:-0.1, drag:0.97, turb:1 });
		}
	}
	/* a licking column of flame rooted at (x,y) going up */
	function fpColumn(x, y, w, h, n, power){
		for(let i = 0; i < n; i++){
			const ox = (Math.random() - 0.5) * w;
			const edge = Math.abs(ox) / (w * 0.5 + 1);
			const v = (power || 13) * (0.55 + Math.random() * 0.6) * (1 - edge * 0.4);
			fpEmit(x + ox, y, { vx:ox * 0.012 + (Math.random() - 0.5) * 1.6, vy:-v, life:Math.max(14, h / Math.max(4, v) * 1.5) + Math.random() * 8, size:(30 + Math.random() * 34) * (1 - edge * 0.35), grow:0.99, rise:0.2, drag:0.955, turb:0.8, smoke:0.25 });
		}
		if(Math.random() < 0.7) fpEmit(x + (Math.random() - 0.5) * w * 0.7, y - 6, { kind:'lava', vx:(Math.random() - 0.5) * 3, vy:-(power || 13) * (0.7 + Math.random() * 0.6), life:40, size:11 + Math.random() * 8, grow:0.99, rise:-0.38, drag:0.99, turb:0.1 });
	}
	function igCurrentIg(){ return _curIg; }

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
		return Math.round(n * diff * 1.4);
	}
	function igBurn(extra){ return extra || [{ type:'burn', dmg:8, interval:20, ticks:5, color:'#ff3300' }]; }
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
	function igBanner(t){ /* boss callouts are no longer shown as text over the health bar */ }
	function igFlash(ig, a){ ig.flash = Math.max(ig.flash || 0, a); }
	function igRay(x, y, ang, max){
		for(let d = 24; d < max; d += 20){
			if(igSolidAt(x + Math.cos(ang) * d, y + Math.sin(ang) * d)) return d;
		}
		return max;
	}
	/* a fire wave that rolls along the floor — jump it */
	function igWave(ig, x, fy, dir, o){
		o = o || {};
		ig.waves = ig.waves || [];
		ig.waves.push({ x:x, y:fy, dir:dir, spd:o.spd || 9, h:o.h || 84, life:o.life || 90, dmg:o.dmg || 38, hit:false, seed:Math.random() * 9 });
	}
	function igShake(a, b){ if(typeof shakeScreen === 'function') shakeScreen(a, b); }
	function igPart(x, y, n, cols){
		for(let i = 0; i < n; i++){
			const hot = Math.random() < 0.45;
			fpEmit(x + (Math.random() - 0.5) * 46, y + (Math.random() - 0.5) * 28, hot
				? { kind:'ember', vx:(Math.random() - 0.5) * 4, vy:-1.2 - Math.random() * 3.2, life:30 + Math.random() * 30, size:5 + Math.random() * 6, grow:0.985, rise:0.03, drag:0.97, turb:1 }
				: { vx:(Math.random() - 0.5) * 3, vy:-0.8 - Math.random() * 2.2, life:18 + Math.random() * 16, size:16 + Math.random() * 14, grow:1.02, rise:0.1, turb:0.8, smoke:0.3 });
		}
	}
	/* attack origins come from the rig's joints, so fire leaves the actual jaws, wings and tail */
	function igJoint(en, name){
		const R = en._rig, J = R && R.joints && R.joints[name];
		return J && isFinite(J.x) && isFinite(J.y) ? { x:J.x, y:J.y } : null;
	}
	function igMouth(en){
		return igJoint(en, 'mouth') || { x: en.x + en.w / 2 + (en.facing || 1) * 118, y: en.y + en.h * 0.34 };
	}
	function igTail(en){
		return igJoint(en, 'tail') || { x: en.x + en.w / 2 - (en.facing || 1) * 132, y: en.y + en.h * 0.66 };
	}
	function igBelly(en){
		return igJoint(en, 'belly') || { x: en.x + en.w / 2 + (en.facing || 1) * 10, y: en.y + en.h - 10 };
	}
	function igWing(en, side){
		const a = igJoint(en, 'wingNearRoot'), b = igJoint(en, 'wingFarRoot');
		if(a && b) return (side > 0) === (a.x >= b.x) ? a : b;
		return { x: en.x + en.w / 2 + side * 92, y: en.y + 46 };
	}
	function igFX(ig, fx){
		ig.fx.push(fx);
		if(fx.kind === 'ring'){ fpBurst(fx.x, fx.y, 34, 9, 40, { arc:Math.PI, a0:Math.PI, flat:0.55 }); fpBurst(fx.x, fx.y, 14, 5, 60); }
		else if(fx.kind === 'crater'){
			fpBurst(fx.x, fx.y, 46, 11, 46, { arc:Math.PI, a0:Math.PI, flat:0.9 });
			for(let k = 0; k < 7; k++) fpColumn(fx.x + (Math.random() - 0.5) * fx.r * 1.5, fx.y, 40, 160, 7, 12 + Math.random() * 5);
			for(let k = 0; k < 10; k++) fpEmit(fx.x, fx.y - 6, { kind:'lava', vx:(Math.random() - 0.5) * 14, vy:-8 - Math.random() * 11, life:55, size:10 + Math.random() * 12, grow:0.99, rise:-0.42, drag:0.995, turb:0.1 });
		}
		else if(fx.kind === 'gust'){ for(let k = 0; k < 3; k++) fpEmit(fx.x, fx.y + k * 8, { kind:'ember', vx:fx.dir * (7 + Math.random() * 5), vy:(Math.random() - 0.5) * 2, life:30, size:7, grow:0.99, rise:0, drag:0.99, turb:1.5 }); }
	}

	function igOrb(x, y, vx, vy, opts){
		if(typeof spawnEnemyProj !== 'function') return null;
		opts = opts || {};
		const pal = ORB_COLORS[(opts.pal != null ? opts.pal : Math.floor(Math.random() * ORB_COLORS.length))];
		const p = spawnEnemyProj(x, y, vx, vy, {
			color: opts.color || pal[0],
			color2: opts.color2 || pal[1],
			power: Math.round((opts.power || 40) * 1.35),
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
		const ig = _curIg; if(!ig) return;
		(ig.tels = ig.tels || []).push({ x:x, y:y, w:w, h:h, life:frames, max:frames, seed:Math.random() * 9 });
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
		const sf = igSurface(room, en);
		en.x = sf.x + sf.w / 2 - en.w / 2;
		en.y = sf.y - en.h;
		en._igGroundY = en.y;
		en.facing = (igPx() >= en.x + en.w / 2) ? 1 : -1;
		ig.stance = 'ground'; ig.loco = 'walk'; ig.onGround = true;
		ig.vx = 0; ig.vy = 0; ig.intro = 150;
		igBanner('IGNAROTH — THE INFERNO DRAGON');
		igShake(12, 28);
		return ig;
	}

	function igHitbox(en){
		return { x: en.x + 36, y: en.y + 16, w: en.w - 72, h: en.h - 20 };
	}
	/* where he stands: the arena's central platform, or the arena floor when there is none.
	   He collides with this surface and the room walls only (not every floating ledge), which is what
	   keeps him from snagging on geometry, wedging into stone or popping to a new spot. */
	function igSurface(room, en){
		const plats = igPlats(room);
		for(let i = 0; i < plats.length; i++){
			if(plats[i].central) return { x:plats[i].x, w:plats[i].w, y:plats[i].y, plat:plats[i] };
		}
		let y = igGround(room);
		if(en){
			const fy = igFloorY(en.x + en.w / 2, room.y + 80, room.h);
			if(fy < room.y + room.h) y = fy;
		}
		return { x:room.x + 48, w:room.w - 96, y:y, plat:null };
	}
	function igApply(en, room, ig){
		if(!isFinite(en.x) || !isFinite(en.y) || !isFinite(ig.vx) || !isFinite(ig.vy)){
			const sf0 = igSurface(room, en);
			en.x = sf0.x + sf0.w / 2 - en.w / 2; en.y = sf0.y - en.h - 40; ig.vx = 0; ig.vy = 0;
		}
		ig.onGround = false;
		const prevBottom = en.y + en.h;
		ig.vx = Math.max(-14, Math.min(14, ig.vx));
		ig.vy = Math.max(-14, Math.min(16, ig.vy));
		en.x += ig.vx;
		en.y += ig.vy;
		// room walls and ceiling
		if(en.x < room.x + 36){ en.x = room.x + 36; ig.vx = Math.max(0, ig.vx); }
		if(en.x + en.w > room.x + room.w - 36){ en.x = room.x + room.w - 36 - en.w; ig.vx = Math.min(0, ig.vx); }
		if(en.y < room.y + 24){ en.y = room.y + 24; ig.vy = Math.max(0, ig.vy); }
		// the standing surface
		const sf = igSurface(room, en);
		const cxm = en.x + en.w / 2;
		const overX = cxm >= sf.x - 30 && cxm <= sf.x + sf.w + 30;
		const feet = en.y + en.h;
		if(overX && ig.vy >= -0.2 && feet >= sf.y - 1 && (prevBottom <= sf.y + 14 + Math.max(0, ig.vy) || feet <= sf.y + 150)){
			en.y = sf.y - en.h;
			if(ig.vy > 3.5 && !ig._landed) ig._landed = true;
			ig.vy = 0;
			ig.onGround = true;
		} else if(feet > room.y + room.h - 12){
			// fell past the edge into the pit: never stand there — beat the wings and climb out
			en.y = room.y + room.h - 12 - en.h;
			ig.vy = -9; ig.stance = 'fly'; ig.loco = 'fly';
		} else if(!overX && ig.stance === 'ground' && feet > sf.y + 4){
			ig.vy = Math.min(ig.vy, -6); ig.stance = 'fly'; ig.loco = 'fly';
		}
		if(!ig.onGround) ig._landed = false;
		en._igGroundY = sf.y - en.h;
		// keep walking inside the platform's reach
		if(ig.stance === 'ground' && ig.onGround){
			const lo = sf.x + 10 - en.w / 2, hi = sf.x + sf.w - 10 - en.w / 2;
			if(en.x < lo){ en.x = lo; ig.vx = Math.max(0, ig.vx); }
			if(en.x > hi){ en.x = hi; ig.vx = Math.min(0, ig.vx); }
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
			const sf = igSurface(room, en);
			const tx = sf.x + sf.w * 0.5 - en.w / 2 - en.x;
			const here = Math.abs(tx) < sf.w * 0.5 - 90;
			ig.vx += here ? Math.sign(igPx() - (en.x + en.w / 2)) * 0.1 : Math.sign(tx) * 0.24;
			ig.vy += 0.3;
			if(en.y + en.h < sf.y - 220) ig.vy += 0.05;
			igCap(ig, 6.2);
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
		if(ig.flash > 0) ig.flash--;
		const ws = ig.waves || [];
		for(let i = ws.length - 1; i >= 0; i--){
			const w = ws[i];
			w.life--; w.x += w.dir * w.spd;
			if(Math.random() < 0.6) igPart(w.x, w.y - 10, 1, ['#ff4400', '#ffcc66']);
			if(!w.hit && igIn(w.x - 34, w.y - w.h, 68, w.h)){ w.hit = true; igHit(w.dmg, ['horizontalLaunch']); }
			if(w.life <= 0 || igSolidAt(w.x + w.dir * 36, w.y - 24)) ws.splice(i, 1);
		}
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
		if(ig.phase >= 2 && !close){ add('cascade', ig.phase >= 3 ? 4 : 3); }
		if(ig.phase >= 2 && close){ add('cascade', 2); }
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
		ig.cone = null;
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
			const coneL = igRay(m0.x, m0.y, ig.ang, 640);
			if(a.t < charge){
				ig.cone = { x:m0.x, y:m0.y, ang:ig.ang, L:coneL, k:a.t / charge, fire:false };
				igPart(m0.x, m0.y, 4, ['#ff2200', '#ff8800', '#ffe680']);
				if(a.t % 6 === 0) igFX(ig, { kind:'glow', x:m0.x, y:m0.y, r:18 + a.t * 0.4, life:8, max:8 });
			} else {
				ig.cone = { x:m0.x, y:m0.y, ang:ig.ang, L:coneL, k:1, fire:true };
				{
					const rx = igPx() - m0.x, ry = igPy() - m0.y;
					const along = rx * Math.cos(ig.ang) + ry * Math.sin(ig.ang);
					const perp = Math.abs(-rx * Math.sin(ig.ang) + ry * Math.cos(ig.ang));
					if(along > 0 && along < coneL && perp < 26 + along * 0.15) igHit(ph >= 3 ? 24 : 18);
				}
				if(a.t % 3 === 0) igPart(m0.x + Math.cos(ig.ang) * coneL * Math.random(), m0.y + Math.sin(ig.ang) * coneL * Math.random(), 2, ['#ff4400', '#ffcc66']);
				if(a.t % (ph >= 3 ? 6 : 8) === 0) breathVolley(en, ig, ph);
				igShake(a.t % 8 === 0 ? 4 : 0, 6);
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
				igFX(ig, { kind:'crater', x:ix, y:iy, r:130, life:60, max:60 });
				igFX(ig, { kind:'ring', x:ix, y:iy, r:30, life:26, max:26 });
				igWave(ig, ix - 60, iy, -1, { spd:10, dmg:40, h:96 });
				igWave(ig, ix + 60, iy, 1, { spd:10, dmg:40, h:96 });
				igFlash(ig, 14);
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
					{ side: 1, lead: 10, delay: 114, sz: 56 },
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
				if(d > 50 && d < 420) igHit(58, ['horizontalLaunch']);
				const dir = en.facing || 1;
				for(let i = 0; i < 8; i++){
					const ang = (i / 7) * Math.PI - 0.1;
					igOrb(tl.x, tl.y, Math.cos(ang) * 7.6 * dir, -Math.sin(ang) * 6.0, {
						pal: i % 6, power: 40, w: 30 + i * 2, h: 26, age: 64, spin: 0.14, style: 'shard',
					});
				}
				igWave(ig, tl.x, igFloorY(tl.x, tl.y - 10, 320), dir, { spd:11, dmg:42, h:90, life:80 });
				igFX(ig, { kind:'ring', x:tl.x, y:tl.y, r:30, life:20, max:20 });
				igFlash(ig, 8);
				igShake(14, 18);
			}
			if(a.t > 76) igEnd(en, 60, 0);
		} else if(a.name === 'cascade'){
			ig.loco = ig.onGround ? 'walk' : 'land';
			igDrive(en, ig, room, ig.loco);
			en.facing = igPx() >= cx ? 1 : -1;
			if(a.t === 1){
				const dir = igPx() >= cx ? 1 : -1;
				a.cols = [];
				const n = ph >= 3 ? 10 : 8;
				for(let i = 0; i < n; i++){
					const x = cx + dir * (150 + i * 128);
					const fy = igFloorY(x, en.y + en.h - 140, 420);
					if(fy >= en.y + en.h + 270) continue;
					a.cols.push({ x:x, fy:fy, t0:14 + i * 7 });
				}
			}
			for(let i = 0; i < (a.cols || []).length; i++){
				const c = a.cols[i];
				if(a.t === c.t0) igTel(c.x - 46, c.fy - 300, 92, 300, 26, '');
				if(a.t === c.t0 + 26){
					ig.zones.push({ kind:'rect', x:c.x - 46, y:c.fy - 300, w:92, h:300, life:24, hot:true, hotFor:18, dmg:38, fx:['horizontalLaunch'] });
					for(let k = 0; k < 4; k++){
						igOrb(c.x + (k - 1.5) * 12, c.fy - 10, (k - 1.5) * 1.3, -9.5 - k * 0.8, { pal:(i + k) % 6, power:34, w:26 + k * 4, h:38, age:62, grav:0.12, style:'drop' });
					}
					igFX(ig, { kind:'ring', x:c.x, y:c.fy, r:20, life:16, max:16 });
					igShake(7, 10);
				}
			}
			if(a.t === 14) igShake(8, 12);
			if(a.t > 14 + 10 * 7 + 60) igEnd(en, 64, 0);
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
				igFlash(ig, 10);
				if(ig.onGround && Math.abs(igPx() - cx) < 560){ igHit(26, ['horizontalLaunch']); player.vx += (igPx() >= cx ? 1 : -1) * 9; }
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
			ig.loco = ig.onGround ? 'walk' : 'land';
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


	/* the dragon itself burns: smoke from the nostrils, embers off the wings, flames licking the jaws while it fights */
	function igAmbient(en, ig, room){
		const f = en.facing || 1, T = en.animTimer || 0;
		const m = igMouth(en);
		if(T % 4 === 0) fpEmit(m.x, m.y + 6, { kind:'smoke', vx:f * 0.8, vy:-0.6, life:50, size:20, grow:1.03, rise:0.03, turb:0.4 });
		if(ig.atk || ig.phase >= 2){
			const rate = ig.phase >= 3 ? 0.9 : ig.phase >= 2 ? 0.55 : 0.3;
			for(let s = -1; s <= 1; s += 2){
				if(Math.random() < rate){
					const w = igWing(en, s);
					fpEmit(w.x + s * 20 + (Math.random() - 0.5) * 30, w.y + 10 + Math.random() * 50, { kind:'ember', vx:s * (0.5 + Math.random()), vy:-0.3 + Math.random() * 1.2, life:46, size:6, grow:0.99, rise:-0.05, turb:1.2 });
				}
			}
			if(Math.random() < rate * 0.8) fpEmit(en.x + en.w * Math.random(), en.y + en.h * (0.2 + Math.random() * 0.5), { vx:(Math.random() - 0.5) * 1.2, vy:-1.2 - Math.random(), life:22, size:22, grow:1.0, rise:0.1, turb:0.8, smoke:0.3 });
		}
		if(ig.phase >= 3 && T % 3 === 0){          // avatar of the inferno: sheathed in flame
			fpEmit(en.x + Math.random() * en.w, en.y + 30 + Math.random() * (en.h - 60), { vx:(Math.random() - 0.5), vy:-2.4 - Math.random() * 2, life:26, size:38 + Math.random() * 20, grow:0.99, rise:0.1, turb:0.7, smoke:0.2 });
		}
		// charging breath / meteor: fire is dragged into the jaws
		const a = ig.atk;
		if(a && (a.name === 'meteor' || (a.name === 'breath' && a.t < 50))){
			const k = a.name === 'meteor' ? Math.min(1, a.t / 90) : a.t / 50;
			for(let i = 0; i < 2 + Math.round(k * 3); i++){
				const ang = Math.random() * 6.283, d = 70 + Math.random() * 90;
				fpEmit(m.x + Math.cos(ang) * d, m.y + Math.sin(ang) * d, { vx:-Math.cos(ang) * (d / 14), vy:-Math.sin(ang) * (d / 14), life:14, size:16 + k * 10, grow:0.94, rise:0, drag:1, turb:0.2, heat:1 });
			}
		}
		// the breath itself: a torrent, not a beam
		if(ig.cone && ig.cone.fire){
			const c = ig.cone;
			for(let i = 0; i < 7; i++){
				const spread = (Math.random() - 0.5) * (0.1 + Math.random() * 0.26);
				const ang = c.ang + spread, v = 14 + Math.random() * 10;
				fpEmit(c.x + Math.cos(c.ang) * 20, c.y + Math.sin(c.ang) * 20, {
					vx:Math.cos(ang) * v, vy:Math.sin(ang) * v, life:Math.min(46, Math.max(10, c.L / v * (0.8 + Math.random() * 0.35))),
					size:22 + Math.random() * 12, grow:1.045, rise:0.05, drag:0.992, turb:1.1, heat:1, smoke:0.2 });
			}
			for(let i = 0; i < 2; i++){
				const ang = c.ang + (Math.random() - 0.5) * 0.5, v = 10 + Math.random() * 14;
				fpEmit(c.x, c.y, { kind:'ember', vx:Math.cos(ang) * v, vy:Math.sin(ang) * v - 1, life:40, size:6, grow:0.99, rise:-0.08, turb:1.5 });
			}
			// splash where the stream hits stone
			const ex = c.x + Math.cos(c.ang) * c.L, ey = c.y + Math.sin(c.ang) * c.L;
			if(c.L < 630){
				for(let i = 0; i < 4; i++) fpEmit(ex, ey, { vx:(Math.random() - 0.5) * 8, vy:-2 - Math.random() * 6, life:24, size:26 + Math.random() * 14, grow:1.02, rise:0.12, turb:1, smoke:0.3 });
				if(Math.random() < 0.5) fpEmit(ex, ey, { kind:'lava', vx:(Math.random() - 0.5) * 9, vy:-6 - Math.random() * 6, life:40, size:10, grow:0.99, rise:-0.35, turb:0.1 });
			}
		}
		// ground fire waves & hot eruption columns
		const ws = ig.waves || [];
		for(let i = 0; i < ws.length; i++){
			const w = ws[i];
			for(let k = 0; k < 4; k++) fpEmit(w.x - w.dir * Math.random() * 60, w.y - 6, { vx:w.dir * (1 + Math.random() * 2), vy:-(3 + Math.random() * (w.h * 0.09)), life:20 + Math.random() * 10, size:34 + Math.random() * 28, grow:0.99, rise:0.14, turb:0.9, smoke:0.2 });
		}
		for(let i = 0; i < ig.zones.length; i++){
			const z = ig.zones[i];
			if(z.kind === 'rect' && z.hot && z.life <= (z.hotFor || 9999)){
				fpColumn(z.x + z.w / 2, z.y + z.h, z.w, z.h, 8, Math.max(11, z.h / 20));
			}
			if(z.kind === 'circ' && z.hot && z.life <= (z.hotFor || 9999) && Math.random() < 0.6){
				const ang = Math.random() * 6.283;
				fpEmit(z.cx + Math.cos(ang) * z.r * Math.random(), z.cy, { vy:-4 - Math.random() * 5, vx:(Math.random() - 0.5) * 2, life:24, size:40, grow:0.99, rise:0.12, smoke:0.2 });
			}
		}
		// telegraphs: fissures glow and spit sparks
		const tl = ig.tels || [];
		for(let i = tl.length - 1; i >= 0; i--){
			const t = tl[i]; t.life--;
			const k = 1 - t.life / t.max;
			if(Math.random() < 0.15 + k * 0.7) fpEmit(t.x + Math.random() * t.w, t.y + t.h - 4, { kind:'ember', vx:(Math.random() - 0.5) * 1.4, vy:-1.5 - Math.random() * (2 + k * 4), life:24, size:5 + k * 4, grow:0.99, rise:-0.02, turb:1 });
			if(t.life <= 0) tl.splice(i, 1);
		}
		// lingering fire on lava pools and walls
		for(let i = 0; i < ig.pools.length; i++){
			const p = ig.pools[i];
			if(Math.random() < 0.5) fpColumn(p.x + Math.random() * p.w, p.y + 6, 36, 60, 1, 4.5);
		}
		for(let i = 0; i < ig.walls.length; i++){
			const w = ig.walls[i];
			if(Math.random() < 0.8) fpColumn(w.x + w.w / 2, w.y + w.h, w.w, w.h, 2, Math.max(5, w.h / 18));
		}
	}

	function updateIgnaroth(en){
		if(!en || en.type !== 'fireDragon' || en.dead) return false;
		if(en.isNecroSummon || en.necroFriendly) return false;
		if(!(typeof IS_SURVIVAL !== 'undefined' && IS_SURVIVAL || typeof IS_SANDBOX !== 'undefined' && IS_SANDBOX) && (typeof IS_DUNGEON === 'undefined' || !IS_DUNGEON || DUNGEON_TYPE !== 'fire')) return false;
		const room = igRoom(en);
		if(!room || room.kind !== 'boss') return false;

		if(!en._ig) igInit(en, room);
		const ig = en._ig;
		_curIg = ig;
		if(!ig.fx) ig.fx = [];
		if(global.IgnarothRig) global.IgnarothRig.step(en);
		fpUpdate();
		igAmbient(en, ig, room);
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
			ig.stance = 'ground'; ig.loco = 'walk';
			ig.vx = 0; ig.vy += 0.4;
			const it = 150 - ig.intro;
			if(it === 40) { igFX(ig, { kind:'ring', x:igMouth(en).x, y:igMouth(en).y, r:30, life:22, max:22 }); igShake(10, 40); igFlash(ig, 8); }
			if(it === 70 || it === 95) igFX(ig, { kind:'ring', x:igMouth(en).x, y:igMouth(en).y, r:30, life:22, max:22 });
			igApply(en, room, ig);
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
				if(false){
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
		ctx.save(); ctx.globalCompositeOperation = 'lighter';
		const img = fpSprite('hot'), f = fpSprite('fire');
		ctx.globalAlpha = 0.9; ctx.drawImage(f, x - r * 1.5, y - r * 1.5, r * 3, r * 3);
		ctx.globalAlpha = 1; ctx.drawImage(img, x - r * (0.9 + pulse * 0.1), y - r * (0.9 + pulse * 0.1), r * (1.8 + pulse * 0.2), r * (1.8 + pulse * 0.2));
		ctx.restore();
	}

	/* every Ignaroth shot is a ball of living fire: a white-hot core that sheds flame, sparks and smoke as it flies */
	function drawIgnarothProj(p){
		const x = p.x - camera.x, y = p.y - camera.y;
		const r = Math.max(p.width, p.height) * 0.55;
		const pulse = 0.5 + Math.sin((p.age || 0) * 0.38) * 0.5;
		const sp = Math.hypot(p.vx, p.vy) || 1;
		const style = p._igStyle || 'orb';
		const big = style === 'meteor' ? 2.4 : style === 'sun' ? 1.7 : 1;
		if(p._fpAge !== p.age){
			p._fpAge = p.age;
			const n = style === 'meteor' ? 5 : style === 'sun' ? 3 : style === 'breath' || style === 'gust' ? 1 : 2;
			for(let i = 0; i < n; i++){
				fpEmit(p.x + (Math.random() - 0.5) * r, p.y + (Math.random() - 0.5) * r, {
					vx:-p.vx * 0.22 + (Math.random() - 0.5) * 1.6, vy:-p.vy * 0.22 + (Math.random() - 0.5) * 1.6 - 0.4,
					life:16 + Math.random() * 14, size:r * (1.2 + Math.random() * 0.9) * (style === 'breath' ? 0.8 : 1), grow:1.0, rise:0.08, turb:0.9, smoke:0.3 });
			}
			if(Math.random() < 0.55) fpEmit(p.x, p.y, { kind:'ember', vx:-p.vx * 0.3 + (Math.random() - 0.5) * 3, vy:-p.vy * 0.3 + (Math.random() - 0.5) * 3 - 0.5, life:30, size:5 + Math.random() * 4, grow:0.985, rise:0.02, turb:1.3 });
		}
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		// speed-stretched molten core
		const ang = Math.atan2(p.vy, p.vx);
		ctx.translate(x, y); ctx.rotate(ang);
		const stretch = 1 + Math.min(1.4, sp * 0.1);
		const outer = fpSprite('fire'), core = fpSprite('hot');
		ctx.globalAlpha = 0.85; ctx.drawImage(outer, -r * 2.2 * stretch * big * 0.55, -r * 1.7 * big * 0.55, r * 4.4 * stretch * big * 0.55 * 1.0, r * 3.4 * big * 0.55);
		ctx.globalAlpha = 1;
		const cr = r * (0.9 + pulse * 0.12) * (style === 'breath' ? 0.8 : 1);
		ctx.drawImage(core, -cr * stretch, -cr, cr * 2 * stretch, cr * 2);
		if(style === 'meteor'){
			ctx.globalAlpha = 0.55; ctx.rotate(-ang);
			ctx.strokeStyle = 'rgba(255,190,80,0.9)'; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(0, 0, r * 1.3 + pulse * 6, 0, Math.PI * 2); ctx.stroke();
		}
		ctx.restore();
	}

	function drawIgnarothWorld(){
		if(!(typeof IS_SURVIVAL !== 'undefined' && IS_SURVIVAL || typeof IS_SANDBOX !== 'undefined' && IS_SANDBOX) && (typeof IS_DUNGEON === 'undefined' || !IS_DUNGEON || DUNGEON_TYPE !== 'fire')) return;
		if(typeof enemies === 'undefined') return;
		let en = null;
		for(let i = 0; i < enemies.length; i++){
			if(enemies[i] && enemies[i].type === 'fireDragon' && !enemies[i].dead && enemies[i]._ig){ en = enemies[i]; break; }
		}
		if(!en){ if(FP.length) FP.length = 0; return; }
		const ig = en._ig;
		const room = igRoom(en);
		const camx = camera.x, camy = camera.y;
		const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;

		// arena: the volcano glows hotter as the fight goes on
		if(room && room.authoredArena){
			const pulse = 0.5 + 0.5 * Math.sin(t * 2.2);
			const heat = ig.phase >= 3 ? 0.3 : ig.phase >= 2 ? 0.18 : 0.08;
			const gg = ctx.createLinearGradient(0, room.y + room.h - 330 - camy, 0, room.y + room.h - camy);
			gg.addColorStop(0, 'rgba(255,60,0,0)'); gg.addColorStop(1, 'rgba(255,70,10,' + (heat + pulse * 0.06) + ')');
			ctx.fillStyle = gg; ctx.fillRect(room.x - camx, room.y + room.h - 330 - camy, room.w, 330);
			const cracks = room.cracks || [];
			for(let i = 0; i < cracks.length; i++){
				const c = cracks[i];
				const hot = ig.phase >= 2;
				ctx.save(); ctx.globalCompositeOperation = hot ? 'lighter' : 'source-over';
				ctx.fillStyle = hot ? 'rgba(255,110,30,' + (0.5 + pulse * 0.3) + ')' : 'rgba(80,20,8,0.8)';
				ctx.fillRect(c.x - camx, c.y - camy, c.w, 6);
				if(hot){ ctx.fillStyle = 'rgba(255,120,30,0.14)'; ctx.fillRect(c.x - camx - 10, c.y - camy - 8, c.w + 20, 22); }
				ctx.restore();
			}
		}

		// lava pools: glowing surface
		for(let i = 0; i < ig.pools.length; i++){
			const p = ig.pools[i];
			if(typeof DungeonEnv !== 'undefined' && DungeonEnv.drawLavaPool) DungeonEnv.drawLavaPool(ctx, p.x, p.y, p.w, p.h, p.x);
			else { ctx.fillStyle = 'rgba(255,70,0,0.75)'; ctx.fillRect(p.x - camx, p.y - camy, p.w, p.h); }
		}

		// fire walls: base glow (the flames themselves are particles)
		for(let i = 0; i < ig.walls.length; i++){
			const w = ig.walls[i];
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			const g = ctx.createLinearGradient(0, w.y - camy, 0, w.y + w.h - camy);
			g.addColorStop(0, 'rgba(255,120,20,0)'); g.addColorStop(1, 'rgba(255,90,10,0.38)');
			ctx.fillStyle = g; ctx.fillRect(w.x - camx - 6, w.y - camy, w.w + 12, w.h);
			ctx.restore();
		}

		// telegraphs: glowing fissures where the fire will break through
		const tels = ig.tels || [];
		for(let i = 0; i < tels.length; i++){
			const q = tels[i], k = 1 - q.life / q.max, fy = q.y + q.h - camy;
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			const pu = 0.6 + 0.4 * Math.sin(t * (10 + k * 22));
			ctx.strokeStyle = 'rgba(255,' + Math.round(150 + k * 90) + ',60,' + (0.35 + 0.65 * k) * pu + ')';
			ctx.lineWidth = 3 + k * 4; ctx.lineJoin = 'round';
			ctx.beginPath();
			const segs = Math.max(4, Math.round(q.w / 26));
			for(let j = 0; j <= segs; j++){
				const px = q.x - camx + q.w * j / segs, py = fy - 2 + Math.sin(j * 2.3 + q.seed) * 5 * (0.4 + k);
				if(j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
			}
			ctx.stroke();
			const cg = ctx.createLinearGradient(0, fy - Math.min(q.h, 220) * k, 0, fy);
			cg.addColorStop(0, 'rgba(255,90,10,0)'); cg.addColorStop(1, 'rgba(255,100,20,' + (0.10 + 0.25 * k) + ')');
			ctx.fillStyle = cg; ctx.fillRect(q.x - camx, fy - Math.min(q.h, 220) * k, q.w, Math.min(q.h, 220) * k);
			ctx.restore();
		}

		// hot zones: bright core glow under the particle column
		for(let i = 0; i < ig.zones.length; i++){
			const z = ig.zones[i];
			const warn = !z.hot || z.life > (z.hotFor || 0);
			ctx.save();
			if(z.kind === 'circ'){
				ctx.globalCompositeOperation = 'lighter';
				const rg = ctx.createRadialGradient(z.cx - camx, z.cy - camy, z.r * 0.2, z.cx - camx, z.cy - camy, z.r);
				rg.addColorStop(0, warn ? 'rgba(255,170,40,0.10)' : 'rgba(255,120,20,0.32)'); rg.addColorStop(1, 'rgba(255,60,0,0)');
				ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(z.cx - camx, z.cy - camy, z.r, z.r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
			} else if(!warn){
				ctx.globalCompositeOperation = 'lighter';
				const k = Math.min(1, z.life / Math.max(1, z.hotFor || 20));
				const cg = ctx.createLinearGradient(0, z.y - camy, 0, z.y + z.h - camy);
				cg.addColorStop(0, 'rgba(255,120,20,0)'); cg.addColorStop(1, 'rgba(255,150,40,' + 0.5 * k + ')');
				ctx.fillStyle = cg; ctx.fillRect(z.x - camx + z.w * 0.15, z.y - camy, z.w * 0.7, z.h);
			}
			ctx.restore();
		}

		// special FX
		const fxs = ig.fx || [];
		for(let i = 0; i < fxs.length; i++){
			const f = fxs[i];
			const a = f.life / (f.max || 1);
			ctx.save();
			if(f.kind === 'glow'){
				drawFireBall(f.x - camx, f.y - camy, f.r * a * 0.9, '#ff3300', '#ffe680', 1 - a);
			} else if(f.kind === 'ring'){
				const rr = 40 + (1 - a) * 260;
				ctx.globalCompositeOperation = 'lighter';
				ctx.strokeStyle = 'rgba(255,235,170,' + (0.7 * a) + ')'; ctx.lineWidth = 6 * a + 1;
				ctx.beginPath(); ctx.ellipse(f.x - camx, f.y - camy, rr, rr * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
				ctx.strokeStyle = 'rgba(255,80,10,' + (0.5 * a) + ')'; ctx.lineWidth = 16 * a + 2;
				ctx.beginPath(); ctx.ellipse(f.x - camx, f.y - camy, rr * 0.93, rr * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
			} else if(f.kind === 'arc'){
				ctx.globalCompositeOperation = 'lighter';
				ctx.strokeStyle = 'rgba(255,170,50,' + (0.6 * a) + ')'; ctx.lineWidth = 10 * a + 2; ctx.lineCap = 'round';
				ctx.beginPath(); ctx.arc(f.x - camx, f.y - camy, f.r, f.dir > 0 ? -0.5 : Math.PI - 0.5, f.dir > 0 ? 1.3 : Math.PI + 1.3); ctx.stroke();
				ctx.strokeStyle = 'rgba(255,245,200,' + (0.7 * a) + ')'; ctx.lineWidth = 3;
				ctx.beginPath(); ctx.arc(f.x - camx, f.y - camy, f.r, f.dir > 0 ? -0.5 : Math.PI - 0.5, f.dir > 0 ? 1.3 : Math.PI + 1.3); ctx.stroke();
			} else if(f.kind === 'streak'){
				ctx.globalCompositeOperation = 'lighter';
				const g = ctx.createLinearGradient(f.x - camx, f.y - camy, f.x - camx - (f.vx || 0) * 9, f.y - camy - (f.vy || 0) * 9);
				g.addColorStop(0, 'rgba(255,200,80,' + (0.7 * a) + ')'); g.addColorStop(1, 'rgba(255,60,0,0)');
				ctx.strokeStyle = g; ctx.lineWidth = 14 * a + 2; ctx.lineCap = 'round';
				ctx.beginPath(); ctx.moveTo(f.x - camx, f.y - camy); ctx.lineTo(f.x - camx - (f.vx || 0) * 9, f.y - camy - (f.vy || 0) * 9); ctx.stroke();
			} else if(f.kind === 'crater'){
				ctx.fillStyle = 'rgba(30,6,0,' + (0.55 * a) + ')';
				ctx.beginPath(); ctx.ellipse(f.x - camx, f.y - camy, f.r, f.r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
				ctx.globalCompositeOperation = 'lighter';
				ctx.fillStyle = 'rgba(255,90,10,' + (0.45 * a) + ')';
				ctx.beginPath(); ctx.ellipse(f.x - camx, f.y - camy, f.r * 0.72, f.r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
				ctx.strokeStyle = 'rgba(255,190,70,' + (0.7 * a) + ')'; ctx.lineWidth = 2;
				for(let k = 0; k < 9; k++){ const aa = k * 0.7 + 0.2; ctx.beginPath(); ctx.moveTo(f.x - camx, f.y - camy); ctx.lineTo(f.x - camx + Math.cos(aa) * f.r * 1.05, f.y - camy + Math.sin(aa) * f.r * 0.32); ctx.stroke(); }
			}
			ctx.restore();
		}

		// barrage: a sun swells under each wing (a swirling knot of fire)
		if(ig.atk && ig.atk.name === 'barrage' && ig.suns){
			for(let i = 0; i < ig.suns.length; i++){
				const s = ig.suns[i];
				if(s.gone || ig.atk.t >= s.delay) continue;
				const grow = Math.min(1, ig.atk.t / Math.max(12, s.delay - 8));
				const sx = (s.x || en.x), sy = (s.y || en.y);
				drawFireBall(sx - camx, sy - camy, s.sz * 0.46 * grow, '#ff3300', '#ffe680', 0.5 + 0.5 * Math.sin(t * 18 + i));
				if(Math.random() < 0.8) { const aa = Math.random() * 6.283, d = s.sz * 0.9; fpEmit(sx + Math.cos(aa) * d, sy + Math.sin(aa) * d, { vx:-Math.sin(aa) * 3 - Math.cos(aa) * 1.5, vy:Math.cos(aa) * 3 - Math.sin(aa) * 1.5, life:14, size:14, grow:0.96, rise:0, turb:0.2 }); }
			}
		}
		// dive: where he is going to land
		if(ig.atk && ig.atk.name === 'dive' && ig.target && ig.atk.t >= 50 && ig.atk.t < 138){
			const pulse = 0.5 + 0.5 * Math.sin(t * 14), k = (ig.atk.t - 50) / 88;
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			ctx.strokeStyle = 'rgba(255,' + Math.round(210 - k * 120) + ',40,' + (0.4 + pulse * 0.5) + ')'; ctx.lineWidth = 3 + k * 4;
			ctx.beginPath(); ctx.ellipse(ig.target.x - camx, ig.target.y - camy, 190 * (1 - k * 0.15), 190 * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
			ctx.fillStyle = 'rgba(255,80,10,' + (0.05 + k * 0.2) + ')';
			ctx.beginPath(); ctx.ellipse(ig.target.x - camx, ig.target.y - camy, 190 * (1 - k * 0.15), 190 * 0.32, 0, 0, Math.PI * 2); ctx.fill();
			ctx.restore();
		}
		if(ig.atk && ig.atk.name === 'meteor' && ig.target && !ig.atk.boom){
			const pulse = 0.5 + 0.5 * Math.sin(t * 10);
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			ctx.strokeStyle = 'rgba(255,90,20,' + (0.5 + pulse * 0.4) + ')'; ctx.lineWidth = 5;
			ctx.beginPath(); ctx.ellipse(ig.target.x - camx, ig.target.y - camy, ig.target.r, ig.target.r * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
			ctx.fillStyle = 'rgba(255,50,0,0.14)'; ctx.fill();
			ctx.restore();
		}
		if(ig.atk && ig.atk.name === 'tail' && ig.atk.t < 44){
			const tl = igTail(en), k = ig.atk.t / 44;
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			ctx.strokeStyle = 'rgba(255,170,50,' + (0.3 + 0.5 * k) + ')'; ctx.lineWidth = 3;
			ctx.beginPath(); ctx.arc(tl.x - camx, tl.y - camy, 60, 0, Math.PI * 2); ctx.stroke();
			ctx.restore();
			if(ig.atk.t % 2 === 0) fpEmit(tl.x + (Math.random() - 0.5) * 50, tl.y + (Math.random() - 0.5) * 30, { kind:'ember', vx:(Math.random() - 0.5) * 4, vy:-1 - Math.random() * 2, life:24, size:6, turb:1 });
		}

		// heat glow around the dragon while it attacks
		if(ig.atk || ig.phase >= 3){
			const cx0 = en.x + en.w / 2 - camx, cy0 = en.y + en.h / 2 - camy;
			const hg = ctx.createRadialGradient(cx0, cy0, 40, cx0, cy0, 340);
			hg.addColorStop(0, 'rgba(255,90,10,' + ((ig.phase >= 3 ? 0.26 : 0.16) + 0.07 * Math.sin(t * 9)) + ')');
			hg.addColorStop(1, 'rgba(255,60,0,0)');
			ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = hg;
			ctx.fillRect(cx0 - 340, cy0 - 340, 680, 680); ctx.restore();
		}
		// breath: charge indicator, and a soft glow that the particle torrent sits in
		if(ig.cone){
			const c = ig.cone, ox = c.x - camx, oy = c.y - camy;
			ctx.save();
			ctx.translate(ox, oy); ctx.rotate(c.ang);
			const wEnd = 26 + c.L * 0.15;
			ctx.globalCompositeOperation = 'lighter';
			if(!c.fire){
				ctx.strokeStyle = 'rgba(255,190,60,' + (0.12 + 0.4 * c.k) + ')'; ctx.setLineDash([14, 10]); ctx.lineWidth = 2;
				ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(c.L, -wEnd); ctx.lineTo(c.L, wEnd); ctx.lineTo(0, 6); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
				ctx.fillStyle = 'rgba(255,90,10,' + (0.03 + 0.07 * c.k) + ')';
				ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(c.L, -wEnd); ctx.lineTo(c.L, wEnd); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
				ctx.setTransform(1, 0, 0, 1, 0, 0);
				drawFireBall(ox, oy, 14 + c.k * 34, '#ff3300', '#ffe680', 0.5 + 0.5 * Math.sin(t * 22));
			} else {
				const g = ctx.createLinearGradient(0, 0, c.L, 0);
				g.addColorStop(0, 'rgba(255,200,90,0.28)'); g.addColorStop(1, 'rgba(255,60,0,0)');
				ctx.fillStyle = g;
				ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(c.L, -wEnd * 0.9); ctx.lineTo(c.L, wEnd * 0.9); ctx.lineTo(0, 10); ctx.closePath(); ctx.fill();
				ctx.setTransform(1, 0, 0, 1, 0, 0);
				drawFireBall(ox, oy, 38, '#ff3300', '#ffe680', 0.5 + 0.5 * Math.sin(t * 30));
			}
			ctx.restore();
		}
		// the fire itself
		fpDraw(camx, camy);
		// ambient embers drifting through the arena once the volcano is awake
		if(ig.phase >= 2 && room && Math.random() < 0.7){
			fpEmit(room.x + Math.random() * room.w, room.y + room.h - 30, { kind:'ember', vx:(Math.random() - 0.3) * 1.2, vy:-1 - Math.random() * 2.4, life:70 + Math.random() * 60, size:5 + Math.random() * 4, grow:0.995, rise:0.01, turb:1.4 });
		}
		if(ig.flash > 0){
			ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.fillStyle = 'rgba(255,200,120,' + Math.min(0.5, ig.flash * 0.035) + ')';
			ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.restore();
		}
		if(ig.vulnerable > 0){
			const pu = 0.5 + 0.5 * Math.sin(t * 8);
			ctx.save(); ctx.globalCompositeOperation = 'lighter';
			ctx.strokeStyle = 'rgba(255,230,120,' + (0.35 + pu * 0.4) + ')'; ctx.lineWidth = 3;
			ctx.strokeRect(en.x - camx - 8, en.y - camy - 8, en.w + 16, en.h + 16);
			ctx.restore();
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
		if(global.IgnarothRig) return global.IgnarothRig.draw(en);
		return false;
	}

	global.drawIgnarothSprite = drawIgnarothSprite;
})(typeof window !== 'undefined' ? window : globalThis);
