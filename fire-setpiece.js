/* Infernal Depths set-piece rooms — arenas, conveyor, nest, valves. */
(function(global){
	'use strict';

	const KINDS = {
		magmaArena:1, furnaceConveyor:1, eruptionChamber:1,
		moltenBridgeworks:1, infernoNest:1, threeValveFurnace:1
	};

	const zones = [];

	function dung(){ return (typeof dungeon !== 'undefined' && dungeon) || global.dungeon; }
	function rooms(){ return (dung() && dung().rooms) || []; }
	function interacts(){ return (dung() && dung().interactables) || []; }
	function plats(){ return (typeof platforms !== 'undefined' && platforms) || (dung() && dung().platforms) || []; }
	function env(){ return global.DungeonEnv; }
	function isKind(r){ return !!(r && KINDS[r.kind]); }
	function st(room){
		if(!room._sp) room._sp = { t:0, wave:0, entered:0, hp0:0, sealed:false, belt:0, warn:0, pour:0, nestAuto:0, turns:{}, fail:0 };
		return room._sp;
	}
	function banner(t){ if(env() && env().showBanner) env().showBanner(t); }
	function shake(a, b){ if(typeof shakeScreen === 'function') shakeScreen(a, b); }
	function walkY(room){ return room.y + room.h - (room.raisedFloor || 0); }
	function inRoom(room){
		return !!(env() && env().currentRoom && env().currentRoom.id === room.id);
	}
	function spawnAt(room, type, x, y, extra){
		if(typeof ENEMY_TYPES === 'undefined' || !ENEMY_TYPES[type] || typeof enemies === 'undefined') return null;
		const t = ENEMY_TYPES[type];
		const hpM = (typeof DIFF_HP_MULT === 'number') ? DIFF_HP_MULT : 1;
		const szM = (typeof DIFF_SIZE_MULT === 'number') ? DIFF_SIZE_MULT : 1;
		const en = Object.assign({
			type:type, typeDef:t,
			x:x, y:y - Math.round(t.h * szM),
			w:Math.round(t.w * szM), h:Math.round(t.h * szM),
			vx:0, vy:0,
			hp:Math.round(t.hp * hpM), maxHp:Math.round(t.hp * hpM),
			facing:1, patrol:[x - 200, x + 200], patrolDir:1, state:'alert',
			alertTimer:80, spellCooldowns:(t.spells || []).map(function(){ return 20; }),
			currentSpell:0, flash:0, dots:[], stunTimer:0, slowTimer:0, animTimer:0,
			attackAnimTimer:0, dead:false, deathTimer:0,
			baseY:y, flyOffset:0, charging:false, chargeVx:0, chargeVy:0, chargeTimer:0,
			chargeCastDone:false, bossPhase:1, puzzleSeg:room.section || 2,
			roomId:room.id, _cliff:false,
		}, extra || {});
		enemies.push(en);
		return en;
	}
	function living(room, pred){
		if(typeof enemies === 'undefined') return [];
		const out = [];
		for(let i = 0; i < enemies.length; i++){
			const e = enemies[i];
			if(!e || e.dead || e.hp <= 0) continue;
			const cx = e.x + (e.w || 40) * 0.5, cy = e.y + (e.h || 40) * 0.5;
			if(cx < room.x || cx > room.x + room.w || cy < room.y || cy > room.y + room.h) continue;
			if(pred && !pred(e)) continue;
			out.push(e);
		}
		return out;
	}
	function hpSum(list){
		let n = 0;
		for(let i = 0; i < list.length; i++) n += Math.max(0, list[i].hp || 0);
		return n;
	}
	function unlockCaches(room, tag){
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(it.roomId !== room.id) continue;
			if(it._lockTag === tag || (tag === 'main' && it._mainCache)) it._locked = false;
		}
	}
	function finish(room, msg){
		if(room.cleared) return;
		unlockCaches(room, 'main');
		unseal(room);
		if(env() && env().clearRoom) env().clearRoom(room, msg || 'The chamber stills.');
	}
	function seal(room){
		const d = dung();
		if(!d || !d._gates) return;
		for(let i = 0; i < d._gates.length; i++){
			const g = d._gates[i];
			if(g && (g.fromRoom === room.id || g.toRoom === room.id)) g._arenaSeal = true;
		}
		st(room).sealed = true;
		if(env() && env().refreshFirePassages) env().refreshFirePassages();
	}
	function unseal(room){
		const d = dung();
		if(!d || !d._gates) return;
		for(let i = 0; i < d._gates.length; i++){
			const g = d._gates[i];
			if(g && (g.fromRoom === room.id || g.toRoom === room.id)) g._arenaSeal = false;
		}
		st(room).sealed = false;
		if(env() && env().refreshFirePassages) env().refreshFirePassages();
	}
	function addZone(x, y, w, h, life, dmg){
		zones.push({ x:x, y:y, w:w, h:h, life:life || 50, dmg:dmg || 18 });
	}
	function tickZones(){
		for(let i = zones.length - 1; i >= 0; i--){
			const z = zones[i];
			z.life--;
			if(typeof player !== 'undefined' && player.iFrames <= 0 &&
				player.x + player.w > z.x && player.x < z.x + z.w &&
				player.y + player.h > z.y && player.y < z.y + z.h &&
				typeof damagePlayer === 'function'){
				damagePlayer(z.dmg, [{ type:'burn', dmg:3, interval:24, ticks:3, color:'#ff4400' }]);
			}
			if(z.life <= 0) zones.splice(i, 1);
		}
	}
	function eruptCracks(room, n){
		const cracks = room.cracks || [];
		if(!cracks.length) return;
		const s = st(room);
		s.crackI = s.crackI || 0;
		const take = Math.min(n || 2, cracks.length);
		for(let i = 0; i < take; i++){
			const c = cracks[(s.crackI + i) % cracks.length];
			c._glow = 36;
			c._boom = 36;
		}
		s.crackI += take;
	}
	function tickCracks(room){
		const cracks = room.cracks || [];
		const walk = walkY(room);
		for(let i = 0; i < cracks.length; i++){
			const c = cracks[i];
			if(c._glow > 0) c._glow--;
			if(c._boom === 1){
				addZone(c.x, walk - 220, c.w, 230, 28, 22);
				shake(8, 12);
			}
			if(c._boom > 0) c._boom--;
		}
	}
	function roamMages(room, spots){
		const mages = living(room, function(e){ return e.type === 'emberMage'; });
		for(let i = 0; i < mages.length; i++){
			const en = mages[i];
			en._roam = (en._roam || 0) + 1;
			if(en._roam % 200 !== 0 || !spots.length) continue;
			const dest = spots[(i + Math.floor(en._roam / 200)) % spots.length];
			en.x = dest.x - en.w * 0.5;
			en.y = dest.y - en.h;
			en.baseY = en.y;
		}
	}

	function startArena(room){
		const s = st(room);
		if(s.wave) return;
		s.wave = 1;
		seal(room);
		const walk = walkY(room);
		const mid = room.x + room.w * 0.5;
		spawnAt(room, 'flameSerpent', room.x + 280, walk - 40);
		spawnAt(room, 'flameSerpent', room.x + room.w - 280, walk - 40);
		spawnAt(room, 'fireSprite', room.x + 200, walk - 360);
		spawnAt(room, 'fireSprite', mid, walk - 40);
		spawnAt(room, 'fireSprite', room.x + room.w - 200, walk - 360);
		spawnAt(room, 'emberMage', mid, walk - 220, { _arenaMage:true });
		s.hp0 = hpSum(living(room));
		banner('They come from every side.');
		shake(8, 12);
	}
	function tickArena(room){
		const s = st(room);
		s.t++;
		if(s.t === 78) startArena(room);
		if(s.wave === 1 && s.hp0 && hpSum(living(room)) <= s.hp0 * 0.5){
			s.wave = 2;
			const walk = walkY(room);
			spawnAt(room, 'magmaGolem', room.x + 400, walk - 8);
			spawnAt(room, 'magmaGolem', room.x + room.w - 400, walk - 8);
			spawnAt(room, 'flameSerpent', room.x + 360, walk - 480);
			spawnAt(room, 'flameSerpent', room.x + room.w - 360, walk - 480);
			banner('Golems climb from the pit.');
			shake(12, 16);
		}
		if(s.wave === 2 && living(room).length === 0){
			s.wave = 3;
			const walk = walkY(room);
			spawnAt(room, 'magmaGolem', room.x + room.w * 0.5, walk - 8);
			spawnAt(room, 'emberMage', room.x + 240, walk - 360, { _arenaMage:true });
			spawnAt(room, 'emberMage', room.x + room.w - 240, walk - 360, { _arenaMage:true });
			spawnAt(room, 'fireSprite', room.x + 180, walk - 40);
			spawnAt(room, 'fireSprite', room.x + 700, walk - 500);
			spawnAt(room, 'fireSprite', room.x + room.w - 700, walk - 500);
			spawnAt(room, 'fireSprite', room.x + room.w - 180, walk - 40);
			banner('Crossfire.');
		}
		if(s.wave >= 2){
			const spots = [];
			const walk = walkY(room);
			spots.push({ x:room.x + 460, y:walk - 280 });
			spots.push({ x:room.x + room.w - 460, y:walk - 280 });
			spots.push({ x:room.x + 940, y:walk - 620 });
			spots.push({ x:room.x + room.w - 940, y:walk - 620 });
			roamMages(room, spots);
		}
		if(s.wave && s.t % 560 === 120) eruptCracks(room, 2 + (s.wave >= 3 ? 1 : 0));
		tickCracks(room);
		if(s.wave >= 3 && living(room).length === 0) finish(room, 'The arena cools.');
	}

	function startConveyor(room){
		const s = st(room);
		if(s.wave) return;
		s.wave = 1;
		seal(room);
		const walk = walkY(room);
		spawnAt(room, 'fireSprite', room.x + 400, walk - 280);
		spawnAt(room, 'fireSprite', room.x + 1500, walk - 460);
		spawnAt(room, 'fireSprite', room.x + 2500, walk - 280);
		spawnAt(room, 'emberMage', room.x + 200, walk - 640);
		spawnAt(room, 'emberMage', room.x + room.w - 220, walk - 640);
		spawnAt(room, 'flameSerpent', room.x + 900, walk - 100, { _beltSerpent:true });
		spawnAt(room, 'flameSerpent', room.x + 2100, walk - 280, { _beltSerpent:true });
		s.count0 = living(room).length;
		banner('The belts never stop.');
	}
	function flipBelt(room, id, dir, spd){
		for(let i = 0; i < plats().length; i++){
			const p = plats()[i];
			if(p.roomId !== room.id || p._conveyor !== id) continue;
			if(dir != null) p.raftDir = dir;
			if(spd != null) p.spd = spd;
			p._warn = 50;
		}
	}
	function tickConveyor(room){
		const s = st(room);
		s.t++;
		if(s.t === 80) startConveyor(room);
		s.belt++;
		if(s.belt === 1100) s.warn = 90;
		if(s.warn > 0){
			s.warn--;
			if(s.warn === 0){
				const id = (s.flipI || 0) % 3;
				s.flipI = id + 1;
				const sample = plats().find(function(p){ return p.roomId === room.id && p._conveyor === id; });
				flipBelt(room, id, sample ? -sample.raftDir : -1, null);
				banner('A belt reverses.');
				shake(6, 10);
				s.belt = 0;
			}
		}
		if(s.wave === 1 && s.count0 && living(room).length <= Math.ceil(s.count0 * 0.5)){
			s.wave = 2;
			const walk = walkY(room);
			spawnAt(room, 'magmaGolem', room.x + 180, walk - 80);
			spawnAt(room, 'magmaGolem', room.x + room.w - 220, walk - 80);
			let near = 0, px = (typeof player !== 'undefined') ? player.x : room.x;
			if(px > room.x + room.w * 0.6) near = 2;
			else if(px > room.x + room.w * 0.33) near = 1;
			flipBelt(room, near, null, 2.1);
			banner('The nearest belt surges.');
		}
		if(s.wave === 2 && living(room, function(e){ return e.type !== 'magmaGolem'; }).length === 0 &&
			living(room, function(e){ return e.type === 'magmaGolem'; }).length){
			s.wave = 3;
			s.pour = 1;
			banner('The furnace pours.');
		}
		if(s.pour){
			s.pour++;
			if(s.pour % 160 === 20){
				const walk = walkY(room);
				const lanes = [room.x + 420, room.x + 1480, room.x + 2360];
				const lane = lanes[(Math.floor(s.pour / 160)) % 3];
				addZone(lane, room.y + 80, 160, walk - room.y - 40, 90, 20);
				shake(7, 10);
			}
		}
		if(s.wave >= 2 && living(room).length === 0) finish(room, 'The belts grind to a halt.');
	}

	function startErupt(room, wave){
		const s = st(room);
		s.wave = wave;
		const walk = walkY(room);
		if(wave === 1){
			seal(room);
			for(let i = 0; i < 6; i++) spawnAt(room, 'fireSprite', room.x + 200 + i * 440, walk - (i % 2 ? 420 : 40));
			spawnAt(room, 'flameSerpent', room.x + 360, walk - 40);
			spawnAt(room, 'flameSerpent', room.x + room.w - 360, walk - 40);
			banner('The vent wakes.');
		}
		if(wave === 2){
			spawnAt(room, 'emberMage', room.x + 280, walk - 420);
			spawnAt(room, 'emberMage', room.x + room.w - 280, walk - 420);
			spawnAt(room, 'flameSerpent', room.x + 500, walk - 40);
			spawnAt(room, 'flameSerpent', room.x + room.w * 0.5, walk - 560);
			spawnAt(room, 'flameSerpent', room.x + room.w - 500, walk - 40);
			spawnAt(room, 'fireSprite', room.x + 900, walk - 400);
			spawnAt(room, 'fireSprite', room.x + 2100, walk - 400);
			banner('Mages take the islands.');
		}
		if(wave === 3){
			spawnAt(room, 'magmaGolem', room.x + 500, walk - 8);
			spawnAt(room, 'magmaGolem', room.x + room.w - 500, walk - 8);
			spawnAt(room, 'emberMage', room.x + 240, walk - 220);
			spawnAt(room, 'emberMage', room.x + room.w - 240, walk - 220);
			if(typeof hazards !== 'undefined'){
				hazards.push({
					type:'rise', element:'fire', roomId:room.id,
					x:room.x + room.w * 0.38, w:room.w * 0.24,
					y0:walk - 12, y1:walk - 220, y:walk - 12,
					speed:0.7, active:true, armed:true, hold:140, _fluidConsumed:true,
				});
			}
			banner('The crater breathes.');
		}
	}
	function tickErupt(room){
		const s = st(room);
		s.t++;
		if(s.t === 90) startErupt(room, 1);
		if(s.wave === 1 && s.t > 120 && living(room).length === 0) startErupt(room, 2);
		if(s.wave === 2 && living(room).length === 0) startErupt(room, 3);
		if(s.wave === 1 && s.t % 220 === 40){
			for(let i = 0; i < (dung().hazards || []).length; i++){
				const h = dung().hazards[i];
				if(h.roomId === room.id && h.type === 'vent') h._t = 50;
			}
		}
		if(s.wave >= 2 && s.t % 400 === 80) eruptCracks(room, s.wave);
		if(s.wave >= 2 && s.t % 180 === 0){
			for(let i = 0; i < plats().length; i++){
				const p = plats()[i];
				if(p.roomId === room.id && p.kind === 'collapse') p._tick = (p._tick || 0) + 18;
			}
		}
		tickCracks(room);
		if(s.wave >= 3 && living(room).length === 0) finish(room, 'The pressure drops.');
	}

	function startBridge(room){
		const s = st(room);
		if(s.wave) return;
		s.wave = 1;
		seal(room);
		const walk = walkY(room);
		spawnAt(room, 'magmaGolem', room.x + 180, walk - 80, { _major:true });
		spawnAt(room, 'magmaGolem', room.x + 500, walk - 520, { _major:true });
		spawnAt(room, 'flameSerpent', room.x + 780, walk - 220, { _major:true });
		spawnAt(room, 'flameSerpent', room.x + 1360, walk - 80, { _major:true });
		spawnAt(room, 'flameSerpent', room.x + 1960, walk - 360, { _major:true });
		spawnAt(room, 'emberMage', room.x + 2500, walk - 520, { _major:true });
		spawnAt(room, 'emberMage', room.x + 3040, walk - 780, { _major:true });
		spawnAt(room, 'fireSprite', room.x + 700, walk - 700, { _optionalSprite:true });
		spawnAt(room, 'fireSprite', room.x + 1700, walk - 860, { _optionalSprite:true });
		spawnAt(room, 'fireSprite', room.x + 2300, walk - 520, { _optionalSprite:true });
		spawnAt(room, 'fireSprite', room.x + 2900, walk - 980, { _optionalSprite:true });
		banner('Choose your height.');
	}
	function tickBridge(room){
		const s = st(room);
		s.t++;
		if(s.t === 70) startBridge(room);
		if(s.t === 420 || s.t === 900){
			const bridges = plats().filter(function(p){ return p.roomId === room.id && p.kind === 'static' && p.w >= 260 && p.w <= 420 && !p.central && !p._sideChest; });
			if(bridges.length){
				const p = bridges[s.t === 420 ? 1 : Math.min(3, bridges.length - 1)];
				p._shake = 90;
				banner('A span is failing.');
			}
		}
		for(let i = 0; i < plats().length; i++){
			const p = plats()[i];
			if(p.roomId !== room.id || !p._shake) continue;
			p._shake--;
			if(p._shake === 0 && !p._gone){
				p._gone = true;
				if(env() && env().stampTiles) env().stampTiles(p.x, p.y, p.w, p.h, true);
				shake(10, 14);
			}
		}
		const majors = living(room, function(e){ return e._major; });
		const far = room.clearZone;
		const reached = far && typeof player !== 'undefined' &&
			player.x + player.w > far.x && player.x < far.x + far.w &&
			player.y + player.h > far.y && player.y < far.y + far.h;
		if(s.wave && majors.length === 0 && reached) finish(room, 'The far span is yours.');
	}

	function nestsOf(room){
		return interacts().filter(function(it){ return it.roomId === room.id && it.kind === 'fireNest'; });
	}
	function startNest(room){
		const s = st(room);
		if(s.wave) return;
		s.wave = 1;
		seal(room);
		const walk = walkY(room);
		spawnAt(room, 'magmaGolem', room.x + room.w * 0.45, walk - 160, { _major:true });
		spawnAt(room, 'magmaGolem', room.x + room.w * 0.58, walk - 160, { _major:true });
		spawnAt(room, 'flameSerpent', room.x + 300, walk - 40, { _major:true });
		spawnAt(room, 'flameSerpent', room.x + 800, walk - 620, { _major:true });
		spawnAt(room, 'flameSerpent', room.x + 2200, walk - 620, { _major:true });
		spawnAt(room, 'flameSerpent', room.x + room.w - 300, walk - 40, { _major:true });
		spawnAt(room, 'emberMage', room.x + 280, walk - 420, { _major:true, _nestMage:true });
		spawnAt(room, 'emberMage', room.x + room.w - 280, walk - 420, { _major:true, _nestMage:true });
		s.req0 = living(room, function(e){ return e._major; }).length;
		banner('The nests sleep. For now.');
	}
	function hatchNest(it, room, swarm){
		if(!it || it._dead || it._hatched) return;
		it._hatched = true;
		it._incub = 0;
		st(room).anyHatch = true;
		const n = swarm ? 3 : 2;
		for(let i = 0; i < n; i++){
			spawnAt(room, 'fireSprite', it.x + 10 + i * 18, it.y + it.h, { _nestSpawn:true });
		}
		banner('A nest bursts.');
		shake(7, 10);
	}
	function strikeNest(it, room){
		if(!it || it._dead) return;
		it._struck = true;
		it._incub = it._incub || 1;
		it._glow = 1;
	}
	function smashNest(it, room){
		if(!it || it._dead) return;
		it._dead = true;
		it._incub = 0;
		it.used = true;
		banner('The nest is crushed.');
	}
	function tickNest(room){
		const s = st(room);
		s.t++;
		if(s.t === 80) startNest(room);
		const list = nestsOf(room);
		for(let i = 0; i < list.length; i++){
			const it = list[i];
			if(it._dead || it._hatched) continue;
			if(it._incub){
				it._incub++;
				if(it._incub >= 150) hatchNest(it, room, true);
			}
		}
		s.nestAuto++;
		const interval = (s.wave >= 2) ? 900 : 1500;
		if(s.wave && s.nestAuto >= interval){
			s.nestAuto = 0;
			const live = list.filter(function(n){ return !n._dead && !n._hatched && !n._incub; });
			if(live.length){
				const n = (s.wave >= 3 && live.length > 1) ? 2 : 1;
				for(let k = 0; k < n; k++){
					live[k]._incub = 1;
					banner(n > 1 ? 'Two nests wake.' : 'A nest stirs on its own.');
				}
			}
		}
		const majors = living(room, function(e){ return e._major; });
		if(s.wave === 1 && s.req0 && majors.length <= s.req0 * 0.5){
			s.wave = 2;
			banner('The remaining nests hurry.');
		}
		if(s.wave === 2 && majors.length <= 2){
			s.wave = 3;
			const mages = living(room, function(e){ return e._nestMage; });
			const waking = list.filter(function(n){ return n._incub && !n._hatched && !n._dead; });
			for(let i = 0; i < mages.length && waking[i]; i++){
				mages[i].x = waking[i].x;
				mages[i].y = waking[i].y - mages[i].h;
			}
		}
		if(typeof projectiles !== 'undefined'){
			for(let p = 0; p < projectiles.length; p++){
				const pr = projectiles[p];
				if(!pr || pr.hasHit) continue;
				for(let n = 0; n < list.length; n++){
					const it = list[n];
					if(it._dead || it._hatched) continue;
					if(pr.x > it.x && pr.x < it.x + it.w && pr.y > it.y && pr.y < it.y + it.h){
						strikeNest(it, room);
					}
				}
			}
		}
		const smashed = list.filter(function(n){ return n._dead; }).length;
		if(smashed >= list.length && list.length && !s.anyHatch && !s.secret){
			s.secret = true;
			unlockCaches(room, 'secret');
			for(let i = 0; i < interacts().length; i++){
				const it = interacts()[i];
				if(it.roomId === room.id && it.kind === 'secretWall'){
					it._locked = false;
					it.punch = { x:room.x + 8, y:it.y - 20, w:90, h:it.h + 40 };
				}
			}
			banner('A hidden wall splits — mastery.');
		}
		if(s.wave && majors.length === 0 && living(room, function(e){ return e._nestSpawn; }).length === 0){
			finish(room, 'The nest-ground stills.');
		}
	}

	function valveState(room, id){
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(it.roomId === room.id && it._valveId === id) return it._state || 0;
		}
		return 0;
	}
	function cycleValve(it, room){
		it._state = ((it._state || 0) + 1) % 3;
		st(room).turns[it._valveId] = (st(room).turns[it._valveId] || 0) + 1;
		if(it._valveId === 'A') banner('The west channel answers.');
		if(it._valveId === 'B') banner('The central gauge climbs.');
		if(it._valveId === 'C') banner('The east channel hisses.');
		shake(4, 8);
	}
	function tryFurnace(it, room){
		const A = valveState(room, 'A'), B = valveState(room, 'B'), C = valveState(room, 'C');
		const ok = A > B && B === C && (A + B + C === 4);
		if(!ok){
			st(room).fail++;
			const walk = walkY(room);
			spawnAt(room, 'fireSprite', room.x + 400, walk - 40);
			spawnAt(room, 'fireSprite', room.x + room.w - 400, walk - 40);
			spawnAt(room, 'flameSerpent', room.x + room.w * 0.5, walk - 40);
			banner('Wrong pressure — the furnace spatters.');
			shake(12, 16);
			return;
		}
		it.used = true;
		const perfect = !st(room).turns.A || st(room).turns.A <= 1;
		const pB = !st(room).turns.B || st(room).turns.B <= 1;
		const pC = !st(room).turns.C || st(room).turns.C <= 1;
		if(perfect && pB && pC && Object.keys(st(room).turns).length){
			unlockCaches(room, 'secret');
			banner('A perfect routing. The side vault unseals.');
		}
		unlockCaches(room, 'main');
		unseal(room);
		if(env() && env().clearRoom) env().clearRoom(room, 'Three streams become one. The door yields.');
		shake(14, 20);
	}

	function update(){
		tickZones();
		const list = rooms();
		for(let r = 0; r < list.length; r++){
			const room = list[r];
			if(!isKind(room) || room.cleared) continue;
			if(!inRoom(room) && !st(room).wave) continue;
			if(inRoom(room)) st(room).entered++;
			if(room.kind === 'magmaArena') tickArena(room);
			if(room.kind === 'furnaceConveyor') tickConveyor(room);
			if(room.kind === 'eruptionChamber') tickErupt(room);
			if(room.kind === 'moltenBridgeworks') tickBridge(room);
			if(room.kind === 'infernoNest') tickNest(room);
		}
	}

	function tryInteract(it){
		if(global.FirePuzzles && FirePuzzles.tryInteract(it)) return true;
		const room = it && rooms()[it.roomId];
		if(!room || !isKind(room)) return false;
		if(it.kind === 'furnaceValve'){ cycleValve(it, room); return true; }
		if(it.kind === 'furnaceLever'){ tryFurnace(it, room); return true; }
		if(it.kind === 'cluePlate'){ banner(it._clue || it.lore || 'The plate is worn.'); return true; }
		if(it.kind === 'fireNest'){
			if(it._dead) return true;
			if(it._incub) smashNest(it, room);
			else strikeNest(it, room);
			return true;
		}
		if(it.kind === 'cache' || it.kind === 'specialCache'){
			const locked = (env() && env().combatChestLocked) ? env().combatChestLocked(it) : it._locked;
			if(locked){
				banner(room && room.noCombat ? 'The seal still holds this chest.' : 'Defeat every enemy in this room first.');
				return true;
			}
			if(global.SpecialRooms && SpecialRooms.openLoot) SpecialRooms.openLoot(it, it._lootTier || 'challenge');
			return true;
		}
		return false;
	}
	function prompt(it){
		if(!it) return null;
		if(it.kind === 'furnaceValve') return 'E — Turn ' + (it.name || 'the valve') + '  (' + ['closed','half','open'][it._state || 0] + ')';
		if(it.kind === 'furnaceLever') return 'E — Activate the furnace';
		if(it.kind === 'cluePlate') return 'E — Read the plate';
		if(it.kind === 'fireNest') return it._incub ? 'E — Crush the waking nest' : 'E — Strike the nest';
		return null;
	}

	function draw(ctx){
		if(!ctx || typeof camera === 'undefined') return;
		const camx = camera.x, camy = camera.y;
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(!it) continue;
			const sx = it.x - camx, sy = it.y - camy;
			if(it.kind === 'furnaceValve'){
				const stt = it._state || 0;
				ctx.fillStyle = stt === 0 ? '#3a2418' : (stt === 1 ? '#c86820' : '#ff7722');
				ctx.beginPath(); ctx.arc(sx + 48, sy + 48, 28 + stt * 6, 0, Math.PI * 2); ctx.fill();
				ctx.strokeStyle = '#ffe080';
				ctx.lineWidth = 3;
				ctx.beginPath();
				ctx.moveTo(sx + 48, sy + 48);
				ctx.lineTo(sx + 48 + Math.cos(stt * 1.2) * 26, sy + 48 + Math.sin(stt * 1.2) * 26);
				ctx.stroke();
			}
			if(it.kind === 'cluePlate'){
				ctx.fillStyle = it._perfect ? 'rgba(80,50,20,0.7)' : 'rgba(40,24,14,0.75)';
				ctx.fillRect(sx, sy, it.w || 80, it.h || 60);
				ctx.fillStyle = '#e8c070';
				ctx.font = '10px sans-serif';
				ctx.fillText(it._perfect ? '?' : '☰', sx + 12, sy + 28);
			}
			if(it.kind === 'fireNest' && !it._dead){
				const glow = it._incub ? Math.min(1, it._incub / 150) : 0.15;
				ctx.fillStyle = 'rgba(255,90,20,' + (0.25 + glow * 0.6) + ')';
				ctx.beginPath(); ctx.arc(sx + 40, sy + 40, 22 + glow * 16, 0, Math.PI * 2); ctx.fill();
			}
			if(it.kind === 'furnaceLever' && !it.used){
				ctx.fillStyle = '#ffaa44';
				ctx.fillRect(sx + 20, sy + 10, 70, 16);
			}
		}
		const rs = rooms();
		for(let r = 0; r < rs.length; r++){
			const room = rs[r];
			if(!room || !room.cracks) continue;
			for(let i = 0; i < room.cracks.length; i++){
				const c = room.cracks[i];
				if(!(c._glow > 0)) continue;
				ctx.fillStyle = 'rgba(255,120,20,' + (0.2 + c._glow / 80) + ')';
				ctx.fillRect(c.x - camx, walkY(room) - 10 - camy, c.w, 14);
			}
		}
		for(let i = 0; i < plats().length; i++){
			const p = plats()[i];
			if(p && p._warn){
				ctx.fillStyle = 'rgba(255,40,20,' + (0.25 + 0.25 * Math.sin(p._warn)) + ')';
				ctx.fillRect(p.x - camx, p.y - 18 - camy, p.w, 10);
			}
			if(p && p._shake){
				ctx.strokeStyle = 'rgba(255,200,80,0.7)';
				ctx.strokeRect(p.x - camx, p.y - camy, p.w, 8);
			}
		}
		for(let i = 0; i < zones.length; i++){
			const z = zones[i];
			ctx.fillStyle = 'rgba(255,70,10,' + (0.18 + z.life / 400) + ')';
			ctx.fillRect(z.x - camx, z.y - camy, z.w, z.h);
		}
	}

	function roomBanner(r){
		if(!isKind(r)) return false;
		const map = {
			magmaArena:'Ambush from the ring. Watch the glowing cracks.',
			furnaceConveyor:'Fight on the belts. Lights warn before a reverse.',
			eruptionChamber:'Three waves. The chamber gets hungrier.',
			moltenBridgeworks:'Take a path. Sprites are optional.',
			infernoNest:'Smash nests or fight the guard. A perfect crush hides a vault.',
			threeValveFurnace:'Read the plates. Route four marks of pressure.',
		};
		banner((r.label || '') + ' — ' + (map[r.kind] || r.objective || ''));
		return true;
	}

	global.FireSetpiece = {
		isKind:isKind,
		update:update,
		tryInteract:tryInteract,
		prompt:prompt,
		draw:draw,
		roomBanner:roomBanner,
	};
})(typeof window !== 'undefined' ? window : globalThis);
