/* =============================================================
   Storm Raptor — fast burst attacker (mini-boss + summon).

   Hunt → Engage → Burst → Disengage → Recover → Hunt again.
   Attacks are body-driven melee first. Only two ranged tools.
   Nothing here requires an arena, perch, rod, or terrain prop.
   ============================================================= */
(function(global){
	const STORM = ['#dff6ff', '#8ec6ff', '#ffe566', '#c9e8ff', '#6ea8ff'];
	const T = (typeof TILE === 'number') ? TILE : 40;
	const P2 = 0.60, P3 = 0.30;
	const RANGE_TYPES = {
		crystalMage:1, emberMage:1, cryoMage:1, iceArcher:1, willowWisp:1,
		windSylph:1, skyVine:1, forgeDrone:1, mossWraith:1, frostWraith:1,
		sandWraith:1, sporeFungus:1, boneWraith:1
	};

	function srType(en){ return (en && (en.necroType || en.type)) || ''; }
	function srIs(en){ return srType(en) === 'stormRaptor'; }
	function srFriendly(en){ return !!(en && (en.isNecroSummon || en.necroFriendly)); }
	function srAlive(en){ return !!(en && !en.dead && en.hp > 0); }
	function srDiff(){ return (typeof DIFF_DMG_MULT === 'number') ? DIFF_DMG_MULT : 1; }
	function srBossDmg(n){ return Math.round(n * srDiff()); }

	function srRoom(en){
		const rooms = (typeof dungeon !== 'undefined' && dungeon && dungeon.rooms) || [];
		if(en && en.roomId != null && rooms[en.roomId]) return rooms[en.roomId];
		if(!en) return null;
		const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
		for(let i = 0; i < rooms.length; i++){
			const r = rooms[i];
			if(cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) return r;
		}
		return null;
	}
	function srTileSolid(x, y){
		if(typeof tileMap === 'undefined' || typeof MAP_ROWS === 'undefined') return false;
		const c = Math.floor(x / T), r = Math.floor(y / T);
		if(r < 0 || c < 0 || r >= MAP_ROWS || c >= MAP_COLS) return false;
		return !tileMap[r][c];
	}
	function srBlocked(x, y, w, h){
		return srTileSolid(x + 6, y + 6) || srTileSolid(x + w - 6, y + 6) ||
			srTileSolid(x + 6, y + h - 6) || srTileSolid(x + w - 6, y + h - 6);
	}
	function srScanFloor(fx, fromY, limit){
		if(typeof tileMap === 'undefined') return fromY + (limit || 420);
		const c = Math.max(0, Math.min(MAP_COLS - 1, Math.floor(fx / T)));
		const start = Math.max(0, Math.floor(fromY / T));
		const stop = Math.min(MAP_ROWS - 1, start + Math.ceil((limit || 520) / T));
		for(let r = start; r <= stop; r++){
			if(!tileMap[r][c]) return r * T;
		}
		return fromY + (limit || 420);
	}
	function srGroundY(en, room){
		const fx = en.x + en.w / 2;
		const scan = srScanFloor(fx, en.y + en.h - 4, 640) - en.h;
		if(room) return Math.min(scan, room.y + room.h - en.h - 16);
		return scan;
	}

	function srShake(a, b){ if(typeof shakeScreen === 'function') shakeScreen(a, b); }
	function srBanner(t){
		if(typeof DungeonEnv !== 'undefined' && DungeonEnv.showBanner) DungeonEnv.showBanner(t);
		else if(typeof notify === 'function') notify(t);
	}
	function srPart(x, y, n, spread, color){
		if(typeof particles === 'undefined') return;
		spread = spread || 36;
		for(let i = 0; i < n; i++){
			particles.push({
				x: x + (Math.random() - 0.5) * spread,
				y: y + (Math.random() - 0.5) * spread * 0.7,
				vx: (Math.random() - 0.5) * 6.2,
				vy: -1.2 - Math.random() * 4.4,
				life: 16 + Math.random() * 20,
				color: color || STORM[i % STORM.length]
			});
		}
	}
	function srTel(x, y, w, h, frames, label, type){
		if(typeof spawnTelegraph === 'function'){
			spawnTelegraph(x, y, w, h, frames, 'rgba(190,230,255,0.38)', type || 'rect', label || '');
		}
	}

	function srInRect(tgt, x, y, w, h){
		if(!tgt) return false;
		return tgt.x + tgt.w > x && tgt.x < x + w && tgt.y + tgt.h > y && tgt.y < y + h;
	}
	function srInCirc(tgt, cx, cy, r){
		if(!tgt) return false;
		return Math.hypot(tgt.cx - cx, tgt.cy - cy) < r;
	}
	function srOnce(a, tgt){
		if(!a || !tgt || !tgt.en) return true;
		if(!a.hit) a.hit = [];
		if(a.hit.indexOf(tgt.en) >= 0) return false;
		a.hit.push(tgt.en);
		return true;
	}
	function srKnock(tgt, cx, force, lift){
		if(!tgt || !tgt.en) return;
		const e = tgt.en;
		const dir = (tgt.cx >= cx) ? 1 : -1;
		if(e === player){
			player.vx = (player.vx || 0) + dir * force;
			if(lift) player.vy = (player.vy || 0) - lift;
			return;
		}
		e._kbVx = dir * force;
		e._kbVy = -(lift || 1.4);
		e._kbTimer = Math.max(e._kbTimer || 0, 14);
	}
	function srStagger(tgt, frames){
		if(!tgt || !tgt.en) return;
		const e = tgt.en;
		if(e === player){
			if(typeof player.stunTimer === 'number') player.stunTimer = Math.max(player.stunTimer || 0, frames);
			return;
		}
		e.stunTimer = Math.max(e.stunTimer || 0, frames);
	}

	function srVictims(en){
		if(srFriendly(en)){
			const out = [];
			const pool = (typeof enemies !== 'undefined' ? enemies : []).concat(typeof dummies !== 'undefined' ? dummies : []);
			for(let i = 0; i < pool.length; i++){
				const t = pool[i];
				if(!t || t.dead || t.hp <= 0) continue;
				if(t === en) continue;
				out.push({ x:t.x, y:t.y, w:t.w || 32, h:t.h || 32, cx:t.x + (t.w || 32) / 2, cy:t.y + (t.h || 32) / 2, en:t });
			}
			return out;
		}
		const out = [{ x:player.x, y:player.y, w:player.w, h:player.h, cx:player.x + player.w / 2, cy:player.y + player.h / 2, en:player }];
		if(typeof playerMinions !== 'undefined'){
			for(let i = 0; i < playerMinions.length; i++){
				const t = playerMinions[i];
				if(!t || t.dead || t.hp <= 0) continue;
				out.push({ x:t.x, y:t.y, w:t.w || 28, h:t.h || 28, cx:t.x + (t.w || 28) / 2, cy:t.y + (t.h || 28) / 2, en:t });
			}
		}
		return out;
	}
	function srHurtOne(en, tgt, dmg, extra){
		if(!tgt || !tgt.en) return false;
		extra = extra || {};
		if(srFriendly(en)){
			if(typeof necroScaleKitDmg === 'function') dmg = necroScaleKitDmg(en, dmg);
			const t = tgt.en;
			t.hp -= dmg; t.flash = 8;
			if(typeof dmgNumbers !== 'undefined') dmgNumbers.push({ x:t.x + (t.w || 20) / 2, y:t.y - 10, text:'' + Math.round(dmg), age:0, color:'#ffe566' });
			if(extra.kb) srKnock(tgt, extra.cx != null ? extra.cx : en.x + en.w / 2, extra.kb, extra.lift);
			if(extra.stagger) srStagger(tgt, extra.stagger);
			return true;
		}
		if(tgt.en !== player){
			const t = tgt.en;
			t.hp -= srBossDmg(Math.round(dmg * 0.55));
			t.flash = 8;
			if(extra.kb) srKnock(tgt, extra.cx != null ? extra.cx : en.x + en.w / 2, extra.kb * 0.7, extra.lift);
			if(extra.stagger) srStagger(tgt, extra.stagger);
			return true;
		}
		if(player._srHitCD > 0) return false;
		if(player.iFrames > 0 && !extra.burst) return false;
		const fx = extra.stagger ? ['stun'] : [];
		if(typeof damagePlayer === 'function') damagePlayer(srBossDmg(dmg), fx);
		player._srHitCD = extra.gap != null ? extra.gap : 12;
		if(extra.iframes != null) player.iFrames = Math.min(player.iFrames || 0, extra.iframes);
		if(extra.kb) srKnock(tgt, extra.cx != null ? extra.cx : en.x + en.w / 2, extra.kb, extra.lift);
		return true;
	}
	function srBox(en, a, x, y, w, h, dmg, extra){
		extra = extra || {};
		let n = 0;
		const list = srVictims(en);
		for(let i = 0; i < list.length; i++){
			if(!srInRect(list[i], x, y, w, h)) continue;
			if(a && !srOnce(a, list[i])) continue;
			if(srHurtOne(en, list[i], dmg, extra)) n++;
		}
		return n;
	}
	function srCirc(en, a, cx, cy, r, dmg, extra){
		extra = extra || {};
		extra.cx = cx;
		let n = 0;
		const list = srVictims(en);
		for(let i = 0; i < list.length; i++){
			if(!srInCirc(list[i], cx, cy, r)) continue;
			if(a && !srOnce(a, list[i])) continue;
			if(srHurtOne(en, list[i], dmg, extra)) n++;
		}
		return n;
	}

	function srLimb(en, which){
		const f = en.facing || 1;
		const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
		if(which === 'beak') return { x: cx + f * 28, y: cy - 4 };
		if(which === 'talonL') return { x: cx + f * 10, y: cy + 22 };
		if(which === 'talonR') return { x: cx + f * 18, y: cy + 20 };
		if(which === 'wing') return { x: cx - f * 8, y: cy - 6 };
		if(which === 'chest') return { x: cx, y: cy };
		return { x: cx + f * 16, y: cy + 8 };
	}
	function srFace(en, tgt){
		if(!tgt) return en.facing || 1;
		const dx = tgt.cx - (en.x + en.w / 2);
		if(Math.abs(dx) > 6) en.facing = dx > 0 ? 1 : -1;
		return en.facing || 1;
	}
	function srDist(en, tgt){
		if(!tgt) return 9999;
		return Math.hypot(tgt.cx - (en.x + en.w / 2), tgt.cy - (en.y + en.h / 2));
	}
	function srAng(en, tgt){
		if(!tgt) return (en.facing || 1) > 0 ? 0 : Math.PI;
		return Math.atan2(tgt.cy - (en.y + en.h / 2), tgt.cx - (en.x + en.w / 2));
	}

	function srFX(sr, fx){
		sr.fx.push(fx);
		return fx;
	}
	function srMeleeFX(sr, en, kind, tgt, limb){
		const o = srLimb(en, limb || (kind === 'beak' ? 'beak' : kind === 'wing' ? 'wing' : 'talonL'));
		const ang = tgt ? Math.atan2(tgt.cy - o.y, tgt.cx - o.x) : ((en.facing || 1) > 0 ? 0 : Math.PI);
		srFX(sr, {
			kind: kind, x:o.x, y:o.y, ang:ang, life:14, max:14,
			f: en.facing || 1, reach: kind === 'cross' ? 78 : kind === 'beak' ? 64 : 70
		});
	}
	function srImpact(sr, x, y, r){
		srFX(sr, { kind:'impact', x:x, y:y, r:r || 46, life:16, max:16 });
		srPart(x, y, 14, r || 46);
	}

	function srFireJavelin(en, sr, tgt){
		if(typeof spawnEnemyProj !== 'function' || !tgt) return null;
		const o = srLimb(en, 'chest');
		const dx = tgt.cx - o.x, dy = tgt.cy - o.y, d = Math.max(8, Math.hypot(dx, dy));
		const spd = 16.5;
		const p = spawnEnemyProj(o.x, o.y, dx / d * spd, dy / d * spd, {
			color:'#dff6ff', color2:'#ffe566', power: srFriendly(en) ? 18 : 32,
			width:18, height:10, shape:'missile', trail:'spark', maxAge:70, noWallCollide:true
		});
		if(p){
			p._srStyle = 'javelin';
			p._srOwner = en;
			if(srFriendly(en) && typeof markNecroFriendlyProj === 'function') markNecroFriendlyProj(p, en);
		}
		srFX(sr, { kind:'javelinFlash', x:o.x, y:o.y, ang:Math.atan2(dy, dx), life:10, max:10 });
		return p;
	}
	function srFireFeather(en, sr, ang, color){
		if(typeof spawnEnemyProj !== 'function') return null;
		const o = srLimb(en, 'wing');
		const spd = 20.5;
		const p = spawnEnemyProj(o.x, o.y, Math.cos(ang) * spd, Math.sin(ang) * spd, {
			color: color || STORM[0], color2:'#ffe566', power: srFriendly(en) ? 14 : 26,
			width:24, height:9, shape:'missile', trail:'spark', maxAge:78, noWallCollide:true
		});
		if(p){
			p._srStyle = 'feather';
			p._srOwner = en;
			p._srFeather = true;
			if(srFriendly(en) && typeof markNecroFriendlyProj === 'function') markNecroFriendlyProj(p, en);
		}
		srFX(sr, { kind:'javelinFlash', x:o.x, y:o.y, ang:ang, life:8, max:8 });
		srPart(o.x, o.y, 4, 16, color || '#c9e8ff');
		return p;
	}

	function srPhase(en, sr){
		const pct = en.hp / Math.max(1, en.maxHp || en.hp);
		const next = pct > P2 ? 1 : (pct > P3 ? 2 : 3);
		if(next !== sr.phase){
			sr.phase = next;
			en.bossPhase = next;
			if(!sr.friendly && next === 2) srBanner('STORM RAPTOR — PREDATOR');
			if(!sr.friendly && next === 3) srBanner('STORM RAPTOR — STORM HUNTER');
		}
		return sr.phase;
	}
	function srSpd(sr){
		return sr.phase === 3 ? 1.48 : (sr.phase === 2 ? 1.32 : 1.18);
	}
	function srRecoverLen(sr){
		return sr.phase === 3 ? 60 : (sr.phase === 2 ? 82 : 105);
	}
	function srHuntGap(sr){
		return sr.phase === 3 ? 40 : (sr.phase === 2 ? 54 : 72);
	}

	function srScoreTarget(en, t, others){
		let s = 0;
		const isoR = 190;
		let near = 0;
		for(let i = 0; i < others.length; i++){
			if(others[i].en === t.en) continue;
			if(Math.hypot(others[i].cx - t.cx, others[i].cy - t.cy) < isoR) near++;
		}
		if(near === 0) s += 420;
		else if(near === 1) s += 160;
		const hp = t.en.hp || 1, max = t.en.maxHp || hp;
		const pct = hp / Math.max(1, max);
		if(pct < 0.28) s += 380;
		else if(pct < 0.5) s += 200;
		else if(pct < 0.7) s += 80;
		const type = (t.en.necroType || t.en.type || '');
		if(RANGE_TYPES[type]) s += 300;
		if(t.en.isBoss || (t.en.typeDef && t.en.typeDef.isBoss)) s += 340;
		if(t.en.isMiniBoss || (t.en.typeDef && t.en.typeDef.isMiniBoss)) s += 260;
		if(t.en === player) s += 220;
		s -= srDist(en, t) * 0.18;
		return s;
	}
	function srPickPrey(en, sr){
		const list = srVictims(en);
		if(!list.length){ sr.target = null; return null; }
		let best = list[0], bestS = -1e9;
		for(let i = 0; i < list.length; i++){
			const s = srScoreTarget(en, list[i], list);
			if(s > bestS){ bestS = s; best = list[i]; }
		}
		sr.target = best.en;
		return best;
	}
	function srTgt(en, sr){
		if(sr.friendly){
			const t = sr.target;
			if(!t || t.dead || t.hp <= 0) return srPickPrey(en, sr);
			return { x:t.x, y:t.y, w:t.w || 32, h:t.h || 32, cx:t.x + (t.w || 32) / 2, cy:t.y + (t.h || 32) / 2, en:t };
		}
		if(sr.target && sr.target !== player && !sr.target.dead && sr.target.hp > 0){
			const t = sr.target;
			return { x:t.x, y:t.y, w:t.w || 28, h:t.h || 28, cx:t.x + (t.w || 28) / 2, cy:t.y + (t.h || 28) / 2, en:t };
		}
		return { x:player.x, y:player.y, w:player.w, h:player.h, cx:player.x + player.w / 2, cy:player.y + player.h / 2, en:player };
	}

	function srClamp(en, room){
		if(!room || srFriendly(en)) return;
		const pad = 36;
		if(en.x < room.x + pad) en.x = room.x + pad;
		if(en.x + en.w > room.x + room.w - pad) en.x = room.x + room.w - pad - en.w;
		if(en.y < room.y + 48) en.y = room.y + 48;
		if(en.y + en.h > room.y + room.h - 20) en.y = room.y + room.h - 20 - en.h;
	}
	function srMove(en, sr, room, nx, ny, ghost){
		if(!ghost && srBlocked(nx, ny, en.w, en.h)){
			if(!srBlocked(nx, en.y, en.w, en.h)){ en.x = nx; }
			else if(!srBlocked(en.x, ny, en.w, en.h)){ en.y = ny; }
			srClamp(en, room);
			return false;
		}
		en.x = nx; en.y = ny;
		srClamp(en, room);
		en.baseY = en.y;
		return true;
	}
	function srDrive(en, sr, room, tgt, mode){
		sr.mode = mode;
		const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
		const spd = (en.typeDef && en.typeDef.moveSpeed ? en.typeDef.moveSpeed : 3.6) * srSpd(sr);
		if(mode === 'recover' || mode === 'grounded'){
			const gy = srGroundY(en, room);
			const wantY = Math.min(en.y + 3.4, gy);
			srMove(en, sr, room, en.x + (sr.vx || 0) * 0.55, wantY);
			sr.vx *= 0.86;
			en.vx = sr.vx; en.vy = 0;
			if(tgt) srFace(en, tgt);
			return;
		}
		if(!tgt){
			if(sr.friendly && typeof player !== 'undefined'){
				const px = player.x + player.w / 2 - 80, py = player.y - 70;
				srMove(en, sr, room, en.x + (px - cx) * 0.04, en.y + (py - cy) * 0.035);
				return;
			}
			sr.orbit += 0.03;
			srMove(en, sr, room, en.x + Math.cos(sr.orbit) * spd * 0.4, en.y + Math.sin(sr.orbit * 1.3) * 0.8);
			return;
		}
		srFace(en, tgt);
		const dx = tgt.cx - cx, dy = tgt.cy - cy, d = Math.max(1, Math.hypot(dx, dy));
		if(mode === 'approach'){
			const hold = 150;
			if(d > hold + 30){
				sr.vx = dx / d * spd * 1.55;
				sr.vy = dy / d * spd * 1.15;
			} else if(d < 90){
				sr.vx = -dx / d * spd * 0.9;
				sr.vy = -0.6;
			} else {
				sr.orbit += 0.075 * (sr.orbitDir || 1);
				sr.vx = Math.cos(sr.orbit) * spd * 1.1;
				sr.vy = Math.sin(sr.orbit) * spd * 0.45;
			}
			srMove(en, sr, room, en.x + sr.vx, en.y + sr.vy);
			en.vx = sr.vx; en.vy = sr.vy;
			return;
		}
		if(mode === 'hunt'){
			sr.orbit += 0.055 * (sr.orbitDir || 1);
			const rad = 210 + Math.sin(sr.t * 0.03) * 36;
			const tx = tgt.cx + Math.cos(sr.orbit) * rad;
			const ty = tgt.cy - 70 + Math.sin(sr.orbit * 1.4) * 40;
			sr.vx += ((tx - cx) * 0.045);
			sr.vy += ((ty - cy) * 0.04);
			const cap = spd * 1.35;
			const s = Math.hypot(sr.vx, sr.vy) || 1;
			if(s > cap){ sr.vx *= cap / s; sr.vy *= cap / s; }
			srMove(en, sr, room, en.x + sr.vx, en.y + sr.vy);
			en.vx = sr.vx; en.vy = sr.vy;
			if(sr.t % 90 === 0) sr.orbitDir = Math.random() < 0.5 ? -1 : 1;
			return;
		}
		if(mode === 'disengage'){
			const away = tgt ? (cx >= tgt.cx ? 1 : -1) : (en.facing || 1);
			sr.vx = away * spd * 1.8;
			sr.vy = -spd * 0.9;
			srMove(en, sr, room, en.x + sr.vx, en.y + sr.vy);
			en.vx = sr.vx; en.vy = sr.vy;
			en.facing = away;
		}
	}

	const CDS = { dive:190, flurry:130, beak:110, rush:165, pounce:240, javelin:185, clap:200, feathers:210, strike:40 };
	function srReady(sr, name){ return (sr.cd[name] || 0) <= 0; }
	function srUse(sr, name){ sr.cd[name] = CDS[name] || 80; sr.lastMajor = name; }
	function srTickCD(sr){
		for(const k in sr.cd) if(sr.cd[k] > 0) sr.cd[k]--;
		if(player && player._srHitCD > 0) player._srHitCD--;
	}

	function srAllowed(sr, name){
		if(name === 'pounce' || name === 'clap') return sr.phase >= 2;
		return true;
	}
	const COMBOS = {
		A: ['dive', 'flurry', 'beak', 'rush'],
		B: ['javelin', 'dive', 'flurry', 'pounce'],
		C: ['rush', 'beak', 'dive'],
		D: ['clap', 'rush', 'dive'],
		E: ['dive', 'dive', 'dive'],
		F: ['feathers', 'dive'],
		G: ['rush', 'feathers']
	};
	function srComboOk(sr, key){
		const steps = COMBOS[key];
		if(!steps) return false;
		for(let i = 0; i < steps.length; i++){
			if(!srAllowed(sr, steps[i])) return false;
		}
		if(key === sr.lastCombo) return false;
		if(key === 'E' && !srReady(sr, 'dive')) return false;
		if(key !== 'E' && !srReady(sr, steps[0])) return false;
		return true;
	}
	function srPickCombo(sr){
		const bag = [];
		if(sr.phase === 1){ bag.push('A', 'A', 'C', 'F', 'F', 'E'); }
		else if(sr.phase === 2){ bag.push('A', 'B', 'F', 'G', 'G', 'D', 'E'); }
		else { bag.push('B', 'F', 'G', 'G', 'D', 'E', 'C'); }
		let ok = bag.filter(function(k){ return srComboOk(sr, k); });
		if(!ok.length){
			ok = bag.filter(function(k){
				const prev = sr.lastCombo;
				sr.lastCombo = '';
				const pass = srComboOk(sr, k);
				sr.lastCombo = prev;
				return pass;
			});
		}
		if(!ok.length){
			const singles = ['dive', 'flurry', 'beak', 'rush', 'javelin', 'pounce', 'clap', 'feathers'].filter(function(n){
				return srAllowed(sr, n) && srReady(sr, n);
			});
			if(singles.length){
				let pick = singles[Math.floor(Math.random() * singles.length)];
				if(pick === sr.lastMajor && singles.length > 1){
					pick = singles[(singles.indexOf(pick) + 1) % singles.length];
				}
				return { name:'X', steps:[pick], i:0 };
			}
			return null;
		}
		const key = ok[Math.floor(Math.random() * ok.length)];
		return { name:key, steps:COMBOS[key].slice(), i:0 };
	}

	function srStartAtk(en, sr, name, extra){
		extra = extra || {};
		sr.atk = { name:name, t:0, hit:[], extra:extra, lockX:0, lockY:0, locked:false };
		if(name !== 'strike'){
			if(name === 'dive' && extra.chain && (extra.chainIndex || 0) > 0) sr.cd.dive = 8;
			else srUse(sr, name);
		}
		en.attackAnimTimer = 48;
		en.charging = false;
		sr.mode = (name === 'javelin' || name === 'clap' || name === 'dive' || name === 'pounce' || name === 'feathers') ? 'air' : 'burst';
	}
	function srEndAtk(en, sr){
		sr.atk = null;
		if(sr.combo && sr.combo.i < sr.combo.steps.length - 1){
			sr.combo.i++;
			const next = sr.combo.steps[sr.combo.i];
			const chain = sr.combo.name === 'E';
			srStartAtk(en, sr, next, { chain:chain, chainIndex:sr.combo.i });
			return;
		}
		if(sr.combo) sr.lastCombo = sr.combo.name;
		sr.combo = null;
		sr.state = 'disengage';
		sr.timer = sr.phase === 3 ? 32 : 42;
		sr.mode = 'disengage';
		sr.orbitDir = Math.random() < 0.5 ? -1 : 1;
	}

	function srLockOn(sr, en, tgt, frames, label){
		if(!tgt) return;
		sr.atk.lockX = tgt.cx; sr.atk.lockY = tgt.cy; sr.atk.locked = true;
		srFX(sr, { kind:'lock', x:tgt.cx, y:tgt.cy, life:frames, max:frames, label:label || 'LOCK' });
		srTel(tgt.cx - 36, tgt.cy - 36, 72, 72, frames, label || '', 'circle');
		const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
		srFX(sr, { kind:'diveLine', x:cx, y:cy, x2:tgt.cx, y2:tgt.cy, life:frames, max:frames });
	}

	function runAtk(en, sr, room, tgt){
		const a = sr.atk;
		a.t++;
		const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
		const name = a.name;
		const chain = !!(a.extra && a.extra.chain);
		const warn = (name === 'dive' && chain && a.extra.chainIndex > 0) ? 18 : 0;

		if(name === 'dive'){
			const wind = warn || 38;
			const speed = 22;
			if(a.t === 1 && tgt){
				srFace(en, tgt);
				srLockOn(sr, en, tgt, wind, chain ? 'TRIPLE DIVE' : 'LIGHTNING DIVE');
				srFX(sr, { kind:'charge', x:cx, y:cy, life:wind, max:wind, limb:'wing' });
			}
			if(a.t < wind){
				if(tgt){
					srFace(en, tgt);
					const rise = Math.max(en.y - 2.2, (room ? room.y + 70 : en.y - 40));
					srMove(en, sr, room, en.x, rise, true);
				}
				return;
			}
			if(a.t === wind){
				if(tgt){ a.lockX = tgt.cx; a.lockY = tgt.cy; }
				const lx = a.lockX, ly = a.lockY;
				const d = Math.max(20, Math.hypot(lx - cx, ly - cy));
				a.vx = (lx - cx) / d * speed;
				a.vy = (ly - cy) / d * speed;
				a.travel = Math.max(10, Math.min(96, Math.ceil(d / speed) + 2));
				sr.mode = 'burst';
				srFX(sr, { kind:'streak', x:cx, y:cy, life:a.travel, max:a.travel, vx:a.vx, vy:a.vy });
			}
			if(!a.rebound && a.t > wind){
				srMove(en, sr, room, en.x + a.vx, en.y + a.vy, true);
				en.vx = a.vx; en.vy = a.vy;
				if(a.t % 2 === 0) srPart(cx, cy, 2, 18, '#8ec6ff');
				const hx = en.x + (en.facing > 0 ? en.w * 0.15 : -10), hy = en.y + 8;
				srBox(en, a, hx, hy, en.w + 28, en.h + 16, 40, { burst:true, gap:14, iframes:16, kb:10, lift:3, cx:cx });
				const arrived = srDist(en, { cx:a.lockX, cy:a.lockY, x:a.lockX, y:a.lockY, w:8, h:8 }) < 48;
				if(arrived || a.t >= wind + (a.travel || 24)){
					srCirc(en, { hit:(a.hit || []).slice() }, en.x + en.w / 2, en.y + en.h / 2, 70, 22, { burst:true, gap:12, iframes:14, kb:8, lift:2, cx:cx });
					srImpact(sr, en.x + en.w / 2, en.y + en.h / 2, 64);
					srShake(7, 10);
					a.rebound = true;
					a.reboundT = 0;
					a.vx = -(a.vx || en.facing * 12) * 0.45;
					a.vy = -10;
				}
				return;
			}
			if(a.rebound){
				a.reboundT = (a.reboundT || 0) + 1;
				srMove(en, sr, room, en.x + (a.vx || 0), en.y + (a.vy || -8), true);
				a.vy += 0.45;
				if(a.reboundT > 16) srEndAtk(en, sr);
			}
			return;
		}

		if(name === 'flurry'){
			if(a.t === 1){
				srTel(cx - 50, cy - 40, 100, 80, 16, 'TALON FLURRY');
				srFX(sr, { kind:'charge', x:cx, y:cy, life:16, max:16, limb:'talonL' });
			}
			if(a.t < 16 && tgt){
				srFace(en, tgt);
				const d = Math.max(1, srDist(en, tgt));
				srMove(en, sr, room, en.x + (tgt.cx - cx) / d * 9.5, en.y + (tgt.cy - cy) / d * 6.5);
				return;
			}
			const swings = [
				{ t:18, limb:'talonL', kind:'claw', dmg:13, w:78, h:52 },
				{ t:30, limb:'talonR', kind:'claw', dmg:13, w:78, h:52 },
				{ t:42, limb:'talonL', kind:'cross', dmg:17, w:92, h:64 },
				{ t:56, limb:'talonR', kind:'finisher', dmg:28, w:100, h:70 }
			];
			for(let i = 0; i < swings.length; i++){
				if(a.t !== swings[i].t) continue;
				if(tgt) srFace(en, tgt);
				const o = srLimb(en, swings[i].limb);
				const f = en.facing || 1;
				a.hit = [];
				srMeleeFX(sr, en, swings[i].kind, tgt, swings[i].limb);
				const fin = swings[i].kind === 'finisher';
				srBox(en, a, o.x - (f < 0 ? swings[i].w : 8), o.y - swings[i].h * 0.45, swings[i].w, swings[i].h, swings[i].dmg, {
					burst:true, gap:10, iframes:fin ? 18 : 8, kb:fin ? 12 : 4, lift:fin ? 2.4 : 0.6, cx:cx, stagger:fin ? 12 : 0
				});
				if(fin){ srImpact(sr, o.x + f * 20, o.y, 40); srShake(6, 8); }
				else srPart(o.x, o.y, 6, 22, '#c9e8ff');
			}
			if(tgt && a.t > 16 && a.t < 56){
				const d = Math.max(1, srDist(en, tgt));
				if(d > 70) srMove(en, sr, room, en.x + (tgt.cx - cx) / d * 3.2, en.y + (tgt.cy - cy) / d * 2);
			}
			if(a.t > 68) srEndAtk(en, sr);
			return;
		}

		if(name === 'beak'){
			if(a.t === 1){
				srTel(cx + (en.facing || 1) * 20 - 30, cy - 28, 90, 56, 12, 'THUNDERBEAK');
				srFX(sr, { kind:'charge', x:cx, y:cy, life:12, max:12, limb:'beak' });
			}
			if(a.t < 12 && tgt) srFace(en, tgt);
			if(a.t === 12){
				const ang = tgt ? srAng(en, tgt) : ((en.facing || 1) > 0 ? 0 : Math.PI);
				a.vx = Math.cos(ang) * 13;
				a.vy = Math.sin(ang) * 8;
			}
			if(a.t >= 12 && a.t <= 18){
				srMove(en, sr, room, en.x + (a.vx || 0), en.y + (a.vy || 0));
			}
			if(a.t === 16){
				const o = srLimb(en, 'beak');
				const f = en.facing || 1;
				srMeleeFX(sr, en, 'beak', tgt, 'beak');
				srBox(en, a, o.x - (f < 0 ? 70 : 6), o.y - 22, 76, 44, 36, { burst:true, gap:12, iframes:14, kb:6, stagger:16, cx:cx });
				srImpact(sr, o.x + f * 18, o.y, 28);
			}
			if(a.t === 22){
				srMove(en, sr, room, en.x - (en.facing || 1) * 28, en.y - 10, true);
			}
			if(a.t > 34) srEndAtk(en, sr);
			return;
		}

		if(name === 'rush'){
			if(a.t === 1){
				srTel(cx - 40, cy - 28, 80, 56, 14, 'WING RUSH');
				srFX(sr, { kind:'charge', x:cx, y:cy, life:14, max:14, limb:'wing' });
				if(tgt){ a.lockX = tgt.cx; a.lockY = tgt.cy; srFace(en, tgt); }
			}
			if(a.t === 14){
				const lx = a.lockX || (cx + (en.facing || 1) * 220);
				const ly = a.lockY || cy;
				const d = Math.max(16, Math.hypot(lx - cx, ly - cy));
				a.vx = (lx - cx) / d * 16.2;
				a.vy = (ly - cy) / d * 10.5;
				sr.mode = 'burst';
				srFX(sr, { kind:'streak', x:cx, y:cy, life:18, max:18, vx:a.vx, vy:a.vy });
			}
			if(a.t >= 14 && a.t <= 28){
				srMove(en, sr, room, en.x + (a.vx || 0), en.y + (a.vy || 0), true);
				en.vx = a.vx; en.vy = a.vy;
				if(a.t === 16) srMeleeFX(sr, en, 'wing', tgt, 'wing');
				srBox(en, a, en.x - 8, en.y + 4, en.w + 16, en.h + 8, 22, { burst:true, gap:10, iframes:10, kb:7, cx:cx });
			}
			if(a.t > 32) srEndAtk(en, sr);
			return;
		}

		if(name === 'pounce'){
			if(a.t === 1){
				srTel(cx - 44, cy - 80, 88, 120, 20, 'STORM POUNCE');
				srFX(sr, { kind:'charge', x:cx, y:cy, life:20, max:20, limb:'talonL' });
			}
			if(a.t < 18){
				srMove(en, sr, room, en.x, en.y - 6.5, true);
				if(tgt) srFace(en, tgt);
				return;
			}
			if(a.t === 18 && tgt){
				a.lockX = tgt.cx; a.lockY = tgt.cy;
				srLockOn(sr, en, tgt, 12, 'POUNCE');
			}
			if(a.t > 18 && a.t <= 34){
				const lx = a.lockX || cx, ly = a.lockY || (cy + 80);
				const d = Math.max(12, Math.hypot(lx - cx, ly - cy));
				srMove(en, sr, room, en.x + (lx - cx) / d * 15, en.y + (ly - cy) / d * 15, true);
			}
			if(a.t === 34){
				srCirc(en, a, en.x + en.w / 2, en.y + en.h / 2, 78, 46, { burst:true, gap:14, iframes:18, kb:11, lift:3.2, cx:cx });
				srCirc(en, null, en.x + en.w / 2, en.y + en.h / 2, 96, 20, { burst:true, gap:12, iframes:12, kb:6, cx:cx });
				srMeleeFX(sr, en, 'pounce', tgt, 'talonL');
				srImpact(sr, en.x + en.w / 2, en.y + en.h, 70);
				srShake(8, 12);
			}
			if(a.t > 48) srEndAtk(en, sr);
			return;
		}

		if(name === 'javelin'){
			if(!sr.friendly && typeof player !== 'undefined'){
				tgt = { x:player.x, y:player.y, w:player.w, h:player.h, cx:player.x + player.w / 2, cy:player.y + player.h / 2, en:player };
			}
			if(a.t === 1){
				srFX(sr, { kind:'javelinCharge', x:cx, y:cy, life:28, max:28 });
				if(tgt) srTel(tgt.cx - 20, tgt.cy - 20, 40, 40, 28, 'JAVELIN', 'circle');
			}
			if(tgt) srFace(en, tgt);
			if(a.t < 28){
				srMove(en, sr, room, en.x, en.y - 0.6);
				return;
			}
			if(a.t === 28){
				srFireJavelin(en, sr, tgt || srTgt(en, sr));
				srPart(cx, cy, 10, 28, '#ffe566');
			}
			if(a.t > 40) srEndAtk(en, sr);
			return;
		}

		if(name === 'clap'){
			if(a.t === 1){
				srTel(cx - 130, cy - 90, 260, 180, 20, 'THUNDERCLAP');
				srFX(sr, { kind:'charge', x:cx, y:cy, life:20, max:20, limb:'wing' });
			}
			if(a.t === 22){
				a.wave = 20;
				srFX(sr, { kind:'shockwave', x:cx, y:cy, r:20, maxR:250, life:20, max:20 });
				srShake(6, 10);
			}
			if(a.wave != null){
				a.wave += 12;
				const list = srVictims(en);
				for(let i = 0; i < list.length; i++){
					const d = Math.hypot(list[i].cx - cx, list[i].cy - cy);
					if(d < a.wave && d > a.wave - 18){
						if(!srOnce(a, list[i])) continue;
						srHurtOne(en, list[i], 20, { burst:true, gap:14, iframes:14, kb:9, stagger:14, cx:cx });
					}
				}
				if(a.wave >= 250) a.wave = null;
			}
			if(a.t > 46) srEndAtk(en, sr);
			return;
		}

		if(name === 'feathers'){
			if(!sr.friendly && typeof player !== 'undefined'){
				tgt = { x:player.x, y:player.y, w:player.w, h:player.h, cx:player.x + player.w / 2, cy:player.y + player.h / 2, en:player };
			}
			const wide = !(sr.combo && sr.combo.name === 'G');
			const count = wide ? 8 : 6;
			const spread = wide ? 0.72 : 0.38;
			const gap = 7;
			const wind = 20;
			if(a.t === 1){
				srFX(sr, { kind:'javelinCharge', x:cx, y:cy, life:wind, max:wind });
				srTel(cx - 70, cy - 50, 140, 100, wind, wide ? 'STORM PLUMES' : 'PIN FEATHERS');
				const aim = tgt ? srAng(en, tgt) : ((en.facing || 1) > 0 ? 0 : Math.PI);
				const slots = [];
				for(let i = 0; i < count; i++){
					const u = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
					slots.push(aim + u * spread);
				}
				for(let i = slots.length - 1; i > 0; i--){
					const j = Math.floor(Math.random() * (i + 1));
					const tmp = slots[i]; slots[i] = slots[j]; slots[j] = tmp;
				}
				a.featherAng = slots;
				a.featherI = 0;
			}
			if(tgt) srFace(en, tgt);
			if(a.t < wind){
				srMove(en, sr, room, en.x, en.y - 0.45);
				return;
			}
			if((a.t - wind) % gap === 0 && a.featherI < (a.featherAng || []).length){
				const color = STORM[a.featherI % STORM.length];
				srFireFeather(en, sr, a.featherAng[a.featherI], color);
				a.featherI++;
			}
			if(a.t > wind + count * gap + 10) srEndAtk(en, sr);
			return;
		}

		if(name === 'strike'){
			if(a.t === 1 && tgt) srFace(en, tgt);
			if(a.t === 6){
				const o = srLimb(en, 'talonL');
				const f = en.facing || 1;
				srMeleeFX(sr, en, 'claw', tgt, 'talonL');
				srBox(en, a, o.x - (f < 0 ? 58 : 4), o.y - 18, 62, 40, 14, { burst:true, gap:10, iframes:8, kb:3, cx:cx });
			}
			if(a.t > 14){ sr.atk = null; sr.state = 'hunt'; sr.timer = 10; }
			return;
		}

		srEndAtk(en, sr);
	}

	function srInit(en){
		const sr = en._sr = {
			t:0, phase:1, state:'hunt', timer:20, atk:null, combo:null, lastCombo:'',
			cd:{ dive:28, flurry:16, beak:10, rush:20, pounce:48, javelin:24, clap:48, feathers:22, strike:0 },
			fx:[], lastMajor:'', mode:'air', vx:0, vy:0, orbit:Math.random() * Math.PI * 2,
			orbitDir: Math.random() < 0.5 ? -1 : 1, target:null, friendly:srFriendly(en),
			intro: srFriendly(en) ? 12 : 70, deadDone:false
		};
		en.bossPhase = 1;
		en._stunResist = Math.max(en._stunResist || 0, 1);
		return sr;
	}

	function srTickFX(sr){
		for(let i = sr.fx.length - 1; i >= 0; i--){
			const f = sr.fx[i];
			f.life--;
			if(f.kind === 'streak'){
				f.x += (f.vx || 0) * 0.35; f.y += (f.vy || 0) * 0.35;
			}
			if(f.kind === 'shockwave'){
				const u = 1 - f.life / f.max;
				f.r = 20 + (f.maxR - 20) * u;
			}
			if(f.life <= 0) sr.fx.splice(i, 1);
		}
	}

	function updateStormRaptor(en){
		if(!en || !srIs(en)) return false;
		if(!srAlive(en)){
			if(en._sr && !en._sr.deadDone){
				en._sr.deadDone = true;
				if(!en._sr.friendly) srBanner('STORM RAPTOR — the hunter falls');
			}
			return false;
		}
		if(en._jungleDormant || en._jungleHidden){
			en.stunTimer = Math.max(en.stunTimer || 0, 30);
			en.vx = 0; en.vy = 0;
			return true;
		}
		if(typeof treetopBossState !== 'undefined' && treetopBossState.phase === 'cutscene' && treetopBossState.bossEnemy === en){
			if(!en._sr) srInit(en);
			en.animTimer = (en.animTimer || 0) + 1;
			return true;
		}
		if(!en._sr) srInit(en);
		const sr = en._sr;
		sr.t++;
		en.animTimer = (en.animTimer || 0) + 1;
		if(en.attackAnimTimer > 0) en.attackAnimTimer--;
		srTickCD(sr);
		srTickFX(sr);
		srPhase(en, sr);
		const room = srRoom(en);
		if(sr.intro > 0){
			sr.intro--;
			if(!sr.friendly && sr.intro === 50) srBanner('STORM RAPTOR — something is hunting you');
			srPickPrey(en, sr);
			srDrive(en, sr, room, srTgt(en, sr), 'hunt');
			return true;
		}
		if(sr.state === 'recover'){
			srDrive(en, sr, room, srTgt(en, sr), 'recover');
			sr.timer--;
			if(sr.timer <= 0){ sr.state = 'hunt'; sr.timer = srHuntGap(sr); srPickPrey(en, sr); }
			return true;
		}
		if(sr.state === 'disengage'){
			srDrive(en, sr, room, srTgt(en, sr), 'disengage');
			sr.timer--;
			if(sr.timer <= 0){ sr.state = 'recover'; sr.timer = srRecoverLen(sr); sr.mode = 'grounded'; }
			return true;
		}
		if(sr.atk){
			runAtk(en, sr, room, srTgt(en, sr));
			return true;
		}
		if(sr.state === 'hunt' || sr.state === 'approach'){
			if(sr.t % 36 === 1) srPickPrey(en, sr);
			const tgt = srTgt(en, sr);
			if(!tgt){
				srDrive(en, sr, room, null, 'hunt');
				return true;
			}
			const d = srDist(en, tgt);
			if(sr.state === 'hunt'){
				srDrive(en, sr, room, tgt, 'hunt');
				sr.timer--;
				if(sr.timer <= 0 || d < 240){
					if(d < 86 && srReady(sr, 'strike') && Math.random() < 0.35){
						srStartAtk(en, sr, 'strike');
						return true;
					}
					const pick = srPickCombo(sr);
					if(pick){
						sr.combo = pick;
						sr.state = 'burst';
						srStartAtk(en, sr, pick.steps[0], { chain:pick.name === 'E', chainIndex:0 });
					} else {
						sr.timer = 16;
						srDrive(en, sr, room, tgt, 'approach');
					}
				}
				return true;
			}
			srDrive(en, sr, room, tgt, 'approach');
			if(d < 200){
				const pick = srPickCombo(sr);
				if(pick){
					sr.combo = pick;
					srStartAtk(en, sr, pick.steps[0], { chain:pick.name === 'E', chainIndex:0 });
				}
			}
			return true;
		}
		sr.state = 'hunt';
		sr.timer = 12;
		return true;
	}

	function startStormRaptorAttack(en, name){
		if(!en || !srIs(en)) return;
		if(!en._sr) srInit(en);
		srStartAtk(en, en._sr, name);
	}

	function srAll(){
		const out = [];
		if(typeof enemies !== 'undefined'){
			for(let i = 0; i < enemies.length; i++) if(enemies[i] && srIs(enemies[i]) && enemies[i]._sr) out.push(enemies[i]);
		}
		if(typeof playerMinions !== 'undefined'){
			for(let i = 0; i < playerMinions.length; i++) if(playerMinions[i] && srIs(playerMinions[i]) && playerMinions[i]._sr) out.push(playerMinions[i]);
		}
		return out;
	}

	function srHex(c, a){
		if(typeof c === 'string' && c[0] === '#'){
			const n = parseInt(c.slice(1), 16);
			return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + (a == null ? 1 : a) + ')';
		}
		return c;
	}
	function srGlow(x, y, r, inner, outer){
		const g = ctx.createRadialGradient(x, y, 1, x, y, r);
		g.addColorStop(0, inner); g.addColorStop(1, outer);
		ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
	}
	function srDrawClaw(x, y, ang, reach, a, twin){
		ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
		ctx.strokeStyle = 'rgba(223,246,255,' + (0.85 * a) + ')';
		ctx.lineWidth = 3.2; ctx.lineCap = 'round';
		ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(reach * 0.45, -18 * a, reach, -6); ctx.stroke();
		ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(reach * 0.4, 16 * a, reach * 0.92, 10); ctx.stroke();
		if(twin){
			ctx.strokeStyle = 'rgba(255,229,102,' + (0.55 * a) + ')';
			ctx.lineWidth = 1.6;
			ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(reach * 0.7, -10); ctx.stroke();
		}
		ctx.fillStyle = 'rgba(180,214,255,' + (0.35 * a) + ')';
		ctx.beginPath(); ctx.ellipse(4, 6, 7, 5, 0.2, 0, Math.PI * 2); ctx.fill();
		ctx.restore();
	}

	function drawStormRaptorWorld(){
		const list = srAll();
		if(!list.length) return;
		const cam = (typeof camera !== 'undefined' && camera) || global.camera || { x:0, y:0 };
		const camx = cam.x, camy = cam.y;
		for(let n = 0; n < list.length; n++){
			if(list[n]._jungleHidden || list[n]._jungleDormant) continue;
			const sr = list[n]._sr;
			if(!sr) continue;
			for(let i = 0; i < sr.fx.length; i++){
				const f = sr.fx[i];
				const a = Math.max(0, f.life / Math.max(1, f.max));
				const x = f.x - camx, y = f.y - camy;
				ctx.save();
				if(f.kind === 'lock'){
					ctx.strokeStyle = 'rgba(255,229,102,' + (0.35 + 0.55 * a) + ')';
					ctx.lineWidth = 2;
					ctx.strokeRect(x - 22, y - 22, 44, 44);
					ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x, y - 14); ctx.moveTo(x, y + 14); ctx.lineTo(x, y + 30);
					ctx.moveTo(x - 30, y); ctx.lineTo(x - 14, y); ctx.moveTo(x + 14, y); ctx.lineTo(x + 30, y); ctx.stroke();
					ctx.fillStyle = 'rgba(255,229,102,' + (0.75 * a) + ')';
					ctx.font = 'bold 11px Arial'; ctx.textAlign = 'center';
					ctx.fillText(f.label || 'LOCK', x, y - 36);
				} else if(f.kind === 'diveLine'){
					ctx.strokeStyle = 'rgba(142,198,255,' + (0.25 + 0.5 * a) + ')';
					ctx.setLineDash([8, 7]); ctx.lineWidth = 2;
					ctx.beginPath(); ctx.moveTo(f.x - camx, f.y - camy); ctx.lineTo(f.x2 - camx, f.y2 - camy); ctx.stroke();
					ctx.setLineDash([]);
				} else if(f.kind === 'claw' || f.kind === 'finisher'){
					srDrawClaw(x, y, f.ang, f.reach || 70, a, f.kind === 'finisher');
				} else if(f.kind === 'cross'){
					srDrawClaw(x, y, f.ang - 0.4, 74, a, false);
					srDrawClaw(x, y, f.ang + 0.45, 74, a, true);
				} else if(f.kind === 'beak'){
					ctx.translate(x, y); ctx.rotate(f.ang);
					ctx.fillStyle = 'rgba(255,229,102,' + (0.8 * a) + ')';
					ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(66, -10); ctx.lineTo(70, 0); ctx.lineTo(66, 10); ctx.closePath(); ctx.fill();
					ctx.strokeStyle = 'rgba(223,246,255,' + (0.9 * a) + ')'; ctx.lineWidth = 2; ctx.stroke();
				} else if(f.kind === 'wing' || f.kind === 'pounce'){
					ctx.translate(x, y); ctx.rotate(f.ang);
					ctx.strokeStyle = 'rgba(201,232,255,' + (0.85 * a) + ')';
					ctx.lineWidth = 4; ctx.beginPath();
					ctx.moveTo(-8, 0); ctx.quadraticCurveTo(30, -28, 78, -8); ctx.stroke();
					if(f.kind === 'pounce'){
						ctx.strokeStyle = 'rgba(255,229,102,' + (0.7 * a) + ')';
						ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(20, 36); ctx.lineTo(-8, 40); ctx.stroke();
					}
				} else if(f.kind === 'impact'){
					srGlow(x, y, (f.r || 46) * a, 'rgba(255,229,102,' + (0.45 * a) + ')', 'rgba(110,168,255,0)');
					ctx.strokeStyle = 'rgba(223,246,255,' + (0.7 * a) + ')';
					ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, (f.r || 46) * (1.15 - a * 0.3), 0, Math.PI * 2); ctx.stroke();
				} else if(f.kind === 'shockwave'){
					ctx.strokeStyle = 'rgba(190,230,255,' + (0.55 * a) + ')';
					ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(x, y, f.r, f.r * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
					ctx.strokeStyle = 'rgba(255,229,102,' + (0.28 * a) + ')';
					ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, f.r * 0.82, f.r * 0.5, 0, 0, Math.PI * 2); ctx.stroke();
				} else if(f.kind === 'streak' || f.kind === 'charge' || f.kind === 'javelinCharge' || f.kind === 'javelinFlash'){
					srGlow(x, y, f.kind === 'javelinCharge' ? 36 : 22, 'rgba(180,220,255,' + (0.35 * a) + ')', 'rgba(80,140,220,0)');
					if(f.kind === 'javelinCharge'){
						ctx.strokeStyle = 'rgba(255,229,102,' + (0.7 * a) + ')';
						ctx.lineWidth = 2;
						ctx.beginPath(); ctx.moveTo(x - 22, y - 8); ctx.lineTo(x, y); ctx.lineTo(x + 22, y - 8); ctx.stroke();
					}
				}
				ctx.restore();
			}
		}
	}

	function drawStormRaptorProj(p){
		const cam = (typeof camera !== 'undefined' && camera) || global.camera || { x:0, y:0 };
		const x = p.x - cam.x, y = p.y - cam.y;
		const ang = Math.atan2(p.vy, p.vx);
		ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
		if(p._srStyle === 'feather'){
			srGlow(0, 0, 18, 'rgba(201,232,255,0.4)', 'rgba(110,168,255,0)');
			ctx.fillStyle = p.color || '#c9e8ff';
			ctx.beginPath();
			ctx.moveTo(20, 0);
			ctx.quadraticCurveTo(4, -7, -18, -3);
			ctx.lineTo(-12, 0);
			ctx.quadraticCurveTo(4, 7, 20, 0);
			ctx.closePath();
			ctx.fill();
			ctx.strokeStyle = '#ffe566';
			ctx.lineWidth = 1.4;
			ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(-16, 0); ctx.stroke();
			ctx.strokeStyle = '#8ec6ff';
			ctx.lineWidth = 1;
			ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(-4, -2); ctx.moveTo(6, 4); ctx.lineTo(-4, 2); ctx.stroke();
			ctx.restore();
			return;
		}
		srGlow(0, 0, 22, 'rgba(255,229,102,0.45)', 'rgba(110,168,255,0)');
		ctx.fillStyle = '#e8f6ff';
		ctx.beginPath(); ctx.moveTo(22, 0); ctx.lineTo(-16, -6); ctx.lineTo(-10, 0); ctx.lineTo(-16, 6); ctx.closePath(); ctx.fill();
		ctx.strokeStyle = '#ffe566'; ctx.lineWidth = 1.6; ctx.stroke();
		ctx.restore();
	}

	function srSheetGrid(img){
		if(!img || !img.naturalWidth) return { cols:4, rows:4 };
		const ratio = img.naturalWidth / img.naturalHeight;
		if(Math.abs(ratio - 4 / 3) < 0.18) return { cols:8, rows:6 };
		return { cols:4, rows:4 };
	}
	function stormRaptorSpriteRow(en){
		if(!en || !srIs(en)) return null;
		const sr = en._sr;
		const grid = srSheetGrid(typeof ENEMY_SPRITE_SHEETS !== 'undefined' ? ENEMY_SPRITE_SHEETS.stormRaptor : null);
		if(en.dead) return grid.rows - 1;
		if(!sr) return 1;
		if(grid.rows >= 6){
			const n = sr.atk && sr.atk.name;
			if(n === 'dive') return 2;
			if(n === 'flurry' || n === 'beak' || n === 'strike') return 3;
			if(n === 'rush' || n === 'pounce') return 4;
			if(n === 'javelin' || n === 'clap' || n === 'feathers') return 4;
			if(sr.mode === 'grounded' || sr.state === 'recover') return 0;
			return 1;
		}
		if(sr.atk || sr.mode === 'burst') return 2;
		if(sr.mode === 'grounded' || sr.state === 'recover') return 0;
		return 1;
	}

	function drawStormRaptorFallback(en){
		if(en && (en._jungleHidden || en._jungleDormant)) return true;
		const camx = (typeof camera !== 'undefined') ? camera.x : 0;
		const camy = (typeof camera !== 'undefined') ? camera.y : 0;
		const ex = en.x - camx, ey = en.y - camy;
		const cx = ex + en.w / 2, cy = ey + en.h / 2;
		const sr = en._sr;
		const name = sr && sr.atk && sr.atk.name;
		const t = en.animTimer || 0;
		const f = en.facing || 1;
		ctx.save();
		ctx.translate(cx, cy);
		ctx.scale(f, 1);
		const dive = name === 'dive';
		const rush = name === 'rush';
		const pounce = name === 'pounce';
		const beak = name === 'beak';
		const flap = Math.sin(t * (dive ? 0.28 : 0.14)) * (dive ? 4 : 10);
		if(dive) ctx.rotate(0.55);
		if(pounce) ctx.rotate(0.85);
		if(rush) ctx.rotate(0.15);
		ctx.fillStyle = en.flash > 0 ? '#ffffff' : '#4455aa';
		ctx.beginPath(); ctx.moveTo(-6, -4); ctx.quadraticCurveTo(-38, -22 + flap, -48, -2); ctx.quadraticCurveTo(-30, 8, -8, 6); ctx.fill();
		ctx.beginPath(); ctx.moveTo(4, -2); ctx.quadraticCurveTo(34, -26 - flap, 46, 2); ctx.quadraticCurveTo(22, 10, 8, 6); ctx.fill();
		ctx.fillStyle = en.flash > 0 ? '#ffffff' : '#5566aa';
		ctx.beginPath(); ctx.ellipse(0, 4, 22, 14, -0.2, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = '#6677bb';
		ctx.beginPath(); ctx.ellipse(18, -2, 10, 8, 0.15, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = '#ffd24a';
		ctx.beginPath();
		if(beak){ ctx.moveTo(26, -4); ctx.lineTo(48, 0); ctx.lineTo(26, 5); }
		else { ctx.moveTo(26, -3); ctx.lineTo(38, 0); ctx.lineTo(26, 4); }
		ctx.closePath(); ctx.fill();
		ctx.fillStyle = '#ffe566';
		ctx.beginPath(); ctx.arc(20, -5, 2.4, 0, Math.PI * 2); ctx.fill();
		ctx.fillStyle = '#3a4a88';
		ctx.beginPath(); ctx.moveTo(-16, 8); ctx.lineTo(-34, 22); ctx.lineTo(-8, 16); ctx.fill();
		ctx.strokeStyle = 'rgba(223,246,255,0.75)'; ctx.lineWidth = 1.6;
		ctx.beginPath(); ctx.moveTo(6, 16); ctx.lineTo(14, 26); ctx.moveTo(12, 16); ctx.lineTo(22, 24); ctx.stroke();
		if(sr && sr.atk){
			ctx.strokeStyle = 'rgba(255,229,102,0.55)';
			ctx.strokeRect(-en.w * 0.2, -en.h * 0.28, 8, 8);
		}
		ctx.restore();
		if(!srFriendly(en)){
			ctx.fillStyle = '#ffee44'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
			ctx.fillText('★ Storm Raptor', cx, ey - 12);
		}
		return true;
	}

	function drawStormRaptorSprite(en){
		if(!en || !srIs(en)) return false;
		if(en._jungleHidden || en._jungleDormant) return true;
		const img = (typeof ENEMY_SPRITE_SHEETS !== 'undefined') ? ENEMY_SPRITE_SHEETS.stormRaptor : null;
		if(!img || !img.complete || !img.naturalWidth) return drawStormRaptorFallback(en);
		const grid = srSheetGrid(img);
		const fW = img.naturalWidth / grid.cols;
		const fH = img.naturalHeight / grid.rows;
		const row = Math.min(stormRaptorSpriteRow(en), grid.rows - 1);
		if(en._srSprRow !== row){ en._srSprRow = row; en._srSprFrame = 0; en._srSprTimer = 0; }
		en._srSprTimer = (en._srSprTimer || 0) + 1;
		const fps = (typeof SPRITE_FPS === 'number') ? SPRITE_FPS : 8;
		if(en._srSprTimer >= fps){
			en._srSprTimer = 0;
			if(en.dead){ if((en._srSprFrame || 0) < grid.cols - 1) en._srSprFrame++; }
			else en._srSprFrame = ((en._srSprFrame || 0) + 1) % grid.cols;
		}
		const frame = Math.min(en._srSprFrame || 0, grid.cols - 1);
		const dest = (typeof enemySpriteDestSize === 'function') ? enemySpriteDestSize(en, fW, fH) : { rW:en.w * 2, rH:en.h * 2 };
		const camx = (typeof camera !== 'undefined') ? camera.x : 0;
		const camy = (typeof camera !== 'undefined') ? camera.y : 0;
		const cx = en.x - camx + en.w / 2, cy = en.y - camy + en.h / 2;
		ctx.save();
		if(en.flash > 0) ctx.filter = 'brightness(2.4) saturate(0.35)';
		if(en.facing === -1){
			ctx.translate(cx, cy); ctx.scale(-1, 1);
			ctx.drawImage(img, frame * fW, row * fH, fW, fH, -dest.rW / 2, -dest.rH / 2, dest.rW, dest.rH);
		} else {
			ctx.drawImage(img, frame * fW, row * fH, fW, fH, cx - dest.rW / 2, cy - dest.rH / 2, dest.rW, dest.rH);
		}
		ctx.restore();
		return true;
	}

	function configureStormRaptor(){
		if(typeof ENEMY_TYPES === 'undefined' || !ENEMY_TYPES.stormRaptor) return;
		const r = ENEMY_TYPES.stormRaptor;
		r.name = 'Storm Raptor';
		r.w = Math.max(r.w || 0, 128);
		r.h = Math.max(r.h || 0, 100);
		r.moveSpeed = Math.max(r.moveSpeed || 0, 5.5);
		r.detectRange = Math.max(r.detectRange || 0, 900);
		r.attackRange = Math.max(r.attackRange || 0, 820);
		r.aiBehavior = 'ambush';
		r.spells = [
			{ name:'lightningDive', cooldown:190, range:780, castFn:'castRaptorLightningDive' },
			{ name:'talonFlurry', cooldown:130, range:260, castFn:'castRaptorTalonFlurry' },
			{ name:'thunderbeak', cooldown:110, range:220, castFn:'castRaptorThunderbeak' },
			{ name:'wingRush', cooldown:165, range:420, castFn:'castRaptorWingRush' },
			{ name:'stormPounce', cooldown:240, range:340, castFn:'castRaptorStormPounce' },
			{ name:'lightningJavelin', cooldown:185, range:700, castFn:'castRaptorLightningJavelin' },
			{ name:'thunderclap', cooldown:200, range:320, castFn:'castRaptorThunderclap' },
			{ name:'lightningFeathers', cooldown:210, range:760, castFn:'castRaptorLightningFeathers' },
			{ name:'talonStrike', cooldown:40, range:140, castFn:'castRaptorTalonStrike' }
		];
		const casts = {
			castRaptorLightningDive: function(en){ startStormRaptorAttack(en, 'dive'); },
			castRaptorTalonFlurry: function(en){ startStormRaptorAttack(en, 'flurry'); },
			castRaptorThunderbeak: function(en){ startStormRaptorAttack(en, 'beak'); },
			castRaptorWingRush: function(en){ startStormRaptorAttack(en, 'rush'); },
			castRaptorStormPounce: function(en){ startStormRaptorAttack(en, 'pounce'); },
			castRaptorLightningJavelin: function(en){ startStormRaptorAttack(en, 'javelin'); },
			castRaptorThunderclap: function(en){ startStormRaptorAttack(en, 'clap'); },
			castRaptorLightningFeathers: function(en){ startStormRaptorAttack(en, 'feathers'); },
			castRaptorTalonStrike: function(en){ startStormRaptorAttack(en, 'strike'); },
			castLightningStrike: function(en){ startStormRaptorAttack(en, 'javelin'); },
			castStormDive: function(en){ startStormRaptorAttack(en, 'dive'); },
			castThunderclap: function(en){ startStormRaptorAttack(en, 'clap'); },
			castGaleForce: function(en){ startStormRaptorAttack(en, 'rush'); },
			castTempestFury: function(en){ startStormRaptorAttack(en, 'flurry'); }
		};
		for(const k in casts){
			global[k] = casts[k];
			if(typeof CAST_FNS !== 'undefined') CAST_FNS[k] = casts[k];
		}
	}

	configureStormRaptor();
	global.updateStormRaptor = updateStormRaptor;
	global.drawStormRaptorWorld = drawStormRaptorWorld;
	global.drawStormRaptorProj = drawStormRaptorProj;
	global.drawStormRaptorSprite = drawStormRaptorSprite;
	global.stormRaptorSpriteRow = stormRaptorSpriteRow;
	global.startStormRaptorAttack = startStormRaptorAttack;
})(typeof window !== 'undefined' ? window : globalThis);
