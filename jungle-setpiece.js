/* =============================================================
   Living Wilds — authored combat set-pieces.
   Vertical hunts, living fortress, sporefall, thorn cathedral,
   flooded rootway, hunting grounds, blooming colosseum, root collapse.
   ============================================================= */
(function(global){
	'use strict';

	const KINDS = {
		predatorsGauntlet:1, livingFortress:1, sporefall:1, thornCathedral:1,
		floodedRootway:1, ancientHunting:1, bloomingColosseum:1, rootCollapse:1
	};

	function dung(){ return (typeof dungeon !== 'undefined' && dungeon) || global.dungeon; }
	function env(){ return global.DungeonEnv; }
	function rooms(){ return (dung() && dung().rooms) || []; }
	function interacts(){ return (dung() && dung().interactables) || []; }
	function plats(){ return (dung() && dung().platforms) || []; }
	function hazards(){ return (dung() && dung().hazards) || []; }
	function isKind(r){ return !!(r && KINDS[r.kind]); }
	function banner(t){ if(env() && env().showBanner) env().showBanner(t); }
	function shake(a,b){ if(typeof shakeScreen === 'function') shakeScreen(a,b); }
	function inRoom(room){ return !!(env() && env().currentRoom && env().currentRoom.id === room.id); }
	function cam(){ return global.camera || {x:0,y:0}; }

	function st(room){
		if(!room._sp) room._sp = { t:0, phase:1, entered:false, hp0:0, spawned:{}, quiet:true };
		return room._sp;
	}
	function living(room){
		if(typeof enemies === 'undefined') return [];
		const out = [];
		for(let i = 0; i < enemies.length; i++){
			const e = enemies[i];
			if(!e || e.dead || e.hp <= 0 || e.roomId !== room.id) continue;
			if(e._jungleDormant || e._packSleep) continue;
			if(e.type === 'earthColossus' || (e.typeDef && e.typeDef.isBoss)) continue;
			out.push(e);
		}
		return out;
	}
	function allTagged(room){
		if(typeof enemies === 'undefined') return [];
		return enemies.filter(function(e){ return e && e.roomId === room.id && !e.dead && e.hp > 0; });
	}
	function spawnAt(room, type, x, y, extra){
		if(typeof ENEMY_TYPES === 'undefined' || !ENEMY_TYPES[type] || typeof enemies === 'undefined') return null;
		const t = ENEMY_TYPES[type];
		const hpM = (typeof DIFF_HP_MULT === 'number') ? DIFF_HP_MULT : 1;
		const szM = (typeof DIFF_SIZE_MULT === 'number') ? DIFF_SIZE_MULT : 1;
		const ew = Math.round(t.w * szM), eh = Math.round(t.h * szM);
		const en = Object.assign({
			type:type, typeDef:t, x:x, y:y - eh, w:ew, h:eh, vx:0, vy:0,
			hp:Math.round(t.hp * hpM), maxHp:Math.round(t.hp * hpM),
			facing:1, patrol:[x-220, x+220], patrolDir:1, state:'alert',
			alertTimer:90, spellCooldowns:(t.spells || []).map(function(){ return 22; }),
			currentSpell:0, flash:0, dots:[], stunTimer:0, slowTimer:0, animTimer:0,
			attackAnimTimer:0, dead:false, deathTimer:0, baseY:y - eh, flyOffset:0,
			charging:false, chargeVx:0, chargeVy:0, chargeTimer:0, chargeCastDone:false,
			bossPhase:1, puzzleSeg:room.section || 3, roomId:room.id, _cliff:false
		}, extra || {});
		if(t.flies) en.y = y;
		enemies.push(en);
		return en;
	}
	function wake(en){
		if(!en) return;
		en._jungleDormant = false;
		en._packSleep = false;
		en.state = 'alert';
		en.alertTimer = 80;
	}
	function defeatedFrac(room){
		const s = st(room);
		const now = living(room).length;
		const total = Math.max(1, s.pop || now);
		return 1 - now / total;
	}
	function unlock(room, tag){
		interacts().forEach(function(it){
			if(it.roomId !== room.id) return;
			if(tag && (it._lockTag === tag || (tag === 'main' && it._mainCache))){
				it._locked = false; it.locked = false; it.lockedByCombat = false;
			}
			if(!tag && (it._mainCache || it.kind === 'jungleCache' || it.kind === 'cache')){
				it._locked = false; it.locked = false; it.lockedByCombat = false;
			}
		});
	}
	function finish(room, msg){
		if(room.cleared) return;
		room._setpieceDone = true;
		unlock(room, 'main');
		unlock(room);
		if(env() && env().clearRoom) env().clearRoom(room, msg || 'The hunting ground stills.');
		else if(global.DungeonEnv && DungeonEnv.clearRoom) DungeonEnv.clearRoom(room, msg);
		banner(msg || 'The path opens.');
		shake(6, 14);
	}
	function hitPlayer(x, y, w, h){
		if(typeof player === 'undefined' || !player) return false;
		return player.x < x + w && player.x + player.w > x && player.y < y + h && player.y + player.h > y;
	}
	function dmg(n, fx){
		if(typeof damagePlayer === 'function') damagePlayer(n, fx || []);
	}
	function projHitCore(core){
		if(typeof projectiles === 'undefined') return 0;
		let hit = 0;
		for(let i = 0; i < projectiles.length; i++){
			const p = projectiles[i];
			if(!p || p._jgCore) continue;
			if(p.x > core.x && p.x < core.x + core.w && p.y > core.y && p.y < core.y + core.h){
				p._jgCore = true;
				hit += Math.max(8, p.power || 12);
			}
		}
		return hit;
	}

	function initGauntlet(room){
		const s = st(room);
		if(s.init) return;
		s.init = true;
		allTagged(room).forEach(function(e){
			if(e._phase && e._phase > 1) e._jungleDormant = true;
		});
		s.base = Math.max(living(room).length, 3);
		s.pop = Math.max(allTagged(room).length, 9);
		s.roots = [
			{x:room.x+620, y:room.y+80, w:40, h:520, t:0, period:280, phase:20},
			{x:room.x+1480, y:room.y+40, w:44, h:560, t:0, period:320, phase:140}
		];
		banner('PREDATOR’S GAUNTLET — they hunt from three heights.');
	}
	function tickGauntlet(room){
		const s = st(room);
		initGauntlet(room);
		const awake = living(room).length;
		if(s.phase < 2 && awake <= Math.max(1, Math.floor((s.base || 3) * 0.6))){
			s.phase = 2;
			allTagged(room).forEach(function(e){ if(e._phase === 2) wake(e); });
			spawnAt(room, 'thornWolf', room.x + 80, room.y + room.h - 160);
			banner('Another wolf slips in from the side. The canopy grows bold.');
		} else if(s.phase === 2 && awake <= Math.max(2, Math.floor((s.pop || 9) * 0.3))){
			s.phase = 3;
			allTagged(room).forEach(function(e){ if(e._phase === 3) wake(e); });
			spawnAt(room, 'stalactiteBat', room.x + 900, room.y + 220, {baseY:room.y+220});
			spawnAt(room, 'stalactiteBat', room.x + 1700, room.y + 180, {baseY:room.y+180});
			spawnAt(room, 'thornWolf', room.x + 1320, room.y + 420);
			banner('The upper pack drops. Fight the height.');
		}
		s.roots.forEach(function(rt){
			rt.t++;
			const c = (rt.t + rt.phase) % rt.period;
			rt.warn = c > rt.period - 70 && c < rt.period - 28;
			rt.hot = c >= rt.period - 28 && c < rt.period - 4;
			rt.swing = rt.hot ? Math.min(1, (c - (rt.period-28)) / 24) : 0;
			if(rt.warn && c === rt.period - 69) banner('A hanging root shivers — leaves fall.');
			if(rt.hot && hitPlayer(rt.x - 30, rt.y, rt.w + 80, rt.h + 40)) dmg(14, ['horizontalLaunch']);
		});
		if(s.phase >= 3 && living(room).length === 0) finish(room, 'The hunting ground empties. A jungle cache waits in the ravine.');
	}

	function initFortress(room){
		const s = st(room);
		if(s.init) return;
		s.init = true;
		s.pop = Math.max(living(room).length, 7);
		s.cores = interacts().filter(function(it){ return it.roomId === room.id && it.kind === 'rootCore'; });
		if(s.cores.length < 4){
			const spots = [
				[room.x+280, room.y+520],[room.x+2100, room.y+500],
				[room.x+700, room.y+240],[room.x+1680, room.y+220]
			];
			for(let i = s.cores.length; i < 4; i++){
				const it = {kind:'rootCore', x:spots[i][0], y:spots[i][1], w:90, h:110, roomId:room.id, hp:140, maxHp:140, name:'Root Core'};
				interacts().push(it);
				s.cores.push(it);
			}
		}
		s.cores.forEach(function(c){ c.hp = c.hp || 150; c.maxHp = c.maxHp || 150; c.protected = true; c._openT = 0; });
		s.attacks = [
			{kind:'sweep', x:room.x+200, y:room.y+900, w:900, h:50, period:240, phase:0},
			{kind:'spike', x:room.x+1200, y:room.y+700, w:80, h:420, period:260, phase:80},
			{kind:'wall', x:room.x+980, y:room.y+640, w:40, h:520, period:300, phase:160},
			{kind:'cage', x:room.x+1400, y:room.y+860, w:260, h:200, period:280, phase:40}
		];
		banner('THE LIVING FORTRESS — the roots will defend the stone.');
	}
	function tickFortress(room){
		const s = st(room);
		initFortress(room);
		const frac = defeatedFrac(room);
		const liveCores = s.cores.filter(function(c){ return c.hp > 0; }).length;
		const killed = 4 - liveCores;
		if(frac >= 0.5 && s.phase < 2){ s.phase = 2; s.cores[0] && (s.cores[0].protected = false); banner('A root guardian wakes. Its core is bared.'); }
		if(frac >= 0.7 && s.phase < 3){ s.phase = 3; s.cores[1] && (s.cores[1].protected = false); banner('A second guardian tears through the wall.'); }
		if(frac >= 0.85 && s.phase < 4){ s.phase = 4; s.cores[2] && (s.cores[2].protected = false); banner('A third core opens. One guardian still sleeps.'); }
		s.cores.forEach(function(c, i){
			if(c.hp <= 0) return;
			c._openT = c.protected ? Math.max(0, (c._openT||0)-1) : Math.min(20, (c._openT||0)+1);
			if(!c.protected){
				c.hp -= projHitCore(c);
				if(typeof player !== 'undefined' && player && hitPlayer(c.x, c.y, c.w, c.h) && (player.attackAnimTimer||0) > 0) c.hp -= 6;
			}
			if(c.hp <= 0){
				c.hp = 0; c.used = true;
				banner('A root core splits. The fortress shudders.');
				shake(8, 16);
			}
			const atk = s.attacks[i];
			if(!atk || c.hp <= 0) return;
			if(s.phase < i + 2 && i > 0) return;
			if(i === 0 && s.phase < 2) return;
			atk.t = (atk.t || 0) + 1;
			const cyc = (atk.t + atk.phase) % atk.period;
			atk.warn = cyc > atk.period - 64 && cyc < atk.period - 22;
			atk.hot = cyc >= atk.period - 22 && cyc < atk.period - 2;
			if(atk.hot && hitPlayer(atk.x, atk.y, atk.w, atk.h)) dmg(16, ['stun']);
		});
		if(killed >= 3 && s.phase < 5){
			s.phase = 5;
			spawnAt(room, 'elderTreant', room.x + room.w/2, room.y + room.h - 200);
			spawnAt(room, 'thornWolf', room.x + 400, room.y + room.h - 180);
			spawnAt(room, 'thornWolf', room.x + 1900, room.y + room.h - 180);
			banner('The fortress spends its last strength — an elder steps from the courtyard.');
		}
		if(killed >= 3 && living(room).length === 0){
			room._fortressBloom = true;
			finish(room, 'Roots retract. Sunlight enters. The fortress doors open.');
		}
	}

	function initSporefall(room){
		const s = st(room);
		if(s.init) return;
		s.init = true;
		s.pop = Math.max(living(room).length, 8);
		s.mush = hazards().filter(function(h){ return h.roomId === room.id && h.type === 'sporeBloom'; });
		if(s.mush.length < 5){
			const spots = [0.15,0.32,0.5,0.68,0.84,0.4,0.6];
			for(let i = s.mush.length; i < 6; i++){
				const h = {type:'sporeBloom', x:room.x + room.w*spots[i] - 70, y:room.y + room.h - 280 - (i%3)*80, w:140, h:160, roomId:room.id, period:220+i*18, phase:i*40, r:160};
				hazards().push(h);
				s.mush.push(h);
			}
		}
		s.hearts = interacts().filter(function(it){ return it.roomId === room.id && it.kind === 'sporeHeart'; });
		banner('THE SPOREFALL — stay in the clearings as the caps breathe.');
	}
	function tickSporefall(room){
		const s = st(room);
		initSporefall(room);
		const frac = defeatedFrac(room);
		if(frac >= 0.45 && s.phase < 2){
			s.phase = 2;
			spawnAt(room, 'mossWraith', room.x+300, room.y+room.h-200);
			spawnAt(room, 'mossWraith', room.x+2000, room.y+room.h-220);
			banner('More wraiths in the fog. Three caps can bloom at once.');
		}
		if(frac >= 0.7 && s.phase < 3){
			s.phase = 3;
			spawnAt(room, 'thornWolf', room.x+700, room.y+room.h-180);
			spawnAt(room, 'thornWolf', room.x+1600, room.y+room.h-180);
			banner('Wolves drive you through the moving clearings.');
		}
		const activeN = s.phase === 1 ? 2 : (s.phase === 2 ? 3 : 4);
		s.mush.forEach(function(h, i){
			h.t = (h.t || 0) + 1;
			const cyc = (h.t + (h.phase||0)) % (h.period || 240);
			h.state = cyc < 40 ? 1 : (cyc < 70 ? 2 : (cyc < 100 ? 3 : (cyc < 160 ? 4 : 5)));
			h.active = i < activeN || (s.phase >= 3 && i % 2 === (Math.floor(h.t/30)%2));
			if(s.phase >= 3 && frac >= 0.8 && i === 2){ h.active = true; h.r = 260; h.state = cyc < 90 ? 2 : (cyc < 160 ? 4 : 5); }
			h.rad = h.state === 4 && h.active ? (h.r || 160) : 0;
			if(h.rad && hitPlayer(h.x+h.w/2-h.rad, h.y+h.h/2-h.rad, h.rad*2, h.rad*2)){
				if(typeof player !== 'undefined' && player){
					player.vx *= 0.72;
					player.blindTimer = Math.max(player.blindTimer||0, 10);
				}
				if(h.t % 36 === 0) dmg(4, [{type:'poison',dmg:1,interval:40,ticks:2,color:'#badc62'}]);
			}
		});
		s.hearts.forEach(function(it){
			if(it.used) return;
			it.hp = it.hp == null ? 80 : it.hp;
			it.hp -= projHitCore(it);
			if(it.hp <= 0){ it.used = true; banner('A spore heart splits.'); }
		});
		const heartsDown = s.hearts.filter(function(it){ return it.used; }).length;
		if(heartsDown >= 3 && !s.bonus){
			s.bonus = true;
			s.mush.forEach(function(h, i){ if(i === 2) h._dead = true; });
			unlock(room, 'spore');
			banner('The largest cap goes still. A hidden cache lifts from the mycelium.');
		}
		if(living(room).length === 0 && frac > 0) finish(room, 'The sporefall thins. A jungle cache waits in the clearing.');
	}

	function initThorn(room){
		const s = st(room);
		if(s.init) return;
		s.init = true;
		s.pop = Math.max(living(room).length, 10);
		s.thorns = hazards().filter(function(h){ return h.roomId === room.id && h.type === 'thornGrow'; });
		if(s.thorns.length < 4){
			[[0.25,0.55],[0.5,0.4],[0.72,0.55],[0.48,0.7]].forEach(function(p){
				const h = {type:'thornGrow', x:room.x+room.w*p[0]-30, y:room.y+room.h*p[1]-200, w:50, h:420, roomId:room.id, grown:false};
				hazards().push(h); s.thorns.push(h);
			});
		}
		banner('THE THORN CATHEDRAL — the nave will close around you.');
	}
	function tickThorn(room){
		const s = st(room);
		initThorn(room);
		const frac = defeatedFrac(room);
		if(frac >= 0.4 && s.phase < 2){ s.phase = 2; banner('More thorns split the floor. Find the remaining aisle.'); }
		if(frac >= 0.7 && s.phase < 3){ s.phase = 3; banner('The cathedral divides. Predators use the new corridors.'); }
		if(frac >= 0.8 && s.phase < 4){ s.phase = 4; banner('The altar thorn rises. Finish them around it.'); }
		const want = s.phase === 1 ? 2 : (s.phase === 2 ? 3 : (s.phase >= 4 ? s.thorns.length : 4));
		s.thorns.forEach(function(h, i){
			if(i < want){
				h.warnT = (h.warnT || 0) + 1;
				if(h.warnT < 50){ h.warn = true; h.grown = false; }
				else { h.warn = false; h.grown = true; }
			} else if(s.phase < 4){
				h.grown = false; h.warn = false;
			}
			if(h.grown){
				if(typeof player !== 'undefined' && player && hitPlayer(h.x, h.y, h.w, h.h)){
					if(player.x + player.w/2 < h.x + h.w/2) player.x = h.x - player.w - 2;
					else player.x = h.x + h.w + 2;
					player.vx = 0;
				}
			}
		});
		if(living(room).length === 0 && frac > 0){
			s.thorns.forEach(function(h){ h.grown = false; });
			room._cathedralOpen = true;
			finish(room, 'Thorns retract. Sunlight hits the altar. The cache is yours.');
		}
	}

	function initFlood(room){
		const s = st(room);
		if(s.init) return;
		s.init = true;
		s.pop = Math.max(living(room).length, 12);
		s.water = hazards().filter(function(h){ return h.roomId === room.id && (h.type === 'water' || h.type === 'floodLevel'); })[0];
		s.level = 0;
		s.dir = 1;
		banner('THE FLOODED ROOTWAY — the water will take the floor from you.');
	}
	function tickFlood(room){
		const s = st(room);
		initFlood(room);
		s.t = (s.t || 0) + 1;
		const wave = Math.sin(s.t / 220);
		s.level = wave > 0.45 ? 2 : (wave > -0.2 ? 1 : 0);
		if(s.water){
			const base = room.y + room.h - 120;
			const lift = s.level === 0 ? 0 : (s.level === 1 ? 90 : 180);
			s.water.y = base - lift;
			s.water.h = 120 + lift;
			s.water.current = (Math.sin(s.t / 90) > 0.6 ? 1.4 : 0.5) * (s.dir || 1);
		}
		if(s.t % 400 === 0) s.dir *= -1;
		const frac = defeatedFrac(room);
		if(living(room).length === 0 && frac > 0) finish(room, 'The last chamber holds. A jungle cache sits above the flood.');
	}

	function initHunt(room){
		const s = st(room);
		if(s.init) return;
		s.init = true;
		s.quiet = true;
		s.packs = {1:[],2:[],3:[]};
		allTagged(room).forEach(function(e){
			const p = e.pack || 1;
			e._packSleep = true;
			e.state = 'idle';
			(s.packs[p] || (s.packs[p] = [])).push(e);
		});
		s.zones = [
			{pack:1, x:room.x+40, y:room.y+900, w:900, h:920},
			{pack:2, x:room.x+860, y:room.y+160, w:920, h:1200},
			{pack:3, x:room.x+1680, y:room.y+160, w:960, h:1460}
		];
		s.alerted = {};
		s.fightT = {};
		banner('ANCIENT HUNTING GROUNDS — the packs have not seen you yet.');
	}
	function alertPack(room, id, reason){
		const s = st(room);
		if(s.alerted[id]) return;
		const fighting = Object.keys(s.alerted).filter(function(k){ return s.alerted[k]; });
		if(fighting.length && reason === 'noise') s.quiet = false;
		if(fighting.length && reason !== 'enter') s.quiet = false;
		s.alerted[id] = true;
		(s.packs[id]||[]).forEach(wake);
		banner(reason === 'enter' ? 'The pack in this territory turns on you.' : 'A nearby pack heard the fight.');
	}
	function tickHunt(room){
		const s = st(room);
		initHunt(room);
		if(typeof player === 'undefined' || !player) return;
		s.zones.forEach(function(z){
			if(hitPlayer(z.x, z.y, z.w, z.h)) alertPack(room, z.pack, 'enter');
		});
		allTagged(room).forEach(function(e){
			if(e._packSleep){ e.vx = 0; e.vy = Math.min(e.vy||0, 2); e.state = 'idle'; e.alertTimer = 0; }
		});
		Object.keys(s.alerted).forEach(function(id){
			if(!s.alerted[id]) return;
			s.fightT[id] = (s.fightT[id] || 0) + 1;
			if(s.fightT[id] === 280){
				const other = [1,2,3].filter(function(n){ return n != id && !s.alerted[n]; })[0];
				if(other) alertPack(room, other, 'noise');
			}
		});
		if(s.phase < 2 && living(room).length === 0 && Object.keys(s.alerted).length){
			const leftover = allTagged(room).filter(function(e){ return e._packSleep; });
			if(leftover.length) return;
			s.phase = 2;
			spawnAt(room, 'thornWolf', room.x + room.w - 200, room.y + room.h - 200);
			spawnAt(room, 'thornWolf', room.x + room.w - 360, room.y + room.h - 200);
			spawnAt(room, 'windSylph', room.x + room.w - 280, room.y + 240);
			spawnAt(room, 'skyVine', room.x + room.w - 500, room.y + 360);
			banner('A last pack pours from the deep grass.');
		}
		if(s.phase >= 2 && living(room).length === 0){
			if(s.quiet){ unlock(room, 'tribute'); banner('You hunted without waking the others. A tribute cache opens.'); }
			finish(room, 'The hunting grounds go still.');
		}
	}

	function initColosseum(room){
		const s = st(room);
		if(s.init) return;
		s.init = true;
		s.pop = Math.max(living(room).length, 6);
		s.flowers = hazards().filter(function(h){ return h.roomId === room.id && h.type === 'colosseumFlower'; });
		if(s.flowers.length < 6){
			const types = ['bounce','thorn','spore','bloom','bounce','thorn'];
			for(let i = s.flowers.length; i < 10; i++){
				const ang = (i / 10) * Math.PI * 2;
				const h = {
					type:'colosseumFlower', flower:types[i%types.length],
					x:room.x + room.w/2 + Math.cos(ang)*620 - 70,
					y:room.y + room.h/2 + Math.sin(ang)*380 - 40,
					w:140, h:120, roomId:room.id, period:160+i*12, phase:i*20
				};
				hazards().push(h); s.flowers.push(h);
			}
		}
		banner('THE BLOOMING COLOSSEUM — the flowers are part of the fight.');
	}
	function tickColosseum(room){
		const s = st(room);
		initColosseum(room);
		const frac = defeatedFrac(room);
		if(frac >= 0.4 && s.phase < 2){ s.phase = 2; banner('More blooms open around the ring.'); }
		if(frac >= 0.7 && s.phase < 3){ s.phase = 3; banner('The arena is fully awake.'); }
		if(frac >= 0.85 && s.phase < 4){
			s.phase = 4;
			spawnAt(room, 'elderTreant', room.x + room.w/2, room.y + room.h - 220);
			spawnAt(room, 'thornWolf', room.x + 500, room.y + room.h - 200);
			spawnAt(room, 'thornWolf', room.x + 1900, room.y + room.h - 200);
			spawnAt(room, 'windSylph', room.x + 700, room.y + 300);
			spawnAt(room, 'windSylph', room.x + 1800, room.y + 280);
			banner('An elder of the grove enters the ring.');
		}
		const activeN = s.phase === 1 ? 3 : (s.phase === 2 ? 6 : 10);
		s.flowers.forEach(function(h, i){
			h.t = (h.t || 0) + 1;
			const cyc = (h.t + h.phase) % (h.period || 170);
			h.open = i < activeN && cyc > 40 && cyc < 110;
			h.bud = i < activeN && cyc > 20 && cyc <= 40;
			if(!h.open) return;
			if(h.flower === 'bounce' && typeof player !== 'undefined' && player && hitPlayer(h.x, h.y, h.w, h.h)){
				player.vy = -16; player.y = h.y - player.h - 2;
			}
			if(h.flower === 'thorn' && cyc === 70){
				if(hitPlayer(h.x-40, h.y-20, h.w+80, h.h+40)) dmg(12, []);
			}
			if(h.flower === 'spore' && hitPlayer(h.x-30, h.y-30, h.w+60, h.h+60)){
				if(typeof player !== 'undefined' && player) player.blindTimer = Math.max(player.blindTimer||0, 8);
			}
			if(h.flower === 'bloom' && hitPlayer(h.x, h.y, h.w, h.h)){
				if(typeof health !== 'undefined' && typeof maxHealth !== 'undefined' && Pmod(h)){
					health = Math.min(maxHealth, health + 1);
					if(typeof player !== 'undefined' && player) player.health = health;
				}
			}
		});
		if(living(room).length === 0 && s.phase >= 4) finish(room, 'The colosseum blooms out. A cache waits in the ring.');
		if(living(room).length === 0 && frac > 0 && s.phase < 4){
			/* wait for final wave */
		}
	}
	function Pmod(h){ h._healT = (h._healT || 0) + 1; return h._healT % 40 === 0; }

	function initCollapse(room){
		const s = st(room);
		if(s.init) return;
		s.init = true;
		s.pop = Math.max(living(room).length, 6);
		s.secs = plats().filter(function(p){ return p.roomId === room.id && p._section; })
			.sort(function(a,b){ return a._section - b._section; });
		if(!s.secs.length){
			plats().filter(function(p){ return p.roomId === room.id && p.kind === 'static' && !p.vineRung; })
				.forEach(function(p, i){ p._section = 1 + (i % 5); s.secs.push(p); });
		}
		s.order = [1,2,3,4];
		s.at = 0;
		s.warnT = 0;
		banner('THE ROOT COLLAPSE — the temple is tearing itself apart.');
	}
	function tickCollapse(room){
		const s = st(room);
		initCollapse(room);
		s.t = (s.t || 0) + 1;
		const frac = defeatedFrac(room);
		if(s.t === 120 || (frac > 0.25 && s.at < 1) || (frac > 0.5 && s.at < 2) || (frac > 0.72 && s.at < 3)){
			if(s.at < s.order.length){
				const id = s.order[s.at];
				s.secs.forEach(function(p){
					if(p._section === id){ p._crack = 1; p._tick = 1; }
				});
				s.warnT = 90;
				s.at++;
				shake(5, 10);
				banner('Roots split the floor — move.');
			}
		}
		if(s.warnT > 0) s.warnT--;
		if(s.warnT === 1){
			const id = s.order[s.at - 1];
			s.secs.forEach(function(p){
				if(p._section === id){
					p._gone = true;
					if(global.DungeonEnv && DungeonEnv.breakPlatform) DungeonEnv.breakPlatform(p);
				}
			});
			if(s.at === 2){
				spawnAt(room, 'skyVine', room.x + 900, room.y + 280);
				spawnAt(room, 'skyVine', room.x + 1500, room.y + 240);
				spawnAt(room, 'windSylph', room.x + 1200, room.y + 200);
			}
			if(s.at === 4){
				spawnAt(room, 'thornWolf', room.x + room.w - 380, room.y + 420);
				spawnAt(room, 'thornWolf', room.x + room.w - 240, room.y + 420);
				spawnAt(room, 'elderTreant', room.x + room.w - 520, room.y + 480);
				banner('The last platform holds. Finish it there.');
			}
		}
		if(s.at >= 4 && living(room).length === 0){
			unlock(room, 'secret');
			finish(room, 'The collapse stops. The far door is still standing.');
		}
	}

	function update(){
		const r = env() && env().currentRoom;
		if(!r || !isKind(r) || r.cleared) return;
		st(r).t++;
		if(r.kind === 'predatorsGauntlet') tickGauntlet(r);
		else if(r.kind === 'livingFortress') tickFortress(r);
		else if(r.kind === 'sporefall') tickSporefall(r);
		else if(r.kind === 'thornCathedral') tickThorn(r);
		else if(r.kind === 'floodedRootway') tickFlood(r);
		else if(r.kind === 'ancientHunting') tickHunt(r);
		else if(r.kind === 'bloomingColosseum') tickColosseum(r);
		else if(r.kind === 'rootCollapse') tickCollapse(r);
	}

	function draw(ctx){
		const r = env() && env().currentRoom;
		if(!r || !isKind(r)) return;
		const s = st(r);
		const c = cam();
		if(r.kind === 'predatorsGauntlet' && s.roots){
			s.roots.forEach(function(rt){
				ctx.save();
				ctx.translate(rt.x - c.x + rt.w/2, rt.y - c.y);
				if(rt.hot) ctx.rotate(0.5 * rt.swing);
				ctx.fillStyle = rt.warn ? '#c8b15a' : '#4a6a32';
				ctx.fillRect(-rt.w/2, 0, rt.w, rt.h);
				if(rt.warn){
					ctx.fillStyle = 'rgba(220,200,80,.35)';
					for(let i = 0; i < 6; i++) ctx.fillRect(-10 + i*4, 20+i*18, 4, 8);
				}
				ctx.restore();
			});
		}
		if(r.kind === 'livingFortress' && s.attacks){
			s.attacks.forEach(function(a){
				if(a.warn){ ctx.fillStyle = 'rgba(220,180,70,.22)'; ctx.fillRect(a.x-c.x, a.y-c.y, a.w, a.h); }
				if(a.hot){ ctx.fillStyle = 'rgba(90,140,50,.55)'; ctx.fillRect(a.x-c.x, a.y-c.y, a.w, a.h); }
			});
			(s.cores||[]).forEach(function(core){
				if(core.hp <= 0) return;
				ctx.fillStyle = core.protected ? '#355028' : '#d6ef7a';
				ctx.beginPath(); ctx.arc(core.x-c.x+core.w/2, core.y-c.y+core.h/2, 22, 0, Math.PI*2); ctx.fill();
				if(!core.protected){
					ctx.strokeStyle = '#f6ffc0'; ctx.strokeRect(core.x-c.x, core.y-c.y, core.w, core.h);
				}
			});
		}
		if(r.kind === 'sporefall' && s.mush){
			s.mush.forEach(function(h){
				if(h._dead) return;
				if(h.state >= 2){
					ctx.fillStyle = 'rgba(180,220,90,' + (h.state === 4 ? 0.28 : 0.12) + ')';
					ctx.beginPath(); ctx.arc(h.x-c.x+h.w/2, h.y-c.y+h.h/2, h.rad || 40, 0, Math.PI*2); ctx.fill();
				}
			});
		}
		if(r.kind === 'thornCathedral' && s.thorns){
			s.thorns.forEach(function(h){
				if(h.warn){ ctx.fillStyle = 'rgba(180,80,60,.25)'; ctx.fillRect(h.x-c.x-10, h.y-c.y, h.w+20, h.h); }
				if(h.grown){ ctx.fillStyle = '#6a3030'; ctx.fillRect(h.x-c.x, h.y-c.y, h.w, h.h); }
			});
		}
		if(r.kind === 'bloomingColosseum' && s.flowers){
			s.flowers.forEach(function(h){
				if(h.bud){ ctx.fillStyle = 'rgba(240,200,80,.25)'; ctx.beginPath(); ctx.arc(h.x-c.x+h.w/2,h.y-c.y+h.h/2,30,0,Math.PI*2); ctx.fill(); }
				if(h.open){
					const col = h.flower === 'bounce' ? '#7ad0ef' : (h.flower === 'thorn' ? '#d07050' : (h.flower === 'spore' ? '#b8e060' : '#f0d070'));
					ctx.fillStyle = col; ctx.globalAlpha = 0.4;
					ctx.beginPath(); ctx.arc(h.x-c.x+h.w/2,h.y-c.y+h.h/2,38,0,Math.PI*2); ctx.fill();
					ctx.globalAlpha = 1;
				}
			});
		}
		if(r.kind === 'ancientHunting' && s.zones && !r.cleared){
			s.zones.forEach(function(z){
				if(s.alerted[z.pack]) return;
				ctx.strokeStyle = 'rgba(220,200,90,.18)';
				ctx.strokeRect(z.x-c.x, z.y-c.y, z.w, z.h);
			});
		}
		if(r._fortressBloom || r._cathedralOpen){
			ctx.fillStyle = 'rgba(255,240,160,.08)';
			ctx.fillRect(r.x-c.x, r.y-c.y, r.w, r.h);
		}
	}

	function onEnemyDeath(en){
		if(!en) return;
		const r = rooms()[en.roomId];
		if(!r || !isKind(r)) return;
		/* clear is handled in update when living() hits 0 */
	}

	function tryInteract(it){
		if(!it) return false;
		const r = rooms()[it.roomId];
		if(!r || !isKind(r)) return false;
		if(it.kind === 'rootCore'){
			banner(it.hp <= 0 ? 'The core is split.' : (it.protected ? 'Thick roots still armor the core.' : 'The core is open — any strike will wound it.'));
			return true;
		}
		if(it.kind === 'sporeHeart'){
			banner('A spore heart. Break three to still the largest cap.');
			return true;
		}
		return false;
	}

	function prompt(it){
		if(!it) return null;
		if(it.kind === 'rootCore') return it.protected ? 'The core is armored' : 'Strike the glowing core';
		if(it.kind === 'sporeHeart') return 'Destroy the spore heart';
		return null;
	}

	function roomBanner(r){
		if(!r || !KINDS[r.kind]) return false;
		return true;
	}

	global.JungleSetpiece = {
		isKind:isKind,
		update:update,
		draw:draw,
		onEnemyDeath:onEnemyDeath,
		tryInteract:tryInteract,
		prompt:prompt,
		roomBanner:roomBanner
	};
})(typeof window !== 'undefined' ? window : globalThis);
