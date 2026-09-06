/* =============================================================
   The Infernal Depths — Fire dungeon world generator
   Large mixed-size rooms, archetypes, run-to-run layout.
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
		};
	}

	const COMBAT_NAMES = [
		'Cinder Gallery', 'Scorch Hall', 'Ember Vaults', 'Basalt Gallery',
		'Magma Gallery', 'Caldera Chamber', 'Heartworks',
	];

	function generateFireInfernalDepths(){
		const R = rngFromSeed((Date.now() ^ (Math.random() * 0xFFFFFF | 0)) & 0x7FFFFFFF);
		const hotRun = R.chance(0.28);

		const WORLD_W = 16800;
		const KH = 1480;
		const START = { x:80, y:KH + 200, w:640, h:420 };
		const LAYERS = 7;
		const LAYER_SPAN = 2560;
		const USABLE_TOP = START.y + START.h + 180;
		const PREBOSS_H = 280;
		const BOSS = { w:2800, h:1240 };
		const PREBOSS_Y = USABLE_TOP + LAYERS * LAYER_SPAN + 120;
		const BOSS_Y = PREBOSS_Y + PREBOSS_H + 60;
		const WORLD_H = BOSS_Y + BOSS.h + 240;
		const BOSS_X = 520;
		const PREBOSS = { x:520, y:PREBOSS_Y, w:2000, h:PREBOSS_H };

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
			w = Math.max(TILE * 4, snap(Math.min(w, WORLD_W - x - 40)));
			h = Math.max(TILE * 4, snap(Math.min(h, WORLD_H - y - 40)));
			const c = { x, y, w, h };
			corridors.push(c);
			return c;
		}
		function addShaftLedges(x, y, w, h){
			if(h < 720) return;
			const n = h > 1500 ? 3 : 2;
			for(let i = 1; i <= n; i++){
				const ly = snap(y + (h * i) / (n + 1));
				const lw = 160;
				const lx = (i % 2) ? x : x + Math.max(0, w - lw);
				platforms.push({ x:lx, y:ly, w:lw, h:TILE, kind:'static' });
				decorations.push({ type:'embers', x:lx + lw / 2, y:ly - 36, area:90 });
			}
		}
		function connectDown(a, b){
			const SHAFT_W = 240, SHAFT_H = 180;
			const shTop = a.y + a.h - 8;
			const shBot = b.y + b.h;
			if(shBot <= shTop + 20) return null;
			const aL = a.x + 48, aR = Math.max(aL, a.x + a.w - SHAFT_W - 48);
			const bL = b.x + 48, bR = Math.max(bL, b.x + b.w - SHAFT_W - 48);
			const overL = Math.max(aL, bL), overR = Math.min(aR, bR);
			if(overR >= overL){
				const shX = overL === overR ? overL : R.ri(overL, overR);
				const sh = carve(shX, shTop, SHAFT_W, shBot - shTop + 8);
				addShaftLedges(sh.x, sh.y, sh.w, sh.h);
				return sh;
			}
			const shX1 = Math.max(60, Math.min(WORLD_W - SHAFT_W - 60, aL + Math.floor((aR - aL) / 2)));
			const shX2 = Math.max(60, Math.min(WORLD_W - SHAFT_W - 60, bL + Math.floor((bR - bL) / 2)));
			const midY = Math.floor(shTop + (shBot - shTop) * 0.42);
			const s1 = carve(shX1, shTop, SHAFT_W, midY - shTop + SHAFT_H);
			const bx = Math.min(shX1, shX2);
			carve(bx, midY, Math.max(shX1, shX2) + SHAFT_W - bx, SHAFT_H);
			const s2 = carve(shX2, midY, SHAFT_W, shBot - midY + 8);
			addShaftLedges(s1.x, s1.y, s1.w, s1.h);
			addShaftLedges(s2.x, s2.y, s2.w, s2.h);
			return s2;
		}
		function connectSide(left, right){
			const doorH = Math.min(300, left.h - 20, right.h - 20);
			const doorY = Math.max(left.y, right.y) + Math.min(left.h, right.h) - doorH;
			const gapX = left.x + left.w - 8;
			return carve(gapX, doorY, Math.max(right.x - gapX + 8, 240), doorH);
		}

		function addRoom(kind, x, y, w, h, depth, optional){
			const c = carve(x, y, w, h);
			const room = {
				id: rooms.length,
				kind,
				label: ({
					combat: 'Combat Chamber',
					crossing: 'Lava Crossing',
					choice: 'Furnace Room',
					vault: 'Molten Vault',
					river: 'Magma River',
					warden: 'Warden Chamber',
					rest: 'Ash Refuge',
					boss: 'Boss Arena',
				})[kind] || kind,
				x: c.x, y: c.y, w: c.w, h: c.h,
				depth, optional: !!optional,
			};
			rooms.push(room);
			return room;
		}
		function floorY(room){ return room.y + room.h; }

		function addPlat(room, kind, rx, fromFloor, w, extra){
			const p = Object.assign({
				x: snap(room.x + rx),
				y: snap(floorY(room) - fromFloor),
				w: snap(w), h: TILE,
				kind, roomId: room.id,
			}, extra || {});
			if(kind === 'move' || kind === 'raft' || kind === 'orbit'){
				p.homeX = p.x; p.homeY = p.y;
			}
			platforms.push(p);
			return p;
		}

		function floorLava(room, inset, h){
			decorations.push({
				type:'lava',
				x: room.x + inset,
				y: floorY(room) - (h || 36),
				w: room.w - inset * 2,
				h: h || 36,
				_env: true,
			});
		}

		function edgeLava(room, depth){
			const strips = depth >= 4 ? 4 : 2;
			for(let i = 0; i < strips; i++){
				decorations.push({
					type:'lava',
					x: room.x + 20 + i * Math.floor(room.w / strips),
					y: floorY(room) - 28,
					w: Math.floor(room.w / strips) - 40,
					h: 22,
					_env: true,
				});
			}
		}

		function decorateRoom(room, extra){
			decorations.push({ type:'torch', x:room.x + 28, y:room.y + 40, side:'left' });
			decorations.push({ type:'torch', x:room.x + room.w - 44, y:room.y + 40, side:'right' });
			if(R.chance(0.94)) decorations.push({ type:'embers', x:room.x + room.w / 2, y:room.y + room.h * 0.5, area:R.ri(280, 520) });
			if(R.chance(0.62)) decorations.push({ type:'crack', x:room.x + R.ri(80, room.w - 80), y:room.y + R.ri(50, room.h - 50), size:R.ri(26, 48) });
			if(R.chance(0.55)) decorations.push({ type:'stalactite', x:room.x + R.ri(60, room.w - 60), y:room.y + 8, h:R.ri(20, 40) });
			if(room.w > 1400){
				decorations.push({ type:'torch', x:room.x + room.w / 2, y:room.y + 36, side:'left' });
				decorations.push({ type:'embers', x:room.x + room.w * 0.28, y:room.y + room.h * 0.42, area:320 });
				decorations.push({ type:'embers', x:room.x + room.w * 0.72, y:room.y + room.h * 0.38, area:280 });
			}
			if(room.depth >= 3 || extra){
				decorations.push({ type:'crack', x:room.x + room.w * 0.35, y:room.y + 70, size:36 });
				decorations.push({ type:'crack', x:room.x + room.w * 0.68, y:room.y + room.h * 0.4, size:42 });
			}
		}

		function addVents(room, count, columnH){
			const n = Math.max(3, count);
			for(let i = 0; i < n; i++){
				hazards.push({
					type: 'vent',
					element: 'fire',
					x: room.x + 100 + (i + 0.5) * ((room.w - 200) / n) + R.rf(-16, 16),
					y: floorY(room) - 8,
					w: 52, h: 18,
					period: 140 + R.ri(0, 180),
					phase: R.ri(0, 170),
					warn: 44,
					burst: 26,
					columnH: columnH || R.ri(200, 340),
					roomId: room.id,
				});
			}
		}

		function addChannel(room, lever){
			const leftSafeFirst = R.chance(0.5);
			const mid = room.x + room.w / 2;
			const hz = {
				type: 'channel',
				element: 'fire',
				roomId: room.id,
				y: floorY(room) - 40,
				h: 40,
				left: { x: room.x + 28, w: mid - room.x - 70 },
				right: { x: mid + 42, w: room.x + room.w - 28 - (mid + 42) },
				safe: leftSafeFirst ? 'left' : 'right',
				flipEvery: 340 + R.ri(0, 180),
				timer: 0,
			};
			hazards.push(hz);
			if(lever){
				interactables.push({
					kind: 'channelLever',
					roomId: room.id,
					x: room.x + room.w / 2 - 22,
					y: floorY(room) - 120,
					w: 44, h: 80,
					name: 'Flow Gate',
					icon: '🔧',
					used: false,
					reusable: true,
					hazardRef: hz,
				});
			}
		}

		function addFalls(room, n, inset){
			const pad = inset || 200;
			for(let i = 0; i < n; i++){
				hazards.push({
					type: 'fall',
					element: 'fire',
					roomId: room.id,
					x: room.x + pad + i * ((room.w - pad * 2) / Math.max(1, n - 1)),
					y: room.y + 16,
					w: 40,
					h: room.h - 70,
					period: 120 + R.ri(0, 100),
					phase: R.ri(0, 110),
					warn: 32,
					burst: 38,
				});
			}
		}

		function addTimedGate(room, rx, fromFloor, w, h, period){
			hazards.push({
				type: 'gate',
				roomId: room.id,
				x: snap(room.x + rx),
				y: snap(floorY(room) - fromFloor - h),
				w: snap(w), h: snap(h),
				period: period || 200,
				phase: R.ri(0, 80),
				openFor: 88,
				solid: true,
			});
		}

		function carveBankedPit(room, ledge, depth){
			const bank = Math.max(180, snap(ledge || 200));
			const d = snap(depth || 300);
			const pit = carve(room.x + bank, room.y + room.h - 8, room.w - bank * 2, d);
			decorations.push({
				type:'lava',
				x: pit.x + 8,
				y: pit.y + pit.h - 44,
				w: pit.w - 16,
				h: 44,
				_env: true,
			});
			room._openFloor = true;
			room._ledge = bank;
			return pit;
		}

		function carveCenterPit(room, pitW, depth){
			const w = snap(Math.min(pitW, room.w - 400));
			const px = snap(room.x + (room.w - w) / 2);
			const d = snap(depth || 260);
			const pit = carve(px, room.y + room.h - 8, w, d);
			decorations.push({
				type:'lava',
				x: pit.x + 8,
				y: pit.y + pit.h - 44,
				w: pit.w - 16,
				h: 44,
				_env: true,
			});
			room._centerPit = { x: px, w: w };
			return pit;
		}

		function pickEnemy(lv){
			const pool = [
				{type:'imp', minLv:0, maxLv:3, weight:3},
				{type:'fireSprite', minLv:0, maxLv:3, weight:3},
				{type:'flameSerpent', minLv:1, maxLv:6, weight:2},
				{type:'emberMage', minLv:2, maxLv:7, weight:2},
				{type:'magmaGolem', minLv:3, maxLv:7, weight: hotRun ? 2 : 1},
			].filter(e => lv >= e.minLv && lv <= e.maxLv);
			const list = pool.length ? pool : [{type:'imp', weight:1}];
			const total = list.reduce((s, v) => s + v.weight, 0);
			let roll = R.rnd() * total;
			for(const v of list){ roll -= v.weight; if(roll <= 0) return v; }
			return list[list.length - 1];
		}

		function placeEnemies(room, lv, count, opts){
			const o = opts || {};
			const n = count != null ? count : (room.w >= 2100 ? R.ri(3, 5) : room.w >= 1200 ? R.ri(2, 4) : R.ri(1, 2));
			const ledge = room._ledge || 0;
			for(let i = 0; i < n; i++){
				const pick = o.type ? { type: o.type } : pickEnemy(lv);
				const margin = Math.min(130, Math.floor(room.w * 0.1));
				let ex;
				if(o.x != null) ex = o.x;
				else if(room._centerPit){
					const left = R.chance(0.5);
					ex = left
						? R.ri(room.x + 50, room._centerPit.x - 40)
						: R.ri(room._centerPit.x + room._centerPit.w + 40, room.x + room.w - 50);
				} else if(ledge){
					ex = i % 2
						? R.ri(room.x + 40, room.x + ledge - 20)
						: R.ri(room.x + room.w - ledge + 20, room.x + room.w - 40);
				} else {
					ex = R.ri(room.x + margin, room.x + room.w - margin);
				}
				const ey = o.y != null ? o.y : floorY(room) - 12;
				const pr = Math.min(room.w - margin * 2, R.ri(220, 560));
				enemies.push({
					type: pick.type, x: ex, y: ey,
					patrol: [Math.max(room.x + 40, ex - pr / 2), Math.min(room.x + room.w - 40, ex + pr / 2)],
					puzzleSeg: room.depth,
					roomId: room.id,
					_cliff: !!o.cliff,
				});
			}
		}

		function sizeFor(kind, depth){
			if(kind === 'warden') return { w: R.ri(2600, 2800), h: R.ri(1140, 1240) };
			if(kind === 'river') return { w: R.ri(3480, 4200), h: R.ri(940, 1120) };
			if(kind === 'crossing') return { w: R.ri(2240, 2680), h: R.ri(900, 1100) };
			if(kind === 'choice') return { w: R.ri(1920, 2320), h: R.ri(840, 1020) };
			if(kind === 'vault') return { w: R.ri(1280, 1600), h: R.ri(640, 800) };
			if(kind === 'rest') return { w: R.ri(520, 640), h: R.ri(340, 400) };
			if(depth >= 5 && R.chance(0.62)) return { w: R.ri(2280, 2760), h: R.ri(980, 1200) };
			if(R.chance(0.22)) return { w: R.ri(520, 680), h: R.ri(340, 420) };
			return { w: R.ri(1440, 1920), h: R.ri(680, 880) };
		}

		function dressCombat(room, lv){
			decorateRoom(room, lv >= 3);
			const deep = lv >= 3;
			const variants = ['vents', 'channels', 'pillars', 'rising', 'mixed'];
			if(deep) variants.push('unstable');
			const variant = R.choice(variants);
			room.variant = variant;

			if(variant === 'vents' || variant === 'mixed' || variant === 'unstable'){
				addVents(room, (deep ? R.ri(9, 16) : R.ri(5, 9)) + (hotRun ? 3 : 0), 210 + lv * 28);
			}
			if(variant === 'channels' || variant === 'mixed'){
				addChannel(room, true);
				addPlat(room, 'static', 90, 220, 240);
				addPlat(room, 'static', room.w - 330, 220, 240);
				if(room.w > 1700) addPlat(room, 'static', room.w / 2 - 120, 360, 240);
			}
			if(variant === 'pillars' || variant === 'mixed'){
				addPlat(room, 'pillar', 180, 220, 90, { life: 95 });
				addPlat(room, 'pillar', room.w / 2 - 45, 300, 90, { life: 95 });
				addPlat(room, 'pillar', room.w - 270, 220, 90, { life: 95 });
				if(room.w > 1700){
					addPlat(room, 'static', room.w / 2 - 200, 460, 400);
					addPlat(room, 'pillar', room.w * 0.28, 380, 80, { life: 80 });
					addPlat(room, 'pillar', room.w * 0.68, 380, 80, { life: 80 });
				}
			}
			if(variant === 'rising' || variant === 'unstable'){
				hazards.push({
					type: 'rise', element: 'fire', roomId: room.id,
					x: room.x + 16, w: room.w - 32,
					y0: floorY(room) - 20,
					y1: room.y + room.h * (deep ? 0.36 : 0.46),
					speed: 0.26 + lv * 0.04,
					active: false, armed: true,
					hold: 210 + lv * 12,
				});
				addPlat(room, 'static', 80, 320, 280);
				addPlat(room, 'static', room.w / 2 - 160, 440, 320);
				addPlat(room, 'static', room.w - 360, 320, 280);
				if(room.w > 2000) addPlat(room, 'static', room.w / 2 - 80, 600, 160);
			}
			if(variant === 'unstable'){
				carveCenterPit(room, room.w * 0.42, 280);
				const pads = 5;
				for(let i = 0; i < pads; i++){
					const pw = R.choice([200, 240, 280]);
					const px = room.w * 0.22 + (i / (pads - 1)) * (room.w * 0.56 - pw);
					const rise = 180 + (i % 3) * 120;
					if(i > 0 && i < pads - 1 && R.chance(0.6)) addPlat(room, 'collapse', px, rise, pw, { life: 58 + R.ri(0, 28) });
					else addPlat(room, 'static', px, rise, pw);
				}
			}
			if(room.w > 1600 && variant !== 'rising'){
				addPlat(room, 'static', 200, 260, 280);
				addPlat(room, 'static', room.w - 480, 340, 280);
			}
			if(deep) edgeLava(room, lv);
			placeEnemies(room, lv);
		}

		function dressCrossing(room){
			decorateRoom(room, true);
			carveBankedPit(room, 220, 340);
			const style = R.choice(['collapse', 'movers', 'orbit', 'falls', 'gates']);
			room.variant = style;
			addPlat(room, 'static', 24, 80, 200);
			addPlat(room, 'static', room.w - 224, 80, 200);

			if(style === 'collapse'){
				const pads = 5;
				for(let i = 0; i < pads; i++){
					const pw = R.choice([180, 220, 260]);
					const px = 260 + (i / (pads - 1)) * (room.w - 520 - pw);
					const rise = 200 + (i % 2) * 140 + (i === 2 ? 80 : 0);
					addPlat(room, 'collapse', px, rise, pw, { life: 48 + R.ri(0, 22) });
				}
			} else if(style === 'movers'){
				addPlat(room, 'move', 300, 240, 220, { axis:'x', dist: 170, spd: 1.1 });
				addPlat(room, 'move', room.w / 2 - 110, 380, 220, { axis:'x', dist: 200, spd: 0.95 });
				addPlat(room, 'move', room.w - 560, 260, 220, { axis:'x', dist: 160, spd: 1.2 });
				addPlat(room, 'static', room.w / 2 - 80, 520, 160);
			} else if(style === 'orbit'){
				addPlat(room, 'static', room.w * 0.32, 280, 160);
				addPlat(room, 'orbit', room.w * 0.48, 360, 180, { radius: 110, ang: 0.2, spd: 0.016 });
				addPlat(room, 'orbit', room.w * 0.62, 360, 180, { radius: 110, ang: 3.3, spd: 0.016 });
				addPlat(room, 'static', room.w * 0.74, 280, 160);
			} else if(style === 'falls'){
				addPlat(room, 'static', 280, 220, 200);
				addPlat(room, 'static', room.w * 0.38, 360, 220);
				addPlat(room, 'collapse', room.w * 0.55, 300, 180, { life: 60 });
				addPlat(room, 'static', room.w * 0.72, 240, 200);
				addFalls(room, R.ri(4, 6), 260);
			} else {
				addPlat(room, 'static', 300, 200, 240);
				addPlat(room, 'static', room.w / 2 - 140, 280, 280);
				addPlat(room, 'static', room.w - 540, 200, 240);
				addTimedGate(room, room.w * 0.36, 40, 44, 300, 200);
				addTimedGate(room, room.w * 0.62, 40, 44, 300, 230);
			}
			if(R.chance(0.45)) addVents(room, R.ri(3, 5), 160);
			floorLava(room, 230, 28);
		}

		function dressRiver(room){
			decorateRoom(room, true);
			const ledge = 280;
			carveBankedPit(room, ledge, 320);
			floorLava(room, ledge, 48);
			addPlat(room, 'static', 16, 90, 250);
			addPlat(room, 'static', room.w - 266, 90, 250);
			addPlat(room, 'static', 20, 420, 200);
			addPlat(room, 'static', room.w - 220, 460, 200);

			const rafts = 7;
			for(let i = 0; i < rafts; i++){
				addPlat(room, 'raft', 300 + i * ((room.w - 700) / rafts), 170 + (i % 3) * 70, 240, {
					axis: 'x', dist: 0, spd: 1.45 + i * 0.05, raftDir: 1,
				});
			}

			addPlat(room, 'static', 8, room.h - 140, 160);
			addPlat(room, 'static', room.w - 168, room.h - 160, 160);
			addPlat(room, 'static', 8, room.h - 280, 140);
			addPlat(room, 'static', room.w - 148, room.h - 300, 140);

			placeEnemies(room, Math.min(5, 3), 1, {
				type: 'emberMage', x: room.x + 70, y: room.y + 160, cliff: true,
			});
			placeEnemies(room, Math.min(5, 3), 1, {
				type: 'emberMage', x: room.x + room.w - 90, y: room.y + 140, cliff: true,
			});
			placeEnemies(room, 2, 1, {
				type: 'fireSprite', x: room.x + room.w * 0.4, y: room.y + 120,
			});
			placeEnemies(room, 2, 1, {
				type: 'fireSprite', x: room.x + room.w * 0.65, y: room.y + 180,
			});
			if(R.chance(0.55)){
				placeEnemies(room, 4, 1, {
					type: 'imp', x: room.x + 80, y: room.y + 300, cliff: true,
				});
			}
			addFalls(room, 2, 500);
		}

		function dressChoice(room, lv){
			decorateRoom(room, true);
			addPlat(room, 'static', room.w / 2 - 220, 100, 440);
			addPlat(room, 'static', 70, 280, 200);
			addPlat(room, 'static', room.w - 270, 280, 200);
			addPlat(room, 'static', 120, 460, 160);
			addPlat(room, 'static', room.w - 280, 460, 160);
			decorations.push({ type:'embers', x:room.x + room.w / 2, y:floorY(room) - 180, area:420 });
			decorations.push({ type:'lava', x:room.x + room.w / 2 - 90, y:floorY(room) - 36, w:180, h:28 });
			interactables.push({
				kind: 'choice',
				theme: 'fire',
				roomId: room.id,
				x: room.x + room.w / 2 - 70,
				y: floorY(room) - 210,
				w: 140, h: 180,
				name: 'The Furnace',
				icon: '🔥',
				used: false,
				shortcut: null,
			});
			if(R.chance(0.4)) addVents(room, 4, 160);
			if(lv >= 3 && R.chance(0.3)) addChannel(room, false);
		}

		function dressVault(room){
			decorateRoom(room, true);
			addPlat(room, 'static', room.w / 2 - 240, 100, 480);
			addPlat(room, 'static', 80, 280, 180);
			addPlat(room, 'static', room.w - 260, 280, 180);
			interactables.push({
				kind: 'vault',
				theme: 'fire',
				roomId: room.id,
				x: room.x + room.w / 2 - 36,
				y: floorY(room) - 110,
				w: 72, h: 72,
				name: 'Molten Vault',
				icon: '💎',
				used: false,
			});
			hazards.push({
				type: 'rise', element: 'fire', roomId: room.id,
				x: room.x + 16, w: room.w - 32,
				y0: floorY(room) - 16,
				y1: room.y + 80,
				speed: 0.4,
				active: false, armed: false,
				hold: 400,
				vault: true,
			});
			addVents(room, 4, 150);
			edgeLava(room, 5);
		}

		function dressWarden(room){
			decorateRoom(room, true);
			addPlat(room, 'static', 160, 280, 320);
			addPlat(room, 'static', room.w - 480, 280, 320);
			addPlat(room, 'static', room.w / 2 - 200, 420, 400);
			addPlat(room, 'collapse', room.w * 0.26, 560, 220, { life: 72 });
			addPlat(room, 'collapse', room.w * 0.64, 560, 220, { life: 72 });
			addPlat(room, 'static', 80, 700, 180);
			addPlat(room, 'static', room.w - 260, 700, 180);
			enemies.push({
				type: 'magmaWarden',
				x: room.x + room.w / 2 - 60,
				y: floorY(room) - 16,
				patrol: [room.x + 160, room.x + room.w - 160],
				roomId: room.id,
				puzzleSeg: room.depth,
				isMiniBoss: true,
			});
			interactables.push({
				kind: 'banner',
				roomId: room.id,
				text: 'THE FURNACE HAS A GUARDIAN',
				fired: false,
			});
			edgeLava(room, 6);
		}

		function dressRest(room){
			decorateRoom(room);
			addPlat(room, 'static', room.w / 2 - 180, 80, 360);
		}

		let includeWarden = R.chance(0.74);
		let includeRiver = R.chance(0.72);
		const includeVault = R.chance(hotRun ? 0.9 : 0.74);
		let includeFurnace = R.chance(0.84);
		if(!includeFurnace && !includeRiver) includeFurnace = true;

		const layerKinds = ['combat', 'crossing', 'combat'];
		layerKinds.push(includeFurnace ? 'choice' : 'combat');
		layerKinds.push(includeRiver ? 'river' : 'combat');
		layerKinds.push('combat');
		layerKinds.push(includeWarden ? 'warden' : 'combat');
		if(!layerKinds.includes('crossing')) layerKinds[1] = 'crossing';

		const startRoom = addRoom('rest', START.x, START.y, START.w, START.h, 0, false);
		startRoom.label = 'Descent Gate';
		decorateRoom(startRoom);
		decorations.push({ type:'embers', x:startRoom.x + startRoom.w / 2, y:startRoom.y + 180, area:220 });

		const firstCombat = addRoom('combat', START.x + START.w + 80, START.y + 20, 560, 380, 0, false);
		firstCombat.label = 'Ember Threshold';
		connectSide(startRoom, firstCombat);
		decorateRoom(firstCombat);
		addVents(firstCombat, 3, 140);
		placeEnemies(firstCombat, 0, R.ri(1, 2));

		let prevExit = firstCombat;

		function tryAttachVault(host, depth){
			const ow = R.ri(1320, 1580), oh = R.ri(660, 780);
			const spaceRight = WORLD_W - (host.x + host.w);
			const spaceLeft = host.x;
			if(spaceRight > ow + 260){
				const optional = addRoom('vault', host.x + host.w + 200, host.y + host.h - oh, ow, oh, depth, true);
				dressVault(optional);
				connectSide(host, optional);
				return optional;
			}
			if(spaceLeft > ow + 260){
				const optional = addRoom('vault', host.x - ow - 200, host.y + host.h - oh, ow, oh, depth, true);
				dressVault(optional);
				connectSide(optional, host);
				return optional;
			}
			return null;
		}

		for(let lv = 0; lv < LAYERS; lv++){
			const kind = layerKinds[lv];
			const bandTop = USABLE_TOP + lv * LAYER_SPAN;
			const sz = sizeFor(kind, lv + 1);
			const goRight = lv % 2 === 0;
			const maxX = WORLD_W - sz.w - 220;
			const x = goRight
				? R.ri(160, Math.max(160, Math.min(maxX, 3800)))
				: R.ri(Math.max(420, maxX - 3600), maxX);
			const y = bandTop + LAYER_SPAN - sz.h - 120;
			const main = addRoom(kind, x, y, sz.w, sz.h, lv + 1, false);
			if(kind === 'combat'){
				main.label = COMBAT_NAMES[Math.min(COMBAT_NAMES.length - 1, lv)] || main.label;
				dressCombat(main, lv);
			} else if(kind === 'crossing') dressCrossing(main);
			else if(kind === 'river') dressRiver(main);
			else if(kind === 'choice') dressChoice(main, lv);
			else if(kind === 'vault') dressVault(main);
			else if(kind === 'warden') dressWarden(main);
			else dressRest(main);

			if(includeVault && kind !== 'vault' && kind !== 'warden' && kind !== 'river' && (lv === 5 || (hotRun && lv === 3))){
				tryAttachVault(main, lv + 1);
			}

			const fromRoom = prevExit;
			const shaft = connectDown(prevExit, main);
			if(shaft && (kind === 'combat' || kind === 'choice') && (lv === 2 || lv === 4)){
				puzzles.push({
					type: R.choice(['killAll', 'plates', 'levers', 'survive', 'sequence']),
					seg: main.depth,
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
			prevExit = main;
		}

		if(includeVault && !rooms.some(r => r.kind === 'vault')){
			const host = [...rooms].reverse().find(r => !r.optional && r.kind !== 'boss' && r.kind !== 'warden' && r.kind !== 'river' && r.kind !== 'rest');
			if(host) tryAttachVault(host, host.depth);
		}

		for(const pz of puzzles){
			const host = rooms.find(r => r.depth === pz.seg && !r.optional) || rooms.find(r => r.depth === pz.seg);
			if(!host) continue;
			if(pz.type === 'plates' || pz.type === 'sequence' || pz.type === 'levers'){
				for(let pi = 0; pi < 3; pi++){
					pz.points.push({
						x: host.x + Math.floor(host.w * (0.22 + pi * 0.24)),
						y: pz.type === 'levers' ? floorY(host) - 80 : floorY(host) - 40,
						w: pz.type === 'levers' ? 40 : 80,
						h: pz.type === 'levers' ? 80 : 40,
						done: false, idx: pi,
						name: pz.type === 'levers' ? `Fire Lever ${pi + 1}` : undefined,
						icon: '🔥',
					});
				}
			}
		}

		for(const it of interactables){
			if(it.kind !== 'choice') continue;
			const host = rooms[it.roomId];
			const later = rooms.find(r => host && r.depth >= host.depth + 2 && !r.optional && r.kind !== 'boss');
			if(later){
				it.shortcut = { x: later.x + 80, y: later.y + 20, w: 240, h: later.h - 20 };
			}
		}

		carve(PREBOSS.x, PREBOSS.y, PREBOSS.w, PREBOSS.h);
		const bossRoom = addRoom('boss', BOSS_X, BOSS_Y, BOSS.w, BOSS.h, LAYERS + 2, false);
		bossRoom.label = 'Heart of the Volcano';
		connectDown(prevExit, PREBOSS);
		connectDown(PREBOSS, bossRoom);

		enemies.push({
			type: 'fireDragon',
			x: BOSS_X + BOSS.w / 2 - 80,
			y: BOSS_Y + 80,
			patrol: [BOSS_X + 140, BOSS_X + BOSS.w - 140],
		});

		for(let i = 0; i < 7; i++){
			decorations.push({ type:'torch', x:BOSS_X + 48 + (i % 2) * (BOSS.w - 96), y:BOSS_Y + 90 + i * 90, side:i % 2 ? 'right' : 'left' });
			decorations.push({ type:'embers', x:BOSS_X + 160 + i * (BOSS.w / 8), y:BOSS_Y + BOSS.h - 150, area:400 });
		}
		for(let i = 0; i < 6; i++){
			decorations.push({ type:'lava', x:BOSS_X + 28 + i * Math.floor(BOSS.w / 6), y:BOSS_Y + BOSS.h - 48, w:Math.floor(BOSS.w / 6) - 14, h:36 });
		}

		const kitten = {
			shaft: { x:80, y:0, w:140, h:START.y + 24 },
			corridor: { x:80, y:0, w:2800, h:240 },
			arena: { x:2880, y:0, w:2000, h:1680 },
			door: { x:80, y:START.y - 16, w:140, h:16 },
		};

		const bossPlatforms = [
			{ x:BOSS_X + 820, y:BOSS_Y + 860, w:760 },
			{ x:BOSS_X + 120, y:BOSS_Y + 640, w:380 },
			{ x:BOSS_X + 2280, y:BOSS_Y + 640, w:380 },
			{ x:BOSS_X + 480, y:BOSS_Y + 860, w:300 },
			{ x:BOSS_X + 2000, y:BOSS_Y + 860, w:300 },
		];

		return {
			name: 'The Infernal Depths',
			worldW: WORLD_W,
			worldH: WORLD_H,
			bgColor:'#190704', wallColor:'#4a1a0a', wallColor2:'#6a2a12', wallEdge:'#8a3e1a',
			floorHighlight:'#9a5630', ceilShadow:'#240b04', airColor:'#2f1108',
			playerStart: { x: START.x + 120, y: START.y + 80 },
			corridors, enemies, decorations, puzzles,
			rooms, platforms, hazards, interactables,
			_theme: 'fire',
			_meter: 'heat',
			_meterLabel: 'Heat',
			_hotRun: hotRun,
			_startRoom: { x:START.x, y:START.y, w:START.w, h:START.h },
			_bossRoomRect: { x:BOSS_X, y:BOSS_Y, w:BOSS.w, h:BOSS.h },
			_prebossLockWall: { x:BOSS_X, y:PREBOSS_Y - 40, w:PREBOSS.w, h:40 },
			_bossLockWall: { x:BOSS_X, y:BOSS_Y + 220, w:40, h:280 },
			_bossRoomTriggerY: BOSS_Y + 200,
			_bossRoomTriggerX: BOSS_X + 80,
			_kitten: kitten,
			_bossPlatforms: bossPlatforms,
			_tablet: { x: bossPlatforms[1].x + 40, y: bossPlatforms[1].y - 120, w: 50, h: 120 },
		};
	}

	global.generateFireInfernalDepths = generateFireInfernalDepths;
})(typeof window !== 'undefined' ? window : globalThis);
