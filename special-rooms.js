/* =============================================================
   Special handcrafted rooms — Infernal / Glacial / Wilds extras.
   Uses existing enemies, loot, interact, and clear plumbing.
   ============================================================= */
(function(global){
	'use strict';

	const KINDS = {
		magmaSiphon:1, ashenFoundry:1, collapsingDescent:1,
		frozenObservatory:1, frozenLake:1, shatterMaze:1,
		overgrownCanopy:1, sporeGarden:1, rootboundRuins:1
	};

	const hold = { it:null, t:0, hp:0 };
	const fx = [];

	function dung(){ return (typeof dungeon !== 'undefined' && dungeon) || global.dungeon; }
	function rooms(){ return (dung() && dung().rooms) || []; }
	function interacts(){ return (dung() && dung().interactables) || []; }
	function plats(){ return (typeof platforms !== 'undefined' && platforms) || (dung() && dung().platforms) || []; }
	function env(){ return global.DungeonEnv; }
	function isSpecial(r){ return !!(r && (KINDS[r.kind] || (global.FireSetpiece && FireSetpiece.isKind(r)))); }
	function roomOf(it){ return it && rooms()[it.roomId]; }
	function playerHp(){ return (typeof health === 'number') ? health : 0; }
	function inRange(it, reach){
		if(typeof player === 'undefined' || !it) return false;
		const px = player.x + player.w / 2, py = player.y + player.h / 2;
		return Math.abs(px - (it.x + (it.w || 60) / 2)) < (reach || 96) &&
			Math.abs(py - (it.y + (it.h || 60) / 2)) < (reach || 110);
	}
	function banner(t){ if(env() && env().showBanner) env().showBanner(t); }
	function shake(a, b){ if(typeof shakeScreen === 'function') shakeScreen(a, b); }
	function spawnAt(room, type, x, y, extra){
		if(typeof ENEMY_TYPES === 'undefined' || !ENEMY_TYPES[type] || typeof enemies === 'undefined') return null;
		const t = ENEMY_TYPES[type];
		const hpM = (typeof DIFF_HP_MULT === 'number') ? DIFF_HP_MULT : 1;
		const szM = (typeof DIFF_SIZE_MULT === 'number') ? DIFF_SIZE_MULT : 1;
		const en = Object.assign({
			type: type, typeDef: t,
			x: x, y: y,
			w: Math.round(t.w * szM), h: Math.round(t.h * szM),
			vx:0, vy:0,
			hp: Math.round(t.hp * hpM), maxHp: Math.round(t.hp * hpM),
			facing:1, patrol:[x - 160, x + 160], patrolDir:1, state:'alert',
			alertTimer:90, spellCooldowns:(t.spells || []).map(function(){ return 30; }),
			currentSpell:0, flash:0, dots:[], stunTimer:0, slowTimer:0, animTimer:0,
			attackAnimTimer:0, dead:false, deathTimer:0,
			baseY: y, flyOffset:0, charging:false, chargeVx:0, chargeVy:0, chargeTimer:0,
			chargeCastDone:false, bossPhase:1, puzzleSeg: room.section || room.depth || 1,
			roomId: room.id,
		}, extra || {});
		enemies.push(en);
		return en;
	}
	function openLoot(it, tier){
		if(!it || it.used || it._locked) return false;
		const secret = tier === 'secret';
		const challenge = tier === 'challenge' || secret;
		it.rare = it.rare || secret;
		it._chest = it._chest || true;
		if(global.ChestLoot && ChestLoot.beginOpen(it, {
			better: challenge,
			gold: secret ? 70 : (challenge ? 58 : 50),
			label: it.name || (secret ? 'A secret cache.' : 'A special cache.')
		})){
			if(global.GearSystem && GearSystem.rollGemDrop && (secret || Math.random() < 0.22)){
				const diff = (typeof DIFFICULTY !== 'undefined' && DIFFICULTY) ? DIFFICULTY : 'normal';
				const gem = GearSystem.rollGemDrop({ difficulty: diff });
				if(gem && typeof addDroppedGear === 'function') addDroppedGear(gem, { silentFloat:true });
			}
			return true;
		}
		it.used = true;
		if(env() && env().grantLoot) env().grantLoot(env().themeLoot(challenge), it.name || 'Cache');
		return true;
	}
	function unlockCaches(room, tag){
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(it.roomId !== room.id) continue;
			if(it._lockTag === tag || (tag === 'main' && it._mainCache)) it._locked = false;
		}
	}
	function countKind(room, kind, pred){
		let n = 0;
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(it.roomId !== room.id || it.kind !== kind) continue;
			if(pred && !pred(it)) continue;
			n++;
		}
		return n;
	}
	function enemiesAlive(room){
		if(!env() || !env().roomEnemies) return 0;
		return env().roomEnemies(room).length;
	}
	function addFx(kind, x, y, life, extra){
		fx.push(Object.assign({ kind:kind, x:x, y:y, t:0, life:life || 40 }, extra || {}));
	}

	function st(room){
		if(!room._sr) room._sr = { phase:0, t:0, heat:0, seq:[], seqI:0, fails:0, beams:0 };
		return room._sr;
	}

	function beginHold(it, need){
		hold.it = it;
		hold.t = 0;
		hold.need = need || 78;
		hold.hp = playerHp();
		it._holding = true;
	}
	function tickHold(){
		if(!hold.it) return;
		const it = hold.it;
		if(!inRange(it, 108) || playerHp() < hold.hp - 7){
			it._holding = false;
			it._holdT = 0;
			hold.it = null;
			banner('Interrupted.');
			return;
		}
		hold.hp = Math.min(hold.hp, playerHp());
		hold.t++;
		it._holdT = hold.t / hold.need;
		if(hold.t >= hold.need){
			it._holding = false;
			hold.it = null;
			finishHold(it);
		}
	}
	function finishHold(it){
		const room = roomOf(it);
		if(!room) return;
		if(it.kind === 'magmaSiphon'){
			it.used = true;
			it._off = true;
			const n = countKind(room, 'magmaSiphon', function(s){ return s._off && !s._secret; });
			st(room).phase = Math.max(st(room).phase, n);
			shake(6 + n * 3, 12);
			banner(n >= 3 ? 'The reservoir surges — hold on.' : (n + ' / 3 siphons sealed.'));
			if(n === 1) room._lavaRush = true;
			if(n === 2) armVents(room, 1);
			if(n >= 3) startSiphonFinale(room);
		}
	}
	function armVents(room, extra){
		if(typeof hazards === 'undefined') return;
		for(let i = 0; i < hazards.length; i++){
			const h = hazards[i];
			if(h.roomId !== room.id || h.type !== 'vent') continue;
			h.period = Math.max(70, (h.period || 160) - 40 * extra);
			h._armedHot = true;
		}
	}
	function startSiphonFinale(room){
		const s = st(room);
		if(s.finale) return;
		s.finale = true;
		s.finaleT = room._overload ? 420 : 260;
		s.t = 0;
		if(room._overload){
			armVents(room, 2);
			spawnAt(room, 'fireSprite', room.x + 180, room.y + 80);
			spawnAt(room, 'flameSerpent', room.x + room.w * 0.5, room.y + room.h - 120);
			spawnAt(room, 'emberMage', room.x + room.w - 260, room.y + 160);
		}
		banner(room._overload ? 'OVERLOAD — the chamber tears itself open.' : 'The siphons scream. Survive the tremor.');
	}

	function tryInteract(it){
		if(global.FirePuzzles && FirePuzzles.tryInteract(it)) return true;
		if(!it || it.used || it._locked) return false;
		const room = roomOf(it);
		if(!room || !isSpecial(room)){
			if(it.kind === 'magmaSiphon' || it.kind === 'obsMirror' || it.kind === 'sporeFlower' ||
				it.kind === 'iceBreak' || it.kind === 'hiddenSiphon' || it.kind === 'magmaCoreSlot' ||
				it.kind === 'forgeChoice' || it.kind === 'rootSwitch') return true;
			return false;
		}
		if(global.FireSetpiece && FireSetpiece.tryInteract(it)) return true;
		if(it.kind === 'magmaSiphon' || it.kind === 'hiddenSiphon'){
			if(it._off) return true;
			beginHold(it, it._secret ? 70 : 78);
			return true;
		}
		if(it.kind === 'forgeChoice'){
			it.used = true;
			if(it._mode === 'overload'){
				room._overload = true;
				banner('The hidden siphon overloads.');
				startSiphonFinale(room);
			} else {
				banner('The hidden machine is wrecked.');
				unlockCaches(room, 'secretSmall');
			}
			return true;
		}
		if(it.kind === 'secretWall' || it.kind === 'crackedRock'){
			it.used = true;
			if(it.punch) {
				if(env() && env().stampTiles) env().stampTiles(it.punch.x, it.punch.y, it.punch.w, it.punch.h, true);
				if(typeof computeTileEdges === 'function') computeTileEdges();
			}
			for(let i = 0; i < interacts().length; i++){
				const o = interacts()[i];
				if(o.roomId === room.id && o._revealWith === it.id) o._locked = false;
			}
			banner(it.lore || 'The rock gives way.');
			shake(8, 14);
			return true;
		}
		if(it.kind === 'magmaCore'){
			it.used = true;
			room._cores = (room._cores || 0) + 1;
			banner('Magma Core ' + room._cores + ' / 3.');
			return true;
		}
		if(it.kind === 'magmaCoreSlot'){
			if((room._cores || 0) < 3){ banner('The forge wants three cores.'); return true; }
			it.used = true;
			st(room).phase = 2;
			st(room).t = 0;
			armVents(room, 1);
			banner('The foundry wakes.');
			return true;
		}
		if(it.kind === 'obsMirror'){
			it.ang = ((it.ang || 0) + 1) % (it.faces || 4);
			const s = st(room);
			s.turns = (s.turns || 0) + 1;
			if(s.turns === 1) thawFrozen(room, 'ring1');
			if(s.turns >= 3) thawFrozen(room);
			checkObservatory(room);
			banner('The mirror turns.');
			return true;
		}
		if(it.kind === 'iceBreak'){
			it.used = true;
			if(it.punch && env() && env().stampTiles){
				env().stampTiles(it.punch.x, it.punch.y, it.punch.w, it.punch.h, true);
				if(typeof computeTileEdges === 'function') computeTileEdges();
			}
			if(it._thaw) thawFrozen(room, it._thaw);
			banner(it.lore || 'The ice shears.');
			return true;
		}
		if(it.kind === 'sporeFlower'){
			pressFlower(room, it);
			return true;
		}
		if(it.kind === 'rootSwitch'){
			it.used = true;
			if(it.punch && env() && env().stampTiles){
				env().stampTiles(it.punch.x, it.punch.y, it.punch.w, it.punch.h, true);
				if(typeof computeTileEdges === 'function') computeTileEdges();
			}
			banner('The roots pull aside.');
			return true;
		}
		if(it.kind === 'cache' || it.kind === 'specialCache'){
			openLoot(it, it._lootTier || (it.rare ? 'secret' : 'challenge'));
			return true;
		}
		return false;
	}

	function pressFlower(room, it){
		const s = st(room);
		if(!s.seq.length) s.seq = room._flowerSeq || [0, 1, 2];
		if(it._secretCombo){
			s.secret = (s.secret || 0) + 1;
			if(s.secret >= (room._secretNeed || 3)){
				unlockCaches(room, 'secret');
				banner('A hidden bloom opens.');
			} else banner('The petals remember.');
			return;
		}
		const want = s.seq[s.seqI] ;
		if(it._idx === want){
			s.seqI++;
			addFx('bloom', it.x + 20, it.y, 36);
			if(s.seqI >= s.seq.length){
				s.phase = 2;
				unlockCaches(room, 'main');
				if(env()) env().clearRoom(room, 'The garden accepts the sequence.');
				banner('The central flower blooms.');
			} else banner('The garden answers (' + s.seqI + '/' + s.seq.length + ').');
		} else {
			s.seqI = 0;
			s.fails++;
			spawnAt(room, 'sporeFungus', room.x + 200 + s.fails * 80, room.y + 80);
			banner('Wrong flower — the spores thicken.');
		}
	}

	function checkObservatory(room){
		const s = st(room);
		let ok = 0, need = 0, secretOn = false;
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(it.roomId !== room.id || it.kind !== 'obsMirror') continue;
			if(it._secret){ if(it.ang === it.want) secretOn = true; continue; }
			need++;
			if((it.ang || 0) === (it.want || 0)) ok++;
		}
		s.beams = ok;
		if(secretOn) unlockCaches(room, 'secret');
		if(ok >= need && need > 0){
			unlockCaches(room, 'main');
			if(env()) env().clearRoom(room, 'The mechanism drinks the starlight.');
		}
	}

	function thawFrozen(room, tag){
		if(typeof enemies === 'undefined') return;
		for(let i = 0; i < enemies.length; i++){
			const en = enemies[i];
			if(en.roomId !== room.id || !en._frozenSleep) continue;
			if(tag && en._thawTag !== tag) continue;
			en._frozenSleep = false;
			en.isDormant = false;
			en.state = 'alert';
		}
		banner('Something thaws.');
	}

	function startSiphonCheck(room){
		const s = st(room);
		if(!s.finale) return;
		s.t++;
		if(s.t % 50 === 0){
			shake(5, 10);
			addFx('rock', room.x + 80 + Math.random() * (room.w - 160), room.y + 40, 40);
		}
		if(s.t === 1 || (room._overload && s.t % 90 === 0)){
			for(let i = 0; i < plats().length; i++){
				const p = plats()[i];
				if(p.roomId === room.id && p.kind === 'collapse') p._tick = (p._tick || 0) + 20;
			}
		}
		if(s.t >= s.finaleT && enemiesAlive(room) === 0){
			unlockCaches(room, 'main');
			if(room._overload) unlockCaches(room, 'secret');
			if(env()) env().clearRoom(room, 'The reservoir stills.');
			s.finale = false;
		}
	}

	function tickFoundry(room){
		const s = st(room);
		if(s.phase < 2) return;
		s.t++;
		s.heat++;
		if(s.phase === 2 && s.t > 280){
			s.phase = 3;
			const gx = room.x + room.w * 0.5 - 50;
			const gy = room.y + 80;
			const en = spawnAt(room, 'magmaGolem', gx, gy, {
				isMiniBoss:true, _forgeGuardian:true,
				hp: 0, maxHp: 0,
			});
			if(en){
				const base = en.typeDef.hp || 400;
				const hpM = (typeof DIFF_HP_MULT === 'number') ? DIFF_HP_MULT : 1;
				en.hp = en.maxHp = Math.round(base * hpM * 2.4);
				en.w = Math.round(en.w * 1.35);
				en.h = Math.round(en.h * 1.35);
			}
			if(s.heat < 200) room._forgeBias = 'under';
			else if(s.heat > 420) room._forgeBias = 'over';
			else room._forgeBias = 'stable';
			banner('FORGE GUARDIAN');
			shake(14, 20);
		}
	}

	function tickGuardian(en){
		if(!en || !en._forgeGuardian || en.dead) return;
		en._gt = (en._gt || 0) + 1;
		if(en._gt % 140 === 40 && typeof player !== 'undefined'){
			en.charging = true;
			en.chargeTimer = 36;
			const dx = (player.x - en.x); en.chargeVx = dx > 0 ? 5.2 : -5.2;
		}
		if(en._gt % 180 === 90){
			addFx('shock', en.x + en.w / 2, en.y + en.h, 28, { r: 90 });
			if(typeof player !== 'undefined' && Math.hypot(player.x - en.x, player.y - en.y) < 140 && typeof damagePlayer === 'function'){
				damagePlayer(12, 'forge');
			}
		}
	}

	function tickMageSiphon(room){
		if(typeof enemies === 'undefined') return;
		if((st(room).t || 0) % 200 !== 40) return;
		let mage = false;
		for(let i = 0; i < enemies.length; i++){
			const en = enemies[i];
			if(en.roomId === room.id && en.type === 'emberMage' && !en.dead) mage = true;
		}
		if(!mage) return;
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(it.roomId === room.id && it.kind === 'magmaSiphon' && it._off && !it._secret){
				it._off = false; it.used = false;
				st(room).phase = Math.max(0, countKind(room, 'magmaSiphon', function(s){ return s._off && !s._secret; }));
				banner('An Ember Mage reignites a siphon.');
				break;
			}
		}
	}

	function onEnemyDeath(en){
		if(!en) return false;
		const room = rooms()[en.roomId];
		if(!room || !isSpecial(room)) return false;
		if(en._dropsCore){
			interacts().push({
				kind:'magmaCore', roomId:room.id, x:en.x, y:en.y, w:44, h:44,
				name:'Magma Core', icon:'🔶', used:false
			});
			banner('A magma core cools from the corpse.');
		}
		if(en._forgeGuardian){
			for(let i = 0; i < interacts().length; i++){
				const it = interacts()[i];
				if(it.roomId === room.id && it._mainCache){
					it._locked = false;
					it._lootTier = room._forgeBias === 'over' ? 'challenge' : (room._forgeBias === 'under' ? 'challenge' : 'challenge');
				}
			}
			if(env()) env().clearRoom(room, 'The guardian slags over.');
			return true;
		}
		if(en._ruinsBoss && room.kind === 'rootboundRuins'){
			for(let i = 0; i < interacts().length; i++){
				const it = interacts()[i];
				if(it.roomId === room.id && it._route === 'combat') it._locked = false;
			}
			if(itPunch(room, 'combat')) {/* opened */}
			banner('The elder root releases the stair.');
		}
		return false;
	}
	function itPunch(room, route){
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(it.roomId === room.id && it._openRoute === route && it.punch && env() && env().stampTiles){
				env().stampTiles(it.punch.x, it.punch.y, it.punch.w, it.punch.h, true);
				if(typeof computeTileEdges === 'function') computeTileEdges();
				it.used = true;
			}
		}
	}

	function tickLake(room){
		if(typeof player === 'undefined') return;
		const px = player.x + player.w / 2, py = player.y + player.h;
		for(let i = 0; i < plats().length; i++){
			const p = plats()[i];
			if(p.roomId !== room.id || !p._iceState) continue;
			if(player.x + player.w < p.x || player.x > p.x + p.w) continue;
			if(Math.abs(py - p.y) > 18) continue;
			if(p._iceState === 'veryThin'){
				p._stress = (p._stress || 0) + 1;
				if(p._stress > 70 && !p._gone){
					p._gone = true;
					addFx('crack', p.x + p.w / 2, p.y, 24);
				}
			} else if(p._iceState === 'thin'){
				p._stress = (p._stress || 0) + 0.35;
				if(p._stress > 140) p._iceState = 'veryThin';
			}
		}
	}

	function update(){
		tickHold();
		if(global.FireSetpiece) FireSetpiece.update();
		const list = rooms();
		for(let r = 0; r < list.length; r++){
			const room = list[r];
			if(!isSpecial(room)) continue;
			if(env() && env().currentRoom && env().currentRoom.id !== room.id && !st(room).finale) continue;
			if(room.kind === 'magmaSiphon'){
				startSiphonCheck(room);
				tickMageSiphon(room);
				st(room).t = (st(room).t || 0) + 1;
			}
			if(room.kind === 'ashenFoundry') tickFoundry(room);
			if(room.kind === 'frozenLake') tickLake(room);
			if(room.kind === 'collapsingDescent' || room.kind === 'frozenLake' || room.kind === 'overgrownCanopy'){
				if(!room.cleared && room.clearZone && env() && playerIn(room.clearZone)){
					unlockCaches(room, 'main');
					env().clearRoom(room, room.kind === 'overgrownCanopy' ? 'The canopy path opens.' : 'The far side is reached.');
				}
			}
			if(room.kind === 'rootboundRuins' && !room.cleared && room.clearZone && env() && playerIn(room.clearZone)){
				unlockCaches(room, 'main');
				env().clearRoom(room, 'The rootbound heart yields.');
			}
		}
		if(typeof enemies !== 'undefined'){
			for(let i = 0; i < enemies.length; i++) tickGuardian(enemies[i]);
		}
		for(let i = fx.length - 1; i >= 0; i--){
			fx[i].t++;
			if(fx[i].t > fx[i].life) fx.splice(i, 1);
		}
	}
	function playerIn(z){
		if(!z || typeof player === 'undefined') return false;
		return player.x + player.w > z.x && player.x < z.x + z.w && player.y + player.h > z.y && player.y < z.y + z.h;
	}

	function tryUseNearby(){
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(!it || it.used || it._locked) continue;
			const room = roomOf(it);
			if(!room || !isSpecial(room)) continue;
			if(!inRange(it, it.kind === 'magmaSiphon' ? 110 : 96)) continue;
			if(tryInteract(it)) return true;
		}
		return false;
	}

	function prompt(){
		if(global.FirePuzzles){
			const fp = FirePuzzles.prompt();
			if(fp) return fp;
		}
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(!it || it.used || it._locked) continue;
			const room = roomOf(it);
			if(!room || !isSpecial(room)) continue;
			if(!inRange(it, 110)) continue;
			if(it.kind === 'magmaSiphon' || it.kind === 'hiddenSiphon') return it._holding ? 'Sealing…' : 'Hold E — Seal the siphon';
			if(it.kind === 'obsMirror') return 'E — Rotate the mirror';
			if(it.kind === 'sporeFlower') return 'E — Touch the flower';
			if(it.kind === 'magmaCore') return 'E — Take the Magma Core';
			if(it.kind === 'magmaCoreSlot') return 'E — Seat the cores';
			if(it.kind === 'iceBreak') return 'E — Break the ice';
			if(it.kind === 'secretWall' || it.kind === 'crackedRock') return 'E — Break the cracked stone';
			if(it.kind === 'rootSwitch') return 'E — Pull the root';
			if(it.kind === 'forgeChoice') return it._mode === 'overload' ? 'E — Overload the siphon' : 'E — Destroy the siphon';
			if((it.kind === 'cache' || it.kind === 'specialCache') && !it._locked) return 'E — Open ' + (it.name || 'the cache');
			if(global.FireSetpiece){
				const extra = FireSetpiece.prompt(it);
				if(extra) return extra;
			}
		}
		return null;
	}

	function draw(ctx){
		if(!ctx || typeof camera === 'undefined') return;
		if(global.FireSetpiece) FireSetpiece.draw(ctx);
		const camx = camera.x, camy = camera.y;
		for(let i = 0; i < interacts().length; i++){
			const it = interacts()[i];
			if(!it || it._locked) continue;
			const sx = it.x - camx, sy = it.y - camy;
			if(sx < -80 || sx > (typeof canvas !== 'undefined' ? canvas.width : 1600) + 80) continue;
			if(it.kind === 'obsMirror'){
				ctx.save();
				ctx.translate(sx + 24, sy + 30);
				ctx.rotate((it.ang || 0) * Math.PI / 2);
				ctx.fillStyle = it._wrong ? 'rgba(255,210,120,0.75)' : 'rgba(190,230,255,0.7)';
				ctx.fillRect(-18, -4, 36, 8);
				ctx.restore();
				if((it.ang || 0) === (it.want || 0)){
					ctx.strokeStyle = 'rgba(180,240,255,0.55)';
					ctx.beginPath(); ctx.moveTo(sx + 24, sy + 30); ctx.lineTo(sx + 24 + 80, sy + 10); ctx.stroke();
				}
			}
			if(it.kind === 'magmaSiphon' || it.kind === 'hiddenSiphon'){
				ctx.fillStyle = it._off ? '#3a2418' : '#ff6a22';
				ctx.fillRect(sx + 8, sy + 8, (it.w || 60) - 16, (it.h || 70) - 16);
				if(it._holding){
					ctx.fillStyle = '#ffe080';
					ctx.fillRect(sx, sy - 10, (it.w || 60) * (it._holdT || 0), 5);
				}
			}
			if(it.kind === 'sporeFlower'){
				ctx.fillStyle = it._color === 'blue' ? '#5ad0ff' : (it._color === 'purple' ? '#b060ff' : '#6adf6a');
				ctx.beginPath(); ctx.arc(sx + 22, sy + 28, 16, 0, Math.PI * 2); ctx.fill();
			}
			if(it._iceState || (it.kind === 'iceBreak')){
				ctx.strokeStyle = 'rgba(200,240,255,0.45)';
				ctx.strokeRect(sx, sy, it.w || 80, it.h || 20);
			}
		}
		for(let i = 0; i < plats().length; i++){
			const p = plats()[i];
			if(!p || !p._iceState || p._gone) continue;
			const sx = p.x - camx, sy = p.y - camy;
			ctx.fillStyle = p._iceState === 'thick' ? 'rgba(180,220,255,0.18)' :
				(p._iceState === 'thin' ? 'rgba(140,190,230,0.28)' : 'rgba(90,140,200,0.4)');
			ctx.fillRect(sx, sy, p.w, 8);
			if(p._iceState !== 'thick'){
				ctx.strokeStyle = 'rgba(255,255,255,0.45)';
				ctx.beginPath();
				ctx.moveTo(sx + 8, sy + 4); ctx.lineTo(sx + p.w * 0.4, sy + 2);
				ctx.moveTo(sx + p.w * 0.3, sy + 6); ctx.lineTo(sx + p.w * 0.8, sy + 3);
				ctx.stroke();
			}
		}
		for(let i = 0; i < fx.length; i++){
			const f = fx[i];
			const a = 1 - f.t / f.life;
			ctx.fillStyle = 'rgba(255,160,40,' + a + ')';
			if(f.kind === 'bloom') ctx.fillStyle = 'rgba(120,255,160,' + a + ')';
			if(f.kind === 'crack') ctx.fillStyle = 'rgba(200,230,255,' + a + ')';
			ctx.beginPath();
			ctx.arc(f.x - camx, f.y - camy, 6 + f.t * 0.4, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	function roomBanner(r){
		if(global.FireSetpiece && FireSetpiece.roomBanner(r)) return true;
		if(!r || !KINDS[r.kind]) return false;
		const map = {
			magmaSiphon:'The pit is dry. Four pumps on the ledges are dark.',
			ashenFoundry:'Feed the forge three cores — then survive what it makes.',
			collapsingDescent:'Descend. The fastest path is the cruelest.',
			frozenObservatory:'Turn the mirrors. Do not wake more than you must.',
			frozenLake:'The ice remembers what it hides.',
			shatterMaze:'Break the walls that want to be broken.',
			overgrownCanopy:'Climb. The hollow tree is watching.',
			sporeGarden:'Blue spores tell the truth. Follow them.',
			rootboundRuins:'Three ways in. One heart.',
		};
		banner((r.label || '') + ' — ' + (map[r.kind] || r.objective || ''));
		return true;
	}

	function handleClear(r){
		if(!r || !KINDS[r.kind]) return false;
		if(r.kind === 'collapsingDescent' || r.kind === 'frozenLake' || r.kind === 'overgrownCanopy' || r.kind === 'rootboundRuins'){
			if(r.clearZone && playerIn(r.clearZone)){
				unlockCaches(r, 'main');
				return false;
			}
		}
		return false;
	}

	global.SpecialRooms = {
		isSpecial: isSpecial,
		update: update,
		draw: draw,
		tryInteract: tryUseNearby,
		prompt: prompt,
		onEnemyDeath: onEnemyDeath,
		roomBanner: roomBanner,
		handleClear: handleClear,
		openLoot: openLoot,
		unlockCaches: unlockCaches,
		finishSiphon: finishHold,
		startSiphonFinale: startSiphonFinale,
	};
})(typeof window !== 'undefined' ? window : globalThis);
