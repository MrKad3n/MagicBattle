/* =============================================================
   Verdant Colossus — Heart of the Worldroot
   Stationary raid boss. Five staggerable body systems. The arena
   is his body; he does not walk. Strongest dungeon boss.
   ============================================================= */
(function(global){
	'use strict';

	const COLS = 6, ROWS = 4, ROOT_COLS = 7, SPR_FPS = 16;
	const PART_COLS = { torso:COLS, armL:COLS, armR:COLS, crown:COLS, roots:ROOT_COLS };
	const SHEETS = {
		torso: new Image(), armL: new Image(), armR: new Image(),
		roots: new Image(), crown: new Image()
	};
	SHEETS.torso.src = 'images/newEnemies/verdantCore.png';
	SHEETS.armL.src = 'images/newEnemies/verdantLeftArm.png';
	SHEETS.armR.src = 'images/newEnemies/verdantRightArm.png';
	SHEETS.roots.src = 'images/newEnemies/verdantRoot.png';
	SHEETS.crown.src = 'images/newEnemies/verdantCrown.png';

	function sheetOk(img){ return img && img.complete && img.naturalWidth > 8; }

	const PART_ORDER = ['armL','armR','crown','roots','heart'];
	const PART_LABEL = { armL:'LEFT ARM', armR:'RIGHT ARM', crown:'CROWN', roots:'ROOT NETWORK', heart:'HEART' };
	const STAGGER = { armL:4800, armR:4600, crown:4400, roots:5200 };
	const DOWN_T = { armL:960, armR:900, crown:840, roots:1020 };

	function living(){
		return typeof IS_DUNGEON !== 'undefined' && IS_DUNGEON && typeof DUNGEON_TYPE !== 'undefined'
			&& DUNGEON_TYPE === 'earth' && typeof dungeon !== 'undefined' && dungeon && dungeon._jungle;
	}
	function dmgMul(){ return (typeof DIFF_DMG_MULT === 'number') ? DIFF_DMG_MULT : 1; }
	function px(){ return player.x + player.w / 2; }
	function py(){ return player.y + player.h / 2; }
	function leadX(){ return px() + (player.vx || 0) * 14; }
	function leadY(){ return py() + (player.vy || 0) * 10; }
	function inRect(x, y, w, h){
		return player.x + player.w > x && player.x < x + w && player.y + player.h > y && player.y < y + h;
	}
	function circHit(x, y, r){
		const dx = px() - x, dy = py() - y;
		return dx * dx + dy * dy <= r * r;
	}
	function hitP(n, extra){
		if(player.iFrames > 0) return false;
		if(typeof damagePlayer !== 'function') return false;
		damagePlayer(Math.round(n * dmgMul() * 1.35), extra || []);
		return true;
	}
	function banner(t){
		if(global.DungeonEnv && DungeonEnv.showBanner) DungeonEnv.showBanner(t);
		else if(typeof notify === 'function') notify(t);
	}
	function shake(a, t){ if(typeof shakeScreen === 'function') shakeScreen(a, t); }
	function num(x, y, text, color){
		if(typeof dmgNumbers === 'undefined') return;
		dmgNumbers.push({ x:x, y:y, text:text, age:0, color:color || '#b7f56a' });
	}
	function spark(x, y, n, col){
		if(typeof particles === 'undefined') return;
		const c = col || { r:110, g:210, b:90 };
		for(let i = 0; i < (n || 12); i++){
			const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 6;
			particles.push({
				x:x + (Math.random() - .5) * 28, y:y + (Math.random() - .5) * 28,
				vx:Math.cos(a) * s, vy:Math.sin(a) * s - 1.2,
				life:20 + Math.random() * 22, maxLife:42, r:2 + Math.random() * 3, color:c
			});
		}
	}
	function woodBurst(x, y, n, power){
		for(let i = 0; i < n; i++){
			const a = -Math.PI * 0.5 + (Math.random() - 0.5) * 2.2;
			const sp = 3.6 + Math.random() * 5.5;
			proj(x, y, Math.cos(a) * sp, Math.sin(a) * sp, {
				color:'#6a4424', color2:'#d4ef7a', power:power || 16,
				width:12 + Math.random() * 12, height:9 + Math.random() * 8,
				shape:'spike', maxAge:80 + Math.random() * 30, trail:'spark',
				style:'shard', noWallCollide:true, gravity:0.28
			});
		}
	}
	function resetCadence(vc){
		if(!vc) return;
		vc.partCd = { armL:0, armR:0, crown:0, roots:0, heart:0 };
		vc.launchCd = 10;
		vc.stall = 0;
		vc.atks = [];
	}
	function tele(x, y, w, h, frames, label){
		if(typeof spawnTelegraph === 'function'){
			spawnTelegraph(x, y, w, h, frames, 'rgba(118,214,86,.30)', 'rect', label || '');
		}
	}
	function teleCircle(x, y, rad, frames){
		if(typeof spawnTelegraph === 'function'){
			spawnTelegraph(x - rad, y - rad, rad * 2, rad * 2, frames, 'rgba(150,230,90,.32)', 'circle', '');
		}
	}
	function proj(x, y, vx, vy, opts){
		opts = opts || {};
		opts.noZoneNerf = true;
		if(typeof spawnEnemyProj !== 'function') return null;
		const p = spawnEnemyProj(x, y, vx, vy, opts);
		if(p) p._vcStyle = opts.style || 'seed';
		return p;
	}
	function roomOf(en){
		const rooms = (typeof dungeon !== 'undefined' && dungeon && dungeon.rooms) || [];
		if(en.roomId != null && rooms[en.roomId]) return rooms[en.roomId];
		for(let i = 0; i < rooms.length; i++){
			const r = rooms[i];
			if(r.kind === 'boss') return r;
		}
		return null;
	}
	function floorY(r){ return r ? r.y + r.h - 80 : 0; }
	function vcBoss(){
		if(typeof enemies === 'undefined') return null;
		for(let i = 0; i < enemies.length; i++){
			const e = enemies[i];
			if(e && e.type === 'earthColossus' && !e.dead) return e;
		}
		return null;
	}
	function seedPoison(){ return ['poison']; }

	function configureVerdant(){
		if(typeof ENEMY_TYPES === 'undefined') return;
		const boss = ENEMY_TYPES.earthColossus;
		if(!boss) return;
		boss.name = 'Verdant Colossus';
		boss.hp = 20000;
		boss.w = 540;
		boss.h = 720;
		boss.moveSpeed = 0;
		boss.detectRange = 3200;
		boss.attackRange = 3200;
		boss.color = '#2a5530';
		boss.color2 = '#c6f36a';
		boss.spells = [];
		boss._verdantRaid = true;
	}

	function makePart(hp){
		return { hp:hp, max:hp, down:0, flash:0, row:0, frame:0, timer:0 };
	}

	function ensure(en){
		if(en._vc) return en._vc;
		const r = roomOf(en);
		const vc = {
			phase:1, mode:'idle', atk:null, cd:24, t:0, seed:(en.x * 13 + en.y) | 0,
			last:'', combo:0, dark:0, exposed:0, rebirthDone:false, finaleLoops:0,
			parts:{
				armL:makePart(STAGGER.armL),
				armR:makePart(STAGGER.armR),
				crown:makePart(STAGGER.crown),
				roots:makePart(STAGGER.roots)
			},
			cut:{ armL:false, armR:false, crown:false, roots:false },
			haz:[], grabs:[], lines:[], covers:[], nodes:[], atks:[],
			partCd:{ armL:0, armR:0, crown:0, roots:0, heart:0 }, launchCd:12,
			hand:null, blade:null, thorn:null, pulses:[], sap:[], seeds:[],
			lifelines:[], rebirth:[], minionT:0
		};
		en._vc = vc;
		en._stunResist = 99;
		en.bossPhase = 1;
		configureVerdant();
		const hpM = (typeof DIFF_HP_MULT === 'number') ? DIFF_HP_MULT : 1;
		const szM = (typeof DIFF_SIZE_MULT === 'number') ? DIFF_SIZE_MULT : 1;
		const target = Math.round(20000 * hpM);
		if(en.maxHp < target * 0.85){
			const ratio = en.hp / Math.max(1, en.maxHp);
			en.maxHp = target;
			en.hp = Math.round(target * ratio);
		}
		en.w = Math.max(en.w, Math.round(540 * szM));
		en.h = Math.max(en.h, Math.round(720 * szM));
		if(en.typeDef){
			en.typeDef.name = 'Verdant Colossus';
			en.typeDef.moveSpeed = 0;
			en.typeDef.spells = [];
		}
		anchor(en, r);
		buildCovers(en, r);
		return vc;
	}

	function anchor(en, r){
		if(!r) return;
		const dais = (typeof dungeon !== 'undefined' && dungeon.platforms || []).find(function(p){
			return p.roomId === r.id && p.central;
		});
		const fl = dais ? dais.y + 36 : floorY(r) - 8;
		en._vc.ax = r.x + r.w / 2 - en.w / 2;
		en._vc.ay = fl - en.h + 70;
		en.x = en._vc.ax;
		en.y = en._vc.ay;
		en.vx = 0; en.vy = 0;
	}

	function buildCovers(en, r){
		if(!r) return;
		const vc = en._vc;
		vc.covers = [
			{ x:r.x + 480, y:r.y + r.h - 540, w:180, h:460, id:'W' },
			{ x:r.x + r.w - 660, y:r.y + r.h - 540, w:180, h:460, id:'E' },
			{ x:r.x + r.w / 2 - 200, y:r.y + r.h - 320, w:400, h:200, id:'S' },
			{ x:r.x + r.w / 2 - 220, y:r.y + 480, w:440, h:160, id:'N' }
		];
		layoutRoots(en, r);
	}

	function rootCellSize(){
		const img = SHEETS.roots;
		if(sheetOk(img)){
			const fW = img.naturalWidth / ROOT_COLS;
			const fH = img.naturalHeight / ROWS;
			const maxH = 260;
			const s = fH > maxH ? (maxH / fH) : 1;
			return { w: fW * s, h: fH * s };
		}
		return { w: 180, h: 130 };
	}

	function layoutRoots(en, r){
		if(!r || !en._vc) return;
		const cell = rootCellSize();
		const nw = cell.w, nh = cell.h;
		const fl = floorY(r);
		const nodes = [];
		const step = Math.max(nw * 0.78, 140);
		let i = 0;
		for(let x = r.x + 24; x + nw <= r.x + r.w - 24; x += step){
			nodes.push({
				x:x, y:fl - nh + 22 + Math.sin(i * 1.3) * 8,
				w:nw, h:nh, frame:i % ROOT_COLS, row:0
			});
			i++;
		}
		for(let x = r.x + 24 + step * 0.42; x + nw <= r.x + r.w - 24; x += step * 1.12){
			nodes.push({
				x:x, y:fl - nh - 36 + Math.cos(i * 0.9) * 10,
				w:nw, h:nh, frame:(i * 3) % ROOT_COLS, row:0, hurt:true
			});
			i++;
		}
		en._vc.nodes = nodes;
		en._vc.rootsLaid = sheetOk(SHEETS.roots);
	}

	function lock(en){
		en.vx = 0; en.vy = 0; en.charging = false;
		en.stunTimer = 0; en._kbTimer = 0;
		if(en._vc && en._vc.ax != null){ en.x = en._vc.ax; en.y = en._vc.ay; }
		en.animTimer = (en.animTimer || 0) + 1;
	}

	function tickLimbs(en){
		const vc = en._vc;
		const t = en.animTimer || 0;
		if(!vc.limb) vc.limb = { armL:{x:0,y:0}, armR:{x:0,y:0}, crown:{x:0,y:0}, roots:{x:0,y:0} };
		function toward(k, gx, gy, rate){
			const o = vc.limb[k];
			o.x += (gx - o.x) * rate;
			o.y += (gy - o.y) * rate;
		}
		const swayL = { x: Math.sin(t * 0.015) * 14, y: Math.cos(t * 0.012) * 8 };
		const swayR = { x: Math.sin(t * 0.014 + 1.05) * 12, y: Math.cos(t * 0.011 + 0.5) * 7 };
		const swayC = { x: Math.sin(t * 0.011) * 7, y: Math.cos(t * 0.009) * 5 };
		const swayRt = { x: Math.sin(t * 0.009) * 5, y: Math.sin(t * 0.01) * 3 };
		const atks = vc.atks || [];
		function partAtk(k){
			for(let i = 0; i < atks.length; i++) if(atks[i].part === k) return atks[i];
			return null;
		}
		const aL = partAtk('armL');
		if(aL) toward('armL', swayL.x * 0.4, swayL.y * 0.4, 0.08);
		else toward('armL', swayL.x, swayL.y, 0.03);
		const aR = partAtk('armR');
		if(aR) toward('armR', swayR.x * 0.4, swayR.y * 0.4, 0.08);
		else toward('armR', swayR.x, swayR.y, 0.03);
		const aC = partAtk('crown');
		if(aC){
			toward('crown', Math.max(-36, Math.min(36, (leadX() - en.x - en.w / 2) * 0.07)), 10, 0.07);
		} else toward('crown', swayC.x, swayC.y, 0.025);
		toward('roots', swayRt.x, swayRt.y, 0.025);
	}

	function basePartRects(en){
		const x = en.x, y = en.y, w = en.w, h = en.h;
		const L = (en._vc && en._vc.limb) || { armL:{x:0,y:0}, armR:{x:0,y:0}, crown:{x:0,y:0}, roots:{x:0,y:0} };
		return {
			heart:{ x:x + w * .26, y:y + h * .30, w:w * .48, h:h * .38 },
			armL:{ x:x - w * .98 + L.armL.x, y:y - h * .10 + L.armL.y, w:w * 1.22, h:h * 1.12 },
			armR:{ x:x + w * .86 + L.armR.x, y:y + h * .00 + L.armR.y, w:w * 0.98, h:h * 1.02 },
			crown:{ x:x - w * .28 + L.crown.x, y:y - h * .62 + L.crown.y, w:w * 1.56, h:h * .66 },
			roots:{ x:x - w * .18 + L.roots.x, y:y + h * .74 + L.roots.y, w:w * 1.36, h:h * .34 }
		};
	}

	function partRects(en){
		const rec = basePartRects(en);
		const dsh = en._vc && en._vc.dash;
		if(dsh && dsh.armL){
			rec.armL = { x:dsh.armL.x, y:dsh.armL.y, w:rec.armL.w, h:rec.armL.h };
		}
		if(dsh && dsh.armR){
			rec.armR = { x:dsh.armR.x, y:dsh.armR.y, w:rec.armR.w, h:rec.armR.h };
		}
		return rec;
	}

	function fistBox(part, x, y, w, h){
		if(part === 'armL') return { x:x + w * 0.52, y:y + h * 0.40, w:w * 0.26, h:h * 0.24 };
		return { x:x + w * 0.20, y:y + h * 0.36, w:w * 0.26, h:h * 0.24 };
	}

	function startArmDash(en, part, tx, ty){
		const rec = basePartRects(en)[part];
		const fist = fistBox(part, rec.x, rec.y, rec.w, rec.h);
		en._vc.dash = en._vc.dash || {};
		en._vc.dash[part] = {
			homeX: rec.x, homeY: rec.y,
			x: rec.x, y: rec.y,
			toX: rec.x + (tx - (fist.x + fist.w * 0.5)),
			toY: rec.y + (ty - (fist.y + fist.h * 0.5)),
			w: rec.w, h: rec.h, part:part,
			t: 0, go: 42, hold: 18, back: 28, fired: false
		};
	}

	function armHitsWorld(x, y, w, h){
		if(typeof rectOverlapsSolid === 'function' && rectOverlapsSolid(x, y, w, h)) return true;
		const boxes = [];
		if(typeof dungeon !== 'undefined' && dungeon){
			if(dungeon.solids) boxes.push.apply(boxes, dungeon.solids);
			const rooms = dungeon.rooms || [];
			for(let i = 0; i < rooms.length; i++){
				if(rooms[i].solids) boxes.push.apply(boxes, rooms[i].solids);
			}
		}
		for(let i = 0; i < boxes.length; i++){
			const s = boxes[i];
			if(!s) continue;
			if(x + w > s.x && x < s.x + s.w && y + h > s.y && y < s.y + s.h) return true;
		}
		return false;
	}

	function armHitsPlayerSolid(x, y, w, h){
		if(typeof projectiles === 'undefined') return null;
		for(let i = 0; i < projectiles.length; i++){
			const p = projectiles[i];
			if(!p || !p.isSolidPlatform || p.hasHit) continue;
			if(typeof rectOverlapSolid === 'function'){
				if(rectOverlapSolid(x, y, w, h, p)) return p;
			} else if(typeof getSolidBox === 'function'){
				const sb = getSolidBox(p);
				if(sb && x + w > sb.x && x < sb.x + sb.w && y + h > sb.y && y < sb.y + sb.h) return p;
			}
		}
		return null;
	}

	function retractArm(d){
		d.toX = d.x;
		d.toY = d.y;
		d.t = d.go + d.hold;
	}

	function slamArm(en, part, d){
		if(!d || d.fired) return;
		d.fired = true;
		const fist = fistBox(part, d.x, d.y, d.w || basePartRects(en)[part].w, d.h || basePartRects(en)[part].h);
		const ax = fist.x + fist.w * 0.5, ay = fist.y + fist.h * 0.5;
		shake(part === 'armR' ? 12 : 16, 18);
		spark(ax, ay, 36, { r:120, g:200, b:70 });
		armVolley(en, part, ax, ay, part === 'armR' ? 4 : 3, part === 'armR' ? 22 : 24, part === 'armR' ? 'claw' : 'shard');
		woodBurst(ax, ay, 5, partPow(en, part, 16));
		if(inRect(fist.x - 18, fist.y - 16, fist.w + 36, fist.h + 32)){
			hitP(partPow(en, part, part === 'armR' ? 38 : 42), part === 'armL' ? ['stun'] : []);
			if(part === 'armL') player.vy = -10;
		}
	}

	function tickArmDash(en){
		const dsh = en._vc.dash || {};
		const recs = basePartRects(en);
		for(const k of ['armL','armR']){
			const d = dsh[k];
			if(!d) continue;
			const bw = recs[k].w, bh = recs[k].h;
			d.w = bw; d.h = bh;
			d.t++;
			if(d.t <= d.go){
				const p = d.t / d.go;
				const e = p * p * (3 - 2 * p);
				const nx = d.homeX + (d.toX - d.homeX) * e;
				const ny = d.homeY + (d.toY - d.homeY) * e;
				const fist = fistBox(k, nx, ny, bw, bh);
				const solid = armHitsPlayerSolid(fist.x, fist.y, fist.w, fist.h);
				if(solid){
					solid.hasHit = true;
					if(typeof spawnImpact === 'function') spawnImpact(solid.x, solid.y, solid.color || '#c8e070');
					d.x = nx; d.y = ny;
					slamArm(en, k, d);
					retractArm(d);
					continue;
				}
				if(d.t > 10 && armHitsWorld(fist.x, fist.y, fist.w, fist.h)){
					d.x = nx; d.y = ny;
					slamArm(en, k, d);
					retractArm(d);
					continue;
				}
				d.x = nx; d.y = ny;
			} else if(d.t <= d.go + d.hold){
				d.x = d.toX; d.y = d.toY;
			} else {
				const p = Math.min(1, (d.t - d.go - d.hold) / d.back);
				d.x = d.toX + (d.homeX - d.toX) * (p * p);
				d.y = d.toY + (d.homeY - d.toY) * (p * p);
				if(p >= 1) dsh[k] = null;
			}
			if(d && (d.t > 8 && d.t <= d.go + d.hold)){
				const fist = fistBox(k, d.x, d.y, bw, bh);
				if(inRect(fist.x, fist.y, fist.w, fist.h)) hitP(partPow(en, k, 18), []);
			}
		}
	}

	function armVolley(en, part, x, y, n, power, style){
		const ang = Math.atan2(leadY() - y, leadX() - x);
		for(let i = -n; i <= n; i++){
			const a = ang + i * 0.22;
			proj(x, y, Math.cos(a) * 7.2, Math.sin(a) * 7.2, {
				color: style === 'claw' ? '#7a5028' : '#5c3a1c',
				color2: '#e8ff90', power:partPow(en, part, power),
				width: style === 'claw' ? 26 : 18, height: style === 'claw' ? 16 : 14,
				shape: style === 'claw' ? 'diamond' : 'spike', maxAge: 90, trail:'spark',
				style: style || 'shard', noWallCollide:true
			});
		}
	}

	function hitPartRects(en){
		const pr = partRects(en);
		function shrink(p, l, t, rw, rh){
			return { x:p.x + p.w * l, y:p.y + p.h * t, w:p.w * rw, h:p.h * rh };
		}
		return {
			heart: shrink(pr.heart, 0.16, 0.14, 0.68, 0.70),
			armL: shrink(pr.armL, 0.50, 0.34, 0.30, 0.32),
			armR: shrink(pr.armR, 0.16, 0.30, 0.32, 0.34),
			crown: shrink(pr.crown, 0.28, 0.22, 0.44, 0.48),
			roots: shrink(pr.roots, 0.12, 0.18, 0.76, 0.62)
		};
	}

	function unionRect(en, mode){
		if(!en._vc) return null;
		const pr = mode === 'draw' ? partRects(en) : hitPartRects(en);
		let x = pr.heart.x, y = pr.heart.y, r = pr.heart.x + pr.heart.w, b = pr.heart.y + pr.heart.h;
		for(const k of ['armL','armR','crown','roots']){
			if(en._vc.parts[k].down > 0) continue;
			const p = pr[k];
			x = Math.min(x, p.x); y = Math.min(y, p.y);
			r = Math.max(r, p.x + p.w); b = Math.max(b, p.y + p.h);
		}
		if(mode !== 'draw') b = Math.min(b, en.y + en.h + 6);
		return { x:x, y:y, w:r - x, h:Math.max(40, b - y) };
	}

	function contains(p, x, y){
		return x >= p.x && x <= p.x + p.w && y >= p.y && y <= p.y + p.h;
	}

	function whichPart(en, x, y){
		const vc = en._vc, pr = hitPartRects(en);
		for(const k of ['armL','armR','crown']){
			if(vc.parts[k].down > 0) continue;
			if(contains(pr[k], x, y)) return k;
		}
		if(vc.parts.roots.down <= 0){
			if(contains(pr.roots, x, y)) return 'roots';
		}
		if(contains(pr.heart, x, y)) return 'heart';
		const u = unionRect(en);
		if(u && contains(u, x, y)) return 'heart';
		return null;
	}

	function down(en, k){ return !!(en._vc && en._vc.parts[k] && en._vc.parts[k].down > 0); }
	function cut(en, k){ return !!(en._vc && en._vc.cut[k]); }

	function heartMult(en){
		const vc = en._vc;
		if(vc.mode === 'rebirth') return vc.rebirth.every(function(r){ return r.hp <= 0; }) && vc.exposed > 0 ? 1.75 : 0.18;
		if(vc.mode === 'finale' && vc.exposed > 0) return 2.05;
		if(vc.phase >= 3){
			const alive = (vc.lifelines || []).filter(function(l){ return l.hp > 0; }).length;
			if(alive === 0) return 1.55;
			return 0.72;
		}
		if(vc.exposed > 0) return 1.6;
		return 1;
	}

	function partPow(en, k, base){
		let n = base;
		if(en._vc.phase >= 2) n *= 1.14;
		if(en._vc.phase >= 3) n *= 1.16;
		if(cut(en, k)) n *= 0.58;
		return n;
	}

	function teleMul(en, k){
		let t = 1;
		if(cut(en, k)) t += 0.45;
		if(en._vc.phase === 1) t += 0.08;
		return t;
	}

	function hurtPart(en, k, amount, x, y){
		const p = en._vc.parts[k];
		if(!p || p.down > 0) return;
		p.hp -= amount;
		p.flash = 10;
		en.flash = Math.max(en.flash || 0, 5);
		num(x || (en.x + en.w / 2), y || en.y, Math.round(amount) + '', '#d5ff8a');
		if(p.hp <= 0){
			p.hp = 0;
			p.down = (DOWN_T[k] || 900) - (en._vc.phase - 1) * 80;
			banner(PART_LABEL[k] + ' SHATTERS');
			shake(10, 16);
			spark(x || en.x + en.w / 2, y || en.y + en.h / 2, 28, { r:180, g:230, b:90 });
			if(en._vc.atks){
				en._vc.atks = en._vc.atks.filter(function(a){ return a.part !== k; });
			}
		}
	}

	function tickParts(en){
		const vc = en._vc;
		for(const k of ['armL','armR','crown','roots']){
			const p = vc.parts[k];
			if(p.flash > 0) p.flash--;
			p.timer++;
			if(p.timer >= SPR_FPS){
				p.timer = 0;
				p.frame = (p.frame + 1) % (PART_COLS[k] || COLS);
			}
			if(p.down > 0){
				p.row = 3;
				p.down--;
				if(p.down <= 0){
					p.hp = p.max;
					p.row = 0;
					banner(PART_LABEL[k] + ' RECONNECTS');
					spark(en.x + en.w / 2, en.y + en.h / 2, 18, { r:90, g:200, b:80 });
				}
			} else if(vc.atks && vc.atks.some(function(a){ return a.part === k; })){
				const mine = vc.atks.find(function(a){ return a.part === k; });
				p.row = mine.t < (mine.warn || 40) ? 1 : 2;
			} else if(p.flash > 0){
				p.row = 2;
			} else {
				p.row = 0;
			}
			p.row = Math.max(0, Math.min(ROWS - 1, p.row));
		}
	}

	function behindCover(en){
		const covers = en._vc.covers || [];
		for(let i = 0; i < covers.length; i++){
			if(inRect(covers[i].x, covers[i].y, covers[i].w, covers[i].h)) return true;
		}
		return false;
	}

	function playerInRoom(r){
		if(!r || !player) return true;
		const pad = 280;
		return player.x + player.w > r.x - pad && player.x < r.x + r.w + pad
			&& player.y + player.h > r.y - pad && player.y < r.y + r.h + pad;
	}

	function forceUnlockParts(vc){
		if(!vc) return;
		vc.partCd = vc.partCd || {};
		for(const k of ['armL','armR','crown','roots','heart']){
			const busy = (vc.atks || []).some(function(a){ return a.part === k; });
			if(!busy) vc.partCd[k] = 0;
		}
	}

	function spawnMinions(en, r, n){
		if(typeof ENEMY_TYPES === 'undefined' || typeof enemies === 'undefined') return;
		const types = ['thornWolf','vineCrawler','glowBeetle','rootParasite'];
		const hpM = (typeof DIFF_HP_MULT === 'number') ? DIFF_HP_MULT : 1;
		const szM = (typeof DIFF_SIZE_MULT === 'number') ? DIFF_SIZE_MULT : 1;
		for(let i = 0; i < n; i++){
			const type = types[i % types.length];
			const t = ENEMY_TYPES[type];
			if(!t) continue;
			const ew = Math.round(t.w * szM), eh = Math.round(t.h * szM);
			const x = r.x + 280 + (i * (r.w - 560) / Math.max(1, n - 1));
			const y = floorY(r) - eh;
			enemies.push({
				type:type, typeDef:t, x:x, y:y, w:ew, h:eh, vx:0, vy:0,
				hp:Math.round(t.hp * hpM * 0.9), maxHp:Math.round(t.hp * hpM * 0.9),
				facing:1, patrol:[x - 180, x + 180], patrolDir:1, state:'alert',
				alertTimer:40, spellCooldowns:(t.spells || []).map(function(){ return 30; }),
				currentSpell:0, flash:0, dots:[], stunTimer:0, slowTimer:0, animTimer:0,
				attackAnimTimer:0, dead:false, deathTimer:0, baseY:y, flyOffset:0,
				charging:false, chargeVx:0, chargeVy:0, chargeTimer:0, chargeCastDone:false,
				bossPhase:1, puzzleSeg:4, roomId:en.roomId, _vcMinion:true
			});
		}
	}

	/* ---------- attack picker ---------- */
	function partBusy(en, part){
		const atks = en._vc.atks || [];
		for(let i = 0; i < atks.length; i++) if(atks[i].part === part) return true;
		return false;
	}

	function pickForPart(en, part){
		const vc = en._vc;
		let list;
		if(part === 'armL') list = vc.phase === 1 ? ['fist'] : ['fist','reach','fistRoots'];
		else if(part === 'armR') list = ['guillotine'];
		else if(part === 'crown'){
			if(vc.phase === 1) list = ['barrage'];
			else if(vc.phase === 2) list = ['barrage','thorns','bloom','barrageHeart'];
			else list = ['barrage','thorns','bloom','barrageHeart'];
		} else if(part === 'roots') list = vc.phase === 1 ? ['grasp'] : ['grasp','spears'];
		else {
			if(vc.phase >= 3) list = ['heartbeat','sap','wrath'];
			else list = ['heartbeat','sap'];
		}
		list = list.filter(function(name){
			if(name === vc.last && list.length > 1) return false;
			if(name === 'fistRoots' && (partBusy(en, 'roots') || down(en, 'roots'))) return false;
			if(name === 'barrageHeart' && partBusy(en, 'heart')) return false;
			return true;
		});
		if(!list.length) return null;
		return list[(Math.random() * list.length) | 0];
	}

	function begin(en, name){
		const meta = {
			fist:{ part:'armL', warn:42, label:'WORLDROOT FIST — FIND THE CORRIDORS' },
			fistRoots:{ part:'armL', warn:42, label:'WORLDROOT FIST — THE ROOTS CLOSE THE GAPS' },
			grasp:{ part:'roots', warn:28, label:'GRASPING EARTH — BREAK FREE' },
			barrage:{ part:'crown', warn:40, label:'VERDANT BARRAGE — READ THE PATTERN' },
			barrageHeart:{ part:'crown', warn:40, label:'VERDANT BARRAGE + HEARTBEAT' },
			guillotine:{ part:'armR', warn:32, label:'BRANCH GUILLOTINE — BREAK LINE OF SIGHT' },
			heartbeat:{ part:'heart', warn:22, label:'HEARTBEAT — PULSE, PULSE, GAP' },
			sap:{ part:'heart', warn:24, label:'SAP FLOOD — STAY OFF THE ROOT CHANNELS' },
			thorns:{ part:'crown', warn:24, label:'CROWN OF THORNS — FOLLOW THE GAP' },
			bloom:{ part:'crown', warn:62, label:'THE GREAT BLOOM — FIND THE SAFE LANES' },
			spears:{ part:'roots', warn:32, label:'WORLDROOT SPEARS — THE LINES ERUPT' },
			reach:{ part:'armL', warn:14, label:'THE REACHING HAND — KEEP MOVING' },
			wrath:{ part:'heart', warn:18, label:'FOREST\'S WRATH — READ THE SEQUENCE' }
		}[name] || { part:'heart', warn:24, label:name };
		if(partBusy(en, meta.part)) return false;
		en._vc.atks = en._vc.atks || [];
		en._vc.atks.push({ name:name, part:meta.part, t:0, warn:Math.round(meta.warn * teleMul(en, meta.part)), data:{} });
		en._vc.last = name;
		en._vc.partCd = en._vc.partCd || { armL:0, armR:0, crown:0, roots:0, heart:0 };
		en._vc.partCd[meta.part] = 1;
		banner(meta.label);
		if(name === 'bloom') en._vc.dark = 0.01;
		return true;
	}

	/* ---------- individual attacks ---------- */
	function atkFist(en, atk, r, block){
		const fl = floorY(r);
		const tm = atk.warn;
		if(atk.t === 1){
			atk.data.slamX = Math.max(r.x + 180, Math.min(r.x + r.w - 180, leadX()));
			atk.data.slamY = Math.max(r.y + 720, Math.min(fl - 40, leadY()));
			startArmDash(en, 'armL', atk.data.slamX, atk.data.slamY);
			teleCircle(atk.data.slamX, atk.data.slamY, 90, tm);
			en._vc.haz.push({ kind:'crack', x:atk.data.slamX, y:fl, r:50, grow:140, life:tm, max:tm });
		}
		const d = en._vc.dash && en._vc.dash.armL;
		if(d && !d.fired && d.t >= d.go){
			slamArm(en, 'armL', d);
			if(block){
				for(let b = 0; b < 3; b++){
					en._vc.haz.push({
						kind:'erupt', x:atk.data.slamX + (b - 1) * 160, y:fl,
						h:0, maxH:240, w:40, life:70, dmg:16
					});
				}
			}
		}
		return atk.t > tm + 70;
	}

	function atkGrasp(en, atk, r){
		const fl = floorY(r);
		if(atk.t === 1){
			atk.data.zones = [];
			const lx = leadX();
			const spots = [
				{ x:lx, y:fl },
				{ x:lx + (player.vx >= 0 ? 300 : -300), y:fl },
				{ x:lx + (player.vx >= 0 ? -240 : 240), y:fl },
				{ x:lx + (Math.random() < .5 ? -520 : 520), y:fl }
			];
			for(let i = 0; i < spots.length; i++){
				const z = { x:spots[i].x, y:spots[i].y, grab:i < 2 };
				atk.data.zones.push(z);
				teleCircle(z.x, z.y - 20, 70, atk.warn);
				en._vc.haz.push({ kind:'crack', x:z.x, y:z.y, r:36, grow:90, life:atk.warn, max:atk.warn });
			}
		}
		if(atk.t === atk.warn){
			shake(14, 18);
			for(let i = 0; i < atk.data.zones.length; i++){
				const z = atk.data.zones[i];
				en._vc.haz.push({
					kind:'erupt', x:z.x, y:z.y, h:0, maxH:z.grab ? 340 : 260,
					w:z.grab ? 70 : 52, life:110, dmg:partPow(en, 'roots', 32)
				});
				spark(z.x, z.y, 28, { r:80, g:160, b:50 });
				woodBurst(z.x, z.y - 10, 5, partPow(en, 'roots', 14));
				for(let k = 0; k < 4; k++){
					proj(z.x, z.y - 20, (Math.random() - 0.5) * 4.5, -24 - Math.random() * 10, {
						color:'#4a7028', color2:'#d0ff80', power:partPow(en, 'roots', 18),
						width:16, height:32, shape:'spike', maxAge:140, trail:'spark',
						style:'spear', noWallCollide:true, gravity:0.16
					});
				}
				if(z.grab){
					for(let g = 0; g < 3; g++){
						proj(z.x + (g - 1) * 30, z.y - 30, (g - 1) * 2.4, -8, {
							color:'#4a7028', color2:'#cde98a', power:partPow(en, 'roots', 20),
							width:20, height:14, shape:'orb', maxAge:100, trail:'spark',
							style:'sap', noWallCollide:true, gravity:0.2
						});
					}
				}
			}
		}
		return atk.t > atk.warn + 100;
	}

	function makePattern(r, kind){
		const cx = leadX(), cy = leadY() - 30, pts = [];
		if(kind === 'spiral'){
			for(let i = 0; i < 30; i++){
				const a = i * 0.52, rad = 70 + i * 22;
				pts.push({ x:cx + Math.cos(a) * rad, y:cy + Math.sin(a) * rad * 0.42, wait:i * 2 });
			}
		} else if(kind === 'rings'){
			for(let ring = 1; ring <= 4; ring++){
				const n = 7 + ring * 3, rad = 95 * ring;
				for(let i = 0; i < n; i++){
					const a = (i / n) * Math.PI * 2 + ring * 0.2;
					pts.push({ x:cx + Math.cos(a) * rad, y:cy + Math.sin(a) * rad * 0.5, wait:ring * 6 });
				}
			}
		} else if(kind === 'cross'){
			for(let i = -9; i <= 9; i++){
				pts.push({ x:cx + i * 78, y:cy, wait:Math.abs(i) });
				pts.push({ x:cx, y:cy + i * 46, wait:Math.abs(i) });
			}
		} else {
			const spots = [
				{ x:cx, y:cy },
				{ x:cx + 220, y:cy - 40 },
				{ x:cx - 220, y:cy - 40 },
				{ x:cx + (player.vx || 0) * 18, y:cy + 80 }
			];
			for(let s = 0; s < spots.length; s++){
				for(let i = 0; i < 7; i++){
					const a = i / 7 * Math.PI * 2;
					pts.push({ x:spots[s].x + Math.cos(a) * 70, y:spots[s].y + Math.sin(a) * 40, wait:s * 5 });
				}
			}
		}
		return pts;
	}

	function atkBarrage(en, atk, r, withHeart){
		if(atk.t === 1){
			const kinds = ['spiral','rings','cross','clusters'];
			atk.data.kind = kinds[(Math.random() * kinds.length) | 0];
			atk.data.pts = makePattern(r, atk.data.kind);
			en._vc.seeds = atk.data.pts.map(function(p){
				return { x:p.x, y:p.y, wait:p.wait, life:atk.warn + 8 };
			});
		}
		if(withHeart && atk.t === 1 && !partBusy(en, 'heart')){
			begin(en, 'heartbeat');
		}
		if(atk.t === atk.warn){
			const pts = atk.data.pts || [];
			en._vc.seeds = pts.map(function(p){
				return { x:p.x, y:p.y, wait:p.wait, fire:true };
			});
		}
		return atk.t > atk.warn + 80;
	}

	function atkGuillotine(en, atk, r){
		if(atk.t === 1){
			atk.data.tx = Math.max(r.x + 160, Math.min(r.x + r.w - 160, leadX()));
			atk.data.ty = Math.max(r.y + 780, Math.min(floorY(r) - 50, leadY()));
			startArmDash(en, 'armR', atk.data.tx, atk.data.ty);
			teleCircle(atk.data.tx, atk.data.ty, 80, atk.warn);
		}
		const d = en._vc.dash && en._vc.dash.armR;
		if(d && !d.fired && d.t >= d.go) slamArm(en, 'armR', d);
		return atk.t > atk.warn + 80;
	}

	function atkHeartbeat(en, atk, r){
		if(atk.t === 1){
			atk.data.n = 0;
			atk.data.next = atk.warn;
			atk.data.gapEvery = 3;
		}
		if(atk.t === atk.data.next){
			const n = atk.data.n++;
			const isGap = (n % atk.data.gapEvery) === (atk.data.gapEvery - 1);
			const pr = partRects(en).heart;
			const cx = pr.x + pr.w / 2, cy = pr.y + pr.h / 2;
			en._vc.pulses.push({
				x:cx, y:cy, r:40, vr:8.2 + (en._vc.phase >= 3 ? 1.4 : 0),
				life:110, dmg:isGap ? 0 : partPow(en, 'heart', 27), gap:isGap
			});
			if(!isGap) shake(5, 8);
			const gapWait = isGap ? 50 : 40;
			atk.data.next = atk.t + Math.max(18, gapWait - (en._vc.phase - 1) * 4);
		}
		return atk.t > atk.warn + 250;
	}

	function sapChannels(r){
		const lx = Math.max(r.x + 80, Math.min(r.x + r.w - 420, leadX() - 160));
		const ly = Math.max(r.y + r.h * .62, Math.min(floorY(r) - 90, leadY() - 20));
		return [
			{ x:lx, y:ly, w:320, h:90 },
			{ x:r.x + r.w * .07, y:r.y + r.h * .82, w:r.w * .30, h:r.h * .10 },
			{ x:r.x + r.w * .40, y:r.y + r.h * .86, w:r.w * .22, h:r.h * .08 },
			{ x:r.x + r.w * .64, y:r.y + r.h * .81, w:r.w * .28, h:r.h * .11 },
			{ x:lx - 180, y:r.y + r.h * .70, w:r.w * .18, h:r.h * .08 }
		];
	}

	function atkSap(en, atk, r){
		const pr = partRects(en).heart;
		const hx = pr.x + pr.w / 2, hy = pr.y + pr.h / 2;
		if(atk.t === 1){
			const ch = sapChannels(r);
			const use = down(en, 'roots') ? ch.slice(0, 2) : ch;
			atk.data.ch = use;
			for(let i = 0; i < use.length; i++){
				teleCircle(use[i].x + use[i].w / 2, use[i].y + use[i].h / 2, Math.max(50, use[i].w * 0.22), atk.warn);
			}
		}
		if(atk.t === atk.warn){
			shake(10, 14);
			const life = 200;
			for(let i = 0; i < atk.data.ch.length; i++){
				const c = atk.data.ch[i];
				en._vc.sap.push({ x:c.x, y:c.y, w:c.w, h:c.h, life:life, max:life });
			}
			for(let i = 0; i < 9; i++){
				const a = Math.atan2(leadY() - hy, leadX() - hx) + (i - 4) * 0.18;
				proj(hx, hy, Math.cos(a) * (5.5 + i * 0.25), Math.sin(a) * (4.2 + i * 0.2), {
					color:'#c8d030', color2:'#fff06a', power:partPow(en, 'heart', 20),
					width:20, height:16, shape:'orb', maxAge:110, trail:'spark',
					style:'sap', noWallCollide:true, gravity:0.12
				});
			}
		}
		if(atk.t > atk.warn && atk.t % 18 === 0){
			proj(hx, hy + 20, (leadX() - hx) * 0.012, 6.5, {
				color:'#c8d030', color2:'#fff06a', power:partPow(en, 'heart', 16),
				width:18, height:14, shape:'orb', maxAge:90, trail:'spark',
				style:'sap', noWallCollide:true, gravity:0.18
			});
		}
		return atk.t > atk.warn + 200;
	}

	function atkThorns(en, atk, r){
		if(atk.t === 1){
			const pr = partRects(en).heart;
			en._vc.thorn = {
				x:pr.x + pr.w / 2, y:pr.y + pr.h / 2,
				inner: 300, outer: 368, ang: 0, dir: 1,
				gap: 0.62, gapA: Math.atan2(leadY() - (pr.y + pr.h / 2), leadX() - (pr.x + pr.w / 2)) + Math.PI,
				life: 280, dmg: partPow(en, 'crown', 22)
			};
		}
		if(en._vc.thorn && atk.t === 140) en._vc.thorn.dir *= -1;
		return atk.t > 280;
	}

	function atkBloom(en, atk, r){
		const pr = partRects(en).heart;
		const cx = pr.x + pr.w / 2, cy = pr.y - 80;
		if(atk.t === 1){
			en._vc.dark = 0.08;
			atk.data.safe = [4, 5, 16, 17, 27, 28];
			en._vc.haz.push({ kind:'bloom', x:cx, y:cy, r:40, life:atk.warn, max:atk.warn });
		}
		en._vc.dark = Math.min(0.55, (en._vc.dark || 0) + 0.008);
		if(atk.t === atk.warn){
			shake(14, 18);
			const n = 34;
			const aimA = Math.atan2(leadY() - cy, leadX() - cx);
			for(let i = 0; i < n; i++){
				if(atk.data.safe.indexOf(i) >= 0) continue;
				const a = (i / n) * Math.PI * 2;
				const toward = Math.abs(Math.atan2(Math.sin(a - aimA), Math.cos(a - aimA))) < 0.55;
				const sp = toward ? 8.4 : 6.4;
				proj(cx, cy, Math.cos(a) * sp, Math.sin(a) * sp, {
					color:'#e8f07a', color2:'#ff9ad2', power:partPow(en, 'crown', 17),
					width:18, height:14, shape:'diamond', maxAge:130, trail:'magic',
					style:'petal', noWallCollide:true
				});
			}
			en._vc.dark = 0.2;
		}
		if(atk.t > atk.warn) en._vc.dark *= 0.94;
		return atk.t > atk.warn + 80;
	}

	function spearPattern(r, kind){
		const fl = floorY(r);
		const lx = leadX(), ly = leadY();
		const lines = [
			{ x:lx - 28, y:r.y + 620, w:56, h:fl - (r.y + 620) },
			{ x:r.x + 160, y:ly - 24, w:r.w - 320, h:50 }
		];
		if(kind === 'straight'){
			lines.push({ x:r.x + 160, y:fl - 36, w:r.w - 320, h:48 });
			lines.push({ x:r.x + 160, y:fl - 260, w:r.w - 320, h:48 });
		} else if(kind === 'cross'){
			lines.push({ x:r.x + 200, y:ly - 24, w:r.w - 400, h:50 });
			lines.push({ x:lx - 28, y:r.y + 700, w:56, h:fl - (r.y + 700) });
		} else if(kind === 'Y'){
			const ox = lx, oy = fl - 40;
			lines.push({ x:ox - 28, y:oy - 520, w:56, h:520 });
			lines.push({ x:ox, y:oy - 300, w:420, h:50, rot:-0.7 });
			lines.push({ x:ox - 420, y:oy - 300, w:420, h:50, rot:0.7 });
		} else if(kind === 'parallel'){
			for(let i = 0; i < 5; i++){
				lines.push({ x:lx - 1400 + i * 700, y:r.y + 860, w:54, h:fl - (r.y + 860) });
			}
		} else {
			for(let i = 0; i < 6; i++){
				const a = i * 0.7;
				lines.push({ x:lx + Math.cos(a) * (120 + i * 90) - 400, y:fl - 30 - i * 40, w:800, h:40 });
			}
		}
		return lines;
	}

	function atkSpears(en, atk, r){
		const fl = floorY(r);
		if(atk.t === 1){
			atk.data.pts = [];
			const lx = leadX();
			for(let i = -4; i <= 4; i++){
				atk.data.pts.push({ x:lx + i * 150, y:fl });
			}
			atk.data.pts.push({ x:lx + (player.vx || 0) * 16, y:fl });
			for(let i = 0; i < atk.data.pts.length; i++){
				const p = atk.data.pts[i];
				teleCircle(p.x, p.y - 30, 48, atk.warn);
				en._vc.haz.push({ kind:'crack', x:p.x, y:p.y, r:28, grow:70, life:atk.warn, max:atk.warn });
			}
		}
		if(atk.t === atk.warn){
			shake(16, 20);
			for(let i = 0; i < atk.data.pts.length; i++){
				const p = atk.data.pts[i];
				en._vc.haz.push({
					kind:'erupt', x:p.x, y:p.y, h:0, maxH:420, w:40, life:80,
					dmg:partPow(en, 'roots', 36)
				});
				spark(p.x, p.y, 22, { r:90, g:170, b:50 });
				proj(p.x, p.y - 40, (px() - p.x) * 0.006, -22 - (i % 3), {
					color:'#5a3a18', color2:'#c8f060', power:partPow(en, 'roots', 26),
					width:18, height:40, shape:'spike', maxAge:150, trail:'spark',
					style:'spear', noWallCollide:true, gravity:0.14
				});
			}
		}
		if(atk.t === atk.warn + 18){
			for(let i = 0; i < 6; i++){
				proj(leadX() + (i - 2.5) * 70, fl - 10, (i - 2.5) * 0.45, -24 - i, {
					color:'#5a3a18', color2:'#d8ff80', power:partPow(en, 'roots', 20),
					width:14, height:34, shape:'spike', maxAge:150, trail:'spark',
					style:'spear', noWallCollide:true, gravity:0.14
				});
			}
		}
		return atk.t > atk.warn + 90;
	}

	function atkReach(en, atk, r){
		if(atk.t === 1){
			atk.data.tx = Math.max(r.x + 160, Math.min(r.x + r.w - 160, leadX()));
			atk.data.ty = Math.max(r.y + 740, Math.min(floorY(r) - 40, leadY()));
			startArmDash(en, 'armL', atk.data.tx, atk.data.ty);
			teleCircle(atk.data.tx, atk.data.ty, 88, atk.warn);
		}
		const d = en._vc.dash && en._vc.dash.armL;
		if(d && !d.fired && d.t >= d.go){
			slamArm(en, 'armL', d);
			const fist = fistBox('armL', d.x, d.y, d.w, d.h);
			const ax = fist.x + fist.w * 0.5, ay = fist.y + fist.h * 0.5;
			for(let i = 0; i < 4; i++){
				proj(ax, ay, (i - 1.5) * 3.2, -12 - i, {
					color:'#6a4424', color2:'#d4ef7a', power:partPow(en, 'armL', 16),
					width:14, height:12, shape:'spike', maxAge:100, trail:'spark',
					style:'shard', noWallCollide:true, gravity:0.18
				});
			}
		}
		return atk.t > atk.warn + 70;
	}

	function atkWrath(en, atk, r){
		/* Staggered 8–12s sequence: roots → sweep → projectiles → heartbeat → roots */
		if(atk.t === 1){
			atk.data.phase = 0;
			banner('ROOTS ERUPT');
			beginSub(en, 'grasp', r);
		}
		if(atk.t === 90){ banner('BRANCH SWEEP'); beginSub(en, 'guillotine', r); }
		if(atk.t === 200){ banner('CROWN VOLLEY'); beginSub(en, 'barrage', r); }
		if(atk.t === 340){ banner('HEARTBEAT'); beginSub(en, 'heartbeat', r); }
		if(atk.t === 470){ banner('THE ROOTS RETURN'); beginSub(en, 'spears', r); }
		if(atk.t === 50){
			const ch = sapChannels(r);
			en._vc.sap.push({ x:ch[0].x, y:ch[0].y, w:ch[0].w, h:ch[0].h, life:500, max:500 });
		}
		tickSubs(en, r);
		return atk.t > 620;
	}

	function beginSub(en, name, r){
		en._vc.subs = en._vc.subs || [];
		const warn = { grasp:40, guillotine:50, barrage:60, heartbeat:24, spears:48 }[name] || 40;
		en._vc.subs.push({ name:name, part:'heart', t:0, warn:warn, data:{} });
	}

	function tickSubs(en, r){
		const subs = en._vc.subs || [];
		for(let i = subs.length - 1; i >= 0; i--){
			subs[i].t++;
			if(runAtk(en, subs[i], r)) subs.splice(i, 1);
		}
	}

	function runAtk(en, atk, r){
		switch(atk.name){
			case 'fist': return atkFist(en, atk, r, false);
			case 'fistRoots': return atkFist(en, atk, r, true);
			case 'grasp': return atkGrasp(en, atk, r);
			case 'barrage': return atkBarrage(en, atk, r, false);
			case 'barrageHeart': return atkBarrage(en, atk, r, true);
			case 'guillotine': return atkGuillotine(en, atk, r);
			case 'heartbeat': return atkHeartbeat(en, atk, r);
			case 'sap': return atkSap(en, atk, r);
			case 'thorns': return atkThorns(en, atk, r);
			case 'bloom': return atkBloom(en, atk, r);
			case 'spears': return atkSpears(en, atk, r);
			case 'reach': return atkReach(en, atk, r);
			case 'wrath': return atkWrath(en, atk, r);
			default: return true;
		}
	}

	/* ---------- phases ---------- */
	function startRebirth(en, r){
		const vc = en._vc;
		vc.mode = 'rebirth';
		vc.atks = [];
		resetCadence(vc);
		vc.launchCd = 0;
		vc.rebirthDone = true;
		vc.rebirth = [
			{ id:'N', x:r.x + r.w / 2 - 50, y:r.y + 640, w:100, h:420, hp:2400, max:2400 },
			{ id:'E', x:en.x + en.w - 20, y:en.y + en.h * .45, w:520, h:90, hp:2400, max:2400 },
			{ id:'S', x:r.x + r.w / 2 - 50, y:en.y + en.h - 40, w:100, h:380, hp:2400, max:2400 },
			{ id:'W', x:en.x - 500, y:en.y + en.h * .45, w:520, h:90, hp:2400, max:2400 }
		];
		vc.exposed = 0;
		en.bossPhaseTransition = 60;
		banner('ROOTED REBIRTH — SEVER THE FOUR ROOTS');
		shake(18, 28);
		vc.minionT = 0;
	}

	function tickRebirth(en, r){
		const vc = en._vc;
		vc.minionT++;
		if(vc.minionT === 90 || vc.minionT === 240){
			const pr = partRects(en).crown;
			for(let i = 0; i < 8; i++){
				const a = (i / 8) * Math.PI * 2;
				proj(pr.x + pr.w / 2, pr.y + pr.h / 2, Math.cos(a) * 4.6, Math.sin(a) * 3.2, {
					color:'#81c94a', color2:'#e8ff9a', power:14, width:14, height:14,
					shape:'circle', maxAge:120, style:'seed', noWallCollide:true
				});
			}
			const dx = leadX() - (pr.x + pr.w / 2), dy = leadY() - (pr.y + pr.h / 2);
			const len = Math.max(40, Math.hypot(dx, dy));
			proj(pr.x + pr.w / 2, pr.y + pr.h / 2, dx / len * 7.2, dy / len * 7.2, {
				color:'#81c94a', color2:'#e8ff9a', power:16, width:16, height:16,
				shape:'circle', maxAge:120, style:'seed', noWallCollide:true
			});
		}
		for(const k of ['armL','armR']){
			if(vc.parts[k].down > 12) vc.parts[k].down -= 2;
		}
		const live = vc.rebirth.filter(function(rt){ return rt.hp > 0; }).length;
		if(vc.minionT > 720 && live > 0){
			for(let i = 0; i < vc.rebirth.length; i++) vc.rebirth[i].hp = 0;
		}
		const remain = vc.rebirth.filter(function(rt){ return rt.hp > 0; }).length;
		if(remain === 0 && vc.exposed <= 0){
			vc.exposed = 160;
			banner('THE HEART IS EXPOSED');
			spark(en.x + en.w / 2, en.y + en.h * .42, 36, { r:220, g:255, b:120 });
		}
		if(vc.exposed > 0){
			vc.exposed--;
			if(vc.exposed <= 0){
				enterPhase2(en);
			}
		}
	}

	function enterPhase2(en){
		const vc = en._vc;
		vc.mode = 'idle';
		vc.phase = 2;
		en.bossPhase = 2;
		vc.partCd = { armL:0, armR:0, crown:0, roots:0, heart:0 };
		vc.launchCd = 0;
		vc.stall = 0;
		vc.quiet = 0;
		vc.atks = [];
		vc.rebirth = [];
		vc.grabs = [];
		vc.blade = null;
		vc.hand = null;
		vc.armStrike = null;
		banner('THE WORLDROOT AWAKENS');
		begin(en, 'fist');
		begin(en, 'spears');
	}

	function startPhase3(en, r){
		const vc = en._vc;
		vc.phase = 3;
		en.bossPhase = 3;
		vc.mode = 'idle';
		vc.atks = [];
		vc.rebirth = [];
		vc.grabs = [];
		vc.partCd = { armL:0, armR:0, crown:0, roots:0, heart:0 };
		vc.launchCd = 0;
		vc.stall = 0;
		banner('HEART OF THE WORLDROOT — SEVER THE LIFELINES');
		shake(16, 24);
		en.bossPhaseTransition = 140;
		vc.lifelines = [
			{ id:'N', part:'crown', x:r.x + r.w / 2 - 46, y:r.y + 600, w:92, h:460, hp:2800, max:2800 },
			{ id:'E', part:'armR', x:en.x + en.w, y:en.y + en.h * .38, w:640, h:80, hp:2800, max:2800 },
			{ id:'S', part:'roots', x:r.x + r.w / 2 - 46, y:en.y + en.h - 20, w:92, h:420, hp:2800, max:2800 },
			{ id:'W', part:'armL', x:en.x - 640, y:en.y + en.h * .38, w:640, h:80, hp:2800, max:2800 }
		];
		vc.cut = { armL:false, armR:false, crown:false, roots:false };
	}

	function startFinale(en, r){
		const vc = en._vc;
		vc.mode = 'finale';
		vc.atks = [];
		vc.finaleT = 0;
		vc.exposed = 0;
		vc.quiet = 90;
		banner('THE HEART OF THE WORLDROOT');
		shake(6, 10);
		en._vc.dark = 0.25;
	}

	function tickFinale(en, r){
		const vc = en._vc;
		vc.finaleT++;
		if(vc.quiet > 0){
			vc.quiet--;
			vc.dark = 0.35;
			if(vc.quiet === 0){
				vc.pulseN = 0;
				vc.nextPulse = 1;
			}
			return;
		}
		const speed = 1 + vc.finaleLoops * 0.18;
		if(vc.exposed <= 0 && vc.nextPulse && vc.finaleT >= vc.nextPulse){
			const n = vc.pulseN++;
			const pr = partRects(en).heart;
			en._vc.pulses.push({
				x:pr.x + pr.w / 2, y:pr.y + pr.h / 2,
				r:30, vr:10 + n, life:130, dmg:partPow(en, 'heart', 32), gap:false
			});
			shake(7, 10);
			const wait = Math.max(16, (70 - n * 8) / speed);
			vc.nextPulse = vc.finaleT + wait;
			if(n === 0){
				const fl = floorY(r);
				en._vc.haz.push({ kind:'corridor', x:r.x + 240, y:fl - 70, w:160, h:70, life:420 });
				en._vc.haz.push({ kind:'corridor', x:r.x + r.w / 2 - 80, y:fl - 70, w:160, h:70, life:420 });
				en._vc.haz.push({ kind:'corridor', x:r.x + r.w - 400, y:fl - 70, w:160, h:70, life:420 });
			}
			if(n === 1 && !down(en, 'crown')){
				const cr = partRects(en).crown;
				for(let i = 0; i < 6; i++){
					const a = (i / 6) * Math.PI * 2;
					proj(cr.x + cr.w / 2, cr.y + cr.h / 2, Math.cos(a) * 4, Math.sin(a) * 3, {
						color:'#9adf55', power:13, width:14, height:14, shape:'circle',
						maxAge:100, style:'seed', noWallCollide:true
					});
				}
			}
			if(n === 2 && !down(en, 'armR')){
				en._vc.blade = {
					x:r.x - 20, y:floorY(r) - 160, w:100, h:64, vx:16, life:160, dmg:partPow(en, 'armR', 28)
				};
			}
			if(n >= 5){
				vc.exposed = 210;
				vc.nextPulse = 0;
				banner('THE HEART OPENS — FINISH IT');
			}
		}
		if(vc.exposed > 0){
			vc.exposed--;
			vc.dark = 0.12;
			if(vc.exposed <= 0 && en.hp > 0){
				vc.finaleLoops++;
				vc.quiet = Math.max(40, 80 - vc.finaleLoops * 12);
				vc.pulseN = 0;
				vc.nextPulse = 0;
				banner('THE HEART CLOSES');
			}
		}
	}

	/* ---------- hazards ---------- */
	function inCorridor(en){
		const hz = en._vc.haz || [];
		for(let i = 0; i < hz.length; i++){
			if(hz[i].kind === 'corridor' && inRect(hz[i].x, hz[i].y, hz[i].w, hz[i].h)) return true;
		}
		return false;
	}

	function tickHaz(en, r){
		const vc = en._vc;
		if(player._vcGrabT > 0){
			player._vcGrabT--;
			player.vx *= 0.16;
			player.vy = Math.min(player.vy, 4);
			player.slowTimer = Math.max(player.slowTimer || 0, 8);
		}
		for(let i = vc.grabs.length - 1; i >= 0; i--){
			const g = vc.grabs[i];
			g.life--;
			if(g.hp <= 0 || g.life <= 0){ vc.grabs.splice(i, 1); continue; }
			if(inRect(g.x, g.y, g.w, g.h)){
				player._vcGrabT = Math.max(player._vcGrabT || 0, 12);
				player.vx *= 0.12;
				g.tick = (g.tick || 0) + 1;
				if(g.tick % 22 === 1) hitP(partPow(en, 'roots', 16), []);
			}
		}
		for(let i = vc.sap.length - 1; i >= 0; i--){
			const s = vc.sap[i];
			s.life--;
			if(s.life <= 0){ vc.sap.splice(i, 1); continue; }
			if(inRect(s.x, s.y, s.w, s.h)){
				player.slowTimer = Math.max(player.slowTimer || 0, 24);
				player.vx *= 0.72;
				if(!s.tick) s.tick = 0;
				s.tick++;
				if(s.tick % 50 === 1) hitP(9, seedPoison());
			}
		}
		if(vc.blade){
			const b = vc.blade;
			b.x += b.vx; b.life--;
			if(inRect(b.x, b.y, b.w + 40, b.h) && !behindCover(en) && !b.hit){
				if(hitP(b.dmg, [])) b.hit = true;
			}
			if(b.life <= 0 || b.x < r.x - 200 || b.x > r.x + r.w + 200) vc.blade = null;
		}
		if(vc.hand && vc.hand.close && vc.hand.life > 0){
			vc.hand.life--;
		}
		if(vc.thorn){
			const th = vc.thorn;
			th.ang += th.dir * 0.017;
			th.gapA += th.dir * 0.01;
			th.life--;
			const dx = px() - th.x, dy = py() - th.y;
			const dist = Math.hypot(dx, dy);
			if(dist > th.inner && dist < th.outer){
				let a = Math.atan2(dy, dx) - th.gapA;
				while(a > Math.PI) a -= Math.PI * 2;
				while(a < -Math.PI) a += Math.PI * 2;
				const inGap = Math.abs(a) < th.gap * 0.5 || Math.abs(Math.abs(a) - Math.PI) < th.gap * 0.5;
				if(!inGap && !th.cd){
					hitP(th.dmg, []);
					th.cd = 28;
				}
			}
			if(th.cd > 0) th.cd--;
			if(th.life <= 0) vc.thorn = null;
		}
		for(let i = vc.pulses.length - 1; i >= 0; i--){
			const p = vc.pulses[i];
			p.r += p.vr; p.life--;
			if(p.life <= 0){ vc.pulses.splice(i, 1); continue; }
			if(p.gap || p.dmg <= 0) continue;
			const dist = Math.hypot(px() - p.x, py() - p.y);
			if(Math.abs(dist - p.r) < 38 && !p.hit && !inCorridor(en)){
				hitP(p.dmg, []);
				p.hit = true;
			}
		}
		if((vc.rootTouchCd || 0) > 0) vc.rootTouchCd--;
		else if(!down(en, 'roots')){
			let touched = false;
			const nodes = vc.nodes || [];
			for(let i = 0; i < nodes.length && !touched; i++){
				const n = nodes[i];
				if(!n.hurt) continue;
				if(inRect(n.x + n.w * 0.22, n.y + n.h * 0.18, n.w * 0.56, n.h * 0.42)) touched = true;
			}
			const rt = partRects(en).roots;
			if(!touched && inRect(rt.x, rt.y + rt.h * 0.35, rt.w, rt.h * 0.65)) touched = true;
			if(touched){
				hitP(partPow(en, 'roots', 14), []);
				vc.rootTouchCd = 36;
			}
		}
		for(let i = vc.haz.length - 1; i >= 0; i--){
			const h = vc.haz[i];
			h.life--;
			if(h.kind === 'wave' || h.kind === 'shard'){
				h.x += h.vx || 0; h.y += h.vy || 0;
				if(inRect(h.x - 8, h.y - 8, (h.w || 40) + 16, (h.h || 28) + 16) && !h.hit){
					hitP(h.dmg, []); h.hit = true;
				}
			} else if(h.kind === 'shock'){
				h.r += h.vr || 12;
				const dist = Math.hypot(px() - h.x, py() - h.y);
				if(!h.hit && Math.abs(dist - h.r) < 36){ hitP(h.dmg || 28, []); h.hit = true; }
			} else if(h.kind === 'erupt'){
				h.h = Math.min(h.maxH || 240, (h.h || 0) + 18);
				if(inRect(h.x - h.w / 2, h.y - h.h, h.w, h.h)){
					h.hitCd = (h.hitCd || 0) - 1;
					if(h.hitCd <= 0){
						hitP(h.dmg || 28, []);
						h.hitCd = 22;
						player.vy = -9;
					}
				}
			} else if(h.kind === 'spear' || h.kind === 'rootwall'){
				if(inRect(h.x, h.y, h.w, h.h) && !h.hit){
					hitP(h.dmg || 22, []); h.hit = true;
					if(h.kind === 'spear') player.vy = -7;
				}
			}
			if(h.life <= 0) vc.haz.splice(i, 1);
		}
		if(vc.seeds){
			for(let i = vc.seeds.length - 1; i >= 0; i--){
				const s = vc.seeds[i];
				if(s.fire){
					if(s.wait > 0) s.wait--;
					else {
						const dx = leadX() - s.x, dy = leadY() - s.y;
						const len = Math.max(40, Math.hypot(dx, dy));
						proj(s.x, s.y, dx / len * 9.4, dy / len * 9.4, {
							color:'#8fd64a', color2:'#e7ff9a', power:partPow(en, 'crown', 15),
							width:16, height:16, shape:'circle', maxAge:110, trail:'spark',
							style:'seed', noWallCollide:true
						});
						vc.seeds.splice(i, 1);
					}
				} else {
					s.life--;
					if(s.life <= 0) vc.seeds.splice(i, 1);
				}
			}
		}
	}

	function hurtNode(list, p, amount){
		for(let i = 0; i < list.length; i++){
			const n = list[i];
			if(n.hp <= 0) continue;
			if(p.x > n.x && p.x < n.x + n.w && p.y > n.y && p.y < n.y + n.h){
				n.hp -= amount;
				n.flash = 8;
				num(p.x, p.y, Math.round(amount) + '', '#c8ff7a');
				if(n.hp <= 0){
					n.hp = 0;
					spark(n.x + n.w / 2, n.y + n.h / 2, 20, { r:140, g:220, b:80 });
				}
				return n;
			}
		}
		return null;
	}

	/* ---------- public combat hooks ---------- */
	function verdantKitUnionHitRect(en){
		if(!living() || !en || en.type !== 'earthColossus') return null;
		ensure(en);
		return unionRect(en, 'hit');
	}
	function verdantKitUnionDrawRect(en){
		if(!living() || !en || en.type !== 'earthColossus') return null;
		ensure(en);
		return unionRect(en, 'draw');
	}

	function verdantKitOnEnemyHit(en, p, baseDmg){
		if(!living() || !en || en.type !== 'earthColossus' || !en._vc) return 1;
		const part = whichPart(en, p.x, p.y);
		if(part && part !== 'heart'){
			hurtPart(en, part, baseDmg, p.x, p.y);
			return 0;
		}
		return heartMult(en);
	}

	function verdantKitInterceptProj(p){
		if(!living() || !p) return false;
		const en = vcBoss();
		if(!en || !en._vc) return false;
		const vc = en._vc;
		const dmg = 70;
		if(hurtNode(vc.grabs, p, dmg)) return true;
		if(vc.mode === 'rebirth' && hurtNode(vc.rebirth, p, dmg)) return true;
		if(vc.phase >= 3 && hurtNode(vc.lifelines, p, dmg)){
			for(let i = 0; i < vc.lifelines.length; i++){
				const L = vc.lifelines[i];
				if(L.hp <= 0) vc.cut[L.part] = true;
			}
			if(vc.lifelines.every(function(L){ return L.hp <= 0; })){
				vc.exposed = Math.max(vc.exposed, 200);
				banner('ALL LIFELINES SEVERED — THE HEART IS BARE');
			} else {
				const killed = vc.lifelines.find(function(L){ return L.hp <= 0 && !L.announced; });
				if(killed){
					killed.announced = true;
					banner(PART_LABEL[killed.part] + ' LIFELINE SEVERED');
				}
			}
			return true;
		}
		return false;
	}

	function pushBossLights(en){
		if(typeof DungeonVision === 'undefined' || !DungeonVision.addLight) return;
		const pr = partRects(en);
		const t = en.animTimer || 0;
		const pulse = 0.9 + Math.sin(t * 0.075) * 0.14;
		DungeonVision.addLight(en.x + en.w / 2, en.y + en.h * 0.38, 860, 1.38 * pulse, [190, 255, 120]);
		DungeonVision.addLight(pr.heart.x + pr.heart.w / 2, pr.heart.y + pr.heart.h / 2, 480, 1.45 * pulse, [240, 255, 150]);
		DungeonVision.addLight(pr.crown.x + pr.crown.w / 2, pr.crown.y + pr.crown.h * 0.45, 420, 1.05, [255, 200, 140]);
		DungeonVision.addLight(pr.armL.x + pr.armL.w * 0.5, pr.armL.y + pr.armL.h * 0.45, 280, 0.72, [170, 255, 110]);
		DungeonVision.addLight(pr.armR.x + pr.armR.w * 0.5, pr.armR.y + pr.armR.h * 0.45, 280, 0.72, [170, 255, 110]);
		DungeonVision.addLight(pr.roots.x + pr.roots.w * 0.5, pr.roots.y + pr.roots.h * 0.35, 520, 0.82, [140, 255, 100]);
	}

	/* ---------- main update ---------- */
	function updateVerdantColossus(en){
		if(!living() || !en || en.type !== 'earthColossus' || en.dead) return false;
		const vc = ensure(en);
		const r = roomOf(en);
		lock(en);
		tickArmDash(en);
		if(!r) return true;
		if(!vc.rootsLaid && sheetOk(SHEETS.roots)) layoutRoots(en, r);
		tickLimbs(en);
		tickParts(en);
		pushBossLights(en);
		tickHaz(en, r);
		if(vc.dark > 0 && vc.mode !== 'finale' && !(vc.atks || []).some(function(a){ return a.name === 'bloom'; })) vc.dark *= 0.96;

		const hpPct = en.hp / Math.max(1, en.maxHp);
		if(vc.phase === 1 && hpPct <= 0.65 && !vc.rebirthDone){
			startRebirth(en, r);
		}
		if(vc.phase === 2 && hpPct <= 0.30){
			startPhase3(en, r);
		}
		if(vc.phase >= 3 && hpPct <= 0.13 && vc.mode !== 'finale'){
			startFinale(en, r);
		}

		if(vc.mode === 'rebirth') tickRebirth(en, r);
		if(vc.mode === 'finale'){ tickFinale(en, r); return true; }
		if(en.bossPhaseTransition > 0) en.bossPhaseTransition--;
		if(!playerInRoom(r) && vc.phase === 1 && vc.mode !== 'rebirth') return true;

		vc.atks = vc.atks || [];
		forceUnlockParts(vc);
		for(const k of ['armL','armR','crown','roots','heart']){
			if((vc.partCd[k] || 0) > 0 && vc.partCd[k] < 9000) vc.partCd[k]--;
		}
		for(let i = vc.atks.length - 1; i >= 0; i--){
			const a = vc.atks[i];
			a.t++;
			let done = false;
			try{
				if(a.part && a.part !== 'heart' && down(en, a.part) && a.name !== 'wrath'){
					done = true;
				} else {
					done = !!runAtk(en, a, r);
				}
			}catch(err){
				done = true;
			}
			if(done){
				vc.partCd[a.part] = vc.phase === 1 ? 18 : 8;
				vc.atks.splice(i, 1);
			}
		}
		const maxAtk = vc.mode === 'rebirth' ? 1 : (vc.phase === 1 ? 2 : 2);
		vc.launchCd = (vc.launchCd || 0) - 1;
		if((vc.atks || []).length === 0) vc.quiet = (vc.quiet || 0) + 1;
		else vc.quiet = 0;
		if(vc.launchCd <= 0 && vc.atks.length < maxAtk){
			const order = ['armL','armR','crown','roots','heart'];
			for(let s = order.length - 1; s > 0; s--){
				const j = (Math.random() * (s + 1)) | 0;
				const tmp = order[s]; order[s] = order[j]; order[j] = tmp;
			}
			let started = 0;
			const want = 1;
			for(let i = 0; i < order.length && started < want && vc.atks.length < maxAtk; i++){
				const part = order[i];
				if(part !== 'heart' && down(en, part)) continue;
				if(partBusy(en, part)) continue;
				if((vc.partCd[part] || 0) > 0) continue;
				const name = pickForPart(en, part);
				if(!name) continue;
				if(begin(en, name)) started++;
			}
			if(!started || (vc.quiet > 40 && vc.atks.length === 0)){
				forceUnlockParts(vc);
				const fallback = ['fist','guillotine','spears','barrage','heartbeat','reach','grasp','sap'];
				const pick = fallback[(vc.stall || 0) % fallback.length];
				if(begin(en, pick)) started++;
				vc.quiet = 0;
			}
			vc.launchCd = started ? Math.round((vc.phase === 1 ? 28 : 18) * 1.43) : 10;
			if(!started) vc.stall = (vc.stall || 0) + 1;
			else vc.stall = 0;
		}
		return true;
	}

	function updateJungleBossFX(){
		/* Hazards tick with the boss. Keep the old hook from hanging. */
	}

	/* ---------- drawing ---------- */
	function cam(){ return (typeof camera !== 'undefined') ? camera : { x:0, y:0 }; }

	const _punchCache = new Map();
	function punchSheet(img, sx, sy, sw, sh){
		const key = (img.src || '') + '|' + (sx|0) + '|' + (sy|0) + '|' + (sw|0) + '|' + (sh|0);
		let c = _punchCache.get(key);
		if(c) return c;
		c = document.createElement('canvas');
		c.width = Math.max(1, sw|0);
		c.height = Math.max(1, sh|0);
		const g = c.getContext('2d');
		g.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
		try{
			const id = g.getImageData(0, 0, c.width, c.height);
			const d = id.data;
			for(let i = 0; i < d.length; i += 4){
				if(d[i] < 22 && d[i + 1] < 22 && d[i + 2] < 22) d[i + 3] = 0;
			}
			g.putImageData(id, 0, 0);
		}catch(err){}
		_punchCache.set(key, c);
		return c;
	}

	function blit(img, frame, row, dx, dy, dw, dh, flash, cols){
		if(!sheetOk(img) || !ctx) return false;
		cols = cols || COLS;
		const fW = img.naturalWidth / cols, fH = img.naturalHeight / ROWS;
		const bleed = 2;
		row = Math.max(0, Math.min(ROWS - 1, row | 0));
		frame = Math.max(0, Math.min(cols - 1, frame | 0));
		const sx = frame * fW + bleed, sy = row * fH + bleed;
		const sw = fW - bleed * 2, sh = fH - bleed * 2;
		const cell = punchSheet(img, sx, sy, sw, sh);
		ctx.save();
		if(flash) ctx.filter = 'brightness(2.2) saturate(0.35)';
		ctx.imageSmoothingEnabled = false;
		ctx.drawImage(cell, 0, 0, cell.width, cell.height, dx, dy, dw, dh);
		ctx.restore();
		return true;
	}

	function fallbackPart(kind, x, y, w, h, glow){
		ctx.save();
		if(kind === 'torso'){
			ctx.fillStyle = glow ? '#4e7a3a' : '#2e4a28';
			ctx.beginPath();
			ctx.moveTo(x + w * .2, y + h * .08);
			ctx.lineTo(x + w * .8, y + h * .08);
			ctx.lineTo(x + w * .92, y + h * .95);
			ctx.lineTo(x + w * .08, y + h * .95);
			ctx.closePath(); ctx.fill();
			ctx.fillStyle = '#d8ff7a';
			ctx.beginPath(); ctx.ellipse(x + w * .5, y + h * .46, w * .16, h * .12, 0, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = '#7dff8a';
			ctx.beginPath(); ctx.arc(x + w * .38, y + h * .18, 8, 0, Math.PI * 2); ctx.fill();
			ctx.beginPath(); ctx.arc(x + w * .62, y + h * .18, 8, 0, Math.PI * 2); ctx.fill();
		} else if(kind === 'armL' || kind === 'armR'){
			ctx.strokeStyle = '#6a4a28'; ctx.lineWidth = Math.max(18, w * .18); ctx.lineCap = 'round';
			ctx.beginPath();
			ctx.moveTo(kind === 'armL' ? x + w * .8 : x + w * .2, y + 20);
			ctx.quadraticCurveTo(x + w * .5, y + h * .5, x + w * .4, y + h * .9);
			ctx.stroke();
		} else if(kind === 'crown'){
			ctx.fillStyle = '#2f6a38';
			ctx.beginPath(); ctx.ellipse(x + w / 2, y + h * .55, w * .46, h * .4, 0, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = '#e07ab0';
			for(let i = 0; i < 6; i++){
				ctx.beginPath();
				ctx.ellipse(x + w * (.2 + i * .12), y + h * .4, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
			}
		} else {
			ctx.fillStyle = '#3d5a28';
			ctx.fillRect(x, y + h * .3, w, h * .7);
		}
		ctx.restore();
	}

	function drawVerdantColossusSprite(en){
		if(!living() || !en || en.type !== 'earthColossus') return false;
		const vc = ensure(en);
		const c = cam();
		const pr = partRects(en);
		const t = en.animTimer || 0;

		ctx.save();
		const cx = en.x + en.w / 2 - c.x, cy = en.y + en.h * .42 - c.y;
		const pulse = 0.78 + Math.sin((en.animTimer || 0) * 0.07) * 0.22;
		ctx.globalCompositeOperation = 'lighter';
		const aura = ctx.createRadialGradient(cx, cy, 30, cx, cy, 720);
		aura.addColorStop(0, vc.phase >= 3 ? 'rgba(230,255,140,' + (0.55 * pulse) + ')' : 'rgba(180,255,110,' + (0.42 * pulse) + ')');
		aura.addColorStop(0.35, 'rgba(140,230,80,' + (0.22 * pulse) + ')');
		aura.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(cx, cy, 720, 0, Math.PI * 2); ctx.fill();
		const heart = pr.heart;
		const hx = heart.x + heart.w / 2 - c.x, hy = heart.y + heart.h / 2 - c.y;
		const core = ctx.createRadialGradient(hx, hy, 8, hx, hy, 260);
		core.addColorStop(0, 'rgba(255,255,190,' + (0.72 * pulse) + ')');
		core.addColorStop(0.4, 'rgba(190,255,90,' + (0.38 * pulse) + ')');
		core.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = core; ctx.beginPath(); ctx.arc(hx, hy, 260, 0, Math.PI * 2); ctx.fill();
		ctx.globalCompositeOperation = 'source-over';
		ctx.restore();

		function drawP(key, img, kind){
			const rec = pr[key === 'torso' ? 'heart' : key];
			let x, y, w, h;
			if(key === 'torso'){
				x = en.x - en.w * .15 - c.x; y = en.y - en.h * .08 - c.y;
				w = en.w * 1.3; h = en.h * 1.18;
			} else {
				x = rec.x - c.x; y = rec.y - c.y; w = rec.w; h = rec.h;
			}
			const part = key === 'torso'
				? { row: vc.exposed > 0 ? 3 : ((vc.atks || []).some(function(a){ return a.part === 'heart'; }) ? 2 : 0), frame:(t / SPR_FPS | 0) % COLS, flash:en.flash }
				: vc.parts[key];
			const row = part ? part.row : 0, frame = part ? part.frame : 0, flash = part && part.flash > 0;
			if(key === 'armR' && vc.blade) return;
			if(key === 'armL' && vc.hand) return;
			if(!blit(img, frame, row, x, y, w, h, flash || (en.flash > 0 && key === 'torso'), PART_COLS[key] || COLS)){
				fallbackPart(kind, x, y, w, h, vc.exposed > 0);
			}
		}

		const rootRow = (vc.parts.roots && vc.parts.roots.down > 0) ? 3 : ((vc.atks || []).some(function(a){ return a.part === 'roots'; }) ? 2 : 0);
		const nodes = vc.nodes || [];
		for(let i = 0; i < nodes.length; i++){
			const n = nodes[i];
			const nx = n.x - c.x, ny = n.y - c.y;
			if(nx + n.w < -20 || nx > canvas.width + 20 || ny + n.h < -20 || ny > canvas.height + 20) continue;
			const nf = ((n.frame || 0) + (t / SPR_FPS | 0)) % ROOT_COLS;
			if(!blit(SHEETS.roots, nf, rootRow, nx, ny, n.w, n.h, vc.parts.roots.flash > 0, ROOT_COLS)){
				ctx.fillStyle = '#3d5a28';
				ctx.fillRect(nx, ny + n.h * 0.35, n.w, n.h * 0.65);
			}
		}
		drawP('armL', SHEETS.armL, 'armL');
		drawP('torso', SHEETS.torso, 'torso');
		drawP('armR', SHEETS.armR, 'armR');
		drawP('crown', SHEETS.crown, 'crown');

		if(vc.hand){
			const h = vc.hand;
			if(!blit(SHEETS.armL, (t / SPR_FPS | 0) % COLS, h.close ? 2 : 1, h.x - c.x, h.y - c.y, h.w, h.h, false)){
				ctx.fillStyle = h.close ? 'rgba(90,50,20,.9)' : 'rgba(70,110,40,.8)';
				ctx.beginPath(); ctx.ellipse(h.x + h.w / 2 - c.x, h.y + h.h / 2 - c.y, h.w / 2, h.h / 2, 0, 0, Math.PI * 2); ctx.fill();
			}
		}
		if(vc.blade){
			const b = vc.blade;
			ctx.save();
			const facing = b.vx >= 0 ? 1 : -1;
			ctx.translate(b.x - c.x + (facing > 0 ? 0 : b.w), b.y + b.h / 2 - c.y);
			if(facing < 0) ctx.scale(-1, 1);
			if(!blit(SHEETS.armR, (t / SPR_FPS | 0) % COLS, 2, 0, -b.h * 0.7, b.w + 90, b.h * 1.4, false)){
				ctx.fillStyle = '#7a5428';
				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.lineTo(b.w + 40, -b.h * 0.45);
				ctx.lineTo(b.w + 70, 0);
				ctx.lineTo(b.w + 40, b.h * 0.45);
				ctx.closePath();
				ctx.fill();
				ctx.fillStyle = '#e8ff90';
				ctx.fillRect(b.w + 20, -10, 50, 20);
			}
			ctx.restore();
		}
		if(vc.exposed > 0){
			ctx.save();
			ctx.shadowColor = '#eaff8a'; ctx.shadowBlur = 22;
			ctx.fillStyle = 'rgba(220,255,120,.55)';
			const ht = pr.heart;
			ctx.beginPath(); ctx.ellipse(ht.x + ht.w / 2 - c.x, ht.y + ht.h / 2 - c.y, ht.w * .42, ht.h * .38, 0, 0, Math.PI * 2); ctx.fill();
			ctx.restore();
		}

		function drawPartBar(rec, p, label){
			if(!p || !rec) return;
			const bw = Math.max(72, Math.min(160, rec.w * 0.42));
			const bh = 8;
			const bx = rec.x + rec.w / 2 - bw / 2 - c.x;
			const by = rec.y - 18 - c.y;
			const pct = p.down > 0 ? 0 : Math.max(0, p.hp / Math.max(1, p.max));
			ctx.fillStyle = 'rgba(0,0,0,.55)';
			ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
			ctx.fillStyle = p.down > 0 ? 'rgba(90,90,90,.85)' : (pct > 0.5 ? '#2ecc71' : pct > 0.25 ? '#f39c12' : '#e74c3c');
			ctx.fillRect(bx, by, bw * (p.down > 0 ? Math.max(0.08, p.down / (DOWN_T[label] || 900)) : pct), bh);
			ctx.fillStyle = '#e8ffc8';
			ctx.font = '10px Arial';
			ctx.textAlign = 'center';
			const names = { armL:'Left Arm', armR:'Right Arm', crown:'Crown', roots:'Roots' };
			ctx.fillText(names[label] || label, rec.x + rec.w / 2 - c.x, by - 3);
		}
		drawPartBar(pr.armL, vc.parts.armL, 'armL');
		drawPartBar(pr.armR, vc.parts.armR, 'armR');
		drawPartBar(pr.crown, vc.parts.crown, 'crown');
		if(nodes.length){
			const mid = nodes[(nodes.length / 2) | 0];
			drawPartBar(mid, vc.parts.roots, 'roots');
		} else {
			drawPartBar(pr.roots, vc.parts.roots, 'roots');
		}
		ctx.textAlign = 'center';
		return true;
	}

	function drawVerdantColossusWorld(ctx0){
		if(!living()) return;
		const en = vcBoss();
		if(!en || !en._vc) return;
		const ctxp = ctx0 || ctx;
		if(!ctxp) return;
		const c = cam();
		const vc = en._vc;
		if(vc.dark > 0.02){
			ctxp.save();
			ctxp.fillStyle = 'rgba(4,12,6,' + (vc.dark * 0.85) + ')';
			ctxp.fillRect(0, 0, canvas.width, canvas.height);
			ctxp.restore();
		}
		function rr(h, col, a){
			ctxp.fillStyle = col;
			ctxp.globalAlpha = a == null ? 1 : a;
			ctxp.fillRect(h.x - c.x, h.y - c.y, h.w, h.h);
			ctxp.globalAlpha = 1;
		}
		for(let i = 0; i < vc.haz.length; i++){
			const h = vc.haz[i];
			if(h.kind === 'tele' || h.kind === 'line'){
				rr(h, 'rgba(150,230,80,' + (0.12 + 0.18 * Math.sin(h.life * .2)) + ')');
			} else if(h.kind === 'wave'){
				ctxp.save();
				ctxp.fillStyle = 'rgba(90,160,50,.8)';
				ctxp.beginPath();
				ctxp.ellipse(h.x + (h.w || 40) / 2 - c.x, h.y + (h.h || 24) / 2 - c.y, (h.w || 40) * 0.7, (h.h || 24) * 0.55, 0, 0, Math.PI * 2);
				ctxp.fill();
				ctxp.restore();
			} else if(h.kind === 'crack'){
				const p = 1 - h.life / Math.max(1, h.max || 40);
				const rad = (h.r || 24) + p * (h.grow || 60);
				ctxp.save();
				ctxp.strokeStyle = 'rgba(210,255,90,' + (0.35 + p * 0.45) + ')';
				ctxp.lineWidth = 3;
				ctxp.beginPath();
				ctxp.arc(h.x - c.x, h.y - c.y, rad, 0, Math.PI * 2);
				ctxp.stroke();
				ctxp.strokeStyle = 'rgba(90,50,20,.85)';
				ctxp.lineWidth = 2;
				for(let k = 0; k < 6; k++){
					const a = k * 1.05 + p;
					ctxp.beginPath();
					ctxp.moveTo(h.x - c.x, h.y - c.y);
					ctxp.lineTo(h.x - c.x + Math.cos(a) * rad, h.y - c.y + Math.sin(a) * rad * 0.35);
					ctxp.stroke();
				}
				ctxp.restore();
			} else if(h.kind === 'shock'){
				ctxp.save();
				ctxp.strokeStyle = 'rgba(200,255,110,.85)';
				ctxp.lineWidth = 10;
				ctxp.beginPath();
				ctxp.arc(h.x - c.x, h.y - c.y, h.r, 0, Math.PI * 2);
				ctxp.stroke();
				ctxp.strokeStyle = 'rgba(90,160,40,.4)';
				ctxp.lineWidth = 18;
				ctxp.beginPath();
				ctxp.arc(h.x - c.x, h.y - c.y, h.r * 0.82, 0, Math.PI * 2);
				ctxp.stroke();
				ctxp.restore();
			} else if(h.kind === 'erupt'){
				const hx = h.x - c.x, hy = h.y - c.y;
				ctxp.save();
				ctxp.fillStyle = '#4a3014';
				ctxp.beginPath();
				ctxp.moveTo(hx - h.w * 0.55, hy);
				ctxp.lineTo(hx, hy - h.h);
				ctxp.lineTo(hx + h.w * 0.55, hy);
				ctxp.closePath();
				ctxp.fill();
				ctxp.fillStyle = '#b8ef62';
				ctxp.beginPath();
				ctxp.moveTo(hx - 6, hy - h.h * 0.15);
				ctxp.lineTo(hx, hy - h.h);
				ctxp.lineTo(hx + 6, hy - h.h * 0.15);
				ctxp.closePath();
				ctxp.fill();
				ctxp.restore();
			} else if(h.kind === 'spear' || h.kind === 'rootwall'){
				const hx = h.x - c.x, hy = h.y - c.y;
				ctxp.fillStyle = '#5a3a18';
				ctxp.beginPath();
				ctxp.moveTo(hx + h.w * 0.5, hy);
				ctxp.lineTo(hx, hy + h.h);
				ctxp.lineTo(hx + h.w, hy + h.h);
				ctxp.closePath();
				ctxp.fill();
				ctxp.fillStyle = '#8ed848';
				ctxp.fillRect(hx + h.w * 0.42, hy + 8, 6, h.h - 12);
			} else if(h.kind === 'corridor'){
				rr(h, 'rgba(180,255,120,.22)');
			} else if(h.kind === 'bloom'){
				const p = 1 - h.life / Math.max(1, h.max);
				ctxp.save();
				ctxp.globalAlpha = .35 + p * .4;
				ctxp.fillStyle = '#e8f070';
				ctxp.beginPath(); ctxp.arc(h.x - c.x, h.y - c.y, 40 + p * 120, 0, Math.PI * 2); ctxp.fill();
				ctxp.restore();
			}
		}
		for(let i = 0; i < vc.sap.length; i++){
			const s = vc.sap[i];
			ctxp.save();
			ctxp.globalAlpha = 0.34 + 0.12 * Math.sin(s.life * 0.12);
			ctxp.fillStyle = '#c8d428';
			ctxp.beginPath();
			ctxp.ellipse(s.x + s.w / 2 - c.x, s.y + s.h / 2 - c.y, s.w * 0.52, s.h * 0.42, 0, 0, Math.PI * 2);
			ctxp.fill();
			ctxp.fillStyle = '#fff06a';
			ctxp.beginPath();
			ctxp.ellipse(s.x + s.w / 2 - c.x, s.y + s.h * 0.4 - c.y, s.w * 0.22, s.h * 0.14, 0, 0, Math.PI * 2);
			ctxp.fill();
			ctxp.restore();
		}
		for(let i = 0; i < vc.grabs.length; i++){
			const g = vc.grabs[i];
			const gx = g.x + g.w / 2 - c.x, gy = g.y + g.h - c.y;
			ctxp.save();
			ctxp.strokeStyle = '#5a7a30';
			ctxp.lineWidth = 10;
			ctxp.beginPath();
			ctxp.moveTo(gx, gy);
			ctxp.quadraticCurveTo(gx + Math.sin(g.life * 0.2) * 28, gy - g.h * 0.5, gx, gy - g.h);
			ctxp.stroke();
			ctxp.fillStyle = '#8cb050';
			ctxp.beginPath();
			ctxp.ellipse(gx, gy - g.h, 22, 16, 0, 0, Math.PI * 2);
			ctxp.fill();
			ctxp.fillStyle = '#173018';
			ctxp.fillRect(g.x - c.x, g.y - c.y - 8, g.w, 6);
			ctxp.fillStyle = '#cde98a';
			ctxp.fillRect(g.x - c.x, g.y - c.y - 8, g.w * Math.max(0, g.hp / g.max), 6);
			ctxp.restore();
		}
		if(vc.seeds){
			for(let i = 0; i < vc.seeds.length; i++){
				const s = vc.seeds[i];
				ctxp.fillStyle = 'rgba(210,255,110,.7)';
				ctxp.beginPath(); ctxp.arc(s.x - c.x, s.y - c.y, 7, 0, Math.PI * 2); ctxp.fill();
			}
		}
		for(let i = 0; i < vc.pulses.length; i++){
			const p = vc.pulses[i];
			ctxp.save();
			ctxp.strokeStyle = p.gap ? 'rgba(180,220,120,.25)' : 'rgba(210,255,90,.8)';
			ctxp.lineWidth = p.gap ? 4 : 8;
			ctxp.beginPath(); ctxp.arc(p.x - c.x, p.y - c.y, p.r, 0, Math.PI * 2); ctxp.stroke();
			ctxp.restore();
		}
		if(vc.thorn){
			const th = vc.thorn;
			ctxp.save();
			ctxp.translate(th.x - c.x, th.y - c.y);
			ctxp.rotate(th.ang);
			for(let i = 0; i < 28; i++){
				const a = i / 28 * Math.PI * 2;
				let da = a - th.gapA;
				while(da > Math.PI) da -= Math.PI * 2;
				while(da < -Math.PI) da += Math.PI * 2;
				if(Math.abs(da) < th.gap * .5 || Math.abs(Math.abs(da) - Math.PI) < th.gap * .5) continue;
				ctxp.fillStyle = '#5a3a20';
				ctxp.beginPath();
				ctxp.moveTo(Math.cos(a) * th.inner, Math.sin(a) * th.inner);
				ctxp.lineTo(Math.cos(a - .08) * th.outer, Math.sin(a - .08) * th.outer);
				ctxp.lineTo(Math.cos(a + .08) * th.outer, Math.sin(a + .08) * th.outer);
				ctxp.fill();
			}
			ctxp.restore();
		}
		function drawRoots(list, col){
			if(!list) return;
			for(let i = 0; i < list.length; i++){
				const n = list[i];
				if(n.hp <= 0) continue;
				ctxp.fillStyle = n.flash > 0 ? '#e8ff9a' : col;
				ctxp.fillRect(n.x - c.x, n.y - c.y, n.w, n.h);
				ctxp.fillStyle = '#173018';
				ctxp.fillRect(n.x - c.x, n.y - c.y - 8, n.w, 6);
				ctxp.fillStyle = '#b6ef6a';
				ctxp.fillRect(n.x - c.x, n.y - c.y - 8, n.w * (n.hp / n.max), 6);
				if(n.flash > 0) n.flash--;
			}
		}
		drawRoots(vc.rebirth, 'rgba(90,60,24,.92)');
		drawRoots(vc.lifelines, 'rgba(70,48,18,.92)');
	}

	function drawVerdantProj(p){
		const c = cam();
		const x = p.x - c.x, y = p.y - c.y;
		const ang = Math.atan2(p.vy || 0, p.vx || 1);
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(ang);
		const st = p._vcStyle;
		if(st === 'petal'){
			ctx.fillStyle = p.color || '#e8f070';
			ctx.beginPath(); ctx.ellipse(0, 0, p.width * .7, p.height * .4, 0, 0, Math.PI * 2); ctx.fill();
		} else if(st === 'shard'){
			ctx.fillStyle = p.color || '#6a4424';
			ctx.beginPath();
			ctx.moveTo(p.width, 0);
			ctx.lineTo(-p.width * 0.4, -p.height * 0.55);
			ctx.lineTo(-p.width * 0.15, 0);
			ctx.lineTo(-p.width * 0.4, p.height * 0.55);
			ctx.closePath(); ctx.fill();
			ctx.fillStyle = p.color2 || '#d4ef7a';
			ctx.beginPath();
			ctx.moveTo(p.width * 0.7, 0);
			ctx.lineTo(-p.width * 0.1, -4);
			ctx.lineTo(-p.width * 0.1, 4);
			ctx.closePath(); ctx.fill();
		} else if(st === 'spear'){
			ctx.fillStyle = p.color || '#5a3a18';
			ctx.beginPath();
			ctx.moveTo(p.height * 0.7, 0);
			ctx.lineTo(-p.height * 0.35, -p.width * 0.45);
			ctx.lineTo(-p.height * 0.15, 0);
			ctx.lineTo(-p.height * 0.35, p.width * 0.45);
			ctx.closePath(); ctx.fill();
			ctx.fillStyle = p.color2 || '#c8f060';
			ctx.fillRect(-p.height * 0.2, -3, p.height * 0.55, 6);
		} else if(st === 'claw'){
			ctx.fillStyle = p.color || '#7a5028';
			ctx.beginPath();
			ctx.moveTo(p.width, 0);
			ctx.quadraticCurveTo(0, -p.height, -p.width * 0.5, -p.height * 0.2);
			ctx.lineTo(-p.width * 0.3, 0);
			ctx.quadraticCurveTo(0, p.height, p.width, 0);
			ctx.fill();
			ctx.fillStyle = p.color2 || '#e8ff90';
			ctx.beginPath();
			ctx.moveTo(p.width * 0.85, 0);
			ctx.lineTo(-4, -6);
			ctx.lineTo(-4, 6);
			ctx.closePath(); ctx.fill();
		} else if(st === 'sap'){
			ctx.fillStyle = p.color || '#c8d030';
			ctx.beginPath(); ctx.ellipse(0, 0, p.width * 0.55, p.height * 0.45, 0, 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = p.color2 || '#fff06a';
			ctx.beginPath(); ctx.ellipse(-2, -3, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
		} else {
			ctx.fillStyle = p.color || '#9adf55';
			ctx.beginPath(); ctx.arc(0, 0, Math.max(5, p.width * .45), 0, Math.PI * 2); ctx.fill();
			ctx.fillStyle = p.color2 || '#f2ffc0';
			ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
		}
		ctx.restore();
	}

	function drawVerdantBossHud(){
		return false;
	}

	global.VERDANT_SHEETS = SHEETS;
	global.updateVerdantColossus = updateVerdantColossus;
	global.drawVerdantColossusSprite = drawVerdantColossusSprite;
	global.drawVerdantColossusWorld = drawVerdantColossusWorld;
	global.drawVerdantProj = drawVerdantProj;
	global.drawVerdantBossHud = drawVerdantBossHud;
	global.verdantKitOnEnemyHit = verdantKitOnEnemyHit;
	global.verdantKitInterceptProj = verdantKitInterceptProj;
	global.verdantKitUnionHitRect = verdantKitUnionHitRect;
	global.verdantKitUnionDrawRect = verdantKitUnionDrawRect;
	global.updateJungleBossFX = updateJungleBossFX;
	global.configureVerdantColossus = configureVerdant;
})(typeof window !== 'undefined' ? window : globalThis);
