/* EmberFall — public API used by dungeon.html (EmberfallCity + the EmberfallRoads hooks).
   Layout: emberfall-layout.js (+ emberfall-layout-city.js, emberfall-layout-north.js). Terrain and drawing:
   emberfall-world.js. Rooms: emberfall-interiors.js. Ambient life: emberfall-life.js. */
(function (global) {
	'use strict';
	const A = global.EmberfallArt;
	const E = global.EmberfallWorld;
	const W = E.W;
	const L = global.EmberfallLayout;
	const TS = W.TS;

	let built = false;
	let currentRoom = null;      // the room the player is in (null = outdoors)
	let visualRoom = null;
	let blend = 0;
	let blendTarget = 0;
	let doorLock = 0;
	let livePlayer = null;
	let roomPlats = [];
	let exteriorPlats = [];

	/* ------------------------------------------------------------------ npc factory */
	function talk(name, icon, lines) { return lines.map(text => ({ name, icon, text })); }
	function npc(def) {
		return Object.assign({
			w: 56, h: 90, talkState: 'FIRST_MEETING', dir: 1, speed: 0.34, pause: 0,
			getDialogue() {
				const pack = this.dialogue || {};
				const key = this.talkState || 'FIRST_MEETING';
				const lines = pack[key] || pack.BASIC_DIALOGUE || pack.FIRST_MEETING;
				if (this.talkState === 'FIRST_MEETING') this.talkState = 'BASIC_DIALOGUE';
				return lines;
			}
		}, def);
	}

	function build() {
		if (built) return;
		built = true;
		A.loadAll();
		if (global.EmberfallProps) global.EmberfallProps.ensure();
		W.talk = talk;
		W.npc = npc;
		L.layout();
		if (global.EmberfallInteriors) global.EmberfallInteriors.buildAll(W);
		exteriorPlats = W.plats.slice();
		// city walls between zones: the closed east gate and the mountain at the start of the North Road
		exteriorPlats.push({ x: 54000, y: 0, w: 40, h: W.WORLD_H, wall: true });
		exteriorPlats.push({ x: 56500, y: 0, w: 40, h: W.WORLD_H, wall: true });
		// the frontier's segments are separate stretches of road: a wall at each end (their ends are reached by L)
		for (const x of W.walls) exteriorPlats.push({ x, y: 0, w: 40, h: W.WORLD_H, wall: true });
	}
	function regionAt(x) {
		for (const r of W.regions || []) if (x >= r.x0 && x < r.x1) return r;
		return null;
	}

	function districtName(x) {
		if (currentRoom) {
			if (currentRoom.areaName && livePlayer) {
				const n = currentRoom.areaName(livePlayer);
				if (n) return n;
			}
			return currentRoom.label;
		}
		let name = 'EmberFall';
		for (const d of W.districts) if (x >= d.x) name = d.name;
		return name;
	}

	function makeConfig() {
		build();
		if (global.ITEM_DB) for (const id in L.ITEMS) if (!global.ITEM_DB[id]) global.ITEM_DB[id] = L.ITEMS[id];
		const day = Math.floor(Date.now() / 86400000) % 3;
		const merchantStock = [
			['ember_rations', 'ember_herb', 'ember_stone', 'ember_torch'],
			['ember_wood', 'ember_hide', 'ember_crystal', 'ember_bandage'],
			['ember_sapphire', 'ember_potion_hp', 'ember_rations', 'ember_ruby']
		];
		L.SHOPS.waystation.stock = merchantStock[day];
		let seg = '';
		try { seg = new URLSearchParams(global.location.search).get('seg') || ''; } catch (e) { seg = ''; }
		const SEG = { west: 600, north: 57200, city: 22600 };
		for (const r of W.regions || []) SEG[r.id] = r.start;
		const sx = SEG[seg] != null ? SEG[seg] : 22600;
		const npcs = W.npcs.map(n => {
			if (n.room) {
				const r = W.rooms[n.room];
				if (r && n.floor != null && n.y == null) n.y = r.floorY(n.floor) - n.h;
			} else if (n.y == null) n.y = E.footY(n.x, n.w) - n.h;
			n.building = n.room || null;
			return n;
		});
		return {
			name: 'EmberFall City',
			worldW: W.WORLD_W,
			worldH: W.WORLD_H,
			bgColor: '#87b5d6',
			bgColor2: '#d8c4a0',
			groundY: W.BEDROCK,
			playerStart: { x: sx, y: E.surf(sx + 20) - 80 },
			platforms: exteriorPlats.slice(),
			buildings: W.bldgs.filter(b => b.room),
			lanterns: [],
			npcs,
			dummies: W.dummies.slice(),
			slimeSpawns: W.slimes.map(sl => Object.assign({ y: E.surf(sl.x + sl.w / 2) - sl.h }, sl)),
			walkers: W.walkers.map(w => Object.assign({ y: E.surf(w.x + 16) - 52, h: 52 }, w)),
			enemySpawns: (W.foes || []).map(f => Object.assign({ y: f.y != null ? f.y : E.surf(f.x) }, f)),
			doors: [],
			districts: W.districts
		};
	}

	/* ------------------------------------------------------------------ render */
	const PB_BACK = [], PB_MID = [], PB_FRONT = [], PB_CAVE = [];
	function inView(x, w, cam, vw) { return x + w > cam.x - 300 && x < cam.x + vw + 300; }
	function render(ctx, camera, canvas, config) {
		build();
		A.frame();
		const vw = canvas.width;
		const vh = canvas.height;
		if (livePlayer && currentRoom) clampToRoom(livePlayer);
		const Life = global.EmberfallLife;
		if (blend < 0.995) {
			E.drawSky(ctx, camera, vw, vh);
			if (Life) Life.drawSkyLife(ctx, camera, vw, vh);
			for (const b of W.back) if (inView(b.x, b.w, camera, vw)) E.drawBuilding(ctx, camera, b);
			for (const p of E.propsNear('back', camera.x, camera.x + vw, PB_BACK)) E.drawSprite(ctx, camera, p);
			if (Life) Life.drawBehind(ctx, camera, vw, vh);
			for (const b of W.bldgs) if (inView(b.x, b.w, camera, vw)) E.drawBuilding(ctx, camera, b);
			for (const p of E.propsNear('mid', camera.x, camera.x + vw, PB_MID)) E.drawSprite(ctx, camera, p);
			E.drawTerrain(ctx, camera, vw, vh);
			for (const p of E.propsNear('cave', camera.x, camera.x + vw, PB_CAVE)) E.drawSprite(ctx, camera, p);
			if (global.EmberfallStructs) global.EmberfallStructs.draw(ctx, camera, vw, vh);
			E.drawWater(ctx, camera, vw, vh, true);
			if (Life) Life.drawWorld(ctx, camera, vw, vh);
			if (blend > 0.005) {
				ctx.fillStyle = 'rgba(6,8,14,' + (blend * 0.6) + ')';
				ctx.fillRect(0, 0, vw, vh);
			}
		} else {
			ctx.fillStyle = '#07080c';
			ctx.fillRect(0, 0, vw, vh);
		}
		if (visualRoom && blend > 0.005 && global.EmberfallInteriors) {
			ctx.save();
			ctx.globalAlpha = blend;
			global.EmberfallInteriors.draw(ctx, camera, visualRoom, vw, vh);
			ctx.restore();
		}
		label(ctx);
	}
	function label(ctx) {
		ctx.save();
		const x = livePlayer ? livePlayer.x : 0;
		const reg = !currentRoom ? regionAt(x) : null;
		const name = districtName(x);
		ctx.font = 'bold 16px Georgia';
		const w = Math.max(300, ctx.measureText(name).width + 24, reg ? ctx.measureText(reg.name).width * 0.8 + 24 : 0);
		ctx.fillStyle = 'rgba(20,16,12,0.55)';
		ctx.fillRect(18, 16, w, reg ? 52 : 36);
		ctx.textAlign = 'left';
		if (reg) {
			ctx.fillStyle = '#d6c08a';
			ctx.font = 'italic 12px Georgia';
			ctx.fillText(reg.name + '  ·  ' + reg.grid, 28, 33);
			ctx.fillStyle = '#f4e6c4';
			ctx.font = 'bold 16px Georgia';
			ctx.fillText(name, 28, 56);
		} else {
			ctx.fillStyle = '#f4e6c4';
			ctx.fillText(name, 28, 40);
		}
		ctx.restore();
	}
	function shadeOutside(ctx, camera, canvas) {
		if (currentRoom && global.EmberfallInteriors && global.EmberfallInteriors.drawFront) {
			ctx.save();
			ctx.globalAlpha = blend;
			global.EmberfallInteriors.drawFront(ctx, camera, currentRoom);
			ctx.restore();
		}
		if (!visualRoom || blend < 0.01) return;
		const r = visualRoom.view;
		const x = r.x - camera.x;
		const y = r.y - camera.y;
		const vw = canvas.width;
		const vh = canvas.height;
		ctx.fillStyle = 'rgba(6,8,14,' + (0.72 * blend) + ')';
		if (y > 0) ctx.fillRect(0, 0, vw, Math.min(y, vh));
		const bot = y + r.h;
		if (bot < vh) ctx.fillRect(0, Math.max(0, bot), vw, vh - Math.max(0, bot));
		const t = Math.max(0, y);
		const hh = Math.min(vh, bot) - t;
		if (hh > 0) {
			if (x > 0) ctx.fillRect(0, t, Math.min(x, vw), hh);
			if (x + r.w < vw) ctx.fillRect(Math.max(0, x + r.w), t, vw - Math.max(0, x + r.w), hh);
		}
		label(ctx);
	}
	function drawForeground(ctx, camera, canvas) {
		if (blend > 0.98) return;
		ctx.save();
		ctx.globalAlpha = 1 - blend;
		// water again over anyone wading, so they look half under the surface
		if (livePlayer && E.waterAt(livePlayer.x + livePlayer.w / 2)) {
			ctx.save();
			ctx.globalAlpha *= 0.55;
			E.drawWater(ctx, camera, canvas.width, canvas.height, true);
			ctx.restore();
		}
		for (const p of E.propsNear('front', camera.x, camera.x + canvas.width, PB_FRONT)) E.drawSprite(ctx, camera, p);
		if (global.EmberfallLife) global.EmberfallLife.drawFront(ctx, camera, canvas.width, canvas.height);
		ctx.restore();
	}

	/* ------------------------------------------------------------------ rooms */
	function applyPlatforms(list) {
		const plats = global.sandboxPlatforms;
		if (!plats) return;
		plats.length = 0;
		plats.push(...list, { x: -50, y: 0, w: 50, h: W.WORLD_H }, { x: W.WORLD_W, y: 0, w: 50, h: W.WORLD_H });
	}
	function clampToRoom(p) {
		const r = currentRoom.bounds || currentRoom.view;
		p.x = Math.max(r.x + 4, Math.min(p.x, r.x + r.w - p.w - 4));
	}
	function enterRoom(id, player) {
		if (typeof id === 'string' && id.indexOf('portal:') === 0) {
			const v = (W.portals || [])[+id.slice(7)];
			if (v && player) {
				player.x = v.toX;
				player.y = v.toY - player.h - 2;
				player.vx = 0;
				player.vy = 0;
				doorLock = 24;
			}
			return;
		}
		const r = W.rooms[id];
		if (!r || !player) return;
		currentRoom = r;
		visualRoom = r;
		blendTarget = 1;
		doorLock = 24;
		E.setInside(true);
		applyPlatforms(r.plats || []);
		// stand on the room's floor (the doorstep can sit a few pixels off it)
		if (player) {
			const feet = player.y + player.h;
			let best = null;
			for (const q of r.plats || []) {
				if (q.wall || player.x + player.w <= q.x || player.x >= q.x + q.w) continue;
				const d = Math.abs(q.y - feet);
				if (d <= 40 && (!best || d < Math.abs(best.y - feet))) best = q;
			}
			if (best) { player.y = best.y - player.h; player.vy = 0; }
		}
		if (r.entry && player) {
			// arriving through a particular door (e.g. the castle's hidden passage)
		}
	}
	function exitRoom(player) {
		if (!currentRoom) return;
		const r = currentRoom;
		currentRoom = null;
		blendTarget = 0;
		doorLock = 18;
		E.setInside(false);
		applyPlatforms(exteriorPlats);
		if (player) {
			const d = r._usedExit || r.exits[0];
			r._usedExit = null;
			if (d && d.outX != null) {
				player.x = d.outX;
				player.y = d.outY - player.h;
			} else {
				player.y = Math.min(player.y, E.surf(player.x + player.w / 2) - player.h);
			}
			player.vx = 0;
			player.vy = 0;
		}
		return r;
	}
	function atRect(p, x, w, y, tol) {
		if (!(p.x + p.w > x && p.x < x + w)) return false;
		return Math.abs((p.y + p.h) - y) < (tol || 60);
	}
	function tryDoor(player) {
		if (doorLock > 0 || !player) return null;
		if (currentRoom) {
			for (const d of currentRoom.exits || []) {
				if (atRect(player, d.x, d.w, d.y)) {
					currentRoom._usedExit = d;
					return 'exit';
				}
			}
			for (const d of currentRoom.innerDoors || []) {
				if (atRect(player, d.x, d.w, d.y)) return { locked: !!d.locked, label: d.label, inner: true };
			}
			return null;
		}
		for (const b of W.bldgs) {
			if (!b.room || !b.door) continue;
			if (atRect(player, b.door.x, b.door.w, b.door.y)) {
				if (b.lockFlag && !flag(b.lockFlag)) return { locked: true, label: b.label, lockText: b.lockText };
				return { room: b.room, label: b.label, x: b.door.x, w: b.door.w };
			}
		}
		for (const v of W.roomDoors || []) {
			if (atRect(player, v.x, v.w, v.y)) return { room: v.room, label: v.label, x: v.x, w: v.w };
		}
		const ps = W.portals || [];
		for (let i = 0; i < ps.length; i++) {
			const v = ps[i];
			if (v.need && !flag(v.need)) continue;
			if (atRect(player, v.x, v.w, v.y)) return { room: 'portal:' + i, label: v.label, x: v.x, w: v.w, verb: v.verb };
		}
		return null;
	}

	function update(player) {
		build();
		if (blend < blendTarget) blend = Math.min(blendTarget, blend + 0.05);
		else if (blend > blendTarget) blend = Math.max(blendTarget, blend - 0.05);
		if (!currentRoom && blend <= 0) visualRoom = null;
		if (doorLock > 0) doorLock--;
		livePlayer = player;
		holdPlayer(player);
		if (global.EmberfallLife) global.EmberfallLife.update(player, !!currentRoom);
	}

	function showNpc(n) {
		if (!n.building) return !currentRoom;
		return !!currentRoom && n.building === currentRoom.id;
	}
	function showDummy(d) {
		if (!currentRoom) return !d.building;
		return d.building === currentRoom.id;
	}
	function visionTile() { return false; }
	function visionLights() { return currentRoom && currentRoom.lights ? currentRoom.lights : []; }
	function stairSurface(ent) {
		if (currentRoom) return E.stairSurface(ent, currentRoom.stairs || []);
		return E.stairSurface(ent, W.stairs);
	}
	function allowsBelow() { return false; }
	function npcFoot(n) {
		if (n.building || n.deck != null) return null;
		return E.footY(n.x, n.w);
	}

	/* ------------------------------------------------------------------ the crossroads turn (L) */
	let flip = null;
	const FLIP_DUR = 1200;
	const FLIP_TURN = 0.42;
	const FLIP_WALK = 150;
	function flipT() { return flip ? Math.min(1, (performance.now() - flip.start) / flip.dur) : 0; }
	function tryPerspective(player) {
		if (!player || currentRoom) return false;
		if (flip) return true;
		const feet = player.y + player.h;
		for (const j of W.joints) {
			if (player.x + player.w > j.x && player.x < j.x + j.w && Math.abs(feet - E.surf(player.x + player.w / 2)) < 40) {
				flip = { from: player.x, to: j.to, fromFacing: player.facing || 1, toFacing: j.face || 1, start: performance.now(), dur: FLIP_DUR };
				if (global.notify && j.label) global.notify('↪ ' + j.label);
				player.vx = 0;
				player.vy = 0;
				return true;
			}
		}
		return false;
	}
	function holdPlayer(player) {
		if (!flip || !player) return;
		const t = flipT();
		if (t < FLIP_TURN) {
			player.x = flip.from;
			player.facing = flip.fromFacing;
		} else {
			const u = Math.min(1, (t - FLIP_TURN) / (1 - FLIP_TURN));
			const ease = u * u * (3 - 2 * u);
			player.x = flip.to + ease * FLIP_WALK * flip.toFacing;
			player.facing = flip.toFacing;
			player.y = E.surf(player.x + player.w / 2) - player.h;
		}
		player.vx = 0;
		player.vy = 0;
		if (t >= 1) flip = null;
	}
	function playerTurn() {
		if (!flip) return null;
		const t = flipT();
		if (t < FLIP_TURN) return { scale: Math.max(0.04, Math.cos((t / FLIP_TURN) * Math.PI * 0.5)), facing: flip.fromFacing, walk: false };
		const u = (t - FLIP_TURN) / (1 - FLIP_TURN);
		return { scale: Math.max(0.04, Math.sin(Math.min(1, u / 0.28) * Math.PI * 0.5)), facing: flip.toFacing, walk: u < 0.92 };
	}
	function turnHaze() {
		if (!flip) return 0;
		const d = Math.abs(flipT() - FLIP_TURN);
		return d > 0.14 ? 0 : (1 - d / 0.14) * 0.5;
	}

	/* ------------------------------------------------------------------ loot, levers, lore stones
	   W.loots: one-time finds (stored in localStorage). A loot can be `hidden` until something reveals it (e.g. the
	   Lockworks sluice drains the alcove), and can `need` a flag before it can be taken.
	   W.interacts: { x, w, y?, kind: 'lever'|'lore'|'key'|'read', label, text | use(player) } — pressed with E. */
	function flag(k) { try { return !!(global.localStorage && localStorage.getItem('magicBattle_ef_' + k)); } catch (e) { return false; } }
	function setFlag(k, v) { try { if (global.localStorage) { if (v === false) localStorage.removeItem('magicBattle_ef_' + k); else localStorage.setItem('magicBattle_ef_' + k, '1'); } } catch (e) {} }
	function taken(id) { try { return !!(global.localStorage && localStorage.getItem('magicBattle_road_' + id)); } catch (e) { return false; } }
	function say(lines) {
		if (typeof startDialogue === 'function') startDialogue(lines);
		else if (global.notify) global.notify(lines[0].text);
	}
	function nearThing(player, list, tol) {
		const feet = player.y + player.h;
		for (const it of list) {
			if (player.x + player.w < it.x || player.x > it.x + it.w) continue;
			const ly = it.y != null ? it.y : E.surf(it.x + it.w / 2);
			if (Math.abs(feet - ly) > (tol || 60)) continue;
			return it;
		}
		return null;
	}
	function lootVisible(l) { return !l.hidden || (l.reveal && l.reveal()); }
	const here = (o) => (o.room || null) === (currentRoom ? currentRoom.id : null);
	function tryLoot(player) {
		if (!player) return false;
		// a usable door or exit always wins over props and loot standing near it
		const dr = tryDoor(player);
		if (dr && !dr.locked) return false;
		const it = nearThing(player, W.interacts.filter(o => here(o) && (!o.when || o.when())));
		if (it) {
			if (it.use) it.use(player, { say, flag, setFlag, give: (id) => { if (typeof global.addRoadFind === 'function') global.addRoadFind(id); } });
			else if (it.text) say([{ name: it.title || it.label || 'You look closer', icon: it.icon || '🪨', text: it.text }].concat((it.more || []).map(t => ({ name: it.title || it.label || 'You look closer', icon: it.icon || '🪨', text: t }))));
			return true;
		}
		const loot = nearThing(player, W.loots.filter(l => here(l) && lootVisible(l)));
		if (!loot) return false;
		const key = 'magicBattle_road_' + loot.id;
		if (taken(loot.id)) {
			say([{ name: 'Already taken', icon: '📦', text: 'Nothing useful left.' }]);
			return true;
		}
		if (loot.need && !flag(loot.need)) {
			say([{ name: loot.title || 'Out of reach', icon: '🔒', text: loot.needText || 'You can’t get at it yet.' }]);
			return true;
		}
		if (global.localStorage) localStorage.setItem(key, '1');
		if (typeof global.addRoadFind === 'function' && loot.item) global.addRoadFind(loot.item);
		if (loot.extra && typeof global.addRoadFind === 'function') for (const id of loot.extra) global.addRoadFind(id);
		if (loot.onTake) loot.onTake({ flag, setFlag });
		say([{ name: loot.title || 'Found', icon: loot.icon || '📜', text: loot.text }]);
		return true;
	}
	/* the prompt over the HUD for whatever E would do here */
	function nearPrompt(player) {
		if (!player) return null;
		const it = nearThing(player, W.interacts.filter(o => here(o) && (!o.when || o.when())));
		if (it) return 'Press <b>E</b> to ' + (it.verb || 'inspect') + ' ' + (it.label || '');
		const loot = nearThing(player, W.loots.filter(l => here(l) && lootVisible(l)));
		if (currentRoom) return loot && !taken(loot.id) ? 'Press <b>E</b> to search' + (loot.where ? ' ' + loot.where : '') : null;
		if (loot && !taken(loot.id)) return 'Press <b>E</b> to search' + (loot.where ? ' ' + loot.where : '');
		for (const j of W.joints) {
			if (player.x + player.w > j.x && player.x < j.x + j.w && Math.abs(player.y + player.h - E.surf(player.x + player.w / 2)) < 40) return 'Press <b>L</b> to turn onto ' + j.label;
		}
		return null;
	}

	global.EmberfallCity = {
		makeConfig, render, shadeOutside, drawForeground, tryDoor, enterRoom, exitRoom, update,
		getShop: id => L.SHOPS[id] || null, getItems: () => L.ITEMS, isInside: () => !!currentRoom,
		showNpc, showDummy, districtName, allowsBelow, stairSurface, visionLights, visionTile,
		ITEMS: L.ITEMS, SHOPS: L.SHOPS, tryPerspective, tryLoot, npcFoot, nearPrompt, flag, setFlag, regionAt,
		terrainCollide: (ent, px, py) => E.collide(ent, px, py),
		solidAt: (x, y) => !currentRoom && E.solidAt(x, y),
		currentRoom: () => currentRoom,
		cameraY(p, vh) {
			if (currentRoom) {
				const v = currentRoom.view;
				if (v.h <= vh - 40) return v.y + v.h / 2 - vh / 2;
				return p.y + p.h / 2 - vh / 2;
			}
			return p.y + p.h - vh * 0.68;
		},
		world: W
	};
	global.EmberfallRoads = {
		groundPieces: () => [],
		bedSolid: () => false,
		inWaterColumn: () => false,
		waterFloor: (x, w) => currentRoom ? null : E.surf(x + (w || 0) / 2),
		playerTurn, flipScale: () => null, turnHaze, holdPlayer
	};
})(typeof window !== 'undefined' ? window : globalThis);
