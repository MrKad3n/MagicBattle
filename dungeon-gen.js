/* =============================================================
   Procedural dungeon worlds — Fire / Ice / Earth / Iron
   Large mixed-size rooms, archetypes, run-to-run layout.
   Returns the same corridor/enemy/decoration shape dungeon.html expects.
   ============================================================= */
(function(global){
	const TILE = 40;

	function rngFromSeed(seed){
		let s = seed & 0x7FFFFFFF;
		function rnd(){ s = (s * 1664525 + 1013904223) & 0x7FFFFFFF; return s / 0x7FFFFFFF; }
		return {
			rnd,
			ri(lo, hi){ return lo + Math.floor(rnd() * (hi - lo + 1)); },
			rf(lo, hi){ return lo + rnd() * (hi - lo); },
			chance(p){ return rnd() < p; },
			choice(arr){ return arr[Math.floor(rnd() * arr.length)]; },
			shuffle(arr){
				const a = arr.slice();
				for(let i = a.length - 1; i > 0; i--){
					const j = Math.floor(rnd() * (i + 1));
					const t = a[i]; a[i] = a[j]; a[j] = t;
				}
				return a;
			},
		};
	}

	const THEMES = {
		fire: {
			name: 'The Inferno Depths',
			meter: 'heat', meterLabel: 'Heat',
			bgColor:'#190704', wallColor:'#4a1a0a', wallColor2:'#6a2a12', wallEdge:'#8a3e1a',
			floorHighlight:'#9a5630', ceilShadow:'#240b04', airColor:'#2f1108',
			hazard: 'lava', element: 'fire',
			enemies: [
				{type:'imp', minLv:0, maxLv:3, weight:3},
				{type:'fireSprite', minLv:0, maxLv:3, weight:3},
				{type:'flameSerpent', minLv:1, maxLv:5, weight:2},
				{type:'emberMage', minLv:2, maxLv:6, weight:2},
				{type:'magmaGolem', minLv:3, maxLv:6, weight:1},
			],
			boss: 'fireDragon',
			warden: 'magmaWarden',
			wardenBanner: 'THE FURNACE HAS A GUARDIAN',
			labels: {
				combat: 'Combat Chamber',
				crossing: 'Lava Crossing',
				choice: 'Furnace Room',
				vault: 'Molten Vault',
				river: 'Magma River',
				warden: 'Warden Chamber',
				rest: 'Ash Refuge',
			},
		},
		ice: {
			name: 'The Frozen Caverns',
			meter: 'chill', meterLabel: 'Chill',
			bgColor:'#071225', wallColor:'#173554', wallColor2:'#25507c', wallEdge:'#4e89b6',
			floorHighlight:'#72b3d8', ceilShadow:'#061020', airColor:'#0a1a30',
			hazard: 'frost', element: 'ice',
			enemies: [
				{type:'frostWraith', minLv:0, maxLv:3, weight:3},
				{type:'iceArcher', minLv:0, maxLv:4, weight:2},
				{type:'snowBeast', minLv:1, maxLv:5, weight:2},
				{type:'cryoMage', minLv:2, maxLv:6, weight:2},
				{type:'glacierSentinel', minLv:3, maxLv:6, weight:1},
			],
			boss: 'frostColossus',
			warden: 'frostWarden',
			wardenBanner: 'THE GLACIER HAS A WARDEN',
			labels: {
				combat: 'Frost Hall',
				crossing: 'Ice Crossing',
				choice: 'Ritual Altar',
				vault: 'Frozen Cache',
				river: 'Glacier Run',
				warden: 'Warden Chamber',
				rest: 'Still Hollow',
			},
		},
		earth: {
			name: 'The Stone Warrens',
			meter: 'tremor', meterLabel: 'Tremor',
			bgColor:'#101108', wallColor:'#3a3220', wallColor2:'#5a4a2a', wallEdge:'#7a6a3a',
			floorHighlight:'#8a7a40', ceilShadow:'#0c0c06', airColor:'#1a1810',
			hazard: 'spore', element: 'earth',
			enemies: [
				{type:'vineCrawler', minLv:0, maxLv:3, weight:3},
				{type:'caveSpider', minLv:0, maxLv:4, weight:2},
				{type:'rockGolem', minLv:1, maxLv:5, weight:2},
				{type:'crystalMage', minLv:2, maxLv:6, weight:2},
				{type:'mudElemental', minLv:3, maxLv:6, weight:1},
			],
			boss: 'earthColossus',
			warden: 'stoneWarden',
			wardenBanner: 'THE ROOTS HAVE A GUARDIAN',
			labels: {
				combat: 'Stone Chamber',
				crossing: 'Root Crossing',
				choice: 'Living Shrine',
				vault: 'Crystal Grotto',
				river: 'Cavern Drop',
				warden: 'Warden Chamber',
				rest: 'Moss Nook',
			},
		},
		iron: {
			name: 'The Iron Forge',
			meter: 'pressure', meterLabel: 'Pressure',
			bgColor:'#120b0a', wallColor:'#3a2a22', wallColor2:'#5a3a28', wallEdge:'#8a5a30',
			floorHighlight:'#9a6a38', ceilShadow:'#100806', airColor:'#1c100c',
			hazard: 'slag', element: 'iron',
			enemies: [
				{type:'forgeDrone', minLv:0, maxLv:4, weight:3},
				{type:'ironSentinel', minLv:1, maxLv:5, weight:2},
				{type:'slagBrute', minLv:2, maxLv:6, weight:2},
			],
			boss: 'ironColossus',
			warden: 'forgeWarden',
			wardenBanner: 'THE FORGE HAS A WARDEN',
			labels: {
				combat: 'Kiln Floor',
				crossing: 'Gear Crossing',
				choice: 'Control Console',
				vault: 'Relic Vault',
				river: 'Slag Channel',
				warden: 'Warden Chamber',
				rest: 'Cooling Bay',
			},
		},
	};

	function generateDungeonWorld(type){
		if(type === 'fire' && typeof global.generateFireInfernalDepths === 'function'){
			return global.generateFireInfernalDepths();
		}
		const theme = THEMES[type] || THEMES.fire;
		const R = rngFromSeed((Date.now() ^ (Math.random() * 0xFFFFFF | 0)) & 0x7FFFFFFF);
		const fire = type === 'fire';
		const KH = fire ? 1200 : 80;
		const WORLD_W = 10200;
		const LAYERS = 6;
		const LAYER_SPAN = 2200;
		const START = { x:80, y:KH + 160, w:760, h:420 };
		const USABLE_TOP = START.y + START.h + 120;
		const PREBOSS_H = 260;
		const BOSS = { w:2720, h:1180 };
		const PREBOSS_Y = USABLE_TOP + LAYERS * LAYER_SPAN + 80;
		const BOSS_Y = PREBOSS_Y + PREBOSS_H + 40;
		const WORLD_H = BOSS_Y + BOSS.h + 220;
		const BOSS_X = 420;
		const PREBOSS = { x:420, y:PREBOSS_Y, w:1880, h:PREBOSS_H };

		const corridors = [];
		const enemies = [];
		const decorations = [];
		const platforms = [];
		const hazards = [];
		const interactables = [];
		const rooms = [];
		const puzzles = [];

		function snap(n){ return Math.round(n / TILE) * TILE; }
		function carve(x, y, w, h){
			x = Math.max(40, snap(x));
			y = Math.max(0, snap(y));
			w = Math.max(TILE * 3, snap(Math.min(w, WORLD_W - x - 40)));
			h = Math.max(TILE * 3, snap(Math.min(h, WORLD_H - y - 40)));
			const c = { x, y, w, h };
			corridors.push(c);
			return c;
		}
		function connectDown(a, b){
			const SHAFT_W = 200, SHAFT_H = 160;
			const shTop = a.y + a.h - 8;
			const shBot = b.y + b.h;
			if(shBot <= shTop + 20) return null;
			const aL = a.x + 40, aR = Math.max(aL, a.x + a.w - SHAFT_W - 40);
			const bL = b.x + 40, bR = Math.max(bL, b.x + b.w - SHAFT_W - 40);
			const overL = Math.max(aL, bL), overR = Math.min(aR, bR);
			if(overR >= overL){
				const shX = overL === overR ? overL : R.ri(overL, overR);
				return carve(shX, shTop, SHAFT_W, shBot - shTop + 8);
			}
			const shX1 = Math.max(60, Math.min(WORLD_W - SHAFT_W - 60, aL + Math.floor((aR - aL) / 2)));
			const shX2 = Math.max(60, Math.min(WORLD_W - SHAFT_W - 60, bL + Math.floor((bR - bL) / 2)));
			const midY = Math.floor(shTop + (shBot - shTop) * 0.45);
			carve(shX1, shTop, SHAFT_W, midY - shTop + SHAFT_H);
			const bx = Math.min(shX1, shX2);
			carve(bx, midY, Math.max(shX1, shX2) + SHAFT_W - bx, SHAFT_H);
			return carve(shX2, midY, SHAFT_W, shBot - midY + 8);
		}
		function connectSide(left, right){
			const doorH = Math.min(240, left.h - 20, right.h - 20);
			const doorY = left.y + left.h - doorH;
			const gapX = left.x + left.w - 8;
			return carve(gapX, doorY, Math.max(right.x - gapX + 8, 200), doorH);
		}

		function addRoom(kind, x, y, w, h, depth, optional){
			const c = carve(x, y, w, h);
			const room = {
				id: rooms.length,
				kind,
				label: theme.labels[kind] || kind,
				x: c.x, y: c.y, w: c.w, h: c.h,
				depth, optional: !!optional,
			};
			rooms.push(room);
			return room;
		}

		function floorY(room){ return room.y + room.h; }

		function addStatic(room, rx, fromFloor, w){
			platforms.push({
				x: snap(room.x + rx),
				y: snap(floorY(room) - fromFloor),
				w: snap(w), h: TILE,
				kind: 'static',
				roomId: room.id,
			});
		}
		function addCollapse(room, rx, fromFloor, w){
			platforms.push({
				x: snap(room.x + rx),
				y: snap(floorY(room) - fromFloor),
				w: snap(w), h: TILE,
				kind: 'collapse',
				roomId: room.id,
				life: 70 + R.ri(0, 40),
			});
		}
		function addMover(room, rx, fromFloor, w, axis, dist, spd){
			platforms.push({
				x: snap(room.x + rx),
				y: snap(floorY(room) - fromFloor),
				w: snap(w), h: TILE,
				kind: 'move',
				roomId: room.id,
				axis, dist, spd,
				homeX: snap(room.x + rx),
				homeY: snap(floorY(room) - fromFloor),
			});
		}

		function floorLava(room, inset, h){
			const y = floorY(room) - (h || 36);
			decorations.push({ type:'lava', x:room.x + inset, y, w:room.w - inset * 2, h:h || 36, _env:true });
		}

		function decorateRoom(room){
			const torch = type === 'ice' ? null : 'torch';
			if(torch && R.chance(0.85)){
				decorations.push({ type:'torch', x:room.x + 24, y:room.y + 36, side:'left' });
				decorations.push({ type:'torch', x:room.x + room.w - 40, y:room.y + 36, side:'right' });
			}
			if(type === 'fire'){
				if(R.chance(0.9)) decorations.push({ type:'embers', x:room.x + room.w / 2, y:room.y + room.h * 0.55, area:R.ri(220, 420) });
				if(R.chance(0.5)) decorations.push({ type:'crack', x:room.x + R.ri(60, room.w - 60), y:room.y + R.ri(40, room.h - 40), size:R.ri(22, 40) });
				if(R.chance(0.45)) decorations.push({ type:'stalactite', x:room.x + R.ri(40, room.w - 40), y:room.y + 8, h:R.ri(16, 34) });
			} else if(type === 'ice'){
				if(R.chance(0.7)) decorations.push({ type:'icicle', x:room.x + R.ri(40, room.w - 40), y:room.y + 8, h:R.ri(16, 32) });
				if(R.chance(0.5)) decorations.push({ type:'frostCrystal', x:room.x + R.ri(50, room.w - 50), y:floorY(room) - 28, size:R.ri(16, 28) });
				if(R.chance(0.4)) decorations.push({ type:'snowPile', x:room.x + R.ri(40, room.w - 80), y:floorY(room) - 18, w:R.ri(40, 80) });
			} else if(type === 'earth'){
				if(R.chance(0.6)) decorations.push({ type:'mushroom', x:room.x + R.ri(40, room.w - 40), y:floorY(room) - 20, size:R.ri(14, 22), color:'#66bb55' });
				if(R.chance(0.5)) decorations.push({ type:'roots', x:room.x + R.ri(30, room.w - 80), y:room.y + 8, w:R.ri(50, 90) });
				if(R.chance(0.45)) decorations.push({ type:'crystal', x:room.x + R.ri(50, room.w - 50), y:floorY(room) - 24, size:R.ri(14, 26) });
			} else {
				if(R.chance(0.8)) decorations.push({ type:'embers', x:room.x + room.w / 2, y:room.y + room.h * 0.5, area:R.ri(180, 360) });
				if(R.chance(0.5)) decorations.push({ type:'crack', x:room.x + R.ri(60, room.w - 60), y:room.y + R.ri(40, room.h - 40), size:R.ri(20, 36) });
			}
		}

		function addVents(room, count, columnH){
			const n = count || R.ri(4, 8);
			for(let i = 0; i < n; i++){
				hazards.push({
					type: 'vent',
					element: theme.element,
					x: room.x + 80 + (i + 0.5) * ((room.w - 160) / n) + R.rf(-20, 20),
					y: floorY(room) - 8,
					w: 44, h: 16,
					period: 160 + R.ri(0, 140),
					phase: R.ri(0, 160),
					warn: 36,
					burst: 22,
					columnH: columnH || R.ri(160, 280),
					roomId: room.id,
				});
			}
		}

		function addChannel(room){
			const leftSafeFirst = R.chance(0.5);
			const mid = room.x + room.w / 2;
			hazards.push({
				type: 'channel',
				element: theme.element,
				roomId: room.id,
				y: floorY(room) - 32,
				h: 32,
				left: { x: room.x + 20, w: mid - room.x - 50 },
				right: { x: mid + 30, w: room.x + room.w - 20 - (mid + 30) },
				safe: leftSafeFirst ? 'left' : 'right',
				flipEvery: 420 + R.ri(0, 180),
				timer: 0,
			});
		}

		function addPitHazards(room){
			floorLava(room, 16, 40);
			const span = room.w - 200;
			const pads = R.ri(4, 6);
			for(let i = 0; i < pads; i++){
				const pw = R.choice([160, 200, 240, 280]);
				const px = 80 + (i / Math.max(1, pads - 1)) * (span - pw);
				const rise = 140 + (i % 3) * 90;
				if(R.chance(0.45) && i > 0 && i < pads - 1) addCollapse(room, px, rise, pw);
				else if(R.chance(0.28) && i > 0 && i < pads - 1) addMover(room, px, rise, pw, 'x', 140, 1.1 + R.rf(0, 0.6));
				else addStatic(room, px, rise, pw);
			}
		}

		function pickEnemy(lv){
			const valid = theme.enemies.filter(e => lv >= e.minLv && lv <= e.maxLv);
			if(!valid.length) return theme.enemies[0];
			const total = valid.reduce((s, v) => s + v.weight, 0);
			let roll = R.rnd() * total;
			for(const v of valid){ roll -= v.weight; if(roll <= 0) return v; }
			return valid[valid.length - 1];
		}

		function placeEnemies(room, lv, count){
			const n = count != null ? count : (room.w >= 1800 ? R.ri(3, 5) : room.w >= 1000 ? R.ri(2, 4) : R.ri(1, 2));
			for(let i = 0; i < n; i++){
				const pick = pickEnemy(lv);
				const margin = Math.min(90, Math.floor(room.w * 0.12));
				const ex = R.ri(room.x + margin, room.x + room.w - margin);
				const ey = floorY(room) - 12;
				const pr = Math.min(room.w - margin * 2, R.ri(180, 520));
				enemies.push({
					type: pick.type, x: ex, y: ey,
					patrol: [Math.max(room.x + margin, ex - pr / 2), Math.min(room.x + room.w - margin, ex + pr / 2)],
					puzzleSeg: lv,
					roomId: room.id,
				});
			}
		}

		function dressCombat(room, lv){
			decorateRoom(room);
			const variant = R.choice(['vents', 'channels', 'pillars', 'rising', 'mixed']);
			if(variant === 'vents' || variant === 'mixed') addVents(room, R.ri(5, 10), 200 + lv * 16);
			if(variant === 'channels' || variant === 'mixed') addChannel(room);
			if(variant === 'pillars' || variant === 'mixed'){
				addStatic(room, 120, 180, 80);
				addStatic(room, room.w - 200, 180, 80);
				if(room.w > 1200) addStatic(room, room.w / 2 - 40, 260, 80);
			}
			if(variant === 'rising'){
				hazards.push({
					type: 'rise',
					element: theme.element,
					roomId: room.id,
					x: room.x + 12, w: room.w - 24,
					y0: floorY(room) - 20,
					y1: room.y + room.h * 0.42,
					speed: 0.22 + lv * 0.03,
					active: false, armed: true,
					hold: 220,
				});
				addStatic(room, 80, 280, 220);
				addStatic(room, room.w / 2 - 120, 360, 240);
				addStatic(room, room.w - 300, 280, 220);
			}
			if(room.w > 1400 && R.chance(0.5)){
				addStatic(room, 200, 220, 280);
				addStatic(room, room.w - 480, 300, 280);
			}
			placeEnemies(room, lv);
		}

		function dressCrossing(room){
			decorateRoom(room);
			addPitHazards(room);
			if(R.chance(0.55)) addVents(room, R.ri(3, 6), 160);
		}

		function dressRiver(room){
			decorateRoom(room);
			floorLava(room, 12, 48);
			const rafts = 5;
			for(let i = 0; i < rafts; i++){
				addMover(room, 80 + i * ((room.w - 360) / rafts), 120 + (i % 2) * 70, 200, 'x', 220, 1.4 + i * 0.08);
			}
			addStatic(room, 40, 420, 180);
			addStatic(room, room.w - 220, 460, 180);
			// Cliff attackers
			const n = R.ri(2, 4);
			for(let i = 0; i < n; i++){
				const pick = pickEnemy(Math.min(5, 3));
				const onRight = i % 2;
				const ex = onRight ? room.x + room.w - 80 : room.x + 70;
				enemies.push({
					type: pick.type, x: ex, y: room.y + 80,
					patrol: [ex - 40, ex + 40],
					puzzleSeg: 4,
					roomId: room.id,
					_cliff: true,
				});
			}
		}

		function dressChoice(room, lv){
			decorateRoom(room);
			addStatic(room, room.w / 2 - 140, 80, 280);
			interactables.push({
				kind: 'choice',
				theme: type,
				roomId: room.id,
				x: room.x + room.w / 2 - 36,
				y: floorY(room) - 120,
				w: 72, h: 100,
				name: theme.labels.choice,
				icon: type === 'fire' ? '🔥' : type === 'ice' ? '❄️' : type === 'earth' ? '🌿' : '⚙️',
				used: false,
				shortcut: null,
			});
			if(R.chance(0.4)) addVents(room, 4, 160);
		}

		function dressVault(room, lv){
			decorateRoom(room);
			addStatic(room, room.w / 2 - 200, 80, 400);
			interactables.push({
				kind: 'vault',
				theme: type,
				roomId: room.id,
				x: room.x + room.w / 2 - 28,
				y: floorY(room) - 90,
				w: 56, h: 56,
				name: theme.labels.vault,
				icon: '💎',
				used: false,
			});
			hazards.push({
				type: 'rise',
				element: theme.element,
				roomId: room.id,
				x: room.x + 16, w: room.w - 32,
				y0: floorY(room) - 16,
				y1: room.y + 80,
				speed: 0.35,
				active: false, armed: false,
				hold: 360,
				vault: true,
			});
		}

		function dressWarden(room){
			decorateRoom(room);
			addStatic(room, 160, 240, 240);
			addStatic(room, room.w - 400, 240, 240);
			addStatic(room, room.w / 2 - 160, 360, 320);
			enemies.push({
				type: theme.warden,
				x: room.x + room.w / 2 - 40,
				y: floorY(room) - 16,
				patrol: [room.x + 120, room.x + room.w - 120],
				roomId: room.id,
				isMiniBoss: true,
			});
			interactables.push({
				kind: 'banner',
				roomId: room.id,
				text: theme.wardenBanner,
				fired: false,
			});
		}

		function dressRest(room){
			decorateRoom(room);
			addStatic(room, room.w / 2 - 180, 80, 360);
		}

		// ---- Layout plan (run-to-run) ----
		const includeWarden = R.chance(0.72);
		const includeRiver = R.chance(0.62);
		const includeVault = R.chance(0.7);
		const layerKinds = ['combat', 'crossing', 'combat'];
		layerKinds.push(R.chance(0.55) ? 'choice' : 'combat');
		layerKinds.push(includeRiver ? 'river' : (includeVault ? 'vault' : 'combat'));
		layerKinds.push(includeWarden ? 'warden' : 'combat');
		// Guarantee a breather and a choice somewhere
		if(!layerKinds.includes('crossing')) layerKinds[1] = 'crossing';
		if(!layerKinds.includes('choice') && R.chance(0.8)) layerKinds[3] = 'choice';

		const startRoom = addRoom('rest', START.x, START.y, START.w, START.h, 0, false);
		startRoom.label = 'Descent Gate';
		decorateRoom(startRoom);
		// Small first fight, slightly smaller than old rooms
		const firstCombat = addRoom('combat', START.x + START.w + 80, START.y + 40, 480, 340, 0, false);
		connectSide(startRoom, firstCombat);
		placeEnemies(firstCombat, 0, R.ri(1, 2));
		decorateRoom(firstCombat);

		const layerRooms = [];
		let prevExit = firstCombat;

		for(let lv = 0; lv < LAYERS; lv++){
			const kind = layerKinds[lv];
			const bandTop = USABLE_TOP + lv * LAYER_SPAN;
			let w, h;
			if(kind === 'river' || kind === 'warden'){ w = R.ri(2200, 2480); h = R.ri(920, 1100); }
			else if(kind === 'crossing' || kind === 'choice' || kind === 'vault'){ w = R.ri(1680, 2160); h = R.ri(720, 960); }
			else if(R.chance(0.35)){ w = R.ri(420, 560); h = R.ri(300, 380); } // slightly smaller
			else if(R.chance(0.4)){ w = R.ri(1680, 2280); h = R.ri(800, 1080); } // boss-comparable
			else { w = R.ri(960, 1400); h = R.ri(520, 720); }

			const goRight = lv % 2 === 0;
			const x = goRight
				? R.ri(200, Math.max(200, WORLD_W - w - 1800))
				: R.ri(1400, Math.max(1400, WORLD_W - w - 200));
			const y = bandTop + LAYER_SPAN - h - 80;
			const main = addRoom(kind, x, y, w, h, lv + 1, false);

			if(kind === 'combat') dressCombat(main, lv);
			else if(kind === 'crossing') dressCrossing(main);
			else if(kind === 'river') dressRiver(main);
			else if(kind === 'choice') dressChoice(main, lv);
			else if(kind === 'vault') dressVault(main, lv);
			else if(kind === 'warden') dressWarden(main);
			else dressRest(main);

			let optional = null;
			if(includeVault && kind !== 'vault' && kind !== 'warden' && kind !== 'river' && R.chance(0.38)){
				const ow = R.ri(980, 1280), oh = R.ri(560, 720);
				const ox = Math.min(WORLD_W - ow - 80, main.x + main.w + 160);
				optional = addRoom('vault', ox, main.y + main.h - oh, ow, oh, lv + 1, true);
				dressVault(optional, lv);
				if(optional.x > main.x + main.w - 20) connectSide(main, optional);
			}

			const fromRoom = prevExit;
			const shaft = connectDown(prevExit, main);
			if(shaft && (lv === 2 || lv === 4)){
				puzzles.push({
					type: R.choice(['killAll', 'plates', 'levers', 'survive', 'sequence']),
					seg: lv + 1,
					solved: false,
					gate: { x: shaft.x, y: fromRoom.y + fromRoom.h, w: shaft.w, h: 80 },
					segYMin: main.y,
					segYMax: floorY(main),
					points: [],
					seqTarget: [0, 1, 2],
					seqCurrent: 0,
					surviveTimer: 0,
					surviveNeeded: 1200,
					glowTimer: 0,
				});
			}
			layerRooms.push({ main, optional, shaft });
			prevExit = main;
		}

		// Puzzle markers
		for(const pz of puzzles){
			const host = rooms.find(r => r.depth === pz.seg && !r.optional) || rooms.find(r => r.depth === pz.seg);
			if(!host) continue;
			if(pz.type === 'plates' || pz.type === 'sequence' || pz.type === 'levers'){
				for(let pi = 0; pi < 3; pi++){
					pz.points.push({
						x: host.x + Math.floor(host.w * (0.2 + pi * 0.25)),
						y: pz.type === 'levers' ? floorY(host) - 80 : floorY(host) - 40,
						w: pz.type === 'levers' ? 40 : 80,
						h: pz.type === 'levers' ? 80 : 40,
						done: false, idx: pi,
						name: pz.type === 'levers' ? `Lever ${pi + 1}` : undefined,
						icon: type === 'fire' ? '🔥' : type === 'ice' ? '❄️' : type === 'earth' ? '🌿' : '⚙️',
					});
				}
			}
		}

		// Wire furnace shortcuts to a later room
		for(const it of interactables){
			if(it.kind !== 'choice') continue;
			const later = rooms.find(r => r.depth >= (rooms[it.roomId] ? rooms[it.roomId].depth + 2 : 99) && !r.optional);
			if(later){
				it.shortcut = { x: later.x + 80, y: later.y + 40, w: 200, h: later.h - 40 };
			}
		}

		carve(PREBOSS.x, PREBOSS.y, PREBOSS.w, PREBOSS.h);
		const bossRoom = addRoom('boss', BOSS_X, BOSS_Y, BOSS.w, BOSS.h, LAYERS + 2, false);
		bossRoom.label = 'Boss Arena';
		connectDown(prevExit, PREBOSS);
		connectDown(PREBOSS, bossRoom);

		enemies.push({
			type: theme.boss,
			x: BOSS_X + BOSS.w / 2 - 80,
			y: BOSS_Y + 80,
			patrol: [BOSS_X + 120, BOSS_X + BOSS.w - 120],
		});

		// Boss dressing
		for(let i = 0; i < 6; i++){
			if(type !== 'ice') decorations.push({ type:'torch', x:BOSS_X + 40 + (i % 2) * (BOSS.w - 80), y:BOSS_Y + 80 + i * 80, side:i % 2 ? 'right' : 'left' });
			if(type === 'fire' || type === 'iron') decorations.push({ type:'embers', x:BOSS_X + 140 + i * (BOSS.w / 7), y:BOSS_Y + BOSS.h - 140, area:380 });
		}
		if(type === 'fire' || type === 'iron'){
			for(let i = 0; i < 5; i++){
				decorations.push({ type:'lava', x:BOSS_X + 24 + i * Math.floor(BOSS.w / 5), y:BOSS_Y + BOSS.h - 48, w:Math.floor(BOSS.w / 5) - 12, h:32 });
			}
		}

		const kitten = fire ? {
			shaft: { x:80, y:0, w:120, h:START.y + 40 },
			corridor: { x:80, y:0, w:2400, h:200 },
			arena: { x:2400, y:0, w:1800, h:1680 },
			door: { x:80, y:START.y - 12, w:120, h:16 },
		} : null;

		return {
			name: theme.name,
			worldW: WORLD_W,
			worldH: WORLD_H,
			bgColor: theme.bgColor,
			wallColor: theme.wallColor,
			wallColor2: theme.wallColor2,
			wallEdge: theme.wallEdge,
			floorHighlight: theme.floorHighlight,
			ceilShadow: theme.ceilShadow,
			airColor: theme.airColor,
			playerStart: { x: START.x + 100, y: START.y + 80 },
			corridors, enemies, decorations, puzzles,
			rooms, platforms, hazards, interactables,
			_theme: type,
			_meter: theme.meter,
			_meterLabel: theme.meterLabel,
			_startRoom: { x:START.x, y:START.y, w:START.w, h:START.h },
			_bossRoomRect: { x:BOSS_X, y:BOSS_Y, w:BOSS.w, h:BOSS.h },
			_prebossLockWall: { x:BOSS_X, y:PREBOSS_Y - 40, w:PREBOSS.w, h:40 },
			_bossLockWall: { x:BOSS_X, y:BOSS_Y + 200, w:40, h:260 },
			_bossRoomTriggerY: BOSS_Y + 180,
			_bossRoomTriggerX: BOSS_X + 80,
			_kitten: kitten,
			_bossPlatforms: [
				{ x:BOSS_X + 780, y:BOSS_Y + 820, w:720 },
				{ x:BOSS_X + 100, y:BOSS_Y + 620, w:360 },
				{ x:BOSS_X + 2240, y:BOSS_Y + 620, w:360 },
				{ x:BOSS_X + 460, y:BOSS_Y + 820, w:280 },
				{ x:BOSS_X + 1960, y:BOSS_Y + 820, w:280 },
			],
		};
	}

	global.generateDungeonWorld = generateDungeonWorld;
	global.DUNGEON_THEME_INFO = THEMES;
})(typeof window !== 'undefined' ? window : globalThis);
