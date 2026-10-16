/* =============================================================
   Infernal Depths — graph assembler + template stamper.
   Picks a hand-written run recipe, stamps authored rooms, short connectors.
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

	function snap(n){ return Math.round(n / TILE) * TILE; }

	const RECIPES = [
		{
			id:'ash_descent',
			nodes:[
				{ id:'start', kind:'start', section:1 },
				{ id:'c1', kind:'combat', section:1 },
				{ id:'cache', kind:'cache', section:1, optional:true, rare:0.55 },
				{ id:'cross', kind:'crossing', section:1 },
				{ id:'c2', kind:'combat', section:2 },
				{ id:'fork', kind:'ashFork', section:2 },
				{ id:'safe', kind:'combat', section:2 },
				{ id:'ashen', kind:'combat', section:2, hot:true },
				{ id:'merge', kind:'stabilize', section:2 },
				{ id:'opt', kind:'optionalPool', section:3, optional:true, rare:0.7 },
				{ id:'furnace', kind:'furnace', section:3 },
				{ id:'warden', kind:'warden', section:3 },
				{ id:'event', kind:'eruption', section:3 },
				{ id:'core', kind:'flood', section:4 },
				{ id:'down', kind:'descent', section:4 },
				{ id:'pre', kind:'preboss', section:4 },
				{ id:'boss', kind:'boss', section:4 },
			],
			edges:[
				['start','right','c1','left'],
				['c1','right','cross','left'],
				['c1','bottom','cache','left', { optional:true }],
				['cross','right','c2','left'],
				['c2','right','fork','left'],
				['fork','left','safe','right'],
				['fork','right','ashen','left'],
				['safe','bottom','merge','left'],
				['ashen','bottom','merge','right'],
				['merge','right','opt','left', { optional:true }],
				['merge','bottom','furnace','left'],
				['furnace','right','warden','left'],
				['warden','right','event','left'],
				['event','bottom','core','left'],
				['core','right','down','top'],
				['down','bottom','pre','left'],
				['pre','right','boss','left'],
			],
		},
		{
			id:'forge_line',
			nodes:[
				{ id:'start', kind:'start', section:1 },
				{ id:'c1', kind:'combat', section:1 },
				{ id:'cross', kind:'crossing', section:1 },
				{ id:'c2', kind:'combat', section:2 },
				{ id:'river', kind:'river', section:2 },
				{ id:'fork', kind:'forgeFork', section:3 },
				{ id:'hard', kind:'elite', section:3, optional:false },
				{ id:'trav', kind:'crossing', section:3 },
				{ id:'furnace', kind:'furnace', section:3 },
				{ id:'warden', kind:'warden', section:3 },
				{ id:'cool', kind:'cooling', section:3, optional:true, rare:0.45 },
				{ id:'event', kind:'collapseEvent', section:4 },
				{ id:'down', kind:'descent', section:4 },
				{ id:'pre', kind:'preboss', section:4 },
				{ id:'boss', kind:'boss', section:4 },
			],
			edges:[
				['start','right','c1','left'],
				['c1','right','cross','left'],
				['cross','right','c2','left'],
				['c2','right','river','left'],
				['river','right','fork','left'],
				['fork','left','hard','right'],
				['fork','right','trav','left'],
				['hard','bottom','furnace','left'],
				['trav','bottom','furnace','right'],
				['furnace','right','warden','left'],
				['warden','right','event','left'],
				['warden','bottom','cool','left', { optional:true }],
				['event','bottom','down','top'],
				['down','bottom','pre','left'],
				['pre','right','boss','left'],
			],
		},
		{
			id:'core_surge',
			nodes:[
				{ id:'start', kind:'start', section:1 },
				{ id:'c1', kind:'combat', section:1 },
				{ id:'up', kind:'ascent', section:2 },
				{ id:'c2', kind:'combat', section:2 },
				{ id:'fork', kind:'ashFork', section:2 },
				{ id:'safe', kind:'combat', section:2 },
				{ id:'ashen', kind:'combat', section:3, hot:true },
				{ id:'merge', kind:'stabilize', section:3 },
				{ id:'vault', kind:'vault', section:3, optional:true, rare:0.6 },
				{ id:'warden', kind:'warden', section:3 },
				{ id:'trial', kind:'trial', section:3, optional:true, rare:0.35 },
				{ id:'event', kind:'eruption', section:4 },
				{ id:'down', kind:'descent', section:4 },
				{ id:'pre', kind:'preboss', section:4 },
				{ id:'boss', kind:'boss', section:4 },
			],
			edges:[
				['start','right','c1','left'],
				['c1','right','up','left'],
				['up','top','c2','bottom'],
				['c2','right','fork','left'],
				['fork','left','safe','right'],
				['fork','right','ashen','left'],
				['safe','bottom','merge','left'],
				['ashen','bottom','merge','right'],
				['merge','right','vault','left', { optional:true }],
				['merge','left','trial','left', { optional:true, flip:true }],
				['merge','bottom','warden','left'],
				['warden','right','event','left'],
				['event','bottom','down','top'],
				['down','bottom','pre','left'],
				['pre','right','boss','left'],
			],
		},
	];

	const OPTIONAL_POOL = ['vault', 'cache', 'shrine', 'trial', 'elite', 'eliteChamber', 'cooling', 'risk'];

	function pickTemplate(R, kind, section, heat){
		if(kind === 'optionalPool'){
			const pool = OPTIONAL_POOL.slice();
			if(heat >= 40) pool.push('vault', 'trial', 'elite');
			kind = R.choice(pool);
		}
		const lib = (typeof global.fireTemplatesFor === 'function')
			? global.fireTemplatesFor(kind, section)
			: (global.FIRE_ROOM_TEMPLATES || []).filter(t => t.kind === kind);
		const list = lib.length ? lib : (global.FIRE_ROOM_TEMPLATES || []).filter(t => t.kind === kind);
		if(!list.length){
			const any = (global.FIRE_ROOM_TEMPLATES || []).filter(t => t.kind === 'combat');
			return any.length ? Object.assign({}, R.choice(any)) : null;
		}
		return Object.assign({}, R.choice(list));
	}

	function pickEnemy(R, section, hot){
		const pool = [
			{ type:'imp', min:1, max:2, w:3 },
			{ type:'fireSprite', min:1, max:2, w:3 },
			{ type:'flameSerpent', min:1, max:4, w:2 },
			{ type:'emberMage', min:2, max:4, w:2 },
			{ type:'magmaGolem', min:2, max:4, w: hot ? 2 : 1 },
		].filter(e => section >= e.min && section <= e.max);
		const list = pool.length ? pool : [{ type:'imp', w:1 }];
		let roll = R.rnd() * list.reduce((s, v) => s + v.w, 0);
		for(const v of list){ roll -= v.w; if(roll <= 0) return v.type; }
		return list[list.length - 1].type;
	}

	function generateFireInfernalDepths(){
		const R = rngFromSeed((Date.now() ^ (Math.random() * 0xFFFFFF | 0)) & 0x7FFFFFFF);
		const recipe = RECIPES[R.ri(0, RECIPES.length - 1)];
		const hotRun = R.chance(0.26);
		const heatBias = hotRun ? 36 : 0;

		const corridors = [];
		const enemies = [];
		const decorations = [];
		const platforms = [];
		const hazards = [];
		const interactables = [];
		const rooms = [];
		const puzzles = [];
		const gates = [];

		const WORLD_W = 32000;
		const KH = 1680;
		const ROOM_PAD = 220;
		const DOOR_H = 240;
		const HALL_H = 240;
		/* How far a hall punches INTO each room past the sealed shell. Depth only — door size stays the same. */
		const HALL_INSET = 200;
		const SHAFT_W = 240;
		const LAVA_ABOVE = 64;
		const LAVA_THICK = 28;
		function throatDepth(room){ return HALL_INSET; }

		function carve(x, y, w, h){
			x = Math.max(40, snap(x));
			y = Math.max(0, snap(y));
			w = Math.max(TILE * 3, snap(Math.min(w, WORLD_W - x - 40)));
			h = Math.max(TILE * 3, snap(h));
			const c = { x:x, y:y, w:w, h:h };
			corridors.push(c);
			return c;
		}

		const placed = Object.create(null);
		const occ = [];

		function aabbHit(a, b, pad){
			pad = pad == null ? ROOM_PAD : pad;
			return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
		}
		function blocked(x, y, w, h, pad){
			if(x < 40 || x + w > WORLD_W - 40 || y < KH) return true;
			const box = { x:x, y:y, w:w, h:h };
			for(const r of occ){
				const p = r.apron ? 16 : (pad == null ? ROOM_PAD : pad);
				if(aabbHit(box, r, p)) return true;
			}
			return false;
		}
		function markOcc(x, y, w, h, apron){
			occ.push({ x:x, y:y, w:w, h:h, apron: !!apron });
		}
		function markFloorApron(room, exits){
			const ay = snap(room.y + room.h);
			const ah = 240;
			const ax = snap(room.x - 40);
			const aw = snap(room.w + 80);
			if(exits && exits.bottom){
				const hx = snap(room.x + (exits.bottom.x != null ? exits.bottom.x : room.w / 2 - 100));
				const hw = snap(Math.max(exits.bottom.w || 200, 200));
				const leftW = Math.max(40, hx - 48 - ax);
				const rightX = snap(hx + hw + 48);
				markOcc(ax, ay, leftW, ah, true);
				if(rightX < ax + aw) markOcc(rightX, ay, ax + aw - rightX, ah, true);
			} else {
				markOcc(ax, ay, aw, ah, true);
			}
			if(exits && exits.top){
				const hx = snap(room.x + (exits.top.x != null ? exits.top.x : room.w / 2 - 100));
				const hw = snap(Math.max(exits.top.w || 200, 200));
				const cy = snap(room.y - 240);
				if(cy >= KH){
					const leftW = Math.max(40, hx - 48 - ax);
					markOcc(ax, cy, leftW, 240, true);
					const rightX = snap(hx + hw + 48);
					if(rightX < ax + aw) markOcc(rightX, cy, ax + aw - rightX, 240, true);
				}
			} else {
				const cy = snap(room.y - 240);
				if(cy >= KH) markOcc(ax, cy, aw, 240, true);
			}
		}
		function findFree(prefX, prefY, w, h, axis){
			const step = 200;
			const pad = ROOM_PAD;
			prefX = snap(prefX); prefY = snap(Math.max(KH, prefY));
			for(let i = 0; i < 50; i++){
				let x = prefX, y = prefY;
				if(axis === 'right') x += i * step;
				else if(axis === 'left') x -= i * step;
				else if(axis === 'down') y += i * step;
				else if(axis === 'up') y -= i * step;
				x = snap(x); y = snap(Math.max(KH, y));
				if(axis === 'right' && x < prefX) continue;
				if(axis === 'left' && x > prefX) continue;
				if(axis === 'down' && y < prefY) continue;
				if(axis === 'up' && y > prefY) continue;
				if(!blocked(x, y, w, h, pad)) return { x:x, y:y };
			}
			const jogs = [0, 320, -320, 640, -640, 960, -960, 1280, -1280];
			for(let i = 0; i < 40; i++){
				let x = prefX, y = prefY;
				if(axis === 'right') x += i * step;
				else if(axis === 'left') x -= i * step;
				else if(axis === 'down') y += i * step;
				else if(axis === 'up') y -= i * step;
				for(const jog of jogs){
					const x2 = snap(x + ((axis === 'down' || axis === 'up') ? jog : 0));
					const y2 = snap(y + ((axis === 'left' || axis === 'right') ? jog : 0));
					if(y2 < KH) continue;
					if(axis === 'right' && x2 < prefX) continue;
					if(axis === 'left' && x2 > prefX) continue;
					if(axis === 'down' && y2 < prefY) continue;
					if(axis === 'up' && y2 > prefY) continue;
					if(!blocked(x2, y2, w, h, pad)) return { x:x2, y:y2 };
				}
			}
			let maxY = KH + 200, maxX = 200;
			for(const r of rooms){
				maxY = Math.max(maxY, r.y + r.h);
				maxX = Math.max(maxX, r.x + r.w);
			}
			for(let n = 0; n < 60; n++){
				const x2 = snap(maxX + 240 + (n % 8) * 280);
				const y2 = snap(maxY + 400 + Math.floor(n / 8) * 400);
				if(x2 + w < WORLD_W - 40 && !blocked(x2, y2, w, h, pad)) return { x:x2, y:y2 };
			}
			return { x:snap(maxX + 240), y:snap(maxY + 800) };
		}

		function normalizeExits(tpl){
			const src = tpl.exits || {};
			const exits = {};
			const midY = snap(Math.max(40, Math.round((tpl.h - DOOR_H) * 0.42)));
			const climb = !!tpl.climbExits;
			for(const dir of ['left', 'right']){
				if(!src[dir]) continue;
				const e = Object.assign({}, src[dir]);
				if(!climb && (e.y == null || e.y > tpl.h * 0.55)){
					e.y = midY;
					e.h = DOOR_H;
					/* Not an authored climb door — seat it on the room's walk surface so the
					   hall floor and the room floor are the same level. */
					e.seat = 'floor';
				} else {
					e.h = Math.max(e.h || 160, 200);
				}
				exits[dir] = e;
			}
			if(src.top) exits.top = Object.assign({}, src.top, { w: Math.max(src.top.w || 160, 240) });
			if(src.bottom) exits.bottom = Object.assign({}, src.bottom, { w: Math.max(src.bottom.w || 160, 240) });
			return exits;
		}

		function sectionDress(room, section){
			const floor = room.y + room.h;
			decorations.push({ type:'torch', x:room.x + 36, y:room.y + 56, side:'left' });
			decorations.push({ type:'torch', x:room.x + room.w - 48, y:room.y + 56, side:'right' });
			decorations.push({ type:'embers', x:room.x + room.w * 0.5, y:room.y + room.h * 0.4, area:section >= 3 ? 380 : 220 });
			decorations.push({ type:'stalactite', x:room.x + room.w * 0.22, y:room.y + 4, h:28 + section * 6 });
			decorations.push({ type:'stalactite', x:room.x + room.w * 0.58, y:room.y + 4, h:22 + section * 5 });
			decorations.push({ type:'stalactite', x:room.x + room.w * 0.78, y:room.y + 6, h:34 });
			decorations.push({ type:'rubble', x:room.x + 70, y:floor, w:46 + section * 6 });
			decorations.push({ type:'rubble', x:room.x + room.w - 140, y:floor, w:40 });
			if(section >= 2){
				decorations.push({ type:'glowCrack', x:room.x + room.w * 0.3, y:room.y + 80, size:48 });
				decorations.push({ type:'glowCrack', x:room.x + room.w * 0.72, y:room.y + room.h * 0.35, size:36 });
				decorations.push({ type:'crystal', x:room.x + 90, y:floor - 8, size:16 });
			}
			if(section >= 3){
				decorations.push({ type:'pipe', x:room.x + room.w * 0.18, y:room.y + 20, h:90 });
				decorations.push({ type:'pipe', x:room.x + room.w * 0.84, y:room.y + 16, h:110 });
				decorations.push({ type:'column', x:room.x + room.w * 0.4, y:floor, h:150 });
				decorations.push({ type:'torch', x:room.x + room.w * 0.5, y:room.y + 40, side:'left' });
			}
			if(section >= 4){
				decorations.push({ type:'glowCrack', x:room.x + room.w * 0.48, y:room.y + room.h * 0.22, size:64 });
				decorations.push({ type:'embers', x:room.x + room.w * 0.28, y:room.y + room.h * 0.38, area:300 });
				decorations.push({ type:'vein', x:room.x + 24, y:room.y + 80, h:room.h - 120, side:'left' });
				decorations.push({ type:'vein', x:room.x + room.w - 28, y:room.y + 80, h:room.h - 120, side:'right' });
			}
			if(room.coolRoom){
				decorations.push({ type:'embers', x:room.x + room.w / 2, y:room.y + 90, area:50 });
			}
			if(section === 1){
				decorations.push({ type:'column', x:room.x + room.w * 0.33, y:floor, h:120 });
			}
		}

		function stampDoorway(room, dir, ex){
			if(dir === 'left' || dir === 'right'){
				const x = dir === 'left' ? room.x - 8 : room.x + room.w - 16;
				decorations.push({
					type:'doorway', dir:dir, x:x, y:room.y + ex.y - 12, w:24, h:ex.h + 24, roomId:room.id,
				});
				const padW = 200;
				const padX = dir === 'left' ? room.x + 8 : room.x + room.w - padW - 8;
				const padY = room.y + ex.y + ex.h - 8;
				if(!room.noDoorPads && padY < room.y + room.h - 36){
					platforms.push({
						x: snap(padX), y: snap(padY), w: snap(padW), h: TILE,
						kind:'static', roomId: room.id, landing:true,
					});
				}
			} else {
				const x = room.x + (ex.x != null ? ex.x : room.w / 2 - 120);
				const y = dir === 'top' ? room.y - 8 : room.y + room.h - 16;
				decorations.push({ type:'doorway', dir:dir, x:x, y:y, w:ex.w || 240, h:20, roomId:room.id });
			}
		}

		function stampTemplate(tpl, wx, wy, node){
			const exits = normalizeExits(tpl);
			const c = carve(wx, wy, tpl.w, tpl.h);
			const room = {
				id: rooms.length,
				kind: tpl.kind,
				label: tpl.label || tpl.kind,
				objective: tpl.objective || '',
				x: c.x, y: c.y, w: c.w, h: c.h,
				depth: node.section || 1,
				section: node.section || 1,
				optional: !!(node.optional || tpl.optional),
				secret: !!tpl.secret,
				noCombat: !!tpl.noCombat,
				elite: !!tpl.elite,
				hot: !!node.hot,
				coolRoom: !!tpl.coolRoom,
				category: tpl.category || 'required',
				exits: exits,
				doorLabels: tpl.doorLabels || {},
				doorLabel: tpl.doorLabel || '',
				cleared: false,
				locked: true,
				variant: tpl.variant || '',
				surviveFrames: tpl.surviveFrames || 0,
				surviveLeft: tpl.surviveFrames || 0,
				trial: tpl.trial || null,
				templateId: tpl.id,
				nodeId: node.id,
				climbExits: !!tpl.climbExits,
				usedExits: {},
				extraOpenings: [],
				floorHoles: [],
				noDoorPads: !!tpl.noDoorPads,
				raisedFloor: tpl.raisedFloor || 0,
			};
			markOcc(c.x, c.y, c.w, c.h);
			markFloorApron(room, exits);
			if(tpl.kind === 'start' || tpl.kind === 'preboss' || tpl.kind === 'boss' || tpl.kind === 'ashFork' || tpl.kind === 'forgeFork' || tpl.kind === 'cache' || tpl.kind === 'cooling' || tpl.kind === 'shrine' || tpl.kind === 'secretCave' || tpl.kind === 'secretShrine'){
				room.cleared = true;
				room.locked = false;
			}
			if(room.optional && tpl.kind !== 'warden' && tpl.kind !== 'elite' && tpl.kind !== 'eliteChamber' && tpl.kind !== 'vault' && tpl.kind !== 'trial' && tpl.kind !== 'secretElite'){
				room.locked = false;
			}
			rooms.push(room);
			placed[node.id] = room;
			sectionDress(room, room.section);
			if(tpl.decors){
				for(const d of tpl.decors){
					const nx = room.x + (d.x || 0);
					const ny = d.yFromFloor != null ? (room.y + room.h - (d.yFromFloor || 0)) : room.y + (d.y || 0);
					decorations.push(Object.assign({}, d, { x: nx, y: ny }));
				}
			}
			for(const dir of Object.keys(exits)) stampDoorway(room, dir, exits[dir]);

			const floor = room.y + room.h;
			if(tpl.pits){
				for(const pit of tpl.pits){
					const px = snap(room.x + pit.x);
					const pw = snap(pit.w);
					const pd = snap(Math.max(80, pit.depth));
					const py = snap(room.y + room.h);
					const pitBox = { x:px, y:py, w:pw, h:pd };
					let pitBlocked = py < 0 || px < 40 || px + pw > WORLD_W - 40;
					if(!pitBlocked){
						for(const r of occ){
							if(r.x === room.x && r.y === room.y && r.w === room.w) continue;
							if(aabbHit(pitBox, r, 40)){ pitBlocked = true; break; }
						}
					}
					if(pitBlocked) continue;
					const p = carve(px, py, pw, pd);
					markOcc(p.x, p.y, p.w, p.h);
					room.floorHoles.push({ x:p.x, w:p.w });
					room.pitFloors = room.pitFloors || [];
					room.pitFloors.push({ x:p.x, y:p.y + p.h - 40, w:p.w, h:48 });
					if(tpl.lavaLake){
						const ground = floor - (room.raisedFloor || 0);
						const ly = ground - LAVA_ABOVE - LAVA_THICK;
						const lx = Math.max(p.x + 8, room.x + 48);
						const lw = Math.min(p.x + p.w - 8, room.x + room.w - 48) - lx;
						if(lw > 40){
							decorations.push({ type:'lava', x:lx, y:ly, w:lw, h:LAVA_ABOVE + LAVA_THICK, _env:true, bed:true, surface:true, groundY:ground });
							decorations.push({ type:'lavaWell', x:lx, y:ground, w:lw, h:Math.max(48, p.h - 40), roomId: room.id });
						}
					} else {
						decorations.push({ type:'lava', x:p.x + 6, y:p.y + p.h - LAVA_ABOVE - LAVA_THICK, w:p.w - 12, h:LAVA_ABOVE + LAVA_THICK, _env:true, bed:true, groundY:p.y + p.h });
					}
				}
			}
			if(tpl.lavaLake){
				const hasLake = decorations.some(d => d.surface && d.x >= room.x - 4 && d.x < room.x + room.w);
				if(!hasLake){
					const ground = floor - (room.raisedFloor || 0);
					const lx = room.x + 48;
					const lw = room.w - 96;
					decorations.push({ type:'lava', x:lx, y:ground - LAVA_ABOVE - LAVA_THICK, w:lw, h:LAVA_ABOVE + LAVA_THICK, _env:true, bed:true, surface:true, groundY:ground });
				}
			}
			if(tpl.ledge) room._ledge = tpl.ledge;
			if(tpl.pillars){
				room.pillars = tpl.pillars.map(p => ({
					x: room.x + p.x,
					y: floor - (p.yFromFloor || 0) - (p.h || 200),
					w: p.w, h: p.h || 200,
				}));
				for(const p of room.pillars){
					platforms.push({ x:snap(p.x), y:snap(p.y), w:snap(p.w), h:p.h, kind:'static', roomId:room.id, pillar:true });
				}
			}
			if(tpl.cracks){
				room.cracks = tpl.cracks.map(c => ({ x: room.x + c.x, y: floor - 8, w: c.w, h: 16 }));
			}
			if(tpl.vents){
				room.vents = tpl.vents.map(v => ({ x: room.x + v.x, y: floor - (room.raisedFloor || 0) - 8, w: v.w || 70, h: 18 }));
			}
			room.authoredArena = !!tpl.authoredArena;

			for(const p of (tpl.platforms || [])){
				const plat = {
					x: snap(room.x + p.x),
					y: snap(floor - (p.yFromFloor || 0)),
					w: snap(p.w), h: p.h || TILE,
					kind: p.kind || 'static',
					roomId: room.id,
					life: p.life,
					axis: p.axis, dist: p.dist, spd: p.spd,
					radius: p.radius, ang: p.ang,
					raftDir: p.raftDir,
					perch: !!p.perch,
					central: !!p.central,
				};
				if(plat.kind === 'move' || plat.kind === 'raft' || plat.kind === 'orbit'){
					plat.homeX = plat.x; plat.homeY = plat.y;
				}
				platforms.push(plat);
			}

			for(const hz of (tpl.hazards || [])){
				const h = Object.assign({ roomId: room.id, element:'fire' }, hz);
				if(h.type === 'vent'){
					h.x = room.x + hz.x;
					h.y = floor - (room.raisedFloor || 0) - (hz.yFromFloor || 8);
					h.columnH = Math.max(hz.columnH || 200, 280);
					h.mode = 'geyser';
				} else if(h.type === 'fall'){
					h.x = room.x + hz.x;
					h.y = room.y + (hz.y || 16);
					h.h = hz.hFromCeil != null ? hz.hFromCeil : (room.h - 70);
				} else if(h.type === 'gate'){
					h.x = snap(room.x + hz.x);
					h.y = snap(floor - (hz.yFromFloor || 0) - hz.h);
				} else if(h.type === 'channel'){
					const wallPad = 56;
					const ground = floor - (room.raisedFloor || 0);
					h.surfaceH = LAVA_THICK;
					h.h = LAVA_ABOVE + LAVA_THICK;
					h.y = ground - LAVA_ABOVE - LAVA_THICK;
					h.groundY = ground;
					if(hz.mode === 'geysers'){
						const mid = room.x + room.w * 0.5;
						h.left = { x: room.x + wallPad, w: Math.max(80, mid - (room.x + wallPad)) };
						h.right = { x: mid, w: Math.max(80, (room.x + room.w - wallPad) - mid) };
						h.mode = 'geysers';
						h.geyserH = hz.geyserH || 210;
						const n = hz.geyserCount || 4;
						h.geysers = [];
						const sprinkle = (side, name) => {
							for(let i = 0; i < n; i++){
								const u = n <= 1 ? 0.5 : i / (n - 1);
								const gx = side.x + 30 + u * Math.max(40, side.w - 60);
								h.geysers.push({ x: gx - 24, w: 48, columnH: h.geyserH, side: name });
							}
						};
						sprinkle(h.left, 'left');
						sprinkle(h.right, 'right');
						h.geysers = h.geysers.filter(g => {
							for(const p of platforms){
								if(p.roomId !== room.id) continue;
								if(g.x + g.w > p.x - 28 && g.x < p.x + p.w + 28) return false;
							}
							return true;
						});
					} else {
						h.left = { x: room.x + hz.left.x, w: hz.left.w };
						h.right = { x: room.x + hz.right.x, w: hz.right.w };
					}
				} else if(h.type === 'lavaBubbles'){
					const hole = room.floorHoles[0];
					h.x = hole ? hole.x + 8 : room.x + 80;
					h.w = hole ? Math.max(80, hole.w - 16) : room.w - 160;
					h.y = floor - LAVA_ABOVE - LAVA_THICK + 6;
					h.bubbles = [];
				} else if(h.type === 'rise'){
					h.x = room.x + (hz.x || 16);
					h.w = hz.w || (room.w - 32);
					h.y0 = floor - (hz.yFromFloor || 20);
					h.y1 = room.y + room.h * (hz.riseTo || 0.42);
					h.y = h.y0;
					h.active = false;
					h.armed = hz.armed !== false;
					h.vault = !!hz.vault;
				}
				hazards.push(h);
			}

			for(const lv of (tpl.lavaRects || [])){
				let x = room.x + lv.x;
				let w = lv.w;
				const wallPad = 56;
				const minX = room.x + wallPad;
				const maxX = room.x + room.w - wallPad;
				if(x < minX){ w -= (minX - x); x = minX; }
				if(x + w > maxX) w = maxX - x;
				if(w < 80) continue;
				const h = Math.max(LAVA_THICK, lv.h || 20);
				const ground = floor - (room.raisedFloor || 0);
				decorations.push({
					type:'lava',
					x: x,
					y: ground - LAVA_ABOVE - h,
					w: w, h: LAVA_ABOVE + h,
					_env: true,
					surface: true,
					groundY: ground,
				});
			}

			for(const it of (tpl.interactables || [])){
				const rec = {
					kind: it.kind,
					roomId: room.id,
					x: room.x + it.x,
					y: it.y != null ? room.y + it.y : floor - (it.yFromFloor || 80) - (it.h || 60),
					w: it.w, h: it.h,
					name: it.name, icon: it.icon, text: it.text,
					used: false,
					reusable: !!it.reusable,
					rare: !!it.rare,
				};
				if(it.kind === 'channelLever'){
					rec.hazardRef = hazards.find(h => h.roomId === room.id && h.type === 'channel') || null;
				}
				interactables.push(rec);
			}

			if(tpl.clearZone){
				room.clearZone = {
					x: room.x + tpl.clearZone.x,
					y: tpl.clearZone.y != null ? room.y + tpl.clearZone.y : floor - (tpl.clearZone.yFromFloor || 0) - (tpl.clearZone.h || 160),
					w: tpl.clearZone.w, h: tpl.clearZone.h,
				};
			}

			for(const sp of (tpl.spawnAnchors || [])){
				const type = sp.type || (tpl.kind === 'warden' ? 'magmaWarden' : pickEnemy(R, room.section, room.hot || hotRun));
				const x = room.x + sp.x;
				const hoverY = floor - (sp.yFromFloor || 12);
				const fromLava = type === 'fireSprite' && !!tpl.lavaLake;
				enemies.push({
					type: type,
					x: x, y: fromLava ? floor + 30 : hoverY,
					patrol: [Math.max(room.x + 40, x - 180), Math.min(room.x + room.w - 40, x + 180)],
					puzzleSeg: room.section,
					roomId: room.id,
					isMiniBoss: type === 'magmaWarden',
					_cliff: sp.yFromFloor > 40,
					_riseFrom: fromLava,
					_hoverY: hoverY,
				});
			}

			if(tpl.kind === 'ashen' || node.hot){
				addHeatDecor(room);
			}
			return room;
		}

		function addHeatDecor(room){
			decorations.push({ type:'crack', x:room.x + room.w * 0.2, y:room.y + 60, size:36 });
			decorations.push({ type:'embers', x:room.x + room.w * 0.7, y:room.y + room.h * 0.35, area:360 });
		}

		function exitAnchor(room, dir){
			const ex = (room.exits && room.exits[dir]) || {};
			if(dir === 'left' || dir === 'right'){
				const doorH = ex.h || DOOR_H;
				let y = room.y + (ex.y != null ? ex.y : Math.round((room.h - doorH) * 0.42));
				const walk = room.y + room.h - (room.raisedFloor || 0);
				if(ex.seat === 'floor'){
					/* Door bottom flush with the walk surface — same aperture, correct level. */
					y = walk - doorH;
				} else if(room.raisedFloor && y + doorH > walk + 8){
					y = walk - doorH + 16;
				}
				y = Math.max(room.y + 40, y);
				return {
					x: dir === 'left' ? room.x : room.x + room.w,
					y: snap(y),
					w: 8,
					h: doorH,
				};
			}
			if(dir === 'top') return { x: room.x + (ex.x != null ? ex.x : room.w / 2 - 120), y: room.y, w: ex.w || 240, h: 8 };
			return { x: room.x + (ex.x != null ? ex.x : room.w / 2 - 120), y: room.y + room.h, w: ex.w || 240, h: 8 };
		}

		/* While a connector is being carved, these two rooms are the ones it joins. */
		let linkRooms = null;
		/* A connector that must cross one of its own rooms' shells records that
		   penetration, so the shell reseal cannot close the route back up.
		   This adds depth through the wall it already carved — it never widens a door,
		   and third-party rooms still get sealed (no skip paths). */
		function keepOpen(room, x, y, w, h){
			if(!room) return;
			const x0 = Math.max(x, room.x - 48), x1 = Math.min(x + w, room.x + room.w + 48);
			const y0 = Math.max(y, room.y - 48), y1 = Math.min(y + h, room.y + room.h + 48);
			if(x1 <= x0 || y1 <= y0) return;
			room.extraOpenings = room.extraOpenings || [];
			room.extraOpenings.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
		}
		function carveHall(x, y, w, h){
			const c = carve(x, y, w, h);
			if(linkRooms){
				for(const r of linkRooms) keepOpen(r, c.x, c.y, c.w, c.h);
			}
			return c;
		}
		function horiz(x0, x1, y, h){
			const left = snap(Math.min(x0, x1));
			const right = snap(Math.max(x0, x1));
			/* +TILE so the far edge is included after floor/ceil tile stamping (depth, not width of the door). */
			return carveHall(left, snap(y), Math.max(80, right - left + TILE), h || HALL_H);
		}
		function vert(x, y0, y1, w){
			const top = snap(Math.min(y0, y1));
			const bot = snap(Math.max(y0, y1));
			return carveHall(snap(x), top, w || 200, Math.max(80, bot - top + TILE));
		}
		/* Cover both door rectangles in Y so L-joins still meet when rooms jog. */
		function spanDoorsY(A, B){
			const top = Math.min(A.y, B.y);
			const bot = Math.max(A.y + (A.h || HALL_H), B.y + (B.h || HALL_H));
			return { y: snap(top), h: Math.max(HALL_H, snap(bot) - snap(top)) };
		}
		function openExit(room, dir){
			if(!room || !dir) return;
			room.usedExits = room.usedExits || {};
			room.usedExits[dir] = true;
			const A = exitAnchor(room, dir);
			room.extraOpenings = room.extraOpenings || [];
			const doorH = A.h || DOOR_H;
			const doorW = A.w || 240;
			const openY = snap(A.y) + Math.max(0, HALL_H - doorH);
			if(dir === 'left') room.extraOpenings.push({ x: room.x - 40, y: openY, w: 40 + HALL_INSET, h: doorH });
			if(dir === 'right') room.extraOpenings.push({ x: room.x + room.w - HALL_INSET, y: openY, w: HALL_INSET + 40, h: doorH });
			if(dir === 'top') room.extraOpenings.push({ x: snap(A.x), y: room.y - 40, w: doorW, h: 40 + HALL_INSET });
			if(dir === 'bottom') room.extraOpenings.push({ x: snap(A.x), y: room.y + room.h - HALL_INSET, w: doorW, h: HALL_INSET + 48 });
		}
		function addLock(a, b, x, y, w, h, opt){
			if(!opt || !opt.lock || a.optional) return;
			const gate = { x:x, y:y, w:w, h:h, fromRoom: a.id, toRoom: b.id };
			gates.push(gate);
			a.outGates = a.outGates || [];
			a.outGates.push(gate);
		}

		function connectSide(a, fromDir, b, toDir, opt){
			const A = exitAnchor(a, fromDir);
			const B = exitAnchor(b, toDir);
			const span = spanDoorsY(A, B);
			const h = HALL_H;
			const aRight = a.x + a.w;
			const bRight = b.x + b.w;
			const aDepth = throatDepth(a);
			const bDepth = throatDepth(b);

			if(fromDir === 'right' && toDir === 'left' && b.x >= aRight - 8){
				const x0 = a.x + a.w - aDepth;
				const x1 = b.x + bDepth;
				if(Math.abs(A.y - B.y) <= 20){
					horiz(x0, x1, A.y, h);
				} else {
					const midX = snap((aRight + b.x) / 2 - 80);
					horiz(x0, midX + 160, A.y, h);
					vert(midX, A.y, B.y + h, 160);
					horiz(midX, x1, B.y, h);
				}
				addLock(a, b, a.x + a.w - 8, span.y, 48, h, opt);
				return true;
			}
			if(fromDir === 'left' && toDir === 'right' && a.x >= bRight - 8){
				const x0 = b.x + b.w - bDepth;
				const x1 = a.x + aDepth;
				if(Math.abs(A.y - B.y) <= 20){
					horiz(x0, x1, A.y, h);
				} else {
					const midX = snap((bRight + a.x) / 2 - 80);
					horiz(x0, midX + 160, A.y, h);
					vert(midX, A.y, B.y + h, 160);
					horiz(midX, x1, B.y, h);
				}
				addLock(a, b, a.x - 8, span.y, 48, h, opt);
				return true;
			}

			/* Misaligned side doors: short L at the two mouths only — never a wraparound hall. */
			const aMouth = fromDir === 'right' ? a.x + a.w - aDepth : a.x + aDepth;
			const bMouth = toDir === 'left' ? b.x + bDepth : b.x + b.w - bDepth;
			const col = fromDir === 'right' ? snap(a.x + a.w + 8) : snap(a.x - 168);
			horiz(aMouth, col + 160, A.y, h);
			vert(col, A.y, B.y + h, 160);
			horiz(bMouth, col + 160, B.y, h);
			addLock(a, b, fromDir === 'right' ? a.x + a.w - 8 : a.x - 8, span.y, 48, h, opt);
			return true;
		}

		function connectMixed(a, fromDir, b, toDir, opt){
			const A = exitAnchor(a, fromDir);
			const B = exitAnchor(b, toDir);
			const h = HALL_H;
			const aBelow = a.y >= b.y + b.h - 8;
			const bBelow = b.y >= a.y + a.h - 8;
			const aDepth = throatDepth(a);
			const bDepth = throatDepth(b);

			if((fromDir === 'bottom' || fromDir === 'top') && (toDir === 'bottom' || toDir === 'top') && (aBelow || bBelow)){
				const topRoom = aBelow ? b : a;
				const botRoom = topRoom === a ? b : a;
				const topEx = exitAnchor(topRoom, topRoom === a ? fromDir : toDir);
				const botEx = exitAnchor(botRoom, botRoom === a ? fromDir : toDir);
				const ax = snap(topEx.x);
				const bx = snap(botEx.x);
				const top = topRoom.y + topRoom.h - throatDepth(topRoom);
				const bot = botRoom.y + throatDepth(botRoom);
				if(Math.abs(ax - bx) < 80){
					vert(ax, top, bot, 200);
				} else {
					const midY = snap(top + Math.max(80, Math.min(200, (bot - top) * 0.4)));
					vert(ax, top, midY + h, 200);
					horiz(ax, bx + 200, midY, h);
					vert(bx, midY, bot, 200);
				}
				addLock(a, b, ax, top, 240, 88, opt);
				return true;
			}

			/* A drop column must never pass through the destination room's ceiling — if the
			   hatch sits over that room, step the shaft out to a column beside it first. */
			function dropIntoSideDoor(from, hatchX, dest, side, destDoorY, colW){
				const destY = snap(destDoorY);
				const gapTop = from.y + from.h;
				const gapBot = dest.y;
				const overRoom = hatchX > dest.x - 120 && hatchX < dest.x + dest.w + 120;
				const mouth = side === 'left' ? dest.x + throatDepth(dest) : dest.x + dest.w - throatDepth(dest);
				if(!overRoom){
					vert(hatchX, gapTop - throatDepth(from), destY + h, colW);
					horiz(hatchX, mouth, destY, h);
					return;
				}
				/* Step out of the room's footprint above its ceiling, then come down beside it. */
				const colX = side === 'left' ? snap(dest.x - 200) : snap(dest.x + dest.w);
				const midY = snap(Math.max(gapTop + 40, Math.min(gapBot - h - 40, (gapTop + gapBot) / 2 - h / 2)));
				vert(hatchX, gapTop - throatDepth(from), midY + h, colW);
				horiz(Math.min(hatchX, colX), Math.max(hatchX, colX) + colW, midY, h);
				vert(colX, midY, destY + h, colW);
				horiz(colX, mouth, destY, h);
			}

			/* Combat/elite hatches drop to the destination door — no return hall under the room. */
			if(fromDir === 'bottom' && (a.kind === 'elite' || a.kind === 'combat' || a.kind === 'eliteChamber') && b.y >= a.y + a.h - 8){
				const dropX = snap(A.x);
				const destY = snap(B.y);
				if(toDir === 'top'){
					vert(dropX, a.y + a.h - aDepth, destY + h, 220);
					vert(dropX, destY, b.y + bDepth, 220);
				} else {
					dropIntoSideDoor(a, dropX, b, toDir, destY, 220);
				}
				addLock(a, b, dropX, a.y + a.h - 40, 240, 88, opt);
				return true;
			}

			/* Floor hatch into a side door: stay in the gap, then enter only through that door. */
			if(fromDir === 'bottom' && (toDir === 'left' || toDir === 'right') && b.y >= a.y + a.h - 8){
				const dropX = snap(A.x);
				dropIntoSideDoor(a, dropX, b, toDir, B.y, 200);
				addLock(a, b, dropX, a.y + a.h - 40, 240, 88, opt);
				return true;
			}
			if(toDir === 'bottom' && (fromDir === 'left' || fromDir === 'right') && a.y >= b.y + b.h - 8){
				const dropX = snap(B.x);
				dropIntoSideDoor(b, dropX, a, fromDir, A.y, 200);
				addLock(a, b, fromDir === 'right' ? a.x + a.w - 8 : a.x - 8, A.y, 48, h, opt);
				return true;
			}

			if(fromDir === 'top' && (toDir === 'left' || toDir === 'right') && a.y >= b.y + b.h - 8){
				const upX = snap(A.x);
				const midY = snap(a.y - h - 40);
				const sideX = toDir === 'left' ? b.x - 160 : b.x + b.w;
				vert(upX, midY, a.y + aDepth, 200);
				horiz(upX, sideX + 160, midY, h);
				vert(sideX, B.y, midY + h, 160);
				horiz(sideX, toDir === 'left' ? b.x + bDepth : b.x + b.w - bDepth, B.y, h);
				addLock(a, b, upX, a.y - 8, 200, 48, opt);
				return true;
			}
			if(toDir === 'top' && (fromDir === 'left' || fromDir === 'right') && b.y >= a.y + a.h - 8){
				const upX = snap(B.x);
				const midY = snap(a.y + a.h + 40);
				const sideX = fromDir === 'right' ? a.x + a.w : a.x - 160;
				const aMouth = fromDir === 'left' ? a.x + aDepth : a.x + a.w - aDepth;
				horiz(aMouth, sideX + 160, A.y, h);
				vert(sideX, A.y, midY + h, 160);
				horiz(sideX, upX + 200, midY, h);
				vert(upX, midY, b.y + bDepth, 200);
				addLock(a, b, fromDir === 'right' ? a.x + a.w - 8 : a.x - 8, A.y, 48, h, opt);
				return true;
			}

			/* Last resort: door-to-door only, no wraparound return hall. */
			if(b.x >= a.x + a.w - 8){
				const span = spanDoorsY(A, B);
				horiz(a.x + a.w - aDepth, b.x + bDepth, span.y, span.h);
				if(Math.abs(A.y - B.y) > 24) vert(b.x - 8, A.y, B.y + (B.h || HALL_H), 160);
			} else if(a.x >= b.x + b.w - 8){
				const span = spanDoorsY(A, B);
				horiz(b.x + b.w - bDepth, a.x + aDepth, span.y, span.h);
				if(Math.abs(A.y - B.y) > 24) vert(a.x - 8, A.y, B.y + (B.h || HALL_H), 160);
			} else {
				horiz(A.x - 20, A.x + A.w + 20, A.y, A.h || HALL_H);
				horiz(B.x - 20, B.x + B.w + 20, B.y, B.h || HALL_H);
			}
			return true;
		}

		function connectRooms(a, fromDir, b, toDir, opt){
			linkRooms = [a, b];
			try {
				openExit(a, fromDir);
				openExit(b, toDir);
				const side = (fromDir === 'left' || fromDir === 'right') && (toDir === 'left' || toDir === 'right');
				if(side) return connectSide(a, fromDir, b, toDir, opt);
				return connectMixed(a, fromDir, b, toDir, opt);
			} finally {
				linkRooms = null;
			}
		}

		/* Place rooms: start near top, then pack by aligned exits with collision checks. */
		const startTpl = pickTemplate(R, 'start', 1, heatBias);
		const startX = 200;
		const startY = KH + 80;
		stampTemplate(startTpl, startX, startY, recipe.nodes[0]);

		const pending = recipe.nodes.slice(1);
		const nodeById = Object.create(null);
		for(const n of recipe.nodes) nodeById[n.id] = n;

		function preferredSlot(from, fromDir, tpl, toDir, gap){
			const fromEx = (from.exits && from.exits[fromDir]) || {};
			const toEx = normalizeExits(tpl)[toDir] || {};
			let x = from.x, y = from.y;
			if(fromDir === 'right'){
				x = from.x + from.w + gap;
				y = from.y + (fromEx.y || 0) - (toEx.y || 0);
			} else if(fromDir === 'left'){
				x = from.x - tpl.w - gap;
				y = from.y + (fromEx.y || 0) - (toEx.y || 0);
			} else if(fromDir === 'bottom'){
				x = from.x + ((fromEx.x != null ? fromEx.x : from.w / 2) - (toEx.x != null ? toEx.x : tpl.w / 2));
				y = from.y + from.h + gap;
			} else if(fromDir === 'top'){
				x = from.x + ((fromEx.x != null ? fromEx.x : from.w / 2) - (toEx.x != null ? toEx.x : tpl.w / 2));
				y = from.y - tpl.h - gap;
			}
			return { x: snap(x), y: snap(Math.max(KH, y)), axis: fromDir === 'left' ? 'left' : fromDir === 'right' ? 'right' : fromDir === 'top' ? 'up' : 'down' };
		}

		function placeNext(node){
			if(placed[node.id]) return placed[node.id];
			if(node.optional && node.rare != null && !R.chance(node.rare + (heatBias >= 36 ? 0.12 : 0))){
				placed[node.id] = null;
				return null;
			}
			const inEdge = recipe.edges.find(e => e[2] === node.id && placed[e[0]]);
			const tpl = pickTemplate(R, node.kind, node.section, heatBias);
			if(!tpl) return null;
			let pref;
			if(!inEdge || !placed[inEdge[0]]){
				let host = null;
				for(let i = recipe.nodes.length - 1; i >= 0; i--){
					if(placed[recipe.nodes[i].id]){ host = placed[recipe.nodes[i].id]; break; }
				}
				if(!host) return null;
				pref = { x: snap(host.x), y: snap(host.y + host.h + 280), axis:'down' };
			} else {
				const vert = inEdge[1] === 'bottom' || inEdge[1] === 'top' || inEdge[3] === 'bottom' || inEdge[3] === 'top';
				pref = preferredSlot(placed[inEdge[0]], inEdge[1], tpl, inEdge[3], vert ? 320 : 200);
			}
			if(node.kind === 'ascent'){
				pref.y = snap(Math.max(pref.y, KH + 1120));
			}
			if(inEdge && (inEdge[1] === 'top' || inEdge[1] === 'right' || inEdge[1] === 'left')){
				const axis = inEdge[1];
				for(let i = 0; i < 24; i++){
					let x = pref.x, y = pref.y;
					if(axis === 'top') y = snap(pref.y - i * 160);
					if(axis === 'right') x = snap(pref.x + i * 160);
					if(axis === 'left') x = snap(pref.x - i * 160);
					if(axis === 'top' && y < KH) break;
					if(x < 40 || x + tpl.w > WORLD_W - 40) break;
					if(!blocked(x, y, tpl.w, tpl.h, ROOM_PAD)){
						return stampTemplate(tpl, x, y, node);
					}
				}
				const slot = findFree(pref.x, pref.y, tpl.w, tpl.h, pref.axis);
				return stampTemplate(tpl, slot.x, slot.y, node);
			}
			const slot = findFree(pref.x, pref.y, tpl.w, tpl.h, pref.axis);
			if(node.optional && (slot.x < 40 || slot.x + tpl.w > WORLD_W - 40)){
				placed[node.id] = null;
				return null;
			}
			return stampTemplate(tpl, slot.x, slot.y, node);
		}

		/* First required room sits immediately right of start. Do not jog or fallback. */
		const firstNode = recipe.nodes.find(n => n.id === 'c1');
		if(firstNode && placed.start){
			const firstTpl = pickTemplate(R, firstNode.kind, firstNode.section, heatBias);
			if(firstTpl){
				const pref = preferredSlot(placed.start, 'right', firstTpl, 'left', 200);
				stampTemplate(firstTpl, pref.x, pref.y, firstNode);
			}
		}

		/* Multi-pass so hosts exist before dependents. */
		for(let pass = 0; pass < 8; pass++){
			for(const n of pending){
				if(placed[n.id] !== undefined) continue;
				const needs = recipe.edges.filter(e => e[2] === n.id);
				const ready = needs.length === 0 || needs.some(e => placed[e[0]]);
				if(ready) placeNext(n);
				if(n.id === 'up' && placed.up && nodeById.c2 && placed.c2 === undefined) placeNext(nodeById.c2);
			}
		}

		for(const e of recipe.edges){
			const a = placed[e[0]], b = placed[e[2]];
			if(!a || !b) continue;
			const meta = e[4] || {};
			const lock = !meta.optional && a.category !== 'optional' && !a.optional && !a.cleared && a.kind !== 'start' && a.kind !== 'ashFork' && a.kind !== 'forgeFork' && a.kind !== 'preboss';
			connectRooms(a, e[1], b, e[3], { lock: lock, optional: !!meta.optional });
		}

		/* Always punch a walk-through from the start door into the first combat room. */
		if(placed.start && placed.c1){
			const s = placed.start, c1 = placed.c1;
			linkRooms = [s, c1];
			openExit(s, 'right');
			openExit(c1, 'left');
			const A = exitAnchor(s, 'right');
			const B = exitAnchor(c1, 'left');
			const y = snap(Math.min(A.y, B.y));
			horiz(s.x + s.w - HALL_INSET, c1.x + HALL_INSET, y, HALL_H);
			s.extraOpenings.push({ x: s.x + s.w - HALL_INSET, y: y, w: HALL_INSET + 40, h: HALL_H });
			c1.extraOpenings.push({ x: c1.x - 40, y: y, w: 40 + HALL_INSET, h: HALL_H });
			if(Math.abs(A.y - B.y) > 16){
				vert(c1.x - 8, A.y, B.y + HALL_H, 160);
			}
			linkRooms = null;
		}

		for(const e of recipe.edges){
			const a = placed[e[0]], b = placed[e[2]];
			if(!a || !b) continue;
			const meta = e[4] || {};
			const signText = (meta.optional && b.doorLabel) || (a.doorLabels && a.doorLabels[e[1]]);
			if(signText){
				const anc = exitAnchor(a, e[1]);
				interactables.push({
					kind:'doorSign',
					roomId: a.id,
					x: anc.x - 40,
					y: anc.y - 36,
					w: 80, h: 28,
					name: signText,
					text: signText,
				});
			}
		}

		/* Secret chance off a mid-run combat host. */
		if(R.chance(0.22 + (hotRun ? 0.08 : 0))){
			const hosts = rooms.filter(r => r.kind === 'combat' && r.section >= 2 && r.section <= 3);
			const host = hosts.length ? R.choice(hosts) : null;
			if(host){
				const sk = R.choice(['secretCave', 'secretShrine', 'secretElite']);
				const st = pickTemplate(R, sk, host.section, heatBias);
				const sx0 = host.x + host.w + 200;
				const sy0 = host.y + Math.max(0, host.h - st.h);
				if(st && !blocked(sx0, sy0, st.w, st.h)){
					const secret = stampTemplate(st, sx0, sy0, { id:'secret', kind:sk, section:host.section, optional:true });
					const wall = { x: host.x + host.w - 20, y: host.y + host.h - 180, w: 40, h: 160, fromRoom: host.id, secret:true };
					host.secretWall = wall;
					host.extraOpenings = host.extraOpenings || [];
					host.extraOpenings.push({ x: wall.x - 8, y: wall.y, w: 64, h: wall.h });
					interactables.push({
						kind:'secretWall',
						roomId: host.id,
						x: wall.x, y: wall.y, w: wall.w, h: wall.h,
						name:'Cracked Wall',
						icon:'🪨',
						secretTo: secret.id,
					});
					/* connector exists but blocked until wall breaks — carve air behind wall after break */
					secret._secretHall = { x: host.x + host.w - 8, y: wall.y, w: 180, h: 160 };
				}
			}
		}

		const startRoom = placed.start;
		const bossRoom = placed.boss;
		const preRoom = placed.pre;
		let maxY = 0;
		for(const r of rooms) maxY = Math.max(maxY, r.y + r.h);
		const WORLD_H = Math.max(maxY + 240, (bossRoom ? bossRoom.y + bossRoom.h : 8000) + 240);

		const preLock = preRoom ? { x: preRoom.x, y: preRoom.y - 40, w: preRoom.w, h: 40 } : { x:400, y:200, w:2000, h:40 };
		const bossLock = bossRoom ? { x: bossRoom.x, y: bossRoom.y + 200, w: 40, h: 240 } : { x:400, y:400, w:40, h:240 };

		const kitten = startRoom ? {
			shaft: { x: startRoom.x, y: 0, w: 120, h: startRoom.y },
			corridor: { x: startRoom.x, y: 0, w: 2400, h: 200 },
			arena: { x: startRoom.x + 2320, y: 0, w: 1800, h: 1680 },
			chainDoor: { x: startRoom.x, y: startRoom.y - 12, w: 120, h: 16 },
			lockWall: { x: startRoom.x + 2320, y: 0, w: 40, h: 200 },
		} : null;

		if(kitten && startRoom){
			startRoom.extraOpenings = startRoom.extraOpenings || [];
			startRoom.extraOpenings.push({
				x: kitten.chainDoor.x, y: startRoom.y - 24, w: kitten.chainDoor.w, h: 48,
			});
		}

		const playerStart = startRoom
			? { x: startRoom.x + 80, y: startRoom.y + startRoom.h - 80 }
			: { x: 180, y: startY + 300 };

		return {
			name: 'The Infernal Depths',
			worldW: WORLD_W,
			worldH: WORLD_H,
			bgColor:'#190704', wallColor:'#4a1a0a', wallColor2:'#6a2a12', wallEdge:'#8a3e1a',
			floorHighlight:'#9a5630', ceilShadow:'#240b04', airColor:'#2f1108',
			playerStart: playerStart,
			corridors: corridors,
			enemies: enemies,
			decorations: decorations,
			puzzles: puzzles,
			rooms: rooms,
			platforms: platforms,
			hazards: hazards,
			interactables: interactables,
			_gates: gates,
			_theme: 'fire',
			_meter: 'heat',
			_meterLabel: 'Heat',
			_hotRun: hotRun,
			_recipe: recipe.id,
			_bossRoomRect: bossRoom ? { x:bossRoom.x, y:bossRoom.y, w:bossRoom.w, h:bossRoom.h } : { x:520, y:8000, w:4400, h:1680 },
			_prebossLockWall: preLock,
			_bossLockWall: bossLock,
			_bossRoomTriggerY: bossRoom ? bossRoom.y + 40 : 8000,
			_bossPlatforms: (bossRoom && platforms.filter(p => p.roomId === bossRoom.id && p.kind === 'static' && !p.pillar).map(p => ({ x:p.x, y:p.y, w:p.w }))) || [],
			_tablet: bossRoom ? { x: bossRoom.x + 160, y: bossRoom.y + 600 - 120 } : null,
			_kitten: kitten,
		};
	}

	global.generateFireLegacy = generateFireInfernalDepths;
})(typeof window !== 'undefined' ? window : globalThis);
