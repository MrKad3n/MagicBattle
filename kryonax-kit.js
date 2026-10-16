/* =============================================================
   Kryonax, The Frozen Colossus — Ice Dungeon final boss + summon.

   A living glacier. Grounded, heavy, deliberate.
   The arena enhances him. It does not define him.
   Every major attack has a complete standalone combat function.
   ============================================================= */
(function(global){
	const ICE = ['#cceeff', '#88d6ff', '#ffffff', '#b8e4ff'];
	const T = (typeof TILE === 'number') ? TILE : 40;
	const PHASE2 = 0.70, PHASE3 = 0.35;

	function kxType(en){ return (en && (en.necroType || en.type)) || ''; }
	function kxFriendly(en){ return !!(en && (en.isNecroSummon || en.necroFriendly)); }
	function kxIs(en){ return kxType(en) === 'frostColossus'; }
	function kxPx(){ return player.x + player.w / 2; }
	function kxPy(){ return player.y + player.h / 2; }

	function kxRoom(en){
		const rooms = (typeof dungeon !== 'undefined' && dungeon && dungeon.rooms) || [];
		if(en.roomId != null && rooms[en.roomId]) return rooms[en.roomId];
		const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
		for(let i = 0; i < rooms.length; i++){
			const r = rooms[i];
			if(cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) return r;
		}
		return null;
	}
	function kxTileSolid(x, y){
		if(typeof tileMap === 'undefined') return false;
		const c = Math.floor(x / T), r = Math.floor(y / T);
		if(r < 0 || c < 0 || r >= MAP_ROWS || c >= MAP_COLS) return true;
		return !tileMap[r][c];
	}
	function kxBoxSolid(x, y, w, h){
		return kxTileSolid(x + 4, y + 4) || kxTileSolid(x + w - 4, y + 4) ||
			kxTileSolid(x + 4, y + h - 4) || kxTileSolid(x + w - 4, y + h - 4) ||
			kxTileSolid(x + w * 0.5, y + h - 2);
	}
	function kxHitbox(en){
		return { x: en.x + 40, y: en.y + 28, w: Math.max(40, en.w - 80), h: Math.max(40, en.h - 32) };
	}
	function kxPlatFloor(en, room, fx){
		const plats = (typeof dungeon !== 'undefined' && dungeon && dungeon.platforms) || [];
		let core = null, best = null, bestY = 1e9;
		const feet = en.y + en.h;
		for(let i = 0; i < plats.length; i++){
			const p = plats[i];
			if(!p || p._gone) continue;
			if(room && p.roomId !== room.id) continue;
			if(fx < p.x - 8 || fx > p.x + p.w + 8) continue;
			if(p.y < feet - 90 || p.y > feet + 520) continue;
			if(p.arenaSection === 'core' || p.central){ core = p; continue; }
			if(p.y < bestY){ bestY = p.y; best = p; }
		}
		const plat = core || best;
		return plat ? plat.y : null;
	}
	function kxScanFloor(fx, fromY, limit){
		if(typeof tileMap === 'undefined') return fromY + (limit || 700);
		const c = Math.max(0, Math.min(MAP_COLS - 1, Math.floor(fx / T)));
		const start = Math.max(0, Math.floor(fromY / T));
		const stop = Math.min(MAP_ROWS - 1, start + Math.ceil((limit || 900) / T));
		for(let r = start; r <= stop; r++){
			if(!tileMap[r][c]) return r * T;
		}
		return stop * T;
	}
	function kxGroundY(en, room){
		const fx = en.x + en.w / 2;
		const fromY = en.y + en.h - 6;
		const platY = kxPlatFloor(en, room, fx);
		if(platY != null) return platY - en.h;
		const scan = kxScanFloor(fx, fromY, 820);
		if(room){
			const roomFloor = room.y + room.h - 12 - en.h;
			const gy = scan - en.h;
			if(gy > roomFloor + 40) return roomFloor;
			return Math.min(gy, roomFloor);
		}
		return scan - en.h;
	}
	function kxBanner(t){
		if(typeof DungeonEnv !== 'undefined' && DungeonEnv.showBanner) DungeonEnv.showBanner(t);
		else if(typeof showBanner === 'function') showBanner(t);
		if(typeof notify === 'function') notify(t);
	}
	function kxShake(a, b){ if(typeof shakeScreen === 'function') shakeScreen(a, b); }
	function kxPart(x, y, n, spread){
		if(typeof particles === 'undefined') return;
		spread = spread || 48;
		for(let i = 0; i < n; i++){
			particles.push({
				x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * (spread * 0.55),
				vx: (Math.random() - 0.5) * 6, vy: -1.6 - Math.random() * 4.2,
				life: 20 + Math.random() * 26, color: ICE[i % ICE.length],
			});
		}
	}
	function kxTel(x, y, w, h, frames, label, type){
		if(typeof spawnTelegraph === 'function') spawnTelegraph(x, y, w, h, frames, 'rgba(170,235,255,0.62)', type || 'rect', label || '');
	}
	function kxDiff(){ return (typeof DIFF_DMG_MULT === 'number') ? DIFF_DMG_MULT : 1; }
	function kxBossDmg(n){ return Math.round(n * kxDiff()); }

	function kxTgt(en, kx){
		if(kx.friendly){
			const t = kx.target;
			if(!t || t.dead || t.hp <= 0) return null;
			return { x:t.x, y:t.y, w:t.w || 32, h:t.h || 32, cx:t.x + (t.w || 32) / 2, cy:t.y + (t.h || 32) / 2, en:t };
		}
		return { x:player.x, y:player.y, w:player.w, h:player.h, cx:kxPx(), cy:kxPy(), en:player };
	}
	function kxDist(en, tgt){
		if(!tgt) return 9999;
		return Math.hypot(tgt.cx - (en.x + en.w / 2), tgt.cy - (en.y + en.h / 2));
	}
	function kxInRect(tgt, x, y, w, h){
		if(!tgt) return false;
		return tgt.x + tgt.w > x && tgt.x < x + w && tgt.y + tgt.h > y && tgt.y < y + h;
	}
	function kxInCirc(tgt, cx, cy, r){
		if(!tgt) return false;
		const dx = tgt.cx - cx;
		const dy = (tgt.cy - cy) * 0.32;
		return Math.hypot(dx, dy) < r;
	}
	function kxSz(n){ return Math.round(n * 1.8); }
	function kxAimX(en, tgt, reach){
		const cx = en.x + en.w / 2;
		if(!tgt) return cx + (en.facing || 1) * Math.min(420, reach || 420);
		const raw = tgt.cx - cx;
		const cap = reach || 860;
		return cx + Math.max(-cap, Math.min(cap, raw));
	}

	function kxKnock(tgt, cx, force){
		if(!tgt || !tgt.en) return;
		const e = tgt.en;
		const dir = (tgt.cx >= cx) ? 1 : -1;
		if(e === player){
			player.vx = (player.vx || 0) + dir * force;
			return;
		}
		e._kbVx = dir * force;
		e._kbVy = -1.2;
		e._kbTimer = Math.max(e._kbTimer || 0, 14);
		e.stunTimer = Math.max(e.stunTimer || 0, 8);
	}
	function kxFrost(tgt, frames){
		if(!tgt || !tgt.en) return;
		const e = tgt.en;
		if(e === player){
			player.slowTimer = Math.max(player.slowTimer || 0, frames);
			if(player._iceDrag != null) player._iceDrag = Math.max(player._iceDrag || 0, 0.42);
			return;
		}
		e.slowTimer = Math.max(e.slowTimer || 0, frames);
	}
	function kxVictims(en){
		if(kxFriendly(en)){
			const out = [];
			const pool = (typeof enemies !== 'undefined' ? enemies : []).concat(typeof dummies !== 'undefined' ? dummies : []);
			for(let i = 0; i < pool.length; i++){
				const t = pool[i];
				if(!t || t.dead || t.hp <= 0) continue;
				out.push({ x:t.x, y:t.y, w:t.w || 32, h:t.h || 32, cx:t.x + (t.w || 32) / 2, cy:t.y + (t.h || 32) / 2, en:t });
			}
			return out;
		}
		return [{ x:player.x, y:player.y, w:player.w, h:player.h, cx:kxPx(), cy:kxPy(), en:player }];
	}
	function kxOnce(a, tgt){
		if(!a || !tgt || !tgt.en) return true;
		if(!a.hit) a.hit = [];
		if(a.hit.indexOf(tgt.en) >= 0) return false;
		a.hit.push(tgt.en);
		return true;
	}
	function kxHurtOne(en, tgt, dmg, extra){
		if(!tgt || !tgt.en) return false;
		extra = extra || {};
		if(kxFriendly(en)){
			if(typeof necroScaleKitDmg === 'function') dmg = necroScaleKitDmg(en, dmg);
			const t = tgt.en;
			t.hp -= dmg; t.flash = 8;
			if(typeof dmgNumbers !== 'undefined') dmgNumbers.push({ x:t.x + t.w / 2, y:t.y - 10, text:'' + Math.round(dmg), age:0, color:'#88ddff' });
			if(extra.kb) kxKnock(tgt, extra.cx != null ? extra.cx : en.x + en.w / 2, extra.kb);
			if(extra.slow) kxFrost(tgt, extra.slow);
			return true;
		}
		if(player.iFrames > 0) return false;
		const fx = ['freeze'];
		if(extra.launch) fx.push('horizontalLaunch');
		damagePlayer(kxBossDmg(dmg), fx);
		if(extra.kb) kxKnock(tgt, extra.cx != null ? extra.cx : en.x + en.w / 2, extra.kb);
		if(extra.slow) kxFrost(tgt, extra.slow);
		return true;
	}
	function kxAoE(en, cx, cy, r, dmg, extra){
		extra = extra || {};
		extra.cx = cx;
		let n = 0;
		const list = kxVictims(en);
		for(let i = 0; i < list.length; i++){
			if(kxInCirc(list[i], cx, cy, r)){
				if(kxHurtOne(en, list[i], dmg, extra)) n++;
			}
		}
		return n;
	}
	function kxBoxDmg(en, x, y, w, h, dmg, extra){
		extra = extra || {};
		let n = 0;
		const list = kxVictims(en);
		for(let i = 0; i < list.length; i++){
			if(kxInRect(list[i], x, y, w, h)){
				if(kxHurtOne(en, list[i], dmg, extra)) n++;
			}
		}
		return n;
	}

	function kxProj(en, x, y, vx, vy, opts){
		if(typeof spawnEnemyProj !== 'function') return null;
		opts = opts || {};
		const p = spawnEnemyProj(x, y, vx, vy, {
			color: opts.color || '#7ec8ff',
			color2: opts.color2 || '#e8f7ff',
			power: opts.power || 36,
			width: opts.w || 28, height: opts.h || 28,
			shape: opts.shape || 'circle',
			effects: opts.effects || ['freeze'],
			trail: opts.trail != null ? opts.trail : 'ice',
			maxAge: opts.age || 140,
			gravity: opts.grav || 0,
			noWallCollide: !!opts.ghost,
			aoe: !!opts.aoe, aoeRadius: opts.aoeR || 0, aoeMax: opts.aoeMax || 28,
			linger: !!opts.linger, lingerMax: opts.lingerMax || 0, lingerDmgInterval: opts.lingerIv || 24,
		});
		if(p){
			p._kxStyle = opts.style || 'chunk';
			if(kxFriendly(en)){
				if(typeof markNecroFriendlyProj === 'function') markNecroFriendlyProj(p, en);
				else p.necroFriendly = true;
			}
		}
		return p;
	}

	function kxImprint(en, kx, room){
		const w = Math.min(220, 110 + en.w * 0.22);
		const h = 22;
		const x = en.x + en.w / 2 - w / 2;
		const y = en.y + en.h - 10;
		kx.imprints.push({ x:x, y:y, w:w, h:h, life:200, max:200, tick:0 });
		kxPart(x + w / 2, y, 5, 36);
		if(room && room._kxBasin){
			kx.fx.push({ kind:'imprint', x:x + w / 2, y:y, r:w * 0.55, life:36, max:36 });
		}
	}
	function kxTickImprints(en, kx){
		const list = kxVictims(en);
		for(let i = kx.imprints.length - 1; i >= 0; i--){
			const z = kx.imprints[i];
			z.life--; z.tick++;
			for(let v = 0; v < list.length; v++){
				if(!kxInRect(list[v], z.x, z.y - 8, z.w, z.h + 14)) continue;
				kxFrost(list[v], 18);
				if(z.tick % 45 === 0) kxHurtOne(en, list[v], kxFriendly(en) ? 6 : 3, {});
			}
			if(z.life <= 0) kx.imprints.splice(i, 1);
		}
	}
	function kxPad(kx, x, y, w, h, life, dmg, slow){
		kx.zones.push({ kind:'rect', x:x, y:y, w:w, h:h, life:life, dmg:dmg, slow:slow, tick:18 });
	}
	function kxLaunchMeteor(en, kx, sx, sy, ax, ay, dmgM){
		const dx = ax - sx, dy = ay - sy, d = Math.max(40, Math.hypot(dx, dy));
		const spd = kx.friendly ? 16.5 : 14.2;
		kx.meteors.push({
			x:sx, y:sy, vx:dx / d * spd, vy:dy / d * spd,
			tx:ax, ty:ay,
			r:kxSz(118),
			life: kx.friendly ? 240 : 360,
			max: kx.friendly ? 240 : 360,
			dmg: Math.round(48 * dmgM),
			linger: Math.round(8 * dmgM),
			rot: 0,
			trail: [],
		});
	}
	function kxMeteorBurst(en, kx, m){
		const br = kxSz(200);
		kxAoE(en, m.x, m.y, br, m.dmg, { kb:12, launch:true, slow:42, cx:m.x });
		kxPad(kx, m.x - kxSz(150), m.y + 16, kxSz(300), 34, 120, m.linger, 36);
		kx.fx.push({ kind:'burst', x:m.x, y:m.y, r:kxSz(110), life:32, max:32 });
		kx.fx.push({ kind:'ring', x:m.x, y:m.y, r:40, life:36, max:36 });
		kx.fx.push({ kind:'crack', x:m.x, y:m.y + 18, r:br, life:30, max:30 });
		for(let i = 0; i < 10; i++){
			const ang = (i / 10) * Math.PI * 2 + 0.2;
			kx.fx.push({ kind:'shardFly', x:m.x, y:m.y, vx:Math.cos(ang) * 9, vy:Math.sin(ang) * 7 - 2, life:26, max:26 });
		}
		kxShake(16, 20);
		kxPart(m.x, m.y, 32, 180);
	}
	function kxTickMeteors(en, kx){
		if(!kx.meteors) kx.meteors = [];
		const list = kxVictims(en);
		for(let i = kx.meteors.length - 1; i >= 0; i--){
			const m = kx.meteors[i];
			let tgt = null;
			if(kx.friendly && kx.target && !kx.target.dead){
				tgt = { cx:kx.target.x + (kx.target.w || 32) / 2, cy:kx.target.y + (kx.target.h || 32) / 2 };
			} else if(!kx.friendly && typeof player !== 'undefined'){
				tgt = { cx:player.x + player.w / 2, cy:player.y + player.h / 2 };
			} else if(list.length){
				tgt = list[0];
			}
			if(tgt && m.life > 28){
				const dx = tgt.cx - m.x, dy = tgt.cy - m.y, dist = Math.max(1, Math.hypot(dx, dy));
				const pull = kx.friendly ? 0.085 : 0.048;
				m.vx += (dx / dist) * pull * 16;
				m.vy += (dy / dist) * pull * 12;
				const s = Math.hypot(m.vx, m.vy), cap = kx.friendly ? 17.5 : 15.4;
				if(s > cap){ m.vx *= cap / s; m.vy *= cap / s; }
			}
			m.x += m.vx;
			m.y += m.vy;
			m.rot += 0.09;
			m.life--;
			m.trail.push({ x:m.x, y:m.y, life:14 });
			if(m.trail.length > 12) m.trail.shift();
			for(let t = m.trail.length - 1; t >= 0; t--) if(--m.trail[t].life <= 0) m.trail.splice(t, 1);
			let boom = m.life <= 0;
			for(let v = 0; v < list.length; v++){
				if(Math.hypot(list[v].cx - m.x, list[v].cy - m.y) < m.r * 0.78) boom = true;
			}
			if(boom){
				kxMeteorBurst(en, kx, m);
				kx.meteors.splice(i, 1);
			}
		}
	}
	function kxTickZones(en, kx){
		const list = kxVictims(en);
		for(let i = kx.zones.length - 1; i >= 0; i--){
			const z = kx.zones[i];
			z.life--;
			for(let v = 0; v < list.length; v++){
				const hit = z.kind === 'circ' ? kxInCirc(list[v], z.cx, z.cy, z.r) : kxInRect(list[v], z.x, z.y, z.w, z.h);
				if(!hit) continue;
				if(z.dmg && z.life % (z.tick || 18) === 0) kxHurtOne(en, list[v], z.dmg, { slow:z.slow || 0, cx:z.cx || (z.x + z.w / 2) });
				else if(z.slow) kxFrost(list[v], z.slow);
			}
			if(z.life <= 0) kx.zones.splice(i, 1);
		}
		for(let i = kx.fx.length - 1; i >= 0; i--){
			const f = kx.fx[i];
			if(f.kind === 'shardFly'){
				f.x += f.vx || 0; f.y += f.vy || 0; f.vy = (f.vy || 0) + 0.22;
			} else if(f.kind === 'fall'){
				f.vy = (f.vy || 0) + 0.55; f.y += f.vy;
			}
			if(--f.life <= 0) kx.fx.splice(i, 1);
		}
		if(kx.reactFX){
			for(let i = kx.reactFX.length - 1; i >= 0; i--){
				if(--kx.reactFX[i].t <= 0) kx.reactFX.splice(i, 1);
			}
		}
	}

	function kxReact(en, kx, room, kind, wx){
		if(!room || !room._kxBasin) return;
		const decs = (typeof dungeon !== 'undefined' && dungeon && dungeon.decorations) || [];
		for(let i = 0; i < decs.length; i++){
			const d = decs[i];
			if(d.roomId !== room.id || d._kxReact !== kind) continue;
			const dx = (d.x + (d.w || 80) / 2) - wx;
			if(kind !== 'heart' && kind !== 'roar' && Math.abs(dx) > 560) continue;
			d._kxCracked = (d._kxCracked || 0) + 1;
			kx.reactFX.push({ kind:kind, x:d.x, y:d.y, w:d.w || 80, h:d.h || 80, t:80, max:80 });
			kxPart(d.x + (d.w || 80) / 2, d.y + 20, 8, 70);
		}
		if(kind === 'heart') room._kxTransformed = true;
		if(kind === 'roar'){
			for(let k = 0; k < 5; k++){
				kx.fx.push({
					kind:'fall',
					x: room.x + 200 + Math.random() * (room.w - 400),
					y: room.y + 40,
					vy: 0,
					life: 50, max: 50,
				});
			}
		}
	}

	function kxFace(en, tgt){
		if(!tgt) return en.facing || 1;
		const dx = tgt.cx - (en.x + en.w / 2);
		if(Math.abs(dx) > 10) en.facing = dx > 0 ? 1 : -1;
		return en.facing || 1;
	}
	function kxResolve(en, kx, axis){
		const b = kxHitbox(en);
		if(!kxBoxSolid(b.x, b.y, b.w, b.h)) return;
		const vel = axis === 'x' ? kx.vx : kx.vy;
		const step = vel >= 0 ? -1 : 1;
		const max = Math.min(40, Math.ceil(Math.abs(vel)) + 6);
		for(let i = 0; i < max; i++){
			if(axis === 'x') en.x += step;
			else en.y += step;
			const n = kxHitbox(en);
			if(!kxBoxSolid(n.x, n.y, n.w, n.h)){
				if(axis === 'x') kx.vx *= -0.12;
				else { if(kx.vy > 0) kx.onGround = true; kx.vy = 0; }
				return;
			}
		}
		if(axis === 'x') kx.vx = 0;
		else { kx.vy = 0; kx.onGround = vel > 0; }
	}
	function kxApply(en, room, kx){
		kx.onGround = false;
		en.x += kx.vx;
		kxResolve(en, kx, 'x');
		en.y += kx.vy;
		kxResolve(en, kx, 'y');
		const feet = kxHitbox(en);
		if(kxBoxSolid(feet.x + 6, feet.y + feet.h + 2, feet.w - 12, 6)){
			kx.onGround = true;
			if(kx.vy > 0) kx.vy = 0;
		}
		if(room){
			if(en.x < room.x + 20){ en.x = room.x + 20; kx.vx = Math.max(0, kx.vx); }
			if(en.x + en.w > room.x + room.w - 20){ en.x = room.x + room.w - 20 - en.w; kx.vx = Math.min(0, kx.vx); }
			if(en.y < room.y + 16){ en.y = room.y + 16; kx.vy = Math.max(0, kx.vy); }
			if(en.y + en.h > room.y + room.h - 8){ en.y = room.y + room.h - 8 - en.h; kx.vy = Math.min(0, kx.vy); kx.onGround = true; }
		}
		if(kx.onGround){
			const gy = kxGroundY(en, room);
			if(en.y > gy - 6) en.y = gy;
		}
	}

	function kxPickTarget(en, kx){
		if(!kx.friendly){ kx.target = player; return; }
		const pool = (typeof enemies !== 'undefined' ? enemies : []).concat(typeof dummies !== 'undefined' ? dummies : []);
		let best = null, bestS = -1e9;
		const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
		for(let i = 0; i < pool.length; i++){
			const t = pool[i];
			if(!t || t.dead || t.hp <= 0) continue;
			const cx = t.x + (t.w || 32) / 2, cy = t.y + (t.h || 32) / 2;
			const d = Math.hypot(cx - (en.x + en.w / 2), cy - (en.y + en.h / 2));
			if(d > (en.detectRange || 900) + 80) continue;
			let s = 200 - d * 0.12;
			if(t.typeDef && t.typeDef.isBoss) s += 900;
			if(t.isMiniBoss || (t.typeDef && t.typeDef.isMiniBoss)) s += 480;
			if(t.type === 'frostboundKnight') s += 200;
			const pd = Math.hypot(cx - pcx, cy - pcy);
			if(pd < 220) s += 240;
			let cluster = 0;
			for(let j = 0; j < pool.length; j++){
				const o = pool[j];
				if(!o || o === t || o.dead) continue;
				if(Math.hypot(o.x - t.x, o.y - t.y) < 150) cluster++;
			}
			s += cluster * 55;
			if(t.hp > 400) s += 40;
			if(s > bestS){ bestS = s; best = t; }
		}
		kx.target = best;
	}
	function kxNearCount(en, r){
		const list = kxVictims(en);
		const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
		let n = 0;
		for(let i = 0; i < list.length; i++){
			if(Math.hypot(list[i].cx - cx, list[i].cy - cy) < r) n++;
		}
		return n;
	}

	function kxInit(en, room){
		const friendly = kxFriendly(en);
		const kx = en._kx = {
			friendly: friendly,
			boss: !friendly && !!(en.typeDef && en.typeDef.isBoss),
			stance: 'idle',
			phase: 1,
			atk: null,
			cd: friendly ? 36 : 70,
			intro: friendly ? 18 : 150,
			vulnerable: 0,
			zones: [],
			fx: [],
			imprints: [],
			reactFX: [],
			meteors: [],
			combo: null,
			comboI: 0,
			target: null,
			vx: 0,
			vy: 0,
			onGround: true,
			lastAtk: '',
			lastCharge: 0,
			lastMeteor: 0,
			lastHeart: 0,
			step: 0,
			armor: 1,
			deadDone: false,
			didHit: false,
		};
		en.bossPhase = 1;
		en._kxArmor = true;
		en._kxCoreOpen = false;
		if(!friendly && room){
			en.x = room.x + room.w * 0.5 - en.w / 2;
			en.y = kxGroundY(en, room);
			kxBanner('KRYONAX — THE FROZEN COLOSSUS');
			kxShake(14, 32);
		} else {
			en.y = kxGroundY(en, room);
		}
		return kx;
	}

	function kxPhase(en, kx, room){
		const hpR = en.maxHp ? en.hp / en.maxHp : 1;
		kx.armor = hpR > PHASE2 ? 1 : hpR > PHASE3 ? 0.55 : 0.18;
		en._kxArmor = kx.armor > 0.25;
		if(hpR <= PHASE2 && kx.phase < 2){
			kx.phase = 2; en.bossPhase = 2; en.bossPhaseTransition = 100;
			if(kx.boss){ kxBanner('THE GLACIER RISES'); kxShake(12, 26); }
			kxPart(en.x + en.w / 2, en.y + en.h * 0.4, 18, 90);
		}
		if(hpR <= PHASE3 && kx.phase < 3){
			kx.phase = 3; en.bossPhase = 3; en.bossPhaseTransition = 110;
			if(kx.boss){ kxBanner('HEART OF THE GLACIER'); kxShake(16, 30); }
			kxPart(en.x + en.w / 2, en.y + en.h * 0.45, 22, 110);
		}
	}

	const BANNERS = {
		fist:'The colossus raises a fist.',
		wave:'The glacier exhales.',
		charge:'The titan locks a path.',
		sweep:'A ridge of ice swings.',
		grasp:'The ground remembers winter.',
		roar:'Avalanche.',
		meteor:'He tears ice from himself.',
		tremor:'The basin answers his feet.',
		heart:'THE HEART OPENS',
	};

	function kxStart(en, name, kx){
		kx.atk = { name:name, t:0, dir:en.facing || 1, ax:0, ay:0, spots:[], rings:0, locked:false, hit:[] };
		kx.didHit = false;
		en.attackAnimTimer = 56;
		kx.lastAtk = name;
		if(name === 'charge') kx.lastCharge = 0;
		if(name === 'meteor') kx.lastMeteor = 0;
		if(name === 'heart') kx.lastHeart = 0;
		if(kx.boss && BANNERS[name]) kxBanner(BANNERS[name]);
	}
	function kxEnd(en, kx, cd, vuln){
		kx.atk = null;
		kx.cd = kx.friendly ? Math.round((cd || 56) * 0.72) : (cd || 62);
		kx.stance = 'recover';
		en._kxCoreOpen = false;
		if(vuln) kx.vulnerable = vuln;
		if(kx.combo && kx.comboI >= kx.combo.length){
			kx.combo = null;
			kx.vulnerable = Math.max(kx.vulnerable, kx.friendly ? 36 : 70);
			if(kx.boss) kxBanner('The core is exposed — strike!');
			en._kxCoreOpen = true;
		}
	}

	function kxMaybeCombo(kx, name, phase, friendly){
		if(kx.combo) return;
		if(Math.random() > (friendly ? 0.38 : 0.58)) return;
		const map = {
			grasp:['fist'], charge:['sweep'], meteor:['charge'],
			roar:['tremor'], wave:['sweep'], heart:['charge'], fist:['wave'],
		};
		let next = map[name];
		if(!next) return;
		if(name === 'roar' && phase < 2 && !friendly) return;
		if(name === 'meteor' && phase < 2 && !friendly) return;
		if(name === 'heart' && phase < 3 && !friendly) return;
		kx.combo = next.slice();
		kx.comboI = 0;
	}

	function kxPool(kx){
		if(kx.friendly) return ['fist', 'wave', 'charge', 'sweep', 'grasp', 'roar', 'meteor', 'tremor', 'heart'];
		const p = ['fist', 'wave', 'sweep', 'charge', 'grasp'];
		if(kx.phase >= 2){ p.push('roar', 'meteor', 'tremor'); }
		if(kx.phase >= 3) p.push('heart');
		return p;
	}
	function kxPick(en, kx, tgt){
		if(kx.combo && kx.comboI < kx.combo.length) return kx.combo[kx.comboI++];
		kx.combo = null;
		const dist = kxDist(en, tgt);
		const near = kxNearCount(en, 230);
		const pool = kxPool(kx);
		const w = {};
		for(let i = 0; i < pool.length; i++) w[pool[i]] = 2;
		if(kx.lastAtk) w[kx.lastAtk] = 0;
		if(kx.lastCharge < 220) w.charge = 0;
		if(kx.lastMeteor < 200) w.meteor = Math.min(w.meteor || 0, 1);
		if(kx.lastHeart < 360) w.heart = 0;
		if(dist > 700){ w.charge = (w.charge || 0) + 5; w.meteor = (w.meteor || 0) + 4; w.fist = (w.fist || 0) + 1; }
		else if(dist > 340){ w.grasp = (w.grasp || 0) + 2; w.charge = (w.charge || 0) + 3; w.sweep = (w.sweep || 0) + 2; w.fist += 2; }
		else { w.fist = (w.fist || 0) + 3; w.sweep = (w.sweep || 0) + 2; w.wave = (w.wave || 0) + 2; }
		if(near >= 3){ w.wave += 4; w.sweep += 3; w.roar = (w.roar || 0) + 4; w.grasp += 2; w.tremor = (w.tremor || 0) + 2; }
		if(near <= 1 && dist < 240){ w.fist += 3; w.meteor = Math.max(0, (w.meteor || 0) - 1); }
		if(kx.friendly && tgt && tgt.en && tgt.en.typeDef && tgt.en.typeDef.isBoss){
			w.fist += 3; w.heart = (w.heart || 0) + 2; w.meteor += 1;
		}
		if(kx.phase >= 3 && kx.lastHeart >= 360) w.heart = (w.heart || 0) + 3;
		let total = 0;
		const keys = Object.keys(w);
		for(let i = 0; i < keys.length; i++) total += Math.max(0, w[keys[i]]);
		if(total <= 0) return 'fist';
		let roll = Math.random() * total;
		for(let i = 0; i < keys.length; i++){
			roll -= Math.max(0, w[keys[i]]);
			if(roll <= 0) return keys[i];
		}
		return keys[0];
	}

	function kxDrive(en, room, kx, tgt, mode){
		kx.stance = mode;
		const face = tgt ? kxFace(en, tgt) : (en.facing || 1);
		const spd = kx.friendly ? 4.6 : 4.2;
		if(mode === 'walk'){
			const d = kxDist(en, tgt);
			if(tgt && d > 160) kx.vx = face * spd;
			else kx.vx *= 0.72;
		} else if(mode === 'close'){
			kx.vx = face * (spd * 1.35);
		} else if(mode === 'recover'){
			kx.vx *= 0.74;
		} else {
			kx.vx *= 0.82;
		}
		if(!kx.onGround) kx.vy += 0.55;
		else kx.vy = 0;
		if(kx.vy > 14) kx.vy = 14;
		const prevX = en.x;
		kxApply(en, room, kx);
		if(kx.onGround && Math.abs(en.x - prevX) > 1.2){
			kx.step++;
			if(kx.step % 22 === 0) kxImprint(en, kx, room);
		}
	}

	function kxLeash(en, kx, room){
		if(!kx.friendly || typeof player === 'undefined') return false;
		const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
		const d = Math.hypot(pcx - (en.x + en.w / 2), pcy - (en.y + en.h / 2));
		if(d > 1500){
			en.x = player.x + (Math.random() - 0.5) * 80;
			en.y = kxGroundY(en, room);
			kx.vx = 0; kx.vy = 0;
			return true;
		}
		if(d > 460 && !kx.atk){
			const face = pcx >= en.x + en.w / 2 ? 1 : -1;
			en.facing = face;
			kx.vx = face * 7.2;
			if(!kx.onGround) kx.vy += 0.55;
			kxApply(en, room, kx);
			return true;
		}
		return false;
	}

	function runAtk(en, room, kx, tgt){
		const a = kx.atk; a.t++;
		const cx = en.x + en.w / 2, cy = en.y + en.h * 0.55, gy = en.y + en.h;
		const face = a.dir || en.facing || 1;
		const dmgM = kx.friendly ? 1.7 : 1;

		if(a.name === 'fist'){
			kxDrive(en, room, kx, tgt, 'recover');
			if(a.t === 1){
				kxFace(en, tgt);
				a.dir = en.facing || 1;
				a.ax = kxAimX(en, tgt, 920);
				const rr = kxSz(220);
				kxTel(a.ax - rr, gy - 80, rr * 2, 120, 28, 'FIST', 'circle');
			}
			if(a.t < 28) kxPart(a.ax || (cx + (en.facing || 1) * 80), gy - 20, 2, 36);
			if(a.t === 28){
				const hx = a.ax || (cx + (en.facing || 1) * (en.w * 0.35));
				const rad = kxSz(250);
				kxAoE(en, hx, gy - 10, rad, Math.round(46 * dmgM), { kb:12, launch:true, slow:24, cx:hx });
				kx.zones.push({ kind:'circ', cx:hx, cy:gy - 8, r:kxSz(160), life:18, dmg:Math.round(12 * dmgM), tick:8 });
				kx.fx.push({ kind:'ring', x:hx, y:gy - 6, r:80, life:26, max:26 });
				kx.fx.push({ kind:'crack', x:hx, y:gy, r:rad, life:28, max:28 });
				kx.fx.push({ kind:'spike', x:hx, y:gy, h:kxSz(90), life:22, max:22 });
				kxShake(16, 20); kxPart(hx, gy, 22, 140);
				kxImprint(en, kx, room);
				kxReact(en, kx, room, 'fist', hx);
			}
			if(a.t > 62){ kxMaybeCombo(kx, 'fist', kx.phase, kx.friendly); kxEnd(en, kx, 48, 28); }

		} else if(a.name === 'wave'){
			kxDrive(en, room, kx, tgt, 'recover');
			if(a.t === 1) kxTel(cx - kxSz(160), gy - 90, kxSz(320), 140, 22, 'WAVE', 'circle');
			if(a.t === 22){
				a.ax = 90;
				kx.fx.push({ kind:'ring', x:cx, y:gy - 8, r:50, life:40, max:40 });
				kx.fx.push({ kind:'crack', x:cx, y:gy, r:140, life:24, max:24 });
				kxShake(12, 18); kxPart(cx, gy, 16, 110);
				kxReact(en, kx, room, 'tremor', cx);
			}
			if(a.t > 22 && a.t < 70){
				a.ax += 18;
				const list = kxVictims(en);
				for(let i = 0; i < list.length; i++){
					const d = Math.hypot(list[i].cx - cx, (list[i].cy - (gy - 8)) * 0.32);
					if(Math.abs(d - a.ax) < 56 && kxOnce(a, list[i])){
						kxHurtOne(en, list[i], Math.round(30 * dmgM), { kb:8, slow:40, cx:cx });
					}
				}
			}
			if(a.t > 82){ kxMaybeCombo(kx, 'wave', kx.phase, kx.friendly); kxEnd(en, kx, 46, 24); }

		} else if(a.name === 'charge'){
			if(a.t === 1){
				kxFace(en, tgt);
				a.dir = en.facing || 1;
				a.ax = Math.min(1400, room ? room.w * 0.72 : 1100);
				kxTel(cx + (a.dir > 0 ? 0 : -a.ax), en.y - 20, a.ax, en.h + 40, 20, 'CHARGE');
			}
			if(a.t < 20){
				kx.vx *= 0.55; kx.stance = 'brace';
				kxApply(en, room, kx);
			} else if(a.t < 68){
				kx.stance = 'charge';
				if(tgt && a.t % 8 === 0){
					const want = tgt.cx >= en.x + en.w / 2 ? 1 : -1;
					a.dir = want; en.facing = want;
				}
				kx.vx = a.dir * (kx.friendly ? 18.5 : 17.5);
				kxApply(en, room, kx);
				if(a.t % 2 === 0){
					const hx = en.x - 30, hw = en.w + 60;
					const list = kxVictims(en);
					for(let i = 0; i < list.length; i++){
						if(kxInRect(list[i], hx, en.y - 40, hw, en.h + 80) && kxOnce(a, list[i])){
							kxHurtOne(en, list[i], Math.round(40 * dmgM), { kb:14, launch:true, cx:en.x + en.w / 2 });
						}
					}
					kxImprint(en, kx, room);
					kxPart(en.x + en.w / 2, gy, 5, 60);
					if(a.t % 3 === 0) kx.fx.push({ kind:'wake', x:en.x + en.w / 2, y:gy, r:48, life:16, max:16 });
				}
			} else {
				kx.vx *= 0.7; kx.stance = 'recover';
				kxApply(en, room, kx);
				if(a.t === 69){ kxShake(12, 16); kxReact(en, kx, room, 'charge', en.x + en.w / 2); }
			}
			if(a.t > 88){ kxMaybeCombo(kx, 'charge', kx.phase, kx.friendly); kxEnd(en, kx, 56, 30); }

		} else if(a.name === 'sweep'){
			kxDrive(en, room, kx, tgt, 'recover');
			const sw = kxSz(520);
			if(a.t === 1){
				kxFace(en, tgt); a.dir = en.facing || 1;
				const sx = cx + (a.dir > 0 ? 10 : -sw);
				kxTel(sx, en.y - 30, sw, en.h + 80, 22, 'SWEEP');
			}
			if(a.t === 22){
				const sx = cx + (a.dir > 0 ? 0 : -sw);
				kxBoxDmg(en, sx, en.y - 40, sw, en.h + 100, Math.round(34 * dmgM), { kb:10, launch:true, cx:cx });
				kx.fx.push({ kind:'arc', x:cx, y:cy, r:kxSz(280), dir:a.dir, life:18, max:18 });
				kx.fx.push({ kind:'slash', x:cx, y:cy, r:kxSz(300), dir:a.dir, life:16, max:16 });
				kxShake(10, 14); kxPart(cx + a.dir * 140, cy, 14, 100);
			}
			if(a.t === 28){
				const wx = cx + a.dir * kxSz(360);
				kxBoxDmg(en, wx - kxSz(80), gy - 80, kxSz(160), 120, Math.round(18 * dmgM), { slow:36, cx:wx });
				kxPad(kx, Math.min(cx, wx) - 20, gy - 22, Math.abs(wx - cx) + kxSz(80), 28, 100, Math.round(6 * dmgM), 28);
			}
			if(a.t > 56){ kxMaybeCombo(kx, 'sweep', kx.phase, kx.friendly); kxEnd(en, kx, 42, 24); }

		} else if(a.name === 'grasp'){
			kxDrive(en, room, kx, tgt, 'recover');
			if(a.t === 1){
				a.spots = [];
				const list = kxVictims(en);
				list.sort(function(p, q){
					return Math.hypot(p.cx - cx, p.cy - cy) - Math.hypot(q.cx - cx, q.cy - cy);
				});
				const take = Math.min(3, Math.max(1, list.length));
				const spotR = kxSz(88);
				for(let i = 0; i < take; i++){
					const t = list[i] || tgt;
					if(!t) continue;
					const dx = t.cx - cx, d = Math.max(40, Math.abs(dx));
					const reach = Math.min(980, d);
					for(let k = 1; k <= 3; k++){
						const sx = cx + (dx >= 0 ? 1 : -1) * reach * (k / 3);
						const sy = (t.y + t.h) || (gy - 8);
						a.spots.push({ x:sx, y:sy, r:spotR });
						kxTel(sx - spotR, sy - spotR, spotR * 2, spotR * 2, 22, k === 2 ? 'GRASP' : '', 'circle');
					}
				}
				if(!a.spots.length){
					const dir = en.facing || 1;
					for(let k = 1; k <= 3; k++) a.spots.push({ x:cx + dir * kxSz(160) * k, y:gy - 8, r:kxSz(88) });
				}
			}
			if(a.t === 22){
				for(let i = 0; i < a.spots.length; i++){
					const s = a.spots[i];
					kxAoE(en, s.x, s.y, s.r, Math.round(24 * dmgM), { slow:70, kb:4, cx:s.x });
					kxPad(kx, s.x - kxSz(48), s.y - 12, kxSz(96), 28, 110, Math.round(5 * dmgM), 40);
					kx.fx.push({ kind:'burst', x:s.x, y:s.y, r:kxSz(40), life:20, max:20 });
					kx.fx.push({ kind:'spike', x:s.x, y:s.y, h:kxSz(110), life:24, max:24 });
					kxPart(s.x, s.y, 10, 70);
				}
				kxShake(10, 14);
			}
			if(a.t > 50){ kxMaybeCombo(kx, 'grasp', kx.phase, kx.friendly); kxEnd(en, kx, 40, 22); }

		} else if(a.name === 'roar'){
			kxDrive(en, room, kx, tgt, 'recover');
			const rr = kxSz(420);
			if(a.t === 1) kxTel(cx - rr, cy - rr, rr * 2, rr * 2, 24, 'ROAR', 'circle');
			if(a.t === 24){
				kxAoE(en, cx, cy, rr, Math.round(28 * dmgM), { kb:13, launch:true, slow:50, cx:cx });
				kx.fx.push({ kind:'ring', x:cx, y:cy, r:70, life:28, max:28 });
				kx.fx.push({ kind:'roar', x:cx, y:en.y + 30, r:120, life:26, max:26 });
				kx.fx.push({ kind:'ring', x:cx, y:cy, r:20, life:36, max:36 });
				kxShake(16, 22); kxPart(cx, en.y + 40, 24, 180);
				kxReact(en, kx, room, 'roar', cx);
			}
			if(a.t > 58){ kxMaybeCombo(kx, 'roar', kx.phase, kx.friendly); kxEnd(en, kx, 52, 26); }

		} else if(a.name === 'meteor'){
			kxDrive(en, room, kx, tgt, 'recover');
			if(a.t === 1){
				const aim = tgt || { cx:cx + (en.facing || 1) * 520, cy:gy };
				a.ax = aim.cx; a.ay = aim.cy;
				const mr = kxSz(140);
				kxTel(a.ax - mr, a.ay - mr, mr * 2, mr * 2, 36, 'METEOR', 'circle');
				kx.fx.push({ kind:'aim', x:a.ax, y:a.ay, r:mr, life:36, max:36 });
			}
			if(a.t === 36){
				const aim = tgt || { cx:a.ax, cy:a.ay };
				a.ax = aim.cx; a.ay = aim.cy;
				const sx = cx + (en.facing || 1) * 70, sy = en.y + 48;
				kxLaunchMeteor(en, kx, sx, sy, a.ax, a.ay, dmgM);
				kx.fx.push({ kind:'burst', x:sx, y:sy, r:kxSz(60), life:18, max:18 });
				kxPart(sx, sy, 18, 90); kxShake(10, 14);
				kxReact(en, kx, room, 'fist', a.ax);
			}
			if(a.t > 58){ kxMaybeCombo(kx, 'meteor', kx.phase, kx.friendly); kxEnd(en, kx, 48, 24); }

		} else if(a.name === 'tremor'){
			kxDrive(en, room, kx, tgt, 'recover');
			if(a.t === 1){
				a.rings = 0;
				kxTel(cx - kxSz(100), gy - 40, kxSz(200), 56, 16, 'TREMOR');
			}
			if(a.t === 16 || a.t === 34 || a.t === 52){
				a.rings++;
				a.hit = [];
				const r = kxSz(120) + a.rings * kxSz(150);
				const gap = (a.rings * 1.1 + (en.facing || 1) * 0.4);
				kx.fx.push({ kind:'tremor', x:cx, y:gy - 6, r:r, gap:gap, life:26, max:26 });
				kx.fx.push({ kind:'crack', x:cx, y:gy, r:r * 0.55, life:20, max:20 });
				const list = kxVictims(en);
				for(let i = 0; i < list.length; i++){
					const d = Math.hypot(list[i].cx - cx, (list[i].cy - (gy - 6)) * 0.32);
					const ang = Math.atan2(list[i].cy - (gy - 6), list[i].cx - cx);
					let g = ang - gap;
					while(g > Math.PI) g -= Math.PI * 2;
					while(g < -Math.PI) g += Math.PI * 2;
					if(Math.abs(d - r) < 70 && Math.abs(g) > 0.38){
						kxHurtOne(en, list[i], Math.round(26 * dmgM), { kb:7, slow:28, cx:cx });
					}
				}
				kxShake(10, 14); kxPart(cx, gy, 12, 90);
				kxImprint(en, kx, room);
			}
			if(a.t === 52) kxReact(en, kx, room, 'tremor', cx);
			if(a.t > 82){ kxMaybeCombo(kx, 'tremor', kx.phase, kx.friendly); kxEnd(en, kx, 56, 30); }

		} else if(a.name === 'heart'){
			kxDrive(en, room, kx, tgt, 'recover');
			const hr = kxSz(520);
			if(a.t === 1){
				kxTel(cx - hr, cy - hr, hr * 2, hr * 2, 36, 'HEART', 'circle');
				en._kxCoreOpen = false;
			}
			if(a.t < 36 && a.t % 5 === 0) kxPart(cx, cy, 6, 110);
			if(a.t === 36){
				kxAoE(en, cx, cy, hr, Math.round(58 * dmgM), { kb:14, launch:true, slow:60, cx:cx });
				for(let i = 0; i < 12; i++){
					const ang = (i / 12) * Math.PI * 2;
					kxProj(en, cx, cy, Math.cos(ang) * 7.2, Math.sin(ang) * 5.2, {
						power: Math.round(22 * dmgM), w:kxSz(44), h:kxSz(44), age:100, style:'shard', shape:'spike',
					});
				}
				kxPad(kx, cx - kxSz(280), gy - 24, kxSz(560), 36, 150, Math.round(8 * dmgM), 40);
				kx.fx.push({ kind:'heart', x:cx, y:cy, r:80, life:36, max:36 });
				kx.fx.push({ kind:'ring', x:cx, y:cy, r:30, life:40, max:40 });
				kx.fx.push({ kind:'crack', x:cx, y:gy, r:hr * 0.5, life:32, max:32 });
				kxShake(20, 30); kxPart(cx, cy, 30, 200);
				kxReact(en, kx, room, 'heart', cx);
				en._kxCoreOpen = true;
			}
			if(a.t > 96){ kxMaybeCombo(kx, 'heart', kx.phase, kx.friendly); kxEnd(en, kx, 90, 56); }

		} else kxEnd(en, kx, 50, 28);
	}

	function updateKryonax(en){
		if(!en || !kxIs(en)) return false;
		if(en.dead || en.hp <= 0){
			if(en._kx && !en._kx.deadDone){
				en._kx.deadDone = true;
				if(en._kx.meteors){
					for(let i = 0; i < en._kx.meteors.length; i++) kxMeteorBurst(en, en._kx, en._kx.meteors[i]);
					en._kx.meteors.length = 0;
				}
				if(en._kx.boss) kxBanner('KRYONAX — THE FROZEN COLOSSUS — fallen');
			}
			return false;
		}
		const room = kxRoom(en);
		if(!en._kx) kxInit(en, room);
		const kx = en._kx;
		en.animTimer = (en.animTimer || 0) + 1;
		kx.lastCharge++; kx.lastMeteor++; kx.lastHeart++;
		kxTickImprints(en, kx);
		kxTickZones(en, kx);
		kxTickMeteors(en, kx);
		kxPhase(en, kx, room);
		kxPickTarget(en, kx);
		const tgt = kxTgt(en, kx);

		if(kxLeash(en, kx, room) && !kx.atk) return true;

		if(en.bossPhaseTransition > 0){
			en.bossPhaseTransition--;
			kx.vx *= 0.8;
			kxDrive(en, room, kx, tgt, 'recover');
			kxPart(en.x + en.w / 2, en.y + 40, 3, 60);
			return true;
		}
		if(kx.intro > 0){
			kx.intro--;
			kxDrive(en, room, kx, tgt, 'walk');
			if(!kx.friendly && kx.intro === 80) kxBanner('A living glacier has awakened.');
			return true;
		}
		if(kx.vulnerable > 0){
			kx.vulnerable--;
			en._kxCoreOpen = true;
			kxDrive(en, room, kx, tgt, 'recover');
			return true;
		}
		en._kxCoreOpen = false;
		if(kx.atk){ runAtk(en, room, kx, tgt); return true; }
		kx.cd--;
		if(kx.cd > 0){
			const d = kxDist(en, tgt);
			kxDrive(en, room, kx, tgt, d > 200 ? 'walk' : (d > 130 ? 'close' : 'recover'));
			if(!kx.friendly && typeof player !== 'undefined' && player.x + player.w > en.x + 30 && player.x < en.x + en.w - 30 && player.y + player.h > en.y + en.h * 0.35 && player.y < en.y + en.h){
				player.x += (player.x + player.w / 2 < en.x + en.w / 2) ? -2.4 : 2.4;
			}
			return true;
		}
		if(!tgt && kx.friendly){
			kxDrive(en, room, kx, null, 'recover');
			kx.cd = 20;
			return true;
		}
		const pick = kxPick(en, kx, tgt);
		kxStart(en, pick, kx);
		return true;
	}

	function kxAerialAbove(en){
		if(typeof player === 'undefined' || !player) return false;
		const py = player.y + player.h / 2;
		const ey = en.y + (en.h || 0) / 2;
		return ey - py >= 200;
	}
	function kryonaxOnEnemyHit(en){
		if(!en || !kxIs(en)) return 1;
		let m = 1;
		if(kxAerialAbove(en)) m *= 0.1;
		if(en._kxArmor) m *= 0.82;
		if(en._kxCoreOpen) m *= 1.65;
		return m;
	}

	function kxHex(c, a){
		if(typeof c === 'string' && c[0] === '#'){
			const n = parseInt(c.slice(1), 16);
			return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + (a == null ? 1 : a) + ')';
		}
		return c;
	}
	function kxGlow(x, y, r, inner, outer){
		const g = ctx.createRadialGradient(x, y, 1, x, y, r);
		g.addColorStop(0, inner);
		g.addColorStop(1, outer);
		ctx.fillStyle = g;
		ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
	}
	function kxIcePoly(ox, oy, r, rot, fill, stroke){
		ctx.save(); ctx.translate(ox, oy); ctx.rotate(rot || 0);
		ctx.beginPath();
		ctx.moveTo(r, 0);
		ctx.lineTo(r * 0.28, r * 0.72);
		ctx.lineTo(-r * 0.78, r * 0.32);
		ctx.lineTo(-r * 0.42, -r * 0.58);
		ctx.lineTo(r * 0.38, -r * 0.74);
		ctx.closePath();
		ctx.fillStyle = fill; ctx.fill();
		if(stroke){ ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
		ctx.restore();
	}
	function drawKryonaxMeteor(m, camx, camy){
		const x = m.x - camx, y = m.y - camy, r = m.r;
		for(let i = 0; i < m.trail.length; i++){
			const t = m.trail[i], ta = t.life / 14;
			kxGlow(t.x - camx, t.y - camy, r * (0.35 + 0.45 * ta), 'rgba(200,240,255,' + (0.18 * ta) + ')', 'rgba(80,150,210,0)');
		}
		ctx.save();
		ctx.globalAlpha = 0.38;
		ctx.fillStyle = 'rgba(20,40,70,0.45)';
		ctx.beginPath(); ctx.ellipse(x, y + r * 0.85, r * 0.72, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
		kxGlow(x, y, r * 1.55, 'rgba(200,240,255,0.28)', 'rgba(80,160,220,0)');
		ctx.save(); ctx.translate(x, y); ctx.rotate(m.rot);
		const g = ctx.createRadialGradient(-r * 0.2, -r * 0.25, 6, 0, 0, r * 1.15);
		g.addColorStop(0, 'rgba(255,255,255,0.98)');
		g.addColorStop(0.35, 'rgba(210,240,255,0.96)');
		g.addColorStop(0.7, 'rgba(120,190,230,0.92)');
		g.addColorStop(1, 'rgba(40,80,130,0.2)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.moveTo(r * 1.05, 0);
		ctx.lineTo(r * 0.42, r * 0.78);
		ctx.lineTo(-r * 0.55, r * 0.68);
		ctx.lineTo(-r * 1.02, r * 0.08);
		ctx.lineTo(-r * 0.48, -r * 0.72);
		ctx.lineTo(r * 0.38, -r * 0.82);
		ctx.closePath(); ctx.fill();
		ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 3; ctx.stroke();
		ctx.strokeStyle = 'rgba(170,220,255,0.7)'; ctx.lineWidth = 1.6;
		ctx.beginPath(); ctx.moveTo(-r * 0.2, -r * 0.5); ctx.lineTo(r * 0.15, r * 0.2); ctx.lineTo(-r * 0.05, r * 0.45); ctx.stroke();
		ctx.restore();
	}
	function drawKryonaxProj(p){
		const x = p.x - camera.x, y = p.y - camera.y, r = Math.max(p.width || 20, p.height || 20) * 0.58;
		ctx.save(); ctx.translate(x, y);
		if(p._kxStyle === 'meteor'){
			ctx.rotate((p.age || 0) * 0.05);
			kxIcePoly(0, 0, r, 0, 'rgba(220,244,255,0.96)', 'rgba(255,255,255,0.8)');
			ctx.restore(); return;
		}
		ctx.rotate(Math.atan2(p.vy, p.vx) + (p.age || 0) * 0.12);
		kxGlow(0, 0, r * 1.5, 'rgba(210,240,255,0.45)', 'rgba(80,160,220,0)');
		ctx.fillStyle = kxHex(p.color2 || '#e8f7ff', 0.96);
		ctx.beginPath(); ctx.moveTo(r * 1.2, 0); ctx.lineTo(0, r * 0.55); ctx.lineTo(-r * 0.85, 0); ctx.lineTo(0, -r * 0.55); ctx.closePath(); ctx.fill();
		ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.8; ctx.stroke();
		ctx.restore();
	}

	function kxAll(){
		const out = [];
		if(typeof enemies !== 'undefined'){
			for(let i = 0; i < enemies.length; i++){
				if(enemies[i] && kxIs(enemies[i]) && enemies[i]._kx) out.push(enemies[i]);
			}
		}
		if(typeof playerMinions !== 'undefined'){
			for(let i = 0; i < playerMinions.length; i++){
				if(playerMinions[i] && kxIs(playerMinions[i]) && playerMinions[i]._kx) out.push(playerMinions[i]);
			}
		}
		return out;
	}

	function drawKryonaxWorld(){
		const list = kxAll();
		if(!list.length) return;
		const camx = camera.x, camy = camera.y;
		const pulse = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.006;
		for(let n = 0; n < list.length; n++){
			const en = list[n], kx = en._kx;
			if(!kx) continue;
			for(let i = 0; i < kx.imprints.length; i++){
				const z = kx.imprints[i], a = z.life / z.max;
				const ix = z.x - camx, iy = z.y - camy;
				const g = ctx.createLinearGradient(ix, iy, ix, iy + z.h);
				g.addColorStop(0, 'rgba(210,240,255,' + (0.22 + 0.28 * a) + ')');
				g.addColorStop(1, 'rgba(90,150,200,' + (0.18 + 0.2 * a) + ')');
				ctx.fillStyle = g; ctx.fillRect(ix, iy, z.w, z.h);
				ctx.strokeStyle = 'rgba(230,248,255,' + (0.55 * a) + ')'; ctx.lineWidth = 2;
				ctx.strokeRect(ix, iy, z.w, z.h);
				ctx.strokeStyle = 'rgba(180,220,255,' + (0.35 * a) + ')';
				ctx.beginPath(); ctx.moveTo(ix + 8, iy + 4); ctx.lineTo(ix + z.w * 0.4, iy + z.h - 3); ctx.lineTo(ix + z.w - 10, iy + 6); ctx.stroke();
			}
			for(let i = 0; i < kx.zones.length; i++){
				const z = kx.zones[i];
				if(z.kind === 'circ'){
					kxGlow(z.cx - camx, z.cy - camy, z.r, 'rgba(160,220,255,0.22)', 'rgba(80,150,210,0.02)');
					ctx.strokeStyle = 'rgba(210,244,255,0.88)'; ctx.fillStyle = 'rgba(130,200,255,0.16)';
					ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(z.cx - camx, z.cy - camy, z.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
				} else {
					const gx = z.x - camx, gy = z.y - camy;
					const pg = ctx.createLinearGradient(gx, gy, gx, gy + z.h);
					pg.addColorStop(0, 'rgba(200,236,255,0.18)');
					pg.addColorStop(0.5, 'rgba(140,210,255,0.42)');
					pg.addColorStop(1, 'rgba(70,130,180,0.38)');
					ctx.fillStyle = pg; ctx.fillRect(gx, gy, z.w, z.h);
					ctx.strokeStyle = 'rgba(220,245,255,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(gx, gy, z.w, z.h);
				}
			}
			if(kx.meteors){
				for(let i = 0; i < kx.meteors.length; i++) drawKryonaxMeteor(kx.meteors[i], camx, camy);
			}
			for(let i = 0; i < kx.fx.length; i++){
				const f = kx.fx[i], a = f.life / (f.max || 1);
				const fx = f.x - camx, fy = f.y - camy;
				if(f.kind === 'ring' || f.kind === 'heart' || f.kind === 'roar'){
					const grow = (f.r || 30) + (1 - a) * (f.kind === 'heart' ? 460 : f.kind === 'roar' ? 340 : 300);
					ctx.strokeStyle = 'rgba(210,244,255,' + ((f.kind === 'heart' ? 0.95 : 0.88) * a) + ')';
					ctx.lineWidth = f.kind === 'heart' ? 14 : 9;
					ctx.beginPath(); ctx.arc(fx, fy, grow, 0, Math.PI * 2); ctx.stroke();
					ctx.strokeStyle = 'rgba(255,255,255,' + (0.45 * a) + ')'; ctx.lineWidth = 3;
					ctx.beginPath(); ctx.arc(fx, fy, grow * 0.86, 0, Math.PI * 2); ctx.stroke();
					if(f.kind === 'heart') kxGlow(fx, fy, 70 * a, 'rgba(230,248,255,' + (0.55 * a) + ')', 'rgba(120,190,230,0)');
				} else if(f.kind === 'arc' || f.kind === 'slash'){
					ctx.strokeStyle = 'rgba(230,248,255,' + (0.95 * a) + ')'; ctx.lineWidth = f.kind === 'slash' ? 22 : 16;
					ctx.beginPath(); ctx.arc(fx, fy, f.r, f.dir > 0 ? -0.62 : Math.PI - 0.62, f.dir > 0 ? 1.28 : Math.PI + 1.28); ctx.stroke();
					ctx.strokeStyle = 'rgba(140,200,240,' + (0.55 * a) + ')'; ctx.lineWidth = 6;
					ctx.beginPath(); ctx.arc(fx, fy, f.r * 0.82, f.dir > 0 ? -0.5 : Math.PI - 0.5, f.dir > 0 ? 1.15 : Math.PI + 1.15); ctx.stroke();
				} else if(f.kind === 'burst' || f.kind === 'imprint'){
					kxGlow(fx, fy, (f.r || 40) * (0.6 + 0.8 * a), 'rgba(220,245,255,' + (0.5 * a) + ')', 'rgba(90,160,210,0)');
					ctx.strokeStyle = 'rgba(200,236,255,' + (0.8 * a) + ')'; ctx.lineWidth = 4;
					ctx.beginPath(); ctx.ellipse(fx, fy, f.r * a, 10 + 6 * a, 0, 0, Math.PI * 2); ctx.stroke();
				} else if(f.kind === 'tremor'){
					ctx.strokeStyle = 'rgba(200,240,255,' + (0.94 * a) + ')'; ctx.lineWidth = 16;
					ctx.beginPath(); ctx.arc(fx, fy, f.r, 0, Math.PI * 2); ctx.stroke();
					ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * a) + ')'; ctx.lineWidth = 5;
					ctx.beginPath(); ctx.arc(fx, fy, f.r, 0, Math.PI * 2); ctx.stroke();
					ctx.strokeStyle = 'rgba(8,16,32,0.72)'; ctx.lineWidth = 20;
					ctx.beginPath(); ctx.arc(fx, fy, f.r, f.gap - 0.46, f.gap + 0.46); ctx.stroke();
				} else if(f.kind === 'crack'){
					ctx.strokeStyle = 'rgba(210,240,255,' + (0.85 * a) + ')'; ctx.lineWidth = 3;
					for(let k = 0; k < 5; k++){
						const ang = k * 1.26 + pulse;
						ctx.beginPath();
						ctx.moveTo(fx, fy);
						ctx.lineTo(fx + Math.cos(ang) * f.r * a, fy + Math.sin(ang) * f.r * 0.35 * a);
						ctx.stroke();
					}
				} else if(f.kind === 'spike'){
					const h = (f.h || 80) * (0.35 + 0.65 * a);
					ctx.fillStyle = 'rgba(220,244,255,' + (0.9 * a) + ')';
					ctx.beginPath(); ctx.moveTo(fx, fy - h); ctx.lineTo(fx + 16, fy + 8); ctx.lineTo(fx - 16, fy + 8); ctx.fill();
					ctx.fillStyle = 'rgba(255,255,255,' + (0.55 * a) + ')';
					ctx.beginPath(); ctx.moveTo(fx, fy - h); ctx.lineTo(fx + 5, fy); ctx.lineTo(fx - 2, fy); ctx.fill();
				} else if(f.kind === 'wake'){
					ctx.fillStyle = 'rgba(170,220,255,' + (0.32 * a) + ')';
					ctx.beginPath(); ctx.ellipse(fx, fy, f.r * a, 10, 0, 0, Math.PI * 2); ctx.fill();
					ctx.strokeStyle = 'rgba(220,245,255,' + (0.7 * a) + ')'; ctx.lineWidth = 2;
					ctx.stroke();
				} else if(f.kind === 'aim'){
					const pr = f.r * (0.85 + 0.08 * Math.sin(pulse * 4));
					ctx.strokeStyle = 'rgba(230,248,255,' + (0.75 + 0.2 * Math.sin(pulse * 5)) + ')'; ctx.lineWidth = 4;
					ctx.setLineDash([12, 8]);
					ctx.beginPath(); ctx.arc(fx, fy, pr, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
					kxGlow(fx, fy, pr * 0.7, 'rgba(180,230,255,0.18)', 'rgba(80,150,210,0)');
				} else if(f.kind === 'shardFly'){
					kxIcePoly(fx, fy, 12, (f.life || 0) * 0.2, 'rgba(230,248,255,' + (0.9 * a) + ')', 'rgba(255,255,255,0.6)');
				} else if(f.kind === 'fall'){
					kxIcePoly(fx, fy, 11, f.y * 0.02, 'rgba(210,240,255,0.92)', 'rgba(255,255,255,0.55)');
				}
			}
			for(let i = 0; i < kx.reactFX.length; i++){
				const r = kx.reactFX[i], a = r.t / r.max;
				ctx.strokeStyle = 'rgba(200,236,255,' + (0.65 * a) + ')'; ctx.lineWidth = 4;
				ctx.strokeRect(r.x - camx, r.y - camy, r.w, r.h);
				kxGlow(r.x - camx + r.w / 2, r.y - camy + r.h / 2, 36, 'rgba(180,230,255,' + (0.25 * a) + ')', 'rgba(80,150,210,0)');
			}
			if(en._kxCoreOpen){
				const hx = en.x + en.w / 2 - camx, hy = en.y + en.h * 0.42 - camy;
				kxGlow(hx, hy, 70 + Math.sin(pulse * 3) * 8, 'rgba(230,248,255,0.45)', 'rgba(100,180,230,0)');
				ctx.strokeStyle = 'rgba(230,248,255,0.92)'; ctx.lineWidth = 4;
				ctx.strokeRect(en.x - camx - 10, en.y - camy - 10, en.w + 20, en.h + 20);
			}
			if(kx.atk && kx.atk.name === 'wave' && kx.atk.t > 22 && kx.atk.ax){
				const wx = en.x + en.w / 2 - camx, wy = en.y + en.h - 8 - camy;
				ctx.strokeStyle = 'rgba(210,244,255,0.95)'; ctx.lineWidth = 14;
				ctx.beginPath(); ctx.arc(wx, wy, kx.atk.ax, 0, Math.PI * 2); ctx.stroke();
				ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 5;
				ctx.beginPath(); ctx.arc(wx, wy, kx.atk.ax, 0, Math.PI * 2); ctx.stroke();
			}
			if(kx.atk && kx.atk.name === 'charge' && kx.atk.t >= 20 && kx.atk.t < 68){
				const cx = en.x + en.w / 2 - camx, cy = en.y + en.h * 0.55 - camy;
				ctx.strokeStyle = 'rgba(200,236,255,0.55)'; ctx.lineWidth = 8;
				ctx.beginPath(); ctx.moveTo(cx - (en.facing || 1) * 80, cy); ctx.lineTo(cx + (en.facing || 1) * (en.w * 0.55), cy); ctx.stroke();
			}
		}
	}

	function drawKryonaxFallback(en){
		const camx = camera.x, camy = camera.y;
		const ex = en.x - camx, ey = en.y - camy;
		const cx = ex + en.w / 2, gy = ey + en.h;
		const t = en.animTimer || 0;
		const kx = en._kx;
		const phase = (kx && kx.phase) || en.bossPhase || 1;
		const breathe = Math.sin(t * 0.03) * 5;
		const lean = (en.facing === -1 ? -1 : 1);
		const cracked = phase >= 2;
		const core = phase >= 3 || !!(en._kxCoreOpen);
		ctx.save();
		if(en.facing === -1){ ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); }
		ctx.fillStyle = 'rgba(170,220,255,0.12)';
		ctx.beginPath(); ctx.ellipse(cx, gy - 6, en.w * 0.42, 12, 0, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = en.flash > 0 ? '#99c8ee' : (cracked ? '#2a3d58' : '#3a5878');
		ctx.beginPath();
		ctx.moveTo(cx - en.w * 0.38, ey + en.h * 0.38 + breathe);
		ctx.lineTo(cx - en.w * 0.46, gy - en.h * 0.18);
		ctx.lineTo(cx - en.w * 0.22, gy);
		ctx.lineTo(cx + en.w * 0.22, gy);
		ctx.lineTo(cx + en.w * 0.46, gy - en.h * 0.18);
		ctx.lineTo(cx + en.w * 0.40, ey + en.h * 0.32 + breathe);
		ctx.lineTo(cx + en.w * 0.18, ey + en.h * 0.12 + breathe);
		ctx.lineTo(cx - en.w * 0.08, ey + 8 + breathe);
		ctx.lineTo(cx - en.w * 0.28, ey + en.h * 0.16 + breathe);
		ctx.closePath(); ctx.fill();
		ctx.fillStyle = cracked ? '#1a2434' : '#2a4060';
		ctx.fillRect(cx - en.w * 0.20, gy - en.h * 0.42, en.w * 0.16, en.h * 0.42);
		ctx.fillRect(cx + en.w * 0.04, gy - en.h * 0.40, en.w * 0.16, en.h * 0.40);
		ctx.fillStyle = en.flash > 0 ? '#cceeff' : '#6aa0c8';
		ctx.beginPath();
		ctx.moveTo(cx - en.w * 0.48, ey + en.h * 0.28);
		ctx.lineTo(cx - en.w * 0.22, ey + en.h * 0.08);
		ctx.lineTo(cx - en.w * 0.10, ey + en.h * 0.22);
		ctx.lineTo(cx - en.w * 0.36, ey + en.h * 0.42);
		ctx.closePath(); ctx.fill();
		ctx.beginPath();
		ctx.moveTo(cx + en.w * 0.10, ey + en.h * 0.16);
		ctx.lineTo(cx + en.w * 0.46, ey + en.h * 0.10);
		ctx.lineTo(cx + en.w * 0.50, ey + en.h * 0.36);
		ctx.lineTo(cx + en.w * 0.22, ey + en.h * 0.40);
		ctx.closePath(); ctx.fill();
		const atk = kx && kx.atk && kx.atk.name;
		let arm = 0;
		if(atk === 'fist') arm = Math.min(1, (kx.atk.t || 0) / 36);
		ctx.save();
		ctx.translate(cx + lean * en.w * 0.28, ey + en.h * 0.30);
		ctx.rotate((-1.1 + arm * 1.6) * (en.facing === -1 ? -1 : 1));
		ctx.fillStyle = '#8ec4e0';
		ctx.fillRect(-18, 0, 36, en.h * 0.38);
		ctx.fillRect(-28, en.h * 0.34, 56, 36);
		ctx.restore();
		if(core){
			const g = ctx.createRadialGradient(cx, ey + en.h * 0.42, 4, cx, ey + en.h * 0.42, 70);
			g.addColorStop(0, 'rgba(180,240,255,0.95)');
			g.addColorStop(1, 'rgba(40,100,180,0)');
			ctx.fillStyle = g;
			ctx.beginPath(); ctx.arc(cx, ey + en.h * 0.42, 70, 0, Math.PI * 2); ctx.fill();
		} else {
			ctx.strokeStyle = 'rgba(160,220,255,0.55)'; ctx.lineWidth = 2;
			for(let i = 0; i < 4; i++){
				ctx.beginPath();
				ctx.moveTo(cx - 30 + i * 18, ey + en.h * 0.28);
				ctx.lineTo(cx - 20 + i * 16, ey + en.h * 0.62);
				ctx.stroke();
			}
		}
		ctx.fillStyle = 'rgba(230,248,255,0.35)';
		ctx.fillRect(cx - 8, ey + 18 + breathe, 18, 22);
		ctx.restore();
		return true;
	}

	const KX_COLS = 6, KX_ROWS = 4;
	const KX_FPS = (typeof SPRITE_FPS === 'number') ? SPRITE_FPS : 8;
	const _kxPunched = {};
	function kxSheets(){ return (typeof KRYONAX_SHEETS !== 'undefined') ? KRYONAX_SHEETS : null; }
	function kxPunchSheet(img){
		if(!img || !img.complete || !img.naturalWidth || typeof document === 'undefined') return img;
		const key = img.src || '';
		if(_kxPunched[key]) return _kxPunched[key];
		const el = document.createElement('canvas');
		let w = img.naturalWidth, h = img.naturalHeight;
		if(w > 1536){ h = Math.round(h * 1536 / w); w = 1536; }
		el.width = w;
		el.height = h;
		const g = el.getContext('2d');
		g.imageSmoothingEnabled = true;
		g.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, 0, 0, w, h);
		try{
			const id = g.getImageData(0, 0, el.width, el.height);
			const d = id.data;
			for(let i = 0; i < d.length; i += 4){
				const r = d[i], gb = d[i + 1], b = d[i + 2];
				const mx = r > gb ? (r > b ? r : b) : (gb > b ? gb : b);
				const mn = r < gb ? (r < b ? r : b) : (gb < b ? gb : b);
				const white = r >= 248 && gb >= 248 && b >= 248;
				const checker = (mx - mn) < 14 && r > 70 && r < 242 && b <= r + 6;
				if(white || checker) d[i + 3] = 0;
			}
			g.putImageData(id, 0, 0);
		}catch(e){}
		_kxPunched[key] = el;
		return el;
	}
	function kxPickAnim(en){
		const kx = en._kx;
		if(en.dead) return { sheet:'A', row:3, once:true };
		const atk = kx && kx.atk && kx.atk.name;
		if(atk === 'fist') return { sheet:'B', row:0 };
		if(atk === 'wave') return { sheet:'B', row:1 };
		if(atk === 'sweep') return { sheet:'B', row:2 };
		if(atk === 'grasp') return { sheet:'B', row:3 };
		if(atk === 'charge') return { sheet:'C', row:0 };
		if(atk === 'roar') return { sheet:'C', row:1 };
		if(atk === 'meteor') return { sheet:'C', row:2 };
		if(atk === 'tremor' || atk === 'heart') return { sheet:'C', row:3 };
		if(kx && (kx.vulnerable > 0 || kx.stance === 'recover' || kx.stance === 'brace')) return { sheet:'A', row:2 };
		if(kx && (kx.stance === 'walk' || kx.stance === 'close' || Math.abs(kx.vx || 0) > 0.45)) return { sheet:'A', row:1 };
		return { sheet:'A', row:0 };
	}
	function drawKryonaxSprite(en){
		const sheets = kxSheets();
		const pick = kxPickAnim(en);
		const raw = sheets && sheets[pick.sheet];
		if(!raw || !raw.complete || !raw.naturalWidth) return drawKryonaxFallback(en);
		const img = kxPunchSheet(raw);
		if(!img) return drawKryonaxFallback(en);
		const fW = (img.width || img.naturalWidth) / KX_COLS;
		const fH = (img.height || img.naturalHeight) / KX_ROWS;
		const key = pick.sheet + ':' + pick.row;
		if(en._kxSprLast !== key){
			en._kxSprLast = key; en._kxSprFrame = 0; en._kxSprTimer = 0;
		}
		en._kxSprTimer = (en._kxSprTimer || 0) + 1;
		if(en._kxSprTimer >= KX_FPS){
			en._kxSprTimer = 0;
			if(pick.once){ if((en._kxSprFrame || 0) < KX_COLS - 1) en._kxSprFrame++; }
			else en._kxSprFrame = ((en._kxSprFrame || 0) + 1) % KX_COLS;
		}
		const frame = Math.min(en._kxSprFrame || 0, KX_COLS - 1);
		const bleed = 1;
		const sx = frame * fW + bleed, sy = pick.row * fH + bleed;
		const sw = fW - bleed * 2, sh = fH - bleed * 2;
		const dest = (typeof enemySpriteDestSize === 'function')
			? enemySpriteDestSize(en, sw, sh)
			: { rW: en.w * 1.2, rH: en.h * 1.2 };
		const rW = dest.rW, rH = dest.rH;
		const camx = (typeof camera !== 'undefined') ? camera.x : 0;
		const camy = (typeof camera !== 'undefined') ? camera.y : 0;
		const ex = en.x - camx, ey = en.y - camy;
		const cx = ex + en.w / 2;
		ctx.save();
		if(en.flash > 0) ctx.filter = 'brightness(2.5) saturate(0.3)';
		else if(en._kxCoreOpen) ctx.filter = 'brightness(1.25) saturate(1.15)';
		if(en.facing === -1){
			ctx.translate(cx, ey + en.h - rH / 2);
			ctx.scale(-1, 1);
			ctx.drawImage(img, sx, sy, sw, sh, -rW / 2, -rH / 2, rW, rH);
		} else {
			ctx.drawImage(img, sx, sy, sw, sh, cx - rW / 2, ey + en.h - rH, rW, rH);
		}
		ctx.restore();
		return true;
	}

	global.updateKryonax = updateKryonax;
	global.drawKryonaxWorld = drawKryonaxWorld;
	global.drawKryonaxProj = drawKryonaxProj;
	global.drawKryonaxSprite = drawKryonaxSprite;
	global.kryonaxOnEnemyHit = kryonaxOnEnemyHit;
})(typeof window !== 'undefined' ? window : globalThis);
