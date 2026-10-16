/* =============================================================
   Frostbound Knight — Ice Dungeon mini-boss.
   Precise warrior: attack → recover (punish) → observe.
   ============================================================= */
(function(global){
	const ICE = ['#cceeff', '#88d6ff', '#ffffff'];
	function fkRoom(en){
		const rooms = (typeof dungeon !== 'undefined' && dungeon && dungeon.rooms) || [];
		if(en.roomId != null && rooms[en.roomId]) return rooms[en.roomId];
		const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
		for(let i = 0; i < rooms.length; i++){
			const r = rooms[i];
			if(cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) return r;
		}
		return null;
	}
	function fkPx(){ return player.x + player.w / 2; }
	function fkPy(){ return player.y + player.h / 2; }
	function fkIn(x, y, w, h){ return player.x + player.w > x && player.x < x + w && player.y + player.h > y && player.y < y + h; }
	function fkInCirc(cx, cy, r){ return Math.hypot(fkPx() - cx, fkPy() - cy) < r; }
	function fkHit(dmg, extra){
		if(player.iFrames > 0) return false;
		damagePlayer(Math.round(dmg * ((typeof DIFF_DMG_MULT === 'number') ? DIFF_DMG_MULT : 1)), extra || ['freeze']);
		return true;
	}
	function fkDist(en){ return Math.hypot(fkPx() - (en.x + en.w / 2), fkPy() - (en.y + en.h / 2)); }
	function fkCorePlat(room){
		const plats = (typeof dungeon !== 'undefined' && dungeon && dungeon.platforms) || [];
		let core = null, best = null, bestD = 1e9;
		const cx = room.x + room.w * 0.5;
		for(let i = 0; i < plats.length; i++){
			const p = plats[i];
			if(!p || p._gone || p.roomId !== room.id) continue;
			if(p.y < room.y + 80 || p.y > room.y + room.h - 40) continue;
			if(p.arenaSection === 'core'){ core = p; break; }
			const d = Math.abs(p.x + p.w * 0.5 - cx);
			if(d < bestD){ best = p; bestD = d; }
		}
		return core || best;
	}
	function fkArenaTop(en, room){
		const plat = fkCorePlat(room);
		return plat ? plat.y : (room.y + room.h - 240);
	}
	function fkGround(en, room){ return fkArenaTop(en, room) - en.h; }
	function fkPlantCenter(en, room){
		const plat = fkCorePlat(room);
		if(plat){
			en.x = plat.x + plat.w * 0.5 - en.w / 2;
			en.y = plat.y - en.h;
		} else {
			en.x = room.x + room.w * 0.5 - en.w / 2;
			en.y = fkGround(en, room);
		}
		fkClamp(en, room);
	}
	function fkPlayerInCourt(room){
		if(typeof player === 'undefined' || !room) return false;
		return player.x + player.w > room.x + 8 && player.x < room.x + room.w - 8 &&
			player.y + player.h > room.y + 8 && player.y < room.y + room.h - 8;
	}
	function frostboundKnightDormant(en){
		if(!en || en.type !== 'frostboundKnight') return false;
		if(en.isNecroSummon || en.necroFriendly) return false;
		const fk = en._fk;
		if(!fk || fk.waiting || !fk.arrived){
			const room = fkRoom(en);
			if(!room) return true;
			return !fkPlayerInCourt(room);
		}
		return false;
	}
	function frostboundOnEnemyHit(en){
		return frostboundKnightDormant(en) ? 0 : 1;
	}
	function fkBanner(t){
		if(typeof DungeonEnv !== 'undefined' && DungeonEnv.showBanner) DungeonEnv.showBanner(t);
		else if(typeof showBanner === 'function') showBanner(t);
		if(typeof notify === 'function') notify(t);
	}
	function fkShake(a, b){ if(typeof shakeScreen === 'function') shakeScreen(a, b); }
	function fkPart(x, y, n){
		if(typeof particles === 'undefined') return;
		for(let i = 0; i < n; i++){
			particles.push({
				x: x + (Math.random() - 0.5) * 48, y: y + (Math.random() - 0.5) * 28,
				vx: (Math.random() - 0.5) * 5.2, vy: -1.6 - Math.random() * 3.8,
				life: 20 + Math.random() * 22, color: ICE[i % 3],
			});
		}
	}
	function fkSword(en){ return { x: en.x + en.w / 2 + (en.facing || 1) * 44, y: en.y + 34 }; }
	function fkTel(x, y, w, h, frames, label, type){
		if(typeof spawnTelegraph === 'function') spawnTelegraph(x, y, w, h, frames, 'rgba(170,230,255,0.52)', type || 'rect', label || '');
	}
	function fkProj(x, y, vx, vy, opts){
		if(typeof spawnEnemyProj !== 'function') return null;
		opts = opts || {};
		const p = spawnEnemyProj(x, y, vx, vy, {
			color: '#88d6ff', color2: '#e8f7ff', power: opts.power || 28,
			width: opts.w || 22, height: opts.h || 22, shape: opts.shape || 'circle',
			effects: ['freeze'], trail: 'ice', maxAge: opts.age || 190, noWallCollide: true,
		});
		if(p){ p._fkStyle = opts.style || 'shard'; p._fkSlow = opts.slow || 0; p._fkMinSpd = opts.minSpd || 0; }
		return p;
	}
	function fkFace(en){
		const dx = fkPx() - (en.x + en.w / 2);
		if(Math.abs(dx) > 8) en.facing = dx > 0 ? 1 : -1;
		return en.facing || 1;
	}
	function fkClamp(en, room){
		if(en.x < room.x + 24) en.x = room.x + 24;
		if(en.x + en.w > room.x + room.w - 24) en.x = room.x + room.w - 24 - en.w;
		en.y = fkGround(en, room);
	}
	function fkAngNorm(a){ while(a > Math.PI) a -= Math.PI * 2; while(a < -Math.PI) a += Math.PI * 2; return a; }
	function fkInGap(ang, gaps, half){
		for(let i = 0; i < gaps.length; i++) if(Math.abs(fkAngNorm(ang - gaps[i])) < half) return true;
		return false;
	}
	function fkInSafe(fk){
		for(let i = 0; i < (fk.safe || []).length; i++) if(fkInCirc(fk.safe[i].cx, fk.safe[i].cy, fk.safe[i].r + 6)) return true;
		return false;
	}
	function fkBoxHit(en, x, y, w, h){ return x < en.x + en.w && x + w > en.x && y < en.y + en.h && y + h > en.y; }
	function fkLaunch(cx, cy, r, ang, spd, style){
		const sx = cx + Math.cos(ang) * r, sy = cy + Math.sin(ang) * r * 0.7;
		const dx = fkPx() - sx, dy = fkPy() - sy, d = Math.max(20, Math.hypot(dx, dy));
		fkProj(sx, sy, dx / d * spd, dy / d * spd, { power: 24, w: 26, h: 26, age: 200, style: style || 'shard', shape: 'spike' });
	}

	function fkInit(en, room){
		const fk = en._fk = {
			stance:'walk', phase:1, atk:null, cd:70, intro:140, vulnerable:0,
			zones:[], fx:[], combo:null, comboI:0, vx:0, observe:0, shards:[],
			wave:null, safe:[], land:null, line:null, prison:null, didHit:false,
			countered:false, pathX: room.x + room.w * 0.5 - 110, pathW:220, deadDone:false,
			waiting:true, arrived:false,
		};
		en.bossPhase = 1;
		en._countering = false;
		en._fkDormant = true;
		fkPlantCenter(en, room);
		return fk;
	}
	function fkOnDeath(en){
		if(!en._fk || en._fk.deadDone) return;
		en._fk.deadDone = true;
		en._countering = false;
		if(typeof DungeonEnv !== 'undefined' && DungeonEnv.modifiers) DungeonEnv.modifiers.knightSlain = true;
		fkBanner('FROSTBOUND KNIGHT — fallen. A frostborn core waits in the stillness.');
		if(typeof DungeonEnv !== 'undefined' && DungeonEnv.showBanner){
			DungeonEnv.showBanner('Frostborn Core — claim its stillness, or leave it in the ice.');
		}
	}
	function fkPad(fk, x, y, w, h, life, dmg, slow){
		fk.zones.push({ kind:'rect', x:x, y:y, w:w, h:h, life:life, hot:true, dmg:dmg, slow:slow, tick:16, floor:true });
	}
	function fkPhase(en, fk, room){
		const hpR = en.maxHp ? en.hp / en.maxHp : 1;
		if(hpR <= 0.70 && fk.phase < 2){
			fk.phase = 2; en.bossPhase = 2; en.bossPhaseTransition = 110;
			fkBanner('THE HALL GROWS STILL'); fkShake(12, 24);
			const gy = room.y + room.h - 22;
			fkPad(fk, room.x + 12, gy, Math.max(80, fk.pathX - room.x - 16), 22, 9999, 8, 50);
			fkPad(fk, fk.pathX + fk.pathW, gy, Math.max(80, room.x + room.w - 16 - fk.pathX - fk.pathW), 22, 9999, 8, 50);
			const ph = Math.min(room.h * 0.42, 168), py = room.y + room.h - ph;
			fk.zones.push({ kind:'pillar', x: room.x + room.w * 0.20 - 18, y: py, w: 36, h: ph, life: 9999, hot: true, dmg: 10, slow: 55 });
			fk.zones.push({ kind:'pillar', x: room.x + room.w * 0.80 - 18, y: py, w: 36, h: ph, life: 9999, hot: true, dmg: 10, slow: 55 });
			const plats = (typeof dungeon !== 'undefined' && dungeon.platforms) || [];
			let n = 0;
			for(let i = 0; i < plats.length && n < 2; i++){
				const p = plats[i];
				if(p.roomId !== room.id || p.central || p.perch || p._gone) continue;
				if(p.kind !== 'collapse' && p.kind !== 'pillar') continue;
				if(typeof DungeonEnv !== 'undefined' && DungeonEnv.breakPlatform) DungeonEnv.breakPlatform(p);
				else p._gone = true;
				n++;
			}
		}
		if(hpR <= 0.35 && fk.phase < 3){
			fk.phase = 3; en.bossPhase = 3; en.bossPhaseTransition = 120;
			fkBanner('WINTER CLAIMS THE FLOOR'); fkShake(14, 28);
			fk.pathW = 168;
			fkPad(fk, room.x + 12, room.y + room.h - 30, Math.max(60, (fk.pathX - room.x) * 0.55), 16, 9999, 6, 40);
			fk.combo = ['arc', 'step', 'execution']; fk.comboI = 0;
		}
	}
	function fkTick(fk){
		if(typeof enemyProjectiles !== 'undefined'){
			for(let i = 0; i < enemyProjectiles.length; i++){
				const p = enemyProjectiles[i];
				if(!p._fkSlow) continue;
				p.vx *= p._fkSlow; p.vy *= p._fkSlow;
				const s = Math.hypot(p.vx, p.vy), min = p._fkMinSpd || 1.5;
				if(s > 0.01 && s < min){ p.vx *= min / s; p.vy *= min / s; }
			}
		}
		for(let i = fk.fx.length - 1; i >= 0; i--){ if(--fk.fx[i].life <= 0) fk.fx.splice(i, 1); }
		for(let i = fk.zones.length - 1; i >= 0; i--){
			const z = fk.zones[i];
			if(z.life < 9000) z.life--;
			const inside = z.kind === 'circ' ? fkInCirc(z.cx, z.cy, z.r) : z.kind === 'ring' || z.kind === 'pillar' || z.kind === 'rect' ? (z.kind === 'ring' ? false : fkIn(z.x, z.y, z.w, z.h)) : false;
			if(z.kind === 'ring' && z.hot){
				const d = Math.hypot(fkPx() - z.cx, fkPy() - z.cy);
				const ang = Math.atan2(fkPy() - z.cy, fkPx() - z.cx);
				if(Math.abs(d - z.r) < 20 && !fkInGap(ang, z.gaps, z.gapW)) fkHit(z.dmg || 26);
			} else if(inside && z.hot && !fkInSafe(fk)){
				if(z.dmg && (!z.tick || z.life % z.tick === 0)) fkHit(z.dmg);
				if(z.slow) player.slowTimer = Math.max(player.slowTimer || 0, z.slow);
				if(player._iceDrag != null) player._iceDrag = Math.max(player._iceDrag || 0, 0.35);
			}
			if(z.life <= 0) fk.zones.splice(i, 1);
		}
	}
	function fkDrive(en, fk, room, mode){
		const dx = fkPx() - (en.x + en.w / 2);
		const face = dx >= 6 ? 1 : dx <= -6 ? -1 : (en.facing || 1);
		fk.stance = mode;
		if(mode === 'walk'){
			fk.observe++;
			fk.vx = (fk.observe % 88 < 52 && Math.abs(dx) > 90) ? face * 1.7 : fk.vx * 0.78;
			en.facing = face;
		} else if(mode === 'combatWalk'){ fk.vx = face * 2.5; en.facing = face; }
		else if(mode === 'recovery') fk.vx *= 0.78;
		else if(mode === 'defensive'){ fk.vx *= 0.55; en.facing = face; }
		en.x += fk.vx;
		fkClamp(en, room);
	}
	function fkPick(en, fk){
		if(fk.combo && fk.comboI < fk.combo.length) return fk.combo[fk.comboI++];
		fk.combo = null;
		if(fk.phase >= 2 && Math.random() < 0.40){
			const combos = [['arc','step','execution'], ['march','wave','arc'], ['prison','step','arc']];
			if(fk.phase >= 3) combos.push(['orbit','requiem']);
			fk.combo = combos[Math.floor(Math.random() * combos.length)];
			fk.comboI = 1;
			return fk.combo[0];
		}
		const d = fkDist(en), pool = ['arc','step','lance','counter','march'];
		if(fk.phase >= 2){ pool.push('execution','wave','prison','orbit','shatterstep'); if(d > 260) pool.push('execution','lance'); if(d < 180) pool.push('counter','wave'); }
		if(fk.phase >= 3) pool.push('requiem','execution','shatterstep');
		return pool[Math.floor(Math.random() * pool.length)];
	}
	const BANNERS = {
		arc:'The blade gathers frost.', step:'He vanishes into the snow.', lance:'Shards take orbit.',
		counter:'COUNTER', march:"Winter's March", execution:'The line is drawn.',
		wave:'The ice will split — find the gap.', prison:'Leave the circle.',
		orbit:'The court of ice turns.', requiem:"Winter's Requiem — stand in the still circles.",
		shatterstep:'Shatterstep.',
	};
	function fkStart(en, name){
		const fk = en._fk;
		fk.atk = { name:name, t:0, n:0, si:0, lt:0 };
		fk.didHit = fk.countered = false;
		fk.land = fk.line = fk.prison = fk.wave = null;
		fk.shards = []; fk.safe = [];
		en._countering = false;
		en.attackAnimTimer = 48;
		if(BANNERS[name]) fkBanner(BANNERS[name]);
	}
	function fkEnd(en, cd, vuln){
		const fk = en._fk;
		fk.atk = null; fk.cd = cd || 62; fk.stance = 'recovery';
		en._countering = false;
		if(vuln) fk.vulnerable = vuln;
		if(fk.combo && fk.comboI >= fk.combo.length){
			fk.combo = null; fk.vulnerable = Math.max(fk.vulnerable, 96);
			fkBanner('His guard drops — strike!');
		}
	}
	function fkNearLand(en, room){
		const px = fkPx();
		let side = Math.random() < 0.5 ? 1 : -1;
		if(px + side * 110 < room.x + 50 || px + side * 110 > room.x + room.w - 50) side = -side;
		let lx = px + side * (96 + Math.random() * 44);
		if(Math.abs(lx - px) < 78) lx = px + side * 110;
		return { x: Math.max(room.x + 40, Math.min(room.x + room.w - 40 - en.w, lx - en.w / 2)), y: fkGround(en, room) };
	}
	function fkFireCrescent(en, fk){
		const sw = fkSword(en);
		const dx = fkPx() - sw.x, dy = fkPy() - sw.y, d = Math.max(40, Math.hypot(dx, dy));
		fkProj(sw.x, sw.y, dx / d * 16.4, dy / d * 16.4, { power: 32 + fk.phase * 4, w: 78, h: 40, age: 230, style: 'crescent', slow: 0.968, minSpd: 2.4, shape: 'blade' });
		fk.fx.push({ kind:'arc', x:sw.x, y:sw.y, r:56, dir:en.facing || 1, life:18, max:18 });
		fk.fx.push({ kind:'slash', x:sw.x, y:sw.y, r:70, dir:en.facing || 1, life:14, max:14 });
		fkPart(sw.x, sw.y, 12);
	}
	function fkDoStepLand(en, room, fk){
		en.x = fk.land.x; en.y = fk.land.y; fkClamp(en, room); fkFace(en);
		const sw = fkSword(en), dir = en.facing || 1;
		if(fkIn(en.x - 28, en.y - 8, en.w + 56, en.h + 16)) fkHit(30, ['freeze', 'horizontalLaunch']);
		fkPad(fk, sw.x - (dir > 0 ? 10 : 210), en.y + en.h - 16, 220, 16, 180, 10, 60);
		fk.fx.push({ kind:'crack', x:sw.x, y:en.y + en.h, r:70, life:20, max:20 });
		fkShake(6, 10); fkPart(sw.x, en.y + en.h, 14);
	}
	function fkCounterCheck(en){
		if(typeof projectiles !== 'undefined'){
			for(let i = 0; i < projectiles.length; i++){
				const p = projectiles[i];
				if(!p || p.hasHit) continue;
				const pw = p.width || p.w || 12, ph = p.height || p.h || 12;
				if(fkBoxHit(en, p.x - pw / 2, p.y - ph / 2, pw, ph)) return true;
			}
		}
		if(typeof warriorSlashes !== 'undefined'){
			for(let i = 0; i < warriorSlashes.length; i++){
				const s = warriorSlashes[i];
				if(fkBoxHit(en, s.x - (s.w || 40) / 2, s.y - (s.h || 20) / 2, s.w || 40, s.h || 20)) return true;
			}
		}
		const swinging = (player.attackAnimTimer || 0) > 0 || (player.castTimer || 0) > 0 || (typeof warriorSlashes !== 'undefined' && warriorSlashes.length);
		return swinging && fkIn(en.x - 8, en.y - 6, en.w + 16, en.h + 12);
	}
	function fkShock(en, fk, r, dmg){
		const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
		if(fkInCirc(cx, cy, r)) fkHit(dmg, ['freeze']);
		fk.zones.push({ kind:'circ', cx:cx, cy:cy, r:r, life:18, hot:true, dmg:Math.round(dmg * 0.55) });
		fk.fx.push({ kind:'ring', x:cx, y:cy, r:30, life:26, max:26 });
		fk.fx.push({ kind:'burst', x:cx, y:cy, r:r * 0.35, life:18, max:18 });
		fkShake(10, 16); fkPart(cx, cy, 16);
	}

	function runAtk(en, room, fk){
		const a = fk.atk; a.t++;
		const cx = en.x + en.w / 2, cy = en.y + en.h * 0.45, ph = fk.phase, ground = room.y + room.h;

		if(a.name === 'arc'){
			fkDrive(en, fk, room, 'defensive'); fkFace(en);
			const sw = fkSword(en);
			if(a.t === 1) fkTel(sw.x - 28, sw.y - 80, 56, 110, 36, 'ARC');
			if(a.t < 36){ fkPart(sw.x, sw.y - 20, 3); if(a.t % 5 === 0) fk.fx.push({ kind:'glow', x:sw.x, y:sw.y, r:16 + a.t * 0.55, life:10, max:10 }); }
			if(a.t === 36) fkFireCrescent(en, fk);
			if(ph >= 2 && a.t === 58) fkFireCrescent(en, fk);
			if(ph >= 3 && a.t === 84) fkFireCrescent(en, fk);
			if(a.t > (ph >= 3 ? 128 : ph >= 2 ? 104 : 86)) fkEnd(en, 58, 42);

		} else if(a.name === 'step' || a.name === 'shatterstep'){
			if(a.name === 'shatterstep' && !a.n) a.n = 2 + (Math.random() < 0.5 ? 1 : 0);
			const need = a.name === 'shatterstep' ? a.n : 1;
			a.lt++;
			if(a.lt === 1){ fk.vx *= 0.5; fk.land = fkNearLand(en, room); fkPart(cx, en.y + en.h, 6); }
			if(a.lt < 20){ en.y = fkGround(en, room) + 6; fkPart(en.x + 10, en.y + en.h, 1); }
			if(a.lt === 20){
				fkTel(fk.land.x - 8, fk.land.y + en.h - 10, en.w + 16, 14, 18, '');
				fk.fx.push({ kind:'mark', x:fk.land.x + en.w / 2, y:fk.land.y + en.h, r:28, life:18, max:18 });
			}
			if(a.lt === 38) fkDoStepLand(en, room, fk);
			if(a.lt > 54){ a.si++; a.lt = 0; if(a.si >= need) fkEnd(en, a.name === 'shatterstep' ? 88 : 54, a.name === 'shatterstep' ? 70 : 36); }

		} else if(a.name === 'lance'){
			fkDrive(en, fk, room, 'defensive');
			const n = 4 + (ph >= 2 ? 1 : 0);
			if(a.t === 1) for(let i = 0; i < n; i++) fk.shards.push({ ang: i * Math.PI * 2 / n, r: 58, gone: false });
			for(let i = 0; i < fk.shards.length; i++) if(!fk.shards[i].gone) fk.shards[i].ang += 0.05;
			if(a.t >= 42 && (a.t - 42) % 14 === 0){
				const idx = ((a.t - 42) / 14) | 0;
				if(idx < fk.shards.length){ fk.shards[idx].gone = true; fkLaunch(cx, cy, fk.shards[idx].r, fk.shards[idx].ang, 11.4, 'shard'); }
			}
			if(a.t > 42 + n * 14 + 36) fkEnd(en, 60, 40);

		} else if(a.name === 'counter'){
			fkDrive(en, fk, room, 'defensive');
			en._countering = a.t <= 70 && !fk.countered;
			if(a.t === 1) fkTel(en.x - 16, en.y - 12, en.w + 32, en.h + 20, 70, 'COUNTER');
			if(en._countering && fkCounterCheck(en)){
				fk.countered = true; en._countering = false; fkBanner('COUNTER'); fkShock(en, fk, 280, 34); fkEnd(en, 70, 0); return;
			}
			if(a.t === 70 && !fk.countered){ en._countering = false; fkBanner('The guard falls — punish him.'); fkEnd(en, 20, 50); }

		} else if(a.name === 'march'){
			if(a.t <= 90){
				fkDrive(en, fk, room, 'combatWalk');
				if(a.t % 18 === 0){ fkPad(fk, en.x + 8, ground - 18, en.w - 16, 18, 200, 8, 55); fkPart(cx, ground - 8, 4); }
			} else {
				fkDrive(en, fk, room, 'recovery');
				if(a.t === 91){
					const dir = en.facing || 1;
					fkTel(cx + (dir > 0 ? 0 : -380), en.y + 8, 380, en.h, 8, 'SLASH');
					if(fkIn(cx + (dir > 0 ? 0 : -380), en.y, 380, en.h + 10)) fkHit(38, ['freeze', 'horizontalLaunch']);
					fk.fx.push({ kind:'arc', x:fkSword(en).x, y:fkSword(en).y, r:110, dir:dir, life:20, max:20 });
					fk.fx.push({ kind:'slash', x:fkSword(en).x, y:fkSword(en).y, r:120, dir:dir, life:14, max:14 });
					fkShake(10, 14); fkPart(fkSword(en).x, fkSword(en).y, 10);
				}
				if(a.t > 161) fkEnd(en, 70, 70);
			}

		} else if(a.name === 'execution'){
			if(a.t === 1){
				fk.line = { x0:cx, y0:cy, x1:fkPx(), y1:fkPy() };
				fkTel(Math.min(fk.line.x0, fk.line.x1) - 8, ground - 20, Math.abs(fk.line.x1 - fk.line.x0) + 16, 20, 32, 'EXECUTION');
			}
			if(a.t < 32){
				fkDrive(en, fk, room, 'defensive');
				fk.fx.push({ kind:'line', x0:cx, y0:cy, x1:fk.line.x1, y1:fk.line.y1, life:3, max:3 });
			} else if(a.t < 48){
				fk.stance = 'dash';
				fk.vx = Math.max(-13.8, Math.min(13.8, (fk.line.x1 - en.w / 2 - en.x) * 0.4));
				en.x += fk.vx; en.facing = fk.vx >= 0 ? 1 : -1; fkClamp(en, room);
				if(!fk.didHit && fkIn(en.x, en.y, en.w, en.h)){ fk.didHit = true; fkHit(40, ['freeze', 'horizontalLaunch']); }
			} else {
				fkDrive(en, fk, room, 'recovery');
				if(a.t === 48 && !fk.didHit) fkBanner('The dash misses — his footing breaks.');
				if(a.t > (fk.didHit ? 78 : 128)) fkEnd(en, 50, fk.didHit ? 20 : 80);
			}

		} else if(a.name === 'wave'){
			fkDrive(en, fk, room, 'defensive');
			if(a.t === 1){
				const face = en.facing > 0 ? 0 : Math.PI;
				fk.wave = { cx:cx, cy:ground - 8, r:36, gaps: ph >= 3 ? [face + 0.18, face + 2.25] : [face + 0.22, face + 2.15, face + 4.05], gapW:0.40 };
				fkTel(cx - 40, ground - 40, 80, 40, 28, 'WAVE', 'circle');
				fk.fx.push({ kind:'ring', x:cx, y:ground - 8, r:20, life:28, max:28 });
			}
			if(a.t > 28 && a.t < 112 && fk.wave){
				fk.wave.r += 6.8;
				const d = Math.hypot(fkPx() - fk.wave.cx, fkPy() - fk.wave.cy);
				const ang = Math.atan2(fkPy() - fk.wave.cy, fkPx() - fk.wave.cx);
				if(Math.abs(d - fk.wave.r) < 26 && !fkInGap(ang, fk.wave.gaps, fk.wave.gapW)) fkHit(28);
			}
			if(a.t > 128) fkEnd(en, 64, 44);

		} else if(a.name === 'prison'){
			if(a.t === 1){ fk.prison = { cx:fkPx(), cy:fkPy(), r:108 }; fkTel(fk.prison.cx - 108, fk.prison.cy - 108, 216, 216, 40, 'PRISON', 'circle'); fk.fx.push({ kind:'cage', x:fk.prison.cx, y:fk.prison.cy, r:108, life:48, max:48 }); }
			fkDrive(en, fk, room, a.t > 40 ? 'combatWalk' : 'defensive');
			if(a.t === 40 && fk.prison){
				if(fkInCirc(fk.prison.cx, fk.prison.cy, fk.prison.r)){
					fkHit(22, ['freeze']); player.slowTimer = Math.max(player.slowTimer || 0, 80);
					if(player._iceDrag != null) player._iceDrag = Math.max(player._iceDrag || 0, 0.62);
					fkBanner('Caught in the prison.');
				} else fkBanner('He steps through the empty frost.');
			}
			if(a.t > 78) fkEnd(en, 56, 38);

		} else if(a.name === 'orbit'){
			fkDrive(en, fk, room, 'walk');
			if(a.t === 1) for(let i = 0; i < 6; i++) fk.shards.push({ ang: i * Math.PI / 3, r: 74, gone: false });
			for(let i = 0; i < fk.shards.length; i++) if(!fk.shards[i].gone) fk.shards[i].ang += 0.038;
			if(a.t >= 36 && (a.t - 36) % 20 === 0){
				const idx = ((a.t - 36) / 20) | 0;
				if(idx < fk.shards.length){ fk.shards[idx].gone = true; fkLaunch(cx, cy, fk.shards[idx].r, fk.shards[idx].ang, 10.2, 'orbit'); }
			}
			if(a.t > 36 + 6 * 20 + 28) fkEnd(en, 58, 36);

		} else if(a.name === 'requiem'){
			fkDrive(en, fk, room, 'recovery');
			if(a.t === 1){
				const spots = [room.x + room.w * 0.22, room.x + room.w * 0.50, room.x + room.w * 0.76];
				let best = 0, bd = 1e9;
				for(let i = 0; i < 3; i++){ const d = Math.abs(spots[i] - fkPx()); if(d < bd){ bd = d; best = i; } }
				spots[best] += Math.max(-40, Math.min(40, fkPx() - spots[best]));
				fk.safe = spots.map(function(sx){ return { cx:sx, cy:ground - 18, r:54 }; });
				for(let i = 0; i < 3; i++) fkTel(fk.safe[i].cx - 54, fk.safe[i].cy - 54, 108, 108, 50, 'SAFE', 'circle');
				fk.fx.push({ kind:'glow', x:fkSword(en).x, y:fkSword(en).y + 40, r:36, life:50, max:50 });
				fk.fx.push({ kind:'ring', x:en.x + en.w / 2, y:en.y + en.h / 2, r:20, life:50, max:50 });
			}
			if(a.t > 8 && a.t < 50 && a.t % 6 === 0) fkPad(fk, room.x + 16, ground - 16, room.w - 32, 16, 8, 6, 35);
			if(a.t === 50){ if(!fkInSafe(fk)) fkHit(44, ['freeze']); fkShock(en, fk, 80, 16); }
			if(a.t > 96){ fk.safe = []; fkEnd(en, 80, 50); }
		} else fkEnd(en, 60, 30);
	}

	function updateFrostboundKnight(en){
		if(!en || en.type !== 'frostboundKnight') return false;
		if(en.isNecroSummon || en.necroFriendly) return false;
		if(typeof IS_DUNGEON === 'undefined' || !IS_DUNGEON || DUNGEON_TYPE !== 'ice') return false;
		const room = fkRoom(en);
		if(!room) return false;
		if(!en._fk) fkInit(en, room);
		const fk = en._fk;
		en.animTimer = (en.animTimer || 0) + 1;
		if(en.dead || en.hp <= 0){ fkOnDeath(en); return false; }
		if(fk.waiting && !fkPlayerInCourt(room)){
			fkPlantCenter(en, room);
			fk.vx = 0;
			en._fkDormant = true;
			if(en.maxHp && en.hp < en.maxHp) en.hp = en.maxHp;
			return true;
		}
		if(fk.waiting){
			fk.waiting = false;
			fk.arrived = true;
			en._fkDormant = false;
			fkPlantCenter(en, room);
			fkBanner('THE ICE REMEMBERS ITS WARRIORS');
			fkShake(8, 18);
		}
		fkTick(fk); fkPhase(en, fk, room);
		if(en.bossPhaseTransition > 0){
			en.bossPhaseTransition--; fk.vx *= 0.86; fkDrive(en, fk, room, 'recovery');
			fkPart(en.x + en.w / 2, en.y + 30, 4); return true;
		}
		if(fk.intro > 0){ fk.intro--; fkDrive(en, fk, room, 'walk'); if(fk.intro === 90) fkBanner('FROSTBOUND KNIGHT'); return true; }
		if(fk.vulnerable > 0){ fk.vulnerable--; fkDrive(en, fk, room, 'recovery'); return true; }
		if(fk.atk){ runAtk(en, room, fk); return true; }
		fk.cd--;
		if(fk.cd > 0){
			const d = fkDist(en);
			fkDrive(en, fk, room, d < 150 ? 'defensive' : (d < 320 && fk.cd < 28 ? 'combatWalk' : 'walk'));
			return true;
		}
		fkStart(en, fkPick(en, fk));
		return true;
	}

	function fkHex(c, a){
		if(typeof c === 'string' && c[0] === '#'){
			const n = parseInt(c.slice(1), 16);
			return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + (a == null ? 1 : a) + ')';
		}
		return c;
	}
	function fkGlow(x, y, r, inner, outer){
		const g = ctx.createRadialGradient(x, y, 1, x, y, r);
		g.addColorStop(0, inner); g.addColorStop(1, outer);
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
	}
	function drawFrostboundProj(p){
		const x = p.x - camera.x, y = p.y - camera.y, r = Math.max(p.width, p.height) * 0.58, ang = Math.atan2(p.vy, p.vx);
		ctx.save(); ctx.translate(x, y);
		if(p._fkStyle === 'crescent'){
			ctx.rotate(ang);
			fkGlow(0, 0, r * 2.1, 'rgba(210,240,255,0.35)', 'rgba(70,140,200,0)');
			ctx.beginPath(); ctx.arc(0, 0, r * 1.55, -1.12, 1.12); ctx.arc(-r * 0.48, 0, r * 1.05, 1.02, -1.02, true); ctx.closePath();
			const g = ctx.createLinearGradient(-r, 0, r * 1.6, 0);
			g.addColorStop(0, 'rgba(255,255,255,0.2)'); g.addColorStop(0.3, fkHex(p.color2 || '#e8f7ff', 0.98));
			g.addColorStop(0.72, fkHex(p.color || '#88d6ff', 0.92)); g.addColorStop(1, 'rgba(40,80,130,0)');
			ctx.fillStyle = g; ctx.fill();
			ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; ctx.stroke();
			ctx.restore(); return;
		}
		ctx.rotate(ang + (p.age || 0) * 0.1);
		fkGlow(0, 0, r * 1.6, 'rgba(210,240,255,0.4)', 'rgba(80,150,210,0)');
		const h = r * (p._fkStyle === 'orbit' ? 0.9 : 0.66);
		ctx.beginPath(); ctx.moveTo(r * 1.25, 0); ctx.lineTo(0, h); ctx.lineTo(-r * 0.78, 0); ctx.lineTo(0, -h); ctx.closePath();
		const g = ctx.createLinearGradient(-r, -r, r, r);
		g.addColorStop(0, 'rgba(255,255,255,0.98)'); g.addColorStop(0.45, fkHex(p.color2 || '#ddf4ff', 0.94)); g.addColorStop(1, fkHex(p.color || '#77c8ff', 0.85));
		ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(230,248,255,0.85)'; ctx.lineWidth = 1.8; ctx.stroke();
		ctx.restore();
	}
	function drawCirc(x, y, r, stroke, fill, lw){
		ctx.strokeStyle = stroke; ctx.fillStyle = fill; ctx.lineWidth = lw || 3;
		ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
	}
	function drawFrostboundWorld(){
		if(typeof IS_DUNGEON === 'undefined' || !IS_DUNGEON || DUNGEON_TYPE !== 'ice' || typeof enemies === 'undefined') return;
		let en = null;
		for(let i = 0; i < enemies.length; i++) if(enemies[i] && enemies[i].type === 'frostboundKnight' && !enemies[i].dead && enemies[i]._fk){ en = enemies[i]; break; }
		if(!en) return;
		const fk = en._fk, camx = camera.x, camy = camera.y;
		const t = (typeof performance !== 'undefined' ? performance.now() : Date.now()) * 0.001;
		for(let i = 0; i < fk.zones.length; i++){
			const z = fk.zones[i];
			if(z.kind === 'circ'){
				fkGlow(z.cx - camx, z.cy - camy, z.r, 'rgba(170,220,255,0.22)', 'rgba(80,150,210,0.02)');
				drawCirc(z.cx - camx, z.cy - camy, z.r, 'rgba(210,244,255,0.92)', 'rgba(140,200,255,0.2)', 4);
			} else if(z.kind === 'pillar'){
				const pg = ctx.createLinearGradient(0, z.y - camy, 0, z.y + z.h - camy);
				pg.addColorStop(0, 'rgba(220,244,255,0.22)'); pg.addColorStop(0.45, 'rgba(150,215,255,0.62)'); pg.addColorStop(1, 'rgba(70,120,170,0.5)');
				ctx.fillStyle = pg; ctx.fillRect(z.x - camx, z.y - camy, z.w, z.h);
				ctx.strokeStyle = 'rgba(230,248,255,0.7)'; ctx.lineWidth = 2; ctx.strokeRect(z.x - camx, z.y - camy, z.w, z.h);
			} else if(z.kind !== 'ring'){
				const gx = z.x - camx, gy = z.y - camy;
				const fg = ctx.createLinearGradient(gx, gy, gx, gy + z.h);
				fg.addColorStop(0, z.floor ? 'rgba(190,230,255,0.22)' : 'rgba(170,220,255,0.28)');
				fg.addColorStop(1, 'rgba(90,150,200,0.4)');
				ctx.fillStyle = fg; ctx.fillRect(gx, gy, z.w, z.h);
				ctx.strokeStyle = 'rgba(220,245,255,0.55)'; ctx.lineWidth = 1.5; ctx.strokeRect(gx, gy, z.w, z.h);
			}
		}
		if(fk.wave && fk.atk && fk.atk.name === 'wave' && fk.atk.t > 20){
			const wx = fk.wave.cx - camx, wy = fk.wave.cy - camy;
			ctx.strokeStyle = 'rgba(210,244,255,0.95)'; ctx.lineWidth = 14;
			ctx.beginPath(); ctx.arc(wx, wy, fk.wave.r, 0, Math.PI * 2); ctx.stroke();
			ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 5;
			ctx.beginPath(); ctx.arc(wx, wy, fk.wave.r, 0, Math.PI * 2); ctx.stroke();
			ctx.strokeStyle = 'rgba(6,14,28,0.78)'; ctx.lineWidth = 20;
			for(let g = 0; g < fk.wave.gaps.length; g++){
				ctx.beginPath(); ctx.arc(wx, wy, fk.wave.r, fk.wave.gaps[g] - fk.wave.gapW, fk.wave.gaps[g] + fk.wave.gapW); ctx.stroke();
			}
		}
		for(let i = 0; i < fk.fx.length; i++){
			const f = fk.fx[i], a = f.life / (f.max || 1);
			const fx = f.x - camx, fy = f.y - camy;
			if(f.kind === 'glow'){
				fkGlow(fx, fy, f.r * (0.7 + 0.5 * a), 'rgba(255,255,255,' + (0.75 * a) + ')', 'rgba(120,190,255,0)');
			} else if(f.kind === 'ring' || f.kind === 'burst'){
				ctx.strokeStyle = 'rgba(210,244,255,' + (0.88 * a) + ')'; ctx.lineWidth = 6;
				ctx.beginPath(); ctx.arc(fx, fy, (f.r || 30) + (1 - a) * 170, 0, Math.PI * 2); ctx.stroke();
				ctx.strokeStyle = 'rgba(255,255,255,' + (0.4 * a) + ')'; ctx.lineWidth = 2;
				ctx.beginPath(); ctx.arc(fx, fy, (f.r || 30) + (1 - a) * 140, 0, Math.PI * 2); ctx.stroke();
			} else if(f.kind === 'arc' || f.kind === 'slash'){
				ctx.strokeStyle = 'rgba(230,248,255,' + (0.95 * a) + ')'; ctx.lineWidth = f.kind === 'slash' ? 16 : 9;
				ctx.beginPath(); ctx.arc(fx, fy, f.r, f.dir > 0 ? -0.55 : Math.PI - 0.55, f.dir > 0 ? 1.2 : Math.PI + 1.2); ctx.stroke();
			} else if(f.kind === 'mark'){
				ctx.strokeStyle = 'rgba(220,245,255,' + (0.92 * a) + ')'; ctx.lineWidth = 4;
				ctx.beginPath(); ctx.ellipse(fx, fy, f.r, 12, 0, 0, Math.PI * 2); ctx.stroke();
				fkGlow(fx, fy, f.r, 'rgba(180,230,255,' + (0.28 * a) + ')', 'rgba(80,150,210,0)');
			} else if(f.kind === 'line'){
				ctx.strokeStyle = 'rgba(200,236,255,0.95)'; ctx.lineWidth = 6; ctx.setLineDash([12, 6]);
				ctx.beginPath(); ctx.moveTo(f.x0 - camx, f.y0 - camy); ctx.lineTo(f.x1 - camx, f.y1 - camy); ctx.stroke(); ctx.setLineDash([]);
			} else if(f.kind === 'crack'){
				ctx.strokeStyle = 'rgba(210,240,255,' + (0.85 * a) + ')'; ctx.lineWidth = 2.5;
				for(let k = 0; k < 4; k++){
					const ang = k * 1.4 + t * 2;
					ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + Math.cos(ang) * f.r * a, fy + Math.sin(ang) * f.r * 0.35 * a); ctx.stroke();
				}
			} else if(f.kind === 'cage'){
				const pr = f.r;
				ctx.strokeStyle = 'rgba(200,236,255,' + (0.55 + 0.4 * Math.sin(t * 10)) + ')'; ctx.lineWidth = 5;
				ctx.beginPath(); ctx.arc(fx, fy, pr, 0, Math.PI * 2); ctx.stroke();
				ctx.strokeStyle = 'rgba(230,248,255,' + (0.75 * a) + ')'; ctx.lineWidth = 3;
				for(let b = 0; b < 8; b++){
					const ang = b * Math.PI / 4;
					ctx.beginPath(); ctx.moveTo(fx + Math.cos(ang) * pr, fy + Math.sin(ang) * pr);
					ctx.lineTo(fx + Math.cos(ang + Math.PI) * pr, fy + Math.sin(ang + Math.PI) * pr); ctx.stroke();
				}
			}
		}
		const scx = en.x + en.w / 2, scy = en.y + en.h * 0.45;
		for(let i = 0; i < fk.shards.length; i++){
			const s = fk.shards[i]; if(s.gone) continue;
			const sx = scx + Math.cos(s.ang) * s.r - camx, sy = scy + Math.sin(s.ang) * s.r * 0.7 - camy;
			fkGlow(sx, sy, 16, 'rgba(210,240,255,0.45)', 'rgba(80,150,210,0)');
			ctx.fillStyle = '#e8f7ff';
			ctx.beginPath(); ctx.moveTo(sx, sy - 13); ctx.lineTo(sx + 9, sy); ctx.lineTo(sx, sy + 13); ctx.lineTo(sx - 9, sy); ctx.fill();
			ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.4; ctx.stroke();
		}
		if(fk.line && fk.atk && fk.atk.name === 'execution' && fk.atk.t < 48){
			ctx.strokeStyle = 'rgba(220,245,255,' + (0.65 + 0.3 * Math.sin(t * 14)) + ')'; ctx.lineWidth = 8;
			ctx.beginPath(); ctx.moveTo(scx - camx, scy - camy); ctx.lineTo(fk.line.x1 - camx, fk.line.y1 - camy); ctx.stroke();
			ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
			ctx.beginPath(); ctx.moveTo(scx - camx, scy - camy); ctx.lineTo(fk.line.x1 - camx, fk.line.y1 - camy); ctx.stroke();
		}
		if(fk.prison && fk.atk && fk.atk.name === 'prison' && fk.atk.t < 48){
			const px = fk.prison.cx - camx, py = fk.prison.cy - camy;
			fkGlow(px, py, fk.prison.r, 'rgba(150,210,255,0.16)', 'rgba(70,140,200,0)');
			drawCirc(px, py, fk.prison.r, 'rgba(200,236,255,' + (0.55 + 0.4 * Math.sin(t * 10)) + ')', 'rgba(120,190,255,0.16)', 5);
		}
		if(fk.safe && fk.atk && fk.atk.name === 'requiem'){
			for(let i = 0; i < fk.safe.length; i++){
				const s = fk.safe[i], pr = s.r + Math.sin(t * 8 + i) * 3;
				fkGlow(s.cx - camx, s.cy - camy, pr + 10, 'rgba(120,255,210,0.22)', 'rgba(40,160,140,0)');
				drawCirc(s.cx - camx, s.cy - camy, pr, 'rgba(140,255,220,0.95)', 'rgba(70,230,190,0.2)', 5);
			}
		}
		if(en._countering){
			const cr = 64 + Math.sin(t * 8) * 5;
			fkGlow(scx - camx, en.y + en.h / 2 - camy, cr + 12, 'rgba(200,240,255,0.28)', 'rgba(80,150,210,0)');
			drawCirc(scx - camx, en.y + en.h / 2 - camy, cr, 'rgba(230,248,255,0.95)', 'rgba(160,220,255,0.2)', 6);
		}
		if(fk.vulnerable > 0){ ctx.strokeStyle = 'rgba(220,245,255,0.88)'; ctx.lineWidth = 4; ctx.strokeRect(en.x - camx - 8, en.y - camy - 8, en.w + 16, en.h + 16); }
	}

	const FK_COLS = 8, FK_ROWS = 6, FK_FPS = 16;
	function fkSheets(){
		return (typeof FROSTBOUND_SHEETS !== 'undefined') ? FROSTBOUND_SHEETS : null;
	}
	function fkPickAnim(en){
		const fk = en._fk;
		if(en.dead) return { sheet:'A', row:5, once:true };
		if(!fk) return { sheet:'A', row:0, once:false };
		if(fk.intro > 0) return { sheet:'A', row:1, once:false };
		if(fk.vulnerable > 0 || fk.stance === 'recovery') return { sheet:'A', row:4, once:false };
		if(fk.atk){
			const n = fk.atk.name;
			if(n === 'arc' || n === 'execution') return { sheet:'A', row:3, once:false };
			if(n === 'step' || n === 'shatterstep') return { sheet:'B', row:2, once:false };
			if(n === 'lance' || n === 'march') return { sheet:'B', row:0, once:false };
			if(n === 'counter') return { sheet:'B', row:1, once:false };
			if(n === 'wave' || n === 'orbit') return { sheet:'B', row:3, once:false };
			if(n === 'prison' || n === 'requiem') return { sheet:'B', row:4, once:false };
			return { sheet:'A', row:3, once:false };
		}
		if(fk.stance === 'combatWalk' || Math.abs(fk.vx || 0) > 0.4) return { sheet:'A', row:1, once:false };
		if(fk.stance === 'defensive') return { sheet:'A', row:2, once:false };
		return { sheet:'A', row:0, once:false };
	}
	function drawFrostboundSprite(en){
		const sheets = fkSheets();
		if(!sheets) return false;
		const pick = fkPickAnim(en);
		const img = sheets[pick.sheet];
		if(!img || !img.complete || !img.naturalWidth) return false;
		const fW = img.naturalWidth / FK_COLS;
		const fH = img.naturalHeight / FK_ROWS;
		const key = pick.sheet + ':' + pick.row;
		if(en._fkSprLast !== key){
			en._fkSprLast = key;
			en._fkSprFrame = 0;
			en._fkSprTimer = 0;
		}
		en._fkSprTimer = (en._fkSprTimer || 0) + 1;
		if(en._fkSprTimer >= FK_FPS){
			en._fkSprTimer = 0;
			if(pick.once){
				if((en._fkSprFrame || 0) < FK_COLS - 1) en._fkSprFrame = (en._fkSprFrame || 0) + 1;
			} else {
				en._fkSprFrame = ((en._fkSprFrame || 0) + 1) % FK_COLS;
			}
		}
		const frame = Math.min(en._fkSprFrame || 0, FK_COLS - 1);
		const bleed = 1;
		const sx = frame * fW + bleed, sy = pick.row * fH + bleed;
		const sw = fW - bleed * 2, sh = fH - bleed * 2;
		const dest = (typeof enemySpriteDestSize === 'function')
			? enemySpriteDestSize(en, sw, sh)
			: { rW: en.w * 2, rH: en.h * 2 };
		const rW = dest.rW, rH = dest.rH;
		const camx = (typeof camera !== 'undefined') ? camera.x : 0;
		const camy = (typeof camera !== 'undefined') ? camera.y : 0;
		const ex = en.x - camx, ey = en.y - camy;
		const cx = ex + en.w / 2;
		ctx.save();
		if(en.flash > 0) ctx.filter = 'brightness(2.5) saturate(0.3)';
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

	global.updateFrostboundKnight = updateFrostboundKnight;
	global.drawFrostboundWorld = drawFrostboundWorld;
	global.drawFrostboundProj = drawFrostboundProj;
	global.drawFrostboundSprite = drawFrostboundSprite;
	global.frostboundOnEnemyHit = frostboundOnEnemyHit;
	global.frostboundKnightDormant = frostboundKnightDormant;
})(typeof window !== 'undefined' ? window : globalThis);
