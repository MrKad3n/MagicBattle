/* =============================================================
   Dungeon environment runtime — meters, hazards, choices, wardens
   ============================================================= */
(function(global){
	const TILE = 40;
	const Env = {
		ready: false,
		heat: 0,
		maxHeat: 100,
		visited: Object.create(null),
		currentRoom: null,
		banner: { text:'', t:0 },
		choiceOpen: false,
		choiceTarget: null,
		modifiers: { wardenSlain:false, furnaceOverload:false, shortcut:false },
		lootMult: 1,
	};

	function getDungeon(){
		if(global.dungeon && global.dungeon.worldW) return global.dungeon;
		return null;
	}
	function theme(){ return getDungeon() && getDungeon()._theme; }
	function rooms(){ return (getDungeon() && getDungeon().rooms) || []; }
	function hazards(){ return (getDungeon() && getDungeon().hazards) || []; }
	function platforms(){ return (getDungeon() && getDungeon().platforms) || []; }
	function interacts(){ return (getDungeon() && getDungeon().interactables) || []; }

	function roomAt(x, y){
		const list = rooms();
		for(let i = list.length - 1; i >= 0; i--){
			const r = list[i];
			if(x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) return r;
		}
		return null;
	}

	function stampTiles(x, y, w, h, air){
		const sc = Math.floor(x / TILE), ec = Math.ceil((x + w) / TILE);
		const sr = Math.floor(y / TILE), er = Math.ceil((y + h) / TILE);
		for(let r = sr; r < er && r < MAP_ROWS; r++){
			for(let c = sc; c < ec && c < MAP_COLS; c++){
				if(r >= 0 && c >= 0) tileMap[r][c] = air ? 1 : 0;
			}
		}
	}

	function stampPlatforms(){
		if(!IS_DUNGEON || !getDungeon()) return;
		for(const p of platforms()){
			if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit') continue;
			stampTiles(p.x, p.y, p.w, p.h, false);
			p._stamped = true;
		}
		const bossPlats = getDungeon()._bossPlatforms;
		if(bossPlats){
			for(const plat of bossPlats){
				stampTiles(plat.x, plat.y, plat.w, TILE, false);
			}
		}
		if(typeof computeTileEdges === 'function') computeTileEdges();
	}

	function addHeat(n, why){
		const before = Env.heat;
		Env.heat = Math.max(0, Math.min(Env.maxHeat, Env.heat + n));
		if(Env.heat !== before && why){
			if(typeof dmgNumbers !== 'undefined'){
				dmgNumbers.push({ x:player.x + player.w / 2, y:player.y - 36, text:why, age:0, color: meterColor() });
			}
		}
		Env.lootMult = 1 + Env.heat * 0.012;
		updateMeterHUD();
	}

	function meterColor(){
		const t = theme();
		if(t === 'ice') return '#88ddff';
		if(t === 'earth') return '#a8d868';
		if(t === 'iron') return '#e0a060';
		return '#ff8844';
	}

	function updateMeterHUD(){
		const el = document.getElementById('dungeonMeter');
		if(!el || !getDungeon()) return;
		const label = getDungeon()._meterLabel || 'Heat';
		const pct = Math.round(Env.heat);
		el.style.display = IS_DUNGEON ? 'block' : 'none';
		el.innerHTML = '<div style="font:11px Arial;color:#ccc;margin-bottom:3px">' + label + '</div>' +
			'<div style="width:160px;height:10px;background:#111;border:1px solid #444;border-radius:4px;overflow:hidden">' +
			'<div style="width:' + pct + '%;height:100%;background:' + meterColor() + ';box-shadow:0 0 8px ' + meterColor() + '"></div></div>' +
			'<div style="font:10px Arial;color:#aaa;margin-top:2px">' + pct + ' — deeper heat, worse rooms, better loot</div>';
	}

	function showBanner(text){
		Env.banner = { text: text, t: 160 };
		if(typeof notify === 'function') notify(text);
	}

	function hazardDmg(){
		const base = 7 + Math.floor(Env.heat / 20);
		return Math.round(base * (typeof DIFF_DMG_MULT === 'number' ? DIFF_DMG_MULT : 1));
	}

	function playerInRect(x, y, w, h){
		return player.x + player.w > x && player.x < x + w && player.y + player.h > y && player.y < y + h;
	}

	function channelRects(ch){
		const hot = ch.safe === 'left' ? ch.right : ch.left;
		return { hot, safe: ch.safe === 'left' ? ch.left : ch.right };
	}

	function burnPlayer(){
		if(player.iFrames > 0) return;
		const t = theme();
		if(t === 'ice'){
			damagePlayer(hazardDmg(), [{ type:'freeze', dmg:2, interval:40, ticks:3, color:'#88ddff' }]);
			player._iceDrag = Math.max(player._iceDrag || 0, 0.35);
		} else if(t === 'earth'){
			damagePlayer(hazardDmg() - 1, [{ type:'poison', dmg:2, interval:40, ticks:3, color:'#88cc44' }]);
		} else {
			damagePlayer(hazardDmg(), [{ type:'burn', dmg:3, interval:30, ticks:3, color:'#ff4400' }]);
		}
	}

	function updateRooms(){
		const r = roomAt(player.x + player.w / 2, player.y + player.h / 2);
		if(r && (!Env.currentRoom || Env.currentRoom.id !== r.id)){
			Env.currentRoom = r;
			if(!Env.visited[r.id]){
				Env.visited[r.id] = true;
				addHeat(4 + r.depth * 2, null);
				if(r.kind === 'crossing') showBanner(r.label + ' — no enemies. Cross the hazard.');
				else if(r.kind === 'river') showBanner(r.label + ' — ride the flow.');
				else if(r.kind === 'choice') showBanner(r.label + ' — a choice waits here.');
				else if(r.kind === 'vault') showBanner(r.label + ' — optional treasure.');
				else if(r.kind === 'warden'){
					const it = interacts().find(i => i.kind === 'banner' && i.roomId === r.id);
					showBanner((it && it.text) || r.label);
				} else if(r.kind === 'combat' && r.w >= 1600) showBanner(r.label + ' — the chamber is unstable.');
				if(Env.heat >= 36){
					for(const en of enemies){
						if(en.dead || en.roomId !== r.id || en._heatAmp) continue;
						en._heatAmp = true;
						en.hp = Math.round(en.hp * 1.12);
						en.maxHp = Math.round(en.maxHp * 1.12);
					}
				}
				if(Env.heat >= 50 && r.kind === 'combat' && !r._heatSurge){
					r._heatSurge = true;
					showBanner('The volcano surges.');
					if(typeof shakeScreen === 'function') shakeScreen(7, 16);
					for(const hz of hazards()){
						if(hz.roomId === r.id && hz.type === 'vent'){
							hz.period = Math.max(90, (hz.period || 160) * 0.78);
							hz.columnH = (hz.columnH || 200) + 40;
						}
					}
				}
			}
			for(const hz of hazards()){
				if(hz.type === 'rise' && hz.armed && hz.roomId === r.id && !hz.vault) hz.active = true;
			}
		}
	}

	function breakPlatform(p){
		if(!p || p._gone) return;
		if(p._stamped) stampTiles(p.x, p.y, p.w, p.h, true);
		p._gone = true;
		if(typeof computeTileEdges === 'function') computeTileEdges();
	}

	function updatePlatforms(){
		for(const p of platforms()){
			if((p.kind === 'collapse' || p.kind === 'pillar') && p._stamped && !p._gone){
				const on = player.onGround && playerInRect(p.x, p.y - 8, p.w, p.h + 12);
				if(on){
					p._tick = (p._tick || 0) + 1;
					if(p._tick === 8 && typeof shakeScreen === 'function') shakeScreen(3, 8);
					if(p._tick >= (p.life || 80)){
						breakPlatform(p);
						if(typeof shakeScreen === 'function') shakeScreen(6, 12);
					}
				}
			}
			if(p.kind === 'move'){
				p._t = (p._t || 0) + (p.spd || 1);
				const wave = Math.sin(p._t * 0.025);
				if(p.axis === 'y') p.y = p.homeY + wave * (p.dist || 120);
				else p.x = p.homeX + wave * (p.dist || 140);
			}
			if(p.kind === 'raft'){
				const room = rooms()[p.roomId];
				p.x += (p.spd || 1.3) * (p.raftDir || 1);
				if(room){
					if(p.x > room.x + room.w - p.w - 40){ p.x = room.x + (room._ledge || 280); p._wrapped = true; }
					if(p.x < room.x + 20){ p.x = room.x + room.w - p.w - (room._ledge || 280); p._wrapped = true; }
				}
			}
			if(p.kind === 'orbit'){
				p._ang = (p._ang != null ? p._ang : (p.ang || 0)) + (p.spd || 0.02);
				p.x = p.homeX + Math.cos(p._ang) * (p.radius || 90);
				p.y = p.homeY + Math.sin(p._ang) * (p.radius || 90);
			}
		}
		if(typeof projectiles !== 'undefined'){
			for(const p of platforms()){
				if(p.kind !== 'pillar' || p._gone) continue;
				for(const proj of projectiles){
					if(!proj || proj.hasHit) continue;
					if(proj.x > p.x && proj.x < p.x + p.w && proj.y > p.y - 20 && proj.y < p.y + p.h + 20){
						p._tick = (p._tick || 0) + 40;
						if(p._tick >= (p.life || 90)) breakPlatform(p);
					}
				}
			}
		}
	}

	function collideMovers(ent){
		if(!IS_DUNGEON) return;
		for(const p of platforms()){
			if((p.kind !== 'move' && p.kind !== 'raft' && p.kind !== 'orbit') || p._gone) continue;
			if(ent.vy < -0.2) continue;
			if(ent.x + ent.w > p.x && ent.x < p.x + p.w &&
				ent.y + ent.h >= p.y && ent.y + ent.h <= p.y + 16){
				ent.y = p.y - ent.h;
				ent.vy = 0;
				ent.onGround = true;
				const prev = p._lastX != null ? p.x - p._lastX : 0;
				if(!p._wrapped && Math.abs(prev) < 80) ent.x += prev;
			}
		}
		for(const p of platforms()){
			if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit'){
				p._lastX = p.x;
				p._wrapped = false;
			}
		}
	}

	function updateHazards(){
		const heatBoost = 1 + Env.heat / 140;
		for(const hz of hazards()){
			if(hz.type === 'vent'){
				hz._t = (hz._t || hz.phase || 0) + heatBoost;
				const cyc = hz._t % hz.period;
				const wasWarn = hz.warnOn;
				hz.warnOn = cyc > hz.period - hz.warn - hz.burst && cyc <= hz.period - hz.burst;
				hz.hot = cyc > hz.period - hz.burst;
				if(hz.warnOn && !wasWarn && Env.currentRoom && Env.currentRoom.id === hz.roomId && typeof shakeScreen === 'function'){
					shakeScreen(2, 6);
				}
				if(hz.hot && playerInRect(hz.x - 6, hz.y - hz.columnH, hz.w + 12, hz.columnH + 10)) burnPlayer();
			}
			if(hz.type === 'channel'){
				hz.timer = (hz.timer || 0) + 1;
				if(hz.timer >= (hz.flipEvery / heatBoost)){
					hz.timer = 0;
					hz.safe = hz.safe === 'left' ? 'right' : 'left';
					if(Env.currentRoom && Env.currentRoom.id === hz.roomId){
						showBanner(hz.safe === 'left' ? 'The left side is safe.' : 'The right side is safe.');
						if(typeof shakeScreen === 'function') shakeScreen(5, 10);
					}
				}
				const { hot } = channelRects(hz);
				if(playerInRect(hot.x, hz.y, hot.w, hz.h)) burnPlayer();
			}
			if(hz.type === 'fall'){
				hz._t = (hz._t || hz.phase || 0) + heatBoost;
				const cyc = hz._t % hz.period;
				hz.warnOn = cyc > hz.period - hz.warn - hz.burst && cyc <= hz.period - hz.burst;
				hz.hot = cyc > hz.period - hz.burst;
				if(hz.hot && playerInRect(hz.x, hz.y, hz.w, hz.h)) burnPlayer();
			}
			if(hz.type === 'gate'){
				hz._t = (hz._t || hz.phase || 0) + 1;
				const open = (hz._t % hz.period) < (hz.openFor || 90);
				if(open !== !hz.solid){
					hz.solid = !open;
					stampTiles(hz.x, hz.y, hz.w, hz.h, open);
					if(typeof computeTileEdges === 'function') computeTileEdges();
				}
			}
			if(hz.type === 'rise' && hz.active){
				hz.y = hz.y == null ? hz.y0 : hz.y;
				if(!hz._upDone){
					hz.y -= hz.speed * heatBoost;
					if(hz.y <= hz.y1){ hz.y = hz.y1; hz._upDone = true; hz._hold = hz.hold || 200; }
				} else if(hz._hold > 0){
					hz._hold--;
				} else {
					hz.y += hz.speed * 1.4;
					if(hz.y >= hz.y0){ hz.y = hz.y0; hz.active = false; hz._upDone = false; }
				}
				if(playerInRect(hz.x, hz.y, hz.w, 4000) && player.y + player.h > hz.y) burnPlayer();
			}
		}
	}

	function grantLoot(table, label){
		if(!table || !playerData) return;
		const mult = Env.lootMult * (Env.modifiers.wardenSlain ? 1.25 : 1) * (Env.modifiers.furnaceOverload ? 1.2 : 1);
		for(const entry of table){
			if(Math.random() > entry.chance) continue;
			let qty = entry.min + Math.floor(Math.random() * (entry.max - entry.min + 1));
			qty = Math.max(1, Math.round(qty * mult));
			const existing = playerData.inventory.find(e => e.itemId === entry.id);
			if(existing) existing.qty += qty;
			else playerData.inventory.push({ itemId: entry.id, qty });
			const info = REWARD_ITEM_INFO[entry.id];
			if(info){
				dmgNumbers.push({ x:player.x + player.w / 2, y:player.y - 28, text:info.icon + ' +' + qty + ' ' + info.name, age:0, color:'#ffcc44' });
			}
		}
		try{ localStorage.setItem('magicBattle_playerData', JSON.stringify(playerData)); }catch(e){}
		if(label && typeof notify === 'function') notify(label);
	}

	function themeLoot(better){
		const t = theme();
		if(t === 'ice') return better
			? [{ id:'permafrost', chance:1, min:2, max:3 }, { id:'ice_crystal', chance:1, min:3, max:5 }, { id:'crystal_fragment', chance:0.8, min:1, max:2 }]
			: [{ id:'ice_crystal', chance:1, min:1, max:3 }, { id:'arcane_dust', chance:0.6, min:1, max:2 }];
		if(t === 'earth') return better
			? [{ id:'titan_shard', chance:1, min:1, max:2 }, { id:'ancient_amber', chance:1, min:1, max:2 }, { id:'stone_chip', chance:1, min:3, max:5 }]
			: [{ id:'stone_chip', chance:1, min:2, max:4 }, { id:'crystal_fragment', chance:0.5, min:1, max:2 }];
		if(t === 'iron') return better
			? [{ id:'iron_plate', chance:1, min:3, max:5 }, { id:'molten_core', chance:0.7, min:1, max:1 }, { id:'forge_coal', chance:1, min:2, max:4 }]
			: [{ id:'iron_plate', chance:1, min:1, max:3 }, { id:'forge_coal', chance:0.8, min:1, max:2 }];
		return better
			? [{ id:'molten_core', chance:0.85, min:1, max:1 }, { id:'lava_essence', chance:1, min:2, max:4 }, { id:'ember_shard', chance:1, min:4, max:6 }]
			: [{ id:'ember_shard', chance:1, min:2, max:4 }, { id:'lava_essence', chance:0.55, min:1, max:2 }];
	}

	function spawnWave(room, n){
		if(!room || typeof ENEMY_TYPES === 'undefined') return;
		const pool = (global.DUNGEON_THEME_INFO[theme()] || {}).enemies || [];
		for(let i = 0; i < n; i++){
			const pick = pool.length ? pool[Math.min(pool.length - 1, i % pool.length)] : { type:'imp' };
			const t = ENEMY_TYPES[pick.type];
			if(!t) continue;
			const x = room.x + 80 + Math.random() * (room.w - 160);
			const y = room.y + room.h - t.h - 8;
			enemies.push({
				type: pick.type, typeDef: t, x, y,
				w: Math.round(t.w * DIFF_SIZE_MULT), h: Math.round(t.h * DIFF_SIZE_MULT),
				vx:0, vy:0, hp:Math.round(t.hp * DIFF_HP_MULT * (1 + Env.heat * 0.008)), maxHp:Math.round(t.hp * DIFF_HP_MULT * (1 + Env.heat * 0.008)),
				facing:1, patrol:[room.x + 60, room.x + room.w - 60], patrolDir:1, state:'alert',
				alertTimer:180, spellCooldowns:t.spells.map(() => 20), currentSpell:0, flash:0, dots:[],
				stunTimer:0, slowTimer:0, animTimer:0, attackAnimTimer:0, dead:false, deathTimer:0,
				baseY:y, flyOffset:0, charging:false, chargeVx:0, chargeVy:0, chargeTimer:0,
				chargeCastDone:false, bossPhase:1, _safeX:x, _safeY:y, puzzleSeg:room.depth,
				roomId: room.id,
			});
		}
	}

	function closeChoice(){
		Env.choiceOpen = false;
		Env.choiceTarget = null;
		const el = document.getElementById('dungeonChoice');
		if(el) el.style.display = 'none';
	}

	function openChoice(it){
		Env.choiceOpen = true;
		Env.choiceTarget = it;
		const el = document.getElementById('dungeonChoice');
		if(!el) return;
		const t = theme();
		const titles = {
			fire: ['Overload furnace', 'Stabilize furnace', 'Destroy furnace'],
			ice: ['Invoke blizzard', 'Bind the altar', 'Shatter the ice'],
			earth: ['Wake the roots', 'Calm the shrine', 'Collapse a tunnel'],
			iron: ['Overstoke the forge', 'Lock the console', 'Blow the vents'],
		};
		const bodies = {
			fire: [
				'More enemies spawn. Heat rises. Loot from this room is much better.',
				'The chamber settles. Normal reward. Safer path.',
				'A violent shortcut opens — then an explosion fight.',
			],
			ice: [
				'Chill spikes. Stronger frost variants. Better cache.',
				'The ice holds. Standard relic.',
				'A frozen shaft cracks open. Surviving the blast is the price.',
			],
			earth: [
				'Tremor climbs. More crawlers. Richer crystals.',
				'The warren steadies. Modest amber.',
				'A root-shaft tears open as a shortcut. Cave-in combat first.',
			],
			iron: [
				'Pressure climbs. Extra drones. Better plates.',
				'The line holds. Standard slag.',
				'A service tunnel blows open. Then the room detonates.',
			],
		};
		const A = titles[t] || titles.fire;
		const B = bodies[t] || bodies.fire;
		el.style.display = 'flex';
		el.innerHTML = '<div class="dch-panel"><h3>' + (it.name || 'Choice') + '</h3>' +
			'<button data-pick="overload">' + A[0] + '<small>' + B[0] + '</small></button>' +
			'<button data-pick="stabilize">' + A[1] + '<small>' + B[1] + '</small></button>' +
			'<button data-pick="destroy">' + A[2] + '<small>' + B[2] + '</small></button>' +
			'<button data-pick="cancel" class="dch-cancel">Leave it</button></div>';
		el.querySelectorAll('button').forEach(btn => {
			btn.onclick = () => pickChoice(btn.getAttribute('data-pick'));
		});
	}

	function pickChoice(pick){
		const it = Env.choiceTarget;
		closeChoice();
		if(!it || pick === 'cancel') return;
		it.used = true;
		const room = rooms()[it.roomId];
		if(pick === 'overload'){
			Env.modifiers.furnaceOverload = true;
			addHeat(16, '+HEAT');
			if(room) spawnWave(room, 4);
			grantLoot(themeLoot(true), 'The chamber answers greed.');
			showBanner('Overload — the dungeon grows hungrier.');
		} else if(pick === 'stabilize'){
			addHeat(-6, null);
			grantLoot(themeLoot(false), 'The chamber steadies.');
		} else if(pick === 'destroy'){
			it.used = true;
			if(room) spawnWave(room, 3);
			addHeat(10, '+HEAT');
			if(it.shortcut){
				stampTiles(it.shortcut.x, it.shortcut.y, it.shortcut.w, it.shortcut.h, true);
				if(typeof computeTileEdges === 'function') computeTileEdges();
				Env.modifiers.shortcut = true;
			}
			if(typeof shakeScreen === 'function') shakeScreen(14, 28);
			showBanner('A shortcut tears open — survive the blast.');
			grantLoot(themeLoot(false), 'Scorched salvage.');
		}
	}

	function tryInteract(){
		if(!IS_DUNGEON || Env.choiceOpen) return false;
		const px = player.x + player.w / 2, py = player.y + player.h / 2;
		for(const it of interacts()){
			if(it.used || it.kind === 'banner') continue;
			if(Math.abs(px - (it.x + it.w / 2)) > 70 || Math.abs(py - (it.y + it.h / 2)) > 80) continue;
			if(it.kind === 'channelLever'){
				if(!it.reusable) it.used = true;
				if(it.hazardRef){
					it.hazardRef.safe = it.hazardRef.safe === 'left' ? 'right' : 'left';
					it.hazardRef.timer = 0;
					showBanner(it.hazardRef.safe === 'left' ? 'The left side is safe.' : 'The right side is safe.');
					if(typeof shakeScreen === 'function') shakeScreen(6, 12);
				}
				return true;
			}
			if(it.kind === 'choice'){ openChoice(it); return true; }
			if(it.kind === 'vault'){
				it.used = true;
				showBanner('THE VAULT HAS AWAKENED');
				addHeat(12, '+HEAT');
				const room = rooms()[it.roomId];
				if(room) spawnWave(room, 5);
				for(const hz of hazards()){
					if(hz.vault && hz.roomId === it.roomId){ hz.active = true; hz.armed = true; }
				}
				it._pendingLoot = true;
				it._survive = 360;
				return true;
			}
		}
		return false;
	}

	function updateVaults(){
		for(const it of interacts()){
			if(it.kind !== 'vault' || !it._pendingLoot) continue;
			it._survive--;
			const rise = hazards().find(h => h.vault && h.roomId === it.roomId);
			const riseDone = rise && rise._upDone && rise._hold <= 0 && !rise.active;
			if(it._survive <= 0 || riseDone){
				it._pendingLoot = false;
				if(typeof health === 'undefined' || health > 0) grantLoot(themeLoot(true), 'The vault yields.');
			}
		}
	}

	function nearbyPrompt(){
		if(!IS_DUNGEON) return null;
		const px = player.x + player.w / 2, py = player.y + player.h / 2;
		for(const it of interacts()){
			if(it.used || (it.kind !== 'choice' && it.kind !== 'vault' && it.kind !== 'channelLever')) continue;
			if(Math.abs(px - (it.x + it.w / 2)) < 70 && Math.abs(py - (it.y + it.h / 2)) < 80){
				if(it.kind === 'vault') return 'E — Open the vault';
				if(it.kind === 'channelLever') return 'E — Reverse the lava flow';
				return 'E — Interact';
			}
		}
		return null;
	}

	/* ---------- Magma Warden + elemental cousins ---------- */
	function wardenRoom(en){
		return rooms()[en.roomId] || roomAt(en.x + en.w / 2, en.y);
	}

	function wardenShock(en, x, y, w, h, life, dmg, extra){
		en._zones = en._zones || [];
		en._zones.push(Object.assign({ x, y, w, h, life, dmg: dmg || 16 }, extra || {}));
	}

	function updateWarden(en){
		if(!en || en.dead) return false;
		if(!en.typeDef || !en.typeDef.isMiniBoss) return false;
		const room = wardenRoom(en);
		if(!room) return false;
		const px = player.x + player.w / 2, py = player.y + player.h / 2;
		const cx = en.x + en.w / 2, cy = en.y + en.h / 2;
		en.facing = px > cx ? 1 : -1;
		en._cd = (en._cd || 90) - 1;
		en._atk = en._atk || null;
		en._zones = en._zones || [];
		for(let i = en._zones.length - 1; i >= 0; i--){
			const z = en._zones[i];
			if(z.vx) z.x += z.vx;
			if(z.grow){ z.w += z.grow; z.x -= z.grow * 0.5; }
			z.life--;
			if(z.dmg > 0 && playerInRect(z.x, z.y, z.w, z.h) && player.iFrames <= 0){
				damagePlayer(Math.round((z.dmg || 14) * DIFF_DMG_MULT), [{ type:'burn', dmg:2, interval:30, ticks:2, color:'#ff5500' }]);
			}
			if(z.life <= 0) en._zones.splice(i, 1);
		}

		en.vy = (en.vy || 0) + 0.55;
		en.y += en.vy;
		const fl = room.y + room.h - en.h;
		if(en.y > fl){ en.y = fl; en.vy = 0; }
		if(en.x < room.x + 40) en.x = room.x + 40;
		if(en.x + en.w > room.x + room.w - 40) en.x = room.x + room.w - 40 - en.w;

		if(en._atk){
			en._atk.t++;
			runWardenAttack(en, room);
			return true;
		}

		if(en._cd > 0){
			en.x += Math.sign(px - cx) * 0.6;
			if(en.x < room.x + 40) en.x = room.x + 40;
			if(en.x + en.w > room.x + room.w - 40) en.x = room.x + room.w - 40 - en.w;
			return true;
		}
		const pool = ['fist', 'uppercut', 'hammer', 'core', 'rush'];
		if(en.type === 'magmaWarden'){
			pool.push('collapse', 'lavaRise');
			if(en.hp < en.maxHp * 0.55){ pool.push('collapse'); pool.push('lavaRise'); }
		}
		if(en.hp < en.maxHp * 0.4) pool.push('collapse');
		en._atk = { name: pool[Math.floor(Math.random() * pool.length)], t: 0 };
		en.attackAnimTimer = 40;
		return true;
	}

	function runWardenAttack(en, room){
		const a = en._atk;
		const ground = room.y + room.h;
		const cx = en.x + en.w / 2;
		if(a.name === 'fist'){
			en._wind = a.t < 42;
			if(a.t === 42){
				const dir = en.facing;
				if(typeof spawnEnemyProj === 'function'){
					spawnEnemyProj(cx + dir * 50, ground - 22, dir * 8.5, 0, {
						color:'#ff5500', color2:'#ffaa33', power:24, width:32, height:20,
						shape:'rect', maxAge:36, effects:['horizontalLaunch'],
					});
				}
				wardenShock(en, cx + dir * 10, ground - 30, 260, 30, 200, 18);
			}
			if(a.t > 70){ en._atk = null; en._cd = 75; }
		} else if(a.name === 'uppercut'){
			if(a.t < 22) en.y = Math.min(en.y + 0.8, ground - en.h + 8);
			if(a.t === 24){
				en.vy = -16;
				wardenShock(en, en.x - 16, room.y + 40, en.w + 32, ground - room.y - 40, 90, 22);
			}
			if(a.t === 40){
				wardenShock(en, en.x - 8, room.y + 60, en.w + 16, 320, 70, 16);
			}
			if(a.t > 85){ en._atk = null; en._cd = 85; }
		} else if(a.name === 'hammer'){
			if(a.t === 30){
				wardenShock(en, cx, ground - 24, 90, 24, 50, 16, { vx: 7.2 });
				wardenShock(en, cx - 90, ground - 24, 90, 24, 50, 16, { vx: -7.2 });
				if(typeof shakeScreen === 'function') shakeScreen(8, 10);
			}
			if(a.t === 58){
				wardenShock(en, cx, ground - 24, 110, 24, 64, 16, { vx: 4.4 });
				wardenShock(en, cx - 110, ground - 24, 110, 24, 64, 16, { vx: -4.4 });
			}
			if(a.t === 96){
				wardenShock(en, cx, ground - 28, 130, 28, 80, 18, { vx: 2.6 });
				wardenShock(en, cx - 130, ground - 28, 130, 28, 80, 18, { vx: -2.6 });
				if(typeof shakeScreen === 'function') shakeScreen(10, 14);
			}
			if(a.t === 108 && Math.abs(player.x - en.x) < 100){
				if(player.iFrames <= 0) damagePlayer(Math.round(26 * DIFF_DMG_MULT), ['horizontalLaunch']);
			}
			if(a.t > 124){ en._atk = null; en._cd = 95; }
		} else if(a.name === 'core'){
			en._vulnerable = a.t > 12 && a.t < 100;
			if(a.t === 100){
				en._vulnerable = false;
				if(typeof spawnEnemyProj === 'function'){
					spawnEnemyProj(cx, en.y + en.h * 0.4, 0, 0, {
						color:'#ff3300', color2:'#ffee66', power:30, width:22, height:22,
						shape:'ring', maxAge:44, aoe:true, aoeRadius:280, aoeMax:44,
					});
				}
				for(let i = 0; i < 6; i++){
					wardenShock(en, room.x + 90 + i * ((room.w - 180) / 6), ground - 40, 56, 40, 220, 13);
				}
			}
			if(a.t > 140){ en._atk = null; en._cd = 110; }
		} else if(a.name === 'rush'){
			if(a.t === 1) en._rushDir = en.facing;
			en.x += en._rushDir * 6.2;
			if(a.t % 12 === 0){
				wardenShock(en, en.x + 8, ground - 46, 56, 46, 110, 15);
			}
			if(typeof rectRect === 'function' && rectRect(en, player) && player.iFrames <= 0){
				damagePlayer(Math.round(28 * DIFF_DMG_MULT), ['horizontalLaunch']);
			}
			if(en.x < room.x + 24 || en.x + en.w > room.x + room.w - 24 || a.t > 78){
				en._atk = null; en._cd = 90;
			}
		} else if(a.name === 'collapse'){
			if(a.t === 1){
				if(typeof shakeScreen === 'function') shakeScreen(12, 50);
				showBanner('Furnace Collapse');
			}
			if(a.t === 40){
				const spots = [];
				for(let i = 0; i < 5; i++) spots.push(room.x + 120 + Math.random() * (room.w - 240));
				en._crackSpots = spots;
				for(const sx of spots) wardenShock(en, sx, ground - 18, 80, 10, 70, 0);
			}
			if(a.t === 78 && en._crackSpots){
				for(const sx of en._crackSpots) wardenShock(en, sx - 10, ground - 70, 90, 70, 90, 20);
				for(const p of platforms()){
					if(p.roomId === room.id && (p.kind === 'collapse' || p.kind === 'pillar') && Math.random() < 0.45){
						breakPlatform(p);
					}
				}
			}
			if(a.t === 110){
				const spots = [];
				for(let i = 0; i < 5; i++) spots.push(room.x + 160 + Math.random() * (room.w - 320));
				en._crackSpots2 = spots;
				for(const sx of spots) wardenShock(en, sx, ground - 18, 80, 10, 50, 0);
			}
			if(a.t === 142 && en._crackSpots2){
				for(const sx of en._crackSpots2) wardenShock(en, sx - 10, ground - 70, 90, 70, 80, 20);
			}
			if(a.t > 170){ en._atk = null; en._cd = 120; }
		} else if(a.name === 'lavaRise'){
			if(a.t === 1){
				showBanner('Lava is rising.');
				if(typeof shakeScreen === 'function') shakeScreen(8, 24);
				hazards().push({
					type: 'rise', element: 'fire', roomId: room.id,
					x: room.x + 10, w: room.w - 20, y0: ground - 12, y1: room.y + room.h * 0.46,
					speed: 0.6, active: true, armed: true, hold: 150, y: ground - 12,
				});
				for(const p of platforms()){
					if(p.roomId === room.id && p.kind === 'collapse') p._tick = (p._tick || 0) + 30;
				}
			}
			en.x += Math.sign((player.x + player.w / 2) - cx) * 1.4;
			if(a.t === 170){
				wardenShock(en, room.x + 20, ground - 80, room.w - 40, 80, 40, 22);
			}
			if(a.t > 210){ en._atk = null; en._cd = 140; }
		}
	}

	function onEnemyDeath(en){
		if(!en || !en.typeDef || !en.typeDef.isMiniBoss) return;
		Env.modifiers.wardenSlain = true;
		addHeat(18, '+HEAT');
		grantLoot(themeLoot(true), 'The warden falls. The dungeon remembers.');
		showBanner('A run modifier: treasure burns brighter.');
	}

	function draw(ctx){
		if(!IS_DUNGEON || !getDungeon()) return;
		const camx = camera.x, camy = camera.y;
		for(const hz of hazards()){
			if(hz.type === 'vent'){
				const sx = hz.x - camx, sy = hz.y - camy;
				ctx.fillStyle = hz.warnOn ? 'rgba(255,200,80,0.7)' : 'rgba(80,40,20,0.8)';
				ctx.fillRect(sx, sy, hz.w, hz.h);
				if(hz.warnOn){
					ctx.strokeStyle = 'rgba(255,220,80,0.8)';
					ctx.strokeRect(sx - 2, sy - hz.columnH, hz.w + 4, hz.columnH);
				}
				if(hz.hot){
					const g = ctx.createLinearGradient(sx, sy, sx, sy - hz.columnH);
					g.addColorStop(0, 'rgba(255,80,0,0.85)');
					g.addColorStop(1, 'rgba(255,200,40,0.1)');
					ctx.fillStyle = g;
					ctx.fillRect(sx - 4, sy - hz.columnH, hz.w + 8, hz.columnH);
				}
			}
			if(hz.type === 'fall'){
				const sx = hz.x - camx, sy = hz.y - camy;
				if(hz.warnOn){
					ctx.fillStyle = 'rgba(255,180,40,0.18)';
					ctx.fillRect(sx, sy, hz.w, hz.h);
				}
				if(hz.hot){
					const fg = ctx.createLinearGradient(sx, sy, sx, sy + hz.h);
					fg.addColorStop(0, 'rgba(255,220,80,0.15)');
					fg.addColorStop(0.2, 'rgba(255,90,0,0.75)');
					fg.addColorStop(1, 'rgba(120,20,0,0.55)');
					ctx.fillStyle = fg;
					ctx.fillRect(sx - 6, sy, hz.w + 12, hz.h);
				}
			}
			if(hz.type === 'gate'){
				if(hz.solid){
					ctx.fillStyle = '#5a2210';
					ctx.fillRect(hz.x - camx, hz.y - camy, hz.w, hz.h);
					ctx.fillStyle = 'rgba(255,120,30,0.45)';
					ctx.fillRect(hz.x - camx + 4, hz.y - camy, hz.w - 8, hz.h);
				} else {
					ctx.fillStyle = 'rgba(255,160,40,0.15)';
					ctx.fillRect(hz.x - camx, hz.y - camy, hz.w, 6);
				}
			}
			if(hz.type === 'channel'){
				const { hot, safe } = channelRects(hz);
				ctx.fillStyle = theme() === 'ice' ? 'rgba(120,200,255,0.55)' : 'rgba(255,70,0,0.55)';
				ctx.fillRect(hot.x - camx, hz.y - camy, hot.w, hz.h);
				ctx.fillStyle = 'rgba(40,40,40,0.35)';
				ctx.fillRect(safe.x - camx, hz.y - camy, safe.w, hz.h);
			}
			if(hz.type === 'rise' && (hz.active || hz.y != null)){
				const y = hz.y == null ? hz.y0 : hz.y;
				const g = ctx.createLinearGradient(0, y - camy, 0, y - camy + 80);
				if(theme() === 'ice'){ g.addColorStop(0, 'rgba(160,220,255,0.7)'); g.addColorStop(1, 'rgba(40,80,140,0.35)'); }
				else if(theme() === 'earth'){ g.addColorStop(0, 'rgba(80,120,40,0.55)'); g.addColorStop(1, 'rgba(40,50,20,0.3)'); }
				else { g.addColorStop(0, 'rgba(255,90,0,0.75)'); g.addColorStop(1, 'rgba(120,20,0,0.4)'); }
				ctx.fillStyle = g;
				ctx.fillRect(hz.x - camx, y - camy, hz.w, 500);
			}
		}
		for(const p of platforms()){
			if(p._gone) continue;
			if(p.kind === 'move' || p.kind === 'raft' || p.kind === 'orbit'){
				ctx.fillStyle = p.kind === 'raft' ? '#7a3a18' : '#6a3a22';
				ctx.fillRect(p.x - camx, p.y - camy, p.w, p.h);
				ctx.fillStyle = '#c47840';
				ctx.fillRect(p.x - camx, p.y - camy, p.w, 4);
			} else if((p.kind === 'collapse' || p.kind === 'pillar') && p._tick > 10){
				ctx.strokeStyle = 'rgba(255,180,60,0.75)';
				ctx.strokeRect(p.x - camx, p.y - camy, p.w, p.h);
			}
		}
		for(const it of interacts()){
			if(it.kind === 'banner') continue;
			const sx = it.x - camx, sy = it.y - camy;
			if(it.kind === 'choice'){
				ctx.fillStyle = it.used ? '#2a1810' : '#4a1808';
				ctx.fillRect(sx, sy + 20, it.w, it.h - 20);
				ctx.fillStyle = it.used ? '#553' : '#ff6622';
				ctx.fillRect(sx + 12, sy, it.w - 24, 28);
				ctx.fillStyle = '#ffcc66';
				ctx.font = '32px Arial';
				ctx.textAlign = 'center';
				ctx.fillText(it.icon || '🔥', sx + it.w / 2, sy + 70);
			}
			if(it.kind === 'channelLever'){
				ctx.fillStyle = it.used ? '#333' : '#6a3a12';
				ctx.fillRect(sx, sy, it.w, it.h);
				ctx.fillStyle = '#ffcc66';
				ctx.font = '22px Arial';
				ctx.textAlign = 'center';
				ctx.fillText(it.icon || '🔧', sx + it.w / 2, sy + 40);
			}
			if(it.kind === 'vault'){
				ctx.fillStyle = it.used ? '#2a2a20' : '#c9a227';
				ctx.fillRect(sx, sy, it.w, it.h);
				ctx.fillStyle = '#fff3a0';
				ctx.font = '22px Arial';
				ctx.textAlign = 'center';
				ctx.fillText(it.icon || '💎', sx + it.w / 2, sy + 36);
			}
		}
		if(Env.banner.t > 0){
			Env.banner.t--;
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.globalAlpha = Math.min(1, Env.banner.t / 30);
			ctx.font = 'bold 28px Arial';
			ctx.textAlign = 'center';
			ctx.fillStyle = meterColor();
			ctx.shadowColor = '#000';
			ctx.shadowBlur = 8;
			ctx.fillText(Env.banner.text, canvas.width / 2, 92);
			ctx.restore();
		}
		const prompt = nearbyPrompt();
		if(prompt){
			ctx.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.font = 'bold 14px Arial';
			ctx.textAlign = 'center';
			ctx.fillStyle = '#ffe0a0';
			ctx.fillText(prompt, canvas.width / 2, canvas.height - 48);
			ctx.restore();
		}
		for(const en of enemies){
			if(!en.typeDef || !en.typeDef.isMiniBoss || en.dead) continue;
			for(const z of (en._zones || [])){
				ctx.fillStyle = 'rgba(255,80,20,0.35)';
				ctx.fillRect(z.x - camx, z.y - camy, z.w, z.h);
			}
			if(en._vulnerable){
				ctx.strokeStyle = '#ffe680';
				ctx.lineWidth = 3;
				ctx.strokeRect(en.x - camx - 4, en.y - camy - 4, en.w + 8, en.h + 8);
			}
		}
	}

	function drawWardenFallback(en){
		const ex = en.x - camera.x, ey = en.y - camera.y;
		const flash = en.flash > 0;
		const t = theme();
		ctx.fillStyle = flash ? '#ffcc88' : (t === 'ice' ? '#2a4a77' : t === 'earth' ? '#4a3a20' : '#221810');
		ctx.fillRect(ex + 8, ey + 16, en.w - 16, en.h - 16);
		ctx.fillStyle = flash ? '#fff' : (t === 'ice' ? '#88ddff' : t === 'earth' ? '#88cc44' : '#ff6622');
		ctx.fillRect(ex + 18, ey + 28, 8, 22);
		ctx.fillRect(ex + en.w - 26, ey + 28, 8, 22);
		ctx.fillRect(ex + en.w / 2 - 8, ey + 40, 16, 26);
		ctx.fillStyle = '#111';
		ctx.fillRect(ex + 20, ey + 10, 10, 8);
		ctx.fillRect(ex + en.w - 30, ey + 10, 10, 8);
		if(en._atk && en._atk.name === 'core'){
			ctx.fillStyle = '#ffe680';
			ctx.beginPath();
			ctx.arc(ex + en.w / 2, ey + 48, 12 + Math.sin(en.animTimer * 0.3) * 3, 0, Math.PI * 2);
			ctx.fill();
		}
	}

	function init(){
		if(!IS_DUNGEON || !getDungeon() || !getDungeon().rooms) return;
		stampPlatforms();
		for(const hz of hazards()){
			if(hz.type === 'gate' && hz.solid) stampTiles(hz.x, hz.y, hz.w, hz.h, false);
		}
		if(typeof computeTileEdges === 'function') computeTileEdges();
		Env.ready = true;
		Env.heat = getDungeon()._hotRun ? 10 : 0;
		Env.visited = Object.create(null);
		updateMeterHUD();
		if(getDungeon()._hotRun) showBanner('The volcano is restless. Heat already climbs.');
		for(const en of enemies){
			if(en.typeDef && en.typeDef.isMiniBoss){
				en.hp = Math.round(en.hp * (1 + Env.heat * 0.01));
				en.maxHp = en.hp;
			} else if(en.roomId != null){
				const r = rooms()[en.roomId];
				if(r && r.depth >= 4){
					en.hp = Math.round(en.hp * 1.15);
					en.maxHp = en.hp;
				}
			}
		}
	}

	function update(){
		if(!IS_DUNGEON || !Env.ready) return;
		updateRooms();
		updatePlatforms();
		updateHazards();
		updateVaults();
		if(typeof enemies !== 'undefined'){
			for(const en of enemies){
				if(!en || en.dead || !en._cliff) continue;
				if(en._safeY != null){ en.y = en._safeY; en.vy = 0; }
			}
		}
		if(player._iceDrag) player._iceDrag = Math.max(0, player._iceDrag - 0.004);
	}

	Env.stampPlatforms = stampPlatforms;
	Env.init = init;
	Env.update = update;
	Env.draw = draw;
	Env.tryInteract = tryInteract;
	Env.collideMovers = collideMovers;
	Env.updateWarden = updateWarden;
	Env.onEnemyDeath = onEnemyDeath;
	Env.drawWardenFallback = drawWardenFallback;
	Env.closeChoice = closeChoice;
	Env.addHeat = addHeat;
	Env.getHeat = () => Env.heat;
	Env.lootMultOf = () => Env.lootMult;

	global.DungeonEnv = Env;

	if(typeof IS_DUNGEON !== 'undefined' && IS_DUNGEON && getDungeon() && getDungeon().rooms){
		init();
	}
})(typeof window !== 'undefined' ? window : globalThis);
